"""Network-free sanity test for the token request body + app wiring."""

from app.config import Settings
from app.realtime import build_session_payload
from app.persona import HOP_INSTRUCTIONS, instructions_for


def test_payload_shape():
    s = Settings()
    s.realtime_model = "gpt-realtime-2"
    s.realtime_voice = "marin"
    p = build_session_payload(s)

    assert p["session"]["type"] == "realtime"
    assert p["session"]["model"] == "gpt-realtime-2"
    assert p["session"]["audio"]["output"]["voice"] == "marin"
    assert "Hop" in p["session"]["instructions"]
    # The persona is always the prefix; a context block is appended after it.
    assert p["session"]["instructions"].startswith(HOP_INSTRUCTIONS)
    print("OK  payload shape:", {**p["session"], "instructions": "<...persona...>"})


def test_date_and_preferences_in_instructions():
    s = Settings()
    # The date is baked in so "in a week" questions work; a saved preference is surfaced.
    p = build_session_payload(s, today="2026-06-23", preferences={"climate": "warm"})
    instr = p["session"]["instructions"]
    assert "2026-06-23" in instr
    assert "climate: warm" in instr

    # With no preferences yet, Hop is told it MAY ask one light question (not many).
    none_yet = instructions_for(None, "2026-06-23", {})
    assert "2026-06-23" in none_yet
    assert "single short, light question" in none_yet
    assert "save_preference" in none_yet
    print("OK  date + preferences injected")


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


def test_preferences_roundtrip():
    """The light preference store saves/merges and is keyed per user (no DB needed)."""
    from app import preferences

    preferences.clear_preferences()
    assert preferences.get_preferences("u1") == {}
    preferences.save_preference("u1", "climate", "warm")
    preferences.save_preference("u1", "interests", "environment")
    assert preferences.get_preferences("u1") == {"climate": "warm", "interests": "environment"}
    # Per-user isolation.
    assert preferences.get_preferences("u2") == {}
    # Empty value removes a key; keys are normalised to lowercase.
    preferences.save_preference("u1", "CLIMATE", "")
    assert preferences.get_preferences("u1") == {"interests": "environment"}
    preferences.clear_preferences()
    print("OK  preferences round-trip")


if __name__ == "__main__":
    test_payload_shape()
    test_date_and_preferences_in_instructions()
    test_voice_override()
    test_preferences_roundtrip()
    print("\n[PASS] build_session_payload produces a correct /client_secrets body")
