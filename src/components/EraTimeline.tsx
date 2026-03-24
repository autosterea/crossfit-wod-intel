import { useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  Legend,
} from 'recharts'
import type { CrossFitData } from '../types'
import { MODALITY_COLORS, STRUCTURE_COLORS } from '../utils/colors'

const ERA_COLORS = ['#60a5fa', '#a855f7', '#f43f5e', '#10b981', '#f59e0b']

export default function EraTimeline({ data }: { data: CrossFitData }) {
  const [selectedEra, setSelectedEra] = useState<number>(0)
  const era = data.eras[selectedEra]

  const radarData = [
    { axis: 'Mono (M)', ...Object.fromEntries(data.eras.map((e, i) => [e.name, e.pct_M])) },
    { axis: 'Gym (G)', ...Object.fromEntries(data.eras.map((e, i) => [e.name, e.pct_G])) },
    { axis: 'Weight (W)', ...Object.fromEntries(data.eras.map((e, i) => [e.name, e.pct_W])) },
    { axis: 'M+G', ...Object.fromEntries(data.eras.map((e, i) => [e.name, e.pct_MG])) },
    { axis: 'M+W', ...Object.fromEntries(data.eras.map((e, i) => [e.name, e.pct_MW])) },
    { axis: 'G+W', ...Object.fromEntries(data.eras.map((e, i) => [e.name, e.pct_GW])) },
    { axis: 'All Three', ...Object.fromEntries(data.eras.map((e, i) => [e.name, e.pct_MGW])) },
  ]

  const movementData = Object.entries(era.top_movements)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name: data.movementDisplay[name] || name,
      count,
      modality: data.movementModality[name] || 'G',
    }))

  const structureData = Object.entries(era.structure)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">CrossFit Era Evolution</h2>
        <p className="text-sm text-slate-400 mt-1">How CrossFit programming has evolved across distinct eras</p>
      </div>

      {/* Era selector cards */}
      <div className="grid grid-cols-4 gap-3">
        {data.eras.map((e, i) => (
          <button
            key={e.name}
            onClick={() => setSelectedEra(i)}
            className={`text-left p-4 rounded-xl border transition-all ${
              selectedEra === i
                ? 'border-blue-500/50 ring-1 ring-blue-500/20'
                : 'border-[#1e1e3a] hover:border-[#2a2a5a]'
            }`}
            style={{ background: selectedEra === i ? ERA_COLORS[i] + '15' : '#12121a' }}
          >
            <div className="text-sm font-bold text-white">{e.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{e.range}</div>
            <div className="text-lg font-bold font-mono mt-2" style={{ color: ERA_COLORS[i] }}>
              {e.workout_count.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500">workouts</div>
          </button>
        ))}
      </div>

      {/* Era detail */}
      <div className="bg-gradient-to-r from-[#12121a] to-[#16162a] rounded-xl p-6 border border-[#1e1e3a]">
        <h3 className="text-lg font-bold text-white mb-1">{era.name} <span className="text-sm text-slate-400 font-normal">({era.range})</span></h3>
        <p className="text-sm text-slate-400 leading-relaxed">{era.desc}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Radar comparison */}
        <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
          <h4 className="text-xs font-medium text-slate-400 mb-3">Modality Comparison — All Eras</h4>
          <div style={{width:"100%",height:350}}><ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e1e3a" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: '#64748b' }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              {data.eras.map((e, i) => (
                <Radar
                  key={e.name}
                  name={e.name}
                  dataKey={e.name}
                  stroke={ERA_COLORS[i]}
                  fill={ERA_COLORS[i]}
                  fillOpacity={selectedEra === i ? 0.15 : 0.02}
                  strokeWidth={selectedEra === i ? 2.5 : 1}
                  strokeOpacity={selectedEra === i ? 1 : 0.3}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => <span className="text-slate-400">{value}</span>}
              />
            </RadarChart>
          </ResponsiveContainer></div>
        </div>

        {/* Top movements for era */}
        <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
          <h4 className="text-xs font-medium text-slate-400 mb-3">Top Movements — {era.name}</h4>
          <div style={{width:"100%",height:350}}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={movementData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={95} />
              <Tooltip contentStyle={{ background: '#1e1e3a', border: '1px solid #2a2a5a', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {movementData.map((e) => (
                  <Cell key={e.name} fill={e.modality === 'M' ? '#f43f5e' : e.modality === 'G' ? '#10b981' : '#3b82f6'} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </div>
      </div>

      {/* Structure breakdown */}
      <div className="bg-[#12121a] rounded-xl p-5 border border-[#1e1e3a]">
        <h4 className="text-xs font-medium text-slate-400 mb-3">Workout Structure — {era.name}</h4>
        <div style={{width:"100%",height:200}}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={structureData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip contentStyle={{ background: '#1e1e3a', border: '1px solid #2a2a5a', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {structureData.map((e) => (
                <Cell key={e.name} fill={STRUCTURE_COLORS[e.name] || '#6b7280'} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>
      </div>

      {/* Modality grid */}
      <div className="grid grid-cols-7 gap-2">
        {(['M', 'G', 'W', 'MG', 'MW', 'GW', 'MGW'] as const).map((mod) => {
          const key = `pct_${mod}` as keyof typeof era
          const val = era[key] as number
          return (
            <div key={mod} className="bg-[#12121a] rounded-lg p-3 border border-[#1e1e3a] text-center">
              <div className="text-lg font-bold font-mono" style={{ color: MODALITY_COLORS[mod] }}>{val}%</div>
              <div className="text-[10px] text-slate-500">{mod}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
