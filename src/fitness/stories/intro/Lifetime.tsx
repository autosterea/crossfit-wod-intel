import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL, spectrum } from '../../fitnessData'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { SdfText } from '../../story/kit/SdfText'
import { lin, makeFillMaterial, makeSurfaceMaterial, type SurfaceUniforms } from '../../story/kit/materials'
import { clock } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useQAProbe } from '../../story/qa'
import { useLabels } from '../../story/labels/useLabel'
import type { LabelSpec, V3 } from '../../story/types'
import { chartPivot, cx, cy, tileFit, type IntroLayout } from './layout'
import { CAPACITY, NA, NU, capAt, rowOfAge } from './introMath'
import { ageAxisDraw, ageAxisOut, ageTick, backHot, eff, extrude, fold, healthIn, scannerHot, surfAcross, surfAside, surfDown, tileLines, turnOn, wallsIn } from './timeline'
import { exploreDim } from './emphasis'

/* =========================================================================
   Held for a lifetime (D.1 I3): the area extrudes back through every age
   of a life (z runs from age 20 at the front to 85 at the back) into the
   Lifelong trainer's capacity surface (agingCapacity, the Health chapter's
   data): a lit, glossy landscape with isolines over a VOLUME OF LIGHT.

   Area becomes volume, visibly: the I2 area stays on as the volume's front
   slice (timeline.faceDim), and while the ages are added the back wall is a
   luminous copy of that area, travelling back under a hot scanner line, so
   the viewer watches the area sweep back through the ages. Behind it, the
   side walls keep a low, constant density of the same yellow-green light
   (L9: the amount of light is the amount), and at rest the back wall
   settles to that density too: a lit surface over a faintly glowing solid,
   the surface still the brightest thing (L3). The walls are unlit additive
   gradients (the kit Fill shader), so they keep their hue on the slate; the
   top of each wall column takes on the colour of the surface edge above it.

   HEALTH lies on the floor in front; the age axis is named 20, AGE and 80
   (the Health chapter's ticks) as its pen reaches each, so depth reads as
   age while it grows. In I4 the landscape leaves first and shrinks into
   tile 06, where five crisp age slices (the front one in the curve's
   yellow-green) draw it as line art like its neighbours, and it turns
   slowly (the one ambient motion of the intro, on the ambient clock A).
   ========================================================================= */

/** tile 06 (MODULES order) */
const TILE = 5
const LIGHT = '#e9ffc4'
/** points per wall strip */
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

/*
 * The volume's light, as a share of the I2 area's density (the walls use the
 * I2 area's own gradient: lo, hi and gamma below match Chart's AreaFill).
 * SIDE and BACK_REST: the faint, constant glow of the solid at rest.
 * BACK_HOT: the travelling slice while the ages are added.
 */
const SIDE = 0.34
const BACK_REST = 0.34
const BACK_HOT = 0.78
/** how far the top of a wall column takes the surface edge's spectrum colour */
const TINT = 0.5
const FILL = { lo: 0.03, hi: 0.46, gamma: 1.7, rimWidth: 0.16 } as const
/** walls: left (along age at u 0), right (u 1), back (the slice at the extrusion front) */
const STRIPS = 3

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
const lutIndex = (cap: number) => Math.max(0, Math.min(255, Math.round((cap / 0.9) * 255))) * 3
const YG = lin(PAL.yellowGreen)

/** Age row (fractional) for extrusion e at age row a: rows past the front collapse onto it. */
const rowAt = (a: number, e: number) => Math.min(a, e * (NA - 1))

/* ------------------------------ the walls ------------------------------ */

/**
 * The walls of light: three unlit additive gradient strips (the kit Fill
 * shader, one draw call) whose per-vertex colours carry each wall's density
 * and the surface edge's hue at its top. The strip colours change while the
 * back wall travels and settles, which AreaStrips (fixed colours per strip)
 * cannot do: engine request, a colour writer on AreaStrips.
 */
function Walls({ L }: { L: IntroLayout }) {
  const c = L.chart
  const D = L.depth
  const geometry = useMemo(() => {
    const nv = STRIPS * NS * 2
    const aT = new Float32Array(nv)
    const aU = new Float32Array(nv)
    const rk = new Float32Array(nv)
    const idx: number[] = []
    for (let s = 0; s < STRIPS; s++)
      for (let i = 0; i < NS; i++) {
        const v = (s * NS + i) * 2
        aT[v] = 0
        aT[v + 1] = 1
        aU[v] = aU[v + 1] = i / (NS - 1)
        // the travelling back wall carries the hot rim; the side walls a soft one
        rk[v] = rk[v + 1] = s === 2 ? 1 : 0.35
        if (i < NS - 1) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3)
      }
    const g = new THREE.BufferGeometry()
    const pa = new THREE.BufferAttribute(new Float32Array(nv * 3), 3)
    pa.setUsage(THREE.DynamicDrawUsage)
    const ha = new THREE.BufferAttribute(new Float32Array(nv), 1)
    ha.setUsage(THREE.DynamicDrawUsage)
    const ca = new THREE.BufferAttribute(new Float32Array(nv * 3), 3)
    ca.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', pa)
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
    g.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
    g.setAttribute('aH', ha)
    g.setAttribute('aColor', ca)
    g.setAttribute('aRimK', new THREE.BufferAttribute(rk, 1))
    g.setIndex(idx)
    return g
  }, [])
  const material = useMemo(() => {
    const m = makeFillMaterial('#ffffff', 'gradient', { vertexColors: true, additive: true, rimScale: true })
    m.uniforms.uLo.value = FILL.lo
    m.uniforms.uHi.value = FILL.hi
    m.uniforms.uPow.value = FILL.gamma
    m.uniforms.uRimW.value = FILL.rimWidth
    m.uniforms.uRimA.value = 0.3
    return m
  }, [])
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geometry, material)
    m.frustumCulled = false
    m.renderOrder = 11
    return m
  }, [geometry, material])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  const last = useRef({ e: NaN, h: NaN, c: null as unknown })
  /** one wall vertex pair: the top at (x, y, z) with its surface value, the bottom on the floor */
  const put = (s: number, i: number, x: number, v: number, z: number, k: number, tint: number) => {
    const pos = geometry.attributes.position.array as Float32Array
    const hgt = geometry.attributes.aH.array as Float32Array
    const col = geometry.attributes.aColor.array as Float32Array
    const vb = (s * NS + i) * 2
    const y = cy(c, v)
    pos[vb * 3] = x
    pos[vb * 3 + 1] = c.y0
    pos[vb * 3 + 2] = z
    pos[vb * 3 + 3] = x
    pos[vb * 3 + 4] = y
    pos[vb * 3 + 5] = z
    hgt[vb] = hgt[vb + 1] = y - c.y0
    const li = lutIndex(v)
    col[vb * 3] = YG.r * k
    col[vb * 3 + 1] = YG.g * k
    col[vb * 3 + 2] = YG.b * k
    col[vb * 3 + 3] = (YG.r + (LUT[li] - YG.r) * tint) * k
    col[vb * 3 + 4] = (YG.g + (LUT[li + 1] - YG.g) * tint) * k
    col[vb * 3 + 5] = (YG.b + (LUT[li + 2] - YG.b) * tint) * k
  }

  useSafeFrame('intro walls', (T) => {
    const op = wallsIn(T) * exploreDim(TILE)
    const e = extrude(T)
    mesh.visible = op > 0.002 && e > 0.004
    if (!mesh.visible) return
    const h = backHot(T)
    material.uniforms.uOpacity.value = op
    // the travelling slice speaks (with the scanner above it); at rest a soft rim
    material.uniforms.uRim.value = 0.6 + 2.4 * h
    const lk = last.current
    if (lk.e === e && lk.h === h && lk.c === c) return
    lk.e = e
    lk.h = h
    lk.c = c
    const af = e * (NA - 1)
    const zf = -D * e
    const kb = BACK_REST + (BACK_HOT - BACK_REST) * h
    for (let i = 0; i < NS; i++) {
      const f = i / (NS - 1)
      // side walls: along age, from the front to the extrusion front
      const ar = f * af
      const z = (-D * ar) / (NA - 1)
      put(0, i, c.x0, capAt(0, ar), z, SIDE, TINT)
      put(1, i, c.x1, capAt(1, ar), z, SIDE, TINT)
      // back wall: the slice at the extrusion front, the I2 area's yellow-green while it travels
      put(2, i, cx(c, f), capAt(f, af), zf - 0.002, kb, TINT * (1 - h))
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aH.needsUpdate = true
    geometry.attributes.aColor.needsUpdate = true
  })
  return <primitive object={mesh} />
}

/* ------------------------------- the solid ------------------------------ */

export function Lifetime({ L }: { L: IntroLayout }) {
  const c = L.chart
  const D = L.depth
  const outer = useRef<THREE.Group>(null)
  const [pxc] = chartPivot(c)
  const piv = useMemo<V3>(() => [pxc, c.y0 + c.H * 0.3, -D / 2], [pxc, c.y0, c.H, D])
  const tile = L.tiles.c[TILE]
  // the tile view: fit the turned, tilted SURFACE's projected bounds inside the tile
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
        const li = lutIndex(cap)
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

  /*
   * The tile's slow turn runs on the ambient clock A, which the engine
   * re-freezes at 2.5 T the moment autoplay ends (or a finger pauses it): a
   * damped follower glides to the new angle instead of jumping. It snaps
   * whenever the story is held (deep links, QA seeks) or under reduced
   * motion, so every held frame is still exact.
   */
  const turnNow = useRef(NaN)
  // QA: the tile's turn (radians) and the raw target, so a test can prove the glide has no jump
  useQAProbe('intro-tile-turn', () => ({ turn: turnNow.current, A: clock.A, held: clock.held }))
  useSafeFrame('intro lifetime', (T, A, dt) => {
    const g = outer.current
    if (!g) return
    const e = extrude(T)
    mesh.visible = e > 0.004
    if (mesh.visible) writeSurface(e)
    const k = fold(T, TILE)
    const on = turnOn(T)
    const target = on * TURN * Math.sin(0.35 * A)
    const snap = Number.isNaN(turnNow.current) || on <= 0 || clock.held || useStoryStore.getState().reduced
    turnNow.current = snap ? target : THREE.MathUtils.damp(turnNow.current, target, 5, Math.min(0.1, dt))
    const tv = tileView
    // it shrinks and turns (k), steps aside into its lane, goes down, then across into tile 06
    const lane = piv[0] + L.healthLane
    g.position.set(
      piv[0] + (lane - piv[0]) * surfAside(T) + (tile[0] + tv.dx - lane) * surfAcross(T),
      piv[1] + (tile[1] + L.tiles.lift + tv.dy - piv[1]) * surfDown(T),
      piv[2] * (1 - k),
    )
    g.scale.setScalar(1 + (tv.s - 1) * k)
    g.rotation.set(TILE_TILT * k, TILE_YAW * k + turnNow.current, 0)
    // isolines read world height: they belong to the upright landscape (the
    // tile carries its own crisp age slices instead)
    const u = mat.userData.surface as SurfaceUniforms
    u.uIsoA.value = 0.34 * (1 - k)
    // the tilted tile faces the key light: a satin finish, lifted, keeps its colours luminous
    mat.roughness = 0.34 + 0.26 * k
    mat.color.setScalar(exploreDim(TILE) * (1 + 0.28 * k))
  }, { hide: outer })

  /* ---- the scanner: the back edge while the ages are added (segments written in place) ---- */
  const scan = useMemo(() => new Float32Array((NU - 1) * 6), [])
  const lastB = useRef({ v: NaN, c: null as unknown })
  const writeScan = (T: number, s: Float32Array): boolean => {
    const e = extrude(T)
    // numeric key (no per-frame string): the value and the layout's chart object
    const lk = lastB.current
    if (lk.v === e && lk.c === c) return false
    lk.v = e
    lk.c = c
    const af = e * (NA - 1)
    const z = -D * e
    for (let i = 0; i < NU; i++) {
      const u = i / (NU - 1)
      const x = cx(c, u)
      const y = cy(c, capAt(u, af)) + 0.02
      if (i > 0) {
        const o = (i - 1) * 6 + 3
        s[o] = x
        s[o + 1] = y
        s[o + 2] = z
      }
      if (i < NU - 1) {
        const o = i * 6
        s[o] = x
        s[o + 1] = y
        s[o + 2] = z
      }
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

  const standing = (T: number) => (extrude(T) > 0.004 ? 1 : 0)
  return (
    <group ref={outer} position={piv as unknown as [number, number, number]}>
      <group position={[-piv[0], -piv[1], -piv[2]]}>
        <primitive object={mesh} />
        <Walls L={L} />
        <PenBatch
          segments={scan}
          color={LIGHT}
          width={PEN.data}
          update={writeScan}
          opacity={standing}
          gain={(T) => 1 + 1.7 * scannerHot(T)}
          dim={(T) => (0.55 + 0.45 * scannerHot(T)) * exploreDim(TILE)}
          renderOrder={44}
        />
        <Pen points={ageAxis} color={PAL.chalk} width={PEN.axis} head hot progress={ageAxisDraw} opacity={(T) => 0.55 * ageAxisOut(T)} dim={() => exploreDim(TILE)} renderOrder={31} />
        <Pen points={edge} color={PAL.chalk} width={PEN.axis} opacity={(T) => standing(T) * wallsIn(T)} dim={() => 0.55} renderOrder={31} />
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

/* ------------------------------- labels -------------------------------- */

export function useLifetimeLabels(L: IntroLayout) {
  const specs = useMemo<LabelSpec[]>(() => {
    const c = L.chart
    const len = L.depth + 0.35
    const zOf = (age: number) => (-L.depth * rowOfAge(age)) / (NA - 1)
    // the share of the drawn age axis at an anchor's depth: its name lands as the pen reaches it
    const share = (z: number) => -z / len
    const ageZ = -L.depth * 0.5
    return [
      {
        id: 'intro-age',
        text: 'AGE',
        tone: 'tick',
        anchor: [c.x0, c.y0, ageZ],
        prefer: 'W',
        only: ['W', 'NW', 'SW'],
        gapPx: 10,
        priority: 80,
        required: true,
        cue: (T: number) => (eff(T) < 4.2 ? ageTick(T, share(ageZ)) : 0),
      },
      ...AGE_TICKS.map<LabelSpec>((t) => {
        const z = zOf(Number(t))
        return {
          id: `intro-age-${t}`,
          text: t,
          tone: 'tick',
          anchor: [c.x0, c.y0, z],
          prefer: 'W',
          only: ['W', 'NW', 'SW'],
          gapPx: 6,
          priority: 82,
          required: true,
          cue: (T: number) => (eff(T) < 4.2 ? ageTick(T, share(z)) : 0),
        }
      }),
    ]
  }, [L])
  useLabels(specs)
}
