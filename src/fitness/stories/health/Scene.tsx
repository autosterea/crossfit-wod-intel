import { useDragHandle } from '../../story/gestures'
import { useQAProbe } from '../../story/qa'
import { sampleGrid } from './healthMath'
import { useWorld, xOf, zOfAge, type World } from './layout'
import { HS, useHealthState } from './state'
import { pickAge } from './pick'
import { useHealthExplore } from './exploreStore'
import { useHealthExploreLabels, useHealthLabels } from './labels'
import { BelowLine, GhostOutline, IndependencePlane, IsoGhost, Sheet, SolidOutline, Surface, Walls } from './landscape'
import { AgeSlice, AgeThirty, Axes, FloorClaim, FloorFrame, Scanner, Slices } from './elements'

/* =========================================================================
   06 HEALTH, "Stack every age" (DESIGN.md D.7). Seven beats, every property
   a pure function of story time T (timeline.ts):
     L0 slice     one fitness curve, the age-30 slice, front-on (a callback
                  to chapter 04): axes, the pen, the area sweeping in;
     L1 stack     the camera rises to reveal age, the slices are dealt in at
                  their own ages and fuse into one landscape;
     L2 volume    the landscape steps aside to its isolines and light pours
                  in under it from the floor up (the signature material
                  moment); the HUD counts the running integral;
     L3 line      the independence plane rises into place, its crisp edge;
     L4 sink      stop training: the landscape sinks toward the line, the
                  power ridge first, and the red below-line tint spreads;
     L5 any-age   the scanner sweeps from 45 and the landscape lifts behind
                  it like a wave (the signature beat);
     L6 hold      back to the lifelong landscape over the Sedentary ghost,
                  the amber age slice riding from 20 to 85.
   One scene serves story and explore: state.ts writes the chapter state
   from T (story) or damps it toward the explore store (explore), and every
   element renders from it. Everything is mounted at load (prewarm).
   ========================================================================= */

function useSliceHandle(W: World) {
  useDragHandle({
    id: 'health-age',
    anchor: () => [xOf(0.3, W.XW), sampleGrid(HS.grid, 0.3, HS.sliceAge) * W.YS + 0.06, zOfAge(HS.sliceAge)],
    radiusPx: 26,
    onDrag(ray) {
      const a = pickAge(ray)
      if (a !== null) useHealthExplore.getState().setAge(a)
    },
  })
}

export default function HealthScene() {
  useHealthState()
  const W = useWorld()
  useHealthLabels(W)
  useHealthExploreLabels(W)
  useSliceHandle(W)
  // QA: the displayed landscape's corners (heights) and the scanner / slice ages
  useQAProbe('health-state', () => ({
    world: W.key,
    front: [HS.grid[0], HS.grid[55]],
    scanAge: HS.scanAge,
    sliceAge: HS.sliceAge,
    level: HS.level,
  }))
  return (
    <>
      <Axes W={W} />
      <FloorFrame W={W} />
      <AgeThirty W={W} />
      <Slices W={W} />
      <Walls W={W} />
      <BelowLine W={W} />
      <Sheet W={W} />
      <Surface W={W} />
      <IsoGhost W={W} />
      <GhostOutline W={W} />
      <SolidOutline W={W} />
      <IndependencePlane W={W} />
      <Scanner W={W} />
      <AgeSlice W={W} />
      <FloorClaim W={W} />
    </>
  )
}
