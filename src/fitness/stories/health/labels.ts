import { useEffect, useMemo } from 'react'
import { PAL, agingCapacity } from '../../fitnessData'
import { focus } from '../../story/cue'
import { useStoryStore } from '../../story/store'
import { clock, onFrame } from '../../story/clock'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec, V3 } from '../../story/types'
import { LIFELONG, SEDENTARY, STARTS_50, fitnessAt, healthScore, sampleGrid } from './healthMath'
import { INDEPENDENCE_LINE, POST_CAP, Z0, Z1, Z30, xOf, zOfAge, type World } from './layout'
import { HS } from './state'
import {
  B,
  ageSliceAge,
  ageTicks,
  age30,
  axesZ,
  axisTicks,
  capAt,
  indep70,
  indep85,
  indep90,
  lineCallout,
  s50Name,
  sedName,
  volReadouts,
  ageSliceOn,
} from './timeline'

/* =========================================================================
   06 HEALTH labels (DESIGN.md D.7 lexicon): the axis strings ("1 s",
   "1 hr", DURATION, AGE, 20, 40, 60, 80, CAPACITY), AGE 30, INDEPENDENCE
   LINE, "Independent through X" (X from independentThrough, never a drawn
   crossing marker, F.5), the AGING_PROFILES names, "Fitness at age N" and
   the volume readouts (computed). Story anchors are pure functions of T
   (capAt), so a deep link places them exactly as a scrub does.
   ========================================================================= */

const explore = () => useStoryStore.getState().mode === 'explore'
const L_SCORE = healthScore(LIFELONG)
const S_SCORE = healthScore(SEDENTARY)

/** A point on the story landscape at (u, age), lifted by dy. */
const onLand = (T: number, u: number, age: number, W: World, dy = 0): V3 => [xOf(u, W.XW), capAt(T, u, age) * W.YS + dy, zOfAge(age)]

export function useHealthLabels(W: World): void {
  const axes = useMemo<LabelSpec[]>(() => {
    const { XW, YS } = W
    const POST_Y = POST_CAP * YS
    const zAxis = (T: number) => (explore() ? Z0 : axesZ(T))
    const tickCue = (T: number) => (explore() ? 1 : axisTicks(T) * focus(T, B.slice))
    const ageCue = (T: number) => (explore() ? 1 : ageTicks(T) * focus(T, B.stack))
    const out: LabelSpec[] = [
      { id: 'h-1s', text: '1 s', tone: 'tick', anchor: (T) => [-XW, 0, zAxis(T)], prefer: 'S', only: ['S', 'SW', 'SE'], gapPx: 6, priority: 80, cue: tickCue },
      { id: 'h-1hr', text: '1 hr', tone: 'tick', anchor: (T) => [XW, 0, zAxis(T)], prefer: 'S', only: ['S', 'SE', 'SW'], gapPx: 6, priority: 80, cue: tickCue },
      { id: 'h-dur', text: 'DURATION', tone: 'tick', anchor: (T) => [0, 0, zAxis(T)], prefer: 'S', only: ['S'], gapPx: 8, priority: 78, cue: tickCue },
      { id: 'h-cap', text: 'CAPACITY', tone: 'tick', anchor: (T) => [-XW, POST_Y, zAxis(T)], prefer: 'W', only: ['W', 'NW', 'SW', 'N', 'NE'], gapPx: 8, priority: 78, cue: tickCue },
    ]
    ;[20, 40, 60, 80].forEach((a) =>
      out.push({
        id: 'h-age-' + a,
        text: String(a),
        tone: 'tick',
        anchor: [-XW - 0.42, 0, zOfAge(a)],
        prefer: 'W',
        only: ['W', 'SW', 'NW'],
        gapPx: 5,
        priority: 80,
        cue: ageCue,
      }),
    )
    out.push({
      id: 'h-age',
      text: 'AGE',
      tone: 'tick',
      // the axis title sits past the far end of the age axis, where it points
      anchor: [-XW - 0.42, 0, Z1 - 0.8],
      prefer: 'NW',
      only: ['NW', 'W', 'N', 'SW'],
      gapPx: 6,
      priority: 79,
      cue: ageCue,
    })
    return out
  }, [W])
  useLabels(axes, { mode: 'both' })

  const specs = useMemo<LabelSpec[]>(() => {
    const { XW, YS } = W
    const LINE_Y = INDEPENDENCE_LINE * YS
    const out: LabelSpec[] = []
    // L0 claim: the curve belongs to one age
    out.push({
      id: 'h-age30',
      text: 'AGE 30',
      tone: 'callout',
      color: PAL.well,
      anchor: [xOf(0.58, XW), agingCapacity(0.58, 30, LIFELONG) * YS, Z30],
      prefer: 'NE',
      only: ['NE', 'N', 'E'],
      gapPx: 16,
      leader: 'always',
      required: true,
      cue: age30,
    })
    // L3: the independence line, named on the red line it names
    out.push({
      id: 'h-line',
      text: 'INDEPENDENCE LINE',
      tone: 'callout',
      color: PAL.sick,
      anchor: [xOf(0.5, XW), LINE_Y, Z0],
      prefer: 'N',
      only: ['N', 'NE', 'NW'],
      gapPx: 10,
      leader: 'always',
      required: true,
      cue: (T) => (explore() ? 0 : lineCallout(T) * (1 - 0.5 * (1 - focus(T, B.line)))),
    })
    // L4: the Sedentary landscape
    const sedAt = (T: number) => onLand(T, 0.22, 58, W, 0.1)
    out.push(
      { id: 'h-sed', text: SEDENTARY.name, tone: 'name', color: PAL.chalk, anchor: sedAt, prefer: 'N', gapPx: 12, leader: true, priority: 70, required: true, cue: sedName },
      {
        id: 'h-i70',
        text: `Independent through ${SEDENTARY.independentThrough}`,
        tone: 'callout',
        color: PAL.sick,
        anchor: (T) => onLand(T, 0.22, 58, W, 2.2),
        prefer: 'N',
        gapPx: 10,
        required: true,
        cue: indep70,
      },
    )
    // L5: the landscape lifted from 50
    out.push(
      {
        id: 'h-s50',
        text: STARTS_50.name,
        tone: 'name',
        color: PAL.chalk,
        anchor: (T) => onLand(T, 0.22, 64, W, 0.1),
        prefer: 'N',
        gapPx: 12,
        leader: true,
        priority: 70,
        required: true,
        cue: s50Name,
      },
      {
        id: 'h-i85',
        text: `Independent through ${STARTS_50.independentThrough}`,
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: (T) => onLand(T, 0.22, 64, W, 2.4),
        prefer: 'N',
        gapPx: 10,
        required: true,
        cue: indep85,
      },
    )
    // L6: hold it; two volumes, and the fitness at each age riding the amber slice
    out.push(
      {
        // the comparison key (L6): the lit landscape and the dashed ghost, each with its volume
        id: 'h-vl',
        text: `${LIFELONG.name} ${L_SCORE}`,
        tone: 'legend',
        color: PAL.yellowGreen,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 0,
        required: true,
        cue: volReadouts,
      },
      {
        id: 'h-vs',
        text: `${SEDENTARY.name} ${S_SCORE}`,
        tone: 'legend',
        color: PAL.chalk,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 1,
        required: true,
        cue: volReadouts,
      },
      {
        id: 'h-fit',
        text: 'Fitness at age 20 ' + fitnessAt(LIFELONG, 20),
        tone: 'readout',
        size: 'sm',
        color: PAL.well,
        minChars: 20,
        anchor: (T) => {
          const a = ageSliceAge(T)
          return [xOf(0.36, XW), capAt(T, 0.36, a) * YS + 0.06, zOfAge(a)]
        },
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 10,
        leader: true,
        cue: (T) => (T >= B.hold ? ageSliceOn(T) : 0),
      },
      {
        id: 'h-i90',
        text: `Independent through ${LIFELONG.independentThrough}`,
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: (T) => onLand(T, 0.62, 44, W, 0.2),
        prefer: 'N',
        gapPx: 12,
        leader: true,
        required: true,
        cue: indep90,
      },
    )
    return out
  }, [W])
  useLabels(specs)

  // "Fitness at age N" follows the slice: its text is a pure function of T
  useEffect(
    () =>
      onFrame(() => {
        if (explore()) return
        const T = clock.T
        if (T < B.hold) return
        const a = Math.round(ageSliceAge(T))
        setLabelText('h-fit', `Fitness at age ${a} ${fitnessAt(LIFELONG, a)}`)
      }),
    [],
  )

  // labels never sit on the landscape's front edge or on the red line
  const marks = useMemo<WorldObstacle>(
    () => ({
      points: (T, o) => {
        if (T < B.stack && !explore()) return 0
        let n = 0
        for (let i = 0; i <= 12; i++) {
          const u = i / 12
          o[n * 3] = xOf(u, W.XW)
          o[n * 3 + 1] = (explore() ? sampleGrid(HS.grid, u, 20) : capAt(T, u, 20)) * W.YS
          o[n * 3 + 2] = Z0
          n++
        }
        return n
      },
      maxPoints: 13,
      radiusPx: 5,
      mode: 'both',
    }),
    [W],
  )
  useWorldObstacle('health-front', marks)
}

/* ------------------------------- explore ------------------------------- */

/** Explore labels: the amber slice's age (the drag handle) and the independence line. */
export function useHealthExploreLabels(W: World): void {
  const specs = useMemo<LabelSpec[]>(() => {
    const { XW, YS } = W
    const LINE_Y = INDEPENDENCE_LINE * YS
    return [
      {
        id: 'hx-age',
        text: 'AGE 45',
        tone: 'callout',
        color: PAL.well,
        anchor: () => [xOf(0.3, XW), sampleGrid(HS.grid, 0.3, HS.sliceAge) * YS + 0.06, zOfAge(HS.sliceAge)],
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 12,
        leader: true,
        required: true,
        cue: () => HS.sliceOp,
      },
      {
        id: 'hx-line',
        text: 'INDEPENDENCE LINE',
        tone: 'callout',
        color: PAL.sick,
        anchor: [xOf(0.5, XW), LINE_Y, Z0],
        prefer: 'S',
        only: ['S', 'SE', 'SW', 'N'],
        gapPx: 8,
        cue: () => (HS.planeOp > 0.5 ? HS.planeOp : 0),
      },
    ]
  }, [W])
  useLabels(specs, { mode: 'explore' })
  useEffect(
    () =>
      onFrame(() => {
        if (!explore()) return
        setLabelText('hx-age', `AGE ${Math.round(HS.sliceAge)}`)
      }),
    [],
  )
}

