import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer,
} from 'recharts'
import type { CrossFitData } from '../types'

/* ── constants ─────────────────────────────────────────────────── */

const MODALITY_DOT_COLORS: Record<string, string> = {
  M: '#f43f5e',
  G: '#10b981',
  W: '#3b82f6',
}

const MODALITY_LABELS: Record<string, string> = {
  M: 'Monostructural',
  G: 'Gymnastics',
  W: 'Weightlifting',
}

const ROWS_PER_PAGE = 30

type PairSortKey = 'count' | 'pctA' | 'pctB' | 'alpha'
type ModalityFilter = 'all' | 'MM' | 'GG' | 'WW' | 'cross'

/* ── derived types ─────────────────────────────────────────────── */

interface PairRow {
  movA: string
  movB: string
  count: number
  selfA: number
  selfB: number
  pctA: number
  pctB: number
  modA: string
  modB: string
  nameA: string
  nameB: string
}

/* ── helper components ─────────────────────────────────────────── */

function ModalityDot({ modality }: { modality: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full mr-1.5 flex-shrink-0"
      style={{ background: MODALITY_DOT_COLORS[modality] || '#6b7280' }}
      title={MODALITY_LABELS[modality] || modality}
    />
  )
}

function ExplainerBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
      <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{children}</p>
    </div>
  )
}

/* ── custom tooltip for the bar chart ──────────────────────────── */

function PartnerTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-[var(--panel-bg-hover)] border border-[var(--panel-border-strong)] rounded-lg p-3 text-xs shadow-xl">
      <div className="font-medium text-[var(--text-primary)] mb-1">{d.name}</div>
      <div className="text-[var(--text-tertiary)]">
        Co-occurrences: <span className="text-[var(--text-primary)] font-mono">{d.count.toLocaleString()}</span>
      </div>
      <div className="text-[var(--text-tertiary)]">
        Modality:{' '}
        <span
          style={{ color: MODALITY_DOT_COLORS[d.modality] || '#6b7280' }}
          className="font-medium"
        >
          {MODALITY_LABELS[d.modality] || d.modality}
        </span>
      </div>
    </div>
  )
}

/* ── main component ────────────────────────────────────────────── */

export default function MovementPairs({ data }: { data: CrossFitData }) {
  const { movements, matrix } = data.cooccurMatrix
  const display = data.movementDisplay
  const modality = data.movementModality

  /* ── Section 1 state ── */
  const [search, setSearch] = useState('')
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all')
  const [sortBy, setSortBy] = useState<PairSortKey>('count')
  const [page, setPage] = useState(0)

  /* ── Section 2 state ── */
  const [selectedMovement, setSelectedMovement] = useState<string>('')

  /* ═══ Build all pairs from the co-occurrence matrix ═══ */
  const allPairs = useMemo<PairRow[]>(() => {
    const pairs: PairRow[] = []
    for (let i = 0; i < movements.length; i++) {
      for (let j = i + 1; j < movements.length; j++) {
        const count = matrix[i][j]
        if (count > 0) {
          const selfA = matrix[i][i]
          const selfB = matrix[j][j]
          pairs.push({
            movA: movements[i],
            movB: movements[j],
            count,
            selfA,
            selfB,
            pctA: selfA > 0 ? +((count / selfA) * 100).toFixed(1) : 0,
            pctB: selfB > 0 ? +((count / selfB) * 100).toFixed(1) : 0,
            modA: modality[movements[i]] || '?',
            modB: modality[movements[j]] || '?',
            nameA: display[movements[i]] || movements[i],
            nameB: display[movements[j]] || movements[j],
          })
        }
      }
    }
    return pairs
  }, [movements, matrix, display, modality])

  /* ═══ Filter + sort pairs ═══ */
  const filteredPairs = useMemo(() => {
    let result = allPairs

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.nameA.toLowerCase().includes(q) ||
          p.nameB.toLowerCase().includes(q)
      )
    }

    // Modality filter
    if (modalityFilter !== 'all') {
      result = result.filter((p) => {
        switch (modalityFilter) {
          case 'MM': return p.modA === 'M' && p.modB === 'M'
          case 'GG': return p.modA === 'G' && p.modB === 'G'
          case 'WW': return p.modA === 'W' && p.modB === 'W'
          case 'cross': return p.modA !== p.modB
          default: return true
        }
      })
    }

    // Sort
    const sorted = [...result]
    switch (sortBy) {
      case 'count':
        sorted.sort((a, b) => b.count - a.count)
        break
      case 'pctA':
        sorted.sort((a, b) => b.pctA - a.pctA)
        break
      case 'pctB':
        sorted.sort((a, b) => b.pctB - a.pctB)
        break
      case 'alpha':
        sorted.sort((a, b) => a.nameA.localeCompare(b.nameA) || a.nameB.localeCompare(b.nameB))
        break
    }

    return sorted
  }, [allPairs, search, modalityFilter, sortBy])

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filteredPairs.length / ROWS_PER_PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const pagedPairs = filteredPairs.slice(safePage * ROWS_PER_PAGE, (safePage + 1) * ROWS_PER_PAGE)

  /* ═══ Section 2: Movement explorer data ═══ */
  const movementOptions = useMemo(
    () =>
      movements
        .map((id) => ({ id, name: display[id] || id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [movements, display]
  )

  const explorerData = useMemo(() => {
    if (!selectedMovement) return null

    const idx = movements.indexOf(selectedMovement)
    if (idx < 0) return null

    const totalAppearances = matrix[idx][idx]

    // Build partner list
    const partners: { id: string; name: string; count: number; modality: string }[] = []
    const neverPaired: { id: string; name: string; modality: string }[] = []

    for (let j = 0; j < movements.length; j++) {
      if (j === idx) continue
      const count = matrix[idx][j]
      const partnerId = movements[j]
      if (count > 0) {
        partners.push({
          id: partnerId,
          name: display[partnerId] || partnerId,
          count,
          modality: modality[partnerId] || '?',
        })
      } else {
        neverPaired.push({
          id: partnerId,
          name: display[partnerId] || partnerId,
          modality: modality[partnerId] || '?',
        })
      }
    }

    partners.sort((a, b) => b.count - a.count)

    const mostCommon = partners[0] || null
    const rarest = partners.length > 0 ? partners[partners.length - 1] : null
    const top15 = partners.slice(0, 15)

    // Encyclopedia entry
    const encycEntry = data.movementEncyclopedia.find((e) => e.id === selectedMovement) || null

    return {
      totalAppearances,
      partnerCount: partners.length,
      mostCommon,
      rarest,
      top15,
      neverPaired,
      encycEntry,
    }
  }, [selectedMovement, movements, matrix, display, modality, data.movementEncyclopedia])

  /* ═══ Render ═══ */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Movement Pairs</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Co-occurrence analysis of every movement pairing across the entire CrossFit.com programming history.
        </p>
      </div>

      <ExplainerBox>
        Every time two movements appear in the same workout, that&apos;s a co-occurrence.
        Pull-ups and Run appear together in 361 workouts &mdash; making them CrossFit&apos;s
        strongest pairing. This table shows every pair, ranked by how often they&apos;re
        programmed together.
      </ExplainerBox>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: Top Movement Pairs Table
          ════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Top Movement Pairs</h3>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search movements..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="bg-[var(--app-bg)] text-sm text-[var(--text-primary)] placeholder-slate-600 border border-[var(--panel-border-strong)] rounded-lg px-3 py-1.5 outline-none focus:border-blue-500/50 w-full sm:w-52"
          />

          {/* Modality filter */}
          <select
            value={modalityFilter}
            onChange={(e) => { setModalityFilter(e.target.value as ModalityFilter); setPage(0) }}
            className="bg-[var(--app-bg)] text-sm text-[var(--text-primary)] border border-[var(--panel-border-strong)] rounded-lg px-3 py-1.5 outline-none focus:border-blue-500/50 cursor-pointer appearance-none"
          >
            <option value="all">All Modalities</option>
            <option value="MM">Mono-Mono</option>
            <option value="GG">Gym-Gym</option>
            <option value="WW">Weight-Weight</option>
            <option value="cross">Cross-modality</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as PairSortKey); setPage(0) }}
            className="bg-[var(--app-bg)] text-sm text-[var(--text-primary)] border border-[var(--panel-border-strong)] rounded-lg px-3 py-1.5 outline-none focus:border-blue-500/50 cursor-pointer appearance-none"
          >
            <option value="count">Sort: Co-occurrences</option>
            <option value="pctA">Sort: % of A</option>
            <option value="pctB">Sort: % of B</option>
            <option value="alpha">Sort: Alphabetical</option>
          </select>

          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
            {filteredPairs.length} pair{filteredPairs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Modality legend */}
        <div className="flex gap-4 mb-3">
          {Object.entries(MODALITY_DOT_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-[var(--text-tertiary)]">{MODALITY_LABELS[key]} ({key})</span>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--app-bg)] border-b border-[var(--panel-border)]">
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium w-10">#</th>
                <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-medium">Movement A</th>
                <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-medium">Movement B</th>
                <th className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium">Co-occurrences</th>
                <th className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium">% of A&apos;s WODs</th>
                <th className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium">% of B&apos;s WODs</th>
              </tr>
            </thead>
            <tbody>
              {pagedPairs.map((row, i) => {
                const rank = safePage * ROWS_PER_PAGE + i + 1
                return (
                  <tr
                    key={`${row.movA}-${row.movB}`}
                    className={`border-b border-[var(--panel-border)]/50 hover:bg-[var(--panel-bg-hover)] transition-colors ${
                      i % 2 === 0 ? 'bg-[var(--panel-bg-2)]' : ''
                    }`}
                  >
                    <td className="py-1.5 px-3 text-[var(--text-muted)] font-mono">{rank}</td>
                    <td className="py-1.5 px-3 text-[var(--text-secondary)]">
                      <span className="inline-flex items-center">
                        <ModalityDot modality={row.modA} />
                        {row.nameA}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-[var(--text-secondary)]">
                      <span className="inline-flex items-center">
                        <ModalityDot modality={row.modB} />
                        {row.nameB}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-[var(--text-secondary)]">
                      {row.count.toLocaleString()}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-[var(--text-tertiary)]">
                      {row.pctA}%
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-[var(--text-tertiary)]">
                      {row.pctB}%
                    </td>
                  </tr>
                )
              })}
              {pagedPairs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                    No pairs match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-3 py-1 text-xs rounded-lg border border-[var(--panel-border-strong)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-blue-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-3 py-1 text-xs rounded-lg border border-[var(--panel-border-strong)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-blue-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2: Movement Relationship Explorer
          ════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Movement Relationship Explorer</h3>

        {/* Dropdown */}
        <select
          value={selectedMovement}
          onChange={(e) => setSelectedMovement(e.target.value)}
          className="bg-[var(--app-bg)] text-sm text-[var(--text-primary)] border border-[var(--panel-border-strong)] rounded-lg px-4 py-2 outline-none focus:border-blue-500/50 cursor-pointer appearance-none min-w-[240px] mb-4"
        >
          <option value="">Select a movement...</option>
          {movementOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {!selectedMovement && (
          <p className="text-xs text-[var(--text-muted)] italic">
            Choose a movement above to explore its relationships.
          </p>
        )}

        {selectedMovement && explorerData && (
          <div className="space-y-4 mt-2">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/20">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Total Appearances
                </div>
                <div className="text-2xl font-bold font-mono text-cyan-400">
                  {explorerData.totalAppearances.toLocaleString()}
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-xl p-4 border border-emerald-500/20">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Partners
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {explorerData.partnerCount}
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                  of {movements.length - 1} possible
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 rounded-xl p-4 border border-amber-500/20">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Most Common Partner
                </div>
                <div
                  className="text-lg font-bold font-mono text-amber-400 truncate"
                  title={explorerData.mostCommon?.name}
                >
                  {explorerData.mostCommon?.name || 'None'}
                </div>
                {explorerData.mostCommon && (
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 font-mono">
                    {explorerData.mostCommon.count.toLocaleString()} co-occurrences
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 rounded-xl p-4 border border-purple-500/20">
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Rarest Partner
                </div>
                <div
                  className="text-lg font-bold font-mono text-purple-400 truncate"
                  title={explorerData.rarest?.name}
                >
                  {explorerData.rarest?.name || 'None'}
                </div>
                {explorerData.rarest && (
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 font-mono">
                    {explorerData.rarest.count.toLocaleString()} co-occurrence{explorerData.rarest.count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Top Partners bar chart */}
            {explorerData.top15.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                  Top {explorerData.top15.length} Partners by Co-occurrence
                </h4>
                {/* Modality Legend */}
                <div className="flex gap-4 mb-3">
                  {Object.entries(MODALITY_DOT_COLORS).map(([key, color]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                      <span className="text-[10px] text-[var(--text-tertiary)]">{MODALITY_LABELS[key]} ({key})</span>
                    </div>
                  ))}
                </div>
                <div style={{ width: '100%', height: 420 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={explorerData.top15}
                      layout="vertical"
                      margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 9, fill: 'var(--chart-axis)' }}
                        tickFormatter={(v: number) => v.toLocaleString()}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                        width={130}
                      />
                      <Tooltip content={<PartnerTooltip />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {explorerData.top15.map((d, i) => (
                          <Cell
                            key={i}
                            fill={MODALITY_DOT_COLORS[d.modality] || '#6b7280'}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Never Paired With */}
            {explorerData.neverPaired.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                  Never Paired With ({explorerData.neverPaired.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {explorerData.neverPaired.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: MODALITY_DOT_COLORS[m.modality] || '#6b7280' }}
                      />
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {explorerData.neverPaired.length === 0 && (
              <div>
                <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                  Never Paired With
                </h4>
                <p className="text-[10px] text-emerald-400 italic">
                  This movement has appeared with every other tracked movement at least once.
                </p>
              </div>
            )}

            {/* Featured In (from encyclopedia) */}
            {explorerData.encycEntry && explorerData.encycEntry.featured_in_wods.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                  Featured In ({explorerData.encycEntry.featured_in_wods.length} named WODs)
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {explorerData.encycEntry.featured_in_wods.map((wod) => (
                    <span
                      key={wod}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    >
                      {wod}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
