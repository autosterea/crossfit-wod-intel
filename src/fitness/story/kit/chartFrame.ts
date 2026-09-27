import { useSyncExternalStore } from 'react'
import { focusRect, subscribeFocus, focusVersion } from '../camera/focusRect'
import type { Box } from '../types'

/* =========================================================================
   Adaptive chart frame (DESIGN.md B.13). 2D charts are authored in chart
   space (u 0..1 along x, v 0..vMax along y) and mapped to world so the chart
   fills any focus rect: tall on a phone, wide on desktop.

   The frame is ENGINE-OWNED (amendment H.17): a chapter declares
   `StoryDef.frame` and the engine computes the frame from the focus rect.
   Scenes read it with useStoryFrame(); camera poses receive the same object
   as `fit(layout, frame)` / `target(layout, frame)`. One cache, keyed by the
   options and the focus-rect aspect (quantised so tiny rect jitter never
   rebuilds geometry), so the camera and the geometry always agree and there
   is no module global written during render.
   ========================================================================= */

export interface ChartFrame {
  /** world width */
  FW: number
  /** world height of v = 1 */
  FH: number
  vMax: number
  /** world x of the u = 0 edge and world y of v = 0 */
  x0: number
  y0: number
  x: (u: number) => number
  y: (v: number) => number
  /** chart box in world space (z = 0 plane unless zRange is given) */
  box: Box
}

export interface ChartFrameOpts {
  FH: number
  minAspect: number
  maxAspect: number
  marginPx: { l: number; r: number; t: number; b: number }
  /** top of the plotted range in v units (default 1) */
  vMax?: number
  /** z extent to include in the box (default [0, 0]) */
  zRange?: readonly [number, number]
}

/** Pure: the frame for given options and a focus-rect size. */
export function computeChartFrame(o: ChartFrameOpts, fw = focusRect.w, fh = focusRect.h): ChartFrame {
  const vMax = o.vMax ?? 1
  const w = Math.max(40, fw - o.marginPx.l - o.marginPx.r)
  const h = Math.max(40, fh - o.marginPx.t - o.marginPx.b)
  // aspect of the plotted box (v from 0 to vMax) against the available rect
  const aspect = (w / h) * vMax
  const FW = o.FH * Math.max(o.minAspect, Math.min(o.maxAspect, aspect))
  const FH = o.FH
  const x0 = -FW / 2
  const y0 = (-FH * vMax) / 2
  const z0 = o.zRange?.[0] ?? 0
  const z1 = o.zRange?.[1] ?? 0
  return {
    FW,
    FH,
    vMax,
    x0,
    y0,
    x: (u: number) => x0 + u * FW,
    y: (v: number) => y0 + v * FH,
    box: [
      [x0, y0, z0],
      [x0 + FW, y0 + FH * vMax, z1],
    ],
  }
}

const optsKey = (o: ChartFrameOpts) =>
  `${o.FH}|${o.minAspect}|${o.maxAspect}|${o.marginPx.l},${o.marginPx.r},${o.marginPx.t},${o.marginPx.b}|${o.vMax ?? 1}|${o.zRange?.join(',') ?? ''}`

/** Quantised aspect of the available rect: 1/50 steps. */
const aspectKey = (o: ChartFrameOpts) =>
  Math.round(((focusRect.w - o.marginPx.l - o.marginPx.r) / Math.max(1, focusRect.h - o.marginPx.t - o.marginPx.b)) * 50)

const cache = new Map<string, { q: number; frame: ChartFrame }>()

/** Two frames with the same numbers are the same frame (the aspect is clamped, so many rects map to one). */
const sameFrame = (a: ChartFrame, b: ChartFrame) =>
  a.FW === b.FW && a.FH === b.FH && a.x0 === b.x0 && a.y0 === b.y0 && a.vMax === b.vMax &&
  a.box[0][2] === b.box[0][2] && a.box[1][2] === b.box[1][2]

/**
 * The frame for these options at the current focus rect (cached, stable
 * identity). A new object is created only when the frame's NUMBERS change:
 * on a phone the aspect is clamped at minAspect, so a detent toggle, a
 * rotation back or the last beat's CTA row change the rect but not the
 * frame, and nothing built from `[frame]` (geometry, label arrays) rebuilds.
 */
export function frameFor(o: ChartFrameOpts): ChartFrame {
  const k = optsKey(o)
  const q = aspectKey(o)
  const hit = cache.get(k)
  if (hit && hit.q === q) return hit.frame
  const frame = computeChartFrame(o)
  if (hit && sameFrame(hit.frame, frame)) {
    hit.q = q
    return hit.frame
  }
  frameIds.set(frame, ++frameSeq)
  cache.set(k, { q, frame })
  return frame
}

const frameIds = new WeakMap<ChartFrame, number>()
let frameSeq = 0
/**
 * A small number that changes whenever a chart frame is replaced. Put it in
 * the key of any cached writer (`update` / `write` callbacks that skip work
 * when nothing changed), so a frame change always rewrites the geometry:
 * `${frameId(frame)}|${...}`.
 */
export function frameId(f: ChartFrame): number {
  let id = frameIds.get(f)
  if (id === undefined) {
    id = ++frameSeq
    frameIds.set(f, id)
  }
  return id
}

/* ------------------------ the chapter's frame ------------------------ */

const DEFAULT_OPTS: ChartFrameOpts = { FH: 10, minAspect: 1, maxAspect: 1, marginPx: { l: 0, r: 0, t: 0, b: 0 } }
let storyOpts: ChartFrameOpts = DEFAULT_OPTS

/** Engine: the active chapter's frame options (StoryDef.frame). */
export function setStoryFrameOpts(o: ChartFrameOpts | null): void {
  storyOpts = o ?? DEFAULT_OPTS
}

/** The active chapter's frame, right now (camera poses, gestures, anchors). */
export function storyFrame(): ChartFrame {
  return frameFor(storyOpts)
}

/**
 * React: the active chapter's chart frame (StoryDef.frame); the component
 * re-renders on focus-rect changes and gets a new object only when the frame
 * itself changes. (Not a frame CALLBACK: for per-frame code see useSafeFrame.)
 */
export function useChapterChart(): ChartFrame {
  useSyncExternalStore(subscribeFocus, focusVersion)
  return storyFrame()
}

/** Old name of useChapterChart (kept so existing code compiles). */
export const useStoryFrame = useChapterChart

/** React: a frame for explicit options (secondary charts inside a chapter). */
export function useChartFrame(o: ChartFrameOpts): ChartFrame {
  useSyncExternalStore(subscribeFocus, focusVersion)
  return frameFor(o)
}
