import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import { ENERGY_SYSTEM_LABELS, ENERGY_SYSTEM_COLORS, ENERGY_SYSTEM_DESCRIPTIONS, type EnergySystem } from '../data/movement-taxonomy'

export default function EnergySystems({ data, analysis }: { data: CrossFitData; analysis: AnalysisResults }) {
  const pieData = useMemo(() =>
    Object.entries(analysis.energySystems)
      .map(([system, count]) => ({
        name: ENERGY_SYSTEM_LABELS[system as EnergySystem],
        id: system,
        value: count,
        pct: +((count / data.overview.total_workouts) * 100).toFixed(1),
      }))
      .sort((a, b) => b.value - a.value),
    [analysis, data]
  )

  const workCapData = analysis.workCapacity

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Energy Systems & Work Capacity</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          CrossFit trains all three metabolic pathways. Every workout here is tagged by the energy system it hits hardest.
        </p>
      </div>

      {/* Energy system cards */}
      <div className="grid grid-cols-4 gap-3">
        {pieData.map((es) => (
          <div key={es.id} className="rounded-xl p-5 border" style={{ background: ENERGY_SYSTEM_COLORS[es.id as EnergySystem] + '10', borderColor: ENERGY_SYSTEM_COLORS[es.id as EnergySystem] + '30' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ background: ENERGY_SYSTEM_COLORS[es.id as EnergySystem] }} />
              <span className="text-xs font-medium text-[var(--text-primary)]">{es.name}</span>
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: ENERGY_SYSTEM_COLORS[es.id as EnergySystem] }}>
              {es.value.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--text-tertiary)] mb-2">{es.pct}% of all WODs</div>
            <div className="text-[9px] text-[var(--text-muted)] leading-relaxed">
              {ENERGY_SYSTEM_DESCRIPTIONS[es.id as EnergySystem]}
            </div>
          </div>
        ))}
      </div>

      {/* Energy balance + Work capacity */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pie */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-[var(--text-tertiary)]">Energy System Distribution</h3>
            <span className="text-xs font-mono text-blue-400">
              Balance: {((1 - analysis.energyBalance) * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{width:"100%",height:300}}><ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={110} innerRadius={60} strokeWidth={0} label={({ name, value }: any) => `${String(name).split(' ')[0]} ${value}`}>
                {pieData.map((e) => (
                  <Cell key={e.id} fill={ENERGY_SYSTEM_COLORS[e.id as EnergySystem]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer></div>
        </div>

        {/* Work capacity by time domain */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Work Capacity Across Time Domains</h3>
          <div style={{width:"100%",height:300}}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={workCapData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="domain" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
              <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {workCapData.map((e, i) => (
                  <Cell key={e.domain} fill={['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#06b6d4'][i]} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
          <div className="mt-3 text-[10px] text-[var(--text-muted)] text-center">
            CrossFit aims for broad work capacity across ALL time domains - sprint to endurance
          </div>
        </div>
      </div>

      {/* Energy systems over time */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Energy System Emphasis Over Time (%)</h3>
        <div style={{width:"100%",height:300}}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={analysis.energyByYear}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} interval={2} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 11 }} />
            {Object.entries(ENERGY_SYSTEM_COLORS).map(([key, color]) => (
              <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer></div>
        <div className="flex gap-4 mt-3 justify-center">
          {Object.entries(ENERGY_SYSTEM_COLORS).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {ENERGY_SYSTEM_LABELS[key as EnergySystem]}
            </span>
          ))}
        </div>
      </div>

      {/* Explanation panel */}
      <div className="bg-gradient-to-r from-[var(--panel-bg)] to-[var(--panel-bg-2)] rounded-xl p-6 border border-[var(--panel-border)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Understanding Energy Systems</h3>
        <div className="grid grid-cols-3 gap-6 text-xs text-[var(--text-tertiary)] leading-relaxed">
          <div>
            <div className="font-medium text-rose-400 mb-1">Phosphagen (ATP-CP)</div>
            <p>Immediate energy for max-effort lifts. Fuels 1RM attempts, short heavy sets. Depletes in ~10 seconds. Full recovery needs 3-5 minutes. CrossFit tests this with strength days and heavy singles.</p>
          </div>
          <div>
            <div className="font-medium text-amber-400 mb-1">Glycolytic</div>
            <p>Burns glucose without oxygen for intense bursts of 10 seconds to ~2 minutes. Produces lactate ("the burn"). Powers workouts like Fran, Grace, and sprint WODs. Recovery in 1-3 minutes.</p>
          </div>
          <div>
            <div className="font-medium text-emerald-400 mb-1">Oxidative (Aerobic)</div>
            <p>Sustained aerobic effort using oxygen to burn fat and carbs. Dominates in workouts over 2 minutes - Murph, long chippers, endurance pieces. The foundation of fitness and recovery capacity.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
