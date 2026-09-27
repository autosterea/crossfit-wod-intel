import { useMemo } from 'react'
import { PAL, spectrumCss } from '../../fitnessData'
import { Readout } from '../../ui'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { ALL_PROFILES, AGE_MAX, AGE_MIN, LIFELONG, fitnessAt, healthScore } from './healthMath'
import { profileByName, useHealthExplore } from './exploreStore'

/* Health explore controls (DESIGN.md D.7 "Explore"). Peek (whole rows
   only): the seven profile chips (.st-ex-peek); the HUD chip carries the
   volume. Expanded: the trajectory, the "Slice the surface at age" slider
   (the amber slice is also a drag handle on the landscape, and Scrub drags
   move it), the readouts, the independence line and the Lifelong
   comparison. Every string here already exists in the legacy module or in
   fitnessData. */

/** The range track drawn as a 6 px stripe inside a 44 px hit area (B.4: sliders get 44 px). */
const TRACK =
  'linear-gradient(transparent calc(50% - 3px), rgba(255,255,255,0.16) calc(50% - 3px), rgba(255,255,255,0.16) calc(50% + 3px), transparent calc(50% + 3px))'

export default function HealthExplore() {
  const name = useHealthExplore((s) => s.profile)
  const age = useHealthExplore((s) => s.age)
  const showLine = useHealthExplore((s) => s.showLine)
  const compare = useHealthExplore((s) => s.compare)
  const set = useHealthExplore.getState
  const p = profileByName(name)
  // the volume depends on the profile only: never recomputed while the slice is dragged
  const volume = useMemo(() => healthScore(profileByName(name)), [name])
  const fitness = useMemo(() => fitnessAt(profileByName(name), age), [name, age])
  const isLife = p.name === LIFELONG.name

  return (
    <div className="st-ex">
      <ChipRadio
        label="Aging profile"
        className="st-ex-peek"
        options={ALL_PROFILES.map((q) => ({ value: q.name, label: q.name }))}
        value={name}
        onChange={(v) => set().setProfile(v)}
      />

      <p className="st-ex-note" style={{ marginTop: 0, marginBottom: 12 }}>
        {p.trajectory}
      </p>

      <div className="wf-row">
        <div className="wf-rl">
          <span className="wf-name">
            <span className="wf-dot" style={{ background: PAL.well }} />
            Slice the surface at age
          </span>
          <span className="wf-val">{age} yr</span>
        </div>
        <input
          type="range"
          className="wf-range"
          aria-label="Slice the surface at age"
          min={AGE_MIN}
          max={AGE_MAX}
          step={1}
          value={age}
          onChange={(e) => set().setAge(parseFloat(e.target.value))}
          style={{ height: 44, background: TRACK, borderRadius: 0 }}
        />
      </div>

      <Readout
        label="Volume = Health"
        value={
          <>
            {volume}
            <span style={{ fontSize: 15, color: 'var(--st-muted)' }}>/100</span>
          </>
        }
        sub="The translucent solid IS this number: the whole volume under the surface."
        color={spectrumCss(volume / 100)}
      />

      <div className="wf-pct-row" style={{ marginBottom: 12 }}>
        <div className="wf-pct">
          <div className="p" style={{ color: PAL.well }}>
            {fitness}
          </div>
          <div className="n">Fitness at age {age}</div>
        </div>
        <div className="wf-pct">
          <div className="p" style={{ color: PAL.fit }}>
            {p.independentThrough}
          </div>
          <div className="n">Independent through</div>
        </div>
      </div>

      <div className="st-ex-row">
        <button type="button" className={`st-toggle${showLine ? ' is-on' : ''}`} onClick={() => set().setShowLine(!showLine)} aria-pressed={showLine}>
          <span className="st-toggle-knob" />
          Independence line
        </button>
        {!isLife && (
          <button type="button" className={`st-toggle${compare ? ' is-on' : ''}`} onClick={() => set().setCompare(!compare)} aria-pressed={compare}>
            <span className="st-toggle-knob" />
            Compare: {LIFELONG.name}
          </button>
        )}
      </div>

      <p className="st-ex-note">The amber slice is the fitness curve from chapter 04, at one age. Health is every slice you will ever live, stacked.</p>
    </div>
  )
}
