import { create } from 'zustand'
import { LEVELS } from './crossfitMath'
import { DEFICIENT } from './timeline'

/* 07 CROSSFIT explore state (DESIGN.md C.12, STORYBOARD-crossfit.md
   "Explore"): the pyramid as an instrument. Every level carries its own
   deficiency (0..1); the scene follows it damped (determinism is not
   required in explore). */

export interface CfExploreState {
  /** the picked level (0 nutrition .. 4 sport) */
  level: number
  /** deficiency per level, 0..1 */
  def: number[]
  setLevel(i: number): void
  setDef(i: number, v: number): void
  repair(): void
}

const zeros = () => Array.from({ length: LEVELS }, () => 0)

export const useCfExplore = create<CfExploreState>((set) => ({
  level: 0,
  def: zeros(),
  setLevel: (i) => set({ level: i }),
  setDef: (i, v) =>
    set((s) => {
      const def = s.def.slice()
      def[i] = Math.max(0, Math.min(1, v))
      return { def }
    }),
  repair: () => set({ def: zeros() }),
}))

/** Seed explore from the beat the viewer left: from C6 on, the story's deficiency; otherwise a whole pyramid. */
export function seedExplore(beat: number): void {
  const s = useCfExplore.getState()
  if (beat === 6) {
    const def = zeros()
    def[DEFICIENT] = 0.7
    useCfExplore.setState({ level: DEFICIENT, def })
  } else {
    s.repair()
    useCfExplore.setState({ level: beat >= 5 ? 0 : DEFICIENT })
  }
}
