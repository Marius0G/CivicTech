# 🐸 EU Youth Buddy — mobile app

The real app (the [`../spike-webview-autopilot`](../spike-webview-autopilot) folder is just the
Phase 0 proof and stays frozen at that scope). Pairs with [`../backend`](../backend).

## Status

- **Phase 2 ✅ (this):** the function-call bridge. Hoppy calls tools → the app routes them
  (client → WebView, server → FastAPI) → results return into the conversation. Proven by
  `npm run verify` (14/14 checks; injected JS runs against the real form in jsdom).
- **Phase 1 ✅:** voice via OpenAI Realtime — "Talk to Hoppy".
- **Phase 0 carried in:** `src/injection.ts` + `src/countryOptions.ts` (the proven autopilot).

## Requires a dev client (NOT Expo Go)

`react-native-webrtc` is a native module, so Expo Go can't run this — you build a dev client.
You'll need the Android toolchain set up (JDK 17, Android Studio SDK, `adb`).

```bash
cd mobile
npm install
# set your laptop's LAN IP in src/config.ts (BACKEND_URL), and start ../backend first
npx expo run:android      # builds + installs the dev client on emulator/phone
# or: npx expo run:ios    (needs a Mac)
```

If `npm install` flags version mismatches, let Expo reconcile native versions:

```bash
npx expo install react-native-webview react-native-webrtc expo-dev-client
```

## Before you run

1. **Start the backend** (`../backend`) with your `OPENAI_API_KEY` in `.env`, on `0.0.0.0:8000`.
2. **Set `BACKEND_URL`** in `src/config.ts` to your laptop's LAN IP (`ipconfig` → IPv4).
3. Phone + laptop on the **same Wi-Fi**.

## Phase 1 checkpoint

Tap **🎙 Talk to Hoppy** → grant mic → you should hear Hoppy greet you and be able to talk
back and forth. (For voice, a **physical phone** beats the emulator — better mic/audio.)

## Files

| File | Role |
|---|---|
| `App.tsx` | Voice button + WebView; correlates injection results, routes function calls |
| `src/realtime.ts` | WebRTC to OpenAI Realtime; sends tools via session.update, surfaces function calls |
| `src/tools.ts` | Tool schemas + `executeTool` router (client → WebView, server → FastAPI) |
| `src/config.ts` | `BACKEND_URL` (your LAN IP) + OpenAI calls URL |
| `src/injection.ts` | WebView form fill + read (proven in the spike) |
| `src/countryOptions.ts` | Country dropdown value map (Greece = `EL`) |
| `verify-tools.mjs` | `npm run verify` — Phase 2 bridge proof (no device needed) |

## Phase 2 checkpoint

Connect, then say: *"open the solidarity corps form and sign me up."* Hoppy should call
`open_form` → `fill_form` (pulling your saved profile), and the country + DOB fill on screen.
The `🛠` line under the status shows which tool fired.

## Note on the two `injection.ts` copies

`src/injection.ts` is copied from the spike on purpose — the spike stays an independent,
frozen proof. If the form's fields ever change, update both (or later, hoist to a shared
package). It's verified by the spike's `verify-injection.mjs`.
