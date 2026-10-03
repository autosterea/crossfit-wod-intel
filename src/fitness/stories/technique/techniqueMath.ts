import { PATH } from './layout'
import { B, PATH_T, d12Rise, d14Rise } from './timeline'

/* =========================================================================
   08 TECHNIQUE math: the learning path (T7) and the worked example (T8) as
   pure functions of story time, and the athlete's tempo and form that follow
   them (STORYBOARD-technique section 2, "Determinism"): the rep phase is a
   closed-form integral of a piecewise-linear tempo, so a tempo change never
   makes the phase jump, and each beat lands on the pull at t = 1.
   ========================================================================= */

/** Cumulative arc fractions of the path's corners in plane units (the pen's progress at each corner). */
const SEG_LEN = PATH.slice(1).map((p, i) => Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1]))
const TOTAL = SEG_LEN.reduce((a, b) => a + b, 0)
export const PATH_CUM: readonly number[] = SEG_LEN.reduce<number[]>((acc, l) => [...acc, acc[acc.length - 1] + l / TOTAL], [0])

/** The pen on T7's path at beat t: segment index and the share of it drawn (linear in its window). */
function penAt(t: number): { i: number; k: number } {
  if (t <= PATH_T[0][0]) return { i: 0, k: 0 }
  for (let i = 0; i < PATH_T.length; i++) {
    const [a, b] = PATH_T[i]
    if (t < b) return { i, k: Math.max(0, (t - a) / (b - a)) }
  }
  return { i: PATH_T.length - 1, k: 1 }
}

/** The pen's progress along the whole path (arc fraction) at T. */
export function pathProgress(T: number): number {
  if (T < B.threshold) return 0
  if (T >= B.threshold + 1) return 1
  const { i, k } = penAt(T - B.threshold)
  return PATH_CUM[i] + (PATH_CUM[i + 1] - PATH_CUM[i]) * k
}

const _pen: [number, number] = [0, 0]
/** The pen's plane position (pu, pv) at beat t of T7 (a shared tuple). */
export function penPos(t: number): [number, number] {
  const { i, k } = penAt(t)
  _pen[0] = PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * k
  _pen[1] = PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * k
  return _pen
}

/** Relative tempo at plane pu (the ratios of 10,000, 12,000 and 14,000 at pu 0.30, 0.54 and 0.78). */
export const tempoAt = (pu: number) => 1 + (pu - 0.3) / 1.2
/** Form as a lumbar fault 0..1 from plane pv: 40 degrees at pv 0.88, -20 at pv 0.50, linear. */
export const faultAt = (pv: number) => Math.min(1, Math.max(0, (0.88 - pv) / 0.38))

/* --------------------------- tempo integrals --------------------------- */

/** A piecewise-linear tempo: knots [t, relative tempo] (held outside), integrated exactly (trapezoids). */
type Knots = readonly (readonly [number, number])[]

function integrate(knots: Knots, t: number): number {
  let acc = 0
  if (t <= knots[0][0]) return knots[0][1] * t
  acc += knots[0][1] * knots[0][0]
  for (let i = 0; i < knots.length - 1; i++) {
    const [a, va] = knots[i]
    const [b, vb] = knots[i + 1]
    if (t <= a) break
    const e = Math.min(t, b)
    const ve = va + ((vb - va) * (e - a)) / (b - a || 1)
    acc += ((va + ve) / 2) * (e - a)
    if (t <= b) return acc
  }
  const [lt, lv] = knots[knots.length - 1]
  if (t > lt) acc += lv * (t - lt)
  return acc
}

/** T7's tempo follows the pen's pu: knots at every window edge (the pen is linear inside each). */
const T7_TEMPO: Knots = (() => {
  const k: [number, number][] = [[0, tempoAt(PATH[0][0])]]
  for (let i = 0; i < PATH_T.length; i++) {
    k.push([PATH_T[i][0], tempoAt(PATH[i][0])])
    k.push([PATH_T[i][1], tempoAt(PATH[i + 1][0])])
  }
  k.push([1, tempoAt(PATH[PATH.length - 1][0])])
  return k
})()
/** T8's tempo: 1 (10,000), 1.2 from 0.22 (12,000), 1.4 from 0.54 (14,000); steps are fine (the phase is an integral). */
const T8_TEMPO: Knots = [
  [0, 1],
  [0.22, 1],
  [0.2201, 1.2],
  [0.54, 1.2],
  [0.5401, 1.4],
  [1, 1.4],
]

const frac = (x: number) => x - Math.floor(x)

/**
 * The rep phase on a beat: start + s x reps(t), with s a common factor that
 * keeps the tempo ratios and fits a whole number of reps from `start` to
 * `land` (so the beat lands on the pull at t = 1 and the next beat starts
 * where this one ended).
 */
function phaseOn(knots: Knots, t: number, base: number, start: number, land: number): number {
  const total = integrate(knots, 1) * base
  const gap = frac(land - start)
  const n = Math.max(1, Math.round(total - gap))
  const s = (n + gap) / total
  return frac(start + s * integrate(knots, t) * base)
}

/** a pull at tempo 1 takes 2.2 s of the beat's designed build (the kit's mb-pull repSeconds) */
const REP_S = 2.2
export const BUILD7 = 6.5
export const BUILD8 = 6.5

/** The athlete's rep phase across T7, T8 and T9 (held on the pull in T9). */
export function pullPhase(T: number, land: number): number {
  if (T < B.threshold) return land
  if (T < B.margin) return phaseOn(T7_TEMPO, T - B.threshold, BUILD7 / REP_S, land, land)
  if (T < B.everything) return phaseOn(T8_TEMPO, T - B.margin, BUILD8 / REP_S, land, land)
  return land
}

/** T8's dots: d12 and d14 pv (low while form falls apart, rising as it is fixed). */
export const d12pv = (T: number) => 0.5 + 0.38 * d12Rise(T)
export const d14pv = (T: number) => 0.5 + 0.38 * d14Rise(T)

/** The athlete's lumbar fault across T7 and T8: T7 follows the pen's pv; T8 follows the speed it is at. */
export function pullFault(T: number): number {
  if (T < B.threshold || T >= B.everything) return 0
  if (T < B.margin) return faultAt(penPos(T - B.threshold)[1])
  const t = T - B.margin
  // 12,000: the back rounds as the speed rises (0.22 to 0.32) and is fixed at that speed with d12 (0.40 to 0.52)
  if (t < 0.54) {
    const round = Math.min(1, Math.max(0, (t - 0.22) / 0.1))
    return Math.min(round, faultAt(d12pv(T)))
  }
  // 14,000: again (0.56 to 0.66), narrowed in with d14 (0.70 to 0.78)
  const round = Math.min(1, Math.max(0, (t - 0.56) / 0.1))
  return Math.min(round, faultAt(d14pv(T)))
}
