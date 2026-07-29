"""
schemas.py — Pydantic request/response models for the FastAPI API.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ── Requests ─────────────────────────────────────────────────────────────────

class CreateRunRequest(BaseModel):
    goal: str


class ReplayRequest(BaseModel):
    input_json: Dict[str, Any]


class AnswerClarificationRequest(BaseModel):
    node_id: int
    answers: Dict[str, Any]



# ── Responses ─────────────────────────────────────────────────────────────────

class NodeOut(BaseModel):
    id: int
    run_id: int
    parent_id: Optional[int] = None
    agent_name: str
    node_type: str
    prompt_text: Optional[str] = None
    input_json: Optional[Dict[str, Any]] = None
    output_json: Optional[Dict[str, Any]] = None
    status: str
    is_replay: bool
    replayed_from_id: Optional[int] = None
    # Langfuse-inspired observability fields
    model_name: Optional[str] = None
    latency_ms: Optional[float] = None
    status_message: Optional[str] = None
    # Token usage (from Groq API response, nullable — streaming paths don't expose this)
    token_count_input: Optional[int] = None
    token_count_output: Optional[int] = None
    eval_score: Optional[Dict[str, Any]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RunOut(BaseModel):
    id: int
    user_id: str
    name: Optional[str] = None
    goal: str
    status: str
    share_token: Optional[str] = None
    is_public: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class RunDetail(RunOut):
    nodes: List[NodeOut] = []


class PublicRunOut(BaseModel):
    id: int
    name: Optional[str] = None
    goal: str
    status: str
    share_token: Optional[str] = None
    is_public: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class PublicRunDetail(PublicRunOut):
    nodes: List[NodeOut] = []


class CreateRunResponse(BaseModel):
    run_id: int


class ReplayResponse(BaseModel):
    nodes: List[NodeOut]


# ── Part 2.5: API Key schemas ─────────────────────────────────────────────────

class CreateApiKeyRequest(BaseModel):
    label: Optional[str] = None


class ApiKeyOut(BaseModel):
    id: int
    key_prefix: str
    label: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreated(ApiKeyOut):
    """Returned once only when a key is first created — includes the full plain key."""
    plain_key: str


# ── Part 3: Challenge schemas ─────────────────────────────────────────────────

class CreateChallengeRequest(BaseModel):
    run_id: int
    flawed_node_id: int
    creator_name: Optional[str] = "Anonymous"


class ChallengeOut(BaseModel):
    id: int
    run_id: int
    flawed_node_id: int
    creator_name: str
    created_at: datetime
    attempt_count: int
    correct_guess_count: int
    # Enriched fields joined from Run (populated in endpoint)
    goal: Optional[str] = None
    run_name: Optional[str] = None

    model_config = {"from_attributes": True}


class GuessRequest(BaseModel):
    node_id: int


class GuessResponse(BaseModel):
    correct: bool
    flawed_node_id: int
    attempt_count: int
    correct_guess_count: int


# ── Part 4: Viral Features Schemas ────────────────────────────────────────────

class RoastResponse(BaseModel):
    roast_text: str
    roast_grade: str


class ReportCardBreakdown(BaseModel):
    planner_score: int
    worker_score: int
    aggregator_score: int
    overall_goal_score: int


class ReportCardResponse(BaseModel):
    total_score: int
    grade: str
    breakdown: ReportCardBreakdown
    one_line_verdict: str


class LinkedInPostResponse(BaseModel):
    post_text: str
    suggested_hashtags: List[str]


class UserWrappedResponse(BaseModel):
    total_runs_month: int
    total_mistakes_caught: int
    tokens_saved: int
    cost_saved_usd: float
    most_used_category: str
    longest_run_nodes: int
    fastest_fix_seconds: float
    streak_days: int
    rarest_catch_summary: str


class GlobalStatsResponse(BaseModel):
    total_mistakes_caught: int
    total_tokens_saved: int
    total_runs_today: int
    mistakes_caught_today: int
    active_users_today: int


class TemplatePublishRequest(BaseModel):
    title: str
    description: Optional[str] = None


class TemplateOut(BaseModel):
    id: int
    goal: str
    template_title: Optional[str] = None
    template_description: Optional[str] = None
    clone_count: int
    user_id: str
    created_at: datetime
    model_config = {"from_attributes": True}

