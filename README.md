# CrossFit WOD Intelligence

**25 years of CrossFit programming analyzed (2001-2026)**

A data science platform that analyzes 6,800+ CrossFit.com Workouts of the Day using information theory, network science, statistical testing, and 3D visualization. A [Persistence Athletics](https://persistenceathletics.com) tool, built by Ravikant Dewangan.

**Live:** [wod.persistenceathletics.com](https://wod.persistenceathletics.com/)

## Features

### CrossFit Fitness Model
- **10 Physical Skills** - Radar analysis across Endurance, Stamina, Strength, Flexibility, Power, Speed, Coordination, Agility, Balance, Accuracy
- **Push/Pull/Squat Balance** - Functional movement pattern analysis with ratio gauges and muscle group coverage
- **Energy Systems** - Phosphagen / Glycolytic / Oxidative classification of every workout
- **Work Capacity** - Analysis across time and modal domains with statistical testing

### Advanced Analysis
- **Variance Analysis** - Shannon entropy, Herfindahl-Hirschman Index, Pareto analysis, autocorrelation, Markov chains
- **Hopper Readiness** - Modality x Time Domain coverage matrix with gap detection
- **Network Science** - PageRank, betweenness centrality, community detection on movement co-occurrence graph
- **What's Missing** - Programming gap analysis with actionable recommendations

### 3D Visualizations
- **3D Force Graph** - Interactive movement relationship network in Three.js
- **3D Co-occurrence Terrain** - Movement pairings as a 3D landscape with instanced rendering

### Tools
- **Today's WOD** - Live daily workout from crossfit.com with classification + date picker to browse any day's analysis
- **Report Card** - Letter grades (A+ to F) for programming quality
- **Calendar Heatmap** - GitHub-style 25-year workout density visualization
- **Workout Decoder** - Nutrition label for any workout with similarity finder
- **Year vs Year** - Side-by-side comparison of any two years
- **Global Year Filter** - Filter all analysis by any year range
- **Light / dark mode** - Theme toggle, persisted in localStorage

## Tech Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, Three.js, React Three Fiber, Recharts 3, Zustand

## Getting Started

```bash
npm install
npm run dev
```

## Hosting

Live site is hosted on a DigitalOcean VPS, served by Caddy as a static `file_server` (no Node runtime, no API). Daily updates are fully automated:

- **GitHub Action** (`.github/workflows/daily-wod.yml`) runs at 14:00 UTC, scrapes the latest WOD from crossfit.com and commits the new data to `main`.
- **VPS cron** (`/etc/cron.d/crossfit-wod-rebuild`) runs at 15:30 UTC, pulls the latest `main` and rebuilds `dist/`. Caddy serves the new files immediately.

The old GH Pages URL (`autosterea.github.io/crossfit-wod-intel/`) now redirects to the VPS via a workflow that publishes only `gh-pages-redirect/index.html`.

See [`CLAUDE.md`](./CLAUDE.md) for full architecture and operational details.

## Data

6,800+ workouts from crossfit.com (Feb 2001 - present). 30 movements tracked, co-occurrence network, named WOD directory, era analysis. Updated daily, automatically.

## License

MIT
