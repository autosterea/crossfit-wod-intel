import { useEffect, useState } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { loadProjection, MODAL_LABEL } from './projectionData'
import type { AthleteIntel, Benchmark } from './projectionTypes'
import { Panel } from '../ui'

const PA_GREEN = '#91C640'
const ENERGY_COLOR = { phosphagen: '#f43f5e', glycolytic: '#f59e0b', oxidative: '#38bdf8' }
const CONF_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  high: { label: 'High confidence', bg: 'rgba(1,150,68,0.18)', fg: 'var(--accent-success)' },
  medium: { label: 'Medium confidence', bg: 'rgba(245,158,11,0.18)', fg: 'var(--accent-amber)' },
  low: { label: 'Low confidence / thin data', bg: 'rgba(148,163,184,0.16)', fg: 'var(--text-secondary)' },
}

function rankTone(pct: number | null): { color: string; bg: string } {
  if (pct == null) return { color: 'var(--text-muted)', bg: 'var(--panel-bg-2)' }
  if (pct >= 70) return { color: 'var(--accent-success)', bg: 'rgba(1,150,68,0.16)' }
  if (pct <= 30) return { color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.16)' }
  return { color: 'var(--text-secondary)', bg: 'var(--panel-bg-2)' }
}

function BenchmarkTile({ b }: { b: Benchmark }) {
  const tone = rankTone(b.pct)
  const rankLabel = b.fieldRank == null ? null : b.fieldRank === 1 ? 'best in field' : `#${b.fieldRank} of ${b.fieldOf}`
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg" style={{ background: 'var(--panel-bg-2)' }}>
      <div className="min-w-0">
        <div className="text-[12px] text-[var(--text-secondary)] truncate">{b.name}</div>
        <div className="games-condensed text-[16px] text-[var(--text-primary)] leading-none tabular-nums">{b.value}</div>
      </div>
      {rankLabel && (
        <span className="games-condensed text-[10px] uppercase tracking-[0.06em] px-2 py-1 rounded shrink-0" style={{ background: tone.bg, color: tone.color }}>
          {rankLabel}
        </span>
      )}
    </div>
  )
}

function Benchmarks({ items }: { items: Benchmark[] }) {
  if (!items.length) return null
  const lifts = items.filter((b) => b.kind === 'lift')
  const wods = items.filter((b) => b.kind === 'benchmark')
  return (
    <Panel className="p-4 mb-4">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)]">Benchmarks</h3>
        <span className="text-[10px] text-[var(--text-muted)]">self-reported on official CrossFit profile</span>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mb-3">Green = top third of the field, amber = bottom third. Rank is within division among athletes who reported each mark.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {lifts.length > 0 && (
          <div>
            <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[#91C640] mb-1.5">Strength (1RM)</div>
            <div className="space-y-1.5">{lifts.map((b) => <BenchmarkTile key={b.name} b={b} />)}</div>
          </div>
        )}
        {wods.length > 0 && (
          <div>
            <div className="games-condensed text-[10px] uppercase tracking-[0.1em] text-[var(--accent-blue)] mb-1.5">Benchmark WODs</div>
            <div className="space-y-1.5">{wods.map((b) => <BenchmarkTile key={b.name} b={b} />)}</div>
          </div>
        )}
      </div>
    </Panel>
  )
}

function Bar({ label, value, color, sub }: { label: string; value: number | null; color: string; sub?: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
        <span className="games-condensed text-[13px] text-[var(--text-primary)] tabular-nums">{value == null ? '-' : value}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--panel-bg-2)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: color }} />
      </div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
  )
}

export default function IntelProfile({ slug, showHeader = false }: { slug: string; showHeader?: boolean }) {
  const [data, setData] = useState<AthleteIntel | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'absent'>('loading')

  useEffect(() => {
    let cancelled = false
    loadProjection()
      .then((p) => {
        if (cancelled) return
        const a = p.athletes[slug]
        if (a) {
          setData(a)
          setStatus('ok')
        } else setStatus('absent')
      })
      .catch(() => !cancelled && setStatus('absent'))
    return () => {
      cancelled = true
    }
  }, [slug])

  if (status === 'loading')
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-8 h-8 border-2 border-[#91C640]/30 border-t-[#91C640] rounded-full animate-spin" />
      </div>
    )
  if (status === 'absent' || !data) return null

  const a = data
  const conf = CONF_STYLE[a.confidence]
  const skillRadar = a.skills.filter((s) => s.measured).map((s) => ({ axis: s.skill, value: s.score ?? 0 }))
  const modalRadar = Object.entries(a.modal)
    .filter(([, v]) => v != null)
    .map(([k, v]) => ({ axis: MODAL_LABEL[k] ?? k, value: v as number }))
  const games = [...a.gamesHistory].sort((x, y) => x.year - y.year)
  const w = a.seasonRank.components

  return (
    <section className="mt-8">
      {showHeader && (
        <div className="mb-5">
          <h1 className="games-display text-3xl text-[var(--text-primary)] leading-none">{a.name}</h1>
          <div className="text-[13px] text-[var(--text-secondary)] mt-1 capitalize">
            {a.country ?? ''}
            {a.country && a.age ? ' . ' : ''}
            {a.age ? `${a.age} yrs` : ''} . {a.division}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 max-w-xl">
            Full bio and media land when the 2026 field locks (~June 16). Below is the data-grounded competition profile.
          </p>
        </div>
      )}
      {/* Heading + confidence */}
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h2 className="games-display text-2xl text-[var(--text-primary)] leading-none">
          Athlete <span className="text-[#91C640]">Intelligence</span>
        </h2>
        {a.status === 'qualified' ? (
          <span className="games-chip" style={{ background: 'rgba(1,150,68,0.18)', color: 'var(--accent-success)' }}>Qualified</span>
        ) : (
          <span className="games-chip" style={{ background: 'rgba(245,158,11,0.16)', color: 'var(--accent-amber)' }}>In the hunt</span>
        )}
        <span className="games-chip" style={{ background: conf.bg, color: conf.fg }}>{conf.label}</span>
        {a.seasonRank.rookie && (
          <span className="games-chip" style={{ background: 'rgba(96,165,250,0.16)', color: 'var(--accent-blue)' }}>Games rookie</span>
        )}
      </div>
      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mb-4 max-w-2xl">
        Competition-derived profile. Every number is each athlete's placement percentile (percent of field beaten) across{' '}
        {a.dataDepth.seasonEvents} 2026 season tests{a.dataDepth.gamesEvents ? ` + ${a.dataDepth.gamesEvents} prior Games event scores` : ''}, processed through the L1 fitness model. Skills and energy systems are performance profiles, not lab measurements.
      </p>

      {/* PA-voice scouting read (grounded in the numbers above) */}
      {a.narrative && (
        <div className="mb-5 pl-3.5 border-l-2 border-[#91C640]/60">
          <p className="text-[14.5px] leading-relaxed text-[var(--text-primary)]">{a.narrative}</p>
          <div className="games-condensed text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)] mt-1.5">Persistence Athletics scouting read</div>
        </div>
      )}

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { stat: `#${a.seasonRank.rank}`, label: 'Projected season rank', sub: `${a.division} field` },
          { stat: `${a.capacity}`, label: 'Capacity score', sub: 'percentile, all events' },
          { stat: `${a.consistency}`, label: 'Consistency', sub: '100 - variability' },
          { stat: a.bestGamesFinish ? `${a.bestGamesFinish}${a.bestGamesFinish === 1 ? 'st' : a.bestGamesFinish === 2 ? 'nd' : a.bestGamesFinish === 3 ? 'rd' : 'th'}` : '-', label: 'Best Games finish', sub: a.gamesHistory.length ? `${a.gamesHistory.length} appearances` : 'no Games yet' },
        ].map((s) => (
          <Panel key={s.label} className="p-3">
            <div className="games-display text-2xl text-[#91C640] leading-none">{s.stat}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1 leading-tight">{s.label}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{s.sub}</div>
          </Panel>
        ))}
      </div>

      {/* Benchmarks (self-reported lifts + classic WODs) */}
      <Benchmarks items={a.benchmarks ?? []} />

      <div className="grid md:grid-cols-2 gap-4">
        {/* 10 physical skills radar */}
        <Panel className="p-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-1">10 General Physical Skills</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-2">Field-relative, vs the {a.division} cohort. Flexibility has no competition signal.</p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <RadarChart data={skillRadar} outerRadius="72%">
                <PolarGrid stroke="var(--panel-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke={PA_GREEN} fill={PA_GREEN} fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] text-center">Flexibility: not measurable from competition results</p>
        </Panel>

        {/* Modal axes radar */}
        <Panel className="p-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-1">Modal Domains (Hopper readiness)</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-2">A flatter, fuller shape = readier for any task drawn from the hopper.</p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <RadarChart data={modalRadar} outerRadius="72%">
                <PolarGrid stroke="var(--panel-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Energy systems */}
        <Panel className="p-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-2">Three Energy Systems</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-3">Performance on events that tax each pathway (Gastin-weighted by effort duration).</p>
          <Bar label="Phosphagen (0-10s, explosive)" value={a.energy.phosphagen} color={ENERGY_COLOR.phosphagen} />
          <Bar label="Glycolytic (10s-2min)" value={a.energy.glycolytic} color={ENERGY_COLOR.glycolytic} />
          <Bar label="Oxidative (2min+, engine)" value={a.energy.oxidative} color={ENERGY_COLOR.oxidative} />
        </Panel>

        {/* Season rank breakdown */}
        <Panel className="p-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-2">Season Rank: how it is built</h3>
          <Bar label="2026 season form (50%)" value={w.season} color={PA_GREEN} />
          <Bar label={`Prior Games form (30%)${a.seasonRank.rookie ? ' - none (rookie)' : ''}`} value={w.priorForm} color="#a855f7" sub={a.seasonRank.rookie ? 'Rookies carry no prior-Games term; their band is widened, never imputed.' : undefined} />
          <Bar label={`Age factor (20%)${a.age ? ` - age ${a.age}` : ''}`} value={w.age} color="#14b8a6" />
          <div className="mt-2 pt-2 border-t border-[var(--panel-border-subtle)] flex items-baseline justify-between">
            <span className="text-[12px] text-[var(--text-secondary)]">Blended index</span>
            <span className="games-display text-xl text-[#91C640]">{a.seasonRank.score}</span>
          </div>
        </Panel>
      </div>

      {/* Strengths / weaknesses */}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <Panel className="p-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--accent-success)] mb-2">Strengths</h3>
          {a.strengths.map((s) => (
            <div key={s.key} className="mb-2.5 last:mb-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{s.label}</span>
                <span className="games-condensed text-[11px] text-[var(--text-muted)]">{s.pct}th percentile</span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {s.drivingEvents.map((e) => `${e.event} (${e.place === 1 ? 'won' : `${e.place}${e.place === 2 ? 'nd' : e.place === 3 ? 'rd' : 'th'}`})`).join(' . ')}
              </div>
            </div>
          ))}
        </Panel>
        <Panel className="p-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--accent-red)] mb-2">Relative weaknesses</h3>
          {a.weaknesses.map((s) => (
            <div key={s.key} className="mb-2.5 last:mb-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{s.label}</span>
                <span className="games-condensed text-[11px] text-[var(--text-muted)]">{s.pct}th percentile</span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {s.drivingEvents.map((e) => `${e.event} (${e.place}${e.place === 1 ? 'st' : e.place === 2 ? 'nd' : e.place === 3 ? 'rd' : 'th'})`).join(' . ')}
              </div>
            </div>
          ))}
        </Panel>
      </div>

      {/* Games history trend */}
      {games.length > 1 && (
        <Panel className="p-4 mt-4">
          <h3 className="games-condensed uppercase tracking-[0.12em] text-[12px] text-[var(--text-tertiary)] mb-2">CrossFit Games history (overall finish)</h3>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={games} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                <XAxis dataKey="year" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis reversed domain={[1, 'dataMax']} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`Finished ${v}`, 'Overall']}
                />
                <Line type="monotone" dataKey="overallRank" stroke={PA_GREEN} strokeWidth={2} dot={{ r: 3, fill: PA_GREEN }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Provenance */}
      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mt-4 max-w-2xl">
        <span className="text-[var(--text-tertiary)] font-semibold">How this is computed:</span> deterministically from {a.dataDepth.totalEvents} official event results
        {a.gamesHistory.length ? ` (2026 season + Games ${games[0].year}-${games[games.length - 1].year})` : ' (2026 Open + Quarterfinals)'}. No values are estimated or AI-generated; missing data (e.g. flexibility, body composition) is shown as unmeasured rather than invented.
      </p>
    </section>
  )
}
