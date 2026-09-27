import { resample } from './tween'
import { ENERGY_PEAK_POWER, POWER_CURVES } from '../../fitnessData'
import { catmull1, clamp } from '../../lessonMath'

/* =========================================================================
   Shape generators (DESIGN.md C.11, D.1). Each returns an xyz polyline of
   256 arc-length points in the XY plane, centred on the origin. Closed
   shapes start at 12 o'clock and run clockwise, so morphs between them never
   twist. toSvgPath renders the same shapes as inline SVG for the chapter
   sheet and the no-WebGL fallback.
   ========================================================================= */

const N = 256

function fromXY(xy: number[]): Float32Array {
  const a = new Float32Array((xy.length / 2) * 3)
  for (let i = 0; i < xy.length / 2; i++) {
    a[i * 3] = xy[i * 2]
    a[i * 3 + 1] = xy[i * 2 + 1]
  }
  return a
}

export function underline(w: number): Float32Array {
  return resample(fromXY([-w / 2, 0, w / 2, 0]), N)
}

/** Regular polygon, first vertex at 12 o'clock, clockwise, closed. */
function polygon(r: number, sides: number): Float32Array {
  const xy: number[] = []
  for (let i = 0; i <= sides; i++) {
    const a = Math.PI / 2 - (i / sides) * Math.PI * 2
    xy.push(Math.cos(a) * r, Math.sin(a) * r)
  }
  return resample(fromXY(xy), N)
}

export const decagon = (r: number) => polygon(r, 10)

/** Circle from 12 o'clock, clockwise (the drum rim). */
export function drumGlyph(r: number): Float32Array {
  return polygon(r, 96)
}

/** The five domain dots on the drum rim (for instanced nodes). */
export function drumDots(r: number): [number, number, number][] {
  return [0, 1, 2, 3, 4].map((i) => {
    const a = Math.PI / 2 - (i / 5) * Math.PI * 2 - Math.PI / 5
    return [Math.cos(a) * r, Math.sin(a) * r, 0]
  })
}

/** Three energy humps laid end to end along a baseline, heights by relative peak power. */
export function humps(w: number, h: number): Float32Array {
  const peaks = [ENERGY_PEAK_POWER.phosphagen, ENERGY_PEAK_POWER.glycolytic, ENERGY_PEAK_POWER.oxidative]
  const xy: number[] = []
  const seg = w / 3
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i <= 24; i++) {
      if (k > 0 && i === 0) continue
      const f = i / 24
      const x = -w / 2 + seg * (k + f)
      const y = -h / 2 + h * peaks[k] * Math.pow(Math.sin(Math.PI * f), 1.4)
      xy.push(x, y)
    }
  }
  return resample(fromXY(xy), N)
}

/** Full circle with 10 inward ticks, drawn as one continuous stroke. */
export function dialGlyph(r: number): Float32Array {
  const xy: number[] = []
  const steps = 200
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const a = Math.PI / 2 - f * Math.PI * 2
    xy.push(Math.cos(a) * r, Math.sin(a) * r)
    if (i < steps && i % 20 === 0) {
      xy.push(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, Math.cos(a) * r, Math.sin(a) * r)
    }
  }
  return resample(fromXY(xy), N)
}

/** Relative power at u on an index-uniform sample axis (same as the Definition valAt). */
const valAt = (samples: number[], u: number) => clamp(catmull1(samples, u * (samples.length - 1)), 0, 1.08)

/** A power curve plus its area outline: curve left to right, down, back along the baseline, up. */
export function curveGlyph(samples: number[] = POWER_CURVES[0].samples, w = 4, h = 3, closed = true): Float32Array {
  const xy: number[] = []
  const M = 48
  for (let i = 0; i <= M; i++) {
    const u = i / M
    xy.push(-w / 2 + u * w, -h / 2 + valAt(samples, u) * h)
  }
  if (closed) xy.push(w / 2, -h / 2, -w / 2, -h / 2, -w / 2, -h / 2 + valAt(samples, 0) * h)
  return resample(fromXY(xy), N)
}

/** Three offset ridgelines (a lifetime surface seen from the side). */
export function surfaceGlyph(w = 4, h = 3): Float32Array[] {
  const out: Float32Array[] = []
  for (let k = 0; k < 3; k++) {
    const xy: number[] = []
    const dx = k * w * 0.08
    const dy = -k * h * 0.22
    for (let i = 0; i <= 32; i++) {
      const u = i / 32
      const y = h * (0.36 - 0.22 * u - k * 0.05) + Math.sin(u * Math.PI) * h * 0.06
      xy.push(-w / 2 + dx + u * w * 0.84, dy + y)
    }
    out.push(resample(fromXY(xy), 64))
  }
  return out
}

/** Inline-SVG path for one or more polylines, fitted into a size x size box (y up). */
export function toSvgPath(points: Float32Array | Float32Array[], size: number, pad = 3): string {
  const lists = Array.isArray(points) ? points : [points]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of lists) {
    for (let i = 0; i < p.length; i += 3) {
      minX = Math.min(minX, p[i])
      maxX = Math.max(maxX, p[i])
      minY = Math.min(minY, p[i + 1])
      maxY = Math.max(maxY, p[i + 1])
    }
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const s = (size - pad * 2) / span
  const ox = pad + (size - pad * 2 - (maxX - minX) * s) / 2
  const oy = pad + (size - pad * 2 - (maxY - minY) * s) / 2
  let d = ''
  for (const p of lists) {
    for (let i = 0; i < p.length; i += 3) {
      const x = ox + (p[i] - minX) * s
      const y = size - (oy + (p[i + 1] - minY) * s)
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    }
  }
  return d
}
