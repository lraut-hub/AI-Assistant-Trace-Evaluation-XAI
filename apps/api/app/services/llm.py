"""LLM client integration using OpenAI compatible API (Groq)."""
from openai import AsyncOpenAI
import structlog
from app.config import settings

log = structlog.get_logger()

# Groq uses the OpenAI SDK format
groq_client = AsyncOpenAI(
    api_key=settings.GROQ_API_KEY or "placeholder",  # real key loaded from .env at runtime
    base_url=settings.GROQ_BASE_URL,
)

GROQ_MODELS = {
    "standard": "llama-3.1-8b-instant",
    "planner": "llama-3.1-8b-instant",
    "reasoner": "llama-3.1-8b-instant",
    "vision": "llama-3.2-11b-vision-preview"
}

async def check_groq_health() -> bool:
    """Basic health check to ensure Groq is reachable."""
    try:
        # Just listing models is a good lightweight check
        await groq_client.models.list(timeout=5.0)
        return True
    except Exception as e:
        log.warning("groq.health.check.failed", error=str(e))
        return False
