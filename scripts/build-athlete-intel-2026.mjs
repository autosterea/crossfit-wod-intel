#!/usr/bin/env node
/*
 * build-athlete-intel-2026.mjs  -  the Athlete Intelligence engine
 * ----------------------------------------------------------------
 * Deterministically computes, for every 2026 individual qualifier, a
 * competition-derived profile (capacity, consistency, 6 modal buckets, 3
 * energy-system scores, 9 measured physical skills, Hopper stacking, a blended
 * Season Rank, strengths/weaknesses, a CP/W' where eligible, a data-confidence
 * grade, and event-level provenance) and writes:
 *     public/projection-2026.json
 * which the /games Intelligence views and the what-if simulator render.
 *
 * GROUND RULES (the owner demands "mathematically true, no made-up data"):
 *  - Reads ONLY committed files (so it runs anywhere, incl. the c3po-blocked
 *    VPS during `npm run build`): results/<year>.json, athlete-history-2026.json,
 *    games-data.json, athletes-2026.json, intel-config.json.
 *  - Every metric is computed here in code from official event results. NOTHING
 *    is LLM-generated. Each athlete carries `tracesTo` (the event ids behind the
 *    numbers) and a `confidence` grade derived from data depth.
 *  - The per-event relative-output formula MIRRORS the audited relOutput() in
 *    src/games/CapacityView.tsx (margin where a time exists, else cohort
 *    placement percentile).
 *  - Skills/energy are PERFORMANCE profiles ("how the athlete performs in tasks
 *    that demand skill X / pathway S"), not lab measurements. Flexibility has no
 *    competition signal and is emitted as unmeasured, never invented.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const P = (...p) => resolve(REPO, ...p)
const readJson = (rel) => JSON.parse(readFileSync(P(rel), 'utf8'))

const CFG = readJson('src/games/intel/intel-config.json')
const SKILLS = CFG.skillOrder
const NSK = SKILLS.length
const UNMEASURED = new Set(CFG.unmeasuredSkills)

/* ----------------------------- parsers (mirror CapacityView) ------------- */
function parseSeconds(score) {
  if (!score || /cap/i.test(score) || /lb|reps?/i.test(score)) return null
  const parts = String(score).trim().split(':').map(parseFloat)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return null
}
const parseLoadLb = (s) => {
  const m = String(s ?? '').match(/([\d.]+)\s*lb/i)
  return m ? parseFloat(m[1]) : null
}
const repsOf = (s) => {
  const m = String(s ?? '').match(/([\d.]+)\s*reps?/i)
  return m ? parseFloat(m[1]) : null
}

/* ----------------------------- math helpers ------------------------------ */
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const sd = (a) => {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length)
}
const round1 = (x) => Math.round(x * 10) / 10
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

/** Linear interpolation into the Gastin crossover for a duration (s). */
function energyWeights(durSec) {
  const X = CFG.energyCrossover.seconds
  const get = (arr) => {
    if (durSec <= X[0]) return arr[0]
    if (durSec >= X[X.length - 1]) return arr[arr.length - 1]
    for (let i = 0; i < X.length - 1; i++) {
      if (durSec <= X[i + 1]) {
        const t = (durSec - X[i]) / (X[i + 1] - X[i])
        return arr[i] + t * (arr[i + 1] - arr[i])
      }
    }
    return arr[arr.length - 1]
  }
  return {
    phosphagen: get(CFG.energyCrossover.phosphagen),
    glycolytic: get(CFG.energyCrossover.glycolytic),
    oxidative: get(CFG.energyCrossover.oxidative),
  }
}

/** 10-skill demand vector for an event from its classification (additive). */
function eventDemand(ev) {
  const v = new Array(NSK).fill(0)
  const add = (row) => row && row.forEach((w, k) => (v[k] += w))
  const mod = String(ev.modality || '')
  if (mod.includes('M')) add(CFG.modalityDemand.M)
  if (mod.includes('G')) add(CFG.modalityDemand.G)
  if (mod.includes('W')) add(CFG.modalityDemand.W)
  add(CFG.loadDemand[ev.loadLevel])
  add(CFG.timeDomainDemand[ev.timeDomain])
  return v
}

/** Representative duration (s) for energy weighting. */
function eventDuration(ev, winSec) {
  if (winSec != null) return winSec
  if (ev.format === 'max-load') return CFG.timeDomainSeconds.maxLoad
  return CFG.timeDomainSeconds[ev.timeDomain] ?? CFG.timeDomainSeconds.medium
}

/** Which modal/time buckets an event belongs to (data-driven from config). */
function eventBuckets(ev) {
  const mod = String(ev.modality || '')
  const out = []
  for (const [key, def] of Object.entries(CFG.modalBuckets)) {
    if (key.startsWith('_')) continue
    if (def.modalityIncludes && mod.includes(def.modalityIncludes)) out.push(key)
    else if (def.loadLevelIn && def.loadLevelIn.includes(ev.loadLevel)) out.push(key)
    else if (def.timeDomainIn && def.timeDomainIn.includes(ev.timeDomain)) out.push(key)
  }
  return out
}

/* ----------------------------- load data --------------------------------- */
const results2026 = readJson('src/data/games/results/2026.json')
const historyFile = readJson('src/data/games/athlete-history-2026.json')
const history = historyFile.history
const c3poMeta = historyFile.meta ?? {} // name -> { age, country } from official 2026 Open entrant
const gamesData = readJson('src/data/games-data.json')
let benchmarksFile = { benchmarks: {} }
try {
  benchmarksFile = readJson('src/data/games/athlete-benchmarks-2026.json')
} catch {
  /* optional: profile renders without it */
}
const benchmarksByName = benchmarksFile.benchmarks ?? {}
let narrativesBySlug = {}
try {
  narrativesBySlug = readJson('src/data/games/athlete-narratives-2026.json').narratives ?? {}
} catch {
  /* optional: PA-voice scouting blurbs, added by the narrative workflow */
}

/** Parse a self-reported benchmark value -> comparable numeric + direction. */
function parseBenchmark(value) {
  const v = String(value)
  let m = v.match(/([\d.]+)\s*lb/i)
  if (m) return { numeric: parseFloat(m[1]), dir: 'higher' }
  m = v.match(/([\d.]+)\s*kg/i)
  if (m) return { numeric: parseFloat(m[1]) * 2.20462, dir: 'higher' }
  m = v.match(/([\d.]+)\s*reps/i)
  if (m) return { numeric: parseFloat(m[1]), dir: 'higher' }
  m = v.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (m) return { numeric: m[3] != null ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2], dir: 'lower' }
  m = v.match(/([\d.]+)/)
  if (m) return { numeric: parseFloat(m[1]), dir: 'higher' }
  return null
}
const athletes2026 = readJson('src/data/games/athletes-2026.json')

// Historical event classification map: eventId -> {modality,timeDomain,loadLevel,format,winM,winW}
const histEventMeta = new Map()
for (const y of gamesData.years ?? []) {
  for (const ev of y.events ?? []) {
    histEventMeta.set(ev.id, {
      id: ev.id,
      name: ev.name,
      modality: ev.modality,
      timeDomain: ev.timeDomain,
      loadLevel: ev.loadLevel,
      format: ev.format,
      winM: ev.winningScoreMen,
      winW: ev.winningScoreWomen,
      year: y.year,
    })
  }
}

// athletes-2026 lookup by name (slug, age, country, appearances)
const metaByName = new Map()
{
  const all = [...(athletes2026.men ?? []), ...(athletes2026.women ?? [])]
  for (const a of all) metaByName.set(a.name, a)
}
const slugify = (n) =>
  n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/* --------- assemble the 2026 (Open + QF) event set + per-athlete cells ---- */
function stage2026(stageKey) {
  const st = results2026.stages?.[stageKey]
  if (!st) return { events: [], cells: { men: new Map(), women: new Map() } }
  const events = (st.events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    format: e.format,
    modality: e.modality,
    timeDomain: e.timeDomain,
    loadLevel: e.loadLevel,
    stage: stageKey,
  }))
  const cells = { men: new Map(), women: new Map() }
  for (const div of ['men', 'women']) {
    for (const a of st.divisions?.[div] ?? []) {
      cells[div].set(a.name, a.events) // [{eventId, place, score, points}]
    }
  }
  return { events, cells }
}
const openS = stage2026('open')
const qfS = stage2026('quarterfinals')
const events2026 = [...openS.events, ...qfS.events]
const eventMeta2026 = new Map(events2026.map((e) => [e.id, e]))

// Merge the EXTRA confirmed qualifiers (athletes-2026.json members who finished
// outside the Open top-30, so they were absent from results/2026.json). Their
// 2026 Open + QF per-event results were fetched into extra-qualifiers-2026.json.
// This makes the intel cohort the FULL field, not just the Open top-30.
const extraByDivision = { men: [], women: [] }
try {
  const extra = readJson('src/data/games/extra-qualifiers-2026.json').athletes
  for (const a of Object.values(extra)) {
    if (!extraByDivision[a.division]) continue
    extraByDivision[a.division].push(a.name)
    const openEvts = (a.events || []).filter((e) => e.eventId.startsWith('2026-open'))
    const qfEvts = (a.events || []).filter((e) => e.eventId.startsWith('2026-qf'))
    if (openEvts.length) openS.cells[a.division].set(a.name, openEvts)
    if (qfEvts.length) qfS.cells[a.division].set(a.name, qfEvts)
  }
} catch {
  /* extra-qualifiers optional */
}
// Qualification status: confirmed in-person qualifiers (in athletes-2026.json)
// vs contenders (Open top-30 still fighting through the online Semifinal).
const qualifiedNames = new Set([...(athletes2026.men ?? []), ...(athletes2026.women ?? [])].map((a) => a.name))

// FIELD LOCK: once the 30+30 field is set (athletes-2026.json meta.fieldLocked),
// the cohort IS the Games field. Drop the Open contenders who did not qualify so
// the projected leaderboard and every within-cohort percentile rank against the
// 60 athletes who will actually be in San Jose - not a 91-deep proxy pool.
const fieldLocked = !!athletes2026.meta?.fieldLocked
if (fieldLocked) {
  for (const div of ['men', 'women']) {
    for (const stage of [openS, qfS]) {
      for (const name of [...stage.cells[div].keys()]) {
        if (!qualifiedNames.has(name)) stage.cells[div].delete(name)
      }
    }
  }
}

/* For each 2026 event, compute the cohort reference (best output) + placement
   ranking per division, so rel mirrors CapacityView (margin where timed). */
function buildEventRefs(div) {
  const refs = new Map() // eventId -> { bestSec, bestLb, bestReps, placeRank: Map(name->1..N) }
  for (const ev of events2026) {
    const cellsMap = (ev.stage === 'open' ? openS : qfS).cells[div]
    const rows = []
    for (const [name, evs] of cellsMap) {
      const c = evs.find((x) => x.eventId === ev.id)
      if (c) rows.push({ name, place: c.place, score: c.score })
    }
    const secs = rows.map((r) => parseSeconds(r.score)).filter((v) => v != null)
    const lbs = rows.map((r) => parseLoadLb(r.score)).filter((v) => v != null)
    const reps = rows.map((r) => repsOf(r.score)).filter((v) => v != null)
    const placeSorted = [...rows].sort((a, b) => a.place - b.place)
    const placeRank = new Map(placeSorted.map((r, i) => [r.name, i + 1]))
    refs.set(ev.id, {
      bestSec: secs.length ? Math.min(...secs) : null,
      bestLb: lbs.length ? Math.max(...lbs) : null,
      bestReps: reps.length ? Math.max(...reps) : null,
      placeRank,
      n: rows.length,
    })
  }
  return refs
}

/* ----------------------------- the engine -------------------------------- */
function buildDivision(div) {
  const refs = buildEventRefs(div)
  let cohortNames = [
    ...(results2026.stages.open.divisions[div] ?? []).map((a) => a.name),
    ...(extraByDivision[div] ?? []),
  ]
  if (fieldLocked) cohortNames = cohortNames.filter((n) => qualifiedNames.has(n))
  cohortNames = [...new Set(cohortNames)]

  // PER-EVENT METRIC = placement percentile within that event's OWN field
  // (2026 events: within the 30-cohort; prior Games: within that Games' field).
  // This is baseline-independent, so 2026 and every prior Games combine FAIRLY
  // (unlike margin-vs-winner, whose denominator differs by competition), and it
  // is the most valid basis for a placement sport (the Games scores by finish).
  // perf in [0,100] = percent of the field beaten on that event.
  const bucketKeyList = Object.keys(CFG.modalBuckets).filter((k) => !k.startsWith('_'))
  const athletes = cohortNames.map((name) => {
    const evlist = [] // { eventId, name, perf, demand[], dur, buckets[], year, stage, place, fieldSize }

    // 2026 Open + QF (within-cohort placement percentile)
    for (const ev of events2026) {
      const cellsMap = (ev.stage === 'open' ? openS : qfS).cells[div]
      const c = cellsMap.get(name)?.find((x) => x.eventId === ev.id)
      if (!c) continue
      const ref = refs.get(ev.id)
      const pr = ref.placeRank.get(name) ?? ref.n
      const perf = clamp(((ref.n - pr + 1) / ref.n) * 100, 0, 100)
      evlist.push({
        eventId: ev.id,
        name: ev.name,
        perf,
        demand: eventDemand(ev),
        dur: eventDuration(ev, ev.format === 'max-load' ? null : ref.bestSec),
        buckets: eventBuckets(ev),
        year: 2026,
        stage: ev.stage,
        place: c.place,
        fieldSize: ref.n,
      })
    }

    // Prior Games (within-Games-field placement percentile)
    for (const g of history[name]?.games ?? []) {
      for (const e of g.events) {
        const meta = histEventMeta.get(e.eventId)
        if (!meta) continue
        const win = div === 'men' ? meta.winM : meta.winW
        const winSec = meta.format === 'max-load' ? null : parseSeconds(win)
        const perf = clamp(((g.fieldSize - e.place + 1) / g.fieldSize) * 100, 0, 100)
        evlist.push({
          eventId: e.eventId,
          name: meta.name,
          perf,
          demand: eventDemand(meta),
          dur: eventDuration(meta, winSec),
          buckets: eventBuckets(meta),
          year: g.year,
          stage: 'games',
          place: e.place,
          fieldSize: g.fieldSize,
        })
      }
    }

    // Per-appearance Games history summary (from the Games subset above).
    const gamesHistory = []
    for (const g of history[name]?.games ?? []) {
      const evs = evlist.filter((e) => e.stage === 'games' && e.year === g.year)
      gamesHistory.push({
        year: g.year,
        overallRank: g.overallRank,
        fieldSize: g.fieldSize,
        finishPct: round1(((g.fieldSize - g.overallRank + 1) / g.fieldSize) * 100),
        capacity: round1(mean(evs.map((e) => e.perf))),
        nEvents: evs.length,
      })
    }
    gamesHistory.sort((x, y) => y.year - x.year)

    return { name, evlist, gamesHistory }
  })

  // Metrics: one consistent placement-percentile basis for everything.
  for (const a of athletes) {
    const all = a.evlist.map((e) => e.perf)
    const season = a.evlist.filter((e) => e.year === 2026).map((e) => e.perf)
    a.capacity = round1(mean(all)) // field-percentile capacity across ALL competition events
    a.seasonCapacity = season.length ? round1(mean(season)) : 0 // 2026 only
    a.consistency = round1(100 - sd(all))
    a.nEvents = all.length
    a.nGamesEvents = a.gamesHistory.reduce((s, g) => s + g.nEvents, 0)
    a.nGamesAppearances = a.gamesHistory.length

    a.modal = {}
    for (const key of bucketKeyList) {
      const vals = a.evlist.filter((e) => e.buckets.includes(key)).map((e) => e.perf)
      a.modal[key] = vals.length ? round1(mean(vals)) : null
    }

    // Energy-system performance scores (Gastin-weighted mean of perf)
    const acc = { phosphagen: [0, 0], glycolytic: [0, 0], oxidative: [0, 0] }
    for (const e of a.evlist) {
      const w = energyWeights(e.dur)
      for (const s of ['phosphagen', 'glycolytic', 'oxidative']) {
        acc[s][0] += e.perf * (w[s] / 100)
        acc[s][1] += w[s] / 100
      }
    }
    a.energy = {
      phosphagen: acc.phosphagen[1] ? round1(acc.phosphagen[0] / acc.phosphagen[1]) : null,
      glycolytic: acc.glycolytic[1] ? round1(acc.glycolytic[0] / acc.glycolytic[1]) : null,
      oxidative: acc.oxidative[1] ? round1(acc.oxidative[0] / acc.oxidative[1]) : null,
    }

    // Skills derived from the DIFFERENTIATED modal/time axes (a.modal). Each
    // skill = weighted mean of the athlete's perf on its grounding axes
    // (skillFromAxes). This inherits the axes' real differentiation (a
    // strength athlete spikes Strength, an engine athlete spikes Endurance)
    // instead of washing out across broad per-event demand. 0-100, field-relative.
    a.skillRaw = SKILLS.map((skill) => {
      if (UNMEASURED.has(skill)) return null
      const axes = CFG.skillFromAxes[skill]
      let num = 0
      let den = 0
      for (const [axis, w] of Object.entries(axes)) {
        if (a.modal[axis] != null) {
          num += a.modal[axis] * w
          den += w
        }
      }
      return den > 0 ? round1(num / den) : null
    })

    // prior-Games form: decayed capacity of the most recent 1-2 Games (each
    // already on the same placement-percentile basis). Null for rookies.
    const recent = a.gamesHistory.slice(0, 2)
    a.priorForm =
      recent.length === 0
        ? null
        : round1(
            recent.reduce((s, g, i) => {
              const decay = Math.pow(CFG.seasonRankWeights.priorGamesDecay, Math.max(0, 2026 - g.year - 1))
              return s + g.capacity * decay * (i === 0 ? 1 : 0.6)
            }, 0) / recent.reduce((s, _g, i) => s + (i === 0 ? 1 : 0.6), 0),
          )
  }

  // Cohort-relative percentile of each modal bucket (for the strengths "vs field" tag)
  const bucketPct = {}
  for (const key of bucketKeyList) {
    const vals = athletes.map((a) => a.modal[key]).filter((v) => v != null)
    bucketPct[key] = (v) => (v == null ? null : Math.round((vals.filter((x) => x < v).length / (vals.length - 1 || 1)) * 100))
  }

  // Season-rank blend
  const seasonVals = athletes.map((a) => a.seasonCapacity)
  const sMean = mean(seasonVals)
  const sSd = sd(seasonVals) || 1
  for (const a of athletes) {
    const am = metaByName.get(a.name)
    const age = am?.age ?? c3poMeta[a.name]?.age ?? null
    const { agePeakLow, agePeakHigh, ageFalloffPerYear } = CFG.seasonRankWeights
    let ageFactor = 1
    if (age != null) {
      if (age < agePeakLow) ageFactor = 1 - ageFalloffPerYear * (agePeakLow - age)
      else if (age > agePeakHigh) ageFactor = 1 - ageFalloffPerYear * (age - agePeakHigh)
    }
    ageFactor = clamp(ageFactor, 0.7, 1)

    // components on a 0-100 scale
    const seasonComp = a.seasonCapacity
    const priorComp = a.priorForm ?? 0
    const ageComp = ageFactor * 100
    const w = CFG.seasonRankWeights
    const blended = w.season * seasonComp + w.priorForm * priorComp + w.age * ageComp
    a.seasonRank = {
      score: round1(blended),
      seasonZ: round1((a.seasonCapacity - sMean) / sSd),
      components: { season: round1(seasonComp), priorForm: a.priorForm, age: round1(ageComp) },
      age,
      ageFactor: round1(ageFactor),
      rookie: a.priorForm == null,
    }

    // confidence from data DEPTH (proven Games history). Everyone has 7 season
    // events; the differentiator is multi-year Games sample size.
    if (a.nGamesAppearances >= 3) a.confidence = 'high'
    else if (a.nGamesAppearances === 0) a.confidence = 'low'
    else a.confidence = 'medium'

    // strengths / weaknesses = the athlete's OWN best/worst modal buckets,
    // annotated with where that ranks vs the field (cohort percentile).
    const bucketScores = bucketKeyList
      .map((key) => ({ key, label: CFG.modalBuckets[key].label, val: a.modal[key], pct: bucketPct[key](a.modal[key]) }))
      .filter((b) => b.val != null)
      .sort((x, y) => y.val - x.val)
    const driving = (key) =>
      a.evlist
        .filter((e) => e.buckets.includes(key))
        .sort((x, y) => y.perf - x.perf)
        .slice(0, 3)
        .map((e) => ({ event: `${e.year === 2026 ? e.stage : e.year} ${e.name}`, perf: round1(e.perf), place: e.place }))
    a.strengths = bucketScores.slice(0, 2).map((b) => ({ ...b, drivingEvents: driving(b.key) }))
    a.weaknesses = bucketScores
      .slice(-2)
      .reverse()
      .map((b) => ({ ...b, drivingEvents: driving(b.key) }))

    // tracesTo
    a.tracesTo = a.evlist.map((e) => e.eventId)
  }

  // Final season-rank ordering within division
  const ranked = [...athletes].sort((x, y) => y.seasonRank.score - x.seasonRank.score)
  ranked.forEach((a, i) => (a.seasonRank.rank = i + 1))

  return athletes
}

/* ----------------------------- emit -------------------------------------- */
const out = {
  generated: new Date().toISOString(),
  season: 2026,
  fieldProvisional: !fieldLocked && ((results2026.status || '').includes('open') || (results2026.status || '').includes('qf')),
  fieldNote: fieldLocked
    ? 'The 2026 individual field is locked: 30 men and 30 women. Every percentile and rank is computed within this 60-athlete Games field, from their official 2026 Open + Quarterfinals results and all prior Games.'
    : 'Cohort = top 30 per division by 2026 Open+Quarterfinals. The Games field locks after the online Semifinal (~June 16); this profile regenerates when results/2026.json updates.',
  method: {
    skillOrder: SKILLS,
    unmeasuredSkills: CFG.unmeasuredSkills,
    projectionBlend: CFG.projectionBlend,
    seasonRankWeights: CFG.seasonRankWeights,
    modalBuckets: Object.fromEntries(Object.entries(CFG.modalBuckets).map(([k, v]) => [k, v.label])),
    note: 'Skills/energy are competition-derived PERFORMANCE profiles (how the athlete performs in tasks that demand each skill/pathway), not lab measurements. Flexibility is unmeasured. Every number traces to the official event ids in tracesTo.',
  },
  athletes: {},
}

let totalEvents = 0
for (const div of ['men', 'women']) {
  const built = buildDivision(div)

  // Benchmark field-ranking WITHIN this division: for each reported stat name,
  // rank everyone who reported it (kg normalized to lb; times lower-is-better).
  const benchRanks = new Map() // `${benchName}` -> Map(name -> { rank, of, pct })
  const byStat = new Map() // benchName -> [{ name, numeric, dir }]
  for (const a of built) {
    for (const b of benchmarksByName[a.name] ?? []) {
      const p = parseBenchmark(b.value)
      if (!p) continue
      if (!byStat.has(b.name)) byStat.set(b.name, [])
      byStat.get(b.name).push({ name: a.name, numeric: p.numeric, dir: p.dir })
    }
  }
  for (const [statName, entries] of byStat) {
    const sorted = [...entries].sort((x, y) => (x.dir === 'lower' ? x.numeric - y.numeric : y.numeric - x.numeric))
    const of = sorted.length
    sorted.forEach((e, i) => {
      if (!benchRanks.has(statName)) benchRanks.set(statName, new Map())
      benchRanks.get(statName).set(e.name, { rank: i + 1, of, pct: of > 1 ? Math.round(((of - i - 1) / (of - 1)) * 100) : 100 })
    })
  }

  for (const a of built) {
    const am = metaByName.get(a.name)
    const slug = am?.slug || slugify(a.name)
    totalEvents += a.nEvents
    out.athletes[slug] = {
      slug,
      name: a.name,
      division: div,
      status: qualifiedNames.has(a.name) ? 'qualified' : 'contender',
      narrative: narrativesBySlug[slug] ?? null,
      country: am?.country ?? c3poMeta[a.name]?.country ?? null,
      age: am?.age ?? c3poMeta[a.name]?.age ?? null,
      capacity: a.capacity,
      seasonCapacity: a.seasonCapacity,
      consistency: a.consistency,
      modal: a.modal,
      energy: a.energy,
      skills: SKILLS.map((s, k) => ({
        skill: s,
        measured: !UNMEASURED.has(s),
        score: UNMEASURED.has(s) ? null : a.skillRaw[k],
      })),
      hopper: { capacity: a.capacity, consistency: a.consistency },
      seasonRank: a.seasonRank,
      strengths: a.strengths,
      weaknesses: a.weaknesses,
      gamesHistory: a.gamesHistory,
      bestGamesFinish: (() => {
        const f = a.gamesHistory.map((g) => g.overallRank).filter((r) => r >= 1)
        return f.length ? Math.min(...f) : null
      })(),
      benchmarks: (benchmarksByName[a.name] ?? []).map((b) => {
        const r = benchRanks.get(b.name)?.get(a.name)
        return { name: b.name, value: b.value, kind: b.kind, fieldRank: r?.rank ?? null, fieldOf: r?.of ?? null, pct: r?.pct ?? null }
      }),
      confidence: a.confidence,
      dataDepth: {
        seasonEvents: a.evlist.filter((e) => e.year === 2026).length,
        gamesAppearances: a.nGamesAppearances,
        gamesEvents: a.nGamesEvents,
        totalEvents: a.nEvents,
      },
      fingerprint: { skillRaw: a.skillRaw, modal: a.modal },
      tracesTo: a.tracesTo,
    }
  }
}

const outPath = P('public/projection-2026.json')
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
console.error(
  `[intel] wrote ${outPath}\n  ${Object.keys(out.athletes).length} athletes, ${totalEvents} event-cells\n  fieldProvisional=${out.fieldProvisional}`,
)
