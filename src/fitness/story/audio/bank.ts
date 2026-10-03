import { mulberry32 } from '../rng'
import { makeWhite } from './noise'
import { tickStyle } from './prefs'

/* =========================================================================
   The transient bank (DESIGN.md I.2.1). Every short recipe is rendered ONCE
   per sample rate by one OfflineAudioContext into 4 seeded variants, sliced
   into small mono AudioBuffers and normalised to its specified sample peak.
   An event is then one AudioBufferSourceNode (variant by the event seed,
   pitch by detune), one GainNode and, when panned, one StereoPannerNode.
   AudioBuffers are context-free, so the phone and the offline reference
   render use the same buffers when their sample rates match, and a render
   at another rate builds its own bank first: renders stay sample-identical.

   Pitched recipes are rendered at a REFERENCE pitch (REF below); the palette
   detunes them to the chapter's pitch.
   ========================================================================= */

export type BankId =
  | 'click'
  | 'tick.label'
  | 'tick.dot'
  | 'tick.claim'
  | 'tick.close'
  | 'tick.steel'
  | 'tick.card'
  | 'grain.lo'
  | 'grain.hi'
  | 'grain.fall'
  | 'clack'
  | 'clack.short'
  | 'ball.drop'
  | 'ball.unknown'
  | 'flip'
  | 'rattle'
  | 'rattle.ring'
  | 'ui.tap'
  | 'ui.step'

/** Reference pitches the bank is rendered at (Hz). */
export const REF = {
  /** tick pitch: D6 (Capacity and the intro) */
  tick: 1174.66,
  /** tick.dot's round tok: bell root x 1.5 (D5 x 1.5 = A5) */
  dot: 880,
  grainLo: 800,
  grainHi: 1800,
} as const

export const VARIANTS = 4

export type Bank = Record<BankId, AudioBuffer[]>

interface Recipe {
  /** slot length, seconds */
  len: number
  /** normalised sample peak, dBFS */
  peak: number
  render(c: OfflineAudioContext, out: AudioNode, t0: number, r: () => number, white: AudioBuffer): void
}

/* ----------------------------- building blocks ----------------------------- */

function tone(
  c: BaseAudioContext,
  out: AudioNode,
  t0: number,
  f: number,
  gain: number,
  att: number,
  tau: number,
  glideTo?: number,
  glideDur?: number,
): void {
  const o = c.createOscillator()
  o.frequency.setValueAtTime(f, t0)
  if (glideTo && glideDur) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + glideDur)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + att)
  g.gain.setTargetAtTime(0, t0 + att, tau)
  o.connect(g).connect(out)
  o.start(t0)
  o.stop(t0 + att + tau * 9)
}

/** A burst of white noise through a filter chain; `gain` is roughly its peak (CLICK_NORM applied). */
function burst(
  c: BaseAudioContext,
  out: AudioNode,
  t0: number,
  white: AudioBuffer,
  offset: number,
  gain: number,
  att: number,
  tau: number,
  stopAfter: number,
  filters: readonly { type: BiquadFilterType; f: number; q: number; f1?: number }[],
): void {
  const s = c.createBufferSource()
  s.buffer = white
  s.loop = true
  let node: AudioNode = s
  for (const spec of filters) {
    const b = c.createBiquadFilter()
    b.type = spec.type
    b.frequency.setValueAtTime(spec.f, t0)
    if (spec.f1) b.frequency.exponentialRampToValueAtTime(spec.f1, t0 + stopAfter)
    b.Q.value = spec.q
    node.connect(b)
    node = b
  }
  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain * CLICK_NORM, t0 + att)
  g.gain.setTargetAtTime(0, t0 + att, tau)
  g.gain.setValueAtTime(0, t0 + stopAfter)
  node.connect(g).connect(out)
  s.start(t0, offset)
  s.stop(t0 + stopAfter + 0.01)
}

/** Band-limited noise has a much lower peak than a sine of the same gain; this lifts it to about 1. */
const CLICK_NORM = 3.2
const dB = (d: number) => Math.pow(10, d / 20)

/** The CLICK (shared): white noise, 5 ms, highpassed at 2.5 kHz and bandpassed at 5 kHz (Q 1), tau 3 ms. */
function click(c: BaseAudioContext, out: AudioNode, t0: number, white: AudioBuffer, r: () => number, gain: number, hp = 2500): void {
  burst(c, out, t0, white, r() * 1.9, gain, 0.0005, 0.003, 0.022, [
    { type: 'highpass', f: hp, q: 0.7 },
    { type: 'bandpass', f: 5000, q: 1 },
  ])
}

/* --------------------------------- recipes --------------------------------- */

/**
 * tick.dot, two recipes for the owner's phone A/B (amendment H.71). 'glass' (the default): the contact
 * leads, as I.1.3 asks of every tick (the click at 0 dB, the dot pitch at -6 dB with tau 25 ms and the
 * x 2.76 glass partial at -14 dB); its sample peak is raised to -22 dBFS (the click sets it) so it keeps
 * the loudness of the H.69 recipe under the voice (K-weighted energy of solo renders within 1 dB). 'round' (`?tick=round`): the
 * H.69 recipe, a round "tok" (a sine with tau 40 ms, 90% of its energy), which the review heard as a
 * notification chime in isolation. Flip TICK_DEFAULT in prefs.ts to keep 'round'.
 */
const TICK_DOT: Record<'glass' | 'round', Recipe> = {
  glass: {
    len: 0.3,
    peak: -22,
    render: (c, out, t0, r, w) => {
      click(c, out, t0, w, r, 1)
      tone(c, out, t0, REF.dot, dB(-6), 0.0015, 0.025)
      tone(c, out, t0, REF.dot * 2.76, dB(-14), 0.0015, 0.012)
    },
  },
  round: {
    len: 0.4,
    peak: -28,
    render: (c, out, t0, r, w) => {
      tone(c, out, t0, REF.dot, 1, 0.002, 0.04)
      tone(c, out, t0, REF.dot * 2.01, dB(-14), 0.002, 0.03)
      click(c, out, t0, w, r, dB(-10))
    },
  },
}
/** the recipe this page uses (read once: the bank is rendered once per sample rate) */
const DOT = TICK_DOT[tickStyle()]

const T = REF.tick
const RECIPES: Record<BankId, Recipe> = {
  // a glass grain: the tick click without its sine (pen.slide, I.2.3)
  click: {
    len: 0.05,
    peak: -30,
    render: (c, out, t0, r, w) => click(c, out, t0, w, r, 1),
  },
  'tick.label': {
    len: 0.2,
    peak: -30,
    render: (c, out, t0, r, w) => {
      click(c, out, t0, w, r, 1)
      tone(c, out, t0, T, dB(-6), 0.0015, 0.015)
      tone(c, out, t0, T * 2.76, dB(-14), 0.0015, 0.01)
    },
  },
  // tick.dot: the recipe is the owner's A/B (amendment H.71); TICK_DOT below, chosen once per page
  'tick.dot': DOT,
  'tick.claim': {
    len: 0.5,
    peak: -27,
    render: (c, out, t0, r, w) => {
      click(c, out, t0, w, r, 1)
      tone(c, out, t0, T, dB(-6), 0.0015, 0.015)
      tone(c, out, t0, T * 2.76, dB(-14), 0.0015, 0.01)
      tone(c, out, t0, T * 1.4983, dB(-8), 0.002, 0.06)
    },
  },
  'tick.close': {
    len: 0.75,
    peak: -30,
    render: (c, out, t0, r, w) => {
      click(c, out, t0, w, r, 1)
      tone(c, out, t0, T, dB(-6), 0.004, 0.09)
      tone(c, out, t0, T * 2.76, dB(-14), 0.004, 0.045)
    },
  },
  'tick.steel': {
    len: 1.4,
    peak: -30,
    render: (c, out, t0, r, w) => {
      tone(c, out, t0, T, 1, 0.002, 0.18)
      tone(c, out, t0, T * 2.76, dB(-6), 0.002, 0.18)
      tone(c, out, t0, T * 5.4, dB(-12), 0.002, 0.18)
      tone(c, out, t0, T * 8.93, dB(-18), 0.002, 0.18)
      click(c, out, t0, w, r, dB(-6))
    },
  },
  'tick.card': {
    len: 0.1,
    peak: -34,
    render: (c, out, t0, r, w) =>
      burst(c, out, t0, w, r() * 1.9, 1, 0.008, 0.012, 0.04, [{ type: 'bandpass', f: 2200, f1: 3500, q: 1.5 }]),
  },
  // pour shimmer grains (30 ms, attack 2 ms, tau 12 ms); detuned to chord tones x 4 and x 8
  'grain.lo': { len: 0.09, peak: -12, render: (c, out, t0) => tone(c, out, t0, REF.grainLo, 1, 0.002, 0.012) },
  'grain.hi': { len: 0.09, peak: -12, render: (c, out, t0) => tone(c, out, t0, REF.grainHi, 1, 0.002, 0.012) },
  // a pour.drain grain that falls 3 semitones
  'grain.fall': {
    len: 0.09,
    peak: -12,
    render: (c, out, t0) => tone(c, out, t0, REF.grainHi, 1, 0.002, 0.014, REF.grainHi * Math.pow(2, -3 / 12), 0.04),
  },
  clack: {
    len: 0.3,
    peak: -26,
    render: (c, out, t0, r, w) => {
      burst(c, out, t0, w, r() * 1.9, 1, 0.0005, 0.004, 0.02, [{ type: 'bandpass', f: 1350, q: 5 }])
      burst(c, out, t0, w, r() * 1.9, dB(-8), 0.0005, 0.004, 0.02, [{ type: 'bandpass', f: 640, q: 7 }])
      tone(c, out, t0, 164.81, dB(-6), 0.001, 0.022, 164.81 * 0.749, 0.03)
      tone(c, out, t0, 329.63, dB(-10), 0.001, 0.022, 329.63 * 0.749, 0.03)
    },
  },
  'clack.short': {
    len: 0.15,
    peak: -26,
    render: (c, out, t0, r, w) => {
      burst(c, out, t0, w, r() * 1.9, 1, 0.0005, 0.003, 0.015, [{ type: 'bandpass', f: 1350, q: 5 }])
      tone(c, out, t0, 164.81, dB(-6), 0.001, 0.012, 164.81 * 0.749, 0.02)
      tone(c, out, t0, 329.63, dB(-10), 0.001, 0.012, 329.63 * 0.749, 0.02)
    },
  },
  'ball.drop': {
    len: 0.7,
    peak: -26,
    render: (c, out, t0, r, w) => {
      tone(c, out, t0, 329.63, 1, 0.002, 0.07, 262, 0.06)
      tone(c, out, t0, 659.26, dB(-8), 0.002, 0.07, 524, 0.06)
      burst(c, out, t0, w, r() * 1.9, dB(-6), 0.0005, 0.004, 0.006, [{ type: 'bandpass', f: 950, q: 4 }])
      tone(c, out, t0 + 0.095, 246.94, dB(-9), 0.002, 0.05)
      tone(c, out, t0 + 0.095, 493.88, dB(-17), 0.002, 0.05)
    },
  },
  'ball.unknown': {
    len: 1.0,
    peak: -26,
    render: (c, out, t0, r, w) => {
      const k = Math.pow(2, -5 / 12)
      tone(c, out, t0, 329.63 * k, 1, 0.002, 0.11, 262 * k, 0.06)
      tone(c, out, t0, 659.26 * k, dB(-8), 0.002, 0.11, 524 * k, 0.06)
      burst(c, out, t0, w, r() * 1.9, dB(-6), 0.0005, 0.004, 0.006, [{ type: 'bandpass', f: 950 * k, q: 4 }])
      tone(c, out, t0 + 0.095, 246.94 * k, dB(-9), 0.002, 0.08)
    },
  },
  flip: {
    len: 0.12,
    peak: -30,
    render: (c, out, t0, r, w) => {
      const f = [
        { type: 'highpass' as const, f: 1800, q: 0.7 },
        { type: 'bandpass' as const, f: 3200, q: 0.9 },
      ]
      burst(c, out, t0, w, r() * 1.9, 1, 0.001, 0.006, 0.014, f)
      burst(c, out, t0 + 0.045, w, r() * 1.9, dB(-4), 0.001, 0.006, 0.014, f)
    },
  },
  // the Hopper drum: unpitched steel clicks, 3 ms of noise at 2.1, 2.9 or 3.7 kHz, Q 10
  rattle: {
    len: 0.05,
    peak: -30,
    render: (c, out, t0, r, w) => {
      const f = [2100, 2900, 3700][Math.floor(r() * 3)]
      burst(c, out, t0, w, r() * 1.9, 1, 0.0003, 0.0015, 0.003, [{ type: 'bandpass', f, q: 10 }])
    },
  },
  'rattle.ring': {
    len: 0.45,
    peak: -30,
    render: (c, out, t0, r, w) => {
      const f = [2100, 2900, 3700][Math.floor(r() * 3)]
      burst(c, out, t0, w, r() * 1.9, 1, 0.0003, 0.0015, 0.003, [{ type: 'bandpass', f, q: 10 }])
      tone(c, out, t0, 1318.51, dB(-24), 0.002, 0.06)
      tone(c, out, t0, 1318.51 * 2.76, dB(-24), 0.002, 0.04)
    },
  },
  'ui.tap': {
    len: 0.1,
    peak: -34,
    render: (c, out, t0, r, w) => {
      tone(c, out, t0, 1600, 1, 0.001, 0.009)
      click(c, out, t0, w, r, dB(-10), 4000)
    },
  },
  'ui.step': {
    len: 0.15,
    peak: -32,
    render: (c, out, t0, r, w) => {
      tone(c, out, t0, 740, 1, 0.001, 0.016, 700, 0.05)
      click(c, out, t0, w, r, dB(-12))
    },
  },
}

const IDS = Object.keys(RECIPES) as BankId[]
const cache = new Map<number, Promise<Bank>>()

/** The bank for a sample rate: rendered once, then shared by every context at that rate. */
export function bankFor(sampleRate: number): Promise<Bank> {
  const hit = cache.get(sampleRate)
  if (hit) return hit
  const p = renderBank(sampleRate)
  cache.set(sampleRate, p)
  p.catch(() => cache.delete(sampleRate))
  return p
}

async function renderBank(sr: number): Promise<Bank> {
  // slots laid end to end: recipe k, variant v at offset[k][v]
  const offsets: number[][] = []
  let t = 0.01
  for (const id of IDS) {
    const row: number[] = []
    for (let v = 0; v < VARIANTS; v++) {
      row.push(t)
      t += RECIPES[id].len + 0.01
    }
    offsets.push(row)
  }
  const len = Math.ceil((t + 0.05) * sr)
  const c = new OfflineAudioContext(1, len, sr)
  const w = makeWhite(sr, 2, 0x5eed01)
  const white = c.createBuffer(1, w.length, sr)
  white.copyToChannel(w, 0)
  const out = c.createGain()
  out.connect(c.destination)
  IDS.forEach((id, k) => {
    for (let v = 0; v < VARIANTS; v++) {
      // each recipe and variant has its own seed, so adding a recipe never changes another
      const r = mulberry32(0xb4c0 + k * 131 + v * 7919 + id.length * 17)
      RECIPES[id].render(c, out, offsets[k][v], r, white)
    }
  })
  const rendered = await c.startRendering()
  const data = rendered.getChannelData(0)
  const bank = {} as Bank
  IDS.forEach((id, k) => {
    const rec = RECIPES[id]
    bank[id] = offsets[k].map((off) => {
      const a = Math.round(off * sr)
      const n = Math.round(rec.len * sr)
      const slice = new Float32Array(n)
      let peak = 0
      for (let i = 0; i < n; i++) {
        const x = data[a + i] ?? 0
        slice[i] = x
        const ax = Math.abs(x)
        if (ax > peak) peak = ax
      }
      // normalise to the recipe's specified sample peak; fade the last 2 ms so a slot never ends on a step
      const k2 = peak > 0 ? dB(rec.peak) / peak : 0
      const fade = Math.max(1, Math.round(0.002 * sr))
      for (let i = 0; i < n; i++) slice[i] *= k2 * (i >= n - fade ? (n - 1 - i) / fade : 1)
      const buf = new AudioBuffer({ length: n, sampleRate: sr, numberOfChannels: 1 })
      buf.copyToChannel(slice, 0)
      return buf
    })
  })
  return bank
}
