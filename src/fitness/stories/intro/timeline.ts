import { at, stagger } from '../../story/cue'
import { ease } from '../../story/ease'

/* =========================================================================
   The intro's timeline (DESIGN.md D.1): every visible property of the
   scene is one of these pure functions of story time T (L5), so a deep
   link, the scrubber and reduced motion (t = 1) all render the same frame,
   and (N, 1) equals (N + 1, 0).

   Explore (C.12) shows the six-tile map from any beat: while exploring, the
   scene reads an EXPLORE time. On entry it cuts to the start of the fold
   (never earlier) and runs quickly to the finished map; on "Back to story"
   it runs back to the story's T before the story takes over again (a cut
   under reduced motion). Story mode never reads it.
   ========================================================================= */

export const BEAT = { title: 0, models: 1, definition: 2, lifetime: 3, map: 4 } as const
/** T at the end of the last beat (the finished map). */
export const END_T = 5

/** Mutable explore time, written once per frame by the scene before anything reads it. */
export const exploreTime = { on: false, T: END_T }
/** The time the scene shows: story T, or the explore time while exploring (or rewinding). */
export const eff = (T: number): number => (exploreTime.on ? exploreTime.T : T)

const A = (T: number, n: number, a: number, b: number, e = ease.linear) => at(eff(T), n, a, b, e)

/* ------------------------------- I0 title ------------------------------ */

/** the title rises 0.4 while fading in */
export const titleIn = (T: number) => A(T, BEAT.title, 0, 0.35, ease.settle)
/** I1: the title dims to 35% and slides up 0.5 */
export const titleSlide = (T: number) => A(T, BEAT.models, 0, 0.12, ease.settle)
/** I2: the title fades out */
export const titleOut = (T: number) => A(T, BEAT.definition, 0, 0.15)
export const titleOpacity = (T: number) => titleIn(T) * (1 - 0.65 * titleSlide(T)) * (1 - titleOut(T))
/** the pen draws the underline left to right */
export const underlineDraw = (T: number) => A(T, BEAT.title, 0.4, 0.85, ease.draw)
/** the slate's glow brightens by 10% as the line lands, and stays */
export const glowUp = (T: number) => A(T, BEAT.title, 0.85, 1, ease.settle)

/* ------------------------------ I1 models ------------------------------ */

/** Morph windows: four of 0.2 each (D.1 I1). */
export const WIN = [0.12, 0.32, 0.52, 0.72] as const
export const WIN_W = 0.2
/** The morph itself uses this share of its window; the shape then rests, named. */
export const MORPH_SHARE = 0.72
/** Per-point stagger of the morph along the stroke (introMath.morphFlow). */
export const STAGGER = 0.42

/** Morph w (shape w -> shape w + 1), 0..1 linear in T; morphFlow eases each point. */
export const morphK = (T: number, w: number) => A(T, BEAT.models, WIN[w], WIN[w] + WIN_W * MORPH_SHARE)

/**
 * The ink of pen j (0 = the underline, j = the shape the morph j - 1
 * forms): it follows the middle of the morph's moving front, so the new
 * colour is written onto the line exactly where the line takes its new
 * shape, and the pen head rides that front.
 */
export function inkProgress(T: number, j: number): number {
  if (j === 0) return underlineDraw(T)
  const k = morphK(T, j - 1)
  return Math.max(0, Math.min(1, (k - (1 - STAGGER) / 2) / STAGGER))
}

/**
 * The moment the line leaves model c for the next cell (the dial, the last
 * one, hands over at 0.92, where D.1 ended the hero). From then on a still
 * copy of the model holds its cell.
 */
export const leaveAt = (c: number) => (c < 3 ? WIN[c + 1] : WIN[3] + WIN_W)
/** The hero line exists until the dial's copy takes its place. */
export const heroOn = (T: number) => eff(T) < BEAT.models + leaveAt(3)
export const copyOn = (T: number, c: number) => eff(T) >= BEAT.models + leaveAt(c)

/** The moment morph c lands its last point (the shape closes): a short glint where its ends meet. */
export const closeGlint = (T: number, c: number) => {
  const t = BEAT.models + WIN[c] + WIN_W * MORPH_SHARE
  const e = eff(T)
  if (e <= t - 0.012 || e >= t + 0.05) return 0
  return e < t ? (e - (t - 0.012)) / 0.012 : 1 - (e - t) / 0.05
}

/** A shape's name fades in the moment it closes (60% of its window). */
export const nameIn = (T: number, c: number) => A(T, BEAT.models, WIN[c] + 0.6 * WIN_W, WIN[c] + 0.75 * WIN_W)

/** The drum's five domain dots pop onto its rim as it closes. */
export const dotPop = (T: number, i: number) =>
  stagger(eff(T), BEAT.models + WIN[1] + 0.55 * WIN_W, BEAT.models + WIN[1] + 0.9 * WIN_W, i, 5, 0.6, ease.snap)

/**
 * I2 0 to 0.15: the four models leave their cells for the D.1 docked row as
 * the axes draw, in an order in which no model ever crosses another (phone
 * 2 x 2): Energy and Continuum (the bottom row) slide into the right half
 * of the row, Skills then drops into slot 1, and the Hopper swings across
 * ahead of its drop into slot 2. Separate x and y windows per model.
 */
const DOCK_X = [
  [0.025, 0.11],
  [0.05, 0.13],
  [0, 0.075],
  [0, 0.075],
] as const
const DOCK_Y = [
  [0.025, 0.11],
  [0.06, 0.15],
  [0, 0.075],
  [0, 0.075],
] as const
export const dockX = (T: number, c: number) => A(T, BEAT.definition, DOCK_X[c][0], DOCK_X[c][1], ease.settle)
export const dockY = (T: number, c: number) => A(T, BEAT.definition, DOCK_Y[c][0], DOCK_Y[c][1], ease.settle)

/** The full MODULES label names a model in its cell (formed, then held for the I1 rest). */
export const fullName = (T: number, c: number) => nameIn(T, c) * (1 - A(T, BEAT.definition, 0, 0.04))
/** The short name rides the docked copy (I2), dimmed with the row, gone in I3. */
export const shortName = (T: number, c: number) => A(T, BEAT.definition, DOCK_Y[c][1] - 0.01, DOCK_Y[c][1] + 0.03)

/** The docked row: dimmed to 35% under the chart (I2), gone in I3, back for the map (I4). */
export const rowDim = (T: number) => 1 - 0.65 * A(T, BEAT.definition, 0, 0.15) + 0.65 * A(T, BEAT.map, 0, 0.25)
/** Gone in I3; in I4 the glyphs fade back in only once they are already flying to their tiles. */
export const rowFade = (T: number) => 1 - A(T, BEAT.lifetime, 0, 0.2) + A(T, BEAT.map, 0.12, 0.24)

/* ---------------------------- I2 definition ---------------------------- */

/** construction: the two axes, one L stroke with a hot pen */
export const axesDraw = (T: number) => A(T, BEAT.definition, 0.1, 0.35, ease.draw)
export const ticksDraw = (T: number) => A(T, BEAT.definition, 0.26, 0.4)
/** data: the pen draws the Generalist curve */
export const curveDraw = (T: number) => A(T, BEAT.definition, 0.35, 0.7, ease.draw)
/** the area sweeps left to right (time-true: linear) */
export const sweep = (T: number) => A(T, BEAT.definition, 0.7, 0.95)
/** the claim settles inside the area */
export const claimIn = (T: number) => A(T, BEAT.definition, 0.9, 1, ease.settle)
export const claimOut = (T: number) => A(T, BEAT.lifetime, 0, 0.15)
export const axisTitles = (T: number) => A(T, BEAT.definition, 0.3, 0.42) * (1 - A(T, BEAT.lifetime, 0, 0.1))

/* ----------------------------- I3 lifetime ----------------------------- */

/** the curve settles onto the youngest slice of the lifetime surface */
export const sliceMorph = (T: number) => A(T, BEAT.lifetime, 0.05, 0.25, ease.morph)
/** the area extrudes back through every age (0 -> 1 of the depth) */
export const extrude = (T: number) => A(T, BEAT.lifetime, 0.1, 0.7, ease.draw)
/** the back edge is a hot scanner line while ages are added, then rests */
export const scannerHot = (T: number) => (extrude(T) > 0 ? 1 - A(T, BEAT.lifetime, 0.7, 0.86) : 0)
export const skirtIn = (T: number) => A(T, BEAT.lifetime, 0.1, 0.3)
export const ageAxisDraw = (T: number) => A(T, BEAT.lifetime, 0.1, 0.7, ease.draw)
/** the age axis belongs to the upright landscape; it leaves before the fold */
export const ageAxisOut = (T: number) => 1 - A(T, BEAT.map, 0, 0.12)
/**
 * The power axis and its ticks step back while the landscape stands (the
 * surface's own height and isolines read power there), and return as the
 * chart folds into the Capacity tile.
 */
export const powerAxisOut = (T: number) => A(T, BEAT.lifetime, 0.02, 0.2, ease.settle) * (1 - A(T, BEAT.map, 0, 0.3))
/**
 * The area is one face of the volume in I3: it recedes to a whisper so the
 * lit lifetime surface speaks (L3), and comes back as it folds into the
 * Capacity tile.
 */
export const faceDim = (T: number) => 1 - 0.95 * A(T, BEAT.lifetime, 0.1, 0.45, ease.settle) + 0.95 * A(T, BEAT.map, 0, 0.3)
export const ageLabel = (T: number) => A(T, BEAT.lifetime, 0.55, 0.7) * (1 - A(T, BEAT.map, 0, 0.1))
export const healthIn = (T: number) => A(T, BEAT.lifetime, 0.75, 1, ease.settle) * (1 - A(T, BEAT.map, 0, 0.08))

/* -------------------------------- I4 map ------------------------------- */

/**
 * Tile i (MODULES order) folds in with a 50 ms stagger (0.01 of the 5 s
 * beat), settle (D.1 I4). The chart (04) and the landscape (06) are the
 * subjects on screen and fold at once; the four glyphs launch from the
 * docked row 0.1 later, when the camera has come most of the way back
 * front-on, so they fly into the grid undistorted.
 */
const FOLD_START = [0.1, 0.1, 0.1, 0, 0.1, 0]
export const fold = (T: number, i: number) => {
  const a = FOLD_START[i] + 0.01 * i
  return A(T, BEAT.map, a, a + 0.4, ease.settle)
}
/** the faint accent ring of each tile */
export const plateIn = (T: number, i: number) => A(T, BEAT.map, 0.3 + 0.01 * i, 0.55 + 0.01 * i, ease.settle)
/** tile labels (0.50 to 0.80) */
export const tileName = (T: number, i: number) => stagger(eff(T), BEAT.map + 0.5, BEAT.map + 0.8, i, 6, 0.5)
/** the Health tile's slow turn starts once it has landed */
export const turnOn = (T: number) => A(T, BEAT.map, 0.45, 0.85, ease.settle)
/** the tile's ridgelines and crisp front edge draw on as it folds in */
export const tileLines = (T: number) => A(T, BEAT.map, 0.18, 0.45, ease.settle)
/** the tiles are tappable once they have landed */
export const tilesLive = (T: number) => A(T, BEAT.map, 0.5, 0.6) > 0
