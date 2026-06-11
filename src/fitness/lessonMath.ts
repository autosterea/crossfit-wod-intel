/**
 * Small math helpers shared across the What Is Fitness lesson modules.
 * Kept dependency-free so every module (and the procedural figures) can use them.
 */

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const map = (v: number, a: number, b: number, c: number, d: number) =>
  c + (d - c) * ((v - a) / (b - a))

/** Frame-rate independent smoothing factor for exponential approach. */
export const smoothK = (dt: number, k: number) => 1 - Math.exp(-dt * k)

/** Map a duration in seconds onto 0..1 on a log axis between tMin and tMax. */
export const logU = (t: number, tMin: number, tMax: number) =>
  (Math.log(t) - Math.log(tMin)) / (Math.log(tMax) - Math.log(tMin))

/** Inverse of logU. */
export const uToT = (u: number, tMin: number, tMax: number) =>
  Math.exp(lerp(Math.log(tMin), Math.log(tMax), u))

/** Catmull-Rom interpolation across an array of control values at parameter t in [0, n-1]. */
export function catmull1(vals: number[], t: number): number {
  const n = vals.length
  t = clamp(t, 0, n - 1.0001)
  const i = Math.floor(t)
  const f = t - i
  const p0 = vals[Math.max(0, i - 1)]
  const p1 = vals[i]
  const p2 = vals[Math.min(n - 1, i + 1)]
  const p3 = vals[Math.min(n - 1, i + 2)]
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f)
}

/** Smoothstep between edges a and b. */
export function smoothstep(a: number, b: number, x: number): number {
  x = clamp((x - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}

/** Format seconds into a compact human label (sec / min / hr). */
export function fmtDuration(t: number): string {
  if (t < 90) return `${Math.round(t)} sec`
  const m = t / 60
  if (m < 60) return `${m < 10 ? m.toFixed(1) : Math.round(m)} min`
  return `${(m / 60).toFixed(1)} hr`
}

/** Respect the user's reduced-motion preference (read once, safe in SSR-less app). */
export const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
