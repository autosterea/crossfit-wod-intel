#!/usr/bin/env node
/*
 * refresh-castro-interviews.mjs
 * -----------------------------
 * Daily sweep of Dave Castro's official YouTube channel (@davecastro6289) for
 * NEW "2026 CrossFit Games athlete interview - <Name>" videos and links each to
 * the matching locked-field athlete in athletes-2026.json.
 *
 * Correctness (matches the hard rules):
 *  - ONLY links videos whose title is exactly the "...athlete interview - <Name>"
 *    pattern from Castro's own 2026 channel (Week-in-Review and other clips are
 *    ignored). The channel + title pattern IS the verification.
 *  - Matches <Name> to an athlete by normalized full name, else by a UNIQUE
 *    last-name match (handles title typos like "Mortiz" for Moritz). If the name
 *    is ambiguous or unmatched, it is skipped (null > wrong).
 *  - Only fills athletes that have NO interview yet; never overwrites an existing
 *    link. Idempotent: a second run with no new videos changes nothing.
 *
 * Output: writes athletes-2026.json if anything changed and prints a JSON summary
 * { added: [{slug,name,url}], changed: <bool> } on the last line for the caller.
 *
 * Network: needs youtube.com (reachable off-VPS and from CI / cloud routines).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ATHLETES = resolve(REPO, 'src/data/games/athletes-2026.json')
const CHANNEL = 'https://www.youtube.com/@davecastro6289/videos'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ 'ł': 'l', 'ø': 'o', 'đ': 'd' })[c] || c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

async function fetchChannel() {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(CHANNEL, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en' } })
      if (r.ok) return await r.text()
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 800))
  }
  throw new Error('could not fetch Castro channel')
}

function parseInterviews(html) {
  const out = []
  for (const seg of html.split('"lockupViewModel"').slice(1)) {
    const id = (seg.match(/"contentId":"([\w-]{11})"/) || [])[1]
    const title = (seg.match(/"lockupMetadataViewModel":\{"title":\{"content":"([^"]+)"/) || [])[1]
    if (!id || !title) continue
    // strict: "...athlete interview - <Name>" and NOT a Week-in-Review clip
    const m = title.match(/athlete interview\s*[-–]\s*(.+?)\s*$/i)
    if (!m || /\bWIR\b|week in review/i.test(title)) continue
    out.push({ id, name: m[1].trim() })
  }
  return out
}

const html = await fetchChannel()
const interviews = parseInterviews(html)

const data = JSON.parse(readFileSync(ATHLETES, 'utf8'))
const roster = [...(data.men ?? []), ...(data.women ?? [])]
const byFull = new Map(roster.map((a) => [norm(a.name), a]))
const byLast = new Map()
for (const a of roster) {
  const last = norm(a.name).split(' ').pop()
  if (!byLast.has(last)) byLast.set(last, [])
  byLast.get(last).push(a)
}

const added = []
const skipped = []
for (const iv of interviews) {
  const key = norm(iv.name)
  let athlete = byFull.get(key)
  if (!athlete) {
    const last = key.split(' ').pop()
    const cands = byLast.get(last) || []
    if (cands.length === 1) athlete = cands[0] // unique last-name match (covers title typos)
  }
  if (!athlete) {
    skipped.push({ title: iv.name, reason: 'no unique athlete match' })
    continue
  }
  if (athlete.interviewUrl) continue // already linked; never overwrite
  athlete.interviewUrl = `https://www.youtube.com/watch?v=${iv.id}`
  added.push({ slug: athlete.slug, name: athlete.name, url: athlete.interviewUrl })
}

if (added.length) writeFileSync(ATHLETES, JSON.stringify(data, null, 2) + '\n')

const linked = roster.filter((a) => a.interviewUrl).length
console.error(`[castro-interviews] channel interviews=${interviews.length} added=${added.length} totalLinked=${linked} skipped=${skipped.length}`)
for (const a of added) console.error(`  + ${a.name} -> ${a.url}`)
for (const s of skipped) console.error(`  ? skipped "${s.title}" (${s.reason})`)
console.log(JSON.stringify({ changed: added.length > 0, added, totalLinked: linked }))
