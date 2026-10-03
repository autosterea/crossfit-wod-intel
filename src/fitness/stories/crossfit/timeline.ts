import { at, cue, pulse, stagger } from '../../story/cue'
import { ease } from '../../story/ease'

/* =========================================================================
   07 CROSSFIT timeline (STORYBOARD-crossfit.md section 2). Every window is
   a pure function of story time T = beat + t, so ?beat=N&t=X renders the
   same frame as scrubbing there, and (N, 1) equals (N + 1, 0): a station
   leaves only inside the next beat (its first 12%).
   ========================================================================= */

export const B = { pres: 0, func: 1, swap: 2, power: 3, vary: 4, pyr: 5, defi: 6, hund: 7 } as const

/** A station born in beat n leaves in the first 12% of beat n + 1 (1 -> 0). */
export const leave = (T: number, n: number) => 1 - at(T, n + 1, 0, 0.12)
/** Live only between [a, b) in global T (prewarmed objects hide outside their window). */
export const live = (T: number, a: number, b: number) => (T >= a && T < b ? 1 : 0)

/* ------------------------------ C0 tiles ------------------------------ */

/** tile k (0 functional, 1 intensity, 2 varied): the plate, the icon pen, the name */
export const tileIn = (T: number, k: number) => at(T, B.pres, 0.3 * k, 0.3 * k + 0.08, ease.settle)
export const iconDraw = (T: number, k: number) => at(T, B.pres, 0.3 * k + 0.02, 0.3 * k + 0.24, ease.draw)
export const iconAfter = (T: number, k: number) => at(T, B.pres, 0.3 * k + 0.12, 0.3 * k + 0.28, ease.settle)
export const tileName = (T: number, k: number) => at(T, B.pres, 0.3 * k + 0.22, 0.3 * k + 0.3)
export const tilesOut = (T: number) => leave(T, B.pres)

/* --------------------------- C1 the pair ------------------------------ */

export const groundDraw = (T: number) => at(T, B.func, 0.04, 0.2, ease.draw)
export const pairDraw = (T: number) => at(T, B.func, 0.08, 0.22, ease.draw)
export const standUp = (T: number) => at(T, B.func, 0.22, 0.52, ease.linear)
export const liftUp = (T: number) => at(T, B.func, 0.5, 0.86, ease.linear)
export const squatName = (T: number) => at(T, B.func, 0.4, 0.5)
export const liftName = (T: number) => at(T, B.func, 0.74, 0.84)
export const multiJoint = (T: number) => at(T, B.func, 0.86, 0.96)
export const pairOut = (T: number) => leave(T, B.func)

/* -------------------------- C2 the swaps ------------------------------ */

const ROW_A = [0.1, 0.38, 0.66] as const
export const headsIn = (T: number) => at(T, B.swap, 0.02, 0.14)
/** the six figures are drawn in at their start poses, row by row */
export const swapDraw = (T: number, r: number) => stagger(T, B.swap + 0.04, B.swap + 0.3, r, 3, 0.5, ease.draw)
/** isolation move of row r (one joint) */
export const isoMove = (T: number, r: number) => at(T, B.swap, ROW_A[r], ROW_A[r] + 0.1, ease.linear)
/** the arrow of row r */
export const arrowDraw = (T: number, r: number) => at(T, B.swap, ROW_A[r] + 0.1, ROW_A[r] + 0.15, ease.draw)
/** functional replacement of row r (many joints) */
export const funMove = (T: number, r: number) => at(T, B.swap, ROW_A[r] + 0.15, ROW_A[r] + 0.3, ease.linear)
export const isoName = (T: number, r: number) => at(T, B.swap, ROW_A[r] + 0.02, ROW_A[r] + 0.1)
export const funName = (T: number, r: number) => at(T, B.swap, ROW_A[r] + 0.17, ROW_A[r] + 0.25)
export const swapOut = (T: number) => leave(T, B.swap)

/* ---------------------------- C3 Fran --------------------------------- */

export const axesDraw = (T: number) => at(T, B.power, 0.04, 0.22, ease.draw)
/** the clock of attempt 1: 0 -> 1 = 0:00 -> 4:30, time-true */
export const clockA = (T: number) => at(T, B.power, 0.2, 0.46, ease.linear)
export const workName = (T: number) => at(T, B.power, 0.4, 0.5)
export const ghostA = (T: number) => at(T, B.power, 0.48, 0.56)
/** the squeeze to 2:45 at constant area */
export const squeeze = (T: number) => at(T, B.power, 0.56, 0.86, ease.morph)
export const claimPower = (T: number) => at(T, B.power, 0.86, 0.96, ease.settle)
/** the Fran picture leaves as C4 starts; the axes stay */
export const franOut = (T: number) => leave(T, B.power)

/* -------------------------- C4 the margins ---------------------------- */

export const titlesSwap = (T: number) => at(T, B.vary, 0.02, 0.14)
export const bandIn = (T: number) => at(T, B.vary, 0.1, 0.3, ease.settle)
export const curveDraw = (T: number) => at(T, B.vary, 0.22, 0.46, ease.draw)
export const weakIn = (T: number) => at(T, B.vary, 0.4, 0.5) * (1 - at(T, B.vary, 0.54, 0.62))
/** the widening: 0 narrow (5 to 7 miles) -> 1 the whole axis */
export const widen = (T: number) => at(T, B.vary, 0.52, 0.86, ease.morph)
export const claimBroad = (T: number) => at(T, B.vary, 0.86, 0.96, ease.settle)
export const chartOut = (T: number) => leave(T, B.vary)

/* --------------------------- C5 to C7 pyramid ------------------------- */

/** slab i lands (0 nutrition at the bottom ... 4 sport) */
export const slabLand = (T: number, i: number) => stagger(T, B.pyr + 0.08, B.pyr + 0.9, i, 5, 0.62, ease.snap)
/** the landing flash of slab i (the speaking element) */
export const slabFlash = (T: number, i: number) => {
  const a = B.pyr + 0.08 + ((0.9 - 0.08) * 0.62 * i) / 4
  const each = (0.9 - 0.08) * (1 - 0.62)
  return pulse(T, a + each * 0.7, a + each * 1.25)
}
export const slabLabel = (T: number, i: number) => {
  const a = B.pyr + 0.08 + ((0.9 - 0.08) * 0.62 * i) / 4
  const each = (0.9 - 0.08) * (1 - 0.62)
  return cue(T, a + each * 0.75, a + each * 1.1)
}
/** C6: the deficient level is crushed and cracked */
export const DEFICIENT = 2
export const crush = (T: number) => at(T, B.defi, 0.06, 0.34, ease.settle) * (1 - at(T, B.hund, 0, 0.22, ease.settle))
export const crackDraw = (T: number) => at(T, B.defi, 0.08, 0.3, ease.draw) * (1 - at(T, B.hund, 0, 0.16))
export const defName = (T: number) => at(T, B.defi, 0.16, 0.26) * (1 - at(T, B.hund, 0, 0.1))
/** C6: everything above suffers (sinks, tilts, dims) */
export const suffer = (T: number) => at(T, B.defi, 0.3, 0.8, ease.morph) * (1 - at(T, B.hund, 0, 0.22, ease.settle))
export const claimSuffer = (T: number) => at(T, B.defi, 0.82, 0.94) * (1 - at(T, B.hund, 0, 0.1))
/** C7: each level lights in turn, bottom to top, and its line of the 100 words lands */
export const hundredIn = (T: number, i: number) => at(T, B.hund, 0.22 + 0.13 * i, 0.22 + 0.13 * i + 0.08)
export const hundredFlash = (T: number, i: number) => pulse(T, B.hund + 0.22 + 0.13 * i, B.hund + 0.22 + 0.13 * i + 0.16)
export const claimWorld = (T: number) => at(T, B.hund, 0.88, 0.98, ease.settle)
