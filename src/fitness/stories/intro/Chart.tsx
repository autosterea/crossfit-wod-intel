import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL, POWER_DURATIONS, POWER_DURATION_LABELS } from '../../fitnessData'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { Halo } from '../../story/kit/Halo'
import { SdfText } from '../../story/kit/SdfText'
import { lin } from '../../story/kit/materials'
import { useSafeFrame } from '../../story/useSafeFrame'
import { bumpObstacles, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box, LabelSpec, Tier, V3 } from '../../story/types'
import { BARLOW_BOLD, chartPivot, cx, cy, tileFit, type IntroLayout } from './layout'
import { capAt, gv } from './introMath'
import {
  axesDraw,
  axisTitles,
  claimIn,
  faceDim,
  claimOut,
  curveDraw,
  eff,
  fold,
  powerAxisOut,
  sliceMorph,
  sweep,
  ticksDraw,
} from './timeline'
import { exploreDim } from './emphasis'

/* =========================================================================
   One definition (D.1 I2): the coach's chart. Two axes are drawn in one L
   stroke by a hot pen (construction), the pen draws the Generalist curve
   (data), light sweeps in under it left to right behind a hot front (the
   area), and the claim AREA = FITNESS lands inside the area. The time
   axis is named at its two ends, 1 s and 1 hr (broad time). In I3 the
   curve settles onto the youngest slice of the lifetime surface, the
   luminous area recedes to the solid's faint front face, and the power
   axis shortens to the solid's front edge (its ticks step back); in I4
   the whole chart folds into tile 04 and returns to the Generalist curve.
   ========================================================================= */

const N = 72
const LIGHT = '#e9ffc4'
/** tile 04 (MODULES order) */
const TILE = 3

/** v of the drawn front curve at u: the Generalist curve, easing onto the age-20 slice in I3 and back in I4. */
function frontV(T: number, u: number): number {
  const k = sliceMorph(T) * (1 - fold(T, TILE))
  const g = gv(u)
  return k <= 0 ? g : g + (capAt(u, 0) - g) * k
}

export function Chart({ L, tier }: { L: IntroLayout; tier: Tier }) {
  const c = L.chart
  const outer = useRef<THREE.Group>(null)
  const [px, py] = chartPivot(c)
  const FW = c.x1 - c.x0
  const s04 = tileFit(L.tiles, FW * 1.08, c.H)
  const tile = L.tiles.c[TILE]

  useSafeFrame('intro chart fold', (T) => {
    const g = outer.current
    if (!g) return
    const k = fold(T, TILE)
    g.position.set(px + (tile[0] - px) * k, py + (tile[1] + L.tiles.lift * 1.1 - py) * k, 0)
    g.scale.setScalar(1 + (s04 - 1) * k)
  }, { hide: outer })

  // construction: ONE continuous L stroke, down the power axis then along time (L11)
  const AX_V = 22
  const axes = useMemo(() => {
    const s: number[] = []
    const seg = (a: V3, b: V3, k: number) => {
      for (let i = 0; i < k; i++) {
        const f0 = i / k
        const f1 = (i + 1) / k
        s.push(a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0, 0, a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1, 0)
      }
    }
    seg([c.x0, cy(c, 1.02), 0], [c.x0, c.y0, 0], AX_V)
    seg([c.x0, c.y0, 0], [c.x1, c.y0, 0], 28)
    return new Float32Array(s)
  }, [c])
  // I3: the power axis shortens to the solid's front-left edge, so no stray
  // chalk line crosses the lifetime surface (the landscape's own height reads power)
  const lastAx = useRef({ v: NaN, c: null as unknown })
  const writeAxes = (T: number, s: Float32Array): boolean => {
    const k = powerAxisOut(T)
    const lk = lastAx.current
    if (lk.v === k && lk.c === c) return false
    lk.v = k
    lk.c = c
    const top = cy(c, 1.02) + (cy(c, frontV(T, 0)) - cy(c, 1.02)) * k
    for (let i = 0; i < AX_V; i++) {
      s[i * 6 + 1] = top + (c.y0 - top) * (i / AX_V)
      s[i * 6 + 4] = top + (c.y0 - top) * ((i + 1) / AX_V)
    }
    return true
  }
  // tick marks at the eight benchmark durations (interval axis)
  const ticks = useMemo(() => {
    const s: number[] = []
    POWER_DURATIONS.forEach((_, i) => {
      const x = cx(c, i / (POWER_DURATIONS.length - 1))
      s.push(x, c.y0, 0, x, c.y0 - 0.16, 0)
    })
    return new Float32Array(s)
  }, [c])
  // and at v 0.5 and 1.0 on the power axis (they step back in I3)
  const vTicks = useMemo(() => {
    const s: number[] = []
    for (const v of [0.5, 1]) s.push(c.x0, cy(c, v), 0, c.x0 - 0.16, cy(c, v), 0)
    return new Float32Array(s)
  }, [c])

  // data: the curve and the area share one top edge
  const curve = useMemo(() => {
    const a = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      a[i * 3] = cx(c, u)
      a[i * 3 + 1] = cy(c, gv(u))
      a[i * 3 + 2] = 0.03
    }
    return a
  }, [c])
  const top = useMemo(() => {
    const a = new Float32Array(N * 2)
    for (let i = 0; i < N; i++) {
      a[i * 2] = cx(c, i / (N - 1))
      a[i * 2 + 1] = cy(c, gv(i / (N - 1)))
    }
    return a
  }, [c])
  const lastC = useRef({ v: NaN, c: null as unknown })
  const writeCurve = (T: number, p: Float32Array): boolean => {
    const k = sliceMorph(T) * (1 - fold(T, TILE))
    // numeric key (no per-frame string): the value and the layout's chart object
    const lk = lastC.current
    if (lk.v === k && lk.c === c) return false
    lk.v = k
    lk.c = c
    for (let i = 0; i < N; i++) p[i * 3 + 1] = cy(c, frontV(T, i / (N - 1)))
    return true
  }
  const lastA = useRef({ v: NaN, c: null as unknown })
  const writeTop = (T: number, t: Float32Array): boolean => {
    const k = sliceMorph(T) * (1 - fold(T, TILE))
    // numeric key (no per-frame string): the value and the layout's chart object
    const lk = lastA.current
    if (lk.v === k && lk.c === c) return false
    lk.v = k
    lk.c = c
    for (let i = 0; i < N; i++) t[i * 2 + 1] = cy(c, frontV(T, i / (N - 1)))
    return true
  }

  // the sweep front: a vertical stroke of light from the baseline to the curve
  const front = useMemo(() => new Float32Array(6), [])
  const writeFront = (T: number, p: Float32Array): boolean => {
    const u = sweep(T)
    p[0] = p[3] = cx(c, u)
    p[1] = c.y0
    p[4] = cy(c, gv(u))
    p[2] = p[5] = 0.05
    return true
  }
  const frontOn = (T: number) => {
    const u = sweep(T)
    return u <= 0 || u >= 1 ? 0 : Math.min(1, u / 0.04, (1 - u) / 0.04)
  }

  const low = tier === 'low'
  const dim04 = () => exploreDim(TILE)
  // the LOW-tier bloom stand-in rides the sweep front (one preallocated point)
  const haloAt = useMemo<V3>(() => [0, 0, 0.1], [])
  const haloPos = (T: number): V3 => {
    const u = sweep(T)
    const p = haloAt as [number, number, number]
    p[0] = cx(c, u)
    p[1] = cy(c, gv(u))
    return haloAt
  }
  return (
    <group ref={outer}>
      <group position={[-px, -py, 0]}>
        <PenBatch segments={axes} color={PAL.chalk} width={PEN.axis} byArc head hot progress={axesDraw} update={writeAxes} opacity={() => 0.55} dim={dim04} renderOrder={31} />
        <PenBatch segments={ticks} color={PAL.chalk} width={PEN.axis} progress={ticksDraw} opacity={() => 0.5} dim={dim04} renderOrder={31} />
        <PenBatch segments={vTicks} color={PAL.chalk} width={PEN.axis} progress={ticksDraw} opacity={(T) => 0.5 * (1 - powerAxisOut(T))} dim={dim04} renderOrder={31} />
        {/* the luminous area (H.20): an additive gradient with an HDR rim under the edge */}
        <AreaFill
          top={top}
          baseline={c.y0}
          z={0}
          color={PAL.yellowGreen}
          update={writeTop}
          reveal={sweep}
          opacity={(T) => (sweep(T) > 0 ? faceDim(T) * exploreDim(TILE) : 0)}
          lo={low ? 0.1 : 0.03}
          hi={low ? 0.6 : 0.46}
          gamma={low ? 1 : 1.7}
          additive={!low}
          rim={() => (low ? 0.7 : 3.0)}
          rimWidth={0.16}
          renderOrder={12}
        />
        <Pen points={front} color={LIGHT} width={PEN.data} update={writeFront} opacity={frontOn} gain={() => 2.4} renderOrder={44} />
        {low && <Halo position={haloPos} sizePx={70} color={PAL.yellowGreen} intensity={(T) => 0.6 * frontOn(T)} />}
        {/* the claim edge: a crisp pen on top of the light (L10) */}
        <Pen points={curve} color={PAL.yellowGreen} width={PEN.data} update={writeCurve} progress={curveDraw} head hot dim={dim04} renderOrder={45} />
        <Claim L={L} />
      </group>
    </group>
  )
}

/* ------------------------------ the claim ------------------------------ */

function roundedRect(w: number, h: number, r: number): THREE.ShapeGeometry {
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
}

/** AREA = FITNESS: ink on a yellow-green plate with an ink keyline, inside the area (D.1 I2). */
function Claim({ L }: { L: IntroLayout }) {
  const c = L.chart
  const group = useRef<THREE.Group>(null)
  const size = L.title.lines === 2 ? 0.5 : 0.62
  const w = BARLOW_BOLD.claim * size + size * 1.0
  const h = BARLOW_BOLD.cap * size + size * 0.78
  const geo = useMemo(() => roundedRect(1, 1, 0.16), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.yellowGreen, transparent: true, depthWrite: false, toneMapped: false }), [])
  const ink = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.ink, transparent: true, depthWrite: false, toneMapped: false }), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => ink.dispose(), [ink])
  const base = useMemo(() => lin(PAL.yellowGreen), [])
  const px = cx(c, 0.5)
  const py = cy(c, 0.2)
  const op = (T: number) => claimIn(T) * (1 - claimOut(T))
  useSafeFrame('intro claim', (T) => {
    const g = group.current
    if (!g) return
    const a = claimIn(T)
    const o = op(T)
    g.visible = o > 0.002
    g.position.set(px, py - 0.3 * (1 - a), 0.08)
    const s = 0.9 + 0.1 * a
    g.scale.set(s, s, 1)
    mat.opacity = o
    ink.opacity = Math.min(1, o * 1.4)
    mat.color.copy(base)
  }, { hide: group })
  // the plate is an obstacle for the label placer while it is up (one prebuilt box)
  const obstacle = useMemo<WorldObstacle>(() => {
    const b: Box = [
      [px - w / 2, py - h / 2, 0.08],
      [px + w / 2, py + h / 2, 0.08],
    ]
    return {
      box: (T: number): Box | null => (eff(T) >= 3.2 || claimIn(T) * (1 - claimOut(T)) < 0.05 ? null : b),
      padPx: 6,
    }
  }, [px, py, w, h])
  useWorldObstacle('intro-claim', obstacle)
  return (
    <group ref={group}>
      <mesh geometry={geo} material={ink} renderOrder={45} scale={[w + size * 0.2, h + size * 0.2, 1]} position={[0, 0, -0.005]} />
      <mesh geometry={geo} material={mat} renderOrder={46} scale={[w, h, 1]} />
      <SdfText font="barlowBold" text="AREA = FITNESS" size={size} color={PAL.ink} opacity={(T) => Math.min(1, op(T) * 1.25)} position={[0, -0.02, 0.01]} letterSpacing={0.04} renderOrder={47} />
    </group>
  )
}

/* ------------------------------- labels -------------------------------- */

export function useChartLabels(L: IntroLayout) {
  const specs = useMemo<LabelSpec[]>(() => {
    const c = L.chart
    return [
      {
        id: 'intro-ax-y',
        text: 'Power output',
        tone: 'tick',
        anchor: [c.x0, cy(c, 1.02), 0],
        prefer: 'E',
        only: ['E', 'NE', 'SE'],
        gapPx: 8,
        priority: 78,
        required: true,
        cue: axisTitles,
      },
      {
        id: 'intro-ax-x',
        text: 'Effort duration',
        tone: 'tick',
        anchor: [cx(c, 0.5), c.y0 - 0.16, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 8,
        priority: 78,
        required: true,
        cue: axisTitles,
      },
      // broad time, shown: the span of the axis at its two ends (D.5 / D.7 precedent)
      {
        id: 'intro-tk-first',
        text: POWER_DURATION_LABELS[0],
        tone: 'tick',
        anchor: [cx(c, 0), c.y0 - 0.16, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 5,
        priority: 80,
        required: true,
        cue: axisTitles,
      },
      {
        id: 'intro-tk-last',
        text: POWER_DURATION_LABELS[POWER_DURATION_LABELS.length - 1],
        tone: 'tick',
        anchor: [cx(c, 1), c.y0 - 0.16, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 5,
        priority: 80,
        required: true,
        cue: axisTitles,
      },
    ]
  }, [L])
  useLabels(specs)
  // the curve is a data mark: labels never cover it
  const curve = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        const e = eff(T)
        if (e < 2.35 || e >= 3.1) return 0
        const c = L.chart
        for (let i = 0; i < 32; i++) {
          const u = i / 31
          out[i * 3] = cx(c, u)
          out[i * 3 + 1] = cy(c, gv(u))
          out[i * 3 + 2] = 0
        }
        return 32
      },
      maxPoints: 32,
      radiusPx: 5,
    }),
    [L],
  )
  useWorldObstacle('intro-curve', curve)
  useEffect(() => bumpObstacles(), [L])
}
