"""RAG over a persistent Chroma vector DB (Phase 4).

Chroma is the persistent vector store; WE generate embeddings (app/embeddings.py, OpenAI) and
hand them to Chroma as precomputed vectors. That keeps the network in one mockable place and lets
us reuse the same embedding model for both seed corpus and future scraped pages.

The DB lives on disk (backend/.chroma) and is seeded once from the curated corpus
(app/knowledge.py). Re-seeding is idempotent (upsert by id) and triggered when the corpus
fingerprint changes. To grow the knowledge base later (e.g. a scraper), call add_documents().

  search(settings, query, k) -> [{title, url, text, score}], best first.
  add_documents(settings, docs) -> upsert [{id, title, url, text}] into the DB.
"""

from pathlib import Path
from typing import Any, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from . import embeddings
from .config import Settings
from .knowledge import CORPUS, corpus_fingerprint

_DB_PATH = Path(__file__).resolve().parent.parent / ".chroma"
_FP_PATH = _DB_PATH / "seed_fingerprint.txt"
_COLLECTION = "eu_knowledge"

_client: Optional[chromadb.ClientAPI] = None
_seeded = False


def _get_collection():
    """Return the Chroma collection, creating the persistent client on first use."""
    global _client
    if _client is None:
        _DB_PATH.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(
            path=str(_DB_PATH),
            settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
        )
    # cosine space so score = 1 - distance is meaningful; we supply our own embeddings.
    return _client.get_or_create_collection(
        name=_COLLECTION, metadata={"hnsw:space": "cosine"}
    )


async def add_documents(settings: Settings, docs: list[dict[str, Any]]) -> int:
    """Embed and upsert documents. Each doc: {id, title, url, text}. Returns count added.

    This is the hook a future scraper uses: chunk EU pages into {id,title,url,text} and call
    this. Existing ids are overwritten (re-scrape friendly).
    """
    docs = [d for d in docs if (d.get("text") or "").strip()]
    if not docs:
        return 0
    texts = [f"{d.get('title', '')}. {d['text']}" for d in docs]
    vecs = await embeddings.embed_texts(settings, texts)
    col = _get_collection()
    col.upsert(
        ids=[str(d["id"]) for d in docs],
        embeddings=vecs,
        documents=[d["text"] for d in docs],
        metadatas=[{"title": d.get("title", ""), "url": d.get("url", "")} for d in docs],
    )
    return len(docs)


def _read_seed_fp() -> str:
    try:
        return _FP_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def _write_seed_fp(fp: str) -> None:
    try:
        _DB_PATH.mkdir(parents=True, exist_ok=True)
        _FP_PATH.write_text(fp, encoding="utf-8")
    except OSError:
        pass


async def ensure_index(settings: Settings) -> None:
    """Seed the DB from the curated corpus if empty or if the corpus changed (idempotent)."""
    global _seeded
    if _seeded:
        return
    col = _get_collection()
    fp = corpus_fingerprint()
    seed_ids = {f"seed:{c['id']}" for c in CORPUS}
    existing = set(col.get(ids=list(seed_ids)).get("ids", []))
    # (Re)seed when any curated chunk is missing or the corpus fingerprint changed.
    if existing != seed_ids or _read_seed_fp() != fp:
        await add_documents(
            settings,
            [
                {"id": f"seed:{c['id']}", "title": c["title"], "url": c["url"], "text": c["text"]}
                for c in CORPUS
            ],
        )
        _write_seed_fp(fp)
    _seeded = True


def reset_index() -> None:
    """Drop the in-memory client/seed flag (tests). Does not delete on-disk data by itself."""
    global _client, _seeded
    _client = None
    _seeded = False


async def search(settings: Settings, query: str, k: int = 3) -> list[dict[str, Any]]:
    """Return the top-k knowledge chunks for `query`, each with its source URL and score."""
    query = (query or "").strip()
    if not query:
        return []
    await ensure_index(settings)
    col = _get_collection()
    qvec = (await embeddings.embed_texts(settings, [query]))[0]
    # Ask for a couple extra to drop the fingerprint marker, then trim.
    res = col.query(query_embeddings=[qvec], n_results=k + 2)
    ids = res.get("ids", [[]])[0]
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]
    out: list[dict[str, Any]] = []
    for i, _id in enumerate(ids):
        if (metas[i] or {}).get("marker"):
            continue  # skip the fingerprint marker doc
        out.append(
            {
                "title": (metas[i] or {}).get("title", ""),
                "url": (metas[i] or {}).get("url", ""),
                "text": docs[i],
                "score": round(1.0 - float(dists[i]), 4),  # cosine distance -> similarity
            }
        )
        if len(out) >= k:
            break
    return out
