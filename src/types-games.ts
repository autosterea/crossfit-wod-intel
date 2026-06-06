// CrossFit Games dataset types — bundle emitted by scripts/build-games-data.mjs
// from app/src/data/games/raw/<year>.json (see app/src/data/games/SCHEMA.md)

export type GamesFormat =
  | 'for-time'
  | 'amrap'
  | 'max-load'
  | 'interval'
  | 'points'
  | 'tiebreak'
  | 'other'

export type GamesScoring = 'time' | 'reps' | 'load' | 'points' | 'distance'

export type GamesTimeDomain = 'sprint' | 'short' | 'medium' | 'long' | 'endurance'

export type GamesLoadLevel = 'none' | 'light' | 'moderate' | 'heavy' | 'max'

export type GamesStage = 'games' | 'online'

export interface GamesLoad {
  item: string
  men: string | null
  women: string | null
}

export interface GamesEvent {
  id: string // "<year>-<NN>"
  year: number
  order: number
  stage: GamesStage
  name: string
  aka: string | null
  day: string | null
  description: string
  format: GamesFormat
  scoring: GamesScoring
  timeCapMin: number | null
  winnerMen: string | null
  winnerWomen: string | null
  winningScoreMen: string | null
  winningScoreWomen: string | null
  /** Canonical movement IDs (see GamesData.movementDisplay) */
  movements: string[]
  loads: GamesLoad[]
  equipment: string[]
  eventTypes: string[]
  modality: string // combo of M/G/W
  /** null for untimed events (max lifts, points/skill events) */
  timeDomain: GamesTimeDomain | null
  loadLevel: GamesLoadLevel
  environment: string
  namedWod: string | null
  firstAtGames: string[]
  notes: string | null
}

export interface GamesYear {
  year: number
  venue: string | null
  city: string | null
  region: string | null
  country: string | null
  dates: string | null
  championMen: string | null
  championWomen: string | null
  fieldMen: number | null
  fieldWomen: number | null
  formatNotes: string | null
  yearSummary: string | null
  eraId: string
  events: GamesEvent[]
}

export interface GamesEra {
  id: string
  name: string
  range: [number, number]
  venues: string[]
  desc: string
  eventCount: number
  avgEventsPerYear: number
  modality: Record<string, number>
  timeDomains: Record<string, number>
  loadLevels: Record<string, number>
  environments: Record<string, number>
  topMovements: [string, number][]
}

export interface GamesYearAggregate {
  year: number
  eventCount: number
  onlineEventCount: number
  modality: Record<string, number>
  timeDomains: Record<string, number>
  loadLevels: Record<string, number>
  environments: Record<string, number>
  eventTypes: Record<string, number>
  formats: Record<string, number>
  uniqueMovements: number
  newMovements: number
  cumulativeMovements: number
  avgTimeCapMin: number | null
  pctOutdoor: number
}

export interface GamesMovementStat {
  id: string
  display: string
  /** Matching movement ID in the daily-WOD dataset, if it exists there */
  wodId: string | null
  total: number
  yearCounts: Record<string, number>
  firstYear: number
  lastYear: number
  eventIds: string[]
}

export interface GamesNamedWodCrossover {
  name: string
  eventIds: string[]
  years: number[]
}

export interface GamesRecord {
  icon: string
  stat: string
  label: string
  detail: string
}

// ---- Athlete results (top-10 per division, per year — Capacity Lab) ----

export interface GamesAthleteEventResult {
  eventId: string
  place: number
  /** Leaderboard score display ("8:23.45", "545 lb", "CAP+12"), null if undocumented */
  score: string | null
  points: number
}

export interface GamesAthleteResult {
  rank: number
  name: string
  country: string | null
  totalPoints: number
  /** Real overall finish at the stage (e.g. global QF rank), when different from cohort rank */
  officialRank?: number | null
  events: GamesAthleteEventResult[]
}

export interface GamesWorkModel {
  /** Documented accounting assumptions shown in the methodology */
  assumptions: string[]
  /** Event ids whose ABSOLUTE watts under-count (high-turnover gymnastics/rope) */
  underMeasured?: string[]
  /** [min, max] seconds: Critical Power fit only uses events in this window */
  cpFitWindowSec?: [number, number]
  /** Events with unpublished caps: estimated cap seconds + total work units */
  capEstimates?: Record<string, { capSecMen: number; capSecWomen: number; totalUnits: number }>
  /** Estimated total energy demand per event (kJ, metabolic-equivalent) */
  events: Record<string, { workKjMen: number; workKjWomen: number }>
}

/** A stage event (Open/QF/etc.) — structural subset of GamesEvent the Capacity Lab needs. */
export interface GamesStageEvent {
  id: string
  order: number
  name: string
  description?: string
  format: string
  scoring?: string
  modality: string
  loadLevel: string
  timeDomain: GamesTimeDomain | null
  timeCapMin: number | null
  winningScoreMen: string | null
  winningScoreWomen: string | null
}

export interface GamesStageResult {
  label: string
  projected?: boolean
  events: GamesStageEvent[]
  divisions: {
    men: GamesAthleteResult[]
    women: GamesAthleteResult[]
  }
  sources?: string[]
}

export interface GamesYearResults {
  year: number
  pointsSystem?: string
  sources?: string[]
  status?: string
  note?: string
  divisions?: {
    men: GamesAthleteResult[]
    women: GamesAthleteResult[]
  }
  /** 2026+: multi-stage (Open, Quarterfinals, Semifinals, Games) */
  stages?: Record<string, GamesStageResult>
  workModel?: GamesWorkModel
}

export interface GamesData {
  meta: {
    generated: string
    totalEvents: number
    totalGamesEvents: number
    totalOnlineEvents: number
    years: number[]
    unmappedMovements: string[]
  }
  years: GamesYear[]
  eras: GamesEra[]
  perYear: GamesYearAggregate[]
  movements: GamesMovementStat[]
  movementDisplay: Record<string, string>
  namedWods: GamesNamedWodCrossover[]
  champions: { year: number; men: string | null; women: string | null }[]
  records: GamesRecord[]
  /** Top-10 athlete results keyed by year (only years with researched data) */
  results: Record<string, GamesYearResults>
}
