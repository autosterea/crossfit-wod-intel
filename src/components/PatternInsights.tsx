import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import type { CrossFitData } from '../types'
import { MODALITY_COLORS } from '../utils/colors'

interface Insight {
  title: string
  description: string
  severity: 'high' | 'medium' | 'info'
  data?: any[]
}

export default function PatternInsights({ data }: { data: CrossFitData }) {
  const insights = useMemo(() => {
    const results: Insight[] = []
    const { overview, dowData, trends, cooccurMatrix, searchIndex } = data

    // 1. Day-of-week patterns
    const dowTotals = dowData.map((d: any) => ({ day: d.day, total: d.total }))
    const maxDay = dowTotals.reduce((a: any, b: any) => a.total > b.total ? a : b)
    const minDay = dowTotals.reduce((a: any, b: any) => a.total < b.total ? a : b)
    results.push({
      title: `${maxDay.day} is the most programmed day`,
      description: `${maxDay.day} has ${maxDay.total} WODs vs ${minDay.day}'s ${minDay.total}. That's ${((maxDay.total / minDay.total - 1) * 100).toFixed(0)}% more workouts.`,
      severity: 'high',
      data: dowTotals,
    })

    // 2. Movement co-occurrence surprises
    const { movements, matrix } = cooccurMatrix
    const pairs: { pair: string; ratio: number; observed: number; expected: number }[] = []
    for (let i = 0; i < movements.length; i++) {
      for (let j = i + 1; j < movements.length; j++) {
        const observed = matrix[i][j]
        const freqI = matrix[i][i] / overview.total_workouts
        const freqJ = matrix[j][j] / overview.total_workouts
        const expected = freqI * freqJ * overview.total_workouts
        if (expected > 5 && observed > 10) {
          pairs.push({
            pair: `${data.movementDisplay[movements[i]] || movements[i]} + ${data.movementDisplay[movements[j]] || movements[j]}`,
            ratio: observed / expected,
            observed,
            expected: Math.round(expected),
          })
        }
      }
    }
    pairs.sort((a, b) => b.ratio - a.ratio)
    results.push({
      title: 'Unexpected Movement Pairings',
      description: `"${pairs[0]?.pair}" appears together ${pairs[0]?.ratio.toFixed(1)}x more than random chance. These are the strongest unexpected affinities.`,
      severity: 'high',
      data: pairs.slice(0, 12).map((p) => ({ name: p.pair, ratio: +p.ratio.toFixed(1), observed: p.observed })),
    })

    // 3. Rarest unlikely pair
    const antiPairs = pairs.filter((p) => p.ratio < 1).sort((a, b) => a.ratio - b.ratio)
    if (antiPairs.length > 0) {
      results.push({
        title: 'Movements That Avoid Each Other',
        description: `"${antiPairs[0]?.pair}" co-occurs ${(antiPairs[0]?.ratio * 100).toFixed(0)}% less than expected. CrossFit rarely programs these together.`,
        severity: 'medium',
        data: antiPairs.slice(0, 8).map((p) => ({ name: p.pair, ratio: +p.ratio.toFixed(2), observed: p.observed })),
      })
    }

    // 4. Year-over-year trend
    const trendMod = trends.modality
    if (trendMod.length >= 2) {
      const recent = trendMod[trendMod.length - 2]
      const earliest = trendMod[0]
      const biggestShift = Object.keys(recent)
        .filter((k) => k !== 'year')
        .map((k) => ({ mod: k, shift: (recent[k] || 0) - (earliest[k] || 0) }))
        .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))[0]

      if (biggestShift) {
        results.push({
          title: `"${biggestShift.mod}" modality shifted ${biggestShift.shift > 0 ? 'up' : 'down'} ${Math.abs(biggestShift.shift).toFixed(1)}%`,
          description: `From ${earliest.year} to ${recent.year}, the ${biggestShift.mod} modality went from ${earliest[biggestShift.mod]?.toFixed(1)}% to ${recent[biggestShift.mod]?.toFixed(1)}%. This is the biggest long-term programming shift.`,
          severity: 'medium',
        })
      }
    }

    // 5. Hero WOD timing
    const heroByMonth: Record<string, number> = {}
    searchIndex.filter((w) => w.ih).forEach((w) => {
      const month = new Date(w.d).getMonth()
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const name = monthNames[month]
      heroByMonth[name] = (heroByMonth[name] || 0) + 1
    })
    const heroData = Object.entries(heroByMonth).map(([name, count]) => ({ name, count }))
    const peakMonth = heroData.reduce((a, b) => a.count > b.count ? a : b, heroData[0])
    results.push({
      title: `Hero WODs peak in ${peakMonth?.name || 'N/A'}`,
      description: `${peakMonth?.count || 0} hero WODs were programmed in ${peakMonth?.name || 'N/A'} across all years. Memorial Day (May) is traditionally heavy with hero WODs.`,
      severity: 'info',
      data: heroData,
    })

    // 6. Rest day patterns
    const restByDow: Record<string, number> = {}
    const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    searchIndex.forEach((w) => {
      // This is a proxy - we count workout days to find which days have fewer
    })
    const workoutsByDow = dowData.map((d: any) => ({ name: d.day, workouts: d.total, restPct: (100 - (d.total / (overview.total_days / 7)) * 100).toFixed(1) }))
    results.push({
      title: 'Rest Day Distribution',
      description: `CrossFit.com programs workouts unevenly across the week. Some days see significantly fewer workouts.`,
      severity: 'info',
      data: workoutsByDow,
    })

    // 7. Workout complexity over time - avg movements per workout
    const yearMovCounts: Record<string, { total: number; count: number }> = {}
    searchIndex.forEach((w) => {
      const year = w.d.substring(0, 4)
      if (!yearMovCounts[year]) yearMovCounts[year] = { total: 0, count: 0 }
      yearMovCounts[year].total += w.mv.length
      yearMovCounts[year].count++
    })
    const complexityData = Object.entries(yearMovCounts)
      .map(([year, { total, count }]) => ({ year, avg: +(total / count).toFixed(2) }))
      .sort((a, b) => a.year.localeCompare(b.year))

    results.push({
      title: 'Workout Complexity Trend',
      description: `Average number of distinct movements per workout has changed over 25 years. More movements = more complex programming.`,
      severity: 'medium',
      data: complexityData,
    })

    return results
  }, [data])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Pattern Detection & Insights</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">Automatically discovered patterns, anomalies, and non-obvious relationships in 25 years of data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {insights.map((insight, idx) => (
          <div key={idx} className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                insight.severity === 'high' ? 'bg-rose-400' :
                insight.severity === 'medium' ? 'bg-amber-400' : 'bg-blue-400'
              }`} />
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{insight.title}</h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-1 leading-relaxed">{insight.description}</p>
              </div>
            </div>

            {insight.data && (
              <div className="mt-3">
                {/* Chart based on data type */}
                {insight.data[0]?.ratio !== undefined ? (
                  <div style={{width:"100%",height:200}}><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={insight.data} layout="vertical" margin={{ left: 140 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} width={135} />
                      <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="ratio" radius={[0, 4, 4, 0]}>
                        {insight.data.map((e: any, i: number) => (
                          <Cell key={i} fill={e.ratio > 1 ? '#10b981' : '#f43f5e'} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer></div>
                ) : insight.data[0]?.avg !== undefined ? (
                  <div style={{width:"100%",height:150}}><ResponsiveContainer width="100%" height="100%">
                    <LineChart data={insight.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} interval={3} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 11 }} />
                      <Line type="monotone" dataKey="avg" stroke="#a855f7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer></div>
                ) : (
                  <div style={{width:"100%",height:150}}><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={insight.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey={insight.data[0]?.day ? 'day' : 'name'} tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--chart-axis)' }} />
                      <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey={insight.data[0]?.total ? 'total' : insight.data[0]?.count ? 'count' : 'workouts'} radius={[4, 4, 0, 0]}>
                        {insight.data.map((_: any, i: number) => (
                          <Cell key={i} fill={['#60a5fa', '#a855f7', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'][i % 7]} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer></div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
