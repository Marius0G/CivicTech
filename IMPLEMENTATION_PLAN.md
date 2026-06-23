# 🐸 EU Youth Buddy — Implementation Plan

Ordered to **kill the biggest risks first**. Each phase ends with a checkpoint you can
actually verify. Don't move on until the checkpoint passes. See [`README.md`](./README.md)
for architecture and decisions.

**Build order principle:** the two riskiest, most novel pieces are (a) loading + filling the
real form inside a WebView, and (b) the Realtime-function-call → client-tool plumbing. Prove
both *before* polishing the mascot or RAG. A pretty frog is worthless if the autopilot can't run.

## Repository layout

| Folder | Purpose |
|---|---|
| `spike-webview-autopilot/` | **Frozen Phase 0 proof** — WebView + form-fill only. Runs in Expo Go. Don't grow it. |
| `mobile/` | **The real app** (Expo dev client): voice + autopilot + (later) mascot/tools. |
| `backend/` | **FastAPI**: Realtime token minting + (later) RAG, web search, doc OCR. |

## Progress

- ✅ **Phase 0** — autopilot fill proven against the real ESC eligibility form (jsdom proof passes).
- ✅ **Phase 1** — backend `/realtime/token` built & verified (incl. happy-path via mock); client
  WebRTC voice module + "Talk to Hop" wired in `mobile/`. *On-device voice check pending your
  Android toolchain + OpenAI key.*
- ✅ **Phase 2** — function-call bridge: 6 tools defined, routed (client→WebView, server→FastAPI),
  results returned to the model. Backend `/tools/*` live-tested; client router proven by
  `mobile/verify-tools.mjs` (15/15, injected JS runs against the real form).
- ✅ **ON-DEVICE (Phases 0–2 verified live on an Android phone):** voice in/out (OpenAI Realtime
  over WebRTC), Hop on **loudspeaker** + faster speech (`speed` 1.3), tool calls firing, and the
  **autopilot fills the real ESC form** — with both the saved profile and dynamically-spoken data
  (country names resolved to Drupal codes). Build = Expo SDK 56 dev client.
  - Gotcha fixed: **Hermes strips `Function.toString()` source** → injected scripts must be literal
    JS strings, not serialized functions (this passed jsdom but failed on-device).
- ✅ **Phase 3** — profile from documents. Backend `POST /docs/upload` → GPT-4o vision (`gpt-4o`,
  `response_format=json_object`) → `{name, birthdate, country, nationality}`; stored in-memory as the
  active profile; country normalised to the Drupal option code (`app/countries.py`, Greece=EL). `get_profile`
  now returns the uploaded profile (else demo). Mobile: "📄 Scan my ID" (expo-image-picker → `/docs/upload`)
  + on-screen profile chip. Proven by `backend/test_phase3.py` (19/19, network mocked).
- ✅ **Phase 4** — RAG + web search on a **real Chroma vector DB**. Curated EU corpus
  (`app/knowledge.py`) seeds a persistent Chroma collection (`backend/.chroma`, cosine space);
  we generate embeddings ourselves (`text-embedding-3-small`, `app/embeddings.py`) and hand them to
  Chroma so the network stays mockable. `search_eu_info` returns ranked chunks **with source URLs**;
  `web_search` via **Tavily** constrained to `europa.eu` (graceful "not configured" without a key —
  user has since added a live `TAVILY_API_KEY`). `rag.add_documents()` + `backend/scrape_eu.py`
  (fetch → BeautifulSoup text → overlapping chunks → embed → upsert) let us **grow the DB with
  scraped EU pages later**. Persona calls `search_eu_info` for EU facts and cites the source.
  Proven by `backend/test_phase4.py` (22/22, embeddings + Tavily mocked, real Chroma in a temp DB)
  and a **live** smoke test (real embeddings + Chroma + Tavily + a real one-page scrape).
- ✅ **Phase 4 — DB filled with real data.** `backend/crawl_eu.py` (polite English-only BFS crawler,
  per-source language/path rules, retry/backoff) ingested **2,279 chunks (~414 pages, 41 MB
  `.chroma/`)** from the European Youth Portal (395), Erasmus+ (1288) and Your Europe / citizens'
  rights (596). Verified by semantic queries (Erasmus apply, ESC eligibility, work-abroad visa,
  DiscoverEU, EHIC, diploma recognition) — all relevant + correctly sourced (0.65–0.86). No content
  API exists for these pages (researched), so crawling is the right call; README has the commands.
- ✅ **Phase 5** — the frog mascot. `mobile/src/Mascot.tsx`: a **pure-RN `Animated` frog** (no native
  deps, so it reloads as a JS-only change — no 40-min rebuild) with idle breathing+blink, a
  talking mouth, and a celebrate jump+✨. Driven by Realtime events: `mobile/src/realtimeEvents.ts`
  `interpretEvent()` maps `output_audio_buffer.started/stopped` + `response.audio_transcript.delta`
  → a debounced `speaking` signal (lip-sync without PCM access), and `fill_form` success → celebrate.
  Persona got a warmth/celebrate pass. Proven by `mobile/verify-mascot.mjs` (14/14) + clean `tsc`.
  Rive upgrade path scaffolded: swap Mascot for a `rive-react-native` rig with the same
  (speaking, celebrate) props when a `.riv` asset is sourced.
- 📌 Real on-device retest of Phases 3–5 pending phone reconnection (vision upload, voice RAG
  answers, mascot lip-sync + celebrate).
- ⏭️ **Phase 6** — next: wrap the narrative (mock "Login with EU ID", onboarding, visual polish).

---

## Phase 0 — Spike the load-bearing trick (do this FIRST, ~2–3h)
> Goal: prove the autopilot is physically possible before building anything else.

- [ ] New blank **Expo dev client** app (`npx create-expo-app`, then `expo prebuild` /
      `expo run:ios|android` — NOT Expo Go).
- [ ] Add `react-native-webview`. Load `https://youth.europa.eu/solidarity/register/check_en`.
- [ ] Confirm it **renders** in the WebView (it will — top-level nav, frame headers don't apply).
- [ ] Use `injectedJavaScript` to set `#edit-address-country` and `#edit-birthdate` (see
      README §6). Confirm the fields **visibly fill**.
- [ ] Read the country dropdown's option values via injected JS (`[...select.options].map(o=>o.value)`)
      and write them down — you'll need the exact value for "Romania" etc.

**✅ Checkpoint:** the real eligibility form fills from injected JS on a physical phone/emulator.
If this fails, stop and rethink the autopilot before doing anything else.

---

## Phase 1 — Backend skeleton + Realtime token (~2–3h)
> Goal: the app can start a voice session with the brain.

- [ ] FastAPI app. `POST /realtime/token` → calls OpenAI to mint an **ephemeral** Realtime
      session token. (The real API key lives only in backend env vars.)
- [ ] CORS / local network access so the phone can reach the laptop.
- [ ] In the app: `react-native-webrtc`, connect to OpenAI Realtime using the ephemeral token,
      establish audio in/out + the data channel.
- [ ] Hardcode a system prompt: "You are Hop, a friendly frog who helps EU youth…".

**✅ Checkpoint:** you can talk to the frog and hear it reply (no tools yet, no mascot yet).

---

## Phase 2 — The function-call → client-tool bridge (~3–4h) ⚠️ riskiest glue
> Goal: the brain can trigger code that runs IN the app.

- [ ] Declare tools to Realtime: `open_form`, `fill_form`, `read_page` (client),
      `search_eu_info`, `web_search`, `get_profile` (server).
- [ ] Handle `response.function_call` events from the data channel in the RN app.
- [ ] Route **client** tools → run locally (WebView injection); **server** tools → HTTP to FastAPI.
- [ ] Return each tool's result back into the Realtime session so the model can continue.
- [ ] Wire `open_form(url)` and `fill_form(fields)` to the Phase 0 WebView.

**✅ Checkpoint:** say *"open the solidarity corps form and fill it in"* → the frog opens the
WebView and fills the two fields. **This is the demo's spine. Everything else is enrichment.**

---

## Phase 3 — Profile from documents (~2–3h)
> Goal: the data the autopilot fills comes from the user's real docs.

- [x] `POST /docs/upload`: accept an image → GPT-4o vision → structured JSON
      `{name, birthdate, country, nationality}`.
- [x] Store it for the single demo user (in-memory — no auth needed).
- [x] `get_profile()` returns it; `fill_form` maps `country`→dropdown value, `birthdate`→date.
- [x] App screen: upload a photo of an ID → see extracted profile.

**✅ Checkpoint:** upload Maria's ID → frog fills the form with the **extracted** country + DOB.

---

## Phase 4 — RAG + web search (trustworthy answers) (~3–4h)
> Goal: the frog gives accurate, cited EU info — not hallucinations.

- [x] Curated corpus (`app/knowledge.py`) seeds the DB — demo-day robust even before any scraping.
      Covers ESC, Erasmus+, DiscoverEU, EU Login, EURES, youth rights.
- [x] Embed (OpenAI `text-embedding-3-small`) → **real Chroma** persistent collection (`app/rag.py`,
      `backend/.chroma`). `search_eu_info(query)` returns chunks + source URLs.
- [x] `web_search(query)` via **Tavily**, `include_domains=["europa.eu"]` (graceful without a key).
- [x] Tuned the system prompt so the frog calls `search_eu_info` for EU facts and cites the source.
- [x] Growth hook: `rag.add_documents()` + `scrape_eu.py` CLI to scrape EU pages into the DB later.

**✅ Checkpoint:** ask the demo questions (Erasmus+, ESC eligibility) → correct, sourced answers.

---

## Phase 5 — The frog mascot (~3–4h)
> Goal: the soul. Do this only after the machine works.

- [x] Frog with `idle` / `talking` / `celebrate` states — pure-RN `Animated` (`Mascot.tsx`).
      (Rive deferred: scaffolded as a drop-in upgrade with matching props once a `.riv` is sourced.)
- [x] Drive the `talking` state from Realtime speech events (mouth moves when Hop speaks).
      True PCM amplitude isn't exposed over WebRTC, so we approximate from transcript-delta +
      output-audio-buffer events (`realtimeEvents.ts`).
- [x] Trigger `celebrate` on the success beat after the form is filled (`fill_form` ok → jump + ✨).
- [x] Personality pass on the system prompt: warm, encouraging, celebratory, transparent it's an AI.

**✅ Checkpoint:** the frog animates and lip-syncs while speaking; celebrates on success.

---

## Phase 6 — Wrap the narrative (~2–3h)
> Goal: it feels like one product, not a feature list.

- [ ] Mocked **"Login with EU ID"** screen (frog-branded) → demo session.
- [ ] Onboarding: upload doc → meet the frog.
- [ ] Visual polish: EU-themed palette, the frog front and center, chat + WebView panes.
- [ ] Smooth the persona-journey transitions (greeting → ask → discover → autopilot → celebrate).

**✅ Checkpoint:** a stranger can follow the whole story without you explaining it.

---

## Phase 7 — Demo-day hardening (~2h) — DO NOT SKIP
> Goal: survive conference wifi. (You said "wing it" — at minimum do 1–3 here.)

- [x] Run **FastAPI locally** on the laptop, phone on the same network. `backend/run_demo.ps1`
      boots uvicorn on `0.0.0.0:8000`, sets `adb reverse`, prints the LAN IP.
- [x] **Cache the eligibility page** + flag to load the cached copy if the live site is slow/down.
      Bundled `mobile/assets/eligibility.html`; `USE_CACHED_FORM` flag in `mobile/src/config.ts`;
      `App.tsx` WebView auto-falls back to the cached copy on load error / 8 s timeout.
- [ ] **Record a full backup run** of the demo. *(operational — see `DEMO_RUNBOOK.md` §5.)*
- [x] Pre-warm RAG; rehearse the **exact** demo questions; lock the demo user's profile.
      `run_demo.ps1` locks Maria's profile and pre-warms RAG with the rehearsed questions.
- [ ] Charge devices, set screen mirroring, disable notifications. *(operational — `DEMO_RUNBOOK.md` §7.)*

**✅ Checkpoint:** unplug from the internet (or simulate failure) and the demo still tells its story.
**See [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) for the full stage runbook.**

---

## Critical path (if you run out of time, this is the minimum winning demo)

```
Phase 0 (form fills)  →  Phase 2 (frog triggers it)  →  Phase 3 (from real docs)
                       →  Phase 5-lite (a frog that talks)  →  Phase 7 (don't crash)
```

RAG (Phase 4) and full polish (Phase 6) are enrichment. The **autopilot driven by voice** is the
"wow." Protect it first, protect it last.

---

## Parallelization (if you have 2–3 coders)

- **Coder A (mobile/integration):** Phases 0 → 2 → 5 (WebView, Realtime, mascot).
- **Coder B (backend):** Phases 1 → 3 → 4 (tokens, OCR/profile, RAG).
- Agree the **tool contracts** (README §7) on hour 1 so both sides can build to the interface.
- Converge at Phase 2's checkpoint (the bridge), then again at Phase 6.
