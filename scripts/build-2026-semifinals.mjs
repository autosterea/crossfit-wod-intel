#!/usr/bin/env node
/*
 * build-2026-semifinals.mjs  (OFF-VPS: needs c3po)
 * ------------------------------------------------
 * Builds src/data/games/semifinals-2026.json - each locked qualifier's 2026
 * Semifinal per-event results, so the Capacity Lab can show the full season path
 * (Open -> QF -> Semifinal) per athlete.
 *
 * ONLINE Individual Semifinal (both divisions = c3po competition semifinals/2026
 * id 266): pulled directly with official per-event scores + placement + field.
 * The 11 LICENSED in-person events are NOT in c3po; their per-event results are
 * filled by the research workflow (merged in via --merge <file>) and otherwise
 * carry only the overall finish from athletes-2026.json.
 *
 * HARD: semifinal events differ per athlete, so this is NOT a cross-comparable
 * capacity ranking - it is per-athlete context. The online results are unofficial
 * pending CrossFit video review (finalized June 29). Nothing is fabricated.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(REPO, 'src/data/games/semifinals-2026.json')
const ATHLETES = resolve(REPO, 'src/data/games/athletes-2026.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
const SEMI = 'https://c3po.crossfit.com/api/leaderboards/v2/competitions/semifinals/2026/leaderboards'
const ONLINE_ID = 266

const athletes = JSON.parse(readFileSync(ATHLETES, 'utf8'))
const roster = [...(athletes.men ?? []), ...(athletes.women ?? [])]
// ONLY athletes whose qualification route was the online semifinal get online data
// (some in-person qualifiers also appear in the online leaderboard - e.g. they
// entered both - but their official route is their in-person event, so we must
// not relabel them online).
const onlineRoute = new Set(roster.filter((a) => /online/i.test(a.semifinalEvent2026 || '')).map((a) => a.slug))
const idToSlug = new Map(roster.filter((a) => a.crossfitAthleteId && onlineRoute.has(a.slug)).map((a) => [String(a.crossfitAthleteId), a.slug]))

async function fetchJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (r.ok) return await r.json()
    } catch {}
    await new Promise((res) => setTimeout(res, 500))
  }
  return null
}

const out = {
  generated: new Date().toISOString(),
  source: 'Online Individual Semifinal = official c3po (competition semifinals/2026, id 266); licensed in-person events researched + verified from official event results.',
  note: 'Per-athlete 2026 Semifinal results. Semifinal EVENTS DIFFER per athlete (11 licensed events + the online semifinal), so these are NOT cross-comparable for a single capacity ranking - shown as per-athlete context. Online results are unofficial pending CrossFit video review (final June 29).',
  athletes: {},
}

// existing (so re-runs + merges are additive, never clobber researched in-person data)
if (existsSync(OUT)) {
  try {
    const prev = JSON.parse(readFileSync(OUT, 'utf8'))
    out.athletes = prev.athletes ?? {}
  } catch {}
}

// ---- ONLINE semifinal (id 266), both divisions ----
async function pullOnline(divisionNum) {
  let page = 1
  let totalPages = 1
  let fieldSize = 0
  const found = {}
  do {
    const j = await fetchJson(`${SEMI}?division=${divisionNum}&semifinal=${ONLINE_ID}&sort=0&page=${page}`)
    if (!j) break
    totalPages = j.pagination?.totalPages ?? 1
    fieldSize = j.pagination?.totalCompetitors ?? fieldSize
    for (const row of j.leaderboardRows || []) {
      const slug = idToSlug.get(String(row.entrant.competitorId))
      if (!slug) continue
      found[slug] = {
        event: 'Individual Online Semifinal',
        official: false, // unofficial pending review until June 29
        source: 'c3po semifinals/2026 (online)',
        fieldSize,
        overallRank: row.overallRank,
        perEvent: [...(row.scores || [])]
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((s) => ({ n: Number(s.ordinal), score: s.scoreDisplay || '', place: parseInt(s.rank, 10) || null })),
      }
    }
    // stop once we have all online athletes for this division
    const need = roster.filter((a) => (divisionNum === 1 ? a.division === 'men' : a.division === 'women') && /online/i.test(a.semifinalEvent2026 || '')).map((a) => a.slug)
    if (need.every((s) => found[s])) break
    page++
  } while (page <= totalPages && page <= 30)
  return { found, fieldSize }
}

const m = await pullOnline(1)
const w = await pullOnline(2)
Object.assign(out.athletes, m.found, w.found)

// ---- in-person: ensure every other athlete at least carries event + overall finish ----
for (const a of roster) {
  if (out.athletes[a.slug]) continue
  if (/online/i.test(a.semifinalEvent2026 || '')) continue // online but not matched (shouldn't happen)
  out.athletes[a.slug] = {
    event: (a.semifinalEvent2026 || '').replace(/\s*\(.*\)/, '') || null,
    official: true,
    source: 'athletes-2026.json (overall finish; per-event pending research)',
    overallFinish: a.semifinalFinish2026 ? a.semifinalFinish2026.replace(/\s*\(.*\)/, '') : null,
    perEvent: out.athletes[a.slug]?.perEvent ?? [],
  }
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
const onlineCount = Object.values(out.athletes).filter((x) => x.perEvent && x.perEvent.length).length
console.log(`men online matched=${Object.keys(m.found).length} women online matched=${Object.keys(w.found).length} (fields M${m.fieldSize}/W${w.fieldSize})`)
console.log(`semifinals-2026.json: ${Object.keys(out.athletes).length} athletes, ${onlineCount} with per-event scores`)
