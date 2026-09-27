import {
  ENERGY_BENCHMARKS,
  ENERGY_CROSSOVER,
  ENERGY_PEAK_POWER,
  ENERGY_POWER_ENVELOPE,
  ENERGY_SYSTEMS,
  PAL,
  type EnergyKey,
} from '../../fitnessData'
import { clamp, fmtDuration, lerp, logU, uToT } from '../../lessonMath'

/* =========================================================================
   Pathways math (DESIGN.md D.4, G). T_MIN, T_MAX, interpAtU, rawContribAtT,
   contribAtT, envelopeAtT, powerHeightFrac, dominantOf, HEIGHT_NORM,
   PEAK_ORDER_TEXT, sliderToT and tToSlider are moved VERBATIM from the
   retired modules/PathwaysModule.tsx, so every share READOUT (the HUD, the
   callouts, the explore panel, the dominant engine, the pins) is unchanged
   from the live site (Gastin 2001 crossover table x the relative power
   envelope, both from fitnessData.ts).

   The DRAWN geometry (bands, pens, the river) passes through exactly the
   same table rows but joins them with a monotone cubic (Fritsch-Carlson,
   PCHIP) instead of the verbatim smoothstep. The smoothstep has zero slope
   at every one of the 17 rows, which printed a terrace at each row on a
   front-on phone chart (review r1). PCHIP keeps every row value and the
   monotonicity inside each bracket, so no drawn value leaves the data
   (proposed D.4 amendment in the chapter report).

   Time is the log axis u = logU(t, 3, 3600) (L11: time runs left to right).
   A band's THICKNESS in v units is its power height / 1.2, stacked bottom to
   top as oxidative, glycolytic, phosphagen, so the top of the stack is the
   power envelope (D.4 "Stacked mode").
   ========================================================================= */

/* ------------------------------ verbatim ------------------------------ */

export const T_MIN = 3 // seconds (matches ENERGY_CROSSOVER[0])
export const T_MAX = 3600 // seconds (matches last ENERGY_CROSSOVER point)

const SYS = ENERGY_SYSTEMS // [phosphagen, glycolytic, oxidative]
export const COLOR: Record<EnergyKey, string> = {
  phosphagen: PAL.phosphagen,
  glycolytic: PAL.glycolytic,
  oxidative: PAL.oxidative,
}
export const NAME: Record<EnergyKey, string> = {
  phosphagen: SYS[0].name,
  glycolytic: SYS[1].name,
  oxidative: SYS[2].name,
}

// Pre-extract the crossover table into parallel arrays so we can monotone-
// interpolate each system's percentage across log-time (anchored to Gastin
// 2001), plus the matching power envelope (one value per crossover row).
const X_NODES = ENERGY_CROSSOVER.map((p) => logU(clamp(p.seconds, T_MIN, T_MAX), T_MIN, T_MAX))
const PHOS_NODES = ENERGY_CROSSOVER.map((p) => p.phosphagen)
const GLY_NODES = ENERGY_CROSSOVER.map((p) => p.glycolytic)
const OXI_NODES = ENERGY_CROSSOVER.map((p) => p.oxidative)
// Relative max-sustainable TOTAL power at each crossover duration (0..1).
const ENV_NODES = ENERGY_POWER_ENVELOPE

// Normalize so the phosphagen power peak (near 3s) reaches near the top of the
// plot. Phosphagen owns ~88% share at 3s where the envelope is highest, so its
// height = 0.88 * envelope(3s) is the tallest point any ribbon ever reaches.
const PEAK_POWER_HEIGHT = (PHOS_NODES[0] / 100) * ENV_NODES[0]
export const HEIGHT_NORM = PEAK_POWER_HEIGHT > 1e-6 ? PEAK_POWER_HEIGHT : 1

/** Monotone (smoothstep-eased, clamped) interpolation of a value at u in 0..1. */
export function interpAtU(u: number, ys: number[]): number {
  const x = clamp(u, 0, 1)
  const n = X_NODES.length
  if (x <= X_NODES[0]) return ys[0]
  if (x >= X_NODES[n - 1]) return ys[n - 1]
  let i = 0
  while (i < n - 1 && X_NODES[i + 1] < x) i++
  const x0 = X_NODES[i]
  const x1 = X_NODES[i + 1]
  const span = x1 - x0
  const tt = span > 1e-6 ? (x - x0) / span : 0
  // smoothstep eased cubic for an organic ribbon, kept inside the data bracket.
  const s = tt * tt * (3 - 2 * tt)
  return lerp(ys[i], ys[i + 1], s)
}

/** Raw (un-normalized) Gastin percentages at a duration in seconds. */
export function rawContribAtT(t: number): { phosphagen: number; glycolytic: number; oxidative: number } {
  const u = logU(clamp(t, T_MIN, T_MAX), T_MIN, T_MAX)
  return {
    phosphagen: interpAtU(u, PHOS_NODES),
    glycolytic: interpAtU(u, GLY_NODES),
    oxidative: interpAtU(u, OXI_NODES),
  }
}

/** Normalized-to-100 share of energy supply at a duration (the readout numbers). */
export function contribAtT(t: number): { phosphagen: number; glycolytic: number; oxidative: number } {
  const c = rawContribAtT(t)
  const sum = c.phosphagen + c.glycolytic + c.oxidative || 1
  return {
    phosphagen: (c.phosphagen / sum) * 100,
    glycolytic: (c.glycolytic / sum) * 100,
    oxidative: (c.oxidative / sum) * 100,
  }
}

/** Relative total power envelope (0..1) at a duration, log-interpolated. */
export function envelopeAtT(t: number): number {
  const u = logU(clamp(t, T_MIN, T_MAX), T_MIN, T_MAX)
  return interpAtU(u, ENV_NODES)
}

/**
 * Fraction 0..1 of full ribbon height for one engine at a duration. This is
 * POWER, not share: (engine share% / 100) * envelope(t), normalized so the
 * phosphagen burst peak sits near the top. Oxidative at long efforts has a
 * high SHARE but a tiny envelope, so its height stays a low sustained tail.
 */
export function powerHeightFrac(key: EnergyKey, t: number): number {
  const c = rawContribAtT(t)
  const share = key === 'phosphagen' ? c.phosphagen : key === 'glycolytic' ? c.glycolytic : c.oxidative
  const h = ((share / 100) * envelopeAtT(t)) / HEIGHT_NORM
  return clamp(h, 0, 1.05)
}

export function dominantOf(c: { phosphagen: number; glycolytic: number; oxidative: number }): EnergyKey {
  if (c.phosphagen >= c.glycolytic && c.phosphagen >= c.oxidative) return 'phosphagen'
  if (c.glycolytic >= c.oxidative) return 'glycolytic'
  return 'oxidative'
}

export const SLIDER_MIN = 0
export const SLIDER_MAX = 1000
export const sliderToT = (s: number): number => uToT(s / SLIDER_MAX, T_MIN, T_MAX)
export const tToSlider = (t: number): number => logU(clamp(t, T_MIN, T_MAX), T_MIN, T_MAX) * SLIDER_MAX

// Peak-power order line for the legend, read straight from ENERGY_PEAK_POWER.
const PEAK_ORDER: EnergyKey[] = (['phosphagen', 'glycolytic', 'oxidative'] as EnergyKey[]).sort(
  (a, b) => ENERGY_PEAK_POWER[b] - ENERGY_PEAK_POWER[a],
)
export const PEAK_ORDER_TEXT = PEAK_ORDER.map((k) => NAME[k]).join(' > ')


/* ----------------------- chart space (derived) ------------------------ */

/** u (0..1 on the log time axis) of a duration in seconds. */
export const uOf = (t: number): number => logU(clamp(t, T_MIN, T_MAX), T_MIN, T_MAX)
/** duration in seconds at u. */
export const tOf = (u: number): number => (u >= 1 ? T_MAX : u <= 0 ? T_MIN : uToT(u, T_MIN, T_MAX))

/* ------------------- drawn curves (monotone cubic) --------------------- */

/** Fritsch-Carlson (PCHIP) node slopes for ys over X_NODES: a C1 curve through every row, monotone inside each bracket. */
function pchipSlopes(ys: readonly number[]): Float64Array {
  const n = X_NODES.length
  const m = new Float64Array(n)
  const h = (i: number) => X_NODES[i + 1] - X_NODES[i]
  const d = (i: number) => (ys[i + 1] - ys[i]) / Math.max(1e-9, h(i))
  m[0] = d(0)
  m[n - 1] = d(n - 2)
  for (let i = 1; i < n - 1; i++) {
    const d0 = d(i - 1)
    const d1 = d(i)
    if (d0 * d1 <= 0) m[i] = 0
    else {
      const w1 = 2 * h(i) + h(i - 1)
      const w2 = h(i) + 2 * h(i - 1)
      m[i] = (w1 + w2) / (w1 / d0 + w2 / d1)
    }
  }
  return m
}
const SLOPES = {
  phos: pchipSlopes(PHOS_NODES),
  gly: pchipSlopes(GLY_NODES),
  oxi: pchipSlopes(OXI_NODES),
  env: pchipSlopes(ENV_NODES),
}
/** Monotone cubic through the table rows at u (the drawing twin of interpAtU). */
function pchipAt(u: number, ys: readonly number[], ms: Float64Array): number {
  const x = clamp(u, 0, 1)
  const n = X_NODES.length
  if (x <= X_NODES[0]) return ys[0]
  if (x >= X_NODES[n - 1]) return ys[n - 1]
  let i = 0
  while (i < n - 1 && X_NODES[i + 1] < x) i++
  const hh = X_NODES[i + 1] - X_NODES[i]
  const t = hh > 1e-9 ? (x - X_NODES[i]) / hh : 0
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * hh * ms[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * hh * ms[i + 1]
}

/** Band order bottom to top (the river's bands A, B, C). */
export const BANDS: readonly EnergyKey[] = ['oxidative', 'glycolytic', 'phosphagen']
export const BAND_COLORS: readonly [string, string, string] = [PAL.oxidative, PAL.glycolytic, PAL.phosphagen]

/** Stacked mode: a band's thickness in v units is its power height / 1.2 (D.4). */
export const STACK_DIV = 1.2
/** Lanes mode (D.4): each lane's baseline in v units, bottom to top (oxidative, glycolytic, phosphagen). */
export const LANE_BASE: readonly [number, number, number] = [0, 0.35, 0.7]
/** Lanes mode: lane height = power height x 0.30 FH, one shared scale, i.e. the stacked thickness x 0.36. */
export const LANE_THICK = 0.3 * STACK_DIV
/** Share mode (explore): the stack top is normalised to this height in v units. */
export const SHARE_TOP = 0.8

/**
 * The drawn share (0..1) of band b at u: the three monotone cubics,
 * normalised so the stack top is exactly the drawn envelope. At every table
 * row it equals the row's percentage / 100.
 */
function drawnShare(b: number, u: number): number {
  const p = pchipAt(u, PHOS_NODES, SLOPES.phos)
  const g = pchipAt(u, GLY_NODES, SLOPES.gly)
  const o = pchipAt(u, OXI_NODES, SLOPES.oxi)
  const sum = p + g + o || 1
  return (b === 0 ? o : b === 1 ? g : p) / sum
}
/** The drawn relative power envelope (0..1) at u. */
const drawnEnv = (u: number): number => pchipAt(u, ENV_NODES, SLOPES.env)

/** Power thickness of band b at u, v units (the drawn twin of powerHeightFrac / 1.2). */
export const thickAt = (b: number, u: number): number => clamp((drawnShare(b, u) * drawnEnv(u)) / HEIGHT_NORM, 0, 1.05) / STACK_DIV
/** Share thickness of band b at u, v units (explore "Share"). */
export const shareThickAt = (b: number, u: number): number => drawnShare(b, u) * SHARE_TOP
/** Top of the stacked power envelope at u, v units. */
export const envAt = (u: number): number => thickAt(0, u) + thickAt(1, u) + thickAt(2, u)

/** Samples along u for the bands, the pens and the light (150 x-segments, D.4). */
export const N_U = 151

export interface BandTable {
  /** power thickness per band (bottom to top) at each sample, v units */
  power: Float32Array[]
  /** share thickness per band at each sample (share x SHARE_TOP), v units */
  share: Float32Array[]
}

/** The three bands sampled at N_U points (computed once from the data). */
export const TABLE: BandTable = (() => {
  const power = BANDS.map(() => new Float32Array(N_U))
  const share = BANDS.map(() => new Float32Array(N_U))
  for (let i = 0; i < N_U; i++) {
    const u = i / (N_U - 1)
    for (let b = 0; b < 3; b++) {
      power[b][i] = thickAt(b, u)
      share[b][i] = shareThickAt(b, u)
    }
  }
  return { power, share }
})()

/** Linear read of a sampled table at u. */
export function sampleAt(a: Float32Array, u: number): number {
  const f = clamp(u, 0, 1) * (a.length - 1)
  const i = Math.min(a.length - 2, Math.floor(f))
  return a[i] + (a[i + 1] - a[i]) * (f - i)
}

const maxOf = (a: Float32Array) => a.reduce((m, v) => Math.max(m, v), 0) * 1.001
/** The largest power thickness of each band, v units (the river's per-band height range). */
export const POWER_MAX: readonly [number, number, number] = [maxOf(TABLE.power[0]), maxOf(TABLE.power[1]), maxOf(TABLE.power[2])]
/** The largest share thickness of each band, v units (explore "Share"). */
export const SHARE_MAX: readonly [number, number, number] = [maxOf(TABLE.share[0]), maxOf(TABLE.share[1]), maxOf(TABLE.share[2])]

/** contribAtT without an allocation (per-frame readers): the same numbers, written into `out`. */
export interface Shares {
  phosphagen: number
  glycolytic: number
  oxidative: number
}
export function contribInto(t: number, out: Shares): Shares {
  const u = logU(clamp(t, T_MIN, T_MAX), T_MIN, T_MAX)
  const p = interpAtU(u, PHOS_NODES)
  const g = interpAtU(u, GLY_NODES)
  const o = interpAtU(u, OXI_NODES)
  const sum = p + g + o || 1
  out.phosphagen = (p / sum) * 100
  out.glycolytic = (g / sum) * 100
  out.oxidative = (o / sum) * 100
  return out
}
const _sh: Shares = { phosphagen: 0, glycolytic: 0, oxidative: 0 }
/** dominantOf(contribAtT(t)) without an allocation. */
export const dominantAtT = (t: number): EnergyKey => dominantOf(contribInto(t, _sh))

/**
 * A number that changes exactly when the callout text "fmtDuration(t) -
 * Name share%" changes (fmtDuration's own rounding), so the string is built
 * only then and never per frame.
 */
export function calloutKey(t: number, dom: number, share: number): number {
  const q = t < 90 ? Math.round(t) : t < 600 ? 1000 + Math.round(t / 6) : t < 3600 ? 10000 + Math.round(t / 60) : 20000
  return (q * 4 + dom) * 1000 + share
}

/** The cursor callout (D.4): fmtDuration(t) + " - " + dominant name + " " + share%. */
export function calloutText(t: number): string {
  const c = contribAtT(t)
  const d = dominantOf(c)
  return `${fmtDuration(t)} - ${NAME[d]} ${Math.round(c[d])}%`
}

/* ------------------------ where each engine leads ----------------------- */

/**
 * u where the lead passes from one engine to the next, found on the
 * verbatim readouts, so the duration strips, the P6 brackets and the explore
 * slider track colour each stretch of the axis by the engine the callouts
 * and the pins name there (review r1: strips cut at the 10 s and 2 min
 * strings contradicted the callouts). No number is printed.
 */
function leadEnd(from: EnergyKey, start: number): number {
  const N = 400
  let lo = start
  let hi = 1
  for (let i = 1; i <= N; i++) {
    const u = start + ((1 - start) * i) / N
    if (dominantAtT(tOf(u)) !== from) {
      lo = start + ((1 - start) * (i - 1)) / N
      hi = u
      break
    }
  }
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2
    if (dominantAtT(tOf(mid)) === from) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
const FLIP1 = leadEnd('phosphagen', 0)
/** Axis-order extents (phosphagen, glycolytic, oxidative) of each engine's lead: [0, flip 1, flip 2, 1]. */
export const LEAD_U: readonly number[] = [0, FLIP1, leadEnd('glycolytic', FLIP1 + 1e-6), 1]

/* ----------------------------- benchmarks ----------------------------- */

/** The benchmarks inside the axis (studs); Marathon (12600 s) is never plotted on it (F.7). */
export const PINS = ENERGY_BENCHMARKS.filter((b) => b.seconds <= T_MAX)
export const OFF_AXIS = ENERGY_BENCHMARKS.filter((b) => b.seconds > T_MAX)
export const MARATHON = OFF_AXIS[0] ?? null
export const pinIndex = (name: string): number => PINS.findIndex((b) => b.name === name)
/** Axis slot (0 phosphagen, 1 glycolytic, 2 oxidative) whose lead range holds pin k. */
export const PIN_SLOT: readonly number[] = PINS.map((p) => {
  const u = uOf(p.seconds)
  return u < LEAD_U[1] ? 0 : u < LEAD_U[2] ? 1 : 2
})

if (import.meta.env.DEV) {
  // the drawn curves pass through every table row
  ENERGY_CROSSOVER.forEach((row, i) => {
    const want = (powerHeightFrac('phosphagen', row.seconds) + powerHeightFrac('glycolytic', row.seconds) + powerHeightFrac('oxidative', row.seconds)) / STACK_DIV
    if (Math.abs(envAt(X_NODES[i]) - want) > 1e-6) console.warn(`[pathways] drawn envelope leaves the ${row.seconds} s row`)
  })
  const top = Math.max(...Array.from({ length: N_U }, (_, i) => TABLE.power[0][i] + TABLE.power[1][i] + TABLE.power[2][i]))
  if (top > 1) console.warn(`[pathways] stack top ${top.toFixed(3)} exceeds v = 1`)
  // every pin's `dominant` agrees with the lead range it sits in
  PINS.forEach((p, k) => {
    if ((['phosphagen', 'glycolytic', 'oxidative'] as const)[PIN_SLOT[k]] !== p.dominant) console.warn(`[pathways] ${p.name} sits outside its engine's lead range`)
  })
}
