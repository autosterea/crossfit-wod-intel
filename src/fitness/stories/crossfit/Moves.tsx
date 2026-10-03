import { useMemo } from 'react'
import { PAL } from '../../fitnessData'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { useLabels } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'
import { DEADLIFT, J, N_POINTS, SIT_TO_STAND, pose, poseAt, skeleton } from './figure'
import { FigureSet, type FigureSpec } from './Figures'
import { SWAPS, pair, table, type PairKind, type TableKind } from './layout'
import {
  B,
  arrowDraw,
  funMove,
  funName,
  groundDraw,
  headsIn,
  isoMove,
  isoName,
  liftName,
  liftUp,
  multiJoint,
  pairDraw,
  pairOut,
  squatName,
  standUp,
  swapDraw,
  swapOut,
} from './timeline'
import { at } from '../../story/cue'

/* =========================================================================
   C1 "Movements from life" and C2 "One joint, or many" (STORYBOARD-crossfit.md).
   C1: a figure stands up from a box (squatting is standing from a seated
   position) and another picks a crate off the ground (deadlifting is picking
   any object off the ground); the joints that turn glow, then keep a
   yellow-green marker. C2: the guide's three swaps as a coach's table, the
   one-joint isolation move beside the whole-body movement that replaced it.
   ========================================================================= */

const AWAY = 1e5

/** one segment (z 0) into a batch buffer, without allocating */
function put(s: Float32Array, o: number, ax: number, ay: number, bx: number, by: number) {
  s[o] = ax
  s[o + 1] = ay
  s[o + 2] = 0
  s[o + 3] = bx
  s[o + 4] = by
  s[o + 5] = 0
}

function groundSegs(gs: readonly [number, number, number][]): Float32Array {
  const s = new Float32Array(gs.length * 6)
  gs.forEach(([x0, x1, y], i) => s.set([x0, y, 0, x1, y, 0], i * 6))
  return s
}

/* ------------------------------- C1 ----------------------------------- */

export function Pair({ kind }: { kind: PairKind }) {
  const geo = useMemo(() => pair(kind), [kind])
  const specs = useMemo<FigureSpec[]>(() => {
    const vis = (T: number) => (T < B.func ? 0 : pairOut(T))
    return [
      {
        id: 'cf-squat',
        move: SIT_TO_STAND,
        place: geo.left,
        p: standUp,
        draw: pairDraw,
        vis,
        ghost: (T) => at(T, B.func, 0.3, 0.42),
        marks: (T) => at(T, B.func, 0.52, 0.6),
        width: PEN.data,
      },
      {
        id: 'cf-deadlift',
        move: DEADLIFT,
        place: geo.right,
        p: liftUp,
        draw: pairDraw,
        vis,
        // the ghost is the gripping pose at the bottom
        ghost: (T) => at(T, B.func, 0.7, 0.8),
        ghostP: DEADLIFT.keys[1].p,
        marks: (T) => at(T, B.func, 0.86, 0.94),
        width: PEN.data,
      },
    ]
  }, [geo])
  const grounds = useMemo(() => groundSegs(geo.grounds), [geo])
  // where the crate stood: its outline stays on the floor, dashed, once it is lifted (the "before" of the lift)
  const crateGhost = useMemo(() => {
    const sk = new Float32Array(N_POINTS * 3)
    skeleton(DEADLIFT, poseAt(DEADLIFT, DEADLIFT.keys[1].p, pose({})), sk)
    const h = sk[J.wrist * 3 + 1]
    const cz = sk[J.wrist * 3 + 2] + 0.02
    const d = 0.13
    const p = geo.right
    const X = (z: number) => p.x + p.S * z
    const Y = (y: number) => p.y + p.S * y
    return new Float32Array([
      X(cz - d / 2), Y(0.004), 0.01, X(cz - d / 2), Y(h), 0.01,
      X(cz + d / 2), Y(h), 0.01, X(cz + d / 2), Y(0.004), 0.01,
    ])
  }, [geo])
  const labels = useMemo<LabelSpec[]>(() => {
    const l = geo.left
    const r = geo.right
    return [
      {
        id: 'cf-n-squat',
        text: 'SQUAT',
        tone: 'name',
        color: PAL.chalk,
        dot: false,
        anchor: [l.x, l.y - 0.1, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 6,
        priority: 88,
        required: true,
        cue: (T) => squatName(T) * pairOut(T),
      },
      {
        id: 'cf-n-deadlift',
        text: 'DEADLIFT',
        tone: 'name',
        color: PAL.chalk,
        dot: false,
        anchor: [r.x, r.y - 0.1, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 6,
        priority: 88,
        required: true,
        cue: (T) => liftName(T) * pairOut(T),
      },
      {
        id: 'cf-multi',
        text: 'MULTI-JOINT',
        tone: 'callout',
        color: PAL.yellowGreen,
        // the pair's claim, in the markers' colour, under both names
        anchor: [geo.claim[0], geo.claim[1], 0.05],
        prefer: 'S',
        only: ['S'],
        gapPx: 30,
        priority: 94,
        cue: (T) => multiJoint(T) * pairOut(T),
      },
    ]
  }, [geo])
  useLabels(labels)
  return (
    <>
      <PenBatch segments={grounds} color={PAL.chalk} width={PEN.axis} progress={groundDraw} opacity={(T) => (T < B.func ? 0 : 0.5 * pairOut(T))} />
      <Pen points={crateGhost} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.12} gapSize={0.1} opacity={(T) => 0.6 * at(T, B.func, 0.7, 0.8) * pairOut(T)} />
      <FigureSet specs={specs} obstacleId="cf-pair" />
    </>
  )
}

/* ------------------------------- C2 ----------------------------------- */

const ISO_NAMES = ['LATERAL RAISE', 'CURL', 'LEG EXTENSION'] as const
const FUN_NAMES = ['PUSH PRESS', 'PULL-UP', 'SQUAT'] as const

export function Swaps({ kind }: { kind: TableKind }) {
  const geo = useMemo(() => table(kind), [kind])
  const specs = useMemo<FigureSpec[]>(() => {
    const vis = (T: number) => (T < B.swap ? 0 : swapOut(T))
    const out: FigureSpec[] = []
    SWAPS.forEach((w, r) => {
      out.push({
        id: `cf-iso-${r}`,
        move: w.iso,
        place: geo.iso[r],
        p: (T) => isoMove(T, r),
        draw: (T) => swapDraw(T, r),
        vis,
        ghost: (T) => isoMove(T, r) > 0 ? Math.min(1, isoMove(T, r) * 3) : 0,
        marks: (T) => at(T, B.swap, [0.1, 0.38, 0.66][r] + 0.1, [0.1, 0.38, 0.66][r] + 0.16),
        width: 2.4,
      })
      out.push({
        id: `cf-fun-${r}`,
        move: w.fun,
        place: geo.fun[r],
        p: (T) => funMove(T, r),
        draw: (T) => swapDraw(T, r),
        vis,
        ghost: (T) => funMove(T, r) > 0 ? Math.min(1, funMove(T, r) * 3) : 0,
        marks: (T) => at(T, B.swap, [0.1, 0.38, 0.66][r] + 0.3, [0.1, 0.38, 0.66][r] + 0.36),
        width: 2.4,
      })
    })
    return out
  }, [geo])
  const grounds = useMemo(() => groundSegs(geo.grounds), [geo])
  // three arrows (a shaft and a two-stroke head each), drawn row by row
  const arrowSegs = useMemo(() => new Float32Array(geo.arrows.length * 3 * 6).fill(AWAY), [geo])
  const lastA = useMemo(() => ({ key: '' }), [])
  const writeArrows = (T: number, s: Float32Array): boolean => {
    const key = kind + T
    if (key === lastA.key) return false
    lastA.key = key
    geo.arrows.forEach(([x0, y0, x1, y1], r) => {
      const k = arrowDraw(T, r)
      const o = r * 18
      if (k <= 0.001) {
        s.fill(AWAY, o, o + 18)
        return
      }
      const x = x0 + (x1 - x0) * k
      const y = y0 + (y1 - y0) * k
      const dx = x1 - x0
      const dy = y1 - y0
      const L = Math.hypot(dx, dy) || 1
      const ux = dx / L
      const uy = dy / L
      const h = Math.min(0.42, L * 0.35) * Math.min(1, k * 1.4)
      // the shaft, then the two strokes of the head
      put(s, o, x0, y0, x, y)
      put(s, o + 6, x, y, x - h * (ux + uy * 0.7), y - h * (uy - ux * 0.7))
      put(s, o + 12, x, y, x - h * (ux - uy * 0.7), y - h * (uy + ux * 0.7))
    })
    return true
  }
  const labels = useMemo<LabelSpec[]>(() => {
    // each head: its name, and its sub-head nearer the table (they share one anchor; the gaps stack them)
    const head = (k: 0 | 1, id: string, text: string, sub: string, color: string, dot: boolean): LabelSpec[] => {
      const h = geo.heads[k]
      const anchor = [h.at[0], h.at[1], 0] as const
      return [
        { id, text, tone: 'name', color, dot, anchor, prefer: h.dir, only: [h.dir], gapPx: 19, priority: 92, required: true, cue: (T) => headsIn(T) * swapOut(T) },
        { id: id + '-sub', text: sub, tone: 'tick', anchor, prefer: h.dir, only: [h.dir], gapPx: 3, priority: 91, required: true, cue: (T) => headsIn(T) * swapOut(T) },
      ]
    }
    const out: LabelSpec[] = [
      ...head(0, 'cf-head-iso', 'ISOLATION', 'ONE JOINT', PAL.chalk, false),
      ...head(1, 'cf-head-fun', 'FUNCTIONAL', 'MULTI-JOINT', PAL.yellowGreen, true),
    ]
    SWAPS.forEach((_, r) => {
      out.push(
        {
          id: `cf-n-iso-${r}`,
          text: ISO_NAMES[r],
          tone: 'name',
          color: PAL.chalk,
          dot: false,
          anchor: [geo.isoName[r][0], geo.isoName[r][1], 0],
          prefer: 'S',
          only: ['S'],
          gapPx: 4,
          priority: 86,
          required: true,
          cue: (T) => isoName(T, r) * swapOut(T),
        },
        {
          id: `cf-n-fun-${r}`,
          text: FUN_NAMES[r],
          tone: 'name',
          color: PAL.chalk,
          dot: false,
          anchor: [geo.funName[r][0], geo.funName[r][1], 0],
          prefer: 'S',
          only: ['S'],
          gapPx: 4,
          priority: 86,
          required: true,
          cue: (T) => funName(T, r) * swapOut(T),
        },
      )
    })
    return out
  }, [geo])
  useLabels(labels)
  return (
    <>
      <PenBatch segments={grounds} color={PAL.chalk} width={PEN.grid} progress={(T) => at(T, B.swap, 0.02, 0.2)} opacity={(T) => (T < B.swap ? 0 : 0.4 * swapOut(T))} />
      <PenBatch segments={arrowSegs} color={PAL.chalk} width={PEN.axis} update={writeArrows} opacity={(T) => (T < B.swap ? 0 : 0.75 * swapOut(T))} />
      <FigureSet specs={specs} obstacleId="cf-swaps" glowPx={15} />
    </>
  )
}
