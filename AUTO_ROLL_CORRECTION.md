# CrateDig Auto-Roll — Why It Failed and How to Fix It

The previous routine was structurally fragile. This doc explains the failure modes and gives you a corrected routine spec you can paste into Claude Code Routines (or run from any cron — GitHub Actions, Vercel cron, etc.).

> **Heads up:** there is already a GitHub Actions workflow at
> `.github/workflows/auto-roll.yml` doing the same thing on the same 12h
> schedule. It has **the same defects** as the routine (single 90s warmup,
> biased shuffle, no retries on `/roll`, etc.). If you want to keep using it,
> apply the patches in the *Patches for the existing workflow* section below
> and consider whether you still want the Claude routine running in parallel —
> two crons creating duplicate playlists is probably not what you want.

---

## Root cause

`render.yaml` line 15 sets `plan: free` for `cratedig-api`. Render's free tier sleeps a service after **15 minutes of inactivity**. A 12-hour cron means **every single run hits a cold start**.

Cold starts on Render free tier are advertised as ~50s but in practice run **60–150s**, occasionally longer when the dyno scheduler is slow. The previous routine gave the warmup a single 90-second shot — right on the edge — then gave up. That is why you see intermittent failures.

## Other defects in the previous routine

1. **No warmup retry.** One 90s timeout, then `Exit code 28` and stop. A retry loop would catch nearly all cold-start failures.
2. **Biased shuffle.** `arr.sort(() => Math.random() - 0.5)` is not a uniform shuffle. V8's TimSort skews the result, particularly toward the start of the array — and the start is exactly where the routine slices its 8 seeds from. So your "random" seeds are systematically biased toward songs near the top of the library.
3. **No retry on `/roll`.** That endpoint hits YouTube Music search with rate-limited calls. Any single hiccup (network, YouTube 429, OAuth refresh race) kills the run.
4. **No partial recovery.** Five chained network calls; any one failure aborts the entire run with no salvage.
5. **Wasted state.** Each run wakes the backend, does its work, then lets it sleep again — so the next run pays the same cold-start tax.

---

## Fixes — pick a strategy

### Strategy A — Cheapest: fix the routine, keep free tier

Acceptable if you tolerate occasional skipped runs. Changes:

- Warmup: 3 attempts, 90s each, 5s gap between them. Total budget ~5 minutes.
- Replace the shuffle with Fisher–Yates.
- One retry around `/roll` if it returns 0 tracks (with 8 fresh seeds).
- One retry around `/create-playlist` on 5xx.
- Don't fail the whole run if Step 6 (history save) fails — it's already marked non-critical, but make sure your routine actually honors that.

See revised spec below.

### Strategy B — Most reliable: stop the backend from sleeping

Add a **keep-alive cron** that pings `https://cratedig-api.onrender.com/` every **14 minutes**. Now the auto-roll always hits a warm instance.

Easiest implementation: GitHub Actions on this repo with `cron: '*/14 * * * *'` and a single `curl` step. (Don't use Render's own cron — it would also be on the same sleeping instance.)

Render free tier gives **750 instance-hours/month**. Always-on burns ~720h, leaving ~30h margin for redeploys. This works as long as you don't run a second free service on the same account.

### Strategy C — Most robust: harden the existing GitHub Actions workflow

You already have `.github/workflows/auto-roll.yml`. It's structurally the right
place for this logic — real shell, real retries possible, real logs in the
Actions tab. It just needs the same fixes the routine needs (see *Patches for
the existing workflow* below).

If you go this route, **delete the Claude routine entirely** so they don't
both run.

**Recommendation:** Combine **B + C** — keep-alive ping from GitHub Actions
every 14 min so the backend is always warm, and let the existing
`auto-roll.yml` do the 12h roll (after applying the patches).

---

## Revised routine spec

Paste this into a new Claude Code routine (replacing the deleted one). It implements Strategy A — drop-in, no infrastructure changes required.

````markdown
## CrateDig Auto-Roll — Create a Fresh Playlist

### Goal
Create a new YouTube playlist from random seeds in the user's music library.
Tolerant of Render free-tier cold starts and transient YouTube rate-limit errors.

### Step 1: Warm up the backend (with retries)
The backend is on Render free tier and sleeps after 15 min. Cold starts can run
60–150s, so try up to 3 times.

```bash
for attempt in 1 2 3; do
  echo "Warmup attempt $attempt..."
  if curl -s --max-time 90 -o /dev/null -w "%{http_code}" \
       https://cratedig-api.onrender.com/ | grep -q "^2"; then
    echo "Backend is awake."
    break
  fi
  if [ "$attempt" = "3" ]; then
    echo "ERROR: backend unreachable after 3 attempts"
    exit 1
  fi
  sleep 5
done
```

If all three attempts fail, report "CrateDig backend is unreachable after 3
warmup attempts — check Render dashboard" and stop.

### Step 2: Fetch the music library

```bash
curl -s --max-time 30 https://crate-dig-two.vercel.app/api/library
```

If `library` is null or `songs` is empty, report
"No library uploaded — upload songs at crate-dig-two.vercel.app first" and stop.

### Step 3: Pick 8 random seeds (Fisher–Yates, unbiased)

```bash
curl -s https://crate-dig-two.vercel.app/api/library | node -e "
  const lib = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const songs = lib.library.songs.slice();
  // Fisher–Yates shuffle
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]];
  }
  console.log(JSON.stringify(
    songs.slice(0, 8).map(s => ({ artist: s.artist, title: s.title }))
  ));
"
```

Save the result for Step 4.

### Step 4: Roll the dice (with one retry)

POST `https://cratedig-api.onrender.com/roll`
Body: `{"seeds": [...8 seeds...], "desired_count": 50}`

This may take 30–60s due to per-seed YouTube search throttling.

- If 401: report "YouTube token expired — re-authenticate at
  crate-dig-two.vercel.app" and stop.
- If 5xx or `tracks` is empty: pick 8 fresh seeds (rerun Step 3) and retry once.
  If the retry also fails, report the failure with seed details and stop.

### Step 5: Create a YouTube playlist

POST `https://cratedig-api.onrender.com/create-playlist`
Body: `{"title": "CrateDig Auto-Roll YYYY-MM-DD", "video_ids": [...]}`

Use today's date in the title. Extract `video_ids` from the tracks array.
On 5xx, retry once after 5s. On any other failure, report and stop.

### Step 6: Save roll history (non-critical)

POST `https://crate-dig-two.vercel.app/api/rolls` with the body specified in
the original routine. **If this fails, log the error and continue** — do not
report the whole run as failed; the playlist already exists in YouTube.

### Summary format
"Created playlist 'CrateDig Auto-Roll YYYY-MM-DD' with N tracks from 8 seeds
(M failed). URL: https://music.youtube.com/playlist?list=..."
````

---

## Optional: GitHub Actions keep-alive (Strategy B)

Drop this at `.github/workflows/keep-alive.yml`:

```yaml
name: Keep CrateDig backend warm
on:
  schedule:
    - cron: '*/14 * * * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping backend
        run: curl -fsS --max-time 30 https://cratedig-api.onrender.com/ || true
```

The trailing `|| true` keeps the workflow from spamming red Xs in the Actions
tab when the backend takes a moment to wake; the next ping 14 min later will
catch it.

---

## Patches for the existing workflow

The existing `.github/workflows/auto-roll.yml` needs three fixes. Each is a
drop-in replacement for one step.

### Patch 1 — Replace "Wake up backend" with a retry loop

```yaml
      - name: Wake up backend
        run: |
          for attempt in 1 2 3; do
            echo "Warmup attempt $attempt..."
            code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 90 \
                     https://cratedig-api.onrender.com/ || echo "000")
            if [ "$code" = "200" ]; then
              echo "Backend awake."
              exit 0
            fi
            echo "Got HTTP $code, retrying in 5s..."
            sleep 5
          done
          echo "ERROR: backend unreachable after 3 attempts"
          exit 1
```

### Patch 2 — Fix the biased shuffle in "Fetch library and pick seeds"

Replace the inner Node script (lines 35–40 of the current file) with:

```javascript
const lib = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const songs = lib.library.songs.slice();
for (let i = songs.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [songs[i], songs[j]] = [songs[j], songs[i]];
}
console.log(JSON.stringify(
  songs.slice(0, 8).map(s => ({ artist: s.artist, title: s.title }))
));
```

The original `arr.sort(() => Math.random() - 0.5)` is not a uniform shuffle.
With V8's TimSort it skews toward keeping early-array elements early — exactly
the elements being sliced as seeds.

### Patch 3 — Retry "Roll tracks" once on empty/error

Replace the existing curl/parse block in the "Roll tracks" step with:

```yaml
      - name: Roll tracks
        id: roll
        run: |
          seeds='${{ steps.seeds.outputs.seeds }}'
          body=$(node -e "console.log(JSON.stringify({ seeds: $seeds, desired_count: 50 }))")

          for attempt in 1 2; do
            response=$(curl -s --max-time 120 -X POST \
                          https://cratedig-api.onrender.com/roll \
                          -H "Content-Type: application/json" \
                          -d "$body")

            track_count=$(echo "$response" | node -e "
              try {
                const r = JSON.parse(require('fs').readFileSync(0, 'utf8'));
                if (r.detail) { console.error('Roll error:', r.detail); process.exit(2); }
                console.log(r.tracks?.length ?? 0);
              } catch (e) { console.error('Parse error:', e.message); process.exit(2); }
            ") || track_count=0

            if [ "$track_count" -gt 0 ]; then
              echo "Tracks found: $track_count (attempt $attempt)"
              echo "roll_response<<EOF" >> $GITHUB_OUTPUT
              echo "$response" >> $GITHUB_OUTPUT
              echo "EOF" >> $GITHUB_OUTPUT
              exit 0
            fi

            echo "Attempt $attempt returned 0 tracks. Response: $response"
            [ "$attempt" = "2" ] && { echo "ERROR: roll returned 0 tracks twice"; exit 1; }
            sleep 10
          done
```

Note: a real second attempt with *different* seeds requires re-running the
seed-pick step. If you want that, refactor the workflow to call a single
`scripts/auto-roll.mjs` that handles its own retry-with-fresh-seeds logic
(cleaner than chaining multiple workflow steps).

---

## Action checklist

- [ ] Delete the broken routine in the Claude Code web UI.
- [ ] Decide whether the Claude routine and `auto-roll.yml` should both run
      (probably not — pick one).
- [ ] Apply the three patches above to `.github/workflows/auto-roll.yml`.
- [ ] (Strategy B) Add `.github/workflows/keep-alive.yml` so the backend
      never sleeps in the first place.
- [ ] (Long-term) Consider upgrading Render to Starter ($7/mo) to eliminate
      cold-start risk entirely. Would let you delete the keep-alive cron.
