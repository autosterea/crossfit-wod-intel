import { useMemo } from 'react'
import { PAL } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'
import { BANDS, BAND_NAME_V, CHARTER, RATCHET, SKIP, isStacked } from './layout'
import {
  B,
  amber,
  bandIn,
  bandName,
  chLoad,
  chLoadName,
  chTime,
  chTimeName,
  charterOut,
  live,
  onlyThen,
  riskName,
  skipDraw,
} from './timeline'

/* =========================================================================
   T5 "The charter" (STORYBOARD-technique T5; Scaling CrossFit, L1 Guide p.
   77; the article's pull quote, p. 40): a timeline, time left to right
   (L11), load and speed up the side (the charter's gate: movements correct
   and consistent "before load and speed are added"). Three bands in order,
   MECHANICS, CONSISTENCY, INTENSITY; an amber line stays flat and low
   through the first two and only then ratchets up (schematic: no values).
   Then the order ignored: a red dashed line jumps up inside MECHANICS: the
   risk for injury.
   ========================================================================= */

const NAMES = ['MECHANICS', 'CONSISTENCY', 'INTENSITY'] as const

export function Charter({ f }: { f: ChartFrame }) {
  const x = f.x
  const y = f.y
  const stacked = isStacked(f)
  const on = (T: number) => live(T, B.charter, B.odds + 0.12) * charterOut(T)

  const axes = useMemo(
    () => ({
      time: new Float32Array([x(CHARTER.ou), y(CHARTER.ov), 0, x(CHARTER.u1), y(CHARTER.ov), 0]),
      load: new Float32Array([x(CHARTER.ou), y(CHARTER.ov), 0, x(CHARTER.ou), y(CHARTER.v1), 0]),
    }),
    [f], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // the band fills (from the time axis to the top) and their chalk dividers
  const bandTops = useMemo(() => BANDS.map((b) => new Float32Array([x(b.u0), y(CHARTER.v1), x(b.u1), y(CHARTER.v1)])), [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const dividers = useMemo(() => {
    const s = new Float32Array(2 * 6)
    ;[BANDS[1].u0, BANDS[2].u0].forEach((u, i) => {
      s.set([x(u), y(CHARTER.ov), 0, x(u), y(CHARTER.v1), 0], i * 6)
    })
    return s
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps

  /* the amber line, one stroke whose three parts draw with their bands */
  const ratchet = useMemo(() => {
    const p = new Float32Array(RATCHET.length * 3)
    RATCHET.forEach(([u, v], i) => p.set([x(u), y(v), 0.03], i * 3))
    return p
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps
  /** arc-length fractions where the stroke crosses into CONSISTENCY and INTENSITY */
  const cuts = useMemo(() => {
    const n = RATCHET.length
    const cum = [0]
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(ratchet[i * 3] - ratchet[(i - 1) * 3], ratchet[i * 3 + 1] - ratchet[(i - 1) * 3 + 1]))
    const total = cum[n - 1] || 1
    return [cum[1] / total, cum[2] / total]
  }, [ratchet])
  const amberProgress = (T: number) => {
    const a = amber(T, 0)
    const b = amber(T, 1)
    const c = amber(T, 2)
    if (c > 0) return cuts[1] + (1 - cuts[1]) * c
    if (b > 0) return cuts[0] + (cuts[1] - cuts[0]) * b
    return cuts[0] * a
  }
  const skip = useMemo(() => {
    const p = new Float32Array(SKIP.length * 3)
    SKIP.forEach(([u, v], i) => p.set([x(u), y(v), 0.04], i * 3))
    return p
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------ labels ----------------------------- */
  const labels = useMemo<LabelSpec[]>(() => {
    // names at v 0.86; on a narrow frame CONSISTENCY drops a row so neighbours never touch
    const nameV = (i: number) => (stacked && i === 1 ? BAND_NAME_V - 0.06 : BAND_NAME_V)
    const L: LabelSpec[] = BANDS.map((b, i) => ({
      id: `tq-ch-${i}`,
      text: NAMES[i],
      tone: 'name' as const,
      color: i === 2 ? PAL.both : PAL.chalk,
      dot: i === 2,
      required: true,
      anchor: [x((b.u0 + b.u1) / 2), y(nameV(i)), 0] as const,
      prefer: 'C' as const,
      priority: 96,
      cue: (T: number) => bandName(T, i) * on(T),
    }))
    L.push(
      {
        id: 'tq-ch-time',
        text: 'TIME',
        tone: 'tick',
        anchor: [x(CHARTER.u1), y(CHARTER.ov), 0],
        prefer: 'SW',
        only: ['SW', 'S'],
        gapPx: 6,
        priority: 80,
        cue: (T) => chTimeName(T) * on(T),
      },
      {
        id: 'tq-ch-load',
        text: 'LOAD AND SPEED',
        tone: 'tick',
        anchor: [x(CHARTER.ou), y(CHARTER.v1), 0],
        prefer: 'NE',
        only: ['NE', 'N', 'E'],
        gapPx: 4,
        priority: 80,
        cue: (T) => chLoadName(T) * on(T),
      },
      {
        id: 'tq-ch-only',
        text: 'ONLY THEN',
        tone: 'callout',
        color: PAL.yellowGreen,
        anchor: [x(RATCHET[3][0]), y(RATCHET[4][1]), 0.05],
        prefer: 'W',
        only: ['W', 'NW', 'SW'],
        gapPx: 10,
        priority: 92,
        cue: (T) => onlyThen(T) * on(T),
      },
      {
        id: 'tq-ch-risk',
        text: 'RISK FOR INJURY',
        tone: 'callout',
        color: PAL.sick,
        anchor: [x(SKIP[1][0]), y(SKIP[1][1]), 0.05],
        prefer: 'SE',
        only: ['SE', 'E', 'S'],
        gapPx: 10,
        priority: 93,
        cue: (T) => riskName(T) * on(T),
      },
    )
    return L
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, stacked])
  useLabels(labels)

  const obstacle = useMemo<WorldObstacle>(
    () => ({
      points: (T, out) => {
        if (!on(T)) return 0
        let n = 0
        const put = (px: number, py: number) => {
          out[n * 3] = px
          out[n * 3 + 1] = py
          out[n * 3 + 2] = 0
          n++
        }
        // the amber line and the red skip line, sampled along their corners and runs
        if (amber(T, 0) > 0)
          for (let i = 0; i < RATCHET.length - 1; i++)
            for (let k = 0; k < 3; k++) put(x(RATCHET[i][0] + ((RATCHET[i + 1][0] - RATCHET[i][0]) * k) / 3), y(RATCHET[i][1] + ((RATCHET[i + 1][1] - RATCHET[i][1]) * k) / 3))
        if (skipDraw(T) > 0) for (let k = 0; k <= 12; k++) put(x(SKIP[1][0] + ((SKIP[2][0] - SKIP[1][0]) * k) / 12), y(SKIP[1][1]))
        return n
      },
      maxPoints: 48,
      radiusPx: 5,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f],
  )
  useWorldObstacle('tq-charter', obstacle)

  return (
    <>
      <Pen points={axes.time} color={PAL.chalk} width={PEN.axis} head hot progress={chTime} dim={() => 0.6} opacity={on} renderOrder={30} />
      <Pen points={axes.load} color={PAL.chalk} width={PEN.axis} head hot progress={chLoad} dim={() => 0.6} opacity={on} renderOrder={30} />
      {BANDS.map((_, i) => (
        <AreaFill key={i} top={bandTops[i]} baseline={y(CHARTER.ov)} color={i === 2 ? PAL.both : PAL.chalk} mode="solid" hi={i === 2 ? 0.024 : 0.011} opacity={(T) => bandIn(T, i) * on(T)} renderOrder={10} />
      ))}
      <PenBatch segments={dividers} color={PAL.chalk} width={PEN.grid} dim={() => 0.3} opacity={(T) => Math.max(bandIn(T, 1), 0) * on(T)} renderOrder={29} />
      <Pen points={ratchet} color={PAL.both} width={PEN.data} head hot progress={amberProgress} opacity={on} renderOrder={44} />
      <Pen points={skip} color={PAL.sick} width={PEN.data} dashed dashSize={0.24} gapSize={0.16} progress={skipDraw} opacity={on} renderOrder={43} />
    </>
  )
}
