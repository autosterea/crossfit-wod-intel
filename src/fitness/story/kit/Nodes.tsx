import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { makeDotMaterial } from './materials'
import type { V3 } from '../types'

/* =========================================================================
   Instanced node dots (DESIGN.md B.9 "Nodes", amendment H.42): IMPOSTOR
   spheres. Each dot is one camera-facing quad whose fragment shader draws a
   lit sphere (key light, a small specular highlight, a fresnel rim in the
   dot's colour and an anti-aliased silhouette), so a dot is perfectly round
   and smooth at DPR 1 and 3 alike, where a tessellated sphere read as a
   faceted polygon or a flat blob. Still ONE draw call for every dot in a
   set, and two triangles per dot. Position and scale are pure functions of
   T per instance; a scale of 0 hides the instance.

   Dots draw after the pens (renderOrder 47 by default) and are pushed toward
   the camera by their radius, so they sit ON the curve they mark.
   ========================================================================= */

export interface NodesProps {
  count: number
  radius: number
  color: string
  /** per-instance colours (hex), optional */
  colors?: readonly string[]
  /** write instance i's position and return its scale (0 hides it) */
  place: (T: number, i: number, out: [number, number, number]) => number
  opacity?: (T: number) => number
  /** fresnel rim strength (0 to about 1) */
  rimStrength?: number
  /** self-light: 0 is lit only by the key light, 1 is fully self-lit */
  emissiveIntensity?: number
  renderOrder?: number
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export function Nodes({ count, radius, color, colors, place, opacity, rimStrength = 0.45, emissiveIntensity = 0.35, renderOrder = 47 }: NodesProps) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  const material = useMemo(() => makeDotMaterial({ color, radius, rim: rimStrength, emissive: emissiveIntensity, perInstance: !!colors }), [color, radius, rimStrength, emissiveIntensity, colors])
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, count)
    m.frustumCulled = false
    m.renderOrder = renderOrder
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    if (colors) {
      const c = new THREE.Color()
      for (let i = 0; i < count; i++) m.setColorAt(i, c.set(colors[i] ?? color))
    }
    return m
  }, [geometry, material, count, colors, color, renderOrder])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useEffect(
    () => () => {
      mesh.dispose()
    },
    [mesh],
  )

  const tmp = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  useFrame(() => {
    try {
      const T = clock.T
      const op = opacity ? opacity(T) : 1
      mesh.visible = op > 0.002
      if (!mesh.visible) return
      material.uniforms.uOpacity.value = op
      let any = false
      for (let i = 0; i < count; i++) {
        const s = Math.max(0, place(T, i, tmp))
        if (s > 0) any = true
        _p.set(tmp[0], tmp[1], tmp[2])
        _s.setScalar(s || 1e-5)
        _m.compose(_p, _q, _s)
        mesh.setMatrixAt(i, _m)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.visible = any
    } catch (err) {
      mesh.visible = false
      reportOnce('<Nodes> callback', err)
    }
  })
  return <primitive object={mesh} />
}

export type { V3 }
