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
  target: [number, number, number]
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
 * The interactive hero for every lesson module: a dark, full-bleed 3D stage
 * with a floating info panel (top-left) and an optional controls panel
 * (bottom-right on desktop, a bottom sheet on mobile). The R3F scene is passed
 * as `children`; modules may add their own <Environment>, <ContactShadows>,
 * fog, etc. inside it.
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
  const [infoOpen, setInfoOpen] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(true)

  // Collapse the panels by default on first load on small screens.
  useEffect(() => {
    if (isMobile) {
      setInfoOpen(false)
      setSheetOpen(false)
    }
  }, [isMobile])

  return (
    <div className={`wf-stage ${className}`}>
      <Canvas
        dpr={[1, isMobile ? 1.75 : 2]}
        camera={{ position: camera.position, fov: camera.fov ?? 50 }}
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
          maxDistance={maxDistance}
          maxPolarAngle={maxPolarAngle}
        />
        {children}
      </Canvas>

      {/* Info panel */}
      <div className={`wf-glass wf-info ${infoOpen ? '' : 'collapsed'}`}>
        <button
          className="wf-info-toggle"
          aria-label="Show or hide explanation"
          onClick={() => setInfoOpen((v) => !v)}
        >
          <span className="chev">&#9662;</span>
        </button>
        <div className="wf-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>

      {/* Controls panel */}
      {controls && (
        <div className={`wf-glass wf-controls-wrap ${sheetOpen ? '' : 'collapsed'}`}>
          <button
            className="wf-sheet-handle"
            aria-label="Show or hide controls"
            onClick={() => setSheetOpen((v) => !v)}
          >
            <span className="grab" />
          </button>
          <div className="wf-controls">{controls}</div>
        </div>
      )}

      <div className="wf-hint">{hint}</div>
    </div>
  )
}
