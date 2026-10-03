import type { ComponentType } from 'react'
import type * as THREE from 'three'
import type { ChartFrame, ChartFrameOpts } from './kit/chartFrame'
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
/**
 * A story's key: a /fitness view, or a standalone lab story ('lab-...') that
 * runs the same engine outside the lesson (the MetFix Lab preview, H.65).
 */
export type StoryKey = FitnessView | `lab-${string}`
/** A caption term colour: a PAL key, or a hex colour (branded hosts, H.65). */
export type TermColor = keyof typeof PAL | `#${string}`

export interface CamPose {
  /** look-at point; a function gets the layout and the chapter's engine-owned chart frame */
  target: V3 | ((layout: Layout, frame: ChartFrame) => V3)
  /** Degrees. 0 = camera on +Z looking at target; + moves the camera toward +X. */
  az: number
  /** Degrees above the target. */
  el: number
  /** Vertical fov in degrees, default 30. */
  fov?: number
  /** Must project entirely inside the focus rect minus padPx. A function gets
   *  the layout and the chapter's chart frame (StoryDef.frame, B.13), so a box
   *  that depends on the focus rect never needs a module global. */
  fit: Box | ((layout: Layout, frame: ChartFrame) => Box)
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
  /** exact substring -> PAL key or hex colour (colour-linked terms, B.11) */
  terms?: Readonly<Record<string, TermColor>>
  /** e.g. "MODULE_COPY.skills.keyPoints[2]" (audit only, never rendered) */
  source: string
  /** overrides the default "NN LABEL" eyebrow (intro only) */
  eyebrow?: string
  /** seconds for t: 0 -> 1 during autoplay */
  build: number
  /**
   * Words of the scene labels, readouts and claim that land late in this
   * beat (read AFTER the build): they lengthen the hold (H.40). Count what
   * the finished frame asks the viewer to read, e.g. "ZONE WON" = 2.
   */
  sceneWords?: number
  /** The chapter's signature beat (A.3): its finished frame holds at least 4 s (H.40). */
  signature?: boolean
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
  /**
   * Scrub handler when Scrub is on: the world-space pick ray under the finger
   * (the same Ray useDragHandle gets) and its NDC. 'end' repeats the last ray.
   */
  onScrub?: (ray: THREE.Ray, ndc: readonly [number, number], phase: 'start' | 'move' | 'end') => void
}

/**
 * A host that is not the /fitness lesson (H.65): its own chrome words and
 * colours. A branded story has no chapters around it, so it never navigates
 * to another chapter and never writes the lesson's progress store.
 */
export interface StoryBrand {
  /** the eyebrow over every caption, e.g. "Module 7 . Insulin" */
  eyebrow: string
  /** caption accent: eyebrow, segments, play ring, slate bar, explore sheet */
  accent: string
  /** the caption card's Read more copy */
  readMore: { paras: readonly string[]; points: readonly string[] }
  /** the in-scene slate gradient and focus glow (display space); default the fitness slate */
  backdrop?: { top: string; bottom: string; glow: string }
  /** the loading slate's two lines */
  slate: { kicker: string; title: string }
  /** the no-WebGL message on the slate */
  fallback: string
  /**
   * the finished last beat's solid CTA (a link out, new tab); outline when `endNext` is set. With `go`
   * it is an in-app link instead (same tab; a modified click still opens `href`; H.77)
   */
  endCta?: { label: string; href: string; go?: () => void }
  /**
   * the finished last beat's next step in the host (e.g. "Next: Module 8"), the
   * solid CTA after `endCta`: a same-tab link, or `go` for in-app navigation
   * (a modified click still opens `href`). MetFix course shell.
   */
  endNext?: { label: string; href: string; go?: () => void }
  /**
   * false: the finished last beat's row has no "Explore this model" button (H.77: the MetFix course
   * trailer and bridges). With no button left (no endCta, no endNext) the row is not shown. Default true.
   */
  endExplore?: boolean
  /**
   * The host's next step past the last beat (H.77: a MetFix bridge goes on to its module). Next on the
   * last beat (the arrow, the Right key, a swipe) calls it, so the arrow stays enabled there.
   */
  onNext?: () => void
}

/**
 * One beat's narration clip (DESIGN.md I.6.5, amendment H.72). Generated by
 * scripts/narration-manifest.mjs into the story's own narration.gen.ts; never
 * written by hand. Story timing reads `dur` from here, never from decoding.
 */
export interface NarrationClip {
  /** Beat.id */
  beat: string
  /** the spoken paragraph: the caption body (/fitness) or the story's own narration script (MetFix) */
  text: string
  /** first 10 hex chars of sha1(text with whitespace collapsed and trimmed); the clip's file name carries it */
  hash: string
  /** relative to import.meta.env.BASE_URL */
  file: string
  /** seconds (ffprobe format=duration), 3 decimals */
  dur: number
  /** voiced spans in seconds (silencedetect -45 dB; inner silences of 0.35 s or more split a span), for the scheduled ducks (I.3.3) */
  speech: readonly (readonly [number, number])[]
  /** spoken words (norm() of the text) */
  words: number
  /** longest silence inside the speech, seconds */
  maxGap: number
  /** integrated LUFS and true peak dBTP of the (mono) MP3; the player derives the clip gain from them (amendment H.69) */
  lufs: number
  tp: number
  /**
   * The build follows the voice (amendment H.74): knots [build t, clip seconds], t non-decreasing in (0, 1],
   * seconds increasing, the last one before the clip ends. Resolved by narration-manifest.mjs from the
   * narration.json "sync" anchors (a reveal and the spoken sentence or phrase it lands on) against the clip's
   * word onsets (narration.align.json). With sound on, a beat armed at its build's start shows build t =
   * the piecewise-linear map through (pre-roll, 0) and these knots, of the clip position; after the last knot
   * the designed rate. Empty: the build keeps its designed rate (and the C.3 hold).
   */
  sync: readonly (readonly [number, number])[]
}

/** A story's narration, keyed by Beat.id (H.72). */
export type StoryNarration = Readonly<Record<string, NarrationClip>>

export interface StoryDef {
  key: StoryKey
  /** a host other than the /fitness lesson (H.65); omitted by every fitness chapter */
  brand?: StoryBrand
  /**
   * The story's narration (H.72): with it the story has sound (section I: the
   * Sound on chip, the toggle, the voice driving the hold, the bed). Without it
   * the story has NO sound at all: no sound UI, no AudioContext, no M key, and
   * its timing is the C.3 rule. Import the generated `./narration.gen`.
   */
  narration?: StoryNarration
  beats: readonly Beat[]
  /** rendered inside the persistent Canvas */
  Scene: ComponentType
  /** DOM content of the controls sheet / panel */
  Explore: ComponentType
  explore: ExploreSpec
  /** DOM content of the HUD chip (writes via refs) */
  Hud?: ComponentType
  fog?: { color: string; density: number }
  /**
   * Engine-owned adaptive chart frame (B.13). When set, the engine computes it
   * from the focus rect before the camera runs; scenes read it with
   * useStoryFrame() and camera poses receive it as `fit(layout, frame)`.
   */
  frame?: ChartFrameOpts
}

/* ------------------------------ labels ------------------------------- */

export type Tone = 'tick' | 'name' | 'callout' | 'readout' | 'legend'
export type Dir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C'

/**
 * A label's spec. `anchor` and `cue` are functions of T. The placement
 * fields `prefer`, `center`, `gapPx`, `priority` and `only` are READ ON EVERY
 * PLACEMENT PASS, never snapshotted, so a chapter may declare them as
 * getters that follow story time (a rail that rises takes precedence as it
 * passes another, a name lifts over a tick, a spoke name rides its row's
 * direction): Hopper, Pathways and Continuum rely on this (H.53). Keep a
 * getter a cheap pure function of story state; it runs every placement.
 */
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
  /**
   * true: allow a leader line when displaced more than 12 px.
   * 'always': the label is leadered to its anchor wherever it lands (a
   * callout that names a curve from a gap, e.g. D4 "DOMAINS: THE HOPPER").
   */
  leader?: boolean | 'always'
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
  /**
   * The beat's meaning depends on this label: it places before everything
   * else (priority floor 96) and __story.labels() reports it as
   * requiredHidden when its cue is up but it could not be placed. QA fails on that.
   */
  required?: boolean
  /** legend tone with a pin: stacking order inside that corner (default: registration order) */
  pinOrder?: number
  /** callout tone: small data-colour swatches before the text (for example the five domains) */
  swatches?: readonly string[]
  /** a small mono badge before the text, in the label colour (for example a computed rank "P1") */
  badge?: string
  /** horizontal clearance kept on each side, px (default: tick 6, so two ticks stay >= 12 px apart; others 0) */
  sepPx?: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
