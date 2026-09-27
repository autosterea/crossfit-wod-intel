import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type * as THREE from 'three'
import { clock } from '../clock'
import { asset } from '../url'

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

export function SdfText({
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
    const m = ref.current
    if (!m) return
    const o = opacity ? opacity(clock.T) : 1
    m.visible = o > 0.002
    m.fillOpacity = o
    if (outline) m.outlineOpacity = o * 0.8
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
      {text}
    </Text>
  )
}
