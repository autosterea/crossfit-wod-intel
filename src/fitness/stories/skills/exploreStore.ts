import { create } from 'zustand'
import { GENERALIST } from './skillsMath'

/* Skills explore state (DESIGN.md C.12, D.2 "Explore"): a per-chapter
   zustand slice. The explore scene reads it through refs and selectors and
   damps toward it (determinism is not required in explore). */

export const CUSTOM = 'Custom'
export const NONE = 'None'

export type SkView = 'wheel' | 'grid'

export interface SkExploreState {
  /** athlete A: an ARCHETYPES name or Custom */
  athlete: string
  /** athlete B (the dashed chalk comparison): an ARCHETYPES name or None */
  compare: string
  /** the Custom profile, ten values 0..10 */
  custom: number[]
  view: SkView
  /** the tapped skill (its definition shows), or null */
  info: number | null
  /** bumps each time explore opens (the drag handles pulse once) */
  enter: number
  setAthlete(name: string): void
  setCompare(name: string): void
  /** set one Custom value; switches A to Custom (starting from A's current profile) */
  setSkill(i: number, v: number, from: readonly number[]): void
  setView(v: SkView): void
  setInfo(i: number | null): void
  bumpEnter(): void
}

export const useSkExplore = create<SkExploreState>((set) => ({
  athlete: GENERALIST.name,
  compare: NONE,
  custom: GENERALIST.profile.slice(),
  view: 'wheel',
  info: null,
  enter: 0,
  setAthlete: (name) => set({ athlete: name }),
  setCompare: (name) => set({ compare: name }),
  setSkill: (i, v, from) =>
    set((s) => {
      const base = s.athlete === CUSTOM ? s.custom : from
      const next = base.slice()
      next[i] = Math.max(0, Math.min(10, Math.round(v * 10) / 10))
      return { athlete: CUSTOM, custom: next }
    }),
  setView: (v) => set({ view: v }),
  setInfo: (i) => set({ info: i }),
  bumpEnter: () => set((s) => ({ enter: s.enter + 1 })),
}))
