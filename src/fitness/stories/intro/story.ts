import type { Box, CamPose, Layout, StoryDef, V3 } from '../../story/types'
import IntroScene from './Scene'
import IntroExplore from './Explore'
import { BARLOW_BOLD, boxCenter, cx, cy, layoutOf, obliqueFit } from './layout'
import { NA, capAt } from './introMath'

/* =========================================================================
   INTRO (/fitness): "The Line" (DESIGN.md D.1). Beat copy lives here so a
   reviewer can check every `source` against fitnessData.ts and the module
   string table. Titles <= 30 characters, bodies <= 140, no new facts,
   numbers or quotes.

   Camera: front-on and telephoto for everything read as a flat picture
   (I0, I1, I2, I4: L12), a decisive oblique only where depth is the point
   (I3 reveals age, L6), framed on the solid itself (layout.obliqueFit).
   ========================================================================= */

type Key = 'i0' | 'i1' | 'i2' | 'i4'
const fitOf = (k: Key) => (l: Layout): Box => layoutOf(l).boxes[k]
const targetOf = (k: Key) => (l: Layout) => boxCenter(layoutOf(l).boxes[k])

const front = (k: Key, padP: CamPose['padPx'], padL: CamPose['padPx'], fov = 26): { L: CamPose; P: CamPose } => ({
  L: { target: targetOf(k), az: 0, el: 0, fov, fit: fitOf(k), padPx: padL },
  P: { target: targetOf(k), az: 0, el: 0, fov, fit: fitOf(k), padPx: padP },
})

const I0 = front('i0', { l: 16, r: 16, t: 24, b: 64 }, 32)
// the bottom pads hold the name band under the models / the docked row (17 px label, 7 px gap, 8 px inset)
const I1 = front('i1', { l: 10, r: 10, t: 12, b: 34 }, { l: 28, r: 28, t: 28, b: 46 })
const I2 = front('i2', { l: 12, r: 12, t: 14, b: 34 }, { l: 28, r: 28, t: 28, b: 44 })
const I4 = front('i4', { l: 8, r: 8, t: 10, b: 8 }, 24)

/* I3: the lifetime solid, seen from the front left and above so the ages
   recede into depth (D.1: P az -14 el 38; L az -32, raised from el 26 to 44
   so the lit surface, not the front wall, is the subject). The fit frames
   the solid's real silhouette: its surface ridge at every age, its floor,
   the age axis and HEALTH on the floor in front. */
const I3_P = { az: -14, el: 38 }
const I3_L = { az: -32, el: 44 }

function solidPoints(l: Layout): V3[] {
  const L = layoutOf(l)
  const c = L.chart
  const D = L.depth
  const pts: V3[] = []
  for (let a = 0; a < NA; a++) {
    const z = (-D * a) / (NA - 1)
    for (let i = 0; i <= 8; i++) {
      const u = i / 8
      pts.push([cx(c, u), cy(c, capAt(u, a)), z])
    }
    pts.push([c.x0, c.y0, z], [c.x1, c.y0, z])
  }
  // the age axis runs a little past the oldest slice
  pts.push([c.x0, c.y0, -(D + 0.35)])
  // HEALTH on the floor (Barlow Bold advance plus its letter spacing)
  const hw = (BARLOW_BOLD.health + 0.12 * 5) * L.healthSize * 0.5
  const hh = BARLOW_BOLD.cap * L.healthSize * 0.5
  const hx = (c.x0 + c.x1) / 2
  pts.push([hx - hw, c.y0, L.healthZ - hh], [hx + hw, c.y0, L.healthZ - hh], [hx - hw, c.y0, L.healthZ + hh], [hx + hw, c.y0, L.healthZ + hh])
  return pts
}

const I3_FIT: Record<Layout, { box: Box; target: V3 }> = {
  P: obliqueFit(solidPoints('P'), I3_P.az, I3_P.el),
  L: obliqueFit(solidPoints('L'), I3_L.az, I3_L.el),
}

const I3 = {
  // the left pads hold the age axis labels (AGE, 20, 80)
  L: { target: () => I3_FIT.L.target, az: I3_L.az, el: I3_L.el, fov: 30, fit: () => I3_FIT.L.box, padPx: { l: 44, r: 28, t: 24, b: 20 } },
  P: { target: () => I3_FIT.P.target, az: I3_P.az, el: I3_P.el, fov: 30, fit: () => I3_FIT.P.box, padPx: { l: 34, r: 10, t: 14, b: 8 } },
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
      // the four full model names held in the rest frame (H.40)
      sceneWords: 10,
      cam: { L: I1.L, P: I1.P, window: [0, 0.3] },
    },
    {
      id: 'definition',
      title: 'One definition',
      body: 'Work capacity across broad time and modal domains. Plot power against duration; the area under the curve is your fitness.',
      source: 'DEFINITION_TEXT s1 to s2 (para)',
      build: 5.5,
      // AREA = FITNESS, the two axis titles and the time span (1 s, 1 hr)
      sceneWords: 8,
      cam: { L: I2.L, P: I2.P, window: [0, 0.3] },
    },
    {
      id: 'lifetime',
      title: 'Held for a lifetime',
      body: 'Sustain that capacity across a lifetime and it is health: the volume you keep under the surface.',
      source: 'INTRO_TEXT last clause + MODULES[5].blurb (para)',
      build: 5.0,
      // HEALTH, AGE and its two ends
      sceneWords: 4,
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
