import { useEffect, useRef } from 'react'
import { onFrame, clock } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useHudOpacity } from '../../story/ui/Hud'
import { COLOR, contribInto, type Shares } from './pathwaysMath'
import { cursorT, hudOn } from './timeline'
import { shown } from './shown'

/* Pathways HUD chip (DESIGN.md D.4): "SHARE OF ENERGY SUPPLY" plus the three
   shares at the cursor, each in its engine's colour, from P1 onward.
   Story: computed from T. Explore: at the explore cursor. Written through
   refs once per frame, only when a number changes. */

const KEYS = ['phosphagen', 'glycolytic', 'oxidative'] as const

export default function PathwaysHud() {
  const root = useRef<HTMLDivElement>(null)
  const nums = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)]
  const mode = useStoryStore((s) => s.mode)
  useHudOpacity(root, (T) => (useStoryStore.getState().mode === 'explore' ? 1 : hudOn(T)))

  useEffect(() => {
    const c: Shares = { phosphagen: 0, glycolytic: 0, oxidative: 0 }
    const last = [-1, -1, -1]
    return onFrame(() => {
      const t = useStoryStore.getState().mode === 'explore' ? shown.t : cursorT(clock.T)
      contribInto(t, c)
      for (let i = 0; i < KEYS.length; i++) {
        const el = nums[i].current
        const v = Math.round(c[KEYS[i]])
        if (!el || v === last[i]) continue
        last[i] = v
        el.textContent = String(v)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])
  return (
    <div ref={root} className="st-hud-in">
      <div className="st-hud-eyebrow">Share of energy supply</div>
      <div className="st-hud-row" style={{ gap: 10 }}>
        {KEYS.map((k, i) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
            <span ref={nums[i]} className="st-hud-num" style={{ color: COLOR[k], textShadow: `0 0 14px ${COLOR[k]}55`, minWidth: '2ch', textAlign: 'right' }}>
              0
            </span>
            <span style={{ fontFamily: 'var(--st-mono)', fontSize: 12, color: 'var(--st-muted)' }}>%</span>
          </span>
        ))}
      </div>
    </div>
  )
}
