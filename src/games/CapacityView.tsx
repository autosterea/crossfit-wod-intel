import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Line,
  Scatter,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_TOOLTIP_STYLE, G, yearByNum } from './gamesData'
import { useGamesStore } from './gamesStore'
import { Chip, Panel, SectionHeading } from './ui'
import type { GamesAthleteResult, GamesEvent, GamesYearResults } from '../types-games'

type Division = 'men' | 'women'
type CurveMode = 'power' | 'relative'

/** Distinct, theme-safe colors for ranks 1-10 (champion = brand green). */
const ATHLETE_COLORS = [
  '#91C640', '#f43f5e', '#60a5fa', '#f59e0b', '#a855f7',
  '#14b8a6', '#ec4899', '#eab308', '#06b6d4', '#94a3b8',
]

/** Parse a leaderboard time ("46:16.00", "2:35") into seconds. */
function parseSeconds(score: string | null): number | null {
  if (!score || /cap/i.test(score) || /lb|reps?/i.test(score)) return null
  const parts = score.trim().split(':').map(parseFloat)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

function fmtMin(min: number): string {
  const m = Math.floor(min)
  const s = Math.round((min - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const perfOf = (place: number, field: number) => ((field - place + 1) / field) * 100

function perfCell(perf: number): { bg: string; fg: string } {
  if (perf >= 90) return { bg: 'rgba(1,150,68,0.9)', fg: '#fff' }
  if (perf >= 75) return { bg: 'rgba(16,185,129,0.8)', fg: '#fff' }
  if (perf >= 60) return { bg: 'rgba(145,198,64,0.8)', fg: '#14240a' }
  if (perf >= 45) return { bg: 'rgba(234,179,8,0.8)', fg: '#241c04' }
  if (perf >= 30) return { bg: 'rgba(245,158,11,0.8)', fg: '#261503' }
  return { bg: 'rgba(244,63,94,0.82)', fg: '#fff' }
}

/** Ordinal suffix for a finishing place. */
const ord = (n: number) => (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th')

interface EventPoint {
  eventId: string
  eventName: string
  tSec: number
  workKj: number
  powerW: number // metabolic-equivalent watts (work / time)
  place: number
  score: string | null
  rel: number // % of winning output (exact)
  eligible: boolean // used in the CP fit
  underMeasured: boolean
  beyondWindow: boolean
}

interface AthleteRow {
  athlete: GamesAthleteResult
  color: string
  points: EventPoint[] // timed events, sorted by tSec
  perfByEvent: Map<string, { place: number; perf: number; score: string | null; points: number }>
  cp: number | null // critical power, W (sustainable asymptote)
  wPrime: number | null // anaerobic work capacity, kJ
  capacityIndex: number | null // area under fitted curve over common window, kJ
  meanPower: number // mean power across eligible events, W (fallback)
  outputSd: number
  maxRel: number | null
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
  const slope = num / den // kJ per s = kW
  const intercept = wBar - slope * tBar // kJ = W'
  const cp = slope * 1000 // W
  if (cp <= 0 || intercept <= 0) return null // degenerate (non-declining)
  return { cp, wPrime: intercept }
}

const MODAL_BUCKETS: { key: string; label: string; test: (e: GamesEvent) => boolean }[] = [
  { key: 'mono', label: 'Mono / Engine', test: (e) => e.modality.includes('M') },
  { key: 'gym', label: 'Gymnastics', test: (e) => e.modality.includes('G') },
  { key: 'weight', label: 'Weightlifting', test: (e) => e.modality.includes('W') },
  { key: 'heavy', label: 'Heavy Days', test: (e) => e.loadLevel === 'heavy' || e.loadLevel === 'max' },
  { key: 'light', label: 'Light / BW', test: (e) => e.loadLevel === 'none' || e.loadLevel === 'light' },
  { key: 'max', label: 'Max Effort', test: (e) => e.format === 'max-load' },
]

const parseLoadLb = (s: string | null): number | null => {
  const m = s?.match(/([\d.]+)\s*lb/i)
  return m ? parseFloat(m[1]) : null
}

// Common window for the comparable Capacity Index (area under the fitted curve).
const IDX_LO = 120
const IDX_HI = 1200

/** Area under P(t) = CP + W'/t from a to b, in kJ. */
function curveAreaKj(cp: number, wPrimeKj: number, a: number, b: number) {
  // ∫(CP + W'·1000/t) dt = CP·(b-a) + W'·1000·ln(b/a)  [Joules] → /1000 kJ
  return (cp * (b - a) + wPrimeKj * 1000 * Math.log(b / a)) / 1000
}

function useCapacityModel(yearResults: GamesYearResults | null, division: Division) {
  return useMemo(() => {
    if (!yearResults) return null
    const yearData = yearByNum.get(yearResults.year)
    if (!yearData) return null
    const field = (division === 'men' ? yearData.fieldMen : yearData.fieldWomen) ?? 30
    const athletes = yearResults.divisions[division]
    if (!athletes?.length) return null
    const wm = yearResults.workModel
    if (!wm) return null

    const underMeasured = new Set(wm.underMeasured ?? [])
    const [fitLo, fitHi] = wm.cpFitWindowSec ?? [120, 1800]

    // Per-event metadata, keyed by event id
    const eventInfo = new Map(
      yearData.events.map((ev) => {
        const isMax = ev.format === 'max-load'
        const winning = division === 'men' ? ev.winningScoreMen : ev.winningScoreWomen
        const winSec = isMax ? null : parseSeconds(winning)
        const w = wm.events[ev.id]
        const workKj = w ? (division === 'men' ? w.workKjMen : w.workKjWomen) : null
        const beyondWindow = winSec != null && (winSec < fitLo || winSec > fitHi)
        const eligible = !isMax && workKj != null && !underMeasured.has(ev.id) && !beyondWindow
        return [ev.id, { ev, isMax, winSec, workKj, beyondWindow, eligible }]
      })
    )

    const maxEvents = yearData.events.filter((e) => e.format === 'max-load')
    const bestMaxLb = new Map(
      maxEvents.map((m) => [m.id, parseLoadLb(division === 'men' ? m.winningScoreMen : m.winningScoreWomen)])
    )

    const rows: AthleteRow[] = athletes.map((athlete, i) => {
      const color = ATHLETE_COLORS[i % ATHLETE_COLORS.length]
      const perfByEvent = new Map(
        athlete.events.map((e) => [e.eventId, { place: e.place, perf: perfOf(e.place, field), score: e.score, points: e.points }])
      )

      const points: EventPoint[] = []
      for (const cell of athlete.events) {
        const info = eventInfo.get(cell.eventId)
        if (!info || info.isMax || info.workKj == null) continue
        const tSec = parseSeconds(cell.score)
        if (tSec == null) continue // capped/unparseable: omit from curve
        const winSec = info.winSec ?? tSec
        points.push({
          eventId: cell.eventId,
          eventName: info.ev.name,
          tSec,
          workKj: info.workKj,
          powerW: Math.round((info.workKj * 1000) / tSec),
          place: cell.place,
          score: cell.score,
          rel: Math.round(((winSec / tSec) * 100) * 10) / 10,
          eligible: info.eligible,
          underMeasured: underMeasured.has(cell.eventId),
          beyondWindow: info.beyondWindow,
        })
      }
      points.sort((a, b) => a.tSec - b.tSec)

      const fitPts = points.filter((p) => p.eligible).map((p) => ({ tSec: p.tSec, workKj: p.workKj }))
      const fit = fitCriticalPower(fitPts)
      const meanPower = points.length ? Math.round(points.reduce((a, p) => a + p.powerW, 0) / points.length) : 0

      // 1RM as % of the best lift in the field
      let maxRel: number | null = null
      for (const m of maxEvents) {
        const cell = athlete.events.find((e) => e.eventId === m.id)
        const lb = parseLoadLb(cell?.score ?? null)
        const best = bestMaxLb.get(m.id)
        if (lb && best) maxRel = (lb / best) * 100
      }

      const rels = [...points.map((p) => p.rel), ...(maxRel != null ? [maxRel] : [])]
      const meanRel = rels.reduce((a, b) => a + b, 0) / (rels.length || 1)
      const outputSd = Math.sqrt(rels.reduce((a, r) => a + (r - meanRel) ** 2, 0) / (rels.length || 1))

      return {
        athlete,
        color,
        points,
        perfByEvent,
        cp: fit ? Math.round(fit.cp) : null,
        wPrime: fit ? Math.round(fit.wPrime) : null,
        capacityIndex: fit ? Math.round(curveAreaKj(fit.cp, fit.wPrime, IDX_LO, IDX_HI)) : null,
        meanPower,
        outputSd,
        maxRel,
      }
    })

    // Fit-window bounds for plotting the smooth curves (use eligible winner times)
    const eligibleWinTimes = [...eventInfo.values()].filter((e) => e.eligible).map((e) => e.winSec!)
    const curveLo = Math.max(fitLo, Math.min(...eligibleWinTimes) * 0.9)
    const curveHi = Math.min(fitHi, Math.max(...eligibleWinTimes) * 1.1)

    // All timed events for axis bounds + event strip
    const timedInfo = [...eventInfo.values()].filter((e) => !e.isMax && e.winSec != null).sort((a, b) => a.winSec! - b.winSec!)

    // Radar (relative, exact) and fingerprint use placement
    const radarData = MODAL_BUCKETS.map((b) => {
      const evs = yearData.events.filter((ev) => b.test(ev))
      const row: Record<string, number | string> = { bucket: b.label, eventCount: evs.length }
      rows.forEach((r) => {
        const vals: number[] = []
        evs.forEach((ev) => {
          if (ev.format === 'max-load') {
            if (r.maxRel != null) vals.push(r.maxRel)
          } else {
            const p = r.points.find((pt) => pt.eventId === ev.id)
            if (p) vals.push(p.rel)
          }
        })
        if (vals.length) row[r.athlete.name] = Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10
      })
      return row
    }).filter((r) => (r.eventCount as number) > 0)

    const fingerprintCols = [...timedInfo.map((e) => e.ev), ...maxEvents]

    const bySd = [...rows].sort((a, b) => a.outputSd - b.outputSd)
    const n = rows.length
    let d2 = 0
    bySd.forEach((r, i) => {
      d2 += (i + 1 - r.athlete.rank) ** 2
    })
    const spearman = n > 1 ? 1 - (6 * d2) / (n * (n * n - 1)) : 0

    const ranked = rows.filter((r) => r.capacityIndex != null).sort((a, b) => b.capacityIndex! - a.capacityIndex!)
    const byIndex = [...ranked, ...rows.filter((r) => r.capacityIndex == null)]

    const underMeasuredNames = timedInfo.filter((e) => underMeasured.has(e.ev.id)).map((e) => e.ev.name)
    const beyondNames = timedInfo.filter((e) => e.beyondWindow).map((e) => e.ev.name)

    return {
      field, rows, maxEvents, timedInfo, radarData, fingerprintCols, bySd, byIndex, spearman,
      curveLo, curveHi, underMeasuredNames, beyondNames,
    }
  }, [yearResults, division])
}

function AthleteLegend({
  rows, selected, toggle, setSelected,
}: {
  rows: AthleteRow[]
  selected: Set<string>
  toggle: (name: string) => void
  setSelected: (s: Set<string>) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      {rows.map((r) => {
        const on = selected.has(r.athlete.name)
        return (
          <button
            key={r.athlete.name}
            onClick={() => toggle(r.athlete.name)}
            className="games-condensed flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold tracking-[0.04em] transition-all"
            style={{
              borderColor: on ? r.color : 'var(--panel-border)',
              background: on ? `${r.color}1a` : 'transparent',
              color: on ? r.color : 'var(--text-muted)',
              opacity: on ? 1 : 0.75,
            }}
          >
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

export default function CapacityView() {
  const route = useGamesStore((s) => s.route)
  const navigate = useGamesStore((s) => s.navigate)

  const availableYears = useMemo(() => Object.keys(G.results).map(Number).sort((a, b) => b - a), [])
  const year = route.year && G.results[route.year] ? route.year : availableYears[0] ?? null
  const yearResults = year ? G.results[year] : null

  const [division, setDivision] = useState<Division>('men')
  const [mode, setMode] = useState<CurveMode>('power')
  const model = useCapacityModel(yearResults ?? null, division)
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set())

  const selectionKey = `${year}-${division}`
  const [lastKey, setLastKey] = useState(selectionKey)
  if (model && (lastKey !== selectionKey || selected.size === 0)) {
    setLastKey(selectionKey)
    setSelectedState(new Set(model.rows.slice(0, 3).map((r) => r.athlete.name)))
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
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          Athlete results or the work model for this year are not compiled yet.
        </p>
      </div>
    )
  }

  const selRows = model.rows.filter((r) => selected.has(r.athlete.name))

  // Build the smooth fitted curve + event-dot series for the chart
  const STEPS = 44
  const curve = selRows.map((r) => {
    if (mode === 'power' && r.cp != null && r.wPrime != null) {
      const line = Array.from({ length: STEPS + 1 }, (_, k) => {
        const t = model.curveLo * Math.pow(model.curveHi / model.curveLo, k / STEPS)
        return { t, p: Math.round(r.cp! + (r.wPrime! * 1000) / t) }
      })
      return { r, line }
    }
    return { r, line: [] as { t: number; p: number }[] }
  })

  const allT = model.rows.flatMap((r) => r.points.map((p) => p.tSec / 60))
  const tMin = Math.min(...allT)
  const tMax = Math.max(...allT)
  const durTicks = [2, 3, 5, 8, 12, 20, 30, 45, 60].filter((t) => t >= tMin * 0.85 && t <= tMax * 1.2)

  const yMax =
    mode === 'power'
      ? Math.ceil(Math.max(...model.rows.flatMap((r) => r.points.map((p) => p.powerW))) / 250) * 250
      : 100

  const indexBest = model.byIndex.find((r) => r.capacityIndex != null) ?? model.rows[0]
  const champion = model.rows[0]

  return (
    <div className="pt-10">
      {/* Header */}
      <div className="mb-8">
        <div className="games-condensed text-[12px] uppercase tracking-[0.2em] text-[#91C640] mb-1">
          "Fitness is increased work capacity across broad time and modal domains" - the curve, drawn from real athletes
        </div>
        <h1 className="games-display text-4xl sm:text-5xl text-[var(--text-primary)]">
          Capacity <span className="text-[#91C640]">Lab</span>
        </h1>
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          CrossFit defines fitness as the area under an athlete's power-time curve, widened across every time and
          modal domain. This is that curve, fit to the top 10 of the {year} Games. Each athlete's events become
          points; the Critical Power model draws the smooth decline through them, from the anaerobic high of a
          {' '}{fmtMin(tMin)} sprint down toward the aerobic floor (CP) they can hold for the long grind. The area
          under the curve is their work capacity. A higher, wider curve is a fitter athlete.
        </p>

        {/* Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {availableYears.length > 1 ? (
            <div className="flex items-center gap-1">
              {availableYears.map((y) => (
                <button key={y} onClick={() => navigate({ view: 'capacity', year: y })}
                  className="games-condensed px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors"
                  style={{ borderColor: y === year ? '#91C640' : 'var(--panel-border)', color: y === year ? '#91C640' : 'var(--text-secondary)' }}>
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <Chip color="#91C640" outline>{year} Games - pilot year</Chip>
          )}
          <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
            {(['men', 'women'] as const).map((d) => (
              <button key={d} onClick={() => setDivision(d)}
                className="games-condensed px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors"
                style={{ background: division === d ? '#019644' : 'transparent', color: division === d ? '#fff' : 'var(--text-secondary)' }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AthleteLegend rows={model.rows} selected={selected} toggle={toggle} setSelected={setSelectedState} />

      {/* 1 - Power-Duration Curve */}
      <section className="mb-12">
        <SectionHeading
          kicker="Across broad time domains"
          title={mode === 'power' ? 'The Power-Duration Curve' : 'The Capacity Curve'}
          right={
            <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
              {([{ m: 'power' as const, label: 'Power-duration' }, { m: 'relative' as const, label: '% of best (exact)' }]).map(({ m, label }) => (
                <button key={m} onClick={() => setMode(m)}
                  className="games-condensed px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] transition-colors"
                  style={{ background: mode === m ? 'rgba(145,198,64,0.15)' : 'transparent', color: mode === m ? '#91C640' : 'var(--text-secondary)' }}>
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <p className="text-[12.5px] text-[var(--text-secondary)] -mt-2 mb-4 max-w-3xl">
          {mode === 'power' ? (
            <>
              The canonical CrossFit curve. The smooth line is each athlete's fitted Critical Power model,
              P(t) = CP + W'/t: power falls as the effort lengthens, flattening toward CP, the power they can
              sustain on the engine alone. Dots are the real events (solid = used in the fit; hollow = shown but
              not fit). The fit uses the 2 to 20 minute window where the model is valid; skill-limited and
              endurance-length events sit off the curve on purpose. Power is metabolic-equivalent, so it is not
              bike watts; the shape and the area, not the absolute number, are the point.
            </>
          ) : (
            <>
              The assumption-free view. Each point is the share of the event-winning output an athlete sustained
              (same work for all finishers, so output is exactly the inverse of time). 100 means they set the best
              output anyone produced at that duration. Flat and high across the whole spectrum is the definition
              of fittest, no model required.
            </>
          )}
        </p>
        <Panel>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart margin={{ top: 12, right: 24, bottom: 8, left: -4 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="t" type="number" scale="log" domain={[tMin * 0.9, tMax * 1.1]}
                ticks={durTicks} tickFormatter={(v: number) => `${v}m`}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} stroke="var(--chart-grid)" allowDuplicatedCategory={false}
              />
              <YAxis
                domain={[0, yMax]} tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} stroke="var(--chart-grid)"
                tickFormatter={(v: number) => (mode === 'power' ? `${v}` : `${v}%`)}
                label={mode === 'power' ? { value: 'W (metabolic)', angle: -90, position: 'insideLeft', fill: 'var(--chart-axis)', fontSize: 10, offset: 16 } : undefined}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value, name) => [mode === 'power' ? `~${Number(value).toLocaleString()} W` : `${value}%`, String(name)]}
                labelFormatter={(v) => `${fmtMin(Number(v))}`}
              />
              {/* Fitted CP curves (power mode only) */}
              {mode === 'power' &&
                curve.map(({ r, line }) =>
                  line.length ? (
                    <Line key={`fit-${r.athlete.name}`} data={line.map((d) => ({ t: d.t / 60, [r.athlete.name]: d.p }))}
                      dataKey={r.athlete.name} name={r.athlete.name} type="monotone" stroke={r.color}
                      strokeWidth={r.athlete.rank === 1 ? 3 : 2} dot={false} connectNulls isAnimationActive={false} />
                  ) : null
                )}
              {/* Relative curves (relative mode) */}
              {mode === 'relative' &&
                selRows.map((r) => (
                  <Line key={`rel-${r.athlete.name}`} data={r.points.map((p) => ({ t: p.tSec / 60, [r.athlete.name]: p.rel }))}
                    dataKey={r.athlete.name} name={r.athlete.name} type="monotone" stroke={r.color}
                    strokeWidth={r.athlete.rank === 1 ? 3 : 2}
                    dot={{ r: r.athlete.rank === 1 ? 4 : 3, fill: r.color, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                ))}
              {/* Event dots (power mode): scatter per athlete */}
              {mode === 'power' &&
                selRows.map((r) => (
                  <Scatter key={`dots-${r.athlete.name}`} name={r.athlete.name}
                    data={r.points.map((p) => ({ t: p.tSec / 60, [r.athlete.name]: p.powerW, _p: p }))}
                    dataKey={r.athlete.name} isAnimationActive={false}
                    shape={(props: { cx?: number; cy?: number; payload?: { _p: EventPoint } }) => {
                      const { cx, cy, payload } = props
                      if (cx == null || cy == null || !payload) return <g />
                      const p = payload._p
                      const off = p.eligible
                      return (
                        <circle cx={cx} cy={cy} r={r.athlete.rank === 1 ? 5 : 4}
                          fill={off ? r.color : 'var(--panel-bg)'} stroke={r.color}
                          strokeWidth={off ? 0 : 1.8} strokeDasharray={p.beyondWindow ? '2 1.5' : undefined} />
                      )
                    }}
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Event strip */}
          <div className="mt-3 pt-3 border-t border-[var(--panel-border-subtle)] flex flex-wrap gap-x-4 gap-y-1.5">
            {model.timedInfo.map((m) => (
              <span key={m.ev.id} className="text-[11px] text-[var(--text-muted)]">
                <span className="font-mono text-[#91C640]">{fmtMin(m.winSec! / 60)}</span> {m.ev.name}
                {!m.eligible && <span className="text-[#f59e0b]"> *</span>}
              </span>
            ))}
          </div>
          {mode === 'power' && (
            <div className="mt-2 text-[10.5px] leading-relaxed text-[var(--text-muted)]">
              <span className="text-[#f59e0b]">*</span> Hollow dots are shown but excluded from the fit:{' '}
              {model.underMeasuredNames.length > 0 && <>skill/grip-limited ({model.underMeasuredNames.join(', ')})</>}
              {model.beyondNames.length > 0 && <> and beyond the 2-20 min model window ({model.beyondNames.join(', ')})</>}.
              Their placements and % of best are unaffected.
            </div>
          )}

          {/* Max-strength lane */}
          {model.maxEvents.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--panel-border-subtle)]">
              <div className="games-condensed uppercase tracking-[0.12em] text-[11px] font-semibold text-[var(--text-muted)] mb-3">
                Outside the curve: peak strength ({model.maxEvents.map((m) => m.name).join(', ')})
              </div>
              {model.maxEvents.map((m) => (
                <div key={m.id} className="relative h-10 rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border-subtle)]">
                  {selRows.map((r) => {
                    const cell = r.athlete.events.find((e) => e.eventId === m.id)
                    if (!cell || r.maxRel == null) return null
                    return (
                      <div key={r.athlete.name} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                        style={{ left: `${6 + (Math.max(r.maxRel, 60) - 60) * (88 / 40)}%` }}
                        title={`${r.athlete.name}: ${cell.score} (place ${cell.place}, ${r.maxRel.toFixed(0)}% of best lift)`}>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--panel-bg)]" style={{ background: r.color }} />
                        <div className="games-condensed absolute top-4 left-1/2 -translate-x-1/2 text-[9.5px] whitespace-nowrap" style={{ color: r.color }}>{cell.score}</div>
                      </div>
                    )
                  })}
                  <span className="absolute left-2 top-1 text-[10px] text-[var(--text-muted)]">60% of best</span>
                  <span className="absolute right-2 top-1 text-[10px] text-[var(--text-muted)]">best lift</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* 2 - Capacity Index (area under the curve) */}
      <section className="mb-12">
        <SectionHeading
          kicker="The area under the curve"
          title="The Capacity Index"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              work under the fitted curve, 2 to 20 min
              <br />
              CP = engine floor, W' = anaerobic battery
            </span>
          }
        />
        <p className="text-[12.5px] text-[var(--text-secondary)] -mt-2 mb-4 max-w-3xl">
          Integrating each athlete's power-duration curve over a common 2 to 20 minute window gives one
          comparable number: the total work their model says they can do across that band. It rewards both a high
          aerobic floor (CP) and a deep anaerobic battery (W'). This is the area CrossFit's definition points at,
          made literal.
        </p>
        <Panel>
          <div className="space-y-2.5">
            {model.byIndex.map((r, i) => {
              const vals = model.byIndex.map((x) => x.capacityIndex ?? 0)
              const lo = Math.min(...vals.filter((v) => v > 0))
              const hi = Math.max(...vals)
              const ci = r.capacityIndex
              const w = ci != null && hi > lo ? ((ci - lo) / (hi - lo)) * 76 + 20 : 12
              return (
                <div key={r.athlete.name} className="flex items-center gap-3">
                  <span className="games-condensed text-[12px] font-semibold w-6 text-[var(--text-muted)]">#{i + 1}</span>
                  <span className="games-condensed text-[13px] font-semibold w-44 truncate" style={{ color: r.color }}>{r.athlete.name}</span>
                  <div className="flex-1 h-5 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
                    {ci != null && (
                      <div className="h-full rounded-full flex items-center justify-end pr-2" style={{ width: `${w}%`, background: `linear-gradient(90deg, ${r.color}55, ${r.color})` }}>
                        <span className="games-display text-[12px]" style={{ color: '#0c1207' }}>{(ci / 1000).toFixed(1)} MJ</span>
                      </div>
                    )}
                  </div>
                  <span className="hidden sm:block font-mono text-[11px] text-[var(--text-tertiary)] w-20 text-right">{r.cp != null ? `CP ${r.cp.toLocaleString()}W` : 'fit n/a'}</span>
                  <span className="hidden md:block font-mono text-[11px] text-[var(--text-tertiary)] w-20 text-right">{r.wPrime != null ? `W' ${r.wPrime}kJ` : ''}</span>
                  <span className="games-condensed text-[11px] w-20 text-right text-[var(--text-muted)]">finished {r.athlete.rank}{ord(r.athlete.rank)}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-4 pt-3 border-t border-[var(--panel-border-subtle)] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {(() => {
              const agree = indexBest.athlete.rank === 1
              const champIdxRank = model.byIndex.findIndex((r) => r.athlete.name === champion.athlete.name) + 1
              return `${indexBest.athlete.name} has the largest area under the curve${indexBest.cp != null ? ` (CP ${indexBest.cp.toLocaleString()} W, W' ${indexBest.wPrime} kJ)` : ''}${agree ? ', and won the Games, so the model and the leaderboard agree.' : `, but finished ${indexBest.athlete.rank}${ord(indexBest.athlete.rank)}; champion ${champion.athlete.name} ranks ${champIdxRank} on modeled capacity. The 2-20 min window does not include the 1RM or the marathon-length event, which is part of that gap.`} Critical Power is the engine floor an athlete holds once the anaerobic battery is spent; W' is the size of that battery.`
            })()}
          </p>
        </Panel>
      </section>

      {/* 3 - Modal domains */}
      <section className="mb-12">
        <SectionHeading kicker="Across broad modal domains" title="The Modal Profile"
          right={<span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">mean % of best output per domain<br />events count toward every domain they touch</span>} />
        <Panel>
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={model.radarData} outerRadius="72%">
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="bucket" tick={{ fill: 'var(--chart-axis)', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'var(--chart-axis)', fontSize: 9 }} stroke="var(--chart-grid)" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value, name) => [`${value}% of best`, String(name)]} />
              {selRows.map((r) => (
                <Radar key={r.athlete.name} name={r.athlete.name} dataKey={r.athlete.name} stroke={r.color} fill={r.color} fillOpacity={0.08} strokeWidth={2} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {model.radarData.map((r) => (
              <span key={String(r.bucket)} className="text-[11px] text-[var(--text-muted)]">{r.bucket}: <span className="text-[var(--text-tertiary)]">{r.eventCount} events</span></span>
            ))}
          </div>
        </Panel>
      </section>

      {/* 4 - Fingerprint */}
      <section className="mb-12">
        <SectionHeading kicker="Every athlete x every test" title="The Fitness Fingerprint"
          right={<span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">cell = event placement<br />columns ordered sprint to endurance to max</span>} />
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
                    <span className="text-[10px] text-[var(--text-muted)] ml-1.5">{r.athlete.totalPoints} pts</span>
                  </td>
                  {model.fingerprintCols.map((ev) => {
                    const cell = r.perfByEvent.get(ev.id)
                    const heat = cell ? perfCell(cell.perf) : null
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
          <div className="mt-3 flex items-center gap-2 text-[10.5px] text-[var(--text-muted)]">
            <span>worst</span>
            {[15, 35, 50, 65, 80, 95].map((p) => (<span key={p} className="w-6 h-3 rounded-sm inline-block" style={{ background: perfCell(p).bg }} />))}
            <span>best</span>
          </div>
        </Panel>
      </section>

      {/* 5 - Breadth index */}
      <section className="mb-10">
        <SectionHeading kicker="Does breadth win the Games?" title="The Breadth Index"
          right={<span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">sigma of an athlete's relative output<br />lower = more even across all tests</span>} />
        <Panel>
          <div className="space-y-2">
            {model.bySd.map((r, i) => {
              const maxSd = model.bySd[model.bySd.length - 1].outputSd || 1
              return (
                <div key={r.athlete.name} className="flex items-center gap-3">
                  <span className="games-condensed text-[12px] font-semibold w-7 text-[var(--text-muted)]">#{i + 1}</span>
                  <span className="games-condensed text-[13px] font-semibold w-44 truncate" style={{ color: r.color }}>{r.athlete.name}</span>
                  <div className="flex-1 h-4 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(8, 100 - (r.outputSd / maxSd) * 88)}%`, background: `linear-gradient(90deg, ${r.color}66, ${r.color})` }} />
                  </div>
                  <span className="font-mono text-[11.5px] text-[var(--text-tertiary)] w-16 text-right">σ {r.outputSd.toFixed(1)}</span>
                  <span className="games-condensed text-[11px] w-20 text-right text-[var(--text-muted)]">finished {r.athlete.rank}{ord(r.athlete.rank)}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-4 pt-3 border-t border-[var(--panel-border-subtle)] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {(() => {
              const podiumInTop3Breadth = model.bySd.slice(0, 3).filter((r) => r.athlete.rank <= 3).length
              const broadest = model.bySd[0]
              const corr = model.spearman
              const corrText = corr > 0.6 ? `consistency tracked the final leaderboard closely (rho = ${corr.toFixed(2)})` : corr > 0.3 ? `consistency and the final leaderboard were moderately linked (rho = ${corr.toFixed(2)})` : `consistency and final rank told different stories this year (rho = ${corr.toFixed(2)})`
              return `${broadest.athlete.name} was the most even across every test, including the 1RM (sigma ${broadest.outputSd.toFixed(1)})${broadest.athlete.rank === 1 ? ', and won.' : `, finishing ${broadest.athlete.rank}${ord(broadest.athlete.rank)}.`} ${podiumInTop3Breadth} of the 3 most consistent athletes made the podium, and ${corrText}.`
            })()}
          </p>
        </Panel>
      </section>

      {/* Methodology */}
      <div className="text-[11px] leading-relaxed text-[var(--text-muted)] max-w-3xl mb-4 space-y-1.5">
        <p>
          Method: each event's total work is estimated in metabolic-equivalent kJ (external mechanical work for
          lifts and gymnastics at 20% efficiency, 1 kcal/kg/km running, machine calories, rowing 70/60 J/m;
          reference body mass 195/145 lb). For each athlete, an event becomes a (time, work) point; the Critical
          Power model W = W' + CP x t is fit by least squares to the events in the 2 to 20 minute window that are
          engine-limited (skill/grip events and the marathon-length piece are shown but excluded). The fitted
          curve P(t) = CP + W'/t is the canonical power-duration curve; the Capacity Index is the area under it
          from 2 to 20 minutes. Within an event all finishers do the same work, so the comparison is exact; the
          absolute kJ are estimates, and the metabolic-equivalent watts are not bike watts.
        </p>
        <p>
          The % of best view needs no model: it is the winning time over the athlete's time. Placements, points,
          and finishes are from the official leaderboard, cross-verified against independent reporting.
        </p>
      </div>
    </div>
  )
}
