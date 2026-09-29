import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { PAL, spectrum } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { makeFillMaterial, makePenMaterial, makeSurfaceMaterial, type SurfaceUniforms } from '../../story/kit/materials'
import { AreaStrips } from '../../story/kit/Fill'
import { PenBatch, PEN } from '../../story/kit/Pen'
import { NA, ND, PERIM, ageOfRow } from './healthMath'
import { PLANE_FRONT, PLANE_M, PLANE_MR, RIDGE_COLOR, Z0, Z1, xOf, zOfAge, type World } from './layout'
import { HS } from './state'
import { waveW } from './timeline'

/* =========================================================================
   The health landscape (DESIGN.md D.7 "World", B.9 "Surface"):
     Surface   the 56 x 46 capacity grid, vertex-coloured by the sickness /
               wellness / fitness spectrum (spectrum(cap / 0.9)), isolines
               every 0.1 of capacity, a quiet sick tint below the
               independence height, and a fresnel sheen at grazing angles;
               heights, colours and normals are rewritten only on the frames
               the grid changes (allocation free).
     IsoGhost  the isoline-only duplicate (the pour's see-through surface,
               the explore comparison).
     Walls     the volume's skirt: translucent light from the floor to
               min(level, surface), brightest under the rim, so the volume
               reads as a body of light (A.1: the amount of light is the
               amount); its HDR rim rises with the pour.
     Glow      the light the volume spills onto the slate around its base,
               in proportion to the volume shown.
     Outline   the ghost landscape as a dashed chalk outline with an x-ray
               pass (L4 what was lost; L5 and L6 the Sedentary before).
     Reclaim   the capacity the lift gave back, as a band of light on the
               walls between before and after (L5).
     Plane     the independence plane: PAL.sick with a crisp pen edge.
   There is no drawn contour where the landscape meets the plane: that is a
   computed crossing, and F.5 keeps independence a profile's property, shown
   only as text.
   ========================================================================= */

const N = ND * NA
/** far outside every view: where a segment waits before it is needed (never a zero-length dot) */
const AWAY = 1e5

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
const SURFACE_ROUGH = 0.62
/** albedo lift so the spectrum reads at its true hue under the engine lights */
const SURFACE_GAIN = 1.15
/** isolines strong enough to read at phone scale (B.9 default 0.18) */
const ISO_A = 0.36
/**
 * Below the independence height: a quiet tint and a sparse hatch. Round 1
 * flooded a sunken landscape with red and warning-tape stripes; the plane,
 * its crisp contour pen and the tint now carry "below the line" while the
 * shading and isolines stay readable underneath.
 */
const SICK_MIX = 0.36
const HATCH_A = 0.075

/**
 * A fresnel sheen on the kit surface material (engine request: a `sheen`
 * option on makeSurfaceMaterial). Chained onto the kit's own shader edit, so
 * the kit material is extended, never copied: grazing angles pick up a cool
 * highlight, which gives the lid the finish of a lit glaze instead of paint.
 */
function addSheen(m: THREE.MeshStandardMaterial, k: number): void {
  const base = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    base.call(m, shader, renderer)
    shader.uniforms.uSheen = { value: k }
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uSheen;' + NL + 'void main() {')
      .replace(
        '#include <opaque_fragment>',
        [
          'float stFr = pow( 1.0 - clamp( abs( dot( normal, geometryViewDir ) ), 0.0, 1.0 ), 3.0 );',
          'outgoingLight += ( outgoingLight * 0.9 + vec3( 0.05, 0.06, 0.07 ) ) * stFr * uSheen;',
          '#include <opaque_fragment>',
        ].join(NL),
      )
  }
  const key = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => key() + '-health-sheen'
}
const NL = String.fromCharCode(10)

export function Surface({ W }: { W: World }) {
  const geo = useMemo(() => makeGridGeometry(W, true), [W])
  const mat = useMemo(() => {
    const m = makeSurfaceMaterial({ yScale: W.YS, opacity: 1, isoAlpha: ISO_A, hatchAlpha: HATCH_A, sickMix: SICK_MIX, roughness: SURFACE_ROUGH })
    addSheen(m, 0.9)
    return m
  }, [W])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  const seen = useRef({ ver: -1, geo: null as THREE.BufferGeometry | null, tint: -1, g: -1 })
  useSafeFrame(
    'health surface',
    () => {
      const m = mesh.current
      if (!m) return
      const op = HS.surfOp
      m.visible = op > 0.004
      // L5: the capacity the lift reclaims is lit #91C640 on the surface itself
      // (quantised, so a held frame and a ramp frame agree; rewritten only when it changes)
      const tint = Math.round(HS.reclaimWalls * 40) / 40
      const sv = seen.current
      if (sv.ver !== HS.gridVer || sv.geo !== geo || sv.tint !== tint || (tint > 0 && sv.g !== HS.ghostVer)) {
        sv.ver = HS.gridVer
        sv.geo = geo
        sv.tint = tint
        sv.g = HS.ghostVer
        writeGrid(geo, HS.grid, W)
        if (tint > 0) tintReclaimed(geo, HS.grid, HS.ghost, tint)
      }
      if (!m.visible) return
      mat.opacity = op
      // while it fades, it must not hide what is drawn after it (the pour sheet, the ghost)
      mat.depthWrite = op > 0.97
      mat.color.setScalar(SURFACE_GAIN * HS.surfDim)
      const u = mat.userData.surface as SurfaceUniforms
      u.uIndep.value = HS.indepCap * W.YS
      u.uHatchA.value = HATCH_A * HS.hatch
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={20} frustumCulled={false} />
}

/** how far the reclaimed capacity leans toward #91C640 at full strength */
const RECLAIM_TINT = 0.78
const GREEN_TINT = new THREE.Color(PAL.yellowGreen)

/**
 * L5 (fix round 1): where the displayed surface stands above the Sedentary
 * ghost (the capacity the lift gave back), its colour leans toward #91C640,
 * the colour that means fitness here, in proportion to the lift (full from
 * 0.12 of capacity), so the recovery is the brightest, greenest part of the
 * frame and the red of the sedentary years stays only where the surface is
 * still low. Vertex colours are linear, like GREEN_TINT. Allocation free.
 */
function tintReclaimed(g: THREE.BufferGeometry, grid: Float32Array, ghost: Float32Array, k: number): void {
  const ca = g.attributes.color as THREE.BufferAttribute | undefined
  if (!ca) return
  const c = ca.array as Float32Array
  const gr = GREEN_TINT.r
  const gg = GREEN_TINT.g
  const gb = GREEN_TINT.b
  for (let i = 0; i < N; i++) {
    const lift = grid[i] - ghost[i]
    if (lift <= 0.01) continue
    const u = Math.min(1, (lift - 0.01) / 0.11)
    const w = u * u * (3 - 2 * u) * k * RECLAIM_TINT
    c[i * 3] += (gr - c[i * 3]) * w
    c[i * 3 + 1] += (gg - c[i * 3 + 1]) * w
    c[i * 3 + 2] += (gb - c[i * 3 + 2]) * w
  }
  ca.needsUpdate = true
}

/* ------------------------------ iso ghost ------------------------------ */

/**
 * Isolines only: the see-through surface while the volume pours (L2, the
 * ghost grid), the glass lid over the reclaimed light (L5, the displayed
 * grid), and the explore comparison (the Lifelong ghost).
 */
export function IsoGhost({ W }: { W: World }) {
  const geo = useMemo(() => makeGridGeometry(W, false), [W])
  const mat = useMemo(() => makeSurfaceMaterial({ yScale: W.YS, isolinesOnly: true, isoAlpha: 0.26 }), [W])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  const seen = useRef({ ver: -1, grid: false, geo: null as THREE.BufferGeometry | null })
  useSafeFrame(
    'health iso ghost',
    () => {
      const m = mesh.current
      if (!m) return
      m.visible = HS.ghostOp > 0.004
      const ofGrid = HS.isoOfGrid
      const ver = ofGrid ? HS.gridVer : HS.ghostVer
      const s = seen.current
      if (s.ver !== ver || s.grid !== ofGrid || s.geo !== geo) {
        s.ver = ver
        s.grid = ofGrid
        s.geo = geo
        writeGrid(geo, ofGrid ? HS.grid : HS.ghost, W, 0.01)
      }
      mat.opacity = HS.ghostOp
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={21} frustumCulled={false} />
}

/* ---------------------------- before surface ---------------------------- */

/** the before is dim: it is what the lift left behind */
const BEFORE_GAIN = 0.34
/** #91C640 in linear light (vertex colours are linear) */
const GREEN_LIN = new THREE.Color(PAL.yellowGreen)

/**
 * L5: the Sedentary landscape (the ghost grid) as a dim solid under the
 * glass lid, the before the lift is measured from. Opaque, a hair under the
 * displayed surface, so where nothing has lifted yet the lid covers it
 * exactly; it shows only once the lid is glass.
 */
export function BeforeSurface({ W }: { W: World }) {
  const geo = useMemo(() => makeGridGeometry(W, true), [W])
  const mat = useMemo(() => {
    const m = makeSurfaceMaterial({ yScale: W.YS, isoAlpha: ISO_A * 0.7, hatchAlpha: HATCH_A * 0.6, sickMix: SICK_MIX, roughness: SURFACE_ROUGH })
    m.color.setScalar(BEFORE_GAIN)
    return m
  }, [W])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  const seen = useRef({ ver: -1, geo: null as THREE.BufferGeometry | null })
  useSafeFrame(
    'health before surface',
    () => {
      const m = mesh.current
      if (!m) return
      m.visible = HS.glass > 0.002
      if (!m.visible) return
      if (seen.current.ver !== HS.ghostVer || seen.current.geo !== geo) {
        seen.current.ver = HS.ghostVer
        seen.current.geo = geo
        writeGrid(geo, HS.ghost, W, -0.03)
      }
      ;(mat.userData.surface as SurfaceUniforms).uIndep.value = HS.indepCap * W.YS - 0.03
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={19} frustumCulled={false} />
}

/* ------------------------------ perimeter ------------------------------ */

const PN = PERIM.length
const pxOf = (i: number, XW: number) => xOf((i % ND) / (ND - 1), XW)
const pzOf = (i: number) => zOfAge(ageOfRow(Math.floor(i / ND)))
/** grid indices of the four corners: front-left, front-right, back-right, back-left */
const CORNERS = [0, ND - 1, NA * ND - 1, (NA - 1) * ND] as const

/* -------------------------------- walls -------------------------------- */

const WALL_COLORS = [PAL.yellowGreen]

export function Walls({ W }: { W: World }) {
  const last = useRef({ w: -1, ver: -1, lv: NaN })
  const write = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const l = last.current
    if (l.w === W.id && l.ver === HS.gridVer && l.lv === HS.level) return false
    l.w = W.id
    l.ver = HS.gridVer
    l.lv = HS.level
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
      lo={0.01}
      hi={0.26}
      gamma={1.6}
      additive
      rim={() => HS.wallRim}
      rimWidth={0.45}
      rimAlpha={0.7}
      renderOrder={12}
    />
  )
}

/* ------------------------------ below line ------------------------------ */

const SICK_COLORS = [PAL.sick]

/**
 * The part of the walls under the independence line: a faint additive red
 * with a crisp red rim at the line, so the plane visibly cuts the solid all
 * the way round (L3 on). Quiet on purpose: under a sunken landscape nearly
 * all of the wall is below the line, and a strong tint read as "dependent at
 * every age" (see the F.5 note in the chapter report).
 */
export function BelowLine({ W }: { W: World }) {
  const last = useRef({ w: -1, ver: -1, cap: NaN })
  const write = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const l = last.current
    if (l.w === W.id && l.ver === HS.gridVer && l.cap === HS.planeCap) return false
    l.w = W.id
    l.ver = HS.gridVer
    l.cap = HS.planeCap
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
      lo={0.02}
      hi={0.11}
      gamma={1.2}
      additive
      rim={() => 1.4}
      rimWidth={0.07}
      rimAlpha={0.75}
      renderOrder={13}
    />
  )
}

/* ------------------------------ floor glow ------------------------------ */

/** how far the glow spills past the footprint, world units */
const GLOW_M = 3.2
const GLOW_NX = 14
const GLOW_NZ = 22

/**
 * The light the volume spills onto the slate around its base (a soft pool,
 * brightest at the foot of the walls), scaled by the volume shown: the
 * sunken Sedentary landscape spills little, the lifelong one a lot. It
 * grounds the solid on the slate without a shadow map.
 */
export function FloorGlow({ W }: { W: World }) {
  const geo = useMemo(() => {
    const nx = GLOW_NX
    const nz = GLOW_NZ
    const x0 = -W.XW - GLOW_M
    const x1 = W.XW + GLOW_M
    const z0 = Z1 - GLOW_M
    const z1 = Z0 + GLOW_M
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3)
    const aT = new Float32Array((nx + 1) * (nz + 1))
    const idx: number[] = []
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i
        const x = x0 + ((x1 - x0) * i) / nx
        const z = z0 + ((z1 - z0) * j) / nz
        pos[k * 3] = x
        pos[k * 3 + 1] = 0.005
        pos[k * 3 + 2] = z
        const ox = Math.max(0, Math.abs(x) - W.XW)
        const oz = Math.max(0, z - Z0, Z1 - z)
        const d = Math.hypot(ox, oz)
        aT[k] = d <= 0 ? 0.55 : Math.exp(-d / 1.1)
        if (i < nx && j < nz) idx.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2)
      }
    }
    // the walls' foot is the brightest line: pull the vertices on the footprint edge to 1
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i
        const x = pos[k * 3]
        const z = pos[k * 3 + 2]
        const onX = Math.abs(Math.abs(x) - W.XW) < (x1 - x0) / nx / 2 && z <= Z0 + 0.01 && z >= Z1 - 0.01
        const onZ = (Math.abs(z - Z0) < (z1 - z0) / nz / 2 || Math.abs(z - Z1) < (z1 - z0) / nz / 2) && Math.abs(x) <= W.XW + 0.01
        if (onX || onZ) aT[k] = 1
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
    g.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(aT.length), 1))
    g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(aT.length).fill(1), 1))
    g.setIndex(idx)
    return g
  }, [W])
  const mat = useMemo(() => {
    const m = makeFillMaterial(PAL.yellowGreen, 'gradient', { additive: true })
    m.uniforms.uLo.value = 0
    m.uniforms.uHi.value = 0.1
    m.uniforms.uPow.value = 1.6
    return m
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  useSafeFrame(
    'health floor glow',
    () => {
      const m = mesh.current
      if (!m) return
      const op = HS.wallsOp * Math.min(1, HS.volK)
      m.visible = op > 0.004
      mat.uniforms.uOpacity.value = op
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={6} frustumCulled={false} />
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
 *      glows where it has just risen; once the sweep lands, a resting glow
 *      in proportion to the capacity reclaimed there (lifted minus
 *      Sedentary), so the finished frame shows where the lift happened.
 */
/** the lift that glows at full strength (capacity units; the largest reclaimed is about 0.3) */
const LIFT_FULL = 0.26
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
  const seen = useRef({ geo: null as THREE.BufferGeometry | null, ver: -1, mode: -1, s: NaN, lv: NaN, rest: NaN, g: -1 })
  useSafeFrame(
    'health pour sheet',
    () => {
      const m = mesh.current
      if (!m) return
      m.visible = HS.sheetOp > 0.004
      if (!m.visible) return
      const wave = HS.sheetMode === 1
      mat.uniforms.uOpacity.value = HS.sheetOp
      mat.uniforms.uLo.value = wave ? 0 : 0.05
      // the wave: alpha close to linear in the capacity reclaimed (the light is the amount); the pour: gathered at the waterline
      mat.uniforms.uPow.value = wave ? 1.1 : 2.5
      mat.uniforms.uHi.value = wave ? 0.6 : 0.4
      const k = seen.current
      if (k.geo === geo && k.ver === HS.gridVer && k.mode === HS.sheetMode && k.s === HS.waveS && k.lv === HS.level && k.rest === HS.reclaimWalls && k.g === HS.ghostVer) return
      k.geo = geo
      k.ver = HS.gridVer
      k.mode = HS.sheetMode
      k.s = HS.waveS
      k.lv = HS.level
      k.rest = HS.reclaimWalls
      k.g = HS.ghostVer
      const fill = wave ? HS.reclaimWalls : 0
      const lv = wave ? 2 : Math.max(0, HS.level)
      const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array
      const t = (geo.attributes.aT as THREE.BufferAttribute).array as Float32Array
      for (let ai = 0; ai < NA; ai++) {
        const age = ageOfRow(ai)
        const bw = wave ? waveW(age, HS.waveS) : 0
        // hot in the scanner's wake: over the eight years behind it the fresh light cools to its resting glow
        const wake = wave && age < HS.waveS ? Math.max(0, 1 - (HS.waveS - age) / 8) : 0
        const bow = 4 * bw * (1 - bw)
        for (let di = 0; di < ND; di++) {
          const i = ai * ND + di
          const v = HS.grid[i]
          p[i * 3 + 1] = Math.min(lv, v) * W.YS + (wave ? 0.03 : 0.012)
          if (wave) {
            // the reclaimed light: in proportion to the capacity the lift gave back here
            const lift = Math.min(1, Math.max(0, v - HS.ghost[i]) / LIFT_FULL)
            t[i] = Math.max(bow * Math.max(0.35, lift), fill * lift * (0.7 + 0.25 * wake))
          } else {
            // the pour: closeness to the waterline, over about a third of a world unit
            t[i] = 1 - Math.min(1, (Math.abs(v - lv) * W.YS) / 0.36)
          }
        }
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.aT.needsUpdate = true
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={25} frustumCulled={false} />
}

/* ---------------------------- ghost outline ---------------------------- */

/**
 * Unit view directions (target toward camera) the dash rhythm is measured
 * in: the story's phone poses on the narrow world, its desktop poses on the
 * wide one. A dash measured in world units along the line turned to dots on
 * every edge running into depth (the age sides foreshorten by about half at
 * el 32); measured across this direction, a dash keeps about the same
 * length on screen whichever way its edge runs. The direction is fixed per
 * world, not the live camera, so the rhythm never crawls during a move and
 * a deep link lays it out exactly as a scrub does.
 */
const viewDir = (az: number, el: number): [number, number, number] => {
  const a = (az * Math.PI) / 180
  const e = (el * Math.PI) / 180
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]
}
const DASH_VIEW = { narrow: viewDir(18, 32), wide: viewDir(34, 28) }
/** dash and gap, world units measured across the view */
const DASH = 0.36
const GAP = 0.26
const MAX_DASHES = 900

/** length of segment o (a -> b) seen across the view direction d */
function viewLen(s: Float32Array, o: number, d: readonly number[]): number {
  const vx = s[o + 3] - s[o]
  const vy = s[o + 4] - s[o + 1]
  const vz = s[o + 5] - s[o + 2]
  const along = vx * d[0] + vy * d[1] + vz * d[2]
  return Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - along * along))
}

/**
 * Chains of source segments (consecutive segments that share an endpoint)
 * into dash segments: each dash is ONE straight segment (a chord of its
 * stretch of the chain), so no two segments of a translucent dash overlap
 * and show their round caps as beads. The pattern is centred on each chain,
 * so a short edge (a corner post) always shows a dash. Allocation free.
 * Returns the number of dashes written.
 */
function dashify(src: Float32Array, nSeg: number, d: readonly number[], lens: Float32Array, out: Float32Array): number {
  const P = DASH + GAP
  let n = 0
  let i = 0
  while (i < nSeg && n < MAX_DASHES) {
    // the chain i..j
    let j = i
    lens[i] = viewLen(src, i * 6, d)
    let total = lens[i]
    while (j + 1 < nSeg) {
      const o = j * 6
      const q = (j + 1) * 6
      if (src[o + 3] !== src[q] || src[o + 4] !== src[q + 1] || src[o + 5] !== src[q + 2]) break
      j++
      lens[j] = viewLen(src, q, d)
      total += lens[j]
    }
    const k = Math.floor((total + GAP) / P)
    const lead = k > 0 ? (total - (k * P - GAP)) / 2 : 0
    const dashes = Math.max(1, k)
    // walk the chain with a cursor: segment c, the arc where it starts
    let c = i
    let acc = 0
    for (let m = 0; m < dashes && n < MAX_DASHES; m++) {
      const a = k > 0 ? lead + m * P : 0
      const b = k > 0 ? a + DASH : total
      for (let e = 0; e < 2; e++) {
        const s = e === 0 ? a : b
        while (c < j && acc + lens[c] < s) {
          acc += lens[c]
          c++
        }
        const o = c * 6
        const f = lens[c] > 1e-6 ? Math.min(1, Math.max(0, (s - acc) / lens[c])) : 0
        const w = n * 6 + e * 3
        out[w] = src[o] + (src[o + 3] - src[o]) * f
        out[w + 1] = src[o + 1] + (src[o + 4] - src[o + 1]) * f
        out[w + 2] = src[o + 2] + (src[o + 5] - src[o + 2]) * f
      }
      n++
    }
    i = j + 1
  }
  return n
}

/**
 * The ghost landscape as a dashed chalk outline (a comparison, L8): its rim
 * all the way round, and where it stands ABOVE the landscape shown (L4: the
 * Lifelong landscape the surface sank from) its four corner posts down to
 * the surface, so what was lost reads as a box above the slab.
 *
 * From L5 it is also an X-RAY: a second pass without the depth test draws
 * the edges the solid hides at a lower alpha. The Sedentary rim lies under
 * the lifted landscape, and its hidden edges (the power ridge and age 85)
 * are exactly where most capacity is reclaimed, so the gap between before
 * and after reads where the lift happened, not only on the front and the
 * 1 hr edges, where the two almost coincide.
 */
export function GhostOutline({ W }: { W: World }) {
  const src = useMemo(() => new Float32Array((PN - 1 + 4) * 6), [])
  const lens = useMemo(() => new Float32Array(PN - 1 + 4), [])
  const core = useMemo(() => {
    const buf = new Float32Array(MAX_DASHES * 6).fill(AWAY)
    const geo = new LineSegmentsGeometry()
    geo.setPositions(buf)
    const ib = (geo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer
    ib.setUsage(THREE.DynamicDrawUsage)
    // the pen material's tail-glow attribute (no head here: constant)
    const arc = new THREE.InstancedInterleavedBuffer(new Float32Array(MAX_DASHES * 2).fill(1), 2, 1)
    geo.setAttribute('instanceArc', new THREE.InterleavedBufferAttribute(arc, 2, 0))
    geo.instanceCount = 0
    const front = makePenMaterial({ color: PAL.chalk, width: PEN.axis })
    const back = makePenMaterial({ color: PAL.chalk, width: PEN.axis })
    back.depthTest = false
    const lineFront = new LineSegments2(geo, front)
    const lineBack = new LineSegments2(geo, back)
    lineFront.frustumCulled = false
    lineBack.frustumCulled = false
    lineFront.renderOrder = 31
    lineBack.renderOrder = 30
    return { buf, geo, ib, front, back, lineFront, lineBack }
  }, [])
  useEffect(
    () => () => {
      core.geo.dispose()
      core.front.dispose()
      core.back.dispose()
    },
    [core],
  )
  const hide = useMemo(() => ({ current: core.lineFront as THREE.Object3D }), [core])
  const last = useRef({ w: -1, g: -1, s: -1 })
  useSafeFrame(
    'health ghost outline',
    () => {
      const op = HS.outlineOp
      core.lineFront.visible = op > 0.004
      core.lineBack.visible = op * HS.xray > 0.004
      if (!core.lineFront.visible) return
      core.front.opacity = 0.85 * op
      core.back.opacity = 0.42 * op * HS.xray
      const l = last.current
      if (l.w === W.id && l.g === HS.ghostVer && l.s === HS.gridVer) return
      l.w = W.id
      l.g = HS.ghostVer
      l.s = HS.gridVer
      const s = src
      for (let k = 0; k < PN - 1; k++) {
        const a = PERIM[k]
        const b = PERIM[k + 1]
        const o = k * 6
        s[o] = pxOf(a, W.XW)
        s[o + 1] = HS.ghost[a] * W.YS + 0.02
        s[o + 2] = pzOf(a)
        s[o + 3] = pxOf(b, W.XW)
        s[o + 4] = HS.ghost[b] * W.YS + 0.02
        s[o + 5] = pzOf(b)
      }
      let nSeg = PN - 1
      for (let c = 0; c < 4; c++) {
        const i = CORNERS[c]
        const top = HS.ghost[i] * W.YS
        const bot = HS.grid[i] * W.YS
        if (top - bot < 0.15) continue
        const o = nSeg * 6
        // top down, so the post's dash pattern hangs from the rim
        s[o] = pxOf(i, W.XW)
        s[o + 3] = s[o]
        s[o + 2] = pzOf(i)
        s[o + 5] = s[o + 2]
        s[o + 1] = top + 0.02
        s[o + 4] = bot + 0.03
        nSeg++
      }
      const n = dashify(s, nSeg, DASH_VIEW[W.key], lens, core.buf)
      core.buf.fill(AWAY, n * 6)
      core.geo.instanceCount = n
      core.ib.needsUpdate = true
    },
    { hide },
  )
  return (
    <>
      <primitive object={core.lineBack} />
      <primitive object={core.lineFront} />
    </>
  )
}

/* ---------------------------- reclaimed band ---------------------------- */

/**
 * The capacity the lift gave back, as light (L5, A.3): all the way round
 * the walls, the band between the Sedentary landscape (the dashed ghost,
 * before) and the lifted one (after), wherever the lift is positive. It is
 * an x-ray like the ghost's hidden edges (no depth test, additive), because
 * most of the lift is on the two walls the solid hides from the camera: the
 * power ridge and age 85. From the camera the lifted part of the landscape
 * then stands on a cushion of green light whose thickness is the capacity
 * reclaimed there, bounded below by the dashed before. Its rim is hot while
 * the scanner passes, then it settles into a resting glow: the brightest
 * light in the frame, in the colour that means fitness here. It follows the
 * displayed grid, so it grows exactly behind the scanner.
 */
export function ReclaimWalls({ W }: { W: World }) {
  const geo = useMemo(() => {
    const nv = PN * 2
    const aT = new Float32Array(nv)
    const aU = new Float32Array(nv)
    const idx: number[] = []
    for (let k = 0; k < PN; k++) {
      aT[k * 2 + 1] = 1
      aU[k * 2] = aU[k * 2 + 1] = k / (PN - 1)
      if (k < PN - 1) idx.push(k * 2, k * 2 + 2, k * 2 + 1, k * 2 + 1, k * 2 + 2, k * 2 + 3)
    }
    const g = new THREE.BufferGeometry()
    const pa = new THREE.BufferAttribute(new Float32Array(nv * 3), 3)
    pa.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', pa)
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
    g.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
    const ha = new THREE.BufferAttribute(new Float32Array(nv), 1)
    ha.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aH', ha)
    // the band's light scales with the lift it stands for (a thin band is almost all rim and read as
    // bright as a thick one): the colour per vertex is the green times the capacity reclaimed there
    const ca = new THREE.BufferAttribute(new Float32Array(nv * 3), 3)
    ca.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aColor', ca)
    g.setIndex(idx)
    return g
  }, [])
  const mat = useMemo(() => {
    const m = makeFillMaterial(PAL.yellowGreen, 'gradient', { additive: true, vertexColors: true })
    m.uniforms.uLo.value = 0.03
    m.uniforms.uHi.value = 0.34
    m.uniforms.uPow.value = 1.6
    m.uniforms.uRimW.value = 0.4
    m.uniforms.uRimA.value = 0.8
    return m
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const mesh = useRef<THREE.Mesh>(null)
  const last = useRef({ w: -1, ver: -1, g: -1 })
  useSafeFrame(
    'health reclaimed band',
    () => {
      const m = mesh.current
      if (!m) return
      const op = HS.reclaimWalls
      m.visible = op > 0.004
      if (!m.visible) return
      mat.uniforms.uOpacity.value = op
      mat.uniforms.uRim.value = 1.1 + 2.4 * HS.curtainOp
      const l = last.current
      if (l.w === W.id && l.ver === HS.gridVer && l.g === HS.ghostVer) return
      l.w = W.id
      l.ver = HS.gridVer
      l.g = HS.ghostVer
      const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array
      const h = (geo.attributes.aH as THREE.BufferAttribute).array as Float32Array
      const col = (geo.attributes.aColor as THREE.BufferAttribute).array as Float32Array
      for (let k = 0; k < PN; k++) {
        const i = PERIM[k]
        const g = HS.ghost[i] * W.YS
        const top = Math.max(HS.grid[i] * W.YS, g)
        const x = pxOf(i, W.XW)
        const z = pzOf(i)
        const v = k * 2
        p[v * 3] = p[v * 3 + 3] = x
        p[v * 3 + 2] = p[v * 3 + 5] = z
        p[v * 3 + 1] = g
        p[v * 3 + 4] = top
        h[v] = h[v + 1] = top - g
        const lk = 0.25 + 0.75 * Math.min(1, (top - g) / (LIFT_FULL * W.YS))
        for (let e = 0; e < 6; e += 3) {
          col[v * 3 + e] = GREEN_LIN.r * lk
          col[v * 3 + e + 1] = GREEN_LIN.g * lk
          col[v * 3 + e + 2] = GREEN_LIN.b * lk
        }
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.aH.needsUpdate = true
      geo.attributes.aColor.needsUpdate = true
    },
    { hide: mesh },
  )
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={26} frustumCulled={false} />
}

/* ------------------------------ power ridge ------------------------------ */

/**
 * L4: "The power ridge collapses first." A hot pen rides the landscape's
 * power ridge (the 1 s edge, every age) in the caption term's colour while
 * that edge leads the sink, so the phrase and the collapsing edge light
 * together. It draws without the depth test: as the ridge leads the sink
 * it drops below the columns beside it, which hide it from a camera on the
 * right exactly while the caption names it.
 */
export function RidgePen({ W }: { W: World }) {
  const core = useMemo(() => {
    const buf = new Float32Array((NA - 1) * 6)
    const geo = new LineSegmentsGeometry()
    geo.setPositions(buf)
    const ib = (geo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data as THREE.InstancedInterleavedBuffer
    ib.setUsage(THREE.DynamicDrawUsage)
    const arc = new THREE.InstancedInterleavedBuffer(new Float32Array((NA - 1) * 2).fill(1), 2, 1)
    geo.setAttribute('instanceArc', new THREE.InterleavedBufferAttribute(arc, 2, 0))
    const mat = makePenMaterial({ color: RIDGE_COLOR, width: PEN.hero })
    mat.depthTest = false
    mat.uniforms.uGain.value = 2.1
    const line = new LineSegments2(geo, mat)
    line.frustumCulled = false
    line.renderOrder = 46
    return { buf, geo, ib, mat, line }
  }, [])
  useEffect(
    () => () => {
      core.geo.dispose()
      core.mat.dispose()
    },
    [core],
  )
  const hide = useMemo(() => ({ current: core.line as THREE.Object3D }), [core])
  const last = useRef({ w: -1, ver: -1 })
  useSafeFrame(
    'health ridge pen',
    () => {
      core.line.visible = HS.ridge > 0.004
      if (!core.line.visible) return
      core.mat.opacity = HS.ridge
      const l = last.current
      if (l.w === W.id && l.ver === HS.gridVer) return
      l.w = W.id
      l.ver = HS.gridVer
      const s = core.buf
      for (let ai = 0; ai < NA - 1; ai++) {
        const o = ai * 6
        s[o] = s[o + 3] = -W.XW + 0.02
        s[o + 1] = HS.grid[ai * ND] * W.YS + 0.06
        s[o + 4] = HS.grid[(ai + 1) * ND] * W.YS + 0.06
        s[o + 2] = zOfAge(ageOfRow(ai))
        s[o + 5] = zOfAge(ageOfRow(ai + 1))
      }
      core.ib.needsUpdate = true
    },
    { hide },
  )
  return <primitive object={core.line} />
}

/* --------------------------------- skirt --------------------------------- */

const SKIRT_COLORS = [PAL.yellowGreen]

/**
 * A faint skirt under the fused landscape (end of L1): the caption names a
 * three-dimensional solid, so the solid exists as soon as the slices fuse;
 * L2 then fills it with light from the floor up.
 */
export function Skirt({ W }: { W: World }) {
  const last = useRef({ w: -1, ver: -1 })
  const write = (_T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const l = last.current
    if (l.w === W.id && l.ver === HS.gridVer) return false
    l.w = W.id
    l.ver = HS.gridVer
    for (let k = 0; k < PN; k++) {
      const i = PERIM[k]
      top[k * 3] = pxOf(i, W.XW)
      top[k * 3 + 1] = HS.grid[i] * W.YS
      top[k * 3 + 2] = pzOf(i)
      bottom[k] = 0
    }
    return true
  }
  return <AreaStrips strips={1} points={PN} colors={SKIRT_COLORS} write={write} opacity={() => HS.skirt} lo={0.015} hi={0.1} gamma={1.4} additive renderOrder={12} />
}

/* ---------------------------- solid outline ---------------------------- */

/** front-right, back-right, back-left: the front-left corner is the capacity post */
const EDGE_CORNERS = [CORNERS[1], CORNERS[2], CORNERS[3]] as const

/**
 * The solid's crisp edges (L10): the landscape's rim all the way round, and
 * three vertical corner edges (the fourth, front-left, is the capacity
 * post). With them the fused surface reads as the top of a SOLID, not as a
 * sheet floating over the floor frame.
 */
export function SolidOutline({ W }: { W: World }) {
  // rim: PN - 1 segments; corners: 3 segments
  const segs = useMemo(() => new Float32Array((PN - 1 + 3) * 6), [])
  const last = useRef({ w: -1, ver: -1 })
  const update = (_T: number, s: Float32Array): boolean => {
    const l = last.current
    if (l.w === W.id && l.ver === HS.gridVer) return false
    l.w = W.id
    l.ver = HS.gridVer
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
    for (let c = 0; c < 3; c++) {
      const i = EDGE_CORNERS[c]
      const o = (PN - 1 + c) * 6
      s[o] = s[o + 3] = pxOf(i, W.XW)
      s[o + 2] = s[o + 5] = pzOf(i)
      s[o + 1] = 0
      s[o + 4] = HS.grid[i] * W.YS + 0.03
    }
    return true
  }
  return <PenBatch segments={segs} color={PAL.chalk} width={PEN.axis} update={update} opacity={() => 0.6 * HS.edgeOp} renderOrder={31} />
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

/** Polyline -> segment buffer. */
function segsOf(p: Float32Array): Float32Array {
  const n = p.length / 3
  const out = new Float32Array((n - 1) * 6)
  for (let i = 0; i < n - 1; i++) out.set(p.subarray(i * 3, i * 3 + 6), i * 6)
  return out
}

/**
 * PAL.sick at 6.5% at the independence height while it is the new idea
 * (L3), 2.5% from L4 (D.7 says 10%; over a sunken landscape the fill, the
 * below-line tint and the hatch stacked three reds and hid the lid's shape),
 * reaching a little past the footprint at the left and the back, a hair at
 * the right (the age ticks run there). Its front edge lies on the volume's
 * front face (a front margin would cross the duration ticks), drawn as the
 * crisp hot pen the claim needs (L10); the other three edges follow thinner.
 */
export function IndependencePlane({ W }: { W: World }) {
  const zf = Z0 + PLANE_FRONT
  const zb = Z1 - PLANE_M
  const x0 = -W.XW - PLANE_M
  const x1 = W.XW + PLANE_MR
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
      mat.opacity = HS.planeFill * HS.planeOp
    },
    { hide: mesh },
  )
  // straight edges are single segments (no joins to bead at partial opacity)
  const front = useMemo(() => segsOf(linePts(x0, zf, x1, zf, 1)), [x0, x1, zf])
  const rest = useMemo(() => {
    const a = linePts(x1, zf, x1, zb, 1)
    const b = linePts(x1, zb, x0, zb, 1)
    const c = linePts(x0, zb, x0, zf, 1)
    const out = new Float32Array(a.length + b.length + c.length - 6)
    out.set(a, 0)
    out.set(b.subarray(3), a.length)
    out.set(c.subarray(3), a.length + b.length - 3)
    return segsOf(out)
  }, [x0, x1, zf, zb])
  // keyed on the buffer too: a new pen core (a new world) starts from y = 0
  const lastF = useRef({ buf: null as Float32Array | null, y: NaN })
  const lastR = useRef({ buf: null as Float32Array | null, y: NaN })
  const lift = (s: Float32Array, last: { current: { buf: Float32Array | null; y: number } }): boolean => {
    const y = HS.planeCap * W.YS + 0.015
    const l = last.current
    if (y === l.y && s === l.buf) return false
    l.y = y
    l.buf = s
    for (let i = 1; i < s.length; i += 3) s[i] = y
    return true
  }
  return (
    <>
      <mesh ref={mesh} geometry={geo} material={mat} renderOrder={22} frustumCulled={false} />
      <PenBatch
        segments={front}
        update={(_T, s) => lift(s, lastF)}
        color={PAL.sick}
        width={PEN.data}
        byArc
        progress={() => Math.min(1, HS.edge / 0.6)}
        opacity={() => Math.min(1, HS.planeOp * 1.5) * (0.4 + 0.6 * HS.planeFrame)}
        head
        hot
        renderOrder={32}
      />
      <PenBatch
        segments={rest}
        update={(_T, s) => lift(s, lastR)}
        color={PAL.sick}
        width={PEN.axis}
        byArc
        progress={() => Math.max(0, (HS.edge - 0.55) / 0.45)}
        opacity={() => 0.7 * Math.min(1, HS.planeOp * 1.5) * HS.planeFrame}
        renderOrder={32}
      />
    </>
  )
}
