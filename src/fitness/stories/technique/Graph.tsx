import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { frameId } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { impactK } from '../../story/kit/impact'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { useQAProbe } from '../../story/qa'
import type { LabelSpec } from '../../story/types'
import { headSegs, mix, parkSegs, seg } from './geom'
import { ARC_R, PLOT, TIP_A, TIP_B, exploreInset, insetRect, isStacked, unitsPerPx } from './layout'
import {
  B,
  aDims,
  aDraw,
  aName,
  arcDraw,
  arcHeads,
  bDims,
  bDraw,
  bHero,
  bName,
  claimTechnique,
  flip,
  graphOn,
  idealBright,
  inefficientBright,
  insetDim,
  xAxisDraw,
  xTitle,
  yAxisDraw,
  yTitle,
} from './timeline'

/* =========================================================================
   Figure 1, "Technique Maximizes the Work Accomplished for the Energy
   Expended" (Technique, L1 Guide p. 42), redrawn exactly: work accomplished
   along the bottom, energy expended up the side, two arrows of equal length
   from the origin (the figure has no scale, so they are drawn in
   plot-normalized coordinates): A, inefficient, steep (a lot of energy, very
   little work); B, ideal, shallow (little energy, the most work); and the
   double-headed technique arc between them. T3 draws it; T4 FLIPs it into
   an inset (its arrows at 50%, the one the lifter is showing brightening);
   T9 redraws it and sweeps the arc again. ExploreGraph is the explore
   inset: one arrow that swings with the form state.
   ========================================================================= */

const CHALK = PAL.chalk
const LIME = PAL.yellowGreen
const N_ARC = 40

/** Plot-normalized (nx, ny) -> chart (u, v). */
const pu = (nx: number) => PLOT.u0 + (PLOT.u1 - PLOT.u0) * nx
const pv = (ny: number) => PLOT.v0 + (PLOT.v1 - PLOT.v0) * ny
const ANG_A = Math.atan2(TIP_A[1], TIP_A[0])
const ANG_B = Math.atan2(TIP_B[1], TIP_B[0])

/** The arc from A's side to B's side at the normalized radius (an ellipse arc when the frame is not square). */
function arcPoints(f: ChartFrame, a0 = ANG_A, a1 = ANG_B, r = ARC_R, n = N_ARC, z = 0.02): Float32Array {
  const p = new Float32Array((n + 1) * 3)
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    p[i * 3] = f.x(pu(Math.cos(a) * r))
    p[i * 3 + 1] = f.y(pv(Math.sin(a) * r))
    p[i * 3 + 2] = z
  }
  return p
}

/** A group transform that maps the whole frame into rect r (the FLIP), at k. */
function flipInto(g: THREE.Group, f: ChartFrame, r: { u0: number; v0: number; u1: number; v1: number }, k: number): void {
  const sx = mix(1, r.u1 - r.u0, k)
  const sy = mix(1, r.v1 - r.v0, k)
  const cx = mix(f.x0, f.x(r.u0), k)
  const cy = mix(f.y0, f.y(r.v0), k)
  g.scale.set(sx, sy, 1)
  g.position.set(cx - f.x0 * sx, cy - f.y0 * sy, 0)
}

export function Graph({ f }: { f: ChartFrame }) {
  const x = f.x
  const y = f.y
  const stacked = isStacked(f)
  const inset = insetRect(stacked)
  const upx = unitsPerPx(f)
  const HEAD = 11 * upx

  const O: [number, number] = [x(PLOT.u0), y(PLOT.v0)]
  const A: [number, number] = [x(pu(TIP_A[0])), y(pv(TIP_A[1]))]
  const Bt: [number, number] = [x(pu(TIP_B[0])), y(pv(TIP_B[1]))]

  const xAxis = useMemo(() => new Float32Array([O[0], O[1], 0, x(PLOT.u1), O[1], 0]), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const yAxis = useMemo(() => new Float32Array([O[0], O[1], 0, O[0], y(PLOT.v1), 0]), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const shaftA = useMemo(() => new Float32Array([O[0], O[1], 0.02, A[0], A[1], 0.02]), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const shaftB = useMemo(() => new Float32Array([O[0], O[1], 0.03, Bt[0], Bt[1], 0.03]), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const headA = useMemo(() => {
    const s = new Float32Array(12)
    headSegs(s, 0, O[0], O[1], A[0], A[1], HEAD, 28, 0.02)
    return s
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const headB = useMemo(() => {
    const s = new Float32Array(12)
    headSegs(s, 0, O[0], O[1], Bt[0], Bt[1], HEAD, 28, 0.03)
    return s
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const arc = useMemo(() => arcPoints(f), [f])
  const arcHeadSegs = useMemo(() => {
    const s = new Float32Array(4 * 6)
    const n = arc.length / 3
    // the arc's first head points back toward A, its last toward B
    headSegs(s, 0, arc[3], arc[4], arc[0], arc[1], HEAD * 0.9, 30, 0.02)
    headSegs(s, 2, arc[(n - 2) * 3], arc[(n - 2) * 3 + 1], arc[(n - 1) * 3], arc[(n - 1) * 3 + 1], HEAD * 0.9, 30, 0.02)
    return s
  }, [arc, HEAD])

  /* the dimension lines: from each tip to both axes (high on energy, short on work; and the reverse) */
  const dimsA = useMemo(() => new Float32Array(2 * 6), [])
  const dimsB = useMemo(() => new Float32Array(2 * 6), [])
  const lastDim = useRef(['', ''])
  const dimWriter = (which: 0 | 1) => (T: number, s: Float32Array): boolean => {
    const k = which === 0 ? aDims(T) : bDims(T)
    const key = frameId(f) + '|' + k.toFixed(4)
    if (key === lastDim.current[which]) return false
    lastDim.current[which] = key
    const tip = which === 0 ? A : Bt
    if (k <= 0.001) {
      parkSegs(s, 0, 2)
      return true
    }
    seg(s, 0, tip[0], tip[1], mix(tip[0], O[0], k), tip[1], 0.01)
    seg(s, 1, tip[0], tip[1], tip[0], mix(tip[1], O[1], k), 0.01)
    return true
  }

  /* ------------------------------ FLIP -------------------------------- */
  const group = useRef<THREE.Group>(null)
  useSafeFrame(
    'technique graph flip',
    (T) => {
      flipInto(group.current!, f, inset, flip(T))
    },
    { hide: group },
  )

  /* brightness: full in T3 and T9; 50% in the inset, the arrow the lifter shows lit */
  const dimArrow = (bright: (T: number) => number) => (T: number) => 1 - 0.5 * insetDim(T) + 0.5 * bright(T)
  const dimA = dimArrow(inefficientBright)
  const dimB = dimArrow(idealBright)
  const dimArc = (T: number) => 1 - 0.5 * insetDim(T)
  const nothing = () => 0
  const axisDim = (T: number) => 0.6 - 0.15 * insetDim(T)

  /* ------------------------------ labels ------------------------------ */
  const labels = useMemo<LabelSpec[]>(() => {
    const am: [number, number, number] = [x(pu(Math.cos((ANG_A + ANG_B) / 2) * ARC_R)), y(pv(Math.sin((ANG_A + ANG_B) / 2) * ARC_R)), 0.05]
    return [
      {
        id: 'tq-g-x',
        text: 'WORK ACCOMPLISHED',
        tone: 'tick',
        required: true,
        anchor: [x(PLOT.u1), O[1], 0],
        prefer: 'SW',
        only: ['SW', 'S'],
        gapPx: 6,
        priority: 86,
        cue: (T) => xTitle(T) * graphOn(T),
      },
      {
        id: 'tq-g-y',
        text: 'ENERGY EXPENDED',
        tone: 'tick',
        required: true,
        anchor: [O[0], y(PLOT.v1), 0],
        prefer: 'E',
        only: ['E', 'NE', 'SE'],
        gapPx: 8,
        priority: 86,
        cue: (T) => yTitle(T) * graphOn(T),
      },
      {
        id: 'tq-g-a',
        text: 'INEFFICIENT',
        tone: 'name',
        color: CHALK,
        dot: false,
        anchor: [A[0], A[1], 0],
        prefer: 'E',
        only: ['E', 'NE', 'SE', 'N'],
        gapPx: 8,
        priority: 75,
        cue: (T) => aName(T) * graphOn(T),
      },
      {
        id: 'tq-g-b',
        text: 'IDEAL',
        tone: 'name',
        color: LIME,
        anchor: [Bt[0], Bt[1], 0],
        prefer: 'NE',
        only: ['NE', 'N', 'E', 'NW'],
        gapPx: 8,
        priority: 75,
        cue: (T) => bName(T) * graphOn(T),
      },
      {
        id: 'tq-g-tech',
        text: 'TECHNIQUE',
        tone: 'callout',
        // the claim in lime (T3); T9's twin is chalk, where efficacy's lime is on screen (colour meaning)
        color: LIME,
        required: true,
        anchor: am,
        prefer: 'NE',
        only: ['NE', 'E', 'N', 'SW'],
        gapPx: 10,
        priority: 95,
        cue: (T) => (T < B.everything ? claimTechnique(T) * graphOn(T) : 0),
      },
      {
        // T9: on the arc itself (the claim plate holds the upper right)
        id: 'tq-g-tech9',
        text: 'TECHNIQUE',
        tone: 'callout',
        color: CHALK,
        required: true,
        anchor: am,
        prefer: 'C',
        gapPx: 10,
        priority: 95,
        cue: (T) => (T >= B.everything ? claimTechnique(T) : 0),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])
  useLabels(labels)

  // labels keep off the arrows and the arc (full size only)
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        if (graphOn(T) <= 0 || flip(T) > 0.02) return 0
        let n = 0
        const put = (px: number, py: number) => {
          out[n * 3] = px
          out[n * 3 + 1] = py
          out[n * 3 + 2] = 0
          n++
        }
        if (aDraw(T) > 0) for (let i = 1; i <= 10; i++) put(mix(O[0], A[0], i / 10), mix(O[1], A[1], i / 10))
        if (bDraw(T) > 0) for (let i = 1; i <= 10; i++) put(mix(O[0], Bt[0], i / 10), mix(O[1], Bt[1], i / 10))
        if (arcDraw(T) > 0 && T < B.everything) for (let i = 0; i <= N_ARC; i += 4) put(arc[i * 3], arc[i * 3 + 1])
        return n
      },
      maxPoints: 40,
      radiusPx: 5,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f, arc],
  )
  useWorldObstacle('tq-graph', obstacle)

  // QA: Figure 1's arrows have equal normalized lengths
  useQAProbe('tq-figure1', () => ({
    a: Math.hypot(TIP_A[0], TIP_A[1]),
    b: Math.hypot(TIP_B[0], TIP_B[1]),
    angA: (ANG_A * 180) / Math.PI,
    angB: (ANG_B * 180) / Math.PI,
  }))

  const on = graphOn
  return (
    <group ref={group}>
      {/* construction: the axes, each drawn by a hot pen */}
      <Pen points={xAxis} color={CHALK} width={PEN.axis} head hot progress={xAxisDraw} dim={axisDim} opacity={on} renderOrder={30} />
      <Pen points={yAxis} color={CHALK} width={PEN.axis} head hot progress={yAxisDraw} dim={axisDim} opacity={on} renderOrder={30} />
      {/* A: inefficient (dashed chalk) and its dimension lines */}
      <Pen points={shaftA} color={CHALK} width={PEN.data} dashed dashSize={0.22} gapSize={0.15} head hot progress={aDraw} dim={(T) => 0.85 * dimA(T)} opacity={on} renderOrder={33} />
      <PenBatch segments={headA} color={CHALK} width={PEN.data} dim={(T) => 0.85 * dimA(T)} opacity={(T) => on(T) * (aDraw(T) >= 1 ? 1 : 0)} renderOrder={33} />
      <PenBatch segments={dimsA} color={CHALK} width={PEN.grid} dashed dashSize={0.12} gapSize={0.1} update={dimWriter(0)} dim={() => 0.5} opacity={on} renderOrder={31} />
      {/* B: ideal (lime) and its dimension lines; T9's hero width over it */}
      <Pen points={shaftB} color={LIME} width={PEN.data} head hot progress={bDraw} dim={dimB} opacity={on} renderOrder={34} />
      <PenBatch segments={headB} color={LIME} width={PEN.data} dim={dimB} opacity={(T) => on(T) * (bDraw(T) >= 1 ? 1 : 0)} renderOrder={34} />
      <Pen points={shaftB} color={LIME} width={PEN.hero} opacity={(T) => (T >= B.everything ? bHero(T) : nothing())} gain={(T) => 1 + 0.15 * impactK(T)} renderOrder={35} />
      <PenBatch segments={dimsB} color={CHALK} width={PEN.grid} dashed dashSize={0.12} gapSize={0.1} update={dimWriter(1)} dim={() => 0.5} opacity={on} renderOrder={31} />
      {/* the technique arc: a hot lime pen from A's side to B's, then both heads */}
      <Pen points={arc} color={LIME} width={PEN.data} head hot progress={arcDraw} dim={dimArc} opacity={on} renderOrder={44} />
      <PenBatch segments={arcHeadSegs} color={LIME} width={PEN.data} dim={dimArc} opacity={(T) => on(T) * arcHeads(T)} renderOrder={44} />
    </group>
  )
}

/* ------------------------------ explore ------------------------------- */

/**
 * Explore's graph toggle (STORYBOARD-technique section 5): Figure 1 as an
 * inset whose one arrow sits on IDEAL while form holds and swings toward
 * INEFFICIENT while it falters (qualitative, p. 41). `swingK()` 0 ideal ..
 * 1 inefficient, `vis()` 0..1; both damped by the explore scene.
 */
export function ExploreGraph({ f, swingK, vis }: { f: ChartFrame; swingK: () => number; vis: () => number }) {
  const x = f.x
  const y = f.y
  const stacked = isStacked(f)
  const upx = unitsPerPx(f)
  const HEAD = 11 * upx
  const O: [number, number] = [x(PLOT.u0), y(PLOT.v0)]
  const xAxis = useMemo(() => new Float32Array([f.x(PLOT.u0), f.y(PLOT.v0), 0, f.x(PLOT.u1), f.y(PLOT.v0), 0]), [f])
  const yAxis = useMemo(() => new Float32Array([f.x(PLOT.u0), f.y(PLOT.v0), 0, f.x(PLOT.u0), f.y(PLOT.v1), 0]), [f])
  const arc = useMemo(() => arcPoints(f), [f])
  const arrow = useMemo(() => new Float32Array(3 * 6), [])
  const last = useRef('')
  const group = useRef<THREE.Group>(null)
  useSafeFrame(
    'technique explore graph',
    () => {
      flipInto(group.current!, f, exploreInset(stacked), 1)
    },
    { hide: group },
  )
  const write = (_T: number, s: Float32Array): boolean => {
    const k = swingK()
    const key = frameId(f) + '|' + k.toFixed(4)
    if (key === last.current) return false
    last.current = key
    const a = ANG_B + (ANG_A - ANG_B) * k
    const r = Math.hypot(TIP_B[0], TIP_B[1])
    const tx = x(pu(Math.cos(a) * r))
    const ty = y(pv(Math.sin(a) * r))
    seg(s, 0, O[0], O[1], tx, ty, 0.03)
    headSegs(s, 1, O[0], O[1], tx, ty, HEAD * 1.6, 28, 0.03)
    return true
  }
  return (
    <group ref={group}>
      <Pen points={xAxis} color={CHALK} width={PEN.axis} dim={() => 0.5} opacity={vis} renderOrder={30} />
      <Pen points={yAxis} color={CHALK} width={PEN.axis} dim={() => 0.5} opacity={vis} renderOrder={30} />
      <Pen points={arc} color={LIME} width={PEN.axis} dim={() => 0.4} opacity={vis} renderOrder={31} />
      <PenBatch segments={arrow} color={LIME} width={PEN.data} update={write} opacity={vis} dim={() => 1 - 0.45 * swingK()} renderOrder={34} />
    </group>
  )
}
