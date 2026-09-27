import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStoryStore } from '../store'
import { clock } from '../clock'
import { Segments } from './Segments'
import { Transport } from './Transport'
import { MODULES, MODULE_COPY, PAL, moduleByKey } from '../../fitnessData'
import { useFitnessStore } from '../../fitnessStore'
import type { Beat, StoryDef } from '../types'
import type { FitnessView, ModuleKey } from '../../lessonTypes'
import { IconChevron } from './icons'
import { useObservedCard } from '../camera/focusRect'

/* =========================================================================
   Caption card (DESIGN.md B.2, C.7). Phone: a glass card over the bottom of
   the stage with three detents (peek / default / expanded), dragged on y or
   toggled from the grab handle; a horizontal swipe on the card steps beats.
   Desktop and landscape: a left column. "Say it, then show it": the caption
   swaps at t = 0 (out 160 ms, in 220 ms), the scene starts 150 ms later.
   ========================================================================= */

const ORDER: FitnessView[] = ['intro', ...MODULES.map((m) => m.key as FitnessView)]

export function eyebrowFor(def: StoryDef, beat: Beat): string {
  if (beat.eyebrow) return beat.eyebrow
  if (def.key === 'intro') return 'Overview'
  const m = moduleByKey(def.key as ModuleKey)
  return `${m.num} ${m.label}`
}

export function accentFor(view: FitnessView): string {
  if (view === 'intro') return PAL.yellowGreen
  return moduleByKey(view as ModuleKey).accent
}

/** Body text with colour-linked terms (B.11). */
export function withTerms(body: string, terms?: Beat['terms']): ReactNode {
  if (!terms) return body
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length)
  if (!keys.length) return body
  const parts: ReactNode[] = []
  let rest = body
  let k = 0
  while (rest.length) {
    let best = -1
    let key = ''
    for (const t of keys) {
      const i = rest.indexOf(t)
      if (i >= 0 && (best < 0 || i < best)) {
        best = i
        key = t
      }
    }
    if (best < 0) {
      parts.push(rest)
      break
    }
    if (best > 0) parts.push(rest.slice(0, best))
    parts.push(
      <span key={k++} className="st-term" style={{ color: PAL[terms[key]] }}>
        {key}
      </span>,
    )
    rest = rest.slice(best + key.length)
  }
  return parts
}

function NextChapterCta({ view }: { view: FitnessView }) {
  const i = ORDER.indexOf(view)
  const next = ORDER[i + 1]
  const navigate = useFitnessStore((s) => s.navigate)
  if (!next || next === 'intro') return null
  const m = moduleByKey(next as ModuleKey)
  return (
    <button type="button" className="st-btn st-btn--solid" onClick={() => navigate({ view: next })}>
      <span className="st-btn-l">
        Next: {m.num} {m.mobileLabel ?? m.label}
      </span>
    </button>
  )
}

export function CaptionCard({ cardRef, shell }: { cardRef: React.RefObject<HTMLDivElement | null>; shell: string }) {
  const def = useStoryStore((s) => s.def)
  const index = useStoryStore((s) => s.index)
  const detent = useStoryStore((s) => s.detent)
  const phase = useStoryStore((s) => s.phase)
  const reduced = useStoryStore((s) => s.reduced)
  const navigate = useFitnessStore((s) => s.navigate)
  const phone = shell === 'phone' || shell === 'tablet'

  // Card gestures: vertical drag between detents, horizontal swipe steps beats.
  const drag = useRef<{ x: number; y: number; t: number; id: number; release: () => void } | null>(null)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const down = (e: PointerEvent) => {
      const target = e.target as Element
      if (target.closest('button, a, input, [data-no-gesture], .st-more')) return
      drag.current?.release()
      drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, release: useStoryStore.getState().beginInteraction() }
      // a mouse released outside the card still ends the drag (and the hold)
      if (e.pointerType !== 'touch') {
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
    }
    const up = (e: PointerEvent) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      drag.current = null
      d.release()
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      const st = useStoryStore.getState()
      if (Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy) && e.timeStamp - d.t < 600) {
        if (dx < 0) st.next()
        else st.prev()
        return
      }
      if (!phone) return
      if (dy < -28 && Math.abs(dy) > Math.abs(dx)) st.setDetent(st.detent === 'peek' ? 'default' : 'expanded')
      else if (dy > 28 && Math.abs(dy) > Math.abs(dx)) st.setDetent(st.detent === 'expanded' ? 'default' : 'peek')
    }
    const cancel = () => {
      drag.current?.release()
      drag.current = null
    }
    const winUp = (e: PointerEvent) => {
      const d = drag.current
      if (d && d.id === e.pointerId && !el.contains(e.target as Node)) cancel()
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    window.addEventListener('pointerup', winUp)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('pointerup', winUp)
      window.removeEventListener('blur', cancel)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
    }
    // re-attach when the card element appears (it does not exist while the chapter has no def)
  }, [cardRef, phone, def])

  const observe = useObservedCard(cardRef)
  if (!def) return null
  const beat = def.beats[index]
  if (!beat) return null
  const accent = accentFor(def.key)
  const last = index >= def.beats.length - 1
  const done = last && phase === 'done'
  const copy = def.key !== 'intro' ? MODULE_COPY[def.key as ModuleKey] : null
  const instant = clock.held
  const tIn = reduced ? { duration: 0.12 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }
  const tOut = reduced ? { duration: 0.12 } : { duration: 0.16, ease: [0.4, 0, 1, 1] as const }
  const showBody = !phone || detent !== 'peek'

  return (
    <div
      ref={observe}
      className={`st-card st-card--${phone ? detent : 'default'}`}
      data-detent={phone ? detent : 'default'}
      style={{ ['--acc' as string]: accent }}
    >
      {phone && (
        <button
          type="button"
          className="st-grab"
          aria-label={detent === 'peek' ? 'Show caption' : 'Minimise caption'}
          onClick={() => useStoryStore.getState().setDetent(detent === 'peek' ? 'default' : 'peek')}
        >
          <span />
        </button>
      )}
      <Segments accent={accent} />
      <div className="st-eyebrow-row">
        <span className="st-eyebrow" style={{ color: accent }}>
          {eyebrowFor(def, beat)}
        </span>
        <span className="st-step">
          {index + 1} / {def.beats.length}
        </span>
      </div>
      <div className="st-cap-wrap" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={beat.id}
            className="st-cap"
            initial={instant ? false : reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: tIn }}
            exit={reduced || instant ? { opacity: 0, transition: { duration: instant ? 0 : 0.12 } } : { opacity: 0, y: -8, transition: tOut }}
          >
            <h2 className={`st-title${phone && detent === 'peek' ? ' is-peek' : ''}`}>{beat.title}</h2>
            {showBody && <p className="st-body">{withTerms(beat.body, beat.terms)}</p>}
          </motion.div>
        </AnimatePresence>
      </div>
      {phone && detent === 'expanded' && copy && (
        <div className="st-more">
          <div className="st-more-h">Read more</div>
          <p>{copy.body}</p>
          <ul>
            {copy.keyPoints.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      )}
      {!phone && copy && (
        <details className="st-more st-more--inline" data-no-gesture>
          <summary>
            Read more <IconChevron />
          </summary>
          <p>{copy.body}</p>
          <ul>
            {copy.keyPoints.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </details>
      )}
      <Transport />
      {done && beat.cta === 'begin' && (
        <div className="st-cta-row">
          <button type="button" className="st-btn st-btn--solid st-btn--wide" onClick={() => navigate({ view: 'skills' })}>
            Begin the lesson
          </button>
        </div>
      )}
      {done && beat.cta !== 'begin' && (
        <div className="st-cta-row">
          <button type="button" className="st-btn st-btn--outline" onClick={() => useStoryStore.getState().setMode('explore')}>
            Explore this model
          </button>
          <NextChapterCta view={def.key} />
        </div>
      )}
    </div>
  )
}
