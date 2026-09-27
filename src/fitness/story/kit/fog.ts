import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/* useChapterFog (DESIGN.md B.9): only Hopper and Health use fog. Set on
   mount, cleared on unmount. Charts have none. */
export function useChapterFog(color: string, density: number): void {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.fog = new THREE.FogExp2(color, density)
    return () => {
      scene.fog = null
    }
  }, [scene, color, density])
}
