#!/usr/bin/env node
/*
 * rebuild-2026-results-locked.mjs  (OFF-VPS: needs c3po, which the VPS WAF blocks)
 * --------------------------------------------------------------------------------
 * Rebuilds src/data/games/results/2026.json so the Capacity Lab 2026 view ranks the
 * ACTUAL locked field (the 30+30 in athletes-2026.json), not the stale Open-top-30
 * proxy cohort that still carried 15+16 non-qualifying contenders.
 *
 * For each of the 60 locked qualifiers it pulls their official 2026 Open (3 tests)
 * and Quarterfinals (4 tests) per-event scores from the c3po leaderboard API, then
 * re-ranks the 30-athlete cohort within itself per event (places 1..30, points =
 * cohort place, score = official scoreDisplay) - identical math to
 * build-2026-results.mjs, just sourced live and scoped to the locked field.
 *
 * Also writes back into athletes-2026.json (so the Hub/profile and the Capacity Lab
 * never disagree): heightCm / weightKg from the c3po entrant (mass context for the
 * What-If simulator), the official Open/QF overall ranks (openRank2026 / qfRank2026),
 * and a missing crossfitAthleteId (so future re-runs match by id, not name).
 *
 * Event metadata (names, modality, loadLevel, timeDomain) is preserved from the
 * existing results/2026.json so classification stays stable.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')
const RESULTS = join(REPO, 'src', 'data', 'games', 'results', '2026.json')
const ATHLETES = join(REPO, 'src', 'data', 'games', 'athletes-2026.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
const C3PO = 'https://c3po.crossfit.com/api/leaderboards/v2/competitions'

const existing = JSON.parse(readFileSync(RESULTS, 'utf8'))
const athletes = JSON.parse(readFileSync(ATHLETES, 'utf8'))

const TRANSLIT = { 'ł': 'l', 'ø': 'o', 'đ': 'd', 'ß': 'ss', 'ı': 'i', 'ð': 'd', 'þ': 'th' }
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[łøđßıðþ]/g, (c) => TRANSLIT[c] || c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (r.ok) return await r.json()
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 600))
  }
  return null
}

// Pull a division leaderboard for a competition, keyed by competitorId AND
// normalized name. Stops EARLY once every athlete we need (need = {ids,names})
// has been seen - the locked 60 are elite and cluster near the top, so we avoid
// paging the full multi-thousand field. Hard page cap as a backstop.
async function pullComp(comp, divisionNum, need) {
  const byId = new Map()
  const byName = new Map()
  let page = 1
  let totalPages = 1
  const seen = () => [...need.ids].filter((id) => byId.has(id)).length + [...need.names].filter((n) => byName.has(n) && ![...need.ids].some((id) => byId.get(id) && norm(byId.get(id).entrant.competitorName) === n)).length
  do {
    const j = await fetchJson(`${C3PO}/${comp}/2026/leaderboards?division=${divisionNum}&sort=0&page=${page}`)
    if (!j) break
    totalPages = j.pagination?.totalPages ?? 1
    for (const row of j.leaderboardRows || []) {
      byId.set(String(row.entrant.competitorId), row)
      byName.set(norm(row.entrant.competitorName), row)
    }
    // early-exit: all needed ids present AND all needed names present
    const idsFound = [...need.ids].every((id) => byId.has(id))
    const namesFound = [...need.names].every((n) => byName.has(n))
    if (idsFound && namesFound) break
    page++
  } while (page <= totalPages && page <= 150)
  return { byId, byName }
}

const inToCm = (h) => {
  const m = String(h || '').match(/([\d.]+)\s*in/i)
  return m ? Math.round(parseFloat(m[1]) * 2.54) : null
}
const lbToKg = (w) => {
  const m = String(w || '').match(/([\d.]+)\s*lb/i)
  return m ? Math.round(parseFloat(m[1]) * 0.45359) : null
}

// Map a c3po row's scores[] (ordinal 1..n) to our eventIds for a stage.
function rowEvents(row, eventIds) {
  const scores = [...(row.scores || [])].sort((a, b) => a.ordinal - b.ordinal)
  return eventIds.map((eid, i) => {
    const s = scores[i]
    return {
      eventId: eid,
      place: s ? parseInt(s.rank, 10) || 999 : 999, // official per-event rank (re-ranked within cohort below)
      score: s ? s.scoreDisplay || '' : '',
    }
  })
}

async function run() {
  const openEventIds = existing.stages.open.events.map((e) => e.id)
  const qfEventIds = existing.stages.quarterfinals.events.map((e) => e.id)

  const need = (div) => ({
    ids: new Set(athletes[div].map((a) => String(a.crossfitAthleteId ?? '')).filter((x) => x && x !== 'undefined')),
    names: new Set(athletes[div].map((a) => norm(a.name))),
  })
  const needM = need('men')
  const needW = need('women')
  const comps = {
    men: { open: await pullComp('open', 1, needM), qf: await pullComp('quarterfinalsindividual', 1, needM) },
    women: { open: await pullComp('open', 2, needW), qf: await pullComp('quarterfinalsindividual', 2, needW) },
  }

  const unmatched = []
  const vitalsBackfill = []
  const data = { men: { athletes: [], sources: ['c3po.crossfit.com official 2026 Open + Quarterfinals leaderboards'] }, women: { athletes: [], sources: ['c3po.crossfit.com official 2026 Open + Quarterfinals leaderboards'] } }

  for (const div of ['men', 'women']) {
    for (const a of athletes[div]) {
      const id = String(a.crossfitAthleteId ?? '')
      const findIn = (pool) => pool.byId.get(id) || pool.byName.get(norm(a.name))
      const openRow = findIn(comps[div].open)
      const qfRow = findIn(comps[div].qf)
      if (!openRow && !qfRow) {
        unmatched.push(`${div}:${a.name}`)
        continue
      }
      // vitals backfill from whichever row has them
      const ent = (openRow || qfRow).entrant
      if (a.heightCm == null) {
        const cm = inToCm(ent.height)
        if (cm) { a.heightCm = cm; vitalsBackfill.push(`${a.name} h=${cm}cm`) }
      }
      if (a.weightKg == null) {
        const kg = lbToKg(ent.weight)
        if (kg) { a.weightKg = kg; vitalsBackfill.push(`${a.name} w=${kg}kg`) }
      }
      // keep athletes-2026.json in sync with the official c3po ranks now in
      // results/2026.json (so the Hub/profile Road-to-Games and the Capacity Lab
      // never show two different Open/QF ranks for the same athlete).
      if (openRow) a.openRank2026 = parseInt(openRow.overallRank, 10) || a.openRank2026
      if (qfRow) a.qfRank2026 = parseInt(qfRow.overallRank, 10) || a.qfRank2026
      // backfill a missing competitorId so future re-runs match by id, not name
      if (!a.crossfitAthleteId && ent.competitorId) a.crossfitAthleteId = String(ent.competitorId)
      data[div].athletes.push({
        name: a.name,
        country: a.country ?? ent.countryOfOriginName ?? null,
        openRank: openRow ? openRow.overallRank : null,
        qfRank: qfRow ? qfRow.overallRank : null,
        openEvents: openRow ? rowEvents(openRow, openEventIds) : openEventIds.map((eid) => ({ eventId: eid, place: 999, score: '' })),
        qfEvents: qfRow ? rowEvents(qfRow, qfEventIds) : qfEventIds.map((eid) => ({ eventId: eid, place: 999, score: '' })),
      })
    }
  }

  // ---- re-rank cohort within itself per event (mirror build-2026-results.mjs) ----
  const buildStage = (stageKey) => {
    const events = (stageKey === 'open' ? existing.stages.open.events : existing.stages.quarterfinals.events)
    const eventIds = events.map((e) => e.id)
    const divisionFor = (cohort) => {
      const cohortPlace = {}
      for (const eid of eventIds) {
        const ranked = cohort
          .map((a) => {
            const ev = (stageKey === 'open' ? a.openEvents : a.qfEvents).find((x) => x.eventId === eid)
            return { name: a.name, gp: ev ? ev.place : 1e9, score: ev ? ev.score : '' }
          })
          .sort((x, y) => x.gp - y.gp)
        cohortPlace[eid] = new Map(ranked.map((r, i) => [r.name, { place: i + 1, score: r.score }]))
      }
      const out = cohort.map((a) => {
        const evs = eventIds.map((eid) => {
          const cp = cohortPlace[eid].get(a.name)
          return { eventId: eid, place: cp.place, score: cp.score, points: cp.place }
        })
        return { name: a.name, country: a.country, totalPoints: evs.reduce((s, e) => s + e.points, 0), officialRank: stageKey === 'open' ? a.openRank : a.qfRank, events: evs }
      })
      out.sort((x, y) => x.totalPoints - y.totalPoints)
      out.forEach((a, i) => (a.rank = i + 1))
      return out
    }
    return { label: stageKey === 'open' ? 'Open' : 'Quarterfinals', events, divisions: { men: divisionFor(data.men.athletes), women: divisionFor(data.women.athletes) }, sources: data.men.sources }
  }

  // Semifinal route (event + finish) per athlete, for the "Road to the Games" table.
  const routeByName = new Map()
  for (const a of [...athletes.men, ...athletes.women]) {
    routeByName.set(a.name, { semifinalEvent: a.semifinalEvent2026 ?? null, semifinalFinish: a.semifinalFinish2026 ? a.semifinalFinish2026.replace(/\s*\(.*\)/, '') : null })
  }
  const buildProjected = () => {
    const events = existing.stages.games.events
    const eventIds = events.map((e) => e.id)
    const divisionFor = (cohort) => {
      const cohortPlace = {}
      for (const eid of eventIds) {
        const ranked = cohort
          .map((a) => {
            const ev = [...a.openEvents, ...a.qfEvents].find((x) => x.eventId === eid)
            return { name: a.name, gp: ev ? ev.place : 1e9, score: ev ? ev.score : '' }
          })
          .sort((x, y) => x.gp - y.gp)
        cohortPlace[eid] = new Map(ranked.map((r, i) => [r.name, { place: i + 1, score: r.score }]))
      }
      const out = cohort.map((a) => {
        const evs = eventIds.map((eid) => {
          const cp = cohortPlace[eid].get(a.name)
          return { eventId: eid, place: cp.place, score: cp.score, points: cp.place }
        })
        const rt = routeByName.get(a.name) || {}
        return { name: a.name, country: a.country, totalPoints: evs.reduce((s, e) => s + e.points, 0), officialRank: a.openRank, openRank: a.openRank, qfRank: a.qfRank, semifinalEvent: rt.semifinalEvent, semifinalFinish: rt.semifinalFinish, events: evs }
      })
      out.sort((x, y) => x.totalPoints - y.totalPoints)
      out.forEach((a, i) => (a.rank = i + 1))
      return out
    }
    return { label: 'Projected Form', projected: true, events, divisions: { men: divisionFor(data.men.athletes), women: divisionFor(data.women.athletes) }, sources: data.men.sources }
  }

  const out = {
    year: 2026,
    status: 'field-locked',
    note: 'The locked 2026 individual field (30 men, 30 women) analyzed across the official Open (3 tests) and Quarterfinals (4 tests). Per-event scores are the official c3po results; placements are re-ranked within this 30-athlete Games field. Projected Form combines all 7 Open+QF tests as a data-driven proxy for Games form. The Games (July 24-26, San Jose) follow as live releases.',
    stages: {
      open: buildStage('open'),
      quarterfinals: buildStage('qf'),
      games: buildProjected(),
    },
  }

  writeFileSync(RESULTS, JSON.stringify(out, null, 2))
  writeFileSync(ATHLETES, JSON.stringify(athletes, null, 2) + '\n')

  console.log(`men=${data.men.athletes.length} women=${data.women.athletes.length}`)
  console.log(`unmatched (${unmatched.length}):`, unmatched.join(', ') || 'none')
  console.log(`vitals backfilled (${vitalsBackfill.length}):`, vitalsBackfill.slice(0, 8).join('; '), vitalsBackfill.length > 8 ? '...' : '')
  console.log('Open men top 5:', out.stages.open.divisions.men.slice(0, 5).map((a) => `${a.rank}.${a.name}(${a.totalPoints})`).join('  '))
  console.log('QF men top 5:', out.stages.quarterfinals.divisions.men.slice(0, 5).map((a) => `${a.rank}.${a.name}(${a.totalPoints})`).join('  '))
}
run()
