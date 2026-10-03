import { useStoryStore } from '../../story/store'
import { useChartFrame } from '../../story/kit/chartFrame'
import { FRAME_OPTS, useKinds } from './layout'
import { Tiles } from './Tiles'
import { Pair, Swaps } from './Moves'
import { Chart } from './Chart'
import { StoryPyramid } from './Pyramid'
import ExploreScene from './ExploreScene'

/* =========================================================================
   07 CROSSFIT, "The prescription and the pyramid" (STORYBOARD-crossfit.md):
     C0 the three parts, each a before-and-after icon on a glass tile;
     C1 movements from life: standing up from a box, a crate off the ground;
     C2 the guide's three swaps, one joint against many;
     C3 Fran: the same work squeezed into less time is more power;
     C4 the margins of exposure, widened;
     C5 the hierarchy built from nutrition to sport;
     C6 a deficiency below, and everything above suffers (signature);
     C7 the 100 words, one line per level.
   Prewarm (README): every station, the explore pyramid included, is mounted
   at load and hidden by T or mode, so no shader links mid-story.
   ========================================================================= */

export default function CrossfitScene() {
  // the C3 and C4 chart's own frame (see story.ts CHART)
  const frame = useChartFrame(FRAME_OPTS)
  const mode = useStoryStore((s) => s.mode)
  const k = useKinds()
  return (
    <>
      <group visible={mode === 'story'}>
        <Tiles kind={k.tiles} />
        <Pair kind={k.pair} />
        <Swaps kind={k.table} />
        <Chart frame={frame} />
        <StoryPyramid layout={k.layout} />
      </group>
      <group visible={mode === 'explore'}>
        <ExploreScene layout={k.layout} />
      </group>
    </>
  )
}
