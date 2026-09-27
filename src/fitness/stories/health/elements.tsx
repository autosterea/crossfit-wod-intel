import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL, agingCapacity } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { AreaFill, AreaStrips } from '../../story/kit/Fill'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { SdfText } from '../../story/kit/SdfText'
import { impactK } from '../../story/kit/impact'
import { focus } from '../../story/cue'
import { useStoryStore } from '../../story/store'
import { useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { AGE_MIN, LIFELONG, ND, sampleGrid } from './healthMath'
import { AGE_TICK, FLOOR_TEXT_Z, HANDLE_U, POST_CAP, Z0, Z1, Z30, claimSize, xOf, zOfAge, type World } from './layout'
import { HS } from './state'
import { B, FLY, SLICE_AGES, ageSliceRun, ageTicks, areaSweep, axesDraw, axesZ, claimIn, curveDraw, frameDraw, fuse, l0Out, postCap, sliceP } from './timeline'

/* =========================================================================
   Story-built elements of 06 HEALTH (DESIGN.md D.7):
     L0  the hot L-stroke axes (capacity down the left, then the duration
         baseline), the age-30 fitness curve (a callback to chapter 04) and
         its luminous area;
     L1  the axes slide forward to the front edge (the post becomes the
         capacity axis on the solid's front-left corner), the floor frame
         draws with the age axis (the right edge, facing the camera) first,
         and the 14 slices are dealt in, one per five years of life, before
         they fuse into the surface;
     L2  the floor claim VOLUME = HEALTH;
     L5  the scanner: a curtain of light across x at the scanner's age,
         rising from the landscape; its line on the landscape is the
         chapter's one hot element (lit x1.8 by the impact accent);
     L6  the amber age slice: the fitness curve at one age, a pen on the
         landscape plus its cross-section seen through the solid; in
         explore a knob on it is the drag handle.
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

/** the capacity post is one segment: a straight stroke needs no subdivision (the pen clips by arc length), and
    a translucent stroke would show its joins as beads */
const POST_K = 1

/**
 * The construction: the capacity axis (down the left, over "1 s") and the
 * duration baseline (right) as ONE hot stroke at the age-30 slice in L0: two
 * batches whose progress windows split the draw by arc length, so the pen
 * head runs down the post and straight on along the baseline. In L1 both
 * slide forward to the front edge (age 20): the post becomes the capacity
 * axis of the solid, standing on its front-left corner, and the baseline its
 * front edge. The post spans the data shown (postCap).
 */
export function Axes({ W }: { W: World }) {
  const postLen = POST_CAP * W.YS
  const split = postLen / (postLen + 2 * W.XW)
  const post = useMemo(() => {
    const pts: number[] = []
    pushLine(pts, [-W.XW, POST_CAP * W.YS, Z30], [-W.XW, 0, Z30], POST_K, false)
    return toSegs(pts)
  }, [W])
  const base = useMemo(() => {
    const pts: number[] = []
    pushLine(pts, [-W.XW, 0, Z30], [W.XW, 0, Z30], 1, false)
    return toSegs(pts)
  }, [W])
  const zNow = (T: number) => (isExplore() ? Z0 : axesZ(T))
  const lastB = useRef({ buf: null as Float32Array | null, z: NaN })
  const updateBase = (T: number, s: Float32Array): boolean => {
    const z = zNow(T)
    const l = lastB.current
    if (z === l.z && s === l.buf) return false
    l.z = z
    l.buf = s
    for (let i = 2; i < s.length; i += 3) s[i] = z
    return true
  }
  const lastP = useRef({ buf: null as Float32Array | null, z: NaN, h: NaN })
  const updatePost = (T: number, s: Float32Array): boolean => {
    const z = zNow(T)
    const h = (isExplore() ? POST_CAP : postCap(T)) * W.YS
    const l = lastP.current
    if (z === l.z && h === l.h && s === l.buf) return false
    l.z = z
    l.h = h
    l.buf = s
    for (let k = 0; k < POST_K; k++) {
      const o = k * 6
      s[o + 1] = h * (1 - k / POST_K)
      s[o + 4] = h * (1 - (k + 1) / POST_K)
      s[o + 2] = s[o + 5] = z
    }
    return true
  }
  return (
    <>
      <PenBatch
        segments={post}
        update={updatePost}
        width={PEN.axis}
        byArc
        head
        hot
        progress={(T) => (isExplore() ? 1 : Math.min(1, axesDraw(T) / split))}
        opacity={(T) => 0.66 * (isExplore() ? 1 : focus(T, B.slice))}
        renderOrder={30}
      />
      <PenBatch
        segments={base}
        update={updateBase}
        width={PEN.axis}
        byArc
        head
        hot
        progress={(T) => (isExplore() ? 1 : Math.max(0, (axesDraw(T) - split) / (1 - split)))}
        opacity={(T) => 0.62 * (isExplore() ? 1 : focus(T, B.slice))}
        renderOrder={30}
      />
    </>
  )
}

/** L1: the floor frame, the age axis first (front-right to back-right: the edge that faces the camera), then back and left; plus the age tick marks. */
export function FloorFrame({ W }: { W: World }) {
  const segs = useMemo(() => {
    const pts: number[] = []
    pushLine(pts, [W.XW, 0, Z0], [W.XW, 0, Z1], 1, false)
    pushLine(pts, [W.XW, 0, Z1], [-W.XW, 0, Z1], 1, true)
    pushLine(pts, [-W.XW, 0, Z1], [-W.XW, 0, Z0], 1, true)
    return toSegs(pts)
  }, [W])
  const ticks = useMemo(() => {
    const out = new Float32Array(4 * 6)
    ;[20, 40, 60, 80].forEach((a, i) => out.set([W.XW, 0, zOfAge(a), W.XW + AGE_TICK, 0, zOfAge(a)], i * 6))
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
const slicesOn = (T: number) => (T < B.stack || T >= B.volume || isExplore() ? 0 : 1 - fuse(T))

/**
 * The 14 slices at ages 20 to 85, every five years, dealt in from the
 * front one after another: each slides back to its own age and rises
 * from the floor as it goes (the age-30 one is the L0 curve itself). They
 * fuse into the surface at the end of L1. Their writers run only while the
 * slices are up (L1), so the rest of the chapter pays nothing for them.
 */
export function Slices({ W }: { W: World }) {
  const lastF = useRef({ w: -1, T: NaN })
  const writeFills = (T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const l = lastF.current
    if (l.w === W.id && l.T === T) return false
    l.w = W.id
    l.T = T
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
  const lastP = useRef({ buf: null as Float32Array | null, w: -1, T: NaN })
  const writePens = (T: number, s: Float32Array): boolean => {
    // PenBatch runs its writer before its visibility check: skip it while the slices are down
    if (slicesOn(T) <= 0) return false
    const l = lastP.current
    if (l.buf === s && l.w === W.id && l.T === T) return false
    l.buf = s
    l.w = W.id
    l.T = T
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
  return (
    <>
      <AreaStrips
        strips={NS}
        points={SN}
        colors={SLICE_COLORS}
        write={writeFills}
        opacity={slicesOn}
        lo={0}
        hi={0.16}
        gamma={5}
        additive
        rim={() => 1.1}
        rimWidth={0.12}
        rimAlpha={0.3}
        renderOrder={11}
      />
      <PenBatch segments={segs} color={PAL.yellowGreen} width={PEN.axis} update={writePens} opacity={slicesOn} renderOrder={31} />
    </>
  )
}

/* ------------------------------- L2 claim ------------------------------- */

/** SDF "VOLUME = HEALTH" laid on the floor in front (Anton, chalk 22%); a label obstacle while up. */
export function FloorClaim({ W }: { W: World }) {
  const size = claimSize(W)
  const z = Z0 + FLOOR_TEXT_Z
  const on = (T: number) => (isExplore() ? 0 : claimIn(T))
  // two rows of points along the word (not its screen box: seen obliquely the word runs on a
  // diagonal, and its bounding rect would cover the duration labels under the front edge)
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      points: (T: number, o: Float32Array): number => {
        if (on(T) < 0.05) return 0
        let n = 0
        for (const dz of [-0.28 * size, 0.28 * size]) {
          for (let i = 0; i < 16; i++) {
            o[n * 3] = -W.XW * 0.9 + (1.8 * W.XW * i) / 15
            o[n * 3 + 1] = 0.02
            o[n * 3 + 2] = z + dz
            n++
          }
        }
        return n
      },
      maxPoints: 32,
      radiusPx: 9,
    }),
    [W, size, z],
  )
  useWorldObstacle('health-claim', obstacle)
  return (
    <group position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <SdfText font="anton" text="VOLUME = HEALTH" size={size} color={PAL.chalk} opacity={(T) => 0.24 * on(T)} letterSpacing={0.03} renderOrder={44} />
    </group>
  )
}

/* ------------------------------ profiles ------------------------------ */

/** World y of the displayed landscape at (u, age). */
const surfY = (u: number, age: number, YS: number) => sampleGrid(HS.grid, u, age) * YS

/* ------------------------------- L5 scanner ------------------------------- */

/** height of the scanner's curtain above the landscape, in capacity units */
const SCAN_H = 0.2
const SCAN_COLORS = [PAL.yellowGreen]

/**
 * The scanner (L5, A.3 signature): a thin vertical curtain of light across
 * x at the scanner's age, standing on the landscape (brightest where it
 * meets it, fading upward). Its line on the landscape is the speaking
 * element: hot, and lit x1.8 by the impact accent as the wave passes 50.
 * Once the sweep lands at 85 the curtain fades and only the hot line
 * stays, so the far end of the landscape is not hidden behind a haze.
 */
export function Scanner({ W }: { W: World }) {
  const group = useRef<THREE.Group>(null)
  const line = useMemo(() => new Float32Array(ND * 3), [])
  // the scanner enters a little in front of age 20; it is drawn on the landscape
  const drawnAge = () => Math.max(AGE_MIN, HS.scanAge)
  const lastL = useRef({ w: -1, ver: -1, a: NaN })
  const updateLine = (_T: number, p: Float32Array): boolean => {
    const l = lastL.current
    const a = drawnAge()
    if (l.w === W.id && l.ver === HS.gridVer && l.a === a) return false
    l.w = W.id
    l.ver = HS.gridVer
    l.a = a
    for (let i = 0; i < ND; i++) {
      const u = i / (ND - 1)
      p[i * 3] = xOf(u, W.XW)
      p[i * 3 + 1] = surfY(u, a, W.YS) + 0.06
      p[i * 3 + 2] = 0
    }
    return true
  }
  const lastC = useRef({ w: -1, ver: -1, a: NaN })
  const writeCurtain = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const l = lastC.current
    const a = drawnAge()
    if (l.w === W.id && l.ver === HS.gridVer && l.a === a) return false
    l.w = W.id
    l.ver = HS.gridVer
    l.a = a
    for (let i = 0; i < ND; i++) {
      const u = i / (ND - 1)
      top[i * 3] = xOf(u, W.XW)
      const y = surfY(u, a, W.YS)
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
      g.position.z = zOfAge(drawnAge())
    },
    { hide: group },
  )
  return (
    <group ref={group}>
      <AreaStrips strips={1} points={ND} colors={SCAN_COLORS} write={writeCurtain} opacity={() => HS.curtainOp} lo={0.5} hi={0} gamma={0.75} additive renderOrder={23} />
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
 * seen through the lit walls, and when explore orbits low). In explore a
 * lit amber knob on it marks the drag handle.
 */
export function AgeSlice({ W }: { W: World }) {
  const group = useRef<THREE.Group>(null)
  const line = useMemo(() => new Float32Array(ND * 3), [])
  const lastL = useRef({ w: -1, ver: -1, a: NaN })
  const updateLine = (_T: number, p: Float32Array): boolean => {
    const l = lastL.current
    if (l.w === W.id && l.ver === HS.gridVer && l.a === HS.sliceAge) return false
    l.w = W.id
    l.ver = HS.gridVer
    l.a = HS.sliceAge
    for (let i = 0; i < ND; i++) {
      const u = i / (ND - 1)
      p[i * 3] = xOf(u, W.XW)
      p[i * 3 + 1] = surfY(u, HS.sliceAge, W.YS) + 0.07
      p[i * 3 + 2] = 0
    }
    return true
  }
  const lastF = useRef({ w: -1, ver: -1, a: NaN })
  const writeFill = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const l = lastF.current
    if (l.w === W.id && l.ver === HS.gridVer && l.a === HS.sliceAge) return false
    l.w = W.id
    l.ver = HS.gridVer
    l.a = HS.sliceAge
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
    <>
      <group ref={group}>
        <AreaStrips
          strips={1}
          points={ND}
          colors={SLICE_FILL}
          write={writeFill}
          opacity={() => HS.sliceOp}
          lo={0.04}
          hi={0.26}
          gamma={1.2}
          rim={() => 0.7}
          rimWidth={0.16}
          rimAlpha={0.4}
          renderOrder={24}
        />
        <Pen points={line} update={updateLine} color={PAL.well} width={PEN.data + 0.5} opacity={() => HS.sliceOp} gain={(T) => (isExplore() ? 1.6 : 1.4 + 0.9 * ageSliceRun(T))} renderOrder={46} />
      </group>
      <Nodes
        count={1}
        radius={W.key === 'narrow' ? 0.34 : 0.3}
        color={PAL.well}
        rimStrength={0.7}
        emissiveIntensity={0.85}
        opacity={() => (isExplore() ? HS.sliceOp : 0)}
        place={(_T, _i, out) => {
          out[0] = xOf(HANDLE_U, W.XW)
          out[1] = surfY(HANDLE_U, HS.sliceAge, W.YS) + 0.08
          out[2] = zOfAge(HS.sliceAge)
          return isExplore() ? 1 : 0
        }}
      />
    </>
  )
}

