import { useMemo } from 'react'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import type { AdvancedAnalysisResults } from '../utils/advanced-analysis'

type Severity = 'critical' | 'warning' | 'info'

interface GapItem {
  severity: Severity
  title: string
  description: string
  why: string
  fix: string
}

const SEVERITY_STYLES: Record<Severity, { bg: string; border: string; badge: string; badgeText: string; text: string }> = {
  critical: {
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    badge: 'bg-red-500/20',
    badgeText: 'text-red-400',
    text: 'text-red-600',
  },
  warning: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    text: 'text-amber-600',
  },
  info: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/20',
    badgeText: 'text-blue-400',
    text: 'text-blue-300',
  },
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLES[severity]
  const label = severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Info'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${s.badge} ${s.badgeText}`}>
      {label}
    </span>
  )
}

function GapCard({ item }: { item: GapItem }) {
  const s = SEVERITY_STYLES[item.severity]
  return (
    <div className={`rounded-lg border p-4 ${s.bg} ${s.border}`}>
      <div className="flex items-start gap-3">
        <SeverityBadge severity={item.severity} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${s.text}`}>{item.title}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">{item.description}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1.5 italic">Why it matters: {item.why}</div>
          <div className="mt-2 flex items-start gap-1.5">
            <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider shrink-0 mt-px">Fix:</span>
            <span className="text-[10px] text-emerald-400/80">{item.fix}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, count, severity }: { title: string; count: number; severity: Severity }) {
  const s = SEVERITY_STYLES[severity]
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className={`text-sm font-semibold ${s.text}`}>{title}</h3>
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${s.badge} ${s.badgeText}`}>
        {count} {count === 1 ? 'issue' : 'issues'}
      </span>
    </div>
  )
}

export default function WhatsGaps({
  data,
  analysis,
  advancedAnalysis,
}: {
  data: CrossFitData
  analysis: AnalysisResults
  advancedAnalysis: AdvancedAnalysisResults
}) {
  // 1. Critical Gaps: modality x time domain combos with 0 workouts
  const criticalGaps = useMemo<GapItem[]>(() => {
    const gaps = advancedAnalysis.hopper?.gaps || []
    return gaps.map((g) => ({
      severity: 'critical' as Severity,
      title: `${g.modality} x ${g.timeDomain} — Zero Workouts`,
      description: `The combination of ${g.modality} modality with ${g.timeDomain} time domain has never been programmed.`,
      why: 'A blind spot in the hopper means athletes have never been tested in this modality-time combination. CrossFit claims to prepare for the unknown — this is a known unknown.',
      fix: `Program a ${g.modality}-dominant workout in the ${g.timeDomain} time domain. Even one workout fills this gap.`,
    }))
  }, [advancedAnalysis])

  // 2. Undertrained Patterns: functional patterns below average
  const undertrainedPatterns = useMemo<GapItem[]>(() => {
    const patterns = analysis.functionalPatterns
    const values = Object.values(patterns)
    if (values.length === 0) return []
    const avg = values.reduce((a, b) => a + b, 0) / values.length

    return Object.entries(patterns)
      .filter(([, count]) => count < avg * 0.5) // less than 50% of average
      .sort(([, a], [, b]) => a - b)
      .map(([pattern, count]) => {
        const pct = ((count / avg) * 100).toFixed(0)
        const severity: Severity = count < avg * 0.25 ? 'critical' : 'warning'
        const patternName = pattern
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        return {
          severity,
          title: `${patternName} — ${pct}% of Average`,
          description: `${patternName} appears ${count} times vs. the average of ${avg.toFixed(0)} across all functional patterns.`,
          why: `Undertrained movement patterns create muscular imbalances and increase injury risk. ${patternName} is a foundational human movement.`,
          fix: `Add more ${patternName.toLowerCase()} movements to weekly programming. Aim for at least ${Math.ceil(avg * 0.8)} total appearances to close the gap.`,
        }
      })
  }, [analysis])

  // 3. Muscle Imbalances: muscle groups with low coverage
  const muscleImbalances = useMemo<GapItem[]>(() => {
    const groups = analysis.muscleGroups
    const values = Object.values(groups)
    if (values.length === 0) return []
    const avg = values.reduce((a, b) => a + b, 0) / values.length

    return Object.entries(groups)
      .filter(([, count]) => count < avg * 0.4) // less than 40% of average
      .sort(([, a], [, b]) => a - b)
      .map(([group, count]) => {
        const pct = ((count / avg) * 100).toFixed(0)
        const severity: Severity = count < avg * 0.2 ? 'critical' : 'warning'
        const groupName = group
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        return {
          severity,
          title: `${groupName} — ${pct}% of Average Coverage`,
          description: `${groupName} has ${count} total engagements vs. the average of ${avg.toFixed(0)} for all muscle groups.`,
          why: `Muscle group imbalances lead to compensatory movement patterns and increased injury risk over time.`,
          fix: `Incorporate movements targeting ${groupName.toLowerCase()} at least 2-3x per week. Consider accessory work if main programming doesn't cover it.`,
        }
      })
  }, [analysis])

  // 4. Neglected Skills: physical skills below 30 on 0-100 scale
  const neglectedSkills = useMemo<GapItem[]>(() => {
    return Object.entries(analysis.aggregateSkills)
      .filter(([, score]) => score < 30)
      .sort(([, a], [, b]) => a - b)
      .map(([skill, score]) => {
        const skillName = skill
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
        const severity: Severity = score < 15 ? 'critical' : 'warning'
        return {
          severity,
          title: `${skillName} — Score: ${score.toFixed(0)}/100`,
          description: `${skillName} scores ${score.toFixed(0)} out of 100 on CrossFit's general physical skill assessment.`,
          why: `CrossFit defines fitness as competence across all 10 physical skills. A score below 30 means this skill is rarely developed by the programming.`,
          fix: `Add workouts that specifically develop ${skillName.toLowerCase()}. ${
            skill.includes('flexibility')
              ? 'Include mobility and ROM-focused movements.'
              : skill.includes('accuracy')
                ? 'Add precision-based movements and drills.'
                : skill.includes('balance')
                  ? 'Include unilateral and stability-focused work.'
                  : skill.includes('agility')
                    ? 'Program direction-change and reactive movements.'
                    : `Dedicate specific sessions to ${skillName.toLowerCase()} development.`
          }`,
        }
      })
  }, [analysis])

  // 5. Missing Pairs: movement combinations never seen together
  const missingPairs = useMemo<GapItem[]>(() => {
    const pairs = advancedAnalysis.combinationCoverage?.unseenPairs || []
    const coverageScore = advancedAnalysis.combinationCoverage?.coverageScore ?? 1
    const coveragePct = (coverageScore * 100).toFixed(1)

    // Cap displayed pairs to avoid overwhelming the UI
    const displayPairs = pairs.slice(0, 15)

    return displayPairs.map(([a, b]) => {
      const nameA = data.movementDisplay?.[a] || a
      const nameB = data.movementDisplay?.[b] || b
      return {
        severity: 'info' as Severity,
        title: `${nameA} + ${nameB} — Never Paired`,
        description: `These two movements have never appeared together in any workout. Overall pair coverage: ${coveragePct}%.`,
        why: 'Novel movement combinations challenge athletes in unexpected ways. Unseen pairings represent untapped programming variety.',
        fix: `Create a workout combining ${nameA} and ${nameB}. For example, an AMRAP or couplet that pairs them back-to-back.`,
      }
    })
  }, [advancedAnalysis, data])

  // Summary stats
  const totalIssues = criticalGaps.length + undertrainedPatterns.length + muscleImbalances.length + neglectedSkills.length + missingPairs.length
  const critCount = criticalGaps.length + undertrainedPatterns.filter((g) => g.severity === 'critical').length + muscleImbalances.filter((g) => g.severity === 'critical').length + neglectedSkills.filter((g) => g.severity === 'critical').length
  const warnCount = undertrainedPatterns.filter((g) => g.severity === 'warning').length + muscleImbalances.filter((g) => g.severity === 'warning').length + neglectedSkills.filter((g) => g.severity === 'warning').length
  const infoCount = missingPairs.length

  // Build recommendations from the worst gaps
  const recommendations = useMemo<GapItem[]>(() => {
    const recs: GapItem[] = []

    // Recommend based on push/pull ratio
    const ppr = analysis.pushPullRatio
    if (ppr > 1.5 || ppr < 0.67) {
      const dominant = ppr > 1 ? 'push' : 'pull'
      const lacking = ppr > 1 ? 'pull' : 'push'
      recs.push({
        severity: 'warning',
        title: `Push/Pull Imbalance — ${ppr.toFixed(2)}:1 ratio`,
        description: `Programming heavily favors ${dominant} movements over ${lacking} movements.`,
        why: 'A balanced push-pull ratio prevents shoulder injuries, postural issues, and ensures balanced upper body development.',
        fix: `Increase ${lacking} volume. Target a 0.8-1.2:1 push/pull ratio. Add rows, pull-ups, or face pulls for more pulling; add presses, push-ups, or dips for more pushing.`,
      })
    }

    // Recommend based on squat/hinge ratio
    const shr = analysis.squatHingeRatio
    if (shr > 2.0 || shr < 0.5) {
      const dominant = shr > 1 ? 'squat' : 'hinge'
      const lacking = shr > 1 ? 'hinge' : 'squat'
      recs.push({
        severity: 'warning',
        title: `Squat/Hinge Imbalance — ${shr.toFixed(2)}:1 ratio`,
        description: `Programming heavily favors ${dominant} patterns over ${lacking} patterns.`,
        why: 'The squat and hinge are the two primary lower-body patterns. Imbalance weakens the posterior chain or anterior chain.',
        fix: `Increase ${lacking} movements. Add deadlifts, kettlebell swings, or good mornings for hinge; add squats, lunges, or pistols for squats.`,
      })
    }

    // Recommend based on hopper coverage
    const hopperScore = advancedAnalysis.hopper?.score ?? 1
    if (hopperScore < 0.8) {
      recs.push({
        severity: 'critical',
        title: `Low Hopper Readiness — ${(hopperScore * 100).toFixed(0)}%`,
        description: `Only ${(hopperScore * 100).toFixed(0)}% of modality x time domain combinations have been covered.`,
        why: 'The "hopper model" is one of CrossFit\'s three fitness standards. Low coverage means athletes are unprepared for random workout selection.',
        fix: `Fill the ${advancedAnalysis.hopper?.gaps?.length || 0} missing modality/time-domain cells. Focus on the least-programmed combinations first.`,
      })
    }

    // Recommend based on combination coverage
    const combScore = advancedAnalysis.combinationCoverage?.coverageScore ?? 1
    if (combScore < 0.5) {
      recs.push({
        severity: 'info',
        title: `Low Movement Pairing Diversity — ${(combScore * 100).toFixed(0)}% coverage`,
        description: `Only ${(combScore * 100).toFixed(0)}% of possible movement pairs have ever been programmed together.`,
        why: 'Novel combinations challenge different energy systems and movement patterns simultaneously, building broader fitness.',
        fix: `Experiment with new movement pairings. Use the missing pairs list above as inspiration for fresh workout designs.`,
      })
    }

    return recs
  }, [analysis, advancedAnalysis])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">What's Missing? — Programming Gap Analysis</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-3xl">
          No program is perfect. This page identifies the blind spots in CrossFit's
          programming — the movements, skills, and combinations that are undertrained
          or completely absent. Think of it as a doctor's checkup for the programming.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-red-500/10 to-red-900/5 rounded-xl p-4 border border-red-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Issues Found</div>
          <div className="text-3xl font-bold font-mono text-[var(--text-primary)]">{totalIssues}</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-red-500/20">
          <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Critical</div>
          <div className="text-2xl font-bold font-mono text-red-400">{critCount}</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-amber-500/20">
          <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">Warning</div>
          <div className="text-2xl font-bold font-mono text-amber-400">{warnCount}</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-blue-500/20">
          <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Info</div>
          <div className="text-2xl font-bold font-mono text-blue-400">{infoCount}</div>
        </div>
      </div>

      {/* Section 1: Critical Gaps */}
      {criticalGaps.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <SectionHeader title="Critical Gaps — Modality x Time Domain Holes" count={criticalGaps.length} severity="critical" />
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            These modality/time-domain combinations have zero workouts in the entire dataset. Each is a blind spot in hopper readiness.
          </p>
          <div className="space-y-2">
            {criticalGaps.map((item, i) => (
              <GapCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Undertrained Patterns */}
      {undertrainedPatterns.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <SectionHeader title="Undertrained Functional Patterns" count={undertrainedPatterns.length} severity="warning" />
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            These movement patterns appear far less frequently than the average, creating functional gaps.
          </p>
          <div className="space-y-2">
            {undertrainedPatterns.map((item, i) => (
              <GapCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Muscle Imbalances */}
      {muscleImbalances.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <SectionHeader title="Muscle Group Imbalances" count={muscleImbalances.length} severity="warning" />
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            These muscle groups receive significantly less attention than the average, which may lead to compensatory patterns.
          </p>
          <div className="space-y-2">
            {muscleImbalances.map((item, i) => (
              <GapCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Neglected Skills */}
      {neglectedSkills.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <SectionHeader title="Neglected Physical Skills" count={neglectedSkills.length} severity="warning" />
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            These physical skills score below 30/100, meaning they are rarely developed by the current programming.
          </p>
          <div className="space-y-2">
            {neglectedSkills.map((item, i) => (
              <GapCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Missing Pairs */}
      {missingPairs.length > 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <SectionHeader title="Missing Movement Pairs" count={advancedAnalysis.combinationCoverage?.unseenPairs?.length || missingPairs.length} severity="info" />
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            These movement combinations have never appeared together in any workout.
            {(advancedAnalysis.combinationCoverage?.unseenPairs?.length || 0) > 15 && (
              <span> Showing 15 of {advancedAnalysis.combinationCoverage.unseenPairs.length} unseen pairs.</span>
            )}
          </p>
          <div className="space-y-2">
            {missingPairs.map((item, i) => (
              <GapCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Section 6: Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-500/5 to-[#12121a] rounded-xl p-5 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-emerald-400">Actionable Recommendations</h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              {recommendations.length} {recommendations.length === 1 ? 'recommendation' : 'recommendations'}
            </span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            High-level programming adjustments that would address the largest gaps identified above.
          </p>
          <div className="space-y-2">
            {recommendations.map((item, i) => (
              <GapCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* All clear message */}
      {totalIssues === 0 && recommendations.length === 0 && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-8 border border-emerald-500/20 text-center">
          <div className="text-2xl mb-2 text-emerald-400">All Clear</div>
          <p className="text-sm text-[var(--text-tertiary)]">
            No significant programming gaps detected. The programming covers all major
            modality/time-domain combinations, functional patterns, muscle groups, and physical skills.
          </p>
        </div>
      )}
    </div>
  )
}
