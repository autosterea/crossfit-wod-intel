import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  CF_PILLARS,
  CF_REPLACEMENTS,
  CF_FUNCTIONAL_QUOTES,
  CF_SCALING,
  FRAN_TABLE,
  HIERARCHY,
  HIERARCHY_RULE,
  HOPPER_TASKS,
  HUNDRED_WORDS,
  MODULE_COPY,
  PAL,
  VARIANCE_RUT,
  moduleByKey,
} from '../fitnessData'
import { clamp, lerp } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, ControlHead, Readout, Slider, Segmented, SectionCard, LessonHeading, PresetButtons } from '../ui'

/* =========================================================================
   Module 07 - What Is CrossFit? The prescription, part by part.

   REDESIGN (2026-07-16, owner direction): the stage now TEACHES the three
   hard-to-grasp parts of the definition, each with the L1 Guide's own
   teaching device, plus the development pyramid as a fourth mode:

   1. FUNCTIONAL MOVEMENT - the guide's contrast device (Foundations p. 6 +
      p. 14): a squat (multi-joint, long line, natural analog) against the
      leg extension it replaced (one joint, short arc, "no equivalent in
      nature").
   2. HIGH INTENSITY = POWER - the guide's worked Fran table (p. 35): work
      is constant, time shrinks 4:30 -> 2:45, power jumps 60%.
   3. CONSTANTLY VARIED - the stimulus-adaptation law (p. 2): a week of
      random tests vs the same test on repeat, and what happens to the
      breadth of adaptation.
   4. THE PYRAMID - Figure 5 (p. 29) with the interactive deficiency.

   Per-frame motion mutates refs in useFrame; React state holds targets.
   ========================================================================= */

type Vec2 = [number, number]
type JointName = 'ankle' | 'knee' | 'hip' | 'shoulder' | 'head' | 'elbow' | 'hand'
type Pose = Record<JointName, Vec2>

const P_STAND: Pose = { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.5], elbow: [0.04, 2.38], hand: [0.1, 1.82] }
const P_SQUAT: Pose = { ankle: [0, 0.12], knee: [0.6, 0.9], hip: [-0.58, 1.0], shoulder: [0.14, 2.1], head: [0.3, 2.58], elbow: [0.7, 1.98], hand: [1.1, 2.1] }
const P_THR_BOTTOM: Pose = { ankle: [0, 0.12], knee: [0.6, 0.9], hip: [-0.55, 1.02], shoulder: [0.02, 2.16], head: [0.14, 2.66], elbow: [0.58, 2.0], hand: [0.34, 2.3] }
const P_THR_OH: Pose = { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.52], elbow: [0.09, 3.64], hand: [0.11, 4.24] }
const P_SEAT_DOWN: Pose = { ankle: [0.5, 0.38], knee: [0.48, 1.18], hip: [0, 1.22], shoulder: [0, 2.4], head: [0.05, 2.86], elbow: [0.06, 1.98], hand: [0.16, 1.58] }
const P_SEAT_EXT: Pose = { ankle: [1.05, 1.1], knee: [0.48, 1.18], hip: [0, 1.22], shoulder: [0, 2.4], head: [0.05, 2.86], elbow: [0.06, 1.98], hand: [0.16, 1.58] }

const UP = new THREE.Vector3(0, 1, 0)
function setLimb(m: THREE.Mesh | null, a: THREE.Vector3, b: THREE.Vector3) {
  if (!m) return
  const dir = b.clone().sub(a)
  const len = Math.max(dir.length(), 0.001)
  m.position.copy(a).addScaledVector(dir, 0.5)
  m.quaternion.setFromUnitVectors(UP, dir.normalize())
  m.scale.set(1, len, 1)
}

/** Compact jointed figure cycling between two poses; optional bar/none prop. */
function Figure({ from, to, period, holdBar, paused = false, sloppy = 0 }: { from: Pose; to: Pose; period: number; holdBar?: 'hands' | 'none'; paused?: boolean; sloppy?: number }) {
  const limbs = useRef<Record<string, THREE.Mesh | null>>({})
  const joints = useRef<Record<string, THREE.Mesh | null>>({})
  const barRef = useRef<THREE.Group | null>(null)
  const t = useRef(0)
  const cur = useRef<Record<JointName, THREE.Vector2>>(
    Object.fromEntries((Object.keys(from) as JointName[]).map((j) => [j, new THREE.Vector2(...from[j])])) as Record<JointName, THREE.Vector2>,
  )

  useFrame((_, dt) => {
    if (!paused) t.current += dt / period
    const cyc = (Math.sin(t.current * Math.PI * 2 - Math.PI / 2) + 1) / 2 // 0..1..0 eased
    for (const j of Object.keys(from) as JointName[]) {
      let x = lerp(from[j][0], to[j][0], cyc)
      let y = lerp(from[j][1], to[j][1], cyc)
      if (sloppy > 0 && (j === 'shoulder' || j === 'head')) x += sloppy * 0.35 * cyc // torso pitches forward when sloppy
      if (sloppy > 0 && j === 'hip') y += sloppy * 0.25 * cyc // depth cut
      cur.current[j].set(x, y)
    }
    const p = cur.current
    const v = (j: JointName, z: number) => new THREE.Vector3(p[j].x, p[j].y, z)
    for (const side of [1, -1]) {
      const z = side * 0.18
      setLimb(limbs.current[`shin${side}`], v('ankle', z), v('knee', z))
      setLimb(limbs.current[`thigh${side}`], v('knee', z), v('hip', z * 0.7))
      const az = side * 0.24
      setLimb(limbs.current[`uarm${side}`], v('shoulder', az), v('elbow', az))
      setLimb(limbs.current[`farm${side}`], v('elbow', az), v('hand', az))
      joints.current[`knee${side}`]?.position.copy(v('knee', z))
      joints.current[`foot${side}`]?.position.set(p.ankle.x + 0.14, Math.max(p.ankle.y - 0.06, 0.06), z)
    }
    setLimb(limbs.current.torso, v('hip', 0), v('shoulder', 0))
    setLimb(limbs.current.neck, v('shoulder', 0), v('head', 0))
    joints.current.hip?.position.set(p.hip.x, p.hip.y, 0)
    joints.current.head?.position.set(p.head.x, p.head.y, 0)
    if (barRef.current) {
      barRef.current.visible = holdBar === 'hands'
      barRef.current.position.set(p.hand.x, p.hand.y, 0)
    }
  })

  const limbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9c6cc', roughness: 0.6 }), [])
  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PAL.seaGreen, roughness: 0.45, emissive: PAL.seaGreen, emissiveIntensity: 0.25 }), [])
  const limb = (key: string, r: number) => (
    <mesh key={key} ref={(m) => (limbs.current[key] = m)} material={limbMat} castShadow>
      <cylinderGeometry args={[r, r * 0.82, 1, 12]} />
    </mesh>
  )
  return (
    <group>
      {[1, -1].map((s) => (
        <group key={s}>
          {limb(`shin${s}`, 0.085)}
          {limb(`thigh${s}`, 0.105)}
          {limb(`uarm${s}`, 0.075)}
          {limb(`farm${s}`, 0.065)}
          <mesh ref={(m) => (joints.current[`knee${s}`] = m)} material={jointMat} castShadow>
            <sphereGeometry args={[0.1, 14, 14]} />
          </mesh>
          <mesh ref={(m) => (joints.current[`foot${s}`] = m)} material={limbMat} castShadow>
            <boxGeometry args={[0.4, 0.12, 0.16]} />
          </mesh>
        </group>
      ))}
      {limb('torso', 0.17)}
      {limb('neck', 0.07)}
      <mesh ref={(m) => (joints.current.hip = m)} material={jointMat} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
      </mesh>
      <mesh ref={(m) => (joints.current.head = m)} material={limbMat} castShadow>
        <sphereGeometry args={[0.24, 20, 20]} />
      </mesh>
      <group ref={barRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 2.2, 12]} />
          <meshStandardMaterial color="#cfd8dc" metalness={0.85} roughness={0.35} />
        </mesh>
        {[0.95, -0.95].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.09, 24]} />
            <meshStandardMaterial color="#10161a" roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ------------------------- Mode 1: functional -------------------------- */

function FunctionalScene({ functional }: { functional: boolean }) {
  return (
    <group position={[0, -1.6, 0]}>
      {functional ? (
        <Figure from={P_STAND} to={P_SQUAT} period={2.6} holdBar="none" />
      ) : (
        <group>
          {/* bench for the leg extension */}
          <mesh position={[-0.1, 0.62, 0]} castShadow>
            <boxGeometry args={[0.9, 0.16, 0.8]} />
            <meshStandardMaterial color="#22303a" roughness={0.8} />
          </mesh>
          <mesh position={[-0.1, 0.3, 0]}>
            <boxGeometry args={[0.16, 0.62, 0.6]} />
            <meshStandardMaterial color="#16202a" roughness={0.85} />
          </mesh>
          <Figure from={P_SEAT_DOWN} to={P_SEAT_EXT} period={2.2} holdBar="none" />
        </group>
      )}
      {/* the line of action: long for the squat, a stub for the leg extension */}
      <mesh position={functional ? [-0.28, 1.45, 0.45] : [0.78, 0.78, 0.45]} rotation={functional ? [0, 0, 0] : [0, 0, -0.9]}>
        <cylinderGeometry args={[0.02, 0.02, functional ? 1.9 : 0.75, 8]} />
        <meshStandardMaterial color={functional ? PAL.yellowGreen : '#f43f5e'} emissive={functional ? PAL.yellowGreen : '#f43f5e'} emissiveIntensity={0.7} transparent opacity={0.85} />
      </mesh>
      <Html position={[2.6, 2.6, 0]} center distanceFactor={11} occlude={false} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ width: 210, padding: '8px 11px', borderRadius: 10, background: 'rgba(7,10,14,0.93)', border: `1px solid ${functional ? PAL.yellowGreen : '#f43f5e'}`, fontFamily: '"Barlow Condensed", sans-serif', color: PAL.chalk, fontSize: 13.5, lineHeight: 1.35, textAlign: 'center' }}>
          {functional ? (
            <>
              <b style={{ color: PAL.yellowGreen }}>THE SQUAT - FUNCTIONAL</b>
              <div style={{ marginTop: 3 }}>Multi-joint. Core to extremity. A long line of real work: "standing from a seated position." (p. 14)</div>
            </>
          ) : (
            <>
              <b style={{ color: '#f43f5e' }}>LEG EXTENSION - NON-FUNCTIONAL</b>
              <div style={{ marginTop: 3 }}>One joint. A short arc. "No equivalent in nature." (p. 14)</div>
            </>
          )}
        </div>
      </Html>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={12} blur={2.2} far={5} />
    </group>
  )
}

/* ------------------------- Mode 2: intensity --------------------------- */

function IntensityScene({ timeSec }: { timeSec: number }) {
  // Fran pace: 45 thruster+pull-up pairs in timeSec -> thruster period scales with time
  const period = clamp((timeSec / 270) * 2.0, 0.85, 4.5)
  const power = FRAN_TABLE.totalWorkFtLb / (timeSec / 60)
  const aprilPower = FRAN_TABLE.attempts[0].powerFtLbMin
  const barH = clamp((power / 20000) * 3.4, 0.3, 4.4)
  const workH = 2.2
  return (
    <group position={[0, -1.6, 0]}>
      <Figure from={P_THR_BOTTOM} to={P_THR_OH} period={period} holdBar="hands" />
      {/* constant WORK block (label below, so it never collides with the power label) */}
      <group position={[2.8, 0, 0]}>
        <mesh position={[0, workH / 2, 0]}>
          <boxGeometry args={[0.85, workH, 0.85]} />
          <meshStandardMaterial color="#22303a" roughness={0.75} />
        </mesh>
        <Html position={[0, -0.55, 0.5]} center distanceFactor={12} occlude={false} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: '"Barlow Condensed", sans-serif', color: PAL.muted, fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap' }}>
            WORK (constant)<br />
            <b style={{ color: PAL.chalk }}>{FRAN_TABLE.totalWorkFtLb.toLocaleString()} ft-lb</b>
          </div>
        </Html>
      </group>
      {/* POWER bar = work / time */}
      <group position={[4.2, 0, 0]}>
        <mesh position={[0, barH / 2, 0]}>
          <boxGeometry args={[0.85, barH, 0.85]} />
          <meshStandardMaterial color={PAL.yellowGreen} emissive={PAL.yellowGreen} emissiveIntensity={0.35} roughness={0.5} />
        </mesh>
        <Html position={[0, barH + 0.45, 0]} center distanceFactor={12} occlude={false} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: '"Barlow Condensed", sans-serif', color: PAL.muted, fontSize: 13, textAlign: 'center', whiteSpace: 'nowrap' }}>
            POWER = work / time<br />
            <b style={{ color: PAL.yellowGreen }}>{Math.round(power).toLocaleString()} ft-lb/min</b>
            <br />
            <span style={{ color: power > aprilPower * 1.01 ? PAL.yellowGreen : PAL.muted }}>
              {power > aprilPower * 1.01 ? `+${Math.round((power / aprilPower - 1) * 100)}% vs April` : 'the April baseline'}
            </span>
          </div>
        </Html>
      </group>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={14} blur={2.2} far={5} />
    </group>
  )
}

/* ------------------------- Mode 3: variance ---------------------------- */

function chipTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const x = c.getContext('2d')!
  x.fillStyle = 'rgba(10,14,18,0.95)'
  x.fillRect(0, 0, 256, 128)
  x.strokeStyle = color
  x.lineWidth = 5
  x.strokeRect(4, 4, 248, 120)
  x.fillStyle = '#eef3f6'
  x.textAlign = 'center'
  x.font = '600 34px Barlow Condensed, Arial Narrow, sans-serif'
  x.fillText(text.toUpperCase(), 128, 76)
  const t = new THREE.CanvasTexture(c)
  return t
}

function VarianceScene({ varied, week }: { varied: boolean; week: number }) {
  // deterministic pseudo-random week from the week counter (no Math.random in render)
  const tasks = useMemo(() => {
    const out: string[] = []
    for (let d = 0; d < 7; d++) {
      if (!varied) out.push(HOPPER_TASKS[0])
      else out.push(HOPPER_TASKS[(week * 3 + d * 5 + ((week + d) % 3)) % HOPPER_TASKS.length])
    }
    return out
  }, [varied, week])
  const textures = useMemo(() => tasks.map((t, i) => chipTexture(t, varied ? [PAL.yellowGreen, PAL.monostructural, PAL.gymnastics, PAL.weightlifting, PAL.glycolytic][i % 5] : '#f43f5e')), [tasks, varied])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])
  const bandRef = useRef<THREE.Mesh | null>(null)
  useFrame((_, dt) => {
    if (!bandRef.current) return
    const target = varied ? 7.6 : 1.3
    bandRef.current.scale.x = lerp(bandRef.current.scale.x, target, clamp(dt * 4, 0, 1))
  })
  return (
    <group position={[0, -1.4, 0]}>
      {tasks.map((_, i) => (
        <group key={i} position={[(i - 3) * 1.35, 0, 0]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[1.05, 0.7, 1.05]} />
            <meshStandardMaterial color="#16202a" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <planeGeometry args={[1.15, 0.575]} />
            <meshBasicMaterial map={textures[i]} transparent />
          </mesh>
          <Html position={[0, -0.35, 0.6]} center distanceFactor={16} occlude={false} style={{ pointerEvents: 'none' }}>
            <div style={{ fontFamily: '"Barlow Condensed", sans-serif', color: PAL.muted, fontSize: 12 }}>DAY {i + 1}</div>
          </Html>
        </group>
      ))}
      {/* the adaptation band: wide when varied, a sliver when routine */}
      <mesh ref={bandRef} position={[0, 2.6, 0]} scale={[7.6, 1, 1]}>
        <boxGeometry args={[1, 0.34, 0.2]} />
        <meshStandardMaterial color={PAL.yellowGreen} emissive={PAL.yellowGreen} emissiveIntensity={0.4} transparent opacity={0.85} />
      </mesh>
      <Html position={[0, 3.25, 0]} center distanceFactor={13} occlude={false} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: '"Barlow Condensed", sans-serif', color: PAL.chalk, fontSize: 14, textAlign: 'center', whiteSpace: 'nowrap' }}>
          BREADTH OF ADAPTATION
          <div style={{ color: varied ? PAL.yellowGreen : '#f43f5e', fontSize: 12.5 }}>
            {varied ? 'broad stimulus, broad adaptation' : 'the rut: "weakest at the margins of exposure"'}
          </div>
        </div>
      </Html>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={16} blur={2.4} far={4} />
    </group>
  )
}

/* ------------------------- Mode 4: the pyramid ------------------------- */

const N = HIERARCHY.length
const SLAB_H = 1.06
const GAP = 0.16
const WIDTHS = [9.2, 7.6, 6.1, 4.6, 3.1]
const DEPTHS = [6.4, 5.4, 4.4, 3.4, 2.4]

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
  const eff = useRef<number[]>(HIERARCHY.map(() => 0))
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
    let y = 0
    for (let i = 0; i < N; i++) {
      const s = slabs.current[i]
      if (!s.group || !s.mat || !s.mesh) continue
      const d = eff.current[i]
      let below = 0
      for (let j = 0; j < i; j++) below = Math.max(below, eff.current[j])
      const scaleY = 1 - 0.52 * d
      const h = SLAB_H * scaleY
      s.group.position.y = y + h / 2
      y += h + GAP * (1 - 0.4 * Math.max(d, below))
      const wobble = Math.sin(pulse.current * 1.7 + i * 2.1) * 0.012
      s.group.rotation.z = d * 0.05 * (i % 2 ? -1 : 1) + below * 0.11 * (i % 2 ? 1 : -1) + wobble * below
      s.group.rotation.x = below * 0.05
      s.group.position.x = below * 0.5 * (i % 2 ? -1 : 1) * (i / N)
      s.mesh.scale.y = scaleY
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
            <meshStandardMaterial ref={(m) => (slabs.current[i].mat = m)} color={l.color} metalness={0.15} roughness={0.55} emissive={l.color} emissiveIntensity={1} />
          </mesh>
          <mesh position={[0, 0, DEPTHS[i] / 2 + 0.012]}>
            <planeGeometry args={[Math.min(WIDTHS[i] * 0.94, 6.8), Math.min(WIDTHS[i] * 0.94, 6.8) * 0.219]} />
            <meshBasicMaterial ref={(m) => (slabs.current[i].labelMat = m)} map={labels[i]} transparent depthWrite={false} />
          </mesh>
        </group>
      ))}
      <ContactShadows position={[0, -0.02, 0]} opacity={0.55} scale={26} blur={2.4} far={9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <circleGeometry args={[13, 48]} />
        <meshStandardMaterial color="#0b1013" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  )
}

/* ------------------------------ the module ----------------------------- */

type Mode = 'functional' | 'intensity' | 'varied' | 'pyramid'

const MODE_BODY: Record<Mode, string> = {
  functional: `${CF_FUNCTIONAL_QUOTES.natural} (${CF_FUNCTIONAL_QUOTES.naturalCite}) - against the machine it replaced: "${CF_FUNCTIONAL_QUOTES.nonFunctional}"`,
  intensity: `The guide's own worked example (Table 1, p. 35): ${FRAN_TABLE.athlete}. ${FRAN_TABLE.cancel} Shrink the time and the same work becomes more power - "${FRAN_TABLE.formula}"`,
  varied: `${VARIANCE_RUT.law} (${VARIANCE_RUT.lawCite}). Flip to routine and watch the adaptation band collapse to the rut.`,
  pyramid: `${HIERARCHY_RULE} (L1 Guide p. 29)`,
}

export default function CrossFitModule() {
  const meta = moduleByKey('crossfit')
  const copy = MODULE_COPY.crossfit
  const [mode, setMode] = useState<Mode>('functional')
  const [functional, setFunctional] = useState(true)
  const [timeSec, setTimeSec] = useState(270)
  const [varied, setVaried] = useState(true)
  const [week, setWeek] = useState(1)
  const [selected, setSelected] = useState(0)
  const [deficiency, setDeficiency] = useState<number[]>(HIERARCHY.map(() => 0))

  const integrity = Math.round(100 * (1 - deficiency.reduce((a, d, i) => a + d * (1 - i / (N + 2)), 0) / 3))
  const power = FRAN_TABLE.totalWorkFtLb / (timeSec / 60)

  const controls = (
    <>
      <ControlHead>The prescription, part by part</ControlHead>
      <Segmented
        options={[
          { value: 'functional', label: 'Functional' },
          { value: 'intensity', label: 'Intensity' },
          { value: 'varied', label: 'Varied' },
          { value: 'pyramid', label: 'Pyramid' },
        ]}
        value={mode}
        onChange={(m) => setMode(m as Mode)}
      />
      {mode === 'functional' && (
        <>
          <Segmented
            options={[
              { value: 'fn', label: 'Squat (functional)' },
              { value: 'nf', label: 'Leg extension' },
            ]}
            value={functional ? 'fn' : 'nf'}
            onChange={(v) => setFunctional(v === 'fn')}
          />
          <Readout
            label={functional ? 'Multi-joint, core to extremity' : 'One joint, no natural analog'}
            value={functional ? 'Functional' : 'Non-functional'}
            color={functional ? PAL.yellowGreen : '#f43f5e'}
            sub={functional ? 'moves a large load a long distance, quickly' : '"relatively worthless" - works one joint at a time (p. 28)'}
          />
          <div className="text-[11.5px] text-[var(--text-muted)] mt-2">
            The guide's replacements (p. 6): {CF_REPLACEMENTS.map((r) => `${r.out.toLowerCase()} -> ${r.in_.toLowerCase()}`).join(' · ')}
          </div>
        </>
      )}
      {mode === 'intensity' && (
        <>
          <PresetButtons
            options={['April 2015: 4:30', 'May 2016: 2:45']}
            value={timeSec === 270 ? 'April 2015: 4:30' : timeSec === 165 ? 'May 2016: 2:45' : ''}
            onChange={(v) => setTimeSec(v.includes('4:30') ? 270 : 165)}
          />
          <Slider
            label="Fran time"
            value={timeSec}
            display={`${Math.floor(timeSec / 60)}:${String(timeSec % 60).padStart(2, '0')}`}
            min={150}
            max={480}
            step={15}
            dotColor={PAL.yellowGreen}
            onChange={setTimeSec}
          />
          <Readout label="Power (work / time)" value={`${Math.round(power).toLocaleString()} ft-lb/min`} color={PAL.yellowGreen} sub='"Intensity is defined exactly as power." (p. 2)' />
        </>
      )}
      {mode === 'varied' && (
        <>
          <Segmented
            options={[
              { value: 'varied', label: 'Constantly varied' },
              { value: 'routine', label: 'Routine' },
            ]}
            value={varied ? 'varied' : 'routine'}
            onChange={(v) => setVaried(v === 'varied')}
          />
          {varied && (
            <button className="wf-btn" style={{ marginTop: 8 }} onClick={() => setWeek((w) => w + 1)}>
              Draw a new week from the hopper
            </button>
          )}
          <Readout
            label="Breadth of adaptation"
            value={varied ? 'Broad' : 'A rut'}
            color={varied ? PAL.yellowGreen : '#f43f5e'}
            sub={varied ? 'stimulus spans loads, time domains, and skills' : '"Routine is the enemy." (p. 17)'}
          />
        </>
      )}
      {mode === 'pyramid' && (
        <>
          <Segmented options={HIERARCHY.map((l, i) => ({ value: String(i), label: l.label.split(' ')[0] }))} value={String(selected)} onChange={(v) => setSelected(Number(v))} />
          <Slider
            label={`Deficiency in ${HIERARCHY[selected].label.toLowerCase()}`}
            value={Math.round(deficiency[selected] * 100)}
            display={`${Math.round(deficiency[selected] * 100)}%`}
            min={0}
            max={100}
            dotColor={HIERARCHY[selected].color}
            onChange={(v) => setDeficiency((d) => d.map((x, i) => (i === selected ? v / 100 : x)))}
          />
          <Readout label="Stack integrity" value={`${clamp(integrity, 0, 100)}%`} color={integrity > 85 ? PAL.yellowGreen : integrity > 60 ? '#f4b740' : '#f43f5e'} sub={integrity < 98 ? 'the components above will suffer' : 'every layer carried by the one below'} />
          {integrity < 98 && (
            <button className="wf-btn" style={{ marginTop: 8 }} onClick={() => setDeficiency(HIERARCHY.map(() => 0))}>
              Repair the base
            </button>
          )}
        </>
      )}
    </>
  )

  const extra = (
    <>
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
      <SectionCard className="p-6 mt-4">
        <LessonHeading kicker="Figure 1, L1 Guide p. 17" title="World-Class Fitness in 100 Words" />
        <p className="text-[15px] leading-[1.9] text-[var(--text-secondary)]" style={{ fontFamily: 'Georgia, serif' }}>
          "{HUNDRED_WORDS}"
        </p>
        <div className="text-[12px] text-[var(--text-tertiary)] mt-3">
          Greg Glassman. The whole prescription: diet, the lifts, gymnastics, engine work, variance, intensity, and sport, in exactly one hundred words.
        </div>
      </SectionCard>
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

  // Scenes are scale-normalized so one live camera serves all four modes; only
  // the orbit target moves per mode (drei updates it without a remount, which
  // keeps the controls panel open while the learner switches concepts).
  const TARGETS: Record<Mode, [number, number, number]> = {
    functional: [0.8, 0.5, 0],
    intensity: [2.0, 0.6, 0],
    varied: [0, 0.9, 0],
    pyramid: [0, 0.3, 0],
  }

  return (
    <ModulePage moduleKey="crossfit" extra={extra}>
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={MODE_BODY[mode]}
        controls={controls}
        camera={{ position: [5.2, 2.3, 9.6], fov: 46 }}
        target={TARGETS[mode]}
        autoRotate={mode === 'pyramid'}
        autoRotateSpeed={0.5}
        minDistance={5}
        maxDistance={26}
        maxPolarAngle={Math.PI / 1.9}
        hint={
          mode === 'functional'
            ? 'Flip between the squat and the machine it replaced.'
            : mode === 'intensity'
              ? 'Same workout, same work. Shrink the time and watch power - intensity - grow.'
              : mode === 'varied'
                ? 'A training week drawn from the hopper vs the same workout on repeat.'
                : 'Pick a level and dial in a deficiency. Watch what happens above it.'
        }
      >
        {mode === 'functional' && <FunctionalScene functional={functional} />}
        {mode === 'intensity' && <IntensityScene timeSec={timeSec} />}
        {mode === 'varied' && <VarianceScene varied={varied} week={week} />}
        {mode === 'pyramid' && (
          <group scale={[0.62, 0.62, 0.62]} position={[0, 0.55, 0]}>
            <Pyramid deficiency={deficiency} selected={selected} />
          </group>
        )}
      </LessonStage>
    </ModulePage>
  )
}
