// Real URL routing for the main WOD app. Each analysis tab maps to a clean,
// indexable top-level path (e.g. /dashboard, /methodology, /movements). The
// slug map is shared with the build-time prerender (scripts/seo-routes.mjs
// reads the same src/data/app-routes.json), so the served HTML, the sitemap,
// and the client stay in sync.
import appRoutesRaw from './data/app-routes.json'
import { useStore, type Tab } from './stores/useStore'

export interface AppRoute {
  tab: string
  slug: string
  title: string
  description: string
}
export const APP_ROUTES = appRoutesRaw as AppRoute[]

const SLUG_TO_TAB = new Map(APP_ROUTES.map((r) => [r.slug, r.tab]))
const TAB_TO_SLUG = new Map(APP_ROUTES.map((r) => [r.tab, r.slug]))

const segOf = (pathname: string) => pathname.replace(/^\/+|\/+$/g, '')

/** Active tab id for a pathname; 'hero' for the root or any unknown path. */
export function tabForPath(pathname: string): Tab {
  const s = segOf(pathname)
  if (!s) return 'hero'
  return (SLUG_TO_TAB.get(s) ?? 'hero') as Tab
}

/** Canonical path for a tab id ('/' for the hero landing). */
export function pathForTab(tab: string): string {
  if (tab === 'hero') return '/'
  const slug = TAB_TO_SLUG.get(tab)
  return slug ? `/${slug}` : '/'
}

/** Navigate the main app to a tab: pushState (so the URL is shareable and the
 *  back button works) then set the active tab. */
export function navigateTab(tab: string): void {
  const path = pathForTab(tab)
  const cur = window.location.pathname.replace(/\/+$/, '') || '/'
  if (cur !== (path.replace(/\/+$/, '') || '/')) window.history.pushState(null, '', path)
  useStore.getState().setActiveTab(tab as Tab)
  window.scrollTo({ top: 0 })
}
