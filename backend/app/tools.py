"""Server-side tool endpoints.

The app routes every server tool the Realtime model calls to POST /tools/{name} with the
tool arguments as the JSON body, and returns the JSON result back into the conversation.

`get_profile` returns only WHICH fields are on file (no values — EU data residency); the actual
values are served by the internal `fill_values` endpoint, which the app calls on-device to inject
into forms and which is deliberately NOT advertised to the model. `search_eu_info` runs RAG over
the curated EU corpus; `web_search` hits Tavily constrained to europa.eu (Phase 4).
"""

import logging
from typing import Any

from fastapi import APIRouter, Body, Depends

from .auth import User, get_current_user
from .config import get_settings
from .preferences import save_preference
from .profile import get_active_profile, profile_manifest
from .rag import search as rag_search
from .websearch import web_search as tavily_search

log = logging.getLogger("youthbuddy.tools")

router = APIRouter(prefix="/tools", tags=["tools"])


@router.post("/get_profile")
def get_profile(user: User = Depends(get_current_user)) -> dict[str, Any]:
    """Tell the model WHICH of the user's details are on file — names only, never values.

    EU data residency: the user's personal data (from their uploaded ID) stays in Supabase and
    is inserted into forms on-device by `fill_form`. The assistant must never receive the values,
    so this returns just a field manifest. To fill a form the model calls `fill_form` (no args).
    """
    manifest = profile_manifest(get_active_profile(user.id))
    return {
        **manifest,
        "note": (
            "Field names only — the values are stored securely in the EU and inserted straight "
            "into forms; they are never shown to you. Call fill_form to use them."
        ),
    }


@router.post("/fill_values")
def fill_values(user: User = Depends(get_current_user)) -> dict[str, Any]:
    """INTERNAL — the saved field VALUES for on-device form injection.

    This is NOT one of the model's tools (it is absent from TOOL_DEFS), so the LLM cannot call
    it and never sees its output. The app's `fill_form` executor calls it directly to read the
    user's values and write them into the open form's DOM. Auth-scoped to the signed-in user.
    """
    return {"profile": get_active_profile(user.id)}


@router.post("/save_preference")
def save_preference_endpoint(
    args: dict[str, Any] = Body(default={}),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Remember a light, non-sensitive preference the user volunteered (see app/preferences.py).

    Unlike the ID profile, these values are non-sensitive and are shown back to the model so it
    can personalise. The model is instructed (persona) never to put sensitive data here.
    """
    prefs = save_preference(user.id, args.get("key", ""), args.get("value", ""))
    return {"ok": True, "preferences": prefs}


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
