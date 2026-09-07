#!/usr/bin/env node
// Copies src/data/crossfit-data.json to public/data/crossfit-data.json so the
// dataset ships as a static asset fetched at runtime instead of being inlined
// into the main JS chunk (~2.4MB savings). Runs before `vite build` (see the
// "build" script) and before `vite` dev via "predev".
//
// src/data/crossfit-data.json stays the source of truth - the scraper and
// analysis scripts read/write it there. This script only mirrors it.
import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src', 'data', 'crossfit-data.json')
const destDir = join(root, 'public', 'data')
const dest = join(destDir, 'crossfit-data.json')

try {
  mkdirSync(destDir, { recursive: true })
  copyFileSync(src, dest)
  const kb = Math.round(statSync(dest).size / 1024)
  console.log(`[copy-data-to-public] crossfit-data.json -> public/data/ (${kb} KB)`)
} catch (err) {
  console.error(`[copy-data-to-public] FAILED: ${err.message}`)
  process.exit(1)
}
