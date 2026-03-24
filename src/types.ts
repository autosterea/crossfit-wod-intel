export interface NetworkNode {
  id: string
  label: string
  modality: string
  count: number
}

export interface NetworkLink {
  source: string
  target: string
  value: number
}

export interface Overview {
  total_days: number
  total_workouts: number
  total_rest_days: number
  date_range: string
  first_date: string
  last_date: string
  years_covered: number
  modality: Record<string, number>
  structure: Record<string, number>
  time_domain: Record<string, number>
  load_profile: Record<string, number>
  movement_frequency: Record<string, number>
  most_common_movement: string
  hero_wod_count: number
  benchmark_count: number
  named_wod_count: number
}

export interface Era {
  name: string
  range: string
  start: string
  end: string
  desc: string
  workout_count: number
  modality: Record<string, number>
  structure: Record<string, number>
  time_domain: Record<string, number>
  load_profile: Record<string, number>
  top_movements: Record<string, number>
  pct_M: number
  pct_G: number
  pct_W: number
  pct_MG: number
  pct_MW: number
  pct_GW: number
  pct_MGW: number
}

export interface MovementProfile {
  id: string
  name: string
  modality: string
  total_count: number
  pct: number
  first_seen: string
  last_seen: string
  year_pct: Record<string, number>
  featured_in_wods: string[]
  top_partners: string[]
}

export interface NamedWod {
  name: string
  count: number
  is_hero: boolean
  is_benchmark: boolean
  first_seen: string
  last_seen: string
  movements: string[]
  primary_modality: string
  primary_structure: string
  primary_time_domain: string
}

export interface Workout {
  d: string
  t: string
  s: string
  mo: string
  st: string
  td: string
  lp: string
  nw: string
  ih: boolean
  ib: boolean
  mv: string[]
}

export interface CrossFitData {
  overview: Overview
  yearData: Record<string, any>
  trends: {
    modality: any[]
    structure: any[]
    timeDomain: any[]
    loadProfile: any[]
    movements: any[]
    topMovements: string[]
  }
  network: {
    nodes: NetworkNode[]
    links: NetworkLink[]
  }
  cooccurMatrix: {
    movements: string[]
    matrix: number[][]
  }
  dowData: any[]
  namedWods: NamedWod[]
  movementEncyclopedia: MovementProfile[]
  eras: Era[]
  funStats: { icon: string; stat: string; label: string }[]
  todaysWod: any
  searchIndex: Workout[]
  movementDisplay: Record<string, string>
  movementModality: Record<string, string>
}
