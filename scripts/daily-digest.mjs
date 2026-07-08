#!/usr/bin/env node
/*
 * daily-digest.mjs
 * ----------------
 * Builds the daily @cf_games_update status digest for the team. Deterministic,
 * no fabrication: it only reports what the official CrossFit page, the live news
 * feed, and our committed data actually say. Prints a Slack-ready digest to
 * stdout (the routine posts it verbatim) and a machine-readable JSON on the last
 * line. Uses only Node built-ins + global fetch (runs in a cloud routine).
 *
 * Key job as the Games approach: detect when a NEW event is announced on the
 * official page (games.crossfit.com/workouts/finals/2026/<n>) so we can turn a
 * preview around fast, and surface anything else worth a post.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const SITE = process.env.SITE || 'https://wod.persistenceathletics.com'
const REPO = process.env.NEWS_REPO || process.cwd()

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readJson = (rel) => { try { return JSON.parse(readFileSync(resolve(REPO, rel), 'utf8')) } catch { return null } }

async function get(url) {
  for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en' } }); if (r.ok) return await r.text() } catch {} await new Promise((r) => setTimeout(r, 400)) }
  return ''
}

// A published Games event page has the event's name in its <title>
// ("2026 Games Workout <NAME> Women Rx"); an unpublished slot has a blank name.
async function namedEvents() {
  const found = []
  for (let n = 1; n <= 20; n++) {
    const html = await get(`https://games.crossfit.com/workouts/finals/2026/${n}`)
    if (!html) { if (n > 3) break; else continue }
    const m = html.match(/2026 Games Workout\s+(.+?)\s+(?:Women|Men)\s+Rx/i)
    const name = m && m[1].trim()
    if (name) found.push({ num: n, name })
    else if (n > (found.at(-1)?.num ?? 0) + 1) break // hit a blank past the last named -> stop
  }
  return found
}

function daysToGames() {
  // The 2026 Games individual competition runs Jul 22-26. Compute vs Jul 22.
  const target = Date.parse('2026-07-22T00:00:00Z')
  const now = new Date().toISOString().slice(0, 10)
  const d = Math.ceil((target - Date.parse(now + 'T00:00:00Z')) / 86400000)
  return d
}

const today = new Date().toISOString().slice(0, 10)
const yday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10)

// 1) new-event detection (official) + what we've already covered
const events = await namedEvents()
const eventsData = readJson('src/data/games/events-2026.json')
const coveredNums = new Set((eventsData?.items || []).filter((x) => x.num).map((x) => x.num))
const uncovered = events.filter((e) => !coveredNums.has(e.num))

// 2) recent news from the live feed
let recentNews = []
try {
  const feed = JSON.parse(await get(`${SITE}/news-feed.json`))
  recentNews = (feed.items || []).filter((it) => (it.date || '') >= yday).slice(0, 8)
} catch {}
const eventNews = recentNews.filter((it) => /\bevent\b|first event|second event|workout \d|is here/i.test(it.headline || ''))

// 3) field + interviews
const ath = readJson('src/data/games/athletes-2026.json')
const roster = ath ? [...(ath.men || []), ...(ath.women || [])] : []
const interviews = roster.filter((a) => a.interviewUrl).length
const fieldLocked = !!ath?.meta?.fieldLocked

// ---- build the digest ----
const D = daysToGames()
const L = []
L.push(`:mega: *CF Games daily digest - ${today}*  (${D > 0 ? `${D} days to San Jose` : 'GAMES WEEK'})`)
L.push('')
if (uncovered.length) {
  L.push(`:rotating_light: *NEW EVENT ANNOUNCED - build a preview:*`)
  uncovered.forEach((e) => L.push(`   - Event ${e.num}: "${e.name}"  (games.crossfit.com/workouts/finals/2026/${e.num})`))
} else {
  L.push(`:white_check_mark: Events: ${events.length} announced so far (Event ${events.map((e) => e.num).join(', ') || '-'}). No new event since last covered.`)
}
L.push('')
if (recentNews.length) {
  L.push(`*News (last 24-48h):* ${recentNews.length} item(s)${eventNews.length ? ' - includes possible event news :point_down:' : ''}`)
  recentNews.slice(0, 5).forEach((it) => L.push(`   - ${it.date?.slice(0, 10)} [${(it.sourceName || '').slice(0, 14)}] ${(it.headline || '').slice(0, 70)}`))
} else {
  L.push('*News:* nothing new in the last day.')
}
L.push('')
L.push(`*Status:* field ${fieldLocked ? 'locked 30+30' : 'not locked'} · ${interviews}/60 interviews linked.`)
L.push('')
const post = uncovered.length
  ? `:point_right: *Action:* a NEW event dropped -> build its Breakdown blog post + a Story card (9:16, /share/posts/story-<slug>.png), then post the kit to the team here so Anu can share and drive traffic to the blog.`
  : eventNews.length
    ? `:point_right: *Action:* event-related news is out - consider a Breakdown post + Story card, then post to the team. Otherwise run the weekly kit.`
    : `:point_right: *Action:* no new event today. Keep the daily cadence: post the latest Breakdown's Story card (link sticker -> the article), plus the weekly kit (matchups / spotlights / picks).`
L.push(post)

const digest = L.join('\n')
console.log(digest)
console.log('\n---JSON---')
console.log(JSON.stringify({ date: today, daysToGames: D, announcedEvents: events, newEvents: uncovered, recentNewsCount: recentNews.length, eventNewsCount: eventNews.length, interviews, fieldLocked }))
