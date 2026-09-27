import { useEffect, useState } from 'react'
import { useStoryStore } from '../store'
import { asset } from '../url'
import { MODULES } from '../../fitnessData'
import type { FitnessView } from '../../lessonTypes'
import { ChapterGlyph } from './ChapterGlyph'

/* Slate (DESIGN.md B.7): the loading layer over the stage while the chunk,
   fonts, SDF fonts and shader compile complete; fades out over 300 ms after
   the first real frames. Also the no-WebGL fallback panel. */

export function Slate({ view }: { view: FitnessView }) {
  const ready = useStoryStore((s) => s.ready)
  const webgl = useStoryStore((s) => s.webgl)
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
  return (
    <div className={`st-slate${ready && webgl ? ' is-out' : ''}${!webgl ? ' is-fallback' : ''}`} aria-hidden={webgl ? true : undefined}>
      <div className="st-slate-in">
        <img className="st-slate-logo" src={asset('pa-logo.png')} alt="" />
        {!webgl ? (
          <>
            <div className="st-slate-glyph" style={{ color: accent }}>
              <ChapterGlyph view={view} size={160} />
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
