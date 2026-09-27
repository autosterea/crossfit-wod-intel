import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { lin, makeFillMaterial, makeRimStandard } from '../../story/kit/materials'
import { N, chordRadius, dirX, dirY, spokeAngle } from './skillsMath'
import { MINI_R, R } from './layout'

/* =========================================================================
   Radar building blocks (DESIGN.md D.2 "World", B.9). Every element reads a
   small mutable SOURCE that the chapter's frame hook fills once per frame
   from story time (or, in explore, from the damped explore state), and
   rewrites its buffers only when that source's version changed:

     Construction  rings (one batch, all five sweep together), unit ticks,
                   chalk spokes, class-coloured spoke overlays, pen heads
     ProfileSolid  the profile prism: a luminous cap (the fill material on a
                   fan, alpha rising toward the edge, an HDR rim band that
                   blooms), lit translucent walls (rimStandard), a crisp
                   outline pen on top (L10) and class-coloured vertex nodes
     Hatch         the gap between two profiles along every ray (B.9 hatch)
     Minis         the 13 small multiples: fills, outlines, reference rings
                   and floor rings, four draw calls for all thirteen
   ========================================================================= */

/** Far outside every view: where a not-yet-drawn segment waits (never a zero-length dot). */
export const AWAY = 1e5

/** A profile the elements draw: radius per spoke plus a version that bumps on change. */
export interface ProfileSrc {
  r: Float32Array
  v: number
}
export const newProfile = (): ProfileSrc => ({ r: new Float32Array(N), v: 0 })

/** Write one radius into a profile source; returns true when it moved (bump `v` once after a pass). */
export function setRadius(src: ProfileSrc, i: number, v: number): boolean {
  if (v === src.r[i]) return false
  src.r[i] = v
  return true
}

/** World xy of spoke i at radius r. */
export const px = (i: number, r: number) => r * dirX(i)
export const py = (i: number, r: number) => r * dirY(i)

/** Angle (radians, counter-clockwise from +x) of a fractional spoke position f (clockwise from Strength). */
export const angleOfF = (f: number) => Math.PI / 2 - (f * Math.PI * 2) / N

/** xyz polyline of an arc from fractional spoke f0 to f1 (either direction) at radius r. */
export function arcPolyline(f0: number, f1: number, r: number, z: number, steps = 72): Float32Array {
  const out = new Float32Array((steps + 1) * 3)
  for (let k = 0; k <= steps; k++) {
    const a = angleOfF(f0 + ((f1 - f0) * k) / steps)
    out[k * 3] = r * Math.cos(a)
    out[k * 3 + 1] = r * Math.sin(a)
    out[k * 3 + 2] = z
  }
  return out
}

/* ------------------------------ pen heads ------------------------------ */

/**
 * The pen head (B.9, L4) for several tips at once: a hot white core that
 * blooms plus a soft halo tinted by the stroke. `place` writes tip i and
 * returns its intensity (0 hides it). Two draw calls for any count.
 */
export function Heads({
  count,
  tint,
  place,
  hot = true,
  scale = 1,
}: {
  count: number
  tint: string
  place: (T: number, i: number, out: [number, number, number]) => number
  hot?: boolean
  /** size multiplier (thin strokes carry a smaller tip) */
  scale?: number
}) {
  const halo = useMemo(() => '#' + new THREE.Color(tint).lerp(new THREE.Color('#f4ffe0'), 0.35).getHexString(), [tint])
  return (
    <>
      <Glows count={count} sizePx={Math.round((hot ? 46 : 26) * scale)} colors={[halo]} gain={hot ? 1.5 : 0.55} place={place} />
      <Glows count={count} sizePx={Math.round((hot ? 15 : 10) * scale)} colors={['#f4ffe0']} gain={hot ? 3.2 : 1} place={place} />
    </>
  )
}

/** A pen tip's intensity along its stroke: it fades in over the first 12% (no blob at the origin) and out at the end. */
const tipK = (p: number) => (p > 0 && p < 1 ? Math.min(1, p / 0.12, (1 - p) / 0.04) : 0)

/* ---------------------------- construction ---------------------------- */

export interface ConstructionVis {
  /** 0..1 clockwise sweep of all five rings (from 12 o'clock) */
  rings: (T: number) => number
  ringOpacity: (T: number) => number
  /** drawn length of spoke i, 0..1 of R */
  spoke: (T: number, i: number) => number
  spokeOpacity: (T: number) => number
  tickOpacity: (T: number) => number
  /** class colour on spoke i: 0..1 (it runs from the rim to the centre) */
  classK: (T: number, i: number) => number
  classOpacity: (T: number) => number
  /** pen heads: on while drawing (story only) */
  heads?: boolean
  /** a key that changes whenever any of the above can have changed (T in story, a constant in explore) */
  key: (T: number) => number
  /** spoke i's class colour */
  colors: readonly string[]
}

const RING_VALUES = [2, 4, 6, 8, 10]
const RING_SEGS = 96
const TICK_LEN = 0.13
/** the odd units: the rings already mark the even ones */
const TICK_U = [3, 5, 7, 9]

/** Rings (angle-major, so all five sweep together), unit ticks, spokes and class overlays. */
export function Construction({ vis, z = 0 }: { vis: ConstructionVis; z?: number }) {
  // rings: segment k of ring j at index k * 5 + j (progress by index sweeps every ring at once)
  const rings = useMemo(() => {
    const s = new Float32Array(RING_SEGS * RING_VALUES.length * 6)
    for (let k = 0; k < RING_SEGS; k++) {
      const a0 = Math.PI / 2 - (k / RING_SEGS) * Math.PI * 2
      const a1 = Math.PI / 2 - ((k + 1) / RING_SEGS) * Math.PI * 2
      RING_VALUES.forEach((rv, j) => {
        const o = (k * RING_VALUES.length + j) * 6
        s[o] = rv * Math.cos(a0)
        s[o + 1] = rv * Math.sin(a0)
        s[o + 2] = z - 0.01
        s[o + 3] = rv * Math.cos(a1)
        s[o + 4] = rv * Math.sin(a1)
        s[o + 5] = z - 0.01
      })
    }
    return s
  }, [z])
  // the outer ring (10) a step brighter than the inner four: it is the rim of the scale
  const ringCols = useMemo(() => {
    const c = new Float32Array(rings.length)
    const hi = lin(PAL.chalk)
    const lo = lin(PAL.chalk).multiplyScalar(0.6)
    for (let k = 0; k < RING_SEGS; k++)
      RING_VALUES.forEach((rv, j) => {
        const col = rv === 10 ? hi : lo
        c.set([col.r, col.g, col.b, col.r, col.g, col.b], (k * RING_VALUES.length + j) * 6)
      })
    return c
  }, [rings])

  const spokes = useMemo(() => new Float32Array(N * 6).fill(AWAY), [])
  const spokeCols = useMemo(() => {
    const c = new Float32Array(N * 6)
    const a = lin(PAL.chalk).multiplyScalar(0.18)
    const b = lin(PAL.chalk)
    for (let i = 0; i < N; i++) c.set([a.r, a.g, a.b, b.r, b.g, b.b], i * 6)
    return c
  }, [])
  const ticks = useMemo(() => new Float32Array(N * TICK_U.length * 6).fill(AWAY), [])
  const overlay = useMemo(() => new Float32Array(N * 6).fill(AWAY), [])
  const overlayCols = useMemo(() => {
    const c = new Float32Array(N * 6)
    vis.colors.forEach((hex, i) => {
      const col = lin(hex)
      c.set([col.r, col.g, col.b, col.r, col.g, col.b], i * 6)
    })
    return c
  }, [vis.colors])

  const lastS = useRef(Number.NaN)
  const writeSpokes = (T: number, s: Float32Array): boolean => {
    if (vis.spokeOpacity(T) <= 0.002) return false
    const key = vis.key(T)
    if (key === lastS.current) return false
    lastS.current = key
    for (let i = 0; i < N; i++) {
      const L = vis.spoke(T, i) * R
      const o = i * 6
      if (L <= 0.001) {
        s.fill(AWAY, o, o + 6)
        continue
      }
      s[o] = 0
      s[o + 1] = 0
      s[o + 2] = z
      s[o + 3] = px(i, L)
      s[o + 4] = py(i, L)
      s[o + 5] = z
    }
    return true
  }
  const lastT = useRef(Number.NaN)
  const writeTicks = (T: number, s: Float32Array): boolean => {
    if (vis.tickOpacity(T) <= 0.002) return false
    const key = vis.key(T)
    if (key === lastT.current) return false
    lastT.current = key
    for (let i = 0; i < N; i++) {
      const L = vis.spoke(T, i) * R
      // the tick is perpendicular to the spoke
      const tx = -dirY(i) * TICK_LEN
      const ty = dirX(i) * TICK_LEN
      for (let t = 0; t < TICK_U.length; t++) {
        const u = TICK_U[t]
        const o = (i * TICK_U.length + t) * 6
        if (L < u) {
          s.fill(AWAY, o, o + 6)
          continue
        }
        const cx = px(i, u)
        const cy = py(i, u)
        s[o] = cx - tx
        s[o + 1] = cy - ty
        s[o + 2] = z
        s[o + 3] = cx + tx
        s[o + 4] = cy + ty
        s[o + 5] = z
      }
    }
    return true
  }
  const lastO = useRef(Number.NaN)
  const writeOverlay = (T: number, s: Float32Array): boolean => {
    if (vis.classOpacity(T) <= 0.002) return false
    const key = vis.key(T)
    if (key === lastO.current) return false
    lastO.current = key
    for (let i = 0; i < N; i++) {
      const k = vis.classK(T, i)
      const o = i * 6
      if (k <= 0.001) {
        s.fill(AWAY, o, o + 6)
        continue
      }
      // the colour runs from the rim toward the centre
      const r0 = R * (1 - k)
      s[o] = px(i, R)
      s[o + 1] = py(i, R)
      s[o + 2] = z + 0.005
      s[o + 3] = px(i, r0)
      s[o + 4] = py(i, r0)
      s[o + 5] = z + 0.005
    }
    return true
  }

  return (
    <>
      <PenBatch segments={rings} colors={ringCols} width={PEN.grid} progress={vis.rings} opacity={vis.ringOpacity} renderOrder={29} />
      <PenBatch segments={ticks} color={PAL.chalk} width={PEN.grid} update={writeTicks} opacity={vis.tickOpacity} renderOrder={29} />
      <PenBatch segments={spokes} colors={spokeCols} width={PEN.axis} update={writeSpokes} opacity={vis.spokeOpacity} renderOrder={30} />
      <PenBatch segments={overlay} colors={overlayCols} width={PEN.axis + 0.5} update={writeOverlay} opacity={vis.classOpacity} renderOrder={31} />
      {vis.heads && (
        <>
          {/* the pen that sweeps the rings rides the outer one */}
          <Heads
            count={1}
            tint={PAL.chalk}
            place={(T, _i, out) => {
              const p = vis.rings(T)
              const a = Math.PI / 2 - p * Math.PI * 2
              out[0] = R * Math.cos(a)
              out[1] = R * Math.sin(a)
              out[2] = z + 0.02
              return p > 0 && p < 1 ? Math.min(1, p / 0.03, (1 - p) / 0.03) : 0
            }}
          />
          {/* the spokes: only the leading pen (the one about to land and name
              its skill) is hot; the ones behind it are small cool tips (L4) */}
          <Heads
            count={1}
            tint={PAL.chalk}
            scale={0.62}
            place={(T, _i, out) => {
              const i = leadSpoke(vis, T)
              if (i < 0) return 0
              const p = vis.spoke(T, i)
              out[0] = px(i, p * R)
              out[1] = py(i, p * R)
              out[2] = z + 0.02
              return tipK(p)
            }}
          />
          <Heads
            count={N}
            tint={PAL.chalk}
            hot={false}
            scale={0.8}
            place={(T, i, out) => {
              if (i === leadSpoke(vis, T)) return 0
              const p = vis.spoke(T, i)
              out[0] = px(i, p * R)
              out[1] = py(i, p * R)
              out[2] = z + 0.02
              return 0.75 * tipK(p)
            }}
          />
        </>
      )}
    </>
  )
}

/** The spoke pen furthest along among those still drawing (-1 when none is). */
function leadSpoke(vis: ConstructionVis, T: number): number {
  let best = -1
  let bp = -1
  for (let i = 0; i < N; i++) {
    const p = vis.spoke(T, i)
    if (p > 0 && p < 1 && p > bp) {
      bp = p
      best = i
    }
  }
  return best
}

/* ------------------------------- fans -------------------------------- */

/**
 * `fans` radar fans (10 triangles each, non-indexed) for the Fill material:
 * aT runs 0 at the centre to 1 at the edge (the chalk-dust gradient), aH is
 * the edge radius (so the rim band hugs the outline), aU stays 0 (no sweep).
 */
export function fanGeometry(fans: number, colors?: readonly string[], rimK?: readonly number[]): THREE.BufferGeometry {
  const nv = fans * N * 3
  const g = new THREE.BufferGeometry()
  const pos = new THREE.BufferAttribute(new Float32Array(nv * 3), 3)
  pos.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('position', pos)
  const aT = new Float32Array(nv)
  for (let v = 0; v < nv; v++) aT[v] = v % 3 === 0 ? 0 : 1
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  g.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(nv), 1))
  const aH = new THREE.BufferAttribute(new Float32Array(nv), 1)
  aH.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('aH', aH)
  if (colors) {
    const col = new Float32Array(nv * 3)
    for (let f = 0; f < fans; f++) {
      const c = lin(colors[f] ?? PAL.chalk)
      for (let v = 0; v < N * 3; v++) col.set([c.r, c.g, c.b], (f * N * 3 + v) * 3)
    }
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  }
  if (rimK) {
    const k = new Float32Array(nv)
    for (let f = 0; f < fans; f++) k.fill(rimK[f] ?? 1, f * N * 3, (f + 1) * N * 3)
    g.setAttribute('aRimK', new THREE.BufferAttribute(k, 1))
  }
  return g
}

/** Write fan f: centre (cx, cy), per-spoke radii r (already scaled), depth z. */
export function writeFan(g: THREE.BufferGeometry, f: number, cx: number, cy: number, r: ArrayLike<number>, scale: number, z: number): void {
  const p = (g.attributes.position as THREE.BufferAttribute).array as Float32Array
  const h = (g.attributes.aH as THREE.BufferAttribute).array as Float32Array
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N
    const ri = Math.max(0, r[i]) * scale
    const rj = Math.max(0, r[j]) * scale
    const v = (f * N + i) * 3
    p[v * 3] = cx
    p[v * 3 + 1] = cy
    p[v * 3 + 2] = z
    p[v * 3 + 3] = cx + px(i, ri)
    p[v * 3 + 4] = cy + py(i, ri)
    p[v * 3 + 5] = z
    p[v * 3 + 6] = cx + px(j, rj)
    p[v * 3 + 7] = cy + py(j, rj)
    p[v * 3 + 8] = z
    h[v] = (ri + rj) / 2
    h[v + 1] = ri
    h[v + 2] = rj
  }
  ;(g.attributes.position as THREE.BufferAttribute).needsUpdate = true
  ;(g.attributes.aH as THREE.BufferAttribute).needsUpdate = true
}

/** Walls of a radar prism: one outward-facing quad per edge, from z = 0 to the cap. */
function wallGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  const pos = new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3)
  pos.setUsage(THREE.DynamicDrawUsage)
  const nor = new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3)
  nor.setUsage(THREE.DynamicDrawUsage)
  const col = new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3)
  col.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('position', pos)
  g.setAttribute('normal', nor)
  g.setAttribute('color', col)
  const idx: number[] = []
  for (let i = 0; i < N; i++) {
    const b = i * 4
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  g.setIndex(idx)
  return g
}

/**
 * Per-face shading of the walls (a unit vector in the wheel plane): faces
 * turned toward the key light (upper right, like the engine's key) are lit,
 * the ones turned away fall toward shadow, so the depth reads at 1x even
 * where the wall is 3 px.
 */
const WALL_LX = 0.83
const WALL_LY = 0.56

function writeWalls(g: THREE.BufferGeometry, r: ArrayLike<number>, depth: number): void {
  const p = (g.attributes.position as THREE.BufferAttribute).array as Float32Array
  const n = (g.attributes.normal as THREE.BufferAttribute).array as Float32Array
  const c = (g.attributes.color as THREE.BufferAttribute).array as Float32Array
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N
    const x0 = px(i, Math.max(0, r[i]))
    const y0 = py(i, Math.max(0, r[i]))
    const x1 = px(j, Math.max(0, r[j]))
    const y1 = py(j, Math.max(0, r[j]))
    // outward normal of the edge (the profile runs clockwise)
    const l = Math.hypot(x1 - x0, y1 - y0) || 1
    const nx = -(y1 - y0) / l
    const ny = (x1 - x0) / l
    const shade = 0.22 + 1.05 * Math.max(0, nx * WALL_LX + ny * WALL_LY)
    const b = i * 12
    p[b] = x0
    p[b + 1] = y0
    p[b + 2] = 0
    p[b + 3] = x1
    p[b + 4] = y1
    p[b + 5] = 0
    p[b + 6] = x1
    p[b + 7] = y1
    p[b + 8] = depth
    p[b + 9] = x0
    p[b + 10] = y0
    p[b + 11] = depth
    for (let k = 0; k < 4; k++) {
      n[b + k * 3] = nx
      n[b + k * 3 + 1] = ny
      n[b + k * 3 + 2] = 0
      c[b + k * 3] = shade
      c[b + k * 3 + 1] = shade
      c[b + k * 3 + 2] = shade
    }
  }
  ;(g.attributes.position as THREE.BufferAttribute).needsUpdate = true
  ;(g.attributes.normal as THREE.BufferAttribute).needsUpdate = true
  ;(g.attributes.color as THREE.BufferAttribute).needsUpdate = true
}

/* ---------------------------- profile prism ---------------------------- */

export interface SolidVis {
  fill: (T: number) => number
  walls: (T: number) => number
  outline: (T: number) => number
  /** rest the outline dimmed toward the slate at full alpha (a ghost) */
  outlineDim?: (T: number) => number
  /**
   * 0..1: the outline hands over to a thin ghost stroke (1.75 px, dimmed to
   * `ghostDim`), so a ghost reads lighter than the line drawn over it
   */
  ghost?: (T: number) => number
  ghostDim?: number
  nodes: (T: number) => number
  /** vertex node i's size 0..1 (it grows out with its vertex); default: shown once the vertex has left the centre */
  nodeK?: (T: number, i: number) => number
  /** prism depth (z of the cap) */
  depth: (T: number) => number
  /** HDR rim band under the edge (the speaking element), 0 = off */
  rim: (T: number) => number
  /** outline colour gain (HDR while it speaks) */
  gain?: (T: number) => number
}

/** The cap's chalk-dust gradient: alpha at the centre, at the edge, and the curve between. */
export interface CapLook {
  lo: number
  hi: number
  pow: number
}
const CAP: CapLook = { lo: 0.03, hi: 0.34, pow: 1.7 }

/** A cached writer of a profile's outline at the cap (one per pen: each keeps its own key). */
function outlineWriter(src: ProfileSrc, depth: (T: number) => number) {
  const last = { v: -1, d: -1 }
  return (T: number, pts: Float32Array): boolean => {
    const d = depth(T)
    if (src.v === last.v && d === last.d) return false
    last.v = src.v
    last.d = d
    for (let k = 0; k <= N; k++) {
      const i = k % N
      pts[k * 3] = px(i, Math.max(0, src.r[i]))
      pts[k * 3 + 1] = py(i, Math.max(0, src.r[i]))
      pts[k * 3 + 2] = d + 0.01
    }
    return true
  }
}

/**
 * The profile prism: a luminous cap, lit translucent walls, the crisp outline
 * and class-coloured vertex nodes. `src` holds the live radii.
 */
export function ProfileSolid({
  src,
  color,
  nodeColors,
  nodeRadius,
  vis,
  low,
  cap = CAP,
}: {
  src: ProfileSrc
  color: string
  nodeColors: readonly string[]
  nodeRadius: number
  vis: SolidVis
  low: boolean
  cap?: CapLook
}) {
  const fan = useMemo(() => fanGeometry(1), [])
  const fillMat = useMemo(() => makeFillMaterial(color, 'gradient', { additive: !low }), [color, low])
  const fillMesh = useMemo(() => {
    const m = new THREE.Mesh(fan, fillMat)
    m.frustumCulled = false
    m.renderOrder = 12
    return m
  }, [fan, fillMat])
  const walls = useMemo(() => wallGeometry(), [])
  const wallMat = useMemo(() => {
    const m = makeRimStandard({ color, rim: color, rimStrength: 0.9, metalness: 0.15, roughness: 0.32, emissiveIntensity: 0.22, transparent: true, opacity: 0.35 })
    m.vertexColors = true
    m.depthWrite = false
    m.side = THREE.DoubleSide
    return m
  }, [color])
  const wallMesh = useMemo(() => {
    const m = new THREE.Mesh(walls, wallMat)
    m.frustumCulled = false
    m.renderOrder = 20
    return m
  }, [walls, wallMat])
  useEffect(() => () => fan.dispose(), [fan])
  useEffect(() => () => fillMat.dispose(), [fillMat])
  useEffect(() => () => walls.dispose(), [walls])
  useEffect(() => () => wallMat.dispose(), [wallMat])

  const last = useRef({ v: -1, d: -1 })
  useSafeFrame('skills profile solid', (T) => {
    const d = vis.depth(T)
    if (src.v !== last.current.v || d !== last.current.d) {
      last.current.v = src.v
      last.current.d = d
      writeFan(fan, 0, 0, 0, src.r, 1, d + 0.002)
      writeWalls(walls, src.r, d)
    }
    const fo = vis.fill(T)
    fillMesh.visible = fo > 0.002
    const u = fillMat.uniforms
    u.uOpacity.value = fo
    u.uLo.value = low ? 0.12 : cap.lo
    u.uHi.value = low ? 0.5 : cap.hi
    u.uPow.value = low ? 1 : cap.pow
    u.uRim.value = vis.rim(T) * (low ? 0.35 : 1)
    u.uRimW.value = 0.38
    u.uRimA.value = 0.5
    const wo = vis.walls(T)
    wallMesh.visible = wo > 0.002 && d > 0.01
    wallMat.opacity = 0.62 * wo
  })

  const outline = useMemo(() => new Float32Array((N + 1) * 3), [])
  const writeOutline = useMemo(() => outlineWriter(src, vis.depth), [src, vis])
  const ghostPts = useMemo(() => new Float32Array((N + 1) * 3), [])
  const writeGhost = useMemo(() => outlineWriter(src, vis.depth), [src, vis])
  const ghost = vis.ghost

  // the base of the prism: its outline on the web and one vertical edge per
  // vertex, so the risen shape reads as a solid (they fade with its height)
  const base = useMemo(() => new Float32Array((N + 1) * 3), [])
  const lastB = useRef(-1)
  const writeBase = (_T: number, pts: Float32Array): boolean => {
    if (src.v === lastB.current) return false
    lastB.current = src.v
    for (let k = 0; k <= N; k++) {
      const i = k % N
      pts[k * 3] = px(i, Math.max(0, src.r[i]))
      pts[k * 3 + 1] = py(i, Math.max(0, src.r[i]))
      pts[k * 3 + 2] = 0.015
    }
    return true
  }
  const pillars = useMemo(() => new Float32Array(N * 6).fill(AWAY), [])
  const lastP = useRef({ v: -1, d: -1 })
  const writePillars = (T: number, s: Float32Array): boolean => {
    const d = vis.depth(T)
    if (src.v === lastP.current.v && d === lastP.current.d) return false
    lastP.current.v = src.v
    lastP.current.d = d
    for (let i = 0; i < N; i++) {
      const r = Math.max(0, src.r[i])
      const o = i * 6
      s[o] = px(i, r)
      s[o + 1] = py(i, r)
      s[o + 2] = 0.015
      s[o + 3] = s[o]
      s[o + 4] = s[o + 1]
      s[o + 5] = d
    }
    return true
  }
  const rise = (T: number) => Math.max(0, Math.min(1, (vis.depth(T) - 0.1) / 0.5))

  return (
    <>
      <primitive object={wallMesh} />
      <primitive object={fillMesh} />
      <Pen points={base} color={color} width={PEN.grid} update={writeBase} opacity={(T) => 0.55 * rise(T) * vis.walls(T)} renderOrder={33} />
      <PenBatch segments={pillars} color={color} width={PEN.grid} update={writePillars} opacity={(T) => 0.7 * rise(T) * vis.walls(T)} renderOrder={33} />
      <Pen
        points={outline}
        color={color}
        width={PEN.data}
        update={writeOutline}
        opacity={ghost ? (T) => vis.outline(T) * (1 - ghost(T)) : vis.outline}
        dim={vis.outlineDim}
        gain={vis.gain}
        renderOrder={34}
      />
      {ghost && (
        <Pen
          points={ghostPts}
          color={color}
          width={1.75}
          update={writeGhost}
          opacity={(T) => vis.outline(T) * ghost(T)}
          dim={() => vis.ghostDim ?? 0.45}
          renderOrder={34}
        />
      )}
      <Nodes
        count={N}
        radius={nodeRadius}
        color={PAL.chalk}
        colors={nodeColors}
        rimStrength={0.6}
        emissiveIntensity={0.5}
        opacity={vis.nodes}
        place={(T, i, out) => {
          const r = Math.max(0, src.r[i])
          out[0] = px(i, r)
          out[1] = py(i, r)
          out[2] = vis.depth(T) + 0.02
          return vis.nodeK ? vis.nodeK(T, i) : r > 0.05 ? 1 : 0
        }}
      />
    </>
  )
}

/* ------------------------------- hatch -------------------------------- */

const HATCH_K = 10

/**
 * The gap between an inner profile and an outer one, along every ray (B.9
 * hatch): where the inner is below the outer, the band between them. aU is
 * the clockwise sweep from Strength, so `reveal` sweeps the hatch round.
 */
export function Hatch({ inner, outer, color, alpha, opacity, reveal, z = 0.004 }: { inner: ProfileSrc; outer: ProfileSrc; color: string; alpha: number; opacity: (T: number) => number; reveal: (T: number) => number; z?: number }) {
  const geo = useMemo(() => {
    const cols = N * (HATCH_K + 1)
    const g = new THREE.BufferGeometry()
    const pos = new THREE.BufferAttribute(new Float32Array(cols * 2 * 3), 3)
    pos.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', pos)
    const aT = new Float32Array(cols * 2)
    const aU = new Float32Array(cols * 2)
    const idx: number[] = []
    for (let i = 0; i < N; i++)
      for (let k = 0; k <= HATCH_K; k++) {
        const c = i * (HATCH_K + 1) + k
        aT[c * 2] = 0
        aT[c * 2 + 1] = 1
        aU[c * 2] = aU[c * 2 + 1] = (i + k / HATCH_K) / N
        if (k < HATCH_K) {
          const a = c * 2
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        }
      }
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
    g.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
    g.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(cols * 2), 1))
    g.setIndex(idx)
    return g
  }, [])
  const mat = useMemo(() => makeFillMaterial(color, 'hatch'), [color])
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geo, mat)
    m.frustumCulled = false
    m.renderOrder = 13
    return m
  }, [geo, mat])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  const last = useRef({ a: -1, b: -1 })
  useSafeFrame('skills hatch', (T) => {
    const op = opacity(T)
    mesh.visible = op > 0.002
    if (!mesh.visible) return
    mat.uniforms.uOpacity.value = op
    mat.uniforms.uHi.value = alpha
    mat.uniforms.uReveal.value = reveal(T)
    if (inner.v === last.current.a && outer.v === last.current.b) return
    last.current.a = inner.v
    last.current.b = outer.v
    const p = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N
      const a1 = spokeAngle(i)
      for (let k = 0; k <= HATCH_K; k++) {
        const ang = a1 - ((Math.PI * 2) / N) * (k / HATCH_K)
        const ro = chordRadius(i, outer.r[i], outer.r[j], ang)
        const ri = Math.min(ro, chordRadius(i, inner.r[i], inner.r[j], ang))
        const o = (i * (HATCH_K + 1) + k) * 6
        const cx = Math.cos(ang)
        const cy = Math.sin(ang)
        p[o] = ri * cx
        p[o + 1] = ri * cy
        p[o + 2] = z
        p[o + 3] = ro * cx
        p[o + 4] = ro * cy
        p[o + 5] = z
      }
    }
    ;(geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })
  return <primitive object={mesh} />
}

/* ------------------------------- rings -------------------------------- */

const CIRCLE_N = 96
/** A unit circle polyline from 12 o'clock, clockwise (CIRCLE_N + 1 points). */
export function circlePolyline(z: number): Float32Array {
  const out = new Float32Array((CIRCLE_N + 1) * 3)
  for (let k = 0; k <= CIRCLE_N; k++) {
    const a = Math.PI / 2 - (k / CIRCLE_N) * Math.PI * 2
    out[k * 3] = Math.cos(a)
    out[k * 3 + 1] = Math.sin(a)
    out[k * 3 + 2] = z
  }
  return out
}

/**
 * A dashed floor ring (D.2): a pen circle at radius `radius(T)`, drawn on from
 * 12 o'clock clockwise by `progress`. Dashes keep their world length, so a
 * collapsing ring keeps its rhythm.
 */
export function FloorRing({
  radius,
  z,
  lift,
  color,
  progress,
  opacity,
  dim,
  gain,
  head = false,
  hot = false,
  width = PEN.data,
  dash = 0.42,
  keyline = false,
  keylineK,
}: {
  radius: (T: number) => number
  z: number
  /** extra z as a function of T (the ring rides the prism's cap) */
  lift?: (T: number) => number
  color: string
  progress?: (T: number) => number
  opacity: (T: number) => number
  dim?: (T: number) => number
  gain?: (T: number) => number
  head?: boolean
  hot?: boolean
  width?: number
  dash?: number
  /** an ink keyline under the dashes: the ring's edge stays crisp over a fill of its own colour (L10) */
  keyline?: boolean
  /** the keyline's own fade (a ring that steps back to a ghost drops its keyline) */
  keylineK?: (T: number) => number
}) {
  const unit = useMemo(() => circlePolyline(z), [z])
  const pts = useMemo(() => unit.slice(), [unit])
  const keyPts = useMemo(() => unit.slice(), [unit])
  const write = useMemo(() => ringWriter(unit, radius, z, lift), [unit, radius, z, lift])
  const writeKey = useMemo(() => ringWriter(unit, radius, z - 0.004, lift), [unit, radius, z, lift])
  return (
    <>
      {keyline && (
        <Pen
          points={keyPts}
          color={PAL.ink}
          width={width + 3}
          update={writeKey}
          progress={progress}
          opacity={keylineK ? (T) => opacity(T) * keylineK(T) : opacity}
          renderOrder={35}
        />
      )}
      <Pen
        points={pts}
        color={color}
        width={width}
        dashed
        dashSize={dash}
        gapSize={dash * 0.7}
        update={write}
        progress={progress}
        opacity={opacity}
        dim={dim}
        gain={gain}
        head={head}
        hot={hot}
        renderOrder={35}
      />
    </>
  )
}

/** A cached writer of a circle of radius(T) on the plane z + lift(T). */
function ringWriter(unit: Float32Array, radius: (T: number) => number, z: number, lift?: (T: number) => number) {
  const last = { r: -1, z: -1 }
  return (T: number, p: Float32Array): boolean => {
    const r = radius(T)
    const zz = z + (lift ? lift(T) : 0)
    if (r === last.r && zz === last.z) return false
    last.r = r
    last.z = zz
    for (let k = 0; k < p.length; k += 3) {
      p[k] = unit[k] * r
      p[k + 1] = unit[k + 1] * r
      p[k + 2] = zz
    }
    return true
  }
}

/* ------------------------------- minis -------------------------------- */

export interface MiniCell {
  profile: readonly number[]
  floor: number
  color: string
  /** the lit cell (the generalist): brighter fill and a blooming rim */
  lit: boolean
}

export interface MinisVis {
  /** cell k centre and grow (0 hides it); write [cx, cy] into out */
  place: (T: number, k: number, out: [number, number]) => number
  /** the floor ring of cell k: 0..1 (drawn after the shape) */
  ring: (T: number, k: number) => number
  /** fills, outlines and rings all fade together */
  opacity: (T: number) => number
  /** changes whenever anything above can have changed (a number: no string per frame) */
  key: (T: number) => number
}

const MINI_CIRCLE = 40

/**
 * The small multiples (D.2 S5): 13 mini radars in four draw calls. Each has
 * a faint reference ring (a rating of 10), a luminous fill, its outline and
 * its dashed floor ring at the weakest skill.
 */
export function Minis({ cells, vis, low, z = 0 }: { cells: readonly MiniCell[]; vis: MinisVis; low: boolean; z?: number }) {
  const n = cells.length
  // the specialists' areas are a dim chalk (faint light, not grey slabs);
  // only the lit cell's rim goes HDR and blooms (L4)
  const fan = useMemo(
    () => fanGeometry(n, cells.map((c) => (c.lit ? c.color : '#737d82')), cells.map((c) => (c.lit ? 1 : 0.2))),
    [n, cells],
  )
  const fillMat = useMemo(() => makeFillMaterial('#ffffff', 'gradient', { vertexColors: true, additive: !low, rimScale: true }), [low])
  const fillMesh = useMemo(() => {
    const m = new THREE.Mesh(fan, fillMat)
    m.frustumCulled = false
    m.renderOrder = 12
    return m
  }, [fan, fillMat])
  useEffect(() => () => fan.dispose(), [fan])
  useEffect(() => () => fillMat.dispose(), [fillMat])

  const outline = useMemo(() => new Float32Array(n * N * 6).fill(AWAY), [n])
  const outlineCols = useMemo(() => {
    const c = new Float32Array(n * N * 6)
    cells.forEach((cell, k) => {
      const col = lin(cell.color)
      if (!cell.lit) col.multiplyScalar(0.8)
      for (let i = 0; i < N; i++) c.set([col.r, col.g, col.b, col.r, col.g, col.b], (k * N + i) * 6)
    })
    return c
  }, [n, cells])
  const refRings = useMemo(() => new Float32Array(n * MINI_CIRCLE * 6).fill(AWAY), [n])
  const floors = useMemo(() => new Float32Array(n * MINI_CIRCLE * 6).fill(AWAY), [n])
  const floorCols = useMemo(() => {
    const c = new Float32Array(n * MINI_CIRCLE * 6)
    cells.forEach((cell, k) => {
      const col = lin(cell.lit ? PAL.yellowGreen : PAL.chalk)
      for (let i = 0; i < MINI_CIRCLE; i++) c.set([col.r, col.g, col.b, col.r, col.g, col.b], (k * MINI_CIRCLE + i) * 6)
    })
    return c
  }, [n, cells])

  // one shared per-frame layout pass: every buffer below reads it
  const lay = useRef({ key: Number.NaN, v: 0, cx: new Float32Array(n), cy: new Float32Array(n), g: new Float32Array(n), ring: new Float32Array(n) })
  const tmp = useMemo<[number, number]>(() => [0, 0], [])
  const refresh = (T: number) => {
    const key = vis.key(T)
    const L = lay.current
    if (key === L.key) return
    L.key = key
    L.v++
    for (let k = 0; k < n; k++) {
      L.g[k] = Math.max(0, vis.place(T, k, tmp))
      L.cx[k] = tmp[0]
      L.cy[k] = tmp[1]
      L.ring[k] = vis.ring(T, k)
    }
  }
  const lastFill = useRef(-1)
  useSafeFrame('skills minis', (T) => {
    const op = vis.opacity(T)
    fillMesh.visible = op > 0.002
    if (!fillMesh.visible) return
    refresh(T)
    const u = fillMat.uniforms
    u.uOpacity.value = op
    u.uLo.value = low ? 0.1 : 0.05
    u.uHi.value = low ? 0.45 : 0.34
    u.uPow.value = 1.3
    u.uRim.value = low ? 0.3 : 1.6
    u.uRimW.value = 0.16
    u.uRimA.value = 0.45
    const L = lay.current
    if (L.v === lastFill.current) return
    lastFill.current = L.v
    const s = MINI_R / R
    for (let k = 0; k < n; k++) writeFan(fan, k, L.cx[k], L.cy[k], cells[k].profile, s * L.g[k], z)
  }, { priority: -1 })

  const lastO = useRef(-1)
  const writeOutline = (T: number, seg: Float32Array): boolean => {
    if (vis.opacity(T) <= 0.002) return false
    refresh(T)
    const L = lay.current
    if (L.v === lastO.current) return false
    lastO.current = L.v
    const s = MINI_R / R
    for (let k = 0; k < n; k++) {
      const g = L.g[k]
      for (let i = 0; i < N; i++) {
        const o = (k * N + i) * 6
        if (g <= 0.001) {
          seg.fill(AWAY, o, o + 6)
          continue
        }
        const j = (i + 1) % N
        const p = cells[k].profile
        seg[o] = L.cx[k] + px(i, p[i] * s * g)
        seg[o + 1] = L.cy[k] + py(i, p[i] * s * g)
        seg[o + 2] = z + 0.01
        seg[o + 3] = L.cx[k] + px(j, p[j] * s * g)
        seg[o + 4] = L.cy[k] + py(j, p[j] * s * g)
        seg[o + 5] = z + 0.01
      }
    }
    return true
  }
  const circleInto = (seg: Float32Array, k: number, cx: number, cy: number, r: number, zz: number, frac = 1) => {
    for (let i = 0; i < MINI_CIRCLE; i++) {
      const o = (k * MINI_CIRCLE + i) * 6
      if (r <= 0.001 || i >= Math.ceil(frac * MINI_CIRCLE)) {
        seg.fill(AWAY, o, o + 6)
        continue
      }
      const e = Math.min(1, frac * MINI_CIRCLE - i)
      const a0 = Math.PI / 2 - (i / MINI_CIRCLE) * Math.PI * 2
      const a1 = Math.PI / 2 - ((i + e) / MINI_CIRCLE) * Math.PI * 2
      seg[o] = cx + r * Math.cos(a0)
      seg[o + 1] = cy + r * Math.sin(a0)
      seg[o + 2] = zz
      seg[o + 3] = cx + r * Math.cos(a1)
      seg[o + 4] = cy + r * Math.sin(a1)
      seg[o + 5] = zz
    }
  }
  const lastR = useRef(-1)
  const writeRef = (T: number, seg: Float32Array): boolean => {
    if (vis.opacity(T) <= 0.002) return false
    refresh(T)
    const L = lay.current
    if (L.v === lastR.current) return false
    lastR.current = L.v
    for (let k = 0; k < n; k++) circleInto(seg, k, L.cx[k], L.cy[k], MINI_R * L.g[k], z - 0.01)
    return true
  }
  const lastF = useRef(-1)
  const writeFloors = (T: number, seg: Float32Array): boolean => {
    if (vis.opacity(T) <= 0.002) return false
    refresh(T)
    const L = lay.current
    if (L.v === lastF.current) return false
    lastF.current = L.v
    const s = MINI_R / R
    for (let k = 0; k < n; k++) circleInto(seg, k, L.cx[k], L.cy[k], cells[k].floor * s * L.g[k], z + 0.02, L.ring[k])
    return true
  }

  return (
    <>
      <PenBatch segments={refRings} color={PAL.chalk} width={PEN.grid} update={writeRef} opacity={(T) => 0.16 * vis.opacity(T)} renderOrder={29} />
      <primitive object={fillMesh} />
      <PenBatch segments={outline} colors={outlineCols} width={PEN.axis} update={writeOutline} opacity={vis.opacity} renderOrder={32} />
      {/* the floor ring is each cell's payoff: a bold dash that reads at 360 px */}
      <PenBatch segments={floors} colors={floorCols} width={2.4} dashed dashSize={0.36} gapSize={0.2} update={writeFloors} opacity={vis.opacity} renderOrder={33} />
    </>
  )
}
