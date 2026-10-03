import { useMemo } from 'react'
import { PAL } from '../../fitnessData'
import { PenBatch } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { lin } from '../../story/kit/materials'
import { useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import {
  ANGLES,
  BODY,
  DOT_ANGLE,
  DOT_JOINTS,
  J,
  N_POINTS,
  jointAngles,
  pose,
  poseAt,
  skeleton,
  workedJoints,
  type Movement,
  type Pose,
} from './figure'
import type { Place } from './layout'

/* =========================================================================
   07 CROSSFIT figures (STORYBOARD-crossfit.md, "One visual grammar"): each
   figure is ONE pen batch (body, head and props) plus a ghost batch (the
   pose it started from, dimmed at full alpha, never translucent). All
   figures share three draw calls more: the joint dots, the worked-joint
   markers (yellow-green, at rest) and the glow of a joint while it turns.
   Every property is a pure function of story time T.
   ========================================================================= */

/** the warm white of a hot pen tip (the kit's head colour family) */
export const LIGHT = '#e9ffc4'

export interface FigureSpec {
  id: string
  move: Movement
  place: Place
  /** movement progress 0..1 */
  p: (T: number) => number
  /** pen draw-on 0..1 (by segment, head first) */
  draw: (T: number) => number
  /** whole-figure opacity (arrive and leave) */
  vis: (T: number) => number
  /** ghost (start pose) opacity */
  ghost: (T: number) => number
  /** movement progress of the ghost pose (default 0) */
  ghostP?: number
  /** worked-joint markers 0..1 */
  marks: (T: number) => number
  /** pen width, px */
  width: number
}

/** the joints a figure blocks labels with (head, chest, pelvis and the twelve dot joints) */
const OBST_JOINTS = [J.head, J.chest, J.pelvis, ...DOT_JOINTS] as const
const BODY_SEGS = 28
const PROP_SEGS = 12
const SEGS = BODY_SEGS + PROP_SEGS
const HEAD_N = 14
const AWAY = 1e5
const DOT_R = 0.105
const MARK_R = 0.13
const D2R = Math.PI / 180

/* --------------------------- world transform -------------------------- */

interface Xf {
  x: number
  y: number
  z: number
  S: number
  c: number
  s: number
}
const xfOf = (p: Place): Xf => ({ x: p.x, y: p.y, z: p.z, S: p.S, c: Math.cos(p.yaw * D2R), s: Math.sin(p.yaw * D2R) })

/** body point -> world, into out[o..o+2] */
function toWorld(t: Xf, bx: number, by: number, bz: number, out: Float32Array | number[], o: number) {
  out[o] = t.x + t.S * (bx * t.c + bz * t.s)
  out[o + 1] = t.y + t.S * by
  out[o + 2] = t.z + t.S * (-bx * t.s + bz * t.c)
}

/* ------------------------------ runtime ------------------------------- */

/**
 * Per-figure frame cache: the skeleton (body and world) at T and the joint
 * angles at T and a moment before (for the glow while a joint turns).
 * Recomputed only when T changes; never allocates per frame.
 */
class FigRuntime {
  readonly spec: FigureSpec
  readonly xf: Xf
  readonly far: number
  readonly worked: boolean[]
  readonly body = new Float32Array(N_POINTS * 3)
  readonly world = new Float32Array(N_POINTS * 3)
  readonly q: Pose = pose({})
  readonly ang = [new Array<number>(ANGLES).fill(0), new Array<number>(ANGLES).fill(0)]
  readonly prev = [new Array<number>(ANGLES).fill(0), new Array<number>(ANGLES).fill(0)]
  readonly tmp = new Float32Array(N_POINTS * 3)
  /** body-frame wrist of the crate's grip pose (crate prop) */
  readonly grip: [number, number] = [0, 0]
  T = NaN
  pNow = 0
  constructor(spec: FigureSpec) {
    this.spec = spec
    this.xf = xfOf(spec.place)
    // body +x maps to world z = -x sin(yaw): the +x side is the far one when the figure turns right
    this.far = Math.sin(spec.place.yaw * D2R) >= 0 ? 0 : 1
    this.worked = workedJoints(spec.move)
    if (spec.move.prop === 'crate') {
      const k = spec.move.keys
      skeleton(spec.move, poseAt(spec.move, k[1].p, pose({})), this.tmp)
      this.grip[0] = this.tmp[J.wrist * 3 + 1]
      this.grip[1] = this.tmp[J.wrist * 3 + 2]
    }
  }
  at(T: number) {
    if (T === this.T) return
    this.T = T
    const m = this.spec.move
    const p = this.spec.p(T)
    this.pNow = p
    skeleton(m, poseAt(m, p, this.q), this.body)
    for (let i = 0; i < N_POINTS; i++) toWorld(this.xf, this.body[i * 3], this.body[i * 3 + 1], this.body[i * 3 + 2], this.world, i * 3)
    jointAngles(m, this.body, 0, this.ang[0])
    jointAngles(m, this.body, 1, this.ang[1])
    const pp = this.spec.p(T - 0.006)
    skeleton(m, poseAt(m, pp, this.q), this.tmp)
    jointAngles(m, this.tmp, 0, this.prev[0])
    jointAngles(m, this.tmp, 1, this.prev[1])
  }
  /** 0..1: how fast dot joint j turns at T */
  activity(j: number): number {
    const a = DOT_ANGLE[j]
    if (a < 0) return 0
    const side = j % 2
    const d = Math.abs(this.ang[side][a] - this.prev[side][a])
    return Math.min(1, d / 2.2)
  }
}

/* ------------------------------ segments ------------------------------ */

function seg(out: Float32Array, i: number, a: Float32Array | number[], ao: number, b: Float32Array | number[], bo: number) {
  const o = i * 6
  out[o] = a[ao]
  out[o + 1] = a[ao + 1]
  out[o + 2] = a[ao + 2]
  out[o + 3] = b[bo]
  out[o + 4] = b[bo + 1]
  out[o + 5] = b[bo + 2]
}
function park(out: Float32Array, i: number) {
  out.fill(AWAY, i * 6, i * 6 + 6)
}

/** The 28 body segments in draw order: head, spine, far limbs, near limbs (a pen draws a person head first). */
function writeBody(pts: Float32Array, far: number, S: number, out: Float32Array) {
  const near = 1 - far
  let i = 0
  // head: a screen-facing circle of radius headR around the head point
  const hx = pts[J.head * 3]
  const hy = pts[J.head * 3 + 1]
  const hz = pts[J.head * 3 + 2]
  const r = BODY.headR * S
  for (let k = 0; k < HEAD_N; k++) {
    const a0 = Math.PI / 2 - (k / HEAD_N) * Math.PI * 2
    const a1 = Math.PI / 2 - ((k + 1) / HEAD_N) * Math.PI * 2
    const o = i * 6
    out[o] = hx + Math.cos(a0) * r
    out[o + 1] = hy + Math.sin(a0) * r
    out[o + 2] = hz
    out[o + 3] = hx + Math.cos(a1) * r
    out[o + 4] = hy + Math.sin(a1) * r
    out[o + 5] = hz
    i++
  }
  const P = (j: number) => j * 3
  seg(out, i++, pts, P(J.neckTop), pts, P(J.chest))
  seg(out, i++, pts, P(J.chest), pts, P(J.pelvis))
  seg(out, i++, pts, P(J.shoulder), pts, P(J.shoulder + 1))
  seg(out, i++, pts, P(J.hip), pts, P(J.hip + 1))
  for (const k of [far, near]) {
    seg(out, i++, pts, P(J.shoulder + k), pts, P(J.elbow + k))
    seg(out, i++, pts, P(J.elbow + k), pts, P(J.wrist + k))
    seg(out, i++, pts, P(J.hip + k), pts, P(J.knee + k))
    seg(out, i++, pts, P(J.knee + k), pts, P(J.ankle + k))
    seg(out, i++, pts, P(J.heel + k), pts, P(J.toe + k))
  }
  return i
}

/** Segment colours: head and spine chalk, the far limbs dimmer (much less so when the figure faces us), props quieter. */
function bodyColors(frontish: boolean): Float32Array {
  const c = new Float32Array(SEGS * 6)
  const chalk = lin(PAL.chalk)
  const dimF = frontish ? 0.82 : 0.5
  for (let i = 0; i < SEGS; i++) {
    let k = 1
    if (i >= HEAD_N + 4 && i < HEAD_N + 9) k = dimF // far limbs
    if (i >= BODY_SEGS) k = 0.6 // props
    c.set([chalk.r * k, chalk.g * k, chalk.b * k, chalk.r * k, chalk.g * k, chalk.b * k], i * 6)
  }
  return c
}

/* -------------------------------- props ------------------------------- */

const _a = [0, 0, 0]
const _b = [0, 0, 0]
function propSeg(rt: FigRuntime, out: Float32Array, i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  toWorld(rt.xf, ax, ay, az, _a, 0)
  toWorld(rt.xf, bx, by, bz, _b, 0)
  seg(out, i, _a, 0, _b, 0)
}

/** Write the prop segments (box, crate, dumbbells, barbell, bar, machine) from slot BODY_SEGS on. */
function writeProps(rt: FigRuntime, out: Float32Array) {
  const m = rt.spec.move
  const b = rt.body
  let i = BODY_SEGS
  const end = SEGS
  const W = (j: number, c: number) => b[j * 3 + c]
  switch (m.prop) {
    case 'box': {
      // a chair-height box under the seated pelvis (the squat stands up from it)
      const z0 = -0.42
      const z1 = -0.1
      const y1 = 0.27
      propSeg(rt, out, i++, 0, 0, z0, 0, y1, z0)
      propSeg(rt, out, i++, 0, y1, z0, 0, y1, z1)
      propSeg(rt, out, i++, 0, y1, z1, 0, 0, z1)
      propSeg(rt, out, i++, 0, 0.012, z0, 0, 0.012, z1)
      break
    }
    case 'crate': {
      // a crate on the floor in front of the shins; once gripped it rides up with the hands
      const h = rt.grip[0]
      const cz = rt.grip[1] + 0.02
      const d = 0.13
      let dy = 0
      let dz = 0
      if (rt.pNow > m.keys[2].p) {
        dy = W(J.wrist, 1) - rt.grip[0]
        dz = W(J.wrist, 2) - rt.grip[1]
      }
      const y0 = dy
      const y1 = h + dy
      const z0 = cz - d / 2 + dz
      const z1 = cz + d / 2 + dz
      propSeg(rt, out, i++, 0, y0, z0, 0, y0, z1)
      propSeg(rt, out, i++, 0, y0, z1, 0, y1, z1)
      propSeg(rt, out, i++, 0, y1, z1, 0, y1, z0)
      propSeg(rt, out, i++, 0, y1, z0, 0, y0, z0)
      propSeg(rt, out, i++, 0, y0 + h * 0.62, z0, 0, y0 + h * 0.62, z1)
      break
    }
    case 'bells': {
      for (const k of [0, 1]) {
        const x = W(J.wrist + k, 0)
        const y = W(J.wrist + k, 1)
        const z = W(J.wrist + k, 2)
        propSeg(rt, out, i++, x, y, z - 0.035, x, y, z + 0.035)
        propSeg(rt, out, i++, x, y - 0.03, z - 0.035, x, y + 0.03, z - 0.035)
        propSeg(rt, out, i++, x, y - 0.03, z + 0.035, x, y + 0.03, z + 0.035)
      }
      break
    }
    case 'barbell': {
      const y = (W(J.wrist, 1) + W(J.wrist + 1, 1)) / 2
      const z = (W(J.wrist, 2) + W(J.wrist + 1, 2)) / 2
      propSeg(rt, out, i++, -0.42, y, z, 0.42, y, z)
      for (const x of [-0.37, -0.32, 0.32, 0.37]) propSeg(rt, out, i++, x, y - 0.07, z, x, y + 0.07, z)
      break
    }
    case 'bar': {
      const y = (m.anchorY ?? 1.3) + 0.012
      propSeg(rt, out, i++, -0.46, y, 0, 0.46, y, 0)
      propSeg(rt, out, i++, -0.46, y, 0, -0.46, y + 0.07, 0)
      propSeg(rt, out, i++, 0.46, y, 0, 0.46, y + 0.07, 0)
      break
    }
    case 'machine': {
      const sy = (m.anchorY ?? 0.44) - 0.03
      propSeg(rt, out, i++, 0, sy, -0.16, 0, sy, 0.27)
      propSeg(rt, out, i++, 0, sy, 0.21, 0, 0, 0.21)
      propSeg(rt, out, i++, 0, sy, -0.12, 0, 0, -0.12)
      const lean = -8 * D2R
      propSeg(rt, out, i++, 0, sy, -0.16, 0, sy + 0.36 * Math.cos(lean), -0.16 + 0.36 * Math.sin(lean))
      // the roller pad in front of the shin, on a lever from the knee
      const kx = W(J.knee, 0)
      const ky = W(J.knee, 1)
      const kz = W(J.knee, 2)
      const ax = W(J.ankle, 0)
      const ay = W(J.ankle, 1)
      const az = W(J.ankle, 2)
      // forward normal of the shin (rotate the knee->ankle direction by +90 degrees in y-z)
      const dy = ay - ky
      const dz = az - kz
      const L = Math.hypot(dy, dz) || 1
      const ny = dz / L
      const nz = -dy / L
      const pr = 0.034
      const py = ay - 0.02 * (dy / L) + ny * (pr + 0.012)
      const pz = az - 0.02 * (dz / L) + nz * (pr + 0.012)
      propSeg(rt, out, i++, kx, ky, kz, kx, py, pz)
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2
        const a1 = ((k + 1) / 6) * Math.PI * 2
        propSeg(rt, out, i++, ax, py + Math.sin(a0) * pr, pz + Math.cos(a0) * pr, ax, py + Math.sin(a1) * pr, pz + Math.cos(a1) * pr)
      }
      break
    }
    default:
      break
  }
  while (i < end) park(out, i++)
}

/* ------------------------------ component ----------------------------- */

function OneFigure({ rt }: { rt: FigRuntime }) {
  const spec = rt.spec
  const colors = useMemo(() => bodyColors(Math.abs(spec.place.yaw) < 40), [spec.place.yaw])
  const segs = useMemo(() => new Float32Array(SEGS * 6).fill(AWAY), [])
  const ghostSegs = useMemo(() => {
    const g = new Float32Array(SEGS * 6).fill(AWAY)
    const sk = new Float32Array(N_POINTS * 3)
    const w = new Float32Array(N_POINTS * 3)
    skeleton(spec.move, poseAt(spec.move, spec.ghostP ?? 0, pose({})), sk)
    for (let i = 0; i < N_POINTS; i++) toWorld(rt.xf, sk[i * 3], sk[i * 3 + 1], sk[i * 3 + 2], w, i * 3)
    writeBody(w, rt.far, spec.place.S, g)
    return g
  }, [rt, spec])
  const last = useMemo(() => ({ T: NaN }), [])
  const update = (T: number, s: Float32Array): boolean => {
    if (T === last.T) return false
    last.T = T
    rt.at(T)
    writeBody(rt.world, rt.far, spec.place.S, s)
    writeProps(rt, s)
    return true
  }
  return (
    <>
      <PenBatch
        segments={ghostSegs}
        colors={colors}
        width={spec.width * 0.85}
        opacity={(T) => spec.ghost(T) * spec.vis(T)}
        dim={() => 0.36}
        renderOrder={30}
      />
      <PenBatch segments={segs} colors={colors} width={spec.width} update={update} progress={spec.draw} opacity={spec.vis} renderOrder={32} />
    </>
  )
}

/** All figures of a station set: their pens, plus one call each for dots, markers and glows. */
export function FigureSet({ specs, obstacleId, glowPx = 26 }: { specs: readonly FigureSpec[]; obstacleId: string; glowPx?: number }) {
  const rts = useMemo(() => specs.map((s) => new FigRuntime(s)), [specs])
  const n = rts.length * DOT_JOINTS.length
  const dotScale = (rt: FigRuntime) => rt.spec.place.S / 6

  const placeDot = (T: number, i: number, out: [number, number, number]) => {
    const rt = rts[Math.floor(i / DOT_JOINTS.length)]
    const j = i % DOT_JOINTS.length
    const v = rt.spec.vis(T) * Math.min(1, rt.spec.draw(T) * 1.6)
    if (v <= 0.01) return 0
    rt.at(T)
    const o = DOT_JOINTS[j] * 3
    out[0] = rt.world[o]
    out[1] = rt.world[o + 1]
    out[2] = rt.world[o + 2] + 0.02
    // the far side's dots are smaller (depth)
    const farK = j % 2 === rt.far && Math.abs(rt.spec.place.yaw) > 40 ? 0.7 : 1
    return dotScale(rt) * farK * Math.min(1, v * 1.2)
  }
  const placeMark = (T: number, i: number, out: [number, number, number]) => {
    const rt = rts[Math.floor(i / DOT_JOINTS.length)]
    const j = i % DOT_JOINTS.length
    if (!rt.worked[j]) return 0
    const k = rt.spec.marks(T) * rt.spec.vis(T)
    if (k <= 0.01) return 0
    rt.at(T)
    const o = DOT_JOINTS[j] * 3
    out[0] = rt.world[o]
    out[1] = rt.world[o + 1]
    out[2] = rt.world[o + 2] + 0.05
    const farK = j % 2 === rt.far && Math.abs(rt.spec.place.yaw) > 40 ? 0.75 : 1
    return dotScale(rt) * farK * k
  }
  const placeGlow = (T: number, i: number, out: [number, number, number]) => {
    const rt = rts[Math.floor(i / DOT_JOINTS.length)]
    const j = i % DOT_JOINTS.length
    const v = rt.spec.vis(T)
    if (v <= 0.01) return 0
    rt.at(T)
    const a = rt.activity(j)
    if (a <= 0.02) return 0
    const o = DOT_JOINTS[j] * 3
    out[0] = rt.world[o]
    out[1] = rt.world[o + 1]
    out[2] = rt.world[o + 2] + 0.08
    return a * v
  }

  // labels never cover a figure: its joints and head are obstacles while it shows
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        let k = 0
        for (const rt of rts) {
          if (rt.spec.vis(T) < 0.3 || rt.spec.draw(T) < 0.3) continue
          rt.at(T)
          for (const jj of OBST_JOINTS) {
            out[k * 3] = rt.world[jj * 3]
            out[k * 3 + 1] = rt.world[jj * 3 + 1]
            out[k * 3 + 2] = rt.world[jj * 3 + 2]
            k++
          }
        }
        return k
      },
      maxPoints: rts.length * (DOT_JOINTS.length + 3),
      radiusPx: 7,
    }),
    [rts],
  )
  useWorldObstacle(obstacleId, obstacle)

  return (
    <>
      {rts.map((rt) => (
        <OneFigure key={rt.spec.id} rt={rt} />
      ))}
      <Nodes count={n} radius={DOT_R} color={PAL.chalk} place={placeDot} rimStrength={0.35} emissiveIntensity={0.5} renderOrder={47} />
      <Nodes count={n} radius={MARK_R} color={PAL.yellowGreen} place={placeMark} rimStrength={0.6} emissiveIntensity={0.85} renderOrder={48} />
      <Glows count={n} sizePx={glowPx} colors={[LIGHT]} gain={1.7} place={placeGlow} />
    </>
  )
}
