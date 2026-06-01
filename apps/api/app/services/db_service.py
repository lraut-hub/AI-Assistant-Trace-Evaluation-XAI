from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional
import uuid

from app.models.db import Session, Message, ReasoningGraphModel

async def get_or_create_session(db: AsyncSession, session_id: Optional[str] = None) -> Session:
    """Retrieve an existing session or create a new one."""
    if session_id:
        result = await db.execute(select(Session).where(Session.id == session_id))
        session_obj = result.scalar_one_or_none()
        if session_obj:
            return session_obj
            
    # Create new
    new_id = session_id or str(uuid.uuid4())
    session_obj = Session(id=new_id)
    db.add(session_obj)
    await db.commit()
    await db.refresh(session_obj)
    return session_obj

async def save_message(db: AsyncSession, session_id: str, role: str, content: str) -> Message:
    """Save a single message to the database."""
    # Ensure session exists
    await get_or_create_session(db, session_id)
    
    msg = Message(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role=role,
        content=content
    )
    db.add(msg)
    await db.commit()
    return msg

async def save_reasoning_graph(
    db: AsyncSession, 
    session_id: str, 
    graph_data: dict
) -> ReasoningGraphModel:
    """Save the generated Eval reasoning graph."""
    await get_or_create_session(db, session_id)
    
    graph_model = ReasoningGraphModel(
        id=graph_data.get("graph_id") or str(uuid.uuid4()),
        session_id=session_id,
        query=graph_data.get("query", ""),
        domain=graph_data.get("domain", ""),
        nodes=graph_data.get("nodes", []),
        edges=graph_data.get("edges", []),
        metadata_json=graph_data.get("metadata", {})
    )
    db.add(graph_model)
    await db.commit()
    return graph_model

async def get_session_history(db: AsyncSession, session_id: str) -> dict:
    """Fetch session history including messages and generated graphs."""
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.messages), selectinload(Session.graphs))
        .where(Session.id == session_id)
    )
    session_obj = result.scalar_one_or_none()
    
    if not session_obj:
        return {"session_id": session_id, "messages": [], "graphs": []}
        
    return {
        "session_id": session_obj.id,
        "title": session_obj.title,
        "created_at": session_obj.created_at,
        "messages": [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in session_obj.messages],
        "graphs": [
            {
                "graph_id": g.id,
                "query": g.query,
                "domain": g.domain,
                "nodes": g.nodes,
                "edges": g.edges,
                "metadata": g.metadata_json,
                "created_at": g.created_at
            }
            for g in session_obj.graphs
        ]
    }

async def get_all_sessions(db: AsyncSession, limit: int = 20) -> list[dict]:
    """Fetch recent sessions for the sidebar."""
    result = await db.execute(
        select(Session).order_by(Session.updated_at.desc()).limit(limit)
    )
    sessions = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "title": s.title,
            "updated_at": s.updated_at
        }
        for s in sessions
    ]
