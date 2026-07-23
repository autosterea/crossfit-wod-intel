import { useEffect, useState } from 'react'

type Ath = { name: string; slug: string | null; country: string | null; cum: number[]; rank: number[]; ev: { rank: number | null; disp: string; pts: number }[] }
type DivData = { events: { num: number; short: string }[]; athletes: Ath[] }
type Data = { updated: string; men: DivData; women: DivData }

const ord = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th')
const ordinal = (n: number) => `${n}${ord(n)}`

// Chart coordinate system: a fixed logical viewBox, stretched to the
// container width via preserveAspectRatio="none" so the SVG stays
// responsive without recomputing point math per render width.
const VB_W = 640
const VB_H = 200
const PAD_L = 30
const PAD_R = 58
const PAD_T = 16
const PAD_B = 26
const PLOT_W = VB_W - PAD_L - PAD_R
const PLOT_H = VB_H - PAD_T - PAD_B
const GRID_RANKS = [1, 10, 20, 30]

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--panel-bg-2)', border: '1px solid var(--panel-border-subtle)' }}>
      <div className="games-display text-lg sm:text-xl leading-none truncate" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
      <div className="games-condensed text-[9.5px] uppercase tracking-[0.12em] text-[var(--text-muted)] mt-1">{label}</div>
    </div>
  )
}

// Day-by-day overall-rank chart for a single athlete's 2026 profile page.
// Reads the same /live-leaderboard-2026.json feed as LiveLeaderboard /
// LiveHeroStrip, resolves the athlete by slug across both divisions, and
// self-hides until that athlete has at least one scored event.
export default function Live2026Performance({ slug }: { slug: string }) {
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    fetch('/live-leaderboard-2026.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no data'))))
      .then((d: Data) => setData(d))
      .catch(() => {})
  }, [])

  if (!data) return null

  let ath: Ath | undefined
  let dd: DivData | undefined
  for (const div of [data.men, data.women]) {
    const found = div.athletes.find((a) => a.slug === slug)
    if (found) {
      ath = found
      dd = div
      break
    }
  }
  if (!ath || !dd || dd.events.length === 0 || ath.rank.length === 0) return null

  const n = Math.min(ath.rank.length, dd.events.length)
  const ranks = ath.rank.slice(0, n)
  const events = dd.events.slice(0, n)
  const Y_MAX = Math.max(30, dd.athletes.length, ...ranks)

  const xFor = (i: number) => PAD_L + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W)
  const yFor = (rank: number) => PAD_T + (Math.min(Math.max(rank, 1), Y_MAX) - 1) / (Y_MAX - 1) * PLOT_H

  const points = ranks.map((r, i) => `${xFor(i)},${yFor(r)}`).join(' ')
  const lastRank = ranks[n - 1]
  const lastCum = ath.cum[n - 1]

  const evRows = events.map((e, i) => ({ e, i, rank: ath!.ev[i]?.rank ?? null, disp: ath!.ev[i]?.disp ?? '' }))
  const scored = evRows.filter((r) => r.rank != null) as { e: DivData['events'][number]; i: number; rank: number; disp: string }[]
  const best = scored.length ? scored.reduce((a, b) => (b.rank < a.rank ? b : a)) : null
  const worst = scored.length ? scored.reduce((a, b) => (b.rank > a.rank ? b : a)) : null

  return (
    <section className="mb-6 games-rise games-rise-2">
      <div className="games-condensed text-[11px] uppercase tracking-[0.2em] text-[#91C640] mb-1">2026 Games - Live</div>
      <h2 className="games-display text-2xl sm:text-3xl text-[var(--text-primary)] mb-3">Day-by-day standing</h2>

      {/* Rank-over-time line chart */}
      <div className="cap-card p-3 sm:p-4 mb-3">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height={200} preserveAspectRatio="none" role="img" aria-label={`${ath.name} overall rank after each event, currently ${ordinal(lastRank)}`}>
          {GRID_RANKS.filter((r) => r <= Y_MAX).map((r) => (
            <g key={r}>
              <line x1={PAD_L} x2={VB_W - PAD_R} y1={yFor(r)} y2={yFor(r)} style={{ stroke: 'var(--panel-border)' }} strokeWidth={1} />
              <text x={PAD_L - 6} y={yFor(r) + 3} textAnchor="end" fontSize={9} style={{ fill: 'var(--text-muted)' }}>{r}</text>
            </g>
          ))}

          {events.map((e, i) => (
            <text key={e.num} x={xFor(i)} y={VB_H - PAD_B + 15} textAnchor="middle" fontSize={9.5} className="games-condensed" style={{ fill: 'var(--text-muted)' }}>
              E{e.num}
            </text>
          ))}

          <polyline points={points} fill="none" stroke="#91C640" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {ranks.map((r, i) => {
            const last = i === n - 1
            return <circle key={i} cx={xFor(i)} cy={yFor(r)} r={last ? 5.5 : 3} fill={last ? '#019644' : '#91C640'} />
          })}

          <text x={xFor(n - 1) + 10} y={yFor(lastRank) + 3.5} fontSize={11.5} fontWeight={700} className="games-condensed" style={{ fill: '#019644' }}>
            now {ordinal(lastRank)}
          </text>
        </svg>
      </div>

      {/* Per-event chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: 'thin' }}>
        {evRows.map(({ e, i, rank, disp }) => {
          const isBest = best != null && i === best.i
          const isWorst = !isBest && worst != null && i === worst.i
          return (
            <div
              key={e.num}
              className="shrink-0 rounded-lg px-3 py-2 min-w-[86px] text-center"
              style={{
                background: isBest ? 'rgba(1,150,68,0.12)' : isWorst ? 'rgba(217,115,107,0.12)' : 'var(--panel-bg-2)',
                border: `1px solid ${isBest ? 'rgba(1,150,68,0.4)' : isWorst ? 'rgba(217,115,107,0.4)' : 'var(--panel-border-subtle)'}`,
              }}
            >
              <div className="games-condensed text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)] truncate">E{e.num} {e.short}</div>
              <div className="games-display text-[16px] leading-tight mt-0.5" style={{ color: isBest ? '#019644' : isWorst ? '#d9736b' : 'var(--text-primary)' }}>
                {rank != null ? ordinal(rank) : '-'}
              </div>
              {disp && <div className="text-[10px] text-[var(--text-muted)] truncate">{disp}</div>}
            </div>
          )
        })}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat label="Best event" value={best ? `${ordinal(best.rank)} - E${best.e.num}` : '-'} color="#019644" />
        <MiniStat label="Worst event" value={worst ? `${ordinal(worst.rank)} - E${worst.e.num}` : '-'} color="#d9736b" />
        <MiniStat label="Current overall" value={`${ordinal(lastRank)} - ${lastCum} pts`} color="#91C640" />
      </div>
    </section>
  )
}
