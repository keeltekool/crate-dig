"""
CrateDig — Web OAuth setup with local redirect server.
Opens browser → user authorizes → Google redirects back → token saved.
Zero terminal interaction needed.
"""

import json
import os
import time
import webbrowser
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests
from dotenv import load_dotenv

load_dotenv(".env.local")

CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
REDIRECT_URI = "http://localhost:3005/api/youtube/callback"
FILEPATH = "oauth.json"
SCOPES = "https://www.googleapis.com/auth/youtube"

auth_code = None


class CallbackHandler(BaseHTTPRequestHandler):
    """Catches the OAuth redirect from Google."""

    def do_GET(self):
        global auth_code
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"""
                <html><body style="background:#0A0A0A;color:#F97316;font-family:monospace;
                display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
                <div style="text-align:center">
                <h1>CRATEDIG</h1>
                <p style="color:#E5E5E5">YouTube connected! You can close this tab.</p>
                </div></body></html>
            """)
        else:
            error = params.get("error", ["unknown"])[0]
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(f"<html><body>Error: {error}</body></html>".encode())

    def log_message(self, format, *args):
        pass  # Suppress server logs


def main():
    print()
    print("=" * 50)
    print("  CrateDig — YouTube OAuth Setup")
    print("=" * 50)
    print()

    # Build OAuth URL
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urllib.parse.urlencode({
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
        })
    )

    # Start local server to catch redirect
    server = HTTPServer(("localhost", 3005), CallbackHandler)
    server.timeout = 120  # 2 min max wait

    print("Opening browser for authorization...")
    print(f"(If browser doesn't open, go to: {auth_url[:80]}...)")
    print()
    webbrowser.open(auth_url)

    # Wait for the redirect
    print("Waiting for authorization...")
    while auth_code is None:
        server.handle_request()

    server.server_close()
    print("Got authorization code!")
    print()

    # Exchange code for tokens
    print("Exchanging for tokens...")
    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": auth_code,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
        },
    )
    token_data = token_response.json()

    if "access_token" not in token_data:
        print(f"ERROR: {token_data}")
        return

    # Save in ytmusicapi-compatible format
    oauth_json = {
        "access_token": token_data["access_token"],
        "refresh_token": token_data["refresh_token"],
        "token_type": token_data["token_type"],
        "expires_at": int(time.time()) + token_data.get("expires_in", 3600),
        "expires_in": token_data.get("expires_in", 3600),
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }

    with open(FILEPATH, "w") as f:
        json.dump(oauth_json, f, indent=2)

    print(f"SUCCESS! {FILEPATH} created.")
    print("Run: .venv/Scripts/python poc.py")


if __name__ == "__main__":
    main()
