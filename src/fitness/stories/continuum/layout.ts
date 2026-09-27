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
   -Z by 1.4 (1 - r / R)^2 (the bowl): sickness is a pit, invisible front-on
   and revealed by the C4 tilt.

   ONE per-row transform (origin, angle, length) morphs a row into its
   spoke; the line, its ticks and its labels all ride it.
   ========================================================================= */

export const R = 7
export const HUB = 0.6
/**
 * Bowl depth (amendment, see known issues): D.6 gives 1.4, which moves the
 * pit centre about 9 px on a phone at the C4 tilt, too little to read as a
 * pit. 3.2 keeps the same curve (1 - r / R)^2 and makes it read.
 */
export const DEPTH = 3.2
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

/** Label margins of the rows chart (px), also its camera pads. */
export const ROW_PAD = { l: 26, r: 34, t: 30, b: 28 } as const

export const ROWS_FRAME: ChartFrameOpts = { FH: 11, minAspect: 0.9, maxAspect: 1.6, marginPx: ROW_PAD }
export const ROW_GAP = 1.1
/** World y of row i (the rows chart is centred on the dial centre). */
export const rowY = (i: number): number => ROWS_FRAME.FH / 2 - ROW_GAP * (i + 0.5)

/**
 * The chapter's engine frame (StoryDef.frame) is the DIAL: a fixed square
 * (aspect clamped to 1) from -9 to 9, with the bowl's depth. The camera
 * poses of the dial beats and explore fit it, and __story.chartRect() reports
 * it, so the explore re-fit checks measure the dial itself.
 */
export const DIAL_EXTENT = 9
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
 * The portrait key (D.6 "Portrait key"): a DOM panel under the dial on a
 * portrait phone or tablet. Its measured height is reserved at the bottom of
 * every DIAL pose (the fit excludes it), and it is a label obstacle. The
 * reserve is part of the pose, not a focus inset, so the rows beats keep the
 * whole rect and the C3 camera glides from one to the other (continuity).
 * `h` is measured by the key itself; `hidden` is set while the caption card
 * or the explore sheet is expanded (the key steps aside).
 */
export const keyState = { h: 188, hidden: false, gap: 28 }

/** True where the key replaces the spoke-tip values: portrait phone or tablet. */
export const keyMode = (): boolean => focusRect.layout === 'P' && (focusRect.shell === 'phone' || focusRect.shell === 'tablet')

const keyReserve = (): number => (keyMode() && !keyState.hidden ? keyState.h + keyState.gap : 0)

/** A pad object whose bottom grows by the key reserve, read by the director every frame. */
function padWithKey(base: { l: number; r: number; t: number; b: number }) {
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

/** C0 / C1: the one line, with label lanes above (callouts) and below (ticks). */
export const lineBox = (_l: Layout, _f: ChartFrame): Box => {
  const f = rowsFrame()
  return [
    [f.x(0) - 0.4, -1.3, 0],
    [f.x(1) + 0.4, 1.5, 0],
  ]
}
/** C2: the two featured rows and their lanes. */
export const twoBox = (_l: Layout, _f: ChartFrame): Box => {
  const f = rowsFrame()
  return [
    [f.x(0) - 0.4, -Y_PAIR - 1.9, 0],
    [f.x(1) + 0.4, Y_PAIR + 0.9, 0],
  ]
}
/** C3 first half: all ten rows. */
export const rowsBox = (_l: Layout, _f: ChartFrame): Box => {
  const f = rowsFrame()
  return [
    [f.x(0), rowY(N - 1) - 0.3, 0],
    [f.x(1), rowY(0) + 0.55, 0],
  ]
}
const center = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]

/** The dial: the rim plus the tip ticks, and the bowl's depth for the tilted poses. */
export const DIAL_BOX: Box = [
  [-R - 0.25, -R - 0.25, -DEPTH],
  [R + 0.25, R + 0.25, 0.2],
]
const FLAT_BOX: Box = [
  [-R - 0.25, -R - 0.25, 0],
  [R + 0.25, R + 0.25, 0],
]

export const LINE: CamPose = { target: (l, f) => center(lineBox(l, f)), az: 0, el: 0, fov: 28, fit: lineBox, padPx: { l: 22, r: 40, t: 20, b: 20 } }
export const TWO: CamPose = { target: (l, f) => center(twoBox(l, f)), az: 0, el: 0, fov: 28, fit: twoBox, padPx: { l: 22, r: 30, t: 20, b: 20 } }
export const ROWS: CamPose = { target: (l, f) => center(rowsBox(l, f)), az: 0, el: 0, fov: 28, fit: rowsBox, padPx: { l: 12, r: 30, t: 22, b: 24 } }

/** A short landscape stage (a phone on its side): its focus rect is under 460 px tall. */
export const shortStage = (): boolean => focusRect.layout === 'L' && focusRect.h < 460

/**
 * Landscape dial pads: room for the spoke-tip names (the widest sit left and
 * right). On a short landscape stage the dial is height-limited, so it moves
 * left and leaves the top-right corner to the HUD chip (the SYSTOLIC BP name
 * sits right under it otherwise).
 */
function landscapePad(tall: { l: number; r: number; t: number; b: number }, short: { l: number; r: number; t: number; b: number }) {
  const pick = () => (shortStage() ? short : tall)
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
const DIAL_PAD_L = landscapePad({ l: 104, r: 104, t: 44, b: 40 }, { l: 96, r: 128, t: 30, b: 28 })
const DIAL_PAD_P = { l: 90, r: 62, t: 30, b: 26 }

export const DIAL_L: CamPose = { target: T0, az: 0, el: 0, fov: 28, fit: FLAT_BOX, padPx: DIAL_PAD_L }
export const DIAL_P: CamPose = { target: T0, az: 0, el: 0, fov: 28, fit: FLAT_BOX, padPx: padWithKey(DIAL_PAD_P) }

/** C4: the tilt that reveals the pit (az 0, el 24). */
export const TILT_L: CamPose = { target: [0, 0, -0.6], az: 0, el: 24, fov: 28, fit: DIAL_BOX, padPx: DIAL_PAD_L }
export const TILT_P: CamPose = { target: [0, 0, -0.6], az: 0, el: 24, fov: 28, fit: DIAL_BOX, padPx: padWithKey(DIAL_PAD_P) }

/** C5 / C6: back toward front-on for the comparison (el 8); the pit still reads faintly. */
export const NEAR_L: CamPose = { target: [0, 0, -0.3], az: 0, el: 8, fov: 28, fit: DIAL_BOX, padPx: DIAL_PAD_L }
export const NEAR_P: CamPose = { target: [0, 0, -0.3], az: 0, el: 8, fov: 28, fit: DIAL_BOX, padPx: padWithKey(DIAL_PAD_P) }

/** Explore: slightly above, so the bowl reads while the dots are dragged. */
const EX_PAD_L = landscapePad({ l: 40, r: 40, t: 16, b: 16 }, { l: 56, r: 96, t: 8, b: 8 })
const EX_PAD_P = { l: 66, r: 40, t: 8, b: 6 }
export const EXPLORE_L: CamPose = { target: [0, 0, -0.4], az: 0, el: 12, fov: 28, fit: (_l, f) => f.box, padPx: EX_PAD_L }
export const EXPLORE_P: CamPose = { target: [0, 0, -0.4], az: 0, el: 12, fov: 28, fit: (_l, f) => f.box, padPx: padWithKey(EX_PAD_P) }
