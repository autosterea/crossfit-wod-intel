import type { FitnessView } from '../../lessonTypes'

/* Per-viewer lesson completion (DESIGN.md B.2): a convenience in
   localStorage['wf.story.done']. Every access is wrapped: private windows and
   blocked storage simply show nothing as completed. */

const KEY = 'wf.story.done'

export function readDone(): FitnessView[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as FitnessView[]) : []
  } catch {
    return []
  }
}

export function markDone(view: FitnessView): void {
  try {
    const cur = readDone()
    if (cur.includes(view)) return
    window.localStorage.setItem(KEY, JSON.stringify([...cur, view]))
    window.dispatchEvent(new Event('wf-story-done'))
  } catch {
    /* ignore */
  }
}
