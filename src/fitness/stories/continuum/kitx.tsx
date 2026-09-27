import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { makeDotMaterial } from '../../story/kit/materials'
import { Pen, type PenProps } from '../../story/kit/Pen'
import { useSafeFrame } from '../../story/useSafeFrame'

/* =========================================================================
   Two small extensions of the kit this chapter needs, built ONLY from the
   engine's own factories (makeDotMaterial, <Pen/>). Proposed for promotion
   (engine_requests):

   <TintDots/>  <Nodes/> whose per-instance colour is a function of T (a dot
                takes spectrum(position) as it climbs its spoke). Nodes sets
                its colours once at creation.
   <TintPen/>   <Pen/> whose line colour is a function of T (the person's
                outline moves along the spectrum with the mean). The pen
                never writes its LineMaterial colour after creation, so the
                tint is written here, allocation-free.
   ========================================================================= */

/** Write one world-obstacle point into out, return the new count (allocation-free; both layers' obstacle writers use it). */
export function put(out: Float32Array, n: number, x: number, y: number, z: number): number {
  out[n * 3] = x
  out[n * 3 + 1] = y
  out[n * 3 + 2] = z
  return n + 1
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

export interface TintDotsProps {
  count: number
  radius: number
  /** write dot i's world position, return its scale (0 hides it) */
  place: (T: number, i: number, out: [number, number, number]) => number
  /** write dot i's LINEAR colour at T */
  tint: (T: number, i: number, out: THREE.Color) => void
  opacity?: (T: number) => number
  rimStrength?: number
  emissiveIntensity?: number
  renderOrder?: number
  /** the frame loop site name (warnings) */
  site: string
}

/** Impostor sphere dots (the kit's dot material, H.42) with a per-frame colour per dot, ONE draw call. */
export function TintDots({ count, radius, place, tint, opacity, rimStrength = 0.5, emissiveIntensity = 0.45, renderOrder = 47, site }: TintDotsProps) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  const material = useMemo(() => makeDotMaterial({ color: '#ffffff', radius, rim: rimStrength, emissive: emissiveIntensity, perInstance: true }), [radius, rimStrength, emissiveIntensity])
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, count)
    m.frustumCulled = false
    m.renderOrder = renderOrder
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    // colours exist before the first compile, so the shader links USE_INSTANCING_COLOR
    for (let i = 0; i < count; i++) m.setColorAt(i, _c.setRGB(1, 1, 1))
    m.instanceColor?.setUsage(THREE.DynamicDrawUsage)
    return m
  }, [geometry, material, count, renderOrder])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => void mesh.dispose(), [mesh])
  const hide = useRef<THREE.Object3D | null>(null)
  hide.current = mesh
  const tmp = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  useSafeFrame(
    site,
    (T) => {
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
        tint(T, i, _c)
        mesh.setColorAt(i, _c)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.visible = any
    },
    { hide },
  )
  return <primitive object={mesh} />
}

/** <Pen/> plus a per-frame line colour. `tint(T, out)` writes the LINEAR colour. */
export function TintPen({ tint, site, ...pen }: PenProps & { tint: (T: number, out: THREE.Color) => void; site: string }) {
  const group = useRef<THREE.Group>(null)
  const line = useRef<THREE.Object3D | null>(null)
  useSafeFrame(
    site,
    (T) => {
      const g = group.current
      if (!g) return
      if (!line.current || line.current.parent !== g) line.current = g.children.find((c) => (c as THREE.Mesh).isMesh) ?? null
      const mat = (line.current as THREE.Mesh | null)?.material as (THREE.Material & { color?: THREE.Color }) | undefined
      if (mat?.color) tint(T, mat.color)
    },
    { hide: group },
  )
  return (
    <group ref={group}>
      <Pen {...pen} />
    </group>
  )
}
