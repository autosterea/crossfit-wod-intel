import { useEffect, useState } from 'react'
import { useStoryStore } from '../store'
import { asset } from '../url'
import { MODULES } from '../../fitnessData'
import type { FitnessView } from '../../lessonTypes'
import type { StoryKey } from '../types'
import { ChapterGlyph } from './ChapterGlyph'

/* Slate (DESIGN.md B.7): the loading layer over the stage while the chunk,
   fonts, SDF fonts and shader compile complete; fades out over 300 ms after
   the first real frames. Also the no-WebGL fallback panel.
   It follows `loaded` only (amendment H.15): a seek or a scrub never brings it
   back. It returns only for a chapter change (`pending`, or a new chapter
   that has not finished loading). */

export function Slate({ view, pending }: { view: StoryKey; pending: boolean }) {
  const loaded = useStoryStore((s) => s.loaded)
  const webgl = useStoryStore((s) => s.webgl)
  const brand = useStoryStore((s) => s.def?.brand)
  const ready = loaded && !pending
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!ready || !webgl) {
      setGone(false)
      return
    }
    const id = window.setTimeout(() => setGone(true), 320)
    return () => window.clearTimeout(id)
  }, [ready, webgl])
  const m = MODULES.find((x) => x.key === view)
  const accent = m?.accent ?? '#91c640'
  if (gone && webgl) return null
  if (brand) {
    // a branded lab story (H.65): its own words and accent, no lesson logo or glyph
    return (
      <div className={`st-slate st-slate--brand${ready && webgl ? ' is-out' : ''}${!webgl ? ' is-fallback' : ''}`} aria-hidden={webgl ? true : undefined}>
        <div className="st-slate-in">
          <div className="st-slate-label">{brand.slate.kicker}</div>
          <div className="st-slate-brandtitle" style={{ color: brand.accent }}>
            {brand.slate.title}
          </div>
          {!webgl ? (
            <p className="st-slate-msg">{brand.fallback}</p>
          ) : (
            <div className="st-slate-bar">
              <span style={{ background: brand.accent }} />
            </div>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className={`st-slate${ready && webgl ? ' is-out' : ''}${!webgl ? ' is-fallback' : ''}`} aria-hidden={webgl ? true : undefined}>
      <div className="st-slate-in">
        <img className="st-slate-logo" src={asset('pa-logo.png')} alt="" />
        {!webgl ? (
          <>
            <div className="st-slate-glyph" style={{ color: accent }}>
              <ChapterGlyph view={view as FitnessView} size={160} />
            </div>
            <p className="st-slate-msg">3D view unavailable on this device. The full lesson text is below.</p>
          </>
        ) : view === 'intro' ? (
          <div className="st-slate-title">
            WHAT IS <span>FITNESS?</span>
          </div>
        ) : (
          <>
            <div className="st-slate-num" style={{ color: accent }}>
              {m?.num}
            </div>
            <div className="st-slate-label">{m?.label}</div>
          </>
        )}
        {webgl && (
          <div className="st-slate-bar">
            <span style={{ background: accent }} />
          </div>
        )}
      </div>
    </div>
  )
}
