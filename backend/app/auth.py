"""Supabase-based authentication for the backend.

When SUPABASE_URL + SUPABASE_ANON_KEY are configured the backend ENFORCES auth: every
protected request must carry `Authorization: Bearer <supabase access token>`. We validate
that token by calling Supabase's own `/auth/v1/user` introspection endpoint. Doing it this
way (rather than verifying the JWT locally) is:
  • algorithm-agnostic — works whether the project signs tokens with the legacy HS256 secret
    or the newer asymmetric (ES256/RS256) keys, and
  • zero-extra-config — it reuses the same URL + anon key the app already has; there's no JWT
    secret to copy into the server.
Validated users are cached for a few minutes so one voice session's burst of tool calls
doesn't introspect on every single call.

When Supabase isn't configured the backend runs in single demo-user mode (id "demo"), so the
offline tests and the no-auth dev flow keep working unchanged.
"""

import time
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import Header, HTTPException

from .config import Settings, get_settings


@dataclass(frozen=True)
class User:
    id: str
    email: Optional[str] = None


# The implicit user when auth is off — keeps the original single-profile behaviour.
DEMO_USER = User(id="demo", email=None)

# access-token -> (expiry_monotonic, User). The token itself carries the real expiry; this is
# just a short local cache to avoid re-introspecting on every tool call within a session.
_cache: dict[str, tuple[float, User]] = {}
_CACHE_TTL = 300.0


def _bearer(authorization: Optional[str]) -> Optional[str]:
    """Pull the token out of an `Authorization: Bearer <token>` header (case-insensitive)."""
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def _introspect(settings: Settings, token: str) -> User:
    """Ask Supabase who this token belongs to. Raises HTTPException on invalid/unreachable."""
    url = f"{settings.supabase_url}/auth/v1/user"
    headers = {"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"}
    try:
        resp = httpx.get(url, headers=headers, timeout=10.0)
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Auth service unreachable")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    data = resp.json()
    uid = data.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid session")
    return User(id=uid, email=data.get("email"))


def get_current_user(authorization: Optional[str] = Header(default=None)) -> User:
    """FastAPI dependency: the signed-in user.

    Returns the demo user when auth is not configured (so tests/dev work). When Supabase IS
    configured: a present token is validated (invalid => 401); a MISSING token falls back to the
    demo user in lenient mode (default) or 401 in strict mode (AUTH_STRICT=true).
    """
    settings = get_settings()
    if not settings.auth_enabled:
        return DEMO_USER

    token = _bearer(authorization)
    if not token:
        # Lenient (default): anonymous/old clients fall back to the demo user. Strict: 401.
        if settings.auth_strict:
            raise HTTPException(status_code=401, detail="Sign in required")
        return DEMO_USER

    now = time.monotonic()
    hit = _cache.get(token)
    if hit and hit[0] > now:
        return hit[1]

    user = _introspect(settings, token)
    _cache[token] = (now + _CACHE_TTL, user)
    return user
