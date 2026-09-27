import type { FitnessView } from '../lessonTypes'
import type { StoryDef } from '../story/types'

/* =========================================================================
   Chapter registry: view -> lazy StoryDef chunk (DESIGN.md C.1).
   A view listed here renders on the story engine (persistent stage, caption
   card, Notes). A view NOT listed here still renders its legacy
   modules/*Module.tsx page (LessonStage) until its story lands.

   To migrate a chapter: create stories/<view>/story.ts exporting a default
   StoryDef (see story/README.md). It is discovered automatically; the legacy
   module file is deleted at integration.
   ========================================================================= */

type StoryLoader = () => Promise<{ default: StoryDef }>

// Chapters register themselves: any stories/<view>/story.ts with a default
// StoryDef export is picked up here at build time, so chapter builders working
// in parallel never edit this file (and never conflict on it). Each match stays
// its own lazy chunk. _qa/ has no story.ts, so it is never matched.
const FOUND = import.meta.glob<{ default: StoryDef }>('./*/story.ts')

export const STORIES: Partial<Record<FitnessView, StoryLoader>> = Object.fromEntries(
  Object.entries(FOUND).map(([path, load]) => [path.split('/')[1], load]),
) as Partial<Record<FitnessView, StoryLoader>>

/*
 * QA only: `?qa=stub` (read once per page load, kept for in-app navigation)
 * puts a tiny 3-beat stub story on every chapter that has no story yet, so the
 * persistent-stage contract (same canvas across a chapter change) can be
 * tested before a second chapter lands. Never linked from the UI.
 */
const QA_STUB = (() => {
  try {
    return new URLSearchParams(window.location.search).get('qa') === 'stub'
  } catch {
    return false
  }
})()

const loaderFor = (v: FitnessView): (() => Promise<{ default: StoryDef }>) | undefined => {
  const real = STORIES[v]
  if (real) return real
  if (QA_STUB && v !== 'intro') return () => import('./_qa/qaStory').then((m) => ({ default: m.stubStory(v) }))
  return undefined
}

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
