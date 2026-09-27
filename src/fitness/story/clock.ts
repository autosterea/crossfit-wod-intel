/* =========================================================================
   The story clock (DESIGN.md C.3): ONE mutable object, never React state.
   Scenes read it inside useFrame. T = index + t. The index is explicit (not
   floor(T)) so a beat can HOLD at t = 1 while its caption stays on screen;
   continuity (N, 1) == (N + 1, 0) makes that invisible to the scene.
   ========================================================================= */

export interface StoryClock {
  /** global story time shown = index + t */
  T: number
  /** current beat, clamped to [0, beats - 1] */
  index: number
  /** progress inside the beat, 0..1 */
  t: number
  /** ambient seconds (L5). Frozen as T x 2.5 whenever the story is held. */
  A: number
  /** true after a URL / QA / transcript seek until play() or navigation */
  held: boolean
  /** increments whenever T or A changes (dirty checks) */
  version: number
  /** beat count of the active chapter */
  beats: number
}

export const clock: StoryClock = { T: 0, index: 0, t: 0, A: 0, held: false, version: 0, beats: 1 }

const clampN = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

/** Set beat + progress exactly. */
export function setIT(index: number, t: number): void {
  const i = clampN(Math.floor(index), 0, Math.max(0, clock.beats - 1))
  const tt = clampN(t, 0, 1)
  if (i === clock.index && tt === clock.t) return
  clock.index = i
  clock.t = tt
  clock.T = i + tt
  clock.version++
}

/** Set global time exactly (scrubbing). The last beat's end maps to t = 1. */
export function setT(T: number): void {
  const Tc = clampN(T, 0, clock.beats)
  let i = Math.floor(Tc)
  if (i >= clock.beats) i = clock.beats - 1
  setIT(i, Tc - i)
}

export function setA(A: number): void {
  if (A === clock.A) return
  clock.A = A
  clock.version++
}

export function resetClock(beats: number): void {
  clock.beats = Math.max(1, beats)
  clock.index = 0
  clock.t = 0
  clock.T = 0
  clock.A = 0
  clock.held = false
  clock.version++
}

/* ------------------------- frame listeners ---------------------------- */
/* DOM parts of the engine (play ring, progress hairline, HUD counters) update
   through refs from one loop, right after the clock ticks. */

export type FrameListener = (dt: number) => void
const listeners = new Set<FrameListener>()

export function onFrame(fn: FrameListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function emitFrame(dt: number): void {
  for (const fn of listeners) fn(dt)
}
