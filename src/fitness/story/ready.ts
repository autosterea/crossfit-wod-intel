import { useStoryStore } from './store'
import { audioHooks } from './audio/hooks' // [audio]

/* =========================================================================
   Readiness (DESIGN.md C.4, amendment H.15). Two different things, kept apart:

   1. LOADED (store.loaded): one-way per chapter. The chunk is in, fonts are
      ready, the scene (SDF fonts included) resolved, gl.compileAsync finished
      and two frames rendered. It drives the slate and autoplay, and it never
      goes back to false until the chapter changes. A seek or a scrub never
      touches it, so the slate never flashes over the story.
   2. SETTLED (QA only): LOADED plus two rendered frames after the latest
      seek. It is written straight to the stage's data-story-ready attribute
      and window.__story.ready. No React state, so scrubbing costs nothing.

   A chapter never waits forever (amendment H.39): every SdfText suspends
   inside its OWN boundary (a failed font hides that word, never the scene),
   and LOADED is forced READY_TIMEOUT_MS after the chapter mounted and the
   page fonts resolved (READY_HARD_MS after mount whatever the fonts do), with
   one console warning naming what was missing. The story, captions and
   transport then run over whatever did load.
   ========================================================================= */

/** Readiness gives up waiting this long after the chapter mounted and document fonts resolved. */
export const READY_TIMEOUT_MS = 8000
/** ... and this long after the chapter mounted, whatever the fonts do. */
export const READY_HARD_MS = 15000

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0)

export const readyState = {
  fonts: false,
  /** chapter key whose Scene has mounted (Suspense resolved) */
  sceneKey: '' as string,
  /** chapter key whose materials were compiled (the prewarm) */
  compiledKey: '' as string,
  /** readyState.frames when the prewarm compile ran (two more frames finish the parallel link) */
  compiledFrame: 0,
  /** frames rendered since the chapter changed */
  frames: 0,
  /** frames rendered since the latest seek (QA settle) */
  settled: 0,
  /**
   * The route already moved to this chapter while its chunk loads; the old
   * StoryDef is still mounted (held under the slate). '' when not pending.
   * QA is never "settled" while pending, and steps / gestures are ignored.
   */
  pendingView: '' as string,
  /** SdfText words still loading their font (each counts while its own Suspense shows the fallback) */
  sdfPending: 0,
  /** when the current chapter mounted (ms, performance.now) */
  mountedAt: 0,
  /** when document.fonts.ready resolved (ms), or -1 */
  fontsAt: -1,
  /** the chapter key whose readiness was forced by the timeout ('' = none) */
  timedOut: '' as string,
}

/** The stage root, for the data-story-ready attribute (set by the Stage). */
export const readyDom = { stage: null as HTMLElement | null }

if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    readyState.fonts = true
    readyState.fontsAt = now()
    readyTick(false)
  })
} else {
  readyState.fonts = true
  readyState.fontsAt = 0
}

/** The readiness timeout has passed for the current chapter. */
function overdue(): boolean {
  const t = now()
  if (t - readyState.mountedAt > READY_HARD_MS) return true
  return readyState.fontsAt >= 0 && t - Math.max(readyState.mountedAt, readyState.fontsAt) > READY_TIMEOUT_MS
}

/** The chapter may compile its materials: the scene and every SDF word are in (or the wait timed out). */
export function sceneComplete(key: string): boolean {
  return readyState.sceneKey === key && (readyState.sdfPending === 0 || readyState.timedOut === key || overdue())
}

/** QA settle: loaded, and two frames rendered after the latest seek. */
export function isSettled(): boolean {
  const st = useStoryStore.getState()
  if (readyState.pendingView) return false
  return st.loaded && (readyState.settled >= 2 || !st.webgl)
}

/** A chapter change is pending (the new chunk is loading under the slate). */
export function setPending(view: string): void {
  if (readyState.pendingView === view) return
  readyState.pendingView = view
  writeAttr()
}

function writeAttr(): void {
  const el = readyDom.stage
  if (!el) return
  const v = isSettled() ? '1' : '0'
  if (el.getAttribute('data-story-ready') !== v) el.setAttribute('data-story-ready', v)
}

/** Called by the engine every rendered frame (and by the no-WebGL loop). */
export function readyTick(frame = true): void {
  const st = useStoryStore.getState()
  if (frame) {
    readyState.frames++
    readyState.settled++
  }
  if (!st.loaded && st.def) {
    const key = st.def.key
    // safety valve: never hold the story behind the slate for more than ~5 s of frames
    const compiled = (readyState.compiledKey === key && readyState.frames - readyState.compiledFrame >= 2) || readyState.frames > 300
    const sdf = readyState.sdfPending === 0
    const ok = readyState.fonts && (!st.webgl || (readyState.sceneKey === key && sdf && compiled && readyState.frames >= 2))
    if (ok) useStoryStore.setState({ loaded: true })
    else if (overdue()) {
      // Never leave the chapter on the slate: run the story over what loaded.
      const missing = [
        !readyState.fonts && 'page fonts',
        st.webgl && readyState.sceneKey !== key && 'scene',
        st.webgl && !sdf && readyState.sdfPending + ' SDF word(s)',
        st.webgl && !compiled && 'shader compile',
      ].filter(Boolean)
      readyState.timedOut = key
      console.warn('[story] ' + key + ' was not ready after ' + READY_TIMEOUT_MS / 1000 + ' s (' + missing.join(', ') + '); the story starts without them')
      useStoryStore.setState({ loaded: true })
    }
  }
  writeAttr()
}

/** A seek happened: QA settle restarts (no React state, no slate). */
export function markSeek(): void {
  audioHooks.seek() // [audio] every seek cuts the voice; nothing plays while held
  readyState.settled = 0
  writeAttr()
}

let timer: ReturnType<typeof setTimeout> | null = null

/** A new chapter mounted in the persistent stage. */
export function resetReady(): void {
  readyState.frames = 0
  readyState.settled = 0
  readyState.mountedAt = now()
  readyState.timedOut = ''
  writeAttr()
  // the timeout must fire even if no frame renders (hidden stage, no loop)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => readyTick(false), READY_TIMEOUT_MS + 100)
  setTimeout(() => readyTick(false), READY_HARD_MS + 100)
}
