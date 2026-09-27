import type { Box, Layout, V3 } from '../../story/types'

/* =========================================================================
   Intro layout (DESIGN.md D.1 "World"). Every world constant of "The Line",
   for the portrait (P, phones) and landscape (L, desktop) focus rects. The
   camera poses in story.ts fit the boxes below, so the geometry and the
   camera always agree.

   Tuned from the D.1 start values (amendment proposal in the chapter
   report): the phone title is sized from Anton's measured advance widths
   so that FITNESS? fills the focus rect (I0 acceptance), the underline
   spans the word it underlines, and the formation spot, the docked row and
   the chart are stacked so that each beat's subject fills the tall phone
   rect instead of leaving a band of empty slate.
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
  /** where each model forms (centre, radius) */
  form: { c: readonly [number, number]; r: number }
  /** docked row: y, slot x, glyph scale */
  dock: { y: number; xs: readonly number[]; s: number }
  chart: ChartLayout
  /** depth of the lifetime solid (ages run into -z) */
  depth: number
  tiles: TileLayout
  boxes: { i0: Box; i1: Box; i2: Box; i3: Box; i4: Box }
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
  form: { c: [0, -0.35], r: 2.1 },
  dock: { y: -3.98, xs: [-2.85, -0.95, 0.95, 2.85], s: 0.36 },
  chart: { x0: -3.4, x1: 3.4, y0: -2.35, H: 6.6 },
  depth: 6,
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
    // I1: the dimmed title (slid up 0.5), the formation spot and the docked row
    // (its names hang below the glyphs: the camera pads reserve their band in px)
    i1: box(-3.75, -4.76, 3.75, P_B1 + P_CAP + 0.58),
    // I2: the chart and the dimmed row under it
    i2: box(-3.75, -4.76, 3.75, 4.5),
    // I3: the lifetime solid (front face at z 0, ages to z -6) and HEALTH on the floor in front
    i3: box(-3.5, -2.45, 3.5, 1.75, -6.2, 1.8),
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
  form: { c: [0, -1.2], r: 1.95 },
  dock: { y: -4.7, xs: [-3.6, -1.2, 1.2, 3.6], s: 0.36 },
  chart: { x0: -4.6, x1: 4.6, y0: -2.9, H: 6.2 },
  depth: 6,
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
    i1: box(-4.4, -5.42, 4.4, L_B + L_CAP + 0.58),
    i2: box(-4.9, -5.42, 4.9, 3.6),
    i3: box(-4.7, -3.0, 4.7, 1.0, -6.2, 1.8),
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
