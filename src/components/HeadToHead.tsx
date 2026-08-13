import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { CrossFitData } from '../types'
import {
  MODALITY_COLORS,
  MODALITY_LABELS,
  STRUCTURE_COLORS,
  TIME_DOMAIN_COLORS,
} from '../utils/colors'

/* ── helper types ─────────────────────────────────────────────── */

interface YearSnapshot {
  workout_count: number
  rest_count: number
  modality: Record<string, number>
  structure: Record<string, number>
  time_domain: Record<string, number>
  movement_frequency: Record<string, number>
}

interface DiffItem {
  label: string
  category: string
  pctA: number
  pctB: number
  absDiff: number
  direction: 'up' | 'down'
}

/* ── small reusable pieces ────────────────────────────────────── */

function YearSelect({
  value,
  onChange,
  years,
}: {
  value: string
  onChange: (y: string) => void
  years: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--panel-bg)] text-[var(--text-primary)] text-lg font-bold font-mono rounded-lg px-4 py-2.5 border border-[var(--panel-border-strong)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none cursor-pointer appearance-none min-w-[100px] text-center"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  )
}

function DiffArrow({ diff, suffix = '' }: { diff: number; suffix?: string }) {
  if (diff === 0) return <span className="text-[var(--text-muted)] text-xs font-mono">--</span>
  const positive = diff > 0
  return (
    <span
      className={`text-xs font-mono font-semibold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}
    >
      {positive ? '\u25B2' : '\u25BC'} {Math.abs(diff).toLocaleString()}
      {suffix}
    </span>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[var(--panel-bg)] rounded-xl p-5 border border-[var(--panel-border)]">
      <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  )
}

/* ── pie chart sub-component ──────────────────────────────────── */

function ComparisonPie({
  data,
  colors,
  year,
  colorSide,
}: {
  data: Record<string, number>
  colors: Record<string, string>
  year: string
  colorSide: string
}) {
  const entries = useMemo(
    () =>
      Object.entries(data)
        .filter(([k]) => k !== 'Unknown')
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value })),
    [data],
  )

  const total = useMemo(() => entries.reduce((s, e) => s + e.value, 0), [entries])

  return (
    <div className="flex-1 min-w-0">
      <div className={`text-center text-sm font-bold mb-2 ${colorSide}`}>{year}</div>
      <div style={{width:"100%",height:170}}><ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={entries}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={65}
            innerRadius={30}
            strokeWidth={0}
          >
            {entries.map((e) => (
              <Cell key={e.name} fill={colors[e.name] || '#6b7280'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--chart-tooltip-bg)',
              border: '1px solid var(--chart-tooltip-border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
            formatter={(value: any, name: any) => {
              const pct = ((Number(value) / total) * 100).toFixed(1)
              return [`${Number(value).toLocaleString()} (${pct}%)`, name]
            }}
          />
        </PieChart>
      </ResponsiveContainer></div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
        {entries.slice(0, 6).map((e) => {
          const pct = ((e.value / total) * 100).toFixed(0)
          return (
            <div key={e.name} className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: colors[e.name] || '#6b7280' }}
              />
              {MODALITY_LABELS[e.name] || e.name} {pct}%
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── horizontal stacked bar ───────────────────────────────────── */

function StackedBar({
  data,
  total,
  colors,
}: {
  data: Record<string, number>
  total: number
  colors: Record<string, string>
}) {
  const entries = Object.entries(data)
    .filter(([k]) => k !== 'Unknown')
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-6 rounded-md overflow-hidden">
        {entries.map(([name, count]) => {
          const pct = (count / total) * 100
          if (pct < 1) return null
          return (
            <div
              key={name}
              className="relative group"
              style={{
                width: `${pct}%`,
                background: colors[name] || '#6b7280',
                minWidth: pct > 0 ? 2 : 0,
              }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] bg-[var(--chart-tooltip-bg)] border border-[var(--chart-tooltip-border)] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {name}: {pct.toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {entries.slice(0, 5).map(([name, count]) => {
          const pct = ((count / total) * 100).toFixed(0)
          return (
            <div key={name} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: colors[name] || '#6b7280' }}
              />
              {name} {pct}%
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── main component ───────────────────────────────────────────── */

export default function HeadToHead({ data }: { data: CrossFitData }) {
  const years = useMemo(
    () => Object.keys(data.yearData).sort(),
    [data.yearData],
  )

  const defaultA = years.includes('2005') ? '2005' : years[0]
  const defaultB = years.includes('2024') ? '2024' : years[years.length - 1]

  const [yearA, setYearA] = useState(defaultA)
  const [yearB, setYearB] = useState(defaultB)

  const snapA: YearSnapshot | null = data.yearData[yearA] ?? null
  const snapB: YearSnapshot | null = data.yearData[yearB] ?? null

  /* ── Top 10 movements per year ─────────────────────────────── */

  const topMovements = useMemo(() => {
    if (!snapA || !snapB) return { a: [], b: [], uniqueA: new Set<string>(), uniqueB: new Set<string>() }

    const topA = Object.entries(snapA.movement_frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({
        id,
        name: data.movementDisplay[id] || id,
        count,
        modality: data.movementModality[id] || 'G',
      }))

    const topB = Object.entries(snapB.movement_frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({
        id,
        name: data.movementDisplay[id] || id,
        count,
        modality: data.movementModality[id] || 'G',
      }))

    const setA = new Set(topA.map((m) => m.id))
    const setB = new Set(topB.map((m) => m.id))

    return {
      a: topA,
      b: topB,
      uniqueA: new Set([...setA].filter((x) => !setB.has(x))),
      uniqueB: new Set([...setB].filter((x) => !setA.has(x))),
    }
  }, [snapA, snapB, data])

  /* ── Key differences engine ────────────────────────────────── */

  const keyDiffs = useMemo(() => {
    if (!snapA || !snapB) return []

    const diffs: DiffItem[] = []
    const totalA = snapA.workout_count
    const totalB = snapB.workout_count

    // Helper: compute pct diff for a category
    function addDiffs(
      catName: string,
      recordA: Record<string, number>,
      recordB: Record<string, number>,
      labelFn?: (k: string) => string,
    ) {
      const allKeys = new Set([...Object.keys(recordA), ...Object.keys(recordB)])
      allKeys.forEach((k) => {
        if (k === 'Unknown') return
        const pctA = ((recordA[k] || 0) / totalA) * 100
        const pctB = ((recordB[k] || 0) / totalB) * 100
        const absDiff = Math.abs(pctB - pctA)
        if (absDiff > 1) {
          diffs.push({
            label: labelFn ? labelFn(k) : k,
            category: catName,
            pctA,
            pctB,
            absDiff,
            direction: pctB > pctA ? 'up' : 'down',
          })
        }
      })
    }

    addDiffs('Modality', snapA.modality, snapB.modality, (k) => MODALITY_LABELS[k] || k)
    addDiffs('Structure', snapA.structure, snapB.structure)
    addDiffs('Time Domain', snapA.time_domain, snapB.time_domain)
    addDiffs('Movement', snapA.movement_frequency, snapB.movement_frequency, (k) => data.movementDisplay[k] || k)

    diffs.sort((a, b) => b.absDiff - a.absDiff)
    return diffs.slice(0, 8)
  }, [snapA, snapB, data])

  /* ── render ────────────────────────────────────────────────── */

  if (!snapA || !snapB) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)] text-sm">
        Select two valid years to compare.
      </div>
    )
  }

  const workoutDiff = snapB.workout_count - snapA.workout_count
  const restDiff = snapB.rest_count - snapA.rest_count

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Head-to-Head Comparison</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Pick any two years and see exactly how CrossFit's programming changed. This shows what
          got more popular, what faded away, and how the overall philosophy shifted.
        </p>
      </div>

      {/* Year selectors */}
      <div className="flex items-center justify-center gap-4 py-4">
        <YearSelect value={yearA} onChange={setYearA} years={years} />
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-rose-500/20 border border-[var(--panel-border-strong)]">
          <span className="text-base font-black text-[var(--text-primary)] tracking-wider">VS</span>
        </div>
        <YearSelect value={yearB} onChange={setYearB} years={years} />
      </div>

      {/* 1. Quick Stats */}
      <SectionCard title="Quick Stats">
        <div className="grid grid-cols-2 gap-6">
          {/* Workout count */}
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-3xl font-bold font-mono text-blue-400">
                {snapA.workout_count.toLocaleString()}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">workouts</div>
            </div>
            <div className="flex flex-col items-center px-4">
              <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Workouts</div>
              <DiffArrow diff={workoutDiff} />
            </div>
            <div className="text-center flex-1">
              <div className="text-3xl font-bold font-mono text-purple-400">
                {snapB.workout_count.toLocaleString()}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">workouts</div>
            </div>
          </div>

          {/* Rest days */}
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-3xl font-bold font-mono text-blue-400">
                {snapA.rest_count.toLocaleString()}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">rest days</div>
            </div>
            <div className="flex flex-col items-center px-4">
              <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Rest Days</div>
              <DiffArrow diff={restDiff} />
            </div>
            <div className="text-center flex-1">
              <div className="text-3xl font-bold font-mono text-purple-400">
                {snapB.rest_count.toLocaleString()}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">rest days</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 2. Modality Split - side-by-side pie charts */}
      <SectionCard title="Modality Split">
        <div className="flex gap-6">
          <ComparisonPie
            data={snapA.modality}
            colors={MODALITY_COLORS}
            year={yearA}
            colorSide="text-blue-400"
          />
          <div className="w-px bg-[var(--panel-border)] self-stretch" />
          <ComparisonPie
            data={snapB.modality}
            colors={MODALITY_COLORS}
            year={yearB}
            colorSide="text-purple-400"
          />
        </div>
      </SectionCard>

      {/* 3. Top 10 Movements */}
      <SectionCard title="Top 10 Movements">
        <div className="grid grid-cols-2 gap-6">
          {/* Year A */}
          <div>
            <div className="text-sm font-bold text-blue-400 mb-3 text-center">{yearA}</div>
            <div className="space-y-1.5">
              {topMovements.a.map((m, i) => {
                const isUnique = topMovements.uniqueA.has(m.id)
                const modalityColor =
                  m.modality === 'M' ? '#f43f5e' : m.modality === 'G' ? '#10b981' : '#3b82f6'
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                      isUnique
                        ? 'bg-blue-500/10 border border-blue-500/20'
                        : 'bg-[var(--app-bg)]'
                    }`}
                  >
                    <span className="text-[10px] text-[var(--text-muted)] w-4 font-mono">{i + 1}</span>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: modalityColor }}
                    />
                    <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{m.name}</span>
                    <span className="text-xs text-[var(--text-tertiary)] font-mono">{m.count}</span>
                    {isUnique && (
                      <span className="text-[9px] font-medium text-blue-400 px-1.5 py-0.5 rounded bg-blue-500/10">
                        UNIQUE
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Year B */}
          <div>
            <div className="text-sm font-bold text-purple-400 mb-3 text-center">{yearB}</div>
            <div className="space-y-1.5">
              {topMovements.b.map((m, i) => {
                const isUnique = topMovements.uniqueB.has(m.id)
                const modalityColor =
                  m.modality === 'M' ? '#f43f5e' : m.modality === 'G' ? '#10b981' : '#3b82f6'
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                      isUnique
                        ? 'bg-purple-500/10 border border-purple-500/20'
                        : 'bg-[var(--app-bg)]'
                    }`}
                  >
                    <span className="text-[10px] text-[var(--text-muted)] w-4 font-mono">{i + 1}</span>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: modalityColor }}
                    />
                    <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{m.name}</span>
                    <span className="text-xs text-[var(--text-tertiary)] font-mono">{m.count}</span>
                    {isUnique && (
                      <span className="text-[9px] font-medium text-purple-400 px-1.5 py-0.5 rounded bg-purple-500/10">
                        UNIQUE
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 4. Time Domain Distribution */}
      <SectionCard title="Time Domain Distribution">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-bold text-blue-400 mb-2">{yearA}</div>
            <StackedBar
              data={snapA.time_domain}
              total={snapA.workout_count}
              colors={TIME_DOMAIN_COLORS}
            />
          </div>
          <div>
            <div className="text-sm font-bold text-purple-400 mb-2">{yearB}</div>
            <StackedBar
              data={snapB.time_domain}
              total={snapB.workout_count}
              colors={TIME_DOMAIN_COLORS}
            />
          </div>
        </div>
      </SectionCard>

      {/* 4b. Structure Distribution */}
      <SectionCard title="Workout Structure Distribution">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-bold text-blue-400 mb-2">{yearA}</div>
            <StackedBar
              data={snapA.structure}
              total={snapA.workout_count}
              colors={STRUCTURE_COLORS}
            />
          </div>
          <div>
            <div className="text-sm font-bold text-purple-400 mb-2">{yearB}</div>
            <StackedBar
              data={snapB.structure}
              total={snapB.workout_count}
              colors={STRUCTURE_COLORS}
            />
          </div>
        </div>
      </SectionCard>

      {/* 5. Key Differences */}
      <SectionCard title="Key Differences">
        {keyDiffs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No significant differences found. Try comparing years that are farther apart.
          </p>
        ) : (
          <div className="space-y-2">
            {keyDiffs.map((d, i) => {
              const pctChange =
                d.pctA > 0
                  ? (((d.pctB - d.pctA) / d.pctA) * 100).toFixed(0)
                  : d.pctB > 0
                    ? '+new'
                    : '0'
              const isUp = d.direction === 'up'
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-2.5 rounded-lg bg-[var(--app-bg)]"
                >
                  <span
                    className={`text-base mt-0.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {isUp ? '\u25B2' : '\u25BC'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text-primary)]">
                      <span className="font-semibold">{d.label}</span>{' '}
                      {isUp ? 'rose' : 'dropped'} from{' '}
                      <span className="font-mono text-blue-400">{d.pctA.toFixed(1)}%</span> to{' '}
                      <span className="font-mono text-purple-400">{d.pctB.toFixed(1)}%</span>
                      {pctChange !== '+new' && (
                        <span
                          className={`ml-2 text-xs font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          ({isUp ? '+' : ''}
                          {pctChange}%)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{d.category}</div>
                  </div>
                  {/* mini bar comparison */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-[var(--panel-border)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400/60"
                        style={{ width: `${Math.min(d.pctA, 100)}%` }}
                      />
                    </div>
                    <div className="w-16 h-1.5 rounded-full bg-[var(--panel-border)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-400/60"
                        style={{ width: `${Math.min(d.pctB, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
