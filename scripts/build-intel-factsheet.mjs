#!/usr/bin/env node
/*
 * build-intel-factsheet.mjs
 * -------------------------
 * Regenerates the per-athlete fact sheet + angle list that the PA-voice
 * narrative step writes from. Reads the freshly-built public/projection-2026.json
 * and emits (gitignored, intermediate):
 *   src/data/games/intel-factsheet.local.json   { slug: { name, division, facts[] } }
 *   intel-angles.local.json                      [ { slug, angle } ]
 *
 * Every fact is pulled verbatim from the computed projection so narratives stay
 * grounded. Run after `npm run build` (which emits projection-2026.json).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const P = JSON.parse(readFileSync(resolve(REPO, 'public/projection-2026.json'), 'utf8')).athletes

// Qualification route (semifinal/competition + finish) from athletes-2026.json,
// keyed by slug, so narratives can cite HOW the athlete reached San Jose.
const A2026 = JSON.parse(readFileSync(resolve(REPO, 'src/data/games/athletes-2026.json'), 'utf8'))
const routeBySlug = {}
for (const a of [...(A2026.men ?? []), ...(A2026.women ?? [])]) {
  routeBySlug[a.slug] = {
    event: a.semifinalEvent2026 || null,
    finish: a.semifinalFinish2026 || null,
    rookie: !!a.isRookie,
    former: !!a.isFormerChampion,
  }
}

const ord = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
const all = Object.values(P)
const N = { men: all.filter((a) => a.division === 'men').length, women: all.filter((a) => a.division === 'women').length }

function angle(a) {
  if (a.bestGamesFinish === 1) return 'former-champion'
  if (a.seasonRank.rookie) return 'rookie-unknown'
  if (a.status === 'contender' && !a.seasonRank.rookie) return 'in-the-hunt'
  if (a.energy.oxidative >= 70 && a.modal.engine >= 70) return 'engine-specialist'
  const sk = a.skills.filter((s) => s.measured).sort((x, y) => y.score - x.score)[0]
  if (sk && (sk.skill === 'Strength' || sk.skill === 'Power')) return 'strength-specialist'
  if (a.seasonRank.rank <= 6) return 'contender'
  if (a.gamesHistory.length >= 4) return 'grizzled-veteran'
  return 'dark-horse'
}

const sheet = {}
const angles = []
for (const [slug, a] of Object.entries(P)) {
  const sk = a.skills.filter((s) => s.measured)
  const top = [...sk].sort((x, y) => y.score - x.score).slice(0, 3)
  const bot = [...sk].sort((x, y) => x.score - y.score).slice(0, 3)
  const bT = (a.benchmarks || []).filter((b) => b.fieldRank && b.pct >= 70).slice(0, 4)
  const bL = (a.benchmarks || []).filter((b) => b.fieldRank && b.pct <= 30).slice(0, 2)
  const f = []
  f.push(`Division: ${a.division}, age ${a.age ?? 'unknown'}. Status: ${a.status === 'qualified' ? 'CONFIRMED 2026 qualifier' : 'contender still fighting through the online Semifinal'}.${a.seasonRank.rookie ? ' GAMES ROOKIE (never competed at the individual Games).' : ''}`)
  const rt = routeBySlug[slug]
  if (rt && (rt.event || rt.finish)) {
    f.push(`Qualification route to the 2026 Games: ${[rt.event, rt.finish].filter(Boolean).join(' ')}. (Use this verbatim; do not infer or embellish the route.)`)
  }
  f.push(`Model projects #${a.seasonRank.rank} of ${N[a.division]} in the ${a.division} field (data-confidence ${a.confidence}). Capacity ${a.capacity} = average percent of the field beaten across all events; consistency ${a.consistency}.`)
  const driveStr = (d) => (d ? (d.place >= 1 ? `${d.event} finished ${ord(d.place)}` : `${d.event} (${Math.round(d.perf)}th pctile)`) : '')
  f.push(`STRENGTHS (best domains, with a real event): ${a.strengths.map((s) => `${s.label} [${ord(s.pct)} pctile, e.g. ${driveStr(s.drivingEvents[0])}]`).join('; ')}.`)
  f.push(`RELATIVE WEAKNESSES (their OWN softest domains; for an elite athlete these can still be high percentiles): ${a.weaknesses.map((s) => `${s.label} [${ord(s.pct)} pctile vs field]`).join('; ')}.`)
  f.push(`10-skill read: strongest = ${top.map((s) => s.skill).join(', ')}; softest = ${bot.map((s) => s.skill).join(', ')}.`)
  f.push(`Energy systems (percent of field beaten): phosphagen ${a.energy.phosphagen}, glycolytic ${a.energy.glycolytic}, oxidative ${a.energy.oxidative}.`)
  if (a.gamesHistory.length) f.push(`Games history: ${a.gamesHistory.length} appearances (${a.gamesHistory.map((g) => `${g.year} ${ord(g.overallRank)}`).join(', ')}); best finish ${a.bestGamesFinish ? ord(a.bestGamesFinish) : 'n/a'}.`)
  else f.push('No prior individual CrossFit Games appearances (rookie at this level).')
  if (bT.length) f.push(`Standout self-reported benchmarks (strong vs field): ${bT.map((b) => `${b.name} ${b.value}${b.fieldRank === 1 ? ' (best in the field)' : ` (${ord(b.fieldRank)} of ${b.fieldOf})`}`).join('; ')}.`)
  if (bL.length) f.push(`Softer self-reported benchmarks: ${bL.map((b) => `${b.name} ${b.value} (${ord(b.fieldRank)} of ${b.fieldOf})`).join('; ')}.`)
  if (!bT.length && !bL.length) f.push('No self-reported benchmark stats on file (do not invent any).')
  sheet[slug] = { name: a.name, division: a.division, facts: f }
  angles.push({ slug, angle: angle(a) })
}

writeFileSync(resolve(REPO, 'src/data/games/intel-factsheet.local.json'), JSON.stringify(sheet, null, 2))
writeFileSync(resolve(REPO, 'intel-angles.local.json'), JSON.stringify(angles))
console.error(`[factsheet] ${Object.keys(sheet).length} athletes (men of ${N.men}, women of ${N.women})`)
