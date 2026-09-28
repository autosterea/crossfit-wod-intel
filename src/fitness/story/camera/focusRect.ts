import { useCallback, useEffect, useRef } from 'react'
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

export const focusRect: FocusState = { x: 12, y: 8, w: 366, h: 530, W: 390, H: 796, layout: 'P', shell: 'phone', version: 0 }

const focusSubs = new Set<() => void>()
/** Subscribe to focus-rect changes (useSyncExternalStore). */
export function subscribeFocus(fn: () => void): () => void {
  focusSubs.add(fn)
  return () => {
    focusSubs.delete(fn)
  }
}
export const focusVersion = () => focusRect.version

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
  // A portrait phone keeps the P pose on a squarish rect (fix round 1): with
  // Safari's toolbars showing, a 390x844 iPhone gives a 390x664 viewport and
  // a focus rect of about 366x358 (aspect 1.02), which the 0.95 rule turned
  // into the desktop L pose on a portrait phone. The P compositions shrink
  // into the shorter rect but keep their structure (the two-line title, the
  // 2x2 glyphs, the key panel, the one-column lineup). The expanded detent
  // (aspect above 2) and every other shell keep the B.3 rule.
  const layout: Layout = (shell === 'phone' ? r.w / r.h < 1.3 : r.w / r.h < 0.95) ? 'P' : 'L'
  const changed =
    Math.abs(r.x - focusRect.x) > 0.5 ||
    Math.abs(r.y - focusRect.y) > 0.5 ||
    Math.abs(r.w - focusRect.w) > 0.5 ||
    Math.abs(r.h - focusRect.h) > 0.5 ||
    W !== focusRect.W ||
    H !== focusRect.H ||
    shell !== focusRect.shell
  if (changed) {
    focusRect.x = Math.round(r.x)
    focusRect.y = Math.round(r.y)
    focusRect.w = Math.round(r.w)
    focusRect.h = Math.round(r.h)
    focusRect.W = W
    focusRect.H = H
    focusRect.layout = layout
    focusRect.shell = shell
    focusRect.version++
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
  return focusRect
}

/**
 * A callback ref for the caption card / explore panel: whichever element is
 * mounted is observed, and every size change re-fits (the card element is
 * replaced when the mode or the chapter changes, and it may not exist yet
 * when the stage first lays out, so observing it once from the stage left
 * the focus rect stale).
 */
export function useObservedCard(cardRef: { current: HTMLDivElement | null }): (el: HTMLDivElement | null) => void {
  const ro = useRef<ResizeObserver | null>(null)
  useEffect(() => () => ro.current?.disconnect(), [])
  return useCallback(
    (el: HTMLDivElement | null) => {
      cardRef.current = el
      ro.current?.disconnect()
      ro.current = null
      if (el && typeof ResizeObserver !== 'undefined') {
        const o = new ResizeObserver(() => recomputeFocus())
        o.observe(el)
        ro.current = o
      }
      recomputeFocus()
    },
    [cardRef],
  )
}
