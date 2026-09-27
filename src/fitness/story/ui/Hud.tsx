import { useCallback, useEffect, useRef } from 'react'
import { clock, onFrame } from '../clock'
import { useStoryStore } from '../store'
import { useObstacle } from '../labels/useLabel'
import type { Rect } from '../types'

/* HUD chip (DESIGN.md B.7): at most one, top-right of the focus rect, glass,
   at most two lines (eyebrow + readout). The chapter's Hud component writes
   its contents through refs. Registered as a label obstacle. */

export function HudSlot({ stageRef }: { stageRef: React.RefObject<HTMLDivElement | null> }) {
  const def = useStoryStore((s) => s.def)
  const ref = useRef<HTMLDivElement>(null)
  const rect = useCallback((): Rect | null => {
    const el = ref.current
    const st = stageRef.current
    if (!el || !st) return null
    if (el.dataset.show !== '1') return null
    const r = el.getBoundingClientRect()
    const s = st.getBoundingClientRect()
    if (!r.width) return null
    return { x: r.left - s.left - 4, y: r.top - s.top - 4, w: r.width + 8, h: r.height + 8 }
  }, [stageRef])
  useObstacle('hud', rect)
  if (!def?.Hud) return null
  const Hud = def.Hud
  return (
    <div ref={ref} className="st-hud" data-show="0">
      <Hud />
    </div>
  )
}

/**
 * For chapter Hud components: drive the chip's visibility from story time.
 * `fn(T)` returns 0..1; the chip hides (and stops being a label obstacle) at 0.
 */
export function useHudOpacity(ref: React.RefObject<HTMLElement | null>, fn: (T: number) => number): void {
  const f = useRef(fn)
  f.current = fn
  useEffect(
    () =>
      onFrame(() => {
        const el = ref.current?.closest('.st-hud') as HTMLElement | null
        if (!el) return
        const o = Math.round(f.current(clock.T) * 100) / 100
        const s = String(o)
        if (el.style.opacity !== s) el.style.opacity = s
        const show = o > 0.01 ? '1' : '0'
        if (el.dataset.show !== show) el.dataset.show = show
      }),
    [ref],
  )
}
