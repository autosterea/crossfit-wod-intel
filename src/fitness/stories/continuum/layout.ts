import type { ChartFrame, ChartFrameOpts } from '../../story/kit/chartFrame'
import { frameFor } from '../../story/kit/chartFrame'
import { focusRect } from '../../story/camera/focusRect'
import { ease } from '../../story/ease'
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
   spoke; the line, its ticks and its name all ride it. The sickness end
   slides straight to the hub while the fitness end travels ROUND the dial
   centre (its angle from the table's to the spoke's, its radius to R
   early), so the fan never sweeps outside the dial and the tips keep their
   order: each name rides a tip that never crosses another.

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
/** Spoke angle in radians, LITERAL (unwrapped): 90, 54, 18, ... -234 degrees. The morph turns each tip by k times its sweep, so the rows open like a fan without crossing. */
export const spokeAngle = (i: number): number => (90 - 36 * i) * DEG

export const ROWS_FRAME: ChartFrameOpts = { FH: 11, minAspect: 0.9, maxAspect: 1.6, marginPx: { l: 24, r: 24, t: 30, b: 28 } }
export const ROW_GAP = 1.1
/** World y of row i (the rows chart is centred on the dial centre). */
export const rowY = (i: number): number => ROWS_FRAME.FH / 2 - ROW_GAP * (i + 0.5)
/** The station columns' headers sit a little above the first row of the table to come. */
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
 * Row i (at height y in the parallel phase) at morph k. The sickness end
 * slides to the hub (in the first half, so the table's left edge gathers
 * into the centre); the fitness end travels round the dial centre, from the
 * table's tip (its angle and radius as seen from the centre) to the spoke
 * tip at R. The angle turns by k (literal spoke angles, so the rows open
 * like a fan and the tips never cross); the radius reaches R in the first
 * half of the morph (a wide table never swings outside the rim). The row is
 * the segment between its two ends, so every station u on it (ticks,
 * columns) lands on its ring at k = 1. The column connectors also call it
 * with a fractional i. `g` is the gathering of the sickness ends: ONE
 * progress for every row (the fan's sweep may lead row by row, the table's
 * left edge gathers as one).
 */
export function rowXf(i: number, k: number, f: ChartFrame, y: number, out: RowXf, g = k): RowXf {
  const phi = spokeAngle(i)
  out.k = k
  // the sickness ends gather at the hub first, so the rows then open round it like a fan
  const ko = ease.settle(Math.min(1, g / 0.45))
  const ox = f.x(0) + (HUB * Math.cos(phi) - f.x(0)) * ko
  const oy = y + (HUB * Math.sin(phi) - y) * ko
  const tx = f.x(1)
  const a0 = Math.atan2(y, tx)
  const r0 = Math.hypot(tx, y)
  const a = a0 + (phi - a0) * k
  const r = r0 + (R - r0) * ease.settle(Math.min(1, 2 * k))
  const dx = r * Math.cos(a) - ox
  const dy = r * Math.sin(a) - oy
  const len = Math.hypot(dx, dy)
  out.ox = ox
  out.oy = oy
  out.len = len
  out.c = len > 1e-9 ? dx / len : 1
  out.s = len > 1e-9 ? dy / len : 0
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
 * on a portrait phone or tablet, a label obstacle. The poses reserve room
 * for it by BEAT, not by its live height: C4, C5 and explore reserve the
 * whole key (`full`, measured by the key); C6 reserves its header row
 * (`folded`: the key folds to it as C6 begins) plus `cta`, the room the
 * caption card's CTA row is about to take (Scene keeps it in step with the
 * director's eased focus rect). So the C6 camera makes ONE move from the C5
 * frame to the finished frame: no bob as the key folds, no jump when the
 * CTA row appears. `hidden` is set while the caption card or the explore
 * sheet is expanded.
 */
export const keyState = { full: 136, folded: 26, hidden: false, gap: 28, cta: 0 }

/** True where the key replaces the spoke-tip values: portrait phone or tablet. */
export const keyMode = (): boolean => focusRect.layout === 'P' && (focusRect.shell === 'phone' || focusRect.shell === 'tablet')

const reserveFull = (): number => (keyMode() && !keyState.hidden ? keyState.full + keyState.gap : 0)
const reserveFolded = (): number => (keyMode() ? (keyState.hidden ? 0 : keyState.folded + keyState.gap) + keyState.cta : 0)

type Pads = { l: number; r: number; t: number; b: number }
/** A pad object read by the director every frame: the base pads plus a reserve at the bottom. */
function padWith(base: Pads, reserve: () => number) {
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
      return base.b + reserve()
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
/**
 * C3 morph: the swept fan. The sickness ends travel inside the table and the
 * fitness ends round the centre at a radius that falls from the table's
 * corner to R in the first half of the morph, so every in-between frame
 * lies inside the table's box joined with the rim's (plus a margin for the
 * corner radius of a wide landscape table).
 */
export const fanBox = (l: Layout, f: ChartFrame): Box => {
  const r = rowsBox(l, f)
  const m = 0.5
  return [
    [Math.min(r[0][0], -R - m), Math.min(r[0][1], -R - m), 0],
    [Math.max(r[1][0], R + m), Math.max(r[1][1], R + m), 0],
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

/** C0 to C2 (both layouts): symmetric, so the line sits on the centre of the stage; inset so the end pills centre on their columns. */
const LINE_PAD = { l: 50, r: 50, t: 44, b: 14 }
export const LINE: CamPose = { target: (l, f) => center(lineBox(l, f)), az: 0, el: 0, fov: 28, fit: lineBox, padPx: LINE_PAD }
/**
 * C3 table: every name sits on its own row, right of its fitness end, so the
 * pad on the right holds the widest one-line name (REL. STRENGTH on
 * desktop; FLEXIBILITY on a phone, where the side names are two lines).
 */
export const ROWS_L: CamPose = { target: (l, f) => center(rowsBox(l, f)), az: 0, el: 0, fov: 28, fit: rowsBox, padPx: { l: 18, r: 122, t: 18, b: 22 } }
export const ROWS_P: CamPose = { ...ROWS_L, padPx: { l: 12, r: 78, t: 16, b: 20 } }

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
/** C3 mid-morph: the swept fan (the table joined with the rim), with the dial's name room. */
export const FAN_L: CamPose = { target: T0, az: 0, el: 0, fov: 28, fit: fanBox, padPx: DIAL_PAD_L }
export const FAN_P: CamPose = { target: T0, az: 0, el: 0, fov: 28, fit: fanBox, padPx: DIAL_PAD_P }

/**
 * C4: the tilt that reveals the pit (az 0, el 24). The fit is the RIM: seen
 * from above, the pit's floor projects inside the rim's ellipse, so fitting
 * the bowl's whole depth box only shrank the dial. On a phone the key
 * (with the pit's values) arrives with the tilt and fills the room under it.
 */
export const TILT_L: CamPose = { target: [0, 0, -0.4], az: 0, el: 24, fov: 28, fit: FLAT_BOX, padPx: CHIP_PAD_L }
export const TILT_P: CamPose = { target: [0, 0, -0.4], az: 0, el: 24, fov: 28, fit: FLAT_BOX, padPx: padWith(DIAL_PAD_P, reserveFull) }

/** C5: back toward front-on for the comparison (el 8); the pit still reads faintly. */
export const NEAR_L: CamPose = { target: [0, 0, -0.2], az: 0, el: 8, fov: 28, fit: FLAT_BOX, padPx: CHIP_PAD_L }
export const NEAR_P: CamPose = { target: [0, 0, -0.2], az: 0, el: 8, fov: 28, fit: FLAT_BOX, padPx: padWith(DIAL_PAD_P, reserveFull) }
/**
 * C6: the same view, with room for the claim (under the dial on a phone,
 * right of it on landscape). On a phone it is fitted to the FINISHED frame
 * from the first frame of the beat: the folded key and the card's CTA row.
 */
export const HEDGE_L: CamPose = { ...NEAR_L, padPx: HEDGE_PAD_L }
export const HEDGE_P: CamPose = { ...NEAR_P, padPx: padWith(HEDGE_PAD_P, reserveFolded) }

/** Explore: slightly above, so the bowl reads while the dots are dragged; the pads hold the spoke names (and, on landscape, the HUD chip). */
const EX_PAD_L = landscapePad({ l: 100, r: 104, t: 40, b: 36 }, { l: 80, r: 176, t: 30, b: 28 })
const EX_PAD_P: Pads = { l: 56, r: 30, t: 28, b: 20 }
export const EXPLORE_L: CamPose = { target: [0, 0, -0.4], az: 0, el: 12, fov: 28, fit: (_l, f) => f.box, padPx: EX_PAD_L }
export const EXPLORE_P: CamPose = { target: [0, 0, -0.4], az: 0, el: 12, fov: 28, fit: (_l, f) => f.box, padPx: padWith(EX_PAD_P, reserveFull) }
