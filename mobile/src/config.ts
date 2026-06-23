// App configuration.
//
// BACKEND_URL must be reachable FROM THE PHONE, so it can't be "localhost".
// Use your laptop's LAN IP (run `ipconfig` on Windows → IPv4 Address), e.g. 192.168.1.42.
// Both phone and laptop must be on the same Wi-Fi.

// PRODUCTION: backend hosted on Azure Container Apps (Sweden Central), reachable from
// anywhere over HTTPS. No Wi-Fi/adb needed.
export const BACKEND_URL = 'https://civictech-backend.jollyground-eead5389.swedencentral.azurecontainerapps.io';

// LOCAL DEV alternative: run the backend on the laptop and use one of these instead.
//   USB-connected phone: `adb reverse tcp:8000 tcp:8000`, then 'http://localhost:8000'.
//   Same Wi-Fi: laptop LAN IP, e.g. 'http://10.132.10.158:8000' (open port 8000 in firewall).
// export const BACKEND_URL = 'http://localhost:8000';

// OpenAI Realtime WebRTC SDP endpoint (model is set server-side at token mint).
export const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

// SUPABASE — real per-user accounts (sign-in / sign-up). Both values are PUBLIC client keys
// (the anon key is meant to ship in the app), so it's fine to keep them here like BACKEND_URL.
// Create a free project at https://supabase.com, then Project Settings → API for these two.
// The SAME project must be configured on the backend (SUPABASE_URL + SUPABASE_ANON_KEY +
// SUPABASE_SERVICE_ROLE_KEY) so it can validate tokens and store profiles. See
// deploy/supabase-setup.sql for the one-time table/RLS setup. Leaving the placeholders means
// the app falls back to local guest mode and the backend stays in single demo-user mode.
export const SUPABASE_URL = 'https://yennzufzradjhhlogwlq.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inllbm56dWZ6cmFkamhobG9nd2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDY2MTgsImV4cCI6MjA5Nzc4MjYxOH0.GRcaJ0CTfqFAzuyHSs5wUdhSj62GtzxWDvC6_QXFHeY';

// True once real Supabase values are filled in (used to decide whether to enforce sign-in).
export const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR-PROJECT') &&
  !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith('YOUR-');

// DEMO-DAY SAFETY: force the autopilot to fill the *bundled* copy of the ESC eligibility form
// (mobile/assets/eligibility.html) instead of loading youth.europa.eu live. Flip to `true` if
// conference Wi-Fi / the live site is unreliable — the form fills identically (injection targets
// the same element IDs). Even when `false`, the WebView auto-falls back to the cached copy if the
// live load errors or times out (see App.tsx). The bundled snapshot ships with the app.
export const USE_CACHED_FORM = false;
// How long to wait for the live form before auto-falling back to the cached copy (ms).
export const LIVE_FORM_TIMEOUT_MS = 8000;
