"""Scrape EU pages into the Chroma vector DB (Phase 4 growth hook).

Fetches each URL, extracts readable text, splits it into overlapping chunks, embeds them via
OpenAI and upserts into the same Chroma collection the `search_eu_info` tool queries. Re-running
on the same URL overwrites its chunks (ids are deterministic from the URL), so it's safe to
re-scrape.

Usage:
  .venv/Scripts/python.exe scrape_eu.py URL [URL ...]
  .venv/Scripts/python.exe scrape_eu.py --file urls.txt      # one URL per line

Notes:
  • Needs OPENAI_API_KEY (embeddings). Network required.
  • This ADDS to the curated seed corpus; it doesn't replace it.
"""

import asyncio
import hashlib
import re
import sys

import httpx
from bs4 import BeautifulSoup

from app.config import get_settings
from app.rag import add_documents

CHUNK_CHARS = 1200
CHUNK_OVERLAP = 200


def extract_text(html: str) -> tuple[str, str]:
    """Return (title, clean_text) from an HTML page."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "form", "noscript"]):
        tag.decompose()
    title = (soup.title.string if soup.title and soup.title.string else "").strip()
    text = soup.get_text(separator=" ")
    text = re.sub(r"\s+", " ", text).strip()
    return title, text


def chunk_text(text: str, size: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split into overlapping char windows, breaking on a space near each boundary."""
    chunks: list[str] = []
    i, n = 0, len(text)
    while i < n:
        end = min(i + size, n)
        if end < n:
            sp = text.rfind(" ", i + size - overlap, end)
            if sp > i:
                end = sp
        chunk = text[i:end].strip()
        if chunk:
            chunks.append(chunk)
        i = max(end - overlap, end) if end < n else end
    return chunks


def _doc_id(url: str, idx: int) -> str:
    h = hashlib.sha256(url.encode()).hexdigest()[:10]
    return f"scrape:{h}:{idx}"


async def scrape_url(client: httpx.AsyncClient, url: str) -> list[dict]:
    resp = await client.get(url, follow_redirects=True, timeout=30.0)
    resp.raise_for_status()
    title, text = extract_text(resp.text)
    chunks = chunk_text(text)
    return [
        {"id": _doc_id(url, i), "title": title or url, "url": url, "text": c}
        for i, c in enumerate(chunks)
    ]


async def main(urls: list[str]) -> None:
    settings = get_settings()
    if not settings.has_key:
        print("ERROR: OPENAI_API_KEY not set (needed for embeddings).", file=sys.stderr)
        sys.exit(1)

    total = 0
    async with httpx.AsyncClient(headers={"User-Agent": "EUYouthBuddy/0.1"}) as client:
        for url in urls:
            try:
                docs = await scrape_url(client, url)
            except Exception as e:  # noqa: BLE001 - report and continue
                print(f"  ! {url}: {e}", file=sys.stderr)
                continue
            added = await add_documents(settings, docs)
            total += added
            print(f"  + {url}: {added} chunks")
    print(f"Done. Ingested {total} chunks into the Chroma DB.")


def _parse_args(argv: list[str]) -> list[str]:
    if not argv:
        print(__doc__)
        sys.exit(0)
    if argv[0] == "--file":
        with open(argv[1], encoding="utf-8") as f:
            return [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]
    return argv


if __name__ == "__main__":
    asyncio.run(main(_parse_args(sys.argv[1:])))
