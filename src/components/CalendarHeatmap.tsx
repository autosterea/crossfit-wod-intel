import { useState, useMemo, useCallback } from 'react'
import type { CrossFitData, Workout } from '../types'

/* ── colour palette ─────────────────────────────────────────── */
const REST_COLOR = '#1e1e3a'
const GREEN_SHADES = ['#0e4429', '#006d32', '#26a641', '#39d353'] // low → high complexity

function intensityColor(movementCount: number): string {
  if (movementCount <= 1) return GREEN_SHADES[0]
  if (movementCount <= 3) return GREEN_SHADES[1]
  if (movementCount <= 5) return GREEN_SHADES[2]
  return GREEN_SHADES[3]
}

/* ── date helpers ────────────────────────────────────────────── */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function daysInYear(y: number) {
  return isLeapYear(y) ? 366 : 365
}

/** Return Date for a year-month-day (months 0-based internally) */
function dateFromYMD(y: number, m: number, d: number): Date {
  return new Date(y, m, d)
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function readableDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/* ── types ───────────────────────────────────────────────────── */
interface DayCell {
  date: Date
  dateStr: string
  workout: Workout | null
  color: string
  movementCount: number
}

interface TooltipInfo {
  x: number
  y: number
  cell: DayCell
}

/* ── build year grid ─────────────────────────────────────────── */
function buildYearGrid(year: number, workoutMap: Map<string, Workout>): {
  grid: (DayCell | null)[][]
  monthLabels: { label: string; col: number }[]
} {
  const jan1 = dateFromYMD(year, 0, 1)
  const startDow = jan1.getDay() // 0=Sun

  const totalDays = daysInYear(year)
  const totalSlots = startDow + totalDays
  const numCols = Math.ceil(totalSlots / 7)

  // grid[row][col] - row = day of week (0=Sun .. 6=Sat), col = week index
  const grid: (DayCell | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: numCols }, () => null)
  )

  // Track which column each month first appears in
  const monthFirstCol = new Map<number, number>()

  for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
    const date = new Date(jan1)
    date.setDate(jan1.getDate() + dayIdx)

    const slot = startDow + dayIdx
    const col = Math.floor(slot / 7)
    const row = slot % 7

    const dateStr = formatDate(date)
    const workout = workoutMap.get(dateStr) || null
    const movementCount = workout ? workout.mv.length : 0
    const color = workout ? intensityColor(movementCount) : REST_COLOR

    grid[row][col] = { date, dateStr, workout, color, movementCount }

    const month = date.getMonth()
    if (!monthFirstCol.has(month)) {
      monthFirstCol.set(month, col)
    }
  }

  const monthLabels = Array.from(monthFirstCol.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([m, col]) => ({ label: MONTH_LABELS[m], col }))

  return { grid, monthLabels }
}

/* ── compute stats ───────────────────────────────────────────── */
function computeYearStats(year: number, workoutMap: Map<string, Workout>) {
  const jan1 = dateFromYMD(year, 0, 1)
  const totalDays = daysInYear(year)

  let workoutDays = 0
  let restDays = 0
  let currentStreak = 0
  let longestStreak = 0
  const dowCounts = [0, 0, 0, 0, 0, 0, 0]

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(jan1)
    date.setDate(jan1.getDate() + i)
    const dateStr = formatDate(date)

    // Don't count future dates
    const now = new Date()
    if (date > now) break

    if (workoutMap.has(dateStr)) {
      workoutDays++
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
      dowCounts[date.getDay()]++
    } else {
      restDays++
      currentStreak = 0
    }
  }

  let mostCommonDayIdx = 0
  let maxCount = 0
  for (let i = 0; i < 7; i++) {
    if (dowCounts[i] > maxCount) {
      maxCount = dowCounts[i]
      mostCommonDayIdx = i
    }
  }

  return {
    totalWorkouts: workoutDays,
    restDays,
    longestStreak,
    mostCommonDay: DAY_LABELS[mostCommonDayIdx],
    mostCommonDayCount: maxCount,
  }
}

/* ── component ───────────────────────────────────────────────── */
export default function CalendarHeatmap({ data }: { data: CrossFitData }) {
  /* Build a map of date string → Workout for fast lookup */
  const workoutMap = useMemo(() => {
    const map = new Map<string, Workout>()
    for (const w of data.searchIndex) {
      map.set(w.d, w)
    }
    return map
  }, [data.searchIndex])

  /* Determine available years */
  const years = useMemo(() => {
    const yrs = new Set<number>()
    for (const w of data.searchIndex) {
      const y = parseInt(w.d.slice(0, 4), 10)
      if (!isNaN(y)) yrs.add(y)
    }
    return Array.from(yrs).sort((a, b) => a - b)
  }, [data.searchIndex])

  const [selectedYear, setSelectedYear] = useState(() => years[years.length - 1] || 2026)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  /* Build grid for selected year */
  const { grid, monthLabels } = useMemo(
    () => buildYearGrid(selectedYear, workoutMap),
    [selectedYear, workoutMap]
  )

  const stats = useMemo(
    () => computeYearStats(selectedYear, workoutMap),
    [selectedYear, workoutMap]
  )

  const numCols = grid[0].length

  const handleMouseEnter = useCallback((e: React.MouseEvent, cell: DayCell) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const parentRect = (e.target as HTMLElement).closest('.heatmap-scroll-container')?.getBoundingClientRect()
    if (parentRect) {
      setTooltip({
        x: rect.left - parentRect.left + rect.width / 2,
        y: rect.top - parentRect.top - 8,
        cell,
      })
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  /* Day labels shown on left: Mon, Wed, Fri (rows 1, 3, 5) */
  const dayLabelRows = [1, 3, 5]

  return (
    <div className="bg-[var(--panel-bg)] rounded-2xl border border-[var(--panel-border)] p-6 space-y-6">
      {/* ── Explainer ─────────────────────────────────────── */}
      <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--panel-border)] p-4">
        <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
          Every square is one day. <span className="text-[#39d353] font-medium">Green = workout day</span> (brighter = more complex). <span className="text-[var(--text-muted)]">Dark = rest day</span>. This is 25 years of CrossFit programming at a glance - like a GitHub contribution chart for fitness.
        </p>
      </div>

      {/* ── Year Selector ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
              y === selectedYear
                ? 'bg-[#39d353] text-[#0a0a14] font-bold'
                : 'bg-[var(--panel-bg-hover)] text-[var(--text-tertiary)] hover:bg-[var(--panel-border-strong)] hover:text-[var(--text-primary)]'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* ── Calendar Grid ─────────────────────────────────── */}
      <div className="relative heatmap-scroll-container overflow-x-auto">
        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none bg-[var(--panel-bg-hover)] border border-[var(--panel-border-strong)] rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="text-[var(--text-primary)] font-medium">{readableDate(tooltip.cell.date)}</div>
            {tooltip.cell.workout ? (
              <>
                <div className="text-[var(--text-secondary)] mt-0.5 max-w-[220px] truncate">
                  {tooltip.cell.workout.t}
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-[#39d353]">{tooltip.cell.workout.mo}</span>
                  <span className="text-[var(--text-muted)]">|</span>
                  <span className="text-[var(--text-tertiary)]">{tooltip.cell.movementCount} movement{tooltip.cell.movementCount !== 1 ? 's' : ''}</span>
                </div>
              </>
            ) : (
              <div className="text-[var(--text-muted)] mt-0.5">Rest day</div>
            )}
          </div>
        )}

        <div className="inline-flex gap-0">
          {/* Day labels column */}
          <div className="flex flex-col flex-shrink-0 pr-2" style={{ gap: 2 }}>
            {/* Spacer for month labels row */}
            <div style={{ height: 16 }} />
            {DAY_LABELS.map((label, rowIdx) => (
              <div
                key={label}
                className="flex items-center justify-end text-[10px] text-[var(--text-muted)] select-none"
                style={{ height: 12, width: 28 }}
              >
                {dayLabelRows.includes(rowIdx) ? label : ''}
              </div>
            ))}
          </div>

          {/* Grid area */}
          <div className="relative">
            {/* Month labels row */}
            <div className="flex" style={{ height: 16, gap: 2 }}>
              {monthLabels.map(({ label, col }, idx) => {
                const nextCol = idx < monthLabels.length - 1 ? monthLabels[idx + 1].col : numCols
                const span = nextCol - col
                return (
                  <div
                    key={label}
                    className="text-[10px] text-[var(--text-muted)] select-none"
                    style={{
                      position: 'absolute',
                      left: col * (12 + 2),
                    }}
                  >
                    {span >= 2 ? label : ''}
                  </div>
                )
              })}
            </div>

            {/* Week columns */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${numCols}, 12px)`,
                gridTemplateRows: 'repeat(7, 12px)',
                gap: 2,
              }}
            >
              {Array.from({ length: numCols }, (_, col) =>
                Array.from({ length: 7 }, (_, row) => {
                  const cell = grid[row][col]
                  if (!cell) {
                    return (
                      <div
                        key={`${col}-${row}`}
                        style={{
                          gridColumn: col + 1,
                          gridRow: row + 1,
                          width: 12,
                          height: 12,
                        }}
                      />
                    )
                  }
                  return (
                    <div
                      key={cell.dateStr}
                      className="rounded-[2px] cursor-pointer transition-transform hover:scale-125 hover:z-10"
                      style={{
                        gridColumn: col + 1,
                        gridRow: row + 1,
                        width: 12,
                        height: 12,
                        backgroundColor: cell.color,
                      }}
                      onMouseEnter={(e) => handleMouseEnter(e, cell)}
                      onMouseLeave={handleMouseLeave}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-[10px] text-[var(--text-muted)]">
          <span>Less</span>
          <div className="rounded-[2px]" style={{ width: 12, height: 12, backgroundColor: REST_COLOR }} />
          {GREEN_SHADES.map((c) => (
            <div key={c} className="rounded-[2px]" style={{ width: 12, height: 12, backgroundColor: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* ── Year Summary Stats ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--panel-border)] p-4">
          <div className="text-2xl font-bold font-mono text-[#39d353]">
            {stats.totalWorkouts.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Total Workouts</div>
        </div>
        <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--panel-border)] p-4">
          <div className="text-2xl font-bold font-mono text-[var(--text-secondary)]">
            {stats.restDays.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Rest Days</div>
        </div>
        <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--panel-border)] p-4">
          <div className="text-2xl font-bold font-mono text-[#26a641]">
            {stats.longestStreak}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Longest Streak (days)</div>
        </div>
        <div className="bg-[var(--app-bg)] rounded-xl border border-[var(--panel-border)] p-4">
          <div className="text-2xl font-bold font-mono text-[#006d32]">
            {stats.mostCommonDay}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Most Common Day ({stats.mostCommonDayCount} workouts)
          </div>
        </div>
      </div>
    </div>
  )
}
