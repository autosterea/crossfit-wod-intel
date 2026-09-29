import { MODULES } from '../../fitnessData'
import type { FitnessView, ModuleKey } from '../../lessonTypes'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { useFitnessStore } from '../../fitnessStore'
import { useIntroExplore } from './exploreStore'
import './intro.css'

/* Intro explore controls (D.1 "Explore (intro)"). Peek (whole rows only):
   the six models as a chip row and the picked model's full title (it always
   fits in two lines, so no sentence is ever cut), both marked .st-ex-peek;
   the map lights the picked tile, and every tile stays tappable. Expanded:
   the picked model's title, full blurb and a button that opens it. Every
   string already exists in MODULES (fitnessData.ts); "Open" is UI copy. */

export default function IntroExplore() {
  const sel = useIntroExplore((s) => s.sel)
  const setSel = useIntroExplore((s) => s.setSel)
  const navigate = useFitnessStore((s) => s.navigate)
  const m = MODULES.find((x) => x.key === sel) ?? MODULES[0]
  return (
    <div className="st-ex">
      <ChipRadio
        label="Model"
        className="st-ex-peek"
        options={MODULES.map((x) => ({ value: x.key as ModuleKey, label: `${x.num} ${x.mobileLabel ?? x.label}` }))}
        value={sel}
        onChange={(v) => setSel(v)}
      />
      <p className="st-ex-peek in-ex-line" style={{ ['--acc' as string]: m.accent }}>
        {m.title}
      </p>
      <div className="st-ex-model" style={{ ['--acc' as string]: m.accent }}>
        <div className="st-ex-model-h">
          <span className="st-ex-model-num" style={{ color: m.accent }}>
            {m.num}
          </span>
          <span className="st-ex-model-t">{m.title}</span>
        </div>
        <p className="st-ex-note">{m.blurb}</p>
      </div>
      <div className="st-ex-row">
        <button type="button" className="st-btn st-btn--solid" onClick={() => navigate({ view: m.key as FitnessView })}>
          <span className="st-btn-l">
            Open {m.num} {m.mobileLabel ?? m.label}
          </span>
        </button>
      </div>
    </div>
  )
}
