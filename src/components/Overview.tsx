import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import type { CrossFitData } from '../types'
import { MODALITY_COLORS, STRUCTURE_COLORS, TIME_DOMAIN_COLORS } from '../utils/colors'

function StatCard({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a] hover:border-[#2a2a5a] transition-colors">
      <div className={`text-3xl font-bold font-mono ${accent || 'text-white'}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  )
}

function MiniPie({ data, colors, title }: { data: Record<string, number>; colors: Record<string, string>; title: string }) {
  const entries = useMemo(() =>
    Object.entries(data)
      .filter(([k]) => k !== 'Unknown')
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
    [data]
  )

  return (
    <div className="bg-[#12121a] rounded-xl p-4 border border-[#1e1e3a]">
      <h3 className="text-xs font-medium text-slate-400 mb-2">{title}</h3>
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={entries} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={35} strokeWidth={0}>
              {entries.map((e) => (
                <Cell key={e.name} fill={colors[e.name] || '#6b7280'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1e1e3a', border: '1px solid #2a2a5a', borderRadius: 8, fontSize: 12 }}
              formatter={(value: any, name: any) => [Number(value).toLocaleString(), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {entries.slice(0, 5).map((e) => (
          <div key={e.name} className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <div className="w-2 h-2 rounded-full" style={{ background: colors[e.name] || '#6b7280' }} />
            {e.name}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Overview({ data }: { data: CrossFitData }) {
  const { overview, trends } = data

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
        <h2 className="text-2xl font-bold text-white">CrossFit WOD Intelligence</h2>
        <p className="text-sm text-slate-400 mt-1">25 years of programming data — analyzed and visualized</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard value={overview.total_workouts.toLocaleString()} label="Total Workouts" accent="text-blue-400" />
        <StatCard value={overview.years_covered.toString()} label="Years Covered" accent="text-purple-400" />
        <StatCard value={overview.hero_wod_count.toLocaleString()} label="Hero WODs" accent="text-rose-400" />
        <StatCard value={overview.benchmark_count.toLocaleString()} label="Benchmarks" accent="text-amber-400" />
        <StatCard value={overview.named_wod_count.toLocaleString()} label="Named WODs" accent="text-emerald-400" />
        <StatCard value={overview.total_rest_days.toLocaleString()} label="Rest Days" accent="text-slate-400" />
      </div>

      {/* Today's WOD */}
      {data.todaysWod && (
        <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-rose-500/10 rounded-xl p-5 border border-[#2a2a5a]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-medium text-green-400">Today's WOD</span>
            <span className="text-xs text-slate-500">{data.todaysWod.date}</span>
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed max-h-32 overflow-y-auto">
            {data.todaysWod.wod_raw?.split('\n').slice(0, 6).join('\n')}
          </p>
          <div className="flex gap-2 mt-3">
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-blue-300">{data.todaysWod.modality}</span>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-500/20 text-purple-300">{data.todaysWod.structure}</span>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300">{data.todaysWod.time_domain}</span>
          </div>
        </div>
      )}

      {/* Pie charts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniPie data={overview.modality} colors={MODALITY_COLORS} title="Modality Distribution" />
        <MiniPie data={overview.structure} colors={STRUCTURE_COLORS} title="Workout Structure" />
        <MiniPie data={overview.time_domain} colors={TIME_DOMAIN_COLORS} title="Time Domain" />
        <MiniPie data={overview.load_profile} colors={{ 'Bodyweight Only': '#10b981', 'Moderate': '#3b82f6', 'Heavy': '#f43f5e', 'Light': '#f59e0b', 'Mixed': '#a855f7', 'Unknown': '#6b7280' }} title="Load Profile" />
      </div>

      {/* Yearly trend */}
      <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Workouts Per Year</h3>
        <div style={{width:"100%",height:200}}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={yearlyTrend}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#64748b' }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip contentStyle={{ background: '#1e1e3a', border: '1px solid #2a2a5a', borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="count" stroke="#60a5fa" fill="url(#areaGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer></div>
      </div>

      {/* Top movements */}
      <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Top 20 Movements</h3>
        <div style={{width:"100%",height:500}}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={movementData} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={115} />
            <Tooltip
              contentStyle={{ background: '#1e1e3a', border: '1px solid #2a2a5a', borderRadius: 8, fontSize: 12 }}
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
          <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="w-3 h-3 rounded bg-rose-500/70" />Monostructural</span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="w-3 h-3 rounded bg-emerald-500/70" />Gymnastics</span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="w-3 h-3 rounded bg-blue-500/70" />Weightlifting</span>
        </div>
      </div>

      {/* Modality Trend */}
      <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Modality Trends Over Time</h3>
        <div style={{width:"100%",height:250}}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends.modality}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#64748b' }} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip contentStyle={{ background: '#1e1e3a', border: '1px solid #2a2a5a', borderRadius: 8, fontSize: 12 }} />
            {Object.entries(MODALITY_COLORS).filter(([k]) => k !== 'Unknown').map(([key, color]) => (
              <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer></div>
      </div>
    </div>
  )
}
