import type { Beat, Layout, NarrationClip, StoryDef, StoryKey } from '../types'
import type { ChartFrame } from '../kit/chartFrame'
import { at } from '../cue'
import { ease } from '../ease'
import { hash1 } from '../rng'
import { holdFor } from '../playback'
import { registry } from '../labels/registry'
import { cueFrom } from './cueFrom'
import { clipFor } from './narration'
import { CONTINUOUS } from './palette'
import { syncC, syncT, type Knots } from './hooks'
import type { ChapterSound, CueShape, CueSource, SfxCue, SfxId } from './types'

/* =========================================================================
   The beat plan (DESIGN.md I.6.4): what a beat will sound like and how long
   it lasts, computed BEFORE it plays from the manifest durations and the
   chapter's cue sources only. The phone and the offline reference render
   share it, so a render is the timeline the phone follows.
   ========================================================================= */

/** The clip starts this long after the beat starts (the caption swaps at t = 0). */
export const LEAD = 0.2
/** A chapter's beat 0, from `loaded` (after the slate). */
export const LEAD_FIRST = 0.35
/** After ui.on, when sound is turned on mid-beat. */
export const LEAD_TOGGLE = 0.35
/** After the clip file ends; with its 0.12 s tail, about 0.77 s after the last syllable. */
export const BREATH = 0.65
/** Wall time the lead waits for a clip still in flight, then the beat runs silent. */
export const WAIT_MAX = 2.0
/** The same for the first arm after enable() (its fetch started cold in the gesture). */
export const WAIT_FIRST = 5.0
/** Touch holds shorter than this do not pause the voice. */
export const SHORT_HOLD = 0.4
/** The pre-roll of a beat started by startBeat (C.3). */
export const PRE_ROLL = 0.15
/** No effect sounds in the first 150 ms of a beat (the caption swap: say it, then show it). */
export const QUIET_START = 0.15

/** One planned sound event of a beat, in beat t. */
export interface PlannedEvent {
  /** the cue's name, plus #i for a member of a set */
  name: string
  sound: SfxId
  cont: boolean
  /** beat t it starts (one-shots: fires) */
  t: number
  /** beat t it ends (continuous), = t for one-shots */
  tb: number
  /** continuous: the sampled segment */
  shape: CueShape | null
  /** continuous: start at this fraction of the segment (the quiet start) */
  u0: number
  /** dB from the palette level */
  gain: number
  pan: number | readonly [number, number] | 'orbit'
  /** semitones */
  pitch: number
  ring?: 'ripple' | 'shimmer'
  rate?: (t: number) => number
  seed: number
  /** segment fractions where a later overlapping continuous cue ducks this one 6 dB */
  duck: (readonly [number, number])[]
  /** flip: the snap tick at the window's end */
  endTick?: boolean
}

export interface BeatEvents {
  events: PlannedEvent[]
  /** beat t of the claim bell's first strike ('resolve') and of the loss ('resolve.fall'), or null */
  resolveAt: number | null
  fallAt: number | null
}

export interface BeatPlan extends BeatEvents {
  view: StoryKey
  index: number
  id: string
  last: boolean
  delay: number
  build: number
  hold: number
  lead: number
  clip: NarrationClip | null
  /** lead + clip + breath, or null without a clip */
  span: number | null
  /**
   * the beat's length from its start: max(delay + build + hold, span) (last beat: max(delay + build, span));
   * a synced beat (H.74) builds inside its voice and holds for the rest of it: span
   */
  total: number
  /** the build follows the voice (H.74): the clip's knots, or null (the designed rate) */
  knots: Knots | null
}

/** Seconds from a planned beat's start at which its build reaches t (the warp when synced, H.74). */
export function planSec(p: Pick<BeatPlan, 'delay' | 'build' | 'lead' | 'knots'>, t: number): number {
  if (!p.knots) return p.delay + t * p.build
  return p.lead + syncC(p.knots, p.delay - p.lead, p.build, t)
}

/** The build t a planned beat shows s seconds after its start (the inverse of planSec). */
export function planT(p: Pick<BeatPlan, 'delay' | 'build' | 'lead' | 'knots'>, s: number): number {
  if (!p.knots) return s <= p.delay ? 0 : Math.min(1, (s - p.delay) / Math.max(0.1, p.build))
  return Math.max(0, Math.min(1, syncT(p.knots, p.delay - p.lead, p.build, s - p.lead)))
}

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)

/* --------------------------- sources -> shapes --------------------------- */

const instant = (t: number): CueShape => ({ a: t, land: t, half: t, b: t, speed: FLAT, v0: 0, v1: 1, prog: RAMP })
const FLAT = new Float32Array(32).fill(1)
const RAMP = (() => {
  const r = new Float32Array(32)
  for (let i = 0; i < 32; i++) r[i] = i / 31
  return r
})()
const linear = (a: number, b: number): CueShape => ({ a, land: b, half: (a + b) / 2, b, speed: FLAT, v0: 0, v1: 1, prog: RAMP })

const pick = (shapes: readonly CueShape[], seg: number | 'all' | undefined): CueShape[] => {
  if (seg === 'all') return [...shapes]
  const s = shapes[seg ?? 0]
  return s ? [s] : []
}

const warned = new Set<string>()
const warnOnce = (k: string, m: string) => {
  if (warned.has(k)) return
  warned.add(k)
  console.warn('[audio] ' + m)
}

/** Label ids -> the first registered one's cue function. */
function labelCue(ids: string | readonly string[]): { id: string; fn: (T: number) => number } | null {
  const list = typeof ids === 'string' ? [ids] : ids
  for (const id of list) {
    const e = registry.get(id)
    if (e?.spec.cue) return { id, fn: e.spec.cue }
  }
  return null
}

/** Each source gives one or more GROUPS of shapes; a group is one event (or span) of a set. */
function resolveSource(src: CueSource, beat: Beat, n: number, layout: Layout, frame: ChartFrame | null, where: string): CueShape[][] {
  if ('fn' in src) return [pick(cueFrom(src.fn, n), src.seg)]
  if ('each' in src) {
    const out: CueShape[][] = []
    for (let i = 0; i < src.n; i++) {
      if (src.skip?.includes(i)) continue
      const each = src.each
      out.push(pick(cueFrom((T) => each(T, i), n), src.seg))
    }
    return out
  }
  if ('label' in src) {
    const hit = labelCue(src.label)
    if (!hit) {
      warnOnce(where, `${where}: label ${JSON.stringify(src.label)} is not registered in this layout; cue skipped`)
      return []
    }
    return [pick(cueFrom(hit.fn, n), src.seg)]
  }
  if ('labels' in src) {
    const out: CueShape[][] = []
    for (const id of src.labels(layout)) {
      const hit = labelCue(id)
      if (!hit) {
        warnOnce(where + id, `${where}: label "${id}" is not registered; that event is skipped`)
        continue
      }
      out.push(pick(cueFrom(hit.fn, n), src.seg))
    }
    return out
  }
  if ('cam' in src) {
    const w = beat.cam.window ?? [0, 0.35]
    return [pick(cueFrom((T) => at(T, n, w[0], w[1], ease.morph), n), 0)]
  }
  if ('impact' in src) {
    const w = beat.impact
    if (!w) {
      warnOnce(where, `${where}: the beat has no impact window; cue skipped`)
      return []
    }
    return [[{ ...linear(w[0], w[1]), land: w[0], half: w[0] }]]
  }
  if ('times' in src) return src.times(layout, frame).map((t) => [instant(clamp(t, 0, 1))])
  if ('spans' in src) return src.spans(layout, frame).map(([a, b]) => [linear(clamp(a, 0, 1), clamp(b, 0, 1))])
  return []
}

function onOf(s: CueShape, on: SfxCue['on']): number {
  if (on === undefined || on === 'start') return s.a
  if (on === 'land') return s.land
  if (on === 'half') return s.half
  if (on === 'end') return s.b
  return s.a + (s.b - s.a) * clamp(on, 0, 1)
}

const pitchAt = (p: SfxCue['pitch'], i: number): number => (p === undefined ? 0 : typeof p === 'number' ? p : (p[Math.min(i, p.length - 1)] ?? 0))

/* ------------------------------ events ------------------------------ */

const cache = new Map<string, BeatEvents>()

/** Forget cached plans (a chapter change, a frame or layout change is keyed anyway). */
export function clearPlans(): void {
  cache.clear()
}

/**
 * The beat's sound events, in beat t. Sampled IN STORY MODE (cue functions may read the store),
 * cached per chapter, beat, layout, chart frame and delay.
 */
export function beatEvents(def: StoryDef, sound: ChapterSound | null, n: number, layout: Layout, frame: ChartFrame | null, frameKey: string, delay: number): BeatEvents {
  const beat = def.beats[n]
  const key = `${def.key}|${n}|${layout}|${frameKey}|${delay}|${sound ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const out: BeatEvents = { events: [], resolveAt: null, fallAt: null }
  if (!beat || !sound) {
    cache.set(key, out)
    return out
  }
  const cues = sound.cues[beat.id] ?? []
  const tMin = clamp((QUIET_START - delay) / Math.max(0.1, beat.build), 0, 1)
  cues.forEach((cue, ci) => {
    const where = `${def.key}/${beat.id}/${cue.name}`
    let groups: CueShape[][]
    try {
      groups = resolveSource(cue.from, beat, n, layout, frame, where)
    } catch (err) {
      warnOnce(where, `${where}: source threw (${err instanceof Error ? err.message : String(err)}); cue skipped`)
      return
    }
    const cont = CONTINUOUS.has(cue.sound) && cue.sound !== 'resolve' && cue.sound !== 'resolve.fall'
    const gain = clamp(cue.gain ?? 0, -12, 3)
    const pan = cue.pan === undefined ? 0 : cue.pan
    const made: PlannedEvent[] = []
    let k = 0
    for (const g of groups) {
      for (const s of g) {
        const seed = Math.floor(hash1((n + 1) * 7919 + ci * 131 + k * 17 + def.key.length) * 0x7fffffff)
        if (cont) {
          if (s.b <= s.a) continue
          const a = s.a
          const u0 = a < tMin ? clamp((tMin - a) / (s.b - a), 0, 0.95) : 0
          made.push({ name: groups.length > 1 ? `${cue.name}#${k}` : cue.name, sound: cue.sound, cont: true, t: a, tb: s.b, shape: s, u0, gain, pan, pitch: pitchAt(cue.pitch, k), rate: cue.rate, seed, duck: [], ring: cue.ring })
        } else {
          const t = Math.max(tMin, onOf(s, cue.on))
          made.push({
            name: groups.length > 1 ? `${cue.name}#${k}` : cue.name,
            sound: cue.sound,
            cont: false,
            t,
            tb: cue.sound === 'resolve' || cue.sound === 'resolve.fall' ? Math.max(t, s.b) : t,
            shape: cue.sound === 'resolve' || cue.sound === 'resolve.fall' || cue.sound === 'flip' ? s : null,
            u0: 0,
            gain,
            pan,
            pitch: pitchAt(cue.pitch, k),
            ring: cue.ring,
            seed,
            duck: [],
            endTick: cue.sound === 'flip',
          })
        }
        k++
      }
    }
    // a staggered set: at most 6 audible, or the cue's `max` (the first, the last and evenly between),
    // each 0.6 dB softer than the one before, at least 45 ms apart at this beat's build rate (closer
    // events merge)
    if (!cont && made.length > 1) {
      made.sort((x, y) => x.t - y.t)
      const minDt = 0.045 / Math.max(0.1, beat.build)
      const spaced: PlannedEvent[] = []
      for (const e of made) if (!spaced.length || e.t - spaced[spaced.length - 1].t >= minDt) spaced.push(e)
      const cap = Math.round(clamp(cue.max ?? 6, 2, 6))
      let keep = spaced
      if (spaced.length > cap) {
        keep = []
        for (let i = 0; i < cap; i++) keep.push(spaced[Math.round((i * (spaced.length - 1)) / (cap - 1))])
      }
      keep.forEach((e, i) => (e.gain = gain - 0.6 * i))
      out.events.push(...keep)
    } else out.events.push(...made)
    if (cue.sound === 'resolve' && out.resolveAt === null && made[0]) out.resolveAt = made[0].t
    if (cue.sound === 'resolve.fall' && out.fallAt === null && made[0]) out.fallAt = made[0].t
  })
  out.events.sort((x, y) => x.t - y.t)
  // never two continuous effects at full level at once: the earlier ducks 6 dB for the overlap
  const conts = out.events.filter((e) => e.cont)
  for (let i = 0; i < conts.length; i++)
    for (let j = i + 1; j < conts.length; j++) {
      const e = conts[i]
      const f = conts[j]
      const o0 = Math.max(e.t, f.t)
      const o1 = Math.min(e.tb, f.tb)
      if (o1 > o0 && e.tb > e.t) e.duck.push([(o0 - e.t) / (e.tb - e.t), (o1 - e.t) / (e.tb - e.t)])
    }
  budget(out.events, beat.build)
  cache.set(key, out)
  return out
}

/**
 * At most 16 transient events in any second (a token bucket, 16 per second, burst 4). The quietest
 * staggered-set members yield first; a claim or a single mark never yields.
 */
function budget(events: PlannedEvent[], build: number): void {
  let tokens = 4
  let last = 0
  for (const e of events) {
    if (e.cont) continue
    const time = e.t * build
    tokens = Math.min(4, tokens + (time - last) * 16)
    last = time
    if (tokens >= 1) tokens -= 1
    else if (e.name.includes('#')) e.gain = -99
  }
  for (let i = events.length - 1; i >= 0; i--) if (events[i].gain <= -99) events.splice(i, 1)
}

/* ------------------------------ timing ------------------------------ */

export interface TimingOpts {
  delay: number
  lead: number
  /** beat seconds already elapsed when the clip was armed (mid-beat arming) */
  armedAt?: number
  /** sound is on: the clip drives the hold */
  narrate: boolean
  /** reduced motion (or a self-clocked step): the build is a cut, never synced (H.74) */
  reduced?: boolean
}

export function beatTiming(def: StoryDef, n: number, o: TimingOpts): Pick<BeatPlan, 'delay' | 'build' | 'hold' | 'lead' | 'clip' | 'span' | 'total' | 'last' | 'id' | 'index' | 'view' | 'knots'> {
  const beat = def.beats[n]
  const last = n >= def.beats.length - 1
  const build = beat?.build ?? 0
  const hold = holdFor(beat)
  const clip = o.narrate && beat ? clipFor(def, beat.id) : null
  const span = clip ? o.lead + clip.dur + BREATH : null
  // H.74: a synced beat's build ends inside its clip (narration-check) and its hold is the rest of the voice
  const knots = clip && !o.reduced && clip.sync.length > 0 ? clip.sync : null
  const base = knots ? 0 : o.delay + build + (last ? 0 : hold)
  const total = Math.max(base, span === null ? 0 : (o.armedAt ?? 0) + span)
  return { view: def.key, index: n, id: beat?.id ?? '', last, delay: o.delay, build, hold, lead: o.lead, clip, span, total, knots }
}

/** The claim kinds each beat plans (for the bed state at a beat start, I.2.5). */
export function claimsOf(def: StoryDef, sound: ChapterSound | null): string[][] {
  return def.beats.map((b) => (sound?.cues[b.id] ?? []).filter((c) => c.sound === 'resolve' || c.sound === 'resolve.fall').map((c) => c.sound))
}
