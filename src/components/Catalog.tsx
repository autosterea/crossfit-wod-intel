import { useState, useMemo } from 'react'
import type { CrossFitData } from '../types'
import { getModalityColor } from '../utils/colors'

const PAGE_SIZE = 30

export default function Catalog({ data }: { data: CrossFitData }) {
  const [search, setSearch] = useState('')
  const [modFilter, setModFilter] = useState('all')
  const [structFilter, setStructFilter] = useState('all')
  const [tdFilter, setTdFilter] = useState('all')
  const [movFilter, setMovFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const filtered = useMemo(() => {
    let results = data.searchIndex
    if (search) {
      const q = search.toLowerCase()
      results = results.filter((w) =>
        w.t.toLowerCase().includes(q) || w.s.toLowerCase().includes(q) || w.nw.toLowerCase().includes(q)
      )
    }
    if (modFilter !== 'all') results = results.filter((w) => w.mo === modFilter)
    if (structFilter !== 'all') results = results.filter((w) => w.st === structFilter)
    if (tdFilter !== 'all') results = results.filter((w) => w.td === tdFilter)
    if (movFilter !== 'all') results = results.filter((w) => w.mv.includes(movFilter))
    return results
  }, [data.searchIndex, search, modFilter, structFilter, tdFilter, movFilter])

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const modalities = [...new Set(data.searchIndex.map((w) => w.mo))].filter(Boolean).sort()
  const structures = [...new Set(data.searchIndex.map((w) => w.st))].filter(Boolean).sort()
  const timeDomains = [...new Set(data.searchIndex.map((w) => w.td))].filter(Boolean).sort()
  const movements = Object.keys(data.movementDisplay).sort()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Workout Catalog</h2>
        <p className="text-sm text-slate-400 mt-1">
          Search and filter all {data.overview.total_workouts.toLocaleString()} workouts
        </p>
      </div>

      {/* Search and filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search workouts..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="flex-1 min-w-[200px] bg-[#12121a] border border-[#1e1e3a] rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none"
        />
        <select value={modFilter} onChange={(e) => { setModFilter(e.target.value); setPage(0) }} className="bg-[#12121a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none">
          <option value="all">All Modalities</option>
          {modalities.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={structFilter} onChange={(e) => { setStructFilter(e.target.value); setPage(0) }} className="bg-[#12121a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none">
          <option value="all">All Structures</option>
          {structures.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tdFilter} onChange={(e) => { setTdFilter(e.target.value); setPage(0) }} className="bg-[#12121a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none">
          <option value="all">All Time Domains</option>
          {timeDomains.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={movFilter} onChange={(e) => { setMovFilter(e.target.value); setPage(0) }} className="bg-[#12121a] border border-[#1e1e3a] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none">
          <option value="all">All Movements</option>
          {movements.map((m) => <option key={m} value={m}>{data.movementDisplay[m]}</option>)}
        </select>
      </div>

      {/* Results count */}
      <div className="text-xs text-slate-500">
        {filtered.length.toLocaleString()} workouts found | Page {page + 1} of {totalPages}
      </div>

      {/* Table */}
      <div className="bg-[#12121a] rounded-xl border border-[#1e1e3a] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e1e3a] text-[10px] text-slate-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Modality</th>
              <th className="text-left px-4 py-3">Structure</th>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Movements</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((w, idx) => (
              <>
                <tr
                  key={w.d + idx}
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  className="border-b border-[#1e1e3a]/50 hover:bg-[#1a1a2a] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{w.d}</td>
                  <td className="px-4 py-2.5 text-xs text-white">
                    {w.nw && <span className="text-amber-400 mr-1">{w.nw}</span>}
                    {w.ih && <span className="text-rose-400 text-[9px] mr-1">HERO</span>}
                    {w.ib && <span className="text-purple-400 text-[9px] mr-1">BM</span>}
                    {!w.nw && w.t}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 text-[10px] rounded-full" style={{ background: getModalityColor(w.mo) + '20', color: getModalityColor(w.mo) }}>
                      {w.mo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{w.st}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{w.td}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {w.mv.slice(0, 4).map((m) => (
                        <span key={m} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e3a] text-slate-400">
                          {data.movementDisplay[m] || m}
                        </span>
                      ))}
                      {w.mv.length > 4 && <span className="text-[9px] text-slate-600">+{w.mv.length - 4}</span>}
                    </div>
                  </td>
                </tr>
                {expandedIdx === idx && (
                  <tr key={w.d + 'exp'} className="bg-[#0d0d1a]">
                    <td colSpan={6} className="px-6 py-4">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans max-h-48 overflow-y-auto">
                        {w.s}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#12121a] border border-[#1e1e3a] text-slate-400 disabled:opacity-30 hover:border-[#2a2a5a]"
        >
          Prev
        </button>
        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
          const p = page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i
          if (p < 0 || p >= totalPages) return null
          return (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 text-xs rounded-lg ${
                p === page ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[#12121a] text-slate-400 border border-[#1e1e3a]'
              }`}
            >
              {p + 1}
            </button>
          )
        })}
        <button
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#12121a] border border-[#1e1e3a] text-slate-400 disabled:opacity-30 hover:border-[#2a2a5a]"
        >
          Next
        </button>
      </div>
    </div>
  )
}
