import { create } from 'zustand'
import { ALL_PROFILES, LIFELONG } from './healthMath'

/* Health explore state (DESIGN.md C.12, D.7 "Explore"): a per-chapter
   zustand slice. The scene reads it through getState() inside its frame
   loop and damps toward it (determinism is not required in explore). */

export interface HealthExploreState {
  /** one of ALL_PROFILES (all seven in explore, F.6) */
  profile: string
  /** the amber age slice, 20 to 85 */
  age: number
  /** the independence line on or off */
  showLine: boolean
  /** the Lifelong trainer ghost for comparison */
  compare: boolean
  setProfile(name: string): void
  setAge(age: number): void
  setShowLine(v: boolean): void
  setCompare(v: boolean): void
}

export const useHealthExplore = create<HealthExploreState>((set) => ({
  profile: LIFELONG.name,
  age: 45,
  showLine: true,
  compare: true,
  setProfile: (name) => set({ profile: ALL_PROFILES.some((p) => p.name === name) ? name : LIFELONG.name }),
  setAge: (age) => set({ age: Math.max(20, Math.min(85, Math.round(age))) }),
  setShowLine: (v) => set({ showLine: v }),
  setCompare: (v) => set({ compare: v }),
}))

export const profileByName = (name: string) => ALL_PROFILES.find((p) => p.name === name) ?? LIFELONG
