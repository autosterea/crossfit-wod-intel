import { MODULE_COPY, moduleByKey } from '../../fitnessData'
import type { ModuleKey } from '../../lessonTypes'
import { KeyPoints, CrossLinks, SourceList } from '../../ui'
import { useStoryStore } from '../store'
import { withTerms } from './CaptionCard'

/* Notes below the stage (DESIGN.md B.6), theme-aware, normal page scroll:
   chapter copy, key points, the story transcript (tap a beat to seek the
   stage to it), keep exploring, sources. */

export function Notes({ moduleKey, stageRef }: { moduleKey: ModuleKey; stageRef: React.RefObject<HTMLDivElement | null> }) {
  const def = useStoryStore((s) => s.def)
  const reduced = useStoryStore((s) => s.reduced)
  const meta = moduleByKey(moduleKey)
  const copy = MODULE_COPY[moduleKey]
  const beats = def?.key === moduleKey ? def.beats : []
  return (
    <section className="st-notes" aria-label="Lesson notes">
      <div className="st-notes-eyebrow" style={{ color: meta.accent }}>
        {meta.num} / {copy.eyebrow}
      </div>
      <h1 className="st-notes-title">{meta.title}</h1>
      <p className="st-notes-body">{copy.body}</p>

      <div className="st-notes-block">
        <div className="st-notes-h">Key points</div>
        <KeyPoints points={copy.keyPoints} accent={meta.accent} />
      </div>

      {beats.length > 0 && (
        <details className="st-transcript" open={reduced}>
          <summary>
            <span className="st-notes-h">Story transcript</span>
            <span className="st-transcript-n">{beats.length} beats</span>
          </summary>
          <ol>
            {beats.map((b, i) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => {
                    stageRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
                    useStoryStore.getState().seek(i, 1, { hold: true })
                  }}
                >
                  <span className="st-tr-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="st-tr-text">
                    <span className="st-tr-title">{b.title}</span>
                    <span className="st-tr-body">{withTerms(b.body, b.terms)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="st-notes-block">
        <div className="st-notes-h">Keep exploring</div>
        <CrossLinks moduleKey={moduleKey} />
      </div>
      <div className="st-notes-block st-notes-sources">
        <SourceList moduleKey={moduleKey} />
      </div>
    </section>
  )
}
