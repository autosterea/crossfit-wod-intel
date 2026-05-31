import { useMemo, useState } from 'react'
import type { CrossFitData } from '../types'

const MODALITY_COLORS: Record<string, string> = {
  M: '#f43f5e',
  G: '#10b981',
  W: '#3b82f6',
}

const MODALITY_LABELS: Record<string, string> = {
  M: 'Monostructural',
  G: 'Gymnastics',
  W: 'Weightlifting',
}

const START_YEAR = 2001
const END_YEAR = 2026
const TOTAL_YEARS = END_YEAR - START_YEAR + 1

interface TooltipData {
  name: string
  modality: string
  firstSeen: string
  lastSeen: string
  totalCount: number
  peakYear: string
  x: number
  y: number
}

export default function MovementTimeline({ data }: { data: CrossFitData }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [filterModality, setFilterModality] = useState<string | null>(null)
  const [highlightMode, setHighlightMode] = useState<'all' | 'og' | 'newcomer'>('all')

  const movements = useMemo(() => {
    const maxCount = Math.max(...data.movementEncyclopedia.map((m) => m.total_count), 1)

    return data.movementEncyclopedia
      .map((m) => {
        const modality = data.movementModality[m.id] || m.modality || 'M'
        const firstYear = parseInt(m.first_seen.substring(0, 4))
        const lastYear = parseInt(m.last_seen.substring(0, 4))
        const yearPct = m.year_pct || {}
        const peakYear = Object.entries(yearPct).reduce(
          (best, [yr, pct]) => (pct > best.pct ? { year: yr, pct } : best),
          { year: m.first_seen.substring(0, 4), pct: 0 },
        ).year

        return {
          id: m.id,
          name: data.movementDisplay?.[m.id] || m.name,
          modality,
          firstSeen: m.first_seen,
          lastSeen: m.last_seen,
          firstYear,
          lastYear,
          totalCount: m.total_count,
          intensity: Math.max(0.25, m.total_count / maxCount),
          peakYear,
          isOG: firstYear <= 2001,
          isNewcomer: firstYear > 2010,
        }
      })
      .sort((a, b) => {
        // Sort by first_seen date, then by name
        const dateCmp = a.firstSeen.localeCompare(b.firstSeen)
        if (dateCmp !== 0) return dateCmp
        return a.name.localeCompare(b.name)
      })
  }, [data])

  const filteredMovements = useMemo(() => {
    let result = movements
    if (filterModality) {
      result = result.filter((m) => m.modality === filterModality)
    }
    if (highlightMode === 'og') {
      result = result.filter((m) => m.isOG)
    } else if (highlightMode === 'newcomer') {
      result = result.filter((m) => m.isNewcomer)
    }
    return result
  }, [movements, filterModality, highlightMode])

  const ogCount = movements.filter((m) => m.isOG).length
  const newcomerCount = movements.filter((m) => m.isNewcomer).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Movement Timeline</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-3xl">
          This timeline shows when each movement entered CrossFit's programming.
          The OGs have been here since 2001. Newer additions like Ski Erg and
          Handstand Walk arrived later. The bar length shows how long each movement
          has been part of the program.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Movements</div>
          <div className="text-2xl font-bold font-mono text-white">{movements.length}</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">OG Movements (2001)</div>
          <div className="text-2xl font-bold font-mono text-amber-400">{ogCount}</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Newcomers (post-2010)</div>
          <div className="text-2xl font-bold font-mono text-cyan-400">{newcomerCount}</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Years Spanned</div>
          <div className="text-2xl font-bold font-mono text-white">{TOTAL_YEARS}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Modality:</span>
          <button
            onClick={() => setFilterModality(null)}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              filterModality === null
                ? 'bg-white/10 text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            All
          </button>
          {Object.entries(MODALITY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterModality(filterModality === key ? null : key)}
              className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
                filterModality === key
                  ? 'bg-white/10 text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: MODALITY_COLORS[key] }}
              />
              {label}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-[var(--panel-border)]" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Show:</span>
          {(['all', 'og', 'newcomer'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setHighlightMode(mode)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                highlightMode === mode
                  ? 'bg-white/10 text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {mode === 'all' ? 'All' : mode === 'og' ? 'OGs (2001)' : 'Newcomers (post-2010)'}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-[var(--text-muted)]">
          Showing {filteredMovements.length} of {movements.length} movements
        </div>
      </div>

      {/* Timeline chart */}
      <div className="bg-[var(--panel-bg)] rounded-xl border border-[var(--panel-border)] overflow-hidden relative">
        {/* Year axis header */}
        <div className="sticky top-0 z-10 bg-[var(--panel-bg)] border-b border-[var(--panel-border)]">
          <div className="flex">
            <div className="w-44 min-w-[176px] shrink-0 px-3 py-2">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Movement</span>
            </div>
            <div className="flex-1 flex">
              {Array.from({ length: TOTAL_YEARS }, (_, i) => START_YEAR + i).map((year) => (
                <div
                  key={year}
                  className="flex-1 text-center py-2 border-l border-[var(--panel-border)]/50"
                  style={{ minWidth: 0 }}
                >
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">
                    {year % 5 === 0 || year === START_YEAR ? year : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 400px)' }}
        >
          {filteredMovements.map((m) => {
            const startOffset = m.firstYear - START_YEAR
            const span = m.lastYear - m.firstYear + 1
            const leftPct = (startOffset / TOTAL_YEARS) * 100
            const widthPct = (span / TOTAL_YEARS) * 100
            const color = MODALITY_COLORS[m.modality] || '#6b7280'

            return (
              <div
                key={m.id}
                className="flex items-center group hover:bg-white/[0.02] transition-colors"
                style={{ height: 28 }}
              >
                {/* Label */}
                <div className="w-44 min-w-[176px] shrink-0 px-3 flex items-center gap-1.5 overflow-hidden">
                  {m.isOG && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: '#eab308' }}
                      title="OG Movement (since 2001)"
                    />
                  )}
                  {m.isNewcomer && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: '#06b6d4' }}
                      title="Newcomer (post-2010)"
                    />
                  )}
                  <span className="text-[10px] text-[var(--text-tertiary)] truncate group-hover:text-[var(--text-primary)] transition-colors">
                    {m.name}
                  </span>
                </div>

                {/* Bar area */}
                <div
                  className="flex-1 relative h-full"
                  onMouseEnter={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setTooltip({
                      name: m.name,
                      modality: MODALITY_LABELS[m.modality] || m.modality,
                      firstSeen: m.firstSeen,
                      lastSeen: m.lastSeen,
                      totalCount: m.totalCount,
                      peakYear: m.peakYear,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Year grid lines */}
                  {Array.from({ length: TOTAL_YEARS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-[var(--panel-border)]/30"
                      style={{ left: `${(i / TOTAL_YEARS) * 100}%` }}
                    />
                  ))}

                  {/* The bar */}
                  <div
                    className="absolute top-1 bottom-1 rounded-sm transition-all group-hover:top-0.5 group-hover:bottom-0.5"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 0.5)}%`,
                      background: color,
                      opacity: m.intensity * 0.85 + 0.15,
                      boxShadow: `0 0 8px ${color}33`,
                    }}
                  />
                </div>
              </div>
            )
          })}

          {filteredMovements.length === 0 && (
            <div className="flex items-center justify-center py-16 text-[var(--text-muted)] text-sm">
              No movements match the current filters.
            </div>
          )}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-[var(--chart-tooltip-bg)] border border-[var(--chart-tooltip-border)] rounded-lg px-3 py-2.5 shadow-xl text-left min-w-[200px]">
              <div className="text-xs font-medium text-white mb-1.5">{tooltip.name}</div>
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">Modality</span>
                  <span className="text-[var(--text-secondary)]">{tooltip.modality}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">First Seen</span>
                  <span className="text-[var(--text-secondary)]">{tooltip.firstSeen}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">Last Seen</span>
                  <span className="text-[var(--text-secondary)]">{tooltip.lastSeen}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">Total Count</span>
                  <span className="text-[var(--text-secondary)] font-mono">{tooltip.totalCount}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--text-muted)]">Peak Year</span>
                  <span className="text-[var(--text-secondary)] font-mono">{tooltip.peakYear}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 justify-center">
        <div className="flex items-center gap-4">
          {Object.entries(MODALITY_LABELS).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <span
                className="w-3 h-2 rounded-sm"
                style={{ background: MODALITY_COLORS[key] }}
              />
              {label}
            </span>
          ))}
        </div>
        <div className="w-px h-3 bg-[var(--panel-border)]" />
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#eab308' }} />
          OG (since 2001)
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#06b6d4' }} />
          Newcomer (post-2010)
        </span>
        <div className="w-px h-3 bg-[var(--panel-border)]" />
        <span className="text-[10px] text-[var(--text-muted)]">
          Bar brightness = frequency (brighter = more common)
        </span>
      </div>
    </div>
  )
}
