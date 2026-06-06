import { create } from 'zustand'

export type GamesView = 'home' | 'year' | 'evolution' | 'movements' | 'lore'

export interface GamesRoute {
  view: GamesView
  year: number | null
}

const TITLES: Record<GamesView, string> = {
  home: 'CrossFit Games Almanac — by Persistence Athletics',
  year: 'CrossFit Games Almanac',
  evolution: 'Evolution — CrossFit Games Almanac',
  movements: 'Movements — CrossFit Games Almanac',
  lore: 'Records & Lore — CrossFit Games Almanac',
}

export function parseGamesPath(pathname: string): GamesRoute {
  const seg = pathname.replace(/^\/games\/?/, '').replace(/\/+$/, '')
  if (/^\d{4}$/.test(seg)) return { view: 'year', year: Number(seg) }
  if (seg === 'evolution' || seg === 'movements' || seg === 'lore') {
    return { view: seg, year: null }
  }
  return { view: 'home', year: null }
}

export function routeToPath(route: GamesRoute): string {
  if (route.view === 'year') return route.year ? `/games/${route.year}` : '/games'
  if (route.view === 'home') return '/games'
  return `/games/${route.view}`
}

interface GamesStore {
  route: GamesRoute
  navigate: (route: GamesRoute, opts?: { replace?: boolean }) => void
  syncFromLocation: () => void
}

const applyTitle = (route: GamesRoute) => {
  document.title =
    route.view === 'year' && route.year
      ? `${route.year} CrossFit Games — Almanac by Persistence Athletics`
      : TITLES[route.view]
}

export const useGamesStore = create<GamesStore>((set) => ({
  route: parseGamesPath(window.location.pathname),
  navigate: (route, opts) => {
    const path = routeToPath(route)
    // Re-navigating to the current path must not stack duplicate history entries
    const samePath = window.location.pathname.replace(/\/+$/, '') === path.replace(/\/+$/, '')
    if (opts?.replace || samePath) window.history.replaceState(null, '', path)
    else window.history.pushState(null, '', path)
    applyTitle(route)
    window.scrollTo({ top: 0 })
    set({ route })
  },
  syncFromLocation: () => {
    const route = parseGamesPath(window.location.pathname)
    applyTitle(route)
    set({ route })
  },
}))
