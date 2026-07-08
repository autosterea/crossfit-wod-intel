#!/usr/bin/env node
/*
 * validate-analysis-posts.mjs
 * Fails the build if any Breakdown post is malformed, so a broken post can never
 * ship (a missing/!array field would crash the article reader at runtime).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(resolve(REPO, 'src/data/games/analysis-posts.json'), 'utf8'))
const posts = Array.isArray(raw) ? raw : raw.posts
const errs = []
const need = ['slug', 'title', 'dek', 'category', 'date', 'author', 'readMin', 'blocks']

const seen = new Set()
for (const [i, p] of posts.entries()) {
  const id = p.slug || `#${i}`
  for (const f of need) if (p[f] === undefined || p[f] === null) errs.push(`${id}: missing "${f}"`)
  if (p.slug && seen.has(p.slug)) errs.push(`${id}: duplicate slug`)
  seen.add(p.slug)
  if (p.date && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) errs.push(`${id}: bad date "${p.date}"`)
  if (p.sources !== undefined && !Array.isArray(p.sources)) errs.push(`${id}: "sources" must be an array`)
  if (!Array.isArray(p.blocks)) { errs.push(`${id}: "blocks" must be an array`); continue }
  for (const [bi, b] of p.blocks.entries()) {
    const at = `${id} block ${bi} (${b.type})`
    if (!b.type) { errs.push(`${at}: missing type`); continue }
    if (['p', 'h2', 'callout'].includes(b.type) && typeof b.text !== 'string') errs.push(`${at}: needs string "text"`)
    if (b.type === 'list' && !Array.isArray(b.items)) errs.push(`${at}: needs array "items"`)
    if (b.type === 'ranked') {
      if (!Array.isArray(b.rows)) errs.push(`${at}: needs array "rows"`)
      else b.rows.forEach((r, ri) => { if (!r || typeof r.name !== 'string' || r.value === undefined) errs.push(`${at} row ${ri}: needs name + value`) })
    }
    if (!['p', 'h2', 'callout', 'list', 'ranked'].includes(b.type)) errs.push(`${at}: unknown block type "${b.type}"`)
  }
}

if (errs.length) {
  console.error(`\n[validate-analysis-posts] ${errs.length} problem(s):`)
  errs.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}
console.log(`[validate-analysis-posts] OK - ${posts.length} posts valid`)
