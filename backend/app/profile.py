"""Per-user profiles that power the autopilot.

Each signed-in user (keyed by their Supabase user id / `sub`) has their own profile. The
demo/guest user ("demo") preserves the original single-user behaviour when auth is OFF, so the
offline tests and no-auth dev flow keep working.

Storage: an in-memory cache, written through to a Supabase Postgres `profiles` table when
Supabase is configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). That makes profiles real
per-user records that survive restarts. Without that config it's purely in-memory.

`country` is the Drupal <option> value for the ESC eligibility form (e.g. "RO"), and
`birthdate` is an ISO date for <input type=date>. See app/countries.py / countryOptions.ts.
"""

import logging
from typing import Optional, TypedDict

import httpx

from .config import Settings, get_settings
from .countries import resolve_country_code

log = logging.getLogger("youthbuddy.profile")


class Profile(TypedDict):
    name: str
    country: str  # ESC dropdown option value, e.g. "RO"
    birthdate: str  # "yyyy-mm-dd"
    nationality: str


DEMO_PROFILE: Profile = {
    "name": "Maria Ionescu",
    "country": "RO",
    "birthdate": "2006-05-14",
    "nationality": "Romanian",
}

# The implicit user id used when auth is off (single-user mode).
DEMO_USER_ID = "demo"

# user_id -> Profile. Acts as a cache in front of Supabase (and the only store when Supabase
# isn't configured). The demo user is implicit: absent here it falls back to DEMO_PROFILE.
_cache: dict[str, Profile] = {}


def get_demo_profile() -> Profile:
    return DEMO_PROFILE


def normalize_profile(
    name: str = "",
    country: str = "",
    birthdate: str = "",
    nationality: str = "",
) -> Profile:
    """Clean + normalise fields into a Profile (country name -> Drupal code). Does NOT store."""
    return {
        "name": (name or "").strip(),
        "country": resolve_country_code((country or "").strip()),
        "birthdate": (birthdate or "").strip(),
        "nationality": (nationality or "").strip(),
    }


# ---- Supabase persistence (optional) --------------------------------------------------------
# We talk to PostgREST directly with the service-role key. Synchronous httpx is fine here: the
# calls are quick and the endpoints that use them are low-traffic; keeping them sync avoids
# rippling async through every caller. Failures degrade to the in-memory cache (logged).

_PROFILE_COLS = "name,country,birthdate,nationality"


def _db_headers(settings: Settings) -> dict[str, str]:
    key = settings.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _db_get(settings: Settings, user_id: str) -> Optional[Profile]:
    url = f"{settings.supabase_url}/rest/v1/profiles"
    params = {"user_id": f"eq.{user_id}", "select": _PROFILE_COLS, "limit": "1"}
    try:
        r = httpx.get(url, headers=_db_headers(settings), params=params, timeout=10.0)
        if r.status_code == 200:
            rows = r.json()
            if rows:
                row = rows[0]
                return {
                    "name": row.get("name") or "",
                    "country": row.get("country") or "",
                    "birthdate": row.get("birthdate") or "",
                    "nationality": row.get("nationality") or "",
                }
        else:
            log.warning("profile db read (%s): %s", r.status_code, r.text[:200])
    except httpx.HTTPError as e:
        log.warning("profile db read failed: %s", e)
    return None


def _db_upsert(settings: Settings, user_id: str, profile: Profile) -> None:
    url = f"{settings.supabase_url}/rest/v1/profiles"
    # merge-duplicates => upsert on the primary key (user_id).
    headers = {**_db_headers(settings), "Prefer": "resolution=merge-duplicates"}
    body = {"user_id": user_id, **profile}
    try:
        r = httpx.post(url, headers=headers, json=body, timeout=10.0)
        if r.status_code >= 400:
            log.warning("profile db upsert (%s): %s", r.status_code, r.text[:200])
    except httpx.HTTPError as e:
        log.warning("profile db upsert failed: %s", e)


# ---- Public API -----------------------------------------------------------------------------


def get_active_profile(user_id: str = DEMO_USER_ID) -> Profile:
    """The profile the autopilot fills for this user (their saved one, else the demo user)."""
    if user_id in _cache:
        return _cache[user_id]
    if user_id != DEMO_USER_ID:
        settings = get_settings()
        if settings.has_supabase_db:
            stored = _db_get(settings, user_id)
            if stored is not None:
                _cache[user_id] = stored
                return stored
    return DEMO_PROFILE


def set_active_profile(
    user_id: str = DEMO_USER_ID,
    *,
    name: str = "",
    country: str = "",
    birthdate: str = "",
    nationality: str = "",
) -> Profile:
    """Store this user's confirmed profile (country normalised). Writes through to Supabase."""
    profile = normalize_profile(name, country, birthdate, nationality)
    _cache[user_id] = profile
    if user_id != DEMO_USER_ID:
        settings = get_settings()
        if settings.has_supabase_db:
            _db_upsert(settings, user_id, profile)
    return profile


def clear_active_profile(user_id: Optional[str] = None) -> None:
    """Forget cached profile(s). None clears the whole cache (used by tests)."""
    if user_id is None:
        _cache.clear()
    else:
        _cache.pop(user_id, None)
