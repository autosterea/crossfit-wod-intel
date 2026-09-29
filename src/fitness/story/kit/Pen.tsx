import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { useStoryStore } from '../store'
import { makeGlowMaterial, makePenMaterial } from './materials'
import type { V3 } from '../types'

/* =========================================================================
   The pen (DESIGN.md B.9, C.11): LineSegments2 + LineMaterial with screen
   pixel widths. Draw-on sets geometry.instanceCount and clips the last
   segment at the exact fractional arc length, so any seek is exact and
   nothing reallocates. A luminous head rides the tip; the last 8% of the
   drawn length glows toward the head colour.

   Widths by role: grid 1.25, axes and ticks 2, data 3, hero 4.5.
   ========================================================================= */

export const PEN = { grid: 1.25, axis: 2, data: 3, hero: 4.5 } as const

const HEAD_COLOR = new THREE.Color('#f4ffe0')

function toFloat(points: Float32Array | readonly V3[]): Float32Array {
  if (points instanceof Float32Array) return points
  const a = new Float32Array(points.length * 3)
  points.forEach((p, i) => {
    a[i * 3] = p[0]
    a[i * 3 + 1] = p[1]
    a[i * 3 + 2] = p[2]
  })
  return a
}

/** Internal: a segment buffer with arc lengths, draw-on clipping and a head. */
class PenCore {
  segs: number
  buf: Float32Array
  src: Float32Array
  arc: Float32Array
  cum: Float32Array
  total = 0
  geometry: LineSegmentsGeometry
  line: LineSegments2
  ib: THREE.InstancedInterleavedBuffer
  arcIb: THREE.InstancedInterleavedBuffer
  distIb: THREE.InstancedInterleavedBuffer | null = null
  dist: Float32Array | null = null
  clipped = -1
  headPos = new THREE.Vector3()
  lastP = -1
  lastHead = 0
  dirty = true

  constructor(segBuf: Float32Array, colors: Float32Array | null, material: THREE.Material, dashed: boolean) {
    this.segs = segBuf.length / 6
    this.src = segBuf.slice()
    this.buf = segBuf.slice()
    this.cum = new Float32Array(this.segs + 1)
    this.arc = new Float32Array(this.segs * 2)
    this.geometry = new LineSegmentsGeometry()
    this.geometry.setPositions(this.buf)
    if (colors) this.geometry.setColors(colors)
    this.ib = (this.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer
    this.ib.setUsage(THREE.DynamicDrawUsage)
    this.arcIb = new THREE.InstancedInterleavedBuffer(this.arc, 2, 1)
    this.geometry.setAttribute('instanceArc', new THREE.InterleavedBufferAttribute(this.arcIb, 2, 0))
    if (dashed) {
      this.dist = new Float32Array(this.segs * 2)
      this.distIb = new THREE.InstancedInterleavedBuffer(this.dist, 2, 1)
      this.geometry.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(this.distIb, 1, 0))
      this.geometry.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(this.distIb, 1, 1))
    }
    this.line = new LineSegments2(this.geometry, material as never)
    this.line.frustumCulled = false
    this.measure()
  }

  /** Recompute cumulative arc lengths from src. */
  measure(): void {
    const s = this.src
    let acc = 0
    this.cum[0] = 0
    for (let i = 0; i < this.segs; i++) {
      const o = i * 6
      const dx = s[o + 3] - s[o]
      const dy = s[o + 4] - s[o + 1]
      const dz = s[o + 5] - s[o + 2]
      acc += Math.sqrt(dx * dx + dy * dy + dz * dz)
      this.cum[i + 1] = acc
    }
    this.total = acc || 1
    for (let i = 0; i < this.segs; i++) {
      this.arc[i * 2] = this.cum[i] / this.total
      this.arc[i * 2 + 1] = this.cum[i + 1] / this.total
      if (this.dist) {
        this.dist[i * 2] = this.cum[i]
        this.dist[i * 2 + 1] = this.cum[i + 1]
      }
    }
    this.arcIb.needsUpdate = true
    if (this.distIb) this.distIb.needsUpdate = true
  }

  /** src changed: copy into buf, re-measure. */
  refresh(): void {
    this.buf.set(this.src)
    this.clipped = -1
    this.dirty = true
    this.measure()
    this.ib.needsUpdate = true
  }

  restoreClip(): void {
    if (this.clipped < 0) return
    const o = this.clipped * 6
    this.buf[o + 3] = this.src[o + 3]
    this.buf[o + 4] = this.src[o + 4]
    this.buf[o + 5] = this.src[o + 5]
    this.arc[this.clipped * 2 + 1] = this.cum[this.clipped + 1] / this.total
    this.clipped = -1
  }

  /** Draw-on to progress p (arc-length parametrised). Returns the head arc 0..1. */
  draw(p: number, byIndex = false): number {
    if (p === this.lastP && !this.dirty) return this.lastHead
    this.lastP = p
    this.dirty = false
    this.lastHead = this.drawAt(p, byIndex)
    return this.lastHead
  }

  private drawAt(p: number, byIndex: boolean): number {
    this.restoreClip()
    if (p >= 1) {
      this.geometry.instanceCount = this.segs
      const o = (this.segs - 1) * 6
      this.headPos.set(this.src[o + 3], this.src[o + 4], this.src[o + 5])
      this.ib.needsUpdate = true
      this.arcIb.needsUpdate = true
      return 1
    }
    if (p <= 0) {
      this.geometry.instanceCount = 0
      this.headPos.set(this.src[0], this.src[1], this.src[2])
      this.ib.needsUpdate = true
      return 0
    }
    let i = 0
    let f = 0
    if (byIndex) {
      const x = p * this.segs
      i = Math.min(this.segs - 1, Math.floor(x))
      f = x - i
    } else {
      const target = p * this.total
      // binary search over cum
      let lo = 0
      let hi = this.segs - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (this.cum[mid] <= target) lo = mid
        else hi = mid - 1
      }
      i = lo
      const len = this.cum[i + 1] - this.cum[i]
      f = len > 0 ? (target - this.cum[i]) / len : 1
    }
    const o = i * 6
    const x = this.src[o] + (this.src[o + 3] - this.src[o]) * f
    const y = this.src[o + 1] + (this.src[o + 4] - this.src[o + 1]) * f
    const z = this.src[o + 2] + (this.src[o + 5] - this.src[o + 2]) * f
    this.buf[o + 3] = x
    this.buf[o + 4] = y
    this.buf[o + 5] = z
    const headArc = (this.cum[i] + (this.cum[i + 1] - this.cum[i]) * f) / this.total
    this.arc[i * 2 + 1] = headArc
    this.clipped = i
    this.geometry.instanceCount = i + 1
    this.headPos.set(x, y, z)
    this.ib.needsUpdate = true
    this.arcIb.needsUpdate = true
    return headArc
  }

  dispose(): void {
    this.geometry.dispose()
  }
}

/** Polyline points -> segment buffer (6 floats per segment). */
export function polylineToSegments(pts: Float32Array): Float32Array {
  const n = pts.length / 3
  const out = new Float32Array(Math.max(0, n - 1) * 6)
  writePolyline(pts, out)
  return out
}

/**
 * Write a polyline into an existing segment buffer (in place). A scalar loop:
 * `subarray` allocates a view per segment, and pen `update` writers call this
 * on every frame they change (integration H.53, the intro's report).
 */
export function writePolyline(pts: Float32Array, segs: Float32Array): void {
  const n = pts.length / 3
  for (let i = 0; i < n - 1; i++) {
    const a = i * 3
    const o = i * 6
    segs[o] = pts[a]
    segs[o + 1] = pts[a + 1]
    segs[o + 2] = pts[a + 2]
    segs[o + 3] = pts[a + 3]
    segs[o + 4] = pts[a + 4]
    segs[o + 5] = pts[a + 5]
  }
}

/*
 * The pen head (B.9, L4): the luminous tip that says "this is being drawn
 * now". Two additive points in one draw call: a hot white core (HDR, it
 * blooms) and a wide soft halo tinted by the stroke colour, so the head reads
 * as light even where bloom is weak (the MEDIUM tier blooms at half
 * resolution and eats small cores; LOW has no bloom at all). Sizes are CSS px.
 */
const HEAD = {
  core: { hot: 15, cool: 10 },
  halo: { hot: 46, cool: 26 },
  /** core colour gain: HDR on hot heads */
  gain: { hot: 3.2, cool: 1.3 },
  haloGain: { hot: 1.5, cool: 0.55 },
}

function makeHead(hot: boolean, tint: string) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
  const c = HEAD_COLOR.clone().multiplyScalar(hot ? HEAD.gain.hot : HEAD.gain.cool)
  const t = new THREE.Color(tint).lerp(HEAD_COLOR, 0.35).multiplyScalar(hot ? HEAD.haloGain.hot : HEAD.haloGain.cool)
  g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([c.r, c.g, c.b, t.r, t.g, t.b]), 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([hot ? HEAD.core.hot : HEAD.core.cool, hot ? HEAD.halo.hot : HEAD.halo.cool]), 1))
  g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array([1, 1]), 1))
  const m = makeGlowMaterial()
  const pts = new THREE.Points(g, m)
  pts.frustumCulled = false
  pts.renderOrder = 50
  return pts
}

/** Move the head to pos with alpha k; LOW gets a bigger core (no bloom there). */
function placeHead(headObj: THREE.Points, pos: THREE.Vector3, k: number, hot: boolean, low: boolean): void {
  const pa = headObj.geometry.attributes.position as THREE.BufferAttribute
  pa.setXYZ(0, pos.x, pos.y, pos.z)
  pa.setXYZ(1, pos.x, pos.y, pos.z)
  pa.needsUpdate = true
  const aa = headObj.geometry.attributes.aAlpha as THREE.BufferAttribute
  aa.setX(0, k)
  aa.setX(1, k * 0.9)
  aa.needsUpdate = true
  const sa = headObj.geometry.attributes.aSize as THREE.BufferAttribute
  sa.setX(0, (hot ? HEAD.core.hot : HEAD.core.cool) * (low && hot ? 1.8 : 1))
  sa.setX(1, (hot ? HEAD.halo.hot : HEAD.halo.cool) * (low && hot ? 1.3 : 1))
  sa.needsUpdate = true
  headObj.visible = true
}

/**
 * Head alpha along a stroke: fades in over the first 3% and out over the last
 * 3%. It follows the stroke's opacity x 2 (capped at 1), so a construction
 * line drawn at 55% still has a full-brightness pen tip: the pen is always
 * the brightest thing while it draws (L4).
 */
const headK = (p: number) => Math.max(0, Math.min(1, p / 0.03, (1 - p) / 0.03))

export interface PenProps {
  /** polyline, xyz */
  points: Float32Array | readonly V3[]
  color?: string
  /** per-POINT rgb (linear 0..1), optional */
  pointColors?: Float32Array
  width?: number
  progress?: (T: number) => number
  opacity?: (T: number) => number
  dashed?: boolean
  dashSize?: number
  gapSize?: number
  head?: boolean
  hot?: boolean
  renderOrder?: number
  /** mutate the polyline in place for this T; return true when it changed */
  update?: (T: number, pts: Float32Array) => boolean
  /** extra multiplier for the line colour (speaking element) */
  gain?: (T: number) => number
  /**
   * Dim toward the slate at full alpha: 1 = full colour, 0.45 = a ghost.
   * Use this, never `opacity`, for a line that RESTS dimmed (a ghost, a
   * de-emphasised curve): translucent strokes show their segment caps as
   * beads. Keep `opacity` for fades in and out.
   */
  dim?: (T: number) => number
}

/** A single pen stroke along a polyline. */
export function Pen({
  points,
  color = '#eef3f6',
  pointColors,
  width = PEN.data,
  progress,
  opacity,
  dashed = false,
  dashSize,
  gapSize,
  head = false,
  hot = false,
  renderOrder = 30,
  update,
  gain,
  dim,
}: PenProps) {
  const tierLow = useStoryStore((s) => s.tier === 'low')
  const pts = useMemo(() => toFloat(points).slice(), [points])
  const core = useMemo(() => {
    const segBuf = polylineToSegments(pts)
    let colors: Float32Array | null = null
    if (pointColors) {
      colors = new Float32Array(segBuf.length)
      const n = pts.length / 3
      for (let i = 0; i < n - 1; i++) {
        colors.set(pointColors.subarray(i * 3, i * 3 + 6), i * 6)
      }
    }
    const mat = makePenMaterial({ color: pointColors ? '#ffffff' : color, width, dashed, dashSize, gapSize, vertexColors: !!pointColors })
    const c = new PenCore(segBuf, colors, mat, dashed)
    c.line.renderOrder = renderOrder
    return c
  }, [pts, pointColors, color, width, dashed, dashSize, gapSize, renderOrder])
  const headObj = useMemo(() => (head ? makeHead(hot, color) : null), [head, hot, color])

  useEffect(
    () => () => {
      core.dispose()
      ;(core.line.material as THREE.Material).dispose()
    },
    [core],
  )
  useEffect(
    () => () => {
      if (headObj) {
        headObj.geometry.dispose()
        ;(headObj.material as THREE.Material).dispose()
      }
    },
    [headObj],
  )

  useFrame(() => {
    try {
      const T = clock.T
      if (update && update(T, pts)) {
        writePolyline(pts, core.src)
        core.refresh()
      }
      const op = opacity ? opacity(T) : 1
      const p = progress ? progress(T) : 1
      const mat = core.line.material as THREE.ShaderMaterial & { opacity: number }
      const visible = op > 0.002 && p > 0.0005
      core.line.visible = visible
      if (headObj) headObj.visible = false
      if (!visible) return
      mat.opacity = op
      const headArc = core.draw(p)
      const u = mat.uniforms
      u.uHead.value = headArc
      const live = p < 1 ? 1 : 0
      u.uGlowAmt.value = (hot ? 0.9 : 0.55) * live
      u.uGain.value = gain ? gain(T) : 1
      u.uDim.value = dim ? Math.max(0, Math.min(1, dim(T))) : 1
      if (headObj && p < 1) placeHead(headObj, core.headPos, headK(p) * Math.min(1, op * 2), hot, tierLow)
    } catch (err) {
      core.line.visible = false
      if (headObj) headObj.visible = false
      reportOnce('<Pen> callback', err)
    }
  })

  return (
    <>
      <primitive object={core.line} />
      {headObj && <primitive object={headObj} />}
    </>
  )
}

export interface PenBatchProps {
  /** 6 floats per segment */
  segments: Float32Array
  /** 6 floats per segment (rgb start, rgb end), optional */
  colors?: Float32Array
  color?: string
  width?: number
  progress?: (T: number) => number
  opacity?: (T: number) => number
  dashed?: boolean
  dashSize?: number
  gapSize?: number
  renderOrder?: number
  /** draw-on by segment index (default) or by arc length */
  byArc?: boolean
  update?: (T: number, segs: Float32Array) => boolean
  /**
   * A luminous head at the drawing tip, plus the tail glow behind it. Use it
   * with `byArc` on a CONTINUOUS path (for example axes drawn as one L
   * stroke), so the head travels instead of jumping between segments.
   */
  head?: boolean
  hot?: boolean
  gain?: (T: number) => number
  /** dim toward the slate at full alpha (see Pen `dim`) */
  dim?: (T: number) => number
}

/** Many segments in one draw call (grids, axes, ticks, bars, merged outlines). */
export function PenBatch({
  segments,
  colors,
  color = '#eef3f6',
  width = PEN.axis,
  progress,
  opacity,
  dashed = false,
  dashSize,
  gapSize,
  renderOrder = 30,
  byArc = false,
  update,
  head = false,
  hot = false,
  gain,
  dim,
}: PenBatchProps) {
  const tierLow = useStoryStore((s) => s.tier === 'low')
  const core = useMemo(() => {
    const mat = makePenMaterial({ color: colors ? '#ffffff' : color, width, dashed, dashSize, gapSize, vertexColors: !!colors })
    const c = new PenCore(segments.slice(), colors ?? null, mat, dashed)
    c.line.renderOrder = renderOrder
    return c
  }, [segments, colors, color, width, dashed, dashSize, gapSize, renderOrder])
  const headObj = useMemo(() => (head ? makeHead(hot, color) : null), [head, hot, color])
  useEffect(
    () => () => {
      core.dispose()
      ;(core.line.material as THREE.Material).dispose()
    },
    [core],
  )
  useEffect(
    () => () => {
      if (headObj) {
        headObj.geometry.dispose()
        ;(headObj.material as THREE.Material).dispose()
      }
    },
    [headObj],
  )
  useFrame(() => {
    try {
      const T = clock.T
      if (update && update(T, core.src)) core.refresh()
      const op = opacity ? opacity(T) : 1
      const p = progress ? progress(T) : 1
      const visible = op > 0.002 && p > 0.0005
      core.line.visible = visible
      if (headObj) headObj.visible = false
      if (!visible) return
      const mat = core.line.material as THREE.ShaderMaterial & { opacity: number }
      mat.opacity = op
      const headArc = core.draw(p, !byArc)
      if (head) {
        mat.uniforms.uHead.value = headArc
        mat.uniforms.uGlowAmt.value = (hot ? 0.9 : 0.55) * (p < 1 ? 1 : 0)
      }
      if (gain) mat.uniforms.uGain.value = gain(T)
      if (dim) mat.uniforms.uDim.value = Math.max(0, Math.min(1, dim(T)))
      if (headObj && p < 1) placeHead(headObj, core.headPos, headK(p) * Math.min(1, op * 2), hot, tierLow)
    } catch (err) {
      core.line.visible = false
      if (headObj) headObj.visible = false
      reportOnce('<PenBatch> callback', err)
    }
  })
  return (
    <>
      <primitive object={core.line} />
      {headObj && <primitive object={headObj} />}
    </>
  )
}
