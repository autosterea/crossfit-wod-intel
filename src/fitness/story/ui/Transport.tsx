import { useEffect, useRef } from 'react'
import { useStoryStore } from '../store'
import { onFrame } from '../clock'
import { ringProgress } from '../playback'
import { IconNext, IconOrbit, IconPause, IconPlay, IconPrev, IconReplay } from './icons'

/* Transport row (DESIGN.md B.2): prev (44), play / pause with a build-plus-
   hold progress ring (48), next (44), spacer, Explore pill (44 tall). On the
   last beat, once its build ends, Explore turns solid sea-green. Under
   reduced motion the play button becomes "Show build". */

const R = 21
const C = 2 * Math.PI * R

export function Transport() {
  const playing = useStoryStore((s) => s.playing)
  const reduced = useStoryStore((s) => s.reduced)
  const phase = useStoryStore((s) => s.phase)
  const index = useStoryStore((s) => s.index)
  const total = useStoryStore((s) => s.def?.beats.length ?? 1)
  const ring = useRef<SVGCircleElement>(null)
  const lastDone = index >= total - 1 && phase === 'done'

  useEffect(
    () =>
      onFrame(() => {
        const el = ring.current
        if (!el) return
        const p = ringProgress()
        el.style.strokeDashoffset = String(C * (1 - p))
      }),
    [],
  )

  const st = useStoryStore.getState
  return (
    <div className={`st-transport${reduced ? ' is-reduced' : ''}`} data-no-gesture>
      <button type="button" className="st-rb" aria-label="Previous beat" onClick={() => st().prev()}>
        <IconPrev />
      </button>
      {reduced ? (
        <button type="button" className="st-showbuild" onClick={() => st().play()} aria-label="Show build">
          <IconReplay />
          <span>Show build</span>
        </button>
      ) : (
        <button
          type="button"
          className={`st-play${playing ? ' is-playing' : ''}`}
          aria-label={playing ? 'Pause' : phase === 'done' ? 'Replay chapter' : 'Play'}
          onClick={() => st().toggle()}
        >
          <svg className="st-ring" viewBox="0 0 48 48" aria-hidden="true">
            <circle className="st-ring-bg" cx="24" cy="24" r={R} />
            <circle ref={ring} className="st-ring-fg" cx="24" cy="24" r={R} strokeDasharray={C} strokeDashoffset={C} />
          </svg>
          <span className="st-play-ic">{playing ? <IconPause /> : phase === 'done' ? <IconReplay /> : <IconPlay />}</span>
        </button>
      )}
      <button type="button" className="st-rb" aria-label="Next beat" onClick={() => st().next()}>
        <IconNext />
      </button>
      <span className="st-sp" />
      <button
        type="button"
        className={`st-explore-pill${lastDone ? ' is-solid' : ''}`}
        onClick={() => st().setMode('explore')}
        aria-label="Explore this model"
      >
        <IconOrbit />
        <span>Explore</span>
      </button>
    </div>
  )
}
