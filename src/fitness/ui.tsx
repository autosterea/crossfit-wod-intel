import type { ReactNode } from 'react'
import type { ModuleKey } from './lessonTypes'
import { sourcesFor, CROSS_LINKS, type CrossLink } from './fitnessData'

/* =========================================================================
   Shared UI widgets for the What Is Fitness lesson.
   - "Control" widgets (Slider, Readout, Legend) are styled with the dark
     .wf-* classes for the explore panel (always dark glass).
   - "Content" widgets (KeyPoints, SourceList, CrossLinks) are theme-aware,
     for the Notes below the stage.
   The legacy page shell (ModulePage, LessonHeading, SectionCard, StatTile)
   and the unused controls (Segmented, PresetButtons, Bar, ControlHead) were
   retired with the LessonStage pages at integration (H.52).
   ========================================================================= */

/* ------------------------- content (theme-aware) ----------------------- */

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

/* ------------------------- controls (dark glass) ----------------------- */

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
