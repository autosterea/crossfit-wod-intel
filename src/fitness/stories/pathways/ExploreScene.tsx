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
import { Construction, DurationStrips, MarathonChevron, type ConstructionVis } from './chart'
import { AXIS_ORDER, FLOW_CURVES, makeFlowState, segLine, setFlowMorph, type BandSource } from './geom'
import { BandFill, BandPen, Envelope } from './elements'
import { River } from './River'
import { LANE_NAME_U, ROW, TICKS, legendX, narrowChart, pxPerUnit, underAxis, type UnderAxis } from './layout'
import { PxMap, addBlocker, addHud, boundsInto, newBlockers, newFlag, putSig, sizeInto, solveFlag, type Floor } from './annot'
import { usePwExplore } from './exploreStore'
import { shown } from './shown'

/* =========================================================================
   Pathways explore layer (DESIGN.md D.4 "Explore", C.12). Not driven by T:
   the cursor, Stacked | Lanes and Power | Share damp toward the explore
   store, and the river keeps flowing on the ambient clock. Scrub drags the
   cursor (the default here: this is a chart you read front-on); a pin, or a
   benchmark chip, jumps to that benchmark. The cursor's readout and the
   Marathon chip are laid out like the story's (annot.ts).
   ========================================================================= */

const STATIC: ConstructionVis = {
  axes: { progress: () => 1, dim: () => 0.55 },
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
/** Band index (bottom to top) of each engine. */
const BAND_OF: Record<(typeof KEYS)[number], number> = { phosphagen: 2, glycolytic: 1, oxidative: 0 }
const MARA_TEXT = MARATHON ? `${MARATHON.name} - ${fmtDuration(MARATHON.seconds)}` : ''

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
  // blends two Float32Arrays per frame (no allocation, no per-sample math)
  const live = useMemo(
    () => ({
      a: [new Float32Array(128), new Float32Array(128), new Float32Array(128)] as [Float32Array, Float32Array, Float32Array],
      share: [0, 1, 2].map((b) => sampleCurve((u) => shareThickAt(b, u))),
      s: -1,
    }),
    [],
  )
  const liveCurves = () => {
    if (live.s === shown.s) return null
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
    () => ({ pxm: new PxMap(), B: { x: 0, y: 0, w: 0, h: 0 } as Rect, bl: newBlockers(16), cur: newFlag(), curOn: 0, mara: newFlag(), sz: { w: 0, h: 0 }, sig: new Float64Array(8), ver: 0 }),
    [],
  )
  // the surfaces the chips keep clear of, in stage px: the cursor's band (the
  // stack top, or its engine's lane), and the highest band anywhere (Marathon)
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
      const u = cursorUx()
      const nx = pxm.px(frame.x(u))
      const ny = pxm.py(frame.y(nodeV(u)))
      const tipX = pxm.px(frame.x(1) + 0.32)
      const axisX = pxm.px(frame.x(0))
      bl.n = 0
      addHud(bl)
      if (shown.m < 0.5) for (let k = 0; k < PINS.length; k++) {
        const x = pxm.px(frame.x(PU[k]))
        const y = pxm.py(frame.y(pinV(PU[k])))
        if (Math.abs(x - nx) > 1 || Math.abs(y - ny) > 1) addBlocker(bl, x - 8, y - 8, 16, 16)
      }
      an.curOn = beyond() ? 0 : 1
      if (an.curOn) {
        sizeInto(CUR_IDS[KEYS.indexOf(dominantAtT(shown.t))], '00 SEC - GLYCOLYTIC 00%', 'callout', an.sz)
        solveFlag(an.cur, nx, ny, an.sz.w, an.sz.h, floors.cursor, axisX + 6, tipX - 10, bl, B)
        const f = an.cur
        addBlocker(bl, f.x - 3, f.y - 3, f.w + 6, f.h + 6)
        addBlocker(bl, Math.min(f.nx, f.cx) - 4, Math.min(f.cy, f.ny), Math.abs(f.nx - f.cx) + 8, Math.abs(f.ny - f.cy))
      }
      sizeInto('pwx-mara', MARA_TEXT, 'callout', an.sz)
      solveFlag(an.mara, tipX, pxm.py(frame.y(0)), an.sz.w, an.sz.h, floors.top, axisX + 6, B.x + B.w, bl, B)
      const s = an.sig
      let moved = putSig(s, 0, an.cur.x)
      moved = putSig(s, 1, an.cur.y) || moved
      moved = putSig(s, 2, an.mara.x) || moved
      moved = putSig(s, 3, an.mara.y) || moved
      moved = putSig(s, 4, an.cur.nx) || moved
      moved = putSig(s, 5, an.cur.ny) || moved
      if (moved) {
        an.ver++
        bumpObstacles()
      }
    },
    { priority: -84 },
  )

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

  // lane baselines while the lanes are open
  const laneSegs = useMemo(() => {
    const s: number[] = []
    for (const v of [LANE_BASE[1], LANE_BASE[2]]) {
      const a = segLine([frame.x(0), frame.y(v), -0.01], [frame.x(1), frame.y(v), -0.01], 1)
      s.push(a[0], a[1], a[2], a[3], a[4], a[5])
    }
    return new Float32Array(s)
  }, [frame])

  // labels (explore only)
  const narrow = narrowChart(layout)
  const specs = useMemo<LabelSpec[]>(() => {
    const x = frame.x
    const y = frame.y
    const yRow = y(0) - ua.strip
    const lx = legendX(frame)
    const at0 = (b: { x: number; y: number; h: number }) => pt(an.pxm.wx(b.x), an.pxm.wy(b.y + b.h), 0.08)
    const out: LabelSpec[] = [
      { id: 'pwx-ax-y', text: 'Power output', tone: 'tick', anchor: [x(0), y(frame.vMax), 0], prefer: 'E', only: ['E', 'NE', 'SE'], gapPx: 8, priority: 78 },
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
        anchor: [lx[k], yRow, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: ROW.band,
        priority: 74,
      })
    })
    KEYS.forEach((key) => {
      out.push({
        id: `pwx-cur-${key}`,
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
        cue: () => (an.curOn && dominantAtT(shown.t) === key ? 1 : 0),
      })
    })
    for (let b = 0; b < 3; b++) {
      out.push({
        id: `pwx-lane-${b}`,
        text: NAME[KEYS[2 - b]],
        tone: 'name',
        color: BAND_COLORS[b],
        anchor: () => pt(x(LANE_NAME_U[b]), y(topV(b, LANE_NAME_U[b])), 0.05),
        prefer: b === 2 ? 'NE' : 'N',
        gapPx: 10,
        leader: true,
        priority: 70,
        cue: () => Math.max(0, shown.m * 1.4 - 0.4),
      })
    }
    if (MARATHON)
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
        cue: () => (beyond() ? 1 : 0.6),
      })
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

  // cursor callout text (computed): rebuilt only when it changes, written every
  // frame (a no-op when equal) so a re-registered label always shows it
  const txt = useRef({ key: -1, text: '', c: { phosphagen: 0, glycolytic: 0, oxidative: 0 } as Shares })
  useSafeFrame('pathways explore callout', () => {
    if (useStoryStore.getState().mode !== 'explore') return
    const r = txt.current
    contribInto(shown.t, r.c)
    const d = dominantOf(r.c)
    // at a chosen benchmark the readout carries its name, as the story's result chips do
    const at = arrivedPin()
    const k = calloutKey(shown.t, KEYS.indexOf(d), Math.round(r.c[d])) * 16 + at + 1
    if (k !== r.key) {
      r.key = k
      r.text = at >= 0 ? PINS[at].name + ' - ' + calloutText(shown.t) : calloutText(shown.t)
    }
    for (const id of CUR_IDS) setLabelText(id, r.text)
  })

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
        // the leaders, short of the pill each one ends on
        for (let j = 0; j < 2; j++) {
          const f = j === 0 ? an.cur : an.mara
          if (j === 0 && !an.curOn) continue
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
      <DurationStrips frame={frame} ua={ua} reveal={() => 1} opacity={() => 0.13} />
      <PenBatch segments={laneSegs} color={PAL.chalk} width={PEN.grid} opacity={() => shown.m} dim={() => 0.4} renderOrder={29} />
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
          writeLink(an.mara, p, true)
          return true
        }}
        opacity={() => (beyond() ? 1 : 0.6)}
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
        opacity={() => an.curOn}
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
