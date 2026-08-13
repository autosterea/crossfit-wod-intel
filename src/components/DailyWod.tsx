import { useState, useMemo } from 'react'
import type { CrossFitData, Workout } from '../types'

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const x of setA) if (setB.has(x)) intersection++
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

const MODALITY_LABEL: Record<string, string> = {
  M: 'Monostructural',
  G: 'Gymnastics',
  W: 'Weightlifting',
  MG: 'Mono + Gym',
  MW: 'Mono + Weight',
  GW: 'Gym + Weight',
  MGW: 'Mono + Gym + Weight',
  Unknown: 'Unclassified',
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Effective = Workout & { isLive?: boolean; raw?: string }

export default function DailyWod({ data }: { data: CrossFitData }) {
  const today = todayIso()
  const [selected, setSelected] = useState<string>(today)

  const datedIndex = useMemo(() => {
    const m = new Map<string, Workout>()
    for (const w of data.searchIndex) m.set(w.d, w)
    return m
  }, [data])

  const sortedDates = useMemo(() => Array.from(datedIndex.keys()).sort(), [datedIndex])

  const workout: Effective | null = useMemo(() => {
    if (selected === today && data.todaysWod && data.todaysWod.date === today) {
      const tw = data.todaysWod
      return {
        d: tw.date,
        t: tw.title || `Workout ${tw.date}`,
        s: tw.wod_raw || '',
        raw: tw.wod_raw || '',
        mo: tw.modality || 'Unknown',
        st: tw.structure || 'Other',
        td: tw.time_domain || 'Medium',
        lp: tw.load_profile || 'Unknown',
        nw: tw.named_wod || '',
        ih: false,
        ib: false,
        mv: tw.movements || [],
        isLive: true,
      }
    }
    const w = datedIndex.get(selected)
    if (!w) return null
    return { ...w, raw: w.s }
  }, [selected, today, datedIndex, data.todaysWod])

  const similar = useMemo(() => {
    if (!workout || !workout.mv.length) return []
    return data.searchIndex
      .filter((w) => w.d !== workout.d)
      .map((w) => ({ w, score: jaccard(workout.mv, w.mv) + (w.mo === workout.mo ? 0.1 : 0) + (w.td === workout.td ? 0.05 : 0) }))
      .filter((s) => s.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
  }, [workout, data])

  const looksLikeWorkout = !!workout && (workout.mv.length > 0 || workout.mo !== 'Unknown' || /\b(amrap|emom|for time|rounds|reps|tabata)\b/i.test(workout.raw || ''))
  const isRestDay = !!workout && !looksLikeWorkout

  // Find the most recent date with an actual workout - for the "View most recent workout" CTA on rest days
  const mostRecentWorkoutDate = useMemo(() => {
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const w = datedIndex.get(sortedDates[i])
      if (w && w.mv.length > 0 && w.d < selected) return sortedDates[i]
    }
    return null
  }, [sortedDates, datedIndex, selected])

  const stepDay = (delta: number) => {
    if (selected === today) {
      // Step from today goes to the most recent workout in searchIndex
      if (delta < 0 && sortedDates.length) {
        const lastIdx = sortedDates.length - 1
        // If today is in the index (== last date), step to lastIdx - 1
        const idx = sortedDates[lastIdx] === today ? lastIdx - 1 : lastIdx
        if (idx >= 0) setSelected(sortedDates[idx])
      }
      return
    }
    const idx = sortedDates.indexOf(selected)
    if (idx < 0) return
    const next = idx + delta
    if (next >= 0 && next < sortedDates.length) setSelected(sortedDates[next])
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header / date controls */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#91C640] animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)]">Daily WOD</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {workout ? formatDate(workout.d) : 'Select a date'}
            {workout?.isLive && <span className="ml-2 text-[#91C640]">Live from crossfit.com</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => stepDay(-1)}
            className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-md hover:bg-[var(--panel-bg-2)] transition-colors"
            aria-label="Previous day"
          >←</button>
          <input
            type="date"
            value={selected}
            max={today}
            min={sortedDates[0]}
            onChange={(e) => setSelected(e.target.value)}
            className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-secondary)] font-mono focus:border-[#019644]/50 focus:outline-none"
          />
          <button
            onClick={() => stepDay(1)}
            disabled={selected === today}
            className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-md hover:bg-[var(--panel-bg-2)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next day"
          >→</button>
          <button
            onClick={() => setSelected(today)}
            disabled={selected === today}
            className="ml-1 px-2.5 py-1.5 text-xs font-medium text-[#91C640] bg-[#91C640]/10 border border-[#91C640]/30 rounded-md hover:bg-[#91C640]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >Today</button>
        </div>
      </div>

      {/* Workout card */}
      {!workout ? (
        <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">No workout posted for {selected}.</p>
          <p className="text-xs text-[var(--text-muted)] mt-2">Try a different date - use the date picker or the navigation arrows.</p>
        </div>
      ) : isRestDay ? (
        // ─── Rest day / article day presentation ──────────────────────────
        <>
          <div className="bg-[var(--panel-bg)] border-2 border-amber-500/30 rounded-xl overflow-hidden">
            <div className="bg-amber-500/10 px-5 py-3 flex items-center gap-2 border-b border-amber-500/30">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
              <h2 className="text-sm font-semibold text-amber-700">Rest Day - No Workout Posted</h2>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                crossfit.com didn't program a workout for <span className="font-medium">{formatDate(workout.d)}</span>.
                {workout.raw && workout.raw !== 'Rest Day' && ' They posted the article below instead.'}
              </p>
              {workout.raw && workout.raw !== 'Rest Day' && (
                <details className="mt-3">
                  <summary className="text-xs text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)]">
                    Show what crossfit.com posted
                  </summary>
                  <pre className="mt-2 px-3 py-3 text-xs text-[var(--text-tertiary)] bg-[var(--panel-bg-2)] border border-[var(--panel-border)] rounded-md whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                    {workout.raw}
                  </pre>
                </details>
              )}
              {mostRecentWorkoutDate && (
                <button
                  onClick={() => setSelected(mostRecentWorkoutDate)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#019644] hover:bg-[#01b350] rounded-lg transition-colors"
                >
                  ← View most recent workout ({formatDate(mostRecentWorkoutDate)})
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Main workout card - the whiteboard */}
          <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] border-l-2 border-l-[#019644] rounded-xl overflow-hidden">
            <div className="px-6 md:px-8 pt-5 pb-4 border-b border-[var(--panel-border)] flex items-end justify-between flex-wrap gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
                  {formatDate(workout.d)}
                </div>
                {workout.nw && (
                  <h2
                    className="mt-1.5 text-3xl md:text-4xl uppercase text-[var(--text-primary)] leading-none"
                    style={{ fontFamily: "'Anton', sans-serif", letterSpacing: '1px' }}
                  >
                    {workout.nw}
                  </h2>
                )}
                <div className="mt-1.5 font-mono text-xs text-[var(--text-muted)]">{workout.t}</div>
              </div>
              {(workout.ih || workout.ib) && (
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {workout.ih && (
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border border-[var(--panel-border)] text-[var(--text-tertiary)]">Hero WOD</span>
                  )}
                  {workout.ib && (
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border border-[var(--panel-border)] text-[var(--text-tertiary)]">Benchmark</span>
                  )}
                </div>
              )}
            </div>
            <pre className="p-6 md:p-8 text-base md:text-lg text-[var(--text-primary)] whitespace-pre-wrap font-mono leading-relaxed">
              {workout.raw || workout.s || '(no description available)'}
            </pre>
            {/* Classification strip */}
            <div className="px-6 md:px-8 py-3 border-t border-[var(--panel-border)] flex flex-wrap gap-y-2">
              {[
                ['Modality', MODALITY_LABEL[workout.mo] || workout.mo],
                ['Structure', workout.st],
                ['Time Domain', workout.td],
                ['Load', workout.lp],
              ].map(([label, value], i) => (
                <div
                  key={label}
                  className={`pr-5 ${i > 0 ? 'pl-5 border-l border-[var(--panel-border)]' : ''}`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Movements */}
          <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-xl p-4">
            <h3 className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
              Movements Detected ({workout.mv.length})
            </h3>
            {workout.mv.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No movements detected - possibly an article, rest day, or unclassified content.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {workout.mv.map((mv) => (
                  <span key={mv} className="px-2.5 py-1 text-[11px] font-mono rounded-md bg-[var(--panel-bg-2)] text-[var(--text-secondary)] border border-[var(--panel-border)]">
                    {data.movementDisplay?.[mv] || mv}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Similar workouts */}
          {similar.length > 0 && (
            <details className="group bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-xl">
              <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider hover:text-[var(--text-secondary)] transition-colors">
                <span className="inline-block text-[var(--text-muted)] transition-transform group-open:rotate-90" aria-hidden="true">›</span>
                Similar Workouts ({similar.length})
              </summary>
              <div className="px-4 pb-4 space-y-1.5">
                {similar.map(({ w, score }) => (
                  <button
                    key={w.d + w.t}
                    onClick={() => setSelected(w.d)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left bg-[var(--panel-bg-2)] border border-[var(--panel-border)] rounded-md hover:border-[#91C640]/40 hover:bg-[#91C640]/[0.04] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-[var(--text-secondary)] group-hover:text-[#91C640] truncate">
                        {w.t}{w.nw ? ` - ${w.nw}` : ''}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                        {formatDate(w.d)} | {w.mo} | {w.st} | {w.td}
                      </div>
                    </div>
                    <div className="ml-3 text-[10px] font-mono text-[#91C640] shrink-0">
                      {Math.min(100, Math.round((score / 1.15) * 100))}%
                    </div>
                  </button>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
