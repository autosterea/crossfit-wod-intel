import { registry } from '../../story/labels/registry'

/* =========================================================================
   setLabelColor (local; listed as an engine request). A label's data colour
   (its dot, border and callout text: the CSS variable --c) is fixed by its
   spec. The skills chapter recolours the ten skill-name dots as the class
   arcs pass them (D.2 S1: "those spokes, dots and labels take the trained
   colour"), as a pure function of T, like setLabelText does for text.

   Writes only when the value changed for that label ELEMENT, so a frame
   costs one lookup per label. The cache is keyed by the element itself
   (a WeakMap): a label node that leaves the stage (a chapter change) takes
   its entry with it, and a new node for the same id starts clean. React
   re-renders of the label node keep the imperative value: the spec's own
   colour never changes, so React never rewrites --c.
   ========================================================================= */

const written = new WeakMap<HTMLElement, string>()

export function setLabelColor(id: string, css: string): void {
  const el = registry.get(id)?.el
  if (!el || written.get(el) === css) return
  el.style.setProperty('--c', css)
  written.set(el, css)
}

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
