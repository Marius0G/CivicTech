"""Phase 4 local proof — RAG + web search, no real network.

Mocks the OpenAI embeddings call with a deterministic bag-of-words embedder (so cosine
ranking reflects real keyword overlap) and mocks Tavily, exercising the REAL code paths:
  • knowledge corpus loads with source URLs; fingerprint is stable
  • rag.search ranks the right chunk top for a query and returns its URL + score
  • POST /tools/search_eu_info returns ranked results with sources
  • POST /tools/web_search degrades gracefully with no key, and returns results when keyed
  • Tavily request is constrained to europa.eu

Run:  .venv/Scripts/python.exe test_phase4.py
"""

import asyncio
import os
import re
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("OPENAI_API_KEY", "sk-test-key")
os.environ.pop("TAVILY_API_KEY", None)  # start with web_search unconfigured

from fastapi.testclient import TestClient  # noqa: E402

import app.embeddings as embeddings_mod  # noqa: E402
import app.rag as rag  # noqa: E402
import app.websearch as websearch  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.knowledge import CORPUS, corpus_fingerprint  # noqa: E402
from app.main import app  # noqa: E402

checks: list[tuple[str, bool]] = []


def check(label: str, cond: bool) -> None:
    checks.append((label, bool(cond)))


# ---- deterministic fake embedder: bag-of-words hashed into a fixed-dim vector --------------
_DIM = 256
_word = re.compile(r"[a-z]+")


def _fake_vector(text: str) -> list[float]:
    v = [0.0] * _DIM
    for w in _word.findall(text.lower()):
        if len(w) < 3:
            continue
        v[hash(w) % _DIM] += 1.0
    return v


async def fake_embed_texts(settings, texts):
    return [_fake_vector(t) for t in texts]


# Patch the embedder everywhere rag reaches it, and isolate Chroma to a throwaway temp DB.
embeddings_mod.embed_texts = fake_embed_texts
rag.embeddings.embed_texts = fake_embed_texts
_tmp_db = Path(tempfile.mkdtemp(prefix="chroma_test_"))
rag._DB_PATH = _tmp_db
rag._FP_PATH = _tmp_db / "seed_fingerprint.txt"
rag.reset_index()

client = TestClient(app)


# ---- 1) corpus sanity ---------------------------------------------------------------------
check("corpus has >= 10 chunks", len(CORPUS) >= 10)
check("every chunk has a europa.eu URL", all("europa.eu" in c["url"] for c in CORPUS))
check("fingerprint stable", corpus_fingerprint() == corpus_fingerprint())


# ---- 2) ranking: the right chunk wins -----------------------------------------------------
async def _search(q, k=3):
    return await rag.search(get_settings(), q, k=k)


erasmus = asyncio.run(_search("erasmus study abroad university student grant"))
check("erasmus query returns results", len(erasmus) > 0)
check("erasmus query ranks an erasmus chunk top", "erasmus" in erasmus[0]["url"].lower() or "Erasmus" in erasmus[0]["title"])
check("results carry a source URL", bool(erasmus[0]["url"]))
check("results carry a score", isinstance(erasmus[0]["score"], float))

esc = asyncio.run(_search("solidarity corps volunteering eligibility age residence"))
check("solidarity query ranks a solidarity chunk top", "solidarity" in esc[0]["url"].lower() or "Solidarity" in esc[0]["title"])

discover = asyncio.run(_search("free train travel pass for 18 year olds around europe"))
check("discovereu query ranks discovereu top", "discovereu" in discover[0]["url"].lower() or "DiscoverEU" in discover[0]["title"])

check("k limits result count", len(asyncio.run(_search("erasmus", k=2))) == 2)
check("chroma seeded with corpus", rag._get_collection().count() >= len(CORPUS))


# ---- 2b) add_documents hook (future scraper) ----------------------------------------------
added = asyncio.run(
    rag.add_documents(
        get_settings(),
        [
            {
                "id": "scraped:test-grant",
                "title": "Special Zorblax Youth Grant",
                "url": "https://youth.europa.eu/zorblax_en",
                "text": "The Zorblax grant funds underwater basket weaving exchanges for young people.",
            }
        ],
    )
)
check("add_documents upserts 1 doc", added == 1)
zorblax = asyncio.run(_search("zorblax underwater basket weaving grant"))
check("scraped doc is searchable", any("zorblax" in r["url"].lower() for r in zorblax))
check("scraped doc carries its url", zorblax[0]["url"].startswith("https://"))


# ---- 3) search_eu_info endpoint -----------------------------------------------------------
resp = client.post("/tools/search_eu_info", json={"query": "how do I sign up for the solidarity corps"})
check("search_eu_info 200", resp.status_code == 200)
body = resp.json()
check("search_eu_info returns results", len(body.get("results", [])) > 0)
check("search_eu_info results have urls", all(r.get("url") for r in body["results"]))


# ---- 4) web_search: graceful with no key (force-clear the setting, ignore any real .env key)
_saved_tavily = get_settings().tavily_api_key
get_settings().tavily_api_key = ""
resp = client.post("/tools/web_search", json={"query": "erasmus deadline 2026"})
check("web_search 200 without key", resp.status_code == 200)
wbody = resp.json()
check("web_search reports not configured without key", wbody.get("configured") is False)


# ---- 5) web_search with a key (mocked Tavily) ---------------------------------------------
class _FakeResp:
    status_code = 200

    def json(self):
        return {
            "answer": "Applications open in spring.",
            "results": [
                {"title": "ESC", "url": "https://youth.europa.eu/solidarity_en", "content": "info"},
            ],
        }


class _FakeClient:
    last_payload = None

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None):
        _FakeClient.last_payload = json
        return _FakeResp()


websearch.httpx.AsyncClient = _FakeClient
get_settings().tavily_api_key = "tvly-test"  # mutate cached settings

resp = client.post("/tools/web_search", json={"query": "erasmus deadline 2026"})
wbody2 = resp.json()
check("web_search configured with key", wbody2.get("configured") is True)
check("web_search returns mocked results", len(wbody2.get("results", [])) == 1)
check("web_search constrained to europa.eu",
      (_FakeClient.last_payload or {}).get("include_domains") == ["europa.eu"])

get_settings().tavily_api_key = _saved_tavily  # restore real .env key


# ---- report -------------------------------------------------------------------------------
print("\n  Phase 4 proof — RAG + web search\n")
ok = True
for label, passed in checks:
    print(f"   {'PASS' if passed else 'FAIL'}  {label}")
    if not passed:
        ok = False
print()
if not ok:
    print("  Phase 4 proof FAILED\n")
    sys.exit(1)
print("  Phase 4 proof PASSED\n")
