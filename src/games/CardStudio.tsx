import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { A2026, allAthletes2026, countryFlag, initials, monogramColor } from './athletes2026'
import photosExtra from '../data/games/photos-extra.json'
import rawGames from '../data/games-data.json'
import type { GamesData, GamesAthlete2026 } from '../types-games'

// Instagram card studio for @cf_games_update. URL-only tool (not in nav).
// Cards render at a fixed 1080x1350 (IG portrait) offscreen and export as PNG.
// URL params for automation: ?t=<template>&d=<division>&a=<slug>&b=<slug2>

const G = rawGames as unknown as GamesData

type Division = 'men' | 'women'
type Template = 'spotlight' | 'cover' | 'h2h' | 'form' | 'news' | 'carousel'

const TEMPLATES: { id: Template; label: string }[] = [
  { id: 'spotlight', label: 'Athlete Spotlight' },
  { id: 'cover', label: 'Field / Countdown Cover' },
  { id: 'h2h', label: 'Head to Head' },
  { id: 'form', label: 'Season Form Top 10' },
  { id: 'news', label: 'News / Announcement' },
  { id: 'carousel', label: 'Carousel (multi-slide)' },
]

// Multi-slide IG carousels. Every fact is grounded in the sourced events tracker
// and the cited Castro coverage (see /games/2026/events). cover -> points -> cta.
type Slide =
  | { type: 'cover'; kicker: string; headline: string; sub: string }
  | { type: 'point'; num: number; kicker: string; headline: string; body: string; source: string }
  | { type: 'cta'; headline: string; body: string }
type Carousel = { id: string; label: string; caption: string; slides: Slide[] }
const CAROUSELS: Carousel[] = [
  {
    id: 'castro-reveals',
    label: 'What Castro has told us',
    caption:
      "🚨 EVERYTHING DAVE CASTRO HAS TOLD US ABOUT THE 2026 GAMES (so far).\n\nThe original hopper is BACK, drawn live July 24. Swimming returns in a pool. Cycling's back. The Pig and Snail return. And Big Bob might race down a San Jose street.\n\nSwipe through, then get the full sourced rundown (confirmed vs teased) at the link in bio. We track every reveal as it drops.\n\nClips/quotes via @davecastro6289, CF Network, The Barbell Spin.",
    slides: [
      { type: 'cover', kicker: 'The 2026 Games', headline: 'WHAT CASTRO\nHAS TOLD US', sub: 'Every reveal and tease about the 2026 CrossFit Games programming. Swipe right.' },
      { type: 'point', num: 1, kicker: 'The Headline', headline: 'THE HOPPER\nRETURNS', body: 'The original 2007 peanut-roaster hopper is back. A workout gets drawn LIVE from it on the morning of Friday, July 24, then tested under the lights at SAP Center that night.', source: 'CF Network News' },
      { type: 'point', num: 2, kicker: 'Confirmed', headline: 'SWIMMING,\nIN A POOL', body: 'Not open water. The swim returns presented by TYR, most likely at the Morgan Hill Outdoor Sport Center, the 2020 Games swim venue.', source: 'The Barbell Spin' },
      { type: 'point', num: 3, kicker: 'Confirmed', headline: 'CYCLING\nIS BACK', body: 'Road cycling returns as part of the individual off-site opening on July 22, in the Games tradition of a Ride bike test.', source: 'CrossFit Games' },
      { type: 'point', num: 4, kicker: 'Confirmed', headline: 'PIG & SNAIL\nRETURN', body: 'The Rogue odd-objects are back: the Pig, a heavy rubber-encased block, and the Snail, a hay-bale shape part-filled with sand that shifts as it rolls.', source: 'CrossFit Games' },
      { type: 'point', num: 5, kicker: 'Teased - take with caution', headline: 'BIG BOB.\nTHE RANCH.', body: 'Castro floated a Big Bob drag race down Barack Obama Boulevard, and hinted at extra non-spectator competition days at the Aromas ranch. Hints, not confirmations.', source: 'The Barbell Spin' },
      { type: 'cta', headline: 'FOLLOW EVERY\nREVEAL', body: 'A sourced tracker of all 20 events and everything Castro has said, updated as it drops. Confirmed vs teased, with the receipts.' },
    ],
  },
  {
    id: 'engine-to-win',
    label: 'Who has the engine',
    caption:
      "📊 WHO ACTUALLY HAS THE ENGINE TO WIN SAN JOSE?\n\n20 events across 4 days does not reward one big lift. It rewards the aerobic engine that holds up on day four like it did on day one. We ranked the field on measured aerobic, monostructural and sustained-output performance, from real 2026 Open + Quarterfinals + every prior Games.\n\nSwipe for who tops it (and the sleeper the numbers love). Full breakdown at the link in bio.\n\nThis is a model read, not a prediction. Every number traces to official results.",
    slides: [
      { type: 'cover', kicker: 'The Breakdown', headline: 'WHO HAS\nTHE ENGINE?', sub: 'The aerobic engines most likely to survive 20 events in 4 days. Ranked from real results. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Men', headline: 'MEDEIROS &\nKHRENNIKOV', body: 'Tied for the top aerobic engine in the men field at the 79th percentile. Medeiros has the most balanced profile; Khrennikov owns the best monostructural mark of any man here (81st).', source: 'Persistence Athletics model' },
      { type: 'point', num: 2, kicker: 'The Women', headline: 'HALEY\nADAMS', body: 'The single biggest engine in either division: an 82nd-percentile sustained-output score. A long, grinding format is exactly what suits her, and the model has her climbing because of it.', source: 'Persistence Athletics model' },
      { type: 'point', num: 3, kicker: 'The Sleeper', headline: 'JAMES\nSPRAGUE', body: 'His engine (74th percentile) outruns his overall capacity. In a 20-event grind, that kind of aerobic base shows up late in the weekend, not early.', source: 'Persistence Athletics model' },
      { type: 'point', num: 4, kicker: 'Why it matters', headline: '4 DAYS.\n20 EVENTS.', body: 'The most events in Games history. The athletes who depend least on a single good day are the ones built to last the whole weekend. The engine is the separator.', source: 'CrossFit Games format' },
      { type: 'cta', headline: 'READ THE\nBREAKDOWN', body: 'The full engine analysis, every athlete and every number, is on the site. Data-grounded, no takes without the numbers.' },
    ],
  },
]

// Curated, source-verified news cards. Every claim here is grounded in a real,
// linked story already in the /news feed - keep it that way (null > wrong).
type NewsItem = { id: string; label: string; kicker: string; headline: string; sub: string; bullets: string[]; takeaway: string; source: string }
const NEWS: NewsItem[] = [
  {
    id: 'swimming',
    label: 'Swimming returns',
    kicker: 'Games News',
    headline: 'SWIMMING\nIS BACK',
    sub: 'Swimming returns to the 2026 CrossFit Games.',
    bullets: ['Confirmed back in the Games field', 'A true test across broad time and modal domains', 'Already built into our What-If simulator'],
    takeaway: 'Build a swim workout and see who the model favors. Link in bio.',
    source: 'The Barbell Spin',
  },
  {
    id: 'swim-25m',
    label: 'Swim: 25m pool',
    kicker: 'Confirmed',
    headline: '25-METER\nPOOL',
    sub: 'The Games swim is set: 25-meter pool lengths, presented by TYR.',
    bullets: ['A pool, not open water', '25-meter lengths confirmed', 'Part of the individual off-site opening'],
    takeaway: 'Every event detail, tracked as it drops. Link in bio.',
    source: 'The Barbell Spin',
  },
  {
    id: '20-events',
    label: '20 events / 4 days',
    kicker: 'The Format',
    headline: '20 EVENTS.\n4 DAYS.',
    sub: 'The most scored events in CrossFit Games history.',
    bullets: ['20 scored events (previous record: 15)', 'Four days of competition', 'SAP Center, San Jose - weekend of July 24-26'],
    takeaway: 'Every event, every athlete, tracked all season. Link in bio.',
    source: 'CrossFit Games',
  },
  {
    id: 'programming-teaser',
    label: 'Castro programming clues',
    kicker: 'Programming',
    headline: 'CASTRO\nDROPS CLUES',
    sub: 'A new behind-the-scenes teaser from the Aromas ranch.',
    bullets: ['Dave Castro and crew scouting the terrain', 'Movement combos hinted (some may be misdirection)', 'Castro: weighing handing off event programming'],
    takeaway: 'Full breakdowns and season analytics. Link in bio.',
    source: 'CrossFit Games / CF Network',
  },
  {
    id: 'hopper-returns',
    label: 'The hopper returns',
    kicker: 'Games News',
    headline: 'THE HOPPER\nIS BACK',
    sub: 'The original 2007 hopper returns for a live Friday-night draw.',
    bullets: ['The old peanut-roaster used at the first 2007 Games', 'A workout drawn LIVE from it on Friday, July 24', 'Tested that night under the lights at SAP Center'],
    takeaway: 'Every reveal, tracked and sourced. Link in bio.',
    source: 'CF Network News',
  },
  {
    id: 'the-breakdown',
    label: 'Promo: The Breakdown',
    kicker: 'New on the site',
    headline: 'THE\nBREAKDOWN',
    sub: 'Data-grounded analysis of the 2026 Games. No takes without the numbers.',
    bullets: ['Who actually has the engine to win San Jose', 'What swimming and cycling change, by profile', 'Every number traces to the model'],
    takeaway: 'Read the first breakdowns. Link in bio.',
    source: 'Persistence Athletics',
  },
  {
    id: 'events-tracker',
    label: 'Promo: 20 Events tracker',
    kicker: 'New on the site',
    headline: 'THE 20\nEVENTS',
    sub: 'A live tracker of the 2026 Games programming as it gets revealed.',
    bullets: ['20 scored events across 4 days, the most ever', 'Confirmed, revealed and teased, each with its source', 'Updated as every event drops'],
    takeaway: 'Follow every reveal. Link in bio.',
    source: 'Persistence Athletics',
  },
]

const HUB_URL = 'wod.persistenceathletics.com/games/2026'
const HANDLE = '@cf_games_update'
const HASHTAGS = '#CrossFitGames #CrossFitGames2026 #CrossFit #RoadToSanJose'

const GREEN = '#91C640'
const DGREEN = '#019644'
const INK = '#f4f6f2'
const DIM = 'rgba(244,246,242,0.62)'

function daysToGames(): number {
  const target = new Date('July 24, 2026 00:00:00')
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000))
}

// Season-form standings from the projected stage (placement-sum, lower = better)
function formStandings(division: Division) {
  const stage = G.results?.['2026']?.stages?.games
  if (!stage) return []
  return stage.divisions[division].slice(0, 10)
}

// Photo lookup across the qualified field + supplementary headshots (Open-top-30
// athletes who appear in form standings but aren't Games-qualified yet)
const EXTRA: Record<string, string> = photosExtra as Record<string, string>
function photoFor(name: string): string | null {
  const k = name.toLowerCase().trim()
  return allAthletes2026.find((x) => x.name.toLowerCase() === k)?.photoUrl ?? EXTRA[k] ?? null
}

// Load an image as an inline data URL (fresh fetch, bypasses the browser cache).
// This is what makes the html-to-image export reliable: the photo is embedded in
// the DOM, so there is no cross-origin canvas taint, no stale-cache (e.g. an old
// headshot), and no race between clicking Download and the image finishing load.
function useObjectImage(url: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    if (!url) return
    fetch(url, { cache: 'reload' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(
        (blob) =>
          new Promise<string>((res, rej) => {
            const fr = new FileReader()
            fr.onload = () => res(fr.result as string)
            fr.onerror = rej
            fr.readAsDataURL(blob)
          }),
      )
      .then((d) => !cancelled && setDataUrl(d))
      .catch(() => !cancelled && setDataUrl(null))
    return () => {
      cancelled = true
    }
  }, [url])
  return dataUrl
}

function RoundPhoto({ name, size }: { name: string; size: number }) {
  const data = useObjectImage(photoFor(name))
  return data ? (
    <img src={data} alt="" style={{ width: size, height: size, objectFit: 'cover', objectPosition: 'center 22%', borderRadius: 999 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 999, background: monogramColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Anton', sans-serif", fontSize: size * 0.36, color: '#fff' }}>
      {initials(name)}
    </div>
  )
}

const cardBg: React.CSSProperties = {
  width: 1080,
  height: 1350,
  background:
    'radial-gradient(120% 90% at 85% -10%, rgba(1,150,68,0.38) 0%, transparent 55%), radial-gradient(80% 70% at 10% 110%, rgba(145,198,64,0.20) 0%, transparent 60%), linear-gradient(160deg, #0b0e10 0%, #07090b 100%)',
  color: INK,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: "'Barlow Condensed', sans-serif",
  position: 'relative',
  overflow: 'hidden',
}

function CardHeader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '44px 56px 0' }}>
      <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 34, letterSpacing: 1, textTransform: 'uppercase' }}>
        <span style={{ color: INK }}>CF GAMES </span>
        <span style={{ color: GREEN }}>UPDATE</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: DIM }}>{HANDLE}</div>
    </div>
  )
}

function CardFooter() {
  return (
    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 56px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src="/pa-logo.png" alt="" style={{ width: 44, height: 44, borderRadius: 999, background: '#fff', padding: 4 }} crossOrigin="anonymous" />
        <span style={{ fontSize: 24, letterSpacing: 1.5, textTransform: 'uppercase', color: DIM }}>by Persistence Athletics</span>
      </div>
      <span style={{ fontSize: 24, color: GREEN, letterSpacing: 0.5 }}>{HUB_URL}</span>
    </div>
  )
}

function Photo({ a, size, radius = 28 }: { a: GamesAthlete2026; size: number; radius?: number }) {
  const data = useObjectImage(a.photoUrl ?? null)
  return data ? (
    <img src={data} alt="" style={{ width: size, height: size * 1.18, objectFit: 'cover', objectPosition: 'center 20%', borderRadius: radius, border: `3px solid rgba(145,198,64,0.5)` }} />
  ) : (
    <div style={{ width: size, height: size * 1.18, borderRadius: radius, background: DGREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Anton', sans-serif", fontSize: size * 0.32, color: '#fff' }}>
      {a.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
    </div>
  )
}

function GridPhoto({ a }: { a: GamesAthlete2026 }) {
  const data = useObjectImage(a.photoUrl ?? null)
  return data ? (
    <img src={data} alt="" style={{ width: 88, height: 88, objectFit: 'cover', objectPosition: 'center 22%', borderRadius: 999, border: `2px solid rgba(145,198,64,0.45)` }} />
  ) : (
    <div style={{ width: 88, height: 88, borderRadius: 999, background: DGREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Anton', sans-serif", fontSize: 30, color: '#fff', margin: '0 auto' }}>
      {a.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
    </div>
  )
}

function StatBox({ v, l }: { v: string; l: string }) {
  return (
    <div style={{ flex: 1, background: 'rgba(244,246,242,0.06)', borderRadius: 18, padding: '20px 8px', textAlign: 'center' }}>
      <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 52, color: INK, lineHeight: 1 }}>{v}</div>
      <div style={{ fontSize: 22, letterSpacing: 2.5, textTransform: 'uppercase', color: GREEN, marginTop: 8 }}>{l}</div>
    </div>
  )
}

// ---------- Templates ----------

function SpotlightCard({ a }: { a: GamesAthlete2026 }) {
  const semi = a.semifinalFinish2026 ? a.semifinalFinish2026.replace(/\s*\(.*\)/, '') : 'Qualified'
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '36px 56px 0', display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <Photo a={a} size={330} />
        <div style={{ minWidth: 0, paddingTop: 8 }}>
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: GREEN, marginBottom: 6 }}>Athlete Spotlight</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: a.name.length > 16 ? 64 : 78, textTransform: 'uppercase', lineHeight: 0.95 }}>{a.name}</div>
          <div style={{ fontSize: 32, color: DIM, marginTop: 14 }}>
            {countryFlag(a.country)} {a.country}{a.affiliate ? ` · ${a.affiliate}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            {a.isFormerChampion && (
              <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f5b82e', borderRadius: 12, padding: '10px 18px', fontSize: 26, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>🏆 Former Champion</span>
            )}
            {a.isRookie && (
              <span style={{ background: 'rgba(96,165,250,0.2)', color: '#7db5f8', borderRadius: 12, padding: '10px 18px', fontSize: 26, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>Rookie</span>
            )}
            {a.instagramHandle && <span style={{ color: GREEN, fontSize: 28, padding: '10px 0' }}>{a.instagramHandle}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, padding: '36px 56px 0' }}>
        <StatBox v={a.gamesAppearances ? `${a.gamesAppearances}x` : a.isRookie ? '1st' : '-'} l="Games" />
        <StatBox v={a.bestGamesFinish ? a.bestGamesFinish.replace(/\s*\(.*\)/, '') : 'Debut'} l="Best Finish" />
        <StatBox v={a.firstGamesYear ? String(a.firstGamesYear) : '2026'} l="Since" />
      </div>

      <div style={{ padding: '32px 56px 0' }}>
        <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: GREEN, marginBottom: 14 }}>Road to San Jose</div>
        <div style={{ display: 'flex', gap: 18 }}>
          {[
            ['Open', a.openRank2026 ? `#${a.openRank2026}` : '-'],
            ['Quarterfinal', a.qfRank2026 ? `#${a.qfRank2026}` : '-'],
            [a.semifinalEvent2026 ?? 'Semifinal', semi],
          ].map(([l, v]) => (
            <div key={l} style={{ flex: 1, border: '2px solid rgba(145,198,64,0.35)', borderRadius: 18, padding: '18px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, letterSpacing: 2, textTransform: 'uppercase', color: DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 46, color: GREEN, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {a.storyline && (
        <div style={{ padding: '34px 56px 0', fontSize: 30, lineHeight: 1.45, color: 'rgba(244,246,242,0.85)' }}>
          {a.storyline.length > 220 ? a.storyline.slice(0, 217).replace(/\s+\S*$/, '') + '...' : a.storyline}
        </div>
      )}
      <CardFooter />
    </div>
  )
}

function CoverCard() {
  const days = daysToGames()
  const all = allAthletes2026
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '40px 56px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 92, textTransform: 'uppercase', lineHeight: 0.95 }}>
          The 2026<br /><span style={{ color: GREEN }}>CrossFit Games</span>
        </div>
        <div style={{ fontSize: 32, color: DIM, marginTop: 18, letterSpacing: 2 }}>SAP CENTER · SAN JOSE · JULY 24-26</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 60, padding: '34px 56px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 84, color: GREEN, lineHeight: 1 }}>{days}</div>
          <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: DIM }}>days to go</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 84, color: INK, lineHeight: 1 }}>{all.length}</div>
          <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: DIM }}>athletes qualified</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 84, color: INK, lineHeight: 1 }}>30</div>
          <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: DIM }}>per division</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', padding: '40px 70px 0' }}>
        {all.map((a) => (
          <div key={a.slug} style={{ width: 92, textAlign: 'center' }}>
            <GridPhoto a={a} />
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', padding: '36px 56px 0', fontSize: 30, color: 'rgba(244,246,242,0.85)' }}>
        Every athlete. Every number. One place.
      </div>
      <CardFooter />
    </div>
  )
}

function H2HCard({ a, b }: { a: GamesAthlete2026; b: GamesAthlete2026 }) {
  const row = (label: string, va: string, vb: string) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '20px 0', borderTop: '1px solid rgba(244,246,242,0.12)' }}>
      <div style={{ flex: 1, fontFamily: "'Anton', sans-serif", fontSize: 44, color: INK, textAlign: 'left' }}>{va}</div>
      <div style={{ width: 320, fontSize: 25, letterSpacing: 2.5, textTransform: 'uppercase', color: DIM, textAlign: 'center' }}>{label}</div>
      <div style={{ flex: 1, fontFamily: "'Anton', sans-serif", fontSize: 44, color: INK, textAlign: 'right' }}>{vb}</div>
    </div>
  )
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ textAlign: 'center', padding: '30px 56px 0', fontSize: 28, letterSpacing: 4, textTransform: 'uppercase', color: GREEN }}>Head to Head</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 56px 0' }}>
        <div style={{ textAlign: 'center', width: 400 }}>
          <Photo a={a} size={290} />
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, textTransform: 'uppercase', marginTop: 16, lineHeight: 1 }}>{a.name}</div>
          <div style={{ fontSize: 26, color: DIM, marginTop: 6 }}>{countryFlag(a.country)} {a.country}</div>
        </div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 56, color: GREEN }}>VS</div>
        <div style={{ textAlign: 'center', width: 400 }}>
          <Photo a={b} size={290} />
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, textTransform: 'uppercase', marginTop: 16, lineHeight: 1 }}>{b.name}</div>
          <div style={{ fontSize: 26, color: DIM, marginTop: 6 }}>{countryFlag(b.country)} {b.country}</div>
        </div>
      </div>
      <div style={{ padding: '36px 64px 0' }}>
        {row('Games', a.gamesAppearances ? `${a.gamesAppearances}x` : '-', b.gamesAppearances ? `${b.gamesAppearances}x` : '-')}
        {row('Best finish', a.bestGamesFinish?.replace(/\s*\(.*\)/, '') ?? '-', b.bestGamesFinish?.replace(/\s*\(.*\)/, '') ?? '-')}
        {row('2026 Open', a.openRank2026 ? `#${a.openRank2026}` : '-', b.openRank2026 ? `#${b.openRank2026}` : '-')}
        {row('Quarterfinal', a.qfRank2026 ? `#${a.qfRank2026}` : '-', b.qfRank2026 ? `#${b.qfRank2026}` : '-')}
        {row('Semifinal', a.semifinalFinish2026?.replace(/\s*\(.*\)/, '') ?? '-', b.semifinalFinish2026?.replace(/\s*\(.*\)/, '') ?? '-')}
      </div>
      <CardFooter />
    </div>
  )
}

function FormCard({ division }: { division: Division }) {
  const rows = formStandings(division)
  const max = rows.length ? Math.max(...rows.map((r) => r.totalPoints)) : 1
  const min = rows.length ? Math.min(...rows.map((r) => r.totalPoints)) : 0
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '34px 56px 0' }}>
        <div style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: GREEN }}>Season Form · {division}</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 64, textTransform: 'uppercase', lineHeight: 1, marginTop: 6 }}>Who's Hottest<br />Right Now</div>
        <div style={{ fontSize: 25, color: DIM, marginTop: 12 }}>Open + Quarterfinals combined, all 7 tests, top 30 cohort</div>
      </div>
      <div style={{ padding: '30px 56px 0' }}>
        {rows.map((r, i) => {
          const w = 30 + (1 - (r.totalPoints - min) / Math.max(1, max - min)) * 64
          return (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '9px 0' }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 36, width: 50, color: i < 3 ? GREEN : DIM, textAlign: 'center' }}>{i + 1}</div>
              <RoundPhoto name={r.name} size={62} />
              <div style={{ width: 330, fontFamily: "'Anton', sans-serif", fontSize: 34, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ flex: 1, height: 26, background: 'rgba(244,246,242,0.07)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ width: `${w}%`, height: '100%', borderRadius: 8, background: `linear-gradient(90deg, ${DGREEN}, ${GREEN})` }} />
              </div>
            </div>
          )
        })}
      </div>
      <CardFooter />
    </div>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '40px 56px 0' }}>
        <div style={{ fontSize: 28, letterSpacing: 5, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>{item.kicker}</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 116, textTransform: 'uppercase', lineHeight: 0.92, marginTop: 14, whiteSpace: 'pre-line' }}>{item.headline}</div>
        <div style={{ fontSize: 36, color: INK, marginTop: 22, lineHeight: 1.25, maxWidth: 900 }}>{item.sub}</div>
      </div>
      <div style={{ padding: '38px 56px 0' }}>
        {item.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '15px 0', borderTop: i ? '1px solid rgba(244,246,242,0.12)' : 'none' }}>
            <div style={{ width: 15, height: 15, borderRadius: 999, background: GREEN, marginTop: 11, flexShrink: 0 }} />
            <div style={{ fontSize: 33, color: 'rgba(244,246,242,0.92)', lineHeight: 1.2 }}>{b}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: '34px 56px 0', background: 'rgba(145,198,64,0.12)', border: '1px solid rgba(145,198,64,0.4)', borderRadius: 18, padding: '26px 30px' }}>
        <div style={{ fontSize: 31, color: INK, lineHeight: 1.3 }}>{item.takeaway}</div>
      </div>
      <div style={{ padding: '22px 56px 0', fontSize: 23, color: DIM, letterSpacing: 1 }}>Source: {item.source}</div>
      <CardFooter />
    </div>
  )
}

function SlideDots({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '0 56px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === index ? 34 : 12, height: 12, borderRadius: 999, background: i === index ? GREEN : 'rgba(244,246,242,0.22)' }} />
      ))}
    </div>
  )
}

function CarouselSlide({ slide, index, total }: { slide: Slide; index: number; total: number }) {
  return (
    <div style={cardBg}>
      <CardHeader />
      {slide.type === 'cover' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ fontSize: 28, letterSpacing: 5, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>{slide.kicker}</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 120, textTransform: 'uppercase', lineHeight: 0.92, marginTop: 16, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ fontSize: 36, color: INK, marginTop: 26, lineHeight: 1.3, maxWidth: 880 }}>{slide.sub}</div>
          <div style={{ marginTop: 40, fontSize: 30, color: GREEN, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Swipe &rarr;</div>
        </div>
      )}
      {slide.type === 'point' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
            <div style={{ width: 86, height: 86, borderRadius: 20, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Anton', sans-serif", fontSize: 50, color: '#0a0a0a' }}>{slide.num}</div>
            <div style={{ fontSize: 27, letterSpacing: 3, textTransform: 'uppercase', color: slide.kicker.toLowerCase().includes('teased') ? '#f5b82e' : GREEN, fontWeight: 600 }}>{slide.kicker}</div>
          </div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 104, textTransform: 'uppercase', lineHeight: 0.94, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ fontSize: 37, color: 'rgba(244,246,242,0.92)', marginTop: 28, lineHeight: 1.32, maxWidth: 920 }}>{slide.body}</div>
          <div style={{ marginTop: 26, fontSize: 23, color: DIM, letterSpacing: 1 }}>Source: {slide.source}</div>
        </div>
      )}
      {slide.type === 'cta' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 110, textTransform: 'uppercase', lineHeight: 0.94, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ fontSize: 37, color: INK, marginTop: 26, lineHeight: 1.32, maxWidth: 900 }}>{slide.body}</div>
          <div style={{ marginTop: 38, background: 'rgba(145,198,64,0.12)', border: '1px solid rgba(145,198,64,0.4)', borderRadius: 18, padding: '26px 30px' }}>
            <div style={{ fontSize: 33, color: GREEN, fontWeight: 600 }}>Link in bio &middot; {HANDLE}</div>
            <div style={{ fontSize: 26, color: DIM, marginTop: 6 }}>{HUB_URL}/events</div>
          </div>
        </div>
      )}
      <div style={{ paddingBottom: 28 }}><SlideDots index={index} total={total} /></div>
      <CardFooter />
    </div>
  )
}

// ---------- Captions ----------

function captionFor(t: Template, a: GamesAthlete2026 | undefined, b: GamesAthlete2026 | undefined, division: Division, news?: NewsItem, carousel?: Carousel): string {
  if (t === 'carousel' && carousel) {
    return `${carousel.caption}\n\n${HASHTAGS}`
  }
  if (t === 'news' && news) {
    return `🚨 ${news.sub.toUpperCase()}\n\n${news.bullets.map((x) => `• ${x}`).join('\n')}\n\n${news.takeaway}\n\nSource: ${news.source}\n\n${HASHTAGS}`
  }
  const tagLine = (x?: GamesAthlete2026) => (x?.instagramHandle ? ` ${x.instagramHandle}` : '')
  if (t === 'spotlight' && a) {
    return `🎯 ATHLETE SPOTLIGHT: ${a.name.toUpperCase()} ${countryFlag(a.country)}\n\n${a.storyline ?? ''}\n\n${a.gamesAppearances ? `${a.gamesAppearances}x Games athlete` : 'Games rookie'}${a.bestGamesFinish ? ` · best finish ${a.bestGamesFinish}` : ''}\nRoad to San Jose: Open #${a.openRank2026 ?? '-'} · QF #${a.qfRank2026 ?? '-'} · ${a.semifinalEvent2026 ?? 'Semifinal'} ${a.semifinalFinish2026?.replace(/\s*\(.*\)/, '') ?? ''}\n\nFull profile, every athlete, every stat: link in bio${tagLine(a)}\n\n${HASHTAGS}`
  }
  if (t === 'h2h' && a && b) {
    return `⚔️ ${a.name.toUpperCase()} vs ${b.name.toUpperCase()}\n\nTwo roads to San Jose. One floor. Who you got?\n\nFull breakdowns: link in bio${tagLine(a)}${tagLine(b)}\n\n${HASHTAGS}`
  }
  if (t === 'form') {
    return `📊 WHO'S HOTTEST RIGHT NOW (${division.toUpperCase()})\n\nOpen + Quarterfinals combined, all 7 tests. This is season form, not a prediction. The Games floor decides the rest.\n\nFull analytics: link in bio\n\n${HASHTAGS}`
  }
  return `🚨 THE 2026 CROSSFIT GAMES FIELD IS SET. EVERY ATHLETE. EVERY NUMBER. ONE PLACE.\n\n30 men + 30 women have punched their ticket to San Jose. We built the most complete tracker of the 2026 season - free, no login:\n🏆 All 60 qualified athletes - full profiles, photos, complete Games history\n🛣️ Every road to San Jose: Open → Quarterfinals → Semifinal, scored event by event\n🎙️ Dave Castro's athlete interviews, embedded as they drop\n📊 Capacity analytics + a projected leaderboard nobody else has\n\nSan Jose. July 24-26. ${daysToGames()} days.\n\n🔗 Link in bio\n\n${HASHTAGS}`
}

// ---------- Studio shell ----------

export default function CardStudio() {
  const params = new URLSearchParams(window.location.search)
  const [template, setTemplate] = useState<Template>((params.get('t') as Template) || 'spotlight')
  const [division, setDivision] = useState<Division>((params.get('d') as Division) || 'men')
  const roster = division === 'men' ? A2026.men : A2026.women
  const [slugA, setSlugA] = useState(params.get('a') || roster[0].slug)
  const [slugB, setSlugB] = useState(params.get('b') || roster[1].slug)
  const [newsId, setNewsId] = useState(params.get('n') || NEWS[0].id)
  const [carouselId, setCarouselId] = useState(params.get('c') || CAROUSELS[0].id)
  const [slideIdx, setSlideIdx] = useState(Number(params.get('s') || 0))
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const a = useMemo(() => allAthletes2026.find((x) => x.slug === slugA) ?? roster[0], [slugA, roster])
  const b = useMemo(() => allAthletes2026.find((x) => x.slug === slugB) ?? roster[1], [slugB, roster])
  const newsItem = useMemo(() => NEWS.find((x) => x.id === newsId) ?? NEWS[0], [newsId])
  const carousel = useMemo(() => CAROUSELS.find((x) => x.id === carouselId) ?? CAROUSELS[0], [carouselId])
  const slideClamped = Math.max(0, Math.min(slideIdx, carousel.slides.length - 1))
  const caption = captionFor(template, a, b, division, newsItem, carousel)

  const download = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      // Wait for every image in the card to be fully loaded + decoded before we
      // rasterize, so a card is never exported with a missing/half-loaded photo
      // (photos are inline data URLs via useObjectImage, so this settles fast).
      const imgs = Array.from(cardRef.current.querySelectorAll('img'))
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((res) => {
                img.onload = () => res()
                img.onerror = () => res()
              }),
        ),
      )
      await Promise.all(imgs.map((img) => img.decode?.().catch(() => {})))
      await new Promise((r) => setTimeout(r, 120))
      // double-render to ensure fonts settle
      await toPng(cardRef.current, { width: 1080, height: 1350, pixelRatio: 1 })
      const url = await toPng(cardRef.current, { width: 1080, height: 1350, pixelRatio: 1 })
      const link = document.createElement('a')
      link.download = template === 'spotlight' ? `${a.slug}-spotlight.png` : template === 'h2h' ? `${a.slug}-vs-${b.slug}.png` : template === 'news' ? `news-${newsItem.id}.png` : template === 'carousel' ? `carousel-${carousel.id}-${String(slideClamped + 1).padStart(2, '0')}.png` : `${template}-${division}.png`
      link.href = url
      link.click()
    } finally {
      setBusy(false)
    }
  }

  const copyCaption = () => navigator.clipboard.writeText(caption)

  return (
    <div className="pt-6 pb-10">
      <div className="games-condensed text-[11px] uppercase tracking-[0.2em] text-[#91C640] mb-1">Internal tool</div>
      <h1 className="games-display text-3xl text-[var(--text-primary)] mb-1">Card Studio</h1>
      <p className="text-[12.5px] text-[var(--text-secondary)] mb-5 max-w-2xl">
        Pick a template, download the 1080x1350 PNG, copy the caption, post to {HANDLE}. Tags use verified handles only.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select value={template} onChange={(e) => setTemplate(e.target.value as Template)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
          {(['men', 'women'] as const).map((d) => (
            <button key={d} onClick={() => { setDivision(d); const r = d === 'men' ? A2026.men : A2026.women; setSlugA(r[0].slug); setSlugB(r[1].slug) }}
              className="games-condensed px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: division === d ? '#019644' : 'transparent', color: division === d ? '#fff' : 'var(--text-secondary)' }}>{d}</button>
          ))}
        </div>
        {(template === 'spotlight' || template === 'h2h') && (
          <select value={slugA} onChange={(e) => setSlugA(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {roster.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
          </select>
        )}
        {template === 'h2h' && (
          <select value={slugB} onChange={(e) => setSlugB(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {roster.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
          </select>
        )}
        {template === 'news' && (
          <select value={newsId} onChange={(e) => setNewsId(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {NEWS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        )}
        {template === 'carousel' && (
          <>
            <select value={carouselId} onChange={(e) => { setCarouselId(e.target.value); setSlideIdx(0) }} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
              {CAROUSELS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <button onClick={() => setSlideIdx((s) => Math.max(0, s - 1))} className="games-condensed px-3 py-2 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)]">&larr;</button>
              <span className="games-condensed text-[13px] text-[var(--text-secondary)] w-16 text-center">{slideClamped + 1} / {carousel.slides.length}</span>
              <button onClick={() => setSlideIdx((s) => Math.min(carousel.slides.length - 1, s + 1))} className="games-condensed px-3 py-2 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)]">&rarr;</button>
            </div>
          </>
        )}
        <button onClick={download} disabled={busy} data-testid="download-card"
          className="games-condensed uppercase tracking-[0.1em] font-semibold text-[13px] px-5 py-2 rounded-lg bg-[#019644] text-white hover:bg-[#01a94d] transition-colors disabled:opacity-50">
          {busy ? 'Rendering...' : 'Download PNG'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-start">
        {/* Preview (scaled) */}
        <div className="rounded-2xl border border-[var(--panel-border)] overflow-hidden" style={{ width: 378, height: 472.5 }}>
          <div style={{ transform: 'scale(0.35)', transformOrigin: 'top left' }}>
            <div ref={cardRef} data-testid="card-canvas">
              {template === 'spotlight' && <SpotlightCard a={a} />}
              {template === 'cover' && <CoverCard />}
              {template === 'h2h' && <H2HCard a={a} b={b} />}
              {template === 'form' && <FormCard division={division} />}
              {template === 'news' && <NewsCard item={newsItem} />}
              {template === 'carousel' && <CarouselSlide slide={carousel.slides[slideClamped]} index={slideClamped} total={carousel.slides.length} />}
            </div>
          </div>
        </div>

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="games-condensed text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Caption (auto-generated)</span>
            <button onClick={copyCaption} className="games-condensed text-[12px] uppercase tracking-[0.08em] font-semibold text-[#91C640]">Copy caption</button>
          </div>
          <textarea readOnly value={caption} rows={16}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-4 text-[13px] leading-relaxed text-[var(--text-primary)] font-mono" />
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            Castro interview clips: always credit @davecastro6289 / Dave Castro and link his video. Photos on cards are official/press imagery used for commentary.
          </p>
        </div>
      </div>
    </div>
  )
}
