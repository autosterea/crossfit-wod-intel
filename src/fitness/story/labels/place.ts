import type { Dir, Rect } from '../types'

/* =========================================================================
   Greedy collision-aware label placement (DESIGN.md C.9). Pure and
   unit-testable: anchors are already projected to stage CSS px.
   Order per label: preferred direction, then the previous direction
   (hysteresis), the other compass positions nearest first, a slide along the preferred
   side, up to 3 vertical stagger tiers of 18 px with a leader, then the short
   text, then hidden.
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
  cx?: number
  cy?: number
  priority: number
  last: Dir | null
  leader: boolean
  /** pinned labels (legend) skip anchoring */
  pinned?: { x: number; y: number } | null
  /** restrict candidate directions */
  only?: readonly Dir[]
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
  leader: { x1: number; y1: number; x2: number; y2: number } | null
  visible: boolean
}

const ORDER: Dir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const ANG: Record<Dir, number> = { E: 0, NE: 45, N: 90, NW: 135, W: 180, SW: 225, S: 270, SE: 315, C: 0 }

export function rectFor(dir: Dir, ax: number, ay: number, w: number, h: number, g: number): Rect {
  const d = g * 0.72
  switch (dir) {
    case 'N':
      return { x: ax - w / 2, y: ay - g - h, w, h }
    case 'S':
      return { x: ax - w / 2, y: ay + g, w, h }
    case 'E':
      return { x: ax + g, y: ay - h / 2, w, h }
    case 'W':
      return { x: ax - g - w, y: ay - h / 2, w, h }
    case 'NE':
      return { x: ax + d, y: ay - d - h, w, h }
    case 'NW':
      return { x: ax - d - w, y: ay - d - h, w, h }
    case 'SE':
      return { x: ax + d, y: ay + d, w, h }
    case 'SW':
      return { x: ax - d - w, y: ay + d, w, h }
    default:
      return { x: ax - w / 2, y: ay - h / 2, w, h }
  }
}

function nearestDir(angleDeg: number): Dir {
  const a = ((angleDeg % 360) + 360) % 360
  let best: Dir = 'E'
  let bd = 999
  for (const d of ORDER) {
    let diff = Math.abs(a - ANG[d])
    if (diff > 180) diff = 360 - diff
    if (diff < bd) {
      bd = diff
      best = d
    }
  }
  return best
}

/** Candidate directions: preferred first, then by angular distance. */
export function candidates(prefer: Dir, last: Dir | null): Dir[] {
  if (prefer === 'C') return last && last !== 'C' ? ['C', last] : ['C', 'N', 'S', 'E', 'W']
  const base = ANG[prefer]
  const rest = ORDER.filter((d) => d !== prefer).sort((a, b) => {
    const da = Math.min(Math.abs(ANG[a] - base), 360 - Math.abs(ANG[a] - base))
    const db = Math.min(Math.abs(ANG[b] - base), 360 - Math.abs(ANG[b] - base))
    return da - db
  })
  // hysteresis: the preferred side always wins when free; otherwise the last
  // side used is tried before the other fallbacks (no flicker between two)
  if (last && last !== prefer && rest.includes(last)) return [prefer, last, ...rest.filter((d) => d !== last)]
  return [prefer, ...rest]
}

/** Radial preference: outward, then the two tangents, then inward. */
export function radialCandidates(ax: number, ay: number, cx: number, cy: number, last: Dir | null): Dir[] {
  const ang = (Math.atan2(-(ay - cy), ax - cx) * 180) / Math.PI
  const out = nearestDir(ang)
  const t1 = nearestDir(ang + 90)
  const t2 = nearestDir(ang - 90)
  const o1 = nearestDir(ang + 45)
  const o2 = nearestDir(ang - 45)
  const inward = nearestDir(ang + 180)
  const list: Dir[] = []
  for (const d of [out, o1, o2, t1, t2, inward]) if (!list.includes(d)) list.push(d)
  if (last && last !== out && list.includes(last)) return [out, last, ...list.filter((d) => d !== last && d !== out)]
  return list
}

const overlaps = (a: Rect, b: Rect, tol = 2) =>
  a.x < b.x + b.w - tol && a.x + a.w > b.x + tol && a.y < b.y + b.h - tol && a.y + a.h > b.y + tol

const inside = (r: Rect, box: Rect) => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h

function edgePoint(r: Rect, ax: number, ay: number): { x: number; y: number } {
  const x = Math.max(r.x, Math.min(r.x + r.w, ax))
  const y = Math.max(r.y, Math.min(r.y + r.h, ay))
  return { x, y }
}

/**
 * Place labels greedily by priority. `bounds` is the focus rect already inset
 * by 8 px. Returns one output per input, in input order.
 */
export function placeLabels(inputs: PlaceInput[], bounds: Rect, obstacles: Rect[]): PlaceOutput[] {
  const order = inputs.map((_, i) => i).sort((a, b) => inputs[b].priority - inputs[a].priority)
  const placed: Rect[] = [...obstacles]
  const out: PlaceOutput[] = new Array(inputs.length)

  const free = (r: Rect) => {
    if (!inside(r, bounds)) return false
    for (const p of placed) if (overlaps(r, p)) return false
    return true
  }

  for (const i of order) {
    const L = inputs[i]
    if (L.pinned) {
      const r = { x: L.pinned.x, y: L.pinned.y, w: L.w, h: L.h }
      placed.push(r)
      out[i] = { id: L.id, ...r, dir: 'C', short: false, leader: null, visible: true }
      continue
    }
    let dirs =
      L.prefer === 'radial'
        ? radialCandidates(L.ax, L.ay, L.cx ?? L.ax, L.cy ?? L.ay + 1, L.last)
        : candidates(L.prefer, L.last)
    if (L.only && L.only.length) {
      const allow = L.only
      const f = dirs.filter((d) => allow.includes(d))
      dirs = f.length ? f : [allow[0]]
    }
    const pref: Dir = dirs[0]
    let done: PlaceOutput | null = null

    const tryWidth = (w: number, short: boolean): PlaceOutput | null => {
      for (const d of dirs) {
        const r = rectFor(d, L.ax, L.ay, w, L.h, L.gap)
        if (free(r)) return { id: L.id, ...r, dir: d, short, leader: null, visible: true }
      }
      // Slide along the preferred side so the label stays inside the rect.
      {
        const r = rectFor(pref, L.ax, L.ay, w, L.h, L.gap)
        const sx = Math.max(bounds.x, Math.min(bounds.x + bounds.w - r.w, r.x))
        const sy = Math.max(bounds.y, Math.min(bounds.y + bounds.h - r.h, r.y))
        const moved = Math.hypot(sx - r.x, sy - r.y)
        const rs = { x: sx, y: sy, w: r.w, h: r.h }
        if (free(rs) && (moved <= 12 || L.leader)) {
          const e = edgePoint(rs, L.ax, L.ay)
          return {
            id: L.id,
            ...rs,
            dir: pref,
            short,
            leader: moved > 12 ? { x1: L.ax, y1: L.ay, x2: e.x, y2: e.y } : null,
            visible: true,
          }
        }
      }
      // Vertical stagger tiers with a leader line.
      if (L.leader) {
        const down = pref === 'S' || pref === 'SE' || pref === 'SW'
        for (let k = 1; k <= 3; k++) {
          const r0 = rectFor(pref, L.ax, L.ay, w, L.h, L.gap)
          const r = { ...r0, y: r0.y + (down ? 18 : -18) * k }
          r.x = Math.max(bounds.x, Math.min(bounds.x + bounds.w - r.w, r.x))
          if (free(r)) {
            const e = edgePoint(r, L.ax, L.ay)
            return { id: L.id, ...r, dir: pref, short, leader: { x1: L.ax, y1: L.ay, x2: e.x, y2: e.y }, visible: true }
          }
        }
      }
      return null
    }

    done = tryWidth(L.w, false)
    if (!done && L.shortW > 0) done = tryWidth(L.shortW, true)
    if (done) {
      placed.push({ x: done.x, y: done.y, w: done.w, h: done.h })
      out[i] = done
    } else {
      const r = rectFor(pref, L.ax, L.ay, L.w, L.h, L.gap)
      out[i] = { id: L.id, ...r, dir: pref, short: false, leader: null, visible: false }
    }
  }
  return out
}
