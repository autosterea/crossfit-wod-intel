import type { FitnessView } from '../../lessonTypes'
import type { StoryKey } from '../types'
import { noiseFor } from './noise'

/* =========================================================================
   Chapter keys and the ambient bed (DESIGN.md I.2.2, I.2.5). Engine-owned:
   chapters never declare keys or chords.

   The bed is the room (two decorrelated pinks, 150 Hz to 1.1 kHz, a slow
   drift; it never crossfades: it is the same room) plus the chapter's TONE,
   a suspended chord (root, fifth, ninth). Each note is a sine, a twin 2 cents
   sharp at -9 dB (a slow shimmer, not a throb), a 3rd harmonic at -20 dB and
   an octave whose level rises across the chapter (a phone speaker hears the
   octaves and the harmonics). The chord's third, the ANSWER, fades in only
   under the chapter's claim bell. At each beat start the tone's lowpass
   glides up: the room brightens as the argument builds. Its state at the
   start of beat n is a pure function of n (bedStateAt), so a deep link or an
   offline render of a mid-chapter range starts in the right room.
   ========================================================================= */

export interface ChapterKey {
  chord: readonly [number, number, number]
  answer: number
  bellRoot: number
  tick: number
}

const K = (chord: [number, number, number], answer: number, bellRoot: number, tick: number): ChapterKey => ({ chord, answer, bellRoot, tick })

export const KEYS: Record<FitnessView, ChapterKey> = {
  intro: K([146.83, 220.0, 329.63], 369.99, 587.33, 1174.66),
  skills: K([220.0, 329.63, 493.88], 554.37, 440.0, 1760.0),
  hopper: K([164.81, 246.94, 369.99], 415.3, 659.26, 1318.51),
  pathways: K([246.94, 369.99, 554.37], 587.33, 493.88, 987.77),
  definition: K([146.83, 220.0, 329.63], 369.99, 587.33, 1174.66),
  continuum: K([185.0, 277.18, 415.3], 440.0, 739.99, 1479.98),
  health: K([196.0, 293.66, 440.0], 493.88, 392.0, 1567.98),
  // 07 CrossFit (STORYBOARD-crossfit.md): C, a key no other chapter uses. Dormant until the chapter
  // declares narration (H.72); the sound designer may retune it then.
  crossfit: K([130.81, 196.0, 293.66], 329.63, 523.25, 1046.5),
  // 08 Technique (STORYBOARD-technique.md): F, a key no other chapter uses. Dormant until the chapter
  // declares narration (H.72); the sound designer may retune it then.
  technique: K([174.61, 261.63, 392.0], 440.0, 698.46, 1396.91),
}

/** A story without its own key (a lab story, H.72) plays in the intro's key. */
export const keyFor = (v: StoryKey | null | undefined): ChapterKey => (KEYS as Partial<Record<string, ChapterKey>>)[v ?? 'intro'] ?? KEYS.intro

/** Chapter-specific bed colour (I.2.5): windows are in beat t of a beat index. */
interface BedExtras {
  /** a minor third that enters with the chapter's resolve.fall and fades at the start of the next beat (Skills) */
  minor?: number
  /** the answer dips 6 dB from the resolve.fall's first strike and recovers at the next beat's start (Capacity) */
  fallDip?: boolean
  /** cutoff darkening windows: [beat, t0, t1, factor] (Continuum, Health) */
  darken?: readonly (readonly [number, number, number, number])[]
}
const EXTRAS: Partial<Record<FitnessView, BedExtras>> = {
  skills: { minor: 523.25 },
  definition: { fallDip: true },
  continuum: { darken: [[6, 0.7, 1.0, 0.75]] },
  health: {
    darken: [
      [4, 0.05, 0.8, 0.8],
      [5, 0, 0.3, 1.25],
    ],
  },
}
const extrasFor = (v: StoryKey): BedExtras | undefined => (EXTRAS as Partial<Record<string, BedExtras>>)[v]

/* ------------------------------- levels -------------------------------- */
// Calibrated by ffmpeg ebur128 on __story.renderAudio(stems ['bed'], duck false): the whole bed
// alone sat at -32 LUFS integrated over a chapter (I.2.5, I.3.2; amendment H.69). H.76: the owner heard the
// TONE under the voice as a hum ("the hum is kind of bad", 2026-10-01), so the chord is silent (note 0: its
// graph still runs, so the claim bells and every state stay as designed) and the room plays 6 dB lower,
// a faint air under the voice.
export const BED_LEVEL = {
  room: 0.0182,
  note: 0,
}
const dB = (d: number) => Math.pow(10, d / 20)

export const cutoffFor = (n: number, N: number) => 600 * Math.pow(2, (1.2 * n) / Math.max(1, N - 1))
/** the octave layer rises from -16 dB on the first beat to -6 dB on the last (H.71; I.2.5 had -14 to -8) */
export const octaveDbFor = (n: number, N: number) => -16 + (10 * n) / Math.max(1, N - 1)

/**
 * The ROOM brightens with the argument too (amendment H.71): its lowpass opens from ROOM_LP0 on a
 * chapter's first beat to ROOM_LP1 on its last. The room dominates the bed's spectrum, so the tone's
 * glide alone moved the phone-band centroid only 15% (the review measured it and heard "it stays the
 * same"). roomComp keeps the room's loudness constant as it opens: the brightening is heard as colour,
 * never as a swell (I.3.5: first and last beat within 3 LU).
 */
export const ROOM_LP0 = 800
export const ROOM_LP1 = 2000
export const roomCutoffFor = (n: number, N: number) => ROOM_LP0 * Math.pow(ROOM_LP1 / ROOM_LP0, n / Math.max(1, N - 1))
/** the room's K-weighted loudness grows as fc^(2 x ROOM_COMP) (+1.2 dB from 800 Hz to 2 kHz: pink noise through the two 150 Hz highpasses and two lowpasses, measured offline) */
const ROOM_COMP = 0.15
/** the room's level trim at a cutoff, 1 at the H.69 calibration cutoff (1.1 kHz) */
export const roomComp = (fc: number) => Math.pow(fc / 1100, -ROOM_COMP)

/** The bed at the start of beat n, as if the chapter had played from beat 0 (I.2.5). */
export interface BedState {
  n: number
  N: number
  cutoff: number
  octaveDb: number
  /** the answer (the third) is in */
  answer: boolean
  /** the answer is dipped (Capacity D5 -> D6) */
  dipped: boolean
  /** the Skills minor third is sounding */
  minor: boolean
}

/**
 * `claims`: per beat index, the kinds of claim sounds it plans ('resolve' / 'resolve.fall'),
 * taken from the chapter's cues (the bed keys on the claim cue, never on typed numbers).
 */
export function bedStateAt(view: StoryKey, n: number, N: number, claims: readonly (readonly string[])[]): BedState {
  const ex = extrasFor(view) ?? {}
  let answer = false
  let dipped = false
  let minor = false
  let dark = 1
  for (let i = 0; i < n; i++) {
    const c = claims[i] ?? []
    if (c.includes('resolve')) {
      answer = true
      minor = false
    }
    // a fall's dip and minor third last to the next beat's start, which is <= n here
    if (c.includes('resolve.fall')) {
      dipped = false
      minor = false
    }
    for (const d of ex.darken ?? []) if (d[0] === i) dark *= d[3]
  }
  return { n, N, cutoff: cutoffFor(n, N) * dark, octaveDb: octaveDbFor(n, N), answer, dipped, minor }
}

/* ------------------------------ the voice ------------------------------ */

interface Note {
  out: GainNode
  oscs: OscillatorNode[]
  oct: GainNode
}

function makeNote(ctx: BaseAudioContext, f: number, pan: number, drift: number, octDb: number, dest: AudioNode, t0: number, level: number): Note {
  const out = ctx.createGain()
  out.gain.value = level
  const p = ctx.createStereoPanner()
  p.pan.value = pan
  out.connect(p).connect(dest)
  const oscs: OscillatorNode[] = []
  const add = (freq: number, g: number, detune = 0): GainNode => {
    const o = ctx.createOscillator()
    o.frequency.value = freq
    o.detune.value = detune
    const gn = ctx.createGain()
    gn.gain.value = g
    o.connect(gn).connect(out)
    o.start(t0)
    oscs.push(o)
    return gn
  }
  add(f, 1)
  add(f, dB(-9), 2)
  add(f * 3, dB(-20))
  const oct = add(f * 2, dB(octDb))
  // its own slow amplitude drift, +/-2 dB
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 1 / drift
  const depth = ctx.createGain()
  depth.gain.value = level * 0.23
  lfo.connect(depth).connect(out.gain)
  lfo.start(t0)
  oscs.push(lfo)
  return { out, oscs, oct }
}

export class Bed {
  private ctx: BaseAudioContext
  private dest: AudioNode
  private roomOut: GainNode | null = null
  private roomSrc: AudioScheduledSourceNode[] = []
  /** the room's four lowpass stages (two per channel) and its loudness trim, which follow the beat (H.71) */
  private roomLp: BiquadFilterNode[] = []
  private roomTrim: GainNode | null = null
  private tone: {
    view: StoryKey
    out: GainNode
    lp: BiquadFilterNode
    notes: Note[]
    answer: Note
    answerGain: GainNode
    minor: Note | null
    minorGain: GainNode | null
    N: number
  } | null = null

  constructor(ctx: BaseAudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.dest = dest
  }

  /** The room: shared by every chapter; fades in over `fade` s from `when`, at the first beat's cutoff. */
  startRoom(when: number, fade = 2.5): void {
    if (this.roomOut) return
    const ctx = this.ctx
    const { pink } = noiseFor(ctx)
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, when)
    out.gain.linearRampToValueAtTime(1, when + fade)
    out.connect(this.dest)
    const trim = ctx.createGain()
    trim.gain.value = roomComp(ROOM_LP0)
    trim.connect(out)
    this.roomTrim = trim
    const drift = ctx.createOscillator()
    drift.frequency.value = 0.021
    const dg = ctx.createGain()
    dg.gain.value = BED_LEVEL.room * 0.19
    const lvl = ctx.createGain()
    lvl.gain.value = BED_LEVEL.room
    drift.connect(dg).connect(lvl.gain)
    lvl.connect(trim)
    drift.start(when)
    this.roomSrc.push(drift)
    // two decorrelated pinks: the same buffer at offsets 0 and 3 s, one a hair slower, panned -0.5 / +0.5
    ;[
      [-0.5, 0, 1],
      [0.5, 3.0, 0.9931],
    ].forEach(([pan, off, rate]) => {
      const s = ctx.createBufferSource()
      s.buffer = pink
      s.loop = true
      s.playbackRate.value = rate
      const hp1 = ctx.createBiquadFilter()
      hp1.type = 'highpass'
      hp1.frequency.value = 150
      const hp2 = ctx.createBiquadFilter()
      hp2.type = 'highpass'
      hp2.frequency.value = 150
      const lp1 = ctx.createBiquadFilter()
      lp1.type = 'lowpass'
      lp1.frequency.value = ROOM_LP0
      const lp2 = ctx.createBiquadFilter()
      lp2.type = 'lowpass'
      lp2.frequency.value = ROOM_LP0
      this.roomLp.push(lp1, lp2)
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      s.connect(hp1).connect(hp2).connect(lp1).connect(lp2).connect(p).connect(lvl)
      s.start(when, off)
      this.roomSrc.push(s)
    })
    this.roomOut = out
  }

  /** The room's cutoff and trim glide to beat n of N (tau 1 s: about 3 s, with the tone). */
  private roomTo(n: number, N: number, when: number, tau: number): void {
    const fc = roomCutoffFor(n, N)
    for (const lp of this.roomLp) lp.frequency.setTargetAtTime(fc, when, tau)
    this.roomTrim?.gain.setTargetAtTime(roomComp(fc), when, tau)
  }

  /** The chapter's tone, in its state at beat `st.n`; fades in over `fade` s from `when`. */
  startTone(view: StoryKey, st: BedState, when: number, fade = 2.5): void {
    this.fadeTone(when, 1.2)
    // the room takes the beat's brightness (at once when the tone starts without a fade: a deep render)
    this.roomTo(st.n, st.N, when, fade <= 0.1 ? 0.005 : 1)
    const ctx = this.ctx
    const key = keyFor(view)
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, when)
    out.gain.linearRampToValueAtTime(1, when + fade)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = st.cutoff
    lp.Q.value = 0.5
    lp.connect(out).connect(this.dest)
    const L = BED_LEVEL.note
    const pans = [-0.25, 0.25, 0]
    const drifts = [17, 23, 29]
    const notes = key.chord.map((f, i) => makeNote(ctx, f, pans[i], drifts[i], st.octaveDb, lp, when, L))
    const answerGain = ctx.createGain()
    answerGain.gain.value = st.answer ? (st.dipped ? dB(-6) : 1) : 0
    answerGain.connect(lp)
    const answer = makeNote(ctx, key.answer, 0.1, 19, st.octaveDb, answerGain, when, L * dB(-6))
    const ex = extrasFor(view)
    let minor: Note | null = null
    let minorGain: GainNode | null = null
    if (ex?.minor) {
      minorGain = ctx.createGain()
      minorGain.gain.value = st.minor ? 1 : 0
      minorGain.connect(lp)
      minor = makeNote(ctx, ex.minor, 0.1, 21, st.octaveDb, minorGain, when, L * dB(-6))
    }
    this.tone = { view, out, lp, notes, answer, answerGain, minor, minorGain, N: st.N }
  }

  /** Beat n starts at `when`: over 3 s the lowpass and the octaves glide to beat n's values. */
  evolve(n: number, when: number, dark = 1): void {
    const t = this.tone
    if (!t) return
    const f = cutoffFor(n, t.N) * dark
    t.lp.frequency.setTargetAtTime(f, when, 1)
    this.roomTo(n, t.N, when, 1)
    const g = dB(octaveDbFor(n, t.N))
    for (const note of [...t.notes, t.answer, ...(t.minor ? [t.minor] : [])]) note.oct.gain.setTargetAtTime(g, when, 1)
  }

  /** A darkening window (Continuum C6, Health L4 / L5): the cutoff moves by `factor` across [t0, t1]. */
  darken(from: number, to: number, factor: number): void {
    const t = this.tone
    if (!t) return
    const cur = t.lp.frequency.value
    t.lp.frequency.setTargetAtTime(cur * factor, from, Math.max(0.05, (to - from) / 3))
  }

  /** The claim bell's first strike: the answer fades in over 4 s (the room answers, not a chime). */
  answerIn(when: number): void {
    const t = this.tone
    if (!t) return
    t.answerGain.gain.cancelScheduledValues(when)
    t.answerGain.gain.setValueAtTime(t.answerGain.gain.value > 0.9 ? 1 : 0, when)
    t.answerGain.gain.linearRampToValueAtTime(1, when + 4)
    if (t.minorGain) t.minorGain.gain.setTargetAtTime(0, when, 1)
  }

  /** The loss (resolve.fall): the answer dips 6 dB (Capacity), or the minor third enters (Skills). */
  fall(when: number): void {
    const t = this.tone
    if (!t) return
    const ex = extrasFor(t.view)
    if (ex?.fallDip) t.answerGain.gain.setTargetAtTime(dB(-6), when, 0.5)
    if (t.minorGain) t.minorGain.gain.setTargetAtTime(1, when, 1)
  }

  /** The next beat after a fall: the dip recovers over 4 s, the minor third fades. */
  recover(when: number, answerIn: boolean): void {
    const t = this.tone
    if (!t) return
    if (answerIn) t.answerGain.gain.setTargetAtTime(1, when, 1)
    if (t.minorGain) t.minorGain.gain.setTargetAtTime(0, when, 1)
  }

  /** Fade the current tone out (a chapter change) and stop it after the fade. */
  fadeTone(when: number, dur: number): void {
    const t = this.tone
    if (!t) return
    t.out.gain.cancelScheduledValues(when)
    t.out.gain.setValueAtTime(t.out.gain.value, when)
    t.out.gain.linearRampToValueAtTime(0, when + dur)
    const oscs = [...t.notes, t.answer, ...(t.minor ? [t.minor] : [])].flatMap((n) => n.oscs)
    for (const o of oscs) o.stop(when + dur + 0.1)
    // release the faded tone's graph once its oscillators have stopped (fix round 2: every faded tone
    // used to stay connected in a list that nothing read, one per chapter change for the page's life)
    const last = oscs[oscs.length - 1]
    const out = t.out
    if (last)
      last.onended = () => {
        try {
          out.disconnect()
        } catch {
          /* already disconnected */
        }
      }
    this.tone = null
  }

  get view(): StoryKey | null {
    return this.tone?.view ?? null
  }

  /** Stop everything at `when` (the context is going away or sound is off). */
  stopAll(when: number): void {
    this.fadeTone(when, 0.05)
    for (const s of this.roomSrc) s.stop(when + 0.1)
    this.roomSrc = []
    this.roomLp = []
    this.roomTrim = null
    this.roomOut?.gain.setTargetAtTime(0, when, 0.02)
    this.roomOut = null
  }
}
