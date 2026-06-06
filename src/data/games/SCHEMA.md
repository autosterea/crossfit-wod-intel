# CrossFit Games Individual Events — Raw Data Schema

One JSON file per Games year at `app/src/data/games/raw/<year>.json`.
Covers **individual elite division only** (Men + Women), 2007–2025.
2020 is ONE file with both stages (online Stage 1 + Ranch finals) — use the
`stage` field on each event.

Unknown values are `null` — never guess, never omit the key.
Loads in pounds as printed by CrossFit (include kg only if that's how the
event was published). Strings for scores ("8:23", "385 lb", "127 reps").

```jsonc
{
  "year": 2014,
  "venue": "StubHub Center",
  "city": "Carson",
  "region": "California",
  "country": "USA",
  "dates": "July 25–27, 2014",        // human-readable competition dates
  "championMen": "Rich Froning",
  "championWomen": "Camille Leblanc-Bazinet",
  "fieldMen": 43,                      // # individual men who started
  "fieldWomen": 43,
  "formatNotes": "Cuts, points system changes, qualification path notes.",
  "yearSummary": "3–5 sentence narrative: what defined this year's programming, what debuted, how it differed from the year before.",
  "sources": ["https://...", "https://..."],   // year-level sources used
  "events": [
    {
      "id": "2014-05",                 // "<year>-<2-digit order>"
      "order": 5,                      // chronological order as contested
      "stage": "games",                // "games" | "online" (2020 Stage 1 only)
      "name": "21-15-9 Complex",       // official event name
      "aka": null,                     // alternate/community name
      "day": "Saturday",               // day contested, null if unknown
      "description": "Complete workout: format line, rep scheme, every movement with reps, loads M/W, distances, heights. As close to the official card as possible. Multi-line string.",
      "format": "for-time",            // for-time | amrap | max-load | interval | points | tiebreak | other
      "scoring": "time",               // time | reps | load | points | distance
      "timeCapMin": 13,                // minutes, null if none/unknown (interval events: TOTAL window, see convention below)
      "winnerMen": "Rich Froning",
      "winnerWomen": "Camille Leblanc-Bazinet",
      "winningScoreMen": "8:23",
      "winningScoreWomen": "9:12",
      "movements": ["Deadlift", "Cleans", "Snatch"],  // natural names; every distinct movement
      "loads": [                       // one entry per loaded movement
        { "item": "Deadlift", "men": "315 lb", "women": "205 lb" }
      ],
      "equipment": ["barbell", "pull-up bar"],  // lowercase, generic
      "eventTypes": ["couplet"],       // 1–3 from: max-lift | sprint | couplet | triplet | chipper | interval | endurance | run | swim | row | bike | ski | ruck | odd-object | strongman | skill | gymnastics | obstacle | hopper
      "modality": "W",                 // combo of M (monostructural) G (gymnastics) W (weightlifting), e.g. "MGW"
      "timeDomain": "short",           // sprint <5min | short 5–10 | medium 10–20 | long 20–40 | endurance 40+ (use winning time, else cap)
      "loadLevel": "heavy",            // none | light | moderate | heavy | max
      "environment": "stadium",        // stadium | soccer-field | ranch | ocean | lake | river | trail | road | velodrome | offsite | arena | tennis-stadium | other
      "namedWod": null,                // "Amanda", "Murph"… only if a recognized benchmark
      "firstAtGames": ["pegboard"],    // movements/implements debuting at the Games in this event, [] if none
      "notes": "Surprises, rule changes mid-event, famous moments, controversies. null if none.",
      "sources": ["https://..."]       // event-level sources
    }
  ]
}
```

## timeCapMin convention

For single-piece events, `timeCapMin` is the published time cap. For
interval / multi-round events, store the TOTAL event window in minutes,
never the per-round cap:

- Continuous running clock (work windows + programmed rest): the full
  clock, e.g. 8 rounds every 2:00 = 16; 3 x 2:00 work with 4:00 rest
  between rounds = 14; 12-minute running clock with internal rests = 12.
- Rounds separately clocked (no continuous clock, e.g. elimination
  rounds run in heats): the sum of the per-round caps, e.g. 3-3-3
  minute rounds = 9.

Always disclose the per-round structure in `description` and/or `notes`.
`timeDomain` derives from the winning time when one exists, else from
this total-window value.

## Source hierarchy (strongest first)
1. games.crossfit.com official workout pages (`/workouts/games/<year>`) and leaderboard archive
2. Wikipedia "<year> CrossFit Games" (complete event tables + results)
3. Morning Chalk Up / BarBend / WODwell retrospectives
4. Wayback Machine captures of games.crossfit.com for early years

Cross-check at least 2 independent sources for the event list itself.
Early years (2007–2009) are sparsely documented — capture everything findable,
`null` what isn't, and say so in `notes`.
