import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
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
import { clamp, lerp, map, prefersReducedMotion, smoothK } from '../lessonMath'
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

const PROFILE_NAMES = AGING_PROFILES.map((p) => p.name)

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
  const fontPx = opt.fontPx ?? 24
  const weight = opt.weight ?? '600'
  const worldH = opt.worldHeight ?? 0.42
  const family = 'ui-monospace, "SFMono-Regular", Menlo, monospace'
  const padX = 18
  const padY = 12
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
      const { sprite, dispose } = makeLabel(text, { fontPx: 24, worldHeight: 0.42, color: PAL.muted, ...o })
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

    addLabel('DURATION', 0, 0.12, Z0 + 1.95, { fontPx: 26, worldHeight: 0.5 })
    addLabel('AGE', X1 + 2.5, 0.12, 0, { fontPx: 26, worldHeight: 0.5 })
    addLabel('CAPACITY', X0 - 1.5, YS * 0.95, Z1 + 1.0, { fontPx: 26, worldHeight: 0.5 })

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

  /** Push the current grid into surface position.y + vertex colors. */
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
      sliceGeo.dispose()
      curveGeo.dispose()
      frame.dispose()
    }
  }, [surfGeo, sliceGeo, curveGeo, frame])

  const lineY = INDEPENDENCE_LINE * YS

  return (
    <group ref={groupRef}>
      {/* dark ground + subtle grid for grounding */}
      <gridHelper args={[28, 28, '#1b2a22', '#0e1813']} position={[0, -0.02, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#070c0a" roughness={1} metalness={0} />
      </mesh>
      <ContactShadows position={[0, -0.03, 0]} scale={26} blur={2.4} opacity={0.45} far={12} resolution={512} color="#000000" />

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
  const made = useMemo(() => makeLabel(`AGE ${age}`, { fontPx: 30, worldHeight: 0.56, color: PAL.well }), [age])
  useEffect(() => () => made.dispose(), [made])
  useFrame(() => {
    if (spriteRef.current) spriteRef.current.position.y = topYRef.current + 0.7
  })
  return <primitive ref={spriteRef} object={made.sprite} position={[X1 + 1.7, YS * 0.6, zOfAge(age)]} />
}

/** The red "INDEPENDENCE LINE" sprite (fixed text). */
function IndependenceLabel({ y }: { y: number }) {
  const made = useMemo(() => makeLabel('INDEPENDENCE LINE', { fontPx: 26, worldHeight: 0.46, color: PAL.sick }), [])
  useEffect(() => () => made.dispose(), [made])
  return <primitive object={made.sprite} position={[X0 + 2.8, y + 0.45, Z0 - 0.4]} />
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
        label="Health, volume under the surface"
        value={
          <>
            {health}
            <span style={{ fontSize: 14, color: PAL.muted }}>/100</span>
          </>
        }
        sub="Sustained fitness is health."
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

  const [profileName, setProfileName] = useState<string>(AGING_PROFILES[0].name)
  const [ageSlice, setAgeSlice] = useState(45)
  const [showLine, setShowLine] = useState(true)

  const profile = useMemo(
    () => AGING_PROFILES.find((p) => p.name === profileName) ?? AGING_PROFILES[0],
    [profileName],
  )

  return (
    <ModulePage moduleKey="health">
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={copy.body}
        camera={{ position: [18, 13, 22], fov: 50 }}
        target={[0, 2.4, 0]}
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
