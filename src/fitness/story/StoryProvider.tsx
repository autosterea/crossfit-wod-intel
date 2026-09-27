import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react'
import type { StoryDef } from './types'
import { clock, resetClock, setA } from './clock'
import { phaseAt, useStoryStore, type StoryState } from './store'
import { parseQuery } from './url'
import { pb, holdFor } from './playback'
import { readStats } from './quality/stats'
import { labelCounts, labelsSnapshot } from './labels/LabelLayer'
import { focusRect } from './camera/focusRect'
import { initialTier } from './quality/tiers'
import { setStoryFrameOpts, storyFrame } from './kit/chartFrame'
import { initQuality, quality } from './quality/Quality'
import { isSettled, markSeek, readyState, resetReady } from './ready'
import { gestureBus } from './gestures'
import { hotspotsSnapshot } from './hotspots'
import { probeIds, runProbe } from './qa'
import * as THREE from 'three'

/* =========================================================================
   StoryProvider (DESIGN.md C.4b): resets the clock and store for a chapter,
   applies the URL query once (?beat ?t ?explore ?tier ?motion ?detent),
   registers window.__story for QA, and publishes the StoryDef.
   ========================================================================= */

const Ctx = createContext<StoryDef | null>(null)

export function useStory(): StoryDef {
  const d = useContext(Ctx) ?? useStoryStore.getState().def
  if (!d) throw new Error('useStory outside a StoryProvider')
  return d
}

export function useStoryStoreSel<S>(sel: (s: StoryState) => S): S {
  return useStoryStore(sel)
}

/* --------------------------- reduced motion --------------------------- */

function computeReduced(): boolean {
  const q = parseQuery()
  if (q.motion === 'reduce') return true
  if (q.motion === 'full') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Install tier, DPR and reduced-motion state once per page. */
let booted = false
export function bootStory(): void {
  if (booted) return
  booted = true
  const { tier, pinned } = initialTier()
  const step = initQuality(tier)
  useStoryStore.setState({ tier, tierPinned: pinned, dpr: step.dpr, reduced: computeReduced() })
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', () => {
      if (parseQuery().motion) return
      useStoryStore.setState({ reduced: mq.matches })
    })
  } catch {
    /* ignore */
  }
}

/* ------------------------------ provider ------------------------------ */

export function StoryProvider({ def, children }: { def: StoryDef; children: ReactNode }) {
  // Reset synchronously before children render so the first frame is right.
  useLayoutEffect(() => {
    bootStory()
    const st = useStoryStore.getState()
    resetClock(def.beats.length)
    resetReady()
    pb.glide = null
    // no pre-roll on a chapter's first beat: its build starts as the slate
    // fades (the caption is already in place under the slate)
    pb.delay = 0
    setStoryFrameOpts(def.frame ?? null)
    pb.holdElapsed = 0
    pb.holdFor = holdFor(def.beats[0])
    const q = parseQuery()
    useStoryStore.setState({
      def,
      view: def.key,
      index: 0,
      phase: 'build',
      mode: 'story',
      playing: !st.reduced,
      loaded: false,
      showBuild: false,
      scrub: false,
      detent: q.detent ?? st.detent,
    })
    if (st.reduced) {
      // Reduced motion: every beat renders at its end state; no autoplay.
      clock.index = 0
      clock.t = 1
      clock.T = 1
      clock.version++
      useStoryStore.setState({ phase: phaseAt(0, 1, def.beats.length) })
    }
    if (q.beat !== null) {
      useStoryStore.getState().seek(q.beat, q.t ?? 1, { hold: true })
    }
    if (q.explore) {
      if (q.beat === null) useStoryStore.getState().seek(def.beats.length - 1, 1, { hold: true })
      useStoryStore.getState().setMode('explore')
    }
    setA(clock.T * 2.5)
    registerQA(def)
    return () => {
      const w = window as unknown as { __story?: unknown }
      if (w.__story && (w.__story as { chapter?: string }).chapter === def.key) delete w.__story
      useStoryStore.setState({ def: null, playing: false, mode: 'story' })
    }
  }, [def])

  return <Ctx.Provider value={def}>{children}</Ctx.Provider>
}

/* ------------------------------- QA ----------------------------------- */

function registerQA(def: StoryDef): void {
  const api = {
    /** the chapter the URL shows (the pending one while its chunk loads) */
    get view() {
      return readyState.pendingView || def.key
    },
    /** true while the next chapter's chunk loads and the old one is held under the slate */
    get pending() {
      return !!readyState.pendingView
    },
    /** the chapter whose StoryDef is mounted */
    chapter: def.key,
    beats: def.beats.map((b) => ({ id: b.id, title: b.title, build: b.build })),
    seek(n: number, t: number) {
      useStoryStore.getState().seek(n, t, { hold: true })
      markSeek()
    },
    play: () => useStoryStore.getState().play(),
    pause: () => useStoryStore.getState().pause(),
    next: () => useStoryStore.getState().next(false),
    prev: () => useStoryStore.getState().prev(false),
    explore(on = true) {
      useStoryStore.getState().setMode(on ? 'explore' : 'story')
    },
    state() {
      const s = useStoryStore.getState()
      return {
        index: clock.index,
        t: clock.t,
        T: clock.T,
        playing: s.playing,
        held: clock.held,
        mode: s.mode,
        tier: s.tier,
        dpr: readStats(s.tier).dpr,
        reduced: s.reduced,
        detent: s.detent,
        layout: focusRect.layout,
        phase: s.phase,
        /** LOW under 24 fps: the canvas renders on demand (C.10) */
        still: s.still,
        loaded: s.loaded,
        focus: { x: focusRect.x, y: focusRect.y, w: focusRect.w, h: focusRect.h, W: focusRect.W, H: focusRect.H },
      }
    },
    stats() {
      return readStats(useStoryStore.getState().tier)
    },
    labels: () => labelsSnapshot(),
    /** QA: a chapter's read-only probe (useQAProbe), e.g. geometry end points */
    probe: (id: string) => runProbe(id),
    probes: () => probeIds(),
    /** QA: stage hotspots (real buttons over projected 3D boxes) */
    hotspots: () => hotspotsSnapshot(),
    /** QA: adaptive-quality changes (tier, dpr, reason, frame-time seconds) since the page booted */
    qualityLog: () => quality.log.map((e) => ({ ...e })),
    /** label counts against the caps (C.9): registered, live, cap */
    labelCounts: () => labelCounts(),
    /** QA: world point -> stage CSS px with the current camera (registration checks) */
    project(x: number, y: number, z: number) {
      const cam = gestureBus.camera
      if (!cam) return null
      cam.updateMatrixWorld()
      const v = new THREE.Vector3(x, y, z).project(cam)
      return { x: ((v.x + 1) / 2) * focusRect.W, y: ((1 - v.y) / 2) * focusRect.H, camera: cam.position.toArray().map((n) => Math.round(n * 1000) / 1000) }
    },
    /**
     * QA: the chapter's chart frame box (StoryDef.frame) projected with the
     * live camera, in stage px, or null without a frame. Explore re-fit
     * checks assert it stays inside the focus rect at every sheet detent.
     */
    chartRect() {
      const cam = gestureBus.camera
      if (!cam || !def.frame) return null
      cam.updateMatrixWorld()
      const b = storyFrame().box
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(b[i & 1 ? 1 : 0][0], b[i & 2 ? 1 : 0][1], b[i & 4 ? 1 : 0][2]).project(cam)
        const px = ((v.x + 1) / 2) * focusRect.W
        const py = ((1 - v.y) / 2) * focusRect.H
        x0 = Math.min(x0, px)
        x1 = Math.max(x1, px)
        y0 = Math.min(y0, py)
        y1 = Math.max(y1, py)
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    },
    /** QA settle: loaded and two frames rendered after the latest seek (H.15) */
    get ready() {
      return isSettled()
    },
  }
  ;(window as unknown as { __story: typeof api }).__story = api
}
