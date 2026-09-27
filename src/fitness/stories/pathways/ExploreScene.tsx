import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ENERGY_SYSTEMS, PAL } from '../../fitnessData'
import { type ChartFrame } from '../../story/kit/chartFrame'
import { useSafeFrame } from '../../story/useSafeFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { sampleCurve } from '../../story/kit/LightField'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { useStageHotspot } from '../../story/hotspots'
import { useBeat } from '../../story/useBeat'
import { useStoryStore } from '../../story/store'
import type { LabelSpec, Tier, V3 } from '../../story/types'
import {
  BAND_COLORS,
  COLOR,
  LANE_BASE,
  MARATHON,
  NAME,
  PINS,
  TABLE,
  T_MAX,
  T_MIN,
  calloutKey,
  calloutText,
  contribInto,
  dominantAtT,
  dominantOf,
  sampleAt,
  thickAt,
  uOf,
  type Shares,
} from './pathwaysMath'
import { bandTopAt, stackTopAt } from './bands'
import { Construction, DurationStrips, MarathonChevron, type ConstructionVis } from './chart'
import { AXIS_ORDER, makeFlowState, segLine, setFlowMorph, type BandSource } from './geom'
import { BandFill, BandPen, Envelope, River } from './elements'
import { LANE_NAME_U, ROW, TICKS, bandStringX, narrowChart, pxPerUnit, underAxis, type UnderAxis } from './layout'
import { usePwExplore } from './exploreStore'
import { shown } from './shown'

/* =========================================================================
   Pathways explore layer (DESIGN.md D.4 "Explore", C.12). Not driven by T:
   the cursor, Stacked | Lanes and Power | Share damp toward the explore
   store, and the river keeps flowing on the ambient clock. Scrub drags the
   cursor; a pin (or a benchmark chip) jumps to that benchmark.
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
const damp = THREE.MathUtils.damp
const NO_LABELS: LabelSpec[] = []
const FULL = 9
const SRC: BandSource = { m: () => shown.m, s: () => shown.s, front: () => FULL }
const PIN_COLORS = PINS.map((p) => COLOR[p.dominant])
const KEYS = ['phosphagen', 'glycolytic', 'oxidative'] as const
const CUR_IDS = KEYS.map((k) => `pwx-cur-${k}`)

/** v of band b's top at u in the displayed mode. */
const topV = (b: number, u: number) => bandTopAt(b, u, shown.m, shown.s)
/** The highest band top at u (the stack top, or the phosphagen lane at the left). */
const peakV = (u: number) => Math.max(topV(0, u), topV(1, u), topV(2, u))
/** Where a pin head sits: on the stack top while stacked, sinking to the axis as the lanes open. */
const pinV = (u: number) => stackTopAt(u, shown.s) * (1 - shown.m)
const cursorUx = () => uOf(shown.t)

export default function ExploreScene({ frame, tier }: { frame: ChartFrame; tier: Tier }) {
  const { layout } = useBeat()
  const mode = useStoryStore((s) => s.mode)
  const ppu = pxPerUnit(frame)
  const ua0 = underAxis(frame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ua: UnderAxis = useMemo(() => ua0, [ua0.tick, ua0.strip])
  const bench = usePwExplore((s) => s.bench)

  // damp the displayed state toward the store (log space for time)
  useSafeFrame('pathways explore damping', (_T, _A, dtRaw) => {
    if (useStoryStore.getState().mode !== 'explore') return
    const dt = Math.min(0.05, dtRaw)
    const st = usePwExplore.getState()
    const lt = Math.log(shown.t)
    const target = Math.log(Math.max(T_MIN, Math.min(T_MAX, st.t)))
    const nlt = Math.abs(lt - target) < 1e-4 ? target : damp(lt, target, 9, dt)
    const nm = damp(shown.m, st.lanes ? 1 : 0, 5, dt)
    const ns = damp(shown.s, st.share ? 1 : 0, 5, dt)
    const t = Math.exp(nlt)
    const m = Math.abs(nm - (st.lanes ? 1 : 0)) < 1e-3 ? (st.lanes ? 1 : 0) : nm
    const s = Math.abs(ns - (st.share ? 1 : 0)) < 1e-3 ? (st.share ? 1 : 0) : ns
    if (t !== shown.t || m !== shown.m || s !== shown.s) {
      shown.t = t
      shown.m = m
      shown.s = s
      shown.version++
    }
  }, { priority: -10 })
  // entering explore snaps the displayed state to the seed (no glide from a stale state)
  useEffect(() => {
    if (mode !== 'explore') return
    const st = usePwExplore.getState()
    shown.t = st.t
    shown.m = st.lanes ? 1 : 0
    shown.s = st.share ? 1 : 0
    shown.version++
  }, [mode])

  // the light's band curves follow Power | Share (repacked only when s moves)
  const live = useMemo(() => ({ a: new Float32Array(128), b: new Float32Array(128), c: new Float32Array(128), s: -1 }), [])
  const fns = useMemo(
    () =>
      [0, 1, 2].map((b) => (u: number) => {
        const p = thickAt(b, u)
        return live.s <= 0 ? p : p + (sampleAt(TABLE.share[b], u) - p) * live.s
      }),
    [live],
  )
  const liveCurves = () => {
    if (live.s === shown.s) return null
    live.s = shown.s
    sampleCurve(fns[0], live.a)
    sampleCurve(fns[1], live.b)
    sampleCurve(fns[2], live.c)
    return live
  }
  const flow = useMemo(() => makeFlowState(), [])

  // cursor: a core sample from the axis through the bands, one node on each band's top
  const cur = useMemo(() => new Float32Array(6), [])
  const lastCur = useRef({ v: -1, f: null as ChartFrame | null })
  const writeCursor = (_T: number, p: Float32Array): boolean => {
    if (lastCur.current.v === shown.version && lastCur.current.f === frame) return false
    lastCur.current.v = shown.version
    lastCur.current.f = frame
    const u = cursorUx()
    p[0] = p[3] = frame.x(u)
    p[1] = frame.y(0)
    p[4] = frame.y(peakV(u) + 0.035)
    p[2] = p[5] = 0.05
    return true
  }
  const nodeScale = 3.5 / ppu / 0.1

  // pins: stems from the axis to the stack top, heads in the dominant colour
  const PU = useMemo(() => PINS.map((p) => uOf(p.seconds)), [])
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
    // the duration strings, packed so they never touch on a 360 px phone
    const sx = bandStringX(frame)
    const out: LabelSpec[] = [
      { id: 'pwx-ax-y', text: 'Power output', tone: 'tick', anchor: [x(0), y(frame.vMax), 0], prefer: 'E', only: ['E', 'NE', 'SE'], gapPx: 8, priority: 78, cue: () => 1 - shown.m },
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
    KEYS.forEach((key) => {
      out.push({
        id: `pwx-cur-${key}`,
        text: calloutText(T_MIN),
        tone: 'callout',
        color: COLOR[key],
        minChars: 24,
        anchor: () => {
          const u = cursorUx()
          return pt(x(u), y(peakV(u)), 0.08)
        },
        prefer: 'NE',
        gapPx: 14,
        leader: true,
        priority: 95,
        cue: () => (dominantAtT(shown.t) === key ? 1 : 0),
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
        text: MARATHON.name,
        tone: 'callout',
        color: COLOR[MARATHON.dominant],
        anchor: [x(1) + 0.2, y(0), 0],
        prefer: 'N',
        only: ['N', 'NW'],
        gapPx: 12,
        priority: 88,
        leader: true,
        cue: () => (usePwExplore.getState().bench === MARATHON.name ? 1 : 0.6),
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
        cue: () => (usePwExplore.getState().bench === p.name && shown.m < 0.5 ? 1 : 0),
      })
    })
    return out
  }, [frame, narrow, PU, ua])
  useLabels(mode === 'explore' ? specs : NO_LABELS, { mode: 'explore' })

  // cursor callout text (computed): rebuilt only when it changes, written every
  // frame (a no-op when equal) so a re-registered label always shows it
  const txt = useRef({ key: -1, text: '', c: { phosphagen: 0, glycolytic: 0, oxidative: 0 } as Shares })
  useSafeFrame('pathways explore callout', () => {
    if (useStoryStore.getState().mode !== 'explore') return
    const r = txt.current
    contribInto(shown.t, r.c)
    const d = dominantOf(r.c)
    const k = calloutKey(shown.t, KEYS.indexOf(d), Math.round(r.c[d]))
    if (k !== r.key) {
      r.key = k
      r.text = calloutText(shown.t)
    }
    for (const id of CUR_IDS) setLabelText(id, r.text)
  })

  // labels never cover the curves, the pins or the cursor
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      mode: 'explore',
      maxPoints: 3 * 30 + PINS.length + 3,
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
        for (let b = 0; b < 3; b++) {
          out[n * 3] = frame.x(u)
          out[n * 3 + 1] = frame.y(topV(b, u))
          out[n * 3 + 2] = 0
          n++
        }
        return n
      },
    }),
    [frame, PU],
  )
  useWorldObstacle('pw-ex-data', obstacle)

  const selected = (k: number) => bench === PINS[k]?.name
  return (
    <>
      <Construction frame={frame} vis={STATIC} uOfS={uOf} ua={ua} />
      {[0, 1, 2].map((b) => (
        <BandFill key={b} frame={frame} b={b} src={SRC} tier={tier} opacity={() => 1} rim={() => (tier === 'low' ? 0.5 : 0.04)} />
      ))}
      {tier !== 'low' && (
        <River
          frame={frame}
          tier={tier}
          liveCurves={liveCurves}
          uniforms={(_T, A) => {
            const u = flow.u
            u.flow = 0.035 * A
            u.bandOn[0] = u.bandOn[1] = u.bandOn[2] = 1
            u.opacity = 1
            u.hot = 0
            setFlowMorph(flow, shown.m)
            return u
          }}
        />
      )}
      <DurationStrips frame={frame} ua={ua} reveal={() => 1} opacity={() => 0.13} />
      <PenBatch segments={laneSegs} color={PAL.chalk} width={PEN.grid} opacity={() => shown.m} dim={() => 0.4} renderOrder={29} />
      {[0, 1, 2].map((b) => (
        <BandPen key={b} frame={frame} b={b} src={SRC} head={false} opacity={() => 1} />
      ))}
      <Envelope frame={frame} progress={() => 1} opacity={() => Math.max(0, 1 - 2.5 * Math.max(shown.m, shown.s))} />
      <MarathonChevron frame={frame} progress={() => 1} dim={() => 0.9} />
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
          out[1] = frame.y(topV(b, u))
          out[2] = 0.08
          return nodeScale
        }}
      />
    </>
  )
}
