#!/usr/bin/env node
// Download + self-host supplementary athlete headshots (Open-cohort athletes who
// appear on form cards but aren't in athletes-2026.json). Writes
// public/athletes/<slug>.webp and src/data/games/photos-extra.json (nameLower -> path).
// Usage: node scripts/add-extra-photos.mjs <json-file-with-{photos:[{name,photoUrl}]}>
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, '..', 'public', 'athletes')
const MAP = join(__dirname, '..', 'src', 'data', 'games', 'photos-extra.json')
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })

const raw = readFileSync(process.argv[2], 'utf8')
// the file may contain prose; extract the {"photos":[...]} block
const m = raw.match(/\{\s*"photos"\s*:\s*\[[\s\S]*?\]\s*\}/)
if (!m) { console.error('no {"photos":[...]} block found'); process.exit(1) }
const photos = JSON.parse(m[0]).photos

const slugify = (n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const map = JSON.parse(readFileSync(MAP, 'utf8'))

let ok = 0
let skipped = 0
for (const p of photos) {
  if (!p.photoUrl) { skipped++; console.log('no url:', p.name); continue }
  try {
    const r = await fetch(p.photoUrl)
    const ct = r.headers.get('content-type') || ''
    if (!r.ok || !ct.startsWith('image')) { skipped++; console.log('bad fetch:', p.name, r.status, ct); continue }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 3000) { skipped++; console.log('too small:', p.name); continue }
    const slug = slugify(p.name)
    const out = await sharp(buf).resize({ width: 400, height: 520, fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 82 }).toBuffer()
    writeFileSync(join(DIR, `${slug}.webp`), out)
    map[p.name.toLowerCase().trim()] = `/athletes/${slug}.webp`
    ok++
  } catch (e) {
    skipped++
    console.log('error:', p.name, e.message)
  }
}
writeFileSync(MAP, JSON.stringify(map, null, 2))
console.log(`extras hosted: ${ok}, skipped: ${skipped}; map now has ${Object.keys(map).length} entries`)
