import * as THREE from 'three'
import { focusRect } from '../../story/camera/focusRect'
import type { V3 } from '../../story/types'

/* =========================================================================
   Screen-anchored annotation tags (S1 to S4). A callout names something on
   the wheel from the free space around it, joined by a pen-drawn leader.
   The free space depends on the viewport, not on world units: a phone's
   focus rect is tall (free bands above and below the wheel), a landscape
   one is wide (four empty corners around the circle). So each tag is a
   SCREEN point in the focus rect, turned into a world point on the tag's
   plane through the live camera, every placement pass. The callout label
   and its leader read the same point, so they always meet.
   ========================================================================= */

export type Slot = 'TL' | 'TR' | 'BL' | 'BR'

/** The live stage camera (set by the scene). */
export const tagCam: { cam: THREE.Camera | null } = { cam: null }

const _o = new THREE.Vector3()
const _d = new THREE.Vector3()
const _p = new THREE.Vector3()

/** World y of the top and bottom of the name ring, projected (stage px). */
function ringScreenY(cam: THREE.Camera, y: number, z: number): number {
  _p.set(0, y, z).project(cam)
  return ((1 - _p.y) / 2) * focusRect.H
}

/**
 * Write the world point of a tag into `out` (on the plane z) and return it.
 * wPx / hPx: the tag's size (its callout pill), so it sits inside the rect.
 * ringR: the outer radius of the wheel's name ring (world), whose projected
 * top and bottom bound the free bands on a portrait rect.
 */
export function tagPoint(slot: Slot, wPx: number, hPx: number, z: number, ringR: number, out: [number, number, number]): V3 {
  const cam = tagCam.cam
  if (!cam) {
    out[0] = slot[1] === 'L' ? -12 : 12
    out[1] = slot[0] === 'T' ? 14 : -14
    out[2] = z
    return out
  }
  cam.updateMatrixWorld()
  const f = focusRect
  const left = slot[1] === 'L'
  const top = slot[0] === 'T'
  const sx = left ? f.x + 12 + wPx / 2 : f.x + f.w - 12 - wPx / 2
  let sy: number
  if (f.layout === 'P') {
    // centred in the free band between the rect edge and the name ring
    const ring = ringScreenY(cam, top ? ringR : -ringR, z)
    const edge = top ? f.y + 8 : f.y + f.h - 8
    sy = (ring + edge) / 2
    // never closer than the pill to the edge
    sy = top ? Math.max(sy, f.y + 12 + hPx / 2) : Math.min(sy, f.y + f.h - 12 - hPx / 2)
  } else {
    sy = top ? f.y + 14 + hPx / 2 : f.y + f.h - 14 - hPx / 2
  }
  // unproject the stage pixel onto the plane z
  const nx = (sx / f.W) * 2 - 1
  const ny = 1 - (sy / f.H) * 2
  _o.setFromMatrixPosition(cam.matrixWorld)
  _d.set(nx, ny, 0.5).unproject(cam).sub(_o)
  const t = Math.abs(_d.z) > 1e-9 ? (z - _o.z) / _d.z : 0
  out[0] = _o.x + _d.x * t
  out[1] = _o.y + _d.y * t
  out[2] = z
  return out
}

/** An approximate callout pill size for a text (13 px condensed caps; 14 px on desktop). */
export function pillSize(text: string): [number, number] {
  const desktop = focusRect.shell === 'desktop'
  return [Math.round(18 + text.length * (desktop ? 8.1 : 7.5)), desktop ? 26 : 24]
}
