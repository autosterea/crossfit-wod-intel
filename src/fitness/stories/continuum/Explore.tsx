import { useSyncExternalStore } from 'react'
import { BIOMARKERS, CONTINUUM_EXAMPLES, PAL } from '../../fitnessData'
import { Readout, Slider } from '../../ui'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { betterText, meanOf, scoreOf, spectrumHex, stateWord, tickText, valueText } from './continuumMath'
import { PROFILE_OPTIONS, useContExplore } from './exploreStore'
import { selectSpoke, spokeVersion, subscribeSpoke } from './keySel'

/* Continuum explore controls (DESIGN.md D.6 "Explore"). Peek (whole rows
   only): the profile chips, marked .st-ex-peek. Expanded: the overall state
   readout and score toward fitness, the selected marker's scale, the ten
   marker sliders (existing), the module's note and the L1 example line.
   Every string here already exists in the module or in fitnessData. */

const PROFILE_CHIPS = PROFILE_OPTIONS.map((p) => ({ value: p, label: p }))

export default function ContinuumExplore() {
  const positions = useContExplore((s) => s.positions)
  const profile = useContExplore((s) => s.profile)
  const set = useContExplore.getState
  const sel = useSyncExternalStore(subscribeSpoke, spokeVersion)
  const mean = meanOf(positions)
  const word = stateWord(mean)
  const titleCase = word.word[0] + word.word.slice(1).toLowerCase()

  return (
    <div className="st-ex">
      <ChipRadio label="Profile" className="st-ex-peek" options={PROFILE_CHIPS} value={profile} onChange={(v) => set().setProfile(v)} />

      <Readout
        label="Overall state"
        value={titleCase}
        color={word.css}
        sub={
          <>
            <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: spectrumHex(mean) }}>{scoreOf(mean)}</strong> / 100 toward fitness
          </>
        }
      />

      {sel >= 0 && (
        <div className="st-ex-note" style={{ color: 'var(--st-body)' }}>
          <strong style={{ color: 'var(--st-chalk)' }}>{BIOMARKERS[sel].name}</strong> {valueText(sel, positions[sel])}.{' '}
          <span style={{ color: PAL.sick }}>{tickText(sel, 0)}</span> / <span style={{ color: PAL.well }}>{tickText(sel, 1)}</span> /{' '}
          <span style={{ color: PAL.fit }}>{tickText(sel, 2)}</span>.{' '}
          <span style={{ color: PAL.yellowGreen, fontWeight: 600 }}>{betterText(sel)}</span>
        </div>
      )}

      {BIOMARKERS.map((m, i) => (
        <div key={m.name} onPointerDown={() => sel !== i && selectSpoke(i)}>
          <Slider
            label={m.name}
            value={Math.round(positions[i] * 100)}
            display={valueText(i, positions[i])}
            min={0}
            max={100}
            step={1}
            dotColor={spectrumHex(positions[i])}
            onChange={(v) => set().setPos(i, v / 100)}
          />
        </div>
      ))}

      <p className="st-ex-note">Center is sickness, the rim is fitness. Each marker rides its own spoke. Drag any marker outward and the profile becomes Custom.</p>
      <p className="st-ex-note">
        <span style={{ color: PAL.yellowGreen, fontWeight: 600 }}>L1 example.</span> {CONTINUUM_EXAMPLES[0]}
      </p>
    </div>
  )
}

