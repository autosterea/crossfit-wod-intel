/**
 * Advanced Statistical Analysis for CrossFit WOD Intelligence
 *
 * This module provides PhD-level statistical analysis functions applied to
 * CrossFit workout programming data. Each function includes detailed comments
 * explaining the mathematical concepts for non-technical readers.
 *
 * Key concepts used:
 * - Information theory (Shannon Entropy)
 * - Market concentration economics (HHI)
 * - Pareto distribution analysis
 * - Stochastic processes (Markov chains)
 * - Time-series analysis (autocorrelation)
 * - Graph/network theory (PageRank, betweenness centrality)
 */

import type { CrossFitData, Workout } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface EntropyResult {
  /** The Shannon entropy value. Higher = more varied/random movement selection. */
  entropy: number
  /** The maximum possible entropy if all movements were used equally. */
  maxEntropy: number
  /** A 0-100 percentage: how close the programming is to maximum variety. */
  varianceScore: number
}

export interface HHIResult {
  /**
   * The Herfindahl-Hirschman Index value.
   * Ranges from 1/N (perfectly distributed) to 1.0 (one movement dominates).
   */
  hhi: number
  /**
   * Normalized HHI on a 0-1 scale, where 0 = perfectly distributed
   * and 1 = completely concentrated in one movement.
   */
  normalizedHHI: number
  /** Plain-English interpretation of the concentration level. */
  interpretation: string
}

export interface ParetoEntry {
  movement: string
  count: number
  /** This movement's share of total programming as a percentage. */
  pct: number
  /** Running total percentage when movements are sorted most-to-least frequent. */
  cumPct: number
}

export interface HopperReadinessResult {
  /**
   * Score from 0 to 1. Represents how many modality x time-domain combinations
   * have been observed. 1.0 = every combination has been programmed at least once.
   */
  score: number
  filledCells: number
  totalCells: number
  /** The full cross-tabulation matrix for visualization. */
  matrix: { modality: string; timeDomain: string; count: number }[]
  /** Combinations that have never appeared -- programming blind spots. */
  gaps: { modality: string; timeDomain: string }[]
}

export interface CombinationCoverageResult {
  /** How many unique movement pairs have actually appeared together in a workout. */
  observedPairs: number
  /** Total number of possible pairs given all movements in the dataset. */
  possiblePairs: number
  /** Ratio of observed to possible (0 to 1). */
  coverageScore: number
  /** Movement pairs that have never co-occurred (capped for performance). */
  unseenPairs: [string, string][]
}

export interface AutocorrelationLag {
  lag: number
  correlation: number
  /** True if the correlation at this lag is statistically significant. */
  significant: boolean
}

export interface AutocorrelationResult {
  lags: AutocorrelationLag[]
  /** True if there is any detectable periodic pattern in the programming. */
  hasPeriodicity: boolean
  /** The dominant repeating period in days (e.g. 7 = weekly pattern), or null. */
  dominantPeriod: number | null
}

export interface RestDayAnalysisResult {
  /** Average number of movements in the workout immediately before a rest day. */
  avgMovementsBeforeRest: number
  /** Average number of movements in the workout immediately after a rest day. */
  avgMovementsAfterRest: number
  /** Which modalities tend to appear right before rest days. */
  modalityBeforeRest: Record<string, number>
  /** Which modalities tend to appear right after rest days. */
  modalityAfterRest: Record<string, number>
  /**
   * True if rest days strategically follow higher-complexity or heavier days
   * more often than chance would predict.
   */
  isStrategic: boolean
}

export interface MarkovTransitionResult {
  /** The unique modality states observed. */
  states: string[]
  /**
   * Transition probability matrix. matrix[i][j] = probability of transitioning
   * from state i to state j. Rows sum to 1.
   */
  matrix: number[][]
  /**
   * The long-run equilibrium distribution: if programming continues with the
   * same patterns, this is the proportion of time spent in each modality.
   */
  steadyState: Record<string, number>
}

export interface NetworkCentralityResult {
  /**
   * PageRank scores: measures a movement's importance based not just on how
   * often it appears, but on how often it co-occurs with other important movements.
   * Think of it like Google's algorithm but for exercise programming.
   */
  pageRank: { id: string; score: number }[]
  /**
   * Betweenness centrality: how often a movement sits on the shortest path
   * between two other movements. High betweenness = a "bridge" movement that
   * connects different programming styles.
   */
  betweenness: { id: string; score: number }[]
  /**
   * Community detection: groups movements that tend to be programmed together
   * into clusters. Each movement gets a community number.
   */
  communities: { id: string; community: number }[]
  /**
   * Global clustering coefficient: measures how much movements tend to form
   * tight groups. Higher = more cliquish programming.
   */
  clusteringCoefficient: number
}

export interface AdvancedAnalysisResults {
  entropy: EntropyResult
  hhi: HHIResult
  pareto: ParetoEntry[]
  hopperReadiness: HopperReadinessResult
  combinationCoverage: CombinationCoverageResult
  autocorrelation: AutocorrelationResult
  restDayAnalysis: RestDayAnalysisResult
  markovTransitions: MarkovTransitionResult
  networkCentrality: NetworkCentralityResult
  // Aliases for component compatibility
  hopper: HopperReadinessResult
  markov: MarkovTransitionResult
  restDay: RestDayAnalysisResult
  centrality: NetworkCentralityResult
}

// ============================================================================
// Helper utilities
// ============================================================================

/**
 * Count occurrences of each value in an array, returning a frequency map.
 */
function countFrequencies(items: string[]): Record<string, number> {
  const freq: Record<string, number> = {}
  for (const item of items) {
    freq[item] = (freq[item] || 0) + 1
  }
  return freq
}

/**
 * Extract all individual movements from a list of workouts into a flat array.
 */
function extractAllMovements(workouts: Workout[]): string[] {
  const all: string[] = []
  for (const w of workouts) {
    for (const m of w.mv) {
      all.push(m)
    }
  }
  return all
}

/**
 * Filter workouts by year range.
 */
function filterByYearRange(workouts: Workout[], yearRange?: [number, number]): Workout[] {
  if (!yearRange) return workouts
  const [startYear, endYear] = yearRange
  return workouts.filter((w) => {
    const year = parseInt(w.d.substring(0, 4), 10)
    return year >= startYear && year <= endYear
  })
}

// ============================================================================
// 1. Shannon Entropy
// ============================================================================

/**
 * Calculate the Shannon entropy of movement selection across all workouts.
 *
 * **What is Shannon Entropy?**
 * Imagine you're picking movements out of a hat. If every movement is equally
 * likely to be drawn, the selection is maximally "surprising" -- that's high
 * entropy. If you always pull out the same few movements, it's predictable --
 * that's low entropy.
 *
 * **The formula:**
 *   H = -SUM( p(x) * log2(p(x)) )
 * where p(x) is the probability of movement x appearing.
 *
 * - log2 means we measure in "bits" of information.
 * - Maximum entropy = log2(N) where N = number of unique movements.
 * - The "variance score" is entropy / maxEntropy * 100, giving a 0-100% rating.
 *
 * A score of 100% would mean every single movement appears exactly the same
 * number of times -- perfectly varied programming.
 */
export function calculateMovementEntropy(workouts: Workout[]): EntropyResult {
  // Collect all movement appearances across all workouts
  const allMovements = extractAllMovements(workouts)
  if (allMovements.length === 0) {
    return { entropy: 0, maxEntropy: 0, varianceScore: 0 }
  }

  const freq = countFrequencies(allMovements)
  const total = allMovements.length
  const uniqueCount = Object.keys(freq).length

  if (uniqueCount <= 1) {
    return { entropy: 0, maxEntropy: 0, varianceScore: 0 }
  }

  // Calculate Shannon entropy: H = -SUM( p(x) * log2(p(x)) )
  // For each movement, compute its probability, then its contribution to entropy.
  let entropy = 0
  for (const count of Object.values(freq)) {
    const p = count / total // probability of this movement
    if (p > 0) {
      entropy -= p * Math.log2(p) // negative because log2(p) is negative for p < 1
    }
  }

  // Maximum possible entropy occurs when all N movements are equally likely
  const maxEntropy = Math.log2(uniqueCount)

  // Variance score: what percentage of maximum entropy is actually achieved?
  const varianceScore = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0

  return {
    entropy: +entropy.toFixed(4),
    maxEntropy: +maxEntropy.toFixed(4),
    varianceScore: +varianceScore.toFixed(1),
  }
}

// ============================================================================
// 2. Herfindahl-Hirschman Index (HHI)
// ============================================================================

/**
 * Calculate the Herfindahl-Hirschman Index for movement concentration.
 *
 * **What is HHI?**
 * Originally from economics, HHI measures market concentration. Here we apply
 * it to movement programming: are workouts spread across many movements
 * (like a competitive market) or dominated by a few (like a monopoly)?
 *
 * **The formula:**
 *   HHI = SUM( s_i^2 )
 * where s_i is movement i's "market share" (fraction of total appearances).
 *
 * - If 1 movement has 100% share: HHI = 1.0 (maximum concentration)
 * - If N movements each have 1/N share: HHI = 1/N (minimum concentration)
 *
 * **Normalized HHI** rescales to 0-1:
 *   NHHI = (HHI - 1/N) / (1 - 1/N)
 * where 0 = perfectly distributed, 1 = completely concentrated.
 *
 * **Interpretation thresholds** (adapted from US DOJ antitrust guidelines):
 * - NHHI < 0.15: "Unconcentrated" -- healthy, diverse programming
 * - NHHI 0.15-0.25: "Moderate concentration" -- some movements dominate
 * - NHHI > 0.25: "Highly concentrated" -- programming is repetitive
 */
export function calculateHHI(workouts: Workout[]): HHIResult {
  const allMovements = extractAllMovements(workouts)
  if (allMovements.length === 0) {
    return { hhi: 0, normalizedHHI: 0, interpretation: 'No data' }
  }

  const freq = countFrequencies(allMovements)
  const total = allMovements.length
  const n = Object.keys(freq).length

  if (n <= 1) {
    return { hhi: 1, normalizedHHI: 1, interpretation: 'Completely concentrated in one movement' }
  }

  // Sum the squared market shares
  let hhi = 0
  for (const count of Object.values(freq)) {
    const share = count / total
    hhi += share * share
  }

  // Normalize: shift and scale so that 0 = perfectly even, 1 = one movement only
  const minHHI = 1 / n
  const normalizedHHI = (hhi - minHHI) / (1 - minHHI)

  // Interpret using adapted DOJ thresholds
  let interpretation: string
  if (normalizedHHI < 0.05) {
    interpretation = 'Extremely well-distributed -- elite-level programming variety'
  } else if (normalizedHHI < 0.10) {
    interpretation = 'Well-distributed -- good movement diversity'
  } else if (normalizedHHI < 0.15) {
    interpretation = 'Unconcentrated -- healthy programming diversity'
  } else if (normalizedHHI < 0.25) {
    interpretation = 'Moderately concentrated -- some movements are over-represented'
  } else if (normalizedHHI < 0.40) {
    interpretation = 'Highly concentrated -- programming is repetitive'
  } else {
    interpretation = 'Extremely concentrated -- dominated by a small set of movements'
  }

  return {
    hhi: +hhi.toFixed(6),
    normalizedHHI: +normalizedHHI.toFixed(4),
    interpretation,
  }
}

// ============================================================================
// 3. Pareto Analysis
// ============================================================================

/**
 * Perform a Pareto analysis on movement programming.
 *
 * **What is Pareto Analysis?**
 * Named after the "80/20 rule" -- often 80% of effects come from 20% of causes.
 * Here we ask: what percentage of unique movements account for 80% (or any
 * threshold) of total programming volume?
 *
 * The output is a sorted list of movements from most to least frequent, with
 * each entry showing:
 * - Its individual count and percentage
 * - The cumulative percentage (running total)
 *
 * This allows you to identify the "vital few" movements that dominate
 * programming and the "trivial many" that rarely appear.
 *
 * A steep cumulative curve means a few movements dominate. A gradual curve
 * means programming is evenly spread.
 */
export function paretoAnalysis(workouts: Workout[]): ParetoEntry[] {
  const allMovements = extractAllMovements(workouts)
  if (allMovements.length === 0) return []

  const freq = countFrequencies(allMovements)
  const total = allMovements.length

  // Sort movements from most frequent to least frequent
  const sorted = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)

  // Build the Pareto table with cumulative percentages
  let cumulative = 0
  return sorted.map(([movement, count]) => {
    const pct = (count / total) * 100
    cumulative += pct
    return {
      movement,
      count,
      pct: +pct.toFixed(2),
      cumPct: +cumulative.toFixed(2),
    }
  })
}

// ============================================================================
// 4. Hopper Readiness Score
// ============================================================================

/**
 * Calculate the "Hopper Readiness" score.
 *
 * **What is the Hopper?**
 * CrossFit's theoretical model of fitness involves a "hopper" -- a barrel
 * filled with every possible physical challenge. True fitness means being
 * prepared for whatever the hopper pulls out.
 *
 * **How do we measure readiness?**
 * We create a matrix crossing modality types (Gymnastics, Monostructural,
 * Weightlifting, and their combinations) with time domains (Short, Medium,
 * Long, etc.). Each cell represents a specific type of challenge.
 *
 * The score is simply:
 *   filled cells / total possible cells
 *
 * If the programming has covered every combination of modality and time domain,
 * the score is 1.0 (100%). Any missing combination is a "gap" -- a type of
 * workout the athlete hasn't been exposed to.
 */
export function hopperReadiness(workouts: Workout[]): HopperReadinessResult {
  if (workouts.length === 0) {
    return { score: 0, filledCells: 0, totalCells: 0, matrix: [], gaps: [] }
  }

  // Collect all unique modalities and time domains from the data
  const modalitySet = new Set<string>()
  const timeDomainSet = new Set<string>()

  for (const w of workouts) {
    if (w.mo) modalitySet.add(w.mo)
    if (w.td) timeDomainSet.add(w.td)
  }

  // Remove "Unknown" or empty values to keep the analysis meaningful
  modalitySet.delete('')
  modalitySet.delete('Unknown')
  timeDomainSet.delete('')
  timeDomainSet.delete('Unknown')

  const modalities = Array.from(modalitySet).sort()
  const timeDomains = Array.from(timeDomainSet).sort()

  // Count occurrences for each modality x time-domain pair
  const countMap: Record<string, number> = {}
  for (const w of workouts) {
    if (w.mo && w.td && w.mo !== 'Unknown' && w.td !== 'Unknown') {
      const key = `${w.mo}||${w.td}`
      countMap[key] = (countMap[key] || 0) + 1
    }
  }

  // Build the full matrix and identify gaps
  const matrix: HopperReadinessResult['matrix'] = []
  const gaps: HopperReadinessResult['gaps'] = []
  let filledCells = 0
  const totalCells = modalities.length * timeDomains.length

  for (const mod of modalities) {
    for (const td of timeDomains) {
      const key = `${mod}||${td}`
      const count = countMap[key] || 0
      matrix.push({ modality: mod, timeDomain: td, count })
      if (count > 0) {
        filledCells++
      } else {
        gaps.push({ modality: mod, timeDomain: td })
      }
    }
  }

  const score = totalCells > 0 ? filledCells / totalCells : 0

  return {
    score: +score.toFixed(4),
    filledCells,
    totalCells,
    matrix,
    gaps,
  }
}

// ============================================================================
// 5. Movement Combination Coverage
// ============================================================================

/**
 * Analyze how many possible movement pairs have actually been observed together.
 *
 * **What does this measure?**
 * If CrossFit uses N unique movements, there are N*(N-1)/2 possible pairs.
 * This function counts how many of those pairs have actually appeared together
 * in at least one workout.
 *
 * High coverage means the programming explores many different movement
 * combinations. Low coverage means workouts tend to use the same combinations
 * repeatedly, leaving many pair-ups unexplored.
 *
 * The "unseen pairs" list highlights combinations that have never been programmed
 * together -- potential opportunities for novel workout design.
 */
export function combinationCoverage(workouts: Workout[]): CombinationCoverageResult {
  if (workouts.length === 0) {
    return { observedPairs: 0, possiblePairs: 0, coverageScore: 0, unseenPairs: [] }
  }

  // Collect all unique movements across all workouts
  const allUniqueMovements = new Set<string>()
  for (const w of workouts) {
    for (const m of w.mv) {
      allUniqueMovements.add(m)
    }
  }

  const movementList = Array.from(allUniqueMovements).sort()
  const n = movementList.length

  if (n < 2) {
    return { observedPairs: 0, possiblePairs: 0, coverageScore: 0, unseenPairs: [] }
  }

  // Track which pairs have been observed
  // Use a Set of "movA||movB" keys (alphabetically ordered) for efficiency
  const observedSet = new Set<string>()

  for (const w of workouts) {
    const moves = [...w.mv].sort()
    // Generate all pairs within this workout
    for (let i = 0; i < moves.length; i++) {
      for (let j = i + 1; j < moves.length; j++) {
        observedSet.add(`${moves[i]}||${moves[j]}`)
      }
    }
  }

  const possiblePairs = (n * (n - 1)) / 2
  const observedPairs = observedSet.size
  const coverageScore = possiblePairs > 0 ? observedPairs / possiblePairs : 0

  // Find unseen pairs (cap at 100 for performance/UI reasons)
  const unseenPairs: [string, string][] = []
  const MAX_UNSEEN = 100
  outerLoop:
  for (let i = 0; i < movementList.length; i++) {
    for (let j = i + 1; j < movementList.length; j++) {
      const key = `${movementList[i]}||${movementList[j]}`
      if (!observedSet.has(key)) {
        unseenPairs.push([movementList[i], movementList[j]])
        if (unseenPairs.length >= MAX_UNSEEN) break outerLoop
      }
    }
  }

  return {
    observedPairs,
    possiblePairs,
    coverageScore: +coverageScore.toFixed(4),
    unseenPairs,
  }
}

// ============================================================================
// 6. Autocorrelation (Periodization Detection)
// ============================================================================

/**
 * Detect periodic patterns in the programming using autocorrelation.
 *
 * **What is autocorrelation?**
 * It measures how similar a signal is to a delayed copy of itself. If workouts
 * at lag-7 (one week apart) are strongly correlated, there's a weekly pattern.
 *
 * **How it works here:**
 * We convert each workout's modality to a numeric code and compute autocorrelation
 * at lags 1 through maxLag. The formula for autocorrelation at lag k is:
 *
 *   r(k) = SUM( (x_t - mean) * (x_{t+k} - mean) ) / SUM( (x_t - mean)^2 )
 *
 * This is the Pearson correlation of the series with itself shifted by k positions.
 *
 * **Significance:**
 * For a random series of length N, autocorrelation is approximately normally
 * distributed with mean 0 and standard deviation 1/sqrt(N). We use the 95%
 * confidence threshold: |r(k)| > 1.96/sqrt(N).
 *
 * **Dominant period:**
 * The lag with the highest significant positive autocorrelation indicates the
 * dominant cycle length. For example, if lag 7 has the strongest correlation,
 * programming repeats on a weekly cycle.
 */
export function autocorrelation(workouts: Workout[], maxLag: number = 30): AutocorrelationResult {
  if (workouts.length < 10) {
    return { lags: [], hasPeriodicity: false, dominantPeriod: null }
  }

  // Sort workouts by date to create a time series
  const sorted = [...workouts].sort((a, b) => a.d.localeCompare(b.d))

  // Convert modality to numeric codes for correlation analysis
  // We assign a unique integer to each modality
  const modalitySet = new Set<string>()
  for (const w of sorted) {
    if (w.mo) modalitySet.add(w.mo)
  }
  const modalityList = Array.from(modalitySet).sort()
  const modalityMap: Record<string, number> = {}
  modalityList.forEach((m, i) => { modalityMap[m] = i + 1 })

  // Build the numeric time series
  const series = sorted.map((w) => modalityMap[w.mo] || 0)
  const n = series.length

  // Calculate mean of the series
  let sum = 0
  for (const v of series) sum += v
  const seriesMean = sum / n

  // Calculate the denominator: variance (sum of squared deviations)
  let denominator = 0
  for (const v of series) {
    denominator += (v - seriesMean) * (v - seriesMean)
  }

  if (denominator === 0) {
    return { lags: [], hasPeriodicity: false, dominantPeriod: null }
  }

  // Significance threshold: 1.96 / sqrt(N) for 95% confidence
  const significanceThreshold = 1.96 / Math.sqrt(n)

  const lags: AutocorrelationLag[] = []
  let bestLag = 0
  let bestCorrelation = 0

  // Compute autocorrelation for each lag from 1 to maxLag
  const effectiveMaxLag = Math.min(maxLag, Math.floor(n / 3))
  for (let lag = 1; lag <= effectiveMaxLag; lag++) {
    let numerator = 0
    for (let t = 0; t < n - lag; t++) {
      numerator += (series[t] - seriesMean) * (series[t + lag] - seriesMean)
    }
    const correlation = numerator / denominator
    const significant = Math.abs(correlation) > significanceThreshold

    lags.push({
      lag,
      correlation: +correlation.toFixed(4),
      significant,
    })

    // Track the best positive significant correlation (indicates periodicity)
    if (significant && correlation > bestCorrelation && lag > 1) {
      bestCorrelation = correlation
      bestLag = lag
    }
  }

  const hasPeriodicity = bestLag > 0
  const dominantPeriod = hasPeriodicity ? bestLag : null

  return { lags, hasPeriodicity, dominantPeriod }
}

// ============================================================================
// 7. Rest Day Intelligence
// ============================================================================

/**
 * Analyze what happens before and after rest days.
 *
 * **What does this reveal?**
 * Smart programming places rest days strategically -- for example, after
 * particularly grueling or complex workouts, or before a planned heavy day.
 *
 * This function examines:
 * 1. The average complexity (number of movements) of workouts immediately
 *    before vs. after rest days.
 * 2. Which modalities tend to precede or follow rest days.
 * 3. Whether rest placement is "strategic" -- meaning rest days follow more
 *    complex/multi-modal workouts at a rate higher than average.
 *
 * **Strategic rest detection:**
 * We compare the average movement count before rest days to the overall
 * average. If pre-rest workouts are significantly more complex (z-score > 1.5),
 * we consider rest placement to be strategic.
 */
export function restDayAnalysis(workouts: Workout[]): RestDayAnalysisResult {
  const emptyResult: RestDayAnalysisResult = {
    avgMovementsBeforeRest: 0,
    avgMovementsAfterRest: 0,
    modalityBeforeRest: {},
    modalityAfterRest: {},
    isStrategic: false,
  }

  if (workouts.length < 3) return emptyResult

  // Sort workouts chronologically
  const sorted = [...workouts].sort((a, b) => a.d.localeCompare(b.d))

  // Build a set of dates that have workouts
  const workoutDates = new Set<string>(sorted.map((w) => w.d))

  // Create a date-to-workout map for quick lookup
  const dateToWorkout: Record<string, Workout> = {}
  for (const w of sorted) {
    dateToWorkout[w.d] = w
  }

  // Find rest days: dates between the first and last workout that have no workout
  // We iterate through the date range to find gaps
  const firstDate = new Date(sorted[0].d)
  const lastDate = new Date(sorted[sorted.length - 1].d)

  const movementsBeforeRest: number[] = []
  const movementsAfterRest: number[] = []
  const modalityBeforeRest: Record<string, number> = {}
  const modalityAfterRest: Record<string, number> = {}

  // Walk through all dates in the range
  const allDates: string[] = []
  const current = new Date(firstDate)
  while (current <= lastDate) {
    allDates.push(current.toISOString().substring(0, 10))
    current.setDate(current.getDate() + 1)
  }

  for (let i = 0; i < allDates.length; i++) {
    const dateStr = allDates[i]
    const isRest = !workoutDates.has(dateStr)

    if (isRest) {
      // Look backward for the most recent workout before this rest day
      for (let j = i - 1; j >= 0; j--) {
        if (workoutDates.has(allDates[j])) {
          const beforeWorkout = dateToWorkout[allDates[j]]
          movementsBeforeRest.push(beforeWorkout.mv.length)
          if (beforeWorkout.mo) {
            modalityBeforeRest[beforeWorkout.mo] = (modalityBeforeRest[beforeWorkout.mo] || 0) + 1
          }
          break
        }
      }

      // Look forward for the first workout after this rest day
      for (let j = i + 1; j < allDates.length; j++) {
        if (workoutDates.has(allDates[j])) {
          const afterWorkout = dateToWorkout[allDates[j]]
          movementsAfterRest.push(afterWorkout.mv.length)
          if (afterWorkout.mo) {
            modalityAfterRest[afterWorkout.mo] = (modalityAfterRest[afterWorkout.mo] || 0) + 1
          }
          break
        }
      }
    }
  }

  if (movementsBeforeRest.length === 0) return emptyResult

  // Compute averages
  const avgBefore = movementsBeforeRest.reduce((a, b) => a + b, 0) / movementsBeforeRest.length
  const avgAfter = movementsAfterRest.length > 0
    ? movementsAfterRest.reduce((a, b) => a + b, 0) / movementsAfterRest.length
    : 0

  // Compare to overall average to determine if rest placement is strategic
  const allMovementCounts = sorted.map((w) => w.mv.length)
  const overallMean = allMovementCounts.reduce((a, b) => a + b, 0) / allMovementCounts.length
  const n = allMovementCounts.length
  const overallVariance = allMovementCounts.reduce((s, v) => s + (v - overallMean) ** 2, 0) / (n - 1)
  const overallStdDev = Math.sqrt(overallVariance)

  // z-test: is the average before rest significantly higher than overall?
  // Using the standard error of the mean for the sample of pre-rest workouts
  const se = overallStdDev / Math.sqrt(movementsBeforeRest.length)
  const zValue = se > 0 ? (avgBefore - overallMean) / se : 0
  const isStrategic = zValue > 1.5 // pre-rest workouts are notably more complex

  return {
    avgMovementsBeforeRest: +avgBefore.toFixed(2),
    avgMovementsAfterRest: +avgAfter.toFixed(2),
    modalityBeforeRest,
    modalityAfterRest,
    isStrategic,
  }
}

// ============================================================================
// 8. Markov Transition Matrix
// ============================================================================

/**
 * Build a Markov transition matrix for modality sequences.
 *
 * **What is a Markov chain?**
 * It models sequences where the next state depends only on the current state,
 * not the full history. Here, the "states" are workout modalities (e.g.,
 * Gymnastics, Weightlifting, Monostructural, and their combinations).
 *
 * **Transition probability:**
 *   P(next = j | current = i) = count(i -> j) / count(all transitions from i)
 *
 * Example: if after a Gymnastics day, 40% of the time the next day is
 * Weightlifting, then P(W | G) = 0.40.
 *
 * **Steady-state distribution:**
 * If you run the chain forward infinitely, the fraction of time spent in each
 * state converges to the "steady state." We compute this by iterating the
 * transition matrix until it stabilizes (power iteration method).
 *
 * This reveals the programming's long-run tendencies and whether certain
 * modality sequences are preferred or avoided.
 */
export function markovTransitions(workouts: Workout[]): MarkovTransitionResult {
  const emptyResult: MarkovTransitionResult = {
    states: [],
    matrix: [],
    steadyState: {},
  }

  if (workouts.length < 2) return emptyResult

  // Sort workouts chronologically
  const sorted = [...workouts].sort((a, b) => a.d.localeCompare(b.d))

  // Identify all unique modality states
  const stateSet = new Set<string>()
  for (const w of sorted) {
    if (w.mo && w.mo !== 'Unknown') stateSet.add(w.mo)
  }
  const states = Array.from(stateSet).sort()
  const n = states.length

  if (n === 0) return emptyResult

  const stateIndex: Record<string, number> = {}
  states.forEach((s, i) => { stateIndex[s] = i })

  // Count transitions: how many times state i is followed by state j
  const transitionCounts: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i].mo
    const to = sorted[i + 1].mo
    if (from && to && from !== 'Unknown' && to !== 'Unknown' &&
        stateIndex[from] !== undefined && stateIndex[to] !== undefined) {
      transitionCounts[stateIndex[from]][stateIndex[to]]++
    }
  }

  // Convert counts to probabilities (each row sums to 1)
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    const rowSum = transitionCounts[i].reduce((a, b) => a + b, 0)
    if (rowSum > 0) {
      for (let j = 0; j < n; j++) {
        matrix[i][j] = +(transitionCounts[i][j] / rowSum).toFixed(4)
      }
    } else {
      // If a state has no outgoing transitions, assume uniform distribution
      for (let j = 0; j < n; j++) {
        matrix[i][j] = +(1 / n).toFixed(4)
      }
    }
  }

  // Compute steady-state distribution via power iteration
  // Start with uniform distribution and repeatedly multiply by the transition matrix
  let distribution = new Array(n).fill(1 / n)

  for (let iter = 0; iter < 200; iter++) {
    const next = new Array(n).fill(0)
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        next[j] += distribution[i] * matrix[i][j]
      }
    }

    // Check convergence: has the distribution stabilized?
    let maxDiff = 0
    for (let i = 0; i < n; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(next[i] - distribution[i]))
    }
    distribution = next

    if (maxDiff < 1e-8) break
  }

  // Build the steady-state record
  const steadyState: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    steadyState[states[i]] = +distribution[i].toFixed(4)
  }

  return { states, matrix, steadyState }
}

// ============================================================================
// 9. Network Centrality (PageRank, Betweenness, Community Detection)
// ============================================================================

/**
 * Compute network centrality metrics for the movement co-occurrence graph.
 *
 * **What is network centrality?**
 * Movements that appear together in workouts form a network (graph). Each
 * movement is a "node," and each co-occurrence is an "edge." Centrality
 * metrics reveal which movements are most important in the network.
 *
 * **PageRank:**
 * Google's famous algorithm, applied to movements. A movement has high PageRank
 * if it co-occurs frequently with OTHER high-PageRank movements. It's not just
 * about being common -- it's about being connected to important movements.
 *
 * Formula (iterative):
 *   PR(v) = (1-d)/N + d * SUM( PR(u) / outDegree(u) ) for all u linking to v
 * where d = 0.85 (damping factor) and N = number of nodes.
 *
 * **Betweenness Centrality:**
 * How often a movement lies on the shortest path between two other movements.
 * High betweenness = a "bridge" that connects otherwise separate movement
 * clusters. Removing it would fragment the network.
 *
 * **Community Detection (Label Propagation):**
 * Identifies clusters of movements that tend to be programmed together. Uses
 * a simple label propagation algorithm: each node adopts the most common label
 * among its neighbors, iterating until stable.
 *
 * **Clustering Coefficient:**
 * For each node, what fraction of its neighbors are also neighbors of each
 * other? Averaged across all nodes, this measures how "cliquish" the network is.
 */
export function networkCentrality(
  nodes: { id: string; count: number }[],
  links: { source: string; target: string; value: number }[],
): NetworkCentralityResult {
  const emptyResult: NetworkCentralityResult = {
    pageRank: [],
    betweenness: [],
    communities: [],
    clusteringCoefficient: 0,
  }

  if (nodes.length === 0) return emptyResult

  const n = nodes.length
  const idToIndex: Record<string, number> = {}
  nodes.forEach((node, i) => { idToIndex[node.id] = i })

  // Build adjacency list and weighted adjacency matrix
  const adjacency: Set<number>[] = Array.from({ length: n }, () => new Set<number>())
  const weights: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (const link of links) {
    const si = idToIndex[link.source]
    const ti = idToIndex[link.target]
    if (si !== undefined && ti !== undefined && si !== ti) {
      adjacency[si].add(ti)
      adjacency[ti].add(si)
      weights[si][ti] += link.value
      weights[ti][si] += link.value
    }
  }

  // --- PageRank ---
  // Iterative computation with damping factor d = 0.85
  const d = 0.85
  let pr = new Array(n).fill(1 / n)

  for (let iter = 0; iter < 100; iter++) {
    const newPr = new Array(n).fill((1 - d) / n)

    for (let i = 0; i < n; i++) {
      const outDegree = adjacency[i].size
      if (outDegree === 0) {
        // Dangling node: distribute its rank equally to all nodes
        const share = d * pr[i] / n
        for (let j = 0; j < n; j++) {
          newPr[j] += share
        }
      } else {
        const share = d * pr[i] / outDegree
        for (const neighbor of adjacency[i]) {
          newPr[neighbor] += share
        }
      }
    }

    // Check convergence
    let maxDiff = 0
    for (let i = 0; i < n; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(newPr[i] - pr[i]))
    }
    pr = newPr
    if (maxDiff < 1e-8) break
  }

  const pageRank = nodes.map((node, i) => ({
    id: node.id,
    score: +pr[i].toFixed(6),
  })).sort((a, b) => b.score - a.score)

  // --- Betweenness Centrality ---
  // Uses Brandes' algorithm (BFS-based for unweighted shortest paths).
  // For each node s, we find all shortest paths and accumulate dependency scores.
  const betweennessScores = new Array(n).fill(0)

  for (let s = 0; s < n; s++) {
    // BFS from source s
    const stack: number[] = []
    const predecessors: number[][] = Array.from({ length: n }, () => [])
    const sigma = new Array(n).fill(0) // number of shortest paths
    const dist = new Array(n).fill(-1)
    const delta = new Array(n).fill(0)

    sigma[s] = 1
    dist[s] = 0
    const queue: number[] = [s]

    while (queue.length > 0) {
      const v = queue.shift()!
      stack.push(v)

      for (const w of adjacency[v]) {
        // First time discovering w?
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1
          queue.push(w)
        }
        // Is this a shortest path to w via v?
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v]
          predecessors[w].push(v)
        }
      }
    }

    // Back-propagation of dependencies
    while (stack.length > 0) {
      const w = stack.pop()!
      for (const v of predecessors[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
      }
      if (w !== s) {
        betweennessScores[w] += delta[w]
      }
    }
  }

  // Normalize betweenness by (n-1)(n-2)/2 for undirected graph
  const normFactor = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1
  const betweenness = nodes.map((node, i) => ({
    id: node.id,
    score: +(betweennessScores[i] / normFactor).toFixed(6),
  })).sort((a, b) => b.score - a.score)

  // --- Community Detection (Label Propagation) ---
  // Each node starts with its own label (community). In each iteration,
  // each node adopts the most common label among its neighbors (weighted
  // by edge weights). This converges to natural communities.
  const labels = Array.from({ length: n }, (_, i) => i)

  for (let iter = 0; iter < 50; iter++) {
    let changed = false
    // Process nodes in random-ish order (by degree descending for stability)
    const order = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => adjacency[b].size - adjacency[a].size)

    for (const i of order) {
      if (adjacency[i].size === 0) continue

      // Count weighted votes for each label among neighbors
      const labelVotes: Record<number, number> = {}
      for (const neighbor of adjacency[i]) {
        const label = labels[neighbor]
        const weight = weights[i][neighbor] || 1
        labelVotes[label] = (labelVotes[label] || 0) + weight
      }

      // Find the label with the most votes
      let bestLabel = labels[i]
      let bestVotes = 0
      for (const [label, votes] of Object.entries(labelVotes)) {
        if (votes > bestVotes) {
          bestVotes = votes
          bestLabel = parseInt(label, 10)
        }
      }

      if (labels[i] !== bestLabel) {
        labels[i] = bestLabel
        changed = true
      }
    }

    if (!changed) break
  }

  // Remap labels to consecutive community numbers (0, 1, 2, ...)
  const labelRemap: Record<number, number> = {}
  let nextCommunity = 0
  for (const label of labels) {
    if (labelRemap[label] === undefined) {
      labelRemap[label] = nextCommunity++
    }
  }

  const communities = nodes.map((node, i) => ({
    id: node.id,
    community: labelRemap[labels[i]],
  }))

  // --- Global Clustering Coefficient ---
  // For each node, the clustering coefficient is:
  //   C(v) = (2 * triangles_v) / (degree_v * (degree_v - 1))
  // The global value is the average across all nodes with degree >= 2.
  let totalCC = 0
  let countCC = 0

  for (let v = 0; v < n; v++) {
    const neighbors = Array.from(adjacency[v])
    const deg = neighbors.length
    if (deg < 2) continue

    // Count how many pairs of v's neighbors are also connected to each other
    let triangles = 0
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (adjacency[neighbors[i]].has(neighbors[j])) {
          triangles++
        }
      }
    }

    const possibleTriangles = (deg * (deg - 1)) / 2
    totalCC += triangles / possibleTriangles
    countCC++
  }

  const clusteringCoefficient = countCC > 0 ? +(totalCC / countCC).toFixed(4) : 0

  return {
    pageRank,
    betweenness,
    communities,
    clusteringCoefficient,
  }
}

// ============================================================================
// 10. Aggregate Analysis Runner
// ============================================================================

/**
 * Run all advanced statistical analyses on the full CrossFit dataset.
 *
 * This is the main entry point that orchestrates all individual analysis
 * functions and returns a single comprehensive results object.
 *
 * @param data - The full CrossFitData object containing searchIndex, network, etc.
 * @param yearRange - Optional [startYear, endYear] filter. If provided, only
 *   workouts within that year range (inclusive) are analyzed.
 * @returns An AdvancedAnalysisResults object containing all analysis outputs.
 */
export function runAdvancedAnalysis(
  data: CrossFitData,
  yearRange?: [number, number],
): AdvancedAnalysisResults {
  // Filter workouts by year range if specified
  const workouts = filterByYearRange(data.searchIndex, yearRange)

  // 1. Shannon Entropy -- how varied is the movement selection?
  const entropy = calculateMovementEntropy(workouts)

  // 2. HHI -- is programming dominated by a few movements?
  const hhi = calculateHHI(workouts)

  // 3. Pareto Analysis -- the "vital few" vs "trivial many" movements
  const pareto = paretoAnalysis(workouts)

  // 4. Hopper Readiness -- how many modality x time-domain combos are covered?
  const hopperResult = hopperReadiness(workouts)

  // 5. Combination Coverage -- how many movement pairs have been explored?
  const combCoverage = combinationCoverage(workouts)

  // 6. Autocorrelation -- is there a weekly or other periodic pattern?
  const autoCorr = autocorrelation(workouts)

  // 7. Rest Day Intelligence -- are rest days placed strategically?
  const restAnalysis = restDayAnalysis(workouts)

  // 8. Markov Transitions -- what modality follows what?
  const markov = markovTransitions(workouts)

  // 9. Network Centrality -- which movements are central to the programming graph?
  // Use the network data from the full dataset (nodes and links)
  const networkNodes = data.network.nodes.map((n) => ({ id: n.id, count: n.count }))
  const networkLinks = data.network.links.map((l) => ({ source: l.source, target: l.target, value: l.value }))
  const centrality = networkCentrality(networkNodes, networkLinks)

  return {
    entropy,
    hhi,
    pareto,
    hopperReadiness: hopperResult,
    combinationCoverage: combCoverage,
    autocorrelation: autoCorr,
    restDayAnalysis: restAnalysis,
    markovTransitions: markov,
    networkCentrality: centrality,
    // Aliases used by components
    hopper: hopperResult,
    markov,
    restDay: restAnalysis,
    centrality,
  }
}
