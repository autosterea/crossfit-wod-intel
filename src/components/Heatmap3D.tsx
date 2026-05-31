import { useMemo, useState, useCallback, lazy, Suspense } from 'react'
import type { CrossFitData } from '../types'

const Heatmap3DScene = lazy(() => import('./Heatmap3DScene'))

// ── Color gradient for heatmap ──
function getHeatColor(value: number, max: number): string {
  if (value === 0) return '#0d0d1a'
  const t = value / max
  // Multi-stop gradient: dark navy → blue → cyan → green → yellow → orange → red
  if (t < 0.05) return '#1a2744'
  if (t < 0.1) return '#1e3a6e'
  if (t < 0.2) return '#2563eb'
  if (t < 0.35) return '#0891b2'
  if (t < 0.5) return '#10b981'
  if (t < 0.65) return '#84cc16'
  if (t < 0.8) return '#eab308'
  if (t < 0.9) return '#f97316'
  return '#ef4444'
}

function getTextColor(value: number, max: number): string {
  const t = value / max
  if (t < 0.05) return '#475569'
  if (t < 0.35) return '#e2e8f0'
  if (t < 0.7) return '#0f172a'
  return '#0f172a'
}

type SortMode = 'original' | 'frequency' | 'modality' | 'alpha'

export default function Heatmap3D({ data }: { data: CrossFitData }) {
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number } | null>(null)
  const [selectedMov, setSelectedMov] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('frequency')
  const [showValues, setShowValues] = useState(false)
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [mobileMode] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  const { movements, matrix } = data.cooccurMatrix

  // Sort order
  const sortedIndices = useMemo(() => {
    const indices = movements.map((_, i) => i)
    if (sortMode === 'frequency') {
      indices.sort((a, b) => matrix[b][b] - matrix[a][a])
    } else if (sortMode === 'alpha') {
      indices.sort((a, b) => (data.movementDisplay[movements[a]] || movements[a]).localeCompare(data.movementDisplay[movements[b]] || movements[b]))
    } else if (sortMode === 'modality') {
      const modOrder: Record<string, number> = { M: 0, G: 1, W: 2 }
      indices.sort((a, b) => {
        const ma = modOrder[data.movementModality[movements[a]]] ?? 3
        const mb = modOrder[data.movementModality[movements[b]]] ?? 3
        if (ma !== mb) return ma - mb
        return matrix[b][b] - matrix[a][a]
      })
    }
    return indices
  }, [movements, matrix, sortMode, data])

  // On mobile, show only top 15 movements by frequency to fit the screen
  const displayIndices = useMemo(() => {
    if (!mobileMode) return sortedIndices
    const byFreq = [...sortedIndices].sort((a, b) => matrix[b][b] - matrix[a][a])
    const top15Set = new Set(byFreq.slice(0, 15))
    return sortedIndices.filter((i) => top15Set.has(i))
  }, [sortedIndices, mobileMode, matrix])

  const cellSize = mobileMode ? 22 : 27
  const labelWidth = mobileMode ? 90 : 130

  const maxVal = useMemo(() => Math.max(...matrix.flat()), [matrix])
  const n = movements.length

  const getName = useCallback((idx: number) => data.movementDisplay[movements[idx]] || movements[idx], [data, movements])
  const getMod = useCallback((idx: number) => data.movementModality[movements[idx]] || '?', [data, movements])

  const modColor = (mod: string) => mod === 'M' ? '#f43f5e' : mod === 'G' ? '#10b981' : mod === 'W' ? '#3b82f6' : '#6b7280'

  const isHighlighted = useCallback((i: number, j: number) => {
    if (selectedMov !== null) return i === selectedMov || j === selectedMov
    if (hoveredCell) return i === hoveredCell.i || j === hoveredCell.j
    return false
  }, [selectedMov, hoveredCell])

  const isDimmed = useCallback((i: number, j: number) => {
    if (selectedMov !== null) return i !== selectedMov && j !== selectedMov
    if (hoveredCell) return i !== hoveredCell.i && j !== hoveredCell.j
    return false
  }, [selectedMov, hoveredCell])

  if (view === '3d') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Movement Co-occurrence</h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">3D terrain view</p>
          </div>
          <button onClick={() => setView('2d')} className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 hover:bg-blue-500/30">
            Switch to 2D Grid
          </button>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /></div>}>
          <Heatmap3DScene data={data} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Movement Co-occurrence Heatmap</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            How often do movements appear together? Brighter = more co-occurrences. Click any movement to isolate its relationships.
          </p>
        </div>
        <button onClick={() => setView('3d')} className="px-3 py-1.5 text-xs bg-[var(--panel-bg-hover)] text-[var(--text-tertiary)] rounded-lg border border-[var(--panel-border-strong)] hover:text-[var(--text-primary)] shrink-0">
          3D View
        </button>
      </div>

      {/* Explainer */}
      <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10">
        <div className="text-xs font-medium text-blue-400 mb-1">How to read this</div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          Each cell shows how many workouts contain BOTH movements. The diagonal (top-left to bottom-right) shows how often each movement appears total.
          Hover over any cell to highlight its row and column. Click a movement name to lock the highlight. Bright colors = frequent pairing.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-[var(--code-bg)] rounded-lg p-1 border border-[var(--panel-border)]">
          {([['frequency', 'By Frequency'], ['modality', 'By Modality'], ['alpha', 'A-Z'], ['original', 'Original']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortMode(key)}
              className={`px-2.5 py-1 text-[10px] rounded transition-colors ${sortMode === key ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)] cursor-pointer">
          <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} className="rounded border-[var(--panel-border-strong)] bg-[var(--panel-bg-hover)]" />
          Show values
        </label>
        {selectedMov !== null && (
          <button onClick={() => setSelectedMov(null)} className="px-2.5 py-1 text-[10px] bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30">
            Clear selection: {getName(displayIndices[selectedMov])}
          </button>
        )}
      </div>

      {/* Heatmap grid */}
      <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--panel-border)] p-2 overflow-x-auto">
        <div style={{ minWidth: displayIndices.length * (cellSize + 1) + labelWidth }}>
          {/* Top labels (rotated) */}
          <div className="flex" style={{ marginLeft: labelWidth }}>
            {displayIndices.map((si, j) => (
              <div
                key={si}
                className="flex items-end justify-start cursor-pointer"
                style={{ width: cellSize + 1, height: 90 }}
                onClick={() => setSelectedMov(selectedMov === j ? null : j)}
              >
                <div
                  className="text-[9px] origin-bottom-left whitespace-nowrap transition-colors"
                  style={{
                    transform: 'rotate(-55deg)',
                    color: selectedMov === j ? '#60a5fa' : (hoveredCell?.j === j ? '#e2e8f0' : '#64748b'),
                    fontWeight: selectedMov === j ? 600 : 400,
                  }}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: modColor(getMod(si)), verticalAlign: 'middle' }} />
                  {getName(si)}
                </div>
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {displayIndices.map((si, i) => (
            <div key={si} className="flex items-center" style={{ height: cellSize + 1 }}>
              {/* Left label */}
              <div
                className="shrink-0 text-right pr-2 cursor-pointer transition-colors truncate"
                style={{
                  width: labelWidth,
                  fontSize: mobileMode ? 9 : 10,
                  color: selectedMov === i ? '#60a5fa' : (hoveredCell?.i === i ? '#e2e8f0' : '#94a3b8'),
                  fontWeight: selectedMov === i ? 600 : 400,
                }}
                onClick={() => setSelectedMov(selectedMov === i ? null : i)}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: modColor(getMod(si)), verticalAlign: 'middle' }} />
                {getName(si)}
              </div>

              {/* Cells */}
              {displayIndices.map((sj, j) => {
                const val = matrix[si][sj]
                const isDiag = si === sj
                const highlighted = isHighlighted(i, j)
                const dimmed = isDimmed(i, j)
                const cellColor = getHeatColor(val, maxVal)

                return (
                  <div
                    key={sj}
                    className="shrink-0 relative group"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      margin: 0.5,
                      background: cellColor,
                      borderRadius: 3,
                      opacity: dimmed ? 0.25 : 1,
                      outline: highlighted && val > 0 ? '1.5px solid rgba(255,255,255,0.5)' : isDiag ? '1px solid rgba(255,255,255,0.1)' : 'none',
                      transition: 'opacity 0.15s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredCell({ i, j })}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => setSelectedMov(selectedMov === i ? null : i)}
                  >
                    {/* Value text */}
                    {showValues && val > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center font-mono" style={{ fontSize: 7, color: getTextColor(val, maxVal) }}>
                        {val > 999 ? (val / 1000).toFixed(1) + 'k' : val}
                      </span>
                    )}

                    {/* Tooltip */}
                    {hoveredCell?.i === i && hoveredCell?.j === j && (
                      <div className="absolute z-50 pointer-events-none" style={{ bottom: '110%', left: '50%', transform: 'translateX(-50%)' }}>
                        <div className="bg-[var(--chart-tooltip-bg)] border border-[var(--chart-tooltip-border)] rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                          <div className="font-medium text-[var(--text-primary)]">
                            {isDiag ? getName(si) : `${getName(si)} × ${getName(sj)}`}
                          </div>
                          <div className="text-blue-400 font-mono mt-0.5">
                            {val.toLocaleString()} {isDiag ? 'total appearances' : 'co-occurrences'}
                          </div>
                          {!isDiag && val > 0 && (
                            <div className="text-[var(--text-muted)] mt-0.5">
                              {((val / Math.min(matrix[si][si], matrix[sj][sj])) * 100).toFixed(1)}% of the less common movement
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Row total */}
              <div className="shrink-0 text-right pl-2" style={{ width: 45 }}>
                <span className="text-[9px] font-mono text-[var(--text-muted)]">{matrix[si][si].toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[var(--text-muted)]">Low</span>
          <div className="flex h-3 rounded overflow-hidden" style={{ width: 200 }}>
            {['#0d0d1a', '#1a2744', '#1e3a6e', '#2563eb', '#0891b2', '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444'].map((c) => (
              <div key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">High</span>
        </div>
        <div className="flex gap-3">
          {[['M', 'Mono'], ['G', 'Gym'], ['W', 'Weight']].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full" style={{ background: modColor(k) }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* Selected movement detail */}
      {selectedMov !== null && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-blue-500/20">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">
            {getName(displayIndices[selectedMov])} — Top Co-occurrences
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {displayIndices
              .map((sj, j) => ({ name: getName(sj), val: matrix[displayIndices[selectedMov]][sj], mod: getMod(sj), j }))
              .filter((x) => x.val > 0 && x.j !== selectedMov)
              .sort((a, b) => b.val - a.val)
              .slice(0, 12)
              .map((x) => (
                <div key={x.name} className="bg-[var(--code-bg)] rounded-lg p-3 border border-[var(--panel-border)]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: modColor(x.mod) }} />
                    <span className="text-xs text-[var(--text-secondary)]">{x.name}</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-blue-400">{x.val}</div>
                  <div className="text-[9px] text-[var(--text-muted)]">co-occurrences</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
