import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import type { CrossFitData, Workout } from '../types'
import {
  MOVEMENT_TAXONOMY,
  classifyEnergySystem,
  getWorkoutSkills,
  getWorkoutComplexity,
  getWorkoutMuscles,
  PHYSICAL_SKILL_LABELS,
  FUNCTIONAL_PATTERN_LABELS,
  MUSCLE_GROUP_LABELS,
  ENERGY_SYSTEM_LABELS,
  ENERGY_SYSTEM_COLORS,
} from '../data/movement-taxonomy'
import {
  MODALITY_COLORS,
  MODALITY_LABELS,
  TIME_DOMAIN_COLORS,
  STRUCTURE_COLORS,
} from '../utils/colors'

// ─── Similarity ────────────────────────────────────────────────

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const x of setA) if (setB.has(x)) intersection++
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function findSimilar(target: Workout, allWorkouts: Workout[], top = 5): { workout: Workout; score: number }[] {
  const scored: { workout: Workout; score: number }[] = []
  for (const w of allWorkouts) {
    if (w.d === target.d && w.t === target.t) continue // skip self
    let score = jaccardSimilarity(target.mv, w.mv)
    if (w.mo === target.mo) score += 0.1
    if (w.td === target.td) score += 0.1
    if (score > 0) scored.push({ workout: w, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, top)
}

// ─── Complexity bar helper ─────────────────────────────────────

function ComplexityMeter({ value }: { value: number }) {
  const pct = Math.min((value / 5) * 100, 100)
  let color = '#10b981'
  if (value >= 4) color = '#f43f5e'
  else if (value >= 3) color = '#f59e0b'
  else if (value >= 2) color = '#3b82f6'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[var(--panel-bg-hover)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-[var(--text-secondary)] w-10 text-right">{value.toFixed(1)}/5</span>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────

export default function WorkoutDecoder({ data }: { data: CrossFitData }) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selected, setSelected] = useState<Workout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Search results
  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return data.searchIndex
      .filter((w) =>
        w.t.toLowerCase().includes(q) ||
        w.d.includes(q) ||
        w.s.toLowerCase().includes(q) ||
        w.nw.toLowerCase().includes(q)
      )
      .slice(0, 20)
  }, [query, data.searchIndex])

  // Derived analysis for selected workout
  const analysis = useMemo(() => {
    if (!selected) return null
    const energySystem = classifyEnergySystem(selected.td, selected.st)
    const skills = getWorkoutSkills(selected.mv)
    const complexity = getWorkoutComplexity(selected.mv)
    const muscles = getWorkoutMuscles(selected.mv)
    const similar = findSimilar(selected, data.searchIndex)

    // Build movement detail list
    const movementDetails = selected.mv.map((mvId) => {
      const tax = MOVEMENT_TAXONOMY[mvId]
      const displayName = data.movementDisplay[mvId] || mvId
      const modality = data.movementModality[mvId] || '?'
      return {
        id: mvId,
        name: displayName,
        modality,
        patterns: tax?.functionalPattern || [],
        complexity: tax?.complexity || 0,
      }
    })

    // Radar chart data
    const radarData = Object.entries(skills).map(([skill, value]) => ({
      skill: (PHYSICAL_SKILL_LABELS as Record<string, string>)[skill]?.replace('Cardio/Respiratory ', 'Cardio\n') || skill,
      value,
      fullMark: 100,
    }))

    // Muscle group data — only non-zero
    const muscleData = Object.entries(muscles)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([mg, count]) => ({
        id: mg,
        name: (MUSCLE_GROUP_LABELS as Record<string, string>)[mg] || mg,
        count,
      }))

    return { energySystem, skills, complexity, muscles, similar, movementDetails, radarData, muscleData }
  }, [selected, data])

  const handleSelect = useCallback((w: Workout) => {
    setSelected(w)
    setQuery('')
    setShowDropdown(false)
  }, [])

  // Format date nicely
  const formatDate = (d: string) => {
    try {
      const dt = new Date(d + 'T00:00:00')
      return dt.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    } catch { return d }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Workout Decoder</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Pick any workout and get a full nutritional-label-style breakdown of what's inside it.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by name, date, or keyword..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => { if (query.trim()) setShowDropdown(true) }}
          className="w-full bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
        />
        <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {/* Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto bg-[var(--panel-bg)] border border-[var(--panel-border-strong)] rounded-lg shadow-2xl"
          >
            {searchResults.map((w, i) => (
              <button
                key={`${w.d}-${i}`}
                onClick={() => handleSelect(w)}
                className="w-full text-left px-4 py-2.5 hover:bg-[var(--panel-bg-hover)] transition-colors border-b border-[var(--panel-border)] last:border-0 flex items-start gap-3"
              >
                <span className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap pt-0.5">{w.d}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">
                    {w.nw ? <span className="text-amber-400 font-medium">{w.nw} — </span> : null}
                    {w.t}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] flex gap-2 mt-0.5">
                    <span style={{ color: MODALITY_COLORS[w.mo] || '#6b7280' }}>{w.mo}</span>
                    <span>{w.st}</span>
                    <span>{w.td}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {showDropdown && query.trim() && searchResults.length === 0 && (
          <div className="absolute z-50 mt-1 w-full bg-[var(--panel-bg)] border border-[var(--panel-border-strong)] rounded-lg p-4 text-sm text-[var(--text-muted)]">
            No workouts found for "{query}"
          </div>
        )}
      </div>

      {/* No selection state */}
      {!selected && (
        <div className="bg-[var(--panel-bg)] rounded-xl border border-[var(--panel-border)] p-12 text-center">
          <div className="text-4xl mb-4 opacity-30">&#x1F50D;</div>
          <div className="text-[var(--text-tertiary)] text-sm">Search for a workout above to decode it</div>
          <div className="text-[var(--text-muted)] text-xs mt-2">
            Try searching "Fran", "Murph", "2024-01-15", or "thruster"
          </div>
        </div>
      )}

      {/* Selected workout display */}
      {selected && analysis && (
        <>
          {/* Workout header */}
          <div className="bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-rose-500/5 rounded-xl border border-[var(--panel-border-strong)] p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] font-mono text-[var(--text-muted)] mb-1">{formatDate(selected.d)}</div>
                {selected.nw && (
                  <div className="text-lg font-bold text-amber-400 mb-1">
                    {selected.nw}
                    {selected.ih && <span className="ml-2 text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full font-normal">Hero</span>}
                    {selected.ib && <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-normal">Benchmark</span>}
                  </div>
                )}
                <div className="text-sm text-white font-medium">{selected.t}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[var(--text-muted)] hover:text-white transition-colors text-lg leading-none px-2"
                title="Clear selection"
              >
                &times;
              </button>
            </div>
            <div className="bg-[var(--code-bg)] rounded-lg p-4 mt-3 border border-[var(--panel-border)]">
              <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">{selected.s}</pre>
            </div>
          </div>

          {/* Main grid: Nutrition Label + Radar */}
          <div className="grid grid-cols-2 gap-4">
            {/* ─── NUTRITION LABEL ─── */}
            <div className="bg-[#0c0c14] rounded-xl border-[3px] border-white/90 p-0 overflow-hidden">
              {/* Title block */}
              <div className="bg-white/90 px-4 py-2">
                <div className="text-black text-xl font-black tracking-tight">Workout Facts</div>
              </div>
              <div className="h-[3px] bg-white/90" />

              <div className="px-4 py-2">
                {/* Modality */}
                <div className="border-b border-white/20 py-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Modality</span>
                    <span className="text-sm font-bold" style={{ color: MODALITY_COLORS[selected.mo] || '#6b7280' }}>
                      {MODALITY_LABELS[selected.mo] || selected.mo}
                    </span>
                  </div>
                </div>

                {/* Time Domain */}
                <div className="border-b border-white/20 py-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Time Domain</span>
                    <span className="text-sm font-bold" style={{ color: TIME_DOMAIN_COLORS[selected.td] || '#6b7280' }}>
                      {selected.td}
                    </span>
                  </div>
                </div>

                {/* Structure */}
                <div className="border-b border-white/20 py-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Structure</span>
                    <span className="text-sm font-bold" style={{ color: STRUCTURE_COLORS[selected.st] || '#94a3b8' }}>
                      {selected.st}
                    </span>
                  </div>
                </div>

                {/* Load Profile */}
                <div className="border-b border-white/20 py-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Load Profile</span>
                    <span className="text-sm font-bold text-slate-200">{selected.lp}</span>
                  </div>
                </div>

                {/* Thick separator */}
                <div className="h-[6px] bg-white/80 my-1 rounded" />

                {/* Movements */}
                <div className="py-2">
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">Movements</div>
                  {analysis.movementDetails.map((mv) => (
                    <div key={mv.id} className="flex items-center justify-between py-1 border-b border-white/10 last:border-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: MODALITY_COLORS[mv.modality] || '#6b7280' }}
                        />
                        <span className="text-xs text-slate-200">{mv.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {mv.patterns.slice(0, 2).map((p) => (
                          <span key={p} className="text-[8px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded">
                            {(FUNCTIONAL_PATTERN_LABELS as Record<string, string>)[p] || p}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Thick separator */}
                <div className="h-[6px] bg-white/80 my-1 rounded" />

                {/* Energy System */}
                <div className="border-b border-white/20 py-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Energy System</span>
                    <span
                      className="text-sm font-bold px-2 py-0.5 rounded"
                      style={{
                        color: ENERGY_SYSTEM_COLORS[analysis.energySystem],
                        background: ENERGY_SYSTEM_COLORS[analysis.energySystem] + '15',
                      }}
                    >
                      {ENERGY_SYSTEM_LABELS[analysis.energySystem]}
                    </span>
                  </div>
                </div>

                {/* Complexity */}
                <div className="border-b border-white/20 py-2">
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wider mb-1.5">Complexity Score</div>
                  <ComplexityMeter value={analysis.complexity} />
                </div>

                {/* Muscle Groups */}
                <div className="py-2">
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">Muscle Groups</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.muscleData.map((mg) => (
                      <span
                        key={mg.id}
                        className="text-[10px] px-2 py-1 rounded-full border border-white/10 text-slate-300"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        {mg.name}
                        {mg.count > 1 && <span className="ml-1 text-blue-400 font-mono">x{mg.count}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-white/5 px-4 py-2 border-t border-white/20">
                <div className="text-[9px] text-slate-500 leading-relaxed">
                  * Classification derived from CrossFit movement taxonomy.
                  Energy system based on time domain and workout structure.
                </div>
              </div>
            </div>

            {/* ─── RADAR + SKILLS ─── */}
            <div className="space-y-4">
              {/* Physical Skills Radar */}
              <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
                <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-1">Physical Skills Targeted</h3>
                <p className="text-[10px] text-[var(--text-muted)] mb-3">CrossFit's 10 General Physical Skills developed by this workout</p>
                <div style={{width:"100%",height:280}}><ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={analysis.radarData} cx="50%" cy="50%">
                    <PolarGrid stroke="var(--chart-grid)" />
                    <PolarAngleAxis
                      dataKey="skill"
                      tick={{ fontSize: 8, fill: 'var(--chart-axis)' }}
                    />
                    <PolarRadiusAxis tick={false} domain={[0, 100]} axisLine={false} />
                    <Radar
                      dataKey="value"
                      stroke="#60a5fa"
                      fill="#60a5fa"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer></div>
              </div>

              {/* Skills list */}
              <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
                <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Skill Emphasis Breakdown</h3>
                {Object.entries(analysis.skills)
                  .sort((a, b) => b[1] - a[1])
                  .map(([skill, value]) => (
                    <div key={skill} className="flex items-center gap-2 py-1">
                      <span className="text-[10px] text-[var(--text-tertiary)] w-28 truncate">
                        {(PHYSICAL_SKILL_LABELS as Record<string, string>)[skill] || skill}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--panel-bg-hover)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${value}%`,
                            background: value > 0 ? '#60a5fa' : 'transparent',
                            opacity: Math.max(value / 100, 0.3),
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] w-6 text-right">{value}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* ─── SIMILAR WORKOUTS ─── */}
          <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
            <h3 className="text-sm font-medium text-white mb-1">Similar Workouts</h3>
            <p className="text-[10px] text-[var(--text-muted)] mb-4">
              Top 5 most similar WODs by movement overlap (Jaccard similarity) with bonuses for matching modality and time domain.
            </p>
            {analysis.similar.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] py-4 text-center">No similar workouts found.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {analysis.similar.map((s, i) => {
                  const sw = s.workout
                  const pct = Math.round(s.score * 100)
                  return (
                    <button
                      key={`${sw.d}-${i}`}
                      onClick={() => handleSelect(sw)}
                      className="w-full text-left bg-[var(--code-bg)] hover:bg-[var(--panel-bg-hover)] rounded-lg p-4 border border-[var(--panel-border)] hover:border-[var(--panel-border-strong)] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">{sw.d}</span>
                            {sw.nw && <span className="text-xs font-medium text-amber-400">{sw.nw}</span>}
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: MODALITY_COLORS[sw.mo] || '#6b7280', background: (MODALITY_COLORS[sw.mo] || '#6b7280') + '15' }}>
                              {sw.mo}
                            </span>
                            <span className="text-[9px] text-[var(--text-muted)]">{sw.td}</span>
                            <span className="text-[9px] text-[var(--text-muted)]">{sw.st}</span>
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] truncate group-hover:text-white transition-colors">
                            {sw.t}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {sw.mv.map((mvId) => (
                              <span
                                key={mvId}
                                className={`text-[9px] px-1.5 py-0.5 rounded ${
                                  selected.mv.includes(mvId)
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-white/5 text-[var(--text-muted)]'
                                }`}
                              >
                                {data.movementDisplay[mvId] || mvId}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-lg font-bold font-mono" style={{
                            color: pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#64748b'
                          }}>
                            {pct}%
                          </div>
                          <div className="text-[9px] text-[var(--text-muted)]">match</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ─── EXPLAINER ─── */}
          <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-xl p-5 border border-blue-500/10">
            <div className="flex items-start gap-3">
              <div className="text-blue-400 text-lg mt-0.5">&#x1F4A1;</div>
              <div>
                <div className="text-xs font-medium text-blue-300 mb-1">How to Read This</div>
                <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                  Think of this as a nutrition label for workouts. Just like food labels tell you what's
                  inside your meal, this tells you exactly what's inside any CrossFit workout — which
                  muscles, which energy system, which skills, and what it's most similar to.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
