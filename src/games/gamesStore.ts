import { create } from 'zustand'

export type GamesView = 'home' | 'year' | 'evolution' | 'movements' | 'lore' | 'capacity' | 'hub' | 'athlete'

export interface GamesRoute {
  view: GamesView
  year: number | null
  slug?: string | null
}

const TITLES: Record<GamesView, string> = {
  home: 'CrossFit Games Almanac - by Persistence Athletics',
  year: 'CrossFit Games Almanac',
  evolution: 'Evolution - CrossFit Games Almanac',
  movements: 'Movements - CrossFit Games Almanac',
  lore: 'Records & Lore - CrossFit Games Almanac',
  capacity: 'Capacity Lab - CrossFit Games Almanac',
  hub: '2026 CrossFit Games - Persistence Athletics',
  athlete: '2026 Athlete - CrossFit Games',
}

export function parseGamesPath(pathname: string): GamesRoute {
  const seg = pathname.replace(/^\/games\/?/, '').replace(/\/+$/, '')
  const athlete = seg.match(/^2026\/athlete\/([a-z0-9-]+)$/)
  if (athlete) return { view: 'athlete', year: 2026, slug: athlete[1] }
  if (seg === '2026') return { view: 'hub', year: 2026 }
  const capacityYear = seg.match(/^capacity\/(\d{4})$/)
  if (capacityYear) return { view: 'capacity', year: Number(capacityYear[1]) }
  if (seg === 'capacity') return { view: 'capacity', year: null }
  if (seg === 'evolution' || seg === 'movements' || seg === 'lore') {
    return { view: seg, year: null }
  }
  if (/^\d{4}$/.test(seg)) return { view: 'year', year: Number(seg) }
  return { view: 'home', year: null }
}

export function routeToPath(route: GamesRoute): string {
  if (route.view === 'hub') return '/games/2026'
  if (route.view === 'athlete') return `/games/2026/athlete/${route.slug ?? ''}`
  if (route.view === 'year') return route.year ? `/games/${route.year}` : '/games'
  if (route.view === 'capacity') return route.year ? `/games/capacity/${route.year}` : '/games/capacity'
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
      ? `${route.year} CrossFit Games - Almanac by Persistence Athletics`
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
