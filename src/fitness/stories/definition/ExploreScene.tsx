import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODAL_DOMAINS, PAL, POWER_DURATION_LABELS, POWER_TASKS } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { LightField, sampleCurve } from '../../story/kit/LightField'
import { Nodes } from '../../story/kit/Nodes'
import { lin } from '../../story/kit/materials'
import { TIERS } from '../../story/quality/tiers'
import { useLabels, setLabelText } from '../../story/labels/useLabel'
import { useBeat } from '../../story/useBeat'
import type { LabelSpec, V3 } from '../../story/types'
import { FAN_Z } from './layout'
import { CURVE_BY_KEY, GENERALIST, domainScale, valAt } from './definitionMath'
import { ChartConstruction, EnergyBands, TASK_U, TICK_LEN, curvePolyline, curveTop, gv, type ChartVis } from './chart'
import { useDefExplore } from './exploreStore'

/* =========================================================================
   Definition explore scene (DESIGN.md D.5 "Explore", C.12). Not driven by
   T: the chosen athlete's curve morphs toward its samples (damped), the
   generalist stays as a ghost for scale, and the light replays the
   spill / condense for that athlete. Optional: the five modal domains in
   depth, and a scrub probe reading relative power at any duration.
   ========================================================================= */

const STATIC: ChartVis = {
  grid: { progress: () => 1, opacity: () => 0.12 },
  axes: { progress: () => 1, opacity: () => 0.55 },
  ticks: { progress: () => 1, opacity: () => 0.6 },
}

/** Damped explore state shared by the explore elements this frame. */
const shown = {
  samples: GENERALIST.samples.slice(),
  mix: 1,
  fan: 0,
  ghost: 0,
  isG: 1,
  version: 0,
}

const damp = THREE.MathUtils.damp

const activeV = (u: number) => valAt(shown.samples, u)

export default function ExploreScene({ frame, tier }: { frame: ChartFrame; tier: 'high' | 'medium' | 'low' }) {
  const { layout } = useBeat()
  const athlete = useDefExplore((s) => s.athlete)
  const replay = useDefExplore((s) => s.replay)
  const showDomains = useDefExplore((s) => s.showDomains)
  const ghostOn = useDefExplore((s) => s.ghost)
  const probe = useDefExplore((s) => s.probe)
  const target = CURVE_BY_KEY[athlete]?.samples ?? GENERALIST.samples
  const isG = athlete === GENERALIST.name
  const lowTier = tier === 'low'

  // replay the spill / condense whenever the athlete changes
  useEffect(() => {
    shown.mix = 0
  }, [replay])
  useEffect(() => {
    shown.samples = target.slice()
    shown.mix = 1
    shown.version++
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scales = useMemo(() => domainScale(athlete), [athlete])
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw)
    let moved = false
    for (let i = 0; i < shown.samples.length; i++) {
      const v = damp(shown.samples[i], target[i], 7, dt)
      if (Math.abs(v - shown.samples[i]) > 1e-5) moved = true
      shown.samples[i] = v
    }
    if (moved) shown.version++
    shown.mix = damp(shown.mix, 1, 2.2, dt)
    shown.fan = damp(shown.fan, showDomains ? 1 : 0, 6, dt)
    shown.ghost = damp(shown.ghost, !isG && ghostOn ? 1 : 0, 8, dt)
    shown.isG = damp(shown.isG, isG ? 1 : 0, 8, dt)
  }, -10)

  const gCurve = useMemo(() => curvePolyline(frame, gv, 0.02), [frame])
  const aCurve = useMemo(() => curvePolyline(frame, gv, 0.04), [frame])
  const aTop = useMemo(() => curveTop(frame, gv), [frame])
  const curveA = useMemo(() => sampleCurve(gv), [])
  const liveB = useMemo(() => new Float32Array(128), [])
  const count = Math.round(9000 * TIERS[tier].particleScale)

  const lastA = useRef(-1)
  const writeActive = (_T: number, pts: Float32Array): boolean => {
    if (lastA.current === shown.version) return false
    lastA.current = shown.version
    const n = pts.length / 3
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1)
      pts[i * 3] = frame.x(u)
      pts[i * 3 + 1] = frame.y(activeV(u))
      pts[i * 3 + 2] = 0.04
    }
    return true
  }
  const lastTop = useRef(-1)
  const writeTop = (_T: number, top: Float32Array): boolean => {
    if (lastTop.current === shown.version) return false
    lastTop.current = shown.version
    const n = top.length / 2
    for (let i = 0; i < n; i++) top[i * 2 + 1] = frame.y(activeV(i / (n - 1)))
    return true
  }
  const lastB = useRef(-1)
  useEffect(() => {
    lastA.current = -1
    lastTop.current = -1
    lastB.current = -1
  }, [isG, frame])

  // domain fan for the active athlete
  const N = 72
  const fanBuf = useMemo(() => {
    const segs = new Float32Array(MODAL_DOMAINS.length * (N - 1) * 6)
    const cols = new Float32Array(segs.length)
    MODAL_DOMAINS.forEach((d, k) => {
      const c = lin(d.color)
      for (let i = 0; i < N - 1; i++) cols.set([c.r, c.g, c.b, c.r, c.g, c.b], (k * (N - 1) + i) * 6)
    })
    return { segs, cols }
  }, [])
  const fanKey = useRef('')
  const writeFan = (_T: number, s: Float32Array): boolean => {
    const key = `${shown.version}|${shown.fan.toFixed(4)}|${athlete}`
    if (key === fanKey.current) return false
    fanKey.current = key
    MODAL_DOMAINS.forEach((_, k) => {
      const z = (-FAN_Z + (2 * FAN_Z * k) / (MODAL_DOMAINS.length - 1)) * shown.fan
      const m = 1 + (scales[k] - 1) * shown.fan
      for (let i = 0; i < N - 1; i++) {
        const u0 = i / (N - 1)
        const u1 = (i + 1) / (N - 1)
        const o = (k * (N - 1) + i) * 6
        s[o] = frame.x(u0)
        s[o + 1] = frame.y(activeV(u0) * m)
        s[o + 2] = z
        s[o + 3] = frame.x(u1)
        s[o + 4] = frame.y(activeV(u1) * m)
        s[o + 5] = z
      }
    })
    return true
  }

  // probe line
  const probeRef = useRef<number | null>(null)
  probeRef.current = probe
  const probePts = useMemo(() => new Float32Array(6), [])
  const lastProbe = useRef<number | null>(-1)
  const writeProbe = (_T: number, pts: Float32Array): boolean => {
    const p = probeRef.current
    if (p === lastProbe.current) return false
    lastProbe.current = p
    const u = p ?? 0
    pts[0] = pts[3] = frame.x(u)
    pts[1] = frame.y(0)
    pts[4] = frame.y(frame.vMax)
    pts[2] = pts[5] = 0.06
    return true
  }

  // labels
  const specs = useMemo<LabelSpec[]>(() => {
    const x = frame.x
    const y = frame.y
    const y0 = y(0)
    const out: LabelSpec[] = [
      { id: 'ex-ax-y', text: 'Power output', tone: 'tick', anchor: [x(0), y(frame.vMax), 0], prefer: 'E', only: ['E', 'NE', 'SE'], gapPx: 8, priority: 78 },
      { id: 'ex-ax-x', text: 'Effort duration', tone: 'tick', anchor: [x(0.5), y0 - TICK_LEN, 0], prefer: 'S', only: ['S'], gapPx: 25, priority: 78 },
      { id: 'ex-yr-05', text: '0.5', tone: 'tick', anchor: [x(0) - TICK_LEN, y(0.5), 0], prefer: 'W', gapPx: 5 },
      { id: 'ex-yr-10', text: '1.0', tone: 'tick', anchor: [x(0) - TICK_LEN, y(1), 0], prefer: 'W', gapPx: 5 },
      {
        id: 'ex-athlete',
        text: athlete,
        tone: 'callout',
        color: isG ? PAL.yellowGreen : PAL.chalk,
        anchor: () => [x(0.3), y(activeV(0.3)), 0] as V3,
        prefer: 'NE',
        gapPx: 16,
        leader: true,
        priority: 90,
      },
      {
        id: 'ex-ghost',
        text: 'Generalist, for scale',
        tone: 'name',
        color: PAL.yellowGreen,
        anchor: [x(0.72), y(gv(0.72)), 0],
        prefer: 'N',
        gapPx: 10,
        priority: 60,
        cue: () => shown.ghost,
      },
      {
        id: 'ex-probe-a',
        text: '0.00',
        tone: 'readout',
        size: 'sm',
        minChars: 4,
        color: isG ? PAL.yellowGreen : PAL.chalk,
        anchor: () => {
          const u = probeRef.current ?? 0
          return [x(u), y(activeV(u)), 0.06] as V3
        },
        prefer: 'E',
        gapPx: 10,
        priority: 95,
        cue: () => (probeRef.current === null ? 0 : 1),
      },
      {
        id: 'ex-probe-g',
        text: '0.00',
        tone: 'readout',
        size: 'sm',
        minChars: 4,
        color: PAL.yellowGreen,
        anchor: () => {
          const u = probeRef.current ?? 0
          return [x(u), y(gv(u)), 0.06] as V3
        },
        prefer: 'W',
        gapPx: 10,
        priority: 94,
        cue: () => (probeRef.current === null || isG ? 0 : 1),
      },
    ]
    const tickIdx = layout === 'P' ? [0, 1, 3, 4, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7]
    tickIdx.forEach((i) => {
      out.push({ id: `ex-tk-${i}`, text: POWER_DURATION_LABELS[i], tone: 'tick', anchor: [x(i / 7), y0 - TICK_LEN, 0], prefer: 'S', only: ['S'], gapPx: 5, priority: 80 })
    })
    MODAL_DOMAINS.forEach((d, k) => {
      out.push({
        id: `ex-dom-${k}`,
        text: d.name,
        tone: 'name',
        color: d.color,
        anchor: () => {
          const z = (-FAN_Z + (2 * FAN_Z * k) / (MODAL_DOMAINS.length - 1)) * shown.fan
          return [x(1), y(activeV(1) * (1 + (scales[k] - 1) * shown.fan)), z] as V3
        },
        prefer: 'E',
        gapPx: 8,
        priority: 65,
        cue: () => Math.max(0, shown.fan * 1.4 - 0.4),
      })
    })
    return out
  }, [frame, layout, athlete, isG, scales])
  useLabels(specs)

  // probe readouts (computed valAt), written imperatively
  useFrame(() => {
    const p = probeRef.current
    if (p === null) return
    setLabelText('ex-probe-a', activeV(p).toFixed(2))
    setLabelText('ex-probe-g', gv(p).toFixed(2))
  })

  const place = (_T: number, i: number, out: [number, number, number]) => {
    const u = TASK_U[i]
    out[0] = frame.x(u)
    out[1] = frame.y(activeV(u))
    out[2] = 0.05
    return 1
  }

  return (
    <>
      <ChartConstruction frame={frame} vis={STATIC} />
      <EnergyBands frame={frame} opacity={() => 0.12} />
      <AreaFill top={aTop} baseline={frame.y(0)} color={isG ? PAL.yellowGreen : PAL.chalk} opacity={() => (lowTier ? 0.9 : 0.3)} update={writeTop} hi={lowTier ? 0.5 : 0.36} />
      {!lowTier && count > 0 && (
        <LightField
          frame={frame}
          count={count}
          curveA={curveA}
          curveB={curveA}
          liveCurves={() => {
            if (lastB.current === shown.version) return null
            lastB.current = shown.version
            sampleCurve(activeV, liveB)
            return { a: curveA, b: liveB }
          }}
          uniforms={() =>
            shown.isG > 0.5
              ? { mode: 0, level: 1.08, mix: 0, hot: 0, opacity: 1 }
              : { mode: 1, level: 1.08, mix: shown.mix, hot: 0, opacity: 1 }
          }
        />
      )}
      <Nodes count={POWER_TASKS.length} radius={0.15} color={PAL.chalk} place={place} rimStrength={0.5} emissiveIntensity={0.55} />
      <Pen points={gCurve} color={PAL.yellowGreen} width={PEN.data} opacity={() => 0.45 * shown.ghost} renderOrder={44} />
      <PenBatch segments={fanBuf.segs} colors={fanBuf.cols} width={PEN.data} update={writeFan} opacity={() => Math.min(1, shown.fan * 1.5)} renderOrder={31} />
      <Pen
        key={isG ? 'g' : 's'}
        points={aCurve}
        color={isG ? PAL.yellowGreen : PAL.chalk}
        width={PEN.data}
        dashed={!isG}
        dashSize={0.3}
        gapSize={0.2}
        update={writeActive}
        renderOrder={45}
      />
      <Pen points={probePts} color={PAL.chalk} width={PEN.axis} update={writeProbe} opacity={() => (probeRef.current === null ? 0 : 0.7)} renderOrder={46} />
    </>
  )
}
