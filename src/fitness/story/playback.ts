import type { Beat } from './types'
import { clock, setA, setIT, setT } from './clock'
import { ease, type EaseName } from './ease'
import { useStoryStore, phaseAt } from './store'
import { useFitnessStore } from '../fitnessStore'
import { MODULES } from '../fitnessData'
import type { FitnessView } from '../lessonTypes'

/* =========================================================================
   Autoplay state machine (DESIGN.md C.3): build -> hold -> advance. Runs from
   the engine clock loop (useFrame priority -100, or a plain rAF when there is
   no WebGL). Nothing here ever uses wall-clock time: only accumulated dt.
   ========================================================================= */

export interface Glide {
  from: number
  to: number
  elapsed: number
  dur: number
  ease: EaseName
  /** set by pause() during the glide: the glide finishes but does not resume play */
  paused: boolean
  done: (paused: boolean) => void
}

/** Mutable playback internals (not React state). */
export const pb = {
  holdElapsed: 0,
  holdFor: 3,
  /** "say it, then show it": wall-time pre-roll before a beat's build */
  delay: 0,
  glide: null as Glide | null,
  /** stage at least 10% visible */
  visible: true,
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length

/**
 * Hold time scales with the number of words (L14). Reading starts at the
 * caption swap (t = 0), so the whole build counts as reading time
 * (amendment H.29): a beat stays on screen for its reading time,
 * 0.4 s + 0.23 s per word (about 250 words per minute, a phone reader's
 * pace), and never holds less than 2 s after its build:
 * hold = clamp(0.4 + 0.23 x words - build, 2, 7).
 */
export function holdFor(beat: Beat | undefined): number {
  if (!beat) return 3
  const w = words(beat.title) + words(beat.body)
  return Math.max(2, Math.min(7, 0.4 + 0.23 * w - beat.build))
}

/** Start beat n at t = 0 in the build phase. */
export function startBeat(n: number): void {
  const st = useStoryStore.getState()
  pb.glide = null
  setIT(n, 0)
  pb.holdElapsed = 0
  pb.holdFor = holdFor(st.def?.beats[n])
  pb.delay = st.reduced ? 0 : 0.15
  useStoryStore.setState({ index: clock.index, phase: 'build' })
}

/** Fixed-duration ramp of T (linear in T by default). */
export function glideTo(T: number, ms: number, e: EaseName, done: (paused: boolean) => void): void {
  pb.glide = { from: clock.T, to: T, elapsed: 0, dur: Math.max(0.001, ms / 1000), ease: e, paused: false, done }
}

export function haptic(): void {
  try {
    if (useStoryStore.getState().reduced) return
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8)
  } catch {
    /* no-op on iOS */
  }
}

const ORDER: FitnessView[] = ['intro', ...MODULES.map((m) => m.key as FitnessView)]

/** Move to the next (+1) or previous (-1) chapter. The chapter mounts at beat 0. */
export function navigateChapter(dir: 1 | -1): void {
  const view = useStoryStore.getState().view
  const i = ORDER.indexOf(view)
  const j = i + dir
  if (j < 0 || j >= ORDER.length) return
  useFitnessStore.getState().navigate({ view: ORDER[j] })
}

/** Ring progress 0..1 for the play button: (build + hold elapsed) / (build + hold). */
export function ringProgress(): number {
  const st = useStoryStore.getState()
  const beat = st.def?.beats[clock.index]
  if (!beat) return 0
  const total = beat.build + pb.holdFor
  if (st.phase === 'build') return (clock.t * beat.build) / total
  if (st.phase === 'hold') return Math.min(1, (beat.build + pb.holdElapsed) / total)
  return 1
}

/** One clock step. dt in seconds. */
export function tick(dtRaw: number): void {
  const dt = Math.min(Math.max(dtRaw, 0), 0.1)
  const st = useStoryStore.getState()
  const def = st.def
  if (!def) return

  const hidden = typeof document !== 'undefined' && document.hidden

  // Glides (next / prev) are fixed-duration ramps of T. They freeze while a
  // finger is down, a sheet is open, or the tab / stage is hidden.
  const g = pb.glide
  if (g) {
    if (st.interacting > 0 || hidden || !pb.visible) return
    g.elapsed += dt
    const k = Math.min(1, g.elapsed / g.dur)
    const T = g.from + (g.to - g.from) * ease[g.ease](k)
    if (k >= 1) {
      pb.glide = null
      setT(g.to)
      g.done(g.paused)
    } else {
      setT(T)
      if (clock.index !== st.index) useStoryStore.setState({ index: clock.index })
    }
    setA(clock.T * 2.5)
    return
  }

  const paused = !st.playing || st.interacting > 0 || st.mode === 'explore' || hidden || !pb.visible

  // Ambient clock A (L5): runs only in unheld autoplay or in explore.
  if (st.mode === 'explore' || (st.playing && !clock.held && !st.reduced && !paused)) setA(clock.A + dt)
  else if (st.mode === 'story') setA(clock.T * 2.5)

  if (paused) return
  // nothing builds behind the slate: wait for the first real frames
  if (!st.loaded) return
  const beat = def.beats[clock.index]
  if (!beat) return

  if (st.phase === 'build') {
    if (pb.delay > 0) {
      pb.delay -= dt
      return
    }
    const t = clock.t + dt / Math.max(0.1, beat.build)
    if (t >= 1) {
      setIT(clock.index, 1)
      pb.holdElapsed = 0
      pb.holdFor = holdFor(beat)
      if (st.showBuild) {
        useStoryStore.setState({ phase: phaseAt(clock.index, 1, def.beats.length), playing: false, showBuild: false })
        return
      }
      useStoryStore.setState({ phase: clock.index >= def.beats.length - 1 ? 'done' : 'hold' })
      if (clock.index >= def.beats.length - 1) useStoryStore.setState({ playing: false })
    } else {
      setIT(clock.index, t)
    }
  } else if (st.phase === 'hold') {
    pb.holdElapsed += dt
    if (pb.holdElapsed >= pb.holdFor) {
      if (clock.index < def.beats.length - 1) startBeat(clock.index + 1)
      else useStoryStore.setState({ phase: 'done', playing: false })
    }
  }
}
