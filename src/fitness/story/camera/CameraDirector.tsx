import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { clock } from '../clock'
import { useStoryStore } from '../store'
import { focus } from './focusRect'
import {
  DEG,
  applyLensShift,
  applyPose,
  copyResolved,
  evalSpec,
  lerpResolved,
  newResolved,
  poseFor,
  readCamera,
  resolvePose,
  type Resolved,
} from './fit'
import { ease } from '../ease'
import type { Rect } from '../types'

/* =========================================================================
   Camera director (DESIGN.md C.8). One perspective camera owned by the
   engine. In story mode the camera is a pure function of T (plus a damped
   desktop pointer parallax when not held). In explore mode drei
   OrbitControls owns the orbit; the director keeps the lens shift and hands
   back with a tween on "Back to story" / Reset.
   ========================================================================= */

/** Shared with gestures (pinch zoom) and the explore panel (Reset view). */
export const cameraBus = {
  controls: null as OrbitControlsImpl | null,
  /** fitted distance of the explore pose (zoom limits are multiples of it) */
  baseDist: 20,
  /** request a tween back to the story pose (ms) */
  tweenStory: 0,
  /** request a tween to the explore pose (ms) */
  tweenExplore: 0,
  /** multiplies the orbit distance (pinch), clamped by limits */
  zoomBy(f: number) {
    const c = cameraBus.controls
    if (!c) return
    const cam = c.object as THREE.PerspectiveCamera
    const off = cam.position.clone().sub(c.target)
    const d = THREE.MathUtils.clamp(off.length() * f, c.minDistance, c.maxDistance)
    off.setLength(d)
    cam.position.copy(c.target).add(off)
    c.update()
  },
}

const scratch = (): Resolved[] => [newResolved(), newResolved(), newResolved(), newResolved(), newResolved()]

export function CameraDirector() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const mode = useStoryStore((s) => s.mode)
  const def = useStoryStore((s) => s.def)
  const reduced = useStoryStore((s) => s.reduced)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const st = useRef({
    rect: { x: 0, y: 0, w: 1, h: 1 } as Rect,
    rectInit: false,
    start: newResolved(),
    pose: newResolved(),
    out: newResolved(),
    from: newResolved(),
    scratchA: scratch(),
    tween: 0,
    tweenDur: 0,
    tweenTo: 'story' as 'story' | 'explore',
    par: { x: 0, y: 0, tx: 0, ty: 0 },
  })

  // Pointer parallax target (desktop story mode only).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const s = st.current
      s.par.tx = (e.clientX / window.innerWidth) * 2 - 1
      s.par.ty = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Explore handoff: orbit target = pose target; limits from the explore spec.
  useEffect(() => {
    const c = controlsRef.current
    cameraBus.controls = mode === 'explore' ? c : null
    if (mode !== 'explore' || !c || !def) return
    const layout = focus.layout
    const ex = def.explore
    const pose = poseFor(ex.cam, layout)
    const r = resolvePose(pose, layout, focus, focus.H)
    cameraBus.baseDist = r.dist
    c.target.copy(r.target)
    c.minAzimuthAngle = (pose.az + ex.limits.az[0]) * DEG
    c.maxAzimuthAngle = (pose.az + ex.limits.az[1]) * DEG
    c.minPolarAngle = (90 - ex.limits.el[1]) * DEG
    c.maxPolarAngle = (90 - ex.limits.el[0]) * DEG
    c.minDistance = r.dist * ex.limits.zoom[0]
    c.maxDistance = r.dist * ex.limits.zoom[1]
    // Tween from wherever the story camera is to the explore pose.
    const s = st.current
    readCamera(camera, c.target, s.from)
    s.tween = 0
    s.tweenDur = reduced ? 0 : 0.9
    s.tweenTo = 'explore'
    c.update()
  }, [mode, def, camera, reduced])

  // Leaving explore: tween back to the beat pose.
  const prevMode = useRef(mode)
  useEffect(() => {
    if (prevMode.current === 'explore' && mode === 'story') {
      const s = st.current
      readCamera(camera, s.pose.target, s.from)
      s.tween = 0
      s.tweenDur = reduced ? 0 : 0.9
      s.tweenTo = 'story'
    }
    prevMode.current = mode
  }, [mode, camera, reduced])

  useFrame((_, dtRaw) => {
    const s = st.current
    const dt = Math.min(0.1, dtRaw)
    const d = useStoryStore.getState().def
    if (!d) return
    const W = focus.W
    const H = focus.H
    // Smoothed focus rect: snaps when held, on the first frame, or under reduced motion.
    const snap = !s.rectInit || clock.held || reduced
    const k = snap ? 1 : 1 - Math.exp(-dt * 10)
    s.rect.x += (focus.x - s.rect.x) * k
    s.rect.y += (focus.y - s.rect.y) * k
    s.rect.w += (focus.w - s.rect.w) * k
    s.rect.h += (focus.h - s.rect.h) * k
    s.rectInit = true
    const layout = focus.layout
    const rect = s.rect

    if (cameraBus.tweenExplore > 0 && useStoryStore.getState().mode === 'explore') {
      const c = controlsRef.current
      if (c) {
        readCamera(camera, c.target, s.from)
        s.tween = 0
        s.tweenDur = cameraBus.tweenExplore / 1000
        s.tweenTo = 'explore'
      }
      cameraBus.tweenExplore = 0
    }

    const m = useStoryStore.getState().mode
    if (m === 'explore') {
      const c = controlsRef.current
      if (s.tweenTo === 'explore' && s.tween < s.tweenDur && c) {
        s.tween += dt
        const pose = resolvePose(poseFor(d.explore.cam, layout), layout, rect, H, s.pose)
        const kk = ease.morph(s.tween / s.tweenDur)
        lerpResolved(s.from, pose, kk, s.out)
        applyPose(camera, s.out, rect, W, H)
        c.target.copy(s.out.target)
        c.update()
      } else {
        const pose = resolvePose(poseFor(d.explore.cam, layout), layout, rect, H, s.pose)
        applyLensShift(camera, pose.px, pose.py, W, H)
      }
      camera.updateMatrixWorld()
      return
    }

    // Story: pose = f(T)
    const beats = d.beats
    const n = clock.index
    const beat = beats[n]
    if (!beat) return
    if (n > 0) resolvePose(poseFor(beats[n - 1].cam, layout), layout, rect, H, s.start)
    else resolvePose(poseFor(beat.cam, layout), layout, rect, H, s.start)
    evalSpec(beat.cam, s.start, clock.t, layout, rect, H, s.scratchA, s.pose)

    // Parallax: desktop, story mode, not held, not reduced.
    const st2 = useStoryStore.getState()
    const allow = focus.shell === 'desktop' && !clock.held && !reduced && st2.playing
    const kp = 1 - Math.exp(-dt * 4)
    s.par.x += ((allow ? s.par.tx : 0) - s.par.x) * kp
    s.par.y += ((allow ? s.par.ty : 0) - s.par.y) * kp
    s.pose.az += s.par.x * 2
    s.pose.el += -s.par.y * 1.5

    if (s.tweenTo === 'story' && s.tween < s.tweenDur) {
      s.tween += dt
      lerpResolved(s.from, s.pose, ease.morph(s.tween / s.tweenDur), s.out)
      applyPose(camera, s.out, rect, W, H)
    } else {
      copyResolved(s.pose, s.out)
      applyPose(camera, s.out, rect, W, H)
    }
    camera.updateMatrixWorld()
  }, -90)

  if (mode !== 'explore') return null
  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      enableZoom={false}
      rotateSpeed={0.6}
    />
  )
}
