import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { makeRingMaterial } from '../../story/kit/materials'
import { useSafeFrame } from '../../story/useSafeFrame'

/* =========================================================================
   Hollow rings, ONE draw call: the kit's ring material (the Ripple's, a ring
   drawn in point space, sized in CSS px) on many points, each with its own
   ring parameter k held still instead of expanding. k sets the ring's
   radius and brightness (the material's own curve): about 0.35 reads as a
   full-strength thin ring, 0.6 as a ring at about 35%. T0's eight runners
   who stop, T1's collapsed arrowheads at the origin.
   ========================================================================= */

export interface RingsProps {
  count: number
  /** point size in CSS px (the ring's diameter is about 0.65 x size at k 0.6, 0.45 x size at k 0.35) */
  sizePx: number
  /** one colour per ring (hex) */
  colors: readonly string[]
  /** write ring i's world position; return its k in (0, 1), or 0 to hide it */
  place: (T: number, i: number, out: [number, number, number]) => number
  renderOrder?: number
}

export function Rings({ count, sizePx, colors, place, renderOrder = 48 }: RingsProps) {
  const key = colors.join(',')
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    const col = new Float32Array(count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      c.set(colors[Math.min(i, colors.length - 1)] ?? '#eef3f6')
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count).fill(sizePx), 1))
    g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(count), 1))
    const p = new THREE.Points(g, makeRingMaterial())
    p.frustumCulled = false
    p.renderOrder = renderOrder
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, sizePx, key, renderOrder])
  useEffect(
    () => () => {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    },
    [obj],
  )
  const tmp = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  useSafeFrame(
    'technique rings',
    (T) => {
      const pa = obj.geometry.attributes.position as THREE.BufferAttribute
      const ka = obj.geometry.attributes.aK as THREE.BufferAttribute
      let any = false
      for (let i = 0; i < count; i++) {
        const k = place(T, i, tmp)
        const kk = k > 0.001 && k < 0.999 ? k : 0
        if (kk > 0) any = true
        pa.setXYZ(i, tmp[0], tmp[1], tmp[2])
        ka.setX(i, kk)
      }
      pa.needsUpdate = true
      ka.needsUpdate = true
      obj.visible = any
    },
    { hide: { current: obj } },
  )
  return <primitive object={obj} />
}
