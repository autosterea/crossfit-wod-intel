/* =========================================================================
   Cached rgba() strings for the skill-name label colours. The setter itself
   is the engine's setLabelColor (story/labels, promoted from this file at
   integration, H.53); it is re-exported here so the chapter's imports stay.
   ========================================================================= */

export { setLabelColor } from '../../story/labels/useLabel'

const tables = new Map<string, string[]>()
const STEPS = 20

/**
 * An rgba() string for a hex colour at alpha a (0 is fully transparent),
 * quantised to 1/20 and cached, so a per-frame caller allocates nothing.
 */
export function rgba(hex: string, a: number): string {
  let t = tables.get(hex)
  if (!t) {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    t = []
    for (let k = 0; k <= STEPS; k++) t.push(`rgba(${r}, ${g}, ${b}, ${k / STEPS})`)
    tables.set(hex, t)
  }
  return t[Math.round(Math.max(0, Math.min(1, a)) * STEPS)]
}
