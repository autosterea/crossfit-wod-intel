import { useEffect, useState } from 'react'
import AthleteAvatar from './AthleteAvatar'
import { athleteBySlug, countryFlag } from './athletes2026'
import { useGamesStore } from './gamesStore'

type Ath = { name: string; slug: string | null; country: string | null; cum: number[]; rank: number[]; ev: { rank: number | null; disp: string; pts: number }[] }
type DivData = { events: { num: number; short: string }[]; athletes: Ath[] }
type Data = { updated: string; men: DivData; women: DivData }

const ROW = 60

// Live, interactive Games leaderboard for the 2026 hub: all 30 athletes, a slider
// across the completed events, and rows that animate up/down so you can watch the
// field move. Reads /live-leaderboard-2026.json (regenerated after each event).
// Renders nothing until at least one event is scored, so it self-hides pre-Games.
export default function LiveLeaderboard() {
  const navigate = useGamesStore((s) => s.navigate)
  const [data, setData] = useState<Data | null>(null)
  const [division, setDivision] = useState<'men' | 'women'>('men')
  const [step, setStep] = useState(0)

  useEffect(() => {
    fetch('/live-leaderboard-2026.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no data'))))
      .then((d: Data) => setData(d))
      .catch(() => {})
  }, [])

  const dd = data ? data[division] : null
  const nEvents = dd?.events.length ?? 0
  useEffect(() => {
    if (nEvents) setStep(nEvents - 1)
  }, [nEvents, division])

  if (!data || !dd || nEvents === 0) return null
  // clamp the step to this division's event count (women may have more events scored
  // than men, so switching divisions can leave `step` out of range for a render tick)
  const s = Math.max(0, Math.min(step, nEvents - 1))
  const ev = dd.events[s]

  return (
    <section id="leaderboard" className="mb-10 games-rise games-rise-2 games-anchor">
      <div className="flex items-end justify-between mb-1 flex-wrap gap-2">
        <div>
          <div className="games-condensed text-[11px] uppercase tracking-[0.2em] text-[#91C640] mb-1">Live · updated {data.updated}</div>
          <h2 className="games-display text-2xl sm:text-3xl text-[var(--text-primary)]">Live Leaderboard</h2>
        </div>
        <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
          {(['men', 'women'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDivision(d)}
              className="games-condensed px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: division === d ? '#019644' : 'transparent', color: division === d ? '#fff' : 'var(--text-secondary)' }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-[var(--text-muted)] mb-3">Slide through the events to watch the field climb and fall. Standings after each event, all {dd.athletes.length} athletes. Tap a name for the full profile.</p>

      {/* Event slider */}
      <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="games-condensed px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)] disabled:opacity-40">&larr;</button>
          <div className="flex-1">
            <input type="range" min={0} max={nEvents - 1} value={s} onChange={(e) => setStep(+e.target.value)} className="w-full accent-[#019644]" style={{ accentColor: '#019644' }} />
            <div className="flex justify-between mt-1">
              {dd.events.map((e, i) => (
                <button key={e.num} onClick={() => setStep(i)} className="games-condensed text-[10px] uppercase tracking-[0.06em]" style={{ color: i === s ? '#91C640' : 'var(--text-muted)', fontWeight: i === s ? 700 : 400 }}>
                  E{e.num}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setStep((s) => Math.min(nEvents - 1, s + 1))} disabled={step === nEvents - 1} className="games-condensed px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)] disabled:opacity-40">&rarr;</button>
        </div>
        <div className="text-center mt-2 games-condensed text-[13px] uppercase tracking-[0.1em] text-[var(--text-primary)]">
          After Event {ev.num} · <span className="text-[#91C640]">{ev.short}</span>
        </div>
      </div>

      {/* Animated ranked list */}
      <div style={{ position: 'relative', height: dd.athletes.length * ROW }}>
        {dd.athletes.map((a) => {
          const rk = a.rank[s]
          const prev = s > 0 ? a.rank[s - 1] : null
          const mv = prev != null ? prev - rk : null
          const top3 = rk <= 3
          const full = a.slug ? athleteBySlug.get(a.slug) : undefined
          const evScore = a.ev[s]
          return (
            <div
              key={a.slug || a.name}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ROW - 6, transform: `translateY(${(rk - 1) * ROW}px)`, transition: 'transform 0.65s cubic-bezier(0.22,1,0.36,1)' }}
            >
              <button
                onClick={() => a.slug && navigate({ view: 'athlete', year: 2026, slug: a.slug })}
                className="w-full h-full flex items-center gap-2 sm:gap-3 pl-2 pr-3 rounded-lg text-left"
                style={{ background: top3 ? 'rgba(145,198,64,0.08)' : 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}
              >
                <div className="games-display text-lg sm:text-xl w-6 sm:w-8 text-center shrink-0" style={{ color: top3 ? '#91C640' : 'var(--text-muted)' }}>{rk}</div>
                <div className="w-8 text-center text-[11px] sm:text-[12px] games-condensed shrink-0" style={{ color: mv && mv > 0 ? '#5cbb3a' : mv && mv < 0 ? '#d9736b' : 'var(--text-muted)' }}>
                  {mv == null ? '' : mv > 0 ? `▲${mv}` : mv < 0 ? `▼${-mv}` : '-'}
                </div>
                {full ? (
                  <AthleteAvatar athlete={full} size={36} rounded="rounded-full" />
                ) : (
                  <div className="w-9 h-9 rounded-full shrink-0" style={{ background: 'var(--panel-bg-2)' }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="games-display text-[14px] sm:text-[16px] text-[var(--text-primary)] truncate leading-tight">{a.name}</div>
                  <div className="text-[10px] sm:text-[11px] text-[var(--text-muted)] truncate">
                    {countryFlag(a.country)} {a.country}
                    {evScore && evScore.rank ? ` · E${ev.num}: ${evScore.disp || evScore.rank + 'th'}` : ''}
                  </div>
                </div>
                <div className="games-display text-[15px] sm:text-[18px] text-[var(--text-primary)] shrink-0">
                  {a.cum[s]}
                  <span className="text-[10px] text-[var(--text-muted)]"> pts</span>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
