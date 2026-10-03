import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { frameId } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { impactK } from '../../story/kit/impact'
import { focusRect } from '../../story/camera/focusRect'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { useQAProbe } from '../../story/qa'
import type { LabelSpec } from '../../story/types'
import { headSegs, mix, seg } from './geom'
import {
  EITHER,
  FULL,
  P1,
  P2,
  PAD,
  PAST_PU,
  PATH,
  PERFECT_PV,
  PLANE,
  SPEED_PU,
  TARGET,
  TARGET_R,
  isStacked,
  mixRect,
  planeRect,
  planeUV,
  unitsPerPx,
  type Rect,
} from './layout'
import { PATH_CUM, d12pv, d14pv, pathProgress } from './techniqueMath'
import {
  B,
  advanceName,
  bandFill,
  d10Snap,
  d12Rise,
  d12Snap,
  d14Rise,
  d14Snap,
  eitherDim,
  eitherDraw,
  eitherName,
  examplesOut,
  fallingName,
  fallsName,
  fixFormName,
  fixName,
  greatName,
  illusion,
  live,
  marginGlide1,
  marginGlide2,
  marginHead,
  marginName,
  marginOut,
  marginRise,
  p1Name,
  p1Snap,
  p2Name,
  p2Snap,
  pathBright,
  perfectFlash,
  planeAxes,
  planeFlip,
  planeOut,
  planeTitles,
  speedTicks,
  suffersName,
  targetDim,
  targetDraw,
  targetName,
  thresholdName,
  traceDim,
  unitSwap,
} from './timeline'

/* =========================================================================
   T6 to T8, the plane: SPEED across, TECHNIQUE up (perfect at the top).
   T6 "Not at odds" (p. 43): the target is accurate AND quick; a perfect
   typist at 20 words a minute and a perfect Fran in 32 minutes sit top left,
   worthless; the either-or line drawn between them and the target is an
   illusion. T7 "Threshold training" (pp. 43-44): the plane moves beside the
   athlete and a learning path is drawn: faster while it looks good, falling
   apart, fixed at that speed, again. T8 "Advance the margin" (p. 44, the
   signature beat): the same path in the article's own numbers, 10,000,
   12,000 and 14,000 ft-lb per minute, with the margin moving on past the
   last one. Positions are plane coordinates (pu, pv) mapped through the
   plane's container rect, which FLIPs from the whole frame (T6) to its
   place beside the athlete (T7, T8, explore).
   ========================================================================= */

const CHALK = PAL.chalk
const LIME = PAL.yellowGreen
const AMBER = PAL.both
const RED = PAL.sick

/** The plane's container rect at T (a shared object). */
const _r: Rect = { ...FULL }
function planeAt(T: number, stacked: boolean, explore = false): Rect {
  if (explore) return mixRect(FULL, planeRect(stacked), 1, _r)
  return mixRect(FULL, planeRect(stacked), T < B.threshold ? 0 : planeFlip(T), _r)
}

/** The path's point colours: amber while it speeds up on good form, red as it drops, lime as it rises. */
function pathColors(): Float32Array {
  const c = new Float32Array(PATH.length * 3)
  const col = (hex: string) => new THREE.Color(hex)
  const at = [AMBER, AMBER, RED, LIME, RED, LIME, AMBER].map(col)
  at.forEach((k, i) => c.set([k.r, k.g, k.b], i * 3))
  return c
}

export function Plane({ f, explore = false }: { f: ChartFrame; explore?: boolean }) {
  const x = f.x
  const y = f.y
  const stacked = isStacked(f)
  const upx = unitsPerPx(f)
  const fid = () => frameId(f)
  const uv: [number, number] = [0, 0]
  /** plane (a, b) at T into world */
  const W = (T: number, a: number, b: number, out: [number, number, number], z = 0): [number, number, number] => {
    planeUV(planeAt(T, stacked, explore), a, b, uv)
    out[0] = x(uv[0])
    out[1] = y(uv[1])
    out[2] = z
    return out
  }
  const flipKey = (T: number) => (explore ? 1 : T < B.threshold ? 0 : planeFlip(T))
  /** the plane's on-screen share (its container rect's height): rings and heads scale with it */
  const scaleAt = (T: number) => {
    const r = planeAt(T, stacked, explore)
    return r.v1 - r.v0
  }
  const on = explore ? () => 1 : (T: number) => live(T, B.odds, B.everything + 0.12) * planeOut(T)
  const tmp = useMemo<[number, number, number]>(() => [0, 0, 0], [])

  /* ------------------------ axes (one L stroke) ------------------------ */
  const axes = useMemo(() => new Float32Array(2 * 6), [])
  const lastAx = useRef('')
  const writeAxes = (T: number, s: Float32Array): boolean => {
    const key = fid() + '|' + flipKey(T).toFixed(5)
    if (key === lastAx.current) return false
    lastAx.current = key
    const top = W(T, 0, 1.02, tmp)
    const t0x = top[0]
    const t0y = top[1]
    const o = W(T, 0, 0, tmp)
    const ox = o[0]
    const oy = o[1]
    const e = W(T, 1.02, 0, tmp)
    seg(s, 0, t0x, t0y, ox, oy)
    seg(s, 1, ox, oy, e[0], e[1])
    return true
  }
  // the tick marks: PERFECT on the TECHNIQUE axis; T8's three speeds on the SPEED axis
  const perfectTick = useMemo(() => new Float32Array(6), [])
  const speedTickSegs = useMemo(() => new Float32Array(3 * 6), [])
  const lastTk = useRef('')
  const lastSk = useRef('')
  const writePerfect = (T: number, s: Float32Array): boolean => {
    const key = fid() + '|' + flipKey(T).toFixed(5)
    if (key === lastTk.current) return false
    lastTk.current = key
    const p = W(T, 0, PERFECT_PV, tmp)
    seg(s, 0, p[0] - 6 * upx, p[1], p[0], p[1])
    return true
  }
  const writeSpeeds = (T: number, s: Float32Array): boolean => {
    const key = fid() + '|' + flipKey(T).toFixed(5)
    if (key === lastSk.current) return false
    lastSk.current = key
    for (let i = 0; i < 3; i++) {
      const q = W(T, SPEED_PU[i], 0, tmp)
      seg(s, i, q[0], q[1], q[0], q[1] - 6 * upx)
    }
    return true
  }

  /* ------------------------------ target ------------------------------ */
  const N_RING = 48
  const ring = useMemo(() => new Float32Array((N_RING + 1) * 3), [])
  const lastRing = useRef('')
  const writeRing = (T: number, p: Float32Array): boolean => {
    const key = fid() + '|' + flipKey(T).toFixed(5)
    if (key === lastRing.current) return false
    lastRing.current = key
    const c = W(T, TARGET[0], TARGET[1], tmp)
    const r = TARGET_R * f.FH * scaleAt(T)
    for (let i = 0; i <= N_RING; i++) {
      const a = Math.PI / 2 - (i / N_RING) * Math.PI * 2
      p[i * 3] = c[0] + Math.cos(a) * r
      p[i * 3 + 1] = c[1] + Math.sin(a) * r
      p[i * 3 + 2] = 0.02
    }
    return true
  }

  /* --------------------------- the either-or -------------------------- */
  const either = useMemo(() => new Float32Array(2 * 3), [])
  const lastE = useRef('')
  const writeEither = (T: number, p: Float32Array): boolean => {
    const key = fid() + '|' + flipKey(T).toFixed(5)
    if (key === lastE.current) return false
    lastE.current = key
    const a = W(T, EITHER[0], EITHER[1], tmp)
    p[0] = a[0]
    p[1] = a[1]
    p[2] = 0.01
    const b = W(T, EITHER[2], EITHER[3], tmp)
    p[3] = b[0]
    p[4] = b[1]
    p[5] = 0.01
    return true
  }

  /* --------------------------- T7 the path ---------------------------- */
  const path = useMemo(() => new Float32Array(PATH.length * 3), [])
  const colors = useMemo(() => pathColors(), [])
  const lastP = useRef('')
  const writePath = (T: number, p: Float32Array): boolean => {
    const key = fid() + '|' + flipKey(T).toFixed(5)
    if (key === lastP.current) return false
    lastP.current = key
    PATH.forEach(([a, b], i) => {
      W(T, a, b, tmp, 0.03)
      p[i * 3] = tmp[0]
      p[i * 3 + 1] = tmp[1]
      p[i * 3 + 2] = 0.03
    })
    return true
  }
  const pathVis = (T: number) => (explore ? 0 : on(T) * (T >= B.threshold ? 1 : 0))

  /* -------------------------- T8 the example -------------------------- */
  const t8on = explore ? () => 0 : (T: number) => on(T) * (T >= B.margin ? 1 : 0) * marginOut(T)
  // the band where form is fixed: pu 0.30 to 0.54, lime hatch
  const bandTop = useMemo(() => new Float32Array(2 * 2), [])
  const lastB = useRef('')
  const writeBand = (T: number, top: Float32Array): boolean => {
    const key = fid() + '|' + flipKey(T).toFixed(5)
    if (key === lastB.current) return false
    lastB.current = key
    const a = W(T, SPEED_PU[0], 0.97, tmp)
    top[0] = a[0]
    top[1] = a[1]
    const b = W(T, SPEED_PU[1], 0.97, tmp)
    top[2] = b[0]
    top[3] = b[1]
    return true
  }
  const bandBase = useMemo(() => {
    planeUV(planeRect(stacked), 0, 0, uv)
    return y(uv[1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, stacked])
  /** the margin's pu at T: 0.54 (12,000), gliding to 0.78 (14,000), then past it */
  const marginPu = (T: number) => mix(mix(SPEED_PU[1], SPEED_PU[2], marginGlide1(T)), PAST_PU, marginGlide2(T))
  const marginPts = useMemo(() => new Float32Array(2 * 3), [])
  const lastM = useRef('')
  const writeMargin = (T: number, p: Float32Array): boolean => {
    const pu = marginPu(T)
    const key = fid() + '|' + flipKey(T).toFixed(5) + '|' + pu.toFixed(5)
    if (key === lastM.current) return false
    lastM.current = key
    W(T, pu, 0, tmp, 0.04)
    p[0] = tmp[0]
    p[1] = tmp[1]
    p[2] = 0.04
    W(T, pu, 0.98, tmp, 0.04)
    p[3] = tmp[0]
    p[4] = tmp[1]
    p[5] = 0.04
    return true
  }
  // its head: a chevron pointing on (+x), at the top
  const headPts = useMemo(() => new Float32Array(2 * 6), [])
  const lastH = useRef('')
  const writeHead = (T: number, s: Float32Array): boolean => {
    const pu = marginPu(T)
    const key = fid() + '|' + flipKey(T).toFixed(5) + '|' + pu.toFixed(5)
    if (key === lastH.current) return false
    lastH.current = key
    W(T, pu, 0.98, tmp, 0.04)
    headSegs(s, 0, tmp[0] - 1, tmp[1], tmp[0] + 9 * upx, tmp[1], 9 * upx, 40, 0.04)
    return true
  }

  /* ------------------------------ labels ------------------------------ */
  const labels = useMemo<LabelSpec[]>(() => {
    if (explore) return []
    const a = (pu: number, pv: number, z = 0) => {
      const o: [number, number, number] = [0, 0, 0]
      return (T: number) => W(T, pu, pv, o, z)
    }
    const titles = (T: number) => planeTitles(T) * on(T)
    // the three speed ticks: on a narrow plane the middle one drops a row so they never touch
    const plotPx = (() => {
      const r = planeRect(stacked)
      const wpx = (focusRect.w - PAD.l - PAD.r) * (r.u1 - r.u0) * (PLANE.u1 - PLANE.u0)
      return wpx
    })()
    const stagger = plotPx * (SPEED_PU[1] - SPEED_PU[0]) < 58
    const tickGap = (i: number) => (stagger && i === 1 ? 20 : 6)
    const d12: [number, number, number] = [0, 0, 0]
    const d14: [number, number, number] = [0, 0, 0]
    const marginTop: [number, number, number] = [0, 0, 0]
    return [
      { id: 'tq-p-speed', text: 'SPEED', tone: 'tick', anchor: a(1.02, 0), prefer: 'SW', only: ['SW', 'S'], gapPx: 6, priority: 84, cue: (T) => titles(T) * (1 - unitSwap(T)) },
      {
        id: 'tq-p-unit',
        text: 'FT-LB PER MINUTE',
        tone: 'tick',
        required: true,
        anchor: a(1.02, 0),
        prefer: 'SW',
        only: ['SW', 'S'],
        gapPx: stagger ? 46 : 34,
        priority: 84,
        cue: (T) => (T >= B.margin ? unitSwap(T) * on(T) * marginOut(T) : 0),
      },
      { id: 'tq-p-tech', text: 'TECHNIQUE', tone: 'tick', anchor: a(0, 1.02), prefer: 'E', only: ['E', 'NE'], gapPx: 6, priority: 84, cue: titles },
      { id: 'tq-p-perfect', text: 'PERFECT', tone: 'tick', anchor: a(0, PERFECT_PV), prefer: 'W', only: ['W', 'NW', 'SW'], gapPx: 10, priority: 85, cue: titles },
      // T6
      {
        id: 'tq-p-target',
        text: 'ACCURATE AND QUICK',
        tone: 'name',
        color: LIME,
        anchor: a(TARGET[0], TARGET[1]),
        prefer: 'S',
        only: ['S', 'SW', 'W'],
        gapPx: 14,
        priority: 82,
        cue: (T) => targetName(T) * on(T),
      },
      { id: 'tq-p-p1', text: '20 WORDS A MINUTE', short: '20 WORDS/MIN', tone: 'name', color: CHALK, anchor: a(P1[0], P1[1]), prefer: 'E', only: ['E', 'NE'], gapPx: 8, priority: 80, cue: (T) => p1Name(T) * on(T) * examplesOut(T) },
      { id: 'tq-p-p2', text: 'FRAN IN 32 MINUTES', short: 'FRAN, 32 MIN', tone: 'name', color: CHALK, anchor: a(P2[0], P2[1]), prefer: 'E', only: ['E', 'SE'], gapPx: 8, priority: 79, cue: (T) => p2Name(T) * on(T) * examplesOut(T) },
      {
        id: 'tq-p-either',
        text: 'GOOD FORM OR QUICKLY?',
        tone: 'tick',
        anchor: a((EITHER[0] + EITHER[2]) / 2, (EITHER[1] + EITHER[3]) / 2),
        prefer: 'NE',
        only: ['NE', 'E', 'SW'],
        gapPx: 6,
        priority: 70,
        cue: (T) => eitherName(T) * on(T) * examplesOut(T),
      },
      {
        id: 'tq-p-illusion',
        text: 'AN ILLUSION',
        tone: 'callout',
        color: LIME,
        required: true,
        anchor: a((EITHER[0] + EITHER[2]) / 2, (EITHER[1] + EITHER[3]) / 2, 0.05),
        prefer: 'C',
        priority: 96,
        cue: (T) => illusion(T) * on(T) * examplesOut(T),
      },
      // T7
      { id: 'tq-p-falling', text: 'FALLING APART', tone: 'name', color: RED, anchor: a(PATH[2][0], PATH[2][1]), prefer: 'S', only: ['S', 'SW', 'SE'], gapPx: 10, priority: 84, cue: (T) => fallingName(T) * on(T) },
      // the fix is at the same speed: named under the dip it rises from, below FALLING APART
      { id: 'tq-p-fix', text: 'FIX IT AT THAT SPEED', tone: 'name', color: LIME, anchor: a(PATH[2][0], PATH[2][1]), prefer: 'S', only: ['S', 'SE', 'SW'], gapPx: 30, priority: 83, cue: (T) => fixName(T) * on(T) },
      {
        id: 'tq-p-threshold',
        text: 'THRESHOLD TRAINING',
        tone: 'callout',
        color: LIME,
        required: true,
        anchor: a(0.62, 0.13, 0.05),
        prefer: 'C',
        priority: 96,
        cue: (T) => thresholdName(T) * on(T),
      },
      // T8: the article's three numbers under T7's corners
      ...[0, 1, 2].map(
        (i): LabelSpec => ({
          id: `tq-p-k${i}`,
          text: ['10,000', '12,000', '14,000'][i],
          tone: 'tick',
          required: true,
          anchor: a(SPEED_PU[i], 0),
          prefer: 'S',
          only: ['S'],
          gapPx: tickGap(i),
          sepPx: 3,
          priority: 90,
          cue: (T) => (T >= B.margin ? speedTicks(T, i) * on(T) * marginOut(T) : 0),
        }),
      ),
      {
        id: 'tq-p-falls',
        text: 'FALLS APART',
        tone: 'name',
        color: RED,
        anchor: (T) => W(T, SPEED_PU[1], d12pv(T), d12),
        prefer: 'E',
        only: ['E', 'SE', 'NE'],
        gapPx: 10,
        priority: 86,
        cue: (T) => fallsName(T) * t8on(T),
      },
      {
        id: 'tq-p-great',
        text: 'GREAT',
        tone: 'name',
        color: LIME,
        anchor: (T) => W(T, SPEED_PU[1], d12pv(T), d12),
        prefer: 'NE',
        only: ['NE', 'E', 'N'],
        gapPx: 9,
        priority: 86,
        cue: (T) => greatName(T) * t8on(T),
      },
      {
        id: 'tq-p-suffers',
        text: 'SUFFERS',
        tone: 'name',
        color: RED,
        anchor: (T) => W(T, SPEED_PU[2], d14pv(T), d14),
        prefer: 'E',
        only: ['E', 'SE', 'S'],
        gapPx: 10,
        priority: 86,
        cue: (T) => suffersName(T) * t8on(T),
      },
      {
        id: 'tq-p-fixform',
        text: 'FIX THE FORM',
        tone: 'tick',
        anchor: a((SPEED_PU[0] + SPEED_PU[1]) / 2, 0.3),
        prefer: 'C',
        priority: 72,
        cue: (T) => fixFormName(T) * t8on(T),
      },
      {
        id: 'tq-p-margin',
        text: 'MARGIN',
        tone: 'name',
        color: LIME,
        required: true,
        anchor: (T) => W(T, marginPu(T), 0.98, marginTop),
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 8,
        priority: 97,
        cue: (T) => marginName(T) * t8on(T),
      },
      {
        id: 'tq-p-advance',
        text: 'ADVANCE THE MARGIN',
        tone: 'callout',
        color: LIME,
        required: true,
        anchor: a(0.6, 0.24, 0.05),
        prefer: 'C',
        priority: 96,
        cue: (T) => advanceName(T) * t8on(T),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, stacked, explore])
  useLabels(labels)

  // labels keep off the path, the dots and the margin line
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        if (explore || !on(T) || T < B.odds) return 0
        let n = 0
        const put = (p: [number, number, number]) => {
          out[n * 3] = p[0]
          out[n * 3 + 1] = p[1]
          out[n * 3 + 2] = 0
          n++
        }
        if (T < B.threshold + 0.08) {
          if (p1Snap(T) > 0) put(W(T, P1[0], P1[1], tmp))
          if (p2Snap(T) > 0) put(W(T, P2[0], P2[1], tmp))
          if (eitherDraw(T) > 0) for (let i = 0; i <= 10; i++) put(W(T, mix(EITHER[0], EITHER[2], i / 10), mix(EITHER[1], EITHER[3], i / 10), tmp))
        }
        if (T >= B.threshold + 0.14) {
          for (let s = 0; s < PATH.length - 1; s++) for (let k = 0; k < 4; k++) put(W(T, mix(PATH[s][0], PATH[s + 1][0], k / 4), mix(PATH[s][1], PATH[s + 1][1], k / 4), tmp))
        }
        if (T >= B.margin + 0.28) {
          const pu = marginPu(T)
          for (let k = 0; k <= 6; k++) put(W(T, pu, (0.98 * k) / 6, tmp))
        }
        return n
      },
      maxPoints: 64,
      radiusPx: 6,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f, stacked, explore],
  )
  useWorldObstacle('tq-plane', obstacle)

  useQAProbe(explore ? 'tq-path-explore' : 'tq-path', () => ({ cum: PATH_CUM, progressEnd: pathProgress(B.threshold + 1) }))

  const dotR = Math.min(0.24, 6 * upx)
  return (
    <>
      <PenBatch segments={axes} color={CHALK} width={PEN.axis} byArc head hot progress={explore ? () => 1 : planeAxes} update={writeAxes} dim={() => 0.6} opacity={on} renderOrder={30} />
      <PenBatch segments={perfectTick} color={CHALK} width={PEN.axis} update={writePerfect} dim={() => 0.6} opacity={(T) => on(T) * (explore ? 1 : planeTitles(T))} renderOrder={30} />
      <PenBatch segments={speedTickSegs} color={CHALK} width={PEN.axis} update={writeSpeeds} dim={() => 0.6} opacity={(T) => (explore ? 1 : T >= B.margin ? on(T) * speedTicks(T, 0) * marginOut(T) : 0)} renderOrder={30} />
      {/* T6: the target (accurate and quick); it rests at 40% under the threshold beats */}
      <Pen points={ring} color={LIME} width={PEN.data} head hot progress={explore ? () => 1 : targetDraw} update={writeRing} dim={explore ? () => 0.4 : targetDim} opacity={on} renderOrder={34} />
      {/* T6: the two perfect-but-slow examples and the either-or line */}
      <Nodes
        count={2}
        radius={dotR}
        color={CHALK}
        place={(T, i, out) => {
          if (explore || !on(T)) return 0
          const k = i === 0 ? p1Snap(T) : p2Snap(T)
          if (k <= 0) return 0
          W(T, i === 0 ? P1[0] : P2[0], i === 0 ? P1[1] : P2[1], out, 0.05)
          return k * examplesOut(T)
        }}
      />
      <Pen points={either} color={CHALK} width={PEN.axis} dashed dashSize={0.2} gapSize={0.15} progress={eitherDraw} update={writeEither} dim={eitherDim} opacity={(T) => (explore ? 0 : on(T) * examplesOut(T))} renderOrder={31} />

      {/* T7: the learning path (amber faster, red falling apart, lime fixed), drawn by a hot pen; T8's faint trace */}
      <Pen
        points={path}
        pointColors={colors}
        width={PEN.data}
        head
        hot
        progress={pathProgress}
        update={writePath}
        dim={traceDim}
        gain={(T) => 1 + 0.5 * pathBright(T)}
        opacity={pathVis}
        renderOrder={44}
      />

      {/* T8: the band where the form is fixed, the margin line and its head, the three dots */}
      <AreaFill top={bandTop} baseline={bandBase} color={LIME} mode="hatch" hi={0.2} update={writeBand} reveal={bandFill} opacity={(T) => (bandFill(T) > 0.001 ? t8on(T) : 0)} renderOrder={11} />
      <Pen
        points={marginPts}
        color={LIME}
        width={PEN.data}
        head
        progress={marginRise}
        update={writeMargin}
        gain={(T) => 1 + 1.2 * impactK(T)}
        opacity={t8on}
        renderOrder={45}
      />
      <PenBatch segments={headPts} color={LIME} width={PEN.data} update={writeHead} gain={(T) => 1 + 1.2 * impactK(T)} opacity={(T) => t8on(T) * marginHead(T)} renderOrder={45} />
      <Glows
        count={1}
        sizePx={40}
        colors={[LIME]}
        gain={1.8}
        place={(T, _i, out) => {
          if (explore || T < B.margin) return 0
          W(T, marginPu(T), 0.98, out, 0.06)
          return impactK(T) * t8on(T)
        }}
      />
      {/* lime: d10 (perfect), d12 and d14 once fixed; red: d12 and d14 while they fall apart */}
      <Nodes
        count={3}
        radius={dotR}
        color={LIME}
        place={(T, i, out) => {
          if (explore || T < B.margin) return 0
          const k = i === 0 ? d10Snap(T) : i === 1 ? d12Rise(T) : d14Rise(T)
          if (k <= 0) return 0
          W(T, SPEED_PU[i], i === 0 ? PERFECT_PV : i === 1 ? d12pv(T) : d14pv(T), out, 0.06)
          return k * t8on(T)
        }}
      />
      <Nodes
        count={2}
        radius={dotR}
        color={RED}
        place={(T, i, out) => {
          if (explore || T < B.margin) return 0
          const snap = i === 0 ? d12Snap(T) : d14Snap(T)
          const rise = i === 0 ? d12Rise(T) : d14Rise(T)
          if (snap <= 0) return 0
          W(T, SPEED_PU[i + 1], i === 0 ? d12pv(T) : d14pv(T), out, 0.05)
          return snap * (1 - rise) * t8on(T)
        }}
      />
      {/* PERFECT flashes as d10 lands */}
      <Glows
        count={1}
        sizePx={30}
        colors={[LIME]}
        gain={1}
        place={(T, _i, out) => {
          if (explore || T < B.margin) return 0
          W(T, 0, PERFECT_PV, out, 0.05)
          return perfectFlash(T) * t8on(T)
        }}
      />
    </>
  )
}
