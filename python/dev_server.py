"""Local runner for the exact Vercel handlers; no separate dev API implementation."""
import sys
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from api.dashboard import handler as dashboard
from api.health import handler as health
class LocalHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/dashboard":
            dashboard.do_GET(self)
        elif path == "/api/health":
            health.do_GET(self)
        else:
            self.send_error(404)
print("Python API: http://127.0.0.1:8000",flush=True)
ThreadingHTTPServer(("127.0.0.1",8000),LocalHandler).serve_forever()
