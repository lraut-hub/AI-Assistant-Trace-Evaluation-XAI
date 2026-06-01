from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any
import structlog

from app.db import get_db_session
from app.services.db_service import get_all_sessions, get_session_history

log = structlog.get_logger()
router = APIRouter()

@router.get("/sessions", response_model=list[dict[str, Any]])
async def list_sessions(
    limit: int = 20,
    db: AsyncSession = Depends(get_db_session)
):
    """Get a list of recent sessions for the sidebar."""
    try:
        return await get_all_sessions(db, limit=limit)
    except Exception as e:
        log.warning("sessions.list_unavailable", error=str(e))
        return []

@router.get("/sessions/{session_id}", response_model=dict[str, Any])
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """Get the full history (messages and reasoning graphs) for a specific session."""
    try:
        session_data = await get_session_history(db, session_id)
        if not session_data.get("created_at"):
            # If created_at is missing, it means the session doesn't exist 
            # (our service returns a skeleton dict if not found)
            raise HTTPException(status_code=404, detail="Session not found")
        return session_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
