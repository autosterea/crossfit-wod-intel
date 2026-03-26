import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
  LineChart, Line, Legend,
} from 'recharts'
import type { CrossFitData } from '../types'
import { analyzeAllRepsAndLoading } from '../utils/rep-extractor'

const SCHEME_TYPE_COLORS: Record<string, string> = {
  descending: '#f43f5e',
  fixed: '#3b82f6',
  ascending: '#10b981',
  pyramid: '#f59e0b',
  emom: '#06b6d4',
  tabata: '#ec4899',
  amrap: '#a855f7',
  other: '#6b7280',
}

const SCHEME_TYPE_LABELS: Record<string, string> = {
  descending: 'Descending',
  fixed: 'Fixed Sets',
  ascending: 'Ascending',
  pyramid: 'Pyramid',
  emom: 'EMOM',
  tabata: 'Tabata',
  amrap: 'AMRAP',
  other: 'Other',
}

const INTENSITY_COLORS: Record<string, string> = {
  strength: '#f43f5e',
  power: '#f59e0b',
  hypertrophy: '#3b82f6',
  endurance: '#10b981',
  metabolic: '#a855f7',
  mixed: '#6b7280',
}

const INTENSITY_LABELS: Record<string, string> = {
  strength: 'Strength',
  power: 'Power',
  hypertrophy: 'Hypertrophy',
  endurance: 'Endurance',
  metabolic: 'Metabolic',
  mixed: 'Mixed',
}

const WEIGHT_BAR_COLORS = ['#6b7280', '#06b6d4', '#10b981', '#3b82f6', '#f59e0b', '#f43f5e']

const TOP_SCHEME_COLORS = [
  '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#64748b', '#fb923c',
  '#14b8a6', '#8b5cf6', '#e11d48', '#0ea5e9', '#d946ef',
]

const tooltipStyle = {
  background: '#1e1e3a',
  border: '1px solid #2a2a5a',
  borderRadius: 8,
  fontSize: 12,
}

export default function RepsAndLoading({ data }: { data: CrossFitData }) {
  const analysis = useMemo(() => analyzeAllRepsAndLoading(data.searchIndex), [data])

  const schemeTypePieData = useMemo(() =>
    Object.entries(analysis.schemeTypes)
      .map(([type, count]) => ({
        name: SCHEME_TYPE_LABELS[type] || type,
        id: type,
        value: count,
      }))
      .sort((a, b) => b.value - a.value),
    [analysis],
  )

  const intensityPieData = useMemo(() =>
    Object.entries(analysis.intensityZones)
      .map(([zone, count]) => ({
        name: INTENSITY_LABELS[zone] || zone,
        id: zone,
        value: count,
      }))
      .sort((a, b) => b.value - a.value),
    [analysis],
  )

  const topSchemeLabel = analysis.topSchemes[0]?.pattern || 'N/A'
  const topWeightRange = [...analysis.weightDistribution].sort((a, b) => b.count - a.count)[0]?.range || 'N/A'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Reps & Loading Prescription Analysis</h2>
        <p className="text-sm text-slate-400 mt-1">
          We scanned every workout description to extract rep schemes (21-15-9, 5x5, etc.) and loading
          prescriptions (135 lbs, 95/65, etc.). This shows how CrossFit programs volume and intensity.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-5 border border-blue-500/20">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg Reps / Workout</div>
          <div className="text-3xl font-bold font-mono text-blue-400">{analysis.avgTotalReps.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1">Estimated total reps per WOD</div>
        </div>
        <div className="bg-gradient-to-br from-rose-500/10 to-orange-500/10 rounded-xl p-5 border border-rose-500/20">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Avg Prescribed Weight</div>
          <div className="text-3xl font-bold font-mono text-rose-400">
            {analysis.avgWeight > 0 ? `${analysis.avgWeight} lb` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Average load across all WODs with Rx weights</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-5 border border-purple-500/20">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Most Common Scheme</div>
          <div className="text-2xl font-bold font-mono text-purple-400">{topSchemeLabel}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {analysis.topSchemes[0] ? `${analysis.topSchemes[0].count} appearances` : ''}
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-5 border border-emerald-500/20">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Most Common Weight</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{topWeightRange}</div>
          <div className="text-[10px] text-slate-400 mt-1">Most frequently prescribed load range</div>
        </div>
      </div>

      {/* Top Rep Schemes bar chart */}
      <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
        <h3 className="text-xs font-medium text-slate-400 mb-1">Top 15 Rep Schemes</h3>
        <p className="text-[10px] text-slate-500 mb-4">
          The most frequently appearing rep patterns across all workout descriptions.
        </p>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analysis.topSchemes} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis
                dataKey="pattern"
                type="category"
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }}
                width={100}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {analysis.topSchemes.map((_, i) => (
                  <Cell key={i} fill={TOP_SCHEME_COLORS[i % TOP_SCHEME_COLORS.length]} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rep Scheme Types + Intensity Zones — side by side donut charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Scheme Types Pie */}
        <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
          <h3 className="text-xs font-medium text-slate-400 mb-3">Rep Scheme Types</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={schemeTypePieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={55}
                  strokeWidth={0}
                  label={({ name, value }: any) => `${name} ${value}`}
                >
                  {schemeTypePieData.map((e) => (
                    <Cell key={e.id} fill={SCHEME_TYPE_COLORS[e.id] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {schemeTypePieData.map((e) => (
              <span key={e.id} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ background: SCHEME_TYPE_COLORS[e.id] || '#6b7280' }} />
                {e.name}
              </span>
            ))}
          </div>
        </div>

        {/* Intensity Zones Pie */}
        <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
          <h3 className="text-xs font-medium text-slate-400 mb-3">Intensity Zones</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={intensityPieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={55}
                  strokeWidth={0}
                  label={({ name, value }: any) => `${name} ${value}`}
                >
                  {intensityPieData.map((e) => (
                    <Cell key={e.id} fill={INTENSITY_COLORS[e.id] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {intensityPieData.map((e) => (
              <span key={e.id} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ background: INTENSITY_COLORS[e.id] || '#6b7280' }} />
                {e.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Weight Distribution */}
      <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
        <h3 className="text-xs font-medium text-slate-400 mb-1">Weight Distribution</h3>
        <p className="text-[10px] text-slate-500 mb-4">
          How many workouts prescribe each weight range. Includes men's Rx weight from M/F prescriptions (e.g., 135/95).
        </p>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analysis.weightDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {analysis.weightDistribution.map((_, i) => (
                  <Cell key={i} fill={WEIGHT_BAR_COLORS[i % WEIGHT_BAR_COLORS.length]} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trends Over Time */}
      <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
        <h3 className="text-xs font-medium text-slate-400 mb-1">Trends Over Time</h3>
        <p className="text-[10px] text-slate-500 mb-4">
          How average reps per workout and average prescribed weight have changed year to year.
        </p>
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analysis.repsByYear}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#64748b' }} interval={2} />
              <YAxis yAxisId="reps" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis yAxisId="weight" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => <span style={{ color: '#94a3b8' }}>{value}</span>}
              />
              <Line
                yAxisId="reps"
                type="monotone"
                dataKey="avgReps"
                name="Avg Reps"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6' }}
              />
              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="avgWeight"
                name="Avg Weight (lb)"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f43f5e' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-6 mt-2 justify-center">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-3 h-0.5 rounded" style={{ background: '#3b82f6', display: 'inline-block' }} />
            Avg Reps per Workout (left axis)
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-3 h-0.5 rounded" style={{ background: '#f43f5e', display: 'inline-block' }} />
            Avg Prescribed Weight in lbs (right axis)
          </span>
        </div>
      </div>

      {/* Explainer section */}
      <div className="bg-gradient-to-r from-[#12121a] to-[#16162a] rounded-xl p-6 border border-[#1e1e3a]">
        <h3 className="text-sm font-bold text-white mb-3">Understanding Intensity Zones</h3>
        <div className="grid grid-cols-3 gap-6 text-xs text-slate-400 leading-relaxed">
          <div>
            <div className="font-medium text-rose-400 mb-1">Strength (1-5 reps, heavy)</div>
            <p>
              Low-rep, high-load work targeting maximal force production. Builds absolute strength
              through heavy back squats, deadlifts, and presses. Requires long rest periods (3-5 min)
              for full neural recovery between sets.
            </p>
          </div>
          <div>
            <div className="font-medium text-amber-400 mb-1">Power (1-5 reps, explosive)</div>
            <p>
              Olympic lifting and explosive movements at moderate-to-heavy loads. Develops rate of
              force development — how fast you can generate strength. Snatches, cleans, jerks, and
              plyometrics live here.
            </p>
          </div>
          <div>
            <div className="font-medium text-blue-400 mb-1">Hypertrophy (6-12 reps)</div>
            <p>
              Moderate reps and loads that maximize time under tension. While not CrossFit's primary
              goal, this zone builds the muscle mass that supports both strength and endurance. Common
              in accessory work and some benchmark WODs.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 text-xs text-slate-400 leading-relaxed mt-4">
          <div>
            <div className="font-medium text-emerald-400 mb-1">Endurance (12-20 reps)</div>
            <p>
              Higher rep ranges that develop muscular endurance and lactate tolerance. Common in
              moderate-length WODs with movements like wall balls, kettlebell swings, and pull-ups.
              Bridges the gap between pure strength and full metabolic conditioning.
            </p>
          </div>
          <div>
            <div className="font-medium text-purple-400 mb-1">Metabolic (20+ reps / AMRAP / For Time)</div>
            <p>
              High-volume conditioning work that pushes all energy systems simultaneously. Classic
              CrossFit territory — "Fran," "Murph," AMRAPs, and long chippers. Develops the
              cardiovascular engine and mental toughness that define CrossFit fitness.
            </p>
          </div>
          <div>
            <div className="font-medium text-slate-400 mb-1">Mixed</div>
            <p>
              Workouts that blend multiple intensity zones or don't fit neatly into one category.
              EMOMs with varying rep schemes, complexes that mix heavy and light work, or
              workouts with insufficient data to classify. CrossFit's hallmark is constant variation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
