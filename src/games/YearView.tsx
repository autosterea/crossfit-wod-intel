import { useMemo } from 'react'
import {
  G,
  envIcon,
  eraById,
  modalityWeights,
  movementName,
  yearByNum,
  MODALITY_COLORS,
} from './gamesData'
import { useGamesStore } from './gamesStore'
import { Chip, FormatChip, LoadChip, ModalityChip, TimeDomainChip } from './ui'
import type { GamesEvent, GamesYear } from '../types-games'

function EventCard({ ev, index }: { ev: GamesEvent; index: number }) {
  const hasLoads = ev.loads.length > 0 && ev.loads.some((l) => l.men || l.women)
  return (
    <article
      className="games-event-card games-banner-drop p-4 sm:p-6"
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
    >
      <div className="flex gap-4 sm:gap-6">
        <div className="games-event-order text-5xl sm:text-6xl shrink-0 w-12 sm:w-16 text-right pt-0.5">
          {String(ev.order).padStart(2, '0')}
        </div>

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="games-display text-xl sm:text-2xl text-[var(--text-primary)]">
                {ev.name}
              </h3>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-[11.5px] text-[var(--text-muted)]">
                {ev.aka && <span>a.k.a. “{ev.aka}”</span>}
                {ev.day && <span>{ev.day}</span>}
                <span>
                  {envIcon(ev.environment)} {ev.environment.replace(/-/g, ' ')}
                </span>
                {ev.stage === 'online' && <Chip color="#60a5fa">Online stage</Chip>}
                {ev.namedWod && <Chip color="#f59e0b">★ {ev.namedWod}</Chip>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <FormatChip format={ev.format} />
              {ev.timeDomain && <TimeDomainChip td={ev.timeDomain} />}
              <LoadChip load={ev.loadLevel} />
              <ModalityChip modality={ev.modality} />
            </div>
          </div>

          {/* Workout sheet */}
          <div className="games-workout-sheet mt-4 px-4 py-3 text-[var(--text-primary)]">
            {ev.description}
          </div>

          {/* Loads table */}
          {hasLoads && (
            <div className="mt-3 overflow-x-auto">
              <table className="text-[12px] w-full max-w-md">
                <thead>
                  <tr className="games-condensed uppercase tracking-[0.1em] text-[11px] text-[var(--text-muted)]">
                    <th className="text-left py-1 pr-4 font-semibold"> </th>
                    <th className="text-left py-1 pr-4 font-semibold">Men</th>
                    <th className="text-left py-1 font-semibold">Women</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.loads.map((l, i) => (
                    <tr key={i} className="border-t border-[var(--panel-border-subtle)]">
                      <td className="py-1.5 pr-4 text-[var(--text-secondary)]">{l.item}</td>
                      <td className="py-1.5 pr-4 font-medium text-[var(--text-primary)]">{l.men ?? '—'}</td>
                      <td className="py-1.5 font-medium text-[var(--text-primary)]">{l.women ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Movements + caps */}
          <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
            {ev.movements.map((m) => (
              <span
                key={m}
                className="text-[11.5px] px-2 py-0.5 rounded-md bg-[var(--panel-bg-2)] border border-[var(--panel-border-subtle)] text-[var(--text-secondary)]"
              >
                {movementName(m)}
              </span>
            ))}
            {ev.timeCapMin != null && (
              <span className="text-[11.5px] px-2 py-0.5 rounded-md text-[var(--text-muted)]">
                ⏱ {ev.timeCapMin} min cap
              </span>
            )}
          </div>

          {/* Debuts */}
          {ev.firstAtGames.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {ev.firstAtGames.map((d) => (
                <Chip key={d} color="#91C640" outline>
                  🆕 Games debut: {d}
                </Chip>
              ))}
            </div>
          )}

          {/* Winners */}
          {(ev.winnerMen || ev.winnerWomen) && (
            <div className="mt-3.5 pt-3 border-t border-[var(--panel-border-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12.5px]">
              <div>
                <span className="games-condensed uppercase tracking-[0.1em] text-[10.5px] text-[var(--text-muted)] font-semibold">
                  Men&nbsp;
                </span>
                <span className="text-[var(--text-primary)] font-medium">{ev.winnerMen ?? '—'}</span>
                {ev.winningScoreMen && (
                  <span className="text-[#91C640] font-mono text-[12px]"> · {ev.winningScoreMen}</span>
                )}
              </div>
              <div>
                <span className="games-condensed uppercase tracking-[0.1em] text-[10.5px] text-[var(--text-muted)] font-semibold">
                  Women&nbsp;
                </span>
                <span className="text-[var(--text-primary)] font-medium">{ev.winnerWomen ?? '—'}</span>
                {ev.winningScoreWomen && (
                  <span className="text-[#91C640] font-mono text-[12px]"> · {ev.winningScoreWomen}</span>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {ev.notes && (
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-tertiary)] italic">
              {ev.notes}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function YearHeader({ y }: { y: GamesYear }) {
  const era = eraById(y.eraId)
  const agg = G.perYear.find((p) => p.year === y.year)
  const weights = agg ? modalityWeights(agg.modality) : { M: 0, G: 0, W: 0 }
  const totalW = weights.M + weights.G + weights.W || 1

  return (
    <header className="relative pt-10 pb-8">
      <div
        aria-hidden
        className="games-year-ghost absolute -top-3 right-0 text-[110px] sm:text-[170px] leading-none pointer-events-none select-none"
      >
        {y.year}
      </div>
      <div className="relative">
        {era && (
          <div className="games-condensed uppercase tracking-[0.25em] text-[12px] font-semibold text-[#91C640]">
            {era.name} · {era.range[0]}–{era.range[1]}
          </div>
        )}
        <h1 className="games-display text-5xl sm:text-7xl text-[var(--text-primary)] mt-2">
          {y.year} <span className="text-[#91C640]">Games</span>
        </h1>
        <div className="mt-3 text-[14px] text-[var(--text-secondary)]">
          {y.venue}
          {y.city ? ` — ${y.city}${y.region ? `, ${y.region}` : ''}${y.country && y.country !== 'USA' ? `, ${y.country}` : ''}` : ''}
          {y.dates ? ` · ${y.dates}` : ''}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="games-condensed uppercase tracking-[0.14em] text-[11px] text-[var(--text-muted)] font-semibold">
              Champion — Men
            </div>
            <div className="games-display text-xl text-[var(--text-primary)] mt-0.5">
              🏆 {y.championMen ?? 'Unknown'}
            </div>
          </div>
          <div>
            <div className="games-condensed uppercase tracking-[0.14em] text-[11px] text-[var(--text-muted)] font-semibold">
              Champion — Women
            </div>
            <div className="games-display text-xl text-[var(--text-primary)] mt-0.5">
              👑 {y.championWomen ?? 'Unknown'}
            </div>
          </div>
          {agg && (
            <div>
              <div className="games-condensed uppercase tracking-[0.14em] text-[11px] text-[var(--text-muted)] font-semibold">
                Events
              </div>
              <div className="games-display text-xl text-[var(--text-primary)] mt-0.5">
                {agg.eventCount + agg.onlineEventCount}
                {agg.newMovements > 0 && (
                  <span className="text-[#91C640] text-sm"> · {agg.newMovements} debuts</span>
                )}
              </div>
            </div>
          )}
          {(y.fieldMen || y.fieldWomen) && (
            <div>
              <div className="games-condensed uppercase tracking-[0.14em] text-[11px] text-[var(--text-muted)] font-semibold">
                Field
              </div>
              <div className="games-display text-xl text-[var(--text-primary)] mt-0.5">
                {y.fieldMen ?? '?'}M / {y.fieldWomen ?? '?'}W
              </div>
            </div>
          )}
        </div>

        {/* Modality blend bar */}
        <div className="mt-5 max-w-md">
          <div className="flex h-2 rounded-full overflow-hidden">
            {(['M', 'G', 'W'] as const).map((m) => (
              <div
                key={m}
                style={{ width: `${(weights[m] / totalW) * 100}%`, background: MODALITY_COLORS[m] }}
                title={`${m}: ${Math.round((weights[m] / totalW) * 100)}%`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex gap-4 text-[10.5px] games-condensed uppercase tracking-[0.1em] text-[var(--text-muted)]">
            <span><span style={{ color: MODALITY_COLORS.M }}>■</span> Mono {Math.round((weights.M / totalW) * 100)}%</span>
            <span><span style={{ color: MODALITY_COLORS.G }}>■</span> Gym {Math.round((weights.G / totalW) * 100)}%</span>
            <span><span style={{ color: MODALITY_COLORS.W }}>■</span> Weight {Math.round((weights.W / totalW) * 100)}%</span>
          </div>
        </div>

        {y.yearSummary && (
          <p className="mt-5 max-w-3xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            {y.yearSummary}
          </p>
        )}
        {y.formatNotes && (
          <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-[var(--text-tertiary)]">
            <span className="games-condensed uppercase tracking-[0.1em] text-[10.5px] font-semibold text-[var(--text-muted)]">Format · </span>
            {y.formatNotes}
          </p>
        )}
      </div>
    </header>
  )
}

export default function YearView() {
  const route = useGamesStore((s) => s.route)
  const navigate = useGamesStore((s) => s.navigate)
  const y = route.year ? yearByNum.get(route.year) : undefined

  const { online, finals } = useMemo(() => {
    const evs = y?.events ?? []
    return {
      online: evs.filter((e) => e.stage === 'online'),
      finals: evs.filter((e) => e.stage !== 'online'),
    }
  }, [y])

  if (!y) {
    return (
      <div className="text-center py-24">
        <div className="games-display text-3xl text-[var(--text-primary)] mb-2">No such year</div>
        <button onClick={() => navigate({ view: 'home', year: null })} className="text-[#91C640] text-sm">
          ← Back to the timeline
        </button>
      </div>
    )
  }

  const idx = G.years.findIndex((yy) => yy.year === y.year)
  const prev = idx > 0 ? G.years[idx - 1] : null
  const next = idx < G.years.length - 1 ? G.years[idx + 1] : null

  return (
    <div>
      <YearHeader y={y} />

      {online.length > 0 && (
        <section className="mb-10">
          <div className="games-condensed uppercase tracking-[0.2em] text-[13px] font-semibold text-[#60a5fa] mb-4">
            Stage 1 — Online ({online.length} events)
          </div>
          <div className="space-y-4">
            {online.map((ev, i) => (
              <EventCard key={ev.id} ev={ev} index={i} />
            ))}
          </div>
          <div className="games-condensed uppercase tracking-[0.2em] text-[13px] font-semibold text-[#91C640] mt-10 mb-4">
            Finals ({finals.length} events)
          </div>
        </section>
      )}

      <div className="space-y-4">
        {finals.map((ev, i) => (
          <EventCard key={ev.id} ev={ev} index={i} />
        ))}
      </div>

      {/* Prev / next */}
      <nav className="mt-12 flex items-stretch justify-between gap-3">
        {prev ? (
          <button
            onClick={() => navigate({ view: 'year', year: prev.year })}
            className="games-event-card flex-1 p-4 text-left group"
          >
            <div className="games-condensed uppercase tracking-[0.12em] text-[10.5px] text-[var(--text-muted)] font-semibold">← Previous</div>
            <div className="games-display text-2xl text-[var(--text-primary)] group-hover:text-[#91C640] transition-colors">{prev.year}</div>
          </button>
        ) : <div className="flex-1" />}
        {next ? (
          <button
            onClick={() => navigate({ view: 'year', year: next.year })}
            className="games-event-card flex-1 p-4 text-right group"
          >
            <div className="games-condensed uppercase tracking-[0.12em] text-[10.5px] text-[var(--text-muted)] font-semibold">Next →</div>
            <div className="games-display text-2xl text-[var(--text-primary)] group-hover:text-[#91C640] transition-colors">{next.year}</div>
          </button>
        ) : <div className="flex-1" />}
      </nav>
    </div>
  )
}
