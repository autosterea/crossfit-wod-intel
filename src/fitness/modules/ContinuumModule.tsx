import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  BIOMARKERS,
  CONTINUUM_EXAMPLES,
  CONTINUUM_PROFILES,
  MODULE_COPY,
  PAL,
  markerValueAt,
  moduleByKey,
  spectrum,
  spectrumCss,
} from '../fitnessData'
import { clamp, lerp, prefersReducedMotion, smoothK } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, PresetButtons, ControlHead, Readout, Slider } from '../ui'

/* =========================================================================
   Module 05 - The Sickness, Wellness, Fitness Continuum.

   Ported and improved from moduleContinuum() in what-is-fitness-3d.html
   (lines 991-1179). The original drew eight unlabeled lanes; this builds the
   ten real L1 biomarker axes from fitnessData (each with a healthy direction,
   a real unit, and interpolated values via markerValueAt). Each marker is its
   OWN horizontal continuum sweeping sickness (left, red) -> wellness (middle,
   amber) -> fitness (right, green), and the whole person is plotted as a
   glowing dot on each parallel axis. Above the stack an aggregate orb + state
   WORD (SICK / WELL / FIT / ROBUST) slides along its own rail.

   Per-frame morphing is done by mutating refs in useFrame; React state only
   holds the per-marker TARGET positions that the controls write.
   ========================================================================= */

const RUNWAY_X0 = -11
const RUNWAY_X1 = 11
const LANE_Z0 = -5.4
const LANE_Z1 = 5.4
const LANE_Y = 0.62
const RAIL_Y = 4.5
const N = BIOMARKERS.length

/** Position 0..1 -> world x along a marker axis. */
const xOf = (v: number): number => lerp(RUNWAY_X0, RUNWAY_X1, clamp(v, 0, 1))
/** Lane index -> world z (stacked front to back). */
const zOf = (i: number): number => lerp(LANE_Z0, LANE_Z1, N <= 1 ? 0.5 : i / (N - 1))

interface StateWord {
  word: string
  css: string
  t: number
}

/** Overall mean toward fitness -> the patient's one-word state (L1 banding). */
function stateWord(avg: number): StateWord {
  if (avg < 0.33) return { word: 'SICK', css: PAL.sick, t: 0.0 }
  if (avg < 0.62) return { word: 'WELL', css: PAL.well, t: 0.5 }
  if (avg < 0.88) return { word: 'FIT', css: PAL.fit, t: 0.82 }
  return { word: 'ROBUST', css: PAL.robust, t: 1.0 }
}

/** Format an interpolated marker value with sensible precision for its unit. */
function fmtMarker(value: number, unit: string): string {
  const abs = Math.abs(value)
  let v: string
  if (unit === 'T-score' || unit === 'x BW deadlift') v = value.toFixed(2)
  else if (abs >= 100) v = Math.round(value).toString()
  else if (abs >= 10) v = value.toFixed(0)
  else v = value.toFixed(1)
  return `${v} ${unit}`
}

/* ---------------------------------------------------------------------------
   makeLabel: ported from the source HTML. Renders crisp text onto a
   CanvasTexture sprite so no CDN font is loaded. Used for the spanning zone
   labels and the sliding aggregate state word.
--------------------------------------------------------------------------- */
interface LabelOpts {
  fontPx?: number
  worldHeight?: number
  color?: string
  bg?: string
  weight?: number
  pad?: number
}

function makeLabelTexture(text: string, opts: LabelOpts): { texture: THREE.CanvasTexture; aspect: number } {
  const fontPx = opts.fontPx ?? 40
  const weight = opts.weight ?? 800
  const pad = opts.pad ?? (opts.bg ? 0.42 : 0.12)
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const measure = document.createElement('canvas').getContext('2d')!
  const font = `${weight} ${fontPx}px Poppins, system-ui, sans-serif`
  measure.font = font
  const textW = measure.measureText(text).width
  const padPx = fontPx * pad
  const w = Math.ceil(textW + padPx * 2)
  const h = Math.ceil(fontPx * 1.45 + padPx * 1.2)

  const cnv = document.createElement('canvas')
  cnv.width = Math.max(2, Math.round(w * dpr))
  cnv.height = Math.max(2, Math.round(h * dpr))
  const ctx = cnv.getContext('2d')!
  ctx.scale(dpr, dpr)

  if (opts.bg) {
    const r = h * 0.32
    ctx.fillStyle = opts.bg
    ctx.beginPath()
    // rounded pill background
    ctx.moveTo(r, 0)
    ctx.arcTo(w, 0, w, h, r)
    ctx.arcTo(w, h, 0, h, r)
    ctx.arcTo(0, h, 0, 0, r)
    ctx.arcTo(0, 0, w, 0, r)
    ctx.closePath()
    ctx.fill()
  }

  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (!opts.bg) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = fontPx * 0.18
    ctx.shadowOffsetY = fontPx * 0.04
  }
  ctx.fillStyle = opts.color ?? '#eef3f6'
  ctx.fillText(text, w / 2, h / 2 + fontPx * 0.04)

  const texture = new THREE.CanvasTexture(cnv)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return { texture, aspect: w / h }
}

/** A billboard text label backed by a CanvasTexture sprite (self-contained). */
function SpriteLabel({
  text,
  worldHeight = 0.8,
  color,
  bg,
  fontPx = 40,
  weight = 800,
  renderOrder = 10,
}: {
  text: string
  worldHeight?: number
  color?: string
  bg?: string
  fontPx?: number
  weight?: number
  renderOrder?: number
}) {
  const { texture, aspect } = useMemo(
    () => makeLabelTexture(text, { fontPx, worldHeight, color, bg, weight }),
    [text, fontPx, worldHeight, color, bg, weight],
  )
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite scale={[worldHeight * aspect, worldHeight, 1]} renderOrder={renderOrder}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

/* ---------------------------------------------------------------------------
   The gradient runway bar for one marker axis: a thin slab textured with the
   sick -> well -> fit gradient, drawn once and reused across all ten lanes.
--------------------------------------------------------------------------- */
function useRunwayTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const cw = 512
    const ch = 32
    const cnv = document.createElement('canvas')
    cnv.width = cw
    cnv.height = ch
    const ctx = cnv.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, cw, 0)
    grad.addColorStop(0, PAL.sick)
    grad.addColorStop(0.5, PAL.well)
    grad.addColorStop(1, PAL.fit)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, cw, ch)
    // subtle band ticks at the 1/3 and 2/3 zone boundaries
    ctx.fillStyle = 'rgba(7,10,14,0.35)'
    ctx.fillRect(Math.round(cw / 3) - 1, 0, 2, ch)
    ctx.fillRect(Math.round((cw * 2) / 3) - 1, 0, 2, ch)
    const tex = new THREE.CanvasTexture(cnv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [])
}

interface SceneProps {
  /** Per-marker target position toward fitness, 0..1, in BIOMARKERS order. */
  targets: number[]
  /** Called each settle frame with the live (eased) positions + overall mean. */
  onLive: (positions: number[], avg: number) => void
}

/** One marker lane: gradient runway + guide line + the person's glowing dot. */
function MarkerLane({
  index,
  runwayTex,
  initPos,
  setDot,
  setMat,
}: {
  index: number
  runwayTex: THREE.CanvasTexture
  initPos: number
  setDot: (index: number, g: THREE.Group | null) => void
  setMat: (index: number, mat: THREE.MeshStandardMaterial | null) => void
}) {
  const m = BIOMARKERS[index]
  const z = zOf(index)
  const initCol = useMemo(() => {
    const [r, g, b] = spectrum(initPos)
    return new THREE.Color(r, g, b)
  }, [initPos])

  return (
    <group position={[0, 0, z]}>
      {/* gradient runway slab */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[RUNWAY_X1 - RUNWAY_X0, 0.86]} />
        <meshBasicMaterial map={runwayTex} transparent opacity={0.92} toneMapped={false} />
      </mesh>

      {/* thin metal rail under the runway for grounding */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[RUNWAY_X1 - RUNWAY_X0 + 0.4, 0.06, 0.12]} />
        <meshStandardMaterial color="#1c2a22" metalness={0.6} roughness={0.5} />
      </mesh>

      {/* marker name + unit label, fixed at the left */}
      <Html
        position={[RUNWAY_X0 - 0.5, LANE_Y, 0]}
        center
        distanceFactor={16}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[8, 0]}
      >
        <div
          className="wf-cont-label"
          style={{
            transform: 'translateX(-100%)',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            fontFamily: "'Barlow Condensed', Poppins, sans-serif",
            color: '#dfe7e2',
            lineHeight: 1.05,
            textShadow: '0 1px 4px rgba(0,0,0,0.7)',
          }}
        >
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '0.01em' }}>{m.name}</div>
          <div style={{ fontSize: 12.5, color: PAL.muted, letterSpacing: '0.02em' }}>
            {m.unit} {' '}
            <span style={{ color: 'rgba(223,231,226,0.55)' }}>
              ({m.betterDirection === 'higher' ? 'higher better' : 'lower better'})
            </span>
          </div>
        </div>
      </Html>

      {/* the person's glowing dot, positioned/recolored each frame in useFrame */}
      <group
        ref={(g) => {
          setDot(index, g)
        }}
        position={[xOf(initPos), LANE_Y, 0]}
      >
        {/* connector stick down to the runway */}
        <mesh position={[0, -(LANE_Y - 0.02) / 2, 0]}>
          <cylinderGeometry args={[0.035, 0.035, LANE_Y - 0.02, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
        </mesh>
        {/* halo */}
        <mesh>
          <sphereGeometry args={[0.58, 24, 24]} />
          <meshBasicMaterial color={initCol} transparent opacity={0.14} toneMapped={false} depthWrite={false} />
        </mesh>
        {/* the marker sphere */}
        <mesh castShadow>
          <sphereGeometry args={[0.4, 32, 32]} />
          <meshStandardMaterial
            ref={(mat) => {
              setMat(index, mat)
            }}
            color={initCol}
            emissive={initCol}
            emissiveIntensity={0.55}
            roughness={0.32}
            metalness={0.15}
            toneMapped={false}
          />
        </mesh>
        {/* live numeric value readout above the dot */}
        <Html position={[0, 0.92, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }} zIndexRange={[7, 0]}>
          <div
            data-marker-value={index}
            className="wf-cont-value"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 12.5,
              fontWeight: 600,
              color: spectrumCss(initPos),
              whiteSpace: 'nowrap',
              textShadow: '0 1px 5px rgba(0,0,0,0.85)',
            }}
          >
            {fmtMarker(markerValueAt(m, initPos), m.unit)}
          </div>
        </Html>
      </group>
    </group>
  )
}

function ContinuumScene({ targets, onLive }: SceneProps) {
  const reduced = prefersReducedMotion()
  const runwayTex = useRunwayTexture()
  useEffect(() => () => runwayTex.dispose(), [runwayTex])

  // Live (eased) positions, mutated in useFrame and read by refs only.
  const liveRef = useRef<number[]>(targets.slice())
  const targetRef = useRef<number[]>(targets.slice())
  // Snapshot of positions at mount, for the lanes' initial transforms/colors.
  // (Subsequent moves are driven imperatively in useFrame, never via re-mount.)
  const [initPositions] = useState<number[]>(() => targets.slice())
  const dotRefs = useRef<(THREE.Group | null)[]>(new Array<THREE.Group | null>(N).fill(null))
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>(
    new Array<THREE.MeshStandardMaterial | null>(N).fill(null),
  )

  // Aggregate orb + its word sprite.
  const aggRef = useRef<THREE.Group | null>(null)
  const aggMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const initAvg = useMemo(() => targets.reduce((s, v) => s + v, 0) / N, [targets])
  const [word, setWord] = useState<StateWord>(() => stateWord(initAvg))
  const wordRef = useRef<string>(word.word)

  // Keep the latest target array on a ref so useFrame always sees fresh values.
  useEffect(() => {
    targetRef.current = targets.slice()
    if (reduced) {
      // Reduced motion: snap instead of morphing.
      liveRef.current = targets.slice()
    }
  }, [targets, reduced])

  const tmpCol = useMemo(() => new THREE.Color(), [])

  // Setter callbacks so child lanes never mutate a ref passed as a prop
  // (satisfies the react-hooks immutability rule).
  const setDot = (i: number, g: THREE.Group | null) => {
    dotRefs.current[i] = g
  }
  const setMat = (i: number, mat: THREE.MeshStandardMaterial | null) => {
    matRefs.current[i] = mat
  }

  useFrame((_, dt) => {
    const live = liveRef.current
    const tgt = targetRef.current
    const k = reduced ? 1 : smoothK(dt, 11)
    let sum = 0
    let moved = false

    for (let i = 0; i < N; i++) {
      const next = Math.abs(live[i] - tgt[i]) > 0.0015 ? lerp(live[i], tgt[i], k) : tgt[i]
      if (next !== live[i]) moved = true
      live[i] = next
      sum += next

      const dot = dotRefs.current[i]
      if (dot) dot.position.x = xOf(next)
      const mat = matRefs.current[i]
      if (mat) {
        const [r, g, b] = spectrum(next)
        tmpCol.setRGB(r, g, b)
        mat.color.copy(tmpCol)
        mat.emissive.copy(tmpCol)
      }
    }

    const avg = sum / N
    const ac = spectrum(avg)
    if (aggRef.current) aggRef.current.position.x = xOf(avg)
    if (aggMatRef.current) {
      tmpCol.setRGB(ac[0], ac[1], ac[2])
      aggMatRef.current.color.copy(tmpCol)
      aggMatRef.current.emissive.copy(tmpCol)
    }

    // Idle breathing on the aggregate orb (skipped under reduced motion).
    if (aggRef.current && !reduced) {
      const t = performance.now() * 0.001
      aggRef.current.position.y = RAIL_Y + Math.sin(t * 1.3) * 0.06
    }

    // Update the live numeric readouts via the DOM (cheap, no React re-render).
    if (moved || reduced) {
      for (let i = 0; i < N; i++) {
        const el = document.querySelector<HTMLElement>(`[data-marker-value="${i}"]`)
        if (el) {
          const m = BIOMARKERS[i]
          el.textContent = fmtMarker(markerValueAt(m, live[i]), m.unit)
          el.style.color = spectrumCss(live[i])
        }
      }
      onLive(live.slice(), avg)
    }

    // Swap the aggregate WORD sprite when the band changes.
    const sw = stateWord(avg)
    if (sw.word !== wordRef.current) {
      wordRef.current = sw.word
      setWord(sw)
    }
  })

  // Zone bands span the whole stack (sickness | wellness | fitness thirds).
  const zoneZ = LANE_Z1 + 1.2
  const zones: { label: string; color: string; x: number }[] = [
    { label: 'SICKNESS', color: PAL.sick, x: xOf(1 / 6) },
    { label: 'WELLNESS', color: '#e6c25a', x: xOf(0.5) },
    { label: 'FITNESS', color: PAL.fit, x: xOf(5 / 6) },
  ]

  return (
    <group position={[0, 0, 0]}>
      {/* dark grounding floor + subtle grid under the whole stack */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]} receiveShadow>
        <planeGeometry args={[40, 22]} />
        <meshStandardMaterial color="#070d0a" roughness={1} metalness={0} />
      </mesh>
      <gridHelper args={[40, 36, '#15331f', '#0c1b13']} position={[0, -0.33, 0]} />

      {/* zone divider planes (very faint) at the 1/3 and 2/3 boundaries */}
      {[1 / 3, 2 / 3].map((f) => (
        <mesh key={f} position={[xOf(f), RAIL_Y / 2 - 0.2, 0]}>
          <planeGeometry args={[0.03, RAIL_Y + 1.2]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} depthWrite={false} />
        </mesh>
      ))}

      {/* spanning zone labels above the stack */}
      {zones.map((z) => (
        <group key={z.label} position={[z.x, RAIL_Y - 0.7, zoneZ]}>
          <SpriteLabel text={z.label} worldHeight={0.62} color={z.color} fontPx={40} />
        </group>
      ))}

      {/* the ten marker lanes */}
      {BIOMARKERS.map((_, i) => (
        <MarkerLane
          key={i}
          index={i}
          runwayTex={runwayTex}
          initPos={initPositions[i]}
          setDot={setDot}
          setMat={setMat}
        />
      ))}

      {/* aggregate rail line */}
      <mesh position={[0, RAIL_Y, 0]}>
        <boxGeometry args={[RUNWAY_X1 - RUNWAY_X0 + 0.4, 0.025, 0.025]} />
        <meshBasicMaterial color="#3a4d40" transparent opacity={0.7} />
      </mesh>

      {/* aggregate orb + sliding state word */}
      <group
        ref={(g) => {
          aggRef.current = g
        }}
        position={[xOf(initAvg), RAIL_Y, 0]}
      >
        <mesh>
          <sphereGeometry args={[0.95, 24, 24]} />
          <meshBasicMaterial color={word.css} transparent opacity={0.12} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh castShadow>
          <sphereGeometry args={[0.66, 32, 32]} />
          <meshStandardMaterial
            ref={(m) => {
              aggMatRef.current = m
            }}
            color={word.css}
            emissive={word.css}
            emissiveIntensity={0.6}
            roughness={0.28}
            metalness={0.2}
            toneMapped={false}
          />
        </mesh>
        <group position={[0, 1.15, 0]}>
          <SpriteLabel text={word.word} worldHeight={0.72} color={PAL.ink} bg={word.css} fontPx={42} />
        </group>
      </group>

      {/* soft contact shadow grounding the whole installation */}
      <ContactShadows
        position={[0, -0.3, 0]}
        scale={36}
        resolution={1024}
        blur={2.6}
        opacity={0.42}
        far={6}
        color="#000000"
      />
    </group>
  )
}

/* ---------------------------- controls panel ---------------------------- */

type ProfileName = (typeof CONTINUUM_PROFILES)[number]['name'] | 'Custom'

function ContinuumControls({
  active,
  onPreset,
  sliders,
  onSlider,
  liveAvg,
  liveWord,
}: {
  active: ProfileName
  onPreset: (name: ProfileName) => void
  sliders: number[]
  onSlider: (index: number, value0to100: number) => void
  liveAvg: number
  liveWord: StateWord
}) {
  const presetNames: ProfileName[] = [...CONTINUUM_PROFILES.map((p) => p.name), 'Custom']
  const titleCase = liveWord.word[0] + liveWord.word.slice(1).toLowerCase()

  return (
    <div>
      <ControlHead>Patient markers</ControlHead>

      <Readout
        label="Overall state"
        value={titleCase}
        color={liveWord.css}
        sub={
          <>
            <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(liveAvg * 100)}</strong> / 100
            toward fitness
          </>
        }
      />

      <PresetButtons options={presetNames} value={active} onChange={onPreset} />

      <div style={{ fontSize: 11.5, color: PAL.muted, margin: '2px 0 12px', lineHeight: 1.5 }}>
        Each marker has its own healthy direction. All map onto one sick to fit scale. Drag a marker and the profile
        becomes Custom.
      </div>

      {BIOMARKERS.map((m, i) => {
        const pos = sliders[i] / 100
        return (
          <Slider
            key={m.name}
            label={m.name}
            value={Math.round(sliders[i])}
            display={fmtMarker(markerValueAt(m, pos), m.unit)}
            min={0}
            max={100}
            step={1}
            dotColor={spectrumCss(pos)}
            onChange={(v) => onSlider(i, v)}
          />
        )
      })}

      <div
        style={{
          marginTop: 6,
          paddingTop: 10,
          borderTop: '1px solid rgba(238,243,246,0.1)',
          fontSize: 11,
          lineHeight: 1.55,
          color: '#c2ccc6',
        }}
      >
        <span style={{ color: PAL.yellowGreen, fontWeight: 600 }}>L1 example.</span> {CONTINUUM_EXAMPLES[0]}
      </div>
    </div>
  )
}

/* ------------------------------- module --------------------------------- */

export default function ContinuumModule() {
  const meta = moduleByKey('continuum')
  const copy = MODULE_COPY.continuum

  // The default profile is "Average / well" (index 1), matching the source.
  const defaultProfile = CONTINUUM_PROFILES[1]
  const [active, setActive] = useState<ProfileName>(defaultProfile.name)

  // sliders[] holds 0..100 per marker; targets[] (0..1) drive the scene.
  const [sliders, setSliders] = useState<number[]>(() => defaultProfile.positions.map((p) => p * 100))
  const targets = useMemo(() => sliders.map((s) => clamp(s / 100, 0, 1)), [sliders])

  // Live readout state (updated from the scene, throttled to band/word changes).
  const initAvg = useMemo(() => targets.reduce((s, v) => s + v, 0) / N, [targets])
  const [liveAvg, setLiveAvg] = useState(initAvg)
  const [liveWord, setLiveWord] = useState<StateWord>(() => stateWord(initAvg))

  const applyPreset = (name: ProfileName) => {
    setActive(name)
    if (name === 'Custom') return
    const prof = CONTINUUM_PROFILES.find((p) => p.name === name)
    if (prof) setSliders(prof.positions.map((p) => p * 100))
  }

  const onSlider = (index: number, value: number) => {
    setActive('Custom')
    setSliders((prev) => {
      const next = prev.slice()
      next[index] = clamp(value, 0, 100)
      return next
    })
  }

  // Smooth, low-churn live readout: only re-render React when the rounded
  // score actually changes (the scene drives the 3D directly via refs).
  const lastScore = useRef(Math.round(initAvg * 100))
  const onLive = (_positions: number[], avg: number) => {
    const score = Math.round(avg * 100)
    if (score !== lastScore.current) {
      lastScore.current = score
      setLiveAvg(avg)
      setLiveWord(stateWord(avg))
    }
  }

  return (
    <ModulePage moduleKey="continuum">
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={copy.body}
        autoRotate={!prefersReducedMotion()}
        autoRotateSpeed={0.18}
        camera={{ position: [1, 8.5, 27], fov: 50 }}
        target={[-0.5, 2, 0]}
        minDistance={14}
        maxDistance={52}
        hint="Drag to orbit. Load a profile or drag any marker toward fitness."
        controls={
          <ContinuumControls
            active={active}
            onPreset={applyPreset}
            sliders={sliders}
            onSlider={onSlider}
            liveAvg={liveAvg}
            liveWord={liveWord}
          />
        }
      >
        <ContinuumScene targets={targets} onLive={onLive} />
      </LessonStage>
    </ModulePage>
  )
}
