import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/* useChapterFog (DESIGN.md B.9): only Hopper and Health use fog. Set on
   mount, cleared on unmount, but only if it is still THIS fog: on the
   persistent stage the next chapter mounts in the same commit, and its own
   fog (Health sets one in a layout effect) must survive this passive
   cleanup (integration, H.53). Charts have none. */
export function useChapterFog(color: string, density: number): void {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const fog = new THREE.FogExp2(color, density)
    scene.fog = fog
    return () => {
      if (scene.fog === fog) scene.fog = null
    }
  }, [scene, color, density])
}
