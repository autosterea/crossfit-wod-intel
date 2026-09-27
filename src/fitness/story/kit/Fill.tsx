import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { lin, makeFillMaterial, type FillMode } from './materials'

/* =========================================================================
   <AreaFill/> (DESIGN.md B.9 "Fill", C.11): an area strip between a bottom
   edge (a constant baseline, or a second curve) and a top edge. aT runs 0 at
   the bottom to 1 at the data edge (the chalk-dust gradient), aU runs 0..1
   along x (the sweep reveal), aH is the column height (the rim band).
   `level` pours: fragments above it are hidden (the LOW-tier pour).

   <AreaStrips/>: several strips (for example one translucent curtain per
   domain curve, each at its own depth) in ONE draw call, coloured per strip.
   ========================================================================= */

export interface AreaFillProps {
  /** top edge as x, y pairs (world, in the parent's space) */
  top: Float32Array
  baseline: number
  /** optional bottom edge: one y per top point (a band between two curves) */
  bottom?: Float32Array
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
  /** gradient alpha range (default 0.06 .. 0.50); hatch and solid use hi */
  lo?: number
  hi?: number
  /** additive blending (a luminous area) */
  additive?: boolean
  /** HDR rim band under the top edge: colour x (1 + rim(T)); 0 = off */
  rim?: (T: number) => number
  /** rim band width in world units (default 0.12) */
  rimWidth?: number
  /** gradient exponent: alpha = mix(lo, hi, aT ^ gamma) (default 1) */
  gamma?: number
}

function buildGeometry(top: Float32Array, baseline: number, bottom: Float32Array | undefined, z: number): THREE.BufferGeometry {
  const n = top.length / 2
  const pos = new Float32Array(n * 2 * 3)
  const aT = new Float32Array(n * 2)
  const aU = new Float32Array(n * 2)
  const aH = new Float32Array(n * 2)
  const idx: number[] = []
  for (let i = 0; i < n; i++) {
    const x = top[i * 2]
    const y = top[i * 2 + 1]
    const b = bottom ? Math.min(bottom[i], y) : baseline
    pos.set([x, b, z, x, y, z], i * 6)
    aT[i * 2] = 0
    aT[i * 2 + 1] = 1
    aU[i * 2] = aU[i * 2 + 1] = n > 1 ? i / (n - 1) : 0
    aH[i * 2] = aH[i * 2 + 1] = y - b
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
  const ha = new THREE.BufferAttribute(aH, 1)
  ha.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('aH', ha)
  g.setIndex(idx)
  return g
}

export function AreaFill({
  top,
  baseline,
  bottom,
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
  additive = false,
  rim,
  rimWidth,
  gamma,
}: AreaFillProps) {
  const topBuf = useMemo(() => top.slice(), [top])
  const geometry = useMemo(() => buildGeometry(topBuf, baseline, bottom, z), [topBuf, baseline, bottom, z])
  const material = useMemo(() => makeFillMaterial(color, mode, { additive }), [color, mode, additive])
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
      const ha = geometry.attributes.aH as THREE.BufferAttribute
      const arr = pa.array as Float32Array
      const h = ha.array as Float32Array
      const n = topBuf.length / 2
      for (let i = 0; i < n; i++) {
        arr[i * 6] = arr[i * 6 + 3] = topBuf[i * 2]
        arr[i * 6 + 4] = topBuf[i * 2 + 1]
        h[i * 2] = h[i * 2 + 1] = arr[i * 6 + 4] - arr[i * 6 + 1]
      }
      pa.needsUpdate = true
      ha.needsUpdate = true
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
    u.uRim.value = rim ? rim(T) : 0
    if (rimWidth !== undefined) u.uRimW.value = rimWidth
    if (gamma !== undefined) u.uPow.value = gamma
  })
  return <primitive object={mesh} />
}

/* ------------------------------ strips ------------------------------- */

export interface AreaStripsProps {
  /** number of strips and points per strip */
  strips: number
  points: number
  /** one hex colour per strip */
  colors: readonly string[]
  /**
   * Write strip s, point i as xyz into `top` at ((s * points) + i) * 3 and its
   * bottom y into `bottom` at (s * points) + i. Return true when anything changed.
   */
  write: (T: number, top: Float32Array, bottom: Float32Array) => boolean
  opacity?: (T: number) => number
  lo?: number
  hi?: number
  gamma?: number
  additive?: boolean
  renderOrder?: number
}

export function AreaStrips({ strips, points, colors, write, opacity, lo, hi, gamma, additive = false, renderOrder = 10 }: AreaStripsProps) {
  const bufs = useMemo(() => ({ top: new Float32Array(strips * points * 3), bottom: new Float32Array(strips * points) }), [strips, points])
  const geometry = useMemo(() => {
    const nv = strips * points * 2
    const pos = new Float32Array(nv * 3)
    const aT = new Float32Array(nv)
    const aU = new Float32Array(nv)
    const aH = new Float32Array(nv)
    const col = new Float32Array(nv * 3)
    const idx: number[] = []
    for (let s = 0; s < strips; s++) {
      const c = lin(colors[s] ?? '#eef3f6')
      for (let i = 0; i < points; i++) {
        const v = (s * points + i) * 2
        aT[v] = 0
        aT[v + 1] = 1
        aU[v] = aU[v + 1] = points > 1 ? i / (points - 1) : 0
        col.set([c.r, c.g, c.b, c.r, c.g, c.b], v * 3)
        if (i < points - 1) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3)
      }
    }
    const g = new THREE.BufferGeometry()
    const pa = new THREE.BufferAttribute(pos, 3)
    pa.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', pa)
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
    g.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
    const ha = new THREE.BufferAttribute(aH, 1)
    ha.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aH', ha)
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setIndex(idx)
    return g
  }, [strips, points, colors])
  const material = useMemo(() => makeFillMaterial('#ffffff', 'gradient', { vertexColors: true, additive }), [additive])
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
    const op = opacity ? opacity(T) : 1
    mesh.visible = op > 0.002
    if (!mesh.visible) return
    if (write(T, bufs.top, bufs.bottom)) {
      const pa = geometry.attributes.position as THREE.BufferAttribute
      const ha = geometry.attributes.aH as THREE.BufferAttribute
      const p = pa.array as Float32Array
      const h = ha.array as Float32Array
      const n = strips * points
      for (let k = 0; k < n; k++) {
        const x = bufs.top[k * 3]
        const y = bufs.top[k * 3 + 1]
        const z = bufs.top[k * 3 + 2]
        const b = Math.min(bufs.bottom[k], y)
        const v = k * 2
        p[v * 3] = x
        p[v * 3 + 1] = b
        p[v * 3 + 2] = z
        p[v * 3 + 3] = x
        p[v * 3 + 4] = y
        p[v * 3 + 5] = z
        h[v] = h[v + 1] = y - b
      }
      pa.needsUpdate = true
      ha.needsUpdate = true
    }
    const u = material.uniforms
    u.uOpacity.value = op
    if (lo !== undefined) u.uLo.value = lo
    if (hi !== undefined) u.uHi.value = hi
    if (gamma !== undefined) u.uPow.value = gamma
  })
  return <primitive object={mesh} />
}
