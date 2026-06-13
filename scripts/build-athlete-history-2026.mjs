#!/usr/bin/env node
/*
 * build-athlete-history-2026.mjs
 * ------------------------------
 * Assembles each 2026 individual qualifier's PRIOR CrossFit Games per-event
 * record (2011-2025) from the official c3po leaderboards, joined to the 2026
 * cohort by athlete name, and writes the COMMITTED file
 *   src/data/games/athlete-history-2026.json
 *
 * WHY COMMITTED + WHY OFF-VPS: c3po blocks the VPS datacenter IP (CloudFront
 * WAF). The athlete-intel BUILD engine must run anywhere (incl. the VPS during
 * `npm run build`), so it reads ONLY committed JSON. This script does the
 * c3po-touching acquisition and is run OFF the VPS (locally or in a remote
 * routine) whenever the field/results change; its output is committed.
 *
 * NO FABRICATION: every record is copied from the official payload. Athletes
 * with no prior Games simply have an empty history (they are rookies, and the
 * engine flags them low-confidence rather than imputing anything).
 *
 * A local cache at <repoParent>/.c3po-cache/games keeps reruns cheap/offline.
 *
 * Usage: node scripts/build-athlete-history-2026.mjs [--years 2011-2025]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const CACHE = resolve(REPO, '..', '.c3po-cache', 'games')
const API = 'https://c3po.crossfit.com/api/leaderboards/v2/competitions'
const UA = 'Mozilla/5.0 (compatible; PA-CrossFitNow/1.0; +https://wod.persistenceathletics.com)'

const yearsArg = process.argv.includes('--years') ? process.argv[process.argv.indexOf('--years') + 1] : '2011-2025'
const [Y0, Y1] = yearsArg.split('-').map(Number)

/** Normalize a name for cross-source matching (strip accents, punctuation, case). */
function norm(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchLeaderboard(comp, year, div, page = 1) {
  mkdirSync(CACHE, { recursive: true })
  const cacheFile = resolve(CACHE, `${comp}-${year}-d${div}${page > 1 ? `-p${page}` : ''}.json`)
  if (existsSync(cacheFile)) {
    try {
      return JSON.parse(readFileSync(cacheFile, 'utf8'))
    } catch {
      /* refetch */
    }
  }
  const url = `${API}/${comp}/${year}/leaderboards?division=${div}&sort=0&page=${page}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    writeFileSync(cacheFile, JSON.stringify(data))
    await sleep(120)
    return data
  } catch {
    return null
  }
}

async function main() {
  // 1) the 2026 cohort names (results/2026.json Open stage) -> resolve each to a
  // stable c3po competitorId via the 2026 Open leaderboard. competitorId is the
  // ROBUST cross-year join key (names change: "Elena Carratala Sanahuja" -> "Elena
  // Carratala", maiden names, etc.). We key OUTPUT by the results/2026.json name.
  const results2026 = JSON.parse(readFileSync(resolve(REPO, 'src/data/games/results/2026.json'), 'utf8'))
  const openDiv = results2026.stages?.open?.divisions ?? results2026.divisions
  const cohortByNorm = new Map() // normName -> { name, division }
  for (const [division, list] of [
    ['men', openDiv.men],
    ['women', openDiv.women],
  ]) {
    for (const a of list ?? []) cohortByNorm.set(norm(a.name), { name: a.name, division })
  }
  console.error(`[history] cohort: ${cohortByNorm.size} athletes`)

  // Resolve competitorId for each cohort member from the 2026 Open leaderboard
  // (top pages cover the whole top-30 cohort).
  const idToName = new Map() // competitorId -> results-2026 name
  const resolved = new Set()
  const meta = {} // name -> { age, country } from the official 2026 Open entrant record
  for (const [division, div] of [
    ['men', 1],
    ['women', 2],
  ]) {
    for (let page = 1; page <= 2; page++) {
      const data = await fetchLeaderboard('open', 2026, div, page)
      for (const r of data?.leaderboardRows ?? []) {
        const hit = cohortByNorm.get(norm(r.entrant?.competitorName))
        if (hit && hit.division === division && !resolved.has(hit.name)) {
          idToName.set(String(r.entrant.competitorId), hit.name)
          resolved.add(hit.name)
          const age = Number(r.entrant?.age)
          meta[hit.name] = {
            age: Number.isFinite(age) && age > 0 ? age : null,
            country: r.entrant?.countryOfOriginName || null,
          }
        }
      }
    }
  }
  const unresolved = [...cohortByNorm.values()].filter((c) => !resolved.has(c.name)).map((c) => c.name)
  if (unresolved.length) console.error(`[history] WARN unresolved competitorId for: ${unresolved.join(', ')}`)
  console.error(`[history] resolved competitorIds: ${idToName.size}/${cohortByNorm.size}`)

  // 2) scan historical Games leaderboards, join by competitorId
  const history = {} // name -> { games: [ { year, division, overallRank, fieldSize, events:[{eventId,place,score}] } ] }
  let matched = 0
  for (let year = Y0; year <= Y1; year++) {
    for (const [division, div] of [
      ['men', 1],
      ['women', 2],
    ]) {
      const data = await fetchLeaderboard('games', year, div)
      const rows = data?.leaderboardRows
      if (!rows?.length) continue
      const fieldSize = rows.length
      for (const r of rows) {
        const name = idToName.get(String(r.entrant?.competitorId))
        if (!name) continue
        const events = (r.scores ?? [])
          .map((s) => {
            const ord = Number(s.ordinal)
            const place = Number(s.rank)
            const score = s.scoreDisplay && s.scoreDisplay !== '--' ? s.scoreDisplay : null
            if (!ord || !Number.isFinite(place)) return null
            return { eventId: `${year}-${String(ord).padStart(2, '0')}`, place, score }
          })
          .filter(Boolean)
        if (!events.length) continue
        ;(history[name] = history[name] || { games: [] }).games.push({
          year,
          division,
          overallRank: Number(r.overallRank),
          fieldSize,
          events,
        })
        matched++
      }
    }
  }

  const out = {
    generatedFrom: `c3po Games leaderboards ${Y0}-${Y1}`,
    note: 'Prior CrossFit Games per-event records for the 2026 individual cohort, joined by athlete name. Verbatim official data; rookies have no entry.',
    cohortSize: cohortByNorm.size,
    athletesWithHistory: Object.keys(history).length,
    matchedGamesAppearances: matched,
    meta,
    history,
  }
  const outPath = resolve(REPO, 'src/data/games/athlete-history-2026.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.error(
    `[history] wrote ${outPath}\n  ${out.athletesWithHistory}/${cohortByNorm.size} have prior Games, ${matched} appearances total`,
  )
}

main().catch((e) => {
  console.error('[history] FAILED:', e.message)
  process.exitCode = 1
})
