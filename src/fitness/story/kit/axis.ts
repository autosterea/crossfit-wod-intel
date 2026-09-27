/* Axes (DESIGN.md C.11, F.1).
   logAxis: u = log position between tMin and tMax (Pathways).
   intervalAxis: the sample durations sit at equal spacing (u = i / (n - 1)),
   and each segment between samples is logarithmic. Curves drawn index-
   uniformly, the ticks, the task dots and the scores then all agree. */

export interface Axis {
  u: (s: number) => number
  s: (u: number) => number
  /** u of each sample (interval axis) or of each given tick */
  ticks: number[]
}

export function logAxis(tMin: number, tMax: number, ticks: number[] = []): Axis {
  const a = Math.log(tMin)
  const b = Math.log(tMax)
  const u = (s: number) => (Math.log(Math.max(1e-9, s)) - a) / (b - a)
  return { u, s: (x: number) => Math.exp(a + (b - a) * x), ticks: ticks.map(u) }
}

export function intervalAxis(D: readonly number[]): Axis {
  const n = D.length
  const u = (s: number): number => {
    if (s <= D[0]) return 0
    if (s >= D[n - 1]) return 1
    let i = 0
    while (i < n - 2 && s > D[i + 1]) i++
    return (i + Math.log(s / D[i]) / Math.log(D[i + 1] / D[i])) / (n - 1)
  }
  const s = (x: number): number => {
    const f = Math.max(0, Math.min(1, x)) * (n - 1)
    const i = Math.min(n - 2, Math.floor(f))
    return D[i] * Math.pow(D[i + 1] / D[i], f - i)
  }
  return { u, s, ticks: D.map((_, i) => i / (n - 1)) }
}
