import { create } from 'zustand'
import { useStoryStore } from '../../story/store'
import { EXPLORE_CAP, N_ATH, SEED, STORY_DRAWS, makeRun, type Run } from './hopperMath'
import { STORY_SCHED, debounceRain, emptySched, setSort, type Sched } from './timeline'
import { cameraBus } from '../../story/camera/CameraDirector'

/* =========================================================================
   Hopper explore (DESIGN.md D.3 "Explore", C.12). It starts from the
   draw-40 state of the story run. Draw adds one draw (ball, ticket, six
   bricks, count, re-sort); x10 and x40 rain draws in, accelerating, like
   H5. New run is a fresh seed from crypto.getRandomValues (explore only:
   story mode stays seeded, F.9) and rains its first 40 draws; Reset goes
   back to seed 78331 at draw 40. Rails | Every run switches the board and
   the thread chart. Tapping a rail shows that athlete's five domain
   scores. Under reduced motion every draw lands at once (C.13: no
   autoplay tweening; the state change is a cut).

   The run's schedule lives in explore seconds (ex.X), advanced by the
   scene only while exploring and only while something is still playing;
   everything else (the board, the ticket, the drum's drawn balls) reads it
   through the same evaluator the story uses.
   ========================================================================= */

export type HopView = 'rails' | 'runs'
/** the explore board's elevation (the story's board pose, el 8) */
export const EXPLORE_EL = 8

export const ex = {
  run: makeRun(SEED, EXPLORE_CAP) as Run,
  sched: null as unknown as Sched,
  /** explore seconds */
  X: 0,
  /** when the last scheduled draw starts (explore seconds) */
  last: -Infinity,
  /** when the last scheduled window ends (the clock rests after it) */
  end: -Infinity,
}

/** A run whose first `done` draws are already complete (their windows lie in the past). */
function scheduleDone(run: Run, done: number): Sched {
  const s = emptySched(run, EXPLORE_CAP)
  for (let d = 0; d < done; d++) {
    s.kind[d] = d < 5 ? 0 : 1
    s.flip0[d] = -2
    s.flip1[d] = -1.9
    for (let a = 0; a < N_ATH; a++) {
      const i = d * N_ATH + a
      s.fly0[i] = s.str0[i] = s.cnt0[i] = -2
      s.fly1[i] = s.str1[i] = s.cnt1[i] = -1.9
    }
    setSort(s, d, -2, -1.9)
  }
  s.n = done
  s.version++
  return s
}

function resetRuntime(run: Run, done: number) {
  ex.run = run
  ex.sched = scheduleDone(run, done)
  ex.X = 0
  ex.last = -Infinity
  ex.end = -1.9
}
resetRuntime(ex.run, STORY_DRAWS)

/**
 * Queue k draws. A single draw plays its whole story (ball, flip, bricks,
 * count, re-sort) over about 1.5 s; a batch rains, each draw a little
 * sooner than the last (x10 about 2 s, x40 about 5 s). Under reduced
 * motion the windows collapse onto one instant: the draws land at once.
 */
function queue(k: number): number {
  const s = ex.sched
  const cut = useStoryStore.getState().reduced
  let added = 0
  for (let j = 0; j < k && s.n < EXPLORE_CAP; j++) {
    const d = s.n
    const single = k === 1
    if (cut) {
      const t0 = ex.X
      s.kind[d] = single ? 0 : 1
      s.ball0[d] = s.ball1[d] = NaN
      s.flip0[d] = t0 - 0.002
      s.flip1[d] = t0 - 0.001
      for (let a = 0; a < N_ATH; a++) {
        const i = d * N_ATH + a
        s.fly0[i] = s.str0[i] = s.cnt0[i] = t0 - 0.002
        s.fly1[i] = s.str1[i] = s.cnt1[i] = t0 - 0.001
      }
      if (j > 0 && s.kind[d - 1] === 1) debounceRain(s, d - 1)
      setSort(s, d, t0 - 0.002, t0 - 0.001)
      ex.last = t0
      ex.end = Math.max(ex.end, t0)
      s.n++
      added++
      continue
    }
    const gap = single ? 1.15 : Math.max(0.085, 0.42 * Math.pow(0.86, j))
    const t0 = Math.max(ex.X + (j === 0 ? 0.05 : 0), ex.last + (ex.last === -Infinity ? 0 : gap))
    ex.last = t0
    if (single) {
      s.kind[d] = 0
      s.ball0[d] = t0
      s.ball1[d] = t0 + 0.36
      s.flip0[d] = t0 + 0.24
      s.flip1[d] = t0 + 0.56
      for (let a = 0; a < N_ATH; a++) {
        const i = d * N_ATH + a
        const o = 0.035 * a
        s.fly0[i] = t0 + 0.52 + o
        s.fly1[i] = t0 + 0.8 + o
        s.str0[i] = t0 + 0.78 + o
        s.str1[i] = t0 + 1.0 + o
        s.cnt0[i] = t0 + 0.8
        s.cnt1[i] = t0 + 1.12
      }
      setSort(s, d, t0 + 1.12, t0 + 1.52)
      ex.end = Math.max(ex.end, t0 + 1.52)
    } else {
      s.kind[d] = 1
      s.ball0[d] = NaN
      s.ball1[d] = NaN
      const flick = Math.min(0.16, 0.8 * gap)
      s.flip0[d] = t0
      s.flip1[d] = t0 + flick
      // the six totals of a draw count together once the last sliver lands (the draws overlap)
      const c0 = t0 + 0.26 + 0.03 * (N_ATH - 1)
      const last = c0 + 0.14
      for (let a = 0; a < N_ATH; a++) {
        const i = d * N_ATH + a
        const o = 0.03 * a
        s.fly0[i] = t0 + 0.03 + o
        s.fly1[i] = t0 + 0.26 + o
        s.str0[i] = t0 + 0.26 + o
        s.str1[i] = t0 + 0.4 + o
        s.cnt0[i] = c0
        s.cnt1[i] = last
      }
      // a swap the next draw of this batch undoes is not shown (one-draw flicker)
      if (j > 0 && s.kind[d - 1] === 1) debounceRain(s, d - 1)
      setSort(s, d, last, last + 0.34)
      ex.end = Math.max(ex.end, last + 0.34)
    }
    s.n++
    added++
  }
  if (added) s.version++
  return added
}

/** A fresh seed (explore only; story mode never calls this). */
function freshSeed(): number {
  try {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return 1 + (a[0] % 99999)
  } catch {
    return 1 + ((ex.X * 7919) | 0) % 99999
  }
}

export interface HopExploreState {
  seed: number
  /** bumps whenever the run object is replaced (New run, Reset) */
  runId: number
  view: HopView
  /** the athlete whose five domain scores are shown (tap a rail), or null */
  selected: number | null
  /** draws scheduled so far */
  n: number
  draw(k: number): void
  newRun(): void
  reset(): void
  setView(v: HopView): void
  select(a: number | null): void
}

export const useHopExplore = create<HopExploreState>((set, get) => ({
  seed: SEED,
  runId: 0,
  view: 'rails',
  selected: null,
  n: STORY_DRAWS,
  draw: (k) => {
    // a draw lands on the rails: from the chart, the rails come back first
    if (get().view === 'runs') get().setView('rails')
    queue(k)
    set({ n: ex.sched.n })
  },
  newRun: () => {
    const seed = freshSeed()
    resetRuntime(makeRun(seed, EXPLORE_CAP), 0)
    queue(STORY_DRAWS)
    set({ seed, runId: get().runId + 1, n: ex.sched.n })
  },
  reset: () => {
    resetRuntime(makeRun(SEED, EXPLORE_CAP), STORY_DRAWS)
    set({ seed: SEED, runId: get().runId + 1, n: STORY_DRAWS })
  },
  setView: (v) => {
    set({ view: v })
    // the chart is read exactly front-on (L12, H.21); the rails keep the board's slight lift
    cameraBus.orbitTo(0, v === 'runs' ? 0 : EXPLORE_EL)
  },
  select: (a) => set({ selected: a }),
}))

/* ------------------------------ the active source ------------------------------ */

export interface Src {
  s: Sched
  X: number
  story: boolean
}
const storySrc: Src = { s: STORY_SCHED, X: 0, story: true }
const exSrc: Src = { s: ex.sched, X: 0, story: false }

/** What the shared elements show at story time T: the story run at T, or the explore run at its own clock. */
export function srcAt(T: number): Src {
  if (useStoryStore.getState().mode === 'explore') {
    exSrc.s = ex.sched
    exSrc.X = ex.X
    return exSrc
  }
  storySrc.X = T
  return storySrc
}
export const isExplore = () => useStoryStore.getState().mode === 'explore'
