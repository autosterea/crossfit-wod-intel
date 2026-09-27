import type { Dir, LabelSpec, Rect } from '../types'

/* =========================================================================
   Label registry: scene components (inside the Canvas) register specs; the
   DOM LabelLayer renders one node per label when the SET changes; the placer
   (useFrame -80) writes positions and opacity through refs. No React state
   per frame, no perspective scale, no <Html>.
   ========================================================================= */

export interface LabelEntry {
  spec: LabelSpec
  text: string
  el: HTMLDivElement | null
  txt: HTMLSpanElement | null
  leader: SVGLineElement | null
  /** measured size of the current text, and of the short text */
  w: number
  h: number
  shortW: number
  measured: string
  dir: Dir | null
  /** last written state (to avoid redundant DOM writes) */
  x: number
  y: number
  opacity: number
  alpha: number
  visible: boolean
  short: boolean
  clipped: boolean
  rect: Rect
}

export const registry = new Map<string, LabelEntry>()
const obstacles = new Map<string, () => Rect | null>()
let setVersion = 0
const subs = new Set<() => void>()

export const labelSetVersion = () => setVersion
export function subscribeLabels(fn: () => void): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}
const bump = () => {
  setVersion++
  for (const fn of subs) fn()
}

export function registerLabel(spec: LabelSpec): void {
  const prev = registry.get(spec.id)
  if (prev) {
    prev.spec = spec
    if (prev.text !== spec.text) prev.text = spec.text
    bump()
    return
  }
  registry.set(spec.id, {
    spec,
    text: spec.text,
    el: null,
    txt: null,
    leader: null,
    w: 0,
    h: 0,
    shortW: 0,
    measured: '',
    dir: null,
    x: -9999,
    y: -9999,
    opacity: -1,
    alpha: 0,
    visible: false,
    short: false,
    clipped: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
  })
  bump()
}

export function unregisterLabel(id: string): void {
  if (registry.delete(id)) bump()
}

/** Imperative text update (readouts, counters). No React. */
export function setLabelText(id: string, text: string): void {
  const e = registry.get(id)
  if (!e || e.text === text) return
  e.text = text
  if (e.txt && !e.short) e.txt.textContent = text
}

export function registerObstacle(id: string, rect: () => Rect | null): void {
  obstacles.set(id, rect)
}
export function unregisterObstacle(id: string): void {
  obstacles.delete(id)
}
export function obstacleRects(): Rect[] {
  const out: Rect[] = []
  for (const fn of obstacles.values()) {
    const r = fn()
    if (r && r.w > 0 && r.h > 0) out.push(r)
  }
  return out
}
