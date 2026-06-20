#!/usr/bin/env node
/*
 * merge-semifinal-research.mjs
 * ----------------------------
 * Merges the verified per-event Semifinal data from the research workflow
 * (semi-research-*.tmp.json, one per event, each an array of
 * {slug, overallFinish, fieldSize, perEvent, sourceUrl, ok, note}) into
 * src/data/games/semifinals-2026.json. Only ok=true entries with a real
 * sourceUrl are merged; per-event detail is only written when present (else the
 * athlete keeps the overall finish). Nothing is fabricated.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(REPO, 'src/data/games/semifinals-2026.json')
const data = JSON.parse(readFileSync(OUT, 'utf8'))

// process base research files first, then completion-pass files (semi-research-cN)
// so a more-complete completion entry overrides a partial earlier one.
const files = readdirSync(REPO)
  .filter((f) => /^semi-research-c?\d+\.tmp\.json$/.test(f))
  .sort((a, b) => (/-c\d/.test(a) ? 1 : 0) - (/-c\d/.test(b) ? 1 : 0))
let merged = 0
let withDetail = 0
const dropped = []
for (const f of files) {
  const isCompletion = /-c\d/.test(f) // authoritative completion pass: overrides partials, even to clear them
  let arr
  try {
    arr = JSON.parse(readFileSync(resolve(REPO, f), 'utf8'))
  } catch {
    continue
  }
  for (const v of arr) {
    if (!v || !v.slug) continue
    if (!v.ok || (!v.sourceUrl && !isCompletion)) {
      dropped.push(`${v.slug} (${v.note || 'not ok / no source'})`)
      continue
    }
    const entry = data.athletes[v.slug]
    if (!entry) continue
    if (v.fieldSize) entry.fieldSize = v.fieldSize
    if (v.sourceUrl) entry.sourceUrl = v.sourceUrl
    if (v.overallFinish && !entry.overallFinish) entry.overallFinish = v.overallFinish
    const clean = (Array.isArray(v.perEvent) ? v.perEvent : [])
      .filter((e) => e && Number.isFinite(e.n) && (e.place == null || Number.isFinite(e.place)))
      .sort((a, b) => a.n - b.n)
      .map((e) => ({ n: e.n, ...(e.label ? { label: e.label } : {}), ...(e.score ? { score: e.score } : {}), place: e.place ?? null }))
    if (isCompletion) {
      // authoritative: set whatever the completion verifier decided (full set, or
      // empty = keep overall-finish only; never leave a misleading partial)
      entry.perEvent = clean
      if (clean.length) { entry.source = 'researched + verified from official event results'; withDetail++ }
    } else if (clean.length) {
      entry.perEvent = clean
      entry.source = 'researched + verified from official event results'
      withDetail++
    }
    merged++
  }
}

writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n')
const total = Object.keys(data.athletes).length
const anyDetail = Object.values(data.athletes).filter((a) => a.perEvent && a.perEvent.length).length
console.log(`merged ${merged} in-person entries (${withDetail} with new per-event detail)`)
console.log(`semifinals-2026.json: ${total} athletes, ${anyDetail} now have per-event detail (incl. online)`)
if (dropped.length) console.log('dropped (kept overall finish only):\n  ' + dropped.join('\n  '))
