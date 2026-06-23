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


if __name__ == "__main__":
    test_payload_shape()
    print("\n[PASS] build_session_payload produces a correct /client_secrets body")
