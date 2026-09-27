import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, SKILLS } from '../../fitnessData'
import { at, cue, focus, pulse, stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useSafeFrame } from '../../story/useSafeFrame'
import { Pen, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import { Ripple } from '../../story/kit/Ripple'
import { impactK } from '../../story/kit/impact'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Layout, LabelSpec, Tier, V3 } from '../../story/types'
import { DEPTH, ELBOW_R, FLAT, LABEL_R, MINI_R, R, ARC_R, RING_OUT, SIDE, TAGS, grid, useWideNames, type TagKey } from './layout'
import { LEAD_N, pillH, pillW, tagCam, tagEnd, tagPoint, writeLeader } from './tags'
import {
  CLASS_COLOR,
  CLASS_LABEL,
  GENERALIST,
  MAX_VALUE,
  N,
  POWERLIFTER,
  RANKED,
  SKILL_COLORS,
  dirX,
  dirY,
  floorOf,
  weakestIndex,
} from './skillsMath'
import {
  Construction,
  FloorRing,
  Hatch,
  Heads,
  Minis,
  ProfileSolid,
  arcPolyline,
  angleOfF,
  newProfile,
  px,
  py,
  setRadius,
  type CapLook,
  type ConstructionVis,
  type MiniCell,
  type MinisVis,
  type SolidVis,
} from './radar'
import { setLabelColor, rgba } from './labelColor'
import ExploreScene from './ExploreScene'

/* =========================================================================
   01 SKILLS, "Ten spokes, one floor" (DESIGN.md D.2). Six beats, every
   property a pure function of story time T:
     S0 the pen sweeps five rings, then draws the ten spokes clockwise; each
        skill is named as its spoke lands, and the rim is marked 10;
     S1 a green arc sweeps the four TRAINED skills, colouring each spoke as it
        passes, then a blue arc the four PRACTICED ones;
     S2 the arcs grow toward each other and overlap over power and speed,
        which turn amber (BOTH; the chapter's impact accent);
     S3 the Generalist's shape grows from the centre and rises into a lit
        prism as the camera tilts to show its depth; its floor ring is drawn
        at its weakest skill and lights the three vertices it touches;
     S4 (signature) front-on again: the generalist steps back to a ghost, the
        Powerlifter's dashed outline spikes past it and cuts inside it, the
        gaps hatch in the colour of loss, and the floor ring collapses from
        7 to 2, catching on Endurance, which is named;
     S5 the wheel folds into the first cell of thirteen, sorted by weakest
        skill.

   Prewarm (README): everything, the S5 grid and the explore layer included,
   is mounted at load and hidden by T or mode.
   ========================================================================= */

export const S = { ten: 0, classes: 1, both: 2, gen: 3, spec: 4, grid: 5 } as const
const G = GENERALIST.profile
const P = POWERLIFTER.profile
const G_FLOOR = floorOf(G)
const P_FLOOR = floorOf(P)
const P_WEAK = weakestIndex(P)
/** every vertex the generalist's floor ring touches (a tie is shown as a tie) */
const G_TIES: number[] = G.map((v, i) => (v === G_FLOOR ? i : -1)).filter((i) => i >= 0)
/** the warm white of a hot pen tip (the kit's head colour family) */
const LIGHT = '#e9ffc4'

/* ------------------------------ timing -------------------------------- */

// S0: rings sweep, then the ten spokes, clockwise, each named as it lands
const ringSweep = (T: number) => at(T, S.ten, 0, 0.2, ease.draw)
const SP_A = 0.2
const SP_B = 0.75
const SP_SPREAD = 0.7
const spokeDraw = (T: number, i: number) => stagger(T, S.ten + SP_A, S.ten + SP_B, i, N, SP_SPREAD, ease.draw)
const spokeEnd = (i: number) => S.ten + SP_A + ((SP_B - SP_A) * SP_SPREAD * i) / (N - 1) + (SP_B - SP_A) * (1 - SP_SPREAD)
const nameIn = (T: number, i: number) => cue(T, spokeEnd(i) - 0.035, spokeEnd(i) + 0.035)

/** Everything built before the grid folds away as the wheel becomes cell 0 (S5). */
const constructionOut = (T: number) => 1 - at(T, S.grid, 0, 0.25)
/** S5 FLIP: the wheel shrinks into cell 0. */
const flipK = (T: number) => at(T, S.grid, 0, 0.35, ease.morph)
/** The big wheel hands over to its mini (cell 0) once it has landed. */
const mainOut = (T: number) => 1 - at(T, S.grid, 0.3, 0.42)

// S1, S2: class arcs, in fractional spoke positions (clockwise from Strength)
const PADF = 0.2
const TR_A = -PADF
const TR_B1 = 3 + PADF
const TR_B2 = 5 + PADF
const PR_A = 6 - PADF
const PR_B = 9 + PADF
const PX_B = 4 - PADF
const trainedProg = (T: number) => at(T, S.classes, 0.05, 0.45, ease.draw)
const trainedExt = (T: number) => at(T, S.both, 0.05, 0.55, ease.draw)
const practicedProg = (T: number) => at(T, S.classes, 0.5, 0.9, ease.draw)
const practicedExt = (T: number) => at(T, S.both, 0.05, 0.55, ease.draw)
/** S2: the overlap turns amber as the two arcs meet over power and speed. */
const bothOn = (T: number) => at(T, S.both, 0.5, 0.62, ease.settle)
/** S3: the class layer (arcs, spoke colours, name dots, key) rests at 35%; S4: it leaves the comparison. */
const genDim = (T: number) => at(T, S.gen, 0, 0.15)
const arcDim = (T: number) => 1 - 0.65 * genDim(T)
const arcOut = (T: number) => 1 - at(T, S.spec, 0, 0.3)

/** inverse of ease.draw (bisection), for the moment a pen passes a given fraction of its stroke */
function invDraw(y: number): number {
  let lo = 0
  let hi = 1
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2
    if (ease.draw(m) < y) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}
/** Global T at which each spoke takes its class colour. */
const PASS: number[] = SKILLS.map((s, i) => {
  if (s.classification === 'trained') return S.classes + 0.05 + 0.4 * invDraw((i - TR_A) / (TR_B1 - TR_A))
  if (s.classification === 'practiced') return S.classes + 0.5 + 0.4 * invDraw((i - PR_A) / (PR_B - PR_A))
  return S.both + 0.52
})
/** 0..1: spoke i's class colour (it runs from the rim to the centre just after the arc passes). */
const classK = (T: number, i: number) => cue(T, PASS[i], PASS[i] + 0.09, ease.settle)
/** S1 to S2: the skills not yet coloured rest at 35%; S3 restores them. */
const nameEmph = (T: number, i: number) => {
  if (T < S.classes) return 1
  const dimK = at(T, S.classes, 0.03, 0.12) * (1 - at(T, S.gen, 0, 0.12))
  if (SKILLS[i].classification === 'trained') return 1
  return 1 - 0.65 * dimK * (1 - classK(T, i))
}

// S3: the Generalist grows, spoke by spoke (50 ms stagger), and rises
const growV = (T: number, i: number) => stagger(T, S.gen + 0.1, S.gen + 0.55, i, N, 0.22, ease.settle)
/** S3: the prism rises; S4: it flattens again for the front-on comparison. */
const genDepth = (T: number) => FLAT + (DEPTH - FLAT) * at(T, S.gen, 0.2, 0.6, ease.settle) * (1 - at(T, S.spec, 0, 0.3, ease.settle))
/** S4: the generalist steps back to a ghost (outline 45% on a thin stroke, fill 15%); S5 restores it as it folds. */
const ghostK = (T: number) => at(T, S.spec, 0, 0.25, ease.settle) * (1 - at(T, S.grid, 0, 0.22, ease.settle))
/** S3 claim: the floor ring is drawn at the weakest skill. */
const RING_A = 0.6
const RING_B = 0.84
const ringDraw = (T: number) => at(T, S.gen, RING_A, RING_B, ease.draw)
/** Global T at which the S3 ring's pen passes vertex i (the ring runs clockwise from 12 o'clock, spoke i at i / N of it). */
const touchT = (i: number) => S.gen + RING_A + (RING_B - RING_A) * invDraw(i / N)
/** S3: "Weakest skill 7" and its leader; they leave as the generalist steps back (S4). */
const weakGOut = (T: number) => 1 - at(T, S.spec, 0.08, 0.22)
/** S4 claim: the floor collapses from 7 to 2 ... */
const collapse = (T: number) => at(T, S.spec, 0.66, 0.86, ease.morph)
/** ... and catches on Endurance. */
const catchK = (T: number) => at(T, S.spec, 0.85, 0.92, ease.settle)
const specOut = (T: number) => 1 - at(T, S.grid, 0, 0.12)

// S5: the cells land in rank order (40 ms stagger) while the wheel folds into cell 0
const cellGrow = (T: number, k: number) =>
  k === 0 ? (T >= S.grid + 0.3 ? 1 : 0) : stagger(T, S.grid + 0.16, S.grid + 0.76, k - 1, RANKED.length - 1, 0.15, ease.settle)
const cellRing = (T: number, k: number) =>
  k === 0 ? (T >= S.grid + 0.3 ? 1 : 0) : stagger(T, S.grid + 0.3, S.grid + 0.92, k - 1, RANKED.length - 1, 0.15, ease.draw)
const gridOn = (T: number) => at(T, S.grid, 0.12, 0.18)

/* ------------------------------ elements ------------------------------ */

const G_CELLS: MiniCell[] = RANKED.map((r) => ({ profile: r.profile, floor: r.floor, color: r.isG ? PAL.yellowGreen : PAL.chalk, lit: r.isG }))
/** the generalist's cap: a fuller body of light than the default chalk dust, so the centre is lime, not olive */
const GEN_CAP: CapLook = { lo: 0.07, hi: 0.4, pow: 1.35 }

/** S1, S2: the class arcs. Resting dimmed uses `dim` (no beads), fades use opacity. */
function ClassArcs() {
  const trained = useMemo(() => arcPolyline(TR_A, TR_B1, ARC_R - 0.14, 0.02, 64), [])
  const tExt = useMemo(() => arcPolyline(TR_B1, TR_B2, ARC_R - 0.14, 0.02, 40), [])
  const practiced = useMemo(() => arcPolyline(PR_A, PR_B, ARC_R + 0.14, 0.02, 72), [])
  const pExt = useMemo(() => arcPolyline(PR_A, PX_B, ARC_R + 0.14, 0.02, 48), [])
  const both = useMemo(() => arcPolyline(4 - PADF, 5 + PADF, ARC_R, 0.03, 32), [])
  const vis = (T: number) => arcOut(T) * constructionOut(T)
  return (
    <>
      <Pen points={trained} color={PAL.trained} width={4} head hot progress={trainedProg} opacity={vis} dim={arcDim} gain={() => 1.25} renderOrder={36} />
      <Pen points={tExt} color={PAL.trained} width={4} head hot progress={trainedExt} opacity={vis} dim={arcDim} gain={() => 1.25} renderOrder={36} />
      <Pen points={practiced} color={PAL.practiced} width={4} head hot progress={practicedProg} opacity={vis} dim={arcDim} renderOrder={36} />
      <Pen points={pExt} color={PAL.practiced} width={4} head hot progress={practicedExt} opacity={vis} dim={arcDim} renderOrder={36} />
      <Pen
        points={both}
        color={PAL.both}
        width={6.5}
        opacity={(T) => bothOn(T) * vis(T)}
        dim={arcDim}
        // the impact accent (B.10): the overlap flares as the two families meet
        gain={(T) => 1 + 0.9 * impactK(T)}
        renderOrder={37}
      />
      {/* the overlap lands with a flash of light over power and speed */}
      <Glows
        count={2}
        sizePx={54}
        colors={[PAL.both]}
        gain={2.2}
        place={(T, j, out) => {
          const i = 4 + j
          out[0] = px(i, ARC_R)
          out[1] = py(i, ARC_R)
          out[2] = 0.06
          return pulse(T, S.both + 0.5, S.both + 0.72)
        }}
      />
    </>
  )
}

/** The text each tag carries (its pill size keeps it inside the rect). */
const TAG_TEXT: Record<TagKey, string> = {
  trained: CLASS_LABEL.trained,
  practiced: CLASS_LABEL.practiced,
  both: CLASS_LABEL.both,
  weakG: `Weakest skill ${G_FLOOR}`,
  weakP: `Weakest skill ${P_FLOOR}`,
}
const TAG_Z = 0.05

/** The world point of tag k's pill centre for this layout (into the caller's buffer). */
function tagWorld(layout: Layout, k: TagKey, out: [number, number, number]): V3 {
  return tagPoint(TAGS[layout][k].slot, pillW(TAG_TEXT[k]), pillH(), TAG_Z, RING_OUT, out)
}

/** The vertex the S3 floor tag names: one the ring touches (layout.ts), or the first weakest if the data ever changes. */
const weakGVertex = (layout: Layout) => (G[TAGS[layout].weakG.from] === G_FLOOR ? TAGS[layout].weakG.from : weakestIndex(G))

/** Where tag k's leader starts at story time T. */
function tagFrom(layout: Layout, k: TagKey, T: number, out: [number, number, number]): void {
  if (k === 'weakG') {
    const i = weakGVertex(layout)
    out[0] = px(i, G_FLOOR)
    out[1] = py(i, G_FLOOR)
    out[2] = genDepth(T) + 0.03
    return
  }
  if (k === 'weakP') {
    out[0] = px(P_WEAK, P_FLOOR)
    out[1] = py(P_WEAK, P_FLOOR)
    out[2] = 0.1
    return
  }
  const rr = k === 'trained' ? ARC_R - 0.14 : k === 'practiced' ? ARC_R + 0.14 : ARC_R
  const a = angleOfF(TAGS[layout][k].from)
  out[0] = rr * Math.cos(a)
  out[1] = rr * Math.sin(a)
  out[2] = 0.03
}

/**
 * One tag leader: from what it names, out through the gap between two
 * names, to its pill. Rewritten only when its start, the tag point or the
 * layout changed (the tag point follows the camera and the focus rect).
 */
function TagLeader({
  layout,
  k,
  color,
  width,
  progress,
  opacity,
  dim,
}: {
  layout: Layout
  k: TagKey
  color: string
  width: number
  progress: (T: number) => number
  opacity: (T: number) => number
  dim?: (T: number) => number
}) {
  const pts = useMemo(() => new Float32Array(LEAD_N * 3), [])
  const st = useMemo(() => ({ a: [0, 0, 0] as [number, number, number], b: [0, 0, 0] as [number, number, number], key: new Float64Array(6).fill(Number.NaN) }), [])
  const write = (T: number, p: Float32Array): boolean => {
    if (opacity(T) <= 0.002) return false
    const spec = TAGS[layout][k]
    tagFrom(layout, k, T, st.a)
    tagEnd(spec.slot, TAG_TEXT[k], spec.end, TAG_Z, RING_OUT, st.b)
    const K = st.key
    const lk = layout === 'P' ? 0 : 1
    if (K[0] === st.a[0] && K[1] === st.a[1] && K[2] === st.a[2] && K[3] === st.b[0] && K[4] === st.b[1] && K[5] === lk) return false
    K[0] = st.a[0]
    K[1] = st.a[1]
    K[2] = st.a[2]
    K[3] = st.b[0]
    K[4] = st.b[1]
    K[5] = lk
    writeLeader(p, st.a, st.b, spec.elbow, ELBOW_R[layout], spec.slot[0] === 'T', spec.run)
    return true
  }
  return <Pen points={pts} color={color} width={width} update={write} progress={progress} opacity={opacity} dim={dim} renderOrder={36} />
}

/**
 * The tag leaders (S1 to S4): a thin pen line from the thing named to its
 * callout, drawn just before the callout lands (L2: annotation), resting
 * dimmed at full alpha so it never beads. The floor leaders start at a
 * vertex the floor ring touches and are drawn in the claim's own colour, so
 * they never read as an eleventh spoke.
 */
function TagLeaders({ layout }: { layout: Layout }) {
  const w = PEN.grid + 0.25
  const rest = () => 0.75
  return (
    <>
      <TagLeader layout={layout} k="trained" color={PAL.trained} width={w} progress={(T) => at(T, S.classes, 0.3, 0.4, ease.draw)} opacity={(T) => 1 - at(T, S.both, 0, 0.12)} dim={rest} />
      <TagLeader layout={layout} k="practiced" color={PAL.practiced} width={w} progress={(T) => at(T, S.classes, 0.8, 0.9, ease.draw)} opacity={(T) => 1 - at(T, S.both, 0, 0.12)} dim={rest} />
      <TagLeader layout={layout} k="both" color={PAL.both} width={w} progress={(T) => at(T, S.both, 0.58, 0.68, ease.draw)} opacity={(T) => (T >= S.both ? 1 - at(T, S.gen, 0, 0.15) : 0)} dim={rest} />
      <TagLeader
        layout={layout}
        k="weakG"
        color={PAL.yellowGreen}
        width={w}
        progress={(T) => at(T, S.gen, 0.84, 0.92, ease.draw)}
        opacity={(T) => (T >= S.gen ? weakGOut(T) : 0)}
        dim={() => 0.8}
      />
      <TagLeader
        layout={layout}
        k="weakP"
        color={PAL.chalk}
        width={w}
        progress={(T) => at(T, S.spec, 0.86, 0.93, ease.draw)}
        opacity={(T) => (T >= S.spec ? specOut(T) : 0)}
        dim={() => 0.8}
      />
    </>
  )
}

/* ------------------------------- labels -------------------------------- */

/** the skill-name label ids, built once (the colour pass runs every frame) */
const NAME_IDS: string[] = SKILLS.map((_, i) => `sk-n-${i}`)

function useStoryLabels(layout: Layout) {
  const wide = useWideNames()
  const specs = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = []
    const P_ = layout === 'P'
    // the ten skill names (S0 to S4), chalk; the dot takes the class colour in
    // S1 / S2, and at the S4 claim every name but Endurance steps back
    SKILLS.forEach((s, i) => {
      out.push({
        id: NAME_IDS[i],
        text: s.name,
        tone: 'name',
        color: 'rgba(0, 0, 0, 0)',
        anchor: [LABEL_R * dirX(i), LABEL_R * dirY(i), 0],
        prefer: P_ && SIDE[i] ? SIDE[i].P : 'radial',
        center: [0, 0, 0],
        // the four side names go outward, or to the tangent side away from
        // the horizontal (never inward, over the wheel)
        only: SIDE[i]?.only,
        gapPx: 4,
        priority: 70,
        required: true,
        cue: (T) => nameIn(T, i) * nameEmph(T, i) * (i === P_WEAK ? 1 : 1 - 0.45 * catchK(T)) * (1 - at(T, S.grid, 0, 0.1)),
      })
    })
    // the scale: the rim is a rating of 10 (MAX_VALUE), so 7 and 2 read out of 10
    out.push({
      id: 'sk-scale',
      text: String(MAX_VALUE),
      tone: 'tick',
      anchor: [0, R, 0.02],
      prefer: 'W',
      only: ['W', 'NW'],
      gapPx: 6,
      priority: 75,
      cue: (T) => at(T, S.ten, 0.18, 0.26) * (1 - at(T, S.grid, 0, 0.1)),
    })
    // S1, S2: each family named on a tag in the free space, joined to its
    // arc by a pen-drawn leader (TagLeaders)
    const tagAnchor = (k: TagKey) => {
      const buf: [number, number, number] = [0, 0, 0]
      return () => tagWorld(layout, k, buf)
    }
    const tagSides: LabelSpec['only'] = ['C', 'N', 'S']
    out.push(
      {
        id: 'sk-c-trained',
        text: CLASS_LABEL.trained,
        tone: 'callout',
        color: PAL.trained,
        anchor: tagAnchor('trained'),
        prefer: 'C',
        only: tagSides,
        priority: 90,
        cue: (T) => at(T, S.classes, 0.38, 0.46) * (1 - at(T, S.both, 0, 0.12)),
      },
      {
        id: 'sk-c-practiced',
        text: CLASS_LABEL.practiced,
        tone: 'callout',
        color: PAL.practiced,
        anchor: tagAnchor('practiced'),
        prefer: 'C',
        only: tagSides,
        priority: 90,
        cue: (T) => at(T, S.classes, 0.88, 0.96) * (1 - at(T, S.both, 0, 0.12)),
      },
      {
        id: 'sk-c-both',
        text: CLASS_LABEL.both,
        tone: 'callout',
        color: PAL.both,
        anchor: tagAnchor('both'),
        prefer: 'C',
        only: tagSides,
        priority: 90,
        cue: (T) => at(T, S.both, 0.64, 0.72) * (1 - at(T, S.gen, 0, 0.15)),
      },
    )
    // S2 to S3: the class key, pinned top-left. In S3 it recedes with the class
    // layer (landscape); a portrait phone has no room for a four-chip stack
    // over the wheel's top names, so there it yields to the athlete key
    const keyCue = (T: number) => at(T, S.both, 0.62, 0.74) * (1 - (P_ ? 1 : 0.6) * genDim(T)) * (1 - at(T, S.spec, 0, 0.15))
    ;(['trained', 'practiced', 'both'] as const).forEach((c, k) => {
      out.push({ id: `sk-lg-${c}`, text: CLASS_LABEL[c], tone: 'legend', color: CLASS_COLOR[c], anchor: [0, 0, 0], pin: 'top-left', pinOrder: k, cue: keyCue })
    })
    // S3: the balanced shape and its floor
    out.push({
      id: 'sk-lg-gen',
      text: GENERALIST.name,
      tone: 'legend',
      color: PAL.yellowGreen,
      anchor: [0, 0, 0],
      pin: 'top-left',
      pinOrder: 3,
      cue: (T) => at(T, S.gen, 0.2, 0.32) * (1 - at(T, S.spec, 0, 0.15)),
    })
    out.push({
      id: 'sk-w-g',
      text: TAG_TEXT.weakG,
      tone: 'callout',
      color: PAL.yellowGreen,
      anchor: tagAnchor('weakG'),
      prefer: 'C',
      only: tagSides,
      priority: 92,
      // lands as its leader reaches it; leaves as the generalist steps back
      cue: (T) => at(T, S.gen, 0.9, 0.96) * weakGOut(T),
    })
    // S4: the comparison key and the collapsed floor
    out.push(
      { id: 'sk-lg-g2', text: 'Generalist', tone: 'legend', color: PAL.yellowGreen, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 4, cue: (T) => at(T, S.spec, 0.22, 0.34) * specOut(T) },
      { id: 'sk-lg-pl', text: 'Powerlifter', tone: 'legend', color: PAL.chalk, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 5, cue: (T) => at(T, S.spec, 0.26, 0.38) * specOut(T) },
      {
        id: 'sk-w-p',
        text: TAG_TEXT.weakP,
        tone: 'callout',
        color: PAL.chalk,
        anchor: tagAnchor('weakP'),
        prefer: 'C',
        only: tagSides,
        priority: 92,
        cue: (T) => at(T, S.spec, 0.91, 0.97) * specOut(T),
      },
    )
    // S5: the thirteen, named inside their plates (a phone uses the short names)
    const gr = grid(layout)
    RANKED.forEach((r, k) => {
      const [nx, ny] = gr.nameAt(k)
      out.push({
        id: `sk-g-${k}`,
        text: wide ? r.name : r.short,
        short: r.short,
        tone: 'name',
        color: r.isG ? PAL.yellowGreen : PAL.chalk,
        dot: false,
        badge: String(r.floor),
        anchor: [nx, ny, 0],
        prefer: 'N',
        only: ['N'],
        gapPx: 3,
        priority: 80,
        required: true,
        cue: (T) => Math.max(0, Math.min(1, (cellGrow(T, k) - 0.55) * 2.5)),
      })
    })
    out.push({ id: 'sk-lg-sort', text: 'SORTED BY WEAKEST SKILL', tone: 'legend', color: PAL.yellowGreen, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 6, dot: false, cue: (T) => at(T, S.grid, 0.8, 0.92) })
    return out
  }, [layout, wide])
  useLabels(specs)

  // the skill-name dots take their class colour as the arcs pass (S1, S2),
  // rest dimmed with the class layer (S3), and leave with the class colours
  // at S4 (the comparison is chalk and green), where Endurance's dot comes
  // back in chalk as the floor catches on it
  useSafeFrame('skills name colours', (T) => {
    const c = catchK(T)
    for (let i = 0; i < N; i++) {
      if (i === P_WEAK && c > 0) setLabelColor(NAME_IDS[i], rgba(PAL.chalk, c))
      else setLabelColor(NAME_IDS[i], rgba(SKILL_COLORS[i], classK(T, i) * arcOut(T) * (1 - 0.55 * genDim(T))))
    }
  })
}

/** Labels never cover the data: both profiles' vertices and edge midpoints. */
function useDataObstacles(gen: { r: Float32Array }, pl: { r: Float32Array }) {
  const spec = useMemo<WorldObstacle>(
    () => ({
      maxPoints: 4 * N,
      radiusPx: 6,
      points: (T, out) => {
        let n = 0
        const put = (src: Float32Array, z: number) => {
          for (let i = 0; i < N; i++) {
            const j = (i + 1) % N
            out[n * 3] = px(i, src[i])
            out[n * 3 + 1] = py(i, src[i])
            out[n * 3 + 2] = z
            n++
            out[n * 3] = (px(i, src[i]) + px(j, src[j])) / 2
            out[n * 3 + 1] = (py(i, src[i]) + py(j, src[j])) / 2
            out[n * 3 + 2] = z
            n++
          }
        }
        if (T >= S.gen + 0.2 && T < S.grid) put(gen.r, genDepth(T))
        if (T >= S.spec + 0.4 && T < S.grid) put(pl.r, 0)
        return n
      },
    }),
    [gen, pl],
  )
  useWorldObstacle('sk-data', spec)
}

/* -------------------------------- scene -------------------------------- */

function StoryScene({ tier }: { tier: Tier }) {
  const { layout } = useBeat()
  const camera = useThree((st) => st.camera)
  useEffect(() => {
    tagCam.cam = camera
  }, [camera])
  const low = tier === 'low'
  const flip = useRef<THREE.Group>(null)
  const gen = useMemo(() => newProfile(), [])
  const pl = useMemo(() => newProfile(), [])
  const gr = grid(layout)
  const cell0 = gr.center(0)

  // one pass per frame fills the shared profile sources and the FLIP (priority
  // -2: before every element that reads them)
  useSafeFrame(
    'skills story state',
    (T) => {
      let mg = false
      let mp = false
      for (let i = 0; i < N; i++) {
        if (setRadius(gen, i, G[i] * growV(T, i))) mg = true
        if (setRadius(pl, i, T >= S.spec ? P[i] : 0)) mp = true
      }
      if (mg) gen.v++
      if (mp) pl.v++
      const g = flip.current
      if (g) {
        const k = flipK(T)
        const s = 1 + (MINI_R / R - 1) * k
        g.scale.set(s, s, s)
        g.position.set(cell0[0] * k, cell0[1] * k, 0)
      }
    },
    { priority: -2, hide: flip },
  )

  useStoryLabels(layout)
  useDataObstacles(gen, pl)

  const constructionVis = useMemo<ConstructionVis>(
    () => ({
      rings: ringSweep,
      ringOpacity: (T) => 0.2 * focus(T, S.ten) * constructionOut(T),
      spoke: spokeDraw,
      spokeOpacity: (T) => 0.55 * focus(T, S.ten) * (1 - 0.45 * at(T, S.classes, 0.03, 0.12) + 0.3 * at(T, S.spec, 0, 0.3)) * constructionOut(T),
      tickOpacity: (T) => 0.34 * focus(T, S.ten) * constructionOut(T),
      classK,
      classOpacity: (T) => (1 - 0.75 * genDim(T)) * arcOut(T) * constructionOut(T),
      heads: true,
      key: (T) => T,
      colors: SKILL_COLORS,
    }),
    [],
  )

  const genVis = useMemo<SolidVis>(
    () => ({
      fill: (T) => at(T, S.gen, 0.1, 0.3) * (1 - 0.85 * ghostK(T)) * mainOut(T),
      walls: (T) => at(T, S.gen, 0.2, 0.5) * (1 - ghostK(T)) * mainOut(T),
      outline: (T) => at(T, S.gen, 0.1, 0.14) * mainOut(T),
      ghost: ghostK,
      ghostDim: 0.42,
      // each node grows out with its own vertex (no clump at the centre)
      nodes: (T) => at(T, S.gen, 0.1, 0.2) * (1 - ghostK(T)) * mainOut(T) * (1 - at(T, S.grid, 0, 0.15)),
      nodeK: (T, i) => Math.min(1, growV(T, i) * 1.6),
      depth: genDepth,
      // the growing shape speaks (its rim blooms), then settles under 1 as the floor ring is drawn
      rim: (T) => 2.2 * at(T, S.gen, 0.12, 0.4) * (1 - 0.72 * at(T, S.gen, 0.55, 0.75)) * (1 - ghostK(T)),
    }),
    [],
  )

  // the Powerlifter: a dashed chalk outline drawn from Strength, clockwise
  const plPts = useMemo(() => {
    const a = new Float32Array((N + 1) * 3)
    for (let k = 0; k <= N; k++) {
      const i = k % N
      a[k * 3] = px(i, P[i])
      a[k * 3 + 1] = py(i, P[i])
      a[k * 3 + 2] = 0.05
    }
    return a
  }, [])

  const plates = useMemo<PlateSpec[]>(
    () =>
      RANKED.map((r, k) => ({
        rect: gr.plate(k),
        fill: r.isG ? PAL.yellowGreen : PAL.chalk,
        fillAlpha: r.isG ? 0.022 : 0.01,
        line: r.isG ? PAL.yellowGreen : PAL.chalk,
        lineAlpha: r.isG ? 0.36 : 0.05,
      })),
    [gr],
  )

  const minisVis = useMemo<MinisVis>(
    () => ({
      place: (_T, k, out) => {
        const [cx, cy] = gr.center(k)
        out[0] = cx
        out[1] = cy
        return cellGrow(_T, k)
      },
      ring: cellRing,
      opacity: gridOn,
      key: (T) => T + (layout === 'P' ? 0 : 100),
    }),
    [gr, layout],
  )

  return (
    <>
      <group ref={flip}>
        <Construction vis={constructionVis} />
        <ClassArcs />
        <TagLeaders layout={layout} />
        <ProfileSolid src={gen} color={PAL.yellowGreen} nodeColors={SKILL_COLORS} nodeRadius={layout === 'P' ? 0.4 : 0.27} vis={genVis} low={low} cap={GEN_CAP} />
        {/* S3 claim: the generalist's floor ring at its weakest skill (hot pen),
            on an ink keyline so its edge stays crisp over the lime cap (L10) */}
        <FloorRing
          radius={() => G_FLOOR}
          z={0.03}
          lift={genDepth}
          color={PAL.yellowGreen}
          progress={ringDraw}
          opacity={(T) => at(T, S.gen, RING_A, RING_A + 0.02) * specOut(T)}
          dim={(T) => 1 - 0.55 * ghostK(T)}
          gain={(T) => 1.35 * (1 - 0.3 * ghostK(T))}
          keyline
          keylineK={(T) => 1 - ghostK(T)}
          head
          hot
        />
        {/* ... and every vertex it touches lights as the ring's pen passes it: the floor is a tie of three */}
        {G_TIES.map((i) => (
          <Ripple
            key={i}
            position={[px(i, G_FLOOR), py(i, G_FLOOR), DEPTH + 0.06]}
            color={LIGHT}
            sizePx={46}
            k={(T) => cue(T, touchT(i), touchT(i) + 0.12)}
          />
        ))}
        <Glows
          count={G_TIES.length}
          sizePx={24}
          colors={[LIGHT]}
          gain={1}
          place={(T, j, out) => {
            const i = G_TIES[j]
            out[0] = px(i, G_FLOOR)
            out[1] = py(i, G_FLOOR)
            out[2] = genDepth(T) + 0.06
            return 0.8 * cue(T, touchT(i) - 0.01, touchT(i) + 0.02) * (1 - at(T, S.spec, 0, 0.25))
          }}
        />
        {/* S4: the gaps, hatched in the colour of loss where the Powerlifter falls
            inside the generalist (the language of Definition's AREA LOST) */}
        <Hatch inner={pl} outer={gen} color={PAL.sick} alpha={0.3} opacity={(T) => at(T, S.spec, 0.45, 0.5) * specOut(T)} reveal={(T) => at(T, S.spec, 0.45, 0.65)} />
        <Pen
          points={plPts}
          color={PAL.chalk}
          width={3.5}
          dashed
          dashSize={0.5}
          gapSize={0.3}
          head
          hot
          progress={(T) => at(T, S.spec, 0.15, 0.5, ease.draw)}
          opacity={specOut}
          // it steps back a little as the floor lands, so the claim is the brightest line (L3)
          dim={(T) => 1 - 0.18 * catchK(T)}
          renderOrder={38}
        />
        {/* S4 claim (signature): the floor collapses from 7 to 2 and catches on
            Endurance; it rests as the brightest line on screen */}
        <FloorRing
          radius={(T) => G_FLOOR + (P_FLOOR - G_FLOOR) * collapse(T)}
          z={0.08}
          color={PAL.chalk}
          width={4}
          dash={0.36}
          opacity={(T) => at(T, S.spec, 0.62, 0.66) * specOut(T)}
          gain={(T) => 1.15 + 1.5 * pulse(T, S.spec + 0.64, S.spec + 0.92)}
          keyline
        />
        <Nodes
          count={1}
          radius={layout === 'P' ? 0.42 : 0.28}
          color={PAL.chalk}
          rimStrength={0.6}
          emissiveIntensity={0.6}
          opacity={specOut}
          place={(T, _i, out) => {
            out[0] = px(P_WEAK, P_FLOOR)
            out[1] = py(P_WEAK, P_FLOOR)
            out[2] = 0.1
            return at(T, S.spec, 0.84, 0.9, ease.snap)
          }}
        />
        {/* the catch: one ring of light where the floor lands, then a faint lit point that stays */}
        <Ripple position={[px(P_WEAK, P_FLOOR), py(P_WEAK, P_FLOOR), 0.12]} color={LIGHT} sizePx={84} k={(T) => at(T, S.spec, 0.85, 0.97)} />
        <Glows
          count={1}
          sizePx={34}
          colors={[LIGHT]}
          gain={1}
          place={(_T, _i, out) => {
            out[0] = px(P_WEAK, P_FLOOR)
            out[1] = py(P_WEAK, P_FLOOR)
            out[2] = 0.12
            return 0.7 * catchK(_T) * specOut(_T)
          }}
        />
        <Heads
          count={1}
          tint={PAL.chalk}
          place={(T, _i, out) => {
            out[0] = px(P_WEAK, P_FLOOR)
            out[1] = py(P_WEAK, P_FLOOR)
            out[2] = 0.12
            return pulse(T, S.spec + 0.8, S.spec + 0.94)
          }}
        />
      </group>
      <Plates plates={plates} radius={0.35} z={-0.08} vis={(T, k) => cellGrow(T, k)} opacity={gridOn} renderOrder={4} />
      <Minis cells={G_CELLS} vis={minisVis} low={low} />
    </>
  )
}

export default function SkillsScene() {
  const mode = useStoryStore((s) => s.mode)
  const tier = useStoryStore((s) => s.tier)
  // Both layers stay mounted (prewarm); the mode only toggles visibility.
  return (
    <>
      <group visible={mode === 'story'}>
        <StoryScene tier={tier} />
      </group>
      <group visible={mode === 'explore'}>
        <ExploreScene tier={tier} />
      </group>
    </>
  )
}
