/* =========================================================================
   Repetitions on STORY time (story/kit/athlete): the rep phase as a pure,
   closed-form function of beat t, never accumulated. A tempo change
   changes the slope of the phase, never its value, so the athlete never
   jumps; and the phase can be made to land on a chosen position at t = 1
   (a held frame, a deep link and reduced motion all show that position).

   The ambient clock A cannot do this (changing a rate on A jumps the phase),
   so athletes never run on A in story mode.
   ========================================================================= */

const frac = (x: number) => x - Math.floor(x)

/** Rep phase after `seconds` at a steady `repSeconds` per rep (seconds = t x beat.build, for example). */
export const repPhase = (seconds: number, repSeconds: number): number => frac(seconds / repSeconds)

/** One tempo window: from beat t `t0` (to the next window's t0, or 1) the phase advances `rate` reps per unit t. */
export type TempoWindow = readonly [t0: number, rate: number]

/** Reps done by beat t under piecewise-constant rates (the integral; continuous in t). */
export function repsAt(t: number, windows: readonly TempoWindow[]): number {
  let reps = 0
  for (let i = 0; i < windows.length; i++) {
    const a = windows[i][0]
    const b = i + 1 < windows.length ? windows[i + 1][0] : 1
    if (t <= a) break
    reps += windows[i][1] * (Math.min(t, b) - a)
  }
  return reps
}

export interface TempoOpts {
  /** the rep phase the beat lands on at t = 1 (for example the middle of the pull) */
  land: number
  /**
   * the rep phase at t = 0. With both `start` and `land`, the rates are
   * scaled by one common factor (the tempo ratios kept) so the beat runs a
   * whole number of reps plus exactly (land - start): the previous beat's
   * landing equals this beat's start, and (N, 1) equals (N + 1, 0).
   */
  start?: number
}

/** The common rate factor that makes start -> land fit a whole number of reps (closest to the nominal). Cheap, allocation-free. */
function fitScale(windows: readonly TempoWindow[], start: number, land: number): number {
  const nominal = repsAt(1, windows)
  const gap = frac(land - start)
  const n = Math.max(0, Math.round(nominal - gap))
  return nominal > 0 ? (n + gap) / nominal : 1
}

/**
 * The rep phase at beat t (0..1, wrapped) for piecewise tempo windows,
 * landing on `opts.land` at t = 1. Pure and closed-form: the threshold
 * beats speed the reps up (relative tempo 1 : 1.2 : 1.4) without a jump.
 *
 *   const W: TempoWindow[] = [[0, 2.2], [0.24, 2.64], [0.54, 3.08]]
 *   phase = tempoPhase(t, W, { land: phaseMid('mb-pull', 'pull'), start: previousLand })
 */
export function tempoPhase(t: number, windows: readonly TempoWindow[], opts: TempoOpts): number {
  const s = opts.start === undefined ? 1 : fitScale(windows, opts.start, opts.land)
  const total = repsAt(1, windows) * s
  return frac(opts.land - total + repsAt(t, windows) * s)
}

/** Relative tempo -> reps per unit t for a beat of `buildSeconds` at a base `repSeconds` per rep. */
export const repsPerT = (relative: number, buildSeconds: number, repSeconds: number) => (relative * buildSeconds) / repSeconds

/**
 * A rep driven through explicit knots [t, phase] (piecewise linear between
 * them, held before the first and after the last): T4's single clean, where
 * each part of the lift has its own window of beat t. Phases must not
 * decrease (add 1 to continue into the next rep).
 */
export function knotPhase(t: number, knots: readonly (readonly [t: number, phase: number])[]): number {
  const n = knots.length
  if (t <= knots[0][0]) return knots[0][1]
  if (t >= knots[n - 1][0]) return knots[n - 1][1]
  let i = 0
  while (i < n - 2 && knots[i + 1][0] <= t) i++
  const [t0, p0] = knots[i]
  const [t1, p1] = knots[i + 1]
  return p0 + ((p1 - p0) * (t - t0)) / (t1 - t0)
}
