import { useState, useMemo, useCallback } from 'react'
import type { CrossFitData } from '../types'

const MODALITY_COLORS: Record<string, string> = {
  M: '#f43f5e',
  G: '#10b981',
  W: '#3b82f6',
}

const MODALITY_FULL: Record<string, string> = {
  M: 'Monostructural',
  G: 'Gymnastics',
  W: 'Weightlifting',
}

interface MovementItem {
  id: string
  name: string
  count: number
  pct: number
  modality: string
  color: string
}

interface BubblePos {
  id: string
  name: string
  count: number
  pct: number
  modality: string
  color: string
  x: number
  y: number
  r: number
}

function computeBubbleLayout(items: MovementItem[], width: number, height: number): BubblePos[] {
  if (items.length === 0) return []
  const maxCount = items[0].count
  const minR = 18
  const maxR = Math.min(width, height) * 0.12
  const placed: BubblePos[] = []
  const cx = width / 2
  const cy = height / 2

  for (const item of items) {
    const r = minR + ((item.count / maxCount) ** 0.5) * (maxR - minR)
    let bestX = cx
    let bestY = cy
    let bestDist = Infinity

    if (placed.length === 0) {
      placed.push({ ...item, x: cx, y: cy, r })
      continue
    }

    // Try spiral placement
    let found = false
    for (let angle = 0; angle < Math.PI * 20; angle += 0.15) {
      const dist = 2 + angle * 4
      const x = cx + Math.cos(angle) * dist
      const y = cy + Math.sin(angle) * dist

      if (x - r < 0 || x + r > width || y - r < 0 || y + r > height) continue

      let overlaps = false
      for (const p of placed) {
        const dx = x - p.x
        const dy = y - p.y
        const minDist = r + p.r + 3
        if (dx * dx + dy * dy < minDist * minDist) {
          overlaps = true
          break
        }
      }
      if (!overlaps) {
        const d = (x - cx) ** 2 + (y - cy) ** 2
        if (d < bestDist) {
          bestDist = d
          bestX = x
          bestY = y
          found = true
          break
        }
      }
    }

    if (!found) {
      // Fallback: place at a random-ish position
      bestX = cx + (Math.random() - 0.5) * width * 0.6
      bestY = cy + (Math.random() - 0.5) * height * 0.6
    }

    placed.push({ ...item, x: bestX, y: bestY, r })
  }

  return placed
}

export default function MovementMap({ data }: { data: CrossFitData }) {
  const [view, setView] = useState<'treemap' | 'bubble'>('treemap')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const movements = useMemo(() => {
    return Object.entries(data.overview.movement_frequency)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => {
        const modality = data.movementModality[id] || 'G'
        return {
          id,
          name: data.movementDisplay[id] || id,
          count,
          pct: +((count / data.overview.total_workouts) * 100).toFixed(1),
          modality,
          color: MODALITY_COLORS[modality] || '#6b7280',
        }
      })
  }, [data])

  const totalAppearances = useMemo(
    () => movements.reduce((s, m) => s + m.count, 0),
    [movements]
  )

  const modalityStats = useMemo(() => {
    const stats: Record<string, { count: number; appearances: number; movements: MovementItem[] }> = {
      M: { count: 0, appearances: 0, movements: [] },
      G: { count: 0, appearances: 0, movements: [] },
      W: { count: 0, appearances: 0, movements: [] },
    }
    for (const m of movements) {
      const mod = m.modality
      if (stats[mod]) {
        stats[mod].count++
        stats[mod].appearances += m.count
        stats[mod].movements.push(m)
      }
    }
    return stats
  }, [movements])

  const top5Pct = useMemo(() => {
    const top5Sum = movements.slice(0, 5).reduce((s, m) => s + m.count, 0)
    return +((top5Sum / totalAppearances) * 100).toFixed(1)
  }, [movements, totalAppearances])

  const selected = useMemo(
    () => movements.find((m) => m.id === selectedId) || null,
    [movements, selectedId]
  )

  const hovered = useMemo(
    () => movements.find((m) => m.id === hoveredId) || null,
    [movements, hoveredId]
  )

  const bubbles = useMemo(
    () => computeBubbleLayout(movements, 900, 500),
    [movements]
  )

  const handleClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Movement Map — Where the Volume Goes</h2>
        <p className="text-sm text-slate-400 mt-1">
          Each rectangle represents a movement. The bigger the rectangle, the more workouts include that movement.
          Color shows the category: <span style={{ color: '#f43f5e' }}>red = Monostructural (cardio)</span>,{' '}
          <span style={{ color: '#10b981' }}>green = Gymnastics (bodyweight)</span>,{' '}
          <span style={{ color: '#3b82f6' }}>blue = Weightlifting (barbell/KB)</span>.
          This instantly shows you where CrossFit puts its programming volume.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {(['treemap', 'bubble'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              view === v
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-[#12121a] text-slate-400 border border-[#1e1e3a] hover:border-[#2a2a5a]'
            }`}
          >
            {v === 'treemap' ? 'Treemap' : 'Bubble'}
          </button>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto">
          {Object.entries(MODALITY_FULL).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: MODALITY_COLORS[key] }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Visualization */}
      {view === 'treemap' ? (
        <TreemapView
          movements={movements}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onClick={handleClick}
        />
      ) : (
        <BubbleView
          bubbles={bubbles}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onClick={handleClick}
        />
      )}

      {/* Hover / Selection tooltip */}
      {(hovered || selected) && (
        <div className="bg-[#12121a] rounded-xl p-4 border border-[#1e1e3a]">
          <MovementDetail
            movement={(hovered || selected)!}
            totalWorkouts={data.overview.total_workouts}
          />
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
          <div className="text-3xl font-bold font-mono text-white">{movements.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total tracked movements</div>
        </div>
        <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
          <div className="text-lg font-bold font-mono text-white">
            <span style={{ color: '#f43f5e' }}>{modalityStats.M.count}</span>{' / '}
            <span style={{ color: '#10b981' }}>{modalityStats.G.count}</span>{' / '}
            <span style={{ color: '#3b82f6' }}>{modalityStats.W.count}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Movements per modality (M / G / W)</div>
        </div>
        <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
          <div className="text-3xl font-bold font-mono text-amber-400">{top5Pct}%</div>
          <div className="text-xs text-slate-400 mt-1">Top 5 movements share of programming</div>
        </div>
        <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
          <div className="text-xl font-bold font-mono" style={{ color: movements[0]?.color }}>
            {movements[0]?.name}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Most dominant at {movements[0]?.pct}% ({movements[0]?.count.toLocaleString()} WODs)
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {(['M', 'G', 'W'] as const).map((mod) => {
          const stats = modalityStats[mod]
          const pctOfAll = +((stats.appearances / totalAppearances) * 100).toFixed(1)
          const color = MODALITY_COLORS[mod]
          return (
            <div
              key={mod}
              className="rounded-xl p-5 border"
              style={{
                background: color + '08',
                borderColor: color + '25',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-sm font-bold text-white">{MODALITY_FULL[mod]}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <div className="text-xl font-bold font-mono" style={{ color }}>{stats.count}</div>
                  <div className="text-[10px] text-slate-500">Movements</div>
                </div>
                <div>
                  <div className="text-xl font-bold font-mono" style={{ color }}>{stats.appearances.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500">Appearances</div>
                </div>
                <div>
                  <div className="text-xl font-bold font-mono" style={{ color }}>{pctOfAll}%</div>
                  <div className="text-[10px] text-slate-500">Of all programming</div>
                </div>
              </div>

              <div className="space-y-1.5">
                {stats.movements.map((m) => {
                  const barW = movements[0] ? (m.count / movements[0].count) * 100 : 0
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <div className="w-24 text-[10px] text-slate-400 truncate shrink-0">{m.name}</div>
                      <div className="flex-1 h-3 bg-[#0a0a14] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barW}%`, background: color, opacity: 0.7 }}
                        />
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 w-10 text-right shrink-0">
                        {m.count.toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────── Treemap View ───────── */

function TreemapView({
  movements,
  selectedId,
  hoveredId,
  onHover,
  onClick,
}: {
  movements: MovementItem[]
  selectedId: string | null
  hoveredId: string | null
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  // Compute layout proportions based on count
  const maxPct = movements[0]?.pct || 1

  return (
    <div
      className="flex flex-wrap rounded-xl overflow-hidden border border-[#1e1e3a]"
      style={{ height: 500 }}
    >
      {movements.map((m) => {
        const isSelected = m.id === selectedId
        const isHovered = m.id === hoveredId
        const flexVal = Math.max(m.pct, 0.3)
        // Larger movements get more basis
        const basis = Math.max(
          m.pct >= maxPct * 0.5
            ? 20
            : m.pct >= maxPct * 0.25
              ? 14
              : m.pct >= maxPct * 0.1
                ? 10
                : 6,
          4
        )
        const showCount = basis >= 6

        return (
          <div
            key={m.id}
            className="relative cursor-pointer transition-all duration-150 overflow-hidden"
            style={{
              flexGrow: flexVal,
              flexShrink: 0,
              flexBasis: `${basis}%`,
              minWidth: 60,
              minHeight: 48,
              background: isSelected
                ? m.color
                : isHovered
                  ? m.color + 'cc'
                  : m.color + '90',
              borderRight: '1px solid rgba(0,0,0,0.3)',
              borderBottom: '1px solid rgba(0,0,0,0.3)',
              opacity: hoveredId && !isHovered && !isSelected ? 0.6 : 1,
              transform: isHovered ? 'scale(1.01)' : 'scale(1)',
              zIndex: isHovered ? 10 : 1,
            }}
            onMouseEnter={() => onHover(m.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(m.id)}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
              <span
                className="font-semibold text-white leading-tight"
                style={{
                  fontSize: m.pct >= maxPct * 0.5 ? 14 : m.pct >= maxPct * 0.2 ? 12 : 10,
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }}
              >
                {m.name}
              </span>
              {showCount && (
                <span
                  className="font-mono text-white/80"
                  style={{
                    fontSize: m.pct >= maxPct * 0.5 ? 12 : 9,
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }}
                >
                  {m.count.toLocaleString()}
                </span>
              )}
            </div>
            {isSelected && (
              <div className="absolute inset-0 border-2 border-white/60 rounded-sm pointer-events-none" />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ───────── Bubble View ───────── */

function BubbleView({
  bubbles,
  selectedId,
  hoveredId,
  onHover,
  onClick,
}: {
  bubbles: BubblePos[]
  selectedId: string | null
  hoveredId: string | null
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}) {
  return (
    <div className="bg-[#0a0a14] rounded-xl border border-[#1e1e3a] overflow-hidden" style={{ height: 500 }}>
      <svg width="100%" height="100%" viewBox="0 0 900 500" preserveAspectRatio="xMidYMid meet">
        {bubbles.map((b) => {
          const isSelected = b.id === selectedId
          const isHovered = b.id === hoveredId
          const showLabel = b.r > 22
          const showCount = b.r > 30

          return (
            <g
              key={b.id}
              className="cursor-pointer"
              onMouseEnter={() => onHover(b.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClick(b.id)}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={isSelected ? b.color : b.color + (isHovered ? 'cc' : '80')}
                stroke={isSelected ? '#ffffff' : isHovered ? '#ffffff80' : 'transparent'}
                strokeWidth={isSelected ? 2 : 1}
                style={{
                  transition: 'all 0.15s ease',
                  opacity: hoveredId && !isHovered && !isSelected ? 0.4 : 1,
                }}
              />
              {showLabel && (
                <text
                  x={b.x}
                  y={showCount ? b.y - 4 : b.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={b.r > 40 ? 12 : b.r > 30 ? 10 : 8}
                  fontWeight="600"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
                >
                  {b.name.length > b.r / 4 ? b.name.slice(0, Math.floor(b.r / 4)) + '..' : b.name}
                </text>
              )}
              {showCount && (
                <text
                  x={b.x}
                  y={b.y + 10}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={b.r > 40 ? 10 : 8}
                  opacity={0.7}
                  fontFamily="monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {b.count.toLocaleString()}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ───────── Movement Detail ───────── */

function MovementDetail({
  movement,
  totalWorkouts,
}: {
  movement: MovementItem
  totalWorkouts: number
}) {
  const pctOfTotal = ((movement.count / totalWorkouts) * 100).toFixed(1)
  return (
    <div className="flex items-center gap-6">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
        style={{ background: movement.color + '20', color: movement.color }}
      >
        {movement.name.charAt(0)}
      </div>
      <div>
        <div className="text-lg font-bold text-white">{movement.name}</div>
        <div className="text-xs text-slate-400">
          {MODALITY_FULL[movement.modality] || movement.modality}
        </div>
      </div>
      <div className="flex gap-8 ml-auto">
        <div className="text-right">
          <div className="text-xl font-bold font-mono" style={{ color: movement.color }}>
            {movement.count.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500">Total appearances</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold font-mono" style={{ color: movement.color }}>
            {pctOfTotal}%
          </div>
          <div className="text-[10px] text-slate-500">Of all workouts</div>
        </div>
      </div>
    </div>
  )
}
