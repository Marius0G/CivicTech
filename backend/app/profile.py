"""The user profile that powers the autopilot.

There's a single demo user (no auth). `DEMO_PROFILE` is the fallback; once the user uploads
an ID (Phase 3, GPT-4o vision -> fields), `set_active_profile()` overrides it in memory and
`get_active_profile()` returns the extracted one. `get_profile` (the server tool) reads this.

`country` is the Drupal <option> value for the ESC eligibility form (e.g. "RO"), and
`birthdate` is an ISO date for <input type=date>. See app/countries.py / countryOptions.ts.
"""

from typing import Optional, TypedDict

from .countries import resolve_country_code


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

# In-memory store for the single demo user. None until an ID is uploaded.
_active: Optional[Profile] = None


def get_demo_profile() -> Profile:
    return DEMO_PROFILE


def get_active_profile() -> Profile:
    """The profile the autopilot fills: the uploaded one if present, else the demo user."""
    return _active if _active is not None else DEMO_PROFILE


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


def set_active_profile(
    name: str = "",
    country: str = "",
    birthdate: str = "",
    nationality: str = "",
) -> Profile:
    """Store the profile (e.g. after the user reviews/edits it). Country is normalised to a code."""
    global _active
    _active = normalize_profile(name, country, birthdate, nationality)
    return _active


def clear_active_profile() -> None:
    """Forget the uploaded profile (back to the demo user). Used by tests."""
    global _active
    _active = None
