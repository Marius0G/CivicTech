# 🐸 EU Youth Buddy — backend (Phase 1)

FastAPI server that mints **OpenAI Realtime ephemeral tokens** so the mobile app can open a
voice session with Hoppy without ever seeing the real API key.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness + whether the OpenAI key is configured |
| `POST` | `/realtime/token` | Mints `{ value: "ek_…", … }` for the app (key stays server-side) |

The Hoppy persona, model (`gpt-realtime-2`), and voice (`marin`) are baked in **server-side**
at mint time (see `app/persona.py`, `app/realtime.py`) so the client can't tamper with them.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows PowerShell/CMD
pip install -r requirements.txt
copy .env.example .env            # then edit .env and paste your real OPENAI_API_KEY
```

## Run (so your phone can reach it)

`--host 0.0.0.0` makes it reachable on your LAN (not just localhost):

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Find your laptop's LAN IP (the app connects to this, not "localhost"):

```bash
ipconfig            # look for IPv4 Address, e.g. 192.168.1.42
```

Put that IP in the app: `spike-webview-autopilot/src/config.ts` → `BACKEND_URL`.
Phone and laptop must be on the **same Wi-Fi**.

Quick check from the laptop:

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/realtime/token   # should return an ek_... once the key is set
```

## What's verified ✅

- Server boots; `/health` reports key status, model, voice.
- `/realtime/token` returns a **clean 502 with a clear message** when no key is set.
- With a key, it sends the correct session body (model + Hoppy persona + voice) to OpenAI and
  passes the `value` token back to the app. *(Proven against a local mock; the only difference
  with the real key is the upstream URL.)*

## Tests

```bash
python test_payload.py     # network-free: asserts the /client_secrets body is correct
```

`mock_openai.py` is a tiny local stand-in for OpenAI used to verify the happy-path plumbing
offline (echoes back the session it received).

## Knowledge base (RAG) — filling the vector DB

Hoppy answers EU questions from a **Chroma** vector DB (embedded, on-disk at `backend/.chroma/`,
no Docker). The `search_eu_info` tool embeds the question and returns the closest chunks **with
source URLs** so the frog can cite. Three ways content gets in:

| Layer | File | What |
|---|---|---|
| Seed | `app/knowledge.py` | ~dozen hand-written chunks; always reseeded so the demo works even with an empty DB. |
| Scrape | `scrape_eu.py` | Ingest specific URLs you list. |
| Crawl | `crawl_eu.py` | **Bulk**: polite BFS over the official portals (English-only), the main way to fill the DB. |

```bash
# Bulk-fill from the European Youth Portal + Erasmus+ + Your Europe (citizens' rights):
.venv/Scripts/python.exe crawl_eu.py --max 150        # ~1k+ chunks; re-runnable (upsert by URL)
.venv/Scripts/python.exe crawl_eu.py --dry-run        # discover URLs only, no embed/store

# Ingest hand-picked pages:
.venv/Scripts/python.exe scrape_eu.py https://youth.europa.eu/discovereu_en  # or --file urls.txt

# Inspect the DB:
.venv/Scripts/python.exe -c "from app.rag import _get_collection; print(_get_collection().count())"
```

The crawler filters out non-English language variants (24 EU + EEA/candidate langs), tracking
query params, assets and admin paths; it stays on-topic via per-source host + path-prefix rules
(see `PLAN` in `crawl_eu.py`). Embeddings = OpenAI `text-embedding-3-small`; `.chroma/` is
gitignored (reproducible from the crawl). Tavily `web_search` complements RAG for fresh info.

## Notes / next phases

- CORS is `*` for dev (`CORS_ORIGINS` to restrict). The mobile app sends no Origin, so this
  only matters for web testing.
- Phase 2 adds the server-side tools (`search_eu_info`, `web_search`) to this same app; the
  client-side tools (`fill_form`) stay in the app.
