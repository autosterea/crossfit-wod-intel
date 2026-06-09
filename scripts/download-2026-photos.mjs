#!/usr/bin/env node
// Self-host athlete photos: download the best confirmed image per athlete (or the
// verified headshot fallback) into public/athletes/<slug>.jpg and rewrite photoUrl.
// Usage: node scripts/download-2026-photos.mjs <hero-photo-workflow-output>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ATH = join(__dirname, '..', 'src', 'data', 'games', 'athletes-2026.json')
const DIR = join(__dirname, '..', 'public', 'athletes')
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })

const raw = readFileSync(process.argv[2], 'utf8')
const wf = JSON.parse(raw.slice(raw.indexOf('{')))
const best = new Map((wf.result ?? wf).photos.map((p) => [p.name.toLowerCase().trim(), p]))

const d = JSON.parse(readFileSync(ATH, 'utf8'))

async function tryDownload(url, destNoExt) {
  if (!url) return null
  try {
    const r = await fetch(url, { redirect: 'follow' })
    const ct = r.headers.get('content-type') || ''
    if (!r.ok || !ct.startsWith('image')) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 3000) return null // too small / placeholder
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
    writeFileSync(`${destNoExt}.${ext}`, buf)
    return { ext, bytes: buf.length }
  } catch {
    return null
  }
}

let upgraded = 0
let headshot = 0
let failed = 0
for (const div of ['men', 'women']) {
  for (const a of d[div]) {
    const dest = join(DIR, a.slug)
    const b = best.get(a.name.toLowerCase().trim())
    const heroUrl = b && b.bestUrl && b.isUpgrade && b.confidence === 'high' ? b.bestUrl : null
    let got = await tryDownload(heroUrl, dest)
    let kind = 'upgrade'
    if (!got) { got = await tryDownload(a.photoUrl, dest); kind = 'headshot' }
    if (got) {
      a.photoUrl = `/athletes/${a.slug}.${got.ext}`
      if (kind === 'upgrade') upgraded++
      else headshot++
    } else {
      a.photoUrl = null // monogram fallback
      failed++
      console.log('FAILED (monogram):', a.name)
    }
  }
}

writeFileSync(ATH, JSON.stringify(d, null, 2))
console.log(`self-hosted: ${upgraded} upgraded action/press shots, ${headshot} official headshots, ${failed} fell back to monogram`)
