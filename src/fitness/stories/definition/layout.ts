import type { ChartFrame, ChartFrameOpts } from '../../story/kit/chartFrame'
import type { Box, Layout } from '../../story/types'
import { RANKED } from './definitionMath'

/* =========================================================================
   Definition chapter layout (DESIGN.md D.5). The chart is authored in chart
   space and mapped through the ENGINE-OWNED adaptive frame (B.13, H.17):
   FH = 10 world units for v = 1.0, aspect clamped to 0.8 .. 1.5, so a phone
   gets a tall chart and a desktop a wide one. Camera poses receive the same
   frame object the scene renders with: fit(layout, frame).
   ========================================================================= */

/** Label margins in px; the same numbers are the camera fit padding. */
export const CHART_PAD = { l: 48, r: 28, t: 22, b: 56 } as const

export const FRAME_OPTS: ChartFrameOpts = {
  FH: 10,
  minAspect: 0.8,
  maxAspect: 1.5,
  marginPx: CHART_PAD,
  vMax: 1.1,
}

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

/* ------------------------- the D6 lineup column ------------------------- */

export interface Lineup {
  /** mini width, height of v = 1, row pitch (world units) */
  MW: number
  MH: number
  RP: number
  /** bottom-left corner of each ranked mini */
  origin: (rank: number) => [number, number]
  /** the shared-scale area bar under each mini: y offset below the origin and thickness */
  barY: number
  barH: number
  box: Box
}

/**
 * P: one column of seven rows. Minis are 10.8 x 1.6 (taller than H.9, so the
 * curve shapes read on a phone), with a thin bar under each whose length is
 * the area score on one shared scale (H.22): the ranking is visible without
 * reading a number. L: two columns.
 */
export function lineup(layout: Layout): Lineup {
  const n = RANKED.length
  if (layout === 'P') {
    const MW = 10.8
    const MH = 1.6
    const RP = 3.0
    const barY = -0.24
    const barH = 0.18
    const top = ((n - 1) / 2) * RP
    const origin = (r: number): [number, number] => [-MW / 2, top - r * RP - MH * 0.45]
    const box: Box = [
      [-MW / 2, origin(n - 1)[1] + barY - barH - 0.1, 0],
      [MW / 2, origin(0)[1] + MH * 1.05 + 1.25, 0.12],
    ]
    return { MW, MH, RP, origin, barY, barH, box }
  }
  const MW = 8
  const MH = 1.75
  const RP = 3.5
  const gap = 2.2
  const barY = -0.22
  const barH = 0.2
  const rows = Math.ceil(n / 2)
  const top = ((rows - 1) / 2) * RP
  const origin = (r: number): [number, number] => {
    const col = r < rows ? 0 : 1
    const row = r < rows ? r : r - rows
    return [col === 0 ? -MW - gap / 2 : gap / 2, top - row * RP - MH * 0.45]
  }
  const box: Box = [
    [-MW - gap / 2, origin(rows - 1)[1] + barY - barH - 0.1, 0],
    [MW + gap / 2, origin(0)[1] + MH * 1.05 + 1.25, 0.12],
  ]
  return { MW, MH, RP, origin, barY, barH, box }
}
