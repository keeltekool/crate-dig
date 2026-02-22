# CrateDig — STACK.md

> **Purpose:** Internal architecture reference for CrateDig — music discovery app for DJs.
>
> Last updated: 2026-02-22

---

## Services & URLs

| Service | Purpose | URL |
|---------|---------|-----|
| **Vercel** | Frontend hosting | https://crate-dig-two.vercel.app |
| **Render** | FastAPI backend hosting (free tier) | https://cratedig-api.onrender.com |
| **Neon** | PostgreSQL database (shared between frontend + backend) | console.neon.tech → project `neondb` |
| **Google Cloud** | OAuth (YouTube + login) + YouTube Data API v3 | console.cloud.google.com |
| **GitHub** | Source code | https://github.com/keeltekool/crate-dig |

---

## Env Vars

### Vercel (Frontend) — 5 vars

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SESSION_SECRET` | Cookie signing secret |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL (`https://cratedig-api.onrender.com`) |

### Render (Backend) — 2 vars

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string (same DB as frontend) |
| `FRONTEND_URL` | Vercel frontend URL (for CORS) |

### Local Dev — `.env.local`

Same as Vercel vars but `NEXT_PUBLIC_API_URL=http://localhost:8000`.

---

## Architecture

### Split-Stack Design

```
Browser → Vercel (Next.js 16)  → Neon DB (libraries, rolls, youtube_connections)
       → Render (FastAPI)      → YouTube Music (ytmusicapi) + YouTube Data API v3
                               → Neon DB (reads OAuth tokens)
```

- **Frontend (Vercel):** Pages, Google OAuth flow, library upload/parse, roll history CRUD
- **Backend (Render):** YouTube Music search + radio discovery (ytmusicapi), playlist creation (YouTube Data API v3)
- **Why split:** ytmusicapi is Python-only. Next.js handles auth, pages, DB writes. FastAPI handles YouTube Music operations.
- **Shared DB:** Both services read/write the same Neon database. Frontend writes OAuth tokens, backend reads them.

### Auth Flow

1. User clicks "Connect YouTube" → `/api/youtube/connect` → Google OAuth consent
2. Google redirects to `/api/youtube/callback` with auth code
3. Callback exchanges code for tokens, stores in Neon `youtube_connections` table
4. Sets `cratedig_session` cookie (signed with SESSION_SECRET)
5. Middleware checks cookie on protected routes (`/roll`, `/library`, `/history`)
6. **No Clerk/Supabase** — Google OAuth IS the login (single-user app)

### Roll Flow

1. Client picks seed tracks from uploaded library (random or deep mode)
2. Client sends seeds to FastAPI `/roll` endpoint
3. Backend searches YouTube Music for each seed via `yt.search(query, filter="songs")`
4. For each hit, fetches related tracks via `yt.get_watch_playlist(videoId, radio=True)`
5. Deduplicates, returns track list to client
6. User previews, removes unwanted tracks
7. User clicks "Create Playlist" → FastAPI `/create-playlist` → YouTube Data API v3
8. Client saves roll to history via Next.js `/api/rolls`

---

## Tech Stack

### Frontend
- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Drizzle ORM + `@neondatabase/serverless` (HTTP driver)
- PapaParse (CSV library import)
- Bebas Neue + JetBrains Mono fonts (via @fontsource)

### Backend
- Python 3.13, FastAPI 0.115.6, Uvicorn
- ytmusicapi 1.9.1 (YouTube Music search + radio)
- asyncpg 0.30.0 (Neon DB connection)
- requests (YouTube Data API v3 for playlists)

### Brand
- **Dark Vinyl:** black #0A0A0A bg, orange #F97316 accent, Bebas Neue display + JetBrains Mono mono
- Custom vinyl record SVG component with CSS animation

---

## DB Schema (Neon — 3 tables)

```sql
-- DJ library storage
libraries (id uuid PK, filename text, songs jsonb, song_count int, artist_count int, uploaded_at, updated_at)

-- Google OAuth tokens (single-user: always 1 row)
youtube_connections (id uuid PK, google_email text, oauth_token jsonb, connected_at, last_used_at)

-- Roll history
rolls (id uuid PK, dice_mode text, output_size int, seeds_used int, seeds_failed int, tracks_found int, playlist_id text, playlist_url text, thumbnail_url text, rolled_at)
```

---

## API Endpoints

### Next.js API Routes (Vercel)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/youtube/connect` | Redirect to Google OAuth consent |
| GET | `/api/youtube/callback` | OAuth callback — exchange code, store tokens, set cookie |
| GET | `/api/youtube/status` | Check if YouTube is connected |
| GET | `/api/library` | Get uploaded library |
| POST | `/api/library` | Upload/replace library CSV |
| GET | `/api/rolls` | List roll history |
| POST | `/api/rolls` | Save a roll to history |
| GET | `/api/dev-login` | Dev-only login bypass (blocked in production) |

### FastAPI Endpoints (Render)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Health check |
| POST | `/roll` | Search YouTube Music for seeds, get related tracks |
| POST | `/create-playlist` | Create YouTube Music playlist via Data API v3 |

---

## Project Structure

```
crate-dig/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── roll/page.tsx         # Main roll interface
│   │   ├── library/page.tsx      # CSV upload + library view
│   │   ├── history/page.tsx      # Roll history
│   │   ├── layout.tsx            # Root layout
│   │   └── api/
│   │       ├── youtube/connect/  # OAuth redirect
│   │       ├── youtube/callback/ # OAuth callback
│   │       ├── youtube/status/   # Connection status
│   │       ├── library/          # Library CRUD
│   │       ├── rolls/            # Roll history CRUD
│   │       └── dev-login/        # Dev bypass (prod-blocked)
│   ├── components/
│   │   ├── nav.tsx               # Navigation bar
│   │   ├── logo.tsx              # CrateDig logo
│   │   └── vinyl-record.tsx      # Animated vinyl SVG
│   ├── lib/
│   │   ├── db/index.ts           # Drizzle + Neon HTTP setup
│   │   ├── db/schema.ts          # DB schema (3 tables)
│   │   ├── session.ts            # Cookie session helpers
│   │   └── dice.ts               # Seed selection logic
│   └── middleware.ts             # Auth guard (pages only)
├── backend/
│   ├── main.py                   # FastAPI app (roll + playlist)
│   └── requirements.txt          # Python deps
├── drizzle/                      # Migration files
├── render.yaml                   # Render deployment config
└── drizzle.config.ts             # Drizzle Kit config
```

---

## Deployment

### Frontend (Vercel)
- Auto-deploys on push to `master`
- URL: https://crate-dig-two.vercel.app

### Backend (Render)
- Auto-deploys on push to `master` (backend/ directory)
- URL: https://cratedig-api.onrender.com
- **Free tier:** Spins down after 15min inactivity, ~50s cold start
- Config: `render.yaml` (rootDir: backend, Python 3.13)

### Database Migration
```bash
npx drizzle-kit push   # Push schema to Neon (uses .env.local DATABASE_URL)
```

---

## Gotchas

| Gotcha | Fix |
|--------|-----|
| Render free tier cold start ~50s | First request after inactivity is slow. Roll endpoint wakes it up before playlist creation. |
| asyncpg strips `sslmode`/`channel_binding` from URL | Backend `main.py` manually strips these params before creating pool |
| ytmusicapi needs token as temp file | `build_ytmusic()` writes token to temp file, passes to YTMusic(), then deletes |
| ytmusicapi `create_playlist` returns 401 with web OAuth | Use YouTube Data API v3 REST calls for playlist creation instead |
| Google OAuth redirect URIs must be explicit | Must add both `localhost:3005` and `crate-dig-two.vercel.app` callback URLs in Google Cloud Console |
| Render GitHub App needs explicit repo access | GitHub Settings → Installations → Render → Configure → add repo to selected list |
| History save can fail silently | Always check `res.ok` on secondary fetch calls — added error logging in v87f80c6 |
| `@neondatabase/serverless` tagged template only | Use `` sql`...` `` syntax, not `sql("...", [])` — breaks with conventional function call |

---

## Dev Server

```bash
# Frontend
npx next dev -p 3005 --webpack

# Backend
cd backend && uvicorn main:app --reload --port 8000
```

---

## Post-Deploy Smoke Tests

### Quick Check (every deploy)
1. Load landing page — vinyl animation renders, no console errors
2. Load `/roll` — redirects to landing if not authenticated (middleware works)

### Full Test (after auth/API/backend changes)
1. Click "Connect YouTube" → Google OAuth flow completes → redirected to `/roll`
2. Upload library CSV → song count displays
3. Roll dice → tracks appear with thumbnails
4. Create playlist → playlist appears on YouTube Music
5. Check `/history` → new roll entry visible with YT link
