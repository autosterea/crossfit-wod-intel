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
   retired modules/PathwaysModule.tsx, so every share and every ribbon
   height is unchanged from the live site (Gastin 2001 crossover table x
   the relative power envelope, both from fitnessData.ts).

   Below the verbatim block: the chart-space view of the same numbers. Time
   is the log axis u = logU(t, 3, 3600) (L11: time runs left to right). A
   band's THICKNESS in v units is powerHeightFrac / 1.2, stacked bottom to
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

/** Band order bottom to top (the LightField FLOW bands A, B, C). */
export const BANDS: readonly EnergyKey[] = ['oxidative', 'glycolytic', 'phosphagen']
export const BAND_COLORS: readonly [string, string, string] = [PAL.oxidative, PAL.glycolytic, PAL.phosphagen]

/** Stacked mode: a band's thickness in v units is powerHeightFrac / 1.2 (D.4). */
export const STACK_DIV = 1.2
/** Lanes mode (D.4): each lane's baseline in v units, bottom to top (oxidative, glycolytic, phosphagen). */
export const LANE_BASE: readonly [number, number, number] = [0, 0.35, 0.7]
/** Lanes mode: lane height = powerHeightFrac x 0.30 FH, one shared scale, i.e. the stacked thickness x 0.36. */
export const LANE_THICK = 0.3 * STACK_DIV
/** Share mode (explore): the stack top is normalised to this height in v units. */
export const SHARE_TOP = 0.8

/** Samples along u for the bands, the pens and the light (150 x-segments, D.4). */
export const N_U = 151

export interface BandTable {
  /** power thickness per band (bottom to top) at each sample, v units */
  power: Float32Array[]
  /** share thickness per band at each sample (share / 100 x SHARE_TOP), v units */
  share: Float32Array[]
}

/** The three bands sampled at N_U points (computed once from the data). */
export const TABLE: BandTable = (() => {
  const power = BANDS.map(() => new Float32Array(N_U))
  const share = BANDS.map(() => new Float32Array(N_U))
  for (let i = 0; i < N_U; i++) {
    const t = tOf(i / (N_U - 1))
    const c = contribAtT(t)
    BANDS.forEach((k, b) => {
      power[b][i] = powerHeightFrac(k, t) / STACK_DIV
      share[b][i] = (c[k] / 100) * SHARE_TOP
    })
  }
  return { power, share }
})()

/** Linear read of a sampled table at u. */
export function sampleAt(a: Float32Array, u: number): number {
  const f = clamp(u, 0, 1) * (a.length - 1)
  const i = Math.min(a.length - 2, Math.floor(f))
  return a[i] + (a[i + 1] - a[i]) * (f - i)
}

/** Power thickness of band b at u (exact, not sampled). */
export const thickAt = (b: number, u: number): number => powerHeightFrac(BANDS[b], tOf(u)) / STACK_DIV
/** Top of the stacked power envelope at u, v units (= envelope / HEIGHT_NORM / 1.2). */
export const envAt = (u: number): number => thickAt(0, u) + thickAt(1, u) + thickAt(2, u)

/** The largest band thickness (the FLOW motes' height range, hMax). */
export const H_MAX = Math.max(...TABLE.power.map((a) => Math.max(...a)), SHARE_TOP) * 1.001

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

/* ----------------------------- benchmarks ----------------------------- */

/** The benchmarks inside the axis (studs); Marathon (12600 s) is never plotted on it (F.7). */
export const PINS = ENERGY_BENCHMARKS.filter((b) => b.seconds <= T_MAX)
export const OFF_AXIS = ENERGY_BENCHMARKS.filter((b) => b.seconds > T_MAX)
export const MARATHON = OFF_AXIS[0] ?? null
export const pinIndex = (name: string): number => PINS.findIndex((b) => b.name === name)

/** The duration-band boundaries (s): 10 s and 120 s, read from ENERGY_SYSTEMS[].duration. */
function parseSeconds(s: string): number {
  const m = s.match(/(\d+(?:\.\d+)?)\s*(sec|min|hr)/)
  if (!m) return NaN
  const v = parseFloat(m[1])
  return m[2] === 'min' ? v * 60 : m[2] === 'hr' ? v * 3600 : v
}
/** "0 to 10 sec" ends at 10 s; "10 sec to 2 min" ends at 120 s. */
const B1 = parseSeconds(SYS[0].duration.split(' to ')[1] ?? '10 sec')
const B2 = parseSeconds(SYS[1].duration.split(' to ')[1] ?? '2 min')
/** u of the bracket boundaries in axis order (phosphagen, glycolytic, oxidative): [0, u(10 s), u(120 s), 1]. */
export const BRACKET_U: readonly number[] = [0, uOf(Number.isFinite(B1) ? B1 : 10), uOf(Number.isFinite(B2) ? B2 : 120), 1]

if (import.meta.env.DEV) {
  // the stack top is the envelope and never exceeds the plotted range
  const top = Math.max(...Array.from({ length: N_U }, (_, i) => TABLE.power[0][i] + TABLE.power[1][i] + TABLE.power[2][i]))
  if (top > 1) console.warn(`[pathways] stack top ${top.toFixed(3)} exceeds v = 1`)
  if (Math.abs(BRACKET_U[1] - uOf(10)) > 1e-6 || Math.abs(BRACKET_U[2] - uOf(120)) > 1e-6)
    console.warn('[pathways] duration strings no longer parse to 10 s and 120 s')
}
