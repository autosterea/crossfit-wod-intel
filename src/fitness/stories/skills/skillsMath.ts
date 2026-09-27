import { ARCHETYPES, PAL, SKILLS, type Archetype, type SkillClass } from '../../fitnessData'

/* =========================================================================
   01 SKILLS math (DESIGN.md D.2 "Math", G "Kept"). `rangeOf` and `angleAt`
   move here verbatim from the legacy SkillsModule; `breadthOf` (the mean,
   "Fitness breadth") is deleted everywhere (decision 9, F.3). The readouts
   are the weakest skill (the floor) and the range. Every number drawn in
   the chapter comes from ARCHETYPES and SKILLS through these helpers.
   ========================================================================= */

/** Ten skills, one spoke each. */
export const N = SKILLS.length
/** One world unit per skill point: a rating of 10 sits on the rim. */
export const MAX_VALUE = 10

/** Legacy angle (verbatim): -90 degrees + i x 36 degrees, in the legacy (x, z) floor plane. */
export const angleAt = (i: number): number => -Math.PI / 2 + i * ((Math.PI * 2) / N)

/**
 * Unit direction of spoke i in the chapter's XY plane: Strength points
 * straight up and the spokes run clockwise (90 - 36 i degrees). The legacy
 * floor plane's z pointed away from its overhead camera, so y = -sin.
 */
export const dirX = (i: number): number => Math.cos(angleAt(i))
export const dirY = (i: number): number => -Math.sin(angleAt(i))
/** Spoke angle in radians, counter-clockwise from +x (90 - 36 i degrees). */
export const spokeAngle = (i: number): number => Math.atan2(dirY(i), dirX(i))

export const floorOf = (p: readonly number[]): number => Math.min(...p)

/** Range, max minus min, rounded to 0.1 (verbatim from the legacy module). */
export const rangeOf = (vals: readonly number[]): number => {
  let lo = Infinity
  let hi = -Infinity
  for (const v of vals) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return Math.round((hi - lo) * 10) / 10
}

/** Index of the weakest skill (the first one at the floor, in SKILLS order). */
export const weakestIndex = (p: ArrayLike<number>): number => {
  let k = 0
  for (let i = 1; i < p.length; i++) if (p[i] < p[k]) k = i
  return k
}
/**
 * Every skill at the floor, in SKILLS order. A tie is a tie: the Generalist's
 * floor of 7 is Flexibility, Agility and Accuracy, never just the first of
 * them (values are compared at the 0.1 step the lesson edits in).
 */
export const weakestNames = (p: readonly number[]): string[] => {
  const lo = floorOf(p)
  const out: string[] = []
  for (let i = 0; i < p.length; i++) if (p[i] - lo < 0.05) out.push(SKILLS[i].name)
  return out
}

/** A value printed the way the lesson prints it: whole numbers bare, else one decimal. */
export const fmtVal = (v: number): string => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1))

export const CLASS_COLOR: Record<SkillClass, string> = {
  trained: PAL.trained,
  practiced: PAL.practiced,
  both: PAL.both,
}
/** The legend strings (SkillsModule.legend). */
export const CLASS_LABEL: Record<SkillClass, string> = {
  trained: 'Trained (organic)',
  practiced: 'Practiced (neural)',
  both: 'Both',
}
export const SKILL_COLORS: string[] = SKILLS.map((s) => CLASS_COLOR[s.classification])

export const GENERALIST: Archetype = ARCHETYPES[0]
export const POWERLIFTER: Archetype = ARCHETYPES[2]

/** Shortened ARCHETYPES names (the D.2 label lexicon). */
export const SHORT_NAME: Record<string, string> = {
  'Generalist CrossFitter': 'Generalist',
  'Tactical / Military': 'Tactical',
  'Team-sport Athlete': 'Team sport',
  'Competitive Swimmer': 'Swimmer',
  'Artistic Gymnast': 'Gymnast',
  Rower: 'Rower',
  Strongman: 'Strongman',
  Bodybuilder: 'Bodybuilder',
  '100m Sprinter': 'Sprinter',
  Marathoner: 'Marathoner',
  'Olympic Weightlifter': 'Weightlifter',
  'Sedentary Adult': 'Sedentary',
  Powerlifter: 'Powerlifter',
}
export const shortName = (name: string): string => SHORT_NAME[name] ?? name

export interface Ranked {
  name: string
  short: string
  profile: readonly number[]
  floor: number
  range: number
  isG: boolean
}

/**
 * The thirteen athletes sorted by their weakest skill, highest first, then
 * by range (the flatter shape first), then by name (D.2 S5). Computed, never
 * hard-coded; it yields Generalist first and Powerlifter last.
 */
export const RANKED: readonly Ranked[] = ARCHETYPES.map((a) => ({
  name: a.name,
  short: shortName(a.name),
  profile: a.profile,
  floor: floorOf(a.profile),
  range: rangeOf(a.profile),
  isG: a.name === GENERALIST.name,
})).sort((a, b) => b.floor - a.floor || a.range - b.range || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

export const profileOf = (name: string): readonly number[] | null => ARCHETYPES.find((a) => a.name === name)?.profile ?? null

/* --------------------------- polar geometry --------------------------- */

/**
 * The radius at polar angle `ang` of the straight chord between spoke i at
 * radius r1 and spoke i + 1 at radius r2 (the polar equation of a line), so
 * two profiles can be compared along the same ray. `ang` runs from spoke i
 * to spoke i + 1 (clockwise, so decreasing).
 */
export function chordRadius(i: number, r1: number, r2: number, ang: number): number {
  const a1 = spokeAngle(i)
  const a2 = a1 - (Math.PI * 2) / N
  const den = r1 * Math.sin(a1 - ang) + r2 * Math.sin(ang - a2)
  if (Math.abs(den) < 1e-9) return 0
  return (r1 * r2 * Math.sin(a1 - a2)) / den
}
