import { useSyncExternalStore } from 'react'
import { INDEPENDENCE_LINE } from '../../fitnessData'
import { map } from '../../lessonMath'
import { focusRect, subscribeFocus } from '../../story/camera/focusRect'
import type { Box, V3 } from '../../story/types'
import { AGE_MAX, AGE_MIN } from './healthMath'

/* =========================================================================
   06 HEALTH world (DESIGN.md D.7). Y up. Duration u runs along x (left to
   right, L11), age runs INTO depth (z from +9 at age 20 to -9 at age 85),
   capacity is height (YS world units for capacity 1.0).

   Proportions (the B.13 idea applied to a 3D chart; proposed amendment in
   the chapter report). D.7's world (x from -10 to 10, YS 7.2) is 20 wide
   and 18 deep but at most 6.2 tall: seen from any elevation that shows
   age, its relief read as a shallow tray. The duration axis is narrower and
   the capacity scale taller, most of all on a portrait stage (a phone held
   upright), so the relief reads against the 18 units of depth and the
   solid fills the screen. Axes carry labels and
   isolines, so the aspect is a presentation choice; ages, heights relative
   to each other and every computed number are identical. The world follows
   the STAGE aspect, never the focus rect, so an explore sheet detent never
   reshapes the landscape.
   ========================================================================= */

export interface World {
  /** half-width of the duration axis (x from -XW to XW) */
  XW: number
  /** world height of capacity 1.0 */
  YS: number
  key: 'wide' | 'narrow'
}

export const WIDE: World = { XW: 8, YS: 9, key: 'wide' }
export const NARROW: World = { XW: 4.4, YS: 10, key: 'narrow' }

/** Portrait stage (a phone held upright): the narrow, tall landscape. */
export const narrowNow = (): boolean => focusRect.W / Math.max(1, focusRect.H) < 0.75
export const worldNow = (): World => (narrowNow() ? NARROW : WIDE)

/** The world for the current stage; re-renders only when it flips. */
export function useWorld(): World {
  return useSyncExternalStore(subscribeFocus, worldNow)
}

/** age 20 (front) and age 85 (back) */
export const Z0 = 9
export const Z1 = -9
/** how far the independence plane reaches past the footprint at the sides and the back */
export const PLANE_M = 0.5
/** its front edge lies just in front of the volume's front face */
export const PLANE_FRONT = 0.03
/** the capacity axis post at the front-left corner rises to capacity 0.95 */
export const POST_CAP = 0.95
/** top of the fitted slice box in L0: capacity 1.03 (D.7) */
export const TOP_CAP = 1.03
/**
 * Top of the fitted VOLUME boxes (L1 on). A box's top runs flat across every
 * age, and its back-top edge sets the top of the frame; at capacity 1.03 it
 * left a wide empty band over the landscape, whose back (age 85) never rises
 * above 0.64. The front peak and the capacity post project well below that
 * edge at these elevations, so nothing is cut.
 */
export const VOL_TOP_CAP = 0.66
export { INDEPENDENCE_LINE }

export const zOfAge = (age: number) => map(age, AGE_MIN, AGE_MAX, Z0, Z1)
export const ageOfZ = (z: number) => map(z, Z0, Z1, AGE_MIN, AGE_MAX)
export const xOf = (u: number, XW: number) => -XW + 2 * XW * u
export const uOfX = (x: number, XW: number) => (x + XW) / (2 * XW)

/** z of the L0 slice (age 30). */
export const Z30 = zOfAge(30)

/* ------------------------------ fitted boxes ------------------------------ */

/** L0: the age-30 slice, front-on (D.7 L0). */
export const sliceBox = (): Box => {
  const W = worldNow()
  return [
    [-W.XW, 0, Z30 - 0.5],
    [W.XW, TOP_CAP * W.YS, Z30 + 0.5],
  ]
}

/** L1 on: the volume [-XW, 0, -9]..[XW, 0.66 YS, 9]. */
export const volumeBox = (): Box => {
  const W = worldNow()
  return [
    [-W.XW, 0, Z1],
    [W.XW, VOL_TOP_CAP * W.YS, Z0],
  ]
}

/** L2: the volume plus the floor strip in front that carries the SDF claim. */
export const claimBox = (): Box => {
  const W = worldNow()
  return [
    [-W.XW, 0, Z1],
    [W.XW, VOL_TOP_CAP * W.YS, Z0 + FLOOR_TEXT_Z + 0.9],
  ]
}

/** L3 on: the volume plus the independence plane's margin. */
export const planeBox = (): Box => {
  const W = worldNow()
  return [
    [-W.XW - PLANE_M, 0, Z1 - PLANE_M],
    [W.XW + PLANE_M, VOL_TOP_CAP * W.YS, Z0],
  ]
}

export const centerOf = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]

/** The floor claim sits this far in front of the front edge (its centre line). */
export const FLOOR_TEXT_Z = 2.6
