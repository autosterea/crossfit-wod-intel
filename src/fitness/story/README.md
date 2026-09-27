# Story engine: module author's guide

This folder is the engine behind every chapter of the "What Is Fitness?" lesson
(`/fitness`). The binding spec is `../DESIGN.md` (CHALKLINE). This guide is the
practical version: how to build a chapter on the engine, the rules, and the
checklist to run before you commit. The Definition chapter
(`../stories/definition/`) is the reference implementation: copy its patterns.

## What the engine gives you for free

- One persistent full-bleed stage: Canvas, lights, a procedural environment
  (drei `<Environment>` + `<Lightformer>`, no CDN), the slate backdrop, and the
  post pipeline (bloom, neutral tone mapping, SMAA or MSAA, grain on HIGH).
- Quality tiers (HIGH / MEDIUM / LOW) driven by drei `PerformanceMonitor`; the
  engine owns DPR. `?tier=` pins a tier.
- A story clock, autoplay (build, hold, advance), transport, beat segments with
  scrubbing, swipe / tap / press-and-hold, keyboard (Left / Right / Space /
  Home / End / E / Esc), reduced motion, deep links (`?beat=N&t=X`,
  `?explore=1`), and `window.__story` for QA.
- A camera director that fits each beat's subject inside the focus rect (the
  part of the stage not under the caption card), with portrait and landscape
  poses and eased transitions.
- A screen-space label system (DOM, fixed type scale, collision-aware, clamped
  inside the focus rect).
- The caption card (phone detents, desktop column), the explore panel shell,
  the HUD chip slot, the chapter sheet, the Notes (with a tappable story
  transcript) and the loading slate.

You write: a `StoryDef` (beats and copy), a `Scene` (3D, inside the Canvas), an
`Explore` panel (DOM) and optionally a `Hud`.

## The one rule: the scene is a pure function of T

`T = beatIndex + t`, with `t` running 0 to 1 while a beat builds. Every visible
property of your scene is computed from `T` inside `useFrame` and written to
refs, materials or uniforms. No history, no physics, no springs, no
`Math.random`, no `performance.now`, no React state per frame. That is what makes
`?beat=3&t=0.5` render the exact same frame every time, lets the scrubber run the
story backwards, and makes reduced motion trivial (it just shows `t = 1`).

Continuity: the scene at `(N, t = 1)` must equal the scene at `(N + 1, t = 0)`.
You get this automatically when every property is built from `at()` / `cue()`
windows, because a window that has finished stays at 1.

## Minimal worked example

```
src/fitness/stories/example/
  story.ts     the StoryDef (beats + copy + camera)
  Scene.tsx    the 3D (reads T through the clock)
  Explore.tsx  explore controls (DOM)
```

`story.ts`

```ts
import type { CamPose, StoryDef } from '../../story/types'
import ExampleScene from './Scene'
import ExampleExplore from './Explore'

const FRONT: CamPose = {
  target: [0, 0, 0],
  az: 0, el: 4, fov: 26,
  fit: [[-5, -4, 0], [5, 4, 0]],          // must land inside the focus rect
  padPx: { l: 48, r: 24, t: 20, b: 50 },  // room for your labels
}

export default {
  key: 'skills',
  beats: [
    { id: 'axes', title: 'Ten physical skills', body: '...', source: 'MODULE_COPY.skills.body s1',
      build: 4.0, cam: { L: FRONT } },
    { id: 'curve', title: '...', body: '...', source: '...', build: 5.0,
      cam: { L: { ...FRONT, az: -20, el: 14 }, P: { ...FRONT, az: -14, el: 16 } } },
  ],
  Scene: ExampleScene,
  Explore: ExampleExplore,
  explore: {
    cam: { L: FRONT },
    limits: { az: [-45, 45], el: [0, 40], zoom: [0.6, 1.6] },
    initFromBeat: () => {},
  },
} satisfies StoryDef
```

`Scene.tsx`

```tsx
import { useMemo } from 'react'
import { at, focus } from '../../story/cue'
import { ease } from '../../story/ease'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { useLabels } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'

export default function ExampleScene() {
  const axes = useMemo(() => new Float32Array([-5, -4, 0, 5, -4, 0, -5, -4, 0, -5, 4, 0]), [])
  const curve = useMemo(() => /* xyz polyline */ new Float32Array([-5, 2, 0, 0, 0, 0, 5, -2, 0]), [])
  const labels = useMemo<LabelSpec[]>(() => [
    { id: 'x', text: 'Effort duration', tone: 'tick', anchor: [0, -4, 0], prefer: 'S', only: ['S'],
      cue: (T) => at(T, 0, 0.3, 0.45) },
  ], [])
  useLabels(labels)
  return (
    <>
      {/* beat 0: construction, drawn with the pen, dims (focus pull) in later beats */}
      <PenBatch segments={axes} width={PEN.axis} byArc
        progress={(T) => at(T, 0, 0, 0.35, ease.draw)}
        opacity={(T) => 0.55 * focus(T, 0)} />
      {/* beat 1: data, drawn by a hot pen (the speaking element blooms) */}
      <Pen points={curve} color="#91c640" width={PEN.data} head hot
        progress={(T) => at(T, 1, 0.2, 0.8, ease.draw)} />
    </>
  )
}
```

Register the chapter in `../stories/index.ts` (one line) and delete its legacy
`modules/*Module.tsx` once the story has landed.

## Reading time

- `at(T, n, a, b, ease?)`: 0..1 across beat `n`, from `t = a` to `t = b`.
- `cue(T, a, b, ease?)`: the same in global T.
- `stagger(T, a, b, i, n, spread?, ease?)`: element `i` of `n` inside a window.
- `focus(T, n)`: L3 focus pull for elements born in beat `n` (dims to 35% while a
  later beat builds, recovers by its end). Multiply it into opacity.
- `pulse(T, a, b)`: 0, 1, 0 across a window.
- `useBeat()` returns `{ clock, cue, at, focus, layout }`; `layout` ('P' or 'L')
  comes from the FOCUS RECT aspect, not the viewport, and is the only thing that
  re-renders your scene.
- Easing tokens (`story/ease.ts`): `draw` (line draw-on), `settle` (arrivals),
  `snap` (dots, bricks), `morph` (topology and camera), `count` (numbers),
  `exit`, `linear`.

## The kit (never write your own versions)

| Component / helper | Use |
|---|---|
| `<Pen points progress opacity head hot dashed update gain/>` | one stroke; draw-on by arc length, exact under seek; `update(T, pts)` mutates the polyline in place |
| `<PenBatch segments colors progress opacity byArc update/>` | many segments in ONE draw call (grids, axes, ticks, merged outlines) |
| `<MorphPen shapes weights stagger/>` | one pen blending 256-point shapes from `kit/shapes.ts` |
| `<AreaFill top baseline color mode reveal level opacity update/>` | area strips; gradient, hatch or solid; `level` pours, `reveal` sweeps |
| `<LightField frame count curveA curveB uniforms/>` | constant-density light particles (pour, spill, condense); counts come from `TIERS[tier].particleScale` |
| `<Nodes count radius color place/>` | instanced dots, one draw call |
| `<SdfText font text size color opacity/>` | drei Text with the SELF-HOSTED fonts only (`anton`, `barlowSemi`, `barlowBold`); only for large words that belong to the 3D world |
| `<Halo position sizePx color intensity/>` | additive glow point; the LOW-tier stand-in for bloom |
| `makeRimStandard(opts)`, `steelOpts` | lit solids with a fresnel rim (PBR against the procedural environment) |
| `useChartFrame(opts)` | adaptive chart frame: tall on phones, wide on desktop |
| `intervalAxis`, `logAxis` | the time axes |
| `useCounter`, `useDomCounter` | counting readouts written imperatively |
| `impactK(T)` | the chapter's single impact accent (declare `impact: [a, b]` on the beat) |
| `useChapterFog` | fog, Hopper and Health only (or set `fog` on the StoryDef) |
| `useDragHandle` | explore-mode drag handles that win over orbit |

Pen widths are screen pixels by role: `PEN.grid` 1.25, `PEN.axis` 2,
`PEN.data` 3, `PEN.hero` 4.5.

## Labels

All reading text is DOM, on the fixed type scale, never perspective-scaled.
`useLabels(specs)` with a memoised array (or `useLabel(spec)`):

- `tone`: `tick` (mono, muted), `name` (condensed caps with a data-colour dot;
  `dot: false` to hide it), `callout` (pill, data-colour border), `readout`
  (pill with mono digits; `size: 'sm'` for compact rows; reserve width with
  `minChars`), `legend` (pinned with `pin`).
- `anchor`: a world point or `(T, layout) => V3`.
- `prefer`: the side you want; `only` restricts the sides (use `['S']` for tick
  labels so they stay registered under their tick); `leader: true` allows a
  displaced label with a leader line; `short` is a fallback text.
- `priority`: higher places first (defaults: callout 90, readout 85, name 60,
  tick 30). Give the labels that must never move (ticks, axis titles) a high
  priority and `only`, and let annotations yield.
- `cue(T)`: visibility 0..1. Labels at 0 cost nothing and reserve no space.
- `setLabelText(id, text)` updates text without React (counters).
- The HUD chip is a registered obstacle; register others with `useObstacle`.

The placer tries the preferred side first, then the side used last frame
(hysteresis), then the other compass sides, a slide, three 18 px stagger tiers
with a leader, the short text, and finally hides the label. `window.__story.labels()`
reports placed rects, overlaps and clipping.

## Camera poses

Each beat has `cam: { L, P?, window?, keys? }`. A pose is
`{ target, az, el, fov, fit, padPx }`:

- `fit` is the world box that must land inside the focus rect minus `padPx`
  (a function lets adaptive frames supply it). Put label room in `padPx`.
- `target` should be the centre of `fit` (a function is allowed). The principal
  point is moved to the centre of the padded focus rect with `setViewOffset`, so
  the subject is centred in the visible part of the stage and never under the
  caption card. The fitted distance is solved in closed form.
- `P` is the portrait pose (phones). Keep comparisons front-on (L12).
- The move happens inside `window` (default the first 35% of the beat), eased
  with `morph`; `keys` add mid-beat keyframes (see the Definition D2 fan).
- Free orbit exists only in explore mode (drei OrbitControls, limits from
  `explore.limits`); the director tweens back on "Back to story".

## Explore mode

`explore.initFromBeat(i)` seeds a per-chapter zustand slice from the beat the
viewer left; the `Explore` DOM component edits that slice; the Scene renders its
explore layer from it (read `useStoryStore((s) => s.mode)`). Explore may use
damped motion (`THREE.MathUtils.damp`); determinism is only required in story
mode. Every control is at least 44 px; nothing is hover-only.
`scrubToggle` + `onScrub(nx, ny, phase)` route drags to your chapter.

## Reduced motion

Handled by the engine: no autoplay, every beat shows `t = 1`, steps cut, the
transcript is expanded, the play button becomes "Show build". Your only job is
to make `t = 1` a complete, legible frame, and to never animate on wall time
in story mode.

## Quality tiers and budgets

- `TIERS[tier]`: HIGH (DPR up to 2, MSAA 4, 7-level bloom, grain), MEDIUM (phone
  default, DPR up to 1.5, half-res 5-level bloom, SMAA), LOW (no composer,
  renderer tone mapping, halos instead of bloom, fills instead of particles).
- Scale particle counts with `particleScale`; on LOW render the `AreaFill`
  version of anything drawn with light.
- Mobile budget per frame (MEDIUM, including post): at most 120 draw calls and
  250k triangles; aim for 30 scene calls and 30k triangles. Measure with
  `window.__story.stats()` (Definition: about 20 to 30 calls, 3.5k triangles).
- Never add a `useFrame` with a positive priority (it would take over rendering
  on LOW and the stage would go black). Never add post effects in a chapter.

## Disposal

Create geometries and materials in `useMemo`, dispose them in a `useEffect`
cleanup. Kit components dispose their own. After navigating away and back,
`stats().geometries` must return to its earlier value.

## Copy

Beat titles <= 30 characters, bodies <= 140, restating copy that already exists
in `fitnessData.ts` or the module files; name it in `source`. No new facts,
numbers or quotes. Computed values (scores, totals) go in labels and the HUD,
never in caption prose. No em or en dashes anywhere.

## QA contract

- `?beat=N&t=X` renders beat N at progress X and holds; `?explore=1` opens
  explore; `?tier=high|medium|low`; `?motion=reduce|full`; `?detent=`.
- The stage root carries `data-story-ready="1"` once fonts, SDF fonts, shader
  compile and two frames after the last seek are done.
- `window.__story`: `seek(n, t)`, `play()`, `pause()`, `next()`, `prev()`,
  `explore(on)`, `state()`, `stats()`, `labels()`, `project(x, y, z)`, `ready`.

## Checklist before you commit

1. `node scripts/fitness-gate.mjs` passes (grep gate + caption audit).
2. `node C:/Users/ravik/fitness-v2/tools/dashcheck.mjs C:/Users/ravik/fitness-v2/base/src/fitness` prints no dashes.
3. `tools/build.sh` passes for the dev and the preview build.
4. Every beat at `t = 1` on 360, 390 and 430 px phones: subject fills the focus
   rect, labels readable, `__story.labels()` shows no overlaps or clipping.
5. At least one mid-beat frame (`t = 0.5`) per beat looks intentional.
6. `?explore=1` on phone and desktop; the controls are reachable with a thumb.
7. Reduced motion: nothing autoplays, each beat shows its end state.
8. `stats()` on `?tier=medium`: under 120 calls and 250k triangles.
9. `fitnessData.ts` unchanged (`git diff --stat`).
