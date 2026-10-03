import { useMemo } from 'react'
import { curveGlyph, decagon, dialGlyph, drumGlyph, humps, surfaceGlyph, toSvgPath } from '../kit/shapes'
import type { FitnessView } from '../../lessonTypes'

/* Inline-SVG chapter glyph built from the same shape generators as the intro
   morphs (DESIGN.md B.5). Used by the chapter sheet, the slate and the
   no-WebGL fallback. */

/** 07 CrossFit: the five-level hierarchy, five stacked slab outlines narrowing upward (STORYBOARD-crossfit.md). */
function pyramidGlyph(): Float32Array[] {
  const out: Float32Array[] = []
  const h = 0.36
  for (let i = 0; i < 5; i++) {
    const w = 2.2 - i * 0.42
    const y0 = i * (h + 0.07)
    const y1 = y0 + h
    out.push(new Float32Array([-w / 2, y0, 0, w / 2, y0, 0, w / 2, y1, 0, -w / 2, y1, 0, -w / 2, y0, 0]))
  }
  return out
}

/**
 * 08 Technique: Figure 1 in miniature (STORYBOARD-technique.md 7.1): the two axes from a corner, a steep
 * arrow and a shallow one of equal length, and the double-headed arc between them.
 */
function techniqueGlyph(): Float32Array[] {
  const out: Float32Array[] = [new Float32Array([0, 2.2, 0, 0, 0, 0, 2.2, 0, 0])]
  const arrow = (a: number, len: number) => {
    const x = Math.cos(a) * len
    const y = Math.sin(a) * len
    const h = 0.32
    out.push(new Float32Array([0, 0, 0, x, y, 0]))
    out.push(new Float32Array([x - Math.cos(a - 0.5) * h, y - Math.sin(a - 0.5) * h, 0, x, y, 0, x - Math.cos(a + 0.5) * h, y - Math.sin(a + 0.5) * h, 0]))
  }
  const aA = Math.atan2(0.87, 0.28)
  const aB = Math.atan2(0.28, 0.87)
  arrow(aA, 2)
  arrow(aB, 2)
  const r = 1.2
  const arc: number[] = []
  for (let i = 0; i <= 16; i++) {
    const a = aA - 0.12 + ((aB + 0.12 - (aA - 0.12)) * i) / 16
    arc.push(Math.cos(a) * r, Math.sin(a) * r, 0)
  }
  out.push(new Float32Array(arc))
  return out
}

function pathFor(view: FitnessView, size: number): string {
  switch (view) {
    case 'skills':
      return toSvgPath(decagon(1), size)
    case 'hopper':
      return toSvgPath(drumGlyph(1), size)
    case 'pathways':
      return toSvgPath(humps(3, 1.6), size)
    case 'definition':
      return toSvgPath(curveGlyph(undefined, 3, 2.2), size)
    case 'continuum':
      return toSvgPath(dialGlyph(1), size)
    case 'health':
      return toSvgPath(surfaceGlyph(3, 2.2), size)
    case 'crossfit':
      return toSvgPath(pyramidGlyph(), size)
    case 'technique':
      return toSvgPath(techniqueGlyph(), size)
    default:
      return toSvgPath(curveGlyph(undefined, 3, 2.2), size)
  }
}

/**
 * The Overview glyph is its own mark: the lesson map, a 2 x 2 of the four
 * model shapes the intro's pen line becomes (skills wheel, hopper drum,
 * energy humps, continuum dial), never another chapter's glyph.
 */
function OverviewGlyph({ size }: { size: number }) {
  const half = size / 2
  const paths = useMemo(
    () => [toSvgPath(decagon(1), half, 2.5), toSvgPath(drumGlyph(1), half, 2.5), toSvgPath(humps(3, 1.6), half, 2.5), toSvgPath(dialGlyph(1), half, 2.5)],
    [half],
  )
  const sw = Math.max(1.25, size / 30)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          transform={`translate(${(i % 2) * half} ${Math.floor(i / 2) * half})`}
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export function ChapterGlyph({ view, size = 40 }: { view: FitnessView; size?: number }) {
  const d = useMemo(() => pathFor(view, size), [view, size])
  if (view === 'intro') return <OverviewGlyph size={size} />
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={Math.max(1.5, size / 26)} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
