# CRATEDIG — Complete Style Guide & Build Spec
## Direction: Dark Vinyl — Record Store Noir

> **Read this entire file before writing any code.**
> This is a B2C music discovery app — NOT a boring SaaS dashboard.
> The app should feel like a record store at midnight: dark, analog, alive.

---

## 1. BRAND IDENTITY

- **Name:** CrateDig
- **Tagline:** Dig deeper into your collection
- **Logo:** Vinyl record icon (concentric grooves + orange center) + "CRATE" white + "DIG" orange
- **Font display:** Bebas Neue — ALL CAPS, wide tracking, bold
- **Font body:** JetBrains Mono — monospace everywhere else (stats, labels, tracks)
- **Palette:** Orange `#F97316` accent on pure black `#0A0A0A`
- **Design DNA:** Dark. Analog. Raw. The app breathes vinyl — grooves, warm tones, zero corporate polish. Everything is dark mode. There is no light mode.

---

## 2. COLOR SYSTEM

### Core Principle
- Background: `#0A0A0A` pure black — the record store at night
- Cards/panels: `#111111` — slightly lifted surfaces
- Borders: `#222222` to `#333333` — subtle groove lines
- Orange is ONLY for: active states, CTAs, artist names, accent highlights
- Everything else is shades of gray on black
- NO other accent colors except status colors (warn/error)

### Primary — Vinyl Orange

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `orange-700` | `#C2410C` | `orange-700` | Pressed/dark state |
| `orange-600` | `#EA580C` | `orange-600` | Hover state |
| `orange-500` | `#F97316` | `orange-500` | **PRIMARY**: buttons, active dice, artist names, links, vinyl center |
| `orange-400` | `#FB923C` | `orange-400` | Hover glow, lighter accents |
| `orange-300` | `#FDBA74` | `orange-300` | Very light text accent |
| `orange-100` | `#FED7AA` | `orange-100` | — |
| `orange-950` | `#431407` | `orange-950` | Button hover bg tint |
| `orange-500/10` | `rgba(249,115,22,0.1)` | `bg-orange-500/10` | Inactive dice hover bg |
| `orange-500/20` | `rgba(249,115,22,0.2)` | `bg-orange-500/20` | Active dice bg |

### Neutrals — The Vinyl Grays

| Hex | Usage |
|-----|-------|
| `#FFFFFF` | Primary text (track titles, headings) |
| `#E5E5E5` | Secondary text |
| `#A3A3A3` | Muted text (timestamps, counts) |
| `#737373` | Placeholder text, disabled |
| `#555555` | Very muted (sub-labels) |
| `#333333` | Borders, dividers, vinyl grooves |
| `#222222` | Subtle borders, card edges |
| `#1A1A1A` | Hover bg, table stripes |
| `#111111` | Card/panel backgrounds |
| `#0A0A0A` | **PAGE BACKGROUND** |
| `#000000` | Deepest black (rarely needed) |

### Status Colors (used sparingly)

| Status | Color | Usage |
|--------|-------|-------|
| Success/Connected | `#22C55E` | YouTube connected ✓, seeds found |
| Warning | `#EAB308` | Missed seeds, rate limits |
| Error | `#EF4444` | Failed seeds, connection errors |
| Info | `#F97316` | General info (uses primary orange) |

---

## 3. TYPOGRAPHY

### Font Import
```html
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Type Scale

| Element | Font | Size | Weight | Color | Extra |
|---------|------|------|--------|-------|-------|
| Logo "CRATE" | Bebas Neue | 28px | 400 | `#FFF` | `letter-spacing:3px` |
| Logo "DIG" | Bebas Neue | 28px | 400 | `#F97316` | `letter-spacing:3px` |
| Page hero "ROLL THE CRATE" | Bebas Neue | 48px | 400 | `#FFF` / `#F97316` | `letter-spacing:4px` mobile: 36px |
| Section label ("DICE MODE") | JetBrains Mono | 10px | 700 | `#555` | `uppercase letter-spacing:2px` |
| Nav links | JetBrains Mono | 12px | 400 | `#666` / `#F97316` active | `uppercase` |
| Status line | JetBrains Mono | 13px | 400 | `#555` | inline green dots for connected |
| Dice label ("RANDOM") | JetBrains Mono | 11px | 700 | `#888` / `#000` active | `uppercase` |
| Slider label ("OUTPUT: 50 TRACKS") | JetBrains Mono | 11px | 400 | `#555` | `uppercase letter-spacing:2px` |
| CTA button text | Bebas Neue | 20px | 400 | `#000` | `letter-spacing:4px` |
| Track artist name | JetBrains Mono | 13px | 600 | `#F97316` | — |
| Track title | JetBrains Mono | 14px | 400 | `#CCC` | — |
| Track index number | JetBrains Mono | 11px | 400 | `#333` | — |
| Stats ("50 tracks · 8 seeds") | JetBrains Mono | 12px | 400 | `#555` | — |
| Playlist name input | JetBrains Mono | 13px | 400 | `#888` | — |
| Roll log entries | JetBrains Mono | 11px | 400 | varies | [OK] green, [WARN] yellow |
| Library count ("10,247") | JetBrains Mono | 16px | 700 | `#F97316` | — |
| "songs loaded" sublabel | JetBrains Mono | 13px | 400 | `#555` | — |
| History table dates | JetBrains Mono | 12px | 400 | `#555` | — |

### Font Rules
- **Bebas Neue**: ONLY for the logo, hero headlines ("ROLL THE CRATE"), and primary CTA buttons. Always uppercase with wide tracking.
- **JetBrains Mono**: EVERYTHING else. Nav, labels, tracks, stats, inputs, buttons (secondary). This is a tool for music nerds — monospace fits.
- **Never use Inter, DM Sans, or any generic sans-serif.** The entire app is Bebas + JetBrains Mono.

---

## 4. COMPONENT PATTERNS

### 4.1 Page Background & Layout

```
Background: #0A0A0A (the darkest)
Layout: single column, centered
Max width: 480px on mobile (full-screen feel), 600px on desktop
Padding: px-5 py-6

NO sidebar. NO dashboard grid. This is a single-flow app.
Pages: Roll (main) → Library → History
Navigation: top bar with logo + nav links
```

### 4.2 Navbar

```
Position: sticky top-0 z-50
Background: #0A0A0A with border-b border-[#1a1a1a]
Height: 56px
Layout: flex justify-between items-center max-w-[600px] mx-auto px-5

Left: Logo (logo-compact) — Bebas Neue 22px
Right: Nav links — JetBrains Mono 12px uppercase
  ROLL (active: #F97316)
  LIBRARY (#666)
  HISTORY (#666)
  hover: #F97316

Active: text color change only, no underline, no bg
```

### 4.3 Spinning Vinyl (Hero element on Roll page)

```
Size: 120px × 120px (mobile: 100px)
Position: centered, above "ROLL THE CRATE" headline

Structure: CSS radial-gradient to simulate vinyl grooves
  radial-gradient(circle,
    #1a1a1a 20%,
    #111 21%, #111 40%,
    #1a1a1a 41%, #1a1a1a 42%,
    #111 43%, #111 60%,
    #0a0a0a 61%
  )

Border: 3px solid #222
Center dot: 20px circle, #F97316 (orange)

Animation: spin 8s linear infinite
  @keyframes spin { from{rotate(0)} to{rotate(360deg)} }

The vinyl should ALWAYS be spinning when the page is visible.
It's not just decoration — it's the heartbeat of the app.
```

### 4.4 Hero Section

```
Text-align: center
Margin-bottom: 28px

Headline: Bebas Neue 48px white, "ROLL THE" + "CRATE" in orange
  letter-spacing: 4px
  Mobile: 36px

Subtitle: JetBrains Mono 13px #555
  "10,247 songs loaded · YouTube connected ✓"
  The "✓" should be #22C55E if connected

This only appears on the Roll page.
```

### 4.5 Dice Mode Selector (THE core interaction)

```
Container: flex gap-2 justify-center flex-wrap

Individual dice button:
  padding: 10px 16px
  border: 1px solid #333
  border-radius: 8px
  background: #111
  font: JetBrains Mono 11px 700 uppercase
  color: #888
  cursor: pointer
  transition: all 0.2s
  display: flex items-center gap-2

  Emoji: 🎲 🎯 ⏰ 🔥 before label text

Hover:
  border-color: #F97316
  color: #F97316

Active (selected):
  border-color: #F97316
  background: #F97316
  color: #000
  font-weight: 700

Only ONE dice mode active at a time (radio behavior).

Dice modes:
  🎲 RANDOM — pure random seed selection
  🎯 GENRE — seeds from dominant genre
  ⏰ ERA — seeds from specific decade
  🔥 DEEP — seeds from least-played / obscure tracks
```

**Tailwind:**
```jsx
{/* Inactive */}
<button className="flex items-center gap-2 px-4 py-2.5 border border-[#333] rounded-lg bg-[#111] font-mono text-[11px] font-bold uppercase text-[#888] hover:border-orange-500 hover:text-orange-500 transition-all">
  🎲 RANDOM
</button>

{/* Active */}
<button className="flex items-center gap-2 px-4 py-2.5 border border-orange-500 rounded-lg bg-orange-500 font-mono text-[11px] font-bold uppercase text-black transition-all">
  🎲 RANDOM
</button>
```

### 4.6 Output Slider

```
Container: text-center, my-5

Label above: JetBrains Mono 11px #555 uppercase tracking-wide
  "OUTPUT: {value} TRACKS" — value updates live

Slider: <input type="range">
  min=10, max=100, step=10
  accent-color: #F97316
  Width: 80% centered
  Track: #333 background, #F97316 fill
  Thumb: #F97316 circle

The label MUST update in real-time as slider moves.
```

### 4.7 Roll Button (Primary CTA)

```
THE most important element on the page.

display: block
margin: 0 auto
padding: 14px 48px
background: #F97316
color: #000
font: Bebas Neue 20px letter-spacing:4px
border: none
border-radius: 8px
cursor: pointer

Hover:
  background: #FB923C
  transform: scale(1.02)
  box-shadow: 0 0 30px rgba(249,115,22,0.2)

Active:
  background: #EA580C
  transform: scale(0.98)

Disabled (YouTube not connected):
  background: #333
  color: #555
  cursor: not-allowed
  No hover effects

Loading state (during roll):
  background: #F97316 with pulse animation
  Text changes to "ROLLING..." with animated dots
  Spinner or vinyl spin animation

Content: "🎲 ROLL THE DICE"
The emoji is part of the button text.
```

### 4.8 Preview Track List

```
Container: mt-6 border-t border-[#1a1a1a] pt-4

Stats bar above list:
  flex justify-between items-center mb-3
  Left: "Preview" in JetBrains Mono 13px #888
  Right: "50 tracks from 8 seeds (2 missed)" in JetBrains Mono 11px #555

Individual track:
  display: flex items-center gap-3
  padding: 10px 0
  border-bottom: 1px solid #111
  transition: background 0.15s
  hover: background #1a1a1a rounded-lg px-2 -mx-2

  Thumbnail: 36px × 36px rounded-md bg-[#1a1a1a]
    Contains 🎵 emoji or YouTube thumbnail
    flex-shrink-0

  Info (flex-1):
    Artist: JetBrains Mono 13px 600 #F97316
    Title: JetBrains Mono 14px 400 #CCC

  Remove button: "×" character
    JetBrains Mono 16px #333
    hover: #F97316
    cursor: pointer

Track rows should be scrollable if list is long (max-height with overflow-y-auto).
```

### 4.9 Push to YouTube Section

```
Container: mt-6 border-t border-[#1a1a1a] pt-4

YouTube status:
  JetBrains Mono 12px
  Connected: "YouTube ✓" with green #22C55E
  Not connected: "YouTube ✗" with #EF4444 + "Connect" link in #F97316

Playlist name input:
  width: 100%
  background: #111
  border: 1px solid #222
  border-radius: 8px
  padding: 10px 14px
  font: JetBrains Mono 13px #888
  placeholder: "CrateDig Roll — {date}"
  focus: border-color #F97316, outline none

Create button:
  width: 100%
  margin-top: 8px
  padding: 12px
  background: #111
  border: 1px solid #F97316
  color: #F97316
  font: JetBrains Mono 13px 600
  border-radius: 8px
  hover: background rgba(249,115,22,0.1)

Success state:
  Button changes to: "✓ PLAYLIST CREATED"
  Below: clickable YouTube link in #F97316
  "→ Open in YouTube Music"
```

### 4.10 Library Page

```
Header: "YOUR CRATE" in Bebas Neue 36px white + " · " + count in orange
Subtitle: "Upload your CSV to build your library" JetBrains Mono 13px #555

Upload area (no library yet):
  border: 2px dashed #333
  border-radius: 12px
  padding: 48px
  text-align: center
  hover: border-color #F97316

  Icon: 📦 text-4xl mb-4
  Text: "Drop your CSV here" JetBrains Mono 14px #888
  Sub: "artist, title — that's all we need" JetBrains Mono 12px #555
  Or: "Browse files" link in #F97316

Library loaded:
  Stats bar:
    "10,247 songs · 842 artists · uploaded 2026-02-22"
    JetBrains Mono 12px #555

  Song list (scrollable):
    Track row: same as preview track (artist orange, title white)
    But no remove button, no thumbnail
    Just: "Artist — Title" per row
    Search/filter input at top

  Replace library:
    Small "Replace CSV" link at bottom, #555, destructive action
```

### 4.11 History Page

```
Header: "ROLL HISTORY" in Bebas Neue 36px white

Table:
  font: JetBrains Mono throughout

  Header row: 10px uppercase #555 tracking-wide
    DATE | MODE | TRACKS | PLAYLIST

  Data rows:
    border-bottom: 1px solid #111
    padding: 10px 0
    
    Date: 12px #555
    Mode: 12px #888 (🎲 RANDOM, 🎯 GENRE, etc.)
    Tracks: 12px #888
    Playlist: link in #F97316, "→ YouTube" 
      hover: underline

  Empty state:
    "No rolls yet. Go dig!" 
    JetBrains Mono 14px #555 centered
    CTA: link to Roll page in #F97316
```

### 4.12 Auth / Landing (Pre-login)

```
Full-screen centered
Background: #0A0A0A

Large spinning vinyl: 200px
Below: "CRATE" white + "DIG" orange in Bebas Neue 64px
Tagline: "Dig deeper into your collection" JetBrains Mono 14px #555

CTA: "Sign In" button — same as Roll button style
  Bebas Neue 18px, orange bg, black text

Below: "Powered by YouTube Music" JetBrains Mono 11px #333
```

---

## 5. PAGE LAYOUTS

### Roll Page (Main)
```
┌──────────────────────────────┐
│ CRATEDIG        ROLL LIB HIST│ ← sticky navbar
├──────────────────────────────┤
│                              │
│        ◎ (spinning vinyl)    │ ← 120px, always spinning
│                              │
│     ROLL THE CRATE           │ ← Bebas Neue hero
│  10,247 songs · YT ✓        │
│                              │
│ [🎲 RANDOM] [🎯] [⏰] [🔥]  │ ← dice mode selector
│                              │
│     OUTPUT: 50 TRACKS        │ ← slider
│  ════════════●═══════════    │
│                              │
│  ┌──────────────────────┐    │
│  │ 🎲 ROLL THE DICE     │    │ ← BIG orange CTA
│  └──────────────────────┘    │
│                              │
│ ─────────────────────────── │
│ Preview · 50 tracks · 8 seeds│
│                              │
│ 🎵 Khruangbin              ×│ ← track list
│    Maria También             │
│ 🎵 Toro y Moi              ×│
│    Ordinary Pleasure         │
│ 🎵 Nujabes                 ×│
│    Feather ft. Cise Starr    │
│ ...                          │
│                              │
│ ─────────────────────────── │
│ YouTube ✓                    │
│ [CrateDig Roll — 2026-02-22]│ ← playlist name input
│ [→ CREATE PLAYLIST ON YT   ]│ ← push button
│                              │
└──────────────────────────────┘
```

### Library Page
```
┌──────────────────────────────┐
│ CRATEDIG        ROLL LIB HIST│
├──────────────────────────────┤
│                              │
│ YOUR CRATE · 10,247          │
│ 842 artists · uploaded today │
│                              │
│ [🔍 Search your library...  ]│
│                              │
│ Khruangbin — Maria También   │
│ Khruangbin — People Every... │
│ Toro y Moi — Ordinary Ple...│
│ Nujabes — Feather ft. Cise  │
│ ...                          │
│                              │
│             Replace CSV      │
└──────────────────────────────┘
```

### History Page
```
┌──────────────────────────────┐
│ CRATEDIG        ROLL LIB HIST│
├──────────────────────────────┤
│                              │
│ ROLL HISTORY                 │
│                              │
│ DATE        MODE   # PLAYLIST│
│ 2026-02-22  🎲 50  → YouTube │
│ 2026-02-20  🎯 30  → YouTube │
│ 2026-02-18  🔥 100 → YouTube │
│                              │
└──────────────────────────────┘
```

---

## 6. ROLL FLOW — States & Transitions

### State 1: Ready (Default)
- Vinyl spinning slowly
- Dice modes visible, one selected
- Slider at default (50)
- "ROLL THE DICE" button active (orange)
- No preview visible

### State 2: Rolling (Processing)
- Button changes to "ROLLING..." with pulse animation
- Vinyl spins faster (animation-duration: 2s instead of 8s)
- Optional: show live log below button
  - "[OK] Searching seed 1: Khruangbin..."
  - "[OK] Found 12 related tracks"
  - "[WARN] Seed 3 not found, skipping..."
  - Progress: "Seed 4/8..."

### State 3: Preview
- Vinyl slows back to normal speed
- Preview section appears with track list
- Stats: "50 tracks from 8 seeds (2 missed)"
- Each track has × to remove
- Push section visible below

### State 4: Pushed
- "CREATE PLAYLIST" button → "✓ PLAYLIST CREATED" green
- YouTube link appears below
- "Roll Again" button appears (resets to State 1)

---

## 7. SHADOWS & BORDERS

| Element | Border | Shadow |
|---------|--------|--------|
| Page | none | none |
| Navbar | `border-b border-[#1a1a1a]` | none |
| Dice buttons (inactive) | `border border-[#333]` | none |
| Dice buttons (active) | `border border-orange-500` | none |
| Roll button | none | none (hover: `shadow-[0_0_30px_rgba(249,115,22,0.2)]`) |
| Track rows | `border-b border-[#111]` | none |
| Cards/panels | `border border-[#222]` | none |
| Input fields | `border border-[#222]` (focus: `border-orange-500`) | none |
| Upload drop zone | `border-2 border-dashed border-[#333]` | none |

**Rule: ZERO shadows on anything except the Roll button hover glow. This is a dark app — shadows don't work on black.**

---

## 8. ANIMATIONS & MICRO-INTERACTIONS

| Element | Animation |
|---------|-----------|
| Vinyl record | `spin 8s linear infinite` (normal), `spin 2s linear infinite` (rolling) |
| Dice button hover | `transition: all 0.2s` border + color |
| Roll button hover | `transition: all 0.2s` + `transform: scale(1.02)` + glow shadow |
| Roll button press | `transform: scale(0.98)` |
| Track row hover | `background: #1a1a1a` with `transition: 0.15s` |
| Remove × hover | color change `#333 → #F97316` |
| Page transitions | fade-in 200ms (between Roll/Library/History) |
| Rolling state | button pulse animation, vinyl speed increase |
| Success state | brief flash of green on "✓ PLAYLIST CREATED" |

---

## 9. FAVICON & META

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0A0A0A">
<meta name="color-scheme" content="dark">
```

---

## 10. IMPLEMENTATION CHECKLIST

### Phase 1: Foundation
- [ ] Set up Bebas Neue + JetBrains Mono
- [ ] Global background: `#0A0A0A`, text: white, font: JetBrains Mono
- [ ] Add favicon and meta tags (theme-color `#0A0A0A`)
- [ ] Create CrateDigLogo component
- [ ] Set up page routing: /roll, /library, /history

### Phase 2: Navbar
- [ ] Sticky top, `#0A0A0A` bg, `border-b border-[#1a1a1a]`
- [ ] Logo left: Bebas Neue "CRATE" white "DIG" orange
- [ ] Nav right: JetBrains Mono 12px uppercase, active = orange

### Phase 3: Roll Page
- [ ] Spinning vinyl CSS component (radial-gradient + animation)
- [ ] Hero: Bebas Neue "ROLL THE CRATE" (CRATE in orange)
- [ ] Status: "X songs loaded · YouTube connected ✓"
- [ ] Dice mode selector (4 buttons, radio behavior, see 4.5)
- [ ] Output slider with live label update
- [ ] Roll button: Bebas Neue, orange bg, black text, hover glow
- [ ] Preview track list (appears after roll)
- [ ] Push section (YouTube status, name input, create button)

### Phase 4: Library Page
- [ ] Hero: Bebas Neue "YOUR CRATE" + count in orange
- [ ] Upload drop zone (dashed border, hover orange)
- [ ] CSV parse + display library
- [ ] Search/filter input
- [ ] Track list (artist orange, title white)

### Phase 5: History Page
- [ ] Hero: Bebas Neue "ROLL HISTORY"
- [ ] Table: date, mode emoji, track count, YouTube link
- [ ] Empty state with CTA

### Phase 6: States & Polish
- [ ] Rolling state: button pulse, vinyl speed up, optional live log
- [ ] Success state: green flash, YouTube link
- [ ] Error states: red messaging
- [ ] Disabled states: gray button when YT not connected
- [ ] Mobile responsive (single column, 100% width)
- [ ] Page transitions (fade)

---

## 11. DO NOT

- ❌ Use any font besides Bebas Neue and JetBrains Mono
- ❌ Add a light mode — this app is DARK ONLY
- ❌ Use shadows (except Roll button hover glow)
- ❌ Use colored backgrounds on cards (keep #111 max)
- ❌ Add a sidebar or multi-column layout — this is a single-column flow
- ❌ Use Inter, DM Sans, Roboto, or any generic sans-serif
- ❌ Add gradients (except the vinyl radial-gradient)
- ❌ Make buttons rounded-full — use rounded-lg (8px)
- ❌ Use blue, green, purple as accent colors — orange #F97316 ONLY
- ❌ Add decorative elements besides the vinyl — keep it raw
- ❌ Make it look like a SaaS dashboard — this is a B2C music tool
- ❌ Forget the spinning vinyl — it's the soul of the app
