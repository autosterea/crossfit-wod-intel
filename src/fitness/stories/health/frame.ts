import * as THREE from 'three'
import { focusRect } from '../../story/camera/focusRect'
import { dirOf, padOf } from '../../story/camera/fit'
import { hudBox } from '../../story/ui/Hud'
import type { Box, CamPose, Pad, V3 } from '../../story/types'
import { NA, ND } from './healthMath'
import { FLOOR_TEXT_Z, INDEPENDENCE_LINE, PLANE_FRONT, PLANE_M, Z0, Z1, claimSize, worldNow, xOf, type World } from './layout'
import { G } from './timeline'

/* =========================================================================
   Camera framing of the landscape (C.8, E.2). The engine fits the 8 corners
   of a box, but the landscape is not a box: its top falls away toward the
   back and toward long durations, so any box that holds it leaves a wedge of
   empty slate over the solid (the round-1 frames filled 49 to 58% of the
   phone's focus rect in height). Here each pose is solved against the
   SILHOUETTE the beat ends on (the rim of the surface, a coarse interior
   grid, the floor corners, and whatever else that beat shows: the capacity
   post, the independence plane, the floor claim), with the engine's closed
   form: every point bounds the distance per screen edge. Two DOM corners
   are kept clear the same way, per point: the HUD chip (top-right) and the
   pinned key (top-left), and the post keeps headroom for its CAPACITY
   title. The target moves until the margins balance, and the director gets
   a synthetic point on the binding axis as a degenerate box, so its
   fitDistance returns exactly the solved distance. Proposed engine request:
   CamPose.fit accepting a point set with keep-clear rects.
   ========================================================================= */

/** Which grids and extras a pose must hold. */
export interface SilSpec {
  /** grids (indices into G) whose surfaces must be in frame */
  grids: readonly number[]
  /** the capacity post over the front-left corner, to this capacity */
  post?: number
  /** the independence plane (it reaches past the footprint) */
  plane?: boolean
  /** the floor claim in front */
  claim?: boolean
  /** the HUD chip shows (top-right corner kept clear) */
  hud?: boolean
  /** rows of the pinned key (top-left corner kept clear) */
  key?: number
}

interface Sil {
  pts: Float32Array
  /** index of the post's top (headroom for CAPACITY), or -1 */
  postIdx: number
}

const cache = new Map<string, Sil>()

/** Silhouette points (xyz) of a spec in a world. Cached; built once per world. */
export function silhouette(spec: SilSpec, W: World): Sil {
  const key = W.key + spec.grids.join(',') + (spec.post ? 'p' + spec.post : '') + (spec.plane ? 'l' : '') + (spec.claim ? 'c' : '')
  const hit = cache.get(key)
  if (hit) return hit
  const out: number[] = []
  const zOfRow = (ai: number) => Z0 + ((Z1 - Z0) * ai) / (NA - 1)
  const xOfCol = (di: number) => xOf(di / (ND - 1), W.XW)
  for (const gi of spec.grids) {
    const g = G[gi]
    const push = (ai: number, di: number) => out.push(xOfCol(di), g[ai * ND + di] * W.YS, zOfRow(ai))
    // the rim, densely; the interior, coarsely (a heightfield's silhouette is its rim or a ridge)
    for (let di = 0; di < ND; di += 2) {
      push(0, di)
      push(NA - 1, di)
    }
    push(0, ND - 1)
    push(NA - 1, ND - 1)
    for (let ai = 0; ai < NA; ai += 2) {
      push(ai, 0)
      push(ai, ND - 1)
    }
    for (let ai = 5; ai < NA - 1; ai += 5) for (let di = 5; di < ND - 1; di += 5) push(ai, di)
  }
  // the floor footprint
  for (const x of [-W.XW, W.XW]) for (const z of [Z0, Z1]) out.push(x, 0, z)
  let postIdx = -1
  if (spec.post) {
    postIdx = out.length / 3
    out.push(-W.XW, spec.post * W.YS, Z0)
  }
  if (spec.plane) {
    const y = INDEPENDENCE_LINE * W.YS
    for (const x of [-W.XW - PLANE_M, W.XW + PLANE_M]) for (const z of [Z0 + PLANE_FRONT, Z1 - PLANE_M]) out.push(x, y, z)
  }
  if (spec.claim) {
    const s = claimSize(W)
    const z = Z0 + FLOOR_TEXT_Z
    for (const x of [-W.XW * 0.95, W.XW * 0.95]) for (const dz of [-0.55 * s, 0.55 * s]) out.push(x, 0, z + dz)
  }
  const sil = { pts: Float32Array.from(out), postIdx }
  cache.set(key, sil)
  return sil
}

/* the keep-clear corners, in stage px, from the engine CSS (.st-hud sits 8 px
   inside the focus rect's top-right corner; pinned legends stack from 8 px
   inside its top-left, 23 px chips every 27 px) */
const HUD_W = 128
const HUD_H = 58
const KEY_W = 156
const KEY_ROW = 27
/** CAPACITY's height plus its gap over the post top */
const POST_HEAD = 30
/** clearance kept under a DOM corner */
const CLEAR = 6

const _d = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const Y = new THREE.Vector3(0, 1, 0)

interface Solved {
  tx: number
  ty: number
  tz: number
  d: number
  /** the binding bound is horizontal (true) or vertical */
  xBind: boolean
  hw: number
  hh: number
  f: number
}

/**
 * Target and distance that fit `sil` inside the focus rect minus `pad` at
 * (az, el, fov), clear of the spec's DOM corners, with balanced margins.
 * Allocation free.
 */
function solve(sil: Sil, spec: SilSpec, az: number, el: number, fov: number, pad: Pad | undefined, out: Solved): void {
  const pts = sil.pts
  dirOf(az, el, _d)
  _fwd.copy(_d).multiplyScalar(-1)
  _right.crossVectors(_fwd, Y).normalize()
  _up.crossVectors(_right, _fwd).normalize()
  const p = padOf(pad)
  const f = focusRect.H / 2 / Math.tan((fov * Math.PI) / 360)
  const hw = Math.max(1, (focusRect.w - p.l - p.r) / 2)
  const hh = Math.max(1, (focusRect.h - p.t - p.b) / 2)
  // the principal point (stage px) and the keep-clear corners
  const cx = focusRect.x + p.l + hw
  const cy = focusRect.y + p.t + hh
  const hudW = hudBox.w > 0 ? hudBox.w : HUD_W
  const hudH = hudBox.h > 0 ? hudBox.h : HUD_H
  const hudL = spec.hud ? focusRect.x + focusRect.w - 8 - hudW - CLEAR - cx : Infinity
  const hudT = spec.hud ? cy - (focusRect.y + 8 + hudH + CLEAR) : hh
  const keyR = spec.key ? focusRect.x + 8 + KEY_W + CLEAR - cx : -Infinity
  const keyT = spec.key ? cy - (focusRect.y + 8 + spec.key * KEY_ROW + CLEAR) : hh
  const n = pts.length / 3
  // start from the centre of the points' bounding box
  let x0 = Infinity
  let y0 = Infinity
  let z0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  let z1 = -Infinity
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, pts[i * 3])
    x1 = Math.max(x1, pts[i * 3])
    y0 = Math.min(y0, pts[i * 3 + 1])
    y1 = Math.max(y1, pts[i * 3 + 1])
    z0 = Math.min(z0, pts[i * 3 + 2])
    z1 = Math.max(z1, pts[i * 3 + 2])
  }
  let tx = (x0 + x1) / 2
  let ty = (y0 + y1) / 2
  let tz = (z0 + z1) / 2
  let d = 0
  let xBind = true
  for (let it = 0; it < 24; it++) {
    // the fitted distance for this target; each point's top limit depends on
    // where it lands (under the HUD or the key), from the previous distance
    const dPrev = d
    let dn = 0.05
    let xb = true
    for (let i = 0; i < n; i++) {
      const rx = pts[i * 3] - tx
      const ry = pts[i * 3 + 1] - ty
      const rz = pts[i * 3 + 2] - tz
      const a = rx * _right.x + ry * _right.y + rz * _right.z
      const b = rx * _up.x + ry * _up.y + rz * _up.z
      const c = rx * _fwd.x + ry * _fwd.y + rz * _fwd.z
      let top = hh
      if (dPrev > 0) {
        const sx = (f * a) / (dPrev + c)
        if (sx > hudL) top = Math.min(top, hudT)
        if (sx < keyR) top = Math.min(top, keyT)
      }
      if (i === sil.postIdx) top -= POST_HEAD
      top = Math.max(8, top)
      const nx = (f * Math.abs(a)) / hw - c
      const ny = b > 0 ? (f * b) / top - c : (f * -b) / hh - c
      if (nx > dn) {
        dn = nx
        xb = true
      }
      if (ny > dn) {
        dn = ny
        xb = false
      }
    }
    d = dn
    xBind = xb
    // balance the margins: the slack to each limit, left / right and top / bottom
    let sl = Infinity
    let sr = Infinity
    let st = Infinity
    let sb = Infinity
    for (let i = 0; i < n; i++) {
      const rx = pts[i * 3] - tx
      const ry = pts[i * 3 + 1] - ty
      const rz = pts[i * 3 + 2] - tz
      const a = rx * _right.x + ry * _right.y + rz * _right.z
      const b = rx * _up.x + ry * _up.y + rz * _up.z
      const c = rx * _fwd.x + ry * _fwd.y + rz * _fwd.z
      const k = f / (d + c)
      const sx = a * k
      const sy = b * k
      let top = hh
      if (sx > hudL) top = Math.min(top, hudT)
      if (sx < keyR) top = Math.min(top, keyT)
      if (i === sil.postIdx) top -= POST_HEAD
      sl = Math.min(sl, hw + sx)
      sr = Math.min(sr, hw - sx)
      st = Math.min(st, top - sy)
      sb = Math.min(sb, hh + sy)
    }
    const mx = (sr - sl) / 2
    const my = (st - sb) / 2
    if (Math.abs(mx) < 0.25 && Math.abs(my) < 0.25 && it > 1) break
    // move the target so the margins even out (a target shift of s world units moves points by f s / d px)
    const s = d / f
    tx -= (_right.x * mx + _up.x * my) * s
    ty -= (_right.y * mx + _up.y * my) * s
    tz -= (_right.z * mx + _up.z * my) * s
  }
  out.tx = tx
  out.ty = ty
  out.tz = tz
  out.d = d
  out.xBind = xBind
  out.hw = hw
  out.hh = hh
  out.f = f
}

/**
 * A pose fitted to a silhouette. `target` and `fit` share one solution,
 * re-solved only when the focus rect, the world or the HUD size changes.
 */
export function silPose(az: number, el: number, fov: number, padPx: Pad, spec: SilSpec): CamPose {
  const sol: Solved = { tx: 0, ty: 0, tz: 0, d: 1, xBind: true, hw: 1, hh: 1, f: 1 }
  const last = { ver: -1, world: -1, w: 0, h: 0, H: 0, hw: -1, hh: -1 }
  const lo: [number, number, number] = [0, 0, 0]
  const tgt: [number, number, number] = [0, 0, 0]
  const box: Box = [lo, lo]
  const refresh = () => {
    const W = worldNow()
    if (
      last.ver === focusRect.version &&
      last.world === W.id &&
      last.w === focusRect.w &&
      last.h === focusRect.h &&
      last.H === focusRect.H &&
      last.hw === hudBox.w &&
      last.hh === hudBox.h
    )
      return
    last.ver = focusRect.version
    last.world = W.id
    last.w = focusRect.w
    last.h = focusRect.h
    last.H = focusRect.H
    last.hw = hudBox.w
    last.hh = hudBox.h
    solve(silhouette(spec, W), spec, az, el, fov, padPx, sol)
    tgt[0] = sol.tx
    tgt[1] = sol.ty
    tgt[2] = sol.tz
    // a point on the binding axis at the solved distance: the director's closed form returns exactly sol.d
    const k = sol.xBind ? (sol.d * sol.hw) / sol.f : (sol.d * sol.hh) / sol.f
    dirOf(az, el, _d)
    _fwd.copy(_d).multiplyScalar(-1)
    _right.crossVectors(_fwd, Y).normalize()
    _up.crossVectors(_right, _fwd).normalize()
    const ax = sol.xBind ? _right : _up
    lo[0] = sol.tx + ax.x * k
    lo[1] = sol.ty + ax.y * k
    lo[2] = sol.tz + ax.z * k
  }
  return {
    az,
    el,
    fov,
    padPx,
    target: (): V3 => {
      refresh()
      return tgt
    },
    fit: (): Box => {
      refresh()
      return box
    },
  }
}

