import { useRef } from 'react'
import { useFrame, type RootState } from '@react-three/fiber'
import type * as THREE from 'three'
import { clock } from './clock'
import { reportOnce } from './safe'

/* =========================================================================
   useSafeFrame (amendment H.44): the guarded per-frame hook for chapter code.

   R3F 9 calls every useFrame subscriber in a plain loop and only THEN
   renders, so a throw in any chapter's own useFrame skips gl.render on every
   frame and freezes the whole stage (composer included). The kit catches its
   own callbacks (safe.ts); this hook gives chapter code the same guarantee:

     useSafeFrame('hopper drum', (T, A, dt) => {
       drum.current!.rotation.x = A * 0.8          // ambient: the A clock (L5)
     }, { hide: drum })

   - T is story time (index + t), A the ambient clock: it runs only in unheld
     autoplay and in explore, and freezes as A = T x 2.5 whenever the story
     is held, seeked or reduced (L5). Never read performance.now or Date.
   - A throw hides `hide.current` (if given), logs ONE warning naming `site`
     and stops calling the callback; the stage keeps rendering.
   - priority: 0 (default) or negative only. A positive priority would take
     over rendering on LOW (no composer) and the stage would go black; it is
     clamped to 0 with a warning. The engine runs the clock at -100, the
     camera at -90, labels at -80, the UI pump at -70 and the readiness probe
     at -60, so a chapter's default 0 already sees this frame's T and camera.
   ========================================================================= */

export type SafeFrameFn = (T: number, A: number, dt: number, state: RootState) => void

export interface SafeFrameOpts {
  /** 0 (default) or negative */
  priority?: number
  /** hidden when the callback throws */
  hide?: { current: THREE.Object3D | null }
}

const warnedPriority = new Set<string>()

export function useSafeFrame(site: string, fn: SafeFrameFn, opts?: SafeFrameOpts): void {
  const f = useRef(fn)
  f.current = fn
  const dead = useRef(false)
  const hide = opts?.hide
  let priority = opts?.priority ?? 0
  if (priority > 0) {
    if (!warnedPriority.has(site)) {
      warnedPriority.add(site)
      console.warn('[story] useSafeFrame "' + site + '" asked for a positive priority; it runs at 0 (a positive useFrame takes over rendering and blacks out LOW)')
    }
    priority = 0
  }
  useFrame((state, dt) => {
    if (dead.current) return
    try {
      f.current(clock.T, clock.A, dt, state)
    } catch (err) {
      dead.current = true
      const h = hide?.current
      if (h) h.visible = false
      reportOnce('useSafeFrame "' + site + '"', err)
    }
  }, priority)
}
