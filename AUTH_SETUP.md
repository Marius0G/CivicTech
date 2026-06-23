# Auth — real per-user accounts (Supabase)

This replaces the mocked EU-ID login with **real, separate user accounts** while keeping the
existing EU-ID look. It works on **both** the native (Expo) and web (react-native-web) builds.

## Why Supabase (the spike conclusion)

We researched the **official EU Login (ECAS)** first. It's technically integratable (OpenID
Connect / SAML / CAS) and is the same account used for the Youth Portal / Erasmus+ / ESC — but
there is **no self-service developer console**. You register a service by emailing the EC DIGIT
helpdesk, a human approves it, and PRODUCTION approval realistically isn't attainable in a
hackathon window. So we built on **standard OpenID Connect / JWT** with Supabase as the provider:
real users today, EU region available, and EU Login can be swapped in later as just another OIDC
provider (config change, not a rewrite). See the chat history / spike notes for the full writeup.

## What changed

- **Backend** (`backend/app/`)
  - `auth.py` — validates the Supabase access token via Supabase's `/auth/v1/user` introspection
    (algorithm-agnostic, no JWT secret to copy). Falls back to a single demo user when Supabase
    isn't configured, so offline tests + no-auth dev still work.
  - `profile.py` — profiles are now **per user** (keyed by Supabase user id), cached in memory and
    written through to the Supabase `profiles` table when configured.
  - `/realtime/token`, `/tools/*`, `/docs/*`, `/chat` now require a valid bearer token (when auth
    is enabled) and scope the profile to that user.
- **Mobile** (`mobile/src/`)
  - `supabase.ts` — the client + `authHeaders()` helper (works on native & web).
  - `LoginScreen.tsx` — real email/password sign-in + sign-up, and "guest" = anonymous session.
  - `App.tsx` — the auth gate follows the Supabase session; every backend call sends the token.
- **`deploy/supabase-setup.sql`** — the one-time `profiles` table + RLS.

## Setup (≈10 min)

1. Create a free project at <https://supabase.com> (pick an **EU region** for the GDPR story).
2. **SQL editor** → paste `deploy/supabase-setup.sql` → Run.
3. **Project Settings → API**: copy the **Project URL**, the **anon** key, and the **service_role**
   key.
4. **Mobile** — `mobile/src/config.ts`: set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. **Backend** — set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in
   `backend/.env` (local) and in the Azure Container App env (prod). See `backend/.env.example`.
6. *(Optional)* **Authentication → Providers → Anonymous**: enable it to make "Explore as guest"
   work. You can also enable Google here and it'll appear as a normal OIDC option.

Until you fill these in, the app stays on the **mock login** and the backend on **single
demo-user** mode — so nothing breaks before configuration.

## Verify

- Backend: `cd backend && .venv/Scripts/python.exe test_phase3.py` (and `test_phase4.py`) — pass
  with auth off (demo fallback).
- Mobile: `cd mobile && npx tsc --noEmit && npm run verify` — green.
- End-to-end (after setup): sign up two different emails, set a different ID/profile on each,
  confirm each session's `get_profile` / form-fill uses its **own** saved profile.
