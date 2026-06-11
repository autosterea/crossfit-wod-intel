import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  MODULE_COPY,
  moduleByKey,
  POWER_CURVES,
  POWER_DOMAIN_TILT,
  POWER_DURATIONS,
  POWER_DURATION_LABELS,
  POWER_TASKS,
  MODAL_DOMAINS,
  PAL,
} from '../fitnessData'
import { catmull1, clamp, lerp, logU, map, prefersReducedMotion, smoothK } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, ControlHead, Readout, PresetButtons, Legend } from '../ui'

/* =========================================================================
   Module 4 - The Definition: work capacity across broad time and modal
   domains. A 3D power (Y) vs log-duration (X) curve, the area beneath it
   tinted PA yellow-green ("AREA = FITNESS"). Ported from moduleDefinition()
   in what-is-fitness-3d.html (lines 1182-1364) and re-grounded entirely in
   POWER_CURVES / POWER_DOMAIN_TILT / POWER_DURATIONS / POWER_TASKS /
   MODAL_DOMAINS.

   All seven POWER_CURVES archetypes drive the module dynamically: the preset
   list, the per-key curve lookup, and the per-domain tilt are built from the
   data layer by name (default preset = Generalist CrossFitter). The Powerlifter
   reads as the extreme short spike (1.0 at 1 s, crashing fast); the Generalist
   owns the largest area and scores "Broad".

   Data labels (the X-axis log-time ticks, the Y-axis power references, and the
   task names that ride the curve) are crisp white drei <Html> pills matching
   the SkillsModule SkillLabels() gold standard, so they stay legible over the
   bright fill and never clip behind the 3D. zIndexRange stays <= 40 so an
   opened About/Controls panel sits in front of them.
   ========================================================================= */

/* ----------------------------- geometry frame -------------------------- */
const X0 = -11 // left edge of the duration axis (world units)
const X1 = 11 // right edge
const YS = 7.6 // world height for relative power = 1.0
const T_MIN = POWER_DURATIONS[0] // 1 s
const T_MAX = POWER_DURATIONS[POWER_DURATIONS.length - 1] // 3600 s

// Four label tiers (world units above each dot) so the 10 task labels stagger
// across noticeably DIFFERENT heights and never collide, especially where the
// short-duration events cluster on the left and the long ones cluster on the
// right of the log axis; cycled by marker index in ActiveCurve. Wider spacing
// (min gap ~1.05) than before so x-adjacent labels are clearly separated.
const TASK_TIERS = [0.5, 1.55, 2.6, 3.65]

/**
 * All seven archetypes, in POWER_CURVES order. The preset keys ARE the curve
 * names, so adding/renaming an archetype in fitnessData flows through here with
 * no edits. Default preset (index 0) is the Generalist CrossFitter.
 */
const ATHLETES = POWER_CURVES.map((c) => c.name)
type AthleteKey = string

const DEFAULT_ATHLETE: AthleteKey = POWER_CURVES[0].name // Generalist CrossFitter

/** Curve lookup by archetype name. */
type PowerCurveEntry = (typeof POWER_CURVES)[number]
const CURVE_BY_KEY: Record<AthleteKey, PowerCurveEntry> = POWER_CURVES.reduce(
  (acc, c) => {
    acc[c.name] = c
    return acc
  },
  {} as Record<AthleteKey, PowerCurveEntry>,
)

/** A flat 5-domain tilt fallback for any name missing from POWER_DOMAIN_TILT. */
const FLAT_TILT = [1, 1, 1, 1, 1]

/**
 * Per-domain power multipliers (5, in MODAL_DOMAINS order) by archetype name,
 * sourced from POWER_DOMAIN_TILT in fitnessData. A specialist tilts the curve
 * toward its strong domain and away from the rest; the generalist sits near
 * flat. The data layer stores only the averaged curve, so the per-domain spread
 * comes from this tilt table.
 */
const domainMult = (name: AthleteKey): number[] => POWER_DOMAIN_TILT[name] ?? FLAT_TILT

const N = 72 // samples along each curve (smooth, mobile-friendly)

/** Relative power 0..1.08 at log-duration parameter u in [0,1]. */
function valAt(samples: number[], u: number): number {
  return clamp(catmull1(samples, u * (samples.length - 1)), 0, 1.08)
}

/** World X for a duration in seconds (log axis). */
function xOf(seconds: number): number {
  return map(clamp(logU(seconds, T_MIN, T_MAX), 0, 1), 0, 1, X0, X1)
}

/** World X for a normalized log parameter u in [0,1]. */
function xOfU(u: number): number {
  return map(u, 0, 1, X0, X1)
}

/** Mean relative power across the curve = the integral the score is built on. */
function meanOf(samples: number[]): number {
  let s = 0
  const M = 64
  for (let i = 0; i < M; i++) s += valAt(samples, i / (M - 1))
  return s / M
}

/**
 * 0-100 fitness score = area under the averaged curve, normalized. The
 * multiplier is tuned so the Generalist (meanOf ~= 0.626) lands ~94 and
 * reads "Broad"; a specialist's narrower area scores lower.
 */
function scoreOf(samples: number[]): number {
  return clamp(Math.round(meanOf(samples) * 150), 0, 100)
}

function scoreWord(s: number): string {
  return s >= 85 ? 'Broad' : s >= 45 ? 'Narrow' : 'Low'
}

function scoreColor(s: number): string {
  return s >= 85 ? PAL.fit : s >= 45 ? PAL.both : PAL.sick
}

/* ----------------------------- label sprite ---------------------------- */
/**
 * A crisp text label as a CanvasTexture sprite (ported from makeLabel in the
 * source). Self-contained: no fetched font, draws with a system stack. The
 * sprite always faces the camera, which is what we want for axis ticks.
 */
function makeLabelTexture(
  text: string,
  opts: { fontPx?: number; color?: string; weight?: string; mono?: boolean },
): { texture: THREE.CanvasTexture; aspect: number } {
  const fontPx = opts.fontPx ?? 36
  const weight = opts.weight ?? '600'
  const color = opts.color ?? PAL.chalk
  const family = opts.mono
    ? 'ui-monospace, "SFMono-Regular", "JetBrains Mono", monospace'
    : '"Poppins", system-ui, sans-serif'
  const SS = 2 // supersample for sharpness
  const padX = 22
  const padY = 14

  const measure = document.createElement('canvas').getContext('2d')!
  const font = `${weight} ${fontPx * SS}px ${family}`
  measure.font = font
  const tw = measure.measureText(text).width
  const w = Math.ceil(tw + padX * 2 * SS)
  const h = Math.ceil(fontPx * SS + padY * 2 * SS)

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!

  // High-contrast dark rounded-pill background so labels stay legible over
  // the bright curve, area fill and grid. Drawn first, inside the padding.
  const r = Math.min(h * 0.32, 18 * SS)
  const bw = w - SS
  const bh = h - SS
  const bx = SS / 2
  const by = SS / 2
  ctx.beginPath()
  ctx.moveTo(bx + r, by)
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r)
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r)
  ctx.arcTo(bx, by + bh, bx, by, r)
  ctx.arcTo(bx, by, bx + bw, by, r)
  ctx.closePath()
  ctx.fillStyle = 'rgba(7,10,14,0.72)'
  ctx.fill()

  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2 + SS)

  const texture = new THREE.CanvasTexture(c)
  texture.anisotropy = 4
  texture.minFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, aspect: w / h }
}

function Label({
  text,
  position,
  worldHeight = 0.58,
  color,
  mono = false,
  fontPx = 36,
  weight = '600',
  opacity = 1,
}: {
  text: string
  position: [number, number, number]
  worldHeight?: number
  color?: string
  mono?: boolean
  fontPx?: number
  weight?: string
  opacity?: number
}) {
  const { texture, aspect } = useMemo(
    () => makeLabelTexture(text, { fontPx, color, mono, weight }),
    [text, fontPx, color, mono, weight],
  )
  // Dispose the GPU texture when the label unmounts / its text changes.
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={position} scale={[worldHeight * aspect, worldHeight, 1]}>
      <spriteMaterial map={texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

/* ----------------------------- html pill label ------------------------- */
/**
 * Crisp white pill label as a drei <Html> (the SkillsModule SkillLabels() gold
 * standard). DOM, so it is always sharp and never clipped by the 3D curve or
 * fill. White #eef3f6 text on a dark rounded pill with a colored border; an
 * optional colored dot. zIndexRange={[20,0]} keeps it BELOW the overlay panels
 * (which are z-index 200) so an opened About/Controls card sits in front of it.
 * Deliberately SMALL (fontSize ~11-12, tight padding): these are tick/data
 * labels on a dense plot, so they must stay compact and out of the curve, not
 * the roomy vertex labels the SkillsModule radar can afford.
 */
function HtmlLabel({
  text,
  position,
  color = PAL.chalk,
  fontSize = 11,
  dot = false,
  mono = false,
  distanceFactor = 32,
}: {
  text: string
  position: [number, number, number]
  color?: string
  fontSize?: number
  dot?: boolean
  mono?: boolean
  distanceFactor?: number
}) {
  return (
    <Html position={position} center distanceFactor={distanceFactor} zIndexRange={[20, 0]} occlude={false}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 7px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
          background: 'rgba(7, 10, 14, 0.9)',
          border: `1px solid ${color}`,
          boxShadow: '0 1px 5px rgba(0,0,0,0.5)',
          fontFamily: mono
            ? 'ui-monospace, "JetBrains Mono", "Barlow Condensed", monospace'
            : '"Barlow Condensed", Poppins, sans-serif',
          fontWeight: 700,
          fontSize,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: PAL.chalk,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flex: 'none' }} />}
        {text}
      </div>
    </Html>
  )
}

/* --------------------------- curve helpers ----------------------------- */

/** N world-space points along a curve, scaled by `mult`, placed at depth z. */
function curvePoints(samples: number[], mult: number, z: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1)
    const y = clamp(valAt(samples, u) * mult, 0, 1.1) * YS
    pts.push(new THREE.Vector3(xOfU(u), y, z))
  }
  return pts
}

/** Tube geometry from a sampled curve (32-sided -> 8 radial segs is plenty). */
function tubeGeometryFrom(pts: THREE.Vector3[], radius: number): THREE.TubeGeometry {
  const crv = new THREE.CatmullRomCurve3(pts)
  return new THREE.TubeGeometry(crv, 96, radius, 10, false)
}

/** Filled area under a sampled curve as a double-sided ribbon (two-tri strip). */
function areaGeometryFrom(pts: THREE.Vector3[]): THREE.BufferGeometry {
  const pos: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const z = a.z
    // two triangles: (a,0)-(b,0)-(a,y) and (b,0)-(b,y)-(a,y)
    pos.push(a.x, 0, z, b.x, 0, z, a.x, a.y, z)
    pos.push(b.x, 0, z, b.x, b.y, z, a.x, a.y, z)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/* ----------------------------- the morphing curve ---------------------- */

/**
 * The active athlete's curve. We keep an eased "displayed" sample array in a
 * ref and rebuild the tube + area geometry each frame as it settles toward the
 * target archetype, so switching presets morphs smoothly (no React per-frame).
 */
function ActiveCurve({ targetSamples }: { targetSamples: number[] }) {
  const reduce = prefersReducedMotion()
  const tubeRef = useRef<THREE.Mesh>(null)
  const areaRef = useRef<THREE.Mesh>(null)
  const nodesRef = useRef<THREE.Group>(null)
  // The currently displayed samples (mutated toward targetSamples each frame).
  const shown = useRef<number[]>(targetSamples.slice())
  const lastBuilt = useRef<string>('')

  // Reusable material so we are not recreating it every rebuild.
  const tubeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PAL.both,
        emissive: PAL.both,
        emissiveIntensity: 0.55,
        roughness: 0.4,
        metalness: 0.15,
        toneMapped: false,
      }),
    [],
  )
  const areaMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: PAL.yellowGreen,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  function rebuildGeometry() {
    const pts = curvePoints(shown.current, 1, 0)
    if (tubeRef.current) {
      tubeRef.current.geometry.dispose()
      tubeRef.current.geometry = tubeGeometryFrom(pts, 0.13)
    }
    if (areaRef.current) {
      areaRef.current.geometry.dispose()
      areaRef.current.geometry = areaGeometryFrom(pts)
    }
    // Re-seat each task node group (its sphere sits ON the curve). The label +
    // leader line are offset locally to a staggered tier, so only the group's
    // Y (the curve height) animates here; the stagger offsets stay constant.
    if (nodesRef.current) {
      nodesRef.current.children.forEach((child) => {
        const seconds = child.userData.seconds as number
        const u = clamp(logU(seconds, T_MIN, T_MAX), 0, 1)
        child.position.y = valAt(shown.current, u) * YS
      })
    }
  }

  useFrame((_, dt) => {
    const k = reduce ? 1 : smoothK(Math.min(dt, 0.05), 9)
    let moved = false
    for (let i = 0; i < shown.current.length; i++) {
      const next = lerp(shown.current[i], targetSamples[i], k)
      if (Math.abs(next - shown.current[i]) > 1e-4) moved = true
      shown.current[i] = next
    }
    // Idle micro-motion key so we still rebuild on the first frame.
    const key = shown.current.map((v) => v.toFixed(4)).join(',')
    if (moved || key !== lastBuilt.current) {
      rebuildGeometry()
      lastBuilt.current = key
    }
  })

  // Static node positions on X (Y is animated above); white emissive spheres.
  const taskX = useMemo(() => POWER_TASKS.map((t) => xOf(t.seconds)), [])

  return (
    <group>
      <mesh ref={areaRef} material={areaMat}>
        <bufferGeometry />
      </mesh>
      <mesh ref={tubeRef} material={tubeMat}>
        <bufferGeometry />
      </mesh>

      {/* "AREA = FITNESS" - the key idea of the module, so it reads clearly
          inside the fill (the brightest region). Sized to be legible, not tiny. */}
      <Label
        text="AREA = FITNESS"
        position={[xOfU(0.32), YS * 0.3, 0.25]}
        worldHeight={0.82}
        color={PAL.yellowGreen}
        mono
        fontPx={42}
        weight="700"
      />

      {/* Task markers ride the active curve and morph with it. Ten markers on a
          log axis cluster on the LEFT (short events) and would collide if labels
          shared a height, so labels are STAGGERED across three tiers (cycled by
          index) and joined to their dot by a thin leader line. Each child group
          is re-seated in Y by the frame loop above; the label + leader offsets
          below it stay constant. */}
      <group ref={nodesRef}>
        {POWER_TASKS.map((task, i) => {
          const y0 = valAt(targetSamples, clamp(logU(task.seconds, T_MIN, T_MAX), 0, 1)) * YS
          // Cycle three tiers so neighbouring markers never share a label height.
          const tier = TASK_TIERS[i % TASK_TIERS.length]
          return (
            <group key={task.name} position={[taskX[i], y0, 0]} userData={{ seconds: task.seconds }}>
              {/* dot stays exactly on the curve (small, so it does not take over) */}
              <mesh>
                <sphereGeometry args={[0.1, 20, 20]} />
                <meshStandardMaterial color={PAL.chalk} emissive={PAL.chalk} emissiveIntensity={0.4} roughness={0.35} toneMapped={false} />
              </mesh>
              {/* thin leader line from the dot up to its staggered label */}
              <mesh position={[0, tier / 2, 0.02]}>
                <boxGeometry args={[0.016, tier, 0.016]} />
                <meshBasicMaterial color={PAL.chalk} transparent opacity={0.35} toneMapped={false} />
              </mesh>
              {/* small crisp white task name (drei <Html> pill) - rides the curve
                  with the group, never clips behind the fill. */}
              <HtmlLabel
                text={task.name}
                position={[0, tier + 0.24, 0.04]}
                color={PAL.yellowGreen}
                fontSize={10.5}
              />
            </group>
          )
        })}
      </group>
    </group>
  )
}

/* ----------------------------- ghost generalist ------------------------ */
function GhostGeneralist() {
  const { geo, lastY } = useMemo(() => {
    const pts = curvePoints(CURVE_BY_KEY[DEFAULT_ATHLETE].samples, 1, 0.12)
    return { geo: tubeGeometryFrom(pts, 0.045), lastY: pts[N - 1].y }
  }, [])
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={PAL.fit} emissive={PAL.fit} emissiveIntensity={0.4} roughness={0.5} transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <Label text="Generalist, for scale" position={[X1 + 0.5, lastY + 0.5, 0]} worldHeight={0.44} color={PAL.fit} fontPx={26} />
    </group>
  )
}

/* ----------------------------- modal domains --------------------------- */
function ModalDomains({ athlete }: { athlete: AthleteKey }) {
  const samples = CURVE_BY_KEY[athlete].samples
  const mult = domainMult(athlete)
  const built = useMemo(() => {
    return MODAL_DOMAINS.map((dom, d) => {
      const z = map(d, 0, MODAL_DOMAINS.length - 1, -2.6, 2.6)
      const pts = curvePoints(samples, mult[d], z)
      return { geo: tubeGeometryFrom(pts, 0.04), color: dom.color, name: dom.name, z, lastY: pts[N - 1].y }
    })
  }, [samples, mult])
  return (
    <group>
      {built.map((b) => (
        <group key={b.name}>
          <mesh geometry={b.geo}>
            <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.45} roughness={0.5} transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <Label text={b.name} position={[X1 + 1.7, b.lastY, b.z]} worldHeight={0.42} color={b.color} fontPx={26} />
        </group>
      ))}
    </group>
  )
}

/* ----------------------------- axes + ticks ---------------------------- */
// Relative-power gridlines on Y. 1.0 = the most powerful possible burst (the
// shared scale's ceiling); 0.5 is a mid reference. Higher = more power.
const Y_LEVELS: { v: number; label: string }[] = [
  { v: 1.0, label: '1.0' },
  { v: 0.5, label: '0.5' },
]

// X-axis time labels are sparse: a curated subset of the 8 log durations that
// spreads evenly so the pills never collide on the squeezed left side of the
// log axis (the small tick marks still sit under all 8 durations). Indices into
// POWER_DURATIONS / POWER_DURATION_LABELS: 1 s, 10 s, 1 min, 5 min, 15 min, 1 hr.
const X_LABEL_INDICES = [0, 1, 3, 4, 5, 7]

function Axes() {
  // Build the axis + tick + Y-grid line objects once; they never change, so
  // memoizing the THREE.Line objects (not just geometry) keeps them stable
  // across the parent's athlete/domain re-renders.
  const lines = useMemo(() => {
    const axisMat = new THREE.LineBasicMaterial({ color: new THREE.Color(PAL.muted), transparent: true, opacity: 0.85 })
    const gridMat = new THREE.LineBasicMaterial({ color: new THREE.Color(PAL.muted), transparent: true, opacity: 0.22 })
    const mk = (a: THREE.Vector3, b: THREE.Vector3, mat = axisMat) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat)
    const out: THREE.Line[] = [
      // X axis (duration) and Y axis (power).
      mk(new THREE.Vector3(X0, 0, 0), new THREE.Vector3(X1 + 0.6, 0, 0)),
      mk(new THREE.Vector3(X0, 0, 0), new THREE.Vector3(X0, YS + 0.5, 0)),
    ]
    // X ticks at each of the 8 log durations.
    for (const t of POWER_DURATIONS) {
      const x = xOf(t)
      out.push(mk(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -0.28, 0)))
    }
    // Faint horizontal Y reference levels (0.5 and 1.0 = max) spanning the plot.
    for (const lvl of Y_LEVELS) {
      const y = lvl.v * YS
      out.push(mk(new THREE.Vector3(X0, y, 0), new THREE.Vector3(X1 + 0.2, y, 0), gridMat))
    }
    return out
  }, [])
  return (
    <group>
      {lines.map((ln, i) => (
        <primitive key={i} object={ln} />
      ))}

      {/* X axis: clearly LOGARITHMIC. Small crisp WHITE pills on a SPARSE, evenly
          spread subset of the log-time ticks (drei <Html>, always sharp) so they
          never overlap where the short events squeeze together on the left. */}
      {X_LABEL_INDICES.map((i) => (
        <HtmlLabel
          key={POWER_DURATIONS[i]}
          text={POWER_DURATION_LABELS[i]}
          position={[xOf(POWER_DURATIONS[i]), -0.72, 0]}
          color={PAL.yellowGreen}
          fontSize={10.5}
          mono
        />
      ))}
      {/* Bottom axis title - a crisp white pill (matches the Energy Systems
          module) so the log-time axis is clearly NAMED, not just bare seconds. */}
      <HtmlLabel text="Effort duration (log)" position={[0, -1.75, 0]} color={PAL.muted} fontSize={12} mono />

      {/* Y axis: relative power, higher = more. Small WHITE reference pill tucked
          just OUTSIDE the left axis, not over the curve or fill. */}
      {Y_LEVELS.map((lvl) => (
        <HtmlLabel
          key={lvl.label}
          text={lvl.label}
          position={[X0 - 0.72, lvl.v * YS, 0]}
          color={lvl.v >= 1 ? PAL.yellowGreen : PAL.robust}
          fontSize={10.5}
          mono
        />
      ))}
      {/* Y axis title in the top-left margin - matching crisp white pill. */}
      <HtmlLabel text="Power output" position={[X0 + 0.6, YS + 0.9, 0]} color={PAL.muted} fontSize={12} mono />
    </group>
  )
}

/* ----------------------------- the scene ------------------------------- */
function DefinitionScene({ athlete, showDomains }: { athlete: AthleteKey; showDomains: boolean }) {
  const reduce = prefersReducedMotion()
  const driftRef = useRef<THREE.Group>(null)
  const targetSamples = CURVE_BY_KEY[athlete].samples

  // Gentle idle drift on the whole plot so it never feels frozen.
  useFrame(({ clock }) => {
    if (!driftRef.current || reduce) return
    driftRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.18) * 0.05
  })

  return (
    <group position={[0, 0.2, 0]}>
      {/* dark ground plane + soft grid for grounding */}
      <gridHelper args={[34, 26, '#1c3326', '#11201a']} position={[0, -0.02, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#070d0a" roughness={1} metalness={0} transparent opacity={0.9} />
      </mesh>
      <ContactShadows position={[0, 0.0, 0]} opacity={0.32} scale={30} blur={2.6} far={9} resolution={512} color="#000000" />

      <group ref={driftRef}>
        <Axes />
        {athlete !== DEFAULT_ATHLETE && <GhostGeneralist />}
        {showDomains && <ModalDomains athlete={athlete} />}
        <ActiveCurve targetSamples={targetSamples} />
      </group>
    </group>
  )
}

/* ----------------------------- controls -------------------------------- */
function DefinitionControls({
  athlete,
  setAthlete,
  showDomains,
  setShowDomains,
}: {
  athlete: AthleteKey
  setAthlete: (a: AthleteKey) => void
  showDomains: boolean
  setShowDomains: (v: boolean) => void
}) {
  const samples = CURVE_BY_KEY[athlete].samples
  const score = scoreOf(samples)
  const word = scoreWord(score)
  const color = scoreColor(score)

  return (
    <div>
      <ControlHead>Work capacity</ControlHead>

      <div style={{ fontSize: 12, color: 'var(--wf-muted)', marginBottom: 10, lineHeight: 1.5 }}>
        Power falls as duration grows. A specialist wins one zone; the generalist wins the area.
      </div>

      <Readout
        label="Fitness, area under the curve"
        value={
          <>
            {score}
            <span style={{ fontSize: 15, color: 'var(--wf-muted)' }}>/100</span>{' '}
            <span style={{ fontSize: 15, color }}>{word}</span>
          </>
        }
        sub="Power averaged across all modal domains."
      />

      <PresetButtons<AthleteKey> options={ATHLETES} value={athlete} onChange={setAthlete} />

      <div className="wf-btns">
        <button
          className={`wf-btn ${showDomains ? 'primary' : ''}`}
          onClick={() => setShowDomains(!showDomains)}
        >
          {showDomains ? 'Hide the 5 modal domains' : 'Show the 5 modal domains'}
        </button>
      </div>

      {showDomains && <Legend items={MODAL_DOMAINS.map((d) => ({ label: d.name, color: d.color }))} />}

      <div style={{ fontSize: 11.5, color: 'var(--wf-muted)', marginTop: 8, lineHeight: 1.5 }}>
        Pick a specialist and the broad curve stays as a ghost. They beat the generalist in one zone and lose the
        area. P(t) = CP + W prime / t is the sustained tail.
      </div>
    </div>
  )
}

/* ----------------------------- module ---------------------------------- */
export default function DefinitionModule() {
  const [athlete, setAthlete] = useState<AthleteKey>(DEFAULT_ATHLETE)
  const [showDomains, setShowDomains] = useState(false)

  return (
    <ModulePage moduleKey="definition">
      <LessonStage
        eyebrow={MODULE_COPY.definition.eyebrow}
        title={moduleByKey('definition').title}
        body={MODULE_COPY.definition.body}
        camera={{ position: [0, 4.6, 29], fov: 50 }}
        target={[0, 3.5, 0]}
        minDistance={14}
        maxDistance={64}
        controls={
          <DefinitionControls
            athlete={athlete}
            setAthlete={setAthlete}
            showDomains={showDomains}
            setShowDomains={setShowDomains}
          />
        }
      >
        <DefinitionScene athlete={athlete} showDomains={showDomains} />
      </LessonStage>
    </ModulePage>
  )
}
