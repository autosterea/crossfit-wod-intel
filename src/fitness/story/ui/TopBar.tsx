import { useCallback, useEffect, useRef, useState } from 'react'
import ThemeToggle from '../../../components/ThemeToggle'
import { MODULES } from '../../fitnessData'
import { useFitnessStore } from '../../fitnessStore'
import type { FitnessView } from '../../lessonTypes'
import { asset } from '../url'
import { clock, onFrame } from '../clock'
import { useStoryStore } from '../store'
import { ChapterSheet, useDoneList } from './ChapterSheet'
import { IconChevron } from './icons'

/* =========================================================================
   Lesson top bar (DESIGN.md B.2 / B.3), theme-aware.
   Phone: PA mark, wordmark (hidden under 375 px), the chapter chip (corner
   bug) that opens the chapter sheet, ThemeToggle in a 44 px box.
   Desktop: the numbered chapter chips, Games Almanac, WOD Intel, ThemeToggle.
   Both: a 2 px lesson-progress hairline of six segments underneath.
   ========================================================================= */

const NAV: { view: FitnessView; label: string; short: string; num?: string }[] = [
  { view: 'intro', label: 'Overview', short: 'Overview' },
  ...MODULES.map((m) => ({ view: m.key as FitnessView, label: m.label, short: m.mobileLabel ?? m.label, num: m.num })),
]

function ProgressHairline({ view }: { view: FitnessView }) {
  const done = useDoneList()
  const fill = useRef<HTMLSpanElement>(null)
  const hasStory = useStoryStore((s) => s.def?.key === view)
  useEffect(
    () =>
      onFrame(() => {
        const el = fill.current
        if (!el) return
        const f = clock.beats > 0 ? Math.min(1, (clock.index + clock.t) / clock.beats) : 0
        const v = `scaleX(${f.toFixed(4)})`
        if (el.style.transform !== v) el.style.transform = v
      }),
    [],
  )
  return (
    <div className="st-progress" aria-hidden="true">
      {MODULES.map((m) => {
        const cur = m.key === view
        const isDone = done.includes(m.key)
        return (
          <span key={m.key} className={`st-progress-seg${isDone ? ' is-done' : ''}`}>
            {cur && (
              <span
                ref={fill}
                className="st-progress-fill"
                style={{ background: m.accent, transform: hasStory ? 'scaleX(0)' : 'scaleX(1)', opacity: hasStory ? 1 : 0.6 }}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

export function TopBar() {
  const route = useFitnessStore((s) => s.route)
  const navigate = useFitnessStore((s) => s.navigate)
  const [sheet, setSheet] = useState(false)
  const close = useCallback(() => setSheet(false), [])
  const mod = MODULES.find((m) => m.key === route.view)
  const done = useDoneList()

  return (
    <>
    <header className="st-topbar">
      <div className="st-topbar-in">
        <button type="button" onClick={() => navigate({ view: 'intro' })} className="st-brand" aria-label="What Is Fitness home">
          <span className="st-brand-mark">
            <img src={asset('pa-logo.png')} alt="Persistence Athletics" />
          </span>
          <span className="st-wordmark">
            What Is <em>Fitness?</em>
          </span>
        </button>

        {/* Desktop: numbered chips */}
        <nav className="st-chips" aria-label="Chapters">
          {NAV.map((n) => {
            const cur = route.view === n.view
            const accent = MODULES.find((m) => m.key === n.view)?.accent ?? '#91c640'
            return (
              <button
                key={n.view}
                type="button"
                onClick={() => navigate({ view: n.view })}
                title={n.label}
                aria-current={cur ? 'page' : undefined}
                className={`st-navchip${cur ? ' is-current' : ''}`}
                style={{ ['--acc' as string]: accent }}
              >
                {n.num && <span className="st-navchip-num">{n.num}</span>}
                {n.short}
                {n.view !== 'intro' && done.includes(n.view) && <span className="st-navchip-done" aria-hidden="true" />}
              </button>
            )
          })}
        </nav>

        {/* Phone: the chapter chip (corner bug) */}
        <button
          type="button"
          className="st-chapchip"
          onClick={() => setSheet(true)}
          aria-haspopup="dialog"
          aria-expanded={sheet}
          aria-label={`Chapter: ${mod ? mod.label : 'Overview'}. Open chapters`}
        >
          {mod && (
            <span className="st-chapchip-num" style={{ background: mod.accent }}>
              {mod.num}
            </span>
          )}
          <span className="st-chapchip-label">{mod ? mod.mobileLabel ?? mod.label : 'Overview'}</span>
          <IconChevron open={sheet} />
        </button>

        <div className="st-topbar-right">
          <a href="/games" className="st-extlink st-extlink--lg">
            Games Almanac
          </a>
          <a href="/" className="st-extlink">
            WOD Intel
          </a>
          <span className="st-theme">
            <ThemeToggle size="md" />
          </span>
        </div>
      </div>
      <ProgressHairline view={route.view} />
    </header>
    {/* The sheet is a SIBLING of the header, never inside it: the header's backdrop-filter makes it the
        containing block for fixed-position descendants in WebKit, so on iPhone Safari a sheet inside it opened
        within the 60 px bar and was invisible. Chrome does not do this. */}
    <ChapterSheet open={sheet} onClose={close} />
    </>
  )
}
