import { at, pulse, stagger } from '../../story/cue'
import { ease, type Ease } from '../../story/ease'
import { ATHLETE, AVERAGE, BODY_FAT, BP, BP_STATIONS, FAT_STATIONS, N, STATES, meanOf, stateWord } from './continuumMath'
import { Y_PAIR, rowY } from './layout'

/* =========================================================================
   The Continuum story as pure functions of story time T (L5). The scene,
   the labels, the HUD chip and the portrait key all read these, so a deep
   link, a scrub and autoplay land on the same frame.

     C0 one-line  a hot pen draws one line in the spectrum; columns of light
                  rise from its stations to the edges of the stage: SICKNESS,
                  WELLNESS, FITNESS head them
     C1 bp        the line becomes systolic blood pressure; a bead reads the
                  three worked examples and leaves a footprint at each
     C2 bodyfat   a second marker under the same columns, LOWER IS BETTER
     C3 dial      eight more rows cascade in, each named at its fitness end;
                  the table holds (about two seconds of readable values),
                  then all ten swing into a full circle with their names
                  riding their tips (signature)
     C4 well      the camera tilts: the centre is a pit of SICKNESS, and the
                  key lists every marker at its sick value. The average
                  profile climbs out of the pit and lands on the WELL circle
     C5 super     the same markers climb to the CrossFit athlete; the word
                  changes (and the impact accent fires) the moment the score
                  crosses into FIT
     C6 hedge     the margin between WELL and the athlete lights
   ========================================================================= */

export const B = { line: 0, bp: 1, fat: 2, dial: 3, well: 4, sup: 5, hedge: 6 } as const

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

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

/* ----------------------- C0 to C3: columns of light ------------------ */

/** The table holds for about two seconds of readable values, then row i swings into its spoke. */
export const MORPH_A = 0.62
export const MORPH_B = 0.93

/**
 * The station columns (sick, well, fit, elite): light that rises and falls
 * from the line as the pen passes each station, out to the edges of the
 * stage. The fit column (0.82, the one without a header) joins with the
 * blood pressure scale, as a dim tick guide. They hand over to the table's
 * own columns (thin connectors that the morph bends into rings).
 */
const GUIDE_AT = [LINE_CROSS[0], LINE_CROSS[1], -1, LINE_CROSS[2]]
export function guideGrow(T: number, s: number): number {
  const g = s === 2 ? at(T, B.bp, 0.04, 0.3) : clamp01((T - GUIDE_AT[s]) / 0.3)
  return ease.settle(g)
}
/** The light columns fade as the morph begins (the connectors carry it into rings). */
export const columnsOut = (T: number) => 1 - at(T, B.dial, MORPH_A - 0.06, MORPH_A + 0.02)
/** Their crisp core hands over to the table's connectors as the cascade draws them. */
export const columnCore = (T: number) => 1 - at(T, B.dial, 0.1, 0.3)
/** Their bright plateau spans the drawn rows: the one line, the pair, then the whole table. */
export const tableSpan = (T: number) => at(T, B.dial, 0.08, 0.3, ease.settle)
/** The three C0 claims land at the column tops, in order, and head the columns until the table arrives. */
export const c0Callout = (T: number, k: number) => at(T, B.line, 0.62 + 0.08 * k, 0.72 + 0.08 * k, ease.settle) * (1 - at(T, B.dial, 0, 0.1))

/* ------------------------------ C1, C2 ------------------------------- */

/** Row 2 (body fat) draws with its own pen. */
export const fatDraw = (T: number) => at(T, B.fat, 0.16, 0.4, ease.draw)
/** The featured rows are drawn heavier (the hero pen) until the other rows arrive. */
export const heroOut = (T: number) => 1 - at(T, B.dial, 0.0, 0.12)

/** The featured rows' scales (tick values): blood pressure stays through C2, so every column pairs a BP value with a body fat value. */
export const bpScale = (T: number) => at(T, B.bp, 0.04, 0.2) * (1 - at(T, B.dial, 0, 0.08))
export const fatScale = (T: number) => at(T, B.fat, 0.3, 0.44) * (1 - at(T, B.dial, 0, 0.08))
/** Names of the featured rows (at their start, as headers) until the table names every row at its fitness end. */
export const bpName = (T: number) => at(T, B.bp, 0.06, 0.2) * (1 - at(T, B.dial, 0, 0.07))
export const fatName = (T: number) => at(T, B.fat, 0.3, 0.44) * (1 - at(T, B.dial, 0, 0.07))

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
  for (let k = 0; k < p.moves.length; k++) u += (p.stations[k + 1] - p.stations[k]) * at(T, p.n, p.moves[k][0], p.moves[k][1], ease.morph)
  return u
}
/** Everything the beads leave behind exits as the table arrives. */
const beadsOut = (T: number) => 1 - at(T, B.dial, 0, 0.1)
/** The bead's scale (it snaps onto the line). */
function beadAppear(T: number, p: BeadPlan): number {
  return at(T, p.n, p.appear[0], p.appear[1], ease.snap) * beadsOut(T)
}
/** The live reading k = 0, 1, 2 rides the bead while it rests at station k. */
function beadCallout(T: number, p: BeadPlan, k: number): number {
  const on = k === 0 ? at(T, p.n, p.appear[0] + 0.02, p.appear[1] + 0.04) : at(T, p.n, p.moves[k - 1][1] - 0.02, p.moves[k - 1][1] + 0.04)
  const off = k < p.moves.length ? at(T, p.n, p.moves[k][0], p.moves[k][0] + 0.05) : 1 - beadsOut(T)
  return on * (1 - off)
}
/**
 * A footprint: when the bead leaves station k, a small ghost dot and the
 * reading stay behind (the reading dimmed on its opaque plate), so the
 * finished frame shows all three worked examples on the line. The last
 * station keeps the bead itself.
 */
function beadPrint(T: number, p: BeadPlan, k: number): number {
  if (k >= p.moves.length) return 0
  return at(T, p.n, p.moves[k][0], p.moves[k][0] + 0.08) * beadsOut(T)
}
/** A bead glows (the speaking element) while it slides. */
function beadHot(T: number, p: BeadPlan): number {
  let h = pulse(T, p.n + p.appear[0], p.n + p.appear[1] + 0.06)
  for (let k = 0; k < p.moves.length; k++) h = Math.max(h, pulse(T, p.n + p.moves[k][0] - 0.02, p.n + p.moves[k][1] + 0.03))
  return h
}

const bead = (p: BeadPlan, row: number) => ({
  u: (T: number) => beadU(T, p),
  appear: (T: number) => beadAppear(T, p),
  callout: (T: number, k: number) => beadCallout(T, p, k),
  print: (T: number, k: number) => beadPrint(T, p, k),
  hot: (T: number) => beadHot(T, p),
  stations: p.stations,
  row,
})
export const bpBead = bead(BP_PLAN, BP)
export const fatBead = bead(FAT_PLAN, BODY_FAT)
/** C2 claim: LOWER IS BETTER, as the bead settles on 10%. */
export const betterCallout = (T: number) => at(T, B.fat, 0.88, 0.98, ease.settle) * (1 - at(T, B.dial, 0, 0.1))

/**
 * World y of row i at T. The one line sits at the centre (C0, C1); in C2 it
 * moves up by Y_PAIR and body fat draws Y_PAIR below the centre; at the start
 * of C3 both settle into their slots BEFORE the other eight rows cascade in,
 * so no row crosses another.
 */
export function rowYAt(T: number, i: number): number {
  const slot = rowY(i)
  const settle = at(T, B.dial, 0.0, 0.1, ease.morph)
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
const CASCADE_SLOT = Array.from({ length: N }, (_, i) => CASCADE.indexOf(i))
const CASCADE_A = 0.08
const CASCADE_B = 0.3

/** Draw-on progress of row i. */
export function rowDraw(T: number, i: number): number {
  if (i === BP) return lineDraw(T)
  if (i === BODY_FAT) return fatDraw(T)
  return stagger(T, B.dial + CASCADE_A, B.dial + CASCADE_B, CASCADE_SLOT[i], CASCADE.length, 0.3, ease.draw)
}
/** Index (in CASCADE) of the newest row still drawing, or -1: only its pen head is hot (L4). */
export function newestDrawing(T: number): number {
  let best = -1
  for (let j = 0; j < CASCADE.length; j++) {
    const d = rowDraw(T, CASCADE[j])
    if (d > 0 && d < 1) best = j
  }
  return best
}

/**
 * The rows move together, as one instrument unfolding, with a slight lead
 * in the order of each tip's sweep: the two rows whose tips turn
 * counter-clockwise (Resting HR, Systolic BP) lead top first, the eight
 * that turn clockwise bottom first (Flexibility sweeps furthest). A tip that
 * travels further always starts earlier, so no tip ever catches the one
 * ahead of it: the names ride tips that never meet.
 */
const MORPH_SLOT = Array.from({ length: N }, (_, i) => (i < 2 ? i : N - 1 - i))
const MORPH_SLOTS = Math.max(...MORPH_SLOT) + 1
export const morphK = (T: number, i: number) => stagger(T, B.dial + MORPH_A, B.dial + MORPH_B, MORPH_SLOT[i], MORPH_SLOTS, 0.12, ease.draw)
/** The table's left edge gathers into the hub as one (layout.ts rowXf `g`). */
export const gatherK = (T: number) => at(T, B.dial, MORPH_A, MORPH_B, ease.draw)
/** Each row's name rides its fitness end from the moment the pen reaches it. */
export function nameOn(T: number, i: number): number {
  if (i === BP) return at(T, B.dial, 0.05, 0.13)
  if (i === BODY_FAT) return at(T, B.dial, 0.07, 0.15)
  return clamp01((rowDraw(T, i) - 0.82) / 0.18)
}
/** The table's reading: the sick and elite values of the rows the caption names, and HDL's direction (about two seconds at full). */
export const tableValues = (T: number) => at(T, B.dial, 0.27, 0.33) * (1 - at(T, B.dial, MORPH_A - 0.03, MORPH_A + 0.02))
/** The zone disc (spectrum, faint) fades in under the finished dial. */
export const discIn = (T: number) => at(T, B.dial, 0.8, 1.0, ease.settle)
/** The portrait key arrives WITH the tilt (C4), listing every marker at its sick value: the pit. The values then climb with the dots. */
export const keyIn = (T: number) => at(T, B.well, 0.12, 0.3)
/** ... and folds to its header row as the last beat begins (the claim takes the room under the dial). */
export const keyFold = (T: number) => at(T, B.hedge, 0.0, 0.2, ease.settle)
/**
 * SICKNESS names the centre when the dial lands and stays through the tilt
 * that reveals it as a pit; it leaves as the dots climb out of it.
 */
export const centreCallout = (T: number) => at(T, B.dial, 0.92, 1.0) * (1 - at(T, B.well, 0.4, 0.48))
/** FITNESS names the rim in the finished dial, until the camera tilts. */
export const rimCallout = (T: number) => at(T, B.dial, 0.94, 1.0) * (1 - at(T, B.well, 0.0, 0.1))
/** WELL names its circle until the person's own outline draws on it (the SDF word then names the level). */
export const wellName = (T: number) => at(T, B.dial, 0.93, 1.0) * (1 - at(T, B.well, 0.66, 0.74))
/** FIT names its circle in the finished dial only (the word FIT belongs to the score band from C5). */
export const fitName = (T: number) => at(T, B.dial, 0.93, 1.0) * (1 - at(T, B.well, 0.0, 0.1))
/** The rings close at the end of the morph. */
export const ringsClose = (T: number) => at(T, B.dial, 0.87, 0.97, ease.draw)

/* ------------------------------- C4 to C6 ----------------------------- */

/** Spokes rest dimmed once they are the instrument behind the person (construction). */
export const spokeRest = (T: number) => 1 - 0.42 * at(T, B.well, 0.05, 0.35)
/** The pit's shadow deepens with the tilt (the centre reads darker and deeper); it eases as the camera returns toward front-on. */
export const pitShade = (T: number) => at(T, B.well, 0.05, 0.32, ease.settle) * (1 - 0.35 * at(T, B.sup, 0.0, 0.3))
/** The WELL circle steps back once the person's own outline (then the dashed ghost) marks that level. */
export const wellRingRest = (T: number) => 1 - 0.78 * at(T, B.well, 0.68, 0.8)
/**
 * The depth contours: a topographic reading of the pit, so they read only
 * while the camera looks INTO it (the C4 tilt). Front-on they would read as
 * the gridlines of a scale that is not there, so they are faint in C3 and
 * leave as the camera returns toward front-on for the comparison.
 */
export const isoOf = (T: number) => 0.05 + 0.36 * at(T, B.well, 0.05, 0.32) * (1 - 0.9 * at(T, B.sup, 0, 0.3))

const CLIMB_A = 0.42
const CLIMB_B = 0.74
const climbWell = (T: number, i: number) => stagger(T, B.well + CLIMB_A, B.well + CLIMB_B, i, N, 0.3, ease.settle)
const climbAthlete = (T: number, i: number) => stagger(T, B.sup + 0.15, B.sup + 0.75, i, N, 0.3, ease.morph)

/** Where the person's dot on spoke i sits at T (0 before it climbs out of the pit). */
export function personPos(T: number, i: number): number {
  if (T < B.sup) return AVERAGE.positions[i] * climbWell(T, i)
  return AVERAGE.positions[i] + (ATHLETE.positions[i] - AVERAGE.positions[i]) * climbAthlete(T, i)
}
/** Dot scale: each dot grows in as it leaves the hub. */
export const dotAppear = (T: number, i: number) => Math.min(1, climbWell(T, i) * 5)
/** The person exists from the C4 climb on. */
export const personOn = (T: number) => (T >= B.well + CLIMB_A ? 1 : 0)
/** Changes exactly when some position can change (cached outline writers key on it): the two climbs. */
export function personKey(T: number): number {
  if (T < B.well + CLIMB_A) return -1
  if (T < B.sup) return Math.min(T, B.well + CLIMB_B)
  return Math.min(Math.max(T, B.sup + 0.15), B.sup + 0.75)
}

/** Mean of the live positions (allocation-free). */
export function personMean(T: number): number {
  let s = 0
  for (let i = 0; i < N; i++) s += personPos(T, i)
  return s / N
}

export const outlineDraw = (T: number) => at(T, B.well, 0.68, 0.86, ease.draw)
export const fillIn = (T: number) => at(T, B.well, 0.72, 0.9, ease.settle)
export const orbOn = (T: number) => at(T, B.well, 0.86, 0.96, ease.settle)
export const wordRise = (T: number) => at(T, B.well, 0.86, 1.0, ease.settle)
/** C5: the WELL polygon stays behind as a dashed ghost. */
export const ghostIn = (T: number) => at(T, B.sup, 0.0, 0.15)

const WELL_MEAN = meanOf(AVERAGE.positions)
const ATH_MEAN = meanOf(ATHLETE.positions)
const idxOf = (m: number) => STATES.findIndex((s) => s.word === stateWord(m).word)
/** State words of the two profiles (computed: WELL, then FIT for the athlete mean, F.4). */
export const WORD_WELL = idxOf(WELL_MEAN)
export const WORD_ATHLETE = idxOf(ATH_MEAN)

/**
 * The story time in C5 at which the live score leaves the WELL band
 * (bisection on stateWord(personMean(T)); no threshold is typed here). The
 * word and the orb change exactly there, so every paused, scrubbed or
 * deep-linked frame shows stateWord of the score it displays. The C5 impact
 * accent (story.ts) fires from this moment too.
 */
export const T_SWAP = (() => {
  let lo = B.sup + 0.15
  let hi = B.sup + 0.75
  if (idxOf(personMean(hi)) === WORD_WELL) return hi
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2
    if (idxOf(personMean(m)) === WORD_WELL) lo = m
    else hi = m
  }
  return hi
})()
/** WELL sinks back into the pit and is gone at the crossing; the new word rises right after it. */
const wellSink = (T: number) => clamp01((T - (T_SWAP - 0.07)) / 0.07)
const newRise = (T: number) => ease.settle(clamp01((T - T_SWAP) / 0.1))
/** 0 (WELL) .. 1 (the athlete's state): the orb's colour. */
export const wordSwap = (T: number) => ease.morph(clamp01((T - (T_SWAP - 0.03)) / 0.09))

/** Opacity of state word k at T (the SDF layer). */
export function wordVis(T: number, k: number): number {
  if (k === WORD_WELL && k !== WORD_ATHLETE) return wordRise(T) * (1 - wellSink(T))
  if (k === WORD_ATHLETE && k !== WORD_WELL) return newRise(T)
  if (k === WORD_WELL) return wordRise(T)
  return 0
}
/** 0 (in the pit) .. 1 (risen in front of the dial), per word. */
export const wordLift = wordVis

/** C6: the band between the WELL circle and the athlete polygon lights; then the pit darkens. */
export const bandOn = (T: number) => at(T, B.hedge, 0.1, 0.7, ease.settle)
export const pitDark = (T: number) => at(T, B.hedge, 0.7, 1.0, ease.settle)
export const preventiveCallout = (T: number) => at(T, B.hedge, 0.56, 0.7, ease.settle)

/** HUD chip (L) and key header: the score shows with the pit (0 / 100) and climbs with the dots. */
export const scoreOn = (T: number) => at(T, B.well, 0.12, 0.3)
/** The spoke names are tappable (they highlight their spoke) once the key lists the values. */
export const spokesTappable = (T: number) => T >= B.well + 0.12
