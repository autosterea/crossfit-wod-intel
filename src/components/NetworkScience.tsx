import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer,
} from 'recharts'
import type { CrossFitData } from '../types'

const MODALITY_BAR_COLORS: Record<string, string> = {
  M: '#f43f5e',
  G: '#10b981',
  W: '#3b82f6',
}

const MODALITY_LABELS: Record<string, string> = {
  M: 'Monostructural',
  G: 'Gymnastics',
  W: 'Weightlifting',
}

const COMMUNITY_COLORS = [
  '#60a5fa', '#f43f5e', '#10b981', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#84cc16', '#fb923c', '#6366f1',
  '#14b8a6', '#e879f9', '#facc15', '#4ade80', '#f87171',
]

function getModalityBarColor(modality: string): string {
  return MODALITY_BAR_COLORS[modality] || '#6b7280'
}

interface CentralityData {
  pageRank: { id: string; score: number }[]
  betweenness: { id: string; score: number }[]
  communities: { id: string; community: number }[]
  clusteringCoefficient: number
}

type SortKey = 'name' | 'pageRank' | 'betweenness' | 'community' | 'modality'
type SortDir = 'asc' | 'desc'

function ExplainerBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10 mb-4">
      <div className="text-xs font-medium text-blue-400 mb-1">What is this?</div>
      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{children}</p>
    </div>
  )
}

export default function NetworkScience({ data, advancedAnalysis }: { data: CrossFitData; advancedAnalysis: any }) {
  const centrality: CentralityData = advancedAnalysis.centrality

  const [sortKey, setSortKey] = useState<SortKey>('pageRank')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Derive lookup maps
  const pageRankMap = useMemo(() => {
    const map: Record<string, number> = {}
    centrality.pageRank.forEach((d) => { map[d.id] = d.score })
    return map
  }, [centrality.pageRank])

  const betweennessMap = useMemo(() => {
    const map: Record<string, number> = {}
    centrality.betweenness.forEach((d) => { map[d.id] = d.score })
    return map
  }, [centrality.betweenness])

  const communityMap = useMemo(() => {
    const map: Record<string, number> = {}
    centrality.communities.forEach((d) => { map[d.id] = d.community })
    return map
  }, [centrality.communities])

  // Normalization: max scores for percentage display
  const maxPageRank = useMemo(() => Math.max(...centrality.pageRank.map((d) => d.score), 1e-10), [centrality.pageRank])
  const maxBetweenness = useMemo(() => Math.max(...centrality.betweenness.map((d) => d.score), 1e-10), [centrality.betweenness])

  // Top 15 for bar charts
  const topPageRank = useMemo(() =>
    [...centrality.pageRank]
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map((d) => ({
        name: data.movementDisplay[d.id] || d.id,
        score: d.score,
        modality: data.movementModality[d.id] || '?',
        pct: +((d.score / maxPageRank) * 100).toFixed(1),
      })),
    [centrality.pageRank, data.movementDisplay, data.movementModality, maxPageRank]
  )

  const topBetweenness = useMemo(() =>
    [...centrality.betweenness]
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map((d) => ({
        name: data.movementDisplay[d.id] || d.id,
        score: d.score,
        modality: data.movementModality[d.id] || '?',
        pct: +((d.score / maxBetweenness) * 100).toFixed(1),
      })),
    [centrality.betweenness, data.movementDisplay, data.movementModality, maxBetweenness]
  )

  // Community groupings
  const communityGroups = useMemo(() => {
    const groups: Record<number, { id: string; name: string; modality: string }[]> = {}
    centrality.communities.forEach((d) => {
      if (!groups[d.community]) groups[d.community] = []
      groups[d.community].push({
        id: d.id,
        name: data.movementDisplay[d.id] || d.id,
        modality: data.movementModality[d.id] || '?',
      })
    })
    // Sort members within each community by PageRank
    Object.values(groups).forEach((members) => {
      members.sort((a, b) => (pageRankMap[b.id] || 0) - (pageRankMap[a.id] || 0))
    })
    return groups
  }, [centrality.communities, data.movementDisplay, data.movementModality, pageRankMap])

  const numCommunities = Object.keys(communityGroups).length

  // Describe community theme based on modality distribution
  const communityDescriptions = useMemo(() => {
    const descriptions: Record<number, string> = {}
    Object.entries(communityGroups).forEach(([commStr, members]) => {
      const comm = Number(commStr)
      const modalityCounts: Record<string, number> = {}
      members.forEach((m) => {
        modalityCounts[m.modality] = (modalityCounts[m.modality] || 0) + 1
      })
      const total = members.length
      const dominant = Object.entries(modalityCounts).sort((a, b) => b[1] - a[1])
      const topMod = dominant[0]?.[0] || '?'
      const topPct = total > 0 ? ((dominant[0]?.[1] || 0) / total * 100).toFixed(0) : '0'

      if (dominant.length === 1) {
        descriptions[comm] = `Pure ${MODALITY_LABELS[topMod] || topMod} cluster (${total} movements)`
      } else if (Number(topPct) >= 60) {
        descriptions[comm] = `${MODALITY_LABELS[topMod] || topMod}-dominant (${topPct}%) with ${dominant.slice(1).map(([m]) => MODALITY_LABELS[m] || m).join(', ')} elements (${total} movements)`
      } else {
        descriptions[comm] = `Mixed modality cluster: ${dominant.map(([m, c]) => `${MODALITY_LABELS[m] || m} ${((c / total) * 100).toFixed(0)}%`).join(', ')} (${total} movements)`
      }
    })
    return descriptions
  }, [communityGroups])

  // Score cards data
  const topPR = topPageRank[0]
  const topBridge = topBetweenness[0]

  // Full table data
  const tableData = useMemo(() => {
    const allMovements = centrality.pageRank.map((d) => d.id)
    return allMovements.map((id) => ({
      id,
      name: data.movementDisplay[id] || id,
      pageRank: pageRankMap[id] || 0,
      pageRankPct: +((pageRankMap[id] || 0) / maxPageRank * 100).toFixed(1),
      betweenness: betweennessMap[id] || 0,
      betweennessPct: +((betweennessMap[id] || 0) / maxBetweenness * 100).toFixed(1),
      community: communityMap[id] ?? -1,
      modality: data.movementModality[id] || '?',
    }))
  }, [centrality.pageRank, data.movementDisplay, data.movementModality, pageRankMap, betweennessMap, communityMap, maxPageRank, maxBetweenness])

  const sortedTableData = useMemo(() => {
    const sorted = [...tableData]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'pageRank': cmp = a.pageRank - b.pageRank; break
        case 'betweenness': cmp = a.betweenness - b.betweenness; break
        case 'community': cmp = a.community - b.community; break
        case 'modality': cmp = a.modality.localeCompare(b.modality); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [tableData, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'desc' ? ' \u25BC' : ' \u25B2'
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-[var(--panel-bg-hover)] border border-[var(--panel-border-strong)] rounded-lg p-3 text-xs shadow-xl">
        <div className="font-medium text-[var(--text-primary)] mb-1">{d.name}</div>
        <div className="text-[var(--text-tertiary)]">
          Score: <span className="text-[var(--text-primary)] font-mono">{d.score?.toFixed(6) ?? d.pct}</span>
        </div>
        <div className="text-[var(--text-tertiary)]">
          Relative: <span className="text-[var(--text-primary)] font-mono">{d.pct}%</span>
        </div>
        <div className="text-[var(--text-tertiary)]">
          Modality: <span style={{ color: getModalityBarColor(d.modality) }} className="font-medium">{MODALITY_LABELS[d.modality] || d.modality}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 1. Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Movement Network Science</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Graph theory analysis of movement co-occurrence patterns across the entire CrossFit.com programming history.
        </p>
      </div>

      <ExplainerBox>
        Every time two movements appear in the same workout, they form a connection. Over 6,779 workouts, these
        connections create a network. We can analyze this network the same way Google analyzes the internet — to find
        which movements are most &ldquo;important,&rdquo; which ones bridge different types of fitness, and which ones form
        natural clusters.
      </ExplainerBox>

      {/* 2. Score Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-5 border border-cyan-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Clustering Coefficient</div>
          <div className="text-3xl font-bold font-mono text-cyan-400">
            {centrality.clusteringCoefficient.toFixed(3)}
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
            How tightly connected is the movement network? 1.0 = everything connects to everything. Shows if CrossFit uses movements in tight groups or freely mixes them.
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 rounded-xl p-5 border border-amber-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Top PageRank Movement</div>
          <div className="text-xl font-bold font-mono text-amber-400 truncate" title={topPR?.name}>
            {topPR?.name || 'N/A'}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5 font-mono">{topPR ? `${topPR.pct}% relative score` : ''}</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
            Like Google ranks websites, PageRank finds movements that are connected to other important movements.
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-xl p-5 border border-emerald-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Top Bridge Movement</div>
          <div className="text-xl font-bold font-mono text-emerald-400 truncate" title={topBridge?.name}>
            {topBridge?.name || 'N/A'}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5 font-mono">{topBridge ? `${topBridge.pct}% relative score` : ''}</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
            Bridge movements connect different types of fitness. They appear in workouts across all modalities.
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 rounded-xl p-5 border border-purple-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Communities Found</div>
          <div className="text-3xl font-bold font-mono text-purple-400">{numCommunities}</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
            Distinct clusters of movements detected by community detection algorithm.
          </div>
        </div>
      </div>

      {/* 3. PageRank vs Betweenness Side-by-Side Bar Charts */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">PageRank vs Betweenness Centrality — Top 15</h3>
        <ExplainerBox>
          <strong>PageRank</strong> = importance (connected to other important movements). <strong>Betweenness</strong> = bridging power (connecting different groups). A movement high in both is a cornerstone of CrossFit programming.
        </ExplainerBox>

        {/* Modality Legend */}
        <div className="flex gap-4 mb-3">
          {Object.entries(MODALITY_BAR_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              <span className="text-[10px] text-[var(--text-tertiary)]">{MODALITY_LABELS[key]} ({key})</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#6b7280' }} />
            <span className="text-[10px] text-[var(--text-tertiary)]">Other</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* PageRank Chart */}
          <div>
            <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-2">PageRank (Importance)</h4>
            <div style={{width:"100%",height:420}}><ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPageRank} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {topPageRank.map((d, i) => (
                    <Cell key={i} fill={getModalityBarColor(d.modality)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer></div>
          </div>

          {/* Betweenness Chart */}
          <div>
            <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-2">Betweenness Centrality (Bridging)</h4>
            <div style={{width:"100%",height:420}}><ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBetweenness} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {topBetweenness.map((d, i) => (
                    <Cell key={i} fill={getModalityBarColor(d.modality)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer></div>
          </div>
        </div>
      </div>

      {/* 4. Community Detection */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Community Detection</h3>
        <ExplainerBox>
          Communities are groups of movements that tend to appear together more often than with outsiders. Think of them
          as &ldquo;workout families.&rdquo; The algorithm finds these automatically — no human told it about M/G/W categories.
        </ExplainerBox>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Object.entries(communityGroups)
            .sort(([, a], [, b]) => b.length - a.length)
            .map(([commStr, members]) => {
              const comm = Number(commStr)
              const color = COMMUNITY_COLORS[comm % COMMUNITY_COLORS.length]
              return (
                <div
                  key={comm}
                  className="rounded-lg p-4 border"
                  style={{
                    background: `${color}08`,
                    borderColor: `${color}25`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Community {comm + 1}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">{members.length} movements</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mb-2 italic">
                    {communityDescriptions[comm]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          background: `${color}15`,
                          color: color,
                          border: `1px solid ${color}30`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: getModalityBarColor(m.modality) }}
                        />
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* 5. Movement Importance Table */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Movement Importance Table</h3>
        <ExplainerBox>
          Full ranking of all movements by network importance metrics. Click column headers to sort. Scores are
          normalized as percentages relative to the top-scoring movement in each metric.
        </ExplainerBox>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--app-bg)] border-b border-[var(--panel-border)]">
                <th
                  className="text-left py-2 px-3 text-[var(--text-tertiary)] font-medium cursor-pointer hover:text-[var(--text-primary)] select-none"
                  onClick={() => handleSort('name')}
                >
                  Movement{sortIndicator('name')}
                  <div className="text-[9px] text-[var(--text-muted)] font-normal mt-0.5">Display name</div>
                </th>
                <th
                  className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium cursor-pointer hover:text-[var(--text-primary)] select-none"
                  onClick={() => handleSort('pageRank')}
                >
                  PageRank{sortIndicator('pageRank')}
                  <div className="text-[9px] text-[var(--text-muted)] font-normal mt-0.5">Importance via connections</div>
                </th>
                <th
                  className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium cursor-pointer hover:text-[var(--text-primary)] select-none"
                  onClick={() => handleSort('betweenness')}
                >
                  Betweenness{sortIndicator('betweenness')}
                  <div className="text-[9px] text-[var(--text-muted)] font-normal mt-0.5">Bridging power</div>
                </th>
                <th
                  className="text-center py-2 px-3 text-[var(--text-tertiary)] font-medium cursor-pointer hover:text-[var(--text-primary)] select-none"
                  onClick={() => handleSort('community')}
                >
                  Community{sortIndicator('community')}
                  <div className="text-[9px] text-[var(--text-muted)] font-normal mt-0.5">Detected cluster</div>
                </th>
                <th
                  className="text-center py-2 px-3 text-[var(--text-tertiary)] font-medium cursor-pointer hover:text-[var(--text-primary)] select-none"
                  onClick={() => handleSort('modality')}
                >
                  Modality{sortIndicator('modality')}
                  <div className="text-[9px] text-[var(--text-muted)] font-normal mt-0.5">M / G / W</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTableData.map((row, i) => {
                const commColor = COMMUNITY_COLORS[(row.community >= 0 ? row.community : 0) % COMMUNITY_COLORS.length]
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-[var(--panel-border)]/50 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                  >
                    <td className="py-1.5 px-3 text-[var(--text-secondary)] font-medium">{row.name}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-[var(--panel-bg-hover)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400/70"
                            style={{ width: `${row.pageRankPct}%` }}
                          />
                        </div>
                        <span className="text-[var(--text-tertiary)] w-12 text-right">{row.pageRankPct}%</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-[var(--panel-bg-hover)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400/70"
                            style={{ width: `${row.betweennessPct}%` }}
                          />
                        </div>
                        <span className="text-[var(--text-tertiary)] w-12 text-right">{row.betweennessPct}%</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
                        style={{
                          background: `${commColor}20`,
                          color: commColor,
                          border: `1px solid ${commColor}40`,
                        }}
                      >
                        {row.community >= 0 ? row.community + 1 : '?'}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          background: `${getModalityBarColor(row.modality)}20`,
                          color: getModalityBarColor(row.modality),
                        }}
                      >
                        {row.modality}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
