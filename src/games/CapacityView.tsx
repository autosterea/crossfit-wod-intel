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

/** Distinct, theme-safe colors for ranks 1–10 (champion = brand green). */
const ATHLETE_COLORS = [
  '#91C640', '#f43f5e', '#60a5fa', '#f59e0b', '#a855f7',
  '#14b8a6', '#ec4899', '#eab308', '#06b6d4', '#94a3b8',
]

/** Parse a leaderboard time ("46:16.00", "2:35", "1:02:10") into minutes. */
function parseMinutes(score: string | null): number | null {
  if (!score) return null
  const parts = score.trim().split(':').map(parseFloat)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60
  if (parts.length === 2) return parts[0] + parts[1] / 60
  return null
}

function fmtDuration(min: number): string {
  const m = Math.floor(min)
  const s = Math.round((min - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Percentile within the full field: 1st = 100, last = lowest. */
const perfOf = (place: number, field: number) => ((field - place + 1) / field) * 100

/** Heat colors for the fingerprint cells: rose → amber → green. */
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
  durationMin: number | null
  isMax: boolean
}

interface AthleteRow {
  athlete: GamesAthleteResult
  color: string
  perfByEvent: Map<string, { place: number; perf: number; score: string | null; points: number }>
  breadthSd: number
  meanPerf: number
}

const MODAL_BUCKETS: { key: string; label: string; test: (e: GamesEvent) => boolean }[] = [
  { key: 'mono', label: 'Mono / Engine', test: (e) => e.modality.includes('M') },
  { key: 'gym', label: 'Gymnastics', test: (e) => e.modality.includes('G') },
  { key: 'weight', label: 'Weightlifting', test: (e) => e.modality.includes('W') },
  { key: 'heavy', label: 'Heavy Days', test: (e) => e.loadLevel === 'heavy' || e.loadLevel === 'max' },
  { key: 'light', label: 'Light / BW', test: (e) => e.loadLevel === 'none' || e.loadLevel === 'light' },
  { key: 'max', label: 'Max Effort', test: (e) => e.format === 'max-load' },
]

function useCapacityModel(yearResults: GamesYearResults | null, division: Division) {
  return useMemo(() => {
    if (!yearResults) return null
    const yearData = yearByNum.get(yearResults.year)
    if (!yearData) return null
    const field = (division === 'men' ? yearData.fieldMen : yearData.fieldWomen) ?? 30
    const athletes = yearResults.divisions[division]
    if (!athletes?.length) return null

    const eventMeta: EventMeta[] = yearData.events.map((ev) => {
      const isMax = ev.format === 'max-load'
      const winning = division === 'men' ? ev.winningScoreMen : ev.winningScoreWomen
      return { ev, isMax, durationMin: isMax ? null : parseMinutes(winning) ?? ev.timeCapMin }
    })
    const timed = eventMeta.filter((m) => !m.isMax && m.durationMin != null).sort((a, b) => a.durationMin! - b.durationMin!)
    const maxEvents = eventMeta.filter((m) => m.isMax)

    const rows: AthleteRow[] = athletes.map((athlete, i) => {
      const perfByEvent = new Map(
        athlete.events.map((e) => [e.eventId, { place: e.place, perf: perfOf(e.place, field), score: e.score, points: e.points }])
      )
      const perfs = athlete.events.map((e) => perfOf(e.place, field))
      const mean = perfs.reduce((a, b) => a + b, 0) / perfs.length
      const sd = Math.sqrt(perfs.reduce((a, p) => a + (p - mean) ** 2, 0) / perfs.length)
      return { athlete, color: ATHLETE_COLORS[i % ATHLETE_COLORS.length], perfByEvent, breadthSd: sd, meanPerf: mean }
    })

    // Capacity-curve rows: one point per timed event, keyed by athlete name
    const curveData = timed.map((m) => {
      const row: Record<string, number | string> = {
        duration: Math.round(m.durationMin! * 100) / 100,
        eventName: m.ev.name,
        eventId: m.ev.id,
      }
      rows.forEach((r) => {
        const cell = r.perfByEvent.get(m.ev.id)
        if (cell) row[r.athlete.name] = Math.round(cell.perf * 10) / 10
      })
      return row
    })

    // Modal radar rows
    const radarData = MODAL_BUCKETS.map((b) => {
      const evs = eventMeta.filter((m) => b.test(m.ev))
      const row: Record<string, number | string> = { bucket: b.label, eventCount: evs.length }
      rows.forEach((r) => {
        const perfs = evs.map((m) => r.perfByEvent.get(m.ev.id)?.perf).filter((p): p is number => p != null)
        if (perfs.length) row[r.athlete.name] = Math.round((perfs.reduce((a, p) => a + p, 0) / perfs.length) * 10) / 10
      })
      return row
    }).filter((r) => (r.eventCount as number) > 0)

    // Fingerprint column order: timed by duration, then max events
    const fingerprintCols = [...timed, ...maxEvents]

    // Breadth ↔ final-rank correlation (Spearman on rank orders)
    const bySd = [...rows].sort((a, b) => a.breadthSd - b.breadthSd)
    const n = rows.length
    let d2 = 0
    bySd.forEach((r, i) => {
      d2 += (i + 1 - r.athlete.rank) ** 2
    })
    const spearman = n > 1 ? 1 - (6 * d2) / (n * (n * n - 1)) : 0

    return { field, rows, timed, maxEvents, curveData, radarData, fingerprintCols, bySd, spearman, yearData }
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
  const model = useCapacityModel(yearResults ?? null, division)
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set())

  // Default selection: podium (top 3) — reset when division/year changes
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
  const champion = model.rows[0]

  const durTicks = [2, 3, 5, 8, 12, 20, 30, 45, 60].filter(
    (t) => model.timed.length > 0 && t >= model.timed[0].durationMin! * 0.8 && t <= model.timed[model.timed.length - 1].durationMin! * 1.3
  )

  return (
    <div className="pt-10">
      {/* Header */}
      <div className="mb-8">
        <div className="games-condensed text-[12px] uppercase tracking-[0.2em] text-[#91C640] mb-1">
          “Fitness is increased work capacity across broad time and modal domains” — plotted, for the first time
        </div>
        <h1 className="games-display text-4xl sm:text-5xl text-[var(--text-primary)]">
          Capacity <span className="text-[#91C640]">Lab</span>
        </h1>
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          CrossFit's founding definition of fitness, applied to the people who won it. Every top-10 athlete's
          placement in every event of the {year} Games, arranged across the time domains (sprint → endurance)
          and modal domains (mono / gymnastics / weightlifting, light → max) they were tested in. A flat, high
          line is the definition of "fittest" — high work capacity, everywhere.
        </p>

        {/* Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {availableYears.length > 1 && (
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
          )}
          {availableYears.length <= 1 && (
            <Chip color="#91C640" outline>
              {year} Games — pilot year
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

      {/* 1 — Capacity curve */}
      <section className="mb-12">
        <SectionHeading
          kicker="Across broad time domains"
          title="The Capacity Curve"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              x: event duration ({division}'s winning time, log scale)
              <br />
              y: field percentile (1st = 100)
            </span>
          }
        />
        <Panel>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={model.curveData} margin={{ top: 12, right: 24, bottom: 8, left: -12 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="duration"
                type="number"
                scale="log"
                domain={['dataMin', 'dataMax']}
                ticks={durTicks}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                tickFormatter={(v: number) => `${v}m`}
                stroke="var(--chart-grid)"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                stroke="var(--chart-grid)"
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={(v) => {
                  const d = Number(v)
                  const row = model.curveData.find((r) => r.duration === d)
                  return row ? `${row.eventName} — ${fmtDuration(d)}` : fmtDuration(d)
                }}
                formatter={(value, name) => {
                  const row = model.rows.find((r) => r.athlete.name === name)
                  return [`${value} pct`, `${row ? `#${row.athlete.rank} ` : ''}${String(name)}`]
                }}
              />
              {selRows.map((r) => (
                <Line
                  key={r.athlete.name}
                  dataKey={r.athlete.name}
                  type="monotone"
                  stroke={r.color}
                  strokeWidth={r.athlete.rank === 1 ? 3 : 2}
                  dot={{ r: r.athlete.rank === 1 ? 4.5 : 3.5, fill: r.color, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Event strip, ordered by duration */}
          <div className="mt-3 pt-3 border-t border-[var(--panel-border-subtle)] flex flex-wrap gap-x-4 gap-y-1.5">
            {model.timed.map((m) => (
              <span key={m.ev.id} className="text-[11px] text-[var(--text-muted)]">
                <span className="font-mono text-[#91C640]">{fmtDuration(m.durationMin!)}</span>{' '}
                {m.ev.name}
              </span>
            ))}
          </div>

          {/* Max-strength lane */}
          {model.maxEvents.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--panel-border-subtle)]">
              <div className="games-condensed uppercase tracking-[0.12em] text-[11px] font-semibold text-[var(--text-muted)] mb-3">
                Outside the clock — max-effort lane ({model.maxEvents.map((m) => m.ev.name).join(', ')})
              </div>
              {model.maxEvents.map((m) => (
                <div key={m.ev.id} className="relative h-9 rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border-subtle)]">
                  {selRows.map((r) => {
                    const cell = r.perfByEvent.get(m.ev.id)
                    if (!cell) return null
                    return (
                      <div
                        key={r.athlete.name}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                        style={{ left: `${2 + cell.perf * 0.96}%` }}
                        title={`${r.athlete.name}: ${cell.place}${cell.score ? ` (${cell.score})` : ''}`}
                      >
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--panel-bg)]" style={{ background: r.color }} />
                      </div>
                    )
                  })}
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">last</span>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">1st</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* 2 — Modal domains */}
      <section className="mb-12">
        <SectionHeading
          kicker="Across broad modal domains"
          title="The Modal Profile"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              avg percentile per domain
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
                formatter={(value, name) => [`${value} pct`, String(name)]}
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

      {/* 3 — Fingerprint */}
      <section className="mb-12">
        <SectionHeading
          kicker="Every athlete × every test"
          title="The Fitness Fingerprint"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              cell = event placement
              <br />
              columns ordered sprint → endurance → max
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
                      {m.isMax ? '1RM' : fmtDuration(m.durationMin!)}
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
                        title={cell ? `${r.athlete.name} — ${m.ev.name}: ${cell.place}${cell.score ? ` (${cell.score})` : ''} · ${cell.points} pts` : ''}
                      >
                        {cell ? cell.place : '—'}
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

      {/* 4 — Breadth index */}
      <section className="mb-10">
        <SectionHeading
          kicker="Does breadth win the Games?"
          title="The Breadth Index"
          right={
            <span className="games-condensed text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">
              σ of an athlete's percentiles
              <br />
              lower = broader work capacity
            </span>
          }
        />
        <Panel>
          <div className="space-y-2">
            {model.bySd.map((r, i) => {
              const maxSd = model.bySd[model.bySd.length - 1].breadthSd || 1
              return (
                <div key={r.athlete.name} className="flex items-center gap-3">
                  <span className="games-condensed text-[12px] font-semibold w-7 text-[var(--text-muted)]">#{i + 1}</span>
                  <span className="games-condensed text-[13px] font-semibold w-44 truncate" style={{ color: r.color }}>
                    {r.athlete.name}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(8, 100 - (r.breadthSd / maxSd) * 88)}%`, background: `linear-gradient(90deg, ${r.color}66, ${r.color})` }}
                    />
                  </div>
                  <span className="font-mono text-[11.5px] text-[var(--text-tertiary)] w-16 text-right">σ {r.breadthSd.toFixed(1)}</span>
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
                  ? `breadth tracked the final leaderboard closely (ρ = ${corr.toFixed(2)})`
                  : corr > 0.3
                    ? `breadth and the final leaderboard were moderately linked (ρ = ${corr.toFixed(2)})`
                    : `breadth and final rank told different stories this year (ρ = ${corr.toFixed(2)})`
              return `${broadest.athlete.name} had the broadest capacity of the ${division}'s top 10 (σ ${broadest.breadthSd.toFixed(1)} across all ${model.fingerprintCols.length} tests${broadest.athlete.rank === 1 ? ' — and won' : `, finishing ${broadest.athlete.rank}`}). ${podiumInTop3Breadth} of the 3 broadest athletes made the podium, and ${corrText}. ${champion.athlete.name} won with a mean percentile of ${champion.meanPerf.toFixed(0)} and σ ${champion.breadthSd.toFixed(1)}.`
            })()}
          </p>
        </Panel>
      </section>

      {/* Methodology */}
      <p className="text-[11px] leading-relaxed text-[var(--text-muted)] max-w-3xl mb-4">
        Method: performance = placement percentile within the full {model.field}-athlete field, (field − place + 1) ⁄ field × 100.
        Event duration = the {division}'s winning time (log scale); max-load events are shown outside the clock. Modal domains
        derive from each event's modality, loading, and format; events count toward every domain they touch.
        Results compiled from the official leaderboard, Wikipedia, and contemporary event reporting.
      </p>
    </div>
  )
}
