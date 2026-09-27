import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { HOPPER_DOMAINS, PAL } from '../../fitnessData'
import { at, focus, stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { useBeat } from '../../story/useBeat'
import { focusRect } from '../../story/camera/focusRect'
import { useChartFrame, type ChartFrame } from '../../story/kit/chartFrame'
import { Ripple } from '../../story/kit/Ripple'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import { impactK } from '../../story/kit/impact'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { registry } from '../../story/labels/registry'
import { clock, onFrame } from '../../story/clock'
import { useQAProbe } from '../../story/qa'
import type { LabelSpec, Layout, V3 } from '../../story/types'
import { Drum } from './Drum'
import { Ticket } from './Ticket'
import { BrickLights, Bricks, GeneralistFlare, Rails, Ticks, railY, tipOf, useBrickMaterials } from './Board'
import { Threads } from './Threads'
import ExploreLayer, { exAnim } from './ExploreScene'
import { BD, BH, CHART_OPTS, CHART_Z, WORLD, chartCenterY, leadV, slotY, type World } from './layout'
import { B, STORY_SCHED, boardAt, spinBoost, ticketShrink, toChart } from './timeline'
import { GEN, NAMES, N_ATH, STORY, STORY_DRAWS, EXPLORE_CAP } from './hopperMath'
import { ex, isExplore, srcAt, useHopExplore } from './exploreStore'

/* =========================================================================
   02 THE HOPPER, "The Tally" (DESIGN.md D.3). Every property is a pure
   function of story time T (the tumble runs on the ambient clock A, which
   freezes at T x 2.5 when held):
     H0 the pen draws three hoops that turn to steel, the bars grow, 25 task
        balls pour in and tumble; the domain legend lands;
     H1 a ball drops out of the drum into the ticket's notch, the ticket
        flips to DRAW 1 - WEIGHTLIFTING / 1RM BACK SQUAT, the pen traces it;
     H2 six rails draw on; six orange bricks fly to them and stretch to the
        draw-1 points; the totals count and the rails sort; LEAD lands;
     H3 draws 2, 3 and 4: each draw's top scorer gets a tick, LEAD passes to
        the Strongman;
     H4 the unknown: every brick lands, the Generalist's last; the rails
        re-sort and the Generalist climbs to P1 (the signature and impact);
     H5 35 more draws rain in, the drum spinning twice as fast; every rail
        becomes a stacked bar of domain bands; the Generalist stays P1;
     H6 the board steps back and the proof takes its place: 64 other
        hoppers, and this run's line in yellow-green.

   Prewarm (README): the drum, ticket (every face), both brick sets, the
   chart and the explore layer are all mounted at load and shown by T and
   mode, so no shader links mid-story.
   ========================================================================= */

const LIGHT = '#e9ffc4'

/* ------------------------------ timing ------------------------------ */

/**
 * H6 (and explore's Every run): the board steps back as the chart takes its
 * place. D.3 dims it to 15%; in linear light any visible ghost of the
 * bricks, rails and ticket read as clutter under the 64 threads, so the
 * board fades all the way out (known issues).
 */
const drumDim = (T: number) => (isExplore() ? 1 : focus(T, B.hopper))
/** the drum fades out (a solid dimmed to black would stand as a silhouette on the slate) */
const drumOn = (T: number) => (isExplore() ? 1 - exAnim.chart : 1 - toChart(T))
const hoops = (T: number) => (isExplore() ? 1 : at(T, B.hopper, 0, 0.3, ease.draw))
const steel = (T: number) => (isExplore() ? 1 : at(T, B.hopper, 0.2, 0.4))
const full = (T: number) => (isExplore() ? 1 : 0)
const ambient = (T: number, A: number) => A + (isExplore() ? 0 : spinBoost(T))
const ticketVis = (T: number) => {
  if (isExplore()) return 1 - exAnim.chart
  const pull = T >= B.score && T < B.specialists ? focus(T, B.draw) : 1
  return pull * (1 - toChart(T))
}
const shrink = (T: number) => (isExplore() ? exAnim.shrink : ticketShrink(T))
const trace = (T: number) => (isExplore() ? 1 : at(T, B.draw, 0.7, 0.95, ease.draw))
const traceOut = (T: number) => (isExplore() || T < B.draw ? 0 : 1 - at(T, B.draw, 0.95, 1))
const railDraw = (T: number, k: number) => (isExplore() ? 1 : stagger(T, B.score, B.score + 0.3, k, 6, 0.27, ease.draw))
const railDim = (T: number) => (isExplore() ? 1 : focus(T, B.score))
const railOn = (T: number) => (isExplore() ? 1 - exAnim.chart : T >= B.score ? 1 - toChart(T) : 0)
const storyBricks = (T: number) => (isExplore() ? 0 : 1 - toChart(T))
// (fully behind the chart they are skipped: no work, no triangles)
const exploreBricks = () => (isExplore() && exAnim.chart < 0.98 ? 1 - exAnim.chart : 0)
const ticksOn = (T: number) => (isExplore() ? 0 : 1 - at(T, B.many, 0, 0.08))
const flare = (T: number) => (isExplore() ? 0 : impactK(T))
/** H6 */
const chartOn = (T: number) => (isExplore() ? exAnim.chart : T >= B.every ? 1 : 0)
const construct = (T: number) => (isExplore() ? 1 : at(T, B.every, 0.15, 0.35, ease.draw))
const bundle = (T: number) => (isExplore() ? 1 : at(T, B.every, 0.35, 0.66, ease.draw))
const mineProgress = (T: number) => (isExplore() ? 1 : at(T, B.every, 0.62, 0.9, ease.draw))
const chartLabels = (T: number) => (isExplore() ? exAnim.chart : at(T, B.every, 0.9, 1))
/** the board's labels (in explore: the rails view) */
const boardLabels = (T: number) => (isExplore() ? 1 - exAnim.chart : 1 - toChart(T))

/** draws counted on the explore board (its thread ends there) */
function exploreCounted(): number {
  const s = ex.sched
  let n = 0
  while (n < s.n && s.cnt1[n * N_ATH + N_ATH - 1] <= ex.X) n++
  return n
}

/* ------------------------------ labels ------------------------------ */

/**
 * The six counted totals, written into their readout labels every frame they
 * change. Also re-asserts the DOM text: a label node that mounts after its
 * text was set by setLabelText renders the registered text and keeps it
 * (engine request), which left a held deep link showing "0".
 */
const TOTAL_IDS = Array.from({ length: N_ATH }, (_, a) => 'hop-t-' + a)
function useTotals(w: World) {
  useEffect(() => {
    return onFrame(() => {
      const src = srcAt(clock.T)
      const b = boardAt(src.s, src.X, w.rails.len)
      for (let a = 0; a < N_ATH; a++) {
        const id = TOTAL_IDS[a]
        const e = registry.get(id)
        if (!e) continue
        const txt = String(Math.round(b.totals[a]))
        // compare with the registry, not a local cache: a re-registered label starts at '0' again
        if (e.text !== txt) setLabelText(id, txt)
        if (e.txt && !e.short && e.txt.textContent !== e.text) e.txt.textContent = e.text
      }
    })
  }, [w])
}

function useHopperLabels(w: World, f: ChartFrame, layout: Layout) {
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
        cue: (T) => (isExplore() ? (1 - exAnim.chart) * (focusRect.h > 420 ? 1 : 0) : at(T, B.hopper, 0.74, 0.9) * (1 - at(T, B.every, 0, 0.1))),
      })
    })
    // rank badges: fixed to the slots; the athletes' rails move past them
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
        cue: (T) => (isExplore() ? boardLabels(T) : stagger(T, B.score + 0.06, B.score + 0.32, k, 6, 0.27) * boardLabels(T)),
      })
    }
    // athlete names above each rail's far end; the Generalist is marked in #91C640
    for (let a = 0; a < N_ATH; a++) {
      const g = a === GEN
      out.push({
        id: `hop-n-${a}`,
        text: NAMES[a],
        tone: 'name',
        color: PAL.yellowGreen,
        dot: g,
        anchor: (T) => {
          const b = board(T)
          return [x0 + len, railY(w, b, a) + BH / 2, b.lift[a]] as V3
        },
        prefer: 'NW',
        only: ['NW'],
        gapPx: 5,
        priority: 86,
        cue: (T) => (isExplore() ? boardLabels(T) : at(T, B.score, 0.12, 0.3) * boardLabels(T)),
      })
      // the total rides the end of the bar (counted into the label by useTotals)
      out.push({
        id: `hop-t-${a}`,
        text: '0',
        tone: 'readout',
        size: 'sm',
        minChars: 4,
        color: g ? PAL.yellowGreen : PAL.chalk,
        anchor: (T) => {
          const s = srcAt(T)
          const b = boardAt(s.s, s.X, len)
          return [x0 + tipOf(s.s, s.X, b, a), railY(w, b, a), b.lift[a] + BD / 2] as V3
        },
        prefer: 'E',
        only: ['E'],
        gapPx: 6,
        priority: 88,
        cue: (T) => (isExplore() ? boardLabels(T) : at(T, B.score, 0.56, 0.62) * boardLabels(T)),
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
    out.push({
      id: 'hop-lead',
      text: 'LEAD',
      tone: 'callout',
      color: PAL.yellowGreen,
      anchor: (T) => {
        const b = board(T)
        return [leadX, railY(w, b, b.leader) + BH / 2, b.lift[b.leader]] as V3
      },
      prefer: 'N',
      only: ['N', 'NE', 'NW'],
      gapPx: 3,
      priority: 90,
      cue: (T) => {
        if (isExplore()) return boardLabels(T) * (board(T).leaderSwap >= 0 ? 0 : 1)
        const hideH4 = at(T, B.unknown, 0.5, 0.55) - at(T, B.many, 0.02, 0.08)
        return at(T, B.score, 0.88, 0.98) * (1 - hideH4) * (1 - leadDips(T)) * boardLabels(T)
      },
    })
    out.push({
      id: 'hop-new',
      text: 'NEW LEADER',
      tone: 'callout',
      color: PAL.yellowGreen,
      anchor: (T) => {
        const b = board(T)
        return [leadX, railY(w, b, GEN) + BH / 2, b.lift[GEN]] as V3
      },
      prefer: 'N',
      only: ['N', 'NE', 'NW'],
      gapPx: 3,
      priority: 92,
      cue: (T) => (isExplore() ? 0 : at(T, B.unknown, 0.62, 0.7) * (1 - at(T, B.many, 0, 0.06))),
    })
    // H6: the chart's own words (the L13 chart-reading note)
    const cy = chartCenterY(w)
    const X = (u: number) => f.x(u)
    const Y = (lead: number) => f.y(leadV(lead)) + cy
    const Z = CHART_Z
    ;['0', '10', '20', '30', '40'].forEach((t, i) => {
      out.push({
        id: `hop-tk-${i}`,
        text: t,
        tone: 'tick',
        anchor: [X(i / 4), f.y(0) + cy - 0.22, Z],
        prefer: 'S',
        only: ['S'],
        gapPx: 4,
        priority: 80,
        cue: chartLabels,
      })
    })
    out.push(
      {
        id: 'hop-draws',
        text: 'DRAWS',
        tone: 'tick',
        anchor: [X(0.5), f.y(0) + cy - 0.22, Z],
        prefer: 'S',
        only: ['S'],
        gapPx: layout === 'P' ? 22 : 24,
        priority: 78,
        cue: chartLabels,
      },
      {
        id: 'hop-gen-ahead',
        text: 'GENERALIST AHEAD',
        tone: 'name',
        color: PAL.yellowGreen,
        anchor: [X(0.015), Y(620), Z],
        prefer: 'E',
        only: ['E', 'NE', 'SE'],
        gapPx: 4,
        priority: 70,
        cue: chartLabels,
      },
      {
        id: 'hop-spec-ahead',
        text: 'A SPECIALIST AHEAD',
        tone: 'name',
        color: PAL.chalk,
        dot: false,
        anchor: [X(0.66), Y(-66), Z],
        prefer: 'C',
        only: ['C'],
        priority: 70,
        cue: chartLabels,
      },
      {
        id: 'hop-this-run',
        text: 'THIS RUN',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: () => {
          const r = isExplore() ? ex.run : STORY
          const n = isExplore() ? Math.max(1, Math.min(STORY_DRAWS, exploreCounted())) : STORY_DRAWS
          return [X(n / STORY_DRAWS), Y(r.lead[n]), Z + 0.05] as V3
        },
        prefer: 'E',
        only: ['E', 'NE', 'N', 'NW'],
        gapPx: 8,
        leader: true,
        priority: 90,
        cue: chartLabels,
      },
      {
        id: 'hop-every',
        text: 'EVERY LINE IS ONE RANDOM HOPPER',
        tone: 'legend',
        color: PAL.chalk,
        anchor: [0, 0, 0],
        pin: 'top-left',
        pinOrder: 9,
        cue: (T) => (isExplore() ? exAnim.chart : at(T, B.every, 0.9, 1)),
      },
    )
    return out
  }, [w, f, layout])
  useLabels(specs, { mode: 'both' })

  // counting totals, written imperatively (never React state per frame)
  useTotals(w)

  // labels never sit on the highlighted run's line
  const S = 21
  const line = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        // only the part of the line that is drawn, and only while the chart shows
        const p = isExplore() ? (exAnim.chart > 0.05 ? 1 : 0) : mineProgress(T)
        if (p <= 0) return 0
        const r = isExplore() ? ex.run : STORY
        const cy = chartCenterY(w)
        for (let i = 0; i < S; i++) {
          const d = Math.round((i / (S - 1)) * STORY_DRAWS * p)
          out[i * 3] = f.x(d / STORY_DRAWS)
          out[i * 3 + 1] = f.y(leadV(r.lead[Math.min(d, r.n)])) + cy
          out[i * 3 + 2] = CHART_Z
        }
        return S
      },
      maxPoints: S,
      radiusPx: 5,
      mode: 'both',
    }),
    [w, f],
  )
  useWorldObstacle('hop-line', line)
  useQAProbe('hop-board', () => {
    const T = clock.T
    const src = srcAt(T)
    const b = boardAt(src.s, src.X, w.rails.len)
    return { T, X: src.X, rankPos: [...b.rankPos], lift: [...b.lift], k: b.k, totals: [...b.totals], tips: [0, 1, 2, 3, 4, 5].map((a) => tipOf(src.s, src.X, b, a)), anchors: specs.filter((l) => l.id.startsWith('hop-n-') || l.id.startsWith('hop-t-')).map((l) => [l.id, typeof l.anchor === 'function' ? l.anchor(T, layout) : l.anchor, l.cue ? l.cue(T) : 1]) }
  })
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
  useHopperLabels(w, f, layout)
  const brickMats = useBrickMaterials()
  const t = w.ticket
  // the drum steps back (on a phone) as the rails are built, and stays back
  const drumScale = useMemo(() => {
    const k = w.drumBoard
    return (T: number) => (k === 1 ? 1 : isExplore() ? k : 1 - (1 - k) * at(T, B.score, 0, 0.3, ease.morph))
  }, [w])
  const launch = (T: number, out: THREE.Vector3) => {
    const k = shrink(T)
    out.set(t.c[0], t.c[1] + 0.25 * k - t.h * 0.22 * (1 - 0.2 * k), t.c[2])
  }
  const mine = useMemo(
    () => ({
      run: () => (isExplore() ? ex.run : STORY),
      upto: () => (isExplore() ? exploreCounted() : STORY_DRAWS),
      progress: mineProgress,
      opacity: () => 1,
    }),
    [],
  )
  // H4 on: the P1 lane the Generalist climbs into, marked in #91C640 (the claim)
  const p1 = useMemo<PlateSpec[]>(() => {
    const y = slotY(w, 0)
    return [
      {
        rect: [w.rails.x0 - 0.95, y - BH / 2 - 0.18, w.rails.x0 + w.rails.len + 0.3, y + BH / 2 + 0.66],
        fill: PAL.yellowGreen,
        fillAlpha: 0.022,
        line: PAL.yellowGreen,
        lineAlpha: 0.32,
      },
    ]
  }, [w])
  return (
    <>
      <Plates plates={p1} radius={0.24} z={-BD / 2 - 0.12} renderOrder={4} vis={(T) => (isExplore() ? 0 : at(T, B.unknown, 0.66, 0.82) * boardLabels(T))} />
      <Drum w={w} ambient={ambient} dim={drumDim} hoops={hoops} steel={steel} bars={full} pour={full} src={srcAt} scale={drumScale} opacity={drumOn} />
      <Ticket w={w} src={srcAt} vis={ticketVis} shrink={shrink} trace={trace} traceOut={traceOut} railLen={w.rails.len} />
      <Rails w={w} draw={railDraw} dim={railDim} opacity={railOn} />
      <Bricks w={w} mats={brickMats} src={srcAt} run={STORY} draws={STORY_DRAWS} opacity={storyBricks} launch={launch} />
      <Bricks w={w} mats={brickMats} src={srcAt} run={exRun} draws={EXPLORE_CAP} opacity={exploreBricks} launch={launch} />
      <BrickLights w={w} src={srcAt} launch={launch} />
      <Ticks w={w} src={srcAt} opacity={ticksOn} />
      <GeneralistFlare w={w} src={srcAt} k={flare} />
      <Ripple position={[w.rails.x0 - 0.45, slotY(w, 0), 0.4]} color={PAL.yellowGreen} sizePx={70} k={(T) => (isExplore() ? 0 : at(T, B.unknown, 0.62, 0.84))} />
      <group position={[0, chartCenterY(w), CHART_Z]}>
        <Threads frame={f} construct={construct} opacity={chartOn} bundle={bundle} mine={mine} />
      </group>
      <ExploreLayer w={w} />
      {/* a light on the ticket's notch as the ball lands (H1) */}
      <Ripple position={w.slot} color={LIGHT} sizePx={60} k={(T) => (isExplore() ? 0 : at(T, B.draw, 0.4, 0.58))} />
    </>
  )
}

