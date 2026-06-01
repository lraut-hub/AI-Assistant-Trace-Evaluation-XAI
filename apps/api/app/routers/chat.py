from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
import json

from app.db import get_db_session
from app.services.db_service import save_message
from app.services.llm import groq_client, GROQ_MODELS

log = structlog.get_logger()
router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    image_base64: str | None = None
    
@router.post("/chat/stream")
async def stream_chat(
    request: ChatRequest, 
    db: AsyncSession = Depends(get_db_session)
) -> StreamingResponse:
    """Stream a chat response directly via Groq (bypasses LangGraph generator limitations)."""
    
    log.info("chat.stream.started", session_id=request.session_id)
    session_id = request.session_id or "default"

    try:
        await save_message(db, session_id, "user", request.message)
    except Exception as e:
        log.warning("chat.save_user_message_skipped", error=str(e))

    has_image = bool(request.image_base64)
    model = GROQ_MODELS["vision"] if has_image else GROQ_MODELS["standard"]

    # Build message payload
    user_content: any
    if has_image:
        user_content = [
            {"type": "text", "text": request.message},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{request.image_base64}"}}
        ]
    else:
        user_content = request.message

    messages = [{"role": "user", "content": user_content}]

    async def event_generator():
        full_response = ""
        try:
            response_stream = await groq_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                stream=True,
            )
            async for chunk in response_stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            if full_response:
                try:
                    await save_message(db, session_id, "assistant", full_response)
                except Exception as e:
                    log.warning("chat.save_assistant_message_skipped", error=str(e))

            yield "data: [DONE]\n\n"
            log.info("chat.stream.completed", session_id=session_id)
        except Exception as e:
            log.error("chat.stream.error", error=str(e), exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to generate response'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
