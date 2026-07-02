import { lazy, type ComponentType } from 'react'

// After a deploy, the hashed JS chunks change name and the old ones are removed.
// A browser tab still running the OLD app bundle will try to import a chunk that
// no longer exists and fail with "Failed to fetch dynamically imported module"
// (Caddy serves index.html for the missing file, so it arrives as HTML, not JS).
// This wraps a dynamic import so that failure auto-reloads the page ONCE to pull
// the fresh bundle, instead of dead-ending on an error screen. A 10s throttle
// prevents a reload loop if the failure is a genuine build breakage rather than a
// stale chunk.
function isChunkError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || '')
  return /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported|Failed to fetch/i.test(msg)
}

export function importOrReload<T>(factory: () => Promise<T>): Promise<T> {
  return factory().catch((err) => {
    const last = Number(sessionStorage.getItem('chunkReloadAt') || 0)
    if (isChunkError(err) && Date.now() - last > 10000) {
      sessionStorage.setItem('chunkReloadAt', String(Date.now()))
      window.location.reload()
      // never resolves; the page is reloading, so React should not render an error
      return new Promise<T>(() => {})
    }
    throw err
  })
}

// Drop-in replacement for React.lazy that self-heals stale-chunk failures.
export function lazyReload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(() => importOrReload(factory))
}

// Vite fires this when a <link rel=modulepreload> chunk fails to load. Belt and
// suspenders alongside importOrReload (which catches the actual import() reject).
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    const last = Number(sessionStorage.getItem('chunkReloadAt') || 0)
    if (Date.now() - last > 10000) {
      sessionStorage.setItem('chunkReloadAt', String(Date.now()))
      window.location.reload()
    }
  })
}
