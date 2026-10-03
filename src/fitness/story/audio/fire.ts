import { playCont, playOne, type ContSpec, type Mix } from './palette'
import type { PlannedEvent } from './plan'
import type { Bed } from './bed'

/* =========================================================================
   One planned event -> sound (shared by the phone and the offline render,
   so they schedule identically). `u0` starts a continuous event part-way
   (a resume, sound turned on mid-window).
   ========================================================================= */

export function fireEvent(m: Mix, bed: Bed | null, e: PlannedEvent, when: number, build: number, u0 = 0): void {
  if (e.sound === 'resolve' || e.sound === 'resolve.fall') {
    if (u0 > 0) return // a claim that already struck is never replayed
    const s = e.shape
    const dur = s ? (s.b - s.a) * build : 0.9
    playCont(m, e.sound, when, spec(e, dur, 0))
    // the claim is answered by the room, not by a chime (I.2.5)
    if (e.sound === 'resolve') bed?.answerIn(when)
    else bed?.fall(when)
    return
  }
  if (e.cont && e.shape) {
    const dur = (e.tb - e.t) * build
    playCont(m, e.sound, when, spec(e, dur, Math.max(e.u0, u0)))
    return
  }
  playOne(m, e.sound, when, { gain: e.gain, pan: typeof e.pan === 'number' ? e.pan : 0, pitch: e.pitch, seed: e.seed, ring: e.ring })
  if (e.endTick && e.shape) playOne(m, 'tick.label', when + (e.shape.b - e.shape.a) * build, { gain: e.gain, pan: 0, pitch: e.pitch, seed: e.seed + 1 })
}

function spec(e: PlannedEvent, dur: number, u0: number): ContSpec {
  const s = e.shape
  const span = s ? Math.max(1e-6, s.b - s.a) : 1
  const rate = e.rate
  return {
    dur,
    speed: s ? s.speed : FLAT,
    prog: s ? s.prog : FLAT,
    u0,
    gain: e.gain,
    pan: e.pan,
    pitch: e.pitch,
    seed: e.seed,
    half: s ? (s.half - s.a) / span : 0.5,
    duck: e.duck,
    rate: rate && s ? (u: number) => rate(s.a + span * u) : undefined,
  }
}

const FLAT = new Float32Array(32).fill(1)
