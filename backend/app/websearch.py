"""Live web search via Tavily, constrained to europa.eu (Phase 4).

Network-isolated for testing. Degrades gracefully: if no TAVILY_API_KEY is configured, returns
a clear 'not configured' result instead of raising, so the frog can still answer from RAG.
"""

from typing import Any

import httpx

from .config import Settings

TAVILY_URL = "https://api.tavily.com/search"
ALLOWED_DOMAINS = ["europa.eu"]


async def web_search(settings: Settings, query: str, max_results: int = 5) -> dict[str, Any]:
    """Search the live web (official europa.eu domains) for up-to-date EU info."""
    query = (query or "").strip()
    if not query:
        return {"configured": True, "query": query, "results": [], "note": "empty query"}
    if not settings.has_tavily:
        return {
            "configured": False,
            "query": query,
            "results": [],
            "note": "web_search is not configured (set TAVILY_API_KEY). Use search_eu_info instead.",
        }

    payload = {
        "api_key": settings.tavily_api_key,
        "query": query,
        "include_domains": ALLOWED_DOMAINS,
        "max_results": max_results,
        "include_answer": True,
        "search_depth": "basic",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(TAVILY_URL, json=payload)

    if resp.status_code >= 400:
        return {
            "configured": True,
            "query": query,
            "results": [],
            "note": f"web search failed ({resp.status_code})",
        }

    data = resp.json()
    results = [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
        }
        for r in data.get("results", [])
    ]
    return {
        "configured": True,
        "query": query,
        "answer": data.get("answer", ""),
        "results": results,
    }
