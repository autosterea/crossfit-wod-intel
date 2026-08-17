import { create } from 'zustand'

export type GamesView = 'home' | 'year' | 'evolution' | 'movements' | 'lore' | 'capacity' | 'hub' | 'athlete' | 'cards' | 'intel' | 'analysis' | 'events' | 'rescore'

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
  cards: 'Card Studio - CF Games Update',
  intel: 'Athlete Intelligence - 2026 CrossFit Games | Persistence Athletics',
  analysis: 'The Breakdown - 2026 CrossFit Games Analysis | Persistence Athletics',
  events: 'The 20 Events - 2026 CrossFit Games Tracker | Persistence Athletics',
  rescore: 'The Re-Score Machine - 2026 CrossFit Games What-If | Persistence Athletics',
}

export function parseGamesPath(pathname: string): GamesRoute {
  const seg = pathname.replace(/^\/games\/?/, '').replace(/\/+$/, '')
  const athlete = seg.match(/^2026\/athlete\/([a-z0-9-]+)$/)
  if (athlete) return { view: 'athlete', year: 2026, slug: athlete[1] }
  const analysisPost = seg.match(/^analysis\/([a-z0-9-]+)$/)
  if (analysisPost) return { view: 'analysis', year: 2026, slug: analysisPost[1] }
  if (seg === 'analysis') return { view: 'analysis', year: 2026 }
  if (seg === '2026/events') return { view: 'events', year: 2026 }
  if (seg === '2026/intel') return { view: 'intel', year: 2026 }
  if (seg === '2026/rescore') return { view: 'rescore', year: 2026 }
  if (seg === '2026') return { view: 'hub', year: 2026 }
  if (seg === 'cards') return { view: 'cards', year: 2026 }
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
  if (route.view === 'intel') return '/games/2026/intel'
  if (route.view === 'rescore') return '/games/2026/rescore'
  if (route.view === 'cards') return '/games/cards'
  if (route.view === 'analysis') return route.slug ? `/games/analysis/${route.slug}` : '/games/analysis'
  if (route.view === 'events') return '/games/2026/events'
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

/** "james-sprague" -> "James Sprague" for a specific tab title (the exact
 *  name + full meta is in the prerendered HTML; this keeps the client tab
 *  title specific instead of a generic "2026 Athlete" after hydration). */
const slugToName = (slug: string) =>
  slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')

const applyTitle = (route: GamesRoute) => {
  if (route.view === 'year' && route.year) {
    document.title = `${route.year} CrossFit Games - Almanac by Persistence Athletics`
  } else if (route.view === 'athlete' && route.slug) {
    // AthleteProfile sets the exact canonical name (preserving diacritics) on mount.
    // Only fall back to the slug-derived name if a title isn't already an athlete one,
    // so we never clobber the component's accurate title with a de-accented slug.
    if (!/2026 CrossFit Games \| Persistence Athletics$/.test(document.title)) {
      document.title = `${slugToName(route.slug)} - 2026 CrossFit Games | Persistence Athletics`
    }
  } else {
    document.title = TITLES[route.view]
  }
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
