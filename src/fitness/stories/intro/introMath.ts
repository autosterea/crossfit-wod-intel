import * as THREE from 'three'
import { AGING_PROFILES, ENERGY_SYSTEMS, POWER_CURVES, agingCapacity, spectrum } from '../../fitnessData'
import { catmull1, clamp } from '../../lessonMath'
import { decagon, dialGlyph, drumDots, drumGlyph, humps, underline } from '../../story/kit/shapes'
import type { IntroLayout } from './layout'

/* =========================================================================
   Intro math: the shapes the one line becomes (kit/shapes.ts generators,
   placed in world space for a layout), their ink colours, the Generalist
   curve (the same index-uniform valAt as the Definition chapter, so the
   drawn curve is the one chapter 04 integrates) and the Lifelong trainer
   capacity grid (agingCapacity, the Health chapter's data).
   Every number drawn comes from fitnessData.ts.
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
/** Ages of the Health chapter's surface (HealthModule AGE_MIN, AGE_MAX). */
export const AGE_MIN = 20
export const AGE_MAX = 85
/** The lifetime surface grid (D.1 I3): 28 along duration, 20 along age. */
export const NU = 28
export const NA = 20
export const ageAt = (a: number) => AGE_MIN + ((AGE_MAX - AGE_MIN) * a) / (NA - 1)

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

/* -------------------------------- shapes ------------------------------- */

export interface HeroShapes {
  /** 0 underline, 1 decagon, 2 drum, 3 humps, 4 dial: world space, N_PTS points each */
  world: Float32Array[]
  /** the four model glyphs centred on the origin (docked and tiled copies) */
  local: Float32Array[]
  /** half height of each local glyph (label anchor below it) */
  half: number[]
  /** drum dots (local, unscaled) */
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

/** Humps width and height for a formation radius. */
export const humpsSize = (r: number) => ({ w: 2 * r * 1.12, h: 2 * r * 0.78 })

export function heroShapes(L: IntroLayout): HeroShapes {
  const r = L.form.r
  const [fx, fy] = L.form.c
  const u = L.underline
  const line = shift(underline(u.x1 - u.x0), (u.x0 + u.x1) / 2, u.y)
  const hs = humpsSize(r)
  const local = [decagon(r), drumGlyph(r * 0.97), humps(hs.w, hs.h), dialGlyph(r)]
  return {
    world: [line, ...local.map((p) => shift(p, fx, fy))],
    local,
    half: local.map(halfHeight),
    dots: drumDots(r * 0.97),
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
 * The continuum dial: the sickness to fitness spectrum around the circle,
 * fitness at 12 o'clock and sickness at 6, so the ring has no seam.
 */
export function dialInk(pts: Float32Array): (i: number) => [number, number, number] {
  return (i: number) => {
    const x = (pts[i * 3] + pts[i * 3 + 3]) / 2
    const y = (pts[i * 3 + 1] + pts[i * 3 + 4]) / 2
    const a = Math.atan2(x, y)
    return linRGB(spectrum(0.5 + 0.5 * Math.cos(a)))
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

/** Polyline -> segment buffer (in place). */
export function toSegments(pts: Float32Array, segs: Float32Array): void {
  const n = pts.length / 3
  for (let i = 0; i < n - 1; i++) segs.set(pts.subarray(i * 3, i * 3 + 6), i * 6)
}
