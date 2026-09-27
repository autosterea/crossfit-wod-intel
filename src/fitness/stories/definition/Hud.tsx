import { useEffect, useRef } from 'react'
import { onFrame, clock } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useHudOpacity } from '../../story/ui/Hud'
import { hudOpacity, hudScore, hudWordOn } from './Scene'
import { useDefExplore } from './exploreStore'
import { CURVE_BY_KEY, GENERALIST, scoreColor, scoreOf, scoreWord } from './definitionMath'

/* Definition HUD chip (DESIGN.md D.5): "AREA" plus the counting score, with
   the score word in the sub-line once the claim lands. Story: computed from
   T. Explore: the chosen athlete's score. */

export default function DefinitionHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const word = useRef<HTMLSpanElement>(null)
  const mode = useStoryStore((s) => s.mode)
  useHudOpacity(root, (T) => (useStoryStore.getState().mode === 'explore' ? 1 : hudOpacity(T)))

  useEffect(
    () =>
      onFrame(() => {
        const n = num.current
        const w = word.current
        if (!n || !w) return
        let v: number
        let wordOn: number
        if (useStoryStore.getState().mode === 'explore') {
          const name = useDefExplore.getState().athlete
          v = scoreOf(CURVE_BY_KEY[name]?.samples ?? GENERALIST.samples)
          wordOn = 1
        } else {
          v = hudScore(clock.T)
          wordOn = hudWordOn(clock.T)
        }
        const s = String(v)
        if (n.textContent !== s) n.textContent = s
        // While counting the number is chalk; once the word lands, number and
        // word take the score colour (L8: yellow-green is never a specialist's low score).
        const c = wordOn > 0.5 ? scoreColor(v) : 'var(--st-chalk)'
        if (n.style.color !== c) n.style.color = c
        const ws = wordOn > 0 ? scoreWord(v) : ''
        if (w.textContent !== ws) {
          w.textContent = ws
          w.style.color = scoreColor(v)
        }
        const o = String(Math.round(wordOn * 100) / 100)
        if (w.style.opacity !== o) w.style.opacity = o
      }),
    [mode],
  )
  return (
    <div ref={root} className="st-hud-in">
      <div className="st-hud-eyebrow">AREA</div>
      <div className="st-hud-row">
        <span ref={num} className="st-hud-num">
          0
        </span>
        <span ref={word} className="st-hud-word" />
      </div>
    </div>
  )
}
