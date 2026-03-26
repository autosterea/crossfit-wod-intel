import { useStore } from '../stores/useStore'

// Real data snippets that scroll in the background
const DATA_LINES = [
  'PullUp: 1,673 appearances | 24.7% of all WODs | Since 2001-02-11',
  'Run: 1,524 | Deadlift: 835 | Clean: 626 | Snatch: 423',
  'Fran: 21-15-9 Thrusters 95lb + Pull-ups | Sprint | GW',
  'Murph: 1mi Run, 100 PU, 200 PushUp, 300 Squat, 1mi Run',
  'Shannon Entropy: 4.32 bits | HHI: 0.067 | Variance: 88%',
  'Push:Pull Ratio 1.12:1 | Squat:Hinge 1.08:1 | Balance: 83%',
  'Phosphagen: 17% | Glycolytic: 13% | Oxidative: 31% | Mixed: 39%',
  '2001: 234 WODs | 2010: 312 WODs | 2020: 287 WODs | 2025: 291 WODs',
  'PageRank #1: Pull-ups | Betweenness #1: Clean | Communities: 4',
  'For Time: 2,460 | AMRAP: 682 | Max Load: 1,173 | Hero: 502',
  'Medium: 43% | Strength: 17% | Long: 10% | Sprint: 7% | Short: 6%',
  'Top Pair: Pull-ups + Run = 361 | Deadlift + Clean = 219',
  'Modality: GW 24% | W 24% | G 15% | MGW 11% | M 8% | MG 8%',
  'Complexity avg: 2.87 | Most complex: Snatch (5.0) | Simplest: Run (1.0)',
  'Era: Pioneer 2001-06 | Growth 2007-12 | Maturity 2013-18 | Modern 2019+',
  'Movements tracked: 80 | OGs since 2001: 28 | Newest: Pegboard 2024',
]

export default function Hero() {
  const setActiveTab = useStore((s) => s.setActiveTab)

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: '#0a0a14' }}
    >
      {/* Scrolling data lines — CSS only */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ opacity: 0.07 }}>
        <div className="animate-scroll-up" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: '22px', color: '#60a5fa', whiteSpace: 'pre' }}>
          {[...DATA_LINES, ...DATA_LINES, ...DATA_LINES, ...DATA_LINES].map((line, i) => (
            <div key={i} style={{ paddingLeft: (i % 5) * 60 }}>{line}</div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ opacity: 0.05, left: '40%' }}>
        <div className="animate-scroll-down" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, lineHeight: '20px', color: '#a855f7', whiteSpace: 'pre' }}>
          {[...DATA_LINES].reverse().concat(DATA_LINES, DATA_LINES).map((line, i) => (
            <div key={i} style={{ paddingLeft: (i % 7) * 40 }}>{line}</div>
          ))}
        </div>
      </div>

      {/* Subtle gradient overlay to fade edges */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, #0a0a14 75%)',
      }} />

      {/* Main content */}
      <div className="relative z-10 text-center px-6 max-w-3xl">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#1e1e3a] bg-[#12121a] mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-slate-400 font-mono">Open Source | Auto-updates daily</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-rose-400 bg-clip-text text-transparent leading-tight">
          CrossFit WOD Intelligence
        </h1>
        <p className="text-slate-400 text-sm md:text-base mb-8 leading-relaxed">
          Every workout from crossfit.com — 2001 to today — analyzed
        </p>

        {/* Stats — instant, no animation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { value: '6,781', label: 'Workouts', color: '#60a5fa' },
            { value: '80', label: 'Movements', color: '#10b981' },
            { value: '25', label: 'Years', color: '#a855f7' },
            { value: '22', label: 'Analysis Tools', color: '#f43f5e' },
          ].map((s) => (
            <div key={s.label} className="bg-[#12121a] border border-[#1e1e3a] rounded-lg p-3">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            'Report Card', '10 Physical Skills', 'Push/Pull Balance', 'Energy Systems',
            'Variance Analysis', 'Hopper Readiness', 'Network Science',
            'Movement Map', 'Reps & Loading', 'Workout Decoder',
            'Year vs Year', 'Calendar Heatmap', '80 Movement Encyclopedia',
          ].map((f) => (
            <span key={f} className="px-2.5 py-1 text-[9px] sm:text-[10px] text-slate-400 bg-[#12121a] border border-[#1e1e3a] rounded-md">
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => setActiveTab('overview')}
          className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          Enter Dashboard
        </button>

        {/* Creator */}
        <div className="mt-10 space-y-1 px-4">
          <p className="text-xs sm:text-[11px] text-slate-500">
            Created by <span className="text-slate-400">Ravikant Dewangan</span> | MS S&C | CCFT | Head Coach, Persistence Athletics, Seattle
          </p>
          <p className="text-xs sm:text-[11px] text-slate-600">
            Site by <a href="https://autosterea.com" target="_blank" rel="noopener noreferrer" className="text-blue-400/60 hover:text-blue-400">autosterea.com</a>
            <span className="mx-2">|</span>
            Data from <a href="https://www.crossfit.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400">crossfit.com</a>
            <span className="mx-2">|</span>
            <button onClick={() => setActiveTab('methodology')} className="text-slate-500 hover:text-slate-400 transition-colors cursor-pointer">Methodology &amp; Sources</button>
            <span className="mx-2">|</span>
            CrossFit is a registered trademark of CrossFit, LLC
          </p>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes scroll-up {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
        @keyframes scroll-down {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }
        .animate-scroll-up { animation: scroll-up 60s linear infinite; }
        .animate-scroll-down { animation: scroll-down 45s linear infinite; }
      `}</style>
    </div>
  )
}
