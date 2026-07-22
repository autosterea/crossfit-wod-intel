import { useEffect, useState } from 'react'
import { countryFlag } from './athletes2026'

type Ath = { name: string; slug: string | null; country: string | null; cum: number[]; rank: number[] }
type DivData = { events: { num: number; short: string }[]; athletes: Ath[] }
type Data = { updated: string; men: DivData; women: DivData }

// Compact live summary for the hero: events done + current top 3 per division.
// Self-hides pre-Games (no data).
export default function LiveHeroStrip() {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    fetch('/live-leaderboard-2026.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no data'))))
      .then((d: Data) => setData(d))
      .catch(() => {})
  }, [])
  if (!data) return null
  const nM = data.men.events.length
  const nW = data.women.events.length
  if (nM === 0 && nW === 0) return null

  const Col = ({ label, dd, n }: { label: string; dd: DivData; n: number }) => (
    <div className="flex-1 min-w-0">
      <div className="games-condensed text-[10px] uppercase tracking-[0.14em] text-[#91C640] mb-1.5">
        {label} · {n} {n === 1 ? 'event' : 'events'} done
      </div>
      {dd.athletes.slice(0, 3).map((a, i) => (
        <div key={a.name} className="flex items-center gap-2 text-[12.5px] leading-tight mb-1">
          <span className="games-display w-4 text-center shrink-0" style={{ color: i === 0 ? '#F4C64A' : i === 1 ? '#C9D2DA' : '#CD8B5B' }}>{i + 1}</span>
          <span className="text-[var(--text-primary)] truncate">{countryFlag(a.country)} {a.name}</span>
          <span className="games-display text-[var(--text-secondary)] ml-auto shrink-0">{a.cum[a.cum.length - 1]}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="mt-5 rounded-xl p-3.5 max-w-xl" style={{ background: 'rgba(1,150,68,0.1)', border: '1px solid rgba(1,150,68,0.3)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="games-condensed text-[10px] uppercase tracking-[0.16em] text-[#91C640]">🔴 Live · leaders right now</div>
        <a href="#leaderboard" className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[#91C640]">Full board ↓</a>
      </div>
      <div className="flex gap-5">
        {nM > 0 && <Col label="Men" dd={data.men} n={nM} />}
        {nW > 0 && <Col label="Women" dd={data.women} n={nW} />}
      </div>
    </div>
  )
}
