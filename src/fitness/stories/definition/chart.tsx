import { useEffect, useMemo, useRef } from 'react'
import { PAL, POWER_DURATIONS, POWER_TASKS, ENERGY_SYSTEMS } from '../../fitnessData'
import { PenBatch, PEN } from '../../story/kit/Pen'
import { frameId, type ChartFrame } from '../../story/kit/chartFrame'
import { lin } from '../../story/kit/materials'
import { hudClipX } from '../../story/kit/hudClip'
import { useSafeFrame } from '../../story/useSafeFrame'
import { AXIS, valAt, GENERALIST } from './definitionMath'
import * as THREE from 'three'

/* =========================================================================
   Shared chart construction for the Definition story and explore scenes:
   the grid (y references at 0.5 and 1.0), the axes, the tick marks and the
   energy-system bands under the time axis. Pure geometry + T functions.
   ========================================================================= */

export type Fn = (T: number) => number

/** Subdivide a straight line into k segments so the pen draws it smoothly. */
function lineSegs(out: number[], a: [number, number, number], b: [number, number, number], k: number): void {
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

export const TICK_LEN = 0.2
/** the y references (0.5 and 1.0) and the pen segments per reference line */
const GRID_V = [0.5, 1.0] as const
const GRID_SEGS = 16
export const BAND_H = 0.34

/** u of the energy-system band boundaries: 0, 10 s, 120 s, 1. */
export const BAND_U = [0, AXIS.u(10), AXIS.u(120), 1]

/** Generalist relative power at u. */
export const gv = (u: number) => valAt(GENERALIST.samples, u)

/** 72-sample polyline for a curve at depth z. */
export function curvePolyline(frame: ChartFrame, f: (u: number) => number, z = 0, n = 72): Float32Array {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    a[i * 3] = frame.x(u)
    a[i * 3 + 1] = frame.y(f(u))
    a[i * 3 + 2] = z
  }
  return a
}

/** x, y pairs of a curve's top edge (AreaFill input). */
export function curveTop(frame: ChartFrame, f: (u: number) => number, n = 72): Float32Array {
  const a = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    a[i * 2] = frame.x(u)
    a[i * 2 + 1] = frame.y(f(u))
  }
  return a
}

export interface ChartVis {
  grid: { progress: Fn; opacity: Fn }
  /** head: the axes are drawn by a hot pen (one continuous L stroke) */
  axes: { progress: Fn; opacity: Fn; head?: boolean }
  ticks: { progress: Fn; opacity: Fn }
}

export function ChartConstruction({ frame, vis }: { frame: ChartFrame; vis: ChartVis }) {
  const grid = useMemo(() => {
    const s: number[] = []
    for (const v of GRID_V) lineSegs(s, [frame.x(0), frame.y(v), 0], [frame.x(1), frame.y(v), 0], GRID_SEGS)
    return new Float32Array(s)
  }, [frame])
  // The reference lines stop before the HUD chip instead of running under its
  // glass (H.45); they retract as the chip fades in and return as it goes.
  const gridKey = useRef({ fid: -1, e0: 0, e1: 0 })
  const writeGrid = (_T: number, s: Float32Array): boolean => {
    const x0 = frame.x(0)
    const x1 = frame.x(1)
    const e0 = hudClipX(x0, x1, frame.y(GRID_V[0]), 0)
    const e1 = hudClipX(x0, x1, frame.y(GRID_V[1]), 0)
    const fid = frameId(frame)
    const g = gridKey.current
    if (g.fid === fid && Math.abs(g.e0 - e0) < 1e-4 && Math.abs(g.e1 - e1) < 1e-4) return false
    g.fid = fid
    g.e0 = e0
    g.e1 = e1
    GRID_V.forEach((v, li) => {
      const xe = li === 0 ? e0 : e1
      const y = frame.y(v)
      for (let i = 0; i < GRID_SEGS; i++) {
        const o = (li * GRID_SEGS + i) * 6
        s[o] = x0 + ((xe - x0) * i) / GRID_SEGS
        s[o + 1] = y
        s[o + 2] = 0
        s[o + 3] = x0 + ((xe - x0) * (i + 1)) / GRID_SEGS
        s[o + 4] = y
        s[o + 5] = 0
      }
    })
    return true
  }
  const axes = useMemo(() => {
    const s: number[] = []
    // ONE continuous L stroke, the way a coach draws axes on a whiteboard:
    // down the power axis to the origin, then along the time axis, left to
    // right (L11). Continuous, so the pen head travels without a jump.
    lineSegs(s, [frame.x(0), frame.y(frame.vMax), 0], [frame.x(0), frame.y(0), 0], 22)
    lineSegs(s, [frame.x(0), frame.y(0), 0], [frame.x(1), frame.y(0), 0], 28)
    return new Float32Array(s)
  }, [frame])
  const ticks = useMemo(() => {
    const s: number[] = []
    POWER_DURATIONS.forEach((_, i) => {
      const x = frame.x(i / (POWER_DURATIONS.length - 1))
      s.push(x, frame.y(0), 0, x, frame.y(0) - TICK_LEN, 0)
    })
    for (const v of [0.5, 1.0]) s.push(frame.x(0), frame.y(v), 0, frame.x(0) - TICK_LEN, frame.y(v), 0)
    return new Float32Array(s)
  }, [frame])
  return (
    <>
      <PenBatch segments={grid} color={PAL.chalk} width={PEN.grid} progress={vis.grid.progress} opacity={vis.grid.opacity} update={writeGrid} renderOrder={29} />
      <PenBatch segments={axes} color={PAL.chalk} width={PEN.axis} progress={vis.axes.progress} opacity={vis.axes.opacity} byArc head={vis.axes.head} hot={vis.axes.head} />
      <PenBatch segments={ticks} color={PAL.chalk} width={PEN.axis} progress={vis.ticks.progress} opacity={vis.ticks.opacity} />
    </>
  )
}

/** The three ENERGY_SYSTEMS duration ranges as strips under the time axis. */
export function EnergyBands({ frame, opacity }: { frame: ChartFrame; opacity: Fn }) {
  const mesh = useMemo(() => {
    const pos: number[] = []
    const col: number[] = []
    const idx: number[] = []
    const y1 = frame.y(0) - 0.02
    const y0 = y1 - BAND_H
    ENERGY_SYSTEMS.forEach((sys, k) => {
      const xa = frame.x(BAND_U[k]) + (k > 0 ? 0.03 : 0)
      const xb = frame.x(BAND_U[k + 1]) - (k < 2 ? 0.03 : 0)
      const c = lin(sys.color)
      const b = pos.length / 3
      pos.push(xa, y0, 0, xb, y0, 0, xb, y1, 0, xa, y1, 0)
      for (let i = 0; i < 4; i++) col.push(c.r, c.g, c.b)
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false })
    const me = new THREE.Mesh(g, m)
    me.renderOrder = 12
    me.frustumCulled = false
    return me
  }, [frame])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    },
    [mesh],
  )
  useSafeFrame('definition energy bands', (T) => {
    const o = opacity(T)
    mesh.visible = o > 0.002
    ;(mesh.material as THREE.MeshBasicMaterial).opacity = o
  })
  return <primitive object={mesh} />
}

/** u and v of each POWER_TASKS dot on the generalist curve. */
export const TASK_U = POWER_TASKS.map((t) => AXIS.u(t.seconds))
export const TASK_400 = POWER_TASKS.findIndex((t) => t.name === '400m run')
/** The task names D.5 labels (the others are dots only, so the phone chart stays clean). */
export const TASK_LABELED = POWER_TASKS.map((t) => ['1RM clean', '400m run', 'Mile run', '10k run'].includes(t.name))
