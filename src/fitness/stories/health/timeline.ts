import { at } from '../../story/cue'
import { ease } from '../../story/ease'
import { clamp, lerp, smoothstep } from '../../lessonMath'
import {
  LIFELONG,
  NA,
  ND,
  SEDENTARY,
  STARTS_50,
  ageOfRow,
  colSums,
  gridFor,
  rowSums,
  sampleGrid,
  scoreOfMean,
} from './healthMath'
import { INDEPENDENCE_LINE, Z0, Z30 } from './layout'

/* =========================================================================
   06 HEALTH timeline (DESIGN.md D.7): every cue of the seven beats as a pure
   function of story time T = beat + t, so any (beat, t) renders the same
   frame and (N, 1) equals (N + 1, 0). Beat-local windows follow the
   storyboard; each beat builds in the L2 order (construction, data,
   annotation, claim).
   ========================================================================= */

export const B = { slice: 0, stack: 1, volume: 2, line: 3, sink: 4, anyAge: 5, hold: 6 } as const

/* ---------------------------- L0 a curve for every age ---------------------------- */

/** the hot L-stroke: capacity axis down, then the duration baseline */
export const axesDraw = (T: number) => at(T, B.slice, 0, 0.16, ease.draw)
/** "1 s", "1 hr", DURATION, CAPACITY fade in as the axes land */
export const axisTicks = (T: number) => at(T, B.slice, 0.12, 0.24)
/** the pen draws the age-30 fitness curve */
export const curveDraw = (T: number) => at(T, B.slice, 0.14, 0.6, ease.draw)
/** the area under it sweeps in, left to right */
export const areaSweep = (T: number) => at(T, B.slice, 0.55, 0.85, ease.draw)
/** the claim: AGE 30 */
export const age30 = (T: number) => at(T, B.slice, 0.84, 0.96) * (1 - at(T, B.stack, 0.06, 0.2))

/* ---------------------------- L1 stack them ---------------------------- */

/** the L0 axes slide forward to the front edge (age 20) as the camera rises */
export const axesSlide = (T: number) => at(T, B.stack, 0, 0.32, ease.morph)
export const axesZ = (T: number) => lerp(Z30, Z0, axesSlide(T))
/** the floor frame: the age axis first (front-right to back-right), then back and left */
export const frameDraw = (T: number) => at(T, B.stack, 0.1, 0.42, ease.draw)
/** age ticks 20, 40, 60, 80 and AGE */
export const ageTicks = (T: number) => at(T, B.stack, 0.26, 0.42)

/** The 14 slices at ages 20, 25, ... 85. */
export const SLICE_AGES = Array.from({ length: 14 }, (_, k) => 20 + 5 * k)
/** index of the age-30 slice (the L0 curve itself) */
export const K30 = 2
/** flight order: every slice except the age-30 one, front to back */
const ORDER = SLICE_AGES.map((_, k) => k).filter((k) => k !== K30)
const RANK = SLICE_AGES.map((_, k) => ORDER.indexOf(k))
/** how far in front of its age a slice starts its flight (world z) */
export const FLY = 2.6
/** progress 0..1 of slice k's flight (the age-30 slice is already there: it takes over from the L0 curve) */
export function sliceP(T: number, k: number): number {
  if (k === K30) return at(T, B.stack, 0.2, 0.28)
  return ease.settle(stag(T, RANK[k]))
}
const stag = (T: number, j: number) => {
  // 13 flights of about 1.3 s, one every 110 ms (D.7 L1: one after another)
  const a = B.stack + 0.26
  const each = 0.22
  const off = (0.24 * j) / (ORDER.length - 1)
  return clamp((T - a - off) / each, 0, 1)
}
/** L0's own curve and luminous area hand over to the stack */
export const l0Out = (T: number) => 1 - at(T, B.stack, 0.24, 0.42)
/** the fuse: slices out, surface in */
export const fuse = (T: number) => at(T, B.stack, 0.76, 0.95)
/** the solid's edges land as the slices fuse */
export const solidEdge = (T: number) => (T < B.stack ? 0 : at(T, B.stack, 0.8, 0.98))

/* ---------------------------- L2 volume = health ---------------------------- */

/** pour level in capacity units: from just under the floor to over the highest ridge */
export const pourLevel = (T: number) => (T < B.volume ? -0.05 : lerp(-0.05, 0.92, at(T, B.volume, 0.12, 0.6)))
/** the solid surface steps aside (isolines only) while the volume fills under it */
export const pourGhost = (T: number) => at(T, B.volume, 0.03, 0.13) - at(T, B.volume, 0.62, 0.74)
/** the rising light sheet inside the volume */
export const sheetOn = (T: number) => at(T, B.volume, 0.1, 0.15) * (1 - at(T, B.volume, 0.6, 0.72))
/** the walls' rim is hot (it blooms) while the level rises, then settles */
export const wallRim = (T: number) => 0.9 + 2.3 * (at(T, B.volume, 0.1, 0.16) - at(T, B.volume, 0.58, 0.75))
export const wallsOn = (T: number) => at(T, B.volume, 0.1, 0.13)
/** the HUD chip from L2 on */
export const hudOpacity = (T: number) => at(T, B.volume, 0.02, 0.1)
/** SDF "VOLUME = HEALTH" on the floor */
export const claimIn = (T: number) => at(T, B.volume, 0.8, 0.96, ease.settle) * (1 - at(T, B.line, 0, 0.14))

/* ---------------------------- L3 the independence line ---------------------------- */

export const planeRise = (T: number) => at(T, B.line, 0.1, 0.6, ease.settle)
/** the plane's height in capacity units (the independence line, 0.1) */
export const planeCap = (T: number) => INDEPENDENCE_LINE * planeRise(T)
export const planeOn = (T: number) => at(T, B.line, 0.1, 0.22)
/** the crisp red edge (L10), hot while it draws */
export const edgeDraw = (T: number) => at(T, B.line, 0.55, 0.85, ease.draw)
export const lineCallout = (T: number) => at(T, B.line, 0.84, 0.96)

/* ---------------------------- L4 stop training ---------------------------- */

/** 0..1 across the sink; the power ridge (short durations) leads (B.11 stagger along the index) */
export const sinkK = (T: number) => at(T, B.sink, 0.05, 0.8)
export const sinkW = (u: number, k: number) => ease.morph(clamp((k - 0.3 * u) / 0.7, 0, 1))
/** L4: the Lifelong landscape stays behind as a dashed outline while the surface sinks away from it */
export const lostOutline = (T: number) => at(T, B.sink, 0.05, 0.2) * (1 - at(T, B.anyAge, 0, 0.08))
/** where the dashed outline switches from the Lifelong landscape (lost, L4) to the Sedentary one (the before, L5 on) */
export const OUTLINE_SWITCH = B.anyAge + 0.08
/** L5 on: the Sedentary landscape stays as a dashed outline while the surface lifts away from it (and lies under the Lifelong one in L6) */
export const beforeOutline = (T: number) => at(T, B.anyAge, 0.08, 0.2)
/** the independence plane's frame steps back once it is established (L4 on); its front edge keeps more */
export const planeFrame = (T: number) => 1 - 0.5 * at(T, B.sink, 0, 0.2)
export const sedName = (T: number) => at(T, B.sink, 0.8, 0.9) * (1 - at(T, B.anyAge, 0, 0.12))
export const indep70 = (T: number) => at(T, B.sink, 0.86, 0.96) * (1 - at(T, B.anyAge, 0, 0.12))

/* ---------------------------- L5 start at any age ---------------------------- */

export const SCAN_FROM = 45
export const SCAN_TO = 85
/** the scanner appears at 45, sweeps to 85 (linear, time-true) and stays at the far end */
export const scanOn = (T: number) => at(T, B.anyAge, 0, 0.15) * (1 - at(T, B.hold, 0, 0.15))
export const scanAge = (T: number) => SCAN_FROM + (SCAN_TO - SCAN_FROM) * at(T, B.anyAge, 0.15, 0.85)
/** everything up to the scanner's start adopts the new profile as it appears */
export const scanPre = (T: number) => at(T, B.anyAge, 0, 0.15, ease.settle)
/**
 * Weight of "Starts at 50" at one age: 1 behind the scanner, a 3-year bow
 * wave just ahead of it, 0 beyond. At t = 1 (scanner at 85) every age is 1,
 * so the surface equals gridFor(Starts at 50) exactly (D.7 L5).
 */
export const waveW = (age: number, pre: number, s: number) => pre * smoothstep(age - 3, age, s)
export const s50Name = (T: number) => at(T, B.anyAge, 0.8, 0.9) * (1 - at(T, B.hold, 0, 0.12))
export const indep85 = (T: number) => at(T, B.anyAge, 0.86, 0.96) * (1 - at(T, B.hold, 0, 0.12))

/* ---------------------------- L6 hold it ---------------------------- */

export const backW = (T: number) => at(T, B.hold, 0, 0.45, ease.morph)
/** the Sedentary ghost underneath (isolines plus a dashed chalk outline) */
export const ghostIn = (T: number) => at(T, B.hold, 0.15, 0.4)
export const ageSliceOn = (T: number) => at(T, B.hold, 0.4, 0.46)
export const ageSliceAge = (T: number) => 20 + 65 * at(T, B.hold, 0.42, 0.9)
export const volReadouts = (T: number) => at(T, B.hold, 0.3, 0.42)
export const indep90 = (T: number) => at(T, B.hold, 0.9, 0.98)

/* ------------------------------ story surfaces ------------------------------ */

/** The story's three grids (D.7: AGING_PROFILES only). */
export const G = [gridFor(LIFELONG), gridFor(SEDENTARY), gridFor(STARTS_50)] as const
export const GL = 0
export const GS = 1
export const G50 = 2
const COLS = G.map(colSums)
const ROWS = G.map(rowSums)
const N = ND * NA
const MEANS = COLS.map((c) => c.reduce((s, v) => s + v, 0) / N)

/**
 * The displayed surface at T, as a blend of two grids:
 *   kind 0 static a; 1 per duration column (the sink, weight sinkW(u, k));
 *   2 per age row (the scanner wave); 3 uniform k.
 */
export interface Blend {
  kind: 0 | 1 | 2 | 3
  a: number
  b: number
  k: number
  pre: number
  s: number
}

export function blendAt(T: number, out: Blend): Blend {
  out.pre = 0
  out.s = 0
  if (T < B.sink) {
    out.kind = 0
    out.a = GL
    out.b = GL
    out.k = 0
  } else if (T < B.anyAge) {
    out.kind = 1
    out.a = GL
    out.b = GS
    out.k = sinkK(T)
  } else if (T < B.hold) {
    out.kind = 2
    out.a = GS
    out.b = G50
    out.k = 0
    out.pre = scanPre(T)
    out.s = scanAge(T)
  } else {
    out.kind = 3
    out.a = G50
    out.b = GL
    out.k = backW(T)
  }
  return out
}

/** The weight of grid b at (u, age) for a blend. */
export function blendW(bl: Blend, u: number, age: number): number {
  switch (bl.kind) {
    case 1:
      return sinkW(u, bl.k)
    case 2:
      return waveW(age, bl.pre, bl.s)
    case 3:
      return bl.k
    default:
      return 0
  }
}

/** Write the displayed grid for a blend into `out` (ND x NA, age outer). */
export function writeBlend(bl: Blend, out: Float32Array): void {
  const A = G[bl.a]
  const Bg = G[bl.b]
  for (let ai = 0; ai < NA; ai++) {
    const age = ageOfRow(ai)
    for (let di = 0; di < ND; di++) {
      const i = ai * ND + di
      const w = blendW(bl, di / (ND - 1), age)
      out[i] = w === 0 ? A[i] : A[i] + (Bg[i] - A[i]) * w
    }
  }
}

const _bl: Blend = { kind: 0, a: 0, b: 0, k: 0, pre: 0, s: 0 }

/** Capacity of the story surface at (u, age) at story time T (labels, pens). */
export function capAt(T: number, u: number, age: number): number {
  const bl = blendAt(T, _bl)
  const a = sampleGrid(G[bl.a], u, age)
  if (bl.kind === 0) return a
  const b = sampleGrid(G[bl.b], u, age)
  return lerp(a, b, blendW(bl, u, age))
}

/** Mean capacity of the displayed surface at T (exact: column / row sums of the blend). */
export function meanAt(T: number): number {
  const bl = blendAt(T, _bl)
  if (bl.kind === 0) return MEANS[bl.a]
  if (bl.kind === 3) return lerp(MEANS[bl.a], MEANS[bl.b], bl.k)
  let s = 0
  if (bl.kind === 1) {
    for (let di = 0; di < ND; di++) s += lerp(COLS[bl.a][di], COLS[bl.b][di], sinkW(di / (ND - 1), bl.k))
  } else {
    for (let ai = 0; ai < NA; ai++) s += lerp(ROWS[bl.a][ai], ROWS[bl.b][ai], waveW(ageOfRow(ai), bl.pre, bl.s))
  }
  return s / N
}

/** The HUD value at T: the running integral while the volume pours (L2), then the volume of the surface shown. */
export function hudValue(T: number): number {
  if (T < B.volume) return 0
  if (T < B.line) {
    const lv = pourLevel(T)
    if (lv <= 0) return 0
    const g = G[GL]
    let s = 0
    for (let i = 0; i < N; i++) s += g[i] < lv ? g[i] : lv
    return scoreOfMean(s / N)
  }
  return scoreOfMean(meanAt(T))
}

/*
 * Continuity (C.5), development builds only: every piecewise cue must meet
 * itself at each beat boundary, so the frame just before beat n starts
 * equals the frame at its start. Samples the surface, the HUD and the cues
 * that switch branches on a beat index.
 */
if (import.meta.env.DEV) {
  const probes: ((T: number) => number)[] = [
    (T) => capAt(T, 0, 20),
    (T) => capAt(T, 0.5, 52),
    (T) => capAt(T, 1, 85),
    (T) => capAt(T, 0.2, 47),
    (T) => capAt(T, 0.8, 70),
    hudValue,
    pourLevel,
    wallRim,
    planeCap,
    scanOn,
    scanAge,
    lostOutline,
    beforeOutline,
    age30,
    sedName,
    indep70,
    s50Name,
    indep85,
    claimIn,
    fuse,
  ]
  for (let n = 1; n < 7; n++) {
    probes.forEach((f, i) => {
      const a = f(n - 1e-6)
      const b = f(n)
      if (Math.abs(a - b) > 1e-3) console.warn(`[health] continuity break at beat ${n}, probe ${i}: ${a} vs ${b}`)
    })
  }
}
