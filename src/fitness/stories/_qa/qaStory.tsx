import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { FitnessView, ModuleKey } from '../../lessonTypes'
import type { CamPose, LabelSpec, StoryDef } from '../../story/types'
import { MODULE_COPY, PAL, moduleByKey, spectrum } from '../../fitnessData'
import { at, focus } from '../../story/cue'
import { ease } from '../../story/ease'
import { Pen, PEN } from '../../story/kit/Pen'
import { decagon } from '../../story/kit/shapes'
import { useLabels } from '../../story/labels/useLabel'
import { computeChartFrame } from '../../story/kit/chartFrame'
import { FLOW_COUNT, LightField, sampleCurve } from '../../story/kit/LightField'
import { Instances } from '../../story/kit/Instances'
import { BlobShadow } from '../../story/kit/BlobShadow'
import { ballOpts, makeRimStandard, makeSurfaceMaterial } from '../../story/kit/materials'
import { useStoryStore } from '../../story/store'
import { useSafeFrame } from '../../story/useSafeFrame'

/* =========================================================================
   QA stub story (`?qa=stub` only; see stories/index.ts). Three beats that
   restate the chapter's own key points. It exists so the engine's
   chapter-change contract can be tested with two story chapters (the same
   canvas element, no new WebGL context, no slate flash), and it is the
   KIT PROOF (DESIGN.md H.43): every engine-owned material and component a
   chapter builder will need renders here before a chapter depends on it.
     beat 0  a pen-drawn decagon (Pen, head, labels)
     beat 1  the LightField FLOW river (three bands, drifting on the A clock)
     beat 2  a Health-style surface (isolines, the sick hatch below the
             independence height) and three balls with blob shadows
   Never reachable from the UI.
   ========================================================================= */

const POSE: CamPose = { target: [0, 0, 0], az: 0, el: 0, fov: 24, fit: [[-4.2, -4.2, 0], [4.2, 4.2, 0]], padPx: 24 }
const SOLIDS: CamPose = { target: [0, 0.4, 0], az: -28, el: 26, fov: 26, fit: [[-4.2, -1.2, -2.6], [4.2, 2.4, 2.6]], padPx: 20 }

/** the river's frame: fixed (the stub has no StoryDef.frame) */
const RIVER = computeChartFrame({ FH: 3.2, minAspect: 2.6, maxAspect: 2.6, marginPx: { l: 0, r: 0, t: 0, b: 0 } }, 1, 1)
const bandA = sampleCurve((u) => 0.24 + 0.1 * u)
const bandB = sampleCurve((u) => 0.34 * Math.exp(-2.2 * u) + 0.04)
const bandC = sampleCurve((u) => 0.4 * Math.exp(-6 * u) + 0.01)
const show = (n: number) => (T: number) => at(T, n, 0.05, 0.3) * (1 - at(T, n + 1, 0, 0.15))

function Solids() {
  const surf = useMemo(() => {
    const g = new THREE.PlaneGeometry(4.4, 3.6, 36, 28)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    const col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const cap = 0.25 + 0.5 * Math.exp(-((x + 0.6) ** 2) / 2.5) * (0.6 + 0.4 * Math.cos(z * 0.9))
      p.setY(i, cap * 2)
      const [r, gg, b] = spectrum(Math.min(1, cap / 0.9))
      col.set([r, gg, b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    g.translate(-1.8, -1, 0)
    return g
  }, [])
  const surfMat = useMemo(() => makeSurfaceMaterial({ yScale: 2, y0: -1, independence: -0.2 }), [])
  const ballGeo = useMemo(() => new THREE.SphereGeometry(0.36, 32, 20), [])
  const ballMat = useMemo(() => makeRimStandard(ballOpts(PAL.gymnastics)), [])
  useEffect(
    () => () => {
      surf.dispose()
      surfMat.dispose()
      ballGeo.dispose()
      ballMat.dispose()
    },
    [surf, surfMat, ballGeo, ballMat],
  )
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(surf, surfMat)
    m.renderOrder = 20
    return m
  }, [surf, surfMat])
  const vis = show(2)
  // ambient bob on the A clock (L5): it runs in autoplay and freezes as
  // A = T x 2.5 whenever the story is held, so deep links stay exact
  const amb = useRef(0)
  useSafeFrame('qa stub surface', (T, A) => {
    mesh.visible = vis(T) > 0.01
    amb.current = A
  }, { priority: -1 })
  const lift = (i: number) => 0.9 + 0.35 * Math.sin(amb.current * 1.6 + i * 2.1)
  return (
    <>
      <primitive object={mesh} />
      <Instances
        geometry={ballGeo}
        material={ballMat}
        count={3}
        place={(T, i, pos) => {
          if (vis(T) < 0.01) return false
          pos.set(1.4 + i * 1.1, -1 + lift(i), (i - 1) * 0.9)
        }}
      />
      <BlobShadow
        count={3}
        radius={0.55}
        place={(T, i, out) => {
          out[0] = 1.4 + i * 1.1
          out[1] = -0.99
          out[2] = (i - 1) * 0.9
          const h = lift(i)
          out[3] = 0.8 + 0.4 * h
          return vis(T) * (1.25 - 0.5 * h)
        }}
      />
    </>
  )
}

function StubScene({ accent }: { accent: string }) {
  const ring = useMemo(() => decagon(4), [])
  const tier = useStoryStore((s) => s.tier)
  const labels = useMemo<LabelSpec[]>(
    () => [{ id: 'qa-stub', text: 'QA stub', tone: 'name', color: accent, anchor: [0, 4, 0], prefer: 'N', cue: (T) => at(T, 0, 0.5, 0.7) * (1 - at(T, 1, 0, 0.1)) }],
    [accent],
  )
  useLabels(labels)
  const riverVis = show(1)
  return (
    <>
      <Pen points={ring} color={accent} width={PEN.data} head hot progress={(T) => at(T, 0, 0.05, 0.8, ease.draw)} opacity={(T) => focus(T, 0) * (1 - at(T, 1, 0, 0.15))} />
      {FLOW_COUNT[tier] > 0 && (
        <LightField
          frame={RIVER}
          count={FLOW_COUNT[tier]}
          curveA={bandA}
          curveB={bandB}
          curveC={bandC}
          hMax={0.45}
          sizePx={2.2}
          uniforms={(T, A) => ({
            mode: 2,
            level: 0,
            mix: 0,
            hot: 0.15,
            opacity: riverVis(T),
            flow: 0.035 * A,
            bandOn: [at(T, 1, 0.1, 0.3), at(T, 1, 0.3, 0.5), at(T, 1, 0.5, 0.7)],
            // the stack separates into lanes at the end of the beat
            stack: 1 - at(T, 1, 0.75, 0.95, ease.morph),
            lane: [0, 0.34 * at(T, 1, 0.75, 0.95, ease.morph), 0.68 * at(T, 1, 0.75, 0.95, ease.morph)],
            thick: 1,
          })}
        />
      )}
      <Solids />
    </>
  )
}

function StubExplore() {
  return <p className="st-ex-note">QA stub</p>
}

export function stubStory(view: FitnessView): StoryDef {
  const m = moduleByKey(view as ModuleKey)
  const kp = MODULE_COPY[view as ModuleKey].keyPoints
  const Scene = () => <StubScene accent={m.accent} />
  const beat = (i: number) => ({
    id: `qa-${i}`,
    title: m.label.slice(0, 30),
    body: (kp[i % kp.length] ?? m.blurb).slice(0, 140),
    source: `MODULE_COPY.${view}.keyPoints[${i}]`,
    build: 2.5,
    cam: { L: i === 2 ? SOLIDS : POSE },
  })
  return {
    key: view,
    beats: [beat(0), beat(1), beat(2)],
    Scene,
    Explore: StubExplore,
    explore: { cam: { L: POSE }, limits: { az: [-40, 40], el: [0, 30], zoom: [0.6, 1.6] }, initFromBeat: () => {} },
  }
}
