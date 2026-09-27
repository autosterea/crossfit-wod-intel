import { create } from 'zustand'
import type { FitnessView } from './lessonTypes'
import { MODULES, moduleByKey } from './fitnessData'
import { BASE, stripBase } from './story/url'

export interface FitnessRoute {
  view: FitnessView
}

const slugToView: Record<string, FitnessView> = Object.fromEntries(
  MODULES.map((m) => [m.slug, m.key]),
) as Record<string, FitnessView>

/**
 * Route from a pathname. The deploy base (import.meta.env.BASE_URL, '/' in
 * production and '/preview/' for the owner's review build) is stripped
 * first, so '/fitness/definition' and '/preview/fitness/definition' match
 * the same view. The query (?beat ?t ?explore) is read by the story engine.
 */
export function parseFitnessPath(pathname: string): FitnessRoute {
  const p = stripBase(pathname)
  const seg = p.replace(/^\/fitness\/?/, '').replace(/\/+$/, '')
  if (seg && slugToView[seg]) return { view: slugToView[seg] }
  return { view: 'intro' }
}

export function routeToPath(route: FitnessRoute): string {
  if (route.view === 'intro') return `${BASE}/fitness`
  return `${BASE}/fitness/${moduleByKey(route.view).slug}`
}

function titleFor(route: FitnessRoute): string {
  if (route.view === 'intro') return 'What Is Fitness? - An interactive lesson by Persistence Athletics'
  return `${moduleByKey(route.view).title} - What Is Fitness?`
}

interface FitnessStore {
  route: FitnessRoute
  /** Navigation drops the query string (DESIGN.md C.4). */
  navigate: (route: FitnessRoute, opts?: { replace?: boolean }) => void
  syncFromLocation: () => void
}

const applyTitle = (route: FitnessRoute) => {
  document.title = titleFor(route)
}

export const useFitnessStore = create<FitnessStore>((set) => ({
  route: parseFitnessPath(window.location.pathname),
  navigate: (route, opts) => {
    const path = routeToPath(route)
    const samePath = window.location.pathname.replace(/\/+$/, '') === path.replace(/\/+$/, '')
    if (opts?.replace || samePath) window.history.replaceState(null, '', path)
    else window.history.pushState(null, '', path)
    applyTitle(route)
    window.scrollTo({ top: 0 })
    set({ route })
  },
  syncFromLocation: () => {
    const route = parseFitnessPath(window.location.pathname)
    applyTitle(route)
    set({ route })
  },
}))
