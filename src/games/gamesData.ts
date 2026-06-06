import rawGames from '../data/games-data.json'
import type { GamesData, GamesEvent, GamesYear } from '../types-games'

export const G: GamesData = rawGames as unknown as GamesData

export const yearByNum = new Map<number, GamesYear>(G.years.map((y) => [y.year, y]))
export const eventById = new Map<string, GamesEvent>(
  G.years.flatMap((y) => y.events).map((e) => [e.id, e])
)

export const FIRST_YEAR = G.meta.years.length ? Math.min(...G.meta.years) : 2007
export const LAST_YEAR = G.meta.years.length ? Math.max(...G.meta.years) : 2025

// ---------- Display labels ----------

// Same M/G/W palette as the main app's charts (src/utils/colors.ts) so the
// modality colors stay consistent when moving between the two apps.
export { MODALITY_COLORS } from '../utils/colors'

/** Split combined modality strings ("MGW" → fractional weight per letter). */
export function modalityWeights(modality: Record<string, number>): Record<'M' | 'G' | 'W', number> {
  const weights = { M: 0, G: 0, W: 0 }
  Object.entries(modality).forEach(([combo, n]) => {
    const letters = combo.split('').filter((c): c is 'M' | 'G' | 'W' => c === 'M' || c === 'G' || c === 'W')
    letters.forEach((c) => {
      weights[c] += n / letters.length
    })
  })
  return weights
}

export const MODALITY_LABELS: Record<string, string> = {
  M: 'Mono',
  G: 'Gymnastics',
  W: 'Weightlifting',
}

export const TD_LABELS: Record<string, string> = {
  sprint: 'Sprint <5:00',
  short: 'Short 5–10',
  medium: 'Medium 10–20',
  long: 'Long 20–40',
  endurance: 'Endurance 40+',
}

export const TD_ORDER = ['sprint', 'short', 'medium', 'long', 'endurance']

export const TD_COLORS: Record<string, string> = {
  sprint: '#f59e0b',
  short: '#f43f5e',
  medium: '#60a5fa',
  long: '#a855f7',
  endurance: '#14b8a6',
}

export const LOAD_ORDER = ['none', 'light', 'moderate', 'heavy', 'max']

export const LOAD_LABELS: Record<string, string> = {
  none: 'Bodyweight',
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
  max: 'Max Effort',
}

export const LOAD_COLORS: Record<string, string> = {
  none: '#94a3b8',
  light: '#91C640',
  moderate: '#60a5fa',
  heavy: '#f59e0b',
  max: '#f43f5e',
}

export const FORMAT_LABELS: Record<string, string> = {
  'for-time': 'For Time',
  amrap: 'AMRAP',
  'max-load': 'Max Load',
  interval: 'Interval',
  points: 'Points',
  tiebreak: 'Tiebreak',
  other: 'Special',
}

export const ENV_ICONS: Record<string, string> = {
  stadium: '🏟️',
  arena: '🏟️',
  'arena-floor': '🏟️',
  'soccer-field': '🏟️',
  'tennis-stadium': '🎾',
  coliseum: '🏟️',
  ranch: '🌄',
  ocean: '🌊',
  lake: '🏞️',
  river: '🏞️',
  trail: '⛰️',
  road: '🛣️',
  velodrome: '🚴',
  offsite: '📍',
  other: '📍',
}

export const envIcon = (env: string) => ENV_ICONS[env] ?? '📍'

export const movementName = (id: string) => G.movementDisplay[id] ?? id

export const eraById = (id: string) => G.eras.find((e) => e.id === id)

/** Recharts tooltip styling shared across games charts */
export const CHART_TOOLTIP_STYLE = {
  background: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: 10,
  fontSize: 12,
  fontFamily: "'Poppins', sans-serif",
} as const
