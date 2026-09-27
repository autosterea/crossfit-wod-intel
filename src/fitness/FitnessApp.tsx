import { Suspense, lazy, useEffect, useRef, useState, Component, type ReactNode } from 'react'
import './fitness.css'
import { useFitnessStore } from './fitnessStore'
import { MODULES } from './fitnessData'
import type { FitnessView, ModuleKey } from './lessonTypes'
import { TopBar } from './story/ui/TopBar'
import { StoryProvider, bootStory } from './story/StoryProvider'
import { StoryStage } from './story/Stage'
import { Notes } from './story/ui/Notes'
import { useStoryStore } from './story/store'
import { asset } from './story/url'
import { cachedStory, hasStory, loadStory, prefetchStory } from './stories'
import type { StoryDef } from './story/types'

/* =========================================================================
   The /fitness shell. Chapters registered in stories/index.ts render on the
   story engine (full-bleed stage, caption card, Notes below). The others
   still render their legacy LessonStage module until they are migrated.
   ========================================================================= */

const IntroView = lazy(() => import('./modules/IntroView'))
const SkillsModule = lazy(() => import('./modules/SkillsModule'))
const HopperModule = lazy(() => import('./modules/HopperModule'))
const PathwaysModule = lazy(() => import('./modules/PathwaysModule'))
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
        <div className="p-6 my-8 mx-4 bg-red-500/10 border border-red-500/30 rounded-xl">
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

const ORDER: FitnessView[] = ['intro', ...MODULES.map((m) => m.key as FitnessView)]
const labelOf = (v: FitnessView) => (v === 'intro' ? 'Overview' : MODULES.find((m) => m.key === v)!.label)
const numOf = (v: FitnessView) => (v === 'intro' ? '' : MODULES.find((m) => m.key === v)!.num)

/** Previous / next chapter cards. */
function LessonNav() {
  const route = useFitnessStore((s) => s.route)
  const navigate = useFitnessStore((s) => s.navigate)
  const i = ORDER.indexOf(route.view)
  const prev = i > 0 ? ORDER[i - 1] : null
  const next = i < ORDER.length - 1 ? ORDER[i + 1] : null
  return (
    <div className="st-lessonnav">
      {prev ? (
        <button onClick={() => navigate({ view: prev })} className="wf-card wf-card-link st-lessonnav-card">
          <div className="st-lessonnav-k">&#8592; Previous</div>
          <div className="st-lessonnav-v">
            {numOf(prev) && <span>{numOf(prev)}</span>} {labelOf(prev)}
          </div>
        </button>
      ) : (
        <span className="st-lessonnav-card is-empty" />
      )}
      {next ? (
        <button onClick={() => navigate({ view: next })} className="wf-card wf-card-link st-lessonnav-card is-next">
          <div className="st-lessonnav-k">Next &#8594;</div>
          <div className="st-lessonnav-v">
            {numOf(next) && <span>{numOf(next)}</span>} {labelOf(next)}
          </div>
        </button>
      ) : (
        <span className="st-lessonnav-card is-empty" />
      )}
    </div>
  )
}

function FitnessFooter() {
  return (
    <footer className="mt-16 pb-8 pt-6 border-t border-[var(--panel-border)] px-4 st-footer">
      <div className="max-w-6xl mx-auto text-center space-y-3">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white p-1 shrink-0">
            <img src={asset('pa-logo.png')} alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              A{' '}
              <a href="https://persistenceathletics.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-success)] hover:text-[#a8d35e]">
                Persistence Athletics
              </a>{' '}
              tool
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">Built by Ravikant Dewangan, Head Coach (MS S&amp;C, CCFT)</p>
          </div>
        </div>
        <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
          <a href="/" className="hover:text-[var(--text-tertiary)] transition-colors py-2">
            Daily WOD Intelligence
          </a>
          <span>|</span>
          <a href="/games" className="hover:text-[var(--text-tertiary)] transition-colors py-2">
            Games Almanac
          </a>
          <span>|</span>
          <a href="/news" className="hover:text-[var(--text-tertiary)] transition-colors py-2">
            CrossFit Now
          </a>
          <span>|</span>
          <span>Platform by</span>
          <a href="https://autosterea.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-tertiary)] transition-colors py-2">
            Autosterea
          </a>
        </div>
        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed max-w-xl mx-auto">
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

/**
 * A chapter on the story engine: stage, then Notes, then chapter cards.
 * The stage is PERSISTENT across story chapters (decision 15): StoryView and
 * StoryStage keep their place in the tree, so the Canvas, renderer, composer,
 * environment and label layer survive a chapter change and only the Scene,
 * labels and captions swap. While the next chapter's chunk loads, the previous
 * StoryDef stays mounted (held still) under the slate.
 */
function StoryView({ view }: { view: FitnessView }) {
  const [def, setDef] = useState<StoryDef | null>(() => cachedStory(view) ?? null)
  const hit = cachedStory(view)
  const active = hit ?? def
  const stageRef = useRef<HTMLDivElement>(null)
  const loaded = useStoryStore((s) => s.loaded)
  useEffect(() => {
    const cached = cachedStory(view)
    if (cached) {
      setDef(cached)
      return
    }
    let alive = true
    loadStory(view).then((d) => {
      if (alive && d) setDef(d)
    })
    return () => {
      alive = false
    }
  }, [view])
  useEffect(() => {
    if (!loaded) return
    const i = ORDER.indexOf(view)
    if (i >= 0 && i < ORDER.length - 1) prefetchStory(ORDER[i + 1])
  }, [loaded, view])

  return (
    <main className="st-main">
      <div ref={stageRef} className="st-stage-wrap">
        {active ? (
          <StoryProvider def={active}>
            <StoryStage def={active} view={view} />
          </StoryProvider>
        ) : (
          <div className="st-stage st-stage--loading" />
        )}
      </div>
      {view !== 'intro' && <Notes moduleKey={view as ModuleKey} stageRef={stageRef} />}
      <LessonNav />
    </main>
  )
}

function LegacyView({ view }: { view: FitnessView }) {
  return (
    <main className="pt-5 st-legacy">
      <Suspense fallback={<ViewLoading />}>
        <ViewErrorBoundary name={view} key={view}>
          {view === 'intro' && <IntroView />}
          {view === 'skills' && <SkillsModule />}
          {view === 'hopper' && <HopperModule />}
          {view === 'pathways' && <PathwaysModule />}
          {view === 'continuum' && <ContinuumModule />}
          {view === 'health' && <HealthModule />}
        </ViewErrorBoundary>
      </Suspense>
      <LessonNav />
    </main>
  )
}

export default function FitnessApp() {
  const route = useFitnessStore((s) => s.route)
  const syncFromLocation = useFitnessStore((s) => s.syncFromLocation)

  useEffect(() => {
    bootStory()
    const onPop = () => syncFromLocation()
    window.addEventListener('popstate', onPop)
    syncFromLocation()
    return () => window.removeEventListener('popstate', onPop)
  }, [syncFromLocation])

  // Safe areas: add viewport-fit=cover while the lesson is mounted only.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    if (!meta) return
    const original = meta.content
    if (!/viewport-fit/.test(original)) meta.content = `${original}, viewport-fit=cover`
    return () => {
      meta.content = original
    }
  }, [])

  return (
    <div className="st-root min-h-screen bg-[var(--app-bg)]">
      <TopBar />
      {hasStory(route.view) ? <StoryView view={route.view} key="story" /> : <LegacyView view={route.view} />}
      <FitnessFooter />
    </div>
  )
}
