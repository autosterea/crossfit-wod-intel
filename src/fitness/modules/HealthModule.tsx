import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  AGING_PROFILES,
  INDEPENDENCE_LINE,
  MODULE_COPY,
  PAL,
  agingCapacity,
  moduleByKey,
  spectrum,
  type AgingProfile,
} from '../fitnessData'
import { clamp, lerp, map, prefersReducedMotion, smoothK, smoothstep } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ControlHead, ModulePage, PresetButtons, Readout, Segmented, Slider } from '../ui'

/* =========================================================================
   Module 06 - Sustained work capacity across a lifetime is health.
   A 3D capacity surface over (effort duration x age), vertex-colored by the
   sickness-wellness-fitness spectrum, with an amber age-slice curve (the
   fitness curve from module 04 at one age) and a translucent red independence
   line. Profile presets smoothly morph the whole surface; an age slider drives
   the slice. Ported from moduleHealth() in what-is-fitness-3d.html and grounded
   in AGING_PROFILES / agingCapacity / INDEPENDENCE_LINE from fitnessData.
   ========================================================================= */

/* ----------------------------- scene constants ------------------------- */
const X0 = -10
const X1 = 10
const Z0 = 9
const Z1 = -9
const YS = 7.2 // world height for capacity = 1.0
const ND = 56 // duration samples (X)
const NA = 46 // age samples (Z)
const AGE_MIN = 20
const AGE_MAX = 85

// Score scaling carried over from the source so the 0..100 readouts match.
const HEALTH_SCALE = 175
const FITNESS_SCALE = 143

/* ------------------------- extra aging profiles ------------------------ *
 * The shared AGING_PROFILES (fitnessData) ships four canonical trajectories.
 * The user asked for MORE options, so we compose additional, physiologically
 * honest AgingProfile objects LOCALLY here (fitnessData is untouched) and merge
 * them into the preset list. Each new ampAt(age) returns a 0..1 amplitude that
 * the shared agingCapacity() multiplies by the duration shape - so these obey
 * the exact same surface model as the built-ins, just with different histories.
 *
 * Honesty notes:
 *  - "Detrained at 40": a trained adult who stops cold at 40. Capacity holds
 *    high until ~38 then drops steeply over the next several years (accelerated
 *    sarcopenia / power loss when training stops), settling toward a low,
 *    sedentary-like decline tail. Crosses the line earlier than a lifelong
 *    trainer but later than someone never trained.
 *  - "Masters competitor": trains hard for life, a notch below the elite
 *    lifelong trainer (a touch lower peak, a slightly steeper post-50 slope)
 *    yet still well above the line into the late eighties.
 *  - "Sedentary then active at 60": the late-start mirror of "Starts at 50" but
 *    later - decades sedentary, then resistance + power training at 60 reclaims
 *    real capacity (the literature: trainable even into the 90s), lifting the
 *    whole surface and buying years of independence.
 */
const detrainedSed = (a: number): number =>
  Math.max(a < 24 ? 0.5 : 0.5 * (1 - (0.14 * (a - 24)) / 10), 0.06)

const EXTRA_PROFILES: AgingProfile[] = [
  {
    name: 'Detrained at 40',
    trajectory: 'Trained and strong through the thirties, then training stops at 40 and the surface drops steeply over the next decade as power and muscle are lost. The crossing comes early.',
    peak: 0.85,
    independentThrough: '74',
    ampAt: (a) => {
      const trained = Math.max(a < 32 ? 0.85 : 0.85 - (0.045 * (a - 32)) / 10, 0.3)
      const fell = detrainedSed(a)
      // smoothly hand off from the trained track to the detrained decline at 40
      const k = smoothstep(38, 47, a)
      return Math.max(lerp(trained, fell, k), 0.06)
    },
    modality: 0.62,
  },
  {
    name: 'Masters competitor',
    trajectory: 'Trains hard for life and competes into the masters divisions. A notch below the elite lifelong trainer, with a slightly steeper slope past fifty, yet still far above the line deep into old age.',
    peak: 0.92,
    independentThrough: '88',
    ampAt: (a) => {
      if (a < 30) return 0.92
      // gentle to 50, a touch steeper after (power fades fastest past 50)
      const early = 0.92 - (0.04 * (a - 30)) / 10
      const late = 0.92 - (0.04 * 20) / 10 - (0.07 * (a - 50)) / 10
      return Math.max(a < 50 ? early : late, 0.34)
    },
    modality: 0.92,
  },
  {
    name: 'Sedentary then active at 60',
    trajectory: 'Decades sedentary, then resistance and power training begun at 60 reclaims real capacity and lifts the whole surface. Proof that the curve responds at any age, buying back years of independence.',
    peak: 0.6,
    independentThrough: '84',
    ampAt: (a) => {
      const sed = Math.max(a < 24 ? 0.45 : 0.45 * (1 - (0.16 * (a - 24)) / 10), 0.05)
      // the reclaimed track the late starter rises onto (a moderate trained adult)
      const tr = Math.max(a < 32 ? 0.66 : 0.66 - (0.05 * (a - 32)) / 10, 0.26)
      const k = smoothstep(58, 66, a)
      return lerp(sed, tr, k)
    },
    modality: 0.45,
  },
]

/** Built-in profiles plus the local extras, in one list for lookup + presets. */
const ALL_PROFILES: AgingProfile[] = [...AGING_PROFILES, ...EXTRA_PROFILES]
const PROFILE_NAMES = ALL_PROFILES.map((p) => p.name)

/* ------------------------------ small helpers -------------------------- */

const zOfAge = (age: number) => map(age, AGE_MIN, AGE_MAX, Z0, Z1)
const colorOf = (cap: number) => spectrum(cap / 0.9)

/** Mean capacity along one age slice (averaged across the duration axis). */
function sliceMean(p: AgingProfile, age: number): number {
  const N = 48
  let s = 0
  for (let i = 0; i < N; i++) s += agingCapacity(i / (N - 1), age, p)
  return s / N
}

/** Health = volume under the surface = mean capacity over every age and duration. */
function healthScore(p: AgingProfile): number {
  let s = 0
  for (let ai = 0; ai < NA; ai++) {
    const age = map(ai, 0, NA - 1, AGE_MIN, AGE_MAX)
    for (let di = 0; di < ND; di++) s += agingCapacity(di / (ND - 1), age, p)
  }
  return clamp(Math.round((s / (ND * NA)) * HEALTH_SCALE), 0, 100)
}

/** Fitness at one age = the area under that single slice, scaled 0..100. */
function fitnessAt(p: AgingProfile, age: number): number {
  return clamp(Math.round(sliceMean(p, age) * FITNESS_SCALE), 0, 100)
}

/** Build the flat capacity grid for a profile (row-major, age outer, duration inner). */
function gridFor(p: AgingProfile): Float32Array {
  const arr = new Float32Array(ND * NA)
  for (let ai = 0; ai < NA; ai++) {
    const age = map(ai, 0, NA - 1, AGE_MIN, AGE_MAX)
    for (let di = 0; di < ND; di++) arr[ai * ND + di] = agingCapacity(di / (ND - 1), age, p)
  }
  return arr
}

/**
 * Port of makeLabel(): a crisp text sprite drawn on a CanvasTexture (no network
 * font fetch). Returns the THREE.Sprite plus a dispose() for cleanup.
 */
function makeLabel(
  text: string,
  opt: { fontPx?: number; worldHeight?: number; color?: string; weight?: string } = {},
): { sprite: THREE.Sprite; dispose: () => void } {
  const color = opt.color ?? PAL.chalk
  const fontPx = opt.fontPx ?? 30
  const weight = opt.weight ?? '600'
  const worldH = opt.worldHeight ?? 0.52
  const family = 'ui-monospace, "SFMono-Regular", Menlo, monospace'
  const padX = 22
  const padY = 14
  const SS = 2 // supersample for sharpness

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `${weight} ${fontPx * SS}px ${family}`
  const tw = measure.measureText(text).width
  const w = Math.ceil(tw + padX * 2 * SS)
  const h = Math.ceil(fontPx * SS + padY * 2 * SS)

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!

  // High-contrast dark rounded-pill background so text reads on any 3D color.
  const r = Math.min(h * 0.32, 26 * SS)
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
  ctx.fillStyle = 'rgba(7,10,14,0.72)'
  ctx.fill()

  ctx.font = `${weight} ${fontPx * SS}px ${family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2 + SS)

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  tex.minFilter = THREE.LinearFilter
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(worldH * (w / h), worldH, 1)
  return { sprite, dispose: () => { tex.dispose(); mat.dispose() } }
}

const SLICE_N = 60

/* =============================== the 3D scene ============================ */

interface SceneProps {
  profile: AgingProfile
  ageSlice: number
  showLine: boolean
  reduced: boolean
}

function HealthScene({ profile, ageSlice, showLine, reduced }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null)

  /* ---- the morphing capacity surface (geometry built once, mutated live) ---- */
  const surfGeo = useMemo(() => {
    const verts = ND * NA
    const pos = new Float32Array(verts * 3)
    const col = new Float32Array(verts * 3)
    const idx: number[] = []
    for (let ai = 0; ai < NA; ai++) {
      for (let di = 0; di < ND; di++) {
        const i = ai * ND + di
        pos[i * 3] = map(di, 0, ND - 1, X0, X1)
        pos[i * 3 + 1] = 0
        pos[i * 3 + 2] = map(ai, 0, NA - 1, Z0, Z1)
      }
    }
    for (let a = 0; a < NA - 1; a++) {
      for (let d = 0; d < ND - 1; d++) {
        const i0 = a * ND + d
        const i1 = i0 + 1
        const i2 = i0 + ND
        const i3 = i2 + 1
        idx.push(i0, i2, i1, i1, i2, i3)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setIndex(idx)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])

  /* ---- the VOLUME solid: the surface extruded straight down to the floor ----
     This is the whole point of the module: HEALTH IS THE VOLUME under the
     surface, so we render that volume as a real translucent solid - skirt walls
     dropping from every perimeter point of the surface down to y=0, capped by a
     floor. Both share the surface's (X,Z) footprint and grid resolution, so the
     volume is rebuilt only when the surface morphs (in applyGrid), never per
     frame. Vertex-colored by the same sickness-wellness-fitness spectrum as the
     surface, darkened toward the floor for depth. */
  const PERIM = useMemo<number[]>(() => {
    // grid indices walked once around the perimeter (front, right, back, left).
    const p: number[] = []
    for (let di = 0; di < ND; di++) p.push(0 * ND + di) // front (ai=0)
    for (let ai = 1; ai < NA; ai++) p.push(ai * ND + (ND - 1)) // right
    for (let di = ND - 2; di >= 0; di--) p.push((NA - 1) * ND + di) // back
    for (let ai = NA - 2; ai >= 1; ai--) p.push(ai * ND + 0) // left
    return p
  }, [])

  const volGeo = useMemo(() => {
    const np = PERIM.length
    // Skirt: top rim verts (0..np-1) + bottom rim verts (np..2np-1).
    // Floor cap: a full ND*NA grid of verts at y=0, reusing the surface layout.
    const skirtVerts = np * 2
    const capVerts = ND * NA
    const total = skirtVerts + capVerts
    const pos = new Float32Array(total * 3)
    const col = new Float32Array(total * 3)
    const idx: number[] = []

    // static positions: top rim x/z (its y is morphed in applyVolume), the
    // bottom rim (y=0), and the whole floor cap (y=0).
    for (let k = 0; k < np; k++) {
      const g = PERIM[k]
      const di = g % ND
      const ai = Math.floor(g / ND)
      const x = map(di, 0, ND - 1, X0, X1)
      const z = map(ai, 0, NA - 1, Z0, Z1)
      // top rim (y filled later by applyVolume)
      pos[k * 3] = x
      pos[k * 3 + 1] = 0
      pos[k * 3 + 2] = z
      // bottom rim on the floor
      const bi = (np + k) * 3
      pos[bi] = x
      pos[bi + 1] = 0
      pos[bi + 2] = z
    }
    const capBase = skirtVerts
    for (let ai = 0; ai < NA; ai++) {
      for (let di = 0; di < ND; di++) {
        const v = capBase + ai * ND + di
        pos[v * 3] = map(di, 0, ND - 1, X0, X1)
        pos[v * 3 + 1] = 0
        pos[v * 3 + 2] = map(ai, 0, NA - 1, Z0, Z1)
      }
    }

    // skirt quads: each perimeter segment becomes top0-top1-bot1 / top0-bot1-bot0.
    for (let k = 0; k < np; k++) {
      const k1 = (k + 1) % np
      const t0 = k
      const t1 = k1
      const b0 = np + k
      const b1 = np + k1
      idx.push(t0, b0, b1, t0, b1, t1)
    }
    // floor cap (faces down) - reversed winding so it reads from below.
    for (let a = 0; a < NA - 1; a++) {
      for (let d = 0; d < ND - 1; d++) {
        const i0 = capBase + a * ND + d
        const i1 = i0 + 1
        const i2 = i0 + ND
        const i3 = i2 + 1
        idx.push(i0, i1, i2, i1, i3, i2)
      }
    }

    const g = new THREE.BufferGeometry()
    g.setIndex(idx)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [PERIM])

  /* ---- amber slice: a filled area + a bright top curve (fixed vertex counts) ---- */
  const sliceGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SLICE_N - 1) * 6 * 3), 3))
    return g
  }, [])
  const curveGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SLICE_N * 3), 3))
    return g
  }, [])

  /* ---- static axis frame, ticks, and CAPACITY/DURATION/AGE labels ---- */
  const frame = useMemo(() => {
    const objs: THREE.Object3D[] = []
    const disposers: (() => void)[] = []

    const per = [
      new THREE.Vector3(X0, 0, Z0),
      new THREE.Vector3(X1, 0, Z0),
      new THREE.Vector3(X1, 0, Z1),
      new THREE.Vector3(X0, 0, Z1),
      new THREE.Vector3(X0, 0, Z0),
    ]
    const perGeo = new THREE.BufferGeometry().setFromPoints(per)
    const perMat = new THREE.LineBasicMaterial({ color: new THREE.Color(PAL.yellowGreen), transparent: true, opacity: 0.55 })
    objs.push(new THREE.Line(perGeo, perMat))
    disposers.push(() => { perGeo.dispose(); perMat.dispose() })

    const addLabel = (
      text: string,
      x: number,
      y: number,
      z: number,
      o: { fontPx?: number; worldHeight?: number } = {},
    ) => {
      const { sprite, dispose } = makeLabel(text, { fontPx: 30, worldHeight: 0.52, color: PAL.chalk, ...o })
      sprite.position.set(x, y, z)
      objs.push(sprite)
      disposers.push(dispose)
    }

    // duration ticks (log axis: 1s -> 1hr over u in 0..1 against 3600s)
    const LOGMAX = Math.log10(3600)
    const durTicks: [string, number][] = [['1 s', 1], ['1 min', 60], ['5 min', 300], ['1 hr', 3600]]
    for (const [lab, sec] of durTicks) {
      const x = map(Math.log10(sec) / LOGMAX, 0, 1, X0, X1)
      addLabel(lab, x, 0.12, Z0 + 0.95)
    }
    for (const a of [20, 40, 60, 80]) addLabel(String(a), X1 + 1.1, 0.12, zOfAge(a))

    addLabel('DURATION', 0, 0.12, Z0 + 2.15, { fontPx: 36, worldHeight: 0.72 })
    addLabel('AGE', X1 + 2.7, 0.12, 0, { fontPx: 36, worldHeight: 0.72 })
    addLabel('CAPACITY', X0 - 1.6, YS * 0.97, Z1 + 1.0, { fontPx: 36, worldHeight: 0.72 })

    return { objs, dispose: () => disposers.forEach((d) => d()) }
  }, [])

  /* ---- animation state held in refs (never per-frame React state) ----
     Refs are lazily initialized with the null pattern and only mutated inside
     effects / the frame loop, never during render. */
  const curGrid = useRef<Float32Array | null>(null)
  const tgtGrid = useRef<Float32Array | null>(null)
  const animating = useRef(false)
  const ageRef = useRef(ageSlice)
  const clockRef = useRef(0)
  // Where the moving AGE label should sit (kept in a ref the label reads).
  const labelTopY = useRef(YS * 0.6)

  if (curGrid.current === null) {
    curGrid.current = gridFor(profile)
    tgtGrid.current = curGrid.current.slice()
  }

  /**
   * Push the grid into the extruded VOLUME solid: lift each top-rim vertex onto
   * the surface, tint the rim by the spectrum, and shade the skirt/floor darker
   * toward the ground so the translucent solid reads as a real volume. Same
   * cadence as applyGrid (morph / first paint only), never per frame.
   */
  const applyVolume = (grid: Float32Array) => {
    const np = PERIM.length
    const posAttr = volGeo.getAttribute('position') as THREE.BufferAttribute
    const colAttr = volGeo.getAttribute('color') as THREE.BufferAttribute
    const pa = posAttr.array as Float32Array
    const ca = colAttr.array as Float32Array

    // top + bottom rim: lift tops onto the surface, color both rims (skirt walls).
    for (let k = 0; k < np; k++) {
      const cap = grid[PERIM[k]]
      const rgb = colorOf(cap)
      // top rim sits on the surface
      pa[k * 3 + 1] = cap * YS
      ca[k * 3] = rgb[0]
      ca[k * 3 + 1] = rgb[1]
      ca[k * 3 + 2] = rgb[2]
      // bottom rim: same hue, darkened toward the floor for depth
      const bi = np + k
      ca[bi * 3] = rgb[0] * 0.28
      ca[bi * 3 + 1] = rgb[1] * 0.28
      ca[bi * 3 + 2] = rgb[2] * 0.28
    }
    // floor cap: tinted by each cell's capacity, dimmed (it is the deep underside).
    const capBase = np * 2
    for (let i = 0; i < grid.length; i++) {
      const rgb = colorOf(grid[i])
      const v = (capBase + i) * 3
      ca[v] = rgb[0] * 0.22
      ca[v + 1] = rgb[1] * 0.22
      ca[v + 2] = rgb[2] * 0.22
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  }

  /** Push the current grid into surface position.y + vertex colors (+ volume). */
  const applyGrid = (grid: Float32Array) => {
    const posAttr = surfGeo.getAttribute('position') as THREE.BufferAttribute
    const colAttr = surfGeo.getAttribute('color') as THREE.BufferAttribute
    const pa = posAttr.array as Float32Array
    const ca = colAttr.array as Float32Array
    for (let i = 0; i < grid.length; i++) {
      pa[i * 3 + 1] = grid[i] * YS
      const rgb = colorOf(grid[i])
      ca[i * 3] = rgb[0]
      ca[i * 3 + 1] = rgb[1]
      ca[i * 3 + 2] = rgb[2]
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    surfGeo.computeVertexNormals()
    applyVolume(grid)
  }

  /**
   * Rebuild the amber slice from the (possibly mid-morph) grid + chosen age.
   * Returns the world-space top of the slice so the AGE label can sit on it.
   */
  const buildSlice = (grid: Float32Array, age: number): number => {
    const z = zOfAge(age)
    const curve = curveGeo.getAttribute('position').array as Float32Array
    const fill = sliceGeo.getAttribute('position').array as Float32Array

    const ageF = clamp(map(age, AGE_MIN, AGE_MAX, 0, NA - 1), 0, NA - 1)
    const a0 = Math.floor(ageF)
    const a1 = Math.min(NA - 1, a0 + 1)
    const af = ageF - a0
    const capAt = (di: number) => lerp(grid[a0 * ND + di], grid[a1 * ND + di], af)
    const sample = (u: number) => {
      const di = u * (ND - 1)
      const d0 = Math.floor(di)
      const d1 = Math.min(ND - 1, d0 + 1)
      return lerp(capAt(d0), capAt(d1), di - d0)
    }

    let topY = 0
    for (let i = 0; i < SLICE_N; i++) {
      const u = i / (SLICE_N - 1)
      const y = sample(u) * YS
      const x = map(u, 0, 1, X0, X1)
      curve[i * 3] = x
      curve[i * 3 + 1] = y + 0.07
      curve[i * 3 + 2] = z
      if (i === SLICE_N - 1) topY = y
      if (i < SLICE_N - 1) {
        const u2 = (i + 1) / (SLICE_N - 1)
        const y2 = sample(u2) * YS
        const x2 = map(u2, 0, 1, X0, X1)
        const b = i * 18
        fill[b + 0] = x; fill[b + 1] = 0; fill[b + 2] = z
        fill[b + 3] = x2; fill[b + 4] = 0; fill[b + 5] = z
        fill[b + 6] = x; fill[b + 7] = y; fill[b + 8] = z
        fill[b + 9] = x2; fill[b + 10] = 0; fill[b + 11] = z
        fill[b + 12] = x2; fill[b + 13] = y2; fill[b + 14] = z
        fill[b + 15] = x; fill[b + 16] = y; fill[b + 17] = z
      }
    }
    curveGeo.getAttribute('position').needsUpdate = true
    sliceGeo.getAttribute('position').needsUpdate = true
    curveGeo.computeBoundingSphere()
    sliceGeo.computeBoundingSphere()
    return topY
  }

  // Keep the latest age available to the frame loop without re-subscribing.
  useEffect(() => {
    ageRef.current = ageSlice
  }, [ageSlice])

  // First paint: lay the initial grid + slice down once the geometries exist.
  useEffect(() => {
    const grid = curGrid.current
    if (!grid) return
    applyGrid(grid)
    labelTopY.current = buildSlice(grid, ageRef.current)
    // run once on mount; applyGrid/buildSlice are stable closures over memoized geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Retarget the morph whenever the chosen profile changes.
  useEffect(() => {
    const next = gridFor(profile)
    tgtGrid.current = next
    if (reduced) {
      curGrid.current = next.slice()
      animating.current = false
      applyGrid(curGrid.current)
      labelTopY.current = buildSlice(curGrid.current, ageRef.current)
    } else {
      animating.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, reduced])

  useFrame((_, dt) => {
    const grid = curGrid.current
    const tgt = tgtGrid.current
    if (!grid || !tgt) return
    const age = ageRef.current
    const stepDt = Math.min(dt, 0.05)
    if (animating.current) {
      const k = smoothK(stepDt, 6)
      let maxd = 0
      for (let i = 0; i < grid.length; i++) {
        grid[i] = lerp(grid[i], tgt[i], k)
        const d = Math.abs(grid[i] - tgt[i])
        if (d > maxd) maxd = d
      }
      if (maxd < 0.0015) {
        grid.set(tgt)
        animating.current = false
      }
      applyGrid(grid)
    }
    // Slice rebuild is cheap (120 verts) so do it every frame: keeps the age
    // slider live and keeps the curve glued to the surface during a morph.
    labelTopY.current = buildSlice(grid, age)

    // Soft idle breathing on the whole group (skipped under reduced motion).
    if (groupRef.current && !reduced) {
      clockRef.current += dt
      groupRef.current.position.y = Math.sin(clockRef.current * 0.6) * 0.06
    }
  })

  // Tear down all GPU resources on unmount.
  useEffect(() => {
    return () => {
      surfGeo.dispose()
      volGeo.dispose()
      sliceGeo.dispose()
      curveGeo.dispose()
      frame.dispose()
    }
  }, [surfGeo, volGeo, sliceGeo, curveGeo, frame])

  const lineY = INDEPENDENCE_LINE * YS

  // The volume's translucency scales with the score: a fitter life fills more of
  // the box, so its solid reads denser. Recomputed only when the profile changes.
  const score = useMemo(() => healthScore(profile), [profile])
  const volOpacity = map(clamp(score, 0, 100), 0, 100, 0.16, 0.42)

  return (
    <group ref={groupRef}>
      {/* dark ground + subtle grid for grounding */}
      <gridHelper args={[28, 28, '#1b2a22', '#0e1813']} position={[0, -0.02, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#070c0a" roughness={1} metalness={0} />
      </mesh>
      <ContactShadows position={[0, -0.03, 0]} scale={26} blur={2.4} opacity={0.45} far={12} resolution={512} color="#000000" />

      {/* THE VOLUME = HEALTH: the surface extruded down to the floor as a real
          translucent solid (skirt walls + floor cap), tinted by the spectrum and
          denser the higher the score. This is the value the module is about. */}
      <mesh geometry={volGeo}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={volOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <VolumeLabel score={score} />

      {/* the capacity surface (vertex-colored) + faint wireframe overlay */}
      <mesh geometry={surfGeo} castShadow>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.55} metalness={0.12} toneMapped={false} />
      </mesh>
      <mesh geometry={surfGeo}>
        <meshBasicMaterial wireframe color="#e8edf6" transparent opacity={0.06} toneMapped={false} />
      </mesh>

      {/* amber age-slice: filled area + bright top line + moving AGE label */}
      <mesh geometry={sliceGeo}>
        <meshBasicMaterial color={PAL.well} transparent opacity={0.17} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <line>
        <primitive object={curveGeo} attach="geometry" />
        <lineBasicMaterial color={PAL.well} toneMapped={false} />
      </line>
      <SliceLabel age={ageSlice} topYRef={labelTopY} />

      {/* translucent red independence-line plane */}
      {showLine && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, lineY, 0]}>
            <planeGeometry args={[X1 - X0 + 1.2, Z0 - Z1 + 1.2]} />
            <meshBasicMaterial color={PAL.sick} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <IndependenceLabel y={lineY} />
        </group>
      )}

      {/* static axis frame + tick / title sprites */}
      {frame.objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  )
}

/** The moving "AGE N" sprite. Rebuilds its texture only when the age changes;
 *  its vertical position tracks the live slice top via a shared ref. */
function SliceLabel({ age, topYRef }: { age: number; topYRef: React.RefObject<number> }) {
  const spriteRef = useRef<THREE.Sprite>(null)
  const made = useMemo(() => makeLabel(`AGE ${age}`, { fontPx: 38, worldHeight: 0.72, color: PAL.well }), [age])
  useEffect(() => () => made.dispose(), [made])
  useFrame(() => {
    if (spriteRef.current) spriteRef.current.position.y = topYRef.current + 0.7
  })
  return <primitive ref={spriteRef} object={made.sprite} position={[X1 + 1.7, YS * 0.6, zOfAge(age)]} />
}

/** The red "INDEPENDENCE LINE" sprite (fixed text). */
function IndependenceLabel({ y }: { y: number }) {
  const made = useMemo(() => makeLabel('INDEPENDENCE LINE', { fontPx: 32, worldHeight: 0.58, color: PAL.sick }), [])
  useEffect(() => () => made.dispose(), [made])
  return <primitive object={made.sprite} position={[X0 + 2.8, y + 0.45, Z0 - 0.4]} />
}

/**
 * The prominent "VOLUME = HEALTH" callout, anchored low at the front of the
 * solid so it tags the translucent volume directly. A drei <Html> pill in the
 * SkillsModule gold-standard style (rounded, dark glass, robust-tinted border,
 * Barlow Condensed), with the live score read large beside it. DOM, so always
 * crisp; zIndexRange [20,0] keeps it below the overlay panels.
 */
function VolumeLabel({ score }: { score: number }) {
  return (
    <Html
      position={[0, YS * 0.34, Z0 + 0.6]}
      center
      distanceFactor={32}
      zIndexRange={[20, 0]}
      occlude={false}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '5px 13px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
          background: 'rgba(7, 10, 14, 0.92)',
          border: `1px solid ${PAL.robust}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
          fontFamily: '"Barlow Condensed", Poppins, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: PAL.chalk,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: PAL.robust, flex: 'none' }} />
        Volume = Health
        <span style={{ color: PAL.robust, fontSize: 22, marginLeft: 2 }}>{score}</span>
      </div>
    </Html>
  )
}

/* =============================== controls ============================== */

interface ControlsProps {
  profile: AgingProfile
  ageSlice: number
  showLine: boolean
  onProfile: (name: string) => void
  onAge: (age: number) => void
  onToggleLine: (on: boolean) => void
}

function HealthControls({ profile, ageSlice, showLine, onProfile, onAge, onToggleLine }: ControlsProps) {
  const health = healthScore(profile)
  const fitness = fitnessAt(profile, ageSlice)
  return (
    <>
      <ControlHead>A lifetime of capacity</ControlHead>

      <Readout
        label="Volume = Health"
        value={
          <>
            {health}
            <span style={{ fontSize: 14, color: PAL.muted }}>/100</span>
          </>
        }
        sub="The translucent solid IS this number: the whole volume under the surface."
        color={PAL.robust}
      />

      <div className="wf-pct-row">
        <div className="wf-pct">
          <div className="p" style={{ color: PAL.well }}>{fitness}</div>
          <div className="n">Fitness at age {ageSlice}</div>
        </div>
        <div className="wf-pct">
          <div className="p" style={{ color: PAL.fit }}>{profile.independentThrough}</div>
          <div className="n">Independent through</div>
        </div>
      </div>

      <div style={{ height: 10 }} />

      <PresetButtons options={PROFILE_NAMES} value={profile.name} onChange={onProfile} />

      <Slider
        label="Slice the surface at age"
        value={ageSlice}
        display={`${ageSlice} yr`}
        min={AGE_MIN}
        max={AGE_MAX}
        step={1}
        dotColor={PAL.well}
        onChange={(v) => onAge(Math.round(v))}
      />

      <Segmented<'on' | 'off'>
        options={[
          { value: 'on', label: 'Independence line on' },
          { value: 'off', label: 'Off' },
        ]}
        value={showLine ? 'on' : 'off'}
        onChange={(v) => onToggleLine(v === 'on')}
      />

      <div style={{ fontSize: 11.5, color: PAL.muted, marginTop: 2, lineHeight: 1.5 }}>
        The amber slice is the fitness curve from model 04, at one age. Health is every slice you will ever
        live, stacked.
      </div>
    </>
  )
}

/* =============================== module ================================ */

export default function HealthModule() {
  const meta = moduleByKey('health')
  const copy = MODULE_COPY.health
  const reduced = useMemo(() => prefersReducedMotion(), [])

  const [profileName, setProfileName] = useState<string>(ALL_PROFILES[0].name)
  const [ageSlice, setAgeSlice] = useState(45)
  const [showLine, setShowLine] = useState(true)

  const profile = useMemo(
    () => ALL_PROFILES.find((p) => p.name === profileName) ?? ALL_PROFILES[0],
    [profileName],
  )

  return (
    <ModulePage moduleKey="health">
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={copy.body}
        camera={{ position: [19.5, 14, 24], fov: 50 }}
        target={[0, 2.8, 0]}
        minDistance={16}
        maxDistance={70}
        controls={
          <HealthControls
            profile={profile}
            ageSlice={ageSlice}
            showLine={showLine}
            onProfile={setProfileName}
            onAge={setAgeSlice}
            onToggleLine={setShowLine}
          />
        }
      >
        <HealthScene profile={profile} ageSlice={ageSlice} showLine={showLine} reduced={reduced} />
      </LessonStage>
    </ModulePage>
  )
}
