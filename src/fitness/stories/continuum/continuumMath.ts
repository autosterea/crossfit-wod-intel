import * as THREE from 'three'
import { BIOMARKERS, CONTINUUM_EXAMPLES, CONTINUUM_PROFILES, PAL, markerValueAt, spectrum } from '../../fitnessData'

/* =========================================================================
   05 CONTINUUM math (DESIGN.md D.6 "Math"). `stateWord`, `fmtMarker` and
   `SHORT_NAME` are moved verbatim from modules/ContinuumModule.tsx; every
   number the scene draws comes from fitnessData (BIOMARKERS,
   CONTINUUM_PROFILES, CONTINUUM_EXAMPLES, markerValueAt, spectrum). The
   state word is ALWAYS computed from the mean (F.4: the CrossFit athlete
   mean is 0.8799999999999999, so FIT); nothing hard-codes it.
   ========================================================================= */

export const N = BIOMARKERS.length

/** Short forms of the marker names (verbatim from the module). Keyed by the full BIOMARKERS name. */
export const SHORT_NAME: Record<string, string> = {
  'Resting heart rate': 'Resting HR',
  'Systolic blood pressure': 'Systolic BP',
  'Body fat': 'Body fat',
  'VO2 max': 'VO2 max',
  'HDL cholesterol': 'HDL',
  Triglycerides: 'Triglyc.',
  'Fasting glucose': 'Glucose',
  'Bone density': 'Bone',
  'Relative strength': 'Rel. strength',
  Flexibility: 'Flexibility',
}

export interface StateWord {
  word: string
  css: string
  t: number
}

/** Overall mean toward fitness -> the patient's one-word state (L1 banding). Verbatim. */
export function stateWord(avg: number): StateWord {
  if (avg < 0.33) return { word: 'SICK', css: PAL.sick, t: 0.0 }
  if (avg < 0.62) return { word: 'WELL', css: PAL.well, t: 0.5 }
  if (avg < 0.88) return { word: 'FIT', css: PAL.fit, t: 0.82 }
  return { word: 'ROBUST', css: PAL.robust, t: 1.0 }
}

/** Format an interpolated marker value with sensible precision for its unit. Verbatim. */
export function fmtMarker(value: number, unit: string): string {
  const abs = Math.abs(value)
  let v: string
  if (unit === 'T-score' || unit === 'x BW deadlift') v = value.toFixed(2)
  else if (abs >= 100) v = Math.round(value).toString()
  else if (abs >= 10) v = value.toFixed(0)
  else v = value.toFixed(1)
  return `${v} ${unit}`
}

/** D.6: the mean in BIOMARKERS order; the state word is always stateWord(meanOf(...)). */
export const meanOf = (positions: ArrayLike<number>): number => {
  let s = 0
  for (let i = 0; i < positions.length; i++) s += positions[i]
  return s / positions.length
}

/** "toward fitness" score out of 100 (the module's readout: Math.round(mean * 100)). */
export const scoreOf = (mean: number): number => Math.round(mean * 100)

export const shortName = (i: number): string => SHORT_NAME[BIOMARKERS[i].name] ?? BIOMARKERS[i].name

/**
 * The four spokes that point left and right (18 and 162 degrees from the
 * horizontal). On a phone their names break onto two lines at the first
 * space ("Rel." over "strength"), the same SHORT_NAME, so the dial gets back
 * the width a one-line name would take beside the rim.
 */
export const SIDE_SPOKE = (i: number): boolean => Math.abs(Math.cos(((90 - 36 * i) * Math.PI) / 180)) > 0.9
export const shortName2 = (i: number): string => (SIDE_SPOKE(i) ? shortName(i).replace(' ', '\n') : shortName(i))

const profile = (name: string) => {
  const p = CONTINUUM_PROFILES.find((q) => q.name === name)
  if (!p) throw new Error('continuum: missing profile ' + name)
  return p
}
export const SEDENTARY = profile('Sedentary')
export const AVERAGE = profile('Average / well')
export const ATHLETE = profile('CrossFit athlete')
export const PROFILE_NAMES = CONTINUUM_PROFILES.map((p) => p.name)

/**
 * The four canonical positions of markerValueAt (sick, well, fit, elite).
 * These are the positions the rows tick and the dial's WELL / FIT circles sit at.
 */
export const STOPS = [0, 0.5, 0.82, 1] as const
export const STOP_WELL = STOPS[1]
export const STOP_FIT = STOPS[2]

/** The four state words the SDF layer can show, from the same banding (never typed by hand). */
export const STATES: StateWord[] = STOPS.map((p) => stateWord(p))
/** The same four colours as THREE colours (sRGB hex), for per-frame blending without parsing. */
export const STATE_COLORS: THREE.Color[] = STATES.map((s) => new THREE.Color(s.css))

/**
 * The lower edge of each band after the first, found once by bisection on
 * stateWord itself (no threshold is typed here), so a frame loop can read
 * the band index with plain comparisons and no allocation.
 */
const BAND_EDGES: number[] = STATES.slice(1).map((st) => {
  let lo = 0
  let hi = 1
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2
    if (STATES.findIndex((s) => s.word === stateWord(m).word) < STATES.indexOf(st)) lo = m
    else hi = m
  }
  return hi
})
/**
 * Index into STATES of stateWord(avg), allocation-free. Right at an edge
 * (the CrossFit athlete's mean is 0.8799999999999999, a hair under FIT's
 * upper edge) it asks stateWord itself, so it can never disagree with it.
 */
export function stateIndex(avg: number): number {
  let k = 0
  for (let e = 0; e < BAND_EDGES.length; e++) {
    if (Math.abs(avg - BAND_EDGES[e]) < 1e-9) return STATES.findIndex((s) => s.word === stateWord(avg).word)
    if (avg >= BAND_EDGES[e]) k = e + 1
  }
  return k
}

const num = (i: number, stop: number): string => String(Math.round(markerValueAt(BIOMARKERS[i], STOPS[stop]) * 1000) / 1000)
const withUnit = (i: number, v: string): string => (BIOMARKERS[i].unit === '%' ? v + '%' : v + ' ' + BIOMARKERS[i].unit)

/** A tick value at a stop, exactly as the data states it (no rounding), the unit on the elite tick only. */
export function tickText(i: number, stop: number): string {
  const s = num(i, stop)
  return stop < STOPS.length - 1 ? s : withUnit(i, s)
}

/** A reference value (a sick, well or fit stop) with its unit, for a scale read on its own. */
export const stopText = (i: number, stop: number): string => withUnit(i, num(i, stop))

export const BP = BIOMARKERS.findIndex((m) => m.name === 'Systolic blood pressure')
export const BODY_FAT = BIOMARKERS.findIndex((m) => m.name === 'Body fat')
export const HDL = BIOMARKERS.findIndex((m) => m.name === 'HDL cholesterol')
export const TRIGLYC = BIOMARKERS.findIndex((m) => m.name === 'Triglycerides')
export const BONE = BIOMARKERS.findIndex((m) => m.name === 'Bone density')

/**
 * The worked examples as the data writes them: CONTINUUM_EXAMPLES[0] gives
 * the three blood pressures ("160/95", "120/70", "105/55"), CONTINUUM_EXAMPLES[1]
 * the three body fat values (40, 20 and 10 percent).
 */
export const BP_READINGS: string[] = CONTINUUM_EXAMPLES[0].match(/\d+\/\d+/g) ?? []
export const FAT_READINGS: number[] = (CONTINUUM_EXAMPLES[1].match(/(\d+) percent/g) ?? []).map((s) => parseInt(s, 10))

/** Position on a marker's line where markerValueAt equals v (bisection; the line is monotone). */
export function positionOf(i: number, v: number): number {
  const m = BIOMARKERS[i]
  const up = markerValueAt(m, 1) > markerValueAt(m, 0)
  let lo = 0
  let hi = 1
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2
    const x = markerValueAt(m, mid)
    if (up ? x < v : x > v) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Body fat bead stations: 40% at 0, 20% at 0.5, 10% at 0.91 (where markerValueAt = 10). */
export const FAT_STATIONS: number[] = FAT_READINGS.map((v) => positionOf(BODY_FAT, v))
/** Blood pressure bead stations: pathological (0), healthy (0.5), athlete (1). */
export const BP_STATIONS: number[] = [STOPS[0], STOPS[1], STOPS[3]]

/* ------------------------------ colour -------------------------------- */

const _c = new THREE.Color()
/** spectrum(t) as LINEAR rgb (what pens, dots and shaders expect), written into out. */
export function spectrumLinear(t: number, out: THREE.Color = _c): THREE.Color {
  const [r, g, b] = spectrum(t)
  return out.setRGB(r, g, b, THREE.SRGBColorSpace)
}

const _hex = new THREE.Color()
/** CSS colour of spectrum(t) (a module scratch colour: only the string is new). */
export function spectrumHex(t: number): string {
  return '#' + spectrumLinear(t, _hex).getHexString()
}

/** Better direction callout text, from betterDirection. */
export const betterText = (i: number): string => (BIOMARKERS[i].betterDirection === 'lower' ? 'LOWER IS BETTER' : 'HIGHER IS BETTER')

/**
 * The live value of marker i at position p, formatted as the module formats
 * it (fmtMarker, verbatim), with a percentage written the way the ticks and
 * the worked examples write it ("20%", not "20 %"), so the chapter prints
 * one unit one way.
 */
export const valueText = (i: number, p: number): string => {
  const s = fmtMarker(markerValueAt(BIOMARKERS[i], p), BIOMARKERS[i].unit)
  return BIOMARKERS[i].unit === '%' ? s.replace(' %', '%') : s
}
