import { AGING_PROFILES, agingCapacity, type AgingProfile } from '../../fitnessData'
import { clamp, lerp, map, smoothstep } from '../../lessonMath'

/* =========================================================================
   06 HEALTH math (DESIGN.md D.7, G "Kept"): moved VERBATIM from the legacy
   modules/HealthModule.tsx (EXTRA_PROFILES, ALL_PROFILES, sliceMean,
   healthScore, fitnessAt, gridFor and their constants), so every readout
   matches the live site. The story uses AGING_PROFILES only; explore keeps
   all seven (F.6: the three extras are module copy, not verified data).
   Story helpers (world mapping, grid sampling, sums) follow the moved code.
   ========================================================================= */

export const ND = 56 // duration samples (X)
export const NA = 46 // age samples (Z)
export const AGE_MIN = 20
export const AGE_MAX = 85

// Score scaling carried over from the source so the 0..100 readouts match.
export const HEALTH_SCALE = 175
export const FITNESS_SCALE = 143

/* ------------------------- extra aging profiles ------------------------ *
 * The shared AGING_PROFILES (fitnessData) ships four canonical trajectories.
 * The user asked for MORE options, so we compose additional, physiologically
 * honest AgingProfile objects LOCALLY here (fitnessData is untouched) and merge
 * them into the preset list. Each new ampAt(age) returns a 0..1 amplitude that
 * the shared agingCapacity() multiplies by the duration shape - so these obey
 * the exact same surface model as the built-ins, just with different histories.
 *
 * Honesty notes:
 *  - "Detrained at 40": a trained adult who stops cold at 40. Capacity holds
 *    high until ~38 then drops steeply over the next several years (accelerated
 *    sarcopenia / power loss when training stops), settling toward a low,
 *    sedentary-like decline tail. Crosses the line earlier than a lifelong
 *    trainer but later than someone never trained.
 *  - "Masters competitor": trains hard for life, a notch below the elite
 *    lifelong trainer (a touch lower peak, a slightly steeper post-50 slope)
 *    yet still well above the line into the late eighties.
 *  - "Sedentary then active at 60": the late-start mirror of "Starts at 50" but
 *    later - decades sedentary, then resistance + power training at 60 reclaims
 *    real capacity (the literature: trainable even into the 90s), lifting the
 *    whole surface and buying years of independence.
 */
const detrainedSed = (a: number): number =>
  Math.max(a < 24 ? 0.5 : 0.5 * (1 - (0.14 * (a - 24)) / 10), 0.06)

export const EXTRA_PROFILES: AgingProfile[] = [
  {
    name: 'Detrained at 40',
    trajectory: 'Trained and strong through the thirties, then training stops at 40 and the surface drops steeply over the next decade as power and muscle are lost. The crossing comes early.',
    peak: 0.85,
    independentThrough: '74',
    ampAt: (a) => {
      const trained = Math.max(a < 32 ? 0.85 : 0.85 - (0.045 * (a - 32)) / 10, 0.3)
      const fell = detrainedSed(a)
      // smoothly hand off from the trained track to the detrained decline at 40
      const k = smoothstep(38, 47, a)
      return Math.max(lerp(trained, fell, k), 0.06)
    },
    modality: 0.62,
  },
  {
    name: 'Masters competitor',
    trajectory: 'Trains hard for life and competes into the masters divisions. A notch below the elite lifelong trainer, with a slightly steeper slope past fifty, yet still far above the line deep into old age.',
    peak: 0.92,
    independentThrough: '88',
    ampAt: (a) => {
      if (a < 30) return 0.92
      // gentle to 50, a touch steeper after (power fades fastest past 50)
      const early = 0.92 - (0.04 * (a - 30)) / 10
      const late = 0.92 - (0.04 * 20) / 10 - (0.07 * (a - 50)) / 10
      return Math.max(a < 50 ? early : late, 0.34)
    },
    modality: 0.92,
  },
  {
    name: 'Sedentary then active at 60',
    trajectory: 'Decades sedentary, then resistance and power training begun at 60 reclaims real capacity and lifts the whole surface. Proof that the curve responds at any age, buying back years of independence.',
    peak: 0.6,
    independentThrough: '84',
    ampAt: (a) => {
      const sed = Math.max(a < 24 ? 0.45 : 0.45 * (1 - (0.16 * (a - 24)) / 10), 0.05)
      // the reclaimed track the late starter rises onto (a moderate trained adult)
      const tr = Math.max(a < 32 ? 0.66 : 0.66 - (0.05 * (a - 32)) / 10, 0.26)
      const k = smoothstep(58, 66, a)
      return lerp(sed, tr, k)
    },
    modality: 0.45,
  },
]

/** Built-in profiles plus the local extras, in one list for lookup + presets. */
export const ALL_PROFILES: AgingProfile[] = [...AGING_PROFILES, ...EXTRA_PROFILES]
export const PROFILE_NAMES = ALL_PROFILES.map((p) => p.name)


/** Mean capacity along one age slice (averaged across the duration axis). */
export function sliceMean(p: AgingProfile, age: number): number {
  const N = 48
  let s = 0
  for (let i = 0; i < N; i++) s += agingCapacity(i / (N - 1), age, p)
  return s / N
}

/** Health = volume under the surface = mean capacity over every age and duration. */
export function healthScore(p: AgingProfile): number {
  let s = 0
  for (let ai = 0; ai < NA; ai++) {
    const age = map(ai, 0, NA - 1, AGE_MIN, AGE_MAX)
    for (let di = 0; di < ND; di++) s += agingCapacity(di / (ND - 1), age, p)
  }
  return clamp(Math.round((s / (ND * NA)) * HEALTH_SCALE), 0, 100)
}

/** Fitness at one age = the area under that single slice, scaled 0..100. */
export function fitnessAt(p: AgingProfile, age: number): number {
  return clamp(Math.round(sliceMean(p, age) * FITNESS_SCALE), 0, 100)
}

/** Build the flat capacity grid for a profile (row-major, age outer, duration inner). */
export function gridFor(p: AgingProfile): Float32Array {
  const arr = new Float32Array(ND * NA)
  for (let ai = 0; ai < NA; ai++) {
    const age = map(ai, 0, NA - 1, AGE_MIN, AGE_MAX)
    for (let di = 0; di < ND; di++) arr[ai * ND + di] = agingCapacity(di / (ND - 1), age, p)
  }
  return arr
}


/* ------------------------------ story helpers ------------------------------ */

/** The four canonical trajectories the story uses (F.6). */
export const LIFELONG = AGING_PROFILES[0]
export const SEDENTARY = AGING_PROFILES[2]
export const STARTS_50 = AGING_PROFILES[3]

/** Age of grid row ai. */
export const ageOfRow = (ai: number) => map(ai, 0, NA - 1, AGE_MIN, AGE_MAX)

/** Bilinear sample of a capacity grid at duration u (0..1) and age (years). */
export function sampleGrid(g: Float32Array, u: number, age: number): number {
  const af = clamp(((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * (NA - 1), 0, NA - 1)
  const a0 = Math.floor(af)
  const a1 = Math.min(NA - 1, a0 + 1)
  const fa = af - a0
  const df = clamp(u, 0, 1) * (ND - 1)
  const d0 = Math.floor(df)
  const d1 = Math.min(ND - 1, d0 + 1)
  const fd = df - d0
  const top = lerp(g[a0 * ND + d0], g[a0 * ND + d1], fd)
  const bot = lerp(g[a1 * ND + d0], g[a1 * ND + d1], fd)
  return lerp(top, bot, fa)
}

/** Sum of each duration column (for exact means of per-duration blends). */
export function colSums(g: Float32Array): Float64Array {
  const out = new Float64Array(ND)
  for (let ai = 0; ai < NA; ai++) for (let di = 0; di < ND; di++) out[di] += g[ai * ND + di]
  return out
}

/** Sum of each age row (for exact means of per-age blends). */
export function rowSums(g: Float32Array): Float64Array {
  const out = new Float64Array(NA)
  for (let ai = 0; ai < NA; ai++) for (let di = 0; di < ND; di++) out[ai] += g[ai * ND + di]
  return out
}

/** The healthScore scaling applied to a mean capacity (identical to healthScore at the grid means). */
export const scoreOfMean = (mean: number) => clamp(Math.round(mean * HEALTH_SCALE), 0, 100)

/** Grid indices once around the footprint: front (age 20, 1 s to 1 hr), right, back, left (the age axis). */
export const PERIM: readonly number[] = (() => {
  const p: number[] = []
  for (let di = 0; di < ND; di++) p.push(di)
  for (let ai = 1; ai < NA; ai++) p.push(ai * ND + ND - 1)
  for (let di = ND - 2; di >= 0; di--) p.push((NA - 1) * ND + di)
  for (let ai = NA - 2; ai >= 0; ai--) p.push(ai * ND)
  return p
})()
