import type { ChartFrame, ChartFrameOpts } from '../../story/kit/chartFrame'
import { frameFor } from '../../story/kit/chartFrame'
import { focusRect } from '../../story/camera/focusRect'
import type { Box, CamPose, Layout, V3 } from '../../story/types'
import { N } from './continuumMath'

/* =========================================================================
   Continuum layout (DESIGN.md D.6). Two phases share one world:

   PARALLEL ROWS (C0 to C3): ten marker rows in chart space through the
   adaptive frame ROWS_FRAME (B.13: FH 11, aspect 0.9 to 1.6). Row i sits
   1.1 world units below row i - 1, runs from x(0) (sickness) to x(1)
   (fitness): better is always to the right.

   THE DIAL (C3 to C6 and explore): centre (0, 0, 0), R = 7, hub 0.6, ten
   spokes on a FULL circle at 90 - 36 i degrees. The position p of a marker
   maps to radius HUB + p (R - HUB). The disc and the spokes displace along
   -Z by DEPTH (1 - r / R)^2 (the bowl): sickness is a pit, invisible
   front-on and revealed by the C4 tilt.

   ONE per-row transform (origin, angle, length) morphs a row into its
   spoke; the line, its ticks and its name all ride it.

   PHONE: the dial is the subject. Its pads are the room its spoke names
   need and no more: the four side names sit on two lines, so the dial is
   about 280 px across at 390 (asymmetric, because the left names are the
   wider ones), and the portrait key under it is compact.
   ========================================================================= */

export const R = 7
export const HUB = 0.6
/**
 * Bowl depth (amendment, see known issues): D.6 gives 1.4, which moves the
 * pit centre by a few px on a phone at the C4 tilt, too little to read as a
 * pit. 4.0 keeps the same curve (1 - r / R)^2 and makes it read.
 */
export const DEPTH = 4.0
export const DEG = Math.PI / 180

/** Position along a spoke (0 sick .. 1 elite) -> radius. */
export const radiusOf = (p: number): number => HUB + p * (R - HUB)
/** The bowl: world z of the dial surface at radius r (the centre is DEPTH deeper). */
export const bowl = (r: number): number => {
  const q = 1 - Math.min(Math.max(r, 0), R) / R
  return -DEPTH * q * q
}
/** Spoke angle in radians, LITERAL (unwrapped): 90, 54, 18, ... -234 degrees. The morph turns each row by k times this, so the rows open like a fan without crossing. */
export const spokeAngle = (i: number): number => (90 - 36 * i) * DEG

export const ROWS_FRAME: ChartFrameOpts = { FH: 11, minAspect: 0.9, maxAspect: 1.6, marginPx: { l: 24, r: 24, t: 30, b: 28 } }
export const ROW_GAP = 1.1
/** World y of row i (the rows chart is centred on the dial centre). */
export const rowY = (i: number): number => ROWS_FRAME.FH / 2 - ROW_GAP * (i + 0.5)
/** The station columns span the table the rows will fill (a little beyond the first and last rows). */
export const COL_TOP = rowY(0) + 0.6
export const COL_BOT = rowY(N - 1) - 0.6

/**
 * The chapter's engine frame (StoryDef.frame) is the DIAL: the rim's square
 * (aspect clamped to 1) with the bowl's depth. The explore pose fits it with
 * the spoke names in its pads, and __story.chartRect() reports it, so the
 * explore re-fit checks measure the dial itself.
 */
export const DIAL_EXTENT = R
export const DIAL_FRAME: ChartFrameOpts = {
  FH: DIAL_EXTENT * 2,
  minAspect: 1,
  maxAspect: 1,
  marginPx: { l: 0, r: 0, t: 0, b: 0 },
  zRange: [-DEPTH, 0],
}

export const rowsFrame = (): ChartFrame => frameFor(ROWS_FRAME)

/* ------------------------------ transform ------------------------------ */

export interface RowXf {
  ox: number
  oy: number
  c: number
  s: number
  len: number
  /** morph progress 0 (row) .. 1 (spoke) */
  k: number
}
export const newXf = (): RowXf => ({ ox: 0, oy: 0, c: 1, s: 0, len: 1, k: 0 })

/**
 * Row i (at height y in the parallel phase) at morph k: its left end slides
 * to the hub, it turns to its spoke angle, its length becomes R - HUB.
 */
export function rowXf(i: number, k: number, f: ChartFrame, y: number, out: RowXf): RowXf {
  const phi = spokeAngle(i)
  out.k = k
  out.ox = f.x(0) + (HUB * Math.cos(phi) - f.x(0)) * k
  out.oy = y + (HUB * Math.sin(phi) - y) * k
  const th = phi * k
  out.c = Math.cos(th)
  out.s = Math.sin(th)
  out.len = f.FW + (R - HUB - f.FW) * k
  return out
}

/** Point u (0..1) along a transformed row into out[o..o+2]; z follows the bowl as the row becomes a spoke. */
export function rowPoint(x: RowXf, u: number, out: Float32Array | number[], o: number, lift = 0): void {
  out[o] = x.ox + x.c * x.len * u
  out[o + 1] = x.oy + x.s * x.len * u
  out[o + 2] = x.k * bowl(radiusOf(u)) + lift
}

/** A dot at position p on spoke i, riding the bowl surface. */
export function dialPoint(i: number, p: number, out: Float32Array | number[], o = 0, lift = 0): void {
  const a = spokeAngle(i)
  const r = radiusOf(p)
  out[o] = r * Math.cos(a)
  out[o + 1] = r * Math.sin(a)
  out[o + 2] = bowl(r) + lift
}

/* ------------------------------ the key ------------------------------- */

/**
 * The portrait key (D.6 "Portrait key"): a compact DOM panel under the dial
 * on a portrait phone or tablet. Its measured height is reserved at the
 * bottom of the C4 to C6 and explore poses (the fit excludes it), and it is a
 * label obstacle. `h` is measured by the key; `hs` follows it smoothly (the
 * camera glides when the key collapses to its header on the last beat);
 * `hidden` is set while the caption card or the explore sheet is expanded.
 */
export const keyState = { h: 136, hs: 136, hidden: false, gap: 28 }

/** True where the key replaces the spoke-tip values: portrait phone or tablet. */
export const keyMode = (): boolean => focusRect.layout === 'P' && (focusRect.shell === 'phone' || focusRect.shell === 'tablet')

const keyReserve = (): number => (keyMode() && !keyState.hidden ? keyState.hs + keyState.gap : 0)

type Pads = { l: number; r: number; t: number; b: number }
/** A pad object read by the director every frame: the base pads plus the key reserve at the bottom. */
function padWithKey(base: Pads) {
  return {
    get l() {
      return base.l
    },
    get r() {
      return base.r
    },
    get t() {
      return base.t
    },
    get b() {
      return base.b + keyReserve()
    },
  }
}

/* ------------------------------ camera -------------------------------- */

const T0: V3 = [0, 0, 0]

/**
 * C0 to C2 give the featured rows room for their labels: the one line sits
 * at the centre (C0, C1); in C2 it moves up and body fat draws Y_PAIR below
 * the centre; in C3 both slide into their slots as the other rows arrive.
 */
export const Y_PAIR = 2.2

/**
 * C0 to C2: the one line at the optical centre of the table to come, with
 * the station columns over the table's height and their headers above.
 */
export const lineBox = (_l: Layout, _f: ChartFrame): Box => {
  const f = rowsFrame()
  return [
    [f.x(0), COL_BOT, 0],
    [f.x(1), COL_TOP + 0.2, 0],
  ]
}
/** C3 first half: all ten rows (their names sit right of the fitness ends). */
export const rowsBox = (_l: Layout, _f: ChartFrame): Box => {
  const f = rowsFrame()
  return [
    [f.x(0), rowY(N - 1) - 0.3, 0],
    [f.x(1), rowY(0) + 0.4, 0],
  ]
}
const center = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]

const FLAT_BOX: Box = [
  [-R, -R, 0],
  [R, R, 0],
]

/** A short landscape stage (a phone on its side): its focus rect is under 460 px tall. */
export const shortStage = (): boolean => focusRect.layout === 'L' && focusRect.h < 460 && focusRect.shell !== 'phone'
/** A portrait phone whose focus rect turned wide (the explore sheet or the caption card expanded): a small, short rect. */
export const phoneWide = (): boolean => focusRect.layout === 'L' && focusRect.shell === 'phone'
/** Two-line side names and elite ticks: any phone-sized stage. */
export const compactStage = (): boolean => focusRect.layout === 'P' || shortStage() || phoneWide()

/** Pads that switch on the stage: tall (desktop, tablet), short (a phone on its side), or a portrait phone's small wide rect. */
const PHONE_WIDE: Pads = { l: 62, r: 40, t: 16, b: 10 }
function landscapePad(tall: Pads, short: Pads) {
  const pick = (): Pads => (phoneWide() ? PHONE_WIDE : shortStage() ? short : tall)
  return {
    get l() {
      return pick().l
    },
    get r() {
      return pick().r
    },
    get t() {
      return pick().t
    },
    get b() {
      return pick().b
    },
  }
}

/** C0 to C2 (both layouts): symmetric, so the line sits on the centre of the stage. */
const LINE_PAD = { l: 30, r: 30, t: 44, b: 14 }
export const LINE: CamPose = { target: (l, f) => center(lineBox(l, f)), az: 0, el: 0, fov: 28, fit: lineBox, padPx: LINE_PAD }
/** C3 table: the names ride the fitness ends (right); two-line side names on a phone. */
export const ROWS_L: CamPose = { target: (l, f) => center(rowsBox(l, f)), az: 0, el: 0, fov: 28, fit: rowsBox, padPx: { l: 18, r: 106, t: 18, b: 22 } }
export const ROWS_P: CamPose = { ...ROWS_L, padPx: { l: 14, r: 64, t: 16, b: 20 } }

/**
 * Landscape dial pads: room for the one-line spoke names (the widest sit
 * left and right) and the values beside the dots. From C4 the HUD chip holds
 * the top-right corner: on a short stage (a phone on its side) the dial
 * moves left of it, or its SYSTOLIC BP name sits under the chip. In C6 the
 * dial leaves a column on the right for the claim, which leads into the lit
 * band from there.
 */
const DIAL_PAD_L = landscapePad({ l: 104, r: 104, t: 44, b: 40 }, { l: 92, r: 96, t: 30, b: 28 })
const CHIP_PAD_L = landscapePad({ l: 104, r: 116, t: 44, b: 40 }, { l: 80, r: 176, t: 32, b: 30 })
const HEDGE_PAD_L = landscapePad({ l: 96, r: 196, t: 44, b: 40 }, { l: 80, r: 184, t: 32, b: 30 })
/**
 * Portrait dial pads (px beyond the rim): the label bounds (8), the gap and
 * the widest name on each side: REL. over STRENGTH on the left (about 49),
 * BODY over FAT on the right (about 24), one line above (RESTING HR) and
 * below (TRIGLYC.).
 */
const DIAL_PAD_P: Pads = { l: 58, r: 32, t: 32, b: 32 }
/** C6: room under the dial for the "Preventive medicine" pill below TRIGLYC. */
const HEDGE_PAD_P: Pads = { ...DIAL_PAD_P, b: 76 }

export const DIAL_L: CamPose = { target: T0, az: 0, el: 0, fov: 28, fit: FLAT_BOX, padPx: DIAL_PAD_L }
/** C3 on a phone: the dial lands alone (the key arrives with its values in C4). */
export const DIAL_P: CamPose = { target: T0, az: 0, el: 0, fov: 28, fit: FLAT_BOX, padPx: DIAL_PAD_P }

/**
 * C4: the tilt that reveals the pit (az 0, el 24). The fit is the RIM: seen
 * from above, the pit's floor projects inside the rim's ellipse, so fitting
 * the bowl's whole depth box only shrank the dial.
 */
export const TILT_L: CamPose = { target: [0, 0, -0.4], az: 0, el: 24, fov: 28, fit: FLAT_BOX, padPx: CHIP_PAD_L }
export const TILT_P: CamPose = { target: [0, 0, -0.4], az: 0, el: 24, fov: 28, fit: FLAT_BOX, padPx: padWithKey(DIAL_PAD_P) }

/** C5: back toward front-on for the comparison (el 8); the pit still reads faintly. */
export const NEAR_L: CamPose = { target: [0, 0, -0.2], az: 0, el: 8, fov: 28, fit: FLAT_BOX, padPx: CHIP_PAD_L }
export const NEAR_P: CamPose = { target: [0, 0, -0.2], az: 0, el: 8, fov: 28, fit: FLAT_BOX, padPx: padWithKey(DIAL_PAD_P) }
/** C6: the same view, with room for the claim (under the dial on a phone, right of it on landscape). */
export const HEDGE_L: CamPose = { ...NEAR_L, padPx: HEDGE_PAD_L }
export const HEDGE_P: CamPose = { ...NEAR_P, padPx: padWithKey(HEDGE_PAD_P) }

/** Explore: slightly above, so the bowl reads while the dots are dragged; the pads hold the spoke names (and, on landscape, the HUD chip). */
const EX_PAD_L = landscapePad({ l: 100, r: 104, t: 40, b: 36 }, { l: 80, r: 176, t: 30, b: 28 })
const EX_PAD_P: Pads = { l: 56, r: 30, t: 28, b: 20 }
export const EXPLORE_L: CamPose = { target: [0, 0, -0.4], az: 0, el: 12, fov: 28, fit: (_l, f) => f.box, padPx: EX_PAD_L }
export const EXPLORE_P: CamPose = { target: [0, 0, -0.4], az: 0, el: 12, fov: 28, fit: (_l, f) => f.box, padPx: padWithKey(EX_PAD_P) }
