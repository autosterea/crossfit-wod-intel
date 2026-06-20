import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Line,
  LineChart,
  Scatter,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_TOOLTIP_STYLE, G, yearByNum } from './gamesData'
import { useGamesStore } from './gamesStore'
import { Chip, Panel } from './ui'
import type { GamesAthleteResult, GamesYearResults } from '../types-games'
import semifinalsData from '../data/games/semifinals-2026.json'
import athletes2026 from '../data/games/athletes-2026.json'

// name -> slug + the 2026 semifinal per-athlete data (online = official c3po per-event,
// in-person = researched/verified per-event where available, else overall finish).
const NAME_TO_SLUG: Record<string, string> = {}
for (const a of [...(athletes2026 as { men: { name: string; slug: string }[] }).men, ...(athletes2026 as { women: { name: string; slug: string }[] }).women]) NAME_TO_SLUG[a.name] = a.slug
type SemiEntry = { event: string | null; official?: boolean; fieldSize?: number | null; overallRank?: number | string; overallFinish?: string | null; perEvent: { n: number; label?: string; score?: string; place: number | null }[]; sourceUrl?: string }
const SEMI_2026 = (semifinalsData as unknown as { athletes: Record<string, SemiEntry> }).athletes

type Division = 'men' | 'women'
type CurveMode = 'power' | 'relative'

const ATHLETE_COLORS = [
  '#91C640', '#f43f5e', '#60a5fa', '#f59e0b', '#a855f7',
  '#14b8a6', '#ec4899', '#eab308', '#06b6d4', '#94a3b8',
]

function parseSeconds(score: string | null): number | null {
  if (!score || /cap/i.test(score) || /lb|reps?/i.test(score)) return null
  const parts = score.trim().split(':').map(parseFloat)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}
const fmtMin = (min: number) => {
  const m = Math.floor(min)
  const s = Math.round((min - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
const ord = (n: number) => {
  const t = n % 100
  return t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
}
const parseLoadLb = (s: string | null): number | null => {
  const m = s?.match(/([\d.]+)\s*lb/i)
  return m ? parseFloat(m[1]) : null
}

function perfCell(perf: number): { bg: string; fg: string } {
  if (perf >= 90) return { bg: 'rgba(1,150,68,0.9)', fg: '#fff' }
  if (perf >= 75) return { bg: 'rgba(16,185,129,0.8)', fg: '#fff' }
  if (perf >= 60) return { bg: 'rgba(145,198,64,0.8)', fg: '#14240a' }
  if (perf >= 45) return { bg: 'rgba(234,179,8,0.8)', fg: '#241c04' }
  if (perf >= 30) return { bg: 'rgba(245,158,11,0.8)', fg: '#261503' }
  return { bg: 'rgba(244,63,94,0.82)', fg: '#fff' }
}

/** Least-squares fit of W = W' + CP*t. Returns CP (W) and W' (kJ). */
function fitCriticalPower(pts: { tSec: number; workKj: number }[]) {
  if (pts.length < 3) return null
  const n = pts.length
  const tBar = pts.reduce((a, p) => a + p.tSec, 0) / n
  const wBar = pts.reduce((a, p) => a + p.workKj, 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p.tSec - tBar) * (p.workKj - wBar)
    den += (p.tSec - tBar) ** 2
  }
  if (den === 0) return null
  const slope = num / den
  const intercept = wBar - slope * tBar
  const cp = slope * 1000
  if (cp <= 0 || intercept <= 0) return null
  return { cp, wPrime: intercept }
}

// The three modal domains of CrossFit, plus loading and the metabolic engine.
const MODAL_BUCKETS: { key: string; label: string; test: (e: CapEvent) => boolean }[] = [
  { key: 'mono', label: 'Metabolic', test: (e) => e.modality.includes('M') },
  { key: 'gym', label: 'Gymnastics', test: (e) => e.modality.includes('G') },
  { key: 'weight', label: 'Weightlifting', test: (e) => e.modality.includes('W') },
  { key: 'heavy', label: 'Heavy', test: (e) => e.loadLevel === 'heavy' || e.loadLevel === 'max' },
  { key: 'light', label: 'Bodyweight', test: (e) => e.loadLevel === 'none' || e.loadLevel === 'light' },
  { key: 'engine', label: 'Long Engine', test: (e) => e.timeDomain === 'long' || e.timeDomain === 'endurance' || e.timeDomain === 'medium' },
]

interface EventPoint {
  eventId: string
  eventName: string
  order: number
  tSec: number | null
  winSec: number | null
  workKj: number | null
  powerW: number | null
  place: number
  points: number
  score: string | null
  rel: number // % of best output (exact where possible)
  isMax: boolean
  eligible: boolean
  underMeasured: boolean
  beyondWindow: boolean
}

interface AthleteRow {
  athlete: GamesAthleteResult
  color: string
  points: EventPoint[]
  perfByEvent: Map<string, EventPoint>
  cp: number | null
  wPrime: number | null
  capacityScore: number // mean % of best output, 0-100 (the headline)
  consistency: number // 100 - sd of rel
  sd: number
  meanPower: number
  maxRel: number | null
  cumPoints: number[] // cumulative points after each event (chronological)
}

interface CapEvent {
  id: string
  order: number
  name: string
  format: string
  modality: string
  loadLevel: string
  timeDomain: string | null
  winningScoreMen: string | null
  winningScoreWomen: string | null
}
interface CapContext {
  events: CapEvent[]
  divisions: { men: GamesAthleteResult[]; women: GamesAthleteResult[] }
  fieldMen: number
  fieldWomen: number
  workModel: GamesYearResults['workModel'] | null
}

function useCapacityModel(ctx: CapContext | null, division: Division) {
  return useMemo(() => {
    if (!ctx) return null
    const field = (division === 'men' ? ctx.fieldMen : ctx.fieldWomen) ?? 30
    const athletes = ctx.divisions[division]
    if (!athletes?.length) return null
    const wm = ctx.workModel ?? null // optional: only 2025 has one so far

    const underMeasured = new Set(wm?.underMeasured ?? [])
    const [fitLo, fitHi] = wm?.cpFitWindowSec ?? [120, 1800]

    // Cohort-derived best score per event (used when a stage has no published winner score)
    const cohortBest = (evId: string): string | null => {
      const at = athletes.find((a) => a.events.find((e) => e.eventId === evId)?.place === 1)
      return at?.events.find((e) => e.eventId === evId)?.score ?? null
    }

    const orderedEvents = [...ctx.events].sort((a, b) => a.order - b.order)
    const eventInfo = new Map(
      orderedEvents.map((ev) => {
        const isMax = ev.format === 'max-load'
        const winning = (division === 'men' ? ev.winningScoreMen : ev.winningScoreWomen) ?? cohortBest(ev.id)
        const winSec = isMax ? null : parseSeconds(winning)
        const w = wm?.events?.[ev.id]
        const workKj = w ? (division === 'men' ? w.workKjMen : w.workKjWomen) : null
        const beyondWindow = winSec != null && (winSec < fitLo || winSec > fitHi)
        const eligible = !isMax && workKj != null && !underMeasured.has(ev.id) && !beyondWindow
        return [ev.id, { ev, isMax, winSec, workKj, beyondWindow, eligible }]
      })
    )
    const maxEvents = orderedEvents.filter((e) => e.format === 'max-load')
    const bestMaxLb = new Map(
      maxEvents.map((m) => [m.id, parseLoadLb((division === 'men' ? m.winningScoreMen : m.winningScoreWomen) ?? cohortBest(m.id))])
    )

    const relOutput = (cell: GamesAthleteResult['events'][number], info: ReturnType<typeof eventInfo.get>): number => {
      if (!info) return ((field - cell.place + 1) / field) * 100
      if (info.isMax) {
        const lb = parseLoadLb(cell.score)
        const best = bestMaxLb.get(cell.eventId)
        return lb && best ? (lb / best) * 100 : ((field - cell.place + 1) / field) * 100
      }
      const tSec = parseSeconds(cell.score)
      if (tSec != null && info.winSec != null) return Math.min(100, (info.winSec / tSec) * 100)
      const capInfo = wm?.capEstimates?.[cell.eventId]
      const m = cell.score?.match(/cap\s*\+\s*(\d+)/i)
      if (capInfo && m && info.winSec != null) {
        const frac = Math.max(0, (capInfo.totalUnits - Number(m[1])) / capInfo.totalUnits)
        const capSec = division === 'men' ? capInfo.capSecMen : capInfo.capSecWomen
        return Math.max(0, Math.min(100, frac * (info.winSec / capSec) * 100))
      }
      return ((field - cell.place + 1) / field) * 100
    }

    const rows: AthleteRow[] = athletes.map((athlete, i) => {
      const color = ATHLETE_COLORS[i % ATHLETE_COLORS.length]
      const points: EventPoint[] = athlete.events.map((cell) => {
        const info = eventInfo.get(cell.eventId)
        const tSec = info && !info.isMax ? parseSeconds(cell.score) : null
        const rel = relOutput(cell, info)
        return {
          eventId: cell.eventId,
          eventName: info?.ev.name ?? cell.eventId,
          order: info?.ev.order ?? 0,
          tSec,
          winSec: info?.winSec ?? null,
          workKj: info?.workKj ?? null,
          powerW: tSec && info?.workKj != null ? Math.round((info.workKj * 1000) / tSec) : null,
          place: cell.place,
          points: cell.points,
          score: cell.score,
          rel: Math.round(rel * 10) / 10,
          isMax: info?.isMax ?? false,
          eligible: info?.eligible ?? false,
          underMeasured: underMeasured.has(cell.eventId),
          beyondWindow: info?.beyondWindow ?? false,
        }
      })
      const perfByEvent = new Map(points.map((p) => [p.eventId, p]))

      const fitPts = points.filter((p) => p.eligible && p.tSec).map((p) => ({ tSec: p.tSec!, workKj: p.workKj! }))
      const fit = fitCriticalPower(fitPts)

      const rels = points.map((p) => p.rel)
      const capacityScore = rels.reduce((a, b) => a + b, 0) / rels.length
      const sd = Math.sqrt(rels.reduce((a, r) => a + (r - capacityScore) ** 2, 0) / rels.length)
      const timedPow = points.filter((p) => p.powerW != null).map((p) => p.powerW!)

      // cumulative points in chronological order
      const cumPoints: number[] = []
      let run = 0
      for (const p of [...points].sort((a, b) => a.order - b.order)) {
        run += p.points
        cumPoints.push(run)
      }

      let maxRel: number | null = null
      for (const m of maxEvents) {
        const cell = athlete.events.find((e) => e.eventId === m.id)
        const lb = parseLoadLb(cell?.score ?? null)
        const best = bestMaxLb.get(m.id)
        if (lb && best) maxRel = (lb / best) * 100
      }

      return {
        athlete,
        color,
        points: [...points].sort((a, b) => (a.tSec ?? 1e9) - (b.tSec ?? 1e9)),
        perfByEvent,
        cp: fit ? Math.round(fit.cp) : null,
        wPrime: fit ? Math.round(fit.wPrime) : null,
        capacityScore: Math.round(capacityScore * 10) / 10,
        consistency: Math.round((100 - sd) * 10) / 10,
        sd: Math.round(sd * 10) / 10,
        meanPower: timedPow.length ? Math.round(timedPow.reduce((a, b) => a + b, 0) / timedPow.length) : 0,
        maxRel,
        cumPoints,
      }
    })

    // Leaderboard sorted by capacity score (the operationalized definition)
    const byCapacity = [...rows].sort((a, b) => b.capacityScore - a.capacityScore)
    const fieldAvg = rows.reduce((a, r) => a + r.capacityScore, 0) / rows.length

    // Does this year have a power-duration (Critical Power) model?
    const hasPowerModel = rows.some((r) => r.cp != null)
    // Whether the Capacity Score is mostly real output vs placement fallback
    const scoredCells = rows.flatMap((r) => r.points).filter((p) => p.tSec != null || p.isMax).length
    const totalCells = rows.flatMap((r) => r.points).length
    const outputBased = totalCells > 0 && scoredCells / totalCells >= 0.6

    // Curve plotting bounds (guard against no eligible events)
    const eligibleWinTimes = [...eventInfo.values()].filter((e) => e.eligible).map((e) => e.winSec!)
    const timedInfo = [...eventInfo.values()].filter((e) => !e.isMax && e.winSec != null).sort((a, b) => a.winSec! - b.winSec!)
    const fallbackLo = timedInfo.length ? timedInfo[0].winSec! : 120
    const fallbackHi = timedInfo.length ? timedInfo[timedInfo.length - 1].winSec! : 1200
    const curveLo = eligibleWinTimes.length ? Math.max(fitLo, Math.min(...eligibleWinTimes) * 0.9) : fallbackLo
    const curveHi = eligibleWinTimes.length ? Math.min(fitHi, Math.max(...eligibleWinTimes) * 1.1) : fallbackHi

    // Modal radar (% of best per domain)
    const radarData = MODAL_BUCKETS.map((b) => {
      const evs = orderedEvents.filter((ev) => b.test(ev))
      const row: Record<string, number | string> = { bucket: b.label, eventCount: evs.length }
      rows.forEach((r) => {
        const vals = evs.map((ev) => r.perfByEvent.get(ev.id)?.rel).filter((v): v is number => v != null)
        if (vals.length) row[r.athlete.name] = Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10
      })
      return row
    }).filter((r) => (r.eventCount as number) > 0)

    const fingerprintCols = [...timedInfo.map((e) => e.ev), ...maxEvents]

    // Scoring direction: modern years are higher-points-better; 2008 (time-sum)
    // and 2009-2010 (rank-sum) are lower-better.
    const byRank = [...rows].sort((a, b) => a.athlete.rank - b.athlete.rank)
    const t0 = byRank[0]?.athlete.totalPoints
    const tN = byRank[byRank.length - 1]?.athlete.totalPoints
    const lowerIsBetter = typeof t0 === 'number' && typeof tN === 'number' && t0 < tN

    // The Race: cumulative position among the eventual top 10 after each event
    const raceRows = orderedEvents.map((ev, k) => {
      const standings = rows
        .map((r) => ({ name: r.athlete.name, cum: r.cumPoints[k] }))
        .sort((a, b) => (lowerIsBetter ? a.cum - b.cum : b.cum - a.cum))
      const row: Record<string, number | string> = { ev: k + 1, eventName: ev.name }
      standings.forEach((s, idx) => {
        row[s.name] = idx + 1
      })
      return row
    })

    // Where the field separated: spread of placement percentile per event
    // (placement-based so it is consistent across all scoring systems and years)
    const decisive = orderedEvents.map((ev) => {
      const perfs = rows.map((r) => {
        const p = r.perfByEvent.get(ev.id)
        return p ? ((field - p.place + 1) / field) * 100 : 0
      })
      const mean = perfs.reduce((a, b) => a + b, 0) / perfs.length
      const spread = Math.sqrt(perfs.reduce((a, p) => a + (p - mean) ** 2, 0) / perfs.length)
      const info = eventInfo.get(ev.id)
      return { ev, spread: Math.round(spread), winSec: info?.winSec ?? null, isMax: info?.isMax ?? false }
    })
    const maxSpread = Math.max(...decisive.map((d) => d.spread), 1)

    // Hopper quadrant bounds
    const capMin = Math.min(...rows.map((r) => r.capacityScore))
    const capMax = Math.max(...rows.map((r) => r.capacityScore))
    const conMin = Math.min(...rows.map((r) => r.consistency))
    const conMax = Math.max(...rows.map((r) => r.consistency))

    const underMeasuredNames = timedInfo.filter((e) => underMeasured.has(e.ev.id)).map((e) => e.ev.name)
    const beyondNames = timedInfo.filter((e) => e.beyondWindow).map((e) => e.ev.name)

    return {
      field, rows, byCapacity, fieldAvg, maxEvents, timedInfo, radarData, fingerprintCols,
      raceRows, decisive, maxSpread, curveLo, curveHi, underMeasuredNames, beyondNames,
      capMin, capMax, conMin, conMax, orderedEvents, hasPowerModel, outputBased,
    }
  }, [ctx, division])
}

type Model = NonNullable<ReturnType<typeof useCapacityModel>>

/** Tiny declining-curve sparkline (the athlete's relative output by duration). */
function Sparkline({ pts, color }: { pts: EventPoint[]; color: string }) {
  const vals = pts.filter((p) => p.tSec).map((p) => p.rel)
  if (vals.length < 2) return null
  const w = 64
  const h = 22
  const max = 100
  const min = Math.min(...vals, 40)
  const step = w / (vals.length - 1)
  const d = vals.map((v, i) => `${i * step},${h - ((v - min) / (max - min)) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {vals.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - ((v - min) / (max - min)) * h} r={1.5} fill={color} />
      ))}
    </svg>
  )
}

function AthleteLegend({ rows, selected, toggle, setSelected }: {
  rows: AthleteRow[]; selected: Set<string>; toggle: (n: string) => void; setSelected: (s: Set<string>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      {rows.map((r) => {
        const on = selected.has(r.athlete.name)
        return (
          <button key={r.athlete.name} onClick={() => toggle(r.athlete.name)}
            className="games-condensed flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold tracking-[0.04em] transition-all"
            style={{ borderColor: on ? r.color : 'var(--panel-border)', background: on ? `${r.color}1a` : 'transparent', color: on ? r.color : 'var(--text-muted)', opacity: on ? 1 : 0.75 }}>
            <span className="w-2 h-2 rounded-full" style={{ background: on ? r.color : 'var(--text-muted)' }} />
            {r.athlete.rank}. {r.athlete.name}
          </button>
        )
      })}
      <span className="mx-1 text-[var(--text-muted)]">·</span>
      <button onClick={() => setSelected(new Set(rows.slice(0, 3).map((r) => r.athlete.name)))} className="games-condensed text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--text-tertiary)] hover:text-[#91C640] px-1.5">Podium</button>
      <button onClick={() => setSelected(new Set(rows.map((r) => r.athlete.name)))} className="games-condensed text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--text-tertiary)] hover:text-[#91C640] px-1.5">All 10</button>
    </div>
  )
}

function SectionTag({ no, kicker, title, right }: { no: string; kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div className="flex items-start gap-3">
        <span className="cap-sec-no text-3xl sm:text-4xl mt-0.5 select-none">{no}</span>
        <div>
          <div className="games-condensed text-[11.5px] uppercase tracking-[0.2em] text-[#91C640] mb-1">{kicker}</div>
          <h2 className="games-display text-2xl sm:text-3xl text-[var(--text-primary)] leading-none">{title}</h2>
        </div>
      </div>
      {right}
    </div>
  )
}

// ----- Head to head -----
function AthletePicker({ value, onChange, color, rows }: { value: string; onChange: (v: string) => void; color: string; rows: AthleteRow[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="games-display text-lg bg-transparent border-b-2 outline-none cursor-pointer text-center max-w-full"
      style={{ borderColor: color, color: 'var(--text-primary)' }}>
      {rows.map((r) => <option key={r.athlete.name} value={r.athlete.name} className="text-sm bg-[var(--panel-bg)] text-[var(--text-primary)]">{r.athlete.name}</option>)}
    </select>
  )
}

function HeadToHead({ model }: { model: Model }) {
  const names = model.rows.map((r) => r.athlete.name)
  const [aName, setAName] = useState(names[0])
  const [bName, setBName] = useState(names[1])
  const A = model.rows.find((r) => r.athlete.name === aName) ?? model.rows[0]
  const B = model.rows.find((r) => r.athlete.name === bName) ?? model.rows[1]

  const perEvent = model.orderedEvents.map((ev) => {
    const a = A.perfByEvent.get(ev.id)
    const b = B.perfByEvent.get(ev.id)
    const winner = !a || !b ? null : a.place < b.place ? 'A' : b.place < a.place ? 'B' : 'tie'
    return { ev, a, b, winner }
  })
  const aWins = perEvent.filter((e) => e.winner === 'A').length
  const bWins = perEvent.filter((e) => e.winner === 'B').length
  const gap = Math.round((A.capacityScore - B.capacityScore) * 10) / 10

  return (
    <Panel>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-5">
        <div className="text-center min-w-0">
          <AthletePicker value={aName} onChange={setAName} color={A.color} rows={model.rows} />
          <div className="mt-2 cap-bignum text-4xl sm:text-5xl">{A.capacityScore.toFixed(1)}</div>
          <div className="games-condensed text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">capacity score</div>
        </div>
        <div className="cap-vs text-base">VS</div>
        <div className="text-center min-w-0">
          <AthletePicker value={bName} onChange={setBName} color={B.color} rows={model.rows} />
          <div className="mt-2 games-display text-4xl sm:text-5xl text-[var(--text-secondary)]">{B.capacityScore.toFixed(1)}</div>
          <div className="games-condensed text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">capacity score</div>
        </div>
      </div>

      <div className="text-center text-[13px] text-[var(--text-secondary)] mb-5 px-2">
        {gap === 0 ? (
          <>Dead even on overall work capacity.</>
        ) : (
          <>
            <span className="font-semibold" style={{ color: gap > 0 ? A.color : B.color }}>{gap > 0 ? A.athlete.name : B.athlete.name}</span>{' '}
            held <span className="font-semibold text-[#91C640]">{Math.abs(gap).toFixed(1)} points</span> more output capacity across the ten tests, and won{' '}
            <span className="font-semibold">{gap > 0 ? aWins : bWins}</span> of {perEvent.length} events head to head
            {(gap > 0 ? A.cp : B.cp) != null && <> on a {(gap > 0 ? A.cp : B.cp)!.toLocaleString()} W engine</>}.
          </>
        )}
      </div>

      {/* event-by-event bars */}
      <div className="space-y-1.5">
        {perEvent.map(({ ev, a, b, winner }) => (
          <div key={ev.id} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-7 text-right font-mono text-[var(--text-muted)]">{a?.place ?? '-'}</span>
            <div className="flex-1 flex justify-end">
              <div className="h-3.5 rounded-l" style={{ width: `${a?.rel ?? 0}%`, background: winner === 'A' ? A.color : `${A.color}66` }} />
            </div>
            <span className="games-condensed uppercase tracking-[0.04em] text-[10.5px] w-28 sm:w-36 text-center truncate text-[var(--text-secondary)]">{ev.name}</span>
            <div className="flex-1 flex justify-start">
              <div className="h-3.5 rounded-r" style={{ width: `${b?.rel ?? 0}%`, background: winner === 'B' ? B.color : `${B.color}66` }} />
            </div>
            <span className="w-7 font-mono text-[var(--text-muted)]">{b?.place ?? '-'}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[10.5px] games-condensed uppercase tracking-[0.1em] text-[var(--text-muted)]">
        <span style={{ color: A.color }}>{A.athlete.name} won {aWins}</span>
        <span>place &middot; % of best output &middot; place</span>
        <span style={{ color: B.color }}>{B.athlete.name} won {bWins}</span>
      </div>
    </Panel>
  )
}

export default function CapacityView() {
  const route = useGamesStore((s) => s.route)
  const navigate = useGamesStore((s) => s.navigate)
  const availableYears = useMemo(() => Object.keys(G.results).map(Number).sort((a, b) => b - a), [])
  const year = route.year && G.results[route.year] ? route.year : availableYears[0] ?? null
  const yearResults = year ? G.results[year] : null

  const stageKeys = yearResults?.stages ? Object.keys(yearResults.stages) : []
  const [division, setDivision] = useState<Division>('men')
  const [mode, setMode] = useState<CurveMode>('power')
  const [stageKey, setStageKey] = useState<string | null>(null)
  const [openScorecard, setOpenScorecard] = useState<string | null>(null)
  const activeStage = stageKeys.length ? (stageKey && yearResults!.stages![stageKey] ? stageKey : stageKeys[0]) : null

  // Build a source-agnostic context: a Games year (raw events + results) or a 2026 stage.
  const ctx: CapContext | null = useMemo(() => {
    if (!yearResults) return null
    if (activeStage && yearResults.stages) {
      const st = yearResults.stages[activeStage]
      return { events: st.events as CapEvent[], divisions: st.divisions, fieldMen: 30, fieldWomen: 30, workModel: null }
    }
    if (!yearResults.divisions) return null
    const yd = year ? yearByNum.get(year) : undefined
    if (!yd) return null
    return {
      events: yd.events as CapEvent[],
      divisions: yearResults.divisions,
      fieldMen: yd.fieldMen ?? 30,
      fieldWomen: yd.fieldWomen ?? 30,
      workModel: yearResults.workModel ?? null,
    }
  }, [yearResults, activeStage, year])

  const periodLabel = activeStage && yearResults?.stages ? `${year} ${yearResults.stages[activeStage].label}` : `${year} Games`

  const model = useCapacityModel(ctx, division)
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set())

  const selectionKey = `${year}-${activeStage ?? ''}-${division}`
  const [lastKey, setLastKey] = useState(selectionKey)
  if (model && (lastKey !== selectionKey || selected.size === 0)) {
    setLastKey(selectionKey)
    setSelectedState(new Set(model.byCapacity.slice(0, 3).map((r) => r.athlete.name)))
  }
  const toggle = (name: string) =>
    setSelectedState((cur) => {
      const next = new Set(cur)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next.size ? next : cur
    })

  if (!yearResults || !model) {
    return (
      <div className="text-center py-24">
        <div className="games-display text-3xl text-[var(--text-primary)] mb-3">Capacity Lab</div>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">Athlete results or the work model for this year are not compiled yet.</p>
      </div>
    )
  }

  // Power-duration curve only exists where a work model does; otherwise the
  // section shows the assumption-free "% of best" output curve.
  const effMode: CurveMode = model.hasPowerModel ? mode : 'relative'
  const selRows = model.rows.filter((r) => selected.has(r.athlete.name))
  const champKing = model.byCapacity[0]
  const allT = model.rows.flatMap((r) => r.points.filter((p) => p.tSec).map((p) => p.tSec! / 60))
  const tMin = allT.length ? Math.min(...allT) : 2
  const tMax = allT.length ? Math.max(...allT) : 46
  const durTicks = [2, 3, 5, 8, 12, 20, 30, 45, 60].filter((t) => t >= tMin * 0.85 && t <= tMax * 1.2)
  const yMax = effMode === 'power' ? Math.ceil(Math.max(1, ...model.rows.flatMap((r) => r.points.map((p) => p.powerW ?? 0))) / 250) * 250 : 100

  const STEPS = 44
  const curve = selRows.map((r) => {
    if (effMode === 'power' && r.cp != null && r.wPrime != null) {
      const line = Array.from({ length: STEPS + 1 }, (_, k) => {
        const t = model.curveLo * Math.pow(model.curveHi / model.curveLo, k / STEPS)
        return { t: t / 60, [r.athlete.name]: Math.round(r.cp! + (r.wPrime! * 1000) / t) }
      })
      return { r, line }
    }
    return { r, line: [] as Record<string, number>[] }
  })

  return (
    <div className="pt-8">
      {/* ===== HERO ===== */}
      <section className="cap-hero p-6 sm:p-8 mb-8 games-rise games-rise-1">
        <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-6 items-center">
          <div>
            <div className="games-condensed text-[12px] uppercase tracking-[0.24em] text-[#91C640] mb-2">The CrossFit Methodology, measured</div>
            <h1 className="games-display text-4xl sm:text-6xl cap-hero-ink leading-[0.9]">
              Work Capacity
            </h1>
            <p className="games-display text-xl sm:text-2xl text-[#91C640] mt-1">Across Broad Time &amp; Modal Domains</p>
            <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed cap-hero-dim">
              CrossFit defines fitness as work capacity across broad time and modal domains, the area under an
              athlete's power-time curve. This lab operationalizes that definition for {activeStage ? `the top 30 of the ${periodLabel}` : `the top 10 of the ${periodLabel}`}:
              a single Capacity Score for overall output, the power-duration curve, the three modal domains, and
              the hopper model of readiness, all from real competition data.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {availableYears.length > 1 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {availableYears.map((y) => (
                    <button key={y} onClick={() => navigate({ view: 'capacity', year: y })}
                      className="games-condensed px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors"
                      style={{ borderColor: y === year ? '#91C640' : 'rgba(244,246,242,0.18)', color: y === year ? '#91C640' : 'rgba(244,246,242,0.7)' }}>{y}</button>
                  ))}
                </div>
              ) : <Chip color="#91C640" outline>{periodLabel} &middot; pilot year</Chip>}
              <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(244,246,242,0.18)' }}>
                {(['men', 'women'] as const).map((d) => (
                  <button key={d} onClick={() => setDivision(d)}
                    className="games-condensed px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors"
                    style={{ background: division === d ? '#019644' : 'transparent', color: division === d ? '#fff' : 'rgba(244,246,242,0.7)' }}>{d}</button>
                ))}
              </div>
            </div>
            {stageKeys.length > 0 && (
              <div className="mt-3 flex items-center gap-1 flex-wrap">
                {stageKeys.map((sk) => {
                  const st = yearResults!.stages![sk]
                  const on = sk === activeStage
                  return (
                    <button key={sk} onClick={() => setStageKey(sk)}
                      className="games-condensed px-3 py-1.5 rounded-lg text-[12px] font-semibold uppercase tracking-[0.08em] border transition-colors"
                      style={{ borderColor: on ? '#91C640' : 'rgba(244,246,242,0.18)', background: on ? 'rgba(145,198,64,0.15)' : 'transparent', color: on ? '#91C640' : 'rgba(244,246,242,0.7)' }}>
                      {st.label}{st.projected ? ' (proj.)' : ''}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Fittest spotlight */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(244,246,242,0.04)', border: '1px solid rgba(145,198,64,0.25)' }}>
            <div className="games-condensed text-[11px] uppercase tracking-[0.18em] text-[#91C640] mb-1">Highest work capacity &middot; {division}</div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="games-display text-2xl sm:text-3xl cap-hero-ink truncate">{champKing.athlete.name}</div>
                <div className="games-condensed text-[12px] uppercase tracking-[0.1em] cap-hero-dim mt-0.5">
                  {activeStage
                    ? `${periodLabel.split(' ').slice(1).join(' ')} rank ${champKing.athlete.officialRank ?? champKing.athlete.rank}`
                    : `finished ${champKing.athlete.rank}${ord(champKing.athlete.rank)} overall`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="cap-bignum text-5xl sm:text-6xl">{champKing.capacityScore.toFixed(1)}</div>
                <div className="games-condensed text-[10.5px] uppercase tracking-[0.14em] cap-hero-dim">capacity score</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { v: champKing.cp != null ? `${champKing.cp.toLocaleString()}` : '-', l: 'CP watts', s: 'engine floor' },
                { v: champKing.wPrime != null ? `${champKing.wPrime}` : '-', l: "W' kJ", s: 'anaerobic' },
                { v: `${champKing.consistency.toFixed(0)}`, l: 'consistency', s: 'hopper' },
              ].map((b) => (
                <div key={b.l} className="rounded-lg py-2" style={{ background: 'rgba(244,246,242,0.04)' }}>
                  <div className="games-display text-xl cap-hero-ink">{b.v}</div>
                  <div className="games-condensed text-[9.5px] uppercase tracking-[0.1em] text-[#91C640]">{b.l}</div>
                  <div className="text-[9px] cap-hero-dim">{b.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {activeStage && yearResults?.stages?.[activeStage]?.projected && (
        <div className="mb-5 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--text-secondary)' }}>
          <span className="games-condensed uppercase tracking-[0.1em] font-semibold text-[var(--accent-amber)]">Projection &middot; </span>
          The field is locked: 30 men and 30 women have qualified. This is 2026 season form, all 7 Open and Quarterfinal
          tests combined and re-based onto the actual qualified field, a data-driven proxy for Games form (each athlete also
          carries their Semifinal route below). It is not a Games result: the Games run July 24-26 at the SAP Center in San
          Jose. Live event-by-event data will replace this as scores are posted.
        </div>
      )}

      {activeStage && yearResults?.stages?.[activeStage]?.projected &&
        model.rows.some((r) => r.athlete.semifinalEvent) && (
        <section className="mb-12">
          <SectionTag no="00" kicker="How the field was set" title="Road to the Games"
            right={<span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right hidden sm:block">Open &rarr; Quarterfinals<br />&rarr; Semifinal route</span>} />
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--panel-border)' }}>
            <div className="grid grid-cols-[2rem_1fr_3rem_3rem_1fr] sm:grid-cols-[2.5rem_1fr_4rem_4rem_1.4fr] gap-2 px-3 py-2 games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]" style={{ background: 'var(--panel-bg-2)' }}>
              <span className="text-center">#</span><span>Athlete</span><span className="text-center">Open</span><span className="text-center">QF</span><span>Semifinal</span>
            </div>
            {[...model.rows].sort((a, b) => a.athlete.rank - b.athlete.rank).map((r, i) => {
              const name = r.athlete.name
              const isOpen = openScorecard === name
              const stageScore = (sk: string) => {
                const st = yearResults?.stages?.[sk]
                if (!st) return [] as { name: string; place: number; score: string }[]
                const row = (st.divisions[division] as GamesAthleteResult[]).find((a) => a.name === name)
                if (!row) return []
                const meta = new Map((st.events as { id: string; name: string }[]).map((e) => [e.id, e.name]))
                return row.events.map((ev) => ({ name: meta.get(ev.eventId) ?? ev.eventId, place: ev.place, score: ev.score }))
              }
              const semi = SEMI_2026[NAME_TO_SLUG[name]]
              return (
                <div key={name} style={{ background: i % 2 ? 'transparent' : 'var(--panel-bg)', borderTop: '1px solid var(--panel-border-subtle)' }}>
                  <button onClick={() => setOpenScorecard(isOpen ? null : name)}
                    className="w-full grid grid-cols-[2rem_1fr_3rem_3rem_1fr] sm:grid-cols-[2.5rem_1fr_4rem_4rem_1.4fr] gap-2 px-3 py-1.5 items-center text-[12px] text-left hover:bg-[var(--panel-bg-hover)] transition-colors">
                    <span className="games-display text-center text-[var(--text-tertiary)]">{r.athlete.rank}</span>
                    <span className="games-condensed font-semibold truncate text-[var(--text-primary)]">{name} <span className="text-[var(--text-muted)] font-normal">{isOpen ? '▾' : '▸'}</span></span>
                    <span className="text-center font-mono text-[var(--text-secondary)]">{r.athlete.openRank ?? '-'}</span>
                    <span className="text-center font-mono text-[var(--text-secondary)]">{r.athlete.qfRank ?? '-'}</span>
                    <span className="truncate text-[var(--text-tertiary)]">
                      <span className="text-[#91C640]">{r.athlete.semifinalFinish ?? ''}</span>{r.athlete.semifinalEvent ? ` ${r.athlete.semifinalEvent}` : ''}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 grid sm:grid-cols-3 gap-3" style={{ background: 'var(--panel-bg-2)' }}>
                      {([['open', 'Open'], ['quarterfinals', 'Quarterfinals']] as const).map(([sk, label]) => (
                        <div key={sk}>
                          <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--accent-blue)] mb-1">{label}</div>
                          {stageScore(sk).map((e, k) => (
                            <div key={k} className="flex items-baseline justify-between gap-2 text-[11px] mb-0.5">
                              <span className="text-[var(--text-secondary)] truncate">{e.name}</span>
                              <span className="shrink-0"><span className="text-[#91C640] games-condensed">{e.place}{ord(e.place)}</span> <span className="text-[var(--text-muted)] font-mono">{e.score}</span></span>
                            </div>
                          ))}
                          <div className="text-[9.5px] text-[var(--text-muted)] mt-0.5">placement within the 30-athlete field</div>
                        </div>
                      ))}
                      <div>
                        <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--accent-amber)] mb-1">Semifinal{semi?.event ? `: ${semi.event}` : ''}</div>
                        {semi && semi.perEvent && semi.perEvent.length ? (
                          <>
                            {semi.perEvent.map((e, k) => (
                              <div key={k} className="flex items-baseline justify-between gap-2 text-[11px] mb-0.5">
                                <span className="text-[var(--text-secondary)] truncate">{e.label || `Event ${e.n}`}</span>
                                <span className="shrink-0"><span className="text-[#91C640] games-condensed">{e.place ?? '-'}{e.place ? ord(e.place) : ''}</span> {e.score ? <span className="text-[var(--text-muted)] font-mono">{e.score}</span> : null}</span>
                              </div>
                            ))}
                            <div className="text-[9.5px] text-[var(--text-muted)] mt-0.5">{semi.fieldSize ? `placement among ${semi.fieldSize}` : 'within this event'}{semi.official === false ? ' · unofficial pending review' : ''}</div>
                          </>
                        ) : (
                          <div className="text-[11px] text-[var(--text-secondary)]">Finished <span className="text-[#91C640]">{semi?.overallFinish ?? r.athlete.semifinalFinish ?? '-'}</span>. Per-event detail not published for this event.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-2 text-[10.5px] text-[var(--text-muted)] games-condensed uppercase tracking-[0.08em]">Tap an athlete for their full 2026 scorecard. # = season-form rank within the qualified field (Open + Quarterfinals, the comparable tests). Semifinals were 11 different events, so they are NOT cross-comparable; shown per athlete for context.</div>
        </section>
      )}

      <AthleteLegend rows={model.rows} selected={selected} toggle={toggle} setSelected={setSelectedState} />

      {/* ===== 01 LEADERBOARD ===== */}
      <section className="mb-12">
        <SectionTag no="01" kicker="Operationalizing the definition" title="The Capacity Leaderboard"
          right={<span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right hidden sm:block">score = mean % of best output<br />across all ten tests</span>} />
        <p className="text-[12.5px] text-[var(--text-secondary)] -mt-2 mb-4 max-w-3xl">
          The Capacity Score is the cleanest one-number answer to "who had more total work capacity": the average
          share of the best output an athlete produced across every event (same work for all finishers, so output
          is exactly the inverse of time). No model, fully comparable. Ranked here against the field average of{' '}
          <span className="text-[#91C640] font-semibold">{model.fieldAvg.toFixed(1)}</span>.
          {!model.outputBased && (
            <span className="text-[var(--accent-amber)]"> For this year the official archive is missing many event scores, so the score falls back to field placement where a time or load was not recorded.</span>
          )}
        </p>
        <div className="space-y-1.5">
          {model.byCapacity.map((r, i) => {
            const w = Math.max(6, ((r.capacityScore - (model.capMin - 3)) / (model.capMax - (model.capMin - 3))) * 100)
            const on = selected.has(r.athlete.name)
            return (
              <div key={r.athlete.name} data-on={on} onClick={() => toggle(r.athlete.name)}
                className="cap-rank-row px-3 py-2" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                <div className="flex items-center gap-3 pr-3">
                  <span className="games-display text-xl w-7 text-center" style={{ color: i < 3 ? r.color : 'var(--text-muted)' }}>{i + 1}</span>
                  <div className="min-w-0">
                    <div className="games-condensed text-[14px] font-semibold leading-tight truncate" style={{ color: r.color }}>{r.athlete.name}</div>
                    <div className="games-condensed text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">finished {r.athlete.rank}{ord(r.athlete.rank)} &middot; {r.athlete.country ?? ''}</div>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <div className="cap-track flex-1">
                    <div className="cap-fill" style={{ width: `${w}%`, background: `linear-gradient(90deg, ${r.color}55, ${r.color})`, animationDelay: `${Math.min(i * 50, 400)}ms` }}>
                      <span className="games-display text-[13px]" style={{ color: '#0c1207' }}>{r.capacityScore.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="opacity-80 shrink-0"><Sparkline pts={r.points} color={r.color} /></div>
                </div>
                <div className="flex items-center gap-4 pl-3 font-mono text-[11px] text-[var(--text-tertiary)]">
                  <span className="sm:hidden games-display text-base" style={{ color: r.color }}>{r.capacityScore.toFixed(1)}</span>
                  <span className="hidden md:block w-20 text-right">{r.cp != null ? `CP ${r.cp.toLocaleString()}W` : 'fit n/a'}</span>
                  <span className="hidden lg:block w-16 text-right">{r.wPrime != null ? `W' ${r.wPrime}` : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ===== 02 HEAD TO HEAD ===== */}
      <section className="mb-12">
        <SectionTag no="02" kicker="Compare any two athletes" title="Head to Head" />
        <HeadToHead model={model} />
      </section>

      {/* ===== 03 POWER-DURATION CURVE ===== */}
      <section className="mb-12">
        <SectionTag no="03" kicker="Across broad time domains" title={effMode === 'power' ? 'The Power-Duration Curve' : 'The Output Curve'}
          right={
            model.hasPowerModel ? (
              <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
                {([{ m: 'power' as const, label: 'Power-duration' }, { m: 'relative' as const, label: '% of best' }]).map(({ m, label }) => (
                  <button key={m} onClick={() => setMode(m)} className="games-condensed px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] transition-colors"
                    style={{ background: mode === m ? 'rgba(145,198,64,0.15)' : 'transparent', color: mode === m ? '#91C640' : 'var(--text-secondary)' }}>{label}</button>
                ))}
              </div>
            ) : (
              <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right hidden sm:block">output = winning time<br />over athlete time</span>
            )
          } />
        <p className="text-[12.5px] text-[var(--text-secondary)] -mt-2 mb-4 max-w-3xl">
          {effMode === 'power' ? (
            <>The canonical CrossFit curve. Each athlete's fitted Critical Power model, P(t) = CP + W'/t: output
              falls as the effort lengthens, flattening toward CP, the oxidative engine floor. The shaded bands
              are the metabolic pathways the time domains tax. Dots are real events (solid = fit; hollow = shown
              but not fit). Metabolic-equivalent watts, so shape and area, not the absolute number, are the point.</>
          ) : (
            <>The assumption-free view: the share of the event-winning output each athlete sustained at the duration
              they worked. Flat and high across the whole spectrum is the definition of fittest.</>
          )}
        </p>
        <Panel>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart margin={{ top: 12, right: 24, bottom: 8, left: -4 }}>
              {effMode === 'power' && (
                <>
                  <ReferenceArea x1={tMin * 0.9} x2={2} y1={0} y2={yMax} fill="#f43f5e" fillOpacity={0.05} />
                  <ReferenceArea x1={2} x2={8} y1={0} y2={yMax} fill="#f59e0b" fillOpacity={0.045} />
                  <ReferenceArea x1={8} x2={tMax * 1.1} y1={0} y2={yMax} fill="#60a5fa" fillOpacity={0.05} />
                </>
              )}
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" scale="log" domain={[tMin * 0.9, tMax * 1.1]} ticks={durTicks}
                tickFormatter={(v: number) => `${v}m`} tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} stroke="var(--chart-grid)" allowDuplicatedCategory={false} />
              <YAxis domain={[0, yMax]} tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} stroke="var(--chart-grid)"
                tickFormatter={(v: number) => (effMode === 'power' ? `${v}` : `${v}%`)}
                label={effMode === 'power' ? { value: 'W (metabolic)', angle: -90, position: 'insideLeft', fill: 'var(--chart-axis)', fontSize: 10, offset: 16 } : undefined} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value, name) => [effMode === 'power' ? `~${Number(value).toLocaleString()} W` : `${value}%`, String(name)]}
                labelFormatter={(v) => fmtMin(Number(v))} />
              {effMode === 'power' && curve.map(({ r, line }) => line.length ? (
                <Line key={`fit-${r.athlete.name}`} data={line} dataKey={r.athlete.name} name={r.athlete.name} type="monotone"
                  stroke={r.color} strokeWidth={r.athlete.rank === 1 ? 3 : 2} dot={false} connectNulls isAnimationActive={false} />
              ) : null)}
              {effMode === 'relative' && selRows.map((r) => (
                <Line key={`rel-${r.athlete.name}`} data={r.points.filter((p) => p.tSec).map((p) => ({ t: p.tSec! / 60, [r.athlete.name]: p.rel }))}
                  dataKey={r.athlete.name} name={r.athlete.name} type="monotone" stroke={r.color} strokeWidth={r.athlete.rank === 1 ? 3 : 2}
                  dot={{ r: 3, fill: r.color, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
              ))}
              {effMode === 'power' && selRows.map((r) => (
                <Scatter key={`dots-${r.athlete.name}`} name={r.athlete.name} isAnimationActive={false}
                  data={r.points.filter((p) => p.powerW != null).map((p) => ({ t: p.tSec! / 60, [r.athlete.name]: p.powerW, _p: p }))}
                  dataKey={r.athlete.name}
                  shape={(props: { cx?: number; cy?: number; payload?: { _p: EventPoint } }) => {
                    const { cx, cy, payload } = props
                    if (cx == null || cy == null || !payload) return <g />
                    const p = payload._p
                    return <circle cx={cx} cy={cy} r={r.athlete.rank === 1 ? 5 : 4} fill={p.eligible ? r.color : 'var(--panel-bg)'} stroke={r.color} strokeWidth={p.eligible ? 0 : 1.8} strokeDasharray={p.beyondWindow ? '2 1.5' : undefined} />
                  }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          {effMode === 'power' && (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10.5px]">
              <span className="cap-energy-band" style={{ color: '#f43f5e' }}>&lt;2 min &middot; phosphagen / glycolytic</span>
              <span className="cap-energy-band" style={{ color: 'var(--accent-amber)' }}>2-8 min &middot; glycolytic / oxidative</span>
              <span className="cap-energy-band" style={{ color: '#60a5fa' }}>&gt;8 min &middot; oxidative engine</span>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-[var(--panel-border-subtle)] flex flex-wrap gap-x-4 gap-y-1.5">
            {model.timedInfo.map((m) => (
              <span key={m.ev.id} className="text-[11px] text-[var(--text-muted)]">
                <span className="font-mono text-[#91C640]">{fmtMin(m.winSec! / 60)}</span> {m.ev.name}{!m.eligible && <span className="text-[var(--accent-amber)]"> *</span>}
              </span>
            ))}
          </div>
          {effMode === 'power' && (
            <div className="mt-2 text-[10.5px] leading-relaxed text-[var(--text-muted)]">
              <span className="text-[var(--accent-amber)]">*</span> Hollow dots shown but excluded from the fit:{' '}
              {model.underMeasuredNames.length > 0 && <>skill/grip-limited ({model.underMeasuredNames.join(', ')})</>}
              {model.beyondNames.length > 0 && <> and beyond the 2-20 min model window ({model.beyondNames.join(', ')})</>}.
            </div>
          )}
        </Panel>
      </section>

      {/* ===== 04 THE RACE ===== */}
      <section className="mb-12">
        <SectionTag no="04" kicker="The story of the competition" title="The Race for the Podium"
          right={<span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right hidden sm:block">position among the eventual<br />top 10, after each event</span>} />
        <p className="text-[12.5px] text-[var(--text-secondary)] -mt-2 mb-4 max-w-3xl">
          Cumulative standing among these ten athletes after every event. Lines that climb are charges; crossings
          are lead changes. It shows where the work capacity actually converted into the result.
        </p>
        <Panel>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={model.raceRows} margin={{ top: 12, right: 16, bottom: 4, left: -18 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="ev" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} stroke="var(--chart-grid)" tickFormatter={(v) => `E${v}`} />
              <YAxis reversed domain={[1, model.rows.length]} ticks={Array.from({ length: model.rows.length }, (_, i) => i + 1)}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} stroke="var(--chart-grid)" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={(v) => `After event ${v}`} formatter={(value, name) => [`position ${value}`, String(name)]} />
              {model.rows.map((r) => {
                const on = selected.has(r.athlete.name)
                return (
                  <Line key={r.athlete.name} dataKey={r.athlete.name} type="monotone" stroke={r.color}
                    strokeWidth={on ? (r.athlete.rank === 1 ? 3 : 2.4) : 1} strokeOpacity={on ? 1 : 0.18}
                    dot={on ? { r: 2.5, fill: r.color, strokeWidth: 0 } : false} isAnimationActive={false} />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 text-[10.5px] text-[var(--text-muted)] games-condensed uppercase tracking-[0.08em]">Top of the chart = leading. Faded lines are unselected athletes.</div>
        </Panel>
      </section>

      {/* ===== 05 MODAL DOMAINS + HOPPER ===== */}
      <section className="mb-12 grid lg:grid-cols-2 gap-5">
        <div>
          <SectionTag no="05" kicker="The three modal domains" title="Modal Profile" />
          <Panel>
            <ResponsiveContainer width="100%" height={330}>
              <RadarChart data={model.radarData} outerRadius="70%">
                <PolarGrid stroke="var(--chart-grid)" />
                <PolarAngleAxis dataKey="bucket" tick={{ fill: 'var(--chart-axis)', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'var(--chart-axis)', fontSize: 9 }} stroke="var(--chart-grid)" />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value, name) => [`${value}% of best`, String(name)]} />
                {selRows.map((r) => (
                  <Radar key={r.athlete.name} name={r.athlete.name} dataKey={r.athlete.name} stroke={r.color} fill={r.color} fillOpacity={0.08} strokeWidth={2} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Metabolic (M), Gymnastics (G), Weightlifting (W), plus loading and engine bands. Output relative to the best in each domain.</p>
          </Panel>
        </div>
        <div>
          <SectionTag no="06" kicker="The hopper model of readiness" title="Capacity vs Consistency" />
          <Panel>
            <HopperQuadrant model={model} selected={selected} />
            <p className="text-[11px] text-[var(--text-muted)] mt-3">
              CrossFit's hopper: the fittest athlete is ready for any task drawn at random. Right = more output,
              up = more even across tasks. The top-right quadrant is the complete athlete.
            </p>
          </Panel>
        </div>
      </section>

      {/* ===== 07 DECISIVE EVENTS ===== */}
      <section className="mb-12">
        <SectionTag no="07" kicker="Where the field separated" title="The Decisive Tests"
          right={<span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right hidden sm:block">point spread across the top 10<br />wider = more separation</span>} />
        <Panel>
          <div className="space-y-2">
            {model.decisive.map((d) => {
              const w = (d.spread / model.maxSpread) * 100
              const top = d.spread === model.maxSpread
              return (
                <div key={d.ev.id} className="flex items-center gap-3 text-[12px]">
                  <span className="games-condensed uppercase tracking-[0.04em] w-32 sm:w-40 truncate text-[var(--text-secondary)]">{d.ev.name}</span>
                  <span className="font-mono text-[10.5px] text-[var(--text-muted)] w-12 text-right">{d.isMax ? '1RM' : d.winSec ? fmtMin(d.winSec / 60) : ''}</span>
                  <div className="flex-1 h-4 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${w}%`, background: top ? 'linear-gradient(90deg,#f59e0b,#f43f5e)' : `linear-gradient(90deg,#01964466,#019644)` }} />
                  </div>
                  <span className="font-mono text-[11px] text-[var(--text-tertiary)] w-10 text-right">{d.spread}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mt-4 pt-3 border-t border-[var(--panel-border-subtle)]">
            {(() => {
              const top = model.decisive.reduce((a, b) => (b.spread > a.spread ? b : a))
              const flat = model.decisive.reduce((a, b) => (b.spread < a.spread ? b : a))
              return `${top.ev.name} split the field hardest (point spread ${top.spread}), the event that most rewarded a specific capacity. ${flat.ev.name} bunched everyone tightest, a test the whole field could hold.`
            })()}
          </p>
        </Panel>
      </section>

      {/* ===== 08 FINGERPRINT ===== */}
      <section className="mb-12">
        <SectionTag no="08" kicker="Every athlete, every test" title="The Fitness Fingerprint"
          right={<span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right hidden sm:block">cell = placement<br />sprint to endurance to max</span>} />
        <Panel className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: '3px' }}>
            <thead>
              <tr>
                <th className="text-left pr-2 min-w-[150px]" />
                {model.fingerprintCols.map((ev) => {
                  const info = model.timedInfo.find((t) => t.ev.id === ev.id)
                  return (
                    <th key={ev.id} className="pb-1.5 px-0.5 min-w-[52px]">
                      <div className="games-condensed text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[var(--text-tertiary)] leading-tight">{ev.name.length > 14 ? `${ev.name.slice(0, 13)}…` : ev.name}</div>
                      <div className="text-[9.5px] font-mono text-[var(--text-muted)]">{ev.format === 'max-load' ? '1RM' : info ? fmtMin(info.winSec! / 60) : ''}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((r) => (
                <tr key={r.athlete.name}>
                  <td className="pr-2 py-0.5 whitespace-nowrap">
                    <span className="games-condensed text-[12.5px] font-semibold" style={{ color: r.color }}>{r.athlete.rank}. {r.athlete.name}</span>
                  </td>
                  {model.fingerprintCols.map((ev) => {
                    const cell = r.perfByEvent.get(ev.id)
                    const heat = cell ? perfCell(((model.field - cell.place + 1) / model.field) * 100) : null
                    return (
                      <td key={ev.id} className="text-center rounded-md py-1.5 text-[12px] font-semibold"
                        style={{ background: heat?.bg ?? 'var(--panel-bg-2)', color: heat?.fg ?? 'var(--text-muted)' }}
                        title={cell ? `${r.athlete.name}, ${ev.name}: ${cell.place}${cell.score ? ` (${cell.score})` : ''} · ${cell.points} pts` : ''}>
                        {cell ? cell.place : '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>

      {/* Methodology */}
      <div className="text-[11px] leading-relaxed text-[var(--text-muted)] max-w-3xl mb-4 space-y-1.5">
        <p>
          Capacity Score: mean share of best output across all ten events (timed: winning time over athlete time;
          1RM: lift over best lift; capped: completed fraction discounted by the cap). Power-Duration: each event's
          work is estimated in metabolic-equivalent kJ; the Critical Power model W = W' + CP x t is fit to the
          engine-limited events in the 2-20 min window. Capacity, modal, hopper, and decisive analyses follow the
          CrossFit definition of fitness as work capacity across broad time and modal domains.
        </p>
        <p>Results from the official leaderboard, cross-verified against independent reporting. Metabolic-equivalent watts are not bike watts.</p>
      </div>
    </div>
  )
}

// ----- Hopper quadrant (custom SVG/absolute layout) -----
function HopperQuadrant({ model, selected }: { model: Model; selected: Set<string> }) {
  const xLo = model.capMin - 2
  const xHi = model.capMax + 2
  const yLo = model.conMin - 2
  const yHi = model.conMax + 2
  const xMid = model.fieldAvg
  const yMid = model.rows.reduce((a, r) => a + r.consistency, 0) / model.rows.length
  const px = (x: number) => ((x - xLo) / (xHi - xLo)) * 100
  const py = (y: number) => 100 - ((y - yLo) / (yHi - yLo)) * 100
  return (
    <div className="relative w-full" style={{ aspectRatio: '1 / 0.82' }}>
      {/* mid lines */}
      <div className="absolute inset-y-0" style={{ left: `${px(xMid)}%`, borderLeft: '1px dashed var(--panel-border-strong)' }} />
      <div className="absolute inset-x-0" style={{ top: `${py(yMid)}%`, borderTop: '1px dashed var(--panel-border-strong)' }} />
      {/* quadrant labels */}
      <span className="cap-quad-label absolute top-1 right-2 text-[#91C640]">complete athlete</span>
      <span className="cap-quad-label absolute top-1 left-2">consistent, lower output</span>
      <span className="cap-quad-label absolute bottom-1 right-2">high output, spiky</span>
      <span className="cap-quad-label absolute bottom-1 left-2">developing</span>
      {/* dots */}
      {model.rows.map((r) => {
        const on = selected.has(r.athlete.name)
        return (
          <div key={r.athlete.name} className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity"
            style={{ left: `${px(r.capacityScore)}%`, top: `${py(r.consistency)}%`, opacity: on ? 1 : 0.4 }}
            title={`${r.athlete.name}: capacity ${r.capacityScore.toFixed(1)}, consistency ${r.consistency.toFixed(0)}`}>
            <div className="rounded-full border-2 border-[var(--panel-bg)]" style={{ width: on ? 13 : 9, height: on ? 13 : 9, background: r.color }} />
            {on && <span className="games-condensed absolute left-1/2 -translate-x-1/2 top-3.5 whitespace-nowrap text-[10px] font-semibold" style={{ color: r.color }}>{r.athlete.name.split(' ').slice(-1)[0]}</span>}
          </div>
        )
      })}
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">capacity score &rarr;</span>
    </div>
  )
}
