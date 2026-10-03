import { useStoryStore } from '../../story/store'
import { useChapterChart } from '../../story/kit/chartFrame'
import { Lanes } from './Lanes'
import { Vectors } from './Vectors'
import { Terms } from './Terms'
import { Graph } from './Graph'
import { Lifters } from './Lifters'
import { Charter } from './Charter'
import { Plane } from './Plane'
import { Claim } from './Claim'
import ExploreScene from './ExploreScene'

/* =========================================================================
   08 TECHNIQUE, Glassman's essay in ten beats (STORYBOARD-technique.md):
     T0 three tests of a program (lanes: return, rate, finish line);
     T1 they point one way but trade off (three vectors);
     T2 measuring work makes how you move matter (the four terms);
     T3 the graph that defines technique (Figure 1);
     T4 what a deviation is (the clean against the rounded-back pull);
     T5 the charter (a timeline: intensity only after mechanics and consistency);
     T6 speed is not the enemy (a plane, the either-or line an illusion);
     T7 threshold training (the learning path, the athlete at its speed);
     T8 the worked example in the article's numbers (signature);
     T9 technique is everything (Figure 1 again, the SDF claim).
   One chart frame and one front-on camera for every beat (no pans). Prewarm
   (README): every element of every beat, and the explore layer, is mounted
   at load and hidden by T or mode, so no shader links mid-story.
   ========================================================================= */

export default function TechniqueScene() {
  const f = useChapterChart()
  const mode = useStoryStore((s) => s.mode)
  return (
    <>
      <group visible={mode === 'story'}>
        <Lanes f={f} />
        <Vectors f={f} />
        <Terms f={f} />
        <Graph f={f} />
        <Lifters f={f} />
        <Charter f={f} />
        <Plane f={f} />
        <Claim f={f} />
      </group>
      <group visible={mode === 'explore'}>
        <ExploreScene f={f} />
      </group>
    </>
  )
}
