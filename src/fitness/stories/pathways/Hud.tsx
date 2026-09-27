import { useEffect, useRef } from 'react'
import { onFrame, clock } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useHudOpacity } from '../../story/ui/Hud'
import { COLOR, NAME, contribInto, type Shares } from './pathwaysMath'
import { cursorT, hudOn, introduced } from './timeline'
import { shown } from './shown'

/* Pathways HUD chip (DESIGN.md D.4): "SHARE OF ENERGY SUPPLY" plus the three
   shares at the cursor, each in its engine's colour, from P1 onward. Each
   number carries its engine's initial under the % sign (colour is never the
   only key) and a spoken name for screen readers; in the story an engine's
   number stays dim until its own beat introduces it, so each beat adds one
   engine (review r1). Story: computed from T. Explore: at the explore
   cursor, all three lit. Written through refs once per frame, only when a
   number or a level changes. */

const KEYS = ['phosphagen', 'glycolytic', 'oxidative'] as const
/** Band index (bottom to top) of each engine, for its flood beat. */
const BAND = [2, 1, 0] as const
const HIDDEN: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }

export default function PathwaysHud() {
  const root = useRef<HTMLDivElement>(null)
  const nums = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)]
  const cells = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)]
  const mode = useStoryStore((s) => s.mode)
  useHudOpacity(root, (T) => (useStoryStore.getState().mode === 'explore' ? 1 : hudOn(T)))

  useEffect(() => {
    const c: Shares = { phosphagen: 0, glycolytic: 0, oxidative: 0 }
    const last = [-1, -1, -1]
    const lastOp = [-1, -1, -1]
    return onFrame(() => {
      const explore = useStoryStore.getState().mode === 'explore'
      const t = explore ? shown.t : cursorT(clock.T)
      contribInto(t, c)
      for (let i = 0; i < KEYS.length; i++) {
        const el = nums[i].current
        const v = Math.round(c[KEYS[i]])
        if (el && v !== last[i]) {
          last[i] = v
          el.textContent = String(v)
        }
        const cell = cells[i].current
        const op = explore ? 1 : Math.round((0.32 + 0.68 * introduced(clock.T, BAND[i])) * 100) / 100
        if (cell && op !== lastOp[i]) {
          lastOp[i] = op
          cell.style.opacity = String(op)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])
  return (
    <div ref={root} className="st-hud-in">
      <div className="st-hud-eyebrow">Share of energy supply</div>
      <div className="st-hud-row" style={{ gap: 10 }}>
        {KEYS.map((k, i) => (
          <span key={k} ref={cells[i]} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, transition: 'opacity 200ms' }}>
            <span style={HIDDEN}>{NAME[k]}</span>
            <span ref={nums[i]} className="st-hud-num" style={{ color: COLOR[k], textShadow: `0 0 14px ${COLOR[k]}55`, minWidth: '2ch', textAlign: 'right' }}>
              0
            </span>
            {/* the % over the engine's initial, both at the 11 px floor (B.1; review r2), set tight */}
            <span aria-hidden="true" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 0.92, gap: 0 }}>
              <span style={{ fontFamily: 'var(--st-mono)', fontSize: 11, color: 'var(--st-muted)' }}>%</span>
              <span style={{ fontFamily: 'var(--st-cond)', fontWeight: 700, fontSize: 11, letterSpacing: '0.02em', color: COLOR[k] }}>{NAME[k][0]}</span>
            </span>
            <span style={HIDDEN}>percent</span>
          </span>
        ))}
      </div>
    </div>
  )
}
