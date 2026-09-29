import { useSyncExternalStore } from 'react'
import { clock, type StoryClock } from './clock'
import { cue as cueT, at as atT, focus as focusT } from './cue'
import type { Ease } from './ease'
import { focusRect, subscribeFocus } from './camera/focusRect'
import type { Layout } from './types'

/* =========================================================================
   useBeat() (DESIGN.md C.5): the scene's window onto story time. Returns
   the mutable clock (read it inside useFrame) and cue helpers bound to it.
   Re-renders only when the layout (P / L) flips.
   ========================================================================= */

export interface BeatApi {
  clock: StoryClock
  /** global-T window, eased 0..1 */
  cue(a: number, b: number, ease?: Ease): number
  /** beat n, t from a to b */
  at(n: number, a: number, b: number, ease?: Ease): number
  /** L3 focus-pull multiplier for elements born in beat n */
  focus(n: number): number
  layout: Layout
}

const api = {
  clock,
  cue: (a: number, b: number, e?: Ease) => cueT(clock.T, a, b, e),
  at: (n: number, a: number, b: number, e?: Ease) => atT(clock.T, n, a, b, e),
  focus: (n: number) => focusT(clock.T, n),
}

const layoutNow = () => focusRect.layout

export function useBeat(): BeatApi {
  const layout = useSyncExternalStore(subscribeFocus, layoutNow)
  return { ...api, layout }
}

/** Re-render only when the focus layout flips (P / L). */
export function useLayout(): Layout {
  return useSyncExternalStore(subscribeFocus, layoutNow)
}
