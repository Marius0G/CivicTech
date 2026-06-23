"""Server-side tool endpoints.

The app routes every server tool the Realtime model calls to POST /tools/{name} with the
tool arguments as the JSON body, and returns the JSON result back into the conversation.

`get_profile` returns the active (uploaded or demo) profile; `search_eu_info` runs RAG over
the curated EU corpus; `web_search` hits Tavily constrained to europa.eu (Phase 4).
"""

import logging
from typing import Any

from fastapi import APIRouter, Body, Depends

from .auth import User, get_current_user
from .config import get_settings
from .profile import get_active_profile
from .rag import search as rag_search
from .websearch import web_search as tavily_search

log = logging.getLogger("youthbuddy.tools")

router = APIRouter(prefix="/tools", tags=["tools"])


@router.post("/get_profile")
def get_profile(user: User = Depends(get_current_user)) -> dict[str, Any]:
    """Return the signed-in user's saved details for filling forms.

    This is the profile extracted from an uploaded ID (Phase 3) if one exists, else the
    demo user. `fill_form` uses these when the model doesn't supply country/birthdate.
    """
    return {"profile": get_active_profile(user.id)}


@router.post("/search_eu_info")
async def search_eu_info(
    args: dict[str, Any] = Body(default={}),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """RAG over the EU knowledge base (seed corpus + crawled portals): chunks + source URLs."""
    query = args.get("query", "")
    k = int(args.get("k", 5))
    try:
        results = await rag_search(get_settings(), query, k=max(1, min(k, 8)))
    except RuntimeError as e:
        log.error("search_eu_info failed: %s", e)
        return {"query": query, "results": [], "note": str(e)}
    return {"query": query, "results": results}


@router.post("/web_search")
async def web_search(
    args: dict[str, Any] = Body(default={}),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Live web search constrained to europa.eu via Tavily."""
    query = args.get("query", "")
    return await tavily_search(get_settings(), query)
