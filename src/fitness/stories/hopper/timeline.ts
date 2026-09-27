import { at, stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { N_ATH, GEN, STORY, type Run } from './hopperMath'

/* =========================================================================
   The hopper's time. A SCHEDULE says, for every draw of a run, when its
   ball drops, when the ticket flips, when each athlete's brick flies,
   stretches and counts, and when each rail moves to its new rank. The story
   schedule is in story time T (built once, so the scene is a pure function
   of T); the explore schedule is in explore seconds and grows as the viewer
   draws. One evaluator turns (schedule, time) into the board: counted
   totals, rank positions, the rail scale k, the ticket face and the pass
   fade of every rail's labels. It is cached per time on the schedule
   itself, so the labels (priority -80) and the solids (priority 0) of one
   frame read the same numbers, and a replaced schedule takes its cache
   with it.
   ========================================================================= */

export const B = { hopper: 0, draw: 1, score: 2, specialists: 3, unknown: 4, many: 5, every: 6 } as const

export interface Board {
  /** counted totals per athlete */
  totals: Float64Array
  /** rank slot per athlete, continuous while the rails re-sort */
  rankPos: Float64Array
  /** depth lift while a rail passes another (rising rails come forward) */
  lift: Float64Array
  /** 0..1 per athlete: how far the rail's name and total have stepped off while it passes others */
  fade: Float64Array
  /** the rail scale: world units per point */
  k: number
  /** the leader after the last completed sort */
  leader: number
  /** a leader change is re-sorting right now (0..1 of that sort), else -1 */
  leaderSwap: number
  /** draws whose bricks have started (0..n) */
  started: number
  /** the face on the ticket (1-based draw, 0 none) and its turn (radians about x) */
  face: number
  faceTurn: number
  /** brick (d, a) offset along its rail in points when grouped by domain (landed bricks only count) */
  grp: Float64Array
}

export interface Sched {
  run: Run
  /** draws scheduled so far (explore grows it) */
  n: number
  /** bumps whenever a window changes (explore) */
  version: number
  /** ball drop [0, 1]; NaN: no ball for this draw (the H5 rain) */
  ball0: Float64Array
  ball1: Float64Array
  /** ticket flip; the face switches at the midpoint (edge-on) */
  flip0: Float64Array
  flip1: Float64Array
  /** face kind: 0 the full ticket (DRAW N, domain, task), 1 the small flick card */
  kind: Uint8Array
  /** per athlete (d * N_ATH + a): flight, stretch and count windows */
  fly0: Float64Array
  fly1: Float64Array
  str0: Float64Array
  str1: Float64Array
  cnt0: Float64Array
  cnt1: Float64Array
  /** the re-order after draw d: its whole window, and each athlete's own pass inside it */
  sort0: Float64Array
  sort1: Float64Array
  sortA0: Float64Array
  sortA1: Float64Array
  /** top-scorer tick; NaN: none */
  tick0: Float64Array
  tick1: Float64Array
  /**
   * 0: bricks lie in draw order; 1: each rail's bricks are grouped by domain
   * into contiguous bands (the end of H5, and explore), per athlete a.
   */
  group: (X: number, a: number, dm: number) => number
  /** the board evaluated last (boardAt), kept on the schedule so it goes when the schedule goes */
  cache: { X: number; v: number; len: number; b: Board }
}

const newBoard = (): Board => ({
  totals: new Float64Array(N_ATH),
  rankPos: new Float64Array(N_ATH),
  lift: new Float64Array(N_ATH),
  fade: new Float64Array(N_ATH),
  k: 0,
  leader: GEN,
  leaderSwap: -1,
  started: 0,
  face: 0,
  faceTurn: 0,
  grp: new Float64Array(0),
})

export function emptySched(run: Run, cap: number): Sched {
  const f = (n: number, v = Infinity) => new Float64Array(n).fill(v)
  return {
    run,
    n: 0,
    version: 0,
    ball0: f(cap, NaN),
    ball1: f(cap, NaN),
    flip0: f(cap),
    flip1: f(cap),
    kind: new Uint8Array(cap),
    fly0: f(cap * N_ATH),
    fly1: f(cap * N_ATH),
    str0: f(cap * N_ATH),
    str1: f(cap * N_ATH),
    cnt0: f(cap * N_ATH),
    cnt1: f(cap * N_ATH),
    sort0: f(cap),
    sort1: f(cap),
    sortA0: f(cap * N_ATH),
    sortA1: f(cap * N_ATH),
    tick0: f(cap, NaN),
    tick1: f(cap, NaN),
    group: () => 1,
    cache: { X: NaN, v: -1, len: -1, b: newBoard() },
  }
}

/**
 * The re-order after draw d runs over [t0, t1]. With a stagger, the rails
 * set off one after another in their NEW rank order (the new P1 first), so
 * the first sort cascades down the board instead of shuffling all at once.
 */
export function setSort(s: Sched, d: number, t0: number, t1: number, stag = 0): void {
  s.sort0[d] = t0
  s.sort1[d] = t1
  const pass = t1 - t0 - stag * (N_ATH - 1)
  for (let a = 0; a < N_ATH; a++) {
    const i = d * N_ATH + a
    const o = stag * s.run.rank[(d + 1) * N_ATH + a]
    s.sortA0[i] = t0 + o
    s.sortA1[i] = t0 + o + pass
  }
}

/* ------------------------------ the story schedule ------------------------------ */

/** H5: draws 6 to 40 start at 5 + 35 x easeInQuad(u), u over [H5_A, H5_B] of the beat (D.3). */
export const H5_A = 0.05
export const H5_B = 0.78
export const h5Start = (d: number) => B.many + H5_A + (H5_B - H5_A) * Math.sqrt((d - 6) / 35)
/** The continuous draw count of the H5 rain (5 at its start, 40 at its end). */
export const h5Index = (T: number) => {
  const u = at(T, B.many, H5_A, H5_B)
  return 5 + 35 * u * u
}

/** Build seconds of the beats whose staggers are authored in milliseconds. */
const BUILD = { score: 5.0, specialists: 5.5, unknown: 5.5, many: 6.0 }
/** bricks stagger 35 ms (B.1) */
const stag = (buildS: number) => 0.035 / buildS

/** H2: the first sort cascades (the new P1 sets off first), and the rank badges land with it (L2). */
export const H2_SORT = [0.7, 0.9] as const
/** H4: the rails re-sort and the Generalist takes P1 before the impact (0.62), so the accent lands on a settled P1 */
export const H4_SORT = [0.5, 0.615] as const

function storySched(): Sched {
  const s = emptySched(STORY, STORY.n)
  s.n = STORY.n
  const set = (d: number, a: number, fly: [number, number], str: [number, number], cnt: [number, number]) => {
    const i = d * N_ATH + a
    s.fly0[i] = fly[0]
    s.fly1[i] = fly[1]
    s.str0[i] = str[0]
    s.str1[i] = str[1]
    s.cnt0[i] = cnt[0]
    s.cnt1[i] = cnt[1]
  }
  // draw 1: the ball and the ticket in H1, the bricks, count and sort in H2
  s.ball0[0] = B.draw + 0.15
  s.ball1[0] = B.draw + 0.45
  // the first flip has nothing to turn away: its window's first half shows
  // no face, so the face turns in over H1 0.45 to 0.70 (D.3)
  s.flip0[0] = B.draw + 0.2
  s.flip1[0] = B.draw + 0.7
  const st2 = stag(BUILD.score)
  for (let a = 0; a < N_ATH; a++) {
    const o = st2 * a
    set(0, a, [B.score + 0.3 + o, B.score + 0.5 + o], [B.score + 0.49 + o, B.score + 0.66 + o], [B.score + 0.56, B.score + 0.7])
  }
  // D.3 H2: the totals count, then the rails sort (no rail passes another
  // before its total is up), 100 ms apart in their new rank order
  setSort(s, 0, B.score + H2_SORT[0], B.score + H2_SORT[1], 0.1 / BUILD.score)
  // H3: draw 1 gets its top-scorer tick first, so every draw shows its winner
  s.tick0[0] = B.specialists
  s.tick1[0] = B.specialists + 0.045
  // draws 2, 3, 4 in H3: windows at 0.05, 0.35, 0.65, each 0.25 long
  const st3 = stag(BUILD.specialists)
  ;[0.05, 0.35, 0.65].forEach((w0, j) => {
    const d = j + 1
    const W = B.specialists + w0
    const L = 0.25
    s.ball0[d] = W
    s.ball1[d] = W + 0.28 * L
    s.flip0[d] = W + 0.22 * L
    s.flip1[d] = W + 0.44 * L
    for (let a = 0; a < N_ATH; a++) {
      const o = st3 * a
      set(d, a, [W + 0.42 * L + o, W + 0.62 * L + o], [W + 0.6 * L + o, W + 0.78 * L + o], [W + 0.62 * L, W + 0.88 * L])
    }
    s.tick0[d] = W + 0.8 * L
    s.tick1[d] = W + 0.94 * L
    setSort(s, d, W + 0.84 * L, W + 1.0 * L)
  })
  // draw 5 in H4, slow: the unknown. The Generalist brick lands last.
  {
    const d = 4
    const W = B.unknown
    s.ball0[d] = W + 0.03
    s.ball1[d] = W + 0.17
    s.flip0[d] = W + 0.15
    s.flip1[d] = W + 0.28
    const st4 = stag(BUILD.unknown)
    let j = 0
    for (let a = 0; a < N_ATH; a++) {
      if (a === GEN) {
        set(d, a, [W + 0.37, W + 0.43], [W + 0.43, W + 0.48], [W + 0.43, W + 0.49])
        continue
      }
      const o = 1.6 * st4 * j++
      set(d, a, [W + 0.27 + o, W + 0.33 + o], [W + 0.33 + o, W + 0.39 + o], [W + 0.33 + o, W + 0.41 + o])
    }
    setSort(s, d, W + H4_SORT[0], W + H4_SORT[1])
  }
  // draws 6 to 40 in H5: the rain
  // H5 end: every rail's bricks slide into five domain bands, so the band
  // lengths show where each total came from (D.3 H5 learning outcome)
  // the bands assemble in legend order (weightlifting first), rails a beat apart
  s.group = (X, a, dm) => stagger(X + 0.004 * (N_ATH - 1 - a), B.many + 0.82, B.many + 0.98, dm, 5, 0.6, ease.morph)
  const st5 = stag(BUILD.many)
  for (let d1 = 6; d1 <= 40; d1++) {
    const d = d1 - 1
    const t0 = h5Start(d1)
    const next = d1 < 40 ? h5Start(d1 + 1) : t0 + 0.05
    const flick = Math.min(0.03, 0.8 * (next - t0))
    s.kind[d] = 1
    s.flip0[d] = t0
    s.flip1[d] = t0 + flick
    let last = 0
    for (let a = 0; a < N_ATH; a++) {
      const o = st5 * a
      const f0 = t0 + 0.004 + o
      const f1 = f0 + 0.034
      const s1 = f1 + 0.02
      set(d, a, [f0, f1], [f1, s1], [f1, s1])
      last = s1
    }
    // a swap in the rain: short (190 ms), its two rails' labels step off while they pass
    setSort(s, d, last, last + 0.032)
  }
  return s
}

export const STORY_SCHED = storySched()

/* ------------------------------ the board at a time ------------------------------ */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const win = (x: number, a: number, b: number) => (x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a))

/** Rail scale floor, in points: the board of the first five draws keeps one scale (amendment, see known issues). */
export const SCALE_FLOOR = 400
/** Rails are scaled so the leader fills 90% of the rail: k = 0.9 railLen / max(400, leaderTotal) (D.3, floor amended from 1000). */
export const railScale = (len: number, leaderTotal: number) => (0.9 * len) / Math.max(SCALE_FLOOR, leaderTotal)

/** A rail's labels step off over the first fifth of its pass and back over the last fifth. */
const passFade = (p: number) => ease.settle(clamp01(Math.min(p, 1 - p) / 0.2))

const ACC = new Float64Array(5)
const BASE = new Float64Array(5)

/** The board of schedule s at time X (cached on s: every caller in a frame shares one evaluation). */
export function boardAt(s: Sched, X: number, railLen: number): Board {
  const c = s.cache
  if (c.X === X && c.v === s.version && c.len === railLen) return c.b
  c.X = X
  c.v = s.version
  c.len = railLen
  const b = c.b
  const run = s.run
  b.totals.fill(0)
  b.lift.fill(0)
  b.fade.fill(0)
  let started = 0
  for (let d = 0; d < s.n; d++) {
    const i0 = d * N_ATH
    if (!(s.fly0[i0] <= X) && !(s.cnt0[i0] <= X)) {
      // windows are in draw order: nothing later has started either
      let any = false
      for (let a = 1; a < N_ATH; a++) if (s.fly0[i0 + a] <= X || s.cnt0[i0 + a] <= X) any = true
      if (!any) break
    }
    started = d + 1
    for (let a = 0; a < N_ATH; a++) {
      const i = i0 + a
      const k = ease.count(win(X, s.cnt0[i], s.cnt1[i]))
      if (k > 0) b.totals[a] += run.pts[i] * k
    }
  }
  b.started = started
  // rank positions: the last fully sorted draw, plus the passes in progress
  let m = 0
  while (m < s.n && s.sort1[m] <= X) m++
  for (let a = 0; a < N_ATH; a++) b.rankPos[a] = run.rank[m * N_ATH + a]
  b.leader = run.leader[m]
  b.leaderSwap = -1
  for (let d = m; d < s.n && s.sort0[d] < X; d++) {
    for (let a = 0; a < N_ATH; a++) {
      const delta = run.rank[(d + 1) * N_ATH + a] - run.rank[d * N_ATH + a]
      if (!delta) continue
      const i = d * N_ATH + a
      const p = clamp01(win(X, s.sortA0[i], s.sortA1[i]))
      b.rankPos[a] += delta * ease.morph(p)
      b.lift[a] += -Math.sign(delta) * 0.55 * Math.sin(Math.PI * p)
      b.fade[a] = Math.max(b.fade[a], passFade(p))
    }
    if (run.leader[d + 1] !== run.leader[d]) b.leaderSwap = clamp01(win(X, s.sort0[d], s.sort1[d]))
  }
  // the domain-grouped offsets: each brick sits after every landed brick of
  // an earlier domain, and after the earlier landed bricks of its own
  if (b.grp.length < s.n * N_ATH) b.grp = new Float64Array(Math.max(s.n, 1) * N_ATH)
  for (let a = 0; a < N_ATH; a++) {
    for (let k = 0; k < ACC.length; k++) ACC[k] = 0
    for (let d = 0; d < started; d++) {
      const i = d * N_ATH + a
      const dm = run.dom[d]
      b.grp[i] = ACC[dm]
      if (s.fly1[i] <= X) ACC[dm] += run.pts[i] * win(X, s.str0[i], s.str1[i])
    }
    let base = 0
    for (let k = 0; k < ACC.length; k++) {
      BASE[k] = base
      base += ACC[k]
    }
    for (let d = 0; d < started; d++) b.grp[d * N_ATH + a] += BASE[run.dom[d]]
  }
  let lt = 0
  for (let a = 0; a < N_ATH; a++) lt = Math.max(lt, b.totals[a])
  b.k = railScale(railLen, lt)
  // the ticket face: the latest flip that has started
  let f = 0
  while (f < s.n && s.flip0[f] <= X) f++
  if (f === 0) {
    b.face = 0
    b.faceTurn = Math.PI / 2
  } else {
    const d = f - 1
    const mid = (s.flip0[d] + s.flip1[d]) / 2
    if (X < mid) {
      // the previous face turns away (to +90 degrees, edge-on)
      b.face = d
      b.faceTurn = (Math.PI / 2) * ease.exit(win(X, s.flip0[d], mid))
    } else {
      // this face turns in from -90 degrees and snaps flat
      b.face = d + 1
      b.faceTurn = (-Math.PI / 2) * (1 - ease.snap(win(X, mid, s.flip1[d])))
    }
  }
  return b
}

/* ------------------------------ story cues ------------------------------ */

/** HUD: DRAW N from H1 on (N is the draw on the ticket), gone as the chart takes over. */
export const hudOn = (T: number) => at(T, B.draw, 0.08, 0.18) * (1 - at(T, B.every, 0.2, 0.32))
/** P: the drum and the ticket step aside for the board while the rails draw on (H2 0 to 0.3). */
export const boardIn = (T: number) => at(T, B.score, 0, 0.3, ease.morph)
/** The ticket shrinks to a small flick card for the rain (H5). */
export const ticketShrink = (T: number) => at(T, B.many, 0, 0.07, ease.settle)
/** H5: the drum spins twice as fast while the draws rain (extra ambient seconds, a function of T). */
export const spinBoost = (T: number) => 4.4 * ease.morph(at(T, B.many, H5_A, H5_B))

/*
 * H6 "Again and again": the lead becomes the chart.
 *   0.00 to 0.12  every rail but P1 and P2 steps back (focus pull, L3);
 *   0.04 to 0.20  a yellow-green bracket measures the P1 bar past the P2 bar: the lead;
 *   0.20 to 0.42  the board fades, the camera goes front-on to the chart, and
 *                 the bracket swings up into the chart as the lead at draw 40;
 *   0.26 to 0.40  the chart's construction and its words (ticks, DRAWS, the two regions);
 *   0.40 to 0.60  this run's line draws from draw 0 up to the bracket;
 *   0.58 to 0.88  the 64 other hoppers draw on together;
 *   0.88 to 0.98  THIS RUN and the pinned legend land (the claim).
 */
export const H6 = {
  others: [0.0, 0.12],
  bracket: [0.04, 0.2],
  toChart: [0.2, 0.42],
  construct: [0.26, 0.4],
  mine: [0.4, 0.6],
  bundle: [0.58, 0.88],
  claim: [0.88, 0.98],
} as const
/** H6: the board (everything but the P1 and P2 bars) steps back. */
export const othersBack = (T: number) => at(T, B.every, H6.others[0], H6.others[1], ease.settle)
/** H6: the whole board fades as the chart takes the rails' place. */
export const toChart = (T: number) => at(T, B.every, H6.toChart[0], H6.toChart[0] + 0.14, ease.settle)
