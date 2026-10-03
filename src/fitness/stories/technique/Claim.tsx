import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PAL, SEE } from '../../fitnessData'
import type { ChartFrame } from '../../story/kit/chartFrame'
import { SdfText } from '../../story/kit/SdfText'
import { useSafeFrame } from '../../story/useSafeFrame'
import { bumpObstacles, useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box, LabelSpec } from '../../story/types'
import { PLOT } from './layout'
import { B, claimSettle, legendOn } from './timeline'

/* =========================================================================
   T9 "Technique is everything" (p. 44): the chapter closes on its
   definition. Figure 1 is back (Graph.tsx); a pinned legend lights safety,
   efficacy and efficiency one by one (technique is an intimate part of all
   three, p. 43); then the chapter's one SDF claim, the article's own words,
   ink on a lime plate in the plot's empty upper right. The plate is a label
   obstacle.
   ========================================================================= */

const LEGEND = [
  { text: 'SAFETY', color: SEE[0].color },
  { text: 'EFFICACY', color: SEE[1].color },
  { text: 'EFFICIENCY', color: SEE[2].color },
] as const

export function Claim({ f }: { f: ChartFrame }) {
  // centre at plot (0.64, 0.66); at most half the plot wide
  const cx = f.x(PLOT.u0 + (PLOT.u1 - PLOT.u0) * 0.64)
  const cy = f.y(PLOT.v0 + (PLOT.v1 - PLOT.v0) * 0.66)
  const maxW = 0.5 * (PLOT.u1 - PLOT.u0) * f.FW
  const size = Math.min(0.66, Math.max(0.34, maxW / 6.6))

  const plate = useRef<THREE.Mesh>(null)
  const keyline = useRef<THREE.Mesh>(null)
  const group = useRef<THREE.Group>(null)
  const ext = useRef({ w: 0, h: 0, x: 0, y: 0 })
  const geo = useMemo(() => {
    const w = 1
    const h = 1
    const r = 0.12
    const s = new THREE.Shape()
    s.moveTo(-w / 2 + r, -h / 2)
    s.lineTo(w / 2 - r, -h / 2)
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
    s.lineTo(w / 2, h / 2 - r)
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
    s.lineTo(-w / 2 + r, h / 2)
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
    s.lineTo(-w / 2, -h / 2 + r)
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
    return new THREE.ShapeGeometry(s, 6)
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.yellowGreen, transparent: true, depthWrite: false, toneMapped: false }), [])
  // an ink keyline, so the plate separates from the lime arrow and arc behind it
  const inkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.ink, transparent: true, depthWrite: false, toneMapped: false }), [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => inkMat.dispose(), [inkMat])

  const appear = (T: number) => (T >= B.everything ? claimSettle(T) : 0)
  // size the plate to the laid-out text (troika block bounds), with padding
  const onSync = (m: THREE.Mesh) => {
    const info = (m as unknown as { textRenderInfo?: { blockBounds: number[] } }).textRenderInfo
    const p = plate.current
    if (!info || !p) return
    const [x0, y0, x1, y1] = info.blockBounds
    const w = x1 - x0 + size * 0.9
    const h = y1 - y0 + size * 0.55
    p.scale.set(w, h, 1)
    p.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0)
    const k = keyline.current
    if (k) {
      k.scale.set(w + size * 0.18, h + size * 0.18, 1)
      k.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.005)
    }
    ext.current = { w, h, x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
    bumpObstacles()
  }
  useSafeFrame(
    'technique claim plate',
    (T) => {
      const a = appear(T)
      const g = group.current!
      g.visible = a > 0.002
      g.position.set(cx, cy - 0.35 * size * (1 - a), 0.12)
      const s = 0.92 + 0.08 * a
      g.scale.set(s, s, 1)
      mat.opacity = a
      inkMat.opacity = Math.min(1, a * 1.4)
    },
    { hide: group },
  )
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      box: (T: number): Box | null => {
        if (appear(T) < 0.05) return null
        const e = ext.current
        const w = e.w || size * 7
        const h = e.h || size * 2.6
        return [
          [cx + e.x - w / 2, cy + e.y - h / 2, 0.12],
          [cx + e.x + w / 2, cy + e.y + h / 2, 0.12],
        ]
      },
      padPx: 6,
    }),
    [cx, cy, size],
  )
  useWorldObstacle('tq-claim', obstacle)

  /* the pinned legend: three swatches lighting one by one on their words */
  const labels = useMemo<LabelSpec[]>(
    () =>
      LEGEND.map((l, i) => ({
        id: `tq-legend-${i}`,
        text: l.text,
        tone: 'legend' as const,
        color: l.color,
        anchor: [0, 0, 0] as const,
        // top right: the top left holds Figure 1's energy axis and its title
        pin: 'top-right' as const,
        pinOrder: i,
        cue: (T: number) => (T >= B.everything ? legendOn(T, i) : 0),
      })),
    [],
  )
  useLabels(labels)

  return (
    <group ref={group}>
      <mesh ref={keyline} geometry={geo} material={inkMat} renderOrder={45} scale={[size * 7.2, size * 2.8, 1]} />
      <mesh ref={plate} geometry={geo} material={mat} renderOrder={46} scale={[size * 7, size * 2.6, 1]} />
      <SdfText
        font="barlowBold"
        text={'TECHNIQUE IS\nEVERYTHING'}
        size={size}
        color={PAL.ink}
        opacity={(T) => Math.min(1, appear(T) * 1.25)}
        position={[0, 0, 0.01]}
        letterSpacing={0.04}
        lineHeight={1.02}
        textAlign="center"
        renderOrder={47}
        onSync={onSync}
      />
    </group>
  )
}
