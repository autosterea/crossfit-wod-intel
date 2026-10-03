/* =========================================================================
   [audio] The ONLY audio module the engine files import (DESIGN.md I.6.3).
   It imports NOTHING, so store.ts -> playback.ts -> hooks.ts never reaches
   the director, and the director (which imports the store) can never hit
   the TDZ through a module cycle. Until the director installs itself on its
   first setChapter(), every hook keeps its default, which is exactly the
   engine's behaviour without sound. The sync map (H.74: a narrated beat's
   build follows its voice) lives here too, as pure functions, for the same
   reason.
   ========================================================================= */

/** The narration state of the current beat, written by the director and read by playback.tick. */
export const narr = {
  /** this beat's clip will play, or is playing */
  armed: false,
  /** seconds since arming: frame dt during the lead-in, the breath and waiting; the AUDIO CLOCK while the clip sounds */
  elapsed: 0,
  lead: 0.2,
  /** lead + clip.dur + BREATH */
  span: 0,
  /** beat time (s) at which the clip was armed: 0 at a beat start */
  armedAt: 0,
  /** the clip's source is playing now */
  sounding: false,
  /** wall seconds spent waiting for an undecoded clip at the lead */
  waiting: 0,
  /** the planned beat length while armed: max(delay + build + holdFor, armedAt + span) (ring progress) */
  total: 0,
  /**
   * The beat's build follows the voice (amendment H.74): the clip's knots [build t, clip seconds], or null
   * when the build runs at its designed rate (sound off, no knots, reduced motion, a self-clocked step).
   */
  sync: null as Knots | null,
  /** clip time at which the build starts: the pre-roll delay minus the lead (beat 0 at loaded: -LEAD_FIRST) */
  c0: 0,
  /** the beat's designed build (s): the rate after the last knot */
  build: 1,
}

/** A synced beat's knots (H.74): [build t, clip seconds], t non-decreasing in (0, 1], seconds increasing. */
export type Knots = readonly (readonly [number, number])[]

/**
 * Build t at clip time c on a synced beat (H.74): linear from (c0, 0) through every knot, then the designed
 * rate (1 / build per second) to t = 1. Pure and deterministic: the knots come from the build-time manifest.
 */
export function syncT(knots: Knots, c0: number, build: number, c: number): number {
  let pc = c0
  let pt = 0
  for (const [t, k] of knots) {
    if (c <= k) return c <= pc ? pt : pt + ((t - pt) * (c - pc)) / (k - pc)
    pc = k
    pt = t
  }
  return Math.min(1, pt + (c - pc) / Math.max(0.1, build))
}

/** The clip time at which a synced beat's build reaches t (the inverse of syncT; the plan and the render). */
export function syncC(knots: Knots, c0: number, build: number, t: number): number {
  let pc = c0
  let pt = 0
  for (const [kt, k] of knots) {
    if (t <= kt) return kt > pt ? pc + ((k - pc) * (t - pt)) / (kt - pt) : pc
    pc = k
    pt = kt
  }
  return pc + (Math.min(1, t) - pt) * Math.max(0.1, build)
}

/** The build t the voice asks for now on a synced beat, or null when the build runs at its designed rate. */
export function narrSyncT(): number | null {
  if (!narr.armed || !narr.sync) return null
  return syncT(narr.sync, narr.c0, narr.build, audioHooks.clipPos() ?? narr.elapsed - narr.lead)
}

export const audioHooks = {
  /** playback.startBeat(n) ran; delay is pb.delay (0.15 s, or 0 under reduced motion) */
  beatStart(_n: number, _delay: number): void {},
  /** autoplay advanced beat n from t0 to t1 in its build: the ONLY path that fires story cues */
  advance(_n: number, _t0: number, _t1: number): void {},
  /** the hold may end (always true with sound off) */
  holdClear(): boolean {
    return true
  },
  /** the last beat must wait in 'hold' for its voice (false with sound off) */
  holdsLast(): boolean {
    return false
  },
  /** store.pause(): the viewer paused */
  userPause(): void {},
  /** ready.markSeek(): every seek, the scrubber and deep links included, even to the same T */
  seek(): void {},
  /** the M key (gestures.ts): turn sound on, start it when Waiting, or turn it off */
  toggleKey(): void {},
  /** playback.glideTo(): a next / prev glide started (the voice and effects cut now, not a frame later) */
  glideStart(): void {},
  /**
   * H.74: the armed clip's position as heard NOW, read live from the audio clock (less the output latency)
   * while it sounds, so a synced build never lags the voice by a frame; null otherwise (then elapsed - lead)
   */
  clipPos(): number | null {
    return null
  },
}

/** Play-button ring progress while narration is armed, or null to use the engine's own (I.6.4). */
export function narrRing(): number | null {
  if (!narr.armed || narr.total <= 0) return null
  return Math.min(1, (narr.armedAt + narr.elapsed) / narr.total)
}
