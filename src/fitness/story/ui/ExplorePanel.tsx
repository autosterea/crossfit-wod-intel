import { useState } from 'react'
import { useStoryStore } from '../store'
import { cameraBus } from '../camera/CameraDirector'
import { IconBack, IconReset } from './icons'
import { accentFor } from './CaptionCard'
import { useObservedCard } from '../camera/focusRect'

/* Explore panel (DESIGN.md B.4): the caption card morphs in place into the
   controls sheet (phone: peek / expanded; desktop: the left column). It
   hosts the chapter's Explore component plus the engine's Back to story,
   Reset view and the optional Scrub | Orbit toggle. */

export function ExplorePanel({ cardRef, shell }: { cardRef: React.RefObject<HTMLDivElement | null>; shell: string }) {
  const def = useStoryStore((s) => s.def)
  const scrub = useStoryStore((s) => s.scrub)
  const [open, setOpen] = useState(false)
  const phone = shell === 'phone' || shell === 'tablet'
  const observe = useObservedCard(cardRef)
  if (!def) return null
  const Explore = def.Explore
  const accent = accentFor(def.key)
  return (
    <div
      ref={observe}
      className={`st-card st-explore${phone ? (open ? ' is-open' : ' is-peek') : ''}`}
      style={{ ['--acc' as string]: accent }}
      data-no-gesture
    >
      {phone && (
        <button type="button" className="st-grab" aria-label={open ? 'Collapse controls' : 'Expand controls'} onClick={() => setOpen(!open)}>
          <span />
        </button>
      )}
      <div className="st-explore-head">
        <button type="button" className="st-chip st-chip--back" onClick={() => useStoryStore.getState().setMode('story')}>
          <IconBack />
          <span>Back to story</span>
        </button>
        <button type="button" className="st-chip st-chip--reset" aria-label="Reset view" title="Reset view" onClick={() => cameraBus.resetView()}>
          <IconReset />
          <span className="st-chip-label">Reset view</span>
        </button>
        {def.explore.scrubToggle && (
          <div className="st-seg-toggle" role="group" aria-label="Drag mode">
            <button type="button" className={scrub ? 'is-on' : ''} onClick={() => useStoryStore.setState({ scrub: true })}>
              Scrub
            </button>
            <button type="button" className={!scrub ? 'is-on' : ''} onClick={() => useStoryStore.setState({ scrub: false })}>
              Orbit
            </button>
          </div>
        )}
      </div>
      <div className="st-explore-body">
        <Explore />
      </div>
    </div>
  )
}
