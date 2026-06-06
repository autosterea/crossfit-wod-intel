import { G, LAST_YEAR, FIRST_YEAR } from './gamesData'
import { useGamesStore } from './gamesStore'

/** Dark broadcast-floodlight hero — stays dark in both themes by design. */
export default function GamesHero() {
  const navigate = useGamesStore((s) => s.navigate)
  const stats = [
    { stat: String(G.meta.totalEvents), label: 'Events' },
    { stat: String(G.meta.years.length), label: 'Games' },
    { stat: String(G.movements.length), label: 'Movements' },
    { stat: String(G.eras.length), label: 'Eras' },
  ]
  return (
    <section className="games-hero games-grain">
      <div className="max-w-6xl mx-auto px-4 pt-14 pb-12 sm:pt-20 sm:pb-16 relative">
        {/* ghost numerals backdrop */}
        <div
          aria-hidden
          className="games-year-ghost absolute -top-2 right-0 text-[120px] sm:text-[190px] leading-none opacity-60 pointer-events-none hidden sm:block"
          style={{ WebkitTextStroke: '1.5px rgba(244,246,242,0.13)' }}
        >
          {FIRST_YEAR}
          <br />
          {LAST_YEAR}
        </div>

        <div className="relative">
          <div className="games-rise games-rise-1 games-condensed uppercase tracking-[0.3em] text-[13px] font-semibold text-[#91C640] mb-4">
            Persistence Athletics presents
          </div>
          <h1
            className="games-rise games-rise-2 games-display text-[15vw] sm:text-[88px] md:text-[104px]"
            style={{ color: 'var(--games-hero-ink)' }}
          >
            The Games
            <br />
            <span className="text-[#91C640]">Almanac</span>
          </h1>
          <p
            className="games-rise games-rise-3 mt-5 max-w-xl text-[15px] leading-relaxed"
            style={{ color: 'rgba(244,246,242,0.72)' }}
          >
            Every individual event in CrossFit Games history — {FIRST_YEAR} to {LAST_YEAR}.
            From a dirt hillside in Aromas to stadium floodlights: researched, verified,
            categorized, and analyzed, year by year.
          </p>

          <div className="games-rise games-rise-4 mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate({ view: 'year', year: LAST_YEAR })}
              className="games-condensed uppercase tracking-[0.12em] font-semibold text-[14px] px-5 py-2.5 rounded-lg bg-[#019644] text-white hover:bg-[#01a94d] transition-colors"
            >
              Latest Games →
            </button>
            <button
              onClick={() => navigate({ view: 'evolution', year: null })}
              className="games-condensed uppercase tracking-[0.12em] font-semibold text-[14px] px-5 py-2.5 rounded-lg border text-[#91C640] hover:bg-[#91C640]/10 transition-colors"
              style={{ borderColor: 'rgba(145,198,64,0.4)' }}
            >
              How programming evolved
            </button>
          </div>

          <div className="games-rise games-rise-5 mt-10 flex flex-wrap gap-x-10 gap-y-4">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="games-display text-3xl sm:text-4xl" style={{ color: 'var(--games-hero-ink)' }}>
                  {s.stat}
                </div>
                <div className="games-condensed uppercase tracking-[0.16em] text-[11px] text-[#91C640] mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
