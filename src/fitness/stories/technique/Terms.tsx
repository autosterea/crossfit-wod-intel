import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useLabels } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'
import { headSegs, seg } from './geom'
import { terms, unitsPerPx, type Rect } from './layout'
import {
  B,
  bearingTick,
  connDraw,
  formLime,
  formName,
  formRed,
  glyphDraw,
  live,
  mechDraw,
  mechName,
  out2,
  squiggle,
  styleDraw,
  styleName,
  techDraw,
  techName,
  titleOn,
} from './timeline'

/* =========================================================================
   T2 "Quantity needs quality" (STORYBOARD-technique T2, pp. 40-41): the four
   terms and how they relate. MECHANICS (the physics: a joint angle and a
   force) sits inside TECHNIQUE (the method includes the mechanics); FORM is
   the judgment laid on top of both, a bar half lime (good) and half red
   (bad); STYLE stands apart in a dashed box, three lifters' bar paths, its
   own signature with no bearing on the rest. The title is the efficacy
   arrow's underline: measuring work capacity makes how you move matter.
   ========================================================================= */

const CHALK = PAL.chalk

/** A closed rounded rectangle, from the middle of the top edge, clockwise. */
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number, n = 6): Float32Array {
  const pts: number[] = []
  const cx = (x0 + x1) / 2
  pts.push(cx, y1, 0)
  const corner = (ccx: number, ccy: number, a0: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 - (i / n) * (Math.PI / 2)
      pts.push(ccx + Math.cos(a) * r, ccy + Math.sin(a) * r, 0)
    }
  }
  corner(x1 - r, y1 - r, Math.PI / 2)
  corner(x1 - r, y0 + r, 0)
  corner(x0 + r, y0 + r, -Math.PI / 2)
  corner(x0 + r, y1 - r, Math.PI)
  pts.push(cx, y1, 0)
  return new Float32Array(pts)
}

export function Terms({ f }: { f: ChartFrame }) {
  const x = f.x
  const y = f.y
  const g = terms(f)
  const upx = unitsPerPx(f)
  const on = (T: number) => live(T, B.quality, B.graph + 0.04)
  const vis = (T: number) => on(T) * out2(T)
  const R = 12 * upx
  const box = (r: Rect, rad = R) => roundRect(x(r.u0), y(r.v0), x(r.u1), y(r.v1), rad)

  const tech = useMemo(() => box(g.technique), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const mech = useMemo(() => box(g.mechanics, R * 0.8), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const style = useMemo(() => box(g.style, R * 0.8), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const conn = useMemo(() => new Float32Array([x(g.connector[0]), y(g.connector[1]), 0, x(g.connector[2]), y(g.connector[3]), 0]), [f]) // eslint-disable-line react-hooks/exhaustive-deps

  /* the physics: a joint (two limbs and the angle between them) and a force on it */
  const glyph = useMemo(() => {
    const m = g.mechanics
    const w = x(m.u1) - x(m.u0)
    const h = y(m.v1) - y(m.v0)
    // below the box's callout (about 30 px), in its right half
    const room = Math.max(h * 0.4, h - 32 * upx)
    const s = Math.min(w * 0.36, room * 0.85)
    const jx = x(m.u1) - w * 0.22
    const jy = y(m.v0) + room * 0.42
    const a1 = (150 * Math.PI) / 180
    const a2 = (215 * Math.PI) / 180
    const L = s * 0.55
    const segs = new Float32Array(8 * 6)
    seg(segs, 0, jx, jy, jx + Math.cos(a1) * L, jy + Math.sin(a1) * L, 0.02)
    seg(segs, 1, jx, jy, jx + Math.cos(a2) * L, jy + Math.sin(a2) * L, 0.02)
    // the angle: an arc between the limbs
    const ar = L * 0.38
    for (let i = 0; i < 4; i++) {
      const b0 = a1 + ((a2 - a1) * i) / 4
      const b1 = a1 + ((a2 - a1) * (i + 1)) / 4
      seg(segs, 2 + i, jx + Math.cos(b0) * ar, jy + Math.sin(b0) * ar, jx + Math.cos(b1) * ar, jy + Math.sin(b1) * ar, 0.02)
    }
    // the force: an arrow pressing down on the joint
    const fy0 = jy + s * 0.5
    const fy1 = jy + s * 0.08
    seg(segs, 6, jx, fy0, jx, fy1, 0.02)
    const hs = new Float32Array(12)
    headSegs(hs, 0, jx, fy0, jx, fy1, 8 * upx)
    const all = new Float32Array(9 * 6)
    all.set(segs.subarray(0, 7 * 6))
    all.set(hs, 7 * 6)
    return all
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps

  /* three lifters' bar paths: short vertical S-curves, each its own */
  const squiggles = useMemo(() => {
    const s = g.style
    const out: Float32Array[] = []
    const w = x(s.u1) - x(s.u0)
    const h = y(s.v1) - y(s.v0)
    const amp = [0.07, 0.11, 0.05]
    const phase = [0, 0.9, 2.1]
    for (let k = 0; k < 3; k++) {
      const cx = x(s.u0) + w * (0.25 + 0.25 * k)
      const p = new Float32Array(25 * 3)
      for (let i = 0; i < 25; i++) {
        const t = i / 24
        const yy = y(s.v0) + h * (0.18 + 0.64 * t)
        const xx = cx + w * amp[k] * Math.sin(phase[k] + t * Math.PI * 1.6) * Math.sin(Math.PI * t)
        p[i * 3] = xx
        p[i * 3 + 1] = yy
        p[i * 3 + 2] = 0.02
      }
      out.push(p)
    }
    return out
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps

  /* the FORM bar: two halves that slide down onto TECHNIQUE's top edge */
  const tq = g.technique
  const mid = (tq.u0 + tq.u1) / 2
  const barTop = (u0: number, u1: number) => new Float32Array([x(u0), y(tq.v1 + g.formH), x(u1), y(tq.v1 + g.formH)])
  const limeTop = useMemo(() => barTop(tq.u0, mid), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const redTop = useMemo(() => barTop(mid, tq.u1), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const limeG = useRef<THREE.Group>(null)
  const redG = useRef<THREE.Group>(null)
  const drop = 0.07 * f.FH
  useSafeFrame(
    'technique T2 form bar',
    (T) => {
      limeG.current!.position.y = drop * (1 - formLime(T))
      redG.current!.position.y = drop * (1 - formRed(T))
    },
    { hide: limeG },
  )

  /* ------------------------------ labels ----------------------------- */
  const labels = useMemo<LabelSpec[]>(() => {
    const m = g.mechanics
    const s = g.style
    const c = g.connector
    return [
      {
        id: 'tq-howyoumove',
        text: 'HOW YOU MOVE',
        tone: 'name',
        color: CHALK,
        dot: false,
        anchor: [x((g.underline[0] + g.underline[1]) / 2), y(g.titleV - 0.025), 0],
        prefer: 'N',
        only: ['N'],
        gapPx: 5,
        priority: 94,
        cue: (T) => titleOn(T) * vis(T),
      },
      {
        id: 'tq-mech',
        text: 'MECHANICS: PHYSICS',
        tone: 'callout',
        color: CHALK,
        required: true,
        anchor: [x(m.u0) + 8 * upx, y(m.v1) - 6 * upx, 0.05],
        prefer: 'SE',
        only: ['SE', 'E', 'NE'],
        gapPx: 2,
        cue: (T) => mechName(T) * vis(T),
      },
      {
        id: 'tq-tech',
        text: 'TECHNIQUE: METHOD',
        tone: 'callout',
        color: CHALK,
        required: true,
        anchor: [x(tq.u0) + 8 * upx, y(tq.v1) - 6 * upx, 0.05],
        prefer: 'SE',
        only: ['SE', 'E', 'NE'],
        gapPx: 2,
        cue: (T) => techName(T) * vis(T),
      },
      {
        id: 'tq-form',
        text: 'FORM: GOOD OR BAD',
        tone: 'callout',
        color: CHALK,
        required: true,
        anchor: [x(g.formAt[0]), y(g.formAt[1]), 0.05],
        prefer: g.formSides[0],
        only: g.formSides,
        gapPx: 6,
        cue: (T) => formName(T) * vis(T),
      },
      {
        id: 'tq-style',
        text: 'STYLE: SIGNATURE',
        tone: 'callout',
        color: CHALK,
        required: true,
        anchor: [x((s.u0 + s.u1) / 2), y(g.styleSides[0] === 'S' ? s.v0 : s.v1), 0.05],
        prefer: g.styleSides[0],
        only: g.styleSides,
        gapPx: 6,
        cue: (T) => styleName(T) * vis(T),
      },
      {
        id: 'tq-bearing',
        text: 'NO BEARING',
        tone: 'tick',
        anchor: [x((c[0] + c[2]) / 2), y((c[1] + c[3]) / 2), 0],
        prefer: c[0] === c[2] ? 'E' : 'S',
        only: c[0] === c[2] ? ['E', 'W'] : ['S', 'N'],
        gapPx: 6,
        priority: 70,
        cue: (T) => bearingTick(T) * vis(T),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])
  useLabels(labels)

  return (
    <>
      <Pen points={mech} color={CHALK} width={PEN.axis} head progress={mechDraw} dim={() => 0.75} opacity={vis} renderOrder={31} />
      <PenBatch segments={glyph} color={CHALK} width={PEN.axis} progress={glyphDraw} dim={() => 0.8} opacity={vis} renderOrder={31} />
      <Pen points={tech} color={CHALK} width={PEN.axis} head progress={techDraw} dim={() => 0.85} opacity={vis} renderOrder={31} />
      <group ref={limeG}>
        <AreaFill top={limeTop} baseline={y(tq.v1)} color={PAL.yellowGreen} mode="solid" hi={0.8} opacity={(T) => vis(T) * formLime(T)} renderOrder={12} />
      </group>
      <group ref={redG}>
        <AreaFill top={redTop} baseline={y(tq.v1)} color={PAL.sick} mode="solid" hi={0.8} opacity={(T) => vis(T) * formRed(T)} renderOrder={12} />
      </group>
      <Pen points={style} color={CHALK} width={PEN.axis} dashed dashSize={0.16} gapSize={0.12} progress={styleDraw} dim={() => 0.7} opacity={vis} renderOrder={31} />
      {squiggles.map((p, i) => (
        <Pen key={i} points={p} color={CHALK} width={PEN.axis} progress={(T) => squiggle(T, i)} dim={() => 0.6} opacity={vis} renderOrder={32} />
      ))}
      <Pen points={conn} color={CHALK} width={PEN.axis} dashed dashSize={0.14} gapSize={0.11} progress={connDraw} dim={() => 0.55} opacity={vis} renderOrder={31} />
    </>
  )
}
