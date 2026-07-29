"""
models.py — SQLAlchemy ORM models.

Langfuse-inspired observability fields on Node (all nullable, non-breaking):
  - model_name: Groq model that served this node
  - latency_ms: wall-clock execution time in ms
  - status_message: human-readable completion/error string
  - token_count_input / token_count_output: from Groq usage metadata

Part 2.5 — ApiKey model for read-only programmatic access.
Part 3   — Challenge model for the community leaderboard.
"""
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
)
from sqlalchemy.orm import relationship
from database import Base, is_sqlite

if not is_sqlite:
    from pgvector.sqlalchemy import Vector


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True, default="anonymous")
    name = Column(String, nullable=True)
    goal = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="running")  # running | completed | error | awaiting_input
    share_token = Column(String, nullable=True, unique=True)
    is_public = Column(Boolean, nullable=False, default=False)
    is_template = Column(Boolean, nullable=False, default=False)
    template_title = Column(String, nullable=True)
    template_description = Column(String, nullable=True)
    clone_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    nodes = relationship("Node", back_populates="run", foreign_keys="Node.run_id")


class UserProfile(Base):
    """User profile model tracking debug streaks and engagement."""
    __tablename__ = "user_profiles"

    user_id = Column(String, primary_key=True)
    current_streak = Column(Integer, nullable=False, default=0)
    longest_streak = Column(Integer, nullable=False, default=0)
    last_active_date = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("nodes.id"), nullable=True)

    agent_name = Column(String, nullable=False)   # planner | worker | aggregator
    node_type = Column(String, nullable=False)     # llm_call | tool_call | handoff | clarification_request

    prompt_text = Column(Text, nullable=True)
    input_json = Column(JSON, nullable=True)
    output_json = Column(JSON, nullable=True)

    if not is_sqlite:
        embedding = Column(Vector(384), nullable=True)
    else:
        embedding = Column(JSON, nullable=True)

    status = Column(String, nullable=False, default="running")  # running | success | error | awaiting_answer | answered

    # ── Langfuse-inspired observability & LLM evaluation fields ─────────────────
    model_name = Column(String, nullable=True)          # e.g. "llama-3.3-70b-versatile"
    latency_ms = Column(Float, nullable=True)           # wall-clock execution time in ms
    status_message = Column(Text, nullable=True)        # human-readable error / warning
    token_count_input = Column(Integer, nullable=True)  # prompt tokens from Groq usage
    token_count_output = Column(Integer, nullable=True) # completion tokens from Groq usage
    eval_score = Column(JSON, nullable=True)            # LLM-as-a-Judge quality & hallucination metrics


    is_replay = Column(Boolean, nullable=False, default=False)
    replayed_from_id = Column(Integer, ForeignKey("nodes.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # ── Relationships ────────────────────────────────────────────────────────────
    run = relationship("Run", back_populates="nodes", foreign_keys=[run_id])
    # Self-referential tree: parent → children
    children = relationship(
        "Node",
        foreign_keys=[parent_id],
        back_populates="parent",
        lazy="select",
    )
    parent = relationship(
        "Node",
        foreign_keys=[parent_id],
        back_populates="children",
        remote_side=[id],
        lazy="select",
    )
    replay_source = relationship(
        "Node", foreign_keys=[replayed_from_id], remote_side=[id], lazy="select"
    )


# ── Part 2.5: API Key model ────────────────────────────────────────────────────
import hashlib
import secrets

class ApiKey(Base):
    """Read-only API key for programmatic access to run traces."""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True, default="anonymous")
    key_prefix = Column(String, nullable=False)         # first 12 chars (safe to display)
    key_hash = Column(String, nullable=False, unique=True)  # sha256 hex of the full key
    label = Column(String, nullable=True)               # user-supplied name
    created_at = Column(DateTime, default=datetime.utcnow)

    @staticmethod
    def generate() -> tuple[str, str, str]:
        """
        Returns (plain_key, key_prefix, key_hash).
        Plain key is shown once and never stored.
        """
        plain = "syn_" + secrets.token_urlsafe(32)
        prefix = plain[:12]
        hashed = hashlib.sha256(plain.encode()).hexdigest()
        return plain, prefix, hashed

    @staticmethod
    def hash_key(plain: str) -> str:
        return hashlib.sha256(plain.encode()).hexdigest()


# ── Part 3: Challenge model ────────────────────────────────────────────────────

class Challenge(Base):
    """Represents a public challenge derived from a completed run."""
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    flawed_node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    creator_name = Column(String, nullable=False, default="Anonymous")
    created_at = Column(DateTime, default=datetime.utcnow)
    attempt_count = Column(Integer, nullable=False, default=0)
    correct_guess_count = Column(Integer, nullable=False, default=0)
    weekly_rank = Column(Integer, nullable=True)
    difficulty_score = Column(Float, nullable=True, default=0.0)
    engagement_score = Column(Float, nullable=True, default=0.0)

    run = relationship("Run", foreign_keys=[run_id], lazy="select")
    flawed_node = relationship("Node", foreign_keys=[flawed_node_id], lazy="select")
