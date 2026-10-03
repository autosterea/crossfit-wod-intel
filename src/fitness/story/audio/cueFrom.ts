import type { CueShape } from './types'

/* =========================================================================
   cueFrom (DESIGN.md I.2.1, I.6.2): sample a Scene cue function over one
   beat (601 samples of beat t) into its moving SEGMENTS. A segment is a
   maximal monotonic run in which the value changes (a pulse gives two: its
   rise and its fall). An overshooting ease (snap) rises past its target and
   settles back: the settle is folded into the rise, so `land` is the first
   contact, where the eye reads arrival.
     a     the first sample past 2% of the change
     land  the first sample within 2% of the final value
     half  the 50% crossing
     b     the last sample that changes
     speed |d value / dt| over [a, b], 32 points, peak 1
   Pure. The sound's timing is the picture's timing: no window number is
   ever typed into a cue.
   ========================================================================= */

const N = 600
const buf = new Float64Array(N + 1)

export function cueFrom(fn: (T: number) => number, beat: number): readonly CueShape[] {
  for (let i = 0; i <= N; i++) {
    let v = 0
    try {
      v = fn(beat + i / N)
    } catch {
      v = 0
    }
    buf[i] = Number.isFinite(v) ? v : 0
  }
  return segments(buf)
}

interface Raw {
  i0: number
  i1: number
  dir: number
}

function segments(v: Float64Array): CueShape[] {
  let range = 0
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i <= N; i++) {
    if (v[i] < lo) lo = v[i]
    if (v[i] > hi) hi = v[i]
  }
  range = hi - lo
  if (!(range > 1e-6)) return []
  const eps = range * 1e-5
  // raw monotonic runs of non-flat steps
  const raws: Raw[] = []
  let cur: Raw | null = null
  for (let i = 1; i <= N; i++) {
    const d = v[i] - v[i - 1]
    const dir = d > eps ? 1 : d < -eps ? -1 : 0
    if (dir === 0) {
      if (cur) raws.push(cur)
      cur = null
      continue
    }
    if (cur && cur.dir === dir) cur.i1 = i
    else {
      if (cur) raws.push(cur)
      cur = { i0: i - 1, i1: i, dir }
    }
  }
  if (cur) raws.push(cur)
  // fold an overshoot's settle (a short opposite run right after, under 25% of the change) into its rise
  const merged: { i0: number; i1: number; final: number; dir: number }[] = []
  for (let k = 0; k < raws.length; k++) {
    const r = raws[k]
    const next = raws[k + 1]
    const change = Math.abs(v[r.i1] - v[r.i0])
    if (next && next.dir === -r.dir && next.i0 === r.i1 && Math.abs(v[next.i1] - v[next.i0]) < 0.25 * change) {
      merged.push({ i0: r.i0, i1: next.i1, final: v[next.i1], dir: r.dir })
      k++
    } else merged.push({ i0: r.i0, i1: r.i1, final: v[r.i1], dir: r.dir })
  }
  const out: CueShape[] = []
  for (const s of merged) {
    const v0 = v[s.i0]
    const delta = s.final - v0
    const ad = Math.abs(delta)
    if (ad < range * 0.01) continue
    let a = s.i0
    for (let i = s.i0; i <= s.i1; i++)
      if (Math.abs(v[i] - v0) > 0.02 * ad) {
        a = i
        break
      }
    let land = s.i1
    for (let i = s.i0; i <= s.i1; i++)
      if (Math.abs(s.final - v[i]) <= 0.02 * ad || (s.dir > 0 ? v[i] >= s.final : v[i] <= s.final)) {
        land = i
        break
      }
    let half = s.i1
    for (let i = s.i0; i <= s.i1; i++)
      if (Math.abs(v[i] - v0) >= 0.5 * ad) {
        half = i
        break
      }
    const b = s.i1
    // speed and progress over [a, b]
    const speed = new Float32Array(32)
    const prog = new Float32Array(32)
    let peak = 0
    for (let k = 0; k < 32; k++) {
      const x = a + ((b - a) * k) / 31
      const j = Math.min(N - 1, Math.max(1, Math.round(x)))
      const d = Math.abs(v[Math.min(N, j + 1)] - v[Math.max(0, j - 1)]) / 2
      speed[k] = d
      if (d > peak) peak = d
      const xi = Math.min(N, Math.max(0, Math.round(x)))
      prog[k] = Math.max(0, Math.min(1, (v[xi] - v0) / delta))
    }
    if (peak > 0) for (let k = 0; k < 32; k++) speed[k] /= peak
    out.push({ a: a / N, land: land / N, half: half / N, b: b / N, speed, v0, v1: s.final, prog })
  }
  return out
}

/** The union window of several shapes (a staggered set played as one span). */
export function spanOf(shapes: readonly CueShape[]): CueShape | null {
  if (!shapes.length) return null
  if (shapes.length === 1) return shapes[0]
  let a = 1
  let b = 0
  for (const s of shapes) {
    a = Math.min(a, s.a)
    b = Math.max(b, s.b)
  }
  const speed = new Float32Array(32)
  const prog = new Float32Array(32)
  for (let k = 0; k < 32; k++) {
    const t = a + ((b - a) * k) / 31
    let sp = 0
    let n = 0
    for (const s of shapes) {
      if (t >= s.a && t <= s.b && s.b > s.a) {
        const x = ((t - s.a) / (s.b - s.a)) * 31
        const i = Math.min(30, Math.floor(x))
        sp = Math.max(sp, s.speed[i] + (s.speed[i + 1] - s.speed[i]) * (x - i))
      }
      if (t >= s.b) n++
      else if (t > s.a) n += (t - s.a) / (s.b - s.a)
    }
    speed[k] = sp
    prog[k] = n / shapes.length
  }
  return { a, land: b, half: (a + b) / 2, b, speed, v0: 0, v1: 1, prog }
}
