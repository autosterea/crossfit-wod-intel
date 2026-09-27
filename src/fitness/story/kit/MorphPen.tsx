import { useMemo } from 'react'
import { Pen, type PenProps } from './Pen'

/* <MorphPen/> (DESIGN.md C.11): one pen whose 256 points are a weighted
   blend of several shapes (each from kit/shapes.ts, same point count, same
   start and winding). Positions are written into the existing buffer in
   place; nothing reallocates per frame. `stagger` delays later points so the
   morph flows along the stroke. */

export interface MorphPenProps extends Omit<PenProps, 'points' | 'update'> {
  shapes: Float32Array[]
  /** blend weights per shape for this T (should sum to 1) */
  weights: (T: number) => readonly number[]
  stagger?: number
}

export function MorphPen({ shapes, weights, stagger = 0, ...rest }: MorphPenProps) {
  const n = shapes[0]?.length ?? 0
  const start = useMemo(() => shapes[0].slice(), [shapes])
  const last = useMemo(() => ({ key: '' }), [])
  const update = (T: number, pts: Float32Array): boolean => {
    const w = weights(T)
    const key = w.map((x) => x.toFixed(4)).join(',')
    if (key === last.key) return false
    last.key = key
    const count = n / 3
    for (let i = 0; i < count; i++) {
      // stagger: shift weight toward the earlier shape for later points
      const lag = stagger > 0 && count > 1 ? (stagger * i) / (count - 1) : 0
      let x = 0
      let y = 0
      let z = 0
      let sum = 0
      for (let s = 0; s < shapes.length; s++) {
        let ws = w[s] ?? 0
        if (lag > 0 && s > 0) ws = Math.max(0, ws - lag)
        const sh = shapes[s]
        x += sh[i * 3] * ws
        y += sh[i * 3 + 1] * ws
        z += sh[i * 3 + 2] * ws
        sum += ws
      }
      if (sum <= 0) {
        x = shapes[0][i * 3]
        y = shapes[0][i * 3 + 1]
        z = shapes[0][i * 3 + 2]
        sum = 1
      }
      pts[i * 3] = x / sum
      pts[i * 3 + 1] = y / sum
      pts[i * 3 + 2] = z / sum
    }
    return true
  }
  return <Pen points={start} update={update} {...rest} />
}
