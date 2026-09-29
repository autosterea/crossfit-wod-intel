/* The explore layer's DISPLAYED state (DESIGN.md C.12): damped toward the
   explore store every frame by the explore scene, read by the explore
   elements, the HUD and the labels. A plain mutable object: no React state
   per frame. */

export const shown = {
  /** effort duration under the explore cursor, seconds (damped in log space) */
  t: 240,
  /** 0 stacked .. 1 lanes */
  m: 0,
  /** 0 power .. 1 share */
  s: 0,
  /** bumps whenever t, m or s moved this frame (cached writers) */
  version: 0,
}
