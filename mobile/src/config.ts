// App configuration.
//
// BACKEND_URL must be reachable FROM THE PHONE, so it can't be "localhost".
// Use your laptop's LAN IP (run `ipconfig` on Windows → IPv4 Address), e.g. 192.168.1.42.
// Both phone and laptop must be on the same Wi-Fi.

// USB-connected phone: we run `adb reverse tcp:8000 tcp:8000`, so the phone reaches the
// laptop backend at localhost:8000. (Untethered alternative: use the laptop Wi-Fi IP, e.g.
// http://10.132.10.158:8000, with both on the same Wi-Fi and port 8000 allowed by firewall.)
export const BACKEND_URL = 'http://localhost:8000';

// OpenAI Realtime WebRTC SDP endpoint (model is set server-side at token mint).
export const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
