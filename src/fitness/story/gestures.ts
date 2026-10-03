import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useStoryStore } from './store'
import { clock } from './clock'
import { focusRect } from './camera/focusRect'
import { cameraBus } from './camera/CameraDirector'
import { pb, startBeat } from './playback'
import { dropQueryKeys } from './url'
import { readyState } from './ready'
import { suppressHotspotClick } from './hotspots'
import type { V3 } from './types'
import { audioHooks } from './audio/hooks' // [audio]

/* =========================================================================
   One gesture model for the whole stage (DESIGN.md C.6), gated by mode.
   Story: horizontal swipe steps beats, a single tap toggles pause (with a
   flash glyph), any touch pauses while held, vertical movement scrolls the
   page (touch-action: pan-y). Explore: registered drag handles win over
   orbit, two-pointer pinch and ctrl+wheel zoom, Scrub mode routes drags to
   the chapter. Keyboard: Left / Right / Space / Home / End / E / Esc.
   ========================================================================= */

export const gestureBus = {
  camera: null as THREE.PerspectiveCamera | null,
  /** set by the Stage: flashes the play / pause glyph */
  flash: (_playing: boolean) => {},
}

/* ----------------------------- handles -------------------------------- */

export interface DragHandle {
  id: string
  anchor: () => V3
  radiusPx?: number
  onStart?: () => void
  onDrag: (ray: THREE.Ray, ndc: [number, number]) => void
  onEnd?: () => void
}
const handles = new Map<string, DragHandle>()

export function useDragHandle(h: DragHandle): void {
  const ref = useRef(h)
  ref.current = h
  useEffect(() => {
    const proxy: DragHandle = {
      id: h.id,
      anchor: () => ref.current.anchor(),
      radiusPx: h.radiusPx,
      onStart: () => ref.current.onStart?.(),
      onDrag: (r, n) => ref.current.onDrag(r, n),
      onEnd: () => ref.current.onEnd?.(),
    }
    handles.set(h.id, proxy)
    return () => {
      handles.delete(h.id)
    }
  }, [h.id, h.radiusPx])
}

export function handleScreenPositions(): { id: string; x: number; y: number }[] {
  const cam = gestureBus.camera
  if (!cam) return []
  const v = new THREE.Vector3()
  return [...handles.values()].map((h) => {
    const a = h.anchor()
    v.set(a[0], a[1], a[2]).project(cam)
    return { id: h.id, x: ((v.x + 1) / 2) * focusRect.W, y: ((1 - v.y) / 2) * focusRect.H }
  })
}

const isUi = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('button, a, input, select, textarea, [data-no-gesture], .st-card, .st-explore, .st-sheet')

/** a stage hotspot (story/hotspots.tsx): a button, but swipe-transparent in story mode */
const hotOf = (t: EventTarget | null): Element | null => (t instanceof Element ? t.closest('.st-hot') : null)

/* ------------------------------ stage --------------------------------- */

export function useStageGestures(stageRef: { current: HTMLElement | null }): void {
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    let start: { x: number; y: number; t: number; id: number; hot: Element | null } | null = null
    let release: (() => void) | null = null
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch0 = 0
    let handle: DragHandle | null = null
    let scrubbing = false
    let lastScrub = { x: 0, y: 0 }
    let dprTimer = 0

    const localXY = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const ndcOf = (x: number, y: number): [number, number] => [(x / focusRect.W) * 2 - 1, 1 - (y / focusRect.H) * 2]
    const rayAt = (x: number, y: number) => {
      const cam = gestureBus.camera
      const ray = new THREE.Ray()
      if (!cam) return ray
      const [nx, ny] = ndcOf(x, y)
      ray.origin.setFromMatrixPosition(cam.matrixWorld)
      ray.direction.set(nx, ny, 0.5).unproject(cam).sub(ray.origin).normalize()
      return ray
    }
    const lowerDpr = (on: boolean) => {
      const st = useStoryStore.getState()
      window.clearTimeout(dprTimer)
      if (on) useStoryStore.setState({ dprScale: 0.8 })
      else dprTimer = window.setTimeout(() => useStoryStore.setState({ dprScale: 1 }), 300)
      void st
    }

    // Capture phase: explore handles and scrub win over OrbitControls.
    const onDownCapture = (e: PointerEvent) => {
      const st = useStoryStore.getState()
      if (st.mode !== 'explore' || isUi(e.target)) return
      const { x, y } = localXY(e)
      pointers.set(e.pointerId, { x, y })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y)
        e.stopPropagation()
        return
      }
      if (st.scrub && st.def?.explore.onScrub) {
        scrubbing = true
        e.stopPropagation()
        el.setPointerCapture?.(e.pointerId)
        lastScrub = { x, y }
        st.def.explore.onScrub(rayAt(x, y), ndcOf(x, y), 'start')
        lowerDpr(true)
        return
      }
      for (const pos of handleScreenPositions()) {
        const h = handles.get(pos.id)
        if (!h) continue
        if (Math.hypot(pos.x - x, pos.y - y) <= (h.radiusPx ?? 22)) {
          handle = h
          e.stopPropagation()
          el.setPointerCapture?.(e.pointerId)
          h.onStart?.()
          h.onDrag(rayAt(x, y), ndcOf(x, y))
          lowerDpr(true)
          return
        }
      }
      lowerDpr(true)
    }

    const onMoveCapture = (e: PointerEvent) => {
      const st = useStoryStore.getState()
      if (st.mode !== 'explore') return
      const { x, y } = localXY(e)
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x, y })
      if (pointers.size === 2 && pinch0 > 0) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d > 0) {
          cameraBus.zoomBy(pinch0 / d)
          pinch0 = d
        }
        e.stopPropagation()
        return
      }
      if (scrubbing && st.def?.explore.onScrub) {
        lastScrub = { x, y }
        st.def.explore.onScrub(rayAt(x, y), ndcOf(x, y), 'move')
        e.stopPropagation()
        return
      }
      if (handle) {
        handle.onDrag(rayAt(x, y), ndcOf(x, y))
        e.stopPropagation()
      }
    }

    const onUpCapture = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch0 = 0
      const st = useStoryStore.getState()
      if (scrubbing) {
        scrubbing = false
        st.def?.explore.onScrub?.(rayAt(lastScrub.x, lastScrub.y), ndcOf(lastScrub.x, lastScrub.y), 'end')
      }
      if (handle) {
        handle.onEnd?.()
        handle = null
      }
      if (st.mode === 'explore') lowerDpr(false)
    }

    // Story mode (bubble phase). The press is captured, so a mouse released
    // outside the stage (over the top bar, outside the window) still ends it.
    const onDown = (e: PointerEvent) => {
      const st = useStoryStore.getState()
      suppressHotspotClick(null)
      const hot = hotOf(e.target)
      if (st.mode !== 'story' || (!hot && isUi(e.target)) || readyState.pendingView) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, hot }
      release?.()
      release = st.beginInteraction()
      // touch keeps the browser's vertical pan (pan-y); mouse and pen capture,
      // except on a hotspot, whose own click must still reach the button
      if (e.pointerType !== 'touch' && !hot) {
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
    }
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (!start || e.pointerId !== start.id) return
      const s = start
      start = null
      release?.()
      release = null
      if (cancelled) return
      const st = useStoryStore.getState()
      if (st.mode !== 'story') return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      const dt = e.timeStamp - s.t
      if (Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy) && dt < 600) {
        if (s.hot) suppressHotspotClick(s.hot)
        if (dx < 0) st.next()
        else st.prev()
        return
      }
      if (s.hot) {
        // a press on a hotspot: a tap belongs to the button (its click);
        // anything that travelled is a gesture, not a tap
        if (Math.hypot(dx, dy) >= 10) suppressHotspotClick(s.hot)
        return
      }
      if (dt < 250 && Math.hypot(dx, dy) < 8) {
        const wasPlaying = st.playing
        st.toggle()
        gestureBus.flash(!wasPlaying)
      }
    }
    const onUp = (e: PointerEvent) => end(e, false)
    const onCancel = (e: PointerEvent) => end(e, true)
    // belt and braces: a press that ends anywhere in the window (or the window
    // losing focus) always releases the hold
    const onWinUp = (e: PointerEvent) => {
      if (start && e.pointerId === start.id) end(e, !el.contains(e.target as Node))
    }
    const onBlur = () => {
      start = null
      release?.()
      release = null
    }

    const onWheel = (e: WheelEvent) => {
      const st = useStoryStore.getState()
      if (st.mode !== 'explore' || !e.ctrlKey) return
      e.preventDefault()
      cameraBus.zoomBy(Math.exp(e.deltaY * 0.01))
    }

    el.addEventListener('pointerdown', onDownCapture, true)
    el.addEventListener('pointermove', onMoveCapture, true)
    el.addEventListener('pointerup', onUpCapture, true)
    el.addEventListener('pointercancel', onUpCapture, true)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('pointerup', onWinUp)
    window.addEventListener('pointercancel', onWinUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointerup', onWinUp)
      window.removeEventListener('pointercancel', onWinUp)
      window.removeEventListener('blur', onBlur)
      el.removeEventListener('pointerdown', onDownCapture, true)
      el.removeEventListener('pointermove', onMoveCapture, true)
      el.removeEventListener('pointerup', onUpCapture, true)
      el.removeEventListener('pointercancel', onUpCapture, true)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('wheel', onWheel)
      release?.()
      window.clearTimeout(dprTimer)
    }
  }, [stageRef])
}

/* ----------------------------- keyboard ------------------------------- */

/** Keys that step the story are left alone inside these (they own their arrows). */
const OWNS_ARROWS = '.st-explore, .st-sheet, [role="radiogroup"], [role="slider"], [role="tablist"], [role="listbox"]'
const STEP_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End'])

export function useStoryKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = useStoryStore.getState()
      if (!st.def || !pb.visible) return
      // the next chapter is loading under the slate: the old one is not steerable
      if (readyState.pendingView && e.key !== 'Escape') return
      // Stepping keys never act while exploring, while the chapter sheet is
      // open, or when focus sits in a control that uses arrows itself.
      if (STEP_KEYS.has(e.key) && (st.mode === 'explore' || st.sheet || (t instanceof Element && t.closest(OWNS_ARROWS)))) return
      if (st.sheet && e.key !== 'Escape') return
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          st.next()
          break
        case 'ArrowLeft':
          e.preventDefault()
          st.prev()
          break
        case ' ':
        case 'Spacebar':
          if (t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return
          e.preventDefault()
          if (st.mode === 'explore') st.setMode('story')
          st.toggle()
          gestureBus.flash(useStoryStore.getState().playing)
          break
        case 'Home':
          e.preventDefault()
          dropQueryKeys(['beat', 't'])
          if (st.reduced) st.seek(0, 1, { hold: false })
          else {
            startBeat(0)
            useStoryStore.setState({ playing: true })
            clock.held = false
          }
          break
        case 'End':
          e.preventDefault()
          dropQueryKeys(['beat', 't'])
          st.seek(st.def.beats.length - 1, 1, { hold: false })
          break
        case 'e':
        case 'E':
          st.setMode(st.mode === 'explore' ? 'story' : 'explore')
          break
        case 'm':
        case 'M':
          audioHooks.toggleKey() // [audio] sound on / off (starts it when Waiting), I.5.2
          break
        case 'Escape':
          if (st.sheet) st.setSheet(false)
          else if (st.mode === 'explore') st.setMode('story')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
