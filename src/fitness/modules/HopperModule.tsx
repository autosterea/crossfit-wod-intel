import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  HOPPER_DOMAINS,
  HOPPER_ROSTER,
  MODULE_COPY,
  PAL,
  moduleByKey,
  type DomainKey,
  type HopperDomain,
  type RosterAthlete,
} from '../fitnessData'
import { clamp, lerp, prefersReducedMotion, smoothK } from '../lessonMath'
import LessonStage from '../LessonStage'
import { Bar, ControlHead, Legend, ModulePage, Readout } from '../ui'

/* =========================================================================
   02 - The Hopper.

   A realistic tumbling bird-cage drum full of numbered task capsules sits
   behind a row of six procedural human athletes. Draw a random task and the
   matching capsule is ejected down a chute while all six athletes re-pose for
   that modal domain and are scored. Over many draws the broad Generalist pulls
   ahead of every single specialist - the whole point of the model.
   ========================================================================= */

const DOMAIN_BY_KEY: Record<DomainKey, HopperDomain> = HOPPER_DOMAINS.reduce(
  (acc, d) => {
    acc[d.key] = d
    return acc
  },
  {} as Record<DomainKey, HopperDomain>,
)

const DOMAIN_KEYS = HOPPER_DOMAINS.map((d) => d.key)

/** Weighted pick: mostly known domains, roughly 1 in 5 is the "unknown" bucket. */
function weightedDomain(): DomainKey {
  if (Math.random() < 0.18) return 'unknown'
  const others: DomainKey[] = ['weightlifting', 'gymnastics', 'monostructural', 'oddObject']
  return others[Math.floor(Math.random() * others.length)]
}

/* ----------------------- canvas-texture text labels --------------------- */

/**
 * Build a crisp text sprite texture on a 2D canvas (self-contained, no font
 * fetch). Ported from the source makeLabel; returns a texture plus the world
 * aspect so the caller can size a sprite or plane. Uses a system font stack.
 */
function makeLabelTexture(
  text: string,
  opt: { fontPx?: number; color?: string; bg?: string; border?: string; weight?: string } = {},
): { texture: THREE.CanvasTexture; aspect: number } {
  const fontPx = opt.fontPx ?? 46
  const color = opt.color ?? PAL.chalk
  const bg = opt.bg ?? null
  const border = opt.border ?? null
  const weight = opt.weight ?? '600'
  const family = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  const padX = 26
  const padY = 16
  const SS = 2

  const measureCtx = document.createElement('canvas').getContext('2d')!
  measureCtx.font = `${weight} ${fontPx * SS}px ${family}`
  const tw = measureCtx.measureText(text).width
  const w = Math.ceil(tw + padX * 2 * SS)
  const h = Math.ceil(fontPx * SS + padY * 2 * SS)

  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.font = `${weight} ${fontPx * SS}px ${family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (bg) {
    const r = 16 * SS
    const x = SS
    const y = SS
    const ww = w - 2 * SS
    const hh = h - 2 * SS
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + ww, y, x + ww, y + hh, r)
    ctx.arcTo(x + ww, y + hh, x, y + hh, r)
    ctx.arcTo(x, y + hh, x, y, r)
    ctx.arcTo(x, y, x + ww, y, r)
    ctx.closePath()
    ctx.fillStyle = bg
    ctx.fill()
    if (border) {
      ctx.lineWidth = 3 * SS
      ctx.strokeStyle = border
      ctx.stroke()
    }
  }
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2 + SS)

  const texture = new THREE.CanvasTexture(c)
  texture.anisotropy = 4
  texture.minFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, aspect: w / h }
}

/** A small number painted on a circular chip texture for a capsule. */
function makeNumberTexture(n: number, color: string): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, S, S)
  ctx.beginPath()
  ctx.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2)
  ctx.fillStyle = '#0d1114'
  ctx.fill()
  ctx.lineWidth = 7
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.fillStyle = '#f3f7fa'
  ctx.font = '700 64px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), S / 2, S / 2 + 4)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ----------------------------- the hopper drum -------------------------- */

const DRUM_R = 1.55 // m, internal radius
const DRUM_HALF = 1.0 // m, half-length along the spin axis (z)
const N_CAPSULES = 56
const CAP_R = 0.052 // m
const RESTITUTION = 0.6

interface Capsule {
  pos: THREE.Vector3
  vel: THREE.Vector3
  dk: DomainKey
  color: THREE.Color
  staged: boolean
}

/** Brushed-steel shared material for the cage. */
function useSteelMaterial() {
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b8c0cc',
        metalness: 0.72,
        roughness: 0.3,
      }),
    [],
  )
}

interface HopperHandle {
  /** Stage a capsule of the given domain to eject; returns nothing. */
  eject: (dk: DomainKey) => void
  /** Re-seat every staged/popped capsule back inside the drum. */
  refill: () => void
}

function TumblingHopper({
  reduced,
  apiRef,
  onDraw,
}: {
  reduced: boolean
  apiRef: React.MutableRefObject<HopperHandle | null>
  onDraw: (label: string, color: string) => void
}) {
  const steel = useSteelMaterial()
  const cageRef = useRef<THREE.Group>(null)
  const capsulesMesh = useRef<THREE.InstancedMesh>(null)
  const chipRefs = useRef<(THREE.Sprite | null)[]>([])

  // Vertical bars of the bird cage.
  const N_BARS = 20
  const barAngles = useMemo(() => Array.from({ length: N_BARS }, (_, i) => (i / N_BARS) * Math.PI * 2), [])

  // Per-capsule physics state.
  const caps = useMemo<Capsule[]>(() => {
    const arr: Capsule[] = []
    for (let i = 0; i < N_CAPSULES; i++) {
      const dk = weightedDomain()
      const color = new THREE.Color(DOMAIN_BY_KEY[dk].color)
      // random point inside the cylinder
      let x = 0
      let y = 0
      do {
        x = Math.random() * 2 - 1
        y = Math.random() * 2 - 1
      } while (x * x + y * y > 1)
      const rr = DRUM_R - CAP_R - 0.05
      arr.push({
        pos: new THREE.Vector3(x * rr, y * rr, (Math.random() * 2 - 1) * (DRUM_HALF - CAP_R - 0.04)),
        vel: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.4).multiplyScalar(
          0.5,
        ),
        dk,
        color,
        staged: false,
      })
    }
    return arr
  }, [])

  // Numbered front-facing chips for a readable subset of capsules. (Instanced
  // meshes cannot carry per-instance textures, so the index is shown on the few
  // capsules that ride the front of the drum via individual sprites below.)
  const chipTextures = useMemo(
    () => caps.slice(0, 8).map((c, i) => makeNumberTexture(i + 1, `#${c.color.getHexString()}`)),
    [caps],
  )

  // Eject animation bookkeeping (capsule index -> progress along the chute).
  const ejecting = useRef<{ idx: number; t: number; from: THREE.Vector3; label: string }[]>([])

  // Chute curve from drum bottom out to the tray, in world space.
  const chuteCurve = useMemo(() => {
    const start = new THREE.Vector3(0, -DRUM_R * 0.2, DRUM_HALF + 0.1)
    const mid = new THREE.Vector3(0.05, -DRUM_R - 0.55, DRUM_HALF + 0.95)
    const end = new THREE.Vector3(0, -DRUM_R - 1.35, DRUM_HALF + 1.55)
    return new THREE.CatmullRomCurve3([start, mid, end])
  }, [])

  const eject = useCallback(
    (dk: DomainKey) => {
      const pool = caps.map((c, i) => ({ c, i })).filter(({ c }) => !c.staged && c.dk === dk)
      const target = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
      if (!target) {
        // No capsule of this exact domain left in the drum; pick any free one.
        const any = caps.map((c, i) => ({ c, i })).filter(({ c }) => !c.staged)
        if (!any.length) return
        const pick = any[Math.floor(Math.random() * any.length)]
        pick.c.staged = true
        pick.c.dk = dk
        pick.c.color = new THREE.Color(DOMAIN_BY_KEY[dk].color)
        ejecting.current.push({ idx: pick.i, t: 0, from: pick.c.pos.clone(), label: '' })
        return
      }
      target.c.staged = true
      ejecting.current.push({ idx: target.i, t: 0, from: target.c.pos.clone(), label: '' })
    },
    [caps],
  )

  const refill = useCallback(() => {
    ejecting.current = []
    for (const c of caps) {
      if (!c.staged) continue
      let x = 0
      let y = 0
      do {
        x = Math.random() * 2 - 1
        y = Math.random() * 2 - 1
      } while (x * x + y * y > 1)
      const rr = DRUM_R - CAP_R - 0.05
      c.pos.set(x * rr, y * rr, (Math.random() * 2 - 1) * (DRUM_HALF - CAP_R - 0.04))
      c.vel.set(Math.random() * 2 - 1, Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.4).multiplyScalar(0.6)
      c.staged = false
    }
  }, [caps])

  useEffect(() => {
    apiRef.current = { eject, refill }
  }, [apiRef, eject, refill])

  useEffect(() => () => chipTextures.forEach((t) => t.dispose()), [chipTextures])

  const spin = reduced ? 0 : 1.55 // rad/s cage spin
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cageAngle = useRef(0)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    cageAngle.current += spin * dt
    if (cageRef.current) cageRef.current.rotation.z = cageAngle.current

    const g = -3.0 // gentle gravity in drum-local units
    const innerZ = DRUM_HALF - CAP_R - 0.02
    const innerR = DRUM_R - CAP_R - 0.02

    for (let i = 0; i < caps.length; i++) {
      const c = caps[i]
      if (c.staged) continue
      // gravity
      c.vel.y += g * dt
      // tangential churn from the spinning cage near the shell
      const rad = Math.hypot(c.pos.x, c.pos.y)
      if (rad > innerR * 0.62) {
        const churn = spin * 0.5
        // tangent direction (perpendicular to radius, sense of spin about +z)
        const tx = -c.pos.y
        const ty = c.pos.x
        const tl = Math.hypot(tx, ty) || 1
        c.vel.x += (tx / tl) * churn * dt * 6
        c.vel.y += (ty / tl) * churn * dt * 6
      }
      // integrate
      c.pos.addScaledVector(c.vel, dt)
      // contain radially in x-y, reflect with restitution
      const r2 = Math.hypot(c.pos.x, c.pos.y)
      if (r2 > innerR) {
        const nx = c.pos.x / r2
        const ny = c.pos.y / r2
        const vn = c.vel.x * nx + c.vel.y * ny
        if (vn > 0) {
          c.vel.x -= (1 + RESTITUTION) * vn * nx
          c.vel.y -= (1 + RESTITUTION) * vn * ny
        }
        c.pos.x = nx * innerR
        c.pos.y = ny * innerR
      }
      // contain along axis
      if (c.pos.z > innerZ) {
        c.pos.z = innerZ
        c.vel.z = -Math.abs(c.vel.z) * RESTITUTION
      } else if (c.pos.z < -innerZ) {
        c.pos.z = -innerZ
        c.vel.z = Math.abs(c.vel.z) * RESTITUTION
      }
      // mild damping so they settle and churn rather than blow up
      c.vel.multiplyScalar(1 - 0.4 * dt)
    }

    // advance ejecting capsules along the chute curve
    const finished: number[] = []
    for (const e of ejecting.current) {
      e.t += dt / (reduced ? 0.001 : 0.85)
      const tt = clamp(e.t, 0, 1)
      const eased = tt < 0.5 ? 2 * tt * tt : -1 + (4 - 2 * tt) * tt
      const c = caps[e.idx]
      if (tt < 0.35) {
        // rise out of the drum to the chute mouth
        c.pos.lerpVectors(e.from, chuteCurve.getPoint(0), eased / 0.35)
      } else {
        const u = (tt - 0.35) / 0.65
        chuteCurve.getPoint(u, c.pos)
      }
      if (tt >= 1) finished.push(e.idx)
    }
    if (finished.length) ejecting.current = ejecting.current.filter((e) => !finished.includes(e.idx))

    // write instances
    const im = capsulesMesh.current
    if (im) {
      for (let i = 0; i < caps.length; i++) {
        const c = caps[i]
        const popped = c.staged
        dummy.position.copy(c.pos)
        const s = popped ? 1.7 : 1
        dummy.scale.set(s, s, s)
        dummy.rotation.set(c.pos.y * 1.4, c.pos.x * 1.4, c.pos.z)
        dummy.updateMatrix()
        im.setMatrixAt(i, dummy.matrix)
        im.setColorAt(i, c.color)
      }
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }

    // the numbered front chips follow their capsules
    for (let i = 0; i < chipRefs.current.length; i++) {
      const sp = chipRefs.current[i]
      const c = caps[i]
      if (sp && c) {
        const s = c.staged ? 1.7 : 1
        sp.position.set(c.pos.x, c.pos.y, c.pos.z)
        sp.scale.set(CAP_R * 2.1 * s, CAP_R * 2.1 * s, 1)
        sp.visible = !c.staged
      }
    }
  })

  // expose draw label to parent when an eject is triggered: handled in parent.
  void onDraw

  const ringGeo = useMemo(() => new THREE.TorusGeometry(DRUM_R + 0.06, 0.06, 12, 48), [])
  const barGeo = useMemo(() => new THREE.CylinderGeometry(0.022, 0.022, DRUM_HALF * 2, 12), [])

  return (
    <group position={[0, DRUM_R + 1.45, -1.7]}>
      {/* The spinning bird-cage drum (its axis is z). */}
      <group ref={cageRef} rotation={[Math.PI / 2, 0, 0]}>
        {/* two end-cap hoops */}
        <mesh geometry={ringGeo} material={steel} position={[0, DRUM_HALF, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
        <mesh geometry={ringGeo} material={steel} position={[0, -DRUM_HALF, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
        {/* mid stiffener hoop */}
        <mesh geometry={ringGeo} material={steel} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
        {/* vertical bars */}
        {barAngles.map((a, i) => (
          <mesh
            key={i}
            geometry={barGeo}
            material={steel}
            position={[Math.cos(a) * (DRUM_R + 0.06), 0, Math.sin(a) * (DRUM_R + 0.06)]}
            castShadow
          />
        ))}
        {/* a faint glass shell to read it as a closed drum */}
        <mesh>
          <cylinderGeometry args={[DRUM_R, DRUM_R, DRUM_HALF * 2, 40, 1, true]} />
          <meshStandardMaterial
            color="#cfe0ea"
            transparent
            opacity={0.05}
            roughness={0.1}
            metalness={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* axle through the drum */}
      <mesh material={steel} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, DRUM_HALF * 2 + 1.6, 16]} />
      </mesh>

      {/* A-frame stand: two angled legs each side of the axle */}
      <Aframe steel={steel} z={DRUM_HALF + 0.55} drop={DRUM_R + 1.45} />
      <Aframe steel={steel} z={-(DRUM_HALF + 0.55)} drop={DRUM_R + 1.45} />

      {/* hand crank */}
      <group position={[0, 0, DRUM_HALF + 0.85]}>
        <mesh material={steel} position={[0.42, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.85, 12]} />
        </mesh>
        <mesh material={steel} position={[0.42, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.32, 12]} />
        </mesh>
      </group>

      {/* clear draw chute leading down-forward to a small tray */}
      <mesh
        material={steel}
        position={[0, -DRUM_R * 0.55, DRUM_HALF + 0.85]}
        rotation={[Math.PI / 2.5, 0, 0]}
      >
        <cylinderGeometry args={[0.24, 0.24, 1.5, 24, 1, true]} />
      </mesh>
      {/* tray */}
      <mesh position={[0, -(DRUM_R + 1.35), DRUM_HALF + 1.55]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.08, 0.5]} />
        <meshStandardMaterial color="#2a3138" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* capsules (instanced spheres) */}
      <instancedMesh ref={capsulesMesh} args={[undefined, undefined, N_CAPSULES]} castShadow>
        <sphereGeometry args={[CAP_R, 20, 16]} />
        <meshStandardMaterial
          toneMapped={false}
          roughness={0.4}
          metalness={0.05}
          emissiveIntensity={0.32}
          vertexColors={false}
        />
      </instancedMesh>
      {/* a readable handful of numbered chips ride with their capsules so the
          drum reads as a hopper of distinct, numbered tasks (per-instance
          textures are not possible on an InstancedMesh, so these are sprites) */}
      {chipTextures.map((tex, i) => (
        <sprite
          key={i}
          ref={(el) => {
            chipRefs.current[i] = el
          }}
        >
          <spriteMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
        </sprite>
      ))}

      {/* THE HOPPER name plate above the drum */}
      <SpriteLabel text="THE HOPPER" fontPx={36} color={PAL.muted} position={[0, DRUM_R + 0.7, 0]} height={0.42} />
    </group>
  )
}

/** A simple A-frame support (an inverted V of two legs joined by a foot bar). */
function Aframe({ steel, z, drop }: { steel: THREE.Material; z: number; drop: number }) {
  const legLen = Math.hypot(drop, 0.9)
  const ang = Math.atan2(0.9, drop)
  return (
    <group position={[0, 0, z]}>
      <mesh material={steel} position={[-0.45, -drop / 2, 0]} rotation={[0, 0, ang]}>
        <cylinderGeometry args={[0.05, 0.06, legLen, 12]} />
      </mesh>
      <mesh material={steel} position={[0.45, -drop / 2, 0]} rotation={[0, 0, -ang]}>
        <cylinderGeometry args={[0.05, 0.06, legLen, 12]} />
      </mesh>
      {/* foot pads */}
      <mesh material={steel} position={[-0.9, -drop + 0.02, 0]}>
        <boxGeometry args={[0.3, 0.06, 0.3]} />
      </mesh>
      <mesh material={steel} position={[0.9, -drop + 0.02, 0]}>
        <boxGeometry args={[0.3, 0.06, 0.3]} />
      </mesh>
    </group>
  )
}

/** A billboard text sprite built from a canvas texture (self-contained). */
function SpriteLabel({
  text,
  fontPx = 42,
  color = PAL.chalk,
  bg,
  border,
  position,
  height = 0.7,
}: {
  text: string
  fontPx?: number
  color?: string
  bg?: string
  border?: string
  position: [number, number, number]
  height?: number
}) {
  const { texture, aspect } = useMemo(
    () => makeLabelTexture(text, { fontPx, color, bg, border }),
    [text, fontPx, color, bg, border],
  )
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

/* --------------------------- procedural athletes ------------------------ */

type BuildKey = RosterAthlete['build']

interface BodySpec {
  H: number // total height, m
  bulk: number // radius multiplier
  shoulderHip: number // shoulder:hip ratio
  limb: number // limb-length factor
  color: string
}

/** Body-type knobs per archetype (real-ish proportions). */
const BODY: Record<BuildKey, BodySpec> = {
  generalist: { H: 1.78, bulk: 1.0, shoulderHip: 1.35, limb: 1.0, color: PAL.fit },
  weightlifter: { H: 1.7, bulk: 1.18, shoulderHip: 1.5, limb: 0.94, color: PAL.weightlifting },
  endurance: { H: 1.82, bulk: 0.85, shoulderHip: 1.12, limb: 1.08, color: PAL.monostructural },
  gymnast: { H: 1.66, bulk: 1.08, shoulderHip: 1.55, limb: 0.92, color: PAL.gymnastics },
  strongman: { H: 1.84, bulk: 1.25, shoulderHip: 1.7, limb: 0.9, color: PAL.oddObject },
  sprinter: { H: 1.86, bulk: 1.0, shoulderHip: 1.4, limb: 1.06, color: '#f4b740' },
}

/** Joint pose targets (Euler X on each joint, radians) per drawn domain. */
type Pose = {
  spineX: number
  shoulderX: number
  elbowX: number
  hipX: number
  kneeX: number
  ankleX: number
  armSplit?: number // opposite-arm swing for sprint
  legSplit?: number // lead/trail hip split for sprint
}

function poseFor(dk: DomainKey | null): Pose {
  switch (dk) {
    case 'weightlifting':
      // deadlift / hinge with bar
      return { spineX: -0.95, shoulderX: -0.15, elbowX: 0.05, hipX: -1.2, kneeX: 0.55, ankleX: -0.2 }
    case 'gymnastics':
      // dead hang from a bar, arms overhead
      return { spineX: 0.02, shoulderX: -2.9, elbowX: 0.0, hipX: 0.04, kneeX: 0.04, ankleX: 0.05 }
    case 'monostructural':
      // mid-sprint stride
      return {
        spineX: 0.18,
        shoulderX: 0,
        elbowX: 1.5,
        hipX: 0,
        kneeX: 0,
        ankleX: 0,
        armSplit: 1.4,
        legSplit: 1.2,
      }
    case 'oddObject':
      // sandbag to shoulder carry: arms up around a load, slight squat
      return { spineX: -0.2, shoulderX: -1.7, elbowX: 1.7, hipX: -0.5, kneeX: 0.7, ankleX: -0.2 }
    default:
      // unknown / ready stance, athletic
      return { spineX: -0.12, shoulderX: -0.32, elbowX: 0.5, hipX: -0.28, kneeX: 0.4, ankleX: -0.12 }
  }
}

interface JointRefs {
  spine: THREE.Group
  shoulderL: THREE.Group
  shoulderR: THREE.Group
  elbowL: THREE.Group
  elbowR: THREE.Group
  hipL: THREE.Group
  hipR: THREE.Group
  kneeL: THREE.Group
  kneeR: THREE.Group
  ankleL: THREE.Group
  ankleR: THREE.Group
}

/** A capsule limb segment that hangs along -Y from its joint group. */
function Segment({
  len,
  r,
  material,
}: {
  len: number
  r: number
  material: THREE.Material
}) {
  // CapsuleGeometry is centered; shift so the top sits at the joint (y=0) and
  // it hangs down to y=-len.
  return (
    <mesh position={[0, -len / 2, 0]} material={material} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len - 2 * r), 6, 16]} />
    </mesh>
  )
}

function JointBall({ r, material }: { r: number; material: THREE.Material }) {
  return (
    <mesh material={material} castShadow>
      <sphereGeometry args={[r, 16, 12]} />
    </mesh>
  )
}

function Athlete({
  spec,
  drawnDomain,
  reduced,
  phase,
}: {
  spec: BodySpec
  drawnDomain: DomainKey | null
  reduced: boolean
  phase: number
}) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.55, metalness: 0.08 }),
    [spec.color],
  )
  useEffect(() => () => material.dispose(), [material])

  // proportions from the ~7.5-head canon
  const head = spec.H / 7.5
  const r = head * 0.42 * spec.bulk // base limb radius
  const hipWidth = head * 0.5
  const shoulderWidth = hipWidth * spec.shoulderHip
  const thighLen = head * 1.9 * spec.limb
  const shinLen = head * 1.75 * spec.limb
  const upperArm = head * 1.35 * spec.limb
  const foreArm = head * 1.2 * spec.limb
  const torsoLower = head * 1.05
  const chestLen = head * 1.2
  const neckLen = head * 0.35

  const root = useRef<THREE.Group>(null)
  const j = useRef<Partial<JointRefs>>({})
  const setRef = useCallback((k: keyof JointRefs) => (el: THREE.Group | null) => {
    if (el) j.current[k] = el
  }, [])

  // current eased pose values
  const cur = useRef<Pose>(poseFor(null))

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const target = poseFor(drawnDomain)
    const k = reduced ? 1 : smoothK(dt, 7)
    const c = cur.current
    c.spineX = lerp(c.spineX, target.spineX, k)
    c.shoulderX = lerp(c.shoulderX, target.shoulderX, k)
    c.elbowX = lerp(c.elbowX, target.elbowX, k)
    c.hipX = lerp(c.hipX, target.hipX, k)
    c.kneeX = lerp(c.kneeX, target.kneeX, k)
    c.ankleX = lerp(c.ankleX, target.ankleX, k)
    const split = lerp(c.legSplit ?? 0, target.legSplit ?? 0, k)
    const aSplit = lerp(c.armSplit ?? 0, target.armSplit ?? 0, k)
    c.legSplit = split
    c.armSplit = aSplit

    const t = reduced ? 0 : state.clock.getElapsedTime()
    const breath = Math.sin(t * 1.3 + phase) * 0.02
    const sway = Math.sin(t * 0.7 + phase) * 0.015

    const jr = j.current
    if (jr.spine) jr.spine.rotation.x = c.spineX + breath
    if (jr.shoulderL) jr.shoulderL.rotation.x = c.shoulderX - aSplit
    if (jr.shoulderR) jr.shoulderR.rotation.x = c.shoulderX + aSplit
    if (jr.elbowL) jr.elbowL.rotation.x = c.elbowX
    if (jr.elbowR) jr.elbowR.rotation.x = c.elbowX
    if (jr.hipL) jr.hipL.rotation.x = c.hipX + split
    if (jr.hipR) jr.hipR.rotation.x = c.hipX - split
    if (jr.kneeL) jr.kneeL.rotation.x = c.kneeX + (split > 0.4 ? 0.7 : 0)
    if (jr.kneeR) jr.kneeR.rotation.x = c.kneeX
    if (jr.ankleL) jr.ankleL.rotation.x = c.ankleX
    if (jr.ankleR) jr.ankleR.rotation.x = c.ankleX
    if (root.current) root.current.rotation.z = sway
  })

  // Pelvis sits so feet land on y=0. Standing leg length ~ thigh+shin; with a
  // little knee bend we place the pelvis a touch lower than full extension.
  const pelvisY = thighLen + shinLen + r * 0.5

  return (
    <group ref={root}>
      {/* pelvis */}
      <group position={[0, pelvisY, 0]}>
        <JointBall r={hipWidth * 0.55} material={material} />
        {/* pelvis bar */}
        <mesh material={material} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[r * 0.85, hipWidth, 6, 16]} />
        </mesh>

        {/* spine -> chest -> neck -> head */}
        <group ref={setRef('spine')}>
          <Segment len={torsoLower} r={r * 0.95} material={material} />
          <group position={[0, torsoLower, 0]}>
            <JointBall r={r * 0.7} material={material} />
            {/* chest */}
            <Segment len={chestLen} r={r * 1.05} material={material} />
            {/* shoulder bar */}
            <mesh material={material} position={[0, chestLen * 0.92, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[r * 0.8, shoulderWidth, 6, 16]} />
            </mesh>
            {/* neck + head */}
            <group position={[0, chestLen, 0]}>
              <Segment len={neckLen} r={r * 0.5} material={material} />
              <mesh position={[0, neckLen + head * 0.5, 0]} material={material} castShadow>
                <sphereGeometry args={[head * 0.5, 24, 18]} />
              </mesh>
            </group>

            {/* arms hang from shoulder bar ends, at chest top */}
            <group position={[-shoulderWidth / 2, chestLen * 0.92, 0]} ref={setRef('shoulderL')}>
              <JointBall r={r * 0.6} material={material} />
              <Segment len={upperArm} r={r * 0.6} material={material} />
              <group position={[0, -upperArm, 0]} ref={setRef('elbowL')}>
                <JointBall r={r * 0.5} material={material} />
                <Segment len={foreArm} r={r * 0.5} material={material} />
                {/* hand */}
                <mesh position={[0, -foreArm - r * 0.4, 0]} material={material} castShadow>
                  <sphereGeometry args={[r * 0.55, 12, 10]} />
                </mesh>
              </group>
            </group>
            <group position={[shoulderWidth / 2, chestLen * 0.92, 0]} ref={setRef('shoulderR')}>
              <JointBall r={r * 0.6} material={material} />
              <Segment len={upperArm} r={r * 0.6} material={material} />
              <group position={[0, -upperArm, 0]} ref={setRef('elbowR')}>
                <JointBall r={r * 0.5} material={material} />
                <Segment len={foreArm} r={r * 0.5} material={material} />
                <mesh position={[0, -foreArm - r * 0.4, 0]} material={material} castShadow>
                  <sphereGeometry args={[r * 0.55, 12, 10]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* legs */}
        <group position={[-hipWidth / 2, 0, 0]} ref={setRef('hipL')}>
          <JointBall r={r * 0.7} material={material} />
          <Segment len={thighLen} r={r * 0.85} material={material} />
          <group position={[0, -thighLen, 0]} ref={setRef('kneeL')}>
            <JointBall r={r * 0.55} material={material} />
            <Segment len={shinLen} r={r * 0.62} material={material} />
            <group position={[0, -shinLen, 0]} ref={setRef('ankleL')}>
              <mesh position={[0, -r * 0.4, head * 0.18]} material={material} castShadow>
                <boxGeometry args={[r * 1.2, r * 0.55, head * 0.7]} />
              </mesh>
            </group>
          </group>
        </group>
        <group position={[hipWidth / 2, 0, 0]} ref={setRef('hipR')}>
          <JointBall r={r * 0.7} material={material} />
          <Segment len={thighLen} r={r * 0.85} material={material} />
          <group position={[0, -thighLen, 0]} ref={setRef('kneeR')}>
            <JointBall r={r * 0.55} material={material} />
            <Segment len={shinLen} r={r * 0.62} material={material} />
            <group position={[0, -shinLen, 0]} ref={setRef('ankleR')}>
              <mesh position={[0, -r * 0.4, head * 0.18]} material={material} castShadow>
                <boxGeometry args={[r * 1.2, r * 0.55, head * 0.7]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* a prop that appears for the drawn domain */}
      <DomainProp dk={drawnDomain} spec={spec} pelvisY={pelvisY} head={head} />
    </group>
  )
}

/** A small contextual prop (barbell, pull-up bar, sandbag) per domain. */
function DomainProp({
  dk,
  spec,
  pelvisY,
  head,
}: {
  dk: DomainKey | null
  spec: BodySpec
  pelvisY: number
  head: number
}) {
  const metal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#3a4047', metalness: 0.7, roughness: 0.35 }),
    [],
  )
  const plate = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#15191d', metalness: 0.4, roughness: 0.6 }),
    [],
  )
  const sand = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b5a3a', roughness: 0.9 }), [])
  useEffect(
    () => () => {
      metal.dispose()
      plate.dispose()
      sand.dispose()
    },
    [metal, plate, sand],
  )

  if (dk === 'weightlifting') {
    const barY = pelvisY * 0.36
    return (
      <group position={[0, barY, head * 0.9]}>
        <mesh material={metal} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.016, 0.016, head * 4.5, 16]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={plate} position={[s * head * 1.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[head * 0.78, head * 0.78, 0.09, 28]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (dk === 'gymnastics') {
    // a pull-up bar overhead
    const y = pelvisY + head * 2.9
    return (
      <mesh material={metal} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, head * 3.4, 16]} />
      </mesh>
    )
  }
  if (dk === 'oddObject') {
    // sandbag shouldered
    return (
      <mesh material={sand} position={[0, pelvisY + head * 1.7, head * 0.55 * spec.bulk]} castShadow>
        <boxGeometry args={[head * 1.5, head * 0.9, head * 0.9]} />
      </mesh>
    )
  }
  return null
}

/* ------------------------------ the roster ------------------------------ */

interface AthleteScore {
  /** Score on the most recent draw, 0..100 (-1 if no draw yet). */
  last: number
  /** Cumulative running total + count for the average. */
  total: number
  count: number
}

function RosterRow({
  drawnDomain,
  scores,
  reduced,
}: {
  drawnDomain: DomainKey | null
  scores: AthleteScore[]
  reduced: boolean
}) {
  const gap = 2.05
  const x0 = -((HOPPER_ROSTER.length - 1) * gap) / 2
  return (
    <group position={[0, 0, 2.0]}>
      {HOPPER_ROSTER.map((a, i) => {
        const spec = BODY[a.build]
        const sc = scores[i]
        const x = x0 + i * gap
        return (
          <group key={a.name} position={[x, 0, 0]} rotation={[0, Math.PI, 0]}>
            <Athlete spec={spec} drawnDomain={drawnDomain} reduced={reduced} phase={i * 1.7} />
            {/* floating score bar above the head */}
            <ScoreBar value={sc.last} avg={sc.count ? sc.total / sc.count : -1} color={spec.color} h={spec.H} name={a.name} />
          </group>
        )
      })}
    </group>
  )
}

/** A 3D score bar that rises above an athlete plus an Html name/score chip. */
function ScoreBar({
  value,
  avg,
  color,
  h,
  name,
}: {
  value: number
  avg: number
  color: string
  h: number
  name: string
}) {
  const fill = useRef<THREE.Mesh>(null)
  const avgRing = useRef<THREE.Mesh>(null)
  const shown = useRef(0)
  const shownAvg = useRef(0)
  const barTop = h + 0.95
  const maxH = 1.4

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const k = smoothK(dt, 6)
    const tv = value < 0 ? 0 : value / 100
    const ta = avg < 0 ? 0 : avg / 100
    shown.current = lerp(shown.current, tv, k)
    shownAvg.current = lerp(shownAvg.current, ta, k)
    if (fill.current) {
      const fh = Math.max(0.001, shown.current * maxH)
      fill.current.scale.y = fh
      fill.current.position.y = barTop + fh / 2
    }
    if (avgRing.current) {
      avgRing.current.position.y = barTop + shownAvg.current * maxH
    }
  })

  return (
    <group rotation={[0, Math.PI, 0]}>
      {/* track */}
      <mesh position={[0, barTop + maxH / 2, 0]}>
        <boxGeometry args={[0.14, maxH, 0.05]} />
        <meshStandardMaterial color="#1a2129" transparent opacity={0.5} />
      </mesh>
      {/* live fill */}
      <mesh ref={fill} position={[0, barTop, 0]}>
        <boxGeometry args={[0.16, 1, 0.07]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      {/* running-average marker */}
      <mesh ref={avgRing} position={[0, barTop, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.22, 6]} />
        <meshStandardMaterial color="#f3f7fa" emissive="#f3f7fa" emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
      {/* name chip */}
      <Html position={[0, h + 0.5, 0]} center distanceFactor={9} occlude={false}>
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            color: '#eef3f6',
            background: 'rgba(7,10,14,0.72)',
            border: `1px solid ${color}`,
            borderRadius: '7px',
            padding: '3px 8px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transform: 'translateY(8px)',
          }}
        >
          {name.replace(' CrossFitter', '')}
          {avg >= 0 && (
            <span style={{ color, marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>{Math.round(avg)}</span>
          )}
        </div>
      </Html>
    </group>
  )
}

/* --------------------------------- scene -------------------------------- */

function HopperScene({
  drawnDomain,
  drawnLabel,
  scores,
  reduced,
  apiRef,
}: {
  drawnDomain: DomainKey | null
  drawnLabel: { task: string; color: string } | null
  scores: AthleteScore[]
  reduced: boolean
  apiRef: React.MutableRefObject<HopperHandle | null>
}) {
  return (
    <group>
      {/* dark ground plane + grid for grounding */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0f0c" roughness={1} metalness={0} />
      </mesh>
      <gridHelper args={[40, 40, '#1c3326', '#0e1a13']} position={[0, 0, 0]} />

      <TumblingHopper reduced={reduced} apiRef={apiRef} onDraw={() => {}} />

      <RosterRow drawnDomain={drawnDomain} scores={scores} reduced={reduced} />

      {/* the drawn-task banner above the drum */}
      {drawnLabel && (
        <SpriteLabel
          text={drawnLabel.task}
          fontPx={40}
          color={PAL.ink}
          bg={drawnLabel.color}
          border="rgba(255,255,255,0.4)"
          position={[0, DRUM_R * 2 + 3.0, -1.7]}
          height={0.6}
        />
      )}

      {/* soft contact shadows under the whole arrangement */}
      <ContactShadows position={[0, 0.001, 0.4]} scale={18} blur={2.6} far={9} opacity={0.5} resolution={1024} />
    </group>
  )
}

/* ------------------------------- controls ------------------------------- */

function HopperControls({
  onDraw,
  onRefill,
  onResetStats,
  drawn,
  scores,
  drawCount,
}: {
  onDraw: () => void
  onRefill: () => void
  onResetStats: () => void
  drawn: { task: string; domain: HopperDomain } | null
  scores: AthleteScore[]
  drawCount: number
}) {
  // Leaderboard sorted by running average, generalist tinted.
  const ranked = useMemo(() => {
    return HOPPER_ROSTER.map((a, i) => ({
      a,
      avg: scores[i].count ? scores[i].total / scores[i].count : 0,
      last: scores[i].last,
    })).sort((x, y) => y.avg - x.avg)
  }, [scores])

  const genIdx = HOPPER_ROSTER.findIndex((a) => a.build === 'generalist')
  const genAvg = scores[genIdx].count ? scores[genIdx].total / scores[genIdx].count : 0
  const topSpecialist = ranked.find((r) => r.a.build !== 'generalist')
  const leadMsg =
    drawCount === 0
      ? 'Spin it, then draw a random challenge from the hopper.'
      : genAvg >= (topSpecialist?.avg ?? 0)
        ? 'Across the hopper, the generalist stays ahead.'
        : 'Keep drawing. A specialist only leads inside its own domain.'

  return (
    <>
      <ControlHead right={<span className="wf-mono" style={{ color: PAL.muted }}>{drawCount} drawn</span>}>
        Draw from the hopper
      </ControlHead>

      <div className="wf-btns">
        <button className="wf-btn primary" onClick={onDraw}>
          Draw a task
        </button>
        <button className="wf-btn" onClick={onRefill}>
          Refill
        </button>
        <button className="wf-btn" onClick={onResetStats}>
          Reset stats
        </button>
      </div>

      {drawn ? (
        <Readout
          label={`Drew (${drawn.domain.label})`}
          value={<span style={{ color: drawn.domain.color, fontSize: 17 }}>{drawn.task}</span>}
          sub="All six athletes re-pose and are scored on this domain"
        />
      ) : (
        <div className="wf-mono" style={{ fontSize: 11.5, color: PAL.muted, margin: '2px 0 12px' }}>
          {leadMsg}
        </div>
      )}

      {/* per-athlete bars: last score + running average chip */}
      <div className="wf-c-head" style={{ marginTop: 4 }}>
        <span>Running average over {drawCount} draws</span>
      </div>
      {ranked.map(({ a, avg, last }, rank) => {
        const isGen = a.build === 'generalist'
        const label = `${rank + 1}. ${a.name.replace(' CrossFitter', '')}${isGen ? ' *' : ''}`
        return (
          <Bar
            key={a.name}
            label={label}
            value={drawCount === 0 ? 0 : avg}
            color={isGen ? PAL.fit : BODY[a.build].color}
          />
        )
      })}
      {drawCount > 0 && (
        <div className="wf-mono" style={{ fontSize: 11, color: PAL.muted, marginTop: 6 }}>
          {leadMsg} Last draw shown as the lighter tick.
        </div>
      )}
      {drawCount > 0 && (
        <div className="wf-pct-row">
          <div className="wf-pct">
            <div className="p" style={{ color: PAL.fit }}>
              {Math.round(genAvg)}
            </div>
            <div className="n">Generalist</div>
          </div>
          <div className="wf-pct">
            <div className="p" style={{ color: topSpecialist ? BODY[topSpecialist.a.build].color : PAL.muted }}>
              {Math.round(topSpecialist?.avg ?? 0)}
            </div>
            <div className="n">Top specialist</div>
          </div>
        </div>
      )}

      <Legend items={HOPPER_DOMAINS.map((d) => ({ label: d.label, color: d.color }))} />
      <div className="wf-mono" style={{ fontSize: 10, color: PAL.muted, marginTop: 8 }}>
        Last score shown over each athlete; the white tick is their running average.
      </div>
    </>
  )
}

/* ------------------------------ module shell ---------------------------- */

const EMPTY_SCORE = (): AthleteScore => ({ last: -1, total: 0, count: 0 })

export default function HopperModule() {
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const apiRef = useRef<HopperHandle | null>(null)

  const [drawnDomain, setDrawnDomain] = useState<DomainKey | null>(null)
  const [drawnLabel, setDrawnLabel] = useState<{ task: string; color: string } | null>(null)
  const [drawn, setDrawn] = useState<{ task: string; domain: HopperDomain } | null>(null)
  const [drawCount, setDrawCount] = useState(0)
  const [scores, setScores] = useState<AthleteScore[]>(() => HOPPER_ROSTER.map(EMPTY_SCORE))

  const onDraw = useCallback(() => {
    const dk = weightedDomain()
    const domain = DOMAIN_BY_KEY[dk]
    const task = domain.tasks[Math.floor(Math.random() * domain.tasks.length)]
    setDrawnDomain(dk)
    setDrawnLabel({ task, color: domain.color })
    setDrawn({ task, domain })
    setDrawCount((n) => n + 1)
    // score every athlete on this domain with a little jitter
    setScores((prev) =>
      prev.map((s, i) => {
        const base = HOPPER_ROSTER[i].domain[dk]
        const score = clamp(base + (Math.random() * 8 - 4), 5, 99)
        return { last: score, total: s.total + score, count: s.count + 1 }
      }),
    )
    apiRef.current?.eject(dk)
  }, [])

  const onRefill = useCallback(() => {
    apiRef.current?.refill()
    setDrawnLabel(null)
  }, [])

  const onResetStats = useCallback(() => {
    setScores(HOPPER_ROSTER.map(EMPTY_SCORE))
    setDrawCount(0)
    setDrawnDomain(null)
    setDrawnLabel(null)
    setDrawn(null)
    apiRef.current?.refill()
  }, [])

  return (
    <ModulePage moduleKey="hopper">
      <LessonStage
        eyebrow={MODULE_COPY.hopper.eyebrow}
        title={moduleByKey('hopper').title}
        body={MODULE_COPY.hopper.body}
        camera={{ position: [0, 4.1, 11], fov: 50 }}
        target={[0, 1.9, 0]}
        minDistance={6}
        maxDistance={26}
        controls={
          <HopperControls
            onDraw={onDraw}
            onRefill={onRefill}
            onResetStats={onResetStats}
            drawn={drawn}
            scores={scores}
            drawCount={drawCount}
          />
        }
      >
        <HopperScene
          drawnDomain={drawnDomain}
          drawnLabel={drawnLabel}
          scores={scores}
          reduced={reduced}
          apiRef={apiRef}
        />
      </LessonStage>
    </ModulePage>
  )
}
