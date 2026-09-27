import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type * as THREE from 'three'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { asset } from '../url'
import { readyState, readyTick } from '../ready'

/* =========================================================================
   <SdfText/> (DESIGN.md C.11, L7): drei <Text> (troika SDF) with the
   SELF-HOSTED fonts only, resolved from import.meta.env.BASE_URL so they
   load under '/' and '/preview/'. Only for the few large words that belong
   to the 3D world; all reading text is DOM labels. The `text` prop never
   changes per frame; opacity animates through the material ref.
   ========================================================================= */

export const SDF_FONTS = {
  anton: asset('fonts/Anton-Regular.ttf'),
  barlowSemi: asset('fonts/BarlowCondensed-SemiBold.ttf'),
  barlowBold: asset('fonts/BarlowCondensed-Bold.ttf'),
} as const

export type SdfFont = keyof typeof SDF_FONTS

/** Characters preloaded per font (drei suspends until the glyphs exist). */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 =?.,:+%/'

/*
 * Network rule (E.14): troika fetches a FALLBACK font from a CDN for any
 * glyph the self-hosted TTF lacks, and a custom unicodeFontsURL does not
 * help (on failure it retries the CDN). So SdfText only ever passes glyphs
 * from this whitelist, which the three TTFs cover; anything else is replaced
 * by a space, with a warning in development.
 */
const SAFE = new Set(CHARS.split(''))
const warned = new Set<string>()
export function sdfSafe(text: string): string {
  let out = ''
  let bad = ''
  for (const ch of text) {
    if (SAFE.has(ch) || ch === String.fromCharCode(10)) out += ch
    else {
      out += ' '
      bad += ch
    }
  }
  if (bad && import.meta.env.DEV && !warned.has(text)) {
    warned.add(text)
    console.warn('[SdfText] "' + text + '" has glyphs outside the self-hosted font whitelist (' + bad + '); they were replaced, never fetched')
  }
  return out
}

export interface SdfTextProps {
  font: SdfFont
  text: string
  size: number
  maxWidth?: number
  color: string
  opacity?: (T: number) => number
  anchorX?: 'left' | 'center' | 'right'
  anchorY?: 'top' | 'middle' | 'bottom' | 'top-baseline' | 'bottom-baseline'
  outline?: boolean
  position?: [number, number, number]
  letterSpacing?: number
  lineHeight?: number
  textAlign?: 'left' | 'center' | 'right'
  renderOrder?: number
  onSync?: (mesh: THREE.Mesh) => void
  children?: ReactNode
}

/**
 * Each SdfText suspends inside its OWN boundary (amendment H.39). troika
 * never resolves a font that failed to load, so one failed TTF request used
 * to hold the whole chapter Suspense (and the slate) forever. Now a missing
 * font hides only that word; readiness waits for pending words (so the
 * prewarm compiles them) but gives up after the readiness timeout.
 */
function SdfPending() {
  useEffect(() => {
    readyState.sdfPending++
    return () => {
      readyState.sdfPending = Math.max(0, readyState.sdfPending - 1)
      readyTick(false)
    }
  }, [])
  return null
}

class SdfBoundary extends Component<{ children: ReactNode; text: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: Error) {
    reportOnce('<SdfText> "' + this.props.text + '"', err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function SdfText(props: SdfTextProps) {
  return (
    <SdfBoundary text={props.text}>
      <Suspense fallback={<SdfPending />}>
        <SdfTextInner {...props} />
      </Suspense>
    </SdfBoundary>
  )
}

function SdfTextInner({
  font,
  text,
  size,
  maxWidth,
  color,
  opacity,
  anchorX = 'center',
  anchorY = 'middle',
  outline = false,
  position,
  letterSpacing = 0,
  lineHeight = 1,
  textAlign = 'center',
  renderOrder = 45,
  onSync,
}: SdfTextProps) {
  const ref = useRef<THREE.Mesh & { fillOpacity: number; outlineOpacity: number }>(null)
  useFrame(() => {
    try {
      const m = ref.current
      if (!m) return
      const o = opacity ? opacity(clock.T) : 1
      m.visible = o > 0.002
      m.fillOpacity = o
      if (outline) m.outlineOpacity = o * 0.8
    } catch (err) {
      if (ref.current) ref.current.visible = false
      reportOnce('<SdfText> callback', err)
    }
  })
  return (
    <Text
      ref={ref as never}
      font={SDF_FONTS[font]}
      characters={CHARS}
      fontSize={size}
      maxWidth={maxWidth}
      color={color}
      anchorX={anchorX}
      anchorY={anchorY}
      position={position}
      letterSpacing={letterSpacing}
      lineHeight={lineHeight}
      textAlign={textAlign}
      outlineWidth={outline ? size * 0.04 : 0}
      outlineColor="#070a0e"
      renderOrder={renderOrder}
      depthOffset={-1}
      onSync={onSync as never}
    >
      {sdfSafe(text)}
    </Text>
  )
}
