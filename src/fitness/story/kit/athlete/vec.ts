/* =========================================================================
   Tiny in-place vector helpers for the athlete kit (no allocation; every
   function writes into `o` and returns it). Tuples, not THREE.Vector3, so
   the rig stays a pure module that runs in node for its checks.
   ========================================================================= */

export type Vec = [number, number, number]

export const DEG = Math.PI / 180
export const v3 = (): Vec => [0, 0, 0]

export const set = (o: Vec, x: number, y: number, z: number): Vec => {
  o[0] = x
  o[1] = y
  o[2] = z
  return o
}
export const copy = (o: Vec, a: Readonly<Vec>): Vec => set(o, a[0], a[1], a[2])
export const len = (a: Readonly<Vec>) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
export const norm = (o: Vec): Vec => {
  const l = len(o)
  if (l > 1e-12) {
    o[0] /= l
    o[1] /= l
    o[2] /= l
  } else set(o, 1, 0, 0)
  return o
}
export const dot = (a: Readonly<Vec>, b: Readonly<Vec>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (o: Vec, a: Readonly<Vec>, b: Readonly<Vec>): Vec =>
  set(o, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
/** o = a + b * k */
export const addK = (o: Vec, a: Readonly<Vec>, b: Readonly<Vec>, k: number): Vec => set(o, a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k)
export const sub = (o: Vec, a: Readonly<Vec>, b: Readonly<Vec>): Vec => set(o, a[0] - b[0], a[1] - b[1], a[2] - b[2])
export const lerp3 = (o: Vec, a: Readonly<Vec>, b: Readonly<Vec>, k: number): Vec =>
  set(o, a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k)

/**
 * A point (x, y) of a sagittal frame that leans FORWARD by `leanDeg` (its
 * up axis tips toward +x), at origin o; z = o.z + dz.
 */
export function lean2(out: Vec, o: Readonly<Vec>, leanDeg: number, x: number, y: number, dz = 0): Vec {
  const c = Math.cos(leanDeg * DEG)
  const s = Math.sin(leanDeg * DEG)
  return set(out, o[0] + x * c + y * s, o[1] - x * s + y * c, o[2] + dz)
}

/** A rigid part's frame: origin plus orthonormal axes (x anterior, y along the bone, z = x cross y). */
export interface Frame {
  o: Vec
  x: Vec
  y: Vec
  z: Vec
}
export const newFrame = (): Frame => ({ o: v3(), x: v3(), y: v3(), z: v3() })

/** Frame from a bone a -> b and a hint for its anterior axis (made orthogonal to the bone). */
export function boneFrame(f: Frame, a: Readonly<Vec>, b: Readonly<Vec>, hint: Readonly<Vec>): Frame {
  copy(f.o, a)
  norm(sub(f.y, b, a))
  const d = dot(hint, f.y)
  set(f.x, hint[0] - f.y[0] * d, hint[1] - f.y[1] * d, hint[2] - f.y[2] * d)
  if (len(f.x) < 1e-6) set(f.x, f.y[1], -f.y[0], 0)
  if (len(f.x) < 1e-6) set(f.x, 0, 0, 1)
  norm(f.x)
  cross(f.z, f.x, f.y)
  return f
}

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)
export const mixN = (a: number, b: number, k: number) => a + (b - a) * k
export const smooth = (x: number) => {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}
