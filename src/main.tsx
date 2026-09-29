/* eslint-disable react-refresh/only-export-components -- entry point, never hot-refreshed */
import { StrictMode, Suspense, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { lazyReload } from './lazyReload'

// Both apps are lazy so each route only downloads its own bundle:
// '/' loads the main app (which then fetches the daily-WOD dataset from
// /data/crossfit-data.json as a static file - not bundled), '/games'
// loads the Games Almanac (incl. its own data) — never both. lazyReload self-heals
// a stale-chunk failure after a deploy by reloading once (see src/lazyReload.ts).
const App = lazyReload(() => import('./App.tsx'))
const GamesApp = lazyReload(() => import('./games/GamesApp.tsx'))
const FitnessApp = lazyReload(() => import('./fitness/FitnessApp.tsx'))
const NewsApp = lazyReload(() => import('./news/NewsApp.tsx'))

// /games, /fitness and /news are standalone pages served by the same SPA
// bundle — Caddy's `try_files {path} /index.html` routes them here. Each is
// lazy so a visitor only downloads the chunk for the route they land on.
// The deploy base ('/' in production, '/preview/' for the owner's review
// build) is stripped before matching, so /preview/fitness routes like /fitness.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const rawPath = window.location.pathname
const basePath = BASE && (rawPath === BASE || rawPath.startsWith(BASE + '/')) ? rawPath.slice(BASE.length) || '/' : rawPath
const path = basePath.replace(/\/+$/, '')
const isGames = path === '/games' || basePath.startsWith('/games/')
const isFitness = path === '/fitness' || basePath.startsWith('/fitness/')
const isNews = path === '/news' || basePath.startsWith('/news/')

// The lesson's current chapter starts downloading with the lesson shell, not
// after it (the shell must load and run three before it asks for the chapter;
// fitness-v2 fix round 1). Same module instance as the shell's loader, so the
// shell finds it cached or in flight.
if (isFitness) {
  const slug = path.startsWith('/fitness/') ? path.slice('/fitness/'.length) : 'intro'
  void import('./fitness/stories')
    .then((m) => m.loadStory(slug as Parameters<typeof m.loadStory>[0]))
    .catch(() => undefined)
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-screen p-6">
          <div className="max-w-md text-center">
            <h1 className="text-lg font-bold text-red-400 mb-2">Something went wrong</h1>
            <pre className="text-xs text-[var(--text-tertiary)] whitespace-pre-wrap mb-4">{this.state.error.message}</pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm rounded-lg bg-[#019644] text-white"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function BootFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-12 h-12 border-2 border-[#91C640]/30 border-t-[#91C640] rounded-full animate-spin" />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <Suspense fallback={<BootFallback />}>
        {isGames ? <GamesApp /> : isFitness ? <FitnessApp /> : isNews ? <NewsApp /> : <App />}
      </Suspense>
    </RootErrorBoundary>
  </StrictMode>,
)
