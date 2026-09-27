import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { Pen, PEN } from '../../story/kit/Pen'
import { Halo } from '../../story/kit/Halo'
import { SdfText } from '../../story/kit/SdfText'
import { makeRimStandard } from '../../story/kit/materials'
import { useSafeFrame } from '../../story/useSafeFrame'
import type { Layout, V3 } from '../../story/types'
import { N, STATES, STOP_FIT, STOP_WELL, spectrumLinear } from './continuumMath'
import { R, bowl, dialPoint, radiusOf, spokeAngle as spokeAngleOf } from './layout'
import {
  OUTLINE_PTS,
  makeBackingMaterial,
  makeDiscGeometry,
  makeDiscMaterial,
  makePersonGeometry,
  makePersonMaterial,
  makePitMaterial,
  writeMembrane,
  writeOutline,
} from './materials'
import { TintDots, TintPen } from './kitx'
import { keySel } from './keySel'

/* =========================================================================
   The dial's shared pieces (DESIGN.md D.6 "Dial phase", "Person"), used by
   the story layer (driven by T) and the explore layer (driven by the
   explore state). Every input is a function, so neither layer keeps history.
   ========================================================================= */

/** Warm white of a pen tip (the kit's head colour family). */
export const LIGHT = '#e9ffc4'

/**
 * World sizes by layout: a phone dial is about 20 px per unit, desktop about
 * 37. The state word rises out of the pit to sit just BELOW the orb on
 * screen (wordY < 0): seen from the C4 tilt the pit's floor, and so the orb,
 * projects above the rim's centre, and a word placed above the orb in the
 * world lands right on it. It sits inside the polygon, on a soft slate
 * backing, and scales with the dial.
 */
export function sizesFor(layout: Layout) {
  return layout === 'P'
    ? { dot: 0.36, orb: 0.46, word: 1.75, wordY: -1.85, bead: 0.3, print: 0.2 }
    : { dot: 0.26, orb: 0.42, word: 1.2, wordY: -1.55, bead: 0.2, print: 0.13 }
}

/* ------------------------------- disc --------------------------------- */

export interface DiscVis {
  opacity: (T: number) => number
  band?: (T: number) => number
  pit?: (T: number) => number
  /** strength of the depth contours (they read once the camera tilts) */
  iso?: (T: number) => number
  /** athlete polygon radii (for the C6 band), per spoke */
  polyR?: readonly number[]
}

export function Disc({ vis }: { vis: DiscVis }) {
  const geo = useMemo(() => makeDiscGeometry(), [])
  const mat = useMemo(() => makeDiscMaterial(), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  useEffect(() => {
    if (vis.polyR) mat.uniforms.uPolyR.value = [...vis.polyR]
  }, [mat, vis.polyR])
  useSafeFrame(
    'continuum disc',
    (T) => {
      const o = vis.opacity(T)
      const m = mesh.current
      if (!m) return
      m.visible = o > 0.002
      mat.uniforms.uOpacity.value = o
      mat.uniforms.uBand.value = vis.band ? vis.band(T) : 0
      mat.uniforms.uPit.value = vis.pit ? vis.pit(T) : 0
      mat.uniforms.uIso.value = vis.iso ? vis.iso(T) : 0.2
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={10} frustumCulled={false} />
}

/**
 * The pit's shadow over the spokes and rings (renderOrder between the
 * construction pens and the person): the centre reads darker and deeper.
 */
export function PitShadow({ k }: { k: (T: number) => number }) {
  const geo = useMemo(() => makeDiscGeometry(), [])
  const mat = useMemo(() => makePitMaterial(), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  useSafeFrame(
    'continuum pit shadow',
    (T) => {
      const v = k(T)
      if (mesh.current) mesh.current.visible = v > 0.002
      mat.uniforms.uK.value = v
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={35} frustumCulled={false} />
}

/* ------------------------------ circles ------------------------------- */

const CIRCLE_PTS = 121

/** A circle of radius r on the bowl, from 12 o'clock clockwise (the spoke order). */
export function circlePoints(r: number, lift = 0.012): Float32Array {
  const a = new Float32Array(CIRCLE_PTS * 3)
  const z = bowl(r) + lift
  for (let j = 0; j < CIRCLE_PTS; j++) {
    const t = Math.PI / 2 - (j / (CIRCLE_PTS - 1)) * Math.PI * 2
    a[j * 3] = r * Math.cos(t)
    a[j * 3 + 1] = r * Math.sin(t)
    a[j * 3 + 2] = z
  }
  return a
}

export interface CirclesVis {
  progress: (T: number) => number
  opacity: (T: number) => number
  /** the WELL circle rests dimmed (0..1) while an outline or a ghost marks that level */
  wellDim?: (T: number) => number
  head?: boolean
}

/** The WELL circle (amber), the FIT circle (green) and the rim (the fitness end of every spoke): the continuum's stations as rings. */
export function Circles({ vis }: { vis: CirclesVis }) {
  const well = useMemo(() => circlePoints(radiusOf(STOP_WELL)), [])
  const fit = useMemo(() => circlePoints(radiusOf(STOP_FIT)), [])
  const rim = useMemo(() => circlePoints(R), [])
  const hub = useMemo(() => circlePoints(radiusOf(0)), [])
  return (
    <>
      <Pen points={hub} color={PAL.sick} width={PEN.axis} progress={vis.progress} opacity={(T) => 0.8 * vis.opacity(T)} renderOrder={31} />
      <Pen points={rim} color={RIM_COLOR} width={PEN.axis} progress={vis.progress} opacity={(T) => 0.8 * vis.opacity(T)} dim={() => 0.7} renderOrder={30} />
      <Pen points={fit} color={PAL.fit} width={PEN.axis} progress={vis.progress} opacity={(T) => 0.8 * vis.opacity(T)} dim={() => 0.62} head={vis.head} renderOrder={31} />
      <Pen
        points={well}
        color={PAL.well}
        width={PEN.axis}
        progress={vis.progress}
        opacity={(T) => 0.85 * vis.opacity(T)}
        dim={(T) => (vis.wellDim ? vis.wellDim(T) : 1)}
        head={vis.head}
        renderOrder={31}
      />
    </>
  )
}

/** The rim is the fitness end of every spoke: spectrum(1), a little lighter than the FIT ring (0.82). */
export const RIM_COLOR = '#7fe3bd'

/* --------------------------- spoke highlight -------------------------- */

const HL_SEGS = 24

/** The spoke of the tapped key row or dot, drawn bright over the dimmed instrument. */
export function SpokeHighlight({ vis }: { vis: (T: number) => number }) {
  const pts = useMemo(() => new Float32Array((HL_SEGS + 1) * 3), [])
  const colors = useMemo(() => {
    const a = new Float32Array((HL_SEGS + 1) * 3)
    const c = new THREE.Color()
    for (let j = 0; j <= HL_SEGS; j++) {
      spectrumLinear(j / HL_SEGS, c)
      a[j * 3] = c.r
      a[j * 3 + 1] = c.g
      a[j * 3 + 2] = c.b
    }
    return a
  }, [])
  const last = useRef(-2)
  const write = (_T: number, p: Float32Array): boolean => {
    const i = keySel.i
    if (i === last.current || i < 0) return false
    last.current = i
    const a = spokeAngleOf(i)
    for (let j = 0; j <= HL_SEGS; j++) {
      const r = radiusOf(j / HL_SEGS)
      p[j * 3] = r * Math.cos(a)
      p[j * 3 + 1] = r * Math.sin(a)
      p[j * 3 + 2] = bowl(r) + 0.04
    }
    return true
  }
  return (
    <Pen
      points={pts}
      pointColors={colors}
      width={PEN.hero}
      update={write}
      opacity={(T) => (keySel.i >= 0 ? vis(T) : 0)}
      gain={() => 1.2}
      renderOrder={36}
    />
  )
}

/* ------------------------------- person ------------------------------- */

export interface PersonSrc {
  /** position of dot i at T (0 sick .. 1 elite) */
  pos: (T: number, i: number) => number
  /** changes whenever any position changes (cached writers key on it) */
  key: (T: number) => number
  /** mean of the live positions */
  mean: (T: number) => number
  dotScale: (T: number, i: number) => number
  outline: (T: number) => number
  /** the pen head is hot while the outline draws (the speaking element) */
  outlineHot: boolean
  fill: (T: number) => number
  /** 0..1: the orb is lit */
  orb: (T: number) => number
  /** extra gain on the orb and its halo (the claim, the impact accent), capped so the bloom stays a halo */
  hot: (T: number) => number
  /** the orb's colour at T (LINEAR) */
  orbColor: (T: number, out: THREE.Color) => void
  /** opacity of state word k (STATES order) */
  word: (T: number, k: number) => number
  /** word k: 0 (in the pit) .. 1 (risen in front of the dial) */
  wordLift: (T: number, k: number) => number
  /** WELL ghost outline (dashed), opacity */
  ghost?: (T: number) => number
  ghostPositions?: readonly number[]
  /** whole-person visibility */
  vis: (T: number) => number
  /** 0..1: the membrane inside the WELL circle steps aside (C6: the margin beyond wellness stays lit) */
  cut?: (T: number) => number
  /** spoke index to highlight (explore / key tap), or -1 */
  highlight?: () => number
  /** 0..1: a marker is selected, so the word and the fill step back and its readout leads */
  quiet?: () => number
}

const _col = new THREE.Color()
const _pt = [0, 0, 0]
/** the orb stays modest: the pit reads first, and the impact accent is a halo, not a white disc */
const HOT_CAP = 0.85

export function Person({ src, layout, site }: { src: PersonSrc; layout: Layout; site: string }) {
  const S = sizesFor(layout)
  const posBuf = useMemo(() => new Float64Array(N), [])
  const fillPositions = (T: number) => {
    for (let i = 0; i < N; i++) posBuf[i] = src.pos(T, i)
  }

  /* outline */
  const outline = useMemo(() => new Float32Array(OUTLINE_PTS * 3), [])
  const lastO = useRef(NaN)
  const writeO = (T: number, pts: Float32Array): boolean => {
    if (src.vis(T) <= 0) return false
    const k = src.key(T)
    if (k === lastO.current) return false
    lastO.current = k
    fillPositions(T)
    writeOutline(posBuf, pts)
    return true
  }

  /* membrane */
  const memGeo = useMemo(() => makePersonGeometry(), [])
  const memMat = useMemo(() => makePersonMaterial(), [])
  useEffect(() => () => memGeo.dispose(), [memGeo])
  useEffect(() => () => memMat.dispose(), [memMat])
  const memMesh = useRef<THREE.Mesh>(null)
  const memBuf = useMemo(() => new Float32Array(OUTLINE_PTS * 3), [])
  const lastM = useRef(NaN)

  /* orb */
  const orbGeo = useMemo(() => new THREE.SphereGeometry(1, 40, 28), [])
  const orbMat = useMemo(() => makeRimStandard({ color: PAL.well, emissive: PAL.well, emissiveIntensity: 0.4, rim: PAL.chalk, rimStrength: 0.45, roughness: 0.3, metalness: 0.15 }), [])
  useEffect(() => () => orbGeo.dispose(), [orbGeo])
  useEffect(() => () => orbMat.dispose(), [orbMat])
  const orb = useRef<THREE.Mesh>(null)
  const orbZ = bowl(0) + S.orb * 0.9

  /* words and their backing */
  const words = useRef<(THREE.Group | null)[]>([])
  const group = useRef<THREE.Group>(null)
  const backGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const backMat = useMemo(() => makeBackingMaterial(), [])
  useEffect(() => () => backGeo.dispose(), [backGeo])
  useEffect(() => () => backMat.dispose(), [backMat])
  const back = useRef<THREE.Mesh>(null)
  const wordY = (lift: number) => S.wordY * lift
  const wordZ = (lift: number) => bowl(0) + (0.6 - bowl(0)) * lift

  useSafeFrame(
    site,
    (T) => {
      const v = src.vis(T)
      const g = group.current
      if (g) g.visible = v > 0.002
      if (v <= 0.002) return
      const quiet = src.quiet ? src.quiet() : 0
      // membrane follows the outline
      const k = src.key(T)
      if (k !== lastM.current) {
        lastM.current = k
        fillPositions(T)
        writeOutline(posBuf, memBuf, 0.03)
        writeMembrane(memBuf, memGeo)
      }
      const mean = src.mean(T)
      spectrumLinear(mean, memMat.uniforms.uColor.value as THREE.Color)
      const f = src.fill(T) * v * (1 - 0.7 * quiet)
      memMat.uniforms.uOpacity.value = f
      memMat.uniforms.uCut.value = src.cut ? src.cut(T) : 0
      if (memMesh.current) memMesh.current.visible = f > 0.002
      // orb: modest until the claim, capped at the impact
      const hot = Math.min(HOT_CAP, src.hot(T))
      const o = orb.current
      if (o) {
        const on = src.orb(T) * v
        o.visible = on > 0.002
        const s = S.orb * (0.35 + 0.65 * on)
        o.scale.setScalar(s)
        o.position.set(0, 0, orbZ)
        src.orbColor(T, _col)
        orbMat.color.copy(_col)
        orbMat.emissive.copy(_col)
        orbMat.emissiveIntensity = 0.12 + 0.3 * on + 0.75 * hot
      }
      // state words rise out of the pit (each on its own lift) onto a slate backing
      let bk = 0
      let bl = 0
      for (let w = 0; w < STATES.length; w++) {
        const wg = words.current[w]
        const lift = src.wordLift(T, w)
        const wo = src.word(T, w)
        if (wo > bk) {
          bk = wo
          bl = lift
        }
        if (!wg) continue
        wg.position.set(0, wordY(lift), wordZ(lift))
        const sc = 0.8 + 0.2 * lift
        wg.scale.set(sc, sc, 1)
      }
      const b = back.current
      if (b) {
        b.visible = bk > 0.01
        b.position.set(0, wordY(bl) - S.word * 0.04, wordZ(bl) - 0.05)
        b.scale.set(S.word * 3.1, S.word * 1.35, 1)
        backMat.uniforms.uOpacity.value = 0.62 * bk * (1 - 0.6 * quiet)
      }
    },
    { hide: group },
  )

  // dots: spectrum(position), riding the bowl; the highlighted one grows
  const dotPlace = (T: number, i: number, out: [number, number, number]) => {
    dialPoint(i, src.pos(T, i), _pt, 0, 0.06)
    out[0] = _pt[0]
    out[1] = _pt[1]
    out[2] = _pt[2]
    const h = src.highlight ? src.highlight() : -1
    return src.dotScale(T, i) * src.vis(T) * (h === i ? 1.4 : 1)
  }
  const dotTint = (T: number, i: number, out: THREE.Color) => {
    spectrumLinear(src.pos(T, i), out)
  }

  const ghostPts = useMemo(() => {
    if (!src.ghostPositions) return null
    const a = new Float32Array(OUTLINE_PTS * 3)
    writeOutline(src.ghostPositions, a, 0.02)
    return a
  }, [src.ghostPositions])

  return (
    <group ref={group}>
      <mesh ref={memMesh} geometry={memGeo} material={memMat} renderOrder={12} frustumCulled={false} />
      {ghostPts && src.ghost && (
        <Pen
          points={ghostPts}
          color={PAL.well}
          width={PEN.axis}
          dashed
          dashSize={0.32}
          gapSize={0.24}
          opacity={(T) => src.ghost!(T) * src.vis(T)}
          renderOrder={37}
        />
      )}
      <TintPen
        site={site + ' outline'}
        points={outline}
        color={PAL.well}
        width={PEN.data}
        update={writeO}
        progress={src.outline}
        opacity={src.vis}
        head
        hot={src.outlineHot}
        renderOrder={44}
        tint={(T, out) => {
          spectrumLinear(src.mean(T), out)
        }}
      />
      <TintDots site={site + ' dots'} count={N} radius={S.dot} place={dotPlace} tint={dotTint} rimStrength={0.55} emissiveIntensity={0.5} renderOrder={47} />
      <mesh ref={orb} geometry={orbGeo} material={orbMat} renderOrder={20} />
      <Halo
        position={[0, 0, orbZ + 0.2] as V3}
        sizePx={layout === 'P' ? 54 : 96}
        color={PAL.chalk}
        intensity={(T) => 0.08 * src.orb(T) * src.vis(T) + 0.3 * Math.min(HOT_CAP, src.hot(T))}
      />
      <mesh ref={back} geometry={backGeo} material={backMat} renderOrder={45} frustumCulled={false} />
      {STATES.map((st, w) => (
        <group key={st.word} ref={(el) => void (words.current[w] = el)}>
          <SdfText
            font="anton"
            text={st.word}
            size={S.word}
            color={st.css}
            outline
            letterSpacing={0.02}
            opacity={(T) => src.word(T, w) * src.vis(T) * (1 - 0.7 * (src.quiet ? src.quiet() : 0))}
            renderOrder={46}
          />
        </group>
      ))}
    </group>
  )
}
