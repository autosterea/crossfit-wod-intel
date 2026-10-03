import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeBackdropMaterial, srgb } from './materials'
import { focusRect } from '../camera/focusRect'
import { useStoryStore } from '../store'
import { MODULES } from '../../fitnessData'

/* The slate (DESIGN.md B.9 "Backdrop"): a fullscreen triangle rendered inside
   the scene so bloom and tone mapping see it. Vertical slate gradient, a
   radial glow centred on the focus rect (mixed 15% toward the chapter
   accent), and a fixed value-noise grain. Engine-owned: every chapter gets
   it for free. */

export const backdropState = { boost: 1 }

export function Backdrop() {
  const view = useStoryStore((s) => s.view)
  const brand = useStoryStore((s) => s.def?.brand)
  const material = useMemo(() => makeBackdropMaterial(), [])
  const mesh = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    const m = new THREE.Mesh(g, material)
    m.frustumCulled = false
    m.renderOrder = -1000
    return m
  }, [material])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      material.dispose()
    },
    [mesh, material],
  )
  useEffect(() => {
    // a branded lab story (H.65) brings its own slate and glow; every fitness chapter keeps the defaults
    const bd = brand?.backdrop
    ;(material.uniforms.uTop.value as THREE.Vector3).copy(srgb(bd?.top ?? '#0c1511'))
    ;(material.uniforms.uBottom.value as THREE.Vector3).copy(srgb(bd?.bottom ?? '#060809'))
    // --st-glow mixed 15% toward the chapter accent, in display space (like CSS color-mix)
    const accent = brand?.accent ?? MODULES.find((m) => m.key === view)?.accent ?? '#91c640'
    ;(material.uniforms.uGlow.value as THREE.Vector3).copy(srgb(bd?.glow ?? '#0f2a1a').lerp(srgb(accent), 0.15))
  }, [view, brand, material])
  useFrame(() => {
    const u = material.uniforms
    const cx = ((focusRect.x + focusRect.w / 2) / focusRect.W) * 2 - 1
    const cy = 1 - ((focusRect.y + focusRect.h / 2) / focusRect.H) * 2
    ;(u.uCenter.value as THREE.Vector2).set(cx, cy)
    u.uAspect.value = focusRect.W / Math.max(1, focusRect.H)
    const diag = Math.hypot(focusRect.w / focusRect.W, focusRect.h / focusRect.H)
    u.uRadius.value = 0.9 * diag * 1.4
    u.uBoost.value = backdropState.boost
  })
  return <primitive object={mesh} />
}
