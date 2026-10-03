import { NEUTRAL, PARAM_KEYS, SHOULDER_WIDTH, evaluate, newPose, readAngles, type Hold, type LandmarkId, type PoseParams, type Stance } from './rig'

/* =========================================================================
   Movements (story/kit/athlete): keyframes in joint space, named phases,
   and the points of performance a coach checks, each tied to the joint it
   coaches. Keyframed from the CrossFit Level 1 Training Guide's movement
   photographs and points of performance (fitnessData MOVEMENTS).

   THE MEDICINE-BALL CLEAN (p. 208), the Technique chapter's movement:
     set-up: shoulder-width stance with the toes turned out and the knees
       spread around the ball; the ball on the floor between the feet,
       palms on its sides; the trunk hinged about 57 degrees, hips above the
       knees, shoulders over the ball, lumbar curve kept, eyes on the
       horizon;
     pull: hips and shoulders rise together, arms straight, the ball close
       to the legs (knee height by the end);
     extend: the hips extend rapidly to full hip and knee extension, then
       the shoulders shrug; the heels stay down until the hips and knees
       have extended;
     under: the arms pull under, elbows high and outside, while the body
       drops: the ball barely changes height, the athlete goes under it;
     receive: the bottom of the squat (hip crease below the knee) with the
       ball in the rack at the chin, hands under it, elbows down;
     stand: full hip and knee extension, the ball at the rack;
     return: the ball lowered back to the floor (the loop closes on the
       set-up, so a looping review never jumps).
   The PULL CYCLE ('mb-pull') is set-up, pull, extend and back to the
   set-up: the part of the clean the threshold beats repeat.

   THE SQUATS (pp. 171-178): air squat (arms forward and rising, trunk about
   44 degrees at the bottom, hip crease 6 cm below the top of the knee,
   shins about 32 degrees), front squat (the bar in the rack, elbows high,
   trunk about 29 degrees), overhead squat (arms locked, the bar over
   mid-foot, trunk about 30 degrees).

   Every parameter is interpolated with a monotone cubic through the keys
   (no overshoot, continuous speed), so a rep accelerates out of each
   position and decelerates into the next. Phases are fractions of one rep;
   a story addresses them by name (phaseRange, phaseMid, phaseAt) and drives
   the rep phase from T (tempo.ts).
   ========================================================================= */

export type MoveKey = 'mb-clean' | 'mb-pull' | 'air-squat' | 'front-squat' | 'overhead-squat'
export const MOVE_KEYS: readonly MoveKey[] = ['mb-clean', 'mb-pull', 'air-squat', 'front-squat', 'overhead-squat']

export type PhaseId =
  | 'setup'
  | 'pull'
  | 'extend'
  | 'under'
  | 'receive'
  | 'stand'
  | 'lower'
  | 'return'
  | 'descent'
  | 'bottom'
  | 'ascent'
  | 'finish'

export interface PhaseDef {
  id: PhaseId
  label: string
  /** rep phase window [from, to) */
  from: number
  to: number
}

/** One point of performance, tied to the joint it coaches and the phases where it is checked. */
export interface PointSpec {
  /** stable id, e.g. 'mb-clean.hips' */
  id: string
  /** the guide's words (fitnessData MOVEMENTS) */
  text: string
  /** short label for tight layouts */
  short: string
  joint: LandmarkId
  /** which limb carries the label (0 near, 1 far) */
  side?: 0 | 1
  /** where it is listed: set-up, execution or finish */
  part: 'setup' | 'execution' | 'finish'
  /** the phases in which this point is the thing to look at */
  phases: readonly PhaseId[]
}

export interface Key {
  at: number
  p: Partial<PoseParams>
}

/** Which way a fault shows: in a squat (at depth) or in a pull from the floor (with the trunk inclined). */
export type Family = 'squat' | 'pull'

export interface MoveSpec {
  key: MoveKey
  /** the guide's name (fitnessData MOVEMENTS[].name) */
  name: string
  family: Family
  hold: Hold
  stance: Stance
  phases: readonly PhaseDef[]
  /** a natural rep at a steady tempo, seconds */
  repSeconds: number
  points: readonly PointSpec[]
  /** resolved keys (every parameter present), sorted by `at` */
  keys: readonly { at: number; p: PoseParams }[]
  /** pelvis height standing (full hip and knee extension) and at the lowest point */
  hyTop: number
  hyBottom: number
  /** trunk lean at the set-up (pull family: the fault scale's reference) */
  leanSetup: number
}

/* ------------------------------ standing ------------------------------- */

/** Pelvis height at which the knees are just short of locked (3 degrees): "full knee extension". */
function standingHeight(base: Partial<PoseParams>, hold: Hold, stance: Stance): number {
  const P = newPose()
  let lo = 0.85
  let hi = 0.96
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    evaluate(P, { ...NEUTRAL, ...base, hy: mid }, hold, stance)
    const k = readAngles(P).knee
    if (k > 3) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/* ------------------------------ the clean ------------------------------ */

/** The medicine ball: a 14 inch (0.356 m) ball, about a ninth of the athlete's mass. */
export const MED_BALL: Hold = { kind: 'ball', r: 0.178, mass: 0.12 }

/** Shoulder-width at the feet with the toes out and room for the ball between them. */
const BALL_STANCE: Stance = { half: 0.21, toeOut: 24 }

const CLEAN_PHASES: readonly PhaseDef[] = [
  { id: 'setup', label: 'Set-up', from: 0, to: 0.12 },
  { id: 'pull', label: 'Pull', from: 0.12, to: 0.26 },
  { id: 'extend', label: 'Extend', from: 0.26, to: 0.36 },
  { id: 'under', label: 'Pull under', from: 0.36, to: 0.46 },
  { id: 'receive', label: 'Receive', from: 0.46, to: 0.54 },
  { id: 'stand', label: 'Stand', from: 0.54, to: 0.72 },
  { id: 'finish', label: 'Finish', from: 0.72, to: 0.84 },
  { id: 'return', label: 'Return', from: 0.84, to: 1 },
]

const PULL_PHASES: readonly PhaseDef[] = [
  { id: 'setup', label: 'Set-up', from: 0, to: 0.18 },
  { id: 'pull', label: 'Pull', from: 0.18, to: 0.42 },
  { id: 'extend', label: 'Extend', from: 0.42, to: 0.58 },
  { id: 'lower', label: 'Lower', from: 0.58, to: 1 },
]

/** The set-up (p. 208): hips above the knees, shoulders over the ball, lumbar curve kept, eyes forward. */
const C_SETUP: Partial<PoseParams> = { hy: 0.615, lean: 61, lord: 40, head: 4, arm: 1, rack: 0, shrug: 0, heel: 0 }
/** Mid-pull: hips and shoulders rising together, arms straight, the ball rising close to the legs. */
const C_PULL: Partial<PoseParams> = { hy: 0.735, lean: 46, lord: 40, head: 2, arm: 3, rack: 0, shrug: 0, heel: 0 }
/** The ball at the knees. */
const C_KNEE: Partial<PoseParams> = { hy: 0.835, lean: 29, lord: 40, head: 0, arm: 6, rack: 0, shrug: 0, heel: 0 }

function cleanKeys(hyTop: number): Key[] {
  const ext: Partial<PoseParams> = { hy: hyTop + 0.012, lean: -4, lord: 42, head: -2, arm: 15, shrug: 0.02, heel: 3, rack: 0 }
  const shrug: Partial<PoseParams> = { hy: hyTop + 0.02, lean: -6, lord: 43, head: -3, arm: 21, shrug: 0.045, heel: 8, rack: 0.05 }
  const under: Partial<PoseParams> = { hy: 0.63, lean: 11, lord: 36, head: -2, arm: 20, shrug: 0.02, heel: 0, rack: 0.62 }
  const receive: Partial<PoseParams> = { hy: 0.37, lean: 26, lord: 29, head: -6, arm: 10, shrug: 0, heel: 0, rack: 1 }
  const low: Partial<PoseParams> = { ...receive, hy: 0.362 }
  const standMid: Partial<PoseParams> = { hy: 0.66, lean: 13, lord: 36, head: -3, arm: 10, shrug: 0, heel: 0, rack: 1 }
  const stand: Partial<PoseParams> = { hy: hyTop, lean: 0, lord: 40, head: -1, arm: 10, shrug: 0, heel: 0, rack: 1 }
  const lowerMid: Partial<PoseParams> = { hy: 0.86, lean: 17, lord: 39, head: 0, arm: 9, shrug: 0, heel: 0, rack: 0.5 }
  const lowerKnee: Partial<PoseParams> = { ...C_KNEE, rack: 0.06 }
  return [
    { at: 0, p: C_SETUP },
    { at: 0.12, p: C_SETUP },
    { at: 0.19, p: C_PULL },
    { at: 0.26, p: C_KNEE },
    { at: 0.32, p: ext },
    { at: 0.36, p: shrug },
    { at: 0.41, p: under },
    { at: 0.46, p: receive },
    { at: 0.5, p: low },
    { at: 0.54, p: receive },
    { at: 0.63, p: standMid },
    { at: 0.72, p: stand },
    { at: 0.84, p: stand },
    { at: 0.9, p: lowerMid },
    { at: 0.95, p: lowerKnee },
    { at: 1, p: C_SETUP },
  ]
}

function pullKeys(hyTop: number): Key[] {
  const ext: Partial<PoseParams> = { hy: hyTop + 0.012, lean: -4, lord: 42, head: -2, arm: 15, shrug: 0.03, heel: 3, rack: 0 }
  return [
    { at: 0, p: C_SETUP },
    { at: 0.18, p: C_SETUP },
    { at: 0.3, p: C_PULL },
    { at: 0.42, p: C_KNEE },
    { at: 0.55, p: ext },
    { at: 0.6, p: ext },
    { at: 0.76, p: C_KNEE },
    { at: 0.88, p: C_PULL },
    { at: 1, p: C_SETUP },
  ]
}

const CLEAN_POINTS: PointSpec[] = [
  { id: 'mb-clean.stance', text: 'Shoulder-width stance.', short: 'Stance', joint: 'ankle', part: 'setup', phases: ['setup'] },
  { id: 'mb-clean.ball', text: 'Ball between the feet, palms on the ball.', short: 'Palms on the ball', joint: 'ball', part: 'setup', phases: ['setup'] },
  { id: 'mb-clean.shoulders', text: 'Shoulders over the ball.', short: 'Shoulders over the ball', joint: 'shoulder', part: 'setup', phases: ['setup'] },
  { id: 'mb-clean.eyes', text: 'Eyes on the horizon.', short: 'Eyes forward', joint: 'eye', part: 'setup', phases: ['setup'] },
  { id: 'mb-clean.lumbar', text: 'Lumbar curve maintained.', short: 'Lumbar curve', joint: 'lumbar', part: 'execution', phases: ['setup', 'pull'] },
  { id: 'mb-clean.hips', text: 'Hips extend rapidly.', short: 'Hips extend', joint: 'hip', part: 'execution', phases: ['extend'] },
  { id: 'mb-clean.shrug', text: 'Shoulders then shrug.', short: 'Shrug', joint: 'shoulder', part: 'execution', phases: ['extend'] },
  { id: 'mb-clean.under', text: 'Arms then pull under to the bottom of the squat.', short: 'Pull under', joint: 'elbow', part: 'execution', phases: ['under', 'receive'] },
  { id: 'mb-clean.close', text: 'Ball stays close to the body.', short: 'Ball close', joint: 'ball', part: 'execution', phases: ['pull', 'under'] },
  { id: 'mb-clean.finish', text: 'Complete at full hip and knee extension with the ball in the rack position.', short: 'Full extension, ball in the rack', joint: 'hip', part: 'finish', phases: ['finish'] },
]

/* ------------------------------ squats --------------------------------- */

const SQUAT_PHASES: readonly PhaseDef[] = [
  { id: 'setup', label: 'Set-up', from: 0, to: 0.1 },
  { id: 'descent', label: 'Descent', from: 0.1, to: 0.46 },
  { id: 'bottom', label: 'Bottom', from: 0.46, to: 0.54 },
  { id: 'ascent', label: 'Ascent', from: 0.54, to: 0.9 },
  { id: 'finish', label: 'Finish', from: 0.9, to: 1 },
]

interface SquatShape {
  stand: Partial<PoseParams>
  mid: Partial<PoseParams>
  bottom: Partial<PoseParams>
  bottomHy: number
  /** fraction of the way down at the mid keys (by pelvis height) */
  midDepth: number
}

function squatKeys(shape: SquatShape, hyTop: number): Key[] {
  const midHy = hyTop - (hyTop - shape.bottomHy) * shape.midDepth
  const stand = { ...shape.stand, hy: hyTop }
  const mid = { ...shape.mid, hy: midHy }
  const bot = { ...shape.bottom, hy: shape.bottomHy }
  const low = { ...shape.bottom, hy: shape.bottomHy - 0.008 }
  return [
    { at: 0, p: stand },
    { at: 0.1, p: stand },
    { at: 0.27, p: mid },
    { at: 0.46, p: bot },
    { at: 0.5, p: low },
    { at: 0.54, p: bot },
    { at: 0.73, p: mid },
    { at: 0.9, p: stand },
    { at: 1, p: stand },
  ]
}

const AIR: SquatShape = {
  stand: { lean: 0, lord: 40, head: 0, arm: 92, elbow: 3, wrist: 4, curl: 8 },
  mid: { lean: 24, lord: 34, head: 7, arm: 104, elbow: 3, wrist: 4, curl: 8 },
  bottom: { lean: 44, lord: 24, head: 16, arm: 124, elbow: 4, wrist: 5, curl: 8 },
  bottomHy: 0.338,
  midDepth: 0.48,
}

const FRONT: SquatShape = {
  stand: { lean: 0, lord: 40, head: 0, shrug: 0.004 },
  mid: { lean: 15, lord: 36, head: 3, shrug: 0.004 },
  bottom: { lean: 29, lord: 28, head: 8, shrug: 0.004 },
  bottomHy: 0.345,
  midDepth: 0.5,
}

const OVERHEAD: SquatShape = {
  stand: { lean: 0, lord: 40, head: 0, shrug: 0.03 },
  mid: { lean: 16, lord: 37, head: 5, shrug: 0.03 },
  bottom: { lean: 30, lord: 30, head: 12, shrug: 0.03 },
  bottomHy: 0.352,
  midDepth: 0.5,
}

const RACK: Hold = { kind: 'rack', grip: 0.235, mass: 0.5 }
const OVERHEAD_HOLD: Hold = { kind: 'overhead', grip: 0.43, mass: 0.35 }
const FREE_HOLD: Hold = { kind: 'free' }

const AIR_POINTS: PointSpec[] = [
  { id: 'air-squat.stance', text: 'Shoulder-width stance.', short: 'Stance', joint: 'ankle', part: 'setup', phases: ['setup'] },
  { id: 'air-squat.hips', text: 'Hips descend back and down.', short: 'Hips back', joint: 'hip', part: 'execution', phases: ['descent'] },
  { id: 'air-squat.lumbar', text: 'Lumbar curve maintained.', short: 'Lumbar curve', joint: 'lumbar', part: 'execution', phases: ['descent', 'bottom', 'ascent'] },
  { id: 'air-squat.knees', text: 'Knees in line with toes.', short: 'Knees over toes', joint: 'knee', part: 'execution', phases: ['descent', 'bottom', 'ascent'] },
  { id: 'air-squat.depth', text: 'Hips descend lower than knees.', short: 'Below the knee', joint: 'hipCrease', part: 'execution', phases: ['bottom'] },
  { id: 'air-squat.heels', text: 'Heels down.', short: 'Heels down', joint: 'heel', part: 'execution', phases: ['descent', 'bottom', 'ascent'] },
  { id: 'air-squat.finish', text: 'Complete at full hip and knee extension.', short: 'Full extension', joint: 'hip', part: 'finish', phases: ['finish'] },
]

const FRONT_POINTS: PointSpec[] = [
  { id: 'front-squat.grip', text: 'Loose fingertip grip on the bar.', short: 'Fingertip grip', joint: 'hand', part: 'setup', phases: ['setup'] },
  { id: 'front-squat.elbows', text: 'Elbows high (upper arm parallel to the ground).', short: 'Elbows high', joint: 'elbow', part: 'setup', phases: ['setup', 'descent', 'bottom', 'ascent'] },
  { id: 'front-squat.carry', text: 'All air squat points carry over.', short: 'Air squat points', joint: 'hipCrease', part: 'execution', phases: ['bottom'] },
  { id: 'front-squat.finish', text: 'Complete at full hip and knee extension.', short: 'Full extension', joint: 'hip', part: 'finish', phases: ['finish'] },
]

const OVERHEAD_POINTS: PointSpec[] = [
  { id: 'overhead-squat.shoulders', text: 'Shoulders push up into the bar.', short: 'Push up into the bar', joint: 'shoulder', part: 'setup', phases: ['setup'] },
  { id: 'overhead-squat.arms', text: 'Arms extended.', short: 'Arms locked', joint: 'elbow', part: 'setup', phases: ['setup', 'bottom'] },
  { id: 'overhead-squat.bar', text: 'Bar moves over the middle of the foot.', short: 'Bar over mid-foot', joint: 'bar', part: 'execution', phases: ['descent', 'bottom', 'ascent'] },
  { id: 'overhead-squat.carry', text: 'All air squat points carry over.', short: 'Air squat points', joint: 'hipCrease', part: 'execution', phases: ['bottom'] },
  { id: 'overhead-squat.finish', text: 'Complete at full hip and knee extension.', short: 'Full extension', joint: 'hip', part: 'finish', phases: ['finish'] },
]

/* ------------------------------ registry ------------------------------- */

function resolveKeys(keys: Key[]): { at: number; p: PoseParams }[] {
  return keys.map((k) => ({ at: k.at, p: { ...NEUTRAL, ...k.p } as PoseParams })).sort((a, b) => a.at - b.at)
}

function squat(key: MoveKey, name: string, shape: SquatShape, hold: Hold, repSeconds: number, points: PointSpec[]): MoveSpec {
  const hyTop = standingHeight(shape.stand, hold, SHOULDER_WIDTH)
  return {
    key,
    name,
    family: 'squat',
    hold,
    stance: SHOULDER_WIDTH,
    phases: SQUAT_PHASES,
    repSeconds,
    points,
    keys: resolveKeys(squatKeys(shape, hyTop)),
    hyTop,
    hyBottom: shape.bottomHy,
    leanSetup: 0,
  }
}

function clean(key: 'mb-clean' | 'mb-pull'): MoveSpec {
  const hyTop = standingHeight({ lean: 0, lord: 40, arm: 10, rack: 1 }, MED_BALL, BALL_STANCE)
  const pull = key === 'mb-pull'
  return {
    key,
    name: pull ? 'The Medicine-Ball Clean: the pull' : 'The Medicine-Ball Clean',
    family: 'pull',
    hold: MED_BALL,
    stance: BALL_STANCE,
    phases: pull ? PULL_PHASES : CLEAN_PHASES,
    repSeconds: pull ? 2.2 : 4.6,
    points: CLEAN_POINTS,
    keys: resolveKeys(pull ? pullKeys(hyTop) : cleanKeys(hyTop)),
    hyTop,
    hyBottom: 0.362,
    leanSetup: C_SETUP.lean ?? 61,
  }
}

const cache = new Map<MoveKey, MoveSpec>()

/** A movement's spec (built on first use: the standing height is solved once). */
export function move(key: MoveKey): MoveSpec {
  const hit = cache.get(key)
  if (hit) return hit
  let spec: MoveSpec
  switch (key) {
    case 'mb-clean':
    case 'mb-pull':
      spec = clean(key)
      break
    case 'air-squat':
      spec = squat(key, 'The Air Squat', AIR, FREE_HOLD, 2.2, AIR_POINTS)
      break
    case 'front-squat':
      spec = squat(key, 'The Front Squat', FRONT, RACK, 2.4, FRONT_POINTS)
      break
    case 'overhead-squat':
      spec = squat(key, 'The Overhead Squat', OVERHEAD, OVERHEAD_HOLD, 2.6, OVERHEAD_POINTS)
      break
  }
  cache.set(key, spec)
  return spec
}

/* ------------------------------ sampling ------------------------------- */

/** Slope at knot j for the monotone cubic (Fritsch-Butland weighted harmonic mean; never overshoots). */
function knotSlope(xs: readonly number[], ys: readonly number[], j: number): number {
  const n = xs.length
  if (j <= 0) return (ys[1] - ys[0]) / (xs[1] - xs[0])
  if (j >= n - 1) return (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2])
  const d0 = (ys[j] - ys[j - 1]) / (xs[j] - xs[j - 1])
  const d1 = (ys[j + 1] - ys[j]) / (xs[j + 1] - xs[j])
  if (d0 * d1 <= 0) return 0
  const h0 = xs[j] - xs[j - 1]
  const h1 = xs[j + 1] - xs[j]
  const w1 = 2 * h1 + h0
  const w2 = h1 + 2 * h0
  return (w1 + w2) / (w1 / d0 + w2 / d1)
}

/** Monotone cubic through (xs, ys) at x: no overshoot, continuous slope. */
function monotone(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length
  if (x <= xs[0]) return ys[0]
  if (x >= xs[n - 1]) return ys[n - 1]
  let i = 0
  while (i < n - 2 && xs[i + 1] <= x) i++
  const h = xs[i + 1] - xs[i]
  const flat = ys[i + 1] === ys[i]
  const m0 = flat ? 0 : knotSlope(xs, ys, i)
  const m1 = flat ? 0 : knotSlope(xs, ys, i + 1)
  const t = (x - xs[i]) / h
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m1
}

/** Per-move columns for the interpolation, built once. */
const columns = new Map<MoveKey, { xs: number[]; ys: Record<keyof PoseParams, number[]> }>()

function cols(spec: MoveSpec) {
  const hit = columns.get(spec.key)
  if (hit) return hit
  const xs = spec.keys.map((k) => k.at)
  const ys = {} as Record<keyof PoseParams, number[]>
  for (const k of PARAM_KEYS) ys[k] = spec.keys.map((key) => key.p[k])
  const c = { xs, ys }
  columns.set(spec.key, c)
  return c
}

/** Wrap a phase into [0, 1]; exactly 1 stays 1 (the finished rep). */
export const wrapPhase = (phase: number) => (phase >= 0 && phase <= 1 ? phase : phase - Math.floor(phase))

/** The textbook pose parameters of a movement at rep phase `phase` (0..1) into `out`. */
export function sampleMove(spec: MoveSpec, phase: number, out: PoseParams): PoseParams {
  const c = cols(spec)
  const x = wrapPhase(phase)
  for (const k of PARAM_KEYS) out[k] = monotone(c.xs, c.ys[k], x)
  return out
}

/**
 * How loaded the fault-prone position is at these textbook params, 0..1.
 * Squat family: the depth (0 standing, 1 at the bottom). Pull family: how
 * far the trunk is hinged over the ball while it hangs in the arms: 1 from
 * the set-up through the pull (trunk 40 degrees or more), fading to 0 as
 * the hips extend, and 0 with the ball in the rack. So a rounded back at
 * amount 1 shows its full -20 degrees in every pull, as the threshold beats
 * ask, and straightens as the athlete stands.
 */
export function faultLoad(spec: MoveSpec, p: Readonly<PoseParams>): number {
  if (spec.family === 'squat') {
    const k = (spec.hyTop - p.hy) / (spec.hyTop - spec.hyBottom)
    return k < 0 ? 0 : k > 1 ? 1 : k
  }
  // full through the set-up and the pull (trunk 40 degrees or more), fading as the hips extend
  const h = (p.lean - 10) / 30
  const hinge = h <= 0 ? 0 : h >= 1 ? 1 : h * h * (3 - 2 * h)
  return hinge * (1 - (p.rack < 0 ? 0 : p.rack > 1 ? 1 : p.rack))
}

/** Back-compat name for the squat depth (0 standing, 1 at the bottom). */
export const depthOf = (spec: MoveSpec, hy: number): number => {
  const k = (spec.hyTop - hy) / (spec.hyTop - spec.hyBottom)
  return k < 0 ? 0 : k > 1 ? 1 : k
}

/* ------------------------------ phases --------------------------------- */

const FULL: readonly [number, number] = [0, 1]
const RANGES = new Map<PhaseDef, readonly [number, number]>()

/** The window of a named phase in rep phase (the whole rep if the movement has no such phase). */
export function phaseRange(key: MoveKey, id: PhaseId): readonly [number, number] {
  const list = move(key).phases
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    if (p.id !== id) continue
    let r = RANGES.get(p)
    if (!r) {
      r = [p.from, p.to] as const
      RANGES.set(p, r)
    }
    return r
  }
  return FULL
}

/** The middle of a named phase (a still frame of that position). */
export function phaseMid(key: MoveKey, id: PhaseId): number {
  const [a, b] = phaseRange(key, id)
  return (a + b) / 2
}

/** Which named phase a rep phase falls in. */
export function phaseAt(key: MoveKey, phase: number): PhaseId {
  const x = wrapPhase(phase)
  const list = move(key).phases
  for (const p of list) if (x >= p.from && x < p.to) return p.id
  return list[list.length - 1].id
}

/**
 * 0..1 weight of named phases at a rep phase, with soft edges (`soft` in
 * rep phase): a point of performance lights up while its phase is on.
 */
export function phaseWeight(key: MoveKey, ids: readonly PhaseId[], phase: number, soft = 0.04): number {
  const x = wrapPhase(phase)
  let w = 0
  for (const id of ids) {
    const [a, b] = phaseRange(key, id)
    const up = soft > 0 ? Math.min(1, Math.max(0, (x - a + soft) / soft)) : x >= a ? 1 : 0
    const dn = soft > 0 ? Math.min(1, Math.max(0, (b + soft - x) / soft)) : x < b ? 1 : 0
    w = Math.max(w, Math.min(up, dn))
  }
  return w
}
