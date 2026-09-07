import { useMemo } from 'react'
import {
  ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import type { CrossFitData } from '../types'
import type { AnalysisResults } from '../utils/analysis'
import { ENERGY_SYSTEM_LABELS, ENERGY_SYSTEM_COLORS, ENERGY_SYSTEM_DESCRIPTIONS, type EnergySystem } from '../data/movement-taxonomy'

const ES_ORDER: EnergySystem[] = ['phosphagen', 'glycolytic', 'oxidative', 'mixed']

export default function EnergySystems({ data, analysis }: { data: CrossFitData; analysis: AnalysisResults }) {
  const distData = useMemo(() =>
    Object.entries(analysis.energySystems)
      .map(([system, count]) => ({
        name: ENERGY_SYSTEM_LABELS[system as EnergySystem],
        id: system as EnergySystem,
        value: count,
        pct: +((count / data.overview.total_workouts) * 100).toFixed(1),
      }))
      .sort((a, b) => b.value - a.value),
    [analysis, data]
  )

  // Fixed physiological order (short burst -> long effort -> mixed) for the stacked bar
  const orderedDist = useMemo(
    () => ES_ORDER.map((id) => distData.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d),
    [distData]
  )

  const workCapData = analysis.workCapacity
  const evenness = ((1 - analysis.energyBalance) * 100).toFixed(0)

  // Coach takeaways - every number derived from the live distribution, nothing hardcoded
  const takeaways = useMemo(() => {
    const byId = Object.fromEntries(distData.map((d) => [d.id, d]))
    const ox = byId['oxidative']
    const phos = byId['phosphagen']
    const top = distData[0]
    const bottom = distData[distData.length - 1]
    const topDomain = workCapData[0]
    const list: { claim: string; action: string }[] = []

    if (ox && ox.pct > 0) {
      const oneIn = Math.round(100 / ox.pct)
      list.push(
        ox.pct < 20
          ? {
              claim: `Pure aerobic work is only ${ox.pct}% of programming.`,
              action: `That is roughly 1 WOD in ${oneIn}, so the long engine is on you - add one 30-60 minute Zone 2 piece each week and treat it as training, not recovery.`,
            }
          : {
              claim: `Aerobic work carries ${ox.pct}% of programming.`,
              action: `The engine gets regular attention here - protect those longer pieces by pacing the first half honestly instead of racing out and fading.`,
            }
      )
    }

    if (phos && phos.pct > 0) {
      const oneIn = Math.round(100 / phos.pct)
      list.push({
        claim: `Max effort lives on about 1 day in ${oneIn}.`,
        action: `Phosphagen days are ${phos.pct}% of the split - when a heavy single or short sprint shows up, load it honestly instead of turning it into a metcon.`,
      })
    }

    if (top && bottom && top.id !== bottom.id) {
      list.push({
        claim: `${top.name} leads the split at ${top.pct}%; ${bottom.name.toLowerCase()} trails at ${bottom.pct}%.`,
        action: `If you only do the main WOD, put your extra credit in the trailing zone - that is the gap the whiteboard will not close for you.`,
      })
    }

    if (topDomain) {
      list.push({
        claim: `${topDomain.pct}% of time-stamped WODs land in the ${topDomain.domain.toLowerCase()} window.`,
        action: `Know your sustainable pace for that duration before you need it - it is the time domain you will be tested in most often.`,
      })
    }

    return list.slice(0, 4)
  }, [distData, workCapData])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl text-[var(--text-primary)]" style={{ fontFamily: "'Anton', sans-serif", letterSpacing: '0.5px' }}>ENERGY SYSTEMS & WORK CAPACITY</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          CrossFit trains all three metabolic pathways. Every workout here is tagged by the energy system it hits hardest.
        </p>
      </div>

      {/* Energy system cards */}
      <div className="grid grid-cols-4 gap-3">
        {distData.map((es) => (
          <div key={es.id} className="bg-[var(--panel-bg)] rounded-xl p-5 border" style={{ borderColor: ENERGY_SYSTEM_COLORS[es.id] + '40' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ background: ENERGY_SYSTEM_COLORS[es.id] }} />
              <span className="text-xs font-medium text-[var(--text-primary)]">{es.name}</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
              {es.value.toLocaleString()}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{es.pct}% of all WODs</div>
            <div className="text-[9px] text-[var(--text-muted)] leading-relaxed">
              {ENERGY_SYSTEM_DESCRIPTIONS[es.id]}
            </div>
          </div>
        ))}
      </div>

      {/* Energy distribution + Work capacity */}
      <div className="grid grid-cols-2 gap-4">
        {/* 100% stacked distribution bar */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-[var(--text-tertiary)]">Energy System Distribution</h3>
            <span className="text-xs font-mono text-[var(--text-primary)]">
              Evenness: {evenness}%
            </span>
          </div>
          <div className="flex h-6 w-full" style={{ gap: 2 }}>
            {orderedDist.map((es, i) => (
              <div
                key={es.id}
                title={`${es.name}: ${es.value.toLocaleString()} WODs (${es.pct}%)`}
                style={{
                  flex: es.value,
                  background: ENERGY_SYSTEM_COLORS[es.id],
                  borderRadius: i === 0 ? '4px 0 0 4px' : i === orderedDist.length - 1 ? '0 4px 4px 0' : 0,
                }}
              />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {orderedDist.map((es) => (
              <div key={es.id} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ENERGY_SYSTEM_COLORS[es.id] }} />
                <span className="text-[var(--text-secondary)] flex-1">{es.name}</span>
                <span className="font-mono text-[var(--text-primary)]">{es.value.toLocaleString()}</span>
                <span className="text-[var(--text-tertiary)] w-12 text-right">{es.pct}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[10px] text-[var(--text-muted)] leading-relaxed">
            Evenness measures how close the four pathways are to an equal 25% share each (100 = perfectly even split). CrossFit does not prescribe an even split, so read it as description, not a grade.
          </div>
        </div>

        {/* Work capacity by time domain */}
        <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">Work Capacity Across Time Domains</h3>
          <div style={{ width: '100%', height: 300 }}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={workCapData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="domain" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
              <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'var(--panel-bg-hover)' }} />
              <Bar dataKey="count" fill="#019644" radius={[4, 4, 0, 0]} maxBarSize={32} />
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
        <div style={{ width: '100%', height: 300 }}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={analysis.energyByYear} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} interval={2} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={32} tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 11 }} />
            {ES_ORDER.map((key) => (
              <Area key={key} type="monotone" dataKey={key} name={ENERGY_SYSTEM_LABELS[key]} stackId="1" stroke={ENERGY_SYSTEM_COLORS[key]} fill={ENERGY_SYSTEM_COLORS[key]} fillOpacity={0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer></div>
        <div className="flex gap-4 mt-3 justify-center">
          {ES_ORDER.map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full" style={{ background: ENERGY_SYSTEM_COLORS[key] }} />
              {ENERGY_SYSTEM_LABELS[key]}
            </span>
          ))}
        </div>
      </div>

      {/* Explanation panel */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Understanding Energy Systems</h3>
        <div className="grid grid-cols-3 gap-6 text-xs text-[var(--text-tertiary)] leading-relaxed">
          <div>
            <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)] mb-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ENERGY_SYSTEM_COLORS.phosphagen }} />
              Phosphagen (ATP-CP)
            </div>
            <p>Immediate energy for max-effort lifts. Fuels 1RM attempts, short heavy sets. Depletes in ~10 seconds. Full recovery needs 3-5 minutes. CrossFit tests this with strength days and heavy singles.</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)] mb-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ENERGY_SYSTEM_COLORS.glycolytic }} />
              Glycolytic
            </div>
            <p>Burns glucose without oxygen for intense bursts of 10 seconds to ~2 minutes. Produces lactate ("the burn"). Powers workouts like Fran, Grace, and sprint WODs. Recovery in 1-3 minutes.</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)] mb-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ENERGY_SYSTEM_COLORS.oxidative }} />
              Oxidative (Aerobic)
            </div>
            <p>Sustained aerobic effort using oxygen to burn fat and carbs. Dominates in workouts over 2 minutes - Murph, long chippers, endurance pieces. The foundation of fitness and recovery capacity.</p>
          </div>
        </div>
      </div>

      {/* Coach takeaways */}
      <div className="bg-[var(--panel-bg)] rounded-xl p-6 border border-[var(--panel-border)] border-l-2 border-l-[#019644]">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">What to do with this</h3>
        <div className="space-y-3">
          {takeaways.map((t, i) => (
            <div key={i} className="text-xs leading-relaxed">
              <span className="font-bold text-[var(--text-primary)]">{t.claim}</span>{' '}
              <span className="text-[var(--text-secondary)]">{t.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
