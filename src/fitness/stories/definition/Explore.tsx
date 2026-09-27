import { MODAL_DOMAINS, POWER_CURVES } from '../../fitnessData'
import { Legend, Readout } from '../../ui'
import { useDefExplore } from './exploreStore'
import { CURVE_BY_KEY, GENERALIST, scoreColor, scoreOf, scoreWord } from './definitionMath'

/* Definition explore controls (DESIGN.md D.5 "Explore"). Peek: the seven
   athlete chips. Expanded: the domains toggle, the generalist ghost, the
   area readout and the model notes. Every string here already exists in
   the module or in fitnessData. */

export default function DefinitionExplore() {
  const athlete = useDefExplore((s) => s.athlete)
  const showDomains = useDefExplore((s) => s.showDomains)
  const ghost = useDefExplore((s) => s.ghost)
  const set = useDefExplore.getState
  const samples = CURVE_BY_KEY[athlete]?.samples ?? GENERALIST.samples
  const score = scoreOf(samples)
  const isG = athlete === GENERALIST.name

  return (
    <div className="st-ex">
      <div className="st-chiprow" role="radiogroup" aria-label="Athlete">
        {POWER_CURVES.map((c) => (
          <button
            key={c.name}
            type="button"
            role="radio"
            aria-checked={c.name === athlete}
            className={`st-chip st-chip--pick${c.name === athlete ? ' is-on' : ''}`}
            onClick={() => set().setAthlete(c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <Readout
        label="Fitness, area under the curve"
        value={
          <>
            {score}
            <span style={{ fontSize: 15, color: 'var(--st-muted)' }}>/100</span>{' '}
            <span style={{ fontSize: 15, color: scoreColor(score) }}>{scoreWord(score)}</span>
          </>
        }
        sub="Power averaged across all modal domains."
      />

      <div className="st-ex-row">
        <button type="button" className={`st-toggle${showDomains ? ' is-on' : ''}`} onClick={() => set().setShowDomains(!showDomains)} aria-pressed={showDomains}>
          <span className="st-toggle-knob" />
          {showDomains ? 'Hide the 5 modal domains' : 'Show the 5 modal domains'}
        </button>
        {!isG && (
          <button type="button" className={`st-toggle${ghost ? ' is-on' : ''}`} onClick={() => set().setGhost(!ghost)} aria-pressed={ghost}>
            <span className="st-toggle-knob" />
            Generalist, for scale
          </button>
        )}
      </div>

      {showDomains && <Legend items={MODAL_DOMAINS.map((d) => ({ label: d.name, color: d.color }))} />}

      <p className="st-ex-note">Power falls as duration grows. A specialist wins one zone; the generalist wins the area.</p>
      <p className="st-ex-note">P(t) = CP + W prime / t is the sustained tail.</p>
    </div>
  )
}
