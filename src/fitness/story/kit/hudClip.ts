import * as THREE from 'three'
import { gestureBus } from '../gestures'
import { focusRect } from '../camera/focusRect'
import { hudBox } from '../ui/Hud'
import { pinBox } from '../labels/LabelLayer'

/* =========================================================================
   hudClipX (amendment H.45): keep a horizontal world line clear of the DOM
   glass over the stage's top-right corner: the HUD chip and a pinned legend
   key. A gridline that runs under glass shows through it and looks
   unplanned; this returns the world x where the line from x0 to x1 at height
   y must stop so it ends `marginPx` before the glass, blended by the glass's
   opacity (the line retracts as the chip fades in). x1 when the line does not
   pass under either. Call it inside a pen `update` writer: the camera and the
   labels are already placed for this frame. Allocation-free.
   ========================================================================= */

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const BOXES = [hudBox, pinBox]

export function hudClipX(x0: number, x1: number, y: number, z = 0, marginPx = 8): number {
  const cam = gestureBus.camera
  if (!cam) return x1
  let out = x1
  let projected = false
  let ax = 0
  let bx = 0
  let sy = 0
  for (const box of BOXES) {
    if (box.opacity <= 0.01 || box.w <= 0) continue
    if (!projected) {
      _a.set(x0, y, z).project(cam)
      _b.set(x1, y, z).project(cam)
      ax = ((_a.x + 1) / 2) * focusRect.W
      bx = ((_b.x + 1) / 2) * focusRect.W
      sy = ((1 - (_a.y + _b.y) / 2) / 2) * focusRect.H
      projected = true
    }
    // the line passes under this glass only if its screen y is inside the glass's band
    if (sy < box.y - 3 || sy > box.y + box.h + 3) continue
    const stop = box.x - marginPx
    if (bx <= stop || Math.abs(bx - ax) < 1e-3) continue
    const f = Math.max(0, Math.min(1, (stop - ax) / (bx - ax)))
    const xc = x0 + (x1 - x0) * f
    const k = Math.min(1, box.opacity * 1.5)
    out = Math.min(out, x1 + (xc - x1) * k)
  }
  return out
}
