import type { Box, CamPose, Layout, StoryDef, V3 } from '../../story/types'
import SkillsScene from './Scene'
import SkillsExplore from './Explore'
import { DEPTH, EX_DEPTH, SOLID_BOX, WHEEL_BOX, WHEEL_PAD, grid } from './layout'
import { GENERALIST, POWERLIFTER } from './skillsMath'
import { NONE, useSkExplore } from './exploreStore'

/* =========================================================================
   01 SKILLS: "Ten spokes, one floor" (DESIGN.md D.2). Beat copy lives here
   so a reviewer can check every `source` against fitnessData.ts. Titles
   <= 30 characters, bodies <= 140, no new facts, numbers or quotes.

   Camera: the wheel is read front-on (L12) with its label ring in the
   padding; S3 tilts decisively enough to show the prism's depth (L6: the
   camera reveals a new dimension) and S4 returns front-on for the
   comparison; S5 frames the grid of thirteen.
   ========================================================================= */

const WHEEL_T: V3 = [0, 0, 0.15]
const center = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]

/** The flat wheel, front-on (S0 to S2, S4). */
const FRONT_L: CamPose = { target: WHEEL_T, az: 0, el: 0, fov: 30, fit: WHEEL_BOX, padPx: WHEEL_PAD.L }
const FRONT_P: CamPose = { ...FRONT_L, padPx: WHEEL_PAD.P }
/**
 * S3: reveal the solid. D.2 gives L az -10 el 16 and P az -8 el 14; that
 * tilt reads as a mistake and shows no depth (README "Camera poses": depth
 * is the point, so 15 degrees or more). Proposed amendment: L -18 / 22,
 * P -16 / 20.
 */
const SOLID_L: CamPose = { ...FRONT_L, target: [0, 0, DEPTH / 2], fit: SOLID_BOX, az: -18, el: 22 }
const SOLID_P: CamPose = { ...SOLID_L, padPx: WHEEL_PAD.P, az: -16, el: 20 }
/** S5: the grid of thirteen, with its name rows; the top pad leaves room for the pinned key. */
const GRID: CamPose = {
  target: (l: Layout) => center(grid(l).box),
  az: 0,
  el: 0,
  fov: 30,
  fit: (l: Layout) => grid(l).box,
  padPx: { l: 16, r: 16, t: 40, b: 12 },
}
/**
 * Explore: the wheel with its name ring inside the fit (so one padding
 * serves both views), or the grid. The director re-fits every frame, so the
 * Wheel | Grid toggle glides between them.
 */
const LABEL_ROOM = 3.1
const EX_WHEEL: Box = [
  [-10 - LABEL_ROOM, -10 - LABEL_ROOM, 0],
  [10 + LABEL_ROOM, 10 + LABEL_ROOM, EX_DEPTH],
]
const EXPLORE: CamPose = {
  target: (l: Layout) => (useSkExplore.getState().view === 'grid' ? center(grid(l).box) : WHEEL_T),
  az: 0,
  el: 0,
  fov: 30,
  fit: (l: Layout) => (useSkExplore.getState().view === 'grid' ? grid(l).box : EX_WHEEL),
  padPx: { l: 14, r: 14, t: 40, b: 14 },
}

export const skillsStory: StoryDef = {
  key: 'skills',
  beats: [
    {
      id: 'ten',
      title: 'Ten physical skills',
      body: 'CrossFit\'s first model: there are ten general physical skills, and you are as fit as you are competent in each.',
      source: 'MODULE_COPY.skills.body s1',
      build: 5.0,
      cam: { L: FRONT_L, P: FRONT_P },
    },
    {
      id: 'trained-practiced',
      title: 'Trained or practiced',
      body: 'Four skills respond to training, an organic change in the body. Four respond to practice, a change in the nervous system.',
      terms: { training: 'trained', practice: 'practiced' },
      source: 'MODULE_COPY.skills.body s3',
      build: 5.0,
      // the two callouts, read in the finished frame
      sceneWords: 4,
      cam: { L: FRONT_L, P: FRONT_P },
    },
    {
      id: 'both',
      title: 'Power and speed: both',
      body: 'Power and speed come from both training and practice.',
      terms: { both: 'both', training: 'trained', practice: 'practiced' },
      source: 'MODULE_COPY.skills.keyPoints[2]',
      build: 3.5,
      // "Both" and the three-line class key
      sceneWords: 6,
      cam: { L: FRONT_L, P: FRONT_P },
      impact: [0.55, 0.67],
    },
    {
      id: 'generalist',
      title: 'The balanced shape',
      body: 'Broadly excellent. The most balanced shape on the wheel, with no peaks and no gaps.',
      source: 'fitnessData.ARCHETYPES[0].blurb',
      build: 4.5,
      // "Weakest skill 7" and the athlete key
      sceneWords: 5,
      cam: { L: SOLID_L, P: SOLID_P, window: [0, 0.45] },
    },
    {
      id: 'specialist',
      title: 'Peaks and gaps',
      body: 'The powerlifter: maximal strength, little metabolic demand. You are only as fit as you are competent across all ten.',
      source: 'fitnessData.ARCHETYPES[2].blurb + MODULE_COPY.skills.keyPoints[3]',
      build: 5.0,
      // the signature moment (A.3): the floor ring collapses from 7 to 2
      signature: true,
      sceneWords: 5,
      cam: { L: FRONT_L, P: FRONT_P, window: [0, 0.3] },
    },
    {
      id: 'thirteen',
      title: 'Thirteen athletes',
      body: 'A balanced athlete against twelve specialists. A program develops fitness to the extent it improves all ten.',
      source: 'MODULES[0].blurb s2 + MODULE_COPY.skills.body s2',
      build: 5.5,
      // thirteen names and the sort key
      sceneWords: 17,
      cam: { L: GRID, window: [0, 0.35] },
    },
  ],
  Scene: SkillsScene,
  Explore: SkillsExplore,
  explore: {
    cam: { L: EXPLORE },
    limits: { az: [-50, 50], el: [0, 50], zoom: [0.8, 1.4] },
    initFromBeat(i) {
      const s = useSkExplore.getState()
      s.setAthlete(GENERALIST.name)
      s.setCompare(i === 4 ? POWERLIFTER.name : NONE)
      s.setView(i >= 5 ? 'grid' : 'wheel')
      s.setInfo(null)
      s.bumpEnter()
    },
  },
}

export default skillsStory
