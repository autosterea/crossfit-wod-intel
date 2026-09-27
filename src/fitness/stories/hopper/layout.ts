import type { Box, Layout, V3 } from '../../story/types'
import { frameFor, type ChartFrame, type ChartFrameOpts } from '../../story/kit/chartFrame'

/* =========================================================================
   Hopper world (DESIGN.md D.3 "World"), per layout. World units, Y up, the
   drum's spin axis points at the camera. Every pose and every element
   reads these, so the camera fit and the geometry always agree.

   P ("stack", phones): drum over ticket over six rails.
   L (desktop, landscape): drum and ticket side by side over longer rails.

   Deviations on P (recorded as proposed amendments): the drum sits right
   of centre (x 2.6, not 0) and steps back to 0.7 as the rails are built,
   so the pinned domain legend (five chips, the longest "ODD OBJECT / REAL
   WORLD") keeps the top-left corner beside it and six readable rows fit a
   360 px phone; the rails start at y 1.2 with a 1.6 pitch (D.3: 1.6, 1.35).
   ========================================================================= */

export interface World {
  drum: { c: V3; R: number; HL: number }
  /** the ticket plate: centre, size, the task-name wrap width */
  ticket: { c: V3; w: number; h: number; maxW: number; name: number; kick: number; notch: number }
  /** where the drawn ball comes to rest: in the ticket's notch (P right, L left) */
  slot: V3
  /** where the drawn ball leaves the drum */
  gate: V3
  rails: { x0: number; len: number; y0: number; pitch: number }
  /**
   * The drum's scale once the board is on (H2 on, explore), about its lowest
   * point: on a phone it steps back to make room for six readable rails.
   */
  drumBoard: number
}

export const BALL_R = 0.3
/** brick height and depth (D.3) */
export const BH = 0.5
export const BD = 0.4

const P: World = {
  drum: { c: [2.6, 7.6, 0], R: 2.6, HL: 1.6 },
  ticket: { c: [0, 3.7, 1.2], w: 4.8, h: 1.6, maxW: 4.4, name: 0.44, kick: 0.31, notch: 0.4 },
  slot: [2.4, 3.7, 1.2],
  gate: [2.45, 5.35, 0.9],
  // rails start 0.4 lower than D.3's 1.6 so the P1 row's LEAD sits clear of the
  // ticket, and the pitch is 1.6 (D.3: 1.35) so a name above a bar never meets
  // the total riding the bar above it on a 360 px phone
  rails: { x0: -5.4, len: 10.8, y0: 1.2, pitch: 1.6 },
  drumBoard: 0.7,
}

const L: World = {
  drum: { c: [-5.5, 6.4, 0], R: 2.6, HL: 1.6 },
  ticket: { c: [1.2, 6.4, 1.2], w: 6, h: 1.8, maxW: 5.6, name: 0.54, kick: 0.34, notch: 0.44 },
  slot: [-1.8, 6.4, 1.2],
  gate: [-3.35, 5.55, 0.9],
  rails: { x0: -7.6, len: 15.2, y0: 2.2, pitch: 1.45 },
  drumBoard: 1,
}

export const WORLD: Record<Layout, World> = { P, L }

export const slotY = (w: World, k: number) => w.rails.y0 - w.rails.pitch * k

/* ------------------------------ camera boxes ------------------------------ */

export function drumBox(w: World): Box {
  const { c, R, HL } = w.drum
  return [
    [c[0] - R - 0.4, c[1] - R - 0.2, -HL],
    [c[0] + R + 0.4, c[1] + R + 0.2, HL],
  ]
}

export function drawBox(w: World): Box {
  const d = drumBox(w)
  const t = w.ticket
  return [
    [Math.min(d[0][0], t.c[0] - t.w / 2 - 0.1), Math.min(d[0][1], t.c[1] - t.h / 2 - 0.1), -w.drum.HL],
    [Math.max(d[1][0], t.c[0] + t.w / 2 + 0.1), d[1][1], w.drum.HL],
  ]
}

/** The drum's box at scale k about its lowest point. */
export function drumBoxAt(w: World, k: number): Box {
  const { c, R, HL } = w.drum
  const y0 = c[1] - R
  const r = k * (R + 0.4)
  return [
    [c[0] - r, y0 - 0.2, -HL],
    [c[0] + r, y0 + k * (2 * R + 0.2), HL],
  ]
}

/** Everything: the drum (at its board scale), the ticket and the six rails with their bricks. */
export function boardBox(w: World): Box {
  const d = drumBoxAt(w, w.drumBoard)
  const r = w.rails
  return [
    [Math.min(r.x0, d[0][0]), slotY(w, 5) - BH / 2, -w.drum.HL],
    [Math.max(r.x0 + r.len, d[1][0]), d[1][1] - 0.2, w.drum.HL],
  ]
}

/* ------------------------------ the thread chart (H6) ------------------------------ */

/** Label room around the chart (px): ticks and DRAWS below, THIS RUN right. */
export const CHART_PAD = { l: 20, r: 70, t: 44, b: 58 } as const
export const CHART_OPTS: ChartFrameOpts = { FH: 10, minAspect: 0.52, maxAspect: 1.7, marginPx: CHART_PAD }
/** The chart takes the rails' place: its centre sits at the rails' centre. */
export const chartCenterY = (w: World) => (slotY(w, 0) + slotY(w, 5)) / 2
export const chartFrame = (): ChartFrame => frameFor(CHART_OPTS)
/** the chart's depth: just in front of where the rails were */
export const CHART_Z = 0.6
export function chartBox(w: World): Box {
  const f = chartFrame()
  const cy = chartCenterY(w)
  return [
    [f.box[0][0], f.box[0][1] + cy, CHART_Z],
    [f.box[1][0], f.box[1][1] + cy, CHART_Z],
  ]
}
/**
 * The chart plus room for its labels, in world units (explore fits this:
 * one pose serves both explore views, so the label room cannot be padPx).
 */
export function chartFitBox(w: World): Box {
  const b = chartBox(w)
  const u = chartFrame().FH / 10
  return [
    [b[0][0] - 0.35 * u, b[0][1] - 1.55 * u, CHART_Z],
    [b[1][0] + 1.9 * u, b[1][1] + 0.9 * u, CHART_Z],
  ]
}
/** The lead range the chart plots, in points (covers every thread with room). */
export const LEAD_LO = -130
export const LEAD_HI = 800
export const leadV = (lead: number) => (lead - LEAD_LO) / (LEAD_HI - LEAD_LO)

/* ------------------------------ the ticket outline ------------------------------ */

/**
 * The ticket plate: a rounded rectangle with a semicircular notch in each
 * short side (the drawn ball rests in one). Closed, starting at 12 o'clock
 * and running clockwise, so the H1 pen traces it like the other shapes.
 */
export function ticketOutline(wd: number, ht: number, nr: number, cr = 0.16, seg = 6): Float32Array {
  const pts: number[] = []
  const hw = wd / 2
  const hh = ht / 2
  const push = (x: number, y: number) => pts.push(x, y, 0)
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      push(cx + r * Math.cos(a), cy + r * Math.sin(a))
    }
  }
  push(0, hh)
  arc(hw - cr, hh - cr, cr, Math.PI / 2, 0, seg)
  // right notch: concave, bites into the plate
  arc(hw, 0, nr, Math.PI / 2, (3 * Math.PI) / 2, seg * 2)
  arc(hw - cr, -hh + cr, cr, 0, -Math.PI / 2, seg)
  arc(-hw + cr, -hh + cr, cr, -Math.PI / 2, -Math.PI, seg)
  arc(-hw, 0, nr, -Math.PI / 2, Math.PI / 2, seg * 2)
  arc(-hw + cr, hh - cr, cr, Math.PI, Math.PI / 2, seg)
  push(0, hh)
  return new Float32Array(pts)
}
