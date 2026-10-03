import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStoryStore } from '../store'
import { clock } from '../clock'
import { Segments } from './Segments'
import { Transport } from './Transport'
import { DEFINITION_TEXT, INTRO_TEXT, MODULES, MODULE_COPY, PAL, moduleByKey } from '../../fitnessData'
import { useFitnessStore } from '../../fitnessStore'
import type { Beat, StoryBrand, StoryDef, StoryKey } from '../types'
import type { FitnessView, ModuleKey } from '../../lessonTypes'
import { IconChevron } from './icons'
import { useObservedCard } from '../camera/focusRect'
import { pb } from '../playback'
import { readDone } from './progress'
import { SoundChip } from '../audio/SoundChip' // [audio]

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
  if (def.brand) return def.brand.eyebrow
  if (def.key === 'intro') return 'Overview'
  const m = moduleByKey(def.key as ModuleKey)
  return `${m.num} ${m.label}`
}

export function accentFor(view: StoryKey, brand?: StoryBrand): string {
  if (brand) return brand.accent
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
    const c = terms[key]
    parts.push(
      <span key={k++} className="st-term" style={{ color: c.startsWith('#') ? c : PAL[c as keyof typeof PAL] }}>
        {key}
      </span>,
    )
    rest = rest.slice(best + key.length)
  }
  return parts
}

/**
 * The Read more block of the expanded detent (B.2) and the desktop disclosure:
 * a chapter's MODULE_COPY body and key points. The intro has no MODULE_COPY;
 * its Read more is the essay's framing (INTRO_TEXT) and the definition
 * (DEFINITION_TEXT), the same copy its Notes hub opens with.
 */
export function readMoreFor(view: StoryKey, brand?: StoryBrand): { paras: readonly string[]; points: readonly string[] } {
  if (brand) return brand.readMore
  if (view === 'intro') return { paras: [INTRO_TEXT, DEFINITION_TEXT], points: [] }
  const c = MODULE_COPY[view as ModuleKey]
  return { paras: [c.body], points: c.keyPoints }
}

function ReadMoreBody({ view, brand }: { view: StoryKey; brand?: StoryBrand }) {
  const { paras, points } = readMoreFor(view, brand)
  return (
    <>
      {paras.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {points.length > 0 && (
        <ul>
          {points.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * The end of the lesson (fix round 1): the last chapter's finished beat has
 * no next chapter, so its solid CTA returns to the overview, landing on the
 * intro's six-tile map (the hub, B.6), held. The eyebrow row carries a
 * one-line completion state (LessonEndEyebrow; UI copy, no claim).
 */
function LessonEndCtas() {
  const navigate = useFitnessStore((s) => s.navigate)
  return (
    <div className="st-cta-row">
      <button type="button" className="st-btn st-btn--outline" onClick={() => useStoryStore.getState().setMode('explore')}>
        Explore this model
      </button>
      <button type="button" className="st-btn st-btn--solid" onClick={() => navigate({ view: ORDER[0] }, { query: `?beat=${INTRO_MAP_BEAT}&t=1` })}>
        <span className="st-btn-l">Back to overview</span>
      </button>
    </div>
  )
}

/**
 * The finished lesson's eyebrow: "Lesson complete" once this viewer has
 * finished all six chapters (the per-viewer done store, B.2; the current
 * chapter counts, it is finished now), otherwise "End of the lesson".
 */
function LessonEndEyebrow({ view }: { view: FitnessView }) {
  const done = new Set<string>(readDone())
  done.add(view)
  const all = MODULES.every((m) => done.has(m.key))
  return (
    <span className="st-eyebrow st-eyebrow--end">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {all ? 'Lesson complete' : 'End of the lesson'}
    </span>
  )
}

/** The intro's six-tile map (D.1 I4), where "Back to overview" lands. */
const INTRO_MAP_BEAT = 4

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

/** A branded host's in-app next step (H.65): a real link, taken over by `go` on a plain click. */
function BrandNext({ next, outline = false }: { next: NonNullable<StoryBrand['endNext']>; outline?: boolean }) {
  return (
    <a
      className={`st-btn ${outline ? 'st-btn--outline' : 'st-btn--solid'}`}
      href={next.href}
      onClick={(e) => {
        if (!next.go || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        next.go()
      }}
    >
      <span className="st-btn-l">{next.label}</span>
    </a>
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
  // On a real touch screen only the TOP BAND of the card (the grab row, and
  // the scrubber band over the eyebrow row, see Segments) is touch-action
  // none, so a vertical finger drag there reaches this logic; the card body
  // stays pan-y so the page still scrolls to the Notes (H.47).
  const drag = useRef<{ x: number; y: number; t: number; id: number; release: () => void } | null>(null)
  /** a drag that started on the grab handle changed the detent: eat its click */
  const eatClick = useRef(false)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const down = (e: PointerEvent) => {
      const target = e.target as Element
      eatClick.current = false
      if (target.closest('button, a, input, [data-no-gesture], .st-more') && !target.closest('.st-grab')) return
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
      if (Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx)) {
        st.nudgeDetent(dy < 0 ? 'up' : 'down')
        eatClick.current = true
      }
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

  // a chapter change (or leaving the lesson) never keeps a reading hold
  const defKey = def?.key
  useEffect(() => {
    pb.reading = false
    return () => {
      pb.reading = false
    }
  }, [defKey])

  const observe = useObservedCard(cardRef)
  if (!def) return null
  const beat = def.beats[index]
  if (!beat) return null
  const brand = def.brand
  const accent = accentFor(def.key, brand)
  const last = index >= def.beats.length - 1
  const done = last && phase === 'done'
  const lessonEnd = done && !brand && (ORDER as readonly string[]).indexOf(def.key) === ORDER.length - 1
  // H.77: a branded host may drop Explore from the end row; with no button left there is no row
  const endExplore = !brand || brand.endExplore !== false
  const endRow = endExplore || !!brand?.endCta || !!brand?.endNext
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
          aria-label={detent === 'peek' ? 'Show caption' : detent === 'expanded' ? 'Show less' : 'Minimise caption'}
          onClick={() => {
            if (eatClick.current) {
              eatClick.current = false
              return
            }
            useStoryStore.getState().setDetent(detent === 'default' ? 'peek' : 'default')
          }}
        >
          <span />
        </button>
      )}
      <Segments accent={accent} />
      <div className="st-eyebrow-row">
        {lessonEnd ? (
          <LessonEndEyebrow view={def.key as FitnessView} />
        ) : (
          <span className="st-eyebrow" style={{ color: accent }}>
            {eyebrowFor(def, beat)}
          </span>
        )}
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
            {showBody && (
              <p className="st-body">
                {withTerms(beat.body, beat.terms)}
                {phone && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="st-more-link"
                      aria-expanded={detent === 'expanded'}
                      onClick={() => useStoryStore.getState().setDetent(detent === 'expanded' ? 'default' : 'expanded')}
                    >
                      {detent === 'expanded' ? 'Less' : 'Read more'}
                    </button>
                  </>
                )}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {phone && detent === 'expanded' && (
        <div className="st-more">
          <div className="st-more-h">Read more</div>
          <ReadMoreBody view={def.key} brand={brand} />
        </div>
      )}
      {!phone && (
        // L14: an open disclosure holds the story (playback readingHold); keyed by
        // chapter so a new chapter starts closed and playing
        <details
          key={def.key}
          className="st-more st-more--inline"
          data-no-gesture
          onToggle={(e) => {
            pb.reading = (e.currentTarget as HTMLDetailsElement).open
          }}
        >
          <summary>
            Read more <IconChevron />
          </summary>
          <ReadMoreBody view={def.key} brand={brand} />
        </details>
      )}
      <Transport />
      <SoundChip shell={shell} /> {/* [audio] I.5.1: on the card's top edge (a row here in landscape) */}
      {done && beat.cta === 'begin' && (
        // [Explore][Begin the lesson]: on a phone the finished map's only other
        // way into explore is the transport pill, which hides on the finished
        // last beat (H.27), so the row carries it (integration, H.53).
        <div className="st-cta-row">
          <button type="button" className="st-btn st-btn--outline" onClick={() => useStoryStore.getState().setMode('explore')}>
            Explore
          </button>
          <button type="button" className="st-btn st-btn--solid" onClick={() => navigate({ view: 'skills' })}>
            <span className="st-btn-l">Begin the lesson</span>
          </button>
        </div>
      )}
      {done && beat.cta !== 'begin' && !lessonEnd && endRow && (
        <div className="st-cta-row">
          {endExplore && (
            <button type="button" className="st-btn st-btn--outline" onClick={() => useStoryStore.getState().setMode('explore')}>
              Explore this model
            </button>
          )}
          {brand ? (
            <>
              {brand.endCta &&
                (brand.endCta.go ? (
                  <BrandNext next={brand.endCta} outline={!!brand.endNext} />
                ) : (
                  <a className={`st-btn ${brand.endNext ? 'st-btn--outline' : 'st-btn--solid'}`} href={brand.endCta.href} target="_blank" rel="noopener noreferrer">
                    <span className="st-btn-l">{brand.endCta.label}</span>
                  </a>
                ))}
              {brand.endNext && <BrandNext next={brand.endNext} />}
            </>
          ) : (
            <NextChapterCta view={def.key as FitnessView} />
          )}
        </div>
      )}
      {lessonEnd && <LessonEndCtas />}
    </div>
  )
}
