import { useMemo } from 'react'
import { PAL } from '../../fitnessData'
import { Pen, PEN } from '../../story/kit/Pen'
import { AreaFill } from '../../story/kit/Fill'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import { useLabels } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'
import { BAND_HI, BAND_LO, MILES_MAX, WIDE_HI, WIDE_LO, capacityAt } from './crossfitMath'
import { SIT_TO_STAND } from './figure'
import { FigureSet, type FigureSpec } from './Figures'
import { tiles, type TilesKind } from './layout'
import { B, iconAfter, iconDraw, tileIn, tileName, tilesOut } from './timeline'

/* =========================================================================
   C0 "The prescription": three glass tiles, the three parts in the guide's
   order of reasoning (functional movement, high intensity, constantly
   varied). Each holds a small BEFORE AND AFTER icon, a miniature of the
   finished frame of the beat that will explain it: a figure standing up
   from a box (its seated pose a ghost), the same light squeezed into a
   taller block, a narrow band of strength widened across the axis.
   ========================================================================= */

export const PART_COLORS = [PAL.yellowGreen, PAL.both, PAL.monostructural] as const
export const PART_NAMES = ['FUNCTIONAL MOVEMENT', 'HIGH INTENSITY', 'CONSTANTLY VARIED'] as const
/** Each part in plain words (CF_PRESCRIPTION.plain, crossfit.com "CrossFit Methodology"). */
export const PART_PLAIN = ['THE ONES YOU ALREADY USE DAILY', 'HARD ENOUGH TO MAKE YOU FITTER', 'NEVER THE SAME FOR LONG'] as const

/** Icon-local frame: x about -1.2..1.2, y -0.95..1.0; world = centre + k * local. */
const AX = -1.15
const AY = -0.95

function polyline(cx: number, cy: number, k: number, xy: readonly number[], z = 0.02): Float32Array {
  const out = new Float32Array((xy.length / 2) * 3)
  for (let i = 0; i < xy.length / 2; i++) {
    out[i * 3] = cx + k * xy[i * 2]
    out[i * 3 + 1] = cy + k * xy[i * 2 + 1]
    out[i * 3 + 2] = z
  }
  return out
}

function curveXY(lo: number, hi: number): number[] {
  const xy: number[] = []
  for (let i = 0; i <= 48; i++) {
    const miles = (i / 48) * MILES_MAX
    xy.push(AX + 2.35 * (miles / MILES_MAX), AY + 1.7 * capacityAt(miles, lo, hi))
  }
  return xy
}

function IntensityIcon({ cx, cy, k }: { cx: number; cy: number; k: number }) {
  const axis = useMemo(() => polyline(cx, cy, k, [AX, 1.0, AX, AY, 1.2, AY]), [cx, cy, k])
  const ghost = useMemo(() => polyline(cx, cy, k, [AX, -0.15, 0.85, -0.15, 0.85, AY]), [cx, cy, k])
  const block = useMemo(() => polyline(cx, cy, k, [AX, 0.65, -0.15, 0.65, -0.15, AY], 0.03), [cx, cy, k])
  const top = useMemo(() => new Float32Array([cx + k * AX, cy + k * 0.65, cx + k * -0.15, cy + k * 0.65]), [cx, cy, k])
  const vis = (T: number) => tileIn(T, 1) * tilesOut(T)
  return (
    <>
      <Pen points={axis} color={PAL.chalk} width={PEN.axis} progress={(T) => iconDraw(T, 1)} opacity={(T) => 0.55 * vis(T)} />
      <Pen points={ghost} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.16 * k} gapSize={0.12 * k} progress={(T) => iconDraw(T, 1)} opacity={(T) => 0.7 * vis(T)} />
      <AreaFill
        top={top}
        baseline={cy + k * AY}
        z={0.01}
        color={PAL.both}
        opacity={(T) => iconAfter(T, 1) * vis(T)}
        lo={0.12}
        hi={0.6}
        gamma={1.2}
        additive
        rim={() => 1.6}
        rimWidth={0.08 * k}
      />
      <Pen points={block} color={PAL.both} width={PEN.data} progress={(T) => iconAfter(T, 1)} opacity={vis} />
    </>
  )
}

function VariedIcon({ cx, cy, k }: { cx: number; cy: number; k: number }) {
  const axis = useMemo(() => polyline(cx, cy, k, [AX, 1.0, AX, AY, 1.2, AY]), [cx, cy, k])
  const narrow = useMemo(() => polyline(cx, cy, k, curveXY(BAND_LO, BAND_HI)), [cx, cy, k])
  const broad = useMemo(() => polyline(cx, cy, k, curveXY(WIDE_LO, WIDE_HI), 0.03), [cx, cy, k])
  const band = useMemo(() => {
    const x0 = AX + 2.35 * (WIDE_LO / MILES_MAX)
    const x1 = AX + 2.35 * (WIDE_HI / MILES_MAX)
    return new Float32Array([cx + k * x0, cy + k * (AY + 1.62), cx + k * x1, cy + k * (AY + 1.62)])
  }, [cx, cy, k])
  const vis = (T: number) => tileIn(T, 2) * tilesOut(T)
  return (
    <>
      <AreaFill top={band} baseline={cy + k * AY} z={-0.01} color={PAL.monostructural} opacity={(T) => iconAfter(T, 2) * vis(T)} lo={0.005} hi={0.03} />
      <Pen points={axis} color={PAL.chalk} width={PEN.axis} progress={(T) => iconDraw(T, 2)} opacity={(T) => 0.55 * vis(T)} />
      <Pen points={narrow} color={PAL.chalk} width={PEN.axis} dashed dashSize={0.12 * k} gapSize={0.1 * k} progress={(T) => iconDraw(T, 2)} opacity={(T) => 0.7 * vis(T)} />
      <Pen points={broad} color={PAL.yellowGreen} width={PEN.data} progress={(T) => iconAfter(T, 2)} opacity={vis} />
    </>
  )
}

export function Tiles({ kind }: { kind: TilesKind }) {
  const geo = useMemo(() => tiles(kind), [kind])
  const plates = useMemo<PlateSpec[]>(
    () =>
      geo.map((g, i) => ({
        rect: g.rect,
        fill: PAL.chalk,
        fillAlpha: 0.006,
        line: PART_COLORS[i],
        lineAlpha: 0.4,
      })),
    [geo],
  )
  // the functional icon: a figure standing up from a box, its seated pose a ghost
  const figs = useMemo<FigureSpec[]>(() => {
    const g = geo[0]
    const k = g.k
    return [
      {
        id: 'cf-icon-fig',
        move: SIT_TO_STAND,
        place: { x: g.icon[0] + k * 0.42, y: g.icon[1] + k * AY, z: 0.02, S: k * 1.95, yaw: 90 },
        p: () => 1,
        draw: (T) => iconDraw(T, 0),
        vis: (T) => tileIn(T, 0) * tilesOut(T),
        ghost: (T) => iconAfter(T, 0),
        marks: (T) => iconAfter(T, 0),
        width: 2.25,
      },
    ]
  }, [geo])
  const floor = useMemo(() => {
    const g = geo[0]
    return polyline(g.icon[0], g.icon[1], g.k, [-1.2, AY, 1.2, AY])
  }, [geo])
  // the part's name, and under it the same part in plain words
  const labels = useMemo<LabelSpec[]>(
    () =>
      geo.flatMap((g, i) => {
        return [
          {
            id: `cf-tile-${i}`,
            text: PART_NAMES[i],
            tone: 'name' as const,
            color: PART_COLORS[i],
            anchor: [g.name[0], g.name[1], 0.05] as const,
            prefer: g.nameDir,
            only: [g.nameDir],
            gapPx: 2,
            priority: 90,
            required: true,
            cue: (T: number) => tileName(T, i) * tilesOut(T),
          },
          {
            id: `cf-tile-sub-${i}`,
            text: PART_PLAIN[i],
            tone: 'tick' as const,
            anchor: [g.sub[0], g.sub[1], 0.05] as const,
            prefer: 'C' as const,
            only: ['C' as const],
            priority: 84,
            required: true,
            cue: (T: number) => tileName(T, i) * tilesOut(T),
          },
        ]
      }),
    [geo],
  )
  useLabels(labels)
  const live = (T: number) => (T < B.func + 0.2 ? 1 : 0)
  return (
    <>
      <Plates plates={plates} radius={0.32} z={-0.12} vis={(T, i) => tileIn(T, i) * tilesOut(T)} opacity={live} renderOrder={4} />
      <Pen points={floor} color={PAL.chalk} width={PEN.grid} progress={(T) => iconDraw(T, 0)} opacity={(T) => 0.4 * tileIn(T, 0) * tilesOut(T)} />
      <FigureSet specs={figs} obstacleId="cf-icon-fig" glowPx={12} />
      <IntensityIcon cx={geo[1].icon[0]} cy={geo[1].icon[1]} k={geo[1].k} />
      <VariedIcon cx={geo[2].icon[0]} cy={geo[2].icon[1]} k={geo[2].k} />
    </>
  )
}
