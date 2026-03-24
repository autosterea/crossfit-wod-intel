import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CrossFitData } from '../types'
import { getNodeColor } from '../utils/colors'

// Single instanced mesh for all bars — massively better performance than individual meshes
function InstancedBars({ data }: { data: CrossFitData }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const [hovered, setHovered] = useState<{ idx: number; label: string; value: number; pos: THREE.Vector3 } | null>(null)
  const { camera, raycaster, pointer } = useThree()

  const { count, positions, colors, scales, labels, values } = useMemo(() => {
    const { movements, matrix } = data.cooccurMatrix
    const n = movements.length
    let maxVal = 0
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (matrix[i][j] > maxVal) maxVal = matrix[i][j]

    const positions: [number, number, number][] = []
    const colors: string[] = []
    const scales: [number, number, number][] = []
    const labels: string[] = []
    const values: number[] = []

    const heightScale = 10

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = matrix[i][j]
        if (val <= 0) continue
        const h = (val / maxVal) * heightScale + 0.05
        const x = i - n / 2
        const z = j - n / 2

        positions.push([x, h / 2, z])
        scales.push([0.8, h, 0.8])
        values.push(val)

        const modI = data.movementModality[movements[i]] || 'G'
        const modJ = data.movementModality[movements[j]] || 'G'
        if (i === j) {
          colors.push(getNodeColor(modI))
        } else {
          const c1 = new THREE.Color(getNodeColor(modI))
          const c2 = new THREE.Color(getNodeColor(modJ))
          colors.push(c1.lerp(c2, 0.5).getStyle())
        }

        const nameI = data.movementDisplay[movements[i]] || movements[i]
        const nameJ = data.movementDisplay[movements[j]] || movements[j]
        labels.push(i === j ? `${nameI} (self)` : `${nameI} × ${nameJ}`)
      }
    }

    return { count: positions.length, positions, colors, scales, labels, values }
  }, [data])

  // Set up instance matrices and colors
  useEffect(() => {
    if (!meshRef.current) return
    const dummy = new THREE.Object3D()
    const colorAttr = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      dummy.position.set(...positions[i])
      dummy.scale.set(...scales[i])
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)

      const c = new THREE.Color(colors[i])
      colorAttr[i * 3] = c.r
      colorAttr[i * 3 + 1] = c.g
      colorAttr[i * 3 + 2] = c.b
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorAttr, 3))
  }, [count, positions, scales, colors])

  // Hover detection via raycasting on click/hover
  const handlePointerMove = (e: any) => {
    if (!meshRef.current) return
    e.stopPropagation()

    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current)

    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const idx = intersects[0].instanceId
      const pos = new THREE.Vector3(...positions[idx])
      pos.y = scales[idx][1] + 0.5
      setHovered({ idx, label: labels[idx], value: values[idx], pos })
    } else {
      setHovered(null)
    }
  }

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onPointerMove={handlePointerMove}
        onPointerOut={() => setHovered(null)}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      {hovered && (
        <Html position={[hovered.pos.x, hovered.pos.y, hovered.pos.z]} center>
          <div className="bg-[#1e1e3a]/95 border border-[#3a3a5a] rounded-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none backdrop-blur-sm">
            <div className="font-medium text-white">{hovered.label}</div>
            <div className="text-blue-400 font-mono mt-0.5">{hovered.value.toLocaleString()} {hovered.label.includes('self') ? 'total appearances' : 'co-occurrences'}</div>
          </div>
        </Html>
      )}

      {/* Axis labels on the ground */}
      {data.cooccurMatrix.movements.map((mov, i) => {
        const n = data.cooccurMatrix.movements.length
        const label = (data.movementDisplay[mov] || mov).substring(0, 8)
        return (
          <group key={mov}>
            <Html position={[i - n / 2, -0.2, n / 2 + 1.2]} center>
              <div className="text-[8px] text-slate-500 -rotate-45 origin-left whitespace-nowrap pointer-events-none">{label}</div>
            </Html>
            <Html position={[-n / 2 - 1.2, -0.2, i - n / 2]} center>
              <div className="text-[8px] text-slate-500 rotate-45 origin-right whitespace-nowrap pointer-events-none">{label}</div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

function Scene({ data }: { data: CrossFitData }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[25, 30, 25]} intensity={1.2} />
      <pointLight position={[-20, 20, -20]} intensity={0.4} color="#60a5fa" />
      <pointLight position={[0, 25, 0]} intensity={0.3} color="#a855f7" />

      <InstancedBars data={data} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#080810" transparent opacity={0.9} />
      </mesh>

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate
        autoRotateSpeed={0.3}
        minDistance={12}
        maxDistance={55}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 2, 0]}
      />
    </>
  )
}

export default function Heatmap3D({ data }: { data: CrossFitData }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">3D Co-occurrence Terrain</h2>
        <p className="text-sm text-slate-400 mt-1">
          Movement pairings as a 3D landscape. Taller peaks = movements that appear together more often.
          Diagonal peaks = individual movement frequency. Hover over bars for details.
        </p>
      </div>

      <div className="bg-[#08080f] rounded-xl border border-[#1e1e3a] overflow-hidden relative" style={{ height: 'calc(100vh - 160px)' }}>
        <Canvas camera={{ position: [22, 18, 22], fov: 50 }}>
          <Scene data={data} />
        </Canvas>

        <div className="absolute top-4 right-4 bg-[#0d0d1a]/90 backdrop-blur-sm rounded-lg p-3 border border-[#1e1e3a] text-[10px] text-slate-500">
          <div>Drag to rotate</div>
          <div>Scroll to zoom</div>
          <div>Hover for details</div>
        </div>

        <div className="absolute bottom-4 left-4 bg-[#0d0d1a]/90 backdrop-blur-sm rounded-lg p-3 border border-[#1e1e3a]">
          <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Bar Color</div>
          {[
            { label: 'Monostructural', color: '#ff6b6b' },
            { label: 'Gymnastics', color: '#51cf66' },
            { label: 'Weightlifting', color: '#339af0' },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <div className="w-3 h-3 rounded" style={{ background: m.color }} />
              {m.label}
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-[#ff6b6b] to-[#339af0]" />
            Mixed (cross-modality pair)
          </div>
        </div>
      </div>
    </div>
  )
}
