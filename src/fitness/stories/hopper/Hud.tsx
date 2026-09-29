import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { onFrame, clock } from '../../story/clock'
import { useHudOpacity } from '../../story/ui/Hud'
import { useStoryStore } from '../../story/store'
import { bumpObstacles, useObstacle } from '../../story/labels/useLabel'
import { subscribeFocus } from '../../story/camera/focusRect'
import type { Rect } from '../../story/types'
import { HOPPER_DOMAINS, MODAL_DOMAINS } from '../../fitnessData'
import { boardAt, hudOn } from './timeline'
import { srcAt } from './exploreStore'
import { exRails } from './ExploreScene'
import { qKey, useHopKey, worldNow } from './layout'
import { legendCue } from './Scene'
import './hopper.css'

/* Hopper HUD chip (DESIGN.md D.3): "DRAW" plus the number of the draw on
   the ticket, from H1 on (it counts through the H5 rain to 40). Explore:
   the explore run's draw. Written through refs, never per-frame React.

   Q (a short portrait focus rect: an iPhone with Safari's toolbars) also
   mounts the domain key here: the five colours and their names as a
   wrapping row of chips over the caption card, where the Continuum key sits.
   The Q poses reserve its measured height (layout.ts qKey). */

export default function HopperHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const key = useHopKey()
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
  const [stage, setStage] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setStage((root.current?.closest('.st-stage') as HTMLElement | null) ?? null)
  }, [])
  return (
    <>
      {/* Q: one line ("DRAW 40"), so the P1 rail's name passes under the chip */}
      <div ref={root} className={key === 'Q' ? 'st-hud-in hop-hud-inline' : 'st-hud-in'}>
        <div className="st-hud-eyebrow">DRAW</div>
        <div className="st-hud-row">
          <span ref={num} className="st-hud-num" style={{ color: 'var(--st-chalk)', textShadow: 'none', minWidth: '3ch' }}>
            1
          </span>
        </div>
      </div>
      {stage && key === 'Q' && createPortal(<DomainKey stage={stage} />, stage)}
    </>
  )
}

/** px between the key and the caption card (clear of the card's grab band) */
const GAP = 10

/**
 * The Q world's domain key: a wrapping row of five chips (a dot in the
 * domain colour and its MODAL_DOMAINS name) spanning the focus rect's width,
 * just over the caption card. A readout, not a control: taps and swipes on it
 * are taps and swipes on the stage. It is a label obstacle, it steps aside
 * while the card is expanded (the compact board), and its opacity is the
 * legend's cue (a function of T).
 */
function DomainKey({ stage }: { stage: HTMLElement }) {
  const panel = useRef<HTMLDivElement>(null)
  const place = useRef({ bottom: -1, left: -1, width: -1, op: -1 })

  // the Q poses reserve the key's height
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const measure = () => {
      if (el.offsetHeight) qKey.h = el.offsetHeight + GAP
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // over the caption card, across the focus rect
  const position = useCallback(() => {
    const el = panel.current
    if (!el) return
    const card = stage.querySelector('.st-card') as HTMLElement | null
    const sr = stage.getBoundingClientRect()
    const cr = card?.getBoundingClientRect()
    const cardTop = cr && cr.height ? cr.top - sr.top : sr.height * 0.66
    const p = place.current
    const bottom = Math.round(sr.height - cardTop + GAP)
    const left = 12
    const width = Math.round(sr.width - 24)
    let bump = false
    if (bottom !== p.bottom) {
      p.bottom = bottom
      el.style.bottom = bottom + 'px'
      bump = true
    }
    if (left !== p.left || width !== p.width) {
      p.left = left
      p.width = width
      el.style.left = left + 'px'
      el.style.width = width + 'px'
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
  }, [stage, position])

  useEffect(
    () =>
      onFrame(() => {
        const el = panel.current
        if (!el) return
        const p = place.current
        const o = Math.round(legendCue(clock.T) * 100) / 100
        if (o === p.op) return
        p.op = o
        el.style.opacity = String(o)
        el.style.visibility = o > 0 ? '' : 'hidden'
        el.setAttribute('aria-hidden', o > 0.5 ? 'false' : 'true')
        bumpObstacles()
      }),
    [],
  )

  const rect = useCallback((): Rect | null => {
    const el = panel.current
    if (!el || place.current.op <= 0.01) return null
    const r = el.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    if (!r.height) return null
    return { x: r.left - s.left - 4, y: r.top - s.top - 4, w: r.width + 8, h: r.height + 8 }
  }, [stage])
  useObstacle('hop-key', rect)

  return (
    <div ref={panel} className="hop-key" style={{ bottom: 300, opacity: 0, visibility: 'hidden' }} role="group" aria-label="Domains">
      {HOPPER_DOMAINS.map((d, k) => (
        <span key={d.key} className="hop-key-chip">
          <i style={{ background: d.color }} />
          {MODAL_DOMAINS[k].name}
        </span>
      ))}
    </div>
  )
}
