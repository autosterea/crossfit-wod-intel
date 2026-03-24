// Statistical analysis utilities for CrossFit WOD data

// Chi-squared test for independence
export function chiSquaredTest(observed: number, expected: number): { chiSq: number; significant: boolean } {
  if (expected === 0) return { chiSq: 0, significant: false }
  const chiSq = Math.pow(observed - expected, 2) / expected
  // p < 0.01 for 1 df ≈ chiSq > 6.635
  return { chiSq, significant: chiSq > 6.635 }
}

// Z-score for anomaly detection
export function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

// Standard deviation
export function stdDev(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1)
  return Math.sqrt(variance)
}

// Mean
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

// Pearson correlation coefficient
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0

  const meanX = mean(x.slice(0, n))
  const meanY = mean(y.slice(0, n))

  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }

  const den = Math.sqrt(denX * denY)
  return den === 0 ? 0 : num / den
}

// Linear regression: returns slope and r-squared
export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = Math.min(x.length, y.length)
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 }

  const meanX = mean(x.slice(0, n))
  const meanY = mean(y.slice(0, n))

  let ssXY = 0, ssXX = 0, ssYY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    ssXY += dx * dy
    ssXX += dx * dx
    ssYY += dy * dy
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX
  const intercept = meanY - slope * meanX
  const rSquared = (ssXX === 0 || ssYY === 0) ? 0 : Math.pow(ssXY, 2) / (ssXX * ssYY)

  return { slope, intercept, rSquared }
}

// Mann-Kendall trend test (non-parametric)
export function mannKendallTrend(values: number[]): { tau: number; significant: boolean; direction: 'increasing' | 'decreasing' | 'none' } {
  const n = values.length
  if (n < 4) return { tau: 0, significant: false, direction: 'none' }

  let s = 0
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = values[j] - values[i]
      if (diff > 0) s++
      else if (diff < 0) s--
    }
  }

  const tau = (2 * s) / (n * (n - 1))
  const variance = (n * (n - 1) * (2 * n + 5)) / 18
  const zVal = s / Math.sqrt(variance)
  const significant = Math.abs(zVal) > 1.96 // p < 0.05

  return {
    tau,
    significant,
    direction: tau > 0.1 ? 'increasing' : tau < -0.1 ? 'decreasing' : 'none',
  }
}

// Gini coefficient for inequality measurement
export function giniCoefficient(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return 0

  const total = sorted.reduce((a, b) => a + b, 0)
  if (total === 0) return 0

  let numerator = 0
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i]
  }

  return numerator / (n * total)
}

// Balance score: 0 = perfectly balanced, 1 = completely imbalanced
export function balanceScore(values: number[]): number {
  if (values.length === 0) return 0
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return 0

  const ideal = total / values.length
  const deviation = values.reduce((sum, v) => sum + Math.abs(v - ideal), 0)
  return deviation / (2 * total)
}

// Effect size (Cohen's d)
export function cohensD(group1: number[], group2: number[]): number {
  const m1 = mean(group1)
  const m2 = mean(group2)
  const s1 = stdDev(group1)
  const s2 = stdDev(group2)
  const pooledSD = Math.sqrt((s1 * s1 + s2 * s2) / 2)
  return pooledSD === 0 ? 0 : (m1 - m2) / pooledSD
}

// Percentile
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}
