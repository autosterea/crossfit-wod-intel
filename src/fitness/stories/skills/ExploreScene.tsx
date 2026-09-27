import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PAL, SKILLS } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useDragHandle } from '../../story/gestures'
import { useStageHotspot } from '../../story/hotspots'
import { focusRect } from '../../story/camera/focusRect'
import { registry } from '../../story/labels/registry'
import { Pen, PEN } from '../../story/kit/Pen'
import { Glows } from '../../story/kit/Halo'
import { Ripple } from '../../story/kit/Ripple'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import { useLabels, setLabelText, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box, LabelSpec, Layout, Tier, V3 } from '../../story/types'
import { ELBOW_R, EX_DEPTH, EX_TAG, LABEL_R, R, RING_OUT, SIDE, grid, useGridKind, useWideNames, type GridKind } from './layout'
import { CLASS_COLOR, GENERALIST, N, RANKED, SKILL_COLORS, dirX, dirY, fmtVal, profileOf } from './skillsMath'
import { Construction, FloorRing, Hatch, Heads, Minis, ProfileSolid, newProfile, px, py, type ConstructionVis, type MiniCell, type MinisVis, type SolidVis } from './radar'
import { LEAD_N, pillH, pillW, tagEnd, tagPoint, writeLeader } from './tags'
import { CUSTOM, NONE, useSkExplore } from './exploreStore'

/* =========================================================================
   Skills explore scene (DESIGN.md D.2 "Explore", C.12). Not driven by T:
   athlete A is the lit prism (yellow-green for the generalist, chalk for a
   specialist or a Custom shape) with its floor ring at its weakest skill,
   athlete B the dashed chalk comparison with the gaps hatched. Every
   vertex of A is a drag handle (radial, 0 to 10 in steps of 0.1; it turns
   A into Custom). Tapping a skill's name, or its vertex without dragging,
   shows its definition. "Grid" lays out all thirteen, sorted by weakest
   skill, with A's cell outlined; tapping a cell opens that athlete on the
   wheel. On a phone with the sheet expanded the grid is the two-column list
   (layout.ts gridKind), so every name always has room.

   The "Weakest skill N" callout sits in the free space off the wheel (the
   band under it on a phone, a corner in landscape), like the story's tags,
   with a leader to the floor ring; every vertex ON the floor is lit, so a
   tie reads as a tie and no single skill is implied.
   ========================================================================= */

const damp = THREE.MathUtils.damp
const G = GENERALIST.profile
const NO_LABELS: LabelSpec[] = []
const OFF: V3 = [1e6, 1e6, 0]
const CELLS: MiniCell[] = RANKED.map((r) => ({ profile: r.profile, floor: r.floor, color: r.isG ? PAL.yellowGreen : PAL.chalk, lit: r.isG }))
/** the widest text the floor callout can show: its pill size is reserved from it */
const WEAK_MAX = 'Weakest skill 10.0'
const TAG_Z = EX_DEPTH

/** Damped explore state, shared by every explore element this frame. */
const X = {
  a: newProfile(),
  b: newProfile(),
  /** B's presence 0..1 */
  bOn: 0,
  /** wheel 0 .. grid 1 */
  grid: 0,
  /** A is the generalist (yellow-green) 0..1 */
  aG: 1,
  /** floor ring radii (damped with the profiles) */
  aFloor: 7,
  /** the tapped skill's highlight 0..1, per skill */
  info: new Float32Array(N),
  /** seconds since explore opened (the handles pulse once) */
  since: 99,
  /** a vertex being dragged follows the finger at once */
  dragging: -1,
  v: 0,
}

const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -EX_DEPTH)
const hit = new THREE.Vector3()
/** per-vertex scratch points (handle anchors and ripple positions), so no callback allocates */
const handleAt: [number, number, number][] = Array.from({ length: N }, () => [0, 0, 0])
const rippleAt: [number, number, number][] = Array.from({ length: N }, () => [0, 0, 0])

/** The drag handle's reach (px): inside it the handle wins over a name's tap target ... */
const HANDLE_PX = 22
/** ... except where a name's centre needs the room: the handle always keeps this core (the dot and a thumb around it). */
const CORE_PX = 14
/** A press that travels less than this is a tap (the skill's definition), not a drag. */
const SLOP_PX = 7
/** The press in progress on a vertex handle. */
const press = { on: false, moved: false, sx: 0, sy: 0, v0: 0, a0: 0 }

function useSkillHandles(targetA: readonly number[]) {
  const aRef = useRef(targetA)
  aRef.current = targetA
  for (let i = 0; i < N; i++) {
    // hooks in a fixed-length loop (N is a constant)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDragHandle({
      id: `sk-h-${i}`,
      radiusPx: HANDLE_PX,
      anchor: () => {
        if (X.grid > 0.5 || useStoryStore.getState().mode !== 'explore') return OFF
        const o = handleAt[i]
        o[0] = px(i, X.a.r[i])
        o[1] = py(i, X.a.r[i])
        o[2] = EX_DEPTH
        return o
      },
      onStart: () => {
        press.on = false
        press.moved = false
      },
      // A press on a vertex does nothing until it travels SLOP_PX; then the
      // vertex follows the finger's radial motion from where it was (it
      // never jumps to the finger). A press that never travels is a tap:
      // it shows the skill's definition, like a tap on its name, and never
      // turns the athlete into Custom.
      onDrag: (ray, ndc) => {
        if (!ray.intersectPlane(plane, hit)) return
        const v = hit.x * dirX(i) + hit.y * dirY(i)
        const sx = ((ndc[0] + 1) / 2) * focusRect.W
        const sy = ((1 - ndc[1]) / 2) * focusRect.H
        if (!press.on) {
          press.on = true
          press.sx = sx
          press.sy = sy
          press.v0 = v
          press.a0 = aRef.current[i]
          return
        }
        if (!press.moved) {
          if (Math.hypot(sx - press.sx, sy - press.sy) < SLOP_PX) return
          press.moved = true
          X.dragging = i
        }
        useSkExplore.getState().setSkill(i, Math.max(0, Math.min(10, press.a0 + v - press.v0)), aRef.current)
      },
      onEnd: () => {
        if (press.on && !press.moved) {
          const s = useSkExplore.getState()
          s.setInfo(s.info === i ? null : i)
        }
        press.on = false
        press.moved = false
        X.dragging = -1
      },
    })
  }
}

/* ---------------------- tap a name for its definition --------------------- */

const _p = new THREE.Vector3()
const _o = new THREE.Vector3()
const _d = new THREE.Vector3()
/** A world box written in place. */
type MutBox = [[number, number, number], [number, number, number]]
/** per-skill hotspot boxes, rewritten in place every frame (no allocation) */
const hotBoxes: MutBox[] = Array.from({ length: N }, (): MutBox => [
  [0, 0, EX_DEPTH],
  [0, 0, EX_DEPTH],
])
/** A screen rect (stage px), written in place. */
interface Rc {
  x0: number
  y0: number
  x1: number
  y1: number
}
const rc = (): Rc => ({ x0: 0, y0: 0, x1: 0, y1: 0 })
/** the name's placed rect, the grown base, three cut candidates and the pick */
const nameR = rc()
const baseR = rc()
const cand: Rc[] = [rc(), rc(), rc(), rc()]
/** a name's centre counts as tappable only this far inside a target (px): a finger on an edge is a coin toss */
const MARGIN = 5
/** the smallest tap target, px */
const TARGET = 44

/** Grow r to TARGET px in each axis, on the side away from the vertex (vx, vy). */
function growAway(r: Rc, vx: number, vy: number): void {
  const nx = TARGET - (r.x1 - r.x0)
  if (nx > 0) {
    if (vx <= (r.x0 + r.x1) / 2) r.x1 += nx
    else r.x0 -= nx
  }
  const ny = TARGET - (r.y1 - r.y0)
  if (ny > 0) {
    if (vy <= (r.y0 + r.y1) / 2) r.y1 += ny
    else r.y0 -= ny
  }
}
const copyRc = (to: Rc, from: Rc) => {
  to.x0 = from.x0
  to.y0 = from.y0
  to.x1 = from.x1
  to.y1 = from.y1
}
const SX = 5
const SY = 3
/** the handle's disc as it stands against target t: its full reach, less whatever t took */
const inDisc = (x: number, y: number, vx: number, vy: number, t: Rc, pad: number) =>
  Math.hypot(x - vx, y - vy) <= HANDLE_PX - pad && !(x >= t.x0 && x <= t.x1 && y >= t.y0 && y <= t.y1)
const inRect = (x: number, y: number, t: Rc, pad: number) => x >= t.x0 + pad && x <= t.x1 - pad && y >= t.y0 + pad && y <= t.y1 - pad
/**
 * How much of the NAME a finger can use for its definition with target t:
 * sample points over the name rect covered by t or by the vertex handle's
 * disc (a tap there shows the definition too). The name's centre dominates,
 * and it only counts when it is MARGIN px inside one of them.
 */
function coverage(t: Rc, vx: number, vy: number): number {
  const n = nameR
  let s = 0
  for (let a = 0; a <= SX; a++)
    for (let b = 0; b <= SY; b++) {
      const x = n.x0 + ((n.x1 - n.x0) * a) / SX
      const y = n.y0 + ((n.y1 - n.y0) * b) / SY
      if (inRect(x, y, t, 0) || inDisc(x, y, vx, vy, t, 0.5)) s++
    }
  const cx = (n.x0 + n.x1) / 2
  const cy = (n.y0 + n.y1) / 2
  if (inRect(cx, cy, t, MARGIN) || inDisc(cx, cy, vx, vy, t, MARGIN)) s += 100
  return s
}

/** Unproject stage px (sx, sy) onto the plane z = EX_DEPTH; widen box b to hold it. */
function widen(cam: THREE.Camera, sx: number, sy: number, b: MutBox, first: boolean): void {
  _o.setFromMatrixPosition(cam.matrixWorld)
  _d.set((sx / focusRect.W) * 2 - 1, 1 - (sy / focusRect.H) * 2, 0.5).unproject(cam).sub(_o)
  const t = Math.abs(_d.z) > 1e-9 ? (EX_DEPTH - _o.z) / _d.z : 0
  const x = _o.x + _d.x * t
  const y = _o.y + _d.y * t
  if (first || x < b[0][0]) b[0][0] = x
  if (first || y < b[0][1]) b[0][1] = y
  if (first || x > b[1][0]) b[1][0] = x
  if (first || y > b[1][1]) b[1][1] = y
}

/**
 * The tap target of skill i's name: the name's PLACED rect (wherever the
 * placer put it: radial, or the tangent fallback of a side name on a
 * phone), grown to 44 px away from the skill's vertex. The vertex's drag
 * handle wins inside its 22 px disc (and a tap there shows the definition
 * too), so when the vertex sits close under its name (a rating near 10) the
 * target is cut back out of the disc: along x, along y, or at the corner
 * facing the name, whichever leaves the most of the name tappable. Only
 * when the name's centre sits just past the disc (a side name on a phone
 * with its vertex at 10) may the corner reach into the disc, so the centre
 * is safely inside it; the handle then keeps a 14 px core around its dot.
 * Returned as a world box on the name plane, so the engine's hotspot
 * button lands on the same pixels.
 */
function skillHotBox(i: number, cam: THREE.Camera | null): Box | null {
  if (!cam || X.grid >= 0.5) return null
  const e = registry.get(`sk-x-n-${i}`)
  if (!e || !e.visible || !e.live || e.rect.w <= 0) return null
  const n = nameR
  n.x0 = e.rect.x
  n.y0 = e.rect.y
  n.x1 = e.rect.x + e.rect.w
  n.y1 = e.rect.y + e.rect.h
  cam.updateMatrixWorld()
  // the vertex handle of this skill, in stage px
  _p.set(px(i, X.a.r[i]), py(i, X.a.r[i]), EX_DEPTH).project(cam)
  const vx = ((_p.x + 1) / 2) * focusRect.W
  const vy = ((1 - _p.y) / 2) * focusRect.H
  const keep = HANDLE_PX
  const ncx = (n.x0 + n.x1) / 2
  const ncy = (n.y0 + n.y1) / 2
  const g = baseR
  copyRc(g, n)
  growAway(g, vx, vy)
  let pick = g
  const dx = Math.max(g.x0 - vx, 0, vx - g.x1)
  const dy = Math.max(g.y0 - vy, 0, vy - g.y1)
  if (Math.hypot(dx, dy) < keep) {
    const gcx = (g.x0 + g.x1) / 2
    const gcy = (g.y0 + g.y1) / 2
    // 0: a vertical cut, 1: a horizontal cut
    const a = cand[0]
    copyRc(a, g)
    if (vx <= gcx) a.x0 = Math.max(g.x0, vx + keep)
    else a.x1 = Math.min(g.x1, vx - keep)
    const b = cand[1]
    copyRc(b, g)
    if (vy <= gcy) b.y0 = Math.max(g.y0, vy + keep)
    else b.y1 = Math.min(g.y1, vy - keep)
    // 2: the quadrant beyond the disc, toward the name's centre
    const c = cand[2]
    copyRc(c, g)
    let ux = ncx - vx
    let uy = ncy - vy
    const ul = Math.hypot(ux, uy) || 1
    ux /= ul
    uy /= ul
    const qx = vx + keep * ux
    const qy = vy + keep * uy
    if (ux >= 0) c.x0 = Math.max(g.x0, qx)
    else c.x1 = Math.min(g.x1, qx)
    if (uy >= 0) c.y0 = Math.max(g.y0, qy)
    else c.y1 = Math.min(g.y1, qy)
    // 3: the same corner pulled in so the name's centre sits MARGIN + 1 px
    // inside it, as long as the handle keeps its CORE_PX (a name centred
    // just past the disc, e.g. a side name on a phone with its vertex at 10)
    const d = cand[3]
    copyRc(d, g)
    let mx = ncx - (ux >= 0 ? 1 : -1) * (MARGIN + 1)
    let my = ncy - (uy >= 0 ? 1 : -1) * (MARGIN + 1)
    const md = Math.hypot(mx - vx, my - vy)
    if (md < CORE_PX) {
      // slide the corner back out along its line from the vertex to the core
      mx = vx + ((mx - vx) * CORE_PX) / (md || 1)
      my = vy + ((my - vy) * CORE_PX) / (md || 1)
    }
    if (ux >= 0) d.x0 = Math.max(g.x0, Math.min(qx, mx))
    else d.x1 = Math.min(g.x1, Math.max(qx, mx))
    if (uy >= 0) d.y0 = Math.max(g.y0, Math.min(qy, my))
    else d.y1 = Math.min(g.y1, Math.max(qy, my))
    let best = -1
    let bestArea = -1
    for (let k = 0; k < 4; k++) {
      const t = cand[k]
      growAway(t, vx, vy)
      const s = coverage(t, vx, vy)
      const area = (t.x1 - t.x0) * (t.y1 - t.y0)
      if (s > best || (s === best && area > bestArea)) {
        best = s
        bestArea = area
        pick = t
      }
    }
  }
  const box = hotBoxes[i]
  widen(cam, pick.x0, pick.y0, box, true)
  widen(cam, pick.x1, pick.y0, box, false)
  widen(cam, pick.x1, pick.y1, box, false)
  widen(cam, pick.x0, pick.y1, box, false)
  return box
}

function useSkillHotspots(cam: THREE.Camera) {
  const camRef = useRef<THREE.Camera | null>(cam)
  camRef.current = cam
  for (let i = 0; i < N; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStageHotspot(`sk-x-skill-${i}`, {
      box: () => skillHotBox(i, camRef.current),
      onActivate: () => {
        const s = useSkExplore.getState()
        s.setInfo(s.info === i ? null : i)
      },
      ariaLabel: `${SKILLS[i].name}: show its definition`,
      modes: 'explore',
    })
  }
}

function useCellHotspots(kind: GridKind) {
  const gr = grid(kind)
  for (let k = 0; k < RANKED.length; k++) {
    const [x0, y0, x1, y1] = gr.plate(k)
    const box: Box = [
      [x0, y0, 0],
      [x1, y1, 0],
    ]
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStageHotspot(`sk-x-cell-${k}`, {
      box: () => (X.grid > 0.5 ? box : null),
      onActivate: () => useSkExplore.getState().pickAthlete(RANKED[k].name),
      ariaLabel: `Open ${RANKED[k].name} on the wheel`,
      modes: 'explore',
    })
  }
}

/** The floor tag's leader: from A's floor ring out through a name gap to the callout. */
function FloorLeader({ layout, color }: { layout: Layout; color: string }) {
  const pts = useMemo(() => new Float32Array(LEAD_N * 3), [])
  const st = useMemo(() => ({ a: [0, 0, 0] as [number, number, number], b: [0, 0, 0] as [number, number, number], key: new Float64Array(5).fill(Number.NaN) }), [])
  const write = (_T: number, p: Float32Array): boolean => {
    if (X.grid > 0.99) return false
    const spec = EX_TAG[layout]
    const ang = (spec.from * Math.PI) / 180
    st.a[0] = X.aFloor * Math.cos(ang)
    st.a[1] = X.aFloor * Math.sin(ang)
    st.a[2] = EX_DEPTH + 0.03
    tagEnd(spec.slot, WEAK_MAX, spec.end, TAG_Z, RING_OUT, st.b)
    const K = st.key
    const lk = layout === 'P' ? 0 : 1
    if (K[0] === st.a[0] && K[1] === st.a[1] && K[2] === st.b[0] && K[3] === st.b[1] && K[4] === lk) return false
    K[0] = st.a[0]
    K[1] = st.a[1]
    K[2] = st.b[0]
    K[3] = st.b[1]
    K[4] = lk
    writeLeader(p, st.a, st.b, spec.elbow, ELBOW_R[layout], spec.slot[0] === 'T')
    return true
  }
  return <Pen points={pts} color={color} width={PEN.grid + 0.25} update={write} opacity={() => 1 - X.grid} dim={() => 0.8} renderOrder={36} />
}

export default function ExploreScene({ tier }: { tier: Tier }) {
  const { layout } = useBeat()
  const kind = useGridKind()
  const camera = useThree((st) => st.camera)
  const low = tier === 'low'
  const mode = useStoryStore((s) => s.mode)
  const athlete = useSkExplore((s) => s.athlete)
  const compare = useSkExplore((s) => s.compare)
  const custom = useSkExplore((s) => s.custom)
  const view = useSkExplore((s) => s.view)
  const info = useSkExplore((s) => s.info)
  const enter = useSkExplore((s) => s.enter)
  const targetA = athlete === CUSTOM ? custom : profileOf(athlete) ?? G
  // a comparison with itself says nothing: B hides while it is A
  const targetB = compare === NONE || compare === athlete ? null : profileOf(compare)
  const isGA = athlete === GENERALIST.name
  const floorA = useMemo(() => Math.min(...targetA), [targetA])
  const weakText = useMemo(() => `Weakest skill ${fmtVal(floorA)}`, [floorA])
  const lastB = useRef<readonly number[]>(targetB ?? G)
  if (targetB) lastB.current = targetB
  const cellA = RANKED.findIndex((r) => r.name === athlete)

  useEffect(() => {
    // under reduced motion nothing autoplays: the handles skip their entrance pulse
    X.since = useStoryStore.getState().reduced ? 99 : 0
  }, [enter])
  // entering explore snaps the damped state to the chosen profiles (no morph from stale values)
  useEffect(() => {
    if (mode !== 'explore') return
    for (let i = 0; i < N; i++) {
      X.a.r[i] = targetA[i]
      X.b.r[i] = lastB.current[i]
    }
    X.bOn = targetB ? 1 : 0
    X.grid = view === 'grid' ? 1 : 0
    X.aG = isGA ? 1 : 0
    X.aFloor = floorA
    X.a.v++
    X.b.v++
    X.v++
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useSafeFrame(
    'skills explore state',
    (_T, _A, dtRaw) => {
      if (useStoryStore.getState().mode !== 'explore') return
      const dt = Math.min(0.05, dtRaw)
      let moved = false
      for (let i = 0; i < N; i++) {
        const va = X.dragging === i ? targetA[i] : damp(X.a.r[i], targetA[i], 10, dt)
        if (Math.abs(va - X.a.r[i]) > 1e-4) {
          X.a.r[i] = va
          moved = true
        } else if (X.a.r[i] !== targetA[i] && Math.abs(va - targetA[i]) < 1e-4) {
          X.a.r[i] = targetA[i]
          moved = true
        }
      }
      if (moved) X.a.v++
      let movedB = false
      const tb = lastB.current
      for (let i = 0; i < N; i++) {
        const vb = damp(X.b.r[i], tb[i], 10, dt)
        if (Math.abs(vb - X.b.r[i]) > 1e-4) {
          X.b.r[i] = vb
          movedB = true
        }
      }
      if (movedB) X.b.v++
      X.bOn = damp(X.bOn, targetB ? 1 : 0, 9, dt)
      X.grid = damp(X.grid, view === 'grid' ? 1 : 0, 8, dt)
      X.aG = damp(X.aG, isGA ? 1 : 0, 9, dt)
      X.aFloor = damp(X.aFloor, floorA, 10, dt)
      for (let i = 0; i < N; i++) X.info[i] = damp(X.info[i], info === i ? 1 : 0, 10, dt)
      X.since += dt
      X.v++
    },
    { priority: -2 },
  )

  useSkillHandles(targetA)
  useSkillHotspots(camera)
  useCellHotspots(kind)

  const constructionVis = useMemo<ConstructionVis>(
    () => ({
      rings: () => 1,
      ringOpacity: () => 0.2 * (1 - X.grid),
      spoke: () => 1,
      spokeOpacity: () => 0.3 * (1 - X.grid),
      tickOpacity: () => 0.3 * (1 - X.grid),
      classK: () => 1,
      classOpacity: () => 0.55 * (1 - X.grid),
      key: () => 1,
      colors: SKILL_COLORS,
    }),
    [],
  )
  // With a comparison up, A's light steps back to the S4 ghost level (fill
  // 15%, no walls, no rim) so the gaps hatch in the same clean colour of
  // loss as the story; A's outline and nodes (the handles) still carry A.
  const aVis = useMemo<SolidVis>(
    () => ({
      fill: () => (1 - X.grid) * (1 - 0.85 * X.bOn),
      walls: () => (1 - X.grid) * (1 - X.bOn),
      outline: () => 1 - X.grid,
      nodes: () => 1 - X.grid,
      depth: () => EX_DEPTH,
      rim: () => 0.75 * X.aG * (1 - X.bOn),
    }),
    [],
  )
  // A's colour follows who A is: yellow-green only for the generalist (L8)
  const aColor = isGA ? PAL.yellowGreen : PAL.chalk

  const bPts = useMemo(() => new Float32Array((N + 1) * 3), [])
  const lastBv = useRef(-1)
  const writeB = (_T: number, pts: Float32Array): boolean => {
    if (X.b.v === lastBv.current) return false
    lastBv.current = X.b.v
    for (let k = 0; k <= N; k++) {
      const i = k % N
      pts[k * 3] = px(i, X.b.r[i])
      pts[k * 3 + 1] = py(i, X.b.r[i])
      pts[k * 3 + 2] = EX_DEPTH + 0.05
    }
    return true
  }

  // the tapped skill: its spoke is drawn in light in its class colour
  const spokeLines = useMemo(
    () =>
      SKILLS.map((_, i) => {
        const a = new Float32Array(6)
        a.set([0, 0, EX_DEPTH + 0.04, px(i, R), py(i, R), EX_DEPTH + 0.04])
        return a
      }),
    [],
  )

  const gr = grid(kind)
  const plates = useMemo<PlateSpec[]>(
    () =>
      RANKED.map((r, k) => ({
        rect: gr.plate(k),
        fill: r.isG ? PAL.yellowGreen : PAL.chalk,
        fillAlpha: r.isG ? 0.022 : 0.01,
        line: r.isG ? PAL.yellowGreen : PAL.chalk,
        lineAlpha: r.isG ? 0.36 : 0.05,
      })),
    [gr],
  )
  const minisVis = useMemo<MinisVis>(
    () => ({
      place: (_T, k, out) => {
        out[0] = gr.cx[k]
        out[1] = gr.cy[k]
        return 1
      },
      ring: () => 1,
      opacity: () => X.grid,
      key: () => (gr.kind === 'P' ? 1 : gr.kind === 'L' ? 2 : 3),
    }),
    [gr],
  )

  // Grid: A's own cell is outlined (the chips and the grid agree on who A is)
  const selPts = useMemo(() => new Float32Array(5 * 3), [])
  const selKey = useRef(Number.NaN)
  const writeSel = (_T: number, p: Float32Array): boolean => {
    const key = (gr.kind === 'P' ? 0 : gr.kind === 'L' ? 100 : 200) + cellA
    if (key === selKey.current) return false
    selKey.current = key
    const [x0, y0, x1, y1] = cellA >= 0 ? gr.plate(cellA) : [0, 0, 0, 0]
    const e = 0.18
    const c = [x0 - e, y0 - e, x1 + e, y0 - e, x1 + e, y1 + e, x0 - e, y1 + e, x0 - e, y0 - e]
    for (let k = 0; k < 5; k++) {
      p[k * 3] = c[k * 2]
      p[k * 3 + 1] = c[k * 2 + 1]
      p[k * 3 + 2] = 0.02
    }
    return true
  }

  // labels (explore only)
  const wide = useWideNames()
  const specs = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = []
    SKILLS.forEach((s, i) => {
      out.push({
        id: `sk-x-n-${i}`,
        text: s.name,
        tone: 'name',
        color: CLASS_COLOR[s.classification],
        anchor: [LABEL_R * dirX(i), LABEL_R * dirY(i), EX_DEPTH],
        prefer: layout === 'P' && SIDE[i] ? SIDE[i].P : 'radial',
        only: SIDE[i]?.only,
        center: [0, 0, EX_DEPTH],
        gapPx: 4,
        priority: 70,
        cue: () => (X.grid < 0.5 ? 1 : 0),
      })
    })
    // the floor callout, in the free space off the wheel (its leader: FloorLeader)
    const tagBuf: [number, number, number] = [0, 0, 0]
    out.push({
      id: 'sk-x-weak',
      text: 'Weakest skill 0',
      tone: 'callout',
      color: aColor,
      anchor: () => tagPoint(EX_TAG[layout].slot, pillW(WEAK_MAX), pillH(), TAG_Z, RING_OUT, tagBuf),
      prefer: 'C',
      only: ['C', 'N', 'S'],
      priority: 92,
      cue: () => (X.grid < 0.5 ? 1 : 0),
    })
    out.push({ id: 'sk-x-lg-a', text: athlete, tone: 'legend', color: aColor, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 0, cue: () => (X.grid < 0.5 ? 1 : 0) })
    if (compare !== NONE && compare !== athlete)
      out.push({ id: 'sk-x-lg-b', text: compare, tone: 'legend', color: PAL.chalk, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 1, cue: () => (X.grid < 0.5 ? X.bOn : 0) })
    // the lineup's names are the point of the Grid: every one is required
    // (QA fails on a hidden name) and kept clear of its neighbours
    RANKED.forEach((r, k) => {
      const [nx, ny] = gr.nameAt(k)
      out.push({
        id: `sk-x-g-${k}`,
        text: wide ? r.name : r.short,
        short: r.short,
        tone: 'name',
        color: r.isG ? PAL.yellowGreen : PAL.chalk,
        dot: false,
        badge: String(r.floor),
        anchor: [nx, ny, 0],
        prefer: gr.nameDir,
        only: [gr.nameDir],
        gapPx: gr.nameDir === 'E' ? 5 : 3,
        sepPx: 3,
        priority: 80,
        required: true,
        cue: () => (X.grid > 0.5 ? 1 : 0),
      })
    })
    out.push({ id: 'sk-x-lg-sort', text: 'SORTED BY WEAKEST SKILL', tone: 'legend', color: PAL.yellowGreen, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 2, dot: false, cue: () => (X.grid > 0.5 ? 1 : 0) })
    return out
  }, [athlete, compare, aColor, gr, layout, wide])
  useLabels(mode === 'explore' ? specs : NO_LABELS, { mode: 'explore' })

  // the weakest-skill callout counts with the live (dragged) profile
  useSafeFrame('skills explore readout', () => {
    if (useStoryStore.getState().mode !== 'explore') return
    setLabelText('sk-x-weak', weakText)
  })

  const obstacle = useMemo<WorldObstacle>(
    () => ({
      mode: 'explore',
      maxPoints: 2 * N,
      radiusPx: 6,
      points: (_T, out) => {
        if (X.grid > 0.5) return 0
        let n = 0
        for (let i = 0; i < N; i++) {
          out[n * 3] = px(i, X.a.r[i])
          out[n * 3 + 1] = py(i, X.a.r[i])
          out[n * 3 + 2] = EX_DEPTH
          n++
          if (X.bOn > 0.5) {
            out[n * 3] = px(i, X.b.r[i])
            out[n * 3 + 1] = py(i, X.b.r[i])
            out[n * 3 + 2] = EX_DEPTH
            n++
          }
        }
        return n
      },
    }),
    [],
  )
  useWorldObstacle('sk-x-data', obstacle)

  return (
    <>
      <group>
        <Construction vis={constructionVis} />
        <ProfileSolid src={X.a} color={aColor} nodeColors={SKILL_COLORS} nodeRadius={layout === 'P' ? 0.4 : 0.27} vis={aVis} low={low} />
        <FloorRing radius={() => X.aFloor} z={EX_DEPTH + 0.03} color={aColor} opacity={() => 1 - X.grid} keyline />
        <FloorLeader layout={layout} color={aColor} />
        {/* every vertex on the floor is lit (a tie shows as a tie) */}
        <Glows
          count={N}
          sizePx={24}
          colors={['#e9ffc4']}
          gain={1}
          place={(_T, i, out) => {
            out[0] = px(i, X.a.r[i])
            out[1] = py(i, X.a.r[i])
            out[2] = EX_DEPTH + 0.06
            let lo = X.a.r[0]
            for (let j = 1; j < N; j++) if (X.a.r[j] < lo) lo = X.a.r[j]
            return X.a.r[i] - lo < 0.05 ? 0.75 * (1 - X.grid) : 0
          }}
        />
        {/* the gaps where B falls short of A, hatched in the colour of loss (as in the story) */}
        <Hatch inner={X.b} outer={X.a} color={PAL.sick} alpha={0.34} opacity={() => X.bOn * (1 - X.grid)} reveal={() => 1} z={EX_DEPTH + 0.01} />
        <Pen points={bPts} color={PAL.chalk} width={3.5} dashed dashSize={0.5} gapSize={0.3} update={writeB} opacity={() => X.bOn * (1 - X.grid)} renderOrder={38} />
        {spokeLines.map((pts, i) => (
          <Pen key={i} points={pts} color={SKILL_COLORS[i]} width={PEN.data + 1} opacity={() => X.info[i] * (1 - X.grid)} gain={() => 1.6} renderOrder={39} />
        ))}
        <Heads
          count={N}
          tint={PAL.chalk}
          hot={false}
          place={(_T, i, out) => {
            out[0] = px(i, R)
            out[1] = py(i, R)
            out[2] = EX_DEPTH + 0.06
            return X.info[i] * (1 - X.grid)
          }}
        />
        {/* each drag handle pulses once as explore opens (B.4); never under reduced motion */}
        {SKILLS.map((_, i) => (
          <Ripple
            key={i}
            position={() => {
              const o = rippleAt[i]
              o[0] = px(i, X.a.r[i])
              o[1] = py(i, X.a.r[i])
              o[2] = EX_DEPTH + 0.06
              return o
            }}
            color={SKILL_COLORS[i]}
            sizePx={52}
            k={() => (X.grid < 0.5 && !useStoryStore.getState().reduced ? Math.max(0, Math.min(1, (X.since - 0.35 - 0.04 * i) / 0.6)) : 0)}
          />
        ))}
      </group>
      <Plates plates={plates} radius={0.35} z={-0.08} vis={() => 1} opacity={() => X.grid} renderOrder={4} />
      <Minis cells={CELLS} vis={minisVis} low={low} />
      <Pen points={selPts} color={isGA ? PAL.yellowGreen : PAL.chalk} width={PEN.axis} update={writeSel} opacity={() => (cellA >= 0 ? X.grid : 0)} renderOrder={33} />
    </>
  )
}
