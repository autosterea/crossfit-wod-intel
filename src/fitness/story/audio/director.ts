import { create } from 'zustand'
import type { StoryDef, StoryKey } from '../types'
import { clock, onFrame } from '../clock'
import { useStoryStore, type StoryState } from '../store'
import { holdFor, pb, readingHold } from '../playback'
import { frameId, storyFrame } from '../kit/chartFrame'
import { readyState } from '../ready'
import { useFitnessStore } from '../../fitnessStore'
import { audioHooks, narr } from './hooks'
import { buildGraph, DUCK, glide, rmsDb, type Graph } from './graph'
import { bankFor } from './bank'
import { Bed, bedStateAt, keyFor } from './bed'
import { noiseFor } from './noise'
import { playUi, uiOn, VoiceSet, type Mix } from './palette'
import { Ambient } from './ambient'
import { fireEvent } from './fire'
import type { NarrationClip } from '../types'
import { ClipCache, clipFor, fetchClip, isNarrated, keepBytes, makeupFor } from './narration'
import {
  BREATH,
  LEAD,
  LEAD_FIRST,
  LEAD_TOGGLE,
  PRE_ROLL,
  SHORT_HOLD,
  WAIT_FIRST,
  WAIT_MAX,
  beatEvents,
  beatTiming,
  claimsOf,
  clearPlans,
  type BeatEvents,
} from './plan'
import { readPref, soundQuery, tickStyle, writePref } from './prefs'
import type { AudioLevels, AudioQA, AudioState, ChapterSound, UiId } from './types'

/* =========================================================================
   The AudioDirector (DESIGN.md I.4, I.6.3, I.6.4). One singleton that owns
   the viewer's choice, the unlock, the AudioContext, the voice, the cue
   scheduling, the bed and the QA readouts, and installs audioHooks.

   Nothing here touches useStoryStore at module scope, and no AudioContext
   exists until a user gesture calls enable() (or ?sound=1 asks for one).
   Only a story that declares narration is LIVE (amendment H.72): on any
   other story (every /fitness chapter, MetFix modules 3 to 8) the director
   is inert, as if sound were off: no sound UI, no unlock listener, no
   context, no ui sounds, no M key, and the C.3 timing.
   Engine files never import this module (they import hooks.ts only), apart
   from StoryProvider and the two sound controls.
   ========================================================================= */

/* ------------------------------ UI state ------------------------------ */

export interface SoundUi {
  /** the viewer's choice (or ?sound=1) */
  enabled: boolean
  /** audio is running */
  running: boolean
  /** ?sound=0: the chip never shows */
  forcedOff: boolean
  /** the stored choice at page load was undecided or '1' */
  undecided: boolean
  /** bumps when the toggle should ring once (the chip retired or was used) */
  ring: number
  /** the chip has been retired for this session (3 beats ignored, or used) */
  chipRetired: boolean
}

export const useSoundUi = create<SoundUi>(() => ({
  enabled: false,
  running: false,
  forcedOff: false,
  undecided: true,
  ring: 0,
  chipRetired: false,
}))

/* ------------------------------ helpers ------------------------------ */

type AudioSessionNav = Navigator & { audioSession?: { type: string } }
const nav = (): AudioSessionNav | null => (typeof navigator !== 'undefined' ? (navigator as AudioSessionNav) : null)
function setSession(type: 'playback' | 'auto'): void {
  try {
    const n = nav()
    if (n && n.audioSession && n.audioSession.type !== type) n.audioSession.type = type
  } catch {
    /* unsupported */
  }
}

const isHidden = () => typeof document !== 'undefined' && document.hidden

type VoiceStateName = 'lead' | 'waiting' | 'playing' | 'paused' | 'breath'

interface Run {
  view: StoryKey
  index: number
  clip: NarrationClip
  lead: number
  span: number
  state: VoiceStateName
  waitMax: number
  waited: number
  src: AudioBufferSourceNode | null
  cut: GainNode | null
  startCtx: number
  startOffset: number
  position: number
  /** the worker advances `elapsed` while the story is not playing (a reduced-motion step narrates once) */
  selfClock: boolean
}

const dbToLin = (d: number) => Math.pow(10, d / 20)

/** I.3.6: after this long with nothing audible (paused, held) the context idle-suspends and the session returns to 'auto'. */
const IDLE_MS = 12000

/* ------------------------------ director ------------------------------ */

class Director {
  enabled = false
  forcedOff = false
  qa = false
  ctx: AudioContext | null = null
  graph: Graph | null = null
  mix: Mix | null = null
  bed: Bed | null = null
  clips: ClipCache | null = null
  ambient: Ambient | null = null
  unlocked = false
  interrupted = false
  private wired = false
  private unlockOn = false
  def: StoryDef | null = null
  /** the current story declares narration (H.72); nothing sounds, listens or creates a context otherwise */
  live = false
  sound: ChapterSound | null = null
  private soundFor: StoryKey | null = null
  private soundLoading: StoryKey | null = null
  run: Run | null = null
  private finished: string | null = null
  private events: BeatEvents | null = null
  private eventsKey = ''
  private cueIdx = 0
  private build = 1
  private plannedIndex = -1
  private userPaused = false
  private holdT = 0
  private autoNext = false
  private lastGlide: unknown = null
  private glideLanding = false
  private grace = 0
  private prev: Partial<StoryState> = {}
  private lastT = 0
  private legit = false
  private lastInput = -1e9
  private stepInput = -1
  private inputSerial = 0
  private lastSeekIndex = -1
  private exploreIdle = 0
  private exploreFaded = false
  private doneAt = -1
  private idleTimer = 0
  private leaveTimer = 0
  private hiddenArmed = false
  private seedN = 1
  private pendingToneFor: StoryKey | null = null
  private errAt = -1e9
  limiterMin = 0
  private levelBuf: Float32Array<ArrayBuffer> | null = null
  private firstArm = false
  private enabledAt = -1e9
  private hidden = false

  /* ------------------------------ state ------------------------------ */

  /** audio can be heard now (enabled, a running context) */
  audible(): boolean {
    return this.live && this.enabled && !!this.ctx && this.ctx.state === 'running' && !this.interrupted
  }

  contextState(): AudioState {
    if (!this.ctx) return 'none'
    if (this.interrupted) return 'interrupted'
    return this.ctx.state as AudioState
  }

  /**
   * Sound is on as far as the viewer is concerned: the context runs, or it sleeps in the director's own
   * idle suspend (I.3.6: nothing audible for a while, so the viewer's music can resume). Idle is NOT
   * Waiting, which I.5.2 reserves for a context never unlocked or interrupted by the device: while idle
   * the toggle shows On, a tap or M turns sound off, and the chip stays away. Play, a step, a chapter
   * start and an explore touch wake it; any tap in the lesson also does (the unlock listener).
   */
  uiRunning(): boolean {
    return this.enabled && !!this.ctx && !this.interrupted && (this.ctx.state === 'running' || this.idle)
  }

  private syncUi(): void {
    const running = this.uiRunning()
    const s = useSoundUi.getState()
    const next: Partial<SoundUi> = {}
    if (s.enabled !== this.enabled || s.running !== running || s.forcedOff !== this.forcedOff) Object.assign(next, { enabled: this.enabled, running, forcedOff: this.forcedOff })
    // audio has run: the chip's one question is answered for this page (I.5.1 "asks once")
    if (running && !s.chipRetired) next.chipRetired = true
    if (Object.keys(next).length) useSoundUi.setState(next)
    if (this.enabled && !!this.ctx && this.ctx.state === 'running' && !this.interrupted) this.detachUnlock()
    else if (this.enabled && this.live) this.attachUnlock()
    else this.detachUnlock()
  }

  private latency(): number {
    const c = this.ctx
    if (!c) return 0
    const l = (c as AudioContext & { outputLatency?: number }).outputLatency || c.baseLatency || 0
    return Math.max(0, Math.min(0.25, l))
  }

  /* --------------------------- the context --------------------------- */

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const C = W.AudioContext || W.webkitAudioContext
    if (!C) return null
    let ctx: AudioContext
    try {
      ctx = new C({ latencyHint: 'interactive' })
    } catch {
      return null
    }
    this.ctx = ctx
    const graph = buildGraph(ctx, { analysers: this.qa || import.meta.env.DEV })
    this.graph = graph
    this.mix = { ctx, bank: null, noise: noiseFor(ctx), key: keyFor(this.def?.key), sfx: graph.sfx, ui: graph.ui, amb: graph.bed, voices: new VoiceSet() }
    this.bed = new Bed(ctx, graph.bed)
    this.clips = new ClipCache(ctx)
    graph.bedMode.gain.value = 0
    ctx.onstatechange = () => this.onState()
    bankFor(ctx.sampleRate)
      .then((b) => {
        if (this.mix && this.mix.ctx === ctx) this.mix.bank = b
      })
      .catch(() => console.warn('[audio] the transient bank failed to render; ticks stay silent'))
    return ctx
  }

  private onState(): void {
    const c = this.ctx
    if (!c) return
    const st = c.state as string
    if (st === 'running') {
      this.unlocked = true
      this.idle = false
      if (this.interrupted) {
        // the next gesture resumed the context; it resumes the story too (I.4 "Audio interrupted"),
        // through the normal play path, so the paused Run continues from its recorded position
        this.interrupted = false
        const resumeStory = this.pausedByInterrupt
        this.pausedByInterrupt = false
        const s = useStoryStore.getState()
        if (resumeStory && s.def && !s.playing) s.play()
      }
    } else if ((st === 'interrupted' || st === 'suspended') && this.enabled && !this.suspending && !isHidden()) {
      // an audio interruption (a call, Siri, another app): pause the story, the toggle shows Waiting
      if (!this.interrupted) {
        this.interrupted = true
        this.idle = false
        this.pauseVoice()
        const s = useStoryStore.getState()
        if (s.playing) {
          this.pausedByInterrupt = true
          s.pause()
        }
      }
    }
    this.syncUi()
  }
  private pausedByInterrupt = false
  private suspending = false
  /** the context sleeps in the director's own idle suspend (sound stays on for the viewer) */
  private idle = false
  /** the bed mode level last asked for (0 when paused, held, done or off) */
  private bedV = 0
  /** bumps on every wake, so a late idle-suspend callback never sets the session back to 'auto' */
  private sleepSerial = 0

  /* ---------------------------- enable ---------------------------- */

  /**
   * MUST run synchronously inside a user gesture handler (source 'qa' excepted): sets the audio
   * session, creates or resumes the context, plays ui.on, starts the current and next clips'
   * fetches, starts the bank render, starts the bed, arms the current beat, stores '1'.
   */
  enable(source: 'chip' | 'toggle' | 'key' | 'gesture' | 'qa'): void {
    // a story without narration has no sound (H.72): nothing here may create or wake a context
    if (!this.live) return
    setSession('playback')
    const had = !!this.ctx
    const ctx = this.ensureContext()
    if (!ctx) {
      console.warn('[audio] Web Audio is unavailable; the story runs silent')
      return
    }
    window.clearTimeout(this.idleTimer)
    this.suspending = false
    // bumps past any pending disable() or idle-suspend callback, so neither can set the session back to
    // 'auto' (or suspend) after this gesture turned sound on (fix round 2: a double tap on the toggle)
    this.sleepSerial++
    // a stale hide flag would make the next real hide a no-op (fix round 2); the document is the truth
    this.hidden = isHidden()
    // one tap fires pointerup, touchend and click: the first enables, the rest only resume
    const tNow = performance.now()
    const again = had && this.enabled && tNow - this.enabledAt < 600
    this.enabledAt = tNow
    // WAKING, not turning on: sound was already on and this context has run before (the director's own
    // idle suspend, a device interruption, a refused resume after unlock, a later event of the same
    // tap), or it runs now. Only the context and the master resume: a paused Run keeps its position and
    // nothing re-arms (I.4 Pause / Resume). After an interruption, 'interrupted' stays set until the
    // context runs, and then onState resumes the story (the toggle keeps Waiting until then).
    const waking = again || (had && this.enabled && (this.unlocked || (ctx.state === 'running' && !this.interrupted)))
    this.enabled = true
    this.forcedOff = false
    if (source !== 'qa' && soundQuery() !== 0) writePref('1')
    if (!waking) this.interrupted = false
    const master = this.graph!.master.gain
    master.cancelScheduledValues(ctx.currentTime)
    master.setValueAtTime(master.value, ctx.currentTime)
    master.linearRampToValueAtTime(1, ctx.currentTime + 0.15)
    try {
      const p = ctx.resume()
      p.then(() => this.onState()).catch(() => this.onState())
    } catch {
      /* ignore */
    }
    if (waking) {
      // a wake with nothing to play (a tap on a paused or finished chapter) sleeps again after IDLE_MS
      if (!again) {
        this.idleSuspendSoon(IDLE_MS)
        this.bedModeForState(0.8)
      }
      this.syncUi()
      return
    }
    const explicit = source === 'chip' || source === 'toggle' || source === 'key'
    if (explicit && this.mix) uiOn(this.mix, ctx.currentTime + 0.01)
    // the current and next clips' fetches start inside the gesture's task
    const def = this.def
    if (def && this.clips) {
      for (const k of [clock.index, clock.index + 1]) {
        const b = def.beats[k]
        const c = b ? clipFor(def, b.id) : null
        if (c) void this.clips.load(c)
      }
    }
    this.loadSound()
    // the bed fades in over 2.5 s
    this.startBed(ctx.currentTime, 2.5)
    this.firstArm = true
    // a Run that has already sounded (paused, or in its breath) is never re-armed from its start
    if (!this.run || this.run.state === 'lead' || this.run.state === 'waiting') this.armForState(explicit ? LEAD_TOGGLE : LEAD, WAIT_FIRST)
    this.bedModeForState(0.8)
    this.syncUi()
    this.prefetchIdle()
  }

  /** Cuts everything, fades the master, suspends the context, session 'auto', stores '0'. */
  disable(): void {
    // H.74: a synced beat's hold was the rest of its voice; without the voice it reverts to the reading rule
    const st0 = useStoryStore.getState()
    if (narr.sync && st0.phase === 'hold' && this.def && clock.index < this.def.beats.length - 1) pb.holdFor = holdFor(this.def.beats[clock.index])
    const ctx = this.ctx
    this.enabled = false
    this.idle = false
    window.clearTimeout(this.idleTimer)
    if (soundQuery() !== 0) writePref('0')
    if (ctx && this.graph) {
      const now = ctx.currentTime
      this.cutVoice(0.08)
      this.mix?.voices.stopAll(ctx, now, 0.02, true)
      this.ambient?.hush(now)
      glide(this.graph.bedMode.gain, 0, now, 0.1)
      this.bedV = 0
      glide(this.graph.master.gain, 0, now, 0.066)
      this.suspending = true
      // Guarded (fix round 2): sound turned off and on again inside 220 ms (a double tap, M twice) must
      // not end with the session at 'auto' while sound is on: on an iPhone in silent mode 'auto' mutes
      // Web Audio without a trace (O2). enable() bumps sleepSerial, which cancels this.
      const serial = ++this.sleepSerial
      window.setTimeout(() => {
        if (this.enabled || serial !== this.sleepSerial) return
        if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => undefined)
        setSession('auto')
      }, 220)
    } else setSession('auto')
    // the hold reverts to holdFor; if that has already passed the beat advances 0.6 s later, never at once
    this.grace = 0.6
    narr.armed = false
    narr.sounding = false
    narr.sync = null
    this.detachUnlock()
    if (soundQuery() !== 0) useSoundUi.setState({ undecided: false })
    this.syncUi()
  }

  /** A UI sound now (no-op unless audible). */
  ui(id: UiId, gain = 0): void {
    if (!this.audible() || !this.mix) return
    playUi(this.mix, id, this.seedN++, gain)
  }

  /* --------------------------- chapter --------------------------- */

  /**
   * StoryProvider's layout effect (def) and its cleanup (null). The FIRST call subscribes to the store,
   * adds the document listeners, registers the frame worker and installs audioHooks.
   */
  setChapter(def: StoryDef | null): void {
    const live = isNarrated(def)
    if (!this.wired) {
      this.live = live
      this.wire()
    }
    window.clearTimeout(this.leaveTimer)
    if (!def) {
      // the provider's cleanup runs right before the next chapter's effect: decide on a timer
      const leaving = this.def
      this.def = null
      this.live = false
      this.detachUnlock()
      this.cutVoice(0.15)
      if (this.ctx) this.mix?.voices.stopAll(this.ctx, this.ctx.currentTime, 0.02)
      this.leaveTimer = window.setTimeout(() => {
        if (this.def || !leaving) return
        // the lesson unmounted: fade out and let the context sleep
        const c = this.ctx
        if (c && this.graph) {
          glide(this.graph.bedMode.gain, 0, c.currentTime, 0.3)
          this.bedV = 0
          this.idleSuspendSoon(1500)
        }
        // and drop the decoded window and the kept bytes (I.3.6): the lesson may not come back
        this.clips?.retain(new Set())
        keepBytes(new Set())
      }, 0)
      return
    }
    const prevView = this.bed?.view ?? null
    const changed = !this.def || this.def.key !== def.key
    const wasLive = this.live
    this.def = def
    this.live = live
    this.prev = {}
    this.lastT = clock.T
    this.finished = null
    this.events = null
    this.eventsKey = ''
    this.plannedIndex = -1
    this.userPaused = false
    this.doneAt = -1
    if (this.mix) this.mix.key = keyFor(def.key)
    if (changed) {
      clearPlans()
      this.cutVoice(0.15)
      const c = this.ctx
      if (c) {
        this.mix?.voices.stopAll(c, c.currentTime, 0.02)
        this.ambient?.stop(c.currentTime)
        this.ambient = null
        // the old tone fades over 1.2 s; the new one fades in over 2.5 s from the chapter's loaded
        if (prevView && prevView !== def.key) this.bed?.fadeTone(c.currentTime, 1.2)
      }
      this.pendingToneFor = def.key
      this.sound = null
      this.soundFor = null
      this.clips?.retain(new Set())
      this.keepChapterBytes()
    }
    if (!live) {
      // H.72: a story without narration has no sound at all. A context left by a narrated story fades its
      // bed and sleeps (the idle suspend), nothing listens for an unlock and the sound UI is not shown.
      const c = this.ctx
      if (c && this.graph) {
        glide(this.graph.bedMode.gain, 0, c.currentTime, 0.3)
        this.bedV = 0
        this.idleSuspendSoon(1500)
      }
      this.pendingToneFor = null
      this.syncUi()
      this.snapshotPrev()
      return
    }
    // back on a narrated story after one without narration: the master returns (a hide there left it at 0)
    if (!wasLive && this.enabled && this.ctx && this.graph && !isHidden()) {
      const m = this.graph.master.gain
      const now = this.ctx.currentTime
      m.cancelScheduledValues(now)
      m.setValueAtTime(m.value, now)
      m.linearRampToValueAtTime(1, now + 0.15)
    }
    if (this.enabled || this.qa || import.meta.env.DEV) this.loadSound()
    if (this.qa && this.enabled && !this.ctx) this.enable('qa')
    // the chapter loads under the slate: fetch and decode its first clips now, so beat 0 speaks LEAD_FIRST after loaded
    if (this.enabled && this.ctx) this.loadWindow(clock.index)
    this.syncUi()
    this.snapshotPrev()
  }

  /** Load the current chapter's sound.ts (a small lazy chunk). A beat planned before it arrives narrates without cues. */
  private loadSound(): void {
    const def = this.def
    if (!def || this.soundFor === def.key || this.soundLoading === def.key) return
    const loader = SOUND_MODULES[`../../stories/${def.key}/sound.ts`]
    if (!loader) {
      this.soundFor = def.key
      this.sound = null
      return
    }
    const view = def.key
    this.soundLoading = view
    loader()
      .then((m) => {
        this.soundLoading = null
        if (this.def?.key !== view) return
        this.sound = m.default
        this.soundFor = view
        this.events = null
        this.eventsKey = ''
      })
      .catch((err) => {
        this.soundLoading = null
        console.warn('[audio] ' + view + '/sound.ts failed to load: ' + (err instanceof Error ? err.message : String(err)))
        this.soundFor = view
      })
  }

  /** await the current chapter's sound module (renderAudio). */
  async soundReady(): Promise<ChapterSound | null> {
    const def = this.def
    if (!def) return null
    if (this.soundFor === def.key) return this.sound
    const loader = SOUND_MODULES[`../../stories/${def.key}/sound.ts`]
    if (!loader) return null
    const m = await loader()
    if (this.def?.key === def.key) {
      this.sound = m.default
      this.soundFor = def.key
    }
    return m.default
  }

  /**
   * Encoded bytes are kept for the current story (I.3.6; H.72: the narration belongs to each StoryDef, so
   * the next story's clips are fetched when it loads under the slate, its beats 0 and 1 first).
   */
  private keepChapterBytes(): void {
    const def = this.def
    if (!def) return
    keepBytes(new Set(Object.values(def.narration ?? {}).map((c) => c.file)))
  }

  /** At idle: the rest of the chapter's clips (bytes only). */
  private prefetchIdle(): void {
    const def = this.def
    if (!def) return
    const run = () => {
      if (!this.enabled || this.def !== def) return
      for (const b of def.beats) {
        const c = clipFor(def, b.id)
        if (c) void fetchClip(c)
      }
    }
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(run)
    else window.setTimeout(run, 1500)
  }

  /* ------------------------------ bed ------------------------------ */

  private startBed(when: number, fade: number): void {
    const def = this.def
    if (!this.bed || !def) return
    this.bed.startRoom(when, fade)
    const st = useStoryStore.getState()
    if (!st.loaded) {
      this.pendingToneFor = def.key
      return
    }
    if (this.bed.view !== def.key) {
      const n = clock.index
      this.bed.startTone(def.key, bedStateAt(def.key, n, def.beats.length, claimsOf(def, this.sound)), when, fade)
      this.pendingToneFor = null
    }
  }

  /** The bed's mode gain for the story state (I.3.1): playing 0 dB, explore -4 dB, paused / held silent. */
  private bedModeForState(tau: number): void {
    const c = this.ctx
    const g = this.graph
    if (!c || !g || !this.enabled || !this.live) return
    const st = useStoryStore.getState()
    const now = c.currentTime
    let v = 0
    if (st.mode === 'explore') v = this.exploreFaded ? 0 : dbToLin(-4)
    else if (this.doneAt >= 0 && !this.voicePlaying()) return
    else if (this.voicePlaying() || (st.playing && !clock.held && st.loaded && pb.visible && !isHidden() && this.holdT < SHORT_HOLD)) v = 1
    else if (st.reduced && this.run && this.run.state !== 'breath') v = 1
    glide(g.bedMode.gain, v, now, v > g.bedMode.gain.value ? tau / 3 : 0.4)
    this.bedV = v
    if (v === 0 && !this.voicePlaying()) this.idleSuspendSoon(IDLE_MS)
    else {
      window.clearTimeout(this.idleTimer)
      if (this.idle) this.wake()
    }
  }

  /** After a long silence the context suspends and the audio session returns to 'auto' (the viewer's music resumes). */
  private idleSuspendSoon(ms: number): void {
    window.clearTimeout(this.idleTimer)
    this.idleTimer = window.setTimeout(() => {
      const c = this.ctx
      if (!c || !this.enabled || this.voicePlaying() || c.state !== 'running' || this.interrupted) return
      const st = useStoryStore.getState()
      if (this.live && st.playing && st.mode === 'story' && this.def) return
      // the bed should still sound (explore): not idle yet. The intended level, not AudioParam.value,
      // which WebKit need not update from automation on the main thread.
      if (this.live && this.bedV > 0) return
      this.suspending = true
      // idle, not Waiting: sound stays on for the viewer (uiRunning) and the next play wakes it
      this.idle = true
      const serial = ++this.sleepSerial
      c.suspend()
        .catch(() => undefined)
        .finally(() => {
          if (this.idle && serial === this.sleepSerial) setSession('auto')
          this.syncUi()
        })
    }, ms)
  }

  /** Wake an idle-suspended context (inside the gesture that resumed the story). */
  private wake(): void {
    const c = this.ctx
    window.clearTimeout(this.idleTimer)
    if (!c || !this.enabled) return
    if (c.state !== 'running') {
      setSession('playback')
      this.suspending = false
      this.sleepSerial++
      c.resume()
        .then(() => this.onState())
        .catch(() => this.onState())
    }
  }

  /* ------------------------------ voice ------------------------------ */

  voicePlaying(): boolean {
    return !!this.run && this.run.state === 'playing'
  }

  /** Arm beat n's clip (I.6.4). */
  private arm(n: number, o: { lead: number; delay: number; armedAt: number; waitMax: number; selfClock?: boolean }): void {
    this.cutVoice(0.08)
    const def = this.def
    if (!def || !this.enabled || !this.live || !this.clips) return
    if (this.idle) this.wake()
    const beat = def.beats[n]
    if (!beat) return
    const clip = clipFor(def, beat.id)
    if (!clip) {
      if (import.meta.env.DEV) console.warn(`[audio] no narration clip for ${def.key}/${beat.id}`)
      return
    }
    if (this.clips.state(clip).s === 'failed') return
    const span = o.lead + clip.dur + BREATH
    const t = beatTiming(def, n, { delay: o.delay, lead: o.lead, armedAt: o.armedAt, narrate: true, reduced: !!o.selfClock || useStoryStore.getState().reduced })
    this.run = {
      view: def.key,
      index: n,
      clip,
      lead: o.lead,
      span,
      state: 'lead',
      waitMax: o.waitMax,
      waited: 0,
      src: null,
      cut: null,
      startCtx: 0,
      startOffset: 0,
      position: 0,
      selfClock: !!o.selfClock,
    }
    narr.armed = true
    narr.elapsed = 0
    narr.lead = o.lead
    narr.span = span
    narr.armedAt = o.armedAt
    narr.sounding = false
    narr.waiting = 0
    narr.total = t.total
    // H.74: the build follows the voice (from where it stands: armed mid-beat, it waits for the voice to catch
    // up). Not under reduced motion or a self-clocked step: there the build is a cut or a replay.
    narr.sync = t.knots
    narr.c0 = o.delay - o.lead
    narr.build = Math.max(0.1, beat.build)
    this.loadWindow(n)
  }

  /** The decoded window is beats [n-1, n+2] (Prev is common). */
  private loadWindow(n: number): void {
    const def = this.def
    const cc = this.clips
    if (!def || !cc) return
    const keep = new Set<string>()
    for (let k = n - 1; k <= n + 2; k++) {
      const b = def.beats[k]
      const c = b ? clipFor(def, b.id) : null
      if (c) {
        keep.add(c.file)
        void cc.load(c)
      }
    }
    cc.retain(keep)
  }

  private disarm(): void {
    this.run = null
    narr.armed = false
    narr.sounding = false
    narr.waiting = 0
    narr.sync = null
  }

  /**
   * Cut: the voice ramps to 0 over `fade` and stops; the clip is disarmed. `keepDucks` (an autoplay
   * advance only): the finished clip's scheduled release, or its bridge into this beat's clip, stays in
   * place instead of releasing now (fix round 2: the bed pumped at every early sentence change).
   */
  private cutVoice(fade: number, keepDucks = false): void {
    const r = this.run
    const c = this.ctx
    if (r && c && r.src && r.cut) {
      const now = c.currentTime
      r.cut.gain.cancelScheduledValues(now)
      r.cut.gain.setValueAtTime(r.cut.gain.value, now)
      r.cut.gain.linearRampToValueAtTime(0, now + fade)
      try {
        r.src.stop(now + fade + 0.01)
      } catch {
        /* ignore */
      }
    }
    if (r && !keepDucks) this.releaseDucks()
    this.disarm()
  }

  private startVoice(r: Run, offset: number, wait: number, fadeIn: number): void {
    const c = this.ctx
    const g = this.graph
    const cc = this.clips
    if (!c || !g || !cc) return
    const st = cc.state(r.clip)
    if (st.s !== 'ready') return
    const src = c.createBufferSource()
    src.buffer = st.buf
    const mk = c.createGain()
    mk.gain.value = makeupFor(r.clip)
    const cut = c.createGain()
    const when = c.currentTime + Math.max(0, wait)
    if (fadeIn > 0) {
      cut.gain.setValueAtTime(0, when)
      cut.gain.linearRampToValueAtTime(1, when + fadeIn)
    }
    src.connect(mk).connect(cut).connect(g.voice)
    src.start(when, Math.max(0, Math.min(offset, st.buf.duration - 0.01)))
    src.onended = () => {
      src.disconnect()
      mk.disconnect()
    }
    r.src = src
    r.cut = cut
    r.startCtx = when
    r.startOffset = offset
    r.state = 'playing'
    narr.sounding = true
    this.scheduleDucks(r, when, offset)
  }

  /** Pause: record the audio-clock position at the start of a 60 ms fade and stop the source. */
  pauseVoice(): void {
    const r = this.run
    const c = this.ctx
    if (!r || !c || r.state !== 'playing' || !r.src || !r.cut) return
    const now = c.currentTime
    r.position = Math.max(0, Math.min(r.clip.dur, now - r.startCtx + r.startOffset))
    r.cut.gain.cancelScheduledValues(now)
    r.cut.gain.setValueAtTime(r.cut.gain.value, now)
    r.cut.gain.linearRampToValueAtTime(0, now + 0.06)
    try {
      r.src.stop(now + 0.07)
    } catch {
      /* ignore */
    }
    r.src = null
    r.cut = null
    r.state = 'paused'
    narr.sounding = false
    narr.elapsed = r.lead + r.position
    this.releaseDucks()
  }

  /** Resume a paused clip from its recorded position (30 ms fade-in). */
  private resumeVoice(fadeIn = 0.03): void {
    const r = this.run
    if (!r || r.state !== 'paused') return
    this.startVoice(r, r.position, 0, fadeIn)
  }

  /** The voice may sound now (I.4 "What pauses the voice"). */
  private voiceMay(): boolean {
    const st = useStoryStore.getState()
    return this.audible() && !this.userPaused && this.holdT < SHORT_HOLD && pb.visible && !isHidden() && st.mode === 'story' && !readingHold(st)
  }

  /* ------------------------------ ducks ------------------------------ */

  private scheduleDucks(r: Run, when: number, offset: number): void {
    const g = this.graph
    const c = this.ctx
    if (!g || !c) return
    duckSchedule(g, c.currentTime, r.clip, when, offset, this.nextDuckDown(r, when, offset))
  }

  /**
   * The context time of the NEXT beat's first duck-down when autoplay will carry on into a narrated beat
   * (the duck bridge, I.3.3), from the plan: this beat's planned total, the next beat's LEAD and its first
   * speech span. null when nothing follows on its own (the last beat, reduced motion, explore, paused, a
   * next clip that is missing or failed): the release then happens as scheduled.
   */
  private nextDuckDown(r: Run, when: number, offset: number): number | null {
    const def = this.def
    const st = useStoryStore.getState()
    if (!def || r.selfClock || st.reduced || st.mode !== 'story' || !st.playing || clock.held) return null
    const beat = def.beats[r.index + 1]
    const clip = beat ? clipFor(def, beat.id) : null
    if (!clip || !clip.speech.length || this.clips?.state(clip).s === 'failed') return null
    // the clip's position 0 is at beat time armedAt + lead; the beat started that long before it
    const beatStart = when - offset - (narr.armedAt + r.lead)
    return beatStart + narr.total + LEAD + clip.speech[0][0] - DUCK_LEAD
  }

  private releaseDucks(): void {
    const g = this.graph
    const c = this.ctx
    if (!g || !c) return
    const now = c.currentTime
    glide(g.bedDuck.gain, 1, now, 0.12)
    glide(g.sfxDuck.gain, 1, now, 0.12)
  }

  /* ---------------------------- effects ---------------------------- */

  private cutEffects(fade: number, all = false): void {
    const c = this.ctx
    if (!c || !this.mix) return
    this.mix.voices.stopAll(c, c.currentTime, fade, all)
    this.ambient?.hush(c.currentTime)
  }

  /** The current beat's planned events (sampled in story mode, cached). */
  private planCurrent(delay: number): BeatEvents | null {
    const def = this.def
    if (!def) return null
    const st = useStoryStore.getState()
    if (st.mode !== 'story') return this.events
    const frame = def.frame ? storyFrame() : null
    const key = `${def.key}|${clock.index}|${st.layout}|${frame ? frameId(frame) : 0}|${delay}|${this.soundFor === def.key ? 1 : 0}`
    if (this.events && this.eventsKey === key) return this.events
    this.events = beatEvents(def, this.soundFor === def.key ? this.sound : null, clock.index, st.layout, frame, frame ? String(frameId(frame)) : '0', delay)
    this.eventsKey = key
    this.plannedIndex = clock.index
    this.build = Math.max(0.1, def.beats[clock.index]?.build ?? 1)
    return this.events
  }

  /** Point the cue cursor at story t; continuous cues already inside their window start at their current point. */
  private resumeCues(t: number, startInside: boolean): void {
    const ev = this.planCurrent(this.curDelay)
    if (!ev) return
    this.cueIdx = 0
    while (this.cueIdx < ev.events.length && ev.events[this.cueIdx].t <= t) this.cueIdx++
    if (!startInside || !this.audible() || !this.mix || !this.ctx) return
    const now = this.ctx.currentTime
    for (const e of ev.events) {
      if (!e.cont || e.t >= t || e.tb <= t) continue
      if (useStoryStore.getState().reduced && e.sound.startsWith('air')) continue
      const u = (t - e.t) / (e.tb - e.t)
      fireEvent(this.mix, this.bed, e, now, this.build, u)
    }
  }
  /** the current beat's pre-roll (0 at a chapter's load and under reduced motion) */
  private curDelay = 0

  /* ---------------------------- arming ---------------------------- */

  /** Arm the current beat mid-way (sound turned on, play after a seek or explore), per the story state. */
  private armForState(lead: number, waitMax: number): void {
    const st = useStoryStore.getState()
    const def = this.def
    if (!def || !this.enabled || !this.ctx) return
    if (st.mode !== 'story' || clock.held || !st.loaded) return
    const key = `${def.key}/${clock.index}`
    if (this.finished === key) return
    if (st.phase === 'done') return
    const beat = def.beats[clock.index]
    if (!beat) return
    if (st.reduced && !st.showBuild) {
      // reduced motion: sound turned on narrates the current beat once
      this.arm(clock.index, { lead, delay: 0, armedAt: 0, waitMax, selfClock: true })
      return
    }
    const soFar = st.phase === 'hold' ? beat.build + pb.holdElapsed : clock.t * beat.build
    this.arm(clock.index, { lead, delay: 0, armedAt: soFar, waitMax })
    this.resumeCues(clock.t, true)
  }

  /* ---------------------------- the hooks ---------------------------- */

  private hookBeatStart(n: number, delay: number): void {
    this.legit = true
    const auto = this.autoNext
    this.autoNext = false
    const landing = this.glideLanding
    this.glideLanding = false
    this.curDelay = delay
    if (!this.enabled || !this.live) return
    const c = this.ctx
    if (!auto && !landing) {
      this.ui('ui.step')
      this.stepInput = this.inputSerial
    }
    if (!auto && c) this.cutEffects(0.02)
    this.cutVoice(0.08, auto)
    this.finished = null
    const def = this.def
    if (!def) return
    // plan the new beat, point the cue cursor at its start
    this.events = null
    this.eventsKey = ''
    this.planCurrent(delay)
    this.cueIdx = 0
    // the room brightens as the argument builds
    if (c && this.bed) {
      const now = c.currentTime
      this.bed.evolve(n, now)
      if (n > 0) {
        const prev = beatEvents(def, this.soundFor === def.key ? this.sound : null, n - 1, useStoryStore.getState().layout, def.frame ? storyFrame() : null, def.frame ? String(frameId(storyFrame())) : '0', PRE_ROLL)
        if (prev.fallAt !== null) this.bed.recover(now, bedStateAt(def.key, n, def.beats.length, claimsOf(def, this.sound)).answer)
      }
    }
    this.doneAt = -1
    const st = useStoryStore.getState()
    if (st.mode !== 'story') return
    this.arm(n, { lead: LEAD, delay, armedAt: 0, waitMax: this.firstArm ? WAIT_FIRST : WAIT_MAX, selfClock: st.reduced })
    this.firstArm = false
    this.bedModeForState(0.8)
  }

  private hookAdvance(n: number, _t0: number, t1: number): void {
    this.legit = true
    if (!this.audible() || !this.mix || !this.ctx) return
    const st = useStoryStore.getState()
    if (st.mode !== 'story') return
    const ev = this.plannedIndex === n ? this.events : null
    if (!ev) {
      this.planCurrent(this.curDelay)
      this.resumeCues(_t0, false)
    }
    const e2 = this.events
    if (!e2) return
    const build = this.build
    const now = this.ctx.currentTime
    const lat = this.latency()
    const horizon = t1 + (0.12 + lat) / build
    const events = e2.events
    while (this.cueIdx < events.length && events[this.cueIdx].t <= horizon) {
      const e = events[this.cueIdx++]
      if (st.reduced && e.sound.startsWith('air')) continue
      let when = now + (e.t - t1) * build - lat
      let u0 = 0
      if (e.t < t1) {
        const late = (t1 - e.t) * build
        if (e.cont) {
          if (e.tb <= t1) continue
          u0 = (t1 - e.t) / (e.tb - e.t)
          when = now
        } else if (late > 0.1) continue
        else when = now
      }
      fireEvent(this.mix, this.bed, e, Math.max(now, when), build, u0)
    }
  }

  /** Next / Prev glide: ui.step, the voice and the effects cut, no cues during the glide (I.4). */
  private hookGlide(): void {
    this.lastGlide = pb.glide
    if (!this.enabled || !this.live) return
    if (!this.glideLanding) this.ui('ui.step')
    this.stepInput = this.inputSerial
    this.cutVoice(0.08)
    this.cutEffects(0.02)
    this.glideLanding = true
  }

  private hookHoldClear(): boolean {
    if (this.grace > 0) return false
    const ok = !narr.armed || (!narr.sounding && narr.elapsed >= narr.span)
    if (ok) this.autoNext = true
    return ok
  }

  /** H.74: the sounding clip's position as heard now (the audio clock less the output latency), or null */
  private hookClipPos(): number | null {
    const r = this.run
    const c = this.ctx
    if (!r || !c || r.state !== 'playing') return null
    return c.currentTime - r.startCtx + r.startOffset - this.latency()
  }

  private hookHoldsLast(): boolean {
    return this.enabled && narr.armed
  }

  private hookUserPause(): void {
    this.userPaused = true
    if (!this.live) return
    this.ui('ui.tap')
    this.pauseVoice()
    this.cutEffects(0.06)
    this.bedModeForState(1.2)
  }

  private hookSeek(): void {
    this.legit = true
    if (!this.enabled || !this.live) return
    const st = useStoryStore.getState()
    // scrubbing: only a soft tick at each beat-boundary crossing (80 ms apart at least)
    if (st.interacting > 0 && this.lastSeekIndex >= 0 && clock.index !== this.lastSeekIndex && this.audible() && this.mix && this.ctx) {
      const now = this.ctx.currentTime
      if (now - this.lastScrubTick >= 0.08) {
        this.lastScrubTick = now
        fireEvent(this.mix, null, { name: 'scrub', sound: 'tick.label', cont: false, t: 0, tb: 0, shape: null, u0: 0, gain: -8, pan: 0, pitch: 0, seed: this.seedN++, duck: [] }, now, 1)
      }
    }
    this.lastSeekIndex = clock.index
    this.glideLanding = false
    if (this.run) this.cutVoice(0.08)
    this.finished = null
    this.cutEffects(0.02)
    this.events = null
    this.eventsKey = ''
    this.bedModeForState(1.2)
  }
  private lastScrubTick = -1

  private hookToggleKey(): void {
    // a story without narration has no sound: M does nothing there (H.72)
    if (!this.live) return
    // Off or Waiting: start sound; On (running or idle): turn it off (I.5.2)
    if (!this.enabled || !this.uiRunning()) this.enable('key')
    else this.disable()
  }

  /* ------------------------------ wiring ------------------------------ */

  private wire(): void {
    this.wired = true
    const q = soundQuery()
    this.qa = q === 1
    this.forcedOff = q === 0
    const pref = readPref()
    // the tick recipe (the owner's A/B, H.71) is read while the lesson's URL still carries ?tick
    tickStyle()
    this.enabled = q === 1 ? true : q === 0 ? false : pref === '1'
    useSoundUi.setState({ undecided: pref !== '0', forcedOff: this.forcedOff, enabled: this.enabled })
    audioHooks.beatStart = (n, d) => this.safe('beatStart', () => this.hookBeatStart(n, d))
    audioHooks.advance = (n, a, b) => this.safe('advance', () => this.hookAdvance(n, a, b))
    audioHooks.holdClear = () => this.safe('holdClear', () => this.hookHoldClear(), true)
    audioHooks.holdsLast = () => this.safe('holdsLast', () => this.hookHoldsLast(), false)
    audioHooks.userPause = () => this.safe('userPause', () => this.hookUserPause())
    audioHooks.seek = () => this.safe('seek', () => this.hookSeek())
    audioHooks.toggleKey = () => this.safe('toggleKey', () => this.hookToggleKey())
    audioHooks.glideStart = () => this.safe('glide', () => this.hookGlide())
    audioHooks.clipPos = () => this.safe('clipPos', () => this.hookClipPos(), null)
    useStoryStore.subscribe((s) => this.safe('store', () => this.onStore(s)))
    // a chapter change starts at the navigation: the old voice and effects stop in the same task
    useFitnessStore.subscribe((f) =>
      this.safe('route', () => {
        if (this.def && f.route.view !== this.def.key && this.pendingCut !== f.route.view) {
          this.pendingCut = f.route.view
          this.cutVoice(0.15)
          this.cutEffects(0.06)
        }
      }),
    )
    onFrame((dt) => this.frame(dt))
    document.addEventListener('visibilitychange', () => (document.hidden ? this.onHide() : this.onShow()))
    window.addEventListener('pagehide', () => {
      this.onHide()
      window.clearTimeout(this.hideTimer)
      this.ctx?.suspend().catch(() => undefined)
    })
    window.addEventListener('pageshow', () => this.onShow())
    // the viewer's own touches: ui sounds and the input time for play / pause taps
    document.addEventListener('click', (e) => this.safe('click', () => this.onClick(e)), true)
    const mark = () => {
      this.lastInput = performance.now()
      this.inputSerial++
      if (this.exploreFaded || useStoryStore.getState().mode === 'explore') this.exploreTouch()
    }
    document.addEventListener('pointerup', mark, true)
    document.addEventListener('keydown', mark, true)
    if (this.enabled && this.live) this.attachUnlock()
  }

  /** A hook must never break the story: catch, report at most every 5 s, and fall back. */
  private safe<T>(where: string, fn: () => T, fallback?: T): T {
    try {
      return fn()
    } catch (err) {
      const t = performance.now()
      if (t - this.errAt > 5000) {
        this.errAt = t
        console.warn('[audio] ' + where + ' threw: ' + (err instanceof Error ? err.message : String(err)))
      }
      return fallback as T
    }
  }

  /* ------------------------------ unlock ------------------------------ */

  private readonly onUnlock = (e: Event): void => {
    if (!this.live) {
      this.detachUnlock()
      return
    }
    const t = e.target as Element | null
    if (t && typeof t.closest === 'function') {
      if (t.closest('[data-sound-control]')) return
      // a key pressed with nothing focused targets the body, not the lesson root: with a chapter mounted
      // it is a key in the lesson (I.4; fix round 2: Left / Right, Space and E never unlocked on desktop)
      const bodyKey = e.type === 'keydown' && !!this.def && (t === document.body || t === document.documentElement)
      if (!bodyKey && !t.closest('.st-root')) return
    }
    if (e.type === 'keydown') {
      const k = (e as KeyboardEvent).key
      if (k === 'm' || k === 'M') return
    }
    if (!this.enabled || (this.ctx && this.ctx.state === 'running' && !this.interrupted)) {
      this.detachUnlock()
      return
    }
    this.enable('gesture')
  }

  private attachUnlock(): void {
    if (this.unlockOn || typeof document === 'undefined') return
    this.unlockOn = true
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, this.onUnlock, true)
  }

  private detachUnlock(): void {
    if (!this.unlockOn) return
    this.unlockOn = false
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.removeEventListener(ev, this.onUnlock, true)
  }

  /* ------------------------------ clicks ------------------------------ */

  private onClick(e: MouseEvent): void {
    const t = e.target as Element | null
    if (!t || typeof t.closest !== 'function' || !t.closest('.st-stage')) return
    if (t.closest('[data-sound-control], .st-rb, .st-segs, .st-grab, .st-more-link, .st-play, .st-showbuild')) return
    const btn = t.closest('button, [role="radio"], [role="switch"], summary')
    if (!btn) return
    if (btn.classList.contains('st-chip--reset')) {
      // Reset view: the view reveals, softly, over the 600 ms tween
      if (this.audible() && this.mix && this.ctx) {
        fireEvent(this.mix, null, AIR_RESET, this.ctx.currentTime, 0.6)
      }
      return
    }
    this.ui('ui.tap')
  }

  /* ------------------------------ store ------------------------------ */

  private snapshotPrev(): void {
    const s = useStoryStore.getState()
    this.prev = { playing: s.playing, mode: s.mode, loaded: s.loaded, visible: s.visible, index: s.index, interacting: s.interacting, phase: s.phase, reduced: s.reduced, view: s.view }
  }

  private onStore(s: StoryState): void {
    const p = this.prev
    this.snapshotPrev()
    if (!this.def || s.def !== this.def) return
    // loaded: beat 0 arms itself (StoryProvider's mount never calls startBeat(0)); the new tone fades in
    if (s.loaded && !p.loaded) {
      const c = this.ctx
      if (c && this.bed && this.enabled && this.pendingToneFor === this.def.key) {
        this.bed.startTone(this.def.key, bedStateAt(this.def.key, clock.index, this.def.beats.length, claimsOf(this.def, this.sound)), c.currentTime, 2.5)
        this.pendingToneFor = null
      }
      this.curDelay = 0
      if (this.enabled && s.playing && s.mode === 'story' && !clock.held && !s.reduced && clock.index === 0) {
        this.events = null
        this.eventsKey = ''
        this.planCurrent(0)
        this.cueIdx = 0
        this.arm(0, { lead: LEAD_FIRST, delay: 0, armedAt: 0, waitMax: this.firstArm ? WAIT_FIRST : WAIT_MAX })
        this.firstArm = false
      }
      this.bedModeForState(2.5)
    }
    // explore
    if (s.mode !== p.mode) {
      if (s.mode === 'explore') {
        this.cutVoice(0.2)
        this.exploreIdle = 0
        this.exploreFaded = false
      } else {
        this.exploreFaded = false
      }
      this.events = null
      this.eventsKey = ''
      this.bedModeForState(1.5)
    }
    // play / pause
    if (s.playing !== p.playing) {
      if (s.playing) {
        this.wake()
        const fromInput = performance.now() - this.lastInput < 250 && this.stepInput !== this.inputSerial
        if (fromInput && this.userPaused) this.ui('ui.tap')
        this.userPaused = false
        if (this.run && this.run.state === 'paused') {
          if (this.voiceMay()) this.resumeVoice(0.03)
          this.resumeCues(clock.t, true)
        } else if (!this.run && s.mode === 'story' && !clock.held) {
          // play after a seek, a scrub or explore: a cut clip re-arms; a finished one does not replay
          // (armForState skips a finished beat)
          this.armForState(LEAD, WAIT_MAX)
        }
      }
      this.bedModeForState(0.8)
    }
    // the stage scrolled out of view: as pause; back in view: as resume
    if (s.visible !== p.visible) {
      if (!s.visible) {
        this.pauseVoice()
        this.cutEffects(0.06)
      } else if (this.run?.state === 'paused' && this.voiceMay() && s.playing) this.resumeVoice(0.03)
      this.bedModeForState(1.2)
    }
    // a finger lifted: resume a voice the short-hold rule paused
    if (s.interacting !== p.interacting && s.interacting === 0) {
      const wasHeld = this.holdT >= SHORT_HOLD
      this.holdT = 0
      if (wasHeld && this.run?.state === 'paused' && this.voiceMay() && s.playing) {
        this.resumeVoice(0.03)
        this.resumeCues(clock.t, true)
      }
      this.bedModeForState(0.8)
    }
    // reduced motion: a step cuts to t = 1 without startBeat; the landed beat narrates once
    if (s.index !== p.index && s.reduced && s.mode === 'story' && s.interacting === 0 && this.enabled && !s.showBuild) {
      this.legit = true
      this.ui('ui.step')
      this.arm(s.index, { lead: LEAD, delay: 0, armedAt: 0, waitMax: WAIT_MAX, selfClock: true })
      this.bedModeForState(0.8)
    } else if (s.index !== p.index && clock.held) this.legit = true
    // the chapter is done: the bed holds 8 s, then fades out over 6 s
    if (s.phase === 'done' && p.phase !== 'done' && !s.reduced) this.holdThenFade()
    else if (s.phase !== 'done' && p.phase === 'done') this.doneAt = -1
  }

  /** After the chapter is done (or a reduced-motion clip), the bed holds 8 s, then fades out over 6 s. */
  private holdThenFade(): void {
    const c = this.ctx
    const g = this.graph
    if (!c || !g || !this.enabled || !this.live) return
    this.doneAt = c.currentTime
    const p = g.bedMode.gain
    const t = c.currentTime
    const v = Math.max(p.value, 0.0001)
    p.cancelScheduledValues(t)
    p.setValueAtTime(v, t)
    p.setValueAtTime(v, t + 8)
    p.linearRampToValueAtTime(0, t + 14)
    // silent by the time the idle timer (16 s) runs
    this.bedV = 0
    this.idleSuspendSoon(16000)
  }

  private exploreTouch(): void {
    this.exploreIdle = 0
    if (this.exploreFaded) {
      this.exploreFaded = false
      this.bedModeForState(1.5)
    }
  }

  /* --------------------------- hidden page --------------------------- */

  /** Hidden: everything in THIS task (iOS may never run another frame or timer). */
  private onHide(): void {
    const c = this.ctx
    if (!c || !this.graph || this.hidden) return
    this.hidden = true
    const now = c.currentTime
    this.hiddenArmed = false
    const r = this.run
    if (r && r.state === 'playing') {
      this.pauseVoice()
      this.hiddenArmed = true
    }
    glide(this.graph.master.gain, 0, now, 0.02)
    this.cutEffects(0.02, true)
    this.suspending = true
    // The master is at 0 within 60 ms whatever happens next, so nothing can sound on the lock screen.
    // The suspend follows the ramp (an immediate suspend cuts the fade: a click on every tab switch);
    // if iOS freezes this page before the timer runs, it stays silent at 0 until it is shown again.
    window.clearTimeout(this.hideTimer)
    this.hideTimer = window.setTimeout(() => {
      if (this.hidden && this.ctx) this.ctx.suspend().catch(() => undefined)
    }, 90)
  }
  private hideTimer = 0
  private pendingCut = ''

  private onShow(): void {
    const c = this.ctx
    if (!c || !this.graph || isHidden()) return
    // Clear the hide state BEFORE anything else returns (fix round 2): with sound off during a hide and
    // show, the old early return left `hidden` set, so after sound came back on the next real hide was a
    // no-op and the voice and the bed played on the lock screen.
    const wasHidden = this.hidden
    this.hidden = false
    window.clearTimeout(this.hideTimer)
    if (!this.enabled || !this.live || !wasHidden) return
    const g = this.graph
    const st = useStoryStore.getState()
    // Nothing to play (fix round 2): the context was in the director's own idle suspend, or the hide
    // paused nothing, the story is not playing and the bed was silent. Showing the tab must not claim the
    // 'playback' session again (on an iPhone that pauses the viewer's music every time they come back to
    // the lesson, I.3.6): the master is restored for later and the context sleeps as idle. Play, a step
    // or a tap wakes it through the usual paths (wake, the unlock listener).
    const quiet = this.idle || (!this.hiddenArmed && this.bedV === 0 && !st.playing && !(this.run && this.run.selfClock))
    if (quiet) {
      g.master.gain.cancelScheduledValues(c.currentTime)
      g.master.gain.setValueAtTime(1, c.currentTime)
      this.hiddenArmed = false
      if (c.state === 'running') {
        // shown before the hide's suspend ran: still awake, so a device interruption must be seen again
        this.suspending = false
        this.idleSuspendSoon(IDLE_MS)
      } else {
        this.idle = true
        this.suspending = true
        setSession('auto')
      }
      this.syncUi()
      return
    }
    this.suspending = false
    this.sleepSerial++
    setSession('playback')
    c.resume()
      .then(() => {
        const now = c.currentTime
        g.master.gain.cancelScheduledValues(now)
        g.master.gain.setValueAtTime(0, now)
        g.master.gain.linearRampToValueAtTime(1, now + 0.15)
        if (this.hiddenArmed && this.run?.state === 'paused' && this.voiceMay() && useStoryStore.getState().playing) this.resumeVoice(0.15)
        this.hiddenArmed = false
        this.onState()
        this.bedModeForState(0.8)
      })
      .catch(() => {
        // the device refused (iOS 'interrupted'): the story pauses and the toggle shows Waiting
        this.interrupted = true
        this.idle = false
        const s = useStoryStore.getState()
        if (s.playing) {
          this.pausedByInterrupt = true
          s.pause()
        }
        this.syncUi()
      })
  }

  /* ------------------------------ frame ------------------------------ */

  private frame(dtRaw: number): void {
    try {
      this.frameInner(Math.min(Math.max(dtRaw, 0), 0.1))
    } catch (err) {
      const t = performance.now()
      if (t - this.errAt > 5000) {
        this.errAt = t
        console.warn('[audio] frame worker threw: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
  }

  private frameInner(dt: number): void {
    const st = useStoryStore.getState()
    if (this.grace > 0) this.grace = Math.max(0, this.grace - dt)
    this.autoNext = false
    // a glide the hook did not report (a safety net): cut the voice and the effects
    if (pb.glide !== this.lastGlide) {
      if (pb.glide && this.enabled) this.hookGlide()
      this.lastGlide = pb.glide
    }
    // safety net: T moved without advance, beatStart, a seek or a glide -> treat as a cut
    if (clock.T !== this.lastT && !this.legit && !pb.glide && this.run && !this.run.selfClock) this.cutVoice(0.08)
    this.lastT = clock.T
    this.legit = false
    if (!this.enabled || !this.live || !this.ctx) return
    // the route already moved to another chapter (its chunk loads under the slate): the old voice and
    // effects stop now, not when the next chapter mounts
    if (readyState.pendingView && readyState.pendingView !== this.pendingCut) {
      this.pendingCut = readyState.pendingView
      this.cutVoice(0.15)
      this.cutEffects(0.06)
    } else if (!readyState.pendingView) this.pendingCut = ''
    // the idle / explore bed timers
    if (st.mode === 'explore') {
      this.exploreIdle += dt
      if (!this.exploreFaded && this.exploreIdle > 45) {
        this.exploreFaded = true
        this.bedModeForState(6)
      }
    }
    // the short-hold rule: a finger down for 0.4 s pauses the voice (and the effects, and the bed)
    if (st.interacting > 0) {
      const before = this.holdT
      this.holdT += dt
      if (before < SHORT_HOLD && this.holdT >= SHORT_HOLD) {
        this.pauseVoice()
        this.cutEffects(0.06)
        this.bedModeForState(1.2)
      }
    }
    if (this.ctx.state !== 'running') return
    this.voiceFrame(dt, st)
    this.ambientFrame(st)
    if (this.graph?.an) {
      const r = this.graph.limiter.reduction
      if (r < this.limiterMin) this.limiterMin = r
    }
  }

  private voiceFrame(dt: number, st: StoryState): void {
    const r = this.run
    const c = this.ctx
    const cc = this.clips
    if (!r || !c || !cc) return
    const storyRuns = st.playing && st.interacting === 0 && st.mode === 'story' && !isHidden() && pb.visible && st.loaded && !readingHold(st)
    if (r.selfClock && !storyRuns && (r.state === 'lead' || r.state === 'waiting' || r.state === 'breath') && pb.visible && !isHidden()) narr.elapsed += dt
    if (r.state === 'lead' || r.state === 'waiting') {
      const early = r.lead - narr.elapsed
      if (early <= 0.05) {
        const s = cc.state(r.clip)
        if (s.s === 'ready') {
          if (this.voiceMay() || r.selfClock) this.startVoice(r, Math.max(0, -early), Math.max(0, early), 0)
        } else if (s.s === 'failed') {
          this.disarm()
        } else {
          if (s.s === 'none') void cc.load(r.clip)
          if (early <= 0) {
            narr.elapsed = r.lead
            r.state = 'waiting'
            if (storyRuns || r.selfClock) r.waited += dt
            narr.waiting = r.waited
            if (r.waited >= r.waitMax) {
              console.warn(`[audio] narration ${r.clip.file} still loading after ${r.waitMax} s; the beat runs silent`)
              this.disarm()
            }
          }
        }
      }
    } else if (r.state === 'playing') {
      narr.elapsed = r.lead + (c.currentTime - r.startCtx) + r.startOffset
      if (narr.elapsed >= r.lead + r.clip.dur) {
        r.state = 'breath'
        narr.sounding = false
        narr.elapsed = r.lead + r.clip.dur
        r.src = null
        r.cut = null
        this.finished = `${r.view}/${r.index}`
        // no releaseDucks() here: the clip's own schedule releases DUCK_RELEASE after its last syllable
        // (tau DUCK_RELEASE_TAU), or bridges into the next beat's clip (I.3.3; fix round 2: releasing at
        // the file's end with tau 0.12 made the live bed pop up 0.58 s earlier than the reference mix)
        if (st.reduced && !st.playing) this.holdThenFade()
      } else if (!this.voiceMay() && !r.selfClock) this.pauseVoice()
    } else if (r.state === 'paused' && this.voiceMay() && (st.playing || r.selfClock)) {
      this.resumeVoice(0.03)
    }
  }

  private ambientFrame(st: StoryState): void {
    const def = this.def
    const m = this.mix
    const c = this.ctx
    if (!def || !m || !c || !this.sound?.ambient?.length) return
    if (!this.ambient) this.ambient = new Ambient(m, this.sound.ambient, st.layout, def.key.length)
    const moving = (st.mode === 'explore' || (st.playing && !clock.held && !st.reduced && st.interacting === 0)) && pb.visible && !isHidden()
    const now = c.currentTime
    if (!moving) this.ambient.hush(now)
    else this.ambient.run(now, now + 0.1, clock.T, true)
  }

  /* ------------------------------ QA ------------------------------ */

  qaState(): AudioQA {
    const def = this.def
    const beat = def?.beats[clock.index]
    const r = this.run
    const c = this.ctx
    let position: number | null = null
    if (r && c) {
      if (r.state === 'playing') position = Math.max(0, c.currentTime - r.startCtx + r.startOffset)
      else if (r.state === 'paused') position = r.position
      else if (r.state === 'breath') position = r.clip.dur
      else position = 0
    }
    const hold = def ? beatTiming(def, clock.index, { delay: 0, lead: LEAD, narrate: false }).hold : 0
    let levels: AudioLevels | null = null
    const g = this.graph
    if (g?.an && c) {
      if (!this.levelBuf) this.levelBuf = new Float32Array(g.an.master.fftSize)
      const b = this.levelBuf
      const sr = c.sampleRate
      // a context that is not running outputs nothing (its analysers only keep their last buffer)
      const live = c.state === 'running'
      const lv = (a: AnalyserNode) => (live ? rmsDb(a, b, sr) : -120)
      levels = {
        voice: lv(g.an.voice),
        sfx: lv(g.an.sfx),
        ui: lv(g.an.ui),
        bed: lv(g.an.bed),
        master: lv(g.an.master),
        duckBed: Math.round(20 * Math.log10(Math.max(1e-6, g.bedDuck.gain.value)) * 10) / 10,
        duckSfx: Math.round(20 * Math.log10(Math.max(1e-6, g.sfxDuck.gain.value)) * 10) / 10,
        limiter: Math.round(g.limiter.reduction * 100) / 100,
        limiterMin: Math.round(this.limiterMin * 100) / 100,
      }
      this.limiterMin = g.limiter.reduction
    }
    const sessionType = (() => {
      try {
        return nav()?.audioSession?.type ?? null
      } catch {
        return null
      }
    })()
    return {
      enabled: this.enabled,
      unlocked: this.unlocked,
      contextState: this.contextState(),
      idle: this.idle,
      session: sessionType,
      playing: !!r && r.state === 'playing',
      clip: r ? { view: r.view, beat: r.clip.beat, file: r.clip.file, dur: r.clip.dur } : null,
      position,
      beatHold: {
        index: clock.index,
        delay: pb.delay,
        build: beat?.build ?? 0,
        hold,
        narr: r ? r.span : null,
        total: r ? narr.total : (clock.index > 0 ? PRE_ROLL : 0) + (beat?.build ?? 0) + (def && clock.index < def.beats.length - 1 ? hold : 0),
        elapsed: narr.elapsed,
        waiting: !!r && r.state === 'waiting',
        sync: narr.armed && !!narr.sync,
      },
      levels,
      voices: this.mix && c ? this.mix.voices.sounding(c.currentTime) : 0,
      startedFrom: r && r.state === 'playing' ? Math.round(r.startOffset * 1000) / 1000 : null,
    }
  }
}

/** Reset view's soft reveal (I.6.6): air.reveal at -8 dB over the 600 ms tween. */
const AIR_RESET = {
  name: 'reset',
  sound: 'air.reveal' as const,
  cont: true,
  t: 0,
  tb: 1,
  shape: { a: 0, land: 1, half: 0.5, b: 1, speed: new Float32Array(32).fill(1), v0: 0, v1: 1, prog: new Float32Array(32).map((_, i) => i / 31) },
  u0: 0,
  gain: -8,
  pan: 0,
  pitch: 0,
  seed: 77,
  duck: [],
}

/** I.3.3: the ducks go down DUCK_LEAD before a span's first syllable and release DUCK_RELEASE after it ends. */
export const DUCK_LEAD = 0.1
export const DUCK_RELEASE = 0.7
/**
 * The release's time constant (fix round 2; was 0.23 s): over a long gap between beats the room RISES
 * back rather than swelling, and a short un-duck no longer reads as an "air sweep".
 */
export const DUCK_RELEASE_TAU = 0.6
/**
 * The duck BRIDGE (fix round 2): when autoplay carries on, the release after a clip's last span is skipped
 * if the next beat's first duck-down follows within this long of it, so the bed does not pop up for a
 * fraction of a second between two sentences. 1.5 s covers every early sentence change in Capacity,
 * including D4 -> D5 (1.22 s, the swell the ear heard as an air sweep); the longer gaps (D3 -> D4 2.1 s,
 * D5 -> D6 4.7 s) rise gently at DUCK_RELEASE_TAU.
 */
export const DUCK_BRIDGE = 1.5
/** A bridged duck still releases this long after the planned next duck-down if no next clip takes over. */
export const BRIDGE_SAFETY = 2.0
/**
 * Spans whose gap is at most this merge, so the duck holds through the gap. It MUST be at least
 * DUCK_RELEASE + DUCK_LEAD: for a shorter gap the release would be scheduled AFTER the next span's
 * duck-down, and that later setTargetAtTime(1) would leave the bed and the effects unducked for the rest
 * of the clip (fix round 1: the D0 clip's 0.78 s gap did exactly that). It also equals the I.6.5 gap
 * gate (0.8 s), so a clip that passes the gate never releases mid-line.
 */
export const DUCK_MERGE = DUCK_RELEASE + DUCK_LEAD

/** The merged duck spans of a clip (seconds into the clip), shared by the schedule and the QA checks. */
export function duckSpans(clip: NarrationClip): [number, number][] {
  const spans: [number, number][] = []
  for (const [a, b] of clip.speech) {
    const last = spans[spans.length - 1]
    if (last && a - last[1] <= DUCK_MERGE) last[1] = b
    else spans.push([a, b])
  }
  return spans
}

/**
 * Scheduled ducks for a clip starting at `when` from `offset` (I.3.3): shared with the offline render.
 * `nextDown`: the context time of the next beat's first duck-down when autoplay carries on into a
 * narrated beat, else null. When it follows the last span's release within DUCK_BRIDGE, that release
 * moves to nextDown + BRIDGE_SAFETY: the next clip's own schedule (cancelScheduledValues from its start)
 * replaces it, so the duck holds across the beat change; if no clip follows, it still releases.
 */
export function duckSchedule(g: Graph, now: number, clip: NarrationClip, when: number, offset: number, nextDown: number | null = null): void {
  const bed = g.bedDuck.gain
  const sfx = g.sfxDuck.gain
  bed.cancelScheduledValues(now)
  sfx.cancelScheduledValues(now)
  const spans = duckSpans(clip)
  spans.forEach(([a, b], i) => {
    if (b <= offset) return
    const down = Math.max(now, when + (a - offset) - DUCK_LEAD)
    let up = when + (b - offset) + DUCK_RELEASE
    if (i === spans.length - 1 && nextDown !== null && nextDown > up - DUCK_RELEASE && nextDown - up <= DUCK_BRIDGE) up = nextDown + BRIDGE_SAFETY
    bed.setTargetAtTime(DUCK.bed, down, 0.04)
    sfx.setTargetAtTime(DUCK.sfx, down, 0.04)
    bed.setTargetAtTime(1, up, DUCK_RELEASE_TAU)
    sfx.setTargetAtTime(1, up, DUCK_RELEASE_TAU)
  })
}

/** Chapters' sound modules, discovered like the chapter registry (H.38): each its own lazy chunk. */
const SOUND_MODULES = import.meta.glob<{ default: ChapterSound }>('../../stories/*/sound.ts')

export const audio = new Director()

/** For the sound controls: turn sound on from a click (the chip, the toggle in Waiting). */
export function soundOn(source: 'chip' | 'toggle'): void {
  audio.enable(source)
}
export function soundOff(): void {
  audio.disable()
}
