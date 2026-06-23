"""Tiny stand-in for OpenAI's /v1/realtime/client_secrets, for offline plumbing tests.
Echoes back the received session body so we can assert the backend sent the right payload.
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        resp = {
            "value": "ek_test_123",
            "expires_at": 9999999999,
            "echo_received_session": body.get("session", {}),
        }
        out = json.dumps(resp).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8999), Handler).serve_forever()
