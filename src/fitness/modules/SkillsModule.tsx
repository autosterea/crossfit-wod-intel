import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import {
  moduleByKey,
  MODULE_COPY,
  SKILLS,
  ARCHETYPES,
  SKILL_NAMES,
  PAL,
  type SkillClass,
} from '../fitnessData'
import { clamp, lerp, smoothK, prefersReducedMotion } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, Readout, Legend, ControlHead, PresetButtons, Slider } from '../ui'

/* =========================================================================
   Module 01 - The 10 General Physical Skills.

   A premium 3D decagon radar of Glassman's ten skills on a polar grid. Ported
   from moduleSkills() in what-is-fitness-3d.html (filled web + class-colored
   spokes + glowing tip nodes + skill labels + profile presets + per-skill
   sliders) and extended per spec: the user can COMPARE two athletes at once.
   Athlete A renders solid (filled in its accent, colored spokes, glowing
   nodes); Athlete B renders as a bright outline ghost overlaid on top, so a
   specialist's spikes-and-gaps shape reads against the generalist's round one.
   A reference decagon and a "Custom" mode with ten sliders round it out.
   Every number is grounded in fitnessData (ARCHETYPES profiles, SKILLS order).
   ========================================================================= */

const N = SKILLS.length // 10
const MAX_VALUE = 10
const RADIUS_PER_POINT = 1.2 // value 10 -> radius 12 world units
const MAX_RADIUS = MAX_VALUE * RADIUS_PER_POINT // 12
const REF_VALUE = 7.5 // dashed reference decagon (a balanced 7.5 across the wheel)
const LABEL_RADIUS = MAX_RADIUS + 1.7
const Y_PLANE = 0.08 // the radar plane floats just above the grid floor

const CUSTOM = 'Custom'
const ARCHETYPE_NAMES = ARCHETYPES.map((a) => a.name)
const A_OPTIONS: string[] = [...ARCHETYPE_NAMES, CUSTOM]
/** None lets the user hide the B comparison ghost. */
const B_NONE = 'None'
const B_OPTIONS: string[] = [B_NONE, ...ARCHETYPE_NAMES]

const CLASS_COLOR: Record<SkillClass, string> = {
  trained: PAL.trained,
  practiced: PAL.practiced,
  both: PAL.both,
}

const angleAt = (i: number): number => -Math.PI / 2 + i * ((Math.PI * 2) / N)

/** Unit-circle direction (x, z) for skill i; y is the fixed radar plane. */
const dirAt = (i: number): [number, number] => [Math.cos(angleAt(i)), Math.sin(angleAt(i))]

const profileByName = (name: string): number[] => {
  const a = ARCHETYPES.find((x) => x.name === name)
  return a ? a.profile.slice() : DEFAULT_CUSTOM.slice()
}

/** A neutral starting point for Custom mode (the generalist shape). */
const DEFAULT_CUSTOM = ARCHETYPES[0].profile.slice()

const breadthOf = (vals: number[]): number =>
  Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) // mean of 10 -> 0..100

const rangeOf = (vals: number[]): number => {
  let lo = Infinity
  let hi = -Infinity
  for (const v of vals) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return Math.round((hi - lo) * 10) / 10
}

/* ----------------------------- 3D pieces ------------------------------- */

/**
 * Static polar grid (concentric rings + radial spokes) as a prebuilt THREE
 * Group. Built imperatively so the lowercase R3F `<line>` intrinsic (which
 * collides with the SVG `line` JSX type) is never used.
 */
function PolarGrid() {
  const grid = useMemo(() => {
    const group = new THREE.Group()
    const ringMat = new THREE.LineBasicMaterial({ color: PAL.chalk, transparent: true, opacity: 0.13 })
    for (const rv of [2, 4, 6, 8, 10]) {
      const r = rv * RADIUS_PER_POINT
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2
        pts.push(new THREE.Vector3(r * Math.cos(a), Y_PLANE - 0.05, r * Math.sin(a)))
      }
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMat))
    }
    const seg: number[] = []
    for (let s = 0; s < N; s++) {
      const [dx, dz] = dirAt(s)
      seg.push(0, Y_PLANE - 0.05, 0, MAX_RADIUS * dx, Y_PLANE - 0.05, MAX_RADIUS * dz)
    }
    const sgeo = new THREE.BufferGeometry()
    sgeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
    group.add(
      new THREE.LineSegments(
        sgeo,
        new THREE.LineBasicMaterial({ color: PAL.chalk, transparent: true, opacity: 0.1 }),
      ),
    )
    return group
  }, [])
  return <primitive object={grid} />
}

/** Dashed reference decagon at the balanced REF_VALUE - the "generalist line". */
function ReferenceRing() {
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const r = REF_VALUE * RADIUS_PER_POINT
    for (let i = 0; i <= N; i++) {
      const a = angleAt(i % N)
      pts.push(new THREE.Vector3(r * Math.cos(a), Y_PLANE, r * Math.sin(a)))
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    const l = new THREE.Line(
      g,
      new THREE.LineDashedMaterial({
        color: PAL.muted,
        transparent: true,
        opacity: 0.4,
        dashSize: 0.5,
        gapSize: 0.45,
      }),
    )
    l.computeLineDistances()
    return l
  }, [])
  return <primitive object={line} />
}

/** Per-vertex skill labels (self-contained drei <Html>, no fetched font). */
function SkillLabels() {
  return (
    <>
      {SKILL_NAMES.map((name, i) => {
        const [dx, dz] = dirAt(i)
        const color = CLASS_COLOR[SKILLS[i].classification]
        return (
          <Html
            key={name}
            position={[LABEL_RADIUS * dx, 0.55, LABEL_RADIUS * dz]}
            center
            distanceFactor={26}
            zIndexRange={[20, 0]}
            occlude={false}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 9px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                background: 'rgba(7, 10, 14, 0.66)',
                border: '1px solid rgba(238,243,246,0.12)',
                fontFamily: '"Barlow Condensed", Poppins, sans-serif',
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#eef3f6',
                userSelect: 'none',
                pointerEvents: 'none',
                backdropFilter: 'blur(3px)',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} />
              {name}
            </div>
          </Html>
        )
      })}
    </>
  )
}

/**
 * One athlete's radar shape. `values` is the live (eased) profile; the parent
 * mutates a refs-backed array each frame so React never re-renders per frame.
 *  - variant "solid": filled translucent web, class-colored spokes, glowing
 *    tip nodes (Athlete A).
 *  - variant "ghost": a bright outline-only decagon that hovers a touch higher,
 *    so it reads clearly over A's fill (Athlete B compare).
 */
function RadarShape({
  valuesRef,
  variant,
  accent,
}: {
  valuesRef: React.MutableRefObject<number[]>
  variant: 'solid' | 'ghost'
  accent: string
}) {
  const yOff = variant === 'ghost' ? 0.16 : 0
  const fillRef = useRef<THREE.Mesh>(null)
  const outlineRef = useRef<THREE.LineLoop>(null)
  const spokesRef = useRef<THREE.LineSegments>(null)
  const nodesRef = useRef<THREE.InstancedMesh>(null)

  // Filled web geometry: center vertex + one vertex per skill, triangulated fan.
  const fillGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3))
    const idx: number[] = []
    for (let t = 0; t < N; t++) idx.push(0, 1 + t, 1 + ((t + 1) % N))
    g.setIndex(idx)
    return g
  }, [])

  // Outline loop (the decagon edge) - this is the only line drawn for ghosts.
  const outlineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    return g
  }, [])

  // Spokes from center to each tip, vertex-colored by skill class (solid only).
  const spokeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3))
    const col = new Float32Array(N * 2 * 3)
    const tmp = new THREE.Color()
    for (let s = 0; s < N; s++) {
      tmp.set(CLASS_COLOR[SKILLS[s].classification])
      // center end: dim neutral; tip end: full class color
      col[s * 6 + 0] = 0.5
      col[s * 6 + 1] = 0.56
      col[s * 6 + 2] = 0.66
      col[s * 6 + 3] = tmp.r
      col[s * 6 + 4] = tmp.g
      col[s * 6 + 5] = tmp.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])

  const nodeColors = useMemo(() => {
    const arr = new Float32Array(N * 3)
    const tmp = new THREE.Color()
    for (let i = 0; i < N; i++) {
      tmp.set(CLASS_COLOR[SKILLS[i].classification])
      arr[i * 3] = tmp.r
      arr[i * 3 + 1] = tmp.g
      arr[i * 3 + 2] = tmp.b
    }
    return arr
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state) => {
    const vals = valuesRef.current
    const fillPos = fillGeom.getAttribute('position') as THREE.BufferAttribute
    const fa = fillPos.array as Float32Array
    fa[0] = 0
    fa[1] = Y_PLANE + yOff
    fa[2] = 0

    const outPos = outlineGeom.getAttribute('position') as THREE.BufferAttribute
    const oa = outPos.array as Float32Array
    const spPos = spokeGeom.getAttribute('position') as THREE.BufferAttribute
    const sa = spPos.array as Float32Array

    // gentle synchronized node pulse (skipped under reduced motion via amp=0)
    const pulse = pulseAmp * Math.sin(state.clock.getElapsedTime() * 2.2)

    for (let i = 0; i < N; i++) {
      const [dx, dz] = dirAt(i)
      const r = clamp(vals[i], 0, MAX_VALUE) * RADIUS_PER_POINT
      const x = r * dx
      const z = r * dz
      const y = Y_PLANE + yOff

      fa[(1 + i) * 3 + 0] = x
      fa[(1 + i) * 3 + 1] = y
      fa[(1 + i) * 3 + 2] = z

      oa[i * 3 + 0] = x
      oa[i * 3 + 1] = y
      oa[i * 3 + 2] = z

      sa[i * 6 + 0] = 0
      sa[i * 6 + 1] = y
      sa[i * 6 + 2] = 0
      sa[i * 6 + 3] = x
      sa[i * 6 + 4] = y
      sa[i * 6 + 5] = z

      if (nodesRef.current) {
        dummy.position.set(x, y, z)
        const s = (variant === 'ghost' ? 0.26 : 0.32) * (1 + pulse)
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        nodesRef.current.setMatrixAt(i, dummy.matrix)
      }
    }

    fillPos.needsUpdate = true
    fillGeom.computeBoundingSphere()
    outPos.needsUpdate = true
    spPos.needsUpdate = true
    if (nodesRef.current) nodesRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {variant === 'solid' && (
        <mesh ref={fillRef} geometry={fillGeom}>
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {variant === 'solid' && (
        // eslint-disable-next-line react/no-unknown-property
        <lineSegments ref={spokesRef} geometry={spokeGeom}>
          <lineBasicMaterial vertexColors transparent opacity={0.9} toneMapped={false} />
        </lineSegments>
      )}

      {/* eslint-disable-next-line react/no-unknown-property */}
      <lineLoop ref={outlineRef} geometry={outlineGeom}>
        <lineBasicMaterial
          color={accent}
          transparent
          opacity={variant === 'ghost' ? 0.95 : 0.7}
          toneMapped={false}
        />
      </lineLoop>

      <instancedMesh ref={nodesRef} args={[undefined, undefined, N]}>
        <sphereGeometry args={[1, 32, 32]} />
        {variant === 'solid' ? (
          // instanceColor drives the per-node class color; a soft emissive of
          // the same tint gives each tip its glow (set per-instance below).
          <meshStandardMaterial
            metalness={0.65}
            roughness={0.3}
            emissive="#ffffff"
            emissiveIntensity={0.22}
            toneMapped={false}
          />
        ) : (
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.7}
            metalness={0.2}
            roughness={0.5}
            toneMapped={false}
          />
        )}
        {variant === 'solid' && (
          <instancedBufferAttribute attach="instanceColor" args={[nodeColors, 3]} />
        )}
      </instancedMesh>
    </group>
  )
}

/** Pulse amplitude (module-level so RadarShape reads the reduced-motion value). */
let pulseAmp = 0.07

/* ------------------------------ the scene ------------------------------ */

function SkillsScene({
  targetA,
  targetB,
  accentA,
  accentB,
  showB,
}: {
  targetA: number[]
  targetB: number[]
  accentA: string
  accentB: string
  showB: boolean
}) {
  const reduced = prefersReducedMotion()
  pulseAmp = reduced ? 0 : 0.07

  const valuesA = useRef<number[]>(targetA.slice())
  const valuesB = useRef<number[]>(targetB.slice())

  // Ease the live values toward the latest targets every frame (no re-render).
  useFrame((_, dt) => {
    const k = reduced ? 1 : smoothK(dt, 12)
    const a = valuesA.current
    for (let i = 0; i < N; i++) a[i] = lerp(a[i], targetA[i], k)
    const b = valuesB.current
    for (let i = 0; i < N; i++) b[i] = lerp(b[i], targetB[i], k)
  })

  return (
    <group>
      {/* dark grounding floor + faint grid for depth */}
      <gridHelper args={[MAX_RADIUS * 2.6, 26, '#1d2a22', '#121a15']} position={[0, -0.02, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <circleGeometry args={[MAX_RADIUS * 1.55, 64]} />
        <meshStandardMaterial color="#070d0a" roughness={0.95} metalness={0.05} />
      </mesh>
      <ContactShadows
        position={[0, 0.02, 0]}
        scale={MAX_RADIUS * 2.6}
        blur={2.6}
        opacity={0.4}
        far={6}
        resolution={512}
        color="#000000"
      />

      <PolarGrid />
      <ReferenceRing />
      <SkillLabels />

      <RadarShape valuesRef={valuesA} variant="solid" accent={accentA} />
      {showB && <RadarShape valuesRef={valuesB} variant="ghost" accent={accentB} />}
    </group>
  )
}

/* ----------------------------- controls -------------------------------- */

function SkillsControls({
  athleteA,
  athleteB,
  custom,
  liveA,
  liveB,
  accentA,
  accentB,
  onA,
  onB,
  onSlider,
}: {
  athleteA: string
  athleteB: string
  custom: number[]
  liveA: number[]
  liveB: number[]
  accentA: string
  accentB: string
  onA: (v: string) => void
  onB: (v: string) => void
  onSlider: (i: number, v: number) => void
}) {
  const breadthA = breadthOf(liveA)
  const breadthB = breadthOf(liveB)
  const balanceA = rangeOf(liveA)
  const showB = athleteB !== B_NONE
  const isCustom = athleteA === CUSTOM

  return (
    <div>
      <ControlHead right={<span style={{ textTransform: 'none', letterSpacing: 0 }}>compare two</span>}>
        Athletes
      </ControlHead>

      <Readout
        label="Fitness breadth - A"
        value={
          <>
            {breadthA}
            <span style={{ fontSize: 13, color: 'var(--wf-muted)' }}> / 100</span>
          </>
        }
        sub={`${athleteA} - balance ${(MAX_VALUE - balanceA).toFixed(1)}/10 (range ${balanceA.toFixed(1)})`}
        color={accentA}
      />

      {showB && (
        <Readout
          label="Fitness breadth - B"
          value={
            <>
              {breadthB}
              <span style={{ fontSize: 13, color: 'var(--wf-muted)' }}> / 100</span>
            </>
          }
          sub={`${athleteB} - gap to A ${breadthA - breadthB > 0 ? '+' : ''}${breadthA - breadthB}`}
          color={accentB}
        />
      )}

      <div style={{ fontSize: 11, color: 'var(--wf-muted)', margin: '2px 0 4px', letterSpacing: '0.04em' }}>
        Athlete A (filled)
      </div>
      <PresetButtons options={A_OPTIONS} value={athleteA} onChange={onA} />

      <div style={{ fontSize: 11, color: 'var(--wf-muted)', margin: '2px 0 4px', letterSpacing: '0.04em' }}>
        Athlete B (compare ghost)
      </div>
      <PresetButtons options={B_OPTIONS} value={athleteB} onChange={onB} />

      <div style={{ height: 6 }} />
      <Legend
        items={[
          { label: 'Trained (organic)', color: CLASS_COLOR.trained },
          { label: 'Practiced (neural)', color: CLASS_COLOR.practiced },
          { label: 'Both', color: CLASS_COLOR.both },
        ]}
      />

      {isCustom && (
        <>
          <div style={{ height: 12 }} />
          <ControlHead>Edit profile</ControlHead>
          {SKILLS.map((s, i) => (
            <Slider
              key={s.name}
              label={s.name}
              value={custom[i]}
              display={custom[i].toFixed(1)}
              min={0}
              max={MAX_VALUE}
              step={0.1}
              dotColor={CLASS_COLOR[s.classification]}
              onChange={(v) => onSlider(i, v)}
            />
          ))}
        </>
      )}
    </div>
  )
}

/* ------------------------------- module -------------------------------- */

export default function SkillsModule() {
  const meta = moduleByKey('skills')
  const copy = MODULE_COPY.skills

  const [athleteA, setAthleteA] = useState<string>(ARCHETYPES[0].name) // Generalist
  const [athleteB, setAthleteB] = useState<string>(ARCHETYPES[2].name) // Powerlifter (a vivid contrast)
  const [custom, setCustom] = useState<number[]>(DEFAULT_CUSTOM.slice())

  // The accent for A: its archetype-derived hue (generalist = brand green),
  // specialists get the brand yellow-green so the fill stays on-palette.
  const accentA = athleteA === ARCHETYPES[0].name ? PAL.seaGreen : PAL.yellowGreen
  const accentB = PAL.robust // a bright cyan outline reads clearly over the fill

  // The target profiles the scene eases toward.
  const targetA = useMemo<number[]>(
    () => (athleteA === CUSTOM ? custom.slice() : profileByName(athleteA)),
    [athleteA, custom],
  )
  const targetB = useMemo<number[]>(
    () => (athleteB === B_NONE ? new Array(N).fill(0) : profileByName(athleteB)),
    [athleteB],
  )

  const handleA = (v: string) => {
    setAthleteA(v)
    if (v === CUSTOM) setCustom((c) => (c.length === N ? c : DEFAULT_CUSTOM.slice()))
  }

  const handleSlider = (i: number, v: number) => {
    setAthleteA(CUSTOM)
    setCustom((c) => {
      const next = c.slice()
      next[i] = v
      return next
    })
  }

  const showB = athleteB !== B_NONE

  return (
    <ModulePage moduleKey="skills">
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={copy.body}
        autoRotate
        autoRotateSpeed={0.35}
        camera={{ position: [0, 17, 24], fov: 50 }}
        target={[0, 0.5, 0]}
        minDistance={14}
        maxDistance={48}
        hint="Drag to orbit. Pick Athlete A and a compare ghost. Edit Custom with the sliders."
        controls={
          <SkillsControls
            athleteA={athleteA}
            athleteB={athleteB}
            custom={custom}
            liveA={targetA}
            liveB={targetB}
            accentA={accentA}
            accentB={accentB}
            onA={handleA}
            onB={setAthleteB}
            onSlider={handleSlider}
          />
        }
      >
        <SkillsScene
          targetA={targetA}
          targetB={targetB}
          accentA={accentA}
          accentB={accentB}
          showB={showB}
        />
      </LessonStage>
    </ModulePage>
  )
}
