import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import ForceGraph from 'react-force-graph-3d'
import * as THREE from 'three'
import type { CrossFitData } from '../types'
import { MOVEMENT_TAXONOMY, FUNCTIONAL_PATTERN_LABELS, FUNCTIONAL_PATTERN_COLORS } from '../data/movement-taxonomy'

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
  return modality === 'M' ? '#ff6b6b' : modality === 'G' ? '#51cf66' : '#339af0'
}

export default function ForceGraph3DScene({ data, colorMode }: { data: CrossFitData; colorMode: 'function' | 'modality' }) {
  const fgRef = useRef<any>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const maxCount = Math.max(...data.network.nodes.map((n) => n.count))
  const maxLink = Math.max(...data.network.links.map((l) => l.value))

  const graphData = useMemo(() => {
    const nodes = data.network.nodes.map((n) => ({
      id: n.id,
      label: data.movementDisplay[n.id] || n.label,
      modality: n.modality,
      count: n.count,
      val: (n.count / maxCount) * 30 + 4,
      patternColor: getMovementColor(n.id),
      pattern: getMovementPattern(n.id),
    }))
    let links = data.network.links.map((l) => ({ source: l.source, target: l.target, value: l.value }))
    if (selectedNode) links = links.filter((l) => l.source === selectedNode || l.target === selectedNode)
    return { nodes, links }
  }, [data, selectedNode, maxCount])

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode((prev: string | null) => (prev === node.id ? null : node.id))
    if (fgRef.current) {
      const dist = 200
      const r = 1 + dist / Math.hypot(node.x, node.y, node.z)
      fgRef.current.cameraPosition({ x: node.x * r, y: node.y * r, z: node.z * r }, node, 1500)
    }
  }, [])

  return (
    <div className="bg-[#0a1628] rounded-xl border border-[#1e2a4a] overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
      <ForceGraph
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#0a1628"
        nodeLabel={(node: any) => `<div style="background:#1a2a4a;padding:8px 12px;border-radius:8px;border:1px solid #2a3a5a;font-size:12px"><div style="font-weight:600;color:#fff">${node.label}</div><div style="color:#60a5fa;margin-top:2px">${node.count.toLocaleString()}</div></div>`}
        nodeColor={(node: any) => selectedNode === node.id ? '#ffffff' : colorMode === 'function' ? node.patternColor : getModalityColor(node.modality)}
        nodeOpacity={0.9}
        nodeResolution={16}
        linkWidth={(link: any) => Math.max(1, (link.value / maxLink) * 8)}
        linkColor={() => '#60a5fa40'}
        linkOpacity={0.5}
        onNodeClick={handleNodeClick}
        enableNodeDrag
        cooldownTicks={200}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
      />
    </div>
  )
}
