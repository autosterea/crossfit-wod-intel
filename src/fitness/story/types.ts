import type { ComponentType } from 'react'
import type { FitnessView } from '../lessonTypes'
import type { PAL } from '../fitnessData'

/* =========================================================================
   Story engine types (DESIGN.md C.2). A chapter is a StoryDef: ordered
   beats, a Scene rendered inside the one persistent Canvas, an Explore
   panel, and an optional HUD. Every scene property is a pure function of
   story time T = beatIndex + t.
   ========================================================================= */

export type V3 = readonly [number, number, number]
/** [min, max] world box. */
export type Box = readonly [V3, V3]
/** From the focus-rect aspect (B.3): P = portrait, L = landscape / desktop. */
export type Layout = 'P' | 'L'
export type Tier = 'high' | 'medium' | 'low'
export type Mode = 'story' | 'explore'
export type Detent = 'peek' | 'default' | 'expanded'
export type Pad = number | { l: number; r: number; t: number; b: number }

export interface CamPose {
  /** look-at point; a function lets adaptive frames supply it (usually the fit box centre) */
  target: V3 | ((layout: Layout) => V3)
  /** Degrees. 0 = camera on +Z looking at target; + moves the camera toward +X. */
  az: number
  /** Degrees above the target. */
  el: number
  /** Vertical fov in degrees, default 30. */
  fov?: number
  /** Must project entirely inside the focus rect minus padPx. A function lets
   *  adaptive chart frames (B.13) supply a box that depends on the focus rect. */
  fit: Box | ((layout: Layout) => Box)
  /** Default 24 on every side. */
  padPx?: Pad
}

export interface CamKey {
  t: number
  L: CamPose
  P?: CamPose
}

export interface CamSpec {
  L: CamPose
  /** Defaults to L. */
  P?: CamPose
  /** Part of beat t used for the move, default [0, 0.35]. */
  window?: readonly [number, number]
  /** Optional mid-beat keyframes, evaluated piecewise inside `window`. */
  keys?: readonly CamKey[]
}

export interface Beat {
  /** kebab-case, unique in the chapter */
  id: string
  /** <= 30 chars */
  title: string
  /** <= 140 chars, plain text */
  body: string
  /** exact substring -> PAL key (colour-linked terms, B.11) */
  terms?: Readonly<Record<string, keyof typeof PAL>>
  /** e.g. "MODULE_COPY.skills.keyPoints[2]" (audit only, never rendered) */
  source: string
  /** overrides the default "NN LABEL" eyebrow (intro only) */
  eyebrow?: string
  /** seconds for t: 0 -> 1 during autoplay */
  build: number
  cam: CamSpec
  /** intro last beat: "Begin the lesson" solid CTA */
  cta?: 'begin'
  /** t window of the chapter's single impact accent (B.10) */
  impact?: readonly [number, number]
}

export interface ExploreSpec {
  cam: CamSpec
  limits: { az: readonly [number, number]; el: readonly [number, number]; zoom: readonly [number, number] }
  /** shows "Scrub | Orbit" (Pathways, Definition, Health) */
  scrubToggle?: boolean
  /** seed explore state from that beat's end state */
  initFromBeat: (beatIndex: number) => void
  /** Optional scrub handler (u, v in 0..1 of the focus rect) when Scrub is on. */
  onScrub?: (nx: number, ny: number, phase: 'start' | 'move' | 'end') => void
}

export interface StoryDef {
  key: FitnessView
  beats: readonly Beat[]
  /** rendered inside the persistent Canvas */
  Scene: ComponentType
  /** DOM content of the controls sheet / panel */
  Explore: ComponentType
  explore: ExploreSpec
  /** DOM content of the HUD chip (writes via refs) */
  Hud?: ComponentType
  fog?: { color: string; density: number }
}

/* ------------------------------ labels ------------------------------- */

export type Tone = 'tick' | 'name' | 'callout' | 'readout' | 'legend'
export type Dir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C'

export interface LabelSpec {
  id: string
  text: string
  /** fallback text when nothing fits */
  short?: string
  tone: Tone
  /** data colour (dot, border, text for callouts) */
  color?: string
  /** world position; a pure function of T */
  anchor: V3 | ((T: number, layout: Layout) => V3)
  /** 'radial' = outward from `center`, then tangents, then inward */
  prefer?: Dir | 'radial'
  center?: V3
  /** default: tick 6, name 8, callout 12 */
  gapPx?: number
  /** default: callout 90, readout 85, name 60, tick 30 */
  priority?: number
  /** visibility 0..1 (multiplied into opacity) */
  cue?: (T: number) => number
  /** allow a leader line when displaced more than 12 px */
  leader?: boolean
  /** readout width reservation in ch */
  minChars?: number
  /** legend tone: pinned to the focus rect, not anchored */
  pin?: 'top-left' | 'top-right'
  /** optional compact variant of a tone (smaller readout digits) */
  size?: 'sm'
  /** name tone: show the data-colour dot (default true) */
  dot?: boolean
  /** restrict placement to these directions (then slide / tiers / short / hide) */
  only?: readonly Dir[]
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
