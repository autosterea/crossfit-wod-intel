import { useEffect, useRef, useState } from 'react'
import { clock, onFrame } from './clock'
import { ease as E, type Ease } from './ease'

/* =========================================================================
   Cue windows (DESIGN.md C.5). Every scene property is built from these, so
   the scene is a pure function of T and the continuity contract holds.
   ========================================================================= */

/** Global-T window [a, b], eased 0..1. Default ease: linear. */
export const cue = (T: number, a: number, b: number, e: Ease = E.linear): number => {
  if (T <= a) return 0
  if (T >= b) return 1
  return e((T - a) / (b - a))
}

/** Beat n, t from a to b. */
export const at = (T: number, n: number, a: number, b: number, e: Ease = E.linear): number => cue(T, n + a, n + b, e)

/**
 * Staggered window for element i of n inside [a, b]. `spread` is the share of
 * the window used by the stagger offsets (0 = all together, default 0.5).
 */
export const stagger = (T: number, a: number, b: number, i: number, n: number, spread = 0.5, e: Ease = E.linear): number => {
  const span = b - a
  const each = span * (1 - spread)
  const off = n > 1 ? (span * spread * i) / (n - 1) : 0
  return cue(T, a + off, a + off + each, e)
}

/**
 * L3 focus pull for elements born in beat n: 1 until beat n + 1 starts; in
 * every later beat it dips to 0.35 early in the build and recovers by t = 1.
 * Continuous at every beat boundary.
 */
export const focus = (T: number, n: number): number => {
  if (T < n + 1) return 1
  const i = Math.floor(T)
  const t = T - i
  if (i <= n) return 1
  const down = E.settle(Math.min(1, t / 0.12))
  const up = t <= 0.6 ? 0 : E.settle((t - 0.6) / 0.4)
  return 1 - 0.65 * down * (1 - up)
}

/** Pulse: 0 -> 1 -> 0 across [a, b] (sin). */
export const pulse = (T: number, a: number, b: number): number => {
  if (T <= a || T >= b) return 0
  return Math.sin(Math.PI * ((T - a) / (b - a)))
}

/**
 * setState only when the computed value changes. Driven by the engine frame
 * loop, so it costs one comparison per frame.
 */
export function useCueState<S>(fn: (T: number) => S): S {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [s, setS] = useState<S>(() => fn(clock.T))
  const last = useRef(s)
  useEffect(() => {
    return onFrame(() => {
      const next = fnRef.current(clock.T)
      if (!Object.is(next, last.current)) {
        last.current = next
        setS(next)
      }
    })
  }, [])
  return s
}
