/* eslint-disable react-refresh/only-export-components -- entry point, never hot-refreshed */
import { StrictMode, lazy, Suspense, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Both apps are lazy so each route only downloads its own bundle:
// '/' loads the main app (incl. the 2.6MB daily-WOD dataset), '/games'
// loads the Games Almanac (incl. its own data) — never both.
const App = lazy(() => import('./App.tsx'))
const GamesApp = lazy(() => import('./games/GamesApp.tsx'))

// /games is a standalone page (CrossFit Games analysis) served by the same
// SPA bundle — Caddy's `try_files {path} /index.html` routes it here.
const isGames =
  window.location.pathname.replace(/\/+$/, '') === '/games' ||
  window.location.pathname.startsWith('/games/')

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
      <Suspense fallback={<BootFallback />}>{isGames ? <GamesApp /> : <App />}</Suspense>
    </RootErrorBoundary>
  </StrictMode>,
)
