import { create } from 'zustand'
import { AVERAGE, N, PROFILE_NAMES, meanOf } from './continuumMath'
import { CONTINUUM_PROFILES } from '../../fitnessData'
import { keySel, selectSpoke } from './keySel'

/* =========================================================================
   Continuum explore state (DESIGN.md C.12, D.6 "Explore"): a per-chapter
   zustand slice. `positions` are the targets the chips, sliders and drag
   handles write; the scene damps its live copy (`live`) toward them, which
   explore allows (determinism is only required in story mode).
   ========================================================================= */

export const CUSTOM = 'Custom'
export const PROFILE_OPTIONS = [...PROFILE_NAMES, CUSTOM]

export interface ContExploreState {
  positions: number[]
  profile: string
  setProfile(name: string): void
  setPos(i: number, p: number): void
}

export const useContExplore = create<ContExploreState>((set) => ({
  positions: AVERAGE.positions.slice(),
  profile: AVERAGE.name,
  setProfile: (name) => {
    if (name === CUSTOM) {
      set({ profile: CUSTOM })
      return
    }
    const p = CONTINUUM_PROFILES.find((q) => q.name === name)
    if (p) set({ profile: name, positions: p.positions.slice() })
  },
  setPos: (i, p) =>
    set((s) => {
      const positions = s.positions.slice()
      positions[i] = Math.max(0, Math.min(1, p))
      return { positions, profile: CUSTOM }
    }),
}))

/** Live (damped) positions shown in explore, advanced by the explore scene every frame. */
export const live = {
  pos: new Float64Array(AVERAGE.positions),
  mean: meanOf(AVERAGE.positions),
  version: 0,
}

/** Jump the live copy to the targets (entering explore, reduced motion). */
export function snapLive(): void {
  const t = useContExplore.getState().positions
  for (let i = 0; i < N; i++) live.pos[i] = t[i]
  live.mean = meanOf(t)
  live.version++
}

/** The selected marker (shared with the portrait key). */
export const selected = (): number => keySel.i
export const select = (i: number): void => selectSpoke(i)
