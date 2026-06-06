#!/usr/bin/env node
// Assemble results/2026.json (multi-stage) from the Open+QF research workflow output.
// Usage: node scripts/build-2026-results.mjs <workflow-output-file>
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'games', 'results', '2026.json')
const src = process.argv[2]
const raw = readFileSync(src, 'utf8')
const parsed = JSON.parse(raw.slice(raw.indexOf('{')))
const data = parsed.result ?? parsed // {men:{...}, women:{...}}

// Event classification (modality M/G/W, loadLevel, timeDomain, format) for the
// 7 stage tests, so the modal radar / fingerprint / curve work like Games years.
const EV_META = {
  '2026-open-01': { modality: 'GW', loadLevel: 'light', timeDomain: 'medium', format: 'for-time' },
  '2026-open-02': { modality: 'GW', loadLevel: 'moderate', timeDomain: 'medium', format: 'for-time' },
  '2026-open-03': { modality: 'GW', loadLevel: 'moderate', timeDomain: 'medium', format: 'for-time' },
  '2026-qf-01': { modality: 'MGW', loadLevel: 'moderate', timeDomain: 'medium', format: 'for-time' },
  '2026-qf-02': { modality: 'GW', loadLevel: 'moderate', timeDomain: 'medium', format: 'for-time' },
  '2026-qf-03': { modality: 'MW', loadLevel: 'heavy', timeDomain: 'sprint', format: 'for-time' },
  '2026-qf-04': { modality: 'MGW', loadLevel: 'moderate', timeDomain: 'long', format: 'for-time' },
}

const shapeEvent = (e, order) => ({
  id: e.eventId,
  order,
  name: e.name,
  description: e.description,
  timeCapMin: e.timeCapMin ?? null,
  format: EV_META[e.eventId]?.format ?? 'for-time',
  scoring: 'time',
  modality: EV_META[e.eventId]?.modality ?? 'MGW',
  loadLevel: EV_META[e.eventId]?.loadLevel ?? 'moderate',
  timeDomain: EV_META[e.eventId]?.timeDomain ?? 'medium',
  // winning score derived from the cohort at render time
  winningScoreMen: null,
  winningScoreWomen: null,
})

// Build one stage's divisions: re-rank the 30-athlete cohort within itself per
// event (so field = 30 and placements are 1..30, internally consistent).
function buildStage(stageKey, eventsMetaMen, eventsMetaWomen) {
  const eventsMeta = (stageKey === 'open' ? eventsMetaMen.openEvents : eventsMetaMen.qfEvents)
  const events = eventsMeta.map((e, i) => shapeEvent(e, i + 1))
  const eventIds = events.map((e) => e.id)

  const divisionFor = (divObj) => {
    const cohort = divObj.athletes
    // per-event: sort cohort by global place asc -> cohort place 1..N
    const cohortPlace = {} // eventId -> Map(name -> place)
    for (const eid of eventIds) {
      const ranked = cohort
        .map((a) => {
          const ev = (stageKey === 'open' ? a.openEvents : a.qfEvents).find((x) => x.eventId === eid)
          return { name: a.name, gp: ev ? ev.place : 1e9, score: ev ? ev.score : null }
        })
        .sort((x, y) => x.gp - y.gp)
      cohortPlace[eid] = new Map(ranked.map((r, i) => [r.name, { place: i + 1, score: r.score }]))
    }
    // athletes with cohort events
    const athletes = cohort.map((a) => {
      const events = eventIds.map((eid) => {
        const cp = cohortPlace[eid].get(a.name)
        return { eventId: eid, place: cp.place, score: cp.score, points: cp.place }
      })
      const totalPoints = events.reduce((s, e) => s + e.points, 0)
      const officialRank = stageKey === 'open' ? a.openRank : a.qfRank
      return { name: a.name, country: a.country ?? null, totalPoints, officialRank, events }
    })
    // stage standing = sort by totalPoints (cohort place-sum, lower better)
    athletes.sort((x, y) => x.totalPoints - y.totalPoints)
    athletes.forEach((a, i) => { a.rank = i + 1 })
    return athletes
  }

  return {
    label: stageKey === 'open' ? 'Open' : 'Quarterfinals',
    events,
    divisions: { men: divisionFor(data.men), women: divisionFor(data.women) },
    sources: [...new Set([...(data.men.sources ?? []), ...(data.women.sources ?? [])])],
  }
}

// Projected season form: all 7 Open + QF tests combined, cohort-reranked.
// A transparent, data-driven proxy for Games form (the real 30-field locks
// ~June 16; the Games run July 24-26). Not the official field.
function buildProjected() {
  const evMeta = [...data.men.openEvents, ...data.men.qfEvents]
  const events = evMeta.map((e, i) => shapeEvent(e, i + 1))
  const eventIds = events.map((e) => e.id)
  const divisionFor = (divObj) => {
    const cohort = divObj.athletes
    const cohortPlace = {}
    for (const eid of eventIds) {
      const ranked = cohort
        .map((a) => {
          const ev = [...a.openEvents, ...(a.qfEvents ?? [])].find((x) => x.eventId === eid)
          return { name: a.name, gp: ev ? ev.place : 1e9, score: ev ? ev.score : null }
        })
        .sort((x, y) => x.gp - y.gp)
      cohortPlace[eid] = new Map(ranked.map((r, i) => [r.name, { place: i + 1, score: r.score }]))
    }
    const athletes = cohort.map((a) => {
      const events = eventIds.map((eid) => {
        const cp = cohortPlace[eid].get(a.name)
        return { eventId: eid, place: cp.place, score: cp.score, points: cp.place }
      })
      return { name: a.name, country: a.country ?? null, totalPoints: events.reduce((s, e) => s + e.points, 0), officialRank: a.openRank, events }
    })
    athletes.sort((x, y) => x.totalPoints - y.totalPoints)
    athletes.forEach((a, i) => { a.rank = i + 1 })
    return athletes
  }
  return {
    label: 'Projected Form',
    projected: true,
    events,
    divisions: { men: divisionFor(data.men), women: divisionFor(data.women) },
    sources: [...new Set([...(data.men.sources ?? []), ...(data.women.sources ?? [])])],
  }
}

const out = {
  year: 2026,
  status: 'open-qf',
  note: 'Top 30 of the 2026 Open per division, analyzed across the Open (3 tests) and Quarterfinals (4 tests). Placements are re-ranked within this 30-athlete cohort. Projected Form combines all 7 tests as a data-driven proxy for Games form. Semifinals (decentralized + online June 11-15) and the actual Games (July 24-26, San Jose) follow as live releases.',
  stages: {
    open: buildStage('open', data.men, data.women),
    quarterfinals: buildStage('qf', data.men, data.women),
    games: buildProjected(),
  },
}

writeFileSync(OUT, JSON.stringify(out, null, 2))
const ev = out.stages.open.events.length + out.stages.quarterfinals.events.length
console.log(`Wrote ${OUT}`)
console.log(`Open: ${out.stages.open.divisions.men.length}M/${out.stages.open.divisions.women.length}W, QF: ${out.stages.quarterfinals.divisions.men.length}M/${out.stages.quarterfinals.divisions.women.length}W; ${ev} events`)
console.log('Open men top 5 by capacity standing:', out.stages.open.divisions.men.slice(0, 5).map((a) => `${a.rank}.${a.name}(${a.totalPoints})`).join('  '))
