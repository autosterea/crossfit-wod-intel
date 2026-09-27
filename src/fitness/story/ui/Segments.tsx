import { useEffect, useRef } from 'react'
import { useStoryStore } from '../store'
import { clock, onFrame, setIT } from '../clock'
import { pb, startBeat, haptic } from '../playback'
import { markSeek } from '../ready'
import { dropQueryKeys } from '../url'

/* Beat segments (DESIGN.md B.2, C.3): one 3 px bar per beat inside a 24 px
   hit area. Fills are written through refs from the engine loop. Dragging
   scrubs T continuously across the whole chapter and leaves the story paused
   on release; a tap jumps to that beat and plays it. Keyboard: it is a
   focusable slider (Left / Right one beat, Home / End). Scrubbing never
   touches the chapter-loaded state, so the slate never covers the stage
   (amendment H.15), and it sets React state only when the beat changes. */

/** Jump to the start of beat i and play it (reduced motion: show its end). */
function jumpTo(i: number): void {
  const st = useStoryStore.getState()
  const n = st.def?.beats.length ?? 1
  const k = Math.max(0, Math.min(n - 1, i))
  if (st.mode === 'explore') st.setMode('story')
  dropQueryKeys(['beat', 't'])
  haptic()
  if (st.reduced) st.seek(k, 1, { hold: false })
  else {
    clock.held = false
    startBeat(k)
    useStoryStore.setState({ playing: true })
  }
}

export function Segments({ accent }: { accent: string }) {
  const n = useStoryStore((s) => s.def?.beats.length ?? 1)
  const index = useStoryStore((s) => s.index)
  const title = useStoryStore((s) => s.def?.beats[s.index]?.title ?? '')
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
      if (!drag.moved) {
        dropQueryKeys(['beat', 't'])
        const st0 = useStoryStore.getState()
        if (st0.mode === 'explore') st0.setMode('story')
      }
      drag.moved = true
      const T = toT(e.clientX)
      const i = Math.min(n - 1, Math.floor(T))
      pb.glide = null
      setIT(i, Math.min(1, T - i))
      markSeek()
      if (i !== drag.lastBeat) {
        drag.lastBeat = i
        haptic()
      }
      const st = useStoryStore.getState()
      const phase = clock.t >= 1 ? (i >= n - 1 ? 'done' : 'hold') : 'build'
      if (st.index !== i || st.playing || st.phase !== phase) useStoryStore.setState({ index: i, playing: false, phase })
    }
    const up = (e: PointerEvent) => {
      if (!drag) return
      const d = drag
      drag = null
      d.release()
      if (!d.moved) {
        jumpTo(Math.min(n - 1, Math.floor(toT(e.clientX))))
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = useStoryStore.getState().index
    let to = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = i + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = i - 1
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = n - 1
    else return
    e.preventDefault()
    e.stopPropagation()
    if (to < 0 || to > n - 1) return
    jumpTo(to)
  }

  return (
    <div
      ref={row}
      className="st-segs"
      role="slider"
      tabIndex={0}
      aria-label="Story position"
      aria-valuemin={1}
      aria-valuemax={n}
      aria-valuenow={index + 1}
      aria-valuetext={`Beat ${index + 1} of ${n}: ${title}`}
      data-no-gesture
      onKeyDown={onKeyDown}
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
