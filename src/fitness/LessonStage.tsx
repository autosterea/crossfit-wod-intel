import { useState, useRef, useEffect, type ElementRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { LessonStageProps } from './lessonTypes'

/** Small media-query hook so the stage knows when to collapse its panels. */
function useIsMobile(query = '(max-width: 760px)') {
  const [m, setM] = useState(() => {
    try {
      return window.matchMedia(query).matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

type Vec3 = [number, number, number]

/** Move a camera position toward/away from its target by factor k (k>1 = out). */
function scaleAroundTarget(pos: Vec3, target: Vec3, k: number): Vec3 {
  return [
    target[0] + (pos[0] - target[0]) * k,
    target[1] + (pos[1] - target[1]) * k,
    target[2] + (pos[2] - target[2]) * k,
  ]
}

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.6h.01" />
  </svg>
)
const SlidersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M4 7h9M18 7h2M4 12h2M11 12h9M4 17h13M20 17h0" />
    <circle cx="15" cy="7" r="2.1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="12" r="2.1" fill="currentColor" stroke="none" />
    <circle cx="18" cy="17" r="2.1" fill="currentColor" stroke="none" />
  </svg>
)

/**
 * Camera rig: drei OrbitControls plus an auto-rotate that pauses for 3 seconds
 * whenever the user interacts, then resumes. Lives inside <Canvas>.
 */
function StageRig({
  target,
  autoRotate,
  autoRotateSpeed,
  minDistance,
  maxDistance,
  maxPolarAngle,
}: {
  target: Vec3
  autoRotate: boolean
  autoRotateSpeed: number
  minDistance: number
  maxDistance: number
  maxPolarAngle: number
}) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)
  const lastInteract = useRef(-10)
  const { clock } = useThree()

  useFrame(() => {
    if (!controls.current) return
    const idle = clock.getElapsedTime() - lastInteract.current > 3
    controls.current.autoRotate = autoRotate && idle
  })

  const stamp = () => {
    lastInteract.current = clock.getElapsedTime()
  }

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={maxPolarAngle}
      target={target}
      onStart={stamp}
      onEnd={stamp}
      enableDamping
      dampingFactor={0.08}
    />
  )
}

/**
 * The interactive hero for every lesson module: a dark, full-bleed 3D stage.
 * Both overlay panels collapse to small launcher pills so the 3D is the star:
 *  - the explanation panel is collapsed by DEFAULT (its full text also renders
 *    below the stage in ModulePage), so the model is unobstructed on load.
 *  - the controls panel is open on desktop, collapsed on phones (tap to reveal
 *    a bottom sheet). On mobile the camera also pulls back so wide models fit a
 *    portrait screen. The R3F scene is passed as `children`.
 */
export default function LessonStage({
  children,
  eyebrow,
  title,
  body,
  controls,
  camera = { position: [0, 6, 26], fov: 50 },
  target = [0, 1, 0],
  autoRotate = false,
  autoRotateSpeed = 0.4,
  minDistance = 8,
  maxDistance = 70,
  maxPolarAngle = Math.PI / 2.04,
  hint = 'Drag to orbit, scroll or pinch to zoom',
  className = '',
}: LessonStageProps) {
  const isMobile = useIsMobile()
  // Explanation starts collapsed (the same copy is shown below the stage).
  const [infoOpen, setInfoOpen] = useState(false)
  // Controls start open on desktop, collapsed on phones.
  const [controlsOpen, setControlsOpen] = useState(!isMobile)

  useEffect(() => {
    setControlsOpen(!isMobile)
  }, [isMobile])

  // On phones, pull the camera back so wide models fit the portrait width, and
  // allow a bit more zoom-out range.
  const camPos = isMobile ? scaleAroundTarget(camera.position, target, 1.28) : camera.position
  const maxDist = isMobile ? maxDistance * 1.4 : maxDistance

  return (
    <div className={`wf-stage ${className}`}>
      <Canvas
        dpr={[1, isMobile ? 1.75 : 2]}
        camera={{ position: camPos, fov: camera.fov ?? 50 }}
        gl={{ antialias: true }}
        shadows
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[8, 16, 10]} intensity={1.05} castShadow />
        <directionalLight position={[-10, 6, -8]} intensity={0.4} color="#86c1ff" />
        <directionalLight position={[0, 4, -14]} intensity={0.5} color="#b6e36a" />
        <StageRig
          target={target}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          minDistance={minDistance}
          maxDistance={maxDist}
          maxPolarAngle={maxPolarAngle}
        />
        {children}
      </Canvas>

      {/* Explanation: launcher pill (default) <-> glass card */}
      {infoOpen ? (
        <div className="wf-glass wf-info">
          <button className="wf-panel-close" aria-label="Hide explanation" onClick={() => setInfoOpen(false)}>
            &#10005;
          </button>
          <div className="wf-eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
      ) : (
        <button className="wf-launch wf-launch-info" onClick={() => setInfoOpen(true)} aria-label="Show explanation">
          <span className="wf-launch-ic">
            <InfoIcon />
          </span>
          About
        </button>
      )}

      {/* Controls: launcher pill <-> glass card / bottom sheet */}
      {controls &&
        (controlsOpen ? (
          <div className="wf-glass wf-controls-wrap">
            <div className="wf-controls-head-bar">
              <span>Controls</span>
              <button className="wf-panel-close-inline" aria-label="Hide controls" onClick={() => setControlsOpen(false)}>
                &#10005;
              </button>
            </div>
            <div className="wf-controls">{controls}</div>
          </div>
        ) : (
          <button
            className="wf-launch wf-launch-controls"
            onClick={() => setControlsOpen(true)}
            aria-label="Show controls"
          >
            <span className="wf-launch-ic">
              <SlidersIcon />
            </span>
            Controls
          </button>
        ))}

      <div className="wf-hint">{hint}</div>
    </div>
  )
}
