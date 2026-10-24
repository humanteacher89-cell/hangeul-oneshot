# -*- coding: utf-8 -*-
"""로컬 확인용 서버. 글 파일에 charset=utf-8을 붙여 보낸다(기본 http.server는 .js의 한글이 깨진다).
사용: python serve.py [포트] [mock]   (기본 8765, 127.0.0.1에만 연다)
mock을 붙이면 config.js의 API_URL을 비워 보내 시험 모드로 연다(실제 시트를 건드리지 않고 가입·올리기를 시험할 때).
"""
import http.server
import os
import re
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
MOCK = "mock" in sys.argv[2:]
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if MOCK and self.path.split("?")[0] == "/config.js":
            with open("config.js", encoding="utf-8") as f:
                body = re.sub(r'API_URL:\s*"[^"]*"', 'API_URL: ""', f.read()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".md": "text/plain; charset=utf-8",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
