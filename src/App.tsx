import { lazy, Suspense, useMemo, Component, type ReactNode } from 'react'
import { useStore } from './stores/useStore'
import rawData from './data/crossfit-data.json'
import type { CrossFitData } from './types'
import { analyzeData } from './utils/analysis'
import { runAdvancedAnalysis } from './utils/advanced-analysis'
import Sidebar from './components/Sidebar'
import Overview from './components/Overview'

const ForceGraph3D = lazy(() => import('./components/ForceGraph3D'))
const Heatmap3D = lazy(() => import('./components/Heatmap3D'))
const PhysicalSkills = lazy(() => import('./components/PhysicalSkills'))
const FunctionalBalance = lazy(() => import('./components/FunctionalBalance'))
const EnergySystems = lazy(() => import('./components/EnergySystems'))
const WorkCapacity = lazy(() => import('./components/WorkCapacity'))
const MovementDNA = lazy(() => import('./components/MovementDNA'))
const MovementTimeline = lazy(() => import('./components/MovementTimeline'))
const EraTimeline = lazy(() => import('./components/EraTimeline'))
const PatternInsights = lazy(() => import('./components/PatternInsights'))
const VarianceAnalysis = lazy(() => import('./components/VarianceAnalysis'))
const HopperReadiness = lazy(() => import('./components/HopperReadiness'))
const NetworkScience = lazy(() => import('./components/NetworkScience'))
const CalendarHeatmap = lazy(() => import('./components/CalendarHeatmap'))
const HeadToHead = lazy(() => import('./components/HeadToHead'))
const WorkoutDecoder = lazy(() => import('./components/WorkoutDecoder'))
const ReportCard = lazy(() => import('./components/ReportCard'))
const WhatsGaps = lazy(() => import('./components/WhatsGaps'))
const Catalog = lazy(() => import('./components/Catalog'))
const NamedWods = lazy(() => import('./components/NamedWods'))

// Handle both parsed object and stringified JSON (vite json.stringify)
const D: CrossFitData = (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) as CrossFitData

// Verify data loaded correctly
if (typeof window !== 'undefined') {
  console.log('[CrossFit] Data loaded:', {
    type: typeof rawData,
    totalWorkouts: D?.overview?.total_workouts,
    searchIndexLen: D?.searchIndex?.length,
    hasMovementDisplay: !!D?.movementDisplay,
  })
}

// Error boundary to catch component crashes
class ErrorBoundary extends Component<{ children: ReactNode; name: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
          <h3 className="text-red-400 font-bold text-sm mb-2">Error in {this.props.name}</h3>
          <pre className="text-xs text-red-300/70 whitespace-pre-wrap">{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} className="mt-3 px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

function filterDataByYear(data: CrossFitData, yearRange: [number, number]): CrossFitData {
  const [fromYear, toYear] = yearRange
  if (fromYear <= 2001 && toYear >= 2026) return data

  const filteredIndex = data.searchIndex.filter((w) => {
    const y = parseInt(w.d.substring(0, 4))
    return y >= fromYear && y <= toYear
  })

  const modality: Record<string, number> = {}
  const structure: Record<string, number> = {}
  const time_domain: Record<string, number> = {}
  const load_profile: Record<string, number> = {}
  const movement_frequency: Record<string, number> = {}
  let heroCount = 0, benchmarkCount = 0
  const namedSet = new Set<string>()

  filteredIndex.forEach((w) => {
    modality[w.mo] = (modality[w.mo] || 0) + 1
    structure[w.st] = (structure[w.st] || 0) + 1
    time_domain[w.td] = (time_domain[w.td] || 0) + 1
    load_profile[w.lp] = (load_profile[w.lp] || 0) + 1
    w.mv.forEach((m) => { movement_frequency[m] = (movement_frequency[m] || 0) + 1 })
    if (w.ih) heroCount++
    if (w.ib) benchmarkCount++
    if (w.nw) namedSet.add(w.nw)
  })

  const filteredYearData: Record<string, any> = {}
  for (const [year, yd] of Object.entries(data.yearData)) {
    if (parseInt(year) >= fromYear && parseInt(year) <= toYear) filteredYearData[year] = yd
  }

  const mcm = Object.entries(movement_frequency).sort((a, b) => b[1] - a[1])[0]

  return {
    ...data,
    searchIndex: filteredIndex,
    yearData: filteredYearData,
    overview: {
      ...data.overview,
      total_workouts: filteredIndex.length,
      years_covered: toYear - fromYear + 1,
      date_range: `${fromYear}-01-01 to ${toYear}-12-31`,
      modality, structure, time_domain, load_profile, movement_frequency,
      most_common_movement: mcm ? mcm[0] : '',
      hero_wod_count: heroCount, benchmark_count: benchmarkCount, named_wod_count: namedSet.size,
    },
    namedWods: data.namedWods.filter((w) => {
      const ly = parseInt(w.last_seen.substring(0, 4))
      const fy = parseInt(w.first_seen.substring(0, 4))
      return ly >= fromYear && fy <= toYear
    }),
    trends: {
      ...data.trends,
      modality: data.trends.modality.filter((t: any) => {
        const y = parseInt(t.year)
        return y >= fromYear && y <= toYear
      }),
    },
  }
}

function YearRangeBadge() {
  const yr = useStore((s) => s.yearRange)
  if (yr[0] <= 2001 && yr[1] >= 2026) return null
  return (
    <div className="mb-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      <span className="text-[11px] text-blue-400">Filtered: {yr[0]}–{yr[1]} ({yr[1] - yr[0] + 1} years)</span>
    </div>
  )
}

function App() {
  const activeTab = useStore((s) => s.activeTab)
  const yearRange = useStore((s) => s.yearRange)

  const filteredData = useMemo(() => filterDataByYear(D, yearRange), [yearRange])

  const analysis = useMemo(() => {
    try { return analyzeData(filteredData) }
    catch (e) { console.error('analyzeData failed:', e); return null }
  }, [filteredData])

  const advancedAnalysis = useMemo(() => {
    try { return runAdvancedAnalysis(filteredData, yearRange) }
    catch (e) { console.error('runAdvancedAnalysis failed:', e); return null }
  }, [filteredData, yearRange])

  return (
    <div className="flex h-screen">
      <Sidebar data={D} />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-14 lg:pt-6">
        <YearRangeBadge />
        <Suspense fallback={<LoadingFallback />}>
          <ErrorBoundary name={activeTab} key={activeTab}>
            {activeTab === 'overview' && <Overview data={filteredData} />}
            {activeTab === 'reportcard' && analysis && advancedAnalysis && <ReportCard data={filteredData} analysis={analysis} advancedAnalysis={advancedAnalysis} />}
            {activeTab === 'calendar' && <CalendarHeatmap data={filteredData} />}
            {activeTab === 'force3d' && <ForceGraph3D data={D} />}
            {activeTab === 'heatmap3d' && <Heatmap3D data={D} />}
            {activeTab === 'skills' && analysis && <PhysicalSkills data={filteredData} analysis={analysis} />}
            {activeTab === 'functional' && analysis && <FunctionalBalance data={filteredData} analysis={analysis} />}
            {activeTab === 'energy' && analysis && <EnergySystems data={filteredData} analysis={analysis} />}
            {activeTab === 'workcap' && analysis && <WorkCapacity data={filteredData} analysis={analysis} />}
            {activeTab === 'variance' && advancedAnalysis && <VarianceAnalysis data={filteredData} advancedAnalysis={advancedAnalysis} />}
            {activeTab === 'hopper' && advancedAnalysis && <HopperReadiness data={filteredData} advancedAnalysis={advancedAnalysis} />}
            {activeTab === 'network' && advancedAnalysis && <NetworkScience data={D} advancedAnalysis={advancedAnalysis} />}
            {activeTab === 'gaps' && analysis && advancedAnalysis && <WhatsGaps data={filteredData} analysis={analysis} advancedAnalysis={advancedAnalysis} />}
            {activeTab === 'movement-dna' && <MovementDNA data={filteredData} />}
            {activeTab === 'timeline' && <MovementTimeline data={D} />}
            {activeTab === 'eras' && <EraTimeline data={D} />}
            {activeTab === 'headtohead' && <HeadToHead data={D} />}
            {activeTab === 'patterns' && <PatternInsights data={filteredData} />}
            {activeTab === 'decoder' && <WorkoutDecoder data={filteredData} />}
            {activeTab === 'catalog' && <Catalog data={filteredData} />}
            {activeTab === 'named' && <NamedWods data={filteredData} />}
          </ErrorBoundary>
        </Suspense>
      </main>
    </div>
  )
}

export default App
