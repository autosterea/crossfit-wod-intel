import { useStoryStore } from './store'

/* Readiness gates (DESIGN.md C.4): chunk loaded, document.fonts.ready, the
   SDF fonts (scene Suspense resolved), gl.compileAsync, and two rendered
   frames after the latest seek. The stage root mirrors the result as
   data-story-ready="0|1" and window.__story.ready. */

export const readyState = { fonts: false, scene: false, compiled: false, frames: 0 }

if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    readyState.fonts = true
    readyTick(false)
  })
} else readyState.fonts = true

/** Called by the engine every rendered frame (and by the no-WebGL loop). */
export function readyTick(frame = true): void {
  const st = useStoryStore.getState()
  if (frame) readyState.frames++
  // safety valve: never hold the story behind the slate for more than ~5 s of frames
  const compiled = readyState.compiled || readyState.frames > 300
  const ok =
    !!st.def &&
    readyState.fonts &&
    (!st.webgl || (readyState.scene && compiled)) &&
    (readyState.frames >= 2 || !st.webgl)
  if (ok !== st.ready) useStoryStore.setState({ ready: ok })
}

export function markSeek(): void {
  readyState.frames = 0
}

export function resetReady(): void {
  readyState.scene = false
  readyState.compiled = false
  readyState.frames = 0
}
