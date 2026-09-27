import { useRef } from 'react'
import type * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { SdfText } from '../../story/kit/SdfText'
import { useSafeFrame } from '../../story/useSafeFrame'
import type { IntroLayout } from './layout'
import { titleIn, titleOpacity, titleSlide } from './timeline'

/* The title (D.1 I0): WHAT IS in chalk, FITNESS? in #91C640, Anton (SDF,
   one of the few words that belong to the 3D world, L7). Two lines on a
   phone, one on desktop. It rises 0.4 while fading in (I0), dims to 35% and
   slides up 0.5 as the models arrive (I1), and fades out for the chart (I2). */

export function Title({ L }: { L: IntroLayout }) {
  const group = useRef<THREE.Group>(null)
  useSafeFrame('intro title', (T) => {
    const g = group.current
    if (!g) return
    g.position.y = -0.4 * (1 - titleIn(T)) + 0.5 * titleSlide(T)
    g.visible = titleOpacity(T) > 0.002
  }, { hide: group })
  const t = L.title
  return (
    <group ref={group}>
      <SdfText font="anton" text="WHAT IS" size={t.size} color={PAL.chalk} opacity={titleOpacity} anchorX="left" anchorY="bottom-baseline" textAlign="left" position={[t.x1, t.b1, 0]} renderOrder={44} />
      <SdfText font="anton" text="FITNESS?" size={t.size} color={PAL.yellowGreen} opacity={titleOpacity} anchorX="left" anchorY="bottom-baseline" textAlign="left" position={[t.x2, t.b2, 0]} renderOrder={44} />
    </group>
  )
}
