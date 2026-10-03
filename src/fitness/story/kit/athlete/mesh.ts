import { BODY, EAR, FOOT, FOREARM, HAND, HEAD_CENTRE, HEAD_NARROW, HEAD_POLY, HEAD_WIDTH, SHANK, THIGH, TRUNK, UPPER_ARM, lookup, lookupSmooth, type Station } from './body'
import { SPINE_LEN, SPINE_N, type Pose } from './rig'
import { DEG, smooth, type Frame } from './vec'

/* =========================================================================
   The athlete's surface (story/kit/athlete): one indexed triangle mesh for
   the whole body, written on the CPU from a posed skeleton every frame it
   changes. Rigid parts (thighs, shanks, feet, arms, hands, head) are
   templates built once in their bone frames and moved; the trunk is lofted
   along the spine each frame, so the lumbar curve the coach watches is the
   real shape of the back.

   Limbs are lofts of elliptical sections with separate front and back
   extents (quadriceps / hamstrings, shin / calf) and round end caps that
   coincide at each joint, so a bent knee or elbow stays one smooth surface
   and the outline pass draws no seam there. About 4.5k vertices: writing
   them is cheaper than one shadow map, and it allocates nothing.
   ========================================================================= */

const AROUND = 14
const TRUNK_AROUND = 20

/** A template: local positions, normals, and an optional bend weight per vertex. */
interface Template {
  pos: Float32Array
  nrm: Float32Array
  /** 0 = rides the base frame, 1 = fully bent (feet: the hindfoot rises; hands: the fingers curl) */
  bend: Float32Array | null
  index: Uint16Array | Uint32Array | number[]
  count: number
}

/* ------------------------------ builders ------------------------------- */

/** Accumulate smooth vertex normals for an indexed mesh. */
function computeNormals(pos: Float32Array, index: ArrayLike<number>, out: Float32Array): void {
  out.fill(0)
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3
    const b = index[i + 1] * 3
    const c = index[i + 2] * 3
    const ux = pos[b] - pos[a]
    const uy = pos[b + 1] - pos[a + 1]
    const uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a]
    const vy = pos[c + 1] - pos[a + 1]
    const vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const o of [a, b, c]) {
      out[o] += nx
      out[o + 1] += ny
      out[o + 2] += nz
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1
    out[i] /= l
    out[i + 1] /= l
    out[i + 2] /= l
  }
}

/**
 * Grid topology for `rings` rings of `around` vertices, closed by a pole
 * vertex at each end (pole indices: rings*around and rings*around + 1).
 * Winding is outward when rings advance along +axis and the ring turns
 * counter-clockwise seen from the far (+axis) end.
 */
function tubeIndex(rings: number, around: number, flip = false): number[] {
  const idx: number[] = []
  const tri = (a: number, b: number, c: number) => (flip ? idx.push(a, c, b) : idx.push(a, b, c))
  for (let r = 0; r < rings - 1; r++) {
    for (let j = 0; j < around; j++) {
      const a = r * around + j
      const b = r * around + ((j + 1) % around)
      const c = (r + 1) * around + j
      const d = (r + 1) * around + ((j + 1) % around)
      tri(a, c, b)
      tri(b, c, d)
    }
  }
  const p0 = rings * around
  const p1 = p0 + 1
  for (let j = 0; j < around; j++) {
    tri(p0, j, (j + 1) % around)
    const a = (rings - 1) * around + j
    const b = (rings - 1) * around + ((j + 1) % around)
    tri(p1, b, a)
  }
  return idx
}

/**
 * A limb template along +y from 0 to L: elliptical sections, front extent
 * `a` toward +x, back extent `p` toward -x, half-width `w` along z, from a
 * station table; a round cap at each end (radius = the end section).
 */
function limbTemplate(L: number, table: readonly Station[], steps = 10, capSteps = 3): Template {
  const rings: [number, number, number, number][] = [] // y, a, p, w
  const a0 = table[0][1]
  const p0 = table[0][2]
  const w0 = table[0][3]
  const r0 = (a0 + p0 + 2 * w0) / 4
  for (let k = capSteps; k >= 1; k--) {
    const phi = (k / (capSteps + 1)) * (Math.PI / 2)
    rings.push([-r0 * Math.sin(phi), a0 * Math.cos(phi), p0 * Math.cos(phi), w0 * Math.cos(phi)])
  }
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    rings.push([u * L, lookupSmooth(table, u, 1), lookupSmooth(table, u, 2), lookupSmooth(table, u, 3)])
  }
  const n = table.length - 1
  const a1 = table[n][1]
  const p1 = table[n][2]
  const w1 = table[n][3]
  const r1 = (a1 + p1 + 2 * w1) / 4
  for (let k = 1; k <= capSteps; k++) {
    const phi = (k / (capSteps + 1)) * (Math.PI / 2)
    rings.push([L + r1 * Math.sin(phi), a1 * Math.cos(phi), p1 * Math.cos(phi), w1 * Math.cos(phi)])
  }
  const R = rings.length
  const count = R * AROUND + 2
  const pos = new Float32Array(count * 3)
  for (let r = 0; r < R; r++) {
    const [y, a, p, w] = rings[r]
    for (let j = 0; j < AROUND; j++) {
      const th = (j / AROUND) * Math.PI * 2
      const c = Math.cos(th)
      const o = (r * AROUND + j) * 3
      pos[o] = c >= 0 ? a * c : p * c
      pos[o + 1] = y
      pos[o + 2] = w * Math.sin(th)
    }
  }
  pos.set([(a0 - p0) * 0.3, -r0, 0], R * AROUND * 3)
  pos.set([(a1 - p1) * 0.3, L + r1, 0], (R * AROUND + 1) * 3)
  const index = tubeIndex(R, AROUND)
  const nrm = new Float32Array(count * 3)
  computeNormals(pos, index, nrm)
  return { pos, nrm, bend: null, index, count }
}

/** The foot along +x from the heel to the toe (sole at y = -ankleH); the hindfoot bends up at the ball. */
function footTemplate(): Template {
  const sole = -BODY.ankleH
  const xs: number[] = []
  const steps = 16
  const x0 = FOOT[0][0]
  const x1 = FOOT[FOOT.length - 1][0]
  for (let i = 0; i <= steps; i++) xs.push(x0 + ((x1 - x0) * i) / steps)
  const R = xs.length
  const count = R * AROUND + 2
  const pos = new Float32Array(count * 3)
  const bend = new Float32Array(count)
  for (let r = 0; r < R; r++) {
    const x = xs[r]
    // round the heel and the toe: shrink the end sections
    const endK = Math.min(1, (x - x0) / 0.03, (x1 - x) / 0.025)
    const shrink = Math.sqrt(Math.max(0.05, endK))
    const top = lookupSmooth(FOOT, x, 1) * (0.55 + 0.45 * shrink)
    const w = lookupSmooth(FOOT, x, 2) * shrink
    const yc = sole + top / 2
    for (let j = 0; j < AROUND; j++) {
      const th = (j / AROUND) * Math.PI * 2
      const s = Math.sin(th)
      const o = (r * AROUND + j) * 3
      // a flat sole: the lower half is flattened hard
      const y = s >= 0 ? yc + (top / 2) * s : sole + (top / 2) * Math.pow(1 + s, 3)
      // ring orientation matches tubeIndex (axis +x): (y, z) turn counter-clockwise seen from +x
      pos[o] = x
      pos[o + 1] = y
      pos[o + 2] = -w * Math.cos(th)
      bend[r * AROUND + j] = 1 - smooth((x - (BODY.ball - 0.03)) / 0.05)
    }
  }
  pos.set([x0 - 0.006, sole + lookup(FOOT, x0, 1) * 0.35, 0], R * AROUND * 3)
  pos.set([x1 + 0.004, sole + 0.01, 0], (R * AROUND + 1) * 3)
  bend[R * AROUND] = 1
  bend[R * AROUND + 1] = 0
  const index = tubeIndex(R, AROUND, true)
  const nrm = new Float32Array(count * 3)
  computeNormals(pos, index, nrm)
  return { pos, nrm, bend, index, count }
}

/** The hand along +y (wrist 0 to fingertips L), flat across z; fingers curl toward -x past the knuckles. */
function handTemplate(): Template {
  const t = limbTemplate(BODY.hand, HAND, 8, 2)
  const bend = new Float32Array(t.count)
  const yk = BODY.knuckle * BODY.hand
  for (let i = 0; i < t.count; i++) bend[i] = smooth((t.pos[i * 3 + 1] - yk + 0.008) / 0.016)
  t.bend = bend
  return t
}

/** Distance from (cx, cy) along angle a to the head profile polygon (the farthest crossing). */
function profileRadius(a: number, cx: number, cy: number): number {
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  let best = 0
  const n = HEAD_POLY.length
  for (let i = 0; i < n; i++) {
    const [x0, y0] = HEAD_POLY[i]
    const [x1, y1] = HEAD_POLY[(i + 1) % n]
    // ray (cx, cy) + t (dx, dy) against the segment p0 + u (p1 - p0)
    const ex = x1 - x0
    const ey = y1 - y0
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-12) continue
    const qx = x0 - cx
    const qy = y0 - cy
    const t = (qx * ey - qy * ex) / den
    const u = (qx * dy - qy * dx) / den
    if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t)
  }
  return best
}

/**
 * The head in its frame (origin C1): the profile polygon revolved about the
 * head centre, rounded across by a width per angle. The nose, lips and chin
 * narrow quickly off the midline, so the face is a face from the side and
 * not a ridge.
 */
function headTemplate(): Template {
  const RA = 64
  const RL = 12
  const cx = HEAD_CENTRE[0]
  const cy = HEAD_CENTRE[1]
  let wMean = 0
  for (const [, w] of HEAD_WIDTH) wMean += w
  wMean /= HEAD_WIDTH.length
  // profile radius and the smooth face under the narrow features
  const rr = new Float64Array(RA)
  const deg = new Float64Array(RA)
  for (let i = 0; i < RA; i++) {
    deg[i] = -90 + (360 * i) / RA
    rr[i] = profileRadius(deg[i] * DEG, cx, cy)
  }
  const base = Float64Array.from(rr)
  const fall = new Float64Array(RA).fill(10)
  for (const [c, span, f] of HEAD_NARROW) {
    const a0 = c - span
    const a1 = c + span
    const r0 = profileRadius(a0 * DEG, cx, cy)
    const r1 = profileRadius(a1 * DEG, cx, cy)
    for (let i = 0; i < RA; i++) {
      if (deg[i] <= a0 || deg[i] >= a1) continue
      const k = (deg[i] - a0) / (a1 - a0)
      base[i] = Math.min(rr[i], r0 + (r1 - r0) * k)
      fall[i] = f
    }
  }
  const count = RA * RL + 2
  const pos = new Float32Array(count * 3)
  for (let l = 0; l < RL; l++) {
    const phi = -Math.PI / 2 + (Math.PI * (l + 1)) / (RL + 1)
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    for (let i = 0; i < RA; i++) {
      const q = phi / fall[i]
      const r = base[i] + (rr[i] - base[i]) * Math.exp(-q * q)
      const w = lookupSmooth(HEAD_WIDTH, deg[i], 1)
      const we = w + (wMean - w) * sp * sp
      const o = (l * RA + i) * 3
      pos[o] = cx + r * Math.cos(deg[i] * DEG) * cp
      pos[o + 1] = cy + r * Math.sin(deg[i] * DEG) * cp
      pos[o + 2] = we * sp
    }
  }
  pos.set([cx, cy, -wMean], RA * RL * 3)
  pos.set([cx, cy, wMean], (RA * RL + 1) * 3)
  // rings advance along +z (latitude); each ring turns counter-clockwise seen from +z
  const index = tubeIndex(RL, RA, true)
  const nrm = new Float32Array(count * 3)
  computeNormals(pos, index, nrm)
  return { pos, nrm, bend: null, index, count }
}

/** An ear in the head frame (a flattened ellipsoid on the side of the head), side +1 right, -1 left. */
function earTemplate(side: number): Template {
  const RA = 14
  const RL = 8
  const count = RA * RL + 2
  const pos = new Float32Array(count * 3)
  for (let l = 0; l < RL; l++) {
    const phi = -Math.PI / 2 + (Math.PI * (l + 1)) / (RL + 1)
    for (let i = 0; i < RA; i++) {
      const th = (i / RA) * Math.PI * 2
      const o = (l * RA + i) * 3
      // a slight forward tilt: the ear leans back at the top
      const x = EAR.d * Math.cos(phi) * Math.cos(th)
      const y = EAR.h * Math.cos(phi) * Math.sin(th)
      pos[o] = EAR.x + x - y * 0.25
      pos[o + 1] = EAR.y + y
      pos[o + 2] = side * EAR.z + EAR.t * Math.sin(phi)
    }
  }
  pos.set([EAR.x, EAR.y, side * EAR.z - EAR.t], RA * RL * 3)
  pos.set([EAR.x, EAR.y, side * EAR.z + EAR.t], (RA * RL + 1) * 3)
  const index = tubeIndex(RL, RA, true)
  const nrm = new Float32Array(count * 3)
  computeNormals(pos, index, nrm)
  return { pos, nrm, bend: null, index, count }
}

/** A unit sphere (the medicine ball; scaled by its radius when written). */
function sphereTemplate(): Template {
  const RA = 24
  const RL = 12
  const count = RA * RL + 2
  const pos = new Float32Array(count * 3)
  for (let l = 0; l < RL; l++) {
    const phi = -Math.PI / 2 + (Math.PI * (l + 1)) / (RL + 1)
    for (let i = 0; i < RA; i++) {
      const th = (i / RA) * Math.PI * 2
      const o = (l * RA + i) * 3
      pos[o] = Math.cos(phi) * Math.cos(th)
      pos[o + 1] = Math.cos(phi) * Math.sin(th)
      pos[o + 2] = Math.sin(phi)
    }
  }
  pos.set([0, 0, -1], RA * RL * 3)
  pos.set([0, 0, 1], (RA * RL + 1) * 3)
  const index = tubeIndex(RL, RA, true)
  const nrm = new Float32Array(count * 3)
  computeNormals(pos, index, nrm)
  return { pos, nrm, bend: null, index, count }
}

/* ------------------------------ the body ------------------------------- */

/** Part ids (the aPart attribute): a style can tint or dim a part. */
export const PART = {
  thighR: 0,
  thighL: 1,
  shankR: 2,
  shankL: 3,
  footR: 4,
  footL: 5,
  upperArmR: 6,
  upperArmL: 7,
  forearmR: 8,
  forearmL: 9,
  handR: 10,
  handL: 11,
  head: 12,
  earR: 13,
  earL: 14,
  /** the held implement (the medicine ball) */
  ball: 15,
  trunk: 16,
} as const

interface PartSlot {
  tpl: Template
  base: number
}

export interface BodyLayout {
  /** total vertices */
  count: number
  index: Uint32Array
  /** per-vertex part id */
  part: Float32Array
  slots: PartSlot[]
  trunkBase: number
  trunkRings: number
}

const TRUNK_RINGS = 30
/** sigma range of the trunk loft (the TRUNK table; it ends inside the head) */
const TRUNK_FROM = TRUNK[0][0]
const TRUNK_TO = TRUNK[TRUNK.length - 1][0]

let layoutCache: BodyLayout | null = null

/** The body's shared topology (one per app; the templates are built once). */
export function bodyLayout(): BodyLayout {
  if (layoutCache) return layoutCache
  const thigh = limbTemplate(BODY.thigh, THIGH)
  const shank = limbTemplate(BODY.shank, SHANK)
  const foot = footTemplate()
  const upper = limbTemplate(BODY.upperArm, UPPER_ARM, 9)
  const fore = limbTemplate(BODY.forearm, FOREARM, 9)
  const hand = handTemplate()
  const head = headTemplate()
  const ball = sphereTemplate()
  const order: Template[] = [thigh, thigh, shank, shank, foot, foot, upper, upper, fore, fore, hand, hand, head, earTemplate(1), earTemplate(-1), ball]
  const slots: PartSlot[] = []
  let count = 0
  for (const tpl of order) {
    slots.push({ tpl, base: count })
    count += tpl.count
  }
  const trunkBase = count
  const trunkCount = TRUNK_RINGS * TRUNK_AROUND + 2
  count += trunkCount
  const idx: number[] = []
  slots.forEach((s) => {
    const ti = s.tpl.index
    for (let i = 0; i < ti.length; i++) idx.push(ti[i] + s.base)
  })
  const ti = tubeIndex(TRUNK_RINGS, TRUNK_AROUND)
  for (let i = 0; i < ti.length; i++) idx.push(ti[i] + trunkBase)
  const part = new Float32Array(count)
  slots.forEach((s, i) => part.fill(i, s.base, s.base + s.tpl.count))
  part.fill(PART.trunk, trunkBase, count)
  layoutCache = { count, index: new Uint32Array(idx), part, slots, trunkBase, trunkRings: TRUNK_RINGS }
  return layoutCache
}

/* ------------------------------ the writer ----------------------------- */

function writeRigid(slot: PartSlot, F: Frame, pos: Float32Array, nrm: Float32Array, scale = 1): void {
  const t = slot.tpl
  const { o, x, y, z } = F
  for (let i = 0; i < t.count; i++) {
    const s = i * 3
    const lx = t.pos[s] * scale
    const ly = t.pos[s + 1] * scale
    const lz = t.pos[s + 2] * scale
    const d = (slot.base + i) * 3
    pos[d] = o[0] + x[0] * lx + y[0] * ly + z[0] * lz
    pos[d + 1] = o[1] + x[1] * lx + y[1] * ly + z[1] * lz
    pos[d + 2] = o[2] + x[2] * lx + y[2] * ly + z[2] * lz
    const nx = t.nrm[s]
    const ny = t.nrm[s + 1]
    const nz = t.nrm[s + 2]
    nrm[d] = x[0] * nx + y[0] * ny + z[0] * nz
    nrm[d + 1] = x[1] * nx + y[1] * ny + z[1] * nz
    nrm[d + 2] = x[2] * nx + y[2] * ny + z[2] * nz
  }
}

/**
 * A bent part: local points with bend weight b are rotated by b x angle
 * about the local z axis through the pivot (px, py), then placed by F.
 * Feet: the hindfoot rises about the ball. Hands: the fingers curl.
 */
function writeBent(slot: PartSlot, F: Frame, angle: number, px: number, py: number, pos: Float32Array, nrm: Float32Array): void {
  const t = slot.tpl
  const bend = t.bend!
  const { o, x, y, z } = F
  for (let i = 0; i < t.count; i++) {
    const s = i * 3
    const a = angle * bend[i]
    const c = Math.cos(a)
    const sn = Math.sin(a)
    const rx = t.pos[s] - px
    const ry = t.pos[s + 1] - py
    const lx = px + rx * c - ry * sn
    const ly = py + rx * sn + ry * c
    const lz = t.pos[s + 2]
    const nx0 = t.nrm[s]
    const ny0 = t.nrm[s + 1]
    const nx = nx0 * c - ny0 * sn
    const ny = nx0 * sn + ny0 * c
    const nz = t.nrm[s + 2]
    const d = (slot.base + i) * 3
    pos[d] = o[0] + x[0] * lx + y[0] * ly + z[0] * lz
    pos[d + 1] = o[1] + x[1] * lx + y[1] * ly + z[1] * lz
    pos[d + 2] = o[2] + x[2] * lx + y[2] * ly + z[2] * lz
    nrm[d] = x[0] * nx + y[0] * ny + z[0] * nz
    nrm[d + 1] = x[1] * nx + y[1] * ny + z[1] * nz
    nrm[d + 2] = x[2] * nx + y[2] * ny + z[2] * nz
  }
}

const _flat: Frame = { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
const _ballF: Frame = { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

/** The trunk: rings along the spine centreline (sigma from the TRUNK table), normals from the grid. */
function writeTrunk(L: BodyLayout, P: Pose, pos: Float32Array, nrm: Float32Array): void {
  const R = L.trunkRings
  const A = TRUNK_AROUND
  const base = L.trunkBase
  const sp = P.spine
  const n = SPINE_N
  for (let r = 0; r < R; r++) {
    const sigma = TRUNK_FROM + ((TRUNK_TO - TRUNK_FROM) * r) / (R - 1)
    // the centreline point and tangent (extrapolated below the coccyx along its tangent)
    const f = (sigma / SPINE_LEN) * (n - 1)
    const fi = Math.min(n - 2, Math.max(0, Math.floor(f)))
    const k = f - fi
    const a = fi * 3
    let tx = sp[a + 3] - sp[a]
    let ty = sp[a + 4] - sp[a + 1]
    const tl = Math.sqrt(tx * tx + ty * ty) || 1
    tx /= tl
    ty /= tl
    const cxp = sp[a] + (sp[a + 3] - sp[a]) * k
    const cyp = sp[a + 1] + (sp[a + 4] - sp[a + 1]) * k
    // anterior normal (tangent turned clockwise)
    const nx = ty
    const ny = -tx
    const fr = lookupSmooth(TRUNK, sigma, 1)
    const bk = lookupSmooth(TRUNK, sigma, 2)
    const w = lookupSmooth(TRUNK, sigma, 3)
    for (let j = 0; j < A; j++) {
      const th = (j / A) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      const X = c >= 0 ? fr * c : bk * c
      const d = (base + r * A + j) * 3
      pos[d] = cxp + nx * X
      pos[d + 1] = cyp + ny * X
      pos[d + 2] = w * s
    }
  }
  // poles: below the bottom ring and inside the head at the top
  const p0 = (base + R * A) * 3
  const p1 = p0 + 3
  const b0 = base * 3
  const bt = (base + (R - 1) * A) * 3
  let ax = 0
  let ay = 0
  let tx2 = 0
  let ty2 = 0
  for (let j = 0; j < A; j++) {
    ax += pos[b0 + j * 3]
    ay += pos[b0 + j * 3 + 1]
    tx2 += pos[bt + j * 3]
    ty2 += pos[bt + j * 3 + 1]
  }
  ax /= A
  ay /= A
  tx2 /= A
  ty2 /= A
  // push the bottom pole down along the spine's first tangent
  const dx = sp[0] - sp[3]
  const dy = sp[1] - sp[4]
  const dl = Math.sqrt(dx * dx + dy * dy) || 1
  pos[p0] = ax + (dx / dl) * 0.03
  pos[p0 + 1] = ay + (dy / dl) * 0.03
  pos[p0 + 2] = 0
  pos[p1] = tx2
  pos[p1 + 1] = ty2 + 0.01
  pos[p1 + 2] = 0
  // normals: central differences on the grid
  for (let r = 0; r < R; r++) {
    const r0 = Math.max(0, r - 1)
    const r1 = Math.min(R - 1, r + 1)
    for (let j = 0; j < A; j++) {
      const jm = (j + A - 1) % A
      const jp = (j + 1) % A
      const d = (base + r * A + j) * 3
      const u0 = (base + r * A + jm) * 3
      const u1 = (base + r * A + jp) * 3
      const v0 = (base + r0 * A + j) * 3
      const v1 = (base + r1 * A + j) * 3
      // around (j increasing) x along (r increasing) points outward for this winding
      const ux = pos[u1] - pos[u0]
      const uy = pos[u1 + 1] - pos[u0 + 1]
      const uz = pos[u1 + 2] - pos[u0 + 2]
      const vx = pos[v1] - pos[v0]
      const vy = pos[v1 + 1] - pos[v0 + 1]
      const vz = pos[v1 + 2] - pos[v0 + 2]
      let nx = vy * uz - vz * uy
      let ny = vz * ux - vx * uz
      let nz = vx * uy - vy * ux
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx /= l
      ny /= l
      nz /= l
      nrm[d] = nx
      nrm[d + 1] = ny
      nrm[d + 2] = nz
    }
  }
  // pole normals: along the spine ends
  nrm[p0] = dx / dl
  nrm[p0 + 1] = dy / dl
  nrm[p0 + 2] = 0
  nrm[p1] = 0
  nrm[p1 + 1] = 1
  nrm[p1 + 2] = 0
}

/** Write the whole posed body into position and normal buffers (layout from bodyLayout()). */
export function writeBody(L: BodyLayout, P: Pose, pos: Float32Array, nrm: Float32Array): void {
  const S = L.slots
  writeRigid(S[PART.thighR], P.thighF[0], pos, nrm)
  writeRigid(S[PART.thighL], P.thighF[1], pos, nrm)
  writeRigid(S[PART.shankR], P.shankF[0], pos, nrm)
  writeRigid(S[PART.shankL], P.shankF[1], pos, nrm)
  // feet: the flat frame at the unrisen ankle, the hindfoot rotated about the ball
  for (let s = 0; s < 2; s++) {
    const f = P.footDir[s]
    const b = P.ball[s]
    _flat.o[0] = b[0] - f[0] * BODY.ball
    _flat.o[1] = BODY.ankleH
    _flat.o[2] = b[2] - f[2] * BODY.ball
    _flat.x[0] = f[0]
    _flat.x[1] = 0
    _flat.x[2] = f[2]
    _flat.y[0] = 0
    _flat.y[1] = 1
    _flat.y[2] = 0
    // z = x cross y
    _flat.z[0] = -f[2]
    _flat.z[1] = 0
    _flat.z[2] = f[0]
    writeBent(S[s === 0 ? PART.footR : PART.footL], _flat, -P.heelRise * DEG, BODY.ball, -BODY.ankleH, pos, nrm)
  }
  writeRigid(S[PART.upperArmR], P.upperArmF[0], pos, nrm)
  writeRigid(S[PART.upperArmL], P.upperArmF[1], pos, nrm)
  writeRigid(S[PART.forearmR], P.forearmF[0], pos, nrm)
  writeRigid(S[PART.forearmL], P.forearmF[1], pos, nrm)
  // hands: the fingers curl toward the palm (-x) about the knuckles
  const yk = BODY.knuckle * BODY.hand
  writeBent(S[PART.handR], P.handF[0], P.curl * DEG, 0, yk, pos, nrm)
  writeBent(S[PART.handL], P.handF[1], P.curl * DEG, 0, yk, pos, nrm)
  writeRigid(S[PART.head], P.headF, pos, nrm)
  writeRigid(S[PART.earR], P.headF, pos, nrm)
  writeRigid(S[PART.earL], P.headF, pos, nrm)
  // the medicine ball (fixed orientation: "laces facing out for the entire movement", p. 213); without a
  // ball it is a speck inside the pelvis, hidden by the body
  const hold = P.hold
  const r = hold.kind === 'ball' ? hold.r : 0.01
  const c = hold.kind === 'ball' ? P.bar : P.hip
  _ballF.o[0] = c[0]
  _ballF.o[1] = c[1]
  _ballF.o[2] = c[2]
  writeRigid(S[PART.ball], _ballF, pos, nrm, r)
  writeTrunk(L, P, pos, nrm)
}

/** World bounding box of a posed body (from its written positions). */
export function boundsOf(pos: Float32Array, count: number, out: { min: [number, number, number]; max: [number, number, number] }) {
  out.min[0] = out.min[1] = out.min[2] = Infinity
  out.max[0] = out.max[1] = out.max[2] = -Infinity
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      const v = pos[i * 3 + k]
      if (v < out.min[k]) out.min[k] = v
      if (v > out.max[k]) out.max[k] = v
    }
  }
  return out
}
