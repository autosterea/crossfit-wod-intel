import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CrossFitData } from '../types'

// ── Heatmap color gradient based on normalized value ──
function getHeatmapColor(value: number, maxValue: number): THREE.Color {
  const t = value / maxValue
  if (t < 0.1) return new THREE.Color('#1e3a5f')
  if (t < 0.25) return new THREE.Color('#2563eb')
  if (t < 0.4) return new THREE.Color('#06b6d4')
  if (t < 0.6) return new THREE.Color('#22c55e')
  if (t < 0.75) return new THREE.Color('#eab308')
  if (t < 0.9) return new THREE.Color('#f97316')
  return new THREE.Color('#ef4444')
}

// ── Camera presets ──
const CAMERA_PRESETS: Record<string, [number, number, number]> = {
  Isometric: [22, 18, 22],
  'Top Down': [0, 35, 0.1],
  Front: [0, 12, 30],
  Side: [30, 12, 0],
}

// ── Helper to smoothly animate camera to a target position ──
function CameraController({ targetPosition }: { targetPosition: [number, number, number] | null }) {
  const { camera } = useThree()
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (!targetPosition) return

    // Cancel any running animation
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)

    const start = new THREE.Vector3().copy(camera.position)
    const end = new THREE.Vector3(...targetPosition)
    const duration = 800
    const startTime = performance.now()

    function animate() {
      const elapsed = performance.now() - startTime
      const t = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3)
      camera.position.lerpVectors(start, end, ease)
      camera.lookAt(0, 2, 0)
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        animRef.current = null
      }
    }
    animRef.current = requestAnimationFrame(animate)

    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    }
  }, [targetPosition, camera])

  return null
}

// ── Grid floor with subtle lines ──
function GridFloor() {
  const gridRef = useRef<THREE.GridHelper>(null!)

  useEffect(() => {
    if (gridRef.current) {
      // Ensure grid renders below bars
      gridRef.current.position.y = -0.01
    }
  }, [])

  return (
    <group>
      {/* Subtle grid lines */}
      <gridHelper ref={gridRef} args={[40, 30, '#1e3a5f', '#0f172a']} />
      {/* Semi-transparent dark ground plane underneath */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[42, 42]} />
        <meshStandardMaterial color="#060610" transparent opacity={0.92} />
      </mesh>
    </group>
  )
}

// ── Instanced bars — all bars in one draw call ──
function InstancedBars({ data }: { data: CrossFitData }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const [hovered, setHovered] = useState<{
    idx: number
    label: string
    value: number
    pos: THREE.Vector3
    movI: string
    movJ: string
  } | null>(null)
  const { camera, raycaster, pointer } = useThree()

  const { count, positions, colors, scales, labels, values, maxVal, movementIndices } = useMemo(() => {
    const { movements, matrix } = data.cooccurMatrix
    const n = movements.length
    let maxVal = 0
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (matrix[i][j] > maxVal) maxVal = matrix[i][j]

    const positions: [number, number, number][] = []
    const colors: THREE.Color[] = []
    const scales: [number, number, number][] = []
    const labels: string[] = []
    const values: number[] = []
    const movementIndices: [number, number][] = []

    const heightScale = 12

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = matrix[i][j]
        if (val <= 0) continue

        const h = (val / maxVal) * heightScale + 0.05
        const x = i - n / 2
        const z = j - n / 2

        positions.push([x, h / 2, z])
        scales.push([0.78, h, 0.78])
        values.push(val)
        movementIndices.push([i, j])

        // Heatmap color based on value
        colors.push(getHeatmapColor(val, maxVal))

        const nameI = data.movementDisplay[movements[i]] || movements[i]
        const nameJ = data.movementDisplay[movements[j]] || movements[j]
        labels.push(i === j ? `${nameI} (self)` : `${nameI} × ${nameJ}`)
      }
    }

    return { count: positions.length, positions, colors, scales, labels, values, maxVal, movementIndices }
  }, [data])

  // Set up instance transforms and colors
  useEffect(() => {
    if (!meshRef.current) return
    const dummy = new THREE.Object3D()
    const colorAttr = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      dummy.position.set(...positions[i])
      dummy.scale.set(...scales[i])
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)

      const c = colors[i]
      colorAttr[i * 3] = c.r
      colorAttr[i * 3 + 1] = c.g
      colorAttr[i * 3 + 2] = c.b
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.geometry.setAttribute(
      'color',
      new THREE.InstancedBufferAttribute(colorAttr, 3)
    )
  }, [count, positions, scales, colors])

  // Hover detection
  const handlePointerMove = useCallback(
    (e: any) => {
      if (!meshRef.current) return
      e.stopPropagation()

      raycaster.setFromCamera(pointer, camera)
      const intersects = raycaster.intersectObject(meshRef.current)

      if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        const idx = intersects[0].instanceId
        const pos = new THREE.Vector3(...positions[idx])
        pos.y = scales[idx][1] + 0.7
        const movements = data.cooccurMatrix.movements
        const [mi, mj] = movementIndices[idx]
        setHovered({
          idx,
          label: labels[idx],
          value: values[idx],
          pos,
          movI: data.movementDisplay[movements[mi]] || movements[mi],
          movJ: data.movementDisplay[movements[mj]] || movements[mj],
        })
      } else {
        setHovered(null)
      }
    },
    [camera, raycaster, pointer, positions, scales, labels, values, movementIndices, data]
  )

  const pctOfMax = hovered ? ((hovered.value / maxVal) * 100).toFixed(0) : '0'

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onPointerMove={handlePointerMove}
        onPointerOut={() => setHovered(null)}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          toneMapped={false}
          metalness={0.15}
          roughness={0.55}
          emissive={new THREE.Color('#ffffff')}
          emissiveIntensity={0.1}
        />
      </instancedMesh>

      {/* Tooltip */}
      {hovered && (
        <Html position={[hovered.pos.x, hovered.pos.y, hovered.pos.z]} center>
          <div
            className="pointer-events-none select-none"
            style={{
              background: 'rgba(8, 8, 20, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '10px',
              padding: '10px 14px',
              backdropFilter: 'blur(12px)',
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 12px rgba(99,102,241,0.15)',
              minWidth: '160px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>
              {hovered.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#818cf8', fontFamily: 'monospace' }}>
                {hovered.value.toLocaleString()}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {hovered.label.includes('self') ? 'appearances' : 'co-occurrences'}
              </span>
            </div>
            <div
              style={{
                marginTop: '4px',
                height: '3px',
                borderRadius: '2px',
                background: `linear-gradient(90deg, #1e3a5f, #2563eb, #06b6d4, #22c55e, #eab308, #f97316, #ef4444)`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${pctOfMax}%`,
                  top: '-3px',
                  width: '6px',
                  height: '9px',
                  borderRadius: '3px',
                  background: '#fff',
                  transform: 'translateX(-50%)',
                  boxShadow: '0 0 4px rgba(255,255,255,0.5)',
                }}
              />
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', textAlign: 'right' }}>
              {pctOfMax}% of peak
            </div>
          </div>
        </Html>
      )}

      {/* Axis edge labels */}
      <Html position={[data.cooccurMatrix.movements.length / 2 + 1.5, 0.2, 0]} center>
        <div
          style={{
            color: '#475569',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}
        >
          Movements &darr;
        </div>
      </Html>
      <Html position={[0, 0.2, data.cooccurMatrix.movements.length / 2 + 1.5]} center>
        <div
          style={{
            color: '#475569',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          Movements &rarr;
        </div>
      </Html>
    </>
  )
}

// ── Scene — lighting + bars + floor + controls ──
function Scene({
  data,
  cameraTarget,
}: {
  data: CrossFitData
  cameraTarget: [number, number, number] | null
}) {
  return (
    <>
      {/* Dramatic multi-light setup */}
      <ambientLight intensity={0.25} />
      <pointLight position={[20, 35, 20]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-15, 20, -15]} intensity={0.6} color="#3b82f6" />
      <pointLight position={[15, 15, -20]} intensity={0.4} color="#8b5cf6" />

      <InstancedBars data={data} />
      <GridFloor />
      <CameraController targetPosition={cameraTarget} />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate={false}
        minDistance={10}
        maxDistance={55}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 2, 0]}
      />
    </>
  )
}

// ── Color legend gradient bar ──
function ColorLegend() {
  return (
    <div
      className="absolute bottom-4 left-4 backdrop-blur-md rounded-xl border border-[#1e293b]/60"
      style={{
        background: 'rgba(8, 8, 20, 0.88)',
        padding: '14px 18px',
        minWidth: '220px',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '10px',
          fontWeight: 600,
        }}
      >
        Co-occurrence Intensity
      </div>
      {/* Gradient bar */}
      <div
        style={{
          height: '10px',
          borderRadius: '5px',
          background: 'linear-gradient(90deg, #1e3a5f, #2563eb, #06b6d4, #22c55e, #eab308, #f97316, #ef4444)',
          boxShadow: '0 0 12px rgba(99,102,241,0.15)',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>Low</span>
        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>Medium</span>
        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>High</span>
      </div>
    </div>
  )
}

// ── Camera preset buttons ──
function CameraButtons({
  activePreset,
  onSelect,
}: {
  activePreset: string
  onSelect: (name: string) => void
}) {
  return (
    <div
      className="absolute top-4 left-4 backdrop-blur-md rounded-xl border border-[#1e293b]/60"
      style={{
        background: 'rgba(8, 8, 20, 0.88)',
        padding: '10px',
        display: 'flex',
        gap: '6px',
      }}
    >
      {Object.keys(CAMERA_PRESETS).map((name) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.2s ease',
            background: activePreset === name ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.5)',
            color: activePreset === name ? '#a5b4fc' : '#94a3b8',
            outline: activePreset === name ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
          }}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

// ── Hint overlay ──
function HintOverlay() {
  return (
    <div
      className="absolute top-4 right-4 backdrop-blur-md rounded-xl border border-[#1e293b]/60"
      style={{
        background: 'rgba(8, 8, 20, 0.88)',
        padding: '12px 16px',
      }}
    >
      <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#64748b' }}>&#x1f5b1;</span> Drag to rotate
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#64748b' }}>&#x2195;</span> Scroll to zoom
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#64748b' }}>&#x25CB;</span> Hover for details
        </div>
      </div>
    </div>
  )
}

// ── Main exported component ──
export default function Heatmap3D({ data }: { data: CrossFitData }) {
  const [activePreset, setActivePreset] = useState('Isometric')
  const [cameraTarget, setCameraTarget] = useState<[number, number, number] | null>(null)

  const handlePresetSelect = useCallback((name: string) => {
    setActivePreset(name)
    setCameraTarget(CAMERA_PRESETS[name])
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">3D Co-occurrence Terrain</h2>
        <p className="text-sm text-slate-400 mt-1">
          Movement pairings as a 3D heatmap. Taller, warmer-colored peaks indicate movements that appear
          together more often. Hover over bars for details.
        </p>
      </div>

      <div
        className="rounded-xl border border-[#1e1e3a] overflow-hidden relative"
        style={{ height: 'calc(100vh - 160px)', background: '#06060e' }}
      >
        <Canvas
          camera={{ position: [22, 18, 22], fov: 50 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor('#06060e')
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.1
          }}
        >
          <Scene data={data} cameraTarget={cameraTarget} />
        </Canvas>

        <CameraButtons activePreset={activePreset} onSelect={handlePresetSelect} />
        <HintOverlay />
        <ColorLegend />
      </div>
    </div>
  )
}
