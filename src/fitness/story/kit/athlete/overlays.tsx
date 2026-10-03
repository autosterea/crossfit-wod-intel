import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { PAL } from '../../../fitnessData'
import { useSafeFrame } from '../../useSafeFrame'
import { makePenMaterial, makeRimStandard, steelOpts } from '../materials'
import { PEN, PenBatch } from '../Pen'
import { Glows } from '../Halo'
import { lumbarCurve, type LandmarkId } from './rig'
import type { AthleteRig } from './driver'
import type { LabelSpec } from '../../types'

/* =========================================================================
   Teaching overlays for the athlete (story/kit/athlete). Every one is a
   pure function of T through its rig, in the rig's placement.

   <LumbarHighlight rig/>  a pen along the lower back, about 2 cm off the
       skin, whose colour READS the lumbar curve: 25 degrees of lordosis or
       more lime (kept), 5 or less PAL.sick (rounded), chalk in between
       (never through amber). `gain(T)` above 1 makes it the speaking
       element (HDR, it blooms): the storyboard heats it only while red.
   <BallSeams rig/>        the medicine ball's panel seams (chalk pen), so
       the ball reads as a ball; it never spins (laces out, p. 213).
   <JointGlows rig points/> additive lights at landmarks: a point of
       performance lighting up on the joint it coaches.
   athleteLabel()          a LabelSpec anchored to a landmark (DOM label).
   ========================================================================= */

export const LIME = '#91c640'
export const CHALK = '#eef3f6'
export const SICK = PAL.sick

/** The lumbar thresholds of the highlight's colour (deg of lordosis). */
export const LUMBAR_KEPT = 25
export const LUMBAR_LOST = 5

const cLime = new THREE.Color(LIME)
const cChalk = new THREE.Color(CHALK)
const cSick = new THREE.Color(SICK)

/** 0 while the curve is kept (>= 25), 1 once it is rounded (<= 5). */
export function lumbarRedness(lord: number): number {
  const t = (LUMBAR_KEPT - lord) / (LUMBAR_KEPT - LUMBAR_LOST)
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** The highlight colour for a lordosis value into `out` (lime -> chalk -> red, never amber). */
export function lumbarColor(lord: number, out: THREE.Color): THREE.Color {
  const r = lumbarRedness(lord)
  if (r <= 0.5) return out.copy(cLime).lerp(cChalk, r * 2)
  return out.copy(cChalk).lerp(cSick, (r - 0.5) * 2)
}

/** A CSS colour string for the same mapping (DOM labels that follow the back). */
export function lumbarCss(lord: number): string {
  const r = lumbarRedness(lord)
  return r < 0.5 ? LIME : r < 1 ? CHALK : SICK
}

/* ------------------------------ lumbar --------------------------------- */

export interface LumbarHighlightProps {
  rig: AthleteRig
  /** 0..1 visibility */
  opacity?: (T: number) => number
  /** colour gain: above 1 is HDR (the speaking element). Default: 1 */
  gain?: (T: number) => number
  /** CSS px (default PEN.hero, 4.5) */
  width?: number
  /** metres off the skin (default 0.02) */
  lift?: number
  /** span along the spine (sigma from the coccyx), default S1 to T12 */
  from?: number
  to?: number
  renderOrder?: number
}

const LUMBAR_N = 18

/** The lower back as a coloured pen stroke (its colour is the lumbar curve's state). */
export function LumbarHighlight({ rig, opacity, gain, width = PEN.hero, lift = 0.022, from = 0.085, to = 0.33, renderOrder = 34 }: LumbarHighlightProps) {
  const line = useMemo(() => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(new Float32Array((LUMBAR_N - 1) * 6))
    const ib = (geo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer
    ib.setUsage(THREE.DynamicDrawUsage)
    // the pen material's tail-glow attribute (unused here: the whole stroke is drawn)
    const arc = new Float32Array((LUMBAR_N - 1) * 2)
    for (let i = 0; i < LUMBAR_N - 1; i++) {
      arc[i * 2] = i / (LUMBAR_N - 1)
      arc[i * 2 + 1] = (i + 1) / (LUMBAR_N - 1)
    }
    geo.setAttribute('instanceArc', new THREE.InterleavedBufferAttribute(new THREE.InstancedInterleavedBuffer(arc, 2, 1), 2, 0))
    const mat = makePenMaterial({ color: LIME, width })
    const l = new LineSegments2(geo, mat)
    l.frustumCulled = false
    l.renderOrder = renderOrder
    return l
  }, [width, renderOrder])
  useEffect(
    () => () => {
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    },
    [line],
  )
  const pts = useMemo(() => new Float32Array(LUMBAR_N * 3), [])
  const col = useMemo(() => new THREE.Color(), [])
  useSafeFrame(
    'lumbar highlight',
    (T) => {
      const op = opacity ? opacity(T) : 1
      line.visible = op > 0.003
      if (!line.visible) return
      const P = rig.pose(T)
      lumbarCurve(P, pts, LUMBAR_N, lift, from, to)
      const q = rig.place
      const ib = (line.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer
      const seg = ib.array as Float32Array
      for (let i = 0; i < LUMBAR_N - 1; i++) {
        for (let k = 0; k < 3; k++) {
          const off = k === 0 ? q.x : k === 1 ? q.y : q.z
          seg[i * 6 + k] = off + pts[i * 3 + k] * q.s
          seg[i * 6 + 3 + k] = off + pts[(i + 1) * 3 + k] * q.s
        }
      }
      ib.needsUpdate = true
      const mat = line.material as THREE.ShaderMaterial & { color: THREE.Color; opacity: number }
      mat.color = lumbarColor(P.params.lord, col)
      mat.opacity = op
      mat.uniforms.uGain.value = gain ? gain(T) : 1
    },
    { hide: { current: line } },
  )
  return <primitive object={line} />
}

/* ------------------------------ ball ----------------------------------- */

const SEAM_N = 48

/** Two panel seams on the medicine ball (great circles, chalk); the back halves are hidden by the ball. */
export function BallSeams({ rig, opacity, color = CHALK, width = 1.5 }: { rig: AthleteRig; opacity?: (T: number) => number; color?: string; width?: number }) {
  const segments = useMemo(() => new Float32Array(SEAM_N * 2 * 6), [])
  // unit circles in the ball's frame: a meridian turned 38 degrees off the view axis, and a band tilted 24 degrees
  const unit = useMemo(() => {
    const u = new Float32Array(SEAM_N * 2 * 6)
    const a = (38 * Math.PI) / 180
    const b = (24 * Math.PI) / 180
    const p = (c: number, i: number, out: number[]) => {
      const th = (i / SEAM_N) * Math.PI * 2
      if (c === 0) {
        out[0] = Math.cos(th) * Math.cos(a)
        out[1] = Math.sin(th)
        out[2] = Math.cos(th) * Math.sin(a)
      } else {
        out[0] = Math.cos(th)
        out[1] = Math.sin(th) * Math.sin(b)
        out[2] = Math.sin(th) * Math.cos(b)
      }
    }
    const s0: number[] = [0, 0, 0]
    const s1: number[] = [0, 0, 0]
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < SEAM_N; i++) {
        p(c, i, s0)
        p(c, i + 1, s1)
        u.set([s0[0], s0[1], s0[2], s1[0], s1[1], s1[2]], (c * SEAM_N + i) * 6)
      }
    return u
  }, [])
  const lastV = useRef(-1)
  return (
    <PenBatch
      segments={segments}
      color={color}
      width={width}
      renderOrder={33}
      dim={() => 0.62}
      opacity={(T) => {
        const P = rig.pose(T)
        if (P.hold.kind !== 'ball') return 0
        return opacity ? opacity(T) : 1
      }}
      update={(T, segs) => {
        const P = rig.pose(T)
        if (rig.version === lastV.current || P.hold.kind !== 'ball') return false
        lastV.current = rig.version
        const q = rig.place
        const r = P.hold.r * 1.006
        for (let i = 0; i < unit.length; i += 3) {
          segs[i] = q.x + (P.bar[0] + unit[i] * r) * q.s
          segs[i + 1] = q.y + (P.bar[1] + unit[i + 1] * r) * q.s
          segs[i + 2] = q.z + (P.bar[2] + unit[i + 2] * r) * q.s
        }
        return true
      }}
    />
  )
}

/* ------------------------------ barbell -------------------------------- */

const RING_N = 56
const SLEEVE_R = 0.026
const PLATE_Z = 0.82

/**
 * A barbell in the hands (front rack, overhead): a steel shaft along z and
 * its sleeve ends drawn as chalk rings (or bumper plates of radius
 * `plates`, still rings, so the body stays visible through them in a side
 * view; the far one dimmer).
 */
export function Barbell({ rig, opacity, plates = 0 }: { rig: AthleteRig; opacity?: (T: number) => number; /** plate radius in metres; 0 = an empty bar (its sleeve ends) */ plates?: number }) {
  const PLATE_R = plates > 0 ? plates : SLEEVE_R
  const shaft = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.014, 0.014, 2.2, 14)
    g.rotateX(Math.PI / 2)
    const m = new THREE.Mesh(g, makeRimStandard(steelOpts))
    m.frustumCulled = false
    m.renderOrder = 20
    return m
  }, [])
  useEffect(
    () => () => {
      shaft.geometry.dispose()
      ;(shaft.material as THREE.Material).dispose()
    },
    [shaft],
  )
  const segs = useMemo(() => new Float32Array(RING_N * 2 * 6), [])
  const colors = useMemo(() => {
    const c = new Float32Array(RING_N * 2 * 6)
    const near = new THREE.Color(CHALK)
    const far = new THREE.Color(CHALK).multiplyScalar(0.45)
    for (let i = 0; i < RING_N * 2; i++) {
      const k = i < RING_N ? near : far
      c.set([k.r, k.g, k.b, k.r, k.g, k.b], i * 6)
    }
    return c
  }, [])
  const vis = (T: number) => {
    const P = rig.pose(T)
    if (P.hold.kind !== 'rack' && P.hold.kind !== 'overhead') return 0
    return opacity ? opacity(T) : 1
  }
  useSafeFrame(
    'barbell',
    (T) => {
      const op = vis(T)
      shaft.visible = op > 0.003
      if (!shaft.visible) return
      const P = rig.pose(T)
      const q = rig.place
      shaft.position.set(q.x + P.bar[0] * q.s, q.y + P.bar[1] * q.s, q.z + P.bar[2] * q.s)
      shaft.scale.setScalar(q.s)
    },
    { hide: { current: shaft } },
  )
  const lastV = useRef(-1)
  return (
    <>
      <primitive object={shaft} />
      <PenBatch
        segments={segs}
        colors={colors}
        width={2}
        renderOrder={33}
        opacity={vis}
        update={(T, out) => {
          const P = rig.pose(T)
          if (rig.version === lastV.current) return false
          lastV.current = rig.version
          const q = rig.place
          for (let side = 0; side < 2; side++) {
            const z = side === 0 ? PLATE_Z : -PLATE_Z
            for (let i = 0; i < RING_N; i++) {
              const a0 = (i / RING_N) * Math.PI * 2
              const a1 = ((i + 1) / RING_N) * Math.PI * 2
              const o = (side * RING_N + i) * 6
              out[o] = q.x + (P.bar[0] + Math.cos(a0) * PLATE_R) * q.s
              out[o + 1] = q.y + (P.bar[1] + Math.sin(a0) * PLATE_R) * q.s
              out[o + 2] = q.z + z * q.s
              out[o + 3] = q.x + (P.bar[0] + Math.cos(a1) * PLATE_R) * q.s
              out[o + 4] = q.y + (P.bar[1] + Math.sin(a1) * PLATE_R) * q.s
              out[o + 5] = q.z + z * q.s
            }
          }
          return true
        }}
      />
    </>
  )
}

/* ------------------------------ floor ---------------------------------- */

export interface FloorProps {
  /** world x range */
  x0: number
  x1: number
  /** world height of the floor (the athletes' place.y) */
  y?: number
  /** world z of the near and far edges: the athletes' feet stand between them (default +-0.36 m x scale) */
  near?: number
  far?: number
  opacity?: (T: number) => number
  color?: string
}

/**
 * The floor as a band, not a line. The camera's eye is above the floor
 * (at the subject's middle), so in perspective the floor is seen a little
 * from above: a line drawn at the body's midline would cut through the near
 * foot and leave the far foot above it. The band's near edge is the floor
 * line (the near foot stands just behind it), its far edge a dim line
 * behind the far foot: both feet stand on the floor at every scale.
 */
export function Floor({ x0, x1, y = 0, near = 0.36, far = -0.36, opacity, color = CHALK }: FloorProps) {
  const pts = useMemo(() => new Float32Array([x0, y, near, x1, y, near]), [x0, x1, y, near])
  const back = useMemo(() => new Float32Array([x0, y, far, x1, y, far]), [x0, x1, y, far])
  return (
    <>
      <PenBatch segments={pts} color={color} width={PEN.axis} renderOrder={30} opacity={opacity} dim={() => 0.62} />
      <PenBatch segments={back} color={color} width={PEN.grid} renderOrder={30} opacity={opacity} dim={() => 0.3} />
    </>
  )
}

/* ------------------------------ joints --------------------------------- */

export interface JointPoint {
  landmark: LandmarkId
  side?: 0 | 1
  color: string
  /** 0..1 intensity at T (a point of performance lighting up) */
  k: (T: number) => number
}

/** Additive lights on landmarks, ONE draw call. `gain` above 1 blooms (only for the speaking element). */
export function JointGlows({ rig, points, sizePx = 26, gain = 1 }: { rig: AthleteRig; points: readonly JointPoint[]; sizePx?: number; gain?: number }) {
  const colors = useMemo(() => points.map((p) => p.color), [points])
  return (
    <Glows
      count={points.length}
      sizePx={sizePx}
      colors={colors}
      gain={gain}
      place={(T, i, out) => {
        const p = points[i]
        const v = rig.at(T, p.landmark, p.side ?? 0)
        out[0] = v[0]
        out[1] = v[1]
        out[2] = v[2]
        return p.k(T)
      }}
    />
  )
}

/* ------------------------------ labels --------------------------------- */

/** A DOM label anchored to a landmark of the athlete (the rest of the spec is yours). */
export function athleteLabel(rig: AthleteRig, landmark: LandmarkId, spec: Omit<LabelSpec, 'anchor'>, side: 0 | 1 = 0): LabelSpec {
  return { ...spec, anchor: (T: number) => rig.at(T, landmark, side) }
}
