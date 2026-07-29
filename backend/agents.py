"""
agents.py — The agent pipeline using Groq API.

Every LLM/tool call is wrapped in traced_call() which:
  1. Creates a Node row with status='running'
  2. Executes the actual function
  3. Updates the node with output and status='success'|'error'
  4. Returns (output, node_id) for chaining parent_id
"""
import json
import os
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from groq import Groq
from sqlalchemy.orm import Session

from database import SessionLocal, is_sqlite
from models import Node, Run
import schemas
from ws_manager import ws_manager
from tracing import trace_agent_span

load_dotenv()

def _broadcast_node_event(run_id: int, event_type: str, node: Node, run_status: Optional[str] = None):
    try:
        node_data = schemas.NodeOut.model_validate(node).model_dump(mode="json")
        ws_manager.broadcast_sync(run_id, {
            "type": "node_event",
            "event": event_type,
            "node": node_data,
            "run_status": run_status,
        })
    except Exception:
        pass


# ── Groq client ───────────────────────────────────────────────────────────────
_groq_client: Optional[Groq] = None

def get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not set in environment / .env file")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

DEFAULT_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "openai/gpt-oss-120b",
]

MODEL = DEFAULT_MODELS[0]

def trim_text(text: str, max_chars: int = 5000) -> str:
    """Truncate long text to prevent exceeding LLM token / TPM limits."""
    if not text or len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...[truncated to fit token limit]..."

def compact_worker_output(wo: Any) -> Any:
    """Compact worker output for aggregator to prevent token overflow."""
    if not isinstance(wo, dict):
        return str(wo)[:800]
    
    compacted = {}
    for k, v in wo.items():
        if k == "_meta":
            continue
        if k == "findings" and isinstance(v, str) and len(v) > 1000:
            compacted[k] = v[:1000] + " ...[truncated for summary]..."
        elif k == "recommendations" and isinstance(v, list) and len(v) > 5:
            compacted[k] = v[:5]
        else:
            compacted[k] = v
    return compacted

def safe_groq_call(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 1500,
    json_mode: bool = False,
) -> str:
    """
    Makes a resilient Groq completion call with automatic model fallbacks,
    prompt length trimming, backoff retries, and token budgeting to prevent
    rate limit (TPM/413) failures regardless of input length.
    """
    client = get_groq_client()
    
    trimmed_sys = trim_text(system_prompt, max_chars=4000)
    trimmed_user = trim_text(user_message, max_chars=6000)

    env_model = os.getenv("GROQ_MODEL")
    models_to_try = [env_model] if env_model else []
    for m in DEFAULT_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    last_error = None
    for model_name in models_to_try:
        for attempt in range(2):
            token_budget = max_tokens if attempt == 0 else min(max_tokens, 1000)
            try:
                if json_mode:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": trimmed_sys},
                            {"role": "user", "content": trimmed_user},
                        ],
                        temperature=0.3,
                        max_completion_tokens=token_budget,
                        top_p=1,
                        response_format={"type": "json_object"},
                    )
                    content = response.choices[0].message.content or ""
                    if content.strip():
                        return content.strip()
                else:
                    stream = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": trimmed_sys},
                            {"role": "user", "content": trimmed_user},
                        ],
                        temperature=0.7,
                        max_completion_tokens=token_budget,
                        top_p=1,
                        stream=True,
                    )
                    chunks = []
                    for chunk in stream:
                        delta = chunk.choices[0].delta.content
                        if delta:
                            chunks.append(delta)
                    result = "".join(chunks).strip()
                    if result:
                        return result
            except Exception as exc:
                last_error = exc
                err_msg = str(exc).lower()
                if any(err_key in err_msg for err_key in ["413", "429", "rate_limit", "tpm", "tokens", "too large"]):
                    time.sleep(4.0 * (attempt + 1))
                else:
                    break

    raise RuntimeError(f"All Groq model attempts failed. Last error: {last_error}")

def groq_chat(system_prompt: str, user_message: str) -> str:
    """Make a resilient Groq chat call with automatic fallback and token protection."""
    return safe_groq_call(system_prompt, user_message, max_tokens=1500, json_mode=False)


def parse_json_from_response(text: str) -> Any:
    """Extract and parse the first JSON block found in an LLM response."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try extracting from markdown code block
    import re
    match = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    # Last resort: return raw text wrapped
    return {"raw_response": text}


def traced_call(
    run_id: int,
    parent_id: Optional[int],
    agent_name: str,
    node_type: str,
    input_data: Dict[str, Any],
    prompt_text: str,
    fn: Callable[[Dict[str, Any]], Any],
    is_replay: bool = False,
    replayed_from_id: Optional[int] = None,
    token_counts: Optional[Tuple[int, int]] = None,
) -> Tuple[Any, int]:
    """Wraps an execution step to record it as a Node in the database.
    
    token_counts: optional (input_tokens, output_tokens) pre-captured by caller.
    For non-streaming calls (aggregator JSON mode), the caller extracts usage
    from the Groq response and passes it here. Streaming paths pass None.
    """
    db: Session = SessionLocal()
    node = Node(
        run_id=run_id,
        parent_id=parent_id,
        agent_name=agent_name,
        node_type=node_type,
        status="running",
        input_json=input_data,
        prompt_text=prompt_text,
        is_replay=is_replay,
        replayed_from_id=replayed_from_id,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    _broadcast_node_event(run_id, "node_created", node, run_status="running")
    
    start_time = time.time()
    try:
        with trace_agent_span(agent_name, node_type, run_id, {"is_replay": is_replay}):
            output = fn(input_data)
        node.output_json = output
        if isinstance(output, dict) and output.get("needs_clarification"):
            node.node_type = "clarification_request"
            node.status = "awaiting_answer"
            node.status_message = "awaiting user input"
            node.completed_at = None
        else:
            node.status = "success"
            node.status_message = "completed"
            node.completed_at = datetime.utcnow()
        node.latency_ms = int((time.time() - start_time) * 1000)
        node.model_name = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

        # Attach token counts if pre-captured or calculate estimates so token metrics are never blank/dash
        if token_counts is not None:
            node.token_count_input = token_counts[0]
            node.token_count_output = token_counts[1]
        else:
            prompt_str = prompt_text or ""
            input_str = json.dumps(input_data) if input_data else ""
            node.token_count_input = max(1, len(prompt_str + input_str) // 4)

            out_str = json.dumps(output) if isinstance(output, dict) else str(output or "")
            node.token_count_output = max(1, len(out_str) // 4)
            
        # Compute semantic embedding asynchronously if PostgreSQL
        if not is_sqlite and node.status == "success":
            try:
                import asyncio
                from worker import enqueue_compute_embedding
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        loop.create_task(enqueue_compute_embedding(node.id))
                    else:
                        loop.run_until_complete(enqueue_compute_embedding(node.id))
                except RuntimeError:
                    asyncio.run(enqueue_compute_embedding(node.id))
            except Exception as e:
                print(f"Warning: Failed to enqueue semantic embedding for node {node.id}: {e}")

        # Perform automated LLM-as-a-Judge evaluation for worker & aggregator nodes
        if node.status == "success" and agent_name in ["worker", "aggregator"]:
            try:
                from evaluations import evaluate_node_output
                node.eval_score = evaluate_node_output(node.prompt_text, node.input_json, node.output_json)
            except Exception as eval_err:
                print(f"Warning: Evaluation failed for node {node.id}: {eval_err}")

        db.commit()
        db.refresh(node)
        _broadcast_node_event(run_id, "node_updated", node, run_status="awaiting_input" if node.status == "awaiting_answer" else None)
        return output, node.id
    except Exception as exc:
        node.output_json = {"error": str(exc)}
        node.status = "error"
        node.status_message = str(exc)[:500]
        node.completed_at = datetime.utcnow()
        node.latency_ms = int((time.time() - start_time) * 1000)
        node.model_name = os.getenv("GROQ_MODEL", MODEL)
        db.commit()
        db.refresh(node)
        _broadcast_node_event(run_id, "node_updated", node, run_status="error")
        raise exc
    finally:
        db.close()

# ── Fake tool: budget calculator ──────────────────────────────────────────────

def _budget_calculator(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Simulated tool call — estimates per-day budget breakdown."""
    total_budget = input_data.get("total_budget", 200)
    days = input_data.get("days", 3)
    daily = total_budget / days if days else total_budget
    return {
        "total_budget": total_budget,
        "days": days,
        "daily_budget": round(daily, 2),
        "breakdown": {
            "accommodation": round(daily * 0.45, 2),
            "food": round(daily * 0.30, 2),
            "transport": round(daily * 0.15, 2),
            "activities": round(daily * 0.10, 2),
        },
    }


def _web_search_tool(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Live web search tool call — fetches real-time web snippets using DuckDuckGo / Wikipedia APIs."""
    import httpx
    query = input_data.get("query", "")
    if not query:
        return {"query": "", "results": []}
    
    results = []
    try:
        # Query DuckDuckGo Instant Answer API
        encoded = httpx.URL(query).raw_path.decode() if query else ""
        url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&no_redirect=1"
        resp = httpx.get(url, timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("AbstractText")
            if abstract:
                results.append({"source": data.get("AbstractSource", "DuckDuckGo"), "snippet": abstract, "url": data.get("AbstractURL", "")})
            for topic in data.get("RelatedTopics", [])[:3]:
                if isinstance(topic, dict) and "Text" in topic:
                    results.append({"snippet": topic.get("Text"), "url": topic.get("FirstURL", "")})
    except Exception as e:
        print(f"DuckDuckGo search error: {e}")

    if not results:
        try:
            wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{query}"
            resp = httpx.get(wiki_url, timeout=4.0)
            if resp.status_code == 200:
                data = resp.json()
                extract = data.get("extract")
                if extract:
                    results.append({"source": "Wikipedia", "snippet": extract, "url": data.get("content_urls", {}).get("desktop", {}).get("page", "")})
        except Exception as e:
            print(f"Wikipedia search error: {e}")

    return {
        "query": query,
        "results_count": len(results),
        "results": results if results else [{"snippet": f"Search completed for: '{query}'."}],
    }


def _python_sandbox_tool(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Safe Python sandbox tool — executes mathematical expressions and data analysis scripts."""
    import sys
    import io

    code = input_data.get("code") or input_data.get("expression", "")
    if not code:
        return {"stdout": "", "result": None, "error": "No code provided"}

    buffer = io.StringIO()
    safe_globals = {"__builtins__": {"abs": abs, "max": max, "min": min, "sum": sum, "round": round, "len": len, "range": range, "list": list, "dict": dict, "str": str, "int": int, "float": float, "print": print}}
    safe_locals = {}

    old_stdout = sys.stdout
    try:
        sys.stdout = buffer
        try:
            res = eval(code, safe_globals, safe_locals)
            if res is not None:
                print(res)
        except SyntaxError:
            exec(code, safe_globals, safe_locals)
        sys.stdout = old_stdout
        out_text = buffer.getvalue().strip()
        return {
            "code": code,
            "stdout": out_text,
            "variables": {k: str(v) for k, v in safe_locals.items() if not k.startswith("_")},
            "status": "success",
        }
    except Exception as e:
        sys.stdout = old_stdout
        return {
            "code": code,
            "stdout": buffer.getvalue().strip(),
            "error": str(e),
            "status": "error",
        }




# ── Agent functions ───────────────────────────────────────────────────────────

def run_planner(
    run_id: int,
    parent_id: Optional[int],
    goal: str,
    has_clarified: bool = False,
    is_replay: bool = False,
    replayed_from_id: Optional[int] = None,
) -> Tuple[Dict[str, Any], int]:
    """
    Planner agent: evaluates goal completeness.
    If critical information is missing (and has_clarified is False), generates 1-3 clarifying questions.
    Otherwise decomposes goal into 2-4 subtasks.
    Returns (output_dict, planner_node_id).
    """
    if not has_clarified:
        system_prompt = (
            "You are an intelligent, domain-agnostic planning agent for a multi-agent system.\n\n"
            "FIRST: Read the user's goal carefully. Evaluate if key context or constraints are missing "
            "that would meaningfully change your plan (for example: starting location/origin for travel, "
            "target audience or budget for marketing, prior experience or target language/framework for learning, "
            "guest count or budget for event planning, fitness level/equipment/goals for workout plans, etc.).\n\n"
            "RULE: If the goal is high-level, generic, or missing key parameters needed for a personalized plan, "
            "you MUST set 'needs_clarification': true and return 1-3 targeted clarifying questions.\n\n"
            "IF 'needs_clarification': true:\n"
            "Return ONLY a JSON object with 'needs_clarification': true and 1-3 relevant clarifying questions in 'questions'.\n"
            "Generate questions dynamically based strictly on the specific domain and nature of the goal.\n"
            "Each question object in 'questions' MUST have:\n"
            "- 'id': string (e.g. 'q1', 'q2')\n"
            "- 'question': string (the question text)\n"
            "- 'type': 'text' (for open-ended answers), 'single_select' (for mutually exclusive choices, 2-4 options max), "
            "or 'multi_select' (if more than one option could apply)\n"
            "- 'options': array of string options (REQUIRED if type is 'single_select' or 'multi_select', 2-4 items max)\n\n"
            "ONLY IF the goal ALREADY contains all necessary specific parameters and constraints:\n"
            "Return ONLY a JSON object with 'needs_clarification': false and break the goal into 2-4 concrete subtasks:\n"
            "{\n"
            "  \"needs_clarification\": false,\n"
            "  \"is_travel\": boolean,\n"
            "  \"destination\": string or null,\n"
            "  \"goal_domain\": string,\n"
            "  \"subtasks\": [\n"
            "    {\n"
            "      \"subtask_id\": \"s1\",\n"
            "      \"title\": \"Short title\",\n"
            "      \"description\": \"Detailed description of subtask\",\n"
            "      \"requires_budget_check\": false\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "IMPORTANT: Return ONLY the JSON object. No explanation, no markdown fences outside JSON."
        )
    else:
        system_prompt = (
            "You are an intelligent, domain-agnostic planning agent for a multi-agent system.\n\n"
            "CRITICAL RULE: The user has ALREADY provided clarification answers for their goal. "
            "You MUST NOT ask any more clarifying questions under any circumstances. Set 'needs_clarification': false.\n\n"
            "Decompose the goal (incorporating all user clarification answers provided) into 2-4 concrete subtasks.\n"
            "Return ONLY a JSON object with this schema:\n"
            "{\n"
            "  \"needs_clarification\": false,\n"
            "  \"is_travel\": boolean,\n"
            "  \"destination\": string or null,\n"
            "  \"goal_domain\": string,\n"
            "  \"subtasks\": [\n"
            "    {\n"
            "      \"subtask_id\": \"s1\",\n"
            "      \"title\": \"Short title\",\n"
            "      \"description\": \"Detailed description of subtask\",\n"
            "      \"requires_budget_check\": false\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "IMPORTANT: Return ONLY the JSON object. No explanation, no markdown fences outside JSON."
        )

    prompt_text = f"Goal: {goal}\n\nEvaluate and process this goal according to your instructions."

    def fn(input_data: Dict) -> Any:
        response_text = safe_groq_call(system_prompt, input_data["goal"], json_mode=True)
        parsed = parse_json_from_response(response_text)

        if isinstance(parsed, dict):
            needs_clarification = parsed.get("needs_clarification", False)

            if needs_clarification and not has_clarified:
                questions = parsed.get("questions", [])
                if isinstance(questions, list) and len(questions) > 0:
                    return {
                        "needs_clarification": True,
                        "questions": questions,
                    }

            if needs_clarification and has_clarified:
                import logging
                logging.warning(
                    f"Run {run_id}: Planner attempted 2nd round of clarification despite has_clarified=True. Forcing subtask generation."
                )
                force_sys = (
                    "You are a planning agent. You MUST NOT ask questions. Break down the goal into 2-4 concrete subtasks.\n"
                    "Return ONLY JSON: {\"needs_clarification\": false, \"is_travel\": bool, \"destination\": str or null, \"goal_domain\": str, \"subtasks\": [...]}"
                )
                force_resp = groq_chat(force_sys, input_data["goal"])
                parsed_force = parse_json_from_response(force_resp)
                if isinstance(parsed_force, dict):
                    parsed = parsed_force

            subtasks = parsed.get("subtasks", [])
            if not isinstance(subtasks, list):
                subtasks = [subtasks] if subtasks else []

            return {
                "needs_clarification": False,
                "subtasks": subtasks,
                "is_travel": bool(parsed.get("is_travel", False)),
                "destination": parsed.get("destination"),
                "goal_domain": parsed.get("goal_domain", "other"),
            }

        subtasks = parsed if isinstance(parsed, list) else []
        return {
            "needs_clarification": False,
            "subtasks": subtasks,
            "is_travel": False,
            "destination": None,
            "goal_domain": "other",
        }

    output, node_id = traced_call(
        run_id=run_id,
        parent_id=parent_id,
        agent_name="planner",
        node_type="llm_call",
        input_data={"goal": goal},
        prompt_text=prompt_text,
        fn=fn,
        is_replay=is_replay,
        replayed_from_id=replayed_from_id,
    )

    if not output.get("needs_clarification"):
        subtasks = output.get("subtasks", [])
        meta = {
            "is_travel": output.get("is_travel", False),
            "destination": output.get("destination"),
            "goal_domain": output.get("goal_domain", "other"),
        }
        for st in subtasks:
            if isinstance(st, dict):
                st["_meta"] = meta

    return output, node_id



def run_worker(
    run_id: int,
    parent_id: Optional[int],
    subtask: Dict,
    is_replay: bool = False,
    replayed_from_id: Optional[int] = None,
) -> Tuple[Dict, int]:
    """
    Worker agent: executes a single subtask.
    If the subtask requires a budget check, calls the budget_calculator tool first.
    """
    meta = subtask.get("_meta", {})
    is_travel = meta.get("is_travel", False)
    destination = meta.get("destination") or "the destination"
    goal_domain = meta.get("goal_domain", "other")

    system_prompt = (
        "You are an execution agent. Your job is to research and produce detailed, practical results "
        "for a specific subtask as part of answering a user's goal.\n\n"
        f"This goal is domain: '{goal_domain}'.\n"
        + (
            f"This is a TRAVEL goal. The destination is: {destination}.\n"
            "When doing research:\n"
            "- Use the correct local currency for that destination as the PRIMARY figure (e.g. INR for India, "
            "JPY for Japan, EUR for Europe, GBP for UK). Append approx USD in parentheses, e.g. '₹2,500 (~$30)'.\n"
            "- Do NOT assume flight-based travel unless destination is clearly international/far from typical origins.\n"
            "- Consider realistic local transport (train, bus, metro, cab) for domestic destinations.\n"
            "- Provide information specific to that exact destination — not generic or wrong-city suggestions.\n"
            if is_travel else
            "This is NOT a travel goal. Do not produce travel-shaped output (no itineraries, no hotel suggestions, "
            "no flight costs). Instead, produce output that directly addresses the actual domain of the subtask.\n"
        )
        + "\nReturn your response as a JSON object with keys: "
        "'subtask_id' (string), 'findings' (string — detailed analysis), "
        "'recommendations' (array of strings), 'summary' (string).\n"
        "Be specific, accurate, and practical. No hallucinated data."
    )
    prompt_text = (
        f"Subtask: {subtask.get('title', '')}\n"
        f"Description: {subtask.get('description', '')}\n\n"
        "Produce a detailed, accurate result for this subtask."
    )

    # If subtask needs a budget check or web search, run the tool call first
    tool_output = None
    last_tool_node_id = parent_id

    st_title = str(subtask.get("title", "")).lower()
    st_desc = str(subtask.get("description", "")).lower()
    needs_search = subtask.get("requires_search") or subtask.get("requires_web_search") or any(k in st_title or k in st_desc for k in ["research", "search", "competitor", "market", "overview", "trends"])

    if subtask.get("requires_budget_check"):
        def budget_fn(input_data: Dict) -> Any:
            return _budget_calculator(input_data)

        tool_output, last_tool_node_id = traced_call(
            run_id=run_id,
            parent_id=parent_id,
            agent_name="worker",
            node_type="tool_call",
            input_data={"total_budget": 200, "days": 3},
            prompt_text="[Tool: budget_calculator] Computing per-day budget breakdown.",
            fn=budget_fn,
            is_replay=is_replay,
        )
    elif needs_search:
        search_query = f"{destination} {subtask.get('title', '')}" if is_travel else subtask.get("title", "")
        def search_fn(input_data: Dict) -> Any:
            return _web_search_tool(input_data)

        tool_output, last_tool_node_id = traced_call(
            run_id=run_id,
            parent_id=parent_id,
            agent_name="worker",
            node_type="tool_call",
            input_data={"query": search_query},
            prompt_text=f"[Tool: web_search] Fetching live web context for query: '{search_query}'.",
            fn=search_fn,
            is_replay=is_replay,
        )

    def fn(input_data: Dict) -> Any:
        # Strip internal _meta before sending to LLM
        clean_input = {k: v for k, v in input_data.items() if k != "_meta"}
        user_msg = json.dumps(clean_input)
        if tool_output:
            user_msg += f"\n\nBudget tool output: {json.dumps(tool_output)}"
        response_text = groq_chat(system_prompt, user_msg)
        result = parse_json_from_response(response_text)
        if not isinstance(result, dict):
            result = {"summary": str(result)}
        result["subtask_id"] = input_data.get("subtask_id", "")
        return result

    output, node_id = traced_call(
        run_id=run_id,
        parent_id=last_tool_node_id,
        agent_name="worker",
        node_type="llm_call",
        input_data=subtask,
        prompt_text=prompt_text,
        fn=fn,
        is_replay=is_replay,
        replayed_from_id=replayed_from_id,
    )
    return output, node_id


def run_aggregator(
    run_id: int,
    parent_id: Optional[int],
    worker_outputs: List[Dict],
    goal: str,
    is_replay: bool = False,
    replayed_from_id: Optional[int] = None,
) -> Tuple[Dict, int]:
    """
    Aggregator agent: synthesises all worker outputs into a final coherent answer.
    Always returns the standardized schema: { title, summary, sections, tips }
    """
    # Extract metadata injected by the Planner (via subtask _meta fields)
    meta = {}
    for wo in worker_outputs:
        if isinstance(wo, dict) and "_meta" in wo:
            meta = wo["_meta"]
            break
    # Also check if planner metadata was passed in the input data directly
    is_travel = bool(meta.get("is_travel", False))
    destination = meta.get("destination") or ""

    # ── Build travel-specific instructions ──────────────────────────────────
    travel_instructions = ""
    if is_travel and destination:
        travel_instructions = (
            f"\n\nTRAVEL-SPECIFIC RULES (destination: {destination}):\n"
            "1. CURRENCY: Determine the local currency for the destination (e.g. INR for India, "
            "JPY for Japan, EUR for Eurozone, GBP for UK, AED for UAE, THB for Thailand, etc.). "
            "Use that local currency as the PRIMARY figure everywhere. Append approx USD in "
            "parentheses e.g. '₹2,500 (~$30)'. NEVER use USD as primary for non-US destinations. "
            "Do not use a generic dollar sign for non-USD currencies.\n"
            "2. TRANSPORT: Do NOT default to 'flight' unless the destination is clearly international "
            "or long-distance. For domestic destinations, mention trains, buses, metros, cabs as "
            "the primary transport options. Only mention flights if genuinely relevant.\n"
            "3. HISTORICAL & CULTURAL SITES: Include a section with type='list' and heading "
            "'Must-See Historical & Cultural Sites'. List ONLY sites/landmarks that are actually in "
            f"{destination}. Do NOT list landmarks from other cities or countries. Be specific to the "
            "exact destination named.\n"
            "4. BUDGET TIERS: Include a 'budget_tiers' key at the TOP LEVEL of your JSON (NOT inside sections). "
            "This must be an array of exactly 3 objects: Budget, Mid-range, and Elite/Premium.\n"
            "Each tier object must have these exact keys:\n"
            "  - tier: 'Budget' | 'Mid-range' | 'Elite'\n"
            "  - total_cost: string (e.g. '₹8,000–₹12,000/night (~$96–$145)')\n"
            "  - accommodation: string (describe the category, e.g. 'Hostels or budget guesthouses near the station')\n"
            "  - food: string (describe dining approach, e.g. 'Street food, local dhabas, thali meals')\n"
            "  - transport: string (describe transport approach for that tier)\n"
            "  - notes: string (any other tier-relevant detail)\n"
        )
    else:
        travel_instructions = (
            "\n\nNON-TRAVEL GOAL: Do NOT include budget_tiers or historical-sites sections. "
            "Do NOT produce a travel-shaped output. Focus entirely on the actual domain of the goal "
            "(technical, business, creative, personal decision, etc.)."
        )

    system_prompt = (
        "You are a synthesis agent. Given worker subtask results and the user's original goal, "
        "combine them into a single, well-structured, comprehensive final answer.\n\n"
        "You MUST return ONLY a JSON object — no markdown, no prose outside the JSON.\n\n"
        "REQUIRED JSON STRUCTURE:\n"
        "{\n"
        "  \"title\": \"Short title summarising the answer (max 10 words)\",\n"
        "  \"summary\": \"2-3 sentence overview\",\n"
        "  \"sections\": [\n"
        "    { \"heading\": \"Section Name\", \"type\": \"list\", \"content\": [\"item 1\", \"item 2\"] },\n"
        "    { \"heading\": \"Section Name\", \"type\": \"text\", \"content\": \"prose paragraph\" },\n"
        "    { \"heading\": \"Section Name\", \"type\": \"table\", \"content\": [{\"label\": \"x\", \"value\": \"y\"}] }\n"
        "  ],\n"
        "  \"tips\": [\"tip 1\", \"tip 2\", \"tip 3\"]\n"
        "}\n\n"
        "RULES:\n"
        "- section type must be exactly one of: 'list', 'text', 'table'\n"
        "- type='list': content = array of strings\n"
        "- type='text': content = single string\n"
        "- type='table': content = array of {label: string, value: string}\n"
        "- tips = array of short actionable strings\n"
        "- Adapt the sections to what the goal actually NEEDS — not a fixed template\n"
        "- For non-travel goals: produce sections appropriate to that domain "
        "(trade-off analysis, pros/cons, recommendations, next steps, etc.)\n"
        "- Return ONLY the JSON object. No explanation, no markdown fences."
        + travel_instructions
    )
    prompt_text = (
        f"Original goal: {goal}\n\n"
        f"Worker results:\n{json.dumps(worker_outputs, indent=2)}\n\n"
        "Synthesise these into a final answer using the required JSON schema."
    )

    # Token usage captured from the non-streaming Groq response
    _token_counts: list[Optional[Tuple[int, int]]] = [None]

    def fn(input_data: Dict) -> Any:
        # Strip _meta from worker outputs before sending to LLM
        clean_outputs = []
        for wo in input_data.get("worker_outputs", []):
            if isinstance(wo, dict):
                clean_outputs.append({k: v for k, v in wo.items() if k != "_meta"})
            else:
                clean_outputs.append(wo)
        clean_input = {"goal": input_data.get("goal", ""), "worker_outputs": clean_outputs}

        try:
            response_text = safe_groq_call(
                system_prompt=system_prompt,
                user_message=json.dumps(clean_input),
                max_tokens=4096,
                json_mode=True,
            )
        except Exception:
            response_text = groq_chat(system_prompt, json.dumps(clean_input))



        result = parse_json_from_response(response_text)
        if not isinstance(result, dict):
            result = {"summary": str(result)}
        return result

    output, node_id = traced_call(
        run_id=run_id,
        parent_id=parent_id,
        agent_name="aggregator",
        node_type="llm_call",
        input_data={"goal": goal, "worker_outputs": worker_outputs},
        prompt_text=prompt_text,
        fn=fn,
        is_replay=is_replay,
        replayed_from_id=replayed_from_id,
        token_counts=_token_counts[0],
    )
    return output, node_id



# ── Full pipeline ─────────────────────────────────────────────────────────────

def _execute_workers_and_aggregator(
    run_id: int,
    planner_node_id: int,
    subtasks: List[Dict],
    goal: str,
) -> None:
    """Helper to run Workers → Aggregator given a planner node and subtasks."""
    worker_outputs: List[Dict] = []
    last_worker_node_id = planner_node_id

    for subtask in subtasks:
        worker_output, worker_node_id = run_worker(
            run_id, parent_id=planner_node_id, subtask=subtask
        )
        worker_outputs.append(worker_output)
        last_worker_node_id = worker_node_id

    _, _ = run_aggregator(
        run_id,
        parent_id=last_worker_node_id,
        worker_outputs=worker_outputs,
        goal=goal,
    )


def run_pipeline(run_id: int, goal: str) -> None:
    """
    Orchestrates initial pipeline run.
    Planner evaluates goal: if missing critical info, creates clarification node & pauses with status 'awaiting_input'.
    Otherwise proceeds directly to Workers → Aggregator and sets status to 'completed'.
    """
    db: Session = SessionLocal()
    try:
        planner_output, planner_node_id = run_planner(
            run_id, parent_id=None, goal=goal, has_clarified=False
        )

        if planner_output.get("needs_clarification"):
            # Set run status to awaiting_input and halt
            db.query(Run).filter(Run.id == run_id).update({"status": "awaiting_input"})
            db.commit()
            ws_manager.broadcast_sync(run_id, {"type": "run_updated", "run_id": run_id, "status": "awaiting_input"})
            return

        subtasks = planner_output.get("subtasks", [])
        _execute_workers_and_aggregator(run_id, planner_node_id, subtasks, goal)

        db.query(Run).filter(Run.id == run_id).update({"status": "completed"})
        db.commit()
        ws_manager.broadcast_sync(run_id, {"type": "run_updated", "run_id": run_id, "status": "completed"})

    except Exception as exc:
        db.query(Run).filter(Run.id == run_id).update({
            "status": "error",
            "name": f"Error: {str(exc)[:80]}",
        })
        db.commit()
        ws_manager.broadcast_sync(run_id, {"type": "run_updated", "run_id": run_id, "status": "error"})
        raise
    finally:
        db.close()


def continue_pipeline_after_clarification(
    run_id: int,
    clarification_node_id: int,
    answers: Dict[str, Any],
) -> None:
    """
    Resumes the pipeline after user submits answers to clarification questions.
    Appends answers as context to original goal, re-invokes Planner (has_clarified=True)
    parented to clarification_node_id, then proceeds to Workers → Aggregator.
    """
    db: Session = SessionLocal()
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise ValueError(f"Run {run_id} not found")

        formatted_answers = ", ".join(f"{k}: {v}" for k, v in answers.items())
        enhanced_goal = (
            f"Original goal: {run.goal}\n"
            f"Additional context from user clarification: {formatted_answers}"
        )

        planner_output, planner_node_id = run_planner(
            run_id=run_id,
            parent_id=clarification_node_id,
            goal=enhanced_goal,
            has_clarified=True,
        )

        subtasks = planner_output.get("subtasks", [])
        _execute_workers_and_aggregator(run_id, planner_node_id, subtasks, enhanced_goal)

        db.query(Run).filter(Run.id == run_id).update({"status": "completed"})
        db.commit()
        ws_manager.broadcast_sync(run_id, {"type": "run_updated", "run_id": run_id, "status": "completed"})

    except Exception as exc:
        db.query(Run).filter(Run.id == run_id).update({
            "status": "error",
            "name": f"Error: {str(exc)[:80]}",
        })
        db.commit()
        ws_manager.broadcast_sync(run_id, {"type": "run_updated", "run_id": run_id, "status": "error"})
        raise
    finally:
        db.close()


# ── Replay logic ──────────────────────────────────────────────────────────────

def replay_from_node(node_id: int, new_input: Dict[str, Any]) -> List[Node]:
    """
    Re-runs the pipeline starting at the given node using new_input.
    All new nodes are marked is_replay=True and linked via replayed_from_id.
    Cascades downstream agents automatically.
    Returns the list of newly created Node objects.
    """
    db: Session = SessionLocal()
    try:
        original_node = db.query(Node).filter(Node.id == node_id).first()
        if not original_node:
            raise ValueError(f"Node {node_id} not found")

        run_id = original_node.run_id
        run = db.query(Run).filter(Run.id == run_id).first()
        goal = run.goal if run else new_input.get("goal", "")
        agent_name = original_node.agent_name

        # Snapshot the node IDs before the replay so we can diff afterwards
        existing_node_ids = {
            n.id for n in db.query(Node.id).filter(Node.run_id == run_id).all()
        }
    finally:
        db.close()

    # Run the appropriate agent chain from this node
    if agent_name == "planner":
        # Full cascade: planner → workers → aggregator
        planner_output, new_planner_id = run_planner(
            run_id,
            parent_id=original_node.parent_id,
            goal=new_input.get("goal", goal),
            has_clarified=False,
            is_replay=True,
            replayed_from_id=node_id,
        )
        if not planner_output.get("needs_clarification"):
            subtasks = planner_output.get("subtasks", [])
            worker_outputs: List[Dict] = []
            for subtask in subtasks:
                worker_output, _ = run_worker(
                    run_id,
                    parent_id=new_planner_id,
                    subtask=subtask,
                    is_replay=True,
                )
                worker_outputs.append(worker_output)

            if worker_outputs:
                last_wid_db = SessionLocal()
                try:
                    last_worker_node = (
                        last_wid_db.query(Node)
                        .filter(
                            Node.run_id == run_id,
                            Node.agent_name == "worker",
                            Node.is_replay == True,
                        )
                        .order_by(Node.id.desc())
                        .first()
                    )
                    last_worker_id = last_worker_node.id if last_worker_node else new_planner_id
                finally:
                    last_wid_db.close()

                run_aggregator(
                    run_id,
                    parent_id=last_worker_id,
                    worker_outputs=worker_outputs,
                    goal=new_input.get("goal", goal),
                    is_replay=True,
                )

    elif agent_name == "worker":
        # Cascade: worker → aggregator
        worker_output, new_worker_id = run_worker(
            run_id,
            parent_id=original_node.parent_id,
            subtask=new_input,
            is_replay=True,
            replayed_from_id=node_id,
        )
        run_aggregator(
            run_id,
            parent_id=new_worker_id,
            worker_outputs=[worker_output],
            goal=goal,
            is_replay=True,
        )

    elif agent_name == "aggregator":
        # Only re-run aggregator itself
        run_aggregator(
            run_id,
            parent_id=original_node.parent_id,
            worker_outputs=[new_input],
            goal=goal,
            is_replay=True,
            replayed_from_id=node_id,
        )

    # Collect all newly created nodes
    db2: Session = SessionLocal()
    try:
        all_nodes = db2.query(Node).filter(Node.run_id == run_id).all()
        new_nodes = [n for n in all_nodes if n.id not in existing_node_ids]
        # Detach from session so they can be used outside
        for n in new_nodes:
            db2.expunge(n)
        return new_nodes
    finally:
        db2.close()

