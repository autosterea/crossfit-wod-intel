import { PAL } from '../../fitnessData'
import { Readout } from '../../ui'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { SPEEDS, formAt, holds, marginWord, statusLine, useTqExplore, type SpeedIx } from './exploreStore'

/* =========================================================================
   08 TECHNIQUE explore controls (STORYBOARD-technique section 5): the
   threshold trainer. Peek (whole rows only): the speed chips (.st-ex-peek).
   Expanded: Train at this speed (solid when it can train: only at the
   margin) and Reset training, the Form and Margin readouts, the status line
   for the state (each restates p. 44) and the graph toggle (Figure 1 as an
   inset whose arrow swings with the form, p. 41). UI copy and the article's
   numbers only.
   ========================================================================= */

const OPTIONS = SPEEDS.map((s, i) => ({ value: String(i), label: s.toLocaleString('en-US') }))

export default function TechniqueExplore() {
  const speed = useTqExplore((s) => s.speed)
  const margin = useTqExplore((s) => s.margin)
  const trained = useTqExplore((s) => s.trained)
  const graph = useTqExplore((s) => s.graph)
  const set = useTqExplore.getState
  const canTrain = speed === margin && margin <= 2
  const form = formAt(speed, margin)
  const ok = holds(speed, margin)

  return (
    <div className="st-ex">
      <ChipRadio
        label="Speed, ft-lb per minute"
        className="st-ex-peek"
        options={OPTIONS}
        value={String(speed)}
        onChange={(v) => set().setSpeed(Number(v) as SpeedIx)}
      />

      <div className="st-ex-row">
        <button type="button" className={`st-btn ${canTrain ? 'st-btn--solid' : 'st-btn--outline'}`} disabled={!canTrain} onClick={() => set().train()}>
          <span className="st-btn-l">Train at this speed</span>
        </button>
        <button type="button" className="st-btn st-btn--outline" disabled={margin === 1 && !trained} onClick={() => set().reset()}>
          <span className="st-btn-l">Reset training</span>
        </button>
      </div>

      <div className="st-ex-row" style={{ alignItems: 'stretch' }}>
        <Readout label="Form" value={<span style={{ fontSize: 20 }}>{form}</span>} color={ok ? PAL.yellowGreen : PAL.sick} />
        <Readout label="Margin" value={<span style={{ fontSize: 20 }}>{marginWord(margin)}</span>} color="var(--st-chalk)" />
      </div>

      <p className="st-ex-note" aria-live="polite">
        {statusLine({ speed, margin, trained })}
      </p>

      <div className="st-ex-row">
        <button type="button" className={`st-toggle${graph ? ' is-on' : ''}`} onClick={() => set().setGraph(!graph)} aria-pressed={graph}>
          <span className="st-toggle-knob" />
          Show the graph
        </button>
      </div>
    </div>
  )
}
