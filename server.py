#!/usr/bin/env python3
"""ArcadeBase static file server on port 8090."""
import http.server
import socketserver
import os
import socket

PORT = 8090

os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
})

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

    def __init__(self, *args, **kwargs):
        self.allow_reuse_address = True
        socketserver.TCPServer.__init__(self, *args, **kwargs)

with ReusableTCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"ARCADEBASE running on http://0.0.0.0:{PORT}")
    httpd.serve_forever()
