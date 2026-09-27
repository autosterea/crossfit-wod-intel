import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Tier } from '../types'

/* renderer.info snapshot (DESIGN.md C.10). gl.info.autoReset is off; one
   useFrame at priority -1000 copies the counters of the whole PREVIOUS frame
   (every post pass included) and resets them. */

export interface StatsSnapshot {
  calls: number
  triangles: number
  points: number
  lines: number
  geometries: number
  textures: number
  programs: number
}

export const statsSnap: StatsSnapshot = { calls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0, programs: 0 }
let dprNow = 1

export function readStats(tier: Tier): StatsSnapshot & { tier: Tier; dpr: number } {
  return { ...statsSnap, tier, dpr: dprNow }
}

export function StatsProbe() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])
  useFrame(() => {
    const r = gl.info.render
    const m = gl.info.memory
    statsSnap.calls = r.calls
    statsSnap.triangles = r.triangles
    statsSnap.points = r.points
    statsSnap.lines = r.lines
    statsSnap.geometries = m.geometries
    statsSnap.textures = m.textures
    statsSnap.programs = gl.info.programs?.length ?? 0
    dprNow = gl.getPixelRatio()
    gl.info.reset()
  }, -1000)
  return null
}
