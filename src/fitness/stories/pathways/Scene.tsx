import { useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { ENERGY_SYSTEMS, PAL } from '../../fitnessData'
import { fmtDuration } from '../../lessonMath'
import { at, focus } from '../../story/cue'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useChapterChart, type ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { impactK } from '../../story/kit/impact'
import { bumpObstacles, setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec, Layout, Rect, Tier, V3 } from '../../story/types'
import {
  BAND_COLORS,
  COLOR,
  MARATHON,
  NAME,
  PEAK_ORDER_TEXT,
  PINS,
  POWER_MAX,
  T_MIN,
  calloutKey,
  calloutText,
  contribAtT,
  contribInto,
  dominantAtT,
  dominantOf,
  pinIndex,
  uOf,
  type Shares,
} from './pathwaysMath'
import { bandTopAt, stackTopAt, uAtArc } from './bands'
import { Brackets, Construction, HandoverStrip, LaneAxes, MarathonChevron, type ConstructionVis } from './chart'
import { AXIS_ORDER, BAND_OF_AXIS, LIGHT, envelopeArc, makeFlowState, setFlowMorph, type BandSource } from './geom'
import { BandFill, BandPen, Envelope } from './elements'
import { River } from './River'
import { LANE_NAME_U, LANE_NAME_U_SHORT, ROW, TICKS, narrowChart, pxPerUnit, shortPortrait, stringX, underAxis, type UnderAxis } from './layout'
import {
  PxMap,
  addBlocker,
  addHud,
  blockBox,
  blockFlag,
  boundsInto,
  measureCallout,
  newBlockers,
  newCluster,
  newFlag,
  putSig,
  sizeInto,
  solveCluster,
  solveFlag,
  solveFlagFit,
  type Floor,
} from './annot'
import {
  FLOOD_BEAT,
  FRAN_PIN,
  GHOST_T,
  P,
  STOP_PIN,
  TAG_STOPS,
  axesDraw,
  bracketDraw,
  bracketPulse,
  construct,
  curCallout,
  cursorFlash,
  cursorOn,
  cursorT,
  cursorU,
  dimEngineOn,
  envDraw,
  envOn,
  flooding,
  franChip,
  front,
  ghostOn,
  keyRow,
  lanesM,
  laneLines,
  laneNames,
  moteOn,
  orderClaim,
  pinDrop,
  pinLit,
  pinNameOn,
  resultOn,
  stripOn,
  tagOn,
  ticksDraw,
  yTitle,
} from './timeline'
import ExploreScene from './ExploreScene'

/* =========================================================================
   03 ENERGY SYSTEMS, "Three engines, one river" (DESIGN.md D.4). Seven
   beats, every property a pure function of story time T (L5):
     P0 a hot pen draws the axes, then the chalk envelope: the most power you
        can hold falls as the effort gets longer; three dim, unnamed engines
        glow under it, each strongest over a different stretch of time;
     P1 to P3 each engine in turn floods to full light with its river of
        motes, while a cursor reads the share of supply; a reading the
        caption leans on is stamped and stays (3 s in P1, 75 s in P3);
     P4 the stack separates into three lanes on ONE power scale (signature),
        each lane on its own zero: the rose spike is the tallest, the blue
        lane the lowest and longest;
     P5 back to the stack; real benchmarks drop onto the curve as pins and
        the cursor visits four of them, a photo-finish chip at each that
        collapses to a tag as it moves on;
     P6 the three duration brackets draw under the axis and light their
        pins in turn, and the cursor parks at Fran, which draws on all three.
   Prewarm (README): the whole story and the explore layer are mounted at
   load and hidden by T or mode, so no shader links mid-story.
   ========================================================================= */

const SRC: BandSource = { m: lanesM, s: () => 0, front }
/** One scratch anchor: the label placer projects an anchor the moment it gets it, so dynamic anchors write here instead of allocating per frame. */
const _A: [number, number, number] = [0, 0, 0]
const pt = (x: number, y: number, z: number): V3 => {
  _A[0] = x
  _A[1] = y
  _A[2] = z
  return _A
}
/** far outside every view: a pen segment that must not show yet (never a zero-length dot) */
const AWAY = 1e5
/** pin heads sit this far above the envelope before they drop (world units) */
const DROP = 1.4

/** Band b (bottom to top) is this engine. */
const BAND_KEY = ['oxidative', 'glycolytic', 'phosphagen'] as const

/** The dominant engine's colour for a pin (ENERGY_BENCHMARKS[].dominant). */
const PIN_COLORS = PINS.map((p) => COLOR[p.dominant])
const PIN_U = PINS.map((p) => uOf(p.seconds))
/** The benchmark cluster (D.4): Fran, 1 Mile Run, 2k Row, in axis order. */
const CLUSTER = [pinIndex('Fran'), pinIndex('1 Mile Run'), pinIndex('2k Row')]
const IN_CLUSTER = PINS.map((_, k) => CLUSTER.includes(k))

/* ------------------------------ helpers -------------------------------- */

/** v of the stack top at u (the envelope while stacked). */
const envV = (u: number) => stackTopAt(u, 0)
/** v of band b's top at u for lanes morph m. */
const topV = (b: number, u: number, m: number) => bandTopAt(b, u, m, 0)

/* ------------------------------ chips ----------------------------------- */

const DOM_ORDER = ['phosphagen', 'glycolytic', 'oxidative'] as const
const DOM_COLORS = DOM_ORDER.map((k) => COLOR[k])
const CUR_IDS = DOM_ORDER.map((k) => `pw-cur-${k}`)
/** P5 result chips: name, duration and the dominant engine (D.4). */
const RES_TEXT = STOP_PIN.map((k) => (k >= 0 ? `${PINS[k].name} - ${fmtDuration(PINS[k].seconds)} - ${NAME[PINS[k].dominant]}` : ''))
const RES_IDS = STOP_PIN.map((_, s) => `pw-res-${s}`)
const PIN_IDS = PINS.map((_, k) => `pw-pin-${k}`)
const FRAN_TEXT = FRAN_PIN >= 0 ? `${PINS[FRAN_PIN].name} - ${fmtDuration(PINS[FRAN_PIN].seconds)}` : ''
/** Marathon: never plotted on the axis (F.7); its chip carries its own duration so it reads as off the chart by design. */
const MARA_TEXT = MARATHON ? `${MARATHON.name} - ${fmtDuration(MARATHON.seconds)}` : ''
/**
 * The Marathon chip: with its chevron in P3, where the axis runs out; it
 * steps aside as the lanes open and does not return (P5 and P6 read the
 * eight pins; the chevron keeps saying the axis goes on).
 */
const maraOn = (T: number) => at(T, P.oxi, 0.88, 0.96) * Math.max(0.55, focus(T, P.oxi)) * (1 - at(T, P.power, 0, 0.15))
/** The chevron tip sits this far (world units) past the axis end (chart.tsx MarathonChevron). */
const CHEVRON_DX = 0.32

/*
 * The stamped readings and the P5 tags (review r2), laid out BEFORE the
 * moving chips so they hold still while the cursor travels:
 *   0, 1  ghosts: the callout at 3 s (P1) and at 75 s (P3), computed by
 *         calloutText and left behind, dimmed, as the cursor moves on;
 *   2, 3  tags: the 1RM Lift and 400m results, collapsed from their chips.
 * Each has a full text and a short fallback (a narrow phone's top-left
 * corner is taken by the HUD glass).
 */
const N_ST = 4
const shortReading = (t: number) => {
  const c = contribAtT(t)
  return `${fmtDuration(t)} - ${Math.round(c[dominantOf(c)])}%`
}
const TAG_PIN = TAG_STOPS.map((s) => STOP_PIN[s])
const ST_IDS = ['pw-gh-0', 'pw-gh-1', 'pw-tag-0', 'pw-tag-1']
const ST_TEXT = [...GHOST_T.map((t) => calloutText(t)), ...TAG_PIN.map((k) => (k >= 0 ? `${PINS[k].name} - ${NAME[PINS[k].dominant]}` : ''))]
const ST_SHORT = [...GHOST_T.map((t) => shortReading(t)), ...TAG_PIN.map((k) => (k >= 0 ? PINS[k].name : ''))]
const ST_COLOR = [...GHOST_T.map((t) => COLOR[dominantAtT(t)]), ...TAG_PIN.map((k) => (k >= 0 ? COLOR[PINS[k].dominant] : PAL.chalk))]
/** u of the node each one describes (on the envelope). */
const ST_U = [...GHOST_T.map((t) => uOf(t)), ...TAG_PIN.map((k) => (k >= 0 ? PIN_U[k] : 0))]
/** Ghosts rest dimmed (a past reading); tags are results, at full strength. */
const ST_LEVEL = [0.6, 0.6, 1, 1]
const stCue = (T: number, i: number) => (i < 2 ? ghostOn(T, i) : tagOn(T, i - 2))
const IS_TAG_PIN = PINS.map((_, k) => TAG_PIN.includes(k))
const GHOST_COLORS = ST_COLOR.slice(0, 2)

/** Cue of the chip describing pin k (the result chip at its stop, the P6 Fran chip). */
function chipOf(T: number, k: number): number {
  const s = STOP_PIN.indexOf(k)
  const r = s >= 0 ? resultOn(T, s) : 0
  return k === FRAN_PIN ? Math.max(r, franChip(T)) : r
}
/** Pin k's name: on with the pins, and gone as soon as the chip that describes it starts. */
const pinName = (T: number, k: number) => pinNameOn(T, k) * (1 - Math.min(1, 4 * chipOf(T, k)))

/* ---------------------------- annotation ------------------------------- */

/**
 * The per-frame layout of every chip (annot.ts), between the camera (-90)
 * and the labels (-80), in this order: the stamped readings and the tags
 * (they hold still), the cluster names, the cursor's chip, the Marathon
 * chip. The cursor callout's TEXT is written here too, before its pill is
 * sized and before the placer runs, so the layout and the placer agree on
 * its width in the same frame (review r2).
 */
function useStoryAnnot(frame: ChartFrame) {
  const camera = useThree((s) => s.camera)
  const st = useMemo(
    () => ({
      pxm: new PxMap(),
      B: { x: 0, y: 0, w: 0, h: 0 } as Rect,
      bl: newBlockers(40),
      cur: newFlag(),
      curCue: 0,
      mara: newFlag(),
      maraCue: 0,
      clu: newCluster(),
      cluCue: 0,
      stat: Array.from({ length: N_ST }, () => newFlag()),
      statFit: [0, 0, 0, 0] as number[],
      statCue: [0, 0, 0, 0] as number[],
      sz: { w: 0, h: 0 },
      sz2: { w: 0, h: 0 },
      szT: { w: 0, h: 0 },
      cx: [0, 0, 0],
      cy: [0, 0, 0],
      cw: [0, 0, 0],
      ch: [0, 0, 0],
      show: [false, false, false],
      sig: new Float64Array(32),
      ver: 0,
      // the cursor callout's text (rebuilt only when it changes)
      key: -1,
      text: calloutText(T_MIN),
      c: { phosphagen: 0, glycolytic: 0, oxidative: 0 } as Shares,
    }),
    [],
  )
  // the envelope in stage px: the surface every chip keeps clear of
  const floor = useMemo<Floor>(
    () => (sx) => {
      const u = Math.max(0, Math.min(1, (st.pxm.wx(sx) - frame.x0) / frame.FW))
      return st.pxm.py(frame.y(envV(u)))
    },
    [st, frame],
  )
  // per-frame helpers, made once per frame fit (no closure per frame)
  const help = useMemo(
    () => ({
      pinX: (k: number) => st.pxm.px(frame.x(PIN_U[k])),
      pinY: (k: number) => st.pxm.py(frame.y(envV(PIN_U[k]))),
      addStatics: () => {
        for (let i = 0; i < N_ST; i++) if (st.statFit[i] && st.statCue[i] > 0.001) blockFlag(st.bl, st.stat[i])
      },
      /**
       * The "Power output" axis title keeps its slot at the top of the power
       * axis through P0 to P3, where the power scale is being read: the chips
       * lay out around it (fix round 1: on a short portrait phone a chip took
       * that corner and the title was culled). From P4 the lanes' names (P4)
       * and the 1RM tag, which names its dominant engine (P5), keep the corner.
       */
      addTitle: (T: number, axisX: number) => {
        // P5 and P6 read the pins: there the 1RM tag (its dominant engine) keeps the corner
        if (yTitle(T) <= 0.01 || T >= P.power) return
        sizeInto('pw-ax-y', 'Power output', 'name', st.szT)
        const ty = st.pxm.py(frame.y(frame.vMax))
        addBlocker(st.bl, axisX + 6, ty - st.szT.h / 2 - 3, st.szT.w + 6, st.szT.h + 6)
      },
    }),
    [st, frame],
  )
  useSafeFrame(
    'pathways annot',
    (T) => {
      if (useStoryStore.getState().mode !== 'story') return
      const { pxm, B, bl } = st
      const { pinX, pinY, addStatics, addTitle } = help
      pxm.update(camera, frame)
      boundsInto(B)
      const pinsOn = T >= P.workouts + 0.3 && lanesM(T) < 0.5
      const axisX = pxm.px(frame.x(0))

      // the cursor callout text: fmtDuration + dominant name + share (D.4)
      const t = cursorT(T)
      contribInto(t, st.c)
      const d = dominantOf(st.c)
      const key = calloutKey(t, DOM_ORDER.indexOf(d), Math.round(st.c[d]))
      if (key !== st.key) {
        st.key = key
        st.text = calloutText(t)
      }
      for (let i = 0; i < 3; i++) setLabelText(CUR_IDS[i], st.text)

      // 1. the stamped readings and the tags
      bl.n = 0
      addHud(bl)
      addTitle(T, axisX)
      if (pinsOn) for (let k = 0; k < PINS.length; k++) if (!IS_TAG_PIN[k]) addBlocker(bl, pinX(k) - 8, pinY(k) - 8, 16, 16)
      for (let i = 0; i < N_ST; i++) {
        const c = stCue(T, i)
        st.statCue[i] = c
        const f = st.stat[i]
        if (c <= 0.001 || (i >= 2 && !pinsOn)) {
          st.statFit[i] = 0
          f.on = false
          continue
        }
        const nx = pxm.px(frame.x(ST_U[i]))
        const ny = pxm.py(frame.y(envV(ST_U[i])))
        // sized exactly (not from the layer's last measure), so full or short is decided the same way from a deep link or a scrub
        measureCallout(ST_TEXT[i], st.sz)
        measureCallout(ST_SHORT[i], st.sz2)
        // a ghost may slide as far as its live callout did (so it is stamped where the reading was); a tag stays by its pin
        st.statFit[i] = solveFlagFit(f, nx, ny, st.sz.w, st.sz.h, st.sz2.w, st.sz2.h, floor, axisX + 6, i < 2 ? 90 : 40, bl, B)
        if (st.statFit[i]) blockFlag(bl, f)
      }

      // the cursor chip: whichever of the callouts and result chips is up
      let cue = 0
      let id = ''
      let text = ''
      for (let i = 0; i < 3; i++) {
        const c = d === DOM_ORDER[i] ? curCallout(T) : 0
        if (c > cue) {
          cue = c
          id = CUR_IDS[i]
          text = st.text
        }
      }
      for (let s = 0; s < STOP_PIN.length; s++) {
        const c = resultOn(T, s)
        if (c > cue) {
          cue = c
          id = RES_IDS[s]
          text = RES_TEXT[s]
        }
      }
      if (franChip(T) > cue) {
        cue = franChip(T)
        id = 'pw-res-fran'
        text = FRAN_TEXT
      }
      st.curCue = cue
      const u = cursorU(T)
      const nx = pxm.px(frame.x(u))
      const ny = pxm.py(frame.y(envV(u)))
      const tipX = pxm.px(frame.x(1) + CHEVRON_DX)
      const ty = frame.y(0)

      // 2. the cluster names (P5, P6)
      bl.n = 0
      addHud(bl)
      addTitle(T, axisX)
      if (pinsOn) for (let k = 0; k < PINS.length; k++) if (!IN_CLUSTER[k]) addBlocker(bl, pinX(k) - 6, pinY(k) - 6, 12, 12)
      addStatics()
      st.cluCue = 0
      if (pinsOn) {
        for (let j = 0; j < 3; j++) {
          const k = CLUSTER[j]
          const c = k >= 0 ? pinName(T, k) : 0
          st.cluCue = Math.max(st.cluCue, c)
          st.show[j] = c > 0.01
          st.cx[j] = pinX(k)
          st.cy[j] = pinY(k)
          sizeInto(PIN_IDS[k], PINS[k].name, 'name', st.sz)
          st.cw[j] = st.sz.w
          st.ch[j] = st.sz.h
        }
        // The cluster names re-lay for the cursor's pole only while the
        // cursor RESTS on a cluster pin (its chip then needs that room, as at
        // Fran in P6), never while it travels past (fix round 1: the LOW / HIGH
        // layout flipped as the moving pole crossed the cluster, so the names
        // jumped about 70 px and back within a second of P5). A travelling
        // pole may pass under a name; the cursor's chip avoids every name and
        // leader (step 3).
        let rest = false
        if (cue > 0.01 && T >= P.workouts)
          for (let j = 0; j < 3; j++) if (CLUSTER[j] >= 0 && Math.abs(pinX(CLUSTER[j]) - nx) < 3) rest = true
        solveCluster(st.clu, st.cx, st.cy, st.cw, st.ch, st.show, floor, bl, B, rest ? nx : null, ny)
      } else st.clu.layout = -1

      // 3. the cursor chip, over the cluster names, the tags and every pin
      bl.n = 0
      addHud(bl)
      addTitle(T, axisX)
      if (pinsOn) {
        for (let k = 0; k < PINS.length; k++) {
          const x = pinX(k)
          const y = pinY(k)
          if (Math.abs(x - nx) > 1 || Math.abs(y - ny) > 1) addBlocker(bl, x - 8, y - 8, 16, 16)
        }
        if (st.clu.layout >= 0 || st.cluCue > 0)
          for (let j = 0; j < 3; j++) {
            const c = st.clu
            blockBox(bl, c.r[j])
            // and its leader: a chip never sits across one
            if (c.r[j].on) addBlocker(bl, Math.min(c.px[j], c.ex[j]) - 2, Math.min(c.py[j], c.ey[j]), Math.abs(c.px[j] - c.ex[j]) + 4, Math.abs(c.py[j] - c.ey[j]))
          }
      }
      addStatics()
      const maraCue = maraOn(T)
      st.maraCue = maraCue
      if (cue > 0.001) {
        // sized exactly for the text it shows this frame (the Fran chip carries swatches: the layer's measure)
        if (id === 'pw-res-fran') sizeInto(id, text, 'callout', st.sz)
        else measureCallout(text, st.sz, id === CUR_IDS[0] || id === CUR_IDS[1] || id === CUR_IDS[2] ? 24 : 0)
        solveFlag(st.cur, nx, ny, st.sz.w, st.sz.h, floor, axisX + 6, maraCue > 0.001 ? tipX - 10 : B.x + B.w, bl, B)
      } else st.cur.on = false

      // 4. the Marathon chip, right-aligned over its chevron, clear of the cursor chip and its pole
      if (maraCue > 0.001) {
        if (cue > 0.001) blockFlag(bl, st.cur)
        measureCallout(MARA_TEXT, st.sz)
        solveFlag(st.mara, tipX, pxm.py(ty), st.sz.w, st.sz.h, floor, axisX + 6, B.x + B.w, bl, B)
      } else st.mara.on = false

      // re-place the labels when the layout moved without T moving (widths measured, the HUD measured)
      const s = st.sig
      // (the node too: a pill clamped at the right edge stays put while its pole follows the cursor)
      let moved = putSig(s, 0, st.cur.x)
      moved = putSig(s, 1, st.cur.y) || moved
      moved = putSig(s, 2, st.cur.nx) || moved
      moved = putSig(s, 3, st.cur.ny) || moved
      moved = putSig(s, 4, st.mara.x) || moved
      moved = putSig(s, 5, st.mara.y) || moved
      moved = putSig(s, 6, st.mara.nx) || moved
      moved = putSig(s, 7, st.clu.layout) || moved
      for (let j = 0; j < 3; j++) {
        moved = putSig(s, 8 + 3 * j, st.clu.r[j].x) || moved
        moved = putSig(s, 9 + 3 * j, st.clu.r[j].y) || moved
        moved = putSig(s, 10 + 3 * j, st.clu.py[j]) || moved
      }
      for (let i = 0; i < N_ST; i++) {
        moved = putSig(s, 17 + 3 * i, st.stat[i].x) || moved
        moved = putSig(s, 18 + 3 * i, st.stat[i].y) || moved
        moved = putSig(s, 19 + 3 * i, st.statFit[i] * 100) || moved
      }
      if (moved) {
        st.ver++
        bumpObstacles()
      }
    },
    { priority: -85 },
  )
  return st
}
type StoryAnnot = ReturnType<typeof useStoryAnnot>

/** A connector from a node (px) to the edge of its pill, in world units (starting just off the node's glow); false when too short to draw. */
function linkInto(an: StoryAnnot, f: { nx: number; ny: number; cx: number; cy: number }, p: Float32Array, z: number, minLen = 5): boolean {
  const len = Math.hypot(f.cx - f.nx, f.cy - f.ny)
  if (len < minLen) {
    p.fill(AWAY)
    return false
  }
  const k = Math.min(0.45, 5 / len)
  p[0] = an.pxm.wx(f.nx + (f.cx - f.nx) * k)
  p[1] = an.pxm.wy(f.ny + (f.cy - f.ny) * k)
  p[2] = z
  p[3] = an.pxm.wx(f.cx)
  p[4] = an.pxm.wy(f.cy)
  p[5] = z
  return true
}

/* ------------------------------ cursor ---------------------------------- */

function Cursor({ frame, ppu, an }: { frame: ChartFrame; ppu: number; an: StoryAnnot }) {
  const pts = useMemo(() => new Float32Array(6), [])
  const last = useRef<{ u: number; f: ChartFrame | null }>({ u: -1, f: null })
  const update = (T: number, p: Float32Array): boolean => {
    const u = cursorU(T)
    if (u === last.current.u && frame === last.current.f) return false
    last.current.u = u
    last.current.f = frame
    const x = frame.x(u)
    p[0] = x
    p[1] = frame.y(0)
    p[2] = 0.05
    p[3] = x
    p[4] = frame.y(envV(u) + 0.035)
    p[5] = 0.05
    return true
  }
  // the connector from the node to its chip (a pole when the chip is over the node)
  const link = useMemo(() => new Float32Array(6), [])
  const lastLink = useRef(-1)
  const writeLink = (_T: number, p: Float32Array): boolean => {
    if (lastLink.current === an.ver) return false
    lastLink.current = an.ver
    linkInto(an, an.cur, p, 0.05)
    return true
  }
  // 7 px node (D.4), coloured by the engine that dominates under the cursor
  const nodeScale = 3.5 / ppu / 0.1
  return (
    <>
      <Pen
        points={pts}
        color={PAL.chalk}
        width={PEN.axis}
        update={update}
        opacity={(T) => 0.85 * cursorOn(T)}
        gain={(T) => 1 + 0.8 * cursorFlash(T)}
        renderOrder={46}
      />
      <Pen points={link} color={PAL.chalk} width={PEN.grid} update={writeLink} opacity={() => an.curCue} dim={() => 0.62} renderOrder={46} />
      <Nodes
        count={3}
        radius={0.1}
        color={PAL.chalk}
        colors={DOM_COLORS}
        opacity={(T) => Math.min(1, cursorOn(T) * 1.2)}
        rimStrength={0.8}
        emissiveIntensity={0.7}
        place={(T, i, out) => {
          const u = cursorU(T)
          out[0] = frame.x(u)
          out[1] = frame.y(envV(u))
          out[2] = 0.08
          return DOM_ORDER[i] === dominantAtT(cursorT(T)) ? nodeScale : 0
        }}
      />
      {/* the node is hot: the speaking element while the cursor reads the stack (L4) */}
      <Glows
        count={1}
        sizePx={26}
        colors={[LIGHT]}
        gain={1.7}
        place={(T, _i, out) => {
          const u = cursorU(T)
          out[0] = frame.x(u)
          out[1] = frame.y(envV(u))
          out[2] = 0.1
          return cursorOn(T) * (0.55 + 0.45 * cursorFlash(T))
        }}
      />
    </>
  )
}

/* ------------------------ stamped readings, tags ------------------------ */

/** One static flag's connector (ghost or tag), dimmer for a ghost. */
function StaticLink({ an, i }: { an: StoryAnnot; i: number }) {
  const link = useMemo(() => new Float32Array(6), [])
  const last = useRef(-1)
  const write = (_T: number, p: Float32Array): boolean => {
    if (last.current === an.ver) return false
    last.current = an.ver
    if (!an.statFit[i]) p.fill(AWAY)
    else linkInto(an, an.stat[i], p, 0.05)
    return true
  }
  return (
    <Pen
      points={link}
      color={PAL.chalk}
      width={PEN.grid}
      update={write}
      opacity={(T) => (an.statFit[i] ? stCue(T, i) : 0)}
      dim={() => (i < 2 ? 0.45 : 0.62)}
      renderOrder={46}
    />
  )
}

/** The stamped readings' connectors and the small nodes they were read at; the tags' connectors (their pins are their nodes). */
function Statics({ frame, ppu, an }: { frame: ChartFrame; ppu: number; an: StoryAnnot }) {
  const s = 2.6 / ppu / 0.1
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <StaticLink key={i} an={an} i={i} />
      ))}
      <Nodes
        count={2}
        radius={0.1}
        color={PAL.chalk}
        colors={GHOST_COLORS}
        opacity={(T) => 0.75 * Math.max(ghostOn(T, 0), ghostOn(T, 1))}
        rimStrength={0.6}
        emissiveIntensity={0.4}
        place={(T, g, out) => {
          out[0] = frame.x(ST_U[g])
          out[1] = frame.y(envV(ST_U[g]))
          out[2] = 0.07
          return ghostOn(T, g) > 0.01 ? s : 0
        }}
      />
    </>
  )
}

/* ------------------------------- pins ----------------------------------- */

function Pins({ frame, ppu, an }: { frame: ChartFrame; ppu: number; an: StoryAnnot }) {
  const segs = useMemo(() => new Float32Array(PINS.length * 6).fill(AWAY), [])
  const last = useRef<{ T: number; fid: ChartFrame | null }>({ T: -1, fid: null })
  const headY = (T: number, k: number) => {
    const a = pinDrop(T, k)
    return frame.y(envV(PIN_U[k])) + (1 - a) * DROP
  }
  const write = (T: number, s: Float32Array): boolean => {
    if (T === last.current.T && frame === last.current.fid) return false
    last.current.T = T
    last.current.fid = frame
    for (let k = 0; k < PINS.length; k++) {
      const o = k * 6
      const a = pinDrop(T, k)
      if (a <= 0.02) {
        s.fill(AWAY, o, o + 6)
        continue
      }
      const x = frame.x(PIN_U[k])
      const y0 = frame.y(0)
      const y1 = headY(T, k)
      // the stem grows up from the axis as the head falls onto the curve
      s[o] = x
      s[o + 1] = y0
      s[o + 2] = 0.03
      s[o + 3] = x
      s[o + 4] = y0 + (y1 - y0) * Math.min(1, a)
      s[o + 5] = 0.03
    }
    return true
  }
  const vis = (T: number) => focus(T, P.workouts) * (1 - lanesM(T))
  const headScale = 3.6 / ppu / 0.1
  // landing: the snap overshoots and settles around 60% of each pin's window
  const land = (T: number, k: number) => {
    const a = pinDrop(T, k)
    return a > 0.85 && a < 1.2 ? Math.max(0, 1 - Math.abs(a - 1) * 6) : 0
  }
  // the cluster names' leaders (annot.ts): pin head to name
  const leads = useMemo(() => new Float32Array(18).fill(AWAY), [])
  const lastLead = useRef(-1)
  const writeLeads = (_T: number, s: Float32Array): boolean => {
    if (lastLead.current === an.ver) return false
    lastLead.current = an.ver
    const c = an.clu
    const { pxm } = an
    for (let j = 0; j < 3; j++) {
      const o = j * 6
      const len = Math.hypot(c.ex[j] - c.px[j], c.ey[j] - c.py[j])
      if (!c.r[j].on || len < 7) {
        s.fill(AWAY, o, o + 6)
        continue
      }
      const k = Math.min(0.45, 5 / len)
      s[o] = pxm.wx(c.px[j] + (c.ex[j] - c.px[j]) * k)
      s[o + 1] = pxm.wy(c.py[j] + (c.ey[j] - c.py[j]) * k)
      s[o + 2] = 0.04
      s[o + 3] = pxm.wx(c.ex[j])
      s[o + 4] = pxm.wy(c.ey[j])
      s[o + 5] = 0.04
    }
    return true
  }
  return (
    <>
      <PenBatch segments={segs} color={PAL.chalk} width={PEN.grid} update={write} opacity={(T) => 0.36 * vis(T)} renderOrder={33} />
      <PenBatch segments={leads} color={PAL.chalk} width={PEN.grid} update={writeLeads} opacity={() => an.cluCue} dim={() => 0.62} renderOrder={46} />
      <Nodes
        count={PINS.length}
        radius={0.1}
        color={PAL.chalk}
        colors={PIN_COLORS}
        opacity={vis}
        rimStrength={0.7}
        emissiveIntensity={0.55}
        place={(T, k, out) => {
          const a = pinDrop(T, k)
          out[0] = frame.x(PIN_U[k])
          out[1] = headY(T, k)
          out[2] = 0.06
          // P6: a pin swells as its engine's bracket lights it
          return a > 0.02 ? headScale * (1 + 0.45 * pinLit(T, k)) : 0
        }}
      />
      <Glows
        count={PINS.length}
        sizePx={26}
        colors={PIN_COLORS}
        gain={1.5}
        place={(T, k, out) => {
          out[0] = frame.x(PIN_U[k])
          out[1] = frame.y(envV(PIN_U[k]))
          out[2] = 0.09
          return land(T, k) * vis(T)
        }}
      />
      {/* P6: each engine's bracket lights the familiar workouts it leads: they span all three */}
      <Glows
        count={PINS.length}
        sizePx={46}
        colors={PIN_COLORS}
        gain={2.4}
        place={(T, k, out) => {
          out[0] = frame.x(PIN_U[k])
          out[1] = frame.y(envV(PIN_U[k]))
          out[2] = 0.09
          return pinLit(T, k) * vis(T)
        }}
      />
    </>
  )
}

/** The Marathon chip's leader: from the chevron tip up to its chip. */
function MaraLink({ an }: { an: StoryAnnot }) {
  const link = useMemo(() => new Float32Array(6), [])
  const last = useRef(-1)
  const write = (_T: number, p: Float32Array): boolean => {
    if (last.current === an.ver) return false
    last.current = an.ver
    linkInto(an, an.mara, p, 0.05, 6)
    return true
  }
  return <Pen points={link} color={PAL.oxidative} width={PEN.grid} update={write} opacity={() => an.maraCue} dim={() => 0.7} renderOrder={46} />
}

/* ------------------------------- labels --------------------------------- */

function useStoryLabels(frame: ChartFrame, layout: Layout, ua: UnderAxis, an: StoryAnnot) {
  const narrow = narrowChart(layout)
  const specs = useMemo<LabelSpec[]>(() => {
    const x = frame.x
    const y = frame.y
    const yRow = y(0) - ua.strip
    const sx = stringX(frame)
    const lift = (ROW.title - ROW.band) / pxPerUnit(frame)
    /** a solver-placed pill: anchored at its bottom-left corner, NE with no gap, so the placer puts it exactly there */
    const at0 = (b: { x: number; y: number; h: number }) => pt(an.pxm.wx(b.x), an.pxm.wy(b.y + b.h), 0.08)
    const out: LabelSpec[] = [
      {
        id: 'pw-ax-y',
        text: 'Power output',
        tone: 'tick',
        anchor: [x(0), y(frame.vMax), 0],
        prefer: 'E',
        only: ['E', 'NE', 'SE'],
        gapPx: 8,
        priority: 78,
        cue: yTitle,
      },
      {
        id: 'pw-ax-x',
        text: 'Effort duration (log)',
        tone: 'tick',
        // P0: directly under the ticks; it eases down to its row as the duration strings arrive (review r2)
        anchor: (T) => pt(x(0.5), yRow + lift * (1 - keyRow(T)), 0),
        prefer: 'S',
        only: ['S'],
        gapPx: ROW.title,
        priority: 78,
        cue: (T) => construct(T) * focus(T, P.three),
      },
    ]
    TICKS.forEach((t, j) => {
      if (narrow && !t.phone) return
      out.push({
        id: `pw-tk-${j}`,
        text: t.label,
        tone: 'tick',
        anchor: [x(uOf(t.s)), yRow, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: ROW.tick,
        priority: 80,
        cue: (T) => at(T, P.three, 0.16 + 0.025 * j, 0.3 + 0.025 * j),
      })
    })
    // the duration strings (ENERGY_SYSTEMS[].duration), each under its own
    // range, landing with its engine and staying through P6 (the brackets reuse them)
    AXIS_ORDER.forEach((key, k) => {
      const sys = ENERGY_SYSTEMS.find((s) => s.key === key)
      if (!sys) return
      out.push({
        id: `pw-band-${k}`,
        text: sys.duration,
        tone: 'name',
        color: sys.color,
        anchor: [sx[k], yRow, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: ROW.band,
        priority: 74,
        cue: (T) => stripOn(T, k) * Math.max(0.6, focus(T, FLOOD_BEAT[BAND_OF_AXIS[k]]), at(T, P.all, 0.1, 0.4)),
      })
    })
    // P1 to P3: the cursor callout, one per engine colour (the colour IS the dominant engine)
    DOM_ORDER.forEach((key) => {
      out.push({
        id: `pw-cur-${key}`,
        // a real value from the first frame, so the pill is never measured empty
        text: calloutText(T_MIN),
        tone: 'callout',
        color: COLOR[key],
        minChars: 24,
        anchor: () => at0(an.cur),
        prefer: 'NE',
        only: ['NE'],
        gapPx: 0,
        leader: true,
        required: true,
        priority: 96,
        cue: (T) => (dominantAtT(cursorT(T)) === key ? curCallout(T) : 0),
      })
    })
    // the stamped readings and the P5 tags (review r2): full, or the short fallback
    for (let i = 0; i < N_ST; i++) {
      for (const short of [false, true]) {
        out.push({
          id: short ? `${ST_IDS[i]}-s` : ST_IDS[i],
          text: short ? ST_SHORT[i] : ST_TEXT[i],
          tone: 'callout',
          color: ST_COLOR[i],
          anchor: () => at0(an.stat[i]),
          prefer: 'NE',
          only: ['NE'],
          gapPx: 0,
          leader: true,
          priority: 94 - 0.1 * i,
          cue: (T) => (an.statFit[i] === (short ? 2 : 1) ? stCue(T, i) * ST_LEVEL[i] : 0),
        })
      }
    }
    // P3 on: the Marathon edge chip over its chevron (F.7: never plotted on the axis)
    if (MARATHON)
      out.push({
        id: 'pw-mara',
        text: MARA_TEXT,
        tone: 'callout',
        color: COLOR[MARATHON.dominant],
        anchor: () => at0(an.mara),
        prefer: 'NE',
        only: ['NE'],
        gapPx: 0,
        leader: true,
        priority: 88,
        cue: maraOn,
      })
    // P4: each lane named on its own lane (one shared power scale); the
    // phosphagen name sits on its falling spike, clear of the top-left corner
    for (let b = 0; b < 3; b++) {
      const u0 = LANE_NAME_U[b]
      // the top lane (phosphagen) peaks at the top of the chart: on a short portrait rect
      // its name is anchored further along the falling curve, where it has headroom (fix round 1)
      const u1 = b === 2 ? LANE_NAME_U_SHORT : u0
      out.push({
        id: `pw-lane-${b}`,
        text: NAME[BAND_KEY[b]],
        tone: 'callout',
        color: BAND_COLORS[b],
        required: true,
        anchor: (T) => {
          const u = shortPortrait() ? u1 : u0
          return pt(x(u), y(topV(b, u, lanesM(T))), 0.05)
        },
        prefer: b === 2 ? 'NE' : 'N',
        gapPx: 10,
        leader: true,
        priority: 90,
        cue: laneNames,
      })
    }
    // P4 claim: the peak order (PathwaysModule.note), two stacked chips so it fits 360 px
    out.push(
      {
        id: 'pw-order-h',
        text: 'Peak power order:',
        tone: 'legend',
        color: PAL.chalk,
        dot: false,
        anchor: [0, 0, 0],
        pin: 'top-right',
        pinOrder: 0,
        cue: orderClaim,
      },
      {
        id: 'pw-order',
        text: PEAK_ORDER_TEXT,
        tone: 'legend',
        color: PAL.phosphagen,
        swatches: DOM_COLORS,
        dot: false,
        anchor: [0, 0, 0],
        pin: 'top-right',
        pinOrder: 1,
        required: true,
        cue: orderClaim,
      },
    )
    // P5: the benchmark pins' names (a chip or a tag replaces the name it
    // describes); the cluster names are laid out as a group (annot.ts), the rest by the placer
    PINS.forEach((p, k) => {
      const u = PIN_U[k]
      const j = CLUSTER.indexOf(k)
      const tag = TAG_PIN.indexOf(k)
      if (j >= 0)
        out.push({
          id: `pw-pin-${k}`,
          text: p.name,
          tone: 'name',
          color: COLOR[p.dominant],
          dot: false,
          anchor: () => {
            const r = an.clu.r[j]
            return pt(an.pxm.wx(r.x), an.pxm.wy(r.y + r.h), 0.06)
          },
          prefer: 'NE',
          only: ['NE'],
          gapPx: 0,
          leader: true,
          priority: 93 - j * 0.1,
          cue: (T) => pinName(T, k),
        })
      else
        out.push({
          id: `pw-pin-${k}`,
          text: p.name,
          tone: 'name',
          color: COLOR[p.dominant],
          dot: false,
          anchor: [x(u), y(envV(u)), 0.06],
          prefer: u > 0.75 ? 'N' : 'NE',
          gapPx: 9,
          leader: true,
          priority: 64 - k * 0.1,
          // a tagged pin's name gives way to its tag (only while the tag is placed)
          cue: (T) => pinName(T, k) * (tag >= 0 && an.statFit[2 + tag] ? 1 - Math.min(1, 4 * tagOn(T, tag)) : 1),
        })
    })
    // P5 result chips and the P6 Fran chip: the cursor's chip (annot.ts)
    STOP_PIN.forEach((k, s) => {
      if (k < 0) return
      const p = PINS[k]
      out.push({
        id: `pw-res-${s}`,
        text: RES_TEXT[s],
        tone: 'callout',
        color: COLOR[p.dominant],
        anchor: () => at0(an.cur),
        prefer: 'NE',
        only: ['NE'],
        gapPx: 0,
        leader: true,
        required: true,
        priority: 96,
        cue: (T) => resultOn(T, s),
      })
    })
    if (FRAN_PIN >= 0)
      out.push({
        id: 'pw-res-fran',
        text: FRAN_TEXT,
        tone: 'callout',
        color: PAL.chalk,
        swatches: DOM_COLORS,
        anchor: () => at0(an.cur),
        prefer: 'NE',
        only: ['NE'],
        gapPx: 0,
        leader: true,
        required: true,
        priority: 96,
        cue: franChip,
      })
    return out
  }, [frame, narrow, ua, an])
  useLabels(specs)
}

/** Data marks the labels must not cover: the envelope (or the lane tops), the pins, the cursor node, the power axis, and the leaders. */
function useDataObstacles(frame: ChartFrame, an: StoryAnnot) {
  const S = 36
  const curves = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        let n = 0
        const m = lanesM(T)
        if (T < P.three + 0.4) return 0
        if (m < 0.5) {
          for (let i = 0; i < S; i++) {
            const u = i / (S - 1)
            out[n * 3] = frame.x(u)
            out[n * 3 + 1] = frame.y(envV(u))
            out[n * 3 + 2] = 0
            n++
          }
        } else {
          for (let b = 0; b < 3; b++)
            for (let i = 0; i < S; i++) {
              const u = i / (S - 1)
              out[n * 3] = frame.x(u)
              out[n * 3 + 1] = frame.y(topV(b, u, m))
              out[n * 3 + 2] = 0
              n++
            }
        }
        return n
      },
      maxPoints: 3 * S,
      radiusPx: 5,
    }),
    [frame],
  )
  const marks = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        let n = 0
        if (T >= P.workouts + 0.3 && lanesM(T) < 0.5)
          for (let k = 0; k < PINS.length; k++) {
            out[n * 3] = frame.x(PIN_U[k])
            out[n * 3 + 1] = frame.y(envV(PIN_U[k]))
            out[n * 3 + 2] = 0
            n++
          }
        if (cursorOn(T) > 0.05) {
          const u = cursorU(T)
          out[n * 3] = frame.x(u)
          out[n * 3 + 1] = frame.y(envV(u))
          out[n * 3 + 2] = 0
          n++
        }
        return n
      },
      maxPoints: PINS.length + 1,
      radiusPx: 8,
    }),
    [frame],
  )
  const axis = useMemo<WorldObstacle>(
    () => ({
      box: (T) =>
        at(T, P.three, 0, 0.3) > 0
          ? [
              [frame.x(0) - 0.02, frame.y(0), 0],
              [frame.x(0) + 0.02, frame.y(frame.vMax), 0],
            ]
          : null,
      padPx: 3,
    }),
    [frame],
  )
  // the leaders (the cursor's pole, the Marathon's, the stamped readings', the tags', the cluster's): names keep off them, short of the pill each one ends on
  const links = useMemo<WorldObstacle>(() => {
    const MAX = 90
    const seg = (out: Float32Array, n: number, x0: number, y0: number, x1: number, y1: number): number => {
      const len = Math.hypot(x1 - x0, y1 - y0)
      if (len < 14) return n
      const steps = Math.min(16, Math.floor((len - 12) / 8))
      for (let i = 0; i <= steps && n < MAX; i++) {
        const t = (6 + ((len - 16) * i) / Math.max(1, steps)) / len
        out[n * 3] = an.pxm.wx(x0 + (x1 - x0) * t)
        out[n * 3 + 1] = an.pxm.wy(y0 + (y1 - y0) * t)
        out[n * 3 + 2] = 0
        n++
      }
      return n
    }
    return {
      points: (_T, out) => {
        let n = 0
        const f = an.cur
        if (an.curCue > 0.01) n = seg(out, n, f.nx, f.ny, f.cx, f.cy)
        const m = an.mara
        if (an.maraCue > 0.01) n = seg(out, n, m.nx, m.ny, m.cx, m.cy)
        for (let i = 0; i < N_ST; i++) {
          const g = an.stat[i]
          if (an.statFit[i] && an.statCue[i] > 0.01) n = seg(out, n, g.nx, g.ny, g.cx, g.cy)
        }
        const c = an.clu
        if (an.cluCue > 0.01) for (let j = 0; j < 3; j++) if (c.r[j].on) n = seg(out, n, c.px[j], c.py[j], c.ex[j], c.ey[j])
        return n
      },
      maxPoints: MAX,
      radiusPx: 3,
    }
  }, [an])
  useWorldObstacle('pw-curves', curves)
  useWorldObstacle('pw-marks', marks)
  useWorldObstacle('pw-yaxis', axis)
  useWorldObstacle('pw-links', links)
}

/* ------------------------------- story ---------------------------------- */

const constructionVis: ConstructionVis = {
  // the full-height axis steps back while the lanes stand on their own zeros (P4)
  axes: { progress: axesDraw, dim: (T) => 0.55 * focus(T, P.three) * (1 - 0.8 * lanesM(T)), head: true },
  ticks: { progress: ticksDraw, dim: (T) => 0.6 * focus(T, P.three) },
}

/** P0's dim engines: level of light relative to a flooded band, and the width (u) of their wipe's soft edge. */
const GHOST = 0.3
const GHOST_SOFT = 0.012

function StoryScene({ frame, tier }: { frame: ChartFrame; tier: Tier }) {
  const { layout } = useBeat()
  const ppu = pxPerUnit(frame)
  const ua0 = underAxis(frame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ua = useMemo(() => ua0, [ua0.tick, ua0.strip])
  const an = useStoryAnnot(frame)
  useStoryLabels(frame, layout, ua, an)
  useDataObstacles(frame, an)
  const envArc = useMemo(() => envelopeArc(frame), [frame])
  // P0: the dim engines are wiped on under the envelope's pen head (a clean vertical edge that travels with it)
  const ghostSrc = useMemo<BandSource>(() => {
    const reveal = (T: number) => {
      const p = envDraw(T)
      return p >= 1 ? 2 : uAtArc(envArc, p) + GHOST_SOFT
    }
    return { m: lanesM, s: () => 0, front: (T) => reveal(T) }
  }, [envArc])
  const flow = useMemo(() => makeFlowState(POWER_MAX), [])
  const low = tier === 'low'

  /**
   * Band b's opacity: on once its flood starts, with the focus pull of its
   * beat (L3). In P6 it swells with its bracket (x1.4, additive: more light).
   */
  const bandOpacity = (T: number, b: number) =>
    T < FLOOD_BEAT[b] + 0.05 ? 0 : focus(T, FLOOD_BEAT[b]) * (1 + 0.4 * bracketPulse(T, AXIS_ORDER.indexOf(BAND_KEY[b])))
  /** Band b's rim: HDR while it floods (the speaking element) and when its bracket pulses (P6). */
  const bandRim = (T: number, b: number) => {
    if (low) return 0.5
    const k = AXIS_ORDER.indexOf(BAND_KEY[b])
    return 0.04 + 2.2 * flooding(T, b) + 1.4 * bracketPulse(T, k) + 0.8 * impactK(T)
  }
  return (
    <>
      <Construction frame={frame} vis={constructionVis} uOfS={uOf} ua={ua} />
      {[0, 1, 2].map((b) => (
        <BandFill
          key={`g${b}`}
          frame={frame}
          b={b}
          src={ghostSrc}
          tier={tier}
          level={GHOST}
          soft={GHOST_SOFT}
          opacity={(T) => dimEngineOn(T, b)}
          rim={() => (low ? 0.3 : 0)}
          renderOrder={9}
        />
      ))}
      {[0, 1, 2].map((b) => (
        <BandFill key={b} frame={frame} b={b} src={SRC} tier={tier} opacity={(T) => bandOpacity(T, b)} rim={(T) => bandRim(T, b)} />
      ))}
      <River
        frame={frame}
        tier={tier}
        uniforms={(T, A) => {
          const u = flow.u
          u.flow = 0.035 * A
          u.bandOn[0] = moteOn(T, 0) * focus(T, P.oxi)
          u.bandOn[1] = moteOn(T, 1) * focus(T, P.gly)
          u.bandOn[2] = moteOn(T, 2) * focus(T, P.phos)
          u.opacity = T < P.phos ? 0 : 1
          u.hot = 0.25 * impactK(T)
          setFlowMorph(flow, lanesM(T))
          return u
        }}
      />
      <HandoverStrip
        frame={frame}
        ua={ua}
        reveal={(T, k) => stripOn(T, k)}
        opacity={(T) => 0.22 + 0.12 * at(T, P.all, 0.1, 0.4) + 0.1 * impactK(T)}
      />
      <LaneAxes frame={frame} opacity={laneLines} />
      {[0, 1, 2].map((b) => (
        <BandPen
          key={b}
          frame={frame}
          b={b}
          src={SRC}
          head={true}
          opacity={(T) => (T < FLOOD_BEAT[b] + 0.05 ? 0 : 1)}
          dim={(T) => focus(T, FLOOD_BEAT[b])}
          gain={(T) => 1 + 0.4 * bracketPulse(T, AXIS_ORDER.indexOf(BAND_KEY[b]))}
        />
      ))}
      <Envelope frame={frame} progress={envDraw} opacity={envOn} dim={(T) => focus(T, P.three)} head />
      <Brackets
        frame={frame}
        ua={ua}
        draw={bracketDraw}
        gain={(T, k) => 1 + 0.4 * bracketPulse(T, k) + 0.8 * impactK(T)}
        opacity={() => 1}
      />
      <MarathonChevron frame={frame} progress={(T) => at(T, P.oxi, 0.86, 0.94)} dim={(T) => 0.9 * Math.max(0.55, focus(T, P.oxi))} />
      <MaraLink an={an} />
      <Statics frame={frame} ppu={ppu} an={an} />
      <Pins frame={frame} ppu={ppu} an={an} />
      <Cursor frame={frame} ppu={ppu} an={an} />
    </>
  )
}

export default function PathwaysScene() {
  const frame = useChapterChart()
  const mode = useStoryStore((s) => s.mode)
  const tier = useStoryStore((s) => s.tier)
  // Both layers stay mounted (prewarm); the mode only toggles visibility.
  return (
    <>
      <group visible={mode === 'story'}>
        <StoryScene frame={frame} tier={tier} />
      </group>
      <group visible={mode === 'explore'}>
        <ExploreScene frame={frame} tier={tier} />
      </group>
    </>
  )
}
