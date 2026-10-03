import { useSyncExternalStore } from 'react'
import { focusRect, subscribeFocus } from '../../story/camera/focusRect'
import type { ChartFrameOpts } from '../../story/kit/chartFrame'
import type { Box, Layout } from '../../story/types'
import {
  CURL,
  DEADLIFT,
  LATERAL_RAISE,
  LEG_EXTENSION,
  PULL_UP,
  PUSH_PRESS,
  SIT_TO_STAND,
  SQUAT,
  movementBounds,
  type Movement,
} from './figure'

/* =========================================================================
   07 CROSSFIT world (STORYBOARD-crossfit.md section 1, "Composition"). Y up,
   every station centred on the origin and read front-on, except the pyramid
   (an oblique solid). Each station has a portrait arrangement and a wide one,
   chosen from the FOCUS RECT (the part of the stage the caption card leaves),
   so the subject fills a phone held upright (390 x 844 and Safari's
   390 x 664) as well as a desktop. Kinds re-render the scene only when they
   flip; camera fits read them live.
   ========================================================================= */

const aspect = () => focusRect.w / Math.max(1, focusRect.h)

export type TilesKind = 'col' | 'colWide' | 'row'
export type PairKind = 'stack' | 'side'
export type TableKind = 'rows' | 'cols'

/** C0: three tiles stacked on a portrait rect (wider tiles on Safari's squarish one), in a row on a wide one. */
export const tilesKind = (): TilesKind => (aspect() > 1.6 ? 'row' : aspect() > 0.85 ? 'colWide' : 'col')
/** C1: the two figures stacked on a tall rect, side by side otherwise. */
export const pairKind = (): PairKind => (aspect() < 0.8 ? 'stack' : 'side')
/** C2: three rows of two on a portrait or squarish rect (desktop included), three columns of two on a wide one. */
export const tableKind = (): TableKind => (aspect() < 1.25 ? 'rows' : 'cols')

const kindsKey = () => `${tilesKind()}|${pairKind()}|${tableKind()}|${focusRect.layout}`
export function useKinds(): { tiles: TilesKind; pair: PairKind; table: TableKind; layout: Layout; key: string } {
  const key = useSyncExternalStore(subscribeFocus, kindsKey)
  const [tiles, pair, table, layout] = key.split('|') as [TilesKind, PairKind, TableKind, Layout]
  return { tiles, pair, table, layout, key }
}

/* ----------------------------- figures -------------------------------- */

export interface Place {
  x: number
  y: number
  z: number
  /** world height of the unit body */
  S: number
  /** degrees: 0 faces the camera, 90 faces right (profile) */
  yaw: number
}

type B3 = [number, number, number]
const EMPTY = (): { min: B3; max: B3 } => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] })

/** Body-frame extents the props add beyond the skeleton (box behind the seat, the crate ahead, bars, the machine). */
function propBounds(m: Movement): { min: B3; max: B3 } | null {
  switch (m.prop) {
    case 'box':
      return { min: [-0.02, 0, -0.44], max: [0.02, 0.3, 0] }
    case 'crate':
      return { min: [-0.02, 0, 0.08], max: [0.02, 0.6, 0.24] }
    case 'barbell':
      return { min: [-0.44, 0.7, -0.05], max: [0.44, 1.2, 0.2] }
    case 'bar':
      return { min: [-0.46, 1.27, -0.02], max: [0.46, 1.36, 0.02] }
    case 'machine':
      return { min: [-0.02, 0, -0.2], max: [0.02, 0.86, 0.6] }
    default:
      return null
  }
}

const boundsCache = new Map<string, { min: B3; max: B3 }>()
function bodyBounds(m: Movement): { min: B3; max: B3 } {
  let b = boundsCache.get(m.name)
  if (b) return b
  const sk = movementBounds(m)
  b = { min: [...sk.min] as B3, max: [...sk.max] as B3 }
  const pb = propBounds(m)
  if (pb) for (let c = 0; c < 3; c++) {
    b.min[c] = Math.min(b.min[c], pb.min[c])
    b.max[c] = Math.max(b.max[c], pb.max[c])
  }
  // the head circle is screen-aligned: its radius reaches sideways in world x too
  b.min[0] = Math.min(b.min[0], -0.07)
  b.max[0] = Math.max(b.max[0], 0.07)
  boundsCache.set(m.name, b)
  return b
}

/** World AABB of a figure over its whole movement at a placement. */
export function figureBox(m: Movement, p: Place): Box {
  const b = bodyBounds(m)
  const r = (p.yaw * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const out = EMPTY()
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? b.max[0] : b.min[0]
    const y = i & 2 ? b.max[1] : b.min[1]
    const z = i & 4 ? b.max[2] : b.min[2]
    const w: B3 = [p.x + p.S * (x * c + z * s), p.y + p.S * y, p.z + p.S * (-x * s + z * c)]
    for (let k = 0; k < 3; k++) {
      out.min[k] = Math.min(out.min[k], w[k])
      out.max[k] = Math.max(out.max[k], w[k])
    }
  }
  return [out.min, out.max]
}

export function unionBox(boxes: readonly Box[]): Box {
  const out = EMPTY()
  for (const b of boxes) for (let k = 0; k < 3; k++) {
    out.min[k] = Math.min(out.min[k], b[0][k])
    out.max[k] = Math.max(out.max[k], b[1][k])
  }
  return [out.min, out.max]
}

export const padBox = (b: Box, l: number, r: number, bot: number, top: number): Box => [
  [b[0][0] - l, b[0][1] - bot, b[0][2]],
  [b[1][0] + r, b[1][1] + top, b[1][2]],
]

/* ------------------------------ C0 tiles ------------------------------ */

export interface TileGeo {
  /** plate rect [x0, y0, x1, y1] */
  rect: [number, number, number, number]
  /** icon centre and scale (icon-local units: about 2.6 wide, 2 tall) */
  icon: [number, number]
  k: number
  /** where the name sits and on which side */
  name: [number, number]
  nameDir: 'E' | 'C'
  /** the plain-words line: centred along the tile's foot (stacked tiles) or under the name (a row) */
  sub: [number, number]
}

export function tiles(kind: TilesKind): TileGeo[] {
  if (kind === 'row') {
    const w = 6.8
    const h = 6.4
    const gap = 0.8
    return [0, 1, 2].map((i) => {
      const cx = (i - 1) * (w + gap)
      return { rect: [cx - w / 2, -h / 2, cx + w / 2, h / 2], icon: [cx, 0.55], k: 1.75, name: [cx, -2.2], nameDir: 'C' as const, sub: [cx, -2.75] as [number, number] }
    })
  }
  const w = kind === 'colWide' ? 13.4 : 10.4
  const h = 4.3
  const gap = 0.55
  const ix = kind === 'colWide' ? -3.9 : -2.75
  return [0, 1, 2].map((i) => {
    const cy = (1 - i) * (h + gap)
    // the icon sits a little high so the plain-words line has the tile's foot to itself
    return {
      rect: [-w / 2, cy - h / 2, w / 2, cy + h / 2],
      icon: [ix, cy + 0.32],
      k: 1.32,
      name: [ix + 2.25, cy + 0.32],
      nameDir: 'E' as const,
      sub: [0, cy - h / 2 + 0.42] as [number, number],
    }
  })
}

export function tilesBox(kind: TilesKind): Box {
  const t = tiles(kind)
  const x0 = Math.min(...t.map((g) => g.rect[0]))
  const y0 = Math.min(...t.map((g) => g.rect[1]))
  const x1 = Math.max(...t.map((g) => g.rect[2]))
  const y1 = Math.max(...t.map((g) => g.rect[3]))
  return [
    [x0, y0, 0],
    [x1, y1, 0],
  ]
}

/* --------------------------- C1 the pair ------------------------------ */

export const PAIR_S = 6
export interface PairGeo {
  left: Place
  right: Place
  /** where the MULTI-JOINT claim hangs (under the names) */
  claim: [number, number]
  /** ground segments [x0, x1, y] under each figure */
  grounds: [number, number, number][]
  box: Box
}

export function pair(kind: PairKind): PairGeo {
  const S = PAIR_S
  if (kind === 'side') {
    const left: Place = { x: -2.9, y: 0, z: 0, S, yaw: 90 }
    const right: Place = { x: 3.2, y: 0, z: 0, S, yaw: 90 }
    const bl = figureBox(SIT_TO_STAND, left)
    const br = figureBox(DEADLIFT, right)
    const u = unionBox([bl, br])
    const dx = -(u[0][0] + u[1][0]) / 2
    left.x += dx
    right.x += dx
    const box = unionBox([figureBox(SIT_TO_STAND, left), figureBox(DEADLIFT, right)])
    return {
      left,
      right,
      claim: [(box[0][0] + box[1][0]) / 2, 0],
      grounds: [
        [box[0][0] - 0.3, box[1][0] + 0.3, 0],
      ],
      box,
    }
  }
  const top: Place = { x: 0, y: 7.6, z: 0, S, yaw: 90 }
  const bot: Place = { x: 0, y: 0, z: 0, S, yaw: 90 }
  const bt = figureBox(SIT_TO_STAND, top)
  const bb = figureBox(DEADLIFT, bot)
  top.x -= (bt[0][0] + bt[1][0]) / 2
  bot.x -= (bb[0][0] + bb[1][0]) / 2
  const box = unionBox([figureBox(SIT_TO_STAND, top), figureBox(DEADLIFT, bot)])
  const gx0 = box[0][0] - 0.3
  const gx1 = box[1][0] + 0.3
  return {
    left: top,
    right: bot,
    claim: [(box[0][0] + box[1][0]) / 2, 0],
    grounds: [
      [gx0, gx1, top.y],
      [gx0, gx1, 0],
    ],
    box,
  }
}

/* -------------------------- C2 the swaps ------------------------------ */

export const TABLE_S = 4
/** row r: [isolation, functional] movements and their view angles */
export const SWAPS: readonly { iso: Movement; fun: Movement; isoYaw: number; funYaw: number }[] = [
  { iso: LATERAL_RAISE, fun: PUSH_PRESS, isoYaw: 22, funYaw: 28 },
  { iso: CURL, fun: PULL_UP, isoYaw: 66, funYaw: 18 },
  { iso: LEG_EXTENSION, fun: SQUAT, isoYaw: 90, funYaw: 90 },
]

export interface TableGeo {
  iso: Place[]
  fun: Place[]
  /** arrows: [x0, y0, x1, y1] */
  arrows: [number, number, number, number][]
  /** grounds [x0, x1, y] (feet-anchored figures only) */
  grounds: [number, number, number][]
  /** the two column (or row) heads: anchor and side (the name, its sub-head nearer the table) */
  heads: { at: [number, number]; dir: 'N' | 'S' }[]
  /** name anchors under each figure: iso[r], fun[r] */
  isoName: [number, number][]
  funName: [number, number][]
  box: Box
}

/** Centre a figure's box on x = cx and put its lowest point at y = floor. */
function seat(m: Movement, yaw: number, cx: number, floor: number): Place {
  const p: Place = { x: 0, y: 0, z: 0, S: TABLE_S, yaw }
  const b = figureBox(m, p)
  p.x = cx - (b[0][0] + b[1][0]) / 2
  p.y = floor - b[0][1]
  return p
}

export function table(kind: TableKind): TableGeo {
  const S = TABLE_S
  const iso: Place[] = []
  const fun: Place[] = []
  const arrows: [number, number, number, number][] = []
  const grounds: [number, number, number][] = []
  const isoName: [number, number][] = []
  const funName: [number, number][] = []
  const heads: { at: [number, number]; dir: 'N' | 'S' }[] = []
  const NAME_GAP = 0.95
  if (kind === 'rows') {
    const XI = -3.25
    const XF = 3.25
    let floor = 0
    // rows bottom (2) to top (0)
    const rowFloor: number[] = []
    for (let r = 2; r >= 0; r--) {
      rowFloor[r] = floor
      const a = seat(SWAPS[r].iso, SWAPS[r].isoYaw, XI, floor + NAME_GAP)
      const b = seat(SWAPS[r].fun, SWAPS[r].funYaw, XF, floor + NAME_GAP)
      iso[r] = a
      fun[r] = b
      const top = Math.max(figureBox(SWAPS[r].iso, a)[1][1], figureBox(SWAPS[r].fun, b)[1][1])
      floor = top + 0.75
    }
    for (let r = 0; r < 3; r++) {
      const bi = figureBox(SWAPS[r].iso, iso[r])
      const bf = figureBox(SWAPS[r].fun, fun[r])
      const my = (Math.min(bi[0][1], bf[0][1]) + Math.max(bi[1][1], bf[1][1])) / 2
      arrows.push([bi[1][0] + 0.35, my, bf[0][0] - 0.35, my])
      isoName.push([XI, bi[0][1] - 0.12])
      funName.push([XF, bf[0][1] - 0.12])
      if (SWAPS[r].iso.anchor === 'feet') grounds.push([XI - 1.5, XI + 1.5, iso[r].y])
      if (SWAPS[r].fun.anchor === 'feet') grounds.push([XF - 1.5, XF + 1.5, fun[r].y])
    }
    const all = unionBox([...SWAPS.map((w, r) => figureBox(w.iso, iso[r])), ...SWAPS.map((w, r) => figureBox(w.fun, fun[r]))])
    // the heads ride clear of the push press's raised bar (its hands are label obstacles)
    heads.push({ at: [XI, all[1][1] + 0.55], dir: 'N' }, { at: [XF, all[1][1] + 0.55], dir: 'N' })
    const box: Box = [
      [Math.min(all[0][0], XI - 2.4), rowFloor[2], 0],
      [Math.max(all[1][0], XF + 2.4), all[1][1] + 2.4, 0],
    ]
    return { iso, fun, arrows, grounds, heads, isoName, funName, box }
  }
  // cols: the isolation move above its replacement, three pairs side by side
  const XS = [-6.9, 0, 6.9]
  const funFloor = NAME_GAP
  const funTops: number[] = []
  for (let r = 0; r < 3; r++) {
    fun[r] = seat(SWAPS[r].fun, SWAPS[r].funYaw, XS[r], funFloor)
    funTops.push(figureBox(SWAPS[r].fun, fun[r])[1][1])
  }
  const isoFloor = Math.max(...funTops) + 1.1 + NAME_GAP
  for (let r = 0; r < 3; r++) {
    iso[r] = seat(SWAPS[r].iso, SWAPS[r].isoYaw, XS[r], isoFloor)
    const bi = figureBox(SWAPS[r].iso, iso[r])
    const bf = figureBox(SWAPS[r].fun, fun[r])
    // the arrow runs down the gap between the isolation move's name and its replacement's top
    arrows.push([XS[r] + 2.05, bi[0][1] + 0.6, XS[r] + 2.05, bf[1][1] - 0.4])
    isoName.push([XS[r], bi[0][1] - 0.12])
    funName.push([XS[r], bf[0][1] - 0.12])
    if (SWAPS[r].iso.anchor === 'feet') grounds.push([XS[r] - 1.5, XS[r] + 1.5, iso[r].y])
    if (SWAPS[r].fun.anchor === 'feet') grounds.push([XS[r] - 1.5, XS[r] + 1.5, fun[r].y])
  }
  const all = unionBox([...SWAPS.map((w, r) => figureBox(w.iso, iso[r])), ...SWAPS.map((w, r) => figureBox(w.fun, fun[r]))])
  heads.push({ at: [0, all[1][1] + 0.35], dir: 'N' }, { at: [0, -0.9], dir: 'S' })
  const box: Box = [
    [all[0][0] - 0.6, -2.4, 0],
    [all[1][0] + 0.6, all[1][1] + 2.2, 0],
  ]
  return { iso, fun, arrows, grounds, heads, isoName, funName, box }
}

/* ------------------------------ C3, C4 --------------------------------- */

/** label room around the chart: power and miles titles left, ticks and the time title below */
export const CHART_PAD = { l: 64, r: 28, t: 30, b: 62 }
export const FRAME_OPTS: ChartFrameOpts = { FH: 10, vMax: 1.24, minAspect: 0.78, maxAspect: 1.5, marginPx: CHART_PAD }

/* ------------------------------ pyramid -------------------------------- */

export interface PyrDims {
  w: readonly number[]
  d: readonly number[]
  h: number
  gap: number
}
export const PYR: Record<Layout, PyrDims> = {
  P: { w: [7.8, 6.75, 5.7, 4.65, 3.6], d: [4.2, 3.55, 2.9, 2.25, 1.6], h: 1.5, gap: 0.12 },
  L: { w: [10.4, 8.6, 6.8, 5.0, 3.2], d: [5.2, 4.4, 3.6, 2.8, 2.0], h: 1.25, gap: 0.1 },
}
export const pyrHeight = (d: PyrDims) => 5 * d.h + 4 * d.gap

/** The pyramid's fit: the solid plus label room above it (the C6 and C7 claims). */
export function pyrBox(layout: Layout, top = 0.9): Box {
  const d = PYR[layout]
  const H = pyrHeight(d)
  return [
    [-d.w[0] / 2, 0, -d.d[0] / 2],
    [d.w[0] / 2, H + top, d.d[0] / 2],
  ]
}
