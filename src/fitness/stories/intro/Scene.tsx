import { useEffect } from 'react'
import { useStoryStore } from '../../story/store'
import { useLayout } from '../../story/useBeat'
import { useSafeFrame } from '../../story/useSafeFrame'
import { backdropState } from '../../story/kit/Backdrop'
import { bumpObstacles } from '../../story/labels/useLabel'
import { layoutOf } from './layout'
import { END_T, exploreTime, glowUp } from './timeline'
import { Title } from './Title'
import { TheLine } from './Line'
import { Chart, useChartLabels } from './Chart'
import { Lifetime, useLifetimeLabels } from './Lifetime'
import { TheMap } from './Map'

/* =========================================================================
   INTRO, "The Line" (DESIGN.md D.1). Five beats, every property a pure
   function of story time T:
     I0 the Anton title rises; a hot pen draws its underline;
     I1 the line lifts off and becomes, in turn, the Skills decagon, the
        Hopper drum, the three Energy humps and the Continuum dial, each
        redrawn in its own ink, named as it closes, then docked in a row;
     I2 two axes, the Generalist power curve, light sweeping in under it,
        and the claim AREA = FITNESS;
     I3 the area extrudes back through every age into a lit lifetime
        landscape: HEALTH;
     I4 everything folds into the six-tile map of the lesson.

   Prewarm (README): every element of every beat is mounted at load and
   driven by T, so no shader links mid-story. Explore shows the same map
   (the tiles stay tappable) through the explore time in timeline.ts.
   ========================================================================= */

/** Explore time: fast-forward from the beat the viewer left to the finished map (beats per second). */
const FF_RATE = 2.4

function ExploreClock() {
  useSafeFrame(
    'intro explore time',
    (T, _A, dt) => {
      const st = useStoryStore.getState()
      const on = st.mode === 'explore'
      if (on && !exploreTime.on) exploreTime.T = st.reduced ? END_T : Math.min(END_T, Math.max(exploreTime.T, 0))
      exploreTime.on = on
      if (!on) {
        // the next entry starts from the story's current time
        exploreTime.T = T
        return
      }
      if (exploreTime.T < END_T) {
        exploreTime.T = st.reduced ? END_T : Math.min(END_T, exploreTime.T + Math.min(0.1, dt) * FF_RATE)
        // labels and hotspots follow the explore time, which moves without T
        bumpObstacles()
      }
    },
    // before the labels (-80), hotspots (-79) and every kit element (0) read it
    { priority: -85 },
  )
  useEffect(
    () => () => {
      exploreTime.on = false
      exploreTime.T = END_T
    },
    [],
  )
  return null
}

/** I0: the slate's glow brightens by 10% as the line lands (B.9 backdrop boost). */
function SlateGlow() {
  useSafeFrame('intro slate glow', (T) => {
    backdropState.boost = 1 + 0.1 * glowUp(T)
  })
  useEffect(
    () => () => {
      backdropState.boost = 1
    },
    [],
  )
  return null
}

function Labels({ layout }: { layout: 'P' | 'L' }) {
  const L = layoutOf(layout)
  useChartLabels(L)
  useLifetimeLabels(L)
  return null
}

export default function IntroScene() {
  const layout = useLayout()
  const tier = useStoryStore((s) => s.tier)
  const L = layoutOf(layout)
  return (
    <>
      <ExploreClock />
      <SlateGlow />
      <Labels layout={layout} />
      <Title L={L} />
      <TheLine L={L} />
      <Chart L={L} tier={tier} />
      <Lifetime L={L} />
      <TheMap L={L} />
    </>
  )
}
