#!/usr/bin/env node
// Downscale self-hosted athlete photos to a mobile-friendly size and normalize to .webp.
// Profiles display at <=96px (so ~384px covers retina). Updates photoUrl to .webp.
import sharp from 'sharp'
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, '..', 'public', 'athletes')
const ATH = join(__dirname, '..', 'src', 'data', 'games', 'athletes-2026.json')

const files = readdirSync(DIR).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
const bySlug = {}
let totalBefore = 0
let totalAfter = 0
for (const f of files) {
  const slug = f.replace(/\.[^.]+$/, '')
  const src = join(DIR, f)
  const inputBuf = readFileSync(src) // read fully into memory (no lingering handle)
  totalBefore += inputBuf.length
  const buf = await sharp(inputBuf)
    .resize({ width: 400, height: 520, fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toBuffer()
  if (!/\.webp$/i.test(f)) rmSync(src) // drop old non-webp original
  writeFileSync(join(DIR, `${slug}.webp`), buf)
  totalAfter += buf.length
  bySlug[slug] = `/athletes/${slug}.webp`
}

// Update photoUrl in data to the normalized .webp paths
const d = JSON.parse(readFileSync(ATH, 'utf8'))
let updated = 0
for (const div of ['men', 'women']) {
  for (const a of d[div]) {
    if (bySlug[a.slug]) { a.photoUrl = bySlug[a.slug]; updated++ }
  }
}
writeFileSync(ATH, JSON.stringify(d, null, 2))
console.log(`resized ${files.length} images, photoUrls updated ${updated}`)
console.log(`total ${(totalBefore / 1024).toFixed(0)}KB -> ${(totalAfter / 1024).toFixed(0)}KB`)
const sizes = readdirSync(DIR).map((f) => readFileSync(join(DIR, f)).length)
console.log(`per-image: avg ${(sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024).toFixed(1)}KB, max ${(Math.max(...sizes) / 1024).toFixed(1)}KB`)
