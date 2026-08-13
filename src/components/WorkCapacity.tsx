import { useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, Legend,
} from 'recharts'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import { FUNCTIONAL_PATTERN_LABELS, FUNCTIONAL_PATTERN_COLORS, type FunctionalPattern } from '../data/movement-taxonomy'

export default function WorkCapacity({ data, analysis }: { data: CrossFitData; analysis: AnalysisResults }) {
  // Complexity over time
  const complexityData = analysis.complexityByYear

  // Trending patterns
  const trendData = useMemo(() => {
    const items = [
      ...analysis.trendingUp.map((t) => ({ ...t, direction: 'up' as const })),
      ...analysis.trendingDown.map((t) => ({ ...t, direction: 'down' as const })),
    ].sort((a, b) => b.rSq - a.rSq)
    return items.slice(0, 10)
  }, [analysis])

  // Significant pairings
  const topPairings = analysis.significantPairings.slice(0, 15)
  const overRepresented = topPairings.filter((p) => p.ratio > 1)
  const underRepresented = topPairings.filter((p) => p.ratio < 1)

  // Anomalous workouts
  const anomalies = analysis.anomalousWorkouts.slice(0, 10)

  // Work capacity radar: combine time domain with modality
  const workCapRadar = useMemo(() => {
    const { overview } = data
    const total = overview.total_workouts
    return [
      { axis: 'Sprint (<5m)', value: +((overview.time_domain['Sprint'] || 0) / total * 100).toFixed(1) },
      { axis: 'Short (5-10m)', value: +((overview.time_domain['Short'] || 0) / total * 100).toFixed(1) },
      { axis: 'Medium (10-20m)', value: +((overview.time_domain['Medium'] || 0) / total * 100).toFixed(1) },
      { axis: 'Long (20m+)', value: +((overview.time_domain['Long'] || 0) / total * 100).toFixed(1) },
      { axis: 'Strength/Skill', value: +((overview.time_domain['Strength/Skill'] || 0) / total * 100).toFixed(1) },
    ]
  }, [data])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Work Capacity & Statistical Analysis</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          CrossFit defines fitness as "increased work capacity across broad time and modal domains."
          Here's how the programming measures up - with real statistics.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-5 border border-purple-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Avg Complexity</div>
          <div className="text-3xl font-bold font-mono text-purple-400">{analysis.avgComplexity.toFixed(2)}</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">Scale 1-5 (movements per WOD weighted by skill level)</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Significant Pairings</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{analysis.significantPairings.length}</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">Movement pairs that co-occur at statistically significant rates (p&lt;0.01)</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Anomalous WODs</div>
          <div className="text-2xl font-bold font-mono text-amber-400">{analysis.anomalousWorkouts.length}</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">Workouts with z-score &gt; 2.5 (statistically unusual)</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Work capacity radar */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Work Capacity Distribution (Time Domains)</h3>
          <div style={{width:"100%",height:300}}><ResponsiveContainer width="100%" height="100%">
            <RadarChart data={workCapRadar}>
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer></div>
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">Ideal: equal coverage across all time domains</p>
        </div>

        {/* Complexity over time */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Programming Complexity Over Time</h3>
          <div style={{width:"100%",height:300}}><ResponsiveContainer width="100%" height="100%">
            <LineChart data={complexityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="avg" stroke="#a855f7" strokeWidth={2} dot={{ r: 3, fill: '#a855f7' }} />
            </LineChart>
          </ResponsiveContainer></div>
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">Higher = more complex movements in programming</p>
        </div>
      </div>

      {/* Statistically significant movement pairings */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Statistically Significant Pairings (Chi-squared test, p&lt;0.01)</h3>
        <p className="text-[10px] text-[var(--text-muted)] mb-4">
          These movement pairs appear together at rates that can't be explained by chance.
          Ratio &gt; 1 = appear together more than expected. &lt; 1 = less than expected.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-emerald-400 mb-2">Over-represented (attracted)</div>
            <div className="space-y-1">
              {overRepresented.slice(0, 8).map((p) => (
                <div key={p.pair} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <span className="text-xs text-[var(--text-secondary)]">{p.pair}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.observed} obs / {p.expected} exp</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{p.ratio}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-rose-400 mb-2">Under-represented (repelled)</div>
            <div className="space-y-1">
              {underRepresented.slice(0, 8).map((p) => (
                <div key={p.pair} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                  <span className="text-xs text-[var(--text-secondary)]">{p.pair}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.observed} obs / {p.expected} exp</span>
                    <span className="text-xs font-mono font-bold text-rose-400">{p.ratio}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trending patterns */}
      {trendData.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Statistically Significant Trends (Mann-Kendall test, p&lt;0.05)</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-4">
            Functional patterns with statistically significant upward or downward trends over 25 years.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-emerald-400 mb-2">Trending Up</div>
              {analysis.trendingUp.map((t) => (
                <div key={t.name} className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-sm">↑</span>
                    <span className="text-xs text-[var(--text-secondary)]">{FUNCTIONAL_PATTERN_LABELS[t.name as FunctionalPattern] || t.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">R²={t.rSq}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-medium text-rose-400 mb-2">Trending Down</div>
              {analysis.trendingDown.map((t) => (
                <div key={t.name} className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
                  <div className="flex items-center gap-2">
                    <span className="text-rose-400 text-sm">↓</span>
                    <span className="text-xs text-[var(--text-secondary)]">{FUNCTIONAL_PATTERN_LABELS[t.name as FunctionalPattern] || t.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">R²={t.rSq}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Anomalous workouts */}
      {anomalies.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Anomalous Workouts (Z-score &gt; 2.5)</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-4">
            These workouts are statistical outliers - unusually complex or unusually simple compared to the average.
          </p>
          <div className="space-y-1">
            {anomalies.map((a) => (
              <div key={a.date} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--app-bg)] border border-[var(--panel-border)]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[var(--text-muted)]">{a.date}</span>
                  <span className="text-xs text-[var(--text-primary)]">{a.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--text-tertiary)]">{a.reason}</span>
                  <span className={`text-xs font-mono font-bold ${a.zScore > 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                    z={a.zScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
