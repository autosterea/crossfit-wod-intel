import { useEffect, useMemo, useRef } from 'react'
import { PAL } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { cue } from '../../story/cue'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { useLabels } from '../../story/labels/useLabel'
import { useQAProbe } from '../../story/qa'
import type { LabelSpec } from '../../story/types'
import { Athlete, BallSeams, Floor, LumbarHighlight, athleteLabel, knotPhase, lumbarRedness, placeFor, type AthleteState, type Placement } from '../../story/kit/athlete'
import { KeyedRig, PULL_LAND } from './rig'
import { headSegs } from './geom'
import { isStacked, planeRect, t4Lifters, t7Lifter, unitsPerPx, type Stand } from './layout'
import { pullFault, pullPhase } from './techniqueMath'
import {
  B,
  GHOST_KNOTS,
  SOLID_KNOTS,
  athleteIn,
  ghostRound,
  goodForm,
  hipArc,
  hipArcOn,
  liftersIn,
  popName,
  roundedName,
  underName,
} from './timeline'

/* =========================================================================
   The athlete (story kit, H.78) in the three beats where the article's point
   is a body: T4, the article's own scene (p. 42): two people lift a heavy
   object, one pops the hip and gets under it (the medicine-ball clean, the
   guide's teaching clean, p. 208), the other pulls with a rounded back (the
   only body deviation the article names); T7 and T8, the same body under
   the threshold passage (p. 44): the pull repeated on story time at the
   speed of the path, its lower back lime while form holds and red while it
   falls apart. Every pose is a pure function of T (the kit keeps no
   history); each threshold beat lands on the pull at t = 1.
   ========================================================================= */

const AMBER = PAL.both
const LIME = PAL.yellowGreen
const RED = PAL.sick
const CHALK = PAL.chalk
const stand = (f: ChartFrame, s: Stand, out: Placement) => placeFor(f.x(s.u), f.y(s.v), s.k * f.FH, 0, out)

export function Lifters({ f }: { f: ChartFrame }) {
  const stacked = isStacked(f)
  const t4 = t4Lifters(stacked)
  const t7 = t7Lifter(stacked)
  const upx = unitsPerPx(f)

  // the placements read the live frame; a new frame bumps the rigs' epoch (a held frame re-poses)
  const live = useRef({ f, t4, t7 })
  const epoch = useRef(0)
  useEffect(() => {
    live.current = { f, t4, t7 }
    epoch.current++
  }, [f, t4, t7])

  /* the SOLID lifter: T4's clean, then T7 and T8's pull (never on screen at once) */
  const solid = useMemo(
    () =>
      new KeyedRig(
        (T): AthleteState =>
          T < B.odds
            ? { move: 'mb-clean', phase: knotPhase(Math.min(1, Math.max(0, T - B.deviation)), SOLID_KNOTS), faults: null }
            : { move: 'mb-pull', phase: pullPhase(T, PULL_LAND), faults: { lumbar: pullFault(T) } },
        (T, out) => {
          const L = live.current
          stand(L.f, T < B.odds ? L.t4.solid : L.t7, out)
        },
        () => epoch.current,
      ),
    [],
  )
  /* the GHOST: T4's second lifter, a rounded pull that barely lifts the ball */
  const ghost = useMemo(
    () =>
      new KeyedRig(
        (T): AthleteState => ({
          move: 'mb-clean',
          phase: knotPhase(Math.min(1, Math.max(0, T - B.deviation)), GHOST_KNOTS),
          faults: { lumbar: ghostRound(T) },
        }),
        (_T, out) => {
          const L = live.current
          stand(L.f, L.t4.ghost, out)
        },
        () => epoch.current,
      ),
    [],
  )

  const solidVis = (T: number) => (T < B.odds ? liftersIn(T) : athleteIn(T))

  /* ------------------ POP THE HIP: an amber arc chevron at the hip ------------------ */
  const N_ARC = 18
  const arc = useMemo(() => new Float32Array(N_ARC * 3), [])
  const head = useMemo(() => new Float32Array(2 * 6), [])
  const lastArc = useRef(-1)
  const lastHead = useRef(-1)
  const tmp = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  const writeArc = (T: number, p: Float32Array): boolean => {
    if (T < B.deviation || T > B.charter + 0.1) return false
    solid.pose(T)
    if (solid.version === lastArc.current) return false
    lastArc.current = solid.version
    const h = solid.into(T, 'hip', tmp)
    const r = 0.3 * solid.place.s
    // from the trunk's set-up angle (about 29 degrees above +x) up to vertical: the trunk swinging up
    for (let i = 0; i < N_ARC; i++) {
      const a = ((29 + (88 - 29) * (i / (N_ARC - 1))) * Math.PI) / 180
      p[i * 3] = h[0] + Math.cos(a) * r
      p[i * 3 + 1] = h[1] + Math.sin(a) * r
      p[i * 3 + 2] = 0.3 * solid.place.s
    }
    return true
  }
  const writeHead = (T: number, s: Float32Array): boolean => {
    if (T < B.deviation || T > B.charter + 0.1) return false
    solid.pose(T)
    if (solid.version === lastHead.current) return false
    lastHead.current = solid.version
    const h = solid.into(T, 'hip', tmp)
    const r = 0.3 * solid.place.s
    const a0 = (80 * Math.PI) / 180
    const a1 = (88 * Math.PI) / 180
    headSegs(s, 0, h[0] + Math.cos(a0) * r, h[1] + Math.sin(a0) * r, h[0] + Math.cos(a1) * r, h[1] + Math.sin(a1) * r, 9 * upx, 32, 0.3 * solid.place.s)
    return true
  }

  /* ------------------------------ labels ----------------------------- */
  const labels = useMemo<LabelSpec[]>(
    () => [
      athleteLabel(solid, 'hip', {
        id: 'tq-l-pop',
        text: 'POP THE HIP',
        tone: 'name',
        color: AMBER,
        prefer: 'W',
        only: ['W', 'NW', 'SW'],
        leader: true,
        gapPx: 14,
        priority: 88,
        cue: (T) => (T < B.odds ? popName(T) : 0),
      }),
      athleteLabel(solid, 'ball', {
        id: 'tq-l-under',
        text: 'GET UNDER IT',
        tone: 'name',
        color: CHALK,
        dot: false,
        prefer: 'NE',
        only: ['NE', 'E', 'N'],
        leader: true,
        gapPx: 12,
        priority: 87,
        cue: (T) => (T < B.odds ? underName(T) : 0),
      }),
      athleteLabel(ghost, 'lumbar', {
        id: 'tq-l-rounded',
        text: 'ROUNDED BACK',
        tone: 'callout',
        color: RED,
        required: true,
        prefer: 'N',
        only: ['N', 'NW', 'NE', 'W'],
        leader: 'always',
        gapPx: 22,
        cue: (T) => (T < B.odds ? roundedName(T) : 0),
      }),
      athleteLabel(solid, 'chest', {
        id: 'tq-l-good',
        text: 'GOOD TECHNIQUE, GOOD FORM',
        tone: 'callout',
        color: LIME,
        required: true,
        prefer: 'NE',
        only: ['NE', 'N', 'E', 'NW', 'W'],
        leader: 'always',
        gapPx: 26,
        cue: (T) => (T < B.odds ? goodForm(T) : 0),
      }),
      athleteLabel(solid, 'lumbar', {
        id: 'tq-l-falters',
        text: 'FORM FALTERS',
        tone: 'callout',
        color: RED,
        prefer: 'N',
        only: ['N', 'NW', 'NE', 'W'],
        leader: 'always',
        gapPx: 20,
        priority: 93,
        // only while the lower back is red (T7, T8)
        cue: (T) => (T >= B.threshold && T < B.everything ? cue(lumbarRedness(solid.lumbar(T)), 0.85, 1) * athleteIn(T) : 0),
      }),
    ],
    [solid, ghost],
  )
  useLabels(labels)

  // QA: the rep phase is a function of T: it lands on the pull at each threshold beat's end, never jumps
  // (largest step between samples 1/2000 of a beat apart), and the back is lime at both ends
  useQAProbe('tq-reps', () => {
    let maxStep = 0
    let prev = pullPhase(B.threshold, PULL_LAND)
    for (let i = 1; i <= 4000; i++) {
      const T = B.threshold + i / 2000
      const ph = pullPhase(T, PULL_LAND)
      let d = Math.abs(ph - prev)
      d = Math.min(d, 1 - d)
      maxStep = Math.max(maxStep, d)
      prev = ph
    }
    return {
      land: PULL_LAND,
      t7start: pullPhase(B.threshold, PULL_LAND),
      t7end: pullPhase(B.margin - 1e-9, PULL_LAND),
      t8start: pullPhase(B.margin, PULL_LAND),
      t8end: pullPhase(B.everything - 1e-9, PULL_LAND),
      maxStep,
      faultEnds: [pullFault(B.margin - 1e-9), pullFault(B.margin), pullFault(B.everything - 1e-9)],
    }
  })

  /* the floors: T4's one ground line under both lifters; T7 and T8's under the one */
  const s4 = (t4.solid.k * f.FH) / 1.78
  const s7 = (t7.k * f.FH) / 1.78
  const x7 = f.x(t7.u)
  const w7 = 0.9 * s7
  return (
    <>
      <Floor x0={f.x(0.03)} x1={f.x(0.97)} y={f.y(t4.solid.v)} near={0.36 * s4} far={-0.36 * s4} opacity={liftersIn} />
      <Floor x0={Math.max(f.x(0.01), x7 - w7)} x1={stacked ? x7 + w7 : Math.min(x7 + w7, f.x(planeRect(false).u0 + 0.03))} y={f.y(t7.v)} near={0.36 * s7} far={-0.36 * s7} opacity={athleteIn} />

      <Athlete rig={solid} opacity={solidVis} />
      <Athlete rig={ghost} look="ghost" opacity={liftersIn} renderOrder={24} />
      <BallSeams rig={solid} opacity={solidVis} />
      <BallSeams rig={ghost} opacity={liftersIn} />
      {/* the lower back: lime kept, red rounded; the ghost's is hot while red (T4's speaking element) */}
      <LumbarHighlight rig={solid} opacity={solidVis} />
      <LumbarHighlight rig={ghost} opacity={liftersIn} gain={(T) => 1 + 1.6 * lumbarRedness(ghost.lumbar(T)) * (T < B.charter ? 1 : 0)} />

      {/* POP THE HIP: the trunk swinging up about the hip */}
      <Pen points={arc} color={AMBER} width={PEN.data} head progress={hipArc} update={writeArc} opacity={(T) => (T < B.odds ? liftersIn(T) * hipArcOn(T) : 0)} renderOrder={46} />
      <PenBatch segments={head} color={AMBER} width={PEN.data} update={writeHead} opacity={(T) => (T < B.odds ? liftersIn(T) * hipArcOn(T) * (hipArc(T) >= 0.98 ? 1 : 0) : 0)} renderOrder={46} />
    </>
  )
}

export type { Stand }
