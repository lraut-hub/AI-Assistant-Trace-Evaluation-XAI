"""Application settings loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List


import os
from pathlib import Path

# The config file is at apps/api/app/config.py
# The .env file is in the root directory (4 levels up)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
env_path = ROOT_DIR / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(env_path),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    SECRET_KEY: str = "change_me_in_production"
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"]
    )

    # ── Groq ──────────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Search
    TAVILY_API_KEY: str = "tvly-dev" # mock default or read from env

    # vLLM fallback
    VLLM_BASE_URL: str = "http://localhost:8000/v1"
    VLLM_ENABLED: bool = False

    # ── Supabase ──────────────────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # ── Postgres ──────────────────────────────────────────────────────────────
    # Set DATABASE_URL directly (e.g. Supabase connection string) OR fill in
    # the individual fields below — DATABASE_URL always takes precedence.
    DATABASE_URL: str = ""
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "ai_eval_canvas"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"

    @property
    def db_url(self) -> str:
        """Returns the asyncpg-compatible database URL."""
        if self.DATABASE_URL:
            # Ensure the scheme is asyncpg-compatible
            url = self.DATABASE_URL
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            return url
        # Fall back to building from individual fields
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── ChromaDB ──────────────────────────────────────────────────────────────
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_COLLECTION: str = "eval_canvas_docs"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"

    # ── Model defaults ────────────────────────────────────────────────────────
    DEFAULT_CHAT_MODEL: str = "llama-3.3-70b-versatile"
    DEFAULT_FAST_MODEL: str = "llama-3.1-8b-instant"
    DEFAULT_PLANNER_MODEL: str = "qwen-qwq-32b"
    DEFAULT_REASONER_MODEL: str = "llama-3.3-70b-versatile"


settings = Settings()
