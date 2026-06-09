import { useMemo, useState } from 'react'
import { A2026, countryFlag, FIELD_2026 } from './athletes2026'
import { useGamesStore } from './gamesStore'
import AthleteAvatar from './AthleteAvatar'
import type { GamesAthlete2026 } from '../types-games'

type Division = 'men' | 'women'

function daysUntil(dateStr: string): number | null {
  // dateStr like "July 24-26, 2026" -> use the 24th
  const m = dateStr.match(/([A-Za-z]+)\s+(\d+)[^,]*,\s*(\d{4})/)
  if (!m) return null
  const target = new Date(`${m[1]} ${m[2]}, ${m[3]} 00:00:00`)
  const now = new Date()
  const d = Math.ceil((target.getTime() - now.getTime()) / 86400000)
  return Number.isFinite(d) ? d : null
}

function AthleteCard({ a, index }: { a: GamesAthlete2026; index: number }) {
  const navigate = useGamesStore((s) => s.navigate)
  const semiWin = a.semifinalFinish2026 && /1st|won/i.test(a.semifinalFinish2026)
  return (
    <button
      onClick={() => navigate({ view: 'athlete', year: 2026, slug: a.slug })}
      className="cap-card games-banner-drop p-3 flex items-center gap-3 text-left w-full"
      style={{ animationDelay: `${Math.min(index * 30, 360)}ms` }}
    >
      <AthleteAvatar athlete={a} size={56} rounded="rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="games-display text-[15px] text-[var(--text-primary)] truncate leading-tight">{a.name}</span>
          {a.isFormerChampion && <span title="Former Games champion">🏆</span>}
        </div>
        <div className="text-[11px] text-[var(--text-muted)] truncate">
          {countryFlag(a.country)} {a.country}
          {a.affiliate ? ` · ${a.affiliate}` : ''}
        </div>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {a.semifinalEvent2026 && (
            <span className="games-chip" style={{ background: semiWin ? 'rgba(1,150,68,0.18)' : 'var(--panel-bg-2)', color: semiWin ? '#019644' : 'var(--text-tertiary)' }}>
              {semiWin ? '★ won ' : ''}{a.semifinalEvent2026}
            </span>
          )}
          {a.isRookie && <span className="games-chip" style={{ background: 'rgba(96,165,250,0.16)', color: '#60a5fa' }}>Rookie</span>}
          {a.interviewUrl && <span title="Interview available">🎙️</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Best</div>
        <div className="games-display text-[15px] text-[#91C640] leading-none">{a.bestGamesFinish ? a.bestGamesFinish.replace(/\s*\(.*\)/, '') : a.isRookie ? 'R' : '-'}</div>
      </div>
    </button>
  )
}

export default function Hub2026() {
  const navigate = useGamesStore((s) => s.navigate)
  const [division, setDivision] = useState<Division>('men')
  const roster = division === 'men' ? A2026.men : A2026.women
  const days = useMemo(() => daysUntil(A2026.meta.gamesDates), [])

  const champions = [...A2026.men, ...A2026.women].filter((a) => a.isFormerChampion)
  const interviewCount = [...A2026.men, ...A2026.women].filter((a) => a.interviewUrl).length

  return (
    <div className="pt-6">
      {/* HERO */}
      <section className="cap-hero games-grain p-5 sm:p-8 mb-6 games-rise games-rise-1">
        <div className="relative">
          <div className="games-condensed text-[11px] uppercase tracking-[0.24em] text-[#91C640] mb-2">A Persistence Athletics tracker</div>
          <h1 className="games-display text-[13vw] sm:text-6xl cap-hero-ink leading-[0.9]">
            The 2026<br /><span className="text-[#91C640]">CrossFit Games</span>
          </h1>
          <p className="mt-3 cap-hero-dim text-[13px] leading-relaxed max-w-xl">
            Every athlete, their road from the Open to the Games, and the analytics that explain it. One place for the
            2026 season. {A2026.meta.venue}, {A2026.meta.city} · {A2026.meta.gamesDates}.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
            {[
              { v: days != null && days > 0 ? String(days) : 'LIVE', l: days != null && days > 0 ? 'days to go' : 'games week' },
              { v: `${FIELD_2026.inPerson}+${FIELD_2026.online}`, l: 'field (per division)' },
              { v: String(champions.length), l: 'former champions' },
              { v: String(interviewCount), l: 'interviews' },
            ].map((s) => (
              <div key={s.l}>
                <div className="games-display text-3xl sm:text-4xl cap-hero-ink leading-none">{s.v}</div>
                <div className="games-condensed text-[10px] uppercase tracking-[0.14em] text-[#91C640] mt-1">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => navigate({ view: 'capacity', year: 2026 })}
              className="games-condensed uppercase tracking-[0.1em] font-semibold text-[13px] px-4 py-2 rounded-lg bg-[#019644] text-white hover:bg-[#01a94d] transition-colors">
              Capacity Lab →
            </button>
            <a href="#roster" className="games-condensed uppercase tracking-[0.1em] font-semibold text-[13px] px-4 py-2 rounded-lg border text-[#91C640] hover:bg-[#91C640]/10 transition-colors" style={{ borderColor: 'rgba(145,198,64,0.4)' }}>
              The field ↓
            </a>
          </div>
        </div>
      </section>

      {/* FIELD STATUS */}
      {!A2026.meta.fieldLocked && (
        <div className="mb-6 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--text-secondary)' }}>
          <span className="games-condensed uppercase tracking-[0.1em] font-semibold text-[#f59e0b]">Field forming · </span>
          {A2026.meta.fieldNote}
        </div>
      )}

      {/* ROSTER */}
      <section id="roster" className="games-anchor mb-10">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="games-condensed text-[11px] uppercase tracking-[0.2em] text-[#91C640] mb-1">The field</div>
            <h2 className="games-display text-2xl sm:text-3xl text-[var(--text-primary)]">Qualified Athletes</h2>
          </div>
          <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
            {(['men', 'women'] as const).map((d) => (
              <button key={d} onClick={() => setDivision(d)}
                className="games-condensed px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors"
                style={{ background: division === d ? '#019644' : 'transparent', color: division === d ? '#fff' : 'var(--text-secondary)' }}>{d}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {roster.map((a, i) => <AthleteCard key={a.slug} a={a} index={i} />)}
        </div>
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">Tap an athlete for their full profile, journey, and interview. {division === 'men' ? A2026.men.length : A2026.women.length} qualified so far; 7 more join from the online Semifinal.</p>
      </section>

      {/* INTERVIEWS */}
      {interviewCount > 0 && (
        <section className="mb-10">
          <div className="games-condensed text-[11px] uppercase tracking-[0.2em] text-[#91C640] mb-1">Latest</div>
          <h2 className="games-display text-2xl sm:text-3xl text-[var(--text-primary)] mb-4">Athlete Interviews</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[...A2026.men, ...A2026.women].filter((a) => a.interviewUrl).slice(0, 12).map((a) => (
              <button key={a.slug} onClick={() => navigate({ view: 'athlete', year: 2026, slug: a.slug })}
                className="cap-card p-3 flex items-center gap-2 text-left">
                <AthleteAvatar athlete={a} size={40} rounded="rounded-lg" />
                <div className="min-w-0">
                  <div className="games-condensed text-[12px] font-semibold text-[var(--text-primary)] truncate">{a.name}</div>
                  <div className="text-[10px] text-[#91C640]">🎙️ Interview</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
