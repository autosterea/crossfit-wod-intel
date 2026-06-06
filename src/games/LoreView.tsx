import { useMemo } from 'react'
import { G } from './gamesData'
import { useGamesStore } from './gamesStore'
import { Chip, SectionHeading } from './ui'

// Banner ink is fixed (banners stay dark green in both themes) — deliberate
// exception to the theme-variable rule, mirroring the hero treatment.
const BANNER_INK = '#f4f6f2'

/* ---------- 1. The Record Book ---------- */

function RecordBook() {
  if (G.records.length === 0) return null
  return (
    <section className="mb-14">
      <SectionHeading kicker="Superlatives" title="The Record Book" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {G.records.map((r, i) => (
          <div
            key={`${r.label}-${i}`}
            className="games-event-card games-banner-drop p-4 sm:p-5"
            style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
          >
            <div className="text-2xl sm:text-3xl leading-none" aria-hidden>
              {r.icon}
            </div>
            <div className="games-display text-3xl sm:text-4xl text-[var(--text-primary)] mt-3">
              {r.stat}
            </div>
            <div className="games-condensed uppercase tracking-[0.14em] text-[11px] font-semibold text-[#91C640] mt-1.5">
              {r.label}
            </div>
            <div className="text-[11.5px] leading-relaxed text-[var(--text-muted)] mt-1">
              {r.detail}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- 2. The Champions Wall ---------- */

function ChampionsWall() {
  const navigate = useGamesStore((s) => s.navigate)

  const titleCounts = useMemo(() => {
    const men = new Map<string, number>()
    const women = new Map<string, number>()
    for (const c of G.champions) {
      if (c.men) men.set(c.men, (men.get(c.men) ?? 0) + 1)
      if (c.women) women.set(c.women, (women.get(c.women) ?? 0) + 1)
    }
    return { men, women }
  }, [])

  const wall = useMemo(() => [...G.champions].sort((a, b) => b.year - a.year), [])

  if (wall.length === 0) return null

  const champLine = (name: string | null, counts: Map<string, number>) => {
    if (!name) return <span style={{ color: BANNER_INK, opacity: 0.45 }}>TBD</span>
    const titles = counts.get(name) ?? 0
    return (
      <>
        <span style={{ color: BANNER_INK }}>{name}</span>
        {titles > 1 && <span className="text-[#91C640]"> ★{titles}</span>}
      </>
    )
  }

  return (
    <section className="mb-14">
      <SectionHeading kicker="Every title, every year" title="The Champions Wall" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {wall.map((c, i) => (
          <button
            key={c.year}
            onClick={() => navigate({ view: 'year', year: c.year })}
            className="games-banner games-banner-drop p-4 pb-8 text-left cursor-pointer group transition-[filter] duration-200 hover:brightness-125"
            style={{ animationDelay: `${Math.min(i * 35, 500)}ms` }}
            aria-label={`Open the ${c.year} Games`}
          >
            <div
              className="games-display text-3xl sm:text-4xl group-hover:text-[#91C640] transition-colors"
              style={{ color: BANNER_INK }}
            >
              {c.year}
            </div>
            <div className="mt-3 space-y-2.5">
              <div>
                <div className="games-condensed uppercase tracking-[0.16em] text-[9.5px] font-semibold text-[#91C640]">
                  🏆 Men
                </div>
                <div className="games-condensed text-[13px] font-semibold leading-tight mt-0.5">
                  {champLine(c.men, titleCounts.men)}
                </div>
              </div>
              <div>
                <div className="games-condensed uppercase tracking-[0.16em] text-[9.5px] font-semibold text-[#91C640]">
                  👑 Women
                </div>
                <div className="games-condensed text-[13px] font-semibold leading-tight mt-0.5">
                  {champLine(c.women, titleCounts.women)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

/* ---------- 3. Dynasties ---------- */

interface Dynasty {
  athlete: string
  division: 'Men' | 'Women'
  start: number
  end: number
  length: number
}

function computeDynasties(): Dynasty[] {
  const sorted = [...G.champions].sort((a, b) => a.year - b.year)
  const out: Dynasty[] = []
  const divisions: { key: 'men' | 'women'; label: Dynasty['division'] }[] = [
    { key: 'men', label: 'Men' },
    { key: 'women', label: 'Women' },
  ]
  for (const { key, label } of divisions) {
    let runner: string | null = null
    let start = 0
    let prevYear = 0
    const flush = () => {
      if (runner && prevYear - start + 1 >= 2) {
        out.push({
          athlete: runner,
          division: label,
          start,
          end: prevYear,
          length: prevYear - start + 1,
        })
      }
    }
    for (const c of sorted) {
      const name = c[key]
      if (name && name === runner && c.year === prevYear + 1) {
        prevYear = c.year
      } else {
        flush()
        runner = name
        start = c.year
        prevYear = c.year
      }
    }
    flush()
  }
  return out.sort((a, b) => b.length - a.length || a.start - b.start).slice(0, 6)
}

function Dynasties() {
  const dynasties = useMemo(() => computeDynasties(), [])
  if (dynasties.length === 0) return null
  const maxLen = dynasties[0].length

  return (
    <section className="mb-14">
      <SectionHeading kicker="Consecutive-title runs" title="Dynasties" />
      <div className="space-y-3">
        {dynasties.map((d, i) => (
          <div
            key={`${d.division}-${d.athlete}-${d.start}`}
            className="games-event-card games-banner-drop p-4 sm:p-5"
            style={{ animationDelay: `${Math.min(i * 60, 400)}ms` }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <span className="games-display text-lg sm:text-xl text-[var(--text-primary)]">
                  {d.athlete}
                </span>
                <Chip color={d.division === 'Men' ? '#019644' : '#91C640'} outline>
                  {d.division}
                </Chip>
                <Chip color="#94a3b8">
                  {d.start}-{d.end}
                </Chip>
              </div>
              <div className="shrink-0">
                <span className="games-display text-2xl text-[#91C640]">{d.length}</span>
                <span className="games-condensed uppercase tracking-[0.12em] text-[10px] font-semibold text-[var(--text-muted)] ml-1.5">
                  straight
                </span>
              </div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(d.length / maxLen) * 100}%`,
                  background: 'linear-gradient(90deg, #019644, #91C640)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- 4. Benchmarks at the Games ---------- */

function Benchmarks() {
  const navigate = useGamesStore((s) => s.navigate)
  const wods = useMemo(
    () =>
      [...G.namedWods].sort(
        (a, b) => b.eventIds.length - a.eventIds.length || a.name.localeCompare(b.name)
      ),
    []
  )
  if (wods.length === 0) return null

  return (
    <section className="mb-14">
      <SectionHeading kicker="From the whiteboard" title="Benchmarks at the Games" />
      <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] max-w-2xl -mt-2 mb-5">
        Classic benchmarks like Fran, Amanda, and Murph that crossed over from affiliate
        whiteboards onto the competition floor, tested against the fittest on Earth.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {wods.map((w, i) => {
          const n = w.eventIds.length
          return (
            <div
              key={w.name}
              className="games-event-card games-banner-drop p-4 sm:p-5"
              style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="games-display text-xl sm:text-2xl text-[var(--text-primary)]">
                  {w.name}
                </h3>
                <span className="games-condensed uppercase tracking-[0.12em] text-[11px] font-semibold text-[#91C640] whitespace-nowrap">
                  {n} {n === 1 ? 'appearance' : 'appearances'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                {w.years.map((yr) => (
                  <button
                    key={yr}
                    onClick={() => navigate({ view: 'year', year: yr })}
                    className="cursor-pointer"
                    aria-label={`Open the ${yr} Games`}
                  >
                    <Chip color="#91C640" outline>
                      {yr}
                    </Chip>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- Page ---------- */

export default function LoreView() {
  return (
    <div className="pt-10">
      <header className="mb-12">
        <div className="games-condensed uppercase tracking-[0.25em] text-[12px] font-semibold text-[#91C640]">
          The Almanac
        </div>
        <h1 className="games-display text-4xl sm:text-6xl text-[var(--text-primary)] mt-2">
          Records <span className="text-[#91C640]">&amp; Lore</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          The superlatives, the champions, and the dynasties. Every banner hung since the
          original Ranch weekend, plus the whiteboard benchmarks that made it to the big
          stage.
        </p>
      </header>

      <RecordBook />
      <ChampionsWall />
      <Dynasties />
      <Benchmarks />
    </div>
  )
}
