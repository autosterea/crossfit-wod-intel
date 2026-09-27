import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { BIOMARKERS, PAL } from '../../fitnessData'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useSafeFrame } from '../../story/useSafeFrame'
import { gestureBus, useDragHandle } from '../../story/gestures'
import { focusRect, subscribeFocus } from '../../story/camera/focusRect'
import { PenBatch, PEN } from '../../story/kit/Pen'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec, V3 } from '../../story/types'
import { N, STATES, STOP_FIT, STOP_WELL, betterText, shortName, shortName2, spectrumHex as spectrumHexOf, spectrumLinear, stateWord, stopText, tickText, valueText } from './continuumMath'
import { HUB, R, bowl, compactStage, dialPoint, keyMode, radiusOf, shortStage, spokeAngle } from './layout'
import { Circles, Disc, Person, PitShadow, SpokeHighlight, sizesFor, type PersonSrc } from './dial'
import { live, snapLive, useContExplore } from './exploreStore'
import { keySel, selectSpoke, spokeVersion, subscribeSpoke } from './keySel'
import { OUTLINE_T } from './materials'

/* =========================================================================
   Continuum explore (DESIGN.md D.6 "Explore", C.12). Not driven by T: the
   dial stands finished, the person follows the explore state (chips,
   sliders, drag handles) with damped motion. A tapped dot or key row
   selects that marker: its spoke lights, the state word and the fill step
   back, its live value sits beside its dot on a glass chip, and its full
   name, better direction and sick / well / fit values are pinned chips in
   the corners (they never fight the spoke names for room).
   ========================================================================= */

const SEGS = 24
const damp = THREE.MathUtils.damp
const _v: number[] = [0, 0, 0]
const NO_LABELS: LabelSpec[] = []

/** Damped word opacities, orb colour and selection quiet. */
const exWord = new Float64Array(STATES.length)
const exOrb = new THREE.Color(PAL.well)
const _target = new THREE.Color()
const exQuiet = { v: 0 }

const EX_PERSON: PersonSrc = {
  pos: (_T, i) => live.pos[i],
  key: () => live.version,
  mean: () => live.mean,
  dotScale: () => 1,
  outline: () => 1,
  outlineHot: false,
  fill: () => 1,
  orb: () => 1,
  hot: () => 0,
  orbColor: (_T, out) => void out.copy(exOrb),
  word: (_T, k) => exWord[k],
  wordLift: () => 1,
  vis: () => 1,
  highlight: () => keySel.i,
  quiet: () => exQuiet.v,
}

/** The ten finished spokes on the bowl, in the spectrum (one draw call), plus the WELL, FIT and tip ticks. */
function StaticDial() {
  const spokes = useMemo(() => {
    const segs = new Float32Array(N * SEGS * 6)
    const cols = new Float32Array(segs.length)
    const c0 = new THREE.Color()
    const c1 = new THREE.Color()
    for (let i = 0; i < N; i++) {
      const a = spokeAngle(i)
      for (let s = 0; s < SEGS; s++) {
        const o = (i * SEGS + s) * 6
        const r0 = radiusOf(s / SEGS)
        const r1 = radiusOf((s + 1) / SEGS)
        segs.set([r0 * Math.cos(a), r0 * Math.sin(a), bowl(r0), r1 * Math.cos(a), r1 * Math.sin(a), bowl(r1)], o)
        spectrumLinear(s / SEGS, c0)
        spectrumLinear((s + 1) / SEGS, c1)
        cols.set([c0.r, c0.g, c0.b, c1.r, c1.g, c1.b], o)
      }
    }
    return { segs, cols }
  }, [])
  const ticks = useMemo(() => {
    const stops = [STOP_WELL, STOP_FIT, 1]
    const segs = new Float32Array(N * stops.length * 6)
    const h = 0.17
    for (let i = 0; i < N; i++) {
      const a = spokeAngle(i)
      stops.forEach((p, k) => {
        const r = radiusOf(p)
        const x = r * Math.cos(a)
        const y = r * Math.sin(a)
        const nx = -Math.sin(a) * h
        const ny = Math.cos(a) * h
        const z = bowl(r) + 0.01
        segs.set([x - nx, y - ny, z, x + nx, y + ny, z], (i * stops.length + k) * 6)
      })
    }
    return segs
  }, [])
  return (
    <>
      <PenBatch segments={spokes.segs} colors={spokes.cols} width={PEN.data} dim={() => 0.6} renderOrder={32} />
      <PenBatch segments={ticks} color={PAL.chalk} width={PEN.axis} opacity={() => 0.62} dim={() => 0.6} renderOrder={33} />
    </>
  )
}

/* ------------------------------ dragging ------------------------------ */

/**
 * ONE handle for the ten dots, hit-tested by the NEAREST dot: the engine
 * takes the first registered handle within its radius, and on a phone the
 * Sedentary dots sit 12 px apart near the hub, so ten handles grabbed the
 * wrong one. A window capture listener records where the finger landed
 * (it runs before the stage's own capture listener), the handle's anchor is
 * the dot nearest that point, and the drag moves that dot along its spoke.
 */
const pick = { x: -1e4, y: -1e4, i: 0, active: -1 }
const _p = new THREE.Vector3()

function nearestDot(): number {
  const cam = gestureBus.camera
  if (!cam) return 0
  let best = 0
  let bd = Infinity
  for (let i = 0; i < N; i++) {
    dialPoint(i, live.pos[i], _v, 0, 0.06)
    _p.set(_v[0], _v[1], _v[2]).project(cam)
    const d = Math.hypot(((_p.x + 1) / 2) * focusRect.W - pick.x, ((1 - _p.y) / 2) * focusRect.H - pick.y)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

function DotHandles() {
  const mode = useStoryStore((s) => s.mode)
  useEffect(() => {
    if (mode !== 'explore') return
    const onDown = (e: PointerEvent) => {
      const st = (e.target as Element | null)?.closest?.('.st-stage')
      if (!st) return
      const r = st.getBoundingClientRect()
      pick.x = e.clientX - r.left
      pick.y = e.clientY - r.top
      pick.i = nearestDot()
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [mode])
  const g = useRef({ start: null as null | [number, number], moved: false })
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  useDragHandle({
    id: 'cont-dots',
    radiusPx: 22,
    anchor: () => {
      dialPoint(pick.i, live.pos[pick.i], _v, 0, 0.06)
      return [_v[0], _v[1], _v[2]] as V3
    },
    onStart: () => {
      pick.active = pick.i
      g.current.start = null
      g.current.moved = false
    },
    onDrag: (ray, ndc) => {
      const i = pick.active
      if (i < 0) return
      const s = g.current
      if (!s.start) {
        s.start = [ndc[0], ndc[1]]
        return
      }
      if (!s.moved && Math.hypot(ndc[0] - s.start[0], ndc[1] - s.start[1]) < 0.025) return
      s.moved = true
      // intersect at the dot's own depth on the bowl, twice (the bowl is shallow)
      const a = spokeAngle(i)
      let r = radiusOf(live.pos[i])
      for (let k = 0; k < 2; k++) {
        plane.constant = -bowl(r)
        if (!ray.intersectPlane(plane, hit)) return
        r = hit.x * Math.cos(a) + hit.y * Math.sin(a)
      }
      const p = Math.max(0, Math.min(1, (r - HUB) / (R - HUB)))
      useContExplore.getState().setPos(i, p)
      if (keySel.i !== i) selectSpoke(i)
    },
    onEnd: () => {
      if (pick.active >= 0 && !g.current.moved) selectSpoke(pick.active)
      pick.active = -1
    },
  })
  return null
}

export default function ExploreScene() {
  const { layout } = useBeat()
  const mode = useStoryStore((s) => s.mode)
  const reduced = useStoryStore((s) => s.reduced)
  const S = sizesFor(layout)
  // the key and the dot values follow the focus rect (re-render only when a decision flips)
  const key = useSyncExternalStore(subscribeFocus, keyMode)
  const short = useSyncExternalStore(subscribeFocus, shortStage)
  const compact = useSyncExternalStore(subscribeFocus, compactStage)
  const dotValues = !key && !short && !compact
  const phone = layout === 'P'

  // entering explore starts from the targets (no replayed climb)
  useEffect(() => {
    if (mode !== 'explore') return
    snapLive()
    const k = STATES.findIndex((s) => s.word === stateWord(live.mean).word)
    for (let w = 0; w < STATES.length; w++) exWord[w] = w === k ? 1 : 0
    exOrb.set(stateWord(live.mean).css)
    exQuiet.v = keySel.i >= 0 ? 1 : 0
  }, [mode])

  useSafeFrame(
    'continuum explore damping',
    (_T, _A, dtRaw) => {
      if (useStoryStore.getState().mode !== 'explore') return
      const tgt = useContExplore.getState().positions
      const dt = Math.min(0.05, dtRaw)
      let moved = false
      let sum = 0
      for (let i = 0; i < N; i++) {
        const v = reduced ? tgt[i] : damp(live.pos[i], tgt[i], 10, dt)
        const nv = Math.abs(v - tgt[i]) < 1e-4 ? tgt[i] : v
        if (nv !== live.pos[i]) moved = true
        live.pos[i] = nv
        sum += nv
      }
      if (moved) {
        live.mean = sum / N
        live.version++
      }
      const sw = stateWord(live.mean)
      const k = STATES.findIndex((s) => s.word === sw.word)
      for (let w = 0; w < STATES.length; w++) exWord[w] = reduced ? (w === k ? 1 : 0) : damp(exWord[w], w === k ? 1 : 0, 8, dt)
      _target.set(sw.css)
      if (reduced) exOrb.copy(_target)
      else exOrb.lerp(_target, 1 - Math.exp(-8 * dt))
      const q = keySel.i >= 0 ? 1 : 0
      exQuiet.v = reduced ? q : damp(exQuiet.v, q, 10, dt)
    },
    { priority: -12 },
  )

  // labels (explore mode only): the ten names and the live values always
  // (landscape: every value; portrait: the selected one); the selected
  // marker's full name, direction and reference values as pinned chips
  const sel = useSyncExternalStore(subscribeSpoke, spokeVersion)
  const base = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = []
    for (let i = 0; i < N; i++) {
      const a = spokeAngle(i)
      out.push({
        id: `cnx-tip-${i}`,
        text: compact ? shortName2(i) : shortName(i),
        tone: 'name',
        dot: false,
        anchor: [R * Math.cos(a), R * Math.sin(a), 0],
        prefer: 'radial',
        center: [0, 0, 0],
        gapPx: compact ? 6 : 9,
        priority: 75,
      })
      // landscape: the live value beside every dot, outward along its spoke, on a glass chip
      // (portrait: the key lists them, and the selected one is a pinned chip)
      out.push({
        id: `cnx-val-${i}`,
        text: valueText(i, live.pos[i]),
        tone: 'tick',
        anchor: () => {
          dialPoint(i, live.pos[i], _v, 0, 0.06)
          return [_v[0], _v[1], _v[2]] as V3
        },
        prefer: 'radial',
        center: [0, 0, 0],
        gapPx: 15,
        leader: true,
        priority: 86,
        cue: () => (dotValues ? 1 : 0),
      })
    }
    return out
  }, [dotValues, compact])
  const picked = useMemo<LabelSpec[]>(() => {
    if (sel < 0) return NO_LABELS
    const refPin = phone ? 'top-right' : 'top-left'
    const out: LabelSpec[] = [
      { id: 'cnx-full', text: BIOMARKERS[sel].name, tone: 'legend', color: PAL.chalk, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 0, priority: 95 },
      { id: 'cnx-better', text: betterText(sel), tone: 'legend', color: PAL.yellowGreen, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 2, priority: 94 },
    ]
    // a phone dial has no room for a value beside a dot in its middle: the live value is a chip under the name
    if (!dotValues)
      out.push({ id: 'cnx-live', text: valueText(sel, live.pos[sel]), tone: 'legend', color: spectrumHexOf(live.pos[sel]), anchor: [0, 0, 0], pin: 'top-left', pinOrder: 1, priority: 95 })
    const refColors = [PAL.sick, PAL.well, PAL.fit]
    for (let s = 0; s < 3; s++) {
      out.push({
        id: `cnx-ref-${s}`,
        text: `${STATES[s].word} ${s < 2 ? tickText(sel, s) : stopText(sel, s)}`,
        tone: 'legend',
        color: refColors[s],
        anchor: [0, 0, 0],
        pin: refPin,
        pinOrder: 2 + s,
        priority: 93,
      })
    }
    return out
  }, [sel, phone, dotValues])
  useLabels(mode === 'explore' ? base : NO_LABELS, { mode: 'explore' })
  useLabels(mode === 'explore' ? picked : NO_LABELS, { mode: 'explore' })

  // values follow the live dots (text from the explore state, before the labels place)
  const lastTxt = useRef<string[]>([])
  const lastV = useRef(-1)
  useSafeFrame(
    'continuum explore values',
    () => {
      if (useStoryStore.getState().mode !== 'explore' || live.version === lastV.current) return
      lastV.current = live.version
      for (let i = 0; i < N; i++) {
        const t = valueText(i, live.pos[i])
        if (lastTxt.current[i] !== t) {
          lastTxt.current[i] = t
          setLabelText(`cnx-val-${i}`, t)
          if (i === keySel.i) setLabelText('cnx-live', t)
        }
      }
    },
    { priority: -85 },
  )

  const marks = useMemo<WorldObstacle>(
    () => ({
      mode: 'explore',
      maxPoints: 96,
      radiusPx: 7,
      points: (_T, out) => {
        let n = 0
        const put = (x: number, y: number, z: number) => {
          out[n * 3] = x
          out[n * 3 + 1] = y
          out[n * 3 + 2] = z
          n++
        }
        for (let i = 0; i < N; i++) {
          dialPoint(i, live.pos[i], _v, 0, 0.06)
          put(_v[0], _v[1], _v[2])
          const j = (i + 1) % N
          const ra = radiusOf(live.pos[i])
          const rb = radiusOf(live.pos[j])
          const ax = ra * Math.cos(spokeAngle(i))
          const ay = ra * Math.sin(spokeAngle(i))
          const bx = rb * Math.cos(spokeAngle(j))
          const by = rb * Math.sin(spokeAngle(j))
          for (let e = 0; e < 3; e++) {
            const x = ax + (bx - ax) * OUTLINE_T[e]
            const y = ay + (by - ay) * OUTLINE_T[e]
            put(x, y, bowl(Math.hypot(x, y)))
          }
        }
        // the rim between the spokes (the tips stay free for the names)
        for (let j = 0; j < N * 3; j++) {
          const a = ((72 - 36 * Math.floor(j / 3) + ((j % 3) - 1) * 7) * Math.PI) / 180
          put(R * Math.cos(a), R * Math.sin(a), 0)
        }
        put(0, 0, bowl(0) + S.orb)
        return n
      },
    }),
    [S.orb],
  )
  useWorldObstacle('cont-ex-marks', marks)
  const word = useMemo<WorldObstacle>(
    () => ({
      mode: 'explore',
      padPx: 4,
      box: () => {
        let chars = 0
        for (let k = 0; k < STATES.length; k++) if (exWord[k] > 0.3) chars = Math.max(chars, STATES[k].word.length)
        if (!chars || exQuiet.v > 0.5) return null
        const w = chars * S.word * 0.5
        return [
          [-w / 2, S.wordY - S.word * 0.5, 0.6],
          [w / 2, S.wordY + S.word * 0.5, 0.6],
        ]
      },
    }),
    [S.word, S.wordY],
  )
  useWorldObstacle('cont-ex-word', word)

  const discVis = useMemo(() => ({ opacity: () => 1, iso: () => 0.3 }), [])
  const circlesVis = useMemo(() => ({ progress: () => 1, opacity: () => 0.7, wellDim: () => 0.4 }), [])
  return (
    <>
      <Disc vis={discVis} />
      <StaticDial />
      <Circles vis={circlesVis} />
      <PitShadow k={() => 0.75} />
      <SpokeHighlight vis={() => (mode === 'explore' ? 1 : 0)} />
      <Person src={EX_PERSON} layout={layout} site="continuum explore person" />
      <DotHandles />
    </>
  )
}
