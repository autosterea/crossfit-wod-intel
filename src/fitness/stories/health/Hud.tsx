import { useEffect, useRef } from 'react'
import { spectrumCss } from '../../fitnessData'
import { clock, onFrame } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useHudOpacity } from '../../story/ui/Hud'
import { scoreOfMean } from './healthMath'
import { HS } from './state'
import { hudOpacity, hudValue } from './timeline'

/* Health HUD chip (DESIGN.md D.7): "VOLUME = HEALTH" plus healthScore
   {computed}. Story: the running integral while the volume pours (L2), then
   the volume of the landscape shown, counting as it sinks and lifts, a pure
   function of T. Explore: the chosen profile's volume. The number rides the
   sickness / wellness / fitness spectrum the landscape is coloured with. */

export default function HealthHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const mode = useStoryStore((s) => s.mode)
  useHudOpacity(root, (T) => (useStoryStore.getState().mode === 'explore' ? 1 : hudOpacity(T)))
  useEffect(
    () =>
      onFrame(() => {
        const n = num.current
        if (!n) return
        const v = useStoryStore.getState().mode === 'explore' ? scoreOfMean(HS.score) : hudValue(clock.T)
        const s = String(v)
        if (n.textContent !== s) n.textContent = s
        const c = spectrumCss(v / 100)
        if (n.dataset.c !== c) {
          n.dataset.c = c
          n.style.color = c
          n.style.textShadow = '0 0 18px ' + c.replace('rgb(', 'rgba(').replace(')', ', 0.35)')
        }
      }),
    [mode],
  )
  return (
    <div ref={root} className="st-hud-in">
      <div className="st-hud-eyebrow">VOLUME = HEALTH</div>
      <div className="st-hud-row">
        <span ref={num} className="st-hud-num">
          0
        </span>
        <span className="st-hud-word" style={{ color: 'var(--st-muted)' }}>
          /100
        </span>
      </div>
    </div>
  )
}
