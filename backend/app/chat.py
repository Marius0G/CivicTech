"""Typed (text) chat endpoint — the in-app Hop chat, with the same RAG/web tools as the voice.

POST /chat  { "messages": [{ "role": "user"|"assistant", "content": "..." }] }
  -> runs an OpenAI chat-completions tool loop (search_eu_info / web_search / get_profile)
  -> { "reply": "...", "sources": [{ "title", "url" }] }

This makes the chat screen "real": answers come from the model grounded in the EU knowledge
base (and live europa.eu search), not canned text.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Body, Depends

from .auth import User, get_current_user
from .config import get_settings
from .persona import instructions_for
from .preferences import get_preferences, save_preference
from .profile import get_active_profile, profile_manifest
from .rag import search as rag_search
from .websearch import web_search as tavily_search

log = logging.getLogger("youthbuddy.chat")

router = APIRouter(prefix="/chat", tags=["chat"])

_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

# Text-chat addendum to the shared persona (the voice rules about "never read URLs" don't apply).
# The date + preferences context comes from instructions_for(); we build the system message per
# request so the date is always current and the user's saved preferences are up to date.
CHAT_ADDENDUM = (
    "\n\nYou are now in a TYPED chat (not voice). You may use short bullet lists and you may "
    "name and link sources. Keep replies concise and warm. For any EU fact, call search_eu_info "
    "first and answer from it; use web_search only for very recent/specific things. You cannot "
    "open or fill the web form from here — if the user wants that, tell them to tap the mic and "
    "ask Hop by voice."
)


def _chat_system(user_id: str) -> str:
    """The system prompt for this turn: persona + live date + this user's saved preferences."""
    today = datetime.now(timezone.utc).date().isoformat()
    return instructions_for(None, today, get_preferences(user_id)) + CHAT_ADDENDUM

CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_eu_info",
            "description": "Search indexed official EU sources for youth programmes, rights and funding.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the live web (official europa.eu domains) for up-to-date EU info.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_profile",
            "description": (
                "Check WHICH of the user's details are on file (returns field names only, never "
                "the values — they stay private in the EU)."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_preference",
            "description": (
                "Remember a light, NON-sensitive preference the user volunteers (e.g. "
                "key='climate', value='warm'; key='interests', value='environment'). Never store "
                "sensitive personal data (ID, address) this way."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Short preference name, e.g. 'climate'."},
                    "value": {"type": "string", "description": "Short value, e.g. 'warm'."},
                },
                "required": ["key", "value"],
            },
        },
    },
]


async def _run_tool(settings, name: str, args: dict[str, Any], user_id: str) -> dict[str, Any]:
    if name == "search_eu_info":
        try:
            results = await rag_search(settings, args.get("query", ""), k=5)
        except RuntimeError as e:
            return {"results": [], "note": str(e)}
        return {"results": results}
    if name == "web_search":
        return await tavily_search(settings, args.get("query", ""))
    if name == "get_profile":
        # Field names only — never the values (EU data residency); see app/tools.py.
        return profile_manifest(get_active_profile(user_id))
    if name == "save_preference":
        prefs = save_preference(user_id, args.get("key", ""), args.get("value", ""))
        return {"ok": True, "preferences": prefs}
    return {"error": f"unknown tool {name}"}


@router.post("")
async def chat(
    body: dict[str, Any] = Body(default={}),
    user: User = Depends(get_current_user),
) -> dict:
    """Run a short tool-using chat completion and return the assistant's reply + sources."""
    settings = get_settings()
    if not settings.has_key:
        return {"reply": "The backend has no OPENAI_API_KEY set, so chat is offline.", "sources": []}

    incoming = body.get("messages", []) or []
    messages: list[dict[str, Any]] = [{"role": "system", "content": _chat_system(user.id)}]
    for m in incoming[-12:]:  # keep the last few turns
        role = m.get("role", "user")
        content = m.get("content", "")
        if content and role in ("user", "assistant"):
            messages.append({"role": role, "content": content})

    sources: list[dict[str, str]] = []
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            for _ in range(5):  # bounded tool loop
                payload = {
                    "model": settings.chat_model,
                    "messages": messages,
                    "tools": CHAT_TOOLS,
                    "tool_choice": "auto",
                    "temperature": 0.5,
                }
                r = await client.post(_COMPLETIONS_URL, headers=headers, json=payload)
                if r.status_code >= 400:
                    log.error("chat completion failed (%s): %s", r.status_code, r.text[:300])
                    return {"reply": f"Sorry, the chat service errored ({r.status_code}).", "sources": []}

                msg = r.json()["choices"][0]["message"]
                tool_calls = msg.get("tool_calls")
                if not tool_calls:
                    return {"reply": (msg.get("content") or "").strip(), "sources": sources[:5]}

                messages.append(msg)  # the assistant turn that requested tools
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    try:
                        a = json.loads(fn.get("arguments") or "{}")
                    except Exception:
                        a = {}
                    result = await _run_tool(settings, fn.get("name", ""), a, user.id)
                    for it in (result.get("results") or []):
                        if it.get("url"):
                            sources.append({"title": it.get("title", ""), "url": it["url"]})
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc.get("id", ""),
                            "content": json.dumps(result)[:6000],
                        }
                    )
    except httpx.HTTPError as e:
        log.error("chat network error: %s", e)
        return {"reply": "I couldn't reach my brain just now — try again in a sec.", "sources": []}

    return {"reply": "Hmm, I got a bit tangled. Could you rephrase that?", "sources": sources[:5]}
