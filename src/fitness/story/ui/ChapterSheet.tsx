import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MODULES, INTRO_TEXT } from '../../fitnessData'
import { useFitnessStore } from '../../fitnessStore'
import { useStoryStore } from '../store'
import type { FitnessView } from '../../lessonTypes'
import { ChapterGlyph } from './ChapterGlyph'
import { IconCheck, IconClose } from './icons'
import { readDone } from './progress'

/* Chapter sheet (DESIGN.md B.5): a theme-aware bottom sheet listing the
   overview and the six chapters, each with its glyph, number, label, blurb
   and a check when completed. Opening it pauses the story (interaction). */

export function useDoneList(): FitnessView[] {
  const [done, setDone] = useState<FitnessView[]>(() => readDone())
  useEffect(() => {
    const on = () => setDone(readDone())
    window.addEventListener('wf-story-done', on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener('wf-story-done', on)
      window.removeEventListener('storage', on)
    }
  }, [])
  return done
}

export function ChapterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const route = useFitnessStore((s) => s.route)
  const navigate = useFitnessStore((s) => s.navigate)
  const done = useDoneList()

  // The story holds still while the sheet is open (L14).
  useEffect(() => {
    if (!open) return
    const release = useStoryStore.getState().beginInteraction()
    useStoryStore.setState({ sheet: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      release()
      useStoryStore.setState({ sheet: false })
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const rows: { view: FitnessView; num: string; label: string; blurb: string; accent: string }[] = [
    { view: 'intro', num: '00', label: 'Overview', blurb: INTRO_TEXT.split('. ')[0] + '.', accent: '#91c640' },
    ...MODULES.map((m) => ({ view: m.key as FitnessView, num: m.num, label: m.label, blurb: m.blurb, accent: m.accent })),
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="st-sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="st-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Chapters"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="st-sheet-head">
              <span>Chapters</span>
              <button type="button" className="st-sheet-close" aria-label="Close chapters" onClick={onClose}>
                <IconClose />
              </button>
            </div>
            <ul className="st-sheet-list">
              {rows.map((r) => {
                const cur = route.view === r.view
                return (
                  <li key={r.view}>
                    <button
                      type="button"
                      className={`st-sheet-row${cur ? ' is-current' : ''}`}
                      style={{ ['--acc' as string]: r.accent }}
                      onClick={() => {
                        onClose()
                        if (!cur) navigate({ view: r.view })
                      }}
                    >
                      <span className="st-sheet-glyph" style={{ color: r.accent }}>
                        <ChapterGlyph view={r.view === 'intro' ? 'definition' : r.view} size={40} />
                      </span>
                      <span className="st-sheet-num" style={{ color: r.accent }}>
                        {r.num}
                      </span>
                      <span className="st-sheet-text">
                        <span className="st-sheet-label">{r.label}</span>
                        <span className="st-sheet-blurb">{r.blurb}</span>
                      </span>
                      {done.includes(r.view) && (
                        <span className="st-sheet-check" aria-label="Completed">
                          <IconCheck />
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
