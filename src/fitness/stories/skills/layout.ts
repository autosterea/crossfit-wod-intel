import { useSyncExternalStore } from 'react'
import type { Box, Layout } from '../../story/types'
import { focusRect, subscribeFocus } from '../../story/camera/focusRect'
import { RANKED } from './skillsMath'

/* =========================================================================
   Skills chapter layout (DESIGN.md D.2 "World"). A radar in the XY plane,
   R = 10 world units, one unit per skill point; the flat radar faces +Z.
   The S5 small multiples are 13 mini radars (R 3) on a grid: P 3 x 5,
   L 5 x 3. Camera poses and the scene read the same functions.
   ========================================================================= */

/** Radar radius: a rating of 10. */
export const R = 10
/** Class arcs (S1, S2). */
export const ARC_R = 10.55
/** Skill name label anchors (radial). */
export const LABEL_R = 11.2
/** Class callouts sit just outside the arcs. */
export const CALLOUT_R = 12.2
/**
 * The profile prism's depth along +Z (S3 reveals it). D.2 says 0.25, which
 * projects to under a pixel at the D.2 tilt. The first build used 2.0: the
 * solid read, but it lifted the floor ring and the vertex nodes about 11 px
 * off the rings, ticks and spokes they are read against, so the 7 ring did
 * not sit on the 7 ticks. 0.75 at az -10 / el 15 (P) and az -12 / el 16 (L)
 * shows 3 to 4 px of shaded wall and keeps every mark on the cap within
 * 0.25 units (3 px) of its tick (proposed amendment). S4 flattens it again
 * for the front-on comparison.
 */
export const DEPTH = 0.75
/** explore keeps a shallow prism: it is read front-on first, orbited second */
export const EX_DEPTH = 0.5
/** the flat profile's lift off the web (S4, explore) */
export const FLAT = 0.05
/** Mini radar radius in the S5 grid. */
export const MINI_R = 3

/** The flat wheel as the camera fits it (S0 to S2, S4). */
export const WHEEL_BOX: Box = [
  [-R, -R, 0],
  [R, R, 0.3],
]
/** The wheel with the risen prism (S3). */
export const SOLID_BOX: Box = [
  [-R, -R, 0],
  [R, R, DEPTH],
]

/**
 * Label room around the wheel, px. P is width-bound on a phone: the side
 * names (Endurance, Flexibility, Agility, Balance) fall back to their
 * tangent sides, so the side pad only needs half a name.
 */
export const WHEEL_PAD = {
  P: { l: 56, r: 56, t: 60, b: 60 },
  L: { l: 76, r: 76, t: 76, b: 76 },
} as const

/**
 * Side names (Endurance, Flexibility, Agility, Balance). Landscape: outward
 * first. Portrait (width-bound): the tangent side away from the horizontal
 * first, so the placer may slide it the last few px inside the rect.
 */
type Side = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
export const SIDE: Record<number, { P: Side; only: readonly Side[] }> = {
  2: { P: 'N', only: ['E', 'NE', 'N'] },
  3: { P: 'S', only: ['E', 'SE', 'S'] },
  7: { P: 'S', only: ['W', 'SW', 'S'] },
  8: { P: 'N', only: ['W', 'NW', 'N'] },
}

/* -------------------------------- tags --------------------------------- */

/**
 * Annotation tags (S1 to S4, explore): each callout sits in the free space of
 * the focus rect (tags.ts: the bands above and below the wheel on a phone,
 * the empty corners in landscape) and a pen-drawn leader joins it to what it
 * names. The name gaps sit 18 degrees off every spoke (72, 36, 0, -36, ...),
 * so a leader that leaves the wheel through one never crosses a name.
 *
 * `from`: the class arcs start their leader at this fractional spoke
 * position; the floor tags start at the vertex of spoke `from` (a vertex the
 * floor ring touches: S3 Agility, one of the generalist's three 7s; S4
 * Endurance, where the powerlifter's floor catches); explore starts on its
 * floor ring at `from` degrees.
 * `elbow`: the angle (degrees) of the name gap an elbowed leader turns in,
 * at ELBOW_R (never past the tag's own height); null draws it straight.
 * `end`: where the leader meets its pill, 0 the centre, 1 near the inner end
 * (the end toward the wheel), -1 near the outer end, so a leader can run
 * between names.
 */
export type TagSlot = 'TL' | 'TR' | 'BL' | 'BR'
export interface TagSpec {
  slot: TagSlot
  from: number
  elbow: number | null
  end: number
  /**
   * A run instead of an elbow: leave the start at `dir` degrees until the
   * pill's own x (`end`), then rise (or drop) straight into the pill. For a
   * start deep inside the wheel whose name gap is too narrow for a radial
   * elbow.
   */
  run?: { dir: number }
}
export type TagKey = 'trained' | 'practiced' | 'both' | 'weakG' | 'weakP'
export const TAGS: Record<Layout, Record<TagKey, TagSpec>> = {
  P: {
    trained: { slot: 'TR', from: 0.5, elbow: null, end: 0 },
    practiced: { slot: 'TL', from: 9.2, elbow: null, end: 0 },
    both: { slot: 'BR', from: 4.5, elbow: -72, end: 0 },
    // Agility (one of the generalist's three 7s), straight down the corridor
    // between the Coordination and Speed names
    weakG: { slot: 'BL', from: 7, elbow: null, end: 0.75 },
    // out at 40 degrees between the Stamina and Endurance names (clear of the
    // powerlifter's own edges, which leave this vertex at 73 and -44
    // degrees), then straight up into the pill's outer end, past STAMINA
    weakP: { slot: 'TR', from: 2, elbow: null, end: -1, run: { dir: 40 } },
  },
  L: {
    trained: { slot: 'TR', from: 1.5, elbow: 36, end: 0 },
    practiced: { slot: 'TL', from: 8.5, elbow: 144, end: 0 },
    both: { slot: 'BR', from: 4.5, elbow: -72, end: 0 },
    // Flexibility (the generalist's other side 7) out through the gap below it:
    // the long Coordination name fills the lower-left corner in landscape
    weakG: { slot: 'BR', from: 3, elbow: -36, end: 0 },
    // as on a phone, a little flatter: the landscape Stamina name is long
    weakP: { slot: 'TR', from: 2, elbow: null, end: -1, run: { dir: 36 } },
  },
}
/** where an elbow leader turns: past the name ring */
export const ELBOW_R: Record<Layout, number> = { P: 13.3, L: 14.2 }
/** the outer edge of the name ring (world), bounding the free bands on a phone */
export const RING_OUT = 12.8
/** Explore's floor tag: out through the gap below Speed on a phone, toward the corner in landscape. */
export const EX_TAG: Record<Layout, TagSpec> = {
  P: { slot: 'BL', from: -108, elbow: -108, end: 0 },
  L: { slot: 'BL', from: -144, elbow: -144, end: 0 },
}

/* ------------------------------ the grid ------------------------------ */

export interface Grid {
  cols: number
  rows: number
  /** cell pitch, world units */
  px: number
  py: number
  /** mini circle centre of ranked cell k */
  center: (k: number) => [number, number]
  /** glass plate behind cell k: [x0, y0, x1, y1] (the circle plus its name row) */
  plate: (k: number) => [number, number, number, number]
  /** the anchor of cell k's name row: just inside the plate's bottom edge */
  nameAt: (k: number) => [number, number]
  /** everything the camera must fit: circles, plates and name rows */
  box: Box
}

/**
 * Room under each circle for its name row (world units): the name sits
 * INSIDE its plate, above the plate's bottom edge.
 */
const NAME_ROOM: Record<Layout, number> = { P: 2.7, L: 2.5 }
const PLATE_PAD = 0.35
/** gap between neighbouring plates */
const GUTTER = 0.35

const cache = new Map<Layout, Grid>()

/**
 * S5 grid. P: 3 columns x 5 rows. The rows are height-bound on a phone, so
 * wide columns cost no size: the column pitch is 12.4 (D.2 says 8.2;
 * proposed amendment), which gives each name with its badge its own column
 * at 360 px. L: 5 x 3 at 8.8 (D.2 8.2). A short last row is centred, so the
 * Powerlifter closes the grid on its own under the middle column (P).
 */
export function grid(layout: Layout): Grid {
  const hit = cache.get(layout)
  if (hit) return hit
  const P = layout === 'P'
  const cols = P ? 3 : 5
  const n = RANKED.length
  const rows = Math.ceil(n / cols)
  const room = NAME_ROOM[layout]
  const px = P ? 12.4 : 8.8
  const py = 2 * MINI_R + PLATE_PAD + room + GUTTER
  const cellH = 2 * MINI_R + PLATE_PAD + room
  const blockH = (rows - 1) * py + cellH
  // the circle centre of the top row, so the block is centred on the origin
  const top = blockH / 2 - PLATE_PAD - MINI_R
  const center = (k: number): [number, number] => {
    const r = Math.floor(k / cols)
    const inRow = Math.min(cols, n - r * cols)
    const c = (k % cols) + (cols - inRow) / 2
    return [(c - (cols - 1) / 2) * px, top - r * py]
  }
  const hw = px / 2 - GUTTER / 2
  const plate = (k: number): [number, number, number, number] => {
    const [x, y] = center(k)
    return [x - hw, y - MINI_R - room, x + hw, y + MINI_R + PLATE_PAD]
  }
  const nameAt = (k: number): [number, number] => {
    const [x, y] = center(k)
    return [x, y - MINI_R - room + 0.02]
  }
  const halfW = ((cols - 1) / 2) * px + hw
  const box: Box = [
    [-halfW, -blockH / 2, 0],
    [halfW, blockH / 2, 0],
  ]
  const g: Grid = { cols, rows, px, py, center, plate, nameAt, box }
  cache.set(layout, g)
  return g
}

/**
 * The full athlete names need about 200 px per column ("GENERALIST
 * CROSSFITTER" with its badge); every phone and a 1440 desktop (about 170 px
 * per column) use the short names (D.2 allows them). Re-renders only when the
 * answer flips.
 */
const wideNow = () => (focusRect.w - 32) / (focusRect.layout === 'P' ? 3 : 5) >= 205
export function useWideNames(): boolean {
  return useSyncExternalStore(subscribeFocus, wideNow)
}
