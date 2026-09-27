import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { makeRimStandard } from './materials'
import type { V3 } from '../types'

/* Instanced node spheres (DESIGN.md B.9 "Nodes"): icosahedron detail 2, one
   draw call for every dot in a set. Position and scale are pure functions of
   T per instance; a scale of 0 hides the instance. */

export interface NodesProps {
  count: number
  radius: number
  color: string
  /** per-instance colours (hex), optional */
  colors?: readonly string[]
  /** write instance i's position and return its scale (0 hides it) */
  place: (T: number, i: number, out: [number, number, number]) => number
  opacity?: (T: number) => number
  rimStrength?: number
  emissiveIntensity?: number
  renderOrder?: number
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export function Nodes({ count, radius, color, colors, place, opacity, rimStrength = 0.45, emissiveIntensity = 0.35, renderOrder = 35 }: NodesProps) {
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(radius, 2), [radius])
  const material = useMemo(
    () => makeRimStandard({ color, rim: color, rimStrength, emissiveIntensity, roughness: 0.35, metalness: 0.1, transparent: true }),
    [color, rimStrength, emissiveIntensity],
  )
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
    const T = clock.T
    const op = opacity ? opacity(T) : 1
    mesh.visible = op > 0.002
    if (!mesh.visible) return
    material.opacity = op
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
  })
  return <primitive object={mesh} />
}

export type { V3 }
