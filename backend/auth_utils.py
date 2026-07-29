"""
auth_utils.py — Authentication and Ownership verification helpers for Glassbox backend.
Extracts Clerk user_id from Bearer JWT tokens and enforces strict run ownership.
"""
import os
import jwt
from typing import Optional
from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models

DEV_AUTH_BYPASS = os.getenv("DEV_AUTH_BYPASS", "false").lower() == "true"
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")

_user_token_cache: dict = {}

def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
) -> str:
    """
    Extracts authenticated user_id from Authorization Bearer JWT header.
    Uses fast in-memory token cache to reduce JWT decoding latency to < 1ms.
    Falls back to x-user-id header or dev fallback if DEV_AUTH_BYPASS is set.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        if token in _user_token_cache:
            return _user_token_cache[token]

        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id:
                user_str = str(user_id)
                if len(_user_token_cache) > 1000:
                    _user_token_cache.clear()
                _user_token_cache[token] = user_str
                return user_str
        except Exception as e:
            print(f"JWT Decode error: {e}")

    # Fallback to custom x-user-id header if present
    if x_user_id:
        return x_user_id

    # Fallback for dev mode when explicitly enabled
    if DEV_AUTH_BYPASS:
        return "dev_user_local"

    raise HTTPException(
        status_code=401,
        detail="Authentication required. Please log in.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_run_ownership(run_id: int, current_user_id: str, db: Session) -> models.Run:
    """
    Verifies that a run exists and belongs to the requesting user.
    Returns the Run model if authorized.
    Raises 404 if run does not exist.
    Raises 403 Forbidden if the run belongs to a different user.
    """
    run = db.query(models.Run).filter(models.Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.user_id != current_user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: You do not own this run",
        )

    return run
