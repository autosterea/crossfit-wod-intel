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
     P1 phosphagen  the rose band floods; the cursor sweeps 3 s to 10 s
     P2 glycolytic  the amber band floods; 10 s to 30 s (the lead flips here)
     P3 oxidative   the blue base floods; 30 s to 1 hr, pausing at 75 s and 10 min
     P4 power       the stack separates into three lanes on one scale (signature)
     P5 workouts    lanes back to the stack, benchmark pins, the cursor visits four
     P6 all-three   each engine's lead range is bracketed and lights its pins;
                    the cursor parks at Fran

   D.4 amendment (review r1): P1 ends at 10 s, the end of its own "0 to 10
   sec" string and still phosphagen-led (53%), and P2 sweeps 10 s to 30 s,
   so the callout turns from Phosphagen to Glycolytic inside the Glycolytic
   beat (at about 12 s), as the P2 caption and D.4's P2 cue describe.
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
export const ghostOn = (T: number, b: number) => (T < P.three + 0.36 ? 0 : 1 - at(T, FLOOD_BEAT[b], 0.3, 0.5))
/** An engine is introduced once its flood has started (the HUD dims the others). */
export const introduced = (T: number, b: number) => at(T, FLOOD_BEAT[b], 0.02, 0.3)

/* ----------------------------- P4 / P5 lanes --------------------------- */

/** 0 stacked, 1 lanes: P4 separates, P5 returns (D.4). */
export const lanesM = (T: number) => at(T, P.power, 0, 0.45, ease.morph) - at(T, P.workouts, 0, 0.3, ease.morph)
/** The chalk envelope means total power: it steps aside while the stack is apart. */
export const envOn = (T: number) => 1 - at(T, P.power, 0, 0.18) + at(T, P.workouts, 0.12, 0.3)
export const laneLines = (T: number) => at(T, P.power, 0.3, 0.5) * (1 - at(T, P.workouts, 0, 0.18))
export const laneNames = (T: number) => at(T, P.power, 0.45, 0.6) * (1 - at(T, P.workouts, 0, 0.14))
export const orderClaim = (T: number) => at(T, P.power, 0.6, 0.76) * (1 - at(T, P.workouts, 0, 0.14))
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
/** Arrival of each P5 stop (beat t); the cursor snaps there over the 0.06 before it. */
export const STOP_AT = [0.47, 0.6, 0.73, 0.86] as const
const MOVE = 0.06
/** P6: the cursor parks at Fran. */
export const FRAN_PIN = pinIndex('Fran')
const FRAN_U = pinU('Fran', uOf(240))

/** P3: 30 s to 1 hr, pausing (flat 0.06) at 75 s and 10 min (D.4). */
function sweepP3(T: number): number {
  const a = at(T, P.oxi, 0.35, 0.442, ease.draw)
  const b = at(T, P.oxi, 0.502, 0.71, ease.draw)
  const c = at(T, P.oxi, 0.77, 0.95, ease.draw)
  return U30 + (U75 - U30) * a + (U600 - U75) * b + (1 - U600) * c
}

/** u of the cursor at story time T. */
export function cursorU(T: number): number {
  if (T < P.gly) return U10 * at(T, P.phos, 0.35, 0.9)
  if (T < P.oxi) return U10 + (U30 - U10) * at(T, P.gly, 0.35, 0.9)
  if (T < P.power) return sweepP3(T)
  if (T < P.workouts + 0.4) return 1
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
export const cursorOn = (T: number) => at(T, P.phos, 0.33, 0.4) * (1 - at(T, P.power, 0, 0.12)) + at(T, P.workouts, 0.44, 0.47)
/** Photo-finish flash at each P5 arrival and at the P6 park. */
export function cursorFlash(T: number): number {
  let f = 0
  for (let k = 0; k < STOP_AT.length; k++) f = Math.max(f, pulse(T, P.workouts + STOP_AT[k] - 0.004, P.workouts + STOP_AT[k] + 0.04))
  return Math.max(f, pulse(T, P.all + 0.836, P.all + 0.876))
}
/** The P1 to P3 cursor callout (its colour is the engine that dominates under the cursor). */
export const curCallout = (T: number) => at(T, P.phos, 0.38, 0.46) * (1 - at(T, P.power, 0, 0.1))

/** HUD (D.4): from P1 onward, while there is a cursor to read. */
export const hudOn = (T: number) => at(T, P.phos, 0.3, 0.4) * (1 - at(T, P.power, 0, 0.15)) + at(T, P.workouts, 0.42, 0.5)

/* --------------------------------- P5 ---------------------------------- */

/** Pin k drops (snap, 70 ms stagger). */
export const pinDrop = (T: number, k: number) => stagger(T, P.workouts + 0.25, P.workouts + 0.45, k, PINS.length, 0.45, ease.snap)
/** Result chip of stop k: from its arrival to the next one (the last stays; it leaves as P6 starts). */
export function resultOn(T: number, k: number): number {
  const a = at(T, P.workouts, STOP_AT[k] - 0.01, STOP_AT[k] + 0.02)
  const next = k + 1 < STOP_AT.length ? at(T, P.workouts, STOP_AT[k + 1] - MOVE, STOP_AT[k + 1] - MOVE + 0.015) : at(T, P.all, 0.62, 0.7)
  return a * (1 - next)
}
/** The P6 Fran chip. */
export const franChip = (T: number) => at(T, P.all, 0.86, 0.94)
/** The pin name cue (the result chip, or the Fran chip, replaces the name it describes). */
export const pinNameOn = (T: number, k: number) => at(T, P.workouts, 0.34 + 0.012 * k, 0.44 + 0.012 * k) * Math.max(0.6, focus(T, P.workouts))

/* --------------------------------- P6 ---------------------------------- */

/** Bracket k (axis order: phosphagen, glycolytic, oxidative) draws with a 150 ms stagger. */
export const bracketDraw = (T: number, k: number) => at(T, P.all, 0.1 + 0.03 * k, 0.36 + 0.03 * k, ease.draw)
/** Each band pulses once, in sequence (x1.4 for 0.08). */
export const bracketPulse = (T: number, k: number) => pulse(T, P.all + 0.42 + 0.09 * k, P.all + 0.5 + 0.09 * k)
/** A pin lights with the bracket of the engine that leads its range (the workouts span all three). */
export const pinLit = (T: number, k: number) => bracketPulse(T, PIN_SLOT[k])
/** The bracket names replace the duration strings under the axis in P6 (the strings leave first, so the row never holds both). */
export const bracketNames = (T: number) => at(T, P.all, 0.2, 0.34)
export const legendOut = (T: number) => at(T, P.all, 0.08, 0.18)

/* ------------------------- duration strips & strings -------------------- */

/** Strip / string k (axis order) appears with its engine's beat and stays. */
export const STRIP_BEAT = [P.phos, P.gly, P.oxi] as const
export const stripOn = (T: number, k: number) => at(T, STRIP_BEAT[k], 0.28, 0.42)
