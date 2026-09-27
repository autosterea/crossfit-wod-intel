import { useStoryStore } from './store'

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
   ========================================================================= */

export const readyState = {
  fonts: false,
  /** chapter key whose Scene has mounted (Suspense resolved) */
  sceneKey: '' as string,
  /** chapter key whose materials finished gl.compileAsync */
  compiledKey: '' as string,
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
}

/** The stage root, for the data-story-ready attribute (set by the Stage). */
export const readyDom = { stage: null as HTMLElement | null }

if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    readyState.fonts = true
    readyTick(false)
  })
} else readyState.fonts = true

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
    const compiled = readyState.compiledKey === key || readyState.frames > 300
    const ok = readyState.fonts && (!st.webgl || (readyState.sceneKey === key && compiled && readyState.frames >= 2))
    if (ok) useStoryStore.setState({ loaded: true })
  }
  writeAttr()
}

/** A seek happened: QA settle restarts (no React state, no slate). */
export function markSeek(): void {
  readyState.settled = 0
  writeAttr()
}

/** A new chapter mounted in the persistent stage. */
export function resetReady(): void {
  readyState.frames = 0
  readyState.settled = 0
  writeAttr()
}
