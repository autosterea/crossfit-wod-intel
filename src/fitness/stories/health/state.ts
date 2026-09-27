import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useStoryStore } from '../../story/store'
import { NA, ND, LIFELONG, gridFor } from './healthMath'
import { INDEPENDENCE_LINE } from './layout'
import { useHealthExplore, profileByName } from './exploreStore'
import {
  B,
  G,
  GL,
  GS,
  ageSliceAge,
  ageSliceOn,
  blendAt,
  edgeDraw,
  fuse,
  ghostIn,
  planeOn,
  planeCap,
  pourGhost,
  pourLevel,
  scanAge,
  scanOn,
  sheetOn,
  lostOutline,
  beforeOutline,
  planeFrame,
  planeFill,
  OUTLINE_SWITCH,
  curtainOn,
  hatchK,
  reclaimWalls,
  ridgePen,
  xrayOn,
  fuseWalls,
  glassK,
  GLASS_OP,
  meanAt,
  MEANS,
  solidEdge,
  wallRim,
  wallsOn,
  writeBlend,
  type Blend,
} from './timeline'
import { at, focus } from '../../story/cue'

/* =========================================================================
   The chapter's per-frame state (one writer, many readers). In story mode
   every field is a pure function of T (timeline.ts); in explore mode the
   fields damp toward the explore store (C.12). It runs at priority -5, so
   every kit element (priority 0) reads this frame's values. Labels run
   earlier (-80) and never read it in story mode: their anchors use the pure
   capAt(T, u, age) instead.
   ========================================================================= */

const N = ND * NA

export const HS = {
  explore: false,
  /** the displayed capacity grid and a version that bumps when it changes */
  grid: G[GL].slice(),
  gridVer: 1,
  /** the isoline ghost's grid (L2 pour: the surface itself; L6: Sedentary; explore: Lifelong) */
  ghost: G[GL].slice(),
  ghostVer: 1,
  ghostOp: 0,
  /** the dashed chalk outline of the ghost (comparisons, L8) */
  outlineOp: 0,
  /** its hidden edges show through the solid at this share (L5 on, explore) */
  xray: 0,
  /** the solid's crisp chalk edges */
  edgeOp: 0,
  /** solid surface opacity and its focus-pull dim */
  surfOp: 0,
  surfDim: 1,
  /** L5: the lid is glass (0..1); the Sedentary before lies under it as a dim solid */
  glass: 0,
  /** the isoline mesh shows the displayed grid (the glass lid, L5) instead of the ghost (the L2 pour) */
  isoOfGrid: false,
  /** pour level in capacity units (walls and sheet) */
  level: -0.05,
  wallsOp: 0,
  wallRim: 0,
  sheetOp: 0,
  /** 0: the pour's waterline (L2); 1: the scanner's bow wave on the landscape (L5) */
  sheetMode: 0,
  /** the wave's scanner age (L5) */
  waveS: 17,
  /** the independence plane's height in capacity units */
  planeCap: 0,
  planeOp: 0,
  /** the plane's red fill alpha */
  planeFill: 0.065,
  /** the plane's frame (edges) steps back after L3 */
  planeFrame: 1,
  edge: 0,
  /** capacity under which the surface takes the sick tint (-1e9 = none) */
  indepCap: -1e9,
  /** the hatch under the line (x the material's base alpha) */
  hatch: 1,
  /** the walls' reclaimed band (L5) */
  reclaimWalls: 0,
  /** the hot pen on the power ridge while it leads the sink (L4) */
  ridge: 0,
  /** the faint skirt that makes the fused landscape a solid (end of L1) */
  skirt: 0,
  scanOp: 0,
  /** the curtain of light above the scanner line (it fades once the sweep lands) */
  curtainOp: 0,
  scanAge: 17,
  /** volume shown relative to the Lifelong trainer's (the floor glow under the solid) */
  volK: 1,
  sliceOp: 0,
  sliceAge: 45,
  /** explore: the volume of the grid shown (HUD) */
  score: 0,
}

const _bl: Blend = { kind: 0, a: 0, b: 0, k: 0, s: 0 }
const last = { kind: -1, a: -1, b: -1, k: -1, s: -1, ghost: -1 }
const grids = new Map<string, Float32Array>()
const gridOf = (name: string) => {
  let g = grids.get(name)
  if (!g) {
    g = gridFor(profileByName(name))
    grids.set(name, g)
  }
  return g
}
const damp = THREE.MathUtils.damp

function storyState(T: number): void {
  HS.explore = false
  const bl = blendAt(T, _bl)
  if (bl.kind !== last.kind || bl.a !== last.a || bl.b !== last.b || bl.k !== last.k || bl.s !== last.s) {
    last.kind = bl.kind
    last.a = bl.a
    last.b = bl.b
    last.k = bl.k
    last.s = bl.s
    writeBlend(bl, HS.grid)
    HS.gridVer++
  }
  // the ghost: the surface itself while it pours (L2), the Lifelong landscape it sank from (L4),
  // then the Sedentary landscape it lifts from (L5) and that lies under the Lifelong one (L6)
  const src = T >= OUTLINE_SWITCH ? GS : GL
  if (src !== last.ghost) {
    last.ghost = src
    HS.ghost.set(G[src])
    HS.ghostVer++
  }
  const pg = Math.max(0, pourGhost(T))
  const gi = ghostIn(T)
  // the isoline ghost is the pour's see-through surface (L2) only: the Sedentary ghost of L6
  // has a single isoline (its peak is 0.18), so the dashed outline carries that comparison
  const gk = T >= B.anyAge ? glassK(T) : 0
  HS.glass = gk
  // the isolines are the pour's see-through surface (L2), and the glass lid's (L5)
  HS.ghostOp = T < B.line ? pg : 0.9 * gk
  HS.isoOfGrid = T >= B.anyAge
  HS.outlineOp = T < OUTLINE_SWITCH ? lostOutline(T) : beforeOutline(T) * (T >= B.hold ? 0.6 + 0.4 * gi : 1)
  HS.xray = xrayOn(T)
  HS.planeFrame = planeFrame(T)
  HS.surfOp = T < B.volume ? fuse(T) : (1 - pg) * (1 - (1 - GLASS_OP) * gk)
  HS.edgeOp = solidEdge(T) * (T >= B.line && T < B.sink ? focus(T, B.volume) : 1)
  // the landscape dims while the independence plane builds (L3), and only then:
  // from L4 on the landscape itself is the new data
  HS.surfDim = T >= B.line && T < B.sink ? 0.6 + (0.4 * (focus(T, B.volume) - 0.35)) / 0.65 : 1
  HS.level = T < B.line ? pourLevel(T) : 1.2
  // the base walls step back under the reclaimed band (L5), so the light the lift added stands out
  HS.wallsOp = wallsOn(T) * (T >= B.line && T < B.sink ? focus(T, B.volume) : 1) * (1 - 0.5 * reclaimWalls(T))
  HS.wallRim = wallRim(T)
  if (T < B.line) {
    HS.sheetMode = 0
    HS.sheetOp = sheetOn(T)
  } else {
    HS.sheetMode = 1
    HS.sheetOp = T >= B.anyAge ? Math.max(scanOn(T), reclaimWalls(T)) : 0
    HS.waveS = scanAge(T)
  }
  HS.planeCap = planeCap(T)
  HS.planeOp = planeOn(T)
  HS.planeFill = planeFill(T)
  HS.edge = edgeDraw(T)
  HS.indepCap = T >= B.line ? HS.planeCap - 0.0003 : -1e9
  HS.hatch = hatchK(T)
  HS.reclaimWalls = reclaimWalls(T)
  HS.ridge = ridgePen(T)
  HS.skirt = T < B.volume ? fuseWalls(T) : 1 - at(T, B.volume, 0.55, 0.75)
  HS.scanOp = scanOn(T)
  HS.curtainOp = curtainOn(T)
  HS.scanAge = scanAge(T)
  HS.sliceOp = ageSliceOn(T)
  HS.sliceAge = ageSliceAge(T)
  HS.volK = T < B.volume ? 1 : meanAt(T) / MEANS[GL]
}

function exploreState(dtRaw: number): void {
  const dt = Math.min(0.05, dtRaw)
  const st = useHealthExplore.getState()
  if (!HS.explore) {
    HS.explore = true
    // the story's frame is the starting point; everything damps from there
    last.kind = -1
    last.ghost = -1
  }
  const target = gridOf(st.profile)
  let moved = false
  let s = 0
  for (let i = 0; i < N; i++) {
    const v = damp(HS.grid[i], target[i], 6, dt)
    if (Math.abs(v - HS.grid[i]) > 1e-5) moved = true
    HS.grid[i] = Math.abs(v - target[i]) < 1e-5 ? target[i] : v
    s += HS.grid[i]
  }
  if (moved) HS.gridVer++
  HS.score = s / N
  if (last.ghost !== 100) {
    last.ghost = 100
    HS.ghost.set(G[GL])
    HS.ghostVer++
  }
  const cmp = st.compare && st.profile !== LIFELONG.name ? 1 : 0
  HS.glass = damp(HS.glass, 0, 8, dt)
  HS.isoOfGrid = false
  HS.ghostOp = damp(HS.ghostOp, 0.85 * cmp, 8, dt)
  HS.outlineOp = damp(HS.outlineOp, cmp, 8, dt)
  HS.xray = damp(HS.xray, cmp, 8, dt)
  HS.surfOp = damp(HS.surfOp, 1, 8, dt)
  HS.edgeOp = damp(HS.edgeOp, 1, 8, dt)
  HS.surfDim = 1
  HS.level = 1.2
  HS.wallsOp = damp(HS.wallsOp, 1, 8, dt)
  HS.wallRim = damp(HS.wallRim, 0.9, 8, dt)
  HS.sheetOp = damp(HS.sheetOp, 0, 10, dt)
  HS.planeCap = damp(HS.planeCap, INDEPENDENCE_LINE, 8, dt)
  HS.planeOp = damp(HS.planeOp, st.showLine ? 1 : 0, 8, dt)
  HS.planeFill = damp(HS.planeFill, 0.035, 8, dt)
  HS.planeFrame = 0.6
  HS.edge = 1
  HS.indepCap = st.showLine ? INDEPENDENCE_LINE - 0.0003 : -1e9
  HS.hatch = damp(HS.hatch, 1, 8, dt)
  HS.reclaimWalls = damp(HS.reclaimWalls, 0, 8, dt)
  HS.ridge = damp(HS.ridge, 0, 10, dt)
  HS.skirt = damp(HS.skirt, 0, 8, dt)
  HS.scanOp = damp(HS.scanOp, 0, 10, dt)
  HS.curtainOp = damp(HS.curtainOp, 0, 10, dt)
  HS.sliceOp = damp(HS.sliceOp, 1, 8, dt)
  HS.sliceAge = damp(HS.sliceAge, st.age, 10, dt)
  HS.volK = HS.score / MEANS[GL]
}

const FOG = '#070a0e'
const _target = new THREE.Vector3(0, 2.6, 0)

/**
 * Writes HS every frame, and keeps the chapter fog (D.7 "Fog on") keyed to
 * the fitted camera: the fitted distance is 45 to 110 units, where a fixed
 * FogExp2 density is either a uniform veil or black, so the fog is linear
 * from the near edge of the landscape (0) to about a quarter at age 85.
 */
export function useHealthState(): void {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    const fog = new THREE.Fog(FOG, 30, 200)
    scene.fog = fog
    return () => {
      if (scene.fog === fog) scene.fog = null
    }
  }, [scene])
  useSafeFrame(
    'health state',
    (T, _A, dt) => {
      if (useStoryStore.getState().mode === 'explore') exploreState(dt)
      else storyState(T)
      const fog = scene.fog
      if (fog && (fog as THREE.Fog).isFog) {
        const d = camera.position.distanceTo(_target)
        ;(fog as THREE.Fog).near = Math.max(1, d - 11)
        ;(fog as THREE.Fog).far = d + 60
      }
    },
    { priority: -5 },
  )
}
