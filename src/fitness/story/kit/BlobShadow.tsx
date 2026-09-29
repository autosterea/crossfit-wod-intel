import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { makeBlobMaterial } from './materials'

/* =========================================================================
   <BlobShadow/> (DESIGN.md B.9 "Blob shadow"): soft contact shadows under
   solids (Hopper balls and bricks, the Skills prism, the Continuum orb), all
   in ONE draw call. No shadow maps, no ContactShadows anywhere in the lesson.

   Each shadow is a flat disc on the XZ plane (a floor under a solid). Give
   it the floor point under the solid and a strength; lift the solid and pass
   a smaller strength (and a larger radius) so the shadow softens as it
   rises. Everything is a pure function of T.

     <BlobShadow count={6} radius={0.6}
       place={(T, i, out) => { out[0] = x[i]; out[1] = floorY; out[2] = z[i]; return 1 - lift(T, i) }} />
   ========================================================================= */

export interface BlobShadowProps {
  /** number of shadows (default 1) */
  count?: number
  /** world radius of a shadow at scale 1 */
  radius: number
  /**
   * Write shadow i's floor point into out and return its strength 0..1
   * (0 hides it). Optionally write a radius multiplier into out[3].
   */
  place: (T: number, i: number, out: [number, number, number, number]) => number
  /** overall darkness (default 0.55) */
  strength?: number
  renderOrder?: number
}

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()

export function BlobShadow({ count = 1, radius, place, strength = 0.55, renderOrder = 5 }: BlobShadowProps) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(2, 2)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const material = useMemo(() => makeBlobMaterial(), [])
  const k = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count)), 1), [count])
  const mesh = useMemo(() => {
    geometry.setAttribute('aK', k)
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, count))
    m.count = count
    m.frustumCulled = false
    m.renderOrder = renderOrder
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return m
  }, [geometry, material, k, count, renderOrder])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => void mesh.dispose(), [mesh])

  const tmp = useMemo<[number, number, number, number]>(() => [0, 0, 0, 1], [])
  useFrame(() => {
    try {
      material.uniforms.uStrength.value = strength
      const T = clock.T
      let any = false
      for (let i = 0; i < count; i++) {
        tmp[3] = 1
        const a = Math.max(0, Math.min(1, place(T, i, tmp)))
        k.setX(i, a)
        if (a > 0.002) any = true
        _p.set(tmp[0], tmp[1], tmp[2])
        _s.setScalar(radius * (tmp[3] || 1))
        _m.compose(_p, _q, _s)
        mesh.setMatrixAt(i, _m)
      }
      k.needsUpdate = true
      mesh.instanceMatrix.needsUpdate = true
      mesh.visible = any
    } catch (err) {
      mesh.visible = false
      reportOnce('<BlobShadow> place', err)
    }
  })
  return <primitive object={mesh} />
}
