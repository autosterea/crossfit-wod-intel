#!/usr/bin/env node
// Merge the refinement workflow output (verified Castro interviews + verified IG + bio/rank fills)
// into athletes-2026.json. Re-grounds champion flags against the verified Almanac.
// Usage: node scripts/merge-2026-refine.mjs <workflow-output-file>
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ATH = join(__dirname, '..', 'src', 'data', 'games', 'athletes-2026.json')
const raw = readFileSync(process.argv[2], 'utf8')
const wf = JSON.parse(raw.slice(raw.indexOf('{')))
const out = wf.result ?? wf

// 1) verified Castro YouTube interviews by athlete
const ivByName = new Map()
for (const iv of out.interviews ?? []) {
  if (iv.isDaveCastro && /youtu\.?be/.test(iv.youtubeUrl)) ivByName.set(iv.athlete.toLowerCase().trim(), iv.youtubeUrl)
}

// 2) fills by athlete
const fillByName = new Map((out.fills ?? []).map((f) => [f.name.toLowerCase().trim(), f]))

// 3) authoritative Open/QF ranks from results/2026.json
const res = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'games', 'results', '2026.json'), 'utf8'))
const resOpen = {}
const resQf = {}
for (const div of ['men', 'women']) {
  for (const a of res.stages.open.divisions[div]) if (a.officialRank != null) resOpen[a.name.toLowerCase().trim()] = a.officialRank
  for (const a of res.stages.quarterfinals.divisions[div]) if (a.officialRank != null) resQf[a.name.toLowerCase().trim()] = a.officialRank
}

// 4) verified champions from the Almanac bundle
const gd = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'games-data.json'), 'utf8'))
const champYears = {}
for (const c of gd.champions) for (const who of [c.men, c.women]) if (who) (champYears[who] = champYears[who] || []).push(c.year)

const d = JSON.parse(readFileSync(ATH, 'utf8'))
let ivN = 0
let igVerified = 0
let igCleared = 0
for (const div of ['men', 'women']) {
  for (const a of d[div]) {
    const k = a.name.toLowerCase().trim()
    const f = fillByName.get(k)

    // interview: only a verified Castro YouTube URL, else leave null
    if (ivByName.has(k)) { a.interviewUrl = ivByName.get(k); ivN++ }

    if (f) {
      // Instagram: link only if verified, else null (never an unverified handle)
      if (f.instagramVerified && f.instagramHandle) { a.instagramHandle = f.instagramHandle; igVerified++ }
      else { if (a.instagramHandle) igCleared++; a.instagramHandle = null }

      if (f.gamesAppearances != null) a.gamesAppearances = f.gamesAppearances
      if (f.firstGamesYear != null) a.firstGamesYear = f.firstGamesYear
      if (f.bestGamesFinish != null) a.bestGamesFinish = f.bestGamesFinish
      a.isRookie = f.gamesAppearances === 0 || (a.gamesAppearances === 0)
    }

    // ranks: official results first, then fill research, then existing
    a.openRank2026 = resOpen[k] ?? f?.openRank2026 ?? a.openRank2026 ?? null
    a.qfRank2026 = resQf[k] ?? f?.qfRank2026 ?? a.qfRank2026 ?? null
  }
}

// Re-ground champion flags + best finish (cannot regress)
for (const div of ['men', 'women']) {
  for (const a of d[div]) {
    const years = champYears[a.name]
    a.isFormerChampion = !!years
    if (years) {
      a.bestGamesFinish = `1st (${Math.max(...years)})`
      a.isRookie = false
      if (!a.firstGamesYear || a.firstGamesYear > Math.min(...years)) a.firstGamesYear = Math.min(...years)
    }
  }
}

d.interviewSeries = { series: 'Dave Castro 2026 CrossFit Games athlete interviews', seriesUrl: out.channelUrl ?? 'https://www.youtube.com/@davecastro6289' }

writeFileSync(ATH, JSON.stringify(d, null, 2))
const all = [...d.men, ...d.women]
console.log(`interviews embedded: ${ivN}`)
console.log(`IG verified-linked: ${igVerified}, unverified cleared: ${igCleared}, now linked: ${all.filter((a) => a.instagramHandle).length}/${all.length}`)
console.log(`appearances ${all.filter((a) => a.gamesAppearances != null).length}/${all.length}, openRank ${all.filter((a) => a.openRank2026 != null).length}/${all.length}, qfRank ${all.filter((a) => a.qfRank2026 != null).length}/${all.length}`)
console.log('champions:', all.filter((a) => a.isFormerChampion).map((a) => `${a.name} ${a.bestGamesFinish}`).join(' | '))
console.log('rookies:', all.filter((a) => a.isRookie).map((a) => a.name).join(', '))
