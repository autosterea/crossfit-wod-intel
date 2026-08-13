import { useState, useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import type { CrossFitData } from '../types'
import { getNodeColor, MODALITY_LABELS } from '../utils/colors'

function DNACard({ movement, data, isSelected, onClick }: {
  movement: any; data: CrossFitData; isSelected: boolean; onClick: () => void
}) {
  const color = getNodeColor(movement.modality)

  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all duration-200 ${
        isSelected
          ? 'bg-[var(--panel-bg-hover)] border-blue-500/50 ring-1 ring-blue-500/20'
          : 'bg-[var(--panel-bg)] border-[var(--panel-border)] hover:border-[var(--panel-border-strong)]'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
        <span className="text-sm font-medium text-[var(--text-primary)]">{movement.name}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono" style={{ color }}>{movement.total_count.toLocaleString()}</span>
        <span className="text-[10px] text-[var(--text-muted)]">{movement.pct}% of all WODs</span>
      </div>
      <div className="text-[10px] text-[var(--text-muted)] mt-1">{movement.first_seen} - {movement.last_seen}</div>
    </button>
  )
}

export default function MovementDNA({ data }: { data: CrossFitData }) {
  const [selectedId, setSelectedId] = useState<string>(data.movementEncyclopedia[0].id)
  const [modalityFilter, setModalityFilter] = useState<string>('all')

  const filtered = useMemo(() =>
    data.movementEncyclopedia
      .filter((m) => modalityFilter === 'all' || m.modality === modalityFilter)
      .sort((a, b) => b.total_count - a.total_count),
    [data.movementEncyclopedia, modalityFilter]
  )

  const selected = data.movementEncyclopedia.find((m) => m.id === selectedId) || data.movementEncyclopedia[0]

  const timelineData = useMemo(() =>
    Object.entries(selected.year_pct)
      .map(([year, pct]) => ({ year, pct }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    [selected]
  )

  const radarData = useMemo(() => {
    const maxCount = Math.max(...data.movementEncyclopedia.map((m) => m.total_count))
    const years = Object.keys(selected.year_pct).map(Number)
    const recentYears = years.filter((y) => y >= 2020)
    const earlyYears = years.filter((y) => y <= 2006)
    const recentAvg = recentYears.length > 0 ? recentYears.reduce((s, y) => s + (selected.year_pct[y] || 0), 0) / recentYears.length : 0
    const earlyAvg = earlyYears.length > 0 ? earlyYears.reduce((s, y) => s + (selected.year_pct[y] || 0), 0) / earlyYears.length : 0
    const trendDirection = recentAvg - earlyAvg
    const partnerCount = selected.top_partners.length
    const wodCount = selected.featured_in_wods.length

    return [
      { axis: 'Frequency', value: (selected.total_count / maxCount) * 100 },
      { axis: 'Trend', value: Math.min(100, Math.max(0, 50 + trendDirection * 3)) },
      { axis: 'Versatility', value: Math.min(100, partnerCount * 20) },
      { axis: 'Named WODs', value: Math.min(100, wodCount * 5) },
      { axis: 'Longevity', value: Math.min(100, ((years[years.length - 1] - years[0]) / 25) * 100) },
      { axis: 'Consistency', value: Math.min(100, (years.length / 26) * 100) },
    ]
  }, [selected, data.movementEncyclopedia])

  const color = getNodeColor(selected.modality)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Movement DNA Profiles</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Deep analysis of every movement - frequency, trends, partners, and DNA fingerprint</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'M', 'G', 'W'].map((f) => (
          <button
            key={f}
            onClick={() => setModalityFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              modalityFilter === f
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-[var(--panel-bg)] text-[var(--text-tertiary)] border border-[var(--panel-border)] hover:border-[var(--panel-border-strong)]'
            }`}
          >
            {f === 'all' ? 'All' : MODALITY_LABELS[f] || f}
          </button>
        ))}
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Movement list */}
        <div className="w-72 shrink-0 overflow-y-auto space-y-2 pr-2">
          {filtered.map((m) => (
            <DNACard
              key={m.id}
              movement={m}
              data={data}
              isSelected={m.id === selectedId}
              onClick={() => setSelectedId(m.id)}
            />
          ))}
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Header */}
          <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)]">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: color + '20', color }}>
                {selected.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">{selected.name}</h3>
                <p className="text-xs text-[var(--text-tertiary)]">{MODALITY_LABELS[selected.modality]} | Since {selected.first_seen}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-3xl font-bold font-mono" style={{ color }}>{selected.total_count.toLocaleString()}</div>
                <div className="text-xs text-[var(--text-muted)]">appearances ({selected.pct}%)</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-[var(--text-primary)]">{selected.top_partners.length}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Top Partners</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-[var(--text-primary)]">{selected.featured_in_wods.length}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Named WODs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-[var(--text-primary)]">{Object.keys(selected.year_pct).length}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Active Years</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold font-mono text-[var(--text-primary)]">
                  {(Object.values(selected.year_pct).reduce((a, b) => a + b, 0) / Object.keys(selected.year_pct).length).toFixed(1)}%
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">Avg. Frequency</div>
              </div>
            </div>
          </div>

          {/* DNA Radar + Timeline side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Radar */}
            <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
              <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">DNA Fingerprint</h4>
              <div style={{width:"100%",height:250}}><ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--chart-grid)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
                  <PolarRadiusAxis tick={false} domain={[0, 100]} axisLine={false} />
                  <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer></div>
            </div>

            {/* Timeline */}
            <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
              <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Usage Over Time (%)</h4>
              <div style={{width:"100%",height:250}}><ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="dnaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} interval={3} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
                  <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }} />
                  <Area type="monotone" dataKey="pct" stroke={color} fill="url(#dnaGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer></div>
            </div>
          </div>

          {/* Partners & Named WODs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
              <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Top Partners</h4>
              <div className="space-y-2">
                {selected.top_partners.map((p, i) => {
                  const pColor = getNodeColor(data.movementModality[p] || 'G')
                  return (
                    <div key={p} className="flex items-center gap-3 py-1.5">
                      <span className="text-xs font-mono text-[var(--text-muted)] w-4">{i + 1}</span>
                      <div className="w-2 h-2 rounded-full" style={{ background: pColor }} />
                      <span className="text-sm text-[var(--text-secondary)]">{data.movementDisplay[p] || p}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
              <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Featured In Named WODs</h4>
              <div className="flex flex-wrap gap-1.5">
                {selected.featured_in_wods.map((w) => (
                  <span key={w} className="px-2 py-1 text-[10px] rounded bg-[var(--panel-bg-hover)] text-[var(--text-secondary)] border border-[var(--panel-border-strong)]">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
