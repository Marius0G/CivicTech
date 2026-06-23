"""Extract profile fields from a photo of an ID / document via OpenAI vision.

We send the image (as a base64 data URL) to a vision-capable chat model and force a strict
JSON object back with the visible Romanian ID-card fields (see EXTRACT_KEYS). The country is
returned as an English name and normalised to the ESC form's Drupal option code by the
profile layer.

Kept network-isolated behind one function so it can be mocked in tests.
"""

import base64
import json
from typing import Any

import httpx

from .config import Settings

# A vision-capable chat model (separate from the Realtime voice model).
VISION_MODEL = "gpt-4o"
CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

_SYSTEM = (
    "You are an OCR assistant for an official EU youth-program sign-up. The user has uploaded "
    "a photo of THEIR OWN identity document (typically a Romanian carte de identitate) and "
    "consented to have its visible fields transcribed to auto-fill a government form. This is a "
    "legitimate data-entry task: simply read the text that is printed on the document. "
    "Return ONLY a JSON object with exactly these keys: "
    '"name" (full name), "first_name" (Prenume / given names), "last_name" (Nume / surname), '
    '"cnp" (Cod Numeric Personal, the 13-digit personal number), "sex" (M or F), '
    '"birthdate" (Data nașterii as ISO yyyy-mm-dd), "place_of_birth" (Loc naștere), '
    '"nationality" (Cetățenie as an English demonym, e.g. "Romanian"), '
    '"country" (country of residence or issuing country, as an English name like "Romania"), '
    '"address" (Domiciliu), "series" (Seria, e.g. "RX"), "doc_number" (Serie/Număr digits), '
    '"issued_by" (Emisă de, e.g. "SPCLEP Sector 3"), "issue_date" (Data eliberării as ISO '
    'yyyy-mm-dd) and "expiry_date" (Valabilitate as ISO yyyy-mm-dd). '
    "If a field is unreadable or not present, use an empty string. Do not guess. No commentary."
)

EXTRACT_KEYS = (
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


def _data_url(image_bytes: bytes, content_type: str) -> str:
    mime = content_type if content_type.startswith("image/") else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"


def parse_vision_content(content: str) -> dict[str, str]:
    """Parse the model's text into our 4 string fields. Tolerant of ```json fences."""
    text = (content or "").strip()
    if text.startswith("```"):
        # strip a ```json ... ``` fence
        text = text.split("```", 2)[1] if text.count("```") >= 2 else text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        # last resort: grab the first {...} block
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            raise RuntimeError(f"vision did not return JSON: {text[:200]}")
        data = json.loads(text[start : end + 1])
    return {k: str(data.get(k, "") or "").strip() for k in EXTRACT_KEYS}


def _build_payload(image_bytes: bytes, content_type: str) -> dict[str, Any]:
    return {
        "model": VISION_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract the holder's details as JSON."},
                    {
                        "type": "image_url",
                        "image_url": {"url": _data_url(image_bytes, content_type)},
                    },
                ],
            },
        ],
    }


async def extract_profile_from_image(
    settings: Settings, image_bytes: bytes, content_type: str = "image/jpeg"
) -> dict[str, str]:
    """Call the vision model and return {name, birthdate, country, nationality} (strings)."""
    if not settings.has_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")
    if not image_bytes:
        raise RuntimeError("empty image")

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload = _build_payload(image_bytes, content_type)

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(CHAT_COMPLETIONS_URL, headers=headers, json=payload)

    if resp.status_code >= 400:
        raise RuntimeError(f"vision request failed ({resp.status_code}): {resp.text[:300]}")

    choice = resp.json()["choices"][0]
    message = choice.get("message", {})
    content = message.get("content")

    # The model can decline (privacy refusal) or get cut by the content filter; in both cases
    # `content` comes back empty/None and `parse_vision_content` would only see a vague error.
    # Surface the real reason so the app can show something actionable.
    if not content:
        refusal = message.get("refusal")
        finish = choice.get("finish_reason")
        if refusal:
            raise RuntimeError(f"the model declined to read this image: {str(refusal)[:200]}")
        if finish == "content_filter":
            raise RuntimeError("the image was blocked by the content filter; try a clearer, well-lit photo")
        raise RuntimeError("the model returned no text for this image; try a clearer, well-lit photo")

    return parse_vision_content(content)
