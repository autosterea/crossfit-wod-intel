# CrossFit WOD Intelligence — Agent Onboarding

A data-science web app analyzing 6,800+ CrossFit Workouts of the Day from
crossfit.com (Feb 2001 - present). 30 components covering 25 years of
programming through information theory, network science, statistical testing,
and 3D visualization.

**Live:** https://wod.persistenceathletics.com/
**Repo:** https://github.com/autosterea/crossfit-wod-intel (public, MIT)
**Hosting:** DigitalOcean VPS (PA droplet), Caddy static `file_server`, no Node runtime needed
**Built by:** Ravikant Dewangan (Head Coach, Persistence Athletics)
**Platform by:** Autosterea

## Stack
- **Framework:** Vite 8 + React 19 + TypeScript 5.9
- **Styling:** Tailwind CSS 4 (`@theme` + CSS variables for light/dark)
- **State:** Zustand (single store at `src/stores/useStore.ts`)
- **Charts:** Recharts 3
- **3D:** Three.js + React Three Fiber + `react-force-graph-3d`
- **Data:** Single JSON bundle at `src/data/crossfit-data.json` (~2.6 MB,
  loaded at app start) — no API, no server, fully static

## Data pipeline (autopilot)

```
                        ┌──────────────────────────────┐
                        │ crossfit.com/workout/Y/M/D   │
                        └──────────────┬───────────────┘
                                       │ scrape (~06:00 PT / ~14:00 UTC, +/- 2h jitter)
                                       ▼
                ┌──────────────────────────────────────────┐
                │ GitHub Action: .github/workflows/daily-wod.yml │
                │ runs scripts/fetch-daily-wod.mjs            │
                │ commits new WOD to main                     │
                └──────────────┬───────────────────────────┘
                               │ git push
                               ▼
                ┌──────────────────────────────────┐
                │ origin/main on GitHub             │
                └──────────────┬───────────────────┘
                               │ polled every 30 min, 14:00-22:00 UTC
                               ▼
                ┌─────────────────────────────────────────────────┐
                │ VPS cron: /etc/cron.d/crossfit-wod-rebuild       │
                │ runs scripts/vps-rebuild-if-changed.sh as `autosterea` │
                │ git fetch; if HEAD advanced: pull + build        │
                │ logs to /var/log/crossfit-wod-rebuild.log        │
                └──────────────┬──────────────────────────────────┘
                               │ writes dist/
                               ▼
                ┌──────────────────────────────────┐
                │ Caddy file_server                 │
                │ /opt/crossfit-wod-intel/dist      │
                │ → wod.persistenceathletics.com    │
                └──────────────────────────────────┘
```

**No manual intervention required.** The fetcher script is defensive: if
crossfit.com is down, returns non-200, or posts a rest-day/journal article
instead of a workout, the script exits cleanly without breaking the data.

**Why poll-based rebuild instead of a single fixed cron time?** GitHub
Actions cron is notoriously jittery — the daily-wod action is scheduled
for 14:00 UTC but can fire anywhere from on-time to 2+ hours late. A
fixed-time VPS rebuild risks pulling before the new commit lands. The
polling script (`scripts/vps-rebuild-if-changed.sh`) runs every 30 min
during the morning window, `git fetch`es, and only triggers `npm run
build` when origin/main has actually advanced — cheap to call frequently
and resilient to upstream timing.

## Hosting

- **Droplet:** DigitalOcean, alias `digitalocean` in `~/.ssh/config` (root for
  admin, services as `autosterea`). IP `146.190.128.19`.
- **Code:** `/opt/crossfit-wod-intel/` owned by `autosterea`.
- **Caddy block** (`/etc/caddy/Caddyfile`) — static file server, no port,
  no systemd service:
  ```caddy
  wod.persistenceathletics.com {
      import security_headers
      root * /opt/crossfit-wod-intel/dist
      encode zstd gzip
      file_server
      header /assets/* Cache-Control "public, max-age=31536000, immutable"
      header *.svg Cache-Control "public, max-age=2592000"
      try_files {path} /index.html
  }
  ```
- **TLS:** Let's Encrypt, auto-provisioned by Caddy.
- **DNS:** Google Cloud DNS (`ns-cloud-e*.googledomains.com`). A record:
  `wod` → `146.190.128.19`.
- **Old GH Pages URL** (`autosterea.github.io/crossfit-wod-intel/`) now
  serves a redirect-only page via `gh-pages-redirect/index.html` published
  by `.github/workflows/deploy.yml`.

## Manual redeploy

After committing code changes:

```bash
ssh digitalocean 'sudo -u autosterea bash -c "cd /opt/crossfit-wod-intel && git pull --ff-only && npm run build"'
```

Caddy picks up new files immediately (no reload needed for a static build).

## Branding

Persistence Athletics design tokens (mirrored from
`Persistence-Athletics/MainSite/persistence-site`):

- **Sea-green** `#019644` — solid buttons, primary CTAs
- **Yellow-green** `#91C640` — accent text on dark backgrounds, badges, active
  states, hover text
- **Hover green** `#a8d35e` — yellow-green hover state
- **Font:** Poppins (Google Fonts, weights 300-800)
- **Logo:** `public/pa-logo.png` (downloaded from PA GHL CDN for self-containment)

Brand colors are intentionally fixed and do not flip with theme.

## Theme system

Light / dark mode is wired via:

1. CSS variables in `src/index.css` under `:root` and `:root[data-theme="light"]`
2. Theme state in `useStore` (`theme: 'dark' | 'light'`) — persisted in
   `localStorage` under key `theme`
3. `setTheme` writes the `data-theme` attribute on `<html>`
4. Components use Tailwind arbitrary `bg-[var(--name)]` classes that resolve
   at runtime
5. Toggle: sun/moon button at the bottom of the sidebar

**Theme tokens (`src/index.css`):**

| Token | Purpose |
|---|---|
| `--app-bg` | Page background |
| `--sidebar-bg` | Sidebar + hero background |
| `--panel-bg` | Card/panel background |
| `--panel-bg-2` | Nested panels (slightly different shade) |
| `--panel-bg-hover` | Hover state for panels and rows |
| `--panel-border` | Card/panel borders |
| `--panel-border-subtle` | Subtle separators |
| `--panel-border-strong` | Emphasis borders |
| `--text-primary` | Headings, main readable text |
| `--text-secondary` | Body text |
| `--text-tertiary` | Labels, subdued text |
| `--text-muted` | Captions, hints |
| `--chart-grid` | Recharts grid lines |
| `--chart-axis` | Axis tick labels |
| `--chart-tooltip-bg` | Tooltip background |
| `--chart-tooltip-border` | Tooltip border |
| `--input-bg`, `--input-border` | Form inputs |
| `--code-bg` | Code blocks, dark inset panels |

**Intentionally NOT theme-aware** (stay the same in both modes):

- PA brand colors
- Data-viz functional palette (modality / category / grade / heatmap colors)
- 3D scene canvas backgrounds (`ForceGraph3DScene`, `Heatmap3DScene`) — stay
  dark for GL readability
- Workout Decoder nutrition label — intentionally inverted B&W design
- Text on solid colored bg (PA buttons, modality chips)

## Tab structure (`src/components/Sidebar.tsx`)

| Section | Tabs |
|---|---|
| OVERVIEW | **Today's WOD**, Dashboard, Report Card, Calendar Heatmap |
| FITNESS MODEL | 10 Physical Skills, Push/Pull/Squat, Energy Systems, Work Capacity |
| ADVANCED ANALYSIS | Variance Analysis, Hopper Readiness, Network Science, What's Missing |
| VISUALIZATIONS | Movement Map, Movement Pairs, Co-occurrence Grid |
| DEEP ANALYSIS | Movement DNA, Movement Timeline, Era Evolution, Year vs Year, Pattern Insights, Reps & Loading |
| DATABASE | All 80 Movements, Workout Decoder, All Workouts, Named WODs |
| ABOUT | Methodology & Sources |

The **Today's WOD** tab (`DailyWod.tsx`) is the primary daily entry point:
- Today's WOD prominent with "Live from crossfit.com" indicator
- Date picker + prev/next arrows + "Today" button
- Amber banner for non-workout days (journal articles, rest days)
- Classification chips (modality, structure, time domain, load profile)
- Detected movements
- Similar workouts via Jaccard similarity
- Named WOD / Hero / Benchmark badges

## Games Almanac (`/games`)

A standalone page (CrossFit Games history 2007–2025, individual elite
division) served by the same SPA bundle. `src/main.tsx` branches on
`location.pathname` — `/games`* renders the lazy `src/games/GamesApp.tsx`
(its own chunk; Anton/Barlow Condensed fonts and `games-data.json` load
only on that route). Caddy's existing `try_files {path} /index.html`
covers the routing — no server config needed.

Data pipeline (one-time research, manually re-runnable):
- **Raw research files:** `src/data/games/raw/<year>.json` — one per Games
  year, schema documented in `src/data/games/SCHEMA.md`. Produced by a
  multi-agent research workflow (researcher → adversarial verifier → fixer
  per year, 2026-06); source conflicts are recorded in each event's
  `notes` rather than guessed. 221 events total.
- **Bundle:** `npm run build:games` runs `scripts/build-games-data.mjs`,
  which validates raw files, normalizes movement names via a synonym
  table (≈100 canonical Games movements, each mapped to a daily-WOD
  `wodId` where one exists), assigns eras (ranch/carson/madison/touring),
  computes per-year + per-era aggregates, named-WOD crossovers, champions
  and records, and writes `src/data/games-data.json`. Unmapped movement
  names are printed — extend SYNONYMS in the script, never edit the
  bundle by hand. `--check` validates without writing.
- **Views:** `src/games/` — TimelineView (era-chaptered year cards),
  YearView (almanac event cards), EvolutionView (Recharts trends),
  MovementsView (index + sparklines), LoreView (records, champions wall,
  benchmark crossovers). Routing state in `gamesStore.ts` (real paths via
  pushState: `/games/2014`, `/games/evolution`…).
- To add the 2026 Games later: write `raw/2026.json` per SCHEMA.md, run
  `npm run build:games`, commit both files.
## Capacity Lab (`/games/capacity`)

`src/games/CapacityView.tsx` — operationalizes CrossFit's definition of
fitness ("work capacity across broad time and modal domains") for the top
10 of **every** Games year 2007–2025 plus the multi-stage 2026 season.

- **Data:** `src/data/games/results/<year>.json` (schema:
  `results/SCHEMA.md`). Past years: top-10 per division with per-event
  place/score/points, researched per year (research → adversarial verify →
  fix → audit), anchored to the raw event files. Best source is the
  official leaderboard API
  `c3po.crossfit.com/api/leaderboards/v2/competitions/games/<year>/leaderboards?division=1|2`.
- **Headline metric — Capacity Score:** mean % of best output across all
  events. Within a for-time event all finishers do the same work, so
  output is exactly inverse to time (no model). 1RM events score as % of
  best lift; capped scores are discounted by completed fraction; events
  without scores fall back to placement percentile.
- **Sections:** capacity leaderboard (bars + sparklines), head-to-head
  comparator, power-duration curve, the race (cumulative-position bump
  chart), modal radar (M/G/W + loading/engine), hopper quadrant
  (capacity × consistency), decisive tests (placement-spread), fingerprint
  heatmap.
- **Power-duration curve** needs a per-event work model (kJ); only 2025
  has one (`scripts/games-work-model-2025.mjs`, physiology-audited;
  Critical Power fit P(t)=CP+W′/t over the 2–20 min window, skill/grip and
  marathon-length events shown but excluded). Years without a work model
  show the exact "% of best" curve and hide the toggle.
- **Scoring-direction-aware:** 2008 (cumulative time) and 2009–2010
  (rank-sum) are lower-is-better; build validation + the race chart detect
  direction from rank-vs-total ordering.
- **2026 is multi-stage:** `results/2026.json` uses `stages`
  (open/quarterfinals/games-projected) instead of `divisions`; top-30
  cohort re-ranked within itself; `scripts/build-2026-results.mjs`
  assembles it from a research-workflow output. CapacityView renders a
  year OR a stage through one source-agnostic context.

## 2026 Hub (`/games/2026`)

The dedicated 2026 Games home (mobile-first), feeding the
@CrossFit-games-update Instagram plan (pre/post-event content during the
Games, athlete tagging).

- **Views:** `src/games/Hub2026.tsx` (countdown hero → Jul 24–26 SAP
  Center San Jose, field-forming banner, men/women roster cards,
  interviews feed) and `src/games/AthleteProfile.tsx`
  (`/games/2026/athlete/<slug>`: photo, vitals, year-by-year "Every Games
  appearance" strip, Road to San Jose (Open → QF → Semifinal), embedded
  Dave Castro YouTube interview or "coming" slot, storyline, IG link).
  `src/games/AthleteAvatar.tsx` = photo with monogram fallback;
  `src/games/athletes2026.ts` = data + helpers (countryFlag,
  youtubeEmbed). Routing: `hub`/`athlete` views in `gamesStore.ts`.
- **Data:** `src/data/games/athletes-2026.json` — 23+23 in-person
  qualifiers (7+7 from the online Semifinal pending). Pipeline scripts (in
  order used): `build-2026-athletes.mjs` (assemble from research
  workflow), `merge-2026-refine.mjs` (verified Castro interviews +
  verified-only IG + rank fills), `merge-2026-deep.mjs` (complete official
  per-athlete Games history + HEAD-verified photos),
  `download-2026-photos.mjs` + `resize-2026-photos.mjs` (self-host best
  photos → `public/athletes/<slug>.webp`, 400×520 face-cropped webp).
- **Correctness rules (hard-learned):**
  - Champion flags MUST be grounded against `games-data.json`'s verified
    champions array, never research output. Men: Adler 2023, **Sprague
    2024** (the Lazar Dukic year), Hopper 2025.
  - Interview URLs: only verified Dave Castro YouTube videos from the 2026
    cycle (his channel: `@davecastro6289`); crossfit.com pages, podcasts,
    and prior-cycle videos are wrong. Null > wrong.
  - Instagram: link only verified handles; never guess (wrong tags are
    worse than blanks).
  - Photos: HEAD-verify (200 + image/*) before shipping; self-hosted under
    `public/athletes/` so nothing expires; teen-division Games years don't
    count as individual appearances.
- **Scheduled automation:** remote routine
  `trig_01Bp6dpjAP143dMDiQdbyrhj` ("2026 field lock → Capacity Lab + 2026
  Hub") fires once 2026-06-16 13:00Z: researches the locked 30+30 field +
  semifinal paths, adds the 7+7 with full profiles, refreshes interviews,
  re-bases the projection, builds the Road-to-Games view, tests, pushes
  (VPS auto-rebuild deploys), verifies live, emails ravi@autosterea.com.
  Manage at claude.ai/code/routines.
- **Next phase (planned, not built):** IG share-card generator (portrait
  1080×1350: athlete journey / pre-event prediction / post-event result);
  live Games results ingestion end of July; optional recurring Castro
  interview refresh.
- **Workflow hygiene:** research agents sometimes leave scratch files in
  the repo root (`Usersravik*`, `qf_*`, `open_*.json`, `shed.html` were
  removed); `.gitignore` now covers the known patterns plus `*.local.mjs`
  (local Playwright test scripts). Check `git status` after big agent
  runs.

## Classification (scraper)

`scripts/fetch-daily-wod.mjs` extracts a workout from the crossfit.com page
and classifies it. Iteratively-fixed bugs:

1. **Load regex accepts hyphens, pood, kg, lift+bare-number.**
   `(\d{2,3})[-\s]*(?:lb|pound|#)` for pounds, `(\d{2,3})[-\s]*(?:kg|kilo)`
   converted ×2.2 for kg, `(\d+(?:\.\d+)?)[-\s]*pood` converted ×35 for
   Russian KB, and `(deadlift|clean|snatch|squat|press|jerk|thruster)\s+(\d{2,3})\b`
   for early-CrossFit notation like "Deadlift 225". Negative lookahead
   excludes rep/round/sec/cal so it doesn't match "Deadlift 30 reps".
2. **Named WOD detection restricted to workout header.** Only first ~5
   lines / 250 chars are scanned. Past article markers ("Compare to",
   "Stimulus and Strategy:", "Post time to comments", "Today's Hero
   workout") is commentary, not workout content.
3. **Markdown-stripped header for word-boundary matches.** Before regex,
   `[Name](link)`, `**bold**`, smart-quotes are stripped. Otherwise `\b`
   fails across markdown and legitimate names like `**Fran**` go undetected.
4. **Movement-signature fallback** for famous WODs (Murph, Fran, Helen,
   Grace, Diane, Annie, DT, Cindy) — detects them by movement signature
   when the name only appears in article body.
5. **isHero flag** follows structure detection (`Hero WOD` structure
   promotes `ih: true` even without a named-WOD match).
6. **Rest-day guard.** Detects when extracted text looks like nav/ad
   content (e.g. "CROSSFIT GAMES TICKETS NOW AVAILABLE") with no workout
   markers — stores as "Rest Day" instead of garbage.

**Movement dictionary** (`MOVEMENT_DICT`) currently covers: Run, Row, Bike,
PullUp, MuscleUp, HSPU, HandstandWalk, ToesToBar, RopeClimb, PistolSquat,
BoxJump, Burpee, GHD, DoubleUnders, PushUp, AirSquat, SitUp, Lunge, LSit,
HandstandHold, Dip, WallWalk, KneesToElbows, BackExtension, Plank,
JumpRope, GoodMorning, GroundToOverhead, Clean, Snatch, Deadlift,
BackSquat, FrontSquat, OverheadSquat, ShoulderPress, PushPress, PushJerk,
SplitJerk, Thruster, WallBall, KettlebellSwing, DumbbellWork, Swim, SkiErg.

## Retro-fixing classifications

`scripts/reclassify.mjs` re-runs the classifiers on existing entries:

```bash
# Preview
node scripts/reclassify.mjs --dry-run --conservative
node scripts/reclassify.mjs --dry-run --since 2026-03-26

# Apply
node scripts/reclassify.mjs --conservative                 # safe across all years
node scripts/reclassify.mjs --since 2026-03-26              # all changes, scraper era only
```

**Flags:**
- `--dry-run` — preview without writing
- `--since YYYY-MM-DD` — scope to entries on or after a date
- `--conservative` — only apply additive fixes (add missing movements,
  resolve Unknown modality/load). Skips nw clearing and ih promotion,
  which can regress historical entries that were ingested by a different
  pipeline with cleaner workout text.

**Heuristic:** for full-history runs use `--conservative`. For
scraper-era only (`--since 2026-03-26`), the full reclassify is safe
because the scraper-era data has known patterns the fixes target.

**Cross-year audit history (2026-06-05):** 1062 entries improved across
2001-2026 with the conservative pass. Remaining 1604 weighted-but-no-load
entries are mostly legitimate "Post loads to comments" workouts where the
athlete picks the weight — no number to extract. 218 of those use
bodyweight-relative notation (e.g. Linda's "1.5 BW deadlift") which
would need a new `Bodyweight-Relative` lp category to capture properly
— deferred as a schema change.

## Where to look when something breaks

- **Daily WOD didn't update:** check the GH Action at
  https://github.com/autosterea/crossfit-wod-intel/actions/workflows/daily-wod.yml
  — scheduled for 14:00 UTC daily but GH cron is jittery (can fire 10min
  to 2h late). If green but no new commit, the fetcher saw a rest day or
  article (look at the run log).
- **Site didn't pick up new WOD:** check the VPS cron log:
  `ssh digitalocean 'tail -50 /var/log/crossfit-wod-rebuild.log'`. The
  rebuild runs every 30 min between 14:00-22:00 UTC and only triggers
  `npm run build` when `git fetch` shows a new commit on origin/main.
- **Site down / 502:** check Caddy: `ssh digitalocean 'systemctl status
  caddy'`. The site is purely static so it's hard to break — most issues
  will be the underlying `dist/` directory being missing or empty after a
  failed build.
- **Cert renewal:** Caddy handles this automatically. If you see cert
  errors, check `journalctl -u caddy --since "1 hour ago" | grep -i tls`.

## Hard rules / preferences

- **Don't break existing services on the VPS.** Caddy site blocks for other
  apps live in `/etc/caddy/Caddyfile` — review changes carefully, run
  `caddy validate` before reloading.
- **Keep brand colors fixed.** PA `#019644` / `#91C640` should never be
  themed-out — they're brand identity.
- **3D scenes stay dark.** ForceGraph3DScene and Heatmap3DScene canvases
  retain their dark backgrounds in both themes for GL readability.
- **No analytics or tracking.** The site loads no third-party scripts;
  the only external resources are Google Fonts (Poppins/Inter/JetBrains Mono).
- **No em or en dashes (—, –) in user-facing copy.** Use plain hyphens.
  The user is firm on this (matches the PA brand voice).

## Don't

- Don't add a Node runtime / API server. The whole app is static — adding
  one would complicate hosting for no benefit.
- Don't aggressively reclassify historical entries. The `s` field for old
  workouts (pre-scraper) was set by a different ingestion pipeline that
  may have caught named WODs we can't re-detect from the truncated text.
- Don't rewrite chart hex colors unless they're surface chrome. The
  modality / category / grade palettes are functional information.
- Don't commit large binary assets. The data JSON is 2.6 MB and that's
  already pushing it.
