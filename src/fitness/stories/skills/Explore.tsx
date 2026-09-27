import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { ARCHETYPES, MODULE_COPY, PAL, SKILLS } from '../../fitnessData'
import { Legend, Readout } from '../../ui'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { focusRect, subscribeFocus } from '../../story/camera/focusRect'
import { CLASS_COLOR, CLASS_LABEL, GENERALIST, fmtVal, floorOf, profileOf, rangeOf, shortName, weakestNames } from './skillsMath'
import { CUSTOM, NONE, useSkExplore, type SkView } from './exploreStore'
import './skills.css'

/* Skills explore controls (DESIGN.md D.2 "Explore"). Peek (whole rows
   only): the tapped skill's definition when there is one, then ONE row with
   the Wheel | Grid switch and the Athlete chips, so the Grid is chosen and
   seen with the sheet down, where the lineup has the whole stage. On a
   phone the chips carry the D.2 short names, so a part of the next chip
   always shows at the edge (the row scrolls). Expanded: the readouts
   (Weakest skill and Range, for A and for B; no mean or breadth anywhere),
   the Compare chips, the class legend and, for Custom, the ten sliders. A
   chip pick always shows on the wheel (from the Grid it glides back); a
   Grid pick on a phone drops an expanded sheet back to the peek. Every
   string here already exists in fitnessData or the legacy module; the
   closing hint paraphrases the legacy control hint (SkillsModule "Pick
   Athlete A and a compare ghost. Edit Custom with the sliders."), without
   "ghost", which the story uses for the dimmed generalist. */

const CLASS_ITEMS = (['trained', 'practiced', 'both'] as const).map((c) => ({ label: CLASS_LABEL[c], color: CLASS_COLOR[c] }))
/** a phone or tablet sheet (the chip rows scroll); the desktop column wraps them */
const compactNow = () => focusRect.shell !== 'desktop'

/** a partial chip shows at least this much before the row's clip edge (px) ... */
const SHOW = 28
/** ... and is cut by at least this much */
const CUT = 22

/**
 * The Athlete row must never end exactly on a chip boundary (at 390 px two
 * chips can fill it and hide the third completely, and nothing then says
 * that twelve more athletes are a swipe away). Measured from the natural
 * layout (scrolled to the start, nothing added): when no chip straddles
 * the row's clip edge, the whole chips in view grow a little roomier (up to
 * 12 px a side, so the row stays even) and any remainder moves them right,
 * until the last whole one is cut by the edge. Re-measured on resize and
 * when the fonts land.
 */
function useChipPeek(wrap: React.RefObject<HTMLDivElement | null>, deps: unknown) {
  useLayoutEffect(() => {
    const host = wrap.current
    const row = host?.querySelector<HTMLElement>('.st-chiprow')
    if (!host || !row) return
    const fit = () => {
      const set = (pad: number, nudge: number) => {
        host.style.setProperty('--sk-chip-x', pad + 'px')
        host.style.setProperty('--sk-nudge', nudge + 'px')
      }
      if (focusRect.shell === 'desktop') {
        set(0, 0)
        return
      }
      const pad = parseFloat(host.style.getPropertyValue('--sk-chip-x')) || 0
      const nudge = parseFloat(host.style.getPropertyValue('--sk-nudge')) || 0
      const edge = row.getBoundingClientRect().right
      let whole = 0
      let lastWhole = -Infinity
      let straddles = false
      let i = 0
      for (const c of row.querySelectorAll<HTMLElement>('[role="radio"]')) {
        const r = c.getBoundingClientRect()
        // back to the natural layout: chip i sits nudge + 2 pad i further right, and is 2 pad wider
        const left = r.left + row.scrollLeft - nudge - 2 * pad * i
        const right = r.right + row.scrollLeft - nudge - 2 * pad * (i + 1)
        i++
        if (left <= edge - SHOW && right >= edge + CUT) straddles = true
        if (right < edge + CUT) {
          whole = i
          lastWhole = right
        }
        if (left > edge) break
      }
      let p = 0
      let n = 0
      if (!straddles && whole > 0) {
        const need = Math.ceil(edge + CUT - lastWhole)
        p = Math.min(12, Math.ceil(need / (2 * whole)))
        n = Math.max(0, need - 2 * p * whole)
      }
      if (p !== pad || n !== nudge) set(p, n)
    }
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(row)
    let live = true
    void document.fonts?.ready.then(() => live && fit())
    return () => {
      live = false
      ro?.disconnect()
    }
  }, [wrap, deps])
}

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
              {/* every skill at the floor: a tie is never shown as one skill */}
              <span className="sk-skill">{weakestNames(profile).join(', ')}</span>
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
  const compact = useSyncExternalStore(subscribeFocus, compactNow)
  const root = useRef<HTMLDivElement>(null)
  const peekRow = useRef<HTMLDivElement>(null)
  const A = athlete === CUSTOM ? custom : profileOf(athlete) ?? GENERALIST.profile
  const B = compare === NONE || compare === athlete ? null : profileOf(compare)
  const aColor = athlete === GENERALIST.name ? PAL.yellowGreen : PAL.chalk
  const skill = info === null ? null : SKILLS[info]
  const label = (name: string) => (compact ? shortName(name) : name)
  const aOptions = useMemo(() => [...ARCHETYPES.map((a) => ({ value: a.name, label: compact ? shortName(a.name) : a.name })), { value: CUSTOM, label: CUSTOM }], [compact])
  const bOptions = useMemo(() => [{ value: NONE, label: NONE }, ...ARCHETYPES.map((a) => ({ value: a.name, label: compact ? shortName(a.name) : a.name }))], [compact])
  useChipPeek(peekRow, compact)
  // a choice made elsewhere (a grid cell, a drag into Custom) scrolls its chip into view
  useEffect(() => {
    const el = root.current?.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Athlete"] [aria-checked="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [athlete])

  const pickView = (v: SkView) => {
    set().setView(v)
    if (v !== 'grid') return
    // the lineup needs the stage: on a phone an expanded sheet drops to the
    // peek (the engine's own grab handle), where the Grid gets its 3 x 5 layout
    const panel = root.current?.closest('.st-explore')
    if (panel?.classList.contains('is-open')) panel.querySelector<HTMLButtonElement>('.st-grab')?.click()
  }

  return (
    <div className="st-ex" ref={root}>
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
      <div className="sk-peekrow st-ex-peek" ref={peekRow}>
        <div className="sk-view" role="group" aria-label="View">
          {(['wheel', 'grid'] as SkView[]).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => pickView(v)}>
              {v === 'wheel' ? 'Wheel' : 'Grid'}
            </button>
          ))}
        </div>
        <ChipRadio label="Athlete" options={aOptions} value={athlete} onChange={(v) => set().pickAthlete(v)} />
      </div>

      <Reads who={label(athlete)} profile={A} color={aColor} />
      {B && <Reads who={label(compare)} profile={B} color={PAL.chalk} dashed />}

      <div className="sk-head">Compare</div>
      <ChipRadio label="Compare" options={bOptions} value={compare} onChange={(v) => set().pickCompare(v)} />

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
      <p className="st-ex-note">Pick an athlete and one to compare. Edit Custom with the sliders.</p>
    </div>
  )
}
