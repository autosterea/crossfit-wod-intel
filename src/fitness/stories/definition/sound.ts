import type { ChapterSound } from '../../story/audio/types'
import { POWER_TASKS } from '../../fitnessData'
import { RANKED } from './definitionMath'
import { TASK_400, TASK_LABELED, TASK_U } from './chart'
import { averageFlare, axesDraw, barGrow, curveDraw, d0Dot, d4Stroke, d5Dash, dimsDraw, fan, pourLevel, rowAppear, spillMix, taskAppear } from './Scene'

/* =========================================================================
   04 CAPACITY, "The integral": the sound (DESIGN.md I.7, the exemplar).
   Every cue names its SOURCE (the Scene's own cue function or a registered
   label) and story/audio/cueFrom samples it, so a retimed animation carries
   its sound with it. No window number is typed here. Bed: D (the key the
   intro promised); no ambient layer.
   ========================================================================= */

/** The D1 names in the order the pen head passes them (shortest effort first). */
const D1_NAMES = POWER_TASKS.map((_, i) => i)
  .filter((i) => TASK_LABELED[i] && i !== TASK_400)
  .sort((a, b) => TASK_U[a] - TASK_U[b])
  .map((i) => `task-${i}`)

/** The score bars grow as one staircase of light: the mean of every row's bar. */
const barsMean = (T: number) => RANKED.reduce((s, _, r) => s + barGrow(T, r), 0) / RANKED.length

const sound: ChapterSound = {
  cues: {
    // D0: one hot L stroke, the measured point lands with its ring, its dimension lines, nine more points
    // (4 of the nine sound: the first, the last and two between; H.71, the fifth listen)
    measured: [
      { name: 'axes', sound: 'pen', from: { fn: axesDraw }, pan: [-0.25, 0.3] },
      { name: '400m dot', sound: 'tick.dot', from: { fn: d0Dot }, on: 'land', ring: 'ripple' },
      { name: 'dimension lines', sound: 'pen.dash', from: { fn: dimsDraw }, gain: -6 },
      { name: 'nine points', sound: 'tick.dot', from: { each: taskAppear, n: POWER_TASKS.length, skip: [TASK_400] }, on: 'land', gain: -5, max: 4 },
    ],
    // D1: the pen draws the curve through the points; each name lands as the head passes, falling in pitch as power falls
    // (+2 dB, was -3: the last name was masked by the voice, 1.9 dB of band margin; H.71)
    curve: [
      { name: 'curve', sound: 'pen', from: { fn: curveDraw }, pan: [-0.3, 0.3] },
      { name: 'task names', sound: 'tick.label', from: { labels: () => D1_NAMES }, pitch: [2, 0, -5], gain: 2 },
    ],
    // D2: the curve fans out in depth, the five domains are named together, the slices converge, the average absorbs them
    domains: [
      { name: 'fan out', sound: 'air.reveal', from: { fn: fan, seg: 0 }, pan: -0.2 },
      { name: 'domain names', sound: 'tick.label', from: { label: ['dom-0', 'dom-key-0'] }, gain: -3 },
      { name: 'converge', sound: 'air.reveal', from: { fn: fan, seg: 1 }, gain: -3, pan: 0.2 },
      { name: 'average', sound: 'tick.close', from: { fn: averageFlare, seg: 0 }, on: 'end' },
    ],
    // D3 (signature): light pours in under the curve; AREA = FITNESS lands with the impact accent
    area: [
      { name: 'pour', sound: 'pour.fill', from: { fn: pourLevel } },
      { name: 'claim', sound: 'resolve', from: { impact: true } },
    ],
    // D4: three strokes of light; HEIGHT, DOMAINS and TIME land at the tick pitch of the chapter each names
    synthesis: [
      { name: 'strokes', sound: 'pen', from: { each: d4Stroke, n: 3 }, gain: -3 },
      { name: 'callouts', sound: 'tick.label', from: { labels: () => ['c-height', 'c-domains', 'c-time'] }, pitch: [7, 2, 9] },
    ],
    // D5 (signature): the Powerlifter's dashed curve, the light spills out, AREA LOST, then ZONE WON.
    // The fall lands between "The generalist" and "wins the integral": -3 dB so the loss marks the
    // specialist's lost area without reading as a verdict on the generalist (H.71)
    specialist: [
      { name: 'dashed curve', sound: 'pen.dash', from: { fn: d5Dash } },
      { name: 'spill', sound: 'pour.drain', from: { fn: spillMix } },
      { name: 'area lost', sound: 'resolve.fall', from: { label: 'lost' }, gain: -3 },
      { name: 'zone won', sound: 'tick.close', from: { label: 'zone' }, gain: -3 },
    ],
    // D6: each specialist's row lands with its light; the score bars grow into a staircase
    // (rows +3 dB, was -5: the first row was masked by the voice; H.71)
    lineup: [
      { name: 'rows', sound: 'tick.dot', from: { each: rowAppear, n: RANKED.length, skip: [0] }, on: 'land', ring: 'shimmer', gain: -2 },
      { name: 'bars', sound: 'pen', from: { fn: barsMean }, gain: -8 },
    ],
  },
}

export default sound
