import { LANE_BASE, LANE_THICK, N_U, TABLE } from './pathwaysMath'

/* =========================================================================
   Band geometry (DESIGN.md D.4 "Stacked mode", "Lanes mode"), shared by the
   story and explore layers, the light (LightField FLOW) and the pens, so
   every element of a band agrees to the pixel.

   A band b (0 oxidative, 1 glycolytic, 2 phosphagen, bottom to top) owns a
   local height l in [0, th], th its thickness at u. Its world height in v
   units is

     y = m x LANE_BASE[b] + ((1 - m) x below_b + l) x thick,
     thick = 1 - (1 - LANE_THICK) x m,

   which is exactly the LightField FLOW placement (lane = m x LANE_BASE,
   stack = 1 - m, h = l): m = 0 is the stack (the top is the envelope), m = 1
   the three lanes on one shared scale. s blends power thickness (the true
   envelope) toward share thickness (explore "Share").

   A band FLOODS (P1 to P3) behind a front moving left to right: ahead of the
   front it is empty, inside a soft zone of width FLOOD_W it fills. The two
   upper bands hang from their top edge (the pen draws the edge, then light
   fills in beneath it); the oxidative base rises from the floor (D.4 P3).
   ========================================================================= */

export const FLOOD_W = 0.12

/** 0..1 smoothstep of the flood at u for a front position (front runs 0 to 1 + FLOOD_W); w is the soft zone. */
export function floodAt(front: number, u: number, w = FLOOD_W): number {
  const x = (front - u) / w
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x * x * (3 - 2 * x)
}

/** Thickness of band b at sample i for share blend s. */
export function thAt(b: number, i: number, s: number): number {
  const p = TABLE.power[b][i]
  return s <= 0 ? p : p + (TABLE.share[b][i] - p) * Math.min(1, s)
}

/** Out: [bottom, top] of band b at sample i, v units. k = flood (1 = full). */
export function bandRange(b: number, i: number, m: number, s: number, k: number, out: Float64Array | number[]): void {
  const th = thAt(b, i, s)
  let below = 0
  for (let j = 0; j < b; j++) below += thAt(j, i, s)
  let l0 = 0
  let l1 = th
  if (k < 1) {
    if (b === 0) l1 = th * k
    else l0 = th * (1 - k)
  }
  const thick = 1 - (1 - LANE_THICK) * m
  const base = m * LANE_BASE[b] + (1 - m) * below * thick
  out[0] = base + l0 * thick
  out[1] = base + l1 * thick
}

/** Top of band b (full, unflooded) at sample i. */
export function bandTop(b: number, i: number, m: number, s: number): number {
  const th = thAt(b, i, s)
  let below = 0
  for (let j = 0; j < b; j++) below += thAt(j, i, s)
  const thick = 1 - (1 - LANE_THICK) * m
  return m * LANE_BASE[b] + ((1 - m) * below + th) * thick
}

/** Stack top at sample i (power: the envelope; share: SHARE_TOP). */
export function stackTop(i: number, s: number): number {
  return thAt(0, i, s) + thAt(1, i, s) + thAt(2, i, s)
}

/** Stack top at u (linear between samples, no allocation). */
export function stackTopAt(u: number, s: number): number {
  const x = Math.max(0, Math.min(1, u)) * (N_U - 1)
  const i = Math.min(N_U - 2, Math.floor(x))
  const a = stackTop(i, s)
  return a + (stackTop(i + 1, s) - a) * (x - i)
}

/** Top of band b at u (linear between samples, no allocation). */
export function bandTopAt(b: number, u: number, m: number, s: number): number {
  const x = Math.max(0, Math.min(1, u)) * (N_U - 1)
  const i = Math.min(N_U - 2, Math.floor(x))
  const a = bandTop(b, i, m, s)
  return a + (bandTop(b, i + 1, m, s) - a) * (x - i)
}

/** Cumulative arc length of a polyline (xyz), normalised 0..1, one entry per point. */
export function arcTable(pts: Float32Array): Float32Array {
  const n = pts.length / 3
  const cum = new Float32Array(n)
  let acc = 0
  for (let i = 1; i < n; i++) {
    const dx = pts[i * 3] - pts[i * 3 - 3]
    const dy = pts[i * 3 + 1] - pts[i * 3 - 2]
    const dz = pts[i * 3 + 2] - pts[i * 3 - 1]
    acc += Math.sqrt(dx * dx + dy * dy + dz * dz)
    cum[i] = acc
  }
  const total = acc || 1
  for (let i = 0; i < n; i++) cum[i] /= total
  return cum
}

/** Arc fraction at parameter u of a polyline sampled uniformly in u (arcTable output). */
export function arcAtU(cum: Float32Array, u: number): number {
  const n = cum.length
  const x = Math.max(0, Math.min(1, u)) * (n - 1)
  const i = Math.min(n - 2, Math.floor(x))
  return cum[i] + (cum[i + 1] - cum[i]) * (x - i)
}

/** u at an arc fraction (inverse of arcAtU; cum is increasing). */
export function uAtArc(cum: Float32Array, a: number): number {
  const n = cum.length
  if (a <= 0) return 0
  if (a >= 1) return 1
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < a) lo = mid
    else hi = mid
  }
  const span = cum[hi] - cum[lo] || 1
  return (lo + (a - cum[lo]) / span) / (n - 1)
}
