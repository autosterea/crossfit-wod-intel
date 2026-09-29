import type { Detent, Tier } from './types'

/* =========================================================================
   URL contract (DESIGN.md C.4) and base-path helpers (C.14). The app is
   served at '/' in production and at '/preview/' for the owner's review
   deploy, so every in-app path goes through BASE.
   ========================================================================= */

/** import.meta.env.BASE_URL without its trailing slash: '' or '/preview'. */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

/** Prefix an app-absolute path ('/fitness/x') with the base. */
export const withBase = (path: string): string => `${BASE}${path.startsWith('/') ? path : '/' + path}`

/** Strip the base from a pathname ('/preview/fitness' -> '/fitness'). */
export function stripBase(pathname: string): string {
  if (BASE && (pathname === BASE || pathname.startsWith(BASE + '/'))) {
    const rest = pathname.slice(BASE.length)
    return rest || '/'
  }
  return pathname
}

/** A public asset under the base (fonts, logo). */
export const asset = (file: string): string => import.meta.env.BASE_URL + file.replace(/^\//, '')

export interface StoryQuery {
  beat: number | null
  t: number | null
  explore: boolean
  tier: Tier | null
  motion: 'reduce' | 'full' | null
  detent: Detent | null
}

export function parseQuery(search: string = window.location.search): StoryQuery {
  const q = new URLSearchParams(search)
  const num = (k: string): number | null => {
    const v = q.get(k)
    if (v === null || v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const tier = q.get('tier')
  const motion = q.get('motion')
  const detent = q.get('detent')
  return {
    beat: num('beat'),
    t: num('t'),
    explore: q.get('explore') === '1' || q.get('explore') === 'true',
    tier: tier === 'high' || tier === 'medium' || tier === 'low' ? tier : null,
    motion: motion === 'reduce' || motion === 'full' ? motion : null,
    detent: detent === 'peek' || detent === 'default' || detent === 'expanded' ? detent : null,
  }
}

/** Remove the given keys from the query with replaceState (play() clears beat and t). */
export function dropQueryKeys(keys: readonly string[]): void {
  try {
    const url = new URL(window.location.href)
    let changed = false
    for (const k of keys) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k)
        changed = true
      }
    }
    if (changed) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    /* ignore */
  }
}
