import { useEffect } from 'react'
import type { Layout, Rect } from '../types'

/* =========================================================================
   The focus rect (DESIGN.md B.2, C.8): the part of the stage not covered by
   the caption card, in stage CSS px. The camera director fits every beat
   inside it and the label system clamps inside it. Computed from DOM rects by
   the Stage's ResizeObserver; read by the director and labels every frame.
   ========================================================================= */

export type ShellLayout = 'phone' | 'tablet' | 'landscape' | 'desktop'

export interface FocusState extends Rect {
  /** stage size */
  W: number
  H: number
  layout: Layout
  shell: ShellLayout
  version: number
}

export const focus: FocusState = { x: 12, y: 8, w: 366, h: 530, W: 390, H: 796, layout: 'P', shell: 'phone', version: 0 }

const focusSubs = new Set<() => void>()
/** Subscribe to focus-rect changes (useSyncExternalStore). */
export function subscribeFocus(fn: () => void): () => void {
  focusSubs.add(fn)
  return () => {
    focusSubs.delete(fn)
  }
}
export const focusVersion = () => focus.version

/** DOM panels a chapter excludes from the rect (e.g. the Continuum portrait key). */
const insets = new Map<string, { el: HTMLElement; side: 'top' | 'bottom' }>()

export function shellFor(W: number, H: number): ShellLayout {
  if (W >= 1024) return 'desktop'
  if (W / Math.max(1, H) > 1.3 && H < 500) return 'landscape'
  if (W >= 768 && W / Math.max(1, H) < 0.9) return 'tablet'
  return 'phone'
}

/**
 * Recompute from the stage and caption-card elements. Returns true when the
 * rect changed.
 */
export function computeFocus(stage: HTMLElement, card: HTMLElement | null): boolean {
  const sr = stage.getBoundingClientRect()
  const W = Math.round(sr.width)
  const H = Math.round(sr.height)
  if (W < 2 || H < 2) return false
  const shell = shellFor(W, H)
  let r: Rect
  if (shell === 'desktop') {
    r = { x: 500, y: 72, w: W - 556, h: H - 128 }
  } else if (shell === 'landscape') {
    const cr = card?.getBoundingClientRect()
    const right = cr ? cr.right - sr.left : W * 0.44
    r = { x: right + 12, y: 8, w: W - right - 24, h: H - 16 }
  } else {
    const cr = card?.getBoundingClientRect()
    const top = cr ? cr.top - sr.top : H * 0.66
    r = { x: 12, y: 8, w: W - 24, h: top - 8 - 8 }
  }
  for (const { el, side } of insets.values()) {
    const ir = el.getBoundingClientRect()
    if (!ir.height) continue
    if (side === 'bottom') {
      const top = ir.top - sr.top
      r.h = Math.min(r.h, top - 8 - r.y)
    } else {
      const bottom = ir.bottom - sr.top
      const nh = r.y + r.h - (bottom + 8)
      r.y = bottom + 8
      r.h = nh
    }
  }
  r.w = Math.max(40, r.w)
  r.h = Math.max(40, r.h)
  const layout: Layout = r.w / r.h < 0.95 ? 'P' : 'L'
  const changed =
    Math.abs(r.x - focus.x) > 0.5 ||
    Math.abs(r.y - focus.y) > 0.5 ||
    Math.abs(r.w - focus.w) > 0.5 ||
    Math.abs(r.h - focus.h) > 0.5 ||
    W !== focus.W ||
    H !== focus.H ||
    shell !== focus.shell
  if (changed) {
    focus.x = Math.round(r.x)
    focus.y = Math.round(r.y)
    focus.w = Math.round(r.w)
    focus.h = Math.round(r.h)
    focus.W = W
    focus.H = H
    focus.layout = layout
    focus.shell = shell
    focus.version++
    for (const fn of focusSubs) fn()
  }
  return changed
}

let requestRecompute: () => void = () => {}
export function setFocusRecompute(fn: () => void): void {
  requestRecompute = fn
}
export function recomputeFocus(): void {
  requestRecompute()
}

/** Exclude a DOM panel from the focus rect while mounted. */
export function useFocusInset(ref: { current: HTMLElement | null }, side: 'top' | 'bottom', id = 'inset'): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    insets.set(id, { el, side })
    recomputeFocus()
    const ro = new ResizeObserver(() => recomputeFocus())
    ro.observe(el)
    return () => {
      ro.disconnect()
      insets.delete(id)
      recomputeFocus()
    }
  }, [ref, side, id])
}

/** Snapshot of the focus rect (a ref-like object plus its version). */
export function useFocusRect(): FocusState {
  return focus
}
