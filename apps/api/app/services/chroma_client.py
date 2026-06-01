import chromadb
from chromadb.config import Settings
import structlog
from app.config import settings

log = structlog.get_logger()

# We connect to the ChromaDB Docker container setup in Phase 0
try:
    chroma_client = chromadb.HttpClient(
        host=settings.CHROMA_HOST, 
        port=settings.CHROMA_PORT,
        settings=Settings(allow_reset=True)
    )
    
    # We use the default embedding function provided by Chroma (all-MiniLM-L6-v2)
    # which runs locally and avoids API costs.
    collection = chroma_client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"}
    )
    
    log.info("chroma.initialized", collection=settings.CHROMA_COLLECTION)
except Exception as e:
    log.error("chroma.init_failed", error=str(e))
    # Provide a fallback mock collection for testing if DB is down
    chroma_client = None
    collection = None

def get_chroma_collection():
    return collection
