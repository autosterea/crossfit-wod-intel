import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { lin, makeFillMaterial } from '../../story/kit/materials'
import { frameId, type ChartFrame } from '../../story/kit/chartFrame'
import { useSafeFrame } from '../../story/useSafeFrame'
import { LANE_BASE, RANGE_U, STRIP_EXTENT, stripWeight } from './pathwaysMath'
import { TICKS, type UnderAxis } from './layout'
import { AXIS_COLOR, lineSegs, type Fn } from './geom'

/* =========================================================================
   Pathways chart construction (DESIGN.md D.4), shared by the story and the
   explore layers: the axes (one continuous L stroke, the way a coach draws
   them), the time tick marks, the handover strip directly under the axis
   and the P6 brackets. Pure geometry plus functions of T.

   Review r2: strips cut where the lead flips (12.5 s, 55 s) contradicted
   the textbook strings keyed under them ("10 sec to 2 min" over a strip
   that ended before 1 min). Now the strip is ONE band whose colour holds
   each engine over its own stretch and CROSS-FADES across the two
   handover zones (pathwaysMath HANDOVER: 10 s to 15 s, and ~55 s to
   2 min), so the strings, the strip, the callouts and the caption agree.
   ========================================================================= */

const STRIP_N = 121
const STRIP_COLS = AXIS_COLOR.map((c) => lin(c))
/** Linear colour of the strip at u, engine k's colour weighted by its reveal mask. */
function stripColor(u: number, m0: number, m1: number, m2: number, out: THREE.Color): THREE.Color {
  const w0 = stripWeight(0, u) * m0
  const w1 = stripWeight(1, u) * m1
  const w2 = stripWeight(2, u) * m2
  out.r = STRIP_COLS[0].r * w0 + STRIP_COLS[1].r * w1 + STRIP_COLS[2].r * w2
  out.g = STRIP_COLS[0].g * w0 + STRIP_COLS[1].g * w1 + STRIP_COLS[2].g * w2
  out.b = STRIP_COLS[0].b * w0 + STRIP_COLS[1].b * w1 + STRIP_COLS[2].b * w2
  return out
}
/** Reveal mask of engine k at u: its colour sweeps left to right across its extent as r goes 0 to 1. */
function revealMask(k: number, u: number, r: number): number {
  if (r >= 1) return 1
  if (r <= 0) return 0
  const ext = STRIP_EXTENT[k]
  const e = ext[0] + (ext[1] - ext[0]) * r
  return Math.max(0, Math.min(1, (e - u) / 0.01))
}

/**
 * Construction rests DIMMED at full alpha (`dim`, H.41): a translucent
 * LineSegments2 shows its overlapping segment caps as beads along the axis.
 */
export interface ConstructionVis {
  axes: { progress: Fn; dim: Fn; head?: boolean }
  ticks: { progress: Fn; dim: Fn }
}

export function Construction({ frame, vis, uOfS, ua }: { frame: ChartFrame; vis: ConstructionVis; uOfS: (s: number) => number; ua: UnderAxis }) {
  const axes = useMemo(() => {
    const s: number[] = []
    // ONE continuous L stroke: down the power axis to the origin, then along
    // the time axis, left to right (L11), so the pen head travels without a jump
    lineSegs(s, [frame.x(0), frame.y(frame.vMax), 0], [frame.x(0), frame.y(0), 0], 22)
    lineSegs(s, [frame.x(0), frame.y(0), 0], [frame.x(1), frame.y(0), 0], 30)
    return new Float32Array(s)
  }, [frame])
  const ticks = useMemo(() => {
    const s: number[] = []
    for (const t of TICKS) {
      const x = frame.x(uOfS(t.s))
      s.push(x, frame.y(0), 0, x, frame.y(0) - ua.tick, 0)
    }
    return new Float32Array(s)
  }, [frame, uOfS, ua.tick])
  return (
    <>
      <PenBatch segments={axes} color={PAL.chalk} width={PEN.axis} progress={vis.axes.progress} dim={vis.axes.dim} byArc head={vis.axes.head} hot={vis.axes.head} renderOrder={30} />
      <PenBatch segments={ticks} color={PAL.chalk} width={PEN.axis} progress={vis.ticks.progress} dim={vis.ticks.dim} renderOrder={30} />
    </>
  )
}

/**
 * The handover strip directly under the time axis (one draw call): each
 * engine's colour over its own stretch, cross-fading across the handover
 * zones. Engine k's colour sweeps in left to right with reveal(T, k) (its
 * beat) and the strip rests faint (additive light on the slate).
 */
export function HandoverStrip({ frame, reveal, opacity, ua }: { frame: ChartFrame; reveal: (T: number, k: number) => number; opacity: Fn; ua: UnderAxis }) {
  const geometry = useMemo(() => {
    const nv = STRIP_N * 2
    const g = new THREE.BufferGeometry()
    const pos = new THREE.BufferAttribute(new Float32Array(nv * 3), 3)
    pos.setUsage(THREE.DynamicDrawUsage)
    const col = new THREE.BufferAttribute(new Float32Array(nv * 3), 3)
    col.setUsage(THREE.DynamicDrawUsage)
    const aT = new Float32Array(nv)
    const aU = new Float32Array(nv)
    const idx: number[] = []
    for (let i = 0; i < STRIP_N; i++) {
      aT[i * 2 + 1] = 1
      aU[i * 2] = aU[i * 2 + 1] = i / (STRIP_N - 1)
      if (i < STRIP_N - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
    }
    g.setAttribute('position', pos)
    g.setAttribute('aColor', col)
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
    g.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
    g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(nv), 1))
    g.setIndex(idx)
    return g
  }, [])
  const material = useMemo(() => {
    const m = makeFillMaterial('#ffffff', 'solid', { vertexColors: true, additive: true })
    m.uniforms.uHi.value = 1
    return m
  }, [])
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geometry, material)
    m.frustumCulled = false
    m.renderOrder = 12
    return m
  }, [geometry, material])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  const last = useRef({ fid: -1, h: -1, r0: -1, r1: -1, r2: -1 })
  const c = useMemo(() => new THREE.Color(), [])
  const hide = useMemo(() => ({ current: mesh }), [mesh])
  useSafeFrame(
    'pathways strip',
    (T) => {
      const op = opacity(T)
      mesh.visible = op > 0.002
      if (!mesh.visible) return
      material.uniforms.uOpacity.value = op
      const r0 = reveal(T, 0)
      const r1 = reveal(T, 1)
      const r2 = reveal(T, 2)
      const fid = frameId(frame)
      const L = last.current
      if (L.fid === fid && L.h === ua.strip && L.r0 === r0 && L.r1 === r1 && L.r2 === r2) return
      L.fid = fid
      L.h = ua.strip
      L.r0 = r0
      L.r1 = r1
      L.r2 = r2
      const pa = geometry.attributes.position as THREE.BufferAttribute
      const ca = geometry.attributes.aColor as THREE.BufferAttribute
      const p = pa.array as Float32Array
      const q = ca.array as Float32Array
      const y1 = frame.y(0) - 0.02
      const y0 = frame.y(0) - ua.strip
      for (let i = 0; i < STRIP_N; i++) {
        const u = i / (STRIP_N - 1)
        const x = frame.x(u)
        const v = i * 6
        p[v] = p[v + 3] = x
        p[v + 1] = y0
        p[v + 4] = y1
        p[v + 2] = p[v + 5] = -0.01
        stripColor(u, revealMask(0, u, r0), revealMask(1, u, r1), revealMask(2, u, r2), c)
        q[v] = q[v + 3] = c.r
        q[v + 1] = q[v + 4] = c.g
        q[v + 2] = q[v + 5] = c.b
      }
      pa.needsUpdate = true
      ca.needsUpdate = true
    },
    { hide },
  )
  return <primitive object={mesh} />
}

/**
 * P6: the three duration brackets under the axis (D.4), on the textbook
 * ranges of the duration strings (3 s to 10 s, 10 s to 2 min, 2 min to 1
 * hr): up from the axis, along the strip's lower edge, back up. Each pen
 * takes the strip's colour point by point, so the bracket that spans the
 * handovers cross-fades into its neighbours exactly as the strip above it
 * does. `draw(T, k)` draws it with a hot head; `gain(T, k)` pulses it.
 */
export function Brackets({ frame, draw, gain, opacity, ua }: { frame: ChartFrame; draw: (T: number, k: number) => number; gain: (T: number, k: number) => number; opacity: Fn; ua: UnderAxis }) {
  const paths = useMemo(() => {
    const c = new THREE.Color()
    return [0, 1, 2].map((k) => {
      const xa = frame.x(RANGE_U[k]) + (k > 0 ? 0.05 : 0.02)
      const xb = frame.x(RANGE_U[k + 1]) - (k < 2 ? 0.05 : 0.02)
      const yTop = frame.y(0) - 0.06
      const yLow = frame.y(0) - ua.strip
      const pts: number[] = []
      const cols: number[] = []
      const push = (x: number, y: number) => {
        pts.push(x, y, 0.04)
        stripColor((x - frame.x0) / frame.FW, 1, 1, 1, c)
        cols.push(c.r, c.g, c.b)
      }
      push(xa, yTop)
      push(xa, yLow)
      const n = 36
      for (let i = 1; i <= n; i++) push(xa + ((xb - xa) * i) / n, yLow)
      push(xb, yTop)
      return { pts: new Float32Array(pts), cols: new Float32Array(cols) }
    })
  }, [frame, ua.strip])
  return (
    <>
      {paths.map((p, k) => (
        <Pen
          key={k}
          points={p.pts}
          pointColors={p.cols}
          color={AXIS_COLOR[k]}
          width={PEN.data}
          head
          hot
          progress={(T) => draw(T, k)}
          opacity={opacity}
          gain={(T) => gain(T, k)}
          renderOrder={46}
        />
      ))}
    </>
  )
}

/** Height of each lane's own power stub, v units: the lane scale (D.4: lane height = power x 0.30 FH). */
const LANE_STUB = 0.3

/**
 * Lanes (P4, explore): each lane gets its own zero, an L of a baseline and
 * a short power stub at the left, so each lane plainly starts at zero while
 * the full-height axis dims behind them (review r2: one shared axis over
 * three baselines let the phosphagen lane's zero read as "high power").
 * Two draw calls; each rests dimmed at full alpha (no beads).
 */
export function LaneAxes({ frame, opacity }: { frame: ChartFrame; opacity: Fn }) {
  const base = useMemo(() => {
    const s: number[] = []
    for (let b = 0; b < 3; b++) s.push(frame.x(0), frame.y(LANE_BASE[b]), -0.01, frame.x(1), frame.y(LANE_BASE[b]), -0.01)
    return new Float32Array(s)
  }, [frame])
  const stubs = useMemo(() => {
    const s: number[] = []
    for (let b = 0; b < 3; b++) s.push(frame.x(0), frame.y(LANE_BASE[b] + LANE_STUB), 0.01, frame.x(0), frame.y(LANE_BASE[b]), 0.01)
    return new Float32Array(s)
  }, [frame])
  return (
    <>
      <PenBatch segments={base} color={PAL.chalk} width={PEN.grid} opacity={opacity} dim={() => 0.45} renderOrder={29} />
      <PenBatch segments={stubs} color={PAL.chalk} width={PEN.axis} opacity={opacity} dim={() => 0.78} renderOrder={31} />
    </>
  )
}

/** The Marathon edge chip's chevron: the time axis continues past its right end (F.7). */
export function MarathonChevron({ frame, progress, dim }: { frame: ChartFrame; progress: Fn; dim: Fn }) {
  const pts = useMemo(() => {
    const x1 = frame.x(1)
    const y = frame.y(0)
    const a = 0.16
    const s: number[] = []
    lineSegs(s, [x1 + 0.08, y, 0], [x1 + 0.32, y, 0], 3)
    lineSegs(s, [x1 + 0.32 - a, y + a, 0], [x1 + 0.32, y, 0], 2)
    lineSegs(s, [x1 + 0.32, y, 0], [x1 + 0.32 - a, y - a, 0], 2)
    return new Float32Array(s)
  }, [frame])
  return <PenBatch segments={pts} color={PAL.oxidative} width={PEN.axis} progress={progress} dim={dim} byArc renderOrder={31} />
}
