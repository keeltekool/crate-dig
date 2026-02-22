# CrateDig - PRD

**Last updated:** 2026-02-22

## Problem

10,000+ songs collected over years of DJ crate-digging. Finding NEW music that matches your taste is manual and slow. Existing recommendation engines work off listening history — not your actual curated collection.

## Solution

Web app with user accounts: upload music library as CSV (stored per user), roll randomized dice to pick seed songs, YouTube Music's recommendation engine finds related tracks, pushes them as a playlist directly to your YouTube account.

No AI analysis. No paid subscription. Just randomness + YouTube's algorithm seeded with YOUR songs.

---

## Architecture

```
┌──────────────────────────┐     HTTP/JSON      ┌──────────────────────────┐
│   Next.js 16 Frontend    │ ◄──────────────── │   FastAPI Backend        │
│   Vercel (port 3005)     │ ────────────────► │   Render (port 8000)     │
│                          │                    │                          │
│ - Clerk auth             │                    │ - ytmusicapi calls       │
│ - CSV upload + parsing   │                    │ - YouTube search/related │
│ - Library stored in Neon │                    │ - Playlist creation      │
│ - Dice mode UI           │                    │ - Reads YouTube OAuth    │
│ - Preview list           │                    │   tokens from Neon       │
│ - Roll history           │                    │                          │
└────────────┬─────────────┘                    └────────────┬─────────────┘
             │                                               │
             ▼                                               │
┌──────────────────────────┐                                 │
│   Neon PostgreSQL        │ ◄───────────────────────────────┘
│   (shared database)      │
│                          │
│ - libraries (user CSV)   │
│ - youtube_connections    │
│ - rolls (history)        │
└──────────────────────────┘
```

**Why two services:** `ytmusicapi` is Python-only. No JS/TS equivalent exists. Frontend stays Next.js (matches existing stack — Lead Radar, QuoteKit, etc.). Backend is FastAPI on Render (same pattern as HankeRadar). Both services connect to the same Neon database.

**Auth flow between services:** Frontend authenticates users via Clerk. When calling FastAPI backend, frontend passes the Clerk user ID in request headers. Backend verifies and uses it to load the user's YouTube OAuth token from Neon. No Clerk SDK on the backend — just a trusted user ID passed from the authenticated frontend.

---

## Tech Stack — Exact Packages

### Frontend (Next.js on Vercel)

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.x | App Router, React Server Components |
| react / react-dom | 19.x | UI |
| tailwindcss | 4.x | Styling |
| typescript | 5.x | Type safety |
| @clerk/nextjs | latest | Auth (Google + email signup/login) |
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
| **Clerk** | egertv@gmail.com (existing) | User auth | Free (10k MAU) |
| **Neon** | egertv@gmail.com (existing) | PostgreSQL database | Free (0.5GB) |
| **Google Cloud** | egertv@gmail.com (existing) | YouTube OAuth credentials | Free |

**New accounts required: ZERO.** New Neon project within existing account. New Clerk app within existing account. Reuse existing GCP project.

### Env Vars

**Vercel (frontend):**
| Var | Value |
|-----|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk dashboard (new CrateDig app) |
| `CLERK_SECRET_KEY` | From Clerk dashboard |
| `DATABASE_URL` | Neon connection string (new `crate-dig` project) |
| `NEXT_PUBLIC_API_URL` | `https://crate-dig-api.onrender.com` |

**Render (backend):**
| Var | Value |
|-----|-------|
| `DATABASE_URL` | Same Neon connection string |
| `GOOGLE_CLIENT_ID` | From GCP OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | From GCP OAuth credentials |
| `FRONTEND_URL` | `https://crate-dig.vercel.app` (CORS + redirect) |

---

## Database Schema (Neon + Drizzle)

3 tables. No bloat.

### `libraries` — User's uploaded song collection
```sql
CREATE TABLE libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,     -- one library per user
  filename TEXT NOT NULL,                  -- original CSV filename
  songs JSONB NOT NULL,                    -- array of {artist, title, genre?}
  song_count INTEGER NOT NULL,
  artist_count INTEGER NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Why JSONB instead of a `library_songs` table:** 10k songs × artist + title ≈ 1-2MB of JSON. Single row, no joins, fast read. Neon handles this fine. If we ever need per-song queries we can split later — YAGNI for now.

**Stored fields:** MVP uses only `artist` + `title`. But CSV may contain `genre` — store it as an optional field in the same JSONB objects for M3 GENRE dice mode. No extra cost to store, big cost to re-upload later.

### `youtube_connections` — Per-user YouTube OAuth tokens
```sql
CREATE TABLE youtube_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,     -- one YouTube account per user
  oauth_token JSONB NOT NULL,             -- {access_token, refresh_token, token_type, expires_at}
  connected_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW()
);
```

**Read by FastAPI backend** when making ytmusicapi calls. Backend loads the token, constructs a YTMusic instance, makes the API calls.

### `rolls` — Roll history
```sql
CREATE TABLE rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
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

Roll history is purely for the user's reference — see what they rolled before and revisit playlist links.

---

## YouTube Music Integration — Technical Detail

### YouTube OAuth Flow (per-user)

```
1. User clicks "Connect YouTube" in app (must be logged in via Clerk first)
2. Frontend calls Next.js API route: POST /api/youtube/auth-start
3. API route generates Google OAuth URL with:
   - client_id from env
   - redirect_uri = https://crate-dig.vercel.app/api/youtube/callback
   - scope = https://www.googleapis.com/auth/youtube
   - state = clerk_user_id (encrypted)
4. Frontend redirects user to Google consent screen
5. User grants permission
6. Google redirects to /api/youtube/callback with auth code
7. API route exchanges code for tokens (access_token + refresh_token)
8. Tokens stored in youtube_connections table tied to clerk_user_id
9. User redirected back to app — "YouTube Connected ✓"
```

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
POST /roll                → Receives seeds + clerk_user_id, returns discovered tracks
POST /create-playlist     → Receives videoIds + title + clerk_user_id, creates YouTube playlist
GET  /health              → Health check for Render
```

YouTube OAuth is handled by Next.js API routes (frontend), NOT FastAPI. Backend only reads tokens from DB.

### POST /roll — Request/Response

```json
// Request
{
  "clerk_user_id": "user_2abc...",
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
  "clerk_user_id": "user_2abc...",
  "title": "CrateDig Roll - Feb 22 2026",
  "video_ids": ["abc123", "def456"]
}

// Response
{
  "playlist_id": "PLxxxxxxx",
  "url": "https://www.youtube.com/playlist?list=PLxxxxxxx",
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
| `/` | No | Landing page — large vinyl, tagline, sign in CTA |
| `/sign-in` | No | Clerk sign-in |
| `/sign-up` | No | Clerk sign-up |
| `/roll` | Yes | **Main page** — dice mode, slider, roll, preview, push |
| `/library` | Yes | CSV upload, browse library, search, replace CSV |
| `/history` | Yes | Past rolls with thumbnails + YouTube playlist links |

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
1. User signs up / logs in via Clerk

2. First visit: uploads CSV
   → PapaParse parses in browser
   → POST /api/library with parsed songs array
   → Stored in Neon: libraries table (songs as JSONB)
   → UI shows: "Library saved: 10,247 songs"

3. Return visits: library loaded from DB
   → GET /api/library
   → Returns songs array from JSONB
   → No re-upload needed

4. User connects YouTube (one-time)
   → OAuth flow via GCP → tokens stored in youtube_connections table
   → "YouTube Connected ✓"

5. User picks dice mode + output count (e.g. 50 songs)
   → Client runs dice algorithm on loaded library
   → Selects 8 seeds

6. User clicks "Roll"
   → POST {FASTAPI_URL}/roll with seeds + clerk_user_id
   → Backend loads YouTube token from DB for this user
   → For each seed: yt.search() → yt.get_song_related()
   → Backend deduplicates by videoId
   → Returns raw tracks to frontend
   → Frontend filters against user's library (artist+title match)
   → Trims to exactly 50
   → Shows preview

7. User reviews, removes unwanted tracks

8. User clicks "Create Playlist"
   → POST {FASTAPI_URL}/create-playlist with videoIds + title + clerk_user_id
   → Backend loads YouTube token, calls yt.create_playlist()
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
| User not connected to YouTube | No youtube_connections row | Gray out Roll button, show "Connect YouTube first" |

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

**M1 answers:**
1. Does `get_song_related()` return tracks with usable videoIds?
2. Does `create_playlist()` work on a free Google account?
3. Actual yield per seed (expected 10-30)
4. Practical rate limits (expected 1-2s delay sufficient)
5. OAuth setup mechanics (browser cookie vs OAuth)

### M2: Full App
- Clerk auth (sign up / login)
- Neon database (3 tables: libraries, youtube_connections, rolls)
- Drizzle ORM + migrations
- CSV upload → parse → store in DB
- Library persistence (upload once, use forever)
- YouTube OAuth connection per user
- 2 dice modes (RANDOM, DEEP)
- Output size slider (10-100)
- Preview with remove
- Create playlist on YouTube
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

**New accounts: ZERO. New Clerk app + new Neon project within existing accounts.**

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
