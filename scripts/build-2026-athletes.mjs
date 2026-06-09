#!/usr/bin/env node
// Assemble src/data/games/athletes-2026.json from the profile research workflow output.
// Usage: node scripts/build-2026-athletes.mjs <workflow-output-file>
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'games', 'athletes-2026.json')
const raw = readFileSync(process.argv[2], 'utf8')
const d = JSON.parse(raw.slice(raw.indexOf('{')))
const r = d.result ?? d

const slugify = (n) =>
  n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Map verified interviews by athlete name (case-insensitive)
const interviews = new Map()
for (const iv of r.media?.interviews ?? []) {
  if (iv.athlete && iv.url) interviews.set(iv.athlete.toLowerCase().trim(), iv.url)
}

// roster gives semifinalEvent / qfRank fallbacks
const rosterBy = new Map()
for (const div of ['men', 'women']) for (const q of r.roster?.[div] ?? []) rosterBy.set(q.name.toLowerCase().trim(), q)

const seen = new Set()
const shape = (p) => {
  const key = p.name.toLowerCase().trim()
  const ros = rosterBy.get(key)
  return {
    name: p.name,
    slug: slugify(p.name),
    division: p.division,
    country: p.country ?? ros?.country ?? null,
    age: p.age ?? null,
    birthYear: p.birthYear ?? null,
    hometown: p.hometown ?? null,
    affiliate: p.affiliate ?? null,
    heightCm: p.heightCm ?? null,
    weightKg: p.weightKg ?? null,
    gamesAppearances: p.gamesAppearances ?? null,
    firstGamesYear: p.firstGamesYear ?? null,
    bestGamesFinish: p.bestGamesFinish ?? null,
    isFormerChampion: p.isFormerChampion ?? false,
    isRookie: p.isRookie ?? false,
    openRank2026: p.openRank2026 ?? ros?.openRank ?? null,
    qfRank2026: p.qfRank2026 ?? ros?.qfRank ?? null,
    semifinalEvent2026: p.semifinalEvent2026 ?? ros?.semifinalEvent ?? null,
    semifinalFinish2026: p.semifinalFinish2026 ?? null,
    qualified: true,
    storyline: p.storyline ?? null,
    nickname: p.nickname ?? null,
    instagramHandle: p.instagramHandle ?? null,
    interviewUrl: p.interviewUrl ?? interviews.get(key) ?? null,
    photoUrl: p.photoUrl ?? null,
  }
}

const men = []
const women = []
for (const p of r.profiles ?? []) {
  const key = p.name.toLowerCase().trim()
  if (seen.has(key)) continue
  seen.add(key)
  const a = shape(p)
  ;(a.division === 'women' ? women : men).push(a)
}

// Sort: former champions first, then by best-known season form (Open rank), then name
const sortKey = (a) => [a.isFormerChampion ? 0 : 1, a.openRank2026 ?? 999, a.name]
const cmp = (x, y) => { const a = sortKey(x), b = sortKey(y); return a[0] - b[0] || a[1] - b[1] || String(a[2]).localeCompare(String(b[2])) }
men.sort(cmp)
women.sort(cmp)

const out = {
  meta: {
    generated: '2026-06-09',
    gamesDates: 'July 24-26, 2026',
    venue: 'SAP Center',
    city: 'San Jose, California',
    fieldNote: '23 men and 23 women have qualified from the in-person Semifinals. The final 7 per division come from the online Individual Semifinal (June 11-15); the full field locks around June 16.',
    fieldLocked: false,
  },
  interviewSeries: r.media?.series ? { series: String(r.media.series).slice(0, 400), seriesUrl: r.media.seriesUrl ?? null } : null,
  men,
  women,
}

writeFileSync(OUT, JSON.stringify(out, null, 2))
const withPhoto = [...men, ...women].filter((a) => a.photoUrl).length
const withIv = [...men, ...women].filter((a) => a.interviewUrl).length
console.log(`Wrote ${OUT}`)
console.log(`men ${men.length}, women ${women.length}; photos ${withPhoto}, interviews ${withIv}`)
console.log('former champions:', [...men, ...women].filter((a) => a.isFormerChampion).map((a) => a.name).join(', ') || 'none')
