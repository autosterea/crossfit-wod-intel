#!/usr/bin/env node
// Build src/data/games/h2h-data.json - the compact per-athlete ledger powering
// the Head-to-Head Machine (/games/h2h). Sources: results/<year>.json (top-10
// per division 2007-2025, per-event places), live-leaderboard-2026.json (full
// 30+30 field, ev[i].rank = per-event finish), raw/<year>.json (event winners),
// games-data.json (verified champions list for title counts).
// Name normalization: married/accented variants map to one canonical id so
// careers count as one athlete (Toomey-Orr -> Toomey, Webb -> Saunders, etc).
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

// canonical-name mapping (surname-changes + spelling variants seen in the data)
const CANON = {
  'Tia-Clair Toomey-Orr': 'Tia-Clair Toomey',
  'Kara Saunders': 'Kara Webb',
  'Laura Horváth': 'Laura Horvath',
  'Katrín Davíðsdóttir': 'Katrin Davidsdottir',
  'Katrin Tanja Davidsdottir': 'Katrin Davidsdottir',
  'Mathew Fraser': 'Mat Fraser',
  'Rich Froning Jr.': 'Rich Froning',
  'Rich Froning Jr': 'Rich Froning',
  'Annie Thorisdóttir': 'Annie Thorisdottir',
  'Annie Thorísdóttir': 'Annie Thorisdottir',
  'Sara Sigmundsdóttir': 'Sara Sigmundsdottir',
  'Björgvin Karl Guðmundsson': 'Bjorgvin Karl Gudmundsson',
  'Guðmundsson': 'Bjorgvin Karl Gudmundsson',
}
const canon = (n) => CANON[n] || n
const slug = (n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const athletes = {} // slug -> { name, division, years: { y: { rank, points, events: {eventId: place} } }, eventWins: [] }

function touch(name, division) {
  const c = canon(name)
  const s = slug(c)
  if (!athletes[s]) athletes[s] = { name: c, division, years: {}, eventWins: [] }
  return athletes[s]
}

// 2007-2025 from results files
for (let y = 2007; y <= 2025; y++) {
  const f = `src/data/games/results/${y}.json`
  if (!fs.existsSync(path.join(ROOT, f))) continue
  const r = read(f)
  for (const div of ['men', 'women']) {
    for (const a of r.divisions?.[div] ?? []) {
      const rec = touch(a.name, div)
      const events = {}
      for (const e of a.events ?? []) if (e.place != null) events[e.eventId] = e.place
      rec.years[y] = { rank: a.rank, points: a.totalPoints ?? null, events }
    }
  }
}

// 2026 from the live board (full field; ev[i].rank is the per-event finish)
const live = read('public/live-leaderboard-2026.json')
for (const div of ['men', 'women']) {
  for (const a of live[div].athletes) {
    const rec = touch(a.name, div)
    const events = {}
    a.ev.forEach((e, i) => { if (e && e.rank != null) events[`2026-${String(i + 1).padStart(2, '0')}`] = e.rank })
    rec.years[2026] = { rank: a.rank[a.rank.length - 1], points: a.cum[a.cum.length - 1], events }
  }
}

// event wins from raw winner fields (2007-2025) + 2026 per-event rank 1
for (let y = 2007; y <= 2025; y++) {
  const f = `src/data/games/raw/${y}.json`
  if (!fs.existsSync(path.join(ROOT, f))) continue
  const r = read(f)
  ;(r.events ?? []).forEach((e, i) => {
    const id = e.id || `${y}-${String(i + 1).padStart(2, '0')}`
    // winner strings can be "A & B (tie)" - credit every named winner
    const winners = (field) => (field || '').replace(/\((tie|shared)\)/gi, '').split(/\s*&\s*|\s*\/\s*/).map((n) => n.trim()).filter(Boolean)
    for (const w of winners(e.winnerMen)) { const s = slug(canon(w)); if (athletes[s]) athletes[s].eventWins.push(id) }
    for (const w of winners(e.winnerWomen)) { const s = slug(canon(w)); if (athletes[s]) athletes[s].eventWins.push(id) }
  })
}
for (const div of ['men', 'women']) {
  for (const a of live[div].athletes) {
    a.ev.forEach((e, i) => {
      if (e && e.rank === 1) touch(a.name, div).eventWins.push(`2026-${String(i + 1).padStart(2, '0')}`)
    })
  }
}

// titles from the verified champions record in games-data.json
const gd = read('src/data/games-data.json')
const titles = {}
for (const y of gd.years ?? []) {
  for (const key of ['championMen', 'championWomen']) {
    if (!y[key]) continue
    const s = slug(canon(y[key]))
    titles[s] = titles[s] || []
    titles[s].push(y.year)
  }
}
for (const [s, yrs] of Object.entries(titles)) if (athletes[s]) athletes[s].titles = yrs

const out = { generated: 'build', athletes }
fs.writeFileSync(path.join(ROOT, 'src/data/games/h2h-data.json'), JSON.stringify(out))
const n = Object.keys(athletes).length
console.log(`h2h-data.json: ${n} athletes, ${Object.values(athletes).filter(a => a.titles).length} champions`)
// sanity: Fraser & Toomey
const fr = athletes['mat-fraser'], to = athletes['tia-clair-toomey']
console.log('Fraser:', fr ? `${fr.titles?.length ?? 0} titles, ${fr.eventWins.length} event wins, years ${Object.keys(fr.years).join(',')}` : 'MISSING')
console.log('Toomey:', to ? `${to.titles?.length ?? 0} titles, ${to.eventWins.length} event wins` : 'MISSING')
