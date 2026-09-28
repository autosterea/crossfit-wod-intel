import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { HOPPER_DOMAINS, MODAL_DOMAINS, PAL } from '../../fitnessData'
import { at, focus, stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { useStoryStore } from '../../story/store'
import { focusRect } from '../../story/camera/focusRect'
import { useChartFrame, type ChartFrame } from '../../story/kit/chartFrame'
import { Ripple } from '../../story/kit/Ripple'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import { impactK } from '../../story/kit/impact'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { registry } from '../../story/labels/registry'
import { clock, onFrame } from '../../story/clock'
import { useQAProbe } from '../../story/qa'
import { useSafeFrame } from '../../story/useSafeFrame'
import type { Dir, LabelSpec } from '../../story/types'
import { Drum } from './Drum'
import { Ticket } from './Ticket'
import { BrickLights, Bricks, GeneralistFlare, LeadBracket, Rails, SWELL, TICK_TOP, Ticks, bracketEnds, railY, tickAt, tipOf, useBrickMaterials } from './Board'
import { Threads } from './Threads'
import ExploreLayer, { compactNow, exChart, exRails } from './ExploreScene'
import { BD, BH, boardPx, CHART_OPTS, CHART_Z, READOUT_ROOM, WORLD, chartCenterY, leadV, leadVc, slotY, ticketAt, useHopKey, type HopKey, type TicketXf, type World } from './layout'
import { B, H4_CROSS, H4_SORT, H6, STORY_SCHED, barsDim, boardAt, boardIn, destLeader, othersBack, spinBoost, toChart, win, type Board } from './timeline'
import { GEN, NAMES, N_ATH, STORY, STORY_DRAWS, EXPLORE_CAP } from './hopperMath'
import { ex, isExplore, srcAt, useHopExplore } from './exploreStore'

/* =========================================================================
   02 THE HOPPER, "The Tally" (DESIGN.md D.3). Every property is a pure
   function of story time T (the tumble runs on the ambient clock A, which
   freezes at T x 2.5 when held, and always under reduced motion):
     H0 the pen draws three hoops that turn to steel, the bars grow, 25 task
        balls pour in as a column and tumble; the domain legend lands;
     H1 a ball rolls out of the drum into the ticket's notch, the ticket
        flips to DRAW 1 - WEIGHTLIFTING / 1RM BACK SQUAT, the pen traces it;
     H2 the drum and the ticket step aside (phones) as six rails draw on;
        six orange bricks fly to them and stretch to the draw-1 points; the
        totals count; the rails sort, the new P1 first, each rising rail
        lifted in front and keeping its name and total, and each rank badge
        lands as its rail arrives (L2); LEAD lands;
     H3 draws 2, 3 and 4: each draw's top scorer gets a tick (draw 1's
        first), LEAD passes to the Strongman;
     H4 the unknown: every brick lands, the Generalist's last, and its tick
        says it won the draw; its rail climbs to P1, lifted clear in front of
        the Strongman's, its name and total riding with it; NEW LEADER lands
        as the rails cross and the impact lands on arrival;
     H5 35 more draws rain in, the drum spinning twice as fast; every rail
        becomes a stacked bar of domain bands; the Generalist stays P1;
     H6 the lead becomes the chart: the four rails behind fade, a bracket
        measures the P1 bar past the P2 bar and LEAD moves onto it; the
        chart draws in around the two dimmed bars as the bracket swings
        upright into it, carrying LEAD, as the lead at draw 40; this run's
        line draws up to it, then 64 other hoppers.

   Prewarm (README): the drum, ticket (every face), all brick sets, the
   chart and the explore layer are all mounted at load and shown by T and
   mode, so no shader links mid-story.
   ========================================================================= */

const LIGHT = '#e9ffc4'
/** a scratch anchor point a label's anchor function writes into and returns */
type Pt = [number, number, number]

/* ------------------------------ timing ------------------------------ */

/** the story's final P1 and P2 (H6 compares their bars) */
const P1 = STORY.leader[STORY_DRAWS]
const P2 = (() => {
  for (let a = 0; a < N_ATH; a++) if (STORY.rank[STORY_DRAWS * N_ATH + a] === 1) return a
  return 0
})()
/** H6: the rails that step back (everything but P1 and P2) */
const behind = (a: number) => a !== P1 && a !== P2
const FRONT = [P1, P2] as const
const BACK = Array.from({ length: N_ATH }, (_, a) => a).filter(behind)

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

const drumDim = (T: number) => (isExplore() ? 1 : focus(T, B.hopper))
const hoops = (T: number) => (isExplore() ? 1 : at(T, B.hopper, 0, 0.3, ease.draw))
const steel = (T: number) => (isExplore() ? 1 : at(T, B.hopper, 0.2, 0.4))
const full = () => (isExplore() ? 1 : 0)
const pour = (T: number) => (isExplore() ? 1 : at(T, B.hopper, 0.33, 0.8))
/** the ambient clock of the tumble: frozen under reduced motion, story and explore alike (C.13) */
const ambient = (T: number, A: number) => {
  const st = useStoryStore.getState()
  if (st.reduced) return T * 2.5
  return A + (st.mode === 'explore' ? 0 : spinBoost(T))
}
/** P: the drum and the ticket step aside for the board (0 the H1 stack, 1 the board) */
const board = (T: number) => (isExplore() ? 1 : boardIn(T))
const ticketVis = (T: number) => {
  if (isExplore()) return exRails() * (1 - compactNow())
  const pull = T >= B.score && T < B.specialists ? focus(T, B.draw) : 1
  return pull * (1 - othersBack(T)) * (1 - compactNow() * boardIn(T))
}
const trace = (T: number) => (isExplore() ? 1 : at(T, B.draw, 0.7, 0.95, ease.draw))
const traceOut = (T: number) => (isExplore() || T < B.draw ? 0 : 1 - at(T, B.draw, 0.95, 1))
/** rail slot k's draw-on; in H6 the four slots behind P1 and P2 retract into their start */
const railDraw = (T: number, k: number) => {
  if (isExplore()) return 1
  const p = stagger(T, B.score, B.score + 0.3, k, 6, 0.27, ease.draw)
  return k >= 2 ? p * (1 - othersBack(T)) : p
}
const railDim = (T: number) => (isExplore() ? 1 : focus(T, B.score))
const railOn = (T: number) => (isExplore() ? exRails() : T >= B.score ? (1 - 0.5 * barsDim(T)) * (1 - toChart(T)) : 0)
/** H6: the P1 and P2 bars dim as the chart draws in around them, then fade */
const frontBricks = (T: number) => (isExplore() ? 0 : (1 - 0.55 * barsDim(T)) * (1 - toChart(T)))
/** H6: the four bars behind fade back (their own set, so nothing flattens) */
const backBricks = (T: number) => (isExplore() ? 0 : 1 - othersBack(T))
// (fully behind the chart they are skipped: no work, no triangles)
const exploreBricks = () => (isExplore() ? exRails() : 0)
const ticksOn = (T: number) => (isExplore() ? 0 : 1 - at(T, B.many, 0, 0.08))
/** the Generalist's bar edge lights as it climbs (H4), then flares as it lands in P1 (the impact accent) */
const flare = (T: number) => {
  if (isExplore()) return 0
  const climb = T > B.unknown && T < B.many ? Math.sin(Math.PI * win(T, B.unknown + H4_SORT[0], B.unknown + H4_SORT[1])) : 0
  return Math.max(impactK(T), 0.5 * climb)
}
/** H6 */
const chartOn = (T: number) => (isExplore() ? exChart() : at(T, B.every, H6.construct[0], H6.construct[0] + 0.06))
const construct = (T: number) => (isExplore() ? 1 : at(T, B.every, H6.construct[0], H6.construct[1], ease.draw))
const bundle = (T: number) => (isExplore() ? 1 : at(T, B.every, H6.bundle[0], H6.bundle[1], ease.draw))
const mineProgress = (T: number) => (isExplore() ? 1 : at(T, B.every, H6.mine[0], H6.mine[1], ease.draw))
/** the chart's words land with its construction, so the threads are read as they draw */
const chartWords = (T: number) => (isExplore() ? exChart() : at(T, B.every, H6.words[0], H6.words[1]))
/** the claim: THIS RUN and the pinned legend */
const chartClaim = (T: number) => (isExplore() ? exChart() : at(T, B.every, H6.claim[0], H6.claim[1]))
/** the board's labels (in explore: the rails view) */
const boardLabels = (T: number) => (isExplore() ? exRails() : 1 - toChart(T))
/** H6: the labels of the rails that step back */
const behindLabels = (T: number, a: number) => (isExplore() || !behind(a) ? 1 : 1 - othersBack(T))
/** H6: the P1 and P2 names give the bracket and LEAD room; their totals stay until the bracket lifts off */
const namesH6 = (T: number) => (isExplore() ? 1 : 1 - at(T, B.every, 0.04, 0.12))
const totalsH6 = (T: number) => (isExplore() ? 1 : 1 - at(T, B.every, 0.22, 0.28))
const bracketDraw = (T: number) => (isExplore() ? 0 : at(T, B.every, H6.bracket[0], H6.bracket[1], ease.draw))
const bracketSwing = (T: number) => (isExplore() ? 0 : at(T, B.every, H6.swing[0], H6.swing[1], ease.morph))
/** the bracket stands at draw 40 as the lead until THIS RUN takes over */
const bracketOn = (T: number) => (isExplore() || T < B.every ? 0 : 1 - at(T, B.every, H6.claim[0], H6.claim[0] + 0.06))
const guideOn = (T: number) => 1 - at(T, B.every, H6.swing[0] - 0.02, H6.swing[0] + 0.06)
/**
 * The domain legend's visibility (the pinned chips, or the Q world's DOM key):
 * it lands at the end of H0 and steps aside for the H6 chart. Explore: gone at
 * once for Every run (the chart's own legend takes the corner), and while the
 * phone's sheet is expanded (the compact board).
 */
export const legendCue = (T: number) =>
  isExplore()
    ? useHopExplore.getState().view === 'runs'
      ? 0
      : exRails() * (1 - compactNow())
    : at(T, B.hopper, 0.74, 0.9) * (1 - at(T, B.every, H6.dimBars[0], H6.dimBars[1] + 0.02)) * (1 - compactNow())

/** a short phone rect (the sheet or the caption expanded): on the board only the Generalist keeps its name */
const compactName = (T: number, a: number) => (a !== GEN ? 1 - compactNow() * board(T) : 1)

/** draws counted on the explore board (its thread ends there) */
function exploreCounted(): number {
  const s = ex.sched
  let n = 0
  while (n < s.n && s.cnt1[n * N_ATH + N_ATH - 1] <= ex.X) n++
  return n
}

/* ------------------------------ passes ------------------------------ */

/** Measure boardPx (layout.ts): the pass hand-off works in px, so it is right on a 360 phone and a 1440 desktop alike. */
function useBoardPx(w: World) {
  const camera = useThree((s) => s.camera)
  const v = useMemo(() => new THREE.Vector3(), [])
  useSafeFrame(
    'hopper board px',
    () => {
      const x = w.rails.x0 + w.rails.len
      v.set(x, slotY(w, 0), 0).project(camera)
      const y0 = v.y
      v.set(x, slotY(w, 1), 0).project(camera)
      boardPx.unit = (Math.abs(y0 - v.y) * 0.5 * focusRect.H) / w.rails.pitch
    },
    { priority: -85 },
  )
}

/**
 * How far athlete a's name and total step off (0..1) while a rail headed
 * above it passes: the rising rail keeps its words, the rail it passes
 * yields them only while the two are close enough to collide (a name sits
 * over its bar's end, a total rides the bar's end: they meet when the two
 * bars are nearer than a name and half a total). At rest nothing yields.
 */
function crowdOf(b: Board, w: World, a: number): number {
  const unit = boardPx.unit
  if (!(unit > 0)) return 0
  const pitch = w.rails.pitch * unit
  const off = Math.min((BH / 2) * unit + 30, 0.72 * pitch)
  const on = Math.max(off + 1, Math.min(pitch - 0.5, off + 8))
  let f = 0
  for (let c = 0; c < N_ATH; c++) {
    if (c === a || !(b.dest[c] < b.dest[a])) continue
    const d = Math.abs(b.rankPos[a] - b.rankPos[c])
    if (d >= 0.999) continue
    const v = 1 - smooth((d * pitch - off) / (on - off))
    if (v > f) f = v
  }
  return f
}

/**
 * A name's gap over its bar: 5 px, lifted just enough to clear a top-scorer
 * tick under it (H3, H4). A tick slides left to clear its athlete's name
 * (tickAt), but on a short landscape or 360 phone a long name can reach over
 * every brick the tick could stand on; the name then steps up as the tick
 * grows, and back down as the ticks fade (H5).
 */
const NAME_IDS = Array.from({ length: N_ATH }, (_, a) => 'hop-n-' + a)
/** px from a total pill's centre to its edge (the small readout pill is about 20 px tall) */
const PILL_HALF = 11
function nameGap(w: World, a: number): number {
  const T = clock.T
  if (isExplore() || T < B.specialists || T >= B.many + 0.08 || !(boardPx.unit > 0)) return 5
  const e = registry.get(NAME_IDS[a])
  if (!e || !(e.w > 0)) return 5
  const s = STORY_SCHED
  const b = boardAt(s, T, w.rails.len)
  const left = w.rails.x0 + w.rails.len - (3.6 + e.w) / boardPx.unit
  let g = 0
  for (let d = 0; d < 5; d++) {
    if (!(s.tick0[d] <= T) || s.run.top[d] !== a) continue
    tickAt(w, s, b, d, TK)
    if (TK[0] + 0.2 > left) g = Math.max(g, win(T, s.tick0[d], s.tick1[d]))
  }
  if (g <= 0) return 5
  // (a name's glyphs sit a couple of px over its box: the box may just meet the tick's top)
  // Never lifted into the total riding the bar above (fix round 1: on a short
  // portrait board the pitch is about 37 px, and a lifted name met that pill
  // and was culled); the name then overlaps the tick's top, over its halo.
  const room = w.rails.pitch * boardPx.unit - PILL_HALF - (BH / 2) * (1 + SWELL) * boardPx.unit - e.h - 2
  const lifted = Math.max(5, Math.min((TICK_TOP * boardPx.unit - 1.5) / 0.72, room))
  return 5 + (lifted - 5) * g * ticksOn(T)
}

/* ------------------------------ labels ------------------------------ */

/**
 * The six counted totals, written into their readout labels only when a
 * rounded value changes (no string per frame).
 *
 * WORKAROUND, remove with the engine fix (engine request): a label node
 * that mounts after setLabelText ran renders its registered text but never
 * receives the update, which left a held deep link showing "0". So for a
 * few frames after each total's node mounts, its DOM text is re-asserted.
 * This reads the label registry's `txt` and `text` fields; if integration
 * changes that shape, it degrades to a no-op.
 */
const TOTAL_IDS = Array.from({ length: N_ATH }, (_, a) => 'hop-t-' + a)
function useTotals(w: World) {
  useEffect(() => {
    const shown = new Float64Array(N_ATH).fill(NaN)
    const nodes: (HTMLElement | null)[] = new Array(N_ATH).fill(null)
    const verify = new Uint8Array(N_ATH)
    return onFrame(() => {
      const src = srcAt(clock.T)
      const b = boardAt(src.s, src.X, w.rails.len)
      for (let a = 0; a < N_ATH; a++) {
        const v = Math.round(b.totals[a])
        const e = registry.get(TOTAL_IDS[a]) as { txt?: HTMLElement | null; text?: string; short?: boolean } | undefined
        const node = e?.txt ?? null
        if (node !== nodes[a]) {
          nodes[a] = node
          verify[a] = 4
          shown[a] = NaN
        }
        if (v !== shown[a]) {
          shown[a] = v
          setLabelText(TOTAL_IDS[a], String(v))
        }
        if (verify[a] > 0 && node && e && typeof e.text === 'string' && !e.short) {
          verify[a]--
          if (node.textContent !== e.text) node.textContent = e.text
        }
      }
    })
  }, [w])
}

const LEAD_ONLY: readonly Dir[] = ['N', 'NE', 'NW', 'S', 'SW', 'SE', 'W']
const _e5 = new Float64Array(5)
const TK = new Float64Array(3)

/** The board's labels: the legend, rank badges, names, totals, LEAD and NEW LEADER. */
function useBoardLabels(w: World, fr: { current: ChartFrame }) {
  const specs = useMemo<LabelSpec[]>(() => {
    const x0 = w.rails.x0
    const len = w.rails.len
    /** the board at T (cached per time by boardAt; no allocation) */
    const board = (T: number) => {
      const s = srcAt(T)
      return boardAt(s.s, s.X, len)
    }
    /** the rising rail places first: its words never yield to the rail it passes */
    const passRank = (a: number) => 97 + 0.3 * (N_ATH - board(clock.T).dest[a])
    const out: LabelSpec[] = []
    // the domain legend: what each ball and brick colour means (pinned top-left;
    // a column beside the board on L and S, a band over it on P). The names
    // are the MODAL_DOMAINS set chapter 04 keys the same five colours with
    // (fix round 1: one domain label set across the lesson; the ticket keeps
    // the drawn domain's full HOPPER_DOMAINS label). Q (a short portrait
    // rect) shows the same key as a two-row DOM panel over the caption card
    // (Hud.tsx) instead, so the pinned chips stand down there.
    const q = w === WORLD.Q
    HOPPER_DOMAINS.forEach((d, k) => {
      out.push({
        id: `hop-dom-${k}`,
        text: MODAL_DOMAINS[k].name,
        tone: 'legend',
        color: d.color,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: k,
        cue: q ? () => 0 : legendCue,
      })
    })
    // rank badges: fixed to the slots, each landing as its rail arrives in
    // the first sort (L2: a rank is annotation; before the first score the
    // roster order is no ranking)
    for (let k = 0; k < 6; k++) {
      out.push({
        id: `hop-p${k + 1}`,
        text: `P${k + 1}`,
        tone: 'name',
        color: PAL.chalk,
        dot: false,
        anchor: [x0, slotY(w, k), 0],
        prefer: 'W',
        only: ['W'],
        gapPx: 7,
        priority: 82,
        cue: (T) => {
          if (isExplore()) return boardLabels(T)
          const on = at(T, B.score, 0.8 + 0.018 * k, 0.85 + 0.018 * k)
          // H6: the slots that step back take their badges with them
          const back = k >= 2 ? 1 - othersBack(T) : 1
          return on * back * boardLabels(T)
        },
      })
    }
    // athlete names above each rail's far end; the Generalist is marked in #91C640
    for (let a = 0; a < N_ATH; a++) {
      const g = a === GEN
      // anchors write into their own scratch point (nothing allocated per frame)
      const vn: Pt = [0, 0, 0]
      const vt: Pt = [0, 0, 0]
      out.push({
        id: `hop-n-${a}`,
        text: NAMES[a],
        tone: 'name',
        color: PAL.yellowGreen,
        dot: g,
        required: true,
        anchor: (T) => {
          const b = board(T)
          vn[0] = x0 + len
          vn[1] = railY(w, b, a) + (BH / 2) * (1 + SWELL * b.pop[a])
          vn[2] = b.lift[a]
          return vn
        },
        prefer: 'NW',
        only: ['NW'],
        get gapPx() {
          return nameGap(w, a)
        },
        get priority() {
          return passRank(a)
        },
        // a rail being passed yields its name while the two cross; the passer keeps it
        cue: (T) => (isExplore() ? 1 : at(T, B.score, 0.12, 0.3) * namesH6(T)) * compactName(T, a) * boardLabels(T) * (1 - crowdOf(board(T), w, a)) * behindLabels(T, a),
      })
      // the total rides the end of the bar (counted into the label by useTotals)
      out.push({
        id: `hop-t-${a}`,
        text: '0',
        tone: 'readout',
        size: 'sm',
        minChars: 4,
        color: g ? PAL.yellowGreen : PAL.chalk,
        required: true,
        anchor: (T) => {
          const s = srcAt(T)
          const b = boardAt(s.s, s.X, len)
          vt[0] = x0 + tipOf(s.s, s.X, b, a)
          vt[1] = railY(w, b, a)
          vt[2] = b.lift[a] + BD / 2
          return vt
        },
        prefer: 'E',
        only: ['E'],
        gapPx: 6,
        get priority() {
          return passRank(a)
        },
        cue: (T) => (isExplore() ? 1 : at(T, B.score, 0.54, 0.6) * totalsH6(T)) * boardLabels(T) * (1 - crowdOf(board(T), w, a)) * behindLabels(T, a),
      })
    }
    // LEAD marks the P1 slot (the rails trade places under it); in H6 it
    // moves onto the bracket that measures the lead and rides it into the chart
    const leadX = x0 + 0.4 * len
    /**
     * LEAD over the P1 slot: at 40% of the rail, or further left when the
     * leader's name (over the rail's end) reaches that far (a short
     * landscape rail); it glides between the two leaders while they swap.
     */
    const leadAt = (a: number) => {
      const e = registry.get(NAME_IDS[a])
      const le = registry.get('hop-lead')
      const u = boardPx.unit
      if (!e || !(e.w > 0) || !(u > 0)) return leadX
      const lw = le && le.w > 0 ? le.w : 44
      return Math.min(leadX, x0 + len - (3.6 + e.w + lw / 2 + 8) / u)
    }
    const vl: Pt = [0, 0, 0]
    const vw: Pt = [0, 0, 0]
    const cy = chartCenterY(w)
    const onBracket = (T: number) => (isExplore() ? 0 : at(T, B.every, 0.04, 0.14, ease.settle))
    out.push({
      id: 'hop-lead',
      text: 'LEAD',
      tone: 'callout',
      color: PAL.yellowGreen,
      required: true,
      anchor: (T) => {
        const b = board(T)
        const nx = leadAt(destLeader(b))
        vl[0] = b.leaderSwap >= 0 ? leadAt(b.leader) + (nx - leadAt(b.leader)) * b.leaderSwap : nx
        vl[1] = slotY(w, 0) + (BH / 2) * (1 + SWELL * b.pop[destLeader(b)])
        vl[2] = b.lift[destLeader(b)]
        const k = onBracket(T)
        if (k > 0) {
          // the bracket's midpoint, on the board, then swinging into the chart
          bracketEnds(w, srcAt, P1, P2, T, _e5)
          const m = bracketSwing(T)
          const f = fr.current
          const bx = (_e5[0] + _e5[1]) / 2
          const by = _e5[2]
          const bz = _e5[4]
          const chx = f.x(1)
          const chy = (f.y(leadV(0)) + f.y(leadV(STORY.lead[STORY_DRAWS]))) / 2 + cy
          const mx = bx + (chx - bx) * m
          const my = by + (chy - by) * m
          const mz = bz + (CHART_Z + 0.03 - bz) * m
          vl[0] += (mx - vl[0]) * k
          vl[1] += (my - vl[1]) * k
          vl[2] += (mz - vl[2]) * k
        }
        return vl
      },
      // over the P1 bar; under the bracket; beside it once it stands upright in the chart
      get prefer(): Dir {
        if (isExplore() || clock.T < B.every + 0.06) return 'N'
        return bracketSwing(clock.T) < 0.5 ? 'S' : 'W'
      },
      only: LEAD_ONLY,
      // clear of the leader's total when its bar is still short (H2)
      gapPx: 5,
      priority: 90,
      cue: (T) => {
        if (isExplore()) return boardLabels(T)
        // H4: LEAD steps off as the Strongman starts to fall; NEW LEADER takes over until H5
        const offH4 = at(T, B.unknown, 0.5, 0.54) - at(T, B.many, 0.02, 0.08)
        return at(T, B.score, 0.9, 0.98) * (1 - offH4) * (1 - at(T, B.every, H6.claim[0], H6.claim[0] + 0.04))
      },
    })
    out.push({
      id: 'hop-new',
      text: 'NEW LEADER',
      tone: 'callout',
      color: PAL.yellowGreen,
      required: true,
      anchor: (T) => {
        const b = board(T)
        vw[0] = leadX
        vw[1] = railY(w, b, GEN) + (BH / 2) * (1 + SWELL * b.pop[GEN])
        vw[2] = b.lift[GEN]
        return vw
      },
      prefer: 'N',
      only: ['N', 'NE', 'NW'],
      gapPx: 3,
      priority: 92,
      // it lands as the Generalist's rail crosses the Strongman's, and rides it into P1
      cue: (T) => (isExplore() ? 0 : at(T, B.unknown, H4_CROSS - 0.01, H4_CROSS + 0.035) * (1 - at(T, B.many, 0, 0.06))),
    })
    return out
  }, [w, fr])
  useLabels(specs, { mode: 'both' })
  return specs
}

/** H6 (and explore's Every run): the chart's own words (the L13 chart-reading note). */
function useChartLabels(w: World, fr: { current: ChartFrame }, key: HopKey) {
  // the chart frame changes with the focus rect (every explore entry and
  // exit, every sheet detent): the anchors read it through a ref, so this
  // label set registers once per world
  const specs = useMemo<LabelSpec[]>(() => {
    const cy = chartCenterY(w)
    const Z = CHART_Z
    /** chart point (u, lead) as an anchor (lead null: the draws axis, dy below it), into its own scratch point */
    const pt = (u: number, lead: number | null, dy = 0) => {
      const v: Pt = [0, 0, Z]
      return () => {
        const f = fr.current
        v[0] = f.x(u)
        v[1] = (lead === null ? f.y(0) : f.y(leadV(lead))) + cy + dy
        return v
      }
    }
    const out: LabelSpec[] = []
    ;['0', '10', '20', '30', '40'].forEach((t, i) => {
      out.push({
        id: `hop-tk-${i}`,
        text: t,
        tone: 'tick',
        anchor: pt(i / 4, null, -0.22),
        prefer: 'S',
        only: ['S'],
        gapPx: 4,
        priority: 80,
        cue: chartWords,
      })
    })
    out.push(
      {
        id: 'hop-draws',
        text: 'Draws',
        tone: 'tick',
        anchor: pt(0.5, null, -0.22),
        prefer: 'S',
        only: ['S'],
        gapPx: key === 'P' ? 22 : 24,
        priority: 78,
        cue: chartWords,
      },
      // the two regions, either side of the zero line, clear of every thread
      // (below the lowest thread from draw 21 on, where all 64 are ahead)
      {
        id: 'hop-gen-ahead',
        text: 'GENERALIST AHEAD',
        tone: 'name',
        color: PAL.yellowGreen,
        required: true,
        anchor: pt(0.5, 36),
        prefer: 'E',
        only: ['E', 'NE'],
        gapPx: 2,
        priority: 70,
        cue: chartWords,
      },
      {
        id: 'hop-spec-ahead',
        text: 'A SPECIALIST AHEAD',
        tone: 'name',
        color: PAL.chalk,
        dot: false,
        required: true,
        anchor: pt(0.5, -40),
        prefer: 'E',
        only: ['E', 'SE'],
        gapPx: 2,
        priority: 70,
        cue: chartWords,
      },
      {
        id: 'hop-this-run',
        text: 'THIS RUN',
        tone: 'callout',
        color: PAL.yellowGreen,
        required: true,
        // inside the chart's top right, over the bright line's end
        anchor: (() => {
          const v: Pt = [0, 0, Z + 0.05]
          return () => {
            const f = fr.current
            const r = isExplore() ? ex.run : STORY
            const n = isExplore() ? Math.max(1, Math.min(STORY_DRAWS, exploreCounted())) : STORY_DRAWS
            v[0] = f.x(n / STORY_DRAWS)
            v[1] = f.y(leadVc(r.lead[n])) + cy
            return v
          }
        })(),
        prefer: 'NW',
        only: ['NW', 'N', 'W', 'SW'],
        gapPx: 8,
        leader: true,
        priority: 90,
        cue: chartClaim,
      },
      {
        id: 'hop-every',
        text: 'EVERY LINE IS ONE RANDOM HOPPER',
        tone: 'legend',
        color: PAL.chalk,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 9,
        cue: chartClaim,
      },
    )
    return out
  }, [w, key, fr])
  useLabels(specs, { mode: 'both' })

  // labels never sit on the highlighted run's line
  const S = 21
  const line = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        const f = fr.current
        // only the part of the line that is drawn, and only while the chart shows
        const p = isExplore() ? (exChart() > 0.05 ? 1 : 0) : mineProgress(T)
        if (p <= 0) return 0
        const r = isExplore() ? ex.run : STORY
        const cy = chartCenterY(w)
        for (let i = 0; i < S; i++) {
          const d = Math.round((i / (S - 1)) * STORY_DRAWS * p)
          out[i * 3] = f.x(d / STORY_DRAWS)
          out[i * 3 + 1] = f.y(leadVc(r.lead[Math.min(d, r.n)])) + cy
          out[i * 3 + 2] = CHART_Z
        }
        return S
      },
      maxPoints: S,
      radiusPx: 5,
      mode: 'both',
    }),
    [w, fr],
  )
  useWorldObstacle('hop-line', line)
}

/* ------------------------------ scene ------------------------------ */

export default function HopperScene() {
  const key = useHopKey()
  const w = WORLD[key]
  const f = useChartFrame(CHART_OPTS)
  // the chart frame changes with the focus rect: label anchors read it through a ref
  const fr = useRef(f)
  useLayoutEffect(() => {
    fr.current = f
  }, [f])
  // explore bricks follow the explore run (their meshes are rebuilt only when the run is replaced)
  const runId = useHopExplore((s) => s.runId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exRun = useMemo(() => ex.run, [runId])
  useBoardPx(w)
  const boardSpecs = useBoardLabels(w, fr)
  useChartLabels(w, fr, key)
  // counting totals, written imperatively (never React state per frame)
  useTotals(w)
  // one material set PER brick set (fix round 1): <Instances> writes its set's
  // opacity into the material every frame, so sets sharing materials took the
  // last writer's opacity (H6: the P1 and P2 bars faded with the four behind,
  // then popped back once those were hidden). Same shader, so no new programs.
  const brickMats = useBrickMaterials()
  const backMats = useBrickMaterials()
  const exMats = useBrickMaterials()
  const t = w.ticket

  /** where the ticket is at T: its H1 place or its board place, and the flick card's shrink */
  const place = useMemo(() => {
    const out: TicketXf = { x: 0, y: 0, z: 0, s: 1 }
    return (T: number): TicketXf => {
      return ticketAt(w, board(T), out)
    }
  }, [w])
  /** the notch the drawn ball rests in */
  const slot = useMemo(
    () => (T: number, o: THREE.Vector3) => {
      const p = place(T)
      o.set(p.x + (t.side * t.w * p.s) / 2, p.y, p.z)
    },
    [place, t],
  )
  const launch = useMemo(
    () => (T: number, o: THREE.Vector3) => {
      const p = place(T)
      o.set(p.x, p.y - t.h * 0.22 * p.s, p.z)
    },
    [place, t],
  )
  /** the drum fades out (a solid dimmed to black would stand as a silhouette on the slate); S: it steps out for the board */
  const drumOn = useMemo(
    () => (T: number) => {
      if (isExplore()) return w.drumOnBoard ? exRails() * (1 - compactNow()) : 0
      const out = (1 - othersBack(T)) * (1 - compactNow() * boardIn(T))
      return w.drumOnBoard ? out : out * (1 - at(T, B.score, 0, 0.16))
    },
    [w],
  )
  const mine = useMemo(
    () => ({
      run: () => (isExplore() ? ex.run : STORY),
      upto: () => (isExplore() ? exploreCounted() : STORY_DRAWS),
      progress: mineProgress,
      opacity: () => 1,
    }),
    [],
  )
  // H4 on: the P1 lane the Generalist climbs into, marked in #91C640 (the
  // claim); it reaches past the rail far enough to hold the leader's total
  const p1 = useMemo<PlateSpec[]>(() => {
    const y = slotY(w, 0)
    return [
      {
        rect: [w.rails.x0 - 0.95, y - BH / 2 - 0.18, w.rails.x0 + w.rails.len + READOUT_ROOM[key], y + BH / 2 + 0.66],
        fill: PAL.yellowGreen,
        fillAlpha: 0.022,
        line: PAL.yellowGreen,
        lineAlpha: 0.32,
      },
    ]
  }, [w, key])
  // H6: where the bracket stands in the chart (draw 40, from zero to this run's lead)
  const cy = chartCenterY(w)
  const chartBase = useMemo(() => new THREE.Vector3(f.x(1), f.y(leadV(0)) + cy, CHART_Z + 0.03), [f, cy])
  const chartTop = useMemo(() => new THREE.Vector3(f.x(1), f.y(leadV(STORY.lead[STORY_DRAWS])) + cy, CHART_Z + 0.03), [f, cy])

  useQAProbe('hop-board', () => {
    const T = clock.T
    const src = srcAt(T)
    const b = boardAt(src.s, src.X, w.rails.len)
    return {
      T,
      X: src.X,
      key,
      unit: boardPx.unit,
      rankPos: [...b.rankPos],
      dest: [...b.dest],
      lift: [...b.lift],
      k: b.k,
      totals: [...b.totals],
      tips: [0, 1, 2, 3, 4, 5].map((a) => tipOf(src.s, src.X, b, a)),
      anchors: boardSpecs.filter((l) => l.id.startsWith('hop-n-') || l.id.startsWith('hop-t-')).map((l) => [l.id, typeof l.anchor === 'function' ? l.anchor(T, focusRect.layout) : l.anchor, l.cue ? l.cue(T) : 1]),
    }
  })

  return (
    <>
      <Plates plates={p1} radius={0.24} z={-BD / 2 - 0.12} renderOrder={4} vis={(T) => (isExplore() ? 0 : at(T, B.unknown, 0.62, 0.78) * (1 - othersBack(T)))} />
      <Drum w={w} ambient={ambient} dim={drumDim} hoops={hoops} steel={steel} bars={full} pour={pour} src={srcAt} board={board} slot={slot} opacity={drumOn} />
      <Ticket w={w} src={srcAt} place={place} board={board} vis={ticketVis} trace={trace} traceOut={traceOut} railLen={w.rails.len} />
      <Rails w={w} draw={railDraw} dim={railDim} opacity={railOn} tips={(T) => (T < B.every ? 1 : 0)} />
      <Bricks w={w} mats={brickMats} src={srcAt} run={STORY} draws={STORY_DRAWS} athletes={FRONT} opacity={frontBricks} launch={launch} />
      <Bricks w={w} mats={backMats} src={srcAt} run={STORY} draws={STORY_DRAWS} athletes={BACK} opacity={backBricks} launch={launch} />
      <Bricks w={w} mats={exMats} src={srcAt} run={exRun} draws={EXPLORE_CAP} opacity={exploreBricks} launch={launch} />
      <BrickLights w={w} src={srcAt} launch={launch} />
      <Ticks w={w} src={srcAt} opacity={ticksOn} />
      <GeneralistFlare w={w} src={srcAt} k={flare} />
      <Ripple position={[w.rails.x0 - 0.45, slotY(w, 0), 0.4]} color={PAL.yellowGreen} sizePx={70} k={(T) => (isExplore() ? 0 : at(T, B.unknown, 0.64, 0.86))} />
      <LeadBracket w={w} src={srcAt} p1={P1} p2={P2} draw={bracketDraw} swing={bracketSwing} opacity={bracketOn} guide={guideOn} chartBase={chartBase} chartTop={chartTop} />
      <group position={[0, cy, CHART_Z]}>
        <Threads frame={f} construct={construct} opacity={chartOn} bundle={bundle} mine={mine} />
      </group>
      <ExploreLayer w={w} />
      {/* a light on the ticket's notch as the ball lands (H1) */}
      <Ripple position={[t.c[0] + (t.side * t.w) / 2, t.c[1], t.c[2]]} color={LIGHT} sizePx={60} k={(T) => (isExplore() ? 0 : at(T, B.draw, 0.4, 0.58))} />
    </>
  )
}
