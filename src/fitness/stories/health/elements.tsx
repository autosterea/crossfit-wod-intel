import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL, agingCapacity } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { AreaFill, AreaStrips } from '../../story/kit/Fill'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { SdfText } from '../../story/kit/SdfText'
import { impactK } from '../../story/kit/impact'
import { focus } from '../../story/cue'
import { useStoryStore } from '../../story/store'
import { useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box } from '../../story/types'
import { LIFELONG, ND, sampleGrid } from './healthMath'
import { FLOOR_TEXT_Z, POST_CAP, Z0, Z1, Z30, xOf, zOfAge, type World } from './layout'
import { HS } from './state'
import { B, FLY, SLICE_AGES, ageTicks, areaSweep, axesDraw, axesZ, claimIn, curveDraw, frameDraw, fuse, l0Out, sliceP } from './timeline'

/* =========================================================================
   Story-built elements of 06 HEALTH (DESIGN.md D.7):
     L0  the hot L-stroke axes, the age-30 fitness curve (a callback to
         chapter 04) and its luminous area;
     L1  the axes slide forward to the front edge, the floor frame draws
         with the age axis first, and the 14 slices are dealt in, one per
         five years of life, before they fuse into the surface;
     L2  the floor claim VOLUME = HEALTH;
     L5  the scanner: a curtain of light across x at the scanner's age,
         rising from the landscape; its line on the landscape is the
         chapter's one hot element (lit x1.8 by the impact accent);
     L6  the amber age slice: the fitness curve at one age, a pen on the
         landscape plus its cross-section seen through the solid.
   ========================================================================= */

/** far outside every view: where a segment waits before it is needed (never a zero-length dot) */
const AWAY = 1e5
const isExplore = () => useStoryStore.getState().mode === 'explore'

/** Subdivided straight polyline a -> b (k segments), appended to out. */
function pushLine(out: number[], a: readonly number[], b: readonly number[], k: number, skipFirst: boolean): void {
  for (let i = skipFirst ? 1 : 0; i <= k; i++) out.push(a[0] + ((b[0] - a[0]) * i) / k, a[1] + ((b[1] - a[1]) * i) / k, a[2] + ((b[2] - a[2]) * i) / k)
}

/** Polyline points -> a segment buffer (6 floats per segment). */
function toSegs(pts: readonly number[]): Float32Array {
  const n = pts.length / 3
  const out = new Float32Array((n - 1) * 6)
  for (let i = 0; i < n - 1; i++) out.set(pts.slice(i * 3, i * 3 + 6), i * 6)
  return out
}

/** Lifelong trainer's fitness curve at one age (exact, not grid-sampled). */
const lifeAt = (u: number, age: number) => agingCapacity(u, age, LIFELONG)

/* ------------------------------- L0 chart ------------------------------- */

/**
 * The construction: the capacity axis post (down) and the duration baseline
 * (right) as ONE hot stroke, at the age-30 slice in L0; in L1 it slides
 * forward to become the front edge of the landscape (age 20).
 */
export function Axes({ W }: { W: World }) {
  const segs = useMemo(() => {
    const pts: number[] = []
    pushLine(pts, [-W.XW, POST_CAP * W.YS, Z30], [-W.XW, 0, Z30], 14, false)
    pushLine(pts, [-W.XW, 0, Z30], [W.XW, 0, Z30], 30, true)
    return toSegs(pts)
  }, [W])
  const last = useRef('')
  const update = (T: number, s: Float32Array): boolean => {
    const z = isExplore() ? Z0 : axesZ(T)
    const key = W.key + '|' + z
    if (key === last.current) return false
    last.current = key
    for (let i = 2; i < s.length; i += 3) s[i] = z
    return true
  }
  return (
    <PenBatch
      segments={segs}
      update={update}
      width={PEN.axis}
      byArc
      head
      hot
      progress={(T) => (isExplore() ? 1 : axesDraw(T))}
      opacity={(T) => 0.62 * (isExplore() ? 1 : focus(T, B.slice))}
      renderOrder={30}
    />
  )
}

/** L1: the floor frame, the age axis first (front-left to back-left: the edge that faces the camera), then back and right; plus the age tick marks. */
export function FloorFrame({ W }: { W: World }) {
  const segs = useMemo(() => {
    const pts: number[] = []
    pushLine(pts, [-W.XW, 0, Z0], [-W.XW, 0, Z1], 36, false)
    pushLine(pts, [-W.XW, 0, Z1], [W.XW, 0, Z1], 20, true)
    pushLine(pts, [W.XW, 0, Z1], [W.XW, 0, Z0], 36, true)
    return toSegs(pts)
  }, [W])
  const ticks = useMemo(() => {
    const out = new Float32Array(4 * 6)
    ;[20, 40, 60, 80].forEach((a, i) => out.set([-W.XW, 0, zOfAge(a), -W.XW - 0.42, 0, zOfAge(a)], i * 6))
    return out
  }, [W])
  const vis = (T: number) => (isExplore() ? 1 : focus(T, B.stack))
  return (
    <>
      <PenBatch
        segments={segs}
        width={PEN.axis}
        byArc
        head
        hot
        progress={(T) => (isExplore() ? 1 : frameDraw(T))}
        opacity={(T) => 0.5 * vis(T)}
        renderOrder={30}
      />
      <PenBatch segments={ticks} width={PEN.axis} progress={(T) => (isExplore() ? 1 : ageTicks(T))} opacity={(T) => 0.6 * vis(T)} renderOrder={30} />
    </>
  )
}

/** L0: the age-30 curve (hot pen) and its luminous area; handed over to the stack in L1. */
export function AgeThirty({ W }: { W: World }) {
  const N = 72
  const curve = useMemo(() => {
    const a = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      a[i * 3] = xOf(u, W.XW)
      a[i * 3 + 1] = lifeAt(u, 30) * W.YS
      a[i * 3 + 2] = Z30 + 0.02
    }
    return a
  }, [W])
  const top = useMemo(() => {
    const a = new Float32Array(N * 2)
    for (let i = 0; i < N; i++) {
      a[i * 2] = curve[i * 3]
      a[i * 2 + 1] = curve[i * 3 + 1]
    }
    return a
  }, [curve])
  const on = (T: number) => (T >= B.volume || isExplore() ? 0 : l0Out(T))
  return (
    <>
      <AreaFill
        top={top}
        baseline={0}
        z={Z30}
        color={PAL.yellowGreen}
        reveal={areaSweep}
        opacity={(T) => (areaSweep(T) > 0 ? on(T) : 0)}
        lo={0.03}
        hi={0.42}
        gamma={1.7}
        additive
        rim={() => 2.6}
        rimWidth={0.22}
        renderOrder={11}
      />
      <Pen points={curve} color={PAL.yellowGreen} width={PEN.data} progress={curveDraw} opacity={on} head hot renderOrder={45} />
    </>
  )
}

/* ------------------------------- L1 slices ------------------------------- */

const SN = 40
const NS = SLICE_AGES.length
/** each slice's own curve (exact Lifelong trainer capacities) */
const SLICE_CAP = SLICE_AGES.map((a) => Float32Array.from({ length: SN }, (_, i) => lifeAt(i / (SN - 1), a)))
const SLICE_COLORS = SLICE_AGES.map(() => PAL.yellowGreen)

/**
 * The 14 slices at ages 20 to 85, every five years, dealt in from the
 * front one after another: each slides back to its own age and rises
 * from the floor as it goes (the age-30 one is the L0 curve itself). They
 * fuse into the surface at the end of L1.
 */
export function Slices({ W }: { W: World }) {
  const lastF = useRef('')
  const writeFills = (T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const key = W.key + '|' + T
    if (key === lastF.current) return false
    lastF.current = key
    for (let k = 0; k < NS; k++) {
      const p = sliceP(T, k)
      const z = zOfAge(SLICE_AGES[k]) + FLY * (1 - p)
      for (let i = 0; i < SN; i++) {
        const o = k * SN + i
        top[o * 3] = xOf(i / (SN - 1), W.XW)
        top[o * 3 + 1] = SLICE_CAP[k][i] * W.YS * p
        top[o * 3 + 2] = z
        bottom[o] = 0
      }
    }
    return true
  }
  const segs = useMemo(() => new Float32Array(NS * (SN - 1) * 6).fill(AWAY), [])
  const lastP = useRef('')
  const writePens = (T: number, s: Float32Array): boolean => {
    const key = W.key + '|' + T
    if (key === lastP.current) return false
    lastP.current = key
    for (let k = 0; k < NS; k++) {
      const p = sliceP(T, k)
      const z = zOfAge(SLICE_AGES[k]) + FLY * (1 - p) + 0.02
      for (let i = 0; i < SN - 1; i++) {
        const o = (k * (SN - 1) + i) * 6
        if (p <= 0.001) {
          s.fill(AWAY, o, o + 6)
          continue
        }
        s[o] = xOf(i / (SN - 1), W.XW)
        s[o + 1] = SLICE_CAP[k][i] * W.YS * p
        s[o + 2] = z
        s[o + 3] = xOf((i + 1) / (SN - 1), W.XW)
        s[o + 4] = SLICE_CAP[k][i + 1] * W.YS * p
        s[o + 5] = z
      }
    }
    return true
  }
  const on = (T: number) => (T < B.stack || T >= B.volume || isExplore() ? 0 : 1 - fuse(T))
  return (
    <>
      <AreaStrips
        strips={NS}
        points={SN}
        colors={SLICE_COLORS}
        write={writeFills}
        opacity={on}
        lo={0}
        hi={0.16}
        gamma={5}
        additive
        rim={() => 1.1}
        rimWidth={0.12}
        rimAlpha={0.3}
        renderOrder={11}
      />
      <PenBatch segments={segs} color={PAL.yellowGreen} width={PEN.axis} update={writePens} opacity={on} renderOrder={31} />
    </>
  )
}

/* ------------------------------- L2 claim ------------------------------- */

/** SDF "VOLUME = HEALTH" laid on the floor in front (Anton, chalk 22%); a label obstacle while up. */
export function FloorClaim({ W }: { W: World }) {
  const size = Math.min(1.9, (2 * W.XW * 0.92) / 7.2)
  const z = Z0 + FLOOR_TEXT_Z
  const on = (T: number) => (isExplore() ? 0 : claimIn(T))
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      box: (T: number): Box | null =>
        on(T) < 0.05
          ? null
          : [
              [-W.XW * 0.95, 0, z - size * 0.55],
              [W.XW * 0.95, 0.02, z + size * 0.55],
            ],
      padPx: 4,
    }),
    [W, size, z],
  )
  useWorldObstacle('health-claim', obstacle)
  return (
    <group position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <SdfText font="anton" text="VOLUME = HEALTH" size={size} color={PAL.chalk} opacity={(T) => 0.22 * on(T)} letterSpacing={0.03} renderOrder={44} />
    </group>
  )
}

/* ------------------------------ profiles ------------------------------ */

/** World y of the displayed landscape at (u, age). */
const surfY = (u: number, age: number, YS: number) => sampleGrid(HS.grid, u, age) * YS

/* ------------------------------- L5 scanner ------------------------------- */

/** height of the scanner's curtain above the landscape, in capacity units */
const SCAN_H = 0.24
const SCAN_COLORS = [PAL.yellowGreen]

/**
 * The scanner (L5, A.3 signature): a thin vertical curtain of light across
 * x at the scanner's age, standing on the landscape (brightest where it
 * meets it, fading upward). Its line on the landscape is the speaking
 * element: hot, and lit x1.8 by the impact accent as the wave passes 50.
 */
export function Scanner({ W }: { W: World }) {
  const group = useRef<THREE.Group>(null)
  const line = useMemo(() => new Float32Array(ND * 3), [])
  const lastL = useRef('')
  const updateLine = (_T: number, p: Float32Array): boolean => {
    const key = W.key + '|' + HS.gridVer + '|' + HS.scanAge
    if (key === lastL.current) return false
    lastL.current = key
    for (let i = 0; i < ND; i++) {
      const u = i / (ND - 1)
      p[i * 3] = xOf(u, W.XW)
      p[i * 3 + 1] = surfY(u, HS.scanAge, W.YS) + 0.06
      p[i * 3 + 2] = 0
    }
    return true
  }
  const lastC = useRef('')
  const writeCurtain = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const key = W.key + '|' + HS.gridVer + '|' + HS.scanAge
    if (key === lastC.current) return false
    lastC.current = key
    for (let i = 0; i < ND; i++) {
      const u = i / (ND - 1)
      top[i * 3] = xOf(u, W.XW)
      const y = surfY(u, HS.scanAge, W.YS)
      top[i * 3 + 1] = y + SCAN_H * W.YS
      top[i * 3 + 2] = 0
      bottom[i] = y
    }
    return true
  }
  useSafeFrame(
    'health scanner',
    () => {
      const g = group.current
      if (!g) return
      g.visible = HS.scanOp > 0.004
      g.position.z = zOfAge(HS.scanAge)
    },
    { hide: group },
  )
  return (
    <group ref={group}>
      <AreaStrips strips={1} points={ND} colors={SCAN_COLORS} write={writeCurtain} opacity={() => HS.scanOp} lo={0.5} hi={0} gamma={0.75} additive renderOrder={23} />
      <Pen
        points={line}
        update={updateLine}
        color={PAL.yellowGreen}
        width={PEN.hero}
        opacity={() => HS.scanOp}
        gain={(T) => 2.4 * (1 + 0.8 * impactK(T))}
        renderOrder={46}
      />
    </group>
  )
}

/* ------------------------------ L6 age slice ------------------------------ */

const SLICE_FILL = [PAL.well]

/**
 * The amber age slice: the fitness curve at one age as a pen on the
 * landscape, plus its cross-section down to the floor (inside the solid:
 * seen through the lit walls, and when explore orbits low).
 */
export function AgeSlice({ W }: { W: World }) {
  const group = useRef<THREE.Group>(null)
  const line = useMemo(() => new Float32Array(ND * 3), [])
  const lastL = useRef('')
  const updateLine = (_T: number, p: Float32Array): boolean => {
    const key = W.key + '|' + HS.gridVer + '|' + HS.sliceAge
    if (key === lastL.current) return false
    lastL.current = key
    for (let i = 0; i < ND; i++) {
      const u = i / (ND - 1)
      p[i * 3] = xOf(u, W.XW)
      p[i * 3 + 1] = surfY(u, HS.sliceAge, W.YS) + 0.07
      p[i * 3 + 2] = 0
    }
    return true
  }
  const lastF = useRef('')
  const writeFill = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const key = W.key + '|' + HS.gridVer + '|' + HS.sliceAge
    if (key === lastF.current) return false
    lastF.current = key
    for (let i = 0; i < ND; i++) {
      const u = i / (ND - 1)
      top[i * 3] = xOf(u, W.XW)
      top[i * 3 + 1] = surfY(u, HS.sliceAge, W.YS)
      top[i * 3 + 2] = 0
      bottom[i] = 0
    }
    return true
  }
  useSafeFrame(
    'health age slice',
    () => {
      const g = group.current
      if (!g) return
      g.visible = HS.sliceOp > 0.004
      g.position.z = zOfAge(HS.sliceAge)
    },
    { hide: group },
  )
  return (
    <group ref={group}>
      <AreaStrips
        strips={1}
        points={ND}
        colors={SLICE_FILL}
        write={writeFill}
        opacity={() => HS.sliceOp}
        lo={0.03}
        hi={0.22}
        gamma={1.2}
        rim={() => 0.6}
        rimWidth={0.14}
        rimAlpha={0.35}
        renderOrder={24}
      />
      <Pen points={line} update={updateLine} color={PAL.well} width={PEN.data} opacity={() => HS.sliceOp} gain={() => 1.3} renderOrder={46} />
    </group>
  )
}
