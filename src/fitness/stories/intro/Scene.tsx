import { useEffect } from 'react'
import { useStoryStore } from '../../story/store'
import { useLayout } from '../../story/useBeat'
import { useSafeFrame } from '../../story/useSafeFrame'
import { backdropState } from '../../story/kit/Backdrop'
import { bumpObstacles } from '../../story/labels/useLabel'
import { layoutOf } from './layout'
import { BEAT, END_T, exploreTime, glowUp } from './timeline'
import { Title } from './Title'
import { TheLine } from './Line'
import { Chart, useChartLabels } from './Chart'
import { Lifetime, useLifetimeLabels } from './Lifetime'
import { TheMap } from './Map'

/* =========================================================================
   INTRO, "The Line" (DESIGN.md D.1). Five beats, every property a pure
   function of story time T:
     I0 the Anton title rises; a hot pen draws its underline;
     I1 the line lifts off and travels from cell to cell, becoming in turn
        the Skills decagon, the Hopper drum, the three Energy humps and the
        Continuum dial, each redrawn in its own ink and named as it closes:
        the beat rests on the four models, large and named;
     I2 the models dock in a row as two axes draw, the Generalist power
        curve, light sweeping in under it, and the claim AREA = FITNESS;
     I3 the area extrudes back through every age into a lit lifetime
        landscape: HEALTH;
     I4 everything folds into the six-tile map of the lesson: the chart
        and the surface fold into 04 and 06, the pen redraws the four
        models in 01, 02, 03 and 05, and the tiles light 4 then 6.

   Prewarm (README): every element of every beat is mounted at load and
   driven by T, so no shader links mid-story. Explore shows the same map
   (the tiles stay tappable) through the explore time in timeline.ts.
   ========================================================================= */

/** Explore time: the fold into the map plays at this rate on entry (beats per second). */
const FF_RATE = 2.4
/** Leaving explore, the scene runs back to the story's T in about the camera's glide (0.9 s). */
const REWIND_S = 0.8
/** Leaving explore, the scene rewinds continuously only when the story is within this many beats of the map. */
const REWIND_MAX = 1

/**
 * The explore clock, symmetric both ways. Entering explore CUTS to the start
 * of the fold (never earlier: a fast-forward through the title and the
 * models under the map pose reads as noise) and plays only the fold into the
 * six tiles. Leaving, when the story's T is within one beat of the map (the
 * lifetime beat or the map itself) the scene runs back to it while the
 * camera glides home; from any earlier beat it CUTS to the story's frame, so
 * a whole story never strobes past in reverse through the wrong camera.
 * Both are cuts under reduced motion. No per-frame state beyond this one
 * mutable record.
 */
const rewind = { rate: 0 }
function ExploreClock() {
  useSafeFrame(
    'intro explore time',
    (T, _A, dt) => {
      const st = useStoryStore.getState()
      const step = Math.min(0.1, dt)
      if (st.mode === 'explore') {
        if (!exploreTime.on) {
          exploreTime.on = true
          exploreTime.T = st.reduced ? END_T : Math.min(END_T, Math.max(T, BEAT.map))
          rewind.rate = 0
        }
        if (exploreTime.T < END_T) {
          exploreTime.T = st.reduced ? END_T : Math.min(END_T, exploreTime.T + step * FF_RATE)
          // labels and hotspots follow the explore time, which moves without T
          bumpObstacles()
        }
        return
      }
      if (!exploreTime.on) {
        exploreTime.T = T
        return
      }
      // back to story: run the scene back (or on) to the story's T, then hand over
      const gap = T - exploreTime.T
      if (st.reduced || Math.abs(gap) < 1e-4 || (rewind.rate === 0 && Math.abs(gap) > REWIND_MAX)) {
        exploreTime.on = false
        exploreTime.T = T
        bumpObstacles()
        return
      }
      if (rewind.rate === 0) rewind.rate = Math.max(FF_RATE, Math.abs(gap) / REWIND_S)
      const d = step * rewind.rate
      exploreTime.T = Math.abs(gap) <= d ? T : exploreTime.T + Math.sign(gap) * d
      if (exploreTime.T === T) {
        exploreTime.on = false
        rewind.rate = 0
      }
      bumpObstacles()
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
