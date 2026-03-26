import { useMemo } from 'react'
import type { CrossFitData } from '../types'

type LetterGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

interface GradeResult {
  subject: string
  grade: LetterGrade
  score: number       // 0-1 normalized
  rawValue: string    // display string for the raw metric
  comment: string
}

const GRADE_POINTS: Record<LetterGrade, number> = {
  'A+': 4.3, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0,
}

const GRADE_COLORS: Record<LetterGrade, string> = {
  'A+': '#34d399', 'A': '#34d399', 'B': '#60a5fa',
  'C': '#fbbf24', 'D': '#fb923c', 'F': '#f87171',
}

function gradeFromThresholds(value: number, thresholds: [number, LetterGrade][]): LetterGrade {
  for (const [threshold, grade] of thresholds) {
    if (value > threshold) return grade
  }
  return 'F'
}

function calcVarianceGrade(varianceScore: number): { grade: LetterGrade; score: number } {
  const grade = gradeFromThresholds(varianceScore, [
    [85, 'A+'], [75, 'A'], [65, 'B'], [55, 'C'], [45, 'D'],
  ])
  return { grade, score: Math.min(varianceScore / 100, 1) }
}

function calcBalanceGrade(functionalBalance: number): { grade: LetterGrade; score: number } {
  const inverted = 1 - functionalBalance
  const grade = gradeFromThresholds(inverted, [
    [0.85, 'A+'], [0.75, 'A'], [0.65, 'B'], [0.55, 'C'], [0.45, 'D'],
  ])
  return { grade, score: inverted }
}

function calcCoverageGrade(hopperScore: number): { grade: LetterGrade; score: number } {
  // hopperScore is 0-1 from the analysis engine, convert to 0-100 for grading
  const pct = hopperScore * 100
  const grade = gradeFromThresholds(pct, [
    [90, 'A+'], [80, 'A'], [70, 'B'], [60, 'C'], [50, 'D'],
  ])
  return { grade, score: Math.min(hopperScore, 1) }
}

function calcPushPullGrade(ratio: number): { grade: LetterGrade; score: number } {
  const deviation = Math.abs(ratio - 1.0)
  let grade: LetterGrade
  if (deviation <= 0.1) grade = 'A+'
  else if (deviation <= 0.2) grade = 'A'
  else if (deviation <= 0.3) grade = 'B'
  else if (deviation <= 0.5) grade = 'C'
  else if (deviation <= 0.7) grade = 'D'
  else grade = 'F'
  const score = Math.max(0, 1 - deviation)
  return { grade, score }
}

function calcSkillSpreadGrade(skillBalance: number): { grade: LetterGrade; score: number } {
  const inverted = 1 - skillBalance
  const grade = gradeFromThresholds(inverted, [
    [0.85, 'A+'], [0.75, 'A'], [0.65, 'B'], [0.55, 'C'], [0.45, 'D'],
  ])
  return { grade, score: inverted }
}

function calcEnergyGrade(energyBalance: number): { grade: LetterGrade; score: number } {
  const inverted = 1 - energyBalance
  const grade = gradeFromThresholds(inverted, [
    [0.85, 'A+'], [0.75, 'A'], [0.65, 'B'], [0.55, 'C'], [0.45, 'D'],
  ])
  return { grade, score: inverted }
}

function getVarianceComment(grade: LetterGrade): string {
  switch (grade) {
    case 'A+': return 'Outstanding variety — athletes rarely repeat the same stimulus'
    case 'A': return 'Great movement diversity with minimal repetition bias'
    case 'B': return 'Good variety overall, though some movements appear more than expected'
    case 'C': return 'Moderate repetition detected — programming could use more variety'
    case 'D': return 'Significant repetition — the same movements dominate too many workouts'
    case 'F': return 'Very low variety — workouts are highly repetitive and predictable'
  }
}

function getBalanceComment(grade: LetterGrade): string {
  switch (grade) {
    case 'A+': return 'Near-perfect functional balance across all movement patterns'
    case 'A': return 'Strong balance — push, pull, squat, and hinge are well-represented'
    case 'B': return 'Mostly balanced with minor gaps in some movement patterns'
    case 'C': return 'Noticeable imbalances — some patterns are under-trained'
    case 'D': return 'Significant gaps in fundamental movement patterns'
    case 'F': return 'Major imbalances that could lead to compensations and injury risk'
  }
}

function getCoverageComment(grade: LetterGrade, filledCells?: number, totalCells?: number): string {
  const pct = filledCells && totalCells ? `${Math.round((filledCells / totalCells) * 100)}%` : ''
  switch (grade) {
    case 'A+': return `Exceptional Hopper coverage${pct ? ` — ${pct} of all possible combinations tested` : ''}`
    case 'A': return `Broad coverage across modality, time, and load dimensions${pct ? ` (${pct} filled)` : ''}`
    case 'B': return 'Good coverage overall but some training zones remain untouched'
    case 'C': return 'Moderate coverage — meaningful gaps in the training spectrum'
    case 'D': return 'Many training combinations have never been tested'
    case 'F': return 'Extremely narrow programming — most of the training map is empty'
  }
}

function getPushPullComment(grade: LetterGrade, ratio: number): string {
  const direction = ratio > 1 ? 'push-dominant' : 'pull-dominant'
  switch (grade) {
    case 'A+': return 'Excellent push/pull balance — shoulders are well-protected'
    case 'A': return 'Very close to ideal — minimal risk of anterior/posterior imbalance'
    case 'B': return `Slightly ${direction} but within a healthy range`
    case 'C': return `Moderately ${direction} — could benefit from rebalancing`
    case 'D': return `Clearly ${direction} — increased shoulder injury risk`
    case 'F': return `Heavily ${direction} — this ratio needs immediate correction`
  }
}

function getSkillComment(grade: LetterGrade): string {
  switch (grade) {
    case 'A+': return 'All ten physical skills are trained with remarkable evenness'
    case 'A': return 'Skills are well-distributed — a truly general physical preparedness program'
    case 'B': return 'Most skills covered, though some get more emphasis than others'
    case 'C': return 'Uneven skill development — some domains are under-represented'
    case 'D': return 'Major skill gaps — this is not truly GPP programming'
    case 'F': return 'Extreme bias toward a few skills at the expense of others'
  }
}

function getEnergyComment(grade: LetterGrade): string {
  switch (grade) {
    case 'A+': return 'Phosphagen, glycolytic, and oxidative pathways are all well-trained'
    case 'A': return 'Strong coverage of all three energy systems with minor bias'
    case 'B': return 'Good overall but one energy system gets noticeably less work'
    case 'C': return 'Uneven energy system training — one pathway is under-developed'
    case 'D': return 'One or more energy systems are significantly neglected'
    case 'F': return 'Programming overwhelmingly favors one energy system'
  }
}

function getTeacherNotes(grades: GradeResult[], gpa: number): string {
  const best = [...grades].sort((a, b) => GRADE_POINTS[b.grade] - GRADE_POINTS[a.grade])[0]
  const worst = [...grades].sort((a, b) => GRADE_POINTS[a.grade] - GRADE_POINTS[b.grade])[0]
  const aCount = grades.filter(g => g.grade === 'A+' || g.grade === 'A').length

  let opening: string
  if (gpa >= 3.8) opening = 'CrossFit\'s programming demonstrates elite-level design across nearly every dimension.'
  else if (gpa >= 3.0) opening = 'Overall, this is strong programming that covers most bases well.'
  else if (gpa >= 2.0) opening = 'The programming is average — there are clear strengths but also meaningful gaps.'
  else opening = 'There are significant areas for improvement in the programming design.'

  const bestNote = `The strongest area is ${best.subject.toLowerCase()}, earning a solid ${best.grade}.`
  const worstNote = worst.grade !== best.grade
    ? `The biggest opportunity for improvement is in ${worst.subject.toLowerCase()} (${worst.grade}), which would have the most impact on athlete development.`
    : 'All areas are performing at a similar level with no clear weak link.'

  let closing: string
  if (aCount >= 5) closing = 'A programming student would be proud to bring this report card home.'
  else if (aCount >= 3) closing = 'With a few targeted adjustments, this could be an honor-roll program.'
  else if (aCount >= 1) closing = 'There\'s a solid foundation here, but meaningful work is needed to achieve balanced programming.'
  else closing = 'A fundamental rethink of programming priorities is recommended.'

  return `${opening} ${bestNote} ${worstNote} ${closing}`
}

function gpaToLetter(gpa: number): LetterGrade {
  if (gpa >= 4.15) return 'A+'
  if (gpa >= 3.5) return 'A'
  if (gpa >= 2.5) return 'B'
  if (gpa >= 1.5) return 'C'
  if (gpa >= 0.5) return 'D'
  return 'F'
}

// --- Sub-components ---

function GradeBadge({ grade, size = 'sm' }: { grade: LetterGrade; size?: 'sm' | 'lg' }) {
  const color = GRADE_COLORS[grade]
  const isLarge = size === 'lg'

  return (
    <div
      style={{
        width: isLarge ? 120 : 44,
        height: isLarge ? 120 : 44,
        borderRadius: '50%',
        border: `${isLarge ? 4 : 3}px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${color}15`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color,
          fontSize: isLarge ? 44 : 18,
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        }}
      >
        {grade}
      </span>
    </div>
  )
}

function ScoreBar({ score, grade }: { score: number; grade: LetterGrade }) {
  const color = GRADE_COLORS[grade]
  const pct = Math.max(0, Math.min(100, score * 100))

  return (
    <div
      style={{
        flex: 1,
        height: 8,
        borderRadius: 4,
        background: '#1e1e3a',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 4,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  )
}

function SubjectRow({ result }: { result: GradeResult }) {
  const color = GRADE_COLORS[result.grade]

  return (
    <div
      className="grid gap-3 sm:gap-4 items-center py-3 sm:py-3.5 border-b border-[#1e1e3a]"
      style={{
        gridTemplateColumns: 'minmax(0, 1fr)',
      }}
    >
      {/* Mobile: stacked layout; Desktop: inline */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Grade Badge */}
        <GradeBadge grade={result.grade} size="sm" />

        {/* Subject Name */}
        <div className="min-w-0 flex-1">
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
            {result.subject}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            {result.rawValue}
          </div>
        </div>
      </div>

      {/* Score Bar + Comment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <ScoreBar score={result.score} grade={result.grade} />
        <div style={{ fontSize: 12, color, lineHeight: 1.4 }}>
          {result.comment}
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

export default function ReportCard({
  data,
  analysis,
  advancedAnalysis,
}: {
  data: CrossFitData
  analysis: any
  advancedAnalysis: any
}) {
  const grades = useMemo<GradeResult[]>(() => {
    const varianceScore = advancedAnalysis?.entropy?.varianceScore ?? 0
    const v = calcVarianceGrade(varianceScore)

    const functionalBalance = analysis?.functionalBalance ?? 0.5
    const b = calcBalanceGrade(functionalBalance)

    const hopperScore = advancedAnalysis?.hopper?.score ?? 0
    const filledCells = advancedAnalysis?.hopper?.filledCells
    const totalCells = advancedAnalysis?.hopper?.totalCells
    const c = calcCoverageGrade(hopperScore)

    const pushPullRatio = analysis?.pushPullRatio ?? 1.0
    const pp = calcPushPullGrade(pushPullRatio)

    const skillBalance = analysis?.skillBalance ?? 0.5
    const sk = calcSkillSpreadGrade(skillBalance)

    const energyBalance = analysis?.energyBalance ?? 0.5
    const en = calcEnergyGrade(energyBalance)

    return [
      {
        subject: 'Variance',
        grade: v.grade,
        score: v.score,
        rawValue: `Score: ${varianceScore.toFixed(1)} / 100`,
        comment: getVarianceComment(v.grade),
      },
      {
        subject: 'Balance',
        grade: b.grade,
        score: b.score,
        rawValue: `Imbalance: ${(functionalBalance * 100).toFixed(0)}%`,
        comment: getBalanceComment(b.grade),
      },
      {
        subject: 'Coverage',
        grade: c.grade,
        score: c.score,
        rawValue: `Hopper: ${hopperScore.toFixed(1)} / 100`,
        comment: getCoverageComment(c.grade, filledCells, totalCells),
      },
      {
        subject: 'Push/Pull Ratio',
        grade: pp.grade,
        score: pp.score,
        rawValue: `Ratio: ${pushPullRatio.toFixed(2)} : 1`,
        comment: getPushPullComment(pp.grade, pushPullRatio),
      },
      {
        subject: 'Skill Spread',
        grade: sk.grade,
        score: sk.score,
        rawValue: `Imbalance: ${(skillBalance * 100).toFixed(0)}%`,
        comment: getSkillComment(sk.grade),
      },
      {
        subject: 'Energy Systems',
        grade: en.grade,
        score: en.score,
        rawValue: `Imbalance: ${(energyBalance * 100).toFixed(0)}%`,
        comment: getEnergyComment(en.grade),
      },
    ]
  }, [analysis, advancedAnalysis])

  const gpa = useMemo(() => {
    if (grades.length === 0) return 0
    const total = grades.reduce((sum, g) => sum + GRADE_POINTS[g.grade], 0)
    return total / grades.length
  }, [grades])

  const overallLetter = gpaToLetter(gpa)
  const overallColor = GRADE_COLORS[overallLetter]
  const teacherNotes = useMemo(() => getTeacherNotes(grades, gpa), [grades, gpa])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Explainer */}
      <div
        style={{
          background: '#12121a',
          borderRadius: 12,
          padding: '16px 20px',
          border: '1px solid #1e1e3a',
        }}
      >
        <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
          We graded CrossFit's programming like a school report card. Each category tests a different
          aspect of good programming. A+ means world-class. F means there's serious work to do.
        </p>
      </div>

      {/* Overall GPA Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #12121a 0%, #1a1a2e 100%)',
          borderRadius: 16,
          padding: '24px 16px',
          border: '1px solid #1e1e3a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2 }}>
          Overall GPA
        </div>

        <GradeBadge grade={overallLetter} size="lg" />

        <div style={{ textAlign: 'center' }}>
          <div
            className="text-3xl sm:text-4xl"
            style={{
              fontWeight: 800,
              color: overallColor,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              lineHeight: 1,
            }}
          >
            {gpa.toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            out of 4.30
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 8,
            fontSize: 12,
            color: '#64748b',
          }}
        >
          <span>Based on <strong style={{ color: '#e2e8f0' }}>{data.overview.total_workouts.toLocaleString()}</strong> workouts</span>
          <span style={{ color: '#2a2a4a' }}>|</span>
          <span><strong style={{ color: '#e2e8f0' }}>{Object.keys(data.overview.movement_frequency).length}</strong> unique movements</span>
        </div>
      </div>

      {/* Subject Grades */}
      <div
        style={{
          background: '#12121a',
          borderRadius: 16,
          padding: '8px 12px 16px',
          border: '1px solid #1e1e3a',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: 2,
            padding: '16px 0 8px',
            borderBottom: '1px solid #1e1e3a',
          }}
        >
          Subject Grades
        </div>

        {grades.map((g) => (
          <SubjectRow key={g.subject} result={g} />
        ))}
      </div>

      {/* Teacher's Notes */}
      <div
        style={{
          background: '#12121a',
          borderRadius: 16,
          padding: 24,
          border: '1px solid #1e1e3a',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 16,
          }}
        >
          Teacher's Notes
        </div>

        <div
          style={{
            background: '#0c0c14',
            borderRadius: 12,
            padding: 20,
            borderLeft: `4px solid ${overallColor}`,
          }}
        >
          <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.75, margin: 0 }}>
            {teacherNotes}
          </p>
        </div>

        {/* Grade Scale Legend */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 20,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {(['A+', 'A', 'B', 'C', 'D', 'F'] as LetterGrade[]).map((g) => (
            <div
              key={g}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#64748b',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: GRADE_COLORS[g],
                }}
              />
              <span style={{ fontWeight: 600, color: GRADE_COLORS[g] }}>{g}</span>
              <span>= {GRADE_POINTS[g].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
