import { useMemo, useRef } from 'react'
import { PAL } from '../../fitnessData'
import { Pen, PEN } from '../../story/kit/Pen'
import { AreaStrips } from '../../story/kit/Fill'
import { frameId, type ChartFrame } from '../../story/kit/chartFrame'
import type { Tier } from '../../story/types'
import { BAND_COLORS, N_U } from './pathwaysMath'
import { arcAtU, arcTable, bandRange, bandTop, floodAt, stackTop } from './bands'
import type { BandSource, Fn } from './geom'

/* =========================================================================
   The river's parts (DESIGN.md D.4), driven by plain state functions so the
   story layer (functions of T) and the explore layer (damped explore state)
   render the same elements:
     BandFill   one luminous band (AreaStrips): stacked, flooding, or a lane;
                at a low `level` it is P0's dim, unnamed engine
     BandPen    the crisp top edge of a band (L10), drawn behind the flood front
     Envelope   the chalk top of the stack (total power)
   The motes are River.tsx.
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
  level = 1,
  soft,
  renderOrder,
}: {
  frame: ChartFrame
  b: number
  src: BandSource
  opacity: Fn
  rim: Fn
  tier: Tier
  /** light level: 1 is the flooded band, about 0.3 is P0's dim engine */
  level?: number
  /** width in u of the flood's soft zone (default FLOOD_W); small = a clean wipe */
  soft?: number
  renderOrder?: number
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
      bandRange(b, i, m, s, floodAt(f, u, soft), r)
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
  const k = LUMA_K[b] * level
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
      rimAlpha={(low ? 0.7 : 0.5) * Math.min(1, level * 1.5)}
      renderOrder={renderOrder ?? 10 + b}
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
