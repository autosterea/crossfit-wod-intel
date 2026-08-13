import { useMemo } from 'react'
import {
  ResponsiveContainer, Tooltip, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import type { CrossFitData } from '../types'
import { MODALITY_COLORS, MODALITY_LABELS, STRUCTURE_COLORS, TIME_DOMAIN_COLORS } from '../utils/colors'

const LOAD_PROFILE_COLORS: Record<string, string> = {
  'Bodyweight Only': '#10b981',
  'Moderate': '#3b82f6',
  'Heavy': '#f43f5e',
  'Light': '#f59e0b',
  'Mixed': '#a855f7',
  'Unknown': '#6b7280',
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)] hover:border-[var(--panel-border-strong)] transition-colors">
      <div className="text-3xl font-bold font-mono text-[var(--text-primary)]">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mt-1">{label}</div>
    </div>
  )
}

function DistributionBar({ data, colors, labels, title }: { data: Record<string, number>; colors: Record<string, string>; labels?: Record<string, string>; title: string }) {
  const entries = useMemo(() => {
    const list = Object.entries(data)
      .filter(([k]) => k !== 'Unknown')
      .sort((a, b) => b[1] - a[1])
    const total = list.reduce((sum, [, v]) => sum + v, 0)
    return list.map(([name, value]) => ({
      name,
      label: labels?.[name] || name,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
  }, [data, labels])

  return (
    <div className="bg-[var(--panel-bg)] rounded-xl p-4 border border-[var(--panel-border)]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">{title}</h3>
      <div className="flex h-3 rounded-full overflow-hidden">
        {entries.map((e) => (
          <div
            key={e.name}
            title={`${e.label} - ${e.value.toLocaleString()} (${e.pct.toFixed(1)}%)`}
            style={{ width: `${e.pct}%`, background: colors[e.name] || '#6b7280' }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {entries.slice(0, 5).map((e) => (
          <div key={e.name} className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[e.name] || '#6b7280' }} />
            <span>{e.label}</span>
            <span className="font-mono text-[var(--text-muted)]">{e.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Overview({ data }: { data: CrossFitData }) {
  const { overview, trends } = data
  // Mirror DailyWod's rest-day detection so the banner never shows raw scrape text on article days
  const tw = data.todaysWod
  const todayIsRest = !!tw && !((tw.movements?.length ?? 0) > 0 || tw.modality !== 'Unknown' || /(amrap|emom|for time|rounds|reps|tabata)/i.test(tw.wod_raw || ''))

  const movementData = useMemo(() =>
    Object.entries(overview.movement_frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({
        name: data.movementDisplay[name] || name,
        count,
        pct: ((count / overview.total_workouts) * 100).toFixed(1),
        modality: data.movementModality[name] || 'G',
      })),
    [overview, data]
  )

  const yearlyTrend = useMemo(() =>
    Object.entries(data.yearData)
      .map(([year, d]: [string, any]) => ({ year, count: d.workout_count }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    [data]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl text-[var(--text-primary)]" style={{ fontFamily: "'Anton', sans-serif", letterSpacing: '0.5px' }}>CROSSFIT WOD INTELLIGENCE</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">{overview.years_covered} years of crossfit.com programming, decoded day by day</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard value={overview.total_workouts.toLocaleString()} label="Total Workouts" />
        <StatCard value={overview.years_covered.toString()} label="Years Covered" />
        <StatCard value={overview.hero_wod_count.toLocaleString()} label="Hero WODs" />
        <StatCard value={overview.benchmark_count.toLocaleString()} label="Benchmarks" />
        <StatCard value={overview.named_wod_count.toLocaleString()} label="Named WODs" />
        <StatCard value={overview.total_rest_days.toLocaleString()} label="Rest Days" />
      </div>

      {/* Today's WOD */}
      {data.todaysWod && (
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)] border-l-2 border-l-[#019644]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#019644] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#019644]">{todayIsRest ? 'Today - Rest Day' : "Today's WOD"}</span>
            <span className="text-xs text-[var(--text-muted)]">{data.todaysWod.date}</span>
          </div>
          {todayIsRest ? (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              crossfit.com posted an article instead of a workout today. The most recent workout is on the Today's WOD tab.
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed max-h-32 overflow-y-auto">
                {data.todaysWod.wod_raw?.split('\n').slice(0, 6).join('\n')}
              </p>
              <div className="flex gap-2 mt-3">
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[var(--text-secondary)]">{data.todaysWod.modality}</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[var(--text-secondary)]">{data.todaysWod.structure}</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-[var(--panel-bg-2)] border border-[var(--panel-border)] text-[var(--text-secondary)]">{data.todaysWod.time_domain}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Distribution bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DistributionBar data={overview.modality} colors={MODALITY_COLORS} labels={MODALITY_LABELS} title="Modality" />
        <DistributionBar data={overview.structure} colors={STRUCTURE_COLORS} title="Workout Structure" />
        <DistributionBar data={overview.time_domain} colors={TIME_DOMAIN_COLORS} title="Time Domain" />
        <DistributionBar data={overview.load_profile} colors={LOAD_PROFILE_COLORS} title="Load Profile" />
      </div>

      {/* Yearly trend */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Workouts Per Year</h3>
        <div style={{width:"100%",height:200}}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={yearlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="count" stroke="#019644" fill="#01964433" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer></div>
      </div>

      {/* Top movements */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Top 20 Movements</h3>
        <div style={{width:"100%",height:500}}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={movementData} layout="vertical" margin={{ left: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} width={115} />
            <Tooltip
              contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }}
              formatter={(value: any) => [Number(value).toLocaleString() + ' WODs']}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {movementData.map((e) => (
                <Cell key={e.name} fill={e.modality === 'M' ? '#f43f5e' : e.modality === 'G' ? '#10b981' : '#3b82f6'} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>
        <div className="flex gap-4 mt-3 justify-center">
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]"><span className="w-3 h-3 rounded bg-rose-500/70" />Monostructural</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]"><span className="w-3 h-3 rounded bg-emerald-500/70" />Gymnastics</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]"><span className="w-3 h-3 rounded bg-blue-500/70" />Weightlifting</span>
        </div>
      </div>

      {/* Modality Trend */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Modality Trends Over Time</h3>
        <div style={{width:"100%",height:250}}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends.modality}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} />
            {Object.entries(MODALITY_COLORS).filter(([k]) => k !== 'Unknown').map(([key, color]) => (
              <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer></div>
      </div>
    </div>
  )
}
