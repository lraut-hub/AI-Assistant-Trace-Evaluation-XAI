"""Lightweight query classification endpoint for topic discontinuity detection."""
from fastapi import APIRouter
from pydantic import BaseModel
import structlog

from app.services.llm import groq_client, GROQ_MODELS

log = structlog.get_logger()
router = APIRouter()


class ClassifyRequest(BaseModel):
    query: str
    conversation_history: list[dict] = []


class ClassifyResponse(BaseModel):
    type: str  # "follow_up" | "new_topic"
    confidence: float


@router.post("/eval/classify", response_model=ClassifyResponse)
async def classify_query(request: ClassifyRequest):
    """Classify whether a new user query is a follow-up to the current evaluation
    or an entirely new topic that needs a fresh canvas."""

    if not request.conversation_history:
        return ClassifyResponse(type="new_topic", confidence=1.0)

    # Build a compact conversation summary
    history_text = "\n".join(
        f"{m.get('role', 'user').upper()}: {m.get('content', '')[:200]}"
        for m in request.conversation_history[-6:]  # last 6 messages max
    )

    system_prompt = (
        "You are a query classifier. Given a conversation history and a new user query, "
        "determine if the new query is:\n"
        "- 'follow_up': Continues, refines, challenges, or deepens the SAME topic being discussed.\n"
        "- 'new_topic': Introduces a completely different subject or evaluation question.\n\n"
        "Respond with ONLY a JSON object: {\"type\": \"follow_up\" or \"new_topic\", \"confidence\": 0.0 to 1.0}\n"
        "Do NOT include any other text."
    )

    user_prompt = (
        f"Conversation history:\n{history_text}\n\n"
        f"New query: {request.query}\n\n"
        "Classify now."
    )

    try:
        response = await groq_client.chat.completions.create(
            model=GROQ_MODELS["standard"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=50,
        )
        content = response.choices[0].message.content or ""

        # Parse the JSON response
        import json
        try:
            result = json.loads(content.strip())
            query_type = result.get("type", "new_topic")
            confidence = float(result.get("confidence", 0.5))
            if query_type not in ("follow_up", "new_topic"):
                query_type = "new_topic"
            return ClassifyResponse(type=query_type, confidence=confidence)
        except (json.JSONDecodeError, ValueError):
            # If parsing fails, check for keywords
            lower = content.lower()
            if "follow_up" in lower:
                return ClassifyResponse(type="follow_up", confidence=0.6)
            return ClassifyResponse(type="new_topic", confidence=0.6)

    except Exception as e:
        log.error("classify.llm.failed", error=str(e))
        # Default to new_topic on failure (safer — generates a fresh canvas)
        return ClassifyResponse(type="new_topic", confidence=0.5)
