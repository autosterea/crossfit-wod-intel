/* Inline SVG icons for the story UI (no icon font, no network). */

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const IconPrev = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...S}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const IconNext = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...S}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)
export const IconPlay = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
)
export const IconPause = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
  </svg>
)
export const IconReplay = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...S}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </svg>
)
export const IconChevron = ({ open = false }: { open?: boolean }) => (
  <svg viewBox="0 0 12 12" width="12" height="12" {...S} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 160ms' }}>
    <path d="M2.5 4.5L6 8l3.5-3.5" />
  </svg>
)
export const IconOrbit = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
    <ellipse cx="12" cy="12" rx="9" ry="4" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    <path d="M17.5 5.5l2 1.2-1.2 2" />
  </svg>
)
export const IconBack = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...S}>
    <path d="M10 6l-6 6 6 6M4 12h16" />
  </svg>
)
export const IconReset = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...S}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </svg>
)
export const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...S}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)
export const IconClose = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...S}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
