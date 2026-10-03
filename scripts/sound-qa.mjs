// Sound QA for the /fitness lesson (DESIGN.md I.8), run against a served build.
//
// DORMANT (amendments H.72, H.74): this suite drives /fitness/definition (Capacity), and since H.72 no /fitness
// chapter declares narration, so Capacity has no sound at all and every test here would fail without that
// meaning a regression. It exits at once with a notice; SOUND_QA_FORCE=1 runs it anyway (for the day a
// /fitness chapter speaks again). The suite of the narrated MetFix modules is scripts/metfix-sound-qa.mjs.
// Needs Playwright (resolved from this repo, or from the package.json named by PLAYWRIGHT_FROM).
//
//   node scripts/sound-qa.mjs <baseUrl> [test ...]
//       With no test names, runs them all; exits 1 on any failure.
//       Tests without the autoplay flag prove the gesture rule with real CDP taps; the others use
//       --autoplay-policy=no-user-gesture-required.
//
//   gesture    first visit: no AudioContext, nothing fetched under /narration/, the chip; a real tap
//              on the chip; '1' stored: the first tap anywhere, the toggle, the chip, M; turning off
//   timing     ?sound=1: every beat lasts its planned total (0.15 s, story time plus the audio clock);
//              ?sound=0: today's timing in story time
//   deeplink   ?beat=3&t=0.9 lands in the same state with ?sound=0 and ?sound=1 and plays no clip while
//              held; the stage pixels match between two loads that share a chart frame
//   behaviour  pause 3 s / resume, stalls, next, prev, seek, explore, hidden page (I.4)
//   missing    a clip served as index.html runs silent at once with one warning
//   chapter    the old voice stops at a chapter change; the room continues; LEAD_FIRST on return
//   reduced    ?motion=reduce: nothing at load; a step narrates once; Show build narrates
//   toggle     sound on mid-beat (ui.on, then the clip) and off mid-beat (no jump)
//   duck       (fix round 1) the bed stem with ducking against the bed stem without: -6 dB (+/-0.5)
//              across every manifest speech span of every clip of each view in SOUND_QA_VIEWS
//   idle       (fix round 1, real taps) the director's own idle suspend is NOT Waiting: after a 14 s
//              pause the toggle shows On and the chip stays away; Play resumes the clip where it
//              paused (70 ms); one toggle tap then turns sound OFF with no ui.on
//   done       (fix round 1, real taps) 18 s after the last beat is done: the toggle shows On; M turns
//              sound off
//   interrupt  (fix round 1, real taps) an interruption pauses the story (Waiting); the next tap
//              resumes the story AND the clip where it stopped
//   leave      (fix round 1) leaving the lesson releases every decoded narration buffer
//   hidden2    (fix round 2) on, off, hide, show, on, hide: the context suspends and the master is silent
//   session    (fix round 2, real taps) off and on again 120 ms apart: the session stays 'playback'
//   idleshow   (fix round 2, real taps) back to the tab while idle: still asleep, session 'auto'; Play wakes it
//   keys       (fix round 2, real keys) returning '1' on desktop: ArrowRight, Space or E unlocks audio
//   bridge     (fix round 2, live) the bed stays ducked across D0 -> D1 and comes back up in D3 -> D4
//   pour       (fix round 2) the D3 pour is not a riser: centroid < 1 octave, loudness rise < 3 LU after
//              the attack, the last second before the claim flat or falling
//
// Each test runs inside its own try / catch: a crash is one FAIL and the suite continues (fix round 2).
// Timing is measured in story time plus the audio clock, never in wall time (fix round 2).
//
// Env: SOUND_QA_VIEWS=definition,skills (the duck check; default definition), SOUND_QA_OUT=<dir>
// (optional: the deep-link screenshots are written there).
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

if (process.env.SOUND_QA_FORCE !== '1') {
  console.log('sound-qa: DORMANT. No /fitness chapter declares narration (H.72), so /fitness/definition has no sound to test;')
  console.log('nothing was run. The narrated MetFix modules: node scripts/metfix-sound-qa.mjs <baseUrl> <outDir>. SOUND_QA_FORCE=1 runs this suite anyway.')
  process.exit(0)
}

const tryRequire = (from) => {
  try {
    return createRequire(from)('playwright')
  } catch {
    return null
  }
}
const pw =
  (process.env.PLAYWRIGHT_FROM && tryRequire(process.env.PLAYWRIGHT_FROM)) ||
  tryRequire(join(process.cwd(), 'package.json')) ||
  tryRequire('C:/Users/ravik/OneDrive/Desktop/Claude/Projects/CrossFit/app/package.json')
if (!pw) {
  console.error('playwright not found: set PLAYWRIGHT_FROM to a package.json whose node_modules has playwright')
  process.exit(2)
}
const { chromium } = pw
const B = (process.argv[2] || 'http://127.0.0.1:5381').replace(/\/$/, '')
const only = process.argv.slice(3)
const want = (n) => !only.length || only.includes(n)
const VIEWS = (process.env.SOUND_QA_VIEWS || 'definition').split(',').filter(Boolean)
const OUT = process.env.SOUND_QA_OUT || ''
if (OUT) mkdirSync(OUT, { recursive: true })
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const AUTOPLAY = '--autoplay-policy=no-user-gesture-required'
let fails = 0
const ok = (m) => console.log('ok   ' + m)
const fail = (m) => {
  fails++
  console.log('FAIL ' + m)
}
const check = (c, m, detail) => (c ? ok(m) : fail(m + (detail !== undefined ? ' ' + JSON.stringify(detail) : '')))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ANALYTICS = /googletagmanager|google-analytics|analytics\.google|doubleclick|facebook|clarity\.ms|bing\.com/

const COUNT_AC = () => {
  window.__acCount = 0
  window.__acList = []
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const C = window[k]
    if (!C) continue
    const W = function (...a) {
      window.__acCount++
      const c = new C(...a)
      window.__acList.push(c)
      return c
    }
    W.prototype = C.prototype
    window[k] = W
  }
}

/** contexts a test opened; the test wrapper closes any a crashed test left open */
const liveCtx = new Set()
async function open(browser, path, o = {}) {
  const vp = o.vp || { width: 390, height: 844 }
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 800, hasTouch: vp.width < 800 })
  liveCtx.add(ctx)
  ctx.on('close', () => liveCtx.delete(ctx))
  await ctx.route(ANALYTICS, (r) => r.abort())
  if (o.init) for (const f of o.init) await ctx.addInitScript(f)
  if (o.store) await ctx.addInitScript((v) => { try { localStorage.setItem('fitness-sound', v) } catch {} }, o.store)
  if (o.route) await o.route(ctx)
  const page = await ctx.newPage()
  const log = { console: [], narr: [], errors: [] }
  page.on('console', (m) => log.console.push(m.type() + ' ' + m.text()))
  page.on('pageerror', (e) => log.errors.push(e.message))
  page.on('request', (r) => { if (r.url().includes('/narration/')) log.narr.push(r.url()) })
  await page.goto(B + path, { waitUntil: 'load', timeout: 90000 })
  await page.waitForFunction(() => window.__story && window.__story.state().loaded, null, { timeout: 90000 })
  return { ctx, page, log }
}
const A = (page) => page.evaluate(() => ({ ...window.__story.audio(), st: window.__story.state() }))
async function until(page, fn, arg, ms = 5000, step = 20) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return Date.now() - t0
    await sleep(step)
  }
  return -1
}
/** the top-bar toggle and the chip, as the viewer sees them */
const UI = (page) =>
  page.evaluate(() => {
    const t = document.querySelector('.st-sound')
    const b = document.querySelector('.st-sound-btn')
    let pref = null
    try {
      pref = localStorage.getItem('fitness-sound')
    } catch {}
    const a = window.__story ? window.__story.audio() : null
    return {
      toggle: t ? t.getAttribute('data-state') : null,
      pressed: b ? b.getAttribute('aria-pressed') : null,
      title: b ? b.getAttribute('title') : null,
      dot: !!document.querySelector('.st-sound-dot'),
      chip: !!document.querySelector('.st-soundchip'),
      pref,
      cs: a ? a.contextState : null,
      idle: a ? a.idle : null,
      enabled: a ? a.enabled : null,
      playing: a ? a.playing : null,
      position: a ? a.position : null,
      story: window.__story ? window.__story.state().playing : null,
    }
  })

/** 16-bit PCM WAV (base64) -> the left channel as floats */
function wavLeft(b64) {
  const buf = Buffer.from(b64, 'base64')
  const ch = buf.readUInt16LE(22)
  const sr = buf.readUInt32LE(24)
  let o = 12
  while (o < buf.length - 8 && buf.toString('ascii', o, o + 4) !== 'data') o += 8 + buf.readUInt32LE(o + 4)
  const start = o + 8
  const n = Math.floor((buf.length - start) / (2 * ch))
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(start + i * 2 * ch) / 32768
  return { x, sr }
}
const rmsDb = (x, a, b) => {
  let s = 0
  for (let i = a; i < b; i++) s += x[i] * x[i]
  const r = Math.sqrt(s / Math.max(1, b - a))
  return r > 1e-9 ? 20 * Math.log10(r) : -180
}

const plain = await chromium.launch({ args: GL })
const auto = await chromium.launch({ args: [...GL, AUTOPLAY] })

/** One test: a throw is one FAIL (with its message) and the suite goes on to the next test. */
async function test(name, fn) {
  if (!want(name)) return
  try {
    await fn()
  } catch (e) {
    fail(`${name}: crashed: ${String(e && e.message ? e.message : e).split(String.fromCharCode(10))[0]}`)
  } finally {
    for (const c of [...liveCtx]) await c.close().catch(() => undefined)
  }
}

/* ------------------------------ the gesture rule ------------------------------ */
await test('gesture', async () => {
  // first visit, no ?sound: a full autoplay creates no AudioContext and fetches nothing under /narration/
  const { ctx, page, log } = await open(plain, '/fitness/definition', { init: [COUNT_AC] })
  await page.waitForSelector('.st-soundchip', { timeout: 6000 }).catch(() => null)
  const early = await page.evaluate(() => !!document.querySelector('.st-soundchip'))
  check(early, 'gesture: the Sound on chip shows on the first visit (1.2 s after loaded)')
  await page.waitForFunction(() => window.__story.state().phase === 'done', null, { timeout: 150000 })
  const r = await page.evaluate(() => ({ n: window.__acCount, cs: window.__story.audio().contextState, chip: !!document.querySelector('.st-soundchip'), pref: localStorage.getItem('fitness-sound') }))
  check(r.n === 0 && r.cs === 'none' && log.narr.length === 0, 'gesture: a full autoplay with no stored choice creates no AudioContext and requests nothing under /narration/', { ...r, narr: log.narr.length })
  check(!r.chip && r.pref === null, 'gesture: the chip retired after 3 beats without a tap, and nothing was stored', r)
  await page.reload({ waitUntil: 'load' })
  await page.waitForFunction(() => window.__story && window.__story.state().loaded)
  await page.waitForSelector('.st-soundchip', { timeout: 6000 }).catch(() => null)
  check(await page.evaluate(() => !!document.querySelector('.st-soundchip')), 'gesture: the chip returns next session while the choice is undecided')
  // a real CDP tap on the chip
  await page.tap('.st-soundchip')
  const tRun = await until(page, () => window.__story.audio().contextState === 'running', null, 2000, 10)
  const tPlay = await until(page, () => window.__story.audio().playing, null, 3000, 20)
  const s = await page.evaluate(() => ({ pref: localStorage.getItem('fitness-sound'), a: window.__story.audio() }))
  check(tRun >= 0 && tRun <= 300, `gesture: a real tap on the chip -> contextState running in ${tRun} ms (<= 300)`)
  check(tPlay >= 0 && tPlay <= 700, `gesture: the clip plays ${tPlay} ms after the tap (<= 700)`)
  check(s.pref === '1', "gesture: localStorage['fitness-sound'] === '1'", s.pref)
  check(s.a.session === null || s.a.session === 'playback', `gesture: audio session ${s.a.session} (null where unsupported)`)
  await ctx.close()
  // reload with '1' stored: the chip shows, nothing until a gesture; the first tap anywhere starts sound from the clip's start
  {
    const { ctx, page, log } = await open(plain, '/fitness/definition', { init: [COUNT_AC], store: '1' })
    await page.waitForSelector('.st-soundchip', { timeout: 5000 }).catch(() => null)
    await sleep(1500)
    const r0 = await page.evaluate(() => ({ n: window.__acCount, cs: window.__story.audio().contextState, chip: !!document.querySelector('.st-soundchip'), wait: document.querySelector('.st-sound')?.getAttribute('data-state') }))
    check(r0.cs === 'none' && r0.n === 0 && r0.chip && r0.wait === 'waiting' && log.narr.length === 0, "gesture: '1' stored -> the chip shows, the toggle waits, no context until a gesture", r0)
    await page.tap('.st-body')
    const t = await until(page, () => window.__story.audio().playing, null, 4000, 20)
    const r1 = await A(page)
    check(t >= 0 && t <= 1000 && r1.contextState === 'running', `gesture: the first tap anywhere starts sound (voice after ${t} ms, <= 1000)`, r1.contextState)
    check(r1.position !== null && r1.position < 1.2, `gesture: the current beat's clip plays from its start (position ${r1.position?.toFixed(2)})`)
    await ctx.close()
  }
  // '1' stored, the FIRST tap is on the toggle (Waiting): sound starts, '1' stays stored
  for (const how of ['toggle', 'chip', 'key']) {
    const vp = how === 'key' ? { width: 1440, height: 900 } : undefined
    const { ctx, page } = await open(plain, '/fitness/definition', { store: '1', vp })
    await sleep(1500)
    if (how === 'toggle') await page.tap('.st-sound-btn')
    else if (how === 'chip') await page.tap('.st-soundchip')
    else {
      await page.mouse.move(700, 300)
      await page.keyboard.press('m')
    }
    const t = await until(page, () => window.__story.audio().contextState === 'running', null, 3000)
    const tv = await until(page, () => window.__story.audio().playing, null, 1500)
    const r = await page.evaluate(() => ({ pref: localStorage.getItem('fitness-sound'), en: window.__story.audio().enabled, st: document.querySelector('.st-sound')?.getAttribute('data-state') }))
    check(t >= 0 && tv >= 0 && r.pref === '1' && r.en && r.st === 'on', `gesture: '1' stored, first ${how} -> sound starts (voice ${tv} ms after) and '1' stays stored`, r)
    await ctx.close()
  }
  // the toggle turns sound off: suspended within 400 ms, '0' stored, the chip never shows again, reload keeps it off
  {
    const { ctx, page } = await open(plain, '/fitness/definition')
    await sleep(1500)
    await page.tap('.st-soundchip')
    await until(page, () => window.__story.audio().contextState === 'running', null, 3000)
    await sleep(1500)
    await page.tap('.st-sound-btn')
    const t = await until(page, () => window.__story.audio().contextState === 'suspended', null, 2000, 10)
    const r = await page.evaluate(() => ({ pref: localStorage.getItem('fitness-sound'), chip: !!document.querySelector('.st-soundchip'), st: document.querySelector('.st-sound')?.getAttribute('data-state'), pressed: document.querySelector('.st-sound-btn')?.getAttribute('aria-pressed') }))
    check(t >= 0 && t <= 400 && r.pref === '0' && !r.chip && r.st === 'off' && r.pressed === 'false', `gesture: the toggle turns sound off (suspended in ${t} ms, '0' stored, no chip, aria-pressed false)`, r)
    await page.reload({ waitUntil: 'load' })
    await page.waitForFunction(() => window.__story && window.__story.state().loaded)
    await sleep(2000)
    const r2 = await page.evaluate(() => ({ cs: window.__story.audio().contextState, chip: !!document.querySelector('.st-soundchip'), en: window.__story.audio().enabled }))
    check(r2.cs === 'none' && !r2.chip && !r2.en, "gesture: reload with '0' keeps sound off and no chip", r2)
    await ctx.close()
  }
})

/* ------------------------------ timing ------------------------------ */
// Beats are timed in STORY time (the engine's own clock: the sum of min(dt, 0.1) per frame, which a slow
// machine slows down) plus the AUDIO clock while the clip sounds, never in wall time: under load a wall
// clock fails even with ?sound=0, where no audio code runs (review 2, fix round 2).
const RECORD = () => {
  window.__rec = []
  let last = performance.now()
  let st = 0
  let prev = null
  const loop = () => {
    const now = performance.now()
    st += Math.min((now - last) / 1000, 0.1)
    last = now
    const s = window.__story
    if (s && s.state) {
      const x = s.state()
      if (x.loaded) {
        const a = s.audio()
        const ac = window.__acList && window.__acList[0]
        const key = `${x.index}|${a.playing}|${x.phase === 'done'}`
        if (key !== prev) {
          window.__rec.push({ st, ct: ac ? ac.currentTime : 0, i: x.index, vp: a.playing, done: x.phase === 'done' })
          prev = key
        }
      }
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
async function runChapter(page) {
  await page.waitForFunction(() => window.__rec && window.__rec.some((r) => r.done), null, { timeout: 180000 })
  return page.evaluate(() => window.__rec)
}
/** per beat: the lead and the breath in story time, the clip on the audio clock */
function beatLengths(rec, n) {
  const out = []
  for (let k = 0; k < n; k++) {
    const start = rec.find((r) => r.i === k)
    const iOn = rec.findIndex((r) => r.i === k && r.vp)
    const on = iOn >= 0 ? rec[iOn] : null
    const off = on ? rec.slice(iOn + 1).find((r) => !r.vp || r.i !== k) : null
    const next = k < n - 1 ? rec.find((r) => r.i === k + 1) : rec.find((r) => r.done)
    if (!start || !next) {
      out.push({ k, len: null })
      continue
    }
    if (on && off) out.push({ k, len: on.st - start.st + (off.ct - on.ct) + (next.st - off.st), lead: on.st - start.st, clip: off.ct - on.ct, breath: next.st - off.st })
    else out.push({ k, len: next.st - start.st })
  }
  return out
}
await test('timing', async () => {
  const { ctx, page, log } = await open(auto, '/fitness/definition?sound=1&tier=low', { init: [COUNT_AC, RECORD] })
  const n = await page.evaluate(() => window.__story.beats.length)
  const tl = await page.evaluate((n) => window.__story.audioTimeline(0, n - 1), n)
  const rec = await runChapter(page)
  const lens = beatLengths(rec, n)
  let worst = 0
  const rows = []
  for (const b of lens) {
    const d = b.len === null ? 99 : Math.abs(b.len - tl[b.k].total)
    worst = Math.max(worst, d)
    rows.push(`${b.k}:${b.len === null ? 'none' : b.len.toFixed(2)}/${tl[b.k].total.toFixed(2)}`)
  }
  check(worst <= 0.15, `timing: sound on, every beat lasts its planned total within 0.15 s, story time plus the audio clock (worst ${worst.toFixed(3)} s) ${rows.join(' ')}`)
  const clips = lens.filter((b) => b.clip !== undefined)
  const clipBad = clips.filter((b) => Math.abs(b.clip - (tl[b.k].clip[1] - tl[b.k].clip[0])) > 0.1)
  check(clips.length === n && !clipBad.length, `timing: every clip sounds for its manifest duration on the audio clock (+/-0.1 s; ${clips.length} of ${n} clips)`, clipBad.map((b) => [b.k, b.clip.toFixed(3)]))
  const early = clips.filter((b) => b.breath < 0.6)
  check(!early.length, `timing: no beat advances before its clip ends plus a breath (story time >= 0.6 s; shortest ${Math.min(...clips.map((b) => b.breath)).toFixed(2)} s)`, early.map((b) => [b.k, b.breath.toFixed(3)]))
  const errs = log.console.filter((c) => /decode|error/i.test(c) && /audio|narration/i.test(c))
  check(!errs.length, 'timing: no audio errors in the console', errs)
  await ctx.close()
  // sound off: exactly today's timing
  const o2 = await open(auto, '/fitness/definition?sound=0&tier=low', { init: [RECORD] })
  const rec2 = await runChapter(o2.page)
  const expect = await o2.page.evaluate(() => {
    const out = []
    for (let i = 0; i < window.__story.beats.length; i++) {
      window.__story.seek(i, 0)
      out.push(window.__story.audio().beatHold.total)
    }
    return out
  })
  const lens2 = beatLengths(rec2, expect.length)
  const rows2 = []
  let worst2 = 0
  for (const b of lens2) {
    const d = b.len === null ? 99 : Math.abs(b.len - expect[b.k])
    worst2 = Math.max(worst2, d)
    rows2.push(`${b.k}:${b.len === null ? 'none' : b.len.toFixed(2)}/${expect[b.k].toFixed(2)}`)
  }
  check(worst2 <= 0.12, `timing: ?sound=0, every beat lasts today's delay + build + hold in story time (worst ${worst2.toFixed(3)} s) ${rows2.join(' ')}`)
  await o2.ctx.close()
})

/* ------------------------ deep links: same state, same pixels, no voice while held ------------------------ */
// The pixel diff compares two loads only when their chart frames match (the def-fan probe): the frame can
// differ between page loads WITH ?sound=0 on both (review 2: x0 -3.5288 or -3.5366), which predates sound.
await test('deeplink', async () => {
  const snap = async (q) => {
    const { ctx, page } = await open(auto, `/fitness/definition?beat=3&t=0.9&tier=medium&sound=${q}`)
    await page.waitForFunction(() => window.__story.ready)
    await sleep(1600)
    await page.evaluate(() => document.querySelector('.st-soundchip')?.remove())
    const a = await A(page)
    const probes = await page.evaluate(() => {
      const s = window.__story
      const o = {}
      for (const p of s.probes()) o[p] = s.probe(p)
      return JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v))
    })
    const png = await page.locator('.st-stage').screenshot(OUT ? { path: `${OUT}/deeplink-sound${q}.png` } : {})
    await ctx.close()
    const s = a.st
    return { a, probes, png, state: JSON.stringify({ index: s.index, t: Math.round(s.t * 1e4) / 1e4, held: s.held, phase: s.phase, playing: s.playing, mode: s.mode }) }
  }
  const L = { 0: [await snap('0')], 1: [await snap('1')] }
  check(L[0][0].state === L[1][0].state, 'deeplink: ?beat=3&t=0.9 lands in the same story state with ?sound=0 and ?sound=1', { off: L[0][0].state, on: L[1][0].state })
  const on = L[1][0].a
  check(!on.playing && on.clip === null && on.st.held, 'deeplink: ?beat=3&t=0.9 with sound on holds and plays no clip', { playing: on.playing, clip: on.clip, held: on.st.held })
  let pair = null
  for (let k = 0; k < 3 && !pair; k++) {
    for (const x of L[0]) for (const y of L[1]) if (!pair && x.probes === y.probes) pair = [x, y]
    if (!pair) {
      L[0].push(await snap('0'))
      L[1].push(await snap('1'))
    }
  }
  if (!pair) {
    console.log(`note deeplink: no two loads shared a chart frame (probes ${JSON.stringify([...new Set([...L[0], ...L[1]].map((x) => x.probes))])}); the frame varies between loads with ?sound=0 alone, so pixels are not compared`)
  } else {
    const cmp = await plain.newPage()
    const d = await cmp.evaluate(
      async ([a, b]) => {
        const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + src })
        const [A, B] = await Promise.all([load(a), load(b)])
        const c = document.createElement('canvas')
        c.width = A.width
        c.height = A.height
        const g = c.getContext('2d', { willReadFrequently: true })
        g.drawImage(A, 0, 0)
        const da = g.getImageData(0, 0, c.width, c.height).data
        g.clearRect(0, 0, c.width, c.height)
        g.drawImage(B, 0, 0)
        const db = g.getImageData(0, 0, c.width, c.height).data
        let diff = 0
        for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) diff++
        return diff / (c.width * c.height)
      },
      [pair[0].png.toString('base64'), pair[1].png.toString('base64')],
    )
    await cmp.close()
    check(d < 0.005, `deeplink: with the same chart frame, ?sound=0 and ?sound=1 render the same stage pixels (${(d * 100).toFixed(3)}% differ)`)
  }
})

/* ------------------------------ behaviour ------------------------------ */
await test('behaviour', async () => {
  const { ctx, page, log } = await open(auto, '/fitness/definition?sound=1')
  await until(page, () => window.__story.audio().playing && window.__story.audio().position > 1.5, null, 15000)
  const pr = await page.evaluate(async () => {
    const s = window.__story
    s.pause()
    const p0 = s.audio().position
    await new Promise((r) => setTimeout(r, 1200))
    const bedPaused = s.audio().levels?.bed
    await new Promise((r) => setTimeout(r, 1800))
    s.play()
    let from = s.audio().startedFrom
    for (let i = 0; i < 60 && from === null; i++) {
      await new Promise((r) => requestAnimationFrame(r))
      from = s.audio().startedFrom
    }
    return { p0, from, bedPaused }
  })
  const rep0 = pr.p0 - pr.from
  check(pr.from !== null && rep0 >= -0.001 && rep0 <= 0.07, `pause 3 s / resume: resumed from ${pr.from} (paused at ${pr.p0?.toFixed(3)}; ${Math.round(rep0 * 1000)} ms repeated, <= 70)`)
  check(pr.bedPaused !== undefined && pr.bedPaused < -55, `pause: the bed fades out while paused (${pr.bedPaused} dBFS after 1.2 s)`)
  const st = await page.evaluate(async () => {
    const s = window.__story
    for (let k = 0; k < 3; k++) {
      const t = performance.now()
      while (performance.now() - t < 300) {}
      await new Promise((r) => setTimeout(r, 150))
    }
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    const a = s.audio()
    const acc = a.beatHold.elapsed - (a.beatHold.narr - a.clip.dur - 0.65)
    s.pause()
    const p0 = s.audio().position
    await new Promise((r) => setTimeout(r, 400))
    s.play()
    let from = s.audio().startedFrom
    for (let i = 0; i < 60 && from === null; i++) {
      await new Promise((r) => requestAnimationFrame(r))
      from = s.audio().startedFrom
    }
    return { pos: a.position, acc, p0, from }
  })
  check(Math.abs(st.acc - st.pos) <= 0.05 && st.p0 - st.from >= -0.001 && st.p0 - st.from <= 0.07, `stalls: after three 300 ms stalls the voice accounting follows the audio clock (elapsed - lead ${st.acc.toFixed(3)} vs position ${st.pos.toFixed(3)}); resumed from ${st.from} (paused at ${st.p0.toFixed(3)})`)
  await page.evaluate(() => window.__story.seek(1, 0.2))
  await page.evaluate(() => window.__story.play())
  await until(page, () => window.__story.audio().playing, null, 4000)
  const iBefore = (await A(page)).st.index
  const nx = await page.evaluate(async (iBefore) => {
    const s = window.__story
    const t0 = performance.now()
    s.next()
    let tStop = -1
    let tBeat = -1
    let tClip = -1
    while (performance.now() - t0 < 4000) {
      const st = s.state()
      const a = s.audio()
      if (tStop < 0 && !a.playing) tStop = performance.now() - t0
      if (tBeat < 0 && st.index === iBefore + 1 && st.phase === 'build') tBeat = performance.now()
      if (tBeat > 0 && a.playing && a.clip && a.clip.beat === s.beats[iBefore + 1].id) {
        tClip = performance.now() - a.position * 1000
        break
      }
      await new Promise((r) => requestAnimationFrame(r))
    }
    const fps = await (async () => { let n = 0; const t = performance.now(); while (performance.now() - t < 500) { await new Promise((r) => requestAnimationFrame(r)); n++ } return n * 2 })()
    return { tStop, lead: (tClip - tBeat) / 1000, fps }
  }, iBefore)
  const frameMs = 1000 / Math.max(1, nx.fps)
  check(nx.tStop >= 0 && nx.tStop <= Math.max(150, 2 * frameMs), `next: the voice stops ${Math.round(nx.tStop)} ms after Next (<= 150, or two frames at this machine's ${nx.fps} fps)`)
  check(nx.lead > 0.1 && nx.lead < 0.5, `next: the next beat's clip starts ${nx.lead.toFixed(2)} s after that beat starts (pre-roll 0.15 + lead 0.2, one frame of detection)`)
  const landed = []
  for (const op of ['prev', 'prev', 'next']) {
    await page.evaluate((op) => window.__story[op](), op)
    await sleep(700)
    const t = await until(page, () => window.__story.audio().playing, null, 1500)
    const a = await A(page)
    landed.push(`${op}->${a.st.index}:${t >= 0 ? 'voice' : 'SILENT'}`)
  }
  check(landed.every((x) => x.endsWith('voice')), `prev, prev, next: every landed beat narrates (${landed.join(' ')})`)
  await page.evaluate(() => window.__story.seek(2, 0.3))
  const sc = await A(page)
  check(!sc.playing && sc.clip === null, 'seek: the voice is cut and nothing plays while held')
  await page.evaluate(() => window.__story.play())
  await until(page, () => window.__story.audio().playing && window.__story.audio().position > 0.6, null, 5000)
  const ex = await page.evaluate(async () => {
    const s = window.__story
    const t0 = performance.now()
    s.explore(true)
    let te = -1
    while (performance.now() - t0 < 1000) {
      if (!s.audio().playing) { te = performance.now() - t0; break }
      await new Promise((r) => requestAnimationFrame(r))
    }
    await new Promise((r) => setTimeout(r, 2000))
    return { te }
  })
  check(ex.te >= 0 && ex.te <= 250, `explore: the voice stops ${Math.round(ex.te)} ms after explore opens (<= 250)`)
  await page.evaluate(() => window.__story.explore(false))
  await page.evaluate(() => window.__story.play())
  await until(page, () => window.__story.audio().playing, null, 3000)
  const rp = await page.evaluate(() => window.__story.audio().startedFrom)
  check(rp !== null && rp < 0.05, `explore off + play: the cut clip replays from its start (started from ${rp})`)
  await until(page, () => window.__story.audio().playing && window.__story.audio().position > 0.8, null, 6000)
  const hd = await page.evaluate(async () => {
    const s = window.__story
    // the position AT the hide: read in a window capture listener, right before the director's own
    // handler in the same dispatch (Chromium's currentTime advances inside a task: reading it earlier
    // made a 3 ms clock advance look like a skipped word; fix round 1)
    let h0 = s.audio().position
    window.addEventListener('visibilitychange', () => (h0 = s.audio().position), { capture: true, once: true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((r) => setTimeout(r, 1200))
    const hid = s.audio()
    await new Promise((r) => setTimeout(r, 3800))
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    let from = null
    for (let i = 0; i < 90 && from === null; i++) {
      await new Promise((r) => requestAnimationFrame(r))
      from = s.audio().startedFrom
    }
    return { h0, cs: hid.contextState, master: hid.levels?.master, from }
  })
  check(hd.cs === 'suspended' && (hd.master === undefined || hd.master <= -90), `hidden: while hidden the context is ${hd.cs} and the master reads ${hd.master} dBFS`)
  check(hd.from !== null && hd.h0 - hd.from >= -0.001 && hd.h0 - hd.from <= 0.07, `hidden: after showing, the clip continues from ${hd.from} (hidden at ${hd.h0?.toFixed(3)}; no word lost)`)
  const errs = [...log.errors, ...log.console.filter((c) => /decode|NotSupported|InvalidState/i.test(c))]
  check(!errs.length, 'behaviour: no page errors or audio exceptions', errs.slice(0, 3))
  await ctx.close()
})

/* ------------------------------ missing clip ------------------------------ */
await test('missing', async () => {
  const route = async (ctx) =>
    ctx.route(/narration\/definition\/curve-.*\.mp3/, async (r) => {
      const res = await r.fetch({ url: B + '/' })
      await r.fulfill({ status: 200, contentType: 'text/html', body: await res.text() })
    })
  const { ctx, page, log } = await open(auto, '/fitness/definition?sound=1&beat=1&t=0', { route })
  await page.evaluate(() => window.__story.play())
  await sleep(600)
  const a = await A(page)
  const warn = log.console.filter((c) => /curve-.*runs silent/.test(c))
  check(!a.playing && a.clip === null && warn.length === 1, `missing: a clip served as index.html runs silent at once with one warning (${warn.length} warning)`, { clip: a.clip, waiting: a.beatHold.waiting })
  await page.waitForFunction(() => window.__story.state().index === 2, null, { timeout: 20000 })
  const t = await until(page, () => window.__story.audio().playing, null, 2000)
  check(t >= 0, 'missing: the next beat narrates')
  await ctx.close()
})

/* ------------------------------ chapter change ------------------------------ */
async function chapterCheck(attempt) {
  const { ctx, page, log } = await open(auto, '/fitness/definition?sound=1&qa=stub')
  const reqFailed = []
  page.on('requestfailed', (r) => reqFailed.push(r.url().slice(-60) + ' ' + (r.failure()?.errorText || '')))
  const navs = []
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url().replace(B, '')) })
  let loads = 0
  page.on('load', () => loads++)
  try {
    await chapterBody(ctx, page)
  } catch (e) {
    // the app's lazyReload reloads the page when a chunk import fails (a loaded machine): not sound.
    // Say which: the document loads seen, and the reload stamp lazyReload leaves in sessionStorage.
    if (!/Execution context was destroyed/.test(String(e)) || attempt > 1) throw e
    await sleep(1500)
    const stamp = await page.evaluate(() => sessionStorage.getItem('chunkReloadAt')).catch(() => 'unreadable')
    console.log(`note chapter: the page navigated away during the chapter check (attempt ${attempt}) at ${String(e.stack || '').split(String.fromCharCode(10)).find((l) => l.includes('sound-qa'))?.trim()}; document loads ${loads}; lazyReload stamp ${stamp}; frames: ${JSON.stringify(navs)}; requests failed: ${JSON.stringify(reqFailed.slice(0, 4))}; console: ${JSON.stringify(log.console.filter((c) => !/GL Driver/.test(c)).slice(-4))}; retrying once`)
    await ctx.close()
    return chapterCheck(attempt + 1)
  }
}
async function chapterBody(ctx, page) {
  // No page.evaluate may span the chapter change: Playwright rejects an evaluate that is pending across
  // the app's history.pushState with "Execution context was destroyed" although the document stays the
  // same (no load, no CDP context destroyed; the same code through raw CDP Runtime.evaluate returns;
  // fix round 2). So the page records into window.__chap from its own rAF loop, and Node polls it with
  // short evaluates.
  await until(page, () => window.__story.audio().playing, null, 8000)
  await page.evaluate(() => {
    const s = window.__story
    s.seek(s.beats.length - 1, 0.2)
    s.play()
  })
  await until(page, () => window.__story.audio().playing, null, 8000)
  await sleep(400)
  const was = await page.evaluate(() => window.__story.audio().playing)
  await page.evaluate(() => {
    window.__chap = { tStop: -1 }
    const t0 = performance.now()
    window.__story.next()
    const look = () => {
      const s = window.__story
      if (s && !s.audio().playing) window.__chap.tStop = performance.now() - t0
      else if (performance.now() - t0 < 2000) requestAnimationFrame(look)
    }
    look()
  })
  await until(page, () => window.__chap && window.__chap.tStop >= 0, null, 3000)
  const c1 = { was, tStop: await page.evaluate(() => window.__chap.tStop) }
  await page.waitForFunction(() => window.__story && window.__story.chapter !== 'definition' && window.__story.state().loaded, null, { timeout: 30000 })
  await sleep(1500)
  const a = await A(page)
  check(c1.was && c1.tStop >= 0 && c1.tStop <= 200, `chapter: the old voice stops ${Math.round(c1.tStop)} ms after the chapter changes (<= 200)`)
  check(a.levels && a.levels.bed > -80, `chapter: the room never drops out (bed ${a.levels?.bed} dBFS in the next chapter)`)
  await page.evaluate(() => {
    window.__back = { lead: null, chapter: null, index: null }
    const t0 = performance.now()
    let tLoad = -1
    const look = () => {
      const s = window.__story
      if (s && s.chapter === 'definition') {
        const st = s.state()
        const a = s.audio()
        if (tLoad < 0 && st.loaded) tLoad = performance.now()
        if (tLoad > 0 && a.playing && a.startedFrom !== null) {
          window.__back = { lead: a.beatHold.elapsed - (a.position - a.startedFrom), chapter: s.chapter, index: st.index }
          return
        }
      }
      if (performance.now() - t0 < 20000) requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
    history.back()
  })
  await until(page, () => window.__back && window.__back.lead !== null, null, 22000, 50)
  const b2 = await page.evaluate(() => window.__back)
  check(b2.chapter === 'definition' && b2.lead !== null && Math.abs(b2.lead - 0.35) <= 0.1, `chapter: back on Capacity, beat 0's clip starts ${b2.lead === null ? 'never' : b2.lead.toFixed(2)} s of story time after loaded (LEAD_FIRST 0.35)`, b2)
  await ctx.close()
}
await test('chapter', () => chapterCheck(1))

/* ------------------------------ reduced motion ------------------------------ */
await test('reduced', async () => {
  const { ctx, page } = await open(auto, '/fitness/definition?sound=1&motion=reduce')
  await sleep(1500)
  const a0 = await A(page)
  check(!a0.playing && a0.clip === null, 'reduced: nothing narrates at load')
  await page.evaluate(() => window.__story.next())
  const t = await until(page, () => window.__story.audio().playing, null, 2000)
  const a1 = await A(page)
  check(t >= 0 && a1.st.index === 1, `reduced: a step narrates the landed beat (${a1.clip?.beat})`)
  await page.waitForFunction(() => !window.__story.audio().playing, null, { timeout: 15000 })
  const a2 = await A(page)
  check(a2.position !== null && a2.position >= a2.clip?.dur - 0.05, `reduced: the clip plays once, to its end (${a2.position?.toFixed(2)} of ${a2.clip?.dur})`)
  await page.evaluate(() => window.__story.seek(2, 1))
  await page.evaluate(() => window.__story.play())
  await sleep(300)
  const sb = await A(page)
  await page.waitForFunction(() => !window.__story.state().playing, null, { timeout: 15000 })
  const sb2 = await A(page)
  check(sb.st.playing && (sb2.playing || sb2.position >= (sb2.clip?.dur ?? 99) - 0.05), `reduced: Show build narrates and the clip continues after the build stops (playing ${sb2.playing}, position ${sb2.position?.toFixed(2)})`)
  await ctx.close()
})

/* ------------------------------ sound on / off mid-beat ------------------------------ */
await test('toggle', async () => {
  const { ctx, page } = await open(auto, '/fitness/definition')
  await page.evaluate(() => window.__story.seek(1, 0.3))
  await page.evaluate(() => window.__story.play())
  await sleep(300)
  // measured inside the page, from the click event to the first frame the voice plays: page.click
  // itself can take 300 ms or more to return on a loaded machine (fix round 1)
  await page.evaluate(() => {
    window.__tClick = -1
    window.__tVoice = -1
    document.addEventListener('click', () => (window.__tClick = performance.now()), { capture: true, once: true })
    const loop = () => {
      if (window.__tClick > 0 && window.__tVoice < 0 && window.__story.audio().playing) window.__tVoice = performance.now()
      if (window.__tVoice < 0) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
  await page.click('.st-sound-btn')
  await until(page, () => window.__tVoice > 0, null, 3000, 5)
  const t = await page.evaluate(() => (window.__tVoice > 0 ? Math.round(window.__tVoice - window.__tClick) : -1))
  const a = await A(page)
  check(t >= 300 && t <= 900 && a.position < 0.6, `toggle: sound on mid-beat -> ui.on, then the clip from its start ${t} ms after the click (LEAD_TOGGLE 0.35 s of story time; 300 to 900 ms)`)
  check(a.beatHold.narr !== null && a.beatHold.total >= a.beatHold.narr, `toggle: the beat now waits for the clip (total ${a.beatHold.total.toFixed(2)} >= narr ${a.beatHold.narr?.toFixed(2)})`)
  await sleep(1500)
  const before = await page.evaluate(() => window.__story.state())
  await page.click('.st-sound-btn')
  await sleep(200)
  const off = await A(page)
  check(!off.playing && Math.abs(off.st.T - before.T) < 0.2, `toggle: sound off mid-beat -> silence within 200 ms and no jump in the story (T ${before.T.toFixed(2)} -> ${off.st.T.toFixed(2)})`)
  await ctx.close()
})

/* ------------------------------ ducking (fix round 1) ------------------------------ */
await test('duck', async () => {
  for (const view of VIEWS) {
    const { ctx, page } = await open(plain, `/fitness/${view}?sound=0&beat=0&t=0`)
    const n = await page.evaluate(() => window.__story.beats.length)
    const tl = await page.evaluate((n) => window.__story.audioTimeline(0, n - 1), n)
    const ducked = wavLeft(await page.evaluate((n) => window.__story.renderAudio(0, n - 1, { stems: ['bed'] }), n))
    const flat = wavLeft(await page.evaluate((n) => window.__story.renderAudio(0, n - 1, { stems: ['bed'], duck: false }), n))
    const sr = ducked.sr
    const W = Math.round(0.05 * sr)
    let spans = 0
    let windows = 0
    let worst = 0
    const bad = []
    for (const b of tl) {
      for (const [a, e] of b.speech) {
        spans++
        // the duck is fully down 0.1 s after a span's first syllable (it starts 0.1 s before, tau 40 ms)
        for (let t = a + 0.1; t + 0.05 <= e; t += 0.05) {
          const i0 = Math.round(t * sr)
          const ref = rmsDb(flat.x, i0, i0 + W)
          if (ref < -75) continue
          const r = rmsDb(ducked.x, i0, i0 + W) - ref
          windows++
          const dev = Math.abs(r + 6)
          if (dev > worst) worst = dev
          if (dev > 0.5 && bad.length < 6) bad.push(`${b.id}@${t.toFixed(2)}s:${r.toFixed(2)}dB`)
        }
      }
    }
    check(spans > 0 && windows > 0 && worst <= 0.5, `duck: ${view}, the bed sits 6 dB down (+/-0.5) inside every speech span (${spans} spans, ${windows} windows of 50 ms, worst deviation ${worst.toFixed(2)} dB)`, bad.length ? bad : undefined)
    // fix round 2: between the first and the last syllable the bed never comes up for less than 0.8 s
    // (a short un-duck pumps: review 2 heard the 1.2 s D4 -> D5 swell as an air sweep)
    const first = tl[0].speech[0][0]
    const lastSp = tl[tl.length - 1].speech[tl[tl.length - 1].speech.length - 1][1]
    const H2 = Math.round(0.01 * sr)
    const wins = []
    let open0 = null
    for (let i = Math.round((first + 0.2) * sr); i + W < Math.round(lastSp * sr); i += H2) {
      const ref = rmsDb(flat.x, i, i + W)
      if (ref < -75) continue
      const up = rmsDb(ducked.x, i, i + W) - ref > -4.5
      if (up && open0 === null) open0 = i / sr
      if (!up && open0 !== null) {
        wins.push([open0, i / sr])
        open0 = null
      }
    }
    const short = wins.filter(([a, z]) => z - a < 0.8)
    check(!short.length, `duck: ${view}, no un-duck window between speech shorter than 0.8 s (${wins.length}: ${wins.map(([a, z]) => (z - a).toFixed(2) + ' s').join(', ')})`, short.length ? short : undefined)
    await ctx.close()
  }
})

/* ------------------------------ the idle suspend (fix round 1) ------------------------------ */
await test('idle', async () => {
  // real taps, no autoplay flag; a returning '1' whose FIRST gesture is the Pause button
  const { ctx, page, log } = await open(plain, '/fitness/definition', { store: '1' })
  await sleep(1600)
  await page.tap('.st-play') // pause: the first gesture unlocks audio
  await until(page, () => window.__story.audio().contextState === 'running', null, 3000)
  await sleep(600)
  const u0 = await UI(page)
  check(u0.toggle === 'on' && !u0.chip && u0.story === false, 'idle: a first gesture on Pause starts sound: the toggle is On and the chip leaves', u0)
  await page.tap('.st-play') // play
  const tv = await until(page, () => window.__story.audio().playing && window.__story.audio().position > 1.5, null, 8000)
  await page.tap('.st-play') // pause mid-clip
  await sleep(100)
  const p0 = (await UI(page)).position
  await sleep(14000)
  const u1 = await UI(page)
  check(
    tv >= 0 && u1.cs === 'suspended' && u1.idle === true && u1.toggle === 'on' && u1.pressed === 'true' && !u1.dot && u1.title === 'Turn sound off (M)' && !u1.chip,
    'idle: 14 s paused -> the context idle-suspends, but the toggle still shows On (no Waiting dot, title "Turn sound off") and the chip stays away',
    u1,
  )
  await page.tap('.st-play') // resume after the idle suspend
  const tf = await until(page, () => window.__story.audio().startedFrom !== null, null, 4000)
  const from = await page.evaluate(() => window.__story.audio().startedFrom)
  const rep = p0 - from
  check(tf >= 0 && from !== null && rep >= -0.001 && rep <= 0.07, `idle: Play after the idle suspend resumes the clip where it paused (paused at ${p0?.toFixed(3)}, resumed from ${from}; ${Math.round(rep * 1000)} ms repeated, <= 70)`)
  await sleep(1000)
  await page.tap('.st-play') // pause again, then let it idle
  await sleep(14000)
  const u2 = await UI(page)
  await page.tap('.st-sound-btn') // one tap, wanting silence
  await sleep(400)
  const u3 = await UI(page)
  check(u2.idle === true && u2.toggle === 'on' && u3.pref === '0' && u3.toggle === 'off' && u3.enabled === false && u3.cs === 'suspended', "idle: one toggle tap while idle turns sound OFF ('0' stored), and the context never wakes (no ui.on)", { before: u2, after: u3 })
  const errs = [...log.errors, ...log.console.filter((c) => /\[audio\].*threw/.test(c))]
  check(!errs.length, 'idle: no page errors or audio hook exceptions', errs.slice(0, 3))
  await ctx.close()
})

await test('done', async () => {
  const { ctx, page } = await open(plain, '/fitness/definition', { store: '1', vp: { width: 1440, height: 900 } })
  await sleep(1600)
  await page.click('.st-body') // unlock
  await until(page, () => window.__story.audio().contextState === 'running', null, 3000)
  await page.evaluate(() => window.__story.seek(window.__story.beats.length - 1, 0.95))
  await page.click('.st-play')
  await page.waitForFunction(() => window.__story.state().phase === 'done', null, { timeout: 30000 })
  await sleep(18000)
  const u = await UI(page)
  check(u.cs === 'suspended' && u.idle === true && u.toggle === 'on' && !u.dot && !u.chip, "done: 18 s after the chapter is done the context idles and the toggle still shows On", u)
  await page.mouse.move(700, 300)
  await page.keyboard.press('m')
  await sleep(400)
  const u2 = await UI(page)
  check(u2.toggle === 'off' && u2.pref === '0' && u2.cs === 'suspended', 'done: M while idle turns sound off', u2)
  await ctx.close()
})

await test('interrupt', async () => {
  const { ctx, page } = await open(plain, '/fitness/definition', { store: '1', init: [COUNT_AC] })
  await sleep(1600)
  await page.tap('.st-body')
  await until(page, () => window.__story.audio().playing && window.__story.audio().position > 1.5, null, 8000)
  // an interruption from outside the director (a call, Siri): the context suspends by itself
  await page.evaluate(() => window.__acList[0].suspend())
  await sleep(400)
  const u0 = await UI(page)
  check(u0.cs === 'interrupted' && u0.story === false && u0.toggle === 'waiting' && u0.dot, 'interrupt: the story pauses and the toggle shows Waiting', u0)
  const p0 = u0.position
  await page.tap('.st-body') // the next gesture resumes both
  const t = await until(page, () => window.__story.audio().playing, null, 4000)
  const a = await A(page)
  const rep = p0 - a.startedFrom
  check(t >= 0 && a.st.playing && a.startedFrom !== null && rep >= -0.001 && rep <= 0.07, `interrupt: the next tap resumes the story and the clip where it stopped (stopped at ${p0?.toFixed(3)}, resumed from ${a.startedFrom})`, { t, playing: a.st.playing, cs: a.contextState })
  const u1 = await UI(page)
  check(u1.toggle === 'on' && !u1.dot, 'interrupt: the toggle is On again', u1)
  await ctx.close()
})

await test('leave', async () => {
  const TRACK = () => {
    window.__bufs = []
    const orig = BaseAudioContext.prototype.decodeAudioData
    BaseAudioContext.prototype.decodeAudioData = function (...a) {
      const p = orig.apply(this, a)
      return p.then((b) => {
        if (!(this instanceof OfflineAudioContext)) window.__bufs.push(new WeakRef(b))
        return b
      })
    }
  }
  const { ctx, page } = await open(auto, '/fitness/definition?sound=1', { init: [TRACK] })
  await until(page, () => window.__story.audio().playing, null, 8000)
  await sleep(1500)
  const cdp = await ctx.newCDPSession(page)
  const alive = async () => {
    for (let k = 0; k < 4; k++) await cdp.send('HeapProfiler.collectGarbage')
    return page.evaluate(() => window.__bufs.filter((r) => r.deref()).length)
  }
  const inLesson = await alive()
  await page.evaluate(() => {
    history.pushState(null, '', '/')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await sleep(2500)
  const left = await alive()
  // the story is gone (the provider's cleanup deletes __story; no stage is mounted)
  const gone = await page.evaluate(() => !window.__story && !document.querySelector('.st-stage'))
  check(inLesson >= 1 && gone && left === 0, `leave: leaving the lesson releases the decoded narration (${inLesson} live buffers in the lesson, ${left} after leaving)`, { gone })
  await ctx.close()
})

/* ------------------------------ fix round 2 ------------------------------ */
const FAKE_SESSION = () => {
  // Chromium has no navigator.audioSession: a stand-in that logs every type the director sets
  const sess = { _t: 'auto', log: [] }
  Object.defineProperty(sess, 'type', { get() { return this._t }, set(v) { this._t = v; this.log.push([Math.round(performance.now()), v]) } })
  Object.defineProperty(navigator, 'audioSession', { configurable: true, get: () => sess })
}
const SET_HIDDEN = () => {
  window.__setHidden = (h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') })
    document.dispatchEvent(new Event('visibilitychange'))
  }
}

// a hide after sound was off during an earlier hide and show still pauses everything (the stale flag)
await test('hidden2', async () => {
  const { ctx, page } = await open(auto, '/fitness/definition?sound=1', { init: [COUNT_AC, SET_HIDDEN] })
  await until(page, () => window.__story.audio().playing, null, 15000)
  await page.tap('.st-sound-btn') // off
  await sleep(600)
  await page.evaluate(() => window.__setHidden(true))
  await sleep(400)
  await page.evaluate(() => window.__setHidden(false))
  await sleep(400)
  await page.tap('.st-sound-btn') // on again
  await until(page, () => window.__story.audio().playing, null, 8000)
  await sleep(600)
  await page.evaluate(() => window.__setHidden(true))
  await sleep(1200)
  const r = await page.evaluate(async () => {
    const a = window.__story.audio()
    const c = window.__acList[0]
    const t0 = c.currentTime
    await new Promise((res) => setTimeout(res, 1000))
    return { cs: a.contextState, ac: c.state, master: a.levels?.master, bed: a.levels?.bed, voice: a.playing, clockMoved: c.currentTime - t0 }
  })
  check(r.cs === 'suspended' && r.ac === 'suspended' && r.master <= -119 && !r.voice && r.clockMoved === 0, 'hidden2: on, off, hide, show, on, hide -> the context suspends, the master reads -120 and the audio clock stops (the hide flag no longer goes stale)', r)
  await page.evaluate(() => window.__setHidden(false))
  const t = await until(page, () => window.__story.audio().playing, null, 4000)
  check(t >= 0, 'hidden2: shown again, the clip continues')
  await ctx.close()
})

// sound off then on inside 220 ms (a double tap on the toggle): the session stays 'playback'
await test('session', async () => {
  const { ctx, page } = await open(plain, '/fitness/definition', { init: [FAKE_SESSION] })
  await sleep(1600)
  await page.tap('.st-soundchip')
  await until(page, () => window.__story.audio().playing, null, 15000)
  await sleep(800)
  await page.evaluate(async () => {
    const b = document.querySelector('.st-sound-btn')
    b.click()
    await new Promise((r) => setTimeout(r, 120))
    b.click()
  })
  await sleep(1500)
  const r = await page.evaluate(() => { const a = window.__story.audio(); return { enabled: a.enabled, cs: a.contextState, session: navigator.audioSession.type, toggle: document.querySelector('.st-sound').getAttribute('data-state'), log: navigator.audioSession.log } })
  check(r.enabled && r.cs === 'running' && r.session === 'playback' && r.toggle === 'on' && r.log[r.log.length - 1][1] === 'playback', "session: off and on again 120 ms apart -> sound on, the session stays 'playback' (no late 'auto')", r)
  await ctx.close()
})

// back to the tab while the context idles: it stays asleep and does not claim 'playback'; Play wakes it
await test('idleshow', async () => {
  const { ctx, page } = await open(plain, '/fitness/definition', { init: [FAKE_SESSION, SET_HIDDEN] })
  await sleep(1600)
  await page.tap('.st-soundchip')
  await until(page, () => window.__story.audio().playing && window.__story.audio().position > 1, null, 15000)
  await page.tap('.st-play') // pause
  await sleep(100)
  const p0 = (await UI(page)).position
  await sleep(14000)
  const i0 = await page.evaluate(() => ({ idle: window.__story.audio().idle, session: navigator.audioSession.type }))
  await page.evaluate(() => window.__setHidden(true))
  await sleep(500)
  await page.evaluate(() => window.__setHidden(false))
  await sleep(3000)
  const r = await page.evaluate(() => { const a = window.__story.audio(); return { cs: a.contextState, idle: a.idle, session: navigator.audioSession.type, toggle: document.querySelector('.st-sound').getAttribute('data-state'), log: navigator.audioSession.log } })
  check(i0.idle && r.cs === 'suspended' && r.idle && r.session === 'auto' && r.toggle === 'on', "idleshow: showing the tab while idle leaves the context asleep and the session 'auto' (the viewer's music keeps playing); the toggle still shows On", r)
  await page.tap('.st-play') // play wakes it
  const tf = await until(page, () => window.__story.audio().startedFrom !== null, null, 4000)
  const w = await page.evaluate(() => ({ from: window.__story.audio().startedFrom, session: navigator.audioSession.type, cs: window.__story.audio().contextState }))
  const rep = p0 - w.from
  check(tf >= 0 && w.cs === 'running' && w.session === 'playback' && rep >= -0.001 && rep <= 0.07, `idleshow: Play wakes it and the clip resumes where it paused (paused at ${p0?.toFixed(3)}, resumed from ${w.from})`, w)
  await ctx.close()
})

// desktop, returning '1': the first key in the lesson (focus on the body) unlocks audio
await test('keys', async () => {
  for (const key of ['ArrowRight', 'Space', 'e']) {
    const { ctx, page } = await open(plain, '/fitness/definition', { store: '1', vp: { width: 1280, height: 800 }, init: [COUNT_AC] })
    await sleep(1500)
    const before = await page.evaluate(() => ({ cs: window.__story.audio().contextState, active: document.activeElement?.tagName }))
    await page.keyboard.press(key)
    const t = await until(page, () => window.__story.audio().contextState === 'running', null, 2000)
    check(before.cs === 'none' && before.active === 'BODY' && t >= 0, `keys: returning '1', the first key ${key} with focus on the body unlocks audio (running after ${t} ms)`, before)
    await ctx.close()
  }
})

// the duck bridge, live: the bed stays down between D0 and D1 (a 0.29 s gap) and comes back up in the
// D3 -> D4 gap (2.1 s)
await test('bridge', async () => {
  const DUCKREC = () => {
    window.__dk = []
    const loop = () => {
      const s = window.__story
      if (s && s.state && s.state().loaded) {
        const a = s.audio()
        if (a.levels) window.__dk.push({ w: performance.now() / 1000, i: s.state().index, vp: a.playing, d: a.levels.duckBed })
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }
  const { ctx, page } = await open(auto, '/fitness/definition?sound=1&tier=low', { init: [DUCKREC] })
  await page.waitForFunction(() => window.__story.state().index === 4 && window.__story.audio().playing, null, { timeout: 90000 })
  await sleep(300)
  const dk = await page.evaluate(() => window.__dk)
  const gap = (k) => {
    const iOff = dk.findLastIndex((r) => r.i === k && r.vp)
    const iOn = dk.findIndex((r) => r.i === k + 1 && r.vp)
    return iOff >= 0 && iOn > iOff ? dk.slice(iOff + 1, iOn) : null
  }
  const g01 = gap(0)
  const m01 = g01 && g01.length ? Math.max(...g01.map((r) => r.d)) : null
  check(g01 && m01 !== null && m01 <= -4.5, `bridge: between D0's last syllable and D1's first the bed stays ducked (highest ${m01} dB over ${g01 ? (g01[g01.length - 1].w - g01[0].w).toFixed(2) : '?'} s)`)
  const g34 = gap(3)
  const m34 = g34 && g34.length ? Math.max(...g34.map((r) => r.d)) : null
  check(g34 && m34 !== null && m34 >= -1.5, `bridge: in the long D3 -> D4 gap the bed comes back up (highest ${m34} dB)`)
  await ctx.close()
})

// the D3 pour is not a riser (review 2, the major): measured on the rendered effects stem, unducked
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k)
        const wi = Math.sin(ang * k)
        const a = i + k
        const b = a + len / 2
        const xr = re[b] * wr - im[b] * wi
        const xi = re[b] * wi + im[b] * wr
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
      }
  }
}
function centroid(x, sr, a, b) {
  const N = 16384
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  const n = Math.min(N, b - a)
  for (let i = 0; i < n; i++) re[i] = x[a + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)))
  fft(re, im)
  let s = 0
  let w = 0
  for (let k = 1; k < N / 2; k++) {
    const p = re[k] * re[k] + im[k] * im[k]
    s += p * ((k * sr) / N)
    w += p
  }
  return w > 0 ? s / w : 0
}
/** BS.1770 K-weighting at 48 kHz */
function kweight(x) {
  const bq = (x, b, a) => {
    const y = new Float64Array(x.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < x.length; i++) {
      const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v
      y[i] = v
    }
    return y
  }
  return bq(bq(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]), [1, -2, 1], [1, -1.99004745483398, 0.99007225036621])
}
await test('pour', async () => {
  const { ctx, page } = await open(plain, '/fitness/definition?sound=0&beat=0&t=0')
  const b = await page.evaluate(() => window.__story.beats.findIndex((x) => x.id === 'area'))
  // render first: it awaits the chapter's sound module, which the timeline needs
  const w = wavLeft(await page.evaluate((b) => window.__story.renderAudio(b, b, { stems: ['sfx'], duck: false, tail: 1 }), b))
  const tl = (await page.evaluate((b) => window.__story.audioTimeline(b, b), b))[0]
  await ctx.close()
  const pour = tl.cues.find((c) => c.sound === 'pour.fill')
  const bell = tl.cues.find((c) => c.sound === 'resolve')
  const sr = w.sr
  const k = kweight(w.x)
  // L = R for a centred pour: momentary loudness of the left channel doubled is the stereo M
  const M = (t) => {
    let s = 0
    const a = Math.round((t - 0.4) * sr)
    const z = Math.round(t * sr)
    for (let i = a; i < z; i++) s += k[i] * k[i]
    return -0.691 + 10 * Math.log10((2 * s) / (z - a) + 1e-20)
  }
  const C = (t) => centroid(w.x, sr, Math.round((t - 0.25) * sr), Math.round(t * sr))
  const rows = []
  for (let t = pour.at + 0.65; t <= bell.at - 0.01 + 1e-9; t += 0.125) rows.push({ t, M: M(t), c: C(t) })
  const cs = rows.map((r) => r.c)
  const oct = Math.log2(Math.max(...cs) / Math.min(...cs))
  const rise = Math.max(...rows.map((r) => r.M)) - rows[0].M
  const last = rows.filter((r) => r.t >= bell.at - 1.0)
  const mFall = last[last.length - 1].M - last[0].M
  const cDrift = last[last.length - 1].c / last[0].c
  check(oct < 1, `pour: the D3 pour's centroid moves ${oct.toFixed(2)} octaves across its window after the attack (< 1; review 2 measured 1.7)`)
  check(rise < 3, `pour: its loudness rises ${rise.toFixed(1)} LU after the attack (< 3; review 2 measured 7)`)
  check(mFall <= 0.5 && cDrift <= 1.1, `pour: the last second before the claim is flat or falling (M ${mFall >= 0 ? '+' : ''}${mFall.toFixed(1)} LU, centroid x${cDrift.toFixed(2)})`)
})

await plain.close()
await auto.close()
console.log(fails ? `${fails} failure(s)` : 'all sound checks passed')
process.exit(fails ? 1 : 0)
