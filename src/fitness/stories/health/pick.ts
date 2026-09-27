import * as THREE from 'three'
import { sampleGrid } from './healthMath'
import { Z0, Z1, ageOfZ, uOfX, worldNow } from './layout'
import { HS } from './state'

/* Explore picking (D.7 "Explore"): the drag handle and Scrub drags move the
   amber age slice to the age under the finger. */

const _box = new THREE.Box3()
const _hitIn = new THREE.Vector3()
const _p = new THREE.Vector3()
const _floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

/**
 * The age under a pick ray: marched along the ray through the landscape's
 * bounding box to the first point under the displayed surface (then
 * bisected), or the floor if the ray misses the landscape. Allocation free.
 */
export function pickAge(ray: THREE.Ray): number | null {
  const { XW, YS } = worldNow()
  _box.min.set(-XW, -0.01, Z1)
  _box.max.set(XW, YS * 1.06, Z0)
  const inside = (t: number) => {
    ray.at(t, _p)
    return _p.y <= sampleGrid(HS.grid, uOfX(_p.x, XW), ageOfZ(_p.z)) * YS
  }
  if (ray.intersectBox(_box, _hitIn)) {
    const t0 = _hitIn.distanceTo(ray.origin)
    const t1 = t0 + 2 * Math.hypot(2 * XW, YS, Z0 - Z1)
    const steps = 160
    let prev = t0
    for (let i = 1; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps
      ray.at(t, _p)
      if (_p.x < -XW - 0.01 || _p.x > XW + 0.01 || _p.z < Z1 - 0.01 || _p.z > Z0 + 0.01 || _p.y < -0.02) break
      if (inside(t)) {
        let lo = prev
        let hi = t
        for (let k = 0; k < 10; k++) {
          const m = (lo + hi) / 2
          if (inside(m)) hi = m
          else lo = m
        }
        ray.at(hi, _p)
        return Math.max(20, Math.min(85, ageOfZ(_p.z)))
      }
      prev = t
    }
  }
  if (ray.intersectPlane(_floor, _p)) return Math.max(20, Math.min(85, ageOfZ(_p.z)))
  return null
}
