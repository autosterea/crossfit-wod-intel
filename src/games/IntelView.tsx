import { useEffect, useMemo, useState } from 'react'
import { useGamesStore } from './gamesStore'
import { Panel } from './ui'
import {
  loadProjection,
  projectEvent,
  eventDemand,
  eventBuckets,
  confidenceBand,
  SIM_MOVEMENTS,
  MODALITY_GROUPS,
  MODAL_LABEL,
  type SimEvent,
  type TimeDomain,
  type LoadLevel,
} from './intel/projectionData'
import type { ProjectionData } from './intel/projectionTypes'

type Division = 'men' | 'women'
type Tab = 'leaderboard' | 'simulator'

const CONF_DOT: Record<string, string> = { high: '#3fbf78', medium: '#fbbf24', low: '#94a3b8' }
const TIME_DOMAINS: { key: TimeDomain; label: string }[] = [
  { key: 'sprint', label: 'Sprint (<2 min)' },
  { key: 'short', label: 'Short (2-6 min)' },
  { key: 'medium', label: 'Medium (6-15 min)' },
  { key: 'long', label: 'Long (15-30 min)' },
  { key: 'endurance', label: 'Endurance (30 min+)' },
]
const LOADS: { key: LoadLevel; label: string }[] = [
  { key: 'none', label: 'Bodyweight' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'heavy', label: 'Heavy' },
  { key: 'max', label: 'Max effort' },
]

const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

function Toggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--panel-border)] overflow-hidden">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="games-condensed uppercase tracking-[0.08em] text-[11px] font-semibold px-3.5 py-1.5 transition-colors"
          style={value === o.key ? { background: '#91C640', color: '#0a0a0a' } : { color: 'var(--text-secondary)' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------- leaderboard -------------------------------- */
function Leaderboard({ data, division }: { data: ProjectionData; division: Division }) {
  const navigate = useGamesStore((s) => s.navigate)
  const list = useMemo(
    () =>
      Object.values(data.athletes)
        .filter((a) => a.division === division)
        .sort((a, b) => a.seasonRank.rank - b.seasonRank.rank),
    [data, division],
  )
  const field = list.length

  return (
    <div>
      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mb-3 max-w-2xl">
        Projected order by the blended Season Rank index (50% 2026 season form, 30% prior-Games form, 20% age curve). Bars show the
        confidence band: wider for rookies and thin-data athletes. Click any athlete for the full breakdown.
      </p>
      <div className="space-y-1.5">
        {list.map((a) => {
          const band = confidenceBand(a.confidence, field)
          const lo = Math.max(1, a.seasonRank.rank - band)
          const hi = Math.min(field, a.seasonRank.rank + band)
          return (
            <button
              key={a.slug}
              onClick={() => navigate({ view: 'athlete', year: 2026, slug: a.slug })}
              className="w-full text-left games-event-card p-3 flex items-center gap-3 hover:border-[#91C640]/40 transition-colors"
            >
              <div className="games-display text-xl w-8 text-center shrink-0" style={{ color: a.seasonRank.rank <= 3 ? '#91C640' : 'var(--text-muted)' }}>
                {a.seasonRank.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{a.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CONF_DOT[a.confidence] }} title={`${a.confidence} confidence`} />
                  {a.seasonRank.rookie && <span className="text-[9px] uppercase tracking-wider text-[#60a5fa]">rookie</span>}
                </div>
                {/* confidence band visual */}
                <div className="relative h-1.5 mt-1.5 rounded-full bg-[var(--panel-bg-2)]">
                  <div
                    className="absolute h-full rounded-full bg-[#91C640]/30"
                    style={{ left: `${((lo - 1) / field) * 100}%`, width: `${((hi - lo + 1) / field) * 100}%` }}
                  />
                  <div className="absolute w-1.5 h-1.5 rounded-full bg-[#91C640] -mt-0" style={{ left: `${((a.seasonRank.rank - 1) / field) * 100}%` }} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="games-condensed text-[14px] text-[#91C640] tabular-nums">{a.seasonRank.score}</div>
                <div className="text-[9px] text-[var(--text-muted)]">{a.bestGamesFinish ? `best ${ord(a.bestGamesFinish)}` : 'no Games'}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------- simulator ---------------------------------- */
function Simulator({ data, division }: { data: ProjectionData; division: Division }) {
  const navigate = useGamesStore((s) => s.navigate)
  const [picked, setPicked] = useState<string[]>(['Run', 'Clean and Jerk'])
  const [timeDomain, setTimeDomain] = useState<TimeDomain>('medium')
  const [load, setLoad] = useState<LoadLevel>('moderate')

  const togglePick = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))

  const ev: SimEvent = useMemo(() => {
    const mods = new Set(picked.map((n) => SIM_MOVEMENTS.find((m) => m.name === n)?.modality).filter(Boolean) as string[])
    return { modality: ['M', 'G', 'W'].filter((m) => mods.has(m)).join('') || 'M', timeDomain, loadLevel: load }
  }, [picked, timeDomain, load])

  const demand = useMemo(() => eventDemand(ev), [ev])
  const buckets = useMemo(() => eventBuckets(ev), [ev])
  const athletes = useMemo(() => Object.values(data.athletes).filter((a) => a.division === division), [data, division])
  const projected = useMemo(() => projectEvent(athletes, ev), [athletes, ev])
  const topDemands = [...demand].sort((a, b) => b.weight - a.weight).slice(0, 4)

  return (
    <div>
      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mb-4 max-w-2xl">
        Build a workout and see who the model projects to win it. Each athlete is scored by their measured placement percentile on
        the modal domains the workout taxes - grounded in their real competition record, not a guess. These are model projections
        from competition-derived fingerprints, not predictions of a scheduled event.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {/* builder */}
        <Panel className="p-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-2">Movements</h3>
          {MODALITY_GROUPS.map((g) => (
            <div key={g.key} className="mb-3">
              <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[#60a5fa] mb-1.5">{g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {SIM_MOVEMENTS.filter((m) => m.modality === g.key).map((m) => (
                  <button
                    key={m.name}
                    onClick={() => togglePick(m.name)}
                    className="games-chip transition-colors"
                    style={picked.includes(m.name) ? { background: '#91C640', color: '#0a0a0a' } : { background: 'var(--panel-bg-2)', color: 'var(--text-secondary)', border: '1px solid var(--panel-border)' }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-2">Time domain</h3>
          <div className="mb-4"><Toggle value={timeDomain} onChange={setTimeDomain} options={TIME_DOMAINS} /></div>
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-2">Load</h3>
          <Toggle value={load} onChange={setLoad} options={LOADS} />

          <div className="mt-4 pt-3 border-t border-[var(--panel-border-subtle)]">
            <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-2">What you built</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {buckets.map((b) => (
                <span key={b} className="games-chip" style={{ background: 'rgba(96,165,250,0.16)', color: '#60a5fa' }}>{MODAL_LABEL[b]}</span>
              ))}
            </div>
            {topDemands.map((d) => (
              <div key={d.skill} className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-[var(--text-secondary)] w-24 shrink-0">{d.skill}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#91C640]" style={{ width: `${d.weight}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* projected order */}
        <Panel className="p-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-2">Projected finish ({division})</h3>
          {picked.length === 0 ? (
            <p className="text-[12px] text-[var(--text-muted)] py-6 text-center">Pick at least one movement.</p>
          ) : (
            <div className="space-y-1">
              {projected.slice(0, 15).map((r, i) => (
                <button
                  key={r.athlete.slug}
                  onClick={() => navigate({ view: 'athlete', year: 2026, slug: r.athlete.slug })}
                  className="w-full text-left flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-[var(--panel-bg-hover)] transition-colors"
                >
                  <span className="games-display text-base w-6 text-center shrink-0" style={{ color: i < 3 ? '#91C640' : 'var(--text-muted)' }}>{i + 1}</span>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] flex-1 truncate">{r.athlete.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CONF_DOT[r.athlete.confidence] }} />
                  <span className="games-condensed text-[12px] text-[var(--text-secondary)] tabular-nums">{r.expected}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

/* ---------------------------- view --------------------------------------- */
export default function IntelView() {
  const [data, setData] = useState<ProjectionData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [division, setDivision] = useState<Division>('men')
  const [tab, setTab] = useState<Tab>('leaderboard')

  useEffect(() => {
    let cancelled = false
    loadProjection()
      .then((d) => !cancelled && (setData(d), setStatus('ok')))
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading')
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-2 border-[#91C640]/30 border-t-[#91C640] rounded-full animate-spin" />
      </div>
    )
  if (status === 'error' || !data)
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-4">
        <div className="games-display text-2xl text-[var(--text-primary)] mb-2">Intelligence warming up</div>
        <p className="text-sm text-[var(--text-secondary)]">The projection model is being compiled. Check back shortly.</p>
      </div>
    )

  return (
    <div className="py-6">
      <section className="mb-5">
        <div className="games-condensed text-[11px] uppercase tracking-[0.18em] text-[#91C640] mb-1">2026 CrossFit Games</div>
        <h1 className="games-display text-3xl sm:text-4xl text-[var(--text-primary)] leading-none">Athlete Intelligence</h1>
        <p className="text-[13.5px] text-[var(--text-secondary)] mt-2 max-w-2xl leading-relaxed">
          A continuously-updating, fully data-grounded model of the 2026 field: who is projected to do what, built from every
          official competition result. Every number traces to real events; nothing is invented.
        </p>
        {data.fieldProvisional && (
          <div className="mt-3 inline-flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }}>
            Field provisional - the 30+30 locks after the online Semifinal (~June 16). Cohort = top 30 per division by Open + Quarterfinals.
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <Toggle value={tab} onChange={setTab} options={[{ key: 'leaderboard', label: 'Projected Leaderboard' }, { key: 'simulator', label: 'What-If Simulator' }]} />
        <Toggle value={division} onChange={setDivision} options={[{ key: 'men', label: 'Men' }, { key: 'women', label: 'Women' }]} />
      </div>

      {tab === 'leaderboard' ? <Leaderboard data={data} division={division} /> : <Simulator data={data} division={division} />}

      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mt-8 max-w-2xl">
        Method: each athlete's fingerprint is their placement percentile (percent of field beaten) across the 2026 Open and
        Quarterfinals plus every prior CrossFit Games event, classified by modal domain, time domain and load. Skills and energy
        systems are competition-derived performance profiles, not lab measurements. Confidence reflects how many Games an athlete
        has on record. As real results land, the model updates and projected-vs-actual will be shown.
      </p>
    </div>
  )
}
