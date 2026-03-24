import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import ForceGraph from 'react-force-graph-3d'
import * as THREE from 'three'
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

function getModalityColor(modality: string): string {
  if (modality === 'M') return '#ff6b6b'
  if (modality === 'G') return '#51cf66'
  return '#339af0'
}

export default function ForceGraph3DView({ data }: { data: CrossFitData }) {
  const fgRef = useRef<any>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoverNode, setHoverNode] = useState<any>(null)
  const [colorMode, setColorMode] = useState<'function' | 'modality'>('function')

  const maxCount = Math.max(...data.network.nodes.map((n) => n.count))
  const maxLink = Math.max(...data.network.links.map((l) => l.value))

  // Calculate median count for label visibility threshold
  const medianCount = useMemo(() => {
    const sorted = [...data.network.nodes.map((n) => n.count)].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }, [data.network.nodes])

  // Calculate link value percentiles for color banding
  const linkPercentiles = useMemo(() => {
    const sorted = [...data.network.links.map((l) => l.value)].sort((a, b) => a - b)
    return {
      p25: sorted[Math.floor(sorted.length * 0.25)] || 0,
      p75: sorted[Math.floor(sorted.length * 0.75)] || 0,
    }
  }, [data.network.links])

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

  // Link color function based on value percentiles and selection
  const linkColor = useCallback((link: any) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source
    const targetId = typeof link.target === 'object' ? link.target.id : link.target

    if (selectedNode && (sourceId === selectedNode || targetId === selectedNode)) {
      return '#ffffff'
    }

    if (link.value >= linkPercentiles.p75) return '#60a5fa'
    if (link.value >= linkPercentiles.p25) return '#3b82f6'
    return '#1e3a5f'
  }, [selectedNode, linkPercentiles])

  // Link width scaled from 1 to 10
  const linkWidth = useCallback((link: any) => {
    return (link.value / maxLink) * 9 + 1
  }, [maxLink])

  // Custom node THREE.js objects with glow and labels
  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group()

    const nodeColor = colorMode === 'function'
      ? node.patternColor
      : getModalityColor(node.modality)

    // Main sphere
    const radius = node.val * 0.15
    const geometry = new THREE.SphereGeometry(radius, 16, 16)
    const material = new THREE.MeshStandardMaterial({
      color: nodeColor,
      emissive: nodeColor,
      emissiveIntensity: selectedNode === node.id ? 0.8 : 0.3,
      roughness: 0.3,
      metalness: 0.1,
    })
    const sphere = new THREE.Mesh(geometry, material)
    group.add(sphere)

    // Glow halo
    const glowRadius = node.val * 0.25
    const glowGeo = new THREE.SphereGeometry(glowRadius, 16, 16)
    const glowMat = new THREE.MeshBasicMaterial({
      color: nodeColor,
      transparent: true,
      opacity: selectedNode === node.id ? 0.25 : 0.1,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    group.add(glow)

    // Text label for nodes above median count
    if (node.count > medianCount) {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = 256
      canvas.height = 64
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.font = 'bold 24px Inter, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(node.label.substring(0, 18), 128, 32)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.position.y = node.val * 0.3 + 3
      sprite.scale.set(12, 3, 1)
      group.add(sprite)
    }

    return group
  }, [colorMode, selectedNode, medianCount])

  // Add scene lighting after engine initializes
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return

    const tryAddLights = () => {
      const scene = fg.scene?.()
      if (!scene) return

      // Check if we already added lights
      const existingLight = scene.getObjectByName('custom-ambient')
      if (existingLight) return

      // Ambient light for base illumination
      const ambient = new THREE.AmbientLight(0x4488cc, 0.6)
      ambient.name = 'custom-ambient'
      scene.add(ambient)

      // Directional light for depth
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
      dirLight.name = 'custom-dir'
      dirLight.position.set(100, 200, 150)
      scene.add(dirLight)

      // Secondary directional for fill
      const fillLight = new THREE.DirectionalLight(0x6688cc, 0.4)
      fillLight.name = 'custom-fill'
      fillLight.position.set(-100, -50, -100)
      scene.add(fillLight)

      // Point light at center for inner glow
      const pointLight = new THREE.PointLight(0x3366ff, 0.5, 500)
      pointLight.name = 'custom-point'
      pointLight.position.set(0, 0, 0)
      scene.add(pointLight)
    }

    // The scene may not be ready immediately, try after a small delay
    const timer = setTimeout(tryAddLights, 500)
    return () => clearTimeout(timer)
  }, [graphData])

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
        <div className="flex-1 bg-[#0a1628] rounded-xl border border-[#1e3a5f]/40 overflow-hidden relative" style={{ height: 'calc(100vh - 180px)' }}>
          <ForceGraph
            ref={fgRef}
            graphData={graphData}
            backgroundColor="#0a1628"
            nodeThreeObject={nodeThreeObject}
            nodeThreeObjectExtend={false}
            nodeLabel={(node: any) => `
              <div style="background:rgba(15,25,50,0.95);padding:10px 14px;border-radius:10px;border:1px solid rgba(59,130,246,0.3);font-size:12px;max-width:220px;box-shadow:0 8px 32px rgba(0,0,0,0.4)">
                <div style="font-weight:600;color:#fff;font-size:13px">${node.label}</div>
                <div style="color:#94a3b8;margin-top:4px">${node.pattern}</div>
                <div style="color:#60a5fa;margin-top:4px;font-weight:500">${node.count.toLocaleString()} appearances</div>
              </div>
            `}
            linkColor={linkColor}
            linkOpacity={0.6}
            linkWidth={linkWidth}
            onNodeClick={handleNodeClick}
            onNodeHover={(node: any) => setHoverNode(node)}
            enableNodeDrag={true}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-[#0c1a2e]/90 backdrop-blur-sm rounded-lg p-3 border border-[#1e3a5f]/50 max-h-[300px] overflow-y-auto">
            <div className="text-[9px] text-slate-400 mb-2 uppercase tracking-wider font-semibold">
              {colorMode === 'function' ? 'Functional Pattern' : 'Modality'}
            </div>
            {colorMode === 'function' ? (
              patterns.map(([label, color]) => (
                <div key={label} className="flex items-center gap-2 text-[10px] text-slate-300 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
                  {label}
                </div>
              ))
            ) : (
              [
                { label: 'Monostructural', color: '#ff6b6b' },
                { label: 'Gymnastics', color: '#51cf66' },
                { label: 'Weightlifting', color: '#339af0' },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2 text-[10px] text-slate-300 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}60` }} />
                  {m.label}
                </div>
              ))
            )}
          </div>

          {/* Controls hint */}
          <div className="absolute top-4 right-4 bg-[#0c1a2e]/90 backdrop-blur-sm rounded-lg p-3 border border-[#1e3a5f]/50 text-[10px] text-slate-400">
            <div>Scroll to zoom</div>
            <div>Click to isolate</div>
            <div>Drag to rotate</div>
          </div>
        </div>

        {/* Info panel */}
        {hoverNode && (
          <div className="w-72 shrink-0 rounded-xl p-[1px] self-start" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(99,102,241,0.15), rgba(30,58,95,0.3))' }}>
            <div className="bg-[#0c1a2e] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 rounded-full" style={{ background: hoverNode.patternColor, boxShadow: `0 0 10px ${hoverNode.patternColor}50` }} />
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
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a2a4a] text-slate-300">
                        {s.split('-').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Top Partners</div>
                  {nodePartners.map((p) => (
                    <div key={p.partner} className="flex justify-between items-center py-1 border-b border-[#1e3a5f]/40 last:border-0">
                      <span className="text-xs text-slate-300">{data.movementDisplay[p.partner] || p.partner}</span>
                      <span className="text-xs font-mono text-slate-500">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
