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
import { BALL_R, type World } from './layout'
import { win, type Sched } from './timeline'

/* =========================================================================
   The hopper drum (DESIGN.md D.3 "Parts", "Tumble"): three steel hoops and
   twelve bars (PBR steel against the engine's procedural environment), 25
   task balls (5 domains x 5 tasks, ball material in the domain colours)
   and a soft blob shadow. The drum's spin axis points at the camera.

   Tumble (ambient, deterministic): drum angle = 1.1 x A. Ball i has a phase
   and a lane from hash1(i); s = fract(phase + 0.22 x A). For s < 0.55 it
   rides the wall from about -110 degrees up to 35 + 30 x hash degrees; then
   it falls ballistically (a parabola, constant gravity) back onto the pile
   exactly where its next ride starts, so the cycle is seamless. A is frozen
   at T x 2.5 whenever the story is held, so a deep link is exact.

   Drawn balls: each domain mesh carries two extra instances (odd and even
   draws), so a new ball can fall in while the previous one falls away.
   ========================================================================= */

export const TUMBLE = 25
const PER_DOM = 7 // 5 tumbling + 2 drawn
const RIDE = 0.52
const RATE = 0.22
const SPIN = 1.1

interface BallP {
  phi: number
  z: number
  r: number
  a0: number
  a1: number
  sx: number
  sy: number
}

function ballParams(w: World): BallP[] {
  const { R, HL } = w.drum
  return Array.from({ length: TUMBLE }, (_, i) => ({
    phi: hash1(i * 7 + 1),
    z: (hash1(i * 7 + 2) * 2 - 1) * (HL - BALL_R - 0.12),
    r: R - BALL_R - 0.08 - 0.34 * hash1(i * 7 + 3),
    a0: THREE.MathUtils.degToRad(-96 - 44 * hash1(i * 7 + 4)),
    a1: THREE.MathUtils.degToRad(26 + 84 * hash1(i * 7 + 5)),
    sx: (hash1(i * 7 + 6) - 0.5) * 1.6,
    sy: R + 1.6 + 1.2 * hash1(i * 7 + 7),
  }))
}

/** Ball i in the drum at ambient time A (world position into out). */
function tumbleAt(p: BallP, w: World, A: number, out: THREE.Vector3): void {
  const c = w.drum.c
  const s = (((p.phi + RATE * A) % 1) + 1) % 1
  if (s < RIDE) {
    const a = p.a0 + ((p.a1 - p.a0) * s) / RIDE
    out.set(c[0] + p.r * Math.cos(a), c[1] + p.r * Math.sin(a), p.z)
    return
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
  out.set(c[0] + x1 + (x0 - x1) * tau, c[1] + y1 + vy * tau - g * tau * tau, p.z)
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
  /** the ambient clock for the tumble (A plus any spin boost) */
  ambient: (T: number, A: number) => number
  /** light on the drum and balls, 0..1 (focus pull, the H6 step back) */
  dim: (T: number) => number
  /** construction 0..1: hoops drawn, steel in, bars grown, balls poured (1 in explore) */
  hoops: (T: number) => number
  steel: (T: number) => number
  bars: (T: number) => number
  pour: (T: number) => number
  /** the schedule and time whose drawn balls fall to the ticket */
  src: (T: number) => { s: Sched; X: number }
  /** the drum's scale about its lowest point (the phone board steps it back) */
  scale: (T: number) => number
  /** fade of the whole drum, 0..1 (H6: the chart takes over) */
  opacity: (T: number) => number
}

const _v = new THREE.Vector3()
const _g = new THREE.Vector3()
const _gate = new THREE.Vector3()
const _e = new THREE.Euler()

export function Drum({ w, ambient, dim, hoops, steel, bars, pour, src, scale, opacity }: DrumProps) {
  const { c, R, HL } = w.drum
  const pivotY = c[1] - R
  /** world point p of the unscaled drum, moved to the drum at scale k */
  const xf = (p: THREE.Vector3, k: number) => {
    if (k === 1) return p
    return p.set(c[0] + (p.x - c[0]) * k, pivotY + (p.y - pivotY) * k, p.z * k)
  }
  const params = useMemo(() => ballParams(w), [w])

  /* ---------------------------- steel ---------------------------- */
  const torus = useMemo(() => new THREE.TorusGeometry(R, 0.11, 10, 96), [R])
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
  const steelMat = useMemo(() => makeRimStandard({ ...steelOpts, transparent: true, opacity: 0 }), [])
  const steelD = useMemo(() => dimmable(steelMat), [steelMat])
  useEffect(() => () => torus.dispose(), [torus])
  useEffect(() => () => bar.dispose(), [bar])
  useEffect(() => () => spoke.dispose(), [spoke])
  useEffect(() => () => hub.dispose(), [hub])
  useEffect(() => () => steelMat.dispose(), [steelMat])

  const drum = useRef<THREE.Group>(null)
  useSafeFrame('hopper drum', (T, A) => {
    const g = drum.current
    if (!g) return
    g.rotation.z = SPIN * ambient(T, A)
    const sk = scale(T)
    g.scale.setScalar(sk)
    g.position.set(c[0], pivotY + R * sk, 0)
    const k = dim(T)
    const op = opacity(T)
    g.visible = op > 0.004
    // polished steel lives on its reflections: the engine's softboxes, a
    // little stronger than the default so the hoops read as metal on a phone
    applyDim(steelD, k, 1.9)
    steelMat.opacity = steel(T) * op
  }, { hide: drum })

  const hoopZ = [HL, 0, -HL]
  const N_BARS = 12
  const N_SPOKES = 8

  /* ---------------------------- balls ---------------------------- */
  const ballGeo = useMemo(() => new THREE.IcosahedronGeometry(BALL_R, 3), [])
  const ballMats = useMemo(() => HOPPER_DOMAINS.map((d) => makeRimStandard({ ...ballOpts(d.color), transparent: true })), [])
  const ballD = useMemo(() => ballMats.map(dimmable), [ballMats])
  useEffect(() => () => ballGeo.dispose(), [ballGeo])
  useEffect(() => () => ballMats.forEach((m) => m.dispose()), [ballMats])
  useSafeFrame('hopper balls light', (T) => {
    const k = dim(T)
    for (const d of ballD) applyDim(d, k)
  })
  const ballOp = (T: number) => opacity(T)

  /** Drawn ball j (0 odd, 1 even) of domain dm: its position, or false. */
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
      const gx = xf(_gate.set(w.gate[0], w.gate[1], w.gate[2]), scale(T))
      const sl = w.slot
      if (u < 1) {
        const fall = Math.min(1, u / 0.78)
        const hop = u > 0.78 ? 0.2 * Math.sin((Math.PI * (u - 0.78)) / 0.22) : 0
        pos.set(
          gx.x + (sl[0] - gx.x) * ease.settle(fall),
          gx.y + (sl[1] - gx.y) * fall * fall + hop,
          gx.z + (sl[2] - gx.z) * fall,
        )
        return 1
      }
      pos.set(sl[0], sl[1] - 2.6 * gone * gone, sl[2] + 0.4 * gone)
      return 1 - gone
    }
    return 0
  }

  const placeBall = (dm: number) => (T: number, i: number, pos: THREE.Vector3, _q: THREE.Quaternion, sc: THREE.Vector3) => {
    if (i < 5) {
      const b = dm * 5 + i
      const p = params[b]
      const k = pour(T) >= 1 ? 1 : stagger(T, 0.35, 0.8, b, TUMBLE, 0.36)
      if (k <= 0) return false
      tumbleAt(p, w, ambient(T, clock.A), pos)
      if (k < 1) {
        const e = k * k
        _v.set(c[0] + p.sx, c[1] + p.sy, p.z)
        pos.lerpVectors(_v, pos, e)
      }
      const sk = scale(T)
      xf(pos, sk)
      sc.setScalar(sk)
      return true
    }
    const s = drawnAt(T, dm, i - 5, pos)
    if (s <= 0) return false
    sc.setScalar(s)
    return true
  }
  const placers = useMemo(() => HOPPER_DOMAINS.map((_, dm) => placeBall(dm)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, params, ambient, pour, src, scale],
  )

  /* ------------------------ construction pens ------------------------ */
  const circles = useMemo(
    () =>
      hoopZ.map((z) => {
        const n = 96
        const a = new Float32Array((n + 1) * 3)
        for (let i = 0; i <= n; i++) {
          // start at 12 o'clock and run clockwise (the pen grammar)
          const t = Math.PI / 2 - (i / n) * Math.PI * 2
          a[i * 3] = c[0] + R * Math.cos(t)
          a[i * 3 + 1] = c[1] + R * Math.sin(t)
          a[i * 3 + 2] = z
        }
        return a
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c[0], c[1], R, HL],
  )

  return (
    <>
      <group ref={drum} position={[c[0], c[1], 0]}>
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
          material={steelMat}
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
          material={steelMat}
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
          material={steelMat}
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
        <Instances key={d.key} geometry={ballGeo} material={ballMats[dm]} count={PER_DOM} renderOrder={20} place={placers[dm]} opacity={ballOp} />
      ))}
      {/* the drawn ball is the speaking element while it drops (L4): a glint rides it */}
      <Glows
        count={2}
        sizePx={40}
        colors={['#f4ffe0']}
        gain={1.7}
        place={(T, j, out) => {
          const { s, X } = src(T)
          for (let d = s.n - 1; d >= 0; d--) {
            if (d % 2 !== j) continue
            const b0 = s.ball0[d]
            if (!(b0 <= X)) continue
            const u = win(X, b0, s.ball1[d])
            if (u >= 1) return 0
            drawnAt(T, s.run.dom[d], j, _g)
            out[0] = _g.x
            out[1] = _g.y
            out[2] = _g.z + BALL_R
            return Math.sin(Math.PI * u) * 0.9
          }
          return 0
        }}
      />
      <BlobShadow
        count={1}
        radius={R * 1.05}
        strength={0.5}
        place={(T, _i, out) => {
          const sk = scale(T)
          out[0] = c[0]
          out[1] = pivotY - 0.32 * sk
          out[2] = 0.2 * sk
          out[3] = sk
          return 0.9 * steel(T) * dim(T) * opacity(T)
        }}
      />
    </>
  )
}

