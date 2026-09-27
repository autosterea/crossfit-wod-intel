import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clock } from './clock'
import { focusRect } from './camera/focusRect'
import { useStoryStore } from './store'
import { reportOnce } from './safe'
import type { Box, Mode } from './types'

/* =========================================================================
   Stage hotspots (README "Hotspots"): REAL, focusable <button>s laid over
   projected 3D things, for example the intro map's chapter tiles (D.1 I4).
   Labels are aria-hidden and never interactive; a hotspot is the opposite:
   a DOM button sized to the screen rect of a world box, updated through
   refs every placement pass (no React state per frame), exempt from the
   stage gestures (they ignore buttons), with a visible focus ring.

     useStageHotspot('intro-tile-skills', {
       box: (T) => (at(T, 4, 0.5, 0.6) > 0 ? TILE_BOX[0] : null),  // world box or null (hidden)
       onActivate: () => navigate({ view: 'skills' }),
       ariaLabel: '01 Skills',
       modes: 'both',                                         // 'story' (default) | 'explore' | 'both'
     })
   ========================================================================= */

export interface HotspotSpec {
  /** world box, a pure function of T; null hides the button (and takes it out of the tab order) */
  box: (T: number) => Box | null
  onActivate: () => void
  ariaLabel: string
  /** which story mode it exists in (default 'story') */
  modes?: Mode | 'both'
  /** extra padding around the projected rect, px (default 0); the button is never smaller than 44 x 44 */
  padPx?: number
}

interface Entry {
  id: string
  spec: HotspotSpec
  el: HTMLButtonElement | null
  shown: boolean
  x: number
  y: number
  w: number
  h: number
}

const registry = new Map<string, Entry>()
let setVersion = 0
const subs = new Set<() => void>()
const bump = () => {
  setVersion++
  for (const fn of subs) fn()
}

/** Register a hotspot while mounted. Pass a MEMOISED spec (or the latest is read through a ref). */
export function useStageHotspot(id: string, spec: HotspotSpec): void {
  const ref = useRef(spec)
  ref.current = spec
  useEffect(() => {
    const proxy: HotspotSpec = {
      box: (T) => ref.current.box(T),
      onActivate: () => ref.current.onActivate(),
      ariaLabel: spec.ariaLabel,
      modes: spec.modes,
      padPx: spec.padPx,
    }
    if (registry.has(id)) console.warn('[hotspots] duplicate hotspot id "' + id + '"')
    registry.set(id, { id, spec: proxy, el: null, shown: false, x: -1, y: -1, w: -1, h: -1 })
    bump()
    return () => {
      registry.delete(id)
      bump()
    }
  }, [id, spec.ariaLabel, spec.modes, spec.padPx])
}

function HotspotButton({ e }: { e: Entry }) {
  const ref = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    e.el = ref.current
    e.shown = false
    e.x = e.y = e.w = e.h = -1
    return () => {
      if (e.el === ref.current) e.el = null
    }
  }, [e])
  return (
    <button
      ref={ref}
      type="button"
      className="st-hot"
      aria-label={e.spec.ariaLabel}
      tabIndex={-1}
      style={{ visibility: 'hidden' }}
      onClick={() => e.spec.onActivate()}
    />
  )
}

/** DOM side (inside the stage): one button per registered hotspot; re-renders only when the set changes. */
export function HotspotLayer() {
  useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
    () => setVersion,
  )
  const list = [...registry.values()]
  if (!list.length) return null
  return (
    <div className="st-hots">
      {list.map((e) => (
        <HotspotButton key={e.id} e={e} />
      ))}
    </div>
  )
}

const _v = new THREE.Vector3()
const _c = new THREE.Vector3()

/** Canvas side: project each hotspot's box with the live camera, after the camera director. */
export function HotspotPlacer() {
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (!registry.size) return
    const T = clock.T
    const mode = useStoryStore.getState().mode
    for (const e of registry.values()) {
      const el = e.el
      if (!el) continue
      const m = e.spec.modes ?? 'story'
      let box: Box | null = null
      if (m === 'both' || m === mode) {
        try {
          box = e.spec.box(T)
        } catch (err) {
          reportOnce('hotspot "' + e.id + '" box', err)
        }
      }
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      if (box) {
        for (let k = 0; k < 8; k++) {
          _v.set(box[k & 1 ? 1 : 0][0], box[k & 2 ? 1 : 0][1], box[k & 4 ? 1 : 0][2])
          _c.copy(_v).applyMatrix4(camera.matrixWorldInverse)
          if (_c.z > -0.01) continue
          _v.project(camera)
          const px = ((_v.x + 1) / 2) * focusRect.W
          const py = ((1 - _v.y) / 2) * focusRect.H
          x0 = Math.min(x0, px)
          y0 = Math.min(y0, py)
          x1 = Math.max(x1, px)
          y1 = Math.max(y1, py)
        }
      }
      const show = x1 > x0 && y1 > y0
      if (show !== e.shown) {
        e.shown = show
        el.style.visibility = show ? 'visible' : 'hidden'
        el.tabIndex = show ? 0 : -1
      }
      if (!show) continue
      const pad = e.spec.padPx ?? 0
      let w = x1 - x0 + 2 * pad
      let h = y1 - y0 + 2 * pad
      let x = x0 - pad
      let y = y0 - pad
      // never smaller than a 44 px touch target
      if (w < 44) {
        x -= (44 - w) / 2
        w = 44
      }
      if (h < 44) {
        y -= (44 - h) / 2
        h = 44
      }
      const rx = Math.round(x)
      const ry = Math.round(y)
      const rw = Math.round(w)
      const rh = Math.round(h)
      if (rx !== e.x || ry !== e.y) {
        el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
        e.x = rx
        e.y = ry
      }
      if (rw !== e.w || rh !== e.h) {
        el.style.width = rw + 'px'
        el.style.height = rh + 'px'
        e.w = rw
        e.h = rh
      }
    }
  }, -79)
  return null
}

/** QA: the hotspots' current rects. */
export function hotspotsSnapshot() {
  return [...registry.values()].map((e) => ({ id: e.id, label: e.spec.ariaLabel, shown: e.shown, x: e.x, y: e.y, w: e.w, h: e.h }))
}
