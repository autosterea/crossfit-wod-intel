import { POWER_CURVES, POWER_DOMAIN_TILT, POWER_DURATIONS, PAL } from '../../fitnessData'
import { catmull1, clamp } from '../../lessonMath'
import { intervalAxis } from '../../story/kit/axis'

/* =========================================================================
   Definition math. valAt, meanOf, scoreOf, scoreWord and scoreColor are
   moved VERBATIM from the retired modules/DefinitionModule.tsx, so every
   displayed score is unchanged from the live site (Generalist 94,
   Team-sport 86, Triathlete 84, Marathoner 77, 100m Sprinter 66,
   Powerlifter 37, Sedentary 33).

   The x axis is the benchmark INTERVAL axis (DESIGN.md D.5, F.1): the eight
   sample durations sit at u = i / 7 and each segment between them is log.
   The drawn curve is valAt(samples, u), exactly the function scoreOf
   integrates, so the drawn area IS the score.
   ========================================================================= */

/** Relative power 0..1.08 at log-duration parameter u in [0,1]. */
export function valAt(samples: number[], u: number): number {
  return clamp(catmull1(samples, u * (samples.length - 1)), 0, 1.08)
}

/** Mean relative power across the curve = the integral the score is built on. */
export function meanOf(samples: number[]): number {
  let s = 0
  const M = 64
  for (let i = 0; i < M; i++) s += valAt(samples, i / (M - 1))
  return s / M
}

/**
 * 0-100 fitness score = area under the averaged curve, normalized. The
 * multiplier is tuned so the Generalist (meanOf ~= 0.626) lands ~94 and
 * reads "Broad"; a specialist's narrower area scores lower.
 */
export function scoreOf(samples: number[]): number {
  return clamp(Math.round(meanOf(samples) * 150), 0, 100)
}

export function scoreWord(s: number): string {
  return s >= 85 ? 'Broad' : s >= 45 ? 'Narrow' : 'Low'
}

export function scoreColor(s: number): string {
  return s >= 85 ? PAL.fit : s >= 45 ? PAL.both : PAL.sick
}

/* ---------------------------- derived data ---------------------------- */

export const AXIS = intervalAxis(POWER_DURATIONS)

export type PowerCurveEntry = (typeof POWER_CURVES)[number]
export const CURVE_BY_KEY: Record<string, PowerCurveEntry> = POWER_CURVES.reduce(
  (acc, c) => {
    acc[c.name] = c
    return acc
  },
  {} as Record<string, PowerCurveEntry>,
)

export const GENERALIST = POWER_CURVES[0]
export const POWERLIFTER = CURVE_BY_KEY['Powerlifter']

/** A flat 5-domain tilt fallback for any name missing from POWER_DOMAIN_TILT. */
const FLAT_TILT = [1, 1, 1, 1, 1]
export const domainMult = (name: string): number[] => POWER_DOMAIN_TILT[name] ?? FLAT_TILT

/**
 * Domain honesty (DESIGN.md D.5, F.2): curve d is drawn as
 * valAt * tilt[d] / mean(tilt), so the five curves average exactly to the
 * stored curve.
 */
export function domainScale(name: string): number[] {
  const t = domainMult(name)
  const m = t.reduce((a, b) => a + b, 0) / t.length
  return t.map((x) => x / m)
}

/** Running area score at a pour level: round(150 x mean over u of min(level, valAt)). */
export function pourScore(samples: number[], level: number): number {
  let s = 0
  const M = 64
  for (let i = 0; i < M; i++) s += Math.min(level, valAt(samples, i / (M - 1)))
  return clamp(Math.round((s / M) * 150), 0, 100)
}

/** The seven archetypes ranked by area score (computed, never hard-coded). */
export const RANKED = POWER_CURVES.map((c) => ({ name: c.name, samples: c.samples, score: scoreOf(c.samples) })).sort(
  (a, b) => b.score - a.score,
)

if (import.meta.env.DEV) {
  const expect = [
    ['Generalist CrossFitter', 94],
    ['Team-sport Athlete', 86],
    ['Triathlete', 84],
    ['Marathoner', 77],
    ['100m Sprinter', 66],
    ['Powerlifter', 37],
    ['Sedentary Adult', 33],
  ] as const
  expect.forEach(([n, s], i) => {
    if (RANKED[i].name !== n || RANKED[i].score !== s)
      console.warn(`[definition] ranking drift at ${i}: ${RANKED[i].name} ${RANKED[i].score}, expected ${n} ${s}`)
  })
}
