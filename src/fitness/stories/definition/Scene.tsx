import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODAL_DOMAINS, PAL, POWER_DURATION_LABELS, POWER_TASKS, ENERGY_SYSTEMS } from '../../fitnessData'
import { clock } from '../../story/clock'
import { at, focus, stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useChartFrame, type ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { LightField, sampleCurve } from '../../story/kit/LightField'
import { Nodes } from '../../story/kit/Nodes'
import { SdfText } from '../../story/kit/SdfText'
import { Halo } from '../../story/kit/Halo'
import { lin, makeRimStandard } from '../../story/kit/materials'
import { TIERS } from '../../story/quality/tiers'
import { impactK } from '../../story/kit/impact'
import { useLabels } from '../../story/labels/useLabel'
import type { Layout, LabelSpec, V3 } from '../../story/types'
import { FRAME_OPTS, FAN_Z, live, lineup } from './layout'
import { GENERALIST, POWERLIFTER, RANKED, domainScale, scoreOf, scoreWord, valAt } from './definitionMath'
import { BAND_U, ChartConstruction, EnergyBands, TASK_400, TASK_PRIORITY, TASK_U, TICK_LEN, curvePolyline, curveTop, gv, type ChartVis } from './chart'
import ExploreScene from './ExploreScene'

/* =========================================================================
   04 CAPACITY, "The integral" (DESIGN.md D.5). Seven beats, every property a
   pure function of story time T:
     D0 a measured point, D1 the falling curve, D2 the five modal domains in
     depth, D3 light pours into the area (signature), D4 the three models as
     the axes, D5 the Powerlifter spills the area it cannot hold, D6 the
     ranked lineup of all seven curves.
   ========================================================================= */

const D = { measured: 0, curve: 1, domains: 2, area: 3, synthesis: 4, specialist: 5, lineup: 6 } as const
const pv = (u: number) => valAt(POWERLIFTER.samples, u)
const G_SCORE = scoreOf(GENERALIST.samples)
const P_SCORE = scoreOf(POWERLIFTER.samples)

/* ------------------------------ timing -------------------------------- */

/** Chart content fades out as the chart folds into the lineup (D6). */
const chartFade = (T: number) => 1 - at(T, D.lineup, 0.12, 0.3)
/** D2 fan: 0 flat, 1 fully fanned in depth. */
export const fan = (T: number) => at(T, D.domains, 0, 0.35, ease.morph) - at(T, D.domains, 0.5, 0.9, ease.morph)
/** D3 pour level in v units. */
/** The pour level starts just below the axis so no particle is in flight at D3 t = 0 (continuity). */
const POUR_LEAD = 0.2
const pourLevel = (T: number) => -POUR_LEAD + (1.08 + POUR_LEAD) * at(T, D.area, 0.05, 0.8)
/** D5 generalist ghost: 1 -> 0.45 */
const ghost = (T: number) => 1 - 0.55 * at(T, D.specialist, 0, 0.2, ease.settle)
/** D5 spill / condense mix */
const spillMix = (T: number) => at(T, D.specialist, 0.45, 0.9)
/** D6 flip into row 1 */
const flip = (T: number) => at(T, D.lineup, 0, 0.3, ease.morph)

const constructionVis: ChartVis = {
  grid: { progress: (T) => at(T, D.measured, 0.05, 0.3, ease.draw), opacity: (T) => 0.12 * chartFade(T) },
  axes: { progress: (T) => at(T, D.measured, 0, 0.3, ease.draw), opacity: (T) => 0.55 * focus(T, D.measured) * chartFade(T) },
  ticks: { progress: (T) => at(T, D.measured, 0.15, 0.35), opacity: (T) => 0.6 * focus(T, D.measured) * chartFade(T) },
}

/** Score shown in the HUD for story time T (computed, never written into prose). */
export function hudScore(T: number): number {
  if (T < D.area) return 0
  if (T < D.specialist) {
    // pour: round(150 x mean over u of min(level, valAt)), the same 64 samples scoreOf uses
    let s = 0
    const lvl = Math.max(0, pourLevel(T))
    for (let i = 0; i < 64; i++) s += Math.min(lvl, gv(i / 63))
    return Math.min(100, Math.round((s / 64) * 150))
  }
  const k = ease.count(spillMix(T))
  return Math.round(G_SCORE + (P_SCORE - G_SCORE) * k)
}
export const hudOpacity = (T: number) => at(T, D.area, 0.02, 0.12) * (1 - at(T, D.lineup, 0, 0.15))

/* ------------------------------ elements ------------------------------ */

function TaskDots({ frame }: { frame: ChartFrame }) {
  const place = (T: number, i: number, out: [number, number, number]) => {
    const u = TASK_U[i]
    out[0] = frame.x(u)
    out[1] = frame.y(gv(u))
    out[2] = 0.02
    let s: number
    if (i === TASK_400) s = at(T, D.measured, 0.4, 0.55, ease.snap)
    else {
      const j = i < TASK_400 ? i : i - 1
      s = stagger(T, D.curve + 0.05, D.curve + 0.4, j, POWER_TASKS.length - 1, 0.35, ease.snap)
    }
    return s
  }
  return (
    <Nodes
      count={POWER_TASKS.length}
      radius={0.15}
      color={PAL.chalk}
      place={place}
      opacity={(T) => focus(T, D.curve) * ghost(T) * chartFade(T)}
      rimStrength={0.5}
      emissiveIntensity={0.55}
    />
  )
}

function DimensionLines({ frame }: { frame: ChartFrame }) {
  const u = TASK_U[TASK_400]
  const x = frame.x(u)
  const y = frame.y(gv(u))
  const h = useMemo(() => new Float32Array([x, y, 0.01, frame.x(0), y, 0.01]), [x, y, frame])
  const v = useMemo(() => new Float32Array([x, y, 0.01, x, frame.y(0), 0.01]), [x, y, frame])
  const progress = (T: number) => at(T, D.measured, 0.6, 0.9, ease.draw)
  const opacity = (T: number) => 0.7 * (1 - at(T, D.curve, 0.3, 0.5))
  return (
    <>
      <Pen points={h} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.22} gapSize={0.16} progress={progress} opacity={opacity} />
      <Pen points={v} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.22} gapSize={0.16} progress={progress} opacity={opacity} />
    </>
  )
}

function DomainFan({ frame }: { frame: ChartFrame }) {
  const N = 72
  const scales = useMemo(() => domainScale(GENERALIST.name), [])
  const { segments, colors } = useMemo(() => {
    const segs = new Float32Array(MODAL_DOMAINS.length * (N - 1) * 6)
    const cols = new Float32Array(segs.length)
    MODAL_DOMAINS.forEach((d, k) => {
      const c = lin(d.color)
      for (let i = 0; i < N - 1; i++) {
        const o = (k * (N - 1) + i) * 6
        cols.set([c.r, c.g, c.b, c.r, c.g, c.b], o)
      }
    })
    return { segments: segs, colors: cols }
  }, [])
  const last = useRef(-1)
  const write = (T: number, s: Float32Array): boolean => {
    const f = fan(T)
    if (f === last.current) return false
    last.current = f
    MODAL_DOMAINS.forEach((_, k) => {
      const z = (-FAN_Z + (2 * FAN_Z * k) / (MODAL_DOMAINS.length - 1)) * f
      const m = 1 + (scales[k] - 1) * f
      for (let i = 0; i < N - 1; i++) {
        const u0 = i / (N - 1)
        const u1 = (i + 1) / (N - 1)
        const o = (k * (N - 1) + i) * 6
        s[o] = frame.x(u0)
        s[o + 1] = frame.y(gv(u0) * m)
        s[o + 2] = z
        s[o + 3] = frame.x(u1)
        s[o + 4] = frame.y(gv(u1) * m)
        s[o + 5] = z
      }
    })
    return true
  }
  useEffect(() => {
    last.current = -1
  }, [frame])
  return (
    <PenBatch
      segments={segments}
      colors={colors}
      width={PEN.data}
      update={write}
      opacity={(T) => Math.min(1, fan(T) * 3)}
      renderOrder={31}
    />
  )
}

function DepthTicks({ frame }: { frame: ChartFrame }) {
  const { segments, colors } = useMemo(() => {
    const s: number[] = []
    const c: number[] = []
    MODAL_DOMAINS.forEach((d, k) => {
      const z = -FAN_Z + (2 * FAN_Z * k) / (MODAL_DOMAINS.length - 1)
      s.push(frame.x(0), frame.y(0), z, frame.x(0), frame.y(0) + 1.1, z)
      const col = lin(d.color)
      c.push(col.r, col.g, col.b, col.r, col.g, col.b)
    })
    // the depth axis itself
    s.push(frame.x(0), frame.y(0), -FAN_Z - 0.3, frame.x(0), frame.y(0), FAN_Z + 0.3)
    const ch = lin(PAL.chalk)
    c.push(ch.r, ch.g, ch.b, ch.r, ch.g, ch.b)
    return { segments: new Float32Array(s), colors: new Float32Array(c) }
  }, [frame])
  return (
    <PenBatch
      segments={segments}
      colors={colors}
      width={PEN.hero}
      progress={(T) => at(T, D.synthesis, 0.35, 0.55)}
      opacity={(T) => 1 - at(T, D.specialist, 0, 0.15)}
    />
  )
}

function ClaimPlate({ frame }: { frame: ChartFrame }) {
  const plate = useRef<THREE.Mesh>(null)
  const group = useRef<THREE.Group>(null)
  const size = Math.min(0.95, Math.max(0.62, frame.FW * 0.085))
  const geo = useMemo(() => {
    const w = 1
    const h = 1
    const r = 0.16
    const s = new THREE.Shape()
    s.moveTo(-w / 2 + r, -h / 2)
    s.lineTo(w / 2 - r, -h / 2)
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
    s.lineTo(w / 2, h / 2 - r)
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
    s.lineTo(-w / 2 + r, h / 2)
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
    s.lineTo(-w / 2, -h / 2 + r)
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
    return new THREE.ShapeGeometry(s, 6)
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.yellowGreen, transparent: true, depthWrite: false, toneMapped: false }), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const base = useMemo(() => lin(PAL.yellowGreen), [])
  const cx = frame.x(0.46)
  const cy = frame.y(0.22)
  const appear = (T: number) => at(T, D.area, 0.8, 1.0, ease.settle) * (1 - at(T, D.specialist, 0, 0.2))
  const op = (T: number) => appear(T) * focus(T, D.area) * chartFade(T)
  // size the plate to the laid-out text (troika block bounds), with padding
  const onSync = (m: THREE.Mesh) => {
    const info = (m as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo
    const p = plate.current
    if (!info || !p) return
    const [x0, y0, x1, y1] = info.blockBounds
    p.scale.set(x1 - x0 + size * 0.9, (y1 - y0) + size * 0.5, 1)
    p.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0)
  }
  useFrame(() => {
    const T = clock.T
    const a = appear(T)
    const o = op(T)
    if (group.current) {
      group.current.visible = o > 0.002
      group.current.position.set(cx, cy - 0.35 * (1 - a), 0.08)
      const s = 0.9 + 0.1 * a
      group.current.scale.set(s, s, 1)
    }
    mat.opacity = o
    mat.color.copy(base).multiplyScalar(1 + 0.9 * impactK(T))
  })
  return (
    <group ref={group}>
      <mesh ref={plate} geometry={geo} material={mat} renderOrder={46} scale={[size * 7.6, size * 1.5, 1]} />
      <SdfText
        font="barlowBold"
        text="AREA = FITNESS"
        size={size}
        color={PAL.ink}
        opacity={op}
        position={[0, 0, 0.01]}
        letterSpacing={0.04}
        renderOrder={47}
        onSync={onSync}
      />
    </group>
  )
}

/** u where the generalist curve falls to v (the curve is non-increasing). */
function uAtLevel(v: number): number {
  if (gv(1) >= v) return 1
  if (gv(0) <= v) return 0
  let lo = 0
  let hi = 1
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2
    if (gv(m) > v) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/**
 * The pour's meniscus (D3): the rising light surface, drawn as a hot pen from
 * the power axis to where the level meets the curve. It is the speaking
 * element of the pour, so it blooms.
 */
function Meniscus({ frame }: { frame: ChartFrame }) {
  const pts = useMemo(() => new Float32Array(6), [])
  const last = useRef(-1)
  const write = (T: number, p: Float32Array): boolean => {
    const lv = Math.max(0, Math.min(pourLevel(T), 0.999 * gv(0)))
    if (lv === last.current) return false
    last.current = lv
    const y = frame.y(lv)
    p[0] = frame.x(0)
    p[1] = y
    p[2] = 0.05
    p[3] = frame.x(uAtLevel(lv))
    p[4] = y
    p[5] = 0.05
    return true
  }
  useEffect(() => {
    last.current = -1
  }, [frame])
  const live = (T: number) => at(T, D.area, 0.05, 0.1) * (1 - at(T, D.area, 0.72, 0.8))
  return <Pen points={pts} color="#e9ffc4" width={PEN.axis} update={write} opacity={live} gain={() => 2.6} renderOrder={44} />
}

/** The chart that folds into row 1 of the lineup at D6 (FLIP). */
function StoryChart({ frame, tier }: { frame: ChartFrame; tier: 'high' | 'medium' | 'low' }) {
  const group = useRef<THREE.Group>(null)
  const { layout } = useBeat()
  const gCurve = useMemo(() => curvePolyline(frame, gv, 0.03), [frame])
  const pCurve = useMemo(() => curvePolyline(frame, pv, 0.04), [frame])
  const gTop = useMemo(() => curveTop(frame, gv), [frame])
  const pTop = useMemo(() => curveTop(frame, pv), [frame])
  const curveA = useMemo(() => sampleCurve(gv), [])
  const curveB = useMemo(() => sampleCurve(pv), [])
  const count = Math.round(9000 * TIERS[tier].particleScale)

  useFrame(() => {
    const g = group.current
    if (!g) return
    const k = flip(clock.T)
    const L = lineup(layout)
    const [mx0, my0] = L.origin(0)
    const sx = L.MW / frame.FW
    const sy = L.MH / frame.FH
    const s = 1 + (sx - 1) * k
    const t = 1 + (sy - 1) * k
    g.scale.set(s, t, 1)
    g.position.set(k * (mx0 - sx * frame.x0), k * (my0 - sy * frame.y0), 0)
  })

  const lowTier = tier === 'low'
  const gPenOpacity = (T: number) => (1 - 0.75 * fan(T)) * ghost(T) * (1 - at(T, D.lineup, 0.22, 0.34))
  return (
    <group ref={group}>
      <ChartConstruction frame={frame} vis={constructionVis} />
      <EnergyBands
        frame={frame}
        opacity={(T) =>
          (0.12 * at(T, D.curve, 0.8, 1.0) + 0.28 * (at(T, D.synthesis, 0.65, 0.95) - at(T, D.specialist, 0, 0.2))) * chartFade(T)
        }
      />
      <DimensionLines frame={frame} />
      <AreaFill
        top={gTop}
        baseline={frame.y(0)}
        z={0}
        color={PAL.yellowGreen}
        level={(T) => frame.y(Math.max(0, pourLevel(T)))}
        opacity={(T) => (T < D.area ? 0 : (lowTier ? 1 : 0.2) * focus(T, D.area) * (1 - 0.88 * spillMix(T)) * (1 - at(T, D.lineup, 0.22, 0.34)))}
        hi={lowTier ? 0.55 : 0.38}
      />
      {lowTier && (
        <AreaFill
          top={pTop}
          baseline={frame.y(0)}
          z={0.01}
          color={PAL.chalk}
          opacity={(T) => 0.7 * spillMix(T) * chartFade(T)}
          renderOrder={11}
        />
      )}
      {!lowTier && count > 0 && (
        <LightField
          frame={frame}
          count={count}
          curveA={curveA}
          curveB={curveB}
          uniforms={(T) => {
            if (T < D.specialist) {
              return { mode: 0, level: pourLevel(T), mix: 0, hot: 1 - at(T, D.area, 0.8, 1.0), opacity: T < D.area ? 0 : focus(T, D.area) }
            }
            return { mode: 1, level: 1.08, mix: spillMix(T), hot: 0, opacity: 1 - at(T, D.lineup, 0, 0.15) }
          }}
        />
      )}
      {lowTier && (
        <Halo
          position={(T) => [frame.x(0.5), frame.y(Math.max(0, Math.min(pourLevel(T), 0.6))), 0.1] as V3}
          sizePx={90}
          color={PAL.yellowGreen}
          intensity={(T) => (T >= D.area && T < D.area + 0.85 ? 0.5 * at(T, D.area, 0.05, 0.2) * (1 - at(T, D.area, 0.7, 0.85)) : 0)}
        />
      )}
      {!lowTier && <Meniscus frame={frame} />}
      <TaskDots frame={frame} />
      <DomainFan frame={frame} />
      <DepthTicks frame={frame} />
      {/* the claim edge: crisp pen on top of fill and particles (L10) */}
      <Pen
        points={gCurve}
        color={PAL.yellowGreen}
        width={PEN.data}
        progress={(T) => at(T, D.curve, 0.4, 0.8, ease.draw)}
        opacity={gPenOpacity}
        head
        hot
        renderOrder={45}
      />
      <Pen
        points={pCurve}
        color={PAL.chalk}
        width={PEN.data}
        dashed
        dashSize={0.3}
        gapSize={0.2}
        progress={(T) => at(T, D.specialist, 0.15, 0.5, ease.draw)}
        opacity={(T) => 0.95 * (1 - at(T, D.lineup, 0.12, 0.3))}
        head
        hot
        renderOrder={45}
      />
      <ClaimPlate frame={frame} />
    </group>
  )
}

/* ------------------------------ lineup (D6) ---------------------------- */

function Mini({ rank, layout }: { rank: number; layout: Layout }) {
  const r = RANKED[rank]
  const isG = r.name === GENERALIST.name
  const L = useMemo(() => lineup(layout), [layout])
  const group = useRef<THREE.Group>(null)
  const f = (u: number) => valAt(r.samples, u)
  const { geo, top } = useMemo(() => {
    const s = new THREE.Shape()
    const M = 48
    s.moveTo(0, 0)
    for (let i = 0; i <= M; i++) {
      const u = i / M
      s.lineTo(u * L.MW, f(u) * L.MH)
    }
    s.lineTo(L.MW, 0)
    s.lineTo(0, 0)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 1 })
    const pts = new Float32Array((M + 1) * 3)
    for (let i = 0; i <= M; i++) {
      const u = i / M
      pts[i * 3] = u * L.MW
      pts[i * 3 + 1] = f(u) * L.MH
      pts[i * 3 + 2] = 0.125
    }
    return { geo: g, top: pts }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, r.samples])
  const mat = useMemo(
    () =>
      makeRimStandard({
        color: isG ? PAL.yellowGreen : '#4a585f',
        rim: isG ? PAL.yellowGreen : PAL.chalk,
        rimStrength: isG ? 0.5 : 0.4,
        emissive: isG ? PAL.yellowGreen : '#8ea0a8',
        emissiveIntensity: isG ? 0.32 : 0.1,
        metalness: isG ? 0.15 : 0.35,
        roughness: isG ? 0.42 : 0.38,
        transparent: true,
      }),
    [isG],
  )
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const appear = (T: number) =>
    rank === 0 ? at(T, D.lineup, 0.2, 0.32, ease.settle) : stagger(T, D.lineup + 0.25, D.lineup + 0.85, rank - 1, RANKED.length - 1, 0.45, ease.settle)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const a = appear(clock.T)
    g.visible = a > 0.002
    const [x, y] = L.origin(rank)
    g.position.set(x, y - (rank === 0 ? 0 : 1.6 * (1 - a)), 0)
    mat.opacity = a
  })
  return (
    <group ref={group}>
      <mesh geometry={geo} material={mat} renderOrder={20} />
      <Pen points={top} color={isG ? PAL.yellowGreen : PAL.chalk} width={PEN.data} opacity={(T) => appear(T)} renderOrder={32} />
    </group>
  )
}

function Lineup() {
  const { layout } = useBeat()
  const visible = useStoryStore((s) => s.index >= D.lineup - 1)
  if (!visible) return null
  return (
    <>
      {RANKED.map((r, i) => (
        <Mini key={r.name + layout} rank={i} layout={layout} />
      ))}
    </>
  )
}

/* ------------------------------- labels -------------------------------- */

function useStoryLabels(frame: ChartFrame, layout: Layout) {
  const specs = useMemo<LabelSpec[]>(() => {
    const x = frame.x
    const y = frame.y
    const y0 = y(0)
    const construct = (T: number) => at(T, D.measured, 0.22, 0.4) * focus(T, D.measured) * chartFade(T)
    const out: LabelSpec[] = [
      { id: 'ax-y', text: 'Power output', tone: 'tick', anchor: [x(0), y(frame.vMax), 0], prefer: 'E', only: ['E', 'NE', 'SE'], gapPx: 8, priority: 78, cue: construct },
      { id: 'ax-x', text: 'Effort duration', tone: 'tick', anchor: [x(0.5), y0 - TICK_LEN, 0], prefer: 'S', only: ['S'], gapPx: 25, priority: 78, cue: construct },
      { id: 'yr-05', text: '0.5', tone: 'tick', anchor: [x(0) - TICK_LEN, y(0.5), 0], prefer: 'W', gapPx: 5, cue: construct },
      { id: 'yr-10', text: '1.0', tone: 'tick', anchor: [x(0) - TICK_LEN, y(1), 0], prefer: 'W', gapPx: 5, cue: construct },
    ]
    const tickIdx = layout === 'P' ? [0, 1, 3, 4, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7]
    tickIdx.forEach((i, j) => {
      out.push({
        id: `tk-${i}`,
        text: POWER_DURATION_LABELS[i],
        tone: 'tick',
        anchor: [x(i / 7), y0 - TICK_LEN, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 5,
        priority: 80,
        cue: (T) => stagger(T, D.measured + 0.18, D.measured + 0.4, j, tickIdx.length, 0.5) * focus(T, D.measured) * chartFade(T),
      })
    })
    // task names (D0: the 400m run; D1: the rest), gone once the domains fan out
    POWER_TASKS.forEach((t, i) => {
      const u = TASK_U[i]
      const j = i < TASK_400 ? i : i - 1
      out.push({
        id: `task-${i}`,
        text: t.name,
        tone: 'name',
        color: PAL.chalk,
        dot: false,
        anchor: [x(u), y(gv(u)), 0],
        prefer: u < 0.5 ? 'NE' : 'N',
        gapPx: 10,
        leader: true,
        priority: i === TASK_400 ? 72 : TASK_PRIORITY[i],
        cue: (T) =>
          (i === TASK_400 ? at(T, D.measured, 0.5, 0.62) : stagger(T, D.curve + 0.12, D.curve + 0.45, j, POWER_TASKS.length - 1, 0.35)) *
          (1 - at(T, D.domains, 0, 0.12)),
      })
    })
    // energy-band ticks with the three duration strings (callback to chapter 03)
    ENERGY_SYSTEMS.forEach((s, k) => {
      out.push({
        id: `band-${k}`,
        text: s.duration,
        tone: 'name',
        color: s.color,
        anchor: [x((BAND_U[k] + BAND_U[k + 1]) / 2), y0 + 0.06, 0],
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 8,
        leader: true,
        priority: 45,
        cue: (T) => at(T, D.curve, 0.82, 1.0) * (1 - at(T, D.domains, 0, 0.1)),
      })
    })
    // modal domain names at the right ends while fanned
    const scales = domainScale(GENERALIST.name)
    MODAL_DOMAINS.forEach((d, k) => {
      out.push({
        id: `dom-${k}`,
        text: d.name,
        tone: 'name',
        color: d.color,
        anchor: (T) => {
          const f = fan(T)
          const z = (-FAN_Z + (2 * FAN_Z * k) / (MODAL_DOMAINS.length - 1)) * f
          return [x(1), y(gv(1) * (1 + (scales[k] - 1) * f)), z]
        },
        prefer: 'E',
        gapPx: 8,
        priority: 65,
        cue: (T) => at(T, D.domains, 0.18, 0.32) * (1 - at(T, D.domains, 0.5, 0.62)),
      })
    })
    // D4: the three earlier models are the axes of this one picture
    const d4out = (T: number) => 1 - at(T, D.specialist, 0, 0.15)
    out.push(
      {
        id: 'c-height',
        text: 'HEIGHT: THE 10 SKILLS',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [x(0), y(0.66), 0],
        prefer: 'E',
        gapPx: 14,
        leader: true,
        cue: (T) => at(T, D.synthesis, 0.05, 0.2) * d4out(T),
      },
      {
        id: 'c-domains',
        text: 'DOMAINS: THE HOPPER',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [x(0), y(0) + 0.3, 0],
        prefer: 'NE',
        gapPx: 16,
        leader: true,
        cue: (T) => at(T, D.synthesis, 0.35, 0.5) * d4out(T),
      },
      {
        id: 'c-time',
        text: 'TIME: THE PATHWAYS',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [x(0.76), y0, 0],
        prefer: 'N',
        only: ['N', 'NW'],
        gapPx: 18,
        leader: true,
        cue: (T) => at(T, D.synthesis, 0.65, 0.8) * d4out(T),
      },
    )
    // D5: one zone, or the integral
    const d5out = (T: number) => 1 - at(T, D.lineup, 0, 0.12)
    const zoneU = 0.035
    out.push(
      {
        id: 'g-scale',
        text: 'Generalist, for scale',
        tone: 'name',
        color: PAL.yellowGreen,
        anchor: [x(0.56), y(gv(0.56)), 0],
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 10,
        priority: 62,
        cue: (T) => at(T, D.specialist, 0.05, 0.2) * d5out(T),
      },
      {
        id: 'r94',
        text: String(G_SCORE),
        tone: 'readout',
        size: 'sm',
        color: PAL.yellowGreen,
        minChars: 2,
        anchor: [x(1), y(gv(1)), 0],
        prefer: 'NW',
        gapPx: 8,
        cue: (T) => at(T, D.specialist, 0.2, 0.32) * d5out(T),
      },
      {
        id: 'pl',
        text: POWERLIFTER.name,
        tone: 'callout',
        color: PAL.chalk,
        anchor: [x(0.16), y(pv(0.16)), 0],
        prefer: 'E',
        gapPx: 14,
        leader: true,
        cue: (T) => at(T, D.specialist, 0.3, 0.42) * d5out(T),
      },
      {
        id: 'lost',
        text: 'AREA LOST',
        tone: 'callout',
        color: PAL.sick,
        anchor: [x(0.58), y((gv(0.58) + pv(0.58)) * 0.45), 0],
        prefer: 'C',
        priority: 88,
        cue: (T) => at(T, D.specialist, 0.6, 0.72) * d5out(T),
      },
      {
        id: 'zone',
        text: 'ZONE WON',
        tone: 'callout',
        color: PAL.both,
        anchor: [x(zoneU), y((gv(zoneU) + pv(zoneU)) / 2), 0],
        prefer: 'E',
        gapPx: 16,
        leader: true,
        priority: 92,
        cue: (T) => at(T, D.specialist, 0.72, 0.84) * d5out(T),
      },
      {
        id: 'r37',
        text: String(P_SCORE),
        tone: 'readout',
        size: 'sm',
        color: PAL.sick,
        minChars: 2,
        anchor: [x(1), y(pv(1)), 0],
        prefer: 'NW',
        gapPx: 8,
        cue: (T) => at(T, D.specialist, 0.84, 0.96) * d5out(T),
      },
    )
    // D6: ranked lineup, name + score per row
    const L = lineup(layout)
    RANKED.forEach((r, i) => {
      const [ox, oy] = L.origin(i)
      const isG = r.name === GENERALIST.name
      const appear = (T: number) =>
        i === 0 ? at(T, D.lineup, 0.24, 0.36) : stagger(T, D.lineup + 0.32, D.lineup + 0.92, i - 1, RANKED.length - 1, 0.45)
      out.push(
        {
          id: `ln-n-${i}`,
          text: r.name,
          tone: 'name',
          color: isG ? PAL.yellowGreen : PAL.chalk,
          anchor: [ox, oy + L.MH * 1.02 + 0.05, 0.12],
          prefer: 'NE',
          only: ['NE'],
          gapPx: 2,
          priority: 86,
          cue: appear,
        },
        {
          id: `ln-s-${i}`,
          text: `${r.score} ${scoreWord(r.score)}`,
          short: String(r.score),
          tone: 'readout',
          size: 'sm',
          color: isG ? PAL.yellowGreen : PAL.chalk,
          anchor: [ox + L.MW, oy + L.MH * 1.02 + 0.05, 0.12],
          prefer: 'NW',
          only: ['NW'],
          gapPx: 2,
          priority: 80,
          cue: appear,
        },
      )
    })
    return out
  }, [frame, layout])
  useLabels(specs)
}

/* -------------------------------- scene -------------------------------- */

function StoryScene({ frame, tier }: { frame: ChartFrame; tier: 'high' | 'medium' | 'low' }) {
  const { layout } = useBeat()
  useStoryLabels(frame, layout)
  return (
    <>
      <StoryChart frame={frame} tier={tier} />
      <Lineup />
    </>
  )
}

export default function DefinitionScene() {
  const frame = useChartFrame(FRAME_OPTS)
  live.frame = frame
  const mode = useStoryStore((s) => s.mode)
  const tier = useStoryStore((s) => s.tier)
  return mode === 'explore' ? <ExploreScene frame={frame} tier={tier} /> : <StoryScene frame={frame} tier={tier} />
}
