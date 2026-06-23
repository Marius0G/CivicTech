# 🐸 Phase 0 spike — WebView autopilot

> **Scope:** this folder is a **frozen Phase 0 proof** — WebView + form-fill only, nothing else.
> The real app lives in [`../mobile`](../mobile) and the backend in [`../backend`](../backend).
> Do not add voice/RAG/etc. here; it exists to prove one trick and stay simple.

Proves the load-bearing trick of the whole product: **load the real EU form in a WebView and
fill it from injected JS.** Target = the public [European Solidarity Corps eligibility check](https://youth.europa.eu/solidarity/register/check_en)
(`#edit-address-country` + `#edit-birthdate`, no login).

## What's here

| File | Purpose |
|---|---|
| `App.tsx` | The spike: WebView + an "Autopilot fill" button + result listener |
| `src/injection.ts` | `fillEligibilityForm()` + `buildInjectedJavaScript()` — the real fill logic (shared by app & test) |
| `src/countryOptions.ts` | All 255 country dropdown values pulled from the live form (note: Greece = `EL`) |
| `verify-injection.mjs` | Device-independent proof: runs the injection against the real HTML in jsdom |
| `fixtures/eligibility.html` | Snapshot of the real page (also your Phase 7 offline cache) |

## ✅ Already proven (no device needed)

The injection logic is verified against the real form markup:

```
✅ country <select> found & set      ✅ DOM value of country is "RO"
✅ country resolved to Romania       ✅ DOM value of birthdate is set
✅ birthdate <input> found & set     ✅ no errors reported
   → Phase 0 proof PASSED
```

Re-run it yourself (needs `jsdom` + `typescript`):

```bash
npm install            # installs everything, incl. the two dev deps
npm run verify         # runs verify-injection.mjs
```

## ▶️ Run on a real phone (the on-device checkpoint)

This spike only uses `react-native-webview`, so **it runs in Expo Go — no dev build needed yet.**
(The dev client becomes necessary in Phase 1+ when WebRTC / Rive are added.)

1. Install [Expo Go](https://expo.dev/go) on your phone.
2. In this folder:
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code with Expo Go (Android) / the Camera app (iOS).
4. Wait for the EU form to load, then tap **"🐸 Autopilot fill"**.
5. **Expected:** the Country field jumps to *Romania* and Date of birth to *2006-05-14*, and the
   header shows `✅ Filled: Romania + DOB 2006-05-14`.

That green check on a physical phone is the Phase 0 checkpoint. The fill data is hardcoded in
`DEMO_PROFILE` (App.tsx) — Phase 3 will replace it with data extracted from an uploaded ID.

## Note on versions

`package.json` pins an Expo SDK 52 set. If `npm install` complains about mismatches, let Expo
reconcile native module versions:

```bash
npx expo install react-native-webview
```
