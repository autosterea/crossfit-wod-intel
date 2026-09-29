import { clock } from '../clock'
import { useStoryStore } from '../store'
import { pulse } from '../cue'

/* Impact accent (DESIGN.md B.10): at most one per chapter, declared on the
   beat as `impact: [a, b]` (beat t). Returns sin(pi k) inside the window, 0
   elsewhere and under reduced motion. Post.tsx adds 0.6 x this to the bloom
   intensity; the speaking element multiplies its emissive by 1 + 0.8 x this. */
export function impactK(T: number = clock.T): number {
  const st = useStoryStore.getState()
  if (st.reduced || st.mode === 'explore') return 0
  const def = st.def
  if (!def) return 0
  const n = Math.min(def.beats.length - 1, Math.floor(T))
  const b = def.beats[n]
  if (!b?.impact) return 0
  return pulse(T, n + b.impact[0], n + b.impact[1])
}
