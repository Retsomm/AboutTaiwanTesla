"""Read-only Vercel Python function; ingestion is a separate scheduled job."""
import json
from http.server import BaseHTTPRequestHandler
from pathlib import Path

SNAPSHOT = Path(__file__).resolve().parents[1] / "public/data/dashboard.json"

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            body = SNAPSHOT.read_bytes()
            json.loads(body)
        except (OSError, json.JSONDecodeError):
            self.send_response(503)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(b'{"error":"snapshot_unavailable"}')
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)
