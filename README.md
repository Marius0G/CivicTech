# 🐸 EU Youth Buddy

> A mobile app where EU youth talk **by voice** to a friendly frog mascot that answers
> questions about EU opportunities from trusted sources — and then **acts**, driving an
> in-app browser to fill out the sign-up form for them.

Built for an EU Civic Tech hackathon. This README is the single source of truth for the
concept, decisions, architecture, and stack. See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
for the ordered build steps.

---

## 1. The problem & the idea

**Problem (sharpened):** EU youth **can't find** the opportunities, rights, and funding the
EU offers them. The info exists but is scattered across dozens of bureaucratic portals in
heavy language.

**The idea:** A buddy that doesn't just *explain* — it **acts**.
1. **Talk to it by voice** — a friendly frog mascot, low emotional barrier, plain language.
2. **Trustworthy answers** — Retrieval-Augmented Generation (RAG) over indexed official EU
   sources + live web search constrained to `europa.eu`.
3. **Autopilot** — it opens an in-app browser and **fills out the real sign-up form for you**,
   using info extracted from documents you uploaded.

**Differentiator:** *action + personalization + low emotional barrier* — not chat for its own sake.

---

## 2. The hero flow (what we demo)

**Persona:** Maria, 19, Romania.

1. Opens the app → taps **"Login with EU ID"** (a *mocked* EU Login screen) → single demo user.
2. Frog greets her **by voice**. She says: *"I want to go abroad but don't know what's out there."*
   → frog calls `search_eu_info` → explains **Erasmus+** & **European Solidarity Corps** in plain,
   personalized language.
3. *"How do I sign up?"* → frog: *"I can do that with you right now."* → opens the **European
   Solidarity Corps eligibility check** in the in-app browser.
4. Because Maria uploaded her ID earlier (→ parsed into a profile), the frog calls `fill_form`
   → the **country + date-of-birth fields populate live on screen**. She reviews & submits.
5. Frog encourages her — the emotional "bond" beat. End.

### The verified hero form ✅

`https://youth.europa.eu/solidarity/register/check_en` — the **European Solidarity Corps
Eligibility Check**. Probed and confirmed:

- **Public**: no login, returns HTTP 200 directly (no redirect to EU Login).
- **Two fields only**, with stable Drupal selectors:

| Field | Selector | HTML name | Type |
|---|---|---|---|
| Country of residence | `#edit-address-country` | `address_country` | `<select>` dropdown |
| Date of birth | `#edit-birthdate` | `birthdate` | `<input type="date">` |
| Submit | `#edit-submit` | `op` (value `Submit`) | submit button |

> ⚠️ The **full registration** (after eligibility) redirects to **EU Login** (email →
> password → mandatory MFA). That part is **not** demoable live — we mock the EU Login screen
> and present real eIDAS integration as roadmap.

---

## 3. Architecture

```
React Native (Expo dev client)  ── mobile app ──
 ├─ Rive frog mascot      ← lip-sync driven by Realtime audio amplitude
 ├─ WebRTC ───────────►  OpenAI Realtime API  ◄── THE BRAIN (GPT-4o, function-calling)
 │                              │ emits tool calls (over the WebRTC data channel)
 │             ┌────────────────┴────────────────────┐
 │      CLIENT-SIDE tools                      SERVER-SIDE tools
 │      (run in the app)                       (run on FastAPI)
 │      • fill_form(fields)  ── inject JS ──►   • search_eu_info(query) → Chroma (RAG)
 │      • open_form(url)        into WebView    • web_search(query)     → Tavily
 │      • read_page()                           • get_profile()         → OCR'd doc data
 └─ WebView (WKWebView /                        • POST /realtime/token  → mint ephemeral token
      Android WebView)                          • POST /docs/upload     → GPT-4o vision → JSON
      loads the eligibility form
```

### The single most important correctness rule

**Tools execute in two different places.** With Realtime-as-brain, the model emits function
calls but *you* decide where each runs:

- `search_eu_info`, `web_search`, `get_profile` → **FastAPI backend**.
- `fill_form`, `open_form`, `read_page` → **client-side in the app**, because that's where the
  WebView and its DOM live. The Realtime function-call event arrives over the WebRTC data
  channel; the RN app intercepts it, injects JS into its WebView, and returns the result.

> ❌ Do **not** try to fill the form from the server — the server cannot see the phone's WebView.

### Why a WebView works (and frame headers don't stop us)

`X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'` (both present on
`youth.europa.eu`) only block embedding inside an **`<iframe>`**. A mobile **WebView loads the
page as the top-level document**, so these headers do not apply. We can load the page and
inject JavaScript freely.

---

## 4. Tech stack (locked decisions)

| Layer | Choice | Notes |
|---|---|---|
| App shell | **React Native + Expo dev client** | NOT Expo Go — we need native WebRTC, Rive, WebView modules |
| Mascot | **Rive** | idle / talking / emote state machine; amplitude-driven lip-sync |
| Voice + brain | **OpenAI Realtime API (GPT-4o)** over WebRTC | Realtime *is* the brain; it function-calls our tools |
| Backend | **Python FastAPI** | ephemeral token minting, RAG, doc OCR, profile store |
| RAG store | **Chroma** (in-process) | tiny scraped corpus; OpenAI embeddings |
| RAG corpus | **European Youth Portal + Erasmus+ + Solidarity Corps** pages | ~20–50 curated pages; tight = accurate |
| Web search | **Tavily** | constrained to official `europa.eu` domains |
| Doc vault | Backend storage + **GPT-4o vision → structured JSON profile** | upload ID/transcript → fields for `fill_form` |
| Autopilot | In-app **WebView + injected JS** | DOM read/fill via `injectedJavaScript` |
| Auth | **No auth, single demo user** + mocked EU Login screen | real eIDAS = roadmap |

**Known accepted risks / tradeoffs**

- **Best-model tradeoff:** we use the strongest hosted models (OpenAI Realtime/GPT-4o) for the
  demo; production would need EU-region hosting / data residency. Say this on stage — it turns a
  weakness into a maturity signal.
- **EU Login is mocked** (unverified for real integration this weekend) — acceptable for a demo.
- **Emotional bond / AI Act:** the frog is a *friendly, transparent* helper. It **never claims
  to be human** and discloses it's an AI. That disclosure is your AI-Act shield — keep it.

---

## 5. The mascot

A friendly **frog** character (e.g. "Hop"). Warm, encouraging, plain-language, a little
playful — **never cringe, never pretends to be human**. Rendered in **Rive** with at least
three states: `idle`, `talking` (mouth driven by Realtime audio amplitude), `celebrate`
(used on the success beat).

---

## 6. The `fill_form` payload (concrete)

Client-side tool. When Realtime calls `fill_form`, the app injects JS into the WebView. For the
verified eligibility form, the injection is literally:

```js
// injected into the WebView running youth.europa.eu/solidarity/register/check_en
(function (profile) {
  // profile = { country: "RO", birthdate: "2006-05-14" } from the user's parsed documents
  const country = document.querySelector('#edit-address-country');
  if (country) {
    country.value = profile.country;                 // ISO/Drupal option value
    country.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const dob = document.querySelector('#edit-birthdate');
  if (dob) {
    dob.value = profile.birthdate;                    // yyyy-mm-dd for <input type=date>
    dob.dispatchEvent(new Event('input', { bubbles: true }));
    dob.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return true;                                        // (do NOT auto-submit; let the user click)
})(__PROFILE__);
```

> Let the **user** press Submit — it's more trustworthy on stage and avoids accidental real
> submissions. Map the country dropdown's option values first (read them via `read_page`).

---

## 7. Backend tool contracts (FastAPI)

| Endpoint / tool | Runs | Purpose |
|---|---|---|
| `POST /realtime/token` | server | Mint an OpenAI **ephemeral** Realtime session token (key never ships to the app) |
| `search_eu_info(query)` | server | Embed → query Chroma → return top chunks + source URLs (for citations) |
| `web_search(query)` | server | Tavily, `allowed_domains=["europa.eu"]` |
| `POST /docs/upload` | server | Image → GPT-4o vision → `{name, birthdate, country, nationality, ...}` JSON profile |
| `get_profile()` | server | Return the stored demo-user profile for `fill_form` |
| `fill_form(fields)` | **client** | Inject JS into WebView (see §6) |
| `open_form(url)` | **client** | Navigate the in-app WebView |
| `read_page()` | **client** | Return field names / dropdown option values from the DOM |

---

## 8. Demo-day safety (READ THIS)

⚠️ The current plan is **"wing it live."** Four live dependencies on conference wifi (app →
FastAPI → OpenAI Realtime over WebRTC → live Youth Portal) is the **biggest avoidable risk.**
Strongly recommended hardening (none of it changes how real the demo looks):

1. **Run FastAPI locally** on the laptop on the same network — removes one external hop.
2. **Cache the eligibility page** (save the HTML/assets, serve from the backend or bundle) so
   autopilot works even if the site is slow/down.
3. Have a **recorded backup run** ready to play if WebRTC drops.
4. **Pre-warm** the RAG index and test the exact demo questions beforehand.

See the plan for where these fit.

---

## 9. Sources

- [Login or register — European Youth Portal](https://youth.europa.eu/solidarity/register_en)
- [Eligibility check — European Youth Portal](https://youth.europa.eu/solidarity/register/check_en)
- [EU Login — European Commission Authentication Service](https://wikis.ec.europa.eu/display/NAITDOC/EU+Login+-+European+Commission+Authentication+Service)
- [European Youth Portal — home](https://youth.europa.eu/home_en)
