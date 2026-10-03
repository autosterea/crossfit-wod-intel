/* =========================================================================
   The mix graph (DESIGN.md I.3.1). The SAME buildGraph builds the phone's
   graph and the offline reference render's graph, so a render measures the
   real chain.

   voice clip -> make-up -> voice cut -> voice bus (0 dB, highpass 80 Hz) --------+
   effects -> env -> cut -> sfx bus -> sfx duck (0 / -3 dB) ----------------------+
   bed, ambient -> env -> cut -> bed bus -> bed duck (0 / -6 dB) -> bed mode -----+--> pre-master
   ui -> ui bus (never ducked) ----------------------------------------------------+
   pre-master -> limiter -> makeup trim -> ceiling (WaveShaper 4x) -> master fade -> destination

   Analysers (QA only) sit after each bus's duck and after the master fade.
   ========================================================================= */

export interface Graph {
  ctx: BaseAudioContext
  voice: GainNode
  sfx: GainNode
  sfxDuck: GainNode
  bed: GainNode
  bedDuck: GainNode
  bedMode: GainNode
  ui: GainNode
  pre: GainNode
  limiter: DynamicsCompressorNode
  trim: GainNode
  ceiling: WaveShaperNode
  master: GainNode
  an: { voice: AnalyserNode; sfx: AnalyserNode; bed: AnalyserNode; ui: AnalyserNode; master: AnalyserNode } | null
}

/** Limiter settings (I.3.4). */
export const LIMITER = { threshold: -2.0, knee: 0, ratio: 20, attack: 0.001, release: 0.12 }

export const DUCK = { bed: 0.5012, sfx: 0.7079 } // -6 dB, -3 dB

const dbToGain = (db: number) => Math.pow(10, db / 20)

/**
 * The DynamicsCompressorNode applies automatic make-up gain: (1 / fullRangeGain)^0.6, where
 * fullRangeGain is its static curve's output at 0 dBFS (WebKit and Chromium share this kernel).
 * The trim cancels it, so the chain has unity gain below the threshold.
 */
export function limiterTrim(): number {
  const { threshold, ratio } = LIMITER
  // hard knee: output dB at 0 dBFS input
  const outDb = threshold + (0 - threshold) / ratio
  const fullRangeGain = dbToGain(outDb)
  const makeup = Math.pow(1 / fullRangeGain, 0.6)
  return 1 / makeup
}

/** Soft ceiling (I.3.4): linear to 0.794 (-2 dBFS), then a tanh knee to 0.871 (-1.2 dBFS). */
function ceilingCurve(): Float32Array<ArrayBuffer> {
  const n = 4097
  const c = new Float32Array(n)
  const L = 0.794
  const W = 0.077
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= L ? a : L + W * Math.tanh((a - L) / W)
    c[i] = x < 0 ? -y : y
  }
  return c
}

function analyser(ctx: BaseAudioContext): AnalyserNode {
  const a = ctx.createAnalyser()
  a.fftSize = 4096
  a.smoothingTimeConstant = 0
  return a
}

export function buildGraph(ctx: BaseAudioContext, opts: { analysers: boolean }): Graph {
  const g = (v = 1) => {
    const n = ctx.createGain()
    n.gain.value = v
    return n
  }
  const voice = g()
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 80
  hp.Q.value = 0.7071
  const sfx = g()
  const sfxDuck = g()
  const bed = g()
  const bedDuck = g()
  const bedMode = g()
  const ui = g()
  const pre = g()
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = LIMITER.threshold
  limiter.knee.value = LIMITER.knee
  limiter.ratio.value = LIMITER.ratio
  limiter.attack.value = LIMITER.attack
  limiter.release.value = LIMITER.release
  const trim = g(limiterTrim())
  const ceiling = ctx.createWaveShaper()
  ceiling.curve = ceilingCurve()
  ceiling.oversample = '4x'
  const master = g()

  voice.connect(hp).connect(pre)
  sfx.connect(sfxDuck).connect(pre)
  bed.connect(bedDuck).connect(bedMode).connect(pre)
  ui.connect(pre)
  pre.connect(limiter).connect(trim).connect(ceiling).connect(master).connect(ctx.destination)

  let an: Graph['an'] = null
  if (opts.analysers) {
    an = { voice: analyser(ctx), sfx: analyser(ctx), bed: analyser(ctx), ui: analyser(ctx), master: analyser(ctx) }
    hp.connect(an.voice)
    sfxDuck.connect(an.sfx)
    bedMode.connect(an.bed)
    ui.connect(an.ui)
    master.connect(an.master)
  }
  return { ctx, voice, sfx, sfxDuck, bed, bedDuck, bedMode, ui, pre, limiter, trim, ceiling, master, an }
}

/** Cancel future automation on a param and glide it to v with time constant tau from now. */
export function glide(p: AudioParam, v: number, now: number, tau: number): void {
  p.cancelScheduledValues(now)
  p.setTargetAtTime(v, now, Math.max(0.001, tau))
}

/** dBFS RMS of an analyser's most recent window (50 ms), or -120 for silence. */
export function rmsDb(a: AnalyserNode, buf: Float32Array<ArrayBuffer>, sr: number): number {
  a.getFloatTimeDomainData(buf)
  const n = Math.min(buf.length, Math.round(sr * 0.05))
  let s = 0
  for (let i = buf.length - n; i < buf.length; i++) s += buf[i] * buf[i]
  const r = Math.sqrt(s / Math.max(1, n))
  return r > 1e-6 ? Math.round(20 * Math.log10(r) * 10) / 10 : -120
}
