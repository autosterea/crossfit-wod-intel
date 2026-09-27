import type { Beat } from './types'
import { clock, setA, setIT, setT } from './clock'
import { ease, type EaseName } from './ease'
import { useStoryStore } from './store'
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
  done: () => void
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

/** Hold time scales with the number of words (L14). */
export function holdFor(beat: Beat | undefined): number {
  if (!beat) return 3
  const w = words(beat.title) + words(beat.body)
  return Math.max(3, Math.min(9, 1.5 + 0.24 * w))
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
export function glideTo(T: number, ms: number, e: EaseName, done: () => void): void {
  pb.glide = { from: clock.T, to: T, elapsed: 0, dur: Math.max(0.001, ms / 1000), ease: e, done }
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

  // Glides (next / prev) are fixed-duration ramps of T.
  const g = pb.glide
  if (g) {
    g.elapsed += dt
    const k = Math.min(1, g.elapsed / g.dur)
    const T = g.from + (g.to - g.from) * ease[g.ease](k)
    if (k >= 1) {
      pb.glide = null
      setT(g.to)
      g.done()
    } else {
      setT(T)
      if (clock.index !== st.index) useStoryStore.setState({ index: clock.index })
    }
    setA(clock.T * 2.5)
    return
  }

  const hidden = typeof document !== 'undefined' && document.hidden
  const paused = !st.playing || st.interacting > 0 || st.mode === 'explore' || hidden || !pb.visible

  // Ambient clock A (L5): runs only in unheld autoplay or in explore.
  if (st.mode === 'explore' || (st.playing && !clock.held && !st.reduced && !paused)) setA(clock.A + dt)
  else if (st.mode === 'story') setA(clock.T * 2.5)

  if (paused) return
  // nothing builds behind the slate: wait for the first real frames
  if (!st.ready) return
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
        useStoryStore.setState({ phase: 'hold', playing: false, showBuild: false })
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
