import { G, MODALITY_COLORS, modalityWeights } from './gamesData'
import { useGamesStore } from './gamesStore'
import type { GamesYear } from '../types-games'

function MiniModalityBar({ year }: { year: GamesYear }) {
  const agg = G.perYear.find((p) => p.year === year.year)
  if (!agg) return null
  const weights = modalityWeights(agg.modality)
  const total = weights.M + weights.G + weights.W || 1
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-full" title="Modality blend (M/G/W)">
      {(['M', 'G', 'W'] as const).map((m) => (
        <div
          key={m}
          style={{ width: `${(weights[m] / total) * 100}%`, background: MODALITY_COLORS[m] }}
        />
      ))}
    </div>
  )
}

function YearCard({ y, index }: { y: GamesYear; index: number }) {
  const navigate = useGamesStore((s) => s.navigate)
  const agg = G.perYear.find((p) => p.year === y.year)
  const eventCount = (agg?.eventCount ?? y.events.length) + (agg?.onlineEventCount ?? 0)
  return (
    <button
      onClick={() => navigate({ view: 'year', year: y.year })}
      className="games-event-card games-banner-drop text-left p-4 sm:p-5 group w-full"
      style={{ animationDelay: `${Math.min(index * 60, 420)}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="games-display text-4xl sm:text-5xl text-[var(--text-primary)] group-hover:text-[#91C640] transition-colors">
          {y.year}
        </div>
        <div className="games-condensed uppercase tracking-[0.1em] text-[11px] font-semibold text-[var(--text-muted)] text-right leading-tight mt-1.5">
          {eventCount} events
          {agg?.newMovements ? (
            <>
              <br />
              <span className="text-[#91C640]">{agg.newMovements} debuts</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-2 text-[12.5px] text-[var(--text-secondary)] leading-snug">
        {y.venue}
        {y.city ? ` - ${y.city}${y.region ? `, ${y.region}` : ''}` : ''}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12px]">
        <span className="text-[#f59e0b]" title="Men's champion">🏆 {y.championMen ?? '-'}</span>
        <span className="text-[var(--text-muted)]">·</span>
        <span className="text-[#91C640]" title="Women's champion">👑 {y.championWomen ?? '-'}</span>
      </div>

      {y.yearSummary && (
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-tertiary)] line-clamp-3">
          {y.yearSummary}
        </p>
      )}

      <div className="mt-4">
        <MiniModalityBar year={y} />
      </div>
    </button>
  )
}

export default function TimelineView() {
  return (
    <div className="pt-10">
      {G.eras.map((era) => {
        const years = G.years.filter((y) => y.eraId === era.id)
        if (years.length === 0) return null
        return (
          <section key={era.id} className="mb-14">
            <div className="mb-6">
              <div className="flex items-baseline gap-4 flex-wrap">
                <h2 className="games-display text-3xl sm:text-4xl text-[var(--text-primary)]">
                  {era.name}
                </h2>
                <span className="games-condensed uppercase tracking-[0.15em] text-[13px] font-semibold text-[#91C640]">
                  {era.range[0]}-{era.range[1]}
                </span>
              </div>
              <div className="games-era-rule mt-3 mb-4 max-w-md" />
              <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] max-w-3xl">
                {era.desc}
              </p>
              <div className="mt-2 games-condensed uppercase tracking-[0.1em] text-[11px] text-[var(--text-muted)]">
                {era.eventCount} events · avg {era.avgEventsPerYear}/year ·{' '}
                {era.venues.join(' · ')}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {years.map((y, i) => (
                <YearCard key={y.year} y={y} index={i} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
