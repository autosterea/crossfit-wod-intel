import * as THREE from 'three'
import type { Box, CamPose, CamSpec, Layout, Pad, Rect, V3 } from '../types'
import { ease } from '../ease'
import { storyFrame } from '../kit/chartFrame'

/* =========================================================================
   Camera fitting (DESIGN.md C.8). A pose is target + az/el + fov + a box that
   must land inside the focus rect. The principal point is moved to the
   focus-rect centre with setViewOffset (lens shift), so the subject is always
   centred in the visible part of the stage and never under the caption.

   fitDistance is solved in closed form: with the lens shift, each box corner
   gives a lower bound on distance per screen edge, and the answer is the
   largest bound. It returns exactly what the specified 16-step bisection
   converges to, without the iterations.
   ========================================================================= */

export interface Resolved {
  target: THREE.Vector3
  az: number
  el: number
  dist: number
  fov: number
  /** principal point in stage px: the centre of the focus rect minus this pose's padding */
  px: number
  py: number
}

export const DEG = Math.PI / 180

/** the default pose padding (read-only: padOf hands it out without a copy) */
const PAD24: { readonly l: number; readonly r: number; readonly t: number; readonly b: number } = Object.freeze({ l: 24, r: 24, t: 24, b: 24 })
/** a small ring of scratch pads for numeric padding (per-frame callers must not allocate, C.16) */
const PAD_RING = [0, 1, 2, 3].map(() => ({ l: 0, r: 0, t: 0, b: 0 }))
let padRing = 0
/**
 * The padding as four sides. Allocation free (fix round 1): a numeric pad is
 * written into one of four rotating scratch objects, so a caller may hold up
 * to four results at once; read them, never keep them past the frame.
 */
export function padOf(p: Pad | undefined): { readonly l: number; readonly r: number; readonly t: number; readonly b: number } {
  if (p === undefined) return PAD24
  if (typeof p === 'number') {
    const o = PAD_RING[(padRing = (padRing + 1) & 3)]
    o.l = o.r = o.t = o.b = p
    return o
  }
  return p
}

export function poseFor(spec: CamSpec | { L: CamPose; P?: CamPose }, layout: Layout): CamPose {
  return layout === 'P' ? spec.P ?? spec.L : spec.L
}

export function boxOf(pose: CamPose, layout: Layout): Box {
  return typeof pose.fit === 'function' ? pose.fit(layout, storyFrame()) : pose.fit
}

/** Unit vector from target toward the camera. */
export function dirOf(az: number, el: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = az * DEG
  const e = el * DEG
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))
}

const _dir = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _rel = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)

/** Smallest camera distance at which every corner of `box` projects inside `rect` minus padding. */
export function fitDistance(
  target: V3 | THREE.Vector3,
  az: number,
  el: number,
  fov: number,
  box: Box,
  pad: Pad | undefined,
  rect: Rect,
  H: number,
): number {
  const p = padOf(pad)
  const tx = Array.isArray(target) ? (target as V3)[0] : (target as THREE.Vector3).x
  const ty = Array.isArray(target) ? (target as V3)[1] : (target as THREE.Vector3).y
  const tz = Array.isArray(target) ? (target as V3)[2] : (target as THREE.Vector3).z
  dirOf(az, el, _dir)
  _fwd.copy(_dir).multiplyScalar(-1)
  _right.crossVectors(_fwd, Y)
  if (_right.lengthSq() < 1e-8) _right.set(1, 0, 0)
  _right.normalize()
  _up.crossVectors(_right, _fwd).normalize()
  const f = H / 2 / Math.tan((fov * DEG) / 2)
  // the principal point sits at the centre of the PADDED rect, so asymmetric
  // label margins do not waste space on the other side
  const cx = rect.x + p.l + (rect.w - p.l - p.r) / 2
  const cy = rect.y + p.t + (rect.h - p.t - p.b) / 2
  const L = Math.max(1, cx - (rect.x + p.l))
  const R = Math.max(1, rect.x + rect.w - p.r - cx)
  const T = Math.max(1, cy - (rect.y + p.t))
  const B = Math.max(1, rect.y + rect.h - p.b - cy)
  let d = 0.05
  for (let i = 0; i < 8; i++) {
    const x = box[i & 1 ? 1 : 0][0] - tx
    const y = box[i & 2 ? 1 : 0][1] - ty
    const z = box[i & 4 ? 1 : 0][2] - tz
    _rel.set(x, y, z)
    const xc = _rel.dot(_right)
    const yc = _rel.dot(_up)
    const zc = _rel.dot(_fwd)
    // depth = zc + d must satisfy f*|xc|/depth <= edge
    if (xc > 0) d = Math.max(d, (f * xc) / R - zc)
    else if (xc < 0) d = Math.max(d, (f * -xc) / L - zc)
    if (yc > 0) d = Math.max(d, (f * yc) / T - zc)
    else if (yc < 0) d = Math.max(d, (f * -yc) / B - zc)
    d = Math.max(d, 0.2 - zc)
  }
  return Math.min(500, d)
}

export function targetOf(pose: CamPose, layout: Layout): V3 {
  return typeof pose.target === 'function' ? pose.target(layout, storyFrame()) : pose.target
}

export function resolvePose(pose: CamPose, layout: Layout, rect: Rect, H: number, out?: Resolved): Resolved {
  const fov = pose.fov ?? 30
  const box = boxOf(pose, layout)
  const tgt = targetOf(pose, layout)
  const dist = fitDistance(tgt, pose.az, pose.el, fov, box, pose.padPx, rect, H)
  const p = padOf(pose.padPx)
  const r = out ?? newResolved()
  r.target.set(tgt[0], tgt[1], tgt[2])
  r.az = pose.az
  r.el = pose.el
  r.dist = dist
  r.fov = fov
  r.px = rect.x + p.l + (rect.w - p.l - p.r) / 2
  r.py = rect.y + p.t + (rect.h - p.t - p.b) / 2
  return r
}

const wrap180 = (a: number) => {
  let x = ((a + 180) % 360) - 180
  if (x < -180) x += 360
  return x
}

/** target linear, az/el shortest angle, distance in log space, fov linear. */
export function lerpResolved(a: Resolved, b: Resolved, k: number, out: Resolved): Resolved {
  out.target.lerpVectors(a.target, b.target, k)
  out.az = a.az + wrap180(b.az - a.az) * k
  out.el = a.el + wrap180(b.el - a.el) * k
  out.dist = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * k)
  out.fov = a.fov + (b.fov - a.fov) * k
  out.px = a.px + (b.px - a.px) * k
  out.py = a.py + (b.py - a.py) * k
  return out
}

export function copyResolved(src: Resolved, out: Resolved): Resolved {
  out.target.copy(src.target)
  out.az = src.az
  out.el = src.el
  out.dist = src.dist
  out.fov = src.fov
  out.px = src.px
  out.py = src.py
  return out
}

export const newResolved = (): Resolved => ({ target: new THREE.Vector3(), az: 0, el: 0, dist: 20, fov: 30, px: 195, py: 270 })

/**
 * Evaluate a beat's camera at beat-local t: from `start` (the previous beat's
 * end pose) through optional keys to this beat's end, inside `window`, eased
 * with `morph`.
 */
export function evalSpec(
  spec: CamSpec,
  start: Resolved,
  t: number,
  layout: Layout,
  rect: Rect,
  H: number,
  scratch: Resolved[],
  out: Resolved,
): Resolved {
  const w0 = spec.window?.[0] ?? 0
  const w1 = spec.window?.[1] ?? 0.35
  const end = resolvePose(poseFor(spec, layout), layout, rect, H, scratch[0])
  const keys = spec.keys ?? []
  if (t <= w0 && keys.length === 0) return copyResolved(start, out)
  if (t >= w1) return copyResolved(end, out)
  // control points
  let prevT = w0
  let prev = start
  for (let i = 0; i < keys.length; i++) {
    const kp = resolvePose(poseFor(keys[i], layout), layout, rect, H, scratch[1 + (i % 3)])
    const kt = keys[i].t
    if (t <= kt) {
      const k = kt > prevT ? ease.morph((t - prevT) / (kt - prevT)) : 1
      return lerpResolved(prev, kp, t < prevT ? 0 : k, out)
    }
    prevT = kt
    prev = copyResolved(kp, scratch[4])
  }
  const k = w1 > prevT ? ease.morph((t - prevT) / (w1 - prevT)) : 1
  return lerpResolved(prev, end, t < prevT ? 0 : k, out)
}

/** Place the camera for a resolved pose and apply the lens shift toward the focus-rect centre. */
export function applyPose(cam: THREE.PerspectiveCamera, r: Resolved, rect: Rect, W: number, H: number): void {
  dirOf(r.az, r.el, _dir)
  cam.position.copy(r.target).addScaledVector(_dir, r.dist)
  cam.up.set(0, 1, 0)
  cam.lookAt(r.target)
  cam.fov = r.fov
  cam.near = Math.max(0.05, r.dist * 0.01)
  cam.far = Math.max(500, r.dist * 20)
  cam.aspect = W / H
  applyLensShift(cam, r.px, r.py, W, H)
}

/** Move the principal point to (px, py) in stage px (setViewOffset; never touches projectionMatrix.elements). */
export function applyLensShift(cam: THREE.PerspectiveCamera, px: number, py: number, W: number, H: number): void {
  cam.aspect = W / H
  cam.setViewOffset(W, H, W / 2 - px, H / 2 - py, W, H)
}

/** Current camera expressed as a pose around `target`. */
export function readCamera(cam: THREE.Camera, target: THREE.Vector3, out: Resolved): Resolved {
  _rel.copy(cam.position).sub(target)
  const dist = Math.max(0.01, _rel.length())
  out.target.copy(target)
  out.dist = dist
  out.el = Math.asin(Math.max(-1, Math.min(1, _rel.y / dist))) / DEG
  out.az = Math.atan2(_rel.x, _rel.z) / DEG
  out.fov = (cam as THREE.PerspectiveCamera).fov ?? 30
  const v = (cam as THREE.PerspectiveCamera).view
  if (v && v.enabled) {
    out.px = v.fullWidth / 2 - v.offsetX
    out.py = v.fullHeight / 2 - v.offsetY
  }
  return out
}
