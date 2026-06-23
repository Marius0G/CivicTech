"""Light, NON-sensitive user preferences — separate from the ID-card profile.

Unlike `profile.py` (Romanian-ID / form data that must stay private in the EU and is NEVER
shown to the model), preferences are casual, non-sensitive facts the user volunteers in
conversation — e.g. "prefers warm climates", "into the environment". Because they carry no
data-residency weight, their VALUES are given to the model so Hop can personalise
suggestions. They are deliberately a different store with a different privacy contract.

Storage mirrors `profile.py`: an in-memory cache, written through to a Supabase `preferences`
jsonb column on the per-user `profiles` row when Supabase is configured. Without it, purely
in-memory. The demo/guest user ("demo") stays in-memory only, like the demo profile.

Keep it small on purpose: this is a demo, so Hop asks at most one light question (see
persona.py). We don't model a fixed schema — it's a free key->value map (e.g.
{"climate": "warm"}), so adding a new preference later needs no migration.
"""

import logging

import httpx

from .config import Settings, get_settings
from .profile import DEMO_USER_ID

log = logging.getLogger("youthbuddy.preferences")

# A user's preferences are a small flat map of short strings, e.g. {"climate": "warm"}.
Preferences = dict[str, str]

# user_id -> Preferences. Cache in front of Supabase (and the only store without it).
_cache: dict[str, Preferences] = {}


def _clean(prefs: object) -> Preferences:
    """Coerce arbitrary stored/incoming data into a tidy {str: str} map (skip empties)."""
    if not isinstance(prefs, dict):
        return {}
    out: Preferences = {}
    for k, v in prefs.items():
        key = str(k).strip().lower()
        val = str(v).strip()
        if key and val:
            out[key] = val
    return out


# ---- Supabase persistence (optional) --------------------------------------------------------
# Same approach as profile.py: PostgREST + service-role key, synchronous httpx, degrade to the
# in-memory cache on failure. Preferences live in a `preferences` jsonb column on `profiles`.


def _db_headers(settings: Settings) -> dict[str, str]:
    key = settings.supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _db_get(settings: Settings, user_id: str) -> Preferences | None:
    url = f"{settings.supabase_url}/rest/v1/profiles"
    params = {"user_id": f"eq.{user_id}", "select": "preferences", "limit": "1"}
    try:
        r = httpx.get(url, headers=_db_headers(settings), params=params, timeout=10.0)
        if r.status_code == 200:
            rows = r.json()
            if rows:
                return _clean(rows[0].get("preferences"))
        else:
            log.warning("preferences db read (%s): %s", r.status_code, r.text[:200])
    except httpx.HTTPError as e:
        log.warning("preferences db read failed: %s", e)
    return None


def _db_upsert(settings: Settings, user_id: str, prefs: Preferences) -> None:
    url = f"{settings.supabase_url}/rest/v1/profiles"
    # merge-duplicates => upsert on the primary key (user_id); only touches `preferences`.
    headers = {**_db_headers(settings), "Prefer": "resolution=merge-duplicates"}
    body = {"user_id": user_id, "preferences": prefs}
    try:
        r = httpx.post(url, headers=headers, json=body, timeout=10.0)
        if r.status_code >= 400:
            log.warning("preferences db upsert (%s): %s", r.status_code, r.text[:200])
    except httpx.HTTPError as e:
        log.warning("preferences db upsert failed: %s", e)


# ---- Public API -----------------------------------------------------------------------------


def get_preferences(user_id: str = DEMO_USER_ID) -> Preferences:
    """This user's saved light preferences (empty map if none yet)."""
    if user_id in _cache:
        return _cache[user_id]
    if user_id != DEMO_USER_ID:
        settings = get_settings()
        if settings.has_supabase_db:
            stored = _db_get(settings, user_id)
            if stored is not None:
                _cache[user_id] = stored
                return stored
    return {}


def save_preference(user_id: str, key: str, value: str) -> Preferences:
    """Merge one {key: value} preference into this user's map and persist it. Returns the map.

    An empty value removes the key (lets Hop correct a mistaken preference).
    """
    key = str(key or "").strip().lower()
    value = str(value or "").strip()
    if not key:
        return get_preferences(user_id)
    prefs = dict(get_preferences(user_id))
    if value:
        prefs[key] = value
    else:
        prefs.pop(key, None)
    _cache[user_id] = prefs
    if user_id != DEMO_USER_ID:
        settings = get_settings()
        if settings.has_supabase_db:
            _db_upsert(settings, user_id, prefs)
    return prefs


def clear_preferences(user_id: str | None = None) -> None:
    """Forget cached preferences. None clears the whole cache (used by tests)."""
    if user_id is None:
        _cache.clear()
    else:
        _cache.pop(user_id, None)
