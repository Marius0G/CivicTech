"""Phase 3 local proof — document -> profile, no real network.

Mocks the OpenAI vision HTTP call so we exercise the REAL code paths:
  • parse_vision_content (fenced / plain / messy JSON)
  • resolve_country_code (name -> Drupal code, incl. Greece=EL quirk)
  • POST /docs/upload  -> stores active profile (country normalised)
  • POST /tools/get_profile and GET /docs/profile reflect the uploaded profile
  • fallback to the demo user before any upload

Run:  .venv/Scripts/python.exe test_phase3.py
"""

import io
import json
import os
import sys

os.environ.setdefault("OPENAI_API_KEY", "sk-test-key")  # let vision.has_key pass

from fastapi.testclient import TestClient  # noqa: E402

import app.vision as vision  # noqa: E402
from app.countries import resolve_country_code  # noqa: E402
from app.main import app  # noqa: E402
from app.profile import clear_active_profile  # noqa: E402
from app.vision import parse_vision_content  # noqa: E402

checks: list[tuple[str, bool]] = []


def check(label: str, cond: bool) -> None:
    checks.append((label, bool(cond)))


# ---- fake OpenAI vision transport ---------------------------------------------------------
class _FakeResp:
    def __init__(self, content: str, status: int = 200):
        self.status_code = status
        self._content = content
        self.text = content

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


class _FakeClient:
    """Stands in for httpx.AsyncClient; returns whatever vision content we set."""

    content = '{"name":"Maria Ionescu","birthdate":"2006-05-14","country":"Romania","nationality":"Romanian"}'
    last_payload = None

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, headers=None, json=None):
        _FakeClient.last_payload = json
        return _FakeResp(_FakeClient.content)


vision.httpx.AsyncClient = _FakeClient  # patch the network

client = TestClient(app)


# ---- 1) parser tolerance ------------------------------------------------------------------
plain = parse_vision_content('{"name":"A","birthdate":"2000-01-02","country":"France","nationality":"French"}')
check("parse plain JSON", plain["country"] == "France" and plain["birthdate"] == "2000-01-02")

fenced = parse_vision_content('```json\n{"name":"B","birthdate":"","country":"Greece","nationality":""}\n```')
check("parse ```json fenced", fenced["country"] == "Greece" and fenced["name"] == "B")

messy = parse_vision_content('Sure! Here you go: {"name":"C","country":"Spain"} hope that helps')
check("parse JSON embedded in prose", messy["country"] == "Spain" and messy["nationality"] == "")


# ---- 2) country resolution ----------------------------------------------------------------
check("resolve Romania -> RO", resolve_country_code("Romania") == "RO")
check("resolve greece -> EL (Drupal quirk)", resolve_country_code("greece") == "EL")
check("resolve code FR stays FR", resolve_country_code("FR") == "FR")
check("resolve United Kingdom -> UK", resolve_country_code("United Kingdom") == "UK")
check("resolve unknown passes through", resolve_country_code("Atlantis") == "Atlantis")


# ---- 3) before any upload: demo user ------------------------------------------------------
clear_active_profile()
prof0 = client.post("/tools/get_profile").json()["profile"]
check("get_profile falls back to demo (RO)", prof0["country"] == "RO" and prof0["name"] == "Maria Ionescu")


# ---- 4) upload an ID whose country is a NAME -> extracted & previewed, but NOT yet stored --
_FakeClient.content = '{"name":"Giannis Papadopoulos","birthdate":"2004-09-30","country":"Greece","nationality":"Greek"}'
img = io.BytesIO(b"\xff\xd8\xff\xe0fakejpegbytes")
up = client.post("/docs/upload", files={"file": ("id.jpg", img, "image/jpeg")})
check("upload returns 200", up.status_code == 200)
body = up.json()
check("upload ok flag", body.get("ok") is True)
check("vision raw country echoed as name", body["extracted"]["country"] == "Greece")
check("preview profile country normalised Greece -> EL", body["profile"]["country"] == "EL")
check("preview profile keeps birthdate", body["profile"]["birthdate"] == "2004-09-30")
check("vision payload used json_object response_format",
      (_FakeClient.last_payload or {}).get("response_format", {}).get("type") == "json_object")
check("vision payload sent an image_url",
      any(part.get("type") == "image_url"
          for m in _FakeClient.last_payload["messages"]
          if isinstance(m.get("content"), list)
          for part in m["content"]))

# upload alone must NOT change the active profile — it's still the demo user until the user saves.
prof_after_upload = client.post("/tools/get_profile").json()["profile"]
check("upload does NOT commit (still demo RO)", prof_after_upload["country"] == "RO")


# ---- 5) the user reviews/edits then SAVES -> that's when it becomes the active profile -----
# Simulate an edit: the user corrects the country to a name; backend normalises on save.
save = client.post("/docs/profile", json={
    "name": "Giannis Papadopoulos", "birthdate": "2004-09-30",
    "country": "Greece", "nationality": "Greek",
})
check("save returns 200", save.status_code == 200)
check("saved profile normalised Greece -> EL", save.json()["profile"]["country"] == "EL")
prof1 = client.post("/tools/get_profile").json()["profile"]
check("get_profile now returns saved user (EL)", prof1["country"] == "EL" and prof1["name"].startswith("Giannis"))
docs_prof = client.get("/docs/profile").json()["profile"]
check("/docs/profile mirrors active profile", docs_prof["country"] == "EL")


# ---- 6) empty upload rejected -------------------------------------------------------------
empty = client.post("/docs/upload", files={"file": ("x.jpg", io.BytesIO(b""), "image/jpeg")})
check("empty upload rejected (400)", empty.status_code == 400)


# ---- report -------------------------------------------------------------------------------
clear_active_profile()
print("\n  Phase 3 proof — document -> profile -> autopilot\n")
ok = True
for label, passed in checks:
    print(f"   {'PASS' if passed else 'FAIL'}  {label}")
    if not passed:
        ok = False
print()
if not ok:
    print("  Phase 3 proof FAILED\n")
    sys.exit(1)
print("  Phase 3 proof PASSED\n")
