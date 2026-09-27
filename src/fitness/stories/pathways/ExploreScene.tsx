import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { ENERGY_SYSTEMS, PAL } from '../../fitnessData'
import { fmtDuration } from '../../lessonMath'
import { type ChartFrame } from '../../story/kit/chartFrame'
import { useSafeFrame } from '../../story/useSafeFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { sampleCurve } from '../../story/kit/LightField'
import { bumpObstacles, setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { useStageHotspot } from '../../story/hotspots'
import { useBeat } from '../../story/useBeat'
import { useStoryStore } from '../../story/store'
import type { LabelSpec, Rect, Tier, V3 } from '../../story/types'
import {
  BAND_COLORS,
  COLOR,
  LANE_BASE,
  MARATHON,
  NAME,
  PINS,
  POWER_MAX,
  SHARE_MAX,
  T_MAX,
  T_MIN,
  calloutKey,
  calloutText,
  contribInto,
  dominantAtT,
  dominantOf,
  shareThickAt,
  uOf,
  type Shares,
} from './pathwaysMath'
import { bandTopAt, stackTopAt } from './bands'
import { Construction, HandoverStrip, LaneAxes, MarathonChevron, type ConstructionVis } from './chart'
import { AXIS_ORDER, FLOW_CURVES, makeFlowState, setFlowMorph, type BandSource } from './geom'
import { BandFill, BandPen, Envelope } from './elements'
import { River } from './River'
import { LANE_NAME_U, ROW, TICKS, narrowChart, pxPerUnit, stringX, underAxis, type UnderAxis } from './layout'
import { PxMap, addHud, addBlocker, blockFlag, boundsInto, measureCallout, newBlockers, newFlag, putSig, sizeInto, solveFlag, type Floor } from './annot'
import { usePwExplore } from './exploreStore'
import { shown } from './shown'

/* =========================================================================
   Pathways explore layer (DESIGN.md D.4 "Explore", C.12). Not driven by T:
   the cursor, Stacked | Lanes and Power | Share damp toward the explore
   store, and the river keeps flowing on the ambient clock. Scrub drags the
   cursor (the default here: this is a chart you read front-on); a pin, or a
   benchmark chip, jumps to that benchmark.

   Layout (annot.ts), once per frame before the labels: the cursor's
   readout, then the Marathon chip clear of it and its pole (with the lanes
   open it stays inside the oxidative lane, under the glycolytic baseline,
   or folds into its chevron), then the lane names, each sliding along its
   own lane to stay clear of both (review r2). Under a real Orbit the chart is no longer front-on,
   the stage-px map stops being separable, and the chips fall back to plain
   anchored placement with the placer's own leaders.
   ========================================================================= */

const STATIC: ConstructionVis = {
  axes: { progress: () => 1, dim: () => 0.55 * (1 - 0.8 * shown.m) },
  ticks: { progress: () => 1, dim: () => 0.6 },
}

/** One scratch anchor: the label placer projects an anchor the moment it gets it, so dynamic anchors write here instead of allocating per frame. */
const _A: [number, number, number] = [0, 0, 0]
const pt = (x: number, y: number, z: number): V3 => {
  _A[0] = x
  _A[1] = y
  _A[2] = z
  return _A
}
const AWAY = 1e5
const damp = THREE.MathUtils.damp
const NO_LABELS: LabelSpec[] = []
const FULL = 9
const SRC: BandSource = { m: () => shown.m, s: () => shown.s, front: () => FULL }
const PIN_COLORS = PINS.map((p) => COLOR[p.dominant])
const KEYS = ['phosphagen', 'glycolytic', 'oxidative'] as const
const CUR_IDS = KEYS.map((k) => `pwx-cur-${k}`)
const CURP_IDS = KEYS.map((k) => `pwx-curp-${k}`)
/** Band index (bottom to top) of each engine. */
const BAND_OF: Record<(typeof KEYS)[number], number> = { phosphagen: 2, glycolytic: 1, oxidative: 0 }
const MARA_TEXT = MARATHON ? `${MARATHON.name} - ${fmtDuration(MARATHON.seconds)}` : ''
/** Where each lane's name may sit along its lane (bottom to top), first choice first. */
const LANE_NAME_TRY: readonly (readonly number[])[] = [
  [LANE_NAME_U[0], uOf(120), uOf(60), uOf(30), uOf(14), uOf(7), uOf(1200)],
  [LANE_NAME_U[1], uOf(30), uOf(8)],
  [LANE_NAME_U[2], uOf(20), uOf(6)],
]
const LANE_TEXT = [0, 1, 2].map((b) => NAME[KEYS[2 - b]])

/** v of band b's top at u in the displayed mode. */
const topV = (b: number, u: number) => bandTopAt(b, u, shown.m, shown.s)
/** Where a pin head sits: on the stack top while stacked, sinking to the axis as the lanes open. */
const pinV = (u: number) => stackTopAt(u, shown.s) * (1 - shown.m)
const cursorUx = () => uOf(shown.t)
/** The Marathon is chosen: the cursor rests at the axis end and its readout gives way to the Marathon chip. */
const beyond = () => {
  const b = usePwExplore.getState().bench
  return !!MARATHON && b === MARATHON.name
}
/** Index of the chosen benchmark pin once the cursor has arrived at it (-1 otherwise). */
function arrivedPin(): number {
  const b = usePwExplore.getState().bench
  if (!b) return -1
  const k = PINS.findIndex((p) => p.name === b)
  return k >= 0 && Math.abs(Math.log(shown.t) - Math.log(PINS[k].seconds)) < 2e-3 ? k : -1
}
/** The band the cursor's node sits on: the stack top while stacked, the dominant engine's lane once the lanes open. */
const nodeV = (u: number) => (shown.m < 0.5 ? stackTopAt(u, shown.s) : topV(BAND_OF[dominantAtT(shown.t)], u))
/** "Power output" and "Share of energy supply" trade places as Power | Share damps (never both at once). */
const powerTitle = () => Math.max(0, 1 - 2.2 * shown.s)
const shareTitle = () => Math.max(0, 2.2 * shown.s - 1.2)

const overlaps = (x: number, y: number, w: number, h: number, r: { x: number; y: number; w: number; h: number }, pad: number) =>
  x < r.x + r.w + pad && x + w > r.x - pad && y < r.y + r.h + pad && y + h > r.y - pad

export default function ExploreScene({ frame, tier }: { frame: ChartFrame; tier: Tier }) {
  const { layout } = useBeat()
  const mode = useStoryStore((s) => s.mode)
  const camera = useThree((s) => s.camera)
  const ppu = pxPerUnit(frame)
  const ua0 = underAxis(frame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ua: UnderAxis = useMemo(() => ua0, [ua0.tick, ua0.strip])
  const bench = usePwExplore((s) => s.bench)
  const PU = useMemo(() => PINS.map((p) => uOf(p.seconds)), [])

  // damp the displayed state toward the store (log space for time), before the layout (-84) and the labels (-80)
  useSafeFrame(
    'pathways explore damping',
    (_T, _A, dtRaw) => {
      if (useStoryStore.getState().mode !== 'explore') return
      const dt = Math.min(0.05, dtRaw)
      const st = usePwExplore.getState()
      const goal = Math.max(T_MIN, Math.min(T_MAX, st.t))
      const lt = Math.log(shown.t)
      const target = Math.log(goal)
      // settle on the exact value (exp(log(3600)) is 3599.99..., which fmtDuration shows as "60 min")
      const t = Math.abs(lt - target) < 1e-4 ? goal : Math.exp(damp(lt, target, 9, dt))
      const nm = damp(shown.m, st.lanes ? 1 : 0, 5, dt)
      const ns = damp(shown.s, st.share ? 1 : 0, 5, dt)
      const m = Math.abs(nm - (st.lanes ? 1 : 0)) < 1e-3 ? (st.lanes ? 1 : 0) : nm
      const s = Math.abs(ns - (st.share ? 1 : 0)) < 1e-3 ? (st.share ? 1 : 0) : ns
      if (t !== shown.t || m !== shown.m || s !== shown.s) {
        shown.t = t
        shown.m = m
        shown.s = s
        shown.version++
      }
    },
    { priority: -88 },
  )
  // entering explore snaps the displayed state to the seed (no glide from a stale state)
  useEffect(() => {
    if (mode !== 'explore') return
    const st = usePwExplore.getState()
    shown.t = Math.max(T_MIN, Math.min(T_MAX, st.t))
    shown.m = st.lanes ? 1 : 0
    shown.s = st.share ? 1 : 0
    shown.version++
  }, [mode])

  // the river's band curves follow Power | Share: the power curves are static
  // (FLOW_CURVES) and the share curves are sampled once, so a toggle only
  // blends two Float32Arrays (no allocation, no per-sample math). `force`:
  // the river repacked its power curves (a refit), so the blend must be
  // written again even though Share has not moved (review r2).
  const live = useMemo(
    () => ({
      a: [new Float32Array(128), new Float32Array(128), new Float32Array(128)] as [Float32Array, Float32Array, Float32Array],
      share: [0, 1, 2].map((b) => sampleCurve((u) => shareThickAt(b, u))),
      s: -1,
    }),
    [],
  )
  const liveCurves = (force: boolean) => {
    if (!force && live.s === shown.s) return null
    live.s = shown.s
    const s = shown.s
    for (let b = 0; b < 3; b++) {
      const p = FLOW_CURVES[b]
      const q = live.share[b]
      const o = live.a[b]
      for (let i = 0; i < 128; i++) o[i] = p[i] + (q[i] - p[i]) * s
    }
    return live.a
  }
  const flow = useMemo(() => makeFlowState(POWER_MAX), [])

  /* ------------------------------ layout ------------------------------ */

  const an = useMemo(
    () => ({
      pxm: new PxMap(),
      B: { x: 0, y: 0, w: 0, h: 0 } as Rect,
      bl: newBlockers(20),
      cur: newFlag(),
      curOn: 0,
      mara: newFlag(),
      maraOn: 0,
      sz: { w: 0, h: 0 },
      sig: new Float64Array(12),
      ver: 0,
      laneU: [LANE_NAME_U[0], LANE_NAME_U[1], LANE_NAME_U[2]],
      // the readout's text (rebuilt only when it changes)
      key: -1,
      text: calloutText(T_MIN),
      c: { phosphagen: 0, glycolytic: 0, oxidative: 0 } as Shares,
    }),
    [],
  )
  // the surfaces the chips keep clear of, in stage px: the cursor's band (the
  // stack top, or its engine's lane), and the oxidative river (Marathon)
  const floors = useMemo(() => {
    const uAt = (sx: number) => Math.max(0, Math.min(1, (an.pxm.wx(sx) - frame.x0) / frame.FW))
    const cursor: Floor = (sx) => {
      const uu = uAt(sx)
      return an.pxm.py(frame.y(shown.m >= 0.5 ? topV(BAND_OF[dominantAtT(shown.t)], uu) : stackTopAt(uu, shown.s)))
    }
    // the Marathon rides the oxidative river: the stack top, or the oxidative lane once the lanes open
    const top: Floor = (sx) => {
      const uu = uAt(sx)
      return an.pxm.py(frame.y(shown.m >= 0.5 ? topV(0, uu) : stackTopAt(uu, shown.s)))
    }
    return { cursor, top }
  }, [an, frame])
  useSafeFrame(
    'pathways explore annot',
    () => {
      if (useStoryStore.getState().mode !== 'explore') return
      const { pxm, B, bl } = an
      pxm.update(camera, frame)
      boundsInto(B)

      // the readout's text first, so it is sized and placed with the text it shows (review r2)
      contribInto(shown.t, an.c)
      const d = dominantOf(an.c)
      // at a chosen benchmark the readout carries its name, as the story's result chips do
      const pin = arrivedPin()
      const key = calloutKey(shown.t, KEYS.indexOf(d), Math.round(an.c[d])) * 16 + pin + 1
      if (key !== an.key) {
        an.key = key
        an.text = pin >= 0 ? PINS[pin].name + ' - ' + calloutText(shown.t) : calloutText(shown.t)
      }
      for (let i = 0; i < 3; i++) {
        setLabelText(CUR_IDS[i], an.text)
        setLabelText(CURP_IDS[i], an.text)
      }

      const u = cursorUx()
      const nx = pxm.px(frame.x(u))
      const ny = pxm.py(frame.y(nodeV(u)))
      const tipX = pxm.px(frame.x(1) + 0.32)
      const axisX = pxm.px(frame.x(0))
      const chosen = beyond()
      an.curOn = chosen ? 0 : 1

      // 1. the cursor's readout, clear of every pin, left of the Marathon's leader
      bl.n = 0
      addHud(bl)
      if (shown.m < 0.5)
        for (let k = 0; k < PINS.length; k++) {
          const x = pxm.px(frame.x(PU[k]))
          const y = pxm.py(frame.y(pinV(PU[k])))
          if (Math.abs(x - nx) > 1 || Math.abs(y - ny) > 1) addBlocker(bl, x - 8, y - 8, 16, 16)
        }
      if (an.curOn) {
        measureCallout(an.text, an.sz, 24)
        solveFlag(an.cur, nx, ny, an.sz.w, an.sz.h, floors.cursor, axisX + 6, tipX - 10, bl, B)
        blockFlag(bl, an.cur)
      } else an.cur.on = false

      // 2. the Marathon chip, right-aligned over its chevron, clear of the
      // readout and its pole; with the lanes open it keeps inside the
      // oxidative lane (under the glycolytic baseline), else it folds into
      // its chevron, unless it is the chosen benchmark
      measureCallout(MARA_TEXT, an.sz)
      const laneTop = shown.m >= 0.5 && !chosen ? pxm.py(frame.y(LANE_BASE[1])) + 2 : -Infinity
      solveFlag(an.mara, tipX, pxm.py(frame.y(0)), an.sz.w, an.sz.h, floors.top, axisX + 6, B.x + B.w, bl, B, 8, laneTop)
      an.maraOn = an.mara.on || chosen ? 1 : 0

      // 3. the lane names slide along their own lanes, clear of both chips
      for (let b = 0; b < 3; b++) {
        const tries = LANE_NAME_TRY[b]
        sizeInto(`pwx-lane-${b}`, LANE_TEXT[b], 'name', an.sz)
        const w = an.sz.w + 14
        const h = an.sz.h
        let pick = tries[0]
        for (let j = 0; j < tries.length; j++) {
          const lx = pxm.px(frame.x(tries[j]))
          const ly = pxm.py(frame.y(topV(b, tries[j])))
          const x0 = b === 2 ? lx + 4 : lx - w / 2
          const y0 = ly - 10 - h
          const clearCur = !an.curOn || !overlaps(x0, y0, w, h, an.cur, 4)
          const clearMara = !an.maraOn || !overlaps(x0, y0, w, h, an.mara, 4)
          if (clearCur && clearMara && x0 >= B.x && x0 + w <= B.x + B.w) {
            pick = tries[j]
            break
          }
        }
        an.laneU[b] = pick
      }

      const s = an.sig
      let moved = putSig(s, 0, an.cur.x)
      moved = putSig(s, 1, an.cur.y) || moved
      moved = putSig(s, 2, an.mara.x) || moved
      moved = putSig(s, 3, an.mara.y) || moved
      moved = putSig(s, 4, an.cur.nx) || moved
      moved = putSig(s, 5, an.cur.ny) || moved
      moved = putSig(s, 6, an.maraOn * 100) || moved
      moved = putSig(s, 7, pxm.affine ? 100 : 0) || moved
      for (let b = 0; b < 3; b++) moved = putSig(s, 8 + b, an.laneU[b] * 1000) || moved
      if (moved) {
        an.ver++
        bumpObstacles()
      }
    },
    { priority: -84 },
  )
  /** The solver-placed chips hold while the chart is front-on; under a real Orbit the plain labels take over. */
  const flat = () => (an.pxm.affine ? 1 : 0)

  // cursor: a core sample from the axis to the node, and the connector to its readout
  const cur = useMemo(() => new Float32Array(6), [])
  const lastCur = useRef({ v: -1, f: null as ChartFrame | null })
  const writeCursor = (_T: number, p: Float32Array): boolean => {
    if (lastCur.current.v === shown.version && lastCur.current.f === frame) return false
    lastCur.current.v = shown.version
    lastCur.current.f = frame
    const u = cursorUx()
    p[0] = p[3] = frame.x(u)
    p[1] = frame.y(0)
    p[4] = frame.y(nodeV(u) + 0.035)
    p[2] = p[5] = 0.05
    return true
  }
  const link = useMemo(() => new Float32Array(6), [])
  const maraLink = useMemo(() => new Float32Array(6), [])
  const lastLink = useRef(-1)
  const lastMara = useRef(-1)
  const writeLink = (f: typeof an.cur, p: Float32Array, on: boolean) => {
    const len = Math.hypot(f.cx - f.nx, f.cy - f.ny)
    if (!on || len < 5) {
      p.fill(AWAY)
      return
    }
    const k = Math.min(0.45, 5 / len)
    p[0] = an.pxm.wx(f.nx + (f.cx - f.nx) * k)
    p[1] = an.pxm.wy(f.ny + (f.cy - f.ny) * k)
    p[3] = an.pxm.wx(f.cx)
    p[4] = an.pxm.wy(f.cy)
    p[2] = p[5] = 0.05
  }
  const nodeScale = 3.5 / ppu / 0.1

  // pins: stems from the axis to the stack top, heads in the dominant colour
  const stems = useMemo(() => new Float32Array(PINS.length * 6), [])
  const lastStem = useRef({ v: -1, f: null as ChartFrame | null })
  const writeStems = (_T: number, s: Float32Array): boolean => {
    if (lastStem.current.v === shown.version && lastStem.current.f === frame) return false
    lastStem.current.v = shown.version
    lastStem.current.f = frame
    for (let k = 0; k < PINS.length; k++) {
      const x = frame.x(PU[k])
      const o = k * 6
      s[o] = s[o + 3] = x
      s[o + 1] = frame.y(0)
      s[o + 4] = frame.y(Math.max(0.012, pinV(PU[k])))
      s[o + 2] = s[o + 5] = 0.03
    }
    return true
  }
  const headScale = 3.6 / ppu / 0.1
  const selScale = 5.2 / ppu / 0.1

  // tap a pin to jump to it (real buttons over the heads, explore only)
  for (let k = 0; k < 8; k++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStageHotspot(`pw-pin-hot-${k}`, {
      box: () => {
        if (k >= PINS.length || shown.m > 0.5) return null
        const x = frame.x(PU[k])
        const y = frame.y(pinV(PU[k]))
        return [
          [x - 0.12, y - 0.12, 0],
          [x + 0.12, y + 0.12, 0],
        ]
      },
      onActivate: () => {
        if (k < PINS.length) usePwExplore.getState().setBench(PINS[k].name)
      },
      ariaLabel: k < PINS.length ? PINS[k].name : 'Benchmark',
      modes: 'explore',
    })
  }

  // labels (explore only)
  const narrow = narrowChart(layout)
  const specs = useMemo<LabelSpec[]>(() => {
    const x = frame.x
    const y = frame.y
    const yRow = y(0) - ua.strip
    const sx = stringX(frame)
    const at0 = (b: { x: number; y: number; h: number }) => pt(an.pxm.wx(b.x), an.pxm.wy(b.y + b.h), 0.08)
    const out: LabelSpec[] = [
      { id: 'pwx-ax-y', text: 'Power output', tone: 'tick', anchor: [x(0), y(frame.vMax), 0], prefer: 'E', only: ['E', 'NE', 'SE'], gapPx: 8, priority: 78, cue: powerTitle },
      // Share mode: the height is the share of energy supply, not power (review r2)
      { id: 'pwx-ax-ys', text: 'Share of energy supply', tone: 'tick', anchor: [x(0), y(frame.vMax), 0], prefer: 'E', only: ['E', 'NE', 'SE'], gapPx: 8, priority: 78, cue: shareTitle },
      { id: 'pwx-ax-x', text: 'Effort duration (log)', tone: 'tick', anchor: [x(0.5), yRow, 0], prefer: 'S', only: ['S'], gapPx: ROW.title, priority: 78 },
    ]
    TICKS.forEach((t, j) => {
      if (narrow && !t.phone) return
      out.push({ id: `pwx-tk-${j}`, text: t.label, tone: 'tick', anchor: [x(uOf(t.s)), yRow, 0], prefer: 'S', only: ['S'], gapPx: ROW.tick, priority: 80 })
    })
    AXIS_ORDER.forEach((key, k) => {
      const sys = ENERGY_SYSTEMS.find((s) => s.key === key)
      if (!sys) return
      out.push({
        id: `pwx-band-${k}`,
        text: sys.duration,
        tone: 'name',
        color: sys.color,
        anchor: [sx[k], yRow, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: ROW.band,
        priority: 74,
      })
    })
    KEYS.forEach((key, i) => {
      const cue = () => (an.curOn && dominantAtT(shown.t) === key ? 1 : 0)
      out.push({
        id: CUR_IDS[i],
        text: calloutText(T_MIN),
        tone: 'callout',
        color: COLOR[key],
        minChars: 24,
        anchor: () => at0(an.cur),
        prefer: 'NE',
        only: ['NE'],
        gapPx: 0,
        leader: true,
        priority: 95,
        cue: () => cue() * flat(),
      })
      // under a real Orbit: anchored at the node, the placer's own placement and leader
      out.push({
        id: CURP_IDS[i],
        text: calloutText(T_MIN),
        tone: 'callout',
        color: COLOR[key],
        minChars: 24,
        anchor: () => {
          const u = cursorUx()
          return pt(x(u), y(nodeV(u)), 0.08)
        },
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 12,
        leader: true,
        priority: 95,
        cue: () => cue() * (1 - flat()),
      })
    })
    for (let b = 0; b < 3; b++) {
      out.push({
        id: `pwx-lane-${b}`,
        text: LANE_TEXT[b],
        tone: 'name',
        color: BAND_COLORS[b],
        anchor: () => pt(x(an.laneU[b]), y(topV(b, an.laneU[b])), 0.05),
        prefer: b === 2 ? 'NE' : 'N',
        gapPx: 10,
        leader: true,
        priority: 70,
        cue: () => Math.max(0, shown.m * 1.4 - 0.4),
      })
    }
    if (MARATHON) {
      const maraCue = () => (beyond() ? 1 : 0.6)
      out.push({
        id: 'pwx-mara',
        text: MARA_TEXT,
        tone: 'callout',
        color: COLOR[MARATHON.dominant],
        anchor: () => at0(an.mara),
        prefer: 'NE',
        only: ['NE'],
        gapPx: 0,
        priority: 88,
        leader: true,
        cue: () => maraCue() * an.maraOn * flat(),
      })
      out.push({
        id: 'pwx-marap',
        text: MARA_TEXT,
        tone: 'callout',
        color: COLOR[MARATHON.dominant],
        anchor: [x(1) + 0.32, y(0), 0.05],
        prefer: 'NW',
        only: ['NW', 'N'],
        gapPx: 12,
        priority: 88,
        leader: true,
        cue: () => maraCue() * (1 - flat()),
      })
    }
    // the chosen benchmark is named at its pin
    PINS.forEach((p, k) => {
      out.push({
        id: `pwx-pin-${k}`,
        text: p.name,
        tone: 'name',
        color: COLOR[p.dominant],
        dot: false,
        anchor: () => pt(x(PU[k]), y(pinV(PU[k])), 0.06),
        prefer: 'N',
        gapPx: 10,
        leader: true,
        priority: 86,
        // named at its pin while the cursor travels there; on arrival the readout carries the name
        cue: () => (usePwExplore.getState().bench === p.name && shown.m < 0.5 && arrivedPin() !== k ? 1 : 0),
      })
    })
    return out
  }, [frame, narrow, PU, ua, an])
  useLabels(mode === 'explore' ? specs : NO_LABELS, { mode: 'explore' })

  // labels never cover the curves, the pins, the cursor or the leaders
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      mode: 'explore',
      maxPoints: 3 * 30 + PINS.length + 1 + 40,
      radiusPx: 6,
      points: (_T, out) => {
        let n = 0
        const S = 30
        for (let b = 0; b < 3; b++)
          for (let i = 0; i < S; i++) {
            const u = i / (S - 1)
            out[n * 3] = frame.x(u)
            out[n * 3 + 1] = frame.y(topV(b, u))
            out[n * 3 + 2] = 0
            n++
          }
        for (let k = 0; k < PINS.length; k++) {
          out[n * 3] = frame.x(PU[k])
          out[n * 3 + 1] = frame.y(pinV(PU[k]))
          out[n * 3 + 2] = 0
          n++
        }
        const u = cursorUx()
        out[n * 3] = frame.x(u)
        out[n * 3 + 1] = frame.y(nodeV(u))
        out[n * 3 + 2] = 0
        n++
        // the leaders, short of the pill each one ends on (front-on only: they are drawn only then)
        if (!an.pxm.affine) return n
        for (let j = 0; j < 2; j++) {
          const f = j === 0 ? an.cur : an.mara
          if (j === 0 && !an.curOn) continue
          if (j === 1 && !an.maraOn) continue
          const len = Math.hypot(f.cx - f.nx, f.cy - f.ny)
          if (len < 20) continue
          const steps = Math.min(19, Math.floor((len - 14) / 10))
          for (let i = 0; i <= steps; i++) {
            const t = (8 + ((len - 20) * i) / Math.max(1, steps)) / len
            out[n * 3] = an.pxm.wx(f.nx + (f.cx - f.nx) * t)
            out[n * 3 + 1] = an.pxm.wy(f.ny + (f.cy - f.ny) * t)
            out[n * 3 + 2] = 0
            n++
          }
        }
        return n
      },
    }),
    [frame, PU, an],
  )
  useWorldObstacle('pw-ex-data', obstacle)

  const selected = (k: number) => bench === PINS[k]?.name
  return (
    <>
      <Construction frame={frame} vis={STATIC} uOfS={uOf} ua={ua} />
      {[0, 1, 2].map((b) => (
        <BandFill key={b} frame={frame} b={b} src={SRC} tier={tier} opacity={() => 1} rim={() => (tier === 'low' ? 0.5 : 0.04)} />
      ))}
      <River
        frame={frame}
        tier={tier}
        liveCurves={liveCurves}
        uniforms={(_T, A) => {
          const u = flow.u
          u.flow = 0.035 * A
          u.bandOn[0] = u.bandOn[1] = u.bandOn[2] = 1
          u.opacity = useStoryStore.getState().mode === 'explore' ? 1 : 0
          u.hot = 0
          for (let b = 0; b < 3; b++) u.hMax[b] = POWER_MAX[b] + (SHARE_MAX[b] - POWER_MAX[b]) * shown.s
          setFlowMorph(flow, shown.m)
          return u
        }}
      />
      <HandoverStrip frame={frame} ua={ua} reveal={() => 1} opacity={() => 0.22} />
      <LaneAxes frame={frame} opacity={() => shown.m} />
      {[0, 1, 2].map((b) => (
        <BandPen key={b} frame={frame} b={b} src={SRC} head={false} opacity={() => 1} />
      ))}
      <Envelope frame={frame} progress={() => 1} opacity={() => Math.max(0, 1 - 2.5 * Math.max(shown.m, shown.s))} />
      <MarathonChevron frame={frame} progress={() => 1} dim={() => 0.9} />
      <Pen
        points={maraLink}
        color={PAL.oxidative}
        width={PEN.grid}
        update={(_T, p) => {
          if (lastMara.current === an.ver) return false
          lastMara.current = an.ver
          writeLink(an.mara, p, an.maraOn > 0)
          return true
        }}
        opacity={() => (beyond() ? 1 : 0.6) * an.maraOn * flat()}
        dim={() => 0.7}
        renderOrder={46}
      />
      <PenBatch segments={stems} color={PAL.chalk} width={PEN.grid} update={writeStems} opacity={() => 0.4 * Math.max(0, 1 - 2 * shown.m)} renderOrder={33} />
      <Nodes
        count={PINS.length}
        radius={0.1}
        color={PAL.chalk}
        colors={PIN_COLORS}
        opacity={() => Math.max(0, 1 - 2 * shown.m)}
        rimStrength={0.7}
        emissiveIntensity={0.55}
        place={(_T, k, out) => {
          out[0] = frame.x(PU[k])
          out[1] = frame.y(pinV(PU[k]))
          out[2] = 0.06
          return selected(k) ? selScale : headScale
        }}
      />
      <Pen points={cur} color={PAL.chalk} width={PEN.axis} update={writeCursor} opacity={() => 0.85} renderOrder={46} />
      <Pen
        points={link}
        color={PAL.chalk}
        width={PEN.grid}
        update={(_T, p) => {
          if (lastLink.current === an.ver) return false
          lastLink.current = an.ver
          writeLink(an.cur, p, an.curOn > 0)
          return true
        }}
        opacity={() => an.curOn * flat()}
        dim={() => 0.62}
        renderOrder={46}
      />
      {/* stacked: ONE node on the stack top in the dominant engine's colour (as in the story);
          lanes: one node on each lane's top, where each engine's power is read */}
      <Nodes
        count={3}
        radius={0.1}
        color={PAL.chalk}
        colors={BAND_COLORS}
        rimStrength={0.8}
        emissiveIntensity={0.7}
        place={(_T, b, out) => {
          const u = cursorUx()
          out[0] = frame.x(u)
          if (shown.m < 0.5) {
            out[1] = frame.y(stackTopAt(u, shown.s))
            out[2] = 0.08
            return BAND_OF[dominantAtT(shown.t)] === b ? nodeScale : 0
          }
          out[1] = frame.y(topV(b, u))
          out[2] = 0.08
          return nodeScale
        }}
      />
    </>
  )
}
