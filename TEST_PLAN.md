# 🧪 EU Youth Buddy — Test Plan for Phases 3–5

How we prove the three on-device features work: **Phase 3** (ID → profile → autopilot),
**Phase 4** (RAG + web search knowledge base), **Phase 5** (the frog mascot). Each phase has
**automated checks** (run anywhere, no phone) and **on-device checks** (need the Android phone).

> Current status: automated suites all green. On-device checks are **pending phone reconnection**.
> Phase-4 backend checks can be run **right now without the phone** (see §Phase 4 · Backend).

---

## 0. Test environment setup (once per session)

| What | Command / value |
|---|---|
| Backend | `cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| Backend key | `backend/.env` has real `OPENAI_API_KEY` (+ `TAVILY_API_KEY` for web_search) |
| Knowledge base | `.chroma/` filled (2,279 chunks). Check: `python -c "from app.rag import _get_collection; print(_get_collection().count())"` |
| adb | `C:/Users/mariu/AppData/Local/Android/Sdk/platform-tools/adb.exe` (not on PATH) |
| Phone link | USB, serial `b24178a3`. `adb reverse tcp:8000 tcp:8000` + `adb reverse tcp:8082 tcp:8082` |
| Metro | `REACT_NATIVE_PACKAGER_HOSTNAME=localhost npx expo run:android --port 8082` (8081 held by WSL) |
| App config | `mobile/src/config.ts` → `BACKEND_URL = http://localhost:8000` |

**Reload rules (saves time):**
- **Mascot (Phase 5) + most JS changes** → no rebuild: `adb shell am force-stop eu.youthbuddy.app && adb shell am start -n eu.youthbuddy.app/.MainActivity`.
- **Scan-my-ID (Phase 3)** needs **one native rebuild** (adds `expo-image-picker`): `npx expo run:android --port 8082`. After that, JS reloads suffice.

**How to observe (no reliable console):**
- On-screen **`🛠 <tool> → <result>`** line (the primary debug signal).
- The **profile chip** `👤 name · country · birthdate`.
- Screenshots: `adb exec-out screencap -p > shot.png` then view (app is 1080×2414).
- Backend terminal logs (`profile extracted from…`, tool POSTs).

**Pass/fail:** each test has an explicit expected result. Record P/F in §Results.

---

## Phase 3 — Profile from documents (ID → autopilot)

**Automated (green): `cd backend && .venv/Scripts/python.exe test_phase3.py` → 19/19**
covers vision JSON parsing (fenced/plain/messy), country resolution (Romania→RO, greece→EL,
United Kingdom→UK), upload→store→`get_profile`, empty-upload rejection. *(Vision HTTP mocked.)*

**Preconditions:** rebuilt app with image-picker; 2–3 photos in the gallery: a clear ID, an ID
with a non-RO country (ideally Greece for the EL quirk), and a non-ID photo (landscape).

| # | Test | Steps | Expected |
|---|---|---|---|
| 3.1 | Happy-path extract | Tap **📄 Scan my ID** → pick clear ID | Profile chip shows correct name · country (code) · birthdate; backend logs `profile extracted` |
| 3.2 | Autopilot uses scanned data | After 3.1, say *"fill in the solidarity corps form"* | `🛠 fill_form → ok`; WebView shows the **scanned** country + DOB (not demo Maria/RO) |
| 3.3 | Greece (EL) quirk | Scan a Greek ID → fill the form | Stored country `EL`; form dropdown lands on **Greece** |
| 3.4 | Picker cancel | Tap Scan → cancel picker | "Scan cancelled"; no crash; previous profile unchanged |
| 3.5 | Non-ID image | Scan a landscape photo | Empty/partial fields handled gracefully; no crash; Hop can ask to retake |
| 3.6 | Permission denied | Deny photo permission | Clear "Photo permission denied" message; no crash |

**Failure modes to watch:** wrong country code (name not resolved), birthdate format ≠ yyyy-mm-dd,
upload 502 (vision/network), app crash on large image.

---

## Phase 4 — RAG + web search (knowledge base)

**Automated (green): `cd backend && .venv/Scripts/python.exe test_phase4.py` → 22/22**
real Chroma (temp DB), embeddings + Tavily mocked; covers ranking, source URLs, `add_documents`,
graceful no-key path, europa.eu constraint.

### Phase 4 · Backend — runnable NOW, no phone

Start the backend, then:

```bash
# RAG retrieval (should return relevant chunks + source URLs)
curl -s -X POST localhost:8000/tools/search_eu_info -H "Content-Type: application/json" \
  -d '{"query":"am I eligible for the European Solidarity Corps?"}' | python -m json.tool

# Live web search (Tavily, europa.eu only)
curl -s -X POST localhost:8000/tools/web_search -H "Content-Type: application/json" \
  -d '{"query":"Erasmus+ application deadline 2026"}' | python -m json.tool
```

**Retrieval quality battery** (expect a relevant top hit from the noted domain):

| Question | Expect top source |
|---|---|
| How do I apply for Erasmus to study abroad? | erasmus-plus.ec.europa.eu |
| European Solidarity Corps eligibility & age? | youth.europa.eu/solidarity |
| Do I need a visa to work in another EU country? | europa.eu/youreurope/.../work |
| Free DiscoverEU travel pass for 18-year-olds? | youth.europa.eu/discovereu |
| EHIC health card when travelling? | europa.eu/youreurope/.../health |
| Recognition of my diploma abroad? | europa.eu/youreurope/.../education |
| Traineeships / internships in the EU? | (gap check — may need more crawl) |
| Youth exchanges? | youth.europa.eu / erasmus-plus |

> Quick batch: `cd backend && .venv/Scripts/python.exe -c "..."` (see §helper script below).

### Phase 4 · On-device (voice)

| # | Test | Say | Expected |
|---|---|---|---|
| 4.1 | RAG grounded answer | *"Am I eligible for the Solidarity Corps?"* | `🛠 search_eu_info → […]`; spoken answer matches KB; cites a source ("the Youth Portal says…") |
| 4.2 | Erasmus how-to | *"What's Erasmus+ and how do I apply?"* | Correct, cited, plain-language |
| 4.3 | Rights question | *"Do I need a visa to work in France?"* | Your Europe content; correct |
| 4.4 | Fresh info → web | *"Any Erasmus deadlines coming up?"* | `🛠 web_search`; europa.eu result; sensible answer |
| 4.5 | Anti-hallucination | Ask something NOT in KB (e.g. *"What's the capital of Mars?"*) | Frog declines / says it'll check; doesn't invent EU facts |

**Failure modes:** tool not called (answers from memory), wrong/empty retrieval, reads URLs aloud
(persona says don't), web_search "not configured" (missing `TAVILY_API_KEY`).

---

## Phase 5 — The frog mascot

**Automated (green): `cd mobile && node verify-mascot.mjs` → 14/14** (Realtime event → mascot
signal mapping) and `npx tsc --noEmit` clean. Mascot is **JS-only** — reloads without a rebuild.

| # | Test | Trigger | Expected |
|---|---|---|---|
| 5.1 | Idle | Connected, Hop silent | Gentle breathing bob + occasional blink |
| 5.2 | Talking / lip-sync | Hop speaks | Mouth opens/closes in time with speech |
| 5.3 | Stops cleanly | Hop finishes a sentence | Mouth closes within ~0.7 s (no stuck-open) |
| 5.4 | Celebrate | A `fill_form` succeeds | Jump + wiggle + ✨🎉 for ~2.6 s, then idle |
| 5.5 | Disconnect | Tap ⏹ Stop | Returns to idle; no animation stuck/looping |

**Capture for the demo reel:** screenshot burst during 5.2 and 5.4
(`for i in 1 2 3 4 5; do adb exec-out screencap -p > m$i.png; done`).

**Failure modes:** mouth never moves (events not arriving — check `output_audio_buffer.*` /
`response.audio_transcript.delta` reach `interpretEvent`), mouth stuck open (debounce timer),
celebrate doesn't fire (fill_form result not `ok`).

---

## 🎬 End-to-end demo path (ties 3 → 4 → 5)

The money shot, in order:
1. **Scan ID** → profile chip populates (P3).
2. *"Hey Hop, what can I do abroad this summer?"* → Hop talks, **mascot lip-syncs** (P5), answer is **RAG-grounded + cited** (P4).
3. *"Sign me up for the Solidarity Corps."* → `open_form` → `fill_form` with the **scanned** profile (P3).
4. Form fills → **celebrate** animation (P5) → Hop says "review and submit."

**E2E pass =** every arrow happens by voice, on-device, without a manual nudge, in one take.

---

## ✅ Results log (fill during the device session)

| Test | P/F | Notes |
|---|---|---|
| 3.1–3.6 | | |
| 4.1–4.5 | | |
| 4.backend battery | | (can do now) |
| 5.1–5.5 | | |
| E2E | | |

---

## helper script — RAG battery (no phone)

```bash
cd backend && .venv/Scripts/python.exe - <<'PY'
import asyncio
from app.config import get_settings
from app.rag import search
s=get_settings()
qs=["how do I apply for Erasmus to study abroad","European Solidarity Corps eligibility age",
    "do I need a visa to work in another EU country","free DiscoverEU pass for 18 year olds",
    "EHIC health card when travelling","recognition of my diploma abroad",
    "traineeships and internships in the EU","youth exchanges"]
async def go():
  for q in qs:
    r=await search(s,q,k=3)
    print("Q:",q)
    for x in r: print(f'   {x["score"]:.3f}  {x["title"][:55]:55}  <{x["url"][:55]}>')
    print()
asyncio.run(go())
PY
```
