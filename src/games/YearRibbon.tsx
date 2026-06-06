import { useEffect, useRef } from 'react'
import { G } from './gamesData'
import { useGamesStore } from './gamesStore'

/** Sticky championship-banner strip of years — the signature navigation. */
export default function YearRibbon() {
  const route = useGamesStore((s) => s.route)
  const navigate = useGamesStore((s) => s.navigate)
  const ref = useRef<HTMLDivElement>(null)

  // Keep active year in view
  useEffect(() => {
    if (route.view !== 'year' || !route.year || !ref.current) return
    const el = ref.current.querySelector<HTMLButtonElement>(`[data-year="${route.year}"]`)
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [route])

  return (
    // Mobile TopBar = 56px main row + 41px nav row, so the ribbon pins below both on small screens
    <div className="sticky top-[97px] md:top-14 z-30 games-topbar border-b border-[var(--panel-border-subtle)]">
      <div
        ref={ref}
        className="games-ribbon max-w-6xl mx-auto flex items-stretch overflow-x-auto px-2"
      >
        {G.years.map((y) => {
          const active = route.view === 'year' && route.year === y.year
          return (
            <button
              key={y.year}
              data-year={y.year}
              data-active={active}
              onClick={() => navigate({ view: 'year', year: y.year })}
              className="games-ribbon-year shrink-0 px-3 sm:px-3.5 py-2.5 text-[14px]"
              style={{ color: active ? '#91C640' : 'var(--text-tertiary)' }}
              title={`${y.year} — ${y.venue ?? ''}`}
            >
              {String(y.year).slice(2) === '07' || y.year % 5 === 0 ? y.year : `'${String(y.year).slice(2)}`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
