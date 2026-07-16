import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import { CF_PILLARS, CF_SCALING, HIERARCHY, HIERARCHY_RULE, HUNDRED_WORDS, MODULE_COPY, PAL, moduleByKey } from '../fitnessData'
import { clamp, lerp } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, ControlHead, Readout, Slider, Segmented, SectionCard, LessonHeading } from '../ui'

/* =========================================================================
   Module 07 - What Is CrossFit? The Methodology.

   Centerpiece: the Theoretical Hierarchy of Development (L1 Guide, Figure 5)
   as a physical five-slab pyramid. The learner selects a level and dials in
   a DEFICIENCY; the slab visibly compresses, cracks and darkens, and every
   slab above it tilts, sinks and dims - the guide's dependency rule made
   tangible: "If you have a deficiency at any level of 'the pyramid' the
   components above will suffer."

   All per-frame motion mutates refs inside useFrame; React state only holds
   the control TARGETS (selected level + per-level deficiency).
   ========================================================================= */

const N = HIERARCHY.length
const SLAB_H = 1.06
const GAP = 0.16
const WIDTHS = [9.2, 7.6, 6.1, 4.6, 3.1]
const DEPTHS = [6.4, 5.4, 4.4, 3.4, 2.4]

/** Canvas-texture label (self-contained; no external fonts in the GL scene). */
function makeLabel(text: string, sub: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 224
  const x = c.getContext('2d')!
  x.clearRect(0, 0, c.width, c.height)
  x.textAlign = 'center'
  x.fillStyle = '#eef3f6'
  x.font = '700 92px Barlow Condensed, Arial Narrow, sans-serif'
  x.fillText(text.toUpperCase(), c.width / 2, 104)
  x.fillStyle = color
  x.font = '600 52px Barlow Condensed, Arial Narrow, sans-serif'
  x.fillText(sub.toUpperCase(), c.width / 2, 182)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  return t
}

interface SlabState {
  group: THREE.Group | null
  mesh: THREE.Mesh | null
  mat: THREE.MeshStandardMaterial | null
  labelMat: THREE.MeshBasicMaterial | null
}

function Pyramid({ deficiency, selected }: { deficiency: number[]; selected: number }) {
  const slabs = useRef<SlabState[]>(HIERARCHY.map(() => ({ group: null, mesh: null, mat: null, labelMat: null })))
  const eff = useRef<number[]>(HIERARCHY.map(() => 0)) // smoothed deficiency
  const pulse = useRef(0)

  const labels = useMemo(() => HIERARCHY.map((l) => makeLabel(l.label, l.role, l.color)), [])
  useEffect(() => () => labels.forEach((t) => t.dispose()), [labels])

  const baseColors = useMemo(() => HIERARCHY.map((l) => new THREE.Color(l.color)), [])
  const grey = useMemo(() => new THREE.Color('#3a4348'), [])
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame((_, dt) => {
    const k = clamp(dt * 6, 0, 1)
    pulse.current += dt
    for (let i = 0; i < N; i++) eff.current[i] = lerp(eff.current[i], deficiency[i], k)

    // Stack from the ground up using the *smoothed* compressed heights, so
    // upper layers sink naturally when a lower layer is crushed.
    let y = 0
    for (let i = 0; i < N; i++) {
      const s = slabs.current[i]
      if (!s.group || !s.mat || !s.mesh) continue
      const d = eff.current[i]
      // worst deficiency anywhere BELOW this slab drives its suffering
      let below = 0
      for (let j = 0; j < i; j++) below = Math.max(below, eff.current[j])

      const scaleY = 1 - 0.52 * d
      const h = SLAB_H * scaleY
      s.group.position.y = y + h / 2
      y += h + GAP * (1 - 0.4 * Math.max(d, below))

      // crushed slab cracks sideways; suffering slabs above tilt and slide
      const wobble = Math.sin(pulse.current * 1.7 + i * 2.1) * 0.012
      s.group.rotation.z = d * 0.05 * (i % 2 ? -1 : 1) + below * 0.11 * (i % 2 ? 1 : -1) + wobble * below
      s.group.rotation.x = below * 0.05
      s.group.position.x = below * 0.5 * (i % 2 ? -1 : 1) * (i / N)
      s.mesh.scale.y = scaleY

      // color: own deficiency and inherited suffering both pull toward grey
      const hurt = clamp(d * 0.8 + below * 0.7, 0, 1)
      tmp.copy(baseColors[i]).lerp(grey, hurt * 0.85)
      s.mat.color.copy(tmp)
      s.mat.emissive.copy(baseColors[i]).multiplyScalar(selected === i ? 0.32 : 0.08 * (1 - hurt))
      if (s.labelMat) s.labelMat.opacity = 1 - hurt * 0.55
    }
  })

  return (
    <group position={[0, -2.9, 0]}>
      {HIERARCHY.map((l, i) => (
        <group key={l.key} ref={(g) => (slabs.current[i].group = g)}>
          <mesh ref={(m) => (slabs.current[i].mesh = m)} castShadow receiveShadow>
            <boxGeometry args={[WIDTHS[i], SLAB_H, DEPTHS[i]]} />
            <meshStandardMaterial
              ref={(m) => (slabs.current[i].mat = m)}
              color={l.color}
              metalness={0.15}
              roughness={0.55}
              emissive={l.color}
              emissiveIntensity={1}
            />
          </mesh>
          {/* front label plane */}
          <mesh position={[0, 0, DEPTHS[i] / 2 + 0.012]}>
            <planeGeometry args={[Math.min(WIDTHS[i] * 0.94, 6.8), Math.min(WIDTHS[i] * 0.94, 6.8) * 0.219]} />
            <meshBasicMaterial ref={(m) => (slabs.current[i].labelMat = m)} map={labels[i]} transparent depthWrite={false} />
          </mesh>
        </group>
      ))}
      {/* ground */}
      <ContactShadows position={[0, -0.02, 0]} opacity={0.55} scale={26} blur={2.4} far={9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <circleGeometry args={[13, 48]} />
        <meshStandardMaterial color="#0b1013" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  )
}

/** Floating annotation for the currently selected level. */
function LevelNote({ selected }: { selected: number }) {
  const l = HIERARCHY[selected]
  // approximate the slab's resting center height
  let y = -2.9
  for (let i = 0; i < selected; i++) y += SLAB_H + GAP
  y += SLAB_H / 2
  return (
    <Html position={[WIDTHS[selected] / 2 + 1.1, y, 0]} distanceFactor={13} occlude={false} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          maxWidth: 240,
          padding: '8px 11px',
          borderRadius: 10,
          background: 'rgba(7, 10, 14, 0.92)',
          border: `1px solid ${l.color}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.55)',
          fontFamily: '"Barlow Condensed", Poppins, sans-serif',
          userSelect: 'none',
        }}
      >
        <div style={{ color: l.color, fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{l.label}</div>
        <div style={{ color: PAL.chalk, fontSize: 12.5, lineHeight: 1.45, marginTop: 3 }}>{l.detail}</div>
      </div>
    </Html>
  )
}

export default function CrossFitModule() {
  const meta = moduleByKey('crossfit')
  const copy = MODULE_COPY.crossfit
  const [selected, setSelected] = useState(0)
  const [deficiency, setDeficiency] = useState<number[]>(HIERARCHY.map(() => 0))

  const worst = Math.max(...deficiency)
  const integrity = Math.round(100 * (1 - deficiency.reduce((a, d, i) => a + d * (1 - i / (N + 2)), 0) / 3))
  const anyDamage = worst > 0.02

  const controls = (
    <>
      <ControlHead>The pyramid</ControlHead>
      <Segmented
        options={HIERARCHY.map((l, i) => ({ value: String(i), label: l.label.split(' ')[0] }))}
        value={String(selected)}
        onChange={(v) => setSelected(Number(v))}
      />
      <Slider
        label={`Deficiency in ${HIERARCHY[selected].label.toLowerCase()}`}
        value={Math.round(deficiency[selected] * 100)}
        display={`${Math.round(deficiency[selected] * 100)}%`}
        min={0}
        max={100}
        dotColor={HIERARCHY[selected].color}
        onChange={(v) => setDeficiency((d) => d.map((x, i) => (i === selected ? v / 100 : x)))}
      />
      <Readout
        label="Stack integrity"
        value={`${clamp(integrity, 0, 100)}%`}
        color={integrity > 85 ? PAL.yellowGreen : integrity > 60 ? '#f4b740' : '#f43f5e'}
        sub={anyDamage ? 'the components above will suffer' : 'every layer carried by the one below'}
      />
      {anyDamage && (
        <button className="wf-btn" style={{ marginTop: 8 }} onClick={() => setDeficiency(HIERARCHY.map(() => 0))}>
          Repair the base
        </button>
      )}
    </>
  )

  const extra = (
    <>
      {/* The definition, three pillars */}
      <div className="grid md:grid-cols-3 gap-4 mt-5">
        {CF_PILLARS.map((p, i) => (
          <SectionCard key={p.key} className={`p-5 wf-rise wf-rise-${i + 1}`}>
            <div className="wf-condensed text-[12px] uppercase tracking-[0.2em] mb-2" style={{ color: PAL.yellowGreen }}>
              {p.label}
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] italic">"{p.quote}"</p>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-2">{p.cite}</div>
            <p className="text-[12.5px] leading-relaxed text-[var(--text-tertiary)] mt-2">{p.explain}</p>
          </SectionCard>
        ))}
      </div>

      {/* World-Class Fitness in 100 Words */}
      <SectionCard className="p-6 mt-4">
        <LessonHeading kicker="Figure 1, L1 Guide p. 17" title="World-Class Fitness in 100 Words" />
        <p className="text-[15px] leading-[1.9] text-[var(--text-secondary)]" style={{ fontFamily: 'Georgia, serif' }}>
          "{HUNDRED_WORDS}"
        </p>
        <div className="text-[12px] text-[var(--text-tertiary)] mt-3">
          Greg Glassman. The whole prescription: diet, the lifts, gymnastics, engine work, variance, intensity, and sport, in exactly one hundred words.
        </div>
      </SectionCard>

      {/* Scaling */}
      <SectionCard className="p-6 mt-4">
        <LessonHeading kicker="Scalability" title="By degree, not kind" />
        <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
          "{CF_SCALING.quote}" <span className="text-[var(--text-tertiary)]">({CF_SCALING.cite})</span>. The program is universal:
          "{CF_SCALING.rule}" The same squat serves a grandparent chasing functional competence and a Games athlete chasing
          functional dominance; only the load and the pace change.
        </p>
      </SectionCard>
    </>
  )

  return (
    <ModulePage moduleKey="crossfit" extra={extra}>
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={`${HIERARCHY_RULE} (L1 Guide p. 29)`}
        controls={controls}
        camera={{ position: [8.5, 3.4, 13.5], fov: 46 }}
        target={[0, 0.4, 0]}
        autoRotate
        autoRotateSpeed={0.5}
        minDistance={8}
        maxDistance={26}
        maxPolarAngle={Math.PI / 1.9}
        hint="Pick a level and dial in a deficiency. Watch what happens to everything above it."
      >
        <Pyramid deficiency={deficiency} selected={selected} />
        <LevelNote selected={selected} />
      </LessonStage>
    </ModulePage>
  )
}
