import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODAL_DOMAINS, PAL, POWER_DURATION_LABELS, POWER_TASKS, ENERGY_SYSTEMS } from '../../fitnessData'
import { clock } from '../../story/clock'
import { at, focus, stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useStoryFrame, type ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill, AreaStrips } from '../../story/kit/Fill'
import { LightField, sampleCurve } from '../../story/kit/LightField'
import { Nodes } from '../../story/kit/Nodes'
import { SdfText } from '../../story/kit/SdfText'
import { Halo } from '../../story/kit/Halo'
import { lin, makeRimStandard } from '../../story/kit/materials'
import { TIERS } from '../../story/quality/tiers'
import { impactK } from '../../story/kit/impact'
import { bumpObstacles, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box, Layout, LabelSpec, Tier, V3 } from '../../story/types'
import { FAN_Z, lineup } from './layout'
import { GENERALIST, POWERLIFTER, RANKED, domainScale, scoreOf, scoreWord, valAt } from './definitionMath'
import { BAND_U, ChartConstruction, EnergyBands, TASK_400, TASK_LABELED, TASK_U, TICK_LEN, curvePolyline, curveTop, gv, type ChartVis } from './chart'
import ExploreScene from './ExploreScene'

/* =========================================================================
   04 CAPACITY, "The integral" (DESIGN.md D.5). Seven beats, every property a
   pure function of story time T:
     D0 a measured point, D1 the falling curve, D2 the five modal domains as
     translucent slices in depth, D3 light pours into the area and settles
     into a glowing area with a bright rim (signature), D4 the three earlier
     models light up the axes of this picture, D5 the Powerlifter spills the
     area it cannot hold (a red hatch marks what is lost; an amber sliver is
     what it wins), D6 the ranked lineup with a shared-scale area bar per row.

   Prewarm (README): everything, the D6 lineup and the explore layer
   included, is mounted at load and hidden by T or mode, so no shader links
   mid-story and toggling explore creates nothing.
   ========================================================================= */

const D = { measured: 0, curve: 1, domains: 2, area: 3, synthesis: 4, specialist: 5, lineup: 6 } as const
const pv = (u: number) => valAt(POWERLIFTER.samples, u)
const G_SCORE = scoreOf(GENERALIST.samples)
const P_SCORE = scoreOf(POWERLIFTER.samples)
const DOMAIN_COLORS = MODAL_DOMAINS.map((d) => d.color)

/** u where the Powerlifter's curve drops below the generalist's: the zone it wins is u < U_X. */
const U_X = (() => {
  let lo = 0
  let hi = 0.5
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2
    if (pv(m) > gv(m)) lo = m
    else hi = m
  }
  return (lo + hi) / 2
})()

/* ------------------------------ timing -------------------------------- */

/** Chart content fades out as the chart folds into the lineup (D6). */
const chartFade = (T: number) => 1 - at(T, D.lineup, 0.12, 0.3)
/** D2 fan: 0 flat, 1 fully fanned in depth. */
export const fan = (T: number) => at(T, D.domains, 0, 0.35, ease.morph) - at(T, D.domains, 0.5, 0.9, ease.morph)
/** D3 pour level in v units. It starts just below the axis so no particle is in flight at D3 t = 0 (continuity). */
const POUR_LEAD = 0.2
const pourLevel = (T: number) => -POUR_LEAD + (1.08 + POUR_LEAD) * at(T, D.area, 0.05, 0.78)
/** D3 the settled light: the rim band grows as the level reaches the curve and stays. */
const rimGlow = (T: number) => at(T, D.area, 0.45, 0.85, ease.settle) * (1 - at(T, D.specialist, 0.4, 0.8))
/** D5 generalist ghost: 1 -> 0.45 */
const ghost = (T: number) => 1 - 0.55 * at(T, D.specialist, 0, 0.2, ease.settle)
/** D5 spill / condense mix */
const spillMix = (T: number) => at(T, D.specialist, 0.45, 0.9)
/** D5 elements fade as the lineup starts */
const d5out = (T: number) => 1 - at(T, D.lineup, 0, 0.12)
/** D4 annotation strokes and callouts fade as D5 starts */
const d4out = (T: number) => 1 - at(T, D.specialist, 0, 0.15)
/** The axis titles give way to the D4 callouts that name the same axes, then return. */
const axisTitles = (T: number) => 1 - at(T, D.synthesis, 0.02, 0.12) + at(T, D.specialist, 0.1, 0.25)
/** D6 flip into row 1 */
const flip = (T: number) => at(T, D.lineup, 0, 0.3, ease.morph)
/** The generalist curve is drawn (D1) and still part of the chart. */
const curveOn = (T: number) => (T >= D.curve + 0.16 && T < D.lineup + 0.3 ? 1 : 0)

const constructionVis: ChartVis = {
  grid: { progress: (T) => at(T, D.measured, 0.04, 0.28, ease.draw), opacity: (T) => 0.12 * chartFade(T) },
  axes: { progress: (T) => at(T, D.measured, 0, 0.28, ease.draw), opacity: (T) => 0.55 * focus(T, D.measured) * chartFade(T) },
  ticks: { progress: (T) => at(T, D.measured, 0.12, 0.3), opacity: (T) => 0.6 * focus(T, D.measured) * chartFade(T) },
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
/** The score word lands with the claim (D3) and again when the spill settles (D5). */
export const hudWordOn = (T: number) =>
  T < D.specialist ? at(T, D.area, 0.8, 0.92) : 1 - at(T, D.specialist, 0.4, 0.5) + at(T, D.specialist, 0.88, 0.98)

/* ------------------------------ helpers ------------------------------- */

/** x, y pairs of f over [u0, u1] (AreaFill top edges). */
function topRange(frame: ChartFrame, f: (u: number) => number, u0: number, u1: number, n: number): Float32Array {
  const a = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const u = u0 + ((u1 - u0) * i) / (n - 1)
    a[i * 2] = frame.x(u)
    a[i * 2 + 1] = frame.y(f(u))
  }
  return a
}

/** xyz polyline of f over [u0, u1] at depth z. */
function lineRange(frame: ChartFrame, f: (u: number) => number, u0: number, u1: number, n: number, z: number): Float32Array {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = u0 + ((u1 - u0) * i) / (n - 1)
    a[i * 3] = frame.x(u)
    a[i * 3 + 1] = frame.y(f(u))
    a[i * 3 + 2] = z
  }
  return a
}

/** One y per point of f over [u0, u1] (AreaFill bottom edges). */
function yRange(frame: ChartFrame, f: (u: number) => number, u0: number, u1: number, n: number): Float32Array {
  const a = new Float32Array(n)
  for (let i = 0; i < n; i++) a[i] = frame.y(f(u0 + ((u1 - u0) * i) / (n - 1)))
  return a
}

/** Straight polyline a -> b in k steps (so a pen head glides along it). */
function segLine(a: V3, b: V3, k: number): Float32Array {
  const out = new Float32Array((k + 1) * 3)
  for (let i = 0; i <= k; i++) {
    const f = i / k
    out[i * 3] = a[0] + (b[0] - a[0]) * f
    out[i * 3 + 1] = a[1] + (b[1] - a[1]) * f
    out[i * 3 + 2] = a[2] + (b[2] - a[2]) * f
  }
  return out
}

/** Task dot i: its appear factor at T (0 hidden). */
function taskAppear(T: number, i: number): number {
  if (i === TASK_400) return at(T, D.measured, 0.34, 0.48, ease.snap)
  const j = i < TASK_400 ? i : i - 1
  return stagger(T, D.curve, D.curve + 0.3, j, POWER_TASKS.length - 1, 0.35, ease.snap)
}

/* ------------------------------ elements ------------------------------ */

function TaskDots({ frame }: { frame: ChartFrame }) {
  const place = (T: number, i: number, out: [number, number, number]) => {
    const u = TASK_U[i]
    out[0] = frame.x(u)
    out[1] = frame.y(gv(u))
    out[2] = 0.02
    return taskAppear(T, i)
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
  const progress = (T: number) => at(T, D.measured, 0.5, 0.8, ease.draw)
  const opacity = (T: number) => 0.7 * (1 - at(T, D.curve, 0.3, 0.5))
  return (
    <>
      <Pen points={h} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.22} gapSize={0.16} progress={progress} opacity={opacity} />
      <Pen points={v} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.22} gapSize={0.16} progress={progress} opacity={opacity} />
    </>
  )
}

/** D2: five domain curves fanned in depth, each with a translucent curtain down to its own baseline. */
function DomainFan({ frame }: { frame: ChartFrame }) {
  const N = 72
  const NC = 48
  const scales = useMemo(() => domainScale(GENERALIST.name), [])
  const zOf = (k: number, f: number) => (-FAN_Z + (2 * FAN_Z * k) / (MODAL_DOMAINS.length - 1)) * f
  const { segments, colors } = useMemo(() => {
    const segs = new Float32Array(MODAL_DOMAINS.length * (N - 1) * 6)
    const cols = new Float32Array(segs.length)
    MODAL_DOMAINS.forEach((d, k) => {
      const c = lin(d.color)
      for (let i = 0; i < N - 1; i++) cols.set([c.r, c.g, c.b, c.r, c.g, c.b], (k * (N - 1) + i) * 6)
    })
    return { segments: segs, colors: cols }
  }, [])
  const last = useRef(-1)
  const write = (T: number, s: Float32Array): boolean => {
    const f = fan(T)
    if (f === last.current) return false
    last.current = f
    MODAL_DOMAINS.forEach((_, k) => {
      const z = zOf(k, f)
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
  const lastC = useRef(-1)
  const writeCurtains = (T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const f = fan(T)
    if (f === lastC.current) return false
    lastC.current = f
    const y0 = frame.y(0)
    for (let k = 0; k < MODAL_DOMAINS.length; k++) {
      const z = zOf(k, f) - 0.01
      const m = 1 + (scales[k] - 1) * f
      for (let i = 0; i < NC; i++) {
        const u = i / (NC - 1)
        const o = k * NC + i
        top[o * 3] = frame.x(u)
        top[o * 3 + 1] = frame.y(gv(u) * m)
        top[o * 3 + 2] = z
        bottom[o] = y0
      }
    }
    return true
  }
  useEffect(() => {
    last.current = -1
    lastC.current = -1
  }, [frame])
  return (
    <>
      <AreaStrips
        strips={MODAL_DOMAINS.length}
        points={NC}
        colors={DOMAIN_COLORS}
        write={writeCurtains}
        opacity={(T) => Math.min(1, fan(T) * 1.6)}
        lo={0}
        hi={0.13}
        gamma={1.6}
        additive
        renderOrder={11}
      />
      <PenBatch segments={segments} colors={colors} width={PEN.data} update={write} opacity={(T) => Math.min(1, fan(T) * 3)} renderOrder={31} />
    </>
  )
}

/** D4: three strokes of light, one per earlier model, each landing on the axis it names. */
function SynthesisStrokes({ frame, gCurve }: { frame: ChartFrame; gCurve: Float32Array }) {
  const yAxis = useMemo(() => segLine([frame.x(0), frame.y(0), 0.03], [frame.x(0), frame.y(1.0), 0.03], 24), [frame])
  const xAxis = useMemo(() => segLine([frame.x(0), frame.y(0), 0.03], [frame.x(1), frame.y(0), 0.03], 32), [frame])
  return (
    <>
      <Pen
        points={yAxis}
        color={PAL.yellowGreen}
        width={PEN.data}
        head
        hot
        progress={(T) => at(T, D.synthesis, 0.04, 0.24, ease.draw)}
        opacity={(T) => 0.95 * d4out(T)}
        renderOrder={46}
      />
      <Pen
        points={gCurve}
        color="#e9ffc4"
        width={PEN.data}
        head
        hot
        progress={(T) => at(T, D.synthesis, 0.34, 0.56, ease.draw)}
        opacity={(T) => 1 - at(T, D.synthesis, 0.58, 0.72)}
        gain={() => 1.4}
        renderOrder={46}
      />
      <Pen
        points={xAxis}
        color={PAL.yellowGreen}
        width={PEN.data}
        head
        hot
        progress={(T) => at(T, D.synthesis, 0.64, 0.86, ease.draw)}
        opacity={(T) => 0.95 * d4out(T)}
        renderOrder={46}
      />
    </>
  )
}

/** The claim plate plus its world obstacle (callouts never cover it). */
function ClaimPlate({ frame }: { frame: ChartFrame }) {
  const plate = useRef<THREE.Mesh>(null)
  const keyline = useRef<THREE.Mesh>(null)
  const group = useRef<THREE.Group>(null)
  const ext = useRef({ w: 0, h: 0, x: 0, y: 0 })
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
  // an ink keyline so the plate separates from the luminous area behind it
  const inkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.ink, transparent: true, depthWrite: false, toneMapped: false }), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => inkMat.dispose(), [inkMat])
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
    const w = x1 - x0 + size * 0.9
    const h = y1 - y0 + size * 0.5
    p.scale.set(w, h, 1)
    p.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0)
    const k = keyline.current
    if (k) {
      k.scale.set(w + size * 0.2, h + size * 0.2, 1)
      k.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.005)
    }
    ext.current = { w, h, x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
    bumpObstacles()
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
    inkMat.opacity = 0.85 * o
    mat.color.copy(base).multiplyScalar(1 + 0.9 * impactK(T))
  })
  // The plate is an obstacle for the label placer while it is up (D3 end, D4).
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      box: (T: number): Box | null => {
        if (appear(T) * chartFade(T) < 0.05) return null
        const e = ext.current
        const w = e.w || size * 7.6
        const h = e.h || size * 1.5
        return [
          [cx + e.x - w / 2, cy + e.y - h / 2, 0.08],
          [cx + e.x + w / 2, cy + e.y + h / 2, 0.08],
        ]
      },
      padPx: 6,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cx, cy, size],
  )
  useWorldObstacle('def-plate', obstacle)
  return (
    <group ref={group}>
      <mesh ref={keyline} geometry={geo} material={inkMat} renderOrder={45} scale={[size * 7.8, size * 1.7, 1]} />
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
 * The pour's meniscus (D3, H.7): the rising light surface, drawn as a hot pen
 * from the power axis to where the level meets the curve. It is the speaking
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
  const live = (T: number) => at(T, D.area, 0.05, 0.1) * (1 - at(T, D.area, 0.7, 0.78))
  return <Pen points={pts} color="#e9ffc4" width={PEN.axis} update={write} opacity={live} gain={() => 2.6} renderOrder={44} />
}

/** D5: the zone the specialist wins (amber, solid, crisp edge) and the area it loses (red hatch). */
function SpecialistRegions({ frame }: { frame: ChartFrame }) {
  const N = 72
  const lostTop = useMemo(() => topRange(frame, gv, 0, 1, N), [frame])
  const lostBottom = useMemo(() => yRange(frame, pv, 0, 1, N), [frame])
  const zoneTop = useMemo(() => topRange(frame, pv, 0, U_X, 24), [frame])
  const zoneBottom = useMemo(() => yRange(frame, gv, 0, U_X, 24), [frame])
  const zoneEdge = useMemo(() => lineRange(frame, pv, 0, U_X, 24, 0.06), [frame])
  const lostOp = (T: number) => at(T, D.specialist, 0.5, 0.9) * d5out(T)
  const zoneOp = (T: number) => at(T, D.specialist, 0.6, 0.84, ease.settle) * d5out(T)
  return (
    <>
      <AreaFill top={lostTop} bottom={lostBottom} baseline={0} z={0.005} color={PAL.sick} mode="hatch" hi={0.34} opacity={lostOp} renderOrder={12} />
      <AreaFill top={zoneTop} bottom={zoneBottom} baseline={0} z={0.01} color={PAL.both} mode="solid" hi={0.85} opacity={zoneOp} renderOrder={13} />
      <Pen points={zoneEdge} color={PAL.both} width={PEN.data} progress={(T) => at(T, D.specialist, 0.6, 0.8, ease.draw)} opacity={(T) => d5out(T)} gain={() => 1.5} renderOrder={46} />
    </>
  )
}

/** The chart that folds into row 1 of the lineup at D6 (FLIP). */
function StoryChart({ frame, tier }: { frame: ChartFrame; tier: Tier }) {
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
  const areaOut = (T: number) => 1 - at(T, D.lineup, 0.22, 0.34)
  return (
    <group ref={group}>
      <ChartConstruction frame={frame} vis={constructionVis} />
      <EnergyBands
        frame={frame}
        opacity={(T) =>
          (0.12 * at(T, D.curve, 0.66, 0.9) + 0.3 * (at(T, D.synthesis, 0.64, 0.9) - at(T, D.specialist, 0, 0.2))) * chartFade(T)
        }
      />
      <DimensionLines frame={frame} />
      {/* D3: the luminous area. Additive gradient brightening toward the curve,
          plus an HDR rim band under the curve that bloom lifts (H.20). */}
      <AreaFill
        top={gTop}
        baseline={frame.y(0)}
        z={0}
        color={PAL.yellowGreen}
        level={(T) => frame.y(Math.max(0, pourLevel(T)))}
        opacity={(T) => (T < D.area ? 0 : focus(T, D.area) * (1 - 0.92 * spillMix(T)) * areaOut(T))}
        lo={lowTier ? 0.1 : 0.025}
        hi={lowTier ? 0.62 : 0.46}
        gamma={lowTier ? 1 : 1.8}
        additive={!lowTier}
        rim={(T) => (lowTier ? 0.7 : 3.2) * rimGlow(T)}
        rimWidth={0.16}
      />
      {/* D5: the Powerlifter's area, read in chalk */}
      <AreaFill
        top={pTop}
        baseline={frame.y(0)}
        z={0.01}
        color={PAL.chalk}
        opacity={(T) => (lowTier ? 0.7 : 0.3) * spillMix(T) * chartFade(T)}
        lo={0.04}
        hi={0.4}
        renderOrder={11}
      />
      <SpecialistRegions frame={frame} />
      {!lowTier && count > 0 && (
        <LightField
          frame={frame}
          count={count}
          curveA={curveA}
          curveB={curveB}
          uniforms={(T) => {
            if (T < D.specialist) {
              return {
                mode: 0,
                level: pourLevel(T),
                mix: 0,
                hot: 1 - at(T, D.area, 0.78, 0.95),
                rest: at(T, D.area, 0.78, 0.98),
                opacity: T < D.area ? 0 : focus(T, D.area),
              }
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
      <SynthesisStrokes frame={frame} gCurve={gCurve} />
      {/* the claim edge: crisp pen on top of fill and particles (L10) */}
      <Pen
        points={gCurve}
        color={PAL.yellowGreen}
        width={PEN.data}
        progress={(T) => at(T, D.curve, 0.16, 0.62, ease.draw)}
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

const rowAppear = (T: number, rank: number) =>
  rank === 0 ? at(T, D.lineup, 0.2, 0.32, ease.settle) : stagger(T, D.lineup + 0.25, D.lineup + 0.85, rank - 1, RANKED.length - 1, 0.45, ease.settle)

function Mini({ rank, layout }: { rank: number; layout: Layout }) {
  const r = RANKED[rank]
  const isG = r.name === GENERALIST.name
  const L = useMemo(() => lineup(layout), [layout])
  const group = useRef<THREE.Group>(null)
  const { geo, top } = useMemo(() => {
    const f = (u: number) => valAt(r.samples, u)
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
  useFrame(() => {
    const g = group.current
    if (!g) return
    const a = rowAppear(clock.T, rank)
    g.visible = a > 0.002
    if (!g.visible) return
    const [x, y] = L.origin(rank)
    g.position.set(x, y - (rank === 0 ? 0 : 1.6 * (1 - a)), 0)
    mat.opacity = a
  })
  return (
    <group ref={group}>
      <mesh geometry={geo} material={mat} renderOrder={20} />
      <Pen points={top} color={isG ? PAL.yellowGreen : PAL.chalk} width={PEN.data} opacity={(T) => rowAppear(T, rank)} renderOrder={32} />
    </group>
  )
}

/**
 * The shared-scale area bars (H.22): one stroke per row whose length is its
 * score out of 100, over a faint full-length track. The ranking reads as a
 * staircase without reading a number. One draw call each.
 */
function ScoreBars({ layout }: { layout: Layout }) {
  const L = useMemo(() => lineup(layout), [layout])
  const n = RANKED.length
  const track = useMemo(() => {
    const s = new Float32Array(n * 6)
    RANKED.forEach((_, i) => {
      const [x, y] = L.origin(i)
      const yb = y + L.barY
      s.set([x, yb, 0.06, x + L.MW, yb, 0.06], i * 6)
    })
    return s
  }, [L, n])
  const { segs, cols } = useMemo(() => {
    const cols = new Float32Array(n * 6)
    RANKED.forEach((r, i) => {
      const c = lin(r.name === GENERALIST.name ? PAL.yellowGreen : PAL.chalk)
      if (r.name !== GENERALIST.name) c.multiplyScalar(0.8)
      cols.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6)
    })
    return { segs: new Float32Array(n * 6), cols }
  }, [n])
  const last = useRef(-1)
  const write = (T: number, s: Float32Array): boolean => {
    if (T === last.current) return false
    last.current = T
    RANKED.forEach((r, i) => {
      const [x, y] = L.origin(i)
      const yb = y + L.barY
      // each bar measures its row's area just after the row lands
      const g = stagger(T, D.lineup + 0.3, D.lineup + 0.98, i, n, 0.5, ease.settle)
      const len = L.MW * (r.score / 100) * Math.max(0.0001, g)
      s[i * 6] = x
      s[i * 6 + 1] = yb
      s[i * 6 + 2] = 0.07
      s[i * 6 + 3] = x + len
      s[i * 6 + 4] = yb
      s[i * 6 + 5] = 0.07
    })
    return true
  }
  useEffect(() => {
    last.current = -1
  }, [L])
  const trackOp = (T: number) => 0.14 * at(T, D.lineup, 0.25, 0.5)
  return (
    <>
      <PenBatch segments={track} color={PAL.chalk} width={PEN.grid} opacity={trackOp} renderOrder={31} />
      <PenBatch segments={segs} colors={cols} width={4} update={write} opacity={(T) => at(T, D.lineup, 0.25, 0.4)} renderOrder={33} />
    </>
  )
}

function Lineup() {
  const { layout } = useBeat()
  return (
    <>
      {RANKED.map((r, i) => (
        <Mini key={r.name + layout} rank={i} layout={layout} />
      ))}
      <ScoreBars layout={layout} />
    </>
  )
}

/* ------------------------------- labels -------------------------------- */

function useStoryLabels(frame: ChartFrame, layout: Layout) {
  const specs = useMemo<LabelSpec[]>(() => {
    const x = frame.x
    const y = frame.y
    const y0 = y(0)
    const construct = (T: number) => at(T, D.measured, 0.2, 0.36) * focus(T, D.measured) * chartFade(T)
    const out: LabelSpec[] = [
      {
        id: 'ax-y',
        text: 'Power output',
        tone: 'tick',
        anchor: [x(0), y(frame.vMax), 0],
        prefer: 'E',
        only: ['E', 'NE', 'SE'],
        gapPx: 8,
        priority: 78,
        cue: (T) => construct(T) * Math.min(1, axisTitles(T)),
      },
      {
        id: 'ax-x',
        text: 'Effort duration',
        tone: 'tick',
        anchor: [x(0.5), y0 - TICK_LEN, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 25,
        priority: 78,
        cue: (T) => construct(T) * Math.min(1, axisTitles(T)),
      },
      { id: 'yr-05', text: '0.5', tone: 'tick', anchor: [x(0) - TICK_LEN, y(0.5), 0], prefer: 'W', only: ['W'], gapPx: 5, cue: construct },
      { id: 'yr-10', text: '1.0', tone: 'tick', anchor: [x(0) - TICK_LEN, y(1), 0], prefer: 'W', only: ['W'], gapPx: 5, cue: construct },
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
        cue: (T) => stagger(T, D.measured + 0.14, D.measured + 0.34, j, tickIdx.length, 0.5) * focus(T, D.measured) * chartFade(T),
      })
    })
    // task names: the four D.5 names (D0: the 400m run; D1: the rest), gone once the domains fan out
    POWER_TASKS.forEach((t, i) => {
      if (!TASK_LABELED[i]) return
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
        priority: i === TASK_400 ? 72 : 70,
        cue: (T) =>
          (i === TASK_400 ? at(T, D.measured, 0.44, 0.56) : stagger(T, D.curve + 0.1, D.curve + 0.4, j, POWER_TASKS.length - 1, 0.35)) *
          (1 - at(T, D.domains, 0, 0.12)),
      })
    })
    // energy-band ticks with the three duration strings (callback to chapter 03), kept inside the chart
    ENERGY_SYSTEMS.forEach((s, k) => {
      const only: LabelSpec['only'] = k === 0 ? ['NE', 'N'] : k === ENERGY_SYSTEMS.length - 1 ? ['NW', 'N'] : ['N', 'NE', 'NW']
      out.push({
        id: `band-${k}`,
        text: s.duration,
        tone: 'name',
        color: s.color,
        anchor: [x((BAND_U[k] + BAND_U[k + 1]) / 2), y0 + 0.06, 0],
        prefer: only[0],
        only,
        gapPx: 8,
        leader: true,
        priority: 45,
        cue: (T) => at(T, D.curve, 0.7, 0.92) * (1 - at(T, D.domains, 0, 0.1)),
      })
    })
    // D2: all five modal domain names are required. Portrait: a stacked
    // legend pinned top-right (the right ends crowd on a phone). Landscape:
    // direct labels at the right ends.
    const scales = domainScale(GENERALIST.name)
    const domCue = (T: number) => at(T, D.domains, 0.16, 0.3) * (1 - at(T, D.domains, 0.5, 0.62))
    MODAL_DOMAINS.forEach((d, k) => {
      if (layout === 'P') {
        out.push({
          id: `dom-${k}`,
          text: d.name,
          tone: 'legend',
          color: d.color,
          anchor: [0, 0, 0],
          pin: 'top-right',
          pinOrder: k,
          required: true,
          cue: domCue,
        })
      } else {
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
          leader: true,
          required: true,
          priority: 65,
          cue: domCue,
        })
      }
    })
    // D4: the three earlier models are the axes of this one picture. Each
    // callout sits ON the axis its stroke of light just drew.
    out.push(
      {
        id: 'c-height',
        text: 'HEIGHT: THE 10 SKILLS',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [x(0), y(1.02), 0],
        prefer: 'E',
        only: ['E', 'NE', 'SE'],
        gapPx: 10,
        cue: (T) => at(T, D.synthesis, 0.18, 0.3) * d4out(T),
      },
      {
        id: 'c-domains',
        text: 'DOMAINS: THE HOPPER',
        tone: 'callout',
        color: PAL.yellowGreen,
        swatches: DOMAIN_COLORS,
        anchor: [x(0.3), y(gv(0.3)), 0],
        prefer: 'NE',
        gapPx: 18,
        leader: true,
        cue: (T) => at(T, D.synthesis, 0.48, 0.6) * d4out(T),
      },
      {
        id: 'c-time',
        text: 'TIME: THE PATHWAYS',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [x(0.5), y0 - TICK_LEN, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 22,
        cue: (T) => at(T, D.synthesis, 0.78, 0.9) * d4out(T),
      },
    )
    // D5: one zone, or the integral
    const zoneU = U_X * 0.4
    out.push(
      {
        id: 'g-scale',
        text: 'Generalist, for scale',
        tone: 'name',
        color: PAL.yellowGreen,
        anchor: [x(0.56), y(gv(0.56)), 0],
        prefer: 'NE',
        only: ['NE', 'N', 'NW', 'E'],
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
        prefer: 'N',
        gapPx: 10,
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
        anchor: [x(0.6), y((gv(0.6) + pv(0.6)) * 0.5), 0],
        prefer: 'C',
        priority: 88,
        cue: (T) => at(T, D.specialist, 0.62, 0.74) * d5out(T),
      },
      {
        id: 'zone',
        text: 'ZONE WON',
        tone: 'callout',
        color: PAL.both,
        anchor: [x(zoneU), y((gv(zoneU) + pv(zoneU)) / 2), 0.02],
        prefer: 'E',
        gapPx: 22,
        leader: true,
        priority: 92,
        cue: (T) => at(T, D.specialist, 0.74, 0.86) * d5out(T),
      },
      {
        id: 'r37',
        text: String(P_SCORE),
        tone: 'readout',
        size: 'sm',
        color: PAL.sick,
        minChars: 2,
        anchor: [x(1), y(pv(1)), 0],
        prefer: 'N',
        gapPx: 10,
        cue: (T) => at(T, D.specialist, 0.86, 0.96) * d5out(T),
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
          required: true,
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
          required: true,
          cue: appear,
        },
      )
    })
    return out
  }, [frame, layout])
  useLabels(specs)
}

/**
 * Data marks the labels must not cover (the reviewer's "labels vs data"):
 * the task dots, samples along the generalist and Powerlifter curves while
 * they are drawn, and the power axis.
 */
function useDataObstacles(frame: ChartFrame) {
  const dots = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        if (T >= D.lineup + 0.2) return 0
        let n = 0
        for (let i = 0; i < POWER_TASKS.length; i++) {
          if (taskAppear(T, i) <= 0.01) continue
          const u = TASK_U[i]
          out[n * 3] = frame.x(u)
          out[n * 3 + 1] = frame.y(gv(u))
          out[n * 3 + 2] = 0.02
          n++
        }
        return n
      },
      maxPoints: 12,
      radiusPx: 7,
    }),
    [frame],
  )
  const curves = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        let n = 0
        const S = 26
        if (curveOn(T) && fan(T) < 0.05) {
          for (let i = 0; i < S; i++) {
            const u = i / (S - 1)
            out[n * 3] = frame.x(u)
            out[n * 3 + 1] = frame.y(gv(u))
            out[n * 3 + 2] = 0
            n++
          }
        }
        if (at(T, D.specialist, 0.15, 0.3) > 0 && T < D.lineup + 0.1) {
          for (let i = 0; i < S; i++) {
            const u = i / (S - 1)
            out[n * 3] = frame.x(u)
            out[n * 3 + 1] = frame.y(pv(u))
            out[n * 3 + 2] = 0
            n++
          }
        }
        return n
      },
      maxPoints: 56,
      radiusPx: 4,
    }),
    [frame],
  )
  const axis = useMemo<WorldObstacle>(
    () => ({
      box: (T) =>
        T < D.lineup + 0.2 && at(T, D.measured, 0, 0.3) > 0
          ? [
              [frame.x(0) - 0.02, frame.y(0), 0],
              [frame.x(0) + 0.02, frame.y(frame.vMax), 0],
            ]
          : null,
      padPx: 3,
    }),
    [frame],
  )
  useWorldObstacle('def-dots', dots)
  useWorldObstacle('def-curves', curves)
  useWorldObstacle('def-yaxis', axis)
}

/* -------------------------------- scene -------------------------------- */

function StoryScene({ frame, tier }: { frame: ChartFrame; tier: Tier }) {
  const { layout } = useBeat()
  useStoryLabels(frame, layout)
  useDataObstacles(frame)
  return (
    <>
      <StoryChart frame={frame} tier={tier} />
      <Lineup />
    </>
  )
}

export default function DefinitionScene() {
  const frame = useStoryFrame()
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
