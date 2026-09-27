import { useEffect } from 'react'
import { ARCHETYPES, MODULE_COPY, PAL, SKILLS } from '../../fitnessData'
import { Legend, Readout } from '../../ui'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { CLASS_COLOR, CLASS_LABEL, GENERALIST, fmtVal, floorOf, profileOf, rangeOf, weakestName } from './skillsMath'
import { CUSTOM, NONE, useSkExplore, type SkView } from './exploreStore'
import './skills.css'

/* Skills explore controls (DESIGN.md D.2 "Explore"). Peek (whole rows
   only): the tapped skill's definition when there is one, and the Athlete
   chips. Expanded: Wheel | Grid, the readouts (Weakest skill and Range, for
   A and for B; no mean or breadth anywhere), the Compare chips, the class
   legend and, for Custom, the ten sliders. Every string here already exists
   in fitnessData or the legacy module. */

const A_OPTIONS = [...ARCHETYPES.map((a) => ({ value: a.name, label: a.name })), { value: CUSTOM, label: CUSTOM }]
const B_OPTIONS = [{ value: NONE, label: NONE }, ...ARCHETYPES.map((a) => ({ value: a.name, label: a.name }))]
const CLASS_ITEMS = (['trained', 'practiced', 'both'] as const).map((c) => ({ label: CLASS_LABEL[c], color: CLASS_COLOR[c] }))

function Reads({ who, profile, color, dashed }: { who: string; profile: readonly number[]; color: string; dashed?: boolean }) {
  return (
    <>
      <div className="sk-who" style={{ color }}>
        <i className={dashed ? 'is-dash' : undefined} />
        <span style={{ color: 'var(--st-chalk)' }}>{who}</span>
      </div>
      <div className="sk-reads">
        <Readout
          label="Weakest skill"
          value={
            <>
              <span style={{ color }}>{fmtVal(floorOf(profile))}</span>
              <span className="sk-skill">{weakestName(profile)}</span>
            </>
          }
        />
        <Readout label="Range" value={<span style={{ color }}>{fmtVal(rangeOf(profile))}</span>} />
      </div>
    </>
  )
}

export default function SkillsExplore() {
  const athlete = useSkExplore((s) => s.athlete)
  const compare = useSkExplore((s) => s.compare)
  const custom = useSkExplore((s) => s.custom)
  const view = useSkExplore((s) => s.view)
  const info = useSkExplore((s) => s.info)
  const set = useSkExplore.getState
  const A = athlete === CUSTOM ? custom : profileOf(athlete) ?? GENERALIST.profile
  const B = compare === NONE ? null : profileOf(compare)
  const aColor = athlete === GENERALIST.name ? PAL.yellowGreen : PAL.chalk
  const skill = info === null ? null : SKILLS[info]
  // a choice made elsewhere (a grid cell, a drag into Custom) scrolls its chip into view
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.st-explore [role="radiogroup"][aria-label="Athlete"] [aria-checked="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [athlete])

  return (
    <div className="st-ex">
      {skill && (
        <div className="sk-info st-ex-peek" style={{ ['--c' as string]: CLASS_COLOR[skill.classification] }} aria-live="polite">
          <div className="sk-info-name">
            <i />
            {skill.name}
            <small>{CLASS_LABEL[skill.classification]}</small>
          </div>
          <p>{skill.definition}</p>
          <button type="button" className="sk-info-x" aria-label="Close" onClick={() => set().setInfo(null)}>
            {'×'}
          </button>
        </div>
      )}
      <ChipRadio label="Athlete" className="st-ex-peek" options={A_OPTIONS} value={athlete} onChange={(v) => set().setAthlete(v)} />

      <div className="sk-view" role="group" aria-label="View">
        {(['wheel', 'grid'] as SkView[]).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => set().setView(v)}>
            {v === 'wheel' ? 'Wheel' : 'Grid'}
          </button>
        ))}
      </div>

      <Reads who={athlete} profile={A} color={aColor} />
      {B && <Reads who={compare} profile={B} color={PAL.chalk} dashed />}

      <div className="sk-head">Compare</div>
      <ChipRadio label="Compare" options={B_OPTIONS} value={compare} onChange={(v) => set().setCompare(v)} />

      <Legend items={CLASS_ITEMS} />

      {athlete === CUSTOM && (
        <div>
          <div className="sk-head">Custom</div>
          {SKILLS.map((s, i) => (
            <label key={s.name} className="sk-sl" style={{ ['--c' as string]: CLASS_COLOR[s.classification] }}>
              <div className="sk-sl-row">
                <span>
                  <i style={{ background: CLASS_COLOR[s.classification] }} />
                  {s.name}
                </span>
                <b>{custom[i].toFixed(1)}</b>
              </div>
              <input
                type="range"
                className="sk-range"
                min={0}
                max={10}
                step={0.1}
                value={custom[i]}
                aria-label={s.name}
                onChange={(e) => set().setSkill(i, parseFloat(e.target.value), A)}
              />
            </label>
          ))}
        </div>
      )}

      <p className="st-ex-note">{MODULE_COPY.skills.keyPoints[3]}</p>
      <p className="st-ex-note">Drag a vertex to reshape it; tap a skill for its definition.</p>
    </div>
  )
}
