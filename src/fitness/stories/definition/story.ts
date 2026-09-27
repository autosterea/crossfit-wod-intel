import type { Box, CamPose, StoryDef, V3 } from '../../story/types'
import DefinitionScene from './Scene'
import DefinitionExplore from './Explore'
import DefinitionHud from './Hud'
import { CHART_PAD, FRAME_OPTS, chartBox, fanBox, fanCenter, lineup } from './layout'
import { useDefExplore } from './exploreStore'
import { GENERALIST, POWERLIFTER } from './definitionMath'
import { storyFrame } from '../../story/kit/chartFrame'
import * as THREE from 'three'

/* =========================================================================
   04 CAPACITY: "The integral" (DESIGN.md D.5). Beat copy lives here so a
   reviewer can check every `source` against fitnessData.ts. Titles <= 30
   characters, bodies <= 140, no new facts, numbers or quotes.

   Camera (amendment H.21): every beat that is READ as a 2D chart (D0, D1,
   D3, D4, D5 and explore) is exactly front-on with a telephoto fov of 22, so
   there is no keystone and no stair-stepping on the axes (L12). Oblique
   poses are kept only where depth is the point and are decisive: the D2
   domain fan (L az -30 el 18, P az -32 el 22).
   ========================================================================= */

const T0: V3 = [0, 0, 0]

/** Front-on chart pose (D0, D1, D3, D4, D5, explore). Fit the chart box inside the label margins. */
const CHART: CamPose = { target: T0, az: 0, el: 0, fov: 22, fit: chartBox, padPx: CHART_PAD }
/** Reveal the domain depth (D2 keys): fit the fanned VOLUME, not the flat chart. */
const FAN_L: CamPose = { target: (_l, f) => fanCenter(f), az: -30, el: 18, fov: 24, fit: (_l, f) => fanBox(f), padPx: { l: 40, r: 120, t: 24, b: 40 } }
const FAN_P: CamPose = { target: (_l, f) => fanCenter(f), az: -32, el: 22, fov: 24, fit: (_l, f) => fanBox(f), padPx: { l: 14, r: 14, t: 12, b: 26 } }
/**
 * The ranked lineup (D6): exactly front-on (L12). The minis are light-filled
 * areas on glass plates, not slabs, so there is no relief to show (H.29).
 * The pose fits the lineup the scene builds for this layout and frame.
 */
const boxCenter = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]
const COL_P: CamPose = {
  target: (l, f) => boxCenter(lineup(l, f).box),
  az: 0,
  el: 0,
  fov: 22,
  fit: (l, f) => lineup(l, f).box,
  padPx: { l: 6, r: 6, t: 8, b: 6 },
}
const COL_L: CamPose = { ...COL_P, padPx: { l: 16, r: 16, t: 16, b: 16 } }

const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const hit = new THREE.Vector3()

export const definitionStory: StoryDef = {
  key: 'definition',
  beats: [
    {
      id: 'measured',
      title: 'Power is measurable',
      body: 'Power is force times distance over time. How much weight, how far, how long: that is a valid measure of fitness.',
      source: 'MODULE_COPY.definition.keyPoints[0] + DEFINITION_TEXT s4',
      build: 3.4,
      cam: { L: CHART },
    },
    {
      id: 'curve',
      title: 'Power falls with duration',
      body: 'At each effort duration there is a highest average power you can hold, and as duration grows that power falls.',
      source: 'POWER_CONCEPT s2',
      build: 4.6,
      cam: { L: CHART },
    },
    {
      id: 'domains',
      title: 'Every modal domain',
      body: 'CrossFit adds one move: average the curve across every modal domain. The hopper supplies the domains.',
      source: 'POWER_CONCEPT s4 + MODULE_COPY.definition.body s3',
      build: 5.5,
      cam: {
        L: CHART,
        window: [0, 0.9],
        keys: [
          { t: 0.35, L: FAN_L, P: FAN_P },
          { t: 0.5, L: FAN_L, P: FAN_P },
        ],
      },
    },
    {
      id: 'area',
      title: 'Area = fitness',
      body: 'Fitness is the area under that averaged curve. It is measurable, it is observable, and it leaves no room for opinion.',
      source: 'MODULE_COPY.definition.keyPoints[2] + DEFINITION_TEXT s3',
      build: 5.0,
      cam: { L: CHART },
      impact: [0.8, 0.92],
    },
    {
      id: 'synthesis',
      title: 'The models combine',
      body: 'The ten skills set its height, the hopper supplies the domains, the pathways are the time axis.',
      source: 'MODULE_COPY.definition.body s3',
      build: 4.5,
      cam: { L: CHART },
    },
    {
      id: 'specialist',
      title: 'One zone, or the integral',
      body: 'A specialist wins one point on the axis. The generalist wins the integral.',
      source: 'POWER_CONCEPT s6 to s7',
      build: 5.5,
      cam: { L: CHART },
    },
    {
      id: 'lineup',
      title: 'The whole curve',
      body: 'A specialist owns one zone; the generalist defends the whole curve.',
      source: 'MODULE_COPY.definition.body s4',
      build: 5.5,
      cam: { L: COL_L, P: COL_P, window: [0, 0.4] },
    },
  ],
  Scene: DefinitionScene,
  Explore: DefinitionExplore,
  Hud: DefinitionHud,
  frame: FRAME_OPTS,
  explore: {
    cam: { L: CHART },
    limits: { az: [-55, 55], el: [0, 45], zoom: [0.6, 1.6] },
    scrubToggle: true,
    initFromBeat(i) {
      const s = useDefExplore.getState()
      s.setAthlete(i === 5 ? POWERLIFTER.name : GENERALIST.name)
      s.setShowDomains(i === 2)
      s.setGhost(true)
      s.setProbe(null)
    },
    onScrub(ray, _ndc, phase) {
      if (phase === 'end') return
      if (!ray.intersectPlane(plane, hit)) return
      const f = storyFrame()
      useDefExplore.getState().setProbe(Math.max(0, Math.min(1, (hit.x - f.x0) / f.FW)))
    },
  },
}

export default definitionStory
