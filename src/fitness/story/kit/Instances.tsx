import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { reportOnce } from '../safe'

/* =========================================================================
   <Instances/> (C.11, README "The kit"): any repeated solid in ONE draw
   call. Health slabs, Hopper bricks and parts, stacked solids, tiles: give
   it one geometry and one material (usually makeRimStandard) and a pure
   function of T that writes each instance's position, rotation and scale.
   A scale of 0 (all three) hides an instance. Optional per-instance colours.

   The geometry and material are the CALLER'S (memoise and dispose them);
   the InstancedMesh itself is disposed here. `place` runs every frame, so it
   must not allocate: write into the vectors it is given.
   ========================================================================= */

export interface InstancesProps {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  count: number
  /**
   * Write instance i at story time T into pos / quat / scale (they arrive
   * reset to 0,0,0 / identity / 1,1,1). Return false to hide it.
   */
  place: (T: number, i: number, pos: THREE.Vector3, quat: THREE.Quaternion, scale: THREE.Vector3) => boolean | void
  /** per-instance colours (hex); the material should not also use vertexColors */
  colors?: readonly string[]
  /** whole-set opacity (sets material.opacity; the material must be transparent) */
  opacity?: (T: number) => number
  renderOrder?: number
}

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

export function Instances({ geometry, material, count, place, colors, opacity, renderOrder = 20 }: InstancesProps) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, count))
    m.count = count
    m.frustumCulled = false
    m.renderOrder = renderOrder
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (let i = 0; i < count; i++) m.setMatrixAt(i, ZERO)
    if (colors) {
      const c = new THREE.Color()
      for (let i = 0; i < count; i++) m.setColorAt(i, c.set(colors[i] ?? '#ffffff'))
    }
    return m
  }, [geometry, material, count, colors, renderOrder])
  useEffect(
    () => () => {
      mesh.dispose()
    },
    [mesh],
  )

  useFrame(() => {
    try {
      const T = clock.T
      const op = opacity ? opacity(T) : 1
      mesh.visible = op > 0.002
      if (!mesh.visible) return
      if (opacity) (material as THREE.Material & { opacity: number }).opacity = op
      let any = false
      for (let i = 0; i < count; i++) {
        _p.set(0, 0, 0)
        _q.identity()
        _s.set(1, 1, 1)
        const shown = place(T, i, _p, _q, _s) !== false && (_s.x !== 0 || _s.y !== 0 || _s.z !== 0)
        if (shown) {
          any = true
          _m.compose(_p, _q, _s)
          mesh.setMatrixAt(i, _m)
        } else mesh.setMatrixAt(i, ZERO)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.visible = any
    } catch (err) {
      mesh.visible = false
      reportOnce('<Instances> place', err)
    }
  })
  return <primitive object={mesh} />
}
