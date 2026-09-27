import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HOPPER_DOMAINS, PAL } from '../../fitnessData'
import { stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { hash1 } from '../../story/rng'
import { useSafeFrame } from '../../story/useSafeFrame'
import { clock } from '../../story/clock'
import { Instances } from '../../story/kit/Instances'
import { BlobShadow } from '../../story/kit/BlobShadow'
import { Pen, PEN } from '../../story/kit/Pen'
import { Glows } from '../../story/kit/Halo'
import { ballOpts, makeRimStandard, steelOpts } from '../../story/kit/materials'
import { BALL_R, drumToWorld, drumXf, newDrumXf, type DrumXf, type World } from './layout'
import { win, type Sched } from './timeline'

/* =========================================================================
   The hopper drum (DESIGN.md D.3 "Parts", "Tumble"): three steel hoops and
   twelve bars (PBR steel against the engine's procedural environment), a
   back hub and spokes, 25 task balls (5 domains x 5 tasks, ball material in
   the domain colours) and a soft blob shadow. The drum is yawed 22 degrees
   about Y (a proposed amendment): seen three-quarter on, the barrel, the
   bars and the back hoop catch the key softbox and the cool strip, so the
   cage reads as polished steel with depth, not as a flat wheel.

   Tumble (ambient, deterministic): drum angle = 1.1 x A. Ball b takes phase
   slot o = 7b mod 25 (so the domains interleave along the wall) and lane
   o mod 4 (four depths 0.77 apart, more than a ball's diameter); the balls
   of one lane share their arc, so they keep 38 degrees or more apart on the
   wall and never pass through each other. s = fract(phase + 0.22 x A). For
   s < 0.52 a ball rides the wall; then it falls ballistically (constant
   gravity) back onto the pile exactly where its next ride starts, so the
   cycle is seamless. A is frozen at T x 2.5 whenever the story is held.

   The pour (H0) is a column: the balls stream in through the top 0.75
   apart, each one blending into its tumble as it enters.

   Drawn balls: each domain mesh carries two extra instances (odd and even
   draws), so a new ball can fall in while the previous one falls away. A
   drawn ball keeps its domain colour as it drops (the colour, the legend
   chip and the ticket are one chain); a small spark trails it (L4).
   ========================================================================= */

export const TUMBLE = 25
const PER_DOM = 7 // 5 tumbling + 2 drawn
const RIDE = 0.52
const RATE = 0.22
const SPIN = 1.1
const LANES = 4
const DEG = Math.PI / 180
/** per lane: the ride's start and end angles (degrees) and its radius inset */
const LANE_ARC: readonly [number, number, number][] = [
  [-104, 70, 0],
  [-110, 56, 0.12],
  [-100, 84, 0.04],
  [-114, 62, 0.14],
]

interface BallP {
  /** pour order */
  o: number
  phi: number
  z: number
  r: number
  a0: number
  a1: number
  /** the pour column's x */
  cx: number
}

function ballParams(w: World): BallP[] {
  const { R, HL } = w.drum
  const zMax = HL - BALL_R - 0.14
  return Array.from({ length: TUMBLE }, (_, b) => {
    const o = (b * 7) % TUMBLE
    const h = (k: number) => hash1(b * 11 + k)
    const lane = o % LANES
    const [a0, a1, inset] = LANE_ARC[lane]
    return {
      o,
      phi: (o + 0.6 * h(1)) / TUMBLE,
      z: -zMax + (2 * zMax * lane) / (LANES - 1) + (h(2) - 0.5) * 0.06,
      r: R - BALL_R - 0.1 - inset,
      a0: (a0 + 3 * (h(3) - 0.5)) * DEG,
      a1: (a1 + 3 * (h(4) - 0.5)) * DEG,
      cx: (h(5) - 0.5) * 0.5,
    }
  })
}

/** Ball p in the (non-spinning) drum frame at ambient time A, drum-local, into out. */
function tumbleAt(p: BallP, A: number, out: THREE.Vector3): THREE.Vector3 {
  const s = (((p.phi + RATE * A) % 1) + 1) % 1
  if (s < RIDE) {
    const a = p.a0 + ((p.a1 - p.a0) * s) / RIDE
    return out.set(p.r * Math.cos(a), p.r * Math.sin(a), p.z)
  }
  // ballistic: leave the wall with its tangential velocity, land where the next ride starts
  const tau = (s - RIDE) / (1 - RIDE)
  const x1 = p.r * Math.cos(p.a1)
  const y1 = p.r * Math.sin(p.a1)
  const x0 = p.r * Math.cos(p.a0)
  const y0 = p.r * Math.sin(p.a0)
  const omega = (p.a1 - p.a0) / (RIDE / RATE)
  const fall = (1 - RIDE) / RATE
  const vy = omega * p.r * Math.cos(p.a1) * fall
  const g = y1 + vy - y0
  return out.set(x1 + (x0 - x1) * tau, y1 + vy * tau - g * tau * tau, p.z)
}

/** A material whose light, env and rim scale together (focus pull on solids, L3). */
interface Dimmable {
  m: THREE.MeshStandardMaterial
  color: THREE.Color
  emissive: number
  rim: number
}
const dimmable = (m: THREE.MeshStandardMaterial): Dimmable => ({
  m,
  color: m.color.clone(),
  emissive: m.emissiveIntensity,
  rim: (m.userData.rim as { uRimStrength: { value: number } }).uRimStrength.value,
})
function applyDim(d: Dimmable, k: number, env = 1): void {
  d.m.color.copy(d.color).multiplyScalar(k)
  d.m.emissiveIntensity = d.emissive * k
  d.m.envMapIntensity = k * env
  ;(d.m.userData.rim as { uRimStrength: { value: number } }).uRimStrength.value = d.rim * k
}

export interface DrumProps {
  w: World
  /** the ambient clock for the tumble (A plus any spin boost, frozen under reduced motion) */
  ambient: (T: number, A: number) => number
  /** light on the drum and balls, 0..1 (focus pull) */
  dim: (T: number) => number
  /** construction 0..1: hoops drawn, steel in, bars grown (1 in explore) */
  hoops: (T: number) => number
  steel: (T: number) => number
  bars: (T: number) => number
  /** the pour's progress 0..1 (1 once poured, and in explore) */
  pour: (T: number) => number
  /** the schedule and time whose drawn balls fall to the ticket */
  src: (T: number) => { s: Sched; X: number }
  /** board progress 0..1: the drum steps aside for the board (P) */
  board: (T: number) => number
  /** the ticket's notch the drawn ball rests in, world, at T */
  slot: (T: number, out: THREE.Vector3) => void
  /** fade of the whole drum, 0..1 (H6: the chart takes over) */
  opacity: (T: number) => number
}

const _v = new THREE.Vector3()
const _g = new THREE.Vector3()
const _s = new THREE.Vector3()
const _e = new THREE.Euler()
const XF = newDrumXf()
const XF0 = newDrumXf()

export function Drum({ w, ambient, dim, hoops, steel, bars, pour, src, board, slot, opacity }: DrumProps) {
  const { R, HL } = w.drum
  const params = useMemo(() => ballParams(w), [w])

  /* ---------------------------- steel ---------------------------- */
  const torus = useMemo(() => new THREE.TorusGeometry(R, 0.13, 14, 112), [R])
  const bar = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.06, 0.06, 1, 10, 1, true)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  // the back wheel: a hub and spokes, so the drum reads as a cage that turns
  const spoke = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.045, 0.045, 1, 8, 1, true)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  const hub = useMemo(() => new THREE.TorusGeometry(0.3, 0.075, 8, 32), [])
  // hoops: B.9 steel (a #91C640 rim); the thin bars, spokes and hub carry a
  // faint chalk rim instead, so at grazing angles they read as steel, not moss
  // (a touch smoother than B.9's 0.28, so the softboxes stay crisp streaks on the thin tubes of a phone)
  const steelMat = useMemo(() => makeRimStandard({ ...steelOpts, roughness: 0.22, transparent: true, opacity: 0 }), [])
  const barMat = useMemo(() => makeRimStandard({ ...steelOpts, rim: PAL.chalk, rimStrength: 0.04, transparent: true, opacity: 0 }), [])
  const steelD = useMemo(() => dimmable(steelMat), [steelMat])
  const barD = useMemo(() => dimmable(barMat), [barMat])
  useEffect(() => () => torus.dispose(), [torus])
  useEffect(() => () => bar.dispose(), [bar])
  useEffect(() => () => spoke.dispose(), [spoke])
  useEffect(() => () => hub.dispose(), [hub])
  useEffect(() => () => steelMat.dispose(), [steelMat])
  useEffect(() => () => barMat.dispose(), [barMat])

  const outer = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  useSafeFrame(
    'hopper drum',
    (T, A) => {
      const g = outer.current
      const sg = spin.current
      if (!g || !sg) return
      const xf = drumXf(w, board(T), XF)
      g.position.set(xf.x, xf.y, xf.z)
      g.rotation.set(0, w.drum.yaw, 0)
      g.scale.setScalar(xf.s)
      sg.rotation.z = SPIN * ambient(T, A)
      const k = dim(T)
      const op = opacity(T)
      g.visible = op > 0.004
      // polished steel lives on its reflections: the engine's softboxes, a
      // little stronger than the default so the hoops read as metal on a phone
      applyDim(steelD, k, 2.8)
      applyDim(barD, k, 2.4)
      steelMat.opacity = steel(T) * op
      barMat.opacity = steel(T) * op
    },
    { hide: outer },
  )

  const hoopZ = [HL, 0, -HL]
  const N_BARS = 12
  const N_SPOKES = 8

  /* ---------------------------- balls ---------------------------- */
  const ballGeo = useMemo(() => new THREE.IcosahedronGeometry(BALL_R, 2), [])
  const ballMats = useMemo(() => HOPPER_DOMAINS.map((d) => makeRimStandard({ ...ballOpts(d.color), transparent: true })), [])
  const ballD = useMemo(() => ballMats.map(dimmable), [ballMats])
  useEffect(() => () => ballGeo.dispose(), [ballGeo])
  useEffect(() => () => ballMats.forEach((m) => m.dispose()), [ballMats])
  useSafeFrame('hopper balls light', (T) => {
    const k = dim(T)
    for (const d of ballD) applyDim(d, k)
  })

  /** The gate (where a drawn ball leaves the drum), world, at T. */
  const gateAt = (T: number, out: THREE.Vector3) => {
    const k = board(T)
    const xf = drumXf(w, k, XF0)
    const a = k < 0.5 ? w.gate[0] : w.gate[1]
    const r = R - BALL_R - 0.1
    return drumToWorld(xf, r * Math.cos(a), r * Math.sin(a), HL * 0.45, out)
  }

  /** The drawn ball's path at u (0..1 of its drop): out of the gate, an arc down into the ticket's notch. */
  const pathAt = (T: number, u: number, pos: THREE.Vector3) => {
    slot(T, _s)
    const gx = gateAt(T, _v)
    const fall = Math.min(1, u / 0.78)
    const hop = u > 0.78 ? 0.2 * Math.sin((Math.PI * (u - 0.78)) / 0.22) : 0
    return pos.set(gx.x + (_s.x - gx.x) * ease.settle(fall), gx.y + (_s.y - gx.y) * fall * fall + hop, gx.z + (_s.z - gx.z) * fall)
  }

  /** Drawn ball j (0 odd, 1 even) of domain dm: its position into pos, and its scale (0 = none). */
  const drawnAt = (T: number, dm: number, j: number, pos: THREE.Vector3): number => {
    const { s, X } = src(T)
    // the latest draw of this parity and domain whose ball has left the drum
    for (let d = s.n - 1; d >= 0; d--) {
      if (d % 2 !== j || s.run.dom[d] !== dm) continue
      const b0 = s.ball0[d]
      if (!(b0 <= X)) continue
      const u = win(X, b0, s.ball1[d])
      // it leaves the slot when the next ticket starts to turn
      const nx = d + 1 < s.n ? s.flip0[d + 1] : Infinity
      const gone = win(X, nx, nx + 0.09)
      if (gone >= 1) return 0
      if (u < 1) {
        pathAt(T, u, pos)
        // it rolls out of the gate: from 40% to full size over the first tenth
        return 0.4 + 0.6 * ease.settle(Math.min(1, u / 0.1))
      }
      slot(T, _s)
      pos.set(_s.x, _s.y - 2.6 * gone * gone, _s.z + 0.4 * gone)
      return 1 - gone
    }
    return 0
  }

  const placeBall = (dm: number) => (T: number, i: number, pos: THREE.Vector3, _q: THREE.Quaternion, sc: THREE.Vector3) => {
    if (i < 5) {
      const p = params[dm * 5 + i]
      const xf = drumXf(w, board(T), XF)
      const pp = pour(T)
      tumbleAt(p, ambient(T, clock.A), pos)
      if (pp < 1) {
        // the column: ball o enters 0.75 below the one before it
        const yTop = R + 2.4
        const yIn = 0.25 * R
        const g = (0.75 * 0.62) / (yTop - yIn)
        const kb = (1 + (TUMBLE - 1) * g) * pp - g * p.o
        if (kb <= 0) return false
        if (kb < 0.62) pos.set(p.cx, yTop - ((yTop - yIn) * kb) / 0.62, p.z)
        else {
          const e = ease.settle((kb - 0.62) / 0.38)
          if (e < 1) pos.set(p.cx + (pos.x - p.cx) * e, yIn + (pos.y - yIn) * e, pos.z)
        }
      }
      drumToWorld(xf, pos.x, pos.y, pos.z, pos)
      sc.setScalar(xf.s)
      return true
    }
    const s = drawnAt(T, dm, i - 5, pos)
    if (s <= 0) return false
    sc.setScalar(s)
    return true
  }
  const placers = useMemo(
    () => HOPPER_DOMAINS.map((_, dm) => placeBall(dm)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, params, ambient, pour, src, board, slot],
  )

  /* ------------------------ construction pens ------------------------ */
  // the hoops as the pen draws them, at the drum's H0 place (the pens are gone before it moves)
  const circles = useMemo(() => {
    const xf = drumXf(w, 0, newDrumXf())
    return hoopZ.map((z) => {
      const n = 112
      const a = new Float32Array((n + 1) * 3)
      for (let i = 0; i <= n; i++) {
        // start at 12 o'clock and run clockwise (the pen grammar)
        const t = Math.PI / 2 - (i / n) * Math.PI * 2
        drumToWorld(xf, R * Math.cos(t), R * Math.sin(t), z, _g)
        a[i * 3] = _g.x
        a[i * 3 + 1] = _g.y
        a[i * 3 + 2] = _g.z
      }
      return a
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w])

  return (
    <>
      <group ref={outer}>
        <group ref={spin}>
          <Instances
            geometry={torus}
            material={steelMat}
            count={3}
            renderOrder={21}
            place={(T, i, pos) => {
              if (steel(T) <= 0.002) return false
              pos.set(0, 0, hoopZ[i])
              return true
            }}
          />
          <Instances
            geometry={bar}
            material={barMat}
            count={N_BARS}
            renderOrder={21}
            place={(T, i, pos, q, sc) => {
              const g = bars(T) >= 1 ? 1 : stagger(T, 0.18, 0.36, i, N_BARS, 0.5, ease.settle)
              if (g <= 0) return false
              const a = (i / N_BARS) * Math.PI * 2
              pos.set(R * Math.cos(a), R * Math.sin(a), 0)
              q.setFromEuler(_e.set(0, 0, 0))
              sc.set(1, 1, 2 * HL * g)
              return true
            }}
          />
          <Instances
            geometry={spoke}
            material={barMat}
            count={N_SPOKES}
            renderOrder={21}
            place={(T, i, pos, q, sc) => {
              const g = bars(T) >= 1 ? 1 : stagger(T, 0.22, 0.4, i, N_SPOKES, 0.5, ease.settle)
              if (g <= 0) return false
              const a = ((i + 0.5) / N_SPOKES) * Math.PI * 2
              pos.set(0, 0, -HL)
              q.setFromEuler(_e.set(0, 0, a - Math.PI / 2))
              sc.set(1, (R - 0.08) * g, 1)
              return true
            }}
          />
          <Instances
            geometry={hub}
            material={barMat}
            count={1}
            renderOrder={21}
            place={(T, _i, pos, _q, sc) => {
              const g = bars(T) >= 1 ? 1 : stagger(T, 0.22, 0.4, 0, 1, 0, ease.snap)
              if (g <= 0) return false
              pos.set(0, 0, -HL)
              sc.setScalar(g)
              return true
            }}
          />
        </group>
      </group>
      {hoopZ.map((z, i) => (
        <Pen
          key={z}
          points={circles[i]}
          color={i === 0 ? PAL.chalk : '#9aa4a8'}
          width={i === 0 ? PEN.data : PEN.axis}
          head
          hot={i === 0}
          progress={(T) => hoops(T)}
          opacity={(T) => (1 - steel(T)) * (i === 0 ? 0.9 : 0.55) * opacity(T)}
          renderOrder={32}
        />
      ))}
      {HOPPER_DOMAINS.map((d, dm) => (
        <Instances key={d.key} geometry={ballGeo} material={ballMats[dm]} count={PER_DOM} renderOrder={20} place={placers[dm]} opacity={opacity} />
      ))}
      {/* the drawn ball keeps its colour; the heat (the speaking element, L4) is a small spark trailing it */}
      <Glows
        count={2}
        sizePx={16}
        colors={['#f4ffe0']}
        gain={1.8}
        place={(T, j, out) => {
          const { s, X } = src(T)
          for (let d = s.n - 1; d >= 0; d--) {
            if (d % 2 !== j) continue
            const b0 = s.ball0[d]
            if (!(b0 <= X)) continue
            const u = win(X, b0, s.ball1[d])
            if (u >= 1) return 0
            // where the ball was a moment ago, just behind it on its path
            pathAt(T, Math.max(0, u - 0.07), _g)
            out[0] = _g.x
            out[1] = _g.y + BALL_R * 0.35
            out[2] = _g.z + BALL_R * 0.4
            return Math.sin(Math.PI * u) * 0.95
          }
          return 0
        }}
      />
      <BlobShadow
        count={1}
        radius={R * 1.05}
        strength={0.5}
        place={(T, _i, out) => {
          const xf = drumXf(w, board(T), XF0)
          out[0] = xf.x
          out[1] = xf.y - (R + 0.32) * xf.s
          out[2] = xf.z + 0.2 * xf.s
          out[3] = xf.s
          return 0.9 * steel(T) * dim(T) * opacity(T)
        }}
      />
    </>
  )
}
