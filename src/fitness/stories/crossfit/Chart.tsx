import { useMemo, useRef } from 'react'
import { PAL } from '../../fitnessData'
import { at } from '../../story/cue'
import { frameId, type ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { Glows } from '../../story/kit/Halo'
import { impactK } from '../../story/kit/impact'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { useCounter } from '../../story/kit/counter'
import { useQAProbe } from '../../story/qa'
import type { LabelSpec } from '../../story/types'
import {
  AREA,
  BAND_HI,
  BAND_LO,
  MILES_MAX,
  POWER_A,
  POWER_B,
  T_MAX,
  U_A,
  U_B,
  V_A,
  WIDE_HI,
  WIDE_LO,
  capacityAt,
  fmtThousands,
  vOf,
} from './crossfitMath'
import { LIGHT } from './Figures'
import {
  B,
  axesDraw,
  bandIn,
  chartOut,
  claimBroad,
  claimPower,
  clockA,
  curveDraw,

  franOut,
  ghostA,
  squeeze,
  titlesSwap,
  weakIn,
  widen,
  workName,
} from './timeline'
import { ATTEMPT_A, ATTEMPT_B, FRAN_WORK } from './crossfitMath'

/* =========================================================================
   C3 "Intensity is power" and C4 "Routine is the enemy" (STORYBOARD-crossfit.md):
   one front-on chart. C3 plots power against time, so WORK is an AREA: the
   first Fran (4:30) grows behind a running clock; then the same light is
   squeezed into 2:45 at constant area and rises: same work, more power. C4
   keeps the axes, re-titled: a band of exposure (5 to 7 miles) and the
   capacity it builds, weak at both margins, then the band widens across the
   axis and the capacity broadens with it.
   ========================================================================= */

const N_CURVE = 64

/** One reused result (nothing allocates per frame): read it at once, never keep it. */
const _block = { u: U_A, v: V_A }
/** The resting block (attempt 1), for anchors outside the block's life. */
const BLOCK_REST = { u: U_A, v: V_A } as const

/** The Fran block's width (u) and height (v) at T: the clock, then the squeeze at constant area. */
export function blockAt(T: number): { u: number; v: number } | null {
  if (T < B.power + 0.2 || T >= B.vary + 0.2) return null
  const s = squeeze(T)
  if (s > 0) {
    _block.u = U_A + (U_B - U_A) * s
    _block.v = vOf(_block.u)
    return _block
  }
  _block.u = Math.max(0.0005, U_A * clockA(T))
  _block.v = V_A
  return _block
}

/** The power the HUD shows at T (ft-lb/min, rounded as the table prints it). */
export function hudPower(T: number): number {
  const b = blockAt(T)
  if (!b) return POWER_B
  if (squeeze(T) <= 0) return POWER_A
  if (squeeze(T) >= 1) return POWER_B
  return Math.round(FRAN_WORK / (b.u * T_MAX))
}
export const hudOn = (T: number) => at(T, B.power, 0.42, 0.5) * franOut(T)

/** The clock under the block's moving edge: 0:00 to 4:30 as attempt 1 runs, then 4:30 down to 2:45. */
export const clockOn = (T: number) => at(T, B.power, 0.2, 0.24) * (1 - at(T, B.power, 0.8, 0.86))
export function clockMinutes(T: number): number {
  const b = blockAt(T)
  return b ? b.u * T_MAX : 0
}
const fmtClock = (min: number) => {
  const s = Math.round(min * 60)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const _band: [number, number] = [BAND_LO, BAND_HI]
/** C4 exposure band [lo, hi] in miles at T (one reused pair) */
export function bandAt(T: number): [number, number] {
  const k = widen(T)
  _band[0] = BAND_LO + (WIDE_LO - BAND_LO) * k
  _band[1] = BAND_HI + (WIDE_HI - BAND_HI) * k
  return _band
}

export function Chart({ frame }: { frame: ChartFrame }) {
  const x = frame.x
  const y = frame.y
  const fid = frameId(frame)
  const chartLive = (T: number) => (T >= B.power && T < B.pyr + 0.14 ? 1 : 0)

  /* ---------------- construction: one hot L stroke ------------------ */
  const axes = useMemo(
    () =>
      new Float32Array([
        x(0), y(frame.vMax * 0.98), 0, x(0), y(0), 0,
        x(0), y(0), 0, x(1.02), y(0), 0,
      ]),
    [frame, x, y],
  )
  // tick marks at 2:45 and 4:30 (C3) and at 5 and 7 miles (C4)
  const TL = frame.FH * 0.025
  const tickA = useMemo(() => new Float32Array([x(U_A), y(0), 0, x(U_A), y(0) - TL, 0]), [x, y, TL])
  const tickB = useMemo(() => new Float32Array([x(U_B), y(0), 0, x(U_B), y(0) - TL, 0]), [x, y, TL])
  const ticks4 = useMemo(
    () => new Float32Array([x(BAND_LO / MILES_MAX), y(0), 0, x(BAND_LO / MILES_MAX), y(0) - TL, 0, x(BAND_HI / MILES_MAX), y(0), 0, x(BAND_HI / MILES_MAX), y(0) - TL, 0]),
    [x, y, TL],
  )

  /* -------------------------- C3 Fran block -------------------------- */
  const blockTop = useMemo(() => new Float32Array([x(0), y(V_A), x(U_A), y(V_A)]), [x, y])
  const lastB = useRef('')
  const writeBlock = (T: number, top: Float32Array): boolean => {
    const b = blockAt(T)
    const key = fid + '|' + (b ? b.u.toFixed(5) : 'x')
    if (key === lastB.current) return false
    lastB.current = key
    const u = b ? b.u : U_A
    const v = b ? b.v : V_A
    top[0] = x(0)
    top[1] = y(v)
    top[2] = x(u)
    top[3] = y(v)
    return true
  }
  // the block's live edge: down from the top-left corner along the top and down the right side (the clock)
  const edgePts = useMemo(() => new Float32Array(3 * 3), [])
  const lastE = useRef('')
  const writeEdge = (T: number, p: Float32Array): boolean => {
    const b = blockAt(T)
    const key = fid + '|' + (b ? b.u.toFixed(5) : 'x')
    if (key === lastE.current) return false
    lastE.current = key
    const u = b ? b.u : U_A
    const v = b ? b.v : V_A
    p[0] = x(0)
    p[1] = y(v)
    p[2] = 0.03
    p[3] = x(u)
    p[4] = y(v)
    p[5] = 0.03
    p[6] = x(u)
    p[7] = y(0)
    p[8] = 0.03
    return true
  }
  const ghostPts = useMemo(() => new Float32Array([x(0), y(V_A), 0.02, x(U_A), y(V_A), 0.02, x(U_A), y(0), 0.02]), [x, y])
  const blockVis = (T: number) => (blockAt(T) ? franOut(T) : 0)
  const squeezing = (T: number) => squeeze(T) > 0 && squeeze(T) < 1

  /* -------------------------- C4 margins ----------------------------- */
  const bandTop = useMemo(() => new Float32Array([x(BAND_LO / MILES_MAX), y(1.02), x(BAND_HI / MILES_MAX), y(1.02)]), [x, y])
  const lastBand = useRef('')
  const writeBand = (T: number, top: Float32Array): boolean => {
    const [lo, hi] = bandAt(T)
    const key = fid + '|' + lo.toFixed(4)
    if (key === lastBand.current) return false
    lastBand.current = key
    top[0] = x(lo / MILES_MAX)
    top[1] = y(1.02)
    top[2] = x(hi / MILES_MAX)
    top[3] = y(1.02)
    return true
  }
  const curvePts = (lo: number, hi: number) => {
    const out = new Float32Array(N_CURVE * 3)
    for (let i = 0; i < N_CURVE; i++) {
      const m = (i / (N_CURVE - 1)) * MILES_MAX
      out[i * 3] = x(m / MILES_MAX)
      out[i * 3 + 1] = y(capacityAt(m, lo, hi))
      out[i * 3 + 2] = 0.03
    }
    return out
  }
  const narrow = useMemo(() => curvePts(BAND_LO, BAND_HI), [frame]) // eslint-disable-line react-hooks/exhaustive-deps
  const lastC = useRef('')
  const lastG = useRef('')
  const writeCurve = (last: { current: string }) => (T: number, p: Float32Array): boolean => {
    const [lo, hi] = bandAt(T)
    const key = fid + '|' + lo.toFixed(4)
    if (key === last.current) return false
    last.current = key
    for (let i = 0; i < N_CURVE; i++) {
      const m = (i / (N_CURVE - 1)) * MILES_MAX
      p[i * 3] = x(m / MILES_MAX)
      p[i * 3 + 1] = y(capacityAt(m, lo, hi))
      p[i * 3 + 2] = 0.03
    }
    return true
  }
  const c4Vis = (T: number) => (T < B.vary ? 0 : chartOut(T))

  // QA: the block's area is the work at every t (width x height, chart units)
  useQAProbe('cf-fran-area', () => {
    const T = Math.min(B.vary - 1e-6, Math.max(B.power, 0))
    void T
    const out: number[] = []
    for (let i = 0; i <= 10; i++) {
      const b = blockAt(B.power + 0.56 + (0.3 * i) / 10)
      out.push(b ? b.u * b.v : NaN)
    }
    return { area: AREA, samples: out }
  })

  /* ----------------------------- labels ------------------------------ */
  const labels = useMemo<LabelSpec[]>(() => {
    const y0 = y(0)
    const clockPt: [number, number, number] = [0, 0, 0]
    const franPt: [number, number, number] = [0, 0, 0]
    const workPt: [number, number, number] = [0, 0, 0]
    const construct = (T: number) => at(T, B.power, 0.16, 0.26) * chartOut(T)
    const c3 = (T: number) => construct(T) * (1 - titlesSwap(T))
    const c4 = (T: number) => titlesSwap(T) * chartOut(T)
    const xTitleGap = 30
    return [
      { id: 'cf-ax-y3', text: 'Power (ft-lb/min)', tone: 'tick', anchor: [x(0), y(frame.vMax * 0.98), 0], prefer: 'E', only: ['E', 'NE'], gapPx: 8, priority: 78, cue: c3 },
      { id: 'cf-ax-x3', text: 'Time (min)', tone: 'tick', anchor: [x(0.5), y0 - TL, 0], prefer: 'S', only: ['S'], gapPx: xTitleGap, priority: 78, cue: c3 },
      { id: 'cf-ax-y4', text: 'Capacity', tone: 'tick', anchor: [x(0), y(frame.vMax * 0.98), 0], prefer: 'E', only: ['E', 'NE'], gapPx: 8, priority: 78, cue: c4 },
      { id: 'cf-ax-x4', text: 'Miles per effort', tone: 'tick', anchor: [x(0.5), y0 - TL, 0], prefer: 'S', only: ['S'], gapPx: xTitleGap, priority: 78, cue: c4 },
      { id: 'cf-t0', text: '0', tone: 'tick', anchor: [x(0), y0 - TL, 0], prefer: 'S', only: ['S'], gapPx: 5, priority: 80, cue: (T) => at(T, B.power, 0.18, 0.26) * franOut(T) },
      {
        id: 'cf-t430',
        text: ATTEMPT_A.display,
        tone: 'tick',
        anchor: [x(U_A), y0 - TL, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 5,
        priority: 82,
        cue: (T) => at(T, B.power, 0.44, 0.5) * franOut(T),
      },
      {
        id: 'cf-t245',
        text: ATTEMPT_B.display,
        tone: 'tick',
        anchor: [x(U_B), y0 - TL, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 5,
        priority: 82,
        cue: (T) => at(T, B.power, 0.8, 0.86) * franOut(T),
      },
      {
        id: 'cf-p-a',
        text: fmtThousands(POWER_A),
        tone: 'readout',
        size: 'sm',
        color: PAL.both,
        minChars: 6,
        // over the right end of the first block's top (it stays there as the dashed ghost)
        anchor: [x(U_A), y(V_A), 0],
        prefer: 'NW',
        only: ['NW', 'N'],
        gapPx: 6,
        priority: 84,
        cue: (T) => at(T, B.power, 0.44, 0.5) * franOut(T),
      },
      {
        id: 'cf-p-b',
        text: fmtThousands(POWER_B),
        tone: 'readout',
        size: 'sm',
        color: PAL.both,
        minChars: 6,
        // just under the risen block's top-right corner, over the ghost (clear of the HUD chip)
        anchor: [x(U_B), y(vOf(U_B)), 0],
        prefer: 'SE',
        only: ['SE', 'E'],
        gapPx: 8,
        priority: 84,
        cue: (T) => at(T, B.power, 0.8, 0.86) * franOut(T),
      },
      {
        id: 'cf-clock',
        text: '0:00',
        tone: 'readout',
        size: 'sm',
        color: PAL.chalk,
        minChars: 4,
        // rides the block's moving edge, just inside it above the time axis (the ticks and the axis title stay clear)
        anchor: (T) => {
          const b = blockAt(T)
          clockPt[0] = x(b ? b.u : 0)
          clockPt[1] = y0 + 0.02 * frame.FH
          return clockPt
        },
        prefer: 'NW',
        only: ['NW', 'NE'],
        gapPx: 6,
        priority: 83,
        cue: clockOn,
      },
      {
        id: 'cf-work',
        text: `WORK ${fmtThousands(FRAN_WORK)} FT-LB`,
        short: `${fmtThousands(FRAN_WORK)} FT-LB`,
        tone: 'name',
        color: PAL.both,
        dot: false,
        anchor: (T) => {
          const b = blockAt(T) ?? BLOCK_REST
          workPt[0] = x(b.u * 0.5)
          workPt[1] = y(Math.min(b.v * 0.42, 0.42))
          workPt[2] = 0.06
          return workPt
        },
        prefer: 'C',
        priority: 88,
        cue: (T) => workName(T) * franOut(T),
      },
      {
        // the block IS Fran's work: its name sits on it, over the work it holds
        id: 'cf-fran',
        text: 'FRAN',
        tone: 'name',
        color: PAL.both,
        anchor: (T) => {
          const b = blockAt(T) ?? BLOCK_REST
          franPt[0] = x(b.u * 0.5)
          franPt[1] = y(Math.min(b.v * 0.42, 0.42))
          return franPt
        },
        prefer: 'N',
        only: ['N'],
        gapPx: 9,
        priority: 87,
        cue: (T) => workName(T) * franOut(T),
      },
      {
        id: 'cf-claim-power',
        text: '60% MORE POWER',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [x(U_B * 0.42), y(vOf(U_B)), 0.06],
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 12,
        priority: 95,
        cue: (T) => claimPower(T) * franOut(T),
      },
      // C4
      { id: 'cf-t5', text: String(BAND_LO), tone: 'tick', anchor: [x(BAND_LO / MILES_MAX), y0 - TL, 0], prefer: 'S', only: ['S'], gapPx: 5, priority: 82, cue: (T) => bandIn(T) * chartOut(T) },
      { id: 'cf-t7', text: String(BAND_HI), tone: 'tick', anchor: [x(BAND_HI / MILES_MAX), y0 - TL, 0], prefer: 'S', only: ['S'], gapPx: 5, priority: 82, cue: (T) => bandIn(T) * chartOut(T) },
      {
        id: 'cf-exposure',
        text: 'EXPOSURE',
        tone: 'name',
        color: PAL.monostructural,
        anchor: [x(0.5), y(1.02), 0],
        prefer: 'N',
        only: ['N'],
        gapPx: 6,
        priority: 83,
        cue: (T) => bandIn(T) * chartOut(T),
      },
      {
        id: 'cf-weak-lo',
        text: 'WEAK',
        tone: 'callout',
        color: PAL.sick,
        anchor: [x(2.1 / MILES_MAX), y(capacityAt(2.1, BAND_LO, BAND_HI)), 0.04],
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 10,
        priority: 89,
        cue: (T) => weakIn(T) * chartOut(T),
      },
      {
        id: 'cf-weak-hi',
        text: 'WEAK',
        tone: 'callout',
        color: PAL.sick,
        anchor: [x(9.9 / MILES_MAX), y(capacityAt(9.9, BAND_LO, BAND_HI)), 0.04],
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 10,
        priority: 89,
        cue: (T) => weakIn(T) * chartOut(T),
      },
      {
        id: 'cf-claim-broad',
        text: 'BROAD STIMULUS, BROAD ADAPTATION',
        short: 'BROAD IN, BROAD OUT',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [x(0.5), y(capacityAt(6, WIDE_LO, WIDE_HI)), 0.06],
        prefer: 'S',
        only: ['S', 'SE', 'SW'],
        gapPx: 16,
        priority: 95,
        cue: (T) => claimBroad(T) * chartOut(T),
      },
    ]
  }, [frame, x, y, TL])
  useLabels(labels)
  useCounter('cf-clock', { value: clockMinutes, format: fmtClock })

  // labels never cover the block's top edge or the capacity curve
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        let n = 0
        const b = blockAt(T)
        if (b && franOut(T) > 0.3) {
          for (let i = 0; i <= 10; i++) {
            out[n * 3] = x((b.u * i) / 10)
            out[n * 3 + 1] = y(b.v)
            out[n * 3 + 2] = 0
            n++
          }
        }
        if (T >= B.vary + 0.22 && chartOut(T) > 0.3) {
          const [lo, hi] = bandAt(T)
          for (let i = 0; i < 36; i++) {
            const m = (i / 35) * MILES_MAX
            out[n * 3] = x(m / MILES_MAX)
            out[n * 3 + 1] = y(capacityAt(m, lo, hi))
            out[n * 3 + 2] = 0
            n++
          }
        }
        return n
      },
      maxPoints: 48,
      radiusPx: 6,
    }),
    [x, y],
  )
  useWorldObstacle('cf-chart-marks', obstacle)

  return (
    <>
      {/* construction: the hot pen draws both axes as one stroke */}
      <PenBatch
        segments={axes}
        color={PAL.chalk}
        width={PEN.axis}
        byArc
        head
        hot
        progress={axesDraw}
        opacity={(T) => 0.6 * chartLive(T) * chartOut(T)}
      />
      <PenBatch segments={tickA} color={PAL.chalk} width={PEN.axis} opacity={(T) => 0.6 * at(T, B.power, 0.44, 0.5) * franOut(T) * chartLive(T)} />
      <PenBatch segments={tickB} color={PAL.chalk} width={PEN.axis} opacity={(T) => 0.6 * at(T, B.power, 0.8, 0.86) * franOut(T) * chartLive(T)} />
      <PenBatch segments={ticks4} color={PAL.chalk} width={PEN.axis} opacity={(T) => 0.6 * bandIn(T) * chartOut(T)} />

      {/* C3: the work, lit, at the height of its power */}
      <AreaFill
        top={blockTop}
        baseline={y(0)}
        z={0}
        color={PAL.both}
        update={writeBlock}
        opacity={(T) => blockVis(T) * (0.85 + 0.15 * (1 - ghostA(T)))}
        lo={0.1}
        hi={0.55}
        gamma={1.25}
        additive
        rim={(T) => 1.4 + 1.6 * (squeezing(T) ? 1 : 0) + 1.2 * impactK(T)}
        rimWidth={frame.FH * 0.018}
      />
      <Pen points={ghostPts} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.24} gapSize={0.18} opacity={(T) => 0.7 * ghostA(T) * franOut(T)} renderOrder={33} />
      <Pen
        points={edgePts}
        color={PAL.both}
        width={PEN.data}
        update={writeEdge}
        opacity={blockVis}
        gain={(T) => 1 + 0.9 * (squeezing(T) ? 1 : 0) + 0.8 * impactK(T)}
        renderOrder={45}
      />
      {/* the clock's tip while it runs, and the top's light while the block rises */}
      <Glows
        count={1}
        sizePx={30}
        colors={[LIGHT]}
        gain={1.8}
        place={(T, _i, out) => {
          const b = blockAt(T)
          if (!b) return 0
          out[0] = x(b.u)
          out[1] = y(b.v)
          out[2] = 0.08
          const c = clockA(T)
          return (c > 0 && c < 1 ? 1 : 0) + (squeezing(T) ? 0.8 : 0)
        }}
      />

      {/* C4: the band of exposure and the capacity it builds */}
      <AreaFill
        top={bandTop}
        baseline={y(0)}
        z={-0.02}
        color={PAL.monostructural}
        update={writeBand}
        opacity={c4Vis}
        level={(T) => y(-0.02) + (y(1.02) - y(-0.02)) * bandIn(T)}
        lo={0.004}
        hi={0.026}
        renderOrder={10}
      />
      <Pen points={narrow} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.2} gapSize={0.16} opacity={(T) => 0.6 * at(T, B.vary, 0.54, 0.64) * chartOut(T)} renderOrder={33} />
      <Pen
        points={narrow}
        color={PAL.chalk}
        width={PEN.data}
        update={writeCurve(lastC)}
        progress={curveDraw}
        opacity={(T) => c4Vis(T) * (1 - widen(T))}
        head
        hot
        renderOrder={44}
      />
      <Pen
        points={narrow}
        color={PAL.yellowGreen}
        width={PEN.data}
        update={writeCurve(lastG)}
        opacity={(T) => c4Vis(T) * widen(T)}
        gain={(T) => 1 + 0.6 * (widen(T) > 0 && widen(T) < 1 ? 1 : 0)}
        renderOrder={45}
      />
    </>
  )
}
