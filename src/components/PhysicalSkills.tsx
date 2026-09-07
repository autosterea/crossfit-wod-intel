import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import { MOVEMENT_TAXONOMY, PHYSICAL_SKILL_LABELS, type PhysicalSkill } from '../data/movement-taxonomy'

const GREEN = '#019644'

const SKILLS: PhysicalSkill[] = [
  'cardiovascular-endurance', 'stamina', 'strength', 'flexibility',
  'power', 'speed', 'coordination', 'agility', 'balance', 'accuracy',
]

// Categorize: Organic (trained by doing) vs Neurological (trained by practice)
const ORGANIC: PhysicalSkill[] = ['cardiovascular-endurance', 'stamina', 'strength', 'flexibility']
const NEUROLOGICAL: PhysicalSkill[] = ['coordination', 'agility', 'balance', 'accuracy']
const BOTH: PhysicalSkill[] = ['power', 'speed']

// Coach prescriptions per skill (the numbers around them are computed at runtime)
const DRILLS: Record<PhysicalSkill, string> = {
  'cardiovascular-endurance': 'monostructural intervals - run, row, or bike at a sustained pace',
  'stamina': 'longer grinding couplets in the 15-25 minute range',
  'strength': 'a weekly heavy day - 5x5 back squat, 3RM deadlift, strict press',
  'flexibility': 'pause overhead squats, deep goblet squat holds, and daily hip and shoulder mobility',
  'power': 'heavy cleans, snatches, and max-height box jumps at low reps',
  'speed': 'short sprint repeats and fast light-bar cycling with full recovery',
  'coordination': 'double-unders, kipping progressions, and barbell cycling drills',
  'agility': 'shuttle runs, lateral burpees over the bar, and box jump rebound work',
  'balance': 'pistols, single-leg RDLs, handstand holds, and lunges on a line',
  'accuracy': 'wall-ball shots to a marked target, kettlebell snatches to a fixed lockout, and med-ball throws at distance',
}

const shortLabel = (s: PhysicalSkill) => PHYSICAL_SKILL_LABELS[s].split('/')[0]

export default function PhysicalSkills({ data, analysis }: { data: CrossFitData; analysis: AnalysisResults }) {
  const [selectedSkill, setSelectedSkill] = useState<PhysicalSkill | null>(null)
  const drillRef = useRef<HTMLDivElement | null>(null)

  const toggleSkill = (s: PhysicalSkill) => setSelectedSkill((cur) => (cur === s ? null : s))

  useEffect(() => {
    if (selectedSkill && drillRef.current) {
      drillRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedSkill])

  const radarData = useMemo(() =>
    SKILLS.map((skill) => ({
      skill: PHYSICAL_SKILL_LABELS[skill],
      value: analysis.aggregateSkills[skill],
      fullMark: 100,
    })),
    [analysis]
  )

  const barData = useMemo(() =>
    SKILLS
      .map((skill) => ({ name: PHYSICAL_SKILL_LABELS[skill], id: skill, value: analysis.aggregateSkills[skill] }))
      .sort((a, b) => b.value - a.value),
    [analysis]
  )

  const organicAvg = ORGANIC.reduce((s, k) => s + (analysis.aggregateSkills[k] || 0), 0) / ORGANIC.length
  const neuroAvg = NEUROLOGICAL.reduce((s, k) => s + (analysis.aggregateSkills[k] || 0), 0) / NEUROLOGICAL.length

  // Small-multiples series: one per skill, shared y-domain for honest comparison
  const multiples = useMemo(() => {
    let maxY = 0
    const series = SKILLS.map((skill) => {
      const points = analysis.skillsByYear.map((row) => {
        const v = typeof row[skill] === 'number' ? (row[skill] as number) : 0
        if (v > maxY) maxY = v
        return { year: row.year as string, v }
      })
      return { skill, points, current: points.length ? points[points.length - 1] : null }
    })
    return { series, maxY: Math.ceil(maxY / 5) * 5, firstYear: analysis.skillsByYear[0]?.year as string, lastYear: analysis.skillsByYear[analysis.skillsByYear.length - 1]?.year as string }
  }, [analysis])

  // Drill-down: example workouts training the selected skill.
  // Reuses the exact mapping analysis.ts uses: MOVEMENT_TAXONOMY[movement].physicalSkills
  const drill = useMemo(() => {
    if (!selectedSkill) return null
    const matches: { d: string; t: string; mv: string[]; hit: Set<string> }[] = []
    for (const w of data.searchIndex) {
      const hit = w.mv.filter((m) => MOVEMENT_TAXONOMY[m]?.physicalSkills.includes(selectedSkill))
      if (hit.length) matches.push({ d: w.d, t: w.t, mv: w.mv, hit: new Set(hit) })
    }
    matches.sort((a, b) => b.d.localeCompare(a.d))
    return { total: matches.length, rows: matches.slice(0, 8) }
  }, [selectedSkill, data])

  // Coach takeaways: computed from the data, never hardcoded
  const takeaways = useMemo(() => {
    const asc = SKILLS.map((s) => ({ s, v: analysis.aggregateSkills[s] })).sort((a, b) => a.v - b.v)
    const desc = [...asc].reverse()
    const top = desc[0]
    const low1 = asc[0]
    const low2 = asc[1]
    const out: { claim: string; action: string }[] = [
      {
        claim: `${shortLabel(low1.s)} is the most undertrained skill - it gets just ${low1.v.toFixed(0)}% of the exposure ${shortLabel(top.s)} gets.`,
        action: `Program it on purpose: ${DRILLS[low1.s]}.`,
      },
      {
        claim: `${shortLabel(low2.s)} runs second-lowest at ${low2.v.toFixed(0)}% of the top skill's volume.`,
        action: `Fold in ${DRILLS[low2.s]}.`,
      },
    ]
    if (neuroAvg < organicAvg) {
      out.push({
        claim: `Neurological skills average ${neuroAvg.toFixed(0)} vs ${organicAvg.toFixed(0)} for organic skills.`,
        action: 'These improve with practice, not fatigue - put short quality sessions of balance, accuracy and agility work before the metcon, while athletes are fresh.',
      })
    } else if (organicAvg < neuroAvg) {
      out.push({
        claim: `Organic skills average ${organicAvg.toFixed(0)} vs ${neuroAvg.toFixed(0)} for neurological skills.`,
        action: 'These improve with volume - add longer sustained efforts and a regular heavy day to move endurance, stamina and strength.',
      })
    }
    return out
  }, [analysis, organicAvg, neuroAvg])

  const skillRow = (s: PhysicalSkill) => (
    <button
      key={s}
      type="button"
      onClick={() => toggleSkill(s)}
      className={`w-full flex items-center justify-between py-1.5 px-1 -mx-1 rounded text-left border-b border-[var(--panel-border)] last:border-0 hover:bg-[var(--panel-bg-hover)] cursor-pointer ${selectedSkill === s ? 'bg-[var(--panel-bg-hover)]' : ''}`}
      title={`Show example workouts that train ${PHYSICAL_SKILL_LABELS[s]}`}
    >
      <span className="text-xs text-[var(--text-secondary)]">{PHYSICAL_SKILL_LABELS[s]}</span>
      <span className="flex items-center gap-2">
        <span className="w-24 h-1.5 rounded bg-[var(--panel-bg-hover)] inline-block">
          <span className="block h-full rounded bg-[#019644]/70" style={{ width: `${analysis.aggregateSkills[s]}%` }} />
        </span>
        <span className="text-[10px] font-mono text-[var(--text-muted)] w-8 text-right">{analysis.aggregateSkills[s].toFixed(0)}</span>
      </span>
    </button>
  )

  const tooltipStyle = { background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 11 }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl text-[var(--text-primary)] uppercase" style={{ fontFamily: "'Anton', sans-serif", letterSpacing: '0.5px' }}>10 General Physical Skills</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          CrossFit says fitness is competence in all 10 general physical skills.
          Here's which skills each workout actually trains. Click any skill for example workouts.
        </p>
      </div>

      {/* Skill balance score */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Skill Balance Score</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {((1 - analysis.skillBalance) * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">100% = perfectly balanced across all 10 skills</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Organic Skills Avg</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{organicAvg.toFixed(0)}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Endurance, Stamina, Strength, Flexibility</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Improved by training (doing)</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Neurological Skills Avg</div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{neuroAvg.toFixed(0)}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Coordination, Agility, Balance, Accuracy</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Improved by practice</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Skill Radar - Overall Programming</h3>
          <div style={{ width: '100%', height: 380 }}><ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
              <PolarRadiusAxis tick={false} domain={[0, 100]} axisLine={false} />
              <Radar dataKey="value" stroke={GREEN} fill={GREEN} fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer></div>
        </div>

        {/* Bar chart */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Skill Emphasis Ranking</h3>
          <div style={{ width: '100%', height: 380 }}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} width={115} />
              <Tooltip contentStyle={{ ...tooltipStyle, fontSize: 12 }} cursor={{ fill: 'var(--panel-bg-hover)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={GREEN} fillOpacity={0.75} />
            </BarChart>
          </ResponsiveContainer></div>
        </div>
      </div>

      {/* Skill category breakdown */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-4">Skill Classification (per CrossFit's Model)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Organic Adaptations (Train by Doing)</div>
            {ORGANIC.map(skillRow)}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Neurological Adaptations (Train by Practice)</div>
            {NEUROLOGICAL.map(skillRow)}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Both Organic & Neurological</div>
            {BOTH.map(skillRow)}
          </div>
        </div>
      </div>

      {/* Skills over time: small multiples, shared y-domain */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-xs font-medium text-[var(--text-tertiary)]">Skill Emphasis Over Time</h3>
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 mb-3">
          Share of each year's skill exposure, {multiples.firstYear} to {multiples.lastYear}. Every chart uses the same scale (0-{multiples.maxY}%) so heights compare honestly. Click one for example workouts.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {multiples.series.map(({ skill, points, current }) => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={`text-left rounded-lg border p-2 hover:bg-[var(--panel-bg-hover)] cursor-pointer ${selectedSkill === skill ? 'border-[#019644] bg-[var(--panel-bg-hover)]' : 'border-[var(--panel-border)]'}`}
              title={`Show example workouts that train ${PHYSICAL_SKILL_LABELS[skill]}`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] truncate">{shortLabel(skill)}</span>
                {current && (
                  <span className="text-[10px] font-mono text-[var(--text-primary)] whitespace-nowrap">{current.year}: {current.v.toFixed(1)}%</span>
                )}
              </div>
              <div style={{ width: '100%', height: 120 }}><ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                  <XAxis dataKey="year" hide />
                  <YAxis hide domain={[0, multiples.maxY]} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, shortLabel(skill)]}
                  />
                  <Area type="monotone" dataKey="v" stroke={GREEN} strokeWidth={2} fill={GREEN} fillOpacity={0.12} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer></div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] font-mono text-[var(--text-muted)]">{multiples.firstYear}</span>
                <span className="text-[9px] font-mono text-[var(--text-muted)]">{multiples.lastYear}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drill-down: example workouts for the selected skill */}
      {selectedSkill && drill && (
        <div ref={drillRef} className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-xs font-medium text-[var(--text-primary)]">Workouts that train {PHYSICAL_SKILL_LABELS[selectedSkill]}</h3>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {drill.total.toLocaleString()} workouts in the archive include a movement mapped to this skill. Showing the {Math.min(8, drill.total)} most recent. Bold movements are the ones that train it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSkill(null)}
              className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
            >
              Close
            </button>
          </div>
          <div>
            {drill.rows.map((w) => (
              <div key={w.d} className="flex gap-3 py-2 border-b border-[var(--panel-border)] last:border-0">
                <span className="w-20 shrink-0 text-[11px] font-mono text-[var(--text-muted)] leading-5">{w.d}</span>
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text-primary)] leading-5 truncate">{w.t}</div>
                  <div className="text-[11px] mt-0.5">
                    {w.mv.map((m, i) => (
                      <span key={m}>
                        <span className={w.hit.has(m) ? 'font-semibold text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}>
                          {data.movementDisplay[m] || m}
                        </span>
                        {i < w.mv.length - 1 && <span className="text-[var(--text-muted)]">, </span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coach takeaways */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)] border-l-2 border-l-[#019644]">
        <h3 className="text-xs font-medium text-[var(--text-primary)] mb-3">What to do with this</h3>
        <div className="space-y-2.5">
          {takeaways.map((t, i) => (
            <p key={i} className="text-sm leading-relaxed">
              <span className="font-semibold text-[var(--text-primary)]">{t.claim}</span>{' '}
              <span className="text-[var(--text-secondary)]">{t.action}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
