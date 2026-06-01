import httpx
import structlog
from app.config import settings

log = structlog.get_logger()

TAVILY_API_URL = "https://api.tavily.com/search"

async def search_web(query: str, max_results: int = 3) -> list[dict]:
    """Search the web using the Tavily API."""
    # If no key is provided, return empty to not break the pipeline
    if not settings.TAVILY_API_KEY or settings.TAVILY_API_KEY == "tvly-dev":
        log.warning("tavily.api_key_missing", query=query)
        return []

    payload = {
        "api_key": settings.TAVILY_API_KEY,
        "query": query,
        "search_depth": "basic",
        "include_answer": False,
        "include_images": False,
        "include_raw_content": False,
        "max_results": max_results
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(TAVILY_API_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for r in data.get("results", []):
                results.append({
                    "title": r.get("title", ""),
                    "content": r.get("content", ""),
                    "url": r.get("url", "")
                })
            
            log.info("tavily.search.success", query=query, results_count=len(results))
            return results
    except Exception as e:
        log.error("tavily.search.failed", error=str(e), query=query)
        return []
