"""OpenAI text embeddings for the RAG index (Phase 4).

One network-isolated function so the RAG layer is testable with a fake embedder. Returns a
list of float vectors, one per input text, in order.
"""

import asyncio
from typing import Any

import httpx

from .config import Settings

EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"
_MAX_RETRIES = 4


async def embed_texts(settings: Settings, texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts with the configured OpenAI embedding model.

    Retries transient network/5xx/429 failures with exponential backoff, so a brief WiFi/DNS
    blip during a bulk crawl doesn't abort the whole ingest.
    """
    if not settings.has_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")
    if not texts:
        return []

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {"model": settings.embedding_model, "input": texts}

    last_err = ""
    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(EMBEDDINGS_URL, headers=headers, json=payload)
            if resp.status_code < 400:
                data = resp.json()["data"]
                data.sort(key=lambda d: d["index"])  # keep input order
                return [d["embedding"] for d in data]
            # 429/5xx are worth retrying; 4xx (bad request/auth) are not.
            if resp.status_code not in (429,) and resp.status_code < 500:
                raise RuntimeError(f"embeddings failed ({resp.status_code}): {resp.text[:300]}")
            last_err = f"{resp.status_code}: {resp.text[:200]}"
        except httpx.HTTPError as e:
            last_err = str(e)
        if attempt < _MAX_RETRIES - 1:
            await asyncio.sleep(2 ** attempt)  # 1s, 2s, 4s
    raise RuntimeError(f"embeddings failed after {_MAX_RETRIES} attempts: {last_err}")
