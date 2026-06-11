import { useFitnessStore } from '../fitnessStore'
import { MODULES, INTRO_TEXT, DEFINITION_TEXT, HUNDRED_WORDS, SOURCES } from '../fitnessData'
import type { FitnessView } from '../lessonTypes'

export default function IntroView() {
  const navigate = useFitnessStore((s) => s.navigate)
  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Hero */}
      <section className="wf-hero p-6 sm:p-10 wf-rise wf-rise-1">
        <div className="relative z-10 max-w-2xl">
          <div className="wf-condensed uppercase tracking-[0.24em] text-[12px] text-[#91C640] mb-3">
            CrossFit Journal, October 2002
          </div>
          <h1 className="wf-display text-3xl sm:text-5xl wf-hero-ink leading-[0.95]">
            What Is <span className="text-[#91C640]">Fitness?</span>
          </h1>
          <p className="wf-hero-dim mt-4 text-[14px] sm:text-[15px] leading-relaxed">{INTRO_TEXT}</p>
          <button
            onClick={() => navigate({ view: 'skills' })}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#019644] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
          >
            Begin the lesson &#8594;
          </button>
        </div>
      </section>

      {/* The definition + 100 words */}
      <div className="mt-6 grid lg:grid-cols-2 gap-5">
        <div className="wf-card p-5 sm:p-6">
          <div className="wf-condensed uppercase tracking-[0.2em] text-[12px] text-[#91C640] mb-2">The definition</div>
          <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">{DEFINITION_TEXT}</p>
        </div>
        <div className="wf-card p-5 sm:p-6">
          <div className="wf-condensed uppercase tracking-[0.2em] text-[12px] text-[#91C640] mb-2">
            World-class fitness in 100 words
          </div>
          <p className="text-[13px] leading-relaxed text-[var(--text-tertiary)]">{HUNDRED_WORDS}</p>
        </div>
      </div>

      {/* Module grid */}
      <div className="mt-8">
        <div className="wf-condensed uppercase tracking-[0.2em] text-[12px] text-[var(--text-tertiary)] mb-4">
          Six interactive models
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <button
              key={m.key}
              onClick={() => navigate({ view: m.key as FitnessView })}
              className="wf-card wf-card-link p-5 text-left"
            >
              <div className="flex items-baseline gap-3">
                <span className="wf-sec-no text-3xl">{m.num}</span>
                <span className="wf-display text-lg text-[var(--text-primary)]" style={{ color: m.accent }}>
                  {m.label}
                </span>
              </div>
              <p className="text-[12.5px] text-[var(--text-tertiary)] mt-2 leading-snug">{m.blurb}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div className="mt-8 wf-card p-5 sm:p-6">
        <div className="wf-condensed uppercase tracking-[0.2em] text-[12px] text-[var(--text-tertiary)] mb-3">
          Sources
        </div>
        <ul className="grid sm:grid-cols-2 gap-2">
          {SOURCES.map((s) => (
            <li key={s.url} className="text-[12px] leading-snug">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-secondary)] hover:text-[#91C640] transition-colors"
              >
                {s.title}
                <span className="text-[var(--text-muted)]"> &#8599;</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
