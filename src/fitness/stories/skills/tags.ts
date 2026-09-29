import * as THREE from 'three'
import { focusRect } from '../../story/camera/focusRect'
import type { V3 } from '../../story/types'

/* =========================================================================
   Screen-anchored annotation tags (S1 to S4, explore). A callout names
   something on the wheel from the free space around it, joined by a
   pen-drawn leader. The free space depends on the viewport, not on world
   units: a phone's focus rect is tall (free bands above and below the
   wheel), a landscape one is wide (four empty corners around the circle).
   So each tag is a SCREEN point in the focus rect, turned into a world point
   on the tag's plane through the live camera, every placement pass. The
   callout label and its leader read the same point, so they always meet.
   Nothing here allocates: every caller passes its own output buffer.
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
 * top and bottom bound the free bands on a portrait rect. dxPx moves the
 * point along the pill (a leader that meets the pill off its centre); dyPx
 * moves it across (a leader that stops at the pill's edge).
 */
export function tagPoint(slot: Slot, wPx: number, hPx: number, z: number, ringR: number, out: [number, number, number], dxPx = 0, dyPx = 0): V3 {
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
  const sx = (left ? f.x + 12 + wPx / 2 : f.x + f.w - 12 - wPx / 2) + dxPx
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
  sy += dyPx
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

/* ------------------------------ pill size ------------------------------ */

const widths = new Map<string, number>()
const widthsDesk = new Map<string, number>()

/** An approximate callout pill width for a text (13 px condensed caps; 14 px on desktop), cached per text. */
export function pillW(text: string): number {
  const desktop = focusRect.shell === 'desktop'
  const m = desktop ? widthsDesk : widths
  let w = m.get(text)
  if (w === undefined) {
    w = Math.round(18 + text.length * (desktop ? 8.1 : 7.5))
    m.set(text, w)
  }
  return w
}
/** The callout pill height. */
export const pillH = (): number => (focusRect.shell === 'desktop' ? 26 : 24)

/**
 * The world point where a leader meets its pill: `end` 0 is the centre, 1
 * is 16 px short of the pill's inner end (toward the wheel), -1 16 px short
 * of its outer end. The leader stops at the pill's edge that faces the
 * wheel (its bottom edge for a top tag, its top edge for a bottom one),
 * tucked 1 px under the border, so it never shows through the pill's
 * translucent glass beside the text.
 */
export function tagEnd(slot: Slot, text: string, end: number, z: number, ringR: number, out: [number, number, number]): V3 {
  const w = pillW(text)
  const h = pillH()
  const inward = slot[1] === 'L' ? 1 : -1
  const edge = (slot[0] === 'T' ? 1 : -1) * Math.max(0, h / 2 - 1)
  return tagPoint(slot, w, h, z, ringR, out, inward * end * Math.max(0, w / 2 - 16), edge)
}

/* ------------------------------- leader -------------------------------- */

export const LEAD_A = 4
export const LEAD_B = 8
/** Points in a leader polyline. */
export const LEAD_N = LEAD_A + LEAD_B + 1

/**
 * Write a leader polyline into p: from `a` out to an elbow (at radius elbowR
 * on the angle `elbowDeg`, pulled in so it never passes the tag's own
 * height, so the last leg never doubles back), then to the tag point `b`.
 * elbowDeg null: straight from a to b. The first leg stays at a's depth; the
 * last ends on b's plane, so under a tilted camera it still ends under its pill.
 */
export function writeLeader(p: Float32Array, a: V3, b: V3, elbowDeg: number | null, elbowR: number, top: boolean, run?: { dir: number }): void {
  let ex: number
  let ey: number
  if (run) {
    // out along `dir` until the pill's x, then straight into the pill; if
    // the run would pass the pill's height first, it stops there and the
    // last leg runs level into the pill instead
    const tn = Math.tan((run.dir * Math.PI) / 180)
    ex = b[0]
    ey = a[1] + (b[0] - a[0]) * tn
    if ((top && ey > b[1]) || (!top && ey < b[1])) {
      ey = b[1]
      ex = Math.abs(tn) > 1e-6 ? a[0] + (b[1] - a[1]) / tn : b[0]
    }
  } else if (elbowDeg === null) {
    ex = a[0] + (b[0] - a[0]) * 0.33
    ey = a[1] + (b[1] - a[1]) * 0.33
  } else {
    const ang = (elbowDeg * Math.PI) / 180
    let r = elbowR
    const s = Math.sin(ang)
    // a top tag: the elbow stays below it; a bottom tag: above it
    if (top && s > 1e-3 && r * s > b[1]) r = Math.max(0, b[1] / s)
    if (!top && s < -1e-3 && r * s < b[1]) r = Math.max(0, b[1] / s)
    ex = r * Math.cos(ang)
    ey = r * s
  }
  const ez = a[2]
  for (let i = 0; i <= LEAD_A; i++) {
    const f = i / LEAD_A
    p[i * 3] = a[0] + (ex - a[0]) * f
    p[i * 3 + 1] = a[1] + (ey - a[1]) * f
    p[i * 3 + 2] = a[2]
  }
  for (let i = 1; i <= LEAD_B; i++) {
    const f = i / LEAD_B
    const o = (LEAD_A + i) * 3
    p[o] = ex + (b[0] - ex) * f
    p[o + 1] = ey + (b[1] - ey) * f
    p[o + 2] = ez + (b[2] - ez) * f
  }
}
