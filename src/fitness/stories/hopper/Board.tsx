import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { HOPPER_DOMAINS, PAL } from '../../fitnessData'
import { ease } from '../../story/ease'
import { Instances } from '../../story/kit/Instances'
import { PenBatch, Pen, PEN } from '../../story/kit/Pen'
import { Glows } from '../../story/kit/Halo'
import { ballOpts, makeRimStandard } from '../../story/kit/materials'
import { BD, BH, boardPx, slotY, type World } from './layout'
import { registry } from '../../story/labels/registry'
import { boardAt, win, type Board as BoardT, type Sched } from './timeline'
import { GEN, N_ATH, type Run } from './hopperMath'
import { hash1 } from '../../story/rng'

/* =========================================================================
   The board (DESIGN.md D.3 "Rails", "Bricks", "Draw animation"): six rails,
   one per rank slot, and on each athlete's rail a bar of 3D bricks laid end
   to end, one brick per draw, coloured by the DRAWN domain and as long as
   that athlete's points x k(T). Bricks fly from the ticket to the bar's
   end, land and stretch (snap); the rails re-sort by rank, a rising rail
   lifting toward the camera and swelling a little so it passes in front.
   The rail scale k(T) = 0.9 railLen / max(400, leaderTotal(T)) is
   continuous, so bars grow while the scale settles. At the end of H5 (and
   in explore) each rail's bricks regroup into five domain bands, so the
   bands show where each total came from.
   ========================================================================= */

/** far away: where a hidden pen segment waits (never a zero-length dot) */
const AWAY = 1e5
const CUBE = 0.36
/** how much a rising rail's bricks swell at mid-pass of a default pass (height and depth; the H4 climb swells more) */
export const SWELL = 0.16

/** The bar end (tip) of athlete a: every brick that has landed, stretched to its length. */
export function tipOf(_s: Sched, _X: number, b: BoardT, a: number): number {
  return b.landed[a] * b.k
}

/** The gap between bricks: a hairline on big bricks, none once they are thin slivers (the H5 bands). */
const gapOf = (len: number) => Math.max(0, Math.min(0.045, 0.12 * (len - 0.2)))

export const railY = (w: World, b: BoardT, a: number) => slotY(w, b.rankPos[a])

/**
 * Brick (d, a) at time X: writes the instance and returns false while it
 * has not left the ticket. `from` is the ticket's launch point.
 */
export function placeBrick(w: World, s: Sched, X: number, b: BoardT, d: number, a: number, from: THREE.Vector3, pos: THREE.Vector3, sc: THREE.Vector3): boolean {
  if (d >= s.n) return false
  const i = d * N_ATH + a
  const f0 = s.fly0[i]
  if (!(f0 <= X)) return false
  const run: Run = s.run
  const k = b.k
  const g = s.group(X, a, run.dom[d])
  const off = g <= 0 ? run.prefix[d * N_ATH + a] : g >= 1 ? b.grp[i] : run.prefix[d * N_ATH + a] + (b.grp[i] - run.prefix[d * N_ATH + a]) * g
  const x0 = w.rails.x0 + k * off
  const L = k * run.pts[i]
  const gp = gapOf(L)
  const y = railY(w, b, a)
  // while the bricks regroup into domain bands they lift forward and pass over one another
  const z = b.lift[a] + (g > 0 && g < 1 ? Math.sin(Math.PI * g) * (0.18 + 0.3 * hash1(d * 7 + a)) : 0)
  const fly = ease.settle(win(X, f0, s.fly1[i]))
  if (fly < 1) {
    const cube = Math.min(CUBE, Math.max(0.12, L))
    const tx = x0 + gp / 2 + cube / 2
    pos.set(from.x + (tx - from.x) * fly, from.y + (y - from.y) * fly, from.z + (z - from.z) * fly + 1.1 * Math.sin(Math.PI * fly))
    const sz = 0.55 + 0.45 * fly
    sc.set(cube, BH * sz, BD * sz)
    return true
  }
  const st = ease.snap(win(X, s.str0[i], s.str1[i]))
  const cube = Math.min(CUBE, Math.max(0.12, L))
  const len = Math.max(0.01, cube + (L - gp - cube) * st)
  const sw = 1 + SWELL * b.pop[a]
  pos.set(x0 + gp / 2 + len / 2, y, z)
  sc.set(len, BH * sw, BD * sw)
  return true
}

export interface BricksProps {
  w: World
  /** five materials, one per domain (useBrickMaterials, shared by the story and explore sets) */
  mats: THREE.MeshStandardMaterial[]
  src: (T: number) => { s: Sched; X: number; story: boolean }
  /** the run whose draws these bricks show (their domains pick the meshes) */
  run: Run
  /** draws of that run the meshes are sized for */
  draws: number
  /** the athletes this set shows (default all): H6 fades the four rails behind P1 and P2 as their own set */
  athletes?: readonly number[]
  /** whole-set opacity (0 hides it and skips its per-frame work) */
  opacity: (T: number) => number
  /** where bricks leave from (the ticket, or the flick card) */
  launch: (T: number, out: THREE.Vector3) => void
}

const _from = new THREE.Vector3()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

/** The brick materials: the ball material in each domain colour (the bricks ARE the drawn tasks). */
export function useBrickMaterials(): THREE.MeshStandardMaterial[] {
  const mats = useMemo(
    () => HOPPER_DOMAINS.map((d) => makeRimStandard({ ...ballOpts(d.color), roughness: 0.32, emissiveIntensity: 0.3, transparent: true })),
    [],
  )
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  return mats
}

/**
 * Every brick of a set, computed once per frame key (story time, explore
 * time, schedule version, the rails) into flat arrays, so
 * the five domain meshes only read them, and a held frame (or an idle
 * explore board) recomputes nothing.
 */
interface Field {
  /** the run these bricks show (a replaced run takes a fresh field: no stale key can match) */
  run: Run
  pos: Float32Array
  scl: Float32Array
  on: Uint8Array
  key: Float64Array
  /** the brick indices (d * N_ATH + a) this set shows, in draw order */
  idx: Int32Array
}

/**
 * One brick per (draw, athlete), grouped into five meshes by the DRAWN
 * domain, each in that domain's ball material: five draw calls for the
 * whole set, the domain colour exact and lit like the balls.
 */
export function Bricks({ w, mats, src, run, draws, athletes, opacity, launch }: BricksProps) {
  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, 0.12), [])
  useEffect(() => () => geo.dispose(), [geo])
  const n = Math.min(draws, run.n)
  // the bricks of each domain (d * N_ATH + a), in draw order
  const lists = useMemo(() => {
    const l: number[][] = HOPPER_DOMAINS.map(() => [])
    for (let d = 0; d < n; d++) for (let a = 0; a < N_ATH; a++) if (!athletes || athletes.includes(a)) l[run.dom[d]].push(d * N_ATH + a)
    return l.map((x) => Int32Array.from(x))
  }, [run, n, athletes])
  const field = useMemo<Field>(() => {
    const idx: number[] = []
    for (let d = 0; d < n; d++) for (let a = 0; a < N_ATH; a++) if (!athletes || athletes.includes(a)) idx.push(d * N_ATH + a)
    return {
      run,
      pos: new Float32Array(n * N_ATH * 3),
      scl: new Float32Array(n * N_ATH * 3),
      on: new Uint8Array(n * N_ATH),
      key: new Float64Array(6).fill(NaN),
      idx: Int32Array.from(idx),
    }
  }, [run, n, athletes])

  /** the field at T (recomputed only when its key changes); false when the source is another run */
  const ensure = (T: number): boolean => {
    const { s, X } = src(T)
    if (s.run !== run) return false
    // the launch point is a function of T (the ticket's place), so T keys it too
    const k = field.key
    if (k[0] === T && k[1] === X && k[2] === s.version && k[3] === w.rails.len && k[4] === w.rails.pitch && k[5] === w.rails.x0) return true
    k[0] = T
    k[1] = X
    k[2] = s.version
    k[3] = w.rails.len
    k[4] = w.rails.pitch
    k[5] = w.rails.x0
    launch(T, _from)
    const b = boardAt(s, X, w.rails.len)
    const { pos, scl, on, idx } = field
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j]
      const d = (i / N_ATH) | 0
      const a = i - d * N_ATH
      if (!placeBrick(w, s, X, b, d, a, _from, _p, _s)) {
        on[i] = 0
        continue
      }
      on[i] = 1
      pos[i * 3] = _p.x
      pos[i * 3 + 1] = _p.y
      pos[i * 3 + 2] = _p.z
      scl[i * 3] = _s.x
      scl[i * 3 + 1] = _s.y
      scl[i * 3 + 2] = _s.z
    }
    return true
  }
  const placers = useMemo(
    () =>
      lists.map((list) => (T: number, j: number, pos: THREE.Vector3, _q: THREE.Quaternion, sc: THREE.Vector3) => {
        if (!ensure(T)) return false
        const i = list[j]
        if (!field.on[i]) return false
        pos.set(field.pos[i * 3], field.pos[i * 3 + 1], field.pos[i * 3 + 2])
        sc.set(field.scl[i * 3], field.scl[i * 3 + 1], field.scl[i * 3 + 2])
        return true
      }),
    // ensure reads src / launch / w through the latest render's closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lists, field, w, src, launch],
  )
  return (
    <>
      {HOPPER_DOMAINS.map((dmn, dm) => (
        <Instances key={dmn.key} geometry={geo} material={mats[dm]} count={lists[dm].length} opacity={opacity} renderOrder={22} place={placers[dm]} />
      ))}
    </>
  )
}

const _bp = new THREE.Vector3()
const _bs = new THREE.Vector3()
const _bf = new THREE.Vector3()

/**
 * A light rides the brick bound for the draw's leader (H2 to H4, explore's
 * single draws): it rises as the brick flies and fades as it lands and
 * stretches. It is the one speaking HDR element of that moment (L4); the
 * other five bricks fly unlit by it.
 */
export function BrickLights({ w, src, launch }: { w: World; src: BricksProps['src']; launch: BricksProps['launch'] }) {
  return (
    <Glows
      count={1}
      sizePx={36}
      colors={['#f4ffe0']}
      gain={1.9}
      place={(T, _j, out) => {
        const { s, X } = src(T)
        const b = boardAt(s, X, w.rails.len)
        for (let d = b.started - 1; d >= 0 && d >= b.started - 2; d--) {
          if (s.kind[d] !== 0) continue
          const a = s.run.leader[d + 1]
          const i = d * N_ATH + a
          const f0 = s.fly0[i]
          const e = s.str1[i]
          if (!(f0 <= X) || X >= e) continue
          launch(T, _bf)
          if (!placeBrick(w, s, X, b, d, a, _bf, _bp, _bs)) continue
          out[0] = _bp.x + _bs.x / 2
          out[1] = _bp.y
          out[2] = _bp.z + BD / 2 + 0.05
          return Math.sin(Math.PI * win(X, f0, e))
        }
        return 0
      }}
    />
  )
}

/* ------------------------------ rails ------------------------------ */

export interface RailsProps {
  w: World
  /** draw-on progress of rail slot k (0..1) */
  draw: (T: number, k: number) => number
  /** resting light 0..1 (chalk 25% at 1) */
  dim: (T: number) => number
  opacity: (T: number) => number
  /** the light at a drawing tip (0: none, e.g. while rails retract) */
  tips?: (T: number) => number
}

/** Six rails, one per rank slot: one PenBatch (chalk 25%), drawn on with a stagger and a light at each tip. */
export function Rails({ w, draw, dim, opacity, tips }: RailsProps) {
  const segs = useMemo(() => new Float32Array(6 * 6).fill(AWAY), [])
  // the last inputs written (six progresses, x0, len, pitch): numbers, never a string key per frame
  const last = useMemo(() => new Float64Array(9).fill(NaN), [])
  const z = -BD / 2 - 0.04
  const write = (T: number, s: Float32Array): boolean => {
    let same = last[6] === w.rails.x0 && last[7] === w.rails.len && last[8] === w.rails.pitch
    for (let k = 0; k < 6; k++) {
      const p = draw(T, k)
      if (p !== last[k]) {
        same = false
        last[k] = p
      }
    }
    if (same) return false
    last[6] = w.rails.x0
    last[7] = w.rails.len
    last[8] = w.rails.pitch
    for (let k = 0; k < 6; k++) {
      const p = last[k]
      const o = k * 6
      if (p <= 0.001) {
        s.fill(AWAY, o, o + 6)
        continue
      }
      const y = slotY(w, k)
      s[o] = w.rails.x0
      s[o + 1] = y
      s[o + 2] = z
      s[o + 3] = w.rails.x0 + w.rails.len * p
      s[o + 4] = y
      s[o + 5] = z
    }
    return true
  }
  return (
    <>
      <PenBatch segments={segs} color={PAL.chalk} width={PEN.axis} update={write} dim={(T) => 0.3 * dim(T)} opacity={opacity} renderOrder={30} />
      <Glows
        count={6}
        sizePx={22}
        colors={['#f4ffe0']}
        gain={2.2}
        place={(T, k, out) => {
          const p = draw(T, k)
          out[0] = w.rails.x0 + w.rails.len * p
          out[1] = slotY(w, k)
          out[2] = z
          return p > 0 && p < 1 ? Math.min(1, 4 * Math.min(p, 1 - p)) * opacity(T) * (tips ? tips(T) : 1) : 0
        }}
      />
    </>
  )
}

/* ------------------------------ ticks ------------------------------ */

const NAME_IDS = Array.from({ length: N_ATH }, (_, a) => 'hop-n-' + a)
/** a tick: its centre over the bar's top, its size, and how far its top reaches over the bar's top (world) */
const TICK_Y = 0.22
const TICK_S = 0.28
export const TICK_TOP = TICK_Y + 0.55 * TICK_S

/**
 * Where the tick of draw d sits, world, into out (x, y, z): over its top
 * scorer's brick, near the brick's start (the middle of a short brick);
 * when the athlete's name (over the rail's far end) reaches over the
 * brick, the tick slides left to clear it, never off the brick.
 */
export function tickAt(w: World, s: Sched, b: BoardT, d: number, out: Float64Array): Float64Array {
  const a = s.run.top[d]
  const i = d * N_ATH + a
  const x0 = w.rails.x0 + b.k * s.run.prefix[i]
  const L = b.k * s.run.pts[i]
  out[0] = x0 + Math.min(L / 2, 0.32)
  const e = registry.get(NAME_IDS[a])
  if (e && e.w > 0 && boardPx.unit > 0) {
    // the name sits NW of the rail's end (gap 5 px): its left edge, less the tick's reach and a little air
    const clear = w.rails.x0 + w.rails.len - (3.6 + e.w + 7) / boardPx.unit - 0.2
    if (out[0] > clear) out[0] = Math.max(x0 + Math.min(L / 2, 0.17), clear)
  }
  out[1] = railY(w, b, a) + BH / 2 + TICK_Y
  out[2] = b.lift[a] + BD / 2
  return out
}
const TK = new Float64Array(3)

/**
 * H3 and H4: after a draw's bricks land, a small #91C640 tick appears above
 * the brick of that draw's top scorer (they win the draw, not the tally).
 * Draw 1's tick lands first, as H3 opens, and the unknown draw (H4) keeps
 * the rule, so every draw shows its winner.
 */
export function Ticks({ w, src, opacity }: { w: World; src: BricksProps['src']; opacity: (T: number) => number }) {
  const MAX = 5
  const segs = useMemo(() => new Float32Array(MAX * 2 * 6).fill(AWAY), [])
  const last = useMemo(() => new Float64Array(5).fill(NaN), [])
  const write = (T: number, out: Float32Array): boolean => {
    const { s, X } = src(T)
    if (last[0] === X && last[1] === s.version && last[2] === w.rails.len && last[3] === w.rails.pitch && last[4] === boardPx.unit) return false
    last[0] = X
    last[1] = s.version
    last[2] = w.rails.len
    last[3] = w.rails.pitch
    last[4] = boardPx.unit
    const b = boardAt(s, X, w.rails.len)
    out.fill(AWAY)
    let n = 0
    for (let d = 0; d < s.n && n < MAX; d++) {
      const t0 = s.tick0[d]
      if (!(t0 <= X)) continue
      const g = ease.snap(win(X, t0, s.tick1[d]))
      // not yet grown: nothing (a zero-length segment would draw a dot)
      if (g <= 0.001) continue
      tickAt(w, s, b, d, TK)
      const cx = TK[0]
      const cy = TK[1]
      const z = TK[2]
      const sz = TICK_S * g
      // a check mark: short stroke down-right, long stroke up-right
      const ax = cx - 0.5 * sz
      const ay = cy + 0.05 * sz
      const bx = cx - 0.1 * sz
      const by = cy - 0.35 * sz
      const ex = cx + 0.6 * sz
      const ey = cy + 0.55 * sz
      const o = n * 12
      out[o] = ax
      out[o + 1] = ay
      out[o + 2] = z
      out[o + 3] = out[o + 6] = bx
      out[o + 4] = out[o + 7] = by
      out[o + 5] = out[o + 8] = z
      out[o + 9] = ex
      out[o + 10] = ey
      out[o + 11] = z
      n++
    }
    return true
  }
  return <PenBatch segments={segs} color={PAL.yellowGreen} width={PEN.data} update={write} opacity={opacity} gain={() => 1.15} renderOrder={34} />
}

/* ------------------------------ the impact (H4) ------------------------------ */

/** A line of light along the top of the Generalist's bar as it takes P1 (the chapter's impact accent). */
export function GeneralistFlare({ w, src, k }: { w: World; src: BricksProps['src']; k: (T: number) => number }) {
  const pts = useMemo(() => new Float32Array(2 * 3), [])
  const last = useMemo(() => new Float64Array(3).fill(NaN), [])
  const update = (T: number, p: Float32Array): boolean => {
    if (k(T) <= 0) return false
    const { s, X } = src(T)
    const b = boardAt(s, X, w.rails.len)
    const tip = tipOf(s, X, b, GEN)
    const y = railY(w, b, GEN) + BH / 2 + 0.02
    const z = b.lift[GEN] + BD / 2 + 0.02
    if (last[0] === tip && last[1] === y && last[2] === z) return false
    last[0] = tip
    last[1] = y
    last[2] = z
    p[0] = w.rails.x0
    p[1] = p[4] = y
    p[2] = p[5] = z
    p[3] = w.rails.x0 + Math.max(0.05, tip)
    return true
  }
  return <Pen points={pts} color={PAL.yellowGreen} width={PEN.data} update={update} opacity={k} gain={(T) => 1 + 2.6 * k(T)} renderOrder={36} />
}

/* ------------------------------ the lead becomes the chart (H6) ------------------------------ */

export interface LeadBracketProps {
  w: World
  src: BricksProps['src']
  /** the leader and the runner-up whose bars the bracket compares */
  p1: number
  p2: number
  /** the bracket's draw-on (0..1) and its swing into the chart (0..1) */
  draw: (T: number) => number
  swing: (T: number) => number
  opacity: (T: number) => number
  /** the guide's fade (0..1) */
  guide: (T: number) => number
  /** where the swing ends: the chart's zero and the lead at draw 40, world */
  chartBase: THREE.Vector3
  chartTop: THREE.Vector3
}

/** The bracket's ends on the board: runner-up's bar end x, leader's bar end x, the stroke's y, the guide's top y, z. */
export function bracketEnds(w: World, src: BricksProps['src'], p1: number, p2: number, T: number, out: Float64Array): Float64Array {
  const { s, X } = src(T)
  const b = boardAt(s, X, w.rails.len)
  out[0] = w.rails.x0 + tipOf(s, X, b, p2)
  out[1] = w.rails.x0 + tipOf(s, X, b, p1)
  // just under the leader's bar, clear of the names over the rails' far ends
  out[2] = railY(w, b, p1) - BH / 2 - 0.16
  out[3] = railY(w, b, p2) + BH / 2 + 0.04
  out[4] = BD / 2 + 0.06
  return out
}

/**
 * H6 opens on the board: a dashed chalk guide rises from the runner-up's
 * bar end to the leader's bar, and a yellow-green stroke under the leader's
 * bar measures how far it runs past (the lead, in the bars' own units). As the camera
 * turns to the chart, that stroke swings upright into the chart and stands
 * at draw 40 from zero to the lead: this run's line then draws up to it.
 */
export function LeadBracket({ w, src, p1, p2, draw, swing, opacity, guide, chartBase, chartTop }: LeadBracketProps) {
  const lead = useMemo(() => new Float32Array(2 * 3), [])
  const guidePts = useMemo(() => new Float32Array(2 * 3), [])
  const lastL = useMemo(() => new Float64Array(5).fill(NaN), [])
  const lastG = useMemo(() => new Float64Array(2).fill(NaN), [])
  const E = useMemo(() => new Float64Array(5), [])
  const writeLead = (T: number, p: Float32Array): boolean => {
    const m = swing(T)
    if (lastL[0] === T && lastL[1] === m && lastL[2] === chartTop.x && lastL[3] === chartTop.y && lastL[4] === w.rails.len) return false
    lastL[0] = T
    lastL[1] = m
    lastL[2] = chartTop.x
    lastL[3] = chartTop.y
    lastL[4] = w.rails.len
    bracketEnds(w, src, p1, p2, T, E)
    // from the runner-up's length to the leader's, under the leader's bar ...
    const ax = E[0]
    const ay = E[2]
    const bx = E[1]
    const by = E[2]
    const z = E[4]
    // ... swinging upright into the chart: zero to the lead at draw 40
    p[0] = ax + (chartBase.x - ax) * m
    p[1] = ay + (chartBase.y - ay) * m
    p[2] = z + (chartBase.z - z) * m
    p[3] = bx + (chartTop.x - bx) * m
    p[4] = by + (chartTop.y - by) * m
    p[5] = z + (chartTop.z - z) * m
    return true
  }
  const writeGuide = (T: number, p: Float32Array): boolean => {
    if (lastG[0] === T && lastG[1] === w.rails.len) return false
    lastG[0] = T
    lastG[1] = w.rails.len
    bracketEnds(w, src, p1, p2, T, E)
    p[0] = E[0]
    p[1] = E[3]
    p[2] = E[4]
    p[3] = E[0]
    p[4] = E[2]
    p[5] = E[4]
    return true
  }
  return (
    <>
      <Pen
        points={guidePts}
        color={PAL.chalk}
        width={PEN.axis}
        dashed
        dashSize={0.12}
        gapSize={0.1}
        update={writeGuide}
        progress={(T) => Math.min(1, draw(T) * 2.2)}
        opacity={(T) => 0.7 * guide(T) * opacity(T)}
        renderOrder={35}
      />
      <Pen
        points={lead}
        color={PAL.yellowGreen}
        width={PEN.hero}
        update={writeLead}
        head
        hot
        progress={(T) => Math.max(0, Math.min(1, (draw(T) - 0.4) / 0.6))}
        opacity={opacity}
        renderOrder={45}
      />
    </>
  )
}
