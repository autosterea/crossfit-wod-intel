import { useMemo, useRef } from 'react'
import { PAL } from '../../fitnessData'
import { Pen, PEN } from '../../story/kit/Pen'
import { AreaStrips } from '../../story/kit/Fill'
import { LightField, FLOW_COUNT, type LightFieldUniforms } from '../../story/kit/LightField'
import { frameId, type ChartFrame } from '../../story/kit/chartFrame'
import type { Tier } from '../../story/types'
import { BAND_COLORS, H_MAX, N_U } from './pathwaysMath'
import { arcAtU, arcTable, bandRange, bandTop, floodAt, stackTop, thAt } from './bands'
import { FLOW_CURVES, type BandSource, type Fn } from './geom'

/* =========================================================================
   The river's parts (DESIGN.md D.4), driven by plain state functions so the
   story layer (functions of T) and the explore layer (damped explore state)
   render the same elements:
     BandFill   one luminous band (AreaStrips): stacked, flooding, or a lane
     BandPen    the crisp top edge of a band (L10), drawn behind the flood front
     River      the LightField FLOW motes: constant density, thinning with power
     Envelope   the chalk top of the stack (total power)
   ========================================================================= */

/** Per band (bottom to top) light multiplier: equal perceived brightness for rose, amber and blue. */
const LUMA_K = [1, 1, 1.5] as const

/** One luminous band: an additive gradient that gathers light toward its top edge, with a rim that can go HDR. */
export function BandFill({
  frame,
  b,
  src,
  opacity,
  rim,
  tier,
}: {
  frame: ChartFrame
  b: number
  src: BandSource
  opacity: Fn
  rim: Fn
  tier: Tier
}) {
  const colors = useMemo(() => [BAND_COLORS[b]], [b])
  const last = useRef({ fid: -1, m: -1, s: -1, f: -1 })
  const r = useMemo(() => new Float64Array(2), [])
  const write = (T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const m = src.m(T)
    const s = src.s(T)
    const f = src.front(T, b)
    const fid = frameId(frame)
    const L = last.current
    if (L.fid === fid && L.m === m && L.s === s && L.f === f) return false
    L.fid = fid
    L.m = m
    L.s = s
    L.f = f
    for (let i = 0; i < N_U; i++) {
      const u = i / (N_U - 1)
      bandRange(b, i, m, s, floodAt(f, u), r)
      top[i * 3] = frame.x(u)
      top[i * 3 + 1] = frame.y(r[1])
      top[i * 3 + 2] = 0
      bottom[i] = frame.y(r[0])
    }
    return true
  }
  const low = tier === 'low'
  // the rose has about half the luminance of the amber and the blue, so it
  // carries more light to read as equally luminous (linear-light blending)
  const k = LUMA_K[b]
  return (
    <AreaStrips
      strips={1}
      points={N_U}
      colors={colors}
      write={write}
      opacity={opacity}
      lo={low ? 0.1 * k : 0.035 * k}
      hi={low ? Math.min(0.9, 0.6 * k) : Math.min(0.85, 0.42 * k)}
      gamma={low ? 1 : 1.4}
      additive={!low}
      rim={rim}
      rimWidth={0.14}
      rimAlpha={low ? 0.7 : 0.5}
      renderOrder={10 + b}
    />
  )
}

/** The crisp top edge of band b, drawn with the pen behind its flood front (the head leads the light). */
export function BandPen({
  frame,
  b,
  src,
  opacity,
  dim,
  gain,
  head = true,
  z = 0.02,
}: {
  frame: ChartFrame
  b: number
  src: BandSource
  opacity: Fn
  dim?: Fn
  gain?: Fn
  head?: boolean
  z?: number
}) {
  const pts = useMemo(() => {
    const a = new Float32Array(N_U * 3)
    for (let i = 0; i < N_U; i++) {
      a[i * 3] = frame.x(i / (N_U - 1))
      a[i * 3 + 1] = frame.y(bandTop(b, i, 0, 0))
      a[i * 3 + 2] = z
    }
    return a
  }, [frame, b, z])
  // arc fraction along the STACKED edge: the draw-on during the floods (m = s = 0)
  const cum = useMemo(() => arcTable(pts), [pts])
  const last = useRef({ fid: -1, m: 0, s: 0 })
  const update = (T: number, p: Float32Array): boolean => {
    const m = src.m(T)
    const s = src.s(T)
    const fid = frameId(frame)
    const L = last.current
    if (L.fid === fid && L.m === m && L.s === s) return false
    L.fid = fid
    L.m = m
    L.s = s
    for (let i = 0; i < N_U; i++) p[i * 3 + 1] = frame.y(bandTop(b, i, m, s))
    return true
  }
  const progress = (T: number) => {
    const f = src.front(T, b)
    return f >= 1 ? 1 : arcAtU(cum, f)
  }
  return (
    <Pen
      points={pts}
      color={BAND_COLORS[b]}
      width={PEN.data}
      update={update}
      progress={progress}
      opacity={opacity}
      dim={dim}
      gain={gain}
      head={head}
      hot={head}
      renderOrder={44}
    />
  )
}

/** The chalk envelope: the top of the power stack (total power at each duration). */
export function Envelope({ frame, progress, opacity, dim, head }: { frame: ChartFrame; progress: Fn; opacity: Fn; dim?: Fn; head?: boolean }) {
  const pts = useMemo(() => {
    const a = new Float32Array(N_U * 3)
    for (let i = 0; i < N_U; i++) {
      a[i * 3] = frame.x(i / (N_U - 1))
      a[i * 3 + 1] = frame.y(stackTop(i, 0))
      a[i * 3 + 2] = 0.04
    }
    return a
  }, [frame])
  return <Pen points={pts} color={PAL.chalk} width={PEN.data} progress={progress} opacity={opacity} dim={dim} head={head} hot={head} renderOrder={45} />
}

/**
 * P0's faint neutral fill: it rises under the envelope behind the pen
 * (reveal = u of the pen head) and gives way to each band as it floods
 * (top-down for phosphagen and glycolytic, from the floor for oxidative).
 */
export function NeutralFill({ frame, reveal, src, opacity }: { frame: ChartFrame; reveal: Fn; src: BandSource; opacity: Fn }) {
  const colors = useMemo(() => [PAL.chalk], [])
  const last = useRef({ fid: -1, r: -1, f0: -1, f1: -1, f2: -1 })
  const write = (T: number, top: Float32Array, bottom: Float32Array): boolean => {
    const rv = reveal(T)
    const f0 = src.front(T, 0)
    const f1 = src.front(T, 1)
    const f2 = src.front(T, 2)
    const fid = frameId(frame)
    const L = last.current
    if (L.fid === fid && L.r === rv && L.f0 === f0 && L.f1 === f1 && L.f2 === f2) return false
    L.fid = fid
    L.r = rv
    L.f0 = f0
    L.f1 = f1
    L.f2 = f2
    for (let i = 0; i < N_U; i++) {
      const u = i / (N_U - 1)
      const kr = floodAt(rv, u)
      const tO = thAt(0, i, 0)
      const tG = thAt(1, i, 0)
      const tP = thAt(2, i, 0)
      const lo = tO * floodAt(f0, u)
      const hi = Math.max(lo, (tO + tG + tP - tP * floodAt(f2, u) - tG * floodAt(f1, u)) * kr)
      top[i * 3] = frame.x(u)
      top[i * 3 + 1] = frame.y(hi)
      top[i * 3 + 2] = -0.02
      bottom[i] = frame.y(Math.min(lo, hi))
    }
    return true
  }
  return <AreaStrips strips={1} points={N_U} colors={colors} write={write} opacity={opacity} lo={0.004} hi={0.032} gamma={1.1} renderOrder={9} />
}

/** The river: constant-density motes in the three band colours (L9), flowing left to right on the ambient clock. */
export function River({
  frame,
  tier,
  uniforms,
  liveCurves,
}: {
  frame: ChartFrame
  tier: Tier
  uniforms: (T: number, A: number) => LightFieldUniforms
  liveCurves?: () => { a: Float32Array; b: Float32Array; c?: Float32Array } | null
}) {
  const [a, b, c] = FLOW_CURVES
  const count = FLOW_COUNT[tier]
  if (count <= 0) return null
  return (
    <LightField
      frame={frame}
      count={count}
      curveA={a}
      curveB={b}
      curveC={c}
      hMax={H_MAX}
      bandColors={BAND_COLORS}
      uniforms={uniforms}
      liveCurves={liveCurves}
      sizePx={3}
      z={0.01}
      renderOrder={40}
    />
  )
}
