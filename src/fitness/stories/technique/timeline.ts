import { at, pulse } from '../../story/cue'
import { ease } from '../../story/ease'

/* =========================================================================
   08 TECHNIQUE timeline (STORYBOARD-technique.md section 3). Every window is
   a pure function of story time T = beat + t, so ?beat=N&t=X renders the
   frame that seeking there renders, and (N, 1) equals (N + 1, 0): what a
   beat builds leaves only inside a later beat (its first 12%), never at a
   boundary. The reveals follow the order of the storyboard's voice
   paragraphs, so narration can be laid on later without re-cutting.
   ========================================================================= */

export const B = {
  judge: 0,
  vectors: 1,
  quality: 2,
  graph: 3,
  deviation: 4,
  charter: 5,
  odds: 6,
  threshold: 7,
  margin: 8,
  everything: 9,
} as const

/** Live only between [a, b) in global T (prewarmed objects hide outside their window). */
export const live = (T: number, a: number, b: number) => (T >= a && T < b ? 1 : 0)
const up = (T: number, n: number, a: number, b: number, e = ease.linear) => at(T, n, a, b, e)
const fall = (T: number, n: number, a: number, b: number, e = ease.linear) => 1 - at(T, n, a, b, e)

/* ------------------------------ T0 judge ------------------------------ */

/** lane i's baseline (60 ms stagger) */
export const baseDraw = (T: number, i: number) => up(T, B.judge, 0.01 * i, 0.08 + 0.01 * i, ease.draw)
export const nameEfficacy = (T: number) => up(T, B.judge, 0.12, 0.15)
export const beforeDraw = (T: number) => up(T, B.judge, 0.12, 0.2, ease.draw)
export const afterDraw = (T: number) => up(T, B.judge, 0.2, 0.3, ease.draw)
export const bandSweep = (T: number) => up(T, B.judge, 0.26, 0.36, ease.settle)
export const workCap = (T: number) => up(T, B.judge, 0.34, 0.37)
export const nameEfficiency = (T: number) => up(T, B.judge, 0.38, 0.41)
export const goalDraw = (T: number) => up(T, B.judge, 0.4, 0.46, ease.draw)
export const goalName = (T: number) => up(T, B.judge, 0.43, 0.46)
export const fastDraw = (T: number) => up(T, B.judge, 0.46, 0.52, ease.draw)
export const fastTick = (T: number) => up(T, B.judge, 0.5, 0.53)
export const slowDraw = (T: number) => up(T, B.judge, 0.52, 0.62, ease.draw)
export const slowTick = (T: number) => up(T, B.judge, 0.6, 0.63)
export const nameSafety = (T: number) => up(T, B.judge, 0.64, 0.67)
export const linesDraw = (T: number) => up(T, B.judge, 0.64, 0.68, ease.draw)
export const finishTick = (T: number) => up(T, B.judge, 0.66, 0.69)
/** the runners' front, chart u: they leave the start together at 0.68 and the two finish by 0.90 */
export const RUN_A = 0.68
export const RUN_B = 0.895
export const RUN_U0 = 0.085
export const RUN_U1 = 0.955
export const runFront = (T: number) => RUN_U0 + (RUN_U1 - RUN_U0) * up(T, B.judge, RUN_A, RUN_B)
export const finisherFlare = (T: number) => pulse(T, B.judge + 0.86, B.judge + 0.96)
export const readout2of10 = (T: number) => up(T, B.judge, 0.92, 0.96)
/** T1 folds T0: the coloured elements shrink toward the vectors' origin, the rest fades */
export const fold0 = (T: number) => up(T, B.vectors, 0, 0.12, ease.morph)
export const fade0 = (T: number) => fall(T, B.vectors, 0, 0.1)

/* ----------------------------- T1 vectors ----------------------------- */

/** arrow i (0 safety, 1 efficacy, 2 efficiency) grows from the origin (60 ms stagger) */
export const grow = (T: number, i: number) => up(T, B.vectors, 0.04 + 0.02 * i, 0.16 + 0.02 * i, ease.settle)
export const tipName = (T: number, i: number) => up(T, B.vectors, 0.14 + 0.02 * i, 0.18 + 0.02 * i)
export const sameDir = (T: number) => {
  const on = up(T, B.vectors, 0.2, 0.26)
  const dimmed = up(T, B.vectors, 0.28, 0.32) * fall(T, B.vectors, 0.88, 0.94)
  return on * (1 - 0.45 * dimmed)
}
/** the three trade-offs (p. 40), each out and back */
export const trade1 = (T: number) => up(T, B.vectors, 0.28, 0.4, ease.morph) * fall(T, B.vectors, 0.46, 0.5, ease.morph)
export const trade2 = (T: number) => up(T, B.vectors, 0.54, 0.66, ease.morph) * fall(T, B.vectors, 0.68, 0.72, ease.morph)
export const trade3a = (T: number) => up(T, B.vectors, 0.72, 0.78, ease.morph) * fall(T, B.vectors, 0.88, 0.96, ease.morph)
export const trade3b = (T: number) => up(T, B.vectors, 0.78, 0.88, ease.morph) * fall(T, B.vectors, 0.88, 0.96, ease.morph)
export const chevronTurn = (T: number) => up(T, B.vectors, 0.5, 0.56, ease.settle)
export const chevronOn = (T: number) => up(T, B.vectors, 0.5, 0.53) * fall(T, B.vectors, 0.68, 0.72)
export const tickZero = (T: number) => up(T, B.vectors, 0.34, 0.37) * fall(T, B.vectors, 0.46, 0.49)
export const tickIntensity = (T: number) => up(T, B.vectors, 0.55, 0.58) * fall(T, B.vectors, 0.68, 0.71)
export const tickLosing = (T: number) => up(T, B.vectors, 0.75, 0.78) * fall(T, B.vectors, 0.88, 0.91)
/** T2 picks the efficacy arrow up: the other two fade, it swings level into the title's underline */
export const fadeSE = (T: number) => fall(T, B.quality, 0, 0.12)
export const swing = (T: number) => up(T, B.quality, 0.02, 0.16, ease.morph)

/* ------------------------------ T2 terms ------------------------------ */

export const titleOn = (T: number) => up(T, B.quality, 0.12, 0.18)
export const mechDraw = (T: number) => up(T, B.quality, 0.2, 0.28, ease.draw)
export const glyphDraw = (T: number) => up(T, B.quality, 0.24, 0.3, ease.draw)
export const mechName = (T: number) => up(T, B.quality, 0.28, 0.32)
export const techDraw = (T: number) => up(T, B.quality, 0.34, 0.46, ease.draw)
export const techName = (T: number) => up(T, B.quality, 0.44, 0.48)
export const formLime = (T: number) => up(T, B.quality, 0.52, 0.6, ease.settle)
export const formRed = (T: number) => up(T, B.quality, 0.6, 0.68, ease.settle)
export const formName = (T: number) => up(T, B.quality, 0.64, 0.68)
export const styleDraw = (T: number) => up(T, B.quality, 0.72, 0.8, ease.draw)
export const squiggle = (T: number, i: number) => up(T, B.quality, 0.76 + 0.04 * i, 0.84 + 0.04 * i, ease.draw)
export const styleName = (T: number) => up(T, B.quality, 0.82, 0.86)
export const connDraw = (T: number) => up(T, B.quality, 0.86, 0.92, ease.draw)
export const bearingTick = (T: number) => up(T, B.quality, 0.9, 0.94)
/** T3 clears the terms */
export const out2 = (T: number) => fall(T, B.graph, 0, 0.04)

/* --------------------------- T3, T4, T9 graph ------------------------- */

export const xAxisDraw = (T: number) => (T < B.everything ? up(T, B.graph, 0.04, 0.14, ease.draw) : up(T, B.everything, 0.06, 0.12, ease.draw))
export const yAxisDraw = (T: number) => (T < B.everything ? up(T, B.graph, 0.14, 0.24, ease.draw) : up(T, B.everything, 0.1, 0.16, ease.draw))
export const xTitle = (T: number) => (T < B.everything ? up(T, B.graph, 0.12, 0.16) * fall(T, B.deviation, 0, 0.06) : up(T, B.everything, 0.12, 0.16))
export const yTitle = (T: number) => (T < B.everything ? up(T, B.graph, 0.22, 0.26) * fall(T, B.deviation, 0, 0.06) : up(T, B.everything, 0.16, 0.2))
export const aDraw = (T: number) => (T < B.everything ? up(T, B.graph, 0.28, 0.4, ease.draw) : up(T, B.everything, 0.16, 0.23, ease.draw))
export const aDims = (T: number) => up(T, B.graph, 0.4, 0.48, ease.draw) * fall(T, B.deviation, 0, 0.06)
export const aName = (T: number) => up(T, B.graph, 0.4, 0.44) * fall(T, B.deviation, 0, 0.06)
export const bDraw = (T: number) => (T < B.everything ? up(T, B.graph, 0.52, 0.62, ease.draw) : up(T, B.everything, 0.22, 0.3, ease.draw))
export const bDims = (T: number) => up(T, B.graph, 0.62, 0.68, ease.draw) * fall(T, B.deviation, 0, 0.06)
export const bName = (T: number) => up(T, B.graph, 0.6, 0.64) * fall(T, B.deviation, 0, 0.06)
export const arcDraw = (T: number) => (T < B.everything ? up(T, B.graph, 0.74, 0.86, ease.draw) : up(T, B.everything, 0.3, 0.48, ease.draw))
export const arcHeads = (T: number) => (T < B.everything ? up(T, B.graph, 0.84, 0.88) : up(T, B.everything, 0.46, 0.5))
export const claimTechnique = (T: number) => (T < B.everything ? up(T, B.graph, 0.88, 0.92) * fall(T, B.deviation, 0, 0.06) : up(T, B.everything, 0.5, 0.56))
/** T9: arrow B brightens to the hero width */
export const bHero = (T: number) => up(T, B.everything, 0.4, 0.56)
/** T4: the graph FLIPs into the inset; its arrows and arc rest at 50% */
export const flip = (T: number) => (T < B.everything ? up(T, B.deviation, 0, 0.16, ease.morph) : 0)
export const insetDim = (T: number) => (T < B.everything ? up(T, B.deviation, 0, 0.16) : 0)
export const idealBright = (T: number) => up(T, B.deviation, 0.3, 0.36) * fall(T, B.deviation, 0.56, 0.62)
export const inefficientBright = (T: number) => up(T, B.deviation, 0.62, 0.68) * fall(T, B.deviation, 0.8, 0.86)
/** the graph is on screen from T3 into T5's first 10%, and again in T9 */
export const graphOn = (T: number) => (T < B.everything ? (T >= B.graph && T < B.charter + 0.1 ? fall(T, B.charter, 0, 0.1) : 0) : 1)

/* --------------------------- T4 deviation ----------------------------- */

export const liftersIn = (T: number) => up(T, B.deviation, 0.14, 0.26) * fall(T, B.charter, 0, 0.1)
/** T4's clean (rep phase knots [t, phase], STORYBOARD-technique T4; the kit's clean phases) */
export const SOLID_KNOTS: readonly (readonly [number, number])[] = [
  [0, 0.04],
  [0.26, 0.12],
  [0.36, 0.36],
  [0.46, 0.5],
  [0.56, 0.72],
  [0.62, 0.78],
]
/** the rounded pull: the set-up held, then a pull that barely lifts the ball, frozen there */
export const GHOST_KNOTS: readonly (readonly [number, number])[] = [
  [0, 0.04],
  [0.58, 0.12],
  [0.8, 0.175],
]
export const ghostRound = (T: number) => up(T, B.deviation, 0.6, 0.72)
export const hipArc = (T: number) => up(T, B.deviation, 0.26, 0.36, ease.draw)
export const hipArcOn = (T: number) => fall(T, B.deviation, 0.46, 0.52)
export const popName = (T: number) => up(T, B.deviation, 0.3, 0.33) * fall(T, B.deviation, 0.46, 0.5)
export const underName = (T: number) => up(T, B.deviation, 0.4, 0.43) * fall(T, B.deviation, 0.56, 0.6)
export const roundedName = (T: number) => up(T, B.deviation, 0.7, 0.73) * fall(T, B.charter, 0, 0.06)
export const goodForm = (T: number) => up(T, B.deviation, 0.82, 0.88) * fall(T, B.charter, 0, 0.06)

/* ---------------------------- T5 charter ------------------------------ */

export const chTime = (T: number) => up(T, B.charter, 0, 0.08, ease.draw)
export const chLoad = (T: number) => up(T, B.charter, 0.08, 0.16, ease.draw)
export const chTimeName = (T: number) => up(T, B.charter, 0.06, 0.1)
export const chLoadName = (T: number) => up(T, B.charter, 0.14, 0.18)
export const bandIn = (T: number, i: number) => up(T, B.charter, [0.16, 0.34, 0.5][i], [0.24, 0.42, 0.58][i])
export const bandName = (T: number, i: number) => up(T, B.charter, [0.18, 0.36, 0.52][i], [0.22, 0.4, 0.56][i])
/** the amber line's three parts: across MECHANICS, across CONSISTENCY, the ratchet in INTENSITY */
export const amber = (T: number, i: number) => up(T, B.charter, [0.2, 0.36, 0.52][i], [0.34, 0.5, 0.7][i], i === 2 ? ease.linear : ease.draw)
export const onlyThen = (T: number) => up(T, B.charter, 0.56, 0.6)
export const skipDraw = (T: number) => up(T, B.charter, 0.72, 0.9, ease.draw)
export const riskName = (T: number) => up(T, B.charter, 0.84, 0.88)
export const charterOut = (T: number) => fall(T, B.odds, 0, 0.12)

/* ----------------------------- T6 to T8 plane ------------------------- */

/** the plane: drawn in T6, FLIPped beside the athlete in T7, the worked example's stage in T8, gone in T9 */
export const planeAxes = (T: number) => up(T, B.odds, 0.02, 0.16, ease.draw)
export const planeTitles = (T: number) => up(T, B.odds, 0.12, 0.18) * fall(T, B.everything, 0, 0.1)
export const planeFlip = (T: number) => up(T, B.threshold, 0, 0.14, ease.morph)
export const planeOut = (T: number) => fall(T, B.everything, 0, 0.12)
export const targetDraw = (T: number) => up(T, B.odds, 0.16, 0.26, ease.draw)
export const targetName = (T: number) => up(T, B.odds, 0.22, 0.26) * fall(T, B.threshold, 0, 0.08)
/** the target ring rests at 40% under the threshold beats */
export const targetDim = (T: number) => 1 - 0.6 * up(T, B.threshold, 0, 0.14)
export const p1Snap = (T: number) => up(T, B.odds, 0.26, 0.32, ease.snap)
export const p1Name = (T: number) => up(T, B.odds, 0.3, 0.34)
export const p2Snap = (T: number) => up(T, B.odds, 0.44, 0.5, ease.snap)
export const p2Name = (T: number) => up(T, B.odds, 0.48, 0.52)
export const eitherDraw = (T: number) => up(T, B.odds, 0.62, 0.74, ease.draw)
export const eitherName = (T: number) => up(T, B.odds, 0.7, 0.74) * fall(T, B.odds, 0.8, 0.86)
export const eitherDim = (T: number) => 1 - 0.85 * up(T, B.odds, 0.8, 0.88)
export const illusion = (T: number) => up(T, B.odds, 0.86, 0.92)
/** T7 clears T6's examples */
export const examplesOut = (T: number) => fall(T, B.threshold, 0, 0.08)

/* ---------------------------- T7 threshold ---------------------------- */

/** the pen's windows along the learning path, one per segment (STORYBOARD-technique T7) */
export const PATH_T: readonly (readonly [number, number])[] = [
  [0.14, 0.24],
  [0.24, 0.34],
  [0.34, 0.46],
  [0.46, 0.6],
  [0.6, 0.74],
  [0.74, 0.82],
]
export const athleteIn = (T: number) => up(T, B.threshold, 0.04, 0.16) * fall(T, B.everything, 0, 0.12)
export const fallingName = (T: number) => up(T, B.threshold, 0.28, 0.31) * fall(T, B.margin, 0, 0.06)
export const fixName = (T: number) => up(T, B.threshold, 0.4, 0.43) * fall(T, B.margin, 0, 0.06)
export const pathBright = (T: number) => up(T, B.threshold, 0.82, 0.9) * fall(T, B.margin, 0, 0.12)
export const thresholdName = (T: number) => up(T, B.threshold, 0.86, 0.9) * fall(T, B.margin, 0, 0.06)
/** T8: T7's path rests at 20% as the trace under the worked example */
export const traceDim = (T: number) => 1 - 0.8 * up(T, B.margin, 0, 0.12)

/* ----------------------------- T8 margin ------------------------------ */

export const unitSwap = (T: number) => up(T, B.margin, 0.02, 0.1)
export const speedTicks = (T: number, i: number) => up(T, B.margin, 0.04 + 0.03 * i, 0.08 + 0.03 * i)
export const d10Snap = (T: number) => up(T, B.margin, 0.12, 0.18, ease.snap)
export const perfectFlash = (T: number) => pulse(T, B.margin + 0.13, B.margin + 0.23)
export const d12Snap = (T: number) => up(T, B.margin, 0.26, 0.32, ease.snap)
export const fallsName = (T: number) => up(T, B.margin, 0.28, 0.32) * fall(T, B.margin, 0.4, 0.41)
export const marginRise = (T: number) => up(T, B.margin, 0.28, 0.36, ease.draw)
export const marginName = (T: number) => up(T, B.margin, 0.34, 0.38)
export const bandFill = (T: number) => up(T, B.margin, 0.34, 0.44, ease.settle)
export const fixFormName = (T: number) => up(T, B.margin, 0.38, 0.42) * fall(T, B.margin, 0.72, 0.78)
/** d12 rises as the form is fixed at 12,000 (lumbar back to lime) */
export const d12Rise = (T: number) => up(T, B.margin, 0.4, 0.52, ease.settle)
export const greatName = (T: number) => up(T, B.margin, 0.41, 0.45) * fall(T, B.margin, 0.72, 0.78)
export const d14Snap = (T: number) => up(T, B.margin, 0.58, 0.64, ease.snap)
export const suffersName = (T: number) => up(T, B.margin, 0.6, 0.64) * fall(T, B.margin, 0.72, 0.78)
export const marginGlide1 = (T: number) => up(T, B.margin, 0.56, 0.66, ease.morph)
export const d14Rise = (T: number) => up(T, B.margin, 0.7, 0.78, ease.settle)
export const marginGlide2 = (T: number) => up(T, B.margin, 0.8, 0.92, ease.morph)
export const marginHead = (T: number) => up(T, B.margin, 0.84, 0.92)
export const advanceName = (T: number) => up(T, B.margin, 0.86, 0.92)
/** T8's own fades in T9 */
export const marginOut = (T: number) => fall(T, B.everything, 0, 0.12)

/* --------------------------- T9 everything ---------------------------- */

export const legendOn = (T: number, i: number) => up(T, B.everything, 0.58 + 0.07 * i, 0.62 + 0.07 * i)
export const claimSettle = (T: number) => up(T, B.everything, 0.8, 1, ease.settle)
