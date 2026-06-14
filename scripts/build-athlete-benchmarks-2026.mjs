#!/usr/bin/env node
/*
 * build-athlete-benchmarks-2026.mjs
 * ---------------------------------
 * Scrapes each 2026 qualifier's SELF-REPORTED benchmark stats (1RM lifts +
 * classic benchmark WOD times: Fran, Helen, Grace, etc.) from their OFFICIAL
 * games.crossfit.com athlete page (server-side-rendered HTML, #benchmarkStats),
 * and writes the COMMITTED file
 *   src/data/games/athlete-benchmarks-2026.json
 *
 * These are REAL, official numbers (from CrossFit's own athlete profiles) but
 * SELF-REPORTED by the athlete, so they are labeled as such in the UI and kept
 * separate from the competition-derived performance model (which is measured
 * from official results). Blank/unreported stats are dropped, never invented.
 *
 * Off-VPS acquisition (like build-athlete-history); the engine reads only the
 * committed output. games.crossfit.com is reachable (unlike c3po/www).
 *
 * Usage: node scripts/build-athlete-benchmarks-2026.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const C3PO = 'https://c3po.crossfit.com/api/leaderboards/v2/competitions'
const ATHLETE = 'https://games.crossfit.com/athlete'
const UA = 'Mozilla/5.0 (compatible; PA-CrossFitNow/1.0; +https://wod.persistenceathletics.com)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const norm = (n) =>
  (n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

// Known 1RM lift labels (everything else reported is a benchmark WOD).
const LIFT_RE = /1rm|max|squat|deadlift|snatch|clean|jerk|press|bench/i

/** value-blank? CrossFit uses "--" or empty for unreported. */
const isBlank = (v) => !v || v === '--' || /^[-\s]*$/.test(v)

/** Parse the #benchmarkStats table from an athlete page HTML. */
function parseBenchmarks(html) {
  const anchor = html.indexOf('id="benchmarkStats"')
  if (anchor < 0) return []
  const region = html.slice(anchor, anchor + 20000)
  const rows = [...region.matchAll(/<th class="stats-header" scope="row">([^<]+)<\/th>\s*<td>([^<]*)</g)]
  const out = []
  for (const r of rows) {
    const name = decode(r[1])
    const value = decode(r[2].replace(/\s+/g, ' '))
    if (isBlank(value)) continue
    out.push({ name, value, kind: LIFT_RE.test(name) ? 'lift' : 'benchmark' })
  }
  return out
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

async function fetchJson(url) {
  const t = await fetchText(url)
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

async function main() {
  // cohort names from results/2026.json
  const results2026 = JSON.parse(readFileSync(resolve(REPO, 'src/data/games/results/2026.json'), 'utf8'))
  const openDiv = results2026.stages?.open?.divisions ?? results2026.divisions
  const cohort = new Map() // normName -> name
  for (const list of [openDiv.men, openDiv.women]) for (const a of list ?? []) cohort.set(norm(a.name), a.name)

  // resolve competitorIds from the 2026 Open leaderboard
  const idByName = new Map()
  for (const div of [1, 2]) {
    for (let page = 1; page <= 2; page++) {
      const d = await fetchJson(`${C3PO}/open/2026/leaderboards?division=${div}&sort=0&page=${page}`)
      for (const r of d?.leaderboardRows ?? []) {
        const name = cohort.get(norm(r.entrant?.competitorName))
        if (name && !idByName.has(name)) idByName.set(name, String(r.entrant.competitorId))
      }
      await sleep(120)
    }
  }
  // Add the extra confirmed qualifiers (outside the Open top-30) by their known
  // competitorIds so they get benchmark stats too.
  try {
    const extra = JSON.parse(readFileSync(resolve(REPO, 'src/data/games/extra-qualifiers-2026.json'), 'utf8')).athletes
    for (const a of Object.values(extra)) {
      cohort.set(norm(a.name), a.name)
      if (a.competitorId && !idByName.has(a.name)) idByName.set(a.name, String(a.competitorId))
    }
  } catch {
    /* extra-qualifiers optional */
  }
  console.error(`[benchmarks] resolved ${idByName.size}/${cohort.size} competitorIds`)

  const benchmarks = {}
  let withData = 0
  for (const [name, id] of idByName) {
    const html = await fetchText(`${ATHLETE}/${id}`)
    const stats = html ? parseBenchmarks(html) : []
    if (stats.length) {
      benchmarks[name] = stats
      withData++
    }
    await sleep(200)
  }

  const out = {
    generated: new Date().toISOString(),
    source: 'games.crossfit.com athlete profiles (#benchmarkStats), self-reported by athletes',
    note: 'Real, official, but SELF-REPORTED 1RM lifts and benchmark WOD scores. Blank/unreported stats are omitted. Label as self-reported in the UI; keep separate from competition-derived metrics.',
    cohortSize: cohort.size,
    athletesWithBenchmarks: withData,
    benchmarks,
  }
  const outPath = resolve(REPO, 'src/data/games/athlete-benchmarks-2026.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.error(`[benchmarks] wrote ${outPath}\n  ${withData}/${cohort.size} athletes have >=1 reported benchmark`)
}

main().catch((e) => {
  console.error('[benchmarks] FAILED:', e.message)
  process.exitCode = 1
})
