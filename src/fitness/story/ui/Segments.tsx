import { useEffect, useRef } from 'react'
import { useStoryStore } from '../store'
import { clock, onFrame, setIT } from '../clock'
import { pb, startBeat, haptic } from '../playback'
import { markSeek } from '../ready'

/* Beat segments (DESIGN.md B.2, C.3): one 3 px bar per beat inside a 24 px
   hit area. Fills are written through refs from the engine loop. Dragging
   scrubs T continuously across the whole chapter and leaves the story paused
   on release; a tap jumps to that beat and plays it. */

export function Segments({ accent }: { accent: string }) {
  const n = useStoryStore((s) => s.def?.beats.length ?? 1)
  const fills = useRef<(HTMLSpanElement | null)[]>([])
  const row = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      onFrame(() => {
        const idx = clock.index
        const t = clock.t
        for (let i = 0; i < fills.current.length; i++) {
          const el = fills.current[i]
          if (!el) continue
          const f = i < idx ? 1 : i > idx ? 0 : t
          const v = `scaleX(${f.toFixed(4)})`
          if (el.style.transform !== v) el.style.transform = v
        }
      }),
    [],
  )

  useEffect(() => {
    const el = row.current
    if (!el) return
    let drag: { x: number; moved: boolean; release: () => void; lastBeat: number } | null = null
    const toT = (clientX: number) => {
      const r = el.getBoundingClientRect()
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
      return f * n
    }
    const down = (e: PointerEvent) => {
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      const st = useStoryStore.getState()
      drag = { x: e.clientX, moved: false, release: st.beginInteraction(), lastBeat: clock.index }
    }
    const move = (e: PointerEvent) => {
      if (!drag) return
      if (!drag.moved && Math.abs(e.clientX - drag.x) < 6) return
      drag.moved = true
      const st = useStoryStore.getState()
      if (st.mode === 'explore') st.setMode('story')
      const T = toT(e.clientX)
      const i = Math.min(n - 1, Math.floor(T))
      pb.glide = null
      setIT(i, Math.min(1, T - i))
      markSeek()
      if (i !== drag.lastBeat) {
        drag.lastBeat = i
        haptic()
      }
      if (st.index !== i || st.playing) useStoryStore.setState({ index: i, playing: false, phase: clock.t >= 1 ? 'hold' : 'build' })
    }
    const up = (e: PointerEvent) => {
      if (!drag) return
      const d = drag
      drag = null
      d.release()
      const st = useStoryStore.getState()
      if (!d.moved) {
        const T = toT(e.clientX)
        const i = Math.min(n - 1, Math.floor(T))
        if (st.mode === 'explore') st.setMode('story')
        haptic()
        if (st.reduced) st.seek(i, 1, { hold: false })
        else {
          clock.held = false
          startBeat(i)
          useStoryStore.setState({ playing: true })
        }
      } else {
        clock.held = false
        useStoryStore.setState({ playing: false })
      }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [n])

  return (
    <div
      ref={row}
      className="st-segs"
      role="slider"
      aria-label="Story position"
      aria-valuemin={1}
      aria-valuemax={n}
      aria-valuenow={clock.index + 1}
      data-no-gesture
      style={{ ['--acc' as string]: accent }}
    >
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="st-seg">
          <span className="st-seg-fill" ref={(r) => void (fills.current[i] = r)} />
        </span>
      ))}
    </div>
  )
}
