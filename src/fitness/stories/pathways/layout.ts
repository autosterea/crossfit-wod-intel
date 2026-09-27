import type { ChartFrame, ChartFrameOpts } from '../../story/kit/chartFrame'
import type { Box, Layout } from '../../story/types'
import { focusRect } from '../../story/camera/focusRect'
import { BRACKET_U, uOf } from './pathwaysMath'

/* =========================================================================
   Pathways layout (DESIGN.md D.4, B.13). The chart is authored in chart
   space (u 0..1 along the log time axis, v 0..vMax up) and mapped through
   the ENGINE-OWNED adaptive frame, so a phone gets a tall chart that fills
   its focus rect and a desktop a wide one. The camera fits the same frame.

   Pads (px, also the camera fit padding), tuned from the D.4 start values
   (amendment proposal in the chapter report): there are no y tick numbers
   (power is relative), so the left pad only has to hold the "3 s" tick; the
   bottom pad holds three rows under the axis: the tick labels, the three
   duration strings (P1 to P3, P6) and the axis title.
   ========================================================================= */

export const CHART_PAD = { l: 22, r: 22, t: 18, b: 74 } as const

/** The stack top peaks at v 0.947 (3 s); lanes reach v 1.0; the rest is room for the axis title. */
export const V_MAX = 1.06

export const FRAME_OPTS: ChartFrameOpts = {
  FH: 10,
  minAspect: 0.78,
  maxAspect: 1.6,
  marginPx: CHART_PAD,
  vMax: V_MAX,
}

export const chartBox = (_l: Layout, f: ChartFrame): Box => f.box

/** Tick-mark length and duration-strip height under the time axis, in screen px (made world units by `underAxis`). */
export const TICK_PX = 7
export const STRIP_PX = 11

/** Time ticks (D.4): 3 s, 10 s, 30 s, 1 min, 2 min, 10 min, 1 hr; a phone drops 30 s and 2 min. */
export const TICKS: readonly { s: number; label: string; phone: boolean }[] = [
  { s: 3, label: '3 s', phone: true },
  { s: 10, label: '10 s', phone: true },
  { s: 30, label: '30 s', phone: false },
  { s: 60, label: '1 min', phone: true },
  { s: 120, label: '2 min', phone: false },
  { s: 600, label: '10 min', phone: true },
  { s: 3600, label: '1 hr', phone: true },
]

/** A chart narrower than 520 px (a phone, or an expanded sheet) uses the phone tick set (H.41). */
export const narrowChart = (layout: Layout) => layout === 'P' || focusRect.w < 520

/**
 * Screen px per world unit for the front-on fit (the camera fits the chart
 * box inside the focus rect minus CHART_PAD; perspective at fov 22 changes
 * this by well under 1% on the z = 0 plane). Used only to keep the rows
 * under the axis a fixed number of px apart on every screen.
 */
export function pxPerUnit(f: ChartFrame): number {
  const w = Math.max(40, focusRect.w - CHART_PAD.l - CHART_PAD.r)
  const h = Math.max(40, focusRect.h - CHART_PAD.t - CHART_PAD.b)
  return Math.min(w / f.FW, h / (f.FH * f.vMax))
}

/**
 * The world lengths under the axis for this frame and focus rect: the tick
 * marks and the duration strips keep a fixed px size on every screen, so the
 * three label rows under them fit the bottom pad on a phone and a desktop.
 */
export interface UnderAxis {
  tick: number
  strip: number
}
export function underAxis(f: ChartFrame): UnderAxis {
  const ppu = Math.round(pxPerUnit(f) * 4) / 4
  return { tick: TICK_PX / ppu, strip: STRIP_PX / ppu }
}

/** Rows under the strips, px below the strip's lower edge (label gaps). */
export const ROW = {
  /** tick labels */
  tick: 5,
  /** the duration strings, under the tick labels */
  band: 22,
  /** the axis title, under the duration strings */
  title: 41,
} as const

/** u where each lane is named (bottom to top): the oxidative plateau, the glycolytic hump, the phosphagen slope (clear of the top-left corner). */
export const LANE_NAME_U: readonly number[] = [uOf(300), uOf(15), uOf(7)]

/**
 * World x of the three duration strings under the axis (axis order). Each
 * wants to sit centred under its band, but the phosphagen band is only about
 * 55 px wide on a phone, so the row is packed left to right with a 10 px gap
 * (widths are the strings' measured phone widths plus a margin) and pulled
 * back from the right end if it runs out. On a desktop nothing moves.
 */
const STRING_W = [72, 92, 106] as const
export function bandStringX(f: ChartFrame): number[] {
  const ppu = pxPerUnit(f)
  const W = f.FW * ppu
  const gap = 10
  const l = [0, 1, 2].map((k) => ((BRACKET_U[k] + BRACKET_U[k + 1]) / 2) * W - STRING_W[k] / 2)
  for (let k = 1; k < 3; k++) l[k] = Math.max(l[k], l[k - 1] + STRING_W[k - 1] + gap)
  const over = l[2] + STRING_W[2] - (W + 14)
  if (over > 0) {
    l[2] -= over
    for (let k = 1; k >= 0; k--) l[k] = Math.min(l[k], l[k + 1] - gap - STRING_W[k])
  }
  l[0] = Math.max(l[0], -12)
  return l.map((v, k) => f.x(0) + (v + STRING_W[k] / 2) / ppu)
}
