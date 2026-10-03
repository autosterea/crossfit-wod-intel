import { MODAL_DOMAINS, POWER_CURVES } from '../../fitnessData'
import { Legend, Readout } from '../../ui'
import { useDefExplore } from './exploreStore'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { CURVE_BY_KEY, GENERALIST, scoreHue, scoreOf, scoreWord } from './definitionMath'
import { useSfx } from '../../story/audio/useSfx' // [audio]

/* Definition explore controls (DESIGN.md D.5 "Explore"). Peek (whole rows
   only): the seven athlete chips, marked .st-ex-peek; the HUD chip carries
   the score. Expanded: the domains toggle, the generalist ghost, the
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
  // [audio] explore sounds (DESIGN.md I.7): the damped replay fills or spills; the domains toggle orbits to the fan
  const sfx = useSfx() // [audio]

  return (
    <div className="st-ex">
      <ChipRadio
        label="Athlete"
        className="st-ex-peek"
        options={POWER_CURVES.map((c) => ({ value: c.name, label: c.name }))}
        value={athlete}
        onChange={(v) => {
          set().setAthlete(v)
          sfx.play(v === GENERALIST.name ? 'pour.fill' : 'pour.drain', { gain: -6, dur: 1.2 }) // [audio]
        }}
      />

      <Readout
        label="Fitness, area under the curve"
        value={
          <>
            {score}
            <span style={{ fontSize: 15, color: 'var(--st-muted)' }}>/100</span>{' '}
            <span style={{ fontSize: 15, color: scoreHue(score) }}>{scoreWord(score)}</span>
          </>
        }
        sub="Power averaged across all modal domains."
      />

      <div className="st-ex-row">
        <button type="button" className={`st-toggle${showDomains ? ' is-on' : ''}`} onClick={() => {
            set().setShowDomains(!showDomains)
            sfx.play('air.reveal', { gain: -8, dur: 0.9 }) // [audio]
          }} aria-pressed={showDomains}>
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
