import type { Box, CamPose, StoryDef, V3 } from '../../story/types'
import DefinitionScene from './Scene'
import DefinitionExplore from './Explore'
import DefinitionHud from './Hud'
import { CHART_PAD, chartBox, fanBox, lineup } from './layout'
import { useDefExplore } from './exploreStore'
import { GENERALIST, POWERLIFTER } from './definitionMath'
import { focus } from '../../story/camera/focusRect'
import { gestureBus } from '../../story/gestures'
import { live } from './layout'
import * as THREE from 'three'

/* =========================================================================
   04 CAPACITY: "The integral" (DESIGN.md D.5). Beat copy lives here so a
   reviewer can check every `source` against fitnessData.ts. Titles <= 30
   characters, bodies <= 140, no new facts, numbers or quotes.
   ========================================================================= */

const T0: [number, number, number] = [0, 0, 0]
/** Centre of the fan box (v 0 .. 0.95): y(0.475) with FH 10 and vMax 1.1. */
const FAN_T: [number, number, number] = [0, -0.75, 0]

/** Front-on chart pose (D0, D1). Fit the chart box inside the label margins. */
const CHART: CamPose = { target: T0, az: 0, el: 4, fov: 26, fit: () => chartBox(), padPx: CHART_PAD }
/** Slightly turned, so the chart plane reads as a surface (D2 end, D3, D4). */
const CHART_M6: CamPose = { ...CHART, az: -6 }
/** Comparison pose (L12): exactly front-on (D5). */
const FRONT: CamPose = { ...CHART, az: 0, el: 0 }
/** Reveal the domain depth (D2 key). Extra right padding for the domain names. */
const FAN_L: CamPose = { target: FAN_T, az: -30, el: 18, fov: 26, fit: () => fanBox(), padPx: { l: 40, r: 120, t: 24, b: 44 } }
const FAN_P: CamPose = { target: FAN_T, az: -22, el: 20, fov: 26, fit: () => fanBox(), padPx: { l: 16, r: 104, t: 16, b: 40 } }
/** The ranked lineup column (D6). */
const boxCenter = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]
const COL_P: CamPose = { target: () => boxCenter(lineup('P').box), az: 0, el: 6, fov: 26, fit: () => lineup('P').box, padPx: { l: 12, r: 12, t: 12, b: 12 } }
const COL_L: CamPose = { target: () => boxCenter(lineup('L').box), az: 0, el: 6, fov: 26, fit: () => lineup('L').box, padPx: { l: 16, r: 16, t: 16, b: 16 } }

const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const ray = new THREE.Raycaster()
const hit = new THREE.Vector3()

export const definitionStory: StoryDef = {
  key: 'definition',
  beats: [
    {
      id: 'measured',
      title: 'Power is measurable',
      body: 'Power is force times distance over time. How much weight, how far, how long: that is a valid measure of fitness.',
      source: 'MODULE_COPY.definition.keyPoints[0] + DEFINITION_TEXT s4',
      build: 4.0,
      cam: { L: CHART },
    },
    {
      id: 'curve',
      title: 'Power falls with duration',
      body: 'At each effort duration there is a highest average power you can hold, and as duration grows that power falls.',
      source: 'POWER_CONCEPT s2',
      build: 5.5,
      cam: { L: CHART },
    },
    {
      id: 'domains',
      title: 'Every modal domain',
      body: 'CrossFit adds one move: average the curve across every modal domain. The hopper supplies the domains.',
      source: 'POWER_CONCEPT s4 + MODULE_COPY.definition.body s3',
      build: 5.5,
      cam: {
        L: CHART_M6,
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
      cam: { L: CHART_M6 },
      impact: [0.8, 0.92],
    },
    {
      id: 'synthesis',
      title: 'The models combine',
      body: 'The ten skills set its height, the hopper supplies the domains, the pathways are the time axis.',
      source: 'MODULE_COPY.definition.body s3',
      build: 4.5,
      cam: { L: CHART_M6 },
    },
    {
      id: 'specialist',
      title: 'One zone, or the integral',
      body: 'A specialist wins one point on the axis. The generalist wins the integral.',
      source: 'POWER_CONCEPT s6 to s7',
      build: 5.5,
      cam: { L: FRONT },
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
  explore: {
    cam: { L: CHART_M6 },
    limits: { az: [-55, 55], el: [0, 45], zoom: [0.6, 1.6] },
    scrubToggle: true,
    initFromBeat(i) {
      const s = useDefExplore.getState()
      s.setAthlete(i === 5 ? POWERLIFTER.name : GENERALIST.name)
      s.setShowDomains(i === 2)
      s.setGhost(true)
      s.setProbe(null)
    },
    onScrub(nx, ny, phase) {
      const s = useDefExplore.getState()
      if (phase === 'end') return
      const cam = gestureBus.camera
      if (!cam) return
      const px = focus.x + nx * focus.w
      const py = focus.y + ny * focus.h
      ray.setFromCamera(new THREE.Vector2((px / focus.W) * 2 - 1, 1 - (py / focus.H) * 2), cam)
      if (!ray.ray.intersectPlane(plane, hit)) return
      const f = live.frame
      const u = Math.max(0, Math.min(1, (hit.x - f.x0) / f.FW))
      s.setProbe(u)
    },
  },
}

export default definitionStory
