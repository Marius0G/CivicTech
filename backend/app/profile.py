"""Per-user profiles that power the autopilot.

Each signed-in user (keyed by their Supabase user id / `sub`) has their own profile. The
demo/guest user ("demo") preserves the original single-user behaviour when auth is OFF, so the
offline tests and no-auth dev flow keep working.

Storage: an in-memory cache, written through to a Supabase Postgres `profiles` table when
Supabase is configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). That makes profiles real
per-user records that survive restarts. Without that config it's purely in-memory.

The fields mirror the visible data on a Romanian identity card (carte de identitate) — name,
CNP, sex, place of birth, address, document series/number, issuer and validity — plus `country`
(the Drupal <option> value for the ESC eligibility form, e.g. "RO") and `birthdate` (an ISO date
for <input type=date>). See app/countries.py / countryOptions.ts.

EU DATA RESIDENCY: these values live only here and in Supabase (an EU region) and are inserted
straight into web forms on the user's device. They are NEVER put into the LLM's context — the
model only ever learns WHICH fields are on file (see `profile_manifest`), never their values.
"""

import logging
from typing import Optional, TypedDict

import httpx

from .config import Settings, get_settings
from .countries import resolve_country_code

log = logging.getLogger("youthbuddy.profile")


class Profile(TypedDict):
    name: str  # full name (Nume + Prenume)
    first_name: str  # Prenume
    last_name: str  # Nume
    cnp: str  # Cod Numeric Personal
    sex: str  # M / F
    birthdate: str  # "yyyy-mm-dd" (Data nașterii)
    place_of_birth: str  # Loc naștere
    nationality: str  # Cetățenie
    country: str  # ESC dropdown option value, e.g. "RO"
    address: str  # Domiciliu
    series: str  # Seria
    doc_number: str  # Număr
    issued_by: str  # Emisă de (SPCLEP …)
    issue_date: str  # Data eliberării, "yyyy-mm-dd"
    expiry_date: str  # Valabilitate, "yyyy-mm-dd"


# Canonical field order — drives the DB column list, the vision extraction, and the field
# manifest exposed to the model. `name`/`country` are app-level; the rest are ID-card fields.
PROFILE_FIELDS: tuple[str, ...] = (
    "name",
    "first_name",
    "last_name",
    "cnp",
    "sex",
    "birthdate",
    "place_of_birth",
    "nationality",
    "country",
    "address",
    "series",
    "doc_number",
    "issued_by",
    "issue_date",
    "expiry_date",
)

_EMPTY_PROFILE: Profile = {f: "" for f in PROFILE_FIELDS}  # type: ignore[assignment]


def blank_profile() -> Profile:
    """A fresh, all-empty profile. New users start here and fill it from their ID photo."""
    return dict(_EMPTY_PROFILE)  # type: ignore[return-value]


# The implicit user id used when auth is off (single-user mode).
DEMO_USER_ID = "demo"

# user_id -> Profile. Acts as a cache in front of Supabase (and the only store when Supabase
# isn't configured). A user absent here has no saved data yet, so they get a blank profile.
_cache: dict[str, Profile] = {}


def normalize_profile(**fields: str) -> Profile:
    """Clean + normalise the given fields into a full Profile. Unknown keys are ignored; missing
    ones default to "". `country` is mapped name -> Drupal code; `name` is derived from
    first/last when blank. Does NOT store."""
    out: Profile = {**_EMPTY_PROFILE}  # type: ignore[assignment]
    for key in PROFILE_FIELDS:
        out[key] = str(fields.get(key) or "").strip()  # type: ignore[literal-required]
    out["country"] = resolve_country_code(out["country"])
    if not out["name"] and (out["first_name"] or out["last_name"]):
        out["name"] = " ".join(p for p in (out["first_name"], out["last_name"]) if p)
    return out


def profile_manifest(profile: Profile) -> dict[str, list[str]]:
    """Field NAMES only — which of the user's details are on file vs. missing. This is the only
    profile shape the LLM ever sees; it deliberately contains no values (EU data residency)."""
    on_file = [f for f in PROFILE_FIELDS if (profile.get(f) or "").strip()]
    missing = [f for f in PROFILE_FIELDS if not (profile.get(f) or "").strip()]
    return {"fields_on_file": on_file, "fields_missing": missing}


# ---- Supabase persistence (optional) --------------------------------------------------------
# We talk to PostgREST directly with the service-role key. Synchronous httpx is fine here: the
# calls are quick and the endpoints that use them are low-traffic; keeping them sync avoids
# rippling async through every caller. Failures degrade to the in-memory cache (logged).

_PROFILE_COLS = ",".join(PROFILE_FIELDS)


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
                return {f: row.get(f) or "" for f in PROFILE_FIELDS}  # type: ignore[return-value]
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
    """The profile the autopilot fills for this user: their saved one, else a blank profile.

    There is no default/demo data — until the user scans their ID (or saves a profile), every
    field is empty, so the autopilot has nothing to fill and the model's manifest shows the
    fields as missing.
    """
    if user_id in _cache:
        return _cache[user_id]
    if user_id != DEMO_USER_ID:
        settings = get_settings()
        if settings.has_supabase_db:
            stored = _db_get(settings, user_id)
            if stored is not None:
                _cache[user_id] = stored
                return stored
    return blank_profile()


def set_active_profile(user_id: str = DEMO_USER_ID, **fields: str) -> Profile:
    """Store this user's confirmed profile (country normalised). Writes through to Supabase.

    Accepts any subset of PROFILE_FIELDS as keyword args; the rest default to "".
    """
    profile = normalize_profile(**fields)
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
