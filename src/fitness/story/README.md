# Story engine: module author's guide

This folder is the engine behind every chapter of the "What Is Fitness?" lesson
(`/fitness`). The binding spec is `../DESIGN.md` (CHALKLINE, with the amendments
in its section H). This guide is the practical version: how to build a chapter
on the engine, the rules, and the checklist to run before you commit. The
Definition chapter (`../stories/definition/`) is the reference implementation:
copy its patterns.

## What the engine gives you for free

- One PERSISTENT full-bleed stage: Canvas, lights, a procedural environment
  (drei `<Environment>` + `<Lightformer>`, no CDN), the slate backdrop, and the
  post pipeline (bloom, neutral tone mapping, SMAA or MSAA, grain on HIGH). A
  chapter change swaps only your Scene, labels and captions; the WebGL context
  survives (H.25). While the next chunk loads, the previous chapter holds still
  under the slate.
- Quality tiers (HIGH / MEDIUM / LOW) and DPR steps. drei `PerformanceMonitor`
  only MEASURES (from 1.5 s after your chapter loads, H.18); the engine owns the
  policy (H.29): one step down the quality ladder on a real decline, never back
  up into a step it fell from in the same chapter, and up only after about 12 s
  of sustained headroom. A steady 60 fps phone is never demoted. `?tier=` pins
  a tier; `__story.qualityLog()` lists every change.
- A story clock, autoplay (build, hold, advance), transport, beat segments with
  scrubbing (also a focusable slider), swipe / tap / press-and-hold, keyboard
  (Left / Right / Space / Home / End / E / Esc), reduced motion, deep links
  (`?beat=N&t=X`, `?explore=1`), and `window.__story` for QA.
- A camera director that fits each beat's subject inside the focus rect (the
  part of the stage not under the caption card), with portrait and landscape
  poses and eased transitions.
- A screen-space label system (DOM, fixed type scale, collision-aware, clamped
  inside the focus rect, avoiding registered obstacles such as data marks).
- An engine-owned adaptive chart frame (declare `frame` on your StoryDef).
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

Need variety that looks random? Use `story/rng.ts`: `mulberry32(seed)` (a
seeded generator: call it at module load or in `useMemo`, never per frame),
`hash1(i)` and `hash2(i, j)` (stateless hashes to [0, 1), safe inside
`useFrame` because the same input always gives the same output).

Continuity: the scene at `(N, t = 1)` must equal the scene at `(N + 1, t = 0)`.
You get this automatically when every property is built from `at()` / `cue()`
windows, because a window that has finished stays at 1. `story-qa.mjs` diffs the
pixels at every boundary.

## Minimal worked example

```
src/fitness/stories/example/
  story.ts     the StoryDef (beats + copy + camera + frame)
  Scene.tsx    the 3D (reads T through the clock)
  Explore.tsx  explore controls (DOM)
```

`story.ts`

```ts
import type { CamPose, StoryDef } from '../../story/types'
import type { ChartFrameOpts } from '../../story/kit/chartFrame'
import ExampleScene from './Scene'
import ExampleExplore from './Explore'

const PAD = { l: 48, r: 24, t: 20, b: 50 }                        // room for your labels
export const FRAME: ChartFrameOpts = { FH: 10, minAspect: 0.8, maxAspect: 1.5, marginPx: PAD }

// A chart you READ is exactly front-on with a telephoto fov (L12, H.21).
const FRONT: CamPose = { target: [0, 0, 0], az: 0, el: 0, fov: 22, fit: (_layout, frame) => frame.box, padPx: PAD }
// Depth is the point: go oblique decisively (15 degrees or more), P and L separately.
const DEPTH: CamPose = { ...FRONT, az: -30, el: 18 }

export default {
  key: 'skills',
  frame: FRAME,
  beats: [
    { id: 'axes', title: 'Ten physical skills', body: '...', source: 'MODULE_COPY.skills.body s1',
      build: 4.0, cam: { L: FRONT } },
    { id: 'depth', title: '...', body: '...', source: '...', build: 5.0,
      cam: { L: DEPTH, P: { ...DEPTH, az: -32, el: 22 } } },
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
import { useChapterChart } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'

export default function ExampleScene() {
  const f = useChapterChart()                        // the same frame the camera fits
  const axes = useMemo(() => new Float32Array([f.x(0), f.y(0), 0, f.x(1), f.y(0), 0, f.x(0), f.y(0), 0, f.x(0), f.y(1), 0]), [f])
  const curve = useMemo(() => new Float32Array([f.x(0), f.y(0.8), 0, f.x(0.5), f.y(0.6), 0, f.x(1), f.y(0.4), 0]), [f])
  const labels = useMemo<LabelSpec[]>(() => [
    { id: 'ex-x', text: 'Effort duration', tone: 'tick', anchor: [f.x(0.5), f.y(0), 0], prefer: 'S', only: ['S'],
      cue: (T) => at(T, 0, 0.3, 0.45) },
    { id: 'ex-curve', text: 'Generalist', tone: 'name', color: '#91c640', required: true,
      anchor: [f.x(0.5), f.y(0.6), 0], prefer: 'NE', leader: true, cue: (T) => at(T, 1, 0.7, 0.85) },
  ], [f])
  useLabels(labels)
  // labels never cover the curve. `out` holds exactly maxPoints points
  // (default 64): size it for what you write, or the obstacle is skipped
  const marks = useMemo<WorldObstacle>(() => ({
    points: (T, out) => { if (T < 1.2) return 0; out.set(curve); return 3 },
    maxPoints: 3,
    radiusPx: 5,
  }), [curve])
  useWorldObstacle('ex-curve', marks)
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

The chapter registers itself: `stories/index.ts` discovers every `stories/<view>/story.ts` at build
time (import.meta.glob), so never edit that file. All seven views are stories;
the legacy `modules/*Module.tsx` pages and `LessonStage.tsx` were deleted at
integration (H.52).

## Reading time

- `at(T, n, a, b, ease?)`: 0..1 across beat `n`, from `t = a` to `t = b`.
- `cue(T, a, b, ease?)`: the same in global T.
- `stagger(T, a, b, i, n, spread?, ease?)`: element `i` of `n` inside a window.
- `focus(T, n)`: L3 focus pull for elements born in beat `n` (dims to 35% while a
  later beat builds, recovers by its end). Multiply it into opacity.
- `pulse(T, a, b)`: 0, 1, 0 across a window.
- `useBeat()` returns `{ clock, cue, at, focus, layout }`; `layout` ('P' or 'L')
  comes from the FOCUS RECT aspect, not the viewport, and is the only thing that
  re-renders your scene. (The focus rect object itself is `focusRect` in
  `camera/focusRect.ts`; `focus` in `cue.ts` is the focus pull.)
- Easing tokens (`story/ease.ts`): `draw` (line draw-on), `settle` (arrivals),
  `snap` (dots, bricks), `morph` (topology and camera), `count` (numbers),
  `exit`, `linear`.
- Pacing (H.30, H.40): a beat stays up for its reading time, about 250 words
  per minute. Reading the CAPTION starts at the caption swap, so the build IS
  reading time: make it move from frame 1 (the first beat starts as the slate
  fades, with no pre-roll). The scene's own words (callouts, readouts, the
  claim) land at the end of the build and are read after it: count them in
  `beat.sceneWords`. Mark the chapter's signature beat (A.3) `signature: true`
  and its finished frame holds at least 4 s:
  hold = `clamp(max(0.4 + 0.23 x captionWords - build, 0.8 + 0.23 x sceneWords, signature ? 4 : 2), 2, 7)`.
  Keep the opening beats free of both so the opening stays fast (Definition
  draws its axes with a hot pen at 0 s and starts its first curve at about 6 s).
- `useCueState(fn)`: React state derived from T that re-renders only when the
  value changes (which caption variant or DOM panel to show). Never use it for
  anything that changes every frame.

## The kit (never write your own versions)

| Component / helper | Use |
|---|---|
| `<Pen points progress opacity head hot dashed update gain dim/>` | one stroke; draw-on by arc length, exact under seek; `update(T, pts)` mutates the polyline in place. `head` rides a two-layer luminous tip (hot core plus a tinted halo) that stays at full brightness on faint strokes; `gain(T)` lifts the colour (HDR for the speaking element). A line that RESTS dimmed (a ghost, a de-emphasised curve) uses `dim(T)` (0.45 = a ghost): it mixes toward the slate at FULL alpha. Never leave a stroke at partial `opacity`: a translucent LineSegments2 shows its overlapping segment caps as beads (a dotted line). `opacity` is for fades in and out |
| `<PenBatch segments colors progress opacity byArc update head hot gain dim/>` | many segments in ONE draw call (grids, axes, ticks, bars, merged outlines). With `byArc` and `head` on one continuous path (axes as one L stroke) the pen tip travels along it. Park segments you do not want yet far away (x = 1e5), never at zero length (a zero-length segment draws a round dot). Coincident lines of two colours: draw the one behind wider (a rim), see Definition `DomainFan` |
| `<MorphPen shapes weights stagger/>` | one pen blending 256-point shapes from `kit/shapes.ts` |
| `<AreaFill top baseline bottom? color mode reveal level opacity additive rim gamma/>` | area strips; gradient, hatch or solid; `bottom` makes a band between two curves; `additive` + `rim` + `gamma` make a luminous area with an HDR rim that blooms (H.20); `level` pours, `reveal` sweeps |
| `<AreaStrips strips points colors write rim rimWidth rimAlpha rimScale/>` | several strips (one slice per series at its own depth, the seven minis of a lineup) in ONE draw call; `rimScale` gives each strip its own rim, so only the speaking strip goes HDR |
| `<Plates plates vis radius/>` | up to 16 faint glass plates (rounded rect, 1 px border) in ONE call, each faded by `vis(T, i)`: makes a group read as one unit (lineup rows, tiles) |
| `<Glows count sizePx colors place gain/>` | many additive glow points in ONE call (a dot flaring as the pen passes it, the light at a growing bar's end); `place(T, i, out)` returns the intensity |
| `<Ripple position color k sizePx/>` | one expanding ring of light where something lands (`k(T)` runs 0 to 1 over about 600 ms), hot at the start |
| `<Instances geometry material count place colors opacity/>` | any repeated SOLID (slabs, bricks, parts, tiles) in ONE call; `place(T, i, pos, quat, scale)` writes each instance; return false to hide it |
| `<LightField frame count curveA curveB curveC uniforms bandColors hMax/>` | constant-density light particles. `uniforms(T, A)` returns the mode: 0 POUR (a level rises, particles fall into their slots), 1 SPILL / CONDENSE (inside A only falls red, inside B only condenses amber), 2 FLOW (the Pathways river: three bands, curveA bottom, curveB, curveC top, as band THICKNESS in v units; each mote keeps its height inside its band and drifts along time with `flow: 0.035 * A`; `stack` 1 stacked / 0 on `lane` baselines, `thick` scales heights, `bandOn` floods each band in turn). Counts: `TIERS[tier].particleScale`; FLOW uses `FLOW_COUNT[tier]` (6000 / 3300 / 0). LOW renders the fills instead |
| `<Nodes count radius color colors place opacity/>` | data dots, ONE draw call: impostor spheres (a lit, rimmed, anti-aliased sphere drawn on a camera-facing quad), perfectly round at any DPR. They draw after the pens and sit on the line they mark |
| `makeRimStandard(ballOpts(color))` | Hopper balls (B.9 "ballMaterial"): rim and emissive in the ball's own colour. Pair with `<Instances>` |
| `<BlobShadow count radius place strength/>` | soft contact shadows under solids (balls, bricks, the prism, the orb), ONE draw call; `place(T, i, out)` writes the floor point and returns the strength (smaller as the solid lifts). No shadow maps anywhere |
| `makeSurfaceMaterial({ yScale, y0, independence, isoStep, isoAlpha, sickMix, hatchAlpha, isolinesOnly })` | the Health surface (B.9): vertex colours (`spectrum(cap / 0.9)`), world-y isolines every 0.1 of capacity, and below the independence height the colour mixed toward `PAL.sick` with a hatch. Uniforms on `material.userData.surface` (move the independence height or fade isolines from T without a recompile). `isolinesOnly` is the ghost surface |
| `<SdfText font text size color opacity/>` | drei Text with the SELF-HOSTED fonts only (`anton`, `barlowSemi`, `barlowBold`); only for large words that belong to the 3D world. Register it as a world obstacle so labels avoid it |
| `<Halo position sizePx color intensity/>` | additive glow point; the LOW-tier stand-in for bloom |
| `makeRimStandard(opts)`, `steelOpts` | lit solids with a fresnel rim (PBR against the procedural environment) |
| `useChapterChart()`, `storyFrame()` | the chapter's engine-owned adaptive chart frame (`StoryDef.frame`); poses get it as `fit(layout, frame)`. (`useStoryFrame` is the old name of the same hook; it is a chart frame, not a frame callback) |
| `frameId(frame)` | a number that changes whenever the chart frame is replaced: put it in the key of every cached writer (see "Cached writers") |
| `hudClipX(x0, x1, y, z?)` | the world x where a horizontal line must stop to clear the glass in the top-right corner (the HUD chip and the pinned legend key), so a gridline never runs under it; call it inside a pen `update` writer |
| `useChartFrame(opts)` | a second, explicit frame inside a chapter |
| `intervalAxis`, `logAxis` | the time axes |
| `useCounter(labelId, { value, format })`, `useDomCounter(ref, { value, format })` | counting readouts written imperatively; `value` is a pure function of T |
| `impactK(T)` | the chapter's single impact accent (declare `impact: [a, b]` on the beat) |
| `useChapterFog` | fog, Hopper and Health only (or set `fog` on the StoryDef) |
| `useDragHandle` | explore-mode drag handles that win over orbit; `onDrag(ray, ndc)` |
| `useStageHotspot(id, { box, onActivate, ariaLabel, modes })` | a REAL focusable button over a projected 3D box (see Hotspots) |
| `<ChipRadio label options value onChange/>` | the explore chip row as a real radiogroup (roving tab stop, arrows select). The checked chip is kept in view whenever `value` changes, from a chip or from anywhere else (a drag that turns the profile into Custom, a grid cell): only the row scrolls, only when the chip is not fully visible, and a cut chip stays visible past each fade so the row reads as scrollable (a row that opens while the web fonts load is placed once they are in). Never scroll it yourself (H.53) |
| `StoryDef.brand` (`StoryBrand`, types.ts) | a host outside the lesson (the MetFix Lab preview, H.65): its eyebrow, accent, Read more, slate, backdrop colours, end CTA and optional in-app next step (`endNext`, H.66); a branded story never navigates to another chapter, but its host may take Next past the last beat (`onNext`, H.77), drop Explore from the end row (`endExplore: false`) and make the end CTA an in-app link (`endCta.go`). Lesson chapters never set it |
| `setExploreSheetOpen(open)` (ui/ExplorePanel) | open or collapse the phone controls sheet from your Explore (Skills drops an expanded sheet to the peek when its Grid needs the stage); a no-op on desktop. Never click the engine's grab handle (H.53) |
| `kit/athlete` (`<Athlete rig look/>`, `useAthleteRig(drive)`, H.78) | a side-view athlete for chapters that need a body (Technique T4, T7, T8): a joint-space rig (bones keep length, feet planted, knees over the toes, the centre of mass solved over mid-foot), the medicine-ball clean and its pull cycle (plus the squat family), the rounded back as a 0..1 fault, a dashed ghost (`look="ghost"`, `depthBias` to overlay), `<LumbarHighlight/>` (lime kept, red rounded), `<BallSeams/>`, `<Floor/>`, landmarks as label anchors (`rig.at(T, 'lumbar')`), `tempoPhase()` for reps on story time that speed up without a jump, `athleteBox()` for the camera fit. The API is documented at the top of `kit/athlete/index.ts`; review page `/athlete-lab` (dev and /preview/ only) |

Pen widths are screen pixels by role: `PEN.grid` 1.25, `PEN.axis` 2,
`PEN.data` 3, `PEN.hero` 4.5.

**Who changes the kit (the parallel phase).** Six chapter builders share
`story/kit`, `story/labels`, `story/camera` and the engine. During the
parallel phase: (1) never write a private copy of a kit material or
component; (2) kit and engine changes are APPEND-ONLY (a new prop with a
default that keeps today's behaviour, a new export, a new mode), never a
change of an existing default or signature; (3) every such change gets a
dated H amendment in `../DESIGN.md` and a row in this table, in the same
commit; (4) anything that is not append-only goes to the foundation lead,
who owns the kit. Never edit another chapter's files.

**Render order** (C.16; transparent objects need an explicit order):

| renderOrder | what |
|---|---|
| -1000 | backdrop |
| 4 | glass plates |
| 5 | blob shadows |
| 10 to 14 | fills, bands, hatches, area strips |
| 20 | surfaces, solids |
| 29 to 34 | grid, construction lines, data pens, bars |
| 40 | LightField particles |
| 44 to 46 | hero curves, claim plates, SDF words |
| 47 | Nodes (data dots) |
| 50 | pen heads, halos, glows, ripples |

## Your own per-frame code

Most chapters need a little per-frame code of their own (a drum spin, a
river flow, a morph). Use the engine's guarded hook, never a bare `useFrame`:

```tsx
import { useSafeFrame } from '../../story/useSafeFrame'

const drum = useRef<THREE.Group>(null)
useSafeFrame('hopper drum', (T, A) => {
  drum.current!.rotation.x = A * 0.8          // ambient motion runs on A
  drum.current!.position.y = at(T, 0, 0, 0.3) // story motion runs on T
}, { hide: drum })
```

- **T** (`clock.T`) is story time, `index + t`. Everything that tells the
  story is a pure function of T.
- **A** (`clock.A`) is the ambient clock (L5): seconds that run only in
  unheld autoplay and in explore. Whenever the story is held, seeked or under
  reduced motion it FREEZES as `A = T x 2.5`, so a deep link still renders
  the same pixels. Drum spin, ball tumble and river flow use A; nothing else.
  Never read `performance.now()` or `Date.now()` in scene code.
- **Why guarded**: R3F calls every `useFrame` in one loop and renders only
  after it, so ONE throw in a bare `useFrame` skips every render and freezes
  the whole stage. `useSafeFrame` catches it, hides `hide.current`, warns once
  with your site name and stops calling that callback. The stage keeps going.
- **Priority**: 0 (the default) or negative. The engine runs the clock at
  -100, the camera at -90, labels at -80, DOM listeners at -70 and readiness
  at -60, so at 0 you already see this frame's T and camera. A POSITIVE
  priority takes over rendering on LOW (no composer) and blacks out the stage;
  `useSafeFrame` clamps it to 0 and warns.
- **Allocate nothing per frame**: reuse vectors (module-level scratch).

**Cached writers.** A pen `update` or strip `write` that skips work when
nothing changed must key on everything its output depends on, INCLUDING the
chart frame: `frameId(frame) + '|' + T` (or your own state). An effect that
resets a cache after a frame change runs after the commit, and a frame can
render in between with the new closure and the old key: the geometry then
stays in the old frame's scale (the explore domain fan was misregistered that
way after a sheet detent change).

## Beats: the fields

- `title` (at most 30 characters) and `body` (at most 140), restating copy in
  `fitnessData.ts` or the module files; `source` names it.
- `terms`: colour-linked caption terms, `{ 'exact substring': PAL key }`. The
  caption paints each term in its data colour (for example
  `{ 'Stored ATP and creatine phosphate': 'phosphagen' }`), so the word and
  the element being built share one colour (B.11). Match the body exactly.
- `build` (seconds for t 0 to 1), `cam` (poses, see below), `impact` (the
  chapter's single impact accent window), `eyebrow` and `cta` (intro only).
- `sceneWords` and `signature`: pacing (see "Reading time").

## Labels

All reading text is DOM, on the fixed type scale, never perspective-scaled.
`useLabels(specs, { mode? })` with a MEMOISED array (or `useLabel(spec)`):

- `tone`: `tick` (mono, muted), `name` (condensed caps with a data-colour dot;
  `dot: false` to hide it), `callout` (pill, data-colour border; `swatches` adds
  small colour dots), `readout` (pill with mono digits; `size: 'sm'` for compact
  rows; reserve width with `minChars`, which also avoids a layout read per
  counted number), `legend` (a glass chip pinned with `pin`; several pinned to
  one corner stack in `pinOrder`).
- `anchor`: a world point or `(T, layout) => V3`.
- `prefer`: the side you want; `only` restricts the sides (use `['S']` for
  x-axis ticks and `['W']` for y-axis ticks so they stay registered);
  `leader: true` allows a displaced label with a leader line;
  `leader: 'always'` draws the leader wherever the label lands (a callout
  that names a curve from a gap: "DOMAINS: THE HOPPER", "ZONE WON");
  `short` is a fallback text.
- `priority`: higher places first (defaults: callout 90, readout 85, name 60,
  tick 30). Give the labels that must never move (ticks, axis titles) a high
  priority and `only`, and let annotations yield.
- `required: true`: the beat does not make sense without it (all five domain
  names, every lineup row). It places first, and QA fails if it is hidden.
- `cue(T)`: visibility 0..1. Labels at 0 cost nothing and reserve no space.
- `mode`: labels are 'story' by default and hide in explore; pass
  `{ mode: 'explore' }` for explore labels (register them only while exploring).
- `setLabelText(id, text)` updates text without React (counters).
  `setLabelColor(id, css)` does the same for the data colour (the dot,
  border and callout text, CSS `--c`): skill names taking their class colour
  as the arcs pass, a pinned chip following its value's colour. It writes
  only when the colour changed for that node; pass cached strings so a
  per-frame caller allocates nothing (Skills' `rgba()` table, H.53).
- **Dynamic placement fields**: `prefer`, `center`, `gapPx`, `priority` and
  `only` are read on every placement pass, never snapshotted, so they may be
  getters of story time (`get priority() { return 97 + rank(clock.T) }`): a
  rail that rises places first as it passes another, a name lifts over a
  tick, a spoke name keeps its own row's side through a morph (Hopper,
  Pathways, Continuum). Keep a getter a cheap pure function (H.53).
- `badge`: a small mono badge before a name, in the label colour (a computed
  rank such as "P1"). `sepPx`: horizontal clearance kept on each side; ticks
  default to 6, so two tick labels always keep at least 12 px apart (show fewer
  ticks on a phone rather than let them touch).
- Ids are ONE namespace per stage: prefix them with your chapter. A duplicate
  id from a second hook warns; a hook only ever removes its own labels.
- Caps: at most 36 labels live (cue above zero) at any T, 96 registered per view.

**Obstacles.** The placer never puts a label on an obstacle. The HUD chip is
one. Register data marks and SDF plates with `useWorldObstacle(id, { box?,
points?, maxPoints?, radiusPx?, padPx?, mode? })`: a box is projected to its
screen bounding rect, each point becomes a small square, with the live camera,
every time labels are placed. `points(T, out)` writes xyz triples into `out`
and returns how many; `out` holds exactly `maxPoints` points (default 64), so
set `maxPoints` to the most you ever write (writing more throws; the engine
then skips that obstacle and warns once). Sample curves densely enough that a
label cannot sit between two samples (Definition: 40 per curve at 5 px).
A DOM obstacle that changes without T changing must call `bumpObstacles()`
(the placer skips frames when nothing moved).

The placer tries the preferred side first, then the side used last frame
(hysteresis), then the other compass sides, a slide, three 18 px stagger tiers
with a leader (both directions), the short text, and finally hides the label.
`window.__story.labels()` reports placed rects, overlaps, clipping and
`requiredHidden`; `window.__story.labelCounts()` reports the caps.

## Hotspots (tappable 3D things)

Labels are aria-hidden and never interactive. When a projected 3D thing must
be tapped or focused (the intro map's chapter tiles, a pickable brick), use a
hotspot: `useStageHotspot(id, { box: (T) => Box | null, onActivate,
ariaLabel, modes? })` renders a real `<button>` sized to the screen rect of
that world box (never smaller than 44 x 44), positioned through refs on every
placement pass, out of the tab order while `box` returns null, with a visible
focus ring. A tap activates it and never toggles pause. Hotspots are
swipe-transparent in story mode (H.53): a horizontal swipe that starts on one
steps the story like a swipe anywhere on the stage (the intro map's tiles
cover most of a phone's stage), and the click it might still produce is
eaten. `modes`: 'story' (default), 'explore' or 'both'.
`__story.hotspots()` lists their rects for QA.

## Camera poses

Each beat has `cam: { L, P?, window?, keys? }`. A pose is
`{ target, az, el, fov, fit, padPx }`:

- `fit` is the world box that must land inside the focus rect minus `padPx`.
  A function gets `(layout, frame)`, the chapter's live chart frame, so boxes
  that depend on the focus rect need no globals. Put label room in `padPx`.
- `target` should be the centre of `fit` (a function gets the same arguments).
  The principal point is moved to the centre of the padded focus rect with
  `setViewOffset`, so the subject is centred in the visible part of the stage
  and never under the caption card. The fitted distance is solved in closed form.
- Reading a chart: az 0, el 0, fov about 22 (no keystone, no stair-stepped
  axes). Depth is the point: az / el of 15 degrees or more, and fit the volume
  that is actually on screen at that moment (the fanned slices, not the flat
  chart). A few degrees of tilt reads as a mistake.
- `P` is the portrait pose (phones). Keep comparisons front-on (L12).
- **The owner's phone is SHORT.** On a phone shell the P pose is used while
  the focus rect's aspect is under 1.3 (every other shell: under 0.95; H.55),
  because iPhone Safari with its toolbars gives 390 x 664, 393 x 659,
  430 x 740 or 375 x 667, and a focus rect of about 366 x 358 (366 x 304 on a
  last beat with its CTA row). Design every P composition for that rect as
  well as for 390 x 844: when it cannot keep its words at that height, give it
  a short-portrait variant keyed on `focusRect.h` (Hopper `Q`, Definition
  lineup `PS`, Skills grid `S`), never a silent cull.
- The move happens inside `window` (default the first 35% of the beat), eased
  with `morph`; `keys` add mid-beat keyframes (see the Definition D2 fan).
- Free orbit exists only in explore mode (drei OrbitControls, limits from
  `explore.limits`); the director tweens back on "Back to story".
- **Focus insets**: a DOM panel of your own over the stage (the Continuum
  portrait key) must not cover the subject: `useFocusInset(ref, 'top' |
  'bottom', id)` (camera/focusRect.ts) removes it from the focus rect while it
  is mounted, and every pose re-fits. The HUD chip is not an inset (it is a
  label obstacle, and lines clear it with `hudClipX`).
- **Re-fit is automatic**, story and explore: the caption detent, the explore
  sheet, a rotation or a new chart frame re-fit the current pose (explore
  keeps the viewer's orbit angles and zoom). Under reduced motion every
  camera change is a cut, including entering explore and Reset view.

## Explore mode

`explore.initFromBeat(i)` seeds a per-chapter zustand slice from the beat the
viewer left; the `Explore` DOM component edits that slice; the Scene renders its
explore layer from it. Explore may use damped motion (`THREE.MathUtils.damp`);
determinism is only required in story mode. Every control is at least 44 px;
nothing is hover-only. Mark the one row that belongs in the phone peek with
`className="st-ex-peek"` (the peek shows whole rows only; the rest appears on
expand). `scrubToggle` + `onScrub(ray, ndc, phase)` route drags to your chapter:
intersect the ray with your chart plane, exactly like a drag handle.
When a control turns on something that lives in DEPTH (a fan of curves at
different z), reveal it: `cameraBus.orbitTo(az, el)` glides the explore orbit
there (L6: the camera moves to reveal a new dimension) and `orbitTo(0, 0)`
returns front-on; the viewer's own drag cancels it. Front-on, curves at
different depths project at different widths and read as misregistered.

## Prewarm: mount everything at load

Shader linking and buffer uploads on a phone stall the frame they happen in.
The engine compiles every material in the scene once your Scene mounts (hidden
objects included, and the composer's render-target variant), so:

- Mount every element of every beat at load, including the last beats' objects
  and your whole explore layer, and drive visibility from T (`opacity(T)`,
  `group.visible`) and from the mode.
- Keep the story scene mounted under explore: wrap the two layers in
  `<group visible={mode === 'story'}>` and `<group visible={mode === 'explore'}>`
  (Definition `Scene.tsx`). Story labels hide themselves in explore.
- Never mount by beat index (`index >= 5 && <Lineup/>`): that links shaders
  mid-story.

## DOM that follows story time (HUD, counters)

The HUD chip and other DOM bits never re-render per frame. `onFrame(fn)`
(story/clock.ts) subscribes a listener that runs once per frame right after
the clock ticks: read `clock.T` and write to refs (textContent, style). It
returns the unsubscribe function; call it from a `useEffect` cleanup.
`useHudOpacity(ref, (T) => 0..1)` (story/ui/Hud.tsx) fades the HUD chip from
T and removes it as a label obstacle at 0. `useDomCounter(ref, { value,
format })` counts a number into a DOM node. A listener that throws is removed
with a warning; it never stops the loop.

## Readiness and fonts

The slate stays up until the chapter chunk, the page fonts, your Scene, every
`SdfText` word and the shader prewarm are in. Each `SdfText` suspends inside
its OWN boundary, so a failed font request hides only that word; readiness
waits for pending words but gives up 8 s after the chapter mounted and the
page fonts resolved (15 s at most), with one console warning naming what was
missing, and the story plays over what did load. Never add your own Suspense
around the whole scene.

## Reduced motion

Handled by the engine: no autoplay, every beat shows `t = 1`, steps cut, the
transcript is expanded, the play button becomes "Show build". Your only job is
to make `t = 1` a complete, legible frame, and to never animate on wall time
in story mode.

## When your code throws

Every chapter callback the engine calls inside a frame loop (label cues and
anchors, obstacle boxes and points, pen, fill, light, glow and instance
callbacks, pose functions, frame listeners) is caught at the call site: that
one element is hidden and the console gets ONE warning naming it (`[story]
<Pen> callback threw ...`). The stage keeps rendering. Your OWN per-frame code
gets the same guarantee only through `useSafeFrame` (a bare `useFrame` that
throws freezes the stage). Treat any such warning as a bug. (Render errors
are caught by the Scene's error boundary.)

## Light and colour in linear space

The composer renders in linear light, so alpha blending happens there: small
alphas read much stronger than on a web page (alpha 0.03 of chalk is about
+40 sRGB levels on the slate), and translucent layers that overlap on screen
add up fast into a milky wash. Keep translucent fills faint (glass plates
about 0.007; depth slices about 0.1 and only near their edge), put the light
in a thin rim or a crisp pen, and rest a dimmed line with `dim`, not opacity.

## Quality tiers and budgets

- `TIERS[tier]`: HIGH (DPR up to 2, MSAA 4, 7-level bloom, grain), MEDIUM (phone
  default, DPR up to 1.5, half-res 5-level bloom, SMAA, particles x0.8), LOW (no
  composer, renderer tone mapping, halos instead of bloom, fills instead of
  particles).
- On LOW render the `AreaFill` version of anything drawn with light.
- Mobile budget per frame (MEDIUM, including post): at most 120 draw calls and
  250k triangles; aim for 30 scene calls and 30k triangles. Measure with
  `window.__story.stats()` (Definition: 20 to 30 calls, under 4k triangles, 7.2k
  points at DPR 1.5).
- Never add a `useFrame` with a positive priority (it would take over rendering
  on LOW and the stage would go black). Never add post effects in a chapter.
- **Idle rendering** (H.58): once the story is not animating (paused, held or
  finished, no glide, no touch, no sheet) and story time, the focus rect and
  the store have been still for 1.2 s, the Canvas renders on demand; any
  change wakes it (`state().idle`). So anything of yours that moves must move
  from story time, the ambient clock (which only runs while playing) or a
  store change, or it settles within 1.2 s (a damped follower). Never animate
  from wall time in a held frame.

## Disposal

Create geometries and materials in `useMemo`, dispose them in a `useEffect`
cleanup. Kit components dispose their own. After navigating away and back,
`stats().geometries` must return to its earlier value.

## Copy

Beat titles <= 30 characters, bodies <= 140, restating copy that already exists
in `fitnessData.ts` or the module files; name it in `source`. No new facts,
numbers or quotes. Computed values (scores, totals) go in labels and the HUD,
never in caption prose. Colour is meaning (L8): #91C640 is fitness, the
generalist or the claim, never a specialist's low score. No em or en dashes.

## QA contract

- `?beat=N&t=X` renders beat N at progress X and holds; `?explore=1` opens
  explore; `?tier=high|medium|low`; `?motion=reduce|full`; `?detent=`.
  (The `?qa=stub` stub story is gone: every chapter is a story.)
- The stage root carries `data-story-ready="1"` once the chapter is LOADED and
  two frames rendered after the last seek. Loaded never goes back to false on a
  seek, so the slate never covers a scrub (H.15).
- `window.__story`: `seek(n, t)`, `play()`, `pause()`, `next()`, `prev()`,
  `explore(on)`, `state()` (includes `still`, `idle`, `loaded`, `focus`), `stats()`,
  `labels()`, `labelCounts()`, `project(x, y, z)`, `chartRect()` (the chart
  frame box projected, stage px), `probe(id)` / `probes()`, `qualityLog()`,
  `ready`, and the sound hooks `audio()`, `audioTimeline(from, to)`,
  `renderAudio(from, to, opts)` (see Audio).
- `?sound=1|0`: sound on for this page (QA) or forced off.
- `useQAProbe(id, fn)` (story/qa.ts) exposes a read-only snapshot a
  screenshot cannot check, e.g. the end points of a geometry buffer
  (Definition registers `def-fan`, and story-qa proves the domain fan stays
  registered after a sheet detent change).

## Audio

Sound is OFF by default (owner decision; DESIGN.md section I). When the viewer
turns it on, every beat is narrated by its own clip, the beat holds until the
clip has ended plus a breath, and a small palette of procedural sounds marks
what the picture does. Your chapter supplies ONE new file and a few `export`s.

**Only a story that declares narration has sound** (amendment H.72):
`StoryDef.narration`, the story's generated `narration.gen.ts`. Without it
there is no Sound on chip, no toggle, no "M for sound", no unlock listener, no
AudioContext and no ui sounds, and every hold is the C.3 rule. On this branch
no /fitness chapter declares it (Capacity's clips and cue sheet are kept,
dormant); MetFix Modules 1 and 2 do (src/metfix-lab/README.md, "Sound").

**What you write: `stories/<view>/sound.ts`** (discovered by glob; never
registered by hand, never inside `story.ts`):

```ts
import type { ChapterSound } from '../../story/audio/types'
import { axesDraw, d0Dot, taskAppear } from './Scene'

const sound: ChapterSound = {
  cues: {
    // keyed by Beat.id
    measured: [
      { name: 'axes', sound: 'pen', from: { fn: axesDraw }, pan: [-0.25, 0.3] },
      { name: '400m dot', sound: 'tick.dot', from: { fn: d0Dot }, on: 'land', ring: 'ripple' },
      { name: 'points', sound: 'tick.dot', from: { each: taskAppear, n: 10, skip: [4] }, on: 'land', gain: -5, max: 4 },
    ],
  },
  // ambient: [{ kind: 'rattle', level: (T) => drumOn(T), rate: (T) => 1 + spinBoost(T) }],
}
export default sound
```

- **A cue names its SOURCE, never a number.** `{ fn }` is one of your Scene's
  cue functions (export it; hoist an inline lambda to a named export with the
  same numbers), `{ each, n, skip? }` a staggered set, `{ label }` /
  `{ labels }` a registered label's `cue`, `{ cam: true }` the beat's camera
  move, `{ impact: true }` the beat's impact window, `{ times }` / `{ spans }`
  data-driven instants or windows. `story/audio/cueFrom` samples the source over
  the beat (601 points) into segments with `a` (2% in), `land` (arrival; an
  overshooting snap lands at first contact), `half` and `b`, so a retimed
  animation carries its sound with it. `seg` picks a segment (a pulse has two).
- **One-shots** fire at `on` (`'start'` default, `'land'`, `'half'`, `'end'`
  or a fraction). **Continuous** sounds (`pen*`, `pour.*`, `air.*`,
  `clack.rain`, `ball.cascade`) span the segment and follow its SPEED: a stroke
  that accelerates and settles sounds like it.
- `gain` is dB from the palette level (clamped -12 to +3); `pitch` is
  semitones on the chapter's chord tones (a list gives one per event); `pan`
  stays within +/-0.35; `max` (2 to 6) caps how many events of a staggered set
  sound (the first, the last and evenly between): nine dots landing in half a
  second need 3 or 4 marks, not 6 (the fifth listen).
- **Check that each mark is heard.** A mark under the voice can be masked:
  render the stems and measure each cue's band margin over voice + bed (the
  review tool `exposure.py` in `shots/audio-review-2/tools/`); every cue needs
  at least 6 dB in some third-octave band. Lift a masked set with `gain`, and
  check its pitch against the voice at that moment (a pitch in the voice's F2
  can be worse, not better).
- **Restraint (I.1.4)**: at most 4 cue entries per beat (a set counts as one);
  one `resolve` / `resolve.fall` per signature beat and nowhere else; the
  engine keeps at most 6 audible events in a set (each 0.6 dB softer), 45 ms
  apart, 16 transients a second, no effect in a beat's first 150 ms, and ducks
  the earlier of two overlapping continuous sounds 6 dB. What never makes a
  sound: counters, fades and focus pulls, gridlines and ticks, labels leaving,
  the slate, camera settles I.7 does not list, scrubbing (apart from its soft
  boundary tick), anything in explore the viewer did not touch.
- **The bed** (key, chord, the claim's answer) is engine-owned (`story/audio/bed.ts`):
  the chapter's first `resolve` fades the chord's third in under the bell.
  Ambient layers exist only while the picture moves on the ambient clock A.
- **Continuous sounds never build into a claim.** `pour.fill` and `pour.sweep`
  carry the amount in their tone and grain density, with a flat noise level, a
  centre that moves under an octave and a settle from 60% of the window (H.71):
  a cue that ends right before a `resolve` must be flat or falling in its last
  second (`sound-qa pour` gates Capacity's D3).
- **Ducking** is scheduled from the manifest's speech spans (I.3.3) and
  BRIDGES the gap between two beats when autoplay carries on (the bed does not
  pop up between sentences); nothing in a chapter controls it.
- The cue sheet for every chapter is DESIGN.md I.7; Capacity
  (`stories/definition/sound.ts`) is the worked exemplar.
- `?tick=round` plays the older round `tick.dot` for the owner's A/B (the
  default is the contact-led 'glass' tick); do not design around either.

**Explore: `useSfx()`** (`story/audio/useSfx.ts`) in your Explore component:
`sfx.play('pour.fill', { gain: -6, dur: 1.2 })` for a one-off, or
`sfx.hold('pen.slide')` for a drag (`set(level, pos)` at most once a frame,
`release()`). Chips, toggles and buttons inside the stage already tap
(`ui.tap`) through the director's click listener; do not add your own.
Explore sounds are never scheduled from T.

**Narration** (H.72). A narrated story's folder holds `narration.json` (`clips`:
its folder under public/, e.g. `narration/metfix/bayes`; `beats`: id ->
{ source, text }) and the generated `narration.gen.ts`, which story.ts declares:
`import narration from './narration.gen'` and `narration,` on the StoryDef. One
clip per beat in `public/<clips>/<id>-<hash>.mp3`, where `hash` is the first 10
hex of sha1 of the spoken TEXT (whitespace collapsed). A /fitness chapter speaks
its caption BODY (section I "Voice"; `scripts/narration-spoken.json` renders
digits), so editing a caption fails the gate; a MetFix module speaks its own
explanatory script (each paragraph restates the module source) and its captions
stay the subtitles. Edit a sentence and the gate fails until its clip is
regenerated (the voice/ pipeline) and the manifest rebuilt: voice and text never
drift. Story timing reads durations ONLY from that build-time manifest, never
from runtime decoding, so `?beat=N&t=X` and QA stay deterministic; with sound
off every hold is exactly the C.3 rule.

**The picture follows the voice** (H.74). With sound on, a narrated beat armed
at its build's start does not build at its designed rate: build t is a fixed
piecewise-linear map of the clip position (the audio clock), through the
knots of `NarrationClip.sync`, so each reveal lands as its words are spoken;
after the last knot the designed rate; never backward (armed mid-beat, the
picture waits until the voice catches up). Its hold is the rest of the voice
plus the breath. Knots come from narration.json `sync` anchors, `[t, at,
offset]`: `at` is a sentence index (0 first) or a phrase found once in the
paragraph, at its first word's onset (narration.align.json, written by
`python scripts/narration-align.py`: CTC forced alignment of the known text)
plus offset seconds. No anchors: the build stretches to the last sentence;
`"sync": []`: the designed rate. Scenes still read T alone, and with sound
off nothing changes. A warp cannot reorder: what the voice says first must
build first in the scene.

**Gates** (run before every commit):
- `node scripts/narration-manifest.mjs` after adding or replacing a clip (it
  writes every narrated story's narration.gen.ts, with each beat's sync knots,
  and prints its sound-on runtime); `--check` exits 1 when one is stale. Run
  `python scripts/narration-align.py` first when a clip is new or replaced.
- `node scripts/fitness-gate.mjs` runs `scripts/narration-check.mjs`: every
  beat of a narrated story has its text and the clip of that text's hash, no
  narrated id is missing from the story, the manifest is current and declared,
  each clip passes pace (2.0 to 3.7 words a second), no inner gap over 0.8 s
  (a MetFix story may widen this to at most 1.6 s with a reason, narration.json
  `gates`), true peak <= -2.0 dBTP and a small clip gain, and every beat's
  sync anchors resolve (an alignment for its current text, sentence indices
  in range, phrases found once, t never falling, times increasing, the build
  ending inside the clip); and
  `story/audio/**` has no `Math.random` (renders repeat exactly).
- QA: `?sound=1` behaves as if the viewer turned sound on (headless Chromium
  needs `--autoplay-policy=no-user-gesture-required`), `?sound=0` forces it
  off. `__story.audio()` returns `{ enabled, unlocked, contextState, idle,
  session, playing, clip, position, beatHold, levels, voices, startedFrom }`
  (`idle`: the director's own suspend after 12 s with nothing audible; sound is
  still ON, the toggle shows On, and Play resumes the clip where it paused);
  `__story.audioTimeline(from, to)` the planned beat starts, clip spans, speech
  spans and cue times; `__story.renderAudio(from, to, { stems, duck })` the
  REFERENCE MIX as a base64 WAV. Meter it: `ffmpeg -hide_banner -i mix.wav -af
  ebur128=peak=true -f null -` (targets: DESIGN.md I.3.5). Your chapter's
  story-qa run with sound off must be unchanged.
- `node scripts/metfix-sound-qa.mjs http://127.0.0.1:<port> <outDir> [test ...]`:
  the narrated MetFix modules (gesture with real taps, /fitness without sound,
  timing with the H.74 sync check: every frame of a sounding clip shows its
  mapped t within 0.12 s of the audio clock, silent C.3 timing, behaviour, the
  reference mixes, the chip and toggle shots).
- DORMANT since H.72 (it exits with a notice unless `SOUND_QA_FORCE=1`):
  `node scripts/sound-qa.mjs http://127.0.0.1:<port> [test ...]` (about 10
  minutes for all; each test is caught on its own, so one crash is one FAIL):
  the gesture rule with real taps, timing on and off (story time plus the
  audio clock, never wall time), deep links (the same state; pixels only
  between loads that share a chart frame), pause / next / seek / explore /
  hidden / chapter / reduced motion, the fix-round-1 regressions `duck` (the
  bed sits 6 dB down, +/-0.5, inside every speech span, and never comes up for
  less than 0.8 s between two sentences; set `SOUND_QA_VIEWS=definition,<view>`),
  `idle`, `done`, `interrupt`, `leave`, and the fix-round-2 ones `hidden2`,
  `session`, `idleshow`, `keys`, `bridge` and `pour`. Run `duck` for your
  chapter: the ducks hold through any inner gap up to 0.8 s (`DUCK_MERGE`, the
  same number as the gap gate), and a clip that fails it has a gap the gate
  should have caught.
- The ear (`critic.py`) is a second opinion only, and it hallucinates: always
  put a silent stretch and a sound that does not exist in the question as
  controls, discard any run that fails them, and never act on a finding a
  meter, a stem or the code cannot confirm.

**Engine touchpoints** are marked `// [audio]` (playback, store, ready, url,
gestures, StoryProvider, CaptionCard, TopBar, Stage, fitness.css). Engine
files import only `story/audio/hooks.ts` (which imports nothing) and, for the
narrated check of the UI, `story/audio/narration.ts`. `scripts/sound-qa.mjs`
drives `/fitness/definition`: it is dormant until a /fitness chapter declares
narration again (then run it with `SOUND_QA_FORCE=1`).

## Checklist before you commit

1. `node scripts/fitness-gate.mjs` passes (grep gate + caption audit + narration gate).
2. a scan of `src/fitness` for U+2013 / U+2014 (em and en dashes) prints no dashes.
3. `tools/build.sh` passes for the dev and the preview build.
4. Serve the build and run `node scripts/story-qa.mjs check http://127.0.0.1:<port> <view>`:
   labels at 360 / 390 / 430 and at the Safari viewports 390 x 664, 393 x 659,
   430 x 740 and 375 x 667 (no overlaps, clipping or hidden required labels;
   and at 390 x 664, 393 x 659 and 430 x 740 no name, callout or readout the
   390 x 844 phone shows on a beat's finished frame may be culled, H.55), a
   Read more that holds story time,
   budget, continuity, scrub without slate, nav away and back, persistent canvas,
   keyboard and URL drift, reduced motion. All must pass.
   It also checks the finished last beat's card (every button inside the card
   and the viewport at 360 / 390 / 430 and landscape, 44 px targets), the
   scrubber's hit band, the explore re-fit at every sheet detent (the chart
   stays inside the focus rect), a failed-font load, real CDP finger drags on
   the card, tap queueing and deep-link stepping, label determinism (a deep
   link places labels exactly as scrubbing there), and runs your chapter
   UNPINNED at 3x on virtual clocks: 60 fps and a 30 fps cap are never
   demoted; an uneven 20 fps phone must end on LOW in still mode.
   A gate that throws (a selector that never appears) is reported as that
   gate's FAIL and the run continues; nav-away-and-back and the persistent
   canvas use the Previous card on the last chapter (Health).
5. `node scripts/story-qa.mjs shots <url> <dir> safari "<view>?beat=N&t=1" ...`
   for every beat on `safari` (390 x 664: look at these FIRST, they are what an
   iPhone shows), `phone`, `p360`, `p430`, `phone3x` and `desktop`, plus a
   mid-beat frame per beat and `?explore=1`. Look at every one, phone first:
   the subject fills the focus rect, the idea of the beat is SHOWN, nothing
   reads as noise at 3x.
6. `fitnessData.ts` unchanged (`git diff --stat`).
