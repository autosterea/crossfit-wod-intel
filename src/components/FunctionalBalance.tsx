import { useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import { FUNCTIONAL_PATTERN_LABELS, FUNCTIONAL_PATTERN_COLORS, MUSCLE_GROUP_LABELS, type FunctionalPattern } from '../data/movement-taxonomy'

const GREEN = '#019644'
const NEUTRAL = '#5f7568'
const WARN = '#d97706'

function RatioGauge({ label, ratio, leftLabel, rightLabel }: {
  label: string; ratio: number; leftLabel: string; rightLabel: string
}) {
  const pct = Math.min(Math.max((ratio / (ratio + 1)) * 100, 5), 95)
  const isBalanced = ratio >= 0.8 && ratio <= 1.25
  return (
    <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="text-xs font-mono" style={{ color: isBalanced ? GREEN : WARN }}>
          {ratio.toFixed(2)}:1 {isBalanced ? '(Balanced)' : '(Imbalanced)'}
        </span>
      </div>
      <div className="relative h-6 rounded-full overflow-hidden bg-[var(--panel-bg-hover)]">
        <div className="absolute inset-y-0 left-0 rounded-l-full transition-all" style={{ width: `${pct}%`, background: GREEN }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full transition-all" style={{ width: `${100 - pct}%`, background: NEUTRAL }} />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white font-bold">
          {pct.toFixed(0)}% / {(100 - pct).toFixed(0)}%
        </div>
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] font-medium" style={{ color: GREEN }}>{leftLabel}</span>
        <span className="text-[10px] font-medium" style={{ color: NEUTRAL }}>{rightLabel}</span>
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
  const olyTotal = analysis.functionalPatterns['olympic-lift']

  const patternCount = Object.keys(analysis.functionalPatterns).length
  const balancePct = (1 - analysis.functionalBalance) * 100

  // Coach takeaways, derived from the live ratios so a rebuild can never contradict them
  const takeaways: { claim: string; action: string }[] = []
  if (pushTotal > 0 && pullTotal > 0) {
    const r = analysis.pushPullRatio
    if (r > 1.1) {
      takeaways.push({
        claim: `Push outnumbers pull by ${((r - 1) * 100).toFixed(0)}% (${pushTotal.toLocaleString()} vs ${pullTotal.toLocaleString()} WODs).`,
        action: 'Superset a strict pull with every pressing piece - rows after push-ups, strict pull-ups after jerks - to keep shoulders healthy.',
      })
    } else if (r < 0.9) {
      takeaways.push({
        claim: `Pull outnumbers push by ${((1 / r - 1) * 100).toFixed(0)}% (${pullTotal.toLocaleString()} vs ${pushTotal.toLocaleString()} WODs).`,
        action: 'Bias your accessory work to pressing - strict press, dips and push-up volume on pull-heavy days.',
      })
    } else {
      takeaways.push({
        claim: `Push and pull sit within ${(Math.abs(r - 1) * 100).toFixed(0)}% of each other.`,
        action: 'No corrective needed - keep pairing a pull with every press in your accessory work and the balance holds.',
      })
    }
  }
  if (analysis.squatHingeRatio > 0) {
    const sh = analysis.squatHingeRatio
    if (sh > 1.25) {
      takeaways.push({
        claim: `Squat patterns outnumber hinges by ${((sh - 1) * 100).toFixed(0)}%.`,
        action: 'Give the posterior chain its own slot - deadlifts, kettlebell swings or good mornings once or twice a week.',
      })
    } else if (sh < 0.8) {
      takeaways.push({
        claim: `Hinge patterns outnumber squats by ${((1 / sh - 1) * 100).toFixed(0)}%.`,
        action: 'Add squat volume on your own time - front squats and lunges cover the gap without beating up your back.',
      })
    } else {
      takeaways.push({
        claim: `Squat to hinge sits at ${sh.toFixed(2)}:1 - inside the healthy band.`,
        action: 'Keep alternating knee-dominant and hip-dominant lower-body work and this stays a non-issue.',
      })
    }
  }
  if (barData.length > 0) {
    const least = barData[barData.length - 1]
    takeaways.push({
      claim: `${least.name} is the least-programmed pattern at ${least.pct}% of WODs.`,
      action: 'Main-site programming will not fill that hole for you - slot it into warm-ups or a weekly accessory block.',
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl text-[var(--text-primary)] uppercase" style={{ fontFamily: "'Anton', sans-serif", letterSpacing: '0.5px' }}>Functional Movement Balance</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Push/Pull, Squat/Hinge, Upper/Lower - how balanced is CrossFit's programming across fundamental movement patterns?
        </p>
      </div>

      {/* Balance score + key ratios */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Overall Balance</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {balancePct.toFixed(0)}%
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">100% = all {patternCount} patterns hit equally often</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">100 minus the share of total pattern volume you would have to shift to even out all {patternCount} patterns.</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Push Movements</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{pushTotal.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{((pushTotal / data.overview.total_workouts) * 100).toFixed(1)}% of WODs</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Pull Movements</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{pullTotal.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{((pullTotal / data.overview.total_workouts) * 100).toFixed(1)}% of WODs</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Olympic Lifts</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{olyTotal.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{((olyTotal / data.overview.total_workouts) * 100).toFixed(1)}% of WODs</div>
        </div>
      </div>

      {/* Ratio gauges */}
      <div className="grid grid-cols-2 gap-3">
        <RatioGauge label="Push : Pull Ratio" ratio={analysis.pushPullRatio} leftLabel="Push" rightLabel="Pull" />
        <RatioGauge label="Squat : Hinge Ratio" ratio={analysis.squatHingeRatio} leftLabel="Squat" rightLabel="Hinge" />
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
              <Radar dataKey="pct" stroke={GREEN} fill={GREEN} fillOpacity={0.15} strokeWidth={2} />
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
              <Bar dataKey="pct" fill={GREEN} radius={[0, 4, 4, 0]} />
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
            <Bar dataKey="pct" fill={GREEN} radius={[0, 4, 4, 0]} />
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

      {/* Coach takeaways */}
      <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] border-l-2 border-l-[#019644] rounded-xl p-5">
        <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-3">What to do with this</h3>
        <div className="space-y-3">
          {takeaways.map((t) => (
            <p key={t.claim} className="text-sm text-[var(--text-secondary)] leading-relaxed">
              <span className="font-bold text-[var(--text-primary)]">{t.claim}</span> {t.action}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
