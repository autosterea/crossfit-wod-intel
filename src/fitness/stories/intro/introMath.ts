import * as THREE from 'three'
import { AGING_PROFILES, ENERGY_SYSTEMS, POWER_CURVES, agingCapacity, spectrum } from '../../fitnessData'
import { catmull1, clamp } from '../../lessonMath'
import { decagon, dialGlyph, drumDots, drumGlyph, humps, underline } from '../../story/kit/shapes'
import type { IntroLayout } from './layout'

/* =========================================================================
   Intro math: the shapes the one line becomes (kit/shapes.ts generators,
   placed in world space for a layout), their ink colours, the flow morph
   between them, the Generalist curve (the same index-uniform valAt as the
   Definition chapter, so the drawn curve is the one chapter 04 integrates)
   and the Lifelong trainer capacity grid (agingCapacity, the Health
   chapter's data). Every number drawn comes from fitnessData.ts.
   ========================================================================= */

export const N_PTS = 256

/** Relative power 0..1.08 at u on the benchmark interval axis (verbatim Definition valAt). */
export function valAt(samples: number[], u: number): number {
  return clamp(catmull1(samples, u * (samples.length - 1)), 0, 1.08)
}

export const GENERALIST = POWER_CURVES[0]
export const gv = (u: number) => valAt(GENERALIST.samples, u)

/** The Health chapter's Lifelong trainer (the profile that stays above the line). */
export const LIFELONG = AGING_PROFILES.find((p) => p.name === 'Lifelong trainer') ?? AGING_PROFILES[0]
/**
 * Ages of the Health chapter's surface (HealthModule AGE_MIN, AGE_MAX).
 * Integration: import these from the Health chapter's math once it lands
 * (D.7), so the two chapters cannot drift.
 */
export const AGE_MIN = 20
export const AGE_MAX = 85
/** The lifetime surface grid (D.1 I3): 28 along duration, 20 along age. */
export const NU = 28
export const NA = 20
export const ageAt = (a: number) => AGE_MIN + ((AGE_MAX - AGE_MIN) * a) / (NA - 1)
/** Age row (fractional) of an age. */
export const rowOfAge = (age: number) => ((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * (NA - 1)

/** capacity[a * NU + i] for the Lifelong trainer. */
export const CAPACITY = (() => {
  const g = new Float32Array(NU * NA)
  for (let a = 0; a < NA; a++) for (let i = 0; i < NU; i++) g[a * NU + i] = agingCapacity(i / (NU - 1), ageAt(a), LIFELONG)
  return g
})()

/** Capacity at duration u (0..1) on age row a (fractional), linear between grid samples. */
export function capAt(u: number, a: number): number {
  const af = clamp(a, 0, NA - 1)
  const a0 = Math.min(NA - 2, Math.floor(af))
  const fa = af - a0
  const x = clamp(u, 0, 1) * (NU - 1)
  const i0 = Math.min(NU - 2, Math.floor(x))
  const fi = x - i0
  const g = CAPACITY
  const r0 = g[a0 * NU + i0] * (1 - fi) + g[a0 * NU + i0 + 1] * fi
  const r1 = g[(a0 + 1) * NU + i0] * (1 - fi) + g[(a0 + 1) * NU + i0 + 1] * fi
  return r0 * (1 - fa) + r1 * fa
}

/** The highest capacity on each age row (the surface's ridge height per age). */
export const ROW_MAX = (() => {
  const m = new Float32Array(NA)
  for (let a = 0; a < NA; a++) {
    let v = 0
    for (let i = 0; i < NU; i++) v = Math.max(v, CAPACITY[a * NU + i])
    m[a] = v
  }
  return m
})()

/* -------------------------------- shapes ------------------------------- */

/**
 * Which morphs flow from the END of the stroke. The humps are held in
 * reverse point order (their right foot is point 0): the drum then unzips
 * from its left side down into the humps (drawn left to right, time's
 * direction, L11), and the humps unzip from their right foot straight on
 * into the dial beside them. Neither stroke ever folds back across itself.
 */
export const REVERSED = [false, false, true, false] as const
/** Pen j (its ink) is written from the stroke's end when the morph that forms it runs reversed. */
export const penReversed = (j: number) => j > 0 && REVERSED[j - 1]
/** The point of shape j (world) where its pen finishes: its last point, or its first for a reversed morph. */
export const closeIndex = (j: number) => (penReversed(j) ? 0 : N_PTS - 1)

export interface HeroShapes {
  /** 0 underline, 1 decagon, 2 drum, 3 humps (reverse order), 4 dial: world space, N_PTS points each */
  world: Float32Array[]
  /**
   * The same shapes while their points are still in flight: the dial's ten
   * inward ticks retracted onto its rim (null where a shape has no ticks),
   * so a morph never folds the line into a zig-zag before it lands.
   */
  soft: (Float32Array | null)[]
  /** the four model glyphs centred on the origin at the cell radius (held, docked and tiled copies) */
  local: Float32Array[]
  /** half height of each local glyph (label anchor below it) */
  half: number[]
  /** drum dots (local, at the cell radius) */
  dots: [number, number, number][]
}

const shift = (pts: Float32Array, dx: number, dy: number): Float32Array => {
  const o = pts.slice()
  for (let i = 0; i < o.length; i += 3) {
    o[i] += dx
    o[i + 1] += dy
  }
  return o
}

const halfHeight = (pts: Float32Array): number => {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 1; i < pts.length; i += 3) {
    lo = Math.min(lo, pts[i])
    hi = Math.max(hi, pts[i])
  }
  return (hi - lo) / 2
}

const reversed = (pts: Float32Array): Float32Array => {
  const n = pts.length / 3
  const o = new Float32Array(pts.length)
  for (let i = 0; i < n; i++) o.set(pts.subarray((n - 1 - i) * 3, (n - i) * 3), i * 3)
  return o
}

/** Every point pushed out to radius r about (cx, cy): the dial without its ticks. */
function toRim(pts: Float32Array, cx: number, cy: number, r: number): Float32Array {
  const o = pts.slice()
  for (let i = 0; i < o.length; i += 3) {
    const dx = o[i] - cx
    const dy = o[i + 1] - cy
    const d = Math.hypot(dx, dy) || 1
    o[i] = cx + (dx / d) * r
    o[i + 1] = cy + (dy / d) * r
  }
  return o
}

/** Humps width and height for a cell radius. */
export const humpsSize = (r: number) => ({ w: 2 * r * 1.12, h: 2 * r * 0.78 })

export function heroShapes(L: IntroLayout): HeroShapes {
  const r = L.cells.r
  const u = L.underline
  const line = shift(underline(u.x1 - u.x0), (u.x0 + u.x1) / 2, u.y)
  const hs = humpsSize(r)
  const local = [decagon(r), drumGlyph(r * 0.97), humps(hs.w, hs.h), dialGlyph(r)]
  const world = [line, ...local.map((p, c) => shift(p, L.cells.xs[c], L.cells.ys[c]))]
  for (let j = 1; j < world.length; j++) if (penReversed(j)) world[j] = reversed(world[j])
  return {
    world,
    soft: [null, null, null, null, toRim(world[4], L.cells.xs[3], L.cells.ys[3], r)],
    local,
    half: local.map(halfHeight),
    dots: drumDots(r * 0.97),
  }
}

/**
 * out = a -> b at k, flowing along the stroke: point i starts at
 * stagger * i / n of the window and eases in and out (kit tween.morphPoints).
 * While a point is in flight it heads for `soft` (the target without its
 * ticks), and it takes the target's true place only as it lands, so the
 * dial's ticks grow inward from the rim as the line arrives.
 */
export function morphFlow(out: Float32Array, a: Float32Array, b: Float32Array, soft: Float32Array | null, k: number, stagger: number, reverse = false): void {
  const n = out.length / 3
  for (let i = 0; i < n; i++) {
    // a reversed morph starts from the stroke's last point
    const off = (stagger * (reverse ? n - 1 - i : i)) / (n - 1)
    const kk = Math.max(0, Math.min(1, (k - off) / (1 - stagger)))
    const e = kk < 0.5 ? 8 * kk * kk * kk * kk : 1 - Math.pow(-2 * kk + 2, 4) / 2
    const o = i * 3
    if (soft) {
      // the tick grows in over the last 30% of the point's own flight
      const g = kk <= 0.7 ? 0 : (kk - 0.7) / 0.3
      const land = g * g * (3 - 2 * g)
      for (let d = 0; d < 3; d++) {
        const t = soft[o + d] + (b[o + d] - soft[o + d]) * land
        out[o + d] = a[o + d] + (t - a[o + d]) * e
      }
    } else {
      out[o] = a[o] + (b[o] - a[o]) * e
      out[o + 1] = a[o + 1] + (b[o + 1] - a[o + 1]) * e
      out[o + 2] = a[o + 2] + (b[o + 2] - a[o + 2]) * e
    }
  }
}

/* -------------------------------- inks --------------------------------- */

const _c = new THREE.Color()

/** sRGB 0..1 components -> linear (the pens' vertex colours are linear). */
function linRGB(rgb: readonly [number, number, number]): [number, number, number] {
  _c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace)
  return [_c.r, _c.g, _c.b]
}
function linHex(hex: string): [number, number, number] {
  _c.set(hex)
  return [_c.r, _c.g, _c.b]
}

/** Energy humps: each hump in its engine colour (phosphagen, glycolytic, oxidative), by x. */
export function humpInk(pts: Float32Array, w: number): (i: number) => [number, number, number] {
  const cols = ENERGY_SYSTEMS.map((s) => linHex(s.color))
  return (i: number) => {
    const x = (pts[i * 3] + pts[i * 3 + 3]) / 2
    const k = x < -w / 6 ? 0 : x < w / 6 ? 1 : 2
    return cols[k]
  }
}

/**
 * The continuum dial, coloured by RADIUS as chapter 05 encodes it ("Center
 * is sickness, the rim is fitness"): the rim is fitness (spectrum 1), and
 * each inward tick ramps down the spectrum to sickness at its inner tip.
 * `pts` is the dial centred on the origin with rim radius r.
 */
export function dialInk(pts: Float32Array, r: number): (i: number) => [number, number, number] {
  const TIP = 0.78
  return (i: number) => {
    const x = (pts[i * 3] + pts[i * 3 + 3]) / 2
    const y = (pts[i * 3 + 1] + pts[i * 3 + 4]) / 2
    const t = clamp((Math.hypot(x, y) / r - TIP) / (1 - TIP), 0, 1)
    return linRGB(spectrum(t))
  }
}

/** Per-segment colours (6 floats per segment) for a polyline of n points. */
export function segColors(n: number, ink: (i: number) => [number, number, number]): Float32Array {
  const out = new Float32Array((n - 1) * 6)
  for (let i = 0; i < n - 1; i++) {
    const c = ink(i)
    out.set([c[0], c[1], c[2], c[0], c[1], c[2]], i * 6)
  }
  return out
}

/** Per-point colours (3 floats per point) for a Pen. */
export function pointColors(n: number, ink: (i: number) => [number, number, number]): Float32Array {
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const c = ink(Math.min(i, n - 2))
    out.set(c, i * 3)
  }
  return out
}

/** Polyline -> segment buffer (in place); `rev` writes it from the last point back, so draw-on runs from the end. */
export function toSegments(pts: Float32Array, segs: Float32Array, rev = false): void {
  const n = pts.length / 3
  if (!rev) {
    for (let i = 0; i < n - 1; i++) segs.set(pts.subarray(i * 3, i * 3 + 6), i * 6)
    return
  }
  for (let k = 0; k < n - 1; k++) {
    const a = (n - 1 - k) * 3
    const b = (n - 2 - k) * 3
    const o = k * 6
    segs[o] = pts[a]
    segs[o + 1] = pts[a + 1]
    segs[o + 2] = pts[a + 2]
    segs[o + 3] = pts[b]
    segs[o + 4] = pts[b + 1]
    segs[o + 5] = pts[b + 2]
  }
}
