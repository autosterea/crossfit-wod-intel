import { DEFINITION_TEXT, HUNDRED_WORDS, INTRO_TEXT, SOURCES } from '../../fitnessData'
import { MAP_MODULES as MODULES } from './models'
import type { FitnessView } from '../../lessonTypes'
import { useFitnessStore } from '../../fitnessStore'
import { useStoryStore } from '../../story/store'
import { withTerms } from '../../story/ui/CaptionCard'
import { ChapterGlyph } from '../../story/ui/ChapterGlyph'
import './intro.css'

/* =========================================================================
   The hub below the intro stage (DESIGN.md B.6 "Intro Notes"): the essay's
   framing (INTRO_TEXT), the story transcript (tap a beat to seek the stage
   to it), the definition, World-class fitness in 100 words, the six chapter
   cards and every source. Theme-aware page chrome; the content is the
   legacy IntroView's, restyled.
   ========================================================================= */

export default function IntroNotes({ stageRef }: { stageRef: React.RefObject<HTMLDivElement | null> }) {
  const def = useStoryStore((s) => s.def)
  const reduced = useStoryStore((s) => s.reduced)
  const navigate = useFitnessStore((s) => s.navigate)
  const beats = def?.key === 'intro' ? def.beats : []
  return (
    <section className="st-notes in-notes" aria-label="Lesson overview">
      <div className="st-notes-eyebrow in-accent">CrossFit Journal, October 2002</div>
      <h1 className="st-notes-title">
        What Is <span className="in-accent">Fitness?</span>
      </h1>
      <p className="st-notes-body">{INTRO_TEXT}</p>

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

      <div className="in-cards">
        <div className="wf-card in-card">
          <div className="st-notes-h in-accent">The definition</div>
          <p className="in-card-p">{DEFINITION_TEXT}</p>
        </div>
        <div className="wf-card in-card">
          <div className="st-notes-h in-accent">World-class fitness in 100 words</div>
          <p className="in-card-p is-small">{HUNDRED_WORDS}</p>
        </div>
      </div>

      <div className="st-notes-block">
        <div className="st-notes-h">Six interactive models</div>
        <div className="in-models">
          {MODULES.map((m) => (
            <button
              key={m.key}
              type="button"
              className="wf-card wf-card-link in-model"
              style={{ ['--acc' as string]: m.accent }}
              onClick={() => navigate({ view: m.key as FitnessView })}
            >
              <span className="in-model-glyph" style={{ color: m.accent }}>
                <ChapterGlyph view={m.key as FitnessView} size={44} />
              </span>
              <span className="in-model-text">
                <span className="in-model-h">
                  <span className="in-model-num" style={{ color: m.accent }}>
                    {m.num}
                  </span>
                  <span className="in-model-label">{m.label}</span>
                </span>
                <span className="in-model-blurb">{m.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="st-notes-block st-notes-sources">
        <div className="st-notes-h">Sources</div>
        <ul className="in-sources">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
                <span className="in-ext"> &#8599;</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
