from fastapi import APIRouter
from app.config import settings

router = APIRouter()

@router.get("/health")
async def check_health() -> dict[str, str]:
    """Basic health check endpoint."""
    return {
        "status": "ok", 
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT
    }
