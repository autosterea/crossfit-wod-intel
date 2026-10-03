/* =========================================================================
   08 TECHNIQUE geometry helpers: arrows (a pen shaft plus a two-stroke
   head), circles and parking. All write into existing buffers (nothing
   allocates per frame). A segment buffer holds 6 floats per segment; a
   segment a pen should not show yet is PARKED far away (x = 1e5), never at
   zero length (a zero-length segment draws a round dot, README).
   ========================================================================= */

export const PARK = 1e5

/** Park `count` segments starting at segment index `s`. */
export function parkSegs(segs: Float32Array, s: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const o = (s + i) * 6
    segs[o] = PARK
    segs[o + 1] = PARK
    segs[o + 2] = 0
    segs[o + 3] = PARK + 1
    segs[o + 4] = PARK
    segs[o + 5] = 0
  }
}

export function seg(segs: Float32Array, s: number, x0: number, y0: number, x1: number, y1: number, z = 0): void {
  const o = s * 6
  segs[o] = x0
  segs[o + 1] = y0
  segs[o + 2] = z
  segs[o + 3] = x1
  segs[o + 4] = y1
  segs[o + 5] = z
}

/**
 * A two-stroke arrowhead at (x1, y1) pointing along (x1 - x0, y1 - y0), into
 * segments s and s + 1. `len` is the stroke length (world), `deg` its angle
 * off the shaft. A degenerate direction parks both strokes.
 */
export function headSegs(segs: Float32Array, s: number, x0: number, y0: number, x1: number, y1: number, len: number, deg = 28, z = 0): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const d = Math.hypot(dx, dy)
  if (d < 1e-6 || len <= 1e-6) {
    parkSegs(segs, s, 2)
    return
  }
  const ux = dx / d
  const uy = dy / d
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const n = Math.sin(a)
  // rotate -u by +-a
  const lx = -(ux * c - uy * n) * len
  const ly = -(ux * n + uy * c) * len
  const rx = -(ux * c + uy * n) * len
  const ry = -(-ux * n + uy * c) * len
  seg(segs, s, x1, y1, x1 + lx, y1 + ly, z)
  seg(segs, s + 1, x1, y1, x1 + rx, y1 + ry, z)
}

/** A polyline (xyz) of a circle, closed: n + 1 points. */
export function circlePts(cx: number, cy: number, r: number, n: number, out?: Float32Array, z = 0): Float32Array {
  const o = out ?? new Float32Array((n + 1) * 3)
  for (let i = 0; i <= n; i++) {
    // from 12 o'clock, clockwise (the kit's convention)
    const a = Math.PI / 2 - (i / n) * Math.PI * 2
    o[i * 3] = cx + Math.cos(a) * r
    o[i * 3 + 1] = cy + Math.sin(a) * r
    o[i * 3 + 2] = z
  }
  return o
}

/** Circle segments into a segment buffer from segment s (n segments). */
export function circleSegs(segs: Float32Array, s: number, cx: number, cy: number, rx: number, ry: number, n: number, z = 0): void {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    seg(segs, s + i, cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry, z)
  }
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const mix = (a: number, b: number, k: number) => a + (b - a) * k
