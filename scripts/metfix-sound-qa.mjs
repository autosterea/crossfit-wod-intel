// Sound QA for every narrated story: the MetFix modules and, since H.75, the /fitness chapters (DESIGN.md section I,
// amendments H.72, H.74 and H.75), run against a
// served build:   node scripts/metfix-sound-qa.mjs <baseUrl> <outDir> [test ...]
// (base e.g. http://127.0.0.1:5570/preview, no trailing slash). Needs Playwright (resolved from this repo, or
// from the package.json named by PLAYWRIGHT_FROM). Tests:
//   gesture    NO autoplay flag, real taps: first visit = no AudioContext, nothing fetched under /narration/,
//              the chip and the toggle (off); a tap on the chip starts the voice; '1' stored = still no context
//              until a gesture (toggle shows Waiting), a tap on Next starts it; M on desktop starts it
//   fitness    /fitness speaks too (H.75): a chapter shows the chip and the toggle, makes no context and fetches
//              nothing before a gesture; a tap on the chip starts its voice; desktop: the keyhint names M and M starts it
//   timing     autoplay flag, ?sound=1: every narrated story end to end (SOUND_QA_STORIES=metfix-lab/ros,fitness/intro
//              picks some); each clip starts after its beat,
//              plays its whole duration on the audio clock, in beat order; the next beat starts after the clip
//              end plus the breath; no clip ever overlaps another. H.74: every frame of a sounding clip shows
//              the build t its knots map the clip position to (within SYNC_TOL s of the audio clock), and the
//              build ends where the plan says
//   silent     ?sound=0: every beat lasts the C.3 rule in story time (the timing of the silent story)
//   behaviour  pause / resume continues the clip; next, prev, seek, explore stop it; hidden pauses and
//              resumes; the open Read more holds it; a module change cancels it and the next module speaks
//   render     __story.renderAudio mixdowns (mix, voice, bed) of both modules into <outDir>, metered, with
//              their plans (<slug>-timeline.json: clip spans, build spans and the sync knots)
//   shots      the Sound on chip and the toggle at 390x664, 390x844, 1440x900 (first visit, then on)
// Exit 1 on any failure. Analytics are aborted in every context. (scripts/sound-qa.mjs, the /fitness
// Capacity suite, is dormant: no /fitness chapter declares narration since H.72.)
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { BREATH, LEAD, PRE_ROLL, ROOT, holdFor, narratedStories, readBeats } from './narration-lib.mjs'

const tryRequire = (from) => {
  try {
    return createRequire(from)('playwright')
  } catch {
    return null
  }
}
const pw =
  (process.env.PLAYWRIGHT_FROM && tryRequire(process.env.PLAYWRIGHT_FROM)) ||
  tryRequire(join(ROOT, 'package.json')) ||
  tryRequire('C:/Users/ravik/OneDrive/Desktop/Claude/Projects/CrossFit/app/package.json')
if (!pw) {
  console.error('playwright not found: set PLAYWRIGHT_FROM to a package.json whose node_modules has playwright')
  process.exit(2)
}
const { chromium } = pw

const [base, out, ...only] = process.argv.slice(2)
if (!base || !out) {
  console.error('usage: node metfix-sound.local.mjs <baseUrl> <outDir> [test ...]')
  process.exit(2)
}
mkdirSync(out, { recursive: true })
const want = (n) => !only.length || only.includes(n)
const ANALYTICS = /googletagmanager|google-analytics|analytics\.google|doubleclick|facebook|clarity\.ms|bing\.com|google\.com\/(g|ccm|rmkt|pagead)/
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const AUTOPLAY = '--autoplay-policy=no-user-gesture-required'
/**
 * Every narrated story (a MetFix module, or since H.75 a /fitness chapter): its route, the view its clips carry (the
 * StoryDef key) and its story.ts. SOUND_QA_STORIES="metfix-lab/ros,fitness/intro" runs some of them.
 */
// a build without the MetFix course (the /fitness release on main) has no modules.ts: then there are no MetFix stories either
const MODULES_TS = join(ROOT, 'src', 'metfix-lab', 'modules.ts')
const MODULE_SLUGS = existsSync(MODULES_TS) ? [...readFileSync(MODULES_TS, 'utf8').matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]) : []
/**
 * A MetFix story folder's route (the course thread, STORYBOARD-bridges.md): a module opens without its bridge
 * (?intro=0, so the module itself is under test), bridge-<n> plays alone at /metfix-lab/<slug of module n>/intro
 * (it holds its end there), the trailer at /metfix-lab/trailer. The StoryDef key (the clips' view) is the one the
 * course shell sets: lab-metfix-<folder> (storyKey in modules.ts).
 */
function metfixRoute(folder) {
  const b = /^bridge-(\d)$/.exec(folder)
  if (b) return { path: `/metfix-lab/${MODULE_SLUGS[Number(b[1]) - 1]}/intro`, query: '' }
  if (folder === 'trailer') return { path: '/metfix-lab/trailer', query: '' }
  return { path: `/metfix-lab/${folder}`, query: 'intro=0' }
}
const ALL = narratedStories()
  .filter((s) => !s.error)
  .map((s) => {
    const slug = s.name.split('/').pop()
    const metfix = s.name.includes('/metfix-lab/')
    const key = metfix ? `lab-metfix-${slug}` : (readFileSync(s.storyFile, 'utf8').match(/key:\s*'([^']+)'/) || [])[1]
    const route = metfix ? metfixRoute(slug) : { path: slug === 'intro' ? '/fitness' : `/fitness/${slug}`, query: '' }
    return { name: `${metfix ? 'metfix-lab' : 'fitness'}/${slug}`, path: route.path, query: route.query, view: key, storyFile: s.storyFile }
  })
/** a story's URL with these query params (its own route params first) */
const urlOf = (st, q) => `${st.path}?${[st.query, q].filter(Boolean).join('&')}`
const pick = (process.env.SOUND_QA_STORIES || '').split(',').filter(Boolean)
const STORIES = pick.length ? ALL.filter((s) => pick.includes(s.name)) : ALL
const fileOf = (st) => st.name.replace('/', '-')
/**
 * H.74: the picture may differ from the voice by this much (s, on the audio clock), plus the sample's own frame
 * interval: the recorder's rAF callback and the engine's are not ordered, so a sample can show the previous frame
 */
const SYNC_TOL = 0.12
// the sync map (the engine's syncT, story/audio/hooks.ts): build t at clip time c
const syncT = (knots, c0, build, c) => {
  let pc = c0
  let pt = 0
  for (const [t, k] of knots) {
    if (c <= k) return c <= pc ? pt : pt + ((t - pt) * (c - pc)) / (k - pc)
    pc = k
    pt = t
  }
  return Math.min(1, pt + (c - pc) / Math.max(0.1, build))
}
let fails = 0
const report = {}
const ok = (m) => console.log('ok   ' + m)
const fail = (m) => {
  fails++
  console.log('FAIL ' + m)
}
const check = (c, m, d) => (c ? ok(m) : fail(m + (d !== undefined ? ' ' + JSON.stringify(d) : '')))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// counts every AudioContext the page constructs and keeps it (its clock is the audio clock)
const COUNT_AC = `(() => {
  window.__acN = 0; window.__acs = []
  const C = window.AudioContext || window.webkitAudioContext
  if (!C) return
  class W extends C { constructor(...a) { super(...a); window.__acN++; window.__acs.push(this) } }
  window.AudioContext = W; window.webkitAudioContext = W
})()`
// a hidden page on demand (document.hidden + visibilitychange)
const SET_HIDDEN = `(() => {
  let h = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') })
  window.__setHidden = (v) => { h = v; document.dispatchEvent(new Event('visibilitychange')) }
})()`
// per frame: story time (sum of min(dt, 0.1)), the audio clock, the story and voice state
const RECORD = `(() => {
  window.__rec = []; let last = 0; let S = 0
  const step = (p) => {
    const dt = last ? Math.min((p - last) / 1000, 0.1) : 0
    last = p
    const st = window.__story
    if (st && st.state) {
      const s = st.state(); const a = st.audio ? st.audio() : null
      S += s.loaded && s.playing ? dt : 0
      const c = window.__acs && window.__acs[0] ? window.__acs[0].currentTime : null
      window.__rec.push({ p, S, c, i: s.index, t: s.t, ph: s.phase, pl: s.playing, ld: s.loaded, v: st.chapter,
        clip: a && a.clip ? a.clip.beat : null, cv: a && a.clip ? a.clip.view : null, on: !!(a && a.playing),
        pos: a ? a.position : null, sf: a ? a.startedFrom : null, narr: a ? a.beatHold.narr : null })
    }
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
})()`

async function open(browser, path, o = {}) {
  const vp = o.vp ?? { width: 390, height: 844 }
  const mobile = vp.width < 800
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile })
  await ctx.route(ANALYTICS, (r) => r.abort())
  if (o.store) await ctx.addInitScript(`try { localStorage.setItem('fitness-sound', '${o.store}') } catch {}`)
  for (const s of o.init ?? []) await ctx.addInitScript(s)
  const page = await ctx.newPage()
  const log = { errors: [], narr: [] }
  page.on('pageerror', (e) => log.errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') log.errors.push(m.text())
  })
  page.on('request', (r) => {
    if (r.url().includes('/narration/')) log.narr.push(r.url())
  })
  await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => document.querySelector('[data-story-ready="1"]') && window.__story, null, { timeout: 90000 })
  return { ctx, page, log }
}
async function until(page, fn, arg, ms = 8000) {
  try {
    await page.waitForFunction(fn, arg, { timeout: ms, polling: 20 })
    return true
  } catch {
    return false
  }
}
const audioOf = (page) => page.evaluate(() => window.__story.audio())
async function test(name, fn) {
  if (!want(name)) return
  console.log(`--- ${name}`)
  try {
    await fn()
  } catch (err) {
    fail(`${name} crashed: ${err instanceof Error ? err.stack : String(err)}`)
  }
}

const plain = await chromium.launch({ headless: true, args: GL })
const auto = await chromium.launch({ headless: true, args: [...GL, AUTOPLAY] })

/* ------------------------------ gesture ------------------------------ */
await test('gesture', async () => {
  {
    const { ctx, page, log } = await open(plain, '/metfix-lab/two-sciences?intro=0', { init: [COUNT_AC] })
    await sleep(2600)
    const s = await page.evaluate(() => ({
      ac: window.__acN,
      chip: !!document.querySelector('.st-soundchip'),
      toggle: document.querySelector('.mf-topbar .st-sound')?.getAttribute('data-state') ?? null,
      cs: window.__story.audio().contextState,
      playing: window.__story.state().playing,
    }))
    check(s.ac === 0 && s.cs === 'none', 'first visit: no AudioContext before a gesture', s)
    check(log.narr.length === 0, 'first visit: nothing fetched under /narration/', log.narr)
    check(s.chip, 'first visit: the Sound on chip shows')
    check(s.toggle === 'off', 'first visit: the top-bar toggle shows Off', s.toggle)
    check(s.playing, 'first visit: the story autoplays silently')
    await page.tap('.st-soundchip')
    const on = await until(page, () => window.__story.audio().contextState === 'running' && window.__story.audio().playing, null, 8000)
    const a = await page.evaluate(() => ({ ac: window.__acN, a: window.__story.audio(), pref: localStorage.getItem('fitness-sound') }))
    check(on && a.ac === 1, 'a real tap on the chip: one context, running, the voice plays', { ac: a.ac, cs: a.a.contextState, clip: a.a.clip })
    check(a.pref === '1', 'the choice is stored', a.pref)
    check(log.narr.length > 0, 'clips fetched only after the gesture', log.narr.length)
    await until(page, () => document.querySelector('.mf-topbar .st-sound')?.getAttribute('data-state') === 'on', null, 3000)
    check((await page.evaluate(() => document.querySelector('.mf-topbar .st-sound')?.getAttribute('data-state'))) === 'on', 'the toggle shows On')
    await ctx.close()
  }
  {
    const { ctx, page } = await open(plain, '/metfix-lab/two-sciences?intro=0', { init: [COUNT_AC], store: '1' })
    await sleep(2600)
    const s = await page.evaluate(() => ({ ac: window.__acN, cs: window.__story.audio().contextState, toggle: document.querySelector('.mf-topbar .st-sound')?.getAttribute('data-state'), chip: !!document.querySelector('.st-soundchip') }))
    check(s.ac === 0 && s.cs === 'none', "returning '1': still no context before a gesture", s)
    check(s.toggle === 'waiting', "returning '1': the toggle shows Waiting", s.toggle)
    await page.tap('[aria-label="Next beat"]')
    const on = await until(page, () => window.__story.audio().contextState === 'running' && window.__story.audio().playing && window.__story.audio().clip.beat === 'certainty', null, 9000)
    check(on, "returning '1': a tap on Next unlocks audio and the next beat speaks", await audioOf(page))
    check((await page.evaluate(() => window.__acN)) === 1, "returning '1': exactly one context")
    await ctx.close()
  }
  {
    const { ctx, page } = await open(plain, '/metfix-lab/bayes?intro=0', { init: [COUNT_AC], store: '1', vp: { width: 1440, height: 900 } })
    await sleep(1500)
    check((await page.evaluate(() => window.__acN)) === 0, 'desktop: no context before a key')
    const hint = await page.evaluate(() => document.querySelector('.st-keyhint')?.textContent ?? '')
    check(hint.includes('M for sound'), 'desktop keyhint names M on a narrated module', hint)
    await page.keyboard.press('m')
    const on = await until(page, () => window.__story.audio().contextState === 'running', null, 6000)
    check(on, 'desktop: M starts sound (the key is the gesture)')
    await ctx.close()
  }
})

/* ------------------------------ fitness ------------------------------ */
await test('fitness', async () => {
  // H.75: the /fitness lesson speaks too, under the same gesture rule as a MetFix module
  const def = ALL.find((x) => x.name === 'fitness/definition')
  {
    const { ctx, page, log } = await open(plain, '/fitness/definition', { init: [COUNT_AC] })
    await sleep(2600)
    const s = await page.evaluate(() => ({
      ac: window.__acN,
      chip: !!document.querySelector('.st-soundchip'),
      toggle: document.querySelector('.st-topbar .st-sound')?.getAttribute('data-state') ?? null,
      hasSound: !!document.querySelector('.st-topbar.has-sound'),
      cs: window.__story.audio().contextState,
    }))
    check(s.ac === 0 && s.cs === 'none', '/fitness first visit: no AudioContext before a gesture', s)
    check(log.narr.length === 0, '/fitness first visit: nothing fetched under /narration/', log.narr)
    check(s.chip && s.hasSound && s.toggle === 'off', '/fitness first visit: the Sound on chip and the top-bar toggle (Off)', s)
    await page.tap('.st-soundchip')
    const on = await until(page, () => window.__story.audio().contextState === 'running' && window.__story.audio().playing, null, 8000)
    const a = await audioOf(page)
    check(on && !!a.clip && a.clip.view === def?.view, `/fitness: a tap on the chip starts the chapter's voice (${def?.view})`, a.clip)
    check(log.narr.some((u) => u.includes('/narration/fitness/definition/')), '/fitness: its clips are fetched after the gesture', log.narr.length)
    await ctx.close()
  }
  {
    const { ctx, page } = await open(plain, '/fitness/pathways', { init: [COUNT_AC], store: '1', vp: { width: 1440, height: 900 } })
    await sleep(1500)
    check((await page.evaluate(() => window.__acN)) === 0, '/fitness desktop: no context before a key')
    const hint = await page.evaluate(() => document.querySelector('.st-keyhint')?.textContent ?? '')
    check(hint.includes('M for sound'), '/fitness desktop keyhint names M', hint)
    await page.keyboard.press('m')
    check(await until(page, () => window.__story.audio().contextState === 'running', null, 6000), '/fitness desktop: M starts sound')
    await ctx.close()
  }
})

/* ------------------------------ timing ------------------------------ */
async function runStory(st, q) {
  const { ctx, page, log } = await open(auto, urlOf(st, `${q}&tier=low`), { init: [COUNT_AC, RECORD] })
  const beats = await page.evaluate(() => window.__story.beats)
  const done = await until(page, () => window.__story.state().phase === 'done', null, 420000)
  await sleep(300)
  const rec = await page.evaluate(() => window.__rec)
  let plan = null
  if (q.includes('sound=1')) plan = await page.evaluate((n) => window.__story.audioTimeline(0, n - 1), beats.length)
  await ctx.close()
  return { done, rec, beats, plan, errors: log.errors }
}

await test('timing', async () => {
  for (const st of STORIES) {
    const slug = st.name
    const r = await runStory(st, 'sound=1')
    check(r.done, `${slug}: autoplay reaches the end with sound on`)
    if (!r.done) continue
    const rec = r.rec.filter((x) => x.ld)
    const ids = r.beats.map((b) => b.id)
    const view = st.view
    // a playing sample always belongs to the current beat's clip, of this story
    const wrong = rec.filter((x) => x.on && (x.clip !== ids[x.i] || x.cv !== view))
    check(wrong.length === 0, `${slug}: every sounding sample is the current beat's clip`, wrong.slice(0, 3))
    const order = []
    for (const x of rec) if (x.on && order[order.length - 1] !== x.clip) order.push(x.clip)
    check(JSON.stringify(order) === JSON.stringify(ids), `${slug}: the clips play once each, in beat order`, order)
    const rows = []
    let prevEnd = null
    for (let n = 0; n < ids.length; n++) {
      const pl = r.plan.find((p) => p.beat === n)
      const dur = pl.clip[1] - pl.clip[0]
      const on = rec.filter((x) => x.on && x.clip === ids[n] && x.c !== null && x.pos !== null)
      const starts = on.map((x) => x.c - x.pos).sort((a, b) => a - b)
      const clipStart = starts.length ? starts[Math.floor(starts.length / 2)] : NaN
      const spread = starts.length ? starts[starts.length - 1] - starts[0] : NaN
      const maxPos = on.reduce((m, x) => Math.max(m, x.pos), 0)
      // a lead that elapses between frames starts the clip up to a frame in (the engine keeps the planned time);
      // a resume would start it further in
      const restarted = on.some((x) => x.sf !== null && x.sf > 0.12)
      const first = rec.find((x) => x.i === n)
      const nextFirst = rec.find((x) => x.i === n + 1)
      const doneAt = n === ids.length - 1 ? rec.find((x) => x.ph === 'done') : null
      const beatStartC = first?.c ?? null
      const endC = (nextFirst ?? doneAt)?.c ?? null
      const clipEnd = clipStart + dur
      const row = {
        beat: ids[n],
        dur: +dur.toFixed(3),
        lead: beatStartC !== null && n > 0 ? +(clipStart - beatStartC).toFixed(3) : null,
        played: +maxPos.toFixed(3),
        afterClip: endC !== null ? +(endC - clipEnd).toFixed(3) : null,
        beatLen: beatStartC !== null && endC !== null ? +(endC - beatStartC).toFixed(3) : null,
        planned: +pl.total.toFixed(3),
        gapFromPrevClip: prevEnd !== null ? +(clipStart - prevEnd).toFixed(3) : null,
        clockSpread: +spread.toFixed(3),
      }
      rows.push(row)
      check(maxPos >= dur - 0.12 && !restarted && spread < 0.06, `${slug}#${ids[n]}: the clip plays its whole ${dur.toFixed(2)} s on the audio clock, once`, row)
      if (n > 0) check(row.lead !== null && row.lead > 0.03 && row.lead < 0.45, `${slug}#${ids[n]}: it starts shortly after the beat starts (${row.lead} s)`, row)
      check(row.afterClip !== null && row.afterClip >= BREATH - 0.08, `${slug}#${ids[n]}: the beat holds until the clip ends plus the breath (+${row.afterClip} s)`, row)
      if (n > 0 && row.beatLen !== null) check(Math.abs(row.beatLen - row.planned) < 0.3, `${slug}#${ids[n]}: the beat lasts its planned ${row.planned} s (${row.beatLen} s)`, row)
      if (prevEnd !== null) check(row.gapFromPrevClip >= BREATH + LEAD - 0.1, `${slug}#${ids[n]}: no overlap with the previous clip (${row.gapFromPrevClip} s apart)`, row)
      prevEnd = clipEnd
      // H.74: the picture follows the voice. Every frame of the sounding clip shows t = W(clip position)
      // within SYNC_TOL s of the audio clock, and the build ends (t = 1) where the plan puts it
      if (pl.sync) {
        const knots = pl.sync.map(([abs, t]) => [t, abs - pl.clip[0]])
        const c0 = pl.build[0] - pl.clip[0]
        const build = r.beats[n].build
        let worst = 0
        let worstAt = null
        for (const x of on) {
          const k = rec.indexOf(x)
          const frame = k > 0 ? Math.min(0.1, (x.p - rec[k - 1].p) / 1000) : 0.1
          const lo = syncT(knots, c0, build, x.pos - SYNC_TOL - frame) - 0.002
          const hi = syncT(knots, c0, build, x.pos + SYNC_TOL) + 0.002
          const err = x.t < lo ? lo - x.t : x.t > hi ? x.t - hi : 0
          if (err > worst) {
            worst = err
            worstAt = { pos: +x.pos.toFixed(3), t: +x.t.toFixed(4), want: +syncT(knots, c0, build, x.pos).toFixed(4) }
          }
        }
        check(on.length > 20 && worst === 0, `${slug}#${ids[n]}: every frame of the voice shows the build t its ${knots.length} knots map the clip position to (within ${SYNC_TOL} s plus a frame of the audio clock; ${on.length} frames)`, worstAt)
        // the first sample showing t = 1, and the one before it: the build ended between their clip positions
        const ke = rec.findIndex((x) => x.i === n && x.t >= 1 && x.pos !== null)
        const endAt = ke > 0 ? rec[ke] : null
        const before = ke > 0 && rec[ke - 1].i === n && rec[ke - 1].pos !== null ? rec[ke - 1] : null
        const plannedEnd = pl.build[1] - pl.clip[0]
        row.buildEnd = endAt ? +endAt.pos.toFixed(3) : null
        row.plannedBuildEnd = +plannedEnd.toFixed(3)
        const lo = (before ? before.pos : endAt ? endAt.pos : 0) - SYNC_TOL
        const hi = (endAt ? endAt.pos : 0) + SYNC_TOL
        check(!!endAt && plannedEnd >= lo && plannedEnd <= hi, `${slug}#${ids[n]}: the build ends at ${plannedEnd.toFixed(2)} s into the clip, as planned (between the samples at ${before ? before.pos.toFixed(2) : '?'} and ${row.buildEnd} s)`, row)
      } else fail(`${slug}#${ids[n]}: no sync knots in the plan (H.74)`)
    }
    report[`timing-${slug}`] = { rows, plan: r.plan, errors: r.errors }
    console.table(rows)
  }
})

/* ------------------------------ silent ------------------------------ */
await test('silent', async () => {
  for (const st of STORIES) {
    const slug = st.name
    const full = readBeats(st.storyFile)
    const r = await runStory(st, 'sound=0')
    check(r.done, `${slug}: autoplay reaches the end with sound off`)
    if (!r.done) continue
    const rec = r.rec.filter((x) => x.ld)
    check(rec.every((x) => x.narr === null && !x.on), `${slug}: sound off arms nothing`)
    const rows = []
    let maxDt = 0
    for (let k = 1; k < rec.length; k++) maxDt = Math.max(maxDt, Math.min(0.1, (rec[k].p - rec[k - 1].p) / 1000))
    const tol = Math.max(0.12, 2.2 * maxDt)
    for (let n = 0; n < full.length; n++) {
      const first = rec.find((x) => x.i === n)
      const end = rec.find((x) => x.i === n + 1) ?? rec.find((x) => x.ph === 'done')
      if (!first || !end) continue
      const last = n === full.length - 1
      const rule = (n === 0 ? 0 : PRE_ROLL) + full[n].build + (last ? 0 : holdFor(full[n]))
      const got = end.S - first.S
      rows.push({ beat: full[n].id, rule: +rule.toFixed(3), story: +got.toFixed(3) })
      // beat 0 starts at loaded (no pre-roll): its first sample can be a frame late
      check(Math.abs(got - rule) < tol, `${slug}#${full[n].id}: sound off lasts the C.3 rule ${rule.toFixed(2)} s in story time (${got.toFixed(2)}; frame tolerance ${tol.toFixed(2)})`)
    }
    report[`silent-${slug}`] = rows
  }
})

/* ------------------------------ behaviour ------------------------------ */
await test('behaviour', async () => {
  const { ctx, page } = await open(auto, '/metfix-lab/two-sciences?intro=0&sound=1&tier=low', { init: [COUNT_AC, SET_HIDDEN] })
  const ids = await page.evaluate(() => window.__story.beats.map((b) => b.id))
  const playingPast = (beat, pos) => until(page, ([b, p]) => { const a = window.__story.audio(); return a.playing && a.clip && a.clip.beat === b && a.position > p }, [beat, pos], 12000)
  // pause / resume
  check(await playingPast(ids[0], 1.5), 'beat 0 speaks')
  await page.evaluate(() => window.__story.pause())
  await sleep(700)
  const p1 = await audioOf(page)
  await sleep(900)
  const p2 = await audioOf(page)
  check(!p1.playing && p1.position !== null && Math.abs(p1.position - p2.position) < 0.001, 'pause: the voice stops and keeps its place', { p1: p1.position, p2: p2.position })
  await page.evaluate(() => window.__story.play())
  await until(page, () => window.__story.audio().playing, null, 3000)
  const p3 = await audioOf(page)
  check(p3.playing && Math.abs(p3.startedFrom - p1.position) < 0.08, `resume: the clip continues from ${p1.position?.toFixed(2)} s`, { startedFrom: p3.startedFrom })
  // next
  await playingPast(ids[0], 2.5)
  await page.evaluate(() => window.__story.next())
  const cut = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(window.__story.audio()))))
  check(!cut.playing || (cut.clip && cut.clip.beat !== 'fork'), 'next: the voice stops in the same frame', cut.clip)
  check(await until(page, (b) => { const a = window.__story.audio(); return a.playing && a.clip.beat === b && a.startedFrom === 0 }, ids[1], 9000), 'next: the next beat speaks from its start')
  // prev
  await playingPast(ids[1], 1)
  await page.evaluate(() => window.__story.prev())
  const cut2 = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(window.__story.audio()))))
  check(!cut2.playing || cut2.clip.beat !== ids[1], 'prev: the voice stops at once', cut2.clip)
  check(await until(page, (b) => { const a = window.__story.audio(); return a.playing && a.clip.beat === b && a.startedFrom === 0 }, ids[0], 9000), 'prev: the previous beat speaks from its start')
  // seek (a scrub or deep link holds, silently)
  await playingPast(ids[0], 1)
  await page.evaluate(() => window.__story.seek(3, 0.5))
  await sleep(1500)
  const s1 = await audioOf(page)
  check(!s1.playing && s1.clip === null, 'seek: the voice stops and nothing speaks while held', s1.clip)
  await page.evaluate(() => window.__story.play())
  check(await until(page, (b) => { const a = window.__story.audio(); return a.playing && a.clip.beat === b }, ids[3], 9000), 'play after a seek: that beat speaks')
  // explore
  await playingPast(ids[3], 1)
  await page.evaluate(() => window.__story.explore(true))
  await sleep(400)
  const e1 = await audioOf(page)
  check(!e1.playing && e1.clip === null, 'explore: the narration stops', e1.clip)
  await sleep(1200)
  check(!(await audioOf(page)).playing, 'explore: nothing speaks')
  await page.evaluate(() => window.__story.explore(false))
  await page.evaluate(() => window.__story.play())
  check(await until(page, () => window.__story.audio().playing, null, 9000), 'back from explore, play: the beat speaks again')
  // hidden tab
  await until(page, () => window.__story.audio().playing && window.__story.audio().position > 1, null, 9000)
  await page.evaluate(() => window.__setHidden(true))
  await sleep(500)
  const h1 = await audioOf(page)
  check(!h1.playing && h1.position !== null, 'hidden tab: the voice pauses', h1)
  check(['suspended', 'interrupted'].includes(h1.contextState), 'hidden tab: the context suspends', h1.contextState)
  await sleep(800)
  await page.evaluate(() => window.__setHidden(false))
  check(await until(page, () => window.__story.audio().playing, null, 6000), 'shown again: the voice resumes')
  const h2 = await audioOf(page)
  check(Math.abs(h2.startedFrom - h1.position) < 0.08, `shown again: from where it paused (${h1.position?.toFixed(2)} s)`, { startedFrom: h2.startedFrom })
  // reading (the phone's Read more opens the expanded detent): the story and the voice hold
  await until(page, () => window.__story.audio().playing && window.__story.audio().position > 0.8, null, 9000)
  await page.tap('.st-more-link')
  await sleep(500)
  const r1 = await audioOf(page)
  check(!r1.playing, 'Read more open: the voice holds', r1)
  await sleep(700)
  await page.tap('.st-more-link')
  check(await until(page, () => window.__story.audio().playing, null, 6000), 'Read more closed: the voice continues')
  const r2 = await audioOf(page)
  check(Math.abs(r2.startedFrom - r1.position) < 0.08, 'Read more closed: from where it held', { held: r1.position, startedFrom: r2.startedFrom })
  // module change: the old voice stops, the next module speaks
  await until(page, () => window.__story.audio().playing, null, 9000)
  await page.tap('.mf-chipbtn')
  await sleep(400)
  await page.tap('a.mf-srow[href$="/metfix-lab/bayes"]')
  const c1 = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__story.audio())))))
  check(!c1.playing || c1.clip.view === 'lab-metfix-bayes', 'module change: the old voice stops at once', c1.clip)
  check(await until(page, () => { const a = window.__story.audio(); return a.playing && a.clip.view === 'lab-metfix-bayes' && a.clip.beat === 'questions' }, null, 30000), 'module change: Module 2 beat 0 speaks (after its bridge)')
  check((await page.evaluate(() => window.__acN)) === 1, 'one context for the whole visit')
  await ctx.close()
})

/* ------------------------------ render ------------------------------ */
const meter = (f) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' })
  const log = (r.stderr || '') + (r.stdout || '')
  const sm = log.slice(log.lastIndexOf('Summary:'))
  const num = (re) => Number((sm.match(re) || [])[1])
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), LRA: num(/LRA:\s+(-?[\d.]+) LU/), TP: num(/Peak:\s+(-?[\d.]+) dBFS/) }
}
await test('render', async () => {
  for (const st of STORIES) {
    const slug = st.name
    const { ctx, page } = await open(auto, urlOf(st, 'sound=1&tier=low'))
    const n = await page.evaluate(() => window.__story.beats.length)
    await page.evaluate(() => window.__story.pause())
    const files = {}
    for (const [name, opts] of [['mix', undefined], ['voice', { stems: ['voice'] }], ['bed', { stems: ['bed'], duck: false }]]) {
      const b64 = await page.evaluate(([k, o]) => window.__story.renderAudio(0, k - 1, o), [n, opts])
      const f = `${out}/${fileOf(st)}-${name}.wav`
      writeFileSync(f, Buffer.from(b64, 'base64'))
      files[name] = { file: f, ...meter(f) }
    }
    const plan = await page.evaluate((k) => window.__story.audioTimeline(0, k - 1), n)
    writeFileSync(`${out}/${fileOf(st)}-timeline.json`, JSON.stringify(plan, null, 1))
    const total = plan[plan.length - 1].start + plan[plan.length - 1].total
    report[`render-${slug}`] = { files, total }
    console.log(`${slug}: ${total.toFixed(1)} s planned; mix ${JSON.stringify(files.mix)}; voice ${JSON.stringify(files.voice)}; bed ${JSON.stringify(files.bed)}`)
    check(Math.abs(files.mix.I + 16) <= 1.0, `${slug} mix: ${files.mix.I} LUFS (target -16 +/- 1)`)
    check(files.mix.TP <= -1.0, `${slug} mix: true peak ${files.mix.TP} dBTP (<= -1)`)
    check(Math.abs(files.voice.I + 16) <= 1.0, `${slug} voice stem: ${files.voice.I} LUFS (target -16 +/- 1)`)
    check(files.bed.I <= -36, `${slug} bed alone: ${files.bed.I} LUFS (H.76: no tone, the room 6 dB down: at or below -36)`)
    await ctx.close()
  }
})

/* ------------------------------ shots ------------------------------ */
await test('shots', async () => {
  for (const vp of [{ width: 390, height: 664 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const tag = `${vp.width}x${vp.height}`
    const { ctx, page } = await open(plain, '/metfix-lab/two-sciences?intro=0', { vp, init: [COUNT_AC] })
    await until(page, () => !!document.querySelector('.st-soundchip'), null, 6000)
    await sleep(2200)
    await page.screenshot({ path: `${out}/sound-${tag}-1-first-visit.png` })
    const box = await page.evaluate(() => {
      const r = (s) => {
        const e = document.querySelector(s)
        if (!e) return null
        const b = e.getBoundingClientRect()
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
      }
      return { chip: r('.st-soundchip'), toggle: r('.mf-topbar .st-sound'), card: r('.st-card') }
    })
    check(!!box.chip && !!box.toggle, `${tag}: chip and toggle on screen`, box)
    if (vp.width < 800) await page.tap('.st-soundchip')
    else await page.click('.st-soundchip')
    await sleep(350)
    await page.screenshot({ path: `${out}/sound-${tag}-2-chip-tapped.png` })
    await until(page, () => document.querySelector('.mf-topbar .st-sound')?.getAttribute('data-state') === 'on' && !document.querySelector('.st-soundchip'), null, 4000)
    await sleep(300)
    await page.screenshot({ path: `${out}/sound-${tag}-3-on.png` })
    await page.screenshot({ path: `${out}/sound-${tag}-4-topbar.png`, clip: { x: 0, y: 0, width: vp.width, height: 64 } })
    report[`shots-${tag}`] = box
    await ctx.close()
  }
})

await plain.close()
await auto.close()
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1))
console.log(fails ? `${fails} FAIL(s)` : 'all sound checks passed')
process.exit(fails ? 1 : 0)
