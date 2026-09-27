import { useEffect, useRef } from 'react'
import { onFrame, clock } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useHudOpacity } from '../../story/ui/Hud'
import { hudOpacity, hudScore } from './Scene'
import { useDefExplore } from './exploreStore'
import { CURVE_BY_KEY, GENERALIST, scoreColor, scoreOf, scoreWord } from './definitionMath'
import { at } from '../../story/cue'

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
        let showWord: boolean
        if (useStoryStore.getState().mode === 'explore') {
          const name = useDefExplore.getState().athlete
          v = scoreOf(CURVE_BY_KEY[name]?.samples ?? GENERALIST.samples)
          showWord = true
        } else {
          v = hudScore(clock.T)
          showWord = clock.T >= 3.8
        }
        const s = String(v)
        if (n.textContent !== s) n.textContent = s
        const ws = showWord ? scoreWord(v) : ''
        if (w.textContent !== ws) {
          w.textContent = ws
          w.style.color = scoreColor(v)
        }
        const o = showWord ? String(Math.min(1, at(clock.T, 3, 0.8, 0.92) + (useStoryStore.getState().mode === 'explore' || clock.T >= 4 ? 1 : 0))) : '0'
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
