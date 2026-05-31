import { useRef, useCallback, useMemo, useState, useEffect, lazy, Suspense } from 'react'
import * as d3 from 'd3'
import type { CrossFitData } from '../types'
import { MOVEMENT_TAXONOMY, FUNCTIONAL_PATTERN_LABELS, FUNCTIONAL_PATTERN_COLORS, type FunctionalPattern } from '../data/movement-taxonomy'

const ForceGraph3DScene = lazy(() => import('./ForceGraph3DScene'))

function getMovementColor(movId: string): string {
  const tax = MOVEMENT_TAXONOMY[movId]
  if (!tax) return '#6b7280'
  return FUNCTIONAL_PATTERN_COLORS[tax.functionalPattern[0]] || '#6b7280'
}

function getMovementPattern(movId: string): string {
  const tax = MOVEMENT_TAXONOMY[movId]
  if (!tax) return 'Unknown'
  return FUNCTIONAL_PATTERN_LABELS[tax.functionalPattern[0]] || tax.functionalPattern[0]
}

function getModalityColor(modality: string): string {
  if (modality === 'M') return '#ff6b6b'
  if (modality === 'G') return '#51cf66'
  return '#339af0'
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  modality: string
  count: number
  pattern: string
  patternColor: string
  radius: number
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  value: number
}

export default function ForceGraph3DView({ data }: { data: CrossFitData }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoverNode, setHoverNode] = useState<string | null>(null)
  const [colorMode, setColorMode] = useState<'function' | 'modality'>('function')
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 })

  const maxCount = Math.max(...data.network.nodes.map((n) => n.count))
  const maxLink = Math.max(...data.network.links.map((l) => l.value))

  // Build graph data
  const { nodes, links } = useMemo(() => {
    const nodes: SimNode[] = data.network.nodes.map((n) => ({
      id: n.id,
      label: data.movementDisplay[n.id] || n.label,
      modality: n.modality,
      count: n.count,
      pattern: getMovementPattern(n.id),
      patternColor: getMovementColor(n.id),
      radius: Math.max(8, (n.count / maxCount) * 35),
    }))

    const links: SimLink[] = data.network.links.map((l) => ({
      source: l.source,
      target: l.target,
      value: l.value,
    }))

    return { nodes, links }
  }, [data, maxCount])

  // Partners for hover panel
  const nodePartners = useMemo(() => {
    if (!hoverNode) return []
    return data.network.links
      .filter((l) => l.source === hoverNode || l.target === hoverNode)
      .map((l) => ({
        partner: l.source === hoverNode ? l.target : l.source,
        value: l.value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [hoverNode, data.network.links])

  const hoveredNodeData = useMemo(() => {
    if (!hoverNode) return null
    return nodes.find((n) => n.id === hoverNode) || null
  }, [hoverNode, nodes])

  // Unique patterns for legend
  const patterns = useMemo(() => {
    const seen = new Map<string, string>()
    data.network.nodes.forEach((n) => {
      const p = getMovementPattern(n.id)
      const c = getMovementColor(n.id)
      if (!seen.has(p)) seen.set(p, c)
    })
    return Array.from(seen.entries())
  }, [data])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDimensions({ width, height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // D3 force simulation
  useEffect(() => {
    if (!svgRef.current || view !== '2d') return
    const { width, height } = dimensions

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Deep-clone nodes/links so D3 can mutate them
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }))
    const simLinks: SimLink[] = links.map((l) => ({ ...l }))

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(80).strength((l) => Math.min(0.8, (l as SimLink).value / maxLink)))
      .force('charge', d3.forceManyBody().strength(-250).distanceMax(400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => d.radius + 4))
      .force('x', d3.forceX(width / 2).strength(0.06))
      .force('y', d3.forceY(height / 2).strength(0.06))

    // Zoom
    const g = svg.append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    // Links
    const linkG = g.append('g')
    const link = linkG.selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke-width', (d) => Math.max(1, (d.value / maxLink) * 8))
      .attr('stroke-linecap', 'round')

    // Node groups
    const nodeG = g.append('g')
    const node = nodeG.selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )

    // Glow filter
    const defs = svg.append('defs')
    const filter = defs.append('filter').attr('id', 'glow')
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const merge = filter.append('feMerge')
    merge.append('feMergeNode').attr('in', 'coloredBlur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Halo circle (glow)
    node.append('circle')
      .attr('r', (d) => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => colorMode === 'function' ? d.patternColor : getModalityColor(d.modality))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.15)
      .attr('filter', 'url(#glow)')

    // Main circle
    node.append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => colorMode === 'function' ? d.patternColor : getModalityColor(d.modality))
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.2)

    // Labels
    node.append('text')
      .text((d) => d.label.length > 14 ? d.label.substring(0, 12) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 14)
      .attr('fill', '#94a3b8')
      .attr('font-size', 10)
      .attr('font-family', 'Inter, sans-serif')
      .attr('font-weight', 500)
      .attr('pointer-events', 'none')

    // Count label inside node
    node.append('text')
      .text((d) => d.count > 99 ? (d.count / 1000).toFixed(1) + 'k' : d.count.toString())
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#ffffff')
      .attr('font-size', (d) => Math.max(8, d.radius * 0.45))
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-weight', 600)
      .attr('pointer-events', 'none')

    // Update function for coloring based on state
    function updateAppearance(hovId: string | null, selId: string | null) {
      const activeId = selId || hovId
      const connectedIds = new Set<string>()

      if (activeId) {
        connectedIds.add(activeId)
        simLinks.forEach((l) => {
          const src = typeof l.source === 'object' ? (l.source as SimNode).id : l.source
          const tgt = typeof l.target === 'object' ? (l.target as SimNode).id : l.target
          if (src === activeId) connectedIds.add(String(tgt))
          if (tgt === activeId) connectedIds.add(String(src))
        })
      }

      node.select('circle:nth-child(2)')
        .attr('fill-opacity', (d) => !activeId ? 0.85 : connectedIds.has(d.id) ? 1 : 0.12)
        .attr('stroke-opacity', (d) => !activeId ? 0.2 : connectedIds.has(d.id) ? 0.6 : 0.05)
        .attr('stroke-width', (d) => d.id === activeId ? 3 : 1.5)

      node.select('circle:first-child')
        .attr('stroke-opacity', (d) => !activeId ? 0.15 : connectedIds.has(d.id) ? 0.3 : 0)

      node.selectAll('text')
        .attr('opacity', (d: any) => !activeId ? 1 : connectedIds.has(d.id) ? 1 : 0.15)

      link
        .attr('stroke', (d) => {
          const src = typeof d.source === 'object' ? (d.source as SimNode).id : d.source
          const tgt = typeof d.target === 'object' ? (d.target as SimNode).id : d.target
          if (!activeId) {
            const t = d.value / maxLink
            return t > 0.6 ? '#60a5fa' : t > 0.3 ? '#3b82f6' : '#1e3a5f'
          }
          if (src === activeId || tgt === activeId) return '#60a5fa'
          return '#1e3a5f'
        })
        .attr('stroke-opacity', (d) => {
          if (!activeId) return 0.5
          const src = typeof d.source === 'object' ? (d.source as SimNode).id : d.source
          const tgt = typeof d.target === 'object' ? (d.target as SimNode).id : d.target
          return (src === activeId || tgt === activeId) ? 0.8 : 0.06
        })
    }

    // Initial appearance
    updateAppearance(null, null)

    // Interaction
    node.on('mouseenter', (_, d) => {
      setHoverNode(d.id)
      updateAppearance(d.id, selectedNode)
    })
    node.on('mouseleave', () => {
      setHoverNode(null)
      updateAppearance(null, selectedNode)
    })
    node.on('click', (_, d) => {
      const newSel = selectedNode === d.id ? null : d.id
      setSelectedNode(newSel)
      updateAppearance(null, newSel)
    })

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!)

      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => { simulation.stop() }
  }, [nodes, links, dimensions, colorMode, maxLink, view])

  // Re-run appearance update when selectedNode changes from outside
  useEffect(() => {
    // The D3 effect handles this internally via the click handler
  }, [selectedNode])

  if (view === '3d') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Movement Force Graph</h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">3D view — drag to rotate, scroll to zoom</p>
          </div>
          <button onClick={() => setView('2d')} className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 hover:bg-blue-500/30">
            Switch to 2D
          </button>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /></div>}>
          <ForceGraph3DScene data={data} colorMode={colorMode} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Movement Force Graph</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            How movements connect through co-occurrence. Node size = frequency. Link thickness = how often they appear together.
            {selectedNode && (
              <span className="text-blue-400 ml-2">
                Selected: {data.movementDisplay[selectedNode] || selectedNode}
                <button onClick={() => setSelectedNode(null)} className="ml-2 text-rose-400 hover:text-rose-300">[clear]</button>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="flex gap-1 bg-[var(--code-bg)] rounded-lg p-1 border border-[var(--panel-border)]">
            <button onClick={() => setColorMode('function')} className={`px-2.5 py-1 text-[10px] rounded ${colorMode === 'function' ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-tertiary)]'}`}>
              Functional
            </button>
            <button onClick={() => setColorMode('modality')} className={`px-2.5 py-1 text-[10px] rounded ${colorMode === 'modality' ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-tertiary)]'}`}>
              M / G / W
            </button>
          </div>
          <button onClick={() => setView('3d')} className="px-3 py-1.5 text-xs bg-[var(--panel-bg-hover)] text-[var(--text-tertiary)] rounded-lg border border-[var(--panel-border-strong)] hover:text-white">
            3D View
          </button>
        </div>
      </div>

      {/* Explainer */}
      <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10">
        <div className="text-xs font-medium text-blue-400 mb-1">How to read this</div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          Each circle is a movement. Bigger = appears in more workouts. Lines connect movements that appear in the same workout — thicker lines = stronger pairing.
          Hover to highlight connections. Click to lock a selection. Drag nodes to rearrange. Scroll to zoom.
        </p>
      </div>

      <div className="flex gap-4">
        {/* SVG Graph */}
        <div ref={containerRef} className="flex-1 bg-[#0a1020] rounded-xl border border-[#1e2a4a] overflow-hidden" style={{ height: 'calc(100vh - 260px)', minHeight: 500 }}>
          <svg ref={svgRef} width={dimensions.width} height={dimensions.height} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Info Panel */}
        {hoveredNodeData && (
          <div className="w-64 shrink-0 bg-[var(--panel-bg)] rounded-xl border border-[var(--panel-border)] p-5 self-start">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-4 h-4 rounded-full" style={{ background: colorMode === 'function' ? hoveredNodeData.patternColor : getModalityColor(hoveredNodeData.modality) }} />
              <h3 className="text-base font-bold text-white">{hoveredNodeData.label}</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Pattern</div>
                <div className="text-sm text-[var(--text-secondary)]">{hoveredNodeData.pattern}</div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Appearances</div>
                <div className="text-2xl font-bold font-mono text-blue-400">{hoveredNodeData.count.toLocaleString()}</div>
              </div>
              {MOVEMENT_TAXONOMY[hoveredNodeData.id] && (
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Physical Skills</div>
                  <div className="flex flex-wrap gap-1">
                    {MOVEMENT_TAXONOMY[hoveredNodeData.id].physicalSkills.map((s) => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--panel-bg-hover)] text-[var(--text-secondary)]">
                        {s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Top Partners</div>
                {nodePartners.map((p) => (
                  <div key={p.partner} className="flex justify-between items-center py-1 border-b border-[var(--panel-border)] last:border-0">
                    <span className="text-xs text-[var(--text-secondary)]">{data.movementDisplay[p.partner] || p.partner}</span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {colorMode === 'function' ? (
          patterns.map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}
            </span>
          ))
        ) : (
          [{ l: 'Monostructural', c: '#ff6b6b' }, { l: 'Gymnastics', c: '#51cf66' }, { l: 'Weightlifting', c: '#339af0' }].map((m) => (
            <span key={m.l} className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.c }} />{m.l}
            </span>
          ))
        )}
        <span className="text-[10px] text-[var(--text-muted)] ml-4">Scroll to zoom · Drag nodes · Click to isolate</span>
      </div>
    </div>
  )
}
