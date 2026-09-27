import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { clock } from '../clock'
import { reportOnce } from '../safe'
import { useStoryStore } from '../store'
import { focusRect } from './focusRect'
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
  /** a Reset view request, picked up by the director on its next frame */
  resetRequested: false,
  /** Reset view: tween (a cut under reduced motion) to the explore pose fitted to the CURRENT frame and focus rect */
  resetView() {
    cameraBus.resetRequested = true
    cameraBus.orbit = null
  },
  /** a requested explore orbit (degrees, absolute), eased by the director; a user drag cancels it */
  orbit: null as { az: number; el: number } | null,
  /**
   * Explore: glide the orbit to (az, el) degrees at the current distance,
   * within the explore limits. For revealing a dimension a control just
   * turned on (L6), e.g. the Definition domain fan in depth. A cut under
   * reduced motion; any orbit drag cancels it.
   */
  orbitTo(az: number, el: number) {
    cameraBus.orbit = { az, el }
  },
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
const _off = new THREE.Vector3()
const _dirv = new THREE.Vector3()

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
    /** a tween is running (or a one-frame cut is pending when tweenDur is 0) */
    tweening: false,
    tween: 0,
    tweenDur: 0,
    tweenTo: 'story' as 'story' | 'explore',
    /** explore: the fitted distance and target the orbit is currently scaled to (0 = not settled yet) */
    exBase: 0,
    exTarget: new THREE.Vector3(),
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
    cameraBus.resetRequested = false
    // a stale orbit request never survives a mode change (a chapter's explore
    // layer may request a new one in its own effect, which runs after this)
    cameraBus.orbit = null
    if (mode !== 'explore' || !c || !def) return
    const layout = focusRect.layout
    const ex = def.explore
    const pose = poseFor(ex.cam, layout)
    const r = resolvePose(pose, layout, focusRect, focusRect.H)
    cameraBus.baseDist = r.dist
    c.target.copy(r.target)
    c.minAzimuthAngle = (pose.az + ex.limits.az[0]) * DEG
    c.maxAzimuthAngle = (pose.az + ex.limits.az[1]) * DEG
    c.minPolarAngle = (90 - ex.limits.el[1]) * DEG
    c.maxPolarAngle = (90 - ex.limits.el[0]) * DEG
    // No distance clamp while the handoff tween runs (the story camera may be
    // farther than the explore zoom range, e.g. the D6 lineup); the director
    // sets the limits from the fitted pose once the tween lands.
    c.minDistance = 0
    c.maxDistance = Infinity
    // Tween (a one-frame cut under reduced motion) from wherever the story
    // camera is to the explore pose.
    startTween(st.current, camera, 'explore', c.target, reduced ? 0 : 0.9)
    c.update()
    // the viewer's own orbit drag cancels a requested orbit
    const cancel = () => void (cameraBus.orbit = null)
    c.addEventListener('start', cancel)
    return () => c.removeEventListener('start', cancel)
  }, [mode, def, camera, reduced])

  // Leaving explore: tween back to the beat pose (a cut under reduced motion).
  const prevMode = useRef(mode)
  useEffect(() => {
    if (prevMode.current === 'explore' && mode === 'story') startTween(st.current, camera, 'story', st.current.pose.target, reduced ? 0 : 0.9)
    prevMode.current = mode
  }, [mode, camera, reduced])

  useFrame((_, dtRaw) => {
    const s = st.current
    const dt = Math.min(0.1, dtRaw)
    const d = useStoryStore.getState().def
    if (!d) return
    const W = focusRect.W
    const H = focusRect.H
    // Smoothed focus rect: snaps when held, on the first frame, or under reduced motion.
    const snap = !s.rectInit || clock.held || reduced
    const k = snap ? 1 : 1 - Math.exp(-dt * 10)
    s.rect.x += (focusRect.x - s.rect.x) * k
    s.rect.y += (focusRect.y - s.rect.y) * k
    s.rect.w += (focusRect.w - s.rect.w) * k
    s.rect.h += (focusRect.h - s.rect.h) * k
    s.rectInit = true
    const layout = focusRect.layout
    const rect = s.rect

    const m = useStoryStore.getState().mode
    if (m === 'explore') {
      const c = controlsRef.current
      if (cameraBus.resetRequested && c) {
        // Reset view fits the CURRENT frame and focus rect (the sheet may be open)
        cameraBus.resetRequested = false
        c.minDistance = 0
        c.maxDistance = Infinity
        startTween(s, camera, 'explore', c.target, reduced ? 0 : 0.6)
      }
      let pose: Resolved
      try {
        pose = resolvePose(poseFor(d.explore.cam, layout), layout, rect, H, s.pose)
      } catch (err) {
        reportOnce('explore camera pose', err)
        return
      }
      if (s.tweenTo === 'explore' && s.tweening && c) {
        s.tween += dt
        const kk = s.tweenDur > 0 ? ease.morph(Math.min(1, s.tween / s.tweenDur)) : 1
        lerpResolved(s.from, pose, kk, s.out)
        applyPose(camera, s.out, rect, W, H)
        c.target.copy(s.out.target)
        if (kk >= 1) {
          s.tweening = false
          s.exBase = pose.dist
          s.exTarget.copy(pose.target)
          setLimits(c, pose.dist, d.explore.limits.zoom)
        }
        c.update()
      } else if (c) {
        // Re-fit (E.3): the sheet detent, a rotation or a new chart frame
        // changes the fitted distance or target of the explore pose. Keep the
        // viewer's orbit angles and relative zoom and scale the orbit to the
        // new fit. The rect is smoothed, so the chart glides with the sheet.
        if (s.exBase > 0 && (Math.abs(pose.dist - s.exBase) > 1e-4 * s.exBase || s.exTarget.distanceToSquared(pose.target) > 1e-10)) {
          _off.copy(camera.position).sub(c.target).multiplyScalar(pose.dist / s.exBase)
          c.target.copy(pose.target)
          camera.position.copy(pose.target).add(_off)
          setLimits(c, pose.dist, d.explore.limits.zoom)
        } else if (s.exBase === 0) setLimits(c, pose.dist, d.explore.limits.zoom)
        s.exBase = pose.dist
        s.exTarget.copy(pose.target)
        // a requested orbit (cameraBus.orbitTo), eased at the current distance
        const o = cameraBus.orbit
        if (o) {
          const ex = d.explore
          const base = poseFor(ex.cam, layout)
          const taz = THREE.MathUtils.clamp(o.az, base.az + ex.limits.az[0], base.az + ex.limits.az[1])
          const tel = THREE.MathUtils.clamp(o.el, ex.limits.el[0], ex.limits.el[1])
          _off.copy(camera.position).sub(c.target)
          const r = _off.length()
          let az = Math.atan2(_off.x, _off.z) / DEG
          let el = Math.asin(THREE.MathUtils.clamp(_off.y / Math.max(r, 1e-6), -1, 1)) / DEG
          const kk = reduced ? 1 : 1 - Math.exp(-dt * 4.5)
          az += (taz - az) * kk
          el += (tel - el) * kk
          if (Math.abs(taz - az) < 0.15 && Math.abs(tel - el) < 0.15) {
            az = taz
            el = tel
            cameraBus.orbit = null
          }
          const a = az * DEG
          const e = el * DEG
          _dirv.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))
          camera.position.copy(c.target).addScaledVector(_dirv, r)
          camera.lookAt(c.target)
        }
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
    try {
      if (n > 0) resolvePose(poseFor(beats[n - 1].cam, layout), layout, rect, H, s.start)
      else resolvePose(poseFor(beat.cam, layout), layout, rect, H, s.start)
      evalSpec(beat.cam, s.start, clock.t, layout, rect, H, s.scratchA, s.pose)
    } catch (err) {
      // a throwing pose function keeps the last good camera
      reportOnce('camera pose of beat ' + n, err)
      return
    }

    // Parallax: desktop, story mode, not held, not reduced.
    const st2 = useStoryStore.getState()
    const allow = focusRect.shell === 'desktop' && !clock.held && !reduced && st2.playing
    const kp = 1 - Math.exp(-dt * 4)
    s.par.x += ((allow ? s.par.tx : 0) - s.par.x) * kp
    s.par.y += ((allow ? s.par.ty : 0) - s.par.y) * kp
    s.pose.az += s.par.x * 2
    s.pose.el += -s.par.y * 1.5

    if (s.tweenTo === 'story' && s.tweening) {
      s.tween += dt
      const kk = s.tweenDur > 0 ? ease.morph(Math.min(1, s.tween / s.tweenDur)) : 1
      lerpResolved(s.from, s.pose, kk, s.out)
      applyPose(camera, s.out, rect, W, H)
      if (kk >= 1) s.tweening = false
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

interface TweenState {
  from: Resolved
  tween: number
  tweenDur: number
  tweenTo: 'story' | 'explore'
  tweening: boolean
  exBase: number
}

/** Start a tween from the current camera. seconds = 0 is a one-frame cut (reduced motion). */
function startTween(s: TweenState, camera: THREE.Camera, to: 'story' | 'explore', target: THREE.Vector3, seconds: number): void {
  readCamera(camera, target, s.from)
  s.tween = 0
  s.tweenDur = seconds
  s.tweenTo = to
  s.tweening = true
  s.exBase = 0
}

/** Explore zoom limits: multiples of the fitted distance of the explore pose. */
function setLimits(c: OrbitControlsImpl, dist: number, zoom: readonly [number, number]): void {
  cameraBus.baseDist = dist
  c.minDistance = dist * zoom[0]
  c.maxDistance = dist * zoom[1]
}
