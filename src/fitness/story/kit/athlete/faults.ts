import type { LandmarkId, PoseParams } from './rig'
import type { MoveSpec } from './moves'

/* =========================================================================
   Deviations (story/kit/athlete): what a coach sees break as intensity
   rises, each an amount from 0 (textbook) to 1 (clearly broken).

   Each fault is a change to the joint-space pose, scaled by its amount and
   by how deep the athlete is in the rep (k: 0 standing, 1 at the bottom),
   because squat faults show up under load at depth and vanish at the top.
   The rig then re-solves balance, so a fault carries its physical
   consequences with it (a heel rise brings the knees forward; hips that do
   not travel back move the weight toward the toes).

   The five are the air squat's common faults in the CrossFit Level 1
   Training Guide (pp. 172-175):
     heels    "Weight on toes or shifting to toes": the heels lift off the
              floor about the balls of the feet; the knees drift forward.
     knees    "Knees not tracking in line with toes, which usually causes them
              to roll inside the feet": the knees swing toward the midline
              (seen front-on or at three quarters; side-on it hides).
     lumbar   "Loss of a neutral position due to flexion in lumbar spine": the
              lower back rounds, the pelvis tucks under, the chest drops. In a
              pull from the floor (the medicine-ball clean) it is the
              Technique article's "pull with a rounded back" (p. 42): the
              lumbar curve goes from 40 to -20 and the hips rise ahead of the
              chest (PULL_SCALE); the other four are squat faults.
     midfoot  "Improper line of action: hips do not travel back, knees move
              excessively forward placing weight on the toes": the hips stay
              forward and the centre of mass (or the bar) drifts off
              mid-foot toward the toes.
     depth    "Not going low enough": the hip crease stays above the top of
              the knee.
   ========================================================================= */

export type FaultKey = 'heels' | 'knees' | 'lumbar' | 'midfoot' | 'depth'
export const FAULT_KEYS: readonly FaultKey[] = ['heels', 'knees', 'lumbar', 'midfoot', 'depth']

/** Fault amounts, each 0 (textbook) to 1 (clearly broken). */
export type Faults = Record<FaultKey, number>

export const NO_FAULTS: Readonly<Faults> = { heels: 0, knees: 0, lumbar: 0, midfoot: 0, depth: 0 }

export interface FaultInfo {
  key: FaultKey
  /** a short name for a label */
  label: string
  /** the guide's words */
  guide: string
  /** the guide's page */
  page: number
  /** the joint that shows it (where its label and light go) */
  joint: LandmarkId
  /** the point of performance it breaks (fitnessData MOVEMENTS air squat) */
  point: string
  /** the camera that shows it: 'side' (profile) or 'front' (front-on / three quarters) */
  view: 'side' | 'front'
}

export const FAULTS: Readonly<Record<FaultKey, FaultInfo>> = {
  heels: {
    key: 'heels',
    label: 'Heels rise',
    guide: 'Weight on toes or shifting to toes.',
    page: 172,
    joint: 'heel',
    point: 'Heels down.',
    view: 'side',
  },
  knees: {
    key: 'knees',
    label: 'Knees cave in',
    guide: 'Knees not tracking in line with toes, which usually causes them to roll inside the feet.',
    page: 174,
    joint: 'knee',
    point: 'Knees in line with toes.',
    view: 'front',
  },
  lumbar: {
    key: 'lumbar',
    label: 'Rounded back',
    guide: 'Loss of a neutral position due to flexion in lumbar spine.',
    page: 172,
    joint: 'lumbar',
    point: 'Lumbar curve maintained.',
    view: 'side',
  },
  midfoot: {
    key: 'midfoot',
    label: 'Off mid-foot',
    guide: 'Improper line of action: hips do not travel back, knees move excessively forward placing weight on the toes.',
    page: 173,
    joint: 'com',
    point: 'Hips descend back and down.',
    view: 'side',
  },
  depth: {
    key: 'depth',
    label: 'Not low enough',
    guide: 'Not going low enough.',
    page: 173,
    joint: 'hipCrease',
    point: 'Hips descend lower than knees.',
    view: 'side',
  },
}

/** At amount 1 and the bottom of the rep, how far each fault goes. Tuned so 1 reads "clearly broken" to a coach. */
export const FAULT_SCALE = {
  /** heel rise, deg about the ball of the foot (about 6 cm of heel) */
  heelDeg: 15,
  /** the centre of mass moves this far toward the toes with the heels up, m */
  heelCom: 0.062,
  /** knee swivel toward the midline past the line of the toes, deg */
  valgusDeg: 17,
  /** lordosis lost, deg (24 at the bottom -> about -22: a rounded lower back) */
  lumbarDeg: 46,
  /** the chest drops with a rounded back, deg of extra lean */
  lumbarLean: 9,
  /** hips held forward of the balanced line, m */
  hipFwd: 0.06,
  /** the trunk stays more upright when the hips do not go back, deg */
  midfootLean: 13,
  /** the bar drifts forward of mid-foot (loaded holds), m */
  barOff: 0.09,
  /** share of the depth lost (0.55: the hip crease stays well above the knee) */
  depth: 0.55,
} as const

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/**
 * The rounded back in a pull from the floor (the Technique article, p. 42:
 * "the other guy starts to pull with a rounded back"): at amount 1 the
 * lumbar curve goes from neutral (40) to rounded (-20) and the hips rise
 * ahead of the chest. Nothing else changes (no heel rise, no head drop).
 */
export const PULL_SCALE = {
  /** lordosis lost, deg */
  lord: 60,
  /** the hips rise ahead of the chest, m */
  hipRise: 0.065,
  /** ... so the trunk tips further over the ball, deg */
  lean: 14,
} as const

/**
 * Apply faults to textbook params `p` (in place). `k` is how loaded the
 * fault-prone position is (moves.faultLoad: the squat's depth, or the
 * pull's hinge over the ball); `stand` the movement's standing params.
 */
export function applyFaults(p: PoseParams, f: Readonly<Faults>, k: number, stand: Readonly<PoseParams>, spec: MoveSpec): PoseParams {
  if (spec.family === 'pull') {
    const a = clamp01(f.lumbar) * k
    if (a > 0) {
      p.lord -= PULL_SCALE.lord * a
      p.hy += PULL_SCALE.hipRise * a
      p.lean += PULL_SCALE.lean * a
    }
    return p
  }
  const S = FAULT_SCALE
  // depth first: a shallower squat is the textbook squat stopped part way (lean, arms and all)
  const keep = 1 - clamp01(f.depth) * S.depth
  if (keep < 1) {
    p.hy = stand.hy + (p.hy - stand.hy) * keep
    p.lean = stand.lean + (p.lean - stand.lean) * keep
    p.lord = stand.lord + (p.lord - stand.lord) * keep
    p.head = stand.head + (p.head - stand.head) * keep
    p.arm = stand.arm + (p.arm - stand.arm) * keep
  }
  const kk = k * k * (3 - 2 * k)
  const heels = clamp01(f.heels) * kk
  if (heels > 0) {
    p.heel += S.heelDeg * heels
    p.com += S.heelCom * heels
    p.lean -= 5 * heels
  }
  const knees = clamp01(f.knees) * kk
  if (knees > 0) p.valgus += S.valgusDeg * knees
  const lum = clamp01(f.lumbar) * Math.pow(k, 1.5)
  if (lum > 0) {
    p.lord -= S.lumbarDeg * lum
    p.lean += S.lumbarLean * lum
    p.head += 8 * lum
  }
  const mid = clamp01(f.midfoot) * kk
  if (mid > 0) {
    p.hipFwd += S.hipFwd * mid
    p.lean -= S.midfootLean * mid
    if (spec.hold.kind !== 'free') p.barOff += S.barOff * mid
  }
  return p
}

/* ------------------------------ amounts -------------------------------- */

/** A ramp 0..1 as `d` goes from a to b (smoothstep). */
export function ramp(d: number, a: number, b: number): number {
  const t = clamp01((d - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * One "deviation amount" d (0 textbook .. 1 clearly broken) spread over the
 * faults. `mix` weights each fault (default: every fault with weight 1).
 * Writes into `out` (or a new object) and returns it.
 */
export function deviation(d: number, mix: Partial<Faults> = {}, out?: Faults): Faults {
  const o = out ?? { ...NO_FAULTS }
  for (const key of FAULT_KEYS) o[key] = clamp01(d * (mix[key] ?? 1))
  return o
}

/**
 * Faults that appear one after another as d rises (the order a coach
 * typically sees them break under rising intensity). Each fault ramps in
 * over its own window of d. Writes into `out` and returns it.
 */
export function staged(d: number, windows: Partial<Record<FaultKey, readonly [number, number]>>, out?: Faults): Faults {
  const o = out ?? { ...NO_FAULTS }
  for (const key of FAULT_KEYS) {
    const w = windows[key]
    o[key] = w ? ramp(d, w[0], w[1]) : 0
  }
  return o
}

/** The default order faults break in as intensity rises (for `staged`). */
export const BREAK_ORDER: Readonly<Partial<Record<FaultKey, readonly [number, number]>>> = {
  depth: [0.05, 0.55],
  heels: [0.2, 0.7],
  lumbar: [0.35, 0.85],
  midfoot: [0.3, 0.8],
  knees: [0.45, 1],
}

/** The largest single fault amount: one number a chart can plot for "how far off textbook". */
export function faultLevel(f: Readonly<Faults>): number {
  let m = 0
  for (const key of FAULT_KEYS) m = Math.max(m, f[key])
  return m
}
