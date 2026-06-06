import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHART_TOOLTIP_STYLE,
  G,
  LOAD_COLORS,
  LOAD_LABELS,
  LOAD_ORDER,
  MODALITY_COLORS,
  MODALITY_LABELS,
  modalityWeights,
  TD_COLORS,
  TD_LABELS,
  TD_ORDER,
} from './gamesData'
import { mean } from '../utils/statistics'
import { Panel, SectionHeading, StatBlock } from './ui'
import type { GamesYearAggregate } from '../types-games'

type ChartRow = Record<string, number | string>

const MODALITY_KEYS = ['M', 'G', 'W'] as const
type ModalityKey = (typeof MODALITY_KEYS)[number]

interface BlendRow {
  year: number
  M: number
  G: number
  W: number
}

const shortYear = (y: number | string) => `'${String(y).slice(-2)}`
const pctOf = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)
const totalEvents = (r: GamesYearAggregate) => r.eventCount + r.onlineEventCount
const spanLabel = (rs: GamesYearAggregate[]) =>
  rs.length === 1 ? String(rs[0].year) : `${rs[0].year}-${rs[rs.length - 1].year}`

/** Editorial deck paragraph rendered between the heading and its chart */
function Deck({ children }: { children: ReactNode }) {
  return (
    <p className="-mt-1 mb-5 max-w-3xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
      {children}
    </p>
  )
}

function LegendRow({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span
          key={it.label}
          className="games-condensed inline-flex items-center gap-1.5 uppercase tracking-[0.08em] text-[10.5px] text-[var(--text-muted)]"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

function PanelCaption({ children }: { children: ReactNode }) {
  return (
    <div className="games-condensed mb-2 uppercase tracking-[0.14em] text-[11px] font-semibold text-[var(--text-muted)]">
      {children}
    </div>
  )
}

export default function EvolutionView() {
  const rows = useMemo(() => [...G.perYear].sort((a, b) => a.year - b.year), [])

  // ---------- Chart data ----------

  const armsRows = useMemo(
    () =>
      rows.map((r) => ({
        year: r.year,
        finals: r.eventCount,
        online: r.onlineEventCount,
        cumulative: r.cumulativeMovements,
      })),
    [rows]
  )

  const eraBands = useMemo(() => {
    if (!rows.length) return []
    const minY = rows[0].year
    const maxY = rows[rows.length - 1].year
    return G.eras
      .map((e) => ({
        name: e.name,
        x1: Math.max(e.range[0], minY),
        x2: Math.min(e.range[1], maxY),
      }))
      .filter((e) => e.x1 <= e.x2)
  }, [rows])

  const blendRows = useMemo<BlendRow[]>(
    () =>
      rows.map((r) => {
        const w = modalityWeights(r.modality)
        const sum = w.M + w.G + w.W
        return {
          year: r.year,
          M: pctOf(w.M, sum),
          G: pctOf(w.G, sum),
          W: pctOf(w.W, sum),
        }
      }),
    [rows]
  )

  const tdRows = useMemo<ChartRow[]>(
    () =>
      rows.map((r) => {
        const total = TD_ORDER.reduce((a, k) => a + (r.timeDomains[k] ?? 0), 0)
        const row: ChartRow = { year: r.year }
        for (const k of TD_ORDER) row[k] = pctOf(r.timeDomains[k] ?? 0, total)
        return row
      }),
    [rows]
  )

  const loadRows = useMemo<ChartRow[]>(
    () =>
      rows.map((r) => {
        const row: ChartRow = { year: r.year }
        for (const k of LOAD_ORDER) row[k] = r.loadLevels[k] ?? 0
        return row
      }),
    [rows]
  )

  const outdoorRows = useMemo(
    () => rows.map((r) => ({ year: r.year, outdoor: r.pctOutdoor })),
    [rows]
  )

  const capRows = useMemo<{ year: number; cap: number | null }[]>(
    () => rows.map((r) => ({ year: r.year, cap: r.avgTimeCapMin })),
    [rows]
  )

  const debutRows = useMemo(
    () => rows.map((r) => ({ year: r.year, debuts: r.newMovements })),
    [rows]
  )

  /** Post-inaugural years that tie for the most movement debuts */
  const debutPeak = useMemo<{ maxDebuts: number; years: number[] }>(() => {
    const after = rows.slice(1)
    const maxDebuts = after.length ? Math.max(...after.map((r) => r.newMovements)) : 0
    const years =
      maxDebuts > 0 ? after.filter((r) => r.newMovements === maxDebuts).map((r) => r.year) : []
    return { maxDebuts, years }
  }, [rows])

  const debutHighlight = useMemo(() => new Set(debutPeak.years), [debutPeak])

  // ---------- Headline stats ----------

  const headline = useMemo(() => {
    if (!rows.length) return null
    const last = rows[rows.length - 1]
    return {
      seasons: rows.length,
      span: spanLabel(rows),
      events: rows.reduce((a, r) => a + totalEvents(r), 0),
      movements: last.cumulativeMovements,
      eras: G.eras.length,
    }
  }, [rows])

  // ---------- Computed editorial insights ----------

  const insights = useMemo(() => {
    if (!rows.length) return null
    const first = rows[0]
    const last = rows[rows.length - 1]

    // Comparison slices: first era vs last era when defined, else outer thirds
    const firstEra = G.eras.length ? G.eras[0] : null
    const lastEra = G.eras.length > 1 ? G.eras[G.eras.length - 1] : null
    const third = Math.max(1, Math.floor(rows.length / 3))
    const earlyRaw = firstEra
      ? rows.filter((r) => r.year >= firstEra.range[0] && r.year <= firstEra.range[1])
      : rows.slice(0, third)
    const lateRaw = lastEra
      ? rows.filter((r) => r.year >= lastEra.range[0] && r.year <= lastEra.range[1])
      : rows.slice(-third)
    const early = earlyRaw.length ? earlyRaw : [first]
    const late = lateRaw.length ? lateRaw : [last]
    const earlyLabel = spanLabel(early)
    const lateLabel = spanLabel(late)

    // 1. Arms race
    const peak = rows.reduce((a, b) => (totalEvents(b) > totalEvents(a) ? b : a))
    const armsDir =
      totalEvents(last) > totalEvents(first)
        ? 'has expanded'
        : totalEvents(last) < totalEvents(first)
          ? 'has pulled back'
          : 'has held steady'
    const peakNote =
      peak.year !== last.year && peak.year !== first.year
        ? `, peaking at ${totalEvents(peak)} in ${peak.year}`
        : ''
    const arms = `The annual test ${armsDir}: athletes faced ${totalEvents(first)} scored events in ${first.year} and ${totalEvents(last)} in ${last.year}${peakNote}. Beneath the volume, the cumulative movement pool climbed from ${first.cumulativeMovements} to ${last.cumulativeMovements}.`

    // 2. Modality blend
    const earlyYears = new Set(early.map((r) => r.year))
    const lateYears = new Set(late.map((r) => r.year))
    const share = (ys: Set<number>, m: ModalityKey) =>
      mean(blendRows.filter((b) => ys.has(b.year)).map((b) => b[m]))
    const deltas = MODALITY_KEYS.map((m) => ({
      m,
      early: share(earlyYears, m),
      late: share(lateYears, m),
    }))
    const big = deltas.reduce((a, b) =>
      Math.abs(b.late - b.early) > Math.abs(a.late - a.early) ? b : a
    )
    const moved = big.late - big.early
    const blend =
      Math.abs(moved) < 2
        ? `The three-modality blend has barely moved: between ${earlyLabel} and ${lateLabel}, no discipline's share of programming weight shifted by more than ${Math.max(1, Math.round(Math.abs(moved)))} percentage points.`
        : `${MODALITY_LABELS[big.m]} ${moved > 0 ? 'gained' : 'lost'} the most ground, going from ${Math.round(big.early)}% of programming weight in ${earlyLabel} to ${Math.round(big.late)}% in ${lateLabel}.`

    // 3. Time domains
    const longShare = (rs: GamesYearAggregate[]) => {
      let long = 0
      let all = 0
      for (const r of rs) {
        for (const k of TD_ORDER) {
          const n = r.timeDomains[k] ?? 0
          all += n
          if (k === 'long' || k === 'endurance') long += n
        }
      }
      return pctOf(long, all)
    }
    const tdE = longShare(early)
    const tdL = longShare(late)
    const tdTrend =
      tdL > tdE + 2
        ? 'the clock keeps stretching'
        : tdL < tdE - 2
          ? 'the test has compressed toward shorter pieces'
          : 'the pacing mix has held remarkably steady'
    const td = `Workouts past the 20-minute mark made up ${Math.round(tdE)}% of events in ${earlyLabel} and ${Math.round(tdL)}% in ${lateLabel}; ${tdTrend}.`

    // 4. Loading
    const heavyShare = (rs: GamesYearAggregate[]) => {
      let heavy = 0
      let all = 0
      for (const r of rs) {
        for (const k of LOAD_ORDER) {
          const n = r.loadLevels[k] ?? 0
          all += n
          if (k === 'heavy' || k === 'max') heavy += n
        }
      }
      return pctOf(heavy, all)
    }
    const ldE = heavyShare(early)
    const ldL = heavyShare(late)
    const loadTrend =
      ldL > ldE + 2
        ? 'the barbell really has gotten heavier'
        : ldL < ldE - 2
          ? 'loading has actually lightened up'
          : 'loading has stayed about level'
    const load = `Heavy and max-effort tests accounted for ${Math.round(ldE)}% of events in ${earlyLabel} against ${Math.round(ldL)}% in ${lateLabel}; ${loadTrend}.`

    // 5. Venue + time caps
    const half = Math.max(1, Math.floor(rows.length / 2))
    const firstHalf = rows.slice(0, half)
    const secondHalf = rows.length > 1 ? rows.slice(half) : firstHalf
    const outE = mean(firstHalf.map((r) => r.pctOutdoor))
    const outL = mean(secondHalf.map((r) => r.pctOutdoor))
    const outPeak = rows.reduce((a, b) => (b.pctOutdoor > a.pctOutdoor ? b : a))
    let venue = `Roughly ${Math.round(outE)}% of events escaped the stadium across the first half of Games history versus ${Math.round(outL)}% since, with ${outPeak.year} the most outdoor season at ${Math.round(outPeak.pctOutdoor)}%.`
    const capsE = firstHalf.map((r) => r.avgTimeCapMin).filter((c): c is number => c != null)
    const capsL = secondHalf.map((r) => r.avgTimeCapMin).filter((c): c is number => c != null)
    if (capsE.length && capsL.length) {
      const cE = mean(capsE)
      const cL = mean(capsL)
      venue +=
        Math.abs(cL - cE) < 1
          ? ` Average time caps have held near ${Math.round(cE)} minutes throughout.`
          : ` Average time caps ${cL > cE ? 'lengthened' : 'tightened'} from about ${Math.round(cE)} to ${Math.round(cL)} minutes.`
    }

    // 6. Debuts
    const debutYearsLabel =
      debutPeak.years.length > 1
        ? `${debutPeak.years.slice(0, -1).join(', ')} and ${debutPeak.years[debutPeak.years.length - 1]}`
        : String(debutPeak.years[0])
    const debuts =
      debutPeak.maxDebuts > 0
        ? `${first.year} seeded the library with ${first.newMovements} movements, and the biggest infusion since came in ${debutYearsLabel} with ${debutPeak.maxDebuts} debuts. The all-time pool now counts ${last.cumulativeMovements} distinct movements.`
        : `${first.year} seeded the library with ${first.newMovements} movements; the pool has stood pat at ${last.cumulativeMovements} since.`

    return { arms, blend, td, load, venue, debuts }
  }, [rows, blendRows, debutPeak])

  // ---------- Empty state ----------

  if (!rows.length || !insights || !headline) {
    return (
      <div className="pt-10 pb-24 text-center">
        <div className="games-display mb-2 text-3xl text-[var(--text-primary)]">Evolution</div>
        <p className="text-sm text-[var(--text-secondary)]">
          The charts light up once the Games archive is compiled. Check back shortly.
        </p>
      </div>
    )
  }

  const firstYear = rows[0].year

  return (
    <div className="min-w-0 pt-10 pb-6">
      {/* Page header */}
      <header className="games-rise games-rise-1 mb-10">
        <div className="games-condensed uppercase tracking-[0.25em] text-[12px] font-semibold text-[#91C640]">
          The Almanac in aggregate Â· {headline.span}
        </div>
        <h1 className="games-display mt-2 text-4xl sm:text-6xl text-[var(--text-primary)]">
          How the test <span className="text-[#91C640]">evolved</span>
        </h1>
        <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-[var(--text-secondary)]">
          Every scored event from {headline.span}, aggregated season by season: volume, modality
          blend, pacing, loading, venue, and novelty.
        </p>
      </header>

      {/* Headline stats */}
      <div className="games-rise games-rise-2 mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock stat={String(headline.seasons)} label="Seasons" sub={headline.span} />
        <StatBlock stat={String(headline.events)} label="Scored events" sub="finals + online stages" />
        <StatBlock stat={String(headline.movements)} label="Distinct movements" sub="cumulative pool" />
        <StatBlock
          stat={String(headline.eras)}
          label="Eras"
          sub={headline.eras ? 'venue-defined chapters' : undefined}
        />
      </div>

      <div className="space-y-14">
        {/* 1. The Arms Race */}
        <section className="min-w-0">
          <div className="games-era-rule mb-8" />
          <SectionHeading kicker="01 Â· Volume" title="The Arms Race" />
          <Deck>{insights.arms}</Deck>
          <Panel>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={armsRows} margin={{ top: 22, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickFormatter={shortYear}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  interval={1}
                />
                <YAxis
                  yAxisId="events"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <YAxis
                  yAxisId="cum"
                  orientation="right"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                {eraBands.map((b, i) => (
                  <ReferenceArea
                    key={b.name}
                    yAxisId="events"
                    x1={b.x1}
                    x2={b.x2}
                    fill="#91C640"
                    fillOpacity={i % 2 === 0 ? 0.06 : 0.015}
                    stroke="none"
                    label={{
                      value: b.name,
                      position: 'insideTop',
                      fill: 'var(--chart-axis)',
                      fontSize: 10,
                    }}
                  />
                ))}
                <Bar
                  yAxisId="events"
                  dataKey="finals"
                  name="Finals events"
                  stackId="ev"
                  fill="#019644"
                  maxBarSize={34}
                />
                <Bar
                  yAxisId="events"
                  dataKey="online"
                  name="Online stage"
                  stackId="ev"
                  fill="#60a5fa"
                  maxBarSize={34}
                />
                <Line
                  yAxisId="cum"
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative movement pool"
                  stroke="#91C640"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <LegendRow
              items={[
                { label: 'Finals events', color: '#019644' },
                { label: 'Online stage', color: '#60a5fa' },
                { label: 'Cumulative movement pool', color: '#91C640' },
              ]}
            />
            {eraBands.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
                {eraBands.map((b, i) => (
                  <span
                    key={b.name}
                    className="games-condensed inline-flex items-center gap-1.5 uppercase tracking-[0.08em] text-[10.5px] text-[var(--text-muted)]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ background: '#91C640', opacity: i % 2 === 0 ? 0.55 : 0.2 }}
                    />
                    {b.name} {b.x1}-{b.x2}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </section>

        {/* 2. The Blend */}
        <section className="min-w-0">
          <SectionHeading kicker="02 Â· Modality Mix" title="The Blend" />
          <Deck>{insights.blend}</Deck>
          <Panel>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={blendRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickFormatter={shortYear}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  interval={1}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value, name) => [`${Math.round(Number(value))}%`, String(name)]}
                />
                {(['W', 'G', 'M'] as const).map((m) => (
                  <Area
                    key={m}
                    type="monotone"
                    dataKey={m}
                    name={MODALITY_LABELS[m]}
                    stackId="blend"
                    stroke={MODALITY_COLORS[m]}
                    fill={MODALITY_COLORS[m]}
                    fillOpacity={0.6}
                    strokeWidth={1.2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <LegendRow
              items={MODALITY_KEYS.map((m) => ({
                label: MODALITY_LABELS[m],
                color: MODALITY_COLORS[m],
              }))}
            />
          </Panel>
        </section>

        {/* 3. Time Domains */}
        <section className="min-w-0">
          <SectionHeading kicker="03 Â· Pacing" title="Time Domains" />
          <Deck>{insights.td}</Deck>
          <Panel>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tdRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickFormatter={shortYear}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  interval={1}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value, name) => [`${Math.round(Number(value))}%`, String(name)]}
                />
                {TD_ORDER.map((k) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={TD_LABELS[k]}
                    stackId="td"
                    fill={TD_COLORS[k]}
                    maxBarSize={34}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <LegendRow
              items={TD_ORDER.map((k) => ({ label: TD_LABELS[k], color: TD_COLORS[k] }))}
            />
          </Panel>
        </section>

        {/* 4. The Barbell Gets Heavier */}
        <section className="min-w-0">
          <SectionHeading kicker="04 Â· Loading" title="The Barbell Gets Heavier" />
          <Deck>{insights.load}</Deck>
          <Panel>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={loadRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickFormatter={shortYear}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  interval={1}
                />
                <YAxis
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                {LOAD_ORDER.map((k) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={LOAD_LABELS[k]}
                    stackId="load"
                    fill={LOAD_COLORS[k]}
                    maxBarSize={34}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <LegendRow
              items={LOAD_ORDER.map((k) => ({ label: LOAD_LABELS[k], color: LOAD_COLORS[k] }))}
            />
          </Panel>
        </section>

        {/* 5. Leaving the Stadium */}
        <section className="min-w-0">
          <SectionHeading kicker="05 Â· Venue" title="Leaving the Stadium" />
          <Deck>{insights.venue}</Deck>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            <Panel className="min-w-0">
              <PanelCaption>Share of events outside the stadium</PanelCaption>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={outdoorRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="evoOutdoorFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#019644" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#019644" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                    tickFormatter={shortYear}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--chart-grid)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value, name) => [`${Math.round(Number(value))}%`, String(name)]}
                  />
                  <Area
                    type="monotone"
                    dataKey="outdoor"
                    name="Outdoor events"
                    stroke="#019644"
                    strokeWidth={2}
                    fill="url(#evoOutdoorFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel className="min-w-0">
              <PanelCaption>Average time cap, minutes</PanelCaption>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={capRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                    tickFormatter={shortYear}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--chart-grid)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value, name) => [`${Number(value)} min`, String(name)]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cap"
                    name="Avg time cap"
                    stroke="#91C640"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#91C640', strokeWidth: 0 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        </section>

        {/* 6. New Tricks */}
        <section className="min-w-0">
          <SectionHeading kicker="06 Â· Novelty" title="New Tricks" />
          <Deck>{insights.debuts}</Deck>
          <Panel>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={debutRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickFormatter={shortYear}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  interval={1}
                />
                <YAxis
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="debuts" name="Movement debuts" maxBarSize={34}>
                  {debutRows.map((r) => (
                    <Cell
                      key={r.year}
                      fill={debutHighlight.has(r.year) ? '#91C640' : '#019644'}
                      fillOpacity={debutHighlight.has(r.year) || r.year === firstYear ? 1 : 0.45}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <LegendRow
              items={[
                { label: `Inaugural pool (${firstYear})`, color: '#019644' },
                { label: 'Biggest debut year since', color: '#91C640' },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  )
}
