import { useState, useMemo } from 'react'
import type { CrossFitData } from '../types'
import { extractAllMovements, type ExtractedMovement } from '../utils/movement-extractor'

const CATEGORY_COLORS: Record<ExtractedMovement['category'], string> = {
  'Weightlifting': '#3b82f6',
  'Gymnastics': '#10b981',
  'Monostructural': '#f43f5e',
  'Core': '#a855f7',
  'Carry/Odd Object': '#f59e0b',
  'Olympic Lifting': '#8b5cf6',
}

const ALL_CATEGORIES: ExtractedMovement['category'][] = [
  'Weightlifting',
  'Gymnastics',
  'Monostructural',
  'Core',
  'Carry/Odd Object',
  'Olympic Lifting',
]

type SortKey = 'count' | 'name' | 'firstSeen' | 'lastSeen'

export default function MovementEncyclopedia({ data }: { data: CrossFitData }) {
  const [categoryFilter, setCategoryFilter] = useState<'All' | ExtractedMovement['category']>('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('count')

  const allMovements = useMemo(() => extractAllMovements(data.searchIndex), [data.searchIndex])

  const maxCount = useMemo(() => {
    if (allMovements.length === 0) return 1
    return allMovements[0].count
  }, [allMovements])

  const filtered = useMemo(() => {
    let results = allMovements

    if (categoryFilter !== 'All') {
      results = results.filter((m) => m.category === categoryFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      results = results.filter((m) => m.name.toLowerCase().includes(q))
    }

    if (sortBy === 'count') {
      results = [...results].sort((a, b) => b.count - a.count)
    } else if (sortBy === 'name') {
      results = [...results].sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'firstSeen') {
      results = [...results].sort((a, b) => a.firstSeen.localeCompare(b.firstSeen))
    } else if (sortBy === 'lastSeen') {
      results = [...results].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    }

    return results
  }, [allMovements, categoryFilter, search, sortBy])

  const mostCommon = allMovements.length > 0 ? allMovements[0] : null
  const rarest = allMovements.length > 0 ? allMovements[allMovements.length - 1] : null
  const newest = useMemo(() => {
    if (allMovements.length === 0) return null
    return [...allMovements].sort((a, b) => b.firstSeen.localeCompare(a.firstSeen))[0]
  }, [allMovements])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of allMovements) {
      counts[m.category] = (counts[m.category] || 0) + 1
    }
    return counts
  }, [allMovements])

  function formatDate(d: string) {
    if (!d || d === '9999-12-31' || d === '0000-01-01') return '--'
    const parts = d.split('-')
    if (parts.length !== 3) return d
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[parseInt(parts[1], 10) - 1] || parts[1]
    return `${month} ${parseInt(parts[2], 10)}, ${parts[0]}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          Movement Encyclopedia — Every Exercise in 25 Years
        </h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-2 max-w-3xl leading-relaxed">
          We scanned every workout description from 2001 to 2026 and found {allMovements.length} distinct
          exercises. The original data tracked 30 — this is the complete list.
          {mostCommon && rarest && (
            <> From {mostCommon.name} (appearing in {mostCommon.count.toLocaleString()} WODs) to {rarest.name} (appearing just {rarest.count === 1 ? 'once' : `${rarest.count} times`}).</>
          )}
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
          <div className="text-2xl font-bold font-mono text-blue-400">{allMovements.length}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">Total Movements Found</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
          <div className="text-2xl font-bold font-mono text-emerald-400">{mostCommon?.name || '--'}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            Most Common ({mostCommon?.count.toLocaleString() || 0} WODs)
          </div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
          <div className="text-2xl font-bold font-mono text-rose-400">{rarest?.name || '--'}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            Rarest ({rarest?.count || 0} {rarest?.count === 1 ? 'WOD' : 'WODs'})
          </div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
          <div className="text-2xl font-bold font-mono text-purple-400">{newest?.name || '--'}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            Newest Addition ({newest ? formatDate(newest.firstSeen) : '--'})
          </div>
        </div>
      </div>

      {/* Filter / Search / Sort controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category filter */}
        <div className="flex gap-1 bg-[var(--panel-bg)] rounded-lg p-1 border border-[var(--panel-border)] flex-wrap">
          <button
            onClick={() => setCategoryFilter('All')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              categoryFilter === 'All'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            All ({allMovements.length})
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'text-white'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
              style={
                categoryFilter === cat
                  ? { background: `${CATEGORY_COLORS[cat]}33`, color: CATEGORY_COLORS[cat] }
                  : undefined
              }
            >
              {cat} ({categoryCounts[cat] || 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search movements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-4 py-2 text-sm text-white placeholder-[var(--text-muted)] focus:border-blue-500/50 focus:outline-none"
        />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] focus:outline-none"
        >
          <option value="count">Most Frequent</option>
          <option value="name">Alphabetical</option>
          <option value="firstSeen">First Seen (Oldest)</option>
          <option value="lastSeen">Last Seen (Recent)</option>
        </select>
      </div>

      <div className="text-xs text-[var(--text-muted)]">{filtered.length} movements</div>

      {/* Movement cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((movement) => {
          const color = CATEGORY_COLORS[movement.category]
          const barWidth = Math.max(2, (movement.count / maxCount) * 100)

          return (
            <div
              key={movement.name}
              className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)] hover:border-[var(--panel-border-strong)] transition-colors group"
            >
              {/* Top row: name + count */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-3">
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                    {movement.name}
                  </h3>
                  <span
                    className="inline-block mt-1 text-[9px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: `${color}20`,
                      color: color,
                    }}
                  >
                    {movement.category}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-bold font-mono" style={{ color }}>
                    {movement.count.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)]">WODs</div>
                </div>
              </div>

              {/* Frequency bar */}
              <div className="w-full h-1.5 bg-[var(--panel-bg-hover)] rounded-full mt-3 mb-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}88)`,
                  }}
                />
              </div>

              {/* Date range */}
              <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                <div>
                  <span className="text-[var(--text-muted)]">First: </span>
                  {formatDate(movement.firstSeen)}
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Last: </span>
                  {formatDate(movement.lastSeen)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          No movements match your filters.
        </div>
      )}
    </div>
  )
}
