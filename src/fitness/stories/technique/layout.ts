import type { ChartFrame, ChartFrameOpts } from '../../story/kit/chartFrame'
import { focusRect } from '../../story/camera/focusRect'

/* =========================================================================
   08 TECHNIQUE composition (STORYBOARD-technique.md section 2). One engine
   chart frame for the whole chapter (StoryDef.frame) and one front-on
   camera that fits it, so nothing ever pans: every diagram is authored in
   chart space (u, v from 0 to 1 across the frame box) and beats hand off
   inside the frame. Two-part beats (T4, T7, T8) stack their parts on a tall
   frame (FW / FH < 0.85: 390 x 844, 360 x 780, 430 x 932) and sit side by
   side otherwise (the owner's 390 x 664 Safari phone, desktop).
   ========================================================================= */

/** Label room around the frame; the same numbers are the camera's fit padding. */
export const PAD = { l: 48, r: 24, t: 24, b: 48 } as const
/**
 * minAspect 0.70 (the storyboard's 0.62 start, +13%): every tall phone (390 x 844, 360 x 780,
 * 430 x 932) sits on the clamp, so a caption of another length or a sheet detent moves the
 * focus rect but never rebuilds the frame (chartFrame.ts).
 */
export const FRAME_OPTS: ChartFrameOpts = { FH: 10, minAspect: 0.7, maxAspect: 1.5, marginPx: PAD }

export const isStacked = (f: ChartFrame): boolean => f.FW / f.FH < 0.85

/** World units per CSS px of the fitted frame (for strokes sized on screen: arrowheads). */
export function unitsPerPx(f: ChartFrame): number {
  const w = Math.max(40, focusRect.w - PAD.l - PAD.r)
  const h = Math.max(40, focusRect.h - PAD.t - PAD.b)
  const ppu = Math.min(w / f.FW, h / (f.FH * f.vMax))
  return 1 / Math.max(1e-3, ppu)
}

/** A rectangle in chart space. */
export interface Rect {
  u0: number
  v0: number
  u1: number
  v1: number
}
export const FULL: Readonly<Rect> = { u0: 0, v0: 0, u1: 1, v1: 1 }

export function mixRect(a: Readonly<Rect>, b: Readonly<Rect>, k: number, out: Rect): Rect {
  out.u0 = a.u0 + (b.u0 - a.u0) * k
  out.v0 = a.v0 + (b.v0 - a.v0) * k
  out.u1 = a.u1 + (b.u1 - a.u1) * k
  out.v1 = a.v1 + (b.v1 - a.v1) * k
  return out
}

/* ------------------------------ T0 lanes ------------------------------ */

/** Top to bottom in the article's order of explanation: efficacy, efficiency, safety. */
export const LANES = [
  { v0: 0.68, v1: 0.98 },
  { v0: 0.35, v1: 0.65 },
  { v0: 0.02, v1: 0.32 },
] as const
export const LANE_U0 = 0.04
export const LANE_U1 = 0.96
/** the efficacy curves: u range and the full height as a share of the lane (the top keeps room for its name) */
export const CURVE_U0 = 0.3
export const CURVE_U1 = 0.92
export const CURVE_H = 0.72
/** the efficiency lane: the goal's height (a share of the lane) and the 0 to 9 year time axis */
export const GOAL_K = 0.66
/** six months on a nine-year lane: 1/18 of its length */
export const FAST_K = 1 / 18
/** the safety lane: start and finish lines, the ten runners' rows */
export const START_U = 0.06
export const FINISH_U = 0.92
/** where eight of the ten stop, in order (STORYBOARD-technique T0) */
export const STOPS = [0.22, 0.3, 0.37, 0.45, 0.52, 0.6, 0.68, 0.76] as const
/** which runners stop at STOPS[k] (the other two finish) */
export const STOPPER = [6, 0, 9, 4, 7, 2, 8, 5] as const
export const FINISHERS = [1, 3] as const

/* ----------------------------- T1 vectors ----------------------------- */

export interface VectorGeo {
  /** origin, chart space */
  ou: number
  ov: number
  /** base length, world units (a share of FH) */
  L: number
  /** angles from +x, degrees: safety, efficacy, efficiency */
  deg: readonly [number, number, number]
}
export function vectors(f: ChartFrame): VectorGeo {
  return isStacked(f)
    ? { ou: 0.18, ov: 0.08, L: 0.55 * f.FH, deg: [74, 67, 60] }
    : { ou: 0.14, ov: 0.12, L: 0.6 * f.FH, deg: [54, 47, 40] }
}

/* ------------------------------ T2 terms ------------------------------ */

export interface TermsGeo {
  technique: Rect
  mechanics: Rect
  style: Rect
  /** the FORM bar's height (chart v) */
  formH: number
  /** "HOW YOU MOVE" and its underline */
  titleV: number
  underline: readonly [number, number]
  /** the dashed connector from TECHNIQUE to STYLE: [u0, v0, u1, v1] */
  connector: readonly [number, number, number, number]
  /** where FORM's callout hangs: beside the bar's right end (side by side) or above its right part (stacked) */
  formAt: readonly [number, number]
  formSides: readonly ('N' | 'NE' | 'E' | 'NW' | 'W')[]
  /** where STYLE's callout goes: above its box (side by side), under it (stacked: the connector is above) */
  styleSides: readonly ('N' | 'NE' | 'NW' | 'S' | 'SE' | 'SW')[]
}
export function terms(f: ChartFrame): TermsGeo {
  if (isStacked(f)) {
    const technique = { u0: 0.06, v0: 0.32, u1: 0.94, v1: 0.86 }
    const style = { u0: 0.28, v0: 0.04, u1: 0.72, v1: 0.24 }
    return {
      technique,
      mechanics: { u0: 0.14, v0: 0.4, u1: 0.86, v1: 0.62 },
      style,
      formH: 0.04,
      titleV: 0.955,
      underline: [0.06, 0.4],
      connector: [0.5, technique.v0, 0.5, style.v1],
      formAt: [technique.u1, technique.v1 + 0.04],
      formSides: ['NW', 'N', 'W'],
      styleSides: ['S', 'SE', 'SW'],
    }
  }
  const technique = { u0: 0.08, v0: 0.1, u1: 0.66, v1: 0.8 }
  const style = { u0: 0.74, v0: 0.3, u1: 0.96, v1: 0.62 }
  return {
    technique,
    mechanics: { u0: 0.16, v0: 0.18, u1: 0.58, v1: 0.5 },
    style,
    formH: 0.05,
    titleV: 0.955,
    underline: [0.08, 0.4],
    connector: [technique.u1, 0.46, style.u0, 0.46],
    formAt: [technique.u1, technique.v1 + 0.025],
    formSides: ['E', 'NE', 'N'],
    styleSides: ['N', 'NE', 'NW'],
  }
}

/* --------------------------- T3 and T9 graph -------------------------- */

/** Figure 1's axes box in the frame (the plot): origin and far ends (chart space). */
export const PLOT = { u0: 0.12, v0: 0.1, u1: 0.96, v1: 0.96 } as const
/** Plot-normalized arrow tips (the figure has no scale): A inefficient, B ideal; equal lengths. */
export const TIP_A = [0.28, 0.87] as const
export const TIP_B = [0.87, 0.28] as const
/** the technique arc's normalized radius */
export const ARC_R = 0.55
/** T4: the graph as an inset (the whole frame maps into this rect) */
export const insetRect = (stacked: boolean): Rect => (stacked ? { u0: 0.04, v0: 0.78, u1: 0.44, v1: 0.99 } : { u0: 0.02, v0: 0.7, u1: 0.3, v1: 0.98 })

/* ------------------------------ athletes ------------------------------ */

export interface Stand {
  /** mid-foot (chart u), the ground (chart v) and the stature (share of FH) */
  u: number
  v: number
  k: number
}
/** T4: the clean (SOLID) and the rounded pull (GHOST); module constants, so a rig built from them is stable */
const T4_STACKED = { solid: { u: 0.27, v: 0.04, k: 0.56 }, ghost: { u: 0.74, v: 0.04, k: 0.56 } } as const
const T4_SIDE = { solid: { u: 0.42, v: 0.04, k: 0.62 }, ghost: { u: 0.78, v: 0.04, k: 0.62 } } as const
export const t4Lifters = (stacked: boolean): { readonly solid: Stand; readonly ghost: Stand } => (stacked ? T4_STACKED : T4_SIDE)
/** T7, T8 and explore: the pull beside (or under) the plane */
const T7_STACKED: Stand = { u: 0.5, v: 0.03, k: 0.4 }
const T7_SIDE: Stand = { u: 0.19, v: 0.06, k: 0.66 }
export const t7Lifter = (stacked: boolean): Stand => (stacked ? T7_STACKED : T7_SIDE)

/* ------------------------------- T5 charter --------------------------- */

export const CHARTER = { ou: 0.1, ov: 0.12, u1: 0.96, v1: 0.92 } as const
export const BANDS = [
  { u0: 0.1, u1: 0.36 },
  { u0: 0.36, u1: 0.66 },
  { u0: 0.66, u1: 0.96 },
] as const
export const BAND_NAME_V = 0.86
/** the amber line: flat and low, then three steps up inside INTENSITY (schematic, no values) */
export const RATCHET: readonly (readonly [number, number])[] = [
  [0.1, 0.2],
  [0.36, 0.2],
  [0.66, 0.2],
  [0.72, 0.2],
  [0.72, 0.4],
  [0.8, 0.4],
  [0.8, 0.58],
  [0.88, 0.58],
  [0.88, 0.76],
  [0.96, 0.76],
]
/** the order ignored: from the origin up inside MECHANICS, then flat */
export const SKIP: readonly (readonly [number, number])[] = [
  [0.1, 0.12],
  [0.16, 0.8],
  [0.96, 0.8],
]

/* ------------------------------ T6 to T8 plane ------------------------ */

/** The plane's axes box inside its container rect (T6: the whole frame). */
export const PLANE = { u0: 0.14, v0: 0.12, u1: 0.94, v1: 0.94 } as const
/** T7 and T8: the container rect the plane FLIPs into */
export const planeRect = (stacked: boolean): Rect => (stacked ? { u0: 0.06, v0: 0.5, u1: 0.98, v1: 0.98 } : { u0: 0.4, v0: 0.08, u1: 0.98, v1: 0.96 })
/** plane coordinates (pu, pv) of the T6 marks (converted from the storyboard's frame coordinates) */
const pu = (u: number) => (u - PLANE.u0) / (PLANE.u1 - PLANE.u0)
const pv = (v: number) => (v - PLANE.v0) / (PLANE.v1 - PLANE.v0)
export const TARGET = [pu(0.86), pv(0.86)] as const
export const TARGET_R = 0.045
export const P1 = [pu(0.2), pv(0.86)] as const
export const P2 = [pu(0.25), pv(0.8)] as const
export const EITHER = [pu(0.18), pv(0.92), pu(0.92), pv(0.18)] as const
/** the height "perfect" reads at (the path's level and the PERFECT tick) */
export const PERFECT_PV = 0.88
/** T7's learning path in plane coordinates; its corners at pu 0.30, 0.54 and 0.78 carry T8's numbers */
export const PATH: readonly (readonly [number, number])[] = [
  [0.06, 0.88],
  [0.3, 0.88],
  [0.54, 0.5],
  [0.54, 0.88],
  [0.78, 0.5],
  [0.78, 0.88],
  [0.9, 0.88],
]
/** T8: the three speeds' columns and the margin's last stop (no number) */
export const SPEED_PU = [0.3, 0.54, 0.78] as const
export const PAST_PU = 0.9
export const LOW_PV = 0.5

/** plane (pu, pv) inside container rect r -> chart (u, v) */
export function planeUV(r: Readonly<Rect>, a: number, b: number, out: [number, number]): [number, number] {
  out[0] = r.u0 + (PLANE.u0 + (PLANE.u1 - PLANE.u0) * a) * (r.u1 - r.u0)
  out[1] = r.v0 + (PLANE.v0 + (PLANE.v1 - PLANE.v0) * b) * (r.v1 - r.v0)
  return out
}

/** T9 and explore: the graph inset in explore (the graph toggle) */
export const exploreInset = (stacked: boolean): Rect => (stacked ? { u0: 0.02, v0: 0.06, u1: 0.32, v1: 0.34 } : { u0: 0.02, v0: 0.72, u1: 0.3, v1: 0.98 })
