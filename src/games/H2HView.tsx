import { useEffect, useMemo, useState } from 'react'
import { useGamesStore } from './gamesStore'
import h2hData from '../data/games/h2h-data.json'

// ---------------------------------------------------------------------------
// The Head-to-Head Machine - /games/h2h
// Pick any two athletes 2007-2026 and get the verified career ledger side by
// side: titles, event wins, podiums, best/average finish, and - when they
// shared a competition floor - the year-by-year record and the per-event beat
// count. Data: h2h-data.json built by scripts/build-h2h-data.mjs from the
// almanac results files, the 2026 live board, raw event winners and the
// verified champions record. Name variants are canonicalized at build time.
// Coverage note: 2007-2025 results cover each year's TOP 10 per division;
// 2026 covers the full field of 30. Careers outside the top 10 of a given
// year are not in the ledger and the page says so.
// URL: /games/h2h?a=<slug>&b=<slug> for shareable matchups.
// ---------------------------------------------------------------------------

interface YearRec { rank: number; points: number | null; events: Record<string, number> }
interface Athlete { name: string; division: 'men' | 'women'; years: Record<string, YearRec>; eventWins: string[]; titles?: number[] }
const DATA = (h2hData as { athletes: Record<string, Athlete> }).athletes

function summarize(a: Athlete) {
  const years = Object.entries(a.years)
  const ranks = years.map(([, y]) => y.rank).filter((r) => r != null)
  const podiums = ranks.filter((r) => r <= 3).length
  const best = ranks.length ? Math.min(...ranks) : null
  const avg = ranks.length ? ranks.reduce((s, r) => s + r, 0) / ranks.length : null
  return {
    titles: a.titles?.length ?? 0,
    titleYears: a.titles ?? [],
    wins: a.eventWins.length,
    apps: years.length,
    firstYear: years.length ? Math.min(...years.map(([y]) => +y)) : null,
    lastYear: years.length ? Math.max(...years.map(([y]) => +y)) : null,
    podiums, best, avg,
  }
}

export default function H2HView() {
  const navigate = useGamesStore((s) => s.navigate)
  const params = new URLSearchParams(window.location.search)
  const [slugA, setSlugA] = useState(params.get('a') && DATA[params.get('a')!] ? params.get('a')! : 'mat-fraser')
  const [slugB, setSlugB] = useState(params.get('b') && DATA[params.get('b')!] ? params.get('b')! : 'tia-clair-toomey')

  useEffect(() => {
    const url = `/games/h2h?a=${slugA}&b=${slugB}`
    window.history.replaceState(null, '', url)
  }, [slugA, slugB])

  const options = useMemo(() => {
    const list = Object.entries(DATA).map(([slug, a]) => ({ slug, a, s: summarize(a) }))
    list.sort((x, y) => (y.s.titles - x.s.titles) || (y.s.wins - x.s.wins) || x.a.name.localeCompare(y.a.name))
    return list
  }, [])

  const A = DATA[slugA], B = DATA[slugB]
  const sA = useMemo(() => summarize(A), [A])
  const sB = useMemo(() => summarize(B), [B])

  const shared = useMemo(() => {
    if (A.division !== B.division) return null
    const years = Object.keys(A.years).filter((y) => B.years[y]).map(Number).sort()
    if (!years.length) return { years: [], recA: 0, recB: 0, evA: 0, evB: 0 }
    let recA = 0, recB = 0, evA = 0, evB = 0
    const rows = years.map((y) => {
      const ra = A.years[y].rank, rb = B.years[y].rank
      if (ra < rb) recA++; else if (rb < ra) recB++
      // per-event beats within the shared year
      const ea = A.years[y].events, eb = B.years[y].events
      for (const id of Object.keys(ea)) if (eb[id] != null) { if (ea[id] < eb[id]) evA++; else if (eb[id] < ea[id]) evB++ }
      return { y, ra, rb }
    })
    return { years: rows, recA, recB, evA, evB }
  }, [A, B])

  const led = (x: number | null, y: number | null, lowerBetter = false) => {
    if (x == null || y == null || x === y) return [false, false]
    return lowerBetter ? [x < y, y < x] : [x > y, y > x]
  }

  const rows: { label: string; a: string; b: string; hl: [boolean, boolean] }[] = [
    { label: 'Games titles', a: sA.titles ? `${sA.titles} (${sA.titleYears.join(', ')})` : '0', b: sB.titles ? `${sB.titles} (${sB.titleYears.join(', ')})` : '0', hl: led(sA.titles, sB.titles) as [boolean, boolean] },
    { label: 'Career event wins', a: String(sA.wins), b: String(sB.wins), hl: led(sA.wins, sB.wins) as [boolean, boolean] },
    { label: 'Games in the ledger', a: `${sA.apps} (${sA.firstYear}-${sA.lastYear})`, b: `${sB.apps} (${sB.firstYear}-${sB.lastYear})`, hl: [false, false] },
    { label: 'Podium finishes', a: String(sA.podiums), b: String(sB.podiums), hl: led(sA.podiums, sB.podiums) as [boolean, boolean] },
    { label: 'Best finish', a: sA.best === 1 ? '1st' : sA.best ? `${sA.best}` : '-', b: sB.best === 1 ? '1st' : sB.best ? `${sB.best}` : '-', hl: led(sA.best, sB.best, true) as [boolean, boolean] },
    { label: 'Average finish', a: sA.avg ? sA.avg.toFixed(2) : '-', b: sB.avg ? sB.avg.toFixed(2) : '-', hl: led(sA.avg, sB.avg, true) as [boolean, boolean] },
  ]

  const Sel = ({ value, onChange, exclude }: { value: string; onChange: (s: string) => void; exclude: string }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--panel-bg-2,#10150f)] border border-[var(--panel-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
      {options.filter((o) => o.slug !== exclude).map((o) => (
        <option key={o.slug} value={o.slug}>
          {o.a.name} ({o.a.division === 'men' ? 'M' : 'W'}{o.s.titles ? `, ${o.s.titles}x champ` : o.s.wins ? `, ${o.s.wins} event wins` : ''})
        </option>
      ))}
    </select>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="games-condensed text-[11px] uppercase tracking-[0.2em] text-[#91C640] mb-1">The Almanac's Toy Box</div>
        <h1 className="games-display text-3xl sm:text-5xl text-[var(--text-primary)] uppercase leading-[0.95]">Head-to-Head Machine</h1>
        <p className="mt-3 text-[13.5px] sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
          Any two athletes, 2007 to 2026, on one verified ledger: titles, event wins, podiums, average finish - and if
          they ever shared a floor, the year-by-year record plus who won more head-to-head events. Screenshot your
          matchup and tag us with your verdict.
        </p>
      </div>

      {/* pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Sel value={slugA} onChange={setSlugA} exclude={slugB} />
        <Sel value={slugB} onChange={setSlugB} exclude={slugA} />
      </div>

      {/* versus card */}
      <div className="cap-card overflow-hidden mb-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-8 pt-6 pb-4">
          <div className="text-right min-w-0">
            <div className="games-display text-2xl sm:text-4xl text-[var(--text-primary)] uppercase leading-[0.95] break-words">{A.name}</div>
            <div className="games-condensed text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mt-1">
              {A.division} &middot; {sA.firstYear}-{sA.lastYear}{sA.titles > 0 && <span className="text-[#91C640]"> &middot; {sA.titles}x champion</span>}
            </div>
          </div>
          <div className="games-display text-xl sm:text-2xl text-[#019644] px-2 sm:px-4">VS</div>
          <div className="text-left min-w-0">
            <div className="games-display text-2xl sm:text-4xl text-[var(--text-primary)] uppercase leading-[0.95] break-words">{B.name}</div>
            <div className="games-condensed text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mt-1">
              {B.division} &middot; {sB.firstYear}-{sB.lastYear}{sB.titles > 0 && <span className="text-[#91C640]"> &middot; {sB.titles}x champion</span>}
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--panel-border)]">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 py-2.5 border-b border-[var(--panel-border)] last:border-b-0">
              <div className={`text-right font-mono text-[13.5px] sm:text-[15px] ${r.hl[0] ? 'text-[#91C640] font-bold' : 'text-[var(--text-secondary)]'}`}>{r.a}</div>
              <div className="games-condensed text-[10px] sm:text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-muted)] px-3 sm:px-6 text-center whitespace-nowrap">{r.label}</div>
              <div className={`text-left font-mono text-[13.5px] sm:text-[15px] ${r.hl[1] ? 'text-[#91C640] font-bold' : 'text-[var(--text-secondary)]'}`}>{r.b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* shared floor */}
      {shared === null ? (
        <div className="cap-card p-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          <span className="text-[#91C640] font-semibold uppercase games-condensed tracking-[0.12em] text-[11px]">Different divisions &middot; </span>
          These two never raced each other, which is exactly why the ledger matters. Careers side by side, numbers only.
        </div>
      ) : shared.years.length === 0 ? (
        <div className="cap-card p-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          <span className="text-[#91C640] font-semibold uppercase games-condensed tracking-[0.12em] text-[11px]">Never shared a floor &middot; </span>
          No overlapping Games in the ledger - eras that never met. That is the debate.
        </div>
      ) : (
        <div className="cap-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--panel-border)] flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="games-condensed text-[12px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Shared floor: {shared.years.length} Games together</h2>
            <div className="text-[12.5px] font-mono text-[var(--text-secondary)]">
              overall <span className="text-[#91C640] font-bold">{shared.recA}-{shared.recB}</span> &middot; event beats <span className="text-[#91C640] font-bold">{shared.evA}-{shared.evB}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left games-condensed uppercase tracking-[0.1em] text-[10.5px] text-[var(--text-muted)]">
                  <th className="px-4 py-2">Year</th>
                  <th className="px-4 py-2">{A.name.split(' ').pop()}</th>
                  <th className="px-4 py-2">{B.name.split(' ').pop()}</th>
                  <th className="px-4 py-2">Higher finish</th>
                </tr>
              </thead>
              <tbody>
                {shared.years.map(({ y, ra, rb }) => (
                  <tr key={y} className="border-t border-[var(--panel-border)]">
                    <td className="px-4 py-2 font-mono text-[var(--text-secondary)]">{y}</td>
                    <td className={`px-4 py-2 font-mono ${ra < rb ? 'text-[#91C640] font-bold' : 'text-[var(--text-secondary)]'}`}>{ra === 1 ? '1st' : ra}</td>
                    <td className={`px-4 py-2 font-mono ${rb < ra ? 'text-[#91C640] font-bold' : 'text-[var(--text-secondary)]'}`}>{rb === 1 ? '1st' : rb}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{ra === rb ? 'tied' : ra < rb ? A.name.split(' ').pop() : B.name.split(' ').pop()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-[10.5px] text-[var(--text-muted)] leading-relaxed max-w-3xl">
        Ledger coverage: each year's top 10 per division 2007-2025 plus the full 2026 field, computed from official
        results in the PA Games Almanac. Event wins include shared wins; name changes and spelling variants are counted
        as one career. Years an athlete finished outside the top 10 are not in the ledger.
      </p>
      <button onClick={() => navigate({ view: 'hub', year: 2026 })}
        className="mt-3 text-[12px] text-[#91C640] hover:underline">&larr; Back to the 2026 hub</button>
    </div>
  )
}
