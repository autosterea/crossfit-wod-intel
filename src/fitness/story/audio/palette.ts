import { hash1, hash2, mulberry32 } from '../rng'
import type { Bank, BankId } from './bank'
import { REF, VARIANTS } from './bank'
import type { ChapterKey } from './bed'
import type { NoiseSet } from './noise'
import type { SfxId, UiId } from './types'

/* =========================================================================
   The palette (DESIGN.md I.2.3). One function per sound. Transients trigger
   bank buffers (one source, one gain, one optional panner); continuous
   sounds build a small live graph that ends in `env` (the whole envelope,
   scheduled ONCE with setValueCurveAtTime and never touched again) followed
   by `cut` (1.0; the ONLY gain that pause, cut and release write). Every
   node is stopped after its envelope ends and disconnected on `ended`.

   Levels: the bank carries each transient's sample peak; every continuous
   recipe has a LEVEL (linear, at its output) calibrated so the sound ALONE
   meets its I.3.2 target (M max in LU re the -16 LUFS voice), measured with
   ffmpeg ebur128 on offline renders (amendment H.69).
   ========================================================================= */

export interface Mix {
  ctx: BaseAudioContext
  bank: Bank | null
  noise: NoiseSet
  key: ChapterKey
  /** the effects bus, the ui bus, the ambient (bed) bus */
  sfx: AudioNode
  ui: AudioNode
  amb: AudioNode
  voices: VoiceSet
}

/** A sounding effect: continuous voices own a `cut` gain; one-shots only their sources. */
export interface Voice {
  start: number
  end: number
  kind: 'one' | 'cont' | 'grain'
  cut: GainNode | null
  srcs: AudioScheduledSourceNode[]
}

export class VoiceSet {
  list: Voice[] = []
  /** at most this many effect voices at once (I.3.6); the oldest releases with a 20 ms fade */
  max = 24
  add(ctx: BaseAudioContext, v: Voice): void {
    const now = ctx.currentTime
    this.prune(now)
    this.list.push(v)
    while (this.sounding(now) > this.max) {
      const old = this.list.find((x) => x.start <= now && x.end > now)
      if (!old) break
      release(ctx, old, now, 0.02)
      old.end = now
    }
  }
  prune(now: number): void {
    if (this.list.length > 64) this.list = this.list.filter((v) => v.end > now)
  }
  sounding(now: number): number {
    let n = 0
    for (const v of this.list) if (v.start <= now && v.end > now) n++
    return n
  }
  /** cancel every voice that has not started yet; cut continuous ones in flight (tau `fade`); one-shots finish */
  stopAll(ctx: BaseAudioContext, now: number, fade: number, oneShotsToo = false): void {
    for (const v of this.list) {
      if (v.end <= now) continue
      if (v.start > now + 0.005) {
        for (const s of v.srcs) safeStop(s, now)
        v.end = now
      } else if (v.kind !== 'one' || oneShotsToo) {
        release(ctx, v, now, fade)
        v.end = now + fade * 4
      }
    }
    this.list = this.list.filter((v) => v.end > now)
  }
}

function safeStop(s: AudioScheduledSourceNode, when: number): void {
  try {
    s.stop(when)
  } catch {
    /* already stopped */
  }
}

export function release(ctx: BaseAudioContext, v: Voice, now: number, fade: number): void {
  if (v.cut) {
    v.cut.gain.cancelScheduledValues(now)
    v.cut.gain.setTargetAtTime(0, now, Math.max(0.003, fade / 3))
  }
  for (const s of v.srcs) safeStop(s, now + fade + 0.05)
}

const dB = (d: number) => Math.pow(10, d / 20)
/** An equal-power panner passes cos(pi / 4) to each channel at the centre; this makes it up. */
export const CENTER = Math.SQRT2
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)
const semis = (f0: number, f1: number) => 1200 * Math.log2(f1 / f0)

/* ------------------------------ transients ------------------------------ */

export interface OneOpts {
  /** dB */
  gain?: number
  pan?: number
  /** cents */
  detune?: number
  seed?: number
  bus?: 'sfx' | 'ui' | 'amb'
  /** route through this node instead of a bus (grains inside a continuous voice) */
  into?: AudioNode
  /** do not register as a voice (grains are counted with their parent) */
  quiet?: boolean
}

/** One bank transient at `when`. Returns false when the bank is not ready (the event is skipped, never synthesised live). */
export function playBank(m: Mix, id: BankId, when: number, o: OneOpts = {}): boolean {
  const bank = m.bank
  if (!bank) return false
  const vars = bank[id]
  const seed = o.seed ?? 0
  const buf = vars[Math.floor(hash1(seed) * VARIANTS) % vars.length]
  const ctx = m.ctx
  const s = ctx.createBufferSource()
  s.buffer = buf
  s.detune.value = o.detune ?? 0
  const g = ctx.createGain()
  // always panned (equal power), with the centre's -3.01 dB made up: a centred effect plays on both
  // channels at its full level, the same convention as the mono voice (L = R = signal)
  g.gain.value = dB(o.gain ?? 0) * CENTER
  const p = ctx.createStereoPanner()
  p.pan.value = clamp(o.pan ?? 0, -0.35, 0.35)
  s.connect(g).connect(p).connect(o.into ?? (o.bus === 'ui' ? m.ui : o.bus === 'amb' ? m.amb : m.sfx))
  const t = Math.max(when, ctx.currentTime)
  s.start(t)
  s.onended = () => {
    s.disconnect()
    g.disconnect()
    p.disconnect()
  }
  const rate = Math.pow(2, (o.detune ?? 0) / 1200)
  if (!o.quiet) m.voices.add(ctx, { start: t, end: t + buf.duration / rate, kind: 'one', cut: null, srcs: [s] })
  return true
}

/** Cents from the bank's reference tick pitch to the chapter's tick pitch plus `st` semitones. */
const tickDetune = (key: ChapterKey, st: number) => semis(REF.tick, key.tick) + st * 100
const dotDetune = (key: ChapterKey, st: number) => semis(REF.dot, key.bellRoot * 1.5) + st * 100

/** Seeded +/-x jitter. */
const jit = (seed: number, salt: number, x: number) => (hash2(seed, salt) * 2 - 1) * x

export interface EventOpts {
  gain: number
  pan: number
  /** semitones from the palette pitch */
  pitch: number
  seed: number
  ring?: 'ripple' | 'shimmer'
}

/** A one-shot story effect (the tick family, clack, ball, flip, tick.card). */
export function playOne(m: Mix, sound: SfxId, when: number, o: EventOpts): void {
  const gj = o.gain + jit(o.seed, 1, 1)
  const key = m.key
  switch (sound) {
    case 'tick.label':
      playBank(m, 'tick.label', when, { gain: gj, pan: o.pan, detune: tickDetune(key, o.pitch) + jit(o.seed, 2, 20), seed: o.seed })
      return
    case 'tick.claim':
      playBank(m, 'tick.claim', when, { gain: gj, pan: o.pan, detune: tickDetune(key, o.pitch) + jit(o.seed, 2, 4), seed: o.seed })
      return
    case 'tick.close':
      playBank(m, 'tick.close', when, { gain: gj, pan: o.pan, detune: tickDetune(key, o.pitch) + jit(o.seed, 2, 4), seed: o.seed })
      return
    case 'tick.steel':
      playBank(m, 'tick.steel', when, { gain: gj, pan: o.pan, detune: tickDetune(key, o.pitch) + jit(o.seed, 2, 4), seed: o.seed })
      return
    case 'tick.meet':
      playBank(m, 'tick.close', when, { gain: gj - 2, pan: o.pan, detune: tickDetune(key, o.pitch) + jit(o.seed, 2, 4), seed: o.seed })
      playBank(m, 'tick.close', when, { gain: gj - 2, pan: o.pan, detune: tickDetune(key, o.pitch + 7.02) + jit(o.seed, 3, 4), seed: o.seed + 1 })
      return
    case 'tick.card':
      playBank(m, 'tick.card', when, { gain: gj, pan: o.pan, detune: jit(o.seed, 2, 20), seed: o.seed })
      return
    case 'tick.dot': {
      playBank(m, 'tick.dot', when, { gain: gj, pan: o.pan, detune: dotDetune(key, o.pitch) + jit(o.seed, 2, 4), seed: o.seed })
      if (o.ring === 'ripple') {
        // three sine grains at the tick pitch x 1, 1.5 and 2, 25 ms apart, -14 dB re the tok
        ;[1, 1.5, 2].forEach((k, i) => {
          const f = key.tick * k
          const id: BankId = f > 1300 ? 'grain.hi' : 'grain.lo'
          const ref = id === 'grain.hi' ? REF.grainHi : REF.grainLo
          playBank(m, id, when + 0.025 * (i + 1), { gain: gj - 14 - 16, pan: o.pan, detune: semis(ref, f), seed: o.seed + 10 + i })
        })
      } else if (o.ring === 'shimmer') {
        // 120 ms of pour grains at -16 dB: the row's light pours in
        for (let i = 0; i < 3; i++) {
          const tone = key.chord[(o.seed + i) % 3] * (i % 2 ? 8 : 4)
          const id: BankId = tone > 1300 ? 'grain.hi' : 'grain.lo'
          const ref = id === 'grain.hi' ? REF.grainHi : REF.grainLo
          playBank(m, id, when + 0.04 * i, { gain: gj - 16 - 14, pan: o.pan + jit(o.seed, 20 + i, 0.2), detune: semis(ref, tone), seed: o.seed + 20 + i })
        }
      }
      return
    }
    case 'clack':
      playBank(m, 'clack', when, { gain: gj, pan: o.pan, detune: o.pitch * 100 + jit(o.seed, 2, 20), seed: o.seed })
      return
    case 'ball.drop':
      playBank(m, o.ring === 'shimmer' ? 'ball.unknown' : 'ball.drop', when, { gain: gj, pan: o.pan, detune: o.pitch * 100 + jit(o.seed, 2, 20), seed: o.seed })
      return
    case 'flip':
      playBank(m, 'flip', when, { gain: gj, pan: o.pan, detune: jit(o.seed, 2, 20), seed: o.seed })
      return
    default:
      return
  }
}

/** A UI sound now, on the ui bus (never ducked, never scheduled from story time). */
export function playUi(m: Mix, id: UiId, seed: number, gain = 0, at?: number): void {
  const now = at ?? m.ctx.currentTime
  const gj = gain + jit(seed, 1, 1)
  if (id === 'ui.tap') playBank(m, 'ui.tap', now, { gain: gj, detune: jit(seed, 2, 20), seed, bus: 'ui' })
  else if (id === 'ui.step') playBank(m, 'ui.step', now, { gain: gj, detune: jit(seed, 2, 20), seed, bus: 'ui' })
  else if (id === 'ui.grab') playBank(m, 'tick.dot', now, { gain: gj - 6, detune: dotDetune(m.key, 0), seed, bus: 'ui' })
  else if (id === 'ui.on') uiOn(m, now)
}

/**
 * ui.on: synthesised live (it sounds before the bank exists): two glints, the bell root and its fifth,
 * STRUCK TOGETHER as one open dyad (amendment H.70: a rising two-note figure 80 ms apart is the
 * notification chime I.1.3 rules out, and ui.on is the first sound the lesson ever makes).
 */
export function uiOn(m: Mix, when: number): void {
  const ctx = m.ctx
  const out = ctx.createGain()
  out.gain.value = dB(-26) / UI_ON_PEAK
  out.connect(m.ui)
  const glint = (f: number, t: number, g: number) => {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const e = ctx.createGain()
    e.gain.setValueAtTime(0, t)
    e.gain.linearRampToValueAtTime(g * 0.5, t + 0.004)
    e.gain.setTargetAtTime(0, t + 0.004, 0.14)
    const p = ctx.createOscillator()
    p.frequency.value = f * 2.76
    const pe = ctx.createGain()
    pe.gain.setValueAtTime(0, t)
    pe.gain.linearRampToValueAtTime(g * 0.1, t + 0.004)
    pe.gain.setTargetAtTime(0, t + 0.004, 0.07)
    o.connect(e).connect(out)
    p.connect(pe).connect(out)
    o.start(t)
    p.start(t)
    o.stop(t + 1.2)
    p.stop(t + 0.8)
  }
  glint(m.key.bellRoot, when, 1)
  glint(m.key.bellRoot * 1.4983, when, 0.8)
}
/** the dyad's raw sample peak (measured on a solo render: 0.94 puts ui.on at -26.0 dBFS per channel) */
const UI_ON_PEAK = 0.94

/* --------------------------- continuous sounds --------------------------- */

/** The part of a continuous cue a voice plays. */
export interface ContSpec {
  /** seconds the segment lasts at the beat's build rate */
  dur: number
  /** 32 points, peak 1 */
  speed: Float32Array
  /** 32 points, 0..1 */
  prog: Float32Array
  /** start at this fraction of the segment (a resume mid-window) */
  u0: number
  gain: number
  pan: number | readonly [number, number] | 'orbit'
  pitch: number
  seed: number
  /** fraction of the segment where pour.lift steps up a fifth (the segment's `half`) */
  half: number
  /** [u0, u1] windows (fractions of the segment) where an overlapping continuous cue ducks this one 6 dB */
  duck: readonly (readonly [number, number])[]
  /** events per second at segment fraction u (clack.rain, ball.cascade) */
  rate?: (u: number) => number
}

const lerp32 = (a: Float32Array, u: number) => {
  const x = clamp(u, 0, 1) * (a.length - 1)
  const i = Math.min(a.length - 2, Math.floor(x))
  return a[i] + (a[i + 1] - a[i]) * (x - i)
}

/**
 * RMS of the -12 dBFS pink through each recipe's main band (measured), so a component specified
 * "at -N dB" re the recipe's loudest component is set relative to the band, not to full scale.
 */
const NOISE_BAND_RMS = { pen: 0.093, scan: 0.066, pour: 0.08 }
/**
 * Bank grains inside a continuous voice route straight to its `cut`, so their gain is absolute
 * (dB applied to the bank's own peak): pour shimmer grains sit about 16 dB under the pour band,
 * pen.slide's glass grains about 12 dB under its texture.
 */
export const GRAIN_DB = { pour: -30, slide: -14 }

/** Output levels (linear) of the continuous recipes, calibrated alone (H.69). */
export const LEVEL: Record<string, number> = {
  pen: 0.0508,
  'pen.dash': 0.0508,
  'pen.bundle': 0.0257,
  'pen.slide': 0.035,
  'pen.scan': 0.056,
  'pour.fill': 0.057,
  'pour.sweep': 0.0362,
  'pour.flood': 0.088,
  'pour.drain': 0.0486,
  'pour.lift': 0.059,
  'pour.glow': 0.0376,
  'air.reveal': 0.0403,
  'air.swing': 0.0447,
  'air.deep': 0.0462,
  'clack.rain': 0.04,
  resolve: 0.0296,
  'resolve.fall': 0.0286,
  'ball.cascade': 1,
}
/** The LEVEL each recipe's grains were set against (grains follow their recipe's level). */
const GRAIN_REF: Record<string, number> = { 'pour.fill': 0.2, 'pour.sweep': 0.13, 'pour.drain': 0.14, 'pour.lift': 0.15, 'pen.slide': 0.1 }
const grainTrim = (sound: string) => 20 * Math.log10((LEVEL[sound] ?? 1) / (GRAIN_REF[sound] ?? LEVEL[sound] ?? 1))

/** Continuous sounds that are not bells: their release tails, seconds. */
const RELEASE: Record<string, number> = {
  pen: 0.08,
  'pen.dash': 0.08,
  'pen.bundle': 0.08,
  'pen.slide': 0.08,
  'pen.scan': 0.08,
  'pour.fill': 0.9,
  'pour.sweep': 0.9,
  'pour.flood': 0.9,
  'pour.drain': 0.9,
  'pour.lift': 0.9,
  'pour.glow': 0.9,
  'air.reveal': 0.05,
  'air.swing': 0.05,
  'air.deep': 0.05,
  'clack.rain': 0.2,
  'ball.cascade': 0.3,
}
/**
 * pour.fill / pour.sweep carry the AMOUNT without a sweep-and-crescendo (I.1.3 "no risers"; H.71, which
 * supersedes the H.70 settle): the band centre travels under one octave (POUR_F0 x 2^(POUR_OCT L)), the
 * noise level is flat after the 250 ms attack, and the amount is carried by the tone and the grain
 * density. Everything holds from POUR_SETTLE of the window, and the noise eases down 3 dB over the rest,
 * so the last second or more before the claim that often follows is flat or falling.
 */
const POUR_F0 = 800
const POUR_OCT = 0.75
/** the fraction of the window after which the centre, the tone and the grain density hold (H.71; H.70 had 0.85) */
const POUR_SETTLE = 0.6
/** the tone rises from -40 dB by this much (to -26 dB; I.2.3 had -20) (H.70) */
const POUR_TONE_RISE = 14
/** the level eases down by this fraction (-3 dB) over the settle (H.70) */
const POUR_EASE = 0.29
const ATTACK: Record<string, number> = { pen: 0.025, 'pour.fill': 0.25, 'pour.sweep': 0.25, 'pour.drain': 0.25, 'pour.lift': 0.25, 'pour.flood': 0.25, 'pour.glow': 0.4 }

function noiseSrc(ctx: BaseAudioContext, buf: AudioBuffer, offset: number, when: number): AudioBufferSourceNode {
  const s = ctx.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.start(when, offset % buf.duration)
  return s
}
function bp(ctx: BaseAudioContext, f: number, q: number, type: BiquadFilterType = 'bandpass'): BiquadFilterNode {
  const b = ctx.createBiquadFilter()
  b.type = type
  b.frequency.value = f
  b.Q.value = q
  return b
}
/** An automation curve for a param: fn(u) over the voice's [u0, 1] segment plus `tail` seconds of hold. */
function curve(fn: (u: number) => number, n: number): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) c[i] = fn(i / (n - 1))
  return c
}

/**
 * Start a continuous story sound at `when`. Returns the voice (its `cut` is what pause and cut write).
 * resolve / resolve.fall are here too: they are long, live FM bells.
 */
export function playCont(m: Mix, sound: SfxId, when: number, c: ContSpec): Voice | null {
  const ctx = m.ctx
  const t0 = Math.max(when, ctx.currentTime)
  if (sound === 'resolve' || sound === 'resolve.fall') return bells(m, sound, t0, c)
  if (sound === 'ball.cascade' || sound === 'clack.rain') return pattern(m, sound, t0, c)
  const segDur = Math.max(0.05, c.dur * (1 - c.u0))
  const rel = RELEASE[sound] ?? 0.08
  const att = ATTACK[sound] ?? (sound.startsWith('pen') ? 0.025 : 0.03)
  const total = segDur + rel
  const n = Math.max(24, Math.min(160, Math.round(total * 60)))
  // u over the voice: [u0, 1] during the segment, held at 1 in the release
  const uAt = (x: number) => {
    const t = x * total
    return t >= segDur ? 1 : c.u0 + (1 - c.u0) * (t / segDur)
  }
  const inDuck = (u: number) => {
    for (const [a, b] of c.duck) if (u >= a && u <= b) return 0.5
    return 1
  }
  const envShape = (x: number, level: (u: number) => number) => {
    const t = x * total
    const u = uAt(x)
    const a = c.u0 > 0 ? Math.min(1, t / 0.03) : Math.min(1, t / att)
    const r = t <= segDur ? 1 : Math.max(0, 1 - (t - segDur) / rel)
    return level(u) * a * r * inDuck(u)
  }
  const key = m.key
  const out = ctx.createGain() // the recipe's sum
  const env = ctx.createGain()
  env.gain.value = 0
  const cut = ctx.createGain()
  const pan = ctx.createStereoPanner()
  out.connect(env).connect(cut).connect(pan).connect(m.sfx)
  const srcs: AudioScheduledSourceNode[] = []
  const lvl = (LEVEL[sound] ?? 0.1) * dB(c.gain + jit(c.seed, 1, 1)) * CENTER
  const speed = (u: number) => lerp32(c.speed, u)
  const prog = (u: number) => lerp32(c.prog, u)
  const off = hash1(c.seed) * 5
  const pink = m.noise.pink
  const white = m.noise.white

  // pan across the segment
  if (c.pan === 'orbit') pan.pan.setValueCurveAtTime(curve((x) => 0.3 * Math.sin(2 * Math.PI * uAt(x)), n), t0, total)
  else if (Array.isArray(c.pan)) {
    const [p0, p1] = c.pan as readonly [number, number]
    pan.pan.setValueCurveAtTime(curve((x) => clamp(p0 + (p1 - p0) * uAt(x), -0.35, 0.35), n), t0, total)
  } else pan.pan.value = clamp(c.pan as number, -0.35, 0.35)

  let level: (u: number) => number = () => 1
  switch (sound) {
    case 'pen':
    case 'pen.dash': {
      const s = noiseSrc(ctx, pink, off, t0)
      srcs.push(s)
      const hi = bp(ctx, 4800, 0.7)
      hi.frequency.setValueCurveAtTime(curve((x) => 4800 * (1 + 0.35 * speed(uAt(x))), n), t0, total)
      const body = bp(ctx, 850, 1.4)
      const bodyG = ctx.createGain()
      bodyG.gain.value = dB(-12)
      // grain: the sum's gain is modulated by white noise lowpassed at 30 Hz, depth ~25%
      const grain = ctx.createGain()
      grain.gain.value = 0.8
      const mod = noiseSrc(ctx, white, off * 1.7, t0)
      srcs.push(mod)
      const modLp = bp(ctx, 30, 0.7, 'lowpass')
      const modG = ctx.createGain()
      modG.gain.value = 14
      mod.connect(modLp).connect(modG).connect(grain.gain)
      s.connect(hi).connect(grain)
      s.connect(body).connect(bodyG).connect(grain)
      grain.connect(out)
      // the head glow: a sine at the bell root, -24 dB, 0 cents
      const glow = ctx.createOscillator()
      glow.frequency.value = key.bellRoot
      const glowG = ctx.createGain()
      glowG.gain.value = NOISE_BAND_RMS.pen * dB(-24)
      glow.connect(glowG).connect(out)
      glow.start(t0)
      srcs.push(glow)
      level = (u) => 0.35 + 0.65 * Math.pow(speed(u), 0.6)
      if (sound === 'pen.dash') {
        // gated at 7 Hz, duty 0.6, 4 ms ramps: a dashed chalk line sounds dashed
        const gate = ctx.createGain()
        gate.gain.value = 0
        out.disconnect()
        out.connect(gate).connect(env)
        const period = 1 / 7
        for (let t = 0; t < total; t += period) {
          const a = t0 + t
          gate.gain.setValueAtTime(0, a)
          gate.gain.linearRampToValueAtTime(1, a + 0.004)
          gate.gain.setValueAtTime(1, a + period * 0.6 - 0.004)
          gate.gain.linearRampToValueAtTime(0, a + period * 0.6)
        }
      }
      break
    }
    case 'pen.bundle': {
      ;[
        [3200, -0.3, 0],
        [6500, 0.3, 2.3],
      ].forEach(([f, p, o]) => {
        const s = noiseSrc(ctx, pink, off + o, t0)
        srcs.push(s)
        const b = bp(ctx, f, 0.5)
        const pp = ctx.createStereoPanner()
        pp.pan.value = p
        s.connect(b).connect(pp).connect(out)
      })
      level = (u) => 0.35 + 0.65 * Math.pow(speed(u), 0.6)
      break
    }
    case 'pen.slide': {
      const s = noiseSrc(ctx, pink, off, t0)
      srcs.push(s)
      const hi = bp(ctx, 900, 1.2)
      hi.frequency.setValueCurveAtTime(curve((x) => 900 * Math.pow(2, prog(uAt(x))), n), t0, total)
      const body = bp(ctx, 850, 1.4)
      const bodyG = ctx.createGain()
      bodyG.gain.value = dB(-12)
      s.connect(hi).connect(out)
      s.connect(body).connect(bodyG).connect(out)
      level = (u) => 0.3 + 0.7 * Math.pow(speed(u), 0.6)
      // 3 to 5 soft glass grains, at seeded times spread by the speed, -12 dB
      const r = mulberry32(c.seed ^ 0x51de)
      const count = 3 + Math.floor(r() * 3)
      for (let i = 0; i < count; i++) {
        const u = c.u0 + (1 - c.u0) * ((i + 0.3 + 0.4 * r()) / count)
        playBank(m, 'click', t0 + ((u - c.u0) / (1 - c.u0 || 1)) * segDur, { gain: GRAIN_DB.slide + grainTrim(sound) + c.gain, seed: c.seed + i, into: cut, quiet: true })
      }
      break
    }
    case 'pen.scan': {
      const s = noiseSrc(ctx, pink, off, t0)
      srcs.push(s)
      s.connect(bp(ctx, 3000, 2)).connect(out)
      const o = ctx.createOscillator()
      o.frequency.value = key.bellRoot
      const og = ctx.createGain()
      og.gain.value = NOISE_BAND_RMS.scan * dB(-18)
      o.connect(og).connect(out)
      o.start(t0)
      srcs.push(o)
      level = () => 1
      break
    }
    case 'pour.fill':
    case 'pour.sweep':
    case 'pour.drain':
    case 'pour.lift':
    case 'pour.glow':
    case 'pour.flood': {
      const s = noiseSrc(ctx, pink, off, t0)
      srcs.push(s)
      const drain = sound === 'pour.drain'
      const q = sound === 'pour.lift' ? 1.6 : sound === 'pour.glow' ? 0.7 : sound === 'pour.flood' ? 2.2 : 1.1
      const band = bp(ctx, 900, q)
      const floodF = c.pitch >= 5 ? 2400 : c.pitch >= 1 ? 1250 : 620
      // pour.fill / pour.sweep (amendment H.71): the centre moves under one octave and only until
      // POUR_SETTLE, the noise is flat after its attack, and the tone and the grain density carry the
      // amount, so the pour never builds like a riser into the claim that often follows it (I.1.3)
      const settles = sound === 'pour.fill' || sound === 'pour.sweep'
      // the amount, 0 to 1, reached at POUR_SETTLE and held: the sound settles while the light finishes filling
      const Ls = (u: number) => (settles ? Math.min(1, prog(Math.min(u, POUR_SETTLE)) / Math.max(1e-3, prog(POUR_SETTLE))) : prog(u))
      const centre = (u: number) => {
        const L = Ls(u)
        if (sound === 'pour.fill' || sound === 'pour.sweep') return POUR_F0 * Math.pow(2, POUR_OCT * L)
        if (drain) return 2750 * Math.pow(2, -2.4 * L)
        if (sound === 'pour.lift') return 400 * Math.pow(2, 2 * L)
        if (sound === 'pour.flood') return floodF * (1 + 0.15 * Math.sin(2 * Math.PI * u))
        return 900
      }
      band.frequency.setValueCurveAtTime(curve((x) => centre(uAt(x)), n), t0, total)
      let tail: AudioNode = s.connect(band)
      if (drain) tail = tail.connect(bp(ctx, 1800, 0.7, 'lowpass'))
      tail.connect(out)
      if (sound === 'pour.flood' && floodF === 620) {
        const b2 = bp(ctx, 1240, 3)
        const g2 = ctx.createGain()
        g2.gain.value = dB(-6)
        s.connect(b2).connect(g2).connect(out)
      }
      // the tone: the bell root / 2 plus its octave at -6 dB, rising with the amount (-40 to -20 dB)
      if (sound === 'pour.fill' || sound === 'pour.sweep' || sound === 'pour.lift') {
        const tg = ctx.createGain()
        tg.gain.setValueCurveAtTime(curve((x) => NOISE_BAND_RMS.pour * dB(-40 + (settles ? POUR_TONE_RISE : 20) * Ls(uAt(x))), n), t0, total)
        tg.connect(out)
        const f = key.bellRoot / 2
        ;[
          [f, 1],
          [f * 2, dB(-6)],
        ].forEach(([fr, g]) => {
          const o = ctx.createOscillator()
          o.frequency.setValueAtTime(fr, t0)
          // pour.lift: the tone steps up a fifth at the segment's half (a discrete step, never a glide)
          if (sound === 'pour.lift' && c.half > c.u0) o.frequency.setValueAtTime(fr * 1.4983, t0 + ((c.half - c.u0) / (1 - c.u0 || 1)) * segDur)
          const og = ctx.createGain()
          og.gain.value = g
          o.connect(og).connect(tg)
          o.start(t0)
          srcs.push(o)
        })
      }
      // ... and the noise eases down 3 dB after POUR_SETTLE (the light settling), so the pour recedes into
      // the claim instead of peaking on it (H.70). pour.fill / pour.sweep hold a FLAT level before that
      // (H.71: the old 0.55 to 1.0 crescendo was +5 dB into the bell); the other pours keep theirs.
      const ease = (u: number) => (settles && u > POUR_SETTLE ? 1 - POUR_EASE * Math.min(1, (u - POUR_SETTLE) / (1 - POUR_SETTLE)) : 1)
      level = (u) => (sound === 'pour.glow' ? 1 : settles ? ease(u) : (0.55 + 0.45 * Math.min(1, prog(u) * 1.5)) * ease(u))
      // shimmer grains (planned here from the seed, so a render repeats exactly)
      const perSec = sound === 'pour.fill' ? 18 : sound === 'pour.sweep' ? 6 : drain ? 10 : sound === 'pour.lift' ? 8 : 0
      if (perSec > 0) {
        const r = mulberry32(c.seed ^ 0x9041)
        let t = 0
        const endT = segDur + rel
        while (t < endT) {
          const u = t >= segDur ? 1 : c.u0 + (1 - c.u0) * (t / segDur)
          // pour.fill / pour.sweep: the density follows the AMOUNT (2 per second up to the recipe's rate,
          // at most 12), not the speed (H.71); the other pours follow the speed
          const rate = t >= segDur ? 3 : settles ? 2 + (Math.min(12, perSec) - 2) * Ls(u) : Math.max(2, Math.min(12, perSec * speed(u)))
          t += (0.5 + r()) / rate
          if (t >= endT) break
          const tone = key.chord[Math.floor(r() * 3)] * (r() < 0.5 ? 4 : 8)
          const id: BankId = drain ? 'grain.fall' : tone > 1300 ? 'grain.hi' : 'grain.lo'
          const ref = id === 'grain.lo' ? REF.grainLo : REF.grainHi
          // the grains settle with the noise (H.71): they route past `env`, so they take the ease themselves
          const fade = (t >= segDur ? 1 - (t - segDur) / rel : 1) * (settles ? ease(u) : 1)
          playBank(m, id, t0 + t, { gain: GRAIN_DB.pour + grainTrim(sound) + c.gain + 20 * Math.log10(Math.max(0.05, fade)), pan: (r() * 2 - 1) * 0.3, detune: semis(ref, drain ? key.chord[Math.floor(r() * 3)] * 8 : tone), seed: c.seed + 100 + Math.floor(t * 1000), into: cut, quiet: true })
        }
      }
      break
    }
    case 'air.reveal':
    case 'air.swing':
    case 'air.deep': {
      const s = noiseSrc(ctx, pink, off, t0)
      srcs.push(s)
      const band = bp(ctx, 700, 1.4)
      const f = (u: number) => {
        if (sound === 'air.swing') return 700 * (1 + 0.4 * Math.sin(2 * Math.PI * u))
        const lo = sound === 'air.deep' ? 200 : 350
        const hiF = sound === 'air.deep' ? 700 : 1400
        const end = sound === 'air.deep' ? 400 : 800
        return u < 0.6 ? lo * Math.pow(hiF / lo, u / 0.6) : hiF * Math.pow(end / hiF, (u - 0.6) / 0.4)
      }
      band.frequency.setValueCurveAtTime(curve((x) => f(uAt(x)), n), t0, total)
      s.connect(band).connect(out)
      if (sound === 'air.swing' && c.pan !== 'orbit') pan.pan.setValueCurveAtTime(curve((x) => 0.3 * Math.sin(2 * Math.PI * uAt(x)), n), t0, total)
      level = (u) => Math.pow(Math.sin(Math.PI * u), 2)
      break
    }
    default:
      break
  }
  const envCurve = curve((x) => lvl * envShape(x, level), n)
  env.gain.setValueCurveAtTime(envCurve, t0, total)
  const end = t0 + total + 0.2
  for (const s of srcs) safeStop(s, end)
  srcs[0]?.addEventListener('ended', () => {
    out.disconnect()
    env.disconnect()
    cut.disconnect()
    pan.disconnect()
  })
  const v: Voice = { start: t0, end, kind: 'cont', cut, srcs }
  m.voices.add(ctx, v)
  return v
}

/** resolve (an open fifth on inharmonic FM glass) and resolve.fall (the same an octave down, darkening). */
function bells(m: Mix, sound: 'resolve' | 'resolve.fall', t0: number, c: ContSpec): Voice {
  const ctx = m.ctx
  const fall = sound === 'resolve.fall'
  const cut = ctx.createGain()
  const out = ctx.createGain()
  out.gain.value = (LEVEL[sound] ?? 0.2) * dB(c.gain + jit(c.seed, 1, 1)) * CENTER
  let tail: AudioNode = out
  const srcs: AudioScheduledSourceNode[] = []
  if (fall) {
    // a lowpass that closes from 1.6 kHz to 700 Hz over max(0.9 s, the segment), at most 1.5 s
    const lp = bp(ctx, 1600, 0.6, 'lowpass')
    const close = clamp(Math.max(0.9, c.dur), 0.9, 1.5)
    lp.frequency.setValueAtTime(1600, t0)
    lp.frequency.exponentialRampToValueAtTime(700, t0 + close)
    tail = tail.connect(lp)
  }
  tail.connect(cut).connect(m.sfx)
  const root = fall ? m.key.bellRoot / 2 : m.key.bellRoot
  const tau = fall ? 0.6 : 1.1
  const idx0 = fall ? 1.0 : 1.2
  const bell = (f: number, t: number, g: number, p: number) => {
    const car = ctx.createOscillator()
    car.frequency.value = f
    const mod = ctx.createOscillator()
    mod.frequency.value = f * 3.5
    const dev = ctx.createGain()
    // frequency deviation = index x modulator frequency
    dev.gain.setValueAtTime(idx0 * f * 3.5, t)
    dev.gain.setTargetAtTime(0.15 * f * 3.5, t, 0.3)
    mod.connect(dev).connect(car.frequency)
    const amp = ctx.createGain()
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(g, t + 0.006)
    amp.gain.setTargetAtTime(0, t + 0.006, tau)
    const pp = ctx.createStereoPanner()
    pp.pan.value = p
    car.connect(amp).connect(pp).connect(out)
    car.start(t)
    mod.start(t)
    const stop = t + 0.006 + tau * 7
    car.stop(stop)
    mod.stop(stop)
    srcs.push(car, mod)
  }
  bell(root, t0, 1, -0.12)
  bell(root * 1.4983, t0 + 0.075, dB(-4), 0.12)
  if (!fall) {
    // the bloom: the breath of the light under the bell
    const s = noiseSrc(ctx, m.noise.pink, hash1(c.seed) * 5, t0)
    const lp = bp(ctx, 2200, 0.7, 'lowpass')
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0, t0)
    bg.gain.linearRampToValueAtTime(dB(-20) * 2, t0 + 0.3)
    bg.gain.setTargetAtTime(0, t0 + 0.3, 0.9)
    s.connect(lp).connect(bg).connect(out)
    s.stop(t0 + 0.3 + 0.9 * 7)
    srcs.push(s)
  }
  const end = t0 + 0.08 + tau * 7
  const v: Voice = { start: t0, end, kind: 'cont', cut, srcs }
  m.voices.add(ctx, v)
  return v
}

/** Repeated mechanics: ball.cascade (25 knocks) and clack.rain (clacks plus the patter above 10 per second). */
function pattern(m: Mix, sound: 'ball.cascade' | 'clack.rain', t0: number, c: ContSpec): Voice {
  const ctx = m.ctx
  const cut = ctx.createGain()
  cut.connect(m.sfx)
  const srcs: AudioScheduledSourceNode[] = []
  const segDur = Math.max(0.05, c.dur * (1 - c.u0))
  const r = mulberry32(c.seed ^ 0xca5c)
  const speed = (u: number) => lerp32(c.speed, u)
  if (sound === 'ball.cascade') {
    // 25 knocks at -12 dB, seeded pitches from the chord tones between B3 and F#4, spread by the speed
    const tones = [246.94, 329.63, 369.99, ...m.key.chord.filter((f) => f >= 246 && f <= 370)]
    const cum: number[] = []
    let acc = 0
    for (let i = 0; i < 64; i++) {
      acc += speed(i / 63) + 0.05
      cum.push(acc)
    }
    for (let k = 0; k < 25; k++) {
      const target = ((k + 0.5) / 25) * acc
      const i = cum.findIndex((x) => x >= target)
      const u = Math.max(0, i) / 63
      if (u < c.u0) continue
      const f = tones[Math.floor(r() * tones.length)]
      playBank(m, 'ball.drop', t0 + ((u - c.u0) / (1 - c.u0 || 1)) * segDur, { gain: -12 + c.gain, pan: (r() * 2 - 1) * 0.3, detune: semis(329.63, f), seed: c.seed + k, into: cut, quiet: true })
    }
  } else {
    // individual clacks up to 10 per second; the rate above 10 becomes the patter
    const rate = c.rate ?? (() => 6)
    let t = 0
    while (t < segDur) {
      const u = c.u0 + (1 - c.u0) * (t / segDur)
      const rr = Math.max(0.5, Math.min(10, rate(u)))
      t += (0.6 + 0.8 * r()) / rr
      if (t >= segDur) break
      playBank(m, 'clack.short', t0 + t, { gain: -14 + c.gain, pan: (r() * 2 - 1) * 0.35, detune: (r() * 2 - 1) * 300, seed: c.seed + Math.floor(t * 997), into: cut, quiet: true })
    }
    const s = noiseSrc(ctx, m.noise.pink, hash1(c.seed) * 5, t0)
    const b1 = bp(ctx, 1350, 1.2)
    const b2 = bp(ctx, 640, 2)
    const g2 = ctx.createGain()
    g2.gain.value = dB(-6)
    const pg = ctx.createGain()
    const n = 64
    pg.gain.setValueCurveAtTime(
      curve((x) => {
        const u = c.u0 + (1 - c.u0) * x
        return (LEVEL['clack.rain'] ?? 0.08) * clamp((rate(u) - 10) / 26, 0, 1) * Math.min(1, x * 20) * Math.min(1, (1 - x) * 20)
      }, n),
      t0,
      segDur,
    )
    s.connect(b1).connect(pg)
    s.connect(b2).connect(g2).connect(pg)
    pg.connect(cut)
    s.stop(t0 + segDur + 0.1)
    srcs.push(s)
  }
  const v: Voice = { start: t0, end: t0 + segDur + 0.9, kind: 'cont', cut, srcs }
  m.voices.add(ctx, v)
  return v
}

/** Which sounds are continuous (span a segment) rather than one-shots. */
export const CONTINUOUS: ReadonlySet<SfxId> = new Set<SfxId>([
  'pen',
  'pen.dash',
  'pen.bundle',
  'pen.slide',
  'pen.scan',
  'pour.fill',
  'pour.sweep',
  'pour.flood',
  'pour.drain',
  'pour.lift',
  'pour.glow',
  'air.reveal',
  'air.swing',
  'air.deep',
  'clack.rain',
  'ball.cascade',
  'resolve',
  'resolve.fall',
])
/** resolve / resolve.fall are claims: one per signature beat (I.1.4). */
export const isClaim = (s: SfxId) => s === 'resolve' || s === 'resolve.fall'
