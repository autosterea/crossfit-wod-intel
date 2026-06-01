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
                                       │ scrape (06:00 PT / 14:00 UTC daily)
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
                               │ pull (08:30 PT / 15:30 UTC daily)
                               ▼
                ┌──────────────────────────────────────┐
                │ VPS cron: /etc/cron.d/crossfit-wod-rebuild │
                │ as user `autosterea`                  │
                │ git pull --ff-only && npm ci && npm run build │
                │ logs to /var/log/crossfit-wod-rebuild.log │
                └──────────────┬───────────────────────┘
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

## Classification (scraper)

`scripts/fetch-daily-wod.mjs` extracts a workout from the crossfit.com page
and classifies it. Bugs we've fixed:

1. **Load regex accepts hyphens.** `(\d{2,3})[-\s]*(?:lb|pound|#)` —
   matches "105-lb" / "125-lb" / "185-lb" as well as "105 lb" or "105lb".
2. **Named WOD detection restricted to workout header.** Only the first ~5
   lines / 250 chars of the extracted text are scanned for named-WOD matches.
   Anything past article markers ("Compare to", "Stimulus and Strategy:",
   "Post time to comments", "Today's Hero workout") is treated as
   commentary, not workout content.
3. **Movement-signature fallback** for the 8 famous WODs (Murph, Fran,
   Helen, Grace, Diane, Annie, DT, Cindy) so we still detect them when the
   name only appears in the article body.
4. **isHero flag** follows structure detection (`Hero WOD` structure
   promotes `ih: true` even without a named-WOD match — covers hero
   workouts honoring service members not in our names list).

## Retro-fixing classifications

`scripts/reclassify.mjs` re-runs the classifiers on existing entries:

```bash
node scripts/reclassify.mjs --dry-run --since 2026-03-26   # preview
node scripts/reclassify.mjs --since 2026-03-26              # apply
```

Use the `--since YYYY-MM-DD` flag to scope to scraper-era entries
(daily-wod scraper started running on 2026-03-26). Running unbounded across
all 6800+ entries will rewrite years of historical data with the new
classifier — usually not what you want.

## Where to look when something breaks

- **Daily WOD didn't update:** check the GH Action at
  https://github.com/autosterea/crossfit-wod-intel/actions/workflows/daily-wod.yml
  — it should run at 14:00 UTC every day. If green but no new commit, the
  fetcher saw a rest day or article (look at the run log).
- **Site didn't pick up new WOD:** check the VPS cron log:
  `ssh digitalocean 'tail -50 /var/log/crossfit-wod-rebuild.log'`. Cron is
  scheduled for 15:30 UTC daily.
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
