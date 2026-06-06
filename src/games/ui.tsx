import type { ReactNode } from 'react'
import {
  FORMAT_LABELS,
  LOAD_COLORS,
  LOAD_LABELS,
  MODALITY_COLORS,
  TD_COLORS,
  TD_LABELS,
} from './gamesData'

export function Chip({
  children,
  color,
  outline,
}: {
  children: ReactNode
  color?: string
  outline?: boolean
}) {
  const c = color ?? '#94a3b8'
  return (
    <span
      className="games-chip inline-flex items-center gap-1"
      style={
        outline
          ? { border: `1px solid ${c}55`, color: c, background: 'transparent' }
          : { background: `${c}1c`, color: c }
      }
    >
      {children}
    </span>
  )
}

export function ModalityChip({ modality }: { modality: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {modality.split('').map((m) => (
        <span
          key={m}
          className="games-chip"
          style={{ background: `${MODALITY_COLORS[m] ?? '#94a3b8'}22`, color: MODALITY_COLORS[m] ?? '#94a3b8' }}
        >
          {m}
        </span>
      ))}
    </span>
  )
}

export function FormatChip({ format }: { format: string }) {
  return <Chip color="#91C640">{FORMAT_LABELS[format] ?? format}</Chip>
}

export function TimeDomainChip({ td }: { td: string }) {
  return <Chip color={TD_COLORS[td]}>{TD_LABELS[td] ?? td}</Chip>
}

export function LoadChip({ load }: { load: string }) {
  return <Chip color={LOAD_COLORS[load]}>{LOAD_LABELS[load] ?? load}</Chip>
}

/** Editorial section heading: condensed kicker + display title */
export function SectionHeading({
  kicker,
  title,
  right,
}: {
  kicker?: string
  title: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        {kicker && (
          <div className="games-condensed text-[12px] uppercase tracking-[0.2em] text-[#91C640] mb-1">
            {kicker}
          </div>
        )}
        <h2 className="games-display text-2xl sm:text-3xl text-[var(--text-primary)]">{title}</h2>
      </div>
      {right}
    </div>
  )
}

export function StatBlock({ stat, label, sub }: { stat: string; label: string; sub?: string }) {
  return (
    <div className="text-center px-3">
      <div className="games-display text-3xl sm:text-4xl text-[var(--text-primary)]">{stat}</div>
      <div className="games-condensed uppercase tracking-[0.14em] text-[12px] text-[#91C640] mt-1">
        {label}
      </div>
      {sub && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-2xl p-4 sm:p-5 ${className}`}
    >
      {children}
    </div>
  )
}
