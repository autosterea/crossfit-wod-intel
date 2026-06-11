import { create } from 'zustand'
import type { FitnessView } from './lessonTypes'
import { MODULES, moduleByKey } from './fitnessData'

export interface FitnessRoute {
  view: FitnessView
}

const slugToView: Record<string, FitnessView> = Object.fromEntries(
  MODULES.map((m) => [m.slug, m.key]),
) as Record<string, FitnessView>

export function parseFitnessPath(pathname: string): FitnessRoute {
  const seg = pathname.replace(/^\/fitness\/?/, '').replace(/\/+$/, '')
  if (seg && slugToView[seg]) return { view: slugToView[seg] }
  return { view: 'intro' }
}

export function routeToPath(route: FitnessRoute): string {
  if (route.view === 'intro') return '/fitness'
  return `/fitness/${moduleByKey(route.view).slug}`
}

function titleFor(route: FitnessRoute): string {
  if (route.view === 'intro') return 'What Is Fitness? - An interactive lesson by Persistence Athletics'
  return `${moduleByKey(route.view).title} - What Is Fitness?`
}

interface FitnessStore {
  route: FitnessRoute
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
