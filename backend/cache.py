"""
cache.py — Fast in-memory cache with optional Redis fallback.
"""
import json
import logging
import os
import time
from typing import Any, Optional

logger = logging.getLogger("cache")

from dotenv import load_dotenv

load_dotenv()

redis_client = None

# Optional Redis connection with strict 1s timeout to prevent thread blocking
try:
    import redis
    redis_url = os.getenv("REDIS_URL")
    if redis_url and "upstash" not in redis_url:  # avoid slow remote upstash timeouts locally
        r = redis.Redis.from_url(redis_url, socket_connect_timeout=1, socket_timeout=1)
        r.ping()
        redis_client = r
        logger.info(f"Redis connected successfully to {redis_url}")
except Exception as e:
    logger.info(f"Using fast in-memory cache fallback ({e}).")
    redis_client = None


# Local fast in-memory cache dict: { key: (value_json, expiry_timestamp) }
_in_memory_cache: dict = {}


class CacheManager:
    @staticmethod
    def get_json(key: str) -> Optional[Any]:
        # Check fast in-memory cache first
        now = time.time()
        if key in _in_memory_cache:
            val, expiry = _in_memory_cache[key]
            if now < expiry:
                return val
            else:
                del _in_memory_cache[key]

        if not redis_client:
            return None

        try:
            val = redis_client.get(key)
            if val:
                return json.loads(val)
        except Exception:
            pass
        return None

    @staticmethod
    def set_json(key: str, value: Any, ttl_seconds: int = 5) -> None:
        _in_memory_cache[key] = (value, time.time() + ttl_seconds)
        if not redis_client:
            return
        try:
            val_str = json.dumps(value)
            redis_client.setex(key, ttl_seconds, val_str)
        except Exception:
            pass

    @staticmethod
    def delete(key: str) -> None:
        _in_memory_cache.pop(key, None)
        if not redis_client:
            return
        try:
            redis_client.delete(key)
        except Exception:
            pass
