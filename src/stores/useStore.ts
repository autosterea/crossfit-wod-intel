import { create } from 'zustand'
import appRoutes from '../data/app-routes.json'

export type Tab =
  | 'hero'
  | 'daily'
  | 'overview'
  | 'reportcard'
  | 'movmap'
  | 'movpairs'
  | 'force3d'
  | 'heatmap3d'
  | 'skills'
  | 'functional'
  | 'energy'
  | 'workcap'
  | 'variance'
  | 'hopper'
  | 'network'
  | 'movement-dna'
  | 'timeline'
  | 'eras'
  | 'patterns'
  | 'calendar'
  | 'headtohead'
  | 'decoder'
  | 'gaps'
  | 'encyclopedia'
  | 'catalog'
  | 'named'
  | 'repsloading'
  | 'methodology'

type Theme = 'dark' | 'light'

interface AppStore {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  selectedMovement: string | null
  setSelectedMovement: (m: string | null) => void
  hoveredNode: string | null
  setHoveredNode: (n: string | null) => void
  yearRange: [number, number]
  setYearRange: (range: [number, number]) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  theme: Theme
  setTheme: (t: Theme) => void
}

const initialTheme: Theme = (() => {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
})()

/** Initial tab derived from the URL so deep links + prerendered routes land on
 *  the right view with no flash (e.g. /dashboard -> overview, / -> hero). */
const initialTab: Tab = (() => {
  // Land visitors straight on Today's WOD (the data), not a splash gate. The
  // branded hero is still reachable via the sidebar logo (navigateTab('hero')).
  if (typeof window === 'undefined') return 'daily'
  const seg = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (!seg) return 'daily'
  const found = (appRoutes as { tab: string; slug: string }[]).find((r) => r.slug === seg)
  return (found ? found.tab : 'daily') as Tab
})()

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme)
}

export const useStore = create<AppStore>((set) => ({
  activeTab: initialTab,
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedMovement: null,
  setSelectedMovement: (m) => set({ selectedMovement: m }),
  hoveredNode: null,
  setHoveredNode: (n) => set({ hoveredNode: n }),
  yearRange: [2001, 2026] as [number, number],
  setYearRange: (range) => set({ yearRange: range }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  theme: initialTheme,
  setTheme: (t) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t)
      localStorage.setItem('theme', t)
    }
    set({ theme: t })
  },
}))
