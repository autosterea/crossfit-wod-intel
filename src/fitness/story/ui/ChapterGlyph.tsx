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
