import { useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, Legend, Line, ComposedChart,
} from 'recharts'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import { PHYSICAL_SKILL_LABELS } from '../data/movement-taxonomy'

const SKILL_COLORS: Record<string, string> = {
  'cardiovascular-endurance': '#f43f5e',
  'stamina': '#fb923c',
  'strength': '#3b82f6',
  'flexibility': '#a855f7',
  'power': '#ec4899',
  'speed': '#eab308',
  'coordination': '#10b981',
  'agility': '#06b6d4',
  'balance': '#6366f1',
  'accuracy': '#14b8a6',
}

export default function PhysicalSkills({ data, analysis }: { data: CrossFitData; analysis: AnalysisResults }) {
  const radarData = useMemo(() =>
    Object.entries(analysis.aggregateSkills).map(([skill, value]) => ({
      skill: PHYSICAL_SKILL_LABELS[skill as keyof typeof PHYSICAL_SKILL_LABELS] || skill,
      value,
      fullMark: 100,
    })),
    [analysis]
  )

  const barData = useMemo(() =>
    Object.entries(analysis.aggregateSkills)
      .map(([skill, value]) => ({
        name: PHYSICAL_SKILL_LABELS[skill as keyof typeof PHYSICAL_SKILL_LABELS] || skill,
        id: skill,
        value,
      }))
      .sort((a, b) => b.value - a.value),
    [analysis]
  )

  // Categorize: Organic (trained by doing) vs Neurological (trained by practice)
  const organic = ['cardiovascular-endurance', 'stamina', 'strength', 'flexibility']
  const neurological = ['coordination', 'agility', 'balance', 'accuracy']
  const both = ['power', 'speed']

  const organicAvg = organic.reduce((s, k) => s + (analysis.aggregateSkills[k as keyof typeof analysis.aggregateSkills] || 0), 0) / organic.length
  const neuroAvg = neurological.reduce((s, k) => s + (analysis.aggregateSkills[k as keyof typeof analysis.aggregateSkills] || 0), 0) / neurological.length
  const bothAvg = both.reduce((s, k) => s + (analysis.aggregateSkills[k as keyof typeof analysis.aggregateSkills] || 0), 0) / both.length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">10 General Physical Skills</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          CrossFit says fitness is competence in all 10 general physical skills.
          Here's which skills each workout actually trains.
        </p>
      </div>

      {/* Skill balance score */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-5 border border-blue-500/20">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Skill Balance Score</div>
          <div className="text-3xl font-bold font-mono text-blue-400">
            {((1 - analysis.skillBalance) * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">100% = perfectly balanced across all 10 skills</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Organic Skills Avg</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{organicAvg.toFixed(0)}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Endurance, Stamina, Strength, Flexibility</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Improved by training (doing)</div>
        </div>
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Neurological Skills Avg</div>
          <div className="text-2xl font-bold font-mono text-amber-400">{neuroAvg.toFixed(0)}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Coordination, Agility, Balance, Accuracy</div>
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Improved by practice</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Radar */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Skill Radar - Overall Programming</h3>
          <div style={{width:"100%",height:380}}><ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
              <PolarRadiusAxis tick={false} domain={[0, 100]} axisLine={false} />
              <Radar dataKey="value" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer></div>
        </div>

        {/* Bar chart */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Skill Emphasis Ranking</h3>
          <div style={{width:"100%",height:380}}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} width={115} />
              <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {barData.map((e) => (
                  <Cell key={e.id} fill={SKILL_COLORS[e.id] || '#6b7280'} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </div>
      </div>

      {/* Skill category breakdown */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-4">Skill Classification (per CrossFit's Model)</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-xs font-medium text-emerald-400 mb-2">Organic Adaptations (Train by Doing)</div>
            {organic.map((s) => (
              <div key={s} className="flex items-center justify-between py-1.5 border-b border-[var(--panel-border)] last:border-0">
                <span className="text-xs text-[var(--text-secondary)]">{PHYSICAL_SKILL_LABELS[s as keyof typeof PHYSICAL_SKILL_LABELS]}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded bg-[var(--panel-bg-hover)]">
                    <div className="h-full rounded bg-emerald-400/70" style={{ width: `${analysis.aggregateSkills[s as keyof typeof analysis.aggregateSkills]}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] w-8 text-right">{analysis.aggregateSkills[s as keyof typeof analysis.aggregateSkills].toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-medium text-amber-400 mb-2">Neurological Adaptations (Train by Practice)</div>
            {neurological.map((s) => (
              <div key={s} className="flex items-center justify-between py-1.5 border-b border-[var(--panel-border)] last:border-0">
                <span className="text-xs text-[var(--text-secondary)]">{PHYSICAL_SKILL_LABELS[s as keyof typeof PHYSICAL_SKILL_LABELS]}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded bg-[var(--panel-bg-hover)]">
                    <div className="h-full rounded bg-amber-400/70" style={{ width: `${analysis.aggregateSkills[s as keyof typeof analysis.aggregateSkills]}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] w-8 text-right">{analysis.aggregateSkills[s as keyof typeof analysis.aggregateSkills].toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-medium text-rose-400 mb-2">Both Organic & Neurological</div>
            {both.map((s) => (
              <div key={s} className="flex items-center justify-between py-1.5 border-b border-[var(--panel-border)] last:border-0">
                <span className="text-xs text-[var(--text-secondary)]">{PHYSICAL_SKILL_LABELS[s as keyof typeof PHYSICAL_SKILL_LABELS]}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded bg-[var(--panel-bg-hover)]">
                    <div className="h-full rounded bg-rose-400/70" style={{ width: `${analysis.aggregateSkills[s as keyof typeof analysis.aggregateSkills]}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] w-8 text-right">{analysis.aggregateSkills[s as keyof typeof analysis.aggregateSkills].toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skills over time */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
        <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Skill Emphasis Evolution Over Time</h3>
        <div style={{width:"100%",height:300}}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={analysis.skillsByYear}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} interval={3} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 11 }} />
            {Object.entries(SKILL_COLORS).map(([key, color]) => (
              <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.5} />
            ))}
          </AreaChart>
        </ResponsiveContainer></div>
        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {Object.entries(SKILL_COLORS).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              {PHYSICAL_SKILL_LABELS[key as keyof typeof PHYSICAL_SKILL_LABELS]?.split('/')[0] || key}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
