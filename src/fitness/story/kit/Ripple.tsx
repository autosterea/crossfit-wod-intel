import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { makeRingMaterial } from './materials'
import type { V3 } from '../types'

/* <Ripple/> (B.11 "snap"): a single expanding ring of light where something
   lands, for example a measured dot. k(T) runs 0 -> 1 across the ripple
   window (0 and 1 are invisible); the ring grows from the point to sizePx
   and fades, hot (it blooms) at the start. One draw call, a pure function
   of T. Under reduced motion the beat shows t = 1, where the ring is gone. */

export interface RippleProps {
  position: V3 | ((T: number) => V3)
  color: string
  /** 0..1 progress of the ripple (0 and 1 hide it) */
  k: (T: number) => number
  /** final diameter in CSS px (default 64) */
  sizePx?: number
  renderOrder?: number
}

export function Ripple({ position, color, k, sizePx = 64, renderOrder = 51 }: RippleProps) {
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3))
    const c = new THREE.Color(color)
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([c.r, c.g, c.b]), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([sizePx]), 1))
    g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array([0]), 1))
    const p = new THREE.Points(g, makeRingMaterial())
    p.frustumCulled = false
    p.renderOrder = renderOrder
    return p
  }, [color, sizePx, renderOrder])
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
      const kk = k(T)
      obj.visible = kk > 0.001 && kk < 0.999
      if (!obj.visible) return
      const p = typeof position === 'function' ? position(T) : position
      const pa = obj.geometry.attributes.position as THREE.BufferAttribute
      pa.setXYZ(0, p[0], p[1], p[2])
      pa.needsUpdate = true
      const ka = obj.geometry.attributes.aK as THREE.BufferAttribute
      ka.setX(0, kk)
      ka.needsUpdate = true
    } catch (err) {
      obj.visible = false
      reportOnce('<Ripple> callback', err)
    }
  })
  return <primitive object={obj} />
}
