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
 * The profile prism's depth along +Z (S3 reveals it). D.2 says 0.25; at the
 * S3 tilt that projects to under a pixel on a phone, so the solid never
 * reads (proposed amendment: 2.0, a fifth of the radius). S4 flattens it again for the front-on
 * comparison, so the ghost registers with the Powerlifter and the hatch.
 */
export const DEPTH = 2.0
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
 * Annotation tags (S1 to S4): each callout sits in the free space of the
 * focus rect (tags.ts: the bands above and below the wheel on a phone, the
 * empty corners in landscape) and a pen-drawn leader joins it to what it
 * names. `from` is where the leader starts: a fractional spoke position on
 * the class arcs, or the floor ring's angle in degrees. `elbow` leaves the
 * wheel radially first, through the gap between two skill names (the gaps
 * sit at 18 degrees off every spoke), so a leader never crosses a name.
 */
export type TagSlot = 'TL' | 'TR' | 'BL' | 'BR'
export interface TagSpec {
  slot: TagSlot
  from: number
  elbow: boolean
}
export type TagKey = 'trained' | 'practiced' | 'both' | 'weak'
export const TAGS: Record<Layout, Record<TagKey, TagSpec>> = {
  P: {
    trained: { slot: 'TR', from: 0.5, elbow: false },
    practiced: { slot: 'TL', from: 9.2, elbow: false },
    both: { slot: 'BR', from: 4.5, elbow: true },
    weak: { slot: 'BL', from: -108, elbow: true },
  },
  L: {
    trained: { slot: 'TR', from: 1.5, elbow: true },
    practiced: { slot: 'TL', from: 8.5, elbow: true },
    both: { slot: 'BR', from: 4.5, elbow: true },
    weak: { slot: 'BL', from: -108, elbow: true },
  },
}
/** where an elbow leader turns: past the name ring */
export const ELBOW_R: Record<Layout, number> = { P: 13.3, L: 14.2 }
/** the outer edge of the name ring (world), bounding the free bands on a phone */
export const RING_OUT = 12.8

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
  /** everything the camera must fit: circles, plates and name rows */
  box: Box
}

/** Room under each circle for its name row (world units). */
const NAME_ROOM = 2.0
const PLATE_PAD = 0.45

const cache = new Map<Layout, Grid>()

/**
 * S5 grid. P: 3 columns x 5 rows. The rows are height-bound on a phone, so
 * widening the columns costs no size: the column pitch is 10.8 (D.2 says
 * 8.2; proposed amendment) so each name with its badge has its own column
 * at 360 px. L: 5 x 3 at the start pitch.
 */
export function grid(layout: Layout): Grid {
  const hit = cache.get(layout)
  if (hit) return hit
  const P = layout === 'P'
  const cols = P ? 3 : 5
  const rows = Math.ceil(RANKED.length / cols)
  const px = P ? 10.8 : 8.2
  const py = 8.8
  // cell block = circle (2 MINI_R) plus the name room under it; centre the grid on the origin
  const blockH = (rows - 1) * py + 2 * MINI_R + NAME_ROOM
  const top = blockH / 2 - MINI_R
  const center = (k: number): [number, number] => {
    const c = k % cols
    const r = Math.floor(k / cols)
    return [(c - (cols - 1) / 2) * px, top - r * py]
  }
  const plate = (k: number): [number, number, number, number] => {
    const [x, y] = center(k)
    const hw = px / 2 - 0.35
    return [x - hw, y - MINI_R - NAME_ROOM + 0.1, x + hw, y + MINI_R + PLATE_PAD]
  }
  const halfW = ((cols - 1) / 2) * px + px / 2 - 0.35
  const box: Box = [
    [-halfW, -blockH / 2 - 0.1, 0],
    [halfW, blockH / 2 + PLATE_PAD, 0],
  ]
  const g: Grid = { cols, rows, px, py, center, plate, box }
  cache.set(layout, g)
  return g
}

/**
 * Full athlete names under the S5 cells need about 170 px per column: only a
 * wide focus rect (desktop) has that; phones, portrait or on their side, use
 * the short names. Re-renders only when the answer flips.
 */
const wideNow = () => focusRect.w >= 700
export function useWideNames(): boolean {
  return useSyncExternalStore(subscribeFocus, wideNow)
}
