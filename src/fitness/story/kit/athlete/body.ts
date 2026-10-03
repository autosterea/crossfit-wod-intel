/* =========================================================================
   The athlete's body: anthropometry and shape (story/kit/athlete).

   One adult athlete, 1.78 m. Segment lengths, joint offsets and mass
   fractions follow the standard tables (Winter, "Biomechanics and Motor
   Control of Human Movement", segment lengths as fractions of height;
   Dempster mass fractions). Every length is in metres, every angle in
   degrees; x is forward (the athlete faces +x), y is up and z is the
   athlete's right, so a camera at az 0 sees the right side (the near
   limbs are the right arm and leg).

   The shape tables are the outer surface of a lean, athletic build:
   per-station anterior / posterior / half-width extents of each limb,
   measured from its bone axis, and of the trunk, measured from the spine
   (vertebral body line). They were set from the CrossFit Level 1 Training
   Guide's movement photographs (pp. 171-216) and checked against common
   circumferences (mid-thigh about 55 cm, calf 38 cm, waist 80 cm, chest
   100 cm).
   ========================================================================= */

export const BODY = {
  height: 1.78,

  /* ------------------------------ feet ------------------------------ */
  /** ankle joint centre above the floor (foot flat) */
  ankleH: 0.075,
  /** heel's back edge behind the ankle centre (along the foot) */
  heel: 0.062,
  /** ball of the foot (first metatarsal head, the heel-rise pivot) ahead of the ankle */
  ball: 0.152,
  /** toe tip ahead of the ankle */
  toe: 0.213,
  /** each foot is turned out by this (deg); knees in line with toes follow it */
  toeOut: 15,
  /** ankle centres from the midline: a shoulder-width stance */
  stance: 0.16,

  /* ------------------------------ legs ------------------------------ */
  shank: 0.438,
  thigh: 0.436,
  /** hip joint centres from the midline */
  hipHalf: 0.085,

  /* ------------------------------ spine ----------------------------- */
  /** S1 (lumbosacral joint) in the pelvis frame, relative to the hip-joint midpoint */
  s1: [-0.045, 0.105] as const,
  /** coccyx tip in the pelvis frame */
  coccyx: [-0.07, -0.004] as const,
  /** the sacrum's mid point (concave forward) */
  sacrum: [-0.078, 0.05] as const,
  /** the lumbar spine leaves S1 leaning forward by this, in the pelvis frame (deg) */
  sacralTilt: 28,
  /** S1 to T12 along the lumbar curve */
  lumbar: 0.178,
  /** the thorax chord (T12 to C7) leans this much more than the lumbar curve's end tangent (deg) */
  thoracicTilt: 12,
  /** neutral standing lordosis (deg of tangent change S1 to T12) */
  lordosis: 40,
  /** thorax frame: origin T12, y along the T12 to C7 chord, x anterior */
  c7: [0, 0.27] as const,
  /** the kyphosis apex (T7) off the chord */
  t7: [-0.028, 0.135] as const,
  /** glenohumeral joint centre in the thorax frame, and its lateral offset */
  shoulder: [0.062, 0.222] as const,
  shoulderHalf: 0.19,
  /** C7 to the skull base (C1) */
  neck: 0.105,
  /** the neck leans forward of the thorax / head average by this in neutral (deg) */
  neckTilt: 20,

  /* ------------------------------ arms ------------------------------ */
  upperArm: 0.33,
  forearm: 0.26,
  /** wrist to fingertip */
  hand: 0.19,
  /** wrist to the centre of a full grip */
  grip: 0.075,
  /** knuckles, as a fraction of the hand length */
  knuckle: 0.53,
} as const

/** Segment mass fractions (Dempster via Winter) and their centre-of-mass position (fraction from proximal). */
export const MASS = {
  foot: 0.0145,
  shank: 0.0465,
  thigh: 0.1,
  pelvis: 0.142,
  abdomen: 0.139,
  thorax: 0.216,
  head: 0.081,
  upperArm: 0.028,
  forearm: 0.016,
  hand: 0.006,
  /** CoM along the segment from its proximal joint */
  thighCom: 0.433,
  shankCom: 0.433,
  upperArmCom: 0.436,
  forearmCom: 0.43,
} as const

/* ------------------------------ shapes -------------------------------- */

/**
 * One limb station: u along the bone (0 proximal joint, 1 distal joint),
 * extents from the bone axis: a anterior, p posterior, w half-width.
 */
export type Station = readonly [u: number, a: number, p: number, w: number]

/** Thigh, hip (0) to knee (1). Quadriceps in front, hamstrings behind, the patella at the knee. */
export const THIGH: readonly Station[] = [
  [0, 0.088, 0.078, 0.098],
  [0.12, 0.096, 0.086, 0.098],
  [0.3, 0.094, 0.09, 0.09],
  [0.5, 0.086, 0.082, 0.083],
  [0.7, 0.074, 0.07, 0.072],
  [0.86, 0.064, 0.06, 0.062],
  [1, 0.056, 0.056, 0.058],
]

/** Shank, knee (0) to ankle (1). The shin is a straight bony line, the calf bulges behind. */
export const SHANK: readonly Station[] = [
  [0, 0.056, 0.056, 0.058],
  [0.1, 0.05, 0.068, 0.058],
  [0.28, 0.04, 0.082, 0.058],
  [0.45, 0.036, 0.072, 0.052],
  [0.65, 0.032, 0.05, 0.042],
  [0.85, 0.03, 0.034, 0.034],
  [1, 0.034, 0.034, 0.034],
]

/** Upper arm, shoulder (0) to elbow (1). The deltoid caps the shoulder. */
export const UPPER_ARM: readonly Station[] = [
  [0, 0.06, 0.062, 0.066],
  [0.12, 0.06, 0.062, 0.066],
  [0.35, 0.05, 0.056, 0.05],
  [0.55, 0.05, 0.052, 0.045],
  [0.8, 0.042, 0.042, 0.042],
  [1, 0.038, 0.038, 0.04],
]

/** Forearm, elbow (0) to wrist (1). */
export const FOREARM: readonly Station[] = [
  [0, 0.038, 0.038, 0.04],
  [0.2, 0.044, 0.04, 0.046],
  [0.5, 0.036, 0.032, 0.038],
  [0.8, 0.026, 0.024, 0.032],
  [1, 0.022, 0.022, 0.03],
]

/** Hand, wrist (0) to fingertips (1): a = p = half thickness, w = half width. */
export const HAND: readonly Station[] = [
  [0, 0.016, 0.016, 0.028],
  [0.2, 0.017, 0.017, 0.042],
  [0.5, 0.016, 0.016, 0.044],
  [0.62, 0.014, 0.014, 0.042],
  [0.85, 0.011, 0.011, 0.036],
  [1, 0.008, 0.008, 0.02],
]

/**
 * Foot, along the foot from the heel to the toe tip (x relative to the
 * ankle centre): height of the top surface above the sole, half-width.
 */
export const FOOT: readonly (readonly [x: number, top: number, w: number])[] = [
  [-0.062, 0.05, 0.03],
  [-0.045, 0.082, 0.034],
  [-0.01, 0.105, 0.036],
  [0.04, 0.094, 0.04],
  [0.09, 0.072, 0.046],
  [0.135, 0.056, 0.05],
  [0.17, 0.042, 0.047],
  [0.2, 0.03, 0.04],
  [0.213, 0.018, 0.03],
]

/**
 * The trunk and neck, along the spine from the coccyx (sigma 0) to the
 * skull base: f anterior and b posterior of the spine, w half-width.
 * Sigma is the arc length along the spine centreline in metres; the
 * landmarks sit at about: coccyx 0, S1 0.115, L3 0.205, T12 0.293,
 * T7 0.43, C7 0.568, C1 0.673.
 */
export const TRUNK: readonly (readonly [sigma: number, f: number, b: number, w: number])[] = [
  [-0.05, 0.1, 0.035, 0.1],
  [-0.03, 0.14, 0.082, 0.14],
  [0, 0.165, 0.097, 0.162],
  [0.04, 0.172, 0.096, 0.172],
  [0.08, 0.162, 0.088, 0.17],
  [0.115, 0.15, 0.076, 0.16],
  [0.16, 0.142, 0.068, 0.146],
  [0.205, 0.14, 0.064, 0.14],
  [0.25, 0.148, 0.064, 0.144],
  [0.293, 0.162, 0.066, 0.152],
  [0.35, 0.19, 0.076, 0.163],
  [0.41, 0.2, 0.086, 0.17],
  [0.47, 0.19, 0.088, 0.178],
  [0.52, 0.16, 0.08, 0.172],
  [0.55, 0.11, 0.06, 0.14],
  [0.575, 0.075, 0.05, 0.095],
  [0.61, 0.066, 0.046, 0.062],
  [0.645, 0.062, 0.044, 0.056],
  [0.673, 0.058, 0.042, 0.054],
]

/**
 * The head's profile in the head frame (origin at C1, the skull base; x
 * toward the face, y up), clockwise from the crown: a real face in profile
 * (brow, nose, lips, chin, jaw) and the round back of the skull. The mesh
 * revolves it about the head centre with a lateral width per angle; the
 * nose and lips narrow fast away from the midline.
 */
export const HEAD_POLY: readonly (readonly [x: number, y: number])[] = [
  [0.02, 0.196],
  [0.075, 0.185],
  [0.108, 0.158],
  [0.122, 0.122],
  [0.126, 0.1],
  [0.121, 0.087],
  [0.13, 0.072],
  [0.141, 0.054],
  [0.15, 0.042],
  [0.143, 0.033],
  [0.128, 0.026],
  [0.131, 0.014],
  [0.127, 0.003],
  [0.13, -0.008],
  [0.123, -0.02],
  [0.127, -0.034],
  [0.12, -0.048],
  [0.1, -0.06],
  [0.065, -0.058],
  [0.03, -0.045],
  [0.008, -0.022],
  [-0.025, 0.004],
  [-0.058, 0.03],
  [-0.078, 0.065],
  [-0.083, 0.1],
  [-0.074, 0.14],
  [-0.05, 0.172],
  [-0.018, 0.192],
]

/** The point the head is revolved about (inside the skull). */
export const HEAD_CENTRE = [0.03, 0.085] as const

/** Head half-width by profile angle about HEAD_CENTRE (0 = face forward, 90 = crown). */
export const HEAD_WIDTH: readonly (readonly [deg: number, w: number])[] = [
  [-90, 0.052],
  [-60, 0.058],
  [-35, 0.06],
  [-10, 0.066],
  [15, 0.072],
  [45, 0.077],
  [120, 0.079],
  [200, 0.071],
  [250, 0.058],
  [270, 0.052],
]

/** Profile features that are narrow across the face: [angle deg, half-span deg, lateral falloff (rad)]. */
export const HEAD_NARROW: readonly (readonly [deg: number, span: number, falloff: number])[] = [
  [-16, 14, 0.2],
  [-38, 13, 0.42],
]

/** The ear, on each side of the head: centre in the head frame, half-sizes (height, depth, thickness). */
export const EAR = { x: -0.012, y: 0.072, z: 0.073, h: 0.031, d: 0.017, t: 0.012 } as const

/** The head frame: origin at C1 (skull base); the head centre, crown, eye and chin in it. */
export const HEAD = {
  center: [0.03, 0.085] as const,
  crown: [0.02, 0.196] as const,
  eye: [0.112, 0.094] as const,
  chin: [0.122, -0.042] as const,
  /** the nose tip (the rack keeps the ball clear of it) */
  nose: [0.15, 0.042] as const,
} as const

/** Piecewise-linear lookup in a sorted table of [key, ...values] rows, column `col`. */
export function lookup(table: readonly (readonly number[])[], key: number, col: number): number {
  const n = table.length
  if (key <= table[0][0]) return table[0][col]
  if (key >= table[n - 1][0]) return table[n - 1][col]
  let i = 0
  while (i < n - 2 && table[i + 1][0] < key) i++
  const a = table[i]
  const b = table[i + 1]
  const k = (key - a[0]) / (b[0] - a[0])
  return a[col] + (b[col] - a[col]) * k
}

/** Smooth lookup: Catmull-Rom through the rows (no flat facets between stations). */
export function lookupSmooth(table: readonly (readonly number[])[], key: number, col: number): number {
  const n = table.length
  if (key <= table[0][0]) return table[0][col]
  if (key >= table[n - 1][0]) return table[n - 1][col]
  let i = 0
  while (i < n - 2 && table[i + 1][0] < key) i++
  const p1 = table[i]
  const p2 = table[i + 1]
  const h = p2[0] - p1[0]
  const t = (key - p1[0]) / h
  // slopes: central differences inside the table, one-sided at its ends; scaled to the interval
  const s1 = i > 0 ? (p2[col] - table[i - 1][col]) / (p2[0] - table[i - 1][0]) : (p2[col] - p1[col]) / h
  const s2 = i + 2 < n ? (table[i + 2][col] - p1[col]) / (table[i + 2][0] - p1[0]) : (p2[col] - p1[col]) / h
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * p1[col] + (t3 - 2 * t2 + t) * s1 * h + (-2 * t3 + 3 * t2) * p2[col] + (t3 - t2) * s2 * h
}
