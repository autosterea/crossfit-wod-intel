import { at, pulse, stagger } from '../../story/cue'
import { ease, type Ease } from '../../story/ease'
import { ATHLETE, AVERAGE, BODY_FAT, BP, BP_STATIONS, FAT_STATIONS, N, STATES, meanOf, stateWord } from './continuumMath'
import { Y_PAIR, rowY } from './layout'

/* =========================================================================
   The Continuum story as pure functions of story time T (L5). The scene,
   the labels, the HUD chip and the portrait key all read these, so a deep
   link, a scrub and autoplay land on the same frame.

     C0 one-line  a hot pen draws one line in the spectrum; three stations
     C1 bp        the line becomes systolic blood pressure; a bead reads the
                  three worked examples as it slides to the right
     C2 bodyfat   a second marker, the same ordering (LOWER IS BETTER)
     C3 dial      eight more rows cascade in, then all ten swing into a
                  full circle: centre = sickness, rim = fitness (signature)
     C4 well      the camera tilts: the centre is a pit. The average profile
                  climbs out of it and lands on the WELL circle
     C5 super     the same markers climb to the CrossFit athlete
     C6 hedge     the margin between WELL and the athlete lights
   ========================================================================= */

export const B = { line: 0, bp: 1, fat: 2, dial: 3, well: 4, sup: 5, hedge: 6 } as const

/** Beat-local time at which an eased window [a, b] reaches the fraction y. */
function crossAt(n: number, a: number, b: number, e: Ease, y: number): number {
  let lo = 0
  let hi = 1
  for (let k = 0; k < 32; k++) {
    const m = (lo + hi) / 2
    if (e(m) < y) lo = m
    else hi = m
  }
  return n + a + (b - a) * ((lo + hi) / 2)
}

/* ------------------------------- C0 ---------------------------------- */

const LINE_A = 0.04
const LINE_B = 0.58
/** Row 1 (the one line, then systolic BP) draws with the hot pen. */
export const lineDraw = (T: number) => at(T, B.line, LINE_A, LINE_B, ease.draw)
/** Story time at which the pen head passes sickness (0), wellness (0.5) and fitness (1). */
export const LINE_CROSS = [0, 0.5, 1].map((u) => crossAt(B.line, LINE_A, LINE_B, ease.draw, u))
/** A station flares as the head passes it. */
export const stationFlare = (T: number, k: number) => pulse(T, LINE_CROSS[k] - (k === 0 ? 0 : 0.012), LINE_CROSS[k] + 0.07)
/** The three C0 callouts land in order, then give way to the BP scale in C1. */
export const c0Callout = (T: number, k: number) => at(T, B.line, 0.62 + 0.08 * k, 0.72 + 0.08 * k, ease.settle) * (1 - at(T, B.bp, 0, 0.12))

/* ------------------------------ C1, C2 ------------------------------- */

/** Row 2 (body fat) draws with its own pen. */
export const fatDraw = (T: number) => at(T, B.fat, 0.16, 0.4, ease.draw)

/** The featured rows' scale (tick values, unit) and its exit when the other rows arrive. */
export const bpScale = (T: number) => at(T, B.bp, 0.04, 0.2) * (1 - at(T, B.fat, 0, 0.14))
export const fatScale = (T: number) => at(T, B.fat, 0.3, 0.44) * (1 - at(T, B.dial, 0, 0.12))

interface BeadPlan {
  n: number
  stations: readonly number[]
  /** appear window, then one [start, end] slide per later station, beat-local */
  appear: readonly [number, number]
  moves: readonly (readonly [number, number])[]
}
const BP_PLAN: BeadPlan = { n: B.bp, stations: BP_STATIONS, appear: [0.26, 0.34], moves: [[0.4, 0.58], [0.68, 0.86]] }
const FAT_PLAN: BeadPlan = { n: B.fat, stations: FAT_STATIONS, appear: [0.44, 0.5], moves: [[0.55, 0.67], [0.74, 0.88]] }

function beadU(T: number, p: BeadPlan): number {
  let u = p.stations[0]
  p.moves.forEach(([a, b], k) => {
    u += (p.stations[k + 1] - p.stations[k]) * at(T, p.n, a, b, ease.morph)
  })
  return u
}
/** The bead's scale (it snaps onto the line) and its exit at the start of C3. */
function beadAppear(T: number, p: BeadPlan): number {
  return at(T, p.n, p.appear[0], p.appear[1], ease.snap) * (1 - at(T, B.dial, 0, 0.14))
}
/** Which station callout shows: k = 0, 1, 2, each while the bead rests there. */
function beadCallout(T: number, p: BeadPlan, k: number): number {
  const on = k === 0 ? at(T, p.n, p.appear[0] + 0.02, p.appear[1] + 0.04) : at(T, p.n, p.moves[k - 1][1] - 0.02, p.moves[k - 1][1] + 0.04)
  const off = k < p.moves.length ? at(T, p.n, p.moves[k][0], p.moves[k][0] + 0.05) : at(T, p.n + 1, 0, 0.12)
  return on * (1 - off)
}
/** A bead glows (the speaking element) while it slides. */
function beadHot(T: number, p: BeadPlan): number {
  let h = pulse(T, p.n + p.appear[0], p.n + p.appear[1] + 0.06)
  for (const [a, b] of p.moves) h = Math.max(h, pulse(T, p.n + a - 0.02, p.n + b + 0.03))
  return h
}

export const bpBead = {
  u: (T: number) => beadU(T, BP_PLAN),
  appear: (T: number) => beadAppear(T, BP_PLAN),
  callout: (T: number, k: number) => beadCallout(T, BP_PLAN, k),
  hot: (T: number) => beadHot(T, BP_PLAN),
  row: BP,
}
export const fatBead = {
  u: (T: number) => beadU(T, FAT_PLAN),
  appear: (T: number) => beadAppear(T, FAT_PLAN),
  callout: (T: number, k: number) => beadCallout(T, FAT_PLAN, k),
  hot: (T: number) => beadHot(T, FAT_PLAN),
  row: BODY_FAT,
}
/** C2 claim: LOWER IS BETTER, as the bead settles on 10%. */
export const betterCallout = (T: number) => at(T, B.fat, 0.88, 0.98, ease.settle) * (1 - at(T, B.dial, 0, 0.12))

/**
 * World y of row i at T. The one line sits at the centre (C0, C1); in C2 it
 * moves up by Y_PAIR and body fat draws Y_PAIR below the centre; in C3 both
 * slide into their slots while the other eight rows cascade in.
 */
export function rowYAt(T: number, i: number): number {
  const slot = rowY(i)
  const settle = at(T, B.dial, 0.02, 0.3, ease.morph)
  if (i === BP) {
    const y = Y_PAIR * at(T, B.fat, 0, 0.25, ease.morph)
    return y + (slot - y) * settle
  }
  if (i === BODY_FAT) return -Y_PAIR + (slot + Y_PAIR) * settle
  return slot
}

/* -------------------------------- C3 --------------------------------- */

/** The eight rows that cascade in at C3, top to bottom. */
export const CASCADE = Array.from({ length: N }, (_, i) => i).filter((i) => i !== BP && i !== BODY_FAT)
const cascadeSlot = (i: number) => CASCADE.indexOf(i)

/** Draw-on progress of row i. */
export function rowDraw(T: number, i: number): number {
  if (i === BP) return lineDraw(T)
  if (i === BODY_FAT) return fatDraw(T)
  return stagger(T, B.dial + 0.02, B.dial + 0.36, cascadeSlot(i), CASCADE.length, 0.3, ease.draw)
}
/** The morph: row i swings into its spoke (a small stagger along the index, so it flows). */
export const morphK = (T: number, i: number) => stagger(T, B.dial + 0.44, B.dial + 0.86, i, N, 0.22, ease.morph)
export const morphAny = (T: number) => at(T, B.dial, 0.44, 0.86)
/** Row names (the parallel phase) leave as the morph starts. */
export const rowNamesOut = (T: number) => 1 - at(T, B.dial, 0.4, 0.47)
/** The zone disc (spectrum, faint) fades in under the finished dial. */
export const discIn = (T: number) => at(T, B.dial, 0.76, 1.0, ease.settle)
/** Spoke-tip names. */
export const tipNames = (T: number) => at(T, B.dial, 0.86, 0.98)
/** The portrait key (P) fades in at 0.85. */
export const keyIn = (T: number) => at(T, B.dial, 0.85, 1)
/** SICKNESS names the centre when the dial lands, until the profile climbs out of it. */
export const centreCallout = (T: number) => at(T, B.dial, 0.9, 1.0) * (1 - at(T, B.well, 0.26, 0.34))

/* ------------------------------- C4 to C6 ----------------------------- */

/** Spokes rest dimmed once they are the instrument behind the person (construction). */
export const spokeRest = (T: number) => 1 - 0.42 * at(T, B.well, 0.05, 0.35)

const climbWell = (T: number, i: number) => stagger(T, B.well + 0.3, B.well + 0.7, i, N, 0.3, ease.settle)
const climbAthlete = (T: number, i: number) => stagger(T, B.sup + 0.15, B.sup + 0.75, i, N, 0.3, ease.morph)

/** Where the person's dot on spoke i sits at T (0 before it climbs out of the pit). */
export function personPos(T: number, i: number): number {
  if (T < B.sup) return AVERAGE.positions[i] * climbWell(T, i)
  return AVERAGE.positions[i] + (ATHLETE.positions[i] - AVERAGE.positions[i]) * climbAthlete(T, i)
}
/** Dot scale: each dot grows in as it leaves the hub. */
export const dotAppear = (T: number, i: number) => Math.min(1, climbWell(T, i) * 5)
/** The person exists from the C4 climb on. */
export const personOn = (T: number) => (T >= B.well + 0.3 ? 1 : 0)

const _pos = new Float64Array(N)
/** Mean of the live positions (allocation-free). */
export function personMean(T: number): number {
  for (let i = 0; i < N; i++) _pos[i] = personPos(T, i)
  let s = 0
  for (let i = 0; i < N; i++) s += _pos[i]
  return s / N
}

export const outlineDraw = (T: number) => at(T, B.well, 0.62, 0.84, ease.draw)
export const fillIn = (T: number) => at(T, B.well, 0.68, 0.88, ease.settle)
export const orbOn = (T: number) => at(T, B.well, 0.84, 0.94, ease.settle)
export const wordRise = (T: number) => at(T, B.well, 0.86, 1.0, ease.settle)
/** C5: the WELL polygon stays behind as a dashed ghost. */
export const ghostIn = (T: number) => at(T, B.sup, 0.0, 0.15)
/** C5: the orb and the word move to the new state once the climb lands. */
export const wordSwap = (T: number) => at(T, B.sup, 0.75, 0.95, ease.morph)

const WELL_MEAN = meanOf(AVERAGE.positions)
const ATH_MEAN = meanOf(ATHLETE.positions)
const idxOf = (m: number) => STATES.findIndex((s) => s.word === stateWord(m).word)
/** State words of the two profiles (computed: WELL, then FIT for the athlete mean, F.4). */
export const WORD_WELL = idxOf(WELL_MEAN)
export const WORD_ATHLETE = idxOf(ATH_MEAN)

/** Opacity of state word k at T (the SDF layer). */
export function wordVis(T: number, k: number): number {
  const rise = wordRise(T)
  const sw = wordSwap(T)
  let v = 0
  if (k === WORD_WELL) v += rise * (1 - sw)
  if (k === WORD_ATHLETE) v += rise * sw
  return Math.min(1, v)
}

/** C6: the band between the WELL circle and the athlete polygon lights; then the pit darkens. */
export const bandOn = (T: number) => at(T, B.hedge, 0.1, 0.7, ease.settle)
export const pitDark = (T: number) => at(T, B.hedge, 0.7, 1.0, ease.settle)
export const preventiveCallout = (T: number) => at(T, B.hedge, 0.56, 0.7, ease.settle)

/** HUD chip (L) and key header: the score shows from the C4 climb. */
export const scoreOn = (T: number) => at(T, B.well, 0.3, 0.42)
