import { useEffect, useMemo, useState } from 'react'
import { useGamesStore } from './gamesStore'
import { Panel } from './ui'
import {
  loadProjection,
  projectEvent,
  projectDraw,
  eventDemand,
  eventBuckets,
  confidenceBand,
  SIM_MOVEMENTS,
  MODALITY_GROUPS,
  MODAL_LABEL,
  type SimEvent,
  type SimResult,
  type DrawResult,
  type TimeDomain,
  type LoadLevel,
} from './intel/projectionData'
import type { ProjectionData } from './intel/projectionTypes'

type Division = 'men' | 'women'
type Tab = 'leaderboard' | 'simulator'

const CONF_DOT: Record<string, string> = { high: 'var(--accent-success)', medium: 'var(--accent-amber)', low: 'var(--text-tertiary)' }
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

const ord = (n: number) => {
  const t = n % 100
  const s = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
  return `${n}${s}`
}

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
function Leaderboard({ data, division, qualifiedOnly }: { data: ProjectionData; division: Division; qualifiedOnly: boolean }) {
  const navigate = useGamesStore((s) => s.navigate)
  const full = useMemo(
    () =>
      Object.values(data.athletes)
        .filter((a) => a.division === division)
        .sort((a, b) => a.seasonRank.rank - b.seasonRank.rank),
    [data, division],
  )
  const field = full.length // bands are scaled to the full division field
  const list = qualifiedOnly ? full.filter((a) => a.status === 'qualified') : full

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
                  {a.status === 'contender' && <span className="text-[9px] uppercase tracking-wider text-[var(--accent-amber)] shrink-0">in the hunt</span>}
                  {a.seasonRank.rookie && <span className="text-[9px] uppercase tracking-wider text-[var(--accent-blue)] shrink-0">rookie</span>}
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
  const [draw, setDraw] = useState<{ ev: SimEvent; label: string }[]>([]) // Hopper: a multi-event draw

  const togglePick = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))

  const ev: SimEvent = useMemo(() => {
    const mods = new Set(picked.map((n) => SIM_MOVEMENTS.find((m) => m.name === n)?.modality).filter(Boolean) as string[])
    return { modality: ['M', 'G', 'W'].filter((m) => mods.has(m)).join('') || 'M', timeDomain, loadLevel: load }
  }, [picked, timeDomain, load])

  const [expanded, setExpanded] = useState<string | null>(null)
  const [showMethod, setShowMethod] = useState(false)

  const demand = useMemo(() => eventDemand(ev), [ev])
  const buckets = useMemo(() => eventBuckets(ev), [ev])
  const athletes = useMemo(() => Object.values(data.athletes).filter((a) => a.division === division), [data, division])
  const projected = useMemo(() => projectEvent(athletes, ev), [athletes, ev])
  const drawResult = useMemo(() => (draw.length ? projectDraw(athletes, draw.map((d) => d.ev)) : null), [athletes, draw])
  const topDemands = [...demand].sort((a, b) => b.weight - a.weight).slice(0, 4)
  const vitals = (a: (typeof athletes)[number]) =>
    [a.weightKg ? `${a.weightKg} kg` : null, a.heightCm ? `${a.heightCm} cm` : null, a.bestGamesFinish ? `best Games ${ord(a.bestGamesFinish)}` : a.seasonRank.rookie ? 'Games rookie' : null]
      .filter(Boolean)
      .join('  ·  ')
  const addToDraw = () => {
    if (!picked.length) return
    const label = `${picked.slice(0, 2).join(' + ')}${picked.length > 2 ? ` +${picked.length - 2}` : ''} . ${timeDomain}`
    setDraw((d) => (d.length >= 6 ? d : [...d, { ev, label }]))
  }

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
              <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--accent-blue)] mb-1.5">{g.label}</div>
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
                <span key={b} className="games-chip" style={{ background: 'rgba(96,165,250,0.16)', color: 'var(--accent-blue)' }}>{MODAL_LABEL[b]}</span>
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

          {/* Hopper draw: stack several workouts and project the combined standings */}
          <div className="mt-4 pt-3 border-t border-[var(--panel-border-subtle)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)]">Hopper draw {draw.length > 0 && `(${draw.length})`}</h3>
              <button onClick={addToDraw} disabled={!picked.length || draw.length >= 6} className="games-condensed text-[10px] uppercase tracking-[0.08em] font-semibold px-2.5 py-1 rounded transition-colors" style={{ background: 'rgba(145,198,64,0.16)', color: '#91C640', opacity: !picked.length || draw.length >= 6 ? 0.4 : 1 }}>+ Add this workout</button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">Stack 2 to 6 events like a real Games weekend; the standings on the right become the combined finish across the whole draw.</p>
            {draw.length === 0 ? (
              <p className="text-[10px] text-[var(--text-muted)]">No events drawn yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {draw.map((d, i) => (
                  <button key={i} onClick={() => setDraw((arr) => arr.filter((_, j) => j !== i))} className="games-chip" style={{ background: 'var(--panel-bg-2)', color: 'var(--text-secondary)', border: '1px solid var(--panel-border)' }}>
                    {i + 1}. {d.label} &times;
                  </button>
                ))}
                <button onClick={() => setDraw([])} className="games-chip" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--accent-amber)' }}>clear</button>
              </div>
            )}
          </div>
        </Panel>

        {/* projected order */}
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)]">
              {drawResult ? `Projected after the ${draw.length}-event draw` : 'Projected finish'} · all {athletes.length} {division}
            </h3>
            <button
              onClick={() => setShowMethod((s) => !s)}
              className="games-condensed text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-1 rounded shrink-0 transition-colors"
              style={{ background: showMethod ? '#91C640' : 'rgba(145,198,64,0.16)', color: showMethod ? '#0a0a0a' : '#91C640' }}
            >
              How is this computed?
            </button>
          </div>

          {showMethod && (
            <div className="mb-3 rounded-lg p-3 text-[11px] leading-relaxed" style={{ background: 'var(--panel-bg-2)', color: 'var(--text-secondary)' }}>
              The workout you built is first classified into the fitness domains it taxes (the "What you built" panel). Each
              athlete is then scored by their <strong>measured placement percentile</strong> - the percent of the field they have
              actually beaten - on exactly those domains, averaged from their real 2026 Open, Quarterfinals and every prior
              CrossFit Games result. Higher means more proven on this kind of work. Tap any athlete to see the domains and the
              measured scores behind their number. Height and weight are shown for context; the projection is driven by measured
              performance, not an assumed bodyweight formula, so nothing is invented.
            </div>
          )}

          {!drawResult && picked.length === 0 ? (
            <p className="text-[12px] text-[var(--text-muted)] py-6 text-center">Pick at least one movement.</p>
          ) : (
            <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
              {(drawResult ?? projected).map((r, i) => {
                const isOpen = expanded === r.athlete.slug
                const single = !drawResult ? (r as SimResult) : null
                return (
                  <div key={r.athlete.slug} className="rounded-lg" style={{ background: isOpen ? 'var(--panel-bg-2)' : 'transparent' }}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : r.athlete.slug)}
                      className="w-full text-left flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-[var(--panel-bg-hover)] transition-colors"
                    >
                      <span className="games-display text-base w-6 text-center shrink-0" style={{ color: i < 3 ? '#91C640' : 'var(--text-muted)' }}>{i + 1}</span>
                      <span className="text-[13px] font-semibold text-[var(--text-primary)] flex-1 truncate">{r.athlete.name}</span>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CONF_DOT[r.athlete.confidence] }} title={`${r.athlete.confidence} data confidence`} />
                      {drawResult ? (
                        <span className="games-condensed text-[11px] text-[var(--text-muted)] tabular-nums">{(r as DrawResult).points} pts</span>
                      ) : (
                        <span className="games-condensed text-[12px] text-[var(--text-secondary)] tabular-nums w-9 text-right" title={single!.usedCapacityFallback ? 'career capacity (no measured score on these exact domains)' : undefined}>{single!.expected}{single!.usedCapacityFallback ? '*' : ''}</span>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)] w-3 shrink-0">{isOpen ? '▾' : '▸'}</span>
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-1">
                        <div className="text-[10.5px] text-[var(--text-muted)] mb-2">{vitals(r.athlete) || 'vitals not on file'}</div>
                        {single ? (
                          single.parts.length ? (
                            <>
                              <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1.5">How this score is built</div>
                              {single.parts.map((p) => (
                                <div key={p.key} className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] text-[var(--text-secondary)] w-24 shrink-0">{p.label}</span>
                                  <div className="flex-1 h-1.5 rounded-full bg-[var(--panel-border)] overflow-hidden">
                                    <div className="h-full rounded-full bg-[#91C640]" style={{ width: `${p.value}%` }} />
                                  </div>
                                  <span className="games-condensed text-[11px] text-[var(--text-secondary)] tabular-nums w-8 text-right">{p.value}</span>
                                </div>
                              ))}
                              <div className="text-[11px] text-[var(--text-secondary)] mt-2">
                                Projected score = average of {single.parts.length} measured domain{single.parts.length > 1 ? 's' : ''} ={' '}
                                <strong className="text-[#91C640]">{single.expected}</strong> <span className="text-[var(--text-muted)]">(percent of field beaten)</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-[11px] text-[var(--text-secondary)]">No measured result on these exact domains, so the model falls back to this athlete's career capacity of <strong className="text-[#91C640]">{single.expected}</strong>.</div>
                          )
                        ) : (
                          <>
                            <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-1.5">Projected finish per drawn event</div>
                            {(r as DrawResult).perEvent.map((place, j) => (
                              <div key={j} className="flex items-center justify-between gap-2 text-[11px] mb-0.5">
                                <span className="text-[var(--text-secondary)] truncate">{j + 1}. {draw[j]?.label ?? `event ${j + 1}`}</span>
                                <span className="games-condensed text-[#91C640] tabular-nums shrink-0">{ord(place)}</span>
                              </div>
                            ))}
                            <div className="text-[11px] text-[var(--text-secondary)] mt-2">Total = <strong className="text-[#91C640]">{(r as DrawResult).points} pts</strong> (sum of finishes, lower is better)</div>
                          </>
                        )}
                        <button onClick={() => navigate({ view: 'athlete', year: 2026, slug: r.athlete.slug })} className="games-condensed text-[10px] uppercase tracking-[0.08em] font-semibold text-[#91C640] mt-2 hover:underline">
                          View full profile &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {drawResult && <p className="text-[10px] text-[var(--text-muted)] pt-1">Points = sum of projected event finishes across the draw (lower is better), the way the Games scores a weekend.</p>}
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
  const [qualOnly, setQualOnly] = useState(false)

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
        {data.fieldProvisional ? (
          <div className="mt-3 inline-flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.14)', color: 'var(--accent-amber)' }}>
            Field provisional - 23+23 confirmed from the in-person Semifinals; the final 7+7 and full 30+30 lock after the online Semifinal (~June 16). Contenders are marked.
          </div>
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg" style={{ background: 'rgba(1,150,68,0.14)', color: '#019644' }}>
            Field set - 30 men and 30 women qualified. Every rank and percentile is computed within the 60-athlete Games field.
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <Toggle value={tab} onChange={setTab} options={[{ key: 'leaderboard', label: 'Projected Leaderboard' }, { key: 'simulator', label: 'What-If Simulator' }]} />
        <div className="flex items-center gap-2">
          {tab === 'leaderboard' && Object.values(data.athletes).some((a) => a.status === 'contender') && (
            <Toggle value={qualOnly ? 'q' : 'all'} onChange={(v) => setQualOnly(v === 'q')} options={[{ key: 'all', label: 'All' }, { key: 'q', label: 'Qualified' }]} />
          )}
          <Toggle value={division} onChange={setDivision} options={[{ key: 'men', label: 'Men' }, { key: 'women', label: 'Women' }]} />
        </div>
      </div>

      {tab === 'leaderboard' ? <Leaderboard data={data} division={division} qualifiedOnly={qualOnly} /> : <Simulator data={data} division={division} />}

      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mt-8 max-w-2xl">
        Method: each athlete's fingerprint is their placement percentile (percent of field beaten) across the 2026 Open and
        Quarterfinals plus every prior CrossFit Games event, classified by modal domain, time domain and load. Skills and energy
        systems are competition-derived performance profiles, not lab measurements. Confidence reflects how many Games an athlete
        has on record. As real results land, the model updates and projected-vs-actual will be shown.
      </p>
    </div>
  )
}
