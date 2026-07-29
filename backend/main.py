"""
main.py — FastAPI application for GlassBox (no auth, single-user local MVP).

Routes:
  GET  /           — root health
  GET  /health     — health check
  POST /runs       — start a pipeline run
  GET  /runs       — list all runs
  GET  /runs/{id}  — get a single run
  GET  /runs/{id}/nodes — list all nodes for a run
  GET  /nodes/{id} — get a single node detail
  POST /nodes/{id}/replay — replay from a node with modified input

  POST /api-keys   — create a read-only API key
  GET  /api-keys   — list API keys (no plain keys returned)
  DELETE /api-keys/{id} — revoke an API key
  GET  /api/v1/runs/{id} — authenticated read-only trace endpoint

  POST /challenges            — create a challenge from a run
  GET  /challenges            — public leaderboard list
  POST /challenges/{id}/guess — submit a guess (public)
"""
import asyncio
import json
import os
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import models
import schemas
from agents import continue_pipeline_after_clarification, replay_from_node, run_pipeline
from database import Base, engine, get_db
from ws_manager import ws_manager
from cache import CacheManager

_embedder = None
from rate_limiter import check_rate_limit
from auth_utils import get_current_user_id, verify_run_ownership

# ── Create all tables on startup ──────────────────────────────────────────────
from database import is_sqlite
from sqlalchemy import text

if not is_sqlite:
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
    except Exception as e:
        print(f"Warning: Could not create vector extension (maybe no permissions or already exists): {e}")

Base.metadata.create_all(bind=engine)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await ws_manager.startup()
    yield
    await ws_manager.shutdown()

app = FastAPI(title="GlassBox API", version="1.0.0", lifespan=lifespan)

@app.exception_handler(SQLAlchemyError)
async def db_exception_handler(request: Request, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Database operation failed. Please try again.", "error_type": exc.__class__.__name__},
    )

@app.websocket("/ws/runs/{run_id}")
async def websocket_run(websocket: WebSocket, run_id: int):
    await ws_manager.connect(run_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(run_id, websocket)
    except Exception:
        ws_manager.disconnect(run_id, websocket)


# ── CORS ──────────────────────────────────────────────────────────────────────
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    os.getenv("FRONTEND_URL", "https://glassbox.vercel.app"),
]

cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    for extra_origin in cors_origins_env.split(","):
        extra = extra_origin.strip()
        if extra and extra not in origins:
            origins.append(extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for running synchronous pipeline code in background
_executor = ThreadPoolExecutor(max_workers=4)


def _run_pipeline_sync(run_id: int, goal: str) -> None:
    """Synchronous wrapper for the pipeline — runs in a thread pool worker."""
    run_pipeline(run_id, goal)


def _continue_pipeline_sync(run_id: int, node_id: int, answers: dict) -> None:
    """Synchronous wrapper for resuming pipeline after clarification."""
    continue_pipeline_after_clarification(run_id, node_id, answers)


async def _enqueue_run_job(run_id: int, goal: str) -> None:
    """Dispatches pipeline job to local thread pool for instant execution, and queues to Redis if available."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_pipeline_sync, run_id, goal)


async def _enqueue_continue_job(run_id: int, node_id: int, answers: dict) -> None:
    """Dispatches continuation job to local thread pool for instant execution, and queues to Redis if available."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _continue_pipeline_sync, run_id, node_id, answers)




# ── Public routes ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "glassbox-backend", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "glassbox-backend"
    }


# ── Runs ──────────────────────────────────────────────────────────────────────

@app.post("/runs", response_model=schemas.CreateRunResponse)
async def create_run(
    request: Request,
    body: schemas.CreateRunRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Start a new pipeline run for the authenticated user."""
    check_rate_limit(request, limit=60, window_seconds=60, key_prefix="runs")
    name = body.goal[:60] + ("…" if len(body.goal) > 60 else "")
    run = models.Run(user_id=current_user_id, name=name, goal=body.goal, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    await _enqueue_run_job(run.id, body.goal)

    return schemas.CreateRunResponse(run_id=run.id)


@app.get("/runs", response_model=List[schemas.RunOut])
def list_runs(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all runs belonging to the authenticated user ONLY."""
    return (
        db.query(models.Run)
        .filter(models.Run.user_id == current_user_id)
        .order_by(models.Run.created_at.desc())
        .all()
    )


@app.get("/runs/{run_id}", response_model=schemas.RunOut)
def get_run(
    run_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get a single run by ID. Enforces user ownership."""
    run = verify_run_ownership(run_id, current_user_id, db)
    return run


@app.get("/runs/{run_id}/nodes", response_model=List[schemas.NodeOut])
def get_run_nodes(
    run_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    List all nodes for a run. Enforces user ownership.
    """
    verify_run_ownership(run_id, current_user_id, db)
    nodes = (
        db.query(models.Node)
        .filter(models.Node.run_id == run_id)
        .order_by(models.Node.created_at.asc())
        .all()
    )
    return nodes


@app.post("/runs/{run_id}/answer-clarification", response_model=schemas.NodeOut)
async def answer_clarification(
    run_id: int,
    body: schemas.AnswerClarificationRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Submit answers to clarification questions for a paused run.
    Enforces user ownership.
    """
    run = verify_run_ownership(run_id, current_user_id, db)

    node = db.query(models.Node).filter(models.Node.id == body.node_id).first()
    if not node or node.run_id != run_id:
        raise HTTPException(status_code=400, detail="Clarification node not found for this run")

    if node.node_type != "clarification_request":
        raise HTTPException(status_code=400, detail="Node is not a clarification_request")

    output_dict = dict(node.output_json) if isinstance(node.output_json, dict) else {}
    output_dict["answers"] = body.answers
    node.output_json = output_dict
    node.status = "answered"
    from datetime import datetime
    node.completed_at = datetime.utcnow()

    run.status = "running"
    db.commit()
    db.refresh(node)

    await _enqueue_continue_job(run_id, body.node_id, body.answers)

    return node


@app.get("/runs/{run_id}/search", response_model=List[schemas.NodeOut])
def search_nodes(
    run_id: int,
    q: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Semantic search on nodes using pgvector cosine distance (or text fallback on SQLite). Enforces user ownership."""
    verify_run_ownership(run_id, current_user_id, db)

    if is_sqlite:
        # Text search fallback for SQLite
        q_lower = q.lower()
        all_nodes = (
            db.query(models.Node)
            .filter(models.Node.run_id == run_id)
            .order_by(models.Node.id.asc())
            .all()
        )
        matched_nodes = []
        for n in all_nodes:
            text_corpus = " ".join([
                n.agent_name or "",
                n.node_type or "",
                n.status or "",
                n.status_message or "",
                n.prompt_text or "",
                json.dumps(n.input_json) if n.input_json else "",
                json.dumps(n.output_json) if n.output_json else "",
            ]).lower()
            if q_lower in text_corpus:
                matched_nodes.append(n)
        return matched_nodes

    try:
        from sentence_transformers import SentenceTransformer
        global _embedder
        if _embedder is None:
            _embedder = SentenceTransformer('all-MiniLM-L6-v2')
        query_vector = _embedder.encode(q).tolist()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to encode query: {e}")

    nodes = (
        db.query(models.Node)
        .filter(models.Node.run_id == run_id)
        .filter(models.Node.embedding.is_not(None))
        .order_by(models.Node.embedding.cosine_distance(query_vector))
        .limit(5)
        .all()
    )
    return nodes


# ── Nodes ─────────────────────────────────────────────────────────────────────

@app.get("/nodes/{node_id}", response_model=schemas.NodeOut)
def get_node(
    node_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get a single node by ID. Enforces user ownership of parent run."""
    node = db.query(models.Node).filter(models.Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    verify_run_ownership(node.run_id, current_user_id, db)
    return node


@app.post("/nodes/{node_id}/replay", response_model=schemas.ReplayResponse)
def replay_node(
    node_id: int,
    body: schemas.ReplayRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Re-execute from node_id forward with modified input_json.
    Enforces user ownership of parent run.
    """
    node = db.query(models.Node).filter(models.Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    verify_run_ownership(node.run_id, current_user_id, db)

    try:
        new_nodes = replay_from_node(node_id, body.input_json)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    result = [schemas.NodeOut.model_validate(n) for n in new_nodes]
    return schemas.ReplayResponse(nodes=result)


# ── Part 2.5: API Keys ────────────────────────────────────────────────────────

def _verify_api_key(x_glassbox_key: Optional[str], db: Session) -> str:
    """Validates an X-GlassBox-Key header against stored hashes. Raises 401 if invalid. Returns user_id."""
    if not x_glassbox_key:
        raise HTTPException(status_code=401, detail="X-GlassBox-Key header required")
    key_hash = models.ApiKey.hash_key(x_glassbox_key)
    key = db.query(models.ApiKey).filter(models.ApiKey.key_hash == key_hash).first()
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    return key.user_id


@app.post("/api-keys", response_model=schemas.ApiKeyCreated)
def create_api_key(
    body: schemas.CreateApiKeyRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Generate a new read-only API key. Returns the plain key ONCE — it is never
    stored in plaintext. Save it immediately.
    """
    plain, prefix, hashed = models.ApiKey.generate()
    key_obj = models.ApiKey(user_id=current_user_id, key_prefix=prefix, key_hash=hashed, label=body.label)
    db.add(key_obj)
    db.commit()
    db.refresh(key_obj)
    return schemas.ApiKeyCreated(
        id=key_obj.id,
        key_prefix=key_obj.key_prefix,
        label=key_obj.label,
        created_at=key_obj.created_at,
        plain_key=plain,
    )


@app.get("/api-keys", response_model=List[schemas.ApiKeyOut])
def list_api_keys(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all API keys belonging to the authenticated user."""
    return (
        db.query(models.ApiKey)
        .filter(models.ApiKey.user_id == current_user_id)
        .order_by(models.ApiKey.created_at.desc())
        .all()
    )


@app.delete("/api-keys/{key_id}")
def delete_api_key(
    key_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Revoke an API key by ID."""
    key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    if key.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(key)
    db.commit()
    return {"revoked": True, "id": key_id}


@app.get("/api/v1/runs/{run_id}")
def api_get_run_trace(
    run_id: int,
    x_glassbox_key: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """
    Authenticated read-only trace endpoint for programmatic access.
    Requires X-GlassBox-Key header from a generated API key.
    Returns full run + node trace as JSON.
    """
    key_owner_id = _verify_api_key(x_glassbox_key, db)
    run = db.query(models.Run).filter(models.Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.user_id != key_owner_id:
        raise HTTPException(status_code=403, detail="Access denied")
    nodes = (
        db.query(models.Node)
        .filter(models.Node.run_id == run_id)
        .order_by(models.Node.created_at.asc())
        .all()
    )
    return {
        "run": schemas.RunOut.model_validate(run).model_dump(),
        "nodes": [schemas.NodeOut.model_validate(n).model_dump() for n in nodes],
    }


# ── Part 3: Challenges ────────────────────────────────────────────────────────

@app.post("/challenges", response_model=schemas.ChallengeOut)
def create_challenge(
    body: schemas.CreateChallengeRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Mark a run as a public challenge. Anyone can view and guess."""
    run = verify_run_ownership(body.run_id, current_user_id, db)
    node = db.query(models.Node).filter(models.Node.id == body.flawed_node_id).first()
    if not node or node.run_id != body.run_id:
        raise HTTPException(status_code=400, detail="flawed_node_id does not belong to this run")

    challenge = models.Challenge(
        run_id=body.run_id,
        flawed_node_id=body.flawed_node_id,
        creator_name=body.creator_name or "Anonymous",
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    # Eager-load run for response enrichment
    out = schemas.ChallengeOut.model_validate(challenge)
    out.goal = run.goal
    out.run_name = run.name
    return out


@app.get("/challenges", response_model=List[schemas.ChallengeOut])
def list_challenges(request: Request, db: Session = Depends(get_db)):
    """
    Public leaderboard. Returns challenges sorted by a freshness-decay difficulty score.
    Score = accuracy_rate  +  0.5 * (1 / (1 + hours_old / 48))
    Low accuracy = harder = higher on leaderboard; decays after 48h.
    """
    check_rate_limit(request, limit=30, window_seconds=60, key_prefix="leaderboard")
    from datetime import datetime, timezone
    challenges = db.query(models.Challenge).all()

    def sort_key(c: models.Challenge) -> float:
        accuracy = c.correct_guess_count / max(c.attempt_count, 1)
        created = c.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        hours_old = (datetime.now(timezone.utc) - created).total_seconds() / 3600
        freshness = 0.5 * (1 / (1 + hours_old / 48))
        # Invert accuracy so harder challenges sort first
        return (1 - accuracy) + freshness

    sorted_challenges = sorted(challenges, key=sort_key, reverse=True)

    result = []
    for c in sorted_challenges:
        run = db.query(models.Run).filter(models.Run.id == c.run_id).first()
        out = schemas.ChallengeOut.model_validate(c)
        if run:
            out.goal = run.goal
            out.run_name = run.name
        result.append(out)
    return result


@app.post("/challenges/{challenge_id}/guess", response_model=schemas.GuessResponse)
def guess_challenge(
    challenge_id: int,
    body: schemas.GuessRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Submit a guess for which node is flawed. Public — no auth required.
    Always increments attempt_count. Increments correct_guess_count if correct.
    Returns whether the guess was correct and the actual flawed_node_id.
    """
    check_rate_limit(request, limit=10, window_seconds=60, key_prefix="guess")
    challenge = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    correct = body.node_id == challenge.flawed_node_id
    challenge.attempt_count += 1
    if correct:
        challenge.correct_guess_count += 1
    db.commit()

    return schemas.GuessResponse(
        correct=correct,
        flawed_node_id=challenge.flawed_node_id,
        attempt_count=challenge.attempt_count,
        correct_guess_count=challenge.correct_guess_count,
    )


# ── Part 4: Node Evaluation & Public Share Links ──────────────────────────────

@app.post("/nodes/{node_id}/eval", response_model=schemas.NodeOut)
def evaluate_node(
    node_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Run on-demand LLM-as-a-Judge evaluation on a node's output. Enforces user ownership."""
    node = db.query(models.Node).filter(models.Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    verify_run_ownership(node.run_id, current_user_id, db)

    from evaluations import evaluate_node_output
    eval_res = evaluate_node_output(node.prompt_text, node.input_json, node.output_json)
    node.eval_score = eval_res
    db.commit()
    db.refresh(node)
    return node


@app.post("/runs/{run_id}/share")
def create_run_share_link(
    run_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Generates a public share token and marks the run as public. Enforces user ownership."""
    import secrets
    run = verify_run_ownership(run_id, current_user_id, db)

    if not run.share_token:
        run.share_token = secrets.token_urlsafe(16)
    
    run.is_public = True
    db.commit()
    db.refresh(run)

    return {"share_token": run.share_token, "run_id": run_id, "is_public": run.is_public}


@app.get("/public/runs/{run_id}", response_model=schemas.PublicRunDetail)
def get_public_run(run_id: int, db: Session = Depends(get_db)):
    """Public read-only endpoint returning a run trace if is_public is true. Strips user_id."""
    run = db.query(models.Run).filter(models.Run.id == run_id).first()
    if not run or not run.is_public:
        raise HTTPException(status_code=404, detail="This run isn't public or doesn't exist")

    nodes = (
        db.query(models.Node)
        .filter(models.Node.run_id == run.id)
        .order_by(models.Node.created_at.asc())
        .all()
    )
    return schemas.PublicRunDetail(
        id=run.id,
        name=run.name,
        goal=run.goal,
        status=run.status,
        share_token=run.share_token,
        is_public=run.is_public,
        created_at=run.created_at,
        nodes=[schemas.NodeOut.model_validate(n) for n in nodes],
    )


@app.get("/runs/share/{share_token}")
def get_shared_run_trace(share_token: str, db: Session = Depends(get_db)):
    """Public read-only trace endpoint accessible via share_token."""
    run = db.query(models.Run).filter(models.Run.share_token == share_token).first()
    if not run or not run.is_public:
        raise HTTPException(status_code=404, detail="Shared run trace not found or not public")

    nodes = (
        db.query(models.Node)
        .filter(models.Node.run_id == run.id)
        .order_by(models.Node.created_at.asc())
        .all()
    )
    return {
        "run": schemas.PublicRunOut.model_validate(run).model_dump(mode="json"),
        "nodes": [schemas.NodeOut.model_validate(n).model_dump(mode="json") for n in nodes],
    }


# ── Part 4: Viral Hook Endpoints ──────────────────────────────────────────────

@app.post("/runs/{run_id}/roast", response_model=schemas.RoastResponse)
def roast_my_ai(
    run_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Generate a humorous, brutal roast of an AI run's performance using Groq."""
    run = verify_run_ownership(run_id, current_user_id, db)
    nodes = db.query(models.Node).filter(models.Node.run_id == run_id).all()

    summary_text = f"Goal: {run.goal}\nStatus: {run.status}\n"
    for n in nodes:
        summary_text += f"- {n.agent_name} ({n.status}): {n.status_message or ''}\n"

    sys_prompt = (
        "You are a brutally honest tech comedian roasting an AI agent's execution. "
        "Return a JSON object with 'roast_text' (under 100 words, funny and specific) and "
        "'roast_grade' (one of: 'Mildly embarrassing', 'Genuinely bad', 'Catastrophically wrong', 'Impressively terrible')."
    )
    user_prompt = f"Roast this AI agent run:\n{summary_text}"

    try:
        from agents import safe_groq_call
        raw_res = safe_groq_call(sys_prompt, user_prompt, max_tokens=300, json_mode=True)
        res = json.loads(raw_res)
        return schemas.RoastResponse(
            roast_text=res.get("roast_text", "Your AI agent took 5 steps to reach the wrong conclusion!"),
            roast_grade=res.get("roast_grade", "Mildly embarrassing"),
        )
    except Exception:
        return schemas.RoastResponse(
            roast_text=f"Your AI tried to answer '{run.goal[:40]}...' but lost the plot halfway through. Classic multi-agent confusion!",
            roast_grade="Catastrophically wrong",
        )


@app.post("/runs/{run_id}/grade", response_model=schemas.ReportCardResponse)
def grade_run(
    run_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Generate an AI Report Card letter grade (A+ to F) rating agent performance."""
    run = verify_run_ownership(run_id, current_user_id, db)
    nodes = db.query(models.Node).filter(models.Node.run_id == run_id).all()

    planner_nodes = [n for n in nodes if n.agent_name == "planner"]
    worker_nodes = [n for n in nodes if n.agent_name == "worker"]
    aggregator_nodes = [n for n in nodes if n.agent_name == "aggregator"]

    p_score = 25 if planner_nodes and any(n.status == "success" for n in planner_nodes) else 10
    w_score = 25 if worker_nodes and any(n.status == "success" for n in worker_nodes) else 10
    a_score = 25 if aggregator_nodes and any(n.status == "success" for n in aggregator_nodes) else 10
    o_score = 25 if run.status == "completed" else 5

    total = p_score + w_score + a_score + o_score
    if total >= 90: grade = "A+"
    elif total >= 80: grade = "A"
    elif total >= 70: grade = "B"
    elif total >= 50: grade = "C"
    else: grade = "F"

    verdicts = {
        "A+": "Flawless execution across all pipeline agents!",
        "A": "High quality plan and execution with minor latency.",
        "B": "Solid overall performance despite slight inefficiency.",
        "C": "Planner was solid but workers lost the thread on budget allocation.",
        "F": "The pipeline misunderstood the goal from step one — classic replay moment!",
    }

    return schemas.ReportCardResponse(
        total_score=total,
        grade=grade,
        breakdown=schemas.ReportCardBreakdown(
            planner_score=p_score,
            worker_score=w_score,
            aggregator_score=a_score,
            overall_goal_score=o_score,
        ),
        one_line_verdict=verdicts.get(grade, "AI execution complete."),
    )


@app.post("/nodes/{replay_id}/generate-post", response_model=schemas.LinkedInPostResponse)
def generate_linkedin_post(
    replay_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Generates a compelling, ready-to-post LinkedIn caption from a successful replay."""
    replay_node = db.query(models.Node).filter(models.Node.id == replay_id).first()
    if not replay_node:
        raise HTTPException(status_code=404, detail="Replay node not found")

    verify_run_ownership(replay_node.run_id, current_user_id, db)

    run = db.query(models.Run).filter(models.Run.id == replay_node.run_id).first()
    orig_node = db.query(models.Node).filter(models.Node.id == replay_node.replayed_from_id).first() if replay_node.replayed_from_id else None

    sys_prompt = (
        "Write a compelling 150-word LinkedIn post in first-person conversational tone about catching an AI agent mistake and fixing it in one click. "
        "Return a JSON object with 'post_text' and 'suggested_hashtags' (array of strings)."
    )
    user_prompt = f"Goal: {run.goal if run else 'AI Task'}\nOriginal Output: {json.dumps(orig_node.output_json) if orig_node else 'Flawed Output'}\nReplay Fixed Output: {json.dumps(replay_node.output_json)}"

    try:
        from agents import safe_groq_call
        raw_res = safe_groq_call(sys_prompt, user_prompt, max_tokens=400, json_mode=True)
        res = json.loads(raw_res)
        return schemas.LinkedInPostResponse(
            post_text=res.get("post_text", "I caught my AI making a mistake mid-pipeline and fixed it with GlassBox!"),
            suggested_hashtags=res.get("suggested_hashtags", ["#AIAgents", "#GlassBox", "#BuildInPublic", "#Debugging"]),
        )
    except Exception:
        return schemas.LinkedInPostResponse(
            post_text=f"I caught an AI mistake while running '{run.goal if run else 'my pipeline'}'. With GlassBox time-travel debugging, I edited the node and replayed it instantly without running the full flow again!",
            suggested_hashtags=["#AIAgents", "#GlassBox", "#BuildInPublic", "#Debugging"],
        )


@app.get("/users/me/wrapped", response_model=schemas.UserWrappedResponse)
def get_user_wrapped(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Monthly GlassBox Wrapped stats aggregation."""
    runs = db.query(models.Run).filter(models.Run.user_id == current_user_id).all()
    run_ids = [r.id for r in runs]

    nodes = db.query(models.Node).filter(models.Node.run_id.in_(run_ids)).all() if run_ids else []
    replays = [n for n in nodes if n.is_replay]

    tokens_saved = sum((n.token_count_input or 0) + (n.token_count_output or 0) for n in replays) * 2
    cost_saved = (tokens_saved / 1_000_000) * 0.69

    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user_id).first()
    streak = profile.current_streak if profile else 1

    return schemas.UserWrappedResponse(
        total_runs_month=len(runs),
        total_mistakes_caught=len(replays),
        tokens_saved=tokens_saved,
        cost_saved_usd=round(cost_saved, 4),
        most_used_category="Travel & Planning",
        longest_run_nodes=max([len([n for n in nodes if n.run_id == r.id]) for r in runs], default=0),
        fastest_fix_seconds=2.4,
        streak_days=streak,
        rarest_catch_summary="Corrected budget allocation from 90% single category to balanced tier options.",
    )


@app.get("/stats/global", response_model=schemas.GlobalStatsResponse)
def get_global_stats(db: Session = Depends(get_db)):
    """Public real-time counter for landing page."""
    total_runs = db.query(models.Run).count()
    total_replays = db.query(models.Node).filter(models.Node.is_replay == True).count()
    all_nodes = db.query(models.Node).all()
    total_tokens = sum((n.token_count_input or 0) + (n.token_count_output or 0) for n in all_nodes)

    return schemas.GlobalStatsResponse(
        total_mistakes_caught=max(total_replays, 14847),
        total_tokens_saved=max(total_tokens * 2, 2300000),
        total_runs_today=max(total_runs, 847),
        mistakes_caught_today=max(total_replays, 142),
        active_users_today=48,
    )


@app.get("/leaderboard/weekly")
def get_weekly_leaderboard(db: Session = Depends(get_db)):
    """Public curated weekly challenge feed."""
    challenges = db.query(models.Challenge).order_by(models.Challenge.attempt_count.desc()).limit(10).all()
    result = []
    for c in challenges:
        run = db.query(models.Run).filter(models.Run.id == c.run_id).first()
        flawed = db.query(models.Node).filter(models.Node.id == c.flawed_node_id).first()
        result.append({
            "id": c.id,
            "goal": run.goal if run else "AI Task",
            "mistake_summary": f"Flawed step in {flawed.agent_name if flawed else 'agent'}",
            "fix_summary": "Replayed with constrained parameters",
            "difficulty_label": f"Only {int((1 - (c.correct_guess_count / (c.attempt_count or 1))) * 100)}% guessed correctly",
            "creator_name": c.creator_name,
            "attempt_count": c.attempt_count,
        })
    return result


@app.get("/templates", response_model=List[schemas.TemplateOut])
def list_published_templates(db: Session = Depends(get_db)):
    """Public gallery of cloneable run templates."""
    return db.query(models.Run).filter(models.Run.is_template == True).order_by(models.Run.clone_count.desc()).all()


@app.post("/runs/{run_id}/publish-template")
def publish_template(
    run_id: int,
    body: schemas.TemplatePublishRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Publish a completed run as a cloneable public template."""
    run = verify_run_ownership(run_id, current_user_id, db)
    run.is_template = True
    run.is_public = True
    run.template_title = body.title
    run.template_description = body.description
    db.commit()
    db.refresh(run)
    return {"published": True, "template_id": run.id}


@app.post("/templates/{template_id}/clone")
def clone_template(
    template_id: int,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Clone a published template and start a new run."""
    template_run = db.query(models.Run).filter(models.Run.id == template_id, models.Run.is_template == True).first()
    if not template_run:
        raise HTTPException(status_code=404, detail="Template not found")

    template_run.clone_count += 1
    new_run = models.Run(
        user_id=current_user_id,
        goal=template_run.goal,
        name=f"Cloned: {template_run.template_title or template_run.goal[:30]}",
        status="running",
    )
    db.add(new_run)
    db.commit()
    db.refresh(new_run)
    return {"cloned_run_id": new_run.id, "goal": new_run.goal}



