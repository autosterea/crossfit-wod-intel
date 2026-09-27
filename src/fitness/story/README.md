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
import { useStoryFrame } from '../../story/kit/chartFrame'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { LabelSpec } from '../../story/types'

export default function ExampleScene() {
  const f = useStoryFrame()                          // the same frame the camera fits
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
  re-renders your scene. (The focus rect object itself is `focusRect` in
  `camera/focusRect.ts`; `focus` in `cue.ts` is the focus pull.)
- Easing tokens (`story/ease.ts`): `draw` (line draw-on), `settle` (arrivals),
  `snap` (dots, bricks), `morph` (topology and camera), `count` (numbers),
  `exit`, `linear`.
- Pacing (H.29): a beat stays up for its reading time, about 250 words per
  minute: hold = `clamp(0.4 + 0.23 x words - build, 2, 7)` seconds. Reading
  starts at the caption swap, so the build IS reading time: make it move from
  frame 1 (the first beat starts as the slate fades, with no pre-roll). An empty
  or static opening is the owner's first 10 s; Definition draws its axes with a
  hot pen at 0 s and starts its first curve at about 6 s.
- `useCueState(fn)`: React state derived from T that re-renders only when the
  value changes (which caption variant or DOM panel to show). Never use it for
  anything that changes every frame.

## The kit (never write your own versions)

| Component / helper | Use |
|---|---|
| `<Pen points progress opacity head hot dashed update gain/>` | one stroke; draw-on by arc length, exact under seek; `update(T, pts)` mutates the polyline in place. `head` rides a two-layer luminous tip (hot core plus a tinted halo) that stays at full brightness on faint strokes; `gain(T)` lifts or dims the colour (dim a line with gain, not opacity: overlapping segment caps show as beads at low opacity) |
| `<PenBatch segments colors progress opacity byArc update head hot gain/>` | many segments in ONE draw call (grids, axes, ticks, bars, merged outlines). With `byArc` and `head` on one continuous path (axes as one L stroke) the pen tip travels along it. Park segments you do not want yet far away (x = 1e5), never at zero length (a zero-length segment draws a round dot) |
| `<MorphPen shapes weights stagger/>` | one pen blending 256-point shapes from `kit/shapes.ts` |
| `<AreaFill top baseline bottom? color mode reveal level opacity additive rim gamma/>` | area strips; gradient, hatch or solid; `bottom` makes a band between two curves; `additive` + `rim` + `gamma` make a luminous area with an HDR rim that blooms (H.20); `level` pours, `reveal` sweeps |
| `<AreaStrips strips points colors write rim rimWidth rimAlpha rimScale/>` | several strips (one slice per series at its own depth, the seven minis of a lineup) in ONE draw call; `rimScale` gives each strip its own rim, so only the speaking strip goes HDR |
| `<Plates plates vis radius/>` | up to 16 faint glass plates (rounded rect, 1 px border) in ONE call, each faded by `vis(T, i)`: makes a group read as one unit (lineup rows, tiles) |
| `<Glows count sizePx colors place gain/>` | many additive glow points in ONE call (a dot flaring as the pen passes it, the light at a growing bar's end); `place(T, i, out)` returns the intensity |
| `<Ripple position color k sizePx/>` | one expanding ring of light where something lands (`k(T)` runs 0 to 1 over about 600 ms), hot at the start |
| `<Instances geometry material count place colors opacity/>` | any repeated SOLID (slabs, bricks, parts, tiles) in ONE call; `place(T, i, pos, quat, scale)` writes each instance; return false to hide it |
| `<LightField frame count curveA curveB uniforms/>` | constant-density light particles (pour, spill with streaks, condense); counts come from `TIERS[tier].particleScale` |
| `<Nodes count radius color place/>` | instanced dots, one draw call |
| `<SdfText font text size color opacity/>` | drei Text with the SELF-HOSTED fonts only (`anton`, `barlowSemi`, `barlowBold`); only for large words that belong to the 3D world. Register it as a world obstacle so labels avoid it |
| `<Halo position sizePx color intensity/>` | additive glow point; the LOW-tier stand-in for bloom |
| `makeRimStandard(opts)`, `steelOpts` | lit solids with a fresnel rim (PBR against the procedural environment) |
| `useStoryFrame()`, `storyFrame()` | the chapter's engine-owned adaptive chart frame (`StoryDef.frame`); poses get it as `fit(layout, frame)` |
| `useChartFrame(opts)` | a second, explicit frame inside a chapter |
| `intervalAxis`, `logAxis` | the time axes |
| `useCounter(labelId, { value, format })`, `useDomCounter(ref, { value, format })` | counting readouts written imperatively; `value` is a pure function of T |
| `impactK(T)` | the chapter's single impact accent (declare `impact: [a, b]` on the beat) |
| `useChapterFog` | fog, Hopper and Health only (or set `fog` on the StoryDef) |
| `useDragHandle` | explore-mode drag handles that win over orbit; `onDrag(ray, ndc)` |
| `useStageHotspot(id, { box, onActivate, ariaLabel, modes })` | a REAL focusable button over a projected 3D box (see Hotspots) |
| `<ChipRadio label options value onChange/>` | the explore chip row as a real radiogroup (roving tab stop, arrows select) |

Pen widths are screen pixels by role: `PEN.grid` 1.25, `PEN.axis` 2,
`PEN.data` 3, `PEN.hero` 4.5.

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
  `leader: true` allows a displaced label with a leader line; `short` is a
  fallback text.
- `priority`: higher places first (defaults: callout 90, readout 85, name 60,
  tick 30). Give the labels that must never move (ticks, axis titles) a high
  priority and `only`, and let annotations yield.
- `required: true`: the beat does not make sense without it (all five domain
  names, every lineup row). It places first, and QA fails if it is hidden.
- `cue(T)`: visibility 0..1. Labels at 0 cost nothing and reserve no space.
- `mode`: labels are 'story' by default and hide in explore; pass
  `{ mode: 'explore' }` for explore labels (register them only while exploring).
- `setLabelText(id, text)` updates text without React (counters).
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
focus ring. Stage gestures ignore buttons, so tapping a hotspot never toggles
pause. `modes`: 'story' (default), 'explore' or 'both'.
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
- The move happens inside `window` (default the first 35% of the beat), eased
  with `morph`; `keys` add mid-beat keyframes (see the Definition D2 fan).
- Free orbit exists only in explore mode (drei OrbitControls, limits from
  `explore.limits`); the director tweens back on "Back to story".

## Explore mode

`explore.initFromBeat(i)` seeds a per-chapter zustand slice from the beat the
viewer left; the `Explore` DOM component edits that slice; the Scene renders its
explore layer from it. Explore may use damped motion (`THREE.MathUtils.damp`);
determinism is only required in story mode. Every control is at least 44 px;
nothing is hover-only. Mark the one row that belongs in the phone peek with
`className="st-ex-peek"` (the peek shows whole rows only; the rest appears on
expand). `scrubToggle` + `onScrub(ray, ndc, phase)` route drags to your chapter:
intersect the ray with your chart plane, exactly like a drag handle.

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
<Pen> callback threw ...`). The stage keeps rendering. Treat any such warning
as a bug. (Render errors are caught by the Scene's error boundary.)

## Light and colour in linear space

The composer renders in linear light, so alpha blending happens there: small
alphas read much stronger than on a web page (alpha 0.03 of chalk is about
+40 sRGB levels on the slate), and translucent layers that overlap on screen
add up fast into a milky wash. Keep translucent fills faint (glass plates
about 0.007; depth slices about 0.1 and only near their edge), put the light
in a thin rim or a crisp pen, and dim a line with `gain`, not opacity.

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
  explore; `?tier=high|medium|low`; `?motion=reduce|full`; `?detent=`;
  `?qa=stub` puts a 3-beat stub story on chapters without one (QA only).
- The stage root carries `data-story-ready="1"` once the chapter is LOADED and
  two frames rendered after the last seek. Loaded never goes back to false on a
  seek, so the slate never covers a scrub (H.15).
- `window.__story`: `seek(n, t)`, `play()`, `pause()`, `next()`, `prev()`,
  `explore(on)`, `state()`, `stats()`, `labels()`, `labelCounts()`,
  `project(x, y, z)`, `ready`.

## Checklist before you commit

1. `node scripts/fitness-gate.mjs` passes (grep gate + caption audit).
2. `node C:/Users/ravik/fitness-v2/tools/dashcheck.mjs C:/Users/ravik/fitness-v2/base/src/fitness` prints no dashes.
3. `tools/build.sh` passes for the dev and the preview build.
4. Serve the build and run `node scripts/story-qa.mjs check http://127.0.0.1:<port> <view>`:
   labels at 360 / 390 / 430 (no overlaps, clipping or hidden required labels),
   budget, continuity, scrub without slate, nav away and back, persistent canvas,
   keyboard and URL drift, reduced motion. All must pass.
   It also checks the finished last beat's card (every button inside the card
   and the viewport at 360 / 390 / 430 and landscape, 44 px targets), the
   scrubber's hit band, and runs your chapter UNPINNED at 3x on a virtual
   60 fps clock: a healthy phone must never be demoted.
5. `node scripts/story-qa.mjs shots <url> <dir> phone "<view>?beat=N&t=1" ...`
   for every beat on `phone`, `p360`, `p430`, `phone3x` and `desktop`, plus a
   mid-beat frame per beat and `?explore=1`. Look at every one, phone first:
   the subject fills the focus rect, the idea of the beat is SHOWN, nothing
   reads as noise at 3x.
6. `fitnessData.ts` unchanged (`git diff --stat`).
