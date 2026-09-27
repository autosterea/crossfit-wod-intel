import { useLayoutEffect, useRef } from 'react'
import { useStoryStore } from '../store'

/* =========================================================================
   <ChipRadio/>: the explore chip row as a proper radiogroup (WAI-ARIA):
   one tab stop (roving tabindex on the checked chip), Left / Right and
   Up / Down move AND select, Home / End jump. The story's stepping keys
   ignore arrows inside [role=radiogroup] (gestures.ts), so arrows here never
   leave explore. 44 px chips, horizontal scroll with edge fades (B.4).

   The checked chip is kept in view whenever the value changes, from a chip
   or from elsewhere (a drag that turns the profile into Custom, a grid cell):
   the ROW scrolls horizontally (never the sheet or the page), only when the
   chip is not already fully visible inside the 16 px edge fades, and it
   leaves part of the next chip showing so the row still reads as scrollable.
   A row whose checked chip fits at scrollLeft 0 opens at 0 (integration H.53;
   Continuum and Skills each did this locally).
   ========================================================================= */

const FADE = 16 // the row's edge fade (fitness.css .st-chiprow)
const PEEK = 36 // how far the checked chip stays from the edge it was brought in from
const SHOW = 24 // how much of a neighbour stays visible past the fade on the far edge

/** Scroll `row` horizontally so `chip` sits inside the fades; true when it moved. */
function keepInView(row: HTMLElement, chip: HTMLElement, smooth: boolean): boolean {
  const W = row.clientWidth
  const maxS = row.scrollWidth - W
  if (maxS <= 1) return false
  // content coordinates inside the row (the row is not an offsetParent)
  const vl = row.scrollLeft
  const x0 = row.getBoundingClientRect().left - vl
  const spans: [number, number][] = []
  for (const el of Array.from(row.children)) {
    const q = el.getBoundingClientRect()
    spans.push([q.left - x0, q.right - x0])
  }
  const cq = chip.getBoundingClientRect()
  const cl = cq.left - x0
  const cr = cq.right - x0
  // the scroll range that shows the whole chip inside the fades
  const lo = cr - W + FADE
  const hi = Math.max(lo, cl - FADE)
  if (vl >= lo - 0.5 && vl <= hi + 0.5) return false
  const fromLeft = vl < lo
  let to = fromLeft ? Math.min(hi, lo + PEEK - FADE) : Math.max(lo, hi - (PEEK - FADE))
  // The far edge: when it falls in a gap, the chip beyond it hides entirely
  // under the fade and nothing says the row scrolls that way. Slide (while
  // the checked chip stays whole) until part of that neighbour shows.
  // (a chip cut by a few px under a 16 px fade reads as whole: require a real cut)
  const crosses = (e: number) => spans.some(([a, b]) => a < e - 12 && b > e + 12)
  if (fromLeft) {
    const e = Math.min(to, maxS) + FADE
    const hidden = spans.filter(([, b]) => b <= e + 4)
    if (!crosses(e) && hidden.length) to = Math.max(lo, Math.min(to, hidden[hidden.length - 1][1] - FADE - SHOW))
  } else {
    const e = Math.max(to, 0) + W - FADE
    const next = spans.find(([a]) => a >= e - 4)
    if (!crosses(e) && next) to = Math.min(hi, Math.max(to, next[0] - W + FADE + SHOW))
  }
  to = Math.max(0, Math.min(to, maxS))
  if (Math.abs(to - vl) < 1) return false
  row.scrollTo({ left: to, behavior: smooth ? 'smooth' : 'auto' })
  return true
}

export interface ChipRadioProps<T extends string> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}

export function ChipRadio<T extends string>({ label, options, value, onChange, className }: ChipRadioProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const row = useRef<HTMLDivElement>(null)
  const reduced = useStoryStore((s) => s.reduced)
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const first = useRef(true)
  useLayoutEffect(() => {
    const place = (smooth: boolean) => {
      const r = row.current
      const chip = refs.current[idx]
      if (r && chip) keepInView(r, chip, smooth)
    }
    const opening = first.current
    first.current = false
    // A row that mounts while the web fonts are still loading measures its
    // chips in the fallback font (wider): place it once the fonts are in,
    // from the start of the row.
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    if (opening && fonts && fonts.status !== 'loaded') {
      let alive = true
      void fonts.ready.then(() => {
        if (!alive || !row.current) return
        row.current.scrollLeft = 0
        place(false)
      })
      return () => {
        alive = false
      }
    }
    place(!opening && !reduced)
    return undefined
  }, [idx, options.length, reduced])
  const move = (to: number) => {
    const n = options.length
    const k = ((to % n) + n) % n
    onChange(options[k].value)
    // focus without letting the browser scroll the sheet; the effect above scrolls the row
    refs.current[k]?.focus({ preventScroll: true })
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    let to = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = idx + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = idx - 1
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = options.length - 1
    else return
    e.preventDefault()
    e.stopPropagation()
    move(to)
  }
  return (
    <div ref={row} className={`st-chiprow${className ? ' ' + className : ''}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(r) => void (refs.current[i] = r)}
          type="button"
          role="radio"
          aria-checked={i === idx}
          tabIndex={i === idx ? 0 : -1}
          className={`st-chip st-chip--pick${i === idx ? ' is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
