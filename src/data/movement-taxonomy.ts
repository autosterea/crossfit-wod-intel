// CrossFit Fitness Model Classification
// Maps every movement to functional patterns, physical skills, energy systems, and muscle groups

export interface MovementTaxonomy {
  id: string
  functionalPattern: FunctionalPattern[]
  primaryMuscles: MuscleGroup[]
  physicalSkills: PhysicalSkill[]  // which of the 10 skills this develops
  complexity: number               // 1-5 scale
  loadType: 'bodyweight' | 'external' | 'mixed'
}

export type FunctionalPattern =
  | 'vertical-push'
  | 'vertical-pull'
  | 'horizontal-push'
  | 'horizontal-pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'locomotion'
  | 'plyometric'
  | 'core'
  | 'olympic-lift'
  | 'overhead-stability'

export type MuscleGroup =
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'anterior-chain'   // hip flexors, abs
  | 'posterior-chain'   // erectors, lower back
  | 'chest'
  | 'lats'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'core'
  | 'full-body'
  | 'cardio-respiratory'

// CrossFit's 10 General Physical Skills
export type PhysicalSkill =
  | 'cardiovascular-endurance'  // 1. Ability of body systems to gather, process, and deliver oxygen
  | 'stamina'                   // 2. Ability of body systems to process, deliver, store, and utilize energy
  | 'strength'                  // 3. Ability of a muscular unit to apply force
  | 'flexibility'               // 4. Ability to maximize range of motion at a given joint
  | 'power'                     // 5. Ability of a muscular unit to apply maximum force in minimum time
  | 'speed'                     // 6. Ability to minimize the time cycle of a repeated movement
  | 'coordination'              // 7. Ability to combine several distinct movement patterns into a singular distinct movement
  | 'agility'                   // 8. Ability to minimize transition time from one movement pattern to another
  | 'balance'                   // 9. Ability to control the placement of the body's center of gravity
  | 'accuracy'                  // 10. Ability to control movement in a given direction or at a given intensity

export const PHYSICAL_SKILL_LABELS: Record<PhysicalSkill, string> = {
  'cardiovascular-endurance': 'Cardio/Respiratory Endurance',
  'stamina': 'Stamina',
  'strength': 'Strength',
  'flexibility': 'Flexibility',
  'power': 'Power',
  'speed': 'Speed',
  'coordination': 'Coordination',
  'agility': 'Agility',
  'balance': 'Balance',
  'accuracy': 'Accuracy',
}

export const FUNCTIONAL_PATTERN_LABELS: Record<FunctionalPattern, string> = {
  'vertical-push': 'Vertical Push',
  'vertical-pull': 'Vertical Pull',
  'horizontal-push': 'Horizontal Push',
  'horizontal-pull': 'Horizontal Pull',
  'squat': 'Squat',
  'hinge': 'Hinge',
  'lunge': 'Lunge',
  'locomotion': 'Locomotion',
  'plyometric': 'Plyometric',
  'core': 'Core/Midline',
  'olympic-lift': 'Olympic Lift',
  'overhead-stability': 'Overhead Stability',
}

export const FUNCTIONAL_PATTERN_COLORS: Record<FunctionalPattern, string> = {
  'vertical-push': '#f43f5e',
  'vertical-pull': '#10b981',
  'horizontal-push': '#fb923c',
  'horizontal-pull': '#06b6d4',
  'squat': '#3b82f6',
  'hinge': '#a855f7',
  'lunge': '#ec4899',
  'locomotion': '#eab308',
  'plyometric': '#f97316',
  'core': '#14b8a6',
  'olympic-lift': '#8b5cf6',
  'overhead-stability': '#6366f1',
}

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  'quads': 'Quadriceps',
  'hamstrings': 'Hamstrings',
  'glutes': 'Glutes',
  'calves': 'Calves',
  'anterior-chain': 'Anterior Chain',
  'posterior-chain': 'Posterior Chain',
  'chest': 'Chest',
  'lats': 'Lats/Back',
  'shoulders': 'Shoulders',
  'triceps': 'Triceps',
  'biceps': 'Biceps',
  'forearms': 'Forearms/Grip',
  'core': 'Core',
  'full-body': 'Full Body',
  'cardio-respiratory': 'Cardio-Respiratory',
}

// Energy system classification based on time domain and structure
export type EnergySystem = 'phosphagen' | 'glycolytic' | 'oxidative' | 'mixed'

export const ENERGY_SYSTEM_LABELS: Record<EnergySystem, string> = {
  phosphagen: 'Phosphagen (ATP-CP)',
  glycolytic: 'Glycolytic',
  oxidative: 'Oxidative (Aerobic)',
  mixed: 'Mixed Pathway',
}

export const ENERGY_SYSTEM_COLORS: Record<EnergySystem, string> = {
  phosphagen: '#f43f5e',
  glycolytic: '#f59e0b',
  oxidative: '#10b981',
  mixed: '#3b82f6',
}

export const ENERGY_SYSTEM_DESCRIPTIONS: Record<EnergySystem, string> = {
  phosphagen: '0-10 seconds | Max effort, immediate energy | 1RM attempts, short sprints',
  glycolytic: '10s-2 minutes | High intensity, lactate buildup | Fran, Grace, sprint WODs',
  oxidative: '2+ minutes | Sustained effort, fat/carb oxidation | Murph, long chippers',
  mixed: 'Variable | Multiple systems engaged | AMRAPs, EMOMs, mixed intervals',
}

// Complete movement taxonomy
export const MOVEMENT_TAXONOMY: Record<string, MovementTaxonomy> = {
  // === MONOSTRUCTURAL / LOCOMOTION ===
  Run: {
    id: 'Run',
    functionalPattern: ['locomotion'],
    primaryMuscles: ['quads', 'hamstrings', 'glutes', 'calves', 'cardio-respiratory'],
    physicalSkills: ['cardiovascular-endurance', 'stamina', 'speed', 'agility'],
    complexity: 1,
    loadType: 'bodyweight',
  },
  Row: {
    id: 'Row',
    functionalPattern: ['horizontal-pull', 'locomotion'],
    primaryMuscles: ['lats', 'hamstrings', 'glutes', 'biceps', 'cardio-respiratory'],
    physicalSkills: ['cardiovascular-endurance', 'stamina', 'strength', 'coordination'],
    complexity: 2,
    loadType: 'bodyweight',
  },
  Bike: {
    id: 'Bike',
    functionalPattern: ['locomotion'],
    primaryMuscles: ['quads', 'hamstrings', 'glutes', 'calves', 'cardio-respiratory'],
    physicalSkills: ['cardiovascular-endurance', 'stamina', 'speed'],
    complexity: 1,
    loadType: 'bodyweight',
  },
  Swim: {
    id: 'Swim',
    functionalPattern: ['locomotion'],
    primaryMuscles: ['lats', 'shoulders', 'core', 'cardio-respiratory'],
    physicalSkills: ['cardiovascular-endurance', 'stamina', 'coordination'],
    complexity: 3,
    loadType: 'bodyweight',
  },
  SkiErg: {
    id: 'SkiErg',
    functionalPattern: ['vertical-pull', 'locomotion'],
    primaryMuscles: ['lats', 'triceps', 'core', 'cardio-respiratory'],
    physicalSkills: ['cardiovascular-endurance', 'stamina', 'power'],
    complexity: 2,
    loadType: 'bodyweight',
  },
  DoubleUnders: {
    id: 'DoubleUnders',
    functionalPattern: ['plyometric', 'locomotion'],
    primaryMuscles: ['calves', 'forearms', 'shoulders', 'cardio-respiratory'],
    physicalSkills: ['coordination', 'accuracy', 'speed', 'cardiovascular-endurance'],
    complexity: 3,
    loadType: 'bodyweight',
  },

  // === GYMNASTICS / BODYWEIGHT ===
  PullUp: {
    id: 'PullUp',
    functionalPattern: ['vertical-pull'],
    primaryMuscles: ['lats', 'biceps', 'forearms', 'core'],
    physicalSkills: ['strength', 'stamina', 'coordination'],
    complexity: 2,
    loadType: 'bodyweight',
  },
  MuscleUp: {
    id: 'MuscleUp',
    functionalPattern: ['vertical-pull', 'vertical-push'],
    primaryMuscles: ['lats', 'chest', 'triceps', 'shoulders', 'core'],
    physicalSkills: ['strength', 'power', 'coordination', 'agility'],
    complexity: 5,
    loadType: 'bodyweight',
  },
  HSPU: {
    id: 'HSPU',
    functionalPattern: ['vertical-push', 'overhead-stability'],
    primaryMuscles: ['shoulders', 'triceps', 'core'],
    physicalSkills: ['strength', 'balance', 'coordination'],
    complexity: 4,
    loadType: 'bodyweight',
  },
  HandstandWalk: {
    id: 'HandstandWalk',
    functionalPattern: ['overhead-stability', 'locomotion'],
    primaryMuscles: ['shoulders', 'core', 'forearms'],
    physicalSkills: ['balance', 'coordination', 'strength', 'agility'],
    complexity: 5,
    loadType: 'bodyweight',
  },
  ToesToBar: {
    id: 'ToesToBar',
    functionalPattern: ['core', 'vertical-pull'],
    primaryMuscles: ['anterior-chain', 'core', 'lats', 'forearms'],
    physicalSkills: ['strength', 'coordination', 'flexibility'],
    complexity: 3,
    loadType: 'bodyweight',
  },
  RopeClimb: {
    id: 'RopeClimb',
    functionalPattern: ['vertical-pull'],
    primaryMuscles: ['lats', 'biceps', 'forearms', 'core'],
    physicalSkills: ['strength', 'coordination', 'agility'],
    complexity: 4,
    loadType: 'bodyweight',
  },
  PistolSquat: {
    id: 'PistolSquat',
    functionalPattern: ['squat', 'lunge'],
    primaryMuscles: ['quads', 'glutes', 'hamstrings', 'core'],
    physicalSkills: ['strength', 'balance', 'flexibility', 'coordination'],
    complexity: 4,
    loadType: 'bodyweight',
  },
  BoxJump: {
    id: 'BoxJump',
    functionalPattern: ['plyometric', 'squat'],
    primaryMuscles: ['quads', 'glutes', 'hamstrings', 'calves'],
    physicalSkills: ['power', 'speed', 'coordination', 'agility'],
    complexity: 2,
    loadType: 'bodyweight',
  },
  Burpee: {
    id: 'Burpee',
    functionalPattern: ['plyometric', 'horizontal-push'],
    primaryMuscles: ['full-body', 'chest', 'quads', 'cardio-respiratory'],
    physicalSkills: ['cardiovascular-endurance', 'stamina', 'speed', 'agility'],
    complexity: 2,
    loadType: 'bodyweight',
  },
  GHD: {
    id: 'GHD',
    functionalPattern: ['core', 'hinge'],
    primaryMuscles: ['anterior-chain', 'posterior-chain', 'core'],
    physicalSkills: ['strength', 'flexibility', 'stamina'],
    complexity: 3,
    loadType: 'bodyweight',
  },

  // === WEIGHTLIFTING ===
  Clean: {
    id: 'Clean',
    functionalPattern: ['olympic-lift', 'hinge', 'squat'],
    primaryMuscles: ['full-body', 'quads', 'glutes', 'hamstrings', 'posterior-chain', 'shoulders'],
    physicalSkills: ['power', 'strength', 'speed', 'coordination', 'flexibility'],
    complexity: 5,
    loadType: 'external',
  },
  Snatch: {
    id: 'Snatch',
    functionalPattern: ['olympic-lift', 'hinge', 'overhead-stability'],
    primaryMuscles: ['full-body', 'shoulders', 'glutes', 'hamstrings', 'posterior-chain'],
    physicalSkills: ['power', 'speed', 'coordination', 'flexibility', 'balance', 'accuracy'],
    complexity: 5,
    loadType: 'external',
  },
  Deadlift: {
    id: 'Deadlift',
    functionalPattern: ['hinge'],
    primaryMuscles: ['hamstrings', 'glutes', 'posterior-chain', 'forearms', 'quads'],
    physicalSkills: ['strength', 'power'],
    complexity: 2,
    loadType: 'external',
  },
  BackSquat: {
    id: 'BackSquat',
    functionalPattern: ['squat'],
    primaryMuscles: ['quads', 'glutes', 'hamstrings', 'core', 'posterior-chain'],
    physicalSkills: ['strength', 'power', 'flexibility'],
    complexity: 2,
    loadType: 'external',
  },
  FrontSquat: {
    id: 'FrontSquat',
    functionalPattern: ['squat'],
    primaryMuscles: ['quads', 'glutes', 'core', 'shoulders'],
    physicalSkills: ['strength', 'flexibility', 'balance'],
    complexity: 3,
    loadType: 'external',
  },
  OverheadSquat: {
    id: 'OverheadSquat',
    functionalPattern: ['squat', 'overhead-stability'],
    primaryMuscles: ['quads', 'glutes', 'shoulders', 'core'],
    physicalSkills: ['strength', 'flexibility', 'balance', 'coordination'],
    complexity: 4,
    loadType: 'external',
  },
  ShoulderPress: {
    id: 'ShoulderPress',
    functionalPattern: ['vertical-push'],
    primaryMuscles: ['shoulders', 'triceps', 'core'],
    physicalSkills: ['strength'],
    complexity: 1,
    loadType: 'external',
  },
  PushPress: {
    id: 'PushPress',
    functionalPattern: ['vertical-push'],
    primaryMuscles: ['shoulders', 'triceps', 'quads', 'glutes'],
    physicalSkills: ['strength', 'power', 'coordination'],
    complexity: 2,
    loadType: 'external',
  },
  PushJerk: {
    id: 'PushJerk',
    functionalPattern: ['vertical-push', 'olympic-lift'],
    primaryMuscles: ['shoulders', 'triceps', 'quads', 'glutes', 'core'],
    physicalSkills: ['power', 'speed', 'coordination', 'balance'],
    complexity: 4,
    loadType: 'external',
  },
  SplitJerk: {
    id: 'SplitJerk',
    functionalPattern: ['vertical-push', 'olympic-lift', 'lunge'],
    primaryMuscles: ['shoulders', 'triceps', 'quads', 'glutes', 'core'],
    physicalSkills: ['power', 'speed', 'coordination', 'balance', 'agility'],
    complexity: 5,
    loadType: 'external',
  },
  Thruster: {
    id: 'Thruster',
    functionalPattern: ['squat', 'vertical-push'],
    primaryMuscles: ['quads', 'glutes', 'shoulders', 'triceps', 'core'],
    physicalSkills: ['strength', 'power', 'stamina', 'coordination'],
    complexity: 3,
    loadType: 'external',
  },
  WallBall: {
    id: 'WallBall',
    functionalPattern: ['squat', 'vertical-push'],
    primaryMuscles: ['quads', 'glutes', 'shoulders', 'core'],
    physicalSkills: ['stamina', 'power', 'accuracy', 'coordination'],
    complexity: 2,
    loadType: 'external',
  },
  KettlebellSwing: {
    id: 'KettlebellSwing',
    functionalPattern: ['hinge'],
    primaryMuscles: ['glutes', 'hamstrings', 'posterior-chain', 'shoulders', 'core'],
    physicalSkills: ['power', 'stamina', 'coordination'],
    complexity: 2,
    loadType: 'external',
  },
  DumbbellWork: {
    id: 'DumbbellWork',
    functionalPattern: ['vertical-push', 'hinge', 'squat'],
    primaryMuscles: ['full-body', 'shoulders', 'core'],
    physicalSkills: ['strength', 'coordination', 'balance'],
    complexity: 2,
    loadType: 'external',
  },
}

// Classify a workout's energy system from its time domain and structure
export function classifyEnergySystem(timeDomain: string, structure: string): EnergySystem {
  if (structure === 'Max Load / Strength' || timeDomain === 'Strength/Skill') return 'phosphagen'
  if (timeDomain === 'Sprint') return 'glycolytic'
  if (timeDomain === 'Short') return 'glycolytic'
  if (timeDomain === 'Long') return 'oxidative'
  if (timeDomain === 'Medium') return 'mixed'
  if (structure === 'AMRAP' || structure === 'EMOM' || structure === 'Interval') return 'mixed'
  if (structure === 'Tabata') return 'glycolytic'
  return 'mixed'
}

// Get all physical skills a workout trains based on its movements
export function getWorkoutSkills(movements: string[]): Record<PhysicalSkill, number> {
  const skills: Record<PhysicalSkill, number> = {
    'cardiovascular-endurance': 0,
    'stamina': 0,
    'strength': 0,
    'flexibility': 0,
    'power': 0,
    'speed': 0,
    'coordination': 0,
    'agility': 0,
    'balance': 0,
    'accuracy': 0,
  }

  movements.forEach((m) => {
    const tax = MOVEMENT_TAXONOMY[m]
    if (!tax) return
    tax.physicalSkills.forEach((s) => {
      skills[s] += 1
    })
  })

  // Normalize to 0-100
  const max = Math.max(...Object.values(skills), 1)
  for (const k of Object.keys(skills) as PhysicalSkill[]) {
    skills[k] = Math.round((skills[k] / max) * 100)
  }
  return skills
}

// Get functional patterns for a workout
export function getWorkoutPatterns(movements: string[]): Record<FunctionalPattern, number> {
  const patterns: Record<FunctionalPattern, number> = {
    'vertical-push': 0,
    'vertical-pull': 0,
    'horizontal-push': 0,
    'horizontal-pull': 0,
    'squat': 0,
    'hinge': 0,
    'lunge': 0,
    'locomotion': 0,
    'plyometric': 0,
    'core': 0,
    'olympic-lift': 0,
    'overhead-stability': 0,
  }

  movements.forEach((m) => {
    const tax = MOVEMENT_TAXONOMY[m]
    if (!tax) return
    tax.functionalPattern.forEach((p) => {
      patterns[p] += 1
    })
  })

  return patterns
}

// Get primary muscle groups for a workout
export function getWorkoutMuscles(movements: string[]): Record<MuscleGroup, number> {
  const muscles: Partial<Record<MuscleGroup, number>> = {}

  movements.forEach((m) => {
    const tax = MOVEMENT_TAXONOMY[m]
    if (!tax) return
    tax.primaryMuscles.forEach((mg) => {
      muscles[mg] = (muscles[mg] || 0) + 1
    })
  })

  return muscles as Record<MuscleGroup, number>
}

// Average complexity score for a workout
export function getWorkoutComplexity(movements: string[]): number {
  const scores = movements.map((m) => MOVEMENT_TAXONOMY[m]?.complexity || 2)
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
}
