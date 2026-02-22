# CrateDig - PRD

**Last updated:** 2026-02-22

## Problem

10,000+ songs collected over years of DJ crate-digging. Finding NEW music that matches your taste is manual and slow. Existing recommendation engines work off listening history — not your actual curated collection.

## Solution

Personal web app: upload music library as CSV, roll randomized dice to pick seed songs, YouTube Music's recommendation engine finds related tracks, pushes them as a playlist directly to your YouTube account.

No AI analysis. No paid subscription. No multi-user auth. Just randomness + YouTube's algorithm seeded with YOUR songs.

**Single-user app.** Google OAuth for YouTube connection IS the login. No Clerk, no separate auth system.

---

## Architecture

```
┌──────────────────────────┐     HTTP/JSON      ┌──────────────────────────┐
│   Next.js 16 Frontend    │ ◄──────────────── │   FastAPI Backend        │
│   Vercel (port 3005)     │ ────────────────► │   Render (port 8000)     │
│                          │                    │                          │
│ - Google OAuth (login)   │                    │ - ytmusicapi calls       │
│ - CSV upload + parsing   │                    │ - YouTube search/related │
│ - Library stored in Neon │                    │ - Playlist creation via  │
│ - Dice mode UI           │                    │   YouTube Data API v3    │
│ - Preview list           │                    │ - Reads YouTube OAuth    │
│ - Roll history           │                    │   tokens from Neon       │
└────────────┬─────────────┘                    └────────────┬─────────────┘
             │                                               │
             ▼                                               │
┌──────────────────────────┐                                 │
│   Neon PostgreSQL        │ ◄───────────────────────────────┘
│   (shared database)      │
│                          │
│ - libraries (CSV songs)  │
│ - youtube_connections    │
│ - rolls (history)        │
└──────────────────────────┘
```

**Why two services:** `ytmusicapi` is Python-only. No JS/TS equivalent exists. Frontend stays Next.js (matches existing stack — Lead Radar, QuoteKit, etc.). Backend is FastAPI on Render (same pattern as HankeRadar). Both services connect to the same Neon database.

**Auth: Google OAuth = everything.** Single-user app. Connecting YouTube IS the login. Google OAuth provides both YouTube API access AND user identity. No Clerk, no separate auth system. A simple HTTP-only session cookie tracks the logged-in state. Backend trusts requests from the frontend (single-user, no user ID passing needed).

---

## Tech Stack — Exact Packages

### Frontend (Next.js on Vercel)

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.x | App Router, React Server Components |
| react / react-dom | 19.x | UI |
| tailwindcss | 4.x | Styling |
| typescript | 5.x | Type safety |
| drizzle-orm | latest | DB queries |
| @neondatabase/serverless | latest | Neon PostgreSQL driver |
| papaparse | 5.x | CSV parsing in browser |

Dev server: `npx next dev -p 3005 --webpack` (Turbopack font bug)

### Backend (FastAPI on Render)

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.115.x | API framework |
| uvicorn | 0.34.x | ASGI server |
| ytmusicapi | 1.9.x | YouTube Music internal API |
| asyncpg | 0.30.x | Async PostgreSQL driver (read YouTube tokens from Neon) |
| python-multipart | 0.0.x | Request handling |

Python version: **3.13** (matches HankeRadar)

### Services — All Existing Accounts

| Service | Account | Purpose | Cost |
|---------|---------|---------|------|
| **Vercel** | egertv1s (existing) | Frontend hosting | Free (Hobby) |
| **Render** | egertv@gmail.com (existing) | FastAPI backend | Free (750 hrs/month) |
| **GitHub** | keeltekool (existing) | Source code | Free |
| **Neon** | egertv@gmail.com (existing) | PostgreSQL database | Free (0.5GB) |
| **Google Cloud** | egertv@gmail.com (existing) | YouTube OAuth + API | Free |

**New accounts required: ZERO.** New Neon project within existing account. Reuse existing GCP project.

### Env Vars

**Vercel (frontend):**
| Var | Value |
|-----|-------|
| `DATABASE_URL` | Neon connection string (new `crate-dig` project) |
| `GOOGLE_CLIENT_ID` | From GCP OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | From GCP OAuth credentials |
| `SESSION_SECRET` | Random 32-char string for cookie signing |
| `NEXT_PUBLIC_API_URL` | `https://crate-dig-api.onrender.com` |

**Render (backend):**
| Var | Value |
|-----|-------|
| `DATABASE_URL` | Same Neon connection string |
| `GOOGLE_CLIENT_ID` | Same GCP OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | Same GCP OAuth credentials |
| `FRONTEND_URL` | `https://crate-dig.vercel.app` (CORS + redirect) |

---

## Database Schema (Neon + Drizzle)

3 tables. No bloat.

### `libraries` — Uploaded song collection
```sql
CREATE TABLE libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,                  -- original CSV filename
  songs JSONB NOT NULL,                    -- array of {artist, title, genre?}
  song_count INTEGER NOT NULL,
  artist_count INTEGER NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Single-user = one row.** On re-upload, the existing row is replaced (UPSERT).

**Why JSONB instead of a `library_songs` table:** 10k songs × artist + title ≈ 1-2MB of JSON. Single row, no joins, fast read. Neon handles this fine.

**Stored fields:** MVP uses only `artist` + `title`. But CSV may contain `genre` — store it as an optional field in the same JSONB objects for M3 GENRE dice mode. No extra cost to store, big cost to re-upload later.

### `youtube_connections` — YouTube OAuth tokens
```sql
CREATE TABLE youtube_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_email TEXT,                       -- for display ("Connected as egertv@gmail.com")
  oauth_token JSONB NOT NULL,             -- {access_token, refresh_token, token_type, expires_at, client_id, client_secret}
  connected_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW()
);
```

**Single row.** Read by FastAPI backend when making ytmusicapi calls + YouTube Data API v3 calls.

### `rolls` — Roll history
```sql
CREATE TABLE rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dice_mode TEXT NOT NULL,                 -- 'random' | 'deep'
  output_size INTEGER NOT NULL,
  seeds_used INTEGER NOT NULL,
  seeds_failed INTEGER DEFAULT 0,
  tracks_found INTEGER NOT NULL,
  playlist_id TEXT,                         -- YouTube playlist ID (null if not pushed)
  playlist_url TEXT,                        -- YouTube playlist URL (null if not pushed)
  thumbnail_url TEXT,                       -- first track's YouTube thumbnail for visual display
  rolled_at TIMESTAMP DEFAULT NOW()
);
```

Roll history — see past rolls, revisit playlist links.

---

## YouTube Music Integration — Technical Detail

### YouTube OAuth Flow (= login + YouTube connection)

```
1. User clicks "Connect YouTube" (or lands on app for first time)
2. Frontend redirects to Google OAuth URL with:
   - client_id from env
   - redirect_uri = https://crate-dig.vercel.app/api/youtube/callback
   - scope = https://www.googleapis.com/auth/youtube + email
   - access_type = offline (for refresh token)
   - prompt = consent
3. User signs in with Google + grants YouTube permission
4. Google redirects to /api/youtube/callback with auth code
5. API route exchanges code for tokens (access_token + refresh_token)
6. Tokens stored in youtube_connections table
7. HTTP-only session cookie set (signed with SESSION_SECRET)
8. User redirected to /roll — "YouTube Connected ✓"
```

**This is the ONLY auth flow.** Connecting YouTube = logging in. No separate sign-up/sign-in.

**Token lifecycle:** Access tokens expire after 1 hour. Refresh tokens are long-lived. ytmusicapi handles auto-refresh. Backend updates the stored token in DB after each refresh.

**No Premium required:** OAuth scope `youtube` covers playlist creation on free accounts.

### The 4-Step Chain (exact method signatures)

**Step 1: Search** — Convert CSV text to YouTube videoId
```python
from ytmusicapi import YTMusic
yt = YTMusic(oauth_credentials=token_dict)  # loaded from DB per user

results = yt.search("Daft Punk Around The World", filter="songs", limit=1)
# Returns: [{"videoId": "s9MszVE7aR4", "title": "Around the World",
#            "artists": [{"name": "Daft Punk"}], ...}]
video_id = results[0]["videoId"]
```

**Step 2: Get Related** — Get similar songs from that videoId
```python
related = yt.get_song_related(video_id)
# Returns: list of sections, each with songs having:
#   {"videoId": "xxx", "title": "...", "artists": [{"name": "..."}]}
```

**Step 3: Filter** — Remove songs already in user's library
```python
# Library loaded from Neon (songs JSONB column)
library_set = {f"{s['artist'].lower()}|{s['title'].lower()}" for s in user_songs}
filtered = [
    song for song in related_songs
    if f"{song['artists'][0]['name'].lower()}|{song['title'].lower()}" not in library_set
]
```

**Step 4: Create Playlist** — Push videoIds to YouTube account
```python
video_ids = [song["videoId"] for song in filtered[:desired_count]]
playlist_id = yt.create_playlist(
    title="CrateDig Roll - Feb 22 2026",
    description="Auto-generated by CrateDig",
    privacy_status="PRIVATE",
    video_ids=video_ids
)
# Visible at: youtube.com/playlist?list={playlist_id}
# Also at: music.youtube.com/playlist?list={playlist_id}
```

### Rate Limiting Strategy

```python
import asyncio

async def process_seeds(seeds: list, yt: YTMusic):
    results = []
    for seed in seeds:
        search_result = yt.search(
            f"{seed['artist']} {seed['title']}", filter="songs", limit=1
        )
        await asyncio.sleep(1.5)  # 1.5s between calls

        if search_result:
            related = yt.get_song_related(search_result[0]["videoId"])
            await asyncio.sleep(1.5)
            results.extend(extract_songs(related))

    return results
```

15 seeds (100-song output): `15 × 1.5s + 15 × 1.5s = ~45 seconds`

---

## FastAPI Backend — Endpoints

```
POST /roll                → Receives seeds, returns discovered tracks
POST /create-playlist     → Receives videoIds + title, creates YouTube playlist
GET  /health              → Health check for Render
```

YouTube OAuth is handled by Next.js API routes (frontend), NOT FastAPI. Backend only reads tokens from DB. Single-user = no user ID needed in requests.

### POST /roll — Request/Response

```json
// Request
{
  "seeds": [
    {"artist": "Daft Punk", "title": "Around The World"},
    {"artist": "Boards of Canada", "title": "Roygbiv"}
  ],
  "desired_count": 50
}

// Response
{
  "tracks": [
    {"videoId": "abc123", "title": "Digital Love", "artist": "Daft Punk",
     "thumbnail": "https://..."},
    {"videoId": "def456", "title": "Dayvan Cowboy", "artist": "Boards of Canada",
     "thumbnail": "https://..."}
  ],
  "seeds_used": 8,
  "seeds_failed": 2,
  "raw_found": 127,
  "after_dedup": 89
}
```

### POST /create-playlist — Request/Response

```json
// Request
{
  "title": "CrateDig Roll - Feb 22 2026",
  "video_ids": ["abc123", "def456"]
}

// Response
{
  "playlist_id": "PLxxxxxxx",
  "url": "https://music.youtube.com/playlist?list=PLxxxxxxx",
  "track_count": 50
}
```

---

## Frontend — Technical Detail

### CSV Parsing (client-side with PapaParse)

```typescript
import Papa from 'papaparse';

const ARTIST_COLUMNS = ['artist', 'Artist', 'artist_name', 'ARTIST', 'performer'];
const TITLE_COLUMNS = ['title', 'Title', 'track', 'TITLE', 'song', 'name', 'track_name'];
const GENRE_COLUMNS = ['genre', 'Genre', 'GENRE', 'style'];        // optional, for M3
```

1. CSV parsed in browser via PapaParse (handles comma/semicolon/tab, UTF-8/Latin-1)
2. Minimum required: artist + title columns. Optional: genre. Column mapping auto-detected, user confirms if ambiguous
3. Parsed songs sent to Next.js API route → stored in Neon `libraries.songs` JSONB as `{artist, title, genre?}`
4. On return visits: library loaded from DB, no re-upload needed

**Known CSV format quirk:** DJ software (WUDWUD etc.) exports rows wrapped in one big quoted string with escaped internal double-quotes. PapaParse must handle this — test with real DJ export during M1. Fields: `#, Title, Artist, Album, Length, BPM, Genre, Label, Composer, Remixer, Year, File name`. Genre contains custom user tags ("Prechill", "Drum&Bass", "Deeper", "Hip-Hop", etc.) — not standardized but valuable for M3 GENRE mode. BPM/Year mostly `0` (useless, don't store).

### Dice Algorithms (client-side)

All seed selection happens in the browser from the loaded library. Backend doesn't know about dice modes.

Only artist + title data is available. Two modes that actually work with this data:

**🎲 RANDOM** — pure shuffle across entire library:
```typescript
function random(songs: Song[], count: number): Song[] {
  const shuffled = [...songs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

**🔥 DEEP** — only picks from artists where user has 1-2 tracks (niche corners of the collection):
```typescript
function deep(songs: Song[], count: number): Song[] {
  const artistCounts = new Map<string, number>();
  songs.forEach(s => artistCounts.set(s.artist, (artistCounts.get(s.artist) || 0) + 1));
  const nicheSongs = songs.filter(s => artistCounts.get(s.artist)! <= 2);
  return random(nicheSongs, count);
}
```

### Seed Count Calculation

```typescript
function calculateSeedCount(desiredOutput: number): number {
  return Math.ceil((desiredOutput / 10) * 1.5);
}
// 20 songs → 5 seeds
// 50 songs → 8 seeds
// 100 songs → 15 seeds
```

---

## UI — Pages & Layout

Full design specs in `design/STYLE-GUIDE.md`. Key structural decisions below.

### Brand: Dark Vinyl — Record Store Noir
- **Fonts:** Bebas Neue (logo, heroes, CTAs) + JetBrains Mono (everything else)
- **Colors:** Orange `#F97316` on black `#0A0A0A`. Orange is ONLY for active states, CTAs, artist names
- **Layout:** Single column, 600px max width, mobile-first. No sidebar, no dashboard grid
- **Dark mode ONLY.** No light mode, no gradients, zero shadows except Roll button hover glow
- **Spinning vinyl** — CSS radial-gradient record, always spinning. Speeds up during roll. Soul of the app

### Pages

| Route | Auth | Purpose |
|-------|------|---------|
| `/` | No | Landing page — large vinyl, tagline, "Connect YouTube" CTA |
| `/roll` | Yes | **Main page** — dice mode, slider, roll, preview, push |
| `/library` | Yes | CSV upload, browse library, search, replace CSV |
| `/history` | Yes | Past rolls with thumbnails + YouTube playlist links |
| `/api/youtube/callback` | No | OAuth callback (exchanges code for tokens, sets session) |

### Roll Page (`/roll`) — Main Flow
- Spinning vinyl hero (120px, always spinning)
- "ROLL THE CRATE" headline (Bebas Neue, "CRATE" in orange)
- Status line: "10,247 songs loaded · YouTube connected ✓"
- 2 dice mode buttons: 🎲 RANDOM, 🔥 DEEP (radio behavior)
- Output slider: 10–100 tracks (step: 10)
- Big orange "ROLL THE DICE" CTA (disabled if YouTube not connected)
- Preview track list (appears after roll): artist in orange, title in gray, × to remove
- Push section: playlist name input + "CREATE PLAYLIST ON YT" button
- 4 states: Ready → Rolling (vinyl fast-spin, button pulse) → Preview → Pushed (✓ + YouTube link)

### Library Page (`/library`)
- "YOUR CRATE · {count}" header
- First visit: dashed border upload drop zone
- Loaded: song count + artist count + upload date, searchable track list
- "Replace CSV" link at bottom

### History Page (`/history`)
- "ROLL HISTORY" header
- Table: date, mode emoji, track count, thumbnail, YouTube link
- Last 20 rolls, "Load more" for older
- Empty state: "No rolls yet. Go dig!"

---

## Core Flow — Complete Technical Path

```
1. User lands on app → clicks "Connect YouTube"
   → Google OAuth flow → tokens stored in youtube_connections table
   → Session cookie set → redirected to /roll
   → "YouTube Connected ✓"

2. First visit: uploads CSV on /library page
   → PapaParse parses in browser
   → POST /api/library with parsed songs array
   → Stored in Neon: libraries table (songs as JSONB)
   → UI shows: "Library saved: 10,247 songs"

3. Return visits: library loaded from DB
   → GET /api/library
   → Returns songs array from JSONB
   → No re-upload needed

4. User picks dice mode + output count (e.g. 50 songs)
   → Client runs dice algorithm on loaded library
   → Selects 8 seeds

5. User clicks "Roll"
   → POST {FASTAPI_URL}/roll with seeds array
   → Backend loads YouTube token from DB
   → For each seed: yt.search() → yt.get_watch_playlist(radio=True)
   → Backend deduplicates by videoId
   → Returns raw tracks to frontend
   → Frontend filters against user's library (artist+title match)
   → Trims to desired count
   → Shows preview

6. User reviews, removes unwanted tracks

7. User clicks "Create Playlist"
   → POST {FASTAPI_URL}/create-playlist with videoIds + title
   → Backend loads YouTube token, calls YouTube Data API v3
   → Returns playlist URL
   → Frontend saves roll to Neon (rolls table)
   → UI shows YouTube link
```

---

## Edge Cases — Technical Handling

| Case | Detection | Handling |
|---|---|---|
| Seed not found on YouTube | `yt.search()` returns empty | Skip seed, log in response stats |
| `get_song_related()` empty | No song sections in response | Skip seed, log |
| Rate limited by YouTube | HTTP 429 / connection error | Exponential backoff: 3s → 6s → 12s, max 3 retries |
| CSV encoding issues | PapaParse detection | UTF-8 → Latin-1 → Windows-1252 fallback |
| Ambiguous CSV columns | Multiple matches | Column mapping UI, user confirms |
| Duplicate tracks in CSV | Same artist+title | Dedup on upload before storing |
| YouTube token expired | ytmusicapi auth error | Auto-refresh, update in DB. Re-prompt if refresh fails |
| All seeds fail | 0 valid videoIds | Error: "No seeds found on YouTube. Try rolling again." |
| Library too large | CSV > 50k songs | Warn user, still process (JSONB handles it) |
| User not connected to YouTube | No session cookie / no youtube_connections row | Redirect to landing, show "Connect YouTube" CTA |

---

## Milestones

### M1: Proof of Concept — Validate the Chain
**Goal:** Confirm ytmusicapi chain works end-to-end with a free Google account before building UI.

Deliverable: Single Python script (`poc.py`), no UI, no accounts.

```
- Parse a test CSV (your real 10k library)
- Pick 5 random seeds
- yt.search() each → get videoIds
- yt.get_song_related() each → collect related tracks
- Dedup + filter
- yt.create_playlist() → verify playlist appears on YouTube
```

**M1 answers (VALIDATED 2026-02-22):**
1. `get_watch_playlist(radio=True)` returns ~49 tracks per seed with usable videoIds — YES
2. Playlist creation works on free Google account — YES (via YouTube Data API v3, NOT ytmusicapi)
3. Yield per seed: ~49 tracks (way above expected 10-30)
4. Rate limits: none encountered at 1.5s delay
5. Search hit rate: 5/5 (100%) on DJ/electronic library
6. OAuth: Web Application type + local redirect server. TV device type works for reads but NOT writes

**M1 key finding:** ytmusicapi handles search + related tracks (internal API). Playlist creation must use YouTube Data API v3 (official REST API) — ytmusicapi's create_playlist() returns 401 with Web App OAuth tokens. This means the backend needs BOTH: ytmusicapi for discovery, requests-based YouTube Data API v3 for playlist CRUD.

### M2: Full App
- Google OAuth (login + YouTube connection in one flow)
- Neon database (3 tables: libraries, youtube_connections, rolls)
- Drizzle ORM + migrations
- CSV upload → parse → store in DB
- Library persistence (upload once, use forever)
- 2 dice modes (RANDOM, DEEP)
- Output size slider (10-100)
- Preview with remove
- Create playlist on YouTube (via YouTube Data API v3)
- Roll history page
- Next.js on Vercel + FastAPI on Render
- GitHub repo: `keeltekool/crate-dig`

### M3: Polish + GENRE Dice Mode
- Progress indicator during roll (SSE: "Searching seed 3/8...")
- Re-roll button (same config, new seeds)
- Better search matching (remixes, live versions, features)
- Mobile responsive
- **🎯 GENRE dice mode** — seeds from songs matching a selected genre tag (requires genre data in CSV, already stored in JSONB)
- Genre mode only shown if user's library has enough genre data (>20% filled)

---

## Deployment — Existing Accounts

### Frontend (Vercel)
```bash
gh repo create keeltekool/crate-dig --public --source=.
npx vercel --prod
```

### Backend (Render)
```bash
# Same pattern as HankeRadar
# Build: pip install -r requirements.txt
# Start: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Database (Neon)
New project `crate-dig` in existing Neon account. Drizzle migrations from Next.js side.

### Google Cloud
Reuse existing GCP project (egertv@gmail.com):
- Enable YouTube Data API v3
- Create OAuth 2.0 Web Application credentials
- Redirect URI: `https://crate-dig.vercel.app/api/youtube/callback`

**New accounts: ZERO. New Neon project within existing account. Reuse existing GCP project.**

---

## Project Location

`C:\Users\Kasutaja\Claude_Projects\crate-dig\`

## Brand / Design

**Direction:** Dark Vinyl — Record Store Noir. Full spec in `design/STYLE-GUIDE.md`.

Design assets in `design/`:
- `STYLE-GUIDE.md` — complete component specs, page layouts, all states
- `design-tokens.css` — CSS custom properties
- `tailwind.config.js` — Tailwind theme extension
- `constants.ts` — TypeScript brand constants + dice mode definitions
- `CrateDigLogo.tsx` — React logo component
- `logos/` — SVG logos (primary, compact, light, icon)
- `icons/` — App icon, favicon

**Note:** Style guide has 4 dice modes (RANDOM, GENRE, ERA, DEEP). MVP implements only **RANDOM** and **DEEP**. GENRE deferred to M3 (data exists but needs post-MVP UI). ERA dropped entirely — no reliable year data.
