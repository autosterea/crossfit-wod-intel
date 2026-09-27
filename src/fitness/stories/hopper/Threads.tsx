import { useMemo, useRef } from 'react'
import { PAL } from '../../fitnessData'
import { frameId, type ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { THREADS, STORY_DRAWS, type Run } from './hopperMath'
import { leadV } from './layout'

/* =========================================================================
   H6 "Again and again" (DESIGN.md D.3): the proof. x = draws 0 to 40,
   y = the lead (the Generalist's total minus the best specialist's). A
   zero line; below it a faint hatch where a specialist is ahead. 64 other
   hoppers (seeds 1 to 64, one PenBatch, dimmed chalk) draw on together left
   to right, then the story run's own thread in #91C640 with a hot head.
   The chart is authored in chart space and mapped by its own adaptive frame
   (B.13), centred where the rails were.
   ========================================================================= */

const AWAY = 1e5
const SEGS = STORY_DRAWS

/** x, y of draw d of run r in the chart (local to the chart group). */
const px = (f: ChartFrame, d: number) => f.x(d / STORY_DRAWS)
const py = (f: ChartFrame, r: Run, d: number) => f.y(leadV(r.lead[Math.min(d, r.n)]))

export interface ThreadsProps {
  frame: ChartFrame
  /** construction (zero line, baseline, ticks) progress and opacity */
  construct: (T: number) => number
  opacity: (T: number) => number
  /** the 64 threads' draw-on (0..1 along the draws axis) */
  bundle: (T: number) => number
  /** the highlighted run, how far it is drawn (0..1), and its opacity */
  mine: { run: () => Run; upto: () => number; progress: (T: number) => number; opacity: (T: number) => number }
}

export function Threads({ frame, construct, opacity, bundle, mine }: ThreadsProps) {
  const f = frame
  const y0 = f.y(leadV(0))
  // construction: the zero line (a crisp claim edge, L10) and the draws axis with ticks
  const zero = useMemo(() => new Float32Array([f.x(0), y0, 0, f.x(1), y0, 0]), [f, y0])
  const axis = useMemo(() => {
    const out: number[] = [f.x(0), f.y(0), 0, f.x(1), f.y(0), 0]
    for (let i = 0; i <= 4; i++) out.push(f.x(i / 4), f.y(0), 0, f.x(i / 4), f.y(0) - 0.22, 0)
    return new Float32Array(out)
  }, [f])
  const hatchTop = useMemo(() => new Float32Array([f.x(0), y0, f.x(1), y0]), [f, y0])

  // the 64 threads: one PenBatch, drawn left to right together (the partial
  // segment is interpolated, so the front is smooth)
  const segs = useMemo(() => new Float32Array(THREADS.length * SEGS * 6).fill(AWAY), [])
  const last = useRef('')
  const writeBundle = (T: number, s: Float32Array): boolean => {
    const p = bundle(T)
    const key = frameId(f) + '|' + p
    if (key === last.current) return false
    last.current = key
    const upto = p * SEGS
    THREADS.forEach((r, t) => {
      for (let d = 0; d < SEGS; d++) {
        const o = (t * SEGS + d) * 6
        if (d >= upto) {
          s.fill(AWAY, o, o + 6)
          continue
        }
        const e = Math.min(1, upto - d)
        const xa = px(f, d)
        const ya = py(f, r, d)
        const xb = px(f, d + 1)
        const yb = py(f, r, d + 1)
        s[o] = xa
        s[o + 1] = ya
        s[o + 2] = 0
        s[o + 3] = xa + (xb - xa) * e
        s[o + 4] = ya + (yb - ya) * e
        s[o + 5] = 0
      }
    })
    return true
  }

  // the highlighted run (the story's seed 78331, or the explore run)
  const minePts = useMemo(() => new Float32Array((SEGS + 1) * 3), [])
  const lastM = useRef('')
  const writeMine = (_T: number, p: Float32Array): boolean => {
    const r = mine.run()
    const n = Math.max(1, Math.min(SEGS, mine.upto()))
    const key = frameId(f) + '|' + r.seed + '|' + n
    if (key === lastM.current) return false
    lastM.current = key
    for (let d = 0; d <= SEGS; d++) {
      const dd = Math.min(d, n)
      p[d * 3] = px(f, dd)
      p[d * 3 + 1] = py(f, r, dd)
      p[d * 3 + 2] = 0.02
    }
    return true
  }

  return (
    <>
      <AreaFill
        top={hatchTop}
        baseline={f.y(0)}
        z={-0.02}
        color={PAL.chalk}
        mode="hatch"
        hi={0.13}
        opacity={(T) => construct(T) * opacity(T)}
        renderOrder={10}
      />
      <PenBatch segments={axis} color={PAL.chalk} width={PEN.axis} byArc progress={construct} dim={() => 0.4} opacity={opacity} renderOrder={30} />
      <PenBatch
        segments={segs}
        color={PAL.chalk}
        width={PEN.grid}
        update={writeBundle}
        dim={() => 0.085}
        opacity={(T) => (bundle(T) > 0 ? opacity(T) : 0)}
        renderOrder={31}
      />
      <Pen points={zero} color={PAL.chalk} width={PEN.axis} head progress={construct} opacity={(T) => 0.62 * opacity(T)} renderOrder={33} />
      <Pen
        points={minePts}
        color={PAL.yellowGreen}
        width={PEN.data}
        update={writeMine}
        head
        hot
        progress={mine.progress}
        opacity={(T) => mine.opacity(T) * opacity(T)}
        gain={() => 1.2}
        renderOrder={45}
      />
    </>
  )
}
