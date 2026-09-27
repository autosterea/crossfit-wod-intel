import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HOPPER_DOMAINS, PAL } from '../../fitnessData'
import { at, focus, stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { useBeat } from '../../story/useBeat'
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
import type { LabelSpec, Layout } from '../../story/types'
import { Drum } from './Drum'
import { Ticket } from './Ticket'
import { BrickLights, Bricks, GeneralistFlare, LeadBracket, Rails, Ticks, railY, tipOf, useBrickMaterials } from './Board'
import { Threads } from './Threads'
import ExploreLayer, { exAnim } from './ExploreScene'
import { BD, BH, CHART_OPTS, CHART_Z, READOUT_ROOM, WORLD, chartCenterY, leadV, leadVc, slotY, ticketAt, type TicketXf, type World } from './layout'
import { B, H6, STORY_SCHED, boardAt, boardIn, othersBack, spinBoost, ticketShrink, toChart } from './timeline'
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
        totals count; the rails sort, the new P1 first, and the rank badges
        land with the sort (L2); LEAD lands;
     H3 draws 2, 3 and 4: each draw's top scorer gets a tick (draw 1's
        first), LEAD passes to the Strongman;
     H4 the unknown: every brick lands, the Generalist's last; the rails
        re-sort and the Generalist takes P1, then the impact lands on it;
     H5 35 more draws rain in, the drum spinning twice as fast; every rail
        becomes a stacked bar of domain bands; the Generalist stays P1;
     H6 the lead becomes the chart: a bracket measures the P1 bar past the
        P2 bar, swings upright into the chart as the lead at draw 40, this
        run's line draws up to it, then 64 other hoppers.

   Prewarm (README): the drum, ticket (every face), both brick sets, the
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

const drumDim = (T: number) => (isExplore() ? 1 : focus(T, B.hopper))
/** the drum fades out (a solid dimmed to black would stand as a silhouette on the slate) */
const drumOn = (T: number) => (isExplore() ? (1 - exAnim.chart) * (1 - exAnim.compact) : 1 - othersBack(T))
const hoops = (T: number) => (isExplore() ? 1 : at(T, B.hopper, 0, 0.3, ease.draw))
const steel = (T: number) => (isExplore() ? 1 : at(T, B.hopper, 0.2, 0.4))
const full = (T: number) => (isExplore() ? 1 : 0)
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
  if (isExplore()) return (1 - exAnim.chart) * (1 - exAnim.compact)
  const pull = T >= B.score && T < B.specialists ? focus(T, B.draw) : 1
  return pull * (1 - othersBack(T))
}
const shrink = (T: number) => (isExplore() ? exAnim.shrink : ticketShrink(T))
const trace = (T: number) => (isExplore() ? 1 : at(T, B.draw, 0.7, 0.95, ease.draw))
const traceOut = (T: number) => (isExplore() || T < B.draw ? 0 : 1 - at(T, B.draw, 0.95, 1))
const railDraw = (T: number, k: number) => (isExplore() ? 1 : stagger(T, B.score, B.score + 0.3, k, 6, 0.27, ease.draw))
const railDim = (T: number) => (isExplore() ? 1 : focus(T, B.score))
const railOn = (T: number) => (isExplore() ? 1 - exAnim.chart : T >= B.score ? 1 - toChart(T) : 0)
const storyBricks = (T: number) => (isExplore() ? 0 : 1 - toChart(T))
/** H6: every rail but P1 and P2 is pressed into its rail */
const flat = (T: number, a: number) => (behind(a) ? othersBack(T) : 0)
// (fully behind the chart they are skipped: no work, no triangles)
const exploreBricks = () => (isExplore() && exAnim.chart < 0.98 ? 1 - exAnim.chart : 0)
const ticksOn = (T: number) => (isExplore() ? 0 : 1 - at(T, B.many, 0, 0.08))
const flare = (T: number) => (isExplore() ? 0 : impactK(T))
/** H6 */
const chartOn = (T: number) => (isExplore() ? exAnim.chart : at(T, B.every, H6.toChart[0], H6.toChart[0] + 0.08))
const construct = (T: number) => (isExplore() ? 1 : at(T, B.every, H6.construct[0], H6.construct[1], ease.draw))
const bundle = (T: number) => (isExplore() ? 1 : at(T, B.every, H6.bundle[0], H6.bundle[1], ease.draw))
const mineProgress = (T: number) => (isExplore() ? 1 : at(T, B.every, H6.mine[0], H6.mine[1], ease.draw))
/** the chart's words land with its construction, so the threads are read as they draw */
const chartWords = (T: number) => (isExplore() ? exAnim.chart : at(T, B.every, H6.construct[1] - 0.06, H6.construct[1]))
/** the claim: THIS RUN and the pinned legend */
const chartClaim = (T: number) => (isExplore() ? exAnim.chart : at(T, B.every, H6.claim[0], H6.claim[1]))
/** the board's labels (in explore: the rails view, not while the phone's sheet is expanded) */
const boardLabels = (T: number) => (isExplore() ? (1 - exAnim.chart) * (1 - exAnim.compact) : 1 - toChart(T))
/** H6: the labels of the rails that step back */
const behindLabels = (T: number, a: number) => (isExplore() || !behind(a) ? 1 : 1 - othersBack(T))
const bracketDraw = (T: number) => (isExplore() ? 0 : at(T, B.every, H6.bracket[0], H6.bracket[1], ease.draw))
const bracketSwing = (T: number) => (isExplore() ? 0 : at(T, B.every, H6.toChart[0], H6.toChart[1], ease.morph))
const bracketOn = (T: number) => (isExplore() || T < B.every ? 0 : 1 - at(T, B.every, H6.mine[1], H6.mine[1] + 0.1))
const guideOn = (T: number) => 1 - at(T, B.every, H6.toChart[0] - 0.02, H6.toChart[0] + 0.06)

/** draws counted on the explore board (its thread ends there) */
function exploreCounted(): number {
  const s = ex.sched
  let n = 0
  while (n < s.n && s.cnt1[n * N_ATH + N_ATH - 1] <= ex.X) n++
  return n
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

/** The board's labels: the legend, rank badges, names, totals, LEAD and NEW LEADER. */
function useBoardLabels(w: World, layout: Layout) {
  const specs = useMemo<LabelSpec[]>(() => {
    const x0 = w.rails.x0
    const len = w.rails.len
    /** the board at T (cached per time by boardAt; no allocation) */
    const board = (T: number) => {
      const s = srcAt(T)
      return boardAt(s.s, s.X, len)
    }
    const out: LabelSpec[] = []
    // the domain legend: what each ball and brick colour means (pinned top-left)
    HOPPER_DOMAINS.forEach((d, k) => {
      out.push({
        id: `hop-dom-${k}`,
        text: d.label,
        tone: 'legend',
        color: d.color,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: k,
        // explore: it steps aside while the controls sheet is expanded (a short focus rect)
        cue: (T) => (isExplore() ? (1 - exAnim.chart) * (focusRect.h > 420 ? 1 : 0) : at(T, B.hopper, 0.74, 0.9) * (1 - at(T, B.every, H6.toChart[0], H6.toChart[0] + 0.08))),
      })
    })
    // rank badges: fixed to the slots, landing with the first sort (L2: a
    // rank is annotation; before the first score the roster order is no ranking)
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
          const on = at(T, B.score, 0.8 + 0.02 * k, 0.84 + 0.02 * k)
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
          vn[1] = railY(w, b, a) + BH / 2
          vn[2] = b.lift[a]
          return vn
        },
        prefer: 'NW',
        only: ['NW'],
        gapPx: 5,
        priority: 86,
        // a passing rail's name steps off while it crosses the others and back as it settles
        cue: (T) => (isExplore() ? 1 : at(T, B.score, 0.12, 0.3)) * boardLabels(T) * (1 - board(T).fade[a]) * behindLabels(T, a),
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
        priority: 88,
        cue: (T) => (isExplore() ? 1 : at(T, B.score, 0.56, 0.62)) * boardLabels(T) * (1 - board(T).fade[a]) * behindLabels(T, a),
      })
    }
    // LEAD rides the leader's rail; it steps off while the lead changes hands
    const leadDips = (T: number) => {
      const s = STORY_SCHED
      let v = 0
      for (let d = 1; d < s.n; d++) {
        if (STORY.leader[d + 1] === STORY.leader[d]) continue
        v = Math.max(v, at(T, 0, s.sort0[d] - 0.02, s.sort0[d]) - at(T, 0, s.sort1[d], s.sort1[d] + 0.03))
      }
      return v
    }
    const leadX = x0 + 0.4 * len
    const vl: Pt = [0, 0, 0]
    const vw: Pt = [0, 0, 0]
    out.push({
      id: 'hop-lead',
      text: 'LEAD',
      tone: 'callout',
      color: PAL.yellowGreen,
      required: true,
      anchor: (T) => {
        const b = board(T)
        vl[0] = leadX
        vl[1] = railY(w, b, b.leader) + BH / 2
        vl[2] = b.lift[b.leader]
        return vl
      },
      prefer: 'N',
      only: ['N', 'NE', 'NW'],
      gapPx: 3,
      priority: 90,
      cue: (T) => {
        if (isExplore()) return boardLabels(T) * (board(T).leaderSwap >= 0 ? 0 : 1)
        const hideH4 = at(T, B.unknown, 0.46, 0.5) - at(T, B.many, 0.02, 0.08)
        return at(T, B.score, 0.9, 0.98) * (1 - hideH4) * (1 - leadDips(T)) * (1 - at(T, B.every, 0.16, 0.22))
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
        vw[1] = railY(w, b, GEN) + BH / 2
        vw[2] = b.lift[GEN]
        return vw
      },
      prefer: 'N',
      only: ['N', 'NE', 'NW'],
      gapPx: 3,
      priority: 92,
      cue: (T) => (isExplore() ? 0 : at(T, B.unknown, 0.62, 0.7) * (1 - at(T, B.many, 0, 0.06))),
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, layout])
  useLabels(specs, { mode: 'both' })

  // the top-scorer ticks (H3, H4) are 3D strokes over the bars: LEAD, which
  // rides the leader's rail, keeps off the leader's ticks (only those: a tick
  // under a long name at a rail's end must not push that name off)
  const ticks = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        if (isExplore() || T < B.specialists || T >= B.many + 0.08) return 0
        const s = STORY_SCHED
        const b = boardAt(s, T, w.rails.len)
        let n = 0
        for (let d = 0; d < s.n && n < 5; d++) {
          if (!(s.tick0[d] < T)) continue
          const a = s.run.top[d]
          if (a !== b.leader) continue
          out[n * 3] = w.rails.x0 + b.k * (s.run.prefix[d * N_ATH + a] + s.run.pts[d * N_ATH + a] / 2)
          out[n * 3 + 1] = railY(w, b, a) + BH / 2 + 0.33
          out[n * 3 + 2] = b.lift[a] + BD / 2
          n++
        }
        return n
      },
      maxPoints: 5,
      radiusPx: 8,
    }),
    [w],
  )
  useWorldObstacle('hop-ticks', ticks)
  return specs
}

/** H6 (and explore's Every run): the chart's own words (the L13 chart-reading note). */
function useChartLabels(w: World, f: ChartFrame, layout: Layout) {
  // the chart frame changes with the focus rect (every explore entry and
  // exit, every sheet detent): the anchors read it through a ref, so this
  // label set registers once per world and layout
  const fr = useRef(f)
  fr.current = f
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
        text: 'DRAWS',
        tone: 'tick',
        anchor: pt(0.5, null, -0.22),
        prefer: 'S',
        only: ['S'],
        gapPx: layout === 'P' ? 22 : 24,
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
  }, [w, layout])
  useLabels(specs, { mode: 'both' })

  // labels never sit on the highlighted run's line
  const S = 21
  const line = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        const f = fr.current
        // only the part of the line that is drawn, and only while the chart shows
        const p = isExplore() ? (exAnim.chart > 0.05 ? 1 : 0) : mineProgress(T)
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
    [w],
  )
  useWorldObstacle('hop-line', line)
}

/* ------------------------------ scene ------------------------------ */

export default function HopperScene() {
  const { layout } = useBeat()
  const w = WORLD[layout]
  const f = useChartFrame(CHART_OPTS)
  // explore bricks follow the explore run (their meshes are rebuilt only when the run is replaced)
  const runId = useHopExplore((s) => s.runId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exRun = useMemo(() => ex.run, [runId])
  const boardSpecs = useBoardLabels(w, layout)
  useChartLabels(w, f, layout)
  // counting totals, written imperatively (never React state per frame)
  useTotals(w)
  const brickMats = useBrickMaterials()
  const t = w.ticket

  /** where the ticket is at T: its H1 place or its board place, and the flick card's shrink */
  const place = useMemo(() => {
    const out: TicketXf = { x: 0, y: 0, z: 0, s: 1 }
    return (T: number): TicketXf => {
      ticketAt(w, board(T), out)
      out.s *= 1 - 0.2 * shrink(T)
      return out
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
        rect: [w.rails.x0 - 0.95, y - BH / 2 - 0.18, w.rails.x0 + w.rails.len + READOUT_ROOM[layout], y + BH / 2 + 0.66],
        fill: PAL.yellowGreen,
        fillAlpha: 0.022,
        line: PAL.yellowGreen,
        lineAlpha: 0.32,
      },
    ]
  }, [w, layout])
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
      rankPos: [...b.rankPos],
      lift: [...b.lift],
      fade: [...b.fade],
      k: b.k,
      totals: [...b.totals],
      tips: [0, 1, 2, 3, 4, 5].map((a) => tipOf(src.s, src.X, b, a)),
      anchors: boardSpecs.filter((l) => l.id.startsWith('hop-n-') || l.id.startsWith('hop-t-')).map((l) => [l.id, typeof l.anchor === 'function' ? l.anchor(T, layout) : l.anchor, l.cue ? l.cue(T) : 1]),
    }
  })

  return (
    <>
      <Plates plates={p1} radius={0.24} z={-BD / 2 - 0.12} renderOrder={4} vis={(T) => (isExplore() ? 0 : at(T, B.unknown, 0.62, 0.78) * (1 - othersBack(T)))} />
      <Drum w={w} ambient={ambient} dim={drumDim} hoops={hoops} steel={steel} bars={full} pour={pour} src={srcAt} board={board} slot={slot} opacity={drumOn} />
      <Ticket w={w} src={srcAt} place={place} vis={ticketVis} shrink={shrink} trace={trace} traceOut={traceOut} railLen={w.rails.len} />
      <Rails w={w} draw={railDraw} dim={railDim} opacity={railOn} />
      <Bricks w={w} mats={brickMats} src={srcAt} run={STORY} draws={STORY_DRAWS} opacity={storyBricks} launch={launch} flat={flat} />
      <Bricks w={w} mats={brickMats} src={srcAt} run={exRun} draws={EXPLORE_CAP} opacity={exploreBricks} launch={launch} />
      <BrickLights w={w} src={srcAt} launch={launch} />
      <Ticks w={w} src={srcAt} opacity={ticksOn} />
      <GeneralistFlare w={w} src={srcAt} k={flare} />
      <Ripple position={[w.rails.x0 - 0.45, slotY(w, 0), 0.4]} color={PAL.yellowGreen} sizePx={70} k={(T) => (isExplore() ? 0 : at(T, B.unknown, 0.62, 0.84))} />
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
