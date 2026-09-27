import { create } from 'zustand'
import type { FitnessView } from '../lessonTypes'
import type { Detent, Layout, Mode, StoryDef, Tier } from './types'
import { clock, setA, setIT } from './clock'
import { pb, holdFor, startBeat, glideTo, navigateChapter, haptic } from './playback'
import { dropQueryKeys } from './url'
import { markSeek } from './ready'

/* =========================================================================
   Story store (DESIGN.md C.3): discrete state only. Components re-render on
   these; per-frame values live on the mutable clock.
   ========================================================================= */

export type Phase = 'build' | 'hold' | 'done'

export interface StoryState {
  def: StoryDef | null
  view: FitnessView
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
  ready: boolean
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

  play(): void
  pause(): void
  toggle(): void
  next(user?: boolean): void
  prev(user?: boolean): void
  seek(n: number, t: number, opts?: { hold?: boolean }): void
  setMode(m: Mode): void
  setDetent(d: Detent): void
  beginInteraction(): () => void
  setSheet(open: boolean): void
}

const isLast = () => clock.index >= clock.beats - 1

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
  ready: false,
  interacting: 0,
  layout: 'P',
  visible: true,
  webgl: true,
  showBuild: false,
  scrub: false,
  sheet: false,
  dprScale: 1,
  still: false,

  play() {
    const s = get()
    if (!s.def) return
    if (clock.held) {
      clock.held = false
      dropQueryKeys(['beat', 't'])
    }
    if (s.mode === 'explore') set({ mode: 'story' })
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
    set({ playing: false })
  },

  toggle() {
    if (get().playing) get().pause()
    else get().play()
  },

  next(user = true) {
    const s = get()
    if (!s.def) return
    if (user) haptic()
    if (isLast()) {
      navigateChapter(1)
      return
    }
    const n = clock.index + 1
    if (s.reduced || clock.held) {
      pb.glide = null
      setIT(n, 1)
      setA(clock.T * 2.5)
      set({ index: n, phase: 'hold', playing: false })
      return
    }
    if (s.mode === 'explore') set({ mode: 'story' })
    if (s.phase === 'build' && clock.t < 1 && s.playing) {
      glideTo(n, 350, 'settle', () => {
        startBeat(n)
        set({ playing: true })
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
    if (clock.index === 0 && (clock.t < 0.15 || s.reduced || clock.held)) {
      navigateChapter(-1)
      return
    }
    const n = clock.index === 0 ? 0 : clock.index - 1
    if (s.reduced || clock.held) {
      pb.glide = null
      setIT(n, 1)
      setA(clock.T * 2.5)
      set({ index: n, phase: 'hold', playing: false })
      return
    }
    if (s.mode === 'explore') set({ mode: 'story' })
    const wasPlaying = s.playing || s.phase === 'done'
    glideTo(n, 450, 'settle', () => {
      startBeat(n)
      set({ playing: wasPlaying })
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
    const phase: Phase = tt >= 1 ? (i >= s.def.beats.length - 1 ? 'done' : 'hold') : 'build'
    markSeek()
    set({ index: i, phase, playing: hold ? false : s.playing, ready: false })
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
      set({ mode: 'story', scrub: false })
    }
  },

  setDetent(d) {
    set({ detent: d })
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
