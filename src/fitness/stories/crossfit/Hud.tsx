import { useEffect, useRef } from 'react'
import { onFrame, clock } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useHudOpacity } from '../../story/ui/Hud'
import { fmtThousands } from './crossfitMath'
import { hudOn, hudPower } from './Chart'

/* 07 CROSSFIT HUD chip (STORYBOARD-crossfit.md C3): "POWER, FT-LB/MIN" and
   the power of the block on screen, computed as Fran's constant work over
   the minutes it takes (the table's own 12,050 and 19,718 at the ends).
   Story only; explore has no chip. */

export default function CrossfitHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  useHudOpacity(root, (T) => (useStoryStore.getState().mode === 'explore' ? 0 : hudOn(T)))
  useEffect(
    () =>
      onFrame(() => {
        const n = num.current
        if (!n) return
        const s = fmtThousands(hudPower(clock.T))
        if (n.textContent !== s) n.textContent = s
      }),
    [],
  )
  return (
    <div ref={root} className="st-hud-in">
      <div className="st-hud-eyebrow">POWER, FT-LB/MIN</div>
      <div className="st-hud-row">
        <span ref={num} className="st-hud-num" style={{ color: '#f4b740' }}>
          12,050
        </span>
      </div>
    </div>
  )
}
