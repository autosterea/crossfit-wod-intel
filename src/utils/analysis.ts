// Pre-computed analysis results from CrossFit data
import type { CrossFitData, Workout } from '../types'
import {
  MOVEMENT_TAXONOMY, classifyEnergySystem, getWorkoutSkills,
  getWorkoutPatterns, getWorkoutMuscles, getWorkoutComplexity,
  type EnergySystem, type FunctionalPattern, type PhysicalSkill, type MuscleGroup,
} from '../data/movement-taxonomy'
import { chiSquaredTest, linearRegression, mannKendallTrend, balanceScore, mean, stdDev, zScore } from './statistics'

export interface AnalysisResults {
  // Energy system breakdown
  energySystems: Record<EnergySystem, number>
  energyByYear: { year: string; phosphagen: number; glycolytic: number; oxidative: number; mixed: number }[]

  // Functional pattern totals
  functionalPatterns: Record<FunctionalPattern, number>
  patternsByYear: Record<string, any>[]

  // Push/Pull balance
  pushPullRatio: number
  pushTotal: number
  pullTotal: number
  squatHingeRatio: number
  squatTotal: number
  hingeTotal: number

  // 10 Physical Skills aggregate
  aggregateSkills: Record<PhysicalSkill, number>
  skillsByYear: { year: string; [key: string]: number | string }[]

  // Muscle group coverage
  muscleGroups: Record<string, number>

  // Balance scores
  functionalBalance: number      // 0 = perfect, 1 = imbalanced
  skillBalance: number
  energyBalance: number

  // Work capacity across time domains
  workCapacity: { domain: string; count: number; pct: number }[]

  // Complexity analysis
  avgComplexity: number
  complexityByYear: { year: string; avg: number }[]

  // Statistical insights
  significantPairings: { pair: string; observed: number; expected: number; chiSq: number; ratio: number }[]
  trendingUp: { name: string; slope: number; rSq: number }[]
  trendingDown: { name: string; slope: number; rSq: number }[]
  anomalousWorkouts: { date: string; title: string; zScore: number; reason: string }[]

  // Movement function map data (for force graph)
  functionNodes: { id: string; group: string; count: number; label: string }[]
  functionLinks: { source: string; target: string; value: number }[]
}

export function analyzeData(data: CrossFitData): AnalysisResults {
  const { searchIndex, overview, cooccurMatrix } = data
  const totalWods = searchIndex.length

  // === ENERGY SYSTEMS ===
  const energySystems: Record<EnergySystem, number> = { phosphagen: 0, glycolytic: 0, oxidative: 0, mixed: 0 }
  const energyByYearMap: Record<string, Record<EnergySystem, number>> = {}

  searchIndex.forEach((w) => {
    const es = classifyEnergySystem(w.td, w.st)
    energySystems[es]++
    const year = w.d.substring(0, 4)
    if (!energyByYearMap[year]) energyByYearMap[year] = { phosphagen: 0, glycolytic: 0, oxidative: 0, mixed: 0 }
    energyByYearMap[year][es]++
  })

  const energyByYear = Object.entries(energyByYearMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      return {
        year,
        phosphagen: +((counts.phosphagen / total) * 100).toFixed(1),
        glycolytic: +((counts.glycolytic / total) * 100).toFixed(1),
        oxidative: +((counts.oxidative / total) * 100).toFixed(1),
        mixed: +((counts.mixed / total) * 100).toFixed(1),
      }
    })

  // === FUNCTIONAL PATTERNS ===
  const functionalPatterns: Record<FunctionalPattern, number> = {
    'vertical-push': 0, 'vertical-pull': 0, 'horizontal-push': 0, 'horizontal-pull': 0,
    'squat': 0, 'hinge': 0, 'lunge': 0, 'locomotion': 0,
    'plyometric': 0, 'core': 0, 'olympic-lift': 0, 'overhead-stability': 0,
  }
  const patternByYearMap: Record<string, Record<string, number>> = {}

  searchIndex.forEach((w) => {
    const patterns = getWorkoutPatterns(w.mv)
    const year = w.d.substring(0, 4)
    if (!patternByYearMap[year]) patternByYearMap[year] = {}

    for (const [k, v] of Object.entries(patterns)) {
      if (v > 0) {
        functionalPatterns[k as FunctionalPattern] += 1
        patternByYearMap[year][k] = (patternByYearMap[year][k] || 0) + 1
      }
    }
  })

  const patternsByYear: Record<string, any>[] = Object.entries(patternByYearMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, counts]) => ({ year, ...counts }))

  // Push/Pull balance
  const pushTotal = functionalPatterns['vertical-push'] + functionalPatterns['horizontal-push']
  const pullTotal = functionalPatterns['vertical-pull'] + functionalPatterns['horizontal-pull']
  const pushPullRatio = pullTotal > 0 ? pushTotal / pullTotal : 0
  const squatTotal = functionalPatterns['squat']
  const hingeTotal = functionalPatterns['hinge']
  const squatHingeRatio = hingeTotal > 0 ? squatTotal / hingeTotal : 0

  // === 10 PHYSICAL SKILLS ===
  const allSkills: PhysicalSkill[] = [
    'cardiovascular-endurance', 'stamina', 'strength', 'flexibility',
    'power', 'speed', 'coordination', 'agility', 'balance', 'accuracy',
  ]
  const aggregateSkills: Record<PhysicalSkill, number> = {} as any
  allSkills.forEach((s) => { aggregateSkills[s] = 0 })
  const skillByYearMap: Record<string, Record<PhysicalSkill, number>> = {}

  searchIndex.forEach((w) => {
    const year = w.d.substring(0, 4)
    if (!skillByYearMap[year]) {
      skillByYearMap[year] = {} as any
      allSkills.forEach((s) => { skillByYearMap[year][s] = 0 })
    }
    w.mv.forEach((m) => {
      const tax = MOVEMENT_TAXONOMY[m]
      if (!tax) return
      tax.physicalSkills.forEach((s) => {
        aggregateSkills[s]++
        skillByYearMap[year][s]++
      })
    })
  })

  // Normalize aggregate to percentages
  const maxSkill = Math.max(...Object.values(aggregateSkills))
  for (const s of allSkills) {
    aggregateSkills[s] = +((aggregateSkills[s] / maxSkill) * 100).toFixed(1)
  }

  const skillsByYear = Object.entries(skillByYearMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      const entry: any = { year }
      allSkills.forEach((s) => { entry[s] = +((counts[s] / Math.max(total, 1)) * 100).toFixed(1) })
      return entry
    })

  // === MUSCLE GROUPS ===
  const muscleGroups: Record<string, number> = {}
  searchIndex.forEach((w) => {
    const muscles = getWorkoutMuscles(w.mv)
    for (const [mg, count] of Object.entries(muscles)) {
      if (count > 0) muscleGroups[mg] = (muscleGroups[mg] || 0) + 1
    }
  })

  // === BALANCE SCORES ===
  const pushPullSquatHinge = [pushTotal, pullTotal, squatTotal, hingeTotal]
  const functionalBalance = balanceScore(Object.values(functionalPatterns))
  const skillBalance = balanceScore(Object.values(aggregateSkills))
  const energyBalance = balanceScore(Object.values(energySystems))

  // === WORK CAPACITY ===
  const workCapacity = Object.entries(overview.time_domain)
    .filter(([k]) => k !== 'Unknown')
    .map(([domain, count]) => ({
      domain,
      count,
      pct: +((count / totalWods) * 100).toFixed(1),
    }))
    .sort((a, b) => b.count - a.count)

  // === COMPLEXITY ===
  const complexityByYearMap: Record<string, number[]> = {}
  let totalComplexity = 0
  searchIndex.forEach((w) => {
    const c = getWorkoutComplexity(w.mv)
    totalComplexity += c
    const year = w.d.substring(0, 4)
    if (!complexityByYearMap[year]) complexityByYearMap[year] = []
    complexityByYearMap[year].push(c)
  })

  const avgComplexity = totalComplexity / totalWods
  const complexityByYear = Object.entries(complexityByYearMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, vals]) => ({ year, avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) }))

  // === STATISTICAL PAIRINGS ===
  const { movements, matrix } = cooccurMatrix
  const significantPairings: AnalysisResults['significantPairings'] = []
  for (let i = 0; i < movements.length; i++) {
    for (let j = i + 1; j < movements.length; j++) {
      const observed = matrix[i][j]
      const freqI = matrix[i][i] / totalWods
      const freqJ = matrix[j][j] / totalWods
      const expected = freqI * freqJ * totalWods
      if (expected > 5 && observed > 10) {
        const { chiSq, significant } = chiSquaredTest(observed, expected)
        if (significant) {
          significantPairings.push({
            pair: `${data.movementDisplay[movements[i]]} + ${data.movementDisplay[movements[j]]}`,
            observed,
            expected: +expected.toFixed(0),
            chiSq: +chiSq.toFixed(1),
            ratio: +(observed / expected).toFixed(2),
          })
        }
      }
    }
  }
  significantPairings.sort((a, b) => b.chiSq - a.chiSq)

  // === TREND ANALYSIS ===
  const years = Object.keys(data.yearData).sort()
  const yearNums = years.map(Number)
  const trendingUp: AnalysisResults['trendingUp'] = []
  const trendingDown: AnalysisResults['trendingDown'] = []

  // Trend for each functional pattern
  for (const pattern of Object.keys(functionalPatterns) as FunctionalPattern[]) {
    const values = patternsByYear.map((y) => (y[pattern] as number) || 0)
    if (values.length < 5) continue
    const totals = patternsByYear.map((y) => {
      let s = 0
      for (const k of Object.keys(functionalPatterns)) s += ((y[k] as number) || 0)
      return s
    })
    const pcts = values.map((v, i) => totals[i] > 0 ? (v / totals[i]) * 100 : 0)
    const reg = linearRegression(yearNums.slice(0, pcts.length), pcts)
    const trend = mannKendallTrend(pcts)

    if (trend.significant && reg.rSquared > 0.15) {
      const entry = { name: pattern, slope: +reg.slope.toFixed(3), rSq: +reg.rSquared.toFixed(2) }
      if (trend.direction === 'increasing') trendingUp.push(entry)
      else if (trend.direction === 'decreasing') trendingDown.push(entry)
    }
  }

  trendingUp.sort((a, b) => b.rSq - a.rSq)
  trendingDown.sort((a, b) => b.rSq - a.rSq)

  // === ANOMALOUS WORKOUTS ===
  const movCounts = searchIndex.map((w) => w.mv.length)
  const movMean = mean(movCounts)
  const movStd = stdDev(movCounts)

  const anomalousWorkouts: AnalysisResults['anomalousWorkouts'] = []
  searchIndex.forEach((w) => {
    const z = zScore(w.mv.length, movMean, movStd)
    if (Math.abs(z) > 2.5) {
      anomalousWorkouts.push({
        date: w.d,
        title: w.nw || w.t,
        zScore: +z.toFixed(2),
        reason: z > 0 ? `${w.mv.length} movements (unusually complex)` : `${w.mv.length} movement (unusually simple)`,
      })
    }
  })
  anomalousWorkouts.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))

  // === FUNCTION MAP (for force graph) ===
  const functionNodes: AnalysisResults['functionNodes'] = []
  const functionLinksMap: Record<string, number> = {}

  // Add pattern group nodes
  for (const [pattern, count] of Object.entries(functionalPatterns)) {
    functionNodes.push({
      id: `pattern:${pattern}`,
      group: 'pattern',
      count,
      label: pattern.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
    })
  }

  // Add movement nodes
  for (const [id, tax] of Object.entries(MOVEMENT_TAXONOMY)) {
    const count = overview.movement_frequency[id] || 0
    if (count === 0) continue
    functionNodes.push({
      id: `mov:${id}`,
      group: tax.functionalPattern[0],
      count,
      label: data.movementDisplay[id] || id,
    })
    // Link movement to its patterns
    tax.functionalPattern.forEach((p) => {
      const key = `mov:${id}||pattern:${p}`
      functionLinksMap[key] = count
    })
  }

  const functionLinks = Object.entries(functionLinksMap).map(([key, value]) => {
    const [source, target] = key.split('||')
    return { source, target, value }
  })

  return {
    energySystems,
    energyByYear,
    functionalPatterns,
    patternsByYear,
    pushPullRatio,
    pushTotal,
    pullTotal,
    squatHingeRatio,
    squatTotal,
    hingeTotal,
    aggregateSkills,
    skillsByYear,
    muscleGroups,
    functionalBalance,
    skillBalance,
    energyBalance,
    workCapacity,
    avgComplexity,
    complexityByYear,
    significantPairings,
    trendingUp,
    trendingDown,
    anomalousWorkouts,
    functionNodes,
    functionLinks,
  }
}
