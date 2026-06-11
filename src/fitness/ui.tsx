import type { ReactNode } from 'react'
import type { ModuleKey } from './lessonTypes'
import { sourcesFor, CROSS_LINKS, MODULE_COPY, moduleByKey, type CrossLink } from './fitnessData'

/* =========================================================================
   Shared UI kit for the What Is Fitness lesson.
   - "Control" widgets (Segmented, Slider, Presets, Readout, Bar, Legend) are
     styled with the dark .wf-* classes for use inside the stage glass panel.
   - "Content" widgets (LessonHeading, SectionCard, KeyPoints, SourceList,
     CrossLinks) are theme-aware for the scrolling page below the stage.
   ========================================================================= */

/* ------------------------- content (theme-aware) ----------------------- */

export function LessonHeading({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        {kicker && (
          <div className="wf-condensed text-[12px] uppercase tracking-[0.2em] text-[#91C640] mb-1">{kicker}</div>
        )}
        <h2 className="wf-display text-2xl sm:text-3xl text-[var(--text-primary)]">{title}</h2>
      </div>
      {right}
    </div>
  )
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`wf-card p-4 sm:p-5 ${className}`}>{children}</div>
}

export function KeyPoints({ points, accent = '#91C640' }: { points: string[]; accent?: string }) {
  return (
    <ul className="space-y-2.5">
      {points.map((p, i) => (
        <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          <span className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  )
}

export function StatTile({ stat, label, sub, accent }: { stat: string; label: string; sub?: string; accent?: string }) {
  return (
    <div className="wf-card p-3.5 text-center">
      <div className="wf-display text-3xl sm:text-4xl" style={{ color: accent ?? 'var(--text-primary)' }}>
        {stat}
      </div>
      <div className="wf-condensed uppercase tracking-[0.12em] text-[11px] text-[#91C640] mt-1">{label}</div>
      {sub && <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
  )
}

export function SourceList({ moduleKey }: { moduleKey: ModuleKey }) {
  const sources = sourcesFor(moduleKey)
  return (
    <div>
      <div className="wf-condensed text-[12px] uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-3">
        Grounded in
      </div>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.url} className="text-[12px] leading-snug">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-secondary)] hover:text-[#91C640] transition-colors"
            >
              {s.title}
              <span className="text-[var(--text-muted)]"> &#8599;</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CrossLinks({ moduleKey }: { moduleKey: ModuleKey }) {
  const links: CrossLink[] = CROSS_LINKS[moduleKey] ?? []
  if (!links.length) return null
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {links.map((l) => (
        <a key={l.label} href={l.href} className="wf-card wf-card-link p-4 block">
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-sm">
            {l.label}
            <span className="text-[#91C640]">&#8594;</span>
          </div>
          <div className="text-[12px] text-[var(--text-tertiary)] mt-1 leading-snug">{l.note}</div>
        </a>
      ))}
    </div>
  )
}

/**
 * Standard page shell for a module: the interactive stage (passed as children)
 * followed by the faithful explanation, key points, optional module-specific
 * `extra` sections, then cross-links and sources. Keeps all six module pages
 * visually consistent so each module file only has to build its 3D scene.
 */
export function ModulePage({
  moduleKey,
  children,
  extra,
}: {
  moduleKey: ModuleKey
  children: ReactNode
  extra?: ReactNode
}) {
  const meta = moduleByKey(moduleKey)
  const copy = MODULE_COPY[moduleKey]
  return (
    <div className="max-w-6xl mx-auto px-4">
      {children}

      <div className="mt-8 grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 wf-card p-5 sm:p-6 wf-rise wf-rise-1">
          <LessonHeading kicker={`${meta.num} / ${copy.eyebrow}`} title={meta.title} />
          <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">{copy.body}</p>
        </div>
        <div className="wf-card p-5 wf-rise wf-rise-2">
          <div className="wf-condensed text-[12px] uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-3">
            Key points
          </div>
          <KeyPoints points={copy.keyPoints} accent={meta.accent} />
        </div>
      </div>

      {extra && <div className="mt-6">{extra}</div>}

      <div className="mt-6 grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2">
          <div className="wf-condensed text-[12px] uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-3">
            Keep exploring
          </div>
          <CrossLinks moduleKey={moduleKey} />
        </div>
        <div className="wf-card p-5">
          <SourceList moduleKey={moduleKey} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------- controls (dark glass) ----------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="wf-btns">
      {options.map((o) => (
        <button
          key={o.value}
          className={`wf-btn ${o.value === value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PresetButtons<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="wf-btns">
      {options.map((o) => (
        <button key={o} className={`wf-btn ${o === value ? 'primary' : ''}`} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  dotColor,
  onChange,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step?: number
  dotColor?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="wf-row">
      <div className="wf-rl">
        <span className="wf-name">
          {dotColor && <span className="wf-dot" style={{ background: dotColor }} />}
          {label}
        </span>
        <span className="wf-val">{display}</span>
      </div>
      <input
        type="range"
        className="wf-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

export function Readout({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="wf-readout">
      <div className="lbl">{label}</div>
      <div className="big" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Bar({ label, value, color, max = 100 }: { label: string; value: number; color: string; max?: number }) {
  return (
    <div className="wf-bar-row">
      <div className="wf-bar-top">
        <span>{label}</span>
        <span className="s">{Math.round(value)}</span>
      </div>
      <div className="wf-track">
        <div className="wf-fill" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
      </div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="wf-legend">
      {items.map((it) => (
        <span key={it.label} className="item">
          <span className="wf-dot" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

export function ControlHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="wf-c-head">
      <span>{children}</span>
      {right}
    </div>
  )
}
