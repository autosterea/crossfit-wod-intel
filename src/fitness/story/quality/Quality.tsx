import { useRef } from 'react'
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

function setTier(t: Tier): void {
  const st = useStoryStore.getState()
  if (st.tierPinned || st.tier === t) return
  useStoryStore.setState({ tier: t, dpr: tierDpr(t, 1) })
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

export function Quality() {
  const pinned = useStoryStore((s) => s.tierPinned)
  return (
    <>
      <StillWatch />
      {!pinned && (
        <PerformanceMonitor
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
