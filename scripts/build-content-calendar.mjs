#!/usr/bin/env node
// Build the team content calendar at public/share/spotlights/index.html:
// 2 athlete spotlights/day (1 man + 1 woman) with card download + copy-ready caption.
// Usage: node scripts/build-content-calendar.mjs [start-date=2026-06-10]
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ATH = join(__dirname, '..', 'src', 'data', 'games', 'athletes-2026.json')
const OUT = join(__dirname, '..', 'public', 'share', 'spotlights', 'index.html')
const start = new Date(`${process.argv[2] ?? '2026-06-10'}T00:00:00`)

const d = JSON.parse(readFileSync(ATH, 'utf8'))
const HASHTAGS = '#CrossFitGames #CrossFitGames2026 #CrossFit #RoadToSanJose'

const flagOf = (c) => ({ USA: '🇺🇸', 'United States': '🇺🇸', Canada: '🇨🇦', Australia: '🇦🇺', 'United Kingdom': '🇬🇧', France: '🇫🇷', Germany: '🇩🇪', Finland: '🇫🇮', Georgia: '🇬🇪', Spain: '🇪🇸', Brazil: '🇧🇷', Chile: '🇨🇱', 'New Zealand': '🇳🇿', Switzerland: '🇨🇭', Albania: '🇦🇱', Italy: '🇮🇹', Poland: '🇵🇱', Ireland: '🇮🇪', Russia: '🇷🇺' }[c] ?? '')

const caption = (a) => {
  const semi = a.semifinalFinish2026 ? a.semifinalFinish2026.replace(/\s*\(.*\)/, '') : 'Qualified'
  return `🎯 ATHLETE SPOTLIGHT: ${a.name.toUpperCase()} ${flagOf(a.country)}

${a.storyline ?? ''}

${a.gamesAppearances ? `${a.gamesAppearances}x Games athlete` : 'Games rookie'}${a.bestGamesFinish ? ` · best finish ${a.bestGamesFinish}` : ''}
Road to San Jose: Open #${a.openRank2026 ?? '-'} · QF #${a.qfRank2026 ?? '-'} · ${a.semifinalEvent2026 ?? 'Semifinal'} ${semi}

Full profile, every athlete, every stat: link in bio${a.instagramHandle ? ` ${a.instagramHandle}` : ''}

${HASHTAGS}`
}

const days = []
const n = Math.max(d.men.length, d.women.length)
for (let i = 0; i < n; i++) {
  const date = new Date(start.getTime() + i * 86400000)
  const label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const slots = [d.men[i], d.women[i]].filter(Boolean)
  days.push({ label, iso: date.toISOString().slice(0, 10), slots })
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const slotHtml = (a) => `
  <div class="card">
    <img src="/share/spotlights/${a.slug}.png" alt="${esc(a.name)}" loading="lazy" />
    <div class="meta">
      <div class="row">
        <strong>${esc(a.name)}</strong>
        <span class="tag">${a.instagramHandle ? esc(a.instagramHandle) : 'no verified IG'}</span>
      </div>
      <a class="dl" href="/share/spotlights/${a.slug}.png" download>Download card</a>
      <button class="copy" onclick="copyCap(this)">Copy caption</button>
      <textarea readonly>${esc(caption(a))}</textarea>
    </div>
  </div>`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Spotlight Calendar - CF Games Update</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#0b0e10;color:#f4f6f2}
  header{padding:24px 20px;border-bottom:1px solid #243;position:sticky;top:0;background:#0b0e10ee;backdrop-filter:blur(8px)}
  h1{margin:0;font-size:20px}h1 b{color:#91C640}
  .sub{color:#9fb0a3;font-size:13px;margin-top:6px;max-width:640px;line-height:1.5}
  .day{padding:18px 20px;border-bottom:1px solid #1a2420}
  .day.today{background:#101a12;border-left:4px solid #91C640}
  .dh{font-size:15px;font-weight:700;color:#91C640;margin-bottom:12px;text-transform:uppercase;letter-spacing:.08em}
  .slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
  .card{display:flex;gap:14px;background:#11181b;border:1px solid #233;border-radius:14px;padding:12px}
  .card img{width:120px;height:150px;object-fit:cover;border-radius:10px}
  .meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
  .row{display:flex;justify-content:space-between;gap:8px;align-items:center}
  .tag{color:#91C640;font-size:12px}
  .dl,.copy{font-size:12.5px;padding:7px 10px;border-radius:8px;border:1px solid #345;background:transparent;color:#cfe3d2;text-decoration:none;text-align:center;cursor:pointer}
  .copy{border-color:#019644;color:#91C640}
  textarea{width:100%;height:74px;background:#0b1210;color:#cfe3d2;border:1px solid #233;border-radius:8px;font-size:11px;padding:8px;box-sizing:border-box}
  .copied{background:#019644!important;color:#fff!important}
</style></head><body>
<header>
  <h1>CF GAMES <b>UPDATE</b> · Daily Spotlight Calendar</h1>
  <div class="sub">2 posts/day (1 man + 1 woman): download the card, copy the caption, post to IG and tag the athlete. Best window: 9-11am ET (6:30-8:30pm IST). Make custom cards anytime at <a style="color:#91C640" href="/games/cards">/games/cards</a>. After June 16 the new qualifiers get added here automatically.</div>
</header>
${days.map((day) => `<section class="day" data-date="${day.iso}"><div class="dh">${day.label}</div><div class="slots">${day.slots.map(slotHtml).join('')}</div></section>`).join('\n')}
<script>
function copyCap(btn){const ta=btn.parentElement.querySelector('textarea');navigator.clipboard.writeText(ta.value);btn.textContent='Copied!';btn.classList.add('copied');setTimeout(()=>{btn.textContent='Copy caption';btn.classList.remove('copied')},1500)}
const today=new Date().toISOString().slice(0,10);const el=document.querySelector('[data-date="'+today+'"]');if(el){el.classList.add('today');el.scrollIntoView()}
</script>
</body></html>`

writeFileSync(OUT, html)
console.log(`calendar: ${days.length} days x up to 2 posts, ${d.men.length + d.women.length} athletes -> ${OUT}`)
console.log(`runs ${days[0].iso} through ${days[days.length - 1].iso}`)
