import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL, spectrum } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { makeFillMaterial, makeSurfaceMaterial, type SurfaceUniforms } from '../../story/kit/materials'
import { AreaStrips } from '../../story/kit/Fill'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { NA, ND, PERIM, ageOfRow } from './healthMath'
import { PLANE_FRONT, PLANE_M, Z0, Z1, xOf, zOfAge, type World } from './layout'
import { HS } from './state'
import { waveW } from './timeline'

/* =========================================================================
   The health landscape (DESIGN.md D.7 "World", B.9 "Surface"):
     Surface   the 56 x 46 capacity grid, vertex-coloured by the sickness /
               wellness / fitness spectrum (spectrum(cap / 0.9)), isolines
               every 0.1 of capacity, the sick tint and hatch below the
               independence height; heights, colours and normals are
               rewritten only on the frames the grid changes (allocation
               free: a linear-light spectrum table and central differences).
     IsoGhost  the isoline-only duplicate (the pour's see-through surface,
               the L6 Sedentary ghost, the explore comparison).
     Walls     the volume's skirt: one translucent strip of light around the
               perimeter from the floor to min(level, surface), with an HDR
               rim at its top edge, so the pour rises as a line of light.
     Sheet     the top of the light while it pours: min(level, surface), a
               faint sheet whose waterline (where the level meets the
               landscape) glows hot.
     Plane     the independence plane: PAL.sick at 10% with a crisp pen edge.
   ========================================================================= */

const N = ND * NA

/** Linear-light spectrum table: vertex colours are linear, the PAL hexes are sRGB. */
const LUT = (() => {
  const t = new Float32Array(256 * 3)
  const c = new THREE.Color()
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = spectrum(i / 255)
    c.setRGB(r, g, b, THREE.SRGBColorSpace)
    t[i * 3] = c.r
    t[i * 3 + 1] = c.g
    t[i * 3 + 2] = c.b
  }
  return t
})()

/** Grid geometry (positions in x / z for this world, y = 0), shared index. */
function makeGridGeometry(W: World, withColor: boolean): THREE.BufferGeometry {
  const XW = W.XW
  const pos = new Float32Array(N * 3)
  const nrm = new Float32Array(N * 3)
  for (let ai = 0; ai < NA; ai++) {
    const z = zOfAge(ageOfRow(ai))
    for (let di = 0; di < ND; di++) {
      const i = ai * ND + di
      pos[i * 3] = xOf(di / (ND - 1), XW)
      pos[i * 3 + 2] = z
      nrm[i * 3 + 1] = 1
    }
  }
  const idx: number[] = []
  for (let a = 0; a < NA - 1; a++) {
    for (let d = 0; d < ND - 1; d++) {
      const i0 = a * ND + d
      const i1 = i0 + 1
      const i2 = i0 + ND
      const i3 = i2 + 1
      // counter-clockwise seen from above: the TOP is the front face, so the
      // upward heightfield normals are used as they are (a double-sided
      // material flips a back face's normal, which lit it from below)
      idx.push(i0, i1, i2, i1, i3, i2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setIndex(idx)
  const pa = new THREE.BufferAttribute(pos, 3)
  pa.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('position', pa)
  const na = new THREE.BufferAttribute(nrm, 3)
  na.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('normal', na)
  if (withColor) {
    const ca = new THREE.BufferAttribute(new Float32Array(N * 3), 3)
    ca.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('color', ca)
  }
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, W.YS / 2, 0), 30)
  return g
}

/** Heights, colours and heightfield normals from a capacity grid (in place). */
function writeGrid(g: THREE.BufferGeometry, grid: Float32Array, W: World, yOff = 0): void {
  const { XW, YS } = W
  const pa = g.attributes.position as THREE.BufferAttribute
  const na = g.attributes.normal as THREE.BufferAttribute
  const ca = g.attributes.color as THREE.BufferAttribute | undefined
  const p = pa.array as Float32Array
  const n = na.array as Float32Array
  const c = ca ? (ca.array as Float32Array) : null
  for (let i = 0; i < N; i++) {
    const v = grid[i]
    p[i * 3 + 1] = v * YS + yOff
    if (c) {
      const k = Math.max(0, Math.min(255, Math.round((v / 0.9) * 255))) * 3
      c[i * 3] = LUT[k]
      c[i * 3 + 1] = LUT[k + 1]
      c[i * 3 + 2] = LUT[k + 2]
    }
  }
  // normals of the heightfield y = h(x, z) by central differences
  const dx = (2 * XW) / (ND - 1)
  const dz = (Z1 - Z0) / (NA - 1)
  for (let ai = 0; ai < NA; ai++) {
    const a0 = ai > 0 ? ai - 1 : ai
    const a1 = ai < NA - 1 ? ai + 1 : ai
    for (let di = 0; di < ND; di++) {
      const d0 = di > 0 ? di - 1 : di
      const d1 = di < ND - 1 ? di + 1 : di
      const hx = ((grid[ai * ND + d1] - grid[ai * ND + d0]) * YS) / ((d1 - d0) * dx)
      const hz = ((grid[a1 * ND + di] - grid[a0 * ND + di]) * YS) / ((a1 - a0) * dz)
      const inv = 1 / Math.sqrt(hx * hx + 1 + hz * hz)
      const i = (ai * ND + di) * 3
      n[i] = -hx * inv
      n[i + 1] = inv
      n[i + 2] = -hz * inv
    }
  }
  pa.needsUpdate = true
  na.needsUpdate = true
  if (ca) ca.needsUpdate = true
}

/* ------------------------------- surface ------------------------------- */

/** a slightly rougher finish than a solid, so the key softbox never lies on the landscape as a grey sheen */
const SURFACE_ROUGH = 0.66
/** albedo lift so the spectrum reads at its true hue under the engine lights */
const SURFACE_GAIN = 1.15

export function Surface({ W }: { W: World }) {
  const geo = useMemo(() => makeGridGeometry(W, true), [W])
  const mat = useMemo(() => {
    return makeSurfaceMaterial({ yScale: W.YS, opacity: 1, isoAlpha: 0.22, hatchAlpha: 0.2, roughness: SURFACE_ROUGH })
  }, [W])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  const seen = useRef({ ver: -1, geo: null as THREE.BufferGeometry | null })
  useSafeFrame(
    'health surface',
    () => {
      const m = mesh.current
      if (!m) return
      const op = HS.surfOp
      m.visible = op > 0.004
      if (seen.current.ver !== HS.gridVer || seen.current.geo !== geo) {
        seen.current.ver = HS.gridVer
        seen.current.geo = geo
        writeGrid(geo, HS.grid, W)
      }
      if (!m.visible) return
      mat.opacity = op
      // while it fades, it must not hide what is drawn after it (the pour sheet, the ghost)
      mat.depthWrite = op > 0.97
      mat.color.setScalar(SURFACE_GAIN * HS.surfDim)
      const u = mat.userData.surface as SurfaceUniforms
      u.uIndep.value = HS.indepCap * W.YS
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={20} frustumCulled={false} />
}

/* ------------------------------ iso ghost ------------------------------ */

export function IsoGhost({ W }: { W: World }) {
  const geo = useMemo(() => makeGridGeometry(W, false), [W])
  const mat = useMemo(() => makeSurfaceMaterial({ yScale: W.YS, isolinesOnly: true, isoAlpha: 0.22 }), [W])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  const seen = useRef({ ver: -1, geo: null as THREE.BufferGeometry | null })
  useSafeFrame(
    'health iso ghost',
    () => {
      const m = mesh.current
      if (!m) return
      m.visible = HS.ghostOp > 0.004
      if (seen.current.ver !== HS.ghostVer || seen.current.geo !== geo) {
        seen.current.ver = HS.ghostVer
        seen.current.geo = geo
        writeGrid(geo, HS.ghost, W, 0.01)
      }
      mat.opacity = HS.ghostOp
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={21} frustumCulled={false} />
}

/* ------------------------------ perimeter ------------------------------ */

const PN = PERIM.length
const pxOf = (i: number, XW: number) => xOf((i % ND) / (ND - 1), XW)
const pzOf = (i: number) => zOfAge(ageOfRow(Math.floor(i / ND)))

/* -------------------------------- walls -------------------------------- */

const WALL_COLORS = [PAL.yellowGreen]

export function Walls({ W }: { W: World }) {
  const last = useRef('')
  const write = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const key = W.key + '|' + HS.gridVer + '|' + HS.level
    if (key === last.current) return false
    last.current = key
    const lv = HS.level
    for (let k = 0; k < PN; k++) {
      const i = PERIM[k]
      const v = HS.grid[i]
      top[k * 3] = pxOf(i, W.XW)
      top[k * 3 + 1] = Math.max(0, Math.min(lv, v)) * W.YS
      top[k * 3 + 2] = pzOf(i)
      bottom[k] = 0
    }
    return true
  }
  return (
    <AreaStrips
      strips={1}
      points={PN}
      colors={WALL_COLORS}
      write={write}
      opacity={() => HS.wallsOp}
      lo={0.015}
      hi={0.17}
      gamma={1.8}
      additive
      rim={() => HS.wallRim}
      rimWidth={0.22}
      rimAlpha={0.62}
      renderOrder={12}
    />
  )
}

/* ------------------------------ below line ------------------------------ */

const SICK_COLORS = [PAL.sick]

/**
 * The part of the volume under the independence line, tinted PAL.sick on the
 * walls with a crisp red rim at the line: the plane cuts the solid, and the
 * layer daily tasks need is visible all the way round (L3 on).
 */
export function BelowLine({ W }: { W: World }) {
  const last = useRef('')
  const write = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const key = W.key + '|' + HS.gridVer + '|' + HS.planeCap
    if (key === last.current) return false
    last.current = key
    for (let k = 0; k < PN; k++) {
      const i = PERIM[k]
      top[k * 3] = pxOf(i, W.XW)
      top[k * 3 + 1] = Math.min(HS.planeCap, HS.grid[i]) * W.YS
      top[k * 3 + 2] = pzOf(i)
      bottom[k] = 0
    }
    return true
  }
  return (
    <AreaStrips
      strips={1}
      points={PN}
      colors={SICK_COLORS}
      write={write}
      opacity={() => HS.planeOp * HS.wallsOp}
      lo={0.1}
      hi={0.26}
      gamma={1.4}
      rim={() => 1.1}
      rimWidth={0.08}
      rimAlpha={0.7}
      renderOrder={13}
    />
  )
}

/* -------------------------------- sheet -------------------------------- */

/**
 * A sheet of light on the landscape, in two roles:
 *   L2 the pour: the top of the volume filled to the level, min(level,
 *      surface); its alpha rises toward the waterline (aT is the closeness
 *      to it) and the kit fill's rim band makes the waterline HDR;
 *   L5 the wave: it lies on the surface and lights the band that is
 *      lifting right now (4 w (1 - w) of the scanner's weight) plus a wake
 *      that cools over the eight years behind the scanner, so the landscape
 *      glows where it has just risen.
 */
export function Sheet({ W }: { W: World }) {
  const geo = useMemo(() => {
    const g = makeGridGeometry(W, false)
    g.deleteAttribute('normal')
    const aT = new THREE.BufferAttribute(new Float32Array(N), 1)
    aT.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aT', aT)
    g.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(N), 1))
    g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(N).fill(1), 1))
    return g
  }, [W])
  const mat = useMemo(() => {
    const m = makeFillMaterial(PAL.yellowGreen, 'gradient', { additive: true })
    m.uniforms.uLo.value = 0.05
    m.uniforms.uHi.value = 0.4
    m.uniforms.uPow.value = 2.5
    m.uniforms.uRim.value = 2.6
    m.uniforms.uRimW.value = 0.09
    m.uniforms.uRimA.value = 0.6
    return m
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  const seen = useRef('')
  useSafeFrame(
    'health pour sheet',
    () => {
      const m = mesh.current
      if (!m) return
      m.visible = HS.sheetOp > 0.004
      if (!m.visible) return
      mat.uniforms.uOpacity.value = HS.sheetOp
      mat.uniforms.uLo.value = HS.sheetMode === 1 ? 0 : 0.05
      const wave = HS.sheetMode === 1
      const key = W.key + '|' + HS.gridVer + '|' + (wave ? 'w' + HS.wavePre + '|' + HS.waveS : HS.level)
      if (key === seen.current) return
      seen.current = key
      const lv = wave ? 2 : Math.max(0, HS.level)
      const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array
      const t = (geo.attributes.aT as THREE.BufferAttribute).array as Float32Array
      for (let ai = 0; ai < NA; ai++) {
        const age = ageOfRow(ai)
        const bw = wave ? waveW(age, HS.wavePre, HS.waveS) : 0
        const wake = wave && age < HS.waveS ? bw * Math.max(0, 1 - (HS.waveS - age) / 8) : 0
        const band = Math.max(4 * bw * (1 - bw), 0.75 * wake)
        for (let di = 0; di < ND; di++) {
          const i = ai * ND + di
          const v = HS.grid[i]
          p[i * 3 + 1] = Math.min(lv, v) * W.YS + (wave ? 0.03 : 0.012)
          // the pour: closeness to the waterline, over about a third of a world unit
          t[i] = wave ? band : 1 - Math.min(1, (Math.abs(v - lv) * W.YS) / 0.36)
        }
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.aT.needsUpdate = true
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={13} frustumCulled={false} />
}

/* ---------------------------- ghost outline ---------------------------- */

/** The ghost's footprint edge as a dashed chalk outline (a comparison, L8). */
export function GhostOutline({ W }: { W: World }) {
  const pts = useMemo(() => new Float32Array(PN * 3), [])
  const last = useRef('')
  const update = (_T: number, p: Float32Array): boolean => {
    const key = W.key + '|' + HS.ghostVer
    if (key === last.current) return false
    last.current = key
    for (let k = 0; k < PN; k++) {
      const i = PERIM[k]
      p[k * 3] = pxOf(i, W.XW)
      p[k * 3 + 1] = HS.ghost[i] * W.YS + 0.02
      p[k * 3 + 2] = pzOf(i)
    }
    return true
  }
  return (
    <Pen
      points={pts}
      update={update}
      color={PAL.chalk}
      width={PEN.axis}
      dashed
      dashSize={0.32}
      gapSize={0.22}
      opacity={() => 0.85 * HS.outlineOp}
      renderOrder={31}
    />
  )
}

/* ---------------------------- solid outline ---------------------------- */

/**
 * The solid's crisp edges (L10): the landscape's rim all the way round, and
 * the three vertical corner edges (the fourth, front-left, is the capacity
 * post). With them the fused surface reads as the top of a SOLID, not as a
 * sheet floating over the floor frame.
 */
export function SolidOutline({ W }: { W: World }) {
  // rim: PN - 1 segments; corners: 3 segments
  const segs = useMemo(() => new Float32Array((PN - 1 + 3) * 6), [])
  const last = useRef('')
  const update = (_T: number, s: Float32Array): boolean => {
    const key = W.key + '|' + HS.gridVer
    if (key === last.current) return false
    last.current = key
    for (let k = 0; k < PN - 1; k++) {
      const a = PERIM[k]
      const b = PERIM[k + 1]
      const o = k * 6
      s[o] = pxOf(a, W.XW)
      s[o + 1] = HS.grid[a] * W.YS + 0.03
      s[o + 2] = pzOf(a)
      s[o + 3] = pxOf(b, W.XW)
      s[o + 4] = HS.grid[b] * W.YS + 0.03
      s[o + 5] = pzOf(b)
    }
    const corners = [ND - 1, NA * ND - 1, (NA - 1) * ND]
    corners.forEach((i, c) => {
      const o = (PN - 1 + c) * 6
      s[o] = s[o + 3] = pxOf(i, W.XW)
      s[o + 2] = s[o + 5] = pzOf(i)
      s[o + 1] = 0
      s[o + 4] = HS.grid[i] * W.YS + 0.03
    })
    return true
  }
  return <PenBatch segments={segs} color={PAL.chalk} width={PEN.axis} update={update} opacity={() => 0.55 * HS.edgeOp} renderOrder={31} />
}

/* ------------------------ the independence plane ------------------------ */

/** Subdivided straight line a -> b (on the floor plane; y is lifted later) as xyz points. */
function linePts(ax: number, az: number, bx: number, bz: number, k: number): Float32Array {
  const out = new Float32Array((k + 1) * 3)
  for (let i = 0; i <= k; i++) {
    out[i * 3] = ax + ((bx - ax) * i) / k
    out[i * 3 + 2] = az + ((bz - az) * i) / k
  }
  return out
}

/**
 * PAL.sick at 6.5% at the independence height (D.7 says 10%; over the red
 * below-line tint 10% smothered the sunken landscape), reaching a little past the
 * footprint at the sides and the back. Its front edge lies on the volume's
 * front face (a front margin would cross the duration ticks), drawn as the
 * crisp hot pen the claim needs (L10); the other three edges follow thinner.
 */
export function IndependencePlane({ W }: { W: World }) {
  const zf = Z0 + PLANE_FRONT
  const zb = Z1 - PLANE_M
  const x0 = -W.XW - PLANE_M
  const x1 = W.XW + PLANE_M
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(x1 - x0, zf - zb)
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, (zf + zb) / 2)
    return g
  }, [x0, x1, zf, zb])
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: PAL.sick, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    [],
  )
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  useSafeFrame(
    'health plane',
    () => {
      const m = mesh.current
      if (!m) return
      m.visible = HS.planeOp > 0.004
      m.position.y = HS.planeCap * W.YS
      mat.opacity = 0.065 * HS.planeOp
    },
    { hide: mesh },
  )
  const front = useMemo(() => linePts(x0, zf, x1, zf, 40), [x0, x1, zf])
  const rest = useMemo(() => {
    const a = linePts(x1, zf, x1, zb, 30)
    const b = linePts(x1, zb, x0, zb, 30)
    const c = linePts(x0, zb, x0, zf, 30)
    const out = new Float32Array(a.length + b.length + c.length - 6)
    out.set(a, 0)
    out.set(b.subarray(3), a.length)
    out.set(c.subarray(3), a.length + b.length - 3)
    return out
  }, [x0, x1, zf, zb])
  const lastF = useRef('')
  const lastR = useRef('')
  const lift = (p: Float32Array, last: { current: string }): boolean => {
    const y = HS.planeCap * W.YS + 0.015
    const key = W.key + '|' + y
    if (key === last.current) return false
    last.current = key
    for (let i = 1; i < p.length; i += 3) p[i] = y
    return true
  }
  return (
    <>
      <mesh ref={mesh} geometry={geo} material={mat} renderOrder={22} frustumCulled={false} />
      <Pen
        points={front}
        update={(_T, p) => lift(p, lastF)}
        color={PAL.sick}
        width={PEN.data}
        progress={() => Math.min(1, HS.edge / 0.6)}
        opacity={() => Math.min(1, HS.planeOp * 1.5) * (0.4 + 0.6 * HS.planeFrame)}
        head
        hot
        renderOrder={32}
      />
      <Pen
        points={rest}
        update={(_T, p) => lift(p, lastR)}
        color={PAL.sick}
        width={PEN.axis}
        progress={() => Math.max(0, (HS.edge - 0.55) / 0.45)}
        opacity={() => 0.7 * Math.min(1, HS.planeOp * 1.5) * HS.planeFrame}
        renderOrder={32}
      />
    </>
  )
}
