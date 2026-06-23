"""Backend configuration, read from environment (.env supported in dev)."""

import os
from functools import lru_cache

try:
    # Optional: load a local .env if python-dotenv is installed.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv is optional
    pass


class Settings:
    # Secret — the standard OpenAI API key. NEVER ships to the app.
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")

    # The Realtime model used for the voice brain (server-side only).
    realtime_model: str = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime-2")

    # The text model used for the in-app (typed) chat with RAG tools.
    chat_model: str = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o")

    # The mascot's voice (OpenAI Realtime voice id).
    realtime_voice: str = os.getenv("OPENAI_REALTIME_VOICE", "marin")

    # Speech speed for the output voice (1.0 = normal). Higher = faster talking.
    realtime_speed: float = float(os.getenv("OPENAI_REALTIME_SPEED", "1.3"))

    # --- Turn detection (server VAD) ---------------------------------------------------------
    # How sensitive the mic is to "the user started talking" (and thus when to interrupt Hoppy).
    # The OpenAI default (0.5) is twitchy: a cough, a door, keyboard clicks all trigger a barge-in.
    # We raise the threshold and lengthen the required silence so ONLY real, sustained speech
    # interrupts. near_field noise reduction further filters background hum before the VAD sees it.
    realtime_vad_threshold: float = float(os.getenv("OPENAI_REALTIME_VAD_THRESHOLD", "0.92"))
    realtime_vad_prefix_ms: int = int(os.getenv("OPENAI_REALTIME_VAD_PREFIX_MS", "300"))
    realtime_vad_silence_ms: int = int(os.getenv("OPENAI_REALTIME_VAD_SILENCE_MS", "750"))

    # Embedding model for the EU-knowledge RAG index (Phase 4).
    embedding_model: str = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    # Tavily key for live web_search constrained to europa.eu (Phase 4). Optional:
    # without it, web_search degrades gracefully to a "not configured" message.
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")

    # OpenAI endpoint to mint short-lived client secrets for the browser/mobile client.
    client_secrets_url: str = os.getenv(
        "OPENAI_CLIENT_SECRETS_URL",
        "https://api.openai.com/v1/realtime/client_secrets",
    )

    # CORS: comma-separated origins; "*" in dev. The mobile app uses no Origin header,
    # so this mainly matters if you also test from a web page.
    cors_origins: list[str] = (
        os.getenv("CORS_ORIGINS", "*").split(",") if os.getenv("CORS_ORIGINS") else ["*"]
    )

    # --- Supabase auth (real per-user accounts) ----------------------------------------------
    # Public project URL + anon key (the anon key is a CLIENT key — safe to ship in the app).
    # When BOTH are set, the backend ENFORCES auth: every /realtime, /tools, /docs and /chat
    # call must carry a valid `Authorization: Bearer <supabase access token>`. Without them the
    # backend stays in single demo-user mode, so the offline tests + no-auth dev flow still work.
    supabase_url: str = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    # Service-role key (SECRET — server only, NEVER ships to the app): lets the backend read and
    # write the per-user `profiles` table bypassing RLS. Optional: without it, per-user profiles
    # are kept only in memory (lost on restart) but everything else still works.
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Auth enforcement. Default is LENIENT: a request WITHOUT a bearer token falls back to the
    # demo user (so older app builds keep working against a shared backend), while a token that IS
    # present is still validated and scopes the user. Set AUTH_STRICT=true to require sign-in on
    # every protected call (clean separation, but old/anonymous clients get 401).
    auth_strict: bool = os.getenv("AUTH_STRICT", "false").strip().lower() in ("1", "true", "yes")

    @property
    def has_key(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def has_tavily(self) -> bool:
        return bool(self.tavily_api_key)

    @property
    def auth_enabled(self) -> bool:
        """True once Supabase is configured — auth is then required on protected endpoints."""
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def has_supabase_db(self) -> bool:
        """True when the backend can persist per-user profiles to Supabase Postgres."""
        return bool(self.supabase_url and self.supabase_service_role_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
