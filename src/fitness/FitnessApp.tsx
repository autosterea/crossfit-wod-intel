import { Suspense, lazy, useEffect, Component, type ReactNode } from 'react'
import './fitness.css'
import ThemeToggle from '../components/ThemeToggle'
import { useFitnessStore } from './fitnessStore'
import { MODULES } from './fitnessData'
import type { FitnessView } from './lessonTypes'

const IntroView = lazy(() => import('./modules/IntroView'))
const SkillsModule = lazy(() => import('./modules/SkillsModule'))
const HopperModule = lazy(() => import('./modules/HopperModule'))
const PathwaysModule = lazy(() => import('./modules/PathwaysModule'))
const DefinitionModule = lazy(() => import('./modules/DefinitionModule'))
const ContinuumModule = lazy(() => import('./modules/ContinuumModule'))
const HealthModule = lazy(() => import('./modules/HealthModule'))

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

const NAV: { view: FitnessView; label: string; mobileLabel?: string }[] = [
  { view: 'intro', label: 'Overview' },
  ...MODULES.map((m) => ({ view: m.key as FitnessView, label: m.label, mobileLabel: m.mobileLabel })),
]

function TopBar() {
  const route = useFitnessStore((s) => s.route)
  const navigate = useFitnessStore((s) => s.navigate)
  return (
    <header className="wf-topbar sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate({ view: 'intro' })}
          className="flex items-center gap-2.5 shrink-0"
          aria-label="What Is Fitness home"
        >
          <div className="w-8 h-8 rounded-full bg-white p-0.5 shrink-0">
            <img src="/pa-logo.png" alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="wf-display text-lg text-[var(--text-primary)] leading-none mt-0.5">
            What Is <span className="text-[#91C640]">Fitness?</span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-0.5">
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => navigate({ view: n.view })}
              className="wf-condensed uppercase tracking-[0.08em] text-[12.5px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                color: route.view === n.view ? '#91C640' : 'var(--text-secondary)',
                background: route.view === n.view ? 'rgba(145,198,64,0.1)' : 'transparent',
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/games"
            className="wf-condensed hidden lg:block uppercase tracking-[0.1em] text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)] hover:border-[#91C640]/50 hover:text-[#91C640] transition-colors"
          >
            Games Almanac
          </a>
          <a
            href="/"
            className="wf-condensed hidden sm:block uppercase tracking-[0.1em] text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)] hover:border-[#91C640]/50 hover:text-[#91C640] transition-colors"
          >
            WOD Intel
          </a>
          <ThemeToggle size="md" />
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="md:hidden border-t border-[var(--panel-border-subtle)]">
        <div className="flex items-center gap-1 h-10 px-3 overflow-x-auto wf-mobile-nav" style={{ scrollbarWidth: 'none' }}>
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => navigate({ view: n.view })}
              className="wf-condensed uppercase tracking-[0.07em] text-[12px] font-semibold px-2 shrink-0"
              style={{ color: route.view === n.view ? '#91C640' : 'var(--text-secondary)' }}
            >
              {n.mobileLabel ?? n.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

/** Previous / next module stepper to walk through the lesson in order. */
function LessonNav() {
  const route = useFitnessStore((s) => s.route)
  const navigate = useFitnessStore((s) => s.navigate)
  const order: FitnessView[] = ['intro', ...MODULES.map((m) => m.key as FitnessView)]
  const i = order.indexOf(route.view)
  const prev = i > 0 ? order[i - 1] : null
  const next = i < order.length - 1 ? order[i + 1] : null
  const labelOf = (v: FitnessView) => (v === 'intro' ? 'Overview' : MODULES.find((m) => m.key === v)!.label)

  return (
    <div className="max-w-6xl mx-auto px-4 mt-10 flex items-stretch justify-between gap-3">
      {prev ? (
        <button onClick={() => navigate({ view: prev })} className="wf-card wf-card-link p-4 text-left flex-1 max-w-[48%]">
          <div className="text-[11px] text-[var(--text-muted)] wf-condensed uppercase tracking-[0.15em]">&#8592; Previous</div>
          <div className="text-sm font-semibold text-[var(--text-primary)] mt-1">{labelOf(prev)}</div>
        </button>
      ) : (
        <span className="flex-1 max-w-[48%]" />
      )}
      {next ? (
        <button onClick={() => navigate({ view: next })} className="wf-card wf-card-link p-4 text-right flex-1 max-w-[48%]">
          <div className="text-[11px] text-[var(--text-muted)] wf-condensed uppercase tracking-[0.15em]">Next &#8594;</div>
          <div className="text-sm font-semibold text-[var(--text-primary)] mt-1">{labelOf(next)}</div>
        </button>
      ) : (
        <span className="flex-1 max-w-[48%]" />
      )}
    </div>
  )
}

function FitnessFooter() {
  return (
    <footer className="mt-16 mb-8 pt-6 border-t border-[var(--panel-border)] px-4">
      <div className="max-w-6xl mx-auto text-center space-y-3">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white p-1 shrink-0">
            <img src="/pa-logo.png" alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              A{' '}
              <a href="https://persistenceathletics.com" target="_blank" rel="noopener noreferrer" className="text-[#91C640] hover:text-[#a8d35e]">
                Persistence Athletics
              </a>{' '}
              tool
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">Built by Ravikant Dewangan, Head Coach (MS S&amp;C, CCFT)</p>
          </div>
        </div>
        <div className="flex items-center justify-center flex-wrap gap-2 text-[10px] text-[var(--text-muted)]">
          <a href="/" className="hover:text-[var(--text-tertiary)] transition-colors">Daily WOD Intelligence</a>
          <span>|</span>
          <a href="/games" className="hover:text-[var(--text-tertiary)] transition-colors">Games Almanac</a>
          <span>|</span>
          <span>Platform by</span>
          <a href="https://autosterea.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-tertiary)] transition-colors">Autosterea</a>
        </div>
        <div className="text-[11px] sm:text-[10px] text-[var(--text-muted)] leading-relaxed max-w-xl mx-auto">
          <p>
            This lesson explains the fitness model from Greg Glassman&#39;s &quot;What Is Fitness?&quot; (CrossFit Journal, October 2002) and the CrossFit Level 1 Training Guide, for educational purposes. CrossFit is a registered trademark of CrossFit, LLC. This project is not affiliated with, endorsed by, or sponsored by CrossFit, LLC.
          </p>
        </div>
      </div>
    </footer>
  )
}

function ViewLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-2 border-[#91C640]/30 border-t-[#91C640] rounded-full animate-spin" />
    </div>
  )
}

export default function FitnessApp() {
  const route = useFitnessStore((s) => s.route)
  const syncFromLocation = useFitnessStore((s) => s.syncFromLocation)

  useEffect(() => {
    const onPop = () => syncFromLocation()
    window.addEventListener('popstate', onPop)
    syncFromLocation()
    return () => window.removeEventListener('popstate', onPop)
  }, [syncFromLocation])

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <TopBar />
      <main className="pt-5">
        <Suspense fallback={<ViewLoading />}>
          <ViewErrorBoundary name={route.view} key={route.view}>
            {route.view === 'intro' && <IntroView />}
            {route.view === 'skills' && <SkillsModule />}
            {route.view === 'hopper' && <HopperModule />}
            {route.view === 'pathways' && <PathwaysModule />}
            {route.view === 'definition' && <DefinitionModule />}
            {route.view === 'continuum' && <ContinuumModule />}
            {route.view === 'health' && <HealthModule />}
          </ViewErrorBoundary>
        </Suspense>
        <LessonNav />
      </main>
      <FitnessFooter />
    </div>
  )
}
