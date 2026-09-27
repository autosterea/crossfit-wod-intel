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
import { selectSpoke, spokeVersion, subscribeSpoke } from './keySel'

/* =========================================================================
   Continuum HUD (DESIGN.md D.6 "HUD chip", "Portrait key").

   Landscape / desktop: the HUD chip, "TOWARD FITNESS" plus score / 100
   {computed, Math.round(mean x 100)}, from C4.

   Portrait phone / tablet: the KEY, a compact DOM panel under the dial,
   above the caption card (clear of the card's grab band). Its header row
   carries the same score; ten single-line cells (two columns laid out like
   the dial: the left column is the dial's left half, top to bottom, the
   right column its right half) show a spectrum dot, the marker's short name,
   its live value and a hairline continuum with the person's position on it.
   It arrives with the values (C4) so the dial lands alone in C3. Tapping a
   cell highlights that spoke; a horizontal swipe across it still steps the
   story. The dial poses reserve its measured height, and it is a label
   obstacle. It steps aside while the card or the explore sheet is expanded,
   and folds to its header row in the last beat (its claim takes the room
   under the dial, and the card grows a CTA row), so the dial keeps its size.
   ========================================================================= */

/** Cells in reading order: left column = spokes 9..5 (the dial's left half), right column = spokes 0..4. */
const ORDER = [9, 0, 8, 1, 7, 2, 6, 3, 5, 4].filter((i) => i < N)

const exploring = () => useStoryStore.getState().mode === 'explore'
const livePos = (i: number): number => (exploring() ? live.pos[i] : personPos(clock.T, i))
const liveMean = (): number => (exploring() ? live.mean : personMean(clock.T))
/** Values show once the person exists (the C4 climb), and always in explore. */
const valuesOn = (): number => (exploring() ? 1 : scoreOn(clock.T))

export default function ContinuumHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  // re-render only when the key / chip decision flips (not on every focus-rect change)
  const portrait = useSyncExternalStore(subscribeFocus, keyMode)
  useHudOpacity(root, (T) => (keyMode() ? 0 : exploring() ? 1 : scoreOn(T)))
  useEffect(
    () =>
      onFrame(() => {
        const n = num.current
        if (!n) return
        const m = liveMean()
        const s = String(scoreOf(m))
        if (n.textContent !== s) {
          n.textContent = s
          n.style.color = spectrumHex(m)
        }
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

  // the key's height is reserved in the dial poses
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const measure = () => {
      if (el.offsetHeight) keyState.h = el.offsetHeight
    }
    measure()
    keyState.hs = keyState.h
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // sit above the caption card or the explore sheet, clear of its grab band;
  // step aside while either is expanded
  const place = useRef({ bottom: -1, hidden: false, fold: -1, gridH: 0, op: -1, sig: '' as string | number, on: -1 })
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

  // a horizontal swipe across the key steps the story (C.6), like a swipe on
  // the stage; a short touch stays a tap on a cell (select its spoke). The
  // press pauses the story while held, and the release is heard on the
  // window, so a finger that slides off the key still lets go.
  const swipe = useRef({ x: 0, y: 0, t: 0, id: -1, swallow: false })
  const onPointerDown = (e: React.PointerEvent) => {
    const s = swipe.current
    if (s.id !== -1) return
    s.x = e.clientX
    s.y = e.clientY
    s.t = e.timeStamp
    s.id = e.pointerId
    s.swallow = false
    const release = useStoryStore.getState().mode === 'story' ? useStoryStore.getState().beginInteraction() : null
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== s.id) return
      s.id = -1
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      release?.()
      const st = useStoryStore.getState()
      if (ev.type !== 'pointerup' || st.mode !== 'story') return
      const dx = ev.clientX - s.x
      const dy = ev.clientY - s.y
      if (Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy) && ev.timeStamp - s.t < 600) {
        s.swallow = true
        if (dx < 0) st.next()
        else st.prev()
      }
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }
  const onCell = (i: number) => {
    if (swipe.current.swallow) {
      swipe.current.swallow = false
      return
    }
    selectSpoke(i)
  }

  // live values, dots and pips from story time (or the explore state); the
  // reserved height follows the measured one smoothly (a cut when held)
  const last = useRef<string[]>([])
  useEffect(
    () =>
      onFrame(() => {
        const el = panel.current
        if (!el) return
        const p = place.current
        const st = useStoryStore.getState()
        const snap = clock.held || st.reduced
        const dh = keyState.h - keyState.hs
        keyState.hs = snap || Math.abs(dh) < 0.5 ? keyState.h : keyState.hs + dh * 0.18
        const explore = st.mode === 'explore'
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
          el.style.pointerEvents = shown ? 'auto' : 'none'
          el.inert = !shown
          el.setAttribute('aria-hidden', shown ? 'false' : 'true')
          bumpObstacles()
        }
        const on = valuesOn()
        // only when a position can have moved (the text is a function of them)
        const sig = explore ? 'x' + live.version : personKey(clock.T)
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
    <div
      ref={panel}
      className="cont-key"
      style={{ bottom: 300, opacity: 0 }}
      data-no-gesture
      aria-label="Markers"
      onPointerDown={onPointerDown}
    >
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
          <button key={i} type="button" className="cont-key-cell" data-on={sel === i ? '1' : '0'} aria-pressed={sel === i} onClick={() => onCell(i)}>
            <span ref={(el) => void (dots.current[i] = el)} className="cont-key-dot" />
            <span className="cont-key-name">{shortName(i)}</span>
            <span ref={(el) => void (vals.current[i] = el)} className="cont-key-val" />
            <span className="cont-key-track" />
            <span ref={(el) => void (pips.current[i] = el)} className="cont-key-pip" />
          </button>
        ))}
      </div>
    </div>
  )
}

