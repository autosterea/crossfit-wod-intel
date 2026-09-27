import * as THREE from 'three'
import { focusRect } from '../../story/camera/focusRect'
import { hudBox } from '../../story/ui/Hud'
import { registry } from '../../story/labels/registry'
import type { ChartFrame } from '../../story/kit/chartFrame'
import type { Rect } from '../../story/types'

/* =========================================================================
   Pathways annotation layout (review r1). The engine placer tries fixed
   compass sides around an anchor; on a 390 px phone the top-left corner of
   this chart (the HUD glass on the right, the steep envelope below) and the
   benchmark cluster (three pins inside 26 px) have no compass side that is
   free, so the 1RM chip and the P1 callout went missing and the cluster
   names floated without leaders. This module lays those out in stage px,
   once per frame between the camera (-90) and the label placer (-80):

   FLAG (the cursor callout, the P5 result chips, the P6 Fran chip, the
   Marathon chip): the pill sits in the dark space ABOVE the envelope. It
   starts over its node (a pole: the cursor line continues up to it) and,
   while that spot is taken (the HUD glass, a cluster name), slides right,
   where the falling envelope lets it sit lower, beside the node. Its bottom
   keeps 8 px over the envelope along its whole width, so it never covers
   the data it describes. The label is anchored at the pill's bottom-left
   corner (prefer NE, gap 0), so the placer puts it exactly there and still
   checks it; the connector is drawn in the scene.

   CLUSTER (Fran, 1 Mile Run, 2k Row): LOW puts each name beside its own pin
   (Fran over it, the other two to its right), each with a short leader;
   HIGH (used when a pole must pass the cluster, at the 5k stop) is a
   staircase up and to the left: Fran lowest, 1 Mile Run, 2k Row on top,
   each right-aligned at its own pin with a vertical leader. No leader may
   cross a name.

   Everything is a pure function of the geometry of this frame (T, the
   camera, the focus rect, the HUD rect and the measured label widths).
   ========================================================================= */

export interface Box extends Rect {
  on: boolean
}
export const newBox = (): Box => ({ x: 0, y: 0, w: 0, h: 0, on: false })

/* ------------------------------ px map -------------------------------- */

/**
 * world <-> stage px on the chart plane (z = 0). The story camera is
 * front-on, so the map is affine and separable (px(x), py(y)). Explore's
 * Orbit can turn the chart away (az +/-45, el 0 to 35): then the map is
 * projective, `affine` goes false (review r2), and the explore chips fall
 * back to plain anchored placement instead of this layout.
 */
export class PxMap {
  ax = 0
  bx = 1
  ay = 0
  by = -1
  /** the separable map predicts the two other chart corners within 1.5 px */
  affine = true
  private v = new THREE.Vector3()
  private sx(): number {
    return ((this.v.x + 1) / 2) * focusRect.W
  }
  private sy(): number {
    return ((1 - this.v.y) / 2) * focusRect.H
  }
  update(camera: THREE.Camera, f: ChartFrame): void {
    camera.updateMatrixWorld()
    const v = this.v
    v.set(f.x(0), f.y(0), 0).project(camera)
    const x0 = this.sx()
    const y0 = this.sy()
    v.set(f.x(1), f.y(f.vMax), 0).project(camera)
    const x1 = this.sx()
    const y1 = this.sy()
    const dx = f.x(1) - f.x(0)
    const dy = f.y(f.vMax) - f.y(0)
    if (!Number.isFinite(x1 - x0) || Math.abs(x1 - x0) < 1e-3 || Math.abs(y1 - y0) < 1e-3) return
    this.bx = (x1 - x0) / dx
    this.ax = x0 - this.bx * f.x(0)
    this.by = (y1 - y0) / dy
    this.ay = y0 - this.by * f.y(0)
    // the other two corners: where a separable map puts them vs where they project
    v.set(f.x(1), f.y(0), 0).project(camera)
    let err = Math.max(Math.abs(this.sx() - x1), Math.abs(this.sy() - y0))
    v.set(f.x(0), f.y(f.vMax), 0).project(camera)
    err = Math.max(err, Math.abs(this.sx() - x0), Math.abs(this.sy() - y1))
    this.affine = err < 1.5
  }
  px(wx: number): number {
    return this.ax + this.bx * wx
  }
  py(wy: number): number {
    return this.ay + this.by * wy
  }
  wx(sx: number): number {
    return (sx - this.ax) / this.bx
  }
  wy(sy: number): number {
    return (sy - this.ay) / this.by
  }
}

/* ------------------------------ helpers ------------------------------- */

/** The placer's bounds: the focus rect minus 8 px. */
export function boundsInto(out: Rect): Rect {
  out.x = focusRect.x + 8
  out.y = focusRect.y + 8
  out.w = focusRect.w - 16
  out.h = focusRect.h - 16
  return out
}

/**
 * A label's size in px: measured by the label layer once it is live,
 * estimated otherwise. The measure is used only while it is of the label's
 * CURRENT text (the layer measures during placement, after this layout has
 * run, so a text written this frame would otherwise be sized by the last
 * one; review r2): a stale measure falls back to the estimate for the one
 * frame until the layer re-measures.
 */
export function sizeInto(id: string, text: string, tone: 'callout' | 'name', out: { w: number; h: number }): void {
  const e = registry.get(id)
  if (e && e.w > 0 && e.measured) {
    const mc = e.spec.minChars
    const key = mc && e.text.length <= mc ? '#' + mc : e.text
    if (e.measured.startsWith(key + '|')) {
      out.w = e.w
      out.h = e.h
      return
    }
  }
  const desk = focusRect.shell === 'desktop'
  if (tone === 'callout') {
    out.w = text.length * (desk ? 8 : 7.4) + 20
    out.h = desk ? 25 : 23
  } else {
    out.w = text.length * (desk ? 7.6 : 7.1) + 4
    out.h = desk ? 16 : 15
  }
}

/*
 * An exact, history-free pill size for a callout text (review r2): a label
 * is measured by the layer only once it is live, so a chip that is shown
 * only if it fits (the stamped readings, the tags, full or short) would
 * otherwise decide on an estimate or on a stale measure, and a deep link
 * and a scrub could decide differently. A hidden probe with the SAME label
 * classes, inside the label layer (so it inherits the stage's type), is
 * measured once per text, shell and font state.
 */
interface ProbeSize {
  w: number
  h: number
  mc: number
  shell: string
  fonts: string
}
/** keyed by the text itself (no key string built per frame); a size is re-measured when the shell, the fonts or the reservation change */
const probeCache = new Map<string, ProbeSize>()
let probe: HTMLDivElement | null = null
let probeTxt: HTMLSpanElement | null = null
let layerEl: Element | null = null
export function measureCallout(text: string, out: { w: number; h: number }, minChars = 0): void {
  const fonts = typeof document !== 'undefined' && document.fonts ? document.fonts.status : 'loaded'
  const hit = probeCache.get(text)
  if (hit && hit.mc === minChars && hit.shell === focusRect.shell && hit.fonts === fonts) {
    out.w = hit.w
    out.h = hit.h
    return
  }
  if (!layerEl || !layerEl.isConnected) layerEl = typeof document !== 'undefined' ? document.querySelector('.st-labels') : null
  const layer = layerEl
  if (!layer) {
    sizeInto('', text, 'callout', out)
    return
  }
  if (!probe || !probe.isConnected || probe.parentElement !== layer) {
    probe = document.createElement('div')
    probe.className = 'st-lbl st-lbl--callout'
    probe.setAttribute('aria-hidden', 'true')
    probe.style.visibility = 'hidden'
    probeTxt = document.createElement('span')
    probeTxt.className = 'st-lbl-t'
    probe.appendChild(probeTxt)
    layer.appendChild(probe)
  }
  if (probeTxt) {
    probeTxt.textContent = text
    // the layer reserves minChars on the text span (a readout that counts keeps its width)
    probeTxt.style.minWidth = minChars ? `${minChars}ch` : ''
  }
  const w = probe.offsetWidth
  const h = probe.offsetHeight
  if (w <= 0) {
    sizeInto('', text, 'callout', out)
    return
  }
  // bounded: the cursor's texts are finite (durations x shares), but never let it grow without end
  if (probeCache.size > 600) probeCache.clear()
  probeCache.set(text, { w, h, mc: minChars, shell: focusRect.shell, fonts })
  out.w = w
  out.h = h
}

export interface Blockers {
  r: Rect[]
  n: number
}
export const newBlockers = (cap: number): Blockers => ({ r: Array.from({ length: cap }, () => ({ x: 0, y: 0, w: 0, h: 0 })), n: 0 })
export function addBlocker(b: Blockers, x: number, y: number, w: number, h: number): void {
  if (b.n >= b.r.length) return
  const r = b.r[b.n++]
  r.x = x
  r.y = y
  r.w = w
  r.h = h
}
/** The HUD glass (when it shows), padded. */
export function addHud(b: Blockers, pad = 6): void {
  if (hudBox.opacity > 0.01 && hudBox.w > 0) addBlocker(b, hudBox.x - pad, hudBox.y - pad, hudBox.w + 2 * pad, hudBox.h + 2 * pad)
}

const hit = (ax: number, ay: number, aw: number, ah: number, r: Rect, tol = 0) =>
  ax < r.x + r.w - tol && ax + aw > r.x + tol && ay < r.y + r.h - tol && ay + ah > r.y + tol

/** The surface a pill must stay above: stage y of the curve's top at stage x. */
export type Floor = (sx: number) => number

function floorMin(floor: Floor, x0: number, x1: number): number {
  let m = Infinity
  const n = Math.max(2, Math.ceil((x1 - x0) / 8))
  for (let s = 0; s <= n; s++) m = Math.min(m, floor(x0 + ((x1 - x0) * s) / n))
  return m
}

/** Does the connector from the node (nx, ny) to (cx, cy) run through a blocker (the first 6 px, the node's own glow, excepted)? */
function linkBlocked(nx: number, ny: number, cx: number, cy: number, bl: Blockers): boolean {
  const len = Math.hypot(cx - nx, cy - ny)
  if (len < 8) return false
  const n = Math.min(24, Math.ceil(len / 4))
  for (let s = 0; s <= n; s++) {
    const t = (6 + ((len - 6) * s) / n) / len
    const x = nx + (cx - nx) * t
    const y = ny + (cy - ny) * t
    for (let i = 0; i < bl.n; i++) {
      const r = bl.r[i]
      if (x > r.x + 1 && x < r.x + r.w - 1 && y > r.y + 1 && y < r.y + r.h - 1) return true
    }
  }
  return false
}

/* ------------------------------- flag --------------------------------- */

export interface Flag extends Box {
  /** node (px) and the connector's end on the pill (px) */
  nx: number
  ny: number
  cx: number
  cy: number
}
export const newFlag = (): Flag => ({ ...newBox(), nx: 0, ny: 0, cx: 0, cy: 0 })

/**
 * Place a w x h pill for the node (nx, ny): over the node if it can, else
 * slid right; its bottom `margin` px over the floor along its width, lifted
 * over any blocker in its column. [xMin, xMax] is the span the pill may use
 * (the power axis on the left, the Marathon leader's lane on the right);
 * yTop is the highest its top may go (the focus rect by default; explore's
 * Marathon keeps inside the oxidative lane).
 */
export function solveFlag(f: Flag, nx: number, ny: number, w: number, h: number, floor: Floor, xMin: number, xMax: number, bl: Blockers, B: Rect, margin = 8, yTop = -Infinity): void {
  const top = Math.max(B.y, yTop)
  const L = Math.max(B.x, xMin)
  const R = Math.min(B.x + B.w, xMax) - w
  f.nx = nx
  f.ny = ny
  f.w = w
  f.h = h
  const x0 = Math.max(L, Math.min(R, nx))
  let found = false
  for (let x = x0; x <= R + 0.001; x += 1) {
    // the envelope's obstacle squares reach 5 px either side of each sample: look that far beyond the pill
    let yb = floorMin(floor, x - 7, x + w + 7) - margin
    for (let pass = 0; pass < 8; pass++) {
      let lifted = false
      for (let i = 0; i < bl.n; i++) {
        const r = bl.r[i]
        if (hit(x, yb - h, w, h, r)) {
          yb = r.y - 3
          lifted = true
        }
      }
      if (!lifted) break
    }
    if (yb - h < top) continue
    // and its connector must not run through another chip, name or pole (review r2: a leader across a stamped reading hid it)
    if (linkBlocked(nx, ny, Math.max(x, Math.min(x + w, nx)), Math.max(yb - h, Math.min(yb, ny)), bl)) continue
    f.x = x
    f.y = yb - h
    found = true
    break
  }
  if (!found) {
    f.x = x0
    f.y = floorMin(floor, x0 - 7, x0 + w + 7) - margin - h
  }
  f.on = found
  f.cx = Math.max(f.x, Math.min(f.x + w, nx))
  f.cy = Math.max(f.y, Math.min(f.y + h, ny))
}

/**
 * A flag with a full text and a short one (review r2: the stamped readings
 * and the P5 tags). The full text is tried first; the pill may slide at most
 * `slack` px right of its node, so it never drifts away from what it
 * describes. Returns 1 (full), 2 (short) or 0 (neither found a free spot).
 */
export function solveFlagFit(f: Flag, nx: number, ny: number, wF: number, hF: number, wS: number, hS: number, floor: Floor, xMin: number, slack: number, bl: Blockers, B: Rect): 0 | 1 | 2 {
  solveFlag(f, nx, ny, wF, hF, floor, xMin, nx + wF + slack, bl, B)
  if (f.on) return 1
  solveFlag(f, nx, ny, wS, hS, floor, xMin, nx + wS + slack, bl, B)
  return f.on ? 2 : 0
}

/** Add a placed flag, its pill and the connector under it, as blockers. */
export function blockFlag(b: Blockers, f: Flag): void {
  addBlocker(b, f.x - 3, f.y - 3, f.w + 6, f.h + 6)
  addBlocker(b, Math.min(f.nx, f.cx) - 4, Math.min(f.cy, f.ny), Math.abs(f.nx - f.cx) + 8, Math.abs(f.ny - f.cy))
}

/* ------------------------------ cluster ------------------------------- */

export interface Cluster {
  /** 0 LOW, 1 HIGH, -1 none placed */
  layout: number
  r: Box[]
  /** leader: from the pin (px, py) to the name (ex, ey) */
  px: number[]
  py: number[]
  ex: number[]
  ey: number[]
}
export const newCluster = (): Cluster => ({ layout: -1, r: [newBox(), newBox(), newBox()], px: [0, 0, 0], py: [0, 0, 0], ex: [0, 0, 0], ey: [0, 0, 0] })

const _cand = [newBox(), newBox(), newBox()]

/** The leader from (x0, y0) to the nearest point of r, sampled: does it pass through q? */
function leaderHits(x0: number, y0: number, r: Rect, q: Rect): boolean {
  const x1 = Math.max(r.x, Math.min(r.x + r.w, x0))
  const y1 = Math.max(r.y, Math.min(r.y + r.h, y0))
  for (let i = 1; i < 12; i++) {
    const x = x0 + ((x1 - x0) * i) / 12
    const y = y0 + ((y1 - y0) * i) / 12
    if (x > q.x + 1 && x < q.x + q.w - 1 && y > q.y + 1 && y < q.y + q.h - 1) return true
  }
  return false
}

function valid(c: Box[], show: readonly boolean[], pxs: readonly number[], pys: readonly number[], floor: Floor, bl: Blockers, B: Rect, poleX: number | null, poleY: number): boolean {
  for (let k = 0; k < 3; k++) {
    if (!show[k]) continue
    const r = c[k]
    if (r.x < B.x || r.y < B.y || r.x + r.w > B.x + B.w || r.y + r.h > B.y + B.h) return false
    // the placer squares each envelope sample by 5 px: keep 7 px clear of the curve, a little beyond each end
    if (r.y + r.h + 7 > floorMin(floor, r.x - 5, r.x + r.w + 5)) return false
    for (let i = 0; i < bl.n; i++) if (hit(r.x, r.y, r.w, r.h, bl.r[i])) return false
    for (let j = 0; j < 3; j++) {
      if (j === k || !show[j]) continue
      if (j > k && hit(r.x - 3, r.y - 2, r.w + 6, r.h + 4, c[j])) return false
      // no leader crosses another name
      if (leaderHits(pxs[k], pys[k], r, c[j])) return false
    }
    if (poleX !== null && poleX > r.x - 4 && poleX < r.x + r.w + 4 && r.y < poleY) return false
  }
  return true
}

/**
 * Lay out the three cluster names (pins in axis order: Fran, 1 Mile Run,
 * 2k Row) given their pin heads (px), sizes and which show. poleX / poleY:
 * a vertical line rising from (poleX, poleY) that no name may sit on (the
 * cursor's pole to its chip), or null. Candidates, first valid wins:
 *   LOW   Fran over its pin, 1 Mile Run right of its pin, 2k Row right of
 *         its own pin, else under 1 Mile Run, else to the right of it (its
 *         leader running under 1 Mile Run's name);
 *   HIGH  a staircase up and to the left, each name right-aligned at its pin.
 */
export function solveCluster(
  out: Cluster,
  pxs: readonly number[],
  pys: readonly number[],
  ws: readonly number[],
  hs: readonly number[],
  show: readonly boolean[],
  floor: Floor,
  bl: Blockers,
  B: Rect,
  poleX: number | null,
  poleY: number,
): void {
  const c = _cand
  for (let k = 0; k < 3; k++) {
    c[k].w = ws[k]
    c[k].h = hs[k]
  }
  let layout = -1
  for (let v = 0; v < 4 && layout < 0; v++) {
    c[0].x = pxs[0] - ws[0] / 2
    c[1].x = pxs[1] + 5
    if (show[0] && show[1] && c[0].x + ws[0] > c[1].x - 4) c[0].x = c[1].x - 4 - ws[0]
    c[2].x = pxs[2] + 5
    if (show[1] && show[2] && v >= 2) c[2].x = c[1].x + ws[1] + 5
    // each name just over its pin, lifted clear of the envelope along its width
    c[0].y = Math.min(pys[0] - 9, floorMin(floor, c[0].x - 5, c[0].x + ws[0] + 5) - 8) - hs[0]
    c[1].y = Math.min(pys[1] - 8, floorMin(floor, c[1].x - 5, c[1].x + ws[1] + 5) - 8) - hs[1]
    c[2].y = Math.min(pys[2] - 8, floorMin(floor, c[2].x - 5, c[2].x + ws[2] + 5) - 8) - hs[2]
    if (show[1] && show[2]) {
      if (v === 1) c[2].y = c[1].y + hs[1] + 3
      else if (v === 3) c[2].y = c[1].y
    } else if (v > 0) break
    if (valid(c, show, pxs, pys, floor, bl, B, poleX, poleY)) layout = 0
  }
  if (layout < 0) {
    let above = Infinity
    for (let k = 0; k < 3; k++) {
      let right = pxs[k] + 4
      // a lower name must end before the next pin's leader rises past it
      for (let j = k + 1; j < 3; j++) if (show[j]) right = Math.min(right, pxs[j] - 4)
      const left = right - ws[k]
      c[k].x = left
      c[k].y = Math.min(pys[k] - 9, floorMin(floor, left - 5, right + 5) - 8, above - 3) - hs[k]
      if (show[k]) above = c[k].y
    }
    if (valid(c, show, pxs, pys, floor, bl, B, poleX, poleY)) layout = 1
  }
  out.layout = layout
  for (let k = 0; k < 3; k++) {
    const r = out.r[k]
    if (layout < 0) {
      // nothing fits cleanly: beside each pin, and the placer sorts it out
      r.x = pxs[k] + 5
      r.y = pys[k] - 8 - hs[k]
    } else {
      r.x = c[k].x
      r.y = c[k].y
    }
    r.w = ws[k]
    r.h = hs[k]
    r.on = show[k]
    out.px[k] = pxs[k]
    out.py[k] = pys[k]
    out.ex[k] = Math.max(r.x, Math.min(r.x + r.w, pxs[k]))
    out.ey[k] = Math.max(r.y, Math.min(r.y + r.h, pys[k]))
  }
}

/** Write v into sig[i] when it moved more than 0.25 px; true when it did (no closure per frame). */
export function putSig(sig: Float64Array, i: number, v: number): boolean {
  if (Math.abs(sig[i] - v) <= 0.25) return false
  sig[i] = v
  return true
}

/** Add a laid-out box as a blocker (padded). */
export function blockBox(b: Blockers, r: Box, pad = 3): void {
  if (r.on) addBlocker(b, r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad)
}
