export const MODALITY_COLORS: Record<string, string> = {
  M: '#f43f5e',    // rose - Monostructural
  G: '#10b981',    // emerald - Gymnastics
  W: '#3b82f6',    // blue - Weightlifting
  MG: '#f59e0b',   // amber
  MW: '#a855f7',   // purple
  GW: '#06b6d4',   // cyan
  MGW: '#ec4899',  // pink
  Unknown: '#6b7280',
}

export const MODALITY_LABELS: Record<string, string> = {
  M: 'Monostructural',
  G: 'Gymnastics',
  W: 'Weightlifting',
  MG: 'Mono + Gym',
  MW: 'Mono + Weight',
  GW: 'Gym + Weight',
  MGW: 'All Three',
  Unknown: 'Unknown',
}

export const STRUCTURE_COLORS: Record<string, string> = {
  'For Time': '#f43f5e',
  'AMRAP': '#10b981',
  'Max Load / Strength': '#3b82f6',
  'Hero WOD': '#f59e0b',
  'Benchmark': '#a855f7',
  'EMOM': '#06b6d4',
  'Tabata': '#ec4899',
  'Other': '#6b7280',
  'Interval': '#84cc16',
  'Rounds + Reps': '#64748b',
}

export const TIME_DOMAIN_COLORS: Record<string, string> = {
  Sprint: '#f43f5e',
  Short: '#f59e0b',
  Medium: '#10b981',
  Long: '#3b82f6',
  'Strength/Skill': '#a855f7',
  Unknown: '#6b7280',
}

export function getModalityColor(modality: string): string {
  return MODALITY_COLORS[modality] || '#6b7280'
}

export function getNodeColor(modality: string): string {
  const colors: Record<string, string> = {
    M: '#ff6b6b',
    G: '#51cf66',
    W: '#339af0',
  }
  return colors[modality] || '#adb5bd'
}
