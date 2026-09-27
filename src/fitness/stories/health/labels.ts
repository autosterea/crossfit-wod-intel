import { useEffect, useMemo } from 'react'
import { PAL, agingCapacity } from '../../fitnessData'
import { focus } from '../../story/cue'
import { useStoryStore } from '../../story/store'
import { clock, onFrame } from '../../story/clock'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec, V3 } from '../../story/types'
import { LIFELONG, SEDENTARY, STARTS_50, fitnessAt, healthScore, sampleGrid } from './healthMath'
import { AGE_TICK, HANDLE_U, INDEPENDENCE_LINE, PLANE_FRONT, PLANE_M, PLANE_MR, POST_CAP, Z0, Z1, Z30, xOf, zOfAge, type World } from './layout'
import { HS } from './state'
import {
  B,
  G,
  GL,
  GS,
  ageSliceAge,
  ageTicks,
  age30,
  axesZ,
  axisTicks,
  capAt,
  chartSX,
  lostOutline,
  indep70,
  indep85,
  indep90,
  lineCallout,
  s50Name,
  sedName,
  volReadouts,
  ageSliceOn,
  sedTag6,
} from './timeline'

/* =========================================================================
   06 HEALTH labels (DESIGN.md D.7 lexicon): the axis strings ("1 s",
   "1 hr", DURATION, AGE, 20, 40, 60, 80, CAPACITY), AGE 30, INDEPENDENCE
   LINE, "Independent through X", the AGING_PROFILES names, "Fitness at age
   N" and the volume readouts (computed). Story anchors are pure functions of
   T (capAt), so a deep link places them exactly as a scrub does.

   "Independent through X" is a property of a PROFILE (F.5: never a surface
   crossing), so it lives in the pinned key with the profile, never on a
   point of the landscape.
   ========================================================================= */

const explore = () => useStoryStore.getState().mode === 'explore'
const L_SCORE = healthScore(LIFELONG)
const S_SCORE = healthScore(SEDENTARY)

/**
 * A per-label writer for anchors that move with T: the label layer projects
 * an anchor the moment it gets it, so each label reuses one array and the
 * frame loop allocates nothing.
 */
const pt = () => {
  const v: [number, number, number] = [0, 0, 0]
  return (x: number, y: number, z: number): V3 => {
    v[0] = x
    v[1] = y
    v[2] = z
    return v
  }
}

/** A point on the story landscape at (u, age), lifted by dy, written by `p`. */
const onLand = (p: ReturnType<typeof pt>, T: number, u: number, age: number, W: World, dy = 0): V3 =>
  p(xOf(u, W.XW), capAt(T, u, age) * W.YS + dy, zOfAge(age))

/** "Fitness at age N: V" (the readout riding the amber slice) */
const fitText = (a: number) => `Fitness at age ${a}: ${fitnessAt(LIFELONG, a)}`

export function useHealthLabels(W: World): void {
  const axes = useMemo<LabelSpec[]>(() => {
    const { XW, YS } = W
    const zAxis = (T: number) => (explore() ? Z0 : axesZ(T))
    // the L0 chart's x stretch on a portrait stage (chartSX), 1 from L1 on
    const sx = (T: number) => (explore() ? 1 : chartSX(T, W.key === 'narrow'))
    const tickCue = (T: number) => (explore() ? 1 : axisTicks(T) * focus(T, B.slice))
    const ageCue = (T: number) => (explore() ? 1 : ageTicks(T) * focus(T, B.stack))
    const p1s = pt()
    const p1hr = pt()
    const pDur = pt()
    const pCap = pt()
    const out: LabelSpec[] = [
      { id: 'h-1s', text: '1 s', tone: 'tick', anchor: (T) => p1s(-XW * sx(T), 0, zAxis(T)), prefer: 'S', only: ['S', 'SW', 'SE', 'W'], gapPx: 6, priority: 82, cue: tickCue },
      { id: 'h-1hr', text: '1 hr', tone: 'tick', anchor: (T) => p1hr(XW * sx(T), 0, zAxis(T)), prefer: 'S', only: ['S', 'SE', 'SW'], gapPx: 6, priority: 82, cue: tickCue },
      { id: 'h-dur', text: 'DURATION', tone: 'tick', anchor: (T) => pDur(0, 0, zAxis(T)), prefer: 'S', only: ['S'], gapPx: 8, priority: 81, cue: tickCue },
      // the capacity axis title over the post (the chart's y axis in L0, the solid's front-left edge from L1)
      {
        id: 'h-cap',
        text: 'CAPACITY',
        tone: 'tick',
        anchor: (T) => pCap(-XW * sx(T), POST_CAP * YS, zAxis(T)),
        prefer: 'N',
        only: ['N', 'NE', 'NW', 'W'],
        gapPx: 8,
        priority: 88,
        cue: tickCue,
      },
    ]
    ;[20, 40, 60, 80].forEach((a) =>
      out.push({
        id: 'h-age-' + a,
        text: String(a),
        tone: 'tick',
        anchor: [XW + AGE_TICK, 0, zOfAge(a)],
        prefer: 'E',
        only: ['E', 'SE', 'NE'],
        gapPx: 5,
        priority: 80,
        cue: ageCue,
      }),
    )
    out.push({
      id: 'h-age',
      text: 'AGE',
      tone: 'tick',
      // the axis title stands in the tick column between 60 and 80, left-aligned with the ticks:
      // clear of the back-right corner (its post, the plane's corner and the skyline's end, which
      // struck through it when it was centred over the corner), and the phone has no room east of
      // the column
      anchor: [XW + AGE_TICK, 0, zOfAge(70)],
      prefer: 'E',
      only: ['E'],
      gapPx: 5,
      priority: 79,
      cue: ageCue,
    })
    return out
  }, [W])
  useLabels(axes, { mode: 'both' })

  const specs = useMemo<LabelSpec[]>(() => {
    const { XW, YS } = W
    const LINE_Y = INDEPENDENCE_LINE * YS
    const pSed = pt()
    const pSed6 = pt()
    const pS50 = pt()
    const pFit = pt()
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
    // L3: the independence line, named just under the red edge it names, in the zone below the line
    // (the front wall), where it stays put from L3 to L6 and never lands on the lid
    out.push({
      id: 'h-line',
      text: 'INDEPENDENCE LINE',
      tone: 'callout',
      color: PAL.sick,
      anchor: [xOf(0.5, XW), LINE_Y, Z0 + PLANE_FRONT],
      prefer: 'S',
      // a short focus rect (the expanded caption) makes the pill as wide as the front; it then hangs to a side
      only: ['S', 'SE', 'SW'],
      gapPx: 4,
      leader: true,
      required: true,
      cue: (T) => (explore() ? 0 : lineCallout(T) * (1 - 0.5 * (1 - focus(T, B.line)))),
    })
    // L4: the Sedentary landscape, and its independence in the key
    out.push(
      {
        id: 'h-sed',
        text: SEDENTARY.name,
        tone: 'name',
        color: PAL.chalk,
        anchor: (T) => onLand(pSed, T, 0.24, 56, W, 0.1),
        prefer: 'N',
        gapPx: 12,
        leader: true,
        priority: 70,
        required: true,
        cue: sedName,
      },
      // each "Independent through X" row carries its profile's dot (Sedentary: chalk, like its name
      // and its dashed outline; the lifted and lifelong landscapes: yellow-green)
      {
        id: 'h-i70',
        text: `Independent through ${SEDENTARY.independentThrough}`,
        tone: 'legend',
        color: PAL.chalk,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 1,
        required: true,
        cue: indep70,
      },
    )
    // L5: the landscape lifted from 50, and its independence in the key
    out.push(
      {
        id: 'h-s50',
        text: STARTS_50.name,
        tone: 'name',
        color: PAL.yellowGreen,
        // on the lifted plateau just behind the step, mid-lid: clear of the corners the key and the HUD hold
        anchor: (T) => onLand(pS50, T, 0.42, 60, W, 0.1),
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
        tone: 'legend',
        color: PAL.yellowGreen,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 0,
        required: true,
        cue: indep85,
      },
    )
    // L6: hold it; the key (each profile with its volume, the lifelong one with its independence)
    out.push(
      {
        id: 'h-vl',
        text: `${LIFELONG.name}: ${L_SCORE}`,
        tone: 'legend',
        color: PAL.yellowGreen,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 0,
        required: true,
        cue: volReadouts,
      },
      {
        id: 'h-i90',
        text: `Independent through ${LIFELONG.independentThrough}`,
        tone: 'legend',
        color: PAL.yellowGreen,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 1,
        required: true,
        cue: indep90,
      },
      {
        id: 'h-vs',
        text: `${SEDENTARY.name}: ${S_SCORE}`,
        tone: 'legend',
        color: PAL.chalk,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 2,
        required: true,
        cue: volReadouts,
      },
      // the dashed Sedentary outline under the lifelong solid is named again, so "Sedentary: 12" has a referent
      {
        id: 'h-sed6',
        text: SEDENTARY.name,
        tone: 'name',
        color: PAL.chalk,
        // on the 1 hr wall, just over the dashed edge it names (the front belongs to the axis and the
        // independence callout)
        anchor: () => pSed6(XW, sampleGrid(G[GS], 1, 32) * YS + 0.02, zOfAge(32)),
        prefer: 'NW',
        only: ['NW', 'W', 'N'],
        gapPx: 6,
        leader: true,
        priority: 70,
        cue: sedTag6,
      },
      {
        id: 'h-fit',
        text: fitText(20),
        tone: 'readout',
        size: 'sm',
        color: PAL.well,
        minChars: 22,
        anchor: (T) => {
          const a = ageSliceAge(T)
          return pFit(xOf(0.5, XW), capAt(T, 0.5, a) * YS + 0.06, zOfAge(a))
        },
        // it hangs under the slice line it names, to the side the line rises toward (above it, the
        // pill crossed the line where the slice climbs to the power ridge, and at 85 the key and the
        // HUD fill the space above)
        // the diagonal pair clears a line that falls to the right: down-left where it fits, else up-right
        // (slid inside the focus rect on a narrow phone, with its leader); S and SE are fallbacks
        prefer: 'NE',
        only: ['NE', 'SW', 'S', 'SE'],
        gapPx: 12,
        leader: true,
        cue: (T) => (T >= B.hold ? ageSliceOn(T) : 0),
      },
    )
    return out
  }, [W])
  useLabels(specs)

  // "Fitness at age N: V" follows the slice: a pure function of T, written only when N changes. The
  // writer belongs to THIS registration of the specs: a world change (a rotation across the portrait
  // threshold) registers them again with their initial text, so the writer restarts with them and
  // writes the current value on its first frame (it used to keep the old age and never rewrote it).
  useEffect(() => {
    let lastAge = -1
    return onFrame(() => {
      if (explore()) return
      const T = clock.T
      if (T < B.hold) return
      const a = Math.round(ageSliceAge(T))
      if (a === lastAge) return
      lastAge = a
      setLabelText('h-fit', fitText(a))
    })
  }, [specs])

  // labels never sit on the landscape's front edge, its power ridge (the left
  // edge), the capacity post, the back-right corner (its post, the plane's
  // corner, the skyline's end) or the lost Lifelong box's posts (L4)
  const marks = useMemo<WorldObstacle>(
    () => ({
      points: (T, o) => {
        const ex = explore()
        let n = 0
        if (T < B.stack && !ex) {
          // L0: only the capacity axis (labels keep off the chart's y axis)
          const x = -W.XW * chartSX(T, W.key === 'narrow')
          for (let k = 1; k <= 8; k++) {
            o[n * 3] = x
            o[n * 3 + 1] = (POST_CAP * W.YS * k) / 8
            o[n * 3 + 2] = Z30
            n++
          }
          return n
        }
        // the front edge; from L3 not where it dips to the red line (the independence callout hangs
        // under the line there, on the front wall, and names the line, not the lid)
        const edgeFloor = ex || T >= B.line ? (INDEPENDENCE_LINE + 0.035) * W.YS : -1
        for (let i = 0; i <= 12; i++) {
          const u = i / 12
          const y = (ex ? sampleGrid(HS.grid, u, 20) : capAt(T, u, 20)) * W.YS
          if (y < edgeFloor) continue
          o[n * 3] = xOf(u, W.XW)
          o[n * 3 + 1] = y
          o[n * 3 + 2] = Z0
          n++
        }
        for (let k = 1; k <= 10; k++) {
          const age = 20 + (65 * k) / 10
          o[n * 3] = -W.XW
          o[n * 3 + 1] = (ex ? sampleGrid(HS.grid, 0, age) : capAt(T, 0, age)) * W.YS
          o[n * 3 + 2] = zOfAge(age)
          n++
        }
        const h = POST_CAP * W.YS
        const z = ex ? Z0 : axesZ(T)
        for (let k = 1; k <= 8; k++) {
          o[n * 3] = -W.XW
          o[n * 3 + 1] = (h * k) / 8
          o[n * 3 + 2] = z
          n++
        }
        // the back-right corner: its post up to the skyline, and the plane's corner
        if (ex || T >= B.stack + 0.3) {
          const top = (ex ? sampleGrid(HS.grid, 1, 85) : capAt(T, 1, 85)) * W.YS
          for (let k = 0; k <= 5; k++) {
            o[n * 3] = W.XW
            o[n * 3 + 1] = (top * k) / 5
            o[n * 3 + 2] = Z1
            n++
          }
          if (ex || T >= B.line) {
            o[n * 3] = W.XW + PLANE_MR
            o[n * 3 + 1] = INDEPENDENCE_LINE * W.YS
            o[n * 3 + 2] = Z1 - PLANE_M
            n++
          }
        }
        // L4: the lost Lifelong box's corner posts (from its rim down to the sinking surface)
        if (!ex && lostOutline(T) > 0.3) {
          for (let c = 0; c < 4; c++) {
            const u = c === 0 || c === 3 ? 0 : 1
            const age = c < 2 ? 20 : 85
            const top = sampleGrid(G[GL], u, age) * W.YS
            const bot = capAt(T, u, age) * W.YS
            for (let k = 0; k <= 3; k++) {
              o[n * 3] = xOf(u, W.XW)
              o[n * 3 + 1] = bot + ((top - bot) * k) / 3
              o[n * 3 + 2] = zOfAge(age)
              n++
            }
          }
        }
        return n
      },
      maxPoints: 64,
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
    const pAge = pt()
    return [
      {
        id: 'hx-age',
        text: 'AGE 50',
        tone: 'callout',
        color: PAL.well,
        anchor: () => pAge(xOf(HANDLE_U, XW), sampleGrid(HS.grid, HANDLE_U, HS.sliceAge) * YS + 0.06, zOfAge(HS.sliceAge)),
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 16,
        leader: true,
        required: true,
        cue: () => HS.sliceOp,
      },
      {
        id: 'hx-line',
        text: 'INDEPENDENCE LINE',
        tone: 'callout',
        color: PAL.sick,
        // as in the story: just under the red edge it names, on the front wall
        anchor: [xOf(0.4, XW), LINE_Y, Z0 + PLANE_FRONT],
        prefer: 'S',
        only: ['S', 'SW', 'SE'],
        gapPx: 4,
        cue: () => (HS.planeOp > 0.5 ? HS.planeOp : 0),
      },
    ]
  }, [W])
  useLabels(specs, { mode: 'explore' })
  // restarts with each registration of the specs (see the story writer above)
  useEffect(() => {
    let lastAge = -1
    return onFrame(() => {
      if (!explore()) return
      const a = Math.round(HS.sliceAge)
      if (a === lastAge) return
      lastAge = a
      setLabelText('hx-age', `AGE ${a}`)
    })
  }, [specs])
}

