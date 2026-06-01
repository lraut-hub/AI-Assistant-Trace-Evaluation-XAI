from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator
from app.config import settings

# Create async engine for Postgres
engine = create_async_engine(
    settings.db_url,
    echo=(settings.ENVIRONMENT == "development"),
    future=True,
    pool_pre_ping=True
)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for FastAPI endpoints to get an async db session."""
    async with async_session_maker() as session:
        yield session

async def init_db():
    """Create tables (in production, use Alembic migrations instead)."""
    from app.models.db import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
