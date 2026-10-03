/* =========================================================================
   07 CROSSFIT: the coach's chalk figure (STORYBOARD-crossfit.md, "One visual
   grammar for the movement beats"). A stick figure of unit height built by
   forward kinematics from a handful of RELATIVE joint angles, so "which
   joints work" is read straight from the angles: a joint WORKS when its
   angle changes by WORK_DEG or more across the movement (computed from the
   keyframes, never hand-listed). Pure functions only; the scene evaluates
   them from story time.

   Body frame: y up, z forward (the way the figure faces), x to its side
   (s = +1 / -1). The pelvis is the root; a movement's anchor (feet on the
   floor, pelvis on a seat, hands on a bar) fixes where the body sits.
   ========================================================================= */

export type Anchor = 'feet' | 'seat' | 'hands'

/** Relative joint angles in degrees. */
export interface Pose {
  /** trunk lean from vertical, + forward */
  trunk: number
  /** hip flexion: trunk-down to thigh, 0 straight */
  hip: number
  /** knee flexion, 0 straight */
  knee: number
  /** shoulder flexion in the sagittal plane, relative to the trunk */
  shoulder: number
  /** elbow flexion in the sagittal plane, 0 straight */
  elbow: number
  /** upper-arm and forearm abduction (frontal plane), 0 = in the sagittal plane, 180 = straight up */
  abdU: number
  abdF: number
  /** head nod relative to the trunk, + forward */
  neck: number
}

export interface Key {
  /** movement progress 0..1 */
  p: number
  pose: Pose
}

export type PropKind = 'none' | 'box' | 'crate' | 'bells' | 'barbell' | 'bar' | 'machine'

export interface Movement {
  name: string
  anchor: Anchor
  keys: readonly Key[]
  prop: PropKind
  /** anchor height in body units: seat (pelvis) or bar (wrists) */
  anchorY?: number
}

/* ------------------------------ body ---------------------------------- */

export const BODY = {
  footH: 0.045,
  shin: 0.245,
  thigh: 0.245,
  trunk: 0.295,
  neck: 0.035,
  headR: 0.062,
  uarm: 0.165,
  farm: 0.155,
  hipW: 0.055,
  shoW: 0.105,
  heel: 0.035,
  toe: 0.1,
} as const

/** A joint "works" in a movement when its angle changes by at least this many degrees. */
export const WORK_DEG = 12

const D2R = Math.PI / 180

export const pose = (o: Partial<Pose>): Pose => ({
  trunk: 0,
  hip: 0,
  knee: 0,
  shoulder: 0,
  elbow: 0,
  abdU: 5,
  abdF: 5,
  neck: 0,
  ...o,
})

const STAND = pose({})

/* ---------------------------- movements ------------------------------- */

/** C1 left / C0 icon: squatting is standing from a seated position (Foundations p. 14). */
export const SIT_TO_STAND: Movement = {
  name: 'sit-to-stand',
  anchor: 'feet',
  prop: 'box',
  keys: [
    { p: 0, pose: pose({ trunk: 12, hip: 102, knee: 90, neck: 4, shoulder: 34, elbow: 52, abdU: 4, abdF: 4 }) },
    { p: 0.42, pose: pose({ trunk: 44, hip: 124, knee: 98, neck: 10, shoulder: 74, elbow: 10, abdU: 4, abdF: 4 }) },
    { p: 1, pose: pose({ trunk: 2, hip: 2, knee: 0, shoulder: 6, elbow: 8, abdU: 4, abdF: 4 }) },
  ],
}

/** C1 right: deadlifting is picking any object off the ground (Foundations p. 14). */
export const DEADLIFT: Movement = {
  name: 'deadlift',
  anchor: 'feet',
  prop: 'crate',
  keys: [
    { p: 0, pose: pose({ abdU: 4, abdF: 4 }) },
    { p: 0.38, pose: pose({ trunk: 58, hip: 120, knee: 84, shoulder: 64, neck: -22, abdU: 4, abdF: 4 }) },
    { p: 0.5, pose: pose({ trunk: 58, hip: 120, knee: 84, shoulder: 64, neck: -22, abdU: 4, abdF: 4 }) },
    { p: 1, pose: pose({ shoulder: 14, abdU: 4, abdF: 4 }) },
  ],
}

/** C2 row 1, isolation: the lateral raise (shoulders only). */
export const LATERAL_RAISE: Movement = {
  name: 'lateral raise',
  anchor: 'feet',
  prop: 'bells',
  keys: [
    { p: 0, pose: pose({ abdU: 6, abdF: 6 }) },
    { p: 1, pose: pose({ abdU: 88, abdF: 88 }) },
  ],
}

/** C2 row 1, functional: the push press: dip and drive (hips, knees, ankles), THEN press (shoulders, elbows). */
const RACK = { shoulder: 62, elbow: 108, abdU: 14, abdF: 14 }
export const PUSH_PRESS: Movement = {
  name: 'push press',
  anchor: 'feet',
  prop: 'barbell',
  keys: [
    { p: 0, pose: pose({ ...RACK }) },
    { p: 0.22, pose: pose({ hip: 26, knee: 50, ...RACK }) },
    { p: 0.42, pose: pose({ hip: 0, knee: 0, shoulder: 80, elbow: 96, abdU: 12, abdF: 12 }) },
    { p: 0.86, pose: pose({ shoulder: 178, elbow: 2, abdU: 7, abdF: 7 }) },
    { p: 1, pose: pose({ shoulder: 178, elbow: 2, abdU: 7, abdF: 7 }) },
  ],
}

/** C2 row 2, isolation: the curl (elbows only). */
export const CURL: Movement = {
  name: 'curl',
  anchor: 'feet',
  prop: 'bells',
  keys: [
    { p: 0, pose: pose({ shoulder: 4, abdU: 7, abdF: 7 }) },
    { p: 1, pose: pose({ shoulder: 4, elbow: 136, abdU: 7, abdF: 7 }) },
  ],
}

/** C2 row 2, functional: the pull-up from a hang to the chin over the bar (shoulders and elbows; the body rises). */
export const PULL_UP: Movement = {
  name: 'pull-up',
  anchor: 'hands',
  prop: 'bar',
  anchorY: 1.3,
  keys: [
    { p: 0, pose: pose({ hip: 4, knee: 14, abdU: 168, abdF: 168 }) },
    { p: 1, pose: pose({ hip: 10, knee: 22, abdU: 62, abdF: 160, neck: -6 }) },
  ],
}

/** C2 row 3, isolation: the leg extension on its machine (knees only). */
export const LEG_EXTENSION: Movement = {
  name: 'leg extension',
  anchor: 'seat',
  prop: 'machine',
  anchorY: 0.44,
  keys: [
    { p: 0, pose: pose({ trunk: -8, hip: 82, knee: 88, shoulder: 12, elbow: 24, abdU: 10, abdF: 10 }) },
    { p: 1, pose: pose({ trunk: -8, hip: 82, knee: 6, shoulder: 12, elbow: 24, abdU: 10, abdF: 10 }) },
  ],
}

/** C2 row 3, functional: the air squat (hips, knees, ankles, and the arms reach forward). */
export const SQUAT: Movement = {
  name: 'squat',
  anchor: 'feet',
  prop: 'none',
  keys: [
    { p: 0, pose: STAND },
    { p: 1, pose: pose({ trunk: 42, hip: 142, knee: 135, shoulder: 122, elbow: 0, neck: -14, abdU: 6, abdF: 6 }) },
  ],
}

/* --------------------------- evaluation ------------------------------- */

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/** Interpolate a movement's pose at progress p (each key-to-key span eased in and out). */
export function poseAt(m: Movement, p: number, out: Pose): Pose {
  const k = m.keys
  if (p <= k[0].p) return Object.assign(out, k[0].pose)
  const last = k[k.length - 1]
  if (p >= last.p) return Object.assign(out, last.pose)
  let i = 0
  while (i < k.length - 2 && p > k[i + 1].p) i++
  const a = k[i]
  const b = k[i + 1]
  const f = smooth((p - a.p) / Math.max(1e-6, b.p - a.p))
  out.trunk = a.pose.trunk + (b.pose.trunk - a.pose.trunk) * f
  out.hip = a.pose.hip + (b.pose.hip - a.pose.hip) * f
  out.knee = a.pose.knee + (b.pose.knee - a.pose.knee) * f
  out.shoulder = a.pose.shoulder + (b.pose.shoulder - a.pose.shoulder) * f
  out.elbow = a.pose.elbow + (b.pose.elbow - a.pose.elbow) * f
  out.abdU = a.pose.abdU + (b.pose.abdU - a.pose.abdU) * f
  out.abdF = a.pose.abdF + (b.pose.abdF - a.pose.abdF) * f
  out.neck = a.pose.neck + (b.pose.neck - a.pose.neck) * f
  return out
}

/** Joint indices into a Skeleton's point list. */
export const J = {
  pelvis: 0,
  chest: 1,
  neckTop: 2,
  head: 3,
  // per side: s = 0 for +x, 1 for -x
  hip: 4,
  knee: 6,
  ankle: 8,
  heel: 10,
  toe: 12,
  shoulder: 14,
  elbow: 16,
  wrist: 18,
} as const
export const N_POINTS = 20
/** The twelve joints that carry a dot (hips, knees, ankles, shoulders, elbows, wrists; both sides). */
export const DOT_JOINTS = [J.hip, J.hip + 1, J.knee, J.knee + 1, J.ankle, J.ankle + 1, J.shoulder, J.shoulder + 1, J.elbow, J.elbow + 1, J.wrist, J.wrist + 1] as const

/** Body-frame skeleton: N_POINTS xyz, anchored (feet on the floor at the origin, or the seat / bar). */
export type Skeleton = Float32Array

const SIDES = [1, -1] as const

function armDir(theta: number, beta: number, s: number, out: [number, number, number]) {
  const t = theta * D2R
  const b = beta * D2R
  out[0] = s * Math.sin(b)
  out[1] = -Math.cos(b) * Math.cos(t)
  out[2] = Math.cos(b) * Math.sin(t)
}

const _u: [number, number, number] = [0, 0, 0]
const _f: [number, number, number] = [0, 0, 0]

/** Forward kinematics: write the body-frame points of pose `q` under movement `m`'s anchor into `out`. */
export function skeleton(m: Movement, q: Pose, out: Skeleton): Skeleton {
  const B = BODY
  const tb = q.trunk
  const tt = q.hip - tb
  const ts = tt - q.knee
  const tu = q.shoulder - tb
  const tf = tu + q.elbow
  const th = 0.45 * tb + q.neck
  const ct = Math.cos(tt * D2R)
  const st = Math.sin(tt * D2R)
  const cs = Math.cos(ts * D2R)
  const ss = Math.sin(ts * D2R)
  const cb = Math.cos(tb * D2R)
  const sb = Math.sin(tb * D2R)
  const set = (i: number, x: number, y: number, z: number) => {
    out[i * 3] = x
    out[i * 3 + 1] = y
    out[i * 3 + 2] = z
  }
  set(J.pelvis, 0, 0, 0)
  const cx = 0
  const cy = cb * B.trunk
  const cz = sb * B.trunk
  set(J.chest, cx, cy, cz)
  const ny = cy + cb * B.neck
  const nz = cz + sb * B.neck
  set(J.neckTop, 0, ny, nz)
  set(J.head, 0, ny + Math.cos(th * D2R) * B.headR, nz + Math.sin(th * D2R) * B.headR)
  const flat = m.anchor === 'feet'
  for (let k = 0; k < 2; k++) {
    const s = SIDES[k]
    const hx = s * B.hipW
    set(J.hip + k, hx, 0, 0)
    const kx = hx
    const ky = -ct * B.thigh
    const kz = st * B.thigh
    set(J.knee + k, kx, ky, kz)
    const ax = hx
    const ay = ky - cs * B.shin
    const az = kz + ss * B.shin
    set(J.ankle + k, ax, ay, az)
    if (flat) {
      set(J.heel + k, ax, ay - B.footH, az - B.heel)
      set(J.toe + k, ax, ay - B.footH, az + B.toe)
    } else {
      // the foot hangs perpendicular to the shin
      const fy = ss
      const fz = cs
      set(J.heel + k, ax, ay - fy * B.heel - cs * B.footH * 0.6, az - fz * B.heel + ss * B.footH * 0.6)
      set(J.toe + k, ax, ay + fy * B.toe - cs * B.footH * 0.6, az + fz * B.toe + ss * B.footH * 0.6)
    }
    const sx = cx + s * B.shoW
    set(J.shoulder + k, sx, cy, cz)
    armDir(tu, q.abdU, s, _u)
    const ex = sx + _u[0] * B.uarm
    const ey = cy + _u[1] * B.uarm
    const ez = cz + _u[2] * B.uarm
    set(J.elbow + k, ex, ey, ez)
    armDir(tf, q.abdF, s, _f)
    set(J.wrist + k, ex + _f[0] * B.farm, ey + _f[1] * B.farm, ez + _f[2] * B.farm)
  }
  // the anchor: shift the whole body
  let dy = 0
  let dz = 0
  if (m.anchor === 'feet') {
    dy = B.footH - out[J.ankle * 3 + 1]
    dz = -out[J.ankle * 3 + 2]
  } else if (m.anchor === 'seat') {
    dy = m.anchorY ?? 0.44
  } else {
    const wy = (out[J.wrist * 3 + 1] + out[(J.wrist + 1) * 3 + 1]) / 2
    const wz = (out[J.wrist * 3 + 2] + out[(J.wrist + 1) * 3 + 2]) / 2
    dy = (m.anchorY ?? 1.3) - wy
    dz = -wz
  }
  for (let i = 0; i < N_POINTS; i++) {
    out[i * 3 + 1] += dy
    out[i * 3 + 2] += dz
  }
  return out
}

/* --------------------------- joint angles ----------------------------- */

/** The six joint angles of one side (hip, knee, ankle, shoulder, elbow, wrist = 0), from the skeleton's vectors. */
export const ANGLES = 6
const _a = [0, 0, 0]
const _b = [0, 0, 0]
function angleBetween(sk: Skeleton, a0: number, a1: number, b0: number, b1: number): number {
  for (let c = 0; c < 3; c++) {
    _a[c] = sk[a1 * 3 + c] - sk[a0 * 3 + c]
    _b[c] = sk[b1 * 3 + c] - sk[b0 * 3 + c]
  }
  const la = Math.hypot(_a[0], _a[1], _a[2]) || 1
  const lb = Math.hypot(_b[0], _b[1], _b[2]) || 1
  const d = (_a[0] * _b[0] + _a[1] * _b[1] + _a[2] * _b[2]) / (la * lb)
  return Math.acos(Math.max(-1, Math.min(1, d))) / D2R
}

/**
 * Joint angles (degrees) of side k: [hip, knee, ankle, shoulder, elbow, wrist].
 * Hip: chest-to-pelvis line against the thigh; knee: thigh against shin;
 * ankle: shin against the vertical (flat feet only); shoulder: shoulder-to-
 * pelvis line against the upper arm; elbow: upper arm against forearm.
 */
export function jointAngles(m: Movement, sk: Skeleton, k: number, out: number[]): number[] {
  const hip = J.hip + k
  const knee = J.knee + k
  const ankle = J.ankle + k
  const sh = J.shoulder + k
  const el = J.elbow + k
  const wr = J.wrist + k
  // hip: (hip -> chest) vs (hip -> knee): 180 when straight
  out[0] = 180 - angleBetween(sk, hip, J.chest, hip, knee)
  out[1] = angleBetween(sk, hip, knee, knee, ankle)
  if (m.anchor === 'feet') {
    // shin against the vertical
    const dy = sk[knee * 3 + 1] - sk[ankle * 3 + 1]
    const dz = sk[knee * 3 + 2] - sk[ankle * 3 + 2]
    out[2] = Math.atan2(dz, dy) / D2R
  } else out[2] = 0
  // shoulder: (shoulder -> hip) vs (shoulder -> elbow): 0 when the arm hangs along the trunk
  out[3] = angleBetween(sk, sh, hip, sh, el)
  out[4] = angleBetween(sk, sh, el, el, wr)
  out[5] = 0
  return out
}

/** DOT_JOINTS order -> the angle index that joint reports (wrists report none). */
export const DOT_ANGLE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, -1, -1] as const

/** For each of the 12 dot joints, whether it works across the movement (range of its angle >= WORK_DEG). */
export function workedJoints(m: Movement): boolean[] {
  const q = pose({})
  const sk = new Float32Array(N_POINTS * 3)
  const lo = [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity]
  const ang = [0, 0, 0, 0, 0, 0]
  const loB = lo.slice()
  const hiB = hi.slice()
  for (let i = 0; i <= 60; i++) {
    skeleton(m, poseAt(m, i / 60, q), sk)
    jointAngles(m, sk, 0, ang)
    for (let a = 0; a < ANGLES; a++) {
      lo[a] = Math.min(lo[a], ang[a])
      hi[a] = Math.max(hi[a], ang[a])
    }
    jointAngles(m, sk, 1, ang)
    for (let a = 0; a < ANGLES; a++) {
      loB[a] = Math.min(loB[a], ang[a])
      hiB[a] = Math.max(hiB[a], ang[a])
    }
  }
  return DOT_ANGLE.map((a, j) => {
    if (a < 0) return false
    const side = j % 2
    const range = side === 0 ? hi[a] - lo[a] : hiB[a] - loB[a]
    return range >= WORK_DEG
  })
}

/** Body-frame bounds of a movement over its whole range (all keys and between), for camera fits. */
export function movementBounds(m: Movement): { min: [number, number, number]; max: [number, number, number] } {
  const q = pose({})
  const sk = new Float32Array(N_POINTS * 3)
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i <= 40; i++) {
    skeleton(m, poseAt(m, i / 40, q), sk)
    for (let p = 0; p < N_POINTS; p++) {
      for (let c = 0; c < 3; c++) {
        const v = sk[p * 3 + c] + (p === J.head && c === 1 ? BODY.headR : 0)
        min[c] = Math.min(min[c], v)
        max[c] = Math.max(max[c], v)
      }
    }
  }
  return { min, max }
}
