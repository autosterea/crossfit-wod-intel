import { PAL, type EnergyKey } from '../../fitnessData'
import { sampleCurve, type LightFieldUniforms } from '../../story/kit/LightField'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { LANE_BASE, LANE_THICK, N_U, thickAt } from './pathwaysMath'
import { arcTable, stackTop } from './bands'

/* =========================================================================
   Pathways shared constants, geometry helpers and the river's uniform
   state (no components here, so the component files stay fast-refresh
   friendly).
   ========================================================================= */

export type Fn = (T: number) => number

/** Axis order of the duration bands: phosphagen (3 to 10 s), glycolytic (10 s to 2 min), oxidative (2 min on). */
export const AXIS_ORDER: readonly EnergyKey[] = ['phosphagen', 'glycolytic', 'oxidative']
export const AXIS_COLOR: readonly string[] = [PAL.phosphagen, PAL.glycolytic, PAL.oxidative]
/** Band index (bottom to top: oxidative 0, glycolytic 1, phosphagen 2) of axis slot k. */
export const BAND_OF_AXIS = [2, 1, 0] as const

/** Subdivide a straight line into k segments so the pen draws it smoothly. */
export function lineSegs(out: number[], a: [number, number, number], b: [number, number, number], k: number): void {
  for (let i = 0; i < k; i++) {
    const f0 = i / k
    const f1 = (i + 1) / k
    out.push(
      a[0] + (b[0] - a[0]) * f0,
      a[1] + (b[1] - a[1]) * f0,
      a[2] + (b[2] - a[2]) * f0,
      a[0] + (b[0] - a[0]) * f1,
      a[1] + (b[1] - a[1]) * f1,
      a[2] + (b[2] - a[2]) * f1,
    )
  }
}

/** Polyline a -> b in k steps. */
export function segLine(a: readonly [number, number, number], b: readonly [number, number, number], k: number): Float32Array {
  const out = new Float32Array((k + 1) * 3)
  for (let i = 0; i <= k; i++) {
    const f = i / k
    out[i * 3] = a[0] + (b[0] - a[0]) * f
    out[i * 3 + 1] = a[1] + (b[1] - a[1]) * f
    out[i * 3 + 2] = a[2] + (b[2] - a[2]) * f
  }
  return out
}


export type BandFn = (T: number, b: number) => number

/** Warm white of a hot pen tip (the kit's head colour family). */
export const LIGHT = '#fff4e8'

export interface BandSource {
  /** 0 stacked, 1 lanes */
  m: Fn
  /** 0 power, 1 share */
  s: Fn
  /** flood front of band b (>= 1 + FLOOD_W is fully flooded) */
  front: BandFn
}


/** Arc table of the envelope (P0 neutral fill follows the pen head). */
export function envelopeArc(frame: ChartFrame): Float32Array {
  const a = new Float32Array(N_U * 3)
  for (let i = 0; i < N_U; i++) {
    a[i * 3] = frame.x(i / (N_U - 1))
    a[i * 3 + 1] = frame.y(stackTop(i, 0))
  }
  return arcTable(a)
}


/** Per-band power thickness curves for the light (v units, 128 samples), oxidative at the bottom. */
export const FLOW_CURVES: readonly [Float32Array, Float32Array, Float32Array] = [
  sampleCurve((u) => thickAt(0, u)),
  sampleCurve((u) => thickAt(1, u)),
  sampleCurve((u) => thickAt(2, u)),
]

/** Mutable FLOW uniforms (no allocation per frame). */
export interface FlowState {
  u: LightFieldUniforms & { bandOn: [number, number, number]; lane: [number, number, number] }
}
export function makeFlowState(): FlowState {
  return {
    u: { mode: 2, mix: 0, level: 0, hot: 0, opacity: 1, flow: 0, bandOn: [0, 0, 0], lane: [0, 0, 0], stack: 1, thick: 1 },
  }
}
/** Write the lanes morph into the FLOW uniforms (same formula as bandRange). */
export function setFlowMorph(st: FlowState, m: number): void {
  st.u.lane[0] = m * LANE_BASE[0]
  st.u.lane[1] = m * LANE_BASE[1]
  st.u.lane[2] = m * LANE_BASE[2]
  st.u.stack = 1 - m
  st.u.thick = 1 - (1 - LANE_THICK) * m
}

