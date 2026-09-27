import { useEffect, useMemo, useRef } from 'react'
import { ENERGY_SYSTEMS, PAL } from '../../fitnessData'
import { fmtDuration } from '../../lessonMath'
import { at, focus } from '../../story/cue'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { onFrame, clock } from '../../story/clock'
import { useChapterChart, type ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { impactK } from '../../story/kit/impact'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec, Layout, Tier, V3 } from '../../story/types'
import {
  BAND_COLORS,
  COLOR,
  LANE_BASE,
  MARATHON,
  NAME,
  PEAK_ORDER_TEXT,
  PINS,
  T_MIN,
  calloutKey,
  calloutText,
  contribInto,
  dominantAtT,
  dominantOf,
  uOf,
  type Shares,
} from './pathwaysMath'
import { bandTopAt, stackTopAt, uAtArc, FLOOD_W } from './bands'
import { Brackets, Construction, DurationStrips, MarathonChevron, type ConstructionVis } from './chart'
import { AXIS_ORDER, BAND_OF_AXIS, LIGHT, envelopeArc, makeFlowState, segLine, setFlowMorph, type BandSource } from './geom'
import { BandFill, BandPen, Envelope, NeutralFill, River } from './elements'
import { LANE_NAME_U, ROW, TICKS, bandStringX, narrowChart, pxPerUnit, underAxis, type UnderAxis } from './layout'
import {
  FLOOD_BEAT,
  FRAN_PIN,
  P,
  STOP_PIN,
  axesDraw,
  bracketDraw,
  bracketPulse,
  construct,
  curCallout,
  cursorFlash,
  cursorOn,
  cursorT,
  cursorU,
  envDraw,
  envOn,
  flooding,
  franChip,
  front,
  lanesM,
  laneLines,
  laneNames,
  moteOn,
  neutralOn,
  orderClaim,
  pinDrop,
  resultOn,
  stripOn,
  ticksDraw,
  yTitle,
} from './timeline'
import ExploreScene from './ExploreScene'

/* =========================================================================
   03 ENERGY SYSTEMS, "Three engines, one river" (DESIGN.md D.4). Seven
   beats, every property a pure function of story time T (L5):
     P0 a hot pen draws the axes, then the chalk envelope: the most power you
        can hold falls as the effort gets longer;
     P1 to P3 the three engines flood in as luminous bands under that line,
        each one with its own duration string under the axis, while a cursor
        reads the share of supply at the durations each engine rules;
     P4 the stack separates into three lanes on ONE power scale (signature):
        the rose spike is the tallest, the blue lane the lowest and longest;
     P5 back to the stack; real benchmarks drop onto the curve as pins and
        the cursor visits four of them;
     P6 three duration brackets, each band pulsing with its bracket, and the
        cursor parks at Fran, which draws on all three.
   Prewarm (README): the whole story and the explore layer are mounted at
   load and hidden by T or mode, so no shader links mid-story.
   ========================================================================= */

const SRC: BandSource = { m: lanesM, s: () => 0, front }
/** One scratch anchor: the label placer projects an anchor the moment it gets it, so dynamic anchors write here instead of allocating per frame. */
const _A: [number, number, number] = [0, 0, 0]
const pt = (x: number, y: number, z: number): V3 => {
  _A[0] = x
  _A[1] = y
  _A[2] = z
  return _A
}
/** far outside every view: a pen segment that must not show yet (never a zero-length dot) */
const AWAY = 1e5
/** pin heads sit this far above the envelope before they drop (world units) */
const DROP = 1.4

/** Band b (bottom to top) is this engine. */
const BAND_KEY = ['oxidative', 'glycolytic', 'phosphagen'] as const

/** The dominant engine's colour for a pin (ENERGY_BENCHMARKS[].dominant). */
const PIN_COLORS = PINS.map((p) => COLOR[p.dominant])

/* ------------------------------ helpers -------------------------------- */

/** v of the stack top at u (the envelope while stacked). */
const envV = (u: number) => stackTopAt(u, 0)
/** v of band b's top at u for lanes morph m. */
const topV = (b: number, u: number, m: number) => bandTopAt(b, u, m, 0)

/* ------------------------------ cursor ---------------------------------- */

const DOM_ORDER = ['phosphagen', 'glycolytic', 'oxidative'] as const
const DOM_COLORS = DOM_ORDER.map((k) => COLOR[k])
const CUR_IDS = DOM_ORDER.map((k) => `pw-cur-${k}`)

function Cursor({ frame, ppu }: { frame: ChartFrame; ppu: number }) {
  const pts = useMemo(() => new Float32Array(6), [])
  const last = useRef<{ u: number; f: ChartFrame | null }>({ u: -1, f: null })
  const update = (T: number, p: Float32Array): boolean => {
    const u = cursorU(T)
    if (u === last.current.u && frame === last.current.f) return false
    last.current.u = u
    last.current.f = frame
    const x = frame.x(u)
    p[0] = x
    p[1] = frame.y(0)
    p[2] = 0.05
    p[3] = x
    p[4] = frame.y(envV(u) + 0.035)
    p[5] = 0.05
    return true
  }
  // 7 px node (D.4), coloured by the engine that dominates under the cursor
  const nodeScale = 3.5 / ppu / 0.1
  return (
    <>
      <Pen
        points={pts}
        color={PAL.chalk}
        width={PEN.axis}
        update={update}
        opacity={(T) => 0.85 * cursorOn(T)}
        gain={(T) => 1 + 0.8 * cursorFlash(T)}
        renderOrder={46}
      />
      <Nodes
        count={3}
        radius={0.1}
        color={PAL.chalk}
        colors={DOM_COLORS}
        opacity={(T) => Math.min(1, cursorOn(T) * 1.2)}
        rimStrength={0.8}
        emissiveIntensity={0.7}
        place={(T, i, out) => {
          const u = cursorU(T)
          out[0] = frame.x(u)
          out[1] = frame.y(envV(u))
          out[2] = 0.08
          return DOM_ORDER[i] === dominantAtT(cursorT(T)) ? nodeScale : 0
        }}
      />
      {/* the node is hot: the speaking element while the cursor reads the stack (L4) */}
      <Glows
        count={1}
        sizePx={26}
        colors={[LIGHT]}
        gain={1.7}
        place={(T, _i, out) => {
          const u = cursorU(T)
          out[0] = frame.x(u)
          out[1] = frame.y(envV(u))
          out[2] = 0.1
          return cursorOn(T) * (0.55 + 0.45 * cursorFlash(T))
        }}
      />
    </>
  )
}

/* ------------------------------- pins ----------------------------------- */

function Pins({ frame, ppu }: { frame: ChartFrame; ppu: number }) {
  const PU = useMemo(() => PINS.map((p) => uOf(p.seconds)), [])
  const segs = useMemo(() => new Float32Array(PINS.length * 6).fill(AWAY), [])
  const last = useRef<{ T: number; fid: ChartFrame | null }>({ T: -1, fid: null })
  const headY = (T: number, k: number) => {
    const a = pinDrop(T, k)
    return frame.y(envV(PU[k])) + (1 - a) * DROP
  }
  const write = (T: number, s: Float32Array): boolean => {
    if (T === last.current.T && frame === last.current.fid) return false
    last.current.T = T
    last.current.fid = frame
    for (let k = 0; k < PINS.length; k++) {
      const o = k * 6
      const a = pinDrop(T, k)
      if (a <= 0.02) {
        s.fill(AWAY, o, o + 6)
        continue
      }
      const x = frame.x(PU[k])
      const y0 = frame.y(0)
      const y1 = headY(T, k)
      // the stem grows up from the axis as the head falls onto the curve
      s[o] = x
      s[o + 1] = y0
      s[o + 2] = 0.03
      s[o + 3] = x
      s[o + 4] = y0 + (y1 - y0) * Math.min(1, a)
      s[o + 5] = 0.03
    }
    return true
  }
  const vis = (T: number) => focus(T, P.workouts) * (1 - lanesM(T))
  const headScale = 3.6 / ppu / 0.1
  // landing: the snap overshoots and settles around 60% of each pin's window
  const land = (T: number, k: number) => {
    const a = pinDrop(T, k)
    return a > 0.85 && a < 1.2 ? Math.max(0, 1 - Math.abs(a - 1) * 6) : 0
  }
  return (
    <>
      <PenBatch segments={segs} color={PAL.chalk} width={PEN.grid} update={write} opacity={(T) => 0.36 * vis(T)} renderOrder={33} />
      <Nodes
        count={PINS.length}
        radius={0.1}
        color={PAL.chalk}
        colors={PIN_COLORS}
        opacity={vis}
        rimStrength={0.7}
        emissiveIntensity={0.55}
        place={(T, k, out) => {
          const a = pinDrop(T, k)
          out[0] = frame.x(PU[k])
          out[1] = headY(T, k)
          out[2] = 0.06
          return a > 0.02 ? headScale : 0
        }}
      />
      <Glows
        count={PINS.length}
        sizePx={24}
        colors={PIN_COLORS}
        gain={1.3}
        place={(T, k, out) => {
          out[0] = frame.x(PU[k])
          out[1] = frame.y(envV(PU[k]))
          out[2] = 0.09
          return land(T, k) * vis(T)
        }}
      />
    </>
  )
}

/* ---------------------------- lane baselines ---------------------------- */

function LaneLines({ frame }: { frame: ChartFrame }) {
  const segs = useMemo(() => {
    const s: number[] = []
    for (const v of [LANE_BASE[1], LANE_BASE[2]]) {
      const a = segLine([frame.x(0), frame.y(v), -0.01], [frame.x(1), frame.y(v), -0.01], 1)
      s.push(a[0], a[1], a[2], a[3], a[4], a[5])
    }
    return new Float32Array(s)
  }, [frame])
  // each lane rests dimmed at full alpha (no beads), fading in and out with the lanes
  return <PenBatch segments={segs} color={PAL.chalk} width={PEN.grid} opacity={laneLines} dim={() => 0.4} renderOrder={29} />
}

/* ------------------------------- labels --------------------------------- */

function useStoryLabels(frame: ChartFrame, layout: Layout, ua: UnderAxis) {
  const narrow = narrowChart(layout)
  const specs = useMemo<LabelSpec[]>(() => {
    const x = frame.x
    const y = frame.y
    const yRow = y(0) - ua.strip
    // the duration strings, packed so they never touch on a 360 px phone
    const sx = bandStringX(frame)
    const out: LabelSpec[] = [
      {
        id: 'pw-ax-y',
        text: 'Power output',
        tone: 'tick',
        anchor: [x(0), y(frame.vMax), 0],
        prefer: 'E',
        only: ['E', 'NE', 'SE'],
        gapPx: 8,
        priority: 78,
        cue: yTitle,
      },
      {
        id: 'pw-ax-x',
        text: 'Effort duration (log)',
        tone: 'tick',
        anchor: [x(0.5), yRow, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: ROW.title,
        priority: 78,
        cue: (T) => construct(T) * focus(T, P.three),
      },
    ]
    TICKS.forEach((t, j) => {
      if (narrow && !t.phone) return
      out.push({
        id: `pw-tk-${j}`,
        text: t.label,
        tone: 'tick',
        anchor: [x(uOf(t.s)), yRow, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: ROW.tick,
        priority: 80,
        cue: (T) => at(T, P.three, 0.16 + 0.025 * j, 0.3 + 0.025 * j),
      })
    })
    // the duration strings (ENERGY_SYSTEMS[].duration): each lands with its engine
    AXIS_ORDER.forEach((key, k) => {
      const sys = ENERGY_SYSTEMS.find((s) => s.key === key)
      if (!sys) return
      out.push({
        id: `pw-band-${k}`,
        text: sys.duration,
        tone: 'name',
        color: sys.color,
        anchor: [sx[k], yRow, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: ROW.band,
        priority: 74,
        cue: (T) => stripOn(T, k) * Math.max(0.55, focus(T, FLOOD_BEAT[BAND_OF_AXIS[k]])),
      })
    })
    // P1 to P3: the cursor callout, one per engine colour (the colour IS the dominant engine)
    DOM_ORDER.forEach((key) => {
      out.push({
        id: `pw-cur-${key}`,
        // a real value from the first frame, so the pill is never measured empty
        text: calloutText(T_MIN),
        tone: 'callout',
        color: COLOR[key],
        minChars: 24,
        anchor: (T) => {
          const u = cursorU(T)
          return pt(x(u), y(envV(u)), 0.08)
        },
        prefer: 'NE',
        gapPx: 14,
        leader: true,
        priority: 92,
        cue: (T) => (dominantAtT(cursorT(T)) === key ? curCallout(T) : 0),
      })
    })
    // P3 on: the Marathon edge chip at the river's end, where the axis runs
    // out (F.7: never plotted on it); it steps aside while the lanes are open
    if (MARATHON)
      out.push({
        id: 'pw-mara',
        text: MARATHON.name,
        tone: 'callout',
        color: COLOR[MARATHON.dominant],
        anchor: [x(1), y(envV(1)), 0],
        prefer: 'NW',
        only: ['NW', 'N'],
        gapPx: 14,
        priority: 70,
        leader: true,
        cue: (T) => at(T, P.oxi, 0.88, 0.96) * Math.max(0.55, focus(T, P.oxi)) * (1 - lanesM(T)),
      })
    // P4: each lane named on its own lane (one shared power scale); the
    // phosphagen name sits on its falling spike, clear of the top-left corner
    for (let b = 0; b < 3; b++) {
      const key = (['oxidative', 'glycolytic', 'phosphagen'] as const)[b]
      const u = LANE_NAME_U[b]
      out.push({
        id: `pw-lane-${b}`,
        text: NAME[key],
        tone: 'callout',
        color: BAND_COLORS[b],
        required: true,
        anchor: (T) => pt(x(u), y(topV(b, u, lanesM(T))), 0.05),
        prefer: b === 2 ? 'NE' : 'N',
        gapPx: 10,
        leader: true,
        priority: 90,
        cue: laneNames,
      })
    }
    // P4 claim: the peak order (PathwaysModule.note), two stacked chips so it fits 360 px
    out.push(
      {
        id: 'pw-order-h',
        text: 'Peak power order:',
        tone: 'legend',
        color: PAL.chalk,
        dot: false,
        anchor: [0, 0, 0],
        pin: 'top-right',
        pinOrder: 0,
        cue: orderClaim,
      },
      {
        id: 'pw-order',
        text: PEAK_ORDER_TEXT,
        tone: 'legend',
        color: PAL.phosphagen,
        swatches: DOM_COLORS,
        dot: false,
        anchor: [0, 0, 0],
        pin: 'top-right',
        pinOrder: 1,
        required: true,
        cue: orderClaim,
      },
    )
    // P5: the benchmark pins' names (the result chip replaces the name it describes)
    PINS.forEach((p, k) => {
      const u = uOf(p.seconds)
      const stop = STOP_PIN.indexOf(k)
      out.push({
        id: `pw-pin-${k}`,
        text: p.name,
        tone: 'name',
        color: COLOR[p.dominant],
        dot: false,
        anchor: [x(u), y(envV(u)), 0.06],
        prefer: u > 0.75 ? 'NW' : u < 0.1 ? 'NE' : 'N',
        gapPx: 9,
        leader: true,
        priority: 64 - k * 0.1,
        cue: (T) => {
          const a = at(T, P.workouts, 0.34 + 0.012 * k, 0.44 + 0.012 * k)
          const chip = stop >= 0 ? resultOn(T, stop) : 0
          const fran = k === FRAN_PIN ? franChip(T) : 0
          return a * Math.max(0.6, focus(T, P.workouts)) * (1 - chip) * (1 - fran)
        },
      })
    })
    // P5 result chips: name, duration and the dominant engine, in its colour
    STOP_PIN.forEach((k, s) => {
      if (k < 0) return
      const p = PINS[k]
      const u = uOf(p.seconds)
      out.push({
        id: `pw-res-${s}`,
        text: `${p.name} - ${fmtDuration(p.seconds)} - ${NAME[p.dominant]}`,
        tone: 'callout',
        color: COLOR[p.dominant],
        anchor: [x(u), y(envV(u)), 0.08],
        prefer: u > 0.6 ? 'NW' : 'NE',
        gapPx: 16,
        leader: true,
        priority: 94,
        cue: (T) => resultOn(T, s),
      })
    })
    if (FRAN_PIN >= 0) {
      const p = PINS[FRAN_PIN]
      const u = uOf(p.seconds)
      out.push({
        id: 'pw-res-fran',
        text: `${p.name} - ${fmtDuration(p.seconds)}`,
        tone: 'callout',
        color: PAL.chalk,
        swatches: DOM_COLORS,
        anchor: [x(u), y(envV(u)), 0.08],
        prefer: 'NE',
        gapPx: 16,
        leader: true,
        priority: 94,
        cue: franChip,
      })
    }
    return out
  }, [frame, narrow, ua])
  useLabels(specs)

  // the cursor callout text: fmtDuration + dominant name + share (D.4), computed
  // from T. The string is rebuilt only when it changes, but written every frame
  // (setLabelText is a no-op when equal), so a label registered later, or
  // re-registered on a layout change, always shows it.
  useEffect(() => {
    let key = -1
    let text = ''
    const c: Shares = { phosphagen: 0, glycolytic: 0, oxidative: 0 }
    return onFrame(() => {
      const t = cursorT(clock.T)
      contribInto(t, c)
      const d = dominantOf(c)
      const k = calloutKey(t, DOM_ORDER.indexOf(d), Math.round(c[d]))
      if (k !== key) {
        key = k
        text = calloutText(t)
      }
      for (const id of CUR_IDS) setLabelText(id, text)
    })
  }, [])
}

/** Data marks the labels must not cover: the envelope (or the lane tops), the pins, the cursor node, the power axis. */
function useDataObstacles(frame: ChartFrame) {
  const S = 36
  const curves = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        let n = 0
        const m = lanesM(T)
        if (T < P.three + 0.4) return 0
        if (m < 0.5) {
          for (let i = 0; i < S; i++) {
            const u = i / (S - 1)
            out[n * 3] = frame.x(u)
            out[n * 3 + 1] = frame.y(envV(u))
            out[n * 3 + 2] = 0
            n++
          }
        } else {
          for (let b = 0; b < 3; b++)
            for (let i = 0; i < S; i++) {
              const u = i / (S - 1)
              out[n * 3] = frame.x(u)
              out[n * 3 + 1] = frame.y(topV(b, u, m))
              out[n * 3 + 2] = 0
              n++
            }
        }
        return n
      },
      maxPoints: 3 * S,
      radiusPx: 5,
    }),
    [frame],
  )
  const marks = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        let n = 0
        if (T >= P.workouts + 0.3 && lanesM(T) < 0.5)
          for (let k = 0; k < PINS.length; k++) {
            const u = uOf(PINS[k].seconds)
            out[n * 3] = frame.x(u)
            out[n * 3 + 1] = frame.y(envV(u))
            out[n * 3 + 2] = 0
            n++
          }
        if (cursorOn(T) > 0.05) {
          const u = cursorU(T)
          out[n * 3] = frame.x(u)
          out[n * 3 + 1] = frame.y(envV(u))
          out[n * 3 + 2] = 0
          n++
        }
        return n
      },
      maxPoints: PINS.length + 1,
      radiusPx: 8,
    }),
    [frame],
  )
  const axis = useMemo<WorldObstacle>(
    () => ({
      box: (T) =>
        at(T, P.three, 0, 0.3) > 0
          ? [
              [frame.x(0) - 0.02, frame.y(0), 0],
              [frame.x(0) + 0.02, frame.y(frame.vMax), 0],
            ]
          : null,
      padPx: 3,
    }),
    [frame],
  )
  useWorldObstacle('pw-curves', curves)
  useWorldObstacle('pw-marks', marks)
  useWorldObstacle('pw-yaxis', axis)
}

/* ------------------------------- story ---------------------------------- */

const constructionVis: ConstructionVis = {
  axes: { progress: axesDraw, dim: (T) => 0.55 * focus(T, P.three), head: true },
  ticks: { progress: ticksDraw, dim: (T) => 0.6 * focus(T, P.three) },
}

function StoryScene({ frame, tier }: { frame: ChartFrame; tier: Tier }) {
  const { layout } = useBeat()
  const ppu = pxPerUnit(frame)
  const ua0 = underAxis(frame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ua = useMemo(() => ua0, [ua0.tick, ua0.strip])
  useStoryLabels(frame, layout, ua)
  useDataObstacles(frame)
  const envArc = useMemo(() => envelopeArc(frame), [frame])
  // the P0 fill rises behind the pen head and is complete when the stroke is
  const reveal = (T: number) => {
    const p = envDraw(T)
    return uAtArc(envArc, p) + FLOOD_W * p
  }
  const flow = useMemo(() => makeFlowState(), [])
  const low = tier === 'low'

  /**
   * Band b's opacity: on once its flood starts, with the focus pull of its
   * beat (L3). In P6 it swells with its bracket (x1.4, additive: more light).
   */
  const bandOpacity = (T: number, b: number) =>
    T < FLOOD_BEAT[b] + 0.05 ? 0 : focus(T, FLOOD_BEAT[b]) * (1 + 0.4 * bracketPulse(T, AXIS_ORDER.indexOf(BAND_KEY[b])))
  /** Band b's rim: HDR while it floods (the speaking element) and when its bracket pulses (P6). */
  const bandRim = (T: number, b: number) => {
    if (low) return 0.5
    const k = AXIS_ORDER.indexOf(BAND_KEY[b])
    return 0.04 + 2.2 * flooding(T, b) + 1.4 * bracketPulse(T, k) + 0.8 * impactK(T)
  }
  return (
    <>
      <Construction frame={frame} vis={constructionVis} uOfS={uOf} ua={ua} />
      <NeutralFill frame={frame} reveal={reveal} src={SRC} opacity={(T) => neutralOn(T) * focus(T, P.three)} />
      {[0, 1, 2].map((b) => (
        <BandFill key={b} frame={frame} b={b} src={SRC} tier={tier} opacity={(T) => bandOpacity(T, b)} rim={(T) => bandRim(T, b)} />
      ))}
      {!low && (
        <River
          frame={frame}
          tier={tier}
          uniforms={(T, A) => {
            const u = flow.u
            u.flow = 0.035 * A
            u.bandOn[0] = moteOn(T, 0) * focus(T, P.oxi)
            u.bandOn[1] = moteOn(T, 1) * focus(T, P.gly)
            u.bandOn[2] = moteOn(T, 2) * focus(T, P.phos)
            u.opacity = T < P.phos ? 0 : 1
            u.hot = 0.15 * impactK(T)
            setFlowMorph(flow, lanesM(T))
            return u
          }}
        />
      )}
      <DurationStrips
        frame={frame}
        ua={ua}
        reveal={(T, k) => stripOn(T, k)}
        opacity={(T) => 0.13 + 0.14 * at(T, P.all, 0.1, 0.4) + 0.1 * impactK(T)}
      />
      <LaneLines frame={frame} />
      {[0, 1, 2].map((b) => (
        <BandPen
          key={b}
          frame={frame}
          b={b}
          src={SRC}
          head={true}
          opacity={(T) => (T < FLOOD_BEAT[b] + 0.05 ? 0 : 1)}
          dim={(T) => focus(T, FLOOD_BEAT[b])}
          gain={(T) => 1 + 0.4 * bracketPulse(T, AXIS_ORDER.indexOf(BAND_KEY[b]))}
        />
      ))}
      <Envelope frame={frame} progress={envDraw} opacity={envOn} dim={(T) => focus(T, P.three)} head />
      <Brackets
        frame={frame}
        ua={ua}
        draw={bracketDraw}
        gain={(T, k) => 1 + 0.4 * bracketPulse(T, k) + 0.8 * impactK(T)}
        opacity={() => 1}
      />
      <MarathonChevron frame={frame} progress={(T) => at(T, P.oxi, 0.86, 0.94)} dim={(T) => 0.9 * Math.max(0.55, focus(T, P.oxi))} />
      <Pins frame={frame} ppu={ppu} />
      <Cursor frame={frame} ppu={ppu} />
    </>
  )
}

export default function PathwaysScene() {
  const frame = useChapterChart()
  const mode = useStoryStore((s) => s.mode)
  const tier = useStoryStore((s) => s.tier)
  // Both layers stay mounted (prewarm); the mode only toggles visibility.
  return (
    <>
      <group visible={mode === 'story'}>
        <StoryScene frame={frame} tier={tier} />
      </group>
      <group visible={mode === 'explore'}>
        <ExploreScene frame={frame} tier={tier} />
      </group>
    </>
  )
}
