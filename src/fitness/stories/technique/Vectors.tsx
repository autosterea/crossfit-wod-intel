import { useMemo, useRef } from 'react'
import { PAL, SEE } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { frameId } from '../../story/kit/chartFrame'
import { PenBatch, PEN } from '../../story/kit/Pen'
import { Glows } from '../../story/kit/Halo'
import { pulse } from '../../story/cue'
import { useLabels } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'
import { Rings } from './Rings'
import { headSegs, mix, parkSegs, seg } from './geom'
import { terms, unitsPerPx, vectors } from './layout'
import {
  B,
  chevronOn,
  chevronTurn,
  fadeSE,
  grow,
  live,
  out2,
  sameDir,
  swing,
  tickIntensity,
  tickLosing,
  tickZero,
  tipName,
  trade1,
  trade2,
  trade3a,
  trade3b,
} from './timeline'

/* =========================================================================
   T1 "Three vectors, one direction" (STORYBOARD-technique T1, p. 40): three
   arrows from one origin in the SEE colours, a few degrees apart. Then the
   article's three trade-offs, each out and back: efficacy and efficiency
   down to zero and safety soars; intensity up, efficiency grows and safety
   shrinks; lose people, safety and then efficacy shrink. Lengths only: no
   value is ever shown. T2 keeps the efficacy arrow: it swings level into the
   underline of "HOW YOU MOVE" while the other two fade.
   ========================================================================= */

const COL = [SEE[0].color, SEE[1].color, SEE[2].color] as const
const NAMES = ['SAFETY', 'EFFICACY', 'EFFICIENCY'] as const
const AMBER = PAL.both
const SIDES: readonly (readonly ('N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW')[])[] = [
  ['NW', 'N', 'W'],
  ['E', 'NE', 'SE'],
  ['SE', 'E', 'S', 'NE'],
]

/** Arrow i's length as a share of L at T (growth and the three trade-offs). */
function arrowK(T: number, i: number): number {
  const g = grow(T, i)
  const t1 = trade1(T)
  const t2 = trade2(T)
  if (i === 0) return g * (1 + 0.4 * t1 - 0.55 * t2 - 0.55 * trade3a(T))
  if (i === 1) return g * Math.max(0, 1 - t1 - 0.45 * trade3b(T))
  return g * Math.max(0, 1 - t1 + 0.4 * t2)
}

export function Vectors({ f }: { f: ChartFrame }) {
  const x = f.x
  const y = f.y
  const vg = vectors(f)
  const tg = terms(f)
  const O: [number, number] = [x(vg.ou), y(vg.ov)]
  const dirs = vg.deg.map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)] as const)
  const upx = unitsPerPx(f)
  const HEAD = 11 * upx
  const on = (T: number) => live(T, B.vectors, B.graph + 0.04)
  /** the underline the efficacy arrow becomes (T2) */
  const U0: [number, number] = [x(tg.underline[0]), y(tg.titleV - 0.025)]
  const U1: [number, number] = [x(tg.underline[1]), y(tg.titleV - 0.025)]

  const tipInto = (T: number, i: number, out: [number, number, number]): [number, number, number] => {
    const k = arrowK(T, i) * vg.L
    if (i === 1) {
      const s = swing(T)
      const tx = O[0] + dirs[1][0] * k
      const ty = O[1] + dirs[1][1] * k
      out[0] = mix(tx, U1[0], s)
      out[1] = mix(ty, U1[1], s)
    } else {
      out[0] = O[0] + dirs[i][0] * k
      out[1] = O[1] + dirs[i][1] * k
    }
    out[2] = 0.03
    return out
  }

  /* --------------------------- the arrows --------------------------- */
  const bufs = useMemo(() => [0, 1, 2].map(() => new Float32Array(3 * 6)), [])
  const last = useRef(['', '', ''])
  const tmp = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  const writer = (i: number) => (T: number, s: Float32Array): boolean => {
    const k = arrowK(T, i)
    const sw = i === 1 ? swing(T) : 0
    const key = frameId(f) + '|' + k.toFixed(5) + '|' + sw.toFixed(5)
    if (key === last.current[i]) return false
    last.current[i] = key
    tipInto(T, i, tmp)
    const t0x = i === 1 ? mix(O[0], U0[0], sw) : O[0]
    const t0y = i === 1 ? mix(O[1], U0[1], sw) : O[1]
    const len = Math.hypot(tmp[0] - t0x, tmp[1] - t0y)
    if (len < 1e-4) {
      parkSegs(s, 0, 3)
      return true
    }
    seg(s, 0, t0x, t0y, tmp[0], tmp[1], 0.03)
    const h = Math.min(HEAD, 0.4 * len) * (1 - sw)
    if (h > 1e-4) headSegs(s, 1, t0x, t0y, tmp[0], tmp[1], h, 28, 0.03)
    else parkSegs(s, 1, 2)
    return true
  }
  const writers = useMemo(() => [writer(0), writer(1), writer(2)], [f]) // eslint-disable-line react-hooks/exhaustive-deps
  const arrowOp = (i: number) => (T: number) => {
    if (!on(T) || T < B.vectors + 0.04) return 0
    if (i === 1) return out2(T)
    return fadeSE(T)
  }

  /* -------------------- the amber chevron (intensity up) ------------- */
  const chev = useMemo(() => new Float32Array(2 * 6), [])
  const lastC = useRef('')
  const writeChev = (T: number, s: Float32Array): boolean => {
    const r = chevronTurn(T)
    const key = frameId(f) + '|' + r.toFixed(4)
    if (key === lastC.current) return false
    lastC.current = key
    // beside EFFICIENCY's middle, on the outside of the bundle (below it)
    const d = dirs[2]
    const nx = d[1]
    const ny = -d[0]
    const mx = O[0] + d[0] * vg.L * 0.62 + nx * 26 * upx
    const my = O[1] + d[1] * vg.L * 0.62 + ny * 26 * upx
    // a ">" pointing along +x turns up into "^"
    const a = (r * Math.PI) / 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const w = 7 * upx
    const p = (px: number, py: number): [number, number] => [mx + px * ca - py * sa, my + px * sa + py * ca]
    const tip = p(w, 0)
    const l = p(-w, w)
    const rr = p(-w, -w)
    seg(s, 0, l[0], l[1], tip[0], tip[1], 0.04)
    seg(s, 1, rr[0], rr[1], tip[0], tip[1], 0.04)
    return true
  }

  /* ------------------------------ labels ----------------------------- */
  const labels = useMemo<LabelSpec[]>(() => {
    const anchors = [0, 1, 2].map(() => [0, 0, 0] as [number, number, number])
    const L: LabelSpec[] = [0, 1, 2].map((i) => ({
      id: `tq-v-${i}`,
      text: NAMES[i],
      tone: 'name' as const,
      color: COL[i],
      required: true,
      anchor: (T: number) => tipInto(T, i, anchors[i]),
      // the tips are a few degrees apart: fan the names out (safety above, efficacy beside, efficiency below)
      prefer: SIDES[i][0],
      only: SIDES[i],
      // when a trade-off brings two tips together, the later name staggers out on a leader
      leader: true,
      gapPx: 7,
      priority: 97 - i,
      cue: (T: number) => tipName(T, i) * (on(T) ? 1 : 0) * (i === 1 ? 1 - swing(T) : fadeSE(T)) * (arrowK(T, i) > 0.08 ? 1 : 0),
    }))
    const mid = vg.deg[1]
    const md: [number, number, number] = [O[0] + Math.cos((mid * Math.PI) / 180) * vg.L * 0.75, O[1] + Math.sin((mid * Math.PI) / 180) * vg.L * 0.75, 0.05]
    L.push({
      id: 'tq-samedir',
      text: 'SAME DIRECTION',
      tone: 'callout',
      color: PAL.chalk,
      anchor: md,
      prefer: 'C',
      priority: 92,
      cue: (T) => sameDir(T) * (on(T) ? fadeSE(T) : 0),
    })
    const near: [number, number, number] = [O[0], O[1], 0]
    L.push({
      id: 'tq-zero',
      text: 'DOWN TO ZERO',
      tone: 'tick',
      anchor: near,
      prefer: 'SE',
      only: ['SE', 'E', 'S', 'NE'],
      gapPx: 10,
      priority: 80,
      cue: (T) => tickZero(T) * (on(T) ? 1 : 0),
    })
    const chevAt: [number, number, number] = [0, 0, 0]
    L.push({
      id: 'tq-intensity',
      text: 'INTENSITY UP',
      tone: 'tick',
      anchor: () => {
        const d = dirs[2]
        chevAt[0] = O[0] + d[0] * vg.L * 0.62 + d[1] * 26 * upx
        chevAt[1] = O[1] + d[1] * vg.L * 0.62 - d[0] * 26 * upx
        return chevAt
      },
      prefer: 'SE',
      only: ['SE', 'E', 'S'],
      gapPx: 12,
      priority: 80,
      cue: (T) => tickIntensity(T) * (on(T) ? 1 : 0),
    })
    const safeTip: [number, number, number] = [0, 0, 0]
    L.push({
      id: 'tq-losing',
      text: 'LOSING PEOPLE',
      tone: 'tick',
      anchor: (T) => tipInto(T, 0, safeTip),
      prefer: 'NW',
      only: ['NW', 'W', 'N'],
      gapPx: 10,
      priority: 80,
      cue: (T) => tickLosing(T) * (on(T) ? 1 : 0),
    })
    return L
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])
  useLabels(labels)

  return (
    <>
      {[0, 1, 2].map((i) => (
        <PenBatch key={i} segments={bufs[i]} color={COL[i]} width={PEN.data} update={writers[i]} opacity={arrowOp(i)} renderOrder={44} />
      ))}
      {/* safety's tip as it soars (trade-off 1): the speaking element */}
      <Glows
        count={1}
        sizePx={30}
        colors={[COL[0]]}
        gain={2}
        place={(T, _i, out) => {
          if (!on(T) || T >= B.quality) return 0
          tipInto(T, 0, out)
          return pulse(T, B.vectors + 0.28, B.vectors + 0.46)
        }}
      />
      {/* the collapsed heads: 6 px rings at the origin */}
      <Rings
        count={2}
        sizePx={14}
        colors={[COL[1], COL[2]]}
        place={(T, i, out) => {
          // only while trade-off 1 has them collapsed (never before they grow)
          if (!on(T) || T >= B.quality) return 0
          const t1 = trade1(T)
          if (t1 < 0.9) return 0
          out[0] = O[0]
          out[1] = O[1]
          out[2] = 0.06 + 0.01 * i
          return 0.35 + 0.6 * ((1 - t1) / 0.1)
        }}
      />
      <PenBatch segments={chev} color={AMBER} width={PEN.data} update={writeChev} opacity={(T) => (on(T) ? chevronOn(T) : 0)} renderOrder={45} />
    </>
  )
}
