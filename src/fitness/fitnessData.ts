/* =========================================================================
   What Is Fitness? - the data layer.
   Single source of truth for every lesson module. Grounded in Greg Glassman's
   "What Is Fitness?" (CrossFit Journal, Oct 2002) and the CrossFit Level 1
   Training Guide, with quantitative tables researched + adversarially verified
   against Gastin 2001, the Critical Power literature, ACSM norms, and the
   BLSA/sarcopenia aging studies (see SOURCES). No em or en dashes (house rule).
   ========================================================================= */

import type { ModuleKey, ModuleMeta } from './lessonTypes'
import { catmull1, clamp, lerp, smoothstep } from './lessonMath'

/* ----------------------------- palette --------------------------------- */
export const PAL = {
  seaGreen: '#019644',
  yellowGreen: '#91c640',
  ink: '#070a0e',
  chalk: '#eef3f6',
  muted: '#8ea0a8',
  line: '#1d2a22',
  trained: '#019644', // organic / metabolic adaptation
  practiced: '#38bdf8', // neurological
  both: '#f4b740', // power + speed
  weightlifting: '#f97316',
  gymnastics: '#a78bfa',
  monostructural: '#22d3ee',
  oddObject: '#34d399',
  unknown: '#94a3b8',
  phosphagen: '#f43f5e',
  glycolytic: '#f59e0b',
  oxidative: '#38bdf8',
  sick: '#ef4444',
  well: '#f5b740',
  fit: '#34d399',
  robust: '#22d3ee',
} as const

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
]

/** Sickness (0) -> wellness (0.5) -> fitness (1) color as an [r,g,b] 0..1. */
export function spectrum(t: number): [number, number, number] {
  t = clamp(t, 0, 1)
  const a = hexToRgb(PAL.sick)
  const b = hexToRgb(PAL.well)
  const c = hexToRgb(PAL.fit)
  const mix = (x: [number, number, number], y: [number, number, number], k: number): [number, number, number] => [
    lerp(x[0], y[0], k),
    lerp(x[1], y[1], k),
    lerp(x[2], y[2], k),
  ]
  return t < 0.5 ? mix(a, b, t / 0.5) : mix(b, c, (t - 0.5) / 0.5)
}

/** Same spectrum as a CSS rgb() string. */
export function spectrumCss(t: number): string {
  const [r, g, b] = spectrum(t)
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
}

/* --------------------------- module registry --------------------------- */
export const MODULES: ModuleMeta[] = [
  {
    key: 'skills',
    slug: 'skills',
    num: '01',
    label: '10 Physical Skills',
    mobileLabel: 'Skills',
    title: 'The 10 General Physical Skills',
    blurb: 'You are as fit as you are competent across ten skills. Compare a balanced athlete to twelve specialists.',
    accent: PAL.yellowGreen,
  },
  {
    key: 'hopper',
    slug: 'hopper',
    num: '02',
    label: 'The Hopper',
    title: 'The Hopper Model',
    blurb: 'Draw a random physical task from the hopper and watch a roster of specialists try to beat the generalist.',
    accent: PAL.oddObject,
  },
  {
    key: 'pathways',
    slug: 'pathways',
    num: '03',
    label: 'Energy Systems',
    mobileLabel: 'Energy',
    title: 'The Three Metabolic Pathways',
    blurb: 'Phosphagen, glycolytic, oxidative. Slide through effort duration and watch the dominant engine change.',
    accent: PAL.glycolytic,
  },
  {
    key: 'definition',
    slug: 'definition',
    num: '04',
    label: 'Work Capacity',
    mobileLabel: 'Capacity',
    title: 'Work Capacity Across Broad Time and Modal Domains',
    blurb: 'Fitness, defined. Plot power against duration, average across domains, and measure the area.',
    accent: PAL.yellowGreen,
  },
  {
    key: 'continuum',
    slug: 'continuum',
    num: '05',
    label: 'Sickness-Wellness-Fitness',
    mobileLabel: 'Continuum',
    title: 'The Sickness, Wellness, Fitness Continuum',
    blurb: 'Every health marker rides one continuum. Push them all toward fitness and health follows.',
    accent: PAL.fit,
  },
  {
    key: 'health',
    slug: 'health',
    num: '06',
    label: 'Health Across a Lifetime',
    mobileLabel: 'Health',
    title: 'Sustained Work Capacity Across a Lifetime Is Health',
    blurb: 'Stack every age of your life into one surface. Health is the volume you keep under it.',
    accent: PAL.robust,
  },
  {
    key: 'crossfit',
    slug: 'crossfit',
    num: '07',
    label: 'What Is CrossFit?',
    mobileLabel: 'CrossFit',
    title: 'What Is CrossFit? The Methodology',
    blurb: 'Constantly varied functional movement at high intensity, built on a five-level pyramid. Crack a level and watch everything above it suffer.',
    accent: PAL.seaGreen,
  },
  {
    key: 'technique',
    slug: 'technique',
    num: '08',
    label: 'Technique',
    mobileLabel: 'Technique',
    title: 'Technique: Mechanics, Consistency, Then Intensity',
    blurb: 'The nine foundational movements, demonstrated joint by joint, and why technique is what turns effort into power.',
    accent: PAL.weightlifting,
  },
]

export const moduleByKey = (k: ModuleKey): ModuleMeta => MODULES.find((m) => m.key === k)!

/* ------------------------ 01 - ten physical skills ---------------------- */
export type SkillClass = 'trained' | 'practiced' | 'both'

export interface Skill {
  name: string
  classification: SkillClass
  definition: string
}

/** Glassman's ten, canonical order + canonical definitions. */
export const SKILLS: Skill[] = [
  { name: 'Strength', classification: 'trained', definition: 'The ability of a muscular unit to apply force.' },
  { name: 'Stamina', classification: 'trained', definition: 'Processing, delivering, storing, and using energy.' },
  { name: 'Endurance', classification: 'trained', definition: 'Gathering, processing, and delivering oxygen.' },
  { name: 'Flexibility', classification: 'trained', definition: 'Maximizing the range of motion at a given joint.' },
  { name: 'Power', classification: 'both', definition: 'Applying maximum force in minimum time.' },
  { name: 'Speed', classification: 'both', definition: 'Minimizing the cycle time of a repeated movement.' },
  { name: 'Coordination', classification: 'practiced', definition: 'Combining several movement patterns into one.' },
  { name: 'Agility', classification: 'practiced', definition: 'Minimizing transition time between movement patterns.' },
  { name: 'Balance', classification: 'practiced', definition: 'Controlling the center of gravity over a base.' },
  { name: 'Accuracy', classification: 'practiced', definition: 'Controlling movement toward a target or intensity.' },
]

export const SKILL_NAMES = SKILLS.map((s) => s.name)

export interface Archetype {
  name: string
  blurb: string
  /** Exactly ten values 0..10, one per skill in SKILLS order. */
  profile: number[]
}

/**
 * A balanced CrossFitter plus twelve specialists. Ratings researched against
 * NSCA sport-demand profiles and adversarially checked (no inverted ratings;
 * Powerlifter power softened to 6 for grindy low-velocity lifts; Gymnast
 * stamina to 6). Generalist is the flattest (smallest range) shape.
 */
export const ARCHETYPES: Archetype[] = [
  { name: 'Generalist CrossFitter', blurb: 'Broadly excellent. The most balanced shape on the wheel, with no peaks and no gaps.', profile: [8, 8, 8, 7, 8, 8, 8, 7, 8, 7] },
  { name: 'Olympic Weightlifter', blurb: 'Explosive full-body power through the snatch and clean and jerk.', profile: [9, 5, 3, 8, 10, 7, 8, 6, 8, 7] },
  { name: 'Powerlifter', blurb: 'Maximal absolute strength in three lifts, with little metabolic demand.', profile: [10, 5, 2, 4, 6, 4, 5, 3, 5, 4] },
  { name: 'Marathoner', blurb: 'An aerobic engine built for hours of sustained locomotion.', profile: [3, 9, 10, 5, 3, 5, 5, 4, 5, 4] },
  { name: '100m Sprinter', blurb: 'Pure ground-contact power and top-end speed over a few seconds.', profile: [8, 5, 3, 7, 10, 10, 8, 7, 7, 6] },
  { name: 'Artistic Gymnast', blurb: 'Mastery of coordination, balance, and relative strength.', profile: [7, 6, 5, 10, 9, 7, 10, 9, 10, 9] },
  { name: 'Strongman', blurb: 'Brute maximal and odd-object strength over short, heavy bouts.', profile: [10, 7, 4, 4, 9, 5, 6, 4, 6, 5] },
  { name: 'Competitive Swimmer', blurb: 'Aerobic horsepower with refined aquatic coordination and flexibility.', profile: [7, 9, 9, 9, 7, 7, 8, 5, 6, 6] },
  { name: 'Rower', blurb: 'Sustained power-endurance from a strong aerobic engine.', profile: [8, 9, 9, 6, 7, 6, 7, 4, 6, 6] },
  { name: 'Tactical / Military', blurb: 'A broadly capable hybrid built for unpredictable load-bearing work.', profile: [8, 8, 8, 6, 7, 7, 8, 7, 7, 7] },
  { name: 'Bodybuilder', blurb: 'Maximal muscle size and symmetry with modest conditioning.', profile: [8, 5, 3, 5, 6, 4, 5, 3, 5, 5] },
  { name: 'Team-sport Athlete', blurb: 'A repeat-sprint athlete blending agility, speed, and game accuracy.', profile: [6, 8, 8, 6, 7, 8, 8, 9, 8, 8] },
  { name: 'Sedentary Adult', blurb: 'An untrained baseline across nearly every physical skill.', profile: [2, 2, 2, 3, 2, 2, 3, 2, 3, 3] },
]

/* ------------------------ 02 - the hopper ------------------------------ */
export type DomainKey = 'weightlifting' | 'gymnastics' | 'monostructural' | 'oddObject' | 'unknown'

export interface HopperDomain {
  key: DomainKey
  label: string
  color: string
  tasks: string[]
}

export const HOPPER_DOMAINS: HopperDomain[] = [
  { key: 'weightlifting', label: 'Weightlifting', color: PAL.weightlifting, tasks: ['1RM Back Squat', 'Heavy Clean and Jerk', '5RM Deadlift', 'Max Overhead Press', '3RM Snatch'] },
  { key: 'gymnastics', label: 'Gymnastics', color: PAL.gymnastics, tasks: ['Max Strict Pull-ups', 'Handstand Walk 50 ft', 'First Muscle-up', '20 Pistol Squats', 'Max Toes-to-bar'] },
  { key: 'monostructural', label: 'Monostructural', color: PAL.monostructural, tasks: ['5k Run', '2k Row', '4-min Max-cal Bike', '1 Mile Run', '500 m Row Sprint'] },
  { key: 'oddObject', label: 'Odd object / real world', color: PAL.oddObject, tasks: ['Carry a person 200 m', 'Sandbag to shoulder', 'Flip a heavy tire', 'Yoke Carry 50 ft', 'Sled Push 40 m'] },
  { key: 'unknown', label: 'Unknown / unknowable', color: PAL.unknown, tasks: ['Climb 6 flights with bags', 'Sprint to catch a bus', 'Push a stalled car', 'Lift a fallen branch', 'Carry a child uphill'] },
]

/** Roster scored 0..100 per modal domain. Generalist broad; specialists spike. */
export interface RosterAthlete {
  name: string
  /** Archetype key used to pose the procedural figure. */
  build: 'generalist' | 'weightlifter' | 'endurance' | 'gymnast' | 'strongman' | 'sprinter'
  domain: Record<DomainKey, number>
}

export const HOPPER_ROSTER: RosterAthlete[] = [
  { name: 'Generalist CrossFitter', build: 'generalist', domain: { weightlifting: 78, gymnastics: 80, monostructural: 80, oddObject: 80, unknown: 82 } },
  { name: 'Olympic Weightlifter', build: 'weightlifter', domain: { weightlifting: 95, gymnastics: 58, monostructural: 35, oddObject: 60, unknown: 50 } },
  { name: 'Marathoner', build: 'endurance', domain: { weightlifting: 22, gymnastics: 40, monostructural: 96, oddObject: 38, unknown: 52 } },
  { name: 'Gymnast', build: 'gymnast', domain: { weightlifting: 55, gymnastics: 97, monostructural: 50, oddObject: 52, unknown: 60 } },
  { name: 'Strongman', build: 'strongman', domain: { weightlifting: 88, gymnastics: 40, monostructural: 38, oddObject: 95, unknown: 66 } },
  { name: 'Sprinter', build: 'sprinter', domain: { weightlifting: 60, gymnastics: 58, monostructural: 55, oddObject: 55, unknown: 58 } },
]

/* --------------------- 03 - metabolic pathways ------------------------- */
export type EnergyKey = 'phosphagen' | 'glycolytic' | 'oxidative'

export interface EnergySystem {
  key: EnergyKey
  name: string
  fuel: string
  duration: string
  atpRate: string
  atpYield: string
  description: string
  color: string
}

export const ENERGY_SYSTEMS: EnergySystem[] = [
  {
    key: 'phosphagen',
    name: 'Phosphagen',
    fuel: 'Stored ATP and creatine phosphate',
    duration: '0 to 10 sec',
    atpRate: 'Highest power',
    atpYield: 'Smallest tank',
    description: 'An anaerobic, alactic reaction that rebuilds ATP without oxygen or lactate. Immediate, explosive power, but the store is tiny and largely spent within 10 to 15 seconds of all-out effort.',
    color: PAL.phosphagen,
  },
  {
    key: 'glycolytic',
    name: 'Glycolytic',
    fuel: 'Muscle glycogen and blood glucose',
    duration: '10 sec to 2 min',
    atpRate: 'High power',
    atpYield: 'Moderate tank',
    description: 'Anaerobic breakdown of carbohydrate to lactate. Takes over as the phosphagens fall and peaks near 15 to 30 seconds; capacity is capped by the acid it accumulates.',
    color: PAL.glycolytic,
  },
  {
    key: 'oxidative',
    name: 'Oxidative',
    fuel: 'Carbohydrate and fat with oxygen',
    duration: '2 min and beyond',
    atpRate: 'Lowest power',
    atpYield: 'Nearly unlimited',
    description: 'Aerobic combustion of fuel with oxygen. Slow to ramp but enormous in capacity, it overtakes the anaerobic systems past about 75 seconds and exceeds 90 percent of supply within the hour.',
    color: PAL.oxidative,
  },
]

export interface CrossoverPoint {
  seconds: number
  phosphagen: number
  glycolytic: number
  oxidative: number
}

/** Percent contribution by duration (sums 100). Anchored to Gastin 2001. */
export const ENERGY_CROSSOVER: CrossoverPoint[] = [
  { seconds: 3, phosphagen: 88, glycolytic: 10, oxidative: 2 },
  { seconds: 6, phosphagen: 72, glycolytic: 23, oxidative: 5 },
  { seconds: 10, phosphagen: 53, glycolytic: 40, oxidative: 7 },
  { seconds: 15, phosphagen: 40, glycolytic: 50, oxidative: 10 },
  { seconds: 30, phosphagen: 23, glycolytic: 49, oxidative: 28 },
  { seconds: 50, phosphagen: 14, glycolytic: 44, oxidative: 42 },
  { seconds: 60, phosphagen: 12, glycolytic: 43, oxidative: 45 },
  { seconds: 75, phosphagen: 9, glycolytic: 40, oxidative: 51 },
  { seconds: 90, phosphagen: 8, glycolytic: 36, oxidative: 56 },
  { seconds: 120, phosphagen: 6, glycolytic: 31, oxidative: 63 },
  { seconds: 180, phosphagen: 4, glycolytic: 23, oxidative: 73 },
  { seconds: 240, phosphagen: 3, glycolytic: 18, oxidative: 79 },
  { seconds: 300, phosphagen: 2, glycolytic: 15, oxidative: 83 },
  { seconds: 430, phosphagen: 2, glycolytic: 11, oxidative: 87 },
  { seconds: 600, phosphagen: 1, glycolytic: 9, oxidative: 90 },
  { seconds: 1320, phosphagen: 1, glycolytic: 4, oxidative: 95 },
  { seconds: 3600, phosphagen: 1, glycolytic: 2, oxidative: 97 },
]

export interface EffortBenchmark {
  name: string
  seconds: number
  dominant: EnergyKey
}

export const ENERGY_BENCHMARKS: EffortBenchmark[] = [
  { name: '1RM Lift', seconds: 3, dominant: 'phosphagen' },
  { name: '100m Sprint', seconds: 10, dominant: 'phosphagen' },
  { name: '400m', seconds: 50, dominant: 'glycolytic' },
  { name: '500m Row', seconds: 95, dominant: 'oxidative' },
  { name: 'Fran', seconds: 240, dominant: 'oxidative' },
  { name: '1 Mile Run', seconds: 360, dominant: 'oxidative' },
  { name: '2k Row', seconds: 430, dominant: 'oxidative' },
  { name: '5k Run', seconds: 1320, dominant: 'oxidative' },
  { name: 'Marathon', seconds: 12600, dominant: 'oxidative' },
]

/**
 * Relative MAX SUSTAINABLE TOTAL power (0..1, where 1.0 = a peak ~1 to 3 second
 * all-out burst) at each ENERGY_CROSSOVER duration, in the SAME order/length as
 * ENERGY_CROSSOVER. Monotonically NON-INCREASING (power falls as effort length
 * grows). Anchored to reality: ~1 hr sustainable power is roughly 13% of a peak
 * burst, a 1 min all-out ~50%, a 5 min effort ~28%.
 *
 * The Energy Systems module plots POWER, not "share of supply": each engine's
 * ribbon height = (its Gastin %-share at that duration / 100) * envelope. That
 * makes the PHOSPHAGEN ribbon tower at short efforts, GLYCOLYTIC peak in the
 * middle, and OXIDATIVE a LOW, sustained tail at long durations - it outlasts
 * the others, it is not more powerful. (Fixes the "oxidative looks strongest"
 * chart crime while preserving the dominance/crossover story.)
 */
export const ENERGY_POWER_ENVELOPE: number[] = [
  0.97, 0.93, 0.86, 0.78, 0.63, 0.53, 0.5, 0.46, 0.43, 0.38, 0.33, 0.3, 0.28, 0.24, 0.21, 0.16, 0.13,
]

/** Relative PEAK power each engine can produce (phosphagen normalized to 1.0),
 *  consistent with ATP turnover rates. Highest -> lowest, for axis annotation. */
export const ENERGY_PEAK_POWER: Record<EnergyKey, number> = {
  phosphagen: 1.0,
  glycolytic: 0.6,
  oxidative: 0.28,
}

/* ------------------- 04 - work capacity (definition) ------------------- */
export const POWER_DURATIONS = [1, 10, 30, 60, 300, 900, 1800, 3600]
export const POWER_DURATION_LABELS = ['1 s', '10 s', '30 s', '1 min', '5 min', '15 min', '30 min', '1 hr']

export interface PowerCurve {
  name: string
  /** Relative power 0..1 at each POWER_DURATIONS entry. */
  samples: number[]
}

/**
 * Power-duration curves on ONE SHARED absolute scale (1.0 = the most powerful
 * possible ~1 s human burst), so the four archetypes are directly comparable.
 * EVERY curve is monotonically NON-INCREASING: for everyone, power falls (or
 * holds) as duration grows; it never rises. A marathoner beats a sprinter at
 * long efforts only because the SPRINTER has decayed below the marathoner, not
 * because the marathoner's power went up. The generalist owns the largest AREA
 * (the whole point: a specialist wins one zone, the generalist wins the
 * integral). Columns = POWER_DURATIONS (1 s .. 1 hr).
 */
export const POWER_CURVES: PowerCurve[] = [
  { name: 'Generalist CrossFitter', samples: [0.8, 0.79, 0.74, 0.7, 0.58, 0.5, 0.46, 0.42] },
  { name: 'Powerlifter', samples: [1.0, 0.56, 0.3, 0.18, 0.08, 0.05, 0.04, 0.03] },
  { name: '100m Sprinter', samples: [0.94, 0.9, 0.62, 0.45, 0.25, 0.17, 0.14, 0.12] },
  { name: 'Team-sport Athlete', samples: [0.78, 0.77, 0.72, 0.66, 0.5, 0.42, 0.38, 0.34] },
  { name: 'Triathlete', samples: [0.6, 0.6, 0.59, 0.58, 0.56, 0.54, 0.52, 0.5] },
  { name: 'Marathoner', samples: [0.56, 0.55, 0.54, 0.53, 0.51, 0.49, 0.475, 0.46] },
  { name: 'Sedentary Adult', samples: [0.3, 0.29, 0.27, 0.25, 0.21, 0.17, 0.15, 0.12] },
]

/**
 * Per-domain power tilt (5 multipliers in MODAL_DOMAINS order: weightlifting,
 * gymnastics, mono/cardio, odd object, unknown) for each POWER_CURVES archetype
 * by name. A specialist leans toward its strong domain and away from the rest;
 * the generalist sits near-flat. The Powerlifter spikes weightlifting hardest,
 * the endurance types lean mono/cardio, the generalist is broadest.
 */
export const POWER_DOMAIN_TILT: Record<string, number[]> = {
  'Generalist CrossFitter': [1.02, 1.0, 0.95, 1.0, 0.95],
  Powerlifter: [1.25, 0.72, 0.55, 0.95, 0.7],
  '100m Sprinter': [1.12, 0.92, 0.72, 1.0, 0.8],
  'Team-sport Athlete': [0.95, 1.0, 1.02, 0.95, 1.0],
  Triathlete: [0.7, 0.82, 1.2, 0.82, 0.9],
  Marathoner: [0.62, 0.72, 1.22, 0.8, 0.85],
  'Sedentary Adult': [1, 1, 1, 1, 1],
}

export const POWER_TASKS: { name: string; seconds: number }[] = [
  { name: '1RM clean', seconds: 3 },
  { name: '100m sprint', seconds: 10 },
  { name: '400m run', seconds: 55 },
  { name: '500m row', seconds: 95 },
  { name: 'Fran', seconds: 150 },
  { name: 'Mile run', seconds: 360 },
  { name: '2k row', seconds: 430 },
  { name: 'Cindy 20-min', seconds: 1200 },
  { name: '5k run', seconds: 1320 },
  { name: '10k run', seconds: 2700 },
]

export const POWER_CONCEPT =
  'Work capacity is just average power: force times distance over time. At each effort duration there is a highest average power you can hold, and as duration grows that sustainable power falls, from a near-2000-watt burst down to a few hundred watts for a marathon. The sustained part of that curve follows the Critical Power model, P(t) = CP + W prime / t. CrossFit adds one move: average the curve across every modal domain. Fitness is the area under that averaged curve. A specialist wins one point on the axis. The generalist wins the integral.'

export const MODAL_DOMAINS: { name: string; color: string }[] = [
  { name: 'Weightlifting', color: PAL.weightlifting },
  { name: 'Gymnastics', color: PAL.gymnastics },
  { name: 'Mono / cardio', color: PAL.monostructural },
  { name: 'Odd object', color: PAL.oddObject },
  { name: 'Unknown', color: PAL.unknown },
]

/* ----------------- 05 - sickness wellness fitness ---------------------- */
export interface Biomarker {
  name: string
  unit: string
  betterDirection: 'higher' | 'lower'
  sick: number
  well: number
  fit: number
  elite: number
}

/** The L1 continuum markers, each on its own axis. Young-adult reference scale. */
export const BIOMARKERS: Biomarker[] = [
  { name: 'Resting heart rate', unit: 'bpm', betterDirection: 'lower', sick: 100, well: 70, fit: 55, elite: 45 },
  { name: 'Systolic blood pressure', unit: 'mmHg', betterDirection: 'lower', sick: 160, well: 120, fit: 110, elite: 105 },
  { name: 'Body fat', unit: '%', betterDirection: 'lower', sick: 40, well: 20, fit: 12, elite: 8 },
  { name: 'VO2 max', unit: 'ml/kg/min', betterDirection: 'higher', sick: 25, well: 40, fit: 50, elite: 60 },
  { name: 'HDL cholesterol', unit: 'mg/dL', betterDirection: 'higher', sick: 35, well: 50, fit: 62, elite: 70 },
  { name: 'Triglycerides', unit: 'mg/dL', betterDirection: 'lower', sick: 250, well: 120, fit: 90, elite: 60 },
  { name: 'Fasting glucose', unit: 'mg/dL', betterDirection: 'lower', sick: 130, well: 90, fit: 82, elite: 75 },
  { name: 'Bone density', unit: 'T-score', betterDirection: 'higher', sick: -2.5, well: 0, fit: 1, elite: 2 },
  { name: 'Relative strength', unit: 'x BW deadlift', betterDirection: 'higher', sick: 0.5, well: 1, fit: 2, elite: 2.75 },
  { name: 'Flexibility', unit: 'cm sit-reach', betterDirection: 'higher', sick: -15, well: 0, fit: 10, elite: 18 },
]

/** The L1 canonical worked examples (Glassman's own anchor values). */
export const CONTINUUM_EXAMPLES = [
  'Blood pressure: 160/95 is pathological, 120/70 is healthy, 105/55 is an athlete.',
  'Body fat: 40 percent is pathological, 20 percent is healthy, 10 percent is fit.',
  'The same ordering holds for bone density, triglycerides, HDL, and dozens more.',
]

export interface ContinuumProfile {
  name: string
  /** 0..1 position toward fitness per marker, in BIOMARKERS order. */
  positions: number[]
}

export const CONTINUUM_PROFILES: ContinuumProfile[] = [
  { name: 'Sedentary', positions: [0.1, 0.15, 0.1, 0.1, 0.2, 0.15, 0.2, 0.25, 0.1, 0.2] },
  { name: 'Average / well', positions: [0.5, 0.5, 0.5, 0.45, 0.5, 0.5, 0.5, 0.5, 0.45, 0.5] },
  { name: 'CrossFit athlete', positions: [0.9, 0.85, 0.9, 0.9, 0.85, 0.9, 0.85, 0.85, 0.95, 0.85] },
]

/** Value at a marker for a 0..1 position toward fitness (interpolates bands). */
export function markerValueAt(m: Biomarker, pos: number): number {
  const stops = [0, 0.5, 0.82, 1] // sick, well, fit, elite
  const vals = [m.sick, m.well, m.fit, m.elite]
  const p = clamp(pos, 0, 1)
  for (let i = 0; i < stops.length - 1; i++) {
    if (p <= stops[i + 1]) {
      const t = (p - stops[i]) / (stops[i + 1] - stops[i])
      return lerp(vals[i], vals[i + 1], t)
    }
  }
  return vals[vals.length - 1]
}

/* --------------------- 06 - health across age -------------------------- */
export const DURATION_SHAPE_TRAINED = [0.86, 0.8, 0.7, 0.58, 0.5, 0.44]
export const DURATION_SHAPE_SEDENTARY = [0.3, 0.26, 0.2, 0.15, 0.12, 0.1]

export interface AgingProfile {
  name: string
  trajectory: string
  peak: number
  independentThrough: string
  ampAt: (age: number) => number
  /** How far the body sits toward the "trained" duration shape, 0..1. */
  modality: number
}

/** Tuned so each curve crosses the independence floor near its researched age. */
export const AGING_PROFILES: AgingProfile[] = [
  {
    name: 'Lifelong trainer',
    trajectory: 'Peaks near 30 and descends gently, staying well above the line into old age. Capacity at 80 can resemble a sedentary person at 50.',
    peak: 1,
    independentThrough: '90+',
    ampAt: (a) => Math.max(a < 32 ? 1 : 1 - (0.05 * (a - 32)) / 10, 0.3),
    modality: 1,
  },
  {
    name: 'Average',
    trajectory: 'A moderate peak and a steady decline that crosses the line in the late seventies.',
    peak: 0.65,
    independentThrough: '78',
    ampAt: (a) => Math.max(a < 28 ? 0.65 : 0.65 * (1 - (0.1 * (a - 28)) / 10), 0.08),
    modality: 0.5,
  },
  {
    name: 'Sedentary',
    trajectory: 'A low peak and an early, steep fall. The power ridge collapses first and independence is lost early.',
    peak: 0.45,
    independentThrough: '70',
    ampAt: (a) => Math.max(a < 24 ? 0.45 : 0.45 * (1 - (0.16 * (a - 24)) / 10), 0.05),
    modality: 0.18,
  },
  {
    name: 'Starts at 50',
    trajectory: 'Sedentary, then training at 50 lifts the whole surface sharply and pushes the crossing years later.',
    peak: 0.7,
    independentThrough: '85+',
    ampAt: (a) => {
      const sed = Math.max(a < 24 ? 0.45 : 0.45 * (1 - (0.16 * (a - 24)) / 10), 0.05)
      const tr = Math.max(a < 32 ? 0.78 : 0.78 - (0.045 * (a - 32)) / 10, 0.3)
      const k = smoothstep(48, 55, a)
      return lerp(sed, tr, k)
    },
    modality: 0.5,
  },
]

/** Frailty floor: below this, daily tasks start to exceed capacity. */
export const INDEPENDENCE_LINE = 0.1

/** Relative capacity at duration u (0..1) and age, for an aging profile. */
export function agingCapacity(u: number, age: number, p: AgingProfile): number {
  const valT = clamp(catmull1(DURATION_SHAPE_TRAINED, u * 5), 0, 1.05)
  const valS = clamp(catmull1(DURATION_SHAPE_SEDENTARY, u * 5), 0, 1.05)
  const shape = lerp(valS, valT, p.modality)
  return clamp(shape * p.ampAt(age), 0, 1.05)
}

/* ----------------------------- copy ------------------------------------ */
export const INTRO_TEXT =
  'In the October 2002 CrossFit Journal essay "What Is Fitness?", Greg Glassman set out to do what he argued no authority had bothered to do: give a clear, usable, measurable definition of fitness. He built it from four complementary models and one definition, later codified as work capacity across broad time and modal domains. This lesson walks through each model as presented in that article and the official CrossFit Level 1 Training Guide, ending with the idea that sustaining that capacity across a lifetime is health.'

export const DEFINITION_TEXT =
  'CrossFit defines fitness as work capacity across broad time and modal domains. Plot power against the duration of effort, average that power across many tasks and many time intervals, and the area under the resulting curve is your fitness. It is measurable, it is observable, and it leaves no room for opinion. Tell me how much weight moves, how far it moves, and how long it takes, and you have a valid measure of fitness.'

/** Verbatim: Figure 1, "World-Class Fitness in 100 Words.", CrossFit Level 1 Training Guide p. 17 (2020 ed.). */
export const HUNDRED_WORDS =
  'Eat meat and vegetables, nuts and seeds, some fruit, little starch, and no sugar. Keep intake to levels that will support exercise but not body fat. Practice and train major lifts: Deadlift, clean, squat, presses, C&J (clean and jerk), and snatch. Similarly, master the basics of gymnastics: pull-ups, dips, rope climbs, push-ups, sit-ups, presses to handstands, pirouettes, flips, splits, and holds. Bike, run, swim, row, etc. hard and fast. Five or six days per week mix these elements in as many combinations and patterns as creativity will allow. Routine is the enemy. Keep workouts short and intense. Regularly learn and play new sports.'

export interface ModuleCopy {
  eyebrow: string
  body: string
  keyPoints: string[]
}

/** Faithful per-module explanation (from the verified research workflow). */
export const MODULE_COPY: Record<ModuleKey, ModuleCopy> = {
  skills: {
    eyebrow: 'Standard 1',
    body: "CrossFit's first model holds that there are ten recognized general physical skills, and you are as fit as you are competent in each. A program develops fitness to the extent it improves all ten. The skills are won by different means: four respond to training, a measurable organic change in the body; four respond to practice, a change in the nervous system; power and speed draw on both.",
    keyPoints: [
      'Strength, stamina, endurance, and flexibility improve through training (organic change).',
      'Coordination, agility, balance, and accuracy improve through practice (neurological change).',
      'Power and speed come from both training and practice.',
      'You are only as fit as you are competent across all ten, so ignoring some under-develops fitness.',
    ],
  },
  hopper: {
    eyebrow: 'Standard 2',
    body: 'The second model says fitness is performing well at any and every task imaginable. Picture a hopper loaded with an infinite number of physical challenges, with no selective mechanism, and imagine being asked to perform feats drawn from it at random. Your fitness is your capacity to perform well at those tasks relative to others. This is why CrossFit prizes the generalist and distrusts specialization.',
    keyPoints: [
      'Imagine an infinite hopper of challenges drawn at random, with no say in what you get.',
      'Fitness is your capacity at randomly drawn tasks relative to other people.',
      'It demands performing well even at unfamiliar tasks combined in endless ways.',
      'Nature serves unforeseeable challenges, so the training stimulus must stay broad and varied.',
    ],
  },
  pathways: {
    eyebrow: 'Standard 3',
    body: 'The third model is built on the three metabolic engines that power all human action. Each dominates a different range of power and duration. Total fitness requires training all three, and balancing them is what determines the how and why of the metabolic conditioning CrossFit does. Favoring one or two, and over-training the oxidative engine, are the two most common faults in fitness training.',
    keyPoints: [
      'The phosphagen pathway dominates the highest-power efforts under about 10 seconds.',
      'The glycolytic pathway covers moderate work up to a couple of minutes and makes lactate.',
      'The oxidative pathway runs low-power efforts beyond several minutes with vast capacity.',
      'Balanced conditioning trains all three; over-training one is a fault.',
    ],
  },
  definition: {
    eyebrow: 'The Definition',
    body: 'Here the models combine into a number: work capacity across broad time and modal domains. Plot power on the vertical axis and duration on the horizontal, average power across efforts at intervals like 10 seconds, 1 minute, and 1 hour, and the area under the curve is your fitness. The ten skills set its height, the hopper supplies the domains, the pathways are the time axis. A specialist owns one zone; the generalist defends the whole curve.',
    keyPoints: [
      'Power is force times distance over time, fully measurable.',
      'Average the curve across every modal domain.',
      'Fitness is the area under that averaged curve.',
      'CrossFit calls increasing this work capacity the goal; VO2 max and the rest are correlates.',
    ],
  },
  continuum: {
    eyebrow: 'Standard 4',
    body: 'In the Level 1 guide this becomes the fourth model: nearly every measurable value of health sits on one continuum from sickness, through wellness, to fitness. A blood pressure of 160/95 is pathological, 120/70 is healthy, and 105/55 is an athlete. The same ordering holds across dozens of markers. Sickness, wellness, and fitness are measures of the same thing, so fitness is super-wellness, and a regimen that does not support health is not CrossFit.',
    keyPoints: [
      'Nearly every health marker rides one sick to fit continuum.',
      'Wellness is the midpoint, not the goal.',
      'Fitness pushes every marker as far from sickness as it goes.',
      'Pursuing fitness is a hedge against disease, so it is preventive medicine.',
    ],
  },
  health: {
    eyebrow: 'The Synthesis',
    body: 'Add a third axis to the fitness curve: age. Every age of your life has its own power-duration curve. Stack them and the three-dimensional solid that results is health. Health is sustaining a high work capacity across a whole life, not merely living a long time. Maximize the area under the curve and hold it for as long as you can. Stop training and the surface sinks toward the independence line, where daily tasks exceed capacity. Start at any age and it lifts.',
    keyPoints: [
      'Health is sustained work capacity across a lifetime, the volume under the surface.',
      'VO2 max falls about 10 percent per decade after 30, far slower in trained people.',
      'Strength and especially power decline fastest after 50 without training.',
      'Resistance and power training reclaim capacity at any age, even into the 90s.',
    ],
  },
  crossfit: {
    eyebrow: 'The Methodology',
    body: 'CrossFit is the prescription: "constantly varied, high-intensity functional movement." Functional movements are universal motor recruitment patterns, performed core to extremity, whose defining capacity is moving large loads over long distances quickly. Intensity is defined exactly as power, the variable most associated with favorable adaptation. And the prescription is constantly varied because preparation for the unknown and unknowable is at odds with routine. The whole development path stacks as a five-level pyramid: nutrition, metabolic conditioning, gymnastics, weightlifting and throwing, then sport. A deficiency at any level makes every level above it suffer.',
    keyPoints: [
      'The definition has three parts: constantly varied, functional movements, high intensity.',
      'Intensity is defined exactly as power, and it drives the rate of favorable adaptation.',
      'The pyramid orders development: nutrition to metcon to gymnastics to weightlifting to sport.',
      'It scales by degree, not kind: load and intensity change, the program does not.',
    ],
  },
  technique: {
    eyebrow: 'The Charter',
    body: 'CrossFit\'s charter is mechanics, consistency, then - and only then - intensity. Learn the mechanics of the fundamental movements, prove you can repeat them correctly, and only then push speed and load. The order exists because it optimizes safety, efficacy, and efficiency, and because technique is not the opposite of intensity but its prerequisite: technique is what maximizes the work completed for the energy expended. The nine foundational movements teach it all, three squats, three presses, and three pulls, each one layer more dynamic than the last, all recruiting from core to extremity.',
    keyPoints: [
      'The charter: mechanics first, consistency second, intensity only after both.',
      'Nine foundational movements in three families: squats, presses, and the deadlift family.',
      'Every movement drives core to extremity: hips fire first, arms finish.',
      'Technique is everything: you will not express power in significant measure without it.',
    ],
  },
}

/* =========================================================================
   Module 07 data - What Is CrossFit? (all quotes verified verbatim against
   the CrossFit Level 1 Training Guide, 3rd ed., 2020, V6E3OL-20201212KW;
   page numbers are the printed pages. Em dashes inside original quotes are
   rendered as " - " to match the site's typography rule.)
   ========================================================================= */

export interface HierarchyLevel {
  key: string
  label: string
  /** The guide's "logical flow" role for this layer (p. 29). */
  role: string
  detail: string
  color: string
}

/** Figure 5, "The Theoretical Hierarchy of the Development of an Athlete" (L1 Guide p. 29), bottom to top. */
export const HIERARCHY: HierarchyLevel[] = [
  { key: 'nutrition', label: 'Nutrition', role: 'Molecular foundations', detail: 'The base of the pyramid. Nutrition is the molecular foundation every adaptation above it is built from.', color: PAL.seaGreen },
  { key: 'metcon', label: 'Metabolic Conditioning', role: 'Cardiovascular sufficiency', detail: 'Engine work in all three energy pathways builds the cardiovascular sufficiency the skills sit on.', color: PAL.monostructural },
  { key: 'gymnastics', label: 'Gymnastics', role: 'Body control', detail: 'Control of your own body: pull-ups, dips, presses to handstands, holds. Body control precedes object control.', color: PAL.gymnastics },
  { key: 'weightlifting', label: 'Weightlifting & Throwing', role: 'External object control', detail: 'Control of external objects: the slow lifts and the Olympic lifts, moving loads with speed.', color: PAL.weightlifting },
  { key: 'sport', label: 'Sport', role: 'Mastery and application', detail: 'The apex: applying the whole stack in competition, where fitness is expressed and tested.', color: PAL.both },
]

/** The dependency rule the pyramid visualizes (verbatim, L1 Guide p. 29). */
export const HIERARCHY_RULE =
  'We do not deliberately order these components but nature will. If you have a deficiency at any level of "the pyramid" the components above will suffer.'

export interface DefinitionPillar {
  key: string
  label: string
  quote: string
  cite: string
  explain: string
}

/** The three parts of the prescription (quotes verbatim from "Understanding CrossFit," L1 Guide p. 2). */
export const CF_PILLARS: DefinitionPillar[] = [
  {
    key: 'varied',
    label: 'Constantly varied',
    quote: 'We believe that preparation for random physical challenges - i.e., unknown and unknowable events - is at odds with fixed, predictable, and routine regimens.',
    cite: 'Understanding CrossFit, L1 Guide p. 2',
    explain: 'The breadth of a program\'s stimulus determines the breadth of the adaptation it elicits. Routine is the enemy.',
  },
  {
    key: 'functional',
    label: 'Functional movement',
    quote: 'Functional movements are universal motor recruitment patterns; they are performed in a wave of contraction from core to extremity; and they are compound movements - i.e., they are multi-joint.',
    cite: 'Understanding CrossFit, L1 Guide p. 2',
    explain: 'Their defining capacity: moving large loads over long distances, quickly. Load, distance, speed - that is power.',
  },
  {
    key: 'intensity',
    label: 'High intensity',
    quote: 'Intensity is defined exactly as power, and intensity is the independent variable most commonly associated with maximizing the rate of return of favorable adaptation to exercise.',
    cite: 'Understanding CrossFit, L1 Guide p. 2',
    explain: 'Intensity is not effort or soreness. It is measurable output: work divided by time.',
  },
]

export const CF_SCALING = {
  quote: 'The needs of an Olympic athlete and our grandparents differ by degree not kind.',
  cite: 'What Is Fitness? (Part 1), L1 Guide p. 31',
  rule: 'We scale load and intensity; we do not change programs.',
}

/* =========================================================================
   Module 08 data - Technique + the nine foundational movements. Points of
   performance are verbatim bullets from the L1 Guide Movement Guide
   (pp. 170-215); each movement's one-liner is the guide's own opening line.
   ========================================================================= */

export type MovementGroup = 'squat' | 'press' | 'deadlift'

export interface Foundational {
  key: string
  name: string
  group: MovementGroup
  /** The guide's opening line for the movement (verbatim or tightly compressed). */
  oneLiner: string
  setup: string[]
  execution: string[]
  finish: string
  buildsOn?: string
}

export const CHARTER = {
  steps: ['Mechanics', 'Consistency', 'Intensity'] as const,
  quote:
    "CrossFit's charter for creating the most optimal balance of safety, efficacy, and efficiency is: mechanics, consistency, then - and only then - intensity.",
  cite: 'Scaling CrossFit, L1 Guide p. 77',
  gate: 'It is imperative that the movements can be performed correctly and consistently before load and speed are added.',
  why: 'Technique is what maximizes the work completed for the energy expended.',
  whyCite: 'Technique, L1 Guide pp. 40-44',
}

export const MOVEMENTS: Foundational[] = [
  {
    key: 'air-squat',
    name: 'The Air Squat',
    group: 'squat',
    oneLiner: 'The cornerstone movement of CrossFit, foundational to the front squat and overhead squat.',
    setup: ['Shoulder-width stance.'],
    execution: ['Hips descend back and down.', 'Lumbar curve maintained.', 'Knees in line with toes.', 'Hips descend lower than knees.', 'Heels down.'],
    finish: 'Complete at full hip and knee extension.',
  },
  {
    key: 'front-squat',
    name: 'The Front Squat',
    group: 'squat',
    oneLiner: 'The air squat plus a loaded barbell supported on the torso in the front-rack position.',
    setup: ['Loose fingertip grip on the bar.', 'Hands just outside shoulders.', 'Elbows high (upper arm parallel to the ground).'],
    execution: ['All air squat points carry over.', 'Bar rides the front rack, torso upright.'],
    finish: 'Complete at full hip and knee extension.',
    buildsOn: 'air-squat',
  },
  {
    key: 'overhead-squat',
    name: 'The Overhead Squat',
    group: 'squat',
    oneLiner: 'The ultimate core exercise, the heart of the snatch, peerless in developing athletic movement.',
    setup: ['Shoulders push up into the bar.', 'Arms extended.', 'Wide grip on the bar.', 'Armpits face forward.'],
    execution: ['All air squat points carry over.', 'Bar moves over the middle of the foot.'],
    finish: 'Complete at full hip and knee extension.',
    buildsOn: 'front-squat',
  },
  {
    key: 'shoulder-press',
    name: 'The Shoulder Press',
    group: 'press',
    oneLiner: 'Foundational to all the overhead lifts: neutral spine, straight bar path, correct overhead position.',
    setup: ['Hip-width stance.', 'Elbows slightly in front of the bar.', 'Hands just outside shoulders.', 'Full grip; bar rests on torso.'],
    execution: ['Spine neutral and legs extended.', 'Heels down.', 'Bar moves over the middle of the foot.', 'Shoulders push up into the bar.'],
    finish: 'Complete at full arm extension.',
  },
  {
    key: 'push-press',
    name: 'The Push Press',
    group: 'press',
    oneLiner: 'Adds a vertical dip of the torso and a rapid hip extension that puts velocity on the bar.',
    setup: ['Same set-up as the shoulder press.'],
    execution: ['Torso remains vertical as hips and knees flex in the dip.', 'Hips and legs extend, then arms press.', 'Heels remain down until hips and knees extend.', 'Bar moves over the middle of the foot.'],
    finish: 'Complete at full hip, knee, and arm extension.',
    buildsOn: 'shoulder-press',
  },
  {
    key: 'push-jerk',
    name: 'The Push Jerk',
    group: 'press',
    oneLiner: 'Adds the press under the bar: after hip extension the athlete drives down and receives the lift in a partial overhead squat.',
    setup: ['Same set-up as the shoulder press.'],
    execution: ['Torso remains vertical as hips and knees flex in the dip.', 'Heels stay down until hips and knees extend.', 'Hips and knees extend rapidly, then arms press to drive under the bar.'],
    finish: 'Complete at full hip, knee, and arm extension.',
    buildsOn: 'push-press',
  },
  {
    key: 'deadlift',
    name: 'The Deadlift',
    group: 'deadlift',
    oneLiner: 'Foundational to all pulling lifts: spine neutral at all times, object close to the body.',
    setup: ['Hip-to-shoulder-width stance.', 'Hands just outside hips.', 'Eyes on the horizon.', 'Shoulders slightly in front of or over the bar.', 'Arms straight, bar in contact with the shins.'],
    execution: ['Lumbar curve maintained.', 'Hips and shoulders rise at the same rate until the bar passes the knee.', 'Hips then open.', 'Bar moves over the middle of the foot.', 'Heels down.'],
    finish: 'Complete at full hip and knee extension.',
  },
  {
    key: 'sdhp',
    name: 'The Sumo Deadlift High Pull',
    group: 'deadlift',
    oneLiner: 'Builds on the deadlift with a wider stance and narrower grip, adding velocity and range of motion.',
    setup: ['Slightly wider than shoulder-width stance.', 'Hands inside legs, full grip.', 'Shoulders slightly in front of or over the bar.', 'Knees in line with toes.'],
    execution: ['Lumbar curve maintained.', 'Hips and shoulders rise at the same rate, then hips extend rapidly.', 'Shoulders shrug, then the arms pull.', 'Elbows move high and outside.'],
    finish: 'Complete at full hip and knee extension, bar pulled to below the chin.',
    buildsOn: 'deadlift',
  },
  {
    key: 'mb-clean',
    name: 'The Medicine-Ball Clean',
    group: 'deadlift',
    oneLiner: 'Adds the pull-under: the athlete brings the object to a position of support, the front rack.',
    setup: ['Shoulder-width stance.', 'Ball between the feet, palms on the ball.', 'Shoulders over the ball.', 'Eyes on the horizon.'],
    execution: ['Lumbar curve maintained.', 'Hips extend rapidly.', 'Shoulders then shrug.', 'Arms then pull under to the bottom of the squat.', 'Ball stays close to the body.'],
    finish: 'Complete at full hip and knee extension with the ball in the rack position.',
    buildsOn: 'sdhp',
  },
]

export interface Source {
  title: string
  url: string
  for: ModuleKey[]
}

const ALL: ModuleKey[] = ['skills', 'hopper', 'pathways', 'definition', 'continuum', 'health', 'crossfit', 'technique']

/** Verified citations (all resolved 200 OK in research). */
export const SOURCES: Source[] = [
  { title: 'Greg Glassman, "Understanding CrossFit," CrossFit Journal, April 2007 (L1 Guide pp. 2-3)', url: 'https://library.crossfit.com/free/pdf/CFJ_English_Level1_TrainingGuide.pdf', for: ['crossfit'] },
  { title: '"What Is a CrossFit Workout?" crossfit.com Essentials, June 2023', url: 'https://www.crossfit.com/essentials/what-is-a-crossfit-workout', for: ['crossfit'] },
  { title: 'L1 Guide Movement Guide: the nine foundational movements (pp. 170-215)', url: 'https://library.crossfit.com/free/pdf/CFJ_English_Level1_TrainingGuide.pdf', for: ['technique'] },
  { title: '"Mechanics, Consistency, Intensity" crossfit.com Essentials, February 2020', url: 'https://www.crossfit.com/essentials/mechanics-consistency-intensity-what-does-it-mean', for: ['technique'] },
  { title: 'Greg Glassman, "What Is Fitness?" CrossFit Journal, Issue 2, October 2002', url: 'https://library.crossfit.com/free/pdf/CFJ-trial.pdf', for: ALL },
  { title: '"What Is Fitness?" CrossFit Journal article page', url: 'https://journal.crossfit.com/article/what-is-fitness', for: ALL },
  { title: 'CrossFit Level 1 Training Guide (official L1 book)', url: 'https://library.crossfit.com/free/pdf/CFJ_English_Level1_TrainingGuide.pdf', for: ALL },
  { title: '"What Is Fitness?" Part 4: The Sickness-Wellness-Fitness Continuum', url: 'https://www.crossfit.com/essentials/what-is-fitness-part-4-sickness-wellness-fitness-continuum', for: ['continuum'] },
  { title: 'Gastin, "Energy System Interaction and Relative Contribution During Maximal Exercise," Sports Med 2001', url: 'https://pubmed.ncbi.nlm.nih.gov/11475319/', for: ['pathways', 'definition'] },
  { title: 'Vanhatalo et al., "Critical Power: An Important Fatigue Threshold," MSSE 2016', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5070974/', for: ['definition'] },
  { title: 'Glassman, "Volume Under the Curve: A 3D Definition of Fitness and Health," CrossFit Journal 2009', url: 'https://journal.crossfit.com/2009/02/crossfits-new-definition-of-fitness-volume-under-the-curve-1.tpl', for: ['definition', 'health'] },
  { title: 'Fleg et al., "Accelerated Longitudinal Decline of Aerobic Capacity," Circulation 2005 (BLSA)', url: 'https://www.ahajournals.org/doi/10.1161/circulationaha.105.545459', for: ['health'] },
  { title: 'Alcazar et al., "Relative Muscle Power Threshold to Rise from a Chair," MSSE 2021', url: 'https://journals.lww.com/acsm-msse/fulltext/2021/11000/threshold_of_relative_muscle_power_required_to.1.aspx', for: ['health'] },
]

export const sourcesFor = (k: ModuleKey): Source[] => SOURCES.filter((s) => s.for.includes(k))

/** Cross-links into the rest of the PA tool family (main app + Games). */
export interface CrossLink {
  label: string
  href: string
  note: string
}

export const CROSS_LINKS: Record<ModuleKey, CrossLink[]> = {
  skills: [
    { label: '10 Physical Skills in 25 years of WODs', href: '/', note: 'How real daily programming distributes across the ten skills.' },
    { label: 'Capacity Lab', href: '/games/capacity', note: 'The ten skills measured on real CrossFit Games athletes.' },
  ],
  hopper: [
    { label: 'Hopper Readiness', href: '/', note: 'How completely the daily programming fills the hopper.' },
    { label: 'Games Almanac', href: '/games', note: 'The hopper drawn live at the CrossFit Games, 2007 to today.' },
  ],
  pathways: [{ label: 'Energy Systems in the data', href: '/', note: 'The three pathways across the full WOD archive.' }],
  definition: [
    { label: 'Work Capacity analysis', href: '/', note: 'Work capacity measured across 25 years of WODs.' },
    { label: 'Capacity Lab', href: '/games/capacity', note: 'Power-duration curves fit to real Games results.' },
  ],
  continuum: [{ label: 'Methodology and Sources', href: '/', note: 'How the app grounds its claims in evidence.' }],
  health: [{ label: 'Capacity Lab', href: '/games/capacity', note: 'Capacity across broad time and modal domains, measured.' }],
  crossfit: [
    { label: 'Daily WOD Intelligence', href: '/', note: 'Constantly varied, measured: 25 years of crossfit.com programming analyzed.' },
    { label: 'The 2026 Games hub', href: '/games/2026', note: 'The Sport of Fitness, live: the athletes the methodology built.' },
  ],
  technique: [
    { label: 'All 80 movements in the WOD data', href: '/', note: 'How often each foundational pattern shows up in real programming.' },
    { label: 'Games movements index', href: '/games/movements', note: 'The same patterns under competition loads.' },
  ],
}
