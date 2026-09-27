import type { Box, Dir, LabelSpec, Mode, Rect } from '../types'

/* =========================================================================
   Label registry: scene components (inside the Canvas) register specs; the
   DOM LabelLayer renders one node per label when the SET changes; the placer
   (useFrame -80) writes positions and opacity through refs. No React state
   per frame, no perspective scale, no <Html>.

   Ownership: every useLabels / useLabel hook registers under its own owner
   token. A second owner registering the same id is a bug (it would silently
   replace the first, and either unmount would delete both), so it warns, and
   an owner can only ever unregister its own entry.
   ========================================================================= */

/** Which story mode a label shows in (default 'story'). */
export type LabelMode = Mode | 'both'

export interface LabelEntry {
  spec: LabelSpec
  owner: symbol
  mode: LabelMode
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
  /** cue above zero this frame (counts toward the live cap) */
  live: boolean
  short: boolean
  clipped: boolean
  /** required label whose cue is up but which could not be placed */
  requiredHidden: boolean
  rect: Rect
}

export const registry = new Map<string, LabelEntry>()
let setVersion = 0
/** bumps on every imperative text change (placement dirty check) */
export const labelTextVersion = { v: 0 }
const subs = new Set<() => void>()

/** Caps (DESIGN.md C.9, amendment H.19): live = cue above zero at one T. */
export const LABEL_CAP = { live: 36, registered: 96 }

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

let warnedCap = false
export function registerLabel(spec: LabelSpec, owner: symbol, mode: LabelMode = 'story'): void {
  const prev = registry.get(spec.id)
  if (prev) {
    if (prev.owner !== owner) console.warn('[labels] duplicate label id "' + spec.id + '" registered by two owners; ids share one namespace per stage')
    prev.owner = owner
    prev.mode = mode
    prev.spec = spec
    if (prev.text !== spec.text) prev.text = spec.text
    bump()
    return
  }
  registry.set(spec.id, {
    spec,
    owner,
    mode,
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
    live: false,
    short: false,
    clipped: false,
    requiredHidden: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
  })
  if (!warnedCap && registry.size > LABEL_CAP.registered) {
    warnedCap = true
    console.warn('[labels] ' + registry.size + ' labels registered; the cap is ' + LABEL_CAP.registered + ' per view (C.9)')
  }
  bump()
}

/** Remove a label, but only if `owner` still owns it. */
export function unregisterLabel(id: string, owner: symbol): void {
  const e = registry.get(id)
  if (!e || e.owner !== owner) return
  registry.delete(id)
  bump()
}

/** Imperative text update (readouts, counters). No React. */
export function setLabelText(id: string, text: string): void {
  const e = registry.get(id)
  if (!e || e.text === text) return
  e.text = text
  labelTextVersion.v++
  if (e.txt && !e.short) e.txt.textContent = text
}

/**
 * Imperative data-colour update (integration H.53; Skills and Continuum each
 * wrote one). A label's data colour (its dot, border and callout text, the
 * CSS variable --c) comes from `spec.color`; this recolours one label from
 * story time or explore state without React, like setLabelText does for text:
 * the skill names taking their class colour as the arcs pass (D.2 S1), a
 * pinned chip following its value's colour. It writes only when the value
 * changed for that label ELEMENT (a WeakMap keyed by the node, so a node
 * that leaves the stage takes its entry with it and a new node for the same
 * id starts clean). React never rewrites --c after mount unless the spec's
 * own colour changes, so the imperative value holds. Allocation-free: pass a
 * cached string (see Skills' rgba table).
 */
const colorWritten = new WeakMap<HTMLElement, string>()
export function setLabelColor(id: string, css: string): void {
  const el = registry.get(id)?.el
  if (!el || colorWritten.get(el) === css) return
  el.style.setProperty('--c', css)
  colorWritten.set(el, css)
}

/* ------------------------------ obstacles ------------------------------ */

/** A DOM obstacle: a rect in stage CSS px, or null when absent. */
export type RectObstacle = () => Rect | null

/**
 * A world obstacle, projected by the placer with the live camera every time
 * it places: a box (its screen bounding rect, e.g. an SDF plate), and / or a
 * set of points (each a square of 2 x radiusPx, e.g. data dots and curve
 * samples). Both are pure functions of T.
 */
export interface WorldObstacle {
  box?: (T: number) => Box | null
  /** write xyz triples into `out`, return how many points were written */
  points?: (T: number, out: Float32Array) => number
  /** max points (buffer size), default 64 */
  maxPoints?: number
  /** half size of each point's square, default 6 */
  radiusPx?: number
  /** padding around the box rect, default 4 */
  padPx?: number
  /** which story mode it applies in (default 'story') */
  mode?: LabelMode
}

export const rectObstacles = new Map<string, RectObstacle>()
export const worldObstacles = new Map<string, { spec: WorldObstacle; buf: Float32Array }>()
let obstacleVersion = 0
export const obstaclesVersion = () => obstacleVersion

/**
 * A DOM obstacle changed (shown, hidden, resized) without the camera, story
 * time or focus rect changing: tell the placer to run again (it skips frames
 * when nothing moved).
 */
export function bumpObstacles(): void {
  obstacleVersion++
}

export function registerObstacle(id: string, rect: RectObstacle): void {
  rectObstacles.set(id, rect)
  obstacleVersion++
}
export function unregisterObstacle(id: string): void {
  if (rectObstacles.delete(id)) obstacleVersion++
}
export function registerWorldObstacle(id: string, spec: WorldObstacle): void {
  worldObstacles.set(id, { spec, buf: new Float32Array((spec.maxPoints ?? 64) * 3) })
  obstacleVersion++
}
export function unregisterWorldObstacle(id: string, spec: WorldObstacle): void {
  const e = worldObstacles.get(id)
  if (e && e.spec === spec) {
    worldObstacles.delete(id)
    obstacleVersion++
  }
}
