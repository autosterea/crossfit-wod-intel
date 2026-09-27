import { create } from 'zustand'
import { GENERALIST } from './definitionMath'

/* Definition explore state (DESIGN.md C.12): a per-chapter zustand slice.
   The explore scene reads it through selectors and refs; motion here is
   damped (determinism is not required in explore). */

export interface DefExploreState {
  athlete: string
  showDomains: boolean
  ghost: boolean
  /** scrub probe position (u), or null */
  probe: number | null
  /** bumps whenever the athlete changes (replays spill / condense) */
  replay: number
  setAthlete(name: string): void
  setShowDomains(v: boolean): void
  setGhost(v: boolean): void
  setProbe(u: number | null): void
}

export const useDefExplore = create<DefExploreState>((set) => ({
  athlete: GENERALIST.name,
  showDomains: false,
  ghost: true,
  probe: null,
  replay: 0,
  setAthlete: (name) => set((s) => ({ athlete: name, replay: s.replay + 1 })),
  setShowDomains: (v) => set({ showDomains: v }),
  setGhost: (v) => set({ ghost: v }),
  setProbe: (u) => set({ probe: u }),
}))
