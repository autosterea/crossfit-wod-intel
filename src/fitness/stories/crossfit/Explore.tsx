import { CF_HIERARCHY_NOTES, HIERARCHY, HIERARCHY_RULE, PAL } from '../../fitnessData'
import { Readout } from '../../ui'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { aboveOf } from './crossfitMath'
import { useCfExplore } from './exploreStore'

/* 07 CROSSFIT explore controls (STORYBOARD-crossfit.md "Explore"). Peek
   (whole rows only): the five levels as a chip row (.st-ex-peek). Expanded:
   the picked level's deficiency slider, what suffers (the levels above it,
   computed), the level's role and detail, Repair, and the guide's rule and
   its use. Every string is HIERARCHY data, the guide (HIERARCHY_RULE,
   CF_HIERARCHY_NOTES) or UI copy. */

/** The range track drawn as a 6 px stripe inside a 44 px hit area (B.4: sliders get 44 px). */
const TRACK =
  'linear-gradient(transparent calc(50% - 3px), rgba(255,255,255,0.16) calc(50% - 3px), rgba(255,255,255,0.16) calc(50% + 3px), transparent calc(50% + 3px))'

const OPTIONS = HIERARCHY.map((l, i) => ({ value: String(i), label: l.label }))

export default function CrossfitExplore() {
  const level = useCfExplore((s) => s.level)
  const def = useCfExplore((s) => s.def)
  const set = useCfExplore.getState
  const l = HIERARCHY[level]
  const pct = Math.round(def[level] * 100)
  const above = aboveOf(level)
  const anyDef = def.some((d) => d > 0.005)

  return (
    <div className="st-ex">
      <ChipRadio label="Level" className="st-ex-peek" options={OPTIONS} value={String(level)} onChange={(v) => set().setLevel(Number(v))} />

      <div className="wf-row">
        <div className="wf-rl">
          <span className="wf-name">
            <span className="wf-dot" style={{ background: l.color }} />
            Deficiency in {l.label}
          </span>
          <span className="wf-val">{pct}%</span>
        </div>
        <input
          type="range"
          className="wf-range"
          aria-label={`Deficiency in ${l.label}`}
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => set().setDef(level, parseFloat(e.target.value) / 100)}
          style={{ height: 44, background: TRACK, borderRadius: 0 }}
        />
      </div>

      <Readout
        label="Suffers above it"
        value={<span style={{ fontSize: 17 }}>{above.length ? above.join(', ') : 'Nothing above: the apex'}</span>}
        color={pct > 0 && above.length ? PAL.sick : 'var(--st-chalk)'}
        sub={`${l.role}. ${l.detail}`}
      />

      <div className="st-ex-row">
        <button type="button" className="st-btn st-btn--outline" disabled={!anyDef} onClick={() => set().repair()}>
          <span className="st-btn-l">Repair all</span>
        </button>
      </div>

      <p className="st-ex-note">{HIERARCHY_RULE}</p>
      <p className="st-ex-note">{CF_HIERARCHY_NOTES.utility}</p>
    </div>
  )
}
