import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { at, focus, pulse } from '../../story/cue'
import { useStoryStore } from '../../story/store'
import { gestureBus } from '../../story/gestures'
import { focusRect, subscribeFocus } from '../../story/camera/focusRect'
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
  BONE,
  BP,
  BP_READINGS,
  FAT_READINGS,
  FAT_STATIONS,
  HDL,
  N,
  STATES,
  STOPS,
  STOP_FIT,
  STOP_WELL,
  TRIGLYC,
  betterText,
  shortName,
  shortName2,
  spectrumHex,
  spectrumLinear,
  tickText,
  valueText,
} from './continuumMath'
import { COL_TOP, R, ROWS_FRAME, bowl, compactStage, dialPoint, keyMode, newXf, radiusOf, rowPoint, rowXf, shortStage, spokeAngle } from './layout'
import {
  B,
  CASCADE,
  MORPH_B,
  WORD_ATHLETE,
  WORD_WELL,
  bandOn,
  betterCallout,
  bpBead,
  bpName,
  bpScale,
  c0Callout,
  centreCallout,
  discIn,
  dotAppear,
  fatBead,
  fatName,
  fatScale,
  fillIn,
  ghostIn,
  guideGrow,
  heroOut,
  morphK,
  nameOn,
  newestDrawing,
  orbOn,
  outlineDraw,
  personKey,
  personMean,
  personOn,
  personPos,
  pitDark,
  pitShade,
  preventiveCallout,
  rimCallout,
  ringNames,
  ringsClose,
  rowDraw,
  rowYAt,
  spokeRest,
  stationFlare,
  tableValues,
  wellRingRest,
  wordLift,
  wordSwap,
  wordVis,
} from './timeline'
import { Disc, LIGHT, Person, PitShadow, RIM_COLOR, SpokeHighlight, sizesFor, type PersonSrc } from './dial'
import { clearSpoke, keySel } from './keySel'
import { TintDots } from './kitx'
import { OUTLINE_T } from './materials'
import ExploreScene from './ExploreScene'
import './continuum.css'

/* =========================================================================
   05 CONTINUUM, "From one line to the dial" (DESIGN.md D.6). Every property
   is a pure function of story time T (timeline.ts). One per-row transform
   (layout.ts rowXf) carries each row from the parallel chart into its spoke:
   the line, its ticks, its columns and its NAME all ride it, so the viewer
   can follow the HDL row into the HDL spoke.

   Prewarm (README): the rows, the dial, the person, the four state words and
   the explore layer are all mounted at load; T and the mode drive visibility.
   ========================================================================= */

const ROW_SEGS = 24
const ROW_PTS = ROW_SEGS + 1
/** far outside every view: where a segment waits until it is drawn */
const AWAY = 1e5
const TICK_H = 0.17
/** a line break inside a label (two-line names and ticks, see continuum.css) */
const NL = String.fromCharCode(10)

const STATION_COLORS = [PAL.sick, PAL.well, PAL.fit]
const xfA = newXf()
const xfB = newXf()
const _v: number[] = [0, 0, 0]
const _f3 = new Float32Array(3)

/** Rows, ticks and columns stop moving once the morph has landed: their writers key on this, not on T. */
const rowsKey = (T: number) => Math.min(T, B.dial + MORPH_B + 0.02)
const ringsKey = (T: number) => Math.min(T, B.dial + 0.97)

/** Per-point spectrum colours along a row (linear), sick at the left end. */
function rowPointColors(): Float32Array {
  const a = new Float32Array(ROW_PTS * 3)
  const c = new THREE.Color()
  for (let j = 0; j < ROW_PTS; j++) {
    spectrumLinear(j / ROW_SEGS, c)
    a[j * 3] = c.r
    a[j * 3 + 1] = c.g
    a[j * 3 + 2] = c.b
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

/* ------------------------------ C0 guides ------------------------------ */

const GUIDE_SEGS = 14
const GUIDE_STOPS = [0, STOP_WELL, STOP_FIT, 1]
const GUIDE_COLORS = [PAL.sick, PAL.well, PAL.fit, PAL.fit]

/**
 * The station columns of light (C0 to C3): each rises and falls from the
 * line where the pen passes its station, brightest at the line and fading
 * toward the ends, over the height the table will fill. One draw call.
 */
function Guides({ frame }: { frame: ChartFrame }) {
  const { segs, cols } = useMemo(() => {
    const segs = new Float32Array(GUIDE_STOPS.length * 2 * GUIDE_SEGS * 6).fill(AWAY)
    const cols = new Float32Array(segs.length)
    const c = new THREE.Color()
    const slate = new THREE.Color(PAL.ink)
    for (let s = 0; s < GUIDE_STOPS.length; s++) {
      for (let h = 0; h < 2; h++) {
        for (let j = 0; j < GUIDE_SEGS; j++) {
          const o = ((s * 2 + h) * GUIDE_SEGS + j) * 6
          for (let e = 0; e < 2; e++) {
            const f = (j + e) / GUIDE_SEGS
            // brightest at the line, a long fade to the slate at the ends
            c.set(GUIDE_COLORS[s]).lerp(slate, 1 - 0.55 * Math.pow(1 - f, 1.6))
            cols[o + e * 3] = c.r
            cols[o + e * 3 + 1] = c.g
            cols[o + e * 3 + 2] = c.b
          }
        }
      }
    }
    return { segs, cols }
  }, [])
  const last = useRef('')
  const write = (T: number, s: Float32Array): boolean => {
    const key = frameId(frame) + '|' + (T < B.dial + 0.5 ? T : -1)
    if (key === last.current) return false
    last.current = key
    for (let st = 0; st < GUIDE_STOPS.length; st++) {
      const g = guideGrow(T, st)
      const x = frame.x(GUIDE_STOPS[st])
      for (let h = 0; h < 2; h++) {
        const end = h === 0 ? COL_TOP : -COL_TOP
        for (let j = 0; j < GUIDE_SEGS; j++) {
          const o = ((st * 2 + h) * GUIDE_SEGS + j) * 6
          if (g <= 0.001) {
            s.fill(AWAY, o, o + 6)
            continue
          }
          s[o] = x
          s[o + 1] = (end * g * j) / GUIDE_SEGS
          s[o + 2] = -0.02
          s[o + 3] = x
          s[o + 4] = (end * g * (j + 1)) / GUIDE_SEGS
          s[o + 5] = -0.02
        }
      }
    }
    return true
  }
  return <PenBatch segments={segs} colors={cols} width={PEN.grid} update={write} opacity={(T) => (T < B.dial + 0.5 ? 1 : 0)} renderOrder={29} />
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
  const heroPts = useMemo(() => new Float32Array(ROW_PTS * 3), [])
  const heroFatPts = useMemo(() => new Float32Array(ROW_PTS * 3), [])
  const writeBp = useRowWriter(frame, BP)
  const writeHero = useRowWriter(frame, BP)
  const writeFat = useRowWriter(frame, BODY_FAT)
  const writeHeroFat = useRowWriter(frame, BODY_FAT)

  // the eight cascade rows: one batch, each row clipped to its own draw progress
  const batch = useMemo(() => {
    const segs = new Float32Array(CASCADE.length * ROW_SEGS * 6).fill(AWAY)
    const cols = new Float32Array(segs.length)
    for (let j = 0; j < CASCADE.length; j++) {
      for (let s = 0; s < ROW_SEGS; s++) cols.set(colors.subarray(s * 3, s * 3 + 6), (j * ROW_SEGS + s) * 6)
    }
    return { segs, cols }
  }, [colors])
  const lastC = useRef('')
  const writeCascade = (T: number, segs: Float32Array): boolean => {
    const key = frameId(frame) + '|' + rowsKey(T)
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
      {/* the featured rows are hero pens (4.5 px) while they are the subject (C0 to C2): the one line glows (HDR)
          while it is drawn; as the other rows arrive they hand over to the 3 px data rows under them */}
      <Pen
        points={heroPts}
        pointColors={colors}
        width={PEN.hero}
        update={writeHero}
        progress={(T) => rowDraw(T, BP)}
        opacity={heroOut}
        gain={(T) => 1 + 0.45 * (1 - at(T, B.bp, 0, 0.16))}
        dim={(T) => Math.max(0.55, focus(T, B.bp))}
        head
        hot
        renderOrder={33}
      />
      <Pen
        points={heroFatPts}
        pointColors={colors}
        width={PEN.hero}
        update={writeHeroFat}
        progress={(T) => rowDraw(T, BODY_FAT)}
        opacity={heroOut}
        head
        hot
        renderOrder={33}
      />
      <Pen points={bpPts} pointColors={colors} width={PEN.data} update={writeBp} progress={(T) => rowDraw(T, BP)} dim={(T) => rowDim(T, BP)} renderOrder={32} />
      <Pen points={fatPts} pointColors={colors} width={PEN.data} update={writeFat} progress={(T) => rowDraw(T, BODY_FAT)} dim={(T) => rowDim(T, BODY_FAT)} renderOrder={32} />
      <PenBatch segments={batch.segs} colors={batch.cols} width={PEN.data} update={writeCascade} dim={dimC} renderOrder={32} />
      {/* the cascade's pen tips: one light per drawing row; only the newest is hot (L4) */}
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
          const hot = newestDrawing(T) === j ? 1 : 0.28
          return hot * Math.min(1, d / 0.04, (1 - d) / 0.04)
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
    const key = frameId(frame) + '|' + rowsKey(T)
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
 * The table's COLUMNS (sick, well, fit, elite): lines that join the same
 * station on neighbouring rows. They first join blood pressure and body fat
 * (C2), run through every row in C3, and, because each connector is built
 * from the SAME interpolated row transform, the morph bends them into rings:
 * the hub ring (sick), the WELL circle, the FIT circle and the rim (the
 * fitness end of every spoke). A short closing arc completes each ring where
 * the fan meets itself. The WELL ring is its own batch: it steps back once
 * the person's outline (then the dashed ghost) marks that level, so the two
 * amber contours never double.
 */
const COL_SUB = 6
const CLOSE_SUB = 10
/** C2: the two rows' columns appear once body fat is drawn, one station after another. */
const pairGate = (T: number, s: number) => at(T, B.fat, 0.42 + 0.05 * s, 0.56 + 0.05 * s)

function useColumnBatch(frame: ChartFrame, stations: readonly number[], colors: readonly string[]) {
  const nPair = (N - 1) * COL_SUB
  const perStation = nPair + CLOSE_SUB
  const { segs, cols } = useMemo(() => {
    const segs = new Float32Array(stations.length * perStation * 6).fill(AWAY)
    const cols = new Float32Array(segs.length)
    const c = new THREE.Color()
    for (let s = 0; s < stations.length; s++) {
      c.set(colors[s])
      for (let k = 0; k < perStation; k++) {
        const o = (s * perStation + k) * 6
        cols[o] = cols[o + 3] = c.r
        cols[o + 1] = cols[o + 4] = c.g
        cols[o + 2] = cols[o + 5] = c.b
      }
    }
    return { segs, cols }
  }, [stations, colors, perStation])
  const last = useRef('')
  const pt = (fi: number, k: number, y: number, u: number, out: Float32Array, o: number) => {
    rowXf(fi, k, frame, y, xfB)
    rowPoint(xfB, u, out, o, 0.008)
  }
  const write = (T: number, s: Float32Array): boolean => {
    const key = frameId(frame) + '|' + ringsKey(T)
    if (key === last.current) return false
    last.current = key
    for (let si = 0; si < stations.length; si++) {
      const u = stations[si]
      const st = STOPS.indexOf(u as (typeof STOPS)[number])
      const base = si * perStation
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
  return { segs, cols, write, pt }
}

const RING_STOPS = [0, STOP_FIT, 1] as const
const RING_COLORS = [PAL.sick, PAL.fit, RIM_COLOR]
const WELL_STOPS = [STOP_WELL] as const
const WELL_COLORS = [PAL.well]

function Columns({ frame }: { frame: ChartFrame }) {
  const rings = useColumnBatch(frame, RING_STOPS, RING_COLORS)
  const well = useColumnBatch(frame, WELL_STOPS, WELL_COLORS)
  // faint while they are guides between rows, full as rings; the rim and the FIT ring rest a little lower than WELL's first landing
  const dim = (T: number) => (0.42 + 0.58 * at(T, B.dial, 0.6, 0.9)) * Math.max(0.6, spokeRest(T))
  const vis = (T: number) => (T < B.fat ? 0 : 0.95)
  const closeGlow = [PAL.sick, PAL.well, PAL.fit, LIGHT]
  const closeStops = [0, STOP_WELL, STOP_FIT, 1]
  return (
    <>
      <PenBatch segments={rings.segs} colors={rings.cols} width={PEN.axis} update={rings.write} dim={dim} opacity={vis} renderOrder={31} />
      <PenBatch segments={well.segs} colors={well.cols} width={PEN.axis} update={well.write} dim={(T) => dim(T) * wellRingRest(T)} opacity={vis} renderOrder={31} />
      {/* the pen tips closing each ring */}
      <Glows
        count={closeStops.length}
        sizePx={26}
        colors={closeGlow}
        gain={1.4}
        place={(T, s, out) => {
          const cp = ringsClose(T)
          if (cp <= 0 || cp >= 1) return 0
          rings.pt(N - 1 + cp, 1, 0, closeStops[s], _f3, 0)
          out[0] = _f3[0]
          out[1] = _f3[1]
          out[2] = _f3[2] + 0.04
          return (s === 3 ? 1 : 0.6) * Math.min(1, cp / 0.08, (1 - cp) / 0.08)
        }}
      />
    </>
  )
}

/**
 * The C1 and C2 beads: a dot in spectrum(u) that slides along its row and
 * reads the worked examples, plus a small ghost dot (a footprint) left at
 * each station it has read.
 */
const BEADS = [bpBead, fatBead]
const PRINTS = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
] as const
function Beads({ frame, layout }: { frame: ChartFrame; layout: Layout }) {
  const S = sizesFor(layout)
  const place = (T: number, j: number, out: [number, number, number]) => {
    if (j < 2) {
      const b = BEADS[j]
      xfAt(T, b.row, frame)
      rowPoint(xfA, b.u(T), _v, 0, 0.05)
      out[0] = _v[0]
      out[1] = _v[1]
      out[2] = _v[2]
      return b.appear(T) * (1 + 0.25 * b.hot(T))
    }
    const [bi, k] = PRINTS[j - 2]
    const b = BEADS[bi]
    xfAt(T, b.row, frame)
    rowPoint(xfA, b.stations[k], _v, 0, 0.04)
    out[0] = _v[0]
    out[1] = _v[1]
    out[2] = _v[2]
    return (b.print(T, k) * S.print) / S.bead
  }
  const tint = (T: number, j: number, c: THREE.Color) => {
    if (j < 2) {
      spectrumLinear(BEADS[j].u(T), c)
      return
    }
    const [bi, k] = PRINTS[j - 2]
    spectrumLinear(BEADS[bi].stations[k], c).multiplyScalar(0.6)
  }
  return (
    <>
      <TintDots site="continuum beads" count={2 + PRINTS.length} radius={S.bead} place={place} tint={tint} emissiveIntensity={0.55} />
      <Glows
        count={2}
        sizePx={layout === 'P' ? 44 : 52}
        colors={[LIGHT]}
        gain={1.9}
        place={(T, j, out) => {
          const b = BEADS[j]
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

const COL_WELL = new THREE.Color(STATES[WORD_WELL].css)
const COL_ATH = new THREE.Color(STATES[WORD_ATHLETE].css)
/** The claim lands in C4 (the orb lights, the word rises), and the C5 impact accent. */
const claimHot = (T: number) => 0.7 * pulse(T, B.well + 0.86, B.well + 1.0) + impactK(T)

const STORY_PERSON: PersonSrc = {
  pos: personPos,
  key: personKey,
  mean: personMean,
  dotScale: dotAppear,
  outline: outlineDraw,
  outlineHot: true,
  fill: fillIn,
  orb: orbOn,
  hot: claimHot,
  orbColor: (T, out) => {
    out.copy(COL_WELL).lerp(COL_ATH, wordSwap(T))
  },
  word: wordVis,
  wordLift,
  ghost: ghostIn,
  ghostPositions: AVERAGE.positions,
  vis: personOn,
  cut: bandOn,
  highlight: () => keySel.i,
}

/* ------------------------------- labels -------------------------------- */

/** The rows the C3 caption names, read in the table: sick and elite ends. */
const TABLE_ROWS = [HDL, TRIGLYC, BONE]
/**
 * The C6 claim's anchor on the lit band: between HDL and triglycerides on a
 * phone (the pill goes under the dial), between body fat and VO2 max on
 * landscape (the pill goes right of the dial, below the HUD chip).
 */
const PREVENT_ANGLE_P = -72 * (Math.PI / 180)
const PREVENT_ANGLE_L = 0
/** Mid-way between the WELL circle and the athlete polygon along angle a (the lit band). */
function bandRadius(a: number): number {
  const t = ((((Math.PI / 2 - a) / ((36 * Math.PI) / 180)) % N) + N) % N
  const i0 = Math.floor(t)
  const i1 = (i0 + 1) % N
  const r0 = radiusOf(ATHLETE.positions[i0])
  const r1 = radiusOf(ATHLETE.positions[i1])
  const a0 = spokeAngle(i0)
  const a1 = spokeAngle(i1)
  // the polygon edge P0 -> P1 met by the ray at angle a
  const p0x = r0 * Math.cos(a0)
  const p0y = r0 * Math.sin(a0)
  const ex = r1 * Math.cos(a1) - p0x
  const ey = r1 * Math.sin(a1) - p0y
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const den = dx * ey - dy * ex
  const poly = Math.abs(den) > 1e-6 ? (p0x * ey - p0y * ex) / den : r0
  return (radiusOf(STOP_WELL) + poly) / 2
}
const _pa = new THREE.Vector3()
const _pb = new THREE.Vector3()
/** Screen distance in px between two world points with the live camera (the claim's gap to clear the rim). */
function pxBetween(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const cam = gestureBus.camera
  if (!cam) return 40
  _pa.set(ax, ay, az).project(cam)
  _pb.set(bx, by, bz).project(cam)
  return Math.hypot(((_pa.x - _pb.x) / 2) * focusRect.W, ((_pa.y - _pb.y) / 2) * focusRect.H)
}
/** The FITNESS callout rides the rim between Resting HR and Systolic BP; the WELL and FIT circle names sit between Resting HR and Flexibility. */
const RIM_ANGLE = 72 * (Math.PI / 180)
const RING_ANGLE = 108 * (Math.PI / 180)

function useStoryLabels(rf: ChartFrame, layout: Layout) {
  // re-render only when one of these decisions flips (not on every focus-rect change)
  const key = useSyncExternalStore(subscribeFocus, keyMode)
  const short = useSyncExternalStore(subscribeFocus, shortStage)
  // a phone-sized stage: two-line side names and elite ticks
  const compact = useSyncExternalStore(subscribeFocus, compactStage)
  // values beside the dots need a tall landscape stage (a phone shows the key or the HUD score)
  const dotValues = !key && !short && !compact
  const phone = layout === 'P'
  const specs = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = []
    // C0: the three stations head their columns of light
    ;['SICKNESS', 'WELLNESS', 'FITNESS'].forEach((text, k) => {
      const u = [0, 0.5, 1][k]
      const s = [0, 1, 3][k]
      const only: Dir[] = k === 0 ? ['N', 'NE'] : k === 1 ? ['N'] : ['N', 'NW']
      out.push({
        id: `cn-c0-${k}`,
        text,
        tone: 'callout',
        color: STATION_COLORS[k],
        anchor: (T) => [rf.x(u), COL_TOP * guideGrow(T, s), 0],
        prefer: 'N',
        only,
        gapPx: 6,
        priority: 90,
        cue: (T) => c0Callout(T, k),
      })
    })
    // C1 / C2: each featured row's scale, below the line (sick, well, fit, elite); the end ticks keep inside the rect
    const scale = (row: number, cue: (T: number) => number, tag: string) =>
      STOPS.forEach((u, s) =>
        out.push({
          id: `cn-${tag}-t${s}`,
          text: compact && s === STOPS.length - 1 ? tickText(row, s).replace(' ', NL) : tickText(row, s),
          tone: 'tick',
          anchor: rowAnchor(rf, row, u),
          prefer: 'S',
          only: s === 0 ? ['S', 'SE'] : s === STOPS.length - 1 ? ['S', 'SW'] : ['S'],
          gapPx: 9,
          priority: 86,
          cue,
        }),
      )
    scale(BP, bpScale, 'bp')
    scale(BODY_FAT, fatScale, 'bf')
    // the bead reads the worked examples as it passes the stations, and leaves each reading behind at 40%
    const readings = (b: typeof bpBead, texts: string[], colors: string[], tag: string) =>
      texts.forEach((text, k) => {
        out.push({
          id: `cn-${tag}b-${k}`,
          text,
          tone: 'callout',
          color: colors[k],
          anchor: rowAnchor(rf, b.row, b.u, 0.05),
          prefer: 'N',
          only: ['N', 'NE', 'NW'],
          gapPx: 26,
          leader: 'always',
          priority: 92,
          cue: (T) => b.callout(T, k),
        })
        if (k < 2)
          out.push({
            id: `cn-${tag}p-${k}`,
            text,
            tone: 'callout',
            color: colors[k],
            anchor: rowAnchor(rf, b.row, b.stations[k], 0.05),
            prefer: 'N',
            only: ['N', 'NE', 'NW'],
            gapPx: 26,
            leader: 'always',
            priority: 70,
            cue: (T) => 0.42 * b.print(T, k),
          })
      })
    readings(bpBead, BP_READINGS, STATION_COLORS, 'bp')
    readings(
      fatBead,
      FAT_READINGS.map((v) => `${v}%`),
      FAT_STATIONS.map((p, k) => (k < 2 ? STATION_COLORS[k] : spectrumHex(p))),
      'bf',
    )
    // C2 claim: the direction of better, from betterDirection
    out.push({ id: 'cn-better', text: betterText(BODY_FAT), tone: 'callout', color: PAL.yellowGreen, anchor: rowAnchor(rf, BODY_FAT, 0), prefer: 'SE', only: ['SE'], gapPx: 40, priority: 88, cue: betterCallout })
    // the featured rows' names head their rows in C1 and C2
    out.push({ id: 'cn-rn-bp', text: shortName(BP), tone: 'name', dot: false, anchor: rowAnchor(rf, BP, 0), prefer: 'NE', only: ['NE', 'SE'], gapPx: 15, priority: 84, cue: bpName })
    out.push({ id: 'cn-rn-bf', text: shortName(BODY_FAT), tone: 'name', dot: false, anchor: rowAnchor(rf, BODY_FAT, 0), prefer: 'NE', only: ['NE', 'SE'], gapPx: 15, priority: 84, cue: fatName })
    // every row's name rides its FITNESS end: named in the table, carried by the morph to its spoke tip
    for (let i = 0; i < N; i++) {
      out.push({
        id: `cn-name-${i}`,
        text: compact ? shortName2(i) : shortName(i),
        tone: 'name',
        color: PAL.chalk,
        dot: false,
        anchor: rowAnchor(rf, i, 1),
        prefer: 'radial',
        center: [0, 0, 0],
        gapPx: compact ? 6 : 9,
        required: true,
        priority: 100,
        cue: (T) => nameOn(T, i),
      })
    }
    // the table reads the rows the caption names: their sick and elite values, and HDL's direction
    for (const row of TABLE_ROWS) {
      out.push({ id: `cn-tv-${row}-0`, text: tickText(row, 0), tone: 'tick', anchor: rowAnchor(rf, row, 0), prefer: 'S', only: ['S', 'SE'], gapPx: 6, priority: 78, cue: tableValues })
      out.push({ id: `cn-tv-${row}-3`, text: tickText(row, 3), tone: 'tick', anchor: rowAnchor(rf, row, 1), prefer: 'SW', only: ['SW', 'S'], gapPx: 6, priority: 78, cue: tableValues })
    }
    out.push({ id: 'cn-higher', text: betterText(HDL), tone: 'name', color: PAL.yellowGreen, dot: false, anchor: rowAnchor(rf, HDL, 0.36), prefer: 'S', only: ['S'], gapPx: 5, priority: 76, cue: tableValues })
    // the finished dial: SICKNESS names the centre, FITNESS the rim, WELL and FIT their circles
    out.push({ id: 'cn-centre', text: 'SICKNESS', tone: 'callout', color: PAL.sick, anchor: [0, 0, bowl(0)], prefer: 'C', priority: 91, cue: centreCallout })
    out.push({ id: 'cn-rim', text: 'FITNESS', tone: 'callout', color: PAL.fit, anchor: [R * Math.cos(RIM_ANGLE), R * Math.sin(RIM_ANGLE), 0], prefer: 'C', priority: 90, cue: rimCallout })
    const circ = (id: string, text: string, color: string, p: number) => {
      const r = radiusOf(p)
      out.push({ id, text, tone: 'name', color, anchor: [r * Math.cos(RING_ANGLE), r * Math.sin(RING_ANGLE), bowl(r)], prefer: 'C', gapPx: 0, priority: 64, cue: ringNames })
    }
    circ('cn-well', STATES[1].word, PAL.well, STOP_WELL)
    circ('cn-fit', STATES[2].word, PAL.fit, STOP_FIT)
    // landscape: each marker's live value beside its dot, outward along its spoke (portrait: the key)
    if (dotValues) {
      for (let i = 0; i < N; i++) {
        out.push({
          id: `cn-val-${i}`,
          text: valueText(i, AVERAGE.positions[i]),
          tone: 'tick',
          anchor: (T: number) => {
            dialPoint(i, personPos(T, i), _v, 0, 0.06)
            return [_v[0], _v[1], _v[2]]
          },
          prefer: 'radial',
          center: [0, 0, 0],
          gapPx: 15,
          leader: true,
          priority: 60,
          cue: (T) => at(T, B.well, 0.68, 0.8) * personOn(T),
        })
      }
    }
    // C6 claim: the lit margin is preventive medicine. Its anchor is a point ON the lit band; the pill
    // always sits outside the rim (under the dial past TRIGLYC. on a phone, right of it on landscape)
    // with a leader into the band. It places right after the spoke names, so it never takes their slots.
    {
      const a = phone ? PREVENT_ANGLE_P : PREVENT_ANGLE_L
      const r = bandRadius(a)
      const ax = r * Math.cos(a)
      const ay = r * Math.sin(a)
      const az = bowl(r)
      // the rim straight below (phone) or straight to the right (landscape) of the anchor
      const rx = phone ? ax : Math.sqrt(R * R - ay * ay)
      const ry = phone ? -Math.sqrt(R * R - ax * ax) : ay
      const clear = phone ? 27 : 14
      out.push({
        id: 'cn-prevent',
        text: 'Preventive medicine',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [ax, ay, az],
        prefer: phone ? 'S' : 'E',
        only: phone ? ['S', 'SE', 'SW'] : ['E', 'SE', 'NE'],
        get gapPx() {
          return pxBetween(ax, ay, az, rx, ry, 0) + clear
        },
        leader: 'always',
        required: true,
        priority: 99,
        cue: preventiveCallout,
      })
    }
    return out
  }, [rf, key, dotValues, phone, compact])
  useLabels(specs)

  // landscape values count with the dots (text from T, set before the labels place)
  const lastTxt = useRef<string[]>([])
  const lastK = useRef(-2)
  useSafeFrame(
    'continuum value labels',
    (T) => {
      const k = personKey(T)
      if (!dotValues || k < 0 || k === lastK.current) return
      lastK.current = k
      for (let i = 0; i < N; i++) {
        const t = valueText(i, personPos(T, i))
        if (lastTxt.current[i] !== t) {
          lastTxt.current[i] = t
          setLabelText(`cn-val-${i}`, t)
        }
      }
    },
    { priority: -85 },
  )
}

/** Write one obstacle point, return the new count (allocation-free). */
function put(out: Float32Array, n: number, x: number, y: number, z: number): number {
  out[n * 3] = x
  out[n * 3 + 1] = y
  out[n * 3 + 2] = z
  return n + 1
}

/**
 * The rim as an obstacle: three points in each gap between two spokes (the
 * tips stay free for the names, which sit just outside them). The gap where
 * the FITNESS callout rides the rim is left open while it shows.
 */
const RIM_OBS = N * 3
const rimAngle = (j: number) => ((90 - 18 - 36 * Math.floor(j / 3) + (j % 3 - 1) * 7) * Math.PI) / 180
const rimFree = (a: number) => Math.abs(Math.atan2(Math.sin(a - RIM_ANGLE), Math.cos(a - RIM_ANGLE))) < 0.3

/** Data marks labels never cover: beads, footprints, the rim, the dots, the outline (sampled along every edge), the orb and the state word. */
function useStoryObstacles(rf: ChartFrame, layout: Layout) {
  const S = sizesFor(layout)
  const marks = useMemo<WorldObstacle>(
    () => ({
      maxPoints: 128,
      radiusPx: 7,
      points: (T, out) => {
        let n = 0
        // the beads and their footprints
        for (let k = 0; k < BEADS.length; k++) {
          const b = BEADS[k]
          if (b.appear(T) < 0.05) continue
          xfAt(T, b.row, rf)
          rowPoint(xfA, b.u(T), _v, 0, 0.05)
          n = put(out, n, _v[0], _v[1], _v[2])
          for (let s = 0; s < 2; s++) {
            if (b.print(T, s) < 0.05) continue
            rowPoint(xfA, b.stations[s], _v, 0, 0.05)
            n = put(out, n, _v[0], _v[1], _v[2])
          }
        }
        if (T >= B.dial + 0.8) {
          // the rim, so a spoke name never sits across it
          for (let j = 0; j < RIM_OBS; j++) {
            const a = rimAngle(j)
            if (rimFree(a) && T < B.well + 0.1) continue
            n = put(out, n, R * Math.cos(a), R * Math.sin(a), 0)
          }
        }
        if (personOn(T)) {
          for (let i = 0; i < N; i++) {
            if (dotAppear(T, i) < 0.05) continue
            dialPoint(i, personPos(T, i), _v, 0, 0.06)
            n = put(out, n, _v[0], _v[1], _v[2])
            // the outline, sampled along the edge to the next spoke
            const j = (i + 1) % N
            const ra = radiusOf(personPos(T, i))
            const rb = radiusOf(personPos(T, j))
            const ax = ra * Math.cos(spokeAngle(i))
            const ay = ra * Math.sin(spokeAngle(i))
            const bx = rb * Math.cos(spokeAngle(j))
            const by = rb * Math.sin(spokeAngle(j))
            for (let e = 0; e < 3; e++) {
              const t = OUTLINE_T[e]
              const x = ax + (bx - ax) * t
              const y = ay + (by - ay) * t
              n = put(out, n, x, y, bowl(Math.hypot(x, y)))
            }
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
      padPx: 4,
      box: (T): Box | null => {
        if (!personOn(T)) return null
        let chars = 0
        let lift = 0
        for (let k = 0; k < STATES.length; k++) {
          if (wordVis(T, k) > 0.05) {
            chars = Math.max(chars, STATES[k].word.length)
            lift = Math.max(lift, wordLift(T, k))
          }
        }
        if (!chars || lift < 0.05) return null
        const w = chars * S.word * 0.5
        const y = S.wordY * lift
        const z = bowl(0) + (0.6 - bowl(0)) * lift
        return [
          [-w / 2, y - S.word * 0.5, z],
          [w / 2, y + S.word * 0.5, z],
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
/** The depth contours are faint front-on and read once the camera tilts. */
const isoOf = (T: number) => 0.12 + 0.34 * at(T, B.well, 0.05, 0.32) - 0.12 * at(T, B.sup, 0, 0.3)

function StoryScene({ tier: _tier }: { tier: Tier }) {
  const { layout } = useBeat()
  const rf = useChartFrame(ROWS_FRAME)
  useStoryLabels(rf, layout)
  useStoryObstacles(rf, layout)
  const discVis = useMemo(() => ({ opacity: discIn, band: bandOn, pit: pitDark, iso: isoOf, polyR: ATHLETE_R }), [])
  return (
    <>
      <Disc vis={discVis} />
      <Guides frame={rf} />
      <Rows frame={rf} />
      <Ticks frame={rf} />
      <Columns frame={rf} />
      <StationFlares frame={rf} />
      <Beads frame={rf} layout={layout} />
      <PitShadow k={pitShade} />
      <SpokeHighlight vis={(T) => at(T, B.dial, 0.95, 1)} />
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
