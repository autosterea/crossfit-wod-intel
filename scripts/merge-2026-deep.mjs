#!/usr/bin/env node
// Merge the deep per-athlete pull (complete official history + verified photo + IG)
// into athletes-2026.json. HEAD-verifies every photo and drops dead ones to null.
// Re-grounds champion flags. Usage: node scripts/merge-2026-deep.mjs <workflow-output-file>
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ATH = join(__dirname, '..', 'src', 'data', 'games', 'athletes-2026.json')
const raw = readFileSync(process.argv[2], 'utf8')
const wf = JSON.parse(raw.slice(raw.indexOf('{')))
const deep = new Map((wf.result ?? wf).athletes.map((a) => [a.name.toLowerCase().trim(), a]))

const gd = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'games-data.json'), 'utf8'))
const champYears = {}
for (const c of gd.champions) for (const who of [c.men, c.women]) if (who) (champYears[who] = champYears[who] || []).push(c.year)

const d = JSON.parse(readFileSync(ATH, 'utf8'))

for (const div of ['men', 'women']) {
  for (const a of d[div]) {
    const x = deep.get(a.name.toLowerCase().trim())
    if (!x) continue
    if (x.gamesAppearances != null) a.gamesAppearances = x.gamesAppearances
    if (x.firstGamesYear != null) a.firstGamesYear = x.firstGamesYear
    if (x.bestGamesFinish != null) a.bestGamesFinish = x.bestGamesFinish
    if (Array.isArray(x.finishes) && x.finishes.length) a.finishes = x.finishes.sort((p, q) => p.year - q.year)
    if (x.age != null) a.age = x.age
    if (x.affiliate) a.affiliate = x.affiliate
    if (x.crossfitAthleteId) a.crossfitAthleteId = x.crossfitAthleteId
    if (x.photoVerified && x.photoUrl) a.photoUrl = x.photoUrl
    if (x.instagramVerified && x.instagramHandle) a.instagramHandle = x.instagramHandle.replace(/^@?/, '@')
    a.isRookie = (x.gamesAppearances ?? a.gamesAppearances) === 0
  }
}

// Re-ground champions
for (const div of ['men', 'women']) {
  for (const a of d[div]) {
    const years = champYears[a.name]
    a.isFormerChampion = !!years
    if (years) { a.bestGamesFinish = `1st (${Math.max(...years)})`; a.isRookie = false }
  }
}

// HEAD-verify every photo; drop non-image/non-200 to null (monogram fallback)
const all = [...d.men, ...d.women]
let broken = []
await Promise.all(
  all.map(async (a) => {
    if (!a.photoUrl) return
    try {
      const r = await fetch(a.photoUrl, { method: 'HEAD' })
      const ct = r.headers.get('content-type') || ''
      if (!r.ok || !ct.startsWith('image')) { broken.push(`${a.name} (${r.status} ${ct})`); a.photoUrl = null }
    } catch (e) {
      broken.push(`${a.name} (ERR ${e.message})`)
      a.photoUrl = null
    }
  })
)

writeFileSync(ATH, JSON.stringify(d, null, 2))
console.log(`appearances ${all.filter((a) => a.gamesAppearances != null).length}/${all.length}, finishes ${all.filter((a) => a.finishes?.length).length}/${all.length}, photos OK ${all.filter((a) => a.photoUrl).length}/${all.length}`)
console.log('broken photos dropped to monogram:', broken.length ? broken.join(', ') : 'none')
console.log('champions:', all.filter((a) => a.isFormerChampion).map((a) => `${a.name} ${a.bestGamesFinish}`).join(' | '))
