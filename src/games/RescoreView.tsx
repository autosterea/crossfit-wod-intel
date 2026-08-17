import { useEffect, useMemo, useState } from 'react'
import { useGamesStore } from './gamesStore'

// ---------------------------------------------------------------------------
// The Re-Score Machine - /games/2026/rescore
// Interactive what-if: set each event's weight (winner points) and watch the
// 2026 leaderboard recompute live. The 2026 Games paid six events at half
// weight (E3/4/5 CrossFit Total lifts, E9 3D Throw, E13 500 Run, E19 Roll to
// Support); this tool lets anyone re-weight the season and see what changes.
// Scoring faithfulness: at weight 100 we use the official 100-point table; at
// weight 50 we use the official half table (NOT a scaled 100 table - the real
// half table pays slightly differently at the bottom); any other weight scales
// the 100-point table linearly. So the "Official 2026" preset reproduces the
// real final leaderboard exactly.
// ---------------------------------------------------------------------------

// Official points-for-place tables, derived from the live 2026 leaderboard
const TABLE100 = [100, 96, 92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52, 48, 45, 42, 39, 36, 33, 30, 27, 24, 21, 18, 15, 12, 9, 6, 3, 0]
const TABLE50 = [50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0]

const OFFICIAL_WEIGHTS = [100, 100, 50, 50, 50, 100, 100, 100, 50, 100, 100, 100, 50, 100, 100, 100, 100, 100, 50, 100]

const EVENT_NAMES = [
  'The 2007 Hopper', 'Ranch 7200', 'Total: Back Squat', 'Total: Shoulder Press', 'Total: Deadlift',
  'Grass Oval Bicycle Race', 'Swim Standard', "Climbing Snail '26", '3D Throw', 'Run Hang Squat Clean',
  'Handstand Sprint', 'The Hopper 2026', '500 Run', 'Triple Pig', '2020 Speed Snatch',
  'Echo Thruster', 'Jump Pull Yoke', 'Machine 7200', 'Roll to Support', 'Fibonacci Final',
]

const WEIGHT_STEPS = [0, 25, 50, 75, 100, 125, 150, 175, 200]

interface LiveAthlete { name: string; ev: { pts: number | null; rank: number | null; disp?: string }[]; cum: number[]; rank: number[] }
interface LiveBoard { men: { athletes: LiveAthlete[] }; women: { athletes: LiveAthlete[] } }

function pointsFor(rank: number | null, weight: number): number {
  if (rank == null || rank < 1 || rank > 30) return 0
  if (weight === 100) return TABLE100[rank - 1]
  if (weight === 50) return TABLE50[rank - 1]
  return (TABLE100[rank - 1] * weight) / 100
}

const PRESETS: { key: string; label: string; weights: number[] }[] = [
  { key: 'official', label: 'Official 2026', weights: [...OFFICIAL_WEIGHTS] },
  { key: 'equal', label: 'Every event 100', weights: Array(20).fill(100) },
  { key: 'noskill', label: 'Cut the half-weight six', weights: OFFICIAL_WEIGHTS.map((w) => (w === 50 ? 0 : 100)) },
  { key: 'doubletotal', label: 'Total counts double', weights: OFFICIAL_WEIGHTS.map((w, i) => (i === 2 || i === 3 || i === 4 ? 200 : w)) },
]

export default function RescoreView() {
  const navigate = useGamesStore((s) => s.navigate)
  const [board, setBoard] = useState<LiveBoard | null>(null)
  const [division, setDivision] = useState<'men' | 'women'>('men')
  const [weights, setWeights] = useState<number[]>([...OFFICIAL_WEIGHTS])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch('/live-leaderboard-2026.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setBoard)
      .catch(() => setBoard(null))
  }, [])

  const athletes = board?.[division]?.athletes ?? []

  const official = useMemo(() => {
    // Use the board's own final standings (rank[last]) so official ties are honored exactly
    const rankOf: Record<string, number> = {}
    let champ = ''
    athletes.forEach((a) => {
      const r = a.rank[a.rank.length - 1] ?? 0
      rankOf[a.name] = r
      if (r === 1) champ = a.name
    })
    return { rankOf, champ }
  }, [athletes])

  const rescored = useMemo(() => {
    const rows = athletes.map((a) => {
      let pts = 0
      a.ev.forEach((e, i) => { pts += pointsFor(e?.rank ?? null, weights[i]) })
      return { name: a.name, pts: Math.round(pts * 10) / 10 }
    })
    rows.sort((x, y) => y.pts - x.pts)
    return rows
  }, [athletes, weights])

  const isOfficial = weights.every((w, i) => w === OFFICIAL_WEIGHTS[i])
  const officialChamp = official.champ
  const newChamp = rescored[0]?.name
  const champFlipped = !!officialChamp && !!newChamp && officialChamp !== newChamp

  const activePreset = PRESETS.find((p) => p.weights.every((w, i) => w === weights[i]))?.key

  const setWeight = (i: number, w: number) => {
    setWeights((prev) => prev.map((v, j) => (j === i ? w : v)))
  }

  const visible = showAll ? rescored : rescored.slice(0, 10)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="games-condensed text-[11px] uppercase tracking-[0.2em] text-[#91C640] mb-1">2026 What-If Lab</div>
        <h1 className="games-display text-3xl sm:text-5xl text-[var(--text-primary)] uppercase leading-[0.95]">The Re-Score Machine</h1>
        <p className="mt-3 text-[13.5px] sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
          The 2026 Games quietly paid six of its 20 tests at HALF points: the three CrossFit Total lifts, the 3D Throw,
          the 500 Run, and Roll to Support. Those weights decided the men's title. Set every event's value yourself and
          watch the season recompute - live, from the official per-event finishes.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
          {(['men', 'women'] as const).map((d) => (
            <button key={d} onClick={() => setDivision(d)}
              className="games-condensed px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors"
              style={{ background: division === d ? '#019644' : 'transparent', color: division === d ? '#fff' : 'var(--text-secondary)' }}>{d}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setWeights([...p.weights])}
              className={`games-condensed px-3 py-1.5 text-[12px] uppercase tracking-[0.06em] rounded-lg border transition-colors ${
                activePreset === p.key
                  ? 'border-[#91C640]/60 text-[#91C640] bg-[#91C640]/10'
                  : 'border-[var(--panel-border)] text-[var(--text-secondary)] hover:border-[#91C640]/40'
              }`}>{p.label}</button>
          ))}
        </div>
      </div>

      {!board ? (
        <div className="cap-card p-8 text-center text-sm text-[var(--text-tertiary)]">Loading the official leaderboard&hellip;</div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_400px] gap-5 items-start">
          {/* Sliders */}
          <div className="cap-card p-4 sm:p-5 order-2 lg:order-1">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="games-condensed text-[12px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Winner points per event</h2>
              <span className="text-[11px] text-[var(--text-muted)]">drag to re-weight</span>
            </div>
            <div className="space-y-3">
              {EVENT_NAMES.map((name, i) => {
                const w = weights[i]
                const changed = w !== OFFICIAL_WEIGHTS[i]
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-40 sm:w-48 shrink-0 min-w-0">
                      <div className="text-[12px] font-medium text-[var(--text-secondary)] truncate">
                        <span className="font-mono text-[10px] text-[var(--text-muted)] mr-1.5">E{i + 1}</span>{name}
                      </div>
                      {OFFICIAL_WEIGHTS[i] === 50 && (
                        <div className="text-[9.5px] uppercase tracking-wider text-[#91C640]/80">half-weight in real life</div>
                      )}
                    </div>
                    <input
                      type="range" min={0} max={8} step={1}
                      value={WEIGHT_STEPS.indexOf(w) >= 0 ? WEIGHT_STEPS.indexOf(w) : 4}
                      onChange={(e) => setWeight(i, WEIGHT_STEPS[Number(e.target.value)])}
                      className="rescore-slider flex-1 min-w-0"
                      aria-label={`Winner points for event ${i + 1}: ${name}`}
                    />
                    <div className={`w-10 shrink-0 text-right font-mono text-[13px] ${changed ? 'text-[#91C640]' : 'text-[var(--text-secondary)]'}`}>{w}</div>
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-[10.5px] text-[var(--text-muted)] leading-relaxed">
              Scoring: place-for-points exactly as the official 2026 tables paid (100-point table, and the official half
              table at weight 50). Other weights scale the 100-point table. "Official 2026" reproduces the real final
              leaderboard to the point.
            </p>
          </div>

          {/* Board */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-20">
            {champFlipped && (
              <div className="mb-3 rounded-xl border border-[#91C640]/50 bg-[#91C640]/10 px-4 py-3">
                <div className="games-condensed text-[10.5px] uppercase tracking-[0.16em] text-[#91C640]">Your scoring changes the champion</div>
                <div className="games-display text-xl text-[var(--text-primary)] uppercase leading-tight mt-0.5">{newChamp} takes the title</div>
              </div>
            )}
            <div className="cap-card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--panel-border)] flex items-baseline justify-between">
                <h2 className="games-condensed text-[12px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  {isOfficial ? 'Official final standings' : 'Your re-scored standings'}
                </h2>
                <span className="text-[10.5px] text-[var(--text-muted)]">{division === 'men' ? 'Men' : 'Women'} &middot; 20 events</span>
              </div>
              <div>
                {visible.map((r, i) => {
                  const offRank = official.rankOf[r.name] ?? 0
                  const delta = offRank - (i + 1)
                  return (
                    <div key={r.name}
                      className={`flex items-center gap-3 px-4 py-2 border-b border-[var(--panel-border)] last:border-b-0 ${i === 0 ? 'bg-[#019644]/10' : ''}`}>
                      <div className={`w-7 shrink-0 text-right font-mono text-[13px] ${i < 3 ? 'text-[#91C640] font-bold' : 'text-[var(--text-muted)]'}`}>{i + 1}</div>
                      <div className="flex-1 min-w-0 text-[13.5px] font-medium text-[var(--text-primary)] truncate">{r.name}</div>
                      <div className="font-mono text-[13px] text-[var(--text-secondary)]">{r.pts % 1 === 0 ? r.pts : r.pts.toFixed(1)}</div>
                      <div className="w-9 shrink-0 text-right font-mono text-[11px]">
                        {isOfficial || delta === 0 ? (
                          <span className="text-[var(--text-muted)]">&ndash;</span>
                        ) : delta > 0 ? (
                          <span className="text-[#91C640]">&#9650;{delta}</span>
                        ) : (
                          <span className="text-[#e05252]">&#9660;{-delta}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setShowAll((v) => !v)}
                className="w-full px-4 py-2.5 text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[#91C640] transition-colors">
                {showAll ? 'Show top 10' : 'Show all 30'}
              </button>
            </div>
            <p className="mt-2 text-[10.5px] text-[var(--text-muted)] leading-relaxed">
              &#9650;&#9660; = places gained or lost vs the official result. A thought experiment, not a protest: athletes
              raced the format they were given.
            </p>
            <button onClick={() => navigate({ view: 'hub', year: 2026 })}
              className="mt-3 text-[12px] text-[#91C640] hover:underline">&larr; Back to the 2026 hub</button>
          </div>
        </div>
      )}
    </div>
  )
}
