import { hash1, mulberry32 } from '../rng'
import type { Layout } from '../types'
import { noiseFor } from './noise'
import { playBank, type Mix } from './palette'
import type { AmbientLayer } from './types'

/* =========================================================================
   Ambient life (DESIGN.md I.2.4), on the bed bus. It exists only while the
   picture moves on the ambient clock A (unheld autoplay and explore): a
   held, paused or reduced-motion picture has none.
   - rattle: the Hopper drum. UNPITCHED steel clicks (bank), a seeded
     Poisson process (exponential gaps, at least 40 ms apart), mean 3.5 per
     second x rate(T), at most 8 per second, gain jitter +/-4 dB.
   - river: one flow layer per Energy engine, a band of pink noise with a
     slow amplitude drift, its level following level(T).
   Each layer alone at its base rate sits at -44 LUFS x level(T).
   ========================================================================= */

/** Rattle grain level (dB on the bank's -30 dBFS click), calibrated alone to -44 LUFS at the base rate. */
export const RATTLE_DB = 3.4
/** River band output (linear), calibrated alone to -44 LUFS at level 1. */
export const RIVER_LEVEL = 0.084

const RIVER: Record<string, { f: number; q: number; oct?: boolean }> = {
  'river.phos': { f: 2400, q: 2.5 },
  'river.gly': { f: 1250, q: 2.2 },
  'river.oxi': { f: 620, q: 2, oct: true },
}

interface River {
  gain: GainNode
  src: AudioScheduledSourceNode[]
}

export class Ambient {
  private m: Mix
  private layers: readonly AmbientLayer[]
  private layout: Layout
  private rivers = new Map<number, River>()
  private rng: () => number
  private nextGrain = new Map<number, number>()
  private lastGrain = new Map<number, number>()
  private windowTimes: number[] = []

  constructor(m: Mix, layers: readonly AmbientLayer[], layout: Layout, seed: number) {
    this.m = m
    this.layers = layers
    this.layout = layout
    this.rng = mulberry32(0xa3b1 ^ seed)
  }

  private panOf(l: AmbientLayer): number {
    const p = typeof l.pan === 'function' ? l.pan(this.layout) : (l.pan ?? 0)
    return Math.max(-0.35, Math.min(0.35, p))
  }

  private river(i: number, l: AmbientLayer, when: number): River {
    const hit = this.rivers.get(i)
    if (hit) return hit
    const ctx = this.m.ctx
    const spec = RIVER[l.kind]
    const { pink } = noiseFor(ctx)
    const gain = ctx.createGain()
    gain.gain.value = 0
    const pan = ctx.createStereoPanner()
    pan.pan.value = this.panOf(l)
    gain.connect(pan).connect(this.m.amb)
    const src: AudioBufferSourceNode[] = []
    // a slow amplitude drift (~0.13 Hz, depth 30%) between the bands and the level
    const drift = ctx.createGain()
    drift.gain.value = 1
    drift.connect(gain)
    const add = (f: number, q: number, g: number, off: number) => {
      const s = ctx.createBufferSource()
      s.buffer = pink
      s.loop = true
      const b = ctx.createBiquadFilter()
      b.type = 'bandpass'
      b.frequency.value = f
      b.Q.value = q
      const gg = ctx.createGain()
      gg.gain.value = g
      s.connect(b).connect(gg).connect(drift)
      s.start(when, off)
      src.push(s)
    }
    add(spec.f, spec.q, 1, hash1(i + 3) * 5)
    if (spec.oct) add(1240, 3, 0.5, hash1(i + 7) * 5)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.13 + 0.05 * i
    const d = ctx.createGain()
    d.gain.value = 0.3
    lfo.connect(d).connect(drift.gain)
    lfo.start(when)
    const r = { gain, src: [...src] }
    ;(r.src as AudioScheduledSourceNode[]).push(lfo)
    this.rivers.set(i, r)
    return r
  }

  /**
   * Schedule ambient sound for [t0, t1) (context seconds), with the story at T0 and the motion running
   * (`moving`: unheld autoplay or explore). Realtime calls this each frame with a short window;
   * the offline render calls it along its timeline.
   */
  run(t0: number, t1: number, T: number, moving: boolean): void {
    this.layers.forEach((l, i) => {
      let lv = 0
      let rate = 1
      try {
        lv = moving ? Math.max(0, Math.min(1, l.level(T))) : 0
        rate = l.rate ? Math.max(0, l.rate(T)) : 1
      } catch {
        lv = 0
      }
      if (l.kind === 'rattle') {
        if (lv <= 0.001) {
          this.nextGrain.delete(i)
          return
        }
        const mean = Math.min(8, 3.5 * rate)
        let t = this.nextGrain.get(i) ?? t0 + (-Math.log(1 - this.rng() * 0.999) / mean)
        while (t < t1) {
          const last = this.lastGrain.get(i) ?? -1
          if (t - last >= 0.04 && this.budget(t)) {
            const ring = this.rng() < 0.25
            const g = RATTLE_DB + 20 * Math.log10(lv) + (this.rng() * 2 - 1) * 4
            playBank(this.m, ring ? 'rattle.ring' : 'rattle', t, { gain: g, pan: this.panOf(l), seed: Math.floor(this.rng() * 1e9), bus: 'amb', quiet: true })
            this.lastGrain.set(i, t)
          }
          t += Math.max(0.04, -Math.log(1 - this.rng() * 0.999) / mean)
        }
        this.nextGrain.set(i, t)
      } else {
        const r = this.river(i, l, t0)
        r.gain.gain.setTargetAtTime(RIVER_LEVEL * lv, t0, 0.15)
      }
    })
  }

  /** 16 transients per second across the ambient layer (the effects keep their own plan budget). */
  private budget(t: number): boolean {
    const w = this.windowTimes
    while (w.length && w[0] < t - 1) w.shift()
    if (w.length >= 8) return false
    w.push(t)
    return true
  }

  /** Silence every layer from `when` (a pause, a hold, a hidden page). */
  hush(when: number): void {
    for (const r of this.rivers.values()) r.gain.gain.setTargetAtTime(0, when, 0.2)
    this.nextGrain.clear()
  }

  stop(when: number): void {
    for (const r of this.rivers.values()) {
      r.gain.gain.setTargetAtTime(0, when, 0.05)
      for (const s of r.src) s.stop(when + 0.3)
    }
    this.rivers.clear()
    this.nextGrain.clear()
  }
}
