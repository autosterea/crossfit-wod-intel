import { useMemo, useState } from 'react'
import {
  Line,
  LineChart,
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
type OutputMode = 'relative' | 'watts'

/** Distinct, theme-safe colors for ranks 1-10 (champion = brand green). */
const ATHLETE_COLORS = [
  '#91C640', '#f43f5e', '#60a5fa', '#f59e0b', '#a855f7',
  '#14b8a6', '#ec4899', '#eab308', '#06b6d4', '#94a3b8',
]

/** Parse a leaderboard time ("46:16.00", "2:35", "1:02:10") into seconds. */
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

/** Percentile within the full field: 1st = 100, last = lowest. */
const perfOf = (place: number, field: number) => ((field - place + 1) / field) * 100

/** Heat colors for the fingerprint cells: rose to amber to green. */
function perfCell(perf: number): { bg: string; fg: string } {
  if (perf >= 90) return { bg: 'rgba(1,150,68,0.9)', fg: '#fff' }
  if (perf >= 75) return { bg: 'rgba(16,185,129,0.8)', fg: '#fff' }
  if (perf >= 60) return { bg: 'rgba(145,198,64,0.8)', fg: '#14240a' }
  if (perf >= 45) return { bg: 'rgba(234,179,8,0.8)', fg: '#241c04' }
  if (perf >= 30) return { bg: 'rgba(245,158,11,0.8)', fg: '#261503' }
  return { bg: 'rgba(244,63,94,0.82)', fg: '#fff' }
}

interface EventMeta {
  ev: GamesEvent
  isMax: boolean
  winSec: number | null
  workKj: number | null
}

interface AthletePoint {
  t: number // athlete's own time, minutes
  rel: number // % of winning output (exact)
  watts: number | null // modeled metabolic watts
  eventId: string
  eventName: string
  athleteName: string
  rank: number
  place: number
  score: string | null
  capped: boolean
  underMeasured: boolean // absolute watts under-count this event
}

interface AthleteRow {
  athlete: GamesAthleteResult
  color: string
  points: AthletePoint[] // timed events, sorted by t
  perfByEvent: Map<string, { place: number; perf: number; score: string | null; points: number }>
  capacityIndex: number // log-time-weighted mean of rel (0-100)
  avgWatts: number | null
  totalWorkMJ: number | null
  totalTimeMin: number
  outputSd: number // sd of rel across timed events (+1RM rel)
  maxRel: number | null // 1RM as % of event-best load
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

function useCapacityModel(yearResults: GamesYearResults | null, division: Division) {
  return useMemo(() => {
    if (!yearResults) return null
    const yearData = yearByNum.get(yearResults.year)
    if (!yearData) return null
    const field = (division === 'men' ? yearData.fieldMen : yearData.fieldWomen) ?? 30
    const athletes = yearResults.divisions[division]
    if (!athletes?.length) return null
    const wm = yearResults.workModel

    const eventMeta: EventMeta[] = yearData.events.map((ev) => {
      const isMax = ev.format === 'max-load'
      const winning = division === 'men' ? ev.winningScoreMen : ev.winningScoreWomen
      const w = wm?.events?.[ev.id]
      return {
        ev,
        isMax,
        winSec: isMax ? null : parseSeconds(winning),
        workKj: w ? (division === 'men' ? w.workKjMen : w.workKjWomen) : null,
      }
    })
    const timed = eventMeta.filter((m) => !m.isMax && m.winSec != null)
    const maxEvents = eventMeta.filter((m) => m.isMax)
    const underMeasured = new Set(wm?.underMeasured ?? [])
    const bestMaxLb = new Map(
      maxEvents.map((m) => [
        m.ev.id,
        parseLoadLb(division === 'men' ? m.ev.winningScoreMen : m.ev.winningScoreWomen),
      ])
    )

    const rows: AthleteRow[] = athletes.map((athlete, i) => {
      const color = ATHLETE_COLORS[i % ATHLETE_COLORS.length]
      const perfByEvent = new Map(
        athlete.events.map((e) => [e.eventId, { place: e.place, perf: perfOf(e.place, field), score: e.score, points: e.points }])
      )

      const points: AthletePoint[] = []
      let workSum = 0
      let timeSum = 0
      let haveAllWork = true

      for (const m of timed) {
        const cell = athlete.events.find((e) => e.eventId === m.ev.id)
        if (!cell) continue
        let tSec = parseSeconds(cell.score)
        let frac = 1
        let capped = false
        if (tSec == null) {
          // Capped or unparseable: use the estimated cap and completed fraction
          const capInfo = wm?.capEstimates?.[m.ev.id]
          const remaining = cell.score?.match(/cap\s*\+\s*(\d+)/i)
          if (capInfo && remaining) {
            tSec = division === 'men' ? capInfo.capSecMen : capInfo.capSecWomen
            frac = Math.max(0.1, (capInfo.totalUnits - Number(remaining[1])) / capInfo.totalUnits)
            capped = true
          } else {
            continue // no usable time: point excluded
          }
        }
        const rel = ((m.winSec! / tSec) * frac) * 100
        const watts = m.workKj != null ? (m.workKj * 1000 * frac) / tSec : null
        if (m.workKj != null) {
          workSum += m.workKj * frac
          timeSum += tSec
        } else {
          haveAllWork = false
        }
        points.push({
          t: tSec / 60,
          rel: Math.round(rel * 10) / 10,
          watts: watts != null ? Math.round(watts) : null,
          eventId: m.ev.id,
          eventName: m.ev.name,
          athleteName: athlete.name,
          rank: athlete.rank,
          place: cell.place,
          score: cell.score,
          capped,
          underMeasured: underMeasured.has(m.ev.id),
        })
      }
      points.sort((a, b) => a.t - b.t)

      // Capacity Index: area under the relative-output curve over log10(time),
      // divided by the log-time span = log-time-weighted mean % of best output.
      let auc = 0
      for (let k = 1; k < points.length; k++) {
        const dx = Math.log10(points[k].t) - Math.log10(points[k - 1].t)
        auc += ((points[k].rel + points[k - 1].rel) / 2) * dx
      }
      const span = points.length > 1 ? Math.log10(points[points.length - 1].t) - Math.log10(points[0].t) : 1
      const capacityIndex = points.length > 1 ? auc / span : points[0]?.rel ?? 0

      // 1RM as % of the best lift in the field
      let maxRel: number | null = null
      for (const m of maxEvents) {
        const cell = athlete.events.find((e) => e.eventId === m.ev.id)
        const lb = parseLoadLb(cell?.score ?? null)
        const best = bestMaxLb.get(m.ev.id)
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
        capacityIndex: Math.round(capacityIndex * 10) / 10,
        avgWatts: haveAllWork && timeSum > 0 ? Math.round((workSum * 1000) / timeSum) : null,
        totalWorkMJ: haveAllWork ? Math.round((workSum / 1000) * 100) / 100 : null,
        totalTimeMin: Math.round((timeSum / 60) * 10) / 10,
        outputSd,
        maxRel,
      }
    })

    // Modal radar: mean relative output per domain (exact within timed events;
    // max-effort domain uses % of best lift)
    const radarData = MODAL_BUCKETS.map((b) => {
      const evs = eventMeta.filter((m) => b.test(m.ev))
      const row: Record<string, number | string> = { bucket: b.label, eventCount: evs.length }
      rows.forEach((r) => {
        const vals: number[] = []
        evs.forEach((m) => {
          if (m.isMax) {
            if (r.maxRel != null) vals.push(r.maxRel)
          } else {
            const p = r.points.find((pt) => pt.eventId === m.ev.id)
            if (p) vals.push(p.rel)
          }
        })
        if (vals.length) row[r.athlete.name] = Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10
      })
      return row
    }).filter((r) => (r.eventCount as number) > 0)

    // Fingerprint columns: timed events by winner duration, then max events
    const fingerprintCols = [...timed].sort((a, b) => a.winSec! - b.winSec!).concat(maxEvents)

    // Breadth (output sd) vs final rank, Spearman
    const bySd = [...rows].sort((a, b) => a.outputSd - b.outputSd)
    const n = rows.length
    let d2 = 0
    bySd.forEach((r, i) => {
      d2 += (i + 1 - r.athlete.rank) ** 2
    })
    const spearman = n > 1 ? 1 - (6 * d2) / (n * (n * n - 1)) : 0

    const byIndex = [...rows].sort((a, b) => b.capacityIndex - a.capacityIndex)
    const underMeasuredNames = timed.filter((m) => underMeasured.has(m.ev.id)).map((m) => m.ev.name)

    return { field, rows, timed, maxEvents, radarData, fingerprintCols, bySd, byIndex, spearman, underMeasuredNames, hasWork: rows.some((r) => r.avgWatts != null) }
  }, [yearResults, division])
}

function AthleteLegend({
  rows,
  selected,
  toggle,
  setSelected,
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
      <button
        onClick={() => setSelected(new Set(rows.slice(0, 3).map((r) => r.athlete.name)))}
        className="games-condensed text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--text-tertiary)] hover:text-[#91C640] px-1.5"
      >
        Podium
      </button>
      <button
        onClick={() => setSelected(new Set(rows.map((r) => r.athlete.name)))}
        className="games-condensed text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--text-tertiary)] hover:text-[#91C640] px-1.5"
      >
        All 10
      </button>
    </div>
  )
}

function CurveTooltip({ active, payload, mode }: { active?: boolean; payload?: { payload: AthletePoint }[]; mode: OutputMode }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={CHART_TOOLTIP_STYLE} className="px-3 py-2">
      <div className="font-semibold text-[var(--text-primary)] text-[12px]">
        #{p.rank} {p.athleteName}
      </div>
      <div className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
        {p.eventName} · {p.capped ? `capped (${p.score})` : p.score} · placed {p.place}
      </div>
      <div className="text-[11.5px] mt-1" style={{ color: '#91C640' }}>
        {mode === 'relative'
          ? `${p.rel}% of winning output`
          : p.watts != null
            ? `~${p.watts.toLocaleString()} W output (modeled)`
            : 'no work model'}
        {p.capped ? ' · estimate' : ''}
      </div>
      {mode === 'watts' && p.underMeasured && (
        <div className="text-[10.5px] mt-1 text-[#f59e0b]">absolute output under-measured (high-turnover gymnastics/rope)</div>
      )}
    </div>
  )
}

export default function CapacityView() {
  const route = useGamesStore((s) => s.route)
  const navigate = useGamesStore((s) => s.navigate)

  const availableYears = useMemo(
    () => Object.keys(G.results).map(Number).sort((a, b) => b - a),
    []
  )
  const year = route.year && G.results[route.year] ? route.year : availableYears[0] ?? null
  const yearResults = year ? G.results[year] : null

  const [division, setDivision] = useState<Division>('men')
  const [mode, setMode] = useState<OutputMode>('relative')
  const model = useCapacityModel(yearResults ?? null, division)
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set())

  // Default selection: podium (top 3); reset when division/year changes
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
          Athlete-level results haven't been compiled yet. The pilot year is being researched.
        </p>
      </div>
    )
  }

  const selRows = model.rows.filter((r) => selected.has(r.athlete.name))
  const allT = model.rows.flatMap((r) => r.points.map((p) => p.t))
  const tMin = Math.min(...allT)
  const tMax = Math.max(...allT)
  const durTicks = [2, 3, 5, 8, 12, 20, 30, 45, 60].filter((t) => t >= tMin * 0.85 && t <= tMax * 1.2)
  const wattsMax = Math.max(...model.rows.flatMap((r) => r.points.map((p) => p.watts ?? 0)))
  const indexBest = model.byIndex[0]

  return (
    <div className="pt-10">
      {/* Header */}
      <div className="mb-8">
        <div className="games-condensed text-[12px] uppercase tracking-[0.2em] text-[#91C640] mb-1">
          "Fitness is increased work capacity across broad time and modal domains" - measured, for the first time
        </div>
        <h1 className="games-display text-4xl sm:text-5xl text-[var(--text-primary)]">
          Capacity <span className="text-[#91C640]">Lab</span>
        </h1>
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          Within a for-time event, every finisher moves the same load over the same distance: the same work.
          So output is exactly inverse to time, and each athlete's sustained power at every duration can be
          measured, not guessed. The curves below show how hard the top 10 of the {year} Games could push
          from a {fmtMin(tMin)} sprint out to a {fmtMin(tMax)} grind, and the area under each curve collapses
          into one number: the Capacity Index.
        </p>

        {/* Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {availableYears.length > 1 ? (
            <div className="flex items-center gap-1">
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => navigate({ view: 'capacity', year: y })}
                  className="games-condensed px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors"
                  style={{
                    borderColor: y === year ? '#91C640' : 'var(--panel-border)',
                    color: y === year ? '#91C640' : 'var(--text-secondary)',
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <Chip color="#91C640" outline>
              {year} Games - pilot year
            </Chip>
          )}
          <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
            {(['men', 'women'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDivision(d)}
                className="games-condensed px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors"
                style={{
                  background: division === d ? '#019644' : 'transparent',
                  color: division === d ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AthleteLegend rows={model.rows} selected={selected} toggle={toggle} setSelected={setSelectedState} />

      {/* 1 - Output curve */}
      <section className="mb-12">
        <SectionHeading
          kicker="Across broad time domains"
          title="The Output Curve"
          right={
            <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
              {(
                [
                  { m: 'relative' as const, label: '% of best (exact)' },
                  { m: 'watts' as const, label: 'Watts (modeled)' },
                ]
              ).map(({ m, label }) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="games-condensed px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] transition-colors"
                  style={{
                    background: mode === m ? 'rgba(145,198,64,0.15)' : 'transparent',
                    color: mode === m ? '#91C640' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <p className="text-[12.5px] text-[var(--text-secondary)] -mt-2 mb-4 max-w-3xl">
          {mode === 'relative' ? (
            <>
              Each point: the share of the event-winning output an athlete sustained, at the duration they
              personally worked. Exact (same work, so output ratio = inverse time ratio). 100 = they set the
              best output anyone produced at that duration.
            </>
          ) : (
            <>
              Each point: estimated absolute output in metabolic watts, from a per-event work model (loads x
              distances, running energy cost, machine calories). This is not the textbook power-duration decay:
              that only holds within one modality. Across mixed events the line dips and climbs, because a long
              run or row demands high sustained power while a short gymnastics or grip event produces little
              external work. The shape is the point, the sport refuses to let any one quality carry you. Within
              an event, athlete comparisons are exact; absolute levels are estimates.
            </>
          )}
        </p>
        <Panel>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart margin={{ top: 12, right: 24, bottom: 8, left: -4 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                scale="log"
                domain={[tMin * 0.92, tMax * 1.08]}
                ticks={durTicks}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                tickFormatter={(v: number) => `${v}m`}
                stroke="var(--chart-grid)"
                allowDuplicatedCategory={false}
              />
              <YAxis
                domain={mode === 'relative' ? [0, 100] : [0, Math.ceil(wattsMax / 250) * 250]}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                stroke="var(--chart-grid)"
                tickFormatter={(v: number) => (mode === 'relative' ? `${v}%` : `${v}`)}
                label={
                  mode === 'watts'
                    ? { value: 'W', position: 'insideTopLeft', fill: 'var(--chart-axis)', fontSize: 11, offset: 8 }
                    : undefined
                }
              />
              <Tooltip content={<CurveTooltip mode={mode} />} />
              {selRows.map((r) => (
                <Line
                  key={`${r.athlete.name}-${mode}`}
                  data={r.points}
                  dataKey={mode === 'relative' ? 'rel' : 'watts'}
                  name={r.athlete.name}
                  type="monotone"
                  stroke={r.color}
                  strokeWidth={r.athlete.rank === 1 ? 3 : 2}
                  dot={({ cx, cy, payload, index }) => {
                    if (cx == null || cy == null) return <g key={`${r.athlete.name}-${index}`} />
                    const flagged = payload.capped || (mode === 'watts' && payload.underMeasured)
                    return (
                      <circle
                        key={`${r.athlete.name}-${index}`}
                        cx={cx}
                        cy={cy}
                        r={r.athlete.rank === 1 ? 4.5 : 3.5}
                        fill={flagged ? 'var(--panel-bg)' : r.color}
                        stroke={mode === 'watts' && payload.underMeasured ? '#f59e0b' : r.color}
                        strokeWidth={flagged ? 2 : 0}
                      />
                    )
                  }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Event strip, ordered by winning duration */}
          <div className="mt-3 pt-3 border-t border-[var(--panel-border-subtle)] flex flex-wrap gap-x-4 gap-y-1.5">
            {[...model.timed]
              .sort((a, b) => a.winSec! - b.winSec!)
              .map((m) => (
                <span key={m.ev.id} className="text-[11px] text-[var(--text-muted)]">
                  <span className="font-mono text-[#91C640]">{fmtMin(m.winSec! / 60)}</span> {m.ev.name}
                </span>
              ))}
            <span className="text-[10.5px] text-[var(--text-muted)]">(winning times; hollow dots = capped, estimated)</span>
          </div>
          {mode === 'watts' && model.underMeasuredNames.length > 0 && (
            <div className="mt-2 text-[10.5px] leading-relaxed" style={{ color: '#f59e0b' }}>
              Amber-ringed points ({model.underMeasuredNames.join(', ')}): absolute watts under-count the real
              effort. The external-work model does not capture high-turnover gymnastics and rope work, so these
              fast, hard events read low in this view. Their % of best (exact mode) and placements are unaffected.
            </div>
          )}

          {/* Max-strength lane */}
          {model.maxEvents.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--panel-border-subtle)]">
              <div className="games-condensed uppercase tracking-[0.12em] text-[11px] font-semibold text-[var(--text-muted)] mb-3">
                Outside the clock: peak strength ({model.maxEvents.map((m) => m.ev.name).join(', ')})
              </div>
              {model.maxEvents.map((m) => (
                <div key={m.ev.id} className="relative h-10 rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border-subtle)]">
                  {selRows.map((r) => {
                    const cell = r.athlete.events.find((e) => e.eventId === m.ev.id)
                    if (!cell || r.maxRel == null) return null
                    return (
                      <div
                        key={r.athlete.name}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                        style={{ left: `${6 + (Math.max(r.maxRel, 60) - 60) * (88 / 40)}%` }}
                        title={`${r.athlete.name}: ${cell.score} (place ${cell.place}, ${r.maxRel.toFixed(0)}% of best lift)`}
                      >
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--panel-bg)]" style={{ background: r.color }} />
                        <div className="games-condensed absolute top-4 left-1/2 -translate-x-1/2 text-[9.5px] whitespace-nowrap" style={{ color: r.color }}>
                          {cell.score}
                        </div>
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

      {/* 2 - The Capacity Number */}
      <section className="mb-12">
        <SectionHeading
          kicker="The area under the curve"
          title="The Capacity Index"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              log-time-weighted mean % of best output
              <br />
              one number per athlete, exact
            </span>
          }
        />
        <p className="text-[12.5px] text-[var(--text-secondary)] -mt-2 mb-4 max-w-3xl">
          Integrating each athlete's relative-output curve across the time spectrum gives a single comparable
          value: the average share of best-possible output they sustained from {fmtMin(tMin)} to {fmtMin(tMax)}.
          An index of 90 means: across every duration tested, this athlete averaged 90% of the best output
          anyone produced.
        </p>
        <Panel>
          <div className="space-y-2.5">
            {model.byIndex.map((r, i) => {
              const minIdx = model.byIndex[model.byIndex.length - 1].capacityIndex
              const maxIdx = model.byIndex[0].capacityIndex
              const w = maxIdx > minIdx ? ((r.capacityIndex - minIdx) / (maxIdx - minIdx)) * 78 + 18 : 96
              return (
                <div key={r.athlete.name} className="flex items-center gap-3">
                  <span className="games-condensed text-[12px] font-semibold w-6 text-[var(--text-muted)]">#{i + 1}</span>
                  <span className="games-condensed text-[13px] font-semibold w-44 truncate" style={{ color: r.color }}>
                    {r.athlete.name}
                  </span>
                  <div className="flex-1 h-5 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${w}%`, background: `linear-gradient(90deg, ${r.color}55, ${r.color})` }}
                    >
                      <span className="games-display text-[13px]" style={{ color: '#0c1207' }}>
                        {r.capacityIndex.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <span className="hidden sm:block font-mono text-[11px] text-[var(--text-tertiary)] w-24 text-right">
                    {r.avgWatts != null ? `~${r.avgWatts.toLocaleString()} W avg` : ''}
                  </span>
                  <span className="hidden md:block font-mono text-[11px] text-[var(--text-tertiary)] w-24 text-right">
                    {r.totalTimeMin > 0 ? `${fmtMin(r.totalTimeMin)} racing` : ''}
                  </span>
                  <span className="games-condensed text-[11px] w-20 text-right text-[var(--text-muted)]">
                    finished {r.athlete.rank}
                    {r.athlete.rank === 1 ? 'st' : r.athlete.rank === 2 ? 'nd' : r.athlete.rank === 3 ? 'rd' : 'th'}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-4 pt-3 border-t border-[var(--panel-border-subtle)] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {(() => {
              const champ = model.rows[0]
              const champIdxRank = model.byIndex.findIndex((r) => r.athlete.rank === 1) + 1
              const agree = indexBest.athlete.rank === 1
              return `Every athlete moved the same load over the same distance in these events, so the same ${champ.totalWorkMJ != null ? `${champ.totalWorkMJ.toFixed(1)} MJ` : 'work'} separates them only by time: who sustained it fastest. ${indexBest.athlete.name} owns the largest area under the curve (${indexBest.capacityIndex.toFixed(1)})${agree ? ' and won the Games, so the definition and the leaderboard agree.' : `, but finished ${indexBest.athlete.rank}; the champion ${champ.athlete.name} ranks ${champIdxRank} on pure time-domain capacity. The gap between the index and the final standings is where strategy, the 1RM event, and per-event point allocation live.`} ${champ.avgWatts != null ? `The champion held about ${champ.avgWatts.toLocaleString()} W across ${fmtMin(champ.totalTimeMin)} of racing.` : ''}`
            })()}
          </p>
        </Panel>
      </section>

      {/* 3 - Modal domains */}
      <section className="mb-12">
        <SectionHeading
          kicker="Across broad modal domains"
          title="The Modal Profile"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              mean % of best output per domain
              <br />
              events count toward every domain they touch
            </span>
          }
        />
        <Panel>
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={model.radarData} outerRadius="72%">
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis
                dataKey="bucket"
                tick={{ fill: 'var(--chart-axis)', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif" }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'var(--chart-axis)', fontSize: 9 }} stroke="var(--chart-grid)" />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value, name) => [`${value}% of best`, String(name)]}
              />
              {selRows.map((r) => (
                <Radar
                  key={r.athlete.name}
                  name={r.athlete.name}
                  dataKey={r.athlete.name}
                  stroke={r.color}
                  fill={r.color}
                  fillOpacity={0.08}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {model.radarData.map((r) => (
              <span key={String(r.bucket)} className="text-[11px] text-[var(--text-muted)]">
                {r.bucket}: <span className="text-[var(--text-tertiary)]">{r.eventCount} events</span>
              </span>
            ))}
          </div>
        </Panel>
      </section>

      {/* 4 - Fingerprint */}
      <section className="mb-12">
        <SectionHeading
          kicker="Every athlete x every test"
          title="The Fitness Fingerprint"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              cell = event placement
              <br />
              columns ordered sprint to endurance to max
            </span>
          }
        />
        <Panel className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: '3px' }}>
            <thead>
              <tr>
                <th className="text-left pr-2 min-w-[150px]" />
                {model.fingerprintCols.map((m) => (
                  <th key={m.ev.id} className="pb-1.5 px-0.5 min-w-[52px]">
                    <div className="games-condensed text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[var(--text-tertiary)] leading-tight">
                      {m.ev.name.length > 14 ? `${m.ev.name.slice(0, 13)}…` : m.ev.name}
                    </div>
                    <div className="text-[9.5px] font-mono text-[var(--text-muted)]">
                      {m.isMax ? '1RM' : fmtMin(m.winSec! / 60)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((r) => (
                <tr key={r.athlete.name}>
                  <td className="pr-2 py-0.5 whitespace-nowrap">
                    <span className="games-condensed text-[12.5px] font-semibold" style={{ color: r.color }}>
                      {r.athlete.rank}. {r.athlete.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-1.5">{r.athlete.totalPoints} pts</span>
                  </td>
                  {model.fingerprintCols.map((m) => {
                    const cell = r.perfByEvent.get(m.ev.id)
                    const heat = cell ? perfCell(cell.perf) : null
                    return (
                      <td
                        key={m.ev.id}
                        className="text-center rounded-md py-1.5 text-[12px] font-semibold"
                        style={{ background: heat?.bg ?? 'var(--panel-bg-2)', color: heat?.fg ?? 'var(--text-muted)' }}
                        title={cell ? `${r.athlete.name}, ${m.ev.name}: ${cell.place}${cell.score ? ` (${cell.score})` : ''} · ${cell.points} pts` : ''}
                      >
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
            {[15, 35, 50, 65, 80, 95].map((p) => (
              <span key={p} className="w-6 h-3 rounded-sm inline-block" style={{ background: perfCell(p).bg }} />
            ))}
            <span>best</span>
          </div>
        </Panel>
      </section>

      {/* 5 - Breadth index */}
      <section className="mb-10">
        <SectionHeading
          kicker="Does breadth win the Games?"
          title="The Breadth Index"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              sigma of an athlete's relative output
              <br />
              lower = more even across all tests
            </span>
          }
        />
        <Panel>
          <div className="space-y-2">
            {model.bySd.map((r, i) => {
              const maxSd = model.bySd[model.bySd.length - 1].outputSd || 1
              return (
                <div key={r.athlete.name} className="flex items-center gap-3">
                  <span className="games-condensed text-[12px] font-semibold w-7 text-[var(--text-muted)]">#{i + 1}</span>
                  <span className="games-condensed text-[13px] font-semibold w-44 truncate" style={{ color: r.color }}>
                    {r.athlete.name}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(8, 100 - (r.outputSd / maxSd) * 88)}%`, background: `linear-gradient(90deg, ${r.color}66, ${r.color})` }}
                    />
                  </div>
                  <span className="font-mono text-[11.5px] text-[var(--text-tertiary)] w-16 text-right">σ {r.outputSd.toFixed(1)}</span>
                  <span className="games-condensed text-[11px] w-20 text-right text-[var(--text-muted)]">
                    finished {r.athlete.rank}
                    {r.athlete.rank === 1 ? 'st' : r.athlete.rank === 2 ? 'nd' : r.athlete.rank === 3 ? 'rd' : 'th'}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-4 pt-3 border-t border-[var(--panel-border-subtle)] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {(() => {
              const podiumInTop3Breadth = model.bySd.slice(0, 3).filter((r) => r.athlete.rank <= 3).length
              const broadest = model.bySd[0]
              const corr = model.spearman
              const corrText =
                corr > 0.6
                  ? `consistency tracked the final leaderboard closely (ρ = ${corr.toFixed(2)})`
                  : corr > 0.3
                    ? `consistency and the final leaderboard were moderately linked (ρ = ${corr.toFixed(2)})`
                    : `consistency and final rank told different stories this year (ρ = ${corr.toFixed(2)})`
              return `${broadest.athlete.name} was the most even across every test, including the 1RM (σ ${broadest.outputSd.toFixed(1)})${broadest.athlete.rank === 1 ? ', and won.' : `, finishing ${broadest.athlete.rank}.`} ${podiumInTop3Breadth} of the 3 most consistent athletes made the podium, and ${corrText}.`
            })()}
          </p>
        </Panel>
      </section>

      {/* Methodology */}
      <div className="text-[11px] leading-relaxed text-[var(--text-muted)] max-w-3xl mb-4 space-y-1.5">
        <p>
          Method: in a for-time event all finishers complete the same work, so relative output is exact:
          (winning time / athlete time) x 100. Capped scores use the estimated cap and completed fraction
          (hollow dots). The Capacity Index integrates that curve over log-duration: the average share of
          best-possible output across the full time spectrum. The 1RM event has no time component and is
          scored as % of the best lift.
        </p>
        <p>
          Modeled watts use a per-event work estimate: external mechanical work for lifts and gymnastics at
          20% efficiency, 1 kcal/kg/km for running, machine calories for ergs, reference body mass 195/145 lb.
          Within an event, athlete-to-athlete comparisons stay exact; absolute levels are estimates, and
          grip/balance-dense events under-measure by design. Results from the official leaderboard,
          cross-verified against independent reporting.
        </p>
      </div>
    </div>
  )
}
