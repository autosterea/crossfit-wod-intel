import { create } from 'zustand'

/* =========================================================================
   08 TECHNIQUE explore state (DESIGN.md C.12, STORYBOARD-technique section
   5): the worked example as an instrument (p. 44). The margin starts at
   12,000. Form at a speed: below the margin Perfect (10,000) or Great (a
   trained speed); at the margin Falls apart (12,000) or Suffers (14,000);
   above it Falls apart. Train only works at the margin: that speed's form
   rises and the margin advances (12,000, 14,000, past 14,000).
   ========================================================================= */

export const SPEEDS = [10000, 12000, 14000] as const
export type SpeedIx = 0 | 1 | 2
/** the margin: the index of the first speed where form falters (3 = past 14,000) */
export type MarginIx = 1 | 2 | 3

export interface TqExploreState {
  speed: SpeedIx
  margin: MarginIx
  /** the viewer just trained this speed (the status line says so until the speed changes) */
  trained: boolean
  graph: boolean
  setSpeed(s: SpeedIx): void
  train(): void
  reset(): void
  setGraph(on: boolean): void
}

export const useTqExplore = create<TqExploreState>((set, get) => ({
  speed: 0,
  margin: 1,
  trained: false,
  graph: false,
  setSpeed: (s) => set({ speed: s, trained: false }),
  train: () => {
    const { speed, margin } = get()
    if (speed !== margin || margin > 2) return
    set({ margin: (margin + 1) as MarginIx, trained: true })
  },
  reset: () => set({ margin: 1, trained: false }),
  setGraph: (on) => set({ graph: on }),
}))

export type FormWord = 'Perfect' | 'Great' | 'Falls apart' | 'Suffers'

/** The form at speed s with the margin at m (p. 44). */
export function formAt(s: number, m: number): FormWord {
  if (s < m) return s === 0 ? 'Perfect' : 'Great'
  if (s === m) return s === 1 ? 'Falls apart' : 'Suffers'
  return 'Falls apart'
}

/** Does form hold at speed s (the dot high, the back lime)? */
export const holds = (s: number, m: number) => s < m

export const marginWord = (m: number) => (m === 1 ? '12,000' : m === 2 ? '14,000' : 'Past 14,000')

export function statusLine(st: Pick<TqExploreState, 'speed' | 'margin' | 'trained'>): string {
  if (st.trained) return 'Great here. The next step is the next speed.'
  if (st.speed < st.margin) return 'Moving well: pick up the speed.'
  if (st.speed === st.margin) return 'Form falters here. Do not slow down: fix it at this speed.'
  return 'Form falls apart. Work the band where it first falters.'
}

/** Seed from the beat the viewer left (STORYBOARD-technique section 5). */
export function seedExplore(beat: number): void {
  if (beat >= 8) useTqExplore.setState({ speed: 2, margin: 3, trained: false })
  else if (beat === 7) useTqExplore.setState({ speed: 1, margin: 1, trained: false })
  else useTqExplore.setState({ speed: 0, margin: 1, trained: false })
}
