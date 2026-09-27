import { useEffect, useRef } from 'react'
import { HOPPER_DOMAINS, HOPPER_ROSTER, PAL } from '../../fitnessData'
import { onFrame } from '../../story/clock'
import { focusRect } from '../../story/camera/focusRect'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { EXPLORE_CAP, GEN, NAMES, N_ATH } from './hopperMath'
import { boardAt } from './timeline'
import { WORLD } from './layout'
import { ex, useHopExplore, type HopView } from './exploreStore'

/* =========================================================================
   Hopper explore controls (DESIGN.md D.3 "Explore"). Peek (whole rows
   only): Draw (solid, 52 px), x10, x40; plus the tapped athlete's five
   domain scores as mini bars. Expanded: New run (a fresh seed, shown as
   "run 51837"), Reset (seed 78331 at draw 40), Rails | Every run, and the
   Generalist, Top specialist and Leader readouts, written through refs as
   the totals count. Every string here already exists in the module, the
   label lexicon or fitnessData.
   ========================================================================= */

const VIEWS: readonly { value: HopView; label: string }[] = [
  { value: 'rails', label: 'Rails' },
  { value: 'runs', label: 'Every run' },
]

const mono: React.CSSProperties = { fontFamily: 'var(--st-mono)', fontVariantNumeric: 'tabular-nums' }

function Profile({ a }: { a: number }) {
  const r = HOPPER_ROSTER[a]
  const g = a === GEN
  return (
    <div className="st-ex-peek" aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, margin: '0 0 10px' }}>
        <div
          style={{
            flex: '0 1 auto',
            minWidth: 0,
            fontFamily: 'var(--st-cond)',
            fontWeight: 600,
            fontSize: 13,
            lineHeight: 1.1,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: g ? PAL.yellowGreen : 'var(--st-chalk)',
            paddingBottom: 2,
          }}
        >
          {NAMES[a]}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {HOPPER_DOMAINS.map((d) => {
            const v = r.domain[d.key]
            return (
              <div key={d.key} title={d.label} aria-label={`${d.label} ${v}`} style={{ width: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 10, height: 26, display: 'flex', alignItems: 'flex-end', background: 'rgba(238,243,246,0.07)', borderRadius: 3 }}>
                  <div style={{ width: '100%', height: `${v}%`, background: d.color, borderRadius: 3 }} />
                </div>
                <div style={{ ...mono, fontSize: 11, fontWeight: 600, color: d.color }}>{v}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function HopperExplore() {
  const seed = useHopExplore((s) => s.seed)
  const view = useHopExplore((s) => s.view)
  const selected = useHopExplore((s) => s.selected)
  const n = useHopExplore((s) => s.n)
  const st = useHopExplore.getState
  const full = n >= EXPLORE_CAP

  // live readouts: the counted totals of the explore run
  const gen = useRef<HTMLDivElement>(null)
  const spec = useRef<HTMLDivElement>(null)
  const specName = useRef<HTMLDivElement>(null)
  const leader = useRef<HTMLDivElement>(null)
  useEffect(
    () =>
      onFrame(() => {
        const b = boardAt(ex.sched, ex.X, WORLD[focusRect.layout].rails.len)
        let best = -1
        for (let a = 0; a < N_ATH; a++) if (a !== GEN && (best < 0 || b.totals[a] > b.totals[best])) best = a
        const set = (el: HTMLDivElement | null, s: string) => {
          if (el && el.textContent !== s) el.textContent = s
        }
        set(gen.current, String(Math.round(b.totals[GEN])))
        set(spec.current, String(Math.round(b.totals[best])))
        set(specName.current, NAMES[best])
        let lead = 0
        for (let a = 1; a < N_ATH; a++) if (b.totals[a] > b.totals[lead]) lead = a
        set(leader.current, NAMES[lead])
        if (leader.current) leader.current.style.color = lead === GEN ? PAL.yellowGreen : 'var(--st-chalk)'
      }),
    [],
  )

  const cell: React.CSSProperties = {
    flex: 1,
    textAlign: 'center',
    background: 'rgba(238,243,246,0.035)',
    border: '1px solid var(--st-line)',
    borderRadius: 10,
    padding: '8px 4px',
    minWidth: 0,
  }
  const num: React.CSSProperties = { ...mono, fontWeight: 600, fontSize: 18 }
  const cap: React.CSSProperties = {
    fontFamily: 'var(--st-cond)',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--st-muted)',
    marginTop: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  return (
    <div className="st-ex">
      <div className="st-ex-peek" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          className="st-btn st-btn--solid"
          style={{ height: 52, flex: '1.6 1 0', fontSize: 15 }}
          onClick={() => st().draw(1)}
          disabled={full}
          aria-disabled={full}
        >
          Draw
        </button>
        <button type="button" className="st-btn st-btn--outline" style={{ height: 52, flex: '1 1 0' }} onClick={() => st().draw(10)} disabled={full}>
          x10
        </button>
        <button type="button" className="st-btn st-btn--outline" style={{ height: 52, flex: '1 1 0' }} onClick={() => st().draw(40)} disabled={full}>
          x40
        </button>
      </div>
      {selected !== null && <Profile a={selected} />}

      <div className="st-ex-row" style={{ alignItems: 'center' }}>
        <button type="button" className="st-chip" onClick={() => st().newRun()}>
          New run
        </button>
        <button type="button" className="st-chip" onClick={() => st().reset()}>
          Reset
        </button>
        <span style={{ ...mono, fontSize: 12, color: 'var(--st-muted)', marginLeft: 4 }}>run {seed}</span>
      </div>

      <ChipRadio label="View" options={VIEWS} value={view} onChange={(v) => st().setView(v)} />

      <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={cell}>
          <div ref={gen} style={{ ...num, color: PAL.yellowGreen }}>
            0
          </div>
          <div style={cap}>Generalist</div>
        </div>
        <div style={cell}>
          <div ref={spec} style={{ ...num, color: 'var(--st-chalk)' }}>
            0
          </div>
          <div style={cap}>Top specialist</div>
          <div ref={specName} style={{ ...cap, marginTop: 1, color: 'var(--st-body)', letterSpacing: '0.04em' }}>
            -
          </div>
        </div>
        <div style={cell}>
          <div ref={leader} style={{ ...num, fontFamily: 'var(--st-cond)', fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase', paddingTop: 2 }}>
            -
          </div>
          <div style={cap}>Leader</div>
        </div>
      </div>
      </div>

      <p className="st-ex-note">Across random draws, the generalist accumulates the most points.</p>
      <p className="st-ex-note">Tap a rail for that athlete's five domain scores.</p>
    </div>
  )
}
