import json
from http.server import BaseHTTPRequestHandler
from pathlib import Path
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            data=json.loads((Path(__file__).resolve().parents[1]/"public/data/dashboard.json").read_text())
            result={"service":"ok","generatedAt":data["generatedAt"],
                    "sources":{name:data[name]["status"] for name in ("market","registrations","charging","news")}}
            status=200
        except (OSError, ValueError, KeyError):
            result={"service":"error"}
            status=503
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
