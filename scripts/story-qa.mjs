// Story-engine QA for the /fitness lesson (DESIGN.md E, story/README.md "QA").
// Needs a served build and Playwright (resolved from this repo, or from the
// package.json named by PLAYWRIGHT_FROM).
//
//   node scripts/story-qa.mjs check <baseUrl> [view=definition]
//       Runs every gate below and exits 1 on any failure:
//       labels    at 360 / 390 / 430: every beat at t = 1 and at its peak t
//                 values: no overlaps, no clipping, no required label hidden,
//                 live labels under the cap
//       budget    stats() on ?tier=medium at every beat end and in explore:
//                 calls <= 120, triangles <= 250k
//       continuity (N, 1) and (N + 1, 0) render the same pixels (< 0.5%)
//       scrub     dragging the beat scrubber never shows the slate
//       navback   chapter -> next chapter (the previous one from the last
//                 chapter) -> back: canvas present, no fallback
//       persist   story -> story: the SAME canvas element and
//                 a stable programs count, no fallback
//       keys      pause during a glide wins; arrows in explore / sheet never step;
//                 leaving explore or stepping drops ?beat ?t ?explore
//       reduced   reduced motion: no autoplay, t = 1 shown, last beat ends 'done'
//       shell     last beat at 360 / 390 / 430 / landscape: card buttons inside the
//                 card and viewport, no sideways scroll, 44 px targets
//       hitbands  the scrubber's 44 px band never hits the grab handle
//       tiers     unpinned, 3x, virtual clocks: 60 fps and a 30 fps cap are never
//                 demoted; an uneven 20 fps phone ends on LOW in still mode
//       refit     explore: expand / collapse the phone sheet and Reset view; the
//                 chart stays inside the focus rect (and the domain fan registered)
//       fontfail  every self-hosted TTF aborted: the story still becomes ready
//       touch     CDP finger drags: grab handle moves detents, Read more expands,
//                 a body drag scrolls the page
//       queue     taps inside a next glide queue; a step from a deep link plays
//       determinism  a deep link places labels exactly as scrubbing there does
//       QA_ONLY=touch,determinism (env) runs only the named gates
//   node scripts/story-qa.mjs shots <baseUrl> <outDir> <viewport> <query> [query...]
//       viewport: phone | p360 | p430 | phone3x | desktop | land | safari (390x664, Safari with toolbars)
//       query: e.g. "definition?beat=3&t=1" (tier is added: medium on phones, high on desktop)
//
// Software WebGL (SwiftShader) is slow: allow a few minutes for `check`.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

const VPS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, tier: 'medium' },
  p360: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, tier: 'medium' },
  p430: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, tier: 'medium' },
  phone3x: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, tier: 'medium' },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, tier: 'high' },
  land: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, tier: 'medium' },
  // an iPhone's real Safari viewport with the toolbars showing (shots only; not a gate yet)
  safari: { viewport: { width: 390, height: 664 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, tier: 'medium' },
}
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
// THREE.Clock: one deprecation warning is emitted by module-level code of the
// app's shared vendor chunk (the force-graph libraries that share the three
// chunk) BEFORE the lesson loads; R3F's own is filtered by story/threeConsole.ts.
const IGNORE = /KHR_parallel|GPU stall|GL Driver|ReadPixels|clarity|googletagmanager|analytics|ERR_FAILED|net::|THREE\.THREE\.Clock: This module has been deprecated/i
const ANALYTICS = /googletagmanager|google-analytics|analytics\.google|doubleclick|facebook|clarity\.ms|bing\.com|google\.com\/(g|ccm|rmkt|pagead)/

const [mode, base, ...rest] = process.argv.slice(2)
if (!mode || !base) {
  console.log('usage: node scripts/story-qa.mjs check <baseUrl> [view] | shots <baseUrl> <outDir> <viewport> <query...>')
  process.exit(2)
}
const B = base.replace(/\/$/, '')

async function open(browser, vpName, extra = {}) {
  const vp = VPS[vpName]
  const ctx = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch, ...extra })
  // QA never sends page views, remarketing hits or sessions to the production analytics
  await ctx.route(ANALYTICS, (r) => r.abort())
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message))
  page.on('console', (m) => {
    const t = m.text()
    if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.test(t)) errs.push(m.type() + ' ' + t.slice(0, 200))
  })
  return { ctx, page, errs, vp }
}
const waitReady = (page, ms = 90000) =>
  page.waitForFunction(() => document.querySelector('.st-stage')?.getAttribute('data-story-ready') === '1', null, { timeout: ms })
const url = (q, tier) => `${B}/fitness/${q}${q.includes('?') ? '&' : '?'}tier=${tier}`

/* -------------------------------- shots -------------------------------- */
if (mode === 'shots') {
  const [outDir, vpName, ...queries] = rest
  mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch({ args: ARGS })
  for (const q of queries) {
    const { ctx, page, errs, vp } = await open(browser, vpName)
    await page.goto(url(q, vp.tier), { waitUntil: 'load', timeout: 90000 })
    try {
      await waitReady(page)
    } catch {
      errs.push('never ready')
    }
    await page.waitForTimeout(q.includes('explore') ? 2500 : 900)
    const name = `${vpName}-${q.replace(/[^a-z0-9.]+/gi, '_')}`
    await page.screenshot({ path: `${outDir}/${name}.png` })
    const info = await page.evaluate(() => ({ stats: window.__story?.stats?.(), labels: (window.__story?.labels?.() || []).filter((l) => l.visible || l.requiredHidden) }))
    const bad = info.labels.filter((l) => l.clipped || l.overlaps.length || l.requiredHidden)
    console.log(
      `${name}  calls ${info.stats?.calls} tri ${info.stats?.triangles} dpr ${info.stats?.dpr} labels ${info.labels.length}` +
        (bad.length ? '  BAD ' + bad.map((l) => l.id + (l.clipped ? ':clipped' : '') + (l.requiredHidden ? ':requiredHidden' : '') + (l.overlaps.length ? ':ov=' + l.overlaps.join('/') : '')).join(' ') : '') +
        (errs.length ? '  ERR ' + errs.slice(0, 3).join(' | ') : ''),
    )
    await ctx.close()
  }
  await browser.close()
  process.exit(0)
}

/* -------------------------------- check -------------------------------- */
const view = rest[0] || 'definition'
// QA_ONLY=refit,touch runs only those gates (the names in the header above)
const ONLY = (process.env.QA_ONLY || '').split(',').map((x) => x.trim()).filter(Boolean)
const want = (name) => !ONLY.length || ONLY.includes(name)
const failures = []
const fail = (m) => {
  failures.push(m)
  console.log('FAIL ' + m)
}
const ok = (m) => console.log('ok   ' + m)
// A gate that throws (a selector that never appears, a timeout) is reported
// as that gate's FAIL and the run continues with the next gate, so one
// missing element never hides every later result (integration, H.53).
const gate = async (name, fn) => {
  try {
    await fn()
  } catch (e) {
    fail(`${name}: threw ${String((e && e.message) || e).split(String.fromCharCode(10))[0].slice(0, 300)}`)
  }
}
const browser = await chromium.launch({ args: ARGS })

// beats and peaks
let beats = []
{
  const { ctx, page } = await open(browser, 'phone')
  await page.goto(url(`${view}?beat=0&t=0`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  beats = await page.evaluate(() => window.__story.beats)
  await ctx.close()
}
const PEAKS = { definition: { 2: [0.35, 0.45], 3: [0.5], 5: [0.7] } }
const samples = []
beats.forEach((_, i) => {
  samples.push([i, 1])
  for (const t of PEAKS[view]?.[i] ?? [0.5]) samples.push([i, t])
})

// 1 + 2. labels at three widths, budget on the phone (every sampled t; the
//        report gives the true maximum)
const maxStats = { calls: 0, triangles: 0, points: 0, at: '' }
await gate('labels', async () => {
if (want('labels')) for (const vpName of ['p360', 'phone', 'p430']) {
  const { ctx, page, errs } = await open(browser, vpName)
  await page.goto(url(`${view}?beat=0&t=1`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  for (const [n, t] of samples) {
    await page.evaluate(([n, t]) => window.__story.seek(n, t), [n, t])
    await waitReady(page)
    await page.waitForTimeout(150)
    const r = await page.evaluate(() => ({ labels: window.__story.labels(), counts: window.__story.labelCounts(), stats: window.__story.stats() }))
    const vis = r.labels.filter((l) => l.visible)
    const bad = r.labels.filter((l) => (l.visible && (l.clipped || l.overlaps.length)) || l.requiredHidden)
    const tag = `${vpName} beat ${n} t ${t}`
    if (bad.length) fail(`${tag} labels: ` + bad.map((l) => l.id + (l.clipped ? ':clipped' : '') + (l.requiredHidden ? ':required-hidden' : '') + (l.overlaps.length ? ':overlaps ' + l.overlaps.join('/') : '')).join(', '))
    else ok(`${tag} labels: ${vis.length} visible, ${r.counts.live} live / ${r.counts.registered} registered`)
    if (r.counts.live > r.counts.cap.live) fail(`${tag} ${r.counts.live} live labels > cap ${r.counts.cap.live}`)
    if (vpName === 'phone') {
      if (r.stats.calls > maxStats.calls) Object.assign(maxStats, { calls: r.stats.calls, at: `beat ${n} t ${t}` })
      maxStats.triangles = Math.max(maxStats.triangles, r.stats.triangles)
      maxStats.points = Math.max(maxStats.points, r.stats.points)
      if (r.stats.calls > 120 || r.stats.triangles > 250000) fail(`${tag} budget: ${r.stats.calls} calls, ${r.stats.triangles} triangles`)
      else ok(`${tag} budget: ${r.stats.calls} calls, ${r.stats.triangles} tris, ${r.stats.points} points, dpr ${r.stats.dpr}`)
    }
  }
  if (vpName === 'phone') {
    await page.evaluate(() => window.__story.explore(true))
    await page.waitForTimeout(2500)
    const s = await page.evaluate(() => window.__story.stats())
    if (s.calls > 120 || s.triangles > 250000) fail(`phone explore budget: ${s.calls} calls`)
    else ok(`phone explore budget: ${s.calls} calls, ${s.triangles} tris`)
    if (s.calls > maxStats.calls) Object.assign(maxStats, { calls: s.calls, at: 'explore' })
    console.log(`     phone MEDIUM maximum over every sample: ${maxStats.calls} calls (${maxStats.at}), ${maxStats.triangles} triangles, ${maxStats.points} points`)
  }
  if (errs.length) fail(`${vpName} console: ${errs.slice(0, 4).join(' | ')}`)
  await ctx.close()
}
})

// 3. continuity: (N, 1) vs (N + 1, 0), pixels of the stage canvas only
await gate('continuity', async () => {
if (want('continuity')) {
  const { ctx, page } = await open(browser, 'phone')
  await page.goto(url(`${view}?beat=0&t=1`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  // the caption legitimately swaps at the boundary; compare the stage only
  await page.addStyleTag({ content: '.st-card, .st-keyhint, .st-flash { visibility: hidden !important }' })
  const shot = async (n, t) => {
    await page.evaluate(([n, t]) => window.__story.seek(n, t), [n, t])
    await waitReady(page)
    await page.waitForTimeout(250)
    const canvas = await page.$('.st-canvas canvas, canvas')
    return canvas.screenshot()
  }
  // decode and compare the two PNGs inside the page (no image library needed)
  const compare = (a, b) =>
    page.evaluate(
      async ([a, b]) => {
        const load = (src) =>
          new Promise((res) => {
            const im = new Image()
            im.onload = () => res(im)
            im.src = 'data:image/png;base64,' + src
          })
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
        for (let i = 0; i < da.length; i += 4) {
          if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) diff++
        }
        return { diff, total: c.width * c.height }
      },
      [a.toString('base64'), b.toString('base64')],
    )
  for (let n = 0; n < beats.length - 1; n++) {
    const a = await shot(n, 1)
    const b = await shot(n + 1, 0)
    const { diff, total } = await compare(a, b)
    if (diff / total > 0.005) fail(`continuity ${n}|${n + 1}: ${((100 * diff) / total).toFixed(2)}% pixels differ`)
    else ok(`continuity ${n}|${n + 1}: ${((100 * diff) / total).toFixed(3)}% pixels differ`)
  }
  await ctx.close()
}
})

// 4. scrub: drag across the beat segments; the slate must never appear
await gate('scrub', async () => {
if (want('scrub')) {
  const { ctx, page } = await open(browser, 'phone', { hasTouch: false, isMobile: false })
  await page.goto(url(view, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(800) // let the load slate finish its fade
  const box = await (await page.$('.st-segs')).boundingBox()
  await page.mouse.move(box.x + 4, box.y + box.height / 2)
  await page.mouse.down()
  let slate = 0
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(box.x + (box.width * i) / 13, box.y + box.height / 2, { steps: 3 })
    slate += await page.evaluate(() => (document.querySelector('.st-slate:not(.is-out)') ? 1 : 0))
  }
  await page.mouse.up()
  if (slate) fail(`scrub: slate visible in ${slate}/12 samples mid-drag`)
  else ok('scrub: no slate mid-drag')
  await ctx.close()
}
})

// 5. nav away and back (the next chapter, or the previous one from the last), then 4 s
await gate('navback', async () => {
if (want('navback')) {
  const { ctx, page, errs } = await open(browser, 'phone')
  await page.goto(url(view, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  const path0 = await page.evaluate(() => location.pathname)
  await page.evaluate(() => (document.querySelector('.st-lessonnav-card.is-next') ?? document.querySelector('button.st-lessonnav-card'))?.click())
  await page.waitForTimeout(1500)
  await page.goBack()
  await page.waitForTimeout(400)
  await page.goForward()
  await page.waitForTimeout(400)
  await page.goBack()
  try {
    await waitReady(page, 30000)
  } catch {
    /* reported below */
  }
  await page.waitForTimeout(4000)
  const r = await page.evaluate(() => ({ path: location.pathname, canvas: !!document.querySelector('.st-stage canvas'), fallback: !!document.querySelector('.st-slate.is-fallback'), ready: document.querySelector('.st-stage')?.getAttribute('data-story-ready') }))
  if (r.path !== path0 || !r.canvas || r.fallback || r.ready !== '1') fail(`navback: ${JSON.stringify(r)}`)
  else ok(`navback: canvas present, no fallback, ready (${r.path})`)
  if (errs.length) console.log('     navback console: ' + errs.slice(0, 4).join(' | '))
  await ctx.close()
}
})

// 6. persistent stage between two story chapters (every chapter is a story)
await gate('persist', async () => {
if (want('persist')) {
  const { ctx, page } = await open(browser, 'phone')
  await page.goto(url(view, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(800)
  const before = await page.evaluate(() => {
    const c = document.querySelector('.st-stage canvas')
    c.dataset.qaMark = 'persist'
    return window.__story.stats().programs
  })
  await page.evaluate(() => (document.querySelector('.st-lessonnav-card.is-next') ?? document.querySelector('button.st-lessonnav-card'))?.click())
  await waitReady(page, 30000)
  await page.waitForTimeout(800)
  const mid = await page.evaluate(() => ({ view: window.__story?.view, same: document.querySelector('.st-stage canvas')?.dataset.qaMark === 'persist', n: document.querySelectorAll('canvas').length }))
  await page.goBack()
  await waitReady(page, 30000)
  await page.waitForTimeout(1500)
  const after = await page.evaluate(() => ({
    view: window.__story?.view,
    same: document.querySelector('.st-stage canvas')?.dataset.qaMark === 'persist',
    programs: window.__story.stats().programs,
    fallback: !!document.querySelector('.st-slate.is-fallback'),
  }))
  if (!mid.same || !after.same || after.fallback || mid.n !== 1) fail(`persist: ${JSON.stringify({ mid, after })}`)
  else ok(`persist: same canvas across ${view} -> ${mid.view} -> ${after.view}; programs ${before} -> ${after.programs}`)
  if (after.programs > before + 2) fail(`persist: programs grew ${before} -> ${after.programs}`)
  await ctx.close()
}
})

// 7. keyboard and playback intent
await gate('keys', async () => {
if (want('keys')) {
  const { ctx, page } = await open(browser, 'desktop')
  await page.goto(url(view, 'high'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(1200)
  // a pause pressed during the next glide wins
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await page.waitForTimeout(900)
  const a = await page.evaluate(() => window.__story.state())
  if (a.playing) fail('keys: Space during the next glide did not pause')
  else ok(`keys: pause during glide holds (beat ${a.index})`)
  // arrows inside the explore radiogroup never step the story
  await page.evaluate(() => window.__story.explore(true))
  await page.waitForTimeout(1200)
  await page.focus('.st-explore [role="radio"][tabindex="0"]')
  const before = await page.evaluate(() => window.__story.state())
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => ({ st: window.__story.state(), checked: document.querySelector('.st-explore [aria-checked="true"]')?.textContent }))
  if (after.st.mode !== 'explore' || after.st.index !== before.index) fail(`keys: ArrowRight in the radiogroup left explore or stepped: ${JSON.stringify(after.st)}`)
  else ok(`keys: ArrowRight in the radiogroup selects "${after.checked}" and stays in explore`)
  // leaving explore drops ?explore; stepping drops ?beat / ?t
  await page.goto(url(`${view}?beat=2&t=1&explore=1`, 'high'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.keyboard.press('Escape')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  const q = await page.evaluate(() => location.search)
  if (/beat=|explore=|[?&]t=/.test(q)) fail(`url drift: ${q}`)
  else ok(`url drift: query after Esc + step is "${q}"`)
  // the chapter sheet is modal: arrows do not step, focus moves in and returns
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(600)
  await page.click('.st-chapchip')
  // the sheet moves focus in once it has opened: wait for that, not a fixed
  // 500 ms (SwiftShader frame times made the fixed wait flaky, H.53)
  await page.waitForFunction(() => !!document.activeElement?.closest('.st-sheet'), null, { timeout: 5000 }).catch(() => undefined)
  const s0 = await page.evaluate(() => ({ i: window.__story.state().index, inSheet: !!document.activeElement?.closest('.st-sheet') }))
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const s1 = await page.evaluate(() => ({ i: window.__story.state().index, back: !!document.activeElement?.closest('.st-chapchip') }))
  if (!s0.inSheet || s1.i !== s0.i || !s1.back) fail(`sheet: ${JSON.stringify({ s0, s1 })}`)
  else ok('sheet: focus moves in, arrows ignored, focus returns to the chip')
  await ctx.close()
}
})

// 8. reduced motion
await gate('reduced', async () => {
if (want('reduced')) {
  const { ctx, page } = await open(browser, 'phone', { reducedMotion: 'reduce' })
  await page.goto(url(view, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(2500)
  const s0 = await page.evaluate(() => window.__story.state())
  if (s0.playing || s0.t !== 1) fail(`reduced: autoplay or not at t = 1: ${JSON.stringify({ playing: s0.playing, t: s0.t })}`)
  else ok('reduced: no autoplay, t = 1')
  for (let i = 0; i < beats.length - 1; i++) await page.evaluate(() => window.__story.next())
  await page.waitForTimeout(400)
  const s1 = await page.evaluate(() => ({ st: window.__story.state(), cta: document.querySelectorAll('.st-cta-row button').length }))
  if (s1.st.phase !== 'done' || !s1.cta) fail(`reduced: last beat not done: ${JSON.stringify({ phase: s1.st.phase, cta: s1.cta })}`)
  else ok('reduced: last beat reaches done with the CTA row')
  // explore from the last beat under reduced motion: the explore pose is
  // applied at once (a cut), so the chart fills its focus rect
  await page.click('.st-cta-row .st-btn--outline')
  await page.waitForTimeout(700)
  const s2 = await page.evaluate(() => {
    const s = window.__story
    const f = s.state().focus
    const c = s.chartRect()
    return c ? { fill: Math.max(c.w / f.w, c.h / f.h), inside: c.x >= f.x - 1.5 && c.x + c.w <= f.x + f.w + 1.5 && c.y >= f.y - 1.5 && c.y + c.h <= f.y + f.h + 1.5 } : null
  })
  // a fitted pose leaves the label margins (about 0.79 of the rect on a
  // phone); a mis-fitted one (the story's lineup distance) is about 0.55
  if (s2 && (s2.fill < 0.7 || !s2.inside)) fail(`reduced explore: chart ${JSON.stringify(s2)}`)
  else ok(`reduced explore: explore opened from the last beat is fitted at once${s2 ? ` (fills ${s2.fill.toFixed(2)})` : ''}`)
  await ctx.close()
}
})

// 9. shell: on the finished last beat every card button sits inside the card
//    and the viewport (360 / 390 / 430 portrait and a landscape phone), the
//    stage never scrolls sideways, and first-screen controls are 44 px targets.
await gate('shell', async () => {
if (want('shell')) for (const vpName of ['p360', 'phone', 'p430', 'land']) {
  const { ctx, page } = await open(browser, vpName)
  await page.goto(url(`${view}?beat=${beats.length - 1}&t=1`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  // button widths are measured with the web fonts, never the fallback (H.53)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => {
    const vw = window.innerWidth
    const card = document.querySelector('.st-card').getBoundingClientRect()
    const out = []
    for (const b of document.querySelectorAll('.st-card button')) {
      const q = b.getBoundingClientRect()
      if (!q.width) continue
      const name = (b.getAttribute('aria-label') || b.textContent || b.className).trim().slice(0, 28)
      if (q.left < card.left - 1 || q.right > card.right + 1 || q.left < -1 || q.right > vw + 1) out.push(`${name} x ${Math.round(q.left)}..${Math.round(q.right)} (card ${Math.round(card.left)}..${Math.round(card.right)}, vw ${vw})`)
      if (b.scrollWidth > b.clientWidth + 1 && !b.querySelector('.st-btn-l')) out.push(`${name} text overflows ${b.scrollWidth}/${b.clientWidth}`)
    }
    const st = document.querySelector('.st-stage')
    if (st.scrollWidth > st.clientWidth + 1) out.push(`stage scrolls sideways ${st.scrollWidth}/${st.clientWidth}`)
    const small = []
    const check = (sel, label) => {
      const el = document.querySelector(sel)
      if (!el) return
      const q = el.getBoundingClientRect()
      if (q.width && (q.width < 43.5 || q.height < 43.5)) small.push(`${label} ${Math.round(q.width)}x${Math.round(q.height)}`)
    }
    check('.st-theme > button', 'theme toggle')
    check('.st-brand', 'brand')
    check('.st-chapchip', 'chapter chip')
    for (const b of document.querySelectorAll('.st-transport button')) {
      const q = b.getBoundingClientRect()
      if (q.width && (q.width < 43.5 || q.height < 43.5)) small.push(`transport ${b.getAttribute('aria-label')} ${Math.round(q.width)}x${Math.round(q.height)}`)
    }
    for (const b of document.querySelectorAll('.st-cta-row button')) {
      const q = b.getBoundingClientRect()
      if (q.height < 43.5) small.push(`cta ${Math.round(q.height)}`)
    }
    return { out, small }
  })
  const bad = [...r.out, ...r.small]
  if (bad.length) fail(`${vpName} shell: ${bad.join('; ')}`)
  else ok(`${vpName} shell: card buttons inside the card and viewport, no sideways scroll, targets >= 44 px`)
  await ctx.close()
}
})

// 10. phone hit bands: the scrubber band always hits the scrubber, never the
//     grab handle; the grab handle's own band (above the card edge) hits it.
await gate('hitbands', async () => {
if (want('hitbands')) for (const vpName of ['p360', 'phone']) {
  const { ctx, page } = await open(browser, vpName)
  await page.goto(url(`${view}?beat=1&t=1`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => {
    const s = document.querySelector('.st-segs').getBoundingClientRect()
    const g = document.querySelector('.st-grab').getBoundingClientRect()
    const miss = []
    for (const fx of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      for (let y = Math.ceil(s.top) + 1; y < s.bottom - 1; y += 2) {
        const e = document.elementFromPoint(s.left + s.width * fx, y)
        if (!e?.closest('.st-segs')) miss.push(`${Math.round(fx * 100)}%,${y}:${e?.className || e?.tagName}`)
      }
    }
    const gx = g.left + g.width / 2
    const grabHits = [g.top - 20, g.top - 4, g.top + 8].map((y) => !!document.elementFromPoint(gx, y)?.closest('.st-grab'))
    return { band: Math.round(s.height), miss: miss.slice(0, 6), missCount: miss.length, grabHits }
  })
  if (r.missCount || r.band < 43.5) fail(`${vpName} scrubber band ${r.band}px, ${r.missCount} samples miss it: ${r.miss.join(' ')}`)
  else ok(`${vpName} scrubber: a ${r.band} px band that always hits the scrubber`)
  if (r.grabHits.includes(false)) fail(`${vpName} grab handle band: ${JSON.stringify(r.grabHits)}`)
  else ok(`${vpName} grab handle: its own 44 px band above the scrubber`)
  await ctx.close()
}
})

// 11. adaptive quality on virtual clocks (H.29, H.38). UNPINNED (no ?tier) at
//     3x. Every rAF advances the page's performance.now by the next step of a
//     pattern, so drei's monitor sees exactly that frame rate:
//       60 fps steady   -> a healthy phone: never demoted
//       30 fps steady   -> a phone the browser caps (Low Power Mode): never demoted
//       20 fps uneven   -> a really slow phone: ends on LOW and in still mode
async function virtualClock(pattern, seconds) {
  const { ctx, page } = await open(browser, 'phone3x')
  await ctx.addInitScript((pattern) => {
    const realRAF = window.requestAnimationFrame.bind(window)
    const realNow = performance.now.bind(performance)
    let frame = 0
    let t = 0
    const base = realNow()
    window.__vframe = () => frame
    window.__vtime = () => t
    // one virtual step per REAL animation frame (several rAF callers in one
    // frame must not advance the clock twice)
    let lastReal = -1
    window.requestAnimationFrame = (cb) =>
      realRAF((ts) => {
        if (ts !== lastReal) {
          lastReal = ts
          t += pattern[frame % pattern.length]
          frame++
        }
        cb(base + t)
      })
    performance.now = () => base + t
  }, pattern)
  await page.goto(`${B}/fitness/${view}`, { waitUntil: 'load', timeout: 90000 })
  try {
    await waitReady(page, 180000)
  } catch {
    /* reported below */
  }
  const t0 = Date.now()
  let v = 0
  while (Date.now() - t0 < 480000) {
    await page.waitForTimeout(4000)
    v = await page.evaluate(() => window.__vtime() / 1000)
    if (v >= seconds) break
  }
  const r = await page.evaluate(() => ({ log: window.__story.qualityLog(), s: window.__story.state() }))
  await ctx.close()
  return { v, ...r, summary: r.log.map((e) => `${e.at}s ${e.tier}@${e.dpr} ${e.why}`).join(', ') }
}
await gate('tiers', async () => {
if (want('tiers')) for (const [name, pattern] of [
  ['60 fps', [16.667]],
  ['30 fps (capped)', [33.333]],
]) {
  const r = await virtualClock(pattern, 24)
  const start = r.log[0]
  const worse = r.log.filter((e) => e.why === 'decline')
  const lower = r.log.filter((e, i) => i > 0 && e.dpr < r.log[i - 1].dpr)
  if (r.v < 24) fail(`tiers ${name}: only ${Math.round(r.v)} virtual s ran (${r.summary})`)
  else if (worse.length || lower.length || r.s.tier !== start.tier) fail(`tiers ${name}: a healthy phone was demoted: ${r.summary}`)
  else ok(`tiers ${name}: ${Math.round(r.v)} virtual s, no demotion (${r.summary}; now ${r.s.tier}@${r.s.dpr}, still ${r.s.still})`)
}
})
await gate('tiers', async () => {
if (want('tiers')) {
  // uneven 20 fps: 30 / 70 ms frames
  const r = await virtualClock([30, 70], 36)
  if (r.s.tier !== 'low' || !r.s.still) fail(`tiers 20 fps uneven: expected LOW and still mode, got ${r.s.tier} still ${r.s.still} (${r.summary})`)
  else ok(`tiers 20 fps uneven: degraded to LOW and still mode (${r.summary})`)
}
})

// 12. explore re-fits to the sheet (E.3): open explore on the phone, expand
//     the controls sheet, collapse it, Reset view. At every step the chart
//     frame box projects inside the focus rect and no visible label is clipped.
//     Definition also toggles the domains in the expanded sheet, collapses,
//     and checks every domain curve still starts at x(0) and ends at x(1).
await gate('refit', async () => {
if (want('refit')) {
  const { ctx, page, errs } = await open(browser, 'phone')
  await page.goto(url(`${view}?beat=${Math.min(3, beats.length - 1)}&t=1`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(400)
  const probe = (tag) =>
    page.evaluate((tag) => {
      const s = window.__story
      const f = s.state().focus
      const c = s.chartRect()
      const inside = !c || (c.x >= f.x - 1.5 && c.y >= f.y - 1.5 && c.x + c.w <= f.x + f.w + 1.5 && c.y + c.h <= f.y + f.h + 1.5)
      const clipped = s.labels().filter((l) => l.visible && l.clipped).map((l) => l.id)
      let fanErr = null
      if (s.probes().includes('def-fan')) {
        const p = s.probe('def-fan')
        if (p.fan > 0.5) {
          fanErr = 0
          for (const cv of p.curves) {
            const a = s.project(...cv.start)
            const b = s.project(...cv.end)
            fanErr = Math.max(fanErr, Math.abs(a.x - s.project(p.x0, cv.start[1], cv.start[2]).x), Math.abs(b.x - s.project(p.x1, cv.end[1], cv.end[2]).x))
          }
        }
      }
      const fill = c ? Math.max(c.w / f.w, c.h / f.h) : 1
      return { tag, inside, clipped, fanErr, fill: Math.round(fill * 100) / 100, focus: f, chart: c && { x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h) } }
    }, tag)
  const judge = (r) => {
    const bad = []
    if (!r.inside) bad.push(`chart ${JSON.stringify(r.chart)} outside focus ${JSON.stringify(r.focus)}`)
    if (r.clipped.length) bad.push('clipped ' + r.clipped.join('/'))
    // fitted = about 0.79 on a phone (label margins); a stale distance shows as about 0.55
    if (r.fill < 0.7) bad.push(`chart fills only ${r.fill} of the focus rect`)
    if (r.fanErr !== null && r.fanErr > 2) bad.push(`domain curves off their axis ends by ${r.fanErr} px`)
    if (bad.length) fail(`explore refit (${r.tag}): ${bad.join('; ')}`)
    else ok(`explore refit (${r.tag}): chart inside the focus rect, fills ${r.fill}${r.fanErr !== null ? `, domain curves registered within ${r.fanErr} px` : ''}`)
  }
  await page.click('.st-transport .st-explore-pill')
  await page.waitForTimeout(2200)
  judge(await probe('peek'))
  await page.click('.st-explore .st-grab')
  await page.waitForTimeout(2200)
  judge(await probe('expanded'))
  await page.click('.st-chip--reset')
  await page.waitForTimeout(1500)
  judge(await probe('expanded + reset'))
  if (view === 'definition') {
    await page.click('.st-explore .st-toggle')
    await page.waitForTimeout(2500)
    await page.click('.st-explore .st-grab')
    await page.waitForTimeout(2500)
    await page.click('.st-chip--reset')
    await page.waitForTimeout(1500)
    judge(await probe('domains on, collapsed, reset'))
  } else {
    await page.click('.st-explore .st-grab')
    await page.waitForTimeout(2200)
    judge(await probe('collapsed'))
  }
  if (errs.length) fail(`explore refit console: ${errs.slice(0, 3).join(' | ')}`)
  await ctx.close()
}
})

// 13. a failed font never strands the chapter on the slate (H.39): abort
//     every self-hosted TTF; the story must still become ready and play.
await gate('fontfail', async () => {
if (want('fontfail')) {
  const { ctx, page, errs } = await open(browser, 'phone')
  await ctx.route(/\/fonts\/[^/]+\.ttf/, (r) => r.abort())
  await page.goto(url(view, 'medium'), { waitUntil: 'load', timeout: 90000 })
  let ready = true
  try {
    await waitReady(page, 40000)
  } catch {
    ready = false
  }
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => ({ st: window.__story?.state(), slate: !!document.querySelector('.st-slate:not(.is-out)') }))
  if (!ready || !r.st || r.st.T <= 0 || r.slate) fail(`fontfail: ${JSON.stringify({ ready, T: r.st?.T, slate: r.slate })}`)
  else ok(`fontfail: SDF fonts aborted, the story still became ready and plays (T ${r.st.T.toFixed(2)})`)
  const unexpected = errs.filter((e) => !/not ready after|Failure loading font|fonts\/|ERR_FAILED/.test(e))
  if (unexpected.length) fail(`fontfail console: ${unexpected.slice(0, 3).join(' | ')}`)
  await ctx.close()
}
})

// 14. real touch on the phone card (H.47), through CDP touch events (a mouse
//     never shows this): a vertical finger drag on the grab handle moves the
//     card between detents, the Read more link opens the expanded detent, and
//     a vertical finger drag on the card body still scrolls the page.
await gate('touch', async () => {
if (want('touch')) {
  const { ctx, page } = await open(browser, 'phone')
  await page.goto(url(`${view}?beat=1&t=1`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(500)
  const cdp = await ctx.newCDPSession(page)
  const swipe = async (x, y0, y1) => {
    const steps = 8
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(500)
  }
  const detent = () => page.evaluate(() => document.querySelector('.st-card')?.getAttribute('data-detent'))
  const g = await (await page.$('.st-card .st-grab')).boundingBox()
  await swipe(g.x + g.width / 2, g.y + 10, g.y - 190)
  const up = await detent()
  await swipe(g.x + g.width / 2, (await (await page.$('.st-card .st-grab')).boundingBox()).y + 10, 700)
  const down = await detent()
  await page.tap('.st-card .st-more-link')
  await page.waitForTimeout(500)
  const more = await detent()
  await page.tap('.st-card .st-more-link')
  await page.waitForTimeout(500)
  const b = await (await page.$('.st-card .st-body')).boundingBox()
  const y0 = await page.evaluate(() => window.scrollY)
  await swipe(b.x + b.width / 2, b.y + b.height / 2, b.y + b.height / 2 - 220)
  const y1 = await page.evaluate(() => window.scrollY)
  const after = await detent()
  const res = { up, down, more, scrolled: y1 - y0, after }
  if (up !== 'expanded' || down !== 'default' || more !== 'expanded' || res.scrolled < 60 || after !== 'default') fail(`touch: ${JSON.stringify(res)}`)
  else ok(`touch: grab drag up -> expanded, down -> default, Read more -> expanded, body drag scrolls the page ${res.scrolled} px`)
  await ctx.close()
}
})

// 15. playback intent: taps inside a next glide queue up, and a viewer's
//     step from a deep link leaves the hold and plays the new beat.
await gate('queue', async () => {
if (want('queue')) {
  const { ctx, page } = await open(browser, 'phone', { hasTouch: false, isMobile: false })
  await page.goto(url(view, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(700)
  const next = await page.$('.st-transport button[aria-label="Next beat"]')
  for (let i = 0; i < 3; i++) {
    await next.click()
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(1200)
  const a = await page.evaluate(() => window.__story.state())
  if (a.index !== Math.min(3, beats.length - 1)) fail(`queue: three taps 150 ms apart reached beat ${a.index}, expected 3`)
  else ok('queue: three taps inside the glide step three beats')
  await page.goto(url(`${view}?beat=1&t=1`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(300)
  await page.click('.st-transport button[aria-label="Next beat"]')
  await page.waitForTimeout(700)
  const b = await page.evaluate(() => window.__story.state())
  if (b.held || !b.playing || b.index !== 2 || b.t >= 1) fail(`held step: ${JSON.stringify({ held: b.held, playing: b.playing, index: b.index, t: b.t })}`)
  else ok(`held step: Next from a deep link plays beat 2 (t ${b.t.toFixed(2)})`)
  await ctx.close()
}
})

// 16. label determinism: a deep link lays labels out exactly as the same
//     (N, t) reached by scrubbing through the chapter (hysteresis must not
//     leak across a seek).
await gate('determinism', async () => {
if (want('determinism')) {
  const { ctx, page } = await open(browser, 'phone')
  // id -> [x, y] of every visible label
  const snap = () =>
    page.evaluate(() => Object.fromEntries(window.__story.labels().filter((l) => l.visible).map((l) => [l.id, [l.x, l.y]])))
  await page.goto(url(`${view}?beat=0&t=0`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  const scrubbed = {}
  for (let n = 0; n < beats.length; n++) {
    for (const t of [0.25, 0.5, 0.75, 1]) {
      await page.evaluate(([n, t]) => window.__story.seek(n, t), [n, t])
      await waitReady(page)
      await page.waitForTimeout(80)
    }
    // let the caption swap finish (the card height feeds the focus rect)
    await page.waitForTimeout(300)
    scrubbed[n] = await snap()
  }
  let diffs = 0
  for (let n = 0; n < beats.length; n++) {
    await page.goto(url(`${view}?beat=${n}&t=1`, 'medium'), { waitUntil: 'load', timeout: 90000 })
    await waitReady(page)
    await page.waitForTimeout(150)
    await page.waitForTimeout(300)
    const fresh = await snap()
    // the same labels, each within 2 px (sub-pixel rounding of a projection);
    // a label on another side moves by its gap plus its size
    const bad = []
    for (const id of new Set([...Object.keys(fresh), ...Object.keys(scrubbed[n])])) {
      const a = fresh[id]
      const b = scrubbed[n][id]
      if (!a || !b) bad.push(`${id}:${a ? 'only deep link' : 'only scrubbed'}`)
      else if (Math.abs(a[0] - b[0]) > 2 || Math.abs(a[1] - b[1]) > 2) bad.push(`${id}@${a} vs ${b}`)
    }
    if (bad.length) {
      diffs++
      fail(`labels determinism beat ${n}: deep link differs from scrubbed: ${bad.slice(0, 4).join(' ')}`)
    }
  }
  if (!diffs) ok(`labels determinism: ${beats.length} beats lay out the same (within 2 px) from a deep link and after scrubbing`)
  await ctx.close()
}
})

await browser.close()
writeFileSync(join(process.cwd(), 'story-qa-report.local.json'), JSON.stringify({ view, failures }, null, 1))
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall story QA checks passed')
process.exit(failures.length ? 1 : 0)
