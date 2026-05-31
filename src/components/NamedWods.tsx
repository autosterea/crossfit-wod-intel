import { useState, useMemo } from 'react'
import type { CrossFitData } from '../types'
import { getModalityColor, MODALITY_LABELS } from '../utils/colors'

export default function NamedWods({ data }: { data: CrossFitData }) {
  const [filter, setFilter] = useState<'all' | 'hero' | 'benchmark'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'count' | 'name' | 'recent'>('count')
  const [expandedWod, setExpandedWod] = useState<string | null>(null)

  // Build a lookup map from named WOD name -> workout description
  const wodDescriptions = useMemo(() => {
    const map: Record<string, string> = {}
    for (const w of data.searchIndex) {
      if (w.nw && !map[w.nw]) {
        map[w.nw] = w.s
      }
    }
    return map
  }, [data.searchIndex])

  const filtered = useMemo(() => {
    let results = data.namedWods
    if (filter === 'hero') results = results.filter((w) => w.is_hero)
    if (filter === 'benchmark') results = results.filter((w) => w.is_benchmark)
    if (search) {
      const q = search.toLowerCase()
      results = results.filter((w) => w.name.toLowerCase().includes(q))
    }
    if (sortBy === 'count') results = [...results].sort((a, b) => b.count - a.count)
    else if (sortBy === 'name') results = [...results].sort((a, b) => a.name.localeCompare(b.name))
    else results = [...results].sort((a, b) => b.last_seen.localeCompare(a.last_seen))
    return results
  }, [data.namedWods, filter, search, sortBy])

  const toggleExpand = (name: string) => {
    setExpandedWod((prev) => (prev === name ? null : name))
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Named WODs Directory</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          {data.namedWods.length} named workouts — heroes, benchmarks, and classics
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-[var(--panel-bg)] rounded-lg p-1 border border-[var(--panel-border)]">
          {(['all', 'hero', 'benchmark'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                filter === f ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {f === 'all' ? `All (${data.namedWods.length})` : f === 'hero' ? `Heroes (${data.namedWods.filter((w) => w.is_hero).length})` : `Benchmarks (${data.namedWods.filter((w) => w.is_benchmark).length})`}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-4 py-2 text-sm text-white placeholder-[var(--text-muted)] focus:border-blue-500/50 focus:outline-none"
        />

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] focus:outline-none">
          <option value="count">Most Programmed</option>
          <option value="name">Alphabetical</option>
          <option value="recent">Most Recent</option>
        </select>
      </div>

      <div className="text-xs text-[var(--text-muted)]">{filtered.length} results</div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((wod) => {
          const color = getModalityColor(wod.primary_modality)
          const isExpanded = expandedWod === wod.name
          const description = wodDescriptions[wod.name]
          return (
            <div
              key={wod.name}
              className={`bg-[var(--panel-bg)] rounded-xl border transition-all group cursor-pointer ${
                isExpanded
                  ? 'border-blue-500/40 ring-1 ring-blue-500/20'
                  : 'border-[var(--panel-border)] hover:border-[var(--panel-border-strong)]'
              }`}
              onClick={() => toggleExpand(wod.name)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{wod.name}</h3>
                      <svg
                        className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      {wod.is_hero && <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">HERO</span>}
                      {wod.is_benchmark && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">BENCHMARK</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-blue-400">{wod.count}</div>
                    <div className="text-[9px] text-[var(--text-muted)]">times</div>
                  </div>
                </div>

                <div className="flex gap-2 mb-3">
                  <span className="px-2 py-0.5 text-[10px] rounded-full" style={{ background: color + '20', color }}>
                    {wod.primary_modality}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-[var(--panel-bg-hover)] text-[var(--text-tertiary)]">{wod.primary_structure}</span>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-[var(--panel-bg-hover)] text-[var(--text-tertiary)]">{wod.primary_time_domain}</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {wod.movements.map((m) => (
                    <span key={m} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--panel-bg-2)] text-[var(--text-tertiary)] border border-[var(--panel-border)]">
                      {data.movementDisplay[m] || m}
                    </span>
                  ))}
                </div>

                <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                  <span>First: {wod.first_seen}</span>
                  <span>Last: {wod.last_seen}</span>
                </div>
              </div>

              {/* Expanded workout description */}
              {isExpanded && (
                <div className="border-t border-[var(--panel-border)] px-4 py-3">
                  {description ? (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Workout Description</span>
                      </div>
                      <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--panel-border-subtle)]">
                        <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">
                          {description.split(/\s{2,}\n|\n/).map((line, i) => {
                            const trimmed = line.trim()
                            if (!trimmed) return null
                            return (
                              <div key={i} className="py-0.5">
                                {trimmed}
                              </div>
                            )
                          })}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">No workout description available for this WOD.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
