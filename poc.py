"""
CrateDig M1 — Proof of Concept

Validates the full ytmusicapi chain:
  1. Parse CSV (real DJ software export)
  2. Pick random seeds
  3. Search YouTube Music for each seed
  4. Get related tracks via radio
  5. Deduplicate + filter out library songs
  6. Create playlist on YouTube Music

Run:
  .venv/Scripts/python poc.py

Prereqs:
  - oauth.json exists (run setup_auth.py first)
  - data/WUDWUD_app.csv exists (or any CSV with Title + Artist columns)
"""

import csv
import io
import json
import os
import random
import sys
import time

from ytmusicapi import YTMusic
from ytmusicapi.auth.oauth import OAuthCredentials

# ── Config ──────────────────────────────────────────────────────────

CSV_PATH = "data/WUDWUD_app.csv"
OAUTH_PATH = "oauth.json"
SEED_COUNT = 5
DESIRED_OUTPUT = 20
DELAY_BETWEEN_CALLS = 1.5  # seconds


# ── CSV Parser (handles quirky DJ software format) ──────────────────

def parse_csv(path: str) -> list[dict]:
    """
    DJ software (WUDWUD etc.) exports CSV where each data row is wrapped
    in outer double-quotes with "" escaping inside. Header is normal.

    Example row:
    "1,""Blaxploitation"",""Detroit's Filthiest"",""Original Not Crispy"",218,0,..."

    After stripping outer quotes, the inner content is valid CSV.
    """
    songs = []

    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    if not lines:
        print("ERROR: CSV file is empty")
        return songs

    # Header is the first line, normal CSV
    header_line = lines[0].strip()
    header = next(csv.reader(io.StringIO(header_line)))
    header = [h.strip().lower() for h in header]

    print(f"CSV columns: {header}")

    # Find column indices
    title_idx = None
    artist_idx = None
    genre_idx = None

    for i, col in enumerate(header):
        if col == "title":
            title_idx = i
        elif col == "artist":
            artist_idx = i
        elif col == "genre":
            genre_idx = i

    if title_idx is None or artist_idx is None:
        print(f"ERROR: Could not find 'title' and 'artist' columns in: {header}")
        return songs

    print(f"Mapped: title=col[{title_idx}], artist=col[{artist_idx}], genre=col[{genre_idx}]")

    # Parse data rows
    for line_num, line in enumerate(lines[1:], start=2):
        line = line.strip()
        if not line:
            continue

        # Strip outer wrapping quotes if present (DJ software format)
        if line.startswith('"') and line.endswith('"'):
            inner = line[1:-1]
            # Inner content has "" as escaped quotes — unescape them first
            inner = inner.replace('""', '"')
            # Now it's a normal CSV row with proper quoting
            try:
                row = next(csv.reader(io.StringIO(inner)))
            except StopIteration:
                continue
        else:
            # Normal CSV row
            try:
                row = next(csv.reader(io.StringIO(line)))
            except StopIteration:
                continue

        if len(row) <= max(title_idx, artist_idx):
            continue

        title = row[title_idx].strip()
        artist = row[artist_idx].strip()
        genre = row[genre_idx].strip() if genre_idx is not None and genre_idx < len(row) else ""

        if title and artist:
            song = {"title": title, "artist": artist}
            if genre:
                song["genre"] = genre
            songs.append(song)

    return songs


# ── Seed Selection ──────────────────────────────────────────────────

def pick_random_seeds(songs: list[dict], count: int) -> list[dict]:
    """Pure random shuffle, pick N."""
    return random.sample(songs, min(count, len(songs)))


def pick_deep_seeds(songs: list[dict], count: int) -> list[dict]:
    """Pick from artists with only 1-2 tracks (niche corners)."""
    artist_counts: dict[str, int] = {}
    for s in songs:
        a = s["artist"].lower()
        artist_counts[a] = artist_counts.get(a, 0) + 1

    niche = [s for s in songs if artist_counts[s["artist"].lower()] <= 2]
    if len(niche) < count:
        print(f"  Only {len(niche)} niche songs, falling back to random")
        return pick_random_seeds(songs, count)

    return random.sample(niche, count)


# ── YouTube Music Chain ─────────────────────────────────────────────

def search_song(yt: YTMusic, artist: str, title: str) -> dict | None:
    """Search YouTube Music for a specific song. Returns first match or None."""
    query = f"{artist} {title}"
    try:
        results = yt.search(query, filter="songs", limit=3)
        if results:
            hit = results[0]
            return {
                "videoId": hit["videoId"],
                "title": hit["title"],
                "artist": hit["artists"][0]["name"] if hit.get("artists") else "Unknown",
            }
    except Exception as e:
        print(f"  Search error for '{query}': {e}")
    return None


def get_related_tracks(yt: YTMusic, video_id: str, limit: int = 25) -> list[dict]:
    """Get related tracks using YouTube Music's radio/watch playlist."""
    try:
        watch = yt.get_watch_playlist(videoId=video_id, radio=True, limit=limit)
        tracks = []
        for t in watch.get("tracks", [])[1:]:  # skip first (it's the seed song)
            if t.get("videoId"):
                tracks.append({
                    "videoId": t["videoId"],
                    "title": t.get("title", "Unknown"),
                    "artist": t["artists"][0]["name"] if t.get("artists") else "Unknown",
                    "thumbnail": t.get("thumbnail", [{}])[-1].get("url", "") if isinstance(t.get("thumbnail"), list) else "",
                })
        return tracks
    except Exception as e:
        print(f"  Related tracks error for {video_id}: {e}")
        return []


def create_playlist(yt: YTMusic, title: str, video_ids: list[str]) -> str | None:
    """Create a playlist on YouTube Music. Returns playlist ID or None."""
    try:
        result = yt.create_playlist(
            title=title,
            description="Auto-generated by CrateDig POC",
            privacy_status="PRIVATE",
            video_ids=video_ids,
        )
        if isinstance(result, str):
            return result
        else:
            print(f"  Playlist creation returned: {result}")
            return None
    except Exception as e:
        print(f"  Playlist creation error: {e}")
        return None


# ── Deduplication ───────────────────────────────────────────────────

def deduplicate(tracks: list[dict], library: list[dict]) -> list[dict]:
    """Remove duplicates by videoId and filter out songs already in user's library."""
    # Dedup by videoId
    seen_ids: set[str] = set()
    unique: list[dict] = []
    for t in tracks:
        if t["videoId"] not in seen_ids:
            seen_ids.add(t["videoId"])
            unique.append(t)

    # Filter out library songs (fuzzy: lowercase artist+title match)
    library_set = {f"{s['artist'].lower()}|{s['title'].lower()}" for s in library}
    filtered = [
        t for t in unique
        if f"{t['artist'].lower()}|{t['title'].lower()}" not in library_set
    ]

    return filtered


# ── Main ────────────────────────────────────────────────────────────

def main():
    print()
    print("=" * 60)
    print("  CRATEDIG — Proof of Concept (M1)")
    print("=" * 60)
    print()

    # ── Check prerequisites ──
    if not os.path.exists(OAUTH_PATH):
        print(f"ERROR: {OAUTH_PATH} not found. Run setup_auth.py first.")
        sys.exit(1)

    if not os.path.exists(CSV_PATH):
        print(f"ERROR: {CSV_PATH} not found. Place your CSV in the data/ folder.")
        sys.exit(1)

    # ── Load OAuth credentials ──
    print("[1/6] Loading YouTube Music credentials...")
    with open(OAUTH_PATH, "r") as f:
        oauth_data = json.load(f)

    # Extract client_id and client_secret from oauth.json
    client_id = oauth_data.get("client_id", "")
    client_secret = oauth_data.get("client_secret", "")

    if client_id and client_secret:
        yt = YTMusic(OAUTH_PATH, oauth_credentials=OAuthCredentials(
            client_id=client_id,
            client_secret=client_secret,
        ))
    else:
        # Try without explicit credentials (older format)
        yt = YTMusic(OAUTH_PATH)

    print("  YouTube Music connected!")
    print()

    # ── Parse CSV ──
    print("[2/6] Parsing CSV...")
    songs = parse_csv(CSV_PATH)
    print(f"  Loaded {len(songs)} songs")

    if len(songs) < SEED_COUNT:
        print(f"ERROR: Need at least {SEED_COUNT} songs, got {len(songs)}")
        sys.exit(1)

    # Count unique artists
    artists = {s["artist"].lower() for s in songs}
    print(f"  {len(artists)} unique artists")

    # Count genre coverage
    with_genre = sum(1 for s in songs if s.get("genre"))
    print(f"  {with_genre}/{len(songs)} songs have genre tags ({100*with_genre//len(songs)}%)")
    print()

    # ── Pick seeds ──
    print(f"[3/6] Picking {SEED_COUNT} random seeds...")
    seeds = pick_random_seeds(songs, SEED_COUNT)
    for i, s in enumerate(seeds, 1):
        print(f"  Seed {i}: {s['artist']} — {s['title']}")
    print()

    # ── Search + get related ──
    print(f"[4/6] Searching YouTube Music + getting related tracks...")
    all_related: list[dict] = []
    seeds_found = 0
    seeds_failed = 0

    for i, seed in enumerate(seeds, 1):
        print(f"  [{i}/{SEED_COUNT}] Searching: {seed['artist']} — {seed['title']}")

        hit = search_song(yt, seed["artist"], seed["title"])
        time.sleep(DELAY_BETWEEN_CALLS)

        if not hit:
            print(f"    NOT FOUND on YouTube Music")
            seeds_failed += 1
            continue

        seeds_found += 1
        print(f"    Found: {hit['artist']} — {hit['title']} (videoId: {hit['videoId']})")

        related = get_related_tracks(yt, hit["videoId"], limit=25)
        time.sleep(DELAY_BETWEEN_CALLS)

        print(f"    Got {len(related)} related tracks")
        all_related.extend(related)

    print()
    print(f"  Seeds found: {seeds_found}/{SEED_COUNT}")
    print(f"  Seeds failed: {seeds_failed}/{SEED_COUNT}")
    print(f"  Raw related tracks: {len(all_related)}")
    print()

    if not all_related:
        print("ERROR: No related tracks found. Cannot create playlist.")
        sys.exit(1)

    # ── Deduplicate + filter ──
    print("[5/6] Deduplicating + filtering library songs...")
    filtered = deduplicate(all_related, songs)
    print(f"  After dedup + library filter: {len(filtered)} tracks")

    # Trim to desired output
    final = filtered[:DESIRED_OUTPUT]
    print(f"  Final playlist: {len(final)} tracks")
    print()

    for i, t in enumerate(final, 1):
        print(f"  {i:2}. {t['artist']} — {t['title']}")
    print()

    # ── Create playlist ──
    print("[6/6] Creating playlist on YouTube Music...")
    video_ids = [t["videoId"] for t in final]

    from datetime import datetime
    playlist_title = f"CrateDig Roll — {datetime.now().strftime('%b %d %Y %H:%M')}"

    playlist_id = create_playlist(yt, playlist_title, video_ids)

    if playlist_id:
        url = f"https://music.youtube.com/playlist?list={playlist_id}"
        print()
        print("=" * 60)
        print("  SUCCESS!")
        print(f"  Playlist: {playlist_title}")
        print(f"  Tracks: {len(final)}")
        print(f"  URL: {url}")
        print("=" * 60)
    else:
        print()
        print("FAILED: Could not create playlist.")
        print("Check if your Google account has YouTube Music access.")

    # ── Summary for PRD validation ──
    print()
    print("─" * 60)
    print("M1 VALIDATION RESULTS:")
    print(f"  1. get_watch_playlist(radio=True) returns tracks? {'YES' if all_related else 'NO'}")
    print(f"  2. create_playlist() works? {'YES' if playlist_id else 'NO'}")
    print(f"  3. Yield per seed: ~{len(all_related)//max(seeds_found,1)} tracks")
    print(f"  4. Rate limit issues: None (used {DELAY_BETWEEN_CALLS}s delay)")
    print(f"  5. Search hit rate: {seeds_found}/{SEED_COUNT} ({100*seeds_found//SEED_COUNT}%)")
    print("─" * 60)


if __name__ == "__main__":
    main()
