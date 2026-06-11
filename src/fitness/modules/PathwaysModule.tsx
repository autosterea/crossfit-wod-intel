import { useMemo, useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import {
  ENERGY_SYSTEMS,
  ENERGY_CROSSOVER,
  ENERGY_BENCHMARKS,
  PAL,
  moduleByKey,
  MODULE_COPY,
  type EnergyKey,
} from '../fitnessData'
import { clamp, lerp, logU, uToT, smoothK, fmtDuration, prefersReducedMotion } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, Slider, PresetButtons, Readout, Legend, ControlHead } from '../ui'

/* =========================================================================
   Module 03 - The Three Metabolic Pathways.
   Three colored ribbons (phosphagen / glycolytic / oxidative) on a LOG effort
   duration axis. Ribbon height at each duration follows the % contribution
   from ENERGY_CROSSOVER (Gastin 2001), smoothly interpolated in log-time. A
   slice plane scrubs the axis; glowing markers ride each ribbon at the slice;
   presets are the real ENERGY_BENCHMARKS. Everything grounded in fitnessData.
   ========================================================================= */

/* ----------------------------- geometry constants ---------------------- */
const T_MIN = 3 // seconds (matches ENERGY_CROSSOVER[0])
const T_MAX = 3600 // seconds (matches last ENERGY_CROSSOVER point)
const X_HALF = 12 // world half-width of the duration axis
const HS = 6.4 // world height for 100 percent contribution
const RIBBON_N = 150 // ribbon resolution along x
const LANES: Record<EnergyKey, number> = { phosphagen: 3.4, glycolytic: 0, oxidative: -3.4 }
const LANE_DEPTH = 9.2 // z-span the slice plane covers

const SYS = ENERGY_SYSTEMS // [phosphagen, glycolytic, oxidative]
const COLOR: Record<EnergyKey, string> = {
  phosphagen: PAL.phosphagen,
  glycolytic: PAL.glycolytic,
  oxidative: PAL.oxidative,
}
const NAME: Record<EnergyKey, string> = {
  phosphagen: SYS[0].name,
  glycolytic: SYS[1].name,
  oxidative: SYS[2].name,
}

/** World x from a duration in seconds (log axis). */
const xFromT = (t: number): number => lerp(-X_HALF, X_HALF, logU(t, T_MIN, T_MAX))

/* --------------------- data-grounded contribution curves --------------- */
// Pre-extract the crossover table into parallel arrays so we can monotone-
// interpolate each system's percentage across log-time (anchored to Gastin 2001).
const X_NODES = ENERGY_CROSSOVER.map((p) => logU(clamp(p.seconds, T_MIN, T_MAX), T_MIN, T_MAX))
const PHOS_NODES = ENERGY_CROSSOVER.map((p) => p.phosphagen)
const GLY_NODES = ENERGY_CROSSOVER.map((p) => p.glycolytic)
const OXI_NODES = ENERGY_CROSSOVER.map((p) => p.oxidative)

/** Monotone (Fritsch-Carlson-ish, clamped) interpolation of a value at u in 0..1. */
function interpAtU(u: number, ys: number[]): number {
  const x = clamp(u, 0, 1)
  const n = X_NODES.length
  if (x <= X_NODES[0]) return ys[0]
  if (x >= X_NODES[n - 1]) return ys[n - 1]
  let i = 0
  while (i < n - 1 && X_NODES[i + 1] < x) i++
  const x0 = X_NODES[i]
  const x1 = X_NODES[i + 1]
  const span = x1 - x0
  const tt = span > 1e-6 ? (x - x0) / span : 0
  // smoothstep eased cubic for an organic ribbon, kept inside the data bracket.
  const s = tt * tt * (3 - 2 * tt)
  return lerp(ys[i], ys[i + 1], s)
}

/** Raw (un-normalized) percentages at a duration in seconds. */
function rawContribAtT(t: number): { phosphagen: number; glycolytic: number; oxidative: number } {
  const u = logU(clamp(t, T_MIN, T_MAX), T_MIN, T_MAX)
  return {
    phosphagen: interpAtU(u, PHOS_NODES),
    glycolytic: interpAtU(u, GLY_NODES),
    oxidative: interpAtU(u, OXI_NODES),
  }
}

/** Normalized-to-100 contribution at a duration (the readout numbers). */
function contribAtT(t: number): { phosphagen: number; glycolytic: number; oxidative: number } {
  const c = rawContribAtT(t)
  const sum = c.phosphagen + c.glycolytic + c.oxidative || 1
  return {
    phosphagen: (c.phosphagen / sum) * 100,
    glycolytic: (c.glycolytic / sum) * 100,
    oxidative: (c.oxidative / sum) * 100,
  }
}

/** Fraction 0..1 of full ribbon height for one system at a duration. */
function fracAtT(key: EnergyKey, t: number): number {
  const c = rawContribAtT(t)
  const v = key === 'phosphagen' ? c.phosphagen : key === 'glycolytic' ? c.glycolytic : c.oxidative
  return clamp(v / 100, 0, 1)
}

function dominantOf(c: { phosphagen: number; glycolytic: number; oxidative: number }): EnergyKey {
  if (c.phosphagen >= c.glycolytic && c.phosphagen >= c.oxidative) return 'phosphagen'
  if (c.glycolytic >= c.oxidative) return 'glycolytic'
  return 'oxidative'
}

/* ------------------------- CanvasTexture sprite label ------------------ */
/** Ported from makeLabel in the source HTML: a crisp text sprite, no network font. */
function makeLabelTexture(
  text: string,
  fontPx: number,
  cssColor: string,
): { texture: THREE.CanvasTexture; aspect: number } {
  const SS = 2
  const family = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  const weight = '600'
  const padX = 22
  const padY = 14

  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')!
  mctx.font = `${weight} ${fontPx * SS}px ${family}`
  const tw = mctx.measureText(text).width
  const w = Math.ceil(tw + padX * 2 * SS)
  const h = Math.ceil(fontPx * SS + padY * 2 * SS)

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.font = `${weight} ${fontPx * SS}px ${family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = cssColor
  ctx.fillText(text, w / 2, h / 2 + SS)

  const texture = new THREE.CanvasTexture(c)
  texture.anisotropy = 4
  texture.minFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, aspect: w / h }
}

function SpriteLabel({
  text,
  position,
  worldHeight,
  fontPx = 38,
  color = PAL.muted,
}: {
  text: string
  position: [number, number, number]
  worldHeight: number
  fontPx?: number
  color?: string
}) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(text, fontPx, color), [text, fontPx, color])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={position} scale={[worldHeight * aspect, worldHeight, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

/* ------------------------------ one ribbon ----------------------------- */
function Ribbon({ systemKey }: { systemKey: EnergyKey }) {
  const z = LANES[systemKey]
  const color = COLOR[systemKey]

  const { fillGeometry, crestGeometry } = useMemo(() => {
    const positions = new Float32Array((RIBBON_N + 1) * 2 * 3)
    const crest = new Float32Array((RIBBON_N + 1) * 3)
    const index: number[] = []
    for (let i = 0; i <= RIBBON_N; i++) {
      const u = i / RIBBON_N
      const t = uToT(u, T_MIN, T_MAX)
      const x = xFromT(t)
      const y = fracAtT(systemKey, t) * HS
      const base = i * 2 * 3
      // bottom vertex
      positions[base] = x
      positions[base + 1] = 0
      positions[base + 2] = z
      // top vertex
      positions[base + 3] = x
      positions[base + 4] = y
      positions[base + 5] = z
      // crest line
      crest[i * 3] = x
      crest[i * 3 + 1] = y + 0.02
      crest[i * 3 + 2] = z
    }
    for (let k = 0; k < RIBBON_N; k++) {
      const a = k * 2
      const b = k * 2 + 1
      const c = k * 2 + 2
      const d = k * 2 + 3
      index.push(a, b, d, a, d, c)
    }
    const fillGeometry = new THREE.BufferGeometry()
    fillGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    fillGeometry.setIndex(index)
    fillGeometry.computeVertexNormals()

    const crestGeometry = new THREE.BufferGeometry()
    crestGeometry.setAttribute('position', new THREE.BufferAttribute(crest, 3))
    return { fillGeometry, crestGeometry }
  }, [systemKey, z])

  useEffect(
    () => () => {
      fillGeometry.dispose()
      crestGeometry.dispose()
    },
    [fillGeometry, crestGeometry],
  )

  // lane label sits on the ribbon crest near its dominant zone.
  const labelT = systemKey === 'phosphagen' ? 6 : systemKey === 'glycolytic' ? 50 : 2200
  const labelY = fracAtT(systemKey, labelT) * HS + 0.7
  const labelX = xFromT(labelT)

  return (
    <group>
      <mesh geometry={fillGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.34}
          side={THREE.DoubleSide}
          depthWrite={false}
          metalness={0.1}
          roughness={0.55}
          toneMapped={false}
        />
      </mesh>
      <line>
        <primitive object={crestGeometry} attach="geometry" />
        <lineBasicMaterial color={color} transparent opacity={0.95} toneMapped={false} />
      </line>
      <SpriteLabel text={NAME[systemKey]} position={[labelX, labelY, z]} worldHeight={0.82} fontPx={40} color={color} />
    </group>
  )
}

/* ------------------------- slice plane + markers ----------------------- */
function SliceAndMarkers({
  targetT,
  pulseKey,
  pulseStamp,
}: {
  targetT: number
  pulseKey: EnergyKey | null
  pulseStamp: number
}) {
  const slice = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const phos = useRef<THREE.Mesh>(null)
  const gly = useRef<THREE.Mesh>(null)
  const oxi = useRef<THREE.Mesh>(null)
  const curT = useRef(targetT)
  const reduced = useMemo(() => prefersReducedMotion(), [])

  const markerOf = (k: EnergyKey): React.RefObject<THREE.Mesh | null> =>
    k === 'phosphagen' ? phos : k === 'glycolytic' ? gly : oxi

  useFrame((_, dt) => {
    // ease the slice in LOG space so it tracks the slider naturally.
    const lc = Math.log(curT.current)
    const lt = Math.log(clamp(targetT, T_MIN, T_MAX))
    if (Math.abs(lc - lt) > 1e-4) {
      const kf = reduced ? 1 : smoothK(Math.min(dt, 0.05), 9)
      curT.current = Math.exp(lerp(lc, lt, kf))
    } else {
      curT.current = clamp(targetT, T_MIN, T_MAX)
    }
    const t = curT.current
    const x = xFromT(t)

    if (slice.current) slice.current.position.x = x
    if (glow.current) {
      glow.current.position.x = x
      const m = glow.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.16 + 0.05 * Math.sin(performance.now() * 0.003)
    }

    ;(['phosphagen', 'glycolytic', 'oxidative'] as EnergyKey[]).forEach((k) => {
      const ref = markerOf(k).current
      if (!ref) return
      const y = fracAtT(k, t) * HS
      ref.position.set(x, y, LANES[k])
      // idle breathing + a pulse when this lane's preset was just chosen.
      let s = reduced ? 1 : 1 + 0.05 * Math.sin(performance.now() * 0.004 + LANES[k])
      if (!reduced && pulseKey === k) {
        const age = (performance.now() - pulseStamp) / 1000
        if (age < 1.1) {
          const decay = Math.max(0, 1 - age / 1.1)
          s += Math.sin(age * 22) * 0.45 * decay
        }
      }
      ref.scale.setScalar(s)
      const mat = ref.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.6 + (pulseKey === k ? 0.5 : 0) * Math.max(0, 1 - (performance.now() - pulseStamp) / 1100)
    })
  })

  return (
    <group>
      {/* faint scrub plane spanning the three lanes */}
      <mesh ref={slice} rotation={[0, Math.PI / 2, 0]} position={[xFromT(targetT), (HS + 1.4) / 2 - 0.7, 0]}>
        <planeGeometry args={[LANE_DEPTH, HS + 1.4]} />
        <meshBasicMaterial color={PAL.chalk} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* a brighter thin line on the plane edge for legibility */}
      <mesh ref={glow} position={[xFromT(targetT), (HS + 1.2) / 2 - 0.7, 0]}>
        <boxGeometry args={[0.05, HS + 1.2, LANE_DEPTH]} />
        <meshBasicMaterial color={PAL.chalk} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
      </mesh>

      {(['phosphagen', 'glycolytic', 'oxidative'] as EnergyKey[]).map((k) => (
        <mesh key={k} ref={markerOf(k)}>
          <sphereGeometry args={[0.34, 32, 32]} />
          <meshStandardMaterial
            color={COLOR[k]}
            emissive={COLOR[k]}
            emissiveIntensity={0.6}
            roughness={0.35}
            metalness={0.2}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------- axis + benchmark studs ---------------------- */
const TICKS: { t: number; label: string }[] = [
  { t: 5, label: '5s' },
  { t: 15, label: '15s' },
  { t: 60, label: '1m' },
  { t: 300, label: '5m' },
  { t: 1200, label: '20m' },
  { t: 3600, label: '60m' },
]

function AxisRig({ onPick }: { onPick: (t: number) => void }) {
  const axisGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setFromPoints([new THREE.Vector3(-X_HALF - 0.5, 0, 0), new THREE.Vector3(X_HALF + 0.5, 0, 0)])
    return g
  }, [])
  useEffect(() => () => axisGeo.dispose(), [axisGeo])

  const tickGeos = useMemo(
    () =>
      TICKS.map((tk) => {
        const x = xFromT(tk.t)
        const g = new THREE.BufferGeometry()
        g.setFromPoints([new THREE.Vector3(x, 0, LANE_DEPTH / 2), new THREE.Vector3(x, 0, -LANE_DEPTH / 2)])
        return g
      }),
    [],
  )
  useEffect(() => () => tickGeos.forEach((g) => g.dispose()), [tickGeos])

  return (
    <group>
      <line>
        <primitive object={axisGeo} attach="geometry" />
        <lineBasicMaterial color={PAL.muted} transparent opacity={0.55} />
      </line>

      {TICKS.map((tk, i) => {
        const x = xFromT(tk.t)
        return (
          <group key={tk.label}>
            <line>
              <primitive object={tickGeos[i]} attach="geometry" />
              <lineBasicMaterial color={PAL.muted} transparent opacity={0.22} />
            </line>
            <SpriteLabel text={tk.label} position={[x, -0.72, LANE_DEPTH / 2 + 0.7]} worldHeight={0.6} fontPx={34} />
          </group>
        )
      })}

      <SpriteLabel
        text="EFFORT DURATION"
        position={[0, -1.7, LANE_DEPTH / 2 + 0.7]}
        worldHeight={0.56}
        fontPx={30}
        color={PAL.muted}
      />

      {/* benchmark studs sitting on the axis (clamped to the visible range) */}
      {ENERGY_BENCHMARKS.map((b) => {
        const t = clamp(b.seconds, T_MIN, T_MAX)
        const x = xFromT(t)
        return (
          <mesh
            key={b.name}
            position={[x, 0.18, 0]}
            onClick={(e) => {
              e.stopPropagation()
              onPick(b.seconds)
            }}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            <sphereGeometry args={[0.2, 24, 24]} />
            <meshStandardMaterial
              color={COLOR[b.dominant]}
              emissive={COLOR[b.dominant]}
              emissiveIntensity={0.45}
              roughness={0.4}
              metalness={0.3}
              toneMapped={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------- scene --------------------------------- */
function PathwaysScene({
  targetT,
  pulseKey,
  pulseStamp,
  onPickT,
}: {
  targetT: number
  pulseKey: EnergyKey | null
  pulseStamp: number
  onPickT: (t: number) => void
}) {
  const group = useRef<THREE.Group>(null)
  const reduced = useMemo(() => prefersReducedMotion(), [])

  useFrame((state) => {
    if (!group.current || reduced) return
    // gentle idle drift so the scene never feels frozen.
    group.current.position.y = 0.2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.04
  })

  return (
    <group ref={group} position={[0, 0.2, 0]}>
      <AxisRig onPick={onPickT} />
      <Ribbon systemKey="phosphagen" />
      <Ribbon systemKey="glycolytic" />
      <Ribbon systemKey="oxidative" />
      <SliceAndMarkers targetT={targetT} pulseKey={pulseKey} pulseStamp={pulseStamp} />

      {/* dark grounding plane + soft contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[34, 18]} />
        <meshStandardMaterial color="#070d0a" roughness={1} metalness={0} transparent opacity={0.9} />
      </mesh>
      <gridHelper args={[34, 26, '#16271d', '#0c160f']} position={[0, -0.01, 0]} />
      <ContactShadows position={[0, 0.0, 0]} opacity={0.4} scale={30} blur={2.4} far={9} resolution={512} color="#000000" />
    </group>
  )
}

/* ------------------------------ controls ------------------------------- */
const SLIDER_MIN = 0
const SLIDER_MAX = 1000
const sliderToT = (s: number): number => uToT(s / SLIDER_MAX, T_MIN, T_MAX)
const tToSlider = (t: number): number => logU(clamp(t, T_MIN, T_MAX), T_MIN, T_MAX) * SLIDER_MAX

function PathwaysControls({
  targetT,
  onSlide,
  onPreset,
  activePreset,
}: {
  targetT: number
  onSlide: (t: number) => void
  onPreset: (name: string) => void
  activePreset: string | null
}) {
  const c = contribAtT(targetT)
  const dom = dominantOf(c)
  const pct = {
    phosphagen: Math.round(c.phosphagen),
    glycolytic: Math.round(c.glycolytic),
    oxidative: Math.round(c.oxidative),
  }

  return (
    <>
      <ControlHead>Effort duration</ControlHead>
      <Readout
        label="Current effort"
        value={fmtDuration(targetT)}
        sub={
          <span>
            Dominant engine: <b style={{ color: COLOR[dom] }}>{NAME[dom]}</b>
          </span>
        }
      />

      <Slider
        label="Duration"
        value={tToSlider(targetT)}
        display={fmtDuration(targetT)}
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={1}
        dotColor={COLOR[dom]}
        onChange={(s) => onSlide(sliderToT(s))}
      />

      <div className="wf-pct-row">
        <div className="wf-pct" style={{ borderColor: 'rgba(244,63,94,0.4)' }}>
          <div className="p" style={{ color: COLOR.phosphagen }}>{pct.phosphagen}%</div>
          <div className="n">Phosphagen</div>
        </div>
        <div className="wf-pct" style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
          <div className="p" style={{ color: COLOR.glycolytic }}>{pct.glycolytic}%</div>
          <div className="n">Glycolytic</div>
        </div>
        <div className="wf-pct" style={{ borderColor: 'rgba(56,189,248,0.4)' }}>
          <div className="p" style={{ color: COLOR.oxidative }}>{pct.oxidative}%</div>
          <div className="n">Oxidative</div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <ControlHead>Example efforts</ControlHead>
      </div>
      <PresetButtons
        options={ENERGY_BENCHMARKS.map((b) => b.name)}
        value={activePreset ?? ''}
        onChange={onPreset}
      />

      <ControlHead>The three engines</ControlHead>
      <Legend
        items={[
          { label: NAME.phosphagen, color: COLOR.phosphagen },
          { label: NAME.glycolytic, color: COLOR.glycolytic },
          { label: NAME.oxidative, color: COLOR.oxidative },
        ]}
      />
    </>
  )
}

/* -------------------------------- module ------------------------------- */
export default function PathwaysModule() {
  const meta = moduleByKey('pathways')
  const copy = MODULE_COPY.pathways

  // The single source of truth the scene reads. Default lands on a Fran-ish WOD.
  const [targetT, setTargetT] = useState(240)
  const [activePreset, setActivePreset] = useState<string | null>('Fran')
  const [pulseKey, setPulseKey] = useState<EnergyKey | null>(null)
  const [pulseStamp, setPulseStamp] = useState(0)

  const handleSlide = (t: number) => {
    setTargetT(clamp(t, T_MIN, T_MAX))
    setActivePreset(null)
  }

  const handlePreset = (name: string) => {
    const b = ENERGY_BENCHMARKS.find((x) => x.name === name)
    if (!b) return
    setTargetT(clamp(b.seconds, T_MIN, T_MAX))
    setActivePreset(name)
    setPulseKey(b.dominant)
    setPulseStamp(performance.now())
  }

  // tapping a benchmark stud in the 3D scene scrubs there too.
  const handlePickT = (t: number) => {
    const b = ENERGY_BENCHMARKS.reduce((best, x) =>
      Math.abs(x.seconds - t) < Math.abs(best.seconds - t) ? x : best,
    )
    handlePreset(b.name)
  }

  return (
    <ModulePage moduleKey="pathways">
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={copy.body}
        camera={{ position: [0, 5.5, 29], fov: 50 }}
        target={[0, 3, 0]}
        minDistance={16}
        maxDistance={55}
        hint="Drag to orbit, scrub the slider, or tap a benchmark stud"
        controls={
          <PathwaysControls
            targetT={targetT}
            onSlide={handleSlide}
            onPreset={handlePreset}
            activePreset={activePreset}
          />
        }
      >
        <PathwaysScene targetT={targetT} pulseKey={pulseKey} pulseStamp={pulseStamp} onPickT={handlePickT} />
      </LessonStage>
    </ModulePage>
  )
}
