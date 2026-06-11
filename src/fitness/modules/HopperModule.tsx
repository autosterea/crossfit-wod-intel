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
} from '../fitnessData'
import { clamp, prefersReducedMotion } from '../lessonMath'
import LessonStage from '../LessonStage'
import { Bar, ControlHead, Legend, ModulePage, Readout } from '../ui'

/* =========================================================================
   02 - The Hopper.

   A genuine raffle / bingo tumbling drum: a brushed-steel bird cage spinning
   about the horizontal viewing axis, packed with ~48 numbered task balls
   colored by modal domain. Real cage physics carry the balls up one rotating
   wall and cascade them back down the pile. Draw a task and a ball ejects down
   the chute to the tray while the drawn task flashes large at the top of the
   stage. A live scoreboard beside the drum accumulates points for the six
   competitors across draws - over many random draws the broad Generalist pulls
   ahead of every single specialist, which is the whole point of the model.
   ========================================================================= */

const DOMAIN_BY_KEY: Record<DomainKey, HopperDomain> = HOPPER_DOMAINS.reduce(
  (acc, d) => {
    acc[d.key] = d
    return acc
  },
  {} as Record<DomainKey, HopperDomain>,
)

/** Weighted pick: mostly known domains, roughly 1 in 5 is the "unknown" bucket. */
function weightedDomain(): DomainKey {
  if (Math.random() < 0.18) return 'unknown'
  const others: DomainKey[] = ['weightlifting', 'gymnastics', 'monostructural', 'oddObject']
  return others[Math.floor(Math.random() * others.length)]
}

/* ----------------------- canvas-texture text labels --------------------- */

/**
 * Build a crisp text sprite texture on a 2D canvas (self-contained, no font
 * fetch). Returns a texture plus the world aspect so the caller can size a
 * sprite or plane. Uses a system font stack.
 */
function makeLabelTexture(
  text: string,
  opt: { fontPx?: number; color?: string; bg?: string; border?: string; weight?: string } = {},
): { texture: THREE.CanvasTexture; aspect: number } {
  const fontPx = opt.fontPx ?? 46
  const color = opt.color ?? PAL.chalk
  const bg = opt.bg ?? 'rgba(7,10,14,0.72)'
  const border = opt.border ?? null
  const weight = opt.weight ?? '600'
  const family = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  const padX = 30
  const padY = 19
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

/** A small number painted on a circular chip texture for a ball. */
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
const DRUM_HALF = 1.0 // m, half-length along the spin axis (drum-local y)
const N_BALLS = 48
const CAP_R = 0.066 // m, ball radius
const RESTITUTION = 0.42 // wall bounce
const N_CHIPS = 10 // numbered chips that ride a readable subset of balls

// Draw-chute geometry (group-local). The funnel collar hugs the drum's lower
// front edge and ONE straight pipe leads down-forward to the tray, so the whole
// thing reads as a single machine. The pipe center / length / tilt are derived
// from the two connection points (funnel throat at the cage, mouth at the tray)
// so there is never a visible gap.
const CHUTE_EXIT_Y = -DRUM_R * 0.6 // y where the funnel meets the cage's lower-front
const CHUTE_THROAT_Z = DRUM_HALF + 0.18 // z of the funnel throat, just past the front hoop
const PIPE_R = 0.26 // chute pipe radius
const TRAY_Y = -(DRUM_R + 1.5) // tray height
const TRAY_Z = DRUM_HALF + 1.42 // tray depth (forward of the drum)

// Pipe spans from the funnel throat down to just above the tray.
const PIPE_TOP = new THREE.Vector3(0, CHUTE_EXIT_Y - 0.12, CHUTE_THROAT_Z)
const PIPE_BOT = new THREE.Vector3(0, TRAY_Y + 0.22, TRAY_Z)
const PIPE_MID = PIPE_TOP.clone().add(PIPE_BOT).multiplyScalar(0.5)
const PIPE_LEN = PIPE_TOP.distanceTo(PIPE_BOT) + 0.36 // overlap both ends a touch
// A default (local-y) cylinder rotated by PIPE_TILT about +x has its axis along
// (0, cos, sin); pick the tilt that aligns that axis with (bottom -> top).
const PIPE_TILT = Math.atan2(PIPE_TOP.z - PIPE_BOT.z, PIPE_TOP.y - PIPE_BOT.y)

interface Ball {
  /** Position in drum-local coordinates (the cage spins about local y). */
  pos: THREE.Vector3
  /** Velocity in drum-local coordinates. */
  vel: THREE.Vector3
  dk: DomainKey
  color: THREE.Color
  staged: boolean
}

/**
 * Drop a single ball at a random point inside the cylinder with a random kick.
 * The disc cross-section is the camera-facing x-y plane; z is the spin axis.
 */
function seedBall(b: Ball): void {
  const rr = DRUM_R - CAP_R - 0.04
  const zz = DRUM_HALF - CAP_R - 0.04
  let x = 0
  let y = 0
  do {
    x = Math.random() * 2 - 1
    y = Math.random() * 2 - 1
  } while (x * x + y * y > 1)
  b.pos.set(x * rr, y * rr, (Math.random() * 2 - 1) * zz)
  b.vel.set(Math.random() * 2 - 1, Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.3)
  b.staged = false
}

/**
 * Pick the domains for every ball once. The first N_CHIPS domains also color the
 * numbered chips, so returning them as a plain array lets the chips be built in
 * a memo (a render-safe value) while the balls themselves live in a ref.
 */
function makeBallDomains(): DomainKey[] {
  return Array.from({ length: N_BALLS }, () => weightedDomain())
}

/** Build the mutable task balls from a fixed domain assignment, seeded inside the drum. */
function makeBalls(domains: DomainKey[]): Ball[] {
  return domains.map((dk) => {
    const b: Ball = {
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      dk,
      color: new THREE.Color(DOMAIN_BY_KEY[dk].color),
      staged: false,
    }
    seedBall(b)
    return b
  })
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
  /** Stage a ball of the given domain to eject down the chute. */
  eject: (dk: DomainKey) => void
  /** Re-seat every staged/popped ball back inside the drum. */
  refill: () => void
}

function TumblingHopper({
  reduced,
  apiRef,
}: {
  reduced: boolean
  apiRef: React.MutableRefObject<HopperHandle | null>
}) {
  const steel = useSteelMaterial()
  const cageRef = useRef<THREE.Group>(null)
  const crankRef = useRef<THREE.Group>(null)
  const ballsMesh = useRef<THREE.InstancedMesh>(null)
  const chipRefs = useRef<(THREE.Sprite | null)[]>([])

  // Vertical bars of the bird cage.
  const N_BARS = 20
  const barAngles = useMemo(() => Array.from({ length: N_BARS }, (_, i) => (i / N_BARS) * Math.PI * 2), [])

  // The fixed domain assignment for every ball (a plain, render-safe value).
  const [domains] = useState<DomainKey[]>(makeBallDomains)

  // The mutable per-ball physics state (drum-local frame; the cage spins about
  // local y). Kept in a lazily-initialized ref so the ball objects stay stable
  // and are mutated in place each frame (read only in useFrame and handlers).
  const ballsRef = useRef<Ball[] | null>(null)
  if (ballsRef.current === null) ballsRef.current = makeBalls(domains)
  const balls = ballsRef.current

  // Numbered chips ride a readable subset of balls so the drum reads as a hopper
  // of distinct numbered tasks. Built from the (render-safe) domain list, not
  // from the ball ref, so this stays a pure render-time value.
  const chipTextures = useMemo(
    () => domains.slice(0, N_CHIPS).map((dk, i) => makeNumberTexture(i + 1, DOMAIN_BY_KEY[dk].color)),
    [domains],
  )

  // Eject animation bookkeeping (ball index -> progress along the chute).
  const ejecting = useRef<{ idx: number; t: number; from: THREE.Vector3 }[]>([])

  // Chute curve from the drum's front-bottom exit, through the funnel collar and
  // down the connected pipe to the tray (group-local space). The control points
  // are aligned with the DrawChute geometry below so the ball never leaves the
  // pipe: it slips out the drum's lower-front edge, into the funnel throat, then
  // rides the straight pipe to the tray.
  const chuteCurve = useMemo(() => {
    const start = new THREE.Vector3(0, CHUTE_EXIT_Y + 0.2, DRUM_HALF - 0.06) // just inside the drum
    const throat = PIPE_TOP.clone() // funnel throat at the cage edge
    const mid = PIPE_MID.clone() // straight down the pipe centerline
    const end = new THREE.Vector3(0, TRAY_Y + 0.18, TRAY_Z) // settle in the tray
    return new THREE.CatmullRomCurve3([start, throat, mid, end])
  }, [])

  const eject = useCallback(
    (dk: DomainKey) => {
      const pool = balls.map((b, i) => ({ b, i })).filter(({ b }) => !b.staged && b.dk === dk)
      const target = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
      if (!target) {
        const any = balls.map((b, i) => ({ b, i })).filter(({ b }) => !b.staged)
        if (!any.length) return
        const pick = any[Math.floor(Math.random() * any.length)]
        pick.b.staged = true
        pick.b.dk = dk
        pick.b.color = new THREE.Color(DOMAIN_BY_KEY[dk].color)
        ejecting.current.push({ idx: pick.i, t: 0, from: pick.b.pos.clone() })
        return
      }
      target.b.staged = true
      ejecting.current.push({ idx: target.i, t: 0, from: target.b.pos.clone() })
    },
    [balls],
  )

  const refill = useCallback(() => {
    ejecting.current = []
    for (const b of balls) {
      if (b.staged) seedBall(b)
    }
  }, [balls])

  useEffect(() => {
    apiRef.current = { eject, refill }
  }, [apiRef, eject, refill])

  useEffect(() => () => chipTextures.forEach((t) => t.dispose()), [chipTextures])

  // Cage spins about its LOCAL y axis (which the parent group tips to lie along
  // the world horizontal viewing axis, +z, so it reads like a raffle drum).
  const spin = reduced ? 0.18 : 1.5 // rad/s
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cageAngle = useRef(0)

  /* --- physics tuning ---
     The balls live in the parent group's world-aligned frame. The drum's spin
     axis is HORIZONTAL and points toward the viewer (world +z), so the balls
     tumble in the camera-facing x-y plane: gravity pulls down (-y), the cage
     rotates about +z, and a ball touching the rotating wall is dragged
     tangentially (wall friction) - carried UP the ascending side, then it loses
     the wall and cascades back down the pile. The classic raffle-drum motion. */
  const GRAVITY = reduced ? -2.0 : -7.0 // m/s^2 along -y (world down)
  const WALL_DRAG = reduced ? 0.05 : 0.42 // how strongly the rotating wall carries a contacting ball
  const CONTACT_BAND = 0.74 // start dragging once a ball is past this fraction of the radius
  const DAMP = reduced ? 1.2 : 0.5 // velocity damping (1/s); keeps the pile churning, not exploding
  const MAX_SPEED = 7.5 // clamp to avoid blow-ups on slow frames

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    cageAngle.current += spin * dt
    // The cage mesh spins about its own local y, which the [PI/2,0,0] tilt lays
    // along world z (the viewing axis), so it reads as a wheel facing the camera.
    if (cageRef.current) cageRef.current.rotation.y = cageAngle.current
    if (crankRef.current) crankRef.current.rotation.z = -cageAngle.current

    const innerR = DRUM_R - CAP_R - 0.02
    const innerZ = DRUM_HALF - CAP_R - 0.02
    const wallTangentialSpeed = spin * innerR // m/s of the cage wall at the shell
    const bandR = innerR * CONTACT_BAND

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i]
      if (b.staged) continue

      // Gravity pulls straight down in world space.
      b.vel.y += GRAVITY * dt

      // Wall drag: balls riding the rotating shell are dragged tangentially.
      // For rotation about +z, the tangent in the x-y plane is (-y, +x).
      const rad = Math.hypot(b.pos.x, b.pos.y)
      if (rad > bandR && rad > 1e-4) {
        const depth = clamp((rad - bandR) / (innerR - bandR), 0, 1)
        const inv = 1 / rad
        const tx = -b.pos.y * inv
        const ty = b.pos.x * inv
        // wall velocity at this point (rigid rotation about +z): omega x r
        const wx = tx * wallTangentialSpeed
        const wy = ty * wallTangentialSpeed
        // pull the ball's in-plane velocity toward the wall velocity
        const k = clamp(WALL_DRAG * depth * dt * 9, 0, 1)
        b.vel.x += (wx - b.vel.x) * k
        b.vel.y += (wy - b.vel.y) * k
      }

      // damping
      const d = Math.max(0, 1 - DAMP * dt)
      b.vel.multiplyScalar(d)

      // clamp speed
      const sp = b.vel.length()
      if (sp > MAX_SPEED) b.vel.multiplyScalar(MAX_SPEED / sp)

      // integrate
      b.pos.addScaledVector(b.vel, dt)

      // contain radially (x-y disc), reflect inward with restitution
      const r2 = Math.hypot(b.pos.x, b.pos.y)
      if (r2 > innerR) {
        const nx = b.pos.x / r2
        const ny = b.pos.y / r2
        const vn = b.vel.x * nx + b.vel.y * ny
        if (vn > 0) {
          b.vel.x -= (1 + RESTITUTION) * vn * nx
          b.vel.y -= (1 + RESTITUTION) * vn * ny
        }
        b.pos.x = nx * innerR
        b.pos.y = ny * innerR
      }

      // contain along the spin axis (z), reflect with restitution
      if (b.pos.z > innerZ) {
        b.pos.z = innerZ
        b.vel.z = -Math.abs(b.vel.z) * RESTITUTION
      } else if (b.pos.z < -innerZ) {
        b.pos.z = -innerZ
        b.vel.z = Math.abs(b.vel.z) * RESTITUTION
      }
    }

    // advance ejecting balls along the chute curve (mutate ref entries in place)
    const list = ejecting.current
    const rate = dt / (reduced ? 0.18 : 0.85)
    const still: { idx: number; t: number; from: THREE.Vector3 }[] = []
    for (let k = 0; k < list.length; k++) {
      const e = list[k]
      const t = e.t + rate
      const tt = clamp(t, 0, 1)
      const eased = tt < 0.5 ? 2 * tt * tt : -1 + (4 - 2 * tt) * tt
      const b = balls[e.idx]
      if (tt < 0.35) {
        b.pos.lerpVectors(e.from, chuteCurve.getPoint(0), eased / 0.35)
      } else {
        const u = (tt - 0.35) / 0.65
        chuteCurve.getPoint(u, b.pos)
      }
      if (tt < 1) still.push({ idx: e.idx, t, from: e.from })
    }
    if (still.length !== list.length) ejecting.current = still

    // write instances
    const im = ballsMesh.current
    if (im) {
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i]
        dummy.position.copy(b.pos)
        const s = b.staged ? 1.55 : 1
        dummy.scale.set(s, s, s)
        dummy.rotation.set(b.pos.z * 1.4, b.pos.x * 1.4, b.pos.y * 1.2)
        dummy.updateMatrix()
        im.setMatrixAt(i, dummy.matrix)
        im.setColorAt(i, b.color)
      }
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }

    // numbered chips track their balls
    for (let i = 0; i < chipRefs.current.length; i++) {
      const sp = chipRefs.current[i]
      const b = balls[i]
      if (sp && b) {
        const s = b.staged ? 1.55 : 1
        sp.position.set(b.pos.x, b.pos.y, b.pos.z)
        sp.scale.set(CAP_R * 2.05 * s, CAP_R * 2.05 * s, 1)
        sp.visible = !b.staged
      }
    }
  })

  const ringGeo = useMemo(() => new THREE.TorusGeometry(DRUM_R + 0.06, 0.06, 12, 48), [])
  const barGeo = useMemo(() => new THREE.CylinderGeometry(0.022, 0.022, DRUM_HALF * 2, 12), [])

  return (
    <group position={[0, DRUM_R + 1.4, 0]}>
      {/* The cage tips so its local-y spin axis lies along world +z (horizontal,
          facing the camera) - the classic raffle-drum orientation. */}
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
      <Aframe steel={steel} z={DRUM_HALF + 0.55} drop={DRUM_R + 1.4} />
      <Aframe steel={steel} z={-(DRUM_HALF + 0.55)} drop={DRUM_R + 1.4} />

      {/* hand crank (spins with the cage) */}
      <group ref={crankRef} position={[0, 0, DRUM_HALF + 0.85]}>
        <mesh material={steel} position={[0.42, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.85, 12]} />
        </mesh>
        <mesh material={steel} position={[0.42, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.32, 12]} />
        </mesh>
      </group>

      {/* the draw chute: a funnel collar bolted to the drum's lower-front edge
          feeding ONE continuous pipe down to the tray (reads as one machine) */}
      <DrawChute steel={steel} />

      {/* the task balls (instanced spheres) */}
      <instancedMesh ref={ballsMesh} args={[undefined, undefined, N_BALLS]} castShadow>
        <sphereGeometry args={[CAP_R, 18, 14]} />
        <meshStandardMaterial toneMapped={false} roughness={0.42} metalness={0.05} emissiveIntensity={0.3} />
      </instancedMesh>
      {/* a readable handful of numbered chips ride with their balls */}
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
      <SpriteLabel
        text="THE HOPPER"
        fontPx={48}
        color={PAL.chalk}
        border="rgba(255,255,255,0.18)"
        position={[0, DRUM_R + 0.78, 0]}
        height={0.5}
      />
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

/**
 * The draw chute as ONE continuous form: a funnel collar that bolts onto the
 * drum's lower-front edge, narrowing into a straight steel pipe that leads down
 * to the catch tray. Positions/rotations are derived from PIPE_TOP/PIPE_BOT so
 * the funnel, pipe and tray meet with no visible gap.
 */
function DrawChute({ steel }: { steel: THREE.Material }) {
  // The funnel: wide mouth hugging the cage's lower-front, tapering to PIPE_R at
  // the throat. Centered between the cage edge and the pipe top, leaned to share
  // the pipe's axis so it blends straight into the pipe.
  const funnelMouth = useMemo(
    () => new THREE.Vector3(0, -DRUM_R + 0.18, DRUM_HALF - 0.02),
    [],
  )
  const funnelCenter = useMemo(
    () => funnelMouth.clone().add(PIPE_TOP).multiplyScalar(0.5),
    [funnelMouth],
  )
  const funnelLen = useMemo(() => funnelMouth.distanceTo(PIPE_TOP) + 0.18, [funnelMouth])
  // The cone's narrow (radiusTop) end is at +local-y and must point at the pipe
  // throat (PIPE_TOP); rotation [funnelTilt,0,0] lays +local-y along (0,cos,sin),
  // so aim that axis from the mouth toward PIPE_TOP.
  const funnelTilt = useMemo(
    () => Math.atan2(PIPE_TOP.z - funnelMouth.z, PIPE_TOP.y - funnelMouth.y),
    [funnelMouth],
  )

  return (
    <group>
      {/* collar ring where the funnel bolts to the cage's lower-front */}
      <mesh material={steel} position={funnelMouth} rotation={[Math.PI / 2 + funnelTilt, 0, 0]}>
        <torusGeometry args={[0.46, 0.05, 10, 28]} />
      </mesh>
      {/* funnel: wide mouth at the cage -> narrows to the pipe throat */}
      <mesh material={steel} position={funnelCenter} rotation={[funnelTilt, 0, 0]}>
        <cylinderGeometry args={[PIPE_R, 0.46, funnelLen, 28, 1, true]} />
      </mesh>
      {/* the straight pipe: funnel throat -> tray, as one continuous tube */}
      <mesh material={steel} position={PIPE_MID} rotation={[PIPE_TILT, 0, 0]} castShadow>
        <cylinderGeometry args={[PIPE_R, PIPE_R, PIPE_LEN, 28, 1, true]} />
      </mesh>
      {/* a couple of band stiffeners so the pipe reads as a built part */}
      <mesh
        material={steel}
        position={PIPE_TOP.clone().lerp(PIPE_BOT, 0.34)}
        rotation={[Math.PI / 2 + PIPE_TILT, 0, 0]}
      >
        <torusGeometry args={[PIPE_R + 0.02, 0.035, 8, 24]} />
      </mesh>
      <mesh
        material={steel}
        position={PIPE_TOP.clone().lerp(PIPE_BOT, 0.7)}
        rotation={[Math.PI / 2 + PIPE_TILT, 0, 0]}
      >
        <torusGeometry args={[PIPE_R + 0.02, 0.035, 8, 24]} />
      </mesh>
      {/* catch tray with a low back lip, sitting under the pipe mouth */}
      <mesh position={[0, TRAY_Y, TRAY_Z]} castShadow receiveShadow>
        <boxGeometry args={[0.78, 0.08, 0.58]} />
        <meshStandardMaterial color="#2a3138" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh material={steel} position={[0, TRAY_Y + 0.13, TRAY_Z - 0.27]}>
        <boxGeometry args={[0.78, 0.22, 0.05]} />
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

/** Small media-query hook so the in-scene scoreboard can shrink on phones. */
function useIsNarrow(query = '(max-width: 760px)'): boolean {
  const [m, setM] = useState(() => {
    try {
      return window.matchMedia(query).matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    let mq: MediaQueryList
    try {
      mq = window.matchMedia(query)
    } catch {
      return
    }
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

/* ------------------------------ scoreboard ------------------------------ */

interface CompetitorScore {
  /** Cumulative points across all draws so far. */
  total: number
}

/** Short display name for a roster competitor. */
const shortName = (name: string) => name.replace(' CrossFitter', '')

/**
 * An in-scene scoreboard panel (drei <Html>) pinned beside the drum, so the
 * names + accumulating points + leader are visible without opening the
 * (closed-by-default) controls panel.
 */
function ScoreboardPanel({
  scores,
  drawCount,
  leaderIdx,
}: {
  scores: CompetitorScore[]
  drawCount: number
  leaderIdx: number
}) {
  const narrow = useIsNarrow()
  const ranked = useMemo(
    () =>
      HOPPER_ROSTER.map((a, i) => ({ a, i, total: scores[i].total })).sort((x, y) => y.total - x.total),
    [scores],
  )
  const maxTotal = Math.max(1, ...ranked.map((r) => r.total))

  // Sit the board beside the drum at roughly its vertical center, so it never
  // spatially overlaps the "THE HOPPER" plate (above the drum) nor the top draw
  // banner. On phones pull it inward and make it narrower/smaller so it does not
  // clip off the right edge of the portrait canvas.
  const pos: [number, number, number] = narrow
    ? [DRUM_R + 1.15, DRUM_R + 0.55, 0]
    : [DRUM_R + 2.45, DRUM_R + 0.95, 0]

  return (
    <Html
      position={pos}
      center
      distanceFactor={narrow ? 7 : 9}
      zIndexRange={[20, 0]}
      occlude={false}
      pointerEvents="none"
    >
      <div
        style={{
          width: narrow ? 184 : 230,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          background: 'rgba(7,10,14,0.86)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 14,
          padding: narrow ? '10px 11px 11px' : '12px 13px 13px',
          color: '#eef3f6',
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 9,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Scoreboard
          </span>
          <span style={{ fontSize: 11, color: PAL.muted, fontVariantNumeric: 'tabular-nums' }}>{drawCount} drawn</span>
        </div>
        {ranked.map(({ a, i, total }, rank) => {
          const isLeader = drawCount > 0 && i === leaderIdx
          const color = DOMAIN_BY_KEY[primaryDomain(i)].color
          const w = Math.round((total / maxTotal) * 100)
          return (
            <div key={a.name} style={{ marginBottom: rank === ranked.length - 1 ? 0 : 7 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  fontWeight: isLeader ? 800 : 600,
                  color: isLeader ? '#fff' : '#dfe7eb',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <span style={{ color: PAL.muted, fontVariantNumeric: 'tabular-nums', width: 14 }}>{rank + 1}</span>
                  {isLeader && <span style={{ fontSize: 13 }}>{'♛'}</span>}
                  {shortName(a.name)}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color }}>{Math.round(total)}</span>
              </div>
              <div
                style={{
                  height: 5,
                  marginTop: 3,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${w}%`,
                    background: color,
                    borderRadius: 3,
                    boxShadow: isLeader ? `0 0 8px ${color}` : 'none',
                    transition: 'width 0.45s ease',
                  }}
                />
              </div>
            </div>
          )
        })}
        {drawCount === 0 ? (
          <div style={{ marginTop: 9, fontSize: 10.5, color: PAL.muted, lineHeight: 1.4 }}>
            Draw tasks at random. Over many draws the generalist accumulates the most.
          </div>
        ) : (
          <div style={{ marginTop: 9, fontSize: 10.5, color: PAL.muted, lineHeight: 1.4 }}>
            Leader: <span style={{ color: '#fff', fontWeight: 700 }}>{shortName(HOPPER_ROSTER[leaderIdx].name)}</span>
          </div>
        )}
      </div>
    </Html>
  )
}

/** The modal domain a competitor is the relative best at (for its bar color). */
function primaryDomain(i: number): DomainKey {
  const dom = HOPPER_ROSTER[i].domain
  let best: DomainKey = 'unknown'
  let bestV = -1
  ;(Object.keys(dom) as DomainKey[]).forEach((k) => {
    if (dom[k] > bestV) {
      bestV = dom[k]
      best = k
    }
  })
  return best
}

/* --------------------------------- scene -------------------------------- */

function HopperScene({
  drawnLabel,
  scores,
  drawCount,
  leaderIdx,
  reduced,
  apiRef,
}: {
  drawnLabel: { task: string; domainLabel: string; color: string } | null
  scores: CompetitorScore[]
  drawCount: number
  leaderIdx: number
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

      <TumblingHopper reduced={reduced} apiRef={apiRef} />

      <ScoreboardPanel scores={scores} drawCount={drawCount} leaderIdx={leaderIdx} />

      {/* PROMINENT draw banner pinned to the top-center of the canvas. Kept at a
          low zIndexRange so an opened About/Controls panel (z-index 200) sits in
          front of it; among the in-scene labels it still wins (banner 30 > 20). */}
      {drawnLabel && (
        <Html
          position={[0, DRUM_R * 2 + 4.0, 0]}
          center
          zIndexRange={[30, 0]}
          occlude={false}
          pointerEvents="none"
        >
          <div
            style={{
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: drawnLabel.color,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Drawn - {drawnLabel.domainLabel}
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: '#0a0f0c',
                background: drawnLabel.color,
                border: '2px solid rgba(255,255,255,0.55)',
                borderRadius: 14,
                padding: '8px 20px',
                boxShadow: `0 0 28px ${drawnLabel.color}, 0 12px 36px rgba(0,0,0,0.5)`,
              }}
            >
              {drawnLabel.task}
            </div>
          </div>
        </Html>
      )}

      {/* soft contact shadows under the whole arrangement */}
      <ContactShadows position={[0, 0.001, 0.4]} scale={16} blur={2.6} far={9} opacity={0.5} resolution={1024} />
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
  leaderIdx,
}: {
  onDraw: () => void
  onRefill: () => void
  onResetStats: () => void
  drawn: { task: string; domain: HopperDomain } | null
  scores: CompetitorScore[]
  drawCount: number
  leaderIdx: number
}) {
  // Leaderboard ranked by CUMULATIVE total points.
  const ranked = useMemo(
    () =>
      HOPPER_ROSTER.map((a, i) => ({ a, i, total: scores[i].total })).sort((x, y) => y.total - x.total),
    [scores],
  )
  const maxTotal = Math.max(1, ...ranked.map((r) => r.total))

  const genIdx = HOPPER_ROSTER.findIndex((a) => a.build === 'generalist')
  const genTotal = scores[genIdx].total
  const topSpecialist = ranked.find((r) => r.a.build !== 'generalist')

  const leadMsg =
    drawCount === 0
      ? 'Spin it, then draw a random challenge from the hopper.'
      : leaderIdx === genIdx
        ? 'Across random draws, the generalist accumulates the most points.'
        : 'Keep drawing. A specialist only leads while its own domain keeps coming up.'

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
          sub="Every competitor scores on this domain; totals accumulate"
        />
      ) : (
        <div className="wf-mono" style={{ fontSize: 11.5, color: PAL.muted, margin: '2px 0 12px' }}>
          {leadMsg}
        </div>
      )}

      <div className="wf-c-head" style={{ marginTop: 4 }}>
        <span>Leaderboard - cumulative points</span>
      </div>
      {ranked.map(({ a, i, total }, rank) => {
        const isLeader = drawCount > 0 && i === leaderIdx
        const label = `${rank + 1}. ${shortName(a.name)}${isLeader ? ' ♛' : ''}`
        return (
          <Bar
            key={a.name}
            label={label}
            value={total}
            max={maxTotal}
            color={DOMAIN_BY_KEY[primaryDomain(i)].color}
          />
        )
      })}

      {drawCount > 0 && (
        <div className="wf-pct-row">
          <div className="wf-pct">
            <div className="p" style={{ color: PAL.fit }}>
              {Math.round(genTotal)}
            </div>
            <div className="n">Generalist</div>
          </div>
          <div className="wf-pct">
            <div
              className="p"
              style={{ color: topSpecialist ? DOMAIN_BY_KEY[primaryDomain(topSpecialist.i)].color : PAL.muted }}
            >
              {Math.round(topSpecialist?.total ?? 0)}
            </div>
            <div className="n">Top specialist</div>
          </div>
        </div>
      )}

      <div className="wf-mono" style={{ fontSize: 11, color: PAL.muted, marginTop: 6 }}>
        {leadMsg}
      </div>

      <Legend items={HOPPER_DOMAINS.map((d) => ({ label: d.label, color: d.color }))} />
    </>
  )
}

/* ------------------------------ module shell ---------------------------- */

const EMPTY_SCORE = (): CompetitorScore => ({ total: 0 })

/** Index of the current leader by cumulative total (ties -> first / generalist). */
function leaderOf(scores: CompetitorScore[]): number {
  let idx = 0
  let best = -Infinity
  for (let i = 0; i < scores.length; i++) {
    if (scores[i].total > best) {
      best = scores[i].total
      idx = i
    }
  }
  return idx
}

export default function HopperModule() {
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const apiRef = useRef<HopperHandle | null>(null)

  const [drawnLabel, setDrawnLabel] = useState<{ task: string; domainLabel: string; color: string } | null>(null)
  const [drawn, setDrawn] = useState<{ task: string; domain: HopperDomain } | null>(null)
  const [drawCount, setDrawCount] = useState(0)
  const [scores, setScores] = useState<CompetitorScore[]>(() => HOPPER_ROSTER.map(EMPTY_SCORE))

  const leaderIdx = useMemo(() => leaderOf(scores), [scores])

  const onDraw = useCallback(() => {
    const dk = weightedDomain()
    const domain = DOMAIN_BY_KEY[dk]
    const task = domain.tasks[Math.floor(Math.random() * domain.tasks.length)]
    setDrawnLabel({ task, domainLabel: domain.label, color: domain.color })
    setDrawn({ task, domain })
    setDrawCount((n) => n + 1)
    // Each competitor scores on this domain (plus small jitter); totals accumulate.
    setScores((prev) =>
      prev.map((s, i) => {
        const base = HOPPER_ROSTER[i].domain[dk]
        const pts = clamp(base + (Math.random() * 8 - 4), 5, 99)
        return { total: s.total + pts }
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
        camera={{ position: [0, 4.6, 12.2], fov: 50 }}
        target={[0.6, 2.7, 0]}
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
            leaderIdx={leaderIdx}
          />
        }
      >
        <HopperScene
          drawnLabel={drawnLabel}
          scores={scores}
          drawCount={drawCount}
          leaderIdx={leaderIdx}
          reduced={reduced}
          apiRef={apiRef}
        />
      </LessonStage>
    </ModulePage>
  )
}
