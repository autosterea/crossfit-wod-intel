import { useCallback, useEffect, useRef, useState } from 'react'
import { useStoryStore } from '../store'
import { bumpObstacles, useObstacle } from '../labels/useLabel'
import type { Rect } from '../types'
import { soundOn, useSoundUi } from './director'
import { IconSoundOn } from './icons'
import { isNarrated } from './narration'
import './audio.css'

/* =========================================================================
   The first-visit "Sound on" chip (DESIGN.md I.5.1). It asks once: it shows
   in story mode while the choice is not '0' and audio is not running, 1.2 s
   after the chapter is loaded, with no sheet open. Phone and desktop: a pill
   straddling the caption card's top edge (half on the glass, half over the
   stage); landscape: a row after the transport. A tap turns sound on in its
   own click handler (the gesture that unlocks audio), fills, draws its
   waves, holds 900 ms and fades while the top-bar toggle rings once. After
   the viewer has moved on 3 beats with it showing it retires for the
   session (ignoring it is not a choice: nothing is stored). Once audio has
   run on this page (any first gesture, not only the chip) the director
   retires it too, and `running` stays true through the director's own idle
   suspend, so a long pause never brings it back.
   ========================================================================= */

let rangThisPage = false

export function SoundChip({ shell }: { shell: string }) {
  const loaded = useStoryStore((s) => s.loaded)
  const view = useStoryStore((s) => s.view)
  const sheet = useStoryStore((s) => s.sheet)
  const mode = useStoryStore((s) => s.mode)
  const index = useStoryStore((s) => s.index)
  const phase = useStoryStore((s) => s.phase)
  const reduced = useStoryStore((s) => s.reduced)
  const beats = useStoryStore((s) => s.def?.beats.length ?? 1)
  // H.72: only a story with narration asks
  const narrated = useStoryStore((s) => isNarrated(s.def))
  const running = useSoundUi((s) => s.running)
  const undecided = useSoundUi((s) => s.undecided)
  const enabled = useSoundUi((s) => s.enabled)
  const forcedOff = useSoundUi((s) => s.forcedOff)
  const retired = useSoundUi((s) => s.chipRetired)
  const [ready, setReady] = useState(false)
  const [confirm, setConfirm] = useState<'none' | 'on' | 'leaving'>('none')
  const moved = useRef<{ last: number; n: number }>({ last: -1, n: 0 })
  const ref = useRef<HTMLButtonElement>(null)
  const [ringOn, setRingOn] = useState(false)

  // 1.2 s after the chapter is loaded
  useEffect(() => {
    setReady(false)
    if (!loaded) return
    const t = window.setTimeout(() => setReady(true), 1200)
    return () => window.clearTimeout(t)
  }, [loaded, view])

  const landscape = shell === 'landscape'
  const lastDone = index >= beats - 1 && phase === 'done'
  const want =
    narrated &&
    ready &&
    mode === 'story' &&
    !sheet &&
    !forcedOff &&
    (undecided || enabled) &&
    !(landscape && lastDone) &&
    // the tap's own confirmation plays out even though the director retires the chip as sound starts
    (confirm !== 'none' || (!retired && !running))

  // retire after the viewer has moved on 3 beats with the chip showing
  useEffect(() => {
    const m = moved.current
    if (!want || confirm !== 'none') {
      m.last = index
      return
    }
    if (m.last >= 0 && index !== m.last) m.n++
    m.last = index
    if (m.n >= 3) {
      useSoundUi.setState((s) => ({ chipRetired: true, ring: s.ring + 1 }))
    }
  }, [index, want, confirm])

  // the tap: fill, draw the waves, hold 900 ms, fade 160 ms, ring the toggle
  useEffect(() => {
    if (confirm === 'on') {
      const t = window.setTimeout(() => setConfirm('leaving'), 900)
      return () => window.clearTimeout(t)
    }
    if (confirm === 'leaving') {
      useSoundUi.setState((s) => ({ ring: s.ring + 1 }))
      const t = window.setTimeout(() => {
        useSoundUi.setState({ chipRetired: true })
        setConfirm('none')
      }, 170)
      return () => window.clearTimeout(t)
    }
  }, [confirm])

  const shown = want
  // sound started from another gesture (Pause, a step, a stage tap) while the chip was up: the chip
  // leaves and the toggle rings once, showing where the control lives (I.5.1)
  const wasAsking = useRef(false)
  useEffect(() => {
    // (a tap on the chip itself rings once, at the end of its own confirmation)
    if (running && wasAsking.current && confirm === 'none') useSoundUi.setState((s) => ({ ring: s.ring + 1 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  useEffect(() => {
    wasAsking.current = shown && confirm === 'none'
  })
  useEffect(() => {
    bumpObstacles()
    if (shown && !rangThisPage && !reduced) {
      // one attention ring per page
      rangThisPage = true
      setRingOn(true)
      const t = window.setTimeout(() => setRingOn(false), 1900)
      return () => window.clearTimeout(t)
    }
  }, [shown, reduced])

  const rect = useCallback((): Rect | null => {
    const el = ref.current
    if (!el || landscape) return null
    const st = el.closest('.st-stage')
    if (!st) return null
    const r = el.getBoundingClientRect()
    const s = st.getBoundingClientRect()
    if (!r.width) return null
    return { x: r.left - s.left - 4, y: r.top - s.top - 4, w: r.width + 8, h: r.height + 8 }
  }, [landscape])
  useObstacle('sound-chip', rect)

  if (!shown) return null
  const ring = ringOn && confirm === 'none'
  return (
    <button
      ref={ref}
      type="button"
      data-sound-control
      data-no-gesture
      className={`st-soundchip${landscape ? ' st-soundchip--row' : ''}${confirm !== 'none' ? ' is-on' : ''}${confirm === 'leaving' ? ' is-leaving' : ''}${ring ? ' is-ring' : ''}`}
      aria-label="Turn on sound: narration and sound effects"
      onClick={() => {
        if (confirm !== 'none') return
        soundOn('chip')
        setConfirm('on')
      }}
    >
      <IconSoundOn draw={confirm !== 'none'} />
      <span className="st-soundchip-l">Sound on</span>
    </button>
  )
}
