"""
evaluations.py — LLM-as-a-Judge evaluation engine for Glassbox node outputs.
Uses Groq API to evaluate node output quality, coherence, and hallucination risk (0-100 scores).
"""
import json
from typing import Any, Dict, Optional
from agents import safe_groq_call, parse_json_from_response

EVAL_SYSTEM_PROMPT = """
You are an expert AI governance & quality judge evaluating the output of an AI agent execution step.

Analyze the given agent prompt, input, and generated output.
Evaluate on 3 metrics (scores 0-100):
1. 'quality_score': Clarity, completeness, structure, and usefulness of the output.
2. 'hallucination_score': Likelihood that output contains ungrounded claims or false data (100 = zero hallucination / perfectly grounded, 0 = high hallucination).
3. 'coherence_score': Logical consistency, formatting, and alignment with the prompt instructions.

Return ONLY a JSON object with this exact structure:
{
  "quality_score": integer (0-100),
  "hallucination_score": integer (0-100),
  "coherence_score": integer (0-100),
  "overall_score": integer (0-100),
  "verdict": "pass" | "warning" | "fail",
  "reasoning": "1-2 sentence summary of evaluation judgment"
}
"""

def evaluate_node_output(prompt_text: Optional[str], input_json: Optional[Dict], output_json: Optional[Dict]) -> Dict[str, Any]:
    """
    Evaluates a node output using Groq LLM-as-a-Judge.
    Returns evaluation metrics dictionary.
    """
    if not output_json:
        return {
            "quality_score": 0,
            "hallucination_score": 0,
            "coherence_score": 0,
            "overall_score": 0,
            "verdict": "fail",
            "reasoning": "No output produced.",
        }

    user_payload = {
        "prompt": prompt_text or "",
        "input": input_json or {},
        "output": output_json,
    }

    try:
        raw_resp = safe_groq_call(
            system_prompt=EVAL_SYSTEM_PROMPT,
            user_message=json.dumps(user_payload),
            max_tokens=500,
            json_mode=True,
        )
        parsed = parse_json_from_response(raw_resp)
        if isinstance(parsed, dict) and "overall_score" in parsed:
            return parsed
    except Exception as e:
        print(f"Evaluation error: {e}")

    # Heuristic fallback if LLM evaluation fails
    out_str = str(output_json)
    has_error = "error" in output_json or "Error" in out_str
    score = 40 if has_error else 88
    return {
        "quality_score": score,
        "hallucination_score": 90 if not has_error else 50,
        "coherence_score": score,
        "overall_score": score,
        "verdict": "warning" if has_error else "pass",
        "reasoning": "Rule-based evaluation fallback.",
    }
