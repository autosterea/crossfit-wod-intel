#!/usr/bin/env node
/*
 * fetch-official-standings.mjs
 * ----------------------------
 * Pulls the CURRENT official 2026 CrossFit leaderboard from the sanctioned
 * c3po API and writes a compact, VERBATIM snapshot to
 *   public/news-official.json
 * which the /news page renders as the "Official Leaderboard" hero card.
 *
 * WHY THIS RUNS REMOTELY (not on the VPS cron):
 *   c3po.crossfit.com blocks the DigitalOcean datacenter IP (AWS CloudFront
 *   WAF -> 403), exactly like www.crossfit.com and barbend.com. It is reachable
 *   from normal machines and from the Anthropic cloud routine that schedules
 *   this. That is why official-results refresh is a scheduled REMOTE routine,
 *   not part of the VPS news aggregator.
 *
 * NO FABRICATION: every rank, name, country and point total is copied straight
 * from the official payload. If the API returns nothing for a stage, that stage
 * is skipped; if no stage has data, nothing is written (the previous snapshot
 * stays). The page degrades gracefully when the file is absent.
 *
 * Usage:
 *   node scripts/fetch-official-standings.mjs            # write public/news-official.json
 *   node scripts/fetch-official-standings.mjs --dry      # print, do not write
 *   node scripts/fetch-official-standings.mjs --out PATH # custom output path
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API = 'https://c3po.crossfit.com/api/leaderboards/v2/competitions'
const YEAR = 2026
const TOP_N = 10
const UA =
  'Mozilla/5.0 (compatible; PersistenceAthletics-CrossFitNow/1.0; +https://wod.persistenceathletics.com/news)'

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const outIdx = argv.indexOf('--out')
const OUT =
  outIdx >= 0 && argv[outIdx + 1]
    ? resolve(process.cwd(), argv[outIdx + 1])
    : resolve(__dirname, '..', 'public', 'news-official.json')

// Most advanced stage that has results wins. `slugs` lists candidate
// competition slugs to try (the online Semifinal has been seen under a couple
// of names across seasons); the first that returns rows is used.
const STAGES = [
  { key: 'games',       label: '2026 CrossFit Games',      status: 'live',  eventsTotal: null, slugs: ['games'] },
  { key: 'semifinals',  label: '2026 CrossFit Semifinals', status: 'live',  eventsTotal: null, slugs: ['semifinals', 'individualsemifinals'] },
  { key: 'open',        label: '2026 CrossFit Open',       status: 'final', eventsTotal: 3,    slugs: ['open'] },
]

const DIVISIONS = [
  ['men', '1'],
  ['women', '2'],
]

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Map the official leaderboardRows to our compact, verbatim shape. */
function mapRows(data) {
  return (data.leaderboardRows || [])
    .slice(0, TOP_N)
    .map((r) => {
      const e = r.entrant || {}
      return {
        rank: Number(r.overallRank),
        name: e.competitorName || `${e.firstName || ''} ${e.lastName || ''}`.trim(),
        country: e.countryOfOriginName || '',
        countryCode: e.countryShortCode || e.countryOfOriginCode || '',
        points: r.overallScore != null && r.overallScore !== '' ? String(r.overallScore) : null,
      }
    })
    .filter((x) => x.name && Number.isFinite(x.rank))
}

/** How many events have a posted score for the leader (best-effort completion). */
function eventsCompleted(data) {
  const scores = data.leaderboardRows?.[0]?.scores
  if (!Array.isArray(scores)) return null
  const done = scores.filter((s) => s && s.scoreDisplay && s.scoreDisplay !== '--').length
  return done || null
}

async function tryStage(stage) {
  for (const slug of stage.slugs) {
    const divisions = {}
    let completed = null
    let sourceUrl = ''
    let ok = true
    for (const [name, d] of DIVISIONS) {
      const url = `${API}/${slug}/${YEAR}/leaderboards?division=${d}&sort=0&page=1`
      let data
      try {
        data = await fetchJson(url)
      } catch {
        ok = false
        break
      }
      const rows = mapRows(data)
      // A stage only counts as having REAL standings if at least one athlete is
      // actually ranked (rank >= 1). Before a competition scores its first event
      // the field can be loaded into c3po with every overallRank = 0 - that is a
      // placeholder, not a leaderboard, so we skip it and cascade to the next
      // stage (e.g. the finished Open) rather than publish a rank-0 order.
      if (!rows.length || !rows.some((r) => r.rank >= 1)) {
        ok = false
        break
      }
      divisions[name] = rows
      if (name === 'men') {
        completed = eventsCompleted(data)
        sourceUrl = url
      }
    }
    if (ok && divisions.men && divisions.women) {
      return {
        updatedAt: new Date().toISOString(),
        season: YEAR,
        stage: stage.key,
        stageLabel: stage.label,
        status: stage.status,
        eventsCompleted: completed,
        eventsTotal: stage.eventsTotal,
        source: sourceUrl,
        sourceLabel: 'Official CrossFit Games leaderboard (c3po.crossfit.com)',
        publicUrl: 'https://games.crossfit.com/leaderboard',
        divisions,
      }
    }
  }
  return null
}

/**
 * Everything in the snapshot EXCEPT the wall-clock timestamp, so we can detect
 * whether the standings actually changed and avoid timestamp-only churn (the
 * recurring routine would otherwise commit a no-op every run).
 */
function signature(snap) {
  if (!snap) return null
  const { updatedAt: _omit, ...rest } = snap
  return JSON.stringify(rest)
}

async function main() {
  for (const stage of STAGES) {
    const snapshot = await tryStage(stage)
    if (snapshot) {
      const json = JSON.stringify(snapshot, null, 2)
      if (DRY) {
        console.log(json)
        console.error(
          `[official-standings] DRY: ${stage.label} - men #1 ${snapshot.divisions.men[0].name}, women #1 ${snapshot.divisions.women[0].name}`,
        )
        return
      }
      // Skip the write when only the timestamp would change, so callers can use
      // exit code to decide whether to commit (0 = wrote a real change).
      if (existsSync(OUT)) {
        let prev = null
        try {
          prev = JSON.parse(readFileSync(OUT, 'utf8'))
        } catch {
          prev = null
        }
        if (prev && signature(prev) === signature(snapshot)) {
          console.log(
            `[official-standings] no change (${stage.label}, men #1 ${snapshot.divisions.men[0].name}); leaving snapshot untouched`,
          )
          process.exitCode = 3
          return
        }
      }
      writeFileSync(OUT, json + '\n')
      console.log(
        `[official-standings] wrote ${OUT}\n  stage=${stage.label} status=${stage.status} eventsCompleted=${snapshot.eventsCompleted}\n  men #1 ${snapshot.divisions.men[0].name} (${snapshot.divisions.men[0].points} pts)  women #1 ${snapshot.divisions.women[0].name} (${snapshot.divisions.women[0].points} pts)`,
      )
      return
    }
    console.error(`[official-standings] ${stage.label}: no results yet, trying next stage`)
  }
  console.error('[official-standings] no stage has results; leaving any existing snapshot untouched')
  process.exitCode = 2
}

main().catch((e) => {
  console.error('[official-standings] FAILED:', e.message)
  process.exitCode = 1
})
