import { useMemo } from 'react'
import { curveGlyph, decagon, dialGlyph, drumGlyph, humps, surfaceGlyph, toSvgPath } from '../kit/shapes'
import type { FitnessView } from '../../lessonTypes'

/* Inline-SVG chapter glyph built from the same shape generators as the intro
   morphs (DESIGN.md B.5). Used by the chapter sheet, the slate and the
   no-WebGL fallback. */

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
    default:
      return toSvgPath(curveGlyph(undefined, 3, 2.2), size)
  }
}

export function ChapterGlyph({ view, size = 40 }: { view: FitnessView; size?: number }) {
  const d = useMemo(() => pathFor(view, size), [view, size])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={Math.max(1.5, size / 26)} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
