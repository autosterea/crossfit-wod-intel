import { create } from 'zustand'
import { PINS, T_MAX, T_MIN } from './pathwaysMath'
import { clamp } from '../../lessonMath'
import { ENERGY_BENCHMARKS } from '../../fitnessData'

/* Pathways explore state (DESIGN.md D.4 "Explore", C.12): a per-chapter
   zustand slice. The explore scene reads it through getState() inside the
   frame loop (no re-render per scrub event) and damps toward it
   (determinism is not required in explore). */

export interface PwExploreState {
  /** effort duration in seconds, clamped to the axis (3 s to 1 hr) */
  t: number
  /** the chosen benchmark (a chip or a tapped pin), or null after a free scrub */
  bench: string | null
  /** Stacked | Lanes */
  lanes: boolean
  /** Power | Share */
  share: boolean
  setT(t: number): void
  setBench(name: string | null): void
  setLanes(v: boolean): void
  setShare(v: boolean): void
}

/** Clamp to the axis, and settle float noise at its ends: exp(log(3600)) is 3599.99..., which fmtDuration shows as "60 min". */
const onAxis = (t: number): number => {
  const c = clamp(t, T_MIN, T_MAX)
  return c > T_MAX * (1 - 1e-9) ? T_MAX : c < T_MIN * (1 + 1e-9) ? T_MIN : c
}

export const usePwExplore = create<PwExploreState>((set) => ({
  t: 240,
  bench: null,
  lanes: false,
  share: false,
  setT: (t) => set({ t: onAxis(t), bench: null }),
  setBench: (name) => {
    const b = ENERGY_BENCHMARKS.find((x) => x.name === name)
    if (!b) return set({ bench: null })
    set({ bench: b.name, t: onAxis(b.seconds) })
  },
  setLanes: (v) => set({ lanes: v }),
  setShare: (v) => set({ share: v }),
}))

/** Explore seeds per beat (the end state of that beat): cursor duration and benchmark. */
export const EXPLORE_SEED: readonly { t: number; bench: string | null; lanes: boolean }[] = [
  { t: 240, bench: null, lanes: false },
  { t: 10, bench: null, lanes: false },
  { t: 30, bench: null, lanes: false },
  { t: T_MAX, bench: null, lanes: false },
  { t: T_MAX, bench: null, lanes: true },
  { t: 1320, bench: PINS.find((p) => p.seconds === 1320)?.name ?? null, lanes: false },
  { t: 240, bench: PINS.find((p) => p.seconds === 240)?.name ?? null, lanes: false },
]
