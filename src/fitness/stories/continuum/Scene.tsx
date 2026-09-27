import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { at, focus, pulse } from '../../story/cue'
import { ease } from '../../story/ease'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useSafeFrame } from '../../story/useSafeFrame'
import { frameId, useChartFrame, type ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Glows } from '../../story/kit/Halo'
import { impactK } from '../../story/kit/impact'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box, Dir, LabelSpec, Layout, Tier, V3 } from '../../story/types'
import {
  ATHLETE,
  AVERAGE,
  BODY_FAT,
  BP,
  BP_READINGS,
  FAT_READINGS,
  FAT_STATIONS,
  N,
  STATES,
  STOPS,
  STOP_FIT,
  STOP_WELL,
  betterText,
  shortName,
  spectrumHex,
  spectrumLinear,
  tickText,
  valueText,
} from './continuumMath'
import { R, ROWS_FRAME, bowl, dialPoint, keyMode, newXf, radiusOf, rowPoint, rowXf, shortStage, spokeAngle } from './layout'
import {
  B,
  CASCADE,
  WORD_ATHLETE,
  WORD_WELL,
  bandOn,
  betterCallout,
  bpBead,
  bpScale,
  c0Callout,
  centreCallout,
  discIn,
  dotAppear,
  fatBead,
  fatScale,
  fillIn,
  ghostIn,
  morphK,
  orbOn,
  outlineDraw,
  personMean,
  personOn,
  personPos,
  pitDark,
  preventiveCallout,
  rowDraw,
  rowNamesOut,
  rowYAt,
  spokeRest,
  stationFlare,
  tipNames,
  wordRise,
  wordSwap,
  wordVis,
} from './timeline'
import { Disc, LIGHT, Person, SpokeHighlight, sizesFor, type PersonSrc } from './dial'
import { clearSpoke, keySel } from './keySel'
import { TintDots } from './kitx'
import ExploreScene from './ExploreScene'

/* =========================================================================
   05 CONTINUUM, "From one line to the dial" (DESIGN.md D.6). Every property
   is a pure function of story time T (timeline.ts). One per-row transform
   (layout.ts rowXf) carries each row from the parallel chart into its spoke:
   the line, its ticks, its bead and its labels all ride it.

   Prewarm (README): the rows, the dial, the person, the four state words and
   the explore layer are all mounted at load; T and the mode drive visibility.
   ========================================================================= */

const ROW_SEGS = 24
const ROW_PTS = ROW_SEGS + 1
/** far outside every view: where a segment waits until it is drawn */
const AWAY = 1e5
const TICK_H = 0.17

const STATION_COLORS = [PAL.sick, PAL.well, PAL.fit]
const xfA = newXf()
const xfB = newXf()
const _v: number[] = [0, 0, 0]

/** Per-point spectrum colours along a row (linear), sick at the left end. */
function rowPointColors(): Float32Array {
  const a = new Float32Array(ROW_PTS * 3)
  const c = new THREE.Color()
  for (let j = 0; j < ROW_PTS; j++) {
    spectrumLinear(j / ROW_SEGS, c)
    a.set([c.r, c.g, c.b], j * 3)
  }
  return a
}

/** Where a row rests: dimmed under a later beat's build (L3) and as the instrument behind the person (C4 on). */
const bornFocus = (T: number, i: number) => (i === BP ? focus(T, B.bp) : i === BODY_FAT ? focus(T, B.fat) : focus(T, B.dial))
const rowDim = (T: number, i: number) => Math.max(0.3, bornFocus(T, i) * spokeRest(T))

/** Row i's transform at T (rows phase through the morph). */
const xfAt = (T: number, i: number, f: ChartFrame, out = xfA) => rowXf(i, morphK(T, i), f, rowYAt(T, i), out)

/** Anchor factory: point u along row i at T (labels ride the row transform). */
const rowAnchor = (f: ChartFrame, i: number, u: number | ((T: number) => number), lift = 0) => (T: number): V3 => {
  xfAt(T, i, f, xfB)
  rowPoint(xfB, typeof u === 'function' ? u(T) : u, _v, 0, lift)
  return [_v[0], _v[1], _v[2]]
}

/* ------------------------------- rows --------------------------------- */

function useRowWriter(f: ChartFrame, i: number) {
  const last = useRef('')
  return (T: number, pts: Float32Array): boolean => {
    const k = morphK(T, i)
    const y = rowYAt(T, i)
    const key = frameId(f) + '|' + k + '|' + y
    if (key === last.current) return false
    last.current = key
    rowXf(i, k, f, y, xfA)
    for (let j = 0; j < ROW_PTS; j++) rowPoint(xfA, j / ROW_SEGS, pts, j * 3)
    return true
  }
}

function Rows({ frame }: { frame: ChartFrame }) {
  const colors = useMemo(() => rowPointColors(), [])
  const bpPts = useMemo(() => new Float32Array(ROW_PTS * 3), [])
  const fatPts = useMemo(() => new Float32Array(ROW_PTS * 3), [])
  const writeBp = useRowWriter(frame, BP)
  const heroPts = useMemo(() => new Float32Array(ROW_PTS * 3), [])
  const writeHero = useRowWriter(frame, BP)
  const writeFat = useRowWriter(frame, BODY_FAT)

  // the eight cascade rows: one batch, each row clipped to its own draw progress
  const batch = useMemo(() => {
    const segs = new Float32Array(CASCADE.length * ROW_SEGS * 6).fill(AWAY)
    const cols = new Float32Array(segs.length)
    CASCADE.forEach((_, j) => {
      for (let s = 0; s < ROW_SEGS; s++) {
        const o = (j * ROW_SEGS + s) * 6
        cols.set(colors.subarray(s * 3, s * 3 + 6), o)
      }
    })
    return { segs, cols }
  }, [colors])
  const lastC = useRef('')
  const writeCascade = (T: number, segs: Float32Array): boolean => {
    const key = frameId(frame) + '|' + T
    if (key === lastC.current) return false
    lastC.current = key
    for (let j = 0; j < CASCADE.length; j++) {
      const i = CASCADE[j]
      const d = rowDraw(T, i)
      xfAt(T, i, frame)
      const cut = d * ROW_SEGS
      for (let s = 0; s < ROW_SEGS; s++) {
        const o = (j * ROW_SEGS + s) * 6
        if (s >= cut) {
          segs.fill(AWAY, o, o + 6)
          continue
        }
        rowPoint(xfA, s / ROW_SEGS, segs, o)
        rowPoint(xfA, Math.min((s + 1) / ROW_SEGS, d), segs, o + 3)
      }
    }
    return true
  }
  const dimC = (T: number) => Math.max(0.3, focus(T, B.dial) * spokeRest(T))

  return (
    <>
      {/* the one line (C0) is the hero pen (4.5 px, glowing, the only idea on the slate); as it
          becomes systolic blood pressure (C1) it hands over to the 3 px data row drawn under it */}
      <Pen points={heroPts} pointColors={colors} width={PEN.hero} update={writeHero} progress={(T) => rowDraw(T, BP)} opacity={(T) => 1 - at(T, B.bp, 0, 0.16)} gain={() => 1.45} head hot renderOrder={33} />
      <Pen points={bpPts} pointColors={colors} width={PEN.data} update={writeBp} progress={(T) => rowDraw(T, BP)} dim={(T) => rowDim(T, BP)} renderOrder={32} />
      <Pen points={fatPts} pointColors={colors} width={PEN.data} update={writeFat} progress={(T) => rowDraw(T, BODY_FAT)} dim={(T) => rowDim(T, BODY_FAT)} head hot renderOrder={32} />
      <PenBatch segments={batch.segs} colors={batch.cols} width={PEN.data} update={writeCascade} dim={dimC} renderOrder={32} />
      {/* the cascade's pen tips: one light per drawing row, one draw call */}
      <Glows
        count={CASCADE.length}
        sizePx={30}
        colors={[LIGHT]}
        gain={1.5}
        place={(T, j, out) => {
          const i = CASCADE[j]
          const d = rowDraw(T, i)
          if (d <= 0 || d >= 1) return 0
          xfAt(T, i, frame)
          rowPoint(xfA, d, _v, 0, 0.04)
          out[0] = _v[0]
          out[1] = _v[1]
          out[2] = _v[2]
          return Math.min(1, d / 0.04, (1 - d) / 0.04)
        }}
      />
    </>
  )
}

/** Tick marks at the four stations of every row, perpendicular to it; they ride the morph (0.5 and 0.82 become the WELL and FIT crossings). */
function Ticks({ frame }: { frame: ChartFrame }) {
  const segs = useMemo(() => new Float32Array(N * STOPS.length * 6).fill(AWAY), [])
  const last = useRef('')
  const write = (T: number, s: Float32Array): boolean => {
    const key = frameId(frame) + '|' + T
    if (key === last.current) return false
    last.current = key
    for (let i = 0; i < N; i++) {
      const d = rowDraw(T, i)
      const k = morphK(T, i)
      xfAt(T, i, frame)
      for (let st = 0; st < STOPS.length; st++) {
        const o = (i * STOPS.length + st) * 6
        const u = STOPS[st]
        // C0 shows three stations (sick, well, fit); the 0.82 tick joins with the BP scale in C1
        const late = i === BP && st === 2 ? at(T, B.bp, 0.02, 0.14) : 1
        // the hub ticks leave as the rows converge on the centre
        const hub = st === 0 && k > 0.06
        if (d <= 0 || d < u - 1e-6 || late <= 0 || hub) {
          s.fill(AWAY, o, o + 6)
          continue
        }
        const grow = (d >= 0.9999 ? 1 : Math.min(1, (d - u) / 0.035)) * late
        const h = TICK_H * Math.max(0.15, grow)
        rowPoint(xfA, u, _v, 0, 0.01)
        const nx = -xfA.s * h
        const ny = xfA.c * h
        s[o] = _v[0] - nx
        s[o + 1] = _v[1] - ny
        s[o + 2] = _v[2]
        s[o + 3] = _v[0] + nx
        s[o + 4] = _v[1] + ny
        s[o + 5] = _v[2]
      }
    }
    return true
  }
  return <PenBatch segments={segs} color={PAL.chalk} width={PEN.axis} update={write} opacity={() => 0.62} dim={(T) => Math.max(0.45, spokeRest(T))} renderOrder={33} />
}

/**
 * The station COLUMNS (sick, well, fit, elite): faint lines that join the
 * same station on neighbouring rows. They first appear in C2 between blood
 * pressure and body fat (the same ordering, drawn), run through every row
 * in C3, and, because each connector is built from the SAME interpolated row
 * transform, the morph bends them into rings: the hub ring (sick), the WELL
 * circle, the FIT circle and the rim (elite). A short closing arc completes
 * each ring where the fan meets itself (between the last and first spokes).
 */
const COL_SUB = 6
const COL_STOPS = [0, STOP_WELL, STOP_FIT, 1]
/** the rim is construction: a softer chalk, so the WELL and FIT rings lead */
const COL_COLORS = [PAL.sick, PAL.well, PAL.fit, '#aeb9be']
const CLOSE_SUB = 10
/** C2: the two rows' columns appear once body fat is drawn, one station after another. */
const pairGate = (T: number, s: number) => at(T, B.fat, 0.42 + 0.05 * s, 0.56 + 0.05 * s)
/** The rings close at the end of the morph. */
const ringsClose = (T: number) => at(T, B.dial, 0.84, 0.96, ease.draw)

function Columns({ frame }: { frame: ChartFrame }) {
  const nPair = (N - 1) * COL_SUB
  const perStation = nPair + CLOSE_SUB
  const { segs, cols } = useMemo(() => {
    const segs = new Float32Array(COL_STOPS.length * perStation * 6).fill(AWAY)
    const cols = new Float32Array(segs.length)
    const c = new THREE.Color()
    COL_STOPS.forEach((_, s) => {
      c.set(COL_COLORS[s])
      for (let k = 0; k < perStation; k++) cols.set([c.r, c.g, c.b, c.r, c.g, c.b], (s * perStation + k) * 6)
    })
    return { segs, cols }
  }, [perStation])
  const last = useRef('')
  const pt = (fi: number, k: number, y: number, u: number, out: Float32Array, o: number) => {
    rowXf(fi, k, frame, y, xfB)
    rowPoint(xfB, u, out, o, 0.008)
  }
  const write = (T: number, s: Float32Array): boolean => {
    const key = frameId(frame) + '|' + T
    if (key === last.current) return false
    last.current = key
    for (let st = 0; st < COL_STOPS.length; st++) {
      const u = COL_STOPS[st]
      const base = st * perStation
      for (let i = 0; i < N - 1; i++) {
        const d = Math.min(rowDraw(T, i), rowDraw(T, i + 1))
        const gate = i === BP ? pairGate(T, st) : 1
        const frac = Math.max(0, Math.min(1, (d - u) / 0.06 + (d >= 0.9999 ? 1 : 0))) * gate
        const ka = morphK(T, i)
        const kb = morphK(T, i + 1)
        const ya = rowYAt(T, i)
        const yb = rowYAt(T, i + 1)
        for (let j = 0; j < COL_SUB; j++) {
          const o = (base + i * COL_SUB + j) * 6
          const f0 = j / COL_SUB
          if (frac <= 0 || f0 >= frac) {
            s.fill(AWAY, o, o + 6)
            continue
          }
          const f1 = Math.min((j + 1) / COL_SUB, frac)
          pt(i + f0, ka + (kb - ka) * f0, ya + (yb - ya) * f0, u, s, o)
          pt(i + f1, ka + (kb - ka) * f1, ya + (yb - ya) * f1, u, s, o + 3)
        }
      }
      // the closing arc, from the last spoke round to the first
      const cp = ringsClose(T)
      for (let j = 0; j < CLOSE_SUB; j++) {
        const o = (base + nPair + j) * 6
        const f0 = j / CLOSE_SUB
        if (cp <= 0 || f0 >= cp) {
          s.fill(AWAY, o, o + 6)
          continue
        }
        const f1 = Math.min((j + 1) / CLOSE_SUB, cp)
        pt(N - 1 + f0, 1, 0, u, s, o)
        pt(N - 1 + f1, 1, 0, u, s, o + 3)
      }
    }
    return true
  }
  // faint while they are guides between rows, full as rings
  const dim = (T: number) => (0.42 + 0.58 * at(T, B.dial, 0.6, 0.9)) * Math.max(0.6, spokeRest(T))
  return (
    <>
      <PenBatch segments={segs} colors={cols} width={PEN.axis} update={write} dim={dim} opacity={(T) => (T < B.fat ? 0 : 0.95)} renderOrder={31} />
      {/* the pen tips closing each ring */}
      <Glows
        count={COL_STOPS.length}
        sizePx={26}
        colors={COL_COLORS.map((c, s) => (s === COL_STOPS.length - 1 ? LIGHT : c))}
        gain={1.7}
        place={(T, s, out) => {
          const cp = ringsClose(T)
          if (cp <= 0 || cp >= 1) return 0
          pt(N - 1 + cp, 1, 0, COL_STOPS[s], _f3, 0)
          out[0] = _f3[0]
          out[1] = _f3[1]
          out[2] = _f3[2] + 0.04
          return Math.min(1, cp / 0.08, (1 - cp) / 0.08)
        }}
      />
    </>
  )
}
const _f3 = new Float32Array(3)

/** The C1 and C2 beads: a dot in spectrum(u) that slides along its row and reads the worked examples. */
function Beads({ frame, layout }: { frame: ChartFrame; layout: Layout }) {
  const S = sizesFor(layout)
  const beads = [bpBead, fatBead]
  const place = (T: number, j: number, out: [number, number, number]) => {
    const b = beads[j]
    xfAt(T, b.row, frame)
    rowPoint(xfA, b.u(T), _v, 0, 0.05)
    out[0] = _v[0]
    out[1] = _v[1]
    out[2] = _v[2]
    return b.appear(T) * (1 + 0.25 * b.hot(T))
  }
  return (
    <>
      <TintDots site="continuum beads" count={2} radius={S.bead} place={place} tint={(T, j, c) => void spectrumLinear(beads[j].u(T), c)} emissiveIntensity={0.55} />
      <Glows
        count={2}
        sizePx={layout === 'P' ? 40 : 52}
        colors={[LIGHT]}
        gain={1.9}
        place={(T, j, out) => {
          const b = beads[j]
          place(T, j, out)
          out[2] += 0.05
          return b.hot(T) * Math.min(1, b.appear(T))
        }}
      />
    </>
  )
}

/** C0: each station flares in its own colour as the pen head passes it. */
function StationFlares({ frame }: { frame: ChartFrame }) {
  return (
    <Glows
      count={3}
      sizePx={46}
      colors={STATION_COLORS}
      gain={1.6}
      place={(T, k, out) => {
        xfAt(T, BP, frame)
        rowPoint(xfA, [0, 0.5, 1][k], _v, 0, 0.04)
        out[0] = _v[0]
        out[1] = _v[1]
        out[2] = _v[2]
        return stationFlare(T, k)
      }}
    />
  )
}

/* ------------------------------ the person ----------------------------- */

const _cA = new THREE.Color()
const _cB = new THREE.Color()
const COL_WELL = new THREE.Color(STATES[WORD_WELL].css)
const COL_ATH = new THREE.Color(STATES[WORD_ATHLETE].css)
/** The claim lands in C4 (the orb lights, the word rises), and the C5 impact accent. */
const claimHot = (T: number) => 0.9 * pulse(T, B.well + 0.84, B.well + 1.0) + impactK(T)

const STORY_PERSON: PersonSrc = {
  pos: personPos,
  key: (T) => T,
  mean: personMean,
  dotScale: dotAppear,
  outline: outlineDraw,
  outlineHot: true,
  fill: fillIn,
  orb: orbOn,
  hot: claimHot,
  orbColor: (T, out) => {
    _cA.copy(COL_WELL)
    _cB.copy(COL_ATH)
    out.copy(_cA).lerp(_cB, wordSwap(T))
  },
  word: wordVis,
  wordLift: wordRise,
  ghost: ghostIn,
  ghostPositions: AVERAGE.positions,
  vis: personOn,
  cut: bandOn,
  highlight: () => keySel.i,
}

/* ------------------------------- labels -------------------------------- */

/** Tangential side for a label beside dot i (clockwise of its spoke). */
function sideOf(i: number): Dir {
  const a = ((((spokeAngle(i) / Math.PI) * 180 - 90) % 360) + 360) % 360
  const dirs: Dir[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE']
  return dirs[Math.round(a / 45) % 8]
}

function useStoryLabels(rf: ChartFrame, layout: Layout) {
  const key = keyMode()
  // values beside the dots need a tall landscape stage (a phone on its side shows the HUD score only)
  const dotValues = !key && !shortStage()
  const specs = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = []
    // C0: the three stations of the one continuum
    ;['SICKNESS', 'WELLNESS', 'FITNESS'].forEach((text, k) => {
      const only: Dir[] = k === 0 ? ['N', 'NE'] : k === 1 ? ['N'] : ['N', 'NW']
      out.push({ id: `c-c0-${k}`, text, tone: 'callout', color: STATION_COLORS[k], anchor: rowAnchor(rf, BP, [0, 0.5, 1][k]), prefer: only[0], only, gapPx: 14, cue: (T) => c0Callout(T, k) })
    })
    // C1 / C2: each featured row's scale, below the line (ticks at sick, well, fit, elite)
    const scale = (row: number, cue: (T: number) => number, tag: string) =>
      STOPS.forEach((u, s) =>
        out.push({ id: `c-${tag}-t${s}`, text: tickText(row, s), tone: 'tick', anchor: rowAnchor(rf, row, u), prefer: 'S', only: ['S'], gapPx: 9, priority: 80, cue }),
      )
    scale(BP, bpScale, 'bp')
    scale(BODY_FAT, fatScale, 'bf')
    // the bead reads the worked examples as it passes the stations
    BP_READINGS.forEach((text, k) =>
      out.push({
        id: `c-bpb-${k}`,
        text,
        tone: 'callout',
        color: STATION_COLORS[k],
        anchor: rowAnchor(rf, BP, bpBead.u, 0.05),
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 28,
        leader: 'always',
        priority: 92,
        cue: (T) => bpBead.callout(T, k),
      }),
    )
    FAT_READINGS.forEach((v, k) =>
      out.push({
        id: `c-bfb-${k}`,
        text: `${v}%`,
        tone: 'callout',
        color: k < 2 ? STATION_COLORS[k] : spectrumHex(FAT_STATIONS[k]),
        anchor: rowAnchor(rf, BODY_FAT, fatBead.u, 0.05),
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 28,
        leader: 'always',
        priority: 92,
        cue: (T) => fatBead.callout(T, k),
      }),
    )
    // C2 claim: the direction of better, from betterDirection
    out.push({
      id: 'c-better',
      text: betterText(BODY_FAT),
      tone: 'callout',
      color: PAL.yellowGreen,
      anchor: rowAnchor(rf, BODY_FAT, 0),
      prefer: 'SE',
      only: ['SE'],
      gapPx: 40,
      priority: 88,
      cue: betterCallout,
    })
    // row names ride the row start in the parallel phase
    for (let i = 0; i < N; i++) {
      const cue =
        i === BP
          ? (T: number) => at(T, B.bp, 0.06, 0.2) * rowNamesOut(T)
          : i === BODY_FAT
            ? (T: number) => at(T, B.fat, 0.3, 0.44) * rowNamesOut(T)
            : (T: number) => Math.min(1, rowDraw(T, i) * 3) * rowNamesOut(T)
      out.push({ id: `c-rn-${i}`, text: shortName(i), tone: 'name', dot: false, anchor: rowAnchor(rf, i, 0), prefer: 'NE', only: ['NE'], gapPx: 7, priority: 70, cue })
    }
    // the dial: ten spoke names at the tips (radial)
    for (let i = 0; i < N; i++) {
      const a = spokeAngle(i)
      out.push({
        id: `c-tip-${i}`,
        text: shortName(i),
        tone: 'name',
        color: PAL.chalk,
        dot: false,
        anchor: [R * Math.cos(a), R * Math.sin(a), 0],
        prefer: 'radial',
        center: [0, 0, 0],
        gapPx: 9,
        required: true,
        priority: 75,
        cue: tipNames,
      })
    }
    // the WELL and FIT circles, named where they cross the gap between the first and last spokes
    const circ = (id: string, text: string, color: string, p: number) => {
      const a = 108 * (Math.PI / 180)
      const r = radiusOf(p)
      out.push({ id, text, tone: 'name', color, anchor: [r * Math.cos(a), r * Math.sin(a), bowl(r)], prefer: 'C', gapPx: 0, priority: 64, cue: (T) => at(T, B.dial, 0.92, 1.0) })
    }
    circ('c-well', STATES[1].word, PAL.well, STOP_WELL)
    circ('c-fit', STATES[2].word, PAL.fit, STOP_FIT)
    // the centre of the dial is sickness
    out.push({ id: 'c-centre', text: 'SICKNESS', tone: 'callout', color: PAL.sick, anchor: [0, 0, bowl(0)], prefer: 'C', priority: 91, cue: centreCallout })
    // landscape: each marker's live value beside its dot (portrait: the key)
    if (dotValues) {
      for (let i = 0; i < N; i++) {
        const side = sideOf(i)
        out.push({
          id: `c-val-${i}`,
          text: valueText(i, AVERAGE.positions[i]),
          tone: 'tick',
          anchor: (T: number) => {
            dialPoint(i, personPos(T, i), _v, 0, 0.06)
            return [_v[0], _v[1], _v[2]]
          },
          prefer: side,
          gapPx: 12,
          priority: 60,
          cue: (T) => at(T, B.well, 0.62, 0.74) * personOn(T),
        })
      }
    }
    // C6 claim: the lit margin is preventive medicine
    {
      const a = -72 * (Math.PI / 180)
      const r = (radiusOf(STOP_WELL) + radiusOf((ATHLETE.positions[4] + ATHLETE.positions[5]) / 2)) / 2
      out.push({
        id: 'c-prevent',
        text: 'Preventive medicine',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [r * Math.cos(a), r * Math.sin(a), bowl(r)],
        prefer: 'SE',
        gapPx: 30,
        leader: 'always',
        priority: 93,
        cue: preventiveCallout,
      })
    }
    return out
  }, [rf, layout, key, dotValues])
  useLabels(specs)

  // landscape values count with the dots (text from T, set before the labels place)
  const lastTxt = useRef<string[]>([])
  const lastT = useRef(-1)
  useSafeFrame(
    'continuum value labels',
    (T) => {
      if (!dotValues || T < B.well || T === lastT.current) return
      lastT.current = T
      for (let i = 0; i < N; i++) {
        const t = valueText(i, personPos(T, i))
        if (lastTxt.current[i] !== t) {
          lastTxt.current[i] = t
          setLabelText(`c-val-${i}`, t)
        }
      }
    },
    { priority: -85 },
  )
}

const BEADS = [bpBead, fatBead]
/** Write one obstacle point, return the new count (allocation-free). */
function put(out: Float32Array, n: number, x: number, y: number, z: number): number {
  out[n * 3] = x
  out[n * 3 + 1] = y
  out[n * 3 + 2] = z
  return n + 1
}

/** Data marks labels never cover: beads, the rim, the dots, the outline, the state word. */
function useStoryObstacles(rf: ChartFrame, layout: Layout) {
  const S = sizesFor(layout)
  const marks = useMemo<WorldObstacle>(
    () => ({
      maxPoints: 96,
      radiusPx: 7,
      points: (T, out) => {
        let n = 0
        // the beads
        for (let k = 0; k < BEADS.length; k++) {
          const b = BEADS[k]
          if (b.appear(T) < 0.05) continue
          xfAt(T, b.row, rf)
          rowPoint(xfA, b.u(T), _v, 0, 0.05)
          n = put(out, n, _v[0], _v[1], _v[2])
        }
        if (T >= B.dial + 0.8) {
          // the rim, so a spoke name never sits across it
          for (let j = 0; j < 32; j++) {
            const a = (j / 32) * Math.PI * 2
            n = put(out, n, R * Math.cos(a), R * Math.sin(a), 0)
          }
        }
        if (personOn(T)) {
          for (let i = 0; i < N; i++) {
            if (dotAppear(T, i) < 0.05) continue
            dialPoint(i, personPos(T, i), _v, 0, 0.06)
            n = put(out, n, _v[0], _v[1], _v[2])
            // the outline's midpoints
            const j = (i + 1) % N
            const ra = radiusOf(personPos(T, i))
            const rb = radiusOf(personPos(T, j))
            const x = (ra * Math.cos(spokeAngle(i)) + rb * Math.cos(spokeAngle(j))) / 2
            const y = (ra * Math.sin(spokeAngle(i)) + rb * Math.sin(spokeAngle(j))) / 2
            n = put(out, n, x, y, bowl(Math.hypot(x, y)))
          }
          // the orb
          n = put(out, n, 0, 0, bowl(0) + S.orb)
        }
        return n
      },
    }),
    [rf, S.orb],
  )
  useWorldObstacle('cont-marks', marks)
  const word = useMemo<WorldObstacle>(
    () => ({
      padPx: 6,
      box: (T): Box | null => {
        const lift = wordRise(T)
        if (lift < 0.05 || !personOn(T)) return null
        let chars = 0
        for (let k = 0; k < STATES.length; k++) if (wordVis(T, k) > 0.05) chars = Math.max(chars, STATES[k].word.length)
        const w = chars * S.word * 0.52
        if (!w) return null
        const y = 0.5 + (S.wordY - 0.5) * lift
        const z = bowl(0) + (0.55 - bowl(0)) * lift
        return [
          [-w / 2, y - S.word * 0.55, z],
          [w / 2, y + S.word * 0.55, z],
        ]
      },
    }),
    [S.word, S.wordY],
  )
  useWorldObstacle('cont-word', word)
}

/* ------------------------------- scene --------------------------------- */

/** The athlete polygon's radius on each spoke (for the C6 band in the disc shader). */
const ATHLETE_R = ATHLETE.positions.map((p) => radiusOf(p))

function StoryScene({ tier: _tier }: { tier: Tier }) {
  const { layout } = useBeat()
  const rf = useChartFrame(ROWS_FRAME)
  useStoryLabels(rf, layout)
  useStoryObstacles(rf, layout)
  const discVis = useMemo(() => ({ opacity: discIn, band: bandOn, pit: pitDark, polyR: ATHLETE_R }), [])
  return (
    <>
      <Disc vis={discVis} />
      <Rows frame={rf} />
      <Ticks frame={rf} />
      <Columns frame={rf} />
      <StationFlares frame={rf} />
      <Beads frame={rf} layout={layout} />
      <SpokeHighlight vis={tipNames} />
      <Person src={STORY_PERSON} layout={layout} site="continuum person" />
    </>
  )
}

export default function ContinuumScene() {
  const mode = useStoryStore((s) => s.mode)
  const tier = useStoryStore((s) => s.tier)
  // a highlighted spoke is the viewer's own choice: it never outlives the chapter
  useEffect(() => () => clearSpoke(), [])
  // Both layers stay mounted (prewarm); the mode only toggles visibility.
  return (
    <>
      <group visible={mode === 'story'}>
        <StoryScene tier={tier} />
      </group>
      <group visible={mode === 'explore'}>
        <ExploreScene />
      </group>
    </>
  )
}
