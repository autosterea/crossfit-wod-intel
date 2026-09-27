import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { clock, onFrame } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useHudOpacity } from '../../story/ui/Hud'
import { bumpObstacles, useObstacle } from '../../story/labels/useLabel'
import { subscribeFocus } from '../../story/camera/focusRect'
import type { Rect } from '../../story/types'
import { N, scoreOf, shortName, spectrumHex, valueText } from './continuumMath'
import { keyMode, keyState } from './layout'
import { keyFold, keyIn, personKey, personMean, personPos, scoreOn } from './timeline'
import { live } from './exploreStore'
import { spokeVersion, subscribeSpoke } from './keySel'

/* =========================================================================
   Continuum HUD (DESIGN.md D.6 "HUD chip", "Portrait key").

   Landscape / desktop: the HUD chip, "TOWARD FITNESS" plus score / 100
   {computed, Math.round(mean x 100)}, from C4.

   Portrait phone / tablet: the KEY, a compact DOM readout under the dial,
   above the caption card (clear of the card's grab band). Its header row
   carries the same score; ten single-line rows (two columns laid out like
   the dial: the left column is the dial's left half, top to bottom, the
   right column its right half) show a spectrum dot, the marker's short name,
   its live value and a hairline continuum with the person's position on it.
   It arrives WITH the C4 tilt, every marker at its sick value (the pit),
   and the values climb with the dots. It is a readout, not a control (22 px
   rows are too small for a thumb, B.11): the spoke names on the dial are
   the tap targets (44 px hotspots, Scene.tsx), and a tapped spoke lights its
   row here. A tap or swipe on the key is a tap or swipe on the stage. It is
   a label obstacle; it steps aside while the card or the explore sheet is
   expanded, and folds to its header row in the last beat (its claim takes
   the room under the dial, and the card grows a CTA row), so the dial keeps
   its size. The dial poses reserve its measured heights (layout.ts).
   ========================================================================= */

/** Rows in reading order: left column = spokes 9..5 (the dial's left half), right column = spokes 0..4. */
const ORDER = [9, 0, 8, 1, 7, 2, 6, 3, 5, 4].filter((i) => i < N)

const exploring = () => useStoryStore.getState().mode === 'explore'
const livePos = (i: number): number => (exploring() ? live.pos[i] : personPos(clock.T, i))
const liveMean = (): number => (exploring() ? live.mean : personMean(clock.T))
/** Values show once the pit is revealed (C4), and always in explore. */
const valuesOn = (): number => (exploring() ? 1 : scoreOn(clock.T))

export default function ContinuumHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const lastScore = useRef(-1)
  // re-render only when the key / chip decision flips (not on every focus-rect change)
  const portrait = useSyncExternalStore(subscribeFocus, keyMode)
  useHudOpacity(root, (T) => (keyMode() ? 0 : exploring() ? 1 : scoreOn(T)))
  useEffect(
    () =>
      onFrame(() => {
        // portrait shows the key instead (its header carries the score)
        if (keyMode()) return
        const n = num.current
        if (!n) return
        const m = liveMean()
        const s = scoreOf(m)
        if (s === lastScore.current) return
        lastScore.current = s
        n.textContent = String(s)
        n.style.color = spectrumHex(m)
      }),
    [],
  )
  const [stage, setStage] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setStage((root.current?.closest('.st-stage') as HTMLElement | null) ?? null)
  }, [])
  return (
    <>
      <div ref={root} className="st-hud-in">
        <div className="st-hud-eyebrow">TOWARD FITNESS</div>
        <div className="st-hud-row">
          <span ref={num} className="st-hud-num">
            0
          </span>
          <span className="st-hud-word" style={{ color: 'var(--st-muted)' }}>
            / 100
          </span>
        </div>
      </div>
      {stage && portrait && createPortal(<KeyPanel stage={stage} />, stage)}
    </>
  )
}

/* ------------------------------- the key ------------------------------- */

function KeyPanel({ stage }: { stage: HTMLElement }) {
  const panel = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const score = useRef<HTMLSpanElement>(null)
  const of = useRef<HTMLSpanElement>(null)
  const vals = useRef<(HTMLSpanElement | null)[]>([])
  const dots = useRef<(HTMLSpanElement | null)[]>([])
  const pips = useRef<(HTMLSpanElement | null)[]>([])
  const sel = useSyncExternalStore(subscribeSpoke, spokeVersion)
  const mode = useStoryStore((s) => s.mode)
  const detent = useStoryStore((s) => s.detent)
  const place = useRef({ bottom: -1, hidden: false, fold: -1, gridH: 0, op: -1, sig: -2, on: -1 })

  // the poses reserve the key's two heights: whole (C4, C5, explore) and folded to its header (C6)
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const measure = () => {
      const p = place.current
      const g = grid.current
      if (!el.offsetHeight) return
      if (p.fold <= 0) {
        keyState.full = el.offsetHeight
        if (g && g.scrollHeight) p.gridH = g.scrollHeight
      }
      if (p.gridH) keyState.folded = Math.max(0, keyState.full - p.gridH)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // sit above the caption card or the explore sheet, clear of its grab band;
  // step aside while either is expanded
  const position = useCallback(() => {
    const el = panel.current
    if (!el) return
    const card = stage.querySelector('.st-card') as HTMLElement | null
    const sr = stage.getBoundingClientRect()
    const cr = card?.getBoundingClientRect()
    const cardTop = cr && cr.height ? cr.top - sr.top : sr.height * 0.66
    const st = useStoryStore.getState()
    const expanded = st.mode === 'explore' ? !!card?.classList.contains('is-open') : st.detent === 'expanded'
    const bottom = Math.round(sr.height - cardTop + keyState.gap)
    const p = place.current
    let bump = false
    if (bottom !== p.bottom) {
      p.bottom = bottom
      el.style.bottom = bottom + 'px'
      bump = true
    }
    if (expanded !== p.hidden) {
      p.hidden = expanded
      keyState.hidden = expanded
      el.style.display = expanded ? 'none' : ''
      bump = true
    }
    if (bump) bumpObstacles()
  }, [stage])
  useLayoutEffect(() => {
    position()
    const ro = new ResizeObserver(() => position())
    ro.observe(stage)
    const card = stage.querySelector('.st-card')
    if (card) ro.observe(card)
    const off = subscribeFocus(position)
    return () => {
      ro.disconnect()
      off()
    }
  }, [stage, position, mode, detent])
  useEffect(() => () => void (keyState.hidden = false), [])

  // live values, dots and pips from story time (or the explore state)
  const last = useRef<string[]>([])
  useEffect(
    () =>
      onFrame(() => {
        const el = panel.current
        if (!el) return
        const p = place.current
        const explore = useStoryStore.getState().mode === 'explore'
        // the last beat folds the key to its header row (a function of T): its
        // claim needs the room under the dial, and its card grows a CTA row
        const g = grid.current
        if (g) {
          // one layout read, the first time (the grid is five fixed-height rows)
          if (!p.gridH) p.gridH = g.scrollHeight
          const fold = explore ? 0 : keyFold(clock.T)
          const fk = Math.round(fold * 100) / 100
          if (fk !== p.fold) {
            p.fold = fk
            g.style.maxHeight = fk > 0 ? Math.round((1 - fk) * p.gridH) + 'px' : ''
            g.style.opacity = fk > 0 ? String(Math.round((1 - fk) * 100) / 100) : ''
            g.style.visibility = fk >= 1 ? 'hidden' : ''
            bumpObstacles()
          }
        }
        const op = explore ? 1 : keyIn(clock.T)
        const o = Math.round(op * 100) / 100
        if (o !== p.op) {
          p.op = o
          el.style.opacity = String(o)
          const shown = o > 0.5
          el.style.visibility = o > 0 ? '' : 'hidden'
          el.setAttribute('aria-hidden', shown ? 'false' : 'true')
          bumpObstacles()
        }
        const on = valuesOn()
        // only when a position can have moved (the text is a function of them)
        const sig = explore ? live.version + 1e6 : personKey(clock.T)
        if (sig === p.sig && on === p.on) return
        p.sig = sig
        p.on = on
        for (let i = 0; i < N; i++) {
          const pos = livePos(i)
          const txt = valueText(i, pos)
          if (last.current[i] === txt) continue
          last.current[i] = txt
          const v = vals.current[i]
          if (v) v.textContent = txt
          const c = spectrumHex(pos)
          const d = dots.current[i]
          if (d) d.style.background = c
          const q = pips.current[i]
          if (q) {
            q.style.left = (pos * 100).toFixed(2) + '%'
            q.style.background = c
          }
        }
        const s = score.current
        if (s) {
          const m = liveMean()
          const t = on > 0.001 ? String(scoreOf(m)) : ''
          if (s.textContent !== t) {
            s.textContent = t
            s.style.color = spectrumHex(m)
            if (of.current) of.current.style.opacity = t ? '1' : '0'
          }
        }
      }),
    [],
  )

  const rect = useCallback((): Rect | null => {
    const el = panel.current
    if (!el || el.style.display === 'none' || place.current.op <= 0.01) return null
    const r = el.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    if (!r.height) return null
    return { x: r.left - s.left - 4, y: r.top - s.top - 4, w: r.width + 8, h: r.height + 8 }
  }, [stage])
  useObstacle('cont-key', rect)

  return (
    <div ref={panel} className="cont-key" style={{ bottom: 300, opacity: 0, visibility: 'hidden' }} role="group" aria-label="Markers">
      <div className="cont-key-head">
        <span className="cont-key-eyebrow">Toward fitness</span>
        <span>
          <span ref={score} className="cont-key-score" />
          <span ref={of} className="cont-key-of" style={{ opacity: 0 }}>
            / 100
          </span>
        </span>
      </div>
      <div ref={grid} className="cont-key-grid">
        {ORDER.map((i) => (
          <div key={i} className="cont-key-cell" data-on={sel === i ? '1' : '0'}>
            <span ref={(el) => void (dots.current[i] = el)} className="cont-key-dot" />
            <span className="cont-key-name">{shortName(i)}</span>
            <span ref={(el) => void (vals.current[i] = el)} className="cont-key-val" />
            <span className="cont-key-track" />
            <span ref={(el) => void (pips.current[i] = el)} className="cont-key-pip" />
          </div>
        ))}
      </div>
    </div>
  )
}
