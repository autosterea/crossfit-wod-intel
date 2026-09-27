import type { Box, CamPose, StoryDef } from '../../story/types'
import HealthScene from './Scene'
import { pickAge } from './pick'
import HealthExplore from './Explore'
import HealthHud from './Hud'
import { claimBox, planeBox, sliceBox, volumeBox } from './layout'
import { useHealthExplore } from './exploreStore'
import { LIFELONG, SEDENTARY, STARTS_50 } from './healthMath'

/* =========================================================================
   06 HEALTH: "Stack every age" (DESIGN.md D.7). Beat copy lives here so a
   reviewer can check every `source` against fitnessData.ts. Titles <= 30
   characters, bodies <= 140, no new facts, numbers or quotes; computed
   values (the volumes, fitness at an age) live in labels and the HUD only.

   Camera: L0 is a chart read front-on (az 0, el 4, fov 30). From L1 the
   camera rises to reveal age running into depth (L6: a new dimension) and
   stays oblique: the health surfaces are inherently 3D, read through
   colour, isolines and readouts (L12's exception). Portrait poses look
   down more steeply, so age recedes up the phone screen.
   ========================================================================= */

/**
 * A pose that fits `fit`. Perspective pushes the near bottom of an oblique
 * box further down the screen than its far top rises, so looking at the
 * box's centre left the solid low in the frame; the look-at point sits
 * lower and nearer (`lift` and `near`, in box fractions) so the projected
 * solid is centred in the focus rect.
 */
const pose = (az: number, el: number, fit: () => Box, padPx: CamPose['padPx'], fov = 30, lift = 0.5, near = 0): CamPose => ({
  target: () => {
    const b = fit()
    return [(b[0][0] + b[1][0]) / 2, b[0][1] + (b[1][1] - b[0][1]) * lift, (b[0][2] + b[1][2]) / 2 + (b[1][2] - b[0][2]) * near]
  },
  az,
  el,
  fov,
  fit: () => fit(),
  padPx,
})

/* padding: room for the labels (duration ticks under the front edge, the age
   ticks west of the left edge, CAPACITY by the post) and, from L2, the HUD
   chip in the top-right corner. The volume boxes' top runs flat at 0.66 of
   capacity across all ages, above the landscape at the back, so the top
   pads can be small. */
const PAD_L0_P = { l: 14, r: 14, t: 56, b: 60 }
const PAD_L0_L = { l: 40, r: 40, t: 64, b: 70 }
const PAD_P = { l: 40, r: 14, t: 10, b: 46 }
const PAD_L = { l: 72, r: 40, t: 24, b: 56 }
const PAD_HUD_P = { l: 40, r: 14, t: 22, b: 46 }
const PAD_HUD_L = { l: 72, r: 40, t: 40, b: 56 }

/** the 3D beats use a slightly wider lens than the chart (depth reads through perspective) */
const FOV3 = 36
const LIFT = 0.36
const NEAR = 0.1
const SLICE_L = pose(0, 4, sliceBox, PAD_L0_L)
const SLICE_P = pose(0, 4, sliceBox, PAD_L0_P)
const STACK_L = pose(-34, 26, volumeBox, PAD_L, FOV3, LIFT, NEAR)
const STACK_P = pose(-16, 26, volumeBox, PAD_P, FOV3, LIFT, NEAR)
const CLAIM_L = pose(-34, 26, claimBox, PAD_HUD_L, FOV3, LIFT, NEAR)
const CLAIM_P = pose(-16, 26, claimBox, PAD_HUD_P, FOV3, LIFT, NEAR)
// L3 and L4: a slight rise so the plane reads (D.7)
const LINE_L = pose(-34, 30, planeBox, PAD_HUD_L, FOV3, LIFT, NEAR)
const LINE_P = pose(-16, 34, planeBox, PAD_HUD_P, FOV3, LIFT, NEAR)
// L5: the lift happens in the back half of life (50 to 85), so the camera
// looks down more steeply and those ages open up (D.7 gives P el 48 here)
const WAVE_L = pose(-30, 38, planeBox, PAD_HUD_L, FOV3, 0.3, 0.02)
const WAVE_P = pose(-14, 44, planeBox, PAD_HUD_P, FOV3, 0.3, 0.02)
const HOLD_L = pose(-40, 24, planeBox, PAD_HUD_L, FOV3, LIFT, NEAR)
const HOLD_P = pose(-22, 26, planeBox, PAD_HUD_P, FOV3, LIFT, NEAR)

export const healthStory: StoryDef = {
  key: 'health',
  beats: [
    {
      id: 'slice',
      title: 'A curve for every age',
      body: 'Add a third axis to the fitness curve: age. Every age of your life has its own power-duration curve.',
      terms: { 'fitness curve': 'yellowGreen' },
      source: 'MODULE_COPY.health.body s1 to s2',
      build: 4.0,
      cam: { L: SLICE_L, P: SLICE_P },
    },
    {
      id: 'stack',
      title: 'Stack them',
      body: 'Stack them and the three-dimensional solid that results is health.',
      source: 'MODULE_COPY.health.body s3',
      build: 6.0,
      // the age ticks and AGE, read once the slices have fused
      sceneWords: 5,
      cam: { L: STACK_L, P: STACK_P },
    },
    {
      id: 'volume',
      title: 'Volume = health',
      body: 'Health is sustained work capacity across a lifetime, the volume under the surface, not merely living a long time.',
      terms: { 'the volume under the surface': 'yellowGreen' },
      source: 'MODULE_COPY.health.keyPoints[0] + MODULE_COPY.health.body s4',
      build: 4.5,
      // VOLUME = HEALTH on the floor and the HUD's number (H.40)
      sceneWords: 4,
      cam: { L: CLAIM_L, P: CLAIM_P },
    },
    {
      id: 'line',
      title: 'The independence line',
      body: 'Below the independence line, daily tasks exceed capacity.',
      terms: { 'independence line': 'sick' },
      source: 'MODULE_COPY.health.body s6',
      build: 4.0,
      sceneWords: 2,
      cam: { L: LINE_L, P: LINE_P },
    },
    {
      id: 'sink',
      title: 'Stop training',
      body: 'Stop training and the surface sinks toward the independence line. The power ridge collapses first.',
      terms: { 'independence line': 'sick' },
      source: 'MODULE_COPY.health.body s6 + fitnessData.AGING_PROFILES[2].trajectory',
      build: 5.5,
      // Sedentary, Independent through 70 (H.40)
      sceneWords: 4,
      cam: { L: LINE_L, P: LINE_P },
    },
    {
      id: 'any-age',
      title: 'Start at any age',
      body: 'Start at any age and it lifts. Resistance and power training reclaim capacity, even into the 90s.',
      terms: { 'it lifts': 'yellowGreen' },
      source: 'MODULE_COPY.health.body s7 + MODULE_COPY.health.keyPoints[3]',
      build: 6.0,
      // the signature beat (A.3): the wave's finished frame holds (H.40)
      signature: true,
      sceneWords: 6,
      impact: [0.3, 0.42],
      // the move lands before the sweep starts (t 0.15)
      cam: { L: WAVE_L, P: WAVE_P, window: [0, 0.18] },
    },
    {
      id: 'hold',
      title: 'Hold it as long as you can',
      body: 'Maximize the area under the curve and hold it for as long as you can.',
      source: 'MODULE_COPY.health.body s5',
      build: 5.5,
      // Independent through 90+, the two volumes, fitness at age 85 (H.40)
      sceneWords: 12,
      cam: { L: HOLD_L, P: HOLD_P },
    },
  ],
  Scene: HealthScene,
  Explore: HealthExplore,
  Hud: HealthHud,
  explore: {
    cam: { L: LINE_L, P: LINE_P },
    limits: { az: [-75, 75], el: [8, 70], zoom: [0.6, 1.6] },
    scrubToggle: true,
    initFromBeat(i) {
      const s = useHealthExplore.getState()
      s.setProfile(i === 4 ? SEDENTARY.name : i === 5 ? STARTS_50.name : LIFELONG.name)
      s.setAge(i === 6 ? 85 : 45)
      s.setShowLine(true)
      s.setCompare(true)
    },
    onScrub(ray, _ndc, phase) {
      if (phase === 'end') return
      const a = pickAge(ray)
      if (a !== null) useHealthExplore.getState().setAge(a)
    },
  },
}

export default healthStory
