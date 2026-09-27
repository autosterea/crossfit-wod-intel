import { Component, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import type { StoryDef } from './types'
import { useStoryStore } from './store'
import { clock, emitFrame } from './clock'
import { tick, pb } from './playback'
import { CameraDirector } from './camera/CameraDirector'
import { computeFocus, focus, setFocusRecompute, type ShellLayout } from './camera/focusRect'
import { LabelLayer, LabelPlacer } from './labels/LabelLayer'
import { Quality } from './quality/Quality'
import { Post } from './quality/Post'
import { StatsProbe } from './quality/stats'
import { installCustomToneMapping } from './quality/neutral'
import { Backdrop } from './kit/Backdrop'
import { engineUniforms } from './kit/materials'
import { useChapterFog } from './kit/fog'
import { gestureBus, useStageGestures, useStoryKeys } from './gestures'
import { readyState, readyTick } from './ready'
import { CaptionCard } from './ui/CaptionCard'
import { ExplorePanel } from './ui/ExplorePanel'
import { HudSlot } from './ui/Hud'
import { Slate } from './ui/Slate'
import { markDone } from './ui/progress'
import { IconPause, IconPlay } from './ui/icons'

/* =========================================================================
   The persistent StoryStage (DESIGN.md C.1, B.2): one Canvas, lights,
   procedural environment, backdrop, post pipeline, camera director, label
   layer, HUD slot, caption card / explore panel, slate and fallback. Full
   bleed and always dark. Chapters only supply a StoryDef.
   ========================================================================= */

/* ---------------------------- canvas side ---------------------------- */

export const engineBus = { invalidate: () => {} }

function ClockDriver() {
  useFrame((_, dt) => {
    if (useStoryStore.getState().still) return
    tick(dt)
  }, -100)
  return null
}

function UiPump() {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  useFrame((_, dt) => {
    engineUniforms.uResolution.value.set(size.width, size.height)
    engineUniforms.uDpr.value = gl.getPixelRatio()
    if (!useStoryStore.getState().still) emitFrame(dt)
  }, -70)
  return null
}

function ReadyProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const compiling = useRef(false)
  useFrame(() => {
    if (readyState.scene && !readyState.compiled && !compiling.current) {
      compiling.current = true
      gl.compileAsync(scene, camera)
        .catch(() => undefined)
        .then(() => {
          readyState.compiled = true
          compiling.current = false
        })
    }
    if (!readyState.scene) compiling.current = false
    readyTick()
  }, -60)
  return null
}

function SceneReady() {
  useEffect(() => {
    readyState.scene = true
    return () => {
      readyState.scene = false
      readyState.compiled = false
    }
  }, [])
  return null
}

function ChapterFog({ fog }: { fog: NonNullable<StoryDef['fog']> }) {
  useChapterFog(fog.color, fog.density)
  return null
}

function Env() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.environmentIntensity = 0.9
  }, [scene])
  return (
    <>
      <Environment resolution={128} frames={1} background={false}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" scale={[10, 4, 1]} position={[0, 6, -4]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#91c640" scale={[6, 0.4, 1]} position={[-6, 1, 3]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color="#38bdf8" scale={[6, 0.4, 1]} position={[6, 2, -3]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.6} color="#eef3f6" scale={3} position={[0, -4, 2]} target={[0, 0, 0]} />
      </Environment>
      <directionalLight color="#ffffff" intensity={0.8} position={[4, 8, 6]} />
      <hemisphereLight args={['#dfe8e3', '#0b120e', 0.35]} />
    </>
  )
}

class SceneBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.warn('[story] scene error', error.message)
  }
  render() {
    return this.state.error ? null : this.props.children
  }
}

function Engine({ def }: { def: StoryDef }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    gestureBus.camera = camera
    engineBus.invalidate = invalidate
    return () => {
      if (gestureBus.camera === camera) gestureBus.camera = null
    }
  }, [camera, invalidate])
  const Scene = def.Scene
  return (
    <>
      <StatsProbe />
      <ClockDriver />
      <CameraDirector />
      <LabelPlacer />
      <UiPump />
      <Quality />
      <Env />
      <Backdrop />
      {def.fog && <ChapterFog fog={def.fog} />}
      <SceneBoundary key={def.key}>
        <Suspense fallback={null}>
          <Scene />
          <SceneReady />
        </Suspense>
      </SceneBoundary>
      <Post />
      <ReadyProbe />
    </>
  )
}

/* ----------------------------- DOM side ------------------------------ */

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

/** Plain rAF clock when there is no canvas loop (no WebGL, still mode). */
function useFallbackClock(active: boolean, still: boolean): void {
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = -1
    let ver = -1
    const loop = (now: number) => {
      const dt = last < 0 ? 0 : (now - last) / 1000
      last = now
      tick(dt)
      emitFrame(dt)
      if (still) {
        if (clock.version !== ver) {
          ver = clock.version
          engineBus.invalidate()
        }
      } else readyTick()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, still])
}

function TapFlash() {
  const ref = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(true)
  useEffect(() => {
    gestureBus.flash = (p: boolean) => {
      setPlaying(p)
      const el = ref.current
      if (!el) return
      el.classList.remove('is-on')
      void el.offsetWidth
      el.classList.add('is-on')
    }
    return () => {
      gestureBus.flash = () => {}
    }
  }, [])
  return (
    <div ref={ref} className="st-flash" aria-hidden="true">
      {playing ? <IconPlay /> : <IconPause />}
    </div>
  )
}

export function StoryStage({ def }: { def: StoryDef }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const mode = useStoryStore((s) => s.mode)
  const dpr = useStoryStore((s) => s.dpr)
  const dprScale = useStoryStore((s) => s.dprScale)
  const visible = useStoryStore((s) => s.visible)
  const webgl = useStoryStore((s) => s.webgl)
  const still = useStoryStore((s) => s.still)
  const ready = useStoryStore((s) => s.ready)
  const phase = useStoryStore((s) => s.phase)
  const index = useStoryStore((s) => s.index)
  const [shell, setShell] = useState<ShellLayout>(focus.shell)

  // WebGL availability (once).
  useLayoutEffect(() => {
    if (!hasWebGL2()) useStoryStore.setState({ webgl: false })
    installCustomToneMapping()
  }, [])

  // Focus rect: stage + caption card, recomputed on any resize.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const recompute = () => {
      const card = cardRef.current
      computeFocus(stage, card)
      stage.style.setProperty('--fx', `${focus.x}px`)
      stage.style.setProperty('--fy', `${focus.y}px`)
      stage.style.setProperty('--fw', `${focus.w}px`)
      stage.style.setProperty('--fh', `${focus.h}px`)
      stage.style.setProperty('--fr', `${focus.W - focus.x - focus.w}px`)
      setShell(focus.shell)
      if (useStoryStore.getState().layout !== focus.layout) useStoryStore.setState({ layout: focus.layout })
    }
    setFocusRecompute(recompute)
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(stage)
    if (cardRef.current) ro.observe(cardRef.current)
    window.addEventListener('orientationchange', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', recompute)
    }
  }, [mode, shell])

  // Off-screen: pause and stop rendering (battery).
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        const vis = e.intersectionRatio >= 0.1
        pb.visible = vis
        if (useStoryStore.getState().visible !== vis) useStoryStore.setState({ visible: vis })
      },
      { threshold: [0, 0.1, 0.2] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Completion (per-viewer convenience).
  useEffect(() => {
    if (def && phase === 'done' && index >= def.beats.length - 1) markDone(def.key)
  }, [phase, index, def])

  useStageGestures(stageRef)
  useStoryKeys()
  useFallbackClock(!webgl || still, still)

  return (
    <div
      ref={stageRef}
      className={`st-stage st-shell--${shell}${mode === 'explore' ? ' is-explore' : ''}`}
      data-story-ready={ready ? '1' : '0'}
      data-view={def.key}
    >
      {webgl && (
        <Canvas
          className="st-canvas"
          dpr={Math.max(1, dpr * dprScale)}
          frameloop={!visible ? 'never' : still ? 'demand' : 'always'}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }}
          camera={{ fov: 30, near: 0.1, far: 500, position: [0, 0, 30] }}
          onCreated={({ gl }) => {
            gl.setClearColor('#070a0e', 1)
            gl.toneMapping = THREE.CustomToneMapping
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              window.setTimeout(() => {
                if (gl.getContext().isContextLost()) useStoryStore.setState({ webgl: false })
              }, 2500)
            })
          }}
        >
          <Engine def={def} />
        </Canvas>
      )}
      <div className="st-vignette" aria-hidden="true" />
      {shell === 'desktop' && <div className="st-scrim" aria-hidden="true" />}
      <LabelLayer />
      <HudSlot stageRef={stageRef} />
      {mode === 'story' ? <CaptionCard cardRef={cardRef} shell={shell} /> : <ExplorePanel cardRef={cardRef} shell={shell} />}
      {shell === 'desktop' && mode === 'story' && <div className="st-keyhint">Left / Right to step - Space to play - E to explore</div>}
      <TapFlash />
      <Slate view={def.key} />
    </div>
  )
}
