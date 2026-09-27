import { useMemo, useRef } from 'react'
import { PAL } from '../../fitnessData'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaStrips } from '../../story/kit/Fill'
import { frameId, type ChartFrame } from '../../story/kit/chartFrame'
import { BRACKET_U } from './pathwaysMath'
import { TICKS, type UnderAxis } from './layout'
import { AXIS_COLOR, lineSegs, type Fn } from './geom'

/* =========================================================================
   Pathways chart construction (DESIGN.md D.4), shared by the story and the
   explore layers: the axes (one continuous L stroke, the way a coach draws
   them), the time tick marks, the three duration strips directly under the
   axis (the energy bands chapter 04 calls back to, H.11) and the P6
   brackets. Pure geometry plus functions of T.
   ========================================================================= */

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
 * The three duration strips directly under the time axis (the Definition
 * energy bands, H.11): strip k (axis order) sweeps in left to right with
 * reveal(T, k) and rests faint; `bright(T)` lifts them (P6 brackets). One draw call.
 */
export function DurationStrips({ frame, reveal, opacity, ua }: { frame: ChartFrame; reveal: (T: number, k: number) => number; opacity: Fn; ua: UnderAxis }) {
  const NP = 2
  const last = useRef({ fid: -1, r0: -1, r1: -1, r2: -1, h: -1 })
  const write = (T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const r0 = reveal(T, 0)
    const r1 = reveal(T, 1)
    const r2 = reveal(T, 2)
    const fid = frameId(frame)
    const L = last.current
    if (L.fid === fid && L.r0 === r0 && L.r1 === r1 && L.r2 === r2 && L.h === ua.strip) return false
    L.h = ua.strip
    L.fid = fid
    L.r0 = r0
    L.r1 = r1
    L.r2 = r2
    const y1 = frame.y(0) - 0.02
    const y0 = frame.y(0) - ua.strip
    for (let k = 0; k < 3; k++) {
      const r = k === 0 ? r0 : k === 1 ? r1 : r2
      const xa = frame.x(BRACKET_U[k]) + (k > 0 ? 0.03 : 0)
      const xb = frame.x(BRACKET_U[k + 1]) - (k < 2 ? 0.03 : 0)
      const xe = xa + (xb - xa) * r
      for (let i = 0; i < NP; i++) {
        const o = k * NP + i
        top[o * 3] = i === 0 ? xa : xe
        top[o * 3 + 1] = r > 0.001 ? y1 : y0
        top[o * 3 + 2] = -0.01
        bottom[o] = y0
      }
    }
    return true
  }
  return (
    <AreaStrips
      strips={3}
      points={NP}
      colors={AXIS_COLOR}
      write={write}
      opacity={opacity}
      lo={1}
      hi={1}
      renderOrder={12}
    />
  )
}

/**
 * P6: three duration brackets under the axis (D.4), one pen each in its
 * engine colour: up from the axis, along the strip's lower edge, back up.
 * `draw(T, k)` draws it with a hot head; `gain(T, k)` pulses it.
 */
export function Brackets({ frame, draw, gain, opacity, ua }: { frame: ChartFrame; draw: (T: number, k: number) => number; gain: (T: number, k: number) => number; opacity: Fn; ua: UnderAxis }) {
  const paths = useMemo(
    () =>
      [0, 1, 2].map((k) => {
        const xa = frame.x(BRACKET_U[k]) + (k > 0 ? 0.05 : 0.02)
        const xb = frame.x(BRACKET_U[k + 1]) - (k < 2 ? 0.05 : 0.02)
        const yTop = frame.y(0) - 0.06
        const yLow = frame.y(0) - ua.strip
        const pts: number[] = []
        const push = (x: number, y: number) => pts.push(x, y, 0.04)
        push(xa, yTop)
        push(xa, yLow)
        const n = 24
        for (let i = 1; i <= n; i++) push(xa + ((xb - xa) * i) / n, yLow)
        push(xb, yTop)
        return new Float32Array(pts)
      }),
    [frame, ua.strip],
  )
  return (
    <>
      {paths.map((p, k) => (
        <Pen
          key={k}
          points={p}
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
