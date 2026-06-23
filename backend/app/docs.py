"""Document upload -> profile extraction (Phase 3).

POST /docs/upload  (multipart, field name "file"): a photo of an ID ->
  GPT-4o vision -> {name, birthdate, country, nationality}. This ONLY extracts — it does not
  store anything. The app shows the result for the user to review/edit.
POST /docs/profile (JSON): the user-confirmed (possibly edited) profile -> stored as active.
GET  /docs/profile: the currently active profile (saved if any, else demo).

No auth: a single demo user. The saved profile feeds get_profile / fill_form so the
autopilot fills the form with the user's REAL country + date of birth.
"""

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from .config import get_settings
from .profile import get_active_profile, normalize_profile, set_active_profile
from .vision import extract_profile_from_image

log = logging.getLogger("youthbuddy.docs")

router = APIRouter(prefix="/docs", tags=["docs"])


class ProfileIn(BaseModel):
    name: str = ""
    country: str = ""  # an English country name OR a Drupal code; normalised either way
    birthdate: str = ""
    nationality: str = ""


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)) -> dict:
    """Read an ID photo and extract the holder's details for the user to review. No commit."""
    settings = get_settings()
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty upload")

    try:
        fields = await extract_profile_from_image(
            settings, image_bytes, file.content_type or "image/jpeg"
        )
    except RuntimeError as e:
        log.error("vision extraction failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e))

    # `extracted` echoes the raw vision output (country as a name); `profile` is a normalised
    # preview (country -> code). Nothing is stored until the user saves via POST /docs/profile.
    preview = normalize_profile(**fields)
    log.info("profile extracted from %s: %s", file.filename, fields.get("name") or "(no name)")
    return {"ok": True, "extracted": fields, "profile": preview}


@router.post("/profile")
def save_profile(body: ProfileIn) -> dict:
    """Store the user-confirmed profile (after they review/edit the scan). Country normalised."""
    profile = set_active_profile(
        name=body.name, country=body.country, birthdate=body.birthdate, nationality=body.nationality
    )
    log.info("profile saved: %s", profile["name"] or "(no name)")
    return {"ok": True, "profile": profile}


@router.get("/profile")
def current_profile() -> dict:
    """The profile the autopilot will fill (saved one if present, else the demo user)."""
    return {"profile": get_active_profile()}
