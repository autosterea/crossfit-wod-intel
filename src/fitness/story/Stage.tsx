import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import './threeConsole'
import type { StoryDef } from './types'
import type { FitnessView } from '../lessonTypes'
import { TIERS } from './quality/tiers'
import { useStoryStore } from './store'
import { clock, emitFrame } from './clock'
import { tick, pb } from './playback'
import { CameraDirector } from './camera/CameraDirector'
import { computeFocus, focusRect, setFocusRecompute, type ShellLayout } from './camera/focusRect'
import { LabelLayer, LabelPlacer } from './labels/LabelLayer'
import { HotspotLayer, HotspotPlacer } from './hotspots'
import { Quality } from './quality/Quality'
import { Post } from './quality/Post'
import { StatsProbe } from './quality/stats'
import { installCustomToneMapping } from './quality/neutral'
import { Backdrop } from './kit/Backdrop'
import { engineUniforms } from './kit/materials'
import { useChapterFog } from './kit/fog'
import { gestureBus, useStageGestures, useStoryKeys } from './gestures'
import { readyDom, readyState, readyTick, setPending } from './ready'
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

/**
 * Compiles every material in the scene once the chapter's Scene has mounted,
 * INCLUDING hidden ones (three's compile traverses invisible objects). This is
 * the prewarm: a chapter that mounts its late beats and its explore layer at
 * load (hidden) never links a shader mid-story (README "Prewarm"). On composer
 * tiers the scene renders into a half-float target, so the compile runs with a
 * render target bound to produce that program variant, not the screen one.
 */
function ReadyProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const compiling = useRef('')
  const rt = useMemo(() => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false }), [])
  useEffect(() => () => rt.dispose(), [rt])
  useFrame(() => {
    const st = useStoryStore.getState()
    const key = st.def?.key ?? ''
    if (key && readyState.sceneKey === key && readyState.compiledKey !== key && compiling.current !== key) {
      compiling.current = key
      const prev = gl.getRenderTarget()
      if (TIERS[st.tier].composer) gl.setRenderTarget(rt)
      let p: Promise<unknown>
      try {
        p = gl.compileAsync(scene, camera)
      } catch {
        p = Promise.resolve()
      }
      gl.setRenderTarget(prev)
      p.catch(() => undefined).then(() => {
        if (compiling.current === key) readyState.compiledKey = key
        compiling.current = ''
      })
    }
    readyTick()
  }, -60)
  return null
}

function SceneReady({ view }: { view: FitnessView }) {
  useEffect(() => {
    readyState.sceneKey = view
    return () => {
      if (readyState.sceneKey === view) readyState.sceneKey = ''
      if (readyState.compiledKey === view) readyState.compiledKey = ''
    }
  }, [view])
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
      <HotspotPlacer />
      <UiPump />
      <Quality />
      <Env />
      <Backdrop />
      {def.fog && <ChapterFog fog={def.fog} />}
      <SceneBoundary key={def.key}>
        <Suspense fallback={null}>
          <Scene />
          <SceneReady view={def.key} />
        </Suspense>
      </SceneBoundary>
      <Post />
      <ReadyProbe />
    </>
  )
}

/* ----------------------------- DOM side ------------------------------ */

let webgl2: boolean | null = null
/** WebGL2 support, probed once per page; the probe context is released at once. */
export function hasWebGL2(): boolean {
  if (webgl2 !== null) return webgl2
  try {
    const c = document.createElement('canvas')
    const g = c.getContext('webgl2')
    webgl2 = !!g
    g?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webgl2 = false
  }
  return webgl2
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

export function StoryStage({ def, view }: { def: StoryDef; view: FitnessView }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const mode = useStoryStore((s) => s.mode)
  const dpr = useStoryStore((s) => s.dpr)
  const dprScale = useStoryStore((s) => s.dprScale)
  const visible = useStoryStore((s) => s.visible)
  const webgl = useStoryStore((s) => s.webgl)
  const still = useStoryStore((s) => s.still)
  const phase = useStoryStore((s) => s.phase)
  const index = useStoryStore((s) => s.index)
  const [shell, setShell] = useState<ShellLayout>(focusRect.shell)
  /** the route already moved to another chapter whose story is still loading */
  const pending = view !== def.key
  const alive = useRef(true)
  const ctxCleanup = useRef<(() => void) | null>(null)

  // WebGL availability: re-derived on every mount from the cached probe, so a
  // context lost in an earlier visit never disables the 3D for the session.
  useLayoutEffect(() => {
    alive.current = true
    useStoryStore.setState({ webgl: hasWebGL2() })
    installCustomToneMapping()
    readyDom.stage = stageRef.current
    return () => {
      alive.current = false
      ctxCleanup.current?.()
      ctxCleanup.current = null
      if (readyDom.stage === stageRef.current) readyDom.stage = null
    }
  }, [])

  // While the next chapter loads behind the slate, the old one holds still,
  // QA reads "not settled" and the target view, and input is ignored.
  useLayoutEffect(() => {
    setPending(pending ? view : '')
    if (pending) useStoryStore.setState({ playing: false })
  }, [pending, view])
  useEffect(() => () => setPending(''), [])

  // Focus rect: stage + caption card, recomputed on any resize.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const recompute = () => {
      const card = cardRef.current
      computeFocus(stage, card)
      stage.style.setProperty('--fx', `${focusRect.x}px`)
      stage.style.setProperty('--fy', `${focusRect.y}px`)
      stage.style.setProperty('--fw', `${focusRect.w}px`)
      stage.style.setProperty('--fh', `${focusRect.h}px`)
      stage.style.setProperty('--fr', `${focusRect.W - focusRect.x - focusRect.w}px`)
      setShell(focusRect.shell)
      if (useStoryStore.getState().layout !== focusRect.layout) useStoryStore.setState({ layout: focusRect.layout })
    }
    setFocusRecompute(recompute)
    recompute()
    // the card observes itself (useObservedCard): its element changes with the mode and chapter
    const ro = new ResizeObserver(recompute)
    ro.observe(stage)
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
      data-story-ready="0"
      data-view={view}
      data-pending={pending ? '1' : undefined}
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
            // Context loss is fatal only for THIS mounted canvas, and only when
            // it is not restored within 2.5 s. R3F force-loses the context of a
            // canvas it unmounts; that event is ignored (listener removed,
            // alive / isConnected checks).
            const el = gl.domElement
            let timer = 0
            const onLost = (e: Event) => {
              if (!alive.current || !el.isConnected) return
              e.preventDefault()
              window.clearTimeout(timer)
              timer = window.setTimeout(() => {
                if (alive.current && el.isConnected && gl.getContext().isContextLost()) useStoryStore.setState({ webgl: false })
              }, 2500)
            }
            const onRestored = () => window.clearTimeout(timer)
            el.addEventListener('webglcontextlost', onLost)
            el.addEventListener('webglcontextrestored', onRestored)
            ctxCleanup.current?.()
            ctxCleanup.current = () => {
              window.clearTimeout(timer)
              el.removeEventListener('webglcontextlost', onLost)
              el.removeEventListener('webglcontextrestored', onRestored)
            }
          }}
        >
          <Engine def={def} />
        </Canvas>
      )}
      <div className="st-vignette" aria-hidden="true" />
      {shell === 'desktop' && <div className="st-scrim" aria-hidden="true" />}
      <LabelLayer />
      <HotspotLayer />
      <HudSlot stageRef={stageRef} />
      {mode === 'story' ? <CaptionCard cardRef={cardRef} shell={shell} /> : <ExplorePanel cardRef={cardRef} shell={shell} />}
      {shell === 'desktop' && mode === 'story' && <div className="st-keyhint">Left / Right to step - Space to play - E to explore</div>}
      <TapFlash />
      <Slate view={view} pending={pending} />
    </div>
  )
}
