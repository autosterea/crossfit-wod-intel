import { useEffect, useRef } from 'react'
import { onFrame, clock } from '../../story/clock'
import { useHudOpacity } from '../../story/ui/Hud'
import { useStoryStore } from '../../story/store'
import { boardAt, hudOn } from './timeline'
import { srcAt } from './exploreStore'
import { exRails } from './ExploreScene'
import { worldNow } from './layout'

/* Hopper HUD chip (DESIGN.md D.3): "DRAW" plus the number of the draw on
   the ticket, from H1 on (it counts through the H5 rain to 40). Explore:
   the explore run's draw. Written through refs, never per-frame React. */

export default function HopperHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  // explore: the chip steps aside for the Every run chart (it covers the first 40 draws, the chip counts the run)
  useHudOpacity(root, (T) => (useStoryStore.getState().mode === 'explore' ? exRails() : hudOn(T)))
  useEffect(() => {
    let last = NaN
    return onFrame(() => {
      const n = num.current
      if (!n) return
      const { s, X, story } = srcAt(clock.T)
      const b = boardAt(s, X, worldNow().rails.len)
      const v = story ? Math.max(1, b.face) : b.face
      if (v !== last) n.textContent = String((last = v))
    })
  }, [])
  return (
    <div ref={root} className="st-hud-in">
      <div className="st-hud-eyebrow">DRAW</div>
      <div className="st-hud-row">
        <span ref={num} className="st-hud-num" style={{ color: 'var(--st-chalk)', textShadow: 'none', minWidth: '3ch' }}>
          1
        </span>
      </div>
    </div>
  )
}
