"""
ws_manager.py — WebSocket connection manager for real-time node streaming.
Uses Redis Pub/Sub to relay messages from Arq workers to the main FastAPI process.
"""
import asyncio
import json
import logging
import os
from typing import Dict, Set

from fastapi import WebSocket
import redis.asyncio as aioredis
import redis

logger = logging.getLogger("ws_manager")

class ConnectionManager:
    def __init__(self):
        # Map run_id -> Set[WebSocket]
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self.redis_client = None
        self.pubsub = None
        self._listener_task = None

    async def startup(self):
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            logger.warning("No REDIS_URL found. WebSockets will only work within a single process.")
            return
        
        try:
            self.redis_client = aioredis.from_url(redis_url, decode_responses=True)
            self.pubsub = self.redis_client.pubsub()
            await self.pubsub.subscribe("glassbox_events")
            self._listener_task = asyncio.create_task(self._listen_to_redis())
            logger.info("Subscribed to Redis Pub/Sub for WebSocket events")
        except Exception as e:
            logger.error(f"Failed to connect to Redis for Pub/Sub: {e}")

    async def shutdown(self):
        if self._listener_task:
            self._listener_task.cancel()
        if self.pubsub:
            await self.pubsub.unsubscribe("glassbox_events")
            await self.pubsub.close()
        if self.redis_client:
            await self.redis_client.close()

    async def _listen_to_redis(self):
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    run_id = data.get("run_id")
                    if run_id is not None:
                        await self.broadcast(run_id, data)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Redis Pub/Sub listener error: {e}")

    async def connect(self, run_id: int, websocket: WebSocket):
        await websocket.accept()
        if run_id not in self.active_connections:
            self.active_connections[run_id] = set()
        self.active_connections[run_id].add(websocket)
        logger.info(f"WebSocket connected for run_id={run_id}")

    def disconnect(self, run_id: int, websocket: WebSocket):
        if run_id in self.active_connections:
            self.active_connections[run_id].discard(websocket)
            if not self.active_connections[run_id]:
                del self.active_connections[run_id]
        logger.info(f"WebSocket disconnected for run_id={run_id}")

    async def broadcast(self, run_id: int, message: dict):
        if run_id not in self.active_connections:
            return
        dead_sockets = set()
        for ws in list(self.active_connections[run_id]):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send WS message: {e}")
                dead_sockets.add(ws)
        for ws in dead_sockets:
            self.disconnect(run_id, ws)

    def broadcast_sync(self, run_id: int, message: dict):
        """Thread-safe synchronous wrapper for publishing from background threads."""
        message["run_id"] = run_id
        redis_url = os.getenv("REDIS_URL")
        
        # If REDIS_URL is present, we are likely running Arq jobs in a different process.
        # We publish to Redis and let the main FastAPI process subscribe and push to the WS.
        if redis_url:
            try:
                r = redis.from_url(redis_url)
                r.publish("glassbox_events", json.dumps(message))
                return
            except Exception as e:
                logger.error(f"Redis sync publish error (falling back to direct broadcast): {e}")

        # Fallback to direct memory broadcast (if no Redis or Redis fails)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(self.broadcast(run_id, message), loop)
            else:
                loop.run_until_complete(self.broadcast(run_id, message))
        except RuntimeError:
            try:
                new_loop = asyncio.new_event_loop()
                new_loop.run_until_complete(self.broadcast(run_id, message))
                new_loop.close()
            except Exception as exc:
                logger.error(f"Error in direct broadcast_sync: {exc}")


ws_manager = ConnectionManager()
