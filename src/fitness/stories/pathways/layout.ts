import type { ChartFrame, ChartFrameOpts } from '../../story/kit/chartFrame'
import type { Box, Layout } from '../../story/types'
import { focusRect } from '../../story/camera/focusRect'
import { LEAD_U, uOf } from './pathwaysMath'

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
export const LANE_NAME_U: readonly number[] = [uOf(300), uOf(15), uOf(12)]

/**
 * The duration strings (ENERGY_SYSTEMS[].duration) are a KEY, not a scale:
 * the axis strips mark where each engine leads in the crossover data, which
 * is not where the textbook ranges end (review r1), so the three strings sit
 * as one centred legend row under the tick labels, 14 px apart. Returns the
 * world x of each string's centre. Widths are the strings' measured phone
 * widths plus a margin (desktop type is about 8% larger).
 */
const STRING_W = [72, 92, 106] as const
export function legendX(f: ChartFrame): number[] {
  const ppu = pxPerUnit(f)
  const k = focusRect.shell === 'desktop' ? 1.08 : 1
  const w = STRING_W.map((v) => v * k)
  const gap = 14
  const total = w[0] + w[1] + w[2] + 2 * gap
  const W = f.FW * ppu
  let l = W / 2 - total / 2
  l = Math.max(-12, Math.min(W + 12 - total, l))
  const out: number[] = []
  for (let i = 0; i < 3; i++) {
    out.push(f.x(0) + (l + w[i] / 2) / ppu)
    l += w[i] + gap
  }
  return out
}

/**
 * P6: world x of the three engine names under their lead brackets (axis
 * order). Each wants its bracket's centre; the phosphagen bracket is only
 * about 65 px wide on a phone, so the row is packed left to right with a
 * 10 px gap and pulled back from the right end if it runs out.
 */
const NAME_W = [84, 84, 78] as const
export function bracketNameX(f: ChartFrame): number[] {
  const ppu = pxPerUnit(f)
  const k = focusRect.shell === 'desktop' ? 1.08 : 1
  const w = NAME_W.map((v) => v * k)
  const W = f.FW * ppu
  const gap = 10
  const l = [0, 1, 2].map((i) => ((LEAD_U[i] + LEAD_U[i + 1]) / 2) * W - w[i] / 2)
  for (let i = 1; i < 3; i++) l[i] = Math.max(l[i], l[i - 1] + w[i - 1] + gap)
  const over = l[2] + w[2] - (W + 14)
  if (over > 0) {
    l[2] -= over
    for (let i = 1; i >= 0; i--) l[i] = Math.min(l[i], l[i + 1] - gap - w[i])
  }
  l[0] = Math.max(l[0], -12)
  return l.map((v, i) => f.x(0) + (v + w[i] / 2) / ppu)
}
