# 🐸 EU Youth Buddy — Demo-Day Runbook (Phase 7)

The single page to follow on stage. Goal: **survive conference Wi-Fi** and tell the whole story
even if `youth.europa.eu` or the network misbehaves.

## 0. The night before
- [ ] Charge the phone **and** the laptop. Bring cables + a power bank.
- [ ] Confirm the phone has the **dev client** build installed (not Expo Go).
- [ ] Record the backup video (see §5).
- [ ] Phone + laptop on the **same Wi-Fi** (or USB cable ready for the tethered path).

## 1. Boot the backend (one command)
```powershell
backend\run_demo.ps1
```
This: prints your LAN IP, runs `adb reverse tcp:8000 tcp:8000` (USB phone),
boots `uvicorn` on `0.0.0.0:8000`, **locks the demo profile (Maria)**, and **pre-warms the RAG DB**
with the rehearsed questions so the first live answer isn't a cold start.

- USB-tethered phone → leave `mobile/src/config.ts` `BACKEND_URL = 'http://localhost:8000'` (adb reverse).
- Untethered (same Wi-Fi) → set `BACKEND_URL` to the printed `http://<LAN-IP>:8000`, then rebuild/reload.
- Flags: `-NoProfile` (keep the saved profile), `-NoAdb` (LAN-IP path).

Sanity check from the laptop: `curl http://localhost:8000/health` → `openai_key` should be true.

## 2. The form: live vs cached (the key resilience switch)
The autopilot can fill either the **live** ESC form or a **bundled offline snapshot**
(`mobile/assets/eligibility.html`). It fills identically — injection targets the same field IDs.

- **Default (`USE_CACHED_FORM = false` in `mobile/src/config.ts`):** loads the live site, and
  **auto-falls back to the cached copy** if the live load errors or takes longer than
  `LIVE_FORM_TIMEOUT_MS` (8 s). You don't have to do anything.
- **If Wi-Fi is clearly bad before you start:** set `USE_CACHED_FORM = true` and reload — the form
  then always opens instantly from the bundle, no network needed for the autopilot.

> Voice (OpenAI Realtime) and RAG still need the network. Only the *form page* is cacheable.

## 3. Rehearsed demo script
1. **Login** → tap "Login with EU ID" (mocked) → land on the Hop hub.
2. **(Optional) Scan ID** → "📄 Scan my ID" → review → Save. *Skip live if Wi-Fi is shaky —
   the profile is already locked to Maria by `run_demo.ps1`.*
3. **Tap the mic** and ask, verbatim, the pre-warmed questions:
   - "How do I apply for Erasmus+ as a student?"
   - "Am I eligible for the European Solidarity Corps?"
   - "What is DiscoverEU and how do I get a travel pass?"
   - "Do I need a visa to work in another EU country?"
   - "What is the EHIC and what does it cover?"
   - "How do I get my diploma recognised in another EU country?"
4. **The wow:** "Open the Solidarity Corps form and sign me up." → Hop opens the form, the frog
   docks, and the **autopilot fills country + date of birth** from Maria's profile → **celebrate**.
5. Note the **citations**: Hop answers from official EU sources, not hallucinations.

## 4. Locked demo profile (Maria)
`run_demo.ps1` sets this so step 4 always has data even if you skip the live ID scan:

| Field | Value |
|---|---|
| name | Maria Popescu |
| country | Romania (→ Drupal code `RO`) |
| birthdate | 2006-05-14 |
| nationality | Romanian |

Re-lock at any time: `backend\run_demo.ps1` (or POST it to `/docs/profile`).

## 5. Backup recording (the ultimate fallback)
Record one clean full run (login → question → autopilot fill → celebrate) with screen mirroring
**before** the event. If the live network dies entirely, play the video — the story still lands.

## 6. If something breaks on stage
| Symptom | Fix |
|---|---|
| Form won't load / spins | It auto-falls back to cached after 8 s. Or pre-set `USE_CACHED_FORM = true`. |
| Phone can't reach backend | USB: re-run `adb reverse tcp:8000 tcp:8000`. Wi-Fi: re-check `BACKEND_URL` = LAN IP, firewall allows :8000. |
| Voice won't connect | Check `OPENAI_API_KEY` in `backend\.env`; `/health` `openai_key` true; mic permission granted. |
| RAG answers slow/empty | Re-run `run_demo.ps1` to pre-warm; confirm Chroma count > 0 (see `backend/README.md`). |
| Total network failure | Play the backup recording (§5). |

## 7. Device checklist (right before)
- [ ] Do Not Disturb / notifications **off**.
- [ ] Screen mirroring connected and tested.
- [ ] Brightness up, auto-lock long.
- [ ] Backend window open and showing READY (§1).
- [ ] One full dry run completed.
