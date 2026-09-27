import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { clock, onFrame } from '../../story/clock'
import { useStoryStore } from '../../story/store'
import { useHudOpacity } from '../../story/ui/Hud'
import { bumpObstacles, useObstacle } from '../../story/labels/useLabel'
import { focusVersion, subscribeFocus } from '../../story/camera/focusRect'
import type { Rect } from '../../story/types'
import { BIOMARKERS } from '../../fitnessData'
import { N, scoreOf, shortName, spectrumHex, valueText } from './continuumMath'
import { keyMode, keyState } from './layout'
import { keyIn, personMean, personPos, scoreOn } from './timeline'
import { live } from './exploreStore'
import { selectSpoke, spokeVersion, subscribeSpoke } from './keySel'

/* =========================================================================
   Continuum HUD (DESIGN.md D.6 "HUD chip", "Portrait key").

   Landscape / desktop: the HUD chip, "TOWARD FITNESS" plus score / 100
   {computed, Math.round(mean x 100)}, from C4.

   Portrait phone / tablet: the KEY, a DOM panel under the dial, above the
   caption card (clear of the card's grab band). Its header row carries the
   same score; ten cells (two columns laid out like the dial: the right
   column is the dial's right half, top to bottom, the left column its left
   half) show a spectrum dot, the marker's short name, its live value and a
   hairline continuum with the person's position on it. Tapping a cell
   highlights that spoke. The dial poses reserve its measured height, and it
   is a label obstacle. It steps aside while the card or the explore sheet
   is expanded.
   ========================================================================= */

/** Cells in reading order: left column = spokes 9..5 (the dial's left half), right column = spokes 0..4. */
const ORDER = [9, 0, 8, 1, 7, 2, 6, 3, 5, 4].filter((i) => i < N)

const livePos = (i: number): number => (useStoryStore.getState().mode === 'explore' ? live.pos[i] : personPos(clock.T, i))
const liveMean = (): number => (useStoryStore.getState().mode === 'explore' ? live.mean : personMean(clock.T))
/** Values show once the person exists (the C4 climb), and always in explore. */
const valuesOn = (): number => (useStoryStore.getState().mode === 'explore' ? 1 : scoreOn(clock.T))

export default function ContinuumHud() {
  const root = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  useSyncExternalStore(subscribeFocus, focusVersion)
  const portrait = keyMode()
  useHudOpacity(root, (T) => (keyMode() ? 0 : useStoryStore.getState().mode === 'explore' ? 1 : scoreOn(T)))
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

const S = {
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 5,
    padding: '5px 10px 6px',
    borderRadius: 12,
    background: 'var(--st-glass)',
    border: '1px solid var(--st-glass-border)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
    transition: 'opacity 220ms',
    maxWidth: 560,
    margin: '0 auto',
  },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', height: 16, padding: '0 4px' },
  eyebrow: { fontFamily: 'var(--st-cond)', fontWeight: 600, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--st-muted)' },
  score: { fontFamily: 'var(--st-mono)', fontWeight: 600, fontSize: 15, fontVariantNumeric: 'tabular-nums' },
  of: { fontFamily: 'var(--st-mono)', fontWeight: 500, fontSize: 11, color: 'var(--st-muted)', marginLeft: 3 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 10, rowGap: 0, marginTop: 1 },
  cell: {
    position: 'relative',
    display: 'block',
    height: 26,
    padding: '0 4px 0 4px',
    margin: 0,
    border: 0,
    borderRadius: 6,
    background: 'transparent',
    textAlign: 'left',
    color: 'inherit',
    cursor: 'pointer',
    minWidth: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  name: { display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--st-cond)', fontWeight: 600, fontSize: 11, lineHeight: '12px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--st-chalk)', whiteSpace: 'nowrap' },
  dot: { width: 7, height: 7, borderRadius: '50%', flex: 'none', boxShadow: '0 0 0 1.5px rgba(7,10,14,0.7)' },
  value: { display: 'block', fontFamily: 'var(--st-mono)', fontWeight: 500, fontSize: 11.5, lineHeight: '12px', color: 'var(--st-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', fontVariantNumeric: 'tabular-nums' },
  track: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 1,
    height: 2,
    borderRadius: 2,
    opacity: 0.4,
    background: 'linear-gradient(90deg, #ef4444, #f5b740 50%, #34d399)',
  },
  pip: { position: 'absolute', bottom: -1, width: 6, height: 6, marginLeft: -3, borderRadius: '50%', boxShadow: '0 0 0 1.5px rgba(7,10,14,0.85)' },
} as const satisfies Record<string, React.CSSProperties>

function KeyPanel({ stage }: { stage: HTMLElement }) {
  const panel = useRef<HTMLDivElement>(null)
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
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // sit above the caption card or the explore sheet, clear of its grab band;
  // step aside while either is expanded
  const place = useRef({ bottom: -1, hidden: false, op: -1, n: 0, sig: NaN, on: -1 })
  const position = useCallback(() => {
    const el = panel.current
    if (!el) return
    const card = stage.querySelector('.st-card') as HTMLElement | null
    const sr = stage.getBoundingClientRect()
    const cr = card?.getBoundingClientRect()
    const cardTop = cr && cr.height ? cr.top - sr.top : sr.height * 0.66
    const expanded = useStoryStore.getState().mode === 'explore' ? !!card?.classList.contains('is-open') : useStoryStore.getState().detent === 'expanded'
    const bottom = Math.round(sr.height - cardTop + keyState.gap)
    const p = place.current
    if (bottom !== p.bottom) {
      p.bottom = bottom
      el.style.bottom = bottom + 'px'
      bumpObstacles()
    }
    if (expanded !== p.hidden) {
      p.hidden = expanded
      keyState.hidden = expanded
      el.style.display = expanded ? 'none' : ''
      bumpObstacles()
    }
  }, [stage])
  useLayoutEffect(() => {
    position()
    const ro = new ResizeObserver(() => position())
    ro.observe(stage)
    const card = stage.querySelector('.st-card')
    if (card) ro.observe(card)
    return () => ro.disconnect()
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
        if (++p.n % 8 === 0) position()
        const explore = useStoryStore.getState().mode === 'explore'
        const op = explore ? 1 : keyIn(clock.T)
        const o = Math.round(op * 100) / 100
        if (o !== p.op) {
          p.op = o
          el.style.opacity = String(o)
          el.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
          el.setAttribute('aria-hidden', o > 0.5 ? 'false' : 'true')
          bumpObstacles()
        }
        const on = valuesOn()
        // only when story time or the explore state moved (the text is a function of them)
        const sig = explore ? -1 - live.version : clock.T
        if (sig === p.sig && on === p.on) return
        p.sig = sig
        p.on = on
        for (let i = 0; i < N; i++) {
          const pos = livePos(i)
          // before the person exists (C3) each cell names its unit; the value arrives with the climb (C4)
          const txt = on > 0.001 ? valueText(i, pos) : BIOMARKERS[i].unit
          if (last.current[i] !== txt) {
            last.current[i] = txt
            const v = vals.current[i]
            if (v) {
              v.textContent = txt
              v.style.color = on > 0.001 ? 'var(--st-body)' : 'var(--st-muted)'
            }
            const c = spectrumHex(pos)
            const d = dots.current[i]
            if (d) d.style.background = on > 0.001 ? c : 'rgba(238,243,246,0.25)'
            const q = pips.current[i]
            if (q) {
              q.style.left = (pos * 100).toFixed(2) + '%'
              q.style.background = c
              q.style.opacity = on > 0.001 ? '1' : '0'
            }
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
    [position],
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
    <div ref={panel} className="cont-key" style={{ ...S.panel, bottom: 300, opacity: 0 }} data-no-gesture aria-label="Markers">
      <div style={S.head}>
        <span style={S.eyebrow}>Toward fitness</span>
        <span>
          <span ref={score} style={S.score} />
          <span ref={of} style={{ ...S.of, opacity: 0 }}>/ 100</span>
        </span>
      </div>
      <div style={S.grid}>
        {ORDER.map((i) => (
          <button
            key={i}
            type="button"
            style={{ ...S.cell, background: sel === i ? 'rgba(238,243,246,0.08)' : 'transparent' }}
            aria-pressed={sel === i}
            onClick={() => selectSpoke(i)}
          >
            <span style={S.name}>
              <span ref={(el) => void (dots.current[i] = el)} style={{ ...S.dot, background: 'rgba(238,243,246,0.25)' }} />
              {shortName(i)}
            </span>
            <span ref={(el) => void (vals.current[i] = el)} style={S.value} />
            <span style={S.track} />
            <span ref={(el) => void (pips.current[i] = el)} style={{ ...S.pip, left: '0%', opacity: 0 }} />
          </button>
        ))}
      </div>
    </div>
  )
}
