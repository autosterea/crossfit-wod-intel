import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  CHARTER,
  MCI_CONSISTENCY_QUESTIONS,
  MCI_ENFORCE,
  MCI_SKIP_PENALTY,
  MODULE_COPY,
  MOVEMENTS,
  PAL,
  SEE,
  SEE_VECTORS,
  THRESHOLD,
  moduleByKey,
  type Foundational,
} from '../fitnessData'
import { clamp, lerp } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, ControlHead, Readout, Slider, Segmented, SectionCard, LessonHeading, Bar } from '../ui'

/* =========================================================================
   Module 08 - Technique: mechanics, consistency, then intensity.

   REDESIGN (2026-07-16, owner direction): the stage now teaches the
   CONCEPTS of the Technique essay (L1 Guide pp. 40-44), not just movements:

   1. THRESHOLD TRAINING (default) - the essay's own worked example in its
      exact units: perfect technique at 10,000 ft-lb/min, form falls apart
      at 12,000; train in that band, advance the margin, chase 14,000. An
      intensity dial degrades the athlete's form live past the threshold,
      and "drill at this speed" advances the frontier.
   2. THE CHARTER - mechanics -> consistency -> intensity as a staircase on
      a development timeline, with the "skip straight to intensity" penalty.
   3. THE NINE MOVEMENTS - the L1 movement library with joint-anchored
      points of performance (kept from v1).

   Safety / efficacy / efficiency (p. 40) ride along in the threshold mode
   as live vectors, since the charter exists to balance exactly those three.
   ========================================================================= */

type JointName = 'ankle' | 'knee' | 'hip' | 'shoulder' | 'head' | 'elbow' | 'hand'
type Pose = Record<JointName, [number, number]>

const POSES: Record<string, Pose> = {
  stand: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.5], elbow: [0.04, 2.38], hand: [0.1, 1.82] },
  standBar: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.5], elbow: [0.1, 2.4], hand: [0.16, 1.86] },
  standRack: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.5], elbow: [0.62, 2.82], hand: [0.34, 3.06] },
  standOverhead: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.5], elbow: [0.08, 3.62], hand: [0.1, 4.22] },
  airBottom: { ankle: [0, 0.12], knee: [0.6, 0.9], hip: [-0.58, 1.0], shoulder: [0.14, 2.1], head: [0.3, 2.58], elbow: [0.7, 1.98], hand: [1.1, 2.1] },
  frontBottom: { ankle: [0, 0.12], knee: [0.6, 0.9], hip: [-0.55, 1.02], shoulder: [0.02, 2.16], head: [0.14, 2.66], elbow: [0.58, 2.0], hand: [0.34, 2.3] },
  ohsBottom: { ankle: [0, 0.12], knee: [0.6, 0.9], hip: [-0.55, 1.02], shoulder: [0.04, 2.2], head: [0.14, 2.7], elbow: [0.1, 2.86], hand: [0.14, 3.48] },
  pressSetup: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.5], elbow: [0.24, 2.62], hand: [0.2, 3.08] },
  pressLockout: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.52], elbow: [0.09, 3.64], hand: [0.11, 4.24] },
  dip: { ankle: [0, 0.12], knee: [0.18, 0.88], hip: [-0.1, 1.58], shoulder: [-0.02, 2.74], head: [0.04, 3.24], elbow: [0.22, 2.4], hand: [0.18, 2.84] },
  drive: { ankle: [0, 0.2], knee: [0.04, 1.0], hip: [0, 1.9], shoulder: [0, 3.06], head: [0.06, 3.56], elbow: [0.26, 3.06], hand: [0.2, 3.5] },
  jerkReceive: { ankle: [0, 0.12], knee: [0.34, 0.92], hip: [-0.32, 1.32], shoulder: [0.0, 2.46], head: [0.08, 2.94], elbow: [0.07, 3.06], hand: [0.1, 3.66] },
  dlSetup: { ankle: [0, 0.12], knee: [0.28, 0.92], hip: [-0.52, 1.38], shoulder: [0.34, 2.26], head: [0.52, 2.68], elbow: [0.34, 1.62], hand: [0.36, 1.0] },
  dlKnee: { ankle: [0, 0.12], knee: [0.14, 0.94], hip: [-0.36, 1.62], shoulder: [0.26, 2.56], head: [0.42, 3.0], elbow: [0.3, 1.9], hand: [0.32, 1.3] },
  dlTop: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.5], elbow: [0.1, 2.4], hand: [0.16, 1.86] },
  sdhpSetup: { ankle: [0, 0.12], knee: [0.3, 0.9], hip: [-0.5, 1.32], shoulder: [0.32, 2.22], head: [0.5, 2.64], elbow: [0.3, 1.6], hand: [0.3, 0.98] },
  sdhpTall: { ankle: [0, 0.16], knee: [0.04, 1.0], hip: [0, 1.88], shoulder: [0, 3.04], head: [0.06, 3.54], elbow: [0.14, 2.5], hand: [0.18, 2.0] },
  sdhpPull: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.02], head: [0.06, 3.52], elbow: [0.52, 3.04], hand: [0.2, 3.12] },
  mbcSetup: { ankle: [0, 0.12], knee: [0.5, 0.86], hip: [-0.5, 1.06], shoulder: [0.26, 2.0], head: [0.42, 2.44], elbow: [0.3, 1.3], hand: [0.24, 0.66] },
  mbcTall: { ankle: [0, 0.18], knee: [0.04, 1.0], hip: [0, 1.9], shoulder: [0, 3.06], head: [0.06, 3.56], elbow: [0.16, 2.5], hand: [0.2, 2.02] },
  mbcReceive: { ankle: [0, 0.12], knee: [0.58, 0.9], hip: [-0.54, 1.04], shoulder: [0.04, 2.16], head: [0.14, 2.64], elbow: [0.56, 2.02], hand: [0.32, 2.28] },
  mbcRack: { ankle: [0, 0.12], knee: [0.04, 0.98], hip: [0, 1.85], shoulder: [0, 3.0], head: [0.06, 3.5], elbow: [0.6, 2.8], hand: [0.34, 3.04] },
}

type Implement = 'none' | 'bar' | 'ball'
interface Cue {
  text: string
  joint: JointName
  dy?: number
  dx?: number
}
interface MoveSpec {
  implement: Implement
  seq: { pose: string; t: number; hold?: number }[]
  cues: Cue[]
}

const SPECS: Record<string, MoveSpec> = {
  'air-squat': {
    implement: 'none',
    seq: [
      { pose: 'stand', t: 0, hold: 0.5 },
      { pose: 'airBottom', t: 1.1, hold: 0.45 },
      { pose: 'stand', t: 1.1, hold: 0.6 },
    ],
    cues: [
      { text: 'Hips descend back and down, below the knees', joint: 'hip', dx: -1.3 },
      { text: 'Lumbar curve maintained', joint: 'shoulder', dx: -1.2, dy: -0.3 },
      { text: 'Knees in line with toes', joint: 'knee', dx: 1.15 },
      { text: 'Heels down', joint: 'ankle', dx: -1.1 },
    ],
  },
  'front-squat': {
    implement: 'bar',
    seq: [
      { pose: 'standRack', t: 0, hold: 0.5 },
      { pose: 'frontBottom', t: 1.15, hold: 0.45 },
      { pose: 'standRack', t: 1.15, hold: 0.6 },
    ],
    cues: [
      { text: 'Elbows high, loose fingertip grip', joint: 'elbow', dx: 1.25 },
      { text: 'Bar rides the front rack, torso upright', joint: 'hand', dy: 0.55 },
      { text: 'All air squat points carry over', joint: 'hip', dx: -1.35 },
    ],
  },
  'overhead-squat': {
    implement: 'bar',
    seq: [
      { pose: 'standOverhead', t: 0, hold: 0.5 },
      { pose: 'ohsBottom', t: 1.25, hold: 0.45 },
      { pose: 'standOverhead', t: 1.25, hold: 0.6 },
    ],
    cues: [
      { text: 'Shoulders push up into the bar, armpits forward', joint: 'hand', dy: 0.55 },
      { text: 'Wide grip, arms extended', joint: 'elbow', dx: 1.2 },
      { text: 'Bar moves over the middle of the foot', joint: 'ankle', dx: -1.2, dy: 0.3 },
    ],
  },
  'shoulder-press': {
    implement: 'bar',
    seq: [
      { pose: 'pressSetup', t: 0, hold: 0.5 },
      { pose: 'pressLockout', t: 0.95, hold: 0.5 },
      { pose: 'pressSetup', t: 0.95, hold: 0.55 },
    ],
    cues: [
      { text: 'Spine neutral, legs extended: arms only', joint: 'hip', dx: -1.25 },
      { text: 'Bar moves over the middle of the foot', joint: 'head', dx: 1.3, dy: 0.2 },
      { text: 'Complete at full arm extension', joint: 'hand', dy: 0.55 },
    ],
  },
  'push-press': {
    implement: 'bar',
    seq: [
      { pose: 'pressSetup', t: 0, hold: 0.45 },
      { pose: 'dip', t: 0.6 },
      { pose: 'drive', t: 0.3 },
      { pose: 'pressLockout', t: 0.35, hold: 0.5 },
      { pose: 'pressSetup', t: 0.9, hold: 0.5 },
    ],
    cues: [
      { text: 'Torso vertical in the dip', joint: 'shoulder', dx: -1.3 },
      { text: 'Hips and legs extend, THEN arms press', joint: 'hip', dx: -1.3, dy: -0.25 },
      { text: 'Heels down until hips and knees extend', joint: 'ankle', dx: -1.15 },
    ],
  },
  'push-jerk': {
    implement: 'bar',
    seq: [
      { pose: 'pressSetup', t: 0, hold: 0.45 },
      { pose: 'dip', t: 0.6 },
      { pose: 'drive', t: 0.28 },
      { pose: 'jerkReceive', t: 0.3, hold: 0.4 },
      { pose: 'pressLockout', t: 0.8, hold: 0.5 },
      { pose: 'pressSetup', t: 0.9, hold: 0.5 },
    ],
    cues: [
      { text: 'Hips extend rapidly, then press UNDER the bar', joint: 'hip', dx: -1.35 },
      { text: 'Receive in a partial overhead squat', joint: 'knee', dx: 1.2 },
      { text: 'Finish at full hip, knee and arm extension', joint: 'hand', dy: 0.55 },
    ],
  },
  deadlift: {
    implement: 'bar',
    seq: [
      { pose: 'dlSetup', t: 0, hold: 0.55 },
      { pose: 'dlKnee', t: 0.8 },
      { pose: 'dlTop', t: 0.7, hold: 0.5 },
      { pose: 'dlKnee', t: 0.7 },
      { pose: 'dlSetup', t: 0.8, hold: 0.5 },
    ],
    cues: [
      { text: 'Lumbar curve maintained', joint: 'shoulder', dx: -1.35, dy: -0.2 },
      { text: 'Hips and shoulders rise at the same rate', joint: 'hip', dx: -1.35 },
      { text: 'Bar in contact with the shins, over midfoot', joint: 'hand', dx: 1.2, dy: -0.3 },
      { text: 'Eyes on the horizon', joint: 'head', dx: 1.2 },
    ],
  },
  sdhp: {
    implement: 'bar',
    seq: [
      { pose: 'sdhpSetup', t: 0, hold: 0.5 },
      { pose: 'sdhpTall', t: 0.55 },
      { pose: 'sdhpPull', t: 0.35, hold: 0.4 },
      { pose: 'sdhpTall', t: 0.45 },
      { pose: 'sdhpSetup', t: 0.7, hold: 0.5 },
    ],
    cues: [
      { text: 'Hips extend rapidly FIRST', joint: 'hip', dx: -1.35 },
      { text: 'Shoulders shrug, then the arms pull', joint: 'shoulder', dx: -1.3, dy: 0.25 },
      { text: 'Elbows move high and outside', joint: 'elbow', dx: 1.25 },
    ],
  },
  'mb-clean': {
    implement: 'ball',
    seq: [
      { pose: 'mbcSetup', t: 0, hold: 0.5 },
      { pose: 'mbcTall', t: 0.5 },
      { pose: 'mbcReceive', t: 0.45, hold: 0.4 },
      { pose: 'mbcRack', t: 0.85, hold: 0.55 },
      { pose: 'mbcSetup', t: 1.0, hold: 0.45 },
    ],
    cues: [
      { text: 'Hips extend rapidly, shoulders then shrug', joint: 'hip', dx: -1.35 },
      { text: 'Arms pull UNDER to the bottom of the squat', joint: 'elbow', dx: 1.25 },
      { text: 'Ball stays close to the body', joint: 'hand', dx: 1.15, dy: -0.3 },
    ],
  },
}

const UP = new THREE.Vector3(0, 1, 0)
function setLimb(m: THREE.Mesh | null, a: THREE.Vector3, b: THREE.Vector3) {
  if (!m) return
  const dir = b.clone().sub(a)
  const len = Math.max(dir.length(), 0.001)
  m.position.copy(a).addScaledVector(dir, 0.5)
  m.quaternion.setFromUnitVectors(UP, dir.normalize())
  m.scale.set(1, len, 1)
}

/** Shared skeleton renderer: given current joint vectors, writes all meshes. */
function useSkeleton() {
  const limbs = useRef<Record<string, THREE.Mesh | null>>({})
  const joints = useRef<Record<string, THREE.Mesh | null>>({})
  const barRef = useRef<THREE.Group | null>(null)
  const ballRef = useRef<THREE.Mesh | null>(null)

  const write = (p: Record<JointName, THREE.Vector2>, implement: Implement) => {
    const v = (j: JointName, z: number) => new THREE.Vector3(p[j].x, p[j].y, z)
    for (const side of [1, -1]) {
      const z = side * 0.18
      setLimb(limbs.current[`shin${side}`], v('ankle', z), v('knee', z))
      setLimb(limbs.current[`thigh${side}`], v('knee', z), v('hip', z * 0.7))
      const az = side * 0.24
      setLimb(limbs.current[`uarm${side}`], v('shoulder', az), v('elbow', az))
      setLimb(limbs.current[`farm${side}`], v('elbow', az), v('hand', az))
      joints.current[`knee${side}`]?.position.copy(v('knee', z))
      joints.current[`elbow${side}`]?.position.copy(v('elbow', az))
      joints.current[`foot${side}`]?.position.set(p.ankle.x + 0.16, 0.07, z)
    }
    setLimb(limbs.current.torso, v('hip', 0), v('shoulder', 0))
    setLimb(limbs.current.neck, v('shoulder', 0), v('head', 0))
    joints.current.hip?.position.set(p.hip.x, p.hip.y, 0)
    joints.current.shoulder?.position.set(p.shoulder.x, p.shoulder.y, 0)
    joints.current.head?.position.set(p.head.x, p.head.y, 0)
    if (barRef.current) {
      barRef.current.visible = implement === 'bar'
      barRef.current.position.set(p.hand.x, p.hand.y, 0)
    }
    if (ballRef.current) {
      ballRef.current.visible = implement === 'ball'
      ballRef.current.position.set(p.hand.x + 0.12, p.hand.y, 0)
    }
  }

  const limbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9c6cc', roughness: 0.6, metalness: 0.05 }), [])
  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PAL.seaGreen, roughness: 0.45, metalness: 0.1, emissive: PAL.seaGreen, emissiveIntensity: 0.25 }), [])

  const limb = (key: string, r: number) => (
    <mesh key={key} ref={(m) => (limbs.current[key] = m)} material={limbMat} castShadow>
      <cylinderGeometry args={[r, r * 0.82, 1, 12]} />
    </mesh>
  )
  const joint = (key: string, r: number) => (
    <mesh key={key} ref={(m) => (joints.current[key] = m)} material={jointMat} castShadow>
      <sphereGeometry args={[r, 16, 16]} />
    </mesh>
  )

  const body = (
    <group>
      {[1, -1].map((s) => (
        <group key={s}>
          {limb(`shin${s}`, 0.085)}
          {limb(`thigh${s}`, 0.105)}
          {limb(`uarm${s}`, 0.075)}
          {limb(`farm${s}`, 0.065)}
          {joint(`knee${s}`, 0.1)}
          {joint(`elbow${s}`, 0.085)}
          <mesh ref={(m) => (joints.current[`foot${s}`] = m)} material={limbMat} castShadow>
            <boxGeometry args={[0.42, 0.13, 0.16]} />
          </mesh>
        </group>
      ))}
      {limb('torso', 0.17)}
      {limb('neck', 0.07)}
      {joint('hip', 0.15)}
      {joint('shoulder', 0.14)}
      <mesh ref={(m) => (joints.current.head = m)} material={limbMat} castShadow>
        <sphereGeometry args={[0.24, 20, 20]} />
      </mesh>
      <group ref={barRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 2.4, 12]} />
          <meshStandardMaterial color="#cfd8dc" metalness={0.85} roughness={0.35} />
        </mesh>
        {[1.05, -1.05].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.09, 24]} />
            <meshStandardMaterial color="#10161a" roughness={0.7} metalness={0.2} />
          </mesh>
        ))}
      </group>
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.3, 20, 20]} />
        <meshStandardMaterial color={PAL.oddObject} roughness={0.8} metalness={0} />
      </mesh>
    </group>
  )
  return { write, body }
}

/* --------------------- Mode: the movement library ----------------------- */

function Athlete({ moveKey, speed, playing }: { moveKey: string; speed: number; playing: boolean }) {
  const spec = SPECS[moveKey]
  const { write, body } = useSkeleton()
  const cur = useRef<Record<JointName, THREE.Vector2>>(
    Object.fromEntries((Object.keys(POSES.stand) as JointName[]).map((j) => [j, new THREE.Vector2(...POSES[spec.seq[0].pose][j])])) as Record<JointName, THREE.Vector2>,
  )
  const seg = useRef(1)
  const t = useRef(0)
  const holdLeft = useRef(spec.seq[0].hold ?? 0)
  const lastMove = useRef(moveKey)

  useFrame((_, dt) => {
    if (lastMove.current !== moveKey) {
      lastMove.current = moveKey
      seg.current = 1
      t.current = 0
      holdLeft.current = spec.seq[0].hold ?? 0
      const start = POSES[spec.seq[0].pose]
      for (const j of Object.keys(start) as JointName[]) cur.current[j].set(...start[j])
    }
    if (playing) {
      if (holdLeft.current > 0) holdLeft.current -= dt * speed
      else {
        const target = spec.seq[seg.current]
        t.current += (dt * speed) / Math.max(target.t, 0.12)
        if (t.current >= 1) {
          t.current = 0
          holdLeft.current = target.hold ?? 0
          seg.current = (seg.current + 1) % spec.seq.length
          if (seg.current === 0) seg.current = 1
          const snapped = POSES[target.pose]
          for (const j of Object.keys(snapped) as JointName[]) cur.current[j].set(...snapped[j])
        } else {
          const from = POSES[spec.seq[(seg.current - 1 + spec.seq.length) % spec.seq.length].pose]
          const to = POSES[spec.seq[seg.current].pose]
          const e = t.current * t.current * (3 - 2 * t.current)
          for (const j of Object.keys(to) as JointName[]) cur.current[j].set(lerp(from[j][0], to[j][0], e), lerp(from[j][1], to[j][1], e))
        }
      }
    }
    write(cur.current, spec.implement)
  })
  return body
}

function Cues({ moveKey, show }: { moveKey: string; show: boolean }) {
  if (!show) return null
  const spec = SPECS[moveKey]
  const anchorPose = POSES[spec.seq[1].pose]
  return (
    <>
      {spec.cues.map((c, i) => {
        const [jx, jy] = anchorPose[c.joint]
        const side = c.dx && c.dx < 0 ? -1 : 1
        const x = jx + side * Math.max(Math.abs(c.dx ?? 1.2), 1.55)
        const y = jy + (c.dy ?? 0) + 0.3 - i * 0.14
        return (
          <Html key={`${moveKey}-${i}`} position={[x, y, 0]} center distanceFactor={10} occlude={false} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{ width: 168, padding: '6px 10px', borderRadius: 9, background: 'rgba(7,10,14,0.93)', border: `1px solid ${PAL.weightlifting}`, boxShadow: '0 2px 7px rgba(0,0,0,0.5)', fontFamily: '"Barlow Condensed", Poppins, sans-serif', color: PAL.chalk, fontSize: 13.5, lineHeight: 1.3, userSelect: 'none', textAlign: 'center' }}>
              {c.text}
            </div>
          </Html>
        )
      })}
    </>
  )
}

/* --------------------- Mode: threshold training ------------------------- */

/** Thruster loop whose speed follows intensity and whose form degrades past the threshold. */
function ThresholdAthlete({ intensity, threshold }: { intensity: number; threshold: number }) {
  const { write, body } = useSkeleton()
  const t = useRef(0)
  const cur = useRef<Record<JointName, THREE.Vector2>>(
    Object.fromEntries((Object.keys(POSES.stand) as JointName[]).map((j) => [j, new THREE.Vector2(...POSES.frontBottom[j])])) as Record<JointName, THREE.Vector2>,
  )
  useFrame((_, dt) => {
    const period = clamp(2.6 * (10000 / Math.max(intensity, 2000)), 0.7, 5.5)
    t.current += dt / period
    const cyc = (Math.sin(t.current * Math.PI * 2 - Math.PI / 2) + 1) / 2
    const slop = clamp((intensity - threshold) / THRESHOLD.breakBand, 0, 1)
    const wob = Math.sin(t.current * Math.PI * 7.3) * slop
    const from = POSES.frontBottom
    const to = POSES.pressLockout
    for (const j of Object.keys(from) as JointName[]) {
      let x = lerp(from[j][0], to[j][0], cyc)
      let y = lerp(from[j][1], to[j][1], cyc)
      // form faults, straight from the movement guide's fault lists: torso
      // pitches forward, bar drifts from the frontal plane, depth shortens
      if (slop > 0) {
        if (j === 'shoulder' || j === 'head') x += slop * (0.4 + 0.1 * wob) * (1 - cyc)
        if (j === 'hand' || j === 'elbow') x += slop * (0.45 + 0.12 * wob) * cyc
        if (j === 'hip') y += slop * 0.3 * (1 - cyc)
      }
      cur.current[j].set(x, y)
    }
    write(cur.current, 'bar')
  })
  return body
}

/** The power dial: an arc of segments in ft-lb/min with a live needle. */
function ThresholdDial({ intensity, threshold }: { intensity: number; threshold: number }) {
  const SEGS = 36
  const R = 3.3
  const a0 = Math.PI * 1.08
  const a1 = -Math.PI * 0.08
  const needle = useRef<THREE.Group | null>(null)
  useFrame((_, dt) => {
    if (!needle.current) return
    const f = clamp(intensity / THRESHOLD.dialMax, 0, 1)
    const target = a0 + (a1 - a0) * f
    needle.current.rotation.z = lerp(needle.current.rotation.z, target - Math.PI / 2, clamp(dt * 5, 0, 1))
  })
  const segs = useMemo(() => {
    return Array.from({ length: SEGS }, (_, i) => {
      const f = (i + 0.5) / SEGS
      const val = f * THRESHOLD.dialMax
      const ang = a0 + (a1 - a0) * f
      let color: string = PAL.yellowGreen
      if (val > threshold && val <= threshold + THRESHOLD.breakBand) color = '#f4b740'
      else if (val > threshold + THRESHOLD.breakBand) color = '#f43f5e'
      return { x: Math.cos(ang) * R, y: Math.sin(ang) * R, ang, color }
    })
  }, [threshold])
  return (
    <group position={[1.7, 2.1, -1.8]} scale={[0.82, 0.82, 0.82]}>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0]} rotation={[0, 0, s.ang]}>
          <boxGeometry args={[0.34, 0.13, 0.1]} />
          <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.5} />
        </mesh>
      ))}
      <group ref={needle}>
        <mesh position={[0, R * 0.62, 0]}>
          <coneGeometry args={[0.09, R * 1.15, 8]} />
          <meshStandardMaterial color="#eef3f6" emissive="#eef3f6" emissiveIntensity={0.25} />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#eef3f6" />
      </mesh>
      <Html position={[0, -0.85, 0]} center distanceFactor={12} occlude={false} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: '"Barlow Condensed", sans-serif', color: PAL.chalk, fontSize: 14, textAlign: 'center', whiteSpace: 'nowrap' }}>
          <b>{Math.round(intensity).toLocaleString()}</b> ft-lb/min
          <div style={{ color: PAL.muted, fontSize: 11.5 }}>form falters at {(threshold + THRESHOLD.breakBand).toLocaleString()}</div>
        </div>
      </Html>
    </group>
  )
}

/* ----------------------- Mode: the charter ------------------------------ */

function CharterScene({ stage, skipped }: { stage: number; skipped: boolean }) {
  const STEP_W = 3.0
  const STEP_H = 0.85
  const labels = ['MECHANICS', 'CONSISTENCY', 'INTENSITY']
  const athleteX = -STEP_W + stage * STEP_W
  const athleteY = (stage + 1) * STEP_H
  const slop = skipped ? 1 : 0
  return (
    <group position={[0, -1.9, 0]}>
      {labels.map((l, i) => (
        <group key={l} position={[-STEP_W + i * STEP_W, ((i + 1) * STEP_H) / 2, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[STEP_W * 0.94, (i + 1) * STEP_H, 2.6]} />
            <meshStandardMaterial
              color={i === 2 ? PAL.weightlifting : i === 1 ? PAL.monostructural : PAL.seaGreen}
              roughness={0.6}
              emissive={i === 2 ? PAL.weightlifting : i === 1 ? PAL.monostructural : PAL.seaGreen}
              emissiveIntensity={stage === i ? 0.3 : 0.06}
            />
          </mesh>
          <Html position={[0, ((i + 1) * STEP_H) / 2 + 0.35, 0]} center distanceFactor={13} occlude={false} style={{ pointerEvents: 'none' }}>
            <div style={{ fontFamily: '"Barlow Condensed", sans-serif', color: PAL.chalk, fontSize: 15, fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
              {i + 1}. {l}
            </div>
          </Html>
        </group>
      ))}
      {/* the athlete on the current step */}
      <group position={[athleteX, athleteY, 0]} scale={[0.62, 0.62, 0.62]}>
        <Figure2 stage={stage} sloppy={slop} />
      </group>
      {skipped && (
        <Html position={[STEP_W, 3 * STEP_H + 2.4, 0]} center distanceFactor={11} occlude={false} style={{ pointerEvents: 'none' }}>
          <div style={{ width: 250, padding: '9px 12px', borderRadius: 10, background: 'rgba(30,8,10,0.95)', border: '1px solid #f43f5e', fontFamily: '"Barlow Condensed", sans-serif', color: '#fecdd3', fontSize: 13, lineHeight: 1.4, textAlign: 'center' }}>
            <b style={{ color: '#f43f5e' }}>ORDER IGNORED</b>
            <div style={{ marginTop: 3 }}>"{MCI_SKIP_PENALTY}" (p. 77)</div>
          </div>
        </Html>
      )}
      {stage === 1 && !skipped && (
        <Html position={[0, 3 * STEP_H + 2.3, 0]} center distanceFactor={12} occlude={false} style={{ pointerEvents: 'none' }}>
          <div style={{ width: 240, padding: '8px 11px', borderRadius: 10, background: 'rgba(7,10,14,0.93)', border: `1px solid ${PAL.monostructural}`, fontFamily: '"Barlow Condensed", sans-serif', color: PAL.chalk, fontSize: 12.5, lineHeight: 1.45, textAlign: 'left' }}>
            <b style={{ color: PAL.monostructural }}>CONSISTENT MEANS:</b>
            {MCI_CONSISTENCY_QUESTIONS.map((q, i) => (
              <div key={i}>• {q}</div>
            ))}
          </div>
        </Html>
      )}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={16} blur={2.4} far={6} />
    </group>
  )
}

/** Small always-squatting figure for the charter steps; sloppy = broken form. */
function Figure2({ stage, sloppy }: { stage: number; sloppy: number }) {
  const { write, body } = useSkeleton()
  const t = useRef(0)
  const cur = useRef<Record<JointName, THREE.Vector2>>(
    Object.fromEntries((Object.keys(POSES.stand) as JointName[]).map((j) => [j, new THREE.Vector2(...POSES.stand[j])])) as Record<JointName, THREE.Vector2>,
  )
  useFrame((_, dt) => {
    const period = stage === 2 ? 1.1 : stage === 1 ? 2.0 : 3.0
    t.current += dt / period
    const cyc = (Math.sin(t.current * Math.PI * 2 - Math.PI / 2) + 1) / 2
    const wob = Math.sin(t.current * Math.PI * 9.1) * sloppy
    const from = POSES.stand
    const to = POSES.airBottom
    for (const j of Object.keys(from) as JointName[]) {
      let x = lerp(from[j][0], to[j][0], cyc)
      let y = lerp(from[j][1], to[j][1], cyc)
      if (sloppy > 0) {
        if (j === 'shoulder' || j === 'head') x += sloppy * (0.45 + 0.12 * wob) * cyc
        if (j === 'hip') y += sloppy * 0.3 * cyc
        if (j === 'knee') x += sloppy * 0.15 * wob
      }
      cur.current[j].set(x, y)
    }
    write(cur.current, stage === 2 ? 'bar' : 'none')
  })
  return body
}

/* ------------------------------ the module ------------------------------ */

type Mode = 'threshold' | 'charter' | 'movements'

const GROUPS: { key: string; label: string }[] = [
  { key: 'squat', label: 'The squats' },
  { key: 'press', label: 'The presses' },
  { key: 'deadlift', label: 'The deadlift family' },
]

export default function TechniqueModule() {
  const meta = moduleByKey('technique')
  const copy = MODULE_COPY.technique
  const [mode, setMode] = useState<Mode>('threshold')

  // threshold mode state
  const [intensity, setIntensity] = useState(8000)
  const [threshold, setThreshold] = useState(THRESHOLD.start)
  const inBand = intensity > threshold && intensity <= threshold + THRESHOLD.breakBand
  const past = intensity > threshold + THRESHOLD.breakBand
  const form = Math.round(100 * (1 - clamp((intensity - threshold) / THRESHOLD.breakBand, 0, 1)))
  const safety = past ? 35 : inBand ? 78 : 96
  const efficacy = Math.round(clamp(55 + (intensity / THRESHOLD.dialMax) * 45 - (past ? 25 : 0), 0, 100))
  const efficiency = Math.round(clamp((intensity / THRESHOLD.dialMax) * 100 - (past ? 30 : 0), 5, 100))

  // charter mode state
  const [stage, setStage] = useState(0)
  const [skipped, setSkipped] = useState(false)

  // movements mode state
  const [moveKey, setMoveKey] = useState('air-squat')
  const [showCues, setShowCues] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const move = MOVEMENTS.find((m) => m.key === moveKey)!

  const controls = (
    <>
      <ControlHead>Technique</ControlHead>
      <Segmented
        options={[
          { value: 'threshold', label: 'Threshold training' },
          { value: 'charter', label: 'The charter' },
          { value: 'movements', label: 'The 9 movements' },
        ]}
        value={mode}
        onChange={(m) => setMode(m as Mode)}
      />
      {mode === 'threshold' && (
        <>
          <Slider
            label='"Pick up the speed"'
            value={intensity}
            display={`${intensity.toLocaleString()} ft-lb/min`}
            min={4000}
            max={THRESHOLD.dialMax}
            step={500}
            dotColor={(past ? '#f43f5e' : inBand ? '#f4b740' : PAL.yellowGreen) as string}
            onChange={setIntensity}
          />
          <Readout
            label="Form"
            value={`${form}%`}
            color={form > 80 ? PAL.yellowGreen : form > 35 ? '#f4b740' : '#f43f5e'}
            sub={
              past
                ? 'errors everywhere - now rein them in AT this speed'
                : inBand
                  ? 'form is faltering: this is the training band'
                  : 'crisp - so go faster'
            }
          />
          {(inBand || past) && (
            <button
              className="wf-btn primary"
              style={{ marginTop: 8 }}
              onClick={() => setThreshold((th) => Math.min(th + THRESHOLD.breakBand, THRESHOLD.dialMax - THRESHOLD.breakBand))}
            >
              Drill technique at this speed
            </button>
          )}
          {threshold > THRESHOLD.start && (
            <div className="text-[11.5px] mt-1.5" style={{ color: PAL.yellowGreen }}>
              Margin advanced: form now holds to {threshold.toLocaleString()}. Next frontier: {(threshold + THRESHOLD.breakBand).toLocaleString()}.
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <Bar label="Safety" value={safety} color="#f43f5e" />
            <Bar label="Efficacy" value={efficacy} color={PAL.yellowGreen} />
            <Bar label="Efficiency" value={efficiency} color="#38bdf8" />
            <div className="text-[10.5px] text-[var(--text-muted)] mt-1">"{SEE_VECTORS.intimate}" (p. 43)</div>
          </div>
        </>
      )}
      {mode === 'charter' && (
        <>
          <Segmented
            options={[
              { value: '0', label: 'Mechanics' },
              { value: '1', label: 'Consistency' },
              { value: '2', label: 'Intensity' },
            ]}
            value={String(stage)}
            onChange={(v) => {
              setStage(Number(v))
              setSkipped(false)
            }}
          />
          <Readout
            label={`Stage ${stage + 1} of 3`}
            value={['Learn the movement', 'Repeat it, correctly', 'Now add load and speed'][stage]}
            color={stage === 2 ? PAL.weightlifting : PAL.yellowGreen}
            sub={stage === 0 ? '"for some, just practicing the movements will be intense" (p. 77)' : stage === 1 ? 'about a month of on-ramp minimum (p. 77)' : '"then - and only then - intensity"'}
          />
          {!skipped && stage !== 2 && (
            <button
              className="wf-btn"
              style={{ marginTop: 8, borderColor: '#f43f5e', color: '#f43f5e' }}
              onClick={() => {
                setStage(2)
                setSkipped(true)
              }}
            >
              Skip straight to intensity
            </button>
          )}
          {skipped && (
            <button
              className="wf-btn"
              style={{ marginTop: 8 }}
              onClick={() => {
                setStage(0)
                setSkipped(false)
              }}
            >
              Back to mechanics
            </button>
          )}
        </>
      )}
      {mode === 'movements' && (
        <>
          <Segmented options={GROUPS.map((g) => ({ value: g.key, label: g.label.replace('The ', '') }))} value={move.group} onChange={(g) => setMoveKey(MOVEMENTS.find((m) => m.group === g)!.key)} />
          <Segmented
            options={MOVEMENTS.filter((m) => m.group === move.group).map((m) => ({ value: m.key, label: m.name.replace('The ', '').replace('Sumo Deadlift High Pull', 'SDHP').replace('Medicine-Ball', 'Med-Ball') }))}
            value={moveKey}
            onChange={setMoveKey}
          />
          <Slider label="Demo speed" value={speed * 100} display={`${speed.toFixed(1)}x`} min={30} max={200} step={10} dotColor={PAL.weightlifting} onChange={(v) => setSpeed(v / 100)} />
          <div className="wf-btns" style={{ marginTop: 6 }}>
            <button className={`wf-btn ${playing ? 'primary' : ''}`} onClick={() => setPlaying((p) => !p)}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className={`wf-btn ${showCues ? 'primary' : ''}`} onClick={() => setShowCues((s) => !s)}>
              Points of performance
            </button>
          </div>
          <Readout label={move.name} value={move.group === 'squat' ? 'Squat family' : move.group === 'press' ? 'Press family' : 'Deadlift family'} sub={move.oneLiner} color={PAL.weightlifting} />
        </>
      )}
    </>
  )

  const extra = (
    <>
      {/* Threshold training, in the essay's own words */}
      <SectionCard className="p-6 mt-5">
        <LessonHeading kicker={THRESHOLD.definitionCite} title="Threshold training: advance the margin at which form falters" />
        <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          {THRESHOLD.mechanism} That is the coach's whole loop: "{THRESHOLD.quote}" ({THRESHOLD.quoteCite}). Form versus speed is a
          false choice: "{THRESHOLD.illusion}" And perfect-but-slow fails everywhere: "{THRESHOLD.fran}" The errors along the way are
          not the goal, but "{THRESHOLD.errors}"
        </p>
      </SectionCard>

      {/* Safety, efficacy, efficiency */}
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        {SEE.map((s, i) => (
          <SectionCard key={s.key} className={`p-5 wf-rise wf-rise-${i + 1}`}>
            <div className="wf-condensed text-[12px] uppercase tracking-[0.2em] mb-2" style={{ color: s.color }}>
              {s.label}
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-primary)] font-semibold">{s.definition}</p>
            <p className="text-[12.5px] leading-relaxed text-[var(--text-tertiary)] mt-2">{s.example}</p>
          </SectionCard>
        ))}
      </div>
      <p className="text-[12px] text-[var(--text-muted)] mt-2">
        "{SEE_VECTORS.quote}" ({SEE_VECTORS.cite}). The charter exists to balance all three: "{CHARTER.quote}"
      </p>

      {/* The charter, and enforcement */}
      <SectionCard className="p-6 mt-4">
        <LessonHeading kicker={CHARTER.cite} title="Mechanics, consistency, then - and only then - intensity" />
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          {CHARTER.steps.map((s, i) => (
            <div key={s} className="rounded-xl p-4 text-center" style={{ background: 'rgba(145,198,64,0.06)', border: `1px solid ${i === 2 ? PAL.weightlifting : PAL.line}` }}>
              <div className="wf-condensed text-[13px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Step {i + 1}</div>
              <div className="wf-display text-2xl mt-1" style={{ color: i === 2 ? PAL.weightlifting : PAL.yellowGreen }}>{s}</div>
              <div className="text-[12px] text-[var(--text-tertiary)] mt-1">{i === 0 ? 'learn the movement' : i === 1 ? 'repeat it correctly' : 'then add load and speed'}</div>
            </div>
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--text-tertiary)]">
          "{CHARTER.gate}" Skipping the order has a price: "{MCI_SKIP_PENALTY}" And it is enforced rep by rep: "{MCI_ENFORCE}" (all
          Scaling CrossFit, L1 Guide p. 77)
        </p>
      </SectionCard>

      {/* The nine movements, full points of performance */}
      <div className="mt-4 grid md:grid-cols-3 gap-4">
        {GROUPS.map((g) => (
          <div key={g.key} className="space-y-4">
            <div className="wf-condensed text-[13px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">{g.label}</div>
            {MOVEMENTS.filter((m) => m.group === g.key).map((m: Foundational) => (
              <SectionCard key={m.key} className="p-4">
                <button
                  className="text-left w-full"
                  onClick={() => {
                    setMode('movements')
                    setMoveKey(m.key)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <div className="wf-display text-lg" style={{ color: moveKey === m.key && mode === 'movements' ? PAL.weightlifting : 'var(--text-primary)' }}>{m.name}</div>
                </button>
                <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)] mt-1">{m.oneLiner}</p>
                <div className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  <span className="text-[var(--text-tertiary)] uppercase text-[10.5px] tracking-wider">Set-up: </span>
                  {m.setup.join(' ')}
                </div>
                <div className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  <span className="text-[var(--text-tertiary)] uppercase text-[10.5px] tracking-wider">Execution: </span>
                  {m.execution.join(' ')}
                </div>
                <div className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  <span className="text-[var(--text-tertiary)] uppercase text-[10.5px] tracking-wider">Finish: </span>
                  {m.finish}
                </div>
              </SectionCard>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-[var(--text-muted)] mt-3">
        Points of performance are the L1 Training Guide's own bullets (Movement Guide, pp. 170-215), lightly compressed where noted.
        The demonstration figure shows movement shape, not a substitute for coaching.
      </p>
    </>
  )

  const BODY: Record<Mode, string> = {
    threshold: `The essay's own worked example, in its exact units: ${THRESHOLD.mechanism} Push the dial and watch form falter; then drill AT that speed to advance the margin.`,
    charter: `"${CHARTER.quote}" (${CHARTER.cite}) A hierarchy of concerns and a timeline of development: three steps, in order, or the p. 77 warning fires.`,
    movements: `The nine foundational movements of the L1 course, with the guide's own points of performance anchored to the joints they coach.`,
  }

  // One live camera for all three modes; only the orbit target moves per mode
  // (no remount, so the controls panel stays open while switching concepts).
  const TARGETS: Record<Mode, [number, number, number]> = {
    threshold: [1.4, 1.6, 0],
    charter: [0, 1.2, 0],
    movements: [0.1, 1.9, 0],
  }

  return (
    <ModulePage moduleKey="technique" extra={extra}>
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={BODY[mode]}
        controls={controls}
        camera={{ position: [4.6, 2.5, 9.2], fov: 44 }}
        target={TARGETS[mode]}
        autoRotate={false}
        minDistance={4}
        maxDistance={18}
        maxPolarAngle={Math.PI / 1.85}
        hint={
          mode === 'threshold'
            ? '"Pick up the speed." When form falters, do not slow down - drill there, then advance.'
            : mode === 'charter'
              ? 'Walk the three steps in order, or skip ahead and see why the guide warns against it.'
              : 'Pick a movement. The cues anchor to the joints they coach.'
        }
      >
        {mode === 'threshold' && (
          <group position={[0, -1.2, 0]}>
            <ThresholdAthlete intensity={intensity} threshold={threshold} />
            <ThresholdDial intensity={intensity} threshold={threshold} />
            <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={14} blur={2.2} far={6} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
              <circleGeometry args={[6.5, 48]} />
              <meshStandardMaterial color="#0b1013" roughness={0.95} />
            </mesh>
          </group>
        )}
        {mode === 'charter' && <CharterScene stage={stage} skipped={skipped} />}
        {mode === 'movements' && (
          <group position={[0, -1.2, 0]}>
            <Athlete moveKey={moveKey} speed={speed} playing={playing} />
            <Cues moveKey={moveKey} show={showCues} />
            <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={14} blur={2.2} far={6} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
              <circleGeometry args={[6.5, 48]} />
              <meshStandardMaterial color="#0b1013" roughness={0.95} />
            </mesh>
          </group>
        )}
      </LessonStage>
    </ModulePage>
  )
}
