import { BODY, HEAD, MASS, THIGH, TRUNK, lookup } from './body'
import { DEG, addK, boneFrame, copy, cross, dot, lean2, len, newFrame, norm, set, sub, v3, type Frame, type Vec } from './vec'

/* =========================================================================
   The athlete's rig (story/kit/athlete): pose parameters in joint space ->
   a posed skeleton in world space, as a pure function.

   Why joint space: every bone keeps its length in every frame, the feet
   stay planted (the legs are solved from the floor up by two-bone IK), and
   interpolating angles makes joints travel on arcs the way bodies move.
   The July page keyframed joint POSITIONS, so limbs stretched between keys
   and the feet slid; this rig cannot do either.

   The chain, for one frame:
     1. feet: planted at the stance, toes turned out; a heel rise rotates
        the foot about the ball of the foot (the toes stay on the floor);
     2. hips: the pelvis centre at height `hy`; its x is SOLVED so the
        whole-body centre of mass (bar included) sits over the target,
        mid-foot by default (the balance the coaching cues describe);
     3. knees: two-bone IK from each hip to its ankle; the knee swivels
        about the hip-ankle axis toward the foot's direction (knees in line
        with toes), or toward the midline by `valgus` (knees caving);
     4. spine: pelvis -> the lumbar curve (a constant-curvature arc with
        `lord` degrees of lordosis) -> the thorax at `lean` -> neck -> head;
     5. arms: free (angles), on a bar overhead (locked arms, the bar over
        the target x) or in the front rack (the bar on the shoulders, the
        elbows solved high).

   Coordinates: metres, x forward (the athlete faces +x), y up, z the
   athlete's right. Mid-foot is the origin: the plumb line is x = 0.
   Side 0 is the right (near the az-0 camera), side 1 the left.
   Nothing here allocates per call: a Pose owns its vectors.
   ========================================================================= */

export type { Vec, Frame }

/** Joint-space pose parameters (what keyframes hold and faults modify). */
export interface PoseParams {
  /** pelvis centre (hip-joint midpoint) height, m */
  hy: number
  /** thorax lean from vertical, deg (forward +) */
  lean: number
  /** lumbar lordosis, deg: 40 neutral standing, 0 flat, negative rounded */
  lord: number
  /** head lean, deg (chin down +; 0 = eyes on the horizon) */
  head: number
  /** upper-arm angle from hanging, deg: 0 down, 90 forward, 180 overhead (free arms) */
  arm: number
  /** elbow flexion, deg (free arms) */
  elbow: number
  /** wrist extension, deg (free arms; fingers toward the back of the hand +) */
  wrist: number
  /** finger curl, deg (free arms; 0 open, 90 a fist) */
  curl: number
  /** shoulder elevation, m (a shrug; shoulders pushing up into the bar) */
  shrug: number
  /** heel rise, deg about the ball of the foot */
  heel: number
  /** knee swivel from over-the-toes toward the midline, deg (0 = knees in line with toes) */
  valgus: number
  /** balance target: the centre of mass x relative to mid-foot, m (forward +) */
  com: number
  /** hips held forward of the balanced position, m (the line-of-action fault) */
  hipFwd: number
  /** the bar's x relative to mid-foot, m (the bar drifting forward +; loaded holds) */
  barOff: number
  /** ball hold: 0 = hanging in straight arms (palms on its sides), 1 = in the rack at the chin (hands under it) */
  rack: number
}

export const NEUTRAL: Readonly<PoseParams> = {
  hy: 0.94,
  lean: 0,
  lord: BODY.lordosis,
  head: 0,
  arm: 0,
  elbow: 5,
  wrist: 0,
  curl: 10,
  shrug: 0,
  heel: 0,
  valgus: 0,
  com: 0,
  hipFwd: 0,
  barOff: 0,
  rack: 0,
}

export const PARAM_KEYS = Object.keys(NEUTRAL) as readonly (keyof PoseParams)[]

/** How the hands are placed. */
export type Hold =
  | { kind: 'free' }
  /** locked arms on a bar overhead; `grip` = hands from the midline; `mass` = bar mass / body mass */
  | { kind: 'overhead'; grip: number; mass: number }
  /** the front rack: the bar on the shoulders, elbows high; `grip` = hands from the midline */
  | { kind: 'rack'; grip: number; mass: number }
  /**
   * a medicine ball of radius `r` (m): on the floor between the feet at the set-up, in straight arms
   * with the palms on its sides through the pull, pulled under to the rack at the chin (`rack` 0 -> 1).
   * `mass` = ball mass / body mass; it loads the balance only once the ball leaves the floor.
   */
  | { kind: 'ball'; r: number; mass: number }

export const FREE: Hold = { kind: 'free' }

/** Where the feet are: ankle centres from the midline and the toe-out angle (deg). */
export interface Stance {
  half: number
  toeOut: number
}
export const SHOULDER_WIDTH: Stance = { half: BODY.stance, toeOut: BODY.toeOut }

/** Spine centreline samples (coccyx to skull base), for the trunk loft and the lumbar overlays. */
export const SPINE_N = 40
/** The reference arc length of the spine centreline, coccyx to C1 (the TRUNK table's sigma range). */
export const SPINE_LEN = 0.673

/** A posed skeleton. Every field is world space and owned by this object (reused frame to frame). */
export interface Pose {
  params: PoseParams
  hold: Hold
  /** pelvis centre (the hip-joint midpoint) */
  hip: Vec
  hipJ: [Vec, Vec]
  knee: [Vec, Vec]
  ankle: [Vec, Vec]
  ball: [Vec, Vec]
  heel: [Vec, Vec]
  toe: [Vec, Vec]
  /** unit forward of each foot (on the floor) */
  footDir: [Vec, Vec]
  /** heel rise actually applied, deg */
  heelRise: number
  /** pelvis lean (anterior tilt +), thorax lean and head lean, deg */
  pelvis: number
  thorax: number
  headLean: number
  s1: Vec
  l3: Vec
  t12: Vec
  t7: Vec
  c7: Vec
  c1: Vec
  /** the spine centreline: SPINE_N points from the coccyx to C1, evenly spaced */
  spine: Float64Array
  shoulder: [Vec, Vec]
  elbow: [Vec, Vec]
  wrist: [Vec, Vec]
  /** the centre of the grip (or of the open hand) */
  grip: [Vec, Vec]
  fingertip: [Vec, Vec]
  headC: Vec
  eye: Vec
  crown: Vec
  chin: Vec
  /** the implement's centre: the bar, or the medicine ball (loaded holds only) */
  bar: Vec
  hasBar: boolean
  /** share of the implement's weight in the hands, 0 (resting on the floor) .. 1 */
  load: number
  /** the stance the feet were placed with */
  stance: Stance
  /** whole-body centre of mass (bar included) */
  com: Vec
  /** part frames */
  thighF: [Frame, Frame]
  shankF: [Frame, Frame]
  /** the hindfoot frame (it rotates with a heel rise; the toes stay flat) */
  footF: [Frame, Frame]
  upperArmF: [Frame, Frame]
  forearmF: [Frame, Frame]
  handF: [Frame, Frame]
  headF: Frame
  /** finger curl actually applied, deg */
  curl: number
}

export function newPose(): Pose {
  const pair = (): [Vec, Vec] => [v3(), v3()]
  const fpair = (): [Frame, Frame] => [newFrame(), newFrame()]
  return {
    params: { ...NEUTRAL },
    hold: FREE,
    hip: v3(),
    hipJ: pair(),
    knee: pair(),
    ankle: pair(),
    ball: pair(),
    heel: pair(),
    toe: pair(),
    footDir: pair(),
    heelRise: 0,
    pelvis: 0,
    thorax: 0,
    headLean: 0,
    s1: v3(),
    l3: v3(),
    t12: v3(),
    t7: v3(),
    c7: v3(),
    c1: v3(),
    spine: new Float64Array(SPINE_N * 3),
    shoulder: pair(),
    elbow: pair(),
    wrist: pair(),
    grip: pair(),
    fingertip: pair(),
    headC: v3(),
    eye: v3(),
    crown: v3(),
    chin: v3(),
    bar: v3(),
    hasBar: false,
    load: 0,
    stance: SHOULDER_WIDTH,
    com: v3(),
    thighF: fpair(),
    shankF: fpair(),
    footF: fpair(),
    upperArmF: fpair(),
    forearmF: fpair(),
    handF: fpair(),
    headF: newFrame(),
    curl: 0,
  }
}

/* ------------------------------ scratch -------------------------------- */

const _a = v3()
const _b = v3()
const _c = v3()
const _d = v3()
const _u = v3()
const _w = v3()
const _p = v3()
const Z: Vec = [0, 0, 1]

/* ------------------------------ the feet ------------------------------- */

/** Mid-foot (the midpoint of the heel's back and the toe tip) ahead of the ankle centre, along the foot. */
export const MIDFOOT = (BODY.toe - BODY.heel) / 2

let _cb = 1
let _sb = 0
/** A point of foot s, (u0 along the foot from the ball, v0 up), after the heel rise about the ball. */
function footPoint(P: Pose, s: number, out: Vec, u0: number, v0: number): Vec {
  const u = u0 * _cb + v0 * _sb
  const v = -u0 * _sb + v0 * _cb
  const f = P.footDir[s]
  const b = P.ball[s]
  return set(out, b[0] + f[0] * u, v, b[2] + f[2] * u)
}

function placeFeet(P: Pose, heelDeg: number): void {
  const psi = P.stance.toeOut * DEG
  const beta = Math.max(0, heelDeg) * DEG
  _cb = Math.cos(beta)
  _sb = Math.sin(beta)
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? 1 : -1
    const f = set(P.footDir[s], Math.cos(psi), 0, side * Math.sin(psi))
    // the ankle's ground point puts each foot's mid-foot at x = 0
    const gx = -MIDFOOT * f[0]
    const gz = side * P.stance.half
    set(P.ball[s], gx + f[0] * BODY.ball, 0, gz + f[2] * BODY.ball)
    set(P.toe[s], gx + f[0] * BODY.toe, 0, gz + f[2] * BODY.toe)
    footPoint(P, s, P.ankle[s], -BODY.ball, BODY.ankleH)
    footPoint(P, s, P.heel[s], -BODY.ball - BODY.heel, 0)
    const F = P.footF[s]
    copy(F.o, P.ankle[s])
    set(F.x, f[0] * _cb, _sb, f[2] * _cb)
    set(F.y, -f[0] * _sb, _cb, -f[2] * _sb)
    cross(F.z, F.x, F.y)
  }
  P.heelRise = Math.max(0, heelDeg)
}

/* ------------------------------ the legs ------------------------------- */

/** Two-bone IK in 3D: the middle joint on the circle around a -> c, swung toward `pole`. */
function solveTwoBone(mid: Vec, a: Readonly<Vec>, c: Readonly<Vec>, L1: number, L2: number, pole: Readonly<Vec>): void {
  sub(_u, c, a)
  let d = len(_u)
  norm(_u)
  d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-5)
  const k1 = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
  const r = Math.sqrt(Math.max(0, L1 * L1 - k1 * k1))
  const k = dot(pole, _u)
  set(_w, pole[0] - _u[0] * k, pole[1] - _u[1] * k, pole[2] - _u[2] * k)
  if (len(_w) < 1e-6) set(_w, 0, 1, 0)
  norm(_w)
  set(mid, a[0] + _u[0] * k1 + _w[0] * r, a[1] + _u[1] * k1 + _w[1] * r, a[2] + _u[2] * k1 + _w[2] * r)
}

const _e1 = v3()
const _e2 = v3()
const _pm = v3()
const _k = v3()

/**
 * The knee, exactly in line with the toes: of the circle of knee positions
 * the bone lengths allow (around the hip-ankle axis), the one in the foot's
 * own vertical plane (through the ankle, along the foot), in front. Then
 * swung about the hip-ankle axis toward the midline by `valgusDeg` (the
 * knees caving in). Writes the knee and the bend direction (into _p).
 */
function solveKnee(knee: Vec, hip: Readonly<Vec>, ankle: Readonly<Vec>, f: Readonly<Vec>, side: number, valgusDeg: number): void {
  const L1 = BODY.thigh
  const L2 = BODY.shank
  sub(_u, ankle, hip)
  let d = len(_u)
  norm(_u)
  d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-5)
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
  const r = Math.sqrt(Math.max(0, L1 * L1 - a * a))
  // circle basis: e1 = the foot direction made orthogonal to the axis, e2 = axis x e1
  const k0 = dot(f, _u)
  norm(set(_e1, f[0] - _u[0] * k0, f[1] - _u[1] * k0, f[2] - _u[2] * k0))
  cross(_e2, _u, _e1)
  // the foot's vertical plane: normal m = f x up (horizontal), through the ankle
  norm(set(_pm, -f[2], 0, f[0]))
  // m . (C + r (cos th e1 + sin th e2) - ankle) = 0
  const cx = hip[0] + _u[0] * a - ankle[0]
  const cz = hip[2] + _u[2] * a - ankle[2]
  const c0 = _pm[0] * cx + _pm[2] * cz
  const p = dot(_pm, _e1) * r
  const q = dot(_pm, _e2) * r
  const R = Math.sqrt(p * p + q * q)
  let th = 0
  if (R > 1e-9) {
    const phi = Math.atan2(q, p)
    const g = Math.acos(Math.max(-1, Math.min(1, -c0 / R)))
    // two solutions; keep the one whose knee points along the foot (cos th largest)
    const t1 = phi + g
    const t2 = phi - g
    const tp = Math.cos(t1) >= Math.cos(t2) ? t1 : t2
    // a nearly straight leg cannot reach the foot's plane: there the knee bends toward the foot's
    // direction (th 0), and it blends into the exact plane solution as the knee bends (never sideways)
    const reach = Math.abs(c0) / R
    const s = reach >= 1 ? 0 : reach <= 0.75 ? 1 : (1 - reach) / 0.25
    th = tp * s * s * (3 - 2 * s)
  }
  if (valgusDeg !== 0) {
    // the swing direction that moves the knee toward the midline (-side z)
    const dz = -Math.sin(th) * _e1[2] + Math.cos(th) * _e2[2]
    th += valgusDeg * DEG * (dz * side < 0 ? 1 : -1)
  }
  const c = Math.cos(th)
  const sn = Math.sin(th)
  set(_p, _e1[0] * c + _e2[0] * sn, _e1[1] * c + _e2[1] * sn, _e1[2] * c + _e2[2] * sn)
  set(_k, hip[0] + _u[0] * a + _p[0] * r, hip[1] + _u[1] * a + _p[1] * r, hip[2] + _u[2] * a + _p[2] * r)
  copy(knee, _k)
}

function placeLegs(P: Pose, hx: number, hy: number, valgusDeg: number): void {
  set(P.hip, hx, hy, 0)
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? 1 : -1
    set(P.hipJ[s], hx, hy, side * BODY.hipHalf)
    // knees in line with toes (exactly, in the foot's plane); valgus swings them toward the midline
    solveKnee(P.knee[s], P.hipJ[s], P.ankle[s], P.footDir[s], side, valgusDeg)
    // frames: each bone's anterior is the convex side of the knee bend (the knee cap side):
    // bone x n, where n = thigh x shank is the knee's flexion axis. A straight leg falls back to the pole.
    norm(sub(_a, P.knee[s], P.hipJ[s]))
    norm(sub(_b, P.ankle[s], P.knee[s]))
    cross(_c, _a, _b)
    if (len(_c) < 0.02) {
      // nearly straight: the flexion axis from the pole (the knee bends toward the pole)
      cross(_c, _a, _p)
      set(_c, -_c[0], -_c[1], -_c[2])
    }
    norm(_c)
    boneFrame(P.thighF[s], P.hipJ[s], P.knee[s], cross(_d, _a, _c))
    boneFrame(P.shankF[s], P.knee[s], P.ankle[s], cross(_d, _b, _c))
  }
}

/* ------------------------------ the trunk ------------------------------ */

const LUMBAR_STEPS = 12
/** raw centreline (x, y pairs) before the even resampling */
const _raw = new Float64Array(64)
let _rawN = 0
const _cum = new Float64Array(32)

function pushRaw(x: number, y: number): void {
  _raw[_rawN * 2] = x
  _raw[_rawN * 2 + 1] = y
  _rawN++
}

function placeTrunk(P: Pose, p: PoseParams): void {
  const B = BODY
  const thorax = p.lean
  // the pelvis follows from the thorax lean and the lordosis: the thorax chord leans
  // (pelvis + sacral tilt - lordosis + thoracic tilt), so a kept curve tilts the pelvis with the trunk
  const pelvis = thorax - B.sacralTilt + p.lord - B.thoracicTilt
  P.pelvis = pelvis
  P.thorax = thorax
  const hip = P.hip
  _rawN = 0
  // coccyx and the sacrum (rigid with the pelvis)
  lean2(_a, hip, pelvis, B.coccyx[0], B.coccyx[1])
  pushRaw(_a[0], _a[1])
  lean2(_a, hip, pelvis, B.sacrum[0], B.sacrum[1])
  pushRaw(_a[0], _a[1])
  lean2(P.s1, hip, pelvis, B.s1[0], B.s1[1])
  pushRaw(P.s1[0], P.s1[1])
  // the lumbar arc: the tangent leans (pelvis + sacral tilt) at S1 and turns back by `lord` degrees by T12
  const a0 = pelvis + B.sacralTilt
  const ds = B.lumbar / LUMBAR_STEPS
  let x = P.s1[0]
  let y = P.s1[1]
  for (let i = 0; i < LUMBAR_STEPS; i++) {
    const a = (a0 - (p.lord * (i + 0.5)) / LUMBAR_STEPS) * DEG
    x += ds * Math.sin(a)
    y += ds * Math.cos(a)
    pushRaw(x, y)
    if (i === LUMBAR_STEPS / 2 - 1) set(P.l3, x, y, 0)
  }
  set(P.t12, x, y, 0)
  lean2(P.t7, P.t12, thorax, B.t7[0], B.t7[1])
  lean2(P.c7, P.t12, thorax, B.c7[0], B.c7[1])
  // the thoracic curve: a quadratic through T12 (t 0), T7 (t 0.5) and C7 (t 1)
  for (let i = 1; i <= 6; i++) {
    const t = i / 6
    const l0 = 2 * (t - 0.5) * (t - 1)
    const l1 = -4 * t * (t - 1)
    const l2 = 2 * t * (t - 0.5)
    pushRaw(l0 * P.t12[0] + l1 * P.t7[0] + l2 * P.c7[0], l0 * P.t12[1] + l1 * P.t7[1] + l2 * P.c7[1])
  }
  // the neck: C7 -> C1, leaning between the thorax and the head, bowed slightly forward
  P.headLean = p.head
  const neckLean = (thorax + p.head) / 2 + B.neckTilt
  lean2(P.c1, P.c7, neckLean, 0, B.neck)
  const nx = Math.cos(neckLean * DEG)
  const ny = -Math.sin(neckLean * DEG)
  for (let i = 1; i <= 3; i++) {
    const t = i / 3
    const bow = 0.012 * Math.sin(Math.PI * t)
    pushRaw(P.c7[0] + (P.c1[0] - P.c7[0]) * t + nx * bow, P.c7[1] + (P.c1[1] - P.c7[1]) * t + ny * bow)
  }
  resampleSpine(P)
  // the head frame: origin C1, leaning by the head lean
  const H = P.headF
  copy(H.o, P.c1)
  const hc = Math.cos(p.head * DEG)
  const hs = Math.sin(p.head * DEG)
  set(H.x, hc, -hs, 0)
  set(H.y, hs, hc, 0)
  cross(H.z, H.x, H.y)
  lean2(P.headC, P.c1, p.head, HEAD.center[0], HEAD.center[1])
  lean2(P.crown, P.c1, p.head, HEAD.crown[0], HEAD.crown[1])
  lean2(P.eye, P.c1, p.head, HEAD.eye[0], HEAD.eye[1])
  lean2(P.chin, P.c1, p.head, HEAD.chin[0], HEAD.chin[1])
}

/** Resample the raw centreline into SPINE_N points evenly spaced by arc length. */
function resampleSpine(P: Pose): void {
  const n = _rawN
  let total = 0
  _cum[0] = 0
  for (let i = 1; i < n; i++) {
    const dx = _raw[i * 2] - _raw[i * 2 - 2]
    const dy = _raw[i * 2 + 1] - _raw[i * 2 - 1]
    total += Math.sqrt(dx * dx + dy * dy)
    _cum[i] = total
  }
  let j = 0
  for (let k = 0; k < SPINE_N; k++) {
    const s = (total * k) / (SPINE_N - 1)
    while (j < n - 2 && _cum[j + 1] < s) j++
    const seg = _cum[j + 1] - _cum[j]
    const f = seg > 1e-9 ? (s - _cum[j]) / seg : 0
    P.spine[k * 3] = _raw[j * 2] + (_raw[j * 2 + 2] - _raw[j * 2]) * f
    P.spine[k * 3 + 1] = _raw[j * 2 + 1] + (_raw[j * 2 + 3] - _raw[j * 2 + 1]) * f
    P.spine[k * 3 + 2] = 0
  }
}

/* ------------------------------ the arms ------------------------------- */

/** Shoulder to the grip centre, straight. */
const ARM = BODY.upperArm + BODY.forearm + BODY.grip

function placeArms(P: Pose, p: PoseParams): void {
  const B = BODY
  const hold = P.hold
  // the front rack protracts and lifts the shoulders: the deltoids make the shelf the bar rests on
  const rack = hold.kind === 'rack'
  const pro = rack ? 0.032 : 0
  const lift = rack ? 0.02 : 0
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? 1 : -1
    lean2(P.shoulder[s], P.t12, P.thorax, B.shoulder[0] + pro, B.shoulder[1] + p.shrug + lift, side * B.shoulderHalf)
  }
  P.hasBar = hold.kind !== 'free'
  P.load = hold.kind === 'free' ? 0 : 1
  if (hold.kind === 'free') {
    const a1 = p.arm * DEG
    const a2 = (p.arm + p.elbow) * DEG
    const a3 = (p.arm + p.elbow + p.wrist) * DEG
    for (let s = 0; s < 2; s++) {
      const S = P.shoulder[s]
      set(_a, Math.sin(a1), -Math.cos(a1), 0)
      addK(P.elbow[s], S, _a, B.upperArm)
      set(_b, Math.sin(a2), -Math.cos(a2), 0)
      addK(P.wrist[s], P.elbow[s], _b, B.forearm)
      set(_c, Math.sin(a3), -Math.cos(a3), 0)
      addK(P.grip[s], P.wrist[s], _c, B.hand * 0.45)
      addK(P.fingertip[s], P.wrist[s], _c, B.hand)
      // each part's anterior (its flexion side) is z cross bone
      boneFrame(P.upperArmF[s], S, P.elbow[s], cross(_d, Z, _a))
      boneFrame(P.forearmF[s], P.elbow[s], P.wrist[s], cross(_d, Z, _b))
      boneFrame(P.handF[s], P.wrist[s], P.fingertip[s], cross(_d, Z, _c))
    }
    P.curl = p.curl
    return
  }
  if (hold.kind === 'ball') {
    placeBall(P, p, hold.r)
    return
  }
  if (hold.kind === 'overhead') {
    // locked arms; the bar over the line x = barOff, as high as the straight arms reach
    const barX = p.barOff
    let barY = 0
    for (let s = 0; s < 2; s++) {
      const S = P.shoulder[s]
      const dz = hold.grip - Math.abs(S[2])
      const dx = barX - S[0]
      barY += S[1] + Math.sqrt(Math.max(1e-6, ARM * ARM - dz * dz - dx * dx))
    }
    barY /= 2
    set(P.bar, barX, barY, 0)
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1
      const S = P.shoulder[s]
      set(P.grip[s], barX, barY, side * hold.grip)
      norm(sub(_a, P.grip[s], S))
      addK(P.elbow[s], S, _a, B.upperArm)
      addK(P.wrist[s], S, _a, B.upperArm + B.forearm)
      addK(P.fingertip[s], P.wrist[s], _a, B.hand)
      set(_d, -_a[1], _a[0], 0)
      boneFrame(P.upperArmF[s], S, P.elbow[s], _d)
      boneFrame(P.forearmF[s], P.elbow[s], P.wrist[s], _d)
      boneFrame(P.handF[s], P.wrist[s], P.fingertip[s], _d)
    }
    P.curl = 75
    return
  }
  // the front rack: the bar on the front of the shoulders, fingertips under it, elbows high
  lean2(P.bar, P.t12, P.thorax, 0.134, 0.262 + p.shrug, 0)
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? 1 : -1
    const S = P.shoulder[s]
    set(P.grip[s], P.bar[0], P.bar[1], side * hold.grip)
    // the wrist sits forward and below the bar (the hand bent back under it)
    lean2(P.wrist[s], P.grip[s], P.thorax, 0.04, -0.045, 0)
    // elbow: IK shoulder -> wrist, swung forward, up and a little out (upper arm about parallel to the ground)
    // the pole is in the world frame: the elbows stay high as the trunk leans (they must not drop)
    set(_p, 1, 0.3, side * 0.3)
    solveTwoBone(P.elbow[s], S, P.wrist[s], B.upperArm, B.forearm, _p)
    norm(sub(_a, P.grip[s], P.wrist[s]))
    addK(P.fingertip[s], P.wrist[s], _a, B.hand)
    sub(_b, P.elbow[s], S)
    boneFrame(P.upperArmF[s], S, P.elbow[s], set(_d, -_b[1], _b[0], 0))
    sub(_c, P.wrist[s], P.elbow[s])
    boneFrame(P.forearmF[s], P.elbow[s], P.wrist[s], set(_d, -_c[1], _c[0], 0))
    boneFrame(P.handF[s], P.wrist[s], P.fingertip[s], set(_d, _a[1], -_a[0], 0))
  }
  P.curl = 35
}

/* ------------------------------ the ball ------------------------------ */

/** The ball hold's constants (the guide's p. 208 photographs). */
export const BALL_HOLD = {
  /** shoulder to the palm centre with the arm all but straight (the elbows keep about 8 degrees) */
  reach: BODY.upperArm + BODY.forearm + 0.068,
  /** the rack: the ball rests against the chin: its centre is (r + gap) from the chin, this many degrees up from forward */
  rackGap: 0.012,
  rackAngle: 16,
  /** the wrist sits this far from the palm centre, back along the fingers */
  palm: 0.07,
  /** the ball leaves the floor over this height (its weight moves into the hands) */
  liftZone: 0.03,
} as const

const _hang = v3()
const _rk = v3()
const _nose = v3()
const _cn = v3()
const _fd = v3()
const _pole = v3()

/**
 * Hang (rack 0): the palms on the ball's sides at the end of straight arms
 * hanging at `arm` degrees from vertical; the ball on the floor when the
 * arms reach lower than its radius (the elbows bend instead).
 * Rack (rack 1): the ball in front of the chin, the hands under it, the
 * elbows down. In between (the pull-under) the ball travels up close to the
 * body while the elbows go high and outside and the hands rotate under it.
 */
function placeBall(P: Pose, p: PoseParams, r: number): void {
  const B = BODY
  const H = BALL_HOLD
  const sx = (P.shoulder[0][0] + P.shoulder[1][0]) / 2
  const sy = (P.shoulder[0][1] + P.shoulder[1][1]) / 2
  const a = p.arm * DEG
  set(_hang, sx + H.reach * Math.sin(a), sy - H.reach * Math.cos(a), 0)
  // the rack: the ball rests against the chin and the top of the chest (p. 208: "the ball in the rack
  // position"), and never through the face: pushed forward until it clears the nose tip
  const ra = H.rackAngle * DEG
  set(_rk, P.chin[0] + (r + H.rackGap) * Math.cos(ra), P.chin[1] + (r + H.rackGap) * Math.sin(ra), 0)
  lean2(_nose, P.c1, P.headLean, HEAD.nose[0], HEAD.nose[1])
  const ndy = _rk[1] - _nose[1]
  const need = r + H.rackGap
  if ((_rk[0] - _nose[0]) * (_rk[0] - _nose[0]) + ndy * ndy < need * need) _rk[0] = _nose[0] + Math.sqrt(Math.max(0, need * need - ndy * ndy))
  const k = p.rack <= 0 ? 0 : p.rack >= 1 ? 1 : p.rack * p.rack * (3 - 2 * p.rack)
  const bx = _hang[0] + (_rk[0] - _hang[0]) * k
  const by = Math.max(r, _hang[1] + (_rk[1] - _hang[1]) * k)
  set(P.bar, bx, by, 0)
  const lifted = (by - r) / H.liftZone
  P.load = lifted <= 0 ? 0 : lifted >= 1 ? 1 : lifted
  // the fingers' direction in the sagittal plane: down (hang) -> forward -> up and back (rack)
  const fang = (-80 + 185 * k) * DEG
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? 1 : -1
    // contact on the ball: its side at the equator (hang) -> front, below and to the side (rack)
    set(_cn, 0.06 + 0.42 * k, -0.1 - 0.52 * k, side * (0.99 - 0.35 * k))
    norm(_cn)
    addK(P.grip[s], P.bar, _cn, r + 0.014)
    // fingers tangent to the ball
    set(_fd, Math.cos(fang), Math.sin(fang), 0)
    const dn = dot(_fd, _cn)
    norm(set(_fd, _fd[0] - _cn[0] * dn, _fd[1] - _cn[1] * dn, _fd[2] - _cn[2] * dn))
    addK(P.wrist[s], P.grip[s], _fd, -H.palm)
    addK(P.fingertip[s], P.wrist[s], _fd, B.hand)
    // elbows: back and out (hang) -> high and outside (the pull) -> down under the ball (rack)
    const m = 1 - k
    set(_pole, -1 * m * m + 0.3 * k * k, 0.15 * m * m + 2 * m * k * 1.2 - 1 * k * k, side * (0.5 * m * m + 2 * m * k * 1.1 + 0.45 * k * k))
    solveTwoBone(P.elbow[s], P.shoulder[s], P.wrist[s], B.upperArm, B.forearm, _pole)
    sub(_b, P.elbow[s], P.shoulder[s])
    sub(_c, P.wrist[s], P.elbow[s])
    // the flexion side of each arm part: toward the forearm (upper arm) / away from the upper arm (forearm)
    cross(_d, _b, _c)
    if (len(_d) < 1e-5) set(_d, 0, 0, side)
    norm(_d)
    boneFrame(P.upperArmF[s], P.shoulder[s], P.elbow[s], cross(_a, _d, _b))
    boneFrame(P.forearmF[s], P.elbow[s], P.wrist[s], cross(_a, _d, _c))
    // the back of the hand faces away from the ball
    boneFrame(P.handF[s], P.wrist[s], P.fingertip[s], _cn)
  }
  P.curl = 30
}

/* ------------------------------ mass ----------------------------------- */

let _m = 0
let _mx = 0
let _my = 0
function addMass(w: number, x: number, y: number): void {
  _m += w
  _mx += w * x
  _my += w * y
}

/** Whole-body centre of mass into P.com; returns its x. */
function centreOfMass(P: Pose): number {
  const M = MASS
  _m = 0
  _mx = 0
  _my = 0
  for (let s = 0; s < 2; s++) {
    const a = P.ankle[s]
    addMass(M.foot, a[0] + P.footDir[s][0] * 0.06, 0.04)
    const k = P.knee[s]
    const h = P.hipJ[s]
    addMass(M.shank, k[0] + (a[0] - k[0]) * M.shankCom, k[1] + (a[1] - k[1]) * M.shankCom)
    addMass(M.thigh, h[0] + (k[0] - h[0]) * M.thighCom, h[1] + (k[1] - h[1]) * M.thighCom)
    const S = P.shoulder[s]
    const E = P.elbow[s]
    const W = P.wrist[s]
    addMass(M.upperArm, S[0] + (E[0] - S[0]) * M.upperArmCom, S[1] + (E[1] - S[1]) * M.upperArmCom)
    addMass(M.forearm, E[0] + (W[0] - E[0]) * M.forearmCom, E[1] + (W[1] - E[1]) * M.forearmCom)
    addMass(M.hand, P.grip[s][0], P.grip[s][1])
  }
  // pelvis, abdomen (in front of the lumbar curve), thorax (in front of its chord), head
  lean2(_a, P.hip, P.pelvis, -0.02, 0.05)
  addMass(M.pelvis, _a[0], _a[1])
  lean2(_a, P.l3, (P.thorax + P.pelvis) * 0.5, 0.075, 0)
  addMass(M.abdomen, _a[0], _a[1])
  lean2(_a, P.t12, P.thorax, 0.07, 0.13)
  addMass(M.thorax, _a[0], _a[1])
  addMass(M.head, P.headC[0], P.headC[1])
  const hold = P.hold
  if (hold.kind !== 'free') addMass(hold.mass * P.load, P.bar[0], P.bar[1])
  set(P.com, _mx / _m, _my / _m, 0)
  return _mx / _m
}

/* ------------------------------ evaluate ------------------------------- */

function build(P: Pose, hx: number): number {
  const p = P.params
  placeLegs(P, hx, p.hy, p.valgus)
  placeTrunk(P, p)
  placeArms(P, p)
  return centreOfMass(P)
}

/**
 * Pose the skeleton: P <- (params, hold). The hips' x is solved so the
 * centre of mass sits over mid-foot plus `com` (secant steps; it converges
 * in three or four), then moved forward by `hipFwd` (a fault: the hips do
 * not travel back, so the weight shifts toward the toes). Deterministic.
 */
export function evaluate(P: Pose, params: Readonly<PoseParams>, hold: Hold, stance: Stance = SHOULDER_WIDTH): Pose {
  const p = P.params
  for (const k of PARAM_KEYS) p[k] = params[k]
  P.hold = hold
  P.stance = stance
  placeFeet(P, p.heel)
  const target = p.com
  let x0 = -0.12
  let x1 = 0
  let f0 = build(P, x0) - target
  let f1 = build(P, x1) - target
  for (let i = 0; i < 10 && Math.abs(f1) > 2e-6; i++) {
    const den = f1 - f0
    if (Math.abs(den) < 1e-12) break
    const x2 = x1 - (f1 * (x1 - x0)) / den
    x0 = x1
    f0 = f1
    x1 = x2
    f1 = build(P, x1) - target
  }
  if (p.hipFwd !== 0) build(P, x1 + p.hipFwd)
  return P
}

/* ------------------------------ landmarks ------------------------------ */

/** Points a coach (and a label) refers to, computed from a posed skeleton. */
export type LandmarkId =
  | 'midfoot'
  | 'heel'
  | 'footBall'
  | 'toe'
  | 'ankle'
  | 'knee'
  | 'kneeTop'
  | 'hip'
  | 'hipCrease'
  | 'glutes'
  | 'lumbar'
  | 'chest'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'hand'
  | 'head'
  | 'eye'
  | 'chin'
  | 'crown'
  | 'com'
  | 'bar'
  | 'ball'

/** Spine point and its anterior normal at sigma (arc length from the coccyx, 0 to SPINE_LEN). */
export function spineAt(P: Pose, sigma: number, pos: Vec, nrm: Vec): void {
  const n = SPINE_N
  const f = Math.min(n - 1.0001, Math.max(0, (sigma / SPINE_LEN) * (n - 1)))
  const i = Math.floor(f)
  const k = f - i
  const a = i * 3
  set(pos, P.spine[a] + (P.spine[a + 3] - P.spine[a]) * k, P.spine[a + 1] + (P.spine[a + 4] - P.spine[a + 1]) * k, 0)
  const i0 = Math.max(0, i - 1) * 3
  const i1 = Math.min(n - 1, i + 2) * 3
  let tx = P.spine[i1] - P.spine[i0]
  let ty = P.spine[i1 + 1] - P.spine[i0 + 1]
  const l = Math.sqrt(tx * tx + ty * ty) || 1
  tx /= l
  ty /= l
  // anterior normal: the tangent turned clockwise (up -> forward)
  set(nrm, ty, -tx, 0)
}

const _n = v3()
const _e = v3()

/**
 * A landmark's world position into `out`. `side` 0 is the near (right)
 * limb, 1 the far (left); midline landmarks ignore it. 'ball' and 'bar'
 * are the held implement's centre (the medicine ball, the barbell);
 * 'footBall' is the ball of the foot. For "hip crease
 * below the knee": `hipCrease` is the fold at the front of the hip (the
 * thigh's front surface just below the joint) and `kneeTop` the top of the
 * knee (the thigh's front surface over the knee joint).
 */
export function landmark(P: Pose, id: LandmarkId, out: Vec, side: 0 | 1 = 0): Vec {
  switch (id) {
    case 'midfoot':
      return set(out, 0, 0, 0)
    case 'heel':
      return copy(out, P.heel[side])
    case 'footBall':
      return copy(out, P.ball[side])
    case 'toe':
      return copy(out, P.toe[side])
    case 'ankle':
      return copy(out, P.ankle[side])
    case 'knee':
      return copy(out, P.knee[side])
    case 'kneeTop':
      return addK(out, P.knee[side], P.thighF[side].x, lookup(THIGH, 1, 1))
    case 'hip':
      return copy(out, P.hipJ[side])
    case 'hipCrease': {
      const F = P.thighF[side]
      addK(out, P.hipJ[side], F.y, CREASE_U * BODY.thigh)
      return addK(out, out, F.x, lookup(THIGH, CREASE_U, 1))
    }
    case 'glutes': {
      spineAt(P, 0.04, _e, _n)
      const b = lookup(TRUNK, 0.04, 2)
      return set(out, _e[0] - _n[0] * b, _e[1] - _n[1] * b, 0)
    }
    case 'lumbar': {
      spineAt(P, 0.205, _e, _n)
      const b = lookup(TRUNK, 0.205, 2)
      return set(out, _e[0] - _n[0] * b, _e[1] - _n[1] * b, 0)
    }
    case 'chest': {
      spineAt(P, 0.41, _e, _n)
      const f = lookup(TRUNK, 0.41, 1)
      return set(out, _e[0] + _n[0] * f, _e[1] + _n[1] * f, 0)
    }
    case 'shoulder':
      return copy(out, P.shoulder[side])
    case 'elbow':
      return copy(out, P.elbow[side])
    case 'wrist':
      return copy(out, P.wrist[side])
    case 'hand':
      return copy(out, P.grip[side])
    case 'head':
      return copy(out, P.headC)
    case 'eye':
      return copy(out, P.eye)
    case 'chin':
      return copy(out, P.chin)
    case 'crown':
      return copy(out, P.crown)
    case 'com':
      return copy(out, P.com)
    case 'bar':
    case 'ball':
      return P.hasBar ? copy(out, P.bar) : copy(out, P.grip[side])
  }
}

/** Where along the thigh the hip crease is taken (fraction from the hip joint). */
export const CREASE_U = 0.13

/**
 * The back's surface along the lumbar curve (S1 to T12 by default) as
 * `count` points into `out` (xyz triples), `lift` metres off the skin.
 */
export function lumbarCurve(P: Pose, out: Float32Array, count: number, lift = 0, from = 0.1, to = 0.31): void {
  for (let i = 0; i < count; i++) {
    const sigma = from + ((to - from) * i) / (count - 1)
    spineAt(P, sigma, _e, _n)
    const b = lookup(TRUNK, sigma, 2) + lift
    out[i * 3] = _e[0] - _n[0] * b
    out[i * 3 + 1] = _e[1] - _n[1] * b
    out[i * 3 + 2] = 0
  }
}

/** Interior angle at joint b between a and c, deg, in the sagittal (x, y) plane. */
export function jointAngle(a: Readonly<Vec>, b: Readonly<Vec>, c: Readonly<Vec>): number {
  const ux = a[0] - b[0]
  const uy = a[1] - b[1]
  const wx = c[0] - b[0]
  const wy = c[1] - b[1]
  const d = Math.sqrt((ux * ux + uy * uy) * (wx * wx + wy * wy)) || 1
  return Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / d))) / DEG
}

/** Joint angles a coach reads, deg: knee and hip flexion (180 - interior), the shin's and trunk's lean. */
export function readAngles(P: Pose, side: 0 | 1 = 0) {
  const knee = 180 - jointAngle(P.hipJ[side], P.knee[side], P.ankle[side])
  const hip = 180 - jointAngle(P.knee[side], P.hipJ[side], P.c7)
  const shin = Math.atan2(P.knee[side][0] - P.ankle[side][0], P.knee[side][1] - P.ankle[side][1]) / DEG
  const thighRise = Math.atan2(P.knee[side][1] - P.hipJ[side][1], Math.hypot(P.knee[side][0] - P.hipJ[side][0], P.knee[side][2] - P.hipJ[side][2])) / DEG
  return { knee, hip, shin, trunk: P.thorax, pelvis: P.pelvis, lumbar: P.params.lord, thighRise }
}
