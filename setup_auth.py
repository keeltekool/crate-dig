"""
CrateDig M1 — YouTube Music OAuth Setup

Prerequisites:
  1. Go to https://console.cloud.google.com/
  2. Select or create a project
  3. Enable "YouTube Data API v3"
  4. Go to Credentials → Create Credentials → OAuth client ID
  5. Application type: "TVs and Limited Input devices"
  6. Copy the Client ID and Client Secret

Then run this script:
  .venv/Scripts/python setup_auth.py
"""

from ytmusicapi import setup_oauth

print("=" * 50)
print("CrateDig — YouTube Music OAuth Setup")
print("=" * 50)
print()
print("You need OAuth credentials from Google Cloud Console.")
print("Type: 'TVs and Limited Input devices'")
print()

client_id = input("Client ID: ").strip()
client_secret = input("Client Secret: ").strip()

if not client_id or not client_secret:
    print("ERROR: Both Client ID and Client Secret are required.")
    exit(1)

print()
print("Starting OAuth flow — a URL will appear.")
print("Open it in your browser and sign in with your Google account.")
print()

setup_oauth(
    client_id=client_id,
    client_secret=client_secret,
    filepath="oauth.json",
    open_browser=True,
)

print()
print("oauth.json created! You can now run poc.py")
