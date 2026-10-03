import { useMemo } from 'react'
import { audio } from './director'
import { fireEvent } from './fire'
import { playCont, playUi, release, type Voice } from './palette'
import type { PlannedEvent } from './plan'
import type { SfxId, UiId } from './types'

/* =========================================================================
   useSfx (DESIGN.md I.6.6): the explore hook. Explore sounds are never
   scheduled from T (explore does not use T). Every call is a no-op unless
   sound is audible; at most 12 one-shots per second per id and 8 explore
   voices at once (inside the director's budgets).
   ========================================================================= */

const lastAt = new Map<string, number[]>()
const MAX_EXPLORE = 8
let exploreVoices: Voice[] = []

function allow(id: string, now: number): boolean {
  const list = (lastAt.get(id) ?? []).filter((t) => t > now - 1)
  if (list.length >= 12) return false
  list.push(now)
  lastAt.set(id, list)
  exploreVoices = exploreVoices.filter((v) => v.end > now)
  return exploreVoices.length < MAX_EXPLORE
}

const FLAT = new Float32Array(32).fill(1)
const RAMP = new Float32Array(32).map((_, i) => i / 31)
const BELL = new Float32Array(32).map((_, i) => Math.sin((Math.PI * (i + 0.5)) / 32))
let seed = 9001

export interface SfxOpts {
  gain?: number
  pan?: number
  pitch?: number
  /** seconds, for continuous sounds (default 1.2) */
  dur?: number
}

export interface HeldSfx {
  /** at most once per frame: level 0..1 and pos 0..1 along the texture's range */
  set(level: number, pos?: number): void
  /** fades over 120 ms */
  release(): void
}

export function useSfx(): { play(id: SfxId | UiId, o?: SfxOpts): void; hold(id: 'pen.slide' | 'pen.scan' | 'pour.fill' | 'pour.drain' | 'rattle'): HeldSfx } {
  return useMemo(
    () => ({
      play(id: SfxId | UiId, o: SfxOpts = {}) {
        const m = audio.mix
        const ctx = audio.ctx
        if (!audio.audible() || !m || !ctx) return
        const now = ctx.currentTime
        if (!allow(id, now)) return
        if (id.startsWith('ui.')) {
          playUi(m, id as UiId, seed++, o.gain ?? 0)
          return
        }
        const dur = o.dur ?? 1.2
        const e: PlannedEvent = {
          name: 'explore',
          sound: id as SfxId,
          cont: true,
          t: 0,
          tb: 1,
          shape: { a: 0, land: 1, half: 0.5, b: 1, speed: BELL, v0: 0, v1: 1, prog: RAMP },
          u0: 0,
          gain: o.gain ?? 0,
          pan: o.pan ?? 0,
          pitch: o.pitch ?? 0,
          seed: seed++,
          duck: [],
        }
        const one = ['tick.dot', 'tick.label', 'tick.claim', 'tick.close', 'tick.steel', 'tick.meet', 'tick.card', 'clack', 'ball.drop', 'flip'].includes(id)
        if (one) e.cont = false
        const before = m.voices.list.length
        fireEvent(m, null, e, now, dur, 0)
        exploreVoices.push(...m.voices.list.slice(before))
      },
      hold(id) {
        let v: Voice | null = null
        let lvl = 0
        return {
          set(level: number, pos = 0.5) {
            const m = audio.mix
            const ctx = audio.ctx
            if (!audio.audible() || !m || !ctx) return
            lvl = Math.max(0, Math.min(1, level))
            if (!v || v.end <= ctx.currentTime) {
              if (id === 'rattle') return
              const now = ctx.currentTime
              if (!allow(id, now)) return
              // a held texture: a long flat window; the level rides its cut gain
              v = playCont(m, id, now, { dur: 30, speed: FLAT, prog: new Float32Array(32).fill(Math.max(0, Math.min(1, pos))), u0: 0, gain: 0, pan: 0, pitch: 0, seed: seed++, half: 0.5, duck: [] })
              if (v) exploreVoices.push(v)
            }
            if (v?.cut) v.cut.gain.setTargetAtTime(lvl, ctx.currentTime, 0.03)
          },
          release() {
            const ctx = audio.ctx
            if (v && ctx) release(ctx, v, ctx.currentTime, 0.12)
            v = null
          },
        }
      },
    }),
    [],
  )
}
