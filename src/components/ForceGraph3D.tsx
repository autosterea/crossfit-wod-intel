import { useRef, useCallback, useMemo, useState } from 'react'
import ForceGraph from 'react-force-graph-3d'
import type { CrossFitData } from '../types'
import { MOVEMENT_TAXONOMY, FUNCTIONAL_PATTERN_LABELS, FUNCTIONAL_PATTERN_COLORS, type FunctionalPattern } from '../data/movement-taxonomy'

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

export default function ForceGraph3DView({ data }: { data: CrossFitData }) {
  const fgRef = useRef<any>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoverNode, setHoverNode] = useState<any>(null)
  const [colorMode, setColorMode] = useState<'function' | 'modality'>('function')

  const maxCount = Math.max(...data.network.nodes.map((n) => n.count))
  const maxLink = Math.max(...data.network.links.map((l) => l.value))

  const graphData = useMemo(() => {
    const nodes = data.network.nodes.map((n) => ({
      id: n.id,
      label: data.movementDisplay[n.id] || n.label,
      modality: n.modality,
      count: n.count,
      val: (n.count / maxCount) * 30 + 4,
      pattern: getMovementPattern(n.id),
      patternColor: getMovementColor(n.id),
    }))

    let links = data.network.links.map((l) => ({
      source: l.source,
      target: l.target,
      value: l.value,
    }))

    if (selectedNode) {
      links = links.filter((l) => l.source === selectedNode || l.target === selectedNode)
    }

    return { nodes, links }
  }, [data, selectedNode, maxCount])

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode((prev: string | null) => (prev === node.id ? null : node.id))
    if (fgRef.current) {
      const distance = 200
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        1500
      )
    }
  }, [])

  const nodePartners = useMemo(() => {
    if (!hoverNode) return []
    return data.network.links
      .filter((l) => l.source === hoverNode.id || l.target === hoverNode.id)
      .map((l) => ({
        partner: l.source === hoverNode.id ? l.target : l.source,
        value: l.value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [hoverNode, data.network.links])

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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">3D Movement Relationship Graph</h2>
          <p className="text-sm text-slate-400 mt-1">
            Movements in 3D space — colored by functional pattern. Node size = frequency. Links = co-occurrence.
            {selectedNode && (
              <span className="text-blue-400 ml-2">
                Filtering: {data.movementDisplay[selectedNode] || selectedNode}
                <button onClick={() => setSelectedNode(null)} className="ml-2 text-rose-400 hover:text-rose-300">[clear]</button>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-1 bg-[#12121a] rounded-lg p-1 border border-[#1e1e3a]">
          <button onClick={() => setColorMode('function')} className={`px-3 py-1 text-[10px] rounded ${colorMode === 'function' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400'}`}>
            Functional Pattern
          </button>
          <button onClick={() => setColorMode('modality')} className={`px-3 py-1 text-[10px] rounded ${colorMode === 'modality' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400'}`}>
            M / G / W
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-[#08080f] rounded-xl border border-[#1e1e3a] overflow-hidden relative" style={{ height: 'calc(100vh - 180px)' }}>
          <ForceGraph
            ref={fgRef}
            graphData={graphData}
            backgroundColor="#08080f"
            nodeLabel={(node: any) => `
              <div style="background:#1e1e3a;padding:8px 12px;border-radius:8px;border:1px solid #2a2a5a;font-size:12px;max-width:220px">
                <div style="font-weight:600;color:#fff">${node.label}</div>
                <div style="color:#94a3b8;margin-top:2px">${node.pattern}</div>
                <div style="color:#60a5fa;margin-top:2px">${node.count.toLocaleString()} appearances</div>
              </div>
            `}
            nodeColor={(node: any) => {
              if (selectedNode === node.id) return '#ffffff'
              return colorMode === 'function'
                ? node.patternColor
                : (node.modality === 'M' ? '#ff6b6b' : node.modality === 'G' ? '#51cf66' : '#339af0')
            }}
            nodeOpacity={0.9}
            nodeResolution={16}
            linkWidth={(link: any) => (link.value / maxLink) * 4 + 0.3}
            linkColor={() => '#ffffff18'}
            linkOpacity={0.4}
            onNodeClick={handleNodeClick}
            onNodeHover={(node: any) => setHoverNode(node)}
            enableNodeDrag={true}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-[#0d0d1a]/90 backdrop-blur-sm rounded-lg p-3 border border-[#1e1e3a] max-h-[300px] overflow-y-auto">
            <div className="text-[9px] text-slate-500 mb-2 uppercase tracking-wider">
              {colorMode === 'function' ? 'Functional Pattern' : 'Modality'}
            </div>
            {colorMode === 'function' ? (
              patterns.map(([label, color]) => (
                <div key={label} className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  {label}
                </div>
              ))
            ) : (
              [
                { label: 'Monostructural', color: '#ff6b6b' },
                { label: 'Gymnastics', color: '#51cf66' },
                { label: 'Weightlifting', color: '#339af0' },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                  {m.label}
                </div>
              ))
            )}
          </div>

          <div className="absolute top-4 right-4 bg-[#0d0d1a]/90 backdrop-blur-sm rounded-lg p-3 border border-[#1e1e3a] text-[10px] text-slate-500">
            <div>Drag to rotate</div>
            <div>Scroll to zoom</div>
            <div>Click node to isolate</div>
          </div>
        </div>

        {/* Info panel */}
        {hoverNode && (
          <div className="w-72 shrink-0 bg-[#12121a] rounded-xl border border-[#1e1e3a] p-5 self-start">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-4 h-4 rounded-full" style={{ background: hoverNode.patternColor }} />
              <h3 className="text-lg font-bold text-white">{hoverNode.label}</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Functional Pattern</div>
                <div className="text-sm text-slate-300">{hoverNode.pattern}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">All Patterns</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(MOVEMENT_TAXONOMY[hoverNode.id]?.functionalPattern || []).map((p: FunctionalPattern) => (
                    <span key={p} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: FUNCTIONAL_PATTERN_COLORS[p] + '20', color: FUNCTIONAL_PATTERN_COLORS[p] }}>
                      {FUNCTIONAL_PATTERN_LABELS[p]}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Appearances</div>
                <div className="text-2xl font-bold font-mono text-blue-400">{hoverNode.count.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Physical Skills</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(MOVEMENT_TAXONOMY[hoverNode.id]?.physicalSkills || []).map((s: string) => (
                    <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a3a] text-slate-300">
                      {s.split('-').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Top Partners</div>
                {nodePartners.map((p) => (
                  <div key={p.partner} className="flex justify-between items-center py-1 border-b border-[#1e1e3a] last:border-0">
                    <span className="text-xs text-slate-300">{data.movementDisplay[p.partner] || p.partner}</span>
                    <span className="text-xs font-mono text-slate-500">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
