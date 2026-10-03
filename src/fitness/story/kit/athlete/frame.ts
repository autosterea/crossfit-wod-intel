import { createRig, type Placement } from './driver'
import { bodyLayout, boundsOf, writeBody } from './mesh'
import type { MoveKey } from './moves'
import type { Faults } from './faults'
import type { Box } from '../../types'

/* =========================================================================
   Framing (story/kit/athlete): the box a camera must fit to keep the whole
   movement in view, every position of the rep (the ball on the floor, the
   ball at the chin, the hips back at the bottom), so the camera never
   moves with the reps (L6).

     cam: { L: { target, az: 0, el: 0, fov: 24, fit: athleteBox('mb-clean', rig.place), padPx } }
   ========================================================================= */

type MutBox = { min: [number, number, number]; max: [number, number, number] }

const cache = new Map<string, MutBox>()

/**
 * The movement's bounds in the athlete's own metres (sampled over the rep
 * at 64 phases from the real surface, optionally with faults applied too).
 */
export function movementBounds(move: MoveKey, faults?: Partial<Faults>): MutBox {
  const key = move + (faults ? JSON.stringify(faults) : '')
  const hit = cache.get(key)
  if (hit) return hit
  const L = bodyLayout()
  const pos = new Float32Array(L.count * 3)
  const nrm = new Float32Array(L.count * 3)
  const box: MutBox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  const one: MutBox = { min: [0, 0, 0], max: [0, 0, 0] }
  let phase = 0
  let withFaults = false
  const rig = createRig(() => ({ move, phase, faults: withFaults ? faults : null }))
  let T = 0
  for (const f of faults ? [false, true] : [false]) {
    withFaults = f
    for (let i = 0; i < 64; i++) {
      phase = i / 64
      writeBody(L, rig.pose(++T), pos, nrm)
      boundsOf(pos, L.count, one)
      for (let k = 0; k < 3; k++) {
        box.min[k] = Math.min(box.min[k], one.min[k])
        box.max[k] = Math.max(box.max[k], one.max[k])
      }
    }
  }
  // the floor is the bottom of the frame (soles at y 0)
  box.min[1] = 0
  cache.set(key, box)
  return box
}

/**
 * The world box of a movement for a placement (mid-foot root, scale): the
 * camera's `fit`. `margin` adds metres on every side (room for the outline
 * and the lumbar highlight).
 */
export function athleteBox(move: MoveKey, place: Placement = { x: 0, y: 0, z: 0, s: 1 }, margin = 0.04, faults?: Partial<Faults>): Box {
  const b = movementBounds(move, faults)
  const s = place.s
  return [
    [place.x + (b.min[0] - margin) * s, place.y + b.min[1] * s, place.z + (b.min[2] - margin) * s],
    [place.x + (b.max[0] + margin) * s, place.y + (b.max[1] + margin) * s, place.z + (b.max[2] + margin) * s],
  ] as const
}
