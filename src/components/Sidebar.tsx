import { useStore } from '../stores/useStore'
import type { CrossFitData } from '../types'

const sections = [
  {
    title: 'OVERVIEW',
    tabs: [
      { id: 'daily', label: "Today's WOD", icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'overview', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
      { id: 'reportcard', label: 'Report Card', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
      { id: 'calendar', label: 'Calendar Heatmap', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    ],
  },
  {
    title: 'FITNESS MODEL',
    tabs: [
      { id: 'skills', label: '10 Physical Skills', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
      { id: 'functional', label: 'Push/Pull/Squat', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
      { id: 'energy', label: 'Energy Systems', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { id: 'workcap', label: 'Work Capacity', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    ],
  },
  {
    title: 'ADVANCED ANALYSIS',
    tabs: [
      { id: 'variance', label: 'Variance Analysis', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { id: 'hopper', label: 'Hopper Readiness', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
      { id: 'network', label: 'Network Science', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9' },
      { id: 'gaps', label: "What's Missing", icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    ],
  },
  {
    title: 'VISUALIZATIONS',
    tabs: [
      { id: 'movmap', label: 'Movement Map', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
      { id: 'movpairs', label: 'Movement Pairs', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
      { id: 'heatmap3d', label: 'Co-occurrence Grid', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
    ],
  },
  {
    title: 'DEEP ANALYSIS',
    tabs: [
      { id: 'movement-dna', label: 'Movement DNA', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
      { id: 'timeline', label: 'Movement Timeline', icon: 'M4 6h16M4 12h16M4 18h7' },
      { id: 'eras', label: 'Era Evolution', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'headtohead', label: 'Year vs Year', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
      { id: 'patterns', label: 'Pattern Insights', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
      { id: 'repsloading', label: 'Reps & Loading', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
    ],
  },
  {
    title: 'DATABASE',
    tabs: [
      { id: 'encyclopedia', label: 'All 80 Movements', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      { id: 'decoder', label: 'Workout Decoder', icon: 'M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z' },
      { id: 'catalog', label: 'All Workouts', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
      { id: 'named', label: 'Named WODs', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    ],
  },
  {
    title: 'ABOUT',
    tabs: [
      { id: 'methodology', label: 'Methodology & Sources', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
] as const

const MIN_YEAR = 2001
const MAX_YEAR = 2026

function YearRangeFilter() {
  const { yearRange, setYearRange } = useStore()
  const [from, to] = yearRange
  const isFullRange = from === MIN_YEAR && to === MAX_YEAR

  return (
    <div className="px-3 py-2 border-b border-[#1a1a2e]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] font-semibold text-slate-600 tracking-wider">YEAR RANGE</span>
        {!isFullRange && (
          <button onClick={() => setYearRange([MIN_YEAR, MAX_YEAR])} className="text-[8px] text-[#91C640] hover:text-[#a8d35e]">Reset</button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input type="number" min={MIN_YEAR} max={to} value={from}
          onChange={(e) => setYearRange([Math.max(MIN_YEAR, Math.min(parseInt(e.target.value) || MIN_YEAR, to)), to])}
          className="w-14 bg-[#12121a] border border-[#1e1e3a] rounded px-1.5 py-0.5 text-[10px] text-slate-300 font-mono text-center focus:border-[#019644]/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-slate-600 text-[10px]">—</span>
        <input type="number" min={from} max={MAX_YEAR} value={to}
          onChange={(e) => setYearRange([from, Math.min(MAX_YEAR, Math.max(parseInt(e.target.value) || MAX_YEAR, from))])}
          className="w-14 bg-[#12121a] border border-[#1e1e3a] rounded px-1.5 py-0.5 text-[10px] text-slate-300 font-mono text-center focus:border-[#019644]/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      {!isFullRange && (
        <div className="text-center mt-1"><span className="text-[9px] text-[#91C640] font-mono">{to - from + 1}y selected</span></div>
      )}
    </div>
  )
}

export default function Sidebar({ data }: { data: CrossFitData }) {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen, theme, setTheme } = useStore()

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden w-11 h-11 flex items-center justify-center bg-[#12121a] border border-[#1e1e3a] rounded-lg"
      >
        <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          {sidebarOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--panel-border-subtle)' }}
        className={`
        fixed lg:static z-40 h-screen border-r flex flex-col shrink-0 overflow-y-auto
        w-64 sm:w-56 transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <button onClick={() => { setActiveTab('hero' as any); setSidebarOpen(false) }} className="w-full text-left p-3 border-b border-[#1a1a2e] hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white p-0.5 shrink-0">
              <img src="/pa-logo.png" alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold bg-gradient-to-r from-[#91C640] to-[#019644] bg-clip-text text-transparent truncate">
                CrossFit WOD Intel
              </h1>
              <p className="text-[8px] text-slate-500 leading-tight uppercase tracking-wider">by Persistence Athletics</p>
            </div>
          </div>
          <p className="text-[9px] text-slate-500 mt-1.5 font-mono">
            {data.overview.total_workouts.toLocaleString()} WODs | {data.overview.years_covered}y
          </p>
        </button>

        <YearRangeFilter />

        <nav className="flex-1 py-1">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="px-3 pt-3 pb-0.5 text-[8px] font-semibold text-slate-600 tracking-wider">
                {section.title}
              </div>
              {section.tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-all duration-150 ${
                    activeTab === tab.id
                      ? 'bg-[#91C640]/10 text-[#91C640] border-r-2 border-[#91C640]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                  }`}
                >
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-[#1a1a2e] flex items-center justify-between gap-2">
          <div className="text-[8px] text-slate-600 truncate">{data.overview.date_range}</div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="shrink-0 w-7 h-7 rounded-md bg-[#12121a] border border-[#1e1e3a] flex items-center justify-center text-slate-400 hover:text-[#91C640] hover:border-[#91C640]/40 transition-colors"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="4" />
                <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
