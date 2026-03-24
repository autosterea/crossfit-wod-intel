import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CrossFitData } from '../types'

function getHeatmapColor(value: number, maxValue: number): THREE.Color {
  const t = value / maxValue
  if (t < 0.05) return new THREE.Color('#2a4a8f')
  if (t < 0.15) return new THREE.Color('#3b6fe0')
  if (t < 0.3) return new THREE.Color('#00c2ff')
  if (t < 0.45) return new THREE.Color('#00e5a0')
  if (t < 0.6) return new THREE.Color('#a0ff00')
  if (t < 0.75) return new THREE.Color('#ffe600')
  if (t < 0.88) return new THREE.Color('#ff8c00')
  return new THREE.Color('#ff2d55')
}

function InstancedBars({ data }: { data: CrossFitData }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const [hovered, setHovered] = useState<{ label: string; value: number; pos: THREE.Vector3 } | null>(null)
  const { camera, raycaster, pointer } = useThree()

  const { count, positions, colors, scales, labels, values } = useMemo(() => {
    const { movements, matrix } = data.cooccurMatrix
    const n = movements.length
    let maxVal = 0
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (matrix[i][j] > maxVal) maxVal = matrix[i][j]

    const positions: [number, number, number][] = []
    const colors: THREE.Color[] = []
    const scales: [number, number, number][] = []
    const labels: string[] = []
    const values: number[] = []

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = matrix[i][j]
        if (val <= 0) continue
        const h = (val / maxVal) * 12 + 0.05
        positions.push([i - n / 2, h / 2, j - n / 2])
        scales.push([0.78, h, 0.78])
        values.push(val)
        colors.push(getHeatmapColor(val, maxVal))
        const nameI = data.movementDisplay[movements[i]] || movements[i]
        const nameJ = data.movementDisplay[movements[j]] || movements[j]
        labels.push(i === j ? `${nameI} (self)` : `${nameI} × ${nameJ}`)
      }
    }
    return { count: positions.length, positions, colors, scales, labels, values }
  }, [data])

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
    meshRef.current.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorAttr, 3))
  }, [count, positions, scales, colors])

  const handlePointerMove = useCallback((e: any) => {
    if (!meshRef.current) return
    e.stopPropagation()
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current)
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const idx = intersects[0].instanceId
      const pos = new THREE.Vector3(...positions[idx])
      pos.y = scales[idx][1] + 0.7
      setHovered({ label: labels[idx], value: values[idx], pos })
    } else {
      setHovered(null)
    }
  }, [camera, raycaster, pointer, positions, scales, labels, values])

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} onPointerMove={handlePointerMove} onPointerOut={() => setHovered(null)}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial vertexColors toneMapped={false} metalness={0.3} roughness={0.35} emissive={new THREE.Color('#ffffff')} emissiveIntensity={0.35} />
      </instancedMesh>
      {hovered && (
        <Html position={[hovered.pos.x, hovered.pos.y, hovered.pos.z]} center>
          <div className="bg-[#1a1a2e]/95 border border-[#3a3a6a] rounded-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none">
            <div className="font-medium text-white">{hovered.label}</div>
            <div className="text-blue-400 font-mono mt-0.5">{hovered.value.toLocaleString()}</div>
          </div>
        </Html>
      )}
    </>
  )
}

export default function Heatmap3DScene({ data }: { data: CrossFitData }) {
  return (
    <div className="bg-[#08080f] rounded-xl border border-[#1e1e3a] overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
      <Canvas camera={{ position: [22, 18, 22], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[20, 35, 20]} intensity={2.5} color="#ffffff" />
        <pointLight position={[-15, 25, -15]} intensity={1.0} color="#60a5fa" />
        <pointLight position={[15, 20, -20]} intensity={0.8} color="#a78bfa" />
        <InstancedBars data={data} />
        <gridHelper args={[40, 30, '#1e3a5f', '#0f172a']} position={[0, -0.01, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[42, 42]} />
          <meshStandardMaterial color="#060610" transparent opacity={0.92} />
        </mesh>
        <OrbitControls enablePan enableZoom enableRotate minDistance={12} maxDistance={55} maxPolarAngle={Math.PI / 2.1} target={[0, 2, 0]} />
      </Canvas>
    </div>
  )
}
