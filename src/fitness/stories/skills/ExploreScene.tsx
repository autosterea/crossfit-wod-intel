import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL, SKILLS } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useStoryStore } from '../../story/store'
import { useBeat } from '../../story/useBeat'
import { useDragHandle } from '../../story/gestures'
import { useStageHotspot } from '../../story/hotspots'
import { Pen, PEN } from '../../story/kit/Pen'
import { Ripple } from '../../story/kit/Ripple'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import { useLabels, setLabelText, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box, LabelSpec, Tier, V3 } from '../../story/types'
import { EX_DEPTH, LABEL_R, MINI_R, R, SIDE, grid, useWideNames } from './layout'
import { CLASS_COLOR, GENERALIST, N, RANKED, SKILL_COLORS, dirX, dirY, fmtVal, profileOf, weakestIndex } from './skillsMath'
import { Construction, FloorRing, Hatch, Heads, Minis, ProfileSolid, newProfile, px, py, type ConstructionVis, type MiniCell, type MinisVis, type SolidVis } from './radar'
import { CUSTOM, NONE, useSkExplore } from './exploreStore'

/* =========================================================================
   Skills explore scene (DESIGN.md D.2 "Explore", C.12). Not driven by T:
   athlete A is the lit prism (yellow-green for the generalist, chalk for a
   specialist or a Custom shape), athlete B the dashed chalk comparison with
   the gaps hatched, each profile's floor ring at its weakest skill. Every
   vertex of A is a drag handle (radial, 0 to 10 in steps of 0.1; it turns
   A into Custom). Tapping a spoke or its name shows that skill's
   definition. "Grid" lays out all thirteen, sorted by weakest skill, and
   tapping a cell opens that athlete on the wheel.
   ========================================================================= */

const damp = THREE.MathUtils.damp
const G = GENERALIST.profile
const NO_LABELS: LabelSpec[] = []
const OFF: V3 = [1e6, 1e6, 0]
const CELLS: MiniCell[] = RANKED.map((r) => ({ profile: r.profile, floor: r.floor, color: r.isG ? PAL.yellowGreen : PAL.chalk, lit: r.isG }))

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

function useSkillHandles(targetA: readonly number[]) {
  const aRef = useRef(targetA)
  aRef.current = targetA
  for (let i = 0; i < N; i++) {
    // hooks in a fixed-length loop (N is a constant)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDragHandle({
      id: `sk-h-${i}`,
      radiusPx: 22,
      anchor: () => (X.grid > 0.5 || useStoryStore.getState().mode !== 'explore' ? OFF : [px(i, X.a.r[i]), py(i, X.a.r[i]), EX_DEPTH]),
      onStart: () => {
        X.dragging = i
      },
      onDrag: (ray) => {
        if (!ray.intersectPlane(plane, hit)) return
        const v = hit.x * dirX(i) + hit.y * dirY(i)
        useSkExplore.getState().setSkill(i, Math.max(0, Math.min(10, v)), aRef.current)
      },
      onEnd: () => {
        X.dragging = -1
      },
    })
  }
}

function useSkillHotspots() {
  for (let i = 0; i < N; i++) {
    const r = LABEL_R + 0.8
    const x = r * dirX(i)
    const y = r * dirY(i)
    const box: Box = [
      [x - 0.7, y - 0.7, EX_DEPTH],
      [x + 0.7, y + 0.7, EX_DEPTH],
    ]
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStageHotspot(`sk-x-skill-${i}`, {
      box: () => (X.grid < 0.5 ? box : null),
      onActivate: () => {
        const s = useSkExplore.getState()
        s.setInfo(s.info === i ? null : i)
      },
      ariaLabel: `${SKILLS[i].name}: show its definition`,
      modes: 'explore',
    })
  }
}

function useCellHotspots(layout: 'P' | 'L') {
  const gr = grid(layout)
  for (let k = 0; k < RANKED.length; k++) {
    const [x0, y0, x1, y1] = gr.plate(k)
    const box: Box = [
      [x0, y0, 0],
      [x1, y1, 0],
    ]
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStageHotspot(`sk-x-cell-${k}`, {
      box: () => (X.grid > 0.5 ? box : null),
      onActivate: () => {
        const s = useSkExplore.getState()
        s.setAthlete(RANKED[k].name)
        s.setView('wheel')
      },
      ariaLabel: `Open ${RANKED[k].name} on the wheel`,
      modes: 'explore',
    })
  }
}

export default function ExploreScene({ tier }: { tier: Tier }) {
  const { layout } = useBeat()
  const low = tier === 'low'
  const mode = useStoryStore((s) => s.mode)
  const athlete = useSkExplore((s) => s.athlete)
  const compare = useSkExplore((s) => s.compare)
  const custom = useSkExplore((s) => s.custom)
  const view = useSkExplore((s) => s.view)
  const info = useSkExplore((s) => s.info)
  const enter = useSkExplore((s) => s.enter)
  const targetA = athlete === CUSTOM ? custom : profileOf(athlete) ?? G
  const targetB = compare === NONE ? null : profileOf(compare)
  const isGA = athlete === GENERALIST.name
  const floorA = useMemo(() => Math.min(...targetA), [targetA])
  const weakText = useMemo(() => `Weakest skill ${fmtVal(floorA)}`, [floorA])
  const lastB = useRef<readonly number[]>(targetB ?? G)
  if (targetB) lastB.current = targetB

  useEffect(() => {
    X.since = 0
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
  useSkillHotspots()
  useCellHotspots(layout)

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
  const aVis = useMemo<SolidVis>(
    () => ({
      fill: () => 1 - X.grid,
      walls: () => 1 - X.grid,
      outline: () => 1 - X.grid,
      nodes: () => 1 - X.grid,
      depth: () => EX_DEPTH,
      rim: () => 0.75 * X.aG,
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

  const gr = grid(layout)
  const plates = useMemo<PlateSpec[]>(
    () =>
      RANKED.map((r, k) => ({
        rect: gr.plate(k),
        fill: r.isG ? PAL.yellowGreen : PAL.chalk,
        fillAlpha: r.isG ? 0.02 : 0.008,
        line: r.isG ? PAL.yellowGreen : PAL.chalk,
        lineAlpha: r.isG ? 0.32 : 0.06,
      })),
    [gr],
  )
  const minisVis = useMemo<MinisVis>(
    () => ({
      place: (_T, k, out) => {
        const [cx, cy] = gr.center(k)
        out[0] = cx
        out[1] = cy
        return 1
      },
      ring: () => 1,
      opacity: () => X.grid,
      key: () => (layout === 'P' ? 1 : 2),
    }),
    [gr, layout],
  )

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
    out.push({
      id: 'sk-x-weak',
      text: 'Weakest skill 0',
      tone: 'callout',
      color: aColor,
      anchor: () => {
        const k = weakestIndex(X.a.r)
        return [px(k, X.a.r[k]), py(k, X.a.r[k]), EX_DEPTH] as V3
      },
      prefer: 'E',
      gapPx: 14,
      leader: 'always',
      priority: 92,
      cue: () => (X.grid < 0.5 ? 1 : 0),
    })
    out.push({ id: 'sk-x-lg-a', text: athlete, tone: 'legend', color: aColor, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 0, cue: () => (X.grid < 0.5 ? 1 : 0) })
    if (compare !== NONE)
      out.push({ id: 'sk-x-lg-b', text: compare, tone: 'legend', color: PAL.chalk, anchor: [0, 0, 0], pin: 'top-left', pinOrder: 1, cue: () => (X.grid < 0.5 ? X.bOn : 0) })
    RANKED.forEach((r, k) => {
      const [cx, cy] = gr.center(k)
      out.push({
        id: `sk-x-g-${k}`,
        text: wide ? r.name : r.short,
        short: r.short,
        tone: 'name',
        color: r.isG ? PAL.yellowGreen : PAL.chalk,
        dot: false,
        badge: String(r.floor),
        anchor: [cx, cy - MINI_R - 0.12, 0],
        prefer: 'S',
        only: ['S'],
        gapPx: 5,
        priority: 80,
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
        <FloorRing radius={() => X.aFloor} z={EX_DEPTH + 0.03} color={aColor} opacity={() => 1 - X.grid} />
        <Hatch inner={X.b} outer={X.a} color={PAL.chalk} alpha={0.3} opacity={() => X.bOn * (1 - X.grid)} reveal={() => 1} z={EX_DEPTH + 0.01} />
        <Pen points={bPts} color={PAL.chalk} width={PEN.data} dashed dashSize={0.45} gapSize={0.3} update={writeB} opacity={() => 0.95 * X.bOn * (1 - X.grid)} renderOrder={38} />
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
        {/* each drag handle pulses once as explore opens (B.4) */}
        {SKILLS.map((_, i) => (
          <Ripple
            key={i}
            position={() => [px(i, X.a.r[i]), py(i, X.a.r[i]), EX_DEPTH + 0.06] as V3}
            color={SKILL_COLORS[i]}
            sizePx={52}
            k={() => (X.grid < 0.5 ? Math.max(0, Math.min(1, (X.since - 0.35 - 0.04 * i) / 0.6)) : 0)}
          />
        ))}
      </group>
      <Plates
        plates={plates}
        radius={0.35}
        z={-0.08}
        vis={() => 1}
        opacity={() => X.grid}
        renderOrder={4}
      />
      <Minis cells={CELLS} vis={minisVis} low={low} />
    </>
  )
}
