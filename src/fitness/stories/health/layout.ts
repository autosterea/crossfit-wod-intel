import { useSyncExternalStore } from 'react'
import { INDEPENDENCE_LINE } from '../../fitnessData'
import { map } from '../../lessonMath'
import { focusRect, subscribeFocus } from '../../story/camera/focusRect'
import type { Box } from '../../story/types'
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
   upright), where the landscape must fill a tall focus rect and its relief
   (the sink, the lift at 50) must read as height. The capacity axis has no
   numbers, so the aspect is a presentation choice; ages, heights relative
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
  /** 0 wide, 1 narrow (numeric cache keys) */
  id: number
}

export const WIDE: World = { XW: 8, YS: 10, key: 'wide', id: 0 }
export const NARROW: World = { XW: 4.4, YS: 16, key: 'narrow', id: 1 }

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
/**
 * The capacity axis: the post over "1 s" (the front-left corner), the chart's
 * y axis in L0 and the solid's own front-left edge from L1. The camera looks
 * from the front-RIGHT (the side the landscape faces: it falls from the power
 * ridge toward long durations), so the post stands against the slate and
 * CAPACITY sits over it, while the age ticks run up the right floor edge.
 * It reaches capacity 0.95 over the lifelong landscapes; over the lifted
 * "Starts at 50" landscape (L5, peak 0.38) the axis spans the data shown,
 * 0.52, so the frame holds the landscape rather than an empty axis.
 */
export const POST_CAP = 0.95
export const POST_CAP_LOW = 0.52
/** length of the age tick marks, outward from the right floor edge */
export const AGE_TICK = 0.42
/** top of the fitted slice box in L0 */
export const TOP_CAP = 0.97
export { INDEPENDENCE_LINE }

export const zOfAge = (age: number) => map(age, AGE_MIN, AGE_MAX, Z0, Z1)
export const ageOfZ = (z: number) => map(z, Z0, Z1, AGE_MIN, AGE_MAX)
export const xOf = (u: number, XW: number) => -XW + 2 * XW * u
export const uOfX = (x: number, XW: number) => (x + XW) / (2 * XW)

/** where the explore drag handle (and its knob) sits along the amber slice (duration u) */
export const HANDLE_U = 0.3

/** z of the L0 slice (age 30). */
export const Z30 = zOfAge(30)

/** L0: the age-30 slice, front-on (D.7 L0). */
export const sliceBox = (): Box => {
  const W = worldNow()
  return [
    [-W.XW, 0, Z30 - 0.5],
    [W.XW, TOP_CAP * W.YS, Z30 + 0.5],
  ]
}

/** The floor claim sits this far in front of the front edge (its centre line). */
export const FLOOR_TEXT_Z = 4.3
/** The claim's world size (Anton cap height): it spans 92% of the duration axis. */
export const claimSize = (W: World) => Math.min(1.9, (2 * W.XW * 0.92) / 7.2)
