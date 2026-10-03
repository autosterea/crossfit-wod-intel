import type { Layout, StoryKey } from '../types'
import type { ChartFrame } from '../kit/chartFrame'

/* =========================================================================
   Sound types (DESIGN.md I.6.2). A chapter's cues live in its own
   stories/<view>/sound.ts (default export ChapterSound), never in story.ts.
   A cue never contains a window number: it names its SOURCE (the Scene's own
   cue function, a registered label, the camera move, the impact window) and
   cueFrom() samples it, so a retimed animation carries its sound with it.
   ========================================================================= */

export type SfxId =
  | 'pen'
  | 'pen.dash'
  | 'pen.bundle'
  | 'pen.slide'
  | 'pen.scan'
  | 'tick.dot'
  | 'tick.label'
  | 'tick.claim'
  | 'tick.close'
  | 'tick.steel'
  | 'tick.meet'
  | 'tick.card'
  | 'pour.fill'
  | 'pour.sweep'
  | 'pour.flood'
  | 'pour.drain'
  | 'pour.lift'
  | 'pour.glow'
  | 'clack'
  | 'clack.rain'
  | 'ball.drop'
  | 'ball.cascade'
  | 'flip'
  | 'air.reveal'
  | 'air.swing'
  | 'air.deep'
  | 'resolve'
  | 'resolve.fall'
export type UiId = 'ui.tap' | 'ui.step' | 'ui.grab' | 'ui.on'

/** Where a cue's timing comes from. Sampled over the cue's beat by cueFrom (I.2.1). */
export type CueSource =
  /** an exported cue function of the chapter's Scene or timeline; sound.ts may compose exported
   *  functions (a mean, a max, a fixed index) but never retypes a number */
  | { fn: (T: number) => number; seg?: number | 'all' }
  /** a staggered set: element i's own cue function, one event (or one span) per element */
  | { each: (T: number, i: number) => number; n: number; seg?: number | 'all'; skip?: readonly number[] }
  /** a label the chapter registers with useLabels: its spec.cue, read from the label registry.
   *  A list names layout variants; the first id registered in the current layout is used. */
  | { label: string | readonly string[]; seg?: number | 'all' }
  /** a SET of registered labels, one event each (the D1 task names) */
  | { labels: (layout: Layout) => readonly string[]; seg?: number | 'all' }
  /** the beat's camera move: Beat.cam.window (default [0, 0.35]) with the camera's ease */
  | { cam: true }
  /** the beat's impact window (Beat.impact) */
  | { impact: true }
  /** data-driven instants in beat t (a schedule, a computed crossing), evaluated when the beat is planned */
  | { times: (layout: Layout, frame: ChartFrame | null) => readonly number[] }
  /** data-driven windows in beat t (the Hopper's flips, the Continuum beads) */
  | { spans: (layout: Layout, frame: ChartFrame | null) => readonly (readonly [number, number])[] }

/** One sampled segment, in beat t. */
export interface CueShape {
  a: number
  land: number
  half: number
  b: number
  /** |d value / dt| over [a, b], 32 points, peak 1 */
  speed: Float32Array
  /** the value at a and at b (direction and progress, e.g. the pour fill fraction) */
  v0: number
  v1: number
  /** 32 points of the normalised progress 0..1 over [a, b] (pen.slide, pour centres) */
  prog: Float32Array
}

/** One sound cue of a beat. */
export interface SfxCue {
  /** names the visual it serves ("axes", "400m dot"); unique in the beat. Not called `id` on purpose. */
  name: string
  sound: SfxId
  from: CueSource
  /** one-shots: where in each segment they fire (default 'start'). Continuous sounds span the segment. */
  on?: 'start' | 'land' | 'half' | 'end' | number
  /** events per second at beat t (clack.rain, ball.cascade) */
  rate?: (t: number) => number
  /** dB from the palette level, clamped to [-12, +3] */
  gain?: number
  /** -1..1, clamped to +/-0.35; [from, to] ramps across the segment; 'orbit' circles once clockwise from 12 o'clock */
  pan?: number | readonly [number, number] | 'orbit'
  /** semitones from the palette pitch; a list gives one per event */
  pitch?: number | readonly number[]
  /** tick.dot only: the D0 ripple grains or the D6 pour shimmer (I.2.3) */
  ring?: 'ripple' | 'shimmer'
  /** a staggered set: at most this many audible events (2 to 6, default 6; the first, the last and evenly between) */
  max?: number
}

/** Ambient life tied to the scene's own ambient motion (B.11). */
export interface AmbientLayer {
  kind: 'rattle' | 'river.phos' | 'river.gly' | 'river.oxi'
  /** 0..1, a pure function of T: the moving thing is built and visible */
  level: (T: number) => number
  /** speed multiplier of the ambient motion at T (default 1); H5 passes 1 + spinBoost(T) */
  rate?: (T: number) => number
  /** stereo position; a function when it depends on the layout (the drum sits left on L) */
  pan?: number | ((layout: Layout) => number)
}

/** The default export of stories/<view>/sound.ts. */
export interface ChapterSound {
  /** keyed by Beat.id, so a reordered or inserted beat never inherits another beat's cues */
  cues: Readonly<Record<string, readonly SfxCue[]>>
  ambient?: readonly AmbientLayer[]
}

export type AudioState = 'none' | 'suspended' | 'running' | 'closed' | 'interrupted'

export interface AudioLevels {
  voice: number
  sfx: number
  ui: number
  bed: number
  master: number
  duckBed: number
  duckSfx: number
  limiter: number
  limiterMin: number
}

/** What window.__story.audio() returns (I.6.7). */
export interface AudioQA {
  enabled: boolean
  unlocked: boolean
  contextState: AudioState
  /** the context sleeps in the director's own idle suspend: sound is still on (the toggle shows On) */
  idle: boolean
  /** navigator.audioSession.type, or null where unsupported */
  session: string | null
  /** the voice is sounding */
  playing: boolean
  clip: { view: StoryKey; beat: string; file: string; dur: number } | null
  /** seconds into the clip from the audio clock, or null when not armed */
  position: number | null
  beatHold: {
    index: number
    delay: number
    build: number
    hold: number
    /** lead + clip + breath, or null when not armed */
    narr: number | null
    total: number
    elapsed: number
    waiting: boolean
    /** the build follows the voice (H.74): the armed clip has knots and the beat was not a cut or a replay */
    sync: boolean
  }
  levels: AudioLevels | null
  /** effect voices sounding now, ambient grains included */
  voices: number
  /** QA extra: the clip offset (s) the sounding source started from (a resume starts where the pause stopped) */
  startedFrom: number | null
}

export interface RenderOpts {
  /** default ['voice', 'sfx', 'bed'] */
  stems?: readonly ('voice' | 'sfx' | 'bed' | 'ui')[]
  /** default true; the ducks stay keyed by the voice's spans even when the voice stem is muted */
  duck?: boolean
  /** default 48000 */
  sampleRate?: number
  /** seconds rendered after the last beat, default 2 */
  tail?: number
}

export interface TimelineBeat {
  beat: number
  id: string
  start: number
  total: number
  clip: readonly [number, number] | null
  /** the clip's speech spans from the manifest, in seconds from the first beat (the duck checks) */
  speech: readonly (readonly [number, number])[]
  /** the build's start and end, in seconds from the first beat (H.74: a synced build ends inside its clip) */
  build: readonly [number, number]
  /** a synced beat's knots as [seconds from the first beat, build t], or null (the designed rate) */
  sync: readonly (readonly [number, number])[] | null
  cues: { name: string; sound: SfxId; at: number; dur: number }[]
}
