#!/usr/bin/env node

/**
 * CrossFit News Pipeline (VERIFIED AGGREGATOR - no LLM, no git)
 *
 * Aggregates REAL CrossFit news from a fixed set of confirmed feeds, dedupes
 * against a persistent ledger, link-verifies every NEW article (must return
 * 200), writes a JSON feed the site consumes, and emails a branded SendGrid
 * newsletter of what was NEWLY published this run.
 *
 * This script NEVER synthesizes or alters facts. Every headline, summary and
 * link comes verbatim from a fetched source. It only surfaces real articles.
 *
 * Usage:
 *   node scripts/news-pipeline.mjs            # full run: fetch, write JSON, email
 *   node scripts/news-pipeline.mjs --dry      # fetch + build + print summary, NO writes, NO email
 *   node scripts/news-pipeline.mjs --no-email # fetch + write JSON, but do not send email
 *
 * Environment overrides (all external paths/recipients):
 *   NEWS_REPO  repo root to write public/news-feed.json + dist/news-feed.json
 *              (default /opt/crossfit-wod-intel)
 *   NEWS_DATA  data dir holding the dedupe ledger seen.json
 *              (default /opt/crossfit-news)
 *   NEWS_TO    newsletter recipient (default ravi@autosterea.com)
 *
 * Dependency-light: standard Node 20+ ESM only. The single optional native
 * module (better-sqlite3, used to read SendGrid credentials) is loaded LAZILY
 * and only when actually sending, so --dry / --no-email work on any machine.
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FLAGS = new Set(process.argv.slice(2))
const DRY = FLAGS.has('--dry')
const NO_EMAIL = FLAGS.has('--no-email')

const NEWS_REPO = process.env.NEWS_REPO || '/opt/crossfit-wod-intel'
const NEWS_DATA = process.env.NEWS_DATA || '/opt/crossfit-news'
const NEWS_TO = process.env.NEWS_TO || 'ravi@autosterea.com'

const PUBLIC_JSON = join(NEWS_REPO, 'public', 'news-feed.json')
const DIST_JSON = join(NEWS_REPO, 'dist', 'news-feed.json')
const LEDGER_PATH = join(NEWS_DATA, 'seen.json')

const MAX_AGE_DAYS = 35
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000
const FEED_TIMEOUT_MS = 20000
const VERIFY_TIMEOUT_MS = 15000

// A real browser User-Agent: several feeds (notably BarBend) 404 to non-browser
// clients, so we present as a normal desktop Chrome.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// PA brand tokens
const PA_GREEN = '#019644'
const PA_YELLOW_GREEN = '#91C640'
const PA_DARK = '#070d0a'

// ---------------------------------------------------------------------------
// Feed registry. Each feed declares:
//   kind        'rss' (RSS/Atom) | 'sitemap'
//   broad       true => apply the relevance keyword filter; Games-specific /
//               official feeds keep all recent items
//   reliability 'official' | 'high' | 'medium'
// ---------------------------------------------------------------------------
const FEEDS = [
  {
    name: 'CrossFit Games (YouTube)',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCRs1pHnES3QDdh43xbjOmzw',
    kind: 'rss',
    broad: false,
    reliability: 'official',
    forceCategory: 'video',
  },
  {
    name: 'Morning Chalk Up',
    url: 'https://morningchalkup.com/feed/',
    kind: 'rss',
    broad: true,
    reliability: 'high',
  },
  {
    name: 'The Barbell Spin',
    url: 'https://thebarbellspin.com/category/crossfit-games/feed/',
    kind: 'rss',
    broad: false, // Games-only category feed: keep all recent
    reliability: 'high',
  },
  {
    name: 'BarBend',
    url: 'https://barbend.com/crossfit/feed/',
    kind: 'rss',
    broad: true,
    reliability: 'high',
  },
  {
    name: 'BOXROX',
    url: 'https://www.boxrox.com/crossfit/feed/',
    kind: 'rss',
    broad: true,
    reliability: 'medium',
  },
  {
    name: 'Fitness Volt',
    url: 'https://fitnessvolt.com/feed/',
    kind: 'rss',
    broad: true,
    reliability: 'medium',
  },
  {
    name: 'BoxLife',
    url: 'https://www.boxlifemagazine.com/feed/',
    kind: 'rss',
    broad: true,
    reliability: 'medium',
  },
  // NOTE: crossfit.com/sport (official articles) is NOT fetchable from the VPS -
  // Cloudflare returns 403 to the datacenter IP regardless of User-Agent (an IP
  // block, confirmed 2026-06-13). The official backbone is therefore the
  // CrossFit Games YouTube feed above (which works), plus the news sites'
  // coverage of official announcements. parseSitemap + fetchArticleMeta are
  // kept for a future fetch-via-proxy path if ever wanted.
]

// "official + high" feeds we rely on for the source-health alert.
const CRITICAL_RELIABILITY = new Set(['official', 'high'])

// ---------------------------------------------------------------------------
// Relevance keywords for broad/medium sources.
// Title OR description must match one of these (case-insensitive, word-ish).
// ---------------------------------------------------------------------------
const KEYWORDS = [
  'crossfit',
  'games',
  'semifinal',
  'quarterfinal',
  'the open',
  'rogue invitational',
  'wodapalooza',
]

// Known elite athlete surnames (a match on any keeps a broad-source item).
const ATHLETE_SURNAMES = [
  'fraser', 'froning', 'toomey', 'davidsdottir', 'vellner', 'adler', 'ohlsen',
  'panchik', 'macleod', 'medeiros', 'sprague', 'pereira', 'kotch',
  'horvath', 'hobart', 'dukic', 'briggs', 'thorisdottir', 'sigmundsdottir',
  'mayhew', 'fikowski', 'crouch', 'koski', 'saunders',
  'mariotti', 'godhe', 'sandbakken', 'lehmann',
  'pugliese', 'castro',
]

const RELEVANCE_RE = new RegExp(
  '\\b(' + [...KEYWORDS, ...ATHLETE_SURNAMES].map(escapeRe).join('|') + ')\\b',
  'i',
)

// Drop obvious commerce / evergreen / lifestyle noise from broad sources
// (gift guides, deals, recipes, how-to listicles, gym-business tips). Kept
// deliberately TIGHT so real competition/athlete news is never filtered out.
const EXCLUDE_RE = new RegExp(
  [
    'gift guide', "father'?s day gift", "mother'?s day gift", 'holiday gift',
    'best .{0,30}(?:gifts?|deals?)\\b', '\\bon sale\\b', '\\bdeals?\\b',
    'discount', '% off', '\\bcoupon\\b', 'promo code', 'black friday', 'cyber monday',
    '\\brecipe\\b', 'supplement guide', 'buyer.?s guide',
    'best .{0,30}(?:shoes?|barbells?|equipment|kettlebells?) (?:for|of)\\b',
    'biggest mistake', 'gym owner', 'grow your gym', 'how to start a',
    // evergreen / marketing pages that show up in the official sport sitemap
    '\\bvacation\\b', 'documentary now available', 'guide to a ', '\\bmerch\\b',
    'merchandise', '\\bapparel\\b', 'shop the', 'now available to (?:rent|purchase)',
  ].join('|'),
  'i',
)

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
function log(...args) {
  console.log('[news-pipeline]', ...args)
}

function nowIso() {
  return new Date().toISOString()
}

/** Decode common HTML entities (named + numeric) found in feed text. */
function decodeEntities(s) {
  if (!s) return ''
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
}

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

/** Strip any CDATA wrapper, HTML tags, then decode entities -> clean text. */
function stripHtml(raw) {
  if (!raw) return ''
  let s = String(raw)
  // Unwrap CDATA sections.
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  // Drop script/style blocks entirely.
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  // Convert a few block tags to spaces so words don't run together.
  s = s.replace(/<br\s*\/?>/gi, ' ')
  s = s.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
  // Remove all remaining tags.
  s = s.replace(/<[^>]+>/g, ' ')
  s = decodeEntities(s)
  // Drop dash characters per brand voice (no em/en dashes); collapse whitespace.
  s = s.replace(/[‒–—―]/g, '-')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** Get the inner text of the first <tag>...</tag> in a block (CDATA-aware). */
function tagText(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = block.match(re)
  return m ? m[1] : ''
}

/**
 * Get an Atom <link href="..."/> (self-closing) preferring rel="alternate".
 * Falls back to RSS <link>text</link>.
 */
function extractLink(block) {
  // Atom: prefer rel="alternate", else first link with href.
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)]
  let alternate = null
  let firstHref = null
  for (const l of links) {
    const attrs = l[1]
    const hrefM = attrs.match(/href="([^"]+)"/i)
    if (!hrefM) continue
    const href = decodeEntities(hrefM[1])
    if (!firstHref) firstHref = href
    if (/rel="alternate"/i.test(attrs)) {
      alternate = href
      break
    }
  }
  if (alternate) return alternate
  if (firstHref) return firstHref
  // RSS: <link>https://...</link>
  const rss = tagText(block, 'link')
  return decodeEntities(stripCdata(rss)).trim()
}

function stripCdata(s) {
  if (!s) return ''
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

/**
 * Canonicalize a URL for dedupe: lowercase host, strip query + hash, drop a
 * trailing slash (except root). Falls back to the trimmed raw string on parse
 * failure so we still dedupe identical strings.
 */
function canonicalizeUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    u.hash = ''
    u.search = ''
    u.hostname = u.hostname.toLowerCase()
    let out = u.toString()
    if (out.endsWith('/') && u.pathname !== '/') out = out.slice(0, -1)
    return out
  } catch {
    return s.split('#')[0].split('?')[0].toLowerCase()
  }
}

function idForUrl(canonicalUrl) {
  return createHash('sha1').update(canonicalUrl).digest('hex').slice(0, 16)
}

function toIso(dateStr) {
  if (!dateStr) return null
  const t = Date.parse(dateStr.trim())
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString()
}

function ymd(iso) {
  return iso ? iso.slice(0, 10) : ''
}

function clamp(s, n) {
  if (s.length <= n) return s
  // Reserve room for the trailing ellipsis so we stay <= n chars.
  return s.slice(0, n - 3).trimEnd() + '...'
}

// ---------------------------------------------------------------------------
// Fetch with browser UA, redirect-follow, and a hard timeout.
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url, { method = 'GET', timeout = FEED_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// RSS / Atom parsing (regex-based, dependency-free).
// Handles both <item> (RSS) and <entry> (Atom).
// ---------------------------------------------------------------------------
function parseRss(xml, feed) {
  const items = []
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ]
  for (const m of blocks) {
    const block = m[0]
    try {
      const titleRaw = tagText(block, 'title')
      const title = stripHtml(titleRaw)
      const link = extractLink(block)
      if (!title || !link) continue

      // Date: RSS pubDate; Atom published/updated; some feeds use dc:date.
      const dateRaw =
        tagText(block, 'pubDate') ||
        tagText(block, 'published') ||
        tagText(block, 'updated') ||
        tagText(block, 'dc:date') ||
        ''
      const publishedAt = toIso(decodeEntities(stripCdata(dateRaw)))

      // Description: RSS description / content:encoded; Atom summary / content /
      // media:description (YouTube uses media:description in media:group).
      const descRaw =
        tagText(block, 'description') ||
        tagText(block, 'content:encoded') ||
        tagText(block, 'summary') ||
        tagText(block, 'media:description') ||
        tagText(block, 'content') ||
        ''
      const summary = clamp(stripHtml(descRaw), 220)

      items.push({ title, link, publishedAt, summary })
    } catch (err) {
      log(`  parse-item error in ${feed.name}: ${err.message}`)
    }
  }
  return items
}

// ---------------------------------------------------------------------------
// Sitemap parsing for crossfit.com/sport-sitemap.xml: <url><loc>+<lastmod>.
// No titles in a sitemap, so derive a Title-Cased headline from the slug.
// ---------------------------------------------------------------------------
function parseSitemap(xml) {
  const items = []
  const urlBlocks = [...xml.matchAll(/<url\b[\s\S]*?<\/url>/gi)]
  for (const m of urlBlocks) {
    const block = m[0]
    try {
      const loc = decodeEntities(stripCdata(tagText(block, 'loc'))).trim()
      if (!loc) continue
      // Keep only real /sport/ article URLs (skip the section index itself).
      let path
      try {
        path = new URL(loc).pathname
      } catch {
        continue
      }
      if (!/\/sport\//i.test(path)) continue
      const segs = path.split('/').filter(Boolean)
      const slug = segs[segs.length - 1] || ''
      if (!slug || slug.toLowerCase() === 'sport') continue

      const lastmod = decodeEntities(stripCdata(tagText(block, 'lastmod'))).trim()
      const publishedAt = toIso(lastmod)
      const title = titleCaseSlug(slug)
      if (!title) continue

      items.push({ title, link: loc, publishedAt, summary: '' })
    } catch {
      // skip a bad <url> block
    }
  }
  return items
}

/**
 * Fetch an article page and pull its REAL headline (og:title or <title>) plus a
 * short description, for sitemap sources that carry no titles. Strips a trailing
 * site-name suffix (" | CrossFit"). Returns null on any failure so the caller
 * skips the item (which also serves as a liveness check on the URL).
 */
async function fetchArticleMeta(url) {
  try {
    const res = await fetchWithTimeout(url, { timeout: FEED_TIMEOUT_MS })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 80000)
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    const tt = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    let title = decodeEntities(stripCdata(og?.[1] || tt?.[1] || '')).replace(/\s+/g, ' ').trim()
    title = title.replace(/\s*[|–—-]\s*CrossFit(?: Games)?\s*$/i, '').trim()
    const ogd = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    const md = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    const summary = clip(decodeEntities(stripCdata(ogd?.[1] || md?.[1] || '')).replace(/\s+/g, ' ').trim(), 220)
    return title ? { title, summary } : null
  } catch {
    return null
  }
}

function titleCaseSlug(slug) {
  const small = new Set(['a', 'an', 'and', 'the', 'of', 'to', 'in', 'on', 'for', 'at', 'vs', 'by'])
  const words = slug
    .replace(/\.\w+$/, '') // drop a trailing extension if any
    .split(/[-_]+/)
    .filter(Boolean)
  if (!words.length) return ''
  return words
    .map((w, i) => {
      const lower = w.toLowerCase()
      // Keep all-numeric tokens (years, "2026") as-is.
      if (/^\d+$/.test(w)) return w
      if (i !== 0 && small.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

// ---------------------------------------------------------------------------
// Category assignment (simple keyword rules over headline + summary).
// ---------------------------------------------------------------------------
function assignCategory(item, feed) {
  if (feed.forceCategory) return feed.forceCategory
  const hay = `${item.headline} ${item.summary}`.toLowerCase()
  if (/\b(semifinal|semi-final)s?\b/.test(hay)) return 'semifinals'
  if (/\b(withdraw|withdrawal|withdraws|pull(?:s|ed)? out|out of the|injur)/.test(hay)) return 'withdrawal'
  if (/\b(qualif|earns? a spot|punch(?:es|ed)? (?:a |their )?ticket|the open|quarterfinal)/.test(hay)) return 'qualification'
  if (/\b(results?|leaderboard|wins?|winner|champion|takes? (?:the |first|gold)|recap)/.test(hay)) return 'results'
  if (/\b(schedule|announc|date|venue|location|when (?:is|are)|format|tickets?)/.test(hay)) return 'schedule'
  if (/\b(video|watch|youtube|episode|interview|highlight)/.test(hay)) return 'video'
  if (feed.kind === 'rss' && /youtube\.com/i.test(item.sourceUrl)) return 'video'
  if (/\b(athlete|rookie|veteran|profile|signs?|sponsor)/.test(hay)) return 'athlete'
  return 'other'
}

// ---------------------------------------------------------------------------
// Ledger (persistent dedupe). { "canonicalUrl": "ISO firstSeen", ... }
// ---------------------------------------------------------------------------
function loadLedger() {
  try {
    if (existsSync(LEDGER_PATH)) {
      const data = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
      if (data && typeof data === 'object') return data
    }
  } catch (err) {
    log(`ledger load failed (${err.message}); starting fresh`)
  }
  return {}
}

function saveLedger(ledger) {
  mkdirSync(NEWS_DATA, { recursive: true })
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2))
}

// ---------------------------------------------------------------------------
// Existing feed JSON (to merge new items into the running list).
// ---------------------------------------------------------------------------
function loadExistingFeed() {
  for (const p of [PUBLIC_JSON, DIST_JSON]) {
    try {
      if (existsSync(p)) {
        const data = JSON.parse(readFileSync(p, 'utf8'))
        if (data && Array.isArray(data.items)) return data
      }
    } catch {
      // try next
    }
  }
  return { generated: null, sourceHealth: [], items: [] }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log(`start ${nowIso()} ${DRY ? '[DRY]' : ''} ${NO_EMAIL ? '[NO-EMAIL]' : ''}`)
  log(`repo=${NEWS_REPO} data=${NEWS_DATA} to=${NEWS_TO}`)

  const cutoffMs = Date.now() - MAX_AGE_MS
  const ledger = loadLedger()
  const existing = loadExistingFeed()

  // Track health, keyed by feed name; seed from prior run so lastSuccess persists.
  const priorHealth = new Map((existing.sourceHealth || []).map((h) => [h.name, h]))
  const sourceHealth = []

  // Gather candidate items per feed.
  const candidates = []
  for (const feed of FEEDS) {
    let ok = false
    let fetched = []
    try {
      const res = await fetchWithTimeout(feed.url, { timeout: FEED_TIMEOUT_MS })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.text()
      if (!body || body.length < 50) throw new Error('empty body')
      const raw = feed.kind === 'sitemap' ? parseSitemap(body) : parseRss(body, feed)
      ok = true
      fetched = raw
      log(`feed OK ${feed.name}: ${raw.length} raw items`)
    } catch (err) {
      log(`feed FAIL ${feed.name}: ${err.message}`)
    }

    const prior = priorHealth.get(feed.name)
    sourceHealth.push({
      name: feed.name,
      ok,
      lastSuccess: ok ? nowIso() : prior?.lastSuccess || null,
    })

    if (!ok) continue

    for (const it of fetched) {
      // Age filter (skip undated only when we cannot place them in window).
      const pubMs = it.publishedAt ? Date.parse(it.publishedAt) : NaN
      if (!Number.isNaN(pubMs) && pubMs < cutoffMs) continue
      if (Number.isNaN(pubMs) && feed.broad) continue // undated broad item: cannot confirm recency

      // Sitemap sources (crossfit.com/sport) carry no titles. Fetch the real
      // headline for items we have NOT already published (already-seen URLs are
      // deduped out anyway, so skip the fetch). A failed fetch => skip the item.
      if (feed.kind === 'sitemap') {
        if (ledger[canonicalizeUrl(it.link)]) continue
        const meta = await fetchArticleMeta(it.link)
        if (!meta) continue
        it.title = meta.title
        if (meta.summary) it.summary = meta.summary
      }

      const hay = `${it.title} ${it.summary}`
      // Noise filter (commerce/evergreen/marketing) applies to ALL sources.
      if (EXCLUDE_RE.test(hay)) continue
      // Relevance keyword filter for broad sources only (official/Games feeds
      // keep all recent items).
      if (feed.broad && !RELEVANCE_RE.test(hay)) continue

      candidates.push({
        feed,
        headline: it.title,
        summary: it.summary || '',
        sourceUrl: it.link,
        publishedAt: it.publishedAt || nowIso(),
      })
    }
  }

  // Build set of canonical URLs already in the running list (defense in depth).
  const existingCanon = new Set((existing.items || []).map((i) => canonicalizeUrl(i.sourceUrl)))

  // Dedupe candidates against the ledger AND each other (same article from two
  // feeds appears once). First feed in FEEDS order wins (official/high first).
  const newByCanon = new Map()
  for (const c of candidates) {
    const canon = canonicalizeUrl(c.sourceUrl)
    if (!canon) continue
    if (ledger[canon]) continue // already posted in a prior run
    if (existingCanon.has(canon)) continue // already in running list
    if (newByCanon.has(canon)) continue // duplicate within this run
    newByCanon.set(canon, { ...c, canon })
  }

  log(`candidates=${candidates.length} new(after dedupe)=${newByCanon.size}`)

  // LINK-VERIFY each NEW item: GET (follow redirects). Drop ONLY on a
  // definitive "gone" status (404/410) - a real article from a real feed must
  // NOT be nuked by a transient blip (timeout, 5xx, rate-limit, bot-wall), or
  // we silently lose legitimate news on a slow day.
  const verifiedNew = []
  for (const c of newByCanon.values()) {
    let drop = false
    try {
      const res = await fetchWithTimeout(c.sourceUrl, { method: 'GET', timeout: VERIFY_TIMEOUT_MS })
      if (res.status === 404 || res.status === 410) {
        drop = true
        log(`  verify DROP (dead ${res.status}) ${c.sourceUrl}`)
      } else if (res.status !== 200) {
        log(`  verify keep (transient HTTP ${res.status}) ${c.sourceUrl}`)
      }
    } catch (err) {
      log(`  verify keep (transient: ${err.message}) ${c.sourceUrl}`)
    }
    if (drop) continue

    const item = {
      id: idForUrl(c.canon),
      headline: c.headline,
      summary: c.summary,
      sourceName: c.feed.name,
      sourceUrl: c.sourceUrl,
      date: ymd(c.publishedAt),
      publishedAt: c.publishedAt,
      category: 'other',
      reliability: c.feed.reliability,
    }
    item.category = assignCategory(item, c.feed)
    verifiedNew.push(item)
  }

  log(`verified new items=${verifiedNew.length}`)

  // Merge new items into the running list, cap to last 120 days, newest first.
  const merged = [...verifiedNew, ...(existing.items || [])]
  // Dedupe merged by id (in case an existing item lacked a ledger entry).
  const seenId = new Set()
  const capped = []
  for (const it of merged) {
    if (!it || !it.id) continue
    if (seenId.has(it.id)) continue
    const pubMs = it.publishedAt ? Date.parse(it.publishedAt) : NaN
    if (!Number.isNaN(pubMs) && pubMs < cutoffMs) continue
    seenId.add(it.id)
    capped.push(it)
  }
  capped.sort((a, b) => {
    const ta = Date.parse(a.publishedAt) || 0
    const tb = Date.parse(b.publishedAt) || 0
    return tb - ta
  })

  const feedJson = {
    generated: nowIso(),
    sourceHealth,
    items: capped,
  }

  // Source-health: did EVERY official+high feed fail this run?
  const criticalFeeds = sourceHealth.filter((h) => {
    const f = FEEDS.find((x) => x.name === h.name)
    return f && CRITICAL_RELIABILITY.has(f.reliability)
  })
  const allCriticalFailed = criticalFeeds.length > 0 && criticalFeeds.every((h) => !h.ok)

  // ---- Output: write JSON + update ledger (unless dry) ----
  if (DRY) {
    log('DRY: would write news-feed.json to:')
    log(`  ${PUBLIC_JSON}`)
    log(`  ${DIST_JSON}`)
    log(`DRY: total items in feed = ${capped.length}; new this run = ${verifiedNew.length}`)
    printSummary(verifiedNew, sourceHealth, allCriticalFailed)
  } else {
    try {
      mkdirSync(join(NEWS_REPO, 'public'), { recursive: true })
      writeFileSync(PUBLIC_JSON, JSON.stringify(feedJson, null, 2))
      log(`wrote ${PUBLIC_JSON}`)
    } catch (err) {
      log(`ERROR writing public json: ${err.message}`)
    }
    // Copy to dist so it serves immediately without a rebuild. If dist exists,
    // copy the freshly written public file; else write directly.
    try {
      if (existsSync(join(NEWS_REPO, 'dist'))) {
        copyFileSync(PUBLIC_JSON, DIST_JSON)
        log(`copied -> ${DIST_JSON}`)
      } else {
        log(`dist/ not present; skipped ${DIST_JSON} (public copy survives rebuilds)`)
      }
    } catch (err) {
      log(`ERROR copying to dist: ${err.message}`)
    }

    // Update the ledger with every NEW canonical URL we verified+published.
    try {
      for (const it of verifiedNew) {
        ledger[canonicalizeUrl(it.sourceUrl)] = it.publishedAt || nowIso()
      }
      saveLedger(ledger)
      log(`ledger updated (${Object.keys(ledger).length} entries)`)
    } catch (err) {
      log(`ERROR updating ledger: ${err.message}`)
    }
  }

  // ---- Email ----
  if (NO_EMAIL) {
    log('email skipped (--no-email)')
  } else if (DRY) {
    if (allCriticalFailed) {
      log('DRY: would send SOURCE-HEALTH ALERT email (all official+high feeds failed).')
    } else {
      const subj = subjectLine(verifiedNew)
      log(`DRY: would email ${NEWS_TO} -> subject: "${subj}"`)
    }
  } else {
    try {
      if (allCriticalFailed) {
        await sendEmail({
          to: NEWS_TO,
          subject: 'CrossFit Now - SOURCE HEALTH ALERT',
          html: buildAlertEmail(sourceHealth),
        })
        log('sent source-health ALERT email')
      } else {
        await sendEmail({
          to: NEWS_TO,
          subject: subjectLine(verifiedNew),
          html: buildNewsletterEmail(verifiedNew),
        })
        log(`sent newsletter email (${verifiedNew.length} new)`)
      }
    } catch (err) {
      log(`ERROR sending email: ${err.message}`)
    }
  }

  // Concise summary line.
  const okFeeds = sourceHealth.filter((h) => h.ok).length
  log(
    `done: feeds ${okFeeds}/${FEEDS.length} ok, ${verifiedNew.length} new published, ` +
      `${capped.length} in feed${allCriticalFailed ? ', CRITICAL ALERT' : ''}`,
  )
}

function printSummary(newItems, sourceHealth, allCriticalFailed) {
  log('--- WOULD EMAIL / NEW THIS RUN ---')
  if (allCriticalFailed) {
    log('  !! all official+high feeds failed -> alert email instead of newsletter')
  }
  if (!newItems.length) {
    log('  (no new items - would send "all quiet today" note)')
  }
  for (const it of newItems) {
    log(`  [${it.category}/${it.reliability}] ${it.sourceName}: ${it.headline}`)
    log(`     ${it.sourceUrl}`)
  }
  log('--- SOURCE HEALTH ---')
  for (const h of sourceHealth) {
    log(`  ${h.ok ? 'OK ' : 'FAIL'} ${h.name}${h.lastSuccess ? ` (last ${h.lastSuccess})` : ''}`)
  }
}

// ---------------------------------------------------------------------------
// Subject + email bodies
// ---------------------------------------------------------------------------
function monDd(d = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

function subjectLine(newItems) {
  const n = newItems.length
  if (n === 0) return `CrossFit Now - ${monDd()}: all quiet today`
  return `CrossFit Now - ${monDd()}: ${n} new update${n === 1 ? '' : 's'}`
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const CATEGORY_LABEL = {
  semifinals: 'Semifinals',
  qualification: 'Qualification',
  withdrawal: 'Withdrawal',
  athlete: 'Athlete',
  video: 'Video',
  schedule: 'Schedule',
  results: 'Results',
  other: 'News',
}

function emailShell(innerHtml) {
  // Inline styles only (email clients). PA green header, Poppins with fallbacks.
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f5f4;font-family:Poppins,'Helvetica Neue',Arial,sans-serif;color:#1a201d;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:${PA_GREEN};padding:22px 28px;">
      <div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${PA_YELLOW_GREEN};font-weight:600;">Persistence Athletics</div>
      <div style="font-size:26px;font-weight:700;color:#ffffff;margin-top:2px;">CrossFit Now</div>
    </div>
    ${innerHtml}
    <div style="background:${PA_DARK};padding:18px 28px;">
      <div style="font-size:11px;color:#7e8c84;line-height:1.6;">
        Verified aggregator. Every headline links to its original source; nothing here is rewritten or invented.<br>
        Persistence Athletics &middot; <a href="https://wod.persistenceathletics.com/" style="color:${PA_YELLOW_GREEN};text-decoration:none;">wod.persistenceathletics.com</a>
      </div>
    </div>
  </div>
</body>
</html>`
}

function buildNewsletterEmail(newItems) {
  if (!newItems.length) {
    const inner = `
    <div style="padding:28px;">
      <div style="font-size:16px;font-weight:600;margin-bottom:8px;">All quiet today.</div>
      <div style="font-size:14px;color:#566;line-height:1.6;">
        No new CrossFit updates surfaced across the tracked sources in this run.
        We will email again the next time something new is published.
      </div>
    </div>`
    return emailShell(inner)
  }

  // Top line: count + the single biggest headline. "Biggest" = highest
  // reliability, then newest.
  const reliabilityRank = { official: 0, high: 1, medium: 2 }
  const top = [...newItems].sort((a, b) => {
    const r = (reliabilityRank[a.reliability] ?? 9) - (reliabilityRank[b.reliability] ?? 9)
    if (r !== 0) return r
    return (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)
  })[0]

  const n = newItems.length
  const topLine = `
    <div style="padding:24px 28px 8px 28px;">
      <div style="font-size:14px;color:#566;">${n} new update${n === 1 ? '' : 's'} this run. Top story:</div>
      <a href="${escHtml(top.sourceUrl)}" target="_blank" rel="noopener noreferrer"
         style="display:block;font-size:18px;font-weight:700;color:${PA_GREEN};text-decoration:none;margin-top:6px;line-height:1.35;">
        ${escHtml(top.headline)}
      </a>
      <div style="font-size:12px;color:#8a948f;margin-top:4px;">${escHtml(top.sourceName)} &middot; ${escHtml(CATEGORY_LABEL[top.category] || 'News')}</div>
    </div>
    <div style="border-top:1px solid #e6ebe8;margin:16px 28px 0 28px;"></div>`

  // Cap the emailed list so a busy day (or the first backlog run) stays a
  // scannable digest, not a wall; the full running feed is one tap away.
  const EMAIL_MAX = 12
  const shown = newItems.slice(0, EMAIL_MAX)
  const rows = shown
    .map((it) => {
      const label = CATEGORY_LABEL[it.category] || 'News'
      return `
      <div style="padding:14px 28px;border-bottom:1px solid #f0f3f1;">
        <a href="${escHtml(it.sourceUrl)}" target="_blank" rel="noopener noreferrer"
           style="font-size:15px;font-weight:600;color:#1a201d;text-decoration:none;line-height:1.4;">
          ${escHtml(it.headline)}
        </a>
        <div style="font-size:12px;color:#8a948f;margin-top:5px;">
          <span style="color:${PA_GREEN};font-weight:600;">${escHtml(it.sourceName)}</span>
          &middot; ${escHtml(label)}
          &middot; <span style="text-transform:uppercase;letter-spacing:0.5px;">${escHtml(it.reliability)}</span>
        </div>
        ${it.summary ? `<div style="font-size:13px;color:#566;margin-top:6px;line-height:1.55;">${escHtml(it.summary)}</div>` : ''}
      </div>`
    })
    .join('')

  const more = newItems.length > EMAIL_MAX ? `+ ${newItems.length - EMAIL_MAX} more. ` : ''
  const cta = `
    <div style="padding:18px 28px 26px 28px;text-align:center;">
      <a href="https://wod.persistenceathletics.com/news" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;background:${PA_GREEN};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:8px;">
        ${more}See the full running feed</a>
    </div>`

  const inner = `${topLine}<div style="padding-top:4px;">${rows}</div>${cta}`
  return emailShell(inner)
}

function buildAlertEmail(sourceHealth) {
  const list = sourceHealth
    .map(
      (h) =>
        `<li style="margin:4px 0;">${h.ok ? 'OK' : '<strong style="color:#c0392b;">FAILED</strong>'} - ${escHtml(h.name)}</li>`,
    )
    .join('')
  const inner = `
    <div style="padding:28px;">
      <div style="font-size:17px;font-weight:700;color:#c0392b;margin-bottom:10px;">Source health alert</div>
      <div style="font-size:14px;color:#566;line-height:1.6;">
        Every official and high-reliability feed failed to fetch on this run, so the
        pipeline did NOT publish an empty newsletter. This is likely a transient
        network or upstream outage. No facts were altered; nothing was invented.
      </div>
      <ul style="font-size:13px;color:#1a201d;margin:14px 0 0 0;padding-left:18px;">${list}</ul>
    </div>`
  return emailShell(inner)
}

// ---------------------------------------------------------------------------
// SendGrid. Credentials mirror /opt/autosterea-platform/deploy/send-release-email.js:
// read from the SQLite platform_settings table. better-sqlite3 is loaded LAZILY.
// ---------------------------------------------------------------------------
async function loadSendgridCreds() {
  // Lazy require so --dry / --no-email work without the native module present.
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const Database = require('/opt/autosterea-platform/node_modules/better-sqlite3')
  const db = new Database('/opt/autosterea-webhook/data/autosterea.db', {
    readonly: true,
    fileMustExist: true,
  })
  try {
    const get = (key) => {
      const row = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(key)
      return row ? row.value : null
    }
    const apiKey = get('sendgrid_api_key')
    const senderEmail = get('sendgrid_sender_email')
    const senderName = get('sendgrid_sender_name')
    if (!apiKey || !senderEmail) {
      throw new Error('missing sendgrid_api_key or sendgrid_sender_email in platform_settings')
    }
    return { apiKey, senderEmail, senderName: senderName || 'Persistence Athletics' }
  } finally {
    db.close()
  }
}

async function sendEmail({ to, subject, html }) {
  const creds = await loadSendgridCreds()
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: creds.senderEmail, name: creds.senderName },
    subject,
    content: [{ type: 'text/html', value: html }],
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (res.status !== 202 && res.status !== 200) {
    const body = await res.text().catch(() => '')
    throw new Error(`SendGrid HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
}

// ---------------------------------------------------------------------------
main().catch((err) => {
  // Never throw the whole run; log and exit cleanly (cron-friendly).
  console.error('[news-pipeline] fatal:', err && err.stack ? err.stack : err)
  process.exit(0)
})
