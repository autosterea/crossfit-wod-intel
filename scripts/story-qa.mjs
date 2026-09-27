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
//       navback   chapter -> next chapter -> back: canvas present, no fallback
//       persist   (with ?qa=stub) story -> story: the SAME canvas element and
//                 a stable programs count, no fallback
//       keys      pause during a glide wins; arrows in explore / sheet never step;
//                 leaving explore or stepping drops ?beat ?t ?explore
//       reduced   reduced motion: no autoplay, t = 1 shown, last beat ends 'done'
//   node scripts/story-qa.mjs shots <baseUrl> <outDir> <viewport> <query> [query...]
//       viewport: phone | p360 | p430 | phone3x | desktop | land
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
}
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const IGNORE = /THREE\.Clock|KHR_parallel|GPU stall|GL Driver|ReadPixels|clarity|googletagmanager|analytics/i

const [mode, base, ...rest] = process.argv.slice(2)
if (!mode || !base) {
  console.log('usage: node scripts/story-qa.mjs check <baseUrl> [view] | shots <baseUrl> <outDir> <viewport> <query...>')
  process.exit(2)
}
const B = base.replace(/\/$/, '')

async function open(browser, vpName, extra = {}) {
  const vp = VPS[vpName]
  const ctx = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch, ...extra })
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
const failures = []
const fail = (m) => {
  failures.push(m)
  console.log('FAIL ' + m)
}
const ok = (m) => console.log('ok   ' + m)
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

// 1 + 2. labels at three widths, budget on the phone
for (const vpName of ['p360', 'phone', 'p430']) {
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
    if (vpName === 'phone' && t === 1) {
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
  }
  if (errs.length) fail(`${vpName} console: ${errs.slice(0, 4).join(' | ')}`)
  await ctx.close()
}

// 3. continuity: (N, 1) vs (N + 1, 0), pixels of the stage canvas only
{
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

// 4. scrub: drag across the beat segments; the slate must never appear
{
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

// 5. nav away and back (a legacy chapter or the next story), then 4 s
{
  const { ctx, page, errs } = await open(browser, 'phone')
  await page.goto(url(view, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  const path0 = await page.evaluate(() => location.pathname)
  await page.evaluate(() => document.querySelector('.st-lessonnav-card.is-next')?.click())
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

// 6. persistent stage between two story chapters (?qa=stub)
{
  const { ctx, page } = await open(browser, 'phone')
  await page.goto(url(`${view}?qa=stub`, 'medium'), { waitUntil: 'load', timeout: 90000 })
  await waitReady(page)
  await page.waitForTimeout(800)
  const before = await page.evaluate(() => {
    const c = document.querySelector('.st-stage canvas')
    c.dataset.qaMark = 'persist'
    return window.__story.stats().programs
  })
  await page.evaluate(() => document.querySelector('.st-lessonnav-card.is-next')?.click())
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

// 7. keyboard and playback intent
{
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
  await page.waitForTimeout(500)
  const s0 = await page.evaluate(() => ({ i: window.__story.state().index, inSheet: !!document.activeElement?.closest('.st-sheet') }))
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const s1 = await page.evaluate(() => ({ i: window.__story.state().index, back: !!document.activeElement?.closest('.st-chapchip') }))
  if (!s0.inSheet || s1.i !== s0.i || !s1.back) fail(`sheet: ${JSON.stringify({ s0, s1 })}`)
  else ok('sheet: focus moves in, arrows ignored, focus returns to the chip')
  await ctx.close()
}

// 8. reduced motion
{
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
  await ctx.close()
}

await browser.close()
writeFileSync(join(process.cwd(), 'story-qa-report.local.json'), JSON.stringify({ view, failures }, null, 1))
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall story QA checks passed')
process.exit(failures.length ? 1 : 0)
