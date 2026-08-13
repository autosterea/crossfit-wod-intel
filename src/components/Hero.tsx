import { useStore } from '../stores/useStore'
import type { CrossFitData } from '../types'

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

export default function Hero({ data }: { data: CrossFitData }) {
  const setActiveTab = useStore((s) => s.setActiveTab)

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Scrolling data lines - CSS only */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ opacity: 0.08 }}>
        <div className="animate-scroll-up" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: '22px', color: '#91C640', whiteSpace: 'pre' }}>
          {[...DATA_LINES, ...DATA_LINES, ...DATA_LINES, ...DATA_LINES].map((line, i) => (
            <div key={i} style={{ paddingLeft: (i % 5) * 60 }}>{line}</div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ opacity: 0.05, left: '40%' }}>
        <div className="animate-scroll-down" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, lineHeight: '20px', color: '#019644', whiteSpace: 'pre' }}>
          {[...DATA_LINES].reverse().concat(DATA_LINES, DATA_LINES).map((line, i) => (
            <div key={i} style={{ paddingLeft: (i % 7) * 40 }}>{line}</div>
          ))}
        </div>
      </div>

      {/* Subtle gradient overlay to fade edges */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, var(--sidebar-bg) 75%)',
      }} />

      {/* Main content */}
      <div className="relative z-10 text-center px-6 max-w-3xl">
        {/* PA wordmark */}
        <div className="inline-flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center">
            <img src="/pa-logo.png" alt="Persistence Athletics" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="text-left">
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#91C640] font-semibold">A tool by</div>
            <div className="text-xs font-semibold text-[var(--text-primary)] leading-tight">Persistence Athletics</div>
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#019644]/30 bg-[#019644]/10 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#91C640] animate-pulse" />
          <span className="text-[10px] text-[#91C640] font-mono">Open source &middot; Updates daily</span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl sm:text-6xl md:text-7xl mb-4 leading-[0.95] uppercase"
          style={{ fontFamily: "'Anton', sans-serif", letterSpacing: '1px' }}
        >
          <span className="block text-[var(--text-primary)]">Crossfit</span>
          <span className="block text-[#91C640]">WOD Intelligence</span>
        </h1>
        <p className="text-[var(--text-tertiary)] text-sm md:text-base mb-10 leading-relaxed">
          Every WOD posted on crossfit.com since 2001, and what the numbers say
        </p>

        {/* Stats - plain row, no cards */}
        <div className="flex flex-wrap items-end justify-center gap-x-10 gap-y-6 mb-10">
          {[
            { value: data.overview.total_workouts.toLocaleString(), label: 'Workouts' },
            { value: String(data.overview.years_covered), label: 'Years' },
            { value: data.overview.named_wod_count.toLocaleString(), label: 'Named WODs' },
            { value: data.overview.hero_wod_count.toLocaleString(), label: 'Hero WODs' },
          ].map((s) => (
            <div key={s.label}>
              <div
                className="text-3xl sm:text-4xl text-[var(--text-primary)] leading-none"
                style={{ fontFamily: "'Anton', sans-serif", letterSpacing: '0.5px' }}
              >
                {s.value}
              </div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-tertiary)] mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setActiveTab('daily')}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[#019644] hover:bg-[#01793a] rounded-lg transition-colors"
          >
            Today's WOD →
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className="px-6 py-2.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--panel-border)] hover:border-[var(--panel-border-strong)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
          >
            Enter Dashboard
          </button>
        </div>

        {/* Creator */}
        <div className="mt-10 space-y-1 px-4">
          <p className="text-xs sm:text-[11px] text-[var(--text-muted)]">
            Built at <a href="https://persistenceathletics.com" target="_blank" rel="noopener noreferrer" className="text-[#91C640] hover:text-[#a8d35e]">Persistence Athletics</a> by <span className="text-[var(--text-tertiary)]">Ravikant Dewangan</span> | MS S&C | CCFT | Head Coach
          </p>
          <p className="text-xs sm:text-[11px] text-[var(--text-muted)]">
            Platform by <a href="https://autosterea.com" target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--text-tertiary)]">Autosterea</a>
            <span className="mx-2">|</span>
            Data from <a href="https://www.crossfit.com" target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--text-tertiary)]">crossfit.com</a>
            <span className="mx-2">|</span>
            <button onClick={() => setActiveTab('methodology')} className="text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors cursor-pointer">Methodology &amp; Sources</button>
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
