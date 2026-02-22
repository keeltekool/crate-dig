"""
CrateDig — FastAPI Backend
Handles YouTube Music search/related + playlist creation.
Reads OAuth tokens from Neon DB.
"""

import json
import os
import time
from contextlib import asynccontextmanager

import asyncpg
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ytmusicapi import YTMusic
from ytmusicapi.auth.oauth import OAuthCredentials

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3005")

# ── DB pool ──────────────────────────────────────────────────────────

pool: asyncpg.Pool | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    # Strip sslmode/channel_binding for asyncpg
    db_url = DATABASE_URL
    for param in ["sslmode=require", "channel_binding=disable", "channel_binding=prefer"]:
        db_url = db_url.replace(f"?{param}", "?").replace(f"&{param}", "")
    db_url = db_url.rstrip("?").rstrip("&")

    pool = await asyncpg.create_pool(db_url, min_size=1, max_size=5, ssl="require")
    yield
    if pool:
        await pool.close()


app = FastAPI(title="CrateDig API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────────


async def get_youtube_token() -> dict:
    """Load YouTube OAuth token from DB (single-user: first row)."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT oauth_token FROM youtube_connections LIMIT 1")
    if not row:
        raise HTTPException(status_code=401, detail="YouTube not connected")
    token = row["oauth_token"]
    if isinstance(token, str):
        token = json.loads(token)
    return token


def refresh_token_if_needed(token: dict) -> dict:
    """Refresh the access token if expired."""
    if token.get("expires_at", 0) > time.time() + 60:
        return token  # Still valid

    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": token["client_id"],
            "client_secret": token["client_secret"],
            "refresh_token": token["refresh_token"],
            "grant_type": "refresh_token",
        },
    )
    data = resp.json()
    if "access_token" not in data:
        raise HTTPException(status_code=401, detail="Token refresh failed")

    token["access_token"] = data["access_token"]
    token["expires_at"] = int(time.time()) + data.get("expires_in", 3600)
    return token


async def update_token_in_db(token: dict):
    """Update the stored token after refresh."""
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE youtube_connections SET oauth_token = $1::jsonb, last_used_at = NOW()",
            json.dumps(token),
        )


def build_ytmusic(token: dict) -> YTMusic:
    """Create a YTMusic instance from token dict."""
    import tempfile

    # Write token to temp file for ytmusicapi
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(token, f)
        tmp_path = f.name

    try:
        yt = YTMusic(tmp_path, oauth_credentials=OAuthCredentials(
            client_id=token["client_id"],
            client_secret=token["client_secret"],
        ))
        return yt
    finally:
        os.unlink(tmp_path)


# ── Models ───────────────────────────────────────────────────────────


class Seed(BaseModel):
    artist: str
    title: str


class RollRequest(BaseModel):
    seeds: list[Seed]
    desired_count: int = 50


class CreatePlaylistRequest(BaseModel):
    title: str
    video_ids: list[str]


# ── Endpoints ────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "service": "cratedig-api"}


@app.post("/roll")
async def roll(req: RollRequest):
    token = await get_youtube_token()
    token = refresh_token_if_needed(token)
    await update_token_in_db(token)

    yt = build_ytmusic(token)

    all_tracks = []
    seeds_found = 0
    seeds_failed = 0

    for seed in req.seeds:
        query = f"{seed.artist} {seed.title}"
        try:
            results = yt.search(query, filter="songs", limit=3)
            time.sleep(1.5)  # Rate limiting

            if not results:
                seeds_failed += 1
                continue

            hit = results[0]
            video_id = hit.get("videoId")
            if not video_id:
                seeds_failed += 1
                continue

            seeds_found += 1

            # Get related tracks via radio
            watch = yt.get_watch_playlist(videoId=video_id, radio=True, limit=25)
            time.sleep(1.5)

            for t in watch.get("tracks", [])[1:]:  # Skip first (seed song)
                if t.get("videoId"):
                    thumbnail = ""
                    if isinstance(t.get("thumbnail"), list) and t["thumbnail"]:
                        thumbnail = t["thumbnail"][-1].get("url", "")

                    all_tracks.append({
                        "videoId": t["videoId"],
                        "title": t.get("title", "Unknown"),
                        "artist": t["artists"][0]["name"] if t.get("artists") else "Unknown",
                        "thumbnail": thumbnail,
                    })

        except Exception as e:
            print(f"Error processing seed '{query}': {e}")
            seeds_failed += 1

    # Deduplicate by videoId
    seen_ids: set[str] = set()
    unique_tracks = []
    for t in all_tracks:
        if t["videoId"] not in seen_ids:
            seen_ids.add(t["videoId"])
            unique_tracks.append(t)

    return {
        "tracks": unique_tracks[:req.desired_count],
        "seeds_used": seeds_found,
        "seeds_failed": seeds_failed,
        "raw_found": len(all_tracks),
        "after_dedup": len(unique_tracks),
    }


@app.post("/create-playlist")
async def create_playlist(req: CreatePlaylistRequest):
    token = await get_youtube_token()
    token = refresh_token_if_needed(token)
    await update_token_in_db(token)

    access_token = token["access_token"]
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    # Step 1: Create empty playlist via YouTube Data API v3
    resp = requests.post(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
        headers=headers,
        json={
            "snippet": {"title": req.title, "description": "Auto-generated by CrateDig"},
            "status": {"privacyStatus": "private"},
        },
    )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Playlist creation failed: {resp.text[:200]}")

    playlist_id = resp.json()["id"]

    # Step 2: Add videos one by one
    added = 0
    for vid in req.video_ids:
        try:
            r = requests.post(
                "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
                headers=headers,
                json={
                    "snippet": {
                        "playlistId": playlist_id,
                        "resourceId": {"kind": "youtube#video", "videoId": vid},
                    }
                },
            )
            if r.status_code == 200:
                added += 1
        except Exception:
            pass

    return {
        "playlist_id": playlist_id,
        "url": f"https://music.youtube.com/playlist?list={playlist_id}",
        "track_count": added,
    }
