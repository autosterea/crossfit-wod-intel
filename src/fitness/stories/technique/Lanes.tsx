import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { POWER_CURVES, SEE } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { frameId } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { curveGlyph } from '../../story/kit/shapes'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'
import { Rings } from './Rings'
import { PARK, seg } from './geom'
import {
  CURVE_H,
  CURVE_U0,
  CURVE_U1,
  FAST_K,
  FINISHERS,
  FINISH_U,
  GOAL_K,
  LANES,
  LANE_U0,
  LANE_U1,
  START_U,
  STOPPER,
  STOPS,
  unitsPerPx,
  vectors,
} from './layout'
import {
  B,
  afterDraw,
  bandSweep,
  baseDraw,
  beforeDraw,
  fade0,
  fastDraw,
  fastTick,
  finishTick,
  finisherFlare,
  fold0,
  goalDraw,
  goalName,
  linesDraw,
  live,
  nameEfficacy,
  nameEfficiency,
  nameSafety,
  readout2of10,
  runFront,
  slowDraw,
  slowTick,
  workCap,
} from './timeline'

/* =========================================================================
   T0 "Return, rate, finish line" (STORYBOARD-technique T0, p. 40): three
   lanes, time running left to right in each. EFFICACY: the return, the
   band a program adds between a work-capacity curve before and after (the
   lesson's own curve, chapter 04's Generalist). EFFICIENCY: the time rate,
   50 pull-ups in six months against nine years, to scale on a nine-year
   lane. SAFETY: who finishes, ten runners, two of them over the line.
   T1 folds the lanes: each coloured mark shrinks into the vectors' origin.
   ========================================================================= */

const LIME = SEE[1].color
const ROSE = SEE[0].color
const BLUE = SEE[2].color
const CHALK = '#eef3f6'
const N_CURVE = 64
const RUNNERS = 10
/** rows of the pack (two columns of five), as a share of the safety lane's height */
const ROW_K = [0.08, 0.215, 0.35, 0.485, 0.62]
const COL_DU = 0.032

/** The Generalist's curve (chapter 04) from the kit's curveGlyph, resampled evenly in x: [x 0..1, value]. */
function generalist(): Float32Array {
  const g = curveGlyph(POWER_CURVES[0].samples, 1, 1, false)
  const n = g.length / 3
  const out = new Float32Array(N_CURVE * 2)
  let j = 0
  for (let i = 0; i < N_CURVE; i++) {
    const x = i / (N_CURVE - 1) - 0.5
    while (j < n - 2 && g[(j + 1) * 3] < x) j++
    const x0 = g[j * 3]
    const x1 = g[(j + 1) * 3]
    const k = x1 > x0 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 0
    out[i * 2] = x + 0.5
    out[i * 2 + 1] = g[j * 3 + 1] + (g[(j + 1) * 3 + 1] - g[j * 3 + 1]) * k + 0.5
  }
  return out
}
const GEN = generalist()
const GEN_MAX = POWER_CURVES[0].samples[0]

const stopOf = (i: number): number => {
  const k = (STOPPER as readonly number[]).indexOf(i)
  return k >= 0 ? STOPS[k] : Infinity
}
const colOf = (i: number) => (i < 5 ? 0 : 1)
const rowOf = (i: number) => i % 5

/** Runner i's chart u at T (the pack runs together; a stopper stays where it stopped). */
function runnerU(T: number, i: number): number {
  const u = runFront(T) - COL_DU * colOf(i)
  return Math.min(u, stopOf(i))
}
/** 0 while running, rising to 1 as a stopper hollows out (just after it stops) */
function hollow(T: number, i: number): number {
  const s = stopOf(i)
  if (!Number.isFinite(s)) return 0
  const u = runFront(T) - COL_DU * colOf(i)
  // the pack moves about 4 u per beat t: hollow over the next 0.025 u
  return Math.min(1, Math.max(0, (u - s) / 0.05))
}

export function Lanes({ f }: { f: ChartFrame }) {
  const x = f.x
  const y = f.y
  const vg = vectors(f)
  const O: [number, number] = [x(vg.ou), y(vg.ov)]
  const upx = unitsPerPx(f)
  const on = (T: number) => live(T, 0, B.vectors + 0.12)
  const rest = (T: number) => on(T) * fade0(T)

  /* ---------------------------- baselines ---------------------------- */
  const baseSegs = useMemo(() => new Float32Array(3 * 6), [])
  const lastBase = useRef('')
  const writeBase = (T: number, s: Float32Array): boolean => {
    const k0 = baseDraw(T, 0)
    const k1 = baseDraw(T, 1)
    const k2 = baseDraw(T, 2)
    const key = frameId(f) + '|' + k0 + '|' + k1 + '|' + k2
    if (key === lastBase.current) return false
    lastBase.current = key
    ;[k0, k1, k2].forEach((k, i) => {
      const v = y(LANES[i].v0)
      if (k <= 0.0005) seg(s, i, PARK, PARK, PARK + 1, PARK)
      else seg(s, i, x(LANE_U0), v, x(LANE_U0 + (LANE_U1 - LANE_U0) * k), v)
    })
    return true
  }

  /* ---------------------------- efficacy ----------------------------- */
  const lane0 = LANES[0]
  const h0 = lane0.v1 - lane0.v0
  const curveV = (val: number, scale: number) => lane0.v0 + (val / GEN_MAX) * CURVE_H * h0 * scale
  const after = useMemo(() => {
    const p = new Float32Array(N_CURVE * 3)
    for (let i = 0; i < N_CURVE; i++) {
      p[i * 3] = x(CURVE_U0 + (CURVE_U1 - CURVE_U0) * GEN[i * 2])
      p[i * 3 + 1] = y(curveV(GEN[i * 2 + 1], 1))
      p[i * 3 + 2] = 0.02
    }
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])
  const before = useMemo(() => {
    const p = new Float32Array(N_CURVE * 3)
    for (let i = 0; i < N_CURVE; i++) {
      p[i * 3] = x(CURVE_U0 + (CURVE_U1 - CURVE_U0) * GEN[i * 2])
      p[i * 3 + 1] = y(curveV(GEN[i * 2 + 1], 0.7))
      p[i * 3 + 2] = 0.02
    }
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])
  const bandTop = useMemo(() => {
    const t = new Float32Array(N_CURVE * 2)
    for (let i = 0; i < N_CURVE; i++) {
      t[i * 2] = after[i * 3]
      t[i * 2 + 1] = after[i * 3 + 1]
    }
    return t
  }, [after])
  const bandBottom = useMemo(() => {
    const b = new Float32Array(N_CURVE)
    for (let i = 0; i < N_CURVE; i++) b[i] = before[i * 3 + 1]
    return b
  }, [before])

  /* --------------------------- efficiency ---------------------------- */
  const lane1 = LANES[1]
  const goalV = lane1.v0 + GOAL_K * (lane1.v1 - lane1.v0)
  const fastU = LANE_U0 + FAST_K * (LANE_U1 - LANE_U0)
  const goal = useMemo(() => new Float32Array([x(LANE_U0), y(goalV), 0, x(LANE_U1), y(goalV), 0]), [x, y, goalV])
  const fast = useMemo(() => new Float32Array([x(LANE_U0), y(lane1.v0), 0.02, x(fastU), y(goalV), 0.02]), [x, y, lane1.v0, fastU, goalV])
  const slow = useMemo(() => new Float32Array([x(LANE_U0), y(lane1.v0), 0.01, x(LANE_U1), y(goalV), 0.01]), [x, y, lane1.v0, goalV])

  /* ----------------------------- safety ------------------------------ */
  const lane2 = LANES[2]
  const h2 = lane2.v1 - lane2.v0
  const lineTop = lane2.v0 + 0.86 * h2
  const startFinish = useMemo(
    () => new Float32Array([x(START_U), y(lane2.v0), 0, x(START_U), y(lineTop), 0, x(FINISH_U), y(lane2.v0), 0, x(FINISH_U), y(lineTop), 0]),
    [x, y, lane2.v0, lineTop],
  )
  const rowV = (i: number) => lane2.v0 + ROW_K[rowOf(i)] * h2
  const dotR = Math.min(0.2, 5.5 * upx)

  /* --------------------- the T1 fold (coloured marks) ------------------ */
  const foldGroup = useRef<THREE.Group>(null)
  useSafeFrame(
    'technique T0 fold',
    (T) => {
      const g = foldGroup.current!
      const k = fold0(T)
      const s = 1 - 0.96 * k
      g.scale.set(s, s, 1)
      g.position.set(O[0] * (1 - s), O[1] * (1 - s), 0)
    },
    { hide: foldGroup },
  )
  const coloured = (T: number) => on(T) * (1 - fold0(T))
  /** a point folded toward the origin */
  const folded = (T: number, px: number, py: number, out: [number, number, number]) => {
    const s = 1 - 0.96 * fold0(T)
    out[0] = O[0] + (px - O[0]) * s
    out[1] = O[1] + (py - O[1]) * s
    out[2] = 0.05
  }

  /* ------------------------------ labels ----------------------------- */
  const labels = useMemo<LabelSpec[]>(() => {
    const lt = (i: number) => LANES[i].v1
    const finishMid = lane2.v0 + 0.43 * h2
    return [
      {
        id: 'tq-efficacy',
        text: 'EFFICACY: THE RETURN',
        tone: 'callout',
        color: LIME,
        required: true,
        anchor: [x(LANE_U0), y(lt(0)), 0],
        prefer: 'SE',
        only: ['SE', 'E'],
        gapPx: 2,
        cue: (T) => nameEfficacy(T) * rest(T),
      },
      {
        id: 'tq-efficiency',
        text: 'EFFICIENCY: TIME RATE',
        tone: 'callout',
        color: BLUE,
        required: true,
        anchor: [x(LANE_U0), y(lt(1)), 0],
        prefer: 'SE',
        only: ['SE', 'E'],
        gapPx: 2,
        cue: (T) => nameEfficiency(T) * rest(T),
      },
      {
        id: 'tq-safety',
        text: 'SAFETY: WHO FINISHES',
        tone: 'callout',
        color: ROSE,
        required: true,
        anchor: [x(LANE_U0), y(lt(2)), 0],
        prefer: 'SE',
        only: ['SE', 'E'],
        gapPx: 2,
        cue: (T) => nameSafety(T) * rest(T),
      },
      {
        id: 'tq-workcap',
        text: 'WORK CAPACITY',
        tone: 'name',
        color: LIME,
        anchor: [x(CURVE_U0 + (CURVE_U1 - CURVE_U0) * 0.62), y(curveV(GEN[Math.round(0.62 * (N_CURVE - 1)) * 2 + 1], 0.85)), 0.04],
        prefer: 'C',
        priority: 70,
        cue: (T) => workCap(T) * rest(T),
      },
      {
        id: 'tq-goal',
        text: '50 PULL-UPS',
        tone: 'tick',
        anchor: [x(LANE_U1), y(goalV), 0],
        prefer: 'NW',
        only: ['NW', 'N', 'SW'],
        gapPx: 4,
        priority: 50,
        cue: (T) => goalName(T) * rest(T),
      },
      {
        id: 'tq-6mo',
        text: '6 MONTHS',
        tone: 'tick',
        anchor: [x(fastU), y(goalV), 0],
        prefer: 'SE',
        only: ['SE', 'E', 'NE'],
        gapPx: 10,
        priority: 52,
        cue: (T) => fastTick(T) * rest(T),
      },
      {
        id: 'tq-9yr',
        text: '9 YEARS',
        tone: 'tick',
        anchor: [x(LANE_U1), y(lane1.v0), 0],
        prefer: 'SW',
        only: ['SW', 'S', 'W', 'NW'],
        gapPx: 4,
        priority: 51,
        cue: (T) => slowTick(T) * rest(T),
      },
      {
        id: 'tq-finish',
        text: 'FINISH LINE',
        tone: 'tick',
        anchor: [x(FINISH_U), y(lane2.v0), 0],
        prefer: 'S',
        only: ['S', 'SW', 'SE'],
        gapPx: 5,
        priority: 50,
        cue: (T) => finishTick(T) * rest(T),
      },
      {
        id: 'tq-2of10',
        text: '2 OF 10',
        tone: 'readout',
        size: 'sm',
        color: ROSE,
        minChars: 7,
        anchor: [x(FINISH_U), y(finishMid), 0.05],
        prefer: 'W',
        only: ['W', 'NW', 'SW'],
        gapPx: 10,
        priority: 88,
        cue: (T) => readout2of10(T) * rest(T),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])
  useLabels(labels)

  // labels keep off the curves, the lines and the runners
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        if (!on(T) || T >= B.vectors) return 0
        let n = 0
        const put = (px: number, py: number) => {
          out[n * 3] = px
          out[n * 3 + 1] = py
          out[n * 3 + 2] = 0
          n++
        }
        if (afterDraw(T) > 0) for (let i = 0; i < N_CURVE; i += 4) put(after[i * 3], after[i * 3 + 1])
        if (beforeDraw(T) > 0) for (let i = 2; i < N_CURVE; i += 4) put(before[i * 3], before[i * 3 + 1])
        if (slowDraw(T) > 0)
          for (let i = 0; i <= 12; i++) {
            const k = i / 12
            put(x(LANE_U0 + (LANE_U1 - LANE_U0) * k), y(lane1.v0 + (goalV - lane1.v0) * k))
          }
        if (fastDraw(T) > 0)
          for (let i = 0; i <= 4; i++) {
            const k = i / 4
            put(x(LANE_U0 + (fastU - LANE_U0) * k), y(lane1.v0 + (goalV - lane1.v0) * k))
          }
        if (T >= B.judge + 0.68) for (let i = 0; i < RUNNERS; i++) put(x(runnerU(T, i)), y(rowV(i)))
        return n
      },
      maxPoints: 72,
      radiusPx: 6,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f, after, before],
  )
  useWorldObstacle('tq-lanes', obstacle)

  const ringColors = useMemo(() => Array.from({ length: RUNNERS }, () => ROSE), [])

  return (
    <>
      {/* construction: three lane baselines, chalk 55% */}
      <PenBatch segments={baseSegs} color={CHALK} width={PEN.axis} update={writeBase} dim={() => 0.55} opacity={rest} renderOrder={30} />

      {/* efficacy: before (dashed chalk), the return (lime band), after (lime, hot head) */}
      <Pen points={before} color={CHALK} width={PEN.axis} dashed dashSize={0.18} gapSize={0.13} progress={beforeDraw} dim={() => 0.7} opacity={rest} renderOrder={32} />
      <group ref={foldGroup}>
        <AreaFill top={bandTop} bottom={bandBottom} baseline={y(lane0.v0)} z={0} color={LIME} reveal={bandSweep} opacity={(T) => (bandSweep(T) > 0.001 ? coloured(T) : 0)} lo={0.05} hi={0.3} renderOrder={11} />
        <Pen points={after} color={LIME} width={PEN.data} head hot progress={afterDraw} opacity={coloured} renderOrder={44} />
        {/* efficiency: six months, nearly vertical on a nine-year lane (hot head) */}
        <Pen points={fast} color={BLUE} width={PEN.data} head hot progress={fastDraw} opacity={coloured} renderOrder={44} />
      </group>
      <Pen points={goal} color={CHALK} width={PEN.axis} dashed dashSize={0.16} gapSize={0.12} progress={goalDraw} dim={() => 0.6} opacity={rest} renderOrder={31} />
      <Pen points={slow} color={CHALK} width={PEN.data} dashed dashSize={0.2} gapSize={0.14} progress={slowDraw} dim={() => 0.75} opacity={rest} renderOrder={32} />

      {/* safety: the start and finish lines, ten runners, eight hollow rings, two finishers */}
      <PenBatch segments={startFinish} color={CHALK} width={PEN.axis} progress={linesDraw} dim={() => 0.55} opacity={rest} renderOrder={30} />
      <Nodes
        count={RUNNERS}
        radius={dotR}
        color={ROSE}
        place={(T, i, out) => {
          if (!on(T) || T < B.judge + 0.66) return 0
          const fin = (FINISHERS as readonly number[]).includes(i)
          if (fin) {
            folded(T, x(runnerU(T, i)), y(rowV(i)), out)
            return (1 - fold0(T)) * Math.min(1, (T - B.judge - 0.66) / 0.02)
          }
          out[0] = x(runnerU(T, i))
          out[1] = y(rowV(i))
          out[2] = 0.05
          const appear = Math.min(1, (T - B.judge - 0.66) / 0.02)
          return appear * (1 - hollow(T, i)) * fade0(T)
        }}
      />
      <Rings
        count={RUNNERS}
        sizePx={Math.round(2 * (dotR / upx) / 0.648 + 2)}
        colors={ringColors}
        place={(T, i, out) => {
          if (!on(T) || T >= B.vectors + 0.1) return 0
          const h = hollow(T, i)
          if (h <= 0) return 0
          out[0] = x(runnerU(T, i))
          out[1] = y(rowV(i))
          out[2] = 0.04
          // fade in at k 0.95 (faint) down to the resting 0.6 (about 35%), and out again as T1 folds
          return 0.6 + 0.39 * (1 - h) + 0.39 * (1 - fade0(T))
        }}
      />
      {/* the two who finish flare as they cross (the speaking element) */}
      <Glows
        count={FINISHERS.length}
        sizePx={34}
        colors={[ROSE]}
        gain={2.2}
        place={(T, i, out) => {
          if (!on(T)) return 0
          const r = FINISHERS[i]
          folded(T, x(runnerU(T, r)), y(rowV(r)), out)
          return finisherFlare(T) * (1 - fold0(T))
        }}
      />
    </>
  )
}
