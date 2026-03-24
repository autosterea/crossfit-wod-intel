# CrossFit WOD Intelligence

**PhD-level analysis of 25 years of CrossFit programming (2001-2026)**

A data science platform that analyzes 6,779 CrossFit.com Workouts of the Day using information theory, network science, statistical testing, and 3D visualization.

## Features

### CrossFit Fitness Model
- **10 Physical Skills** - Radar analysis across Endurance, Stamina, Strength, Flexibility, Power, Speed, Coordination, Agility, Balance, Accuracy
- **Push/Pull/Squat Balance** - Functional movement pattern analysis with ratio gauges and muscle group coverage
- **Energy Systems** - Phosphagen / Glycolytic / Oxidative classification of every workout
- **Work Capacity** - Analysis across time and modal domains with statistical testing

### PhD-Level Analysis
- **Variance Analysis** - Shannon entropy, Herfindahl-Hirschman Index, Pareto analysis, autocorrelation, Markov chains
- **Hopper Readiness** - Modality x Time Domain coverage matrix with gap detection
- **Network Science** - PageRank, betweenness centrality, community detection on movement co-occurrence graph
- **What's Missing** - Programming gap analysis with actionable recommendations

### 3D Visualizations
- **3D Force Graph** - Interactive movement relationship network in Three.js
- **3D Co-occurrence Terrain** - Movement pairings as a 3D landscape with instanced rendering

### Tools
- **Report Card** - Letter grades (A+ to F) for programming quality
- **Calendar Heatmap** - GitHub-style 25-year workout density visualization
- **Workout Decoder** - Nutrition label for any workout with similarity finder
- **Year vs Year** - Side-by-side comparison of any two years
- **Global Year Filter** - Filter all analysis by any year range

## Tech Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, Three.js, React Three Fiber, Recharts 3, Zustand

## Getting Started

```bash
npm install
npm run dev
```

## Deploy

Push to main branch - GitHub Actions deploys to GitHub Pages automatically.

## Data

6,779 workouts from crossfit.com (Feb 2001 - Mar 2026). 30 movements tracked, co-occurrence network, named WOD directory, era analysis.

## License

MIT
