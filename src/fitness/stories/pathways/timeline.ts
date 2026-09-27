import { at, focus, pulse, stagger } from '../../story/cue'
import { ease } from '../../story/ease'
import { FLOOD_W } from './bands'
import { PINS, PIN_SLOT, pinIndex, tOf, uOf } from './pathwaysMath'

/* =========================================================================
   The Pathways story clock: every visible property is a pure function of
   story time T = beat + t (L5), built from cue windows, so a deep link, a
   scrub and autoplay render the same pixels and (N, 1) = (N + 1, 0).

     P0 three       axes, then the chalk envelope: power falls with duration;
                    three dim engines glow under it
     P1 phosphagen  the rose band floods; the cursor reads 3 s, stamps it,
                    then sweeps to 10 s
     P2 glycolytic  the amber band floods; 10 s to 30 s (the lead flips here)
     P3 oxidative   the blue base floods; 30 s to 1 hr, holding at 75 s (the
                    caption's number, stamped) and pausing at 10 min
     P4 power       the stack separates into three lanes on one scale (signature)
     P5 workouts    lanes back to the stack, benchmark pins, the cursor visits
                    four; a visited result stays as a tag
     P6 all-three   the three duration brackets draw and light their pins;
                    the cursor parks at Fran

   D.4 amendments (review r1, r2; recorded in the chapter report):
   - P1 ends at 10 s, the end of its own "0 to 10 sec" string and still
     phosphagen-led (53%), and P2 sweeps 10 s to 30 s, so the callout turns
     from Phosphagen to Glycolytic inside the Glycolytic beat (about 12 s).
   - A reading the caption leans on is STAMPED: when the cursor leaves it,
     its callout stays behind, dimmed (a ghost), while the live callout
     dips and comes back at the cursor. P1 stamps 3 s (88%), so its resting
     frame shows the fall to 53%; P3 holds 75 s for 0.17 (D.4: 0.06) and
     stamps it, so the caption's "about 75 seconds" is on its end frame.
   - P5 runs 9.0 s (D.4: 6.5) with the stops 0.19 apart (D.4: 0.12), so
     each result chip is up for about 1.3 s, and a visited result collapses
     to a tag ("1RM Lift - Phosphagen") that holds through the beat, so the
     resting frame reads rose, amber, then blue across the axis.
   ========================================================================= */

export const P = { three: 0, phos: 1, gly: 2, oxi: 3, power: 4, workouts: 5, all: 6 } as const

/* -------------------------------- P0 ---------------------------------- */

export const axesDraw = (T: number) => at(T, P.three, 0, 0.26, ease.draw)
export const ticksDraw = (T: number) => at(T, P.three, 0.14, 0.32)
export const construct = (T: number) => at(T, P.three, 0.2, 0.36)
/** The chalk envelope, drawn left to right by a hot pen (arc fraction). */
export const envDraw = (T: number) => at(T, P.three, 0.35, 0.9, ease.draw)

/* ---------------------------- P1 to P3 floods -------------------------- */

/** The beat each band floods in (bands bottom to top: oxidative, glycolytic, phosphagen). */
export const FLOOD_BEAT = [P.oxi, P.gly, P.phos] as const
/** Flood front of band b in u (0 to 1 + FLOOD_W): left to right. */
export const front = (T: number, b: number) => at(T, FLOOD_BEAT[b], 0.05, 0.35, ease.draw) * (1 + FLOOD_W)
/** The band is being poured: its rim is the speaking element (L4). */
export const flooding = (T: number, b: number) => pulse(T, FLOOD_BEAT[b] + 0.04, FLOOD_BEAT[b] + 0.5)
/** Motes appear in a band only once it has flooded (D.4 River). */
export const moteOn = (T: number, b: number) => at(T, FLOOD_BEAT[b], 0.28, 0.44)
/**
 * P0's three engines, dim and unnamed, rising behind the envelope pen (the
 * caption: three engines, each dominating a different range). Each gives
 * way to its own flood, so the stack always reaches the floor and every
 * beat lights exactly one engine.
 */
export const dimEngineOn = (T: number, b: number) => (T < P.three + 0.36 ? 0 : 1 - at(T, FLOOD_BEAT[b], 0.3, 0.5))
/** An engine is introduced once its flood has started (the HUD dims the others). */
export const introduced = (T: number, b: number) => at(T, FLOOD_BEAT[b], 0.02, 0.3)

/* ----------------------------- P4 / P5 lanes --------------------------- */

/** 0 stacked, 1 lanes: P4 separates, P5 returns (D.4). */
export const lanesM = (T: number) => at(T, P.power, 0, 0.45, ease.morph) - at(T, P.workouts, 0, 0.22, ease.morph)
/**
 * The chalk envelope means total power: it steps aside while the stack is
 * apart. On the way back (P5) it follows the morph, so it shows only as the
 * stack re-forms under it (review r2: it cut across the falling lanes).
 */
export const envOn = (T: number) => {
  if (T < P.workouts) return 1 - at(T, P.power, 0, 0.18)
  // on only in the last 30% of the fall, as the bands close up under it
  const k = Math.max(0, 1 - lanesM(T) / 0.3)
  return k * k * (3 - 2 * k)
}
/** The lane baselines and each lane's own zero stub: they leave as soon as the lanes start to fall. */
export const laneLines = (T: number) => at(T, P.power, 0.3, 0.5) * (1 - at(T, P.workouts, 0, 0.05))
export const laneNames = (T: number) => at(T, P.power, 0.45, 0.6) * (1 - at(T, P.workouts, 0, 0.1))
export const orderClaim = (T: number) => at(T, P.power, 0.6, 0.76) * (1 - at(T, P.workouts, 0, 0.1))
/** "Power output" stays on through the lanes: the one power scale is the P4 claim (review r1). */
export const yTitle = (T: number) => construct(T)

/* -------------------------------- cursor ------------------------------- */

const U10 = uOf(10)
const U30 = uOf(30)
const U75 = uOf(75)
const U600 = uOf(600)
const pinU = (name: string, fallback: number) => {
  const i = pinIndex(name)
  return i >= 0 ? uOf(PINS[i].seconds) : fallback
}
/** P5 stops (D.4): 1RM Lift, 400m, Fran, 5k Run. */
export const STOP_NAMES = ['1RM Lift', '400m', 'Fran', '5k Run'] as const
export const STOP_PIN = STOP_NAMES.map((n) => pinIndex(n))
const STOP_U = STOP_NAMES.map((n, k) => pinU(n, [0, uOf(50), uOf(240), uOf(1320)][k]))
/** Arrival of each P5 stop (beat t); the cursor snaps there over the MOVE before it. */
export const STOP_AT = [0.34, 0.53, 0.72, 0.91] as const
const MOVE = 0.045
/** P6: the cursor parks at Fran. */
export const FRAN_PIN = pinIndex('Fran')
const FRAN_U = pinU('Fran', uOf(240))

/** P1: the cursor reads 3 s, holds, then stamps the reading and sweeps to 10 s. */
const P1_LEAVE = 0.5
/** P3: 30 s to 1 hr, holding at 75 s (0.17 of the beat) and pausing at 10 min (0.06). */
const P3_AT75 = 0.43
const P3_LEAVE = 0.6
function sweepP3(T: number): number {
  const a = at(T, P.oxi, 0.35, P3_AT75, ease.draw)
  const b = at(T, P.oxi, P3_LEAVE, 0.76, ease.draw)
  const c = at(T, P.oxi, 0.82, 0.95, ease.draw)
  return U30 + (U75 - U30) * a + (U600 - U75) * b + (1 - U600) * c
}

/** u of the cursor at story time T. */
export function cursorU(T: number): number {
  if (T < P.gly) return U10 * at(T, P.phos, P1_LEAVE, 0.9)
  if (T < P.oxi) return U10 + (U30 - U10) * at(T, P.gly, 0.35, 0.9)
  if (T < P.power) return sweepP3(T)
  if (T < P.workouts + 0.25) return 1
  if (T < P.all) {
    let u = STOP_U[0]
    for (let k = 1; k < STOP_U.length; k++) u += (STOP_U[k] - STOP_U[k - 1]) * at(T, P.workouts, STOP_AT[k] - MOVE, STOP_AT[k], ease.snap)
    return u
  }
  return STOP_U[3] + (FRAN_U - STOP_U[3]) * at(T, P.all, 0.7, 0.84, ease.morph)
}
/** Duration (s) under the cursor. */
export const cursorT = (T: number) => tOf(cursorU(T))
/** The cursor is on screen (P1 to P3, and from the first P5 stop). */
export const cursorOn = (T: number) => at(T, P.phos, 0.3, 0.36) * (1 - at(T, P.power, 0, 0.12)) + at(T, P.workouts, STOP_AT[0] - 0.03, STOP_AT[0])
/** Photo-finish flash at each P5 arrival and at the P6 park. */
export function cursorFlash(T: number): number {
  let f = 0
  for (let k = 0; k < STOP_AT.length; k++) f = Math.max(f, pulse(T, P.workouts + STOP_AT[k] - 0.004, P.workouts + STOP_AT[k] + 0.03))
  return Math.max(f, pulse(T, P.all + 0.836, P.all + 0.876))
}
/** The live callout dips where a reading is stamped: it leaves its ghost there and comes back at the moving cursor. */
const dip = (T: number, n: number, leave: number, back: number) => at(T, n, leave, leave + 0.03) * (1 - at(T, n, back, back + 0.04))
/** The P1 to P3 cursor callout (its colour is the engine that dominates under the cursor). */
export const curCallout = (T: number) =>
  at(T, P.phos, 0.34, 0.4) * (1 - at(T, P.power, 0, 0.1)) * (1 - dip(T, P.phos, P1_LEAVE, 0.6)) * (1 - dip(T, P.oxi, P3_LEAVE, 0.7))

/** The stamped readings (ghosts), in seconds: P1's start and P3's 75 s (the caption's number). */
export const GHOST_T = [3, 75] as const
/** Ghost g: stamped as the cursor leaves it; P1's holds through P1, P3's through P3. */
export const ghostOn = (T: number, g: number): number =>
  g === 0
    ? at(T, P.phos, P1_LEAVE, P1_LEAVE + 0.04) * (1 - at(T, P.gly, 0, 0.1))
    : at(T, P.oxi, P3_LEAVE, P3_LEAVE + 0.04) * (1 - at(T, P.power, 0, 0.1))

/** HUD (D.4): from P1 onward, while there is a cursor to read. */
export const hudOn = (T: number) => at(T, P.phos, 0.3, 0.4) * (1 - at(T, P.power, 0, 0.15)) + at(T, P.workouts, STOP_AT[0] - 0.04, STOP_AT[0] + 0.04)

/* --------------------------------- P5 ---------------------------------- */

/** Pin k drops (snap, 70 ms stagger). */
export const pinDrop = (T: number, k: number) => stagger(T, P.workouts + 0.17, P.workouts + 0.31, k, PINS.length, 0.45, ease.snap)
/** Result chip of stop k: from its arrival to the next one (the last stays; it leaves as P6 starts). */
export function resultOn(T: number, k: number): number {
  const a = at(T, P.workouts, STOP_AT[k] - 0.01, STOP_AT[k] + 0.02)
  const next = k + 1 < STOP_AT.length ? at(T, P.workouts, STOP_AT[k + 1] - MOVE, STOP_AT[k + 1] - MOVE + 0.015) : at(T, P.all, 0.62, 0.7)
  return a * (1 - next)
}
/** The stops whose result stays as a tag once the cursor moves on: 1RM Lift and 400m (the 5k chip carries the oxidative result). */
export const TAG_STOPS = [0, 1] as const
/** Tag of stop s: it takes over as that stop's chip leaves, holds through P5 and gives way to the pin names as P6 starts. */
export const tagOn = (T: number, s: number) =>
  at(T, P.workouts, STOP_AT[s + 1] - MOVE + 0.004, STOP_AT[s + 1] - MOVE + 0.03) * (1 - at(T, P.all, 0.02, 0.12))
/** The P6 Fran chip. */
export const franChip = (T: number) => at(T, P.all, 0.86, 0.94)
/**
 * Level of the pin names: full while the pins land; at the 5k stop the
 * names step back to 60% so the result chip, the tags and the curve lead
 * (review r2), and they come back up through P6 (continuous at the boundary).
 */
function nameLevel(T: number): number {
  if (T < P.all) return 1 - 0.4 * at(T, P.workouts, STOP_AT[3] - MOVE, STOP_AT[3])
  return Math.min(Math.max(0.6, focus(T, P.workouts)), 0.6 + 0.4 * at(T, P.all, 0.6, 1))
}
/** The pin name cue (a chip or a tag replaces the name it describes). */
export const pinNameOn = (T: number, k: number) => at(T, P.workouts, 0.25 + 0.01 * k, 0.33 + 0.01 * k) * nameLevel(T)

/* --------------------------------- P6 ---------------------------------- */

/** Bracket k (axis order: phosphagen, glycolytic, oxidative) draws with a 150 ms stagger. */
export const bracketDraw = (T: number, k: number) => at(T, P.all, 0.1 + 0.03 * k, 0.36 + 0.03 * k, ease.draw)
/** Each band pulses once, in sequence (x1.4 for 0.08). */
export const bracketPulse = (T: number, k: number) => pulse(T, P.all + 0.42 + 0.09 * k, P.all + 0.5 + 0.09 * k)
/** A pin lights with the pulse of its dominant engine (ENERGY_BENCHMARKS[].dominant): the workouts span all three. */
export const pinLit = (T: number, k: number) => bracketPulse(T, PIN_SLOT[k])

/* ------------------------- duration strips & strings -------------------- */

/** Strip / string k (axis order) appears with its engine's beat and stays. */
export const STRIP_BEAT = [P.phos, P.gly, P.oxi] as const
export const stripOn = (T: number, k: number) => at(T, STRIP_BEAT[k], 0.28, 0.42)
/** The duration strings' row is up (from P1): P0's axis title sits directly under the ticks until it arrives. */
export const keyRow = (T: number) => at(T, P.phos, 0.24, 0.4, ease.morph)
