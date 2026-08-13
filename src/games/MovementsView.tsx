import { memo, useCallback, useMemo, useState } from 'react'
import { G, eventById, FIRST_YEAR, LAST_YEAR } from './gamesData'
import { useGamesStore } from './gamesStore'
import { Chip, SectionHeading } from './ui'
import type { GamesEvent, GamesMovementStat } from '../types-games'

type SortMode = 'most-used' | 'first-appeared' | 'alphabetical'

const YEARS: number[] = []
for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) YEARS.push(y)

const EXCLUSIVE_COLOR = '#f59e0b'
const MAX_EVENT_ROWS = 12

/** Tiny per-year frequency strip - one bar per Games year, height scaled by usage (4 levels max). */
function FrequencyStrip({ yearCounts }: { yearCounts: Record<string, number> }) {
  return (
    <div className="flex items-end gap-[2px] h-4" aria-hidden>
      {YEARS.map((year) => {
        const count = yearCounts[String(year)] ?? 0
        const level = Math.min(count, 4)
        return (
          <div
            key={year}
            title={`${year}: ${count} event${count === 1 ? '' : 's'}`}
            className="flex-1 min-w-[2px] rounded-[1px]"
            style={{
              height: level === 0 ? 3 : 4 + level * 3,
              background: level === 0 ? 'var(--panel-border)' : '#91C640',
            }}
          />
        )
      })}
    </div>
  )
}

/** Expanded card body - every event this movement appeared in, capped at MAX_EVENT_ROWS. */
function EventList({ stat }: { stat: GamesMovementStat }) {
  const navigate = useGamesStore((s) => s.navigate)
  const events = useMemo(
    () =>
      stat.eventIds
        .map((id) => eventById.get(id))
        .filter((e): e is GamesEvent => e !== undefined),
    [stat]
  )
  const visible = events.slice(0, MAX_EVENT_ROWS)
  const hidden = events.length - visible.length

  return (
    <div className="px-2 pt-1.5 pb-2">
      {visible.map((ev) => (
        <button
          key={ev.id}
          onClick={() => navigate({ view: 'year', year: ev.year })}
          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-[var(--panel-bg-hover)] transition-colors flex items-baseline gap-2 text-[12.5px] group"
        >
          <span className="font-mono text-[12px] text-[#91C640] shrink-0">{ev.year}</span>
          <span className="text-[var(--text-muted)] shrink-0">·</span>
          <span className="games-condensed uppercase tracking-[0.08em] text-[11px] font-semibold text-[var(--text-muted)] shrink-0">
            Event {String(ev.order).padStart(2, '0')}
          </span>
          <span className="text-[var(--text-primary)] truncate group-hover:text-[#91C640] transition-colors">
            - {ev.name}
          </span>
        </button>
      ))}
      {hidden > 0 && (
        <div className="px-2 pt-1 text-[11.5px] text-[var(--text-muted)]">+{hidden} more</div>
      )}
    </div>
  )
}

const MovementCard = memo(function MovementCard({
  stat,
  open,
  onToggle,
  index,
}: {
  stat: GamesMovementStat
  open: boolean
  onToggle: (id: string) => void
  index: number
}) {
  const exclusive = stat.wodId === null
  const yearRange =
    stat.firstYear === stat.lastYear ? `${stat.firstYear} only` : `${stat.firstYear}-${stat.lastYear}`

  return (
    <div
      className="games-event-card games-banner-drop self-start"
      style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
    >
      <button onClick={() => onToggle(stat.id)} aria-expanded={open} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="games-display text-lg text-[var(--text-primary)] leading-tight min-w-0">
            {stat.display}
          </h3>
          {exclusive ? (
            <Chip color={EXCLUSIVE_COLOR}>Games-exclusive</Chip>
          ) : (
            <span className="text-[10.5px] text-[var(--text-muted)] shrink-0 mt-1">
              also in daily WODs
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="games-display text-2xl text-[var(--text-primary)]">{stat.total}</span>
          <span className="games-condensed uppercase tracking-[0.12em] text-[11px] font-semibold text-[var(--text-muted)]">
            event{stat.total === 1 ? '' : 's'}
          </span>
          <span className="ml-auto font-mono text-[11.5px] text-[var(--text-tertiary)]">
            {yearRange}
          </span>
        </div>

        <div className="mt-3">
          <FrequencyStrip yearCounts={stat.yearCounts} />
          <div className="mt-1 flex justify-between font-mono text-[9.5px] text-[var(--text-muted)]">
            <span>{FIRST_YEAR}</span>
            <span>{LAST_YEAR}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--panel-border-subtle)]">
          <EventList stat={stat} />
        </div>
      )}
    </div>
  )
})

export default function MovementsView() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('most-used')
  const [exclusiveOnly, setExclusiveOnly] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = useCallback((id: string) => setOpenId((cur) => (cur === id ? null : id)), [])

  const totalMovements = G.movements.length
  const exclusiveCount = useMemo(
    () => G.movements.filter((m) => m.wodId === null).length,
    []
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = G.movements.filter((m) => {
      if (exclusiveOnly && m.wodId !== null) return false
      if (q && !m.display.toLowerCase().includes(q)) return false
      return true
    })
    if (sort === 'first-appeared') list.sort((a, b) => a.firstYear - b.firstYear || b.total - a.total)
    else if (sort === 'alphabetical') list.sort((a, b) => a.display.localeCompare(b.display))
    // 'most-used': G.movements is already sorted by total desc
    return list
  }, [query, sort, exclusiveOnly])

  if (totalMovements === 0) {
    return (
      <div className="pt-10 text-center py-24">
        <div className="games-display text-3xl text-[var(--text-primary)] mb-3">Dataset building</div>
        <p className="text-sm text-[var(--text-secondary)]">
          The movement index is being compiled. Check back shortly.
        </p>
      </div>
    )
  }

  return (
    <div className="pt-10">
      <SectionHeading
        kicker="Every implement, every skill"
        title="Movement Index"
        right={
          <div className="games-condensed uppercase tracking-[0.12em] text-[12px] font-semibold text-[var(--text-muted)] whitespace-nowrap">
            {shown.length} / {totalMovements}
          </div>
        }
      />

      <p className="-mt-2 mb-6 text-[13.5px] leading-relaxed text-[var(--text-secondary)] max-w-3xl">
        <span className="text-[var(--text-primary)] font-semibold">{totalMovements}</span> distinct
        movements have appeared at the Games ·{' '}
        <span style={{ color: EXCLUSIVE_COLOR }} className="font-semibold">
          {exclusiveCount}
        </span>{' '}
        of them never programmed in daily crossfit.com WODs.
      </p>

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movements"
          aria-label="Search movements"
          className="w-full sm:w-64 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#91C640]/60"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          aria-label="Sort movements"
          className="w-full sm:w-auto bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#91C640]/60"
        >
          <option value="most-used">Most used</option>
          <option value="first-appeared">First appeared</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
        <button
          onClick={() => setExclusiveOnly((v) => !v)}
          aria-pressed={exclusiveOnly}
          className="games-condensed uppercase tracking-[0.08em] text-[12px] font-semibold rounded-lg px-3 py-2 transition-colors self-start sm:self-auto"
          style={
            exclusiveOnly
              ? {
                  background: `${EXCLUSIVE_COLOR}1c`,
                  color: EXCLUSIVE_COLOR,
                  border: `1px solid ${EXCLUSIVE_COLOR}55`,
                }
              : {
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--panel-border)',
                }
          }
        >
          Games-exclusive only
        </button>
      </div>

      {/* Grid */}
      {shown.length === 0 ? (
        <div className="text-center py-16">
          <div className="games-display text-2xl text-[var(--text-primary)] mb-2">No matches</div>
          <p className="text-sm text-[var(--text-muted)]">
            No movements match the current search and filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {shown.map((stat, i) => (
            <MovementCard
              key={stat.id}
              stat={stat}
              index={i}
              open={openId === stat.id}
              onToggle={toggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
