"""AI Assistant API — Standard Chat and Trace modes."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.routers import health, chat, eval, sessions, documents, report, classify
from app.logging_config import configure_logging
from app.db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    configure_logging()
    
    # Initialize DB (creates tables if they don't exist)
    try:
        await init_db()
    except Exception as e:
        import structlog
        structlog.get_logger().error("db.init.failed", error=str(e))
        
    yield
    # Future: teardown


app = FastAPI(
    title="AI Assistant API",
    description=(
        "Backend for the open-source AI assistant "
        "with Standard Chat and Trace structured decision canvas."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["Health"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])
app.include_router(eval.router, prefix="/api/v1", tags=["Trace"])
app.include_router(sessions.router, prefix="/api/v1", tags=["Sessions"])
app.include_router(documents.router, prefix="/api/v1", tags=["Documents"])
app.include_router(report.router, prefix="/api/v1", tags=["Report"])
app.include_router(classify.router, prefix="/api/v1", tags=["Classify"])

