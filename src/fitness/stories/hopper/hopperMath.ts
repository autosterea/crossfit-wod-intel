import { HOPPER_DOMAINS, HOPPER_ROSTER, type DomainKey } from '../../fitnessData'
import { clamp } from '../../lessonMath'
import { mulberry32 } from '../../story/rng'

/* =========================================================================
   02 THE HOPPER, the math (DESIGN.md D.3). The legacy module drew with
   Math.random; story mode is SEEDED instead (L5: the scene is f(T)), with
   the exact consumption order of the legacy draw so the numbers are the
   module's own:
     domain = r() < 0.18 ? 'unknown' : [WL, GYM, MONO, OO][floor(r() x 4)]
     r() once more, discarded (the legacy task pick); the task label is
       HOPPER_DOMAINS[domain].tasks[occurrence % 5]
     for each HOPPER_ROSTER athlete in order: pts = clamp(base + (r() x 8 - 4), 5, 99)
   The 40-draw story run (seed 78331) and the 64-thread proof (seeds 1 to
   64) are precomputed once at module load, with prefix sums per draw.
   ========================================================================= */

export const SEED = 78331
export const STORY_DRAWS = 40
export const THREAD_COUNT = 64
/** explore runs are precomputed to this many draws (the explore brick capacity) */
export const EXPLORE_CAP = 120
export const N_ATH = HOPPER_ROSTER.length
export const N_DOM = HOPPER_DOMAINS.length

/** Moved verbatim from HopperModule. */
export const shortName = (name: string) => name.replace(' CrossFitter', '')

export const DOMAIN_IDX: Record<DomainKey, number> = HOPPER_DOMAINS.reduce(
  (acc, d, i) => {
    acc[d.key] = i
    return acc
  },
  {} as Record<DomainKey, number>,
)
export const GEN = HOPPER_ROSTER.findIndex((a) => a.build === 'generalist')
export const NAMES = HOPPER_ROSTER.map((a) => shortName(a.name))
export const DOMAIN_COLORS = HOPPER_DOMAINS.map((d) => d.color)
export const UNKNOWN_IDX = DOMAIN_IDX.unknown

/** The modal domain a competitor is the relative best at (moved verbatim from HopperModule). */
export function primaryDomain(i: number): DomainKey {
  const dom = HOPPER_ROSTER[i].domain
  let best: DomainKey = 'unknown'
  let bestV = -1
  ;(Object.keys(dom) as DomainKey[]).forEach((k) => {
    if (dom[k] > bestV) {
      bestV = dom[k]
      best = k
    }
  })
  return best
}

/** Index of the current leader by cumulative total (ties -> first / generalist), as HopperModule.leaderOf. */
export function leaderOf(totals: ArrayLike<number>): number {
  let idx = 0
  let best = -Infinity
  for (let i = 0; i < totals.length; i++) {
    if (totals[i] > best) {
      best = totals[i]
      idx = i
    }
  }
  return idx
}

/** Weighted pick (HopperModule.weightedDomain), from a seeded generator instead of Math.random. */
export function weightedDomain(r: () => number): DomainKey {
  if (r() < 0.18) return 'unknown'
  const others: DomainKey[] = ['weightlifting', 'gymnastics', 'monostructural', 'oddObject']
  return others[Math.floor(r() * others.length)]
}

export interface Run {
  seed: number
  n: number
  /** domain index per draw (0-based draw) */
  dom: Uint8Array
  /** task index 0..4 per draw */
  task: Uint8Array
  /** points of athlete a on draw d: pts[d * N_ATH + a] */
  pts: Float32Array
  /** total of athlete a after d draws: prefix[d * N_ATH + a], d = 0..n */
  prefix: Float64Array
  /** rank slot (0 = P1) of athlete a after d draws: rank[d * N_ATH + a]; d = 0 is roster order */
  rank: Uint8Array
  /** leader after d draws (d = 0 is the generalist, roster order) */
  leader: Uint8Array
  /** top single-draw scorer of draw d (0-based) */
  top: Uint8Array
  /** generalist total minus the best specialist total after d draws (d = 0..n) */
  lead: Float32Array
}

export function makeRun(seed: number, n: number): Run {
  const r = mulberry32(seed)
  const occ = new Array<number>(N_DOM).fill(0)
  const run: Run = {
    seed,
    n,
    dom: new Uint8Array(n),
    task: new Uint8Array(n),
    pts: new Float32Array(n * N_ATH),
    prefix: new Float64Array((n + 1) * N_ATH),
    rank: new Uint8Array((n + 1) * N_ATH),
    leader: new Uint8Array(n + 1),
    top: new Uint8Array(n),
    lead: new Float32Array(n + 1),
  }
  const order = [...Array(N_ATH).keys()]
  order.forEach((a, k) => (run.rank[a] = k))
  run.leader[0] = GEN
  for (let d = 0; d < n; d++) {
    const key = weightedDomain(r)
    r() // the legacy task pick, consumed and discarded
    const di = DOMAIN_IDX[key]
    run.dom[d] = di
    run.task[d] = occ[di] % 5
    occ[di]++
    let top = 0
    for (let a = 0; a < N_ATH; a++) {
      const base = HOPPER_ROSTER[a].domain[key]
      const pts = clamp(base + (r() * 8 - 4), 5, 99)
      run.pts[d * N_ATH + a] = pts
      run.prefix[(d + 1) * N_ATH + a] = run.prefix[d * N_ATH + a] + pts
      if (pts > run.pts[d * N_ATH + top]) top = a
    }
    run.top[d] = top
    const tot = run.prefix.subarray((d + 1) * N_ATH, (d + 2) * N_ATH)
    // rank by total; ties keep roster order (a stable sort)
    const sorted = order.slice().sort((x, y) => tot[y] - tot[x] || x - y)
    sorted.forEach((a, k) => (run.rank[(d + 1) * N_ATH + a] = k))
    run.leader[d + 1] = leaderOf(tot)
    let best = -Infinity
    for (let a = 0; a < N_ATH; a++) if (a !== GEN) best = Math.max(best, tot[a])
    run.lead[d + 1] = tot[GEN] - best
  }
  return run
}

export const taskName = (run: Run, d: number) => HOPPER_DOMAINS[run.dom[d]].tasks[run.task[d]]
export const total = (run: Run, d: number, a: number) => run.prefix[d * N_ATH + a]

/** The story run (seed 78331, 40 draws). */
export const STORY = makeRun(SEED, STORY_DRAWS)
/** The proof: 64 other hoppers (seeds 1 to 64), the same procedure and the same 40-draw axis. */
export const THREADS: Run[] = Array.from({ length: THREAD_COUNT }, (_, i) => makeRun(i + 1, STORY_DRAWS))

/* ------------------------- C.15 run assertion -------------------------- */
// DESIGN.md D.3 "Verified output": the first 12 draws, the leader after
// draws 1 to 5 and on to 40, the rounded totals at draws 12 and 40, and the
// 64-thread proof. A mismatch throws in development.
if (import.meta.env.DEV) {
  const want12: [DomainKey, string][] = [
    ['weightlifting', '1RM Back Squat'],
    ['oddObject', 'Carry a person 200 m'],
    ['monostructural', '5k Run'],
    ['weightlifting', 'Heavy Clean and Jerk'],
    ['unknown', 'Climb 6 flights with bags'],
    ['gymnastics', 'Max Strict Pull-ups'],
    ['weightlifting', '5RM Deadlift'],
    ['unknown', 'Sprint to catch a bus'],
    ['monostructural', '2k Row'],
    ['weightlifting', 'Max Overhead Press'],
    ['unknown', 'Push a stalled car'],
    ['gymnastics', 'Handstand Walk 50 ft'],
  ]
  const bad: string[] = []
  want12.forEach(([k, t], d) => {
    if (HOPPER_DOMAINS[STORY.dom[d]].key !== k || taskName(STORY, d) !== t) bad.push(`draw ${d + 1}`)
  })
  const idx = (name: string) => NAMES.indexOf(name)
  const lead = ['Olympic Weightlifter', 'Strongman', 'Strongman', 'Strongman', 'Generalist'].map(idx)
  lead.forEach((a, i) => {
    if (STORY.leader[i + 1] !== a) bad.push(`leader after draw ${i + 1}`)
  })
  for (let d = 5; d <= 40; d++) if (STORY.leader[d] !== GEN) bad.push(`leader after draw ${d}`)
  const tot = (d: number) => NAMES.map((_, a) => Math.round(total(STORY, d, a)))
  // roster order: Generalist, Weightlifter, Marathoner, Gymnast, Strongman, Sprinter
  if (tot(12).join() !== [944, 771, 547, 743, 809, 685].join()) bad.push('totals at 12: ' + tot(12).join())
  if (tot(40).join() !== [3185, 2396, 1957, 2693, 2404, 2282].join()) bad.push('totals at 40: ' + tot(40).join())
  const d1 = NAMES.map((_, a) => Math.round(STORY.pts[a]))
  if (d1.join() !== [74, 95, 18, 54, 92, 59].join()) bad.push('draw 1 points: ' + d1.join())
  const above = (d: number) => THREADS.filter((t) => t.lead[d] > 0).length
  if (above(10) !== 62 || above(20) !== 64) bad.push(`threads above zero ${above(10)} / ${above(20)}`)
  if (bad.length) throw new Error('[hopper] the seeded run does not match DESIGN.md D.3: ' + bad.join(', '))
}
