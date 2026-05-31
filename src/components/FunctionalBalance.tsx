import { useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  AreaChart, Area,
} from 'recharts'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import { FUNCTIONAL_PATTERN_LABELS, FUNCTIONAL_PATTERN_COLORS, MUSCLE_GROUP_LABELS, type FunctionalPattern } from '../data/movement-taxonomy'

function RatioGauge({ label, ratio, leftLabel, rightLabel, leftColor, rightColor }: {
  label: string; ratio: number; leftLabel: string; rightLabel: string; leftColor: string; rightColor: string
}) {
  const pct = Math.min(Math.max((ratio / (ratio + 1)) * 100, 5), 95)
  const isBalanced = ratio >= 0.8 && ratio <= 1.25
  return (
    <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <span className={`text-xs font-mono ${isBalanced ? 'text-emerald-400' : 'text-amber-400'}`}>
          {ratio.toFixed(2)}:1 {isBalanced ? '(Balanced)' : '(Imbalanced)'}
        </span>
      </div>
      <div className="relative h-6 rounded-full overflow-hidden bg-[var(--panel-bg-hover)]">
        <div className="absolute inset-y-0 left-0 rounded-l-full transition-all" style={{ width: `${pct}%`, background: leftColor, opacity: 0.7 }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full transition-all" style={{ width: `${100 - pct}%`, background: rightColor, opacity: 0.7 }} />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white font-bold">
          {pct.toFixed(0)}% / {(100 - pct).toFixed(0)}%
        </div>
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: leftColor }}>{leftLabel}</span>
        <span className="text-[10px]" style={{ color: rightColor }}>{rightLabel}</span>
      </div>
    </div>
  )
}

export default function FunctionalBalance({ data, analysis }: { data: CrossFitData; analysis: AnalysisResults }) {
  const radarData = useMemo(() =>
    Object.entries(analysis.functionalPatterns)
      .map(([pattern, count]) => ({
        pattern: FUNCTIONAL_PATTERN_LABELS[pattern as FunctionalPattern] || pattern,
        count,
        pct: +((count / data.overview.total_workouts) * 100).toFixed(1),
      })),
    [analysis, data]
  )

  const barData = useMemo(() =>
    Object.entries(analysis.functionalPatterns)
      .map(([pattern, count]) => ({
        id: pattern,
        name: FUNCTIONAL_PATTERN_LABELS[pattern as FunctionalPattern] || pattern,
        count,
        pct: +((count / data.overview.total_workouts) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count),
    [analysis, data]
  )

  const muscleData = useMemo(() =>
    Object.entries(analysis.muscleGroups)
      .map(([muscle, count]) => ({
        name: MUSCLE_GROUP_LABELS[muscle as keyof typeof MUSCLE_GROUP_LABELS] || muscle,
        count,
        pct: +((count / data.overview.total_workouts) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14),
    [analysis, data]
  )

  // Grouped patterns
  const pushTotal = analysis.functionalPatterns['vertical-push'] + analysis.functionalPatterns['horizontal-push']
  const pullTotal = analysis.functionalPatterns['vertical-pull'] + analysis.functionalPatterns['horizontal-pull']
  const locoTotal = analysis.functionalPatterns['locomotion']
  const olyTotal = analysis.functionalPatterns['olympic-lift']

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Functional Movement Balance</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Push/Pull, Squat/Hinge, Upper/Lower — how balanced is CrossFit's programming across fundamental movement patterns?
        </p>
      </div>

      {/* Balance score + key ratios */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-5 border border-blue-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Overall Balance</div>
          <div className="text-3xl font-bold font-mono text-blue-400">
            {((1 - analysis.functionalBalance) * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">100% = perfect distribution</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Push Movements</div>
          <div className="text-2xl font-bold font-mono text-rose-400">{pushTotal.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{((pushTotal / data.overview.total_workouts) * 100).toFixed(1)}% of WODs</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Pull Movements</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{pullTotal.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{((pullTotal / data.overview.total_workouts) * 100).toFixed(1)}% of WODs</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Olympic Lifts</div>
          <div className="text-2xl font-bold font-mono text-purple-400">{olyTotal.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{((olyTotal / data.overview.total_workouts) * 100).toFixed(1)}% of WODs</div>
        </div>
      </div>

      {/* Ratio gauges */}
      <div className="grid grid-cols-2 gap-3">
        <RatioGauge label="Push : Pull Ratio" ratio={analysis.pushPullRatio} leftLabel="Push" rightLabel="Pull" leftColor="#f43f5e" rightColor="#10b981" />
        <RatioGauge label="Squat : Hinge Ratio" ratio={analysis.squatHingeRatio} leftLabel="Squat" rightLabel="Hinge" leftColor="#3b82f6" rightColor="#a855f7" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Radar */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Movement Pattern Radar</h3>
          <div style={{width:"100%",height:380}}><ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="pattern" tick={{ fontSize: 8, fill: 'var(--chart-axis)' }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="pct" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer></div>
        </div>

        {/* Bar ranking */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Pattern Frequency (% of WODs)</h3>
          <div style={{width:"100%",height:380}}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 110 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} width={105} />
              <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}%`]} />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {barData.map((e) => (
                  <Cell key={e.id} fill={FUNCTIONAL_PATTERN_COLORS[e.id as FunctionalPattern] || '#6b7280'} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </div>
      </div>

      {/* Muscle group coverage */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Muscle Group Coverage (% of WODs targeting each group)</h3>
        <div style={{width:"100%",height:350}}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={muscleData} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} width={115} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v}%`]} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              {muscleData.map((e, i) => (
                <Cell key={e.name} fill={['#f43f5e', '#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#fb923c', '#8b5cf6', '#14b8a6', '#eab308', '#64748b', '#6366f1'][i]} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>
      </div>

      {/* Patterns over time */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Functional Patterns Over Time (WODs per year)</h3>
        <div style={{width:"100%",height:300}}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={analysis.patternsByYear}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} interval={3} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 11 }} />
            {Object.entries(FUNCTIONAL_PATTERN_COLORS).map(([key, color]) => (
              <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.5} />
            ))}
          </AreaChart>
        </ResponsiveContainer></div>
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {Object.entries(FUNCTIONAL_PATTERN_COLORS).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1 text-[8px] text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
              {FUNCTIONAL_PATTERN_LABELS[key as FunctionalPattern]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
