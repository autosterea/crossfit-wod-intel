import { useEffect, useRef } from 'react'
import { ENERGY_BENCHMARKS, ENERGY_SYSTEMS } from '../../fitnessData'
import { fmtDuration } from '../../lessonMath'
import { Readout } from '../../ui'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { useStoryStore } from '../../story/store'
import { usePwExplore } from './exploreStore'
import { COLOR, HANDOVER, NAME, PEAK_ORDER_TEXT, SLIDER_MAX, SLIDER_MIN, T_MAX, contribAtT, dominantOf, sliderToT, tToSlider } from './pathwaysMath'

/* =========================================================================
   Pathways explore controls (DESIGN.md D.4 "Explore"). Peek (whole rows
   only, .st-ex-peek): the log duration slider, whose track carries the three
   duration bands. Expanded: the benchmark chips (Marathon included),
   Stacked | Lanes, Power | Share, the current effort and dominant engine,
   the three shares, the engines' rates and tanks, and the peak order note.
   Every string here already exists in the module or in fitnessData.
   ========================================================================= */

const KEYS = ['phosphagen', 'glycolytic', 'oxidative'] as const
const P = (u: number) => `${(u * 100).toFixed(1)}%`
/** The slider track: the same colours as the strip under the axis, cross-fading across the two handover zones. */
const TRACK = `linear-gradient(90deg, ${COLOR.phosphagen} 0 ${P(HANDOVER[0][0])}, ${COLOR.glycolytic} ${P(HANDOVER[0][1])} ${P(HANDOVER[1][0])}, ${COLOR.oxidative} ${P(HANDOVER[1][1])} 100%)`

/* A 44 px range input (B.4: sliders get 44 px hit areas); local until the
   kit restyles ui.tsx Slider (engine request in the chapter report). */
const SLIDER_CSS = `
.pw-range{-webkit-appearance:none;appearance:none;display:block;width:100%;height:44px;margin:0;background:transparent;cursor:pointer;touch-action:pan-y}
.pw-range:focus-visible{outline:2px solid #91c640;outline-offset:2px;border-radius:12px}
.pw-range::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:var(--pw-track);opacity:.9}
.pw-range::-moz-range-track{height:6px;border-radius:999px;background:var(--pw-track);opacity:.9}
.pw-range::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;margin-top:-10px;border-radius:50%;background:var(--pw-dot);border:3px solid #0b120e;box-shadow:0 0 0 4px rgba(238,243,246,.14),0 0 16px var(--pw-dot)}
.pw-range::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--pw-dot);border:3px solid #0b120e;box-shadow:0 0 0 4px rgba(238,243,246,.14)}
.pw-slider-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:2px 0 0}
.pw-slider-name{font-family:var(--st-cond);font-weight:600;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--st-muted)}
.pw-slider-val{font-family:var(--st-mono);font-weight:600;font-size:15px;color:var(--st-chalk)}
.pw-eng{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:baseline;margin:6px 0 10px}
.pw-eng-n{font-family:var(--st-cond);font-weight:600;font-size:13px;letter-spacing:.06em;text-transform:uppercase}
.pw-eng-d{font-size:13px;color:var(--st-body)}
`

/** The benchmark chips: a radiogroup that may have nothing checked (after a free scrub). */
function BenchChips({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const opts = ENERGY_BENCHMARKS
  const idx = opts.findIndex((o) => o.name === value)
  const tab = idx >= 0 ? idx : 0
  const move = (to: number) => {
    const n = opts.length
    const k = ((to % n) + n) % n
    onChange(opts[k].name)
    const el = refs.current[k]
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    let to = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (idx >= 0 ? idx : -1) + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (idx >= 0 ? idx : 1) - 1
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = opts.length - 1
    else return
    e.preventDefault()
    e.stopPropagation()
    move(to)
  }
  return (
    <div className="st-chiprow" role="radiogroup" aria-label="Example efforts" onKeyDown={onKeyDown}>
      {opts.map((o, i) => (
        <button
          key={o.name}
          ref={(r) => void (refs.current[i] = r)}
          type="button"
          role="radio"
          aria-checked={i === idx}
          tabIndex={i === tab ? 0 : -1}
          className={`st-chip st-chip--pick${i === idx ? ' is-on' : ''}`}
          onClick={() => onChange(o.name)}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[o.dominant], flex: 'none' }} />
          {o.name}
        </button>
      ))}
    </div>
  )
}

export default function PathwaysExplore() {
  // a front-on chart is read by scrubbing: explore opens in Scrub, not Orbit (review r1)
  useEffect(() => {
    useStoryStore.setState({ scrub: true })
  }, [])
  const t = usePwExplore((s) => s.t)
  const bench = usePwExplore((s) => s.bench)
  const lanes = usePwExplore((s) => s.lanes)
  const share = usePwExplore((s) => s.share)
  const set = usePwExplore.getState
  const b = ENERGY_BENCHMARKS.find((x) => x.name === bench) ?? null
  const beyond = !!b && b.seconds > T_MAX
  const c = contribAtT(t)
  const dom = dominantOf(c)
  const shown = beyond && b ? b.seconds : t

  return (
    <div className="st-ex">
      <style>{SLIDER_CSS}</style>
      <div className="st-ex-peek">
        <div className="pw-slider-head">
          <span className="pw-slider-name">Effort duration</span>
          <span className="pw-slider-val">
            {fmtDuration(shown)} <span style={{ color: COLOR[dom], fontFamily: 'var(--st-cond)', fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{NAME[dom]}</span>
          </span>
        </div>
        <input
          type="range"
          className="pw-range"
          aria-label="Effort duration"
          aria-valuetext={`${fmtDuration(shown)}, ${NAME[dom]}`}
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={1}
          value={Math.round(tToSlider(t))}
          style={{ ['--pw-track' as string]: TRACK, ['--pw-dot' as string]: COLOR[dom] }}
          onChange={(e) => set().setT(sliderToT(parseFloat(e.target.value)))}
        />
      </div>

      <BenchChips value={bench} onChange={(v) => set().setBench(v)} />

      <ChipRadio
        label="Layout"
        options={[
          { value: 'stacked', label: 'Stacked' },
          { value: 'lanes', label: 'Lanes' },
        ]}
        value={lanes ? 'lanes' : 'stacked'}
        onChange={(v) => set().setLanes(v === 'lanes')}
      />
      <ChipRadio
        label="Height"
        options={[
          { value: 'power', label: 'Power' },
          { value: 'share', label: 'Share' },
        ]}
        value={share ? 'share' : 'power'}
        onChange={(v) => set().setShare(v === 'share')}
      />

      <Readout
        label="Current effort"
        value={b ? `${b.name}, ${fmtDuration(b.seconds)}` : fmtDuration(t)}
        sub={
          <span>
            Dominant engine: <b style={{ color: COLOR[dom] }}>{NAME[dom]}</b>
            {beyond ? ', beyond the axis (1 hr)' : ''}
          </span>
        }
      />

      <div className="wf-readout" style={{ marginBottom: 12, opacity: beyond ? 0.5 : 1 }}>
        <div className="lbl">{beyond ? 'Share of energy supply at 1 hr' : 'Share of energy supply'}</div>
        <div className="wf-pct-row">
          {KEYS.map((k) => (
            <div key={k} className="wf-pct" style={{ borderColor: `${COLOR[k]}66` }}>
              <div className="p" style={{ color: COLOR[k] }}>
                {Math.round(c[k])}%
              </div>
              <div className="n">{NAME[k]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pw-eng">
        {ENERGY_SYSTEMS.map((s) => (
          <div key={s.key} style={{ display: 'contents' }}>
            <span className="pw-eng-n" style={{ color: s.color }}>
              {s.name}
            </span>
            <span className="pw-eng-d">
              {s.atpRate}, {s.atpYield.toLowerCase()}. {s.duration}.
            </span>
          </div>
        ))}
      </div>

      {/* "Height is power output" only while the height IS power (review r2: Share plots the share of energy supply) */}
      <p className="st-ex-note">
        {share ? '' : 'Height is power output. '}Peak power order: <b>{PEAK_ORDER_TEXT}</b>. Oxidative outlasts the others, it is not more powerful.
      </p>
    </div>
  )
}
