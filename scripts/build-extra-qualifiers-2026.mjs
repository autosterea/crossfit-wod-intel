#!/usr/bin/env node
/*
 * build-extra-qualifiers-2026.mjs
 * -------------------------------
 * The Athlete Intelligence engine originally keyed off the 2026 Open top-30
 * (results/2026.json). But the actual qualified field (athletes-2026.json)
 * includes confirmed qualifiers who finished OUTSIDE the Open top-30, so they
 * had no intel. This fetches THOSE athletes' 2026 Open + Quarterfinals
 * per-event results from c3po (by name, across leaderboard pages) so the engine
 * can cover the whole field. Off-VPS; output committed to
 *   src/data/games/extra-qualifiers-2026.json
 *
 * No fabrication: per-event place/score copied from the official payload.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const CACHE = resolve(REPO, '..', '.c3po-cache')
const API = 'https://c3po.crossfit.com/api/leaderboards/v2/competitions'
const UA = 'Mozilla/5.0 (compatible; PA-CrossFitNow/1.0; +https://wod.persistenceathletics.com)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TRANSLIT = { ł: 'l', ø: 'o', đ: 'd', ß: 'ss', ð: 'd', þ: 'th', æ: 'ae', œ: 'oe' }
const norm = (n) =>
  (n || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[łøđßðþæœ]/g, (c) => TRANSLIT[c] || c)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

async function getPage(comp, div, page) {
  mkdirSync(resolve(CACHE, comp), { recursive: true })
  const f = resolve(CACHE, comp, `${comp}-2026-d${div}-p${page}.json`)
  if (existsSync(f)) {
    try { return JSON.parse(readFileSync(f, 'utf8')) } catch {}
  }
  const url = `${API}/${comp}/2026/leaderboards?division=${div}&sort=0&page=${page}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (!res.ok) return null
    const d = await res.json()
    writeFileSync(f, JSON.stringify(d))
    await sleep(150)
    return d
  } catch { return null }
}

/** Build name -> {competitorId, country, scoresByOrdinal} from N pages of a competition leaderboard. */
async function indexCompetition(comp, div, pages) {
  const idx = new Map()
  for (let p = 1; p <= pages; p++) {
    const d = await getPage(comp, div, p)
    for (const r of d?.leaderboardRows ?? []) {
      const e = r.entrant || {}
      const scores = {}
      for (const s of r.scores ?? []) {
        const ord = Number(s.ordinal)
        const place = Number(s.rank)
        const disp = s.scoreDisplay && s.scoreDisplay !== '--' ? s.scoreDisplay : null
        if (ord) scores[ord] = { place, score: disp }
      }
      idx.set(norm(e.competitorName), { competitorId: String(e.competitorId), country: e.countryOfOriginName || null, scores })
    }
  }
  return idx
}

async function main() {
  const bio = JSON.parse(readFileSync(resolve(REPO, 'src/data/games/athletes-2026.json'), 'utf8'))
  const results = JSON.parse(readFileSync(resolve(REPO, 'src/data/games/results/2026.json'), 'utf8'))
  const inResults = new Set()
  for (const div of ['men', 'women']) for (const a of results.stages.open.divisions[div] ?? []) inResults.add(norm(a.name))

  const targets = [...(bio.men || []), ...(bio.women || [])].filter((a) => !inResults.has(norm(a.name)))
  console.error(`[extra] ${targets.length} confirmed qualifiers missing from results/2026.json`)

  // Index Open (10 pages -> top 500) and QF (14 pages -> top 700) per division.
  const open = { men: await indexCompetition('open', 1, 10), women: await indexCompetition('open', 2, 10) }
  const qf = { men: await indexCompetition('quarterfinalsindividual', 1, 14), women: await indexCompetition('quarterfinalsindividual', 2, 14) }

  const out = {}
  const unmatched = []
  for (const a of targets) {
    const key = norm(a.name)
    const o = open[a.division]?.get(key)
    const q = qf[a.division]?.get(key)
    if (!o && !q) { unmatched.push(a.name); continue }
    const events = []
    for (const ord of [1, 2, 3]) if (o?.scores[ord]) events.push({ eventId: `2026-open-0${ord}`, place: o.scores[ord].place, score: o.scores[ord].score })
    for (const ord of [1, 2, 3, 4]) if (q?.scores[ord]) events.push({ eventId: `2026-qf-0${ord}`, place: q.scores[ord].place, score: q.scores[ord].score })
    out[a.name] = {
      name: a.name,
      slug: a.slug,
      division: a.division,
      country: a.country || o?.country || q?.country || null,
      competitorId: o?.competitorId || q?.competitorId || null,
      events,
    }
  }
  if (unmatched.length) console.error(`[extra] WARN unmatched (not found in fetched pages): ${unmatched.join(', ')}`)

  const payload = {
    generated: new Date().toISOString(),
    note: 'Confirmed 2026 qualifiers (athletes-2026.json) who fell outside the Open top-30 results cohort. Their 2026 Open + Quarterfinals per-event results, fetched verbatim from c3po so the intel engine can cover the full field.',
    count: Object.keys(out).length,
    athletes: out,
  }
  writeFileSync(resolve(REPO, 'src/data/games/extra-qualifiers-2026.json'), JSON.stringify(payload, null, 2) + '\n')
  console.error(`[extra] wrote ${Object.keys(out).length}/${targets.length} extra qualifiers with season events`)
}

main().catch((e) => { console.error('[extra] FAILED:', e.message); process.exitCode = 1 })
