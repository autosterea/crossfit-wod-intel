import { useEffect, useRef } from 'react'
import { HOPPER_DOMAINS, HOPPER_ROSTER, PAL } from '../../fitnessData'
import { Legend } from '../../ui'
import { onFrame } from '../../story/clock'
import { ChipRadio } from '../../story/ui/ChipRadio'
import { EXPLORE_CAP, GEN, NAMES, N_ATH } from './hopperMath'
import { boardAt } from './timeline'
import { worldNow } from './layout'
import { ex, useHopExplore, type HopView } from './exploreStore'

/* =========================================================================
   Hopper explore controls (DESIGN.md D.3 "Explore"). Peek (whole rows
   only): Draw (solid, 52 px), x10, x40; the Rails | Every run toggle; and,
   once a rail is tapped, that athlete's five domain scores as mini bars
   (keyed by the stage legend in the peek, by an in-panel key when the sheet
   is expanded and the stage legend steps aside). Expanded: New run (a fresh
   seed, shown as "run 51837"), Reset (seed 78331 at draw 40), and the
   Generalist, Top specialist and Leader readouts, written through refs only
   when a rounded total changes, and the module's own message for who
   leads (leadMsg: the generalist, or a specialist while its domain keeps
   coming up). Every string here already exists in the module, the label
   lexicon or fitnessData.
   ========================================================================= */

const VIEWS: readonly { value: HopView; label: string }[] = [
  { value: 'rails', label: 'Rails' },
  { value: 'runs', label: 'Every run' },
]

/** HopperModule.leadMsg: the generalist leads, or a specialist does */
const LEAD_MSG = ['Across random draws, the generalist accumulates the most points.', 'Keep drawing. A specialist only leads while its own domain keeps coming up.'] as const

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
              <div key={d.key} aria-label={`${d.label} ${v}`} style={{ width: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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

  // live readouts: the counted totals of the explore run, written only when a rounded value changes
  const gen = useRef<HTMLDivElement>(null)
  const spec = useRef<HTMLDivElement>(null)
  const specName = useRef<HTMLDivElement>(null)
  const leader = useRef<HTMLDivElement>(null)
  const note = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const last = new Float64Array(5).fill(NaN)
    return onFrame(() => {
      const b = boardAt(ex.sched, ex.X, worldNow().rails.len)
      let best = -1
      for (let a = 0; a < N_ATH; a++) if (a !== GEN && (best < 0 || b.totals[a] > b.totals[best])) best = a
      let lead = 0
      for (let a = 1; a < N_ATH; a++) if (b.totals[a] > b.totals[lead]) lead = a
      const g = Math.round(b.totals[GEN])
      const sp = Math.round(b.totals[best])
      if (g !== last[0] && gen.current) gen.current.textContent = String((last[0] = g))
      if (sp !== last[1] && spec.current) spec.current.textContent = String((last[1] = sp))
      if (best !== last[2] && specName.current) specName.current.textContent = NAMES[(last[2] = best)]
      if (lead !== last[3] && leader.current) {
        last[3] = lead
        leader.current.textContent = NAMES[lead]
        leader.current.style.color = lead === GEN ? PAL.yellowGreen : 'var(--st-chalk)'
      }
      const msg = lead === GEN ? 0 : 1
      if (msg !== last[4] && note.current) note.current.textContent = LEAD_MSG[(last[4] = msg)]
    })
  }, [])

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
      <ChipRadio label="View" className="st-ex-peek" options={VIEWS} value={view} onChange={(v) => st().setView(v)} />
      {selected !== null && <Profile a={selected} />}
      {/* the mini bars' key while the sheet is expanded (the stage legend steps aside then) */}
      {selected !== null && <Legend items={HOPPER_DOMAINS.map((d) => ({ label: d.label, color: d.color }))} />}

      <div className="st-ex-row" style={{ alignItems: 'center' }}>
        <button type="button" className="st-chip" onClick={() => st().newRun()}>
          New run
        </button>
        <button type="button" className="st-chip" onClick={() => st().reset()}>
          Reset
        </button>
        <span style={{ ...mono, fontSize: 12, color: 'var(--st-muted)', marginLeft: 4 }}>run {seed}</span>
      </div>

      {/* (wrapped: an inline display on a direct child would defeat the peek's row filter) */}
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

      <p ref={note} className="st-ex-note" aria-live="polite">
        {LEAD_MSG[0]}
      </p>
      <p className="st-ex-note">Tap a rail for that athlete's five domain scores.</p>
    </div>
  )
}
