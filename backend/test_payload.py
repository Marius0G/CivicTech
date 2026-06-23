"""Network-free sanity test for the token request body + app wiring."""

from app.config import Settings
from app.realtime import build_session_payload
from app.persona import HOPPY_INSTRUCTIONS


def test_payload_shape():
    s = Settings()
    s.realtime_model = "gpt-realtime-2"
    s.realtime_voice = "marin"
    p = build_session_payload(s)

    assert p["session"]["type"] == "realtime"
    assert p["session"]["model"] == "gpt-realtime-2"
    assert p["session"]["audio"]["output"]["voice"] == "marin"
    assert "Hoppy" in p["session"]["instructions"]
    assert p["session"]["instructions"] == HOPPY_INSTRUCTIONS
    print("OK  payload shape:", {**p["session"], "instructions": "<...persona...>"})


def test_voice_override():
    s = Settings()
    s.realtime_voice = "marin"

    # A valid Realtime voice the app requested wins over the default.
    p = build_session_payload(s, voice="cedar")
    assert p["session"]["audio"]["output"]["voice"] == "cedar"

    # Case/whitespace are normalized.
    p = build_session_payload(s, voice="  CEDAR ")
    assert p["session"]["audio"]["output"]["voice"] == "cedar"

    # Unknown / empty values fall back to the server default — never reach OpenAI.
    assert build_session_payload(s, voice="bogus")["session"]["audio"]["output"]["voice"] == "marin"
    assert build_session_payload(s, voice="")["session"]["audio"]["output"]["voice"] == "marin"
    assert build_session_payload(s, voice=None)["session"]["audio"]["output"]["voice"] == "marin"
    print("OK  voice override + fallback")


if __name__ == "__main__":
    test_payload_shape()
    test_voice_override()
    print("\n[PASS] build_session_payload produces a correct /client_secrets body")
