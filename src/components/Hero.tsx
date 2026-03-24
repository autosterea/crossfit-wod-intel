import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../stores/useStore'

/* ------------------------------------------------------------------ */
/*  Animated counter hook                                              */
/* ------------------------------------------------------------------ */
function useCounter(end: number, duration = 2000, startDelay = 300) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    let start: number | null = null
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts
        const progress = Math.min((ts - start) / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(eased * end))
        if (progress < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, startDelay)
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf) }
  }, [end, duration, startDelay])
  return value
}

/* ------------------------------------------------------------------ */
/*  Floating particles background                                      */
/* ------------------------------------------------------------------ */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = (canvas.width = window.innerWidth)
    let h = (canvas.height = window.innerHeight)
    let animId: number

    const handleResize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // particles
    const COUNT = 60
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      color: ['#3b82f6', '#8b5cf6', '#ec4899', '#60a5fa'][Math.floor(Math.random() * 4)],
    }))

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      // update & draw particles
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = 0.35
        ctx.fill()
      }

      // draw connection lines between nearby particles
      ctx.globalAlpha = 0.06
      ctx.strokeStyle = '#8b5cf6'
      ctx.lineWidth = 0.5
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */
function StatCard({ value, label, color, delay }: { value: string; label: string; color: string; delay: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  const borderColor = {
    blue: 'border-blue-500/30',
    green: 'border-emerald-500/30',
    purple: 'border-purple-500/30',
    rose: 'border-rose-500/30',
  }[color] || 'border-blue-500/30'

  const bgColor = {
    blue: 'bg-blue-500/10',
    green: 'bg-emerald-500/10',
    purple: 'bg-purple-500/10',
    rose: 'bg-rose-500/10',
  }[color] || 'bg-blue-500/10'

  const textColor = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    purple: 'text-purple-400',
    rose: 'text-rose-400',
  }[color] || 'text-blue-400'

  return (
    <div
      className={`
        flex flex-col items-center justify-center px-6 py-5 rounded-xl border backdrop-blur-sm
        transition-all duration-700 ease-out
        ${borderColor} ${bgColor}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      <span className={`text-3xl sm:text-4xl font-extrabold font-mono ${textColor}`}>{value}</span>
      <span className="text-xs sm:text-sm text-slate-400 mt-1 tracking-wide">{label}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Feature card                                                       */
/* ------------------------------------------------------------------ */
function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode
  title: string
  description: string
  delay: number
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      className={`
        group flex flex-col gap-3 p-5 rounded-xl
        bg-white/[0.03] border border-white/[0.06]
        hover:bg-white/[0.06] hover:border-white/[0.12]
        transition-all duration-700 ease-out cursor-default
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
    >
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-colors">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SVG icons (inline, no deps)                                        */
/* ------------------------------------------------------------------ */
const CubeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)
const BeakerIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M5 14.5l-1.345 1.345a1.5 1.5 0 000 2.12l.094.094a1.5 1.5 0 002.12 0L7.5 16.5m-2.5-2l4.586-4.586a2.25 2.25 0 013.328 0L17.5 14.5m0 0l1.345 1.345a1.5 1.5 0 010 2.12l-.094.094a1.5 1.5 0 01-2.12 0L15 16.5m2.5-2l-4.586-4.586" />
  </svg>
)
const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

/* ------------------------------------------------------------------ */
/*  Hero component                                                     */
/* ------------------------------------------------------------------ */
export default function Hero() {
  const setActiveTab = useStore((s) => s.setActiveTab)
  const [mounted, setMounted] = useState(false)

  const wods = useCounter(6779, 2200, 600)
  const movements = useCounter(80, 1800, 800)
  const years = useCounter(25, 1600, 1000)
  const tools = useCounter(21, 1400, 1200)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  const handleExplore = () => {
    setActiveTab('overview')
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Animated particle background */}
      <ParticleField />

      {/* Radial gradient overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-600/[0.07] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-600/[0.07] blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-rose-600/[0.04] blur-[150px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 max-w-5xl mx-auto w-full">
        {/* Badge */}
        <div
          className={`
            mb-6 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/[0.08] backdrop-blur-sm
            text-xs font-medium text-blue-400 tracking-wider uppercase
            transition-all duration-1000 ease-out
            ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
          `}
        >
          Free &amp; Open Source
        </div>

        {/* Title */}
        <h1
          className={`
            text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight
            transition-all duration-1000 ease-out delay-100
            ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
          `}
        >
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-rose-400 bg-clip-text text-transparent">
            CrossFit WOD
          </span>
          <br />
          <span className="text-white">Intelligence</span>
        </h1>

        {/* Subtitle */}
        <p
          className={`
            mt-5 text-center text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed
            transition-all duration-1000 ease-out delay-200
            ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
          `}
        >
          The most comprehensive analysis of CrossFit.com's workout programming ever built
        </p>

        {/* Stat counters */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full max-w-3xl">
          <StatCard value={wods.toLocaleString()} label="WODs" color="blue" delay={600} />
          <StatCard value={String(movements)} label="Movements" color="green" delay={800} />
          <StatCard value={String(years)} label="Years" color="purple" delay={1000} />
          <StatCard value={String(tools)} label="Analysis Tools" color="rose" delay={1200} />
        </div>

        {/* Feature cards */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-4xl">
          <FeatureCard
            icon={<CubeIcon />}
            title="3D Visualizations"
            description="Interactive force-directed graphs and 3D heatmaps reveal hidden movement relationships."
            delay={1400}
          />
          <FeatureCard
            icon={<ChartIcon />}
            title="Statistical Analysis"
            description="Chi-squared tests, variance analysis, and entropy scoring with real p-values."
            delay={1550}
          />
          <FeatureCard
            icon={<BeakerIcon />}
            title="Movement Science"
            description="Energy systems, functional balance, and physical skill coverage mapped across 25 years."
            delay={1700}
          />
          <FeatureCard
            icon={<SearchIcon />}
            title="Every Workout Searchable"
            description="Full-text search across 6,779 workouts with movement, modality, and date filters."
            delay={1850}
          />
        </div>

        {/* CTA button */}
        <div
          className={`
            mt-10 transition-all duration-1000 ease-out
            ${mounted ? 'opacity-100 translate-y-0 delay-[2000ms]' : 'opacity-0 translate-y-6'}
          `}
        >
          <button
            onClick={handleExplore}
            className="
              group relative inline-flex items-center gap-2.5
              px-8 py-3.5 rounded-xl
              bg-gradient-to-r from-blue-600 via-purple-600 to-rose-600
              text-white font-semibold text-base
              shadow-lg shadow-purple-500/20
              hover:shadow-xl hover:shadow-purple-500/30
              hover:scale-[1.03] active:scale-[0.98]
              transition-all duration-300 ease-out
            "
          >
            Explore Dashboard
            <svg
              className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>

        {/* Scroll hint */}
        <div
          className={`
            mt-12 flex flex-col items-center gap-1 text-slate-600
            transition-all duration-1000 ease-out delay-[2200ms]
            ${mounted ? 'opacity-100' : 'opacity-0'}
          `}
        >
          <span className="text-[10px] uppercase tracking-widest">Click to begin</span>
          <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center space-y-1">
        <p className="text-[11px] text-slate-500">Created by <span className="text-slate-400">Ravikant Dewangan</span> | MS S&C | CCFT | Persistence Athletics, Seattle</p>
        <p className="text-[10px] text-slate-600">
          Site by <a href="https://autosterea.com" target="_blank" rel="noopener noreferrer" className="text-blue-400/60 hover:text-blue-400">autosterea.com</a>
          <span className="mx-2">|</span>
          Data from <a href="https://www.crossfit.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400">crossfit.com</a>
          <span className="mx-2">|</span>
          CrossFit is a registered trademark of CrossFit, LLC
        </p>
      </div>
    </div>
  )
}
