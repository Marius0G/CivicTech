"""Mint OpenAI Realtime ephemeral client secrets for the mobile app.

Flow:
  app -> POST /realtime/token (this backend)
       -> backend POSTs /v1/realtime/client_secrets with the SECRET api key
       -> returns { value: "ek_...", expires_at, ... } to the app
  app then uses that ek_ key to open a WebRTC peer connection directly to OpenAI.
"""

from datetime import datetime, timezone
from typing import Any

import httpx

from .config import Settings
from .persona import instructions_for
from .preferences import get_preferences
from .profile import DEMO_USER_ID
from .tool_defs import TOOL_DEFS


def today_utc() -> str:
    """Today's date as an ISO string (UTC). The server runs in UTC (Azure); see grilling notes."""
    return datetime.now(timezone.utc).date().isoformat()

# The voices OpenAI Realtime currently offers. We validate the app's requested voice against this
# set so a stale/garbage value can never reach OpenAI — unknown values fall back to the default.
VALID_VOICES = frozenset(
    {"alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"}
)


def resolve_voice(settings: Settings, voice: str | None) -> str:
    """Pick the voice to use: the app's choice if it's a real Realtime voice, else the default."""
    candidate = (voice or "").strip().lower()
    return candidate if candidate in VALID_VOICES else settings.realtime_voice


def build_session_payload(
    settings: Settings,
    language: str | None = None,
    voice: str | None = None,
    today: str | None = None,
    preferences: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Construct the request body for /v1/realtime/client_secrets.

    Pure function (no network) so it can be unit-tested. The Hop persona, voice, tools, and
    speech speed are baked in here, server-side, so the model has them from the first frame.
    `language` (an i18n code the app sends, e.g. "fr") pins Hop to that spoken language.
    `voice` (an OpenAI Realtime voice id the app sends, e.g. "cedar") sets which voice Hop uses;
    an unknown/missing value falls back to the server default.
    `today` (ISO date) and `preferences` (a small {key: value} map) are baked into the persona so
    Hop knows the date and what it has learned about this user.
    """
    return {
        "session": {
            "type": "realtime",
            "model": settings.realtime_model,
            "instructions": instructions_for(language, today, preferences),
            "tools": TOOL_DEFS,
            "tool_choice": "auto",
            "audio": {
                "input": {
                    # Filter background noise BEFORE the VAD decides "is this speech?".
                    "noise_reduction": {"type": "near_field"},
                    # Only a real, sustained voice should interrupt Hop — a high threshold plus a
                    # longer trailing-silence window keeps coughs/clicks/room noise from barging in.
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": settings.realtime_vad_threshold,
                        "prefix_padding_ms": settings.realtime_vad_prefix_ms,
                        "silence_duration_ms": settings.realtime_vad_silence_ms,
                    },
                },
                "output": {
                    "voice": resolve_voice(settings, voice),
                    "speed": settings.realtime_speed,
                },
            },
        }
    }


async def mint_client_secret(
    settings: Settings,
    language: str | None = None,
    voice: str | None = None,
    user_id: str = DEMO_USER_ID,
) -> dict[str, Any]:
    """Call OpenAI to mint a short-lived client secret. Returns the raw OpenAI JSON.

    `language` is the i18n code the app sends so Hop speaks the user's chosen language.
    `voice` is the OpenAI Realtime voice id the app sends so Hop uses the user's chosen voice.
    `user_id` scopes which saved preferences are baked into the persona (the session is fixed at
    mint time, so the date and prefs are a snapshot — fine for a session that lasts minutes).
    Raises RuntimeError with a clear message on misconfiguration / upstream failure.
    """
    if not settings.has_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Put it in backend/.env or the environment."
        )

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload = build_session_payload(
        settings, language, voice, today_utc(), get_preferences(user_id)
    )

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(settings.client_secrets_url, headers=headers, json=payload)

    if resp.status_code >= 400:
        # Surface OpenAI's error body but never leak the api key.
        raise RuntimeError(
            f"OpenAI client_secrets failed ({resp.status_code}): {resp.text[:500]}"
        )

    return resp.json()
