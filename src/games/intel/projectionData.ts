// Loader + client-side projection/what-if math for Athlete Intelligence.
// The numbers in the profile + leaderboard are all PRECOMPUTED by the build
// engine (scripts/build-athlete-intel-2026.mjs). This module only:
//   1. fetches projection-2026.json once (module-cached), and
//   2. runs the small what-if projection (classify a workout -> rank athletes
//      by their measured performance on the axes that workout taxes), using
//      the SAME intel-config.json the build engine uses, so they cannot drift.

import config from './intel-config.json'
import type { AthleteIntel, ModalKey, ProjectionData } from './projectionTypes'

export const MODAL_KEYS = Object.keys(config.modalBuckets).filter((k) => !k.startsWith('_')) as ModalKey[]
const MODAL_BUCKET_DEFS = config.modalBuckets as unknown as Record<string, { label: string; modalityIncludes?: string; loadLevelIn?: string[]; timeDomainIn?: string[] }>
export const MODAL_LABEL: Record<string, string> = Object.fromEntries(MODAL_KEYS.map((k) => [k, MODAL_BUCKET_DEFS[k].label]))
export const SKILL_ORDER: string[] = config.skillOrder

let cache: Promise<ProjectionData> | null = null
export function loadProjection(): Promise<ProjectionData> {
  if (!cache) {
    cache = fetch(`/projection-2026.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`projection ${r.status}`)
      return r.json() as Promise<ProjectionData>
    })
  }
  return cache
}

/* ----------------------------- what-if engine ---------------------------- */

export type TimeDomain = 'sprint' | 'short' | 'medium' | 'long' | 'endurance'
export type LoadLevel = 'none' | 'light' | 'moderate' | 'heavy' | 'max'

export interface SimMovement {
  name: string
  modality: 'M' | 'G' | 'W'
}

// A comprehensive palette of the movements seen most often at the CrossFit
// Games, grouped by modal domain (M = monostructural, G = gymnastics,
// W = weightlifting/odd-object). Used by the what-if simulator.
export const MODALITY_GROUPS: { key: 'M' | 'G' | 'W'; label: string }[] = [
  { key: 'M', label: 'Monostructural' },
  { key: 'G', label: 'Gymnastics' },
  { key: 'W', label: 'Weightlifting' },
]

export const SIM_MOVEMENTS: SimMovement[] = [
  // Monostructural / cardio
  { name: 'Run', modality: 'M' },
  { name: 'Row', modality: 'M' },
  { name: 'Echo Bike', modality: 'M' },
  { name: 'Bike Erg', modality: 'M' },
  { name: 'Ski Erg', modality: 'M' },
  { name: 'Swim', modality: 'M' },
  { name: 'Double Unders', modality: 'M' },
  { name: 'Shuttle Run', modality: 'M' },
  { name: 'Sled Push', modality: 'M' },
  { name: 'Sled Pull', modality: 'M' },
  // Gymnastics / bodyweight
  { name: 'Pull-up', modality: 'G' },
  { name: 'Chest-to-bar', modality: 'G' },
  { name: 'Bar Muscle-up', modality: 'G' },
  { name: 'Ring Muscle-up', modality: 'G' },
  { name: 'Strict HSPU', modality: 'G' },
  { name: 'Kipping HSPU', modality: 'G' },
  { name: 'Handstand Walk', modality: 'G' },
  { name: 'Toes-to-bar', modality: 'G' },
  { name: 'Burpee', modality: 'G' },
  { name: 'Burpee Box Jump-over', modality: 'G' },
  { name: 'Pistol Squat', modality: 'G' },
  { name: 'Rope Climb', modality: 'G' },
  { name: 'Legless Rope Climb', modality: 'G' },
  { name: 'Wall Walk', modality: 'G' },
  { name: 'GHD Sit-up', modality: 'G' },
  { name: 'Box Jump', modality: 'G' },
  { name: 'Ring Dip', modality: 'G' },
  // Weightlifting / odd object
  { name: 'Snatch', modality: 'W' },
  { name: 'Clean and Jerk', modality: 'W' },
  { name: 'Clean', modality: 'W' },
  { name: 'Deadlift', modality: 'W' },
  { name: 'Back Squat', modality: 'W' },
  { name: 'Front Squat', modality: 'W' },
  { name: 'Overhead Squat', modality: 'W' },
  { name: 'Thruster', modality: 'W' },
  { name: 'Shoulder to Overhead', modality: 'W' },
  { name: 'Push Press', modality: 'W' },
  { name: 'Wall Ball', modality: 'W' },
  { name: 'Kettlebell Swing', modality: 'W' },
  { name: 'Dumbbell Snatch', modality: 'W' },
  { name: 'Dumbbell Box Step-up', modality: 'W' },
  { name: 'Devil Press', modality: 'W' },
  { name: 'Sandbag Clean', modality: 'W' },
  { name: 'Sandbag Carry', modality: 'W' },
  { name: 'Yoke Carry', modality: 'W' },
  { name: 'Farmers Carry', modality: 'W' },
]

export interface SimEvent {
  modality: string // combination like "MGW"
  timeDomain: TimeDomain
  loadLevel: LoadLevel
}

/** Which intel axes (modal buckets) an event taxes - mirrors the build engine's eventBuckets. */
export function eventBuckets(ev: SimEvent): ModalKey[] {
  const out: ModalKey[] = []
  for (const key of MODAL_KEYS) {
    const def = MODAL_BUCKET_DEFS[key]
    if (def.modalityIncludes && ev.modality.includes(def.modalityIncludes)) out.push(key)
    else if (def.loadLevelIn && def.loadLevelIn.includes(ev.loadLevel)) out.push(key)
    else if (def.timeDomainIn && def.timeDomainIn.includes(ev.timeDomain)) out.push(key)
  }
  return out
}

/** 10-skill demand vector for a simulated event (additive, mirrors the engine). */
export function eventDemand(ev: SimEvent): { skill: string; weight: number }[] {
  const v = new Array(SKILL_ORDER.length).fill(0)
  const add = (row?: number[]) => row && row.forEach((w, k) => (v[k] += w))
  const md = config.modalityDemand as unknown as Record<string, number[]>
  if (ev.modality.includes('M')) add(md.M)
  if (ev.modality.includes('G')) add(md.G)
  if (ev.modality.includes('W')) add(md.W)
  add((config.loadDemand as unknown as Record<string, number[]>)[ev.loadLevel])
  add((config.timeDomainDemand as unknown as Record<string, number[]>)[ev.timeDomain])
  const max = Math.max(...v, 1)
  return SKILL_ORDER.map((skill, k) => ({ skill, weight: Math.round((v[k] / max) * 100) }))
}

export interface SimPart {
  key: ModalKey
  label: string
  value: number // this athlete's measured placement-percentile on this taxed domain
}
export interface SimResult {
  athlete: AthleteIntel
  expected: number // projected placement-percentile on this event (0-100)
  parts: SimPart[] // the taxed domains + the athlete's measured score on each (the inputs to expected)
  usedCapacityFallback: boolean // true when the athlete had no measured score on any taxed domain
}

/**
 * Project a field on a simulated event: each athlete's expected performance =
 * the mean of their MEASURED placement-percentile on the axes the event taxes.
 * This is grounded entirely in their real competition record - no invented
 * numbers - and is consistent with how the build engine derives the fingerprint.
 * `parts` exposes exactly which domains were averaged and each athlete's measured
 * score on them, so the UI can show how the projection was computed.
 */
export function projectEvent(athletes: AthleteIntel[], ev: SimEvent): SimResult[] {
  const buckets = eventBuckets(ev)
  const scored = athletes.map((a) => {
    const parts: SimPart[] = buckets
      .map((b) => ({ key: b, label: MODAL_LABEL[b], value: a.modal[b] }))
      .filter((p): p is SimPart => p.value != null)
    const expected = parts.length ? parts.reduce((x, y) => x + y.value, 0) / parts.length : a.capacity
    return { athlete: a, expected: Math.round(expected * 10) / 10, parts, usedCapacityFallback: parts.length === 0 }
  })
  return scored.sort((x, y) => y.expected - x.expected)
}

export interface DrawResult {
  athlete: AthleteIntel
  points: number
  perEvent: number[]
}

/** Project a multi-event "draw" (Hopper mode): sum projected points across events. */
export function projectDraw(athletes: AthleteIntel[], events: SimEvent[]): DrawResult[] {
  const perEventResults = events.map((ev) => projectEvent(athletes, ev))
  const pointsBySlug = new Map<string, { points: number; perEvent: number[] }>()
  athletes.forEach((a) => pointsBySlug.set(a.slug, { points: 0, perEvent: [] }))
  perEventResults.forEach((res) => {
    res.forEach((r, idx) => {
      const rec = pointsBySlug.get(r.athlete.slug)!
      rec.points += idx + 1 // 1 point for projected 1st, etc. (lower is better)
      rec.perEvent.push(idx + 1)
    })
  })
  return athletes
    .map((a) => ({ athlete: a, ...pointsBySlug.get(a.slug)! }))
    .sort((x, y) => x.points - y.points)
}

/** Confidence -> band half-width (projected-rank uncertainty, in ranks). */
export function confidenceBand(c: AthleteIntel['confidence'], fieldSize: number): number {
  const frac = c === 'high' ? 0.08 : c === 'medium' ? 0.16 : 0.28
  return Math.max(1, Math.round(fieldSize * frac))
}
