import { useEffect, useRef } from 'react'
import { onFrame, clock } from '../../story/clock'
import { useHudOpacity } from '../../story/ui/Hud'
import { useStoryStore } from '../../story/store'
import { boardAt, hudOn } from './timeline'
import { srcAt } from './exploreStore'
import { WORLD } from './layout'
import { focusRect } from '../../story/camera/focusRect'

/* Hopper HUD chip (DESIGN.md D.3): "DRAW" plus the number of the draw on
   the ticket, from H1 on (it counts through the H5 rain to 40). Explore:
   the explore run's draw. Written through refs, never per-frame React. */

export default function HopperHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  useHudOpacity(root, (T) => (useStoryStore.getState().mode === 'explore' ? 1 : hudOn(T)))
  useEffect(
    () =>
      onFrame(() => {
        const n = num.current
        if (!n) return
        const { s, X, story } = srcAt(clock.T)
        const b = boardAt(s, X, WORLD[focusRect.layout].rails.len)
        const v = story ? Math.max(1, b.face) : b.face
        const txt = String(v)
        if (n.textContent !== txt) n.textContent = txt
      }),
    [],
  )
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
