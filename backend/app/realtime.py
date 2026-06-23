"""Mint OpenAI Realtime ephemeral client secrets for the mobile app.

Flow:
  app -> POST /realtime/token (this backend)
       -> backend POSTs /v1/realtime/client_secrets with the SECRET api key
       -> returns { value: "ek_...", expires_at, ... } to the app
  app then uses that ek_ key to open a WebRTC peer connection directly to OpenAI.
"""

from typing import Any

import httpx

from .config import Settings
from .persona import HOPPY_INSTRUCTIONS
from .tool_defs import TOOL_DEFS


def build_session_payload(settings: Settings) -> dict[str, Any]:
    """Construct the request body for /v1/realtime/client_secrets.

    Pure function (no network) so it can be unit-tested. The Hoppy persona, voice, tools, and
    speech speed are baked in here, server-side, so the model has them from the first frame.
    """
    return {
        "session": {
            "type": "realtime",
            "model": settings.realtime_model,
            "instructions": HOPPY_INSTRUCTIONS,
            "tools": TOOL_DEFS,
            "tool_choice": "auto",
            "audio": {
                "output": {
                    "voice": settings.realtime_voice,
                    "speed": settings.realtime_speed,
                },
            },
        }
    }


async def mint_client_secret(settings: Settings) -> dict[str, Any]:
    """Call OpenAI to mint a short-lived client secret. Returns the raw OpenAI JSON.

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
    payload = build_session_payload(settings)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(settings.client_secrets_url, headers=headers, json=payload)

    if resp.status_code >= 400:
        # Surface OpenAI's error body but never leak the api key.
        raise RuntimeError(
            f"OpenAI client_secrets failed ({resp.status_code}): {resp.text[:500]}"
        )

    return resp.json()
