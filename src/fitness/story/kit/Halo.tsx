import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { makeGlowMaterial } from './materials'
import type { V3 } from '../types'

/* <Halo/> (DESIGN.md C.11): an additive glow point. It is the LOW-tier
   stand-in for bloom on the speaking element, and a soft accent elsewhere.
   Size in CSS px (constant on screen). */

export interface HaloProps {
  position: V3 | ((T: number) => V3)
  sizePx: number
  color: string
  intensity: (T: number) => number
}

export function Halo({ position, sizePx, color, intensity }: HaloProps) {
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const c = new THREE.Color(color)
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([c.r, c.g, c.b]), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([sizePx]), 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array([0]), 1))
    const p = new THREE.Points(g, makeGlowMaterial())
    p.frustumCulled = false
    p.renderOrder = 50
    return p
  }, [color, sizePx])
  useEffect(
    () => () => {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    },
    [obj],
  )
  useFrame(() => {
    try {
      const T = clock.T
      const k = intensity(T)
      obj.visible = k > 0.002
      if (!obj.visible) return
      const p = typeof position === 'function' ? position(T) : position
      const pa = obj.geometry.attributes.position as THREE.BufferAttribute
      pa.setXYZ(0, p[0], p[1], p[2])
      pa.needsUpdate = true
      const aa = obj.geometry.attributes.aAlpha as THREE.BufferAttribute
      aa.setX(0, Math.min(1, k))
      aa.needsUpdate = true
    } catch (err) {
      obj.visible = false
      reportOnce('<Halo> callback', err)
    }
  })
  return <primitive object={obj} />
}

/* <Glows/>: many additive glow points in ONE draw call (dots flaring as the
   pen passes them, bar-end lights). `place(T, i, out)` writes point i's
   world position and returns its intensity (0 hides it). Sizes in CSS px. */

export interface GlowsProps {
  count: number
  sizePx: number
  /** one colour for all, or one per point (hex) */
  colors: readonly string[]
  place: (T: number, i: number, out: [number, number, number]) => number
  /** colour gain (above 1 is HDR: the glow blooms) */
  gain?: number
  renderOrder?: number
}

export function Glows({ count, sizePx, colors, place, gain = 1, renderOrder = 50 }: GlowsProps) {
  const key = colors.join(',')
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    const cols = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      c.set(colors[Math.min(i, colors.length - 1)] ?? '#ffffff').multiplyScalar(gain)
      cols.set([c.r, c.g, c.b], i * 3)
      sizes[i] = sizePx
    }
    g.setAttribute('aColor', new THREE.BufferAttribute(cols, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1))
    const p = new THREE.Points(g, makeGlowMaterial())
    p.frustumCulled = false
    p.renderOrder = renderOrder
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, sizePx, renderOrder, key, gain])
  useEffect(
    () => () => {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    },
    [obj],
  )
  const tmp = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  useFrame(() => {
    try {
      const T = clock.T
      const pa = obj.geometry.attributes.position as THREE.BufferAttribute
      const aa = obj.geometry.attributes.aAlpha as THREE.BufferAttribute
      let any = false
      for (let i = 0; i < count; i++) {
        const k = Math.max(0, place(T, i, tmp))
        if (k > 0.002) any = true
        pa.setXYZ(i, tmp[0], tmp[1], tmp[2])
        aa.setX(i, Math.min(1, k))
      }
      pa.needsUpdate = true
      aa.needsUpdate = true
      obj.visible = any
    } catch (err) {
      obj.visible = false
      reportOnce('<Glows> place', err)
    }
  })
  return <primitive object={obj} />
}
