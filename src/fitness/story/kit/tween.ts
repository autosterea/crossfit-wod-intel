import type { V3 } from '../types'

/* Tween helpers (DESIGN.md C.11). Morphs interpolate resampled point sets
   (256 points, arc-length resampled, same start angle and winding). */

export const mix = (a: number, b: number, k: number) => a + (b - a) * k

export function mixV3(a: V3, b: V3, k: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

/** Cumulative arc lengths of an xyz polyline (length n). */
export function arcLengths(pts: Float32Array): Float32Array {
  const n = pts.length / 3
  const out = new Float32Array(n)
  for (let i = 1; i < n; i++) {
    const dx = pts[i * 3] - pts[i * 3 - 3]
    const dy = pts[i * 3 + 1] - pts[i * 3 - 2]
    const dz = pts[i * 3 + 2] - pts[i * 3 - 1]
    out[i] = out[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  return out
}

/** Arc-length resample an xyz polyline to `count` points. */
export function resample(pts: Float32Array, count = 256): Float32Array {
  const n = pts.length / 3
  const out = new Float32Array(count * 3)
  if (n < 2) return out
  const cum = arcLengths(pts)
  const L = cum[n - 1] || 1
  let j = 0
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * L
    while (j < n - 2 && cum[j + 1] < target) j++
    const seg = cum[j + 1] - cum[j]
    const f = seg > 0 ? (target - cum[j]) / seg : 0
    out[i * 3] = pts[j * 3] + (pts[j * 3 + 3] - pts[j * 3]) * f
    out[i * 3 + 1] = pts[j * 3 + 1] + (pts[j * 3 + 4] - pts[j * 3 + 1]) * f
    out[i * 3 + 2] = pts[j * 3 + 2] + (pts[j * 3 + 5] - pts[j * 3 + 2]) * f
  }
  return out
}

/**
 * out = a -> b at k, with a stagger along the index so the morph flows:
 * point i starts at stagger * i / n of the window.
 */
export function morphPoints(out: Float32Array, a: Float32Array, b: Float32Array, k: number, stagger = 0): Float32Array {
  const n = out.length / 3
  for (let i = 0; i < n; i++) {
    const off = n > 1 ? (stagger * i) / (n - 1) : 0
    const kk = stagger > 0 ? Math.max(0, Math.min(1, (k - off) / (1 - stagger))) : k
    const e = kk < 0.5 ? 8 * kk * kk * kk * kk : 1 - Math.pow(-2 * kk + 2, 4) / 2
    out[i * 3] = a[i * 3] + (b[i * 3] - a[i * 3]) * e
    out[i * 3 + 1] = a[i * 3 + 1] + (b[i * 3 + 1] - a[i * 3 + 1]) * e
    out[i * 3 + 2] = a[i * 3 + 2] + (b[i * 3 + 2] - a[i * 3 + 2]) * e
  }
  return out
}
