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
import { OUTLINE_PTS, makeDiscGeometry, makeDiscMaterial, makePersonGeometry, makePersonMaterial, writeMembrane, writeOutline } from './materials'
import { TintDots, TintPen } from './kitx'
import { keySel } from './keySel'

/* =========================================================================
   The dial's shared pieces (DESIGN.md D.6 "Dial phase", "Person"), used by
   the story layer (driven by T) and the explore layer (driven by the
   explore state). Every input is a function, so neither layer keeps history.
   ========================================================================= */

/** Warm white of a pen tip (the kit's head colour family). */
export const LIGHT = '#e9ffc4'

/** On-screen sizes differ a lot between a phone dial (about 15 px per unit) and desktop (about 37). */
export function sizesFor(layout: Layout) {
  return layout === 'P'
    ? { dot: 0.44, orb: 0.62, word: 1.6, wordY: 2.35, bead: 0.34 }
    : { dot: 0.27, orb: 0.5, word: 1.05, wordY: 1.85, bead: 0.2 }
}

/* ------------------------------- disc --------------------------------- */

export interface DiscVis {
  opacity: (T: number) => number
  band?: (T: number) => number
  pit?: (T: number) => number
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
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={10} frustumCulled={false} />
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
  head?: boolean
}

/** The WELL circle (amber), the FIT circle (green) and the rim (chalk): the continuum's stations as rings. */
export function Circles({ vis }: { vis: CirclesVis }) {
  const well = useMemo(() => circlePoints(radiusOf(STOP_WELL)), [])
  const fit = useMemo(() => circlePoints(radiusOf(STOP_FIT)), [])
  const rim = useMemo(() => circlePoints(R), [])
  const hub = useMemo(() => circlePoints(radiusOf(0)), [])
  return (
    <>
      <Pen points={hub} color={PAL.sick} width={PEN.axis} progress={vis.progress} opacity={(T) => 0.8 * vis.opacity(T)} renderOrder={31} />
      <Pen points={rim} color={PAL.chalk} width={PEN.axis} progress={vis.progress} opacity={(T) => 0.8 * vis.opacity(T)} dim={() => 0.55} renderOrder={30} />
      <Pen points={fit} color={PAL.fit} width={PEN.axis} progress={vis.progress} opacity={(T) => 0.8 * vis.opacity(T)} head={vis.head} renderOrder={31} />
      <Pen points={well} color={PAL.well} width={PEN.axis} progress={vis.progress} opacity={(T) => 0.85 * vis.opacity(T)} head={vis.head} renderOrder={31} />
    </>
  )
}

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
      a.set([c.r, c.g, c.b], j * 3)
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
      p[j * 3 + 2] = bowl(r) + 0.02
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
      gain={() => 1.25}
      renderOrder={34}
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
  /** extra HDR gain on the orb and its word (the claim, the impact accent) */
  hot: (T: number) => number
  /** the orb's colour at T (LINEAR) */
  orbColor: (T: number, out: THREE.Color) => void
  /** opacity of state word k (STATES order) */
  word: (T: number, k: number) => number
  /** 0 (in the pit) .. 1 (risen in front of the dial) */
  wordLift: (T: number) => number
  /** WELL ghost outline (dashed), opacity */
  ghost?: (T: number) => number
  ghostPositions?: readonly number[]
  /** whole-person visibility */
  vis: (T: number) => number
  /** 0..1: the membrane inside the WELL circle steps aside (C6: the margin beyond wellness stays lit) */
  cut?: (T: number) => number
  /** spoke index to highlight (explore / key tap), or -1 */
  highlight?: () => number
}

const _col = new THREE.Color()
const _pt = [0, 0, 0]

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
  const orbMat = useMemo(() => makeRimStandard({ color: PAL.well, emissive: PAL.well, emissiveIntensity: 0.5, rim: PAL.chalk, rimStrength: 0.5, roughness: 0.3, metalness: 0.15 }), [])
  useEffect(() => () => orbGeo.dispose(), [orbGeo])
  useEffect(() => () => orbMat.dispose(), [orbMat])
  const orb = useRef<THREE.Mesh>(null)
  const orbZ = bowl(0) + S.orb * 0.9

  /* words */
  const words = useRef<(THREE.Group | null)[]>([])
  const group = useRef<THREE.Group>(null)

  useSafeFrame(
    site,
    (T) => {
      const v = src.vis(T)
      const g = group.current
      if (g) g.visible = v > 0.002
      if (v <= 0.002) return
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
      const f = src.fill(T) * v
      memMat.uniforms.uOpacity.value = f
      memMat.uniforms.uCut.value = src.cut ? src.cut(T) : 0
      if (memMesh.current) memMesh.current.visible = f > 0.002
      // orb
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
        orbMat.emissiveIntensity = 0.2 + 0.45 * on + 1.5 * src.hot(T)
      }
      // state words rise out of the pit
      const lift = src.wordLift(T)
      for (let w = 0; w < STATES.length; w++) {
        const wg = words.current[w]
        if (!wg) continue
        wg.position.set(0, 0.5 + (S.wordY - 0.5) * lift, bowl(0) + (0.55 - bowl(0)) * lift)
        const sc = 0.82 + 0.18 * lift
        wg.scale.set(sc, sc, 1)
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
    return src.dotScale(T, i) * src.vis(T) * (h === i ? 1.35 : 1)
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
          renderOrder={33}
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
        renderOrder={45}
        tint={(T, out) => {
          spectrumLinear(src.mean(T), out)
        }}
      />
      <TintDots site={site + ' dots'} count={N} radius={S.dot} place={dotPlace} tint={dotTint} rimStrength={0.55} emissiveIntensity={0.5} renderOrder={47} />
      <mesh ref={orb} geometry={orbGeo} material={orbMat} renderOrder={20} />
      <Halo
        position={[0, 0, orbZ + 0.2] as V3}
        sizePx={layout === 'P' ? 64 : 110}
        color={PAL.chalk}
        intensity={(T) => 0.16 * src.orb(T) * src.vis(T) + 0.55 * src.hot(T)}
      />
      {STATES.map((st, w) => (
        <group key={st.word} ref={(el) => void (words.current[w] = el)}>
          <SdfText
            font="anton"
            text={st.word}
            size={S.word}
            color={st.css}
            outline
            letterSpacing={0.02}
            opacity={(T) => src.word(T, w) * src.vis(T)}
            renderOrder={46}
          />
        </group>
      ))}
    </group>
  )
}
