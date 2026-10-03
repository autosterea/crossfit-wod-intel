import { mulberry32 } from '../rng'

/* =========================================================================
   Seeded noise (DESIGN.md I.2.1): made once per context from mulberry32,
   never Math.random, so every render repeats sample for sample. White is
   2 s (every transient uses a slice of it); pink (Paul Kellet's filter) is
   6 s so the continuous textures and the room never loop audibly (a 2 s
   frozen-noise loop can be heard as a pulse). Both are normalised to
   -12 dBFS RMS, mono, and loop seamlessly (the pink filter is primed with
   the buffer's own tail).
   ========================================================================= */

export interface NoiseSet {
  white: AudioBuffer
  pink: AudioBuffer
}

const cache = new WeakMap<BaseAudioContext, NoiseSet>()
const RMS = 0.2512 // -12 dBFS

function normalise(d: Float32Array): void {
  let s = 0
  for (let i = 0; i < d.length; i++) s += d[i] * d[i]
  const k = RMS / Math.sqrt(s / d.length || 1)
  for (let i = 0; i < d.length; i++) d[i] *= k
}

export function makeWhite(sr: number, seconds = 2, seed = 0x5eed01): Float32Array<ArrayBuffer> {
  const r = mulberry32(seed)
  const d = new Float32Array(Math.round(sr * seconds))
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1
  normalise(d)
  return d
}

export function makePink(sr: number, seconds = 6, seed = 0x5eed02): Float32Array<ArrayBuffer> {
  const w = makeWhite(sr, seconds, seed)
  const d = new Float32Array(w.length)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  // two passes: the first primes the filter state with the whole buffer, so the loop point is seamless
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < w.length; i++) {
      const x = w[i]
      b0 = 0.99886 * b0 + x * 0.0555179
      b1 = 0.99332 * b1 + x * 0.0750759
      b2 = 0.969 * b2 + x * 0.153852
      b3 = 0.8665 * b3 + x * 0.3104856
      b4 = 0.55 * b4 + x * 0.5329522
      b5 = -0.7616 * b5 - x * 0.016898
      if (pass === 1) d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362
      b6 = x * 0.115926
    }
  }
  normalise(d)
  return d
}

export function noiseFor(ctx: BaseAudioContext): NoiseSet {
  const hit = cache.get(ctx)
  if (hit) return hit
  const sr = ctx.sampleRate
  const w = makeWhite(sr)
  const p = makePink(sr)
  const white = ctx.createBuffer(1, w.length, sr)
  white.copyToChannel(w, 0)
  const pink = ctx.createBuffer(1, p.length, sr)
  pink.copyToChannel(p, 0)
  const set = { white, pink }
  cache.set(ctx, set)
  return set
}
