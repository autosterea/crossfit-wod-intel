import { create } from 'zustand'
import type { ModuleKey } from '../../lessonTypes'

/* Intro explore state (DESIGN.md C.12, D.1 "Explore (intro)"): which of the
   six models is previewed in the panel. The tiles stay tappable and open
   their chapter; the chip row picks the model the panel describes and the
   map lights its tile. */

export interface IntroExploreState {
  sel: ModuleKey
  setSel(k: ModuleKey): void
}

export const useIntroExplore = create<IntroExploreState>((set) => ({
  sel: 'skills',
  setSel: (k) => set({ sel: k }),
}))
