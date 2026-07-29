"""
rate_limiter.py — Rate limiting middleware / dependency for public endpoints.
"""
import time
import logging
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request

from cache import redis_client

logger = logging.getLogger("rate_limiter")

# Fallback in-memory rate limiter if Redis is offline
_in_memory_requests: Dict[str, List[float]] = defaultdict(list)

def check_rate_limit(request: Request, limit: int = 10, window_seconds: int = 60, key_prefix: str = "rate") -> None:
    """
    Limits request rate per client IP. Default: 10 requests per 60 seconds.
    Raises HTTP 429 Too Many Requests if limit is exceeded.
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"{key_prefix}:{request.url.path}:{client_ip}"
    now = time.time()

    if redis_client:
        try:
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, now - window_seconds)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, window_seconds)
            results = pipe.execute()
            request_count = results[2]
            if request_count > limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {limit} requests per {window_seconds} seconds allowed."
                )
            return
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning(f"Redis rate limiting fallback due to error: {exc}")

    # Fallback in-memory rate limiting
    timestamps = _in_memory_requests[key]
    # Prune old timestamps outside the window
    _in_memory_requests[key] = [t for t in timestamps if now - t < window_seconds]
    if len(_in_memory_requests[key]) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {limit} requests per {window_seconds} seconds allowed."
        )
    _in_memory_requests[key].append(now)
