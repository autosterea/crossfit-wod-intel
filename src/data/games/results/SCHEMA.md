# CrossFit Games — Athlete Results Schema (Capacity Lab)

One file per year at `app/src/data/games/results/<year>.json`.
Past years (2007–2024): the **top 10** finishers per division.
2025: top 10 (already done, includes a hand-built `workModel`).
2026: **all 30** per division, with `stages` (see bottom).

The **raw year file** `app/src/data/games/raw/<year>.json` is the verified
anchor: it lists the official event ids, champions, and per-event winners.
Results MUST be consistent with it.

```jsonc
{
  "year": 2014,
  "pointsSystem": "Describe the scoring table used this year (points per place).",
  "sources": ["https://...", "https://..."],
  "divisions": {
    "men": [
      {
        "rank": 1,                 // final overall finish
        "name": "Rich Froning",
        "country": "USA",
        "totalPoints": 1264,       // final points (or null for early years scored differently)
        "events": [
          { "eventId": "2014-01", "place": 4, "score": "8:23.45", "points": 88 }
          // one entry per event in the year, in order
        ]
      }
      // ... 10 athletes (men), ranks 1..10
    ],
    "women": [ /* 10 athletes */ ]
  }
}
```

## Rules (hard)
- `eventId` exactly matches the raw file ids (`<year>-NN`), every event, in order.
- `score`: the leaderboard score display — time `"8:23.45"`, load `"545 lb"`,
  reps `"127 reps"`, or `"CAP+12"`. `null` only when truly unrecoverable
  (common for early-years mid-pack). Place + points are the critical fields.
- `points`: per that year's official table. Every athlete's event points MUST
  sum to `totalPoints` (when totalPoints is a points total; early years that
  used rank-sum or other systems: set totalPoints to the figure the official
  archive shows, and make the event points reconcile, else set totalPoints null
  and explain in sources).
- Top 3 of each division MUST match the raw file's `championMen`/`championWomen`
  (rank 1) and the documented podium.
- For every event, the athlete who is that event's `winnerMen`/`winnerWomen`
  (per the raw file) MUST appear at `place: 1` if they are in the top 10.
- Ranks are sequential 1..N; points descend with rank.

## Self-validation (do this before writing)
1. Arithmetic: each athlete's event points sum to totalPoints.
2. Podium: ranks 1–3 names + order match the raw file.
3. Winners: documented event winners (in top 10) are at place 1 with the
   matching winning score.
4. File parses: `node -e "JSON.parse(require('fs').readFileSync(PATH,'utf8'))"`.

## Sources (strongest first)
1. Official leaderboard archive: `c3po.crossfit.com/api/leaderboards/v2/competitions/games/<year>/leaderboards?division=1` (men) `=2` (women), and `games.crossfit.com/leaderboard/...`.
2. Wikipedia "<year> CrossFit Games" results tables.
3. BarBend / Morning Chalk Up / FitnessVolt / thebarbellspin recaps.
4. Wayback Machine of games.crossfit.com for early years.

Early years (2007–2010) are sparsely documented: capture place + points for the
top 10, `score: null` where unrecoverable, and say so in `sources`/notes. The
Capacity Lab falls back to placement-based output for events without scores.

## 2026 (living, multi-stage)
2026 uses `stages` instead of a single `divisions`:
```jsonc
{
  "year": 2026,
  "status": "in-progress",         // released stages so far
  "stages": {
    "open":         { "label": "Open",          "divisions": { "men": [...30], "women": [...30] }, "events": [...], "sources": [...] },
    "quarterfinals":{ "label": "Quarterfinals", "divisions": { ... }, "events": [...], "sources": [...] },
    "semifinals":   { "label": "Semifinals",    "divisions": { ... }, "events": [...], "sources": [...] },
    "games":        { "label": "Games (projected)", "projected": true, "divisions": { ... }, "events": [...], "sources": [...] }
  }
}
```
Each stage carries its own `events` list (eventId like `2026-open-01`) so the
Capacity Lab can render any stage. 30 athletes per division. The `games` stage
is a projection until the competition runs (late July 2026), then replaced with
live results as workouts and scores are released.
