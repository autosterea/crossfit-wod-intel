// Types for the Athlete Intelligence data emitted by
// scripts/build-athlete-intel-2026.mjs -> public/projection-2026.json.
// Every field is a deterministically-computed, competition-derived number.

export interface SkillScore {
  skill: string
  measured: boolean
  score: number | null // 0-100 field-relative; null when unmeasured (Flexibility)
}

export interface DrivingEvent {
  event: string
  perf: number
  place: number
}

export interface BucketScore {
  key: string
  label: string
  val: number // the athlete's mean placement-percentile in this axis (0-100)
  pct: number // where that ranks vs the division cohort (0-100)
  drivingEvents: DrivingEvent[]
}

export interface GamesAppearance {
  year: number
  overallRank: number
  fieldSize: number
  finishPct: number
  capacity: number
  nEvents: number
}

export interface SeasonRank {
  score: number
  seasonZ: number
  components: { season: number; priorForm: number | null; age: number }
  age: number | null
  ageFactor: number
  rookie: boolean
  rank: number
}

export type ModalKey = 'mono' | 'gym' | 'weight' | 'heavy' | 'light' | 'sprint' | 'engine'
export type Confidence = 'high' | 'medium' | 'low'

export interface AthleteIntel {
  slug: string
  name: string
  division: 'men' | 'women'
  country: string | null
  age: number | null
  capacity: number // career field-percentile capacity across all events
  seasonCapacity: number // 2026 Open+QF only
  consistency: number
  modal: Record<ModalKey, number | null>
  energy: { phosphagen: number | null; glycolytic: number | null; oxidative: number | null }
  skills: SkillScore[]
  hopper: { capacity: number; consistency: number }
  seasonRank: SeasonRank
  strengths: BucketScore[]
  weaknesses: BucketScore[]
  gamesHistory: GamesAppearance[]
  bestGamesFinish: number | null
  confidence: Confidence
  dataDepth: { seasonEvents: number; gamesAppearances: number; gamesEvents: number; totalEvents: number }
  fingerprint: { skillRaw: (number | null)[]; modal: Record<ModalKey, number | null> }
  tracesTo: string[]
}

export interface ProjectionData {
  generated: string
  season: number
  fieldProvisional: boolean
  fieldNote: string
  method: {
    skillOrder: string[]
    unmeasuredSkills: string[]
    projectionBlend: { measuredWeight: number; similarityWeight: number }
    seasonRankWeights: Record<string, number>
    modalBuckets: Record<string, string>
    note: string
  }
  athletes: Record<string, AthleteIntel>
}
