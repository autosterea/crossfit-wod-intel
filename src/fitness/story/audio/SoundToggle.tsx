import { useEffect, useRef, useState } from 'react'
import { useStoryStore } from '../store'
import { soundOff, soundOn, useSoundUi } from './director'
import { IconSoundOff, IconSoundOn } from './icons'
import { isNarrated } from './narration'
import './audio.css'

/* =========================================================================
   The top-bar sound toggle (DESIGN.md I.5.2): it always holds the state.
   Off: a speaker with an x. On: a speaker with two waves. Waiting (on, but
   the browser has not unlocked audio, or the device interrupted it): the on
   icon dimmed plus a small dot; a tap here STARTS sound (its own handler;
   the unlock listener ignores [data-sound-control], so a tap is never
   counted twice). The director's own idle suspend (nothing audible for 12 s,
   I.3.6) is NOT Waiting: `running` stays true, the toggle shows On and a
   tap turns sound off. aria-label "Sound" never changes; aria-pressed says
   on or off. Nothing animates here while the voice plays: the chrome stays
   quiet.
   ========================================================================= */

export function SoundToggle() {
  // only while a NARRATED story is mounted (H.72): a story without narration has no sound at all
  const hasStory = useStoryStore((s) => isNarrated(s.def))
  const enabled = useSoundUi((s) => s.enabled)
  const running = useSoundUi((s) => s.running)
  const ring = useSoundUi((s) => s.ring)
  const waiting = enabled && !running
  const [ringing, setRinging] = useState(false)
  const [status, setStatus] = useState('')
  const first = useRef(true)

  // ring once when the chip hands the control over (used or retired)
  useEffect(() => {
    if (!ring) return
    setRinging(true)
    const t = window.setTimeout(() => setRinging(false), 650)
    return () => window.clearTimeout(t)
  }, [ring])

  // announce changes (not the initial state)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setStatus(running ? 'Sound on' : enabled ? '' : 'Sound off')
  }, [running, enabled])

  const onClick = () => {
    if (!enabled || waiting) soundOn('toggle')
    else soundOff()
  }

  const state = !enabled ? 'off' : waiting ? 'waiting' : 'on'
  if (!hasStory) return null
  return (
    <span className={`st-sound${ringing ? ' is-ring' : ''}`} data-state={state}>
      <button
        type="button"
        className="st-sound-btn"
        data-sound-control
        aria-label="Sound"
        aria-pressed={enabled}
        aria-describedby={waiting ? 'st-sound-wait' : undefined}
        title={enabled && !waiting ? 'Turn sound off (M)' : 'Turn sound on (M)'}
        onClick={onClick}
      >
        {enabled ? <IconSoundOn /> : <IconSoundOff />}
        {waiting && <span className="st-sound-dot" aria-hidden="true" />}
      </button>
      <span id="st-sound-wait" className="st-sr">
        Tap to start sound
      </span>
      <span className="st-sr" role="status">
        {status}
      </span>
    </span>
  )
}
