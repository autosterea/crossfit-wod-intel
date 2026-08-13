import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer } from 'recharts'
import type { CrossFitData } from '../types'

interface HopperData {
  score: number
  filledCells: number
  totalCells: number
  matrix: { modality: string; timeDomain: string; count: number }[]
  gaps: { modality: string; timeDomain: string }[]
}

interface CombinationCoverage {
  observedPairs: number
  possiblePairs: number
  coverageScore: number
  unseenPairs: [string, string][]
}

interface AdvancedAnalysis {
  hopper: HopperData
  combinationCoverage: CombinationCoverage
  [key: string]: any
}

const TIME_DOMAINS = ['Sprint', 'Short', 'Medium', 'Long', 'Strength/Skill']
const MODALITIES = ['M', 'G', 'W', 'MG', 'MW', 'GW', 'MGW']

const MODALITY_LABELS: Record<string, string> = {
  M: 'Monostructural (M)',
  G: 'Gymnastics (G)',
  W: 'Weightlifting (W)',
  MG: 'Mono + Gym (MG)',
  MW: 'Mono + Weight (MW)',
  GW: 'Gym + Weight (GW)',
  MGW: 'All Three (MGW)',
}

const TIME_DOMAIN_LABELS: Record<string, string> = {
  Sprint: '<5 min',
  Short: '5-10 min',
  Medium: '10-20 min',
  Long: '20+ min',
  'Strength/Skill': 'S/S Focus',
}

const GAP_DESCRIPTIONS: Record<string, string> = {
  M: 'monostructural only (run, row, bike, etc.)',
  G: 'gymnastics only (pull-ups, handstands, etc.)',
  W: 'weightlifting only (cleans, snatches, etc.)',
  MG: 'monostructural + gymnastics (no barbell)',
  MW: 'monostructural + weightlifting (no gymnastics)',
  GW: 'gymnastics + weightlifting (no cardio element)',
  MGW: 'all three modalities combined',
}

const TIME_DOMAIN_DESCRIPTIONS: Record<string, string> = {
  Sprint: 'under 5 minutes',
  Short: '5-10 minutes',
  Medium: '10-20 minutes',
  Long: 'over 20 minutes',
  'Strength/Skill': 'strength or skill focused (not timed)',
}

const SAMPLE_WORKOUTS: Record<string, string> = {
  'MGW-Sprint': '3 RFT: 5 Power Cleans (135/95), 10 Pull-ups, 200m Sprint',
  'MGW-Short': '3 RFT: 12 Thrusters (95/65), 12 Burpees, 400m Run',
  'MGW-Medium': '5 RFT: 15 Wall Balls, 10 Toes-to-Bar, 500m Row',
  'MGW-Long': 'For time: 1 mile Run, 100 Pull-ups, 200 Push-ups, 300 Squats, 1 mile Run (Murph)',
  'MGW-Strength/Skill': 'EMOM 30: Min 1 - 3 Power Cleans, Min 2 - 5 Strict Pull-ups, Min 3 - 200m Run',
  'M-Sprint': 'Row 500m for time',
  'M-Short': '2K Row for time',
  'M-Medium': '5K Row',
  'M-Long': '10K Row or 1-hour AMRAP: 400m Run',
  'M-Strength/Skill': 'Skill work: Double-under practice, 10×30s on/30s off',
  'G-Sprint': 'Max reps Muscle-ups in 3 minutes',
  'G-Short': 'Tabata: Pull-ups, Push-ups, Sit-ups, Squats',
  'G-Medium': '20 min AMRAP: 5 Handstand Push-ups, 10 Pistols, 15 Pull-ups',
  'G-Long': '30 min AMRAP: 10 Ring Dips, 15 Box Jumps, 20 Sit-ups',
  'G-Strength/Skill': 'Build to max L-sit hold; then 5×5 Strict Handstand Push-ups',
  'W-Sprint': '1RM Snatch (total session under 5 min working time)',
  'W-Short': 'Grace - 30 Clean & Jerks for time (135/95)',
  'W-Medium': '10 RFT: 3 Power Cleans (185/125), 3 Front Squats, 3 Push Jerks',
  'W-Long': 'Every 2 min for 30 min: 2 Squat Cleans + 1 Jerk, climbing',
  'W-Strength/Skill': '5×3 Back Squat @85%, then 3×2 Snatch from blocks',
  'MG-Sprint': '21-15-9: Burpees, Double-unders',
  'MG-Short': 'AMRAP 8: 10 Burpees, 20 Double-unders, 200m Run',
  'MG-Medium': '4 RFT: 400m Run, 20 Pull-ups, 30 Push-ups',
  'MG-Long': 'For time: 100 Burpees, 100 Double-unders, 1 mile Run, 100 Push-ups',
  'MG-Strength/Skill': 'EMOM 20: Odd - 30s Handstand hold, Even - 250m Row',
  'MW-Sprint': '21-15-9: Deadlifts (225/155), 200m Run each round',
  'MW-Short': '3 RFT: 12 Dumbbell Snatches, 400m Run',
  'MW-Medium': '5 RFT: 15 Kettlebell Swings, 12 Box Jumps, 400m Run',
  'MW-Long': '30 min AMRAP: 10 Deadlifts (185/125), 15 Cal Row, 200m Run',
  'MW-Strength/Skill': 'EMOM 16: Odd - 5 Heavy KB Swings, Even - 250m Row',
  'GW-Sprint': 'Fran - 21-15-9: Thrusters (95/65), Pull-ups',
  'GW-Short': 'Elizabeth - 21-15-9: Squat Cleans (135/95), Ring Dips',
  'GW-Medium': '5 RFT: 10 Hang Cleans (135/95), 20 Toes-to-Bar',
  'GW-Long': '30 min AMRAP: 5 Deadlifts (275/185), 10 Handstand Push-ups, 15 Box Jumps',
  'GW-Strength/Skill': 'Superset 5×5: Weighted Pull-ups + Push Press',
}

function getCellColor(count: number, maxCount: number): string {
  if (count === 0) return '#dc2626' // red-600 for gaps
  const intensity = Math.min(count / Math.max(maxCount, 1), 1)
  // Gradient from dark navy (#1e1e3a) to bright blue (#3b82f6)
  const r = Math.round(30 + (59 - 30) * intensity)
  const g = Math.round(30 + (130 - 30) * intensity)
  const b = Math.round(58 + (246 - 58) * intensity)
  return `rgb(${r}, ${g}, ${b})`
}

function getCellTextColor(count: number): string {
  if (count === 0) return '#fca5a5' // red-300
  return '#e2e8f0' // slate-200
}

function getGapSeverity(modality: string, timeDomain: string): 'critical' | 'moderate' | 'minor' {
  // MGW gaps are most critical since Glassman emphasized the combination of all modalities
  if (modality === 'MGW') return 'critical'
  // Two-modality combos are moderately important
  if (modality.length >= 2) return 'moderate'
  return 'minor'
}

const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', badge: 'bg-red-500/20 text-red-700' },
  moderate: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-700' },
  minor: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-[var(--text-tertiary)]', badge: 'bg-slate-500/20 text-[var(--text-secondary)]' },
}

export default function HopperReadiness({ data, advancedAnalysis }: { data: CrossFitData; advancedAnalysis: AdvancedAnalysis }) {
  const { hopper, combinationCoverage } = advancedAnalysis

  // Build a lookup for the heatmap
  const cellLookup = useMemo(() => {
    const lookup: Record<string, number> = {}
    hopper.matrix.forEach((cell) => {
      lookup[`${cell.modality}-${cell.timeDomain}`] = cell.count
    })
    return lookup
  }, [hopper.matrix])

  const maxCount = useMemo(
    () => Math.max(...hopper.matrix.map((c) => c.count), 1),
    [hopper.matrix]
  )

  // Bar chart data for modality totals
  const modalityTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    hopper.matrix.forEach((cell) => {
      totals[cell.modality] = (totals[cell.modality] || 0) + cell.count
    })
    return MODALITIES.map((m) => ({
      name: m,
      label: MODALITY_LABELS[m] || m,
      count: totals[m] || 0,
    }))
  }, [hopper.matrix])

  // Bar chart data for time domain totals
  const timeDomainTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    hopper.matrix.forEach((cell) => {
      totals[cell.timeDomain] = (totals[cell.timeDomain] || 0) + cell.count
    })
    return TIME_DOMAINS.map((td) => ({
      name: td,
      label: TIME_DOMAIN_LABELS[td] || td,
      count: totals[td] || 0,
    }))
  }, [hopper.matrix])

  // Gaps sorted by severity
  const sortedGaps = useMemo(() => {
    const severityOrder = { critical: 0, moderate: 1, minor: 2 }
    return [...hopper.gaps].sort((a, b) => {
      const sa = getGapSeverity(a.modality, a.timeDomain)
      const sb = getGapSeverity(b.modality, b.timeDomain)
      return severityOrder[sa] - severityOrder[sb]
    })
  }, [hopper.gaps])

  // Coverage bar for the movement pairs visualization
  const coveragePct = combinationCoverage.coverageScore * 100
  const unseenToShow = combinationCoverage.unseenPairs.slice(0, 30)

  // Resolve movement names
  const resolveMovement = (id: string) => data.movementDisplay[id] || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="space-y-4">
      {/* ── HEADER ── */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">The Hopper Model - Are You Ready for Anything?</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Pull a random workout out of a hopper. Could you do it well? That's the test.
        </p>
      </div>

      <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
        <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          Imagine writing every possible workout on a piece of paper and throwing them in a hat. You pull one out at random.
          Could you do it? CrossFit says true fitness means being ready for whatever you pull. Let's see how well the
          programming covers all possibilities.
        </p>
      </div>

      {/* ── BIG SCORE CARDS ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-5 border border-blue-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Hopper Readiness</div>
          <div className="text-4xl font-bold font-mono text-blue-400">
            {(hopper.score * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-2">
            {hopper.filledCells} of {hopper.totalCells} modality x time domain cells covered
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            {(hopper.score * 100).toFixed(0)}% of all possible modality x time domain combinations have been programmed.
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-5 border border-emerald-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Movement Pair Coverage</div>
          <div className="text-4xl font-bold font-mono text-emerald-400">
            {combinationCoverage.observedPairs}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-2">
            out of {combinationCoverage.possiblePairs} possible pairs ({coveragePct.toFixed(1)}%)
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            {combinationCoverage.observedPairs} out of {combinationCoverage.possiblePairs} possible movement pairs have appeared in the same workout.
          </div>
        </div>

        <div className={`bg-gradient-to-br ${hopper.gaps.length > 5 ? 'from-red-500/10 to-orange-500/10 border-red-500/20' : 'from-amber-500/10 to-yellow-500/10 border-amber-500/20'} rounded-xl p-5 border`}>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Programming Gaps</div>
          <div className={`text-4xl font-bold font-mono ${hopper.gaps.length > 5 ? 'text-red-400' : hopper.gaps.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {hopper.gaps.length}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-2">
            combinations never programmed
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            These are the blind spots - combinations never programmed.
          </div>
        </div>
      </div>

      {/* ── COVERAGE HEATMAP ── */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Modality x Time Domain Coverage Heatmap</h3>
        <p className="text-[10px] text-[var(--text-muted)] mb-4">
          The Glassman Fitness Matrix - work capacity across broad time and modal domains
        </p>

        <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
          <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
            This is THE CrossFit fitness chart. Greg Glassman defined fitness as "work capacity across broad time and modal
            domains." Each cell is a combination of a modality type (what you're doing) and a time domain (how long you're
            doing it). Bright blue = lots of workouts. Red = a gap in the programming - something that was never trained.
          </p>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-[10px] text-[var(--text-muted)] font-medium w-36">Modality</th>
                {TIME_DOMAINS.map((td) => (
                  <th key={td} className="p-2 text-center text-[10px] text-[var(--text-muted)] font-medium">
                    <div>{td}</div>
                    <div className="text-[9px] text-[var(--text-muted)] font-normal">{TIME_DOMAIN_LABELS[td]}</div>
                  </th>
                ))}
                <th className="p-2 text-center text-[10px] text-[var(--text-muted)] font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {MODALITIES.map((mod) => {
                const rowTotal = TIME_DOMAINS.reduce((sum, td) => sum + (cellLookup[`${mod}-${td}`] || 0), 0)
                return (
                  <tr key={mod} className="group">
                    <td className="p-2 text-xs text-[var(--text-secondary)] font-medium">
                      <div>{mod}</div>
                      <div className="text-[9px] text-[var(--text-muted)] font-normal">{MODALITY_LABELS[mod]?.replace(` (${mod})`, '')}</div>
                    </td>
                    {TIME_DOMAINS.map((td) => {
                      const count = cellLookup[`${mod}-${td}`] || 0
                      const bgColor = getCellColor(count, maxCount)
                      const textColor = getCellTextColor(count)
                      return (
                        <td
                          key={td}
                          className="p-1 text-center"
                        >
                          <div
                            className="rounded-lg p-3 transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-white/20 cursor-default relative group/cell"
                            style={{ backgroundColor: bgColor }}
                          >
                            <div className="text-lg font-bold font-mono" style={{ color: textColor }}>
                              {count}
                            </div>
                            {count === 0 && (
                              <div className="text-[9px] text-red-600/80 mt-0.5">GAP</div>
                            )}
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                              <div className="font-medium text-white">{MODALITY_LABELS[mod]} + {td}</div>
                              <div className="mt-1">{count} workout{count !== 1 ? 's' : ''} programmed</div>
                              {count === 0 && <div className="text-red-400 mt-0.5">Programming gap!</div>}
                            </div>
                          </div>
                        </td>
                      )
                    })}
                    <td className="p-2 text-center text-xs font-mono text-[var(--text-tertiary)]">{rowTotal}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--panel-border)]">
          <span className="text-[10px] text-[var(--text-muted)]">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }} />
            <span className="text-[10px] text-[var(--text-muted)]">0 (Gap)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getCellColor(1, maxCount) }} />
            <span className="text-[10px] text-[var(--text-muted)]">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getCellColor(Math.floor(maxCount / 2), maxCount) }} />
            <span className="text-[10px] text-[var(--text-muted)]">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getCellColor(maxCount, maxCount) }} />
            <span className="text-[10px] text-[var(--text-muted)]">High ({maxCount})</span>
          </div>
        </div>
      </div>

      {/* ── DISTRIBUTION BAR CHARTS ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* By Modality */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">WODs by Modality Type</h3>
          <div style={{width:"100%",height:260}}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={modalityTotals} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} width={50} />
              <Tooltip
                contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(value: any) => [`${value} WODs`, 'Count']}
                labelFormatter={(label: any) => MODALITY_LABELS[String(label)] || label}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {modalityTotals.map((entry, i) => (
                  <Cell key={i} fill={entry.count === 0 ? '#dc2626' : '#3b82f6'} fillOpacity={entry.count === 0 ? 0.6 : 0.3 + (entry.count / Math.max(...modalityTotals.map((m) => m.count), 1)) * 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </div>

        {/* By Time Domain */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">WODs by Time Domain</h3>
          <div style={{width:"100%",height:260}}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeDomainTotals}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(value: any) => [`${value} WODs`, 'Count']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {timeDomainTotals.map((entry, i) => (
                  <Cell key={i} fill={entry.count === 0 ? '#dc2626' : '#06b6d4'} fillOpacity={entry.count === 0 ? 0.6 : 0.3 + (entry.count / Math.max(...timeDomainTotals.map((t) => t.count), 1)) * 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </div>
      </div>

      {/* ── PROGRAMMING GAPS ── */}
      {sortedGaps.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Programming Gaps</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            Modality x Time Domain combinations with zero or near-zero workouts
          </p>

          <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
            <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
            <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
              Every empty cell in the heatmap above represents a "blind spot" in the programming. True hopper-readiness means
              filling ALL cells. These gaps tell us exactly what types of workouts are missing. The more gaps, the more
              predictable the programming is - and predictability is the enemy of broad fitness.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sortedGaps.map((gap, i) => {
              const severity = getGapSeverity(gap.modality, gap.timeDomain)
              const colors = SEVERITY_COLORS[severity]
              return (
                <div key={i} className={`${colors.bg} rounded-lg p-3 border ${colors.border}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono font-bold ${colors.text}`}>
                      {gap.modality} + {gap.timeDomain}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                      {severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                    No workouts {TIME_DOMAIN_DESCRIPTIONS[gap.timeDomain] ? `lasting ${TIME_DOMAIN_DESCRIPTIONS[gap.timeDomain]}` : `in the ${gap.timeDomain} time domain`}
                    {' '}that use {GAP_DESCRIPTIONS[gap.modality] || gap.modality}.
                  </p>
                </div>
              )
            })}
          </div>

          {sortedGaps.length === 0 && (
            <div className="text-center py-8">
              <div className="text-2xl mb-2">&#10003;</div>
              <div className="text-sm text-emerald-400 font-medium">No gaps found! Full hopper coverage.</div>
            </div>
          )}
        </div>
      )}

      {/* ── MOVEMENT PAIR COVERAGE ── */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Movement Pair Coverage</h3>
        <p className="text-[10px] text-[var(--text-muted)] mb-3">
          How many unique movement pairings have appeared in the same workout?
        </p>

        <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
          <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
            With {combinationCoverage.possiblePairs > 0 ? Math.round((-1 + Math.sqrt(1 + 8 * combinationCoverage.possiblePairs)) / 2) : 'many'} movements,
            there are {combinationCoverage.possiblePairs.toLocaleString()} possible pairs. These are the ones CrossFit has never combined
            in the same workout. Unseen pairs represent untested movement interactions - your body has never had to transition
            between them under fatigue.
          </p>
        </div>

        {/* Coverage Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-tertiary)]">
              {combinationCoverage.observedPairs.toLocaleString()} of {combinationCoverage.possiblePairs.toLocaleString()} pairs observed
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400">{coveragePct.toFixed(1)}%</span>
          </div>
          <div className="h-4 bg-[var(--panel-bg-hover)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500 transition-all duration-700"
              style={{ width: `${Math.min(coveragePct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-[var(--text-muted)]">0%</span>
            <span className="text-[9px] text-[var(--text-muted)]">50%</span>
            <span className="text-[9px] text-[var(--text-muted)]">100%</span>
          </div>
        </div>

        {/* Observed vs Missing visual blocks */}
        <div className="mb-4">
          <div className="text-[10px] text-[var(--text-muted)] mb-2">Visual representation (each block = ~1% of total pairs)</div>
          <div className="flex flex-wrap gap-[2px]">
            {Array.from({ length: 100 }, (_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-[2px]"
                style={{
                  backgroundColor: i < Math.round(coveragePct) ? '#10b981' : 'var(--panel-bg-hover)',
                  border: '1px solid',
                  borderColor: i < Math.round(coveragePct) ? '#10b98133' : 'var(--panel-border-strong)',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-[2px] bg-emerald-500" />
              <span className="text-[9px] text-[var(--text-muted)]">Observed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-[2px] bg-[var(--panel-bg-hover)] border border-[var(--panel-border-strong)]" />
              <span className="text-[9px] text-[var(--text-muted)]">Unseen</span>
            </div>
          </div>
        </div>

        {/* Unseen Pairs List */}
        {unseenToShow.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-2">
              Unseen Movement Pairs
              {combinationCoverage.unseenPairs.length > 30 && (
                <span className="text-[10px] text-[var(--text-muted)] ml-2">(showing first 30 of {combinationCoverage.unseenPairs.length})</span>
              )}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {unseenToShow.map(([a, b], i) => (
                <div key={i} className="bg-[var(--panel-bg-hover)] rounded px-2.5 py-1.5 border border-[var(--panel-border-strong)] flex items-center gap-1.5">
                  <span className="text-[10px] text-orange-400 font-medium truncate">{resolveMovement(a)}</span>
                  <span className="text-[9px] text-[var(--text-muted)]">+</span>
                  <span className="text-[10px] text-cyan-400 font-medium truncate">{resolveMovement(b)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── WHAT WOULD FILL THE GAPS? ── */}
      {sortedGaps.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">What Would Fill the Gaps?</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            Suggested workouts to address each programming blind spot
          </p>

          <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
            <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
            <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
              For each gap in the heatmap, here is a sample workout that would fill it. A good programmer would cycle these
              in to round out the programming and improve hopper readiness. Think of these as "patches" for the holes in
              your fitness armor.
            </p>
          </div>

          <div className="space-y-2">
            {sortedGaps.map((gap, i) => {
              const severity = getGapSeverity(gap.modality, gap.timeDomain)
              const colors = SEVERITY_COLORS[severity]
              const key = `${gap.modality}-${gap.timeDomain}`
              const suggestion = SAMPLE_WORKOUTS[key]
              return (
                <div key={i} className={`${colors.bg} rounded-lg p-4 border ${colors.border}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <span className={`text-xs font-mono font-bold ${colors.text} bg-black/20 px-2 py-1 rounded`}>
                        {gap.modality} + {gap.timeDomain}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-[var(--text-muted)] mb-1">
                        Gap: No {GAP_DESCRIPTIONS[gap.modality] || gap.modality} workouts {TIME_DOMAIN_DESCRIPTIONS[gap.timeDomain] ? `lasting ${TIME_DOMAIN_DESCRIPTIONS[gap.timeDomain]}` : ''}.
                      </div>
                      {suggestion ? (
                        <div className="bg-black/20 rounded-md px-3 py-2 mt-1.5">
                          <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Suggested WOD:</div>
                          <div className="text-xs text-[var(--text-secondary)] font-mono">{suggestion}</div>
                        </div>
                      ) : (
                        <div className="bg-black/20 rounded-md px-3 py-2 mt-1.5">
                          <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Suggested WOD:</div>
                          <div className="text-xs text-[var(--text-secondary)] font-mono italic">
                            Program a {gap.timeDomain.toLowerCase()} workout using {GAP_DESCRIPTIONS[gap.modality] || gap.modality} movements.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── HOPPER READINESS SUMMARY ── */}
      <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl p-5 border border-blue-500/10">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Hopper Readiness Verdict</h3>
        <div className="flex items-center gap-6">
          <div className="text-5xl font-bold font-mono text-blue-400">
            {(hopper.score * 100).toFixed(0)}%
          </div>
          <div className="flex-1">
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {hopper.score >= 0.9 ? (
                <>
                  Outstanding hopper readiness. The programming covers nearly every modality and time domain combination.
                  An athlete following this programming would be well-prepared for almost any random task pulled from the hopper.
                </>
              ) : hopper.score >= 0.7 ? (
                <>
                  Good hopper readiness with some notable gaps. The programming covers most combinations, but there are
                  blind spots that could leave an athlete underprepared for certain random challenges. Filling {hopper.gaps.length} gap{hopper.gaps.length !== 1 ? 's' : ''} would
                  significantly improve readiness.
                </>
              ) : hopper.score >= 0.5 ? (
                <>
                  Moderate hopper readiness. The programming is noticeably skewed toward certain modality/time domain
                  combinations while leaving {hopper.gaps.length} gaps unfilled. An athlete would be well-prepared for some
                  random tasks but caught off-guard by many others.
                </>
              ) : (
                <>
                  Low hopper readiness. The programming has significant blind spots with {hopper.gaps.length} unfilled
                  combinations. This indicates a specialized rather than broadly fit approach - the opposite of what Glassman's
                  hopper model prescribes.
                </>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="text-[10px] text-[var(--text-muted)]">
                <span className="text-emerald-400 font-mono font-bold">{hopper.filledCells}</span> filled cells
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                <span className="text-red-400 font-mono font-bold">{hopper.gaps.length}</span> gaps
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                <span className="text-cyan-400 font-mono font-bold">{coveragePct.toFixed(1)}%</span> pair coverage
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
