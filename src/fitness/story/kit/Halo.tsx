import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
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
  })
  return <primitive object={obj} />
}
