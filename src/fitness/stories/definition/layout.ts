import type { ChartFrame, ChartFrameOpts } from '../../story/kit/chartFrame'
import type { Box, Layout } from '../../story/types'
import { RANKED } from './definitionMath'
import { focusRect } from '../../story/camera/focusRect'

/* =========================================================================
   Definition chapter layout (DESIGN.md D.5). The chart is authored in chart
   space and mapped through the ENGINE-OWNED adaptive frame (B.13, H.17):
   FH = 10 world units for v = 1.0, aspect clamped to 0.68 .. 1.5, so a phone
   gets a tall chart that fills its focus rect and a desktop a wide one. Camera poses receive the same
   frame object the scene renders with: fit(layout, frame).
   ========================================================================= */

/** Label margins in px; the same numbers are the camera fit padding. */
export const CHART_PAD = { l: 48, r: 28, t: 22, b: 64 } as const

export const FRAME_OPTS: ChartFrameOpts = {
  FH: 10,
  minAspect: 0.68,
  maxAspect: 1.5,
  marginPx: CHART_PAD,
  vMax: 1.1,
}

/** The D2 fan angles (story keys and the explore domains orbit). */
export const FAN_ORBIT = { L: { az: -30, el: 18 }, P: { az: -32, el: 22 } } as const

/** The domain fan spans z from -2.6 to 2.6 (D.5). */
export const FAN_Z = 2.6
/** Top of the fanned domain curves in v (max of curve x domain scale, with room). */
export const FAN_TOP = 0.95

export const chartBox = (_l: Layout, f: ChartFrame): Box => f.box

/**
 * The fanned VOLUME (H.21): the five domain curtains from the baseline to the
 * top of the highest curve, across the full depth. The pose fits this, not
 * the pre-fan chart box, so the fan fills the focus rect at its peak.
 */
export function fanBox(f: ChartFrame): Box {
  return [
    [f.x(0), f.y(0), -FAN_Z],
    [f.x(1), f.y(FAN_TOP), FAN_Z],
  ]
}

export const fanCenter = (f: ChartFrame): [number, number, number] => [0, (f.y(0) + f.y(FAN_TOP)) / 2, 0]

/* ------------------------------ the D6 lineup ------------------------------ */

/**
 * The ranked lineup (D.5 D6, amendment H.29). Each row is ONE unit on a
 * faint glass plate: the rank badge and name (left) and the score pill
 * (right) sit tight above a luminous mini area chart, whose floor is the
 * score bar on one shared 0 to 100 scale, so the column reads as a staircase
 * of light. Units are chosen so a label (about 18 to 20 px) fits the band
 * above each mini at the scale the camera fit produces.
 *
 *   P  (phone portrait): one column of seven rows.
 *   L1 (desktop, tablet landscape): one column (reading order is top to bottom).
 *   L2 (a short landscape stage, e.g. a phone on its side): two columns of
 *      four and three; the rank badges carry the reading order and the pills
 *      show the number only (the same on every row).
 */
export interface Lineup {
  kind: 'P' | 'L1' | 'L2'
  /** mini width and the height of v = 1 (world units) */
  MW: number
  MH: number
  /** baseline-left corner of each ranked mini (the score bar runs along the baseline) */
  origin: (rank: number) => [number, number]
  /** glass plate behind each row: [x0, y0, x1, y1] */
  plate: (rank: number) => [number, number, number, number]
  /** y of the label anchors above each mini, relative to its baseline */
  labelY: number
  /** show the score word in the pill (every row, or none) */
  words: boolean
  box: Box
}

const cache = new Map<string, Lineup>()

/** Two columns only on a SHORT landscape stage (a phone on its side); desktop keeps one column. */
export function lineupKind(layout: Layout, _f?: ChartFrame): Lineup['kind'] {
  if (layout === 'P') return 'P'
  return focusRect.h < 460 ? 'L2' : 'L1'
}

export function lineup(layout: Layout, f: ChartFrame): Lineup {
  const kind = lineupKind(layout, f)
  const hit = cache.get(kind)
  if (hit) return hit
  const n = RANKED.length
  // per kind: mini size, the label band above the mini, pads and the gap between plates
  // P (H.48): the rows are HEIGHT-limited on a phone (seven rows in about
  // 480 px), so the mini gets the height the pads gave up: 1.35 tall (was
  // 0.95), a label band just tall enough for the 20 px pill, tighter pads.
  const K = {
    P: { MW: 10.8, MH: 1.35, LB: 0.78, cols: 1, colGap: 0, lift: 0.05, padT: 0.08, padB: 0.3, gap: 0.14 },
    L1: { MW: 13, MH: 1.55, LB: 0.52, cols: 1, colGap: 0, lift: 0.08, padT: 0.16, padB: 0.34, gap: 0.22 },
    L2: { MW: 8, MH: 1.25, LB: 0.78, cols: 2, colGap: 1.3, lift: 0.08, padT: 0.16, padB: 0.34, gap: 0.22 },
  }[kind]
  const { MW, MH, LB, cols, colGap, padT, padB, gap } = K
  const labelY = MH + K.lift
  const padX = 0.3
  const RP = labelY + LB + padT + padB + gap
  const rows = Math.ceil(n / cols)
  const colW = MW + 2 * padX
  const totalW = cols * colW + (cols - 1) * colGap
  const totalH = rows * RP - gap
  const top = totalH / 2
  const origin = (r: number): [number, number] => {
    const col = cols === 1 ? 0 : r < rows ? 0 : 1
    const row = cols === 1 ? r : r < rows ? r : r - rows
    const x = -totalW / 2 + col * (colW + colGap) + padX
    const plateTop = top - row * RP
    const yb = plateTop - padT - LB - labelY
    return [x, yb]
  }
  const plate = (r: number): [number, number, number, number] => {
    const [x, yb] = origin(r)
    return [x - padX, yb - padB, x + MW + padX, yb + labelY + LB + padT]
  }
  const box: Box = [
    [-totalW / 2, -totalH / 2, 0],
    [totalW / 2, totalH / 2, 0],
  ]
  const L: Lineup = { kind, MW, MH, origin, plate, labelY, words: kind !== 'L2', box }
  cache.set(kind, L)
  return L
}
