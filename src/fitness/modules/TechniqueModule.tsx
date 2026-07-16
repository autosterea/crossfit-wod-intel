import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import { CHARTER, MODULE_COPY, MOVEMENTS, PAL, moduleByKey, type Foundational } from '../fitnessData'
import { clamp, lerp } from '../lessonMath'
import LessonStage from '../LessonStage'
import { ModulePage, ControlHead, Readout, Slider, Segmented, SectionCard, LessonHeading } from '../ui'

/* =========================================================================
   Module 08 - Technique: mechanics, consistency, then intensity.

   Centerpiece: a parametric jointed athlete (profile view) demonstrating the
   nine foundational movements of the L1 course on a loop. Poses are named
   keyframes of 2D joint positions (x forward, y up); each movement is a
   sequence of keyframes eased through in useFrame. Limbs are unit cylinders
   re-posed imperatively per frame (position + quaternion + length), so React
   re-renders only on control changes. Points-of-performance callouts anchor
   to the joints they coach.
   ========================================================================= */

type JointName = 'ankle' | 'knee' | 'hip' | 'shoulder' | 'head' | 'elbow' | 'hand'
type Pose = Record<JointName, [number, number]>

/** Named keyframes (side profile; athlete faces +x; ground at y=0). */
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
  /** keyframe sequence: pose name + seconds to reach it from the previous one (first entry = start pose). */
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

/** Position+orient a unit-Y cylinder mesh between two 3D points. */
const UP = new THREE.Vector3(0, 1, 0)
function setLimb(m: THREE.Mesh | null, a: THREE.Vector3, b: THREE.Vector3) {
  if (!m) return
  const dir = b.clone().sub(a)
  const len = Math.max(dir.length(), 0.001)
  m.position.copy(a).addScaledVector(dir, 0.5)
  m.quaternion.setFromUnitVectors(UP, dir.normalize())
  m.scale.set(1, len, 1)
}

function Athlete({ moveKey, speed, playing }: { moveKey: string; speed: number; playing: boolean }) {
  const spec = SPECS[moveKey]
  const cur = useRef<Record<JointName, THREE.Vector2>>(
    Object.fromEntries((Object.keys(POSES.stand) as JointName[]).map((j) => [j, new THREE.Vector2(...POSES[spec.seq[0].pose][j])])) as Record<JointName, THREE.Vector2>,
  )
  const seg = useRef(1) // index of the keyframe we are moving TOWARD
  const t = useRef(0)
  const holdLeft = useRef(spec.seq[0].hold ?? 0)
  const lastMove = useRef(moveKey)

  // limb + joint mesh refs
  const limbs = useRef<Record<string, THREE.Mesh | null>>({})
  const joints = useRef<Record<string, THREE.Mesh | null>>({})
  const barRef = useRef<THREE.Group | null>(null)
  const ballRef = useRef<THREE.Mesh | null>(null)

  useFrame((_, dt) => {
    // reset the sequence when the movement changes
    if (lastMove.current !== moveKey) {
      lastMove.current = moveKey
      seg.current = 1
      t.current = 0
      holdLeft.current = spec.seq[0].hold ?? 0
      const start = POSES[spec.seq[0].pose]
      for (const j of Object.keys(start) as JointName[]) cur.current[j].set(...start[j])
    }

    if (playing) {
      if (holdLeft.current > 0) {
        holdLeft.current -= dt * speed
      } else {
        const target = spec.seq[seg.current]
        t.current += (dt * speed) / Math.max(target.t, 0.12)
        if (t.current >= 1) {
          t.current = 0
          holdLeft.current = target.hold ?? 0
          seg.current = (seg.current + 1) % spec.seq.length
          if (seg.current === 0) seg.current = 1 // wrap: last keyframe should equal the first
          const snapped = POSES[target.pose]
          for (const j of Object.keys(snapped) as JointName[]) cur.current[j].set(...snapped[j])
        } else {
          const from = POSES[spec.seq[(seg.current - 1 + spec.seq.length) % spec.seq.length].pose]
          const to = POSES[spec.seq[seg.current].pose]
          const e = t.current * t.current * (3 - 2 * t.current) // smoothstep
          for (const j of Object.keys(to) as JointName[]) {
            cur.current[j].set(lerp(from[j][0], to[j][0], e), lerp(from[j][1], to[j][1], e))
          }
        }
      }
    }

    // ---- write the skeleton into the meshes (near/far limbs offset in z) ----
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
      joints.current[`elbow${side}`]?.position.copy(v('elbow', az))
      joints.current[`foot${side}`]?.position.set(p.ankle.x + 0.16, 0.07, z)
    }
    setLimb(limbs.current.torso, v('hip', 0), v('shoulder', 0))
    setLimb(limbs.current.neck, v('shoulder', 0), v('head', 0))
    joints.current.hip?.position.set(p.hip.x, p.hip.y, 0)
    joints.current.shoulder?.position.set(p.shoulder.x, p.shoulder.y, 0)
    joints.current.head?.position.set(p.head.x, p.head.y, 0)

    // implement follows the hands
    if (spec.implement === 'bar' && barRef.current) {
      barRef.current.visible = true
      barRef.current.position.set(p.hand.x, p.hand.y, 0)
      if (ballRef.current) ballRef.current.visible = false
    } else if (spec.implement === 'ball' && ballRef.current) {
      ballRef.current.visible = true
      ballRef.current.position.set(p.hand.x + 0.12, p.hand.y, 0)
      if (barRef.current) barRef.current.visible = false
    } else {
      if (barRef.current) barRef.current.visible = false
      if (ballRef.current) ballRef.current.visible = false
    }
  })

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

  return (
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

      {/* barbell: steel shaft along z with plates */}
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
      {/* medicine ball */}
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.3, 20, 20]} />
        <meshStandardMaterial color={PAL.oddObject} roughness={0.8} metalness={0} />
      </mesh>
    </group>
  )
}

/** Points-of-performance callouts anchored near the joints they coach. */
function Cues({ moveKey, show }: { moveKey: string; show: boolean }) {
  if (!show) return null
  const spec = SPECS[moveKey]
  // anchor to the movement's most representative pose (its second keyframe)
  const anchorPose = POSES[spec.seq[1].pose]
  return (
    <>
      {spec.cues.map((c, i) => {
        const [jx, jy] = anchorPose[c.joint]
        const side = c.dx && c.dx < 0 ? -1 : 1
        // push pills well clear of the figure and stagger them vertically so
        // neighbors never collide
        const x = jx + side * Math.max(Math.abs(c.dx ?? 1.2), 1.55)
        const y = jy + (c.dy ?? 0) + 0.3 - i * 0.14
        return (
          <Html key={`${moveKey}-${i}`} position={[x, y, 0]} center distanceFactor={10} occlude={false} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                width: 168,
                padding: '6px 10px',
                borderRadius: 9,
                background: 'rgba(7, 10, 14, 0.93)',
                border: `1px solid ${PAL.weightlifting}`,
                boxShadow: '0 2px 7px rgba(0,0,0,0.5)',
                fontFamily: '"Barlow Condensed", Poppins, sans-serif',
                color: PAL.chalk,
                fontSize: 13.5,
                lineHeight: 1.3,
                userSelect: 'none',
                textAlign: 'center',
              }}
            >
              {c.text}
            </div>
          </Html>
        )
      })}
    </>
  )
}

const GROUPS: { key: string; label: string }[] = [
  { key: 'squat', label: 'The squats' },
  { key: 'press', label: 'The presses' },
  { key: 'deadlift', label: 'The deadlift family' },
]

export default function TechniqueModule() {
  const meta = moduleByKey('technique')
  const copy = MODULE_COPY.technique
  const [moveKey, setMoveKey] = useState('air-squat')
  const [showCues, setShowCues] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)

  const move = MOVEMENTS.find((m) => m.key === moveKey)!
  const group = move.group

  const controls = (
    <>
      <ControlHead>Movement</ControlHead>
      <Segmented options={GROUPS.map((g) => ({ value: g.key, label: g.label.replace('The ', '') }))} value={group}
        onChange={(g) => setMoveKey(MOVEMENTS.find((m) => m.group === g)!.key)} />
      <Segmented
        options={MOVEMENTS.filter((m) => m.group === group).map((m) => ({ value: m.key, label: m.name.replace('The ', '').replace('Sumo Deadlift High Pull', 'SDHP').replace('Medicine-Ball', 'Med-Ball') }))}
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
  )

  const extra = (
    <>
      {/* The charter */}
      <SectionCard className="p-6 mt-5">
        <LessonHeading kicker={CHARTER.cite} title="Mechanics, consistency, then - and only then - intensity" />
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          {CHARTER.steps.map((s, i) => (
            <div key={s} className="rounded-xl p-4 text-center" style={{ background: 'rgba(145,198,64,0.06)', border: `1px solid ${i === 2 ? PAL.weightlifting : PAL.line}` }}>
              <div className="wf-condensed text-[13px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Step {i + 1}</div>
              <div className="wf-display text-2xl mt-1" style={{ color: i === 2 ? PAL.weightlifting : PAL.yellowGreen }}>{s}</div>
              <div className="text-[12px] text-[var(--text-tertiary)] mt-1">
                {i === 0 ? 'learn the movement' : i === 1 ? 'repeat it correctly' : 'then add load and speed'}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)] italic">"{CHARTER.quote}"</p>
        <p className="text-[13px] leading-relaxed text-[var(--text-tertiary)] mt-2">
          "{CHARTER.gate}" And the payoff is not just safety: "{CHARTER.why}" ({CHARTER.whyCite}). Technique is not the opposite of
          intensity. It is how intensity is expressed: "Technique is everything. It is at the heart of our quantification. You will
          not express power in significant measure without technique." (L1 Guide p. 44)
        </p>
      </SectionCard>

      {/* The nine movements, full points of performance */}
      <div className="mt-4 grid md:grid-cols-3 gap-4">
        {GROUPS.map((g) => (
          <div key={g.key} className="space-y-4">
            <div className="wf-condensed text-[13px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">{g.label}</div>
            {MOVEMENTS.filter((m) => m.group === g.key).map((m: Foundational) => (
              <SectionCard key={m.key} className="p-4">
                <button className="text-left w-full" onClick={() => { setMoveKey(m.key); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                  <div className="wf-display text-lg" style={{ color: moveKey === m.key ? PAL.weightlifting : 'var(--text-primary)' }}>{m.name}</div>
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

  return (
    <ModulePage moduleKey="technique" extra={extra}>
      <LessonStage
        eyebrow={copy.eyebrow}
        title={meta.title}
        body={`"${CHARTER.quote}" The figure demonstrates each of the nine foundational movements; toggle the points of performance to see what a coach is watching for.`}
        controls={controls}
        camera={{ position: [5.6, 2.6, 7.6], fov: 44 }}
        target={[0.1, 1.9, 0]}
        autoRotate={false}
        minDistance={4}
        maxDistance={16}
        maxPolarAngle={Math.PI / 1.85}
        hint="Pick a movement. Drag to orbit; the cues anchor to the joints they coach."
      >
        <group position={[0, -1.2, 0]}>
          <Athlete moveKey={moveKey} speed={speed} playing={playing} />
          <Cues moveKey={moveKey} show={showCues} />
          {/* platform */}
          <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={14} blur={2.2} far={6} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <circleGeometry args={[6.5, 48]} />
            <meshStandardMaterial color="#0b1013" roughness={0.95} />
          </mesh>
        </group>
      </LessonStage>
    </ModulePage>
  )
}
