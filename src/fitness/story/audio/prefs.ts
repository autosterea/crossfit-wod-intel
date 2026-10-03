import { parseQuery } from '../url'

/* =========================================================================
   The viewer's sound choice (DESIGN.md I, O1): localStorage['fitness-sound']
   is '1' (on), '0' (off) or absent (undecided). ?sound=1 enables sound for
   this page load without storing anything (QA); ?sound=0 forces it off for
   the page and stores nothing. Every storage access is guarded: a private
   window, blocked site data or a thumbnail capture may throw.
   ========================================================================= */

export const PREF_KEY = 'fitness-sound'
export type SoundPref = '1' | '0' | null

export function readPref(): SoundPref {
  try {
    const v = window.localStorage.getItem(PREF_KEY)
    return v === '1' || v === '0' ? v : null
  } catch {
    return null
  }
}

export function writePref(v: '1' | '0'): void {
  try {
    window.localStorage.setItem(PREF_KEY, v)
  } catch {
    /* storage unavailable: the choice lasts this page only */
  }
}

/** ?sound, read once per page load (the query is dropped by navigation). */
let query: 0 | 1 | null | undefined
export function soundQuery(): 0 | 1 | null {
  if (query === undefined) {
    try {
      query = parseQuery().sound
    } catch {
      query = null
    }
  }
  return query
}

/**
 * The tick.dot recipe for this page (amendment H.71, the owner's A/B): 'glass' (contact-led, the default)
 * or 'round' (the H.69 recipe) with `?tick=round`. Read once, from the page's own query, because the
 * transient bank is rendered once per sample rate; the offline render shares that bank, so a render
 * plays exactly what the page plays. Change TICK_DEFAULT to make the owner's choice the default.
 */
export type TickStyle = 'glass' | 'round'
export const TICK_DEFAULT: TickStyle = 'glass'
let tick: TickStyle | undefined
export function tickStyle(): TickStyle {
  if (tick === undefined) {
    try {
      const q = new URLSearchParams(window.location.search).get('tick')
      tick = q === 'round' || q === 'glass' ? q : TICK_DEFAULT
    } catch {
      tick = TICK_DEFAULT
    }
  }
  return tick
}
