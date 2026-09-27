import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useStoryStore } from '../store'
import { ceilingStep, qualityLadder, startStep, type QualityStep } from './tiers'
import type { Tier } from '../types'

/* =========================================================================
   Adaptive quality (DESIGN.md C.10, amendments H.18 and H.29).

   drei PerformanceMonitor only MEASURES (250 ms samples, 12 per 3 s window,
   and it reports a window as an incline or a decline). The engine owns the
   policy, because drei's own policy demotes healthy devices: it counts every
   incline toward `flipflops` (a steady 60 fps phone passes flipflops = 3
   after four windows and its onFallback forces LOW), and its first
   evaluation always fires onChange from a factor of 0.5 (a DPR cut at about
   5 s on a phone with no problem). So: flipflops = Infinity, no onChange,
   no onFallback, and this hysteresis:

   - Quality moves one STEP along the ladder in tiers.ts (tier, dpr).
   - A DECLINE window steps down at once and lowers the chapter's ceiling to
     the new step: this chapter never climbs back into a step it fell from.
   - An INCLINE only counts when the device is below its ceiling, and only
     after INCLINE_RUN consecutive incline windows (about 12 s of sustained
     headroom). Any decline, or a gap without an incline, resets the run.
   - Inclines at the ceiling are ignored (a 60 fps phone at its best step
     does nothing, forever).

   The engine is the only DPR owner, so drei <AdaptiveDpr> is NOT mounted.
   ?tier pins the tier and skips the monitor.
   ========================================================================= */

const INCLINE_RUN = 4

/**
 * Monitor bounds RELATIVE to the measured refresh rate (amendment H.38).
 * drei's `refreshrate` is the highest fps it has seen. A phone the browser
 * caps at 30 fps (iOS Low Power Mode, Android battery savers) measures about
 * 30, and a steady rate at its cap is healthy: dropping quality cannot beat
 * a vsync cap, so fixed [45, 58] bounds would strip its bloom for nothing.
 * A window declines below max(26, min(45, 0.8 r)) and inclines at
 * min(58, 0.93 r). The 26 fps floor still demotes a device that cannot hold
 * 26 fps whatever its cap (an uneven 20 fps phone ends on LOW, then still).
 * Under a 50 fps refresh nothing inclines: a capped device runs at its cap
 * whatever the GPU load, so its steady rate says nothing about headroom.
 */
export function qualityBounds(r: number): [number, number] {
  const lo = Math.max(26, Math.min(45, 0.8 * r))
  const hi = r < 50 ? 1e9 : Math.max(lo + 2, Math.min(58, 0.93 * r))
  return [lo, hi]
}
/** A run of inclines breaks if no incline arrived for this long (s of frame time). */
const RUN_GAP = 4.5

const RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 }

/** Per page: the ladder, the current step and the start tier (set by bootStory). */
export const quality = {
  ladder: [] as QualityStep[],
  step: 0,
  startTier: 'medium' as Tier,
  /** QA: every tier / DPR change, with frame-time seconds since the page booted */
  log: [] as { at: number; tier: Tier; dpr: number; why: string }[],
  /** frame-time seconds (virtual-clock friendly: accumulated dt, no wall clock) */
  time: 0,
}

/** Called once per page by bootStory: the starting tier and its step. */
export function initQuality(tier: Tier): QualityStep {
  quality.ladder = qualityLadder()
  quality.startTier = tier
  quality.step = Math.max(0, startStep(quality.ladder, tier))
  const s = quality.ladder[quality.step] ?? { tier, dpr: 1 }
  quality.log.push({ at: 0, tier: s.tier, dpr: s.dpr, why: 'start' })
  return s
}

function applyStep(i: number, why: string): void {
  const st = useStoryStore.getState()
  if (st.tierPinned) return
  const s = quality.ladder[i]
  if (!s) return
  quality.step = i
  const up = RANK[s.tier] > RANK[st.tier]
  if (s.tier === st.tier && s.dpr === st.dpr) return
  quality.log.push({ at: Math.round(quality.time * 10) / 10, tier: s.tier, dpr: s.dpr, why })
  // inclining out of LOW also leaves still mode (render on demand)
  useStoryStore.setState({ tier: s.tier, dpr: s.dpr, ...(up ? { still: false } : null) })
}

/** Frame-time clock for the policy, and still mode: LOW under 24 fps for 3 s renders on demand. */
function QualityClock() {
  const acc = useRef({ time: 0, frames: 0 })
  useFrame((_, dt) => {
    quality.time += Math.min(dt, 0.5)
    const st = useStoryStore.getState()
    if (st.tier !== 'low' || st.still) {
      acc.current.time = 0
      acc.current.frames = 0
      return
    }
    acc.current.time += dt
    acc.current.frames++
    if (acc.current.time >= 3) {
      const fps = acc.current.frames / acc.current.time
      acc.current.time = 0
      acc.current.frames = 0
      if (fps < 24 && !st.tierPinned) useStoryStore.setState({ still: true })
    }
  }, -95)
  return null
}

/**
 * The monitor measures only once the chapter is LOADED plus a 1.5 s grace
 * (H.18): the slate, shader compile and SDF font load never demote a capable
 * phone before the story starts. It is remounted per chapter, and each
 * chapter starts with the ceiling of the page's starting tier, capped by the
 * step the device is on (a device never climbs above where it already is
 * without a fresh sustained run).
 */
export function Quality() {
  const pinned = useStoryStore((s) => s.tierPinned)
  const loaded = useStoryStore((s) => s.loaded)
  const key = useStoryStore((s) => s.def?.key ?? '')
  const [armed, setArmed] = useState('')
  const policy = useRef({ ceil: 0, run: 0, lastIncline: -99 })
  useEffect(() => {
    if (!loaded || pinned) return
    const id = window.setTimeout(() => setArmed(key), 1500)
    return () => window.clearTimeout(id)
  }, [loaded, pinned, key])
  useEffect(() => {
    // new chapter: the ceiling returns to the page's, the run restarts
    policy.current.ceil = ceilingStep(quality.ladder, quality.startTier)
    policy.current.run = 0
  }, [key])
  const measuring = !pinned && loaded && armed === key

  const onDecline = () => {
    const p = policy.current
    p.run = 0
    const next = Math.min(quality.ladder.length - 1, quality.step + 1)
    if (next === quality.step) return
    // never climb back into the step we just fell from, in this chapter
    p.ceil = Math.max(p.ceil, next)
    applyStep(next, 'decline')
  }
  const onIncline = () => {
    const p = policy.current
    if (quality.step <= p.ceil) {
      p.run = 0
      return // at the ceiling: nothing to gain, and it is not a flip-flop
    }
    p.run = quality.time - p.lastIncline > RUN_GAP ? 1 : p.run + 1
    p.lastIncline = quality.time
    if (p.run < INCLINE_RUN) return
    p.run = 0
    applyStep(quality.step - 1, 'sustained headroom')
  }

  return (
    <>
      <QualityClock />
      {measuring && (
        <PerformanceMonitor
          key={key}
          ms={250}
          iterations={12}
          factor={1}
          flipflops={Infinity}
          bounds={qualityBounds}
          onDecline={onDecline}
          onIncline={onIncline}
        />
      )}
    </>
  )
}
