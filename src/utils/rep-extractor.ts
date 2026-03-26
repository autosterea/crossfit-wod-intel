import type { Workout } from '../types'

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface RepScheme {
  pattern: string        // e.g., "21-15-9", "5x5", "5 rounds of 10"
  type: 'descending' | 'fixed' | 'ascending' | 'pyramid' | 'emom' | 'tabata' | 'amrap' | 'other'
  totalReps?: number     // estimated total reps if calculable
}

export interface LoadingPrescription {
  weight: number         // in lbs (convert kg if needed)
  unit: 'lb' | 'kg' | 'pood'
  context: string        // the text around the weight mention
  intensity: 'light' | 'moderate' | 'heavy' | 'very-heavy'
}

export interface WorkoutRepAnalysis {
  repSchemes: RepScheme[]
  loading: LoadingPrescription[]
  estimatedTotalReps: number
  intensityZone: 'strength' | 'power' | 'hypertrophy' | 'endurance' | 'metabolic' | 'mixed'
}

export interface RepLoadingAnalysis {
  // Rep scheme distribution
  schemeTypes: Record<string, number>
  topSchemes: { pattern: string; count: number }[]
  avgTotalReps: number

  // Loading distribution
  avgWeight: number
  weightDistribution: { range: string; count: number }[]

  // Intensity zones
  intensityZones: Record<string, number>

  // Trends
  repsByYear: { year: string; avgReps: number; avgWeight: number }[]
}

// ── Weight intensity classification ─────────────────────────────────────────

function classifyWeightIntensity(lbs: number): LoadingPrescription['intensity'] {
  if (lbs <= 65) return 'light'
  if (lbs <= 135) return 'moderate'
  if (lbs <= 225) return 'heavy'
  return 'very-heavy'
}

// ── Weight range bucket ─────────────────────────────────────────────────────

function weightRangeBucket(lbs: number): string {
  if (lbs === 0) return 'Bodyweight'
  if (lbs < 95) return '<95 lbs'
  if (lbs <= 135) return '95-135 lbs'
  if (lbs <= 185) return '135-185 lbs'
  if (lbs <= 225) return '185-225 lbs'
  return '225+ lbs'
}

// ── Rep Scheme Extraction ───────────────────────────────────────────────────

function extractRepSchemes(text: string): RepScheme[] {
  const schemes: RepScheme[] = []
  const lower = text.toLowerCase()
  const seen = new Set<string>()

  // Tabata
  if (/\btabata\b/i.test(text)) {
    if (!seen.has('Tabata')) {
      seen.add('Tabata')
      schemes.push({ pattern: 'Tabata', type: 'tabata', totalReps: 160 }) // typical 8x20s
    }
  }

  // AMRAP X (minutes)
  const amrapMatch = lower.match(/amrap\s+(\d+)/i)
  if (amrapMatch) {
    const mins = parseInt(amrapMatch[1])
    const pattern = `AMRAP ${mins}`
    if (!seen.has(pattern)) {
      seen.add(pattern)
      schemes.push({ pattern, type: 'amrap' })
    }
  } else if (/\bamrap\b/i.test(text) && !seen.has('AMRAP')) {
    seen.add('AMRAP')
    schemes.push({ pattern: 'AMRAP', type: 'amrap' })
  }

  // EMOM X (minutes)
  const emomMatch = lower.match(/emom\s+(\d+)/i)
  if (emomMatch) {
    const mins = parseInt(emomMatch[1])
    const pattern = `EMOM ${mins}`
    if (!seen.has(pattern)) {
      seen.add(pattern)
      schemes.push({ pattern, type: 'emom' })
    }
  } else if (/\be\.?m\.?o\.?m\.?\b/i.test(text) && !seen.has('EMOM')) {
    seen.add('EMOM')
    schemes.push({ pattern: 'EMOM', type: 'emom' })
  }

  // Descending/ascending/fixed dash patterns: X-X-X (like 21-15-9, 1-2-3-4-5, 3-3-3-3-3)
  const dashPatterns = text.match(/\b(\d{1,3}(?:-\d{1,3}){2,})\b/g)
  if (dashPatterns) {
    for (const dp of dashPatterns) {
      if (seen.has(dp)) continue
      seen.add(dp)
      const nums = dp.split('-').map(Number)
      const total = nums.reduce((a, b) => a + b, 0)

      let type: RepScheme['type'] = 'other'
      const allSame = nums.every((n) => n === nums[0])
      if (allSame) {
        type = 'fixed'
      } else {
        // Check if strictly descending
        let desc = true
        let asc = true
        for (let i = 1; i < nums.length; i++) {
          if (nums[i] >= nums[i - 1]) desc = false
          if (nums[i] <= nums[i - 1]) asc = false
        }
        if (desc) type = 'descending'
        else if (asc) type = 'ascending'
        else {
          // Check pyramid: ascending then descending or vice versa
          const mid = Math.floor(nums.length / 2)
          const firstHalf = nums.slice(0, mid + 1)
          const secondHalf = nums.slice(mid)
          const firstAsc = firstHalf.every((n, i) => i === 0 || n >= firstHalf[i - 1])
          const secondDesc = secondHalf.every((n, i) => i === 0 || n <= secondHalf[i - 1])
          const firstDesc = firstHalf.every((n, i) => i === 0 || n <= firstHalf[i - 1])
          const secondAsc = secondHalf.every((n, i) => i === 0 || n >= secondHalf[i - 1])
          if ((firstAsc && secondDesc) || (firstDesc && secondAsc)) type = 'pyramid'
        }
      }

      schemes.push({ pattern: dp, type, totalReps: total })
    }
  }

  // Sets x Reps patterns: 5x5, 3 x 10, 5X3, etc.
  const setsRepsMatches = text.match(/\b(\d{1,2})\s*[xX]\s*(\d{1,3})\b/g)
  if (setsRepsMatches) {
    for (const sr of setsRepsMatches) {
      const m = sr.match(/(\d{1,2})\s*[xX]\s*(\d{1,3})/)
      if (m) {
        const sets = parseInt(m[1])
        const reps = parseInt(m[2])
        const pattern = `${sets}x${reps}`
        if (!seen.has(pattern)) {
          seen.add(pattern)
          schemes.push({ pattern, type: 'fixed', totalReps: sets * reps })
        }
      }
    }
  }

  // X rounds of Y reps / X rounds for time of Y reps
  const roundsOf = lower.match(/(\d+)\s+rounds?\s+(?:of\s+|for\s+time\s+(?:of\s+)?)(\d+)/g)
  if (roundsOf) {
    for (const ro of roundsOf) {
      const m = ro.match(/(\d+)\s+rounds?\s+(?:of\s+|for\s+time\s+(?:of\s+)?)(\d+)/)
      if (m) {
        const rounds = parseInt(m[1])
        const reps = parseInt(m[2])
        const pattern = `${rounds} rounds of ${reps}`
        if (!seen.has(pattern)) {
          seen.add(pattern)
          schemes.push({ pattern, type: 'fixed', totalReps: rounds * reps })
        }
      }
    }
  }

  // "X rounds" without "of" — just round count
  if (schemes.length === 0) {
    const roundsMatch = lower.match(/(\d+)\s+rounds?\b/)
    if (roundsMatch) {
      const rounds = parseInt(roundsMatch[1])
      const pattern = `${rounds} rounds`
      if (!seen.has(pattern)) {
        seen.add(pattern)
        schemes.push({ pattern, type: 'fixed' })
      }
    }
  }

  // Individual rep counts before movements: "15 pull-ups", "21 thrusters"
  // Sum them up to estimate total if we don't already have totalReps from a structure
  const repBeforeMovement = text.match(/\b(\d{1,3})\s+(?:[a-zA-Z][\w-]*(?:\s+[\w-]+){0,3})/g)
  if (repBeforeMovement && schemes.length === 0) {
    let totalFromIndividual = 0
    for (const rm of repBeforeMovement) {
      const m = rm.match(/^(\d{1,3})/)
      if (m) {
        const n = parseInt(m[1])
        if (n >= 1 && n <= 200) totalFromIndividual += n
      }
    }
    if (totalFromIndividual > 0 && schemes.every((s) => !s.totalReps)) {
      // Don't add as a scheme, but store the total for later
      schemes.push({ pattern: 'individual reps', type: 'other', totalReps: totalFromIndividual })
    }
  }

  return schemes
}

// ── Loading Prescription Extraction ─────────────────────────────────────────

function extractLoading(text: string): LoadingPrescription[] {
  const loads: LoadingPrescription[] = []
  const seen = new Set<number>()

  // Helper to get surrounding context
  function getContext(fullText: string, matchStart: number, matchEnd: number): string {
    const start = Math.max(0, matchStart - 20)
    const end = Math.min(fullText.length, matchEnd + 20)
    return fullText.substring(start, end).trim()
  }

  // XXX lb / lbs / -lb
  const lbMatches = [...text.matchAll(/\b(\d{2,3})\s*(?:-?\s*lbs?)\b/gi)]
  for (const m of lbMatches) {
    const w = parseInt(m[1])
    if (w > 0 && w <= 600 && !seen.has(w)) {
      seen.add(w)
      loads.push({
        weight: w,
        unit: 'lb',
        context: getContext(text, m.index!, m.index! + m[0].length),
        intensity: classifyWeightIntensity(w),
      })
    }
  }

  // XXX# (pounds)
  const hashMatches = [...text.matchAll(/\b(\d{2,3})#/g)]
  for (const m of hashMatches) {
    const w = parseInt(m[1])
    if (w > 0 && w <= 600 && !seen.has(w)) {
      seen.add(w)
      loads.push({
        weight: w,
        unit: 'lb',
        context: getContext(text, m.index!, m.index! + m[0].length),
        intensity: classifyWeightIntensity(w),
      })
    }
  }

  // XXX/YYY (men/women weights like 135/95) — take the first (men's)
  const slashMatches = [...text.matchAll(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/g)]
  for (const m of slashMatches) {
    const w1 = parseInt(m[1])
    const w2 = parseInt(m[2])
    // Heuristic: larger number should be > smaller, both in valid weight range
    if (w1 > w2 && w1 <= 600 && w2 > 0) {
      if (!seen.has(w1)) {
        seen.add(w1)
        loads.push({
          weight: w1,
          unit: 'lb',
          context: getContext(text, m.index!, m.index! + m[0].length),
          intensity: classifyWeightIntensity(w1),
        })
      }
    }
  }

  // XXX kg
  const kgMatches = [...text.matchAll(/\b(\d{1,3})\s*kg\b/gi)]
  for (const m of kgMatches) {
    const kg = parseInt(m[1])
    const lbs = Math.round(kg * 2.205)
    if (lbs > 0 && lbs <= 600 && !seen.has(lbs)) {
      seen.add(lbs)
      loads.push({
        weight: lbs,
        unit: 'kg',
        context: getContext(text, m.index!, m.index! + m[0].length),
        intensity: classifyWeightIntensity(lbs),
      })
    }
  }

  // X pood (1 pood = 36 lbs, 1.5 pood = 54 lbs, 2 pood = 72 lbs)
  const poodMatches = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:-?\s*pood)\b/gi)]
  for (const m of poodMatches) {
    const poods = parseFloat(m[1])
    const lbs = Math.round(poods * 36)
    if (lbs > 0 && lbs <= 600 && !seen.has(lbs)) {
      seen.add(lbs)
      loads.push({
        weight: lbs,
        unit: 'pood',
        context: getContext(text, m.index!, m.index! + m[0].length),
        intensity: classifyWeightIntensity(lbs),
      })
    }
  }

  // bodyweight / BW — record as 0 lbs
  if (/\b(?:body\s*weight|bw)\b/i.test(text) && !seen.has(0)) {
    seen.add(0)
    loads.push({
      weight: 0,
      unit: 'lb',
      context: 'bodyweight',
      intensity: 'light',
    })
  }

  return loads
}

// ── Intensity Zone Classification ───────────────────────────────────────────

function classifyIntensityZone(
  schemes: RepScheme[],
  loading: LoadingPrescription[],
  text: string,
): WorkoutRepAnalysis['intensityZone'] {
  const lower = text.toLowerCase()

  // Determine average reps per set
  let avgRepsPerSet: number | undefined
  const totalReps = schemes.reduce((sum, s) => sum + (s.totalReps || 0), 0)

  if (schemes.length > 0) {
    // Use the first scheme with totalReps
    const primary = schemes.find((s) => s.totalReps)
    if (primary) {
      // Estimate sets from the pattern
      if (primary.type === 'fixed' && primary.pattern.includes('x')) {
        const parts = primary.pattern.split('x')
        avgRepsPerSet = parseInt(parts[1])
      } else if (primary.type === 'descending' || primary.type === 'ascending') {
        const nums = primary.pattern.split('-').map(Number)
        avgRepsPerSet = nums.reduce((a, b) => a + b, 0) / nums.length
      } else {
        avgRepsPerSet = primary.totalReps
      }
    }
  }

  // Check for AMRAP / For Time with high volume
  const isAmrap = schemes.some((s) => s.type === 'amrap')
  const isEmom = schemes.some((s) => s.type === 'emom')
  const isTabata = schemes.some((s) => s.type === 'tabata')
  const forTime = /\bfor\s+time\b/i.test(text)

  const hasHeavyLoad = loading.some((l) => l.intensity === 'heavy' || l.intensity === 'very-heavy')
  const maxWeight = loading.reduce((max, l) => Math.max(max, l.weight), 0)

  // Explosive / Olympic lifting keywords
  const powerKeywords = /\b(?:snatch|clean|jerk|power clean|power snatch|squat clean|squat snatch|hang clean|hang snatch)\b/i
  const hasPowerMovements = powerKeywords.test(text)

  // Strength: low reps (1-5), heavy loads, strength-focused
  if (avgRepsPerSet !== undefined && avgRepsPerSet <= 5 && hasHeavyLoad) {
    if (hasPowerMovements) return 'power'
    return 'strength'
  }

  // Pure strength patterns
  if (/\b(?:1\s*rm|1\s*rep\s*max|heavy\s+single|max\s+(?:effort|load))\b/i.test(text)) {
    return 'strength'
  }

  // Strength schemes: 5x5, 3x3, 5-5-5, 3-3-3, 1-1-1
  if (avgRepsPerSet !== undefined && avgRepsPerSet <= 5 && !isAmrap && !isTabata) {
    if (hasPowerMovements) return 'power'
    if (hasHeavyLoad || maxWeight >= 135) return 'strength'
  }

  // Metabolic conditioning: AMRAP, Tabata, or high rep for time
  if (isTabata) return 'metabolic'
  if (totalReps >= 60 && (isAmrap || forTime)) return 'metabolic'
  if (isAmrap && !hasHeavyLoad) return 'metabolic'

  // Endurance: 12-20+ reps per set
  if (avgRepsPerSet !== undefined && avgRepsPerSet >= 12 && avgRepsPerSet <= 20) return 'endurance'

  // Hypertrophy: 6-12 reps per set
  if (avgRepsPerSet !== undefined && avgRepsPerSet >= 6 && avgRepsPerSet < 12) return 'hypertrophy'

  // High total reps = metabolic
  if (totalReps >= 100) return 'metabolic'
  if (totalReps >= 45) return 'endurance'

  // EMOM can be various
  if (isEmom) {
    if (hasHeavyLoad || (avgRepsPerSet !== undefined && avgRepsPerSet <= 5)) return 'strength'
    return 'mixed'
  }

  // Long workouts tend to be metabolic
  if (/\b(?:chipper|for time)\b/i.test(text) && lower.length > 200) return 'metabolic'

  // Default
  if (hasHeavyLoad) return 'strength'
  if (forTime) return 'metabolic'
  return 'mixed'
}

// ── Main single-workout analyzer ────────────────────────────────────────────

export function analyzeWorkoutReps(description: string): WorkoutRepAnalysis {
  const repSchemes = extractRepSchemes(description)
  const loading = extractLoading(description)

  // Estimate total reps
  let estimatedTotalReps = 0
  for (const s of repSchemes) {
    if (s.totalReps) estimatedTotalReps += s.totalReps
  }

  // If we have rounds info and individual rep counts, multiply
  const roundsMatch = description.match(/(\d+)\s+rounds?/i)
  if (roundsMatch && repSchemes.length > 0) {
    const rounds = parseInt(roundsMatch[1])
    // If we have individual reps but no structural total, apply round multiplier
    const individualScheme = repSchemes.find((s) => s.pattern === 'individual reps')
    if (individualScheme && individualScheme.totalReps) {
      estimatedTotalReps = Math.max(estimatedTotalReps, individualScheme.totalReps * rounds)
    }
  }

  const intensityZone = classifyIntensityZone(repSchemes, loading, description)

  return {
    repSchemes: repSchemes.filter((s) => s.pattern !== 'individual reps'),
    loading,
    estimatedTotalReps,
    intensityZone,
  }
}

// ── Aggregate analyzer for all workouts ─────────────────────────────────────

export function analyzeAllRepsAndLoading(workouts: { d: string; s: string }[]): RepLoadingAnalysis {
  const schemeTypeCounts: Record<string, number> = {}
  const patternCounts: Record<string, number> = {}
  const intensityZones: Record<string, number> = {}
  const weightBuckets: Record<string, number> = {
    'Bodyweight': 0,
    '<95 lbs': 0,
    '95-135 lbs': 0,
    '135-185 lbs': 0,
    '185-225 lbs': 0,
    '225+ lbs': 0,
  }

  let totalRepsSum = 0
  let workoutsWithReps = 0
  let totalWeightSum = 0
  let workoutsWithWeight = 0

  // Year-level aggregation
  const yearAgg: Record<string, { repsSum: number; repsCount: number; weightSum: number; weightCount: number }> = {}

  for (const workout of workouts) {
    const analysis = analyzeWorkoutReps(workout.s || '')
    const year = workout.d?.substring(0, 4) || 'unknown'

    // Init year bucket
    if (!yearAgg[year]) {
      yearAgg[year] = { repsSum: 0, repsCount: 0, weightSum: 0, weightCount: 0 }
    }

    // Scheme types
    for (const scheme of analysis.repSchemes) {
      schemeTypeCounts[scheme.type] = (schemeTypeCounts[scheme.type] || 0) + 1
      patternCounts[scheme.pattern] = (patternCounts[scheme.pattern] || 0) + 1
    }

    // Total reps
    if (analysis.estimatedTotalReps > 0) {
      totalRepsSum += analysis.estimatedTotalReps
      workoutsWithReps++
      yearAgg[year].repsSum += analysis.estimatedTotalReps
      yearAgg[year].repsCount++
    }

    // Loading
    let workoutHasWeight = false
    for (const load of analysis.loading) {
      const bucket = weightRangeBucket(load.weight)
      weightBuckets[bucket] = (weightBuckets[bucket] || 0) + 1
      if (load.weight > 0) {
        totalWeightSum += load.weight
        workoutHasWeight = true
        yearAgg[year].weightSum += load.weight
        yearAgg[year].weightCount++
      } else {
        // bodyweight
        weightBuckets['Bodyweight']++
      }
    }
    if (workoutHasWeight) workoutsWithWeight++

    // Intensity zones
    intensityZones[analysis.intensityZone] = (intensityZones[analysis.intensityZone] || 0) + 1
  }

  // Top schemes
  const topSchemes = Object.entries(patternCounts)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Weight distribution
  const weightDistribution = [
    'Bodyweight', '<95 lbs', '95-135 lbs', '135-185 lbs', '185-225 lbs', '225+ lbs',
  ].map((range) => ({ range, count: weightBuckets[range] || 0 }))

  // Trends by year
  const repsByYear = Object.entries(yearAgg)
    .filter(([year]) => year !== 'unknown')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, agg]) => ({
      year,
      avgReps: agg.repsCount > 0 ? Math.round(agg.repsSum / agg.repsCount) : 0,
      avgWeight: agg.weightCount > 0 ? Math.round(agg.weightSum / agg.weightCount) : 0,
    }))

  return {
    schemeTypes: schemeTypeCounts,
    topSchemes,
    avgTotalReps: workoutsWithReps > 0 ? Math.round(totalRepsSum / workoutsWithReps) : 0,
    avgWeight: workoutsWithWeight > 0 ? Math.round(totalWeightSum / workoutsWithWeight) : 0,
    weightDistribution,
    intensityZones,
    repsByYear,
  }
}
