import type { StoryDef } from '../../story/types'
import ContinuumScene from './Scene'
import ContinuumExplore from './Explore'
import ContinuumHud from './Hud'
import { DIAL_FRAME, DIAL_L, DIAL_P, EXPLORE_L, EXPLORE_P, FAN_L, FAN_P, HEDGE_L, HEDGE_P, LINE, NEAR_L, NEAR_P, ROWS_L, ROWS_P, TILT_L, TILT_P } from './layout'
import { ATHLETE, AVERAGE } from './continuumMath'
import { useContExplore } from './exploreStore'
import { clearSpoke } from './keySel'
import { B, MORPH_A, MORPH_B, T_SWAP } from './timeline'

/** The C5 impact accent fires as the score crosses into FIT (the word rises there), never at a typed time. */
const IMPACT_A = T_SWAP - B.sup

/* =========================================================================
   05 CONTINUUM: "From one line to the dial" (DESIGN.md D.6). Beat copy lives
   here so a reviewer can check every `source` against fitnessData.ts.
   Titles <= 30 characters, bodies <= 140, no new facts, numbers or quotes.
   Colour-linked terms paint sickness, wellness and fitness (and the worked
   examples) in the continuum's own colours, the same as the scene.

   Camera: the rows and the dial are read front-on (L12). C0 to C2 frame
   the one line at the centre of the table to come; the C3 camera widens to
   all ten rows, holds the table, frames the swept fan (the table joined
   with the rim) as the morph begins and lands on the dial; C4 tilts (el
   24) to reveal the pit (L6, a new dimension); C5 and C6 return toward
   front-on (el 8) for the comparison, and C6 leaves a slot under the dial
   for its claim in one move.
   ========================================================================= */

export const continuumStory: StoryDef = {
  key: 'continuum',
  beats: [
    {
      id: 'one-line',
      title: 'One continuum',
      body: 'Nearly every measurable value of health sits on one continuum, from sickness, through wellness, to fitness.',
      source: 'MODULE_COPY.continuum.body s1',
      terms: { sickness: 'sick', wellness: 'well', fitness: 'fit' },
      build: 4.0,
      cam: { L: LINE },
    },
    {
      id: 'bp',
      title: 'Blood pressure',
      body: 'A blood pressure of 160/95 is pathological, 120/70 is healthy, and 105/55 is an athlete.',
      source: 'MODULE_COPY.continuum.body s2',
      terms: { '160/95': 'sick', '120/70': 'well', '105/55': 'fit' },
      build: 4.5,
      // the bead's last reading lands at the end of the build
      sceneWords: 2,
      cam: { L: LINE },
    },
    {
      id: 'bodyfat',
      title: 'Body fat',
      body: 'Body fat: 40 percent is pathological, 20 percent is healthy, 10 percent is fit.',
      source: 'CONTINUUM_EXAMPLES[1]',
      terms: { '40 percent': 'sick', '20 percent': 'well', '10 percent': 'fit' },
      build: 4.0,
      // "10%" and "LOWER IS BETTER"
      sceneWords: 4,
      cam: { L: LINE },
    },
    {
      id: 'dial',
      title: 'Dozens of markers',
      body: 'The same ordering holds for bone density, triglycerides, HDL, and dozens more. Center is sickness, the rim is fitness.',
      source: 'CONTINUUM_EXAMPLES[2] + ContinuumModule.note',
      terms: { sickness: 'sick', fitness: 'fit' },
      // the table holds about two seconds of readable values before the morph
      build: 7.5,
      // the signature beat (A.3): the ten spoke names, WELL, FIT, SICKNESS and FITNESS are read in the finished dial
      signature: true,
      sceneWords: 15,
      cam: {
        L: DIAL_L,
        P: DIAL_P,
        window: [0, MORPH_B],
        keys: [
          { t: 0.28, L: ROWS_L, P: ROWS_P },
          { t: MORPH_A, L: ROWS_L, P: ROWS_P },
          { t: MORPH_A + 0.1, L: FAN_L, P: FAN_P },
        ],
      },
    },
    {
      id: 'well',
      title: 'Wellness is the midpoint',
      body: 'Wellness is the midpoint, not the goal.',
      source: 'MODULE_COPY.continuum.keyPoints[1]',
      terms: { Wellness: 'well' },
      build: 4.5,
      // the tilt, the state word, the score and the ten values landing (the second half of the signature, A.3)
      sceneWords: 8,
      cam: { L: TILT_L, P: TILT_P, window: [0, 0.32] },
    },
    {
      id: 'super',
      title: 'Fitness is super-wellness',
      body: 'Sickness, wellness, and fitness are measures of the same thing, so fitness is super-wellness.',
      source: 'MODULE_COPY.continuum.body s4',
      terms: { Sickness: 'sick', wellness: 'well', fitness: 'fit', 'super-wellness': 'fit' },
      build: 5.0,
      // the new state word, the score and the values
      sceneWords: 6,
      cam: { L: NEAR_L, P: NEAR_P, window: [0, 0.3] },
      impact: [IMPACT_A, IMPACT_A + 0.12],
    },
    {
      id: 'hedge',
      title: 'Preventive medicine',
      body: 'Fitness pushes every marker as far from sickness as it goes. Pursuing it is a hedge against disease.',
      source: 'MODULE_COPY.continuum.keyPoints[2] + keyPoints[3]',
      terms: { Fitness: 'fit', sickness: 'sick' },
      build: 4.5,
      // "Preventive medicine" on the lit band
      sceneWords: 3,
      cam: { L: HEDGE_L, P: HEDGE_P },
    },
  ],
  Scene: ContinuumScene,
  Explore: ContinuumExplore,
  Hud: ContinuumHud,
  frame: DIAL_FRAME,
  explore: {
    cam: { L: EXPLORE_L, P: EXPLORE_P },
    limits: { az: [-25, 25], el: [-5, 35], zoom: [0.7, 1.5] },
    initFromBeat(i) {
      const s = useContExplore.getState()
      s.setProfile(i >= 5 ? ATHLETE.name : AVERAGE.name)
      clearSpoke()
    },
  },
}

export default continuumStory
