import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { HIERARCHY, PAL } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { Pen } from '../../story/kit/Pen'
import { BlobShadow } from '../../story/kit/BlobShadow'
import { makeRimStandard } from '../../story/kit/materials'
import { useLabels } from '../../story/labels/useLabel'
import { useStoryStore } from '../../story/store'
import type { Layout, LabelSpec, V3 } from '../../story/types'
import { LEVELS } from './crossfitMath'
import { PYR } from './layout'
import {
  B,
  DEFICIENT,
  claimSuffer,
  claimWorld,
  crackDraw,
  crush,
  defName,
  hundredFlash,
  hundredIn,
  slabFlash,
  slabLabel,
  slabLand,
  suffer,
} from './timeline'

/* =========================================================================
   C5 to C7: the Theoretical Hierarchy of the Development of an Athlete
   (L1 Guide p. 29) as a physical pyramid (STORYBOARD-crossfit.md). Five lit
   slabs in HIERARCHY's colours; each sits on the top of the one below, so a
   crushed level carries everything above it down and off level: the rule,
   made physical. The same solid is the explore instrument (a deficiency per
   level, damped).
   ========================================================================= */

/** One level's state at a moment. */
export interface SlabState {
  /** how far the slab still hovers above its rest (landing), 0 at rest */
  drop: number
  /** 0..1 opacity (arriving) */
  show: number
  /** 0..1 crushed by its own deficiency */
  crush: number
  /** 0..1 suffering from a deficiency below */
  suffer: number
  /** extra lean of this slab in degrees (adds to the one below) */
  lean: number
  /** 0..1 HDR flash (landing, lighting) */
  flash: number
}

export const emptyStates = (): SlabState[] =>
  Array.from({ length: LEVELS }, () => ({ drop: 0, show: 0, crush: 0, suffer: 0, lean: 0, flash: 0 }))

/** The story's pyramid at T. */
export function storyStates(T: number, out: SlabState[]): SlabState[] {
  const cr = crush(T)
  const su = suffer(T)
  for (let i = 0; i < LEVELS; i++) {
    const land = slabLand(T, i)
    const s = out[i]
    s.drop = T < B.pyr ? 1 : 1 - land
    s.show = T < B.pyr ? 0 : Math.min(1, land * 4)
    s.crush = i === DEFICIENT ? cr : 0
    s.suffer = i > DEFICIENT ? su : 0
    s.lean = i === DEFICIENT ? 2.5 * cr : i > DEFICIENT ? (i === DEFICIENT + 1 ? 5 : 7) * su : 0
    s.flash = Math.max(slabFlash(T, i), hundredFlash(T, i))
  }
  return out
}

/** Explore: per-level deficiency (0..1) -> states (a level is crushed by its own, suffers by the worst below). */
export function exploreStates(def: readonly number[], out: SlabState[]): SlabState[] {
  let worst = 0
  for (let i = 0; i < LEVELS; i++) {
    const s = out[i]
    s.drop = 0
    s.show = 1
    s.crush = def[i]
    s.suffer = worst
    s.lean = 2.5 * def[i] + 6 * worst
    s.flash = 0
    worst = Math.max(worst, def[i])
  }
  return out
}

/* ------------------------------ geometry ------------------------------- */

export interface SlabXf {
  /** centre */
  c: [number, number, number]
  /** lean (radians, about z) */
  roll: number
  /** current height */
  h: number
  w: number
  d: number
}

const D2R = Math.PI / 180
const CRUSH_H = 0.45

/** Stack the slabs: each sits on the top of the one below (after its lean), offset by its drop. */
export function stack(layout: Layout, st: readonly SlabState[], out: SlabXf[]): SlabXf[] {
  const dims = PYR[layout]
  let bx = 0
  let by = 0
  let roll = 0
  for (let i = 0; i < LEVELS; i++) {
    const s = st[i]
    const h = dims.h * (1 - CRUSH_H * s.crush)
    roll += s.lean * D2R
    // a suffering slab also slides toward its lean
    const slide = 0.16 * s.suffer * dims.h
    const cx = bx + slide - Math.sin(roll) * (h / 2)
    const cy = by + Math.cos(roll) * (h / 2) + s.drop * dims.h * 2.4
    const o = out[i]
    o.c[0] = cx
    o.c[1] = cy
    o.c[2] = 0
    o.roll = roll
    o.h = h
    o.w = dims.w[i]
    o.d = dims.d[i]
    // the next slab's base: this slab's top centre plus the gap, along its own up axis (ignoring the drop)
    const tx = bx + slide - Math.sin(roll) * (h + dims.gap)
    const ty = by + Math.cos(roll) * (h + dims.gap)
    bx = tx
    by = ty
  }
  return out
}

export const emptyXf = (): SlabXf[] => Array.from({ length: LEVELS }, () => ({ c: [0, 0, 0] as [number, number, number], roll: 0, h: 1, w: 1, d: 1 }))

/** A point given in a slab's local frame (x across, y up from its centre, z toward the front) -> world. */
export function slabPoint(x: SlabXf, lx: number, ly: number, lz: number, out: [number, number, number] | number[]): void {
  const c = Math.cos(x.roll)
  const s = Math.sin(x.roll)
  out[0] = x.c[0] + lx * c - ly * s
  out[1] = x.c[1] + lx * s + ly * c
  out[2] = x.c[2] + lz
}

/* ------------------------------ the solid ------------------------------ */

const GREY = new THREE.Color('#2f383d')
const SICK = new THREE.Color(PAL.sick).multiplyScalar(0.3)

/**
 * The five slabs. `states(T, out)` fills the level states for this frame
 * (story: a pure function of T; explore: the damped store). `onXf` receives
 * the stacked transforms each frame (labels, crack, claims read them).
 */
export function PyramidSolid({
  layout,
  states,
  xfRef,
  visible,
}: {
  layout: Layout
  states: (T: number, out: SlabState[]) => SlabState[]
  xfRef: { current: SlabXf[] }
  visible: (T: number) => number
}) {
  const dims = PYR[layout]
  const group = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const geos = useMemo(() => HIERARCHY.map((_, i) => new RoundedBoxGeometry(dims.w[i], dims.h, dims.d[i], 3, Math.min(0.1, dims.h * 0.08))), [dims])
  const mats = useMemo(
    () =>
      HIERARCHY.map((l) =>
        makeRimStandard({ color: l.color, rim: l.color, rimStrength: 0.6, metalness: 0.14, roughness: 0.46, emissive: l.color, emissiveIntensity: 0.1, transparent: true }),
      ),
    [],
  )
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  // the body is the hue darkened (a lit solid on the slate, never a flat toy block); the rim carries the hue
  const base = useMemo(() => HIERARCHY.map((l) => new THREE.Color(l.color).multiplyScalar(0.5)), [])
  const hue = useMemo(() => HIERARCHY.map((l) => new THREE.Color(l.color)), [])
  const st = useMemo(() => emptyStates(), [])
  const tmp = useMemo(() => new THREE.Color(), [])

  useSafeFrame('crossfit pyramid', (T) => {
    const g = group.current
    if (!g) return
    const v = visible(T)
    g.visible = v > 0.002
    if (!g.visible) return
    states(T, st)
    stack(layout, st, xfRef.current)
    for (let i = 0; i < LEVELS; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const s = st[i]
      const x = xfRef.current[i]
      m.visible = s.show > 0.002
      m.position.set(x.c[0], x.c[1], x.c[2])
      m.rotation.set(0, 0, x.roll)
      m.scale.set(1, x.h / dims.h, 1)
      const mat = mats[i]
      // own deficiency sinks the colour toward a dark red; suffering greys it toward the slate
      tmp.copy(base[i]).lerp(SICK, 0.62 * s.crush).lerp(GREY, 0.72 * s.suffer)
      mat.color.copy(tmp)
      mat.emissive.copy(hue[i]).lerp(SICK, 0.62 * s.crush).lerp(GREY, 0.72 * s.suffer)
      mat.emissiveIntensity = 0.1 * (1 - 0.7 * s.suffer) + 1.6 * s.flash + 0.35 * s.crush
      const rim = mat.userData.rim as { uRimStrength: { value: number } }
      rim.uRimStrength.value = 0.6 * (1 - 0.65 * s.suffer)
      mat.opacity = s.show * v
      mat.depthWrite = s.show * v > 0.98
    }
  }, { hide: group })

  return (
    <group ref={group}>
      {HIERARCHY.map((l, i) => (
        <mesh key={l.key} ref={(m) => void (meshes.current[i] = m)} geometry={geos[i]} material={mats[i]} renderOrder={20} />
      ))}
    </group>
  )
}

/* ------------------------------- story -------------------------------- */

const SUBS = ['EAT MEAT AND VEGETABLES', 'BIKE, RUN, SWIM, ROW', 'MASTER THE BASICS', 'TRAIN THE MAJOR LIFTS', 'PLAY NEW SPORTS'] as const

/** World point of the crack's centre on the deficient slab's face (callout anchor). */
const _p: [number, number, number] = [0, 0, 0]

export function StoryPyramid({ layout }: { layout: Layout }) {
  const dims = PYR[layout]
  const xfRef = useRef<SlabXf[]>(emptyXf())
  const states = (T: number, out: SlabState[]) => storyStates(T, out)
  const visible = (T: number) => (T >= B.pyr ? 1 : 0)
  const st = useMemo(() => emptyStates(), [])
  const xfs = useMemo(() => emptyXf(), [])
  /** stacked transforms at T, for anchors (labels run before the scene's frame code) */
  const xfAt = (T: number) => stack(layout, storyStates(T, st), xfs)

  // the crack across the deficient slab's front face (a hot red pen)
  const crackLocal = useMemo(() => {
    const w = dims.w[DEFICIENT] * 0.82
    const ys = [0.05, -0.22, 0.18, -0.12, 0.26, -0.2, 0.08, -0.05]
    const pts: number[] = []
    for (let k = 0; k < ys.length; k++) pts.push(-w / 2 + (w * k) / (ys.length - 1), ys[k])
    return pts
  }, [dims])
  const crackPts = useMemo(() => new Float32Array((crackLocal.length / 2) * 3), [crackLocal])
  const lastC = useRef('')
  const writeCrack = (T: number, p: Float32Array): boolean => {
    const key = layout + T
    if (key === lastC.current) return false
    lastC.current = key
    const x = xfAt(T)[DEFICIENT]
    const k = x.h / dims.h
    for (let i = 0; i < crackLocal.length / 2; i++) {
      slabPoint(x, crackLocal[i * 2], crackLocal[i * 2 + 1] * dims.h * k, x.d / 2 + 0.03, _p)
      p[i * 3] = _p[0]
      p[i * 3 + 1] = _p[1]
      p[i * 3 + 2] = _p[2]
    }
    return true
  }

  const labels = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = []
    const aDef: [number, number, number] = [0, 0, 0]
    const aTop: [number, number, number] = [0, 0, 0]
    const aTop2: [number, number, number] = [0, 0, 0]
    HIERARCHY.forEach((l, i) => {
      // name just above the face centre, its second line just below (screen-space gaps, so the pair
      // fits however small the slab is drawn: the last beat's CTA row shortens the stage)
      const face = () => {
        const a: [number, number, number] = [0, 0, 0]
        return (T: number): V3 => {
          const x = xfAt(T)[i]
          slabPoint(x, 0, 0.02 * x.h, x.d / 2 + 0.05, a)
          return a
        }
      }
      const sufferK = (T: number) => 1 - 0.55 * (i > DEFICIENT ? suffer(T) : 0)
      out.push(
        {
          id: `cf-lvl-${i}`,
          text: l.label.toUpperCase(),
          tone: 'name',
          color: PAL.chalk,
          dot: false,
          anchor: face(),
          prefer: 'N',
          only: ['N'],
          gapPx: 0,
          priority: 90 - i,
          required: true,
          cue: (T) => slabLabel(T, i) * sufferK(T) * (1 - hundredIn(T, i)),
        },
        {
          id: `cf-lvl2-${i}`,
          text: l.label,
          tone: 'tick',
          anchor: face(),
          prefer: 'S',
          only: ['S'],
          gapPx: 1,
          priority: 71 - i,
          cue: (T) => hundredIn(T, i),
        },
        {
          id: `cf-role-${i}`,
          text: l.role,
          tone: 'tick',
          anchor: face(),
          prefer: 'S',
          only: ['S'],
          gapPx: 1,
          priority: 70 - i,
          cue: (T) => slabLabel(T, i) * sufferK(T) * (1 - hundredIn(T, i)),
        },
        {
          id: `cf-100-${i}`,
          text: SUBS[i],
          tone: 'name',
          color: PAL.chalk,
          dot: false,
          anchor: face(),
          prefer: 'N',
          only: ['N'],
          gapPx: 0,
          priority: 91 - i,
          required: true,
          cue: (T) => hundredIn(T, i),
        },
      )
    })
    out.push(
      {
        id: 'cf-deficiency',
        text: 'DEFICIENCY',
        tone: 'callout',
        color: PAL.sick,
        anchor: (T) => {
          const x = xfAt(T)[DEFICIENT]
          slabPoint(x, x.w * 0.36, 0, x.d / 2 + 0.05, aDef)
          return aDef
        },
        prefer: 'E',
        only: ['E', 'NE', 'SE'],
        gapPx: 26,
        leader: 'always',
        priority: 97,
        cue: defName,
      },
      {
        id: 'cf-claim-suffer',
        text: 'THE COMPONENTS ABOVE WILL SUFFER',
        short: 'THE LEVELS ABOVE SUFFER',
        tone: 'callout',
        color: PAL.chalk,
        anchor: (T) => {
          const x = xfAt(T)[LEVELS - 1]
          slabPoint(x, 0, x.h / 2 + 0.1, 0, aTop)
          return aTop
        },
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 14,
        priority: 96,
        cue: claimSuffer,
      },
      {
        id: 'cf-claim-world',
        text: 'WORLD-CLASS FITNESS',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: (T) => {
          const x = xfAt(T)[LEVELS - 1]
          slabPoint(x, 0, x.h / 2 + 0.1, 0, aTop2)
          return aTop2
        },
        prefer: 'N',
        only: ['N', 'NE', 'NW'],
        gapPx: 14,
        priority: 96,
        cue: claimWorld,
      },
    )
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout])
  useLabels(labels)


  return (
    <>
      <PyramidSolid layout={layout} states={states} xfRef={xfRef} visible={visible} />
      <BlobShadow
        radius={dims.w[0] * 0.62}
        strength={0.6}
        place={(T, _i, out) => {
          out[0] = 0
          out[1] = 0.004
          out[2] = 0
          out[3] = 1
          return T >= B.pyr ? Math.min(1, slabLand(T, 0) * 2) : 0
        }}
      />
      <Pen points={crackPts} color={PAL.sick} width={3} update={writeCrack} progress={crackDraw} head hot gain={() => 1.3} renderOrder={46} />
    </>
  )
}

/* ------------------------------ explore -------------------------------- */

export function ExplorePyramid({ layout, def }: { layout: Layout; def: { current: number[] } }) {
  const xfRef = useRef<SlabXf[]>(emptyXf())
  const states = (_T: number, out: SlabState[]) => exploreStates(def.current, out)
  const visible = () => (useStoryStore.getState().mode === 'explore' ? 1 : 0)
  return (
    <>
      <PyramidSolid layout={layout} states={states} xfRef={xfRef} visible={visible} />
      <BlobShadow
        radius={PYR[layout].w[0] * 0.62}
        strength={0.6}
        place={(_T, _i, out) => {
          out[0] = 0
          out[1] = 0.004
          out[2] = 0
          out[3] = 1
          return useStoryStore.getState().mode === 'explore' ? 1 : 0
        }}
      />
    </>
  )
}

