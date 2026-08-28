import { Suspense, useEffect, useRef, Component, type ReactNode } from 'react'
import { lazyReload as lazy } from '../lazyReload'
import './games.css'
import ThemeToggle from '../components/ThemeToggle'
import { useGamesStore } from './gamesStore'
import { G } from './gamesData'
import YearRibbon from './YearRibbon'
import GamesHero from './GamesHero'
import TimelineView from './TimelineView'

const YearView = lazy(() => import('./YearView'))
const EvolutionView = lazy(() => import('./EvolutionView'))
const MovementsView = lazy(() => import('./MovementsView'))
const LoreView = lazy(() => import('./LoreView'))
const CapacityView = lazy(() => import('./CapacityView'))
const Hub2026 = lazy(() => import('./Hub2026'))
const AthleteProfile = lazy(() => import('./AthleteProfile'))
const CardStudio = lazy(() => import('./CardStudio'))
const IntelView = lazy(() => import('./IntelView'))
const AnalysisView = lazy(() => import('./analysis/AnalysisView'))
const EventsView = lazy(() => import('./events/EventsView'))
const RescoreView = lazy(() => import('./RescoreView'))
const H2HView = lazy(() => import('./H2HView'))

class ViewErrorBoundary extends Component<{ children: ReactNode; name: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 my-8 bg-red-500/10 border border-red-500/30 rounded-xl">
          <h3 className="text-red-400 font-bold text-sm mb-2">Error in {this.props.name}</h3>
          <pre className="text-xs text-red-600/80 whitespace-pre-wrap">{this.state.error.message}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const NAV: { view: 'hub' | 'home' | 'evolution' | 'movements' | 'lore' | 'capacity' | 'intel' | 'analysis'; label: string; mobileLabel?: string }[] = [
  { view: 'hub', label: '2026 Games', mobileLabel: '2026' },
  { view: 'capacity', label: 'Capacity Lab', mobileLabel: 'Capacity' },
  { view: 'intel', label: 'Intelligence', mobileLabel: 'Intel' },
  { view: 'analysis', label: 'The Breakdown', mobileLabel: 'Breakdown' },
  { view: 'home', label: 'Timeline' },
  { view: 'evolution', label: 'Evolution' },
  { view: 'movements', label: 'Movements' },
  { view: 'lore', label: 'Records & Lore', mobileLabel: 'Lore' },
]

function TopBar() {
  const route = useGamesStore((s) => s.route)
  const navigate = useGamesStore((s) => s.navigate)
  // Child routes highlight their parent section (athlete pages live under the
  // 2026 hub; year pages under the timeline) so the nav always shows location.
  const activeView = route.view === 'athlete' ? 'hub' : route.view === 'year' ? 'timeline' : route.view
  // Keep the active pill visible in the scrollable mobile row on load/navigation.
  const activeMobileRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    activeMobileRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [activeView])
  return (
    <header className="games-topbar sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate({ view: 'home', year: null })}
          className="flex items-center gap-2.5 shrink-0"
          aria-label="Games Almanac home"
        >
          <div className="w-8 h-8 rounded-full bg-white p-0.5 shrink-0">
            <img src="/pa-logo.png" alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="games-display text-lg text-[var(--text-primary)] leading-none mt-0.5">
            Games <span className="text-[#91C640]">Almanac</span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => navigate({ view: n.view, year: null })}
              className="games-condensed uppercase tracking-[0.1em] text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                color: activeView === n.view ? '#91C640' : 'var(--text-secondary)',
                background: activeView === n.view ? 'rgba(145,198,64,0.1)' : 'transparent',
              }}
            >
              {n.label}
            </button>
          ))}
          <a
            href="/news"
            className="games-condensed uppercase tracking-[0.1em] text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[#91C640]"
          >
            News
          </a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/fitness"
            className="games-condensed hidden lg:block uppercase tracking-[0.1em] text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)] hover:border-[#91C640]/50 hover:text-[#91C640] transition-colors"
          >
            What Is Fitness?
          </a>
          <a
            href="/"
            className="games-condensed hidden sm:block uppercase tracking-[0.1em] text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)] hover:border-[#91C640]/50 hover:text-[#91C640] transition-colors"
          >
            Daily WOD Intel →
          </a>
          <ThemeToggle size="md" />
        </div>
      </div>

      {/* Mobile nav row (scrollable so all sections fit without squishing) */}
      <div className="md:hidden border-t border-[var(--panel-border-subtle)]">
        <div className="flex items-center gap-1 h-10 overflow-x-auto px-3 no-scrollbar">
          {NAV.map((n) => (
            <button
              key={n.view}
              ref={activeView === n.view ? activeMobileRef : undefined}
              onClick={() => navigate({ view: n.view, year: null })}
              className="games-condensed uppercase tracking-[0.08em] text-[12px] font-semibold px-2.5 py-1 rounded-md shrink-0 whitespace-nowrap transition-colors"
              style={{
                color: activeView === n.view ? '#91C640' : 'var(--text-secondary)',
                background: activeView === n.view ? 'rgba(145,198,64,0.12)' : 'transparent',
              }}
            >
              {n.mobileLabel ?? n.label}
            </button>
          ))}
          <a href="/news" className="games-condensed uppercase tracking-[0.08em] text-[12px] font-semibold px-2.5 py-1 shrink-0 whitespace-nowrap text-[var(--text-secondary)]">News</a>
        </div>
      </div>
    </header>
  )
}

function GamesFooter() {
  return (
    <footer className="mt-16 mb-8 pt-6 border-t border-[var(--panel-border)] px-4">
      <div className="max-w-6xl mx-auto text-center space-y-3">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white p-1 shrink-0">
            <img src="/pa-logo.png" alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              A <a href="https://persistenceathletics.com" target="_blank" rel="noopener noreferrer" className="text-[#91C640] hover:text-[#a8d35e]">Persistence Athletics</a> tool
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">Built by Ravikant Dewangan, Head Coach (MS S&C, CCFT)</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--text-muted)]">
          <span>Platform by</span>
          <a href="https://autosterea.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-tertiary)] transition-colors">Autosterea</a>
          <span>|</span>
          <a href="/news" className="hover:text-[var(--text-tertiary)] transition-colors">CrossFit Now</a>
          <span>|</span>
          <a href="/" className="hover:text-[var(--text-tertiary)] transition-colors">Daily WOD Intelligence</a>
        </div>
        <div className="text-[11px] sm:text-[10px] text-[var(--text-muted)] leading-relaxed max-w-xl mx-auto">
          <p>
            Event data researched from public archives (games.crossfit.com, Wikipedia, contemporary reporting). CrossFit and the CrossFit Games are registered trademarks of CrossFit, LLC. This project is not affiliated with, endorsed by, or sponsored by CrossFit, LLC. Data is presented for educational and analytical purposes only.
          </p>
        </div>
      </div>
    </footer>
  )
}

function ViewLoading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-10 h-10 border-2 border-[#91C640]/30 border-t-[#91C640] rounded-full animate-spin" />
    </div>
  )
}

function EmptyDataset() {
  return (
    <div className="max-w-xl mx-auto text-center py-24 px-4">
      <div className="games-display text-3xl text-[var(--text-primary)] mb-3">Dataset building</div>
      <p className="text-sm text-[var(--text-secondary)]">
        The Games archive is being compiled. Check back shortly.
      </p>
    </div>
  )
}

export default function GamesApp() {
  const route = useGamesStore((s) => s.route)
  const syncFromLocation = useGamesStore((s) => s.syncFromLocation)

  useEffect(() => {
    const onPop = () => syncFromLocation()
    window.addEventListener('popstate', onPop)
    syncFromLocation()
    return () => window.removeEventListener('popstate', onPop)
  }, [syncFromLocation])

  const empty = G.years.length === 0

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <TopBar />
      {empty ? (
        <EmptyDataset />
      ) : (
        <>
          {route.view === 'home' && <GamesHero />}
          {route.view !== 'hub' && route.view !== 'athlete' && route.view !== 'cards' && route.view !== 'intel' && route.view !== 'analysis' && route.view !== 'events' && <YearRibbon />}
          <main className="max-w-6xl mx-auto px-4 pb-8">
            <Suspense fallback={<ViewLoading />}>
              <ViewErrorBoundary name={route.view} key={route.view === 'year' ? `year-${route.year}` : route.view}>
                {route.view === 'home' && <TimelineView />}
                {route.view === 'hub' && <Hub2026 />}
                {route.view === 'intel' && <IntelView />}
                {route.view === 'rescore' && <RescoreView />}
                {route.view === 'h2h' && <H2HView />}
                {route.view === 'athlete' && <AthleteProfile key={route.slug} />}
                {route.view === 'cards' && <CardStudio />}
                {route.view === 'analysis' && <AnalysisView key={route.slug ?? 'index'} />}
                {route.view === 'events' && <EventsView />}
                {route.view === 'year' && <YearView key={route.year} />}
                {route.view === 'evolution' && <EvolutionView />}
                {route.view === 'movements' && <MovementsView />}
                {route.view === 'lore' && <LoreView />}
                {route.view === 'capacity' && <CapacityView />}
              </ViewErrorBoundary>
            </Suspense>
          </main>
        </>
      )}
      <GamesFooter />
    </div>
  )
}
