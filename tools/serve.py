"""Local static server for Fusey that disables HTTP caching.

`python3 -m http.server` sends only Last-Modified, so browsers cache ES modules
heuristically and may keep running old code after files change. This server adds
`Cache-Control: no-cache`, which makes the browser revalidate every request.

Usage: python3 tools/serve.py [port]   (default 8080, serves the project root)
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Fusey: http://127.0.0.1:{port}/")
        httpd.serve_forever()
