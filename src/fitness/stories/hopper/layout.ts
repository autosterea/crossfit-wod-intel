import type { Box, Layout, V3 } from '../../story/types'
import { frameFor, type ChartFrame, type ChartFrameOpts } from '../../story/kit/chartFrame'

/* =========================================================================
   Hopper world (DESIGN.md D.3 "World"), per layout. World units, Y up.
   Every pose and every element reads these, so the camera fit and the
   geometry always agree.

   P ("stack", phones): H0 and H1 are the D.3 centred stack, the drum over
   the ticket. From H2 the rails take the lower two thirds and the drum and
   the ticket step aside as two columns under the pinned corners: the ticket
   (at 1.1x) under the domain legend on the left, the drum (at 0.6x) under
   the HUD chip on the right, its gate just above the ticket's notch. The
   ticket is the "which task came up" of every draw, so on a 390 px phone
   its task name stays about 19 px tall.
   L (desktop, landscape): drum and ticket side by side over longer rails.

   Proposed amendments (known issues): the drum is yawed 22 degrees about Y
   (its spin axis no longer points exactly at the camera), so the barrel,
   the bars and the back hoop catch the softboxes and read as a 3D cage;
   the P rails start at y 0 with a 1.85 pitch (D.3: 1.6, 1.35) so a name
   above a bar never meets the total riding the bar above it at 360 px;
   the P ticket is 6.4 x 1.9 (D.3: 4.8 x 1.6).
   ========================================================================= */

/** A position and a uniform scale. */
export interface Place {
  c: V3
  s: number
}

export interface World {
  /** the drum in H0 and H1: centre, radius, half-length on its axis, yaw about Y (radians) */
  drum: { c: V3; R: number; HL: number; yaw: number }
  /** the drum on the board (H2 on, explore) */
  drumBoard: Place
  /**
   * where the drawn ball leaves the drum, as an angle on the drum's wall
   * (radians, drum-local, 0 = +x): before the board, and on the board
   */
  gate: readonly [number, number]
  /** the ticket in H1: centre, size, the task-name wrap width, type sizes, notch radius, the notch the ball rests in (+1 right, -1 left) */
  ticket: { c: V3; w: number; h: number; maxW: number; name: number; kick: number; notch: number; side: 1 | -1 }
  /** the ticket on the board */
  ticketBoard: Place
  rails: { x0: number; len: number; y0: number; pitch: number }
}

export const BALL_R = 0.3
/** brick height and depth (D.3) */
export const BH = 0.5
export const BD = 0.4

const DEG = Math.PI / 180
const YAW = -22 * DEG

const P_TICKET = { w: 6.4, h: 1.9, notch: 0.46 }
const P_TB = 1.1
const P: World = {
  drum: { c: [0, 7.45, 0], R: 2.6, HL: 1.6, yaw: YAW },
  // right column, under the HUD chip; its gate sits just above the ticket's right notch
  drumBoard: { c: [3.62, 4.45, 0], s: 0.6 },
  gate: [-52 * DEG, -148 * DEG],
  ticket: { c: [0, 2.9, 1.2], ...P_TICKET, maxW: P_TICKET.w - 2 * P_TICKET.notch - 0.55, name: 0.62, kick: 0.36, side: 1 },
  // left column, under the legend: left edge on the rails' start, bottom 1.55 over the P1 rail
  // (room for the P1 rail's name, LEAD and NEW LEADER between them)
  ticketBoard: { c: [-5.4 + (P_TICKET.w * P_TB) / 2, 1.55 + (P_TICKET.h * P_TB) / 2, 1.2], s: P_TB },
  rails: { x0: -5.4, len: 10.8, y0: 0, pitch: 1.85 },
}

const L_TICKET = { w: 6, h: 1.8, notch: 0.44 }
const L: World = {
  drum: { c: [-5.5, 6.4, 0], R: 2.6, HL: 1.6, yaw: YAW },
  drumBoard: { c: [-5.5, 6.4, 0], s: 1 },
  gate: [12 * DEG, 12 * DEG],
  ticket: { c: [1.2, 6.4, 1.2], ...L_TICKET, maxW: L_TICKET.w - 2 * L_TICKET.notch - 0.5, name: 0.56, kick: 0.34, side: -1 },
  ticketBoard: { c: [1.2, 6.4, 1.2], s: 1 },
  rails: { x0: -7.6, len: 15.2, y0: 2.2, pitch: 1.45 },
}

export const WORLD: Record<Layout, World> = { P, L }

export const slotY = (w: World, k: number) => w.rails.y0 - w.rails.pitch * k

/* ------------------------------ poses at a board progress ------------------------------ */

/** The drum's placement at board progress k (0 the H1 stack, 1 the board): centre, scale and yaw. */
export interface DrumXf {
  x: number
  y: number
  z: number
  s: number
  cos: number
  sin: number
}
export const newDrumXf = (): DrumXf => ({ x: 0, y: 0, z: 0, s: 1, cos: 1, sin: 0 })

export function drumXf(w: World, k: number, out: DrumXf): DrumXf {
  const a = w.drum.c
  const b = w.drumBoard
  out.x = a[0] + (b.c[0] - a[0]) * k
  out.y = a[1] + (b.c[1] - a[1]) * k
  out.z = a[2] + (b.c[2] - a[2]) * k
  out.s = 1 + (b.s - 1) * k
  out.cos = Math.cos(w.drum.yaw)
  out.sin = Math.sin(w.drum.yaw)
  return out
}

/** A drum-local point (not spinning) to world, into out ({ x, y, z } of a Vector3). */
export function drumToWorld(xf: DrumXf, lx: number, ly: number, lz: number, out: { x: number; y: number; z: number }) {
  const x = lx * xf.s
  const z = lz * xf.s
  out.x = xf.x + x * xf.cos + z * xf.sin
  out.y = xf.y + ly * xf.s
  out.z = xf.z - x * xf.sin + z * xf.cos
  return out
}

export interface TicketXf {
  x: number
  y: number
  z: number
  s: number
}

/** The ticket's placement at board progress k. */
export function ticketAt(w: World, k: number, out: TicketXf): TicketXf {
  const a = w.ticket.c
  const b = w.ticketBoard
  out.x = a[0] + (b.c[0] - a[0]) * k
  out.y = a[1] + (b.c[1] - a[1]) * k
  out.z = a[2] + (b.c[2] - a[2]) * k
  out.s = 1 + (b.s - 1) * k
  return out
}

/* ------------------------------ camera boxes ------------------------------ */

/** The yawed drum's half extents on x and z (hoops plus their tube). */
function drumHalf(w: World, s: number): [number, number] {
  const { R, HL, yaw } = w.drum
  const c = Math.abs(Math.cos(yaw))
  const n = Math.abs(Math.sin(yaw))
  return [s * ((R + 0.14) * c + HL * n), s * ((R + 0.14) * n + HL * c)]
}

/** H0: the drum alone. */
export function drumBox(w: World): Box {
  const { c, R } = w.drum
  const [hx, hz] = drumHalf(w, 1)
  return [
    [c[0] - hx - 0.1, c[1] - R - 0.3, -hz],
    [c[0] + hx + 0.1, c[1] + R + 0.25, hz],
  ]
}

/** H1: the drum over its ticket (P), or beside it (L). */
export function drawBox(w: World): Box {
  const d = drumBox(w)
  const t = w.ticket
  return [
    [Math.min(d[0][0], t.c[0] - t.w / 2 - 0.1), Math.min(d[0][1], t.c[1] - t.h / 2 - 0.15), d[0][2]],
    [Math.max(d[1][0], t.c[0] + t.w / 2 + 0.1), d[1][1], d[1][2]],
  ]
}

/** px of the focus rect's top the pinned five-chip domain legend takes (P board poses start under it) */
export const LEGEND_PX = 148
/** world units right of the rails reserved for the leader's total (the P1 lane plate covers it) */
export const READOUT_ROOM: Record<Layout, number> = { P: 0.95, L: 1.3 }

/**
 * The board. P: the ticket (on the board) and the six rails with the
 * leader's total; the drum sits beside the ticket and above it, in the band
 * the legend and the HUD chip leave (padPx.t), so it is not in the box.
 * L: the drum, the ticket and the rails.
 */
export function boardBox(w: World, l: Layout): Box {
  const r = w.rails
  const t = w.ticket
  const tb = w.ticketBoard
  const bottom = slotY(w, 5) - BH / 2 - 0.1
  if (l === 'P') {
    return [
      [r.x0 - 0.05, bottom, -0.6],
      [r.x0 + r.len + READOUT_ROOM.P, tb.c[1] + (t.h * tb.s) / 2, 1.2],
    ]
  }
  const d = drumBox(w)
  return [
    [Math.min(r.x0, d[0][0]), bottom, d[0][2]],
    [Math.max(r.x0 + r.len + READOUT_ROOM.L, d[1][0], t.c[0] + t.w / 2), d[1][1] - 0.2, d[1][2]],
  ]
}

/**
 * Explore with the phone's controls sheet expanded (a short focus rect,
 * which reads as L): the rails alone. The legend steps aside and the ticket
 * and the drum fade, so six readable rails fill what is left of the stage.
 */
export function railsBox(w: World, l: Layout): Box {
  const r = w.rails
  return [
    [r.x0 - 0.05, slotY(w, 5) - BH / 2 - 0.1, -0.6],
    [r.x0 + r.len + READOUT_ROOM[l], slotY(w, 0) + BH / 2 + 0.1, 0.6],
  ]
}

/** The box a to b at k (0..1). */
export const lerpBox = (a: Box, b: Box, k: number): Box => [
  [a[0][0] + (b[0][0] - a[0][0]) * k, a[0][1] + (b[0][1] - a[0][1]) * k, a[0][2] + (b[0][2] - a[0][2]) * k],
  [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k, a[1][2] + (b[1][2] - a[1][2]) * k],
]

/* ------------------------------ the thread chart (H6) ------------------------------ */

/** Label room around the chart (px): ticks and DRAWS below, a little air right. */
export const CHART_PAD = { l: 22, r: 36, t: 44, b: 58 } as const
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
/** The lead range the chart plots, in points (covers every thread with room). */
export const LEAD_LO = -130
export const LEAD_HI = 800
export const leadV = (lead: number) => (lead - LEAD_LO) / (LEAD_HI - LEAD_LO)
/** the same, clamped to the chart (a fresh explore seed can run past the story's range) */
export const leadVc = (lead: number) => Math.min(1, Math.max(0, leadV(lead)))

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
