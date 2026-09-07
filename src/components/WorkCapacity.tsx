import { useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import { FUNCTIONAL_PATTERN_LABELS, type FunctionalPattern } from '../data/movement-taxonomy'

const TIME_DOMAIN_META: { key: string; label: string; fix: string }[] = [
  { key: 'Sprint', label: 'Sprint (under 5 min)', fix: 'Add one all-out effort under 5 minutes each week - a fast heavy couplet or short intervals with full recovery.' },
  { key: 'Short', label: 'Short (5-10 min)', fix: 'Add one 5-10 minute piece each week - a hard couplet you can push without pacing down.' },
  { key: 'Medium', label: 'Medium (10-20 min)', fix: 'Add one 10-20 minute triplet each week and hold moving pace the whole way.' },
  { key: 'Long', label: 'Long (20+ min)', fix: 'Add one 20+ minute piece each week - long intervals or a steady grind that keeps you moving.' },
  { key: 'Strength/Skill', label: 'Strength/Skill', fix: 'Add a dedicated heavy day or skill session each week - strength should not only ride inside metcons.' },
]

export default function WorkCapacity({ data, analysis }: { data: CrossFitData; analysis: AnalysisResults }) {
  // Complexity over time
  const complexityData = analysis.complexityByYear

  // Significant pairings.
  // Filter the FULL list first, then slice: repelled pairs are significant at
  // p<0.01 but their chi-squared values are far smaller than the attraction
  // outliers, so slicing the top of the combined list first hides all of them.
  const overRepresented = useMemo(
    () => analysis.significantPairings.filter((p) => p.ratio > 1).slice(0, 8),
    [analysis],
  )
  const underRepresented = useMemo(
    () => analysis.significantPairings.filter((p) => p.ratio < 1).slice(0, 8),
    [analysis],
  )

  // Anomalous workouts
  const anomalies = analysis.anomalousWorkouts.slice(0, 10)

  const hasTrends = analysis.trendingUp.length > 0 || analysis.trendingDown.length > 0

  // Work capacity radar: time-domain distribution
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

  // Coach takeaways, computed at runtime from the time-domain distribution
  // and the pairing analysis. Nothing here is hardcoded to today's numbers.
  const takeaways = useMemo(() => {
    const td = data.overview.time_domain
    const domains = TIME_DOMAIN_META.map((m) => ({ ...m, count: td[m.key] || 0 }))
    const classified = domains.reduce((s, d) => s + d.count, 0)
    const items: { claim: string; action: string }[] = []
    if (classified > 0) {
      const shares = domains.map((d) => ({ ...d, pct: (d.count / classified) * 100 }))
      const top = shares.reduce((a, b) => (b.pct > a.pct ? b : a))
      const bottom = shares.reduce((a, b) => (b.pct < a.pct ? b : a))
      items.push({
        claim: `${top.label} dominates at ${Math.round(top.pct)}% of classified WODs.`,
        action: 'That is the stimulus you get by default from main-site programming - your extra work should live somewhere else.',
      })
      items.push({
        claim: `${bottom.label} is the most underprogrammed domain at ${Math.round(bottom.pct)}%.`,
        action: bottom.fix,
      })
      const underTenPct = shares
        .filter((d) => d.key === 'Sprint' || d.key === 'Short')
        .reduce((s, d) => s + d.pct, 0)
      if (underTenPct < 25) {
        items.push({
          claim: `Only ${Math.round(underTenPct)}% of classified WODs finish inside 10 minutes.`,
          action: 'Short hard efforts build power and pain tolerance - put one sub-10 piece in every training week.',
        })
      } else {
        items.push({
          claim: `${Math.round(underTenPct)}% of classified WODs finish inside 10 minutes.`,
          action: 'Short capacity is well covered - spend your extra sessions on the thinner domains instead.',
        })
      }
    }
    const repelled = analysis.significantPairings.filter((p) => p.ratio < 1)
    if (repelled.length > 0) {
      items.push({
        claim: `${repelled.length} movement pairs are statistically avoided - ${repelled[0].pair} tops the list at ${repelled[0].ratio}x expected.`,
        action: 'The hopper does not care what crossfit.com avoids - pair them yourself so the combination is not novel on test day.',
      })
    }
    return items.slice(0, 4)
  }, [data, analysis])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl text-[var(--text-primary)]" style={{ fontFamily: "'Anton', sans-serif", letterSpacing: '0.5px' }}>WORK CAPACITY &amp; STATISTICAL ANALYSIS</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          CrossFit defines fitness as "increased work capacity across broad time and modal domains."
          Here's how the programming measures up - with real statistics.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Avg Complexity</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{analysis.avgComplexity.toFixed(2)}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Scale 1-5 (average skill level of the movements in each WOD)</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Significant Pairings</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{analysis.significantPairings.length}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Movement pairs that co-occur at statistically significant rates (p&lt;0.01)</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Anomalous WODs</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{analysis.anomalousWorkouts.length}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Workouts with z-score &gt; 2.5 (statistically unusual)</div>
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
              <Radar dataKey="value" stroke="#019644" fill="#019644" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer></div>
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">Ideal: equal coverage across all time domains</p>
        </div>

        {/* Complexity over time */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Programming Complexity Over Time</h3>
        <p className="text-[10px] text-[var(--text-muted)] mb-2 -mt-2 leading-relaxed">Rest-day and article entries are excluded. 2024-2025 values read low: movement detection in that span also picked up scaling-option text, which drags the average down until those entries are re-classified. Measured on a uniform basis, current programming sits near the 2001-2010 baseline.</p>
          <div style={{width:"100%",height:300}}><ResponsiveContainer width="100%" height="100%">
            <LineChart data={complexityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="avg" stroke="#019644" strokeWidth={2} dot={{ r: 3, fill: '#019644' }} />
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
            <div className="text-xs font-semibold uppercase tracking-wider text-[#019644] mb-2">Over-represented (attracted)</div>
            <div className="space-y-1">
              {overRepresented.map((p) => (
                <div key={p.pair} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)] border-l-2 border-l-[#019644]">
                  <span className="text-xs text-[var(--text-secondary)]">{p.pair}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.observed} obs / {p.expected} exp</span>
                    <span className="text-xs font-mono font-bold text-[#019644]">{p.ratio}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Under-represented (repelled)</div>
            {underRepresented.length > 0 ? (
              <div className="space-y-1">
                {underRepresented.map((p) => (
                  <div key={p.pair} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[var(--panel-bg-2)] border border-[var(--panel-border)]">
                    <span className="text-xs text-[var(--text-secondary)]">{p.pair}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.observed} obs / {p.expected} exp</span>
                      <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{p.ratio}x</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)] py-1.5">
                No movement pair is avoided at statistical significance. 26 years of programming repels nothing - only attracts.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Trending patterns */}
      {hasTrends && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Statistically Significant Trends (Mann-Kendall test, p&lt;0.05)</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-4">
            Functional patterns with statistically significant upward or downward trends over 25 years.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#019644] mb-2">Trending Up</div>
              {analysis.trendingUp.map((t) => (
                <div key={t.name} className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#019644] text-sm">↑</span>
                    <span className="text-xs text-[var(--text-secondary)]">{FUNCTIONAL_PATTERN_LABELS[t.name as FunctionalPattern] || t.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">R²={t.rSq}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Trending Down</div>
              {analysis.trendingDown.map((t) => (
                <div key={t.name} className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-tertiary)] text-sm">↓</span>
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
                  <span className="text-xs font-mono font-bold text-[var(--text-primary)]">z={a.zScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coach takeaways */}
      {takeaways.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)] border-l-2 border-l-[#019644]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#019644] mb-3">What to do with this</h3>
          <div className="space-y-3">
            {takeaways.map((t) => (
              <div key={t.claim}>
                <p className="text-sm font-bold text-[var(--text-primary)]">{t.claim}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
