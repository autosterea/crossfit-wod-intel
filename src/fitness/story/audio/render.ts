import type { StoryDef } from '../types'
import { useStoryStore } from '../store'
import { frameId, storyFrame } from '../kit/chartFrame'
import { buildGraph } from './graph'
import { bankFor } from './bank'
import { Bed, bedStateAt, keyFor } from './bed'
import { noiseFor } from './noise'
import { VoiceSet, type Mix } from './palette'
import { Ambient } from './ambient'
import { fireEvent } from './fire'
import { fetchClip, isNarrated, makeupFor } from './narration'
import { LEAD, LEAD_FIRST, PRE_ROLL, beatEvents, beatTiming, claimsOf, planSec, planT, type BeatPlan } from './plan'
import { audio, DUCK_LEAD, duckSchedule } from './director'
import type { RenderOpts, TimelineBeat } from './types'

/* =========================================================================
   The REFERENCE MIX (DESIGN.md I.1.7, I.6.7): beats [from, to] of this
   chapter with sound on, exactly as planned (I.6.4), through the real graph
   (buildGraph), in an OfflineAudioContext with its own transient bank. No
   gesture, no realtime context, never touches the live story. The bed starts
   in the state the chapter would have reached by playing from beat 0.
   Repeatable within 1 LSB at 16 bits: the plan, the noise and every jitter
   are seeded and nothing reads a clock, but two renders of the same range
   differ by 1 LSB on about 0.03% of samples (1,582 of 5.68 M in a whole
   Capacity render), Chromium's float rounding inside its renderer, the bed
   stem alone included (amendments H.69, H.71; I.1.7).
   ========================================================================= */

interface Laid {
  plan: BeatPlan
  start: number
}

function layout(def: StoryDef, from: number, to: number): Laid[] {
  const st = useStoryStore.getState()
  const frame = def.frame ? storyFrame() : null
  const fk = frame ? String(frameId(frame)) : '0'
  const sound = audio.sound && audio.def?.key === def.key ? audio.sound : null
  const out: Laid[] = []
  let t = 0
  for (let n = from; n <= to; n++) {
    const first = n === from && from === 0
    const delay = first ? 0 : PRE_ROLL
    const lead = first ? LEAD_FIRST : LEAD
    const timing = beatTiming(def, n, { delay, lead, narrate: true })
    const ev = beatEvents(def, sound, n, st.layout, frame, fk, delay)
    out.push({ plan: { ...timing, ...ev }, start: t })
    t += timing.total
  }
  return out
}

function check(def: StoryDef | null, from: number, to: number): StoryDef {
  if (!def) throw new Error('no chapter')
  if (!isNarrated(def)) throw new Error(def.key + ' has no narration: it has no sound (H.72)')
  const st = useStoryStore.getState()
  if (st.mode === 'explore' && !audio.sound) throw new Error('render from story mode')
  if (!(from >= 0 && to >= from && to < def.beats.length)) throw new Error(`beats [${from}, ${to}] are outside 0..${def.beats.length - 1}`)
  return def
}

/** The plan a render follows: beat starts, clip spans and every cue time, in seconds from the first beat. */
export function audioTimeline(from: number, to: number): TimelineBeat[] {
  const def = check(audio.def, from, to)
  return layout(def, from, to).map(({ plan, start }) => ({
    beat: plan.index,
    id: plan.id,
    start: r3(start),
    total: r3(plan.total),
    clip: plan.clip ? [r3(start + plan.lead), r3(start + plan.lead + plan.clip.dur)] : null,
    speech: plan.clip ? plan.clip.speech.map(([a, b]) => [r3(start + plan.lead + a), r3(start + plan.lead + b)] as const) : [],
    build: [r3(start + planSec(plan, 0)), r3(start + planSec(plan, 1))] as const,
    sync: plan.knots ? plan.knots.map(([t, k]) => [r3(start + plan.lead + k), t] as const) : null,
    cues: plan.events.map((e) => ({
      name: e.name,
      sound: e.sound,
      at: r3(start + planSec(plan, e.t)),
      dur: r3(e.cont ? planSec(plan, e.tb) - planSec(plan, e.t) : 0),
    })),
  }))
}
const r3 = (x: number) => Math.round(x * 1000) / 1000

export async function renderAudio(from: number, to: number, opts: RenderOpts = {}): Promise<string> {
  const def = check(audio.def, from, to)
  await audio.soundReady()
  const sound = audio.sound && audio.def?.key === def.key ? audio.sound : null
  const sr = opts.sampleRate ?? 48000
  const stems = opts.stems ?? ['voice', 'sfx', 'bed']
  const duck = opts.duck ?? true
  const tail = opts.tail ?? 2
  const laid = layout(def, from, to)
  const last = laid[laid.length - 1]
  const length = last.start + last.plan.total + tail
  const ctx = new OfflineAudioContext(2, Math.ceil(length * sr), sr)
  const g = buildGraph(ctx, { analysers: false })
  if (!stems.includes('voice')) g.voice.gain.value = 0
  if (!stems.includes('sfx')) g.sfx.gain.value = 0
  if (!stems.includes('bed')) g.bed.gain.value = 0
  if (!stems.includes('ui')) g.ui.gain.value = 0
  const bank = await bankFor(sr)
  const m: Mix = { ctx, bank, noise: noiseFor(ctx), key: keyFor(def.key), sfx: g.sfx, ui: g.ui, amb: g.bed, voices: new VoiceSet() }
  m.voices.max = 1e9
  // the bed, in its beat-0-derived state at `from`
  const bed = new Bed(ctx, g.bed)
  const claims = claimsOf(def, sound)
  const fade = from === 0 ? 2.5 : 0.05
  bed.startRoom(0, fade)
  bed.startTone(def.key, bedStateAt(def.key, from, def.beats.length, claims), 0, fade)
  // clips
  const bufs = await Promise.all(
    laid.map(async ({ plan }) => {
      if (!plan.clip) return null
      const raw = await fetchClip(plan.clip)
      if (!raw) return null
      try {
        return await ctx.decodeAudioData(raw.slice(0))
      } catch {
        return null
      }
    }),
  )
  laid.forEach(({ plan, start }, i) => {
    if (i > 0) {
      bed.evolve(plan.index, start)
      if (laid[i - 1].plan.fallAt !== null) bed.recover(start, bedStateAt(def.key, plan.index, def.beats.length, claims).answer)
    }
    const buf = bufs[i]
    if (plan.clip && buf) {
      const src = ctx.createBufferSource()
      src.buffer = buf
      const mk = ctx.createGain()
      mk.gain.value = makeupFor(plan.clip)
      src.connect(mk).connect(g.voice)
      src.start(start + plan.lead)
      // the duck bridge (I.3.3): autoplay carries on into the next laid beat, whose first duck-down is known
      const nx = laid[i + 1]
      const nextDown = nx && nx.plan.clip && nx.plan.clip.speech.length ? nx.start + nx.plan.lead + nx.plan.clip.speech[0][0] - DUCK_LEAD : null
      if (duck) duckSchedule(g, start + plan.lead - 0.2, plan.clip, start + plan.lead, 0, nextDown)
    }
    for (const e of plan.events) fireEvent(m, bed, e, start + planSec(plan, e.t), plan.build, 0)
  })
  // ambient life along the timeline: A advances one second per second, as in autoplay
  if (sound?.ambient?.length) {
    const amb = new Ambient(m, sound.ambient, useStoryStore.getState().layout, def.key.length)
    const step = 0.05
    for (let t = 0; t < last.start + last.plan.total; t += step) {
      const k = laid.findIndex((l) => t >= l.start && t < l.start + l.plan.total)
      const l = laid[Math.max(0, k)]
      const into = t - l.start
      const bt = planT(l.plan, into)
      amb.run(t, t + step, l.plan.index + bt, true)
    }
  }
  const out = await ctx.startRendering()
  return wavBase64(out)
}

/** 16-bit PCM RIFF WAV, base64 with no data: prefix. */
export function wavBase64(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels
  const n = buf.length
  const bytes = new Uint8Array(44 + n * ch * 2)
  const dv = new DataView(bytes.buffer)
  const w4 = (o: number, s: string) => {
    for (let i = 0; i < 4; i++) bytes[o + i] = s.charCodeAt(i)
  }
  w4(0, 'RIFF')
  dv.setUint32(4, 36 + n * ch * 2, true)
  w4(8, 'WAVE')
  w4(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true)
  dv.setUint16(22, ch, true)
  dv.setUint32(24, buf.sampleRate, true)
  dv.setUint32(28, buf.sampleRate * ch * 2, true)
  dv.setUint16(32, ch * 2, true)
  dv.setUint16(34, 16, true)
  w4(36, 'data')
  dv.setUint32(40, n * ch * 2, true)
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c))
  let o = 44
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const x = Math.max(-1, Math.min(1, data[c][i]))
      dv.setInt16(o, Math.round(x < 0 ? x * 32768 : x * 32767), true)
      o += 2
    }
  let s = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH) as unknown as number[])
  return btoa(s)
}

/**
 * QA / calibration: one sound alone through the real graph (never part of the story), starting at
 * 0.5 s. `sound` is a palette id, 'bed', 'bed.room', 'bed.tone', or an ambient layer kind; `dur` its
 * window in seconds; `flat` gives a constant speed (a linear source such as the D3 pour). Used to
 * calibrate each recipe's level against its I.3.2 target (amendment H.69).
 */
export async function renderSfx(view: StoryDef['key'], sound: string, dur = 1.2, flat = false, sr = 48000): Promise<string> {
  const ctx = new OfflineAudioContext(2, Math.ceil((dur + 5) * sr), sr)
  const g = buildGraph(ctx, { analysers: false })
  const bank = await bankFor(sr)
  const m: Mix = { ctx, bank, noise: noiseFor(ctx), key: keyFor(view), sfx: g.sfx, ui: g.ui, amb: g.bed, voices: new VoiceSet() }
  const speed = flat ? new Float32Array(32).fill(1) : new Float32Array(32).map((_, i) => Math.sin((Math.PI * (i + 0.5)) / 32))
  const prog = flat ? new Float32Array(32).map((_, i) => i / 31) : new Float32Array(32).map((_, i) => 0.5 - 0.5 * Math.cos((Math.PI * i) / 31))
  const shape = { a: 0, land: 1, half: 0.5, b: 1, speed, v0: 0, v1: 1, prog }
  if (sound.startsWith('bed')) {
    const bed = new Bed(ctx, g.bed)
    if (sound !== 'bed.tone') bed.startRoom(0, 0.01)
    if (sound !== 'bed.room') bed.startTone(view, bedStateAt(view, 3, 7, []), 0, 0.01)
  } else if (sound === 'rattle' || sound.startsWith('river.')) {
    const amb = new Ambient(m, [{ kind: sound as 'rattle', level: () => 1 }], 'P', 1)
    for (let t = 0; t < dur + 4; t += 0.05) amb.run(t, t + 0.05, 0, true)
  } else if (sound.startsWith('ui.')) {
    const { playUi } = await import('./palette')
    playUi(m, sound as 'ui.tap', 1, 0, 0.5)
  } else {
    const one = ['tick.dot', 'tick.label', 'tick.claim', 'tick.close', 'tick.steel', 'tick.meet', 'tick.card', 'clack', 'ball.drop', 'flip'].includes(sound)
    fireEvent(m, null, { name: 'lab', sound: sound as 'pen', cont: !one, t: 0, tb: 1, shape, u0: 0, gain: 0, pan: 0, pitch: 0, seed: 5, duck: [], rate: sound === 'clack.rain' ? () => 24 : undefined }, 0.5, dur, 0)
  }
  const out = await ctx.startRendering()
  return wavBase64(out)
}
