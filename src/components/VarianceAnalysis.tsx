import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  ResponsiveContainer, ComposedChart, Line, Area,
} from 'recharts'
import type { CrossFitData } from '../types'

interface EntropyData {
  entropy: number
  maxEntropy: number
  varianceScore: number
}

interface HHIData {
  hhi: number
  normalizedHHI: number
  interpretation: string
}

interface ParetoItem {
  movement: string
  count: number
  pct: number
  cumPct: number
}

interface AutocorrelationLag {
  lag: number
  correlation: number
  significant: boolean
}

interface AutocorrelationData {
  lags: AutocorrelationLag[]
  hasPeriodicity: boolean
  dominantPeriod: number | null
}

interface MarkovData {
  states: string[]
  matrix: number[][]
  steadyState: Record<string, number>
}

interface RestDayData {
  avgMovementsBeforeRest: number
  avgMovementsAfterRest: number
  modalityBeforeRest: Record<string, number>
  modalityAfterRest: Record<string, number>
  isStrategic: boolean
}

interface AdvancedAnalysis {
  entropy: EntropyData
  hhi: HHIData
  pareto: ParetoItem[]
  autocorrelation: AutocorrelationData
  markov: MarkovData
  restDay: RestDayData
  [key: string]: any
}

function ExplainerBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
      <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{children}</p>
    </div>
  )
}

function ScoreCard({
  value,
  label,
  subtitle,
  color,
}: {
  value: string
  label: string
  subtitle: string
  color: string
}) {
  return (
    <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)] hover:border-[var(--panel-border-strong)] transition-colors flex flex-col">
      <div className={`text-4xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-sm font-medium text-[var(--text-primary)] mt-2">{label}</div>
      <div className="text-xs text-[var(--text-tertiary)] mt-1 leading-relaxed">{subtitle}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{children}</h3>
}

const TOOLTIP_STYLE = {
  background: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: 8,
  fontSize: 12,
}

export default function VarianceAnalysis({
  data,
  advancedAnalysis,
}: {
  data: CrossFitData
  advancedAnalysis: AdvancedAnalysis
}) {
  const { entropy, hhi, pareto, autocorrelation, markov, restDay } = advancedAnalysis

  // --- Score card computations ---

  const variancePct = Math.round(entropy.varianceScore)
  const varianceColor =
    variancePct >= 80 ? 'text-emerald-400' : variancePct >= 60 ? 'text-amber-400' : 'text-red-400'

  const concentrationPct = Math.round((1 - hhi.normalizedHHI) * 100)
  const concentrationColor =
    concentrationPct >= 80 ? 'text-emerald-400' : concentrationPct >= 60 ? 'text-amber-400' : 'text-red-400'

  const paretoThresholdIdx = pareto.findIndex((p) => p.cumPct >= 80)
  const paretoCount = paretoThresholdIdx === -1 ? pareto.length : paretoThresholdIdx + 1
  const paretoTotal = pareto.length
  const paretoPct = Math.round((paretoCount / paretoTotal) * 100)
  const paretoColor =
    paretoPct <= 30 ? 'text-red-400' : paretoPct <= 50 ? 'text-amber-400' : 'text-emerald-400'

  // --- Pareto chart data ---

  const paretoChartData = useMemo(() => {
    return pareto.map((p) => ({
      name: data.movementDisplay[p.movement] || p.movement,
      count: p.count,
      pct: +p.pct.toFixed(1),
      cumPct: +p.cumPct.toFixed(1),
    }))
  }, [pareto, data.movementDisplay])

  // --- Autocorrelation chart data ---

  const autocorrData = useMemo(() => {
    return autocorrelation.lags.map((l) => ({
      lag: `Lag ${l.lag}`,
      lagNum: l.lag,
      correlation: +l.correlation.toFixed(3),
      significant: l.significant,
    }))
  }, [autocorrelation])

  // --- Markov heatmap data ---

  const markovGrid = useMemo(() => {
    const { states, matrix } = markov
    const cells: { from: string; to: string; prob: number; row: number; col: number }[] = []
    for (let r = 0; r < states.length; r++) {
      for (let c = 0; c < states.length; c++) {
        cells.push({
          from: states[r],
          to: states[c],
          prob: matrix[r]?.[c] ?? 0,
          row: r,
          col: c,
        })
      }
    }
    return cells
  }, [markov])

  const steadyStateData = useMemo(() => {
    return Object.entries(markov.steadyState)
      .map(([state, pct]) => ({
        name: state,
        pct: +(pct * 100).toFixed(1),
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [markov.steadyState])

  // --- Rest day data ---

  const modalityBeforeData = useMemo(() =>
    Object.entries(restDay.modalityBeforeRest)
      .map(([name, value]) => ({ name, value: +(value * 100).toFixed(1) }))
      .sort((a, b) => b.value - a.value),
    [restDay.modalityBeforeRest]
  )

  const modalityAfterData = useMemo(() =>
    Object.entries(restDay.modalityAfterRest)
      .map(([name, value]) => ({ name, value: +(value * 100).toFixed(1) }))
      .sort((a, b) => b.value - a.value),
    [restDay.modalityAfterRest]
  )

  // --- Color helpers ---

  const MODALITY_COLOR_MAP: Record<string, string> = {
    M: '#f43f5e',
    G: '#3b82f6',
    W: '#f59e0b',
    MG: '#a855f7',
    MW: '#ef4444',
    GW: '#06b6d4',
    MGW: '#10b981',
    Monostructural: '#f43f5e',
    Gymnastics: '#3b82f6',
    Weightlifting: '#f59e0b',
  }

  function getModalityColor(name: string): string {
    return MODALITY_COLOR_MAP[name] || '#6b7280'
  }

  function getProbColor(prob: number): string {
    if (prob >= 0.4) return '#10b981'
    if (prob >= 0.3) return '#34d399'
    if (prob >= 0.2) return '#6ee7b7'
    if (prob >= 0.1) return '#a7f3d0'
    return 'var(--panel-bg-hover)'
  }

  return (
    <div className="space-y-8">
      {/* ========== HEADER ========== */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Is CrossFit Really "Constantly Varied"?
        </h2>
        <p className="text-sm text-[var(--text-tertiary)] leading-relaxed max-w-3xl">
          Greg Glassman says CrossFit is "constantly varied functional movements at high intensity."
          Let's test the "varied" part with math. We'll use information theory, concentration
          indices, and sequence analysis to measure just how random (or not) the programming really is.
        </p>
      </div>

      {/* ========== THREE BIG SCORE CARDS ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScoreCard
          value={`${variancePct}%`}
          label="Variance Score"
          subtitle={
            variancePct >= 80
              ? 'Highly varied - close to truly random selection'
              : variancePct >= 60
                ? 'Moderately varied - some movements are favored'
                : 'Low variance - programming is concentrated on fewer movements'
          }
          color={varianceColor}
        />
        <ScoreCard
          value={`${concentrationPct}%`}
          label="Spread Score"
          subtitle={
            concentrationPct >= 80
              ? 'Love is spread around evenly across movements'
              : concentrationPct >= 60
                ? 'Somewhat concentrated - a few movements get extra attention'
                : 'Heavily concentrated on a handful of movements'
          }
          color={concentrationColor}
        />
        <ScoreCard
          value={`${paretoCount} of ${paretoTotal}`}
          label="Pareto Ratio"
          subtitle={`Just ${paretoCount} movements make up 80% of all programming. That's ${paretoPct}% of the movement library doing most of the work.`}
          color={paretoColor}
        />
      </div>

      {/* Explain the three scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10">
          <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
            If CrossFit picked movements completely randomly out of a hat, this would be 100%.
            The actual score tells us how close to perfectly random the programming is.
            This uses Shannon entropy - the same math that measures how unpredictable a message is.
          </p>
        </div>
        <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10">
          <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
            Are a few movements hogging all the attention, or is the love spread around? This is
            the inverse of the Herfindahl-Hirschman Index (HHI) - the same tool economists use
            to measure if a market is dominated by monopolies. 100% means perfectly even.
          </p>
        </div>
        <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10">
          <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
            This is the Pareto Principle or "80/20 Rule." In most systems, a small number of
            things do most of the work. Here we see how many movements account for 80% of all
            CrossFit.com programming.
          </p>
        </div>
      </div>

      {/* ========== PARETO CHART ========== */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)]">
        <SectionTitle>Movement Frequency - Pareto Analysis</SectionTitle>
        <ExplainerBox>
          Each bar shows how often a movement appears. The orange line shows the running
          total - once it crosses the dashed 80% line, you've found the "vital few" movements
          that dominate programming. Everything to the right is the "trivial many."
        </ExplainerBox>

        <div style={{width:"100%",height:Math.max(400, paretoChartData.length * 22)}}><ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            layout="vertical"
            data={paretoChartData}
            margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, name: any) => {
                if (name === 'count') return [Number(value).toLocaleString(), 'Appearances']
                if (name === 'cumPct') return [`${value}%`, 'Cumulative %']
                return [value, name]
              }}
            />
            <Bar dataKey="count" barSize={14} radius={[0, 4, 4, 0]}>
              {paretoChartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.cumPct <= 80 ? '#6366f1' : '#334155'}
                  fillOpacity={entry.cumPct <= 80 ? 0.85 : 0.4}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="cumPct"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              name="cumPct"
            />
            {/* 80% threshold reference - rendered as a subtle area at cumPct=80 */}
          </ComposedChart>
        </ResponsiveContainer></div>

        <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-indigo-500" />
            Top 80% (vital few)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-slate-700" />
            Bottom 20% (trivial many)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-orange-500" />
            Cumulative % line
          </div>
          <div className="text-[var(--text-muted)]">- - 80% threshold</div>
        </div>
      </div>

      {/* ========== AUTOCORRELATION CHART ========== */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)]">
        <SectionTitle>Autocorrelation - Does CrossFit Repeat Patterns?</SectionTitle>
        <ExplainerBox>
          Does CrossFit repeat patterns on a cycle? Each bar shows how similar today's workout is
          to the workout N days ago. If the bar at "Lag 7" is tall, there's a weekly pattern.
          If "Lag 1" is tall, similar workouts come back-to-back. Highlighted bars are statistically
          significant - meaning the pattern is unlikely to be random chance.
        </ExplainerBox>

        <div style={{width:"100%",height:280}}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={autocorrData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="lag"
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={[-0.3, 0.5]}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, _name: any, props: any) => [
                `${Number(value).toFixed(3)}${props.payload.significant ? ' (significant)' : ''}`,
                'Correlation',
              ]}
            />
            <Bar dataKey="correlation" barSize={20} radius={[4, 4, 0, 0]}>
              {autocorrData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.significant ? '#f59e0b' : '#334155'}
                  fillOpacity={entry.significant ? 0.9 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>

        {/* Periodicity verdict */}
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="bg-[var(--panel-bg-hover)] rounded-lg px-4 py-3 border border-[var(--panel-border)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Periodicity Detected?
            </div>
            <div
              className={`text-sm font-semibold font-mono ${
                autocorrelation.hasPeriodicity ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {autocorrelation.hasPeriodicity ? 'Yes' : 'No'}
            </div>
          </div>
          {autocorrelation.dominantPeriod !== null && (
            <div className="bg-[var(--panel-bg-hover)] rounded-lg px-4 py-3 border border-[var(--panel-border)]">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Dominant Period
              </div>
              <div className="text-sm font-semibold font-mono text-amber-400">
                {autocorrelation.dominantPeriod} days
              </div>
            </div>
          )}
          <div className="bg-[var(--panel-bg-hover)] rounded-lg px-4 py-3 border border-[var(--panel-border)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Verdict
            </div>
            <div className="text-xs text-[var(--text-secondary)] max-w-xs">
              {autocorrelation.hasPeriodicity
                ? `Programming shows a repeating cycle every ~${autocorrelation.dominantPeriod} days. This means CrossFit.com follows a structured pattern, not pure randomness.`
                : 'No significant repeating cycle detected. The programming does not follow an obvious periodic schedule - it looks genuinely aperiodic.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-amber-500" />
            Statistically significant
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-slate-700" />
            Not significant
          </div>
        </div>
      </div>

      {/* ========== MARKOV TRANSITION HEATMAP ========== */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)]">
        <SectionTitle>Markov Transition Matrix - What Follows What?</SectionTitle>
        <ExplainerBox>
          If today's workout is Gymnastics, what's tomorrow most likely to be? This table shows
          the probability of each transition. Read it row-by-row: pick today's modality on the
          left, then look across to see the odds for tomorrow. If programming were truly random,
          every cell in a row would have the same value.
        </ExplainerBox>

        {/* Heatmap grid */}
        <div className="overflow-x-auto">
          <table className="mx-auto border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-[10px] text-[var(--text-muted)] font-medium">Today \ Tomorrow</th>
                {markov.states.map((s) => (
                  <th key={s} className="p-2 text-[10px] text-[var(--text-tertiary)] font-medium text-center">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {markov.states.map((fromState, rowIdx) => (
                <tr key={fromState}>
                  <td className="p-2 text-[10px] text-[var(--text-tertiary)] font-medium">{fromState}</td>
                  {markov.states.map((toState, colIdx) => {
                    const prob = markov.matrix[rowIdx]?.[colIdx] ?? 0
                    return (
                      <td
                        key={toState}
                        className="p-2 text-center"
                        title={`P(${toState} | ${fromState}) = ${(prob * 100).toFixed(1)}%`}
                      >
                        <div
                          className="w-14 h-10 rounded-md flex items-center justify-center text-[11px] font-mono font-semibold transition-colors"
                          style={{
                            backgroundColor: getProbColor(prob),
                            color: prob >= 0.2 ? '#0f172a' : '#94a3b8',
                          }}
                        >
                          {(prob * 100).toFixed(0)}%
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Color legend */}
        <div className="flex items-center justify-center gap-1 mt-4">
          <span className="text-[10px] text-[var(--text-muted)] mr-2">Low</span>
          {[0.05, 0.1, 0.2, 0.3, 0.4].map((p) => (
            <div
              key={p}
              className="w-6 h-3 rounded-sm"
              style={{ backgroundColor: getProbColor(p) }}
            />
          ))}
          <span className="text-[10px] text-[var(--text-muted)] ml-2">High</span>
        </div>

        {/* Steady-state distribution */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
            Steady-State Distribution
          </h4>
          <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
            <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
            <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
              If CrossFit.com kept programming forever following these same transition patterns,
              this is what the long-run mix would settle into. It's the mathematical equilibrium
              - like asking "what does the river look like after all the eddies smooth out?"
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {steadyStateData.map((s) => (
              <div
                key={s.name}
                className="bg-[var(--panel-bg-hover)] rounded-lg px-4 py-3 border border-[var(--panel-border)] flex flex-col items-center min-w-[100px]"
              >
                <div
                  className="text-lg font-bold font-mono"
                  style={{ color: getModalityColor(s.name) }}
                >
                  {s.pct}%
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)] mt-1">{s.name}</div>
              </div>
            ))}
          </div>

          {/* Visual bar */}
          <div className="mt-3 flex h-5 rounded-full overflow-hidden">
            {steadyStateData.map((s) => (
              <div
                key={s.name}
                className="h-full transition-all"
                style={{
                  width: `${s.pct}%`,
                  backgroundColor: getModalityColor(s.name),
                  opacity: 0.7,
                }}
                title={`${s.name}: ${s.pct}%`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {steadyStateData.map((s) => (
              <div
                key={s.name}
                className="text-[9px] font-mono"
                style={{ color: getModalityColor(s.name), width: `${s.pct}%`, textAlign: 'center' }}
              >
                {s.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========== REST DAY INTELLIGENCE ========== */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)]">
        <SectionTitle>Rest Day Intelligence</SectionTitle>
        <ExplainerBox>
          Are rest days random, or does CrossFit.com give you rest after harder days? Smart coaches
          program rest strategically - backing off after high-volume days and ramping up after
          recovery. Let's see if the data supports deliberate rest-day placement.
        </ExplainerBox>

        {/* Before/After stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-[var(--panel-bg-hover)] rounded-xl p-5 border border-[var(--panel-border)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Day Before Rest
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-orange-400">
                {restDay.avgMovementsBeforeRest.toFixed(1)}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">avg movements</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {modalityBeforeData.map((m) => (
                <div key={m.name} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getModalityColor(m.name) }}
                  />
                  <span className="text-[10px] text-[var(--text-tertiary)] w-24">{m.name}</span>
                  <div className="flex-1 h-1.5 bg-[var(--panel-bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.value}%`,
                        backgroundColor: getModalityColor(m.name),
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] w-10 text-right">
                    {m.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--panel-bg-hover)] rounded-xl p-5 border border-[var(--panel-border)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Day After Rest
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-cyan-400">
                {restDay.avgMovementsAfterRest.toFixed(1)}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">avg movements</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {modalityAfterData.map((m) => (
                <div key={m.name} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getModalityColor(m.name) }}
                  />
                  <span className="text-[10px] text-[var(--text-tertiary)] w-24">{m.name}</span>
                  <div className="flex-1 h-1.5 bg-[var(--panel-bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.value}%`,
                        backgroundColor: getModalityColor(m.name),
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] w-10 text-right">
                    {m.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Movement count comparison */}
        <div className="bg-[var(--panel-bg-hover)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Movement Volume Comparison
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-orange-400">Before Rest</span>
                <span className="text-xs font-mono text-orange-400">
                  {restDay.avgMovementsBeforeRest.toFixed(1)}
                </span>
              </div>
              <div className="h-3 bg-[var(--panel-bg)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500/70 transition-all"
                  style={{
                    width: `${
                      (restDay.avgMovementsBeforeRest /
                        Math.max(restDay.avgMovementsBeforeRest, restDay.avgMovementsAfterRest)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono">vs</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-cyan-400">After Rest</span>
                <span className="text-xs font-mono text-cyan-400">
                  {restDay.avgMovementsAfterRest.toFixed(1)}
                </span>
              </div>
              <div className="h-3 bg-[var(--panel-bg)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500/70 transition-all"
                  style={{
                    width: `${
                      (restDay.avgMovementsAfterRest /
                        Math.max(restDay.avgMovementsBeforeRest, restDay.avgMovementsAfterRest)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Verdict */}
          <div className="mt-4 flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                restDay.isStrategic ? 'bg-emerald-500' : 'bg-slate-500'
              }`}
            />
            <div>
              <div
                className={`text-sm font-semibold ${
                  restDay.isStrategic ? 'text-emerald-400' : 'text-[var(--text-tertiary)]'
                }`}
              >
                {restDay.isStrategic ? 'Strategic Rest Days Detected' : 'Rest Days Appear Random'}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {restDay.isStrategic
                  ? `The data shows ${
                      restDay.avgMovementsBeforeRest > restDay.avgMovementsAfterRest
                        ? 'higher volume before rest days, suggesting recovery is programmed after harder sessions'
                        : 'different modality patterns around rest days, suggesting deliberate programming choices'
                    }. This is the hallmark of intentional program design.`
                  : 'The volume and modality patterns before and after rest days are similar, suggesting rest days are placed on a fixed schedule rather than in response to training load.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== FINAL VERDICT ========== */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)]">
        <SectionTitle>The Verdict</SectionTitle>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                variancePct >= 80 ? 'bg-emerald-500' : variancePct >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}
            />
            <div>
              <span className="text-sm text-[var(--text-primary)] font-medium">Entropy: </span>
              <span className="text-sm text-[var(--text-tertiary)]">
                {variancePct >= 80
                  ? `At ${variancePct}% variance, CrossFit.com programming is impressively close to truly random movement selection. The "constantly varied" claim holds up well.`
                  : variancePct >= 60
                    ? `At ${variancePct}% variance, programming is moderately varied but shows clear favorites. It's not random - some movements get significantly more love.`
                    : `At ${variancePct}% variance, programming is far from random. A small set of movements dominates, undermining the "constantly varied" claim.`}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                concentrationPct >= 80 ? 'bg-emerald-500' : concentrationPct >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}
            />
            <div>
              <span className="text-sm text-[var(--text-primary)] font-medium">Concentration: </span>
              <span className="text-sm text-[var(--text-tertiary)]">
                {hhi.interpretation}. The HHI of {hhi.hhi.toFixed(4)} (normalized: {hhi.normalizedHHI.toFixed(4)})
                {hhi.normalizedHHI < 0.15
                  ? ' indicates a competitive, well-distributed movement selection.'
                  : ' suggests moderate concentration - some movements are used disproportionately.'}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                autocorrelation.hasPeriodicity ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <div>
              <span className="text-sm text-[var(--text-primary)] font-medium">Periodicity: </span>
              <span className="text-sm text-[var(--text-tertiary)]">
                {autocorrelation.hasPeriodicity
                  ? `A repeating cycle of ~${autocorrelation.dominantPeriod} days was detected, meaning programming follows a structured template rather than being purely spontaneous.`
                  : 'No significant repeating cycles were found. Day-to-day programming appears genuinely non-periodic - a point in favor of "constantly varied."'}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                restDay.isStrategic ? 'bg-emerald-500' : 'bg-slate-500'
              }`}
            />
            <div>
              <span className="text-sm text-[var(--text-primary)] font-medium">Rest Days: </span>
              <span className="text-sm text-[var(--text-tertiary)]">
                {restDay.isStrategic
                  ? 'Rest days show signs of strategic placement, suggesting an intelligent hand behind the programming - not just a random number generator.'
                  : 'Rest days appear to follow a fixed schedule rather than responding to training load. This is neither good nor bad - just a scheduling choice.'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
