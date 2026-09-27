import { computeChartFrame, type ChartFrame, type ChartFrameOpts } from '../../story/kit/chartFrame'
import type { Box, Layout } from '../../story/types'
import { RANKED } from './definitionMath'

/* =========================================================================
   Definition chapter layout (DESIGN.md D.5). The chart is authored in chart
   space and mapped through the adaptive frame (B.13): FH = 10 world units
   for v = 1.0, aspect clamped to 0.8 .. 1.5, so a phone gets a tall chart
   and a desktop a wide one. The live frame is shared with the camera poses.
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

/** Current frame; the Scene writes it whenever the focus rect changes. */
export const live: { frame: ChartFrame } = { frame: computeChartFrame(FRAME_OPTS) }

/** The domain fan spans z from -2.6 to 2.6 (D.5). */
export const FAN_Z = 2.6

export function chartBox(): Box {
  return live.frame.box
}

/** The fan pose fits the plotted band only (v 0 .. 0.95), so the domains fill the frame. */
export function fanBox(): Box {
  const f = live.frame
  return [
    [f.x(0), f.y(0), -FAN_Z],
    [f.x(1), f.y(0.95), FAN_Z],
  ]
}

/* ------------------------- the D6 lineup column ------------------------- */

export interface Lineup {
  /** mini width, height of v = 1, row pitch (world units) */
  MW: number
  MH: number
  RP: number
  /** bottom-left corner of each ranked mini */
  origin: (rank: number) => [number, number]
  box: Box
}

export function lineup(layout: Layout): Lineup {
  const n = RANKED.length
  if (layout === 'P') {
    const MW = 10.8
    const MH = 1.25
    const RP = 2.6
    const top = ((n - 1) / 2) * RP
    const origin = (r: number): [number, number] => [-MW / 2, top - r * RP - MH * 0.45]
    const box: Box = [
      [-MW / 2, origin(n - 1)[1] - 0.1, 0],
      [MW / 2, origin(0)[1] + MH * 1.05 + 0.95, 0.12],
    ]
    return { MW, MH, RP, origin, box }
  }
  const MW = 8
  const MH = 1.75
  const RP = 3.25
  const gap = 2.2
  const rows = Math.ceil(n / 2)
  const top = ((rows - 1) / 2) * RP
  const origin = (r: number): [number, number] => {
    const col = r < rows ? 0 : 1
    const row = r < rows ? r : r - rows
    return [col === 0 ? -MW - gap / 2 : gap / 2, top - row * RP - MH * 0.45]
  }
  const box: Box = [
    [-MW - gap / 2, origin(rows - 1)[1] - 0.1, 0],
    [MW + gap / 2, origin(0)[1] + MH * 1.05 + 0.95, 0.12],
  ]
  return { MW, MH, RP, origin, box }
}
