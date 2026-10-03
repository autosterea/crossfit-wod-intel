import { FRAN_TABLE, HIERARCHY } from '../../fitnessData'

/* =========================================================================
   07 CROSSFIT math (STORYBOARD-crossfit.md). Every number shown comes from
   FRAN_TABLE (L1 Guide Table 1, p. 35); everything else here is geometry.
   ========================================================================= */

/* ------------------------------ C3 Fran -------------------------------- */

/** Fran's constant work for the guide's 6 ft, 200 lb athlete (ft-lb). */
export const FRAN_WORK = FRAN_TABLE.totalWorkFtLb
export const ATTEMPT_A = FRAN_TABLE.attempts[0]
export const ATTEMPT_B = FRAN_TABLE.attempts[1]
/** minutes of each attempt (4.5 and 2.75) */
export const MIN_A = ATTEMPT_A.timeSec / 60
export const MIN_B = ATTEMPT_B.timeSec / 60

/** Chart scale: u = minutes / T_MAX (x), v = ft-lb per minute / P_UNIT (y). */
export const T_MAX = 5
export const P_UNIT = 20000
/** chart width and height of each block: the area is the work and never changes */
export const U_A = MIN_A / T_MAX
export const U_B = MIN_B / T_MAX
export const AREA = FRAN_WORK / (T_MAX * P_UNIT)
/** height (v) of a block of width u holding the whole work */
export const vOf = (u: number) => AREA / u
export const V_A = vOf(U_A)
export const V_B = vOf(U_B)

/** The table's own power readouts (rounded as the guide prints them). */
export const POWER_A = ATTEMPT_A.powerFtLbMin
export const POWER_B = ATTEMPT_B.powerFtLbMin

export const fmtThousands = (n: number) => Math.round(n).toLocaleString('en-US')

/* ---------------------------- C4 margins ------------------------------- */

/** Miles on the C4 axis: u = miles / MILES_MAX. Only 5 and 7 are ever labelled (the guide's numbers). */
export const MILES_MAX = 12
export const BAND_LO = 5
export const BAND_HI = 7
/** "as broad as function and capacity will allow": the whole axis but a hair at each end */
export const WIDE_LO = 0.5
export const WIDE_HI = 11.5

const CAP_BASE = 0.2
const CAP_PEAK = 0.8
const CAP_SIGMA = 1.35

/**
 * Schematic capacity (v) at `miles` for an exposure band [lo, hi]: strong
 * across the band, falling away outside it (weakest at the margins of
 * exposure, Foundations p. 14). Illustrative: no number is ever read off it.
 */
export function capacityAt(miles: number, lo: number, hi: number): number {
  const d = miles < lo ? lo - miles : miles > hi ? miles - hi : 0
  return CAP_BASE + (CAP_PEAK - CAP_BASE) * Math.exp(-(d * d) / (CAP_SIGMA * CAP_SIGMA))
}

/* ---------------------------- pyramid ---------------------------------- */

export const LEVELS = HIERARCHY.length

/**
 * The rule as a model (HIERARCHY_RULE, L1 Guide p. 29): a level is crushed by
 * its own deficiency and suffers by the worst deficiency anywhere below it.
 */
export function sufferOf(def: readonly number[], i: number): number {
  let s = 0
  for (let j = 0; j < i; j++) s = Math.max(s, def[j])
  return s
}

/** The levels that suffer when level i is deficient (all above it). */
export const aboveOf = (i: number) => HIERARCHY.slice(i + 1).map((l) => l.label)
