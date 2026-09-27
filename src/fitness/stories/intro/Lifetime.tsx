import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL, spectrum } from '../../fitnessData'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaStrips } from '../../story/kit/Fill'
import { SdfText } from '../../story/kit/SdfText'
import { makeSurfaceMaterial, type SurfaceUniforms } from '../../story/kit/materials'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useLabels } from '../../story/labels/useLabel'
import type { LabelSpec, V3 } from '../../story/types'
import { chartPivot, cx, cy, tileFit, type IntroLayout } from './layout'
import { CAPACITY, NA, NU, capAt, rowOfAge } from './introMath'
import { ageAxisDraw, ageAxisOut, ageLabel, eff, extrude, fold, healthIn, scannerHot, skirtIn, tileLines, turnOn } from './timeline'
import { exploreDim } from './emphasis'

/* =========================================================================
   Held for a lifetime (D.1 I3): the area extrudes back through every age
   of a life (z runs from age 20 at the front to 85 at the back) into the
   Lifelong trainer's capacity surface (agingCapacity, the Health chapter's
   data): a lit, glossy landscape with isolines, over translucent walls of
   light, the curve as its front edge. A hot scanner line rides the back
   edge while the ages are added. HEALTH lies on the floor in front, and
   the age axis is named AGE with its two ends, 20 and 80 (the Health
   chapter's ticks), so depth reads as age. In I4 the landscape shrinks
   into tile 06, where five crisp age slices (the front one in the curve's
   yellow-green) draw it as line art like its neighbours, and it turns
   slowly (the one ambient motion of the intro, on the ambient clock A).
   ========================================================================= */

/** tile 06 (MODULES order) */
const TILE = 5
const LIGHT = '#e9ffc4'
/** points per skirt strip */
const NS = 28
/** the tile's three-quarter view: a turn about y, then a tilt toward the camera */
const TILE_YAW = -0.5
const TILE_TILT = 0.42
// +/- 8 degrees: small enough that the ambient clock's freeze on a pause (A = 2.5 T) barely moves it
const TURN = (8 * Math.PI) / 180
/** the age rows the tile draws as fine chalk slices between its front (the curve) and back (the scanner) edges */
const SLICES = [5, 10, 15] as const
/** the tile's lines sit this far above the surface (world units before the tile scale), clear of its depth */
const TILE_LIFT = 0.09
/** the Health chapter's age ticks (D.7 lexicon) shown at the two ends of the age axis */
const AGE_TICKS = ['20', '80'] as const

/** spectrum(cap / 0.9) as linear RGB, 256 steps (no allocation per vertex per frame) */
const LUT = (() => {
  const out = new Float32Array(256 * 3)
  const col = new THREE.Color()
  for (let i = 0; i < 256; i++) {
    const s = spectrum(i / 255)
    col.setRGB(s[0], s[1], s[2], THREE.SRGBColorSpace)
    out[i * 3] = col.r
    out[i * 3 + 1] = col.g
    out[i * 3 + 2] = col.b
  }
  return out
})()

/** Age row (fractional) for extrusion e at age row a: rows past the front collapse onto it. */
const rowAt = (a: number, e: number) => Math.min(a, e * (NA - 1))

export function Lifetime({ L }: { L: IntroLayout }) {
  const c = L.chart
  const D = L.depth
  const outer = useRef<THREE.Group>(null)
  const [pxc] = chartPivot(c)
  const piv = useMemo<V3>(() => [pxc, c.y0 + c.H * 0.3, -D / 2], [pxc, c.y0, c.H, D])
  const tile = L.tiles.c[TILE]
  // the tile view: fit the turned, tilted SURFACE's projected bounds inside the
  // tile (the glass skirt below it is all but invisible there)
  const tileView = useMemo(() => {
    let cMin = Infinity
    let cMax = -Infinity
    for (let i = 0; i < CAPACITY.length; i++) {
      cMin = Math.min(cMin, CAPACITY[i])
      cMax = Math.max(cMax, CAPACITY[i])
    }
    const e = new THREE.Euler(TILE_TILT, TILE_YAW, 0)
    const v = new THREE.Vector3()
    const p = new THREE.Vector3(piv[0], piv[1], piv[2])
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? c.x1 : c.x0, k & 2 ? cy(c, cMax) : cy(c, cMin) - 0.3, k & 4 ? -D : 0)
      v.sub(p).applyEuler(e)
      x0 = Math.min(x0, v.x)
      x1 = Math.max(x1, v.x)
      y0 = Math.min(y0, v.y)
      y1 = Math.max(y1, v.y)
    }
    const s = tileFit(L.tiles, (x1 - x0) * 1.04, (y1 - y0) * 1.04)
    // offset so the rotated solid's bounds centre on the tile's glyph spot
    return { s, dx: -((x0 + x1) / 2) * s, dy: -((y0 + y1) / 2) * s }
  }, [c, D, piv, L.tiles])

  /* ---- the surface ---- */
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(NU * NA * 3)
    const nor = new Float32Array(NU * NA * 3)
    const col = new Float32Array(NU * NA * 3)
    const idx: number[] = []
    for (let a = 0; a < NA - 1; a++)
      for (let i = 0; i < NU - 1; i++) {
        const v = a * NU + i
        // counter-clockwise seen from above (+y): the top is the FRONT face, so
        // the DoubleSide material keeps the up-facing normals for the lit side
        idx.push(v, v + 1, v + NU, v + 1, v + NU + 1, v + NU)
      }
    const pa = new THREE.BufferAttribute(pos, 3)
    pa.setUsage(THREE.DynamicDrawUsage)
    const na = new THREE.BufferAttribute(nor, 3)
    na.setUsage(THREE.DynamicDrawUsage)
    const ca = new THREE.BufferAttribute(col, 3)
    ca.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', pa)
    g.setAttribute('normal', na)
    g.setAttribute('color', ca)
    g.setIndex(idx)
    return g
  }, [])
  const mat = useMemo(() => makeSurfaceMaterial({ yScale: c.H, y0: c.y0, isoStep: 0.1, isoAlpha: 0.3, roughness: 0.34, metalness: 0.06 }), [c.H, c.y0])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  // a lit, glossy landscape (A.2): the procedural environment carries most of its light
  useEffect(() => {
    mat.envMapIntensity = 1.8
  }, [mat])
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geo, mat)
    m.frustumCulled = false
    m.renderOrder = 20
    return m
  }, [geo, mat])

  const lastS = useRef({ v: NaN, c: null as unknown })
  const writeSurface = (e: number) => {
    // numeric key (no per-frame string): the value and the layout's chart object
    const lk = lastS.current
    if (lk.v === e && lk.c === c) return
    lk.v = e
    lk.c = c
    const pos = geo.attributes.position.array as Float32Array
    const col = geo.attributes.color.array as Float32Array
    const nor = geo.attributes.normal.array as Float32Array
    for (let a = 0; a < NA; a++) {
      const ar = rowAt(a, e)
      const z = (-D * ar) / (NA - 1)
      for (let i = 0; i < NU; i++) {
        const u = i / (NU - 1)
        const cap = capAt(u, ar)
        const o = (a * NU + i) * 3
        pos[o] = cx(c, u)
        pos[o + 1] = cy(c, cap)
        pos[o + 2] = z
        const li = Math.max(0, Math.min(255, Math.round((cap / 0.9) * 255))) * 3
        col[o] = LUT[li]
        col[o + 1] = LUT[li + 1]
        col[o + 2] = LUT[li + 2]
      }
    }
    // normals from the grid (central differences), allocation-free; the
    // collapsed rows behind the front take the front row's normal
    const front = Math.min(NA - 1, Math.ceil(e * (NA - 1)))
    for (let a = 0; a < NA; a++) {
      const ar = Math.min(a, front)
      const a0 = Math.max(0, ar - 1)
      const a1 = Math.min(front, ar + 1)
      for (let i = 0; i < NU; i++) {
        const i0 = Math.max(0, i - 1)
        const i1 = Math.min(NU - 1, i + 1)
        const pu0 = (ar * NU + i0) * 3
        const pu1 = (ar * NU + i1) * 3
        const pa0 = (a0 * NU + i) * 3
        const pa1 = (a1 * NU + i) * 3
        const ux = pos[pu1] - pos[pu0]
        const uy = pos[pu1 + 1] - pos[pu0 + 1]
        const uz = pos[pu1 + 2] - pos[pu0 + 2]
        let vx = pos[pa1] - pos[pa0]
        let vy = pos[pa1 + 1] - pos[pa0 + 1]
        let vz = pos[pa1 + 2] - pos[pa0 + 2]
        if (vx * vx + vy * vy + vz * vz < 1e-10) {
          vx = 0
          vy = 0
          vz = -1
        }
        // n = v x u (points up for u along +x and v along -z)
        let nx = vy * uz - vz * uy
        let ny = vz * ux - vx * uz
        let nz = vx * uy - vy * ux
        const len = Math.hypot(nx, ny, nz) || 1
        nx /= len
        ny /= len
        nz /= len
        if (ny < 0) {
          nx = -nx
          ny = -ny
          nz = -nz
        }
        const o = (a * NU + i) * 3
        nor[o] = nx
        nor[o + 1] = ny
        nor[o + 2] = nz
      }
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.normal.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  }

  useSafeFrame('intro lifetime', (T, A) => {
    const g = outer.current
    if (!g) return
    const e = extrude(T)
    mesh.visible = e > 0.004
    if (mesh.visible) writeSurface(e)
    const k = fold(T, TILE)
    const turn = turnOn(T) * TURN * Math.sin(0.35 * A)
    const tv = tileView
    g.position.set(
      piv[0] + (tile[0] + tv.dx - piv[0]) * k,
      piv[1] + (tile[1] + L.tiles.lift + tv.dy - piv[1]) * k,
      piv[2] * (1 - k),
    )
    g.scale.setScalar(1 + (tv.s - 1) * k)
    g.rotation.set(TILE_TILT * k, TILE_YAW * k + turn, 0)
    // isolines read world height: they belong to the upright landscape (the
    // tile carries its own crisp age slices instead)
    const u = mat.userData.surface as SurfaceUniforms
    u.uIsoA.value = 0.34 * (1 - k)
    // the tilted tile faces the key light: a satin finish, lifted, keeps its colours luminous
    mat.roughness = 0.34 + 0.26 * k
    mat.color.setScalar(exploreDim(TILE) * (1 + 0.28 * k))
  }, { hide: outer })

  /* ---- the walls of light (left, right, back, front) ---- */
  const lastW = useRef({ v: NaN, c: null as unknown })
  const writeWalls = (T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const e = extrude(T)
    // numeric key (no per-frame string): the value and the layout's chart object
    const lk = lastW.current
    if (lk.v === e && lk.c === c) return false
    lk.v = e
    lk.c = c
    const af = e * (NA - 1)
    const zf = -D * e
    for (let k = 0; k < NS; k++) {
      const f = k / (NS - 1)
      // side walls: along age, from the front to the extrusion front
      const ar = f * af
      const z = (-D * ar) / (NA - 1)
      let o = k
      top[o * 3] = c.x0
      top[o * 3 + 1] = cy(c, capAt(0, ar))
      top[o * 3 + 2] = z
      bottom[o] = c.y0
      o = NS + k
      top[o * 3] = c.x1
      top[o * 3 + 1] = cy(c, capAt(1, ar))
      top[o * 3 + 2] = z
      bottom[o] = c.y0
      // back wall: the slice at the extrusion front
      o = 2 * NS + k
      top[o * 3] = cx(c, f)
      top[o * 3 + 1] = cy(c, capAt(f, af))
      top[o * 3 + 2] = zf - 0.002
      bottom[o] = c.y0
      // front wall: the youngest slice (under the chart's own area)
      o = 3 * NS + k
      top[o * 3] = cx(c, f)
      top[o * 3 + 1] = cy(c, capAt(f, 0))
      top[o * 3 + 2] = -0.004
      bottom[o] = c.y0
    }
    return true
  }
  const wallColors = useMemo(() => [PAL.yellowGreen, PAL.yellowGreen, PAL.yellowGreen, PAL.yellowGreen], [])

  /* ---- the scanner: the back edge while the ages are added ---- */
  const scan = useMemo(() => new Float32Array(NU * 3), [])
  const lastB = useRef({ v: NaN, c: null as unknown })
  const writeScan = (T: number, p: Float32Array): boolean => {
    const e = extrude(T)
    // numeric key (no per-frame string): the value and the layout's chart object
    const lk = lastB.current
    if (lk.v === e && lk.c === c) return false
    lk.v = e
    lk.c = c
    const af = e * (NA - 1)
    for (let i = 0; i < NU; i++) {
      const u = i / (NU - 1)
      p[i * 3] = cx(c, u)
      p[i * 3 + 1] = cy(c, capAt(u, af)) + 0.02
      p[i * 3 + 2] = -D * e
    }
    return true
  }

  /* ---- the age axis along the floor at the power axis ---- */
  const ageAxis = useMemo(() => {
    const a = new Float32Array(25 * 3)
    for (let i = 0; i < 25; i++) {
      a[i * 3] = c.x0
      a[i * 3 + 1] = c.y0
      a[i * 3 + 2] = (-(D + 0.35) * i) / 24
    }
    return a
  }, [c, D])

  /* ---- the volume's front-right vertical: a crisp edge for a glass solid (L10;
     the front-left one is the power axis, which the chart owns). It belongs
     to the standing landscape and leaves before the fold. ---- */
  const edge = useMemo(() => new Float32Array([c.x1, c.y0, 0, c.x1, cy(c, capAt(1, 0)), 0]), [c])

  /* ---- the tile's line art: the age-20 front edge in the curve's
     yellow-green and three fine chalk age slices, lifted just off the surface ---- */
  const frontEdge = useMemo(() => {
    const a = new Float32Array(NU * 3)
    for (let i = 0; i < NU; i++) {
      const u = i / (NU - 1)
      a.set([cx(c, u), cy(c, capAt(u, 0)) + TILE_LIFT, 0.004], i * 3)
    }
    return a
  }, [c])
  const slices = useMemo(() => {
    const segs = new Float32Array(SLICES.length * (NU - 1) * 6)
    let o = 0
    for (const a of SLICES) {
      const z = (-D * a) / (NA - 1)
      for (let i = 0; i < NU - 1; i++) {
        const u0 = i / (NU - 1)
        const u1 = (i + 1) / (NU - 1)
        segs.set([cx(c, u0), cy(c, capAt(u0, a)) + TILE_LIFT, z, cx(c, u1), cy(c, capAt(u1, a)) + TILE_LIFT, z], o)
        o += 6
      }
    }
    return segs
  }, [c, D])

  return (
    <group ref={outer} position={piv as unknown as [number, number, number]}>
      <group position={[-piv[0], -piv[1], -piv[2]]}>
        <primitive object={mesh} />
        <AreaStrips
          strips={4}
          points={NS}
          colors={wallColors}
          write={writeWalls}
          opacity={(T) => (extrude(T) > 0.004 ? skirtIn(T) * exploreDim(TILE) * (1 - 0.55 * fold(T, TILE)) : 0)}
          // glass, not a khaki block: light only near each wall's top edge (linear-light alphas add fast)
          lo={0.0015}
          hi={0.024}
          gamma={3}
          rim={() => 0.6}
          rimWidth={0.1}
          rimAlpha={0.26}
          renderOrder={11}
        />
        <Pen
          points={scan}
          color={LIGHT}
          width={PEN.data}
          update={writeScan}
          opacity={(T) => (extrude(T) > 0.004 ? 1 : 0)}
          gain={(T) => 1 + 1.7 * scannerHot(T)}
          dim={(T) => (0.55 + 0.45 * scannerHot(T)) * exploreDim(TILE)}
          renderOrder={44}
        />
        <Pen points={ageAxis} color={PAL.chalk} width={PEN.axis} head hot progress={ageAxisDraw} opacity={(T) => 0.55 * ageAxisOut(T)} dim={() => exploreDim(TILE)} renderOrder={31} />
        <Pen points={edge} color={PAL.chalk} width={PEN.axis} opacity={(T) => (extrude(T) > 0.004 ? skirtIn(T) * ageAxisOut(T) : 0)} dim={() => 0.55} renderOrder={31} />
        <PenBatch
          segments={slices}
          color={PAL.chalk}
          width={PEN.grid}
          progress={tileLines}
          opacity={(T) => (tileLines(T) > 0 ? 1 : 0)}
          dim={() => 0.5 * exploreDim(TILE)}
          renderOrder={33}
        />
        <Pen points={frontEdge} color={PAL.yellowGreen} width={PEN.data} progress={tileLines} opacity={(T) => (tileLines(T) > 0 ? 1 : 0)} dim={() => exploreDim(TILE)} renderOrder={34} />
        <group position={[pxc, c.y0 + 0.01, L.healthZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <SdfText
            font="barlowBold"
            text="HEALTH"
            size={L.healthSize}
            color={PAL.chalk}
            opacity={(T) => 0.42 * healthIn(T)}
            letterSpacing={0.12}
            renderOrder={46}
          />
        </group>
      </group>
    </group>
  )
}

export function useLifetimeLabels(L: IntroLayout) {
  const specs = useMemo<LabelSpec[]>(() => {
    const c = L.chart
    const cue = (T: number) => (eff(T) < 4.2 ? ageLabel(T) : 0)
    const zOf = (age: number) => (-L.depth * rowOfAge(age)) / (NA - 1)
    return [
      {
        id: 'intro-age',
        text: 'AGE',
        tone: 'tick',
        anchor: [c.x0, c.y0, -L.depth * 0.5],
        prefer: 'W',
        only: ['W', 'NW', 'SW'],
        gapPx: 10,
        priority: 80,
        required: true,
        cue,
      },
      ...AGE_TICKS.map<LabelSpec>((t) => ({
        id: `intro-age-${t}`,
        text: t,
        tone: 'tick',
        anchor: [c.x0, c.y0, zOf(Number(t))],
        prefer: 'W',
        only: ['W', 'NW', 'SW'],
        gapPx: 6,
        priority: 82,
        required: true,
        cue,
      })),
    ]
  }, [L])
  useLabels(specs)
}
