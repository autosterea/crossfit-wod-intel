import { useMemo, useSyncExternalStore } from 'react'
import { focus, subscribeFocus, focusVersion } from '../camera/focusRect'
import type { Box } from '../types'

/* =========================================================================
   Adaptive chart frame (DESIGN.md B.13). 2D charts are authored in chart
   space (u 0..1 along x, v 0..vMax along y) and mapped to world so the chart
   fills any focus rect: tall on a phone, wide on desktop. Recomputed only on
   resize, orientation or detent change, never per frame.
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

export function computeChartFrame(o: ChartFrameOpts): ChartFrame {
  const vMax = o.vMax ?? 1
  const w = Math.max(40, focus.w - o.marginPx.l - o.marginPx.r)
  const h = Math.max(40, focus.h - o.marginPx.t - o.marginPx.b)
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

/** React hook: the frame, recomputed when the focus rect changes. */
export function useChartFrame(o: ChartFrameOpts): ChartFrame {
  const v = useSyncExternalStore(subscribeFocus, focusVersion)
  const key = `${o.FH}|${o.minAspect}|${o.maxAspect}|${o.marginPx.l},${o.marginPx.r},${o.marginPx.t},${o.marginPx.b}|${o.vMax ?? 1}|${o.zRange?.join(',') ?? ''}`
  // focus.w / focus.h change with v; round the aspect so tiny rect jitter does not rebuild geometry
  const q = Math.round(((focus.w - o.marginPx.l - o.marginPx.r) / Math.max(1, focus.h - o.marginPx.t - o.marginPx.b)) * 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => computeChartFrame(o), [key, q, v > -1])
}
