import { useMemo } from 'react'
import type { FitnessView, ModuleKey } from '../../lessonTypes'
import type { CamPose, LabelSpec, StoryDef } from '../../story/types'
import { MODULE_COPY, moduleByKey } from '../../fitnessData'
import { at, focus } from '../../story/cue'
import { ease } from '../../story/ease'
import { Pen, PEN } from '../../story/kit/Pen'
import { decagon } from '../../story/kit/shapes'
import { useLabels } from '../../story/labels/useLabel'

/* =========================================================================
   QA stub story (`?qa=stub` only; see stories/index.ts). Three beats that
   restate the chapter's own key points, a pen-drawn decagon and one label.
   It exists so the engine's chapter-change contract can be tested with two
   story chapters: the same canvas element, no new WebGL context, no slate
   flash. Never reachable from the UI.
   ========================================================================= */

const POSE: CamPose = { target: [0, 0, 0], az: 0, el: 0, fov: 24, fit: [[-4.2, -4.2, 0], [4.2, 4.2, 0]], padPx: 24 }

function StubScene({ accent }: { accent: string }) {
  const ring = useMemo(() => decagon(4), [])
  const labels = useMemo<LabelSpec[]>(
    () => [{ id: 'qa-stub', text: 'QA stub', tone: 'name', color: accent, anchor: [0, 4, 0], prefer: 'N', cue: (T) => at(T, 0, 0.5, 0.7) }],
    [accent],
  )
  useLabels(labels)
  return (
    <>
      <Pen points={ring} color={accent} width={PEN.data} head hot progress={(T) => at(T, 0, 0.05, 0.8, ease.draw)} opacity={(T) => focus(T, 0)} />
      <Pen points={ring} color="#eef3f6" width={PEN.axis} progress={(T) => at(T, 1, 0.05, 0.8, ease.draw)} opacity={(T) => 0.5 * focus(T, 1)} />
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
    cam: { L: POSE },
  })
  return {
    key: view,
    beats: [beat(0), beat(1), beat(2)],
    Scene,
    Explore: StubExplore,
    explore: { cam: { L: POSE }, limits: { az: [-40, 40], el: [0, 30], zoom: [0.6, 1.6] }, initFromBeat: () => {} },
  }
}
