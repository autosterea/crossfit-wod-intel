import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { BIOMARKERS, PAL } from '../../fitnessData'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useDragHandle } from '../../story/gestures'
import { focusVersion, subscribeFocus } from '../../story/camera/focusRect'
import { PenBatch, PEN } from '../../story/kit/Pen'
import { setLabelText, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Dir, LabelSpec, V3 } from '../../story/types'
import { N, STATES, STOPS, STOP_FIT, STOP_WELL, betterText, shortName, spectrumLinear, stateWord, tickText, valueText } from './continuumMath'
import { HUB, R, bowl, dialPoint, keyMode, radiusOf, shortStage, spokeAngle } from './layout'
import { Circles, Disc, Person, SpokeHighlight, sizesFor, type PersonSrc } from './dial'
import { live, snapLive, useContExplore } from './exploreStore'
import { keySel, selectSpoke, spokeVersion, subscribeSpoke } from './keySel'

/* =========================================================================
   Continuum explore (DESIGN.md D.6 "Explore", C.12). Not driven by T: the
   dial stands finished, the person follows the explore state (chips,
   sliders, drag handles) with damped motion, and a tapped dot or key row
   shows that marker's own scale along its spoke.
   ========================================================================= */

const SEGS = 24
const damp = THREE.MathUtils.damp
const _v: number[] = [0, 0, 0]
const NO_LABELS: LabelSpec[] = []

/** Damped word opacities and orb colour. */
const exWord = new Float64Array(STATES.length)
const exOrb = new THREE.Color(PAL.well)
const _target = new THREE.Color()

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
        const u0 = s / SEGS
        const u1 = (s + 1) / SEGS
        const r0 = radiusOf(u0)
        const r1 = radiusOf(u1)
        segs.set([r0 * Math.cos(a), r0 * Math.sin(a), bowl(r0), r1 * Math.cos(a), r1 * Math.sin(a), bowl(r1)], o)
        spectrumLinear(u0, c0)
        spectrumLinear(u1, c1)
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

/** A drag handle on dot i, constrained to its spoke (it switches the profile to Custom); a tap selects the marker. */
function DotHandle({ i }: { i: number }) {
  const g = useRef({ start: null as null | [number, number], moved: false })
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  useDragHandle({
    id: `cont-dot-${i}`,
    radiusPx: 22,
    anchor: () => {
      dialPoint(i, live.pos[i], _v, 0, 0.06)
      return [_v[0], _v[1], _v[2]] as V3
    },
    onStart: () => {
      g.current.start = null
      g.current.moved = false
    },
    onDrag: (ray, ndc) => {
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
      if (!g.current.moved) selectSpoke(i)
    },
  })
  return null
}

/** Tangential side for a label beside dot i. */
function sideOf(i: number): Dir {
  const a = ((((spokeAngle(i) / Math.PI) * 180 - 90) % 360) + 360) % 360
  const dirs: Dir[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE']
  return dirs[Math.round(a / 45) % 8]
}

export default function ExploreScene() {
  const { layout } = useBeat()
  const mode = useStoryStore((s) => s.mode)
  const reduced = useStoryStore((s) => s.reduced)
  const S = sizesFor(layout)
  // the key and the dot values follow the focus rect (a rotation, a sheet)
  useSyncExternalStore(subscribeFocus, focusVersion)
  const key = keyMode()
  const dotValues = !key && !shortStage()

  // entering explore starts from the targets (no replayed climb)
  useEffect(() => {
    if (mode !== 'explore') return
    snapLive()
    const k = STATES.findIndex((s) => s.word === stateWord(live.mean).word)
    for (let w = 0; w < STATES.length; w++) exWord[w] = w === k ? 1 : 0
    exOrb.set(stateWord(live.mean).css)
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
    },
    { priority: -12 },
  )

  // labels (explore mode only): the ten names, the live values and the two
  // circles always; the selected marker's full name, its scale along the
  // spoke and its better direction only while it is selected (the cap of
  // 96 labels per view counts story and explore together)
  const sel = useSyncExternalStore(subscribeSpoke, spokeVersion)
  const base = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = []
    for (let i = 0; i < N; i++) {
      const a = spokeAngle(i)
      out.push({
        id: `ce-tip-${i}`,
        text: shortName(i),
        tone: 'name',
        dot: false,
        anchor: [R * Math.cos(a), R * Math.sin(a), 0],
        prefer: 'radial',
        center: [0, 0, 0],
        gapPx: 9,
        priority: 75,
      })
      // the live value beside the dot: every dot on landscape, the selected one on portrait
      out.push({
        id: `ce-val-${i}`,
        text: valueText(i, live.pos[i]),
        tone: 'tick',
        anchor: () => {
          dialPoint(i, live.pos[i], _v, 0, 0.06)
          return [_v[0], _v[1], _v[2]] as V3
        },
        prefer: dotValues ? sideOf(i) : 'radial',
        center: [0, 0, 0],
        gapPx: 12,
        priority: 86,
        cue: () => (dotValues ? 1 : keySel.i === i ? 1 : 0),
      })
    }
    const circ = (id: string, text: string, color: string, p: number) => {
      const a = 108 * (Math.PI / 180)
      const r = radiusOf(p)
      out.push({ id, text, tone: 'name', color, anchor: [r * Math.cos(a), r * Math.sin(a), bowl(r)], prefer: 'C', priority: 60 })
    }
    circ('ce-well', STATES[1].word, PAL.well, STOP_WELL)
    circ('ce-fit', STATES[2].word, PAL.fit, STOP_FIT)
    return out
  }, [key, dotValues])
  const picked = useMemo<LabelSpec[]>(() => {
    if (sel < 0) return NO_LABELS
    const a = spokeAngle(sel)
    // the full name and the better direction are pinned glass chips in the
    // top-left corner (they never fight the ten spoke names for room)
    const out: LabelSpec[] = [
      { id: 'ce-full', text: BIOMARKERS[sel].name, tone: 'legend', color: PAL.chalk, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 0, priority: 95 },
      { id: 'ce-better', text: betterText(sel), tone: 'legend', color: PAL.yellowGreen, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 1, priority: 94 },
    ]
    // its sick, well and fit values along the spoke
    STOPS.slice(0, 3).forEach((p, s) => {
      const r = radiusOf(p)
      out.push({
        id: `ce-sc-${s}`,
        text: tickText(sel, s),
        tone: 'tick',
        anchor: [r * Math.cos(a), r * Math.sin(a), bowl(r)],
        prefer: sideOf(sel),
        gapPx: 8,
        priority: 84,
      })
    })
    return out
  }, [sel])
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
          setLabelText(`ce-val-${i}`, t)
        }
      }
    },
    { priority: -85 },
  )

  const marks = useMemo<WorldObstacle>(
    () => ({
      mode: 'explore',
      maxPoints: 64,
      radiusPx: 8,
      points: (_T, out) => {
        let n = 0
        for (let i = 0; i < N; i++) {
          dialPoint(i, live.pos[i], _v, 0, 0.06)
          out[n * 3] = _v[0]
          out[n * 3 + 1] = _v[1]
          out[n * 3 + 2] = _v[2]
          n++
        }
        for (let j = 0; j < 32; j++) {
          const a = (j / 32) * Math.PI * 2
          out[n * 3] = R * Math.cos(a)
          out[n * 3 + 1] = R * Math.sin(a)
          out[n * 3 + 2] = 0
          n++
        }
        out[n * 3] = 0
        out[n * 3 + 1] = 0
        out[n * 3 + 2] = bowl(0) + S.orb
        n++
        return n
      },
    }),
    [S.orb],
  )
  useWorldObstacle('cont-ex-marks', marks)

  const discVis = useMemo(() => ({ opacity: () => 1 }), [])
  const circlesVis = useMemo(() => ({ progress: () => 1, opacity: () => 0.7 }), [])
  return (
    <>
      <Disc vis={discVis} />
      <StaticDial />
      <Circles vis={circlesVis} />
      <SpokeHighlight vis={() => (mode === 'explore' ? 1 : 0)} />
      <Person src={EX_PERSON} layout={layout} site="continuum explore person" />
      {Array.from({ length: N }, (_, i) => (
        <DotHandle key={i} i={i} />
      ))}
    </>
  )
}
