import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, SMAA } from '@react-three/postprocessing'
import { BlendFunction, SMAAPreset, type BloomEffect } from 'postprocessing'
import * as THREE from 'three'
import { useStoryStore } from '../store'
import { TIERS } from './tiers'
import { NeutralToneEffect, installCustomToneMapping } from './neutral'
import { impactK } from '../kit/impact'
import { clock } from '../clock'

/* =========================================================================
   Engine-owned post-processing (DESIGN.md B.10). Chapters never add effects.
   HIGH: MSAA 4, mip bloom (7 levels), neutral tone map, grain.
   MEDIUM: half-resolution bloom (5 levels), neutral, SMAA.
   LOW: no composer at all (the composer forces NoToneMapping even when
   disabled, amendment H.2); the renderer tone maps with the same curve and
   hot elements get engine halos instead of bloom.
   Effect order: Bloom, ToneMapping, Noise, SMAA. The effect list is static
   per tier; the impact accent animates the bloom intensity uniform only.
   ========================================================================= */

const BASE_INTENSITY: Record<string, number> = { high: 0.85, medium: 0.8, low: 0 }

export function Post() {
  const tier = useStoryStore((s) => s.tier)
  const spec = TIERS[tier]
  const gl = useThree((s) => s.gl)
  const bloomRef = useRef<BloomEffect | null>(null)
  const tone = useMemo(() => new NeutralToneEffect(), [])
  useEffect(() => () => tone.dispose(), [tone])

  useEffect(() => {
    if (!spec.composer) {
      installCustomToneMapping()
      gl.toneMapping = THREE.CustomToneMapping
      gl.toneMappingExposure = 1
    }
  }, [spec.composer, gl])

  // Impact accent (B.10): bloom += 0.6 sin(pi k) inside the beat's impact window.
  useFrame(() => {
    const b = bloomRef.current
    if (!b) return
    b.intensity = BASE_INTENSITY[tier] + 0.6 * impactK(clock.T)
  }, -5)

  if (!spec.composer) return null
  const msaa = spec.msaa > 0 && gl.capabilities.maxSamples >= spec.msaa ? spec.msaa : 0
  const smaa = spec.smaa || (spec.msaa > 0 && msaa === 0)
  return (
    <EffectComposer
      key={tier}
      frameBufferType={THREE.HalfFloatType}
      stencilBuffer={false}
      enableNormalPass={false}
      multisampling={msaa}
    >
      <Bloom
        ref={bloomRef}
        mipmapBlur
        luminanceThreshold={1}
        luminanceSmoothing={0.1}
        intensity={BASE_INTENSITY[tier]}
        radius={0.72}
        levels={spec.bloomLevels}
        resolutionScale={spec.bloomScale}
      />
      <primitive object={tone} />
      {spec.grain ? <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.035} /> : <></>}
      {smaa ? <SMAA preset={SMAAPreset.MEDIUM} /> : <></>}
    </EffectComposer>
  )
}
