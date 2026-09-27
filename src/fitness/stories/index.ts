import type { FitnessView } from '../lessonTypes'
import type { StoryDef } from '../story/types'

/* =========================================================================
   Chapter registry: view -> lazy StoryDef chunk (DESIGN.md C.1).
   A view listed here renders on the story engine (persistent stage, caption
   card, Notes). A view NOT listed here still renders its legacy
   modules/*Module.tsx page (LessonStage) until its story lands.

   To migrate a chapter: create stories/<view>/story.ts exporting a default
   StoryDef (see story/README.md), add one line below, then delete the
   legacy module file.
   ========================================================================= */

export const STORIES: Partial<Record<FitnessView, () => Promise<{ default: StoryDef }>>> = {
  definition: () => import('./definition/story'),
}

const cache = new Map<FitnessView, StoryDef>()

export const hasStory = (v: FitnessView): boolean => !!STORIES[v]
export const cachedStory = (v: FitnessView): StoryDef | undefined => cache.get(v)

export async function loadStory(v: FitnessView): Promise<StoryDef | null> {
  const hit = cache.get(v)
  if (hit) return hit
  const loader = STORIES[v]
  if (!loader) return null
  const mod = await loader()
  cache.set(v, mod.default)
  return mod.default
}

/** Warm the next chapter's chunk when the browser is idle. */
export function prefetchStory(v: FitnessView): void {
  if (!STORIES[v] || cache.has(v)) return
  const run = () => void loadStory(v).catch(() => undefined)
  const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(run)
  else window.setTimeout(run, 1200)
}
