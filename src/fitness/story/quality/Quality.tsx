import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useStoryStore } from '../store'
import { tierDown, tierDpr, tierUp } from './tiers'
import type { Tier } from '../types'

/* =========================================================================
   Adaptive quality (DESIGN.md C.10). drei PerformanceMonitor drives the tier
   (HIGH / MEDIUM / LOW) and, within a tier, the DPR factor. The engine is the
   only DPR owner, so drei <AdaptiveDpr> is deliberately NOT mounted (it
   would fight the tier DPR). ?tier pins the tier and skips the monitor.
   ========================================================================= */

let ceiling: Tier = 'high'
export function setTierCeiling(t: Tier): void {
  ceiling = t
}

const RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 }

function setTier(t: Tier): void {
  const st = useStoryStore.getState()
  if (st.tierPinned || st.tier === t) return
  // inclining out of LOW also leaves still mode (render on demand)
  const up = RANK[t] > RANK[st.tier]
  useStoryStore.setState({ tier: t, dpr: tierDpr(t, 1), ...(up ? { still: false } : null) })
}

/** Still mode: LOW under 24 fps for 3 s renders on demand (clock stays exact). */
function StillWatch() {
  const acc = useRef({ time: 0, frames: 0 })
  useFrame((_, dt) => {
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
 * (amendment H.18): the slate, shader compile and SDF font load must never
 * demote a capable phone before the story starts. It is remounted per chapter.
 * Its window is 250 ms x 12 iterations (3 s), longer than drei's default, so
 * one slow burst does not flip the tier.
 */
export function Quality() {
  const pinned = useStoryStore((s) => s.tierPinned)
  const loaded = useStoryStore((s) => s.loaded)
  const key = useStoryStore((s) => s.def?.key ?? '')
  const [armed, setArmed] = useState('')
  useEffect(() => {
    if (!loaded || pinned) return
    const id = window.setTimeout(() => setArmed(key), 1500)
    return () => window.clearTimeout(id)
  }, [loaded, pinned, key])
  const measuring = !pinned && loaded && armed === key
  return (
    <>
      <StillWatch />
      {measuring && (
        <PerformanceMonitor
          key={key}
          ms={250}
          iterations={12}
          bounds={(r) => (r > 90 ? [50, 90] : [45, 58])}
          flipflops={3}
          onDecline={() => setTier(tierDown(useStoryStore.getState().tier))}
          onIncline={() => setTier(tierUp(useStoryStore.getState().tier, ceiling))}
          onFallback={() => setTier('low')}
          onChange={({ factor }) => {
            const st = useStoryStore.getState()
            const d = tierDpr(st.tier, factor)
            if (d !== st.dpr) useStoryStore.setState({ dpr: d })
          }}
        />
      )}
    </>
  )
}
