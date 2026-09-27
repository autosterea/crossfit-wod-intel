import type { Box, Layout, V3 } from '../../story/types'

/* =========================================================================
   Intro layout (DESIGN.md D.1 "World"). Every world constant of "The Line",
   for the portrait (P, phones) and landscape (L, desktop) focus rects. The
   camera poses in story.ts fit the boxes below, so the geometry and the
   camera always agree.

   Tuned from the D.1 start values (amendment proposal in the chapter
   report): the phone title is sized from Anton's measured advance widths
   so that FITNESS? fills the focus rect (I0 acceptance), and the underline
   spans the word it underlines. In I1 each model forms in its OWN cell (a
   2 x 2 grid on a phone, a row of four on desktop): the line travels from
   cell to cell like a coach drawing four diagrams on one whiteboard, so the
   rest frame of the beat is the four models, large and named, not an empty
   slate over a row of icons. They dock to the D.1 row as the chart arrives.
   ========================================================================= */

/** Anton advance widths in em (measured from public/fonts/Anton-Regular.ttf). */
export const ANTON = { whatIs: 3.0142, whatIsSp: 3.2485, fitness: 3.3457, cap: 0.8594 } as const
/** Barlow Condensed Bold advance widths in em. */
export const BARLOW_BOLD = { claim: 5.67, health: 2.774, cap: 0.7 } as const

export interface TitleLayout {
  size: number
  /** two lines (P) or one (L) */
  lines: 1 | 2
  /** baseline of "WHAT IS" and of "FITNESS?" */
  b1: number
  b2: number
  /** left x of each word (anchorX left) */
  x1: number
  x2: number
}

export interface ChartLayout {
  x0: number
  x1: number
  /** y of v = 0 and the world height of v = 1 */
  y0: number
  H: number
}

export interface TileLayout {
  /** tile centres, in MODULES order (01 .. 06) */
  c: readonly (readonly [number, number])[]
  w: number
  h: number
  /** glyph centre lift above the tile centre, and the glyph radius in the tile */
  lift: number
  r: number
}

export interface IntroLayout {
  title: TitleLayout
  underline: { y: number; x0: number; x1: number }
  /** I1: the cell each model forms in (centre per model, one radius) */
  cells: { xs: readonly number[]; ys: readonly number[]; r: number }
  /** I2: the docked row under the chart (y, slot x, glyph radius) */
  dock: { y: number; xs: readonly number[]; r: number }
  chart: ChartLayout
  /** depth of the lifetime solid (ages run into -z) */
  depth: number
  /** z and cap size of the HEALTH word on the floor in front of the solid */
  healthZ: number
  healthSize: number
  /**
   * I4: the x offset (from the chart's centre) of the lane the lifetime
   * surface travels down on its way to tile 06. On a phone tile 06 sits under
   * tile 04 (the chart's), so the surface steps left of the chart's column
   * before it passes it; on desktop they fold to opposite corners (0).
   */
  healthLane: number
  tiles: TileLayout
  boxes: { i0: Box; i1: Box; i2: Box; i4: Box }
}

const box = (x0: number, y0: number, x1: number, y1: number, z0 = 0, z1 = 0): Box => [
  [x0, y0, z0],
  [x1, y1, z1],
]

/* ------------------------------ portrait ------------------------------ */

const P_SIZE = 1.3
const P_CAP = ANTON.cap * P_SIZE
const P_B2 = 2.5
const P_B1 = P_B2 + P_CAP + 0.24

const P: IntroLayout = {
  title: {
    size: P_SIZE,
    lines: 2,
    b1: P_B1,
    b2: P_B2,
    x1: (-ANTON.whatIs * P_SIZE) / 2,
    x2: (-ANTON.fitness * P_SIZE) / 2,
  },
  underline: { y: P_B2 - 0.42, x0: -2.25, x1: 2.25 },
  // two rows of two under the dimmed title; the names hang below each row
  cells: { xs: [-1.9, 1.9, -1.9, 1.9], ys: [0.62, 0.62, -3.18, -3.18], r: 1.45 },
  // the D.1 row (0.36 of the D.1 formation radius 2.1), a clear band under the time axis titles
  dock: { y: -4.2, xs: [-2.85, -0.95, 0.95, 2.85], r: 0.756 },
  chart: { x0: -3.4, x1: 3.4, y0: -2.35, H: 6.6 },
  depth: 6,
  healthZ: 1.45,
  healthSize: 0.95,
  healthLane: -1.3,
  tiles: {
    c: [
      [-2.05, 3.45],
      [2.05, 3.45],
      [-2.05, 0],
      [2.05, 0],
      [-2.05, -3.45],
      [2.05, -3.45],
    ],
    w: 3.85,
    h: 3.2,
    lift: 0.32,
    r: 1.0,
  },
  boxes: {
    // I0: the title and its underline fill the width of the focus rect
    i0: box(-2.3, P_B2 - 0.62, 2.3, P_B1 + P_CAP + 0.08),
    // I1: the dimmed title (slid up 0.5) over the 2 x 2 models (the bottom
    // row's names hang below the box: the camera pads reserve their band)
    i1: box(-3.75, -4.62, 3.75, P_B1 + P_CAP + 0.58),
    // I2: the chart and the dimmed row under it
    i2: box(-3.75, -4.98, 3.75, 4.5),
    // I4: the six-tile map
    i4: box(-4.0, -5.1, 4.0, 5.1),
  },
}

/* ------------------------------ landscape ----------------------------- */

const L_SIZE = 1.1
const L_CAP = ANTON.cap * L_SIZE
const L_B = 2.1
const L_W = (ANTON.whatIsSp + ANTON.fitness) * L_SIZE

const L: IntroLayout = {
  title: {
    size: L_SIZE,
    lines: 1,
    b1: L_B,
    b2: L_B,
    x1: -L_W / 2,
    x2: -L_W / 2 + ANTON.whatIsSp * L_SIZE,
  },
  underline: { y: L_B - 0.4, x0: -3.7, x1: 3.7 },
  // one row of four under the dimmed title
  cells: { xs: [-4.8, -1.6, 1.6, 4.8], ys: [-0.75, -0.75, -0.75, -0.75], r: 1.24 },
  dock: { y: -4.7, xs: [-3.6, -1.2, 1.2, 3.6], r: 0.702 },
  chart: { x0: -4.6, x1: 4.6, y0: -2.9, H: 6.2 },
  depth: 6,
  healthZ: 1.05,
  healthSize: 1.1,
  healthLane: 0,
  tiles: {
    c: [
      [-5.0, 2.45],
      [0, 2.45],
      [5.0, 2.45],
      [-5.0, -2.45],
      [0, -2.45],
      [5.0, -2.45],
    ],
    w: 4.7,
    h: 4.6,
    lift: 0.42,
    r: 1.4,
  },
  boxes: {
    i0: box(-3.8, L_B - 0.6, 3.8, L_B + L_CAP + 0.08),
    i1: box(-6.35, -2.0, 6.35, L_B + L_CAP + 0.58),
    i2: box(-4.9, -5.42, 4.9, 3.6),
    i4: box(-7.45, -4.85, 7.45, 4.85),
  },
}

export const LAYOUTS: Record<Layout, IntroLayout> = { P, L }
export const layoutOf = (l: Layout): IntroLayout => LAYOUTS[l]

export const boxCenter = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]

/** The chart mapping for a layout: u in [0, 1] along time, v in [0, 1] up. */
export const cx = (c: ChartLayout, u: number) => c.x0 + (c.x1 - c.x0) * u
export const cy = (c: ChartLayout, v: number) => c.y0 + c.H * v

/** Chart group pivot (its centre) and the uniform scale that folds it into a tile. */
export function chartPivot(c: ChartLayout): [number, number] {
  return [(c.x0 + c.x1) / 2, c.y0 + c.H / 2]
}

/** Uniform scale that fits a w x h world rect inside a tile's glyph area. */
export function tileFit(t: TileLayout, w: number, h: number): number {
  return Math.min((t.w * 0.78) / w, (t.h * 0.66) / h)
}

/* ------------------------- the I3 oblique fit -------------------------- */

const DEG = Math.PI / 180

/**
 * A fit box whose eight corners project (orthographically, for this az / el)
 * exactly onto the projected extent of `pts`, and its centre, which then
 * projects onto the middle of that extent. The camera fits the box corners,
 * so an ordinary bounding box of an oblique solid frames the empty volume
 * above its low back edge and in front of it; this one frames the solid.
 * Its z range is the points' real depth range.
 */
export function obliqueFit(pts: readonly V3[], az: number, el: number): { box: Box; target: V3 } {
  const sa = Math.sin(az * DEG)
  const ca = Math.cos(az * DEG)
  const se = Math.sin(el * DEG)
  const ce = Math.cos(el * DEG)
  // camera right = (ca, 0, -sa), up = (-sa se, ce, -ca se)
  const R = (p: V3) => p[0] * ca - p[2] * sa
  const U = (p: V3) => -p[0] * sa * se + p[1] * ce - p[2] * ca * se
  let r0 = Infinity
  let r1 = -Infinity
  let u0 = Infinity
  let u1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (const p of pts) {
    r0 = Math.min(r0, R(p))
    r1 = Math.max(r1, R(p))
    u0 = Math.min(u0, U(p))
    u1 = Math.max(u1, U(p))
    z0 = Math.min(z0, p[2])
    z1 = Math.max(z1, p[2])
  }
  const zr0 = -z0 * sa
  const zr1 = -z1 * sa
  const x1 = (r1 - Math.max(zr0, zr1)) / ca
  const x0 = (r0 - Math.min(zr0, zr1)) / ca
  const xu0 = -x0 * sa * se
  const xu1 = -x1 * sa * se
  const zu0 = -z0 * ca * se
  const zu1 = -z1 * ca * se
  const y1 = (u1 - Math.max(xu0, xu1) - Math.max(zu0, zu1)) / ce
  const y0 = (u0 - Math.min(xu0, xu1) - Math.min(zu0, zu1)) / ce
  const b: Box = [
    [x0, y0, z0],
    [x1, y1, z1],
  ]
  return { box: b, target: boxCenter(b) }
}
