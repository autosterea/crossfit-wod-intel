import type { Box, CamPose, Layout, StoryDef } from '../../story/types'
import IntroScene from './Scene'
import IntroExplore from './Explore'
import { boxCenter, layoutOf } from './layout'

/* =========================================================================
   INTRO (/fitness): "The Line" (DESIGN.md D.1). Beat copy lives here so a
   reviewer can check every `source` against fitnessData.ts and the module
   string table. Titles <= 30 characters, bodies <= 140, no new facts,
   numbers or quotes.

   Camera: front-on and telephoto for everything read as a flat picture
   (I0, I1, I2, I4: L12), a decisive oblique only where depth is the point
   (I3 reveals age: P az -14 el 38, L az -32 el 26, L6).
   ========================================================================= */

type Key = 'i0' | 'i1' | 'i2' | 'i3' | 'i4'
const fitOf = (k: Key) => (l: Layout): Box => layoutOf(l).boxes[k]
const targetOf = (k: Key) => (l: Layout) => boxCenter(layoutOf(l).boxes[k])

const front = (k: Key, padP: CamPose['padPx'], padL: CamPose['padPx'], fov = 26): { L: CamPose; P: CamPose } => ({
  L: { target: targetOf(k), az: 0, el: 0, fov, fit: fitOf(k), padPx: padL },
  P: { target: targetOf(k), az: 0, el: 0, fov, fit: fitOf(k), padPx: padP },
})

const I0 = front('i0', { l: 16, r: 16, t: 24, b: 64 }, 32)
// the bottom pads hold the docked row's name band (17 px label, 6 px gap, 8 px inset)
const I1 = front('i1', { l: 10, r: 10, t: 12, b: 36 }, { l: 28, r: 28, t: 28, b: 44 })
const I2 = front('i2', { l: 12, r: 12, t: 14, b: 36 }, { l: 28, r: 28, t: 28, b: 44 })
const I4 = front('i4', { l: 8, r: 8, t: 10, b: 8 }, 24)
const I3 = {
  L: { target: targetOf('i3'), az: -32, el: 30, fov: 30, fit: fitOf('i3'), padPx: { l: 28, r: 28, t: 24, b: 24 } },
  P: { target: targetOf('i3'), az: -14, el: 42, fov: 30, fit: fitOf('i3'), padPx: { l: 10, r: 10, t: 14, b: 10 } },
}

export const introStory: StoryDef = {
  key: 'intro',
  beats: [
    {
      id: 'title',
      title: 'What is fitness?',
      body: 'Greg Glassman set out to do what he argued no authority had bothered to do: give a clear, usable, measurable definition of fitness.',
      source: 'INTRO_TEXT s1 (para)',
      eyebrow: 'CrossFit Journal, October 2002',
      build: 4.0,
      cam: { L: I0.L, P: I0.P },
    },
    {
      id: 'models',
      title: 'Four models',
      body: 'He built it from four complementary models and one definition.',
      source: 'INTRO_TEXT s2 (para)',
      build: 8.0,
      // the four names ride into the docked row (H.40)
      sceneWords: 5,
      cam: { L: I1.L, P: I1.P, window: [0, 0.3] },
    },
    {
      id: 'definition',
      title: 'One definition',
      body: 'Work capacity across broad time and modal domains. Plot power against duration; the area under the curve is your fitness.',
      source: 'DEFINITION_TEXT s1 to s2 (para)',
      build: 5.5,
      // AREA = FITNESS and the two axis titles
      sceneWords: 6,
      cam: { L: I2.L, P: I2.P, window: [0, 0.3] },
    },
    {
      id: 'lifetime',
      title: 'Held for a lifetime',
      body: 'Sustain that capacity across a lifetime and it is health: the volume you keep under the curve.',
      source: 'INTRO_TEXT last clause + MODULES[5].blurb (para)',
      build: 5.0,
      sceneWords: 2,
      cam: { L: I3.L, P: I3.P, window: [0, 0.62] },
    },
    {
      id: 'map',
      title: 'Six interactive models',
      body: 'This lesson walks through each model as presented in the article and the official Level 1 Training Guide.',
      source: 'INTRO_TEXT s3 (para) + IntroView.gridTitle',
      build: 5.0,
      // the six tile names; the signature frame of the intro (A.3)
      sceneWords: 8,
      signature: true,
      cta: 'begin',
      // front-on early, so the glyphs fly into the grid undistorted
      cam: { L: I4.L, P: I4.P, window: [0, 0.24] },
    },
  ],
  Scene: IntroScene,
  Explore: IntroExplore,
  explore: {
    cam: { L: I4.L, P: I4.P },
    limits: { az: [-20, 20], el: [-5, 25], zoom: [0.7, 1.4] },
    initFromBeat() {
      /* the map is shown from any beat (timeline.ts explore time) */
    },
  },
}

export default introStory
