import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useStoryStore } from '../../story/store'
import { bumpObstacles, useLabels } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'
import { Athlete, BallSeams, Floor, LumbarHighlight, placeFor, type AthleteState, type Placement } from '../../story/kit/athlete'
import { headSegs } from './geom'
import { PAST_PU, PERFECT_PV, SPEED_PU, isStacked, planeRect, planeUV, t7Lifter, unitsPerPx } from './layout'
import { Plane } from './Plane'
import { ExploreGraph } from './Graph'
import { KeyedRig, PULL_LAND } from './rig'
import { holds, useTqExplore } from './exploreStore'

/* =========================================================================
   08 TECHNIQUE explore scene: the threshold trainer (STORYBOARD-technique
   section 5). T8's stage as an instrument: the plane with the article's
   three speeds, a dot per speed (high and lime while form holds, low and
   red where it falls apart), the margin line at the first speed where it
   falters, and the athlete repeating the pull at the chosen speed's tempo
   (1, 1.2, 1.4) with that state's lower back. Explore may accumulate and
   damp (C.12): the rep phase runs on frame time, the dots, the margin and
   the back follow the store damped. Reduced motion holds the pull.
   ========================================================================= */

const LIME = PAL.yellowGreen
const RED = PAL.sick
const CHALK = PAL.chalk
const TEMPO = [1, 1.2, 1.4] as const
const MARGIN_PU = [SPEED_PU[1], SPEED_PU[1], SPEED_PU[2], PAST_PU] as const
const REP_S = 2.2

interface Live {
  phase: number
  lumbar: number
  dots: [number, number, number]
  margin: number
  swing: number
  graph: number
}

export default function ExploreScene({ f }: { f: ChartFrame }) {
  const stacked = isStacked(f)
  const upx = unitsPerPx(f)
  const st = useRef<Live>({ phase: PULL_LAND, lumbar: 0, dots: [PERFECT_PV, 0.5, 0.5], margin: SPEED_PU[1], swing: 0, graph: 0 })
  const spot = useTqExplore((s) => s.speed)

  // story time stands still in explore: the rig re-poses on its epoch, bumped every frame
  const where = useRef({ f, stacked })
  const epoch = useRef(0)
  useEffect(() => {
    where.current = { f, stacked }
  }, [f, stacked])
  const rig = useMemo(() => {
    const live = st.current
    const drive = (): AthleteState => ({ move: 'mb-pull', phase: live.phase, faults: { lumbar: live.lumbar } })
    const place = (_T: number, out: Placement) => {
      const w = where.current
      const t7 = t7Lifter(w.stacked)
      placeFor(w.f.x(t7.u), w.f.y(t7.v), t7.k * w.f.FH, 0, out)
    }
    return new KeyedRig(drive, place, () => epoch.current)
  }, [])

  useSafeFrame('technique explore', (_T, _A, dtRaw) => {
    const sto = useStoryStore.getState()
    if (sto.mode !== 'explore') return
    const dt = Math.min(0.1, dtRaw)
    const s = useTqExplore.getState()
    const L = st.current
    let moved = false
    const damp = (cur: number, to: number, k: number) => {
      const v = THREE.MathUtils.damp(cur, to, k, dt)
      const snapped = Math.abs(v - to) < 0.0005 ? to : v
      if (snapped !== cur) moved = true
      return snapped
    }
    // the reps: tempo of the chosen speed; reduced motion holds the pull
    if (!sto.reduced) L.phase = (L.phase + (dt * TEMPO[s.speed]) / REP_S) % 1
    else L.phase = PULL_LAND
    // the back: rounded while form falls apart at this speed (about 0.8 s to settle)
    L.lumbar = damp(L.lumbar, holds(s.speed, s.margin) ? 0 : 1, 5)
    for (let i = 0; i < 3; i++) L.dots[i] = damp(L.dots[i], i === 0 || holds(i, s.margin) ? PERFECT_PV : 0.5, 5)
    L.margin = damp(L.margin, MARGIN_PU[s.margin], 5)
    L.swing = damp(L.swing, holds(s.speed, s.margin) ? 0 : 1, 5)
    L.graph = damp(L.graph, s.graph ? 1 : 0, 8)
    epoch.current++
    if (moved) bumpObstacles()
  })

  const W = (a: number, b: number, out: [number, number, number], z = 0.05) => {
    const uv: [number, number] = [0, 0]
    planeUV(planeRect(stacked), a, b, uv)
    out[0] = f.x(uv[0])
    out[1] = f.y(uv[1])
    out[2] = z
    return out
  }

  /* the margin line and its head */
  const marginPts = useMemo(() => new Float32Array(6), [])
  const headPts = useMemo(() => new Float32Array(12), [])
  const tmp = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  const lastM = useRef('')
  const writeMargin = (_T: number, p: Float32Array): boolean => {
    const k = st.current.margin.toFixed(5) + '|' + f.FW
    if (k === lastM.current) return false
    lastM.current = k
    W(st.current.margin, 0, tmp, 0.04)
    p[0] = tmp[0]
    p[1] = tmp[1]
    p[2] = 0.04
    W(st.current.margin, 0.98, tmp, 0.04)
    p[3] = tmp[0]
    p[4] = tmp[1]
    p[5] = 0.04
    return true
  }
  const lastH = useRef('')
  const writeHead = (_T: number, s: Float32Array): boolean => {
    const k = st.current.margin.toFixed(5) + '|' + f.FW
    if (k === lastH.current) return false
    lastH.current = k
    W(st.current.margin, 0.98, tmp, 0.04)
    headSegs(s, 0, tmp[0] - 1, tmp[1], tmp[0] + 9 * upx, tmp[1], 9 * upx, 40, 0.04)
    return true
  }

  /* ------------------------------ labels ----------------------------- */
  const labels = useMemo<LabelSpec[]>(() => {
    const at = (a: number, b: number) => W(a, b, [0, 0, 0], 0)
    const mTop: [number, number, number] = [0, 0, 0]
    return [
      { id: 'tq-x-tech', text: 'TECHNIQUE', tone: 'tick', anchor: at(0, 1.02), prefer: 'E', only: ['E', 'NE'], gapPx: 6, priority: 84 },
      { id: 'tq-x-perfect', text: 'PERFECT', tone: 'tick', anchor: at(0, PERFECT_PV), prefer: 'W', only: ['W', 'NW', 'SW'], gapPx: 10, priority: 85 },
      { id: 'tq-x-unit', text: 'FT-LB PER MINUTE', tone: 'tick', anchor: at(1.02, 0), prefer: 'SW', only: ['SW', 'S'], gapPx: 46, priority: 84 },
      ...[0, 1, 2].map(
        (i): LabelSpec => ({
          id: `tq-x-k${i}`,
          text: ['10,000', '12,000', '14,000'][i],
          tone: 'tick',
          anchor: at(SPEED_PU[i], 0),
          prefer: 'S',
          only: ['S'],
          gapPx: i === 1 ? 20 : 6,
          sepPx: 3,
          priority: 90,
        }),
      ),
      {
        id: 'tq-x-margin',
        text: 'MARGIN',
        tone: 'name',
        color: LIME,
        anchor: () => W(st.current.margin, 0.98, mTop, 0),
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 8,
        priority: 97,
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, stacked])
  useLabels(labels, { mode: 'explore' })

  const t7 = t7Lifter(stacked)
  const s7 = (t7.k * f.FH) / 1.78
  const x7 = f.x(t7.u)
  const dotR = Math.min(0.24, 6 * upx)
  const graphVis = () => st.current.graph
  const swingK = () => st.current.swing
  return (
    <>
      <Plane f={f} explore />
      <Pen points={marginPts} color={LIME} width={PEN.data} update={writeMargin} renderOrder={45} />
      <PenBatch segments={headPts} color={LIME} width={PEN.data} update={writeHead} renderOrder={45} />
      <Nodes
        count={3}
        radius={dotR}
        color={LIME}
        place={(_T, i, out) => {
          const v = st.current.dots[i]
          W(SPEED_PU[i], v, out, 0.06)
          return Math.max(0, Math.min(1, (v - 0.5) / 0.38))
        }}
      />
      <Nodes
        count={3}
        radius={dotR}
        color={RED}
        place={(_T, i, out) => {
          const v = st.current.dots[i]
          W(SPEED_PU[i], v, out, 0.05)
          return 1 - Math.max(0, Math.min(1, (v - 0.5) / 0.38))
        }}
      />
      {/* the chosen speed: a soft light under its dot */}
      <Glows
        count={1}
        sizePx={34}
        colors={[CHALK]}
        gain={0.9}
        place={(_T, _i, out) => {
          W(SPEED_PU[spot], st.current.dots[spot], out, 0.04)
          return 0.55
        }}
      />
      <Floor x0={Math.max(f.x(0.01), x7 - 0.9 * s7)} x1={stacked ? x7 + 0.9 * s7 : Math.min(x7 + 0.9 * s7, f.x(planeRect(false).u0 + 0.03))} y={f.y(t7.v)} near={0.36 * s7} far={-0.36 * s7} />
      <Athlete rig={rig} />
      <BallSeams rig={rig} />
      <LumbarHighlight rig={rig} />
      <ExploreGraph f={f} swingK={swingK} vis={graphVis} />
    </>
  )
}
