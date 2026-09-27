import type { Box, CamPose, Layout, StoryDef, V3 } from '../../story/types'
import HopperScene from './Scene'
import HopperExplore from './Explore'
import HopperHud from './Hud'
import { CHART_PAD, LEGEND_PX, WORLD, boardBox, chartBox, drawBox, drumBox, lerpBox, railsBox, type World } from './layout'
import { exAnim } from './ExploreScene'
import { EXPLORE_EL, useHopExplore } from './exploreStore'

/* =========================================================================
   02 THE HOPPER: "The Tally" (DESIGN.md D.3). Seven beats: the hopper, a
   random draw, six athletes scored relative to each other, the specialists
   trading the lead while their domains come up, the unknown handing the
   lead to the generalist (the signature), the rain of 35 more draws, and
   the proof across 64 other hoppers. Beat copy lives here so a reviewer can
   check every `source` against fitnessData.ts and the module-file string
   table (D.3). Titles <= 30 characters, bodies <= 140, no new facts.

   Camera: the board is compared front-on (az 0, el 8, fov 32: L12 holds at
   el 8); the thread chart is read exactly front-on (H.21). The pinned domain
   legend owns the top-left corner: the phone poses start under it.
   ========================================================================= */

const center = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]

/** px reserved for the pinned five-chip domain legend (top-left) over the drum poses */
const LEGEND_BAND = 132

const pose = (fit: (w: World, l: Layout) => Box, padPx: CamPose['padPx'], el = 8, fov = 32): CamPose => ({
  target: (l: Layout) => center(fit(WORLD[l], l)),
  az: 0,
  el,
  fov,
  fit: (l: Layout) => fit(WORLD[l], l),
  padPx,
})

const DRUM_P = pose(drumBox, { l: 18, r: 18, t: LEGEND_BAND, b: 16 })
const DRUM_L = pose(drumBox, { l: 40, r: 40, t: 28, b: 28 })
// H1: the D.3 centred stack, the drum over its ticket
const DRAW_P = pose(drawBox, { l: 12, r: 12, t: LEGEND_BAND, b: 12 })
const DRAW_L = pose(drawBox, { l: 40, r: 40, t: 28, b: 28 })
// the board: badges left of the rails; on a phone it starts under the legend
// (the drum sits beside the ticket in that band, under the HUD chip)
const BOARD_P = pose(boardBox, { l: 30, r: 8, t: LEGEND_PX, b: 10 })
const BOARD_L = pose(boardBox, { l: 40, r: 30, t: LEGEND_BAND, b: 18 })
// H6: the chart, exactly front-on
const CHART: CamPose = {
  target: (l: Layout) => center(chartBox(WORLD[l])),
  az: 0,
  el: 0,
  fov: 22,
  fit: (l: Layout) => chartBox(WORLD[l]),
  padPx: CHART_PAD,
}

/**
 * Explore: the board, or the thread chart while "Every run" is on, fitted
 * like the story's H6 (the chart itself plus its label room), re-fitted
 * every frame. Switching the view orbits to el 0 (the chart) or back to the
 * board's el 8 (exploreStore). The fov stays 32 for both: the chart is flat
 * and seen exactly front-on, so its projection does not depend on it.
 */
const runs = () => useHopExplore.getState().view === 'runs'
/** the board in explore: with the phone's sheet expanded it glides to the rails alone (exAnim.compact) */
const exBoardBox = (l: Layout) => lerpBox(boardBox(WORLD[l], l), railsBox(WORLD[l], l), exAnim.compact)
const exBoard = (pad: { l: number; r: number; t: number; b: number }): CamPose => ({
  target: (l: Layout) => center(exBoardBox(l)),
  az: 0,
  el: EXPLORE_EL,
  fov: 32,
  fit: (l: Layout) => exBoardBox(l),
  get padPx() {
    // compact: clear of the HUD chip, the only thing left over the rails
    return { ...pad, t: pad.t + (72 - pad.t) * exAnim.compact }
  },
})
const EX_BOARD_P = exBoard({ l: 30, r: 8, t: LEGEND_PX, b: 10 })
const EX_BOARD_L = exBoard({ l: 40, r: 30, t: LEGEND_BAND, b: 18 })
const explorePose = (board: CamPose): CamPose => ({
  get target() {
    return runs() ? CHART.target : board.target
  },
  az: 0,
  get el() {
    return runs() ? 0 : EXPLORE_EL
  },
  fov: 32,
  get fit() {
    return runs() ? CHART.fit : board.fit
  },
  get padPx() {
    return runs() ? CHART_PAD : board.padPx
  },
})
const EXPLORE_P = explorePose(EX_BOARD_P)
const EXPLORE_L = explorePose(EX_BOARD_L)

export const hopperStory: StoryDef = {
  key: 'hopper',
  beats: [
    {
      id: 'hopper',
      title: 'The hopper',
      body: 'Picture a hopper loaded with an infinite number of physical challenges, with no selective mechanism.',
      source: 'MODULE_COPY.hopper.body s2',
      build: 4.5,
      cam: { L: DRUM_L, P: DRUM_P },
    },
    {
      id: 'draw',
      title: 'Drawn at random',
      body: 'Imagine an infinite hopper of challenges drawn at random, with no say in what you get.',
      source: 'MODULE_COPY.hopper.keyPoints[0]',
      build: 4.5,
      // the ticket: DRAW 1, the domain and the task
      sceneWords: 6,
      cam: { L: DRAW_L, P: DRAW_P },
    },
    {
      id: 'score',
      title: 'Relative to others',
      body: 'Your fitness is your capacity at those tasks relative to others. Every competitor scores; totals accumulate.',
      source: 'MODULE_COPY.hopper.body s3 + HopperModule.readoutSub',
      build: 5.0,
      // six names and totals, and LEAD
      sceneWords: 9,
      cam: { L: BOARD_L, P: BOARD_P, window: [0, 0.3] },
    },
    {
      id: 'specialists',
      title: 'Keep drawing',
      body: 'Keep drawing. A specialist only leads while its own domain keeps coming up.',
      source: 'HopperModule.leadMsg[2]',
      build: 5.5,
      sceneWords: 4,
      cam: { L: BOARD_L, P: BOARD_P },
    },
    {
      // the body is keyPoints[2] with its subject from keyPoints[1] ("Fitness"):
      // after H3's specialist, a bare "It" would read as the specialist (L13 paraphrase)
      id: 'unknown',
      title: 'The unknown',
      body: 'Fitness demands performing well even at unfamiliar tasks combined in endless ways.',
      terms: { unfamiliar: 'unknown' },
      source: 'MODULE_COPY.hopper.keyPoints[1] + MODULE_COPY.hopper.keyPoints[2]',
      build: 5.5,
      // the signature (A.3): on an Unknown draw the Generalist rail climbs to P1
      signature: true,
      sceneWords: 5,
      cam: { L: BOARD_L, P: BOARD_P },
      impact: [0.62, 0.74],
    },
    {
      id: 'many',
      title: 'Across random draws',
      body: 'Across random draws, the generalist accumulates the most points. This is why CrossFit prizes the generalist.',
      source: 'HopperModule.leadMsg[1] + MODULE_COPY.hopper.body s4',
      build: 6.0,
      // six final totals and the order they finish in
      sceneWords: 8,
      cam: { L: BOARD_L, P: BOARD_P },
    },
    {
      id: 'every-run',
      title: 'Again and again',
      body: 'Each line is its own random hopper. Nature serves unforeseeable challenges, so the training stimulus must stay broad and varied.',
      source: 'H6 chart legend (the L13 chart-reading note) + MODULE_COPY.hopper.keyPoints[3]',
      build: 6.0,
      // the chart's own words: THIS RUN, GENERALIST AHEAD, A SPECIALIST AHEAD, DRAWS
      sceneWords: 9,
      // the board holds while the bracket measures the lead, then the camera turns to the chart
      cam: { L: CHART, P: CHART, window: [0.2, 0.42] },
    },
  ],
  Scene: HopperScene,
  Explore: HopperExplore,
  Hud: HopperHud,
  // D.3 names FogExp2('#070a0e', 0.018); the fitted camera sits 25 to 50
  // units from this 16-unit world, where 0.018 dims every solid by 20 to 56%
  // and turns the domain colours muddy. 0.006 keeps the depth cue (known issues).
  fog: { color: '#070a0e', density: 0.006 },
  explore: {
    cam: { L: EXPLORE_L, P: EXPLORE_P },
    limits: { az: [-40, 40], el: [0, 35], zoom: [0.6, 1.6] },
    initFromBeat() {
      // explore always opens on the rails, where Draw, x10 and x40 show at
      // once; the chart is one tap away (Rails | Every run, in the peek)
      const s = useHopExplore.getState()
      s.reset()
      s.setView('rails')
      s.select(null)
    },
  },
}

export default hopperStory
