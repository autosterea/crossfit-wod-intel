import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { makeFillMaterial, type FillMode } from './materials'

/* =========================================================================
   <AreaFill/> (DESIGN.md B.9 "Fill", C.11): an area strip between a baseline
   and a top edge. aT runs 0 at the baseline to 1 at the data edge (the
   chalk-dust gradient), aU runs 0..1 along x (the sweep reveal). `level`
   pours: fragments above it are discarded (the LOW-tier pour).
   ========================================================================= */

export interface AreaFillProps {
  /** top edge as x, y pairs (world, in the parent's space) */
  top: Float32Array
  baseline: number
  z?: number
  color: string
  mode?: FillMode
  reveal?: (T: number) => number
  /** world-y level (parent space); fragments above it are hidden */
  level?: (T: number) => number
  opacity?: (T: number) => number
  renderOrder?: number
  /** mutate the top edge in place; return true when it changed */
  update?: (T: number, top: Float32Array) => boolean
  /** gradient alpha range (default 0.06 .. 0.50) */
  lo?: number
  hi?: number
}

function buildGeometry(top: Float32Array, baseline: number, z: number): THREE.BufferGeometry {
  const n = top.length / 2
  const pos = new Float32Array(n * 2 * 3)
  const aT = new Float32Array(n * 2)
  const aU = new Float32Array(n * 2)
  const idx: number[] = []
  for (let i = 0; i < n; i++) {
    const x = top[i * 2]
    const y = top[i * 2 + 1]
    pos.set([x, baseline, z, x, y, z], i * 6)
    aT[i * 2] = 0
    aT[i * 2 + 1] = 1
    aU[i * 2] = aU[i * 2 + 1] = n > 1 ? i / (n - 1) : 0
    if (i < n - 1) {
      const a = i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  const pa = new THREE.BufferAttribute(pos, 3)
  pa.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('position', pa)
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  g.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
  g.setIndex(idx)
  return g
}

export function AreaFill({
  top,
  baseline,
  z = 0,
  color,
  mode = 'gradient',
  reveal,
  level,
  opacity,
  renderOrder = 10,
  update,
  lo,
  hi,
}: AreaFillProps) {
  const topBuf = useMemo(() => top.slice(), [top])
  const geometry = useMemo(() => buildGeometry(topBuf, baseline, z), [topBuf, baseline, z])
  const material = useMemo(() => makeFillMaterial(color, mode), [color, mode])
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geometry, material)
    m.frustumCulled = false
    m.renderOrder = renderOrder
    return m
  }, [geometry, material, renderOrder])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const T = clock.T
    if (update && update(T, topBuf)) {
      const pa = geometry.attributes.position as THREE.BufferAttribute
      const arr = pa.array as Float32Array
      const n = topBuf.length / 2
      for (let i = 0; i < n; i++) {
        arr[i * 6] = arr[i * 6 + 3] = topBuf[i * 2]
        arr[i * 6 + 4] = topBuf[i * 2 + 1]
      }
      pa.needsUpdate = true
    }
    const op = opacity ? opacity(T) : 1
    mesh.visible = op > 0.002
    if (!mesh.visible) return
    const u = material.uniforms
    u.uOpacity.value = op
    u.uReveal.value = reveal ? reveal(T) : 1
    u.uLevel.value = level ? level(T) : 1e6
    if (lo !== undefined) u.uLo.value = lo
    if (hi !== undefined) u.uHi.value = hi
  })
  return <primitive object={mesh} />
}
