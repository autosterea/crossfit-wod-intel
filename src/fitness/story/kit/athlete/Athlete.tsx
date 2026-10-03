import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSafeFrame } from '../../useSafeFrame'
import { bodyLayout, writeBody } from './mesh'
import { makeBodyFillMaterial, makeFigureUniforms, makeGhostFillMaterial, makeOutlineMaterial, makePrepassMaterial } from './materials'
import type { AthleteRig } from './driver'

/* =========================================================================
   <Athlete> (story/kit/athlete): one figure, drawn from a rig.

     <Athlete rig={rig} />                                   the athlete (ink body, chalk pen contour)
     <Athlete rig={ghost} look="ghost" />                    a dashed chalk figure with a faint tint
     <Athlete rig={ideal} look="ghost" depthBias={0.6} />    the ideal overlaid ON the athlete (x-ray)
     <Athlete rig={ideal} look="ghost" depthBias={-0.6} />   the ideal showing only where it differs

   Three draw calls per figure (depth prepass, fill, outline), one shared
   topology, vertices posed on the CPU only when the rig's pose changes.
   The figure sits at rig.place (its mid-foot root and scale).
   ========================================================================= */

export type AthleteLook = 'solid' | 'ghost'

export interface AthleteProps {
  rig: AthleteRig
  look?: AthleteLook
  /** 0..1 visibility (fades); 0 hides the figure */
  opacity?: (T: number) => number
  /** pen colour of the contour (chalk) */
  line?: string
  /** contour width, CSS px (default 2.25 solid, 2 ghost) */
  lineWidth?: number
  /** dashed contour (default: ghosts) */
  dashed?: boolean
  /** body ink colour (solid) or tint colour (ghost) */
  fill?: string
  /** ghost tint alpha (default 0.1) */
  tint?: number
  /** fresnel rim colour and strength (solid) */
  rim?: string
  rimStrength?: number
  /** world units along each view ray: + draws over things in front of it, - only where it peeks out */
  depthBias?: number
  /** far-side dimming 0..1 (default 0.35) */
  farDim?: number
  /** contour colour gain (above 1 makes the contour HDR: the speaking element) */
  gain?: (T: number) => number
  /** first render order of the three passes (default 20, 21, 22) */
  renderOrder?: number
}

export const ATHLETE_INK = '#24302b'
export const ATHLETE_LINE = '#eef3f6'

const _cam = new THREE.Vector3()
const _ctr = new THREE.Vector3()

export function Athlete({
  rig,
  look = 'solid',
  opacity,
  line = ATHLETE_LINE,
  lineWidth,
  dashed,
  fill,
  tint = 0.1,
  rim = '#c9d8d0',
  rimStrength = 0.13,
  depthBias = 0,
  farDim = 0.35,
  gain,
  renderOrder = 20,
}: AthleteProps) {
  const layout = bodyLayout()
  const ghost = look === 'ghost'
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setIndex(new THREE.BufferAttribute(layout.index, 1))
    const pos = new THREE.BufferAttribute(new Float32Array(layout.count * 3), 3)
    const nrm = new THREE.BufferAttribute(new Float32Array(layout.count * 3), 3)
    pos.setUsage(THREE.DynamicDrawUsage)
    nrm.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', pos)
    g.setAttribute('normal', nrm)
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.5)
    return g
  }, [layout])
  const u = useMemo(() => makeFigureUniforms(), [])
  const mats = useMemo(() => {
    const pre = makePrepassMaterial(u)
    const body = ghost
      ? makeGhostFillMaterial(u, fill ?? line, tint)
      : makeBodyFillMaterial(u, { color: fill ?? ATHLETE_INK, rim, rimStrength })
    const outline = makeOutlineMaterial(u, { color: line, width: lineWidth ?? (ghost ? 2 : 2.25), dashed: dashed ?? ghost })
    return { pre, body, outline }
  }, [u, ghost, fill, line, tint, rim, rimStrength, lineWidth, dashed])
  const meshes = useMemo(() => {
    const mk = (m: THREE.Material, order: number) => {
      const mesh = new THREE.Mesh(geometry, m)
      mesh.frustumCulled = false
      mesh.renderOrder = order
      return mesh
    }
    return [mk(mats.pre, renderOrder), mk(mats.body, renderOrder + 1), mk(mats.outline, renderOrder + 2)]
  }, [geometry, mats, renderOrder])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => {
      mats.pre.dispose()
      mats.body.dispose()
      mats.outline.dispose()
    },
    [mats],
  )

  const group = useRef<THREE.Group>(null)
  const written = useRef(-1)
  useSafeFrame(
    'athlete',
    (T, _A, _dt, state) => {
      const g = group.current!
      const op = opacity ? opacity(T) : 1
      g.visible = op > 0.003
      if (!g.visible) return
      u.uOpacity.value = Math.min(1, op)
      u.uBias.value = depthBias
      u.uFarDim.value = farDim
      mats.outline.uniforms.uGain.value = gain ? gain(T) : 1
      const P = rig.pose(T)
      if (rig.version !== written.current) {
        written.current = rig.version
        const pa = geometry.attributes.position as THREE.BufferAttribute
        const na = geometry.attributes.normal as THREE.BufferAttribute
        writeBody(layout, P, pa.array as Float32Array, na.array as Float32Array)
        pa.needsUpdate = true
        na.needsUpdate = true
      }
      const q = rig.place
      g.position.set(q.x, q.y, q.z)
      g.scale.setScalar(q.s)
      // far-side dimming: the body's centre (local) and the direction toward the camera (local = world here)
      u.uCenter.value.set(P.hip[0], P.hip[1] + 0.25, 0)
      _ctr.set(q.x + P.hip[0] * q.s, q.y + (P.hip[1] + 0.25) * q.s, q.z)
      _cam.copy(state.camera.position).sub(_ctr)
      if (_cam.lengthSq() > 1e-9) _cam.normalize()
      u.uCamDir.value.copy(_cam)
    },
    { hide: group },
  )

  return (
    <group ref={group}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}
