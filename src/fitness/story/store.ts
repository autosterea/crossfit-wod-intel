import { create } from 'zustand'
import type { Detent, Layout, Mode, StoryDef, StoryKey, Tier } from './types'
import { clock, setA, setIT } from './clock'
import { pb, holdFor, startBeat, glideTo, navigateChapter, haptic } from './playback'
import { dropQueryKeys } from './url'
import { markSeek } from './ready'
import { audioHooks } from './audio/hooks' // [audio]

/* =========================================================================
   Story store (DESIGN.md C.3): discrete state only. Components re-render on
   these; per-frame values live on the mutable clock.
   ========================================================================= */

export type Phase = 'build' | 'hold' | 'done'

export interface StoryState {
  def: StoryDef | null
  view: StoryKey
  index: number
  playing: boolean
  phase: Phase
  mode: Mode
  detent: Detent
  tier: Tier
  /** ?tier pins the tier and disables the PerformanceMonitor */
  tierPinned: boolean
  dpr: number
  reduced: boolean
  /** the chapter is loaded (one-way per chapter; drives the slate and autoplay, H.15) */
  loaded: boolean
  /** count of active holds (pointer down, scrub, detent drag, sheet open) */
  interacting: number
  layout: Layout
  /** stage at least 10% visible */
  visible: boolean
  /** false when WebGL is unavailable or the context was lost for good */
  webgl: boolean
  /** reduced motion: "Show build" plays one build, then holds */
  showBuild: boolean
  /** explore: Scrub | Orbit toggle */
  scrub: boolean
  /** chapter sheet open */
  sheet: boolean
  /** 0.8 during an explore drag, restored 300 ms after release */
  dprScale: number
  /** LOW tier under 24 fps: render on demand */
  still: boolean
  /**
   * Nothing on the stage is moving (the story is paused, held or finished,
   * and every damped follower has settled): the Canvas renders on demand and
   * any change wakes it (Stage.tsx IdleWatch / useIdleWake; fix round 1)
   */
  idle: boolean

  play(): void
  pause(): void
  toggle(): void
  next(user?: boolean): void
  prev(user?: boolean): void
  seek(n: number, t: number, opts?: { hold?: boolean }): void
  setMode(m: Mode): void
  setDetent(d: Detent): void
  /** one detent step: 'up' toward expanded, 'down' toward peek (phone card drag) */
  nudgeDetent(dir: 'up' | 'down'): void
  beginInteraction(): () => void
  setSheet(open: boolean): void
}

/**
 * The beat the story is on or already heading to: during a next / prev glide
 * that is the glide's target, so taps that land inside the 350 ms glide
 * queue up instead of re-targeting the same beat.
 */
const baseIndex = () => (pb.glide ? Math.max(0, Math.min(clock.beats - 1, Math.round(pb.glide.to))) : clock.index)

/** One rule everywhere: t = 1 on the last beat is 'done', t = 1 elsewhere is 'hold'. */
export function phaseAt(i: number, t: number, beats: number): Phase {
  if (t < 1) return 'build'
  return i >= beats - 1 ? 'done' : 'hold'
}

/** A user moved the story: the deep-link query no longer describes the screen (URL drift). */
const dropSeekQuery = () => dropQueryKeys(['beat', 't'])

export const useStoryStore = create<StoryState>((set, get) => ({
  def: null,
  view: 'intro',
  index: 0,
  playing: false,
  phase: 'build',
  mode: 'story',
  detent: 'default',
  tier: 'medium',
  tierPinned: false,
  dpr: 1,
  reduced: false,
  loaded: false,
  interacting: 0,
  layout: 'P',
  visible: true,
  webgl: true,
  showBuild: false,
  scrub: false,
  sheet: false,
  dprScale: 1,
  still: false,
  idle: false,

  play() {
    const s = get()
    if (!s.def) return
    if (clock.held) clock.held = false
    dropSeekQuery()
    if (s.mode === 'explore') get().setMode('story')
    // Play is the viewer's "I am done reading": the expanded card (a reading
    // hold, L14) returns to its default detent so the story can run.
    if (s.detent === 'expanded') set({ detent: 'default' })
    if (s.reduced) {
      // "Show build": replay the current beat's build once, then hold.
      startBeat(clock.index)
      set({ playing: true, showBuild: true })
      return
    }
    if (s.phase === 'done') {
      startBeat(0)
      set({ playing: true })
      return
    }
    if (clock.t >= 1 && s.phase !== 'hold') {
      set({ phase: 'hold' })
      pb.holdElapsed = 0
      pb.holdFor = holdFor(s.def.beats[clock.index])
    }
    set({ playing: true })
  },

  pause() {
    // a pause during a next / prev glide wins over the glide's resume (intent)
    if (pb.glide) pb.glide.paused = true
    audioHooks.userPause() // [audio] the viewer paused: the voice pauses and resumes where it stopped
    set({ playing: false })
  },

  toggle() {
    if (get().playing) get().pause()
    else get().play()
  },

  next(user = true) {
    const s = get()
    if (!s.def) return
    if (user) {
      haptic()
      dropSeekQuery()
      // A viewer's own step leaves the deep link's hold: the new beat builds
      // and the story plays on (reduced motion still cuts to end states).
      if (clock.held && !s.reduced) clock.held = false
    }
    const base = baseIndex()
    if (base >= clock.beats - 1) {
      navigateChapter(1)
      return
    }
    const n = base + 1
    const beats = s.def.beats.length
    if (s.reduced || clock.held) {
      pb.glide = null
      setIT(n, 1)
      setA(clock.T * 2.5)
      set({ index: n, phase: phaseAt(n, 1, beats), playing: false })
      return
    }
    if (s.mode === 'explore') get().setMode('story')
    if (pb.glide || (s.phase === 'build' && clock.t < 1 && s.playing)) {
      // glide onward from wherever T is now (a queued tap keeps the pause intent)
      const paused = pb.glide?.paused ?? false
      glideTo(n, 350, 'settle', (p) => {
        startBeat(n)
        set({ playing: !(p || paused) })
      })
      return
    }
    startBeat(n)
    set({ playing: true })
  },

  prev(user = true) {
    const s = get()
    if (!s.def) return
    if (user) haptic()
    const base = baseIndex()
    if (base === 0 && !pb.glide && (clock.t < 0.15 || s.reduced || clock.held)) {
      if (user) dropSeekQuery()
      navigateChapter(-1)
      return
    }
    // a viewer's own step leaves the deep link's hold and plays the beat it lands on
    const wasHeld = user && clock.held && !s.reduced
    if (user) {
      dropSeekQuery()
      if (wasHeld) clock.held = false
    }
    const n = base === 0 ? 0 : base - 1
    const beats = s.def.beats.length
    if (s.reduced || clock.held) {
      pb.glide = null
      setIT(n, 1)
      setA(clock.T * 2.5)
      set({ index: n, phase: phaseAt(n, 1, beats), playing: false })
      return
    }
    if (s.mode === 'explore') get().setMode('story')
    const wasPlaying = s.playing || s.phase === 'done' || wasHeld || !!pb.glide
    glideTo(n, 450, 'settle', (paused) => {
      startBeat(n)
      set({ playing: wasPlaying && !paused })
    })
  },

  seek(n, t, opts) {
    const s = get()
    if (!s.def) return
    const hold = opts?.hold ?? true
    pb.glide = null
    const i = Math.max(0, Math.min(s.def.beats.length - 1, Math.floor(n)))
    const tt = Math.max(0, Math.min(1, t))
    setIT(i, tt)
    clock.held = hold
    setA(clock.T * 2.5)
    pb.delay = 0
    pb.holdElapsed = 0
    pb.holdFor = holdFor(s.def.beats[i])
    markSeek()
    set({ index: i, phase: phaseAt(i, tt, s.def.beats.length), playing: hold ? false : s.playing })
  },

  setMode(m) {
    const s = get()
    if (!s.def || s.mode === m) return
    if (m === 'explore') {
      pb.glide = null
      try {
        s.def.explore.initFromBeat(clock.index)
      } catch {
        /* chapter explore init must never break the stage */
      }
      set({ mode: 'explore', playing: false, scrub: false })
    } else {
      dropQueryKeys(['explore'])
      set({ mode: 'story', scrub: false })
    }
  },

  setDetent(d) {
    set({ detent: d })
  },

  nudgeDetent(dir) {
    const d = get().detent
    if (dir === 'up') set({ detent: d === 'peek' ? 'default' : 'expanded' })
    else set({ detent: d === 'expanded' ? 'default' : 'peek' })
  },

  beginInteraction() {
    set((st) => ({ interacting: st.interacting + 1 }))
    let released = false
    return () => {
      if (released) return
      released = true
      set((st) => ({ interacting: Math.max(0, st.interacting - 1) }))
    }
  },

  setSheet(open) {
    set({ sheet: open })
  },
}))
