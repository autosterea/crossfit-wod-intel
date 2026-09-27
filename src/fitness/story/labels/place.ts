import type { Dir, Rect } from '../types'

/* =========================================================================
   Greedy collision-aware label placement (DESIGN.md C.9). Anchors are
   already projected to stage CSS px. Order per label: preferred direction,
   then the previous direction (hysteresis, H.4), the other compass positions
   nearest first, a slide along the preferred side, up to 3 vertical stagger
   tiers of 18 px with a leader, then the short text, then hidden.

   Pinned labels (legend tone) stack in their corner in pinOrder.

   Allocation-free per frame: a Placer owns pooled rects, outputs and
   candidate buffers and reuses them (C.16). `placeLabels()` is the pure,
   allocating wrapper for tests.
   ========================================================================= */

export interface PlaceInput {
  id: string
  ax: number
  ay: number
  w: number
  h: number
  /** width of the `short` text, or 0 when there is none */
  shortW: number
  gap: number
  prefer: Dir | 'radial'
  /** radial centre in px */
  cx: number
  cy: number
  priority: number
  last: Dir | null
  leader: boolean
  /** draw the leader wherever the label lands, not only when displaced */
  leaderAlways: boolean
  /** pinned labels (legend) skip anchoring and stack in their corner */
  pin: 'top-left' | 'top-right' | null
  pinOrder: number
  /** restrict candidate directions */
  only: readonly Dir[] | undefined
  /** horizontal clearance kept on each side (ticks: 6, so two ticks keep >= 12 px apart) */
  sep: number
}

export interface PlaceOutput {
  id: string
  x: number
  y: number
  w: number
  h: number
  dir: Dir
  short: boolean
  /** leader line from anchor to the label edge */
  hasLeader: boolean
  x1: number
  y1: number
  x2: number
  y2: number
  visible: boolean
}

const ORDER: Dir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const ANG: Record<Dir, number> = { E: 0, NE: 45, N: 90, NW: 135, W: 180, SW: 225, S: 270, SE: 315, C: 0 }
const angDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}
/** For each preferred side: the other seven, nearest first (built once). */
const NEAREST: Record<string, Dir[]> = {}
for (const p of ORDER) NEAREST[p] = ORDER.filter((d) => d !== p).sort((a, b) => angDist(ANG[a], ANG[p]) - angDist(ANG[b], ANG[p]))

export function rectInto(out: Rect, dir: Dir, ax: number, ay: number, w: number, h: number, g: number): Rect {
  const d = g * 0.72
  out.w = w
  out.h = h
  switch (dir) {
    case 'N':
      out.x = ax - w / 2
      out.y = ay - g - h
      break
    case 'S':
      out.x = ax - w / 2
      out.y = ay + g
      break
    case 'E':
      out.x = ax + g
      out.y = ay - h / 2
      break
    case 'W':
      out.x = ax - g - w
      out.y = ay - h / 2
      break
    case 'NE':
      out.x = ax + d
      out.y = ay - d - h
      break
    case 'NW':
      out.x = ax - d - w
      out.y = ay - d - h
      break
    case 'SE':
      out.x = ax + d
      out.y = ay + d
      break
    case 'SW':
      out.x = ax - d - w
      out.y = ay + d
      break
    default:
      out.x = ax - w / 2
      out.y = ay - h / 2
  }
  return out
}

export const rectFor = (dir: Dir, ax: number, ay: number, w: number, h: number, g: number): Rect => rectInto({ x: 0, y: 0, w: 0, h: 0 }, dir, ax, ay, w, h, g)

function nearestDir(angleDeg: number): Dir {
  const a = ((angleDeg % 360) + 360) % 360
  let best: Dir = 'E'
  let bd = 999
  for (const d of ORDER) {
    const diff = angDist(a, ANG[d])
    if (diff < bd) {
      bd = diff
      best = d
    }
  }
  return best
}

/** Candidate directions into buf: preferred first, then the last side, then nearest. Returns the count. */
function candidatesInto(buf: Dir[], prefer: Dir, last: Dir | null): number {
  let n = 0
  buf[n++] = prefer
  if (prefer === 'C') {
    if (last && last !== 'C') buf[n++] = last
    else for (const d of ['N', 'S', 'E', 'W'] as const) buf[n++] = d
    return n
  }
  const rest = NEAREST[prefer]
  // hysteresis: the preferred side always wins when free; otherwise the side
  // used last frame is tried before the other fallbacks (no flicker)
  if (last && last !== prefer && last !== 'C') buf[n++] = last
  for (const d of rest) if (d !== last) buf[n++] = d
  return n
}

/** Radial preference: outward, the two diagonals, the tangents, then inward. */
function radialInto(buf: Dir[], ax: number, ay: number, cx: number, cy: number, last: Dir | null): number {
  const ang = (Math.atan2(-(ay - cy), ax - cx) * 180) / Math.PI
  let n = 0
  const push = (d: Dir) => {
    for (let i = 0; i < n; i++) if (buf[i] === d) return
    buf[n++] = d
  }
  const out = nearestDir(ang)
  push(out)
  if (last && last !== out) push(last)
  push(nearestDir(ang + 45))
  push(nearestDir(ang - 45))
  push(nearestDir(ang + 90))
  push(nearestDir(ang - 90))
  push(nearestDir(ang + 180))
  return n
}

const overlaps = (a: Rect, b: Rect, tol = 2) =>
  a.x < b.x + b.w - tol && a.x + a.w > b.x + tol && a.y < b.y + b.h - tol && a.y + a.h > b.y + tol

const inside = (r: Rect, box: Rect) => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h

const newOut = (): PlaceOutput => ({ id: '', x: 0, y: 0, w: 0, h: 0, dir: 'E', short: false, hasLeader: false, x1: 0, y1: 0, x2: 0, y2: 0, visible: false })

/** Reusable placement context: pooled rects, outputs and candidate buffers. */
export class Placer {
  private placed: Rect[] = []
  private nPlaced = 0
  out: PlaceOutput[] = []
  private order: number[] = []
  private dirs: Dir[] = new Array(12)
  private r: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private pinY = { 'top-left': 0, 'top-right': 0 }

  private push(x: number, y: number, w: number, h: number): void {
    let p = this.placed[this.nPlaced]
    if (!p) {
      p = { x: 0, y: 0, w: 0, h: 0 }
      this.placed[this.nPlaced] = p
    }
    p.x = x
    p.y = y
    p.w = w
    p.h = h
    this.nPlaced++
  }

  private t: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private sep = 0
  /** placed[0 .. nObs) are obstacles: the label clearance (sep) never applies to them */
  private nObs = 0

  private free(r: Rect, bounds: Rect): boolean {
    if (!inside(r, bounds)) return false
    for (let i = 0; i < this.nObs; i++) if (overlaps(r, this.placed[i])) return false
    const t = this.t
    t.x = r.x - this.sep
    t.y = r.y
    t.w = r.w + 2 * this.sep
    t.h = r.h
    for (let i = this.nObs; i < this.nPlaced; i++) if (overlaps(t, this.placed[i])) return false
    return true
  }

  /**
   * Place `count` inputs. `obstacles[0..obsCount)` are rects to avoid.
   * Returns this.out; entry i corresponds to inputs[i].
   */
  place(inputs: readonly PlaceInput[], count: number, bounds: Rect, obstacles: readonly Rect[], obsCount: number): PlaceOutput[] {
    this.nPlaced = 0
    for (let i = 0; i < obsCount; i++) {
      const o = obstacles[i]
      this.push(o.x, o.y, o.w, o.h)
    }
    this.nObs = this.nPlaced
    while (this.out.length < count) this.out.push(newOut())
    const order = this.order
    order.length = count
    for (let i = 0; i < count; i++) order[i] = i
    // pinned first (in pin order), then by priority; the sort is stable
    order.sort((a, b) => {
      const A = inputs[a]
      const B = inputs[b]
      if (!!A.pin !== !!B.pin) return A.pin ? -1 : 1
      if (A.pin && B.pin) return A.pinOrder - B.pinOrder
      return B.priority - A.priority
    })
    this.pinY['top-left'] = bounds.y
    this.pinY['top-right'] = bounds.y

    for (let oi = 0; oi < count; oi++) {
      const i = order[oi]
      const L = inputs[i]
      const o = this.out[i]
      o.id = L.id
      o.hasLeader = false
      o.short = false
      this.sep = 0
      if (L.pin) {
        const x = L.pin === 'top-left' ? bounds.x : bounds.x + bounds.w - L.w
        const y = this.pinY[L.pin]
        this.pinY[L.pin] = y + L.h + 4
        o.x = x
        o.y = y
        o.w = L.w
        o.h = L.h
        o.dir = 'C'
        o.visible = y + L.h <= bounds.y + bounds.h
        if (o.visible) this.push(x, y, L.w, L.h)
        continue
      }
      let nd =
        L.prefer === 'radial' ? radialInto(this.dirs, L.ax, L.ay, L.cx, L.cy, L.last) : candidatesInto(this.dirs, L.prefer, L.last)
      if (L.only && L.only.length) {
        let k = 0
        for (let j = 0; j < nd; j++) if (L.only.includes(this.dirs[j])) this.dirs[k++] = this.dirs[j]
        if (k === 0) this.dirs[k++] = L.only[0]
        nd = k
      }
      this.sep = L.sep
      const ok = this.tryWidth(L, L.w, false, nd, bounds, o) || (L.shortW > 0 && this.tryWidth(L, L.shortW, true, nd, bounds, o))
      if (ok) {
        this.push(o.x - L.sep, o.y, o.w + 2 * L.sep, o.h)
        o.visible = true
      } else {
        rectInto(this.r, this.dirs[0], L.ax, L.ay, L.w, L.h, L.gap)
        o.x = this.r.x
        o.y = this.r.y
        o.w = this.r.w
        o.h = this.r.h
        o.dir = this.dirs[0]
        o.visible = false
      }
    }
    return this.out
  }

  private accept(o: PlaceOutput, r: Rect, dir: Dir, short: boolean): true {
    o.x = r.x
    o.y = r.y
    o.w = r.w
    o.h = r.h
    o.dir = dir
    o.short = short
    return true
  }

  private leaderTo(o: PlaceOutput, L: PlaceInput): void {
    o.hasLeader = true
    o.x1 = L.ax
    o.y1 = L.ay
    o.x2 = Math.max(o.x, Math.min(o.x + o.w, L.ax))
    o.y2 = Math.max(o.y, Math.min(o.y + o.h, L.ay))
  }

  private tryWidth(L: PlaceInput, w: number, short: boolean, nd: number, bounds: Rect, o: PlaceOutput): boolean {
    const r = this.r
    for (let j = 0; j < nd; j++) {
      rectInto(r, this.dirs[j], L.ax, L.ay, w, L.h, L.gap)
      if (this.free(r, bounds)) {
        this.accept(o, r, this.dirs[j], short)
        if (L.leaderAlways) this.leaderTo(o, L)
        return true
      }
    }
    const pref = this.dirs[0]
    // Slide along the preferred side so the label stays inside the rect.
    rectInto(r, pref, L.ax, L.ay, w, L.h, L.gap)
    const rx = r.x
    const ry = r.y
    r.x = Math.max(bounds.x, Math.min(bounds.x + bounds.w - r.w, r.x))
    r.y = Math.max(bounds.y, Math.min(bounds.y + bounds.h - r.h, r.y))
    const moved = Math.hypot(r.x - rx, r.y - ry)
    if (this.free(r, bounds) && (moved <= 12 || L.leader)) {
      this.accept(o, r, pref, short)
      if (moved > 12 || L.leaderAlways) this.leaderTo(o, L)
      return true
    }
    // Vertical stagger tiers with a leader line.
    if (L.leader) {
      const down = pref === 'S' || pref === 'SE' || pref === 'SW'
      for (let k = 1; k <= 3; k++) {
        for (let s2 = 0; s2 < 2; s2++) {
          const sgn = (s2 === 0) === down ? 1 : -1
          rectInto(r, pref, L.ax, L.ay, w, L.h, L.gap)
          r.y += sgn * 18 * k
          r.x = Math.max(bounds.x, Math.min(bounds.x + bounds.w - r.w, r.x))
          if (this.free(r, bounds)) {
            this.accept(o, r, pref, short)
            this.leaderTo(o, L)
            return true
          }
        }
      }
    }
    return false
  }
}

/** Pure, allocating wrapper (unit tests, one-off layout). */
export function placeLabels(inputs: PlaceInput[], bounds: Rect, obstacles: Rect[]): PlaceOutput[] {
  const p = new Placer()
  return p.place(inputs, inputs.length, bounds, obstacles, obstacles.length).map((o) => ({ ...o }))
}
