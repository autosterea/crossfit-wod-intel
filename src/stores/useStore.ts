import { create } from 'zustand'

type Tab =
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

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme)
}

export const useStore = create<AppStore>((set) => ({
  activeTab: 'hero',
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
