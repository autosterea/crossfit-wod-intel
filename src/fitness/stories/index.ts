import type { FitnessView } from '../lessonTypes'
import type { StoryDef } from '../story/types'

/* =========================================================================
   Chapter registry: view -> lazy StoryDef chunk (DESIGN.md C.1).
   Every view of the lesson renders on the story engine (persistent stage,
   caption card, Notes); the legacy LessonStage pages were retired at
   integration (DESIGN.md G, H.52).

   A chapter is stories/<view>/story.ts exporting a default StoryDef (see
   story/README.md). It is discovered automatically.
   ========================================================================= */

type StoryLoader = () => Promise<{ default: StoryDef }>

// Chapters register themselves: any stories/<view>/story.ts with a default
// StoryDef export is picked up here at build time, so chapter builders working
// in parallel never edit this file (and never conflict on it). Each match stays
// its own lazy chunk.
const FOUND = import.meta.glob<{ default: StoryDef }>('./*/story.ts')

export const STORIES: Partial<Record<FitnessView, StoryLoader>> = Object.fromEntries(
  Object.entries(FOUND).map(([path, load]) => [path.split('/')[1], load]),
) as Partial<Record<FitnessView, StoryLoader>>

const loaderFor = (v: FitnessView): StoryLoader | undefined => STORIES[v]

const cache = new Map<FitnessView, StoryDef>()

export const hasStory = (v: FitnessView): boolean => !!loaderFor(v)
export const cachedStory = (v: FitnessView): StoryDef | undefined => cache.get(v)

export async function loadStory(v: FitnessView): Promise<StoryDef | null> {
  const hit = cache.get(v)
  if (hit) return hit
  const loader = loaderFor(v)
  if (!loader) return null
  const mod = await loader()
  cache.set(v, mod.default)
  return mod.default
}

/** Warm the next chapter's chunk when the browser is idle. */
export function prefetchStory(v: FitnessView): void {
  if (!loaderFor(v) || cache.has(v)) return
  const run = () => void loadStory(v).catch(() => undefined)
  const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(run)
  else window.setTimeout(run, 1200)
}
