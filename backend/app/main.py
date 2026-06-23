"""EU Youth Buddy backend — Phase 1.

Endpoints:
  GET  /health          -> liveness + whether the OpenAI key is configured
  POST /realtime/token  -> mint an ephemeral Realtime client secret for the app

Run (dev):
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""

import logging
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .chat import router as chat_router
from .config import get_settings
from .docs import router as docs_router
from .realtime import mint_client_secret
from .tools import router as tools_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("youthbuddy")

app = FastAPI(title="EU Youth Buddy — backend", version="0.1.0")

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tools_router)
app.include_router(docs_router)
app.include_router(chat_router)


@app.get("/health")
def health() -> dict:
    """Liveness check. `openai_key` tells you if the server can actually mint tokens."""
    return {
        "status": "ok",
        "openai_key_configured": settings.has_key,
        "model": settings.realtime_model,
        "voice": settings.realtime_voice,
    }


@app.post("/realtime/token")
async def realtime_token(body: dict[str, Any] = Body(default={})) -> dict:
    """Mint a short-lived Realtime client secret (ek_...) for the mobile app.

    The app reads `.value` from the response and uses it as the WebRTC bearer token.
    The real OpenAI api key never leaves this server. An optional `{"language": "fr"}` body
    pins Hoppy to the language the user picked in the app's language menu (defaults to English).
    An optional `{"voice": "cedar"}` body sets Hoppy's voice (defaults to the server default).
    """
    language = (body or {}).get("language")
    voice = (body or {}).get("voice")
    try:
        data = await mint_client_secret(settings, language, voice)
    except RuntimeError as e:
        log.error("token mint failed: %s", e)
        # 502 if upstream/config problem; message is safe (no key leaked).
        raise HTTPException(status_code=502, detail=str(e))
    return data
