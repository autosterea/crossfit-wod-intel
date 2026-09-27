import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { PLATE_MAX, lin, makePlateMaterial } from './materials'

/* <Plates/>: faint glass plates (rounded rectangles with a 1 px border)
   behind groups that must read as ONE unit, for example each row of a
   ranked lineup. Up to 16 plates in one draw call. Rects are world-space
   [x0, y0, x1, y1] at depth z; `vis(T, i)` fades each plate in or out. */

export interface PlateSpec {
  rect: readonly [number, number, number, number]
  /** fill colour and alpha (default chalk at 0.04) */
  fill?: string
  fillAlpha?: number
  /** border colour and alpha (default chalk at 0.1) */
  line?: string
  lineAlpha?: number
}

export interface PlatesProps {
  plates: readonly PlateSpec[]
  /** corner radius in world units */
  radius?: number
  z?: number
  vis: (T: number, i: number) => number
  opacity?: (T: number) => number
  renderOrder?: number
}

export function Plates({ plates, radius = 0.2, z = -0.05, vis, opacity, renderOrder = 5 }: PlatesProps) {
  const n = Math.min(PLATE_MAX, plates.length)
  const geometry = useMemo(() => {
    const pos = new Float32Array(n * 4 * 3)
    const local = new Float32Array(n * 4 * 2)
    const half = new Float32Array(n * 4 * 3)
    const fill = new Float32Array(n * 4 * 4)
    const line = new Float32Array(n * 4 * 4)
    const aIdx = new Float32Array(n * 4)
    const idx: number[] = []
    for (let i = 0; i < n; i++) {
      const p = plates[i]
      const [x0, y0, x1, y1] = p.rect
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const hx = Math.abs(x1 - x0) / 2
      const hy = Math.abs(y1 - y0) / 2
      const r = Math.min(radius, hx, hy)
      // one quad with a little world slack so the antialiased edge is not clipped
      const e = 0.04
      const corners: [number, number][] = [
        [-hx - e, -hy - e],
        [hx + e, -hy - e],
        [hx + e, hy + e],
        [-hx - e, hy + e],
      ]
      const fc = lin(p.fill ?? '#eef3f6')
      const lc = lin(p.line ?? '#eef3f6')
      corners.forEach(([lx, ly], k) => {
        const v = i * 4 + k
        pos.set([cx + lx, cy + ly, z], v * 3)
        local.set([lx, ly], v * 2)
        half.set([hx, hy, r], v * 3)
        fill.set([fc.r, fc.g, fc.b, p.fillAlpha ?? 0.04], v * 4)
        line.set([lc.r, lc.g, lc.b, p.lineAlpha ?? 0.1], v * 4)
        aIdx[v] = i
      })
      const b = i * 4
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aLocal', new THREE.BufferAttribute(local, 2))
    g.setAttribute('aHalf', new THREE.BufferAttribute(half, 3))
    g.setAttribute('aFill', new THREE.BufferAttribute(fill, 4))
    g.setAttribute('aLine', new THREE.BufferAttribute(line, 4))
    g.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 1))
    g.setIndex(idx)
    return g
  }, [plates, n, radius, z])
  const material = useMemo(() => makePlateMaterial(), [])
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geometry, material)
    m.frustumCulled = false
    m.renderOrder = renderOrder
    return m
  }, [geometry, material, renderOrder])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    try {
      const T = clock.T
      const op = opacity ? opacity(T) : 1
      const u = material.uniforms
      const arr = u.uVis.value as number[]
      let any = false
      for (let i = 0; i < n; i++) {
        const v = Math.max(0, Math.min(1, vis(T, i)))
        arr[i] = v
        if (v > 0.001) any = true
      }
      u.uOpacity.value = op
      mesh.visible = any && op > 0.002
    } catch (err) {
      mesh.visible = false
      reportOnce('<Plates> vis', err)
    }
  })
  return <primitive object={mesh} />
}
