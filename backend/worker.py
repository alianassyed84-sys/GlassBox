"""
worker.py — Arq background task worker for durable pipeline execution.
Survives server restarts and retries failed jobs via Redis.
"""
import asyncio
import logging
import os
from arq.connections import RedisSettings

from agents import run_pipeline, continue_pipeline_after_clarification

logger = logging.getLogger("arq_worker")

async def run_pipeline_job(ctx, run_id: int, goal: str):
    """Arq task worker function to run pipeline asynchronously."""
    logger.info(f"[Arq Worker] Executing run_pipeline_job for run_id={run_id}")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, run_pipeline, run_id, goal)
    logger.info(f"[Arq Worker] Completed run_pipeline_job for run_id={run_id}")

async def continue_pipeline_job(ctx, run_id: int, node_id: int, answers: dict):
    """Arq task worker function to resume pipeline after clarification."""
    logger.info(f"[Arq Worker] Executing continue_pipeline_job for run_id={run_id}")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, continue_pipeline_after_clarification, run_id, node_id, answers)
    logger.info(f"[Arq Worker] Completed continue_pipeline_job for run_id={run_id}")

async def compute_node_embedding(ctx, node_id: int) -> None:
    """Background task to compute semantic embeddings using sentence-transformers."""
    import json
    from database import SessionLocal, is_sqlite
    from models import Node
    
    if is_sqlite:
        return
        
    db = SessionLocal()
    try:
        node = db.query(Node).filter(Node.id == node_id).first()
        if not node or node.status != "success":
            return
            
        # Local lazily loaded embedder
        from sentence_transformers import SentenceTransformer
        global _embedder
        if '_embedder' not in globals():
            _embedder = SentenceTransformer('all-MiniLM-L6-v2')
            
        text_to_embed = f"Agent: {node.agent_name}\nPrompt: {node.prompt_text}\nOutput: {json.dumps(node.output_json)}"
        embedding_vector = _embedder.encode(text_to_embed).tolist()
        
        node.embedding = embedding_vector
        db.commit()
    except Exception as e:
        logger.error(f"Error computing embedding for node {node_id}: {e}")
    finally:
        db.close()


async def enqueue_compute_embedding(node_id: int):
    """Enqueues the compute_node_embedding task via Arq Redis pool."""
    from arq import create_pool
    try:
        redis_settings = RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        pool = await create_pool(redis_settings)
        await pool.enqueue_job("compute_node_embedding", node_id)
        await pool.close()
    except Exception as e:
        logger.warning(f"Failed to enqueue compute_node_embedding for node {node_id}: {e}")


class WorkerSettings:
    functions = [run_pipeline_job, continue_pipeline_job, compute_node_embedding]
    redis_settings = RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    max_jobs = 10
    job_timeout = 300
    max_tries = 3
    health_check_interval = 15

