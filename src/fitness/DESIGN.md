# What Is Fitness? Redesign: CHALKLINE (binding design spec)

Status: BINDING. Written by the design lead on branch `fitness-v2` from the judged proposals. Chalkline won; the grafts from Lumen Lab and Prime Time are merged below, and every conflict between them is resolved. Builders implement this document.

If a builder finds a real contradiction or something impossible, they fix the smallest thing, record it in section H (Amendments) with a reason, and keep going. Layout constants marked "start" may be tuned by up to 15% to pass the acceptance checks. Nothing else changes without an amendment: not the beat structure, captions, cue order, colours, engine contract or laws.

Precedence: this file wins over `CLAUDE.md` on dependencies, envMaps and drei `<Text>`, because the owner authorised the stronger stack. `CLAUDE.md` still wins on everything else: analytics, fixed brand colours, no dashes, 3D stays dark, no Node runtime.

Contents
- A. Direction and laws
- B. Global visual system
- C. Engine API
- D. Storyboards (intro, skills, hopper, pathways, definition, continuum, health)
- E. Global acceptance checklist
- F. Data flags and owner decisions
- G. Kept, retired, build order
- H. Amendments
- I. Sound (narration, effects, bed, mix, UI, engine API, cue sheet)

---

## A. Direction and laws

### A.1 Name and thesis

**CHALKLINE.** A coach's pen of light draws each model onto a dark slate, one idea per beat, in the order a coach builds it on a whiteboard: construction, then data, then annotation, then the claim. Where the lesson measures an amount, light fills the shape at constant density, so the amount of light is the amount. Every frame is a pure function of story time, so every moment of the argument can be linked, scrubbed and tested.

### A.2 What the owner sees on his phone (first 20 seconds at /fitness)

The phone shows a full-bleed dark slate with no box and no chrome beyond a slim top bar.

1. "WHAT IS FITNESS?" in Anton fills the upper half, with FITNESS? in PA yellow-green.
2. A luminous pen head draws a chalk underline beneath the title. The pen is the only thing glowing.
3. The line lifts off the title and becomes a ten-sided wheel, labelled SKILLS as it closes. A copy drops to a row at the bottom.
4. The line becomes a drum, then three energy humps in rose, amber and blue, then a dial. Each shape is labelled as it forms.
5. Two axes draw, the line bends into a power curve, and yellow-green light pours in under it until the area is full.
6. The area extrudes backward into a lit, glossy lifetime landscape.
7. Everything folds into six glowing chapter tiles you can tap.

Throughout, the caption card reads like a native app, and the play ring is already turning.

### A.3 Signature moment per chapter

Each signature moment is one beat and must be the most polished frame of its chapter.

| Chapter | Signature moment |
|---|---|
| Intro | One pen line becomes every model, then the six-tile map |
| 01 Skills | The Powerlifter's dashed outline cuts inside the generalist's wheel, and its floor ring collapses from 7 to 2 |
| 02 Hopper | A steel drum tumbles. A ball drops, a ticket flips, and six bricks slam into six ranked rails. On an Unknown draw the Generalist rail climbs to P1 |
| 03 Energy | A river of light in three colours flows left to right through time, thinning as power falls. It then separates into three stacked lanes |
| 04 Capacity | Light pours into the area under the curve while a readout counts to 94. For the Powerlifter, most of the light spills out in red while a small amber sliver condenses |
| 05 Continuum | Ten parallel marker rows swing into a full-circle dial. The camera tilts and reveals the centre as a pit of sickness |
| 06 Health | From age 50, a scanner sweeps the sunken sedentary landscape and the surface lifts behind it like a wave |

### A.4 Laws (every beat is checked against these)

- **L1 One idea per beat.** A beat adds exactly one new class of element. Two specialists, three profiles, or a draw plus scoring plus totals in one beat is a violation: split it.
- **L2 Build grammar.** Inside a beat the order is always:
  1. construction (axes, rings, rails), drawn in 400 to 700 ms;
  2. data (lines, shapes, bricks, surfaces, fills), drawn with the pen;
  3. annotation (labels, ticks), fading in over 220 ms;
  4. the claim (one callout pill or one SDF word), which lands last.
- **L3 Focus pull.** While a beat builds, everything built by earlier beats dims to 35% opacity, then recovers to its resting opacity by t = 1. The newest idea is always the brightest thing on screen.
- **L4 One speaking element.** At most one element per beat is HDR-hot (emissive above 1.0, so it blooms). Usually that is the pen head; sometimes it is the fill being poured, or the claim. Everything else stays at or below 1.0.
- **L5 The scene is f(T).** T = beatIndex + t. In story mode nothing keeps history: no accumulated trails, no physics, no springs, no Math.random and no performance.now in scene code. Ambient motion (drum spin, flow) runs on a separate clock A, which freezes as A = T x 2.5 whenever the story is held.
- **L6 The camera moves for three reasons only:** to reveal a new dimension (depth, lanes, age), to frame a new subject, or to return to front-on for a comparison. It never moves for drama, and it never shakes.
- **L7 Reading text never scales with depth.** All labels are DOM text on a fixed type scale. They sit in screen space, are clamped inside the focus rect, and avoid colliding with each other. drei `<Text>` (SDF) is used only for the few large words, listed per chapter, that belong to the 3D world.
- **L8 Colour is meaning.** Every hue comes from `PAL` and means what `PAL` says.
  - #91C640 means fitness, the generalist, or the current claim.
  - Chalk #eef3f6 means construction.
  - A specialist in a comparison is a dashed chalk outline, never a data hue that already means something. (The old cyan "B" ghost reused `PAL.robust`, which means ROBUST in the continuum chapter.)
  - #019644 is only for solid buttons and CTAs. `PAL.trained` data uses the same hex by design.
- **L9 Constant density.** Where light particles fill a region, they sit at constant density per unit of plotted area, so the amount of light equals the amount. Particles never appear inside a data region for decoration, and there are no ambient particle clouds anywhere.
- **L10 A crisp edge carries every claim.** Any boundary that carries a claim (a curve, a floor ring, the independence line) is drawn with a crisp pen line on top of any fill, glow or particles.
- **L11 Time runs left to right** in every chapter and on every orientation, so Energy, Capacity and Health transfer to each other. Age runs into depth.
- **L12 Comparisons are front-on.** When the point is comparing heights, lengths or areas of two or more things side by side or overlaid, the camera is front-on (az within 10 degrees, el within 8 degrees) with a telephoto fov of 22 to 30. One exception: the Health surfaces are inherently 3D. Their overlays are read through colour, isolines and readouts, never through apparent height alone.
- **L13 Captions restate existing copy.** Every caption paraphrases or restates copy already in `fitnessData.ts` or the module files, and names its source. No new facts, numbers or quotes.
  - On-screen label strings come only from the per-chapter label lexicon in section D.
  - Live readouts (totals, areas, values) are computed from existing data and are never written into caption prose.
- **L14 Nothing advances while the viewer is reading or touching.** Hold time scales with the number of words. Any touch, drag, open sheet, explore mode, hidden tab or off-screen stage pauses the clock.

### A.5 Decision log (conflicts resolved; builders do not reopen these)

| # | Conflict | Decision |
|---|---|---|
| 1 | Base direction | Chalkline: pen on slate, strict grammar, f(T) engine. |
| 2 | "Wow" vs restraint | Keep the restraint: no shake, chromatic aberration, stingers, scanlines, or depth of field in stories. Add Lumen's light fills (the Capacity pour, spill and condense, and the Energy river), real PBR steel for the drum lit by a procedural environment, fresnel rims, bloom on the pen head, and at most one impact accent per chapter. |
| 3 | Tone mapping | NEUTRAL everywhere: postprocessing `ToneMappingMode.NEUTRAL` on composer tiers, `THREE.NeutralToneMapping` on the renderer for LOW. Never ACES. |
| 4 | Energy portrait: vertical river (Lumen) vs horizontal time | Time stays horizontal (L11). The phone-native answer is the adaptive chart frame (B.13), which makes the chart tall on a phone, plus lanes stacked vertically in P4. |
| 5 | Pathways lanes in depth (oblique) vs front-on | Lanes are stacked vertically and viewed front-on (L12). |
| 6 | Hopper towers (Prime Time) vs rails (Chalkline) | Horizontal rails built from 3D bricks. Each brick is coloured by the DRAWN domain. Rails re-order by rank with P1 to P6 badges, so the rails are the timing tower. |
| 7 | Hopper run length | The story run is 40 draws (seed 78331). The 64-thread proof uses the same 40-draw x axis. |
| 8 | Continuum 200-degree fan vs full circle | Full circle, with the same spoke grammar as Skills, so it never clips at 360 px. Lumen's bowl depth and portrait DOM key are grafted on. |
| 9 | Skills readout | "Fitness breadth" (the mean) is removed everywhere. Readouts are Weakest skill and Range. Small multiples sort by weakest skill. |
| 10 | Tap gestures | No tap-to-advance zones. A horizontal swipe or the transport buttons step beats. A single tap on the stage toggles pause. Press and hold pauses while held. |
| 11 | Capacity x axis (Lumen F1) | Today the curves are drawn index-uniform against true-log ticks, so they are misregistered. The fix is a "benchmark interval" axis: the 8 sample durations sit at equal spacing, and each segment between ticks is log. Curves, ticks, task dots and displayed scores then all agree, and every displayed score is unchanged from the live site. A true-log axis would change scores, so it is listed as an owner decision (F.1). |
| 12 | Capacity lineup (oblique loaf) | Ranked small multiples, front-on (L12). |
| 13 | Health volume as particles | No. The volume is a solid translucent volume under an isoline surface, for precision and fill rate. Particles are used only for the Capacity area and the Energy river. |
| 14 | Intro particle cloud | No cloud (L9). The hook is the pen, the Anton title and the morphs. |
| 15 | Canvas count | One persistent Canvas, composer, environment and label layer for all seven views. |
| 16 | New dependency | None. Everything needed is already installed: three, R3F, drei, postprocessing, framer-motion, zustand. |
| 17 | Explore controls | drei `OrbitControls` with no pan and with zoom handled by the engine, plus engine drag handles that win over orbit when hit. |
| 18 | Broadcast elements kept | Only these: the chapter chip styled as a corner bug, the Hopper ticket (result chip) with a "DRAW N" kicker, one HUD telemetry chip, and the slate loading screen. Nothing else from the broadcast package. |
| 19 | Caption length | Title of 30 characters or fewer; body of 140 or fewer (target 130 or fewer). At most 3 body lines at 390 px and 4 at 360 px. Enforced by the caption audit (C.15). |
| 20 | Scroll-driven storytelling | Not used. It is a story player (autoplay, stepping, scrub) with a normal scrolling Notes section below the stage. |

---

## B. Global visual system

### B.1 Tokens

All story tokens live in `fitness.css` under `.st-root` (the FitnessApp root). The stage, caption card, transport, labels, sheets over the stage, and explore panel are ALWAYS dark: they use `--st-*`. Page chrome (the top bar, Notes, footer, chapter sheet) uses the existing theme tokens (`--app-bg`, `--panel-*`, `--text-*`) and must look right in both themes.

**Colour**

| Token | Value | Use |
|---|---|---|
| `--st-ink` | #070a0e | stage base, label halo, SDF ink |
| `--st-slate-top` | #0c1511 | backdrop gradient top |
| `--st-slate-bottom` | #060809 | backdrop gradient bottom |
| `--st-glow` | #0f2a1a | backdrop radial glow, mixed 15% toward the chapter accent |
| `--st-glass` | rgba(10,14,12,0.74) | caption card, sheets over the stage, HUD chip |
| `--st-glass-border` | rgba(238,243,246,0.08) | 1px glass border |
| `--st-line` | rgba(238,243,246,0.12) | dividers, inactive chip border |
| `--st-chalk` | #eef3f6 | titles, names, construction |
| `--st-body` | #c9d3cf | caption body text |
| `--st-muted` | #8ea0a8 | ticks, eyebrows (secondary), hints |
| `--st-accent` | #91c640 | the claim, active states, focus ring, progress |
| `--st-accent-hover` | #a8d35e | text-link hover, pressed chips |
| `--st-cta` | #019644 | solid buttons only, with white text |
| `--st-label-plate` | rgba(7,10,14,0.82) | callout pill background |
| `--st-scrim` | linear-gradient(90deg, rgba(7,10,14,0.85) 0, rgba(7,10,14,0) 38%) | desktop left scrim |
| `--st-vignette` | radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%) | CSS vignette over the canvas |

Chalk alphas in 3D: grid 12%, axes 55%, ticks 60%, hatch 25%, dimmed (focus pull) 35%.

Data colours are always `PAL` and are never re-themed:
- skill classes: trained, practiced, both
- domains: weightlifting, gymnastics, monostructural, oddObject, unknown
- engines: phosphagen, glycolytic, oxidative
- continuum: sick, well, fit, robust, and `spectrum()`

**Type scale** (fixed pixel sizes; nothing scales with 3D depth)

Fonts: add Barlow 500 and 600 to the existing Google Fonts `@import` in `fitness.css` (`family=Barlow:wght@500;600`). That is the only font addition. Anton, Barlow Condensed, Inter, Poppins and JetBrains Mono are already loaded.

| Token | Font | Phone (360 / 390+) | Desktop | Use |
|---|---|---|---|---|
| `display-sdf` | Anton TTF via drei Text | world units | world units | the SDF words listed per chapter |
| `caption-title` | Anton 400, uppercase, tracking 0.01em, lh 0.98 | 24 / 26 px | 36 px | beat title (1 or 2 lines) |
| `caption-body` | Barlow 500, lh 1.42 | 14.5 / 15.5 px | 17 px (lh 1.5) | beat body, colour `--st-body` |
| `eyebrow` | Barlow Condensed 600, uppercase, tracking 0.22em | 11 px | 12 px | "03 ENERGY SYSTEMS", in the chapter accent |
| `step` | JetBrains Mono 500, tabular | 11 px | 12 px | "2 / 6" |
| `label-callout` | Barlow Condensed 600, uppercase, 0.06em | 13 px | 14 px | claim pills |
| `label-name` | Barlow Condensed 600, uppercase, 0.05em | 12 px | 13 px | skill, marker, athlete, domain names |
| `label-tick` | JetBrains Mono 500, tabular | 11 px | 12 px | ticks, values. **11 px is the absolute floor anywhere** |
| `readout` | JetBrains Mono 600, tabular | 20 px | 26 px | counting numbers in the HUD chip and callouts |
| `ui` | Barlow Condensed 600, uppercase, 0.08em | 13 px | 13 px | chips, buttons, pills |
| `notes-body` | existing theme typography (Poppins) | 15 px / 1.65 | 16 px / 1.7 | Notes below the stage |

SDF fonts are always `import.meta.env.BASE_URL + 'fonts/Anton-Regular.ttf'`, `'fonts/BarlowCondensed-SemiBold.ttf'` or `'fonts/BarlowCondensed-Bold.ttf'`.

**Spacing** (4 px grid): 4, 8, 12, 16, 24, 32, 48, 56. Phone side gutter 10 px for the card and 16 px for Notes.

**Radii**:
- caption card 18
- sheets 20 (top corners)
- callout pill 6
- chips and pills 999
- chapter tiles 14
- HUD chip 12
- round buttons 50%

**Shadow** (glass only): `0 12px 40px rgba(0,0,0,0.45)`.

**Z order inside the stage**:

| Layer | z |
|---|---|
| canvas | 0 |
| CSS vignette | 1 |
| SVG leader lines | 2 |
| labels | 3 |
| intro tiles / explore handle hints | 4 |
| HUD chip | 5 |
| caption card and transport | 6 |
| slate | 8 |
| sheets | 10 |
| top bar (outside the stage) | 20 |

**Easing tokens** (the JS in `story/ease.ts` and the CSS use the same names)

| Token | JS | CSS approximation | Use |
|---|---|---|---|
| `draw` | inOutCubic | cubic-bezier(0.65,0,0.35,1) | line draw-on (arc-length parametrised) |
| `settle` | outQuint | cubic-bezier(0.22,1,0.36,1) | growth, labels, camera arrival, UI enter |
| `snap` | outBack(1.35) | cubic-bezier(0.34,1.56,0.64,1) | bricks, pins, dots landing |
| `morph` | inOutQuart | cubic-bezier(0.76,0,0.24,1) | topology morphs, camera moves |
| `count` | outQuad on the value | n/a | numbers |
| `exit` | inCubic | cubic-bezier(0.4,0,1,1) | UI exit |
| `linear` | identity | linear | time-true sweeps (cursor, draw clock) |

**Durations**

| Motion | Duration |
|---|---|
| UI micro | 160 ms |
| label fade | 220 ms |
| caption swap | out 160 ms, in 220 ms |
| construction draw | 400 to 700 ms |
| element build | 600 to 900 ms |
| data draw | 900 to 1800 ms |
| morph | 1400 to 2000 ms |
| camera | 1100 to 1600 ms, inside the beat's `camWindow` (default the first 35% of the beat) |
| beat build | 3.5 to 6.5 s |
| next glide | 350 ms |
| prev rewind | 450 ms |
| chapter fade | 300 ms out plus 300 ms in |

**Staggers**: spokes 60 ms, ticks 30 ms, bricks 35 ms, task dots 70 ms, rows 80 ms, tiles 50 ms.

### B.2 Phone shell (design at 390x844; check 360x780 and 430x932)

```
y=0    +--------------------------------------------+ safe-area-inset-top
       | (PA) WHAT IS FITNESS?   [03|ENERGY v]  (*) |  top bar 48px, theme-aware
       |=========|=========|====------|.....|.....|  |  2px lesson progress (6 segments)
       |                                            |
       |          FOCUS RECT (about 390x536)        |  STAGE: full bleed, always dark,
       |   camera director fits each beat here;     |  canvas fills the whole stage incl.
       |   labels clamp here; HUD chip top-right    |  behind the caption card
       |                                            |
       | +----------------------------------------+ |
       | | ====|====|==---|-----|-----|-----       | |  beat segments (3px, 24px hit area)
       | | 03 ENERGY SYSTEMS                2 / 6  | |  eyebrow + step
       | | PHOSPHAGEN                              | |  caption-title
       | | Stored ATP and creatine phosphate.      | |  caption-body, max 3 lines at 390
       | | Immediate, explosive power, but the ... | |
       | | ( < )   (( || ))   ( > )     [EXPLORE]  | |  transport row, 44px targets
       | +----------------------------------------+ |  card: 10px inset, 18px radius
y=844  +--------------------------------------------+ safe-area-inset-bottom
         v Notes (page continues, theme-aware)
```

**Top bar** (48 px plus `env(safe-area-inset-top)`, sticky, theme-aware using the existing `.wf-topbar` look), left to right:
- The PA mark: a 28 px white circle with `BASE_URL + 'pa-logo.png'`.
- The wordmark "WHAT IS FITNESS?" in Anton 16 px, with FITNESS? in #91C640. It is hidden below 375 px width.
- The **chapter chip** (the corner bug): a 44 px tall button. It holds an accent tab with the chapter number in Anton 15 px in `--st-ink` on `MODULES[i].accent` (radius 4), then `mobileLabel ?? label` in `ui` type, then a 12 px chevron SVG. On the intro it reads "OVERVIEW". It opens the Chapter sheet.
- `ThemeToggle` in a 44 px hit box.

The horizontal nav row that clips "CONTINUUM" today is removed on phones.

**Lesson progress** is a 2 px hairline under the top bar with 6 segments (skills through health; the intro is not counted) and 3 px gaps:
- Completed chapters: #019644.
- Current chapter: fills by `(index + t) / beats` in `MODULES[i].accent`, written through a ref transform.
- Remaining chapters: `var(--panel-border)`.

Completion is a per-viewer convenience in `localStorage['wf.story.done']`, with every access wrapped in try/catch.

**Stage**: `height: calc(100svh - 48px - env(safe-area-inset-top))` (with a `100dvh` fallback), min 520 px, full bleed, background `--st-ink`.
- Story mode: `touch-action: pan-y`, so vertical swipes scroll the page to the Notes.
- Explore mode: `touch-action: none`.

**Caption card**: left, right and bottom inset 10 px, plus `env(safe-area-inset-bottom)`. `--st-glass` with `backdrop-filter: blur(16px) saturate(140%)`, a 1 px `--st-glass-border`, radius 18, padding 12 px top, 14 px sides, 10 px bottom. It is an `aria-live="polite"` region (title plus body). Three detents, dragged on y from the card's top band: the 28x4 px grab handle and the scrubber band over the eyebrow row, both `touch-action: none` so a real finger drag reaches the detent logic while the body stays `pan-y` (H.47). Tapping the handle toggles default and peek (from expanded it returns to default); on phones a "Read more" link ends the caption body and opens the expanded detent:

| Detent | Height at 390 | Contents |
|---|---|---|
| peek | about 136 px | segments, eyebrow row, title (1 line, ellipsis), transport |
| default | auto; about 208 px with a 1-line title, about 236 px with 2 lines; never more than 38% of the stage | segments, eyebrow, title, body, transport |
| expanded | 72% of the stage | default contents plus a scrollable "Read more" block with the chapter's `MODULE_COPY` body and key points |

The camera director re-fits whenever the detent changes. The detent persists within the session.

**Transport row** (inside the card, 44 px tall):
- prev: a 44 px ghost circle.
- play/pause: a 48 px circle with a 2 px ring showing build-plus-hold progress, drawn with SVG `stroke-dashoffset` through a ref.
- next: a 44 px circle.
- A flexible spacer.
- **Explore**: a 44 px tall pill, outlined in #019644 with chalk text. On the last beat, once its build ends, it becomes solid #019644 with white text.

On the last beat, after the build, the card also shows a second row of two CTAs: "Explore this model" (outline) and "Next: 04 Work Capacity" (solid #019644; the label is `MODULES[i+1].num` plus `label`). The two share the row and shrink (never overflow the card or the viewport, at any width or in landscape); no tag is added to the label (H.35).

**Focus rect**: the stage rect minus 8 px at the top, minus everything from the caption card's top edge down, minus 12 px padding on the sides and 8 px above the card. At 390x844 with the default detent and a 2-line title, that is about 366x530. It is computed live by a ResizeObserver on the stage and the card.

**360 px**: the title is 24 px, the body 14.5 px, and the wordmark is hidden. The body may take 4 lines. **430 px**: same sizes as 390; the focus rect simply grows.

**Safe areas**: `index.html` has no `viewport-fit=cover`. FitnessApp appends `, viewport-fit=cover` to the viewport meta on mount and restores the original content on unmount, which leaves other pages untouched.

### B.3 Desktop (1440x900), landscape phone, tablet

**Desktop, at 1024 px wide and above:**
- The existing top bar (numbered chips, Games Almanac, WOD Intel, ThemeToggle) with the progress hairline directly under it. Each chip's underline shows that chapter's completion.
- The stage is full width, with `height: calc(100svh - 56px)`, min 640 px. The scene is never boxed.
- The caption card is a left column: left 56 px, bottom 48 px, width 400 px. The title is Anton 36 px, the body Barlow 17 px/1.5, and the transport is inside the card, as on the phone.
- Behind the card is the `--st-scrim` gradient.
- Under the card is a mono 11 px `--st-muted` hint: "Left / Right to step - Space to play - E to explore".
- Focus rect: x from 500 to W-56, y from 72 to H-56 (about 884x772 at 1440x900).
- Detents do not apply on desktop. The card is always "default" plus an inline "Read more" disclosure.

**Landscape phone** (stage aspect above 1.3 and height below 500):
- The top bar is 44 px.
- The caption card becomes a left column, width min(44%, 340 px), full stage height minus 16 px, transport inside, body scrollable.
- The focus rect is the right side.

**Tablet portrait** (768 px and wider, stage aspect below 0.9): the phone layout with the card max-width 560 px and centred, and type one step up (title 30, body 16.5).

**Layout orientation for scenes**: `layout = focusRect.w / focusRect.h < 0.95 ? 'P' : 'L'` (on the phone shell the threshold is 1.3, so a portrait iPhone in Safari keeps its P poses; H.55). This uses the FOCUS RECT, not the viewport, so desktop (about 1.15) is L and a phone in portrait is P. Scenes choose layout constants from this flag, and the camera director picks the P or L pose.

### B.4 Explore mode UI

Explore can be entered from the Explore pill, the E key or `?explore=1`, and is reachable from any beat.

- **Phone**: the caption card morphs in place (260 ms, `settle`) into the **controls sheet**, the same glass in the same position:
  - peek (about 132 px): the primary control (usually one chip row) plus [Back to story] [Reset view];
  - expanded (60% of the stage): all controls, readouts and the legend, scrollable.
- **Desktop**: the left card becomes the controls panel, 400 px wide, with max-height `calc(100% - 96px)`, scrollable.

Rules for controls:
- Every control is at least 44 px in the bottom thumb zone. Nothing is hover-only.
- Chip rows scroll horizontally with a 16 px fade mask at both edges.
- The existing `ui.tsx` widgets (Segmented, Slider, PresetButtons, Readout, Bar, Legend) are reused and restyled to `--st-*`. Sliders get 44 px hit areas.
- On entering explore, each drag handle pulses once (a 600 ms ring). This is its affordance hint.
- "Back to story" tweens the camera back to the beat pose over 900 ms and restores the caption card.

### B.5 Chapter sheet (navigation)

A theme-aware bottom sheet on the phone, and a popover under the chip on desktop. It has:
- Overview plus six rows, each 64 px tall;
- in each row, a 40 px inline-SVG glyph built from the same shape generators as the intro (`kit/shapes.ts`, via `toSvgPath`), then `num` in Anton 18 px in the accent, `label` in Barlow Condensed 600 16 px, the `blurb` on one line at 13 px, and a check mark when the chapter is completed;
- the current row highlighted with a 2 px accent left border.

Tapping a row closes the sheet and navigates with the chapter fade.

### B.6 Below the stage: Notes (theme-aware, normal page scroll)

Max width 760 px, 16 px gutters on the phone. In order:
1. Eyebrow (`MODULE_COPY[k].eyebrow`) and chapter title (`MODULES[i].title`, Anton 28 px phone / 40 px desktop), then `MODULE_COPY[k].body`.
2. Key points (existing `KeyPoints`).
3. **Story transcript**: a numbered list of every beat's title and body. Tapping one scrolls the stage into view and seeks to that beat (held, t = 1). Under reduced motion it is expanded by default; otherwise it is a collapsed `<details>` labelled "Story transcript".
4. Keep exploring (`CROSS_LINKS`, existing `CrossLinks`).
5. Grounded in (`sourcesFor(k)`, existing `SourceList`).
6. Previous / Next chapter cards (existing LessonNav), then the existing footer and disclaimer.

**Intro Notes (the hub)**: DEFINITION_TEXT card, HUNDRED_WORDS card, the six chapter cards (glyph, num, label, blurb) and all SOURCES. This is the current IntroView content, restyled.

An IntersectionObserver on the stage pauses the story and sets the Canvas `frameloop="never"` while the stage is less than 10% visible, and restores both when it returns (battery).

### B.7 Slate, HUD chip, result chip, fallbacks

- **Slate** (chapter loading and chapter change): a DOM layer over the stage showing:
  - the backdrop gradient;
  - the PA mark (40 px);
  - the chapter number in Anton 56 px in the accent;
  - the chapter label in `ui` type;
  - a 2 px accent progress line.

  It shows while the chapter chunk, `document.fonts.ready`, the SDF fonts (each SdfText in its own Suspense, H.39) and the shader prewarm (`gl.compile(scene, camera)` plus two frames, H.39) complete, or the readiness timeout of H.39 passes. It fades out over 300 ms after the first real frame. The intro additionally shows a DOM "WHAT IS FITNESS?" title in the slate, so its first frame is never blank.
- **HUD chip**: at most one, top-right of the focus rect: `--st-glass`, radius 12, padding 8/10, at most 2 lines (an `eyebrow` line plus a `readout` line). It is registered as a label obstacle. The contents per chapter are in section D.
- **Result chip** (Hopper ticket, Pathways stud): see those chapters.
- **No WebGL, or a context lost and not restored within one retry**: the story still runs. Captions, transport, scrubbing and Notes all work. The stage shows the slate with the chapter's SVG glyph at 160 px and the line "3D view unavailable on this device. The full lesson text is below." (UI copy, not a claim).

### B.8 Label tones (DOM)

| Tone | Look |
|---|---|
| `tick` | naked `label-tick` text in `--st-muted`, with a halo `0 0 3px #070a0e, 0 0 1px #070a0e` |
| `name` | naked `label-name` text in chalk, with a 7 px dot in the data colour on the anchor side |
| `callout` | pill: `--st-label-plate` background, a 1 px border in the data colour at 60%, radius 6, padding 3 px 8 px, `label-callout` text in the data colour (or #91C640 for claims); optional 1 px chalk leader line at 50% (SVG) to its anchor |
| `readout` | callout pill with `readout` digits; width reserved from `minChars` so counting never changes its width |
| `legend` | a row of 2 or 3 small swatch chips pinned to the top-left of the focus rect (not anchored to world), for example the Trained / Practiced / Both key |

### B.9 3D materials and lighting (engine-owned factories in `story/kit/materials.ts`; builders never write their own versions)

- **Backdrop**: a fullscreen triangle, `renderOrder -1000`, `depthTest false`, `depthWrite false`, `frustumCulled false`. Shader:
  - a vertical gradient from `--st-slate-top` to `--st-slate-bottom`;
  - a radial glow of `--st-glow`, mixed 15% with the chapter accent, centred on the focus-rect centre (uniform in NDC), radius 0.9 of the focus-rect diagonal, strength 0.22;
  - value noise at amplitude 0.02 for a slate grain.

  It is rendered inside the scene so bloom and tone mapping see it.
- **Pen** (the signature primitive): `LineSegments2` + `LineMaterial` with screen-pixel widths, `worldUnits false`.

  | Role | Width |
  |---|---|
  | grid | 1.25 px |
  | axes and ticks | 2 px |
  | data lines | 3 px |
  | hero / pen line | 4.5 px |

  One draw call per role: spokes, rings and ticks merge into one `LineSegments2` with vertex colours.
  - **Draw-on** sets `geometry.instanceCount = floor(progress * segCount)`, which is exact under seek and never reallocates.
  - **Head**: an additive sprite at the fractional point (`sizeAttenuation false`, 10 px at DPR 1, a 64 px radial-gradient CanvasTexture made once by the engine). Colour #f4ffe0 x 2.2, `toneMapped false`. It is the default speaking element (L4).
  - **Tail glow**: a per-segment `instanceArc` (vec2 start/end normalised arc length) plus an `onBeforeCompile` tweak brightens the last 8% of the drawn length toward the head colour (x1.6). Once the stroke completes, the glow decays to the data colour over 300 ms of story time.
  - **Resolution**: the engine updates `material.resolution` for every registered pen material on resize and on DPR change.
- **Fill** ("chalk-dust gradient"): a ShaderMaterial on an area strip with attributes `aT` (0 at the baseline, 1 at the data edge) and `aU` (0..1 along x).
  - Alpha is `mix(0.06, 0.50, aT)` multiplied by `uOpacity`.
  - Reveal: `discard` when `aU > uReveal`, or when the fragment y is above `uLevel` (pour on LOW).
  - Hatch mode (for gaps and deficits): `step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / (7.0 * uDpr)))` at 25% chalk.
  - `depthWrite false`, explicit `renderOrder`.
- **LightField** (constant-density particles, L9): one `THREE.Points` with a ShaderMaterial.
  - Attributes: `aSlot` (vec2: chart-space u, v on a jittered stratified grid over the chart box) and `aSeed` (vec4).
  - Curves enter as uniforms `uA[32]` and `uB[32]` (vec4 arrays, 128 samples, linearly interpolated in the shader; no float textures, so it is iOS-safe), plus `uMix`.
  - A particle is lit when `v < level` and `v < curve(u)`.
  - Modes, all driven by uniforms from T:
    - `pour`: a particle falls 3 chart units into its slot over 0.35 of its window as the level reaches it;
    - `spill`: inside A but not B, it falls and fades, tinted `PAL.sick`;
    - `condense`: inside B but not A, it fades in from 0.4 above, tinted `PAL.both`.
  - Point size 2.2 px x DPR, round with a hot core. Additive blending, `depthWrite false`.
  - Counts per tier are in the chapter sections. LOW uses the Fill instead.
- **rimStandard**: `MeshStandardMaterial` plus an `onBeforeCompile` fresnel rim added to emissive: `rim = pow(1.0 - saturate(dot(N, V)), 3.0) * uRimStrength * uRimColor`. Defaults: rim #91C640 at strength 0.35 (data solids use their data colour). Used for the skills prism, pins, the continuum orb, bricks and tiles.
- **steel** (hopper hoops and bars): `rimStandard` with metalness 0.95, roughness 0.28, colour #9aa4a8, rim #91C640 at 0.2.
- **ballMaterial** (hopper balls): `rimStandard` with metalness 0.1, roughness 0.35, the domain colour, emissive x0.25 of that colour.
- **Surface** (health): `MeshStandardMaterial` with vertex colours plus `onBeforeCompile`:
  - world-y isolines every 0.1 of capacity (`fwidth`-based, 1 px, chalk at 18%);
  - below the independence height, colour mixed 55% toward `PAL.sick` plus the hatch;
  - roughness 0.55, metalness 0.05.
- **Blob shadow**: one plane with a 64 px radial alpha CanvasTexture, `depthWrite false`, under solids only (H.43: `<BlobShadow>`, instanced, the same radial falloff computed in the shader). No shadow maps, no ContactShadows, no gridHelper anywhere.
- **Environment**: engine-owned, mounted once at the Canvas root:

  ```
  <Environment resolution={128} frames={1} background={false}>
    key softbox:  rect, intensity 2.2, #ffffff, scale [10,4],    position [0,6,-4], target [0,0,0]
    brand rim:    rect, intensity 1.2, #91c640, scale [6,0.4],   position [-6,1,3], target [0,0,0]
    cool strip:   rect, intensity 0.9, #38bdf8, scale [6,0.4],   position [6,2,-3], target [0,0,0]
    floor bounce: ring, intensity 0.6, #eef3f6, scale 3,         position [0,-4,2], target [0,0,0]
  </Environment>
  ```

  `scene.environmentIntensity = 0.9` on all tiers (one bake, no recompiles on a tier change). Also one `directionalLight` (#ffffff, 0.8, position [4,8,6], no shadows) and a `hemisphereLight` (#dfe8e3 over #0b120e, 0.35), both engine-owned.
- **Fog**: only in Hopper and Health (`FogExp2('#070a0e', 0.018)`), set by `useChapterFog` on mount and cleared on unmount. Charts have no fog.
- **Nodes**: instanced icosahedron (detail 2) spheres (superseded by H.42: instanced IMPOSTOR spheres, round at any DPR, one call). A "live" node's colour is x1.8 with `toneMapped false` (it blooms) only when it is the speaking element.

### B.10 Post-processing (engine-owned `quality/Post.tsx`; chapters never add effects)

One `<EffectComposer frameBufferType={HalfFloatType} stencilBuffer={false} enableNormalPass={false}>` wraps the whole persistent scene. Its `multisampling` default is 8, so it must be set explicitly. The effect list is static per tier. Effects are never mounted or unmounted mid-story; animate their uniforms instead.

| Tier | DPR range | Composer | Bloom | Tone map | Grain | AA |
|---|---|---|---|---|---|---|
| HIGH | 1 to min(devicePixelRatio, 2) | on, `multisampling={4}` if `gl.capabilities.maxSamples >= 4`, else 0 plus SMAA | `mipmapBlur`, luminanceThreshold 1.0, luminanceSmoothing 0.1, intensity 0.85, radius 0.72, levels 7 | `ToneMapping mode={NEUTRAL}` | `Noise` opacity 0.035, SOFT_LIGHT, premultiply | MSAA 4 |
| MEDIUM (phone default) | 1 to 1.5 | on, `multisampling={0}` | same as HIGH but intensity 0.8, levels 5, `resolutionScale 0.5` | NEUTRAL | off | `SMAA` (preset MEDIUM), last |
| LOW | 1 | `enabled={false}` (R3F auto-renders; no positive-priority callback exists) | none; every element flagged `hot` gets an engine halo sprite instead | renderer `THREE.NeutralToneMapping` | off | context `antialias: true` |

Rules:
- Effect order is Bloom, ToneMapping, Noise, SMAA.
- Set the renderer `toneMapping = THREE.NeutralToneMapping` once in `onCreated`, and do not use the Canvas `flat` prop. Three.js does not tone map render targets, so composer tiers are tone-mapped once by the effect, and LOW once by the renderer.
- The foundation lead verifies this with a swatch test: a #91C640 unlit plane must read within 3 RGB units of (145,198,64) on MEDIUM and on LOW.
- **Vignette** is the CSS `--st-vignette` overlay on every tier (no GPU cost).
- **Impact accent**: at most one per chapter, at the resolving data moment named in section D. It is `bloom.intensity += 0.6 * sin(pi * k)` and the speaking element's emissive x1.8, where k = cue over a 0.12-long window of beat t. It is driven through the Bloom effect ref and uniforms, and disabled under reduced motion.

### B.11 Motion language

- Things arrive in these ways only:
  - lines draw on with the pen;
  - shapes grow radially from their origin with a stagger around the ring;
  - bricks, pins and dots drop and `snap`;
  - areas either sweep (a vertical front moves left to right, and the readout counts the running integral) or pour (light rises into the shape, only where L9 applies);
  - morphs interpolate resampled point sets (256 points, arc-length resampled, same start angle and winding) with a stagger along the index so the morph flows.
- **Say it, then show it.** The caption swaps at t = 0: the old one moves up 8 px and fades over 160 ms, and the new one enters from 8 px below over 220 ms (framer-motion `AnimatePresence`). The scene build starts 150 ms of wall time later. Beat cue windows are authored in t, and the engine offsets t by 0.03 of the beat for this.
- **Colour-linked terms**: a beat's `terms` map colours words in the caption body with the data colour of the element being built (for example "Phosphagen" in `PAL.phosphagen`). In explore mode, tapping a coloured term pulses its element for 600 ms.
- **Ambient life** is limited to: drum spin and ball tumble (hopper), river flow (energy), and the slow turn of the health tile in the intro map. Pointer parallax on desktop (at most 2 degrees az and 1.5 degrees el, damped at k = 4/s) runs only in unheld story mode. There is no gyro and no idle drift on phones.

### B.12 Mobile look and feel

- Every button and chip is 44 px or more. Pressed state: scale 0.97 plus brightness 1.1, 120 ms.
- `navigator.vibrate(8)` fires on user-initiated beat steps and scrubber beat-boundary crossings where supported (a no-op on iOS). Never under reduced motion.
- No hover-only affordances. Hover only adds emphasis.

### B.13 Adaptive chart frame (makes 2D charts fill any focus rect)

Charts (Pathways, Definition, the Hopper thread chart, and the Continuum parallel rows) are authored in chart space (u from 0 to 1 along x, v from 0 to its max along y) and mapped to world by `useChartFrame({ FH, minAspect, maxAspect, marginPx })`.
- FH is the frame height in world units.
- `FW = FH * clamp(effectiveAspect, minAspect, maxAspect)`, where `effectiveAspect` is the focus rect aspect after subtracting the label margins (`marginPx`: left, bottom, top, right).
- It returns `{ FW, FH, x(u), y(v), box }`.
- It is recomputed only on resize, orientation or detent change, never per frame.

So on a 390 px phone the Energy chart is tall (about 0.8 aspect), and on desktop it is about 1.2. Axes are always labelled, so aspect is an honest presentation choice.

---

## C. Engine API

### C.1 File layout

```
src/fitness/story/
  types.ts            V3, Box, CamPose, CamSpec, Beat, StoryDef, Tier, Mode, Detent, LabelSpec
  ease.ts             easing tokens (draw, settle, snap, morph, count, exit, linear)
  rng.ts              mulberry32(seed), hash1(i), hash2(i, j)
  clock.ts            the mutable story clock + advance(dt) + glides
  store.ts            zustand story store (discrete state only)
  cue.ts              cue(), cueBeat(), stagger(), useCueState()
  url.ts              parse/write ?beat ?t ?explore ?tier ?motion ?detent; BASE-aware paths
  StoryProvider.tsx   provides the active StoryDef; registers window.__story
  useBeat.ts          useBeat() hook (ref-based)
  playback.ts         autoplay state machine (build -> hold -> advance), interaction pause
  gestures.ts         stage swipe / tap / press-and-hold; explore handle hit-testing
  Stage.tsx           persistent StoryStage: Canvas, lights, Environment, backdrop, Post,
                      CameraDirector, LabelLayer, vignette, HUD slot, slate, fallback
  camera/CameraDirector.tsx  per-beat poses, fit, setViewOffset, explore handoff, parallax
  camera/fit.ts       fitDistance() binary search; pose interpolation
  labels/LabelLayer.tsx  DOM layer + SVG leaders; placement loop
  labels/useLabel.ts  useLabel(), useLabels(), setLabelText(), useObstacle()
  labels/place.ts     greedy collision placement (pure, unit-testable)
  quality/tiers.ts    TIERS table, initial tier
  quality/Quality.tsx PerformanceMonitor, DPR control, tier state
  quality/Post.tsx    EffectComposer per tier, bloom ref for impact accents
  quality/stats.ts    renderer.info snapshot (priority -1000) + stats()
  kit/materials.ts    backdrop, pen, fill, lightField, rimStandard, steel, ball, surface, blob, halo
  kit/Pen.tsx         <Pen/>, <PenBatch/>, <MorphPen/>
  kit/Fill.tsx        <AreaFill/>
  kit/LightField.tsx  <LightField/>
  kit/Halo.tsx        <Halo/> (glow sprite; LOW-tier bloom stand-in)
  kit/SdfText.tsx     <SdfText/> (drei Text with self-hosted fonts only)
  kit/counter.ts      useCounter()
  kit/tween.ts        mix, mixV3, morphPoints, resample(), arcLengths()
  kit/shapes.ts       underline, decagon, drumGlyph, humps, dialGlyph, curveGlyph, surfaceGlyph, toSvgPath
  kit/chartFrame.ts   useChartFrame()
  kit/axis.ts         logAxis (Pathways), intervalAxis (Definition, Health)
  ui/CaptionCard.tsx  card, detents, terms, CTAs
  ui/Transport.tsx    prev / play ring / next / explore
  ui/Segments.tsx     beat segments + scrubbing
  ui/ChapterSheet.tsx
  ui/ExplorePanel.tsx sheet/panel shell hosting StoryDef.Explore
  ui/Notes.tsx        below-stage content incl. transcript
  ui/Slate.tsx
  ui/Hud.tsx
src/fitness/stories/
  index.ts            lazy map: view -> story chunk, auto-discovered via import.meta.glob('./*/story.ts') (H.38)
  intro/   story.ts  Scene.tsx  Explore.tsx
  skills/  story.ts  Scene.tsx  Explore.tsx  skillsMath.ts
  hopper/  story.ts  Scene.tsx  Explore.tsx  hopperMath.ts  (seeded run + 64 threads)
  pathways/ story.ts Scene.tsx  Explore.tsx  pathwaysMath.ts
  definition/ story.ts Scene.tsx Explore.tsx definitionMath.ts
  continuum/ story.ts Scene.tsx Explore.tsx  continuumMath.ts
  health/  story.ts  Scene.tsx  Explore.tsx  healthMath.ts
```

Each `story.ts` exports a `StoryDef`. Beat copy lives in `story.ts`, so a reviewer can check every `source` against `fitnessData.ts`. The existing math moves verbatim into the `*Math.ts` files (see G).

### C.2 Types (`story/types.ts`)

```ts
import type { ComponentType } from 'react'
import type { FitnessView } from '../lessonTypes'
import type { PAL } from '../fitnessData'

export type V3 = readonly [number, number, number]
export type Box = readonly [V3, V3]                 // [min, max] world box
export type Layout = 'P' | 'L'                      // from the focus-rect aspect (B.3)
export type Tier = 'high' | 'medium' | 'low'
export type Mode = 'story' | 'explore'
export type Detent = 'peek' | 'default' | 'expanded'

export interface CamPose {
  target: V3 | ((layout: Layout, frame: ChartFrame) => V3)   // H.17
  az: number        // degrees; 0 = camera on +Z looking at target; + moves the camera toward +X
  el: number        // degrees above the target
  fov?: number      // vertical fov in degrees, default 30
  fit: Box | ((layout: Layout, frame: ChartFrame) => Box)     // must project entirely inside the focus rect minus padPx (H.17)
  padPx?: number | { l: number; r: number; t: number; b: number }  // default 24 on every side
}
export interface CamSpec {
  L: CamPose
  P?: CamPose                               // defaults to L
  window?: readonly [number, number]        // part of beat t used for the move, default [0, 0.35]
  keys?: readonly { t: number; L: CamPose; P?: CamPose }[]  // optional mid-beat keyframes (Definition D2)
}

export interface Beat {
  id: string                 // kebab-case, unique in the chapter
  title: string              // <= 30 chars
  body: string               // <= 140 chars, plain text
  terms?: Readonly<Record<string, keyof typeof PAL>>  // exact substring -> PAL key
  source: string             // e.g. "MODULE_COPY.skills.keyPoints[2]" (audit only, not rendered)
  eyebrow?: string           // overrides the default "NN LABEL" eyebrow (intro only)
  build: number              // seconds for t: 0 -> 1 during autoplay
  cam: CamSpec
  cta?: 'begin'              // intro last beat: "Begin the lesson" solid CTA
  impact?: readonly [number, number]  // t window of the chapter's single impact accent
}

export interface ExploreSpec {
  cam: CamSpec
  limits: { az: readonly [number, number]; el: readonly [number, number]; zoom: readonly [number, number] }
  scrubToggle?: boolean      // shows "Scrub | Orbit" (Pathways, Definition, Health)
  initFromBeat: (beatIndex: number) => void  // seed explore state from that beat's end state
}

export interface StoryDef {
  key: FitnessView
  beats: readonly Beat[]
  Scene: ComponentType                 // rendered inside the persistent Canvas
  Explore: ComponentType               // DOM content of the controls sheet / panel
  explore: ExploreSpec
  Hud?: ComponentType                  // DOM content of the HUD chip (writes via refs)
  fog?: { color: string; density: number }
  frame?: ChartFrameOpts               // H.17: engine-owned adaptive chart frame (B.13)
}
```

### C.3 Clock, store, playback

```ts
// story/clock.ts: ONE mutable object, never React state
export interface StoryClock {
  T: number        // global story time shown = index + t
  index: number    // floor(T), clamped to [0, beats-1]
  t: number        // T - index; 1 on the last beat's end
  A: number        // ambient seconds (L5)
  held: boolean    // true after a URL/QA/transcript seek until play() or navigation
  version: number  // increments whenever T or A changes (dirty checks)
}
export const clock: StoryClock
export function setT(T: number): void                       // exact; bumps version
export function glideTo(T: number, ms: number, ease: Ease): void // fixed-duration ramp, linear in T by default
```

```ts
// story/store.ts: discrete state only; components re-render on these
interface StoryState {
  view: FitnessView
  index: number
  playing: boolean
  phase: 'build' | 'hold' | 'done'
  mode: Mode
  detent: Detent
  tier: Tier
  dpr: number
  reduced: boolean
  ready: boolean
  interacting: number          // count of active holds (pointer down, scrub, detent drag, sheet open)
  play(): void; pause(): void; toggle(): void
  next(): void; prev(): void
  seek(n: number, t: number, opts?: { hold?: boolean }): void
  setMode(m: Mode): void; setDetent(d: Detent): void
  beginInteraction(): () => void   // returns the release function
}
```

**Playback state machine** (`playback.ts`; runs in the clock `useFrame` at priority -100):
- **build**: `t += dt / beat.build` (dt clamped to 0.1 s), until t = 1.
- **hold**: timer `hold = clamp(0.4 + 0.23 * words(title + body) - build, 2, 7)` seconds (H.30, superseding H.16: reading starts at the caption swap, so the whole build counts; a beat stays up for about 250 words per minute and never holds under 2 s). H.40 extends it for beats that declare `sceneWords` (read after the build) or `signature` (a 4 s floor): `clamp(max(caption term, 0.8 + 0.23 * sceneWords, signature ? 4 : 2), 2, 7)`. Then the next beat starts at t = 0. On the last beat the phase becomes `done`, and there is no auto-advance and no chapter auto-advance.
- The clock does not advance while `interacting > 0`, `mode === 'explore'`, `document.hidden`, or the stage is less than 10% visible. The hold timer resumes where it stopped.
- The play-ring progress is `(buildElapsed + holdElapsed) / (build + hold)`.
- **next()** during a build glides T to `index + 1` over 350 ms (`settle`), then continues playing beat index + 1. During a hold it steps immediately. On the last beat it navigates to the next chapter (chapter fade).
- **prev()** rewinds visibly to `(index - 1) + 0` over 450 ms, then plays if playing. On beat 0 at t < 0.15 it navigates to the previous chapter's beat 0.
- **Seek** (URL, QA, transcript, scrubber) sets T exactly with no glide and no spring.
- **Scrubber drag** calls `beginInteraction`, sets T continuously across the whole chapter (0 to beats), and leaves the story paused on release.
- **Ambient A** advances by dt only when `playing && !held && !reduced` in story mode, or in explore mode. On any seek, hold, or reduced motion, `A = T * 2.5`.
- **Captions** re-render only when `index` changes.
- **Reduced motion**: see C.13.

### C.4 URL, QA contract, readiness

- `?beat=N&t=X` (N zero-based, X clamped to 0..1): renders beat N at progress X and HOLDS it: no autoplay, `A = T * 2.5`, parallax off, the camera snapped with no tween, the caption shown without its enter animation. `play()` clears the hold and removes `beat` and `t` from the URL with `replaceState`.
- `?explore=1`: opens explore mode at the end state of the last beat, or of beat N if `beat` is also given. The camera is at that beat's pose.
- `?tier=high|medium|low` pins the tier and disables the PerformanceMonitor. **Reviewer screenshots must pass it** (`&tier=medium` on the phone, `&tier=high` on desktop), because headless SwiftShader would otherwise decline to LOW.
- `?motion=reduce|full` overrides `prefers-reduced-motion` (QA).
- `?detent=peek|default|expanded` sets the phone detent (QA).
- Chapter navigation drops the whole query string.
- `window.__story`, re-registered on every chapter mount:

```ts
interface StoryQA {
  view: FitnessView
  beats: { id: string; title: string; build: number }[]
  seek(n: number, t: number): void        // holds; calls invalidate() so demand/never frameloops redraw
  play(): void; pause(): void; next(): void; prev(): void
  explore(on?: boolean): void
  state(): { index: number; t: number; T: number; playing: boolean; held: boolean; mode: Mode;
             tier: Tier; dpr: number; reduced: boolean; detent: Detent; layout: Layout }
  stats(): { calls: number; triangles: number; geometries: number; textures: number;
             tier: Tier; dpr: number; points: number; lines: number; programs: number }
  labels(): { id: string; text: string; x: number; y: number; w: number; h: number;
              visible: boolean; opacity: number; clipped: boolean; overlaps: string[] }[]
  ready: boolean
}
```

- **Readiness**: the stage root has `data-story-ready="0"` from chapter change until ALL of these are true, when it becomes `"1"` (and `__story.ready = true`):
  - the chunk is loaded;
  - `document.fonts.ready` has resolved;
  - the SDF fonts have resolved (Suspense);
  - `gl.compileAsync(scene, camera)` has resolved (H.39: the synchronous `gl.compile` plus two frames; a readiness timeout never leaves a chapter on the slate);
  - two frames have rendered after the latest seek.

  Every seek sets it back to "0" until two frames later.

  (H.15) Two separate flags: **loaded** (store, one-way per chapter: chunk, fonts, SDF, compile, first frames) drives the slate and autoplay and is never reset by a seek; **settled** (QA only) is loaded plus two frames after the latest seek, written straight to `data-story-ready` and `__story.ready` with no React state. A seek or a scrub never brings the slate back.

### C.4b Provider

```ts
// story/StoryProvider.tsx
export function StoryProvider(props: { def: StoryDef; children: ReactNode }): JSX.Element
  // resets the clock and store for def.key, applies the URL query once, registers window.__story,
  // sets the chapter fog, and publishes def through context
export function useStory(): StoryDef          // the active chapter definition
export function useStoryStore<S>(sel: (s: StoryState) => S): S   // zustand selector
```

`FitnessApp` renders `<StoryProvider def={activeDef}>` around the `StoryStage` and the `Notes`, so the caption card, transport, Notes transcript and Scene all read the same definition.

### C.5 Scene hooks (`useBeat`, `cue`)

```ts
export function useBeat(): {
  clock: StoryClock                                     // stable ref, read inside useFrame
  cue(a: number, b: number, ease?: Ease): number        // global-T window, eased 0..1
  at(n: number, a: number, b: number, ease?: Ease): number // = cue(n + a, n + b): beat n, t from a to b
  focus(n: number): number                              // L3 focus-pull multiplier for elements born in beat n
  layout: Layout                                        // re-renders only on layout change
}
export const cue: (T: number, a: number, b: number, ease?: Ease) => number
export const stagger: (T: number, a: number, b: number, i: number, n: number, spread?: number) => number
export function useCueState<S>(fn: (T: number) => S): S  // setState only when the value changes
```

- `focus(n)` returns 1 while T is before beat n+1; during a later beat's build window [n', n' + 0.6] it eases to 0.35, then back to 1 by n' + 1. Elements multiply their opacity by it.
- **Continuity contract**: the scene at (N, t = 1) equals the scene at (N + 1, t = 0). This holds automatically when every property is a function of T built from `cue` windows. Each chapter adds a dev assertion that samples 20 uniforms/positions at both points and compares them.
- **Scene rules**, enforced by a grep gate in C.15:
  - Per-frame work happens inside `useFrame` and writes to refs.
  - No React state per frame.
  - Geometry and materials are created in `useMemo` and disposed in `useEffect` cleanup.

### C.6 Gestures (`gestures.ts`, one model for the whole stage, gated by mode)

Story mode, on the stage:
- **Horizontal swipe**: |dx| > 48 px, |dx| > 1.5 |dy|, duration under 600 ms. Left is next, right is prev.
- **Vertical movement** is left to the browser (`pan-y`).
- **Single tap** (under 250 ms, movement under 8 px) toggles pause and flashes a 56 px play/pause glyph for 400 ms at the focus-rect centre.
- **Press and hold** (at least 350 ms, movement under 8 px) pauses while held and resumes on release if it was playing.
- In the intro's last beat, taps on a chapter tile go to the tile (the tiles are DOM buttons above the canvas).

On the caption card:
- A horizontal swipe does the same as on the stage.
- A vertical drag moves between detents.

Desktop keyboard (ignored while focus is in an input):
- Left / Right: step
- Space: play or pause
- Home / End: first or last beat
- E: explore
- Esc: back to story, or close the sheet
- The wheel is never captured in story mode.

Explore mode:
- The stage uses `touch-action: none`.
- A capture-phase `pointerdown` on the stage root hit-tests registered handles (`useDragHandle`, C.12) within 22 px of their projected anchor. On a hit it calls `stopPropagation` (OrbitControls never sees it) and drags. Otherwise OrbitControls orbits.
- Two-pointer pinch, or ctrl+wheel (trackpad pinch), scales the distance within `limits.zoom`. OrbitControls has `enableZoom false` and `enablePan false`.
- With the "Scrub | Orbit" toggle set to Scrub, every drag goes to the view's scrub handler and orbit is off.
- Swipes do not step beats in explore mode.

### C.7 Caption card (`ui/CaptionCard.tsx`)

- **Props**: `{ def: StoryDef; index: number }`.
- It renders the eyebrow (`beat.eyebrow ?? MODULES[i].num + ' ' + MODULES[i].label`, uppercase, for example "03 ENERGY SYSTEMS"), the step "n / N", the title, and the body with `terms` coloured.
- `AnimatePresence` keyed by `beat.id` handles the swap.
- It reads the detent from the store and reports its rect to the focus-rect computation through a ResizeObserver.
- It hosts the Transport (C.3) and, on `phase === 'done'` for the last beat, the CTA row.
- For the intro's last beat, `cta: 'begin'` shows "Begin the lesson" (solid #019644, full card width, 48 px), which navigates to skills.

### C.8 Camera director (`camera/CameraDirector.tsx`)

- **One perspective camera**, owned by the engine. `near = 0.1`, `far = 500`, default fov 30.
- **Focus rect**: CSS px relative to the stage, from the ResizeObserver. Available as `useFocusRect()`, a ref plus a version. A chapter may shrink it with `useFocusInset(ref, 'bottom' | 'top')`, which observes a DOM panel and excludes it from the rect (the Continuum portrait key uses this).
- **Fit** (`fit.ts`):
  - The direction comes from az/el around `target`.
  - `fitDistance(pose, focusRect, stageSize)` binary-searches the distance (16 iterations, range 0.05 to 500) so that all 8 corners of `pose.fit`, projected with the lens shift below, land inside `focusRect` inset by `padPx`.
  - Results are cached by `(chapter, beat, layout, stage size, focus rect, detent)`.
- **Lens shift**: `camera.setViewOffset(W, H, W/2 - cx, H/2 - cy, W, H)`, where (cx, cy) is the focus-rect centre in stage CSS px. This moves the principal point to the focus-rect centre, so the caption never covers the subject. Raycasting stays correct. **Never write `projectionMatrix.elements` directly.**
- **Transitions**: during beat n, the pose blends from the end pose of beat n-1 to the end pose of beat n over `cam.window` (default [0, 0.35] of t) with `ease.morph`:
  - target lerped linearly;
  - az and el by the shortest angle;
  - distance in log space;
  - fov linearly.

  `cam.keys` adds mid-beat keyframes, evaluated piecewise with the same interpolation. Beat 0 blends from its own pose, so it is static unless keys are given.
- **Held or seeked**: the camera is evaluated exactly at T (no tween state exists).
- **Parallax** (desktop story mode, not held): an offset of at most 2 degrees az and 1.5 degrees el from the pointer, damped. It is added last and is off under reduced motion.
- **Explore handoff**: on entering explore, OrbitControls gets `target = pose.target`, and the camera stays where it is. (H.50: it tweens to the explore pose, a cut under reduced motion, and re-fits whenever the focus rect or frame changes, keeping the viewer's orbit angles and zoom.)
  - Limits: `minAzimuthAngle` and `maxAzimuthAngle` are the pose az plus `limits.az`; the polar limits come from `limits.el`; the distance range is `fitDistance * limits.zoom`.
  - "Back to story" and Reset tween from the current camera (converted to az/el/dist) to the beat pose over 900 ms (600 ms for Reset).
- **Priority**: the director runs in `useFrame` at priority -90, after the clock (-100) and before labels (-80).

### C.9 Label system (`labels/*`)

```ts
type Tone = 'tick' | 'name' | 'callout' | 'readout' | 'legend'
type Dir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C'
interface LabelSpec {
  id: string
  text: string
  short?: string                        // fallback text when nothing fits
  tone: Tone
  color?: string                        // data colour (dot, border, text for callouts)
  anchor: V3 | ((T: number, layout: Layout) => V3)  // world position; a pure function of T
  prefer?: Dir | 'radial'               // 'radial' = outward from `center`, then tangents, then inward
  center?: V3                           // for 'radial'
  gapPx?: number                        // default: tick 6, name 8, callout 12
  priority?: number                     // default: callout 90, readout 85, name 60, tick 30
  cue?: (T: number) => number           // visibility 0..1 (multiplied into opacity)
  leader?: boolean                      // allow a leader line when displaced more than 12 px
  minChars?: number                     // readout width reservation
  pin?: 'top-left' | 'top-right'        // legend tone: pinned to the focus rect, not anchored
}
export function useLabel(spec: LabelSpec): void
export function useLabels(specs: readonly LabelSpec[]): void
export function setLabelText(id: string, text: string): void      // imperative, no React
export function useObstacle(id: string, rect: () => { x: number; y: number; w: number; h: number } | null): void
```

- The layer is one absolutely positioned div over the canvas plus one SVG for leaders. Label nodes are created when the label SET changes, and are otherwise updated only through refs (`transform: translate3d`, `opacity`, `textContent`).
- **Width measurement**: each label is measured once after `document.fonts.ready` and cached by text. Readouts use `minChars` in `ch` units.
- **Placement** runs in `useFrame` at priority -80, whenever the camera matrix, `clock.version`, the focus rect or the label set changed:
  1. Project the anchors, and hide any behind the camera.
  2. Sort by priority, descending.
  3. For each label, try the preferred side, then the 7 other compass positions at `gapPx`, then up to 3 vertical stagger tiers of 18 px with a leader line (if `leader`), then `short` text, then hide (fade out over 120 ms).
  4. Keep the previously chosen direction first, for hysteresis.
  5. Reject any candidate that leaves the focus rect inset by 8 px, or overlaps a placed label (2 px tolerance) or a registered obstacle.
  6. Write the positions.
- (H.19) At most 36 labels are LIVE (cue above zero) at any T, and at most 96 are registered per view (a sanity bound; story and explore labels together). The placer warns when either is exceeded, and `__story.labelCounts()` reports both.
- (H.19) `required: true` marks a label the beat's meaning depends on: it places first (priority floor 96) and `__story.labels()` reports `requiredHidden` when its cue is up but it could not be placed. QA fails on it.
- (H.19) Obstacles: DOM rects (`useObstacle`, e.g. the HUD) and world obstacles (`useWorldObstacle`: a box, e.g. an SDF plate, and / or points, e.g. data dots and curve samples), projected with the live camera every placement. Labels never cover data marks.
- (H.19) `useLabels(specs, { mode })`: labels belong to 'story' (default), 'explore' or 'both' and hide themselves in the other mode. Ids are one namespace per stage; a second owner registering an id warns, and an owner only ever unregisters its own entry.
- (H.19) Pinned legend labels stack in their corner in `pinOrder`. Callouts may carry `swatches` (small data-colour dots).
- (C.16) The placer skips a frame when nothing that can move a label changed, and allocates nothing per frame.
- Labels never use perspective scale, `<Html>`, or CanvasTexture sprites.
- `__story.labels()` returns the placed rects. QA asserts that at 360, 390 and 430 widths, no two visible labels overlap and no visible label is clipped.

### C.10 Quality tiers, stats

```ts
export const TIERS: Record<Tier, { dpr: [number, number]; composer: boolean; msaa: number; smaa: boolean;
  bloomLevels: number; bloomScale: number; grain: boolean; particleScale: number }> = {
  high:   { dpr: [1, 2],   composer: true,  msaa: 4, smaa: false, bloomLevels: 7, bloomScale: 1,   grain: true,  particleScale: 1 },
  medium: { dpr: [1, 1.5], composer: true,  msaa: 0, smaa: true,  bloomLevels: 5, bloomScale: 0.5, grain: false, particleScale: 0.8 },  // H.20
  low:    { dpr: [1, 1],   composer: false, msaa: 0, smaa: false, bloomLevels: 0, bloomScale: 0,   grain: false, particleScale: 0 },
}
```

- **Initial tier**: `?tier` if present. Otherwise `matchMedia('(pointer: coarse)')` with `min(screen.width, screen.height) < 500` starts MEDIUM, and everything else starts HIGH. Never read `WEBGL_debug_renderer_info` and never use drei `useDetectGPU` (it fetches from a CDN).
- **Adaptation**:

  ```
  (superseded by H.29: the monitor only measures; the engine's hysteresis decides;
   H.38: bounds are relative to the measured refresh rate, so a 30 fps cap is healthy)
  <PerformanceMonitor bounds={(r) => (r > 90 ? [50, 90] : [45, 58])} flipflops={3}
    onDecline={tierDown} onIncline={tierUpToInitial} onFallback={() => setTier('low')}
    onChange={({ factor }) => setDpr(round025(lerp(tier.dpr[0], tier.dpr[1], factor)))}/>
  ```

  This is the "equivalent of AdaptiveDpr": the engine is the only DPR owner, so drei `<AdaptiveDpr>` is NOT mounted (it would fight the tier DPR). During an explore drag, DPR is multiplied by 0.8 and restored 300 ms after release.
- **Still mode**: if LOW stays under 24 fps for 3 s, the Canvas switches to `frameloop="demand"`. The clock is then advanced by a plain rAF loop outside R3F, which calls `invalidate()` only when T changed. Ambient A is frozen (A = T x 2.5), so holds cost nothing and beat end states always render.
- **stats**:
  - `gl.info.autoReset = false`.
  - One `useFrame(() => { snapshot = copy(gl.info.render, gl.info.memory, gl.info.programs.length); gl.info.reset() }, -1000)`.
  - The snapshot therefore covers the whole previous frame, including every post pass.
  - `stats()` returns the snapshot plus `{ tier, dpr: gl.getPixelRatio() }`.
  - **No positive-priority `useFrame` may exist outside the composer**, because on LOW (composer disabled) it would take over rendering and the stage would go black.
- **Mobile budget** (MEDIUM, per frame, including post): at most 120 draw calls and at most 250k triangles. Design target per chapter: at most 30 scene calls, at most 30k triangles, at most 6k points. Post on MEDIUM is about 10 to 14 calls.

### C.11 Visual kit (engine-owned; chapters compose these)

```ts
<Pen points={Float32Array | V3[]} color={string} width={1.25 | 2 | 3 | 4.5}
     progress={(T: number) => number} opacity?={(T: number) => number} dashed?={boolean}
     head?={boolean} hot?={boolean} renderOrder?={number} />
<PenBatch segments={Float32Array} colors={Float32Array} width={number} progress? opacity? />
<MorphPen shapes={Float32Array[]} weights={(T: number) => number[]} stagger?={number} ... />
  // writes positions into the existing interleaved buffer in place (never setPositions per frame)
<AreaFill top={Float32Array} baseline={number} color={string} mode={'gradient' | 'hatch' | 'solid'}
          reveal?={(T) => number} level?={(T) => number} opacity?={(T) => number} />
<LightField frame={ChartFrame} count={number} curveA={Float32Array} curveB?={Float32Array}
            uniforms={(T) => ({ mix: number; level: number; mode: 0 | 1 | 2; hot: number })} />
<Halo position={V3 | ((T) => V3)} sizePx={number} color={string} intensity={(T) => number} />
<SdfText font={'anton' | 'barlowSemi' | 'barlowBold'} text={string} size={number} maxWidth?={number}
         color={string} opacity?={(T) => number} anchorX? anchorY? outline?={boolean} />
  // wraps drei Text with font = import.meta.env.BASE_URL + 'fonts/...'; per-frame opacity via
  // ref.current.fillOpacity; the `text` prop never changes per frame
useCounter(labelId, { value: (T) => number, format: (v: number) => string })   // H.17: the value is a pure function of T
useDomCounter(ref, { value, format })                                           // the same, into a DOM node (HUD chips)
<AreaFill ... bottom?={Float32Array} additive? rim?={(T) => number} rimWidth? gamma? />   // H.20: band fills, luminous areas
<AreaStrips strips points colors write={(T, top, bottom) => boolean} ... />             // H.21: several strips, one draw call
useStoryFrame() / storyFrame()      // H.17: the chapter's engine-owned chart frame (StoryDef.frame)
useWorldObstacle(id, { box?, points?, maxPoints?, radiusPx?, padPx?, mode? })           // H.19, H.36
useStageHotspot(id, { box(T), onActivate, ariaLabel, modes })                           // H.36: real buttons over 3D
<Instances geometry material count place(T, i, pos, quat, scale) colors?/>              // H.36
<Glows/>, <Ripple/>, <Plates/>                                                          // H.36
<ChipRadio label options value onChange />                                             // explore chip row as a real radiogroup
tween: mix, mixV3, morphPoints(out, a, b, k, stagger), resample(points, 256), arcLengths(points)
shapes: underline(w), decagon(r), drumGlyph(r), humps(w, h), dialGlyph(r), curveGlyph(samples, w, h),
        surfaceGlyph(w, h), toSvgPath(points, size)   // closed shapes: start at 12 o'clock, clockwise
axis:   logAxis(tMin, tMax)                // u = logU(t)
        intervalAxis(POWER_DURATIONS)      // equal spacing per sample, log within each segment (F.1)
useChartFrame({ FH, minAspect, maxAspect, marginPx }) -> ChartFrame
useChapterFog(color, density)
useDragHandle({ id, anchor: () => V3, radiusPx?: 22, onStart, onDrag(ray: THREE.Ray, ndc: [number, number]), onEnd })
ExploreSpec.onScrub(ray: THREE.Ray, ndc: [number, number], phase)   // H.17: the same Ray a drag handle gets
useImpact(beatIndex, [a, b])              // B.10 impact accent
useSafeFrame(site, (T, A, dt) => void, { priority?, hide? })     // H.44: guarded chapter frame code
useChapterChart()                         // H.44: the new name of useStoryFrame
frameId(frame)                            // H.41: key cached writers on the frame
<Pen ... dim?={(T) => number} />          // H.41: rest a dimmed line at full alpha (no beads)
<LightField ... uniforms={(T, A) => ({ mode: 2, flow, bandOn, lane, stack, thick })} curveC? bandColors? hMax? />  // H.43 FLOW
<Nodes .../>                              // H.42: impostor spheres
makeSurfaceMaterial(opts), ballOpts(color), <BlobShadow count radius place/>        // H.43
hudClipX(x0, x1, y, z?)                   // H.45: keep a line clear of the HUD chip
cameraBus.orbitTo(az, el)                 // H.50: explore reveals a dimension a control turned on
useQAProbe(id, fn), __story.chartRect()   // H.46
```

Every element with `hot` automatically gets a `Halo` on LOW.

### C.12 Explore mode (engine side)

- `store.setMode('explore')` pauses the story and calls `def.explore.initFromBeat(index)` (for `?explore=1` alone, the last beat). It mounts `OrbitControls` (`enableDamping`, `dampingFactor 0.08`, `enablePan false`, `enableZoom false`, `rotateSpeed 0.6`), swaps the caption card for `ExplorePanel` hosting `def.Explore`, and makes the scene's explore-only elements (handles, extra readouts) visible.
- Explore state lives in a per-chapter zustand slice. The explore scene reads it through refs and selectors. Explore does not use T for its content, except that the base scene is held at the entry beat's t = 1.
- Scenes remain pure in story mode. Explore interactions may use damped motion (`THREE.MathUtils.damp`, lambda 10) because determinism is not required there.

### C.13 Reduced motion (`prefers-reduced-motion: reduce` or `?motion=reduce`)

- No autoplay. Every beat renders at t = 1 (its end state).
- Prev and next cut instantly, and camera changes are cuts.
- Captions swap with no slide (opacity only, 120 ms).
- Ambient A is frozen, and parallax, the impact accent, haptics and the chapter fade are off (instant swap).
- The play button becomes "Show build". Tapping it plays the current beat's build once at normal speed, then holds.
- User-driven scrubbing still works.
- Explore works fully.
- The Notes transcript is expanded.

### C.14 Routing, base path, shell integration

- **`fitnessStore.ts`**:
  - `const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')`.
  - `parseFitnessPath` strips `BASE` before matching `/fitness(/slug)?`, and reads `beat`, `t` and `explore` from `location.search`.
  - `routeToPath` returns `${BASE}/fitness/...`.
  - `navigate` drops the query string.
- **`main.tsx`**: strip `BASE` from `pathname` before the `isGames` / `isFitness` / `isNews` checks. This is harmless at base `/`.
- **Assets**: the PA logo (`BASE_URL + 'pa-logo.png'`, fixing today's absolute `/pa-logo.png`) and the SDF fonts resolve from `BASE_URL`. Links to `/games`, `/`, `/news` and `/games/capacity` stay absolute production paths.
- **FitnessApp**: renders the TopBar, then `<StoryStage>` (persistent; it receives the active `StoryDef` from `stories/index.ts` via Suspense, and the slate covers loading), then `<Notes>`, the LessonNav and the footer. `ViewErrorBoundary` wraps the chapter Scene inside the Canvas and the Notes.
- **Prefetch**: when a chapter is ready, `requestIdleCallback` prefetches the next chapter chunk.

### C.15 Gates and dev audits (run before every commit)

1. a scan of `src/fitness` for U+2013 / U+2014 (em and en dashes) must print no dashes.
2. The TypeScript strict build must pass (`tools/build.sh`).
3. A scene-code grep gate (`tools` or a `*.local.mjs` script) over `src/fitness/stories/**` and `src/fitness/story/kit/**` must have zero hits for `Math.random`, `performance.now`, `Date.now`, `<Trail`, `<Float`, `<Html`, `useDetectGPU`, `Environment preset`, `ContactShadows`, `gridHelper`, `castShadow`, and `useFrame(` with a positive priority.
4. **Caption audit** (`captionAudit.local.mjs`): every beat has a title of 30 characters or fewer, a body of 140 or fewer, a non-empty `source`, and no dashes. At least 70% of the body's content words (4 letters or more) must appear in the cited source string, which is resolved by evaluating the `source` path against the `fitnessData` exports and the module-file string table in section D.
5. **Hopper run assertion** (a dev-only check in `hopperMath.ts`, run once at module load when `import.meta.env.DEV`) verifies the seeded run against section D.3: the first 12 domains, the leader after each of draws 1 to 5, and the rounded totals at draws 12 and 40. A mismatch throws.

### C.16 Performance rules

- Instance repeated geometry. Merge static lines per role.
- Dispose everything a chapter creates on unmount. After navigating intro, skills, intro, `stats().geometries` must return to within 2 of its intro baseline.
- No shadow maps.
- Transparent objects get explicit `renderOrder`: backdrop -1000, fills 10, surfaces 20, lines 30, points 40, halos 50.
- Nothing allocates per frame (reuse vectors and arrays).
- `LineMaterial.resolution` is updated by the engine on resize and on DPR change.

---

## D. Storyboards

Conventions:
- World units, Y up. Flat charts face +Z. `az` and `el` are in degrees as in C.2.
- **L** is the landscape / desktop pose (focus aspect of 0.95 or more) and **P** is portrait. When P is omitted it is the same as L.
- `build` is in seconds. Scene windows are beat-local t.
- Every caption states its source. "verbatim" means word for word; "para" means a tight paraphrase with no new facts.
- The label lexicon lists every string a chapter may show in the 3D label layer. Computed values are marked {computed}.

**Module-file string table** (existing UI copy the caption audit may cite, besides `fitnessData.ts`):
- `HopperModule.leadMsg[1]` = "Across random draws, the generalist accumulates the most points."
- `HopperModule.leadMsg[2]` = "Keep drawing. A specialist only leads while its own domain keeps coming up."
- `HopperModule.readoutSub` = "Every competitor scores on this domain; totals accumulate"
- `PathwaysModule.note` = "Ribbon height is power output. Peak power order: {PEAK_ORDER_TEXT}. Oxidative outlasts the others, it is not more powerful."
- `DefinitionModule.note1` = "Power falls as duration grows. A specialist wins one zone; the generalist wins the area."
- `DefinitionModule.note2` = "Pick a specialist and the broad curve stays as a ghost. They beat the generalist in one zone and lose the area. P(t) = CP + W prime / t is the sustained tail."
- `ContinuumModule.note` = "Center is sickness, the rim is fitness. Each marker rides its own spoke. Drag any marker outward and the profile becomes Custom."
- `HealthModule.note` = "The amber slice is the fitness curve from model 04, at one age. Health is every slice you will ever live, stacked."
- `HealthModule.readoutSub` = "The translucent solid IS this number: the whole volume under the surface."
- `SkillsModule.legend` = "Trained (organic)", "Practiced (neural)", "Both"
- `IntroView.eyebrow` = "CrossFit Journal, October 2002"
- `IntroView.gridTitle` = "Six interactive models"

---

### D.1 INTRO (`/fitness`): "The Line" (5 beats)

**World** (start values). One hero `MorphPen` of 256 points in the XY plane, plus these shape generators (each 256 arc-length points; closed shapes start at 12 o'clock and run clockwise):
- `underline(w)`;
- `decagon(r)` for skills;
- `drumGlyph(r)`: a circle plus 5 domain dots on its rim as instanced nodes;
- `humps(w, h)`: the three Pathways engine power curves, share x envelope, laid end to end along a baseline;
- `dialGlyph(r)`: a full circle with 10 inward ticks;
- `curveGlyph(POWER_CURVES[0].samples, w, h)` on the interval axis;
- `surfaceGlyph()` for the chapter sheet: 3 offset ridgelines.

| Element | P | L |
|---|---|---|
| Title (SDF Anton) | 2 lines "WHAT IS" / "FITNESS?", size 1.3, centre (0, 3.8, 0), maxWidth 6.4 | 1 line, size 1.1, centre (0, 2.6, 0), maxWidth 12 |
| Underline | y 2.1, x from -3.0 to 3.0 | y 1.6, x from -5.6 to 5.6 |
| Formation spot | centre (0, -1.4), r 2.3 | centre (0, -1.6), r 2.0 |
| Docked glyph row (scale 0.36) | y -5.0, x = -2.85, -0.95, 0.95, 2.85 | y -4.6, x = -4.5, -1.5, 1.5, 4.5 |
| Definition chart | x from -3.4 to 3.4, y from -2.6 to 2.2 | x from -5 to 5, y from -3.2 to 2.6 |
| Map tiles (glyph r 1.15) | 2 cols x 3 rows: x = +/-2.1, y = 3.4, 0, -3.4 | 3 cols x 2 rows: x = -5, 0, 5, y = 1.8, -2.4 |

In the title, FITNESS? is #91C640 and WHAT IS is chalk.

#### I0 `title`, build 4.0
- **Caption** (eyebrow "CrossFit Journal, October 2002" [IntroView.eyebrow]):
  - Title: **What is fitness?**
  - Body: "Greg Glassman set out to do what he argued no authority had bothered to do: give a clear, usable, measurable definition of fitness." [INTRO_TEXT s1, para]
- **Scene**:
  - 0.00 to 0.35: the title rises 0.4 while fading in (`settle`).
  - 0.40 to 0.85: the pen draws the underline left to right (`draw`, hot head).
  - 0.85 to 1.00: the backdrop glow brightens by 10%.
- **Camera**: az 0, el 0, fov 30. P fit [-3.6, 1.6, 0]..[3.6, 5.8, 0], pad 32. L fit [-6.4, 0.9, 0]..[6.4, 3.6, 0], pad 32.
- **Labels**: none.
- **Learning outcome**: this is a lesson about defining fitness precisely, and the line is the tool it will use.

#### I1 `models`, build 8.0
- **Caption**:
  - Title: **Four models**
  - Body: "He built it from four complementary models and one definition." [INTRO_TEXT s2, para]
- **Scene**:
  - 0.00 to 0.12: the title dims to 35% and slides up 0.5.
  - Four morphs of 0.2 each, starting at 0.12, 0.32, 0.52 and 0.72 (`morph`). The hero pen lifts off the underline and forms, at the formation spot:
    - the decagon (#91C640);
    - the drum circle (chalk, with 5 domain dots popping on its rim, `snap`);
    - the humps (stroke vertex colours rose, amber, blue);
    - the dial (stroke coloured by `spectrum` around the circle).
  - Each shape's name label fades in the moment it closes, at 60% of its morph window.
  - At the end of each window, a 0.36-scale copy of that shape flies to its docked slot (0.08, `settle`).
  - The hero pen ends as the dial at the formation spot, then shrinks into the 4th slot at 0.92 to 1.00.
- **Camera**: P fit [-3.8, -6.3, 0]..[3.8, 5.3, 0]. L fit [-6.6, -5.6, 0]..[6.6, 3.4, 0]. az 0, el 0.
- **Labels** (name tone, under each docked copy and at the formation spot while forming): "Skills", "The Hopper", "Energy", "Continuum" [MODULES mobileLabel / label].
- **Learning outcome**: there are four separate models, and each has a recognisable shape.

#### I2 `definition`, build 5.5
- **Caption**:
  - Title: **One definition**
  - Body: "Work capacity across broad time and modal domains. Plot power against duration; the area under the curve is your fitness." [DEFINITION_TEXT s1 to s2, para]
- **Scene**:
  - 0.00 to 0.15: the title fades to 0, and the glyph row dims to 35%.
  - 0.10 to 0.35: construction. The two axes draw (chalk 55%).
  - 0.35 to 0.70: data. The pen draws the Generalist curve (`curveGlyph` on the interval axis), #91C640, 3 px.
  - 0.70 to 0.95: the area sweeps left to right (`AreaFill`, gradient, #91C640).
  - 0.90 to 1.00: the claim. The SDF "AREA = FITNESS" (Barlow Bold, 0.42, ink on a #91C640 plate) settles inside the area.
- **Camera**: P fit [-3.8, -6.3, 0]..[3.8, 2.8, 0]. L fit [-6.6, -5.4, 0]..[6.6, 3.2, 0]. az 0, el 0.
- **Labels**: tick "Power output", tick "Effort duration" [DefinitionModule axis titles].
- **Learning outcome**: fitness is a measurable area under a power curve.

#### I3 `lifetime`, build 5.0
- **Caption**:
  - Title: **Held for a lifetime**
  - Body: "Sustain that capacity across a lifetime and it is health: the volume you keep under the curve." [INTRO_TEXT last clause + MODULES[5].blurb, para]
- **Scene**:
  - 0.00 to 0.20: the glyph row fades out.
  - 0.10 to 0.70: the area extrudes back along -Z (6 units) into the Lifelong trainer surface (grid 28 x 20, `agingCapacity`, the health surface material scaled down) with a translucent skirt. The curve stays as its front edge.
  - 0.75 to 1.00: SDF "HEALTH" (Barlow Bold, 0.5, chalk 30%) lies on the floor in front.
- **Camera**, which reveals age: P az -14, el 38. L az -32, el 26. Fit the solid [-3.6, -2.6, -6.2]..[3.6, 2.4, 0.2] (L uses the L chart box).
- **Labels**: tick "AGE" [HealthModule axis title].
- **Learning outcome**: the curve has a third dimension, a whole life, and its volume is health.

#### I4 `map`, build 5.0, cta: 'begin'
- **Caption**:
  - Title: **Six interactive models** [IntroView.gridTitle]
  - Body: "This lesson walks through each model as presented in the article and the official Level 1 Training Guide." [INTRO_TEXT s3, para]
- **Scene**:
  - 0.00 to 0.50: everything folds into six tiles with a 50 ms stagger (`settle`):
    - the four glyphs go to tiles 01, 02, 03 and 05;
    - the curve plus area goes to tile 04;
    - the surface shrinks into tile 06 (its only ambient motion is a slow turn of +/-15 degrees az as a function of A).
  - Each tile gets a faint 1 px accent ring (radius 14 px screen, DOM).
  - 0.50 to 0.80: tile labels fade in.
- **Camera**: az 0, el 0. P fit [-4.0, -5.4, 0]..[4.0, 5.2, 0]. L fit [-7.4, -4.4, 0]..[7.4, 3.8, 0].
- **Labels** (name tone, under each tile): "01 SKILLS", "02 THE HOPPER", "03 ENERGY", "04 CAPACITY", "05 CONTINUUM", "06 HEALTH" [MODULES num + mobileLabel / label].
- **DOM tiles**: one transparent `<button>` per tile, sized to the projected tile rect (at least 120x96 px on the phone), `aria-label = MODULES[i].title`. Tapping navigates. Keyboard focus shows a 2 px #91C640 ring.
- **Learning outcome**: the map of the whole lesson, and that any model can be opened.

**Explore (intro)**: the same six tiles stay tappable; one-finger orbit is az +/-20, el from -5 to 25. The Notes below are the hub (B.6).

**Acceptance (intro)**, at `?beat=N&t=1&tier=medium` (phone) and `&tier=high` (desktop):
- [ ] I0 phone: the two-line title fills the width of the focus rect minus padding. The underline is visible under it. Nothing is above the title. The caption card does not overlap the title.
- [ ] I1 phone: the dial is at the formation spot shrinking or docked, four docked glyphs with four readable, non-overlapping name labels, and the title dimmed at the top.
- [ ] I2 both: axes, a yellow-green curve, a filled area, "AREA = FITNESS" inside the area, both axis ticks readable, and the glyph row dimmed at the bottom.
- [ ] I3 both: a lit 3D surface with visible depth and "AGE" readable.
- [ ] I4 phone: six tiles in a 2x3 grid, six labels "01 SKILLS" to "06 HEALTH", no overlap, "Begin the lesson" solid green in the card. Desktop: a 3x2 grid.
- [ ] Tapping tile 03 opens `/fitness/pathways` (and `/preview/fitness/pathways` under the preview base).

---

### D.2 SKILLS (`/fitness/skills`): "Ten spokes, one floor" (6 beats)

**World**:
- A radar in the XY plane, R = 10, one unit per skill point. Spoke i points at angle 90 - 36i degrees (Strength at the top, clockwise, SKILLS order).
- Construction: rings at 2, 4, 6, 8 and 10, plus spoke ticks every unit, merged into one `PenBatch`. Class arcs at r = 10.5.
- Profile: a prism (fan fill plus side walls, 0.25 thick along +Z, `rimStandard` in #91C640 with fill alpha 0.35), a 3 px outline pen, and instanced vertex nodes in the class colours.
- Floor ring: a dashed pen circle at r = min(profile), #91C640.
- Specialist: a dashed chalk pen outline, with hatch `AreaFill` wedges where specialist < generalist.
- Label anchors: r = 11.2 on each spoke with `prefer: 'radial'`. At 360 and 390 px, the side labels (Endurance, Flexibility, Agility, Balance) fall back to their tangent candidates, which is expected.
- Small multiples: 13 mini radars (R 3.0), with outlines, fills and floor rings merged into 3 draw calls.

**Math** (`skillsMath.ts`): `floorOf(p) = min(p)`, `rangeOf(p) = max(p) - min(p)`, and `weakestName(p)`. `breadthOf` is deleted.

**HUD chip**: none.

#### S0 `ten`, build 5.0
- **Caption**:
  - Title: **Ten physical skills**
  - Body: "CrossFit's first model: there are ten general physical skills, and you are as fit as you are competent in each." [MODULE_COPY.skills.body s1, para]
- **Scene**:
  - 0.00 to 0.20: rings draw (chalk 12%).
  - 0.20 to 0.75: the pen draws the ten spokes clockwise, 60 ms stagger, chalk 55%.
  - Each name label fades in as its spoke completes.
- **Camera**: az 0, el 0, fov 30. Fit [-10, -10, 0]..[10, 10, 0.3], pad 76 (P and L).
- **Labels**: names SKILLS[i].name (chalk, no dot yet).
- **Learning outcome**: fitness splits into ten named skills on equal axes.

#### S1 `trained-practiced`, build 5.0; terms: "training" to trained, "practice" to practiced
- **Caption**:
  - Title: **Trained or practiced**
  - Body: "Four skills respond to training, an organic change in the body. Four respond to practice, a change in the nervous system." [MODULE_COPY.skills.body s3, para]
- **Scene**:
  - 0.05 to 0.45: a `PAL.trained` arc sweeps from Strength to Flexibility. Those spokes, dots and labels take the trained colour; the other six dim to 35%.
  - 0.50 to 0.90: a `PAL.practiced` arc sweeps from Coordination to Accuracy, and those four take the practiced colour.
- **Camera**: unchanged.
- **Labels**: callouts "Trained (organic)" and "Practiced (neural)" [SkillsModule.legend], each anchored at the middle of its arc (r 12.2).
- **Learning outcome**: the skills fall into two families that are built differently.

#### S2 `both`, build 3.5
- **Caption**:
  - Title: **Power and speed: both**
  - Body: "Power and speed come from both training and practice." [MODULE_COPY.skills.keyPoints[2], verbatim]
- **Scene**:
  - 0.05 to 0.55: the trained arc extends clockwise and the practiced arc counter-clockwise until they meet over Power and Speed. The overlap turns `PAL.both`, and the Power and Speed spokes and labels turn amber.
  - Impact accent 0.55 to 0.67.
- **Labels**: callout "Both" [SkillsModule.legend]. A legend (pinned top-left) with Trained / Practiced / Both swatches appears here and persists through S3.
- **Learning outcome**: power and speed are where the two families overlap.

#### S3 `generalist`, build 4.5
- **Caption**:
  - Title: **The balanced shape**
  - Body: "Broadly excellent. The most balanced shape on the wheel, with no peaks and no gaps." [ARCHETYPES[0].blurb, verbatim]
- **Scene**:
  - 0.00 to 0.15: the arcs dim to 35%.
  - 0.10 to 0.55: the Generalist profile [8, 8, 8, 7, 8, 8, 8, 7, 8, 7] grows from the centre, one vertex per spoke, 50 ms stagger (`settle`). The outline pen follows, and the fill and walls rise.
  - 0.60 to 0.90: the claim. The dashed floor ring draws at r = 7 (hot head).
- **Camera**, which reveals the solid: L az -10, el 16. P az -8, el 14. Same fit.
- **Labels**: callout "Weakest skill 7" {computed: floorOf}, anchored at the ring at angle -45 degrees. Pinned legend (top-left): "Generalist CrossFitter" in #91C640.
- **Learning outcome**: a generalist is round, and even its weakest skill is high.

#### S4 `specialist`, build 5.0
- **Caption**:
  - Title: **Peaks and gaps**
  - Body: "The powerlifter: maximal strength, little metabolic demand. You are only as fit as you are competent across all ten." [ARCHETYPES[2].blurb + MODULE_COPY.skills.keyPoints[3], para]
- **Scene**:
  - 0.00 to 0.30: the generalist dims to a ghost (outline 60%, fill 15%) while the camera returns to front-on (L12).
  - 0.20 to 0.60: the pen draws the Powerlifter [10, 5, 2, 4, 6, 4, 5, 3, 5, 4] as a dashed chalk outline.
  - 0.55 to 0.75: hatch wedges fill where Powerlifter < Generalist.
  - 0.75 to 0.95: the claim. The floor ring collapses from r 7 to r 2 at Endurance (`morph`).
- **Camera**: az 0, el 0 (back to front-on for the comparison).
- **Labels**: callout "Weakest skill 2" {computed}. Pinned legend: "Generalist" (#91C640 swatch) and "Powerlifter" (dashed chalk swatch).
- **Learning outcome**: a specialist buys a spike with gaps, and fitness is limited by the gaps.

#### S5 `thirteen`, build 5.5
- **Caption**:
  - Title: **Thirteen athletes**
  - Body: "A balanced athlete against twelve specialists. A program develops fitness to the extent it improves all ten." [MODULES[0].blurb s2 + MODULE_COPY.skills.body s2, para]
- **Scene**:
  - 0.00 to 0.35: the main radar shrinks FLIP-style into cell 0.
  - 0.25 to 0.85: the other 12 grow into their cells with a 40 ms stagger. Each mini radar has an outline, a fill and its floor ring.
  - **Sort** by floor descending, then range ascending, then name: Generalist CrossFitter, Tactical / Military, Team-sport Athlete, Competitive Swimmer, Artistic Gymnast, Rower, Strongman, Bodybuilder, 100m Sprinter, Marathoner, Olympic Weightlifter, Sedentary Adult, Powerlifter.
  - Only the Generalist cell is #91C640; all others are chalk.
  - Grid: P 3 columns x 5 rows, pitch 8.2 x 8.8. L 5 x 3.
- **Camera**: az 0, el 0. Fit the grid plus the name rows, pad 20.
- **Labels**: a name under each cell. Use `short` forms if needed: "Generalist", "Tactical", "Team sport", "Swimmer", "Gymnast", "Rower", "Strongman", "Bodybuilder", "Sprinter", "Marathoner", "Weightlifter", "Sedentary", "Powerlifter" (shortened ARCHETYPES names). Legend (pinned top-left): "SORTED BY WEAKEST SKILL".
- **Learning outcome**: across every athlete type, only the generalist has no deep gap.

**Label lexicon (skills)**: the SKILLS names; "Trained (organic)", "Practiced (neural)", "Both"; "Weakest skill N"; "Range N"; the ARCHETYPES names and their short forms above; "Generalist", "Powerlifter"; "SORTED BY WEAKEST SKILL"; "Custom".

**SDF (skills)**: none.

**Explore (skills)**:
- The peek shows the "Athlete" chip row (13 archetypes plus Custom). The expanded sheet adds a "Compare" chip row (None plus 13, drawn as the dashed chalk outline), the readouts, the class legend, a "Wheel | Grid" segmented control, and the 10 existing sliders (Custom only).
- **Readouts**: "Weakest skill" (value and skill name) and "Range" (max minus min) for A, and for B when it is set. There is no mean or breadth anywhere.
- **Drag handles**: each vertex node of A (22 px). Dragging radially sets that skill (step 0.1, 0 to 10) and switches A to Custom.
- **Tap a spoke or name**: a callout with `SKILLS[i].definition` and its class.
- **Orbit**: az +/-50, el from 0 to 50, zoom 0.8 to 1.4.

**Acceptance (skills)**:
- [ ] S0 phone 390: ten spokes and ten names, all inside the stage, none overlapping (`labels()`), radar radius at least 100 px, radar centre within 12 px of the focus-rect centre. The same holds at 360.
- [ ] S1: Strength, Stamina, Endurance and Flexibility in #019644; Coordination, Agility, Balance and Accuracy in #38bdf8; Power and Speed dim; two callouts readable.
- [ ] S2: Power and Speed in #f4b740, "Both" callout, legend top-left.
- [ ] S3: a yellow-green 3D prism visible with slight depth, a dashed ring, "Weakest skill 7".
- [ ] S4: front-on; dashed chalk outline over the ghost; hatched gaps; ring at 2; "Weakest skill 2"; legend with two entries. No cyan anywhere.
- [ ] S5 phone: 3x5 grid, 13 names readable (at least 11 px) and not overlapping, "SORTED BY WEAKEST SKILL", Generalist first and Powerlifter last. Desktop: 5x3.
- [ ] `?explore=1`: the Athlete chips are in the peek; the readouts say "Weakest skill" and "Range"; the word "breadth" appears nowhere.

---

### D.3 HOPPER (`/fitness/hopper`): "The Tally" (7 beats)

**Determinism** (`hopperMath.ts`, which replaces every Math.random in story mode): `mulberry32`, SEED = 78331. For each draw, `r()` is consumed exactly in this order:
- `domain = r() < 0.18 ? 'unknown' : ['weightlifting','gymnastics','monostructural','oddObject'][Math.floor(r() * 4)]`
- `r()` is consumed once more and discarded (the old task pick). The label is `HOPPER_DOMAINS[domain].tasks[occurrence % 5]`, where occurrence counts earlier draws of the same domain.
- For each `HOPPER_ROSTER` athlete in order: `pts = clamp(base + (r() * 8 - 4), 5, 99)`.

Verified output (the design lead re-ran it; the C.15 assertion must match):

- **Draws 1 to 12**:

  | Draw | Domain | Task |
  |---|---|---|
  | 1 | WL | 1RM Back Squat |
  | 2 | OO | Carry a person 200 m |
  | 3 | MONO | 5k Run |
  | 4 | WL | Heavy Clean and Jerk |
  | 5 | UNK | Climb 6 flights with bags |
  | 6 | GYM | Max Strict Pull-ups |
  | 7 | WL | 5RM Deadlift |
  | 8 | UNK | Sprint to catch a bus |
  | 9 | MONO | 2k Row |
  | 10 | WL | Max Overhead Press |
  | 11 | UNK | Push a stalled car |
  | 12 | GYM | Handstand Walk 50 ft |

- **Draw 1 points**: Generalist 74, Weightlifter 95, Marathoner 18, Gymnast 54, Strongman 92, Sprinter 59.
- **Leader after each draw**: Weightlifter after draw 1, Strongman after draws 2, 3 and 4, then **Generalist from draw 5 (389 vs Strongman 384) through draw 40** and beyond.
- **Totals** (rounded):

  | Draw | Generalist | Strongman | Weightlifter | Gymnast | Sprinter | Marathoner |
  |---|---|---|---|---|---|---|
  | 12 | 944 | 809 | 771 | 743 | 685 | 547 |
  | 40 | 3185 | 2404 | 2396 | 2693 | 2282 | 1957 |

- **Top single-draw scorer over 40 draws**: Gymnast 12, Weightlifter 9, Marathoner 8, Generalist 8 (the unknown draws), Strongman 3.
- **64-thread proof**: seeds 1 to 64 with the same procedure. The lead is Generalist total minus the best specialist total. It is above zero in 62 of 64 runs after 10 draws and in 64 of 64 after 20. The range across all threads is -69 to +765. These numbers are chart facts, not caption copy.

The whole 40-draw story run and all 64 threads are precomputed at module load (prefix sums per draw).

**World**:

| Element | P ("stack") | L |
|---|---|---|
| Drum | centre (0, 7.6, 0), r 2.6, half-length 1.6 on Z, spin axis toward the camera | centre (-5.5, 6.4, 0) |
| Ticket plate | (0, 3.7, 1.2), 4.8 x 1.6 | (1.2, 6.4, 1.2), 6 x 1.8 |
| Rails | 6 rails, rank slot k at y = 1.6 - 1.35k, x from -5.4, length `railLen` = 10.8 | y = 2.2 - 1.45k, x from -7.6, length 15.2 |

**Parts**:
- **Drum**: 3 hoops (instanced torus 48x8, `steel`) and 12 bars (instanced thin cylinders, `steel`), plus a blob shadow.
- **Balls**: 25, one per task (5 domains x 5), instanced ico-2, `ballMaterial` in the domain colours.
- **Ticket**: a rounded plate in the domain colour showing:
  - the kicker "DRAW N - DOMAIN" in Barlow Condensed SemiBold SDF, ink, 0.28 (the hyphen is ASCII);
  - the task name in Anton SDF, ink, maxWidth 4.4 (P) / 5.6 (L), at most 2 lines.
- **Rails**: one `PenBatch` (chalk 25%).
- **Bricks**: one InstancedMesh of rounded boxes (`rimStandard`, per-instance colour = the DRAWN domain, per-instance length = pts x k(T), height 0.5, depth 0.4), capacity 240.
- **Rank badges**: DOM labels "P1" to "P6".
- **Lead flag**: a callout "LEAD" in #91C640 at the P1 rail's end.

**Tumble** (ambient, deterministic):
- Drum angle = 1.1 x A.
- Ball i has phase phi_i and lane z_i from `hash1(i)`, with s = fract(phi_i + 0.22 x A).
- For s < 0.55 the ball rides the wall: its angle goes from -110 degrees to 35 + 30 x hash(i) degrees at r = R - 0.3.
- Otherwise it falls ballistically from that release point with the wall's tangential velocity, landing on the pile at y = -R + 0.5 when s = 1.
- Under a hold the whole tumble is frozen at A = T x 2.5.

**Draw animation** for draw d, in its window [a, b] (all functions of T):
1. The drawn ball appears at the drum gate and drops to the ticket slot (first 30% of the window).
2. The ticket flips (`snap`).
3. Six bricks fly from the ticket to their rails' current ends with a 35 ms stagger (`snap`).
4. The totals count.
5. Rank slots re-order over the last 20% of the window (lane y eases between rank positions).

**Rail scale**: `k(T) = 0.9 * railLen / max(1000, leaderTotal(T))`, where `leaderTotal` interpolates the leader's total at the fractional draw count. It is continuous, so bars grow while the scale settles.

**HUD chip**: "DRAW" (eyebrow) plus N (readout) from H1 onward.

#### H0 `hopper`, build 4.5
- **Caption**:
  - Title: **The hopper**
  - Body: "Picture a hopper loaded with an infinite number of physical challenges, with no selective mechanism." [MODULE_COPY.hopper.body s2, para]
- **Scene**:
  - 0.00 to 0.35: construction. The hoops draw on as pen circles, then cross-fade to the steel material.
  - 0.35 to 0.80: the 25 balls pour in through the top (30 ms stagger) and start tumbling.
  - 0.75 to 1.00: a row of 5 domain legend chips appears (pinned top-left).
- **Camera**: az 0, el 8, fov 32. P fit [-3, 4.8, -1.6]..[3, 10.4, 1.6]. L fit the drum at its L centre.
- **Labels**: legend with `HOPPER_DOMAINS[].label` and colours.
- **Learning outcome**: the hopper holds every kind of physical task, mixed together.

#### H1 `draw`, build 4.5
- **Caption**:
  - Title: **Drawn at random**
  - Body: "Imagine an infinite hopper of challenges drawn at random, with no say in what you get." [MODULE_COPY.hopper.keyPoints[0], verbatim]
- **Scene** (draw 1):
  - 0.15 to 0.45: a weightlifting-orange ball drops out of the drum gate.
  - 0.45 to 0.70: the ticket flips to "DRAW 1 - WEIGHTLIFTING" / "1RM BACK SQUAT".
  - 0.70 to 0.95: the pen traces the ticket border once (hot).
- **Camera**: fit the drum plus the ticket. P [-3, 2.6, -1.6]..[3, 10.4, 1.6].
- **Learning outcome**: you do not choose the task; the hopper does.

#### H2 `score`, build 5.0
- **Caption**:
  - Title: **Relative to others**
  - Body: "Your fitness is your capacity at those tasks relative to others. Every competitor scores; totals accumulate." [MODULE_COPY.hopper.body s3 + HopperModule.readoutSub, para]
- **Scene**:
  - 0.00 to 0.30: construction. Six rails draw on (80 ms stagger). Names come from `shortName` ("Generalist" in #91C640, the others chalk), plus rank badges.
  - 0.30 to 0.70: six orange bricks fly from the ticket to the rail origins and stretch to the draw 1 points (`snap`).
  - 0.60 to 0.85: the totals count up. The rails sort by total (Weightlifter P1, Strongman P2, and so on).
  - 0.85 to 1.00: the claim. The "LEAD" flag lands on the Weightlifter.
- **Camera**, which reveals the roster: P fit [-5.8, -5.6, -1]..[5.8, 10.4, 1.6], az 0, el 8 (rails are compared, L12). L fit everything, same angles. H3 to H5 keep this pose.
- **Labels**: rail names (`shortName(HOPPER_ROSTER[i].name)`), badges "P1" to "P6", totals {computed}, "LEAD".
- **Learning outcome**: one task, six athletes, one score each, and the task's specialist leads.

#### H3 `specialists`, build 5.5
- **Caption**:
  - Title: **Keep drawing**
  - Body: "Keep drawing. A specialist only leads while its own domain keeps coming up." [HopperModule.leadMsg[2], verbatim]
- **Scene**:
  - Draws 2, 3 and 4 run in windows starting at 0.05, 0.35 and 0.65, each 0.25 long.
  - After each draw's bricks land, a small #91C640 tick appears above the brick of that draw's top scorer.
  - LEAD moves to the Strongman after draw 2.
- **Learning outcome**: who leads depends on which domain came up, and that is luck.

#### H4 `unknown`, build 5.5; terms: "unfamiliar" to unknown
- **Caption**:
  - Title: **The unknown**
  - Body: "It demands performing well even at unfamiliar tasks combined in endless ways." [MODULE_COPY.hopper.keyPoints[2], verbatim]
- **Scene**:
  - 0.00 to 0.55, slow: draw 5 is a grey UNKNOWN ball, becoming the ticket "DRAW 5 - UNKNOWN / UNKNOWABLE" / "CLIMB 6 FLIGHTS WITH BAGS". The Generalist brick lands last.
  - 0.55 to 0.75: the rails re-sort and the Generalist rail rises to P1. The "LEAD" flag moves.
  - Impact accent 0.62 to 0.74, on the Generalist rail's badge.
  - 0.75 to 1.00: hold.
- **Labels**: callout "NEW LEADER" on the Generalist rail from 0.62.
- **Learning outcome**: the generalist takes the lead without winning the specialists' draws, because it never scores low.

#### H5 `many`, build 6.0
- **Caption**:
  - Title: **Across random draws**
  - Body: "Across random draws, the generalist accumulates the most points. This is why CrossFit prizes the generalist." [HopperModule.leadMsg[1] + MODULE_COPY.hopper.body s4, para]
- **Scene**:
  - 0.05 to 0.85: draws 6 to 40. The draw index is 5 + 35 x `easeInQuad`. Tickets shrink to a small flick, the drum spins 2x (as a function of T for this window), and bricks rain in as thin slivers. Each rail becomes a continuous stacked bar of domain-coloured bands. k(T) rescales continuously, and the totals count.
  - The Generalist keeps P1 throughout.
  - 0.85 to 1.00: hold on the final totals.
- **Camera**: unchanged from H2 (az 0, el 8).
- **Learning outcome**: over many random draws, never scoring low beats sometimes scoring high. The band colours show where each total came from.

#### H6 `every-run`, build 6.0
- **Caption**:
  - Title: **Again and again**
  - Body: "Each line is its own random hopper. Nature serves unforeseeable challenges, so the training stimulus must stay broad and varied." [first sentence: chart legend (see L13 note); second: MODULE_COPY.hopper.keyPoints[3], verbatim]
- **Scene**:
  - 0.00 to 0.25: the rails, ticket and drum dim to 15%.
  - 0.15 to 0.35: construction. The thread chart takes the rails' place: x = draws 0 to 40, y = lead, with a zero line (chalk 55%).
  - 0.35 to 0.90: 64 threads (seeds 1 to 64, one `PenBatch`, chalk at 28%) draw on together left to right, followed by the story run's thread (seed 78331) in #91C640 (hot head).
  - 0.90 to 1.00: labels.
- **Camera**: az 0, el 0, fit the chart box (P [-5.8, -5.8, 0]..[5.8, 4.6, 0]).
- **Labels**: tick "DRAWS", ticks "0", "10", "20", "30", "40"; name "GENERALIST AHEAD" above zero; name "A SPECIALIST AHEAD" below zero; callout "THIS RUN" on the bright thread's end; legend (pinned top-left): "EVERY LINE IS ONE RANDOM HOPPER".
- **L13 note**: "Each line is its own random hopper" is the only chart-reading sentence allowed in any caption. It makes no fitness claim.
- **Learning outcome**: the result is not a lucky draw; it holds for every hopper.

**Label lexicon (hopper)**:
- `HOPPER_DOMAINS` labels and their uppercase forms;
- task names;
- "DRAW N";
- `shortName` of each roster athlete;
- "P1" to "P6", "LEAD", "NEW LEADER", totals {computed};
- the chart strings in H6;
- "Generalist", "Top specialist" (explore).

**SDF (hopper)**: the ticket kicker and task name only.

**Explore (hopper)**:
- It starts from the draw-40 state.
- Peek: **Draw** (solid #019644, 52 px), "x10", "x40".
- Expanded: "New run" (a fresh seed from `crypto.getRandomValues`, allowed only in explore; the seed is shown as small mono "run 51837"), "Reset" (back to seed 78331 at draw 40), a toggle between "Rails" and "Every run" (the thread chart), and the readouts "Generalist" and "Top specialist" (totals, the existing `wf-pct-row` idea) plus "Leader".
- Tapping a rail shows that athlete's five `HOPPER_ROSTER` domain scores as five mini bars in the domain colours.
- Orbit: az +/-40, el from 0 to 35.

**Acceptance (hopper)**:
- [ ] H0 phone: the drum fills the upper part of the focus rect with visible steel reflections (HIGH/MEDIUM) and balls spread through the drum, not clumped. The legend has 5 domain chips.
- [ ] H1: a ticket reading "DRAW 1 - WEIGHTLIFTING" and "1RM BACK SQUAT", legible at 390.
- [ ] H2: six rails with names, badges P1 to P6, orange bricks, "LEAD" on the Weightlifter, totals readable.
- [ ] H3: LEAD on the Strongman. Bricks in orange, green and cyan (WL, OO, MONO).
- [ ] H4: ticket "CLIMB 6 FLIGHTS WITH BAGS". The Generalist rail at P1 with "NEW LEADER".
- [ ] H5: Generalist P1 with total 3185; every rail shows coloured bands; the HUD reads "DRAW 40".
- [ ] H6: a zero line, many chalk threads, one bright yellow-green thread, all labels readable and non-overlapping, the rails dimmed.
- [ ] Opening `/fitness/hopper` never shows an all-zero scoreboard in any beat at t = 1.

---

### D.4 PATHWAYS (`/fitness/pathways`): "Three engines, one river" (7 beats)

**Math** (`pathwaysMath.ts`, moved verbatim): `T_MIN` 3, `T_MAX` 3600, `interpAtU`, `rawContribAtT`, `contribAtT`, `envelopeAtT`, `powerHeightFrac`, `dominantOf`, `HEIGHT_NORM`, `PEAK_ORDER_TEXT`, `sliderToT`, `tToSlider`.

**Chart frame**: `useChartFrame({ FH: 10, minAspect: 0.78, maxAspect: 1.6, marginPx: { left: 44, bottom: 40, top: 16, right: 12 } })`. Time uses `logAxis(3, 3600)`: u = logU(t).

**Stacked mode** (P0 to P3, P5 and P6):
- Three extruded slabs (front face, top face and a thin side, 0.6 deep on Z, 150 x-segments), stacked bottom to top as oxidative, glycolytic, phosphagen.
- Each layer's thickness at u = `powerHeightFrac(key, t) * FH / 1.2`, so the stack top is the envelope.
- Materials: `rimStandard` (roughness 0.6) in the engine colour at fill alpha 0.35, plus a 3 px pen on each layer's top edge.
- A chalk envelope pen sits on top.

**River** (the Lumen graft, L9): one `LightField`-style Points system, the "flow" mode of the lightField material.
- Each mote has a fixed height `h` in [0, maxThickness] and a flow phase. Its u = fract(phase + 0.035 x A), and it is lit only while `h < thickness(u)` of its band, so density per unit area is constant.
- Colour is the band colour; size 2.2 px.
- Count: HIGH 6000, MEDIUM 3300, LOW 0 (the solid fills remain).
- Motes appear in a band only once that band has flooded.

**Lanes mode** (P4, explore):
- Each layer drops to its own baseline, stacked vertically: phosphagen lane at y = 0.70 FH, glycolytic at 0.35 FH, oxidative at 0.
- Each lane's height = `powerHeightFrac(key, t) * 0.30 FH`, one shared scale.
- Each lane gets its own 1 px baseline pen.

**Cursor**: a vertical chalk pen from the baseline to the top plus a 7 px hot node at the envelope.

**Benchmarks**: instanced pins at `ENERGY_BENCHMARKS` seconds, coloured by `dominant`. Marathon (12600 s) is never plotted on the axis; it is an edge chip "Marathon" with a chevron past the right end.

**Axis**: ticks at 3 s, 10 s, 30 s, 1 min, 2 min, 10 min and 1 hr (P drops 30 s and 2 min). Titles "Power output" and "Effort duration (log)" [PathwaysModule axis labels].

**HUD chip**: "SHARE OF ENERGY SUPPLY" plus three coloured percentages from `contribAtT(cursorT)`, from P1 onward.

#### P0 `three`, build 4.5
- **Caption**:
  - Title: **Three engines**
  - Body: "Three metabolic engines power all human action. Each dominates a different range of power and duration." [MODULE_COPY.pathways.body s1 to s2, para]
- **Scene**:
  - 0.00 to 0.30: construction. Axes and ticks draw.
  - 0.35 to 0.90: the pen draws the chalk envelope left to right (hot head), and a faint neutral fill (8%) rises under it.
- **Camera**: az -8, el 6, fov 26. Fit the chart box [-FW/2, -0.9, -0.4]..[FW/2, FH, 0.4], pad { l: 48, r: 16, t: 20, b: 44 } (room for ticks and axis titles). P1 to P3, P5 and P6 keep this pose.
- **Labels**: ticks and axis titles.
- **Learning outcome**: as an effort gets longer, the power you can produce falls.

#### P1 `phosphagen`, build 5.0; terms "Stored ATP and creatine phosphate" to phosphagen
- **Caption**:
  - Title: **Phosphagen**
  - Body: "Stored ATP and creatine phosphate. Immediate, explosive power, but the store is tiny and largely spent within 10 to 15 seconds." [ENERGY_SYSTEMS[0].fuel + description, para]
- **Scene**:
  - 0.05 to 0.35: the rose layer floods left to right across the whole axis.
  - 0.35 to 0.90: the cursor travels from 3 s to 15 s (`linear` in u), and the HUD updates. Phosphagen motes flow.
- **Labels**: callout at the cursor: `fmtDuration(t)` + " - " + dominant name + " " + share% {computed}; tick band "0 to 10 sec" [ENERGY_SYSTEMS[0].duration] under the axis.
- **Learning outcome**: the fastest engine gives the most power but runs out within seconds.

#### P2 `glycolytic`, build 4.5; terms "Muscle glycogen and blood glucose" to glycolytic
- **Caption**:
  - Title: **Glycolytic**
  - Body: "Muscle glycogen and blood glucose. It takes over as the phosphagens fall and peaks near 15 to 30 seconds." [ENERGY_SYSTEMS[1].fuel + description, para]
- **Scene**:
  - 0.05 to 0.35: the amber layer floods in beneath the rose layer.
  - 0.35 to 0.90: the cursor moves from 15 s to 30 s. The callout switches its dominant engine as `dominantOf` flips.
- **Labels**: band "10 sec to 2 min".
- **Learning outcome**: a second engine takes over as the first empties.

#### P3 `oxidative`, build 5.5; terms "Carbohydrate and fat with oxygen" to oxidative
- **Caption**:
  - Title: **Oxidative**
  - Body: "Carbohydrate and fat with oxygen. Slow to ramp but enormous in capacity, it overtakes the others past about 75 seconds." [ENERGY_SYSTEMS[2].fuel + description, para]
- **Scene**:
  - 0.05 to 0.35: the blue base layer rises from underneath and swells to the right.
  - 0.35 to 0.95: the cursor sweeps from 30 s to 1 hr, pausing (a flat window of 0.06 each) at 75 s and at 10 min.
  - Marathon edge chip at 0.9.
- **Labels**: band "2 min and beyond"; edge chip "Marathon".
- **Learning outcome**: the slow engine ends up supplying nearly everything in long efforts.

#### P4 `power`, build 5.5
- **Caption**:
  - Title: **Longest, not strongest**
  - Body: "Ribbon height is power output. Oxidative outlasts the others, it is not more powerful." [PathwaysModule.note, para]
- **Scene**:
  - 0.00 to 0.45: the morph (`morph`) separates the stack into three vertical lanes (each layer drops its stack offset, then moves to its lane baseline). The motes follow their bands.
  - 0.45 to 0.60: lane name callouts appear at each lane's peak.
  - 0.60 to 0.90: the claim. The pinned legend "Peak power order: Phosphagen > Glycolytic > Oxidative" [PathwaysModule.note with PEAK_ORDER_TEXT] draws in.
- **Camera**, which frames the lanes: az -4, el 3 (front-on, L12). Fit the three-lane box.
- **Learning outcome**: "dominant" and "most powerful" are different things. Oxidative lasts; it does not hit harder.

#### P5 `workouts`, build 6.5
- **Caption**:
  - Title: **The dominant engine changes**
  - Body: "Slide through effort duration and watch the dominant engine change." [MODULES[2].blurb s2, verbatim]
- **Scene**:
  - 0.00 to 0.30: the lanes morph back into the stack.
  - 0.25 to 0.45: benchmark pins drop (`snap`, 70 ms stagger) in their dominant colours.
  - 0.45 to 0.95: the cursor snaps pin to pin (`snap`, 0.12 each): 1RM Lift, then 400m, then Fran, then 5k Run. At each stop, a photo-finish flash (the cursor pen at x1.8 for 0.04) and a result chip (callout) with the benchmark name, `fmtDuration(seconds)` and the dominant engine name in its colour.
- **Labels**: pin names (the benchmark cluster Fran, 1 Mile Run and 2k Row stacks in 3 tiers with leader lines; "+N" collapse only as a last resort); result chip {computed}.
- **Learning outcome**: every familiar workout sits on this axis and has a lead engine.

#### P6 `all-three`, build 5.0
- **Caption**:
  - Title: **Train all three**
  - Body: "Total fitness requires training all three. Favoring one or two, and over-training the oxidative engine, are the most common faults." [MODULE_COPY.pathways.body s3 to s4, para]
- **Scene**:
  - 0.10 to 0.70: three duration brackets draw under the axis in the engine colours (10 s and 120 s boundaries from `ENERGY_SYSTEMS[].duration`), with a 150 ms stagger. Each band pulses once in sequence (x1.4 for 0.08).
  - 0.70 to 1.00: all three bands hold at full brightness; the cursor parks at Fran.
  - Impact accent 0.70 to 0.82.
- **Labels**: the brackets reuse the three duration strings.
- **Learning outcome**: real workouts span all three engines, so training has to as well.

**Label lexicon (pathways)**:
- engine names, fuels and the duration strings;
- `atpRate` / `atpYield` (explore);
- benchmark names and "Marathon";
- "Power output", "Effort duration (log)";
- ticks;
- "SHARE OF ENERGY SUPPLY", "Dominant engine", "Current effort";
- `PEAK_ORDER_TEXT` with the prefix "Peak power order:";
- "Power", "Share", "Stacked", "Lanes".

**SDF (pathways)**: none.

**Explore (pathways)**:
- Peek: the log duration slider (existing `sliderToT` / `tToSlider`).
- Expanded: benchmark chips (Marathon included; selecting it shows the edge chip and "beyond the axis" in its readout sub-line, using the axis label only), "Stacked | Lanes", **"Power | Share"** (Share normalises the total stack height to 100% so dominance reads; Power is the true envelope), the share readouts, "Dominant engine", the peak order note.
- "Scrub | Orbit" toggle: in Scrub, dragging anywhere on the chart moves the cursor.
- Tapping a pin jumps to it.
- Orbit: az +/-45, el from 0 to 35.

**Acceptance (pathways)**:
- [ ] P0 phone: the chart fills the focus rect width, with height at least 70% of the focus rect. The envelope curve and ticks are readable, and the time axis runs left to right.
- [ ] P1: the rose layer, the cursor at 15 s with its callout, the HUD with three percentages, and "0 to 10 sec".
- [ ] P3: blue base layer dominant on the right, "Marathon" edge chip at the right edge, nothing plotted past 1 hr.
- [ ] P4: three vertical lanes, front-on, rose tallest at left, blue low and long. The peak-order legend is readable.
- [ ] P5: pins visible, the result chip shows "5k Run" and "Oxidative", and the Fran / Mile / 2k labels do not overlap.
- [ ] P6: three coloured brackets under the axis with their duration strings.
- [ ] No particles on LOW (`?tier=low`), with fills still readable.

---

### D.5 DEFINITION (`/fitness/definition`): "The integral" (7 beats)

**Math** (`definitionMath.ts`, moved verbatim): `valAt`, `meanOf`, `scoreOf`, `scoreWord`, `scoreColor`, `curvePoints`.

**Axis**: `intervalAxis(POWER_DURATIONS)`. The 8 sample durations sit at u = i/7. A duration s between samples i and i+1 maps to u = (i + ln(s/D[i]) / ln(D[i+1]/D[i])) / 7. The curve is `valAt(samples, u)`, exactly the function `scoreOf` integrates, so the drawn area IS the score (F.1).

**Chart frame**: `FH` = 10 for v = 1.0, `minAspect` 0.68, `maxAspect` 1.5, margins left 48, bottom 64, top 22, right 28 (H.5, H.34).

**Elements**:
- ticks at all 8 `POWER_DURATION_LABELS` (P shows 1 s, 10 s, 1 min, 5 min, 30 min, 1 hr);
- y references at 0.5 and 1.0;
- `POWER_TASKS` dots (instanced, positioned on the interval axis);
- the active curve (a pen, 72 samples);
- domain curves (5 pens in one batch, z from -2.6 to 2.6);
- area: `AreaFill` plus `LightField`;
- energy bands: the three `ENERGY_SYSTEMS` duration ranges as 12%-alpha strips under the axis, with boundaries at 10 s and 120 s mapped through the interval axis.

**Domain honesty**: domain curve d is drawn as `valAt(samples, u) * tilt[d] / mean(tilt)`, so the five curves average exactly to the stored curve (F.2).

**LightField counts**: HIGH 9000, MEDIUM 5000, LOW 0 (LOW pours the solid `AreaFill` using `level`).

**HUD chip** from D3: "AREA" (eyebrow) plus the score readout {computed, counting}.

#### D0 `measured`, build 3.4 (H.30, H.31)
- **Caption**:
  - Title: **Power is measurable**
  - Body: "Power is force times distance over time. How much weight, how far, how long: that is a valid measure of fitness." [MODULE_COPY.definition.keyPoints[0] + DEFINITION_TEXT s4, para]
- **Scene** (it moves from the first frame; the build starts as the slate fades):
  - 0.00 to 0.26: construction. A HOT pen draws the axes as ONE continuous L stroke (down the power axis, then along the time axis), with its luminous head and tail glow; the grid and tick marks follow (0.10 to 0.34).
  - 0.30 to 0.40: one dot snaps in at "400m run" (55 s), at the Generalist's `valAt` there, with a single ring of light (Ripple, 0.30 to 0.50, about 600 ms).
  - 0.40 to 0.60: dashed chalk dimension lines are drawn FROM the dot to both axes (a measured point), their pen heads leading.
  - 0.52 to 0.62: the name "400m run".
  - 0.62 to 0.92: the other nine `POWER_TASKS` dots snap in, staggered: more measured points, not a new idea (L1).
- **Camera** (H.21): az 0, el 0, fov 22, exactly front-on. Fit the chart box with the H.5 pad. D1, D3, D4, D5 and explore use the same pose.
- **Labels**: "Power output", "Effort duration"; name "400m run"; ticks (phone: 1 s, 10 s, 1 min, 15 min, 1 hr; H.31).
- **Learning outcome**: one effort gives one measured point: its duration and its power; every effort gives one.

#### D1 `curve`, build 4.6 (H.30, H.31)
- **Caption**:
  - Title: **Power falls with duration**
  - Body: "At each effort duration there is a highest average power you can hold, and as duration grows that power falls." [POWER_CONCEPT s2, para]
- **Scene**:
  - 0.00 to 0.12: the dimension lines fade.
  - 0.00 to 0.52: the hot pen draws the Generalist curve THROUGH the ten dots in #91C640, 3 px; each dot flares (a glow and a small swell) at the moment the pen head passes it, and its task name (if it has one) appears then.
  - 0.60 to 0.84: the energy bands fade in under the axis (a callback to chapter 03).
- **Labels**: task names for 1RM clean, 400m run, Mile run and 10k run only (the other six are dots; H.23); the three band duration strings: over their bands on L, a pinned key top-right on P (the bands are too narrow there; H.31).
- **Learning outcome**: the measured points form one falling curve on the same time axis as the energy chapter.

#### D2 `domains`, build 5.5
- **Caption**:
  - Title: **Every modal domain**
  - Body: "CrossFit adds one move: average the curve across every modal domain. The hopper supplies the domains." [POWER_CONCEPT s4 + MODULE_COPY.definition.body s3, para]
- **Scene**:
  - 0.00 to 0.35: the curve fans out in depth into five domain curves (`MODAL_DOMAINS` colours), each over a translucent slice down to its own baseline, so the layers read as slices in depth (H.21, H.32): normal blending, drawn back to front, light only in a hem under each curve plus a bright top edge. The grid and the dots step aside while the slices are apart.
  - 0.35 to 0.50: hold.
  - 0.50 to 0.85: the slices converge in depth (z to 0) and fade; the five curves keep their own heights and dim to faint ghosts around the averaged #91C640 curve, which flares once as it absorbs them (0.66 to 0.98). The dots return on the averaged curve. The ghosts fade early in D3, so the end state shows the averaging (H.32).
- **Camera**, which reveals domain depth and then returns: `keys` at t 0.35 and 0.5 are L az -30, el 18 and P az -32, el 22, fitting the fanned VOLUME (baseline to the top of the curves, full depth); the beat ends front-on (H.21).
- **Labels**: all five `MODAL_DOMAINS[].name` names are `required`. L: direct labels at the right ends while the slices are apart, then a five-row key pinned top-right once they converge. P: a five-row legend pinned top-right (the right ends crowd at 360 to 430 px; H.21). The key stays through t = 1 so the ghosts are named in the end state (the reduced-motion frame), and leaves at the start of D3 (H.32).
- **Learning outcome**: the curve is an average over every kind of task.

#### D3 `area`, build 5.0 (signature beat)
- **Caption**:
  - Title: **Area = fitness**
  - Body: "Fitness is the area under that averaged curve. It is measurable, it is observable, and it leaves no room for opinion." [MODULE_COPY.definition.keyPoints[2] + DEFINITION_TEXT s3, para]
- **Scene**:
  - 0.05 to 0.78: POUR. The level rises from 0 to 1.08, and particles fall into their slots under the curve (`LightField` mode pour, HOT: it is the speaking element).
  - (H.20) The area is LUMINOUS at rest: an additive gradient fill that gathers toward the curve (gamma 1.8) plus a thin HDR rim band under the curve that bloom lifts into a glow under the crisp pen; the settled particles relax into a fine sparkle. The claim plate has an ink keyline.
  - The HUD readout counts `round(150 * mean over u of min(level, valAt))`, the same 64 samples `scoreOf` uses, ending at 94.
  - The crisp #91C640 curve pen stays on top (L10).
  - 0.80 to 1.00: the claim. SDF "AREA = FITNESS" (Barlow Bold, ink on a #91C640 plate) settles inside the area. The word "Broad" [scoreWord] appears in the HUD sub-line.
  - Impact accent 0.80 to 0.92.
- **Camera**: front-on (H.21).
- **Learning outcome**: fitness is one number, the accumulated area.

#### D4 `synthesis`, build 4.5
- **Caption**:
  - Title: **The models combine**
  - Body: "The ten skills set its height, the hopper supplies the domains, the pathways are the time axis." [MODULE_COPY.definition.body s3, verbatim]
- **Scene** (annotation only; the area stays). Three strokes of light, each landing on the part of the picture its model supplies, then its callout (H.22):
  - 0.04 to 0.30: a hot pen draws up the power axis; callout "HEIGHT: THE 10 SKILLS" sits at the top of that axis (the axis title yields to it).
  - 0.34 to 0.60: a hot pen retraces the averaged curve; callout "DOMAINS: THE HOPPER" with five domain swatches is leadered to the curve.
  - 0.64 to 0.90: a hot pen sweeps the time axis and the energy bands brighten; callout "TIME: THE PATHWAYS" sits under the tick row (the axis title yields to it).
  - The claim plate is a label obstacle, so no callout ever covers it. The depth comb is removed (front-on, it overprinted the axis).
- **Camera**: unchanged (front-on).
- **Labels**: those three callouts [paraphrase of MODULE_COPY.definition.body s3].
- **Learning outcome**: the three earlier models are the axes of this one picture.

#### D5 `specialist`, build 5.5
- **Caption**:
  - Title: **One zone, or the integral**
  - Body: "A specialist wins one point on the axis. The generalist wins the integral." [POWER_CONCEPT s6 to s7, verbatim]
- **Scene**:
  - 0.00 to 0.20: the Generalist curve dims to a ghost (#91C640 at 45%), with name "Generalist, for scale" [DefinitionModule label].
  - 0.15 to 0.50: the pen draws the Powerlifter curve as a dashed chalk line.
  - 0.45 to 0.90: `uMix` goes from 0 to 1. Spilling particles fall with a visible downward streak (H.22).
  - 0.50 to 0.90: the lost region between the two curves is marked with a `PAL.sick` hatch (25 to 35%), bounded by the generalist ghost and the dashed Powerlifter edge; it stays at rest.
  - 0.60 to 0.85: the zone won (u below the crossing) fills solid `PAL.both` with a crisp amber edge; "ZONE WON" is leadered into it.
    - Particles inside the Generalist area but outside the Powerlifter's SPILL: they fall, tint `PAL.sick` and fade.
    - Particles inside the Powerlifter's area but outside the Generalist's CONDENSE in amber: the sliver at u < 0.071, the shortest efforts.
    - The rest turn chalk at 60%.
  - The HUD counts from 94 down to 37.
- **Camera**: az 0, el 0, fov 22 (front-on comparison, L12).
- **HUD**: the number is chalk while counting and takes `scoreColor` when the word lands (L8; H.22).
- **Labels**: callout "Powerlifter"; callout "ZONE WON" on the amber sliver [para of "A specialist owns one zone"]; callout "AREA LOST" on the spill region [para of "lose the area"]; readouts "37" and "94" {computed scoreOf} with the names.
- **Learning outcome**: winning at one duration loses the area everywhere else.

#### D6 `lineup`, build 5.5 (H.33)
- **Caption**:
  - Title: **The whole curve**
  - Body: "A specialist owns one zone; the generalist defends the whole curve." [MODULE_COPY.definition.body s4, verbatim]
- **Scene** (each row is ONE unit on a faint glass plate):
  - 0.00 to 0.30: the main chart shrinks, FLIP-style, into row 1 of the ranked lineup (P and desktop: one column of seven rows; a short landscape stage: two columns with rank badges carrying the order). All minis share one scale.
  - 0.28 to 0.80: the other six rows land, 80 ms stagger; the light pours up into each mini as it lands. Each mini is a luminous area (the D3 treatment: lime for the Generalist, whose rim blooms; dim chalk with a bright edge for the specialists) with a crisp top pen.
  - 0.36 to 0.98: each row's score bar (7 px, row colour) grows along its mini's baseline on one shared 0 to 100 scale over a faint track, with a light at its growing end, so the ranking reads as a staircase of light without reading a number.
  - Order (by `scoreOf`): Generalist CrossFitter 94, Team-sport Athlete 86, Triathlete 84, Marathoner 77, 100m Sprinter 66, Powerlifter 37, Sedentary Adult 33.
- **Camera**: az 0, el 0, fov 22 (front-on, L12; the minis are light, not slabs). Fit the lineup.
- **Labels**: per row, tight above its mini: a rank badge "P1" to "P7" {computed rank} with the name (left) and the score pill (right): "94 Broad" style {computed scoreOf and scoreWord} on every row, or the number only on every row in the two-column layout (never a mix).
- **Learning outcome**: ranked by area, the generalist beats every specialist.

**Label lexicon (definition)**:
- "Power output", "Effort duration";
- `POWER_DURATION_LABELS`, "0.5", "1.0";
- `POWER_TASKS` names;
- `MODAL_DOMAINS` names;
- the `ENERGY_SYSTEMS` duration strings;
- "Generalist, for scale";
- `POWER_CURVES` names;
- scores, `scoreWord` and the rank badges "P1" to "P7" {computed};
- the three D4 callouts, "ZONE WON", "AREA LOST", "AREA";
- "Fitness, area under the curve" (explore).

**SDF (definition)**: "AREA = FITNESS".

**Explore (definition)**:
- Peek: athlete chips (7).
- Expanded:
  - the "Show the 5 modal domains" toggle (existing string);
  - the ghost generalist (on for specialists);
  - the readout "Fitness, area under the curve" with score/100 and word (existing);
  - the note "P(t) = CP + W prime / t is the sustained tail." (existing, explore only, never in a story caption);
  - "Scrub | Orbit": in Scrub, a vertical probe shows relative power for the athlete and the generalist at that duration {computed valAt}.
- Choosing a specialist replays that athlete's spill/condense (damped, not T-driven).
- Orbit: az +/-55, el from 0 to 45.

**Acceptance (definition)**:
- [ ] D0 phone: the chart fills the focus rect with a tall aspect; the axes are drawn by a visibly glowing pen; one dot lands with a ring of light and gets dashed dimension lines to both axes, then the other nine dots; ticks readable and at least 12 px apart.
- [ ] D1: ten dots on the curve; task labels readable with no overlaps (some may be hidden by priority, but never clipped); energy bands visible under the axis.
- [ ] Registration: every tick label sits exactly under its sample vertex (within 2 px).
- [ ] D2: five coloured domain slices fanned in depth, each distinct (no milky wash), with names readable; at t = 1 five faint ghosts around the averaged curve.
- [ ] D3: the area filled with light (MEDIUM/HIGH) or solid (LOW), the crisp curve on top, "AREA = FITNESS" inside, the HUD at 94 "Broad".
- [ ] D5: front-on; dashed chalk Powerlifter curve; red spill particles mid-fall or gone at t = 1 (at t = 1 only the condensed amber sliver and chalk remainder are lit); callouts "ZONE WON" and "AREA LOST"; HUD 37.
- [ ] D6 phone: seven rows ranked 94, 86, 84, 77, 66, 37, 33, each one unit (badge, name and pill tight above a lit mini standing on its bar), the score word on every row, bars reading as a staircase, the Generalist row in yellow-green.

---

### D.6 CONTINUUM (`/fitness/continuum`): "From one line to the dial" (7 beats)

**Math** (`continuumMath.ts`): `stateWord`, `fmtMarker` and `SHORT_NAME` moved verbatim; `markerValueAt` from fitnessData.
- `meanOf(positions) = positions.reduce((s, v) => s + v, 0) / positions.length` in BIOMARKERS order. The word is always `stateWord(meanOf(...))`. For the "CrossFit athlete" profile this evaluates to 0.8799999999999999, so FIT (F.4). Never hard-code a state word.
- The spoke / dial geometry is new (a full circle).

**Parallel phase**: rows in chart space via `useChartFrame({ FH: 11, minAspect: 0.9, maxAspect: 1.6 })`.
- Row i sits at y = FH - 1.1 i (i in BIOMARKERS order), running from x = -FW/2 to FW/2.
- Better is always to the right, so lower-is-better markers read decreasing.
- Ticks at positions 0, 0.5, 0.82 and 1 show sick, well, fit and elite via `markerValueAt`.

**Dial phase**:
- Centre (0, 0, 0), R = 7, hub 0.6. Ten spokes on a FULL circle at angle 90 - 36i degrees.
- Zone disc: a shader disc of `spectrum(r)` at 16% alpha, with circles at r = 0.5 (WELL) and r = 0.82 (FIT).
- **Bowl**: the disc and spokes displace along -Z by `1.4 * (1 - r/R)^2` (the centre is 1.4 deeper), so sickness is a pit (Lumen graft). This is invisible front-on, and revealed by the C4 tilt.

**Person**:
- instanced dots on the spokes (riding the bowl surface);
- a polygon fill in `spectrum(mean)` at 30%;
- a 3 px outline;
- a centre orb (`rimStandard`, coloured by `stateWord`);
- the SDF state word above the orb (Anton, 0.9).

**Portrait key** (P only, from C3 on): a DOM panel under the dial with 2 columns x 5 rows, each row "spectrum dot + SHORT_NAME + live value" via `fmtMarker(markerValueAt(m, pos), unit)`.
- It is registered as an obstacle, and the focus rect for fitting excludes it.
- Tapping a row highlights its spoke.
- Landscape shows names and values at the spoke tips instead.

**HUD chip** (L only, from C4): "TOWARD FITNESS" plus score/100 {computed, `Math.round(mean * 100)`}. In P it is the key's header row.

#### C0 `one-line`, build 4.0
- **Caption**:
  - Title: **One continuum**
  - Body: "Nearly every measurable value of health sits on one continuum, from sickness, through wellness, to fitness." [MODULE_COPY.continuum.body s1, para]
- **Scene**:
  - 0.10 to 0.70: the pen draws one horizontal line at the row-1 position, with a `spectrum` gradient along its length (hot head).
  - 0.70 to 1.00: three callouts land.
- **Camera**: az 0, el 0, fov 28. Fit the line with a 2-unit margin.
- **Labels**: callouts "SICKNESS" (`PAL.sick`), "WELLNESS" (`PAL.well`), "FITNESS" (`PAL.fit`) at 0, 0.5 and 1 [MODULE_COPY.continuum.body words].
- **Learning outcome**: health is a position on a line, not a yes or no.

#### C1 `bp`, build 4.5
- **Caption**:
  - Title: **Blood pressure**
  - Body: "A blood pressure of 160/95 is pathological, 120/70 is healthy, and 105/55 is an athlete." [MODULE_COPY.continuum.body s2, verbatim]
- **Scene**:
  - The line becomes the "Systolic blood pressure" row, with ticks 160, 120, 110 and 105 mmHg.
  - 0.30 to 0.95: a bead slides from 0 to 1, holding for 0.08 at 0, 0.5 and 1.
- **Labels**: row name "Systolic BP"; the bead's callout reads "160/95", "120/70" and "105/55" [CONTINUUM_EXAMPLES[0]] as it passes those positions.
- **Learning outcome**: a real clinical number sits on this line, and better means further right.

#### C2 `bodyfat`, build 4.0
- **Caption**:
  - Title: **Body fat**
  - Body: "Body fat: 40 percent is pathological, 20 percent is healthy, 10 percent is fit." [CONTINUUM_EXAMPLES[1], verbatim]
- **Scene**:
  - 0.00 to 0.25: the BP row moves up to its slot.
  - 0.20 to 0.45: the "Body fat" row draws, with ticks 40, 20, 12 and 8 %.
  - 0.45 to 0.95: a bead pins "40%" at 0, "20%" at 0.5 and "10%" at 0.91 (where `markerValueAt` = 10).
- **Labels**: row name "Body fat"; bead callouts; callout "LOWER IS BETTER" {from `betterDirection`} at the row's left end.
- **Learning outcome**: a completely different marker follows the same ordering.

#### C3 `dial`, build 6.0
- **Caption**:
  - Title: **Dozens of markers**
  - Body: "The same ordering holds for bone density, triglycerides, HDL, and dozens more. Center is sickness, the rim is fitness." [CONTINUUM_EXAMPLES[2] + ContinuumModule.note, verbatim]
- **Scene**:
  - 0.00 to 0.40: the other eight rows cascade in (80 ms stagger) with `SHORT_NAME` labels.
  - 0.45 to 0.95: the MORPH (`morph`, signature). Each row's left end slides to the centre, each row rotates to its spoke angle, and each row's scale matches R. The tick marks become the WELL and FIT circles, the labels ride their spoke tips, and the zone disc fades in. One per-row transform drives lines and labels alike.
  - P: the key panel fades in at 0.85.
- **Camera**: refits to the dial. az 0, el 0, fit [-8.2, -8.2, 0]..[8.2, 8.2, 0], pad 56 (P fits above the key).
- **Labels**: `SHORT_NAME` for all ten; "WELL", "FIT" ticks on the circles.
- **Learning outcome**: every marker is one spoke of the same instrument.

#### C4 `well`, build 4.5
- **Caption**:
  - Title: **Wellness is the midpoint**
  - Body: "Wellness is the midpoint, not the goal." [MODULE_COPY.continuum.keyPoints[1], verbatim]
- **Scene**:
  - 0.00 to 0.35: the camera tilts and reveals the bowl: the centre is a pit.
  - 0.30 to 0.70: the "Average / well" profile dots climb out of the pit to their positions (`settle`, 60 ms stagger).
  - 0.65 to 0.85: the polygon joins and fills.
  - 0.85 to 1.00: the claim. The orb lights, and the SDF word (`stateWord`, WELL) rises.
- **Camera**, which reveals the bowl depth: az 0, el 24.
- **Labels**: the P key values update {computed}.
- **Learning outcome**: "normal" is only halfway out of the pit.

#### C5 `super`, build 5.0
- **Caption**:
  - Title: **Fitness is super-wellness**
  - Body: "Sickness, wellness, and fitness are measures of the same thing, so fitness is super-wellness." [MODULE_COPY.continuum.body s4, para]
- **Scene**:
  - 0.00 to 0.15: the WELL polygon becomes a dashed ghost.
  - 0.15 to 0.75: the dots climb to "CrossFit athlete". The polygon's colour moves along the spectrum.
  - 0.75 to 0.95: the orb and word morph to `stateWord`.
  - Impact accent 0.78 to 0.90.
- **Camera**: back to az 0, el 8 for the overlaid comparison (L6, L12). The pit still reads faintly.
- **Learning outcome**: fitness is the same scale as health, pushed further out.

#### C6 `hedge`, build 4.5
- **Caption**:
  - Title: **Preventive medicine**
  - Body: "Fitness pushes every marker as far from sickness as it goes. Pursuing it is a hedge against disease." [MODULE_COPY.continuum.keyPoints[2] + keyPoints[3], para]
- **Scene**:
  - 0.10 to 0.70: the band between the WELL circle and the athlete polygon lights (the zone disc brightened x2 inside that band only; no new hue).
  - 0.70 to 1.00: the pit darkens by 20%.
- **Camera**: unchanged (az 0, el 8).
- **Labels**: callout "Preventive medicine" [keyPoints[3] word] on the lit band.
- **Learning outcome**: the margin beyond wellness is protection.

**Label lexicon (continuum)**:
- "SICKNESS", "WELLNESS", "FITNESS", "WELL", "FIT";
- `SHORT_NAME` values and full BIOMARKERS names (tap callouts);
- tick values from BIOMARKERS {computed format};
- "160/95", "120/70", "105/55", "40%", "20%", "10%";
- "LOWER IS BETTER" / "HIGHER IS BETTER";
- "TOWARD FITNESS";
- "Preventive medicine";
- `CONTINUUM_PROFILES` names, "Custom", "Overall state".

**SDF (continuum)**: the state word.

**Explore (continuum)**:
- Peek: profile chips (Sedentary, Average / well, CrossFit athlete, Custom).
- **Drag handles** on every dot, constrained to its spoke. This switches the profile to Custom.
- Tapping a spoke or key row shows a callout with the full name, the current value, and its sick / well / fit values plus "LOWER IS BETTER" or "HIGHER IS BETTER".
- Expanded: the 10 existing sliders, the readout "Overall state" + score/100 "toward fitness" (existing), and the L1 example line (CONTINUUM_EXAMPLES[0], existing).
- Orbit: az +/-25, el from -5 to 35.

**Acceptance (continuum)**:
- [ ] C1 phone: one row, ticks readable, bead at the right end with "105/55".
- [ ] C2: two rows; "LOWER IS BETTER"; bead at "10%" left of the right end (position 0.91).
- [ ] C3 phone: a full-circle dial with ten spoke labels, none clipped at 360 or overlapping; the key panel below the dial, fully above the caption card.
- [ ] C4: the tilt makes the pit visible (the centre reads darker and deeper); amber polygon; SDF "WELL".
- [ ] C5: polygon near the rim, dashed WELL ghost, SDF word equal to `stateWord` of the athlete mean (FIT); nothing hard-codes it.
- [ ] C6: the lit margin band between the WELL circle and the polygon.
- [ ] Desktop C3 to C6: names and values at the spoke tips, no key panel, HUD "TOWARD FITNESS".

---

### D.7 HEALTH (`/fitness/health`): "Stack every age" (7 beats)

**Math** (`healthMath.ts`, moved verbatim): `EXTRA_PROFILES`, `ALL_PROFILES`, `sliceMean`, `healthScore`, `fitnessAt`, `gridFor`, `AGE_MIN` 20, `AGE_MAX` 85, `HEALTH_SCALE`, `FITNESS_SCALE`, `ND` 56, `NA` 46. The story uses `AGING_PROFILES` only; explore keeps all 7 (F.6).

**World**:
- x from -10 to 10 is duration u from 0 to 1 (interval axis semantics; only the end ticks "1 s" and "1 hr" are shown, because DURATION_SHAPE carries no intermediate durations).
- z runs from 9 (age 20) to -9 (age 85); `YS` = 7.2.
- **Surface**: the 56 x 46 grid with the B.9 surface material (`spectrum(cap / 0.9)` vertex colours, isolines, below-line tint).
- **Morphs**: the CPU blends two `gridFor` arrays with per-vertex weights that are pure functions of T. Normals are recomputed on every frame the grid changes (2576 vertices; cheap). Never every Nth frame.
- **Skirt** (volume walls): a vertical gradient, translucent.
- **Slices**: 14 translucent area cards at ages 20, 25, ... 85, merged, with a per-slice attribute for a staggered reveal in the shader.
- **Age slice**: an amber (`PAL.well`) pen plus a fill.
- **Independence plane**: `PAL.sick` at 10% at y = `INDEPENDENCE_LINE * YS`, with a crisp red pen edge along the front (L10).
- **Ghost**: an isoline-only duplicate surface.
- **Scanner** (L5): a thin vertical #91C640 plane across x at the scanner's age, hot.

**Labels**: "1 s", "1 hr", "DURATION", "AGE", ages "20", "40", "60", "80", "CAPACITY" (tick tone).

**HUD chip** from L2: "VOLUME = HEALTH" plus `healthScore` {computed}.

**Fog** on.

#### L0 `slice`, build 4.0
- **Caption**:
  - Title: **A curve for every age**
  - Body: "Add a third axis to the fitness curve: age. Every age of your life has its own power-duration curve." [MODULE_COPY.health.body s1 to s2, verbatim]
- **Scene**: a callback to chapter 04. Only the age-30 slice of the Lifelong trainer is shown, front-on.
  - 0.10 to 0.60: the pen draws the curve.
  - 0.55 to 0.85: the area sweeps in #91C640.
- **Camera**: az 0, el 4, fov 30. Fit the slice [-10, 0, z30 - 0.5]..[10, 7.4, z30 + 0.5].
- **Labels**: callout "AGE 30" (`PAL.well`); "1 s", "1 hr".
- **Learning outcome**: the fitness curve from before belongs to one particular age.

#### L1 `stack`, build 6.0
- **Caption**:
  - Title: **Stack them**
  - Body: "Stack them and the three-dimensional solid that results is health." [MODULE_COPY.health.body s3, verbatim]
- **Scene**:
  - 0.00 to 0.35: the camera rises to reveal the age axis, and the age ticks fade in.
  - 0.20 to 0.75: the 14 slices fly in from the front one after another (90 ms stagger), each at its own age.
  - 0.75 to 0.95: they fuse: the slices fade out as the surface fades in.
- **Camera**, which reveals age: L az -34, el 30. P az -12, el 44. Fit the volume [-10, 0, -9]..[10, 7.4, 9], pad 40.
- **Learning outcome**: a whole life of fitness curves makes one landscape.

#### L2 `volume`, build 4.5 (signature material moment)
- **Caption**:
  - Title: **Volume = health**
  - Body: "Health is sustained work capacity across a lifetime, the volume under the surface, not merely living a long time." [MODULE_COPY.health.keyPoints[0] + body s4, para]
- **Scene**:
  - 0.10 to 0.60: the skirt walls rise and the translucent volume fills from the floor up (hot rim).
  - 0.55 to 0.85: the HUD counts up to `healthScore(Lifelong trainer)`.
  - 0.80 to 1.00: the claim. SDF "VOLUME = HEALTH" is laid on the floor in front (Anton, chalk 22%).
- **Learning outcome**: health is the amount of capacity kept across a life, measured as a volume.

#### L3 `line`, build 4.0
- **Caption**:
  - Title: **The independence line**
  - Body: "Below the independence line, daily tasks exceed capacity." [MODULE_COPY.health.body s6, para]
- **Scene**:
  - 0.10 to 0.60: the red plane rises into place.
  - 0.55 to 0.85: its front edge pen draws (hot). The surface's below-line tint is visible where the model dips under the plane.
- **Camera**: L el 34, P el 48 (a slight rise so the plane reads).
- **Labels**: callout "INDEPENDENCE LINE" (`PAL.sick`) [HealthModule label].
- **Learning outcome**: there is a floor below which daily life gets hard.

#### L4 `sink`, build 5.5
- **Caption**:
  - Title: **Stop training**
  - Body: "Stop training and the surface sinks toward the independence line. The power ridge collapses first." [MODULE_COPY.health.body s6 + AGING_PROFILES[2].trajectory, para]
- **Scene**:
  - 0.05 to 0.80: morph (`morph`) from Lifelong trainer to Sedentary. The red below-line region spreads, and the HUD counts down.
  - 0.80 to 1.00: a callout.
- **Labels**: callout "Independent through 70" [AGING_PROFILES[2].independentThrough as a string; never a drawn crossing marker, F.5]; name "Sedentary".
- **Learning outcome**: without training, the landscape sinks toward dependence.

#### L5 `any-age`, build 6.0 (signature beat)
- **Caption**:
  - Title: **Start at any age**
  - Body: "Start at any age and it lifts. Resistance and power training reclaim capacity, even into the 90s." [MODULE_COPY.health.body s7 + keyPoints[3], para]
- **Scene**:
  - 0.00 to 0.15: the scanner appears at age 45.
  - 0.15 to 0.85: the scanner sweeps from age 45 to 85 (`linear`). Behind it, vertices adopt "Starts at 50" with weight `smoothstep(age + 1.5, age - 1.5, scannerAge)`. The surface lifts like a wave, and the isolines step up at 48 to 55. At t = 1 the surface equals `gridFor(Starts at 50)` exactly.
  - Impact accent 0.30 to 0.42.
  - 0.85 to 1.00: a callout.
- **Labels**: callout "Independent through 85+" [AGING_PROFILES[3].independentThrough]; name "Starts at 50".
- **Learning outcome**: capacity is reclaimable, so it is never too late.

#### L6 `hold`, build 5.5
- **Caption**:
  - Title: **Hold it as long as you can**
  - Body: "Maximize the area under the curve and hold it for as long as you can." [MODULE_COPY.health.body s5, verbatim]
- **Scene**:
  - 0.00 to 0.45: morph to the Lifelong trainer, with a Sedentary isoline ghost underneath.
  - 0.40 to 0.90: the amber age slice sweeps from 20 to 85, with a readout "Fitness at age N" {computed `fitnessAt`} riding it.
  - 0.90 to 1.00: a callout.
- **Camera**: L az -40, el 26. P az -16, el 40.
- **Labels**: callout "Independent through 90+"; readouts "Lifelong trainer" and "Sedentary" volumes {computed healthScore}.
- **Learning outcome**: the goal is to keep the landscape high for as long as possible.

**Label lexicon (health)**:
- the axis strings above;
- "AGE 30";
- "INDEPENDENCE LINE";
- "Independent through X" (X from `independentThrough`);
- the `AGING_PROFILES` names (explore: `ALL_PROFILES` names);
- "Fitness at age N", "VOLUME = HEALTH", "Volume = Health" {computed values}.

**SDF (health)**: "VOLUME = HEALTH".

**Explore (health)**:
- Peek: profile chips (all 7 of `ALL_PROFILES`; the trajectory text is in the expanded sheet).
- **Drag handle**: the age slice (on the surface, along the age axis), plus the "Slice the surface at age" slider (existing, 20 to 85).
- Expanded: the independence line toggle (existing), "Compare" (the Lifelong ghost on or off), and the readouts Volume = Health, Fitness at age N and Independent through (existing).
- "Scrub | Orbit": in Scrub, a drag moves the slice.
- Orbit: az +/-75, el from 8 to 70.

**Acceptance (health)**:
- [ ] L0 phone: one front-on curve with a filled area, "AGE 30", "1 s" and "1 hr" readable.
- [ ] L1 phone: the full surface, with age receding up-screen; the age ticks 20, 40, 60, 80 readable at 11 px or more (today's 6 px text is gone).
- [ ] L2: a translucent volume under the surface, the HUD "VOLUME = HEALTH" with a number, SDF "VOLUME = HEALTH" on the floor.
- [ ] L3: the red plane with a crisp front edge and "INDEPENDENCE LINE".
- [ ] L4: a low sedentary surface with red below-line regions, "Independent through 70".
- [ ] L5: a surface visibly stepped up from age 50, the scanner at the far end, "Independent through 85+".
- [ ] L6: a high lifelong surface over the ghost, the amber slice at age 85, "Independent through 90+", two volume readouts.
- [ ] No drawn "crossing age" tick anywhere.

---

## E. Global acceptance checklist

Reviewers run the matrix below. Every screenshot uses `&tier=medium` (phone) or `&tier=high` (desktop) and waits for `data-story-ready="1"` (shoot.mjs `--wait=6000` is the minimum).

**Matrix**: every view x every beat x t in {0, 0.5, 1}, at 390x844 (touch), 360x780, 430x932 and 1440x900. Plus `?explore=1` per view. Plus a reduced-motion pass and a `/preview/` base-path pass.

1. [ ] **Labels readable and in frame**: at 360, 390 and 430, `__story.labels()` shows zero overlaps and zero clipped labels among visible labels, and no label renders below 11 px. No perspective-scaled text anywhere. drei `<Html>` is absent from the bundle's fitness chunks.
2. [ ] **No dead space**: at every beat end (t = 1), the subject's projected bounding box fills at least 85% of the focus rect in its constraining dimension, and its centre is within 5% of the focus-rect centre. The top 35% of the stage is never empty (except the deliberate I0 title composition).
3. [ ] **Captions never cover the subject**: no fitted subject pixel lies under the caption card at any detent, and the director re-fits on detent change.
4. [ ] **Phone-first composition**: the focus rect at 390x844 with the default detent is at least 60% of the screen height. All controls are at least 44 px. No horizontal page scroll at 360. Every beat can be reached with thumbs only (swipe or transport).
5. [ ] **Autoplay and pacing**: loading `/fitness/skills` with no query autoplays; nothing advances while a finger is down or a sheet is open; hold time scales with words; the last beat stops with the CTAs.
6. [ ] **Seek contract**: `?beat=N&t=X` renders exactly the same pixels on reload (a pixel diff under 0.5%, excluding grain; grain is off on MEDIUM). `(N, 1)` equals `(N+1, 0)` (the continuity assertion passes in dev).
7. [ ] **Reduced motion**: with `emulateMedia({ reducedMotion: 'reduce' })`, nothing autoplays, each beat shows its t = 1 state, next and prev cut, the transcript is expanded, and explore works.
8. [ ] **Both base paths**: the `/` and `/preview/` builds route to all seven views, load fonts, the PA logo and SDF fonts from the base, and deep links with `?beat` work under both.
9. [ ] **Both themes for chrome**: the top bar, chapter sheet, Notes and footer are correct in light and dark. The stage, caption card, labels and explore panel are identical in both themes.
10. [ ] **No dashes**: `dashcheck` over `src/fitness` passes (this file included).
11. [ ] **TS strict**: `tools/build.sh` passes for both the dev and preview builds.
12. [ ] **Mobile budget**: on every beat end and in explore, `__story.stats()` at `?tier=medium` shows at most 120 calls and at most 250k triangles. The design target is at most 45 total calls and at most 30k triangles.
13. [ ] **Memory**: after intro, skills, hopper, intro, `stats().geometries` and `stats().textures` are within 2 of their first intro values.
14. [ ] **Network**: a Playwright request log shows only the site origin, fonts.googleapis.com and fonts.gstatic.com (plus the existing analytics in `index.html`). No CDN HDRI, font or benchmark fetches.
15. [ ] **Console**: no errors or warnings from the fitness chunks during a full autoplay of each chapter. (Known outside the lesson: one THREE.Clock deprecation warning from module-level code in the app's shared vendor chunk, emitted before the lesson loads; H.36.)
16. [ ] **Colour truth**: the swatch test in B.10 passes on MEDIUM and LOW. No ACES anywhere.
17. [ ] **LOW tier**: `?tier=low` renders every beat legibly (halos instead of bloom, fills instead of particles), and the stage is never black.
18. [ ] **Copy audit**: `captionAudit.local.mjs` passes. `fitnessData.ts` is byte-identical to the base commit (`git diff --stat` shows no change to it).
19. [ ] **Keyboard**: Left / Right / Space / Home / End / E / Esc work on desktop, and focus rings are visible.
20. [ ] **No WebGL fallback**: with WebGL disabled, the captions, transport, transcript and Notes work, and the fallback panel shows.

---

## F. Data flags and owner decisions

These were found while designing. `fitnessData.ts` is not edited for any of them.

- **F.1 Capacity x axis (OWNER DECISION PENDING).** The live module draws curve samples index-uniformly (u = i/7) but places tick labels on a true log axis, so the 10 s sample is drawn at u 0.143 while its tick sits at u 0.281.
  - This spec adopts the **interval axis**: the ticks move to the samples, and nothing displayed changes. Scores stay Generalist 94, Team-sport 86, Triathlete 84, Marathoner 77, 100m Sprinter 66, Powerlifter 37, Sedentary 33.
  - If the owner prefers a true log axis (matching Pathways exactly), the honest area scores become roughly Generalist 94, Team-sport 88, Triathlete 81, 100m Sprinter 75, Marathoner 74, Powerlifter 48, Sedentary 34 (multiplier 142 on the true-log mean). Sprinter and Marathoner swap. Not adopted without his sign-off.
- **F.2 Domain tilts do not average to 1.** The row means are Generalist 0.984, Team-sport 0.984, Sprinter 0.912, Triathlete 0.888, Marathoner 0.842, Powerlifter 0.834, Sedentary 1.0. The display normalises by the mean (D.5).
- **F.3 Skills "breadth" contradicted the copy.** The Artistic Gymnast's mean (8.2) exceeds the Generalist's (7.7). The readout is replaced by Weakest skill and Range, and the Generalist has the unique highest floor (7).
- **F.4 Continuum boundary.** The CrossFit athlete mean is 0.8799999999999999, just under the ROBUST threshold, so `stateWord` returns FIT (the same as the live site). It is always computed, never hard-coded.
- **F.5 Health `independentThrough` is not a surface crossing.** It is shown only as text. No computed crossing marker is drawn.
- **F.6 Module-local profiles.** HealthModule's EXTRA_PROFILES (Detrained at 40, Masters competitor, Sedentary then active at 60) are module copy, not verified data. They appear in explore only, as today.
- **F.7 Marathon is off-axis** (12600 s beyond 3600 s). It is an edge chip, never clamped.
- **F.8 Fran appears twice**: 240 s in ENERGY_BENCHMARKS and 150 s in POWER_TASKS. Pathways shows Fran's duration. Definition shows the Fran dot by name only and never prints its duration. Owner to confirm which value is canonical.
- **F.9 Hopper randomness.** Story mode is seeded (78331), and explore "New run" is genuinely random. The H6 chart shows the result holds across 64 other seeds.

---

## G. Kept, retired, build order

**Kept**:
- `fitnessData.ts` (untouched), `lessonMath.ts`, `lessonTypes.ts`.
- The theme system and ThemeToggle, the footer and disclaimer, LessonNav, and the `ui.tsx` widgets (restyled).
- The ModulePage content blocks, which become the Notes.
- The zustand pushState router (made base-aware).
- Lazy chunks per chapter.
- Module math, moved verbatim into `stories/*/xMath.ts`:
  - Pathways: `interpAtU` and the rest listed in D.4;
  - Definition: `valAt`, `meanOf`, `scoreOf`, `scoreWord`, `scoreColor`;
  - Continuum: `stateWord`, `fmtMarker`, `SHORT_NAME`;
  - Health: `EXTRA_PROFILES`, `gridFor`, `healthScore`, `fitnessAt`, `sliceMean`;
  - Hopper: `shortName`, `primaryDomain`, `leaderOf`, and the `weightedDomain` weighting, seeded;
  - Skills: `rangeOf`, `angleAt`.
- Concepts: the dark PA stage, the Continuum dial, the energy ribbons (now the river and lanes), the drum, the ghost comparison, the independence line and the age slice.

**Retired**:
- `LessonStage.tsx` and all `modules/*.tsx` scenes (deleted once their story lands).
- drei `<Html>` labels and CanvasTexture sprite labels.
- ContactShadows, gridHelper, Canvas `shadows`.
- Always-on OrbitControls with auto-rotate.
- The About / Controls pills and the "drag to orbit" hint.
- The Hopper cage physics and the procedural humanoid figures.
- The phone horizontal nav row.
- The "Fitness breadth" readout.

**Merge gate** (H.37): `fitness-v2` merges to main only when no legacy LessonStage chapter is left, or when the legacy `NotFoundError: removeChild` on leaving one (H.24) is gone. Until then the story QA "navback" check logs it.

**Build order** (the foundation lead goes first; then chapters are built in parallel):
1. Foundation (one builder):
   - `story/*` engine;
   - shell (top bar, stage, card, transport, sheets, Notes, slate);
   - routing and base path;
   - tiers, post and stats;
   - label layer, camera director and kit;
   - gates C.15.
   
   Prove it on a tiny test story (3 beats) before handing off. Deliver `stories/index.ts` with stub StoryDefs so chapters can be developed independently.
2. Chapters, in parallel, one builder each:
   - Continuum (simplest geometry; validates the morph and the labels);
   - Skills;
   - Definition (validates LightField);
   - Pathways (reuses the LightField flow mode);
   - Health;
   - Hopper (the most bespoke).
3. Intro, last: it reuses the shape generators, the Definition curve and the Health surface builder.
4. QA pass against sections D and E. Fix, then write amendments into H.

Every commit is on `fitness-v2` only, ends with the two attribution lines, and passes C.15 first.

---

## H. Amendments

(Builders append dated entries here: what changed, why, and which acceptance item it serves.)

### 2026-09-26, foundation lead (engine + Definition exemplar)

- **H.1 Tone mapping is Khronos Neutral without its toe** (B.10, decision 3). Neutral's toe subtracts up to 0.04 in linear from dark channels and moves #91C640 to (136, 193, 35), which fails the B.10 swatch test by 30 units in blue. The engine uses the same curve minus the toe: colours below 0.76 pass through untouched, HDR highlights compress exactly as Neutral. Still never ACES. Serves E.16.
- **H.2 LOW mounts no EffectComposer.** The composer forces `NoToneMapping` on the renderer while mounted, even with `enabled={false}`. LOW renders directly with `THREE.CustomToneMapping` set to the H.1 curve. Serves E.16 and E.17.
- **H.3 Principal point = centre of the focus rect minus the pose padding** (C.8). With asymmetric label pads (Definition: l 48, b 56) the raw focus-rect centre wasted the difference on the opposite side. `fitDistance` is solved in closed form (each box corner gives a lower bound per screen edge), which is exactly what the specified bisection converges to. `CamPose.target` may be a function (the Definition lineup uses its box centre). Serves E.2.
- **H.4 Label hysteresis order** (C.9 step 4): preferred side first, then the side used last frame, then the rest. "Previous side first" stuck labels on a fallback side after any camera move. Two LabelSpec options were added: `only` (restrict sides; ticks use `['S']` so they stay registered under their vertex) and `dot` (name tone without the dot, used where the anchor is already a data dot). Serves E.1 and the D.5 registration check.
- **H.5 Definition chart padding** is `{ l: 48, r: 28, t: 22, b: 56 }` for both the frame margins and the camera fit. The right pad lets the "1 hr" tick centre under its vertex; the bottom pad fits the "Effort duration" title under the tick row at desktop type sizes. Serves the D.5 registration check and E.1.
- **H.6 Definition D2 fan pose** fits the plotted band (v 0 to 0.95, z +/-2.6) around its own centre, with right padding for the domain names. The az/el values are as specified.
- **H.7 Definition D3 meniscus.** The pour adds a hot pen at the rising level, from the power axis to the curve. On a phone, 2 px particles barely bloom, so the surface line is what reads as light pouring in. It is part of the pour (the one speaking element, L4), fades before the claim lands, and has no copy. The level rises linearly.
- **H.8 Definition D4 layout.** "TIME: THE PATHWAYS" is anchored at u 0.76 so the three callouts never stack. The depth tick comb is 1.1 tall at hero width so its five colours are visible at az -6.
- **H.9 Definition D6 lineup constants.** P: minis 10.8 x 1.25, row pitch 2.6. L: minis 8 x 1.75, pitch 3.25, two columns. Each row's name and its "94 Broad" readout share one line above the mini.
- **H.10 Autoplay waits for readiness.** The clock does not build while `data-story-ready` is 0, so nothing plays behind the slate. A safety valve marks the shaders compiled after 300 frames.
- **H.11 Energy bands** are 0.34-tall strips directly under the time axis. The three duration labels sit above the axis at their band centres (`only: N, NE, NW`), and the tick labels stay below it.
- **H.12 Explore header on phones.** Reset view is a 44 px icon button (aria-label "Reset view") at phone widths, so Back to story, Reset and Scrub | Orbit fit in one row at 360 px.
- **H.13 Unmigrated chapters.** Views that are not yet in `stories/index.ts` still render their legacy LessonStage module, inside the new shell (top bar, chapter chip and sheet, progress hairline). The intro is still legacy until its story lands.
- **H.14 Gates.** The C.15 grep gate and caption audit live in `scripts/fitness-gate.mjs`. It is committed and needs no Playwright. `window.__story` also has `project(x, y, z)`, which returns stage px for registration checks.

### 2026-09-27, foundation lead, fix round 1 (engine review + visual review)

- **H.15 Loaded is not settled** (C.4, B.7). The single `ready` flag meant two things. Every seek turned it off, so scrubbing hid the stage behind an opaque slate and set React state every frame. Now `store.loaded` is one-way per chapter (chunk, fonts, scene incl. SDF, compile, two frames) and drives the slate and autoplay; the QA "settled" state (loaded plus two frames after the latest seek) is written straight to `data-story-ready` and `__story.ready`. Serves E.4, E.6 and the scrubber.
- **H.16 Pacing** (C.3, L14). Reading starts at the caption swap, so the hold is `clamp(1.5 + 0.24 x words - 0.6 x build, 2, 7)`. Definition D0 builds in 3.0 s and D1 in 5.0 s with the curve pen starting at t 0.16, and the chapter pre-roll is 0.2 s. At 390 px the first curve now draws at about 10 s instead of 16 s, and the chapter runs about 65 s instead of 90 s. The D0 caption is 23 words, so a still faster opening would cut its reading time; not done.
- **H.17 Engine-owned chart frame and pick ray** (B.13, C.2, C.11). `StoryDef.frame` declares the frame; the engine computes it from the focus rect with one cache keyed by the options and the quantised aspect, so the camera (`fit(layout, frame)`, `target(layout, frame)`), gestures and the scene always see the same object and nothing writes a module global during render. `ExploreSpec.onScrub(ray, ndc, phase)` gets the same `THREE.Ray` a drag handle gets. `useCounter` is `{ value, format }` (the C.11 text was wrong).
- **H.18 Adaptive quality timing** (C.10). The PerformanceMonitor mounts per chapter only once it is loaded plus a 1.5 s grace, with a 3 s window (250 ms x 12), so the slate, compile and font load never demote a capable phone. Inclining out of LOW clears still mode.
- **H.19 Labels** (C.9). Caps are 36 LIVE labels (cue above zero) at any T and 96 registered per view: a seven-beat chapter registers each beat's labels once, so the old "36 per view" contradicted the chapter lexicons. Added: `required` (QA fails on `requiredHidden`), DOM and world obstacles (SDF plates, data dots, curve samples), label modes (story / explore / both), per-hook ownership with a duplicate-id warning and a warning when a `useLabels` array keeps changing identity, stacked pins with `pinOrder`, callout `swatches`. The placer is allocation-free and skips frames when nothing moved.
- **H.20 The luminous area** (B.9, B.10, D.5 D3). The Fill material gains additive blending, a gradient exponent and an HDR rim band of constant world width under the data edge (it whitens slightly at its hottest), so bloom lifts the top edge and the rested area reads as light, not speckle. LightField particles are 3 px with a hot core and relax into a sparkle once poured; MEDIUM `particleScale` is 0.8 (the MEDIUM frame uses about 27 of 120 calls). LOW keeps a solid gradient with a milder rim.
- **H.21 Front-on reading, decisive depth** (L12, D.5). Every beat read as a 2D chart (D0, D1, D3, D4, D5, explore) is az 0, el 0, fov 22: the az -6 / el 4 keystone looked like a mistake and stair-stepped the axes. D2 keeps a decisive oblique (L az -30 el 18, P az -32 el 22), fits the fanned volume instead of the flat chart, gives each domain a translucent curtain, and names all five domains (`required`) as direct labels on L and a pinned legend on P. Supersedes H.6.
- **H.22 Teaching clarity** (D.5 D4 to D6). D4 draws one stroke of light per model on the axis it names and anchors each callout there; the claim plate is a label obstacle; the depth comb is gone (supersedes H.8). D5 keeps the lost area visible as a red hatch and the won zone as a solid amber sliver with a crisp edge; spill particles streak downward. The HUD number is chalk while counting and takes `scoreColor` when the word lands (no yellow-green on a specialist's low score). D6 minis are taller on P (10.8 x 1.6, pitch 3.0) and each row has a shared-scale area bar, so the ranking is visible without numbers (supersedes H.9).
- **H.23 Four task names.** Only the four names D.5 prioritises are labelled (1RM clean, 400m run, Mile run, 10k run); the other six tasks are dots. Labels avoid the dots and the curve (world obstacles).
- **H.24 Known issue, legacy chapters only.** Navigating away from an unmigrated LessonStage chapter logs one `NotFoundError: removeChild` per navigation: react-dom removes a drei `<Html>` label node twice when that label unmounts inside R3F 9.8's commit (drei 10.7 unmounts its nested root synchronously there). Reproduced with and without an empty-Canvas pre-unmount, so it is not a teardown-order issue; the pages keep working. It disappears as each chapter migrates (no drei `<Html>` in stories). Not fixed by pinning R3F, which the brief does not allow.
- **H.25 Persistent stage, proven.** StoryView keeps the previous StoryDef mounted until the next resolves, and StoryStage keeps its tree position, so the Canvas, renderer, composer and environment survive a chapter change (decision 15). A context loss on an unmounted canvas is ignored; `webgl` is re-derived from a cached, released probe on every mount. `?qa=stub` puts a 3-beat stub story on chapters without one, so QA can prove the same canvas across a story-to-story change.
- **H.26 Prewarm rule.** A chapter mounts everything at load, its late beats and its explore layer included, and drives visibility from T and mode; the story scene stays mounted under explore. The engine compiles every material once the Scene mounts (three compiles hidden objects too), with a render target bound on composer tiers so it links the variant the composer uses. Toggling explore or reaching D6 creates no programs.
- **H.27 Shell and a11y.** On the finished last beat the transport Explore pill hides so the CTA row has one primary action; the next-chapter CTA says "Classic" while that chapter is still a legacy page; Next is labelled "Next chapter" on the last beat. Stepping keys are ignored in explore, with the sheet open, and inside radiogroups or sliders; the explore chip row is a roving radiogroup (`ChipRadio`); the chapter sheet moves focus in, traps Tab and restores focus; the beat scrubber is a focusable slider. Reduced motion, Show build and held steps reach 'done' on the last beat. A pause during a next / prev glide wins, and glides freeze while touching or hidden. User navigation and leaving explore drop `?beat`, `?t` and `?explore`. The explore peek shows whole rows only. In the light theme the wordmark accent is #019644 and the chapter numbers darken.
- **H.28 QA script.** `scripts/story-qa.mjs check <url> [view]` runs labels at 360 / 390 / 430 (overlaps, clipping, required, live cap), the stats budget, continuity pixels, scrub-without-slate, nav-away-and-back, persistent canvas (`?qa=stub`), keyboard and URL drift, and reduced motion. `shots` mode takes matrix screenshots.

### 2026-09-27, foundation lead, fix round 2 (engine review + visual review 2)

- **H.29 Adaptive quality never demotes a healthy device** (C.10, supersedes the C.10 monitor props and part of H.18). drei's own policy demoted every capable phone: it counts EVERY incline toward `flipflops` (a steady 60 fps phone passes 3 after four windows and `onFallback` forced LOW about 15 s in), and its first evaluation always fires `onChange` from a factor of 0.5 (a DPR cut at about 5 s). Now PerformanceMonitor only measures (`factor 1`, `flipflops Infinity`, no `onChange` or `onFallback`) and the engine decides: quality moves one step along a ladder of (tier, dpr) pairs (HIGH min(dpr,2) / 1.75 / 1.5, MEDIUM 2 / 1.75 / 1.5 / 1.25 / 1, LOW 1); a decline steps down at once and caps the chapter below the step it fell from; an incline counts only below that cap and only after four consecutive incline windows (about 12 s); inclines at the cap are ignored. A phone starts at MEDIUM 1.5 and may earn "medium+" (DPR up to 2) on a 2x or 3x screen. Only a tier step remounts the composer. `__story.qualityLog()` lists every change; story-qa runs the chapter unpinned at 3x on a virtual 60 fps clock and fails on any demotion. Serves E.12 and the owner's phone seeing the real signature frames.
- **H.30 Pacing v2** (C.3, supersedes H.16). hold = clamp(0.4 + 0.23 x words - build, 2, 7): a beat stays up for about 250 words per minute of its caption, counting the build (the caption is readable from t = 0). A chapter's first beat has no pre-roll: it builds while the slate fades. Definition D0 builds in 3.4 s, D1 in 4.6 s; at 390 px the axes pen is drawing at once and the first curve starts at about 6 s after the slate (was about 11 s); the chapter runs about 45 s.
- **H.31 Definition opening** (D.5 D0, D1). D0 moves from frame 1: the hot L-stroke axes (PenBatch now carries a head), the measured dot's ring of light (Ripple), dimension lines drawn from the dot with their heads, then the other nine measured points (the reviewer's suggestion: more measured points are not a new idea, L1 holds). D1's pen draws THROUGH the dots and each flares as the head passes (Glows, times computed from arc length), naming its task then. The pen head is two layers (hot core plus tinted halo) and stays full brightness on faint strokes, so it reads on MEDIUM's half-resolution bloom and on LOW. Phone ticks: 1 s, 10 s, 1 min, 15 min, 1 hr; the placer keeps 12 px between ticks (`sepPx`). Phone band strings are a pinned key (their bands are 40 to 150 px wide).
- **H.32 Definition D2 slices** (D.5 D2, refines H.21). Additive curtains stacked into a milky wash, because blending is in linear light where small alphas add fast. Now: normal blending back to front, light only in a hem under each curve (gamma 7) plus a bright top edge; the grid and the dots step aside while the slices are apart; on convergence the curves keep their heights as ghosts dimmed by colour (a translucent line shows its segment caps as beads) and the averaged curve flares as it absorbs them.
- **H.33 Definition D6 lineup** (D.5 D6, supersedes H.9 and the D6 part of H.22). Each row is one unit on a faint glass plate (Plates): rank badge and name left, score pill right, tight above a luminous mini that stands on its 7 px score bar. The minis are light (AreaStrips, one call; the Generalist's rim blooms, the specialists' edge stays under 1), not grey slabs; the whole lineup is six draw calls. One column on phones AND desktop (unambiguous reading order); two columns only on a short landscape stage, where rank badges carry the order and the pill shows the number on every row (the word is on every row or none). Camera el 0 (no slabs, no relief to show).
- **H.34 Definition details.** The claim plate never dims below 75% under a focus pull and its ink keyline stays opaque (a translucent lime plate over light turned olive). The HUD number and word share one hue: `scoreHue` = #91C640 for Broad (the colour that already means fitness here), `scoreColor` otherwise; the explore readout uses the same. "Effort duration" sits 10 px under the tick row; the D4 "TIME: THE PATHWAYS" callout sits on that line (the title yields), never on the ticks; `CHART_PAD.b` is 64 to fit it. "Generalist, for scale" avoids the ghost curve (curve obstacles sampled 40 per curve). `minAspect` 0.68 (within the 15% allowance) so the phone chart fills its focus rect, story and explore.
- **H.35 Shell.** The grab handle has its own row with a 44 px band reaching above the card edge; the beat scrubber's 44 px band starts below it and overlaps only the non-interactive eyebrow row, so a scrub never collapses the card. The last beat's CTA row shares and shrinks (no overflow at 360 or in landscape); the "Classic" tag is dropped (supersedes that part of H.27). The theme toggle, the brand button and Scrub / Orbit are 44 px targets; the explore header wraps under 380 px. Story and card presses are pointer-captured and also end on a window pointerup or blur (a mouse released outside no longer freezes the story). While the next chapter's chunk loads, `data-story-ready` is 0, `data-view` and `__story.view` name the target, `__story.pending` is true, and steps and gestures are ignored. Back or Forward to another chapter lands on its stage (`history.scrollRestoration = 'manual'` while the lesson is mounted). The caption card observes itself (a callback ref), which fixes a stale focus rect when the card mounted after the stage's first layout.
- **H.36 Kit and engine.** New kit: `useStageHotspot` (real focusable buttons over projected boxes, for D.1 I4), `<Instances>` (any repeated solid in one call), `<Glows>`, `<Ripple>`, `<Plates>`; PenBatch `head`/`hot`/`gain`; AreaStrips `rim`/`rimScale`; AreaFill `rimAlpha`; label `badge` and `sepPx`. Every chapter callback the engine calls in a frame loop is caught at the call site: the element hides and one warning names it, so a chapter bug can no longer freeze the stage; an obstacle writing more than its `maxPoints` is skipped with a warning. SdfText passes only glyphs the self-hosted TTFs cover (troika would fetch a CDN fallback for any other, and a custom unicodeFontsURL retries the CDN on failure). R3F's THREE.Clock deprecation warning is filtered through three's `setConsoleFunction`; one more is emitted by module-level code in the app's shared vendor chunk before the lesson loads and cannot be reached from the lesson. QA and screenshot tools abort GA4, Ads, Meta, Clarity and Bing requests. The README documents rng, `useCueState`, `onFrame`, `useHudOpacity`, `maxPoints`, hotspots, the new kit and linear-light blending.
- **H.37 Merge gate for legacy chapters** (G). The H.24 `removeChild` error on leaving an unmigrated LessonStage chapter is a merge gate: `fitness-v2` merges only when no legacy chapter is left or the error is gone.

### 2026-09-27, foundation lead, fix round 3 (engine review 3 + visual review 3)

- **H.38 Adaptive quality bounds follow the refresh rate** (C.10, refines H.29). The fixed `[45, 58]` bounds demoted a phone the browser caps at 30 fps (iOS Low Power Mode, Android battery savers) one rung per 3 s window down to LOW, where the composer and bloom are gone, and it could never climb back: dropping quality cannot beat a vsync cap. The monitor now declines below `max(26, min(45, 0.8 r))` and inclines at `min(58, 0.93 r)`, where r is drei's measured refresh rate (the highest fps seen), so a steady rate at the cap is healthy (`qualityBounds` in `quality/Quality.tsx`). The 26 fps floor still demotes a device that cannot hold 26 fps whatever its cap. Under a 50 fps refresh nothing inclines: a capped device runs at its cap whatever the GPU load, so its steady rate says nothing about headroom (the first 30 fps run climbed to medium+ on "sustained headroom"). `__story.state()` reports `still`. story-qa runs three virtual clocks unpinned at 3x: 60 fps and a 30 fps cap must never be demoted; an uneven 20 fps clock (30 / 70 ms frames) must end on LOW in still mode. Serves E.12 and the owner's phone in Low Power Mode.
- **H.39 A chapter never waits forever** (C.4, B.7). SdfText suspends inside its OWN Suspense and error boundary: troika never resolves a font that failed to load, and one failed TTF request used to hold the chapter Suspense, the slate, the caption card and the story clock forever. Readiness counts pending SDF words (the prewarm waits for them so they compile with the rest) but is forced 8 s after the chapter mounted and the page fonts resolved (15 s at most, even without frames), with one console warning naming what was missing. The prewarm uses the synchronous `gl.compile` (C.4 said `compileAsync`): compileAsync issues the same GL work first and then polls program readiness from a timer, which throws an uncaught TypeError ("reading 'isReady'") and never resolves when a material is disposed while it waits (a chart frame replaced during load); the driver's parallel link now finishes during the next two frames, still under the slate. story-qa aborts every TTF and expects the story to become ready and play.
- **H.40 Pacing v3: the finished frame is read too** (C.3, extends H.30). The H.30 hold counted only caption words, so the signature frames were held at the 2 s floor (AREA = FITNESS was fully visible for about 3 s; the finished D5 frame for about 2.5 s). Beats may declare `sceneWords` (the callouts, readouts and claim that land late, read AFTER the build) and `signature` (A.3): `hold = clamp(max(0.4 + 0.23 x captionWords - build, 0.8 + 0.23 x sceneWords, signature ? 4 : 2), 2, 7)`. Definition: D2 7 scene words (the five domain names), D3 signature, D4 10 (the three callouts), D5 signature and 13 (Capacity's signature moment spans the pour and the spill, A.3). D0 and D1 keep the fast H.30 opening.
- **H.41 Registration and clean ghosts** (D.5, B.9 Pen). (1) Every cached writer keys on the chart frame (`frameId(frame)`, `kit/chartFrame.ts`), not on an effect that resets its cache after the commit (a frame could render in between and keep the old scale): the explore domain fan stayed in the expanded sheet's x scale after the sheet collapsed. (2) A stroke that RESTS dimmed uses the new pen `dim` (mixes toward the slate at full alpha); partial `opacity` is only for fades, because a translucent LineSegments2 shows its overlapping segment caps as beads. The D5 "Generalist, for scale" ghost and the explore ghost use it; the averaged curve steps aside while the D2 slices fan out (it becomes them) instead of resting at 25%. (3) Coincident ghosts: the Generalist's gymnastics and odd-object tilts are equal, and so are mono / cardio and unknown, so the D2 end state showed three hues. A coincident partner is drawn first in the batch and again as a 6 px rim behind (`DomainFan`), so all five hues show as cores with thin rims; no data moves. (4) Labels gain `leader: 'always'`: "DOMAINS: THE HOPPER" (D4) and "ZONE WON" (D5) are leadered to what they name, as D.5 says. (5) A short landscape stage (focus height under 460 px) uses the pinned domain key at D2, as P does (the direct names sat on the slice faces). (6) The tick set follows the chart's pixel width: under 520 px it is the phone set, so an expanded explore sheet (a landscape-shaped but phone-narrow rect) keeps "1 hr".
- **H.42 Nodes are impostor spheres** (B.9 "Nodes", supersedes "instanced icosahedron detail 2"). A tessellated 0.15 sphere read as a faceted polygon at 3x and a flat blob at DPR 1, the least refined element on screen. Each dot is now a camera-facing quad whose shader draws a lit sphere (key light, a small specular highlight kept under 1.0, a fresnel rim in the dot's colour, a soft outer glow, an fwidth-anti-aliased silhouette): perfectly round at any DPR, two triangles per dot, still one draw call. Dots draw after the pens (renderOrder 47) and sit on the line they mark.
- **H.43 Kit completeness for the parallel phase** (B.9, C.1, C.11, D.4, D.7, G). Added before the chapter builders start: `LightField` mode 2 FLOW (the Pathways river: three bands as thickness curves `curveA` / `curveB` / `curveC`, each mote keeps its height h inside its band, u = fract(u0 + 0.035 A), lit while h is under its band's thickness, `stack` / `lane` / `thick` morph the stack into lanes, `bandOn` floods each band, `FLOW_COUNT` HIGH 6000 / MEDIUM 3300 / LOW 0); `makeSurfaceMaterial` (vertex colours, world-y isolines every 0.1 of capacity, sick mix plus hatch below the independence height, `isolinesOnly` for the ghost, uniforms on `userData.surface`); `ballOpts(color)` for `makeRimStandard`; `<BlobShadow>` (instanced; the radial falloff is computed in the shader instead of sampling the 64 px texture B.9 names, the same curve without a texture). The README kit table documents each, with the render-order table (C.16) and the rule for kit changes during the parallel phase: append-only (new props with defaults that keep today's behaviour, new exports, new modes), each with an H amendment and a README row in the same commit; anything else goes to the foundation lead.
- **H.44 Guarded chapter frame code** (C.5, C.16). R3F 9 calls every useFrame in one loop and renders only after it, so a throw in any chapter's own useFrame froze the whole stage (H.36 only guarded kit callbacks). `useSafeFrame(site, (T, A, dt) => ..., { priority, hide })` catches, hides `hide.current`, warns once and stops calling; a positive priority is clamped to 0 with a warning. Every Definition useFrame now uses it. The README adds "Your own per-frame code" (clock.T, the ambient clock.A and its freeze rule, engine priorities), "Cached writers", "Beats: the fields" (including `terms`), `useFocusInset`, and the render-order table. `useStoryFrame` is renamed `useChapterChart` (a chart frame, not a frame callback); the old name stays as an alias.
- **H.45 Lines clear the HUD chip** (B.7). The 1.0 gridline ran under the AREA chip's glass on phones. `hudBox` (ui/Hud.tsx) keeps the chip's stage rect and opacity (measured when it appears, on focus changes and every 12 frames, never per frame) and `hudClipX(x0, x1, y, z)` (kit/hudClip.ts) returns where a horizontal world line must stop to end 8 px before it, blended by the chip's opacity. The same holds for the pinned top-right legend key (`pinBox`, the union of the visible pinned chips, from the label placer): the D1 band key and the D2 domain key are glass too. The Definition reference lines use it, story and explore.
- **H.46 QA** (C.15, E). `__story.chartRect()` (the chart frame box projected, stage px), `__story.probe(id)` / `probes()` with `useQAProbe` (Definition registers `def-fan`: the drawn ends of each domain curve), `state().still` and `state().loaded`. story-qa adds: explore re-fit at every sheet detent and after Reset (the chart inside the focus rect, no clipped label, and on Definition the domain fan registered within 2 px after toggling in the expanded sheet and collapsing), fontfail, real CDP finger drags on the card, tap queueing and deep-link stepping, label determinism (a deep link lays labels out exactly as scrubbing there), reduced-motion explore from the last beat, the virtual-clock tier gates of H.38, and the true maximum of `stats()` over every sampled t (the round 2 report quoted a beat-end figure).
- **H.47 The phone card on a real touch screen** (B.2, C.6). `.st-card` is `pan-y`, so a real finger drag on it scrolled the page and fired pointercancel: the detent drag only ever worked with a mouse. Now the top band takes vertical finger drags: the grab handle is `touch-action: none` (a drag moves one detent, a tap toggles default and peek, and from expanded returns to default), and a vertical drag on the scrubber band (which covers the eyebrow row) moves the detent instead of jumping beats. The card body stays `pan-y`, so the page still scrolls to the Notes. The expanded detent also has a visible door on phones: a "Read more" link at the end of the caption body (44 px hit area that does not grow the line), "Less" when expanded. story-qa proves all of it with CDP touch events.
- **H.48 D6 minis on phones** (D.5 D6, refines H.33). The rows are height-limited on a phone (seven rows in about 480 px), so the mini takes the height the pads gave up: 10.8 x 1.35 (was 0.95), a label band of 0.78 (the 20 px pill), tighter pads; about 35 px of height for v = 1 instead of 27. The fills are near-even (lo 0.12, hi 0.44, gamma 1.3) so each mini reads as an amount of light, its area, not as a line with a faint glow; the specialists' chalk is one step brighter.
- **H.49 Lesson payload** (vite.config.ts, app-wide chunking). Rolldown groups also capture their modules' dependencies, so the `forcegraph` group (priority 40) pulled React and three.js core into its 1.5 MB chunk and every React route, the lesson included, downloaded it. A `react` group (react, react-dom, scheduler) now claims first (priority 50) and the `three` group moves to 45, ahead of `forcegraph`. /fitness/definition no longer requests `forcegraph-*.js`; its JS drops from 2.94 MB to 2.47 MB raw. Only chunk membership changes; the force-graph routes load `forcegraph` plus `three` as before.
- **H.50 Camera and playback** (C.8, C.3, B.4). Explore re-fits (E.3): when the focus rect or the chart frame changes (the sheet detent, a rotation) the director keeps the viewer's orbit angles and relative zoom and scales the orbit to the new fitted distance and target, gliding with the smoothed rect; Reset view fits the CURRENT frame and rect; the zoom limits follow the fit, and no distance clamp applies during a handoff tween (the D6 lineup distance exceeded the old limit). Under reduced motion entering explore, leaving it and Reset view are cuts (the explore pose was never applied, so explore opened from D6 at about 60% size). `cameraBus.orbitTo(az, el)` glides the explore orbit to reveal a dimension a control turned on (L6); Definition's "Show the 5 modal domains" orbits to the D2 fan angle and back, because front-on the five depths read as misregistered curves. Stepping: taps inside a next or prev glide queue (the base is the glide's target), and a viewer's step from a deep link clears the hold and plays the new beat (QA and reduced-motion steps still cut). `frameFor` keeps the cached frame object when a new rect gives the same frame numbers (the phone aspect is clamped), so detent toggles no longer rebuild 31 buffers each. Label widths re-measure on `document.fonts` `loadingdone` (a label's font face loads after fonts.ready; pinned legends right-aligned on fallback widths).
- **H.51 Labels at rest are a pure function of T** (C.9, refines H.4). Side memory (hysteresis) now applies only while story time moves (a build, a glide, a scrub), where it stops labels flipping sides; when T comes to rest one memoryless pass places every label from the current geometry alone, so which side a label rests on no longer depends on the path that reached T (a deep link, a seek, a scrub or autoplay). story-qa "determinism" compares a deep link with the same T reached by seeking through the chapter, label by label within 2 px (its first run flagged 1 px differences, which are sub-pixel rounding of a projection; a side change moves a label by its gap plus its size).

- **H.38 Chapter registry is auto-discovered.** `stories/index.ts` builds STORIES from `import.meta.glob('./*/story.ts')`, so a chapter registers by existing. Six chapter builders work in parallel worktrees; hand-editing one shared map would conflict on every merge. Legacy module files are deleted at integration, not by chapter builders.

### 2026-09-27, integration lead (six chapters merged on fitness-v2)

- **H.52 The legacy lesson is retired; the lesson payload is the lesson's own** (G, H.13, H.24, H.37, H.49). All seven views are stories, so `modules/*.tsx`, `LessonStage.tsx`, the legacy branch of `FitnessApp.tsx`, the `?qa=stub` stub story, `LessonStageProps`, the unused `ui.tsx` widgets (ModulePage, LessonHeading, SectionCard, StatTile, Segmented, PresetButtons, Bar, ControlHead) and every `fitness.css` rule whose classes nothing renders are deleted (each proven unused by grep first). With no LessonStage chapter left, the H.24 `removeChild` error has no source and the H.37 merge gate is met. Payload: after H.49 the lesson no longer loaded `forcegraph`, but its `three` chunk still carried code only the WOD app uses: three-render-objects imports `three/webgpu` (the whole WebGPU build, about 950 KB before minification) and the examples Trackball / Orbit / Fly / Drag controls and EffectComposer; drei `Html` rode along for the WOD heatmap; and n8ao (an unused ambient-occlusion pass that `@react-three/postprocessing` imports and that does not declare itself side-effect free) added about 117 KB. `vite.config.ts` now keeps those files out of the `three` group (they fall to `forcegraph` or to the chunk that imports them) and marks n8ao side-effect free. A static walk of `dist-dev/index.html`, the entry chunk and the `/fitness` preload list shows the lesson loads only react, three (three core, R3F, drei parts, postprocessing, troika), motion, the shell and the current chapter: /fitness first-load JS 773 KB gzipped before, 548 KB after (the `three` chunk 596 KB to 372 KB). Every other module of the app keeps its chunk; the force-graph routes load `forcegraph` plus `three` as before.
- **H.53 Engine promotions from the chapter reports** (C.6, C.7, C.9, C.11, B.4, C.15). Where two or more chapters reinvented the same helper, or a chapter papered over an engine gap, the engine now owns it:
  - The caption card has a Read more body for the intro (INTRO_TEXT and DEFINITION_TEXT, `readMoreFor`), so its expanded detent is no longer empty (the intro's detent clamp is deleted). The intro's finished map shows `[Explore][Begin the lesson]`: on a phone the transport pill hides on the finished last beat (H.27), so explore was otherwise unreachable by touch from the map.
  - Stage hotspots are swipe-transparent in story mode: a horizontal swipe that starts on a hotspot steps the story and its click is eaten; a tap activates the button and never toggles pause (the intro map tiles cover about 90% of a phone's stage; the Continuum spoke names sit where a thumb starts a swipe).
  - `setLabelColor(id, css)` joins `setLabelText` in `story/labels` (Skills and Continuum each wrote one).
  - `ChipRadio` keeps its checked chip in view whenever the value changes, scrolling only the row and only when needed, with part of the neighbour showing (Skills and Continuum each did this; Continuum's pushed a chip fully off screen).
  - `setExploreSheetOpen(open)` lets a chapter collapse the phone controls sheet (Skills clicked the engine's own grab handle).
  - The label placement fields `prefer`, `center`, `gapPx`, `priority` and `only` are officially read on every placement pass, so getters of story time are supported (Hopper, Pathways and Continuum rely on it).
  - `writePolyline` / `polylineToSegments` copy with a scalar loop (a `subarray` view per segment allocated on every frame an updating Pen changed).
  - `.wf-range` (ui.tsx `Slider`) has the 44 px hit area B.4 requires, around a 6 px track.
  - `useChapterFog` clears the scene fog on unmount only if it is still its own fog. On the persistent stage the next chapter mounts in the same commit, so a jump from Hopper (engine fog) straight to Health (which sets its own fog in a layout effect) used to lose Health's fog to Hopper's passive cleanup.
  - story-qa: a gate that throws is that gate's FAIL and the run continues; navback and persist use the Previous card on the last chapter; persist no longer needs the stub; the chapter-sheet check waits for focus to move in instead of a fixed 500 ms; the shell check measures after `document.fonts.ready`.

  Not promoted (each serves one chapter, or promoting it would mean rewriting working chapter code on the night of review): per-vertex colour AreaStrips (the Intro walls, the Pathways handover strip and the Health reclaimed band each have a local one), River FLOW repacking, an annotation solver, Pen depthTest and screen-constant dashes, per-instance Instances opacity, an engine world-to-px scale, TintDots / TintPen, LightBands.
- **H.54 Chapter amendments the builders proposed, recorded as shipped** (D.1 to D.7). Builders were scoped to their own chapter folders, so their deviations from section D are listed in their reports; they are recorded here so this document describes the build. They stand until the design lead or the owner rules otherwise.
  - D.1 Intro: I1 humps sit on the dial's floor line, drum rim 0.92 of the cell radius, top-row names dim to 20% while morph 2 crosses them. I3 pose az -16 el 30 (spec az -32 el 26); the area stays as the volume's front slice at 0.55, the walls are unlit additive gradients, the back wall travels at 0.78 then settles; 20 / AGE / 80 land as the age-axis pen reaches them; the caption says "the volume you keep under the surface" (was "curve"; from MODULES[5].blurb and HealthModule.readoutSub). I4: the four glyphs are redrawn in tiles 01, 02, 03, 05 by the pen (they no longer fly from the docked row); the chart folds at 0 to 0.3 and the surface steps into its own lane before crossing into 06; rings light 01, 02, 03, 05, then 04 at 0.56 and 06 at 0.62; names follow the rings. Lexicon: '1 s', '1 hr' (I2), '20', '80' (I3), the full MODULES labels in I1; the explore peek shows MODULES[i].title.
  - D.2 Skills: the explore Grid gains a kind S (a 2 x 7 ranked list, each name beside its radar) for short, wide phone focus rects; Wheel | Grid moves to the peek row beside the Athlete chips, and phone chips use the short athlete names; tapping a skill name or vertex shows SKILLS[i].definition and its class in the peek card; the '10' rim tick appears from S3 as a contour label at 108 degrees; S5 carries the pair (Generalist cell 0, Powerlifter last cell) and lands at t 0.24.
  - D.3 Hopper: L rail pitch 1.6 with the legend as a left column; a third world S for short landscape focus rects (h under 440); the board kicker shows the domain alone (H1 keeps "DRAW 1 - WEIGHTLIFTING"); H4 re-sort 0.50 to 0.64 with NEW LEADER at 0.565 and the impact at [0.64, 0.76]; H5 rain 0.05 to 0.64, bands regroup 0.70 to 0.84; ticks sit near their brick's start; H6 construction 0.18 to 0.34, bars fade 0.28 to 0.38, the bracket and LEAD stay until the claim at 0.86; the story thread draws first and the 64 threads after it, and the rails give way to the chart instead of dimming.
  - D.4 Pathways: one strip per engine that blends across two handover zones (10 s to 15 s, and from the oxidative lead at about 55 s to 120 s) instead of hard cuts, each duration string under its own textbook range; P6 pins light with their own dominant engine; P0 wipes on three dim unnamed engines instead of an 8% neutral fill; builds P1 5.5 s, P3 6.5 s, P5 9.0 s, with held readings left as dimmed ghosts; the explore Lanes get their own baselines; the river draws 4200 comet sprites on MEDIUM (spec 3300 dots). Captions P1, P3, P4, P5 and P6 are paraphrased from their sources (P5 "Example efforts on the curve. Watch the dominant engine change.").
  - D.6 Continuum: the portrait key is a readout, and the tap target is each spoke's outer end and name (a 44 px stage hotspot from C4 t 0.12); the key arrives with the C4 tilt; C3 builds in 7.5 s (cascade 0.08 to 0.30, values 0.27 to 0.59, morph 0.62 to 0.93, each row's fitness end travelling round the centre); the C5 impact window is [T_SWAP - 5, T_SWAP - 5 + 0.12]; SICKNESS stays through the tilt and fades at C4 0.40 to 0.48; DEPTH 4.0 (spec 1.4). Owner note: the circle named FIT sits at marker stop 0.82, while the overall word turns FIT when the mean crosses 0.62.
  - D.7 Health: L5 is staged as a glass lid over a dim Sedentary "before", with the reclaimed slab lit #91C640; plane fill 6.5% in L3 and 2.5% from L4 (spec 10%); no drawn contour (F.5); the L6 Sedentary comparison is a dashed outline with an x-ray pass; AGE sits in the tick column between 60 and 80; INDEPENDENCE LINE hangs below the red front edge; the L0 chart is 1.17x wider on a portrait stage and relaxes during L1; the fog is a camera-keyed linear fog set by the chapter (B.9 says FogExp2 through useChapterFog). F.10 (owner): the scanner enters at age 17 and lifts ages 20 to 45 on its approach.

### 2026-09-27, integration lead, fix round 1 (whole-lesson review)

- **H.55 A portrait phone keeps its portrait poses on a short stage** (B.3 "Layout orientation", C.8, E.1, E.4). The stage is `100svh`, and iPhone Safari with its toolbars showing gives 390 x 664 (393 x 659, 430 x 740, 375 x 667 on other models), so the owner's phone never gives 390 x 844: its focus rect is about 366 x 358 (aspect 1.02), which the 0.95 rule turned into the desktop L pose on a portrait phone, and every chapter's key frame lost its words. On the PHONE shell the layout is P while the focus aspect is under 1.3; every other shell keeps the 0.95 rule, and the expanded detent (aspect above 2) is still L. Where a P composition cannot keep its words at that height it has a short-portrait variant keyed on the focus-rect height (under 440 to 460 px): Hopper `Q`, the Definition lineup `PS`, the Skills grid `S` (H.62). The Safari viewports 390 x 664, 393 x 659, 430 x 740 and 375 x 667 are story-qa label gates (overlaps, clipping, required labels), and on the current iPhones' three (390, 393 and 430 wide) a name, callout or readout that the 390 x 844 phone shows on a beat's finished frame (t = 1, the frame read through the hold) and the short viewport culls is a FAIL, not a silent pass (the 375 px SE may give a secondary name way on a dense beat) (`__story.labels()` reports each label's tone); the shell gate also runs at 390 x 664 and 375 x 667. Serves E.1, E.4 and the owner's phone.
- **H.56 Reading holds the story** (L14, C.3, B.2). The expanded detent (phone and tablet) and the desktop card's Read more disclosure pause story time like a finger on the stage; the story resumes from the same T when the card returns to its default detent or the disclosure closes, and Play returns an expanded card to its default detent. story-qa `reading` proves it with a real tap on Read more and on Less.
- **H.57 The lesson ends** (C.7, B.2, B.6). On the finished last beat of the last chapter the CTA row is [Explore this model] (outline) and [Back to overview] (solid), which lands on the intro's six-tile map, held (`?beat=4&t=1`: `navigate` accepts a query for this one lesson-owned deep link; every other navigation still drops the query). The eyebrow reads "Lesson complete" with a check when this viewer has finished all six chapters (the done store; the current chapter counts), otherwise "End of the lesson". The transport's Next is disabled there ("End of the lesson"): it used to be an enabled button that did nothing. UI copy only, no claim.
- **H.58 Idle rendering** (C.10, B.6, battery). A held deep link, a paused story and the finished last beat re-rendered the scene and the whole MEDIUM post chain every vsync for identical pixels. `IdleWatch` (Stage.tsx) sets `store.idle` once the story is not animating (story mode, not playing or finished, no glide, no touch, no sheet) and story time, the focus rect and the store have been still for 1.2 s (every damped follower has settled by then); the Canvas then renders on demand. `useIdleWake` returns it to `always` on any store change, a story-time or focus-rect change, a late web font or a resize. The PerformanceMonitor stands down while idle and the LOW-tier clock ignores the gap frame, so waking never reads as a slow window. `__story.state().idle`. Measured: 0 draws per second while held (was 19 to 37 draws per rAF), ready 30 to 40 ms after a seek from idle.
- **H.59 Prewarm the first draw** (H.39, C.4). After `gl.compile`, the ReadyProbe renders the scene once with every hidden object forced visible (restored at once; chapters set visibility from T every frame), under the slate, into the composer's target on composer tiers: three's deferred first-use work and iOS's lazily built render pipelines happen under the slate instead of at a beat's start. `gl.debug.checkShaderErrors` is on only in development (its synchronous info-log calls were a GPU round trip each, clustered at beat starts).
- **H.60 Payload** (H.49, H.52; vite.config.ts, main.tsx, index.html). The `react` group also takes zustand, its React shim and Babel's runtime helpers (the WOD app's ThemeToggle and stores import zustand, and drei and the force graph share the helpers, so either one sitting elsewhere pulled that chunk into every WOD route). `three` is three.js core only; `r3f` holds React Three Fiber, drei and three-stdlib; `lesson3d` holds what only the lesson runs (postprocessing, @react-three/postprocessing, troika and its bidi and SDF helpers, drei Text, Environment, Lightformer, useEnvironment and PerformanceMonitor, the environment loaders and gain-map decoder). Gzipped JS, main versus now: `/` 659 KB to 608 KB, /news 530 to 70, /games 697 to 237, /games/capacity 843 to 789, /network-science 659 to 609; /fitness 569 to 571 (one more chunk boundary). On a direct load of /fitness the current chapter's chunk starts downloading from main.tsx with the shell, and index.html requests the lesson's Barlow faces with the page (the same URL as fitness.css's import, which becomes a cache hit; Anton comes with index.html and left the import).
- **H.61 Allocation-free engine paths** (C.16). `padOf` hands out a frozen default and a four-slot scratch ring for numeric pads; a chart frame's cache key is built once per options object (a WeakMap) instead of a template string per call; the label pass walks the world obstacles with `forEach` (no [key, value] entry per obstacle per frame). Continuum's `spectrumLinear` interpolates the three stops read once from `fitnessData.spectrum` instead of calling it (two arrays per call) per dot per frame.
- **H.62 Chapter fixes** (D.1 to D.7; they stand until the design lead or the owner rules otherwise):
  - D.1 Intro I4: the lifetime surface shrinks over 0.26 of the beat (was 0.16), the camera pulls back over [0, 0.34] (was [0, 0.24]) and the pen starts redrawing the models at 0.12 (was 0.16), so the solid shrinks into the map instead of collapsing into an emptied stage. At 390 x 664 I0 and I1 are the P compositions (two-line title, four named models).
  - D.2 Skills: S4's Powerlifter key chip names the dashed outline as it draws and takes its floor badge "2" only as the collapse lands (t 0.86; the badge stated the claim 2.6 s before it). S5 on a short portrait rect (under 440 px) is the `S` list, 2 x 7 with the names beside the radars (the 3 x 5 grid shrank to 65 px cells there and culled three names). The S1 class tags fall back to the first word of their own label ("Trained", "Practiced") where the full pill has no room.
  - D.3 Hopper: the `Q` world (a portrait phone rect under 440 px): the six names over their rails, the ticket (0.92 at 1.47 over P1, beside the HUD chip) and the domain key as a two-row DOM key over the caption card (Hud.tsx, reserved in the Q poses like the Continuum key), rails at pitch 1.55, the drum stepping out for the board as on S, the HUD chip on one line; the compact rails-only board is kept for short WIDE phone rects (the expanded caption or sheet). Each brick set has its own materials: `<Instances>` writes its set's opacity into the material every frame, so the P1 and P2 bars took the fading back rails' opacity in H6 and blinked. A name lifted over a top-scorer tick never rises into the total riding the bar above. Lexicon: the legend and the key use the `MODAL_DOMAINS` names (Weightlifting, Gymnastics, Mono / cardio, Odd object, Unknown: one domain label set across chapters 02 and 04; the ticket keeps the drawn domain's full `HOPPER_DOMAINS` label); the H6 axis title is "Draws".
  - D.4 Pathways: the cluster names (Fran, 1 Mile Run, 2k Row) re-lay for the cursor's pole only while the cursor rests on a cluster pin (its chip needs that room, as at Fran in P6), never while it travels past (the LOW / HIGH layout flipped as the moving pole crossed them, a 70 px jump and back within a second of P5); the cursor's chip still avoids every name and leader. The "Power output" title keeps its slot at the top of the axis through P0 to P3 (the chips lay out around it); from P4 the lane names and the 1RM tag keep that corner. On a short portrait rect the phosphagen lane's name is anchored at 24 s on its falling curve (12 s elsewhere), where it has headroom.
  - D.5 Definition D6: the `PS` lineup on a short portrait rect: wide, shallow rows whose score pill has its own slot beside the mini, so every score and word shows (the P column squeezed to 180 px and culled six pills at 390 x 664).
  - D.6 Continuum: at 390 x 664 C4 to C6 are the P compositions with the portrait key (values, the claim, all ten names). The WELL and FIT ring names may step off along a leader.
  - D.7 Health: L5 keeps the lid an OPAQUE lit surface in the spectrum colours (the glass lid over a dim, red, hatched Sedentary solid of H.54 made the before the dominant mass on a phone): where the lifted surface stands above the Sedentary ghost it leans toward #91C640 in proportion to the capacity reclaimed, and the before is the dashed outline with its x-ray edges from L5 on. VOLUME = HEALTH is ink on an ink-keylined #91C640 plate (D.7 said chalk 22%), the claim treatment AREA = FITNESS has. Axis titles are sentence case like the other chapters' ("Duration", "Capacity", "Age"; the intro's I3 "Age" too). On a short portrait rect the HUD chip steps aside in L6 as the volume readouts land (the key already reads both volumes) and the L6 pose uses its corner.
- **H.63 Explore chip rows** (B.4). `ChipRadio` snaps the row's near edge to a chip boundary when it scrolls the checked chip into view (the whole neighbour shows, or it hides under the fade): a hard-cut fragment ("DENTARY", "FTER") beside the sheet's controls read as broken text.
- **H.64 Open after fix round 1** (owner decisions and minor items not done):
  - F.5 (owner): L4's key reads "Independent through 70" while the whole Sedentary surface sits under the independence line. Retune the data, amend D.7, or add a Notes line.
  - A landscape phone (844 x 390) shows the Continuum C4 and C5 dial without marker values (no key panel, no values at the spoke tips).
  - On a short portrait rect Health L3, L4 and L6 drop some tick labels ("1 s", "20") and L6 axis titles; Pathways P4 drops "Power output"; at 375 x 667 Pathways P5 can drop the "1 Mile Run" cluster name and shows the 1RM tag's short form; mid-beat transients (the Continuum WELL ring name at C4 t 0.5) can give way.
  - Desktop framing: the Hopper board fills about 70% of its focus rect; Health L2 is fitted a little wider than L1 and L3.
  - Coherence: one home for the energy-zone key (Definition pins it top-right on P, Pathways draws it under the axis); one default for Scrub | Orbit; the segmented control for every two-way explore switch; one score format.
  - The self-hosted TTFs are not subset.
- **H.65 A branded host: the MetFix Lab preview** (2026-09-30; C.2, C.4b, B.7). The engine now runs one story outside the lesson: `/metfix-lab` (`src/metfix-lab/`, a noindex preview of MetFix Module 7). Append-only, no fitness behaviour changes: `StoryDef.key` widens to `StoryKey` (`FitnessView` or `lab-...`), and an optional `StoryDef.brand` (`StoryBrand`: eyebrow, accent, Read more copy, backdrop slate and glow, slate words, no-WebGL message, end CTA link) replaces the lesson's chapter lookups where it is set: the caption eyebrow, accent and Read more, the slate, the backdrop colours and the environment's accent strip. A branded story stands alone: `navigateChapter` returns when the view is not a lesson chapter, the last beat's next arrow is disabled, its CTA row is Explore plus the brand link, and it never writes the lesson's progress store. `Beat.terms` also takes a hex colour. Every fitness chapter omits `brand`, so each branch keeps today's behaviour.
- **H.66 The MetFix course shell** (2026-09-30; H.65). `/metfix-lab` becomes a course: an overview of the eight MetFix modules and `/metfix-lab/<slug>` per module story (`src/metfix-lab/README.md`). Append-only engine change: `StoryBrand.endNext` (label, href, optional in-app `go`) adds a solid next-step link after the brand link on the finished last beat, and the brand link turns outline when it is set. Fitness chapters never set `brand`, so nothing changes there.

### 2026-09-30, MetFix Lab integration: the sound amendments (merged from fitness-v2-audio)

The sound branch wrote its amendments as H.52 to H.56 in parallel with the lesson integration above; merged here they are H.67 to H.71 (the same text, renumbered; story/audio/ and section I cite the new numbers).

#### 2026-09-27, sound designer (section I)

- **H.67 Sound** (new section I, binding). Narration, effects and a bed, OFF by default (I, O1). With sound on, the C.3 hold also waits for the beat's narration clip plus a breath (I.6.4); with sound off C.3 is unchanged, and the C.4 seek contract is unchanged either way. B.2's top bar gains the sound toggle before ThemeToggle, which moves the wordmark breakpoints while the toggle is present (I.5.2); the caption card gains the first-visit Sound on chip (I.5.1). Chapter cues live in a new `stories/<view>/sound.ts` per chapter, and C.2 is unchanged (I.6.2, H.68); C.4 gains `?sound`, `__story.audio()`, `__story.renderAudio()` and `__story.audioTimeline()` (I.6.7); C.15 gains the narration gate (I.6.5). The pace note first written here (61 to 97 words per minute, a lesson growing to about 10 minutes) was wrong and is withdrawn: those clips spoke their TTS direction aloud before the caption (H.68). Serves E.4 (thumbs-only story), E.6 (seek contract) and E.14 (network: the site origin only).

#### 2026-09-27, sound designer, revision 1 (audio review)

- **H.68 Section I revised after the audio review** (supersedes the parts of H.67 and of the first section I named here; serves E.4, E.6 and E.14).
  - **Narration.** The pace diagnosis was wrong. The measured clips spoke their TTS direction aloud ("Read this warmly and clearly, like a coach explaining an idea at a whiteboard"), paused about 1 s, then spoke the caption at a normal pace (proved by transcribing the first speech span of intro/models on its own). All 13 generated clips are discarded; the run was also working from stale captions (6 of 46 hashes). Pace is now a HARD gate in generation, encode and `narration-check` (120 to 175 words per minute of speech, no inner gap over 0.8 s); generation also transcribes the first speech span alone; the preferred method is one continuous take per chapter, split at its paragraph pauses; the tempo-correction path is gone. With clean clips, sound adds about 57 s to the 340 s lesson, not 230 s (I.6.4). Nothing can commit until the Capacity clips exist (I.6.5 e).
  - **Palette.** `resolve` is an open fifth on inharmonic (1:3.5) FM glass at -14 LU re voice, and the third comes only from the bed; `resolve.fall` falls by register and darkness, never by a bend; `pen.slide` is a rising noise texture whose pitch lives in discrete arrival ticks; the `tick` family leads with the click and rings with a x 2.76 partial; pitch jitter is limited where events sound with the tuned bed; the bed's detuned twin is -9 dB, and it gains 3rd harmonics and a rising octave layer so its evolution is audible on a phone; the Hopper rattle is unpitched, Poisson and slower; P1 introduces the phosphagen pitch.
  - **Engine.** Cues move to `stories/<view>/sound.ts` and are sampled from the Scene's own exported cue functions and registered labels (`cueFrom`), so the only chapter edits are `export`s and a few hoists, wired one chapter at a time after each merge; `story/types.ts` no longer changes. Engine files call a dependency-free `audio/hooks.ts` (no module cycle). Pauses and seeks are explicit hooks (`store.pause`, `ready.markSeek`), never inferred from `playing`, and the last beat holds for its voice. The voice's accounting follows the audio clock; a hidden page pauses inside its event handler; the unlock listener leaves the sound controls alone and stays until audio runs. Decodes use `bytes.slice(0)` over a [n-1, n+2] window, with fetch validation. Voices have separate envelope and cut gains, and the director's frame work has its own try / catch. Transients come from a per-context bank, within a 16-per-second budget. The voice is encoded to <= -2.0 dBTP and the limiter threshold is -2.0 dBFS. QA levels are computed on demand. The offline render is named the reference mix and starts the bed in its beat-0-derived state.
  - **Cue sheet corrections** found while re-reading the code: I4 is sourced from the glyph redraws and the tile rings (the six folds start together); D1 names three tasks (the 400m run is named in D0); D2's five names and P4's three lane names land together and get one mark each; in D5 AREA LOST (0.62) lands before ZONE WON (0.74), so the fall comes first.


#### 2026-09-27, sound builder (the section I exemplar: engine + Capacity)

- **H.69 Sound built on the engine and the Capacity exemplar** (serves E.4, E.6, E.14 and I.8). `story/audio/` holds the I.6.1 files; `stories/definition/sound.ts` is the I.7 Capacity cue sheet; `public/narration/definition/` holds the 7 clips; `scripts/narration-manifest.mjs`, `scripts/narration-check.mjs` (the third gate of `fitness-gate.mjs`), `scripts/narration-lib.mjs` and `scripts/narration-spoken.json` are the tools. Outside `story/audio/` every change is a line or two marked `// [audio]` in the I.6.8 files; `Scene.tsx` changes only by `export` and the two hoists (`d4Stroke`, `d5Dash`, same numbers); `Explore.tsx` wires the I.7 explore sounds through `useSfx`. Sound off: story-qa on definition is unchanged (96 ok; its one failure, "sheet", fails identically on the untouched baseline). Deviations from section I, each measured:
  - **Voice level is dual mono** (corrects I.3.2, I.6.5 b and d). A mono clip plays on both channels, where EBU R128 reads it 3.01 dB louder than the mono file, so a -16 LUFS clip would put the voice stem at -13 LUFS (measured: -13.1). The player applies a clip gain of -16 - (clip LUFS + 3.01) dB from the manifest (`clipGainDb`, narration.ts). The clips as delivered measure -17.1 to -17.9 LUFS mono and <= -2.0 dBTP (two-pass linear loudnorm is peak-limited there), so the gains are -1.1 to -1.9 dB, the voice stem renders at -15.9 LUFS, -2.2 dBTP, and the limiter never touches the voice alone, as I.3.4 intends. The level gate is now: true peak <= -2.0 dBTP, a clip gain within +/-3.5 dB (a clip needing more is a bad encode), and <= -2.0 dBTP after that gain.
  - **Pace ceiling 3.7 words per second** (corrects I.6.5 gate 3). The Capacity clips are cut from the audition the owner chose, whose paragraphs run 2.37 to 3.37 words per second; 2.9 rejected 5 of 7 of them. The floor (2.0, which catches a spoken direction) and the 0.8 s gap gate are unchanged; the negative test (4 s of speech and 1 s of silence prepended to a copy of `lineup`) fails pace, gap and peak.
  - **One convention for every effect**: each passes an equal-power StereoPanner with the centre's -3.01 dB made up (`CENTER`), so a centred effect plays on both channels at full level, like the voice; the bank's I.2.3 sample peaks hold per channel.
  - **Two hooks added** (hooks.ts still imports nothing): `toggleKey` (the M key, so gestures.ts imports only hooks.ts) and `glideStart` (one `// [audio]` line in `glideTo`): Next and Prev cut the voice in the same task; the I.6.3 per-frame poll took 165 ms at 14 fps and stays only as a safety net. The director also subscribes to the route store (a chapter change cuts the old voice at the navigation, 1 to 2 ms, not when the next chunk mounts) and starts fetching and decoding a mounting chapter's first clips under the slate; bytes are kept for the current and next chapter and the next chapter's first two clips are prefetched at idle (the manifest is in beat order).
  - **UI sounds without more touchpoints**: `ui.step` comes from `beatStart` (not an autoplay advance, which `holdClear` marks), the glide hook and reduced-motion index changes; `ui.tap` from `userPause`, a resume within 250 ms of an input, and one capture-phase click listener over buttons, radios and summaries inside `.st-stage` (steps, the play button, the grab handle and the sound controls excluded). Reset view plays `air.reveal` at -8 dB. Segments, Transport and ExplorePanel are untouched.
  - **Cue sources**: `{ labels }` (a set of registered labels, one event each: the D1 task names, the D4 callouts) and `each.skip` were added. Beat 0 at a chapter's load plans with delay 0; the 150 ms quiet start then moves its first effects to 0.15 s.
  - **Reduced motion**: turning sound on narrates the current beat once (the viewer asked for sound); a step narrates the landed beat once; Show build narrates and its clip plays on after the build stops; the bed holds 8 s after a clip ends, then fades over 6 s.
  - **Hidden page** (refines I.3.6): the handler records the position from the audio clock, ramps the voice and the master to 0 over 60 ms, stops the source and cancels cues in the same task, then suspends after the ramp (a 90 ms timer; an immediate suspend cut the fade, a click on every tab switch). If iOS freezes the page first, it is already silent. `pagehide` suspends at once. `levels` read -120 while the context is not running (analysers keep their last buffer).
  - **Noise and silence detection**: pink noise is 6 s (a 2 s frozen loop is audible as a pulse in the room); the manifest detects silence from 50 ms so the 120 ms head and tail are seen, and only inner silences of 0.35 s or more split a span (I.3.3 holds the duck through shorter ones).
  - **QA additions**: `audio().startedFrom` (the clip offset the sounding source started from: a resume starts exactly where the pause stopped) and `__story.renderSfx(sound, dur, flat)` (one palette sound alone through the real graph, for calibration). Headless timing checks run `?tier=low` (60 fps under software GL; at 8 to 13 fps the engine's 0.1 s dt clamp slows story time whatever the sound does). The deep-link pixel check (`?beat=3&t=0.9`, `?sound=0` against `?sound=1`) pins `?tier=medium`: 0.000 to 0.002% differ; unpinned, the adaptive-quality monitor may settle on different steps on two loads under software GL (2.2%, all of it in the LightField sparkle), which is not sound.
  - **Measured** (ffmpeg ebur128 on `renderAudio(0, 6)`, 390 x 844): full mix -15.9 LUFS, -2.3 dBTP, LRA 7.9; voice stem -15.9 LUFS, -2.2 dBTP; bed -32.1 LUFS alone (first beat -31.5, last -31.6), -35.3 ducked; effects stem sample peak -28 dBFS, momentary max -33.4 LUFS; resolve alone -30.0 LUFS momentary max, resolve.fall -31.9; live autoplay `limiterMin` -0.95 dB. Capacity runs 57.2 s with sound on (52.9 s off; I.6.4 estimated about 60 s); over a live autoplay every beat lasted its planned total within 0.12 s, sound on and off. Two renders agree to 1 LSB at 16 bits (-90 dBFS, 0.03% of samples, the bed stem alone included: float rounding inside Chromium's renderer, not the plan or the seeds).
  - **The ear** (critic.py, with control items that do not exist: all answered correctly). Round 1: every I.7 Capacity event audible, the narration intelligible with nothing masked, no clicks, both bells "calm", no throb, nothing out of tune, the bed "present but unobtrusive", nothing annoying, nothing said beyond the captions. Not acted on, because the meters contradict them: "sub-100 Hz energy in the drone" (the bed is 20 dB down below 100 Hz; the low end in the mix is the voice's own fundamental) and "the bed is louder at the end" (-31.5 vs -31.6 LUFS). Recorded for the review round: the D4 callout ticks read as "near-identical clicks"; physically each carries its own pitch (A6, E6, B6, each 25 to 30 dB above the other two in a 30 ms window), but the `tick.label` recipe leads with its click and its sine decays in 15 ms, so the pitch step is modest. A `tick.close` glint (90 ms) would carry it; I.7 binds the palette per cue, so it is not changed here. (Corrected by H.70: the review round showed the ear also answers yes to sounds that do not exist, so "every event audible" is not evidence.)
- **H.70 Sound, fix round 1 after the audio review** (serves E.4, E.6, E.14 and I.8; amends I.2.3, I.3.3, I.4, I.5.1, I.5.2 and I.8). Measured on `renderAudio(0, 6)` at 390 x 844 and with real CDP taps WITHOUT the autoplay flag; evidence in `shots/audio-fix1/`.
  - **Ducks that never came back** (I.3.3). The duck merged speech spans only when their gap was under 0.6 s, but it schedules the release 0.7 s after a span and the next duck-down 0.1 s before the next span, so for any gap from 0.6 to 0.8 s the release landed AFTER the next duck-down and won: the bed and the effects stayed unducked for the rest of the clip. The D0 clip's 0.78 s gap left the bed at 0 dB from 5.0 s to the end of the chapter's first line. Now `DUCK_LEAD` 0.1, `DUCK_RELEASE` 0.7 and `DUCK_MERGE` = their sum (0.8 s, the I.6.5 gap gate) are named constants in `director.ts` and `duckSpans()` merges any gap up to `DUCK_MERGE`, so no release can follow the next duck. The phone and the offline render share the function. Measured: the D0 bed duck holds -6.0 dB from 1.0 to 9.5 s (was 0 dB from 5.0 s); the bed under D0's second half reads -38.6 dBFS RMS (was -32.7); the ducked bed stem is -36.3 LUFS (was -35.3, inflated by the bug; target -35.5 +/- 2). `scripts/sound-qa.mjs duck` renders the bed stem with and without ducking and asserts -6 dB (+/-0.5) in 50 ms windows across every manifest speech span of every clip: 15 spans, 706 windows, worst deviation 0.04 dB; against the pre-fix code it fails at 6.00 dB.
  - **Idle is not Waiting** (I.3.6, I.4, I.5.1, I.5.2). The director's own idle suspend (12 s with nothing audible while paused, 16 s after 'done') was published as "not running", so the toggle turned to Waiting (a dimmed icon and a dot), its first tap turned sound ON again (ui.on, '1' kept) instead of off, M did the same, the chip slid back onto the card, and the wake re-armed the paused clip from its start (the narrator repeated the sentence). Now `idle` is tracked apart from never-unlocked and interrupted: the UI's `running` is true while idle, so the toggle shows On and a tap or M turns sound off; `enable()` from a context that has run before only WAKES (resumes the context and the master, never re-arms a Run), so Play continues the paused clip at its recorded position through the normal play path; the chip retires for the page once audio has run (with one toggle ring when it was showing); play, a step, a chapter start and an explore touch wake an idle context, and any lesson tap still does (the unlock listener), after which it sleeps again in 12 s if nothing plays. `__story.audio().idle` reports it (`contextState` still reads 'suspended'). Measured: paused 14 s, toggle 'on', no dot, title "Turn sound off (M)", no chip; Play resumed the clip from 1.824 s where it paused at 1.824 s (was: from 0); one toggle tap while idle stored '0' and the context stayed suspended (no ui.on); 18 s after 'done' the toggle reads On and M turns sound off.
  - **An interruption resumes both** (I.4 "Audio interrupted", and the refused resume on unlocking an iPhone). `enable()` cleared `interrupted` before the context resumed, so onState never resumed the story, and the first-enable path discarded the paused Run. Now a wake leaves `interrupted` set until the context runs; onState then plays the story and the paused Run resumes where it stopped. Measured (the live context suspended from outside the director at 1.501 s): story paused, toggle Waiting; one tap on the caption: story playing, the clip resumed from 1.501 s.
  - **Leaving the lesson releases the narration** (I.3.6). `setChapter(null)` now also drops the decoded window and the kept bytes when no chapter follows. Measured with WeakRefs and forced GC: 3 live decoded buffers in the lesson, 0 after leaving (was 3).
  - **Palette** (I.1.3 "no risers", "no tunes"; the owner's phone is the judge). `pour.fill` and `pour.sweep` SETTLE: the centre and the tone follow L only to 85% of the window and then hold, the tone tops out at -26 dB (was -20), and the noise eases down 3 dB over the last 15%, so the D3 pour recedes into the claim instead of peaking on it. Effects stem, last 0.5 s before the D3 bell: the centroid holds 2480 Hz (was rising to 2976), the level falls -47.3 to -50.0 dBFS (was flat at -47.1), the band above 3 kHz falls 3.8 dB (was rising 3.8 dB). Solo `pour.fill` M max -38.4 LUFS (was -37.8; target -38). `ui.on` strikes its two glints TOGETHER as one open dyad (was the bell root then its fifth 80 ms later, the rising two-note figure of a notification chime): peak -26.0 dBFS, M max -37.1 LUFS (was -27.3 and -36.3).
  - **Not changed, flagged for the owner's phone.** (a) The tick family's timbre. Share of energy in the pure sine partials on solo renders (+/-3% bands): `tick.dot` 90% with nothing above 2.5 kHz, `tick.close` 86%, `tick.claim` 82%, `tick.label` 50% (its click leads). A trial on `tick.dot` (the click at -6 dB, a x 2.76 partial at -16 dB) moved it only to 89% and cost 1 dB of loudness; the review's fuller suggestion (the click at 0 dB, the sine at -10 dB) would, under the bank's peak normalisation, cost the tick several dB of loudness under the voice. That trade is the owner's call by ear, so the I.2.3 recipes stand. (b) Picture-bound cues against the voice (I.1.5): the D3 bell lands 0.14 s into "it is observable", the D5 fall in the 0.25 s gap between "The generalist" and "wins the integral", the D4 TIME callout about 1.5 s before "the time axis" (the build is shorter than the clip). The lever is a story-timing pass, not the mix. (c) Voice headroom (I.3.4): the voice stem peaks at -2.2 dBFS (Chromium), 0.2 dB under the limiter threshold; on the owner's iPhone read `levels.limiterMin` during speech, and if it ever goes below 0 on voice alone, take 0.5 dB more headroom in `clipGainDb`. (d) The chip's copy "SOUND ON" (O1, I.5.1) and its top edge sitting flush on the D6 lineup's bottom panel.
  - **360 px chip**: at widths under 375 px the chip sits at `right: 4px` (was 8), so its 44 px hit band clears the grab handle's by 7 px (measured 4 px before; 18 px at 390 and 38 px at 430, unchanged).
  - **QA**: `scripts/sound-qa.mjs` is committed (the build round's local suite plus `duck`, `idle`, `done`, `interrupt` and `leave`; each new check fails on the pre-fix code, `shots/audio-fix1/negative-control.txt`). `audioTimeline()` adds each beat's `speech` spans. The sound-on lead check measures inside the page, from the click event to the first frame the voice plays (on a loaded machine `page.click` took 330 to 480 ms to return, which read as a 230 ms lead; in-page it is 430 to 590 ms). Two renders agree within 1 LSB at 16 bits in 0.03% of samples (Chromium's float rounding), so I.8 says "within 1 LSB". Meters after the fix: full mix -15.9 LUFS, -2.3 dBTP, LRA 7.9; voice stem -15.9 LUFS, -2.2 dBTP; bed -32.1 LUFS unducked, -36.3 ducked; effects sample peak -28.0 dBFS, M max -33.5 LUFS; resolve alone M max -30.0.
  - **Load, not sound**: late in this round other agents saturated the machine (CPU 100%, about 160 browser and node processes, 12 fps). Under that load the timing check missed by up to 1.1 s with sound on AND 4.4 s with `?sound=0`, which no audio code touches; on the same fixed build at normal load it passed (sound on worst 0.056 s, off 0.053 s). The chapter check's long evaluate across the chapter change occasionally dies with "Execution context was destroyed" with no document navigation; the pre-fix code does the same (1 of 4 runs), so the suite logs it and retries once.
  - **The ear** (critic.py): the first full-mix run answered "yes" to a bell at 13.50 s and a tick at 5.30 s, both digital silence in the effects stem, so the whole run was discarded (it also said the D0 bed was softer at 5 to 9 s than at 10.5 to 14.5 s; the meter says 1.8 dB louder). A pour A/B with a silent gap and a nonexistent drum as controls passed both controls, then called the old pour "levelled" and the new one "rising", which the band meters contradict (above), so it is recorded, not acted on. H.69's "every I.7 Capacity event audible" is withdrawn as evidence: audibility is recorded as frame exposure (the share of 50 ms frames in which a cue beats voice + bed in some 0.4 to 8 kHz third-octave band: from 17%, the D2 converge air, to 84%, the D5 spill, per the review).
- **H.71 Sound, fix round 2 after the second audio review** (serves E.4, E.6, E.14 and I.8; amends I.1.7, I.2.3, I.2.5, I.3.3, I.5.1, I.5.2, I.6.2, I.6.7, I.7 and I.8; supersedes the H.70 settle). Measured on `renderAudio(0, 6)` at 390 x 844 and with real CDP taps and keys WITHOUT the autoplay flag; evidence in `shots/audio-fix2/` (`meters.txt`, `exposure.txt`, `sound-qa.txt`, `render/`).
  - **The D3 pour is not a riser** (I.1.3 "no risers", O5; the review's major). The H.70 settle changed only the last 15% of the window: the first 3 s were still a filtered-noise sweep of 1.7 octaves with a +7 LU crescendo, ending 0.10 s before the claim bell, and its centre finished in the 2 to 3 kHz consonant band. Now `pour.fill` and `pour.sweep` carry the amount WITHOUT a sweep-and-crescendo: the band centre is `800 x 2^(0.75 A)` Hz (800 Hz to 1.35 kHz, under one octave), the noise level is flat after its 250 ms attack (the 0.55 to 1.0 crescendo is gone), and the amount A is carried by the tone (-40 to -26 dB) and the grain density (2 per second up to the recipe's rate, following A, not the speed). A reaches 1 at `POUR_SETTLE` 0.6 of the window and holds, and the noise AND its grains ease down 3 dB over the rest, so the last 1.4 s before the D3 claim is flat or falling. Levels recalibrated alone: `pour.fill` M max -38.5 LUFS (target -38), `pour.sweep` -42.5 (target -42). Measured on the effects stem, unducked, through the D3 window: centroid 1078 to 1699 Hz (0.66 octave; was 770 to 2515, 1.7 octaves), M +0.8 LU after the attack and +2.1 LU counting the window that ends in it (was +7 LU), energy above 1.5 kHz +3.6 dB (was +23 dB), the last second before the bell M -40.2 to -41.7 LUFS with the centroid flat (1607, 1554, 1699, 1617 Hz). At 28.6 s, "it is measurable", the pour now sits 5 dB lower at 2.5 kHz. `sound-qa pour` gates it (centroid < 1 octave, rise < 3 LU, last second flat or falling).
  - **The duck bridges early sentence changes** (I.3.3). Each clip's duck released 0.7 s after its last span and the next clip ducked again 0.1 s before its first syllable, so between beats the bed popped up 4 to 7 dB for 0.3 to 1.2 s (the ear heard the D4 -> D5 swell as an "air sweep"). And live, the director released the ducks at the clip FILE's end with tau 0.12, 0.58 s earlier and faster than the reference mix. Now: when autoplay carries on into a narrated beat, the release after a clip's last span moves to the next beat's planned first duck-down (known from the plan: this beat's total, the next beat's LEAD and first speech span) plus `BRIDGE_SAFETY` 2.0 s whenever that duck-down follows the release within `DUCK_BRIDGE` 1.5 s; the next clip's schedule replaces it, and if no clip follows (paused in the breath, a missing clip) it still releases. The release's tau is `DUCK_RELEASE_TAU` 0.6 s (was 0.23), so the long gaps rise instead of swelling. The natural end of a clip no longer releases the ducks, and an autoplay beat start keeps them (a user cut, pause, seek, explore or sound off still releases at once, tau 120 ms). The offline render bridges by the same rule. Measured (ducked bed stem): D0 -> D1, D1 -> D2, D2 -> D3 and D4 -> D5 now hold -6 dB through the change; the only un-duck windows are D3 -> D4 (2.05 s) and D5 -> D6 (4.64 s), both rising to full; inside every speech span the bed sits at -6.00 dB (worst -5.93). Live (`sound-qa bridge`): -6 dB throughout the D0 -> D1 gap, back to -0.1 dB in D3 -> D4. `sound-qa duck` adds: no un-duck window between the first and last syllable shorter than 0.8 s. Bed stem ducked -36.6 LUFS (target -35.5 +/- 2).
  - **A hidden page always pauses everything** (O4, I.3.6; the review's second major). `onShow()` returned before clearing its `hidden` flag when sound was off, and `onHide()` returns while that flag is set, so after sound on, off, hide, show, on, the next hide did nothing: the clip and the bed played on the lock screen (with the 'playback' session, through the silent switch too). Now onShow clears the flag (and its timer) before any other return, and `enable()` resets it from `document.hidden`. `sound-qa hidden2`: on, off, hide, show, on, hide leaves the context suspended, the master at -120 dBFS and the audio clock stopped; shown again, the clip continues.
  - **The session race** (O2). `disable()` set the session to 'auto' on a 220 ms timer unconditionally, so off then on inside 220 ms (a double tap, M twice) ended with sound on and the session 'auto', which on an iPhone in silent mode mutes Web Audio without a trace. The timer now checks a serial that `enable()` bumps, and `enabled`. `sound-qa session`: off and on 120 ms apart leaves the session 'playback' (log: 'playback' only).
  - **Back to the tab while idle** (I.3.6). Showing the tab re-claimed 'playback' and resumed an idle context for another 12 s with nothing to play, which on an iPhone pauses the viewer's music every time they return to the lesson. Now, when the context was idle, or the hide paused nothing while the story was not playing and the bed was silent, onShow restores the master for later and leaves the context asleep as idle with the session 'auto'; Play, a step or a tap wakes it through the usual paths. `sound-qa idleshow`: after the show the context stays suspended, idle, session 'auto', toggle On; Play resumes the clip where it paused (1.153 s from 1.153 s) with 'playback' again.
  - **Keys unlock on desktop** (I.4, returning '1'). The unlock listener required a target inside `.st-root`, but a key pressed with nothing focused targets the body. A keydown on the body or the document element now counts while a chapter is mounted. `sound-qa keys`: ArrowRight, Space and E each unlock (running 1 to 12 ms later).
  - **The tick family, offered for the owner's A/B** (I.1.3, O5; the fifth-listen risk). `tick.dot` was a bare 880 Hz sine with its click 10 dB down (97% of its energy in the sine partials), against I.1.3's "the contact leads". The default is now the contact-led 'glass' recipe (the click at 0 dB, the dot pitch at -6 dB with tau 25 ms, the x 2.76 partial at -14 dB, sample peak -22 dBFS so its K-weighted energy stays within 0.3 dB of the old one under the voice); `?tick=round` plays the H.69 recipe for the A/B (`tickStyle()` in `prefs.ts`, read once per page because the bank renders once; `TICK_DEFAULT` flips the default). By energy the glass tick is still 87% sine: the change is in the attack and the shorter ring. The D0 "nine points" set sounds 4 of its 9 dots (a new `SfxCue.max`, 2 to 6, default 6: the first, the last and evenly between). OWNER'S CALL on the phone: open the chapter with and without `?tick=round`, tap Sound on, and keep the one that reads as chalk and glass on the fifth listen; record it here.
  - **Masked marks lifted** (I.1.1 "sound explains"). Frame exposure (50 ms frames, third-octave bands 0.4 to 8 kHz, ducked stems): D6 rows#0 had -0.2 dB of band margin (inaudible), D0 nine points#6 1.1 dB, D1 task names#2 1.9 dB. The D6 rows set is +3 dB (gain -2, was -5) and the D1 names set +5 dB (gain +2, was -3; raising the last name's pitch to D6 instead made it worse, -5.8 dB, because the voice's F2 sat there). Every cue now has at least 7.1 dB of margin in some band (D1 names#2 7.1, D6 rows#3 7.5, rows#5 7.6, rows#0 8.8).
  - **D5's loss under "the generalist"** (I.1.5). `resolve.fall` lands between "The generalist" and "wins the integral"; the picture is right (AREA LOST lands at 0.62), so the cue stays on its label and is 3 dB softer (gain -3: M max about -35 LUFS, -19 LU re voice), so it marks the specialist's lost area without reading as a verdict on the generalist. NOT done, for the foundation lead and the owner: the story-timing fix (let the D5 build wait for the first sentence with sound on, or split its narration so the first sentence ends as AREA LOST lands).
  - **The room brightens** (I.2.5). The bed's evolution was barely audible (phone-band centroid +15%, non-monotonic; the bed-only ear heard "it stays the same"): the room dominates the bed's spectrum and its lowpass never moved. Now the room's lowpass follows the beat, 800 Hz on a chapter's first beat to 2 kHz on its last (`roomCutoffFor`), with a trim that keeps its loudness constant (`roomComp`, pink noise through the room's filters measured offline: +1.2 dB over that range), and the octave layer spans -16 to -6 dB (was -14 to -8). Measured (bed stem, unducked, each beat after its 3 s glide, 4th-order highpass at 300 Hz): centroid 374 Hz at D0 to 533 Hz at D6 (+42%), loudness per beat -31.5 to -32.6 LUFS, first vs last 0.2 LU (no swell); whole bed alone -32.0 LUFS.
  - **Smaller fixes.** The Sound on chip's `::before` reaches 9 px above and 5 px below the pill (was 8 and 8). The pill sits 14 px above and 16 px below the card edge (its `top: -15px` is measured inside the card's 1 px border), so the 44 px hit area now runs from 23 px above the edge to 21 px below it, as I.5.1 says (it reached 24 px and took 3 px of the scrubber's band). Measured with `elementFromPoint` down the chip's centre column at 360, 390, 430 and desktop, on both base paths: the chip from -22.5 to +20.0 px, the scrubber from +20.3 px, no overlap (`shots/audio-fix2/ui/measure.json`). The Waiting dot is #019644 in the light theme, as the icon. The top-bar toggle renders only while a story chapter is mounted (a legacy LessonStage view can never narrate). `Bed.fadeTone` disconnects a faded tone once its oscillators end instead of keeping every faded tone in a list for the page's life. The render header and I.1.7 say "repeatable within 1 LSB" (two renders differ by 1 LSB on 1,582 of 5.68 M samples, 0.03%, Chromium's float rounding), not "sample-identical".
  - **QA** (`scripts/sound-qa.mjs`). Every test runs inside its own try / catch, so a crash is one FAIL and the suite continues, and a crashed test's contexts are closed. The chapter check's "Execution context was destroyed" is explained and fixed: it is not a navigation, a reload or load. Traced with CDP, the document never reloads (no load event, no lazyReload stamp, no executionContextDestroyed; only `Page.navigatedWithinDocument` from the app's pushState), and the same code through raw CDP `Runtime.evaluate` returns normally; Playwright 1.60 rewrites any protocol error of an evaluate that is pending across that pushState into this message. So no `page.evaluate` spans the chapter change any more: the page records into `window.__chap` / `window.__back` from its own rAF loop and Node polls with short evaluates (the old voice stops 3 ms after the change; the room reads -38.3 dBFS in the next chapter; back on Capacity beat 0 speaks 0.33 s of story time after loaded). `timing` measures each beat in story time (the sum of min(dt, 0.1) per frame) plus the audio clock while its clip sounds, never in wall time, and adds: every clip sounds for its manifest duration on the audio clock, and no beat advances before its clip end plus a breath. `deeplink` compares the story state of `?sound=0` and `?sound=1` exactly and compares pixels only between two loads that share a chart frame (the `def-fan` probe). Correction to H.69 and H.70: the 2.2% deep-link pixel difference was neither load nor the adaptive-quality monitor; it is the chart frame differing between page loads with `?sound=0` on both (review 2: probe x0 -3.5288 or -3.5366), which predates sound. New checks: `hidden2`, `session`, `idleshow`, `keys`, `bridge`, `pour`, and the un-duck window in `duck`.
  - **Meters after the fix**: full mix -15.9 LUFS, -2.3 dBTP, LRA 8.0; voice stem -15.9 LUFS, -2.2 dBTP; bed -32.0 LUFS unducked, -36.6 ducked; effects stem sample peak -26.1 dBFS, M max -33.3 LUFS (the claim); resolve alone M max -29.9, resolve.fall -31.9 (-34.9 at its D5 gain); the limiter never engages (mix minus the sum of the stems is at most 1 LSB).
  - **The ear** (critic.py, a second opinion only). Tick A/B reel (glass then round, controls passed): glass "synthetic digital UI bleep", round "organic tap / chalk mark", glass more annoying. The same reel with the ORDER SWAPPED (round then glass, controls passed): round "synthetic digital blip", glass "organic tap / chalk strike", round more annoying. The ear called the first group digital and the second organic both times, so its tick judgement is order bias and is not evidence either way: the tick stays the owner's call on the phone. The D3 effect alone (+18 dB, controls passed): "no riser; it peaks early and fades before the bell", last second "falling", which the meter corroborates (above). Full mix: discarded, it answered "no bell" at 29.12 s and at 45.45 s, where the effects stem holds the two claim bells with 22 and 17 dB of band margin. Gap excerpts (31 to 44 s) of the old and the new mix: discarded, it gave identical answers for both files (no rise in the long D3 -> D4 pause, where the meter shows +6 dB in both; a "swell" and an "air sweep" at 40.9 to 42.1 s in both, where the new mix holds within 1 dB and the old one rises 7 dB: `ear/gap-meter.txt`). Questions and answers are in `shots/audio-fix2/ear/`.
  - **Negative control**: `shots/audio-fix2/negative-control.txt` runs `pour`, `duck`, `hidden2`, `session`, `idleshow`, `keys` and `bridge` against the pre-fix code: 11 failures, one per reported bug (the pour 1.59 octaves and +5.9 LU; six un-duck windows, the shortest 0.29 s; the bed at 0 dB between D0 and D1; a hide that leaves the context running at -33 dBFS with its clock moving; the session left at 'auto'; 'playback' re-claimed on showing an idle tab; no unlock from ArrowRight, Space or E), while the positive controls pass on both.
  - **Not changed, recorded**: the chip's top edge touches the D6 lineup's bottom panel at 360 and 390 on a deep link or a jump (the chip retires after 3 beats; adding its overhang to the focus margin would re-frame the first three beats when it retires); the chip's glyph stays speaker-with-waves before the tap (I.5.1, the owner's call); the ear-only notes (the claim bell as "chime", the D4 callout pitches, `pour.drain` "cheesy" in isolation) have no meter or code support.

### 2026-09-30, MetFix Lab: Modules 1 and 2 speak, the phone gauge strip

- **H.72 Narration belongs to the story; MetFix Modules 1 and 2 speak** (serves O1 to O4, O7 and O8; amends I.4, I.5, I.6.3, I.6.5 and section I "Voice"; H.65, H.66). The owner, on Modules 1 and 2: "more of a talking and explaining while showing the animation", in the voice he chose, Charon.
  - **The narration source is the StoryDef.** `StoryDef.narration` (types.ts `StoryNarration`: beat id -> text, hash, file, dur, speech, words, maxGap, lufs, tp), the story's generated `narration.gen.ts`, is the only place clips come from. A story without it has NO sound: no chip, no toggle (the lesson top bar keeps its class and width rules), no "M for sound" in the keyhint, M does nothing, no unlock listener, no AudioContext, no ui sounds and the C.3 timing; the director is inert (`live` false). On metfix-lab no /fitness chapter declares it: Capacity's clips (`public/narration/definition/`) and cue sheet (`stories/definition/sound.ts`) are kept, dormant, and the global `story/audio/narration.gen.ts` is gone. MetFix Modules 3 to 8 do not declare it either.
  - **The script lives beside the story**: `narration.json` (`clips`: its folder under public/; `beats`: id -> { source, text }), and the clip hash is sha1 of the spoken TEXT. A /fitness chapter's text must be its caption body (the "Voice" rule, digits rendered by `scripts/narration-spoken.json`), so a caption edit still fails the gate. A MetFix module speaks its own explanatory paragraph per beat (every sentence restates the module source; each beat names its passage) and its captions are unchanged: they stay the subtitles (O7).
  - **Gates**: `scripts/narration-manifest.mjs` writes every narrated story's narration.gen.ts; `scripts/narration-check.mjs` (fitness-gate step 3) fails on a beat without text, a narrated id that is not a beat, a dash, a missing clip for a text's hash (edit a sentence and it fails until its clip is regenerated), a stale or undeclared manifest, a story.ts that declares narration without a script, and the I.6.5 pace, gap and level gates. A MetFix story may widen gate 4 (no inner gap over 0.8 s) to at most 1.6 s, with its reason, in narration.json `gates`; a /fitness chapter may not.
  - **Behaviour** is section I's: sound off by default, the chip asks once, the choice persists in `fitness-sound`, nothing sounds and no context exists before a gesture; each clip starts LEAD after its beat starts and the beat holds for the clip plus BREATH (from the build-time durations); pause and resume continue it; next, prev, seek, explore and a module change stop it; a hidden tab pauses it. Added: **reading holds the voice** (L14, H.56): the phone's expanded Read more and the desktop disclosure pause the clip like a finger, and it resumes where it stopped. Leaving a narrated story for one without narration fades the bed and lets the context idle-suspend; coming back restores the master. A lab story's bed plays in the intro key (`keyFor` falls back). The MetFix modules have no cues (no sound.ts): the voice, the bed and the ui sounds.
  - **MetFix look**: the chip and the toggle take MetFix blue through `--st-sound-on`, `--st-sound-on-rgb` and `--st-sound-on-light` (audio.css falls back to the lesson's lime); the toggle sits in the MetFix top bar before Preview; the chip uses the course's face.
  - **Measured** (390 x 844; the gesture rule with real CDP taps and keys WITHOUT the autoplay flag, which is used only for timing and the mixdowns; 157 checks): no AudioContext and nothing fetched under /narration/ before a gesture, with the choice undecided or '1'; a tap on the chip, a tap on Next ('1' stored, the toggle Waiting) and M on desktop each start it; /fitness shows no sound UI and creates no context after taps, M and `?sound=1`. The 16 Charon clips run 13.8 to 19.9 s at 2.38 to 3.21 words a second, -17.2 to -19.1 LUFS, true peak -2.0 to -4.4 dBTP; Module 1 runs 133.6 s with sound on (67.9 s off), Module 2 137.1 s (63.2 s off). Autoplayed end to end, every clip plays its whole duration once on the audio clock, in beat order; it starts 0.10 to 0.19 s after its beat starts as sampled (LEAD 0.2 s; a sampled beat start lags by up to a frame); the next beat starts 0.67 to 0.80 s after the clip ends (BREATH 0.65 s plus at most a frame) and every beat lasts its planned total within 0.09 s; consecutive clips are 0.85 to 0.92 s apart, never overlapping. Sound off, every beat lasts the C.3 rule within a frame. Reference mixes (`renderAudio(0, 7)`): Module 1 -15.7 LUFS, -1.9 dBTP, LRA 2.5 (voice stem -15.8, bed alone -32.2); Module 2 -15.6 LUFS, -2.0 dBTP, LRA 2.5 (voice -15.6, bed -32.2). Gate 4 is 1.1 s for both: paragraph narration breathes between sentences (Module 1 logic 1.04 s, between deduction and induction; Module 2 questions 0.84 s, rare 0.81 s), and since the duck merges gaps up to 0.8 s only, the bed lifts briefly in those three breaks.
- **H.73 MetFix gauges on a portrait phone** (src/metfix-lab/kit/GaugeHud.tsx; Modules 7 and 8; the owner on Module 7 on a phone: "glucose and the graph overlapping on the graphics"). On the 'phone' shell the gauge HUD is a slim full-width strip of its own under the top bar (33 px, two thin bars side by side with their LOW / HIGH words), cut out of the focus rect with `useFocusInset(.., 'top')` while the HUD is mounted, shown or not, so the camera frames the scene below it and the framing never jumps as the gauges fade in; the stories' glass (it reads `hudBox`) fades the glucose and moves the keys clear of it. The focus rect starts at y 41 (was 8). Desktop, tablet and landscape keep the chip: at 1440 x 900 no label sits under it and the loose marks already keep clear.
- **H.74 The picture follows the voice** (MetFix Modules 1 and 2; serves O3 and O7; amends I.6.4, I.6.5, I.6.7, H.72 and H.73). Review of H.72: with sound on, every beat still built in its designed 5 to 6.6 s and then held an almost still end frame for 8 to 15 s while Charon talked, so each reveal landed 5 to 13 s before its words ("Induction", "Predictive strength", "like this meter", "minds", "flipped", "Just 1.9%", "Each dot here is 100 people"). The owner asked for talking and explaining WHILE the animation shows.
  - **Sync knots.** `NarrationClip.sync` holds knots [build t, clip seconds]. With sound on, a narrated beat's build t is a fixed piecewise-linear map of the clip position as heard (`syncT`, hooks.ts: from the build's start at the pre-roll through every knot, then the designed rate; the position is read live from the audio clock less the output latency while the clip sounds, `audioHooks.clipPos`), never backward: armed mid-beat (sound turned on, play after a seek), the picture waits at its t until the voice catches up. The map comes from build-time data only, so the timeline is deterministic, and scene properties still depend on T alone, so `?beat=N&t=X` and every deep link are unchanged. A synced beat's hold is the rest of its voice plus BREATH (`pb.holdFor` 0) and its planned total is its span; sound turned off in that hold restores the reading rule. Not under reduced motion or a self-clocked step. Sound off: unchanged (the C.3 build and hold).
  - **Anchors and alignment.** narration.json `sync`: [t, at, offset], `at` a sentence index (0 first) or a phrase that occurs exactly once in the paragraph; t lands at that word's onset in the clip plus offset seconds. Onsets come from `narration.align.json`, written by `scripts/narration-align.py`: CTC forced alignment of the known text against the clip (torchaudio WAV2VEC2_ASR_BASE_960H, digits read as words), so nothing is recognised and nothing can be misheard. Whisper word times are not used: at sentence starts they miss by up to 0.9 s on these clips (replicate "Science" 11.15 s against 12.05 s, answer "What" 8.93 against 9.59, positives "Only" 5.11 against 5.57; the energy onsets are 11.99, 9.58 and 5.46), CTC by about 0.1 s. Without anchors a beat with an alignment stretches its build to its last sentence; `"sync": []` keeps the designed rate. `narration-manifest.mjs` resolves the anchors into each beat's knots; `narration-check.mjs` fails when a narrated beat's alignment is missing or made for another text or clip, an anchor's sentence index is out of range, a phrase is missing or not unique, t leaves (0, 1] or falls, the anchor times do not increase, or the warped build ends after the clip.
  - **Choreography.** One monotone warp cannot reorder reveals, and Module 1 is a split screen whose two sides built at the same time while the voice explains the left one, then the right one. So, in both modes and inside each beat's unchanged build and hold (the silent timing is the C.3 rule, measured), a split's right side now follows its left side: certainty, MORE / LESS LIKELY (0.64 to 0.70), the meter (0.72 to 0.98) and the green question mark's calm after the switch's slam; logic, the sun, its tally and EVERY DAY after the deduction (`SUN_A` 0.6, `SUN_DAY` 0.07); predict, the target (0.3 to 0.42) and the four results (`EVT` 0.5 to 0.8, REFUTED 0.86 to 0.96) after the lid and CANNOT CONFIRM; question, P-VALUES (0.78 to 0.86), then WHAT YOU WANT TO KNOW (0.88 to 0.96); probability, the die's six rolls (0.28 to 0.55), then the meter, the head (0.56 to 0.68), IN OUR HEADS (0.64 to 0.72) and the evidence (`EVB` 0.74 to 0.94); fork, SCIENCE THAT WORKS (0.74 to 0.86) after BROKEN SCIENCE; replicate, the right end's bloom and PREDICTS AND REPLICATES (0.74 to 0.84) after the left rail breaks. Module 2: questions, the Bayesian line drops clear (0.34 to 0.5) and BAYESIAN lands (0.44 to 0.52) before its letters swap (0.52 to 0.68; the not-equal 0.7 to 0.86), so it never sits on the frequentist line while the voice asks its question; rare, 1 DOT = 100 PEOPLE (0.76 to 0.84) after 1 IN 1000 HAS IT, and the "= ?" closes the beat (0.86 to 0.96); alarms, FALSE POSITIVES (0.82 to 0.92) after the sweep; positives, 4,995 FALSE POSITIVES (0.84 to 0.94) after 99 HAVE IT; broken, the camera (0.4 to 0.72), then the two formulas (0.72 to 0.94) after 36% FALSE. End states are unchanged.
  - **The anchors** (narration.json, one note per module in `_sync`): each reveal lands on its words, e.g. the switch slams on "switch" and the meter rises to "meter"; the sun rises on "the sun" after "Induction", tomorrow's dawn on "tomorrow", NOT 100% on "Very likely"; the lid on "confirmed", the target on "Predictive strength", the results on "accurate predictions"; IN OUR HEADS on "minds"; the Bayesian letters swap on "flipped around"; 1 DOT = 100 PEOPLE on "Each dot here"; 99 HAVE IT on "Only 99"; 1.9% on "Just 1.9%"; the formulas on "Confusing these two probabilities". The picture holds still only where the voice is still on the same point (accurate's misreading, the answer's set-up, the last sentence of most beats).
  - **QA.** `scripts/metfix-sound-qa.mjs` (in the repo; it was tools/metfix-sound.local.mjs): the timing test also checks that every frame of a sounding clip shows the build t its knots map the clip position to (within 0.12 s plus the sample's frame of the audio clock) and that each build ends where planned. `__story.audioTimeline()` adds each beat's speech spans, build span and knots; `__story.audio().beatHold.sync`. `scripts/sound-qa.mjs` (Capacity) is dormant: no /fitness chapter declares narration, so it exits with a notice unless `SOUND_QA_FORCE=1`.
  - **Module 7** (H.73 follow-up): on tall phones beat 2's push-in put the top of the pancreas prop under the gauge strip (390 x 844, 360 x 780, 430 x 932); the prop steps back under the HUD's glass alone (`hudClear`, glass.ts) and returns with the camera. Desktop and 390 x 664 are unchanged.
  - **Measured** (dev and preview builds of e7bd716, each made after its commit: 23:39:31 and 23:39:41 against 23:39:07; `scripts/metfix-sound-qa.mjs`, 189 checks on each build, all pass; evidence in `shots/metfix-voice/`). The gesture rule with real taps and keys WITHOUT the autoplay flag: no context and nothing fetched under /narration/ before a gesture; the chip, Next and M each start it; /fitness shows no sound UI and makes no context. Autoplayed end to end with sound on (390 x 844, software GL): every clip plays its whole duration once, in beat order, starting 0.13 to 0.19 s after its beat; every frame of a sounding clip shows the build t its knots map the clip position to, within 0.12 s plus one frame of the audio clock (Module 1: 829 to 1,197 frames a beat; Module 2: 251 to 519, about 20 fps); each build ends where planned, within the frame that shows it; each beat holds until 0.67 to 0.82 s after its clip ends (BREATH 0.65 s plus a frame) and lasts its planned total within 0.16 s; consecutive clips are 0.85 to 0.96 s apart, never overlapping. Sound off: every beat lasts the C.3 rule within a frame. Pause, resume, next, prev, seek, explore, a hidden tab, Read more and a module change behave as in H.72. Reference mixes (`renderAudio(0, 7)`): Module 1 -15.7 LUFS, -1.9 dBTP, LRA 2.5 (voice stem -15.8, bed alone -32.2); Module 2 -15.6 LUFS, -2.0 dBTP, LRA 2.5 (voice -15.6, bed -32.2); 133.6 s and 137.1 s with sound on, 67.9 s and 63.2 s off, as before. Independently, the words were CTC-aligned again INSIDE the rendered voice stems: all 124 anchors put their build t on screen within 0.03 s of the word as heard plus its offset (`<slug>-sync-verify.txt`). The review's words against their reveals (`reveal-vs-word.txt`, a reveal starting at its cue window's first t): the switch slams from 0.1 s before "switch"; the meter rises from 0.48 s before "meter" to 0.35 s after it; the sun comes up 0.29 s before "Induction"; the target 0.3 s before "Predictive"; IN OUR HEADS 0.2 s before "minds"; the Bayesian letters swap across "Same two things, flipped around", complete 0.48 s after "flipped"; 1 DOT = 100 PEOPLE 0.2 s before "Each"; 99 HAVE IT 0.15 s before "Only"; 1.9% 0.09 s after "Just"; the two formulas 0.2 s before "Confusing". Frames at every anchor plus each clip's start, middle and end at 390 x 664: `sync/390x664-final/`. Gauge strip (Modules 7 and 8 at 390 x 664, 390 x 844, 360 x 780 and 430 x 932, every beat at t 0.25 to 1): the strip is on, the focus rect starts below it, nothing labelled sits under it, and Module 7 beat 2 no longer puts the pancreas under it (`strip-final/`). Real-GPU black check (tier high): 0 of 80 frames on each of Modules 1, 2, 7 and 8. fitness-gate, typecheck and the dash check pass.
- **H.75 Every chapter speaks: MetFix Modules 3 to 8 and the whole /fitness lesson** (serves O1 to O4, O7 and O8; amends section I "Voice", I.6.5 and H.72; extends H.74). The owner, on the Module 1 and 2 preview: "look really great and sounds amazing, can we do it for all the chapter now and also our fitness one needs this too".
  - **The /fitness lesson speaks its own paragraphs.** Section I "Voice" (a /fitness chapter speaks its caption body) is superseded: like a MetFix module (H.72), every /fitness chapter has a `narration.json` with one explanatory paragraph per beat, written in the order the picture builds, every sentence restating the lesson's own text (fitnessData.ts: INTRO_TEXT, DEFINITION_TEXT, POWER_CONCEPT, MODULE_COPY, SKILLS, ARCHETYPES, HOPPER_DOMAINS, ENERGY_SYSTEMS, ENERGY_BENCHMARKS, CONTINUUM_EXAMPLES) or its captions, with no new facts or numbers; each beat names its passage (`source`). The captions are unchanged and stay the subtitles. narration-check drops the caption-body rule and instead fails a beat with no `source`; a /fitness chapter may widen gate 4 with `gates` as a MetFix module may. Clips live in `public/narration/fitness/<chapter>/` (the dormant caption clips in `public/narration/definition/` are gone) and `public/narration/metfix/<slug>/`. The Sound on chip and the top-bar toggle appear on every chapter because every chapter is narrated (`isNarrated`); the gesture rule (O1) is unchanged.
  - **The scripts** (voice/narration-round2.json, written in the main loop; voice/round2.mjs writes each story's narration.json and the TTS manifest): 94 paragraphs, 20 to 49 spoken words each, 3,788 words in all. MetFix 3 to 8 restate sources/module-N.md (Module 7: SOURCE-module7.md). Notation is written as it is said: Complex One to Four, cytochrome c, carbon dioxide, oxygen and water for the formulas, "ADP and phosphate", "one hundred sixty over ninety-five", "zero point seven", "PGC-1 alpha".
  - **Generation** (voice/gen_chapter.py, Charon, `PER_BEAT=1 MAX_PACE=4.3 MAX_INNER=1.6`, the Module 1 and 2 recipe): the transcript gate now compares the words letter for letter with the spaces removed and reads the course's notation as a transcriber may write it (NADH as N A D H, CoQ as co Q, acetyl-CoA as acetyl Co A, FADH with a subscript 2, GLUT4 heard as glute, Akt heard as act, Complex I to IV in Roman numerals, 160/95 and 50/50 as two numbers, 1RM as one rep max); a take tries "the direction was spoken" first (Charon spoke it on every take); a daily quota stops the run instead of waiting it out; the pace FLOOR counts a spelled acronym's letters (A T P takes as long as three words), the ceiling still counts written words. 93 clips on the shared key (100 TTS calls: 93 kept, 7 takes rejected for pace, 4 of them the acronym-dense Module 8 "atp"); the 94th (Module 8 "atp") on the owner's own key after the shared key's daily quota, first take.
  - **Levels**: encode.sh as for Modules 1 and 2; one clip (Module 3 "turbine") rebuilt from its WAV 0.5 dB lower for its true peak. correct.cjs is not idempotent (a second run measures the corrected MP3 but rebuilds from the WAV), so clips are copied from the first pass.
  - **Anchors** (H.74, one `_sync` note per story): every beat of the 13 newly narrated stories has 3 to 10 anchors, authored per story from its scene code and the CTC word onsets (four helpers, one per group of stories), so each reveal lands as Charon names it inside the beat's unchanged build; no scene code changed and sound off is unchanged. Examples: intro models' four shapes start on "First,", after "skills.", on "Three" and on "a continuum,"; skills ten's names land with the spoken list; hopper score's LEAD lands on "takes"; pathways workouts' cursor arrives at each pin on "400", "Fran," and "5k"; continuum bp's bead holds on each reading; health any-age's scanner reaches 50 on "fifty,"; Module 3 pump's arrows grow on "One", "Three" and "Four" and NO PUMP lands on "not"; Module 7 deaf's three chips start on their own sentences; Module 8 fix's badges heal one per sentence. A monotone warp cannot reorder reveals, so where a design packs two named things into one window, or builds them in another order than the voice names them, the first lands early (for example Module 4 krebs's FADH2 label about 6.6 s after its word, Module 5 superoxide's semiquinone label gone before its word, intro map's 05 CONTINUUM before 04 CAPACITY, hopper every-run's green run before the 64) and some beats hold a still picture while the voice finishes a point (skills both about 9 s, hopper many about 8 s, health line about 8 s). The helpers' lists of these spots are the input for a choreography pass like Module 1's (H.74), which changes build order in both modes and waits for the owner's review. Two health lines keep their recorded wording (line: "Where any part of the surface dips", which only happens from sink on; sink: "after fifty", which the Sedentary model does not mark): their rewrite waits for the next TTS quota.
  - **Measured**: preview build of dd63110, `scripts/metfix-sound-qa.mjs` one browser at a time (software GL, 390 x 844): 1,012 checks pass. The gesture rule holds on /fitness too (the chip and the toggle, no AudioContext and nothing fetched under /narration/ before a gesture, a chip tap starts the chapter's voice, M on desktop); behaviour as in H.72; in all 15 stories every clip plays its whole duration once, in beat order, each beat holding until its clip ends plus the breath; sound off, all 110 beats last the C.3 rule; renders: mixes -15.6 to -15.8 LUFS, true peak -1.9 to -2.4 dBTP, voice stems -15.6 to -15.8 LUFS, the bed alone -31.8 to -32 LUFS (before H.76). Seven checks miss, all one kind: in the first 0.4 to 0.67 s of seven /fitness clips (continuum one-line, health line and hold, hopper specialists, unknown, many and every-run) the picture shows the build t of 0.2 to 0.25 s earlier, then follows within the tolerance for the rest of the clip; the engine places the picture at the clip position as heard (less the output latency) while the check reads the raw position, and these scenes' first frame is heavy in software GL. Every MetFix beat passes. Three runs in parallel on one machine failed 83 checks with timing jitter of the same kind (and one first clip that never armed): run the sound QA one browser at a time. A long run can stall in `render`; the same render alone passes in seconds. The live preview serves every clip byte-identical to the build.
- **H.76 No hum under the voice** (2026-10-01; amends I.2.5 and the H.69 calibration). The owner, on the narrated /fitness lesson: "there is a hum sound behind" and then "the hum is kind of bad ... remove it". The hum was the bed's TONE (the chapter's suspended chord of sines, with its twin, 3rd harmonic and rising octave) sustained under every clip. `BED_LEVEL.note` is 0, so the chord is silent while its graph, the claim bells and every bed state stay as designed, and `BED_LEVEL.room` is 0.0182 (6 dB down), a faint air under the voice. The sound QA's bed check is now "at or below -36 LUFS"; measured -45.9 to -46.9 LUFS for the bed alone (was -32), mixes unchanged at -15.6 to -15.8 LUFS (the voice dominates them). The same change is on the /fitness release branch.
- **H.77 The MetFix course thread: bridges and the trailer** (2026-10-01; H.65, H.66; `src/metfix-lab/STORYBOARD-bridges.md`). The owner, after hearing every module narrated: the chapters felt disconnected, Module 3 "directly started with the mitochondria. There was no context set". Each module now opens with a one-beat BRIDGE on a shared course map (`src/metfix-lab/kit/CourseMap.tsx`: four part bands, eight stops with their glyphs, one pen path; the last module's stop fills with its TAKEAWAY, the path draws on, the next stop rings with its QUESTION, the camera hands off), and a six-beat course TRAILER plays at `/metfix-lab/trailer`. Append-only engine change, every new field optional with today's behaviour as its default, so no /fitness chapter and no module changes: `StoryBrand.endExplore` (false drops "Explore this model" from the finished last beat's row; with no button left there is no row), `StoryBrand.endCta.go` (an in-app link instead of a new tab, rendered like `endNext`, outline when `endNext` is set), and `StoryBrand.onNext` (the host's next step past the last beat: `navigateChapter(1)` calls it for a branded story, so Next, the Right key and a swipe on the last beat reach it, and the transport's arrow stays enabled there, labelled "Continue"). The shell plays `bridge-<n>` before Module n whenever `/metfix-lab/<slug>` opens without `beat`, `t` or `explore` and swaps to the module in the same stage when the bridge reaches 'done' while playing (never on a held deep link, a seek or under reduced motion) or on Next; `?intro=0` skips it; `/metfix-lab/<slug>/intro` plays it alone and holds its end. Every module's end card names where the course goes: "Next: Module N+1, <its QUESTION>". The trailer ends on [All modules] [Start Module 1]. `scripts/metfix-sound-qa.mjs` maps a narrated `bridge-<n>` to `/metfix-lab/<slug of module n>/intro` and `trailer` to `/metfix-lab/trailer` (views `lab-metfix-bridge-<n>`, `lab-metfix-trailer`), and opens the modules with `?intro=0`.
- **H.78 The athlete kit** (2026-10-01; `src/fitness/story/kit/athlete/`, C.11; serves the Technique storyboard, `STORYBOARD-technique.md` 7.3). Append-only: a new kit folder, nothing existing changes. A 1.78 m athlete in profile in the lesson's look: a dark ink body (`makeRimStandard`, a faint rim) under a constant-width chalk pen contour drawn as an inverted hull, three draw calls per figure (a depth prepass, the fill at less-equal so a fade or a ghost tint is one layer, the outline); a face in profile and ears, a trunk lofted along a real spine so the lumbar curve is the back's shape. The rig is joint space (`rig.ts`): bones keep their length, the legs are two-bone IK from planted feet, the knees sit exactly over the foot line once flexed, the hips' x is solved so the whole-body centre of mass (the implement included) is over mid-foot, and the medicine ball loads the balance only once it leaves the floor. Movements (`moves.ts`): 'mb-clean' (set-up, pull, extend, under, receive, stand, finish, return; one rep loops) and 'mb-pull' (the threshold beats' cycle), keyed to the Level 1 Training Guide's p. 208 photographs, plus the squat family. The rounded back (`faults.ts`, `PULL_SCALE`): the lumbar curve 40 to -20 and the hips rising ahead of the chest with the chest held at its textbook height (so the ball stays down), full through the set-up and pull, straightening as the hips extend. Story time only: `tempoPhase()` is closed form, so the 1 : 1.2 : 1.4 tempo never makes the phase jump and lands on a chosen position at t = 1. The floor is a band (`<Floor/>`): the camera's eye is above the floor, so a single line at the body's midline would cut the near foot and float the far one. Review page `/athlete-lab` (`src/athlete-lab/`, routed in development and on the /preview/ build only, noindex). Measured: about 28k triangles per figure (three passes), 19 to 26 calls a frame on MEDIUM with post; `?beat=N&t=X` reloads to identical pixels; (N, 1) equals (N + 1, 0) at every lab beat; 0 black frames of 148 on a real D3D11 GPU at tier high. Not built (the chapter does not use them; the rig exposes their inputs): the plumb line, bar-path trace, joint angle arcs and the hip-crease line.
- **H.79 Chapter 07, What Is CrossFit?** (2026-10-01; `src/fitness/STORYBOARD-crossfit.md`, `src/fitness/stories/crossfit/`; B.2, B.5, C.14, H.57). The owner asked for the July Module 07 page (19f48e5, removed in be4f7d0) to be researched and rebuilt as a story; it is the lesson's seventh chapter at `/fitness/crossfit`, after Health. Registration: `ModuleKey` gains 'crossfit'; `MODULES[6]` (num '07', accent `PAL.gymnastics`, which no other chapter uses), `MODULE_COPY.crossfit`, `CROSS_LINKS.crossfit`, five crossfit sources and a research section of verbatim, page-cited constants in `fitnessData.ts`, so the caption audit resolves every source (section E item 18, a byte-identical `fitnessData.ts`, no longer holds; the additions are append-only except `ALL`, so the three general sources also list under 07); `scripts/seo-routes.mjs`. Everything ordered by `MODULES` follows: the top bar and the chapter sheet list seven chapters (B.5 said six rows), the progress hairline has seven segments (B.2 said six), Health's finished beat offers "Next: 07 CrossFit", and the lesson's end (H.57: the disabled Next, Back to overview, "Lesson complete" once all seven are done) moves to this chapter. The intro is unchanged by decision: its six-tile map, explore chips and hub list read `MAP_MODULES` (`stories/intro/models.ts`, the six models). Engine touches, both append-only: a pyramid glyph case in `ui/ChapterGlyph.tsx`, and a chapter key in `audio/bed.ts` (`KEYS` is a record over every view). Narration is open: H.75 has every /fitness chapter speak, but this one declares none yet (as briefed), so with sound on the voice and bed stop at 07 as for any unnarrated story; its paragraphs would restate the captions and the cited constants. The chapter's C3 and C4 chart uses its own `useChartFrame`, not `StoryDef.frame`, because its explore model is the pyramid and the explore re-fit checks read `StoryDef.frame` as the explore subject. Measured: `story-qa check crossfit` all 169 checks pass on a static build; 0 black of 200 story and 13 explore frames on a real D3D11 GPU at tier high.
- **H.80 Chapter 08, Technique** (2026-10-02; `src/fitness/STORYBOARD-technique.md`, `src/fitness/stories/technique/`; B.2, B.5, C.14, H.57, H.78, H.79). Greg Glassman's essay "Technique" (L1 Guide pp. 40-44) is the lesson's eighth chapter at `/fitness/technique`, after What Is CrossFit, in ten beats (T0 to T9) as the storyboard sets out, captions verbatim. Registration as H.79: `ModuleKey` gains 'technique'; `MODULES[7]` (num '08', label 'Technique', accent `PAL.weightlifting`, the storyboard's proposal, owner to confirm), `MODULE_COPY.technique`, `CROSS_LINKS.technique`, a "Technique, Part 1" source (and the L1 Guide's entry lists 08), and four verbatim, page-cited article blocks (`TECHNIQUE_SEE`, `TECHNIQUE_TERMS`, `TECHNIQUE_GRAPH`, `TECHNIQUE_SPEED`, storyboard section 8) so the caption audit resolves every source (85 to 100% cited words); `scripts/seo-routes.mjs`. Everything ordered by `MODULES` follows: eight chapters in the top bar and the sheet, eight progress segments, CrossFit's finished beat offers "Next: 08 Technique", and the lesson's end (H.57) moves to 08. The intro keeps its six-tile map (`MAP_MODULES` leaves out 07 and 08). Engine touches, append-only: a Figure 1 glyph case in `ui/ChapterGlyph.tsx`, and a chapter key in `audio/bed.ts` (F, dormant until the chapter declares narration; none yet, as briefed). One engine chart frame for the whole chapter (`StoryDef.frame`, minAspect 0.70: the storyboard's 0.62 start tuned so every tall phone sits on the clamp and a caption or sheet detent never rebuilds it) and one front-on camera for every beat and explore; beats hand off inside the frame (Figure 1 FLIPs into T4's inset, the plane into T7's sub-rect). The athlete (H.78) appears only in T4, T7 and T8, its rep phase a closed-form integral of the path's tempo that lands on the pull at each beat's end (`techniqueMath.ts`, probe `tq-reps`). The kit's rig caches a pose by T, so a new chart frame at a held T would leave the figure and its ball seams where they were, and a new rig per render reused version numbers and drew stale poses; the chapter keeps one rig per figure and re-poses it through a small subclass keyed on T and an epoch (`KeyedRig`, Lifters.tsx; explore bumps the epoch every frame). Measured on a /preview/ build: `story-qa check technique` 201 of 205 checks pass, then the label gates alone 161 of 161 after the one fix (FIX IT AT THAT SPEED, culled at 390 x 664, now sits under the dip it rises from); 0 black of 310 story and explore frames on a real D3D11 GPU at tier high; at most 38 calls and 57k triangles (T4, two figures). Open: T1 and T2's bodies (131 and 133 characters, the storyboard's) take a fourth line at 390 px because Read more wraps (A.5 item 19 asks three), so the card grows 22 px there and the camera re-centres at the T0|T1 and T2|T3 boundaries (story-qa continuity 8.5% and 7.7% at 390 x 844; every other boundary 0.000%); a trim of a few characters in either caption, a storyboard call, removes it.

---

## I. Sound

Status: BINDING. Added 2026-09-27 by the sound designer (amendment H.67) and revised the same day after the audio review (amendment H.68). With sound off, nothing in sections A to H changes. The owner decisions below are not reopened by anyone; everything else here follows the precedence rules at the top of this file.

**Owner decisions (O1 to O9)**
- **O1** Sound is OFF by default. A first-visit "Sound on" chip lives with the caption card; a compact speaker toggle lives in the top bar. The choice persists in `localStorage['fitness-sound']` (`'1'` on, `'0'` off, absent means undecided). Turning sound on IS the user gesture that unlocks audio: before it, nothing makes a sound and no AudioContext exists.
- **O2** Web Audio for everything. The AudioContext is created lazily inside that gesture. Where supported, `navigator.audioSession.type = 'playback'` (tradeoff in I.3.6).
- **O3** Narration drives timing when sound is on (I.6.4). Durations come from a manifest generated at BUILD time, never from runtime decoding. With sound off, timing is exactly today's, and the `?beat=N&t=X` seek contract is unchanged in both cases.
- **O4** Behaviour: pause and resume continue the clip; prev, next, seek and scrub stop it; explore stops narration; a chapter change cancels it and crossfades the bed; a hidden tab pauses everything; reduced motion never disables sound (I.4).
- **O5** Sound design is procedural Web Audio: no audio files other than the narration and no new dependencies. A small palette tied to meaning plus a very quiet generative bed per chapter. Chalkline tone: calm, precise, premium; a coach at a whiteboard in a quiet gym at night. Not trailer bombast, not game bleeps. It must not annoy on the fifth listen.
- **O6** Mix: voice about -16 LUFS integrated and always intelligible; bed around -32 LUFS; effects never louder than the voice; bed and effects duck under the voice; a master limiter; true peak <= -1 dBTP.
- **O7** Captions stay on screen as the subtitles.
- **O8** A consistency gate (`scripts/narration-check.mjs`, wired into `scripts/fitness-gate.mjs`) and a build-time duration manifest (`scripts/narration-manifest.mjs`), I.6.5.
- **O9** QA hooks: `?sound=0|1`, `window.__story.audio()`, `window.__story.renderAudio(fromBeat, toBeat)`, I.6.7.
- **Voice** (superseded for MetFix by H.72 and for /fitness by H.75: every story now speaks its own explanatory paragraph per beat; the rest of this bullet stands): Charon (Gemini TTS), one clip per beat, speaking the caption BODY and nothing else: no title (the title is read on screen), no direction, no preamble. Clips live in `public/narration/<view>/<beat>-<hash>.mp3`: mono MP3, -16 LUFS integrated, true peak <= -2.0 dBTP, 120 ms of silence at each end, and every clip passes the I.6.5 gates before it is kept.

**Asset status (2026-09-27, 18:13 UTC). Read this before building.** No usable clip exists yet. `voice/narr-mp3` was never produced. On the VPS, `gen_batch.py manifest.json narr Charon 2` is still running: it has written 13 raw WAVs (intro 4, skills 3, hopper 3, pathways 3; none for definition, continuum or health) and nothing since 17:08 (it is sleeping on 429s), from a manifest extracted before the latest caption edits (6 of 46 hashes are stale: hopper/unknown and pathways phosphagen, oxidative, power, workouts and all-three). And every clip it keeps is defective: its prompt begins "Read this warmly and clearly, like a coach explaining an idea at a whiteboard:", and the clips SPEAK that sentence, pause about 1 s, then speak the caption. Measured: in all 3 clips checked (intro/models, intro/map, skills/both) a 0.9 to 1.3 s silence ends 5.8 to 6.1 s in, after a first span of 4.7 to 4.9 s whatever the caption's length; the first span of intro/models transcribes as exactly the direction sentence and the rest as exactly the caption. Its whole-clip transcript check let them through because whole-clip transcription of such a clip is nondeterministic. All 13 are discarded.

Order of work (binding): (1) stop that run; (2) re-run `extract.cjs` against the current chapter heads; (3) generate with the I.6.5 method and gates, definition first; (4) encode and copy the 7 Capacity clips into `public/narration/definition/`; (5) only then can the exemplar commit, because the gate (I.6.5) cannot go green without them and is never bypassed. The other chapters' clips are generated after each chapter's captions freeze, and again after any later caption edit (the gate forces it).

#### I.1 Principles

1. **Sound explains.** Every sound means one thing the viewer can see at that instant: the pen is drawing, a mark has landed, light is filling, a brick has hit, the claim has landed, the view is revealing depth. A sound with no visible cause at that moment does not exist.
2. **The voice leads.** Everything else sits under it and ducks for it (I.3.3). Nothing is ever louder than the voice. No continuous effect is louder than -22 LU re voice, because the voice lives in the 1 to 4 kHz band those effects would cover.
3. **A coach at a whiteboard in a quiet gym at night.** Soft, close, dry, precise: chalk, glass and light. The contact leads and any pitch rings like glass: no bare sine blips, no e-piano chimes, no slide whistles. No risers, booms, sub drops, dramatic whooshes, stingers, zaps, coins or tunes. No reverb: the bed is the room. A set of events may change pitch only to show a direction (up for better or more, down for less) or to name one of a few things (the three engines keep one pitch each: phosphagen +7, glycolytic +2, oxidative 0 semitones from the tick pitch, introduced in that order in P1, P2 and P3), within 7 semitones in total and on the chapter's chord tones. The one exception is D4, which names three other chapters by their own tick pitches. Pitch moves only in steps (discrete events on chord tones), never by a continuous glide.
4. **Restraint budget** (checked per beat in I.7):
   - at most 4 cue entries per beat (a continuous sound, a repeated mechanic or a staggered set counts as one entry);
   - one claim sound (`resolve` or `resolve.fall`) per signature beat (A.3) and nowhere else;
   - at most 6 audible events in any staggered set;
   - never two continuous effects at full level at once: where windows overlap, the earlier one ducks 6 dB for the overlap;
   - no effect in the first 150 ms of a beat (the caption swap: say it, then show it);
   - at most 16 transient events in any second, effects and ambient grains together (I.3.6); above that the ear hears a texture anyway, and a texture is what `clack.rain` becomes (I.2.3);
   - every event gets seeded gain jitter (+/-1 dB). Pitch jitter only where it cannot beat against the tuned bed: +/-20 cents on noise sources and on transients whose pitched decay has tau <= 25 ms (the `tick.label` sine, `clack`, `ball`, `flip`, the `rattle` clicks, the `pour` grains, `ui.tap`); +/-4 cents on pitched events with longer tails (`tick.dot`, the fifth of `tick.claim`, `tick.close`, `tick.steel`, `tick.meet`, `ui.on`); 0 cents on `resolve`, `resolve.fall`, the `pour` tone, the `pen` head glow and the `pen.scan` tone, which sound with the bed (20 cents against a held F#5 beats at 8.6 Hz);
   - pitch comes only from the chapter chord (I.2.2); noise textures are unpitched, and the UI sounds are the same fixed pitches in every chapter (they belong to the chrome).
5. **Sound follows picture.** Ambient sound exists only where the picture has ambient life (B.11: the drum, the river), so a held, paused or reduced-motion picture has no ambient sound. Every cue's timing is sampled from the Scene's own cue function (I.6.2), so a retimed animation carries its sound with it.
6. **The phone speaker is the reference.** A phone speaker gives almost nothing below 300 Hz, so every sound keeps its identity between 300 Hz and 8 kHz, and anything low is doubled an octave up or carried by its partials. Everything is mono-compatible (no inverted-phase widening); effect pans stay within +/-0.35.
7. **Deterministic, and honest about it.** Every story sound is scheduled from the beat plan (I.6.4): its time comes from the scene's own cue function, its randomness from `rng.ts` seeds. The offline render of a range of beats repeats within 1 LSB at 16 bits (0.03% of samples differ by 1 LSB: Chromium's float rounding, H.71). It is the REFERENCE MIX, the closest measurable stand-in for the phone, not the phone itself: it runs Chromium's compressor, oversampler and MP3 decoder, not WebKit's; MP3 priming shifts speech spans by about 25 ms; realtime scheduling drifts by a frame. The real-iPhone checks in I.8 are the final judge.
8. **The fifth listen.** A sound that draws attention to itself on the fifth listen loses 3 dB or is deleted.

**What never makes a sound**: counting numbers (HUD readouts, totals, scores); fades, dims and focus pulls; gridlines, tick marks and axis titles (construction under the hot stroke); labels leaving; the slate and loading; parallax; hover, scroll and page chrome; any camera settle, framing move or return that I.7 does not list; a held deep link; a reduced-motion cut; errors; anything in explore the viewer did not touch; scrubbing, apart from its soft boundary tick (I.4).

#### I.2 The palette

#### I.2.1 Conventions

- **Noise.** Two noise buffers are made once per context from `mulberry32` (`rng.ts`): white (seed 0x5eed01) and pink (seed 0x5eed02, Paul Kellet's filter, normalised to -12 dBFS RMS), 2 s each, mono, looped. Each event starts them at offset `hash1(eventSeed) x 2 s`. Oscillators are sine `OscillatorNode`s unless stated. No AudioWorklet, no files.
- **The transient bank** (`bank.ts`). Every short recipe (the `tick` family, `clack`, `ball.drop`, `flip`, `tick.card`, the `ui` sounds except `ui.on`, the `rattle` click, the `pour` grains) is rendered ONCE per context into small mono `AudioBuffer`s: 4 seeded variants of each at its base pitch, all rendered by one `OfflineAudioContext` at the context's sample rate right after unlock (about 20 s of audio in total, rendered in the background in well under a second on a phone) and sliced. An event is then one `AudioBufferSourceNode` (its variant chosen by the event seed, its pitch set by `detune`), one `GainNode` and, when panned, one `StereoPannerNode`. A transient due before the bank is ready is skipped, never synthesised live. The offline render builds the same bank inside its own context first, so a render plays what the page plays. The bank keeps every sound procedural and deterministic, and it keeps H5 (16 events per second at most) at about 50 node creations per second instead of about 500.
- **Continuous sounds** (`pen`, `pour`, `air`, the `clack.rain` patter, the ambient layers, the bed) stay live node graphs; only a handful exist at once.
- **Two gains per voice.** Every voice ends in `env` (its envelope: the speed curve from `setValueCurveAtTime`, the attack and the release, all scheduled once and NEVER touched again) followed by `cut` (1.0; the ONLY gain that pause, cut and release write, with `cancelScheduledValues(now)` then `setTargetAtTime`). Inserting an event into a gain inside a `setValueCurveAtTime` span throws NotSupportedError, and continuous cues are cut, paused and resumed mid-window all the time (Next, Pause, explore).
- **Levels.** "LU re voice" is the sound alone, as its momentary loudness maximum (M, 400 ms window, EBU R128) minus -16 LUFS, the voice's integrated level. Transients shorter than 100 ms are specified by sample peak (dBFS) instead. Gains inside a recipe are relative to that recipe's loudest component.
- **Envelopes.** Times in ms. "tau" is the time constant of `setTargetAtTime` (-60 dB after 6.9 tau). Every live node is stopped 200 ms after its envelope reaches -60 dB and disconnected on `ended`.
- **Pitch.** Equal temperament, A4 = 440 Hz. "Tick pitch", "bell root", "chord" and "answer" come from the chapter row of I.2.2.
- **Cue shapes** (`cueFrom`, I.6.2). A cue's timing is sampled from the Scene's own cue function over its beat: 601 samples of beat t. A SEGMENT is a maximal monotonic run in which the value changes (a pulse gives two: its rise and its fall). For each segment: `a` is the first sample past 2% of its change, `land` the first sample within 2% of its final value (for an overshooting ease such as `snap` that is the first contact, where the eye reads arrival), `half` the 50% crossing, `b` the last sample that changes. A continuous sound's level follows the segment's SPEED: the sampled derivative, normalised to 1 at its peak, resampled to 32 points for `setValueCurveAtTime`, so a stroke that accelerates and settles sounds like it. The `[a, b]` numbers in I.7 are what the sampling found on 2026-09-27; the code never contains them.

#### I.2.2 Chapter keys

| Chapter | Key | Chord (bed) | Answer (the third; enters at the claim) | Bell root | Tick pitch |
|---|---|---|---|---|---|
| Intro | D | D3 146.83, A3 220.00, E4 329.63 | F#4 369.99 at I4 about 0.66 (tile 06 lands) | D5 587.33 | D6 1174.66 |
| 01 Skills | A | A3 220.00, E4 329.63, B4 493.88 | C5 523.25 (minor) at S4 0.66, gone at S5 0; C#5 554.37 at S5 0.80 | A4 440.00 | A6 1760.00 |
| 02 Hopper | E | E3 164.81, B3 246.94, F#4 369.99 | G#4 415.30 at H4 0.62 | E5 659.26 | E6 1318.51 |
| 03 Energy | B minor | B3 246.94, F#4 369.99, C#5 554.37 | D5 587.33 at P4 0.60 | B4 493.88 | B5 987.77 |
| 04 Capacity | D | D3 146.83, A3 220.00, E4 329.63 | F#4 369.99 at D3 0.80 | D5 587.33 | D6 1174.66 |
| 05 Continuum | F# minor | F#3 185.00, C#4 277.18, G#4 415.30 | A4 440.00 at C3 0.90 | F#5 739.99 | F#6 1479.98 |
| 06 Health | G | G3 196.00, D4 293.66, A4 440.00 | B4 493.88 at L5 0.30 | G4 392.00 | G6 1567.98 |

Each chord is suspended (root, fifth, ninth) until the claim adds its third: the chapter asks a question and the claim answers it. The answer is played ONLY by the bed, fading in under the claim's bell (I.2.5); the bell itself strikes an open fifth and never the third. The "at" times are those of each chapter's claim cue (I.7), and the code takes them from that cue. Capacity shares the intro's key because it is the definition the intro promised. The lesson ends back in D (I.2.5).

#### I.2.3 Sounds

Each entry gives meaning and use, recipe, and level. Variants are separate `SfxId`s (I.6.2).

**`pen`: the pen of light draws.** Variants `pen`, `pen.dash`, `pen.bundle`, `pen.slide`, `pen.scan`.
- Meaning: a line is being drawn by the pen head right now. Only for strokes with a pen head that are the beat's construction or data, and only when the stroke lasts 250 ms or more. Never for grids, ticks, fades or rests.
- `pen`: pink noise to a bandpass at 4.8 kHz x (1 + 0.35 v), Q 0.7 (the airy tooth of a felt tip on glass), plus a body: the same noise to a bandpass at 850 Hz, Q 1.4, at -12 dB (so a phone speaker carries it). Grain: the sum's gain is modulated by white noise lowpassed at 30 Hz, depth 25%. Head glow: a sine at the bell root at -24 dB, 0 cents, so the head glows faintly in key. Level curve `0.35 + 0.65 v^0.6`, where v is the segment's speed (I.2.1); attack 25 ms, release 80 ms. Pan: `[from, to]` ramps across the window; `'orbit'` is `0.3 sin(2 pi u)`, clockwise from 12 o'clock.
- `pen.dash`: `pen` gated at 7 Hz, duty 0.6, 4 ms ramps. A dashed chalk line (the specialist, L8) sounds dashed.
- `pen.bundle`: two bands (3.2 kHz and 6.5 kHz, Q 0.5), no glow, fixed pan +/-0.3 on two seeds: many lines drawing at once.
- `pen.slide` (a bead slides along a row toward better): a TEXTURE, not a tone. The `pen` noise is the whole sound: its high band's centre rises from 900 Hz to 1.8 kHz across the window along the eased progress p (`900 x 2^p` Hz, Q 1.2), its body band stays at 850 Hz at -12 dB, and its level follows the speed. Over it, 3 to 5 soft glass grains per window (bank `tick.label` clicks without their sine, at seeded times spread by the speed, -12 dB). No pitched glide and no head glow. Pitch appears only as discrete chord-tone events: the arrival `tick.label` marks the new value (I.7), and a cue may add a departure tick 6 dB under its arrival.
- `pen.scan`: a steady scanner: noise to a bandpass at 3 kHz, Q 2, plus a sine at the bell root at -18 dB, flat level (a time-true sweep).
- Level: M max -26 LU re voice (-42 LUFS); sample peak <= -32 dBFS.

**`tick`: a mark lands.** Variants `tick.dot`, `tick.label`, `tick.claim`, `tick.close`, `tick.steel`, `tick.meet`, `tick.card`. All are bank transients.
- Meaning: a discrete mark has arrived: a dot snaps, a label or callout lands, a shape closes. Annotation, never data.
- The CLICK (shared): white noise, 5 ms, highpassed at 2.5 kHz and bandpassed at 5 kHz (Q 1), tau 3 ms.
- `tick.label`: the click at 0 dB (the contact leads); a sine at the tick pitch, attack 1.5 ms, tau 15 ms, at -6 dB; an inharmonic partial at 2.76 x the tick pitch, tau 10 ms, at -14 dB, so it rings like glass instead of bleeping. Peak -30 dBFS.
- `tick.dot` (H.71, the owner's A/B): by default 'glass', contact-led like every tick: the click at 0 dB, a sine at the bell root x 1.5 at -6 dB (attack 1.5 ms, tau 25 ms), and the x 2.76 partial at -14 dB (tau 12 ms). Peak -22 dBFS (the click sets it; its K-weighted energy matches the old recipe within 0.3 dB). `?tick=round` plays the H.69 recipe: a round, soft "tok", a sine at the bell root x 1.5, tau 40 ms, plus a sine at 2.01 x that pitch at -14 dB, plus the click at -10 dB for contact, peak -28 dBFS. The owner keeps one by ear on the phone. With `ring: 'ripple'` (D0: the dot lands with its Ripple) add three sine grains at the tick pitch x 1, 1.5 and 2, 25 ms apart, at -14 dB; with `ring: 'shimmer'` (D6: a row's light pours in) add 120 ms of `pour` grains at -16 dB.
- `tick.claim`: `tick.label` plus a sine at its fifth (x 1.4983), tau 60 ms, at -8 dB: a callout that states a claim, still small. Peak -27 dBFS.
- `tick.close`: a glint: the click at 0 dB; a sine at the tick pitch (or the cue's pitch), attack 4 ms, tau 90 ms, at -6 dB; the x 2.76 partial, tau 45 ms, at -14 dB. Peak -30 dBFS.
- `tick.steel`: steel rings once: the tick pitch (E6 in the Hopper) with inharmonic partials x 2.76 (-6 dB), x 5.40 (-12 dB) and x 8.93 (-18 dB), tau 180 ms, plus the click at -6 dB. Peak -30 dBFS.
- `tick.meet`: two `tick.close` voices at once, at the tick pitch and its fifth (x 1.4983): two families meeting.
- `tick.card`: a card flies in: white noise 40 ms, bandpass sweeping 2.2 to 3.5 kHz (Q 1.5), attack 8 ms, no sine. Peak -34 dBFS.
- Staggered sets: one event per element at that element's own land (or the cue's `on`); at most 6 audible, or the cue's `max` (2 to 6; H.71) (the first, the last and evenly between); each event 0.6 dB softer than the one before; minimum spacing 45 ms (closer events merge). Pitch: the variant's pitch, or the cue's `pitch` list in semitones.

**`pour`: light fills an amount.** Variants `pour.fill`, `pour.sweep`, `pour.flood`, `pour.drain`, `pour.lift`, `pour.glow`.
- Meaning: an amount of light is filling or leaving a region. The amount of sound follows the amount of light (L9). Only where a pour, sweep, flood, spill, sink or lift is on screen.
- `pour.fill` (H.71: the amount without a sweep-and-crescendo): pink noise to a bandpass (Q 1.1) whose centre follows the amount A: `800 x 2^(0.75 A)` Hz (800 Hz to 1.35 kHz, under one octave). A is the fill fraction L normalised to reach 1 at 60% of the window (`POUR_SETTLE`) and held after it. The noise level is FLAT after the attack. Shimmer: bank grains of 30 ms (attack 2 ms, tau 12 ms) at chord tones x 4 and x 8, at a density that follows A (2 per second up to 12), each at -16 dB, seeded pan within +/-0.3. Tone: a sine at the bell root / 2, 0 cents, plus its octave at -6 dB for phone speakers, whose level rises with A from -40 to -26 dB. The amount lives in the tone and the density, never in a rising level or a wide sweep. From 60% of the window everything holds and the noise and its grains ease down 3 dB, so the last part of a pour (1.4 s in D3) is flat or falling and never builds like a riser into the claim that often follows it (`pour.sweep` does the same). Attack 250 ms, release 900 ms, during which the grains thin to 3 per second (the light settling). M max -22 LU re voice; peak <= -26 dBFS.
- `pour.sweep` (an area sweeps left to right): as `pour.fill`, its grain density 2 up to 6 per second, pan -0.3 to +0.3. M max -26 LU.
- `pour.flood` (an Energy band floods): a fixed centre per engine, drifting +/-15% across the window: phosphagen 2.4 kHz, glycolytic 1.25 kHz, oxidative 620 Hz plus its octave band at -6 dB. No grains (the river layer takes over). M max -24 LU.
- `pour.drain` (a spill, a sink): centre `2.75 kHz x 2^(-2.4 L)` through a lowpass at 1.8 kHz; 10 grains per second, each a bank variant that falls 3 semitones. M max -24 LU.
- `pour.lift` (a surface or a profile lifts): centre `400 x 2^(2 L)` Hz, Q 1.6; 8 grains per second; the tone steps up a fifth at the segment's `half` (a discrete step, never a glide). M max -23 LU.
- `pour.glow` (a region lights without moving): a fixed centre at 900 Hz, Q 0.7, attack 400 ms, no grains. M max -28 LU.

**`clack`: a brick lands** (Hopper). Variants `clack`, `clack.rain`.
- `clack` (bank): white noise 4 ms to a bandpass at 1.35 kHz (Q 5), plus a bandpass at 640 Hz (Q 7) at -8 dB; body: a sine at E3 (164.81 Hz) dropping a fourth over 30 ms (tau 22 ms) at -6 dB, plus its octave (E4) at -10 dB so a phone hears it; overall tau 25 ms. The six bricks of one draw form a ripple, each 0.5 semitone lower. Peak -26 dBFS.
- `clack.rain` (H5: 35 draws, up to about 48 bricks per second on screen): individual bank clacks at -10 dB (a tau 12 ms variant) at `min(rate(t), 10)` per second, pitch jitter +/-3 semitones, seeded pan within +/-0.35. The rate above 10 per second becomes the PATTER: one continuous layer (pink noise to a bandpass at 1.35 kHz, Q 1.2, plus 640 Hz, Q 2, at -6 dB) whose level follows `min(1, (rate(t) - 10) / 26)`: the sound of many, which is what the ear hears above about 12 events per second anyway. M max -30 LU.

**`ball`: a ball drops** (Hopper). Variants `ball.drop`, `ball.cascade`.
- `ball.drop` (bank): a hollow knock: a sine gliding from E4 (329.63 Hz) down to 262 Hz over 60 ms (baked into the buffer), tau 70 ms, with its octave at -8 dB, plus white noise 6 ms to a bandpass at 950 Hz (Q 4) at -6 dB; one bounce 95 ms later at B3 (246.94 Hz), -9 dB. Peak -26 dBFS. The unknown ball (H4) is its own bank entry, 5 semitones lower, tau 110 ms.
- `ball.cascade` (H0): 25 knocks at -12 dB, seeded pitches from the chord tones between B3 and F#4, spread by the segment's speed (about 12 per second). M max -30 LU.

**`flip`: the ticket flips** (Hopper, bank).
- Two white-noise bursts of 14 ms, 45 ms apart, highpassed at 1.8 kHz and bandpassed at 3.2 kHz (Q 0.9), the second at -4 dB; then a `tick.label` at the window's end (the snap flat). Peak -30 dBFS.

**`air`: the view reveals a dimension.** Variants `air.reveal`, `air.swing`, `air.deep`.
- Meaning: the camera moves to reveal depth, age, lanes or a pit (L6, reason 1). Only where I.7 lists it. Never under reduced motion (the camera cuts).
- `air.reveal`: pink noise to a bandpass (Q 1.4) whose centre rises exponentially from 350 Hz to 1.4 kHz over the first 60% of the window and falls to 800 Hz over the rest; level `sin^2` across the window; pan 0.2 x the sign of the camera's azimuth change.
- `air.swing`: the centre makes one slow orbit (700 Hz +/-40%) and the pan orbits +/-0.3 (the Continuum rows swinging into a circle).
- `air.deep`: `air.reveal` in a band from 200 to 700 Hz (the tilt that shows a pit).
- Level: M max -30 LU re voice; peak <= -36 dBFS.

**`resolve`: the claim lands.** Variants `resolve` (rise), `resolve.fall`.
- Meaning: the chapter's signature claim has landed. One per signature beat (A.3), at the cue I.7 gives. Rise for a gain, fall for a loss. It must read as calm confirmation, never as a reward: no third, no arpeggio, no harmonic chime.
- `resolve`: two FM bells, each a carrier sine at f with a modulator sine at 3.5 f (an inharmonic ratio with partials at 1, 2.5, 4.5 and 6 x f: glass, not the odd-harmonic e-piano a 1:2 ratio gives), index starting at 1.2 and falling to 0.15 (tau 300 ms), amplitude attack 6 ms, tau 1.1 s (a tail of about 4 s). Voices: the bell root (0 dB, pan -0.12), then its fifth (x 1.4983, -4 dB, pan +0.12) 75 ms later: an OPEN FIFTH, neutral and calm. Bloom: pink noise lowpassed at 2.2 kHz, attack 300 ms, tau 900 ms, at -20 dB, the breath of the light under the bell. At the bell's first strike the bed's answer note begins its 4 s fade-in (I.2.5): the claim is answered by the room, not by a chime. 0 cents jitter.
- `resolve.fall`: the loss, by register and darkness, never by a bend or a clash. The same two bells an octave below the rise's (the bell root / 2 and its fifth: D4 and A4 in Capacity, A3 and E4 in Skills; on a phone speaker the lowest are heard through their 2.5 f and 4.5 f partials, which is part of the darkness), index 1.0 falling to 0.15, 75 ms apart, amplitude tau 0.6 s (a tail of about 2 s), through a lowpass that closes from 1.6 kHz to 700 Hz over max(0.9 s, the source segment's length), at most 1.5 s. No glide (a bend against the held bed reads as a bell going flat, the "sad trombone" in miniature) and no bloom. Any minor colour comes from the bed (Skills), and the Capacity bed dips its F#4 under the D5 fall.
- Level: rise target M max -14 LU re voice (-30 LUFS), ceiling -12 LU, still the loudest effect in the lesson; fall target -16 LU, ceiling -14 LU; peak <= -18 dBFS.

**`ui`: the viewer's own touch.** `ui.tap`, `ui.step`, `ui.grab`, `ui.on` (bank transients, except `ui.on`, which is synthesised live because it sounds before the bank exists).
- `ui.tap` (chips, toggles, explore buttons, play and pause): a sine at 1.6 kHz, attack 1 ms, tau 9 ms, plus a 2 ms click highpassed at 4 kHz at -10 dB. Peak -34 dBFS.
- `ui.step` (next, prev, swipe, segment tap, transcript tap, intro tile): a sine gliding from 740 to 700 Hz, tau 16 ms, plus the click at -12 dB. Peak -32 dBFS.
- `ui.grab` (an explore drag handle is picked up): `tick.dot` at -6 dB.
- `ui.on` (sound was just turned on; the first sound the lesson ever makes): two `tick.close` glints, the current chapter's bell root and its fifth, struck together as one open dyad (H.70: a rising two-note figure is a notification chime), tau 140 ms. Peak -26 dBFS.
- UI sounds fire immediately on the gesture (no lookahead), on their own bus, never ducked and never scheduled from story time.

#### I.2.4 Ambient life (on the bed bus)

These exist only while the picture moves on the ambient clock A (L5, B.11): in unheld autoplay and in explore. Held, paused and reduced-motion pictures have none.
- **`rattle`** (the Hopper drum): UNPITCHED steel clicks, never a ticking clock. Each grain is a bank click: white noise 3 ms to a bandpass at 2.1, 2.9 or 3.7 kHz (seeded), Q 10; one grain in four (seeded) carries a faint ring (the tick pitch and x 2.76, tau 60 ms) at -24 dB, the rest none. Timing: a seeded Poisson process (exponential gaps, at least 40 ms apart), mean rate 3.5 per second x the layer's `rate(T)` (1 normally; H5 passes `1 + spinBoost`), at most 8 per second and always inside the 16-per-second budget (I.3.6), so H5's spin reads as a real change while the `clack.rain` patter carries the rest of the rush. Gain jitter +/-4 dB, lowpass 5 kHz, pan from the drum's side of the screen (P 0, L -0.3). Alone at the base rate: -44 LUFS, times the layer's `level(T)` (the drum built and visible).
- **`river`** (Energy): one flow layer per engine: pink noise to a bandpass (phosphagen 2.4 kHz, Q 2.5; glycolytic 1.25 kHz, Q 2.2; oxidative 620 Hz, Q 2, plus 1.24 kHz, Q 3, at -6 dB), with a slow amplitude drift (noise lowpassed at 0.3 Hz, depth 30%) and a centre that drifts +/-5% with A. Each layer alone: -44 LUFS, times its `level(T)` (the band's motes are on).

#### I.2.5 The bed (one per chapter)

- **Room** (shared by every chapter: the gym at night): two decorrelated pink noises panned -0.5 and +0.5, highpassed at 150 Hz, lowpassed (two 12 dB per octave stages) at a cutoff that follows the beat, 800 Hz on a chapter's first beat to 2 kHz on its last (H.71), with a level trim that keeps its loudness constant as it opens, and a slow drift (0.021 Hz, +/-1.5 dB). Alone: -40 LUFS. The room never crossfades on a chapter change: it is the same room, which darkens back to the new chapter's first beat over 3 s.
- **Tone** (the chapter chord, I.2.2). Each chord note is:
  - its fundamental, a sine at 0 dB, plus a twin 2 cents sharp at -9 dB: a slow shimmer of about +/-3 dB at 0.2 to 0.6 Hz (0.57 Hz on B4), not a full-depth throb;
  - its 3rd harmonic at -20 dB, so the lowpass below has something to open (in Capacity: 440, 660 and 989 Hz, all in a phone speaker's range);
  - its octave, whose level rises across the chapter from -16 dB on the first beat to -6 dB on the last (H.71; was -14 to -8). A phone speaker plays the octaves and the 3rd harmonics and little of the fundamentals, so this is where a phone hears the room brighten;
  - its own amplitude drift (periods 17, 23 and 29 s; +/-2 dB).
  Notes are panned -0.25, +0.25 and 0, summed and lowpassed (cutoff below).
- **Answer**: the chord's third (I.2.2), built like a chord note, fading in over 4 s from the claim bell's first strike and staying to the chapter's end, at -6 dB re one chord note.
- **Whole bed alone**: -32 LUFS +/- 1.5 over a chapter (ducking off). The octave and 3rd-harmonic layers are in this figure; re-meter after any change to the tone.
- **Evolution across beats**: at each beat start, over 3 s, the tone's lowpass glides to `600 x 2^(1.2 n / (N - 1))` Hz for beat n of N (600 Hz on the first beat, about 1.38 kHz on the last), the room's lowpass to `800 x 2.5^(n / (N - 1))` Hz, and the octave layer to its level for beat n: the room audibly brightens as the argument builds (Capacity: the bed's phone-band centroid rises 42% from D0 to D6 at a constant loudness, H.71). Chapter specifics:
  - Skills: the minor third C5 enters with the S4 fall and fades at S5 0 (over 4 s); the major third C#5 arrives at S5 0.80 (only the generalist has no deep gap).
  - Capacity: the answer dips 6 dB from the D5 fall's first strike (label `lost`, 0.62) and recovers at D6 0 (over 4 s).
  - Continuum: across C6 [0.70, 1.0] the cutoff closes 25% (the pit darkens) and stays.
  - Health: across L4 [0.05, 0.80] the cutoff closes 20% (the surface sinks) and reopens across L5 [0, 0.30]. After the last beat is done, the G chord crossfades over 5 s into the intro's D chord with its answer (D3, A3, F#4) before the bed fades: the lesson ends where it began.
- **Enter and leave**: the bed fades in over 2.5 s when sound turns on or a chapter is loaded. On a chapter change the old tone fades out over 1.2 s and the new tone fades in over 2.5 s from the new chapter's `loaded`. After a chapter's last beat is done, the bed holds 8 s, then fades out over 6 s. Under reduced motion see I.4.
- **The state is a function of the beat.** The bed's state at the start of beat n (answer entered or not, cutoff, octave level, the Skills thirds, the Capacity dip, the Continuum and Health darkening) is computed as if the chapter had played from beat 0, so a deep link, a jump or an offline render of a mid-chapter range starts in the right room (I.6.7).

#### I.3 Mix

#### I.3.1 Graph

```
voice clip -> voice cut -> voice bus (0 dB, highpass 80 Hz) -------------------+
effects    -> env -> cut -> sfx bus (0 dB) -> sfx duck (0 / -3 dB) ------------+
bed, ambient -> env -> cut -> bed bus (0 dB) -> bed duck (0 / -6 dB) -> bed mode gain --+--> pre-master
ui         -> ui bus (0 dB, never ducked) --------------------------------------+
pre-master -> limiter (DynamicsCompressor) -> makeup trim -> ceiling (WaveShaper 4x) -> master fade -> destination
analysers (QA only, I.6.7): one per bus after its duck, one on the master
```

- **Bed mode gain**: story playing 0 dB; explore -4 dB; paused, held or hidden: fades to silence over 1.2 s; done: holds 8 s, then fades over 6 s; reduced motion: I.4.
- **Master fade**: 0 dB while sound is on; turning sound off fades it to silence over 200 ms, then the context suspends. A hidden page ramps it to 0 over 60 ms (I.3.6).
- The same `buildGraph(ctx)` builds the phone's graph and the offline render's graph, so a render measures the real chain. The analysers are created only with `?sound=1` or in a development build.

#### I.3.2 Gain staging

Every bus sits at 0 dB; levels come from the sources, which are designed to these targets.

| Source | Alone | Under the voice |
|---|---|---|
| Voice clip | -16 LUFS integrated, true peak <= -2.0 dBTP (encoded at -2.5, I.6.5) | not ducked |
| Bed (room, tone, answer) | -32 LUFS integrated | -38 (duck -6) |
| Ambient layer (the rattle at its base rate, one river band) | -44 LUFS | -50 |
| `resolve` (the loudest effect) | M max -30 LUFS (-14 LU re voice; ceiling -12 LU) | -33 |
| `resolve.fall` | M max -32 LUFS (-16 LU; ceiling -14 LU) | -35 |
| `pour.fill` | M max -38 LUFS (-22 LU) | -41 |
| `pen`, `pen.slide` | M max -42 LUFS (-26 LU) | -45 |
| `air` | M max -46 LUFS (-30 LU) | -49 |
| Transients (`tick`, `clack`, `ball`, `flip`) | peak -26 to -34 dBFS | 3 dB lower |
| `ui` | peak -26 to -34 dBFS | not ducked |

#### I.3.3 Ducking

- Ducking is SCHEDULED, not detected: each clip's speech spans come from the manifest (`speech`, I.6.5), so the phone and the offline render duck identically and the duck can lead the voice.
- For each span the ducks start 100 ms BEFORE the first syllable (the voice lands in a clear space) with a 120 ms ramp (`setTargetAtTime`, tau 40 ms), hold through gaps of 0.8 s or less, and release 700 ms after the span ends (tau 600 ms, `DUCK_RELEASE_TAU`; H.71, was 230 ms: over a long gap the room rises back instead of swelling). The merge threshold MUST be at least the release delay plus the lead (0.7 + 0.1 s): for a shorter gap the release would be scheduled after the next duck-down and win, leaving the bed and the effects unducked for the rest of the clip (H.70). 0.8 s is also the I.6.5 gap gate, so a clip that passes the gate never releases mid-line. `DUCK_LEAD`, `DUCK_RELEASE` and `DUCK_MERGE` in `director.ts` hold these numbers.
- **The bridge across beats** (H.71). When autoplay carries on into a narrated beat, the release after a clip's last span is skipped if the next beat's planned first duck-down (this beat's planned total, the next beat's LEAD and its first speech span, all known from the plan) follows it within `DUCK_BRIDGE` 1.5 s: the release moves to that duck-down plus `BRIDGE_SAFETY` 2.0 s, the next clip's schedule replaces it, and if no clip follows it still releases. So the bed does not pop up for a fraction of a second at every sentence change; between the first and the last syllable of a chapter no un-duck window is shorter than 0.8 s. A clip's natural end never releases the ducks (its schedule does), and neither does an autoplay beat start; the phone and the offline render share `duckSchedule`.
- Depth: bed -6 dB, effects -3 dB, ui 0 dB.
- When the voice pauses or is cut, both ducks release at once (tau 120 ms).

#### I.3.4 Limiter and ceiling

- The limiter only catches SUMS: the voice alone never reaches it, because every clip is encoded to true peak <= -2.0 dBTP (I.6.5).
- `DynamicsCompressorNode`: threshold -2.0 dBFS, knee 0, ratio 20, attack 0.001 s, release 0.12 s.
- The node applies automatic makeup gain (Web Audio: `(1 / fullRangeGain)^0.6`). A trim right after it cancels it; the director computes the trim from the settings at init, so the chain has unity gain below the threshold whatever the settings.
- `WaveShaperNode` ceiling, `oversample = '4x'`, a 4097-point curve: linear up to 0.794 (-2.0 dBFS); above it `0.794 + 0.077 tanh((|x| - 0.794) / 0.077)` with the sign kept, a soft ceiling at 0.871 (-1.2 dBFS) that catches the inter-sample overs the compressor lets through.
- Expected: no gain reduction on voice-only passages and in speech gaps; at most 1.5 dB when a resolve or a pour lands under a voice peak; true peak around -1.8 dBTP, never above -1.0 dBTP.

#### I.3.5 Meter targets

Measured with `ffmpeg -hide_banner -i render.wav -af ebur128=peak=true -f null -` on `__story.renderAudio` output (I.6.7).

| Render | Integrated | True peak | Also |
|---|---|---|---|
| Full mix, a whole chapter | -16.0 LUFS +/- 1.0 | <= -1.0 dBTP | LRA <= 8 LU |
| Voice stem | -16.0 LUFS +/- 0.7 | <= -2.0 dBTP | |
| Bed stem, ducking on | -35.5 LUFS +/- 2 | | short-term loudness 5 to 7 LU lower inside speech spans than in the gaps |
| Bed stem, ducking off | -32 LUFS +/- 1.5 | | first and last beat within 3 LU of each other (it brightens, it does not swell) |
| Effects stem | not meaningful | sample peak <= -18 dBFS | momentary max <= -27 LUFS (a resolve plus anything landing with it; 11 LU or more under the voice); a resolve alone -30 +/- 1 |
| Any render | | | `levels.limiterMin` never below -1.5 dB; 0 dB across any voice-only stretch |

#### I.3.6 Device

- `new AudioContext({ latencyHint: 'interactive' })` at the device's sample rate. Offline renders use 48 kHz stereo.
- **Audio session.** When `'audioSession' in navigator` (Safari 16.4 and later), `navigator.audioSession.type = 'playback'` is set immediately before the context is created or resumed inside a gesture. Tradeoff: narration the viewer turned on plays even with the iPhone ring / silent switch on (most iPhones live on silent, and 'ambient' would drop the voice without a trace, which the owner must never hear), but 'playback' does not mix: it pauses the viewer's music or podcast while sound is on. So the type goes back to `'auto'` whenever sound is turned off or the context idle-suspends (12 s with nothing audible), which lets their music resume.
- **Latency.** Effects are scheduled early by `ctx.outputLatency` (or `baseLatency`), clamped to 0 to 0.25 s, so a tick is heard as its dot is seen, including over Bluetooth. The voice is not advanced (the caption carries it).
- **Hidden page.** A hidden page may never run another frame or timer (iOS freezes background JavaScript; rAF stops in every browser), and an `AudioBufferSourceNode` keeps advancing until the context is really suspended. So hiding is handled INSIDE the `visibilitychange` (to hidden) and `pagehide` handlers, in the same task: (1) read the voice position from the audio clock (`ctx.currentTime - startCtx + startOffset`) and record it as the resume offset; (2) ramp the voice `cut` and the master to 0 over 60 ms and call `source.stop(ctx.currentTime + 0.07)`; (3) cancel every scheduled cue; (4) call `ctx.suspend()` without awaiting it. Nothing can keep sounding on the lock screen, and nothing is lost if the suspend runs late or never. On `visibilitychange` to visible (or `pageshow`), the context resumes inside the handler, the master fades in over 150 ms and a new source starts at the recorded offset, so at most the 60 ms fade is heard twice and no word is lost. If the device refuses to resume, the story pauses and the toggle shows Waiting (I.5.2).
- **Narration fetch and decode.** Nothing is fetched before the gesture. Inside `enable()` the current and next beats' clips are fetched at once (the fetches start in the gesture's task); the rest of the chapter and the next chapter's first two clips follow at idle. A response counts only if `res.ok` and its `content-type` starts with `audio/` (the site's SPA fallback answers a missing MP3 with index.html and a 200). The DECODED window is the beats [n-1, n+2] (Prev is common); encoded bytes are kept for the current and next chapter. Every decode is `ctx.decodeAudioData(bytes.slice(0))`, because decodeAudioData detaches the ArrayBuffer it is given (Chrome and WebKit) and a clip that left the window is decoded again from the kept bytes. A fetch or decode failure disarms that beat at once (it runs silent, one console warning); only a clip still in flight waits (`WAIT_MAX`, I.6.4).
- **Budgets.** At most 24 effect voices at once, ambient grains included (the oldest releases with a 20 ms fade). At most 16 transient events in any second across effects and ambient (a seeded token bucket, 16 per second, burst 4; ambient grains yield first, then the quietest staggered-set members). Each event creates at most three nodes (I.2.1, the bank); the per-frame cue lookahead reuses its arrays and allocates nothing.

#### I.4 Behaviour

Words used below:
- **Cut**: the voice's `cut` gain ramps to 0 over 80 ms and its source stops; the clip is disarmed and re-arms from its start when narration may play again.
- **Pause**: record the position from the audio clock at the START of the fade, ramp the voice `cut` to 0 over 60 ms and stop the source. **Resume** starts a new source at the recorded position with a 30 ms fade-in (an `AudioBufferSourceNode` cannot pause: a paused clip is a stopped source plus an offset). At most the 60 ms fade is heard again; no word is lost.
- **Arm**: the beat's clip will play from its start after the lead-in (I.6.4).

**What pauses the voice, exactly.** Only: (a) `store.pause()` (the play button, a stage tap, Space), through its one-line `// [audio]` hook; (b) a hold that lasts `SHORT_HOLD` 0.4 s (`interacting > 0`: a finger down, a scrub, a detent drag, the sheet open); (c) the stage under 10% visible; (d) a hidden tab or page (I.3.6); (e) an audio interruption. The engine's own `playing: false` at the end of a Show build, on the last beat, in reduced-motion and held steps, and on a held seek is NEVER read as a pause: the director never infers a pause from `playing`. The voice resumes when `play()` runs after (a), or when (b) to (e) clear while `playing` is true.

Rows other than the first-visit and returning-visitor rows apply only while sound is on.

| Event | Voice | Effects | Bed | Timing |
|---|---|---|---|---|
| First visit (no stored choice) | none; no AudioContext exists | none | none | today's; the Sound on chip shows 1.2 s after the chapter is loaded |
| Sound turned on (chip, toggle or M) | `ui.on`, then the current beat's clip from its start `LEAD_TOGGLE` 0.35 s later; its fetch started inside the gesture, and this first arm waits up to `WAIT_FIRST` 5 s for it | cues after the current t fire; a continuous cue already inside its window starts at its current point | fades in over 2.5 s | the hold now also waits for the clip (I.6.4); stores '1' |
| Sound turned off mid-beat | cut | cut (20 ms) | fades out over 300 ms; the context suspends; session 'auto' | the hold reverts to `holdFor`; if that has already passed, the beat advances 0.6 s later, never at once; stores '0' |
| Returning visitor, stored '1' | nothing until the first gesture, then the current beat's clip from its start | from the first gesture | fades in at the first gesture | the chip shows until then; any `pointerup`, `touchend`, `click` or `keydown` in the lesson unlocks, EXCEPT on a `[data-sound-control]` element and the M key, which run their own control (I.6.3) |
| Returning visitor, stored '0' | none | none | none | today's; no chip |
| Autoplay beat start | arm; plays after `LEAD` 0.20 s (a chapter's beat 0: `LEAD_FIRST` 0.35 s from `loaded`) | cues fire at their plan times | evolves (I.2.5) | the beat lasts max(today, lead + clip + breath) |
| Pause (a) | pause | in-flight one-shots finish (400 ms at most); continuous ones cut through their `cut` gain; nothing new | fades out over 1.2 s; the context idle-suspends after 12 s (idle: sound stays on, the toggle shows On, Resume continues the clip where it paused; H.70) | frozen, as today |
| Press and hold, open sheet, detent drag (b) | continues through holds shorter than 0.4 s (its accounting follows the audio clock, I.6.4), then pauses | as Pause after 0.4 s | as Pause after 0.4 s | as today |
| Resume | a paused clip continues from its recorded position (30 ms fade-in); a cut clip re-arms | continuous cues inside their window restart from the current point | fades in over 0.8 s | as today |
| Next (button, swipe, key) | cut; the next beat's clip arms when it starts | cut; `ui.step`; no cues during the 350 ms glide | continues | as today |
| Prev | cut; the landed beat's clip arms (it is inside the decoded window [n-1, n+2]) | cut; `ui.step`; no cues during the 450 ms glide | continues | as today |
| Segment tap (jump) | cut; the tapped beat's clip arms | `ui.step` | continues | as today |
| Seek (URL, QA, transcript, the scrubber: every `markSeek()`, even to the same T) | cut; nothing plays while held | none while held | fades out (held is paused) | as today; `play()` arms the clip from its start |
| Scrub (segment drag) | cut | none, except `tick.label` at -8 dB at each beat-boundary crossing, at least 80 ms apart | fades out (the story is paused on release) | as today |
| Deep link `?beat=N&t=X` | none until play or a step | none | none | unchanged seek contract |
| Explore on | cut (200 ms) | in-flight finish; then only `useSfx` (I.6.6) | -4 dB; fades out after 45 s without interaction, back over 1.5 s at the next | as today |
| Explore off (Back to story) | the story is paused; on play a cut clip re-arms, a finished clip does not replay | `ui.tap` | as Pause | as today |
| Chapter change | cut (150 ms); the new chapter's beat 0 clip arms at its `loaded` (`LEAD_FIRST`) | cut (60 ms) | old tone out over 1.2 s, new tone in over 2.5 s from `loaded`; the room continues | as today |
| Tab or page hidden (d) | paused inside the handler: position from the audio clock, 60 ms ramp, source stopped, then suspend (I.3.6) | scheduled cues cancelled; in-flight ones silenced by the master ramp | silenced by the master ramp | the story pauses, as today |
| Tab visible again | the context resumes in the handler; a new source at the recorded position (150 ms fade-in); if the device refuses (iOS 'interrupted'), the story pauses and the toggle shows Waiting | cues re-plan from the current t | fades in over 0.8 s | as today |
| Stage under 10% visible (c) | as Pause | as Pause | as Pause | the story pauses, as today |
| Audio interrupted (a call, Siri, another app) (e) | the director pauses the story and the toggle shows Waiting; the next gesture resumes both | frozen | frozen | paused |
| Reduced motion | a user step or Show build plays that beat's clip once, to its end (a Show build ends with `playing: false`; that is not a pause); nothing narrates at load (no autoplay) | cues fire only during Show build; never `air` | plays while a clip or a Show build is running, then behaves like 'done' (holds 8 s, fades over 6 s); returns with the next step or Show build | as today; reduced motion never disables sound |
| Last beat (armed) | plays to its end: the beat stays in 'hold' until the voice has ended plus the breath, and only then turns 'done' | a resolve tails out | holds 8 s after 'done', fades over 6 s (after Health, the cadence to D first) | the ring, Replay and the CTA row wait for the voice; sound off: as today (the last beat turns 'done' at its build end) |
| Replay chapter | arm beat 0 (`startBeat(0)`: delay 0.15 s, `LEAD`) | normal | fades in | as today |
| A clip missing or failing | a failed fetch (not ok, not audio) or decode: the beat runs silent at once; still loading at `WAIT_MAX` 2 s after its lead (`WAIT_FIRST` 5 s on the first arm after Sound on): silent from then (one console warning either way) | normal | normal | today's hold for that beat |

#### I.5 UI

Two controls: a chip on the caption card that asks once, and a toggle in the top bar that always holds the state. Both are 44 px targets with the 2 px #91C640 focus ring (offset 2 px), and both carry `data-sound-control` (the unlock listener leaves their events to them, I.6.3).

#### I.5.1 The Sound on chip

- **When it shows**: story mode; `fitness-sound` is not '0'; audio is not running (a first visit, or a returning '1' before its first gesture); the chapter has been loaded for 1.2 s; no sheet is open. It hides in explore, on the finished last beat of a landscape card (the CTA row takes its place), and as soon as sound runs. Once audio has run on the page (after any first gesture, not only the chip) it retires for the page, and the director's idle suspend never brings it back (H.70).
- **Content**: a 16 px speaker-with-waves icon (stroke 1.8, #91C640), 5 px gap, then "SOUND ON" (the action) in `ui` type at 12 px on phones and 13 px on desktop (Barlow Condensed 600, uppercase, tracking 0.06em, `--st-chalk`).
- **Pill**: 30 px tall (36 px in landscape), padding 0 11px 0 10px, radius 999, `--st-glass` with the card's `backdrop-filter`, a 1 px border of rgba(145,198,64,0.55), shadow `0 6px 18px rgba(0,0,0,0.35)`. Measured label widths: 48 px at 12 px and 54 px at 13 px, so with the icon, gap, padding and border the pill is 92 px wide on phones and 98 px on desktop. A `::before` extends the hit area to 44 px tall.
- **Phone portrait (360, 390, 430) and tablet**: `position: absolute` in `.st-card`, `top: -15px; right: 8px`. It straddles the card's top edge like a tab: half on the glass, half over the stage. Its hit area runs from 23 px above the card edge to 21 px below it, where the scrubber band starts (measured: the band begins 21 px below the edge). It clears the centred 128 px grab band by 6 px at 360, 21 px at 390 and 41 px at 430 (from the measured card and grab rects). It covers at most 7 px of the focus rect (which ends 8 px above the card), so the camera never refits for it, and it registers `useObstacle('sound-chip', ...)` so no label is placed under it.
- **Landscape phone**: the card is a full-height column that starts at the stage top, so the chip is a row inside the card after the Transport: right-aligned, `margin-top: 8px`. The card has room for it (measured: about 74 px free under the transport at 844 x 390).
- **Desktop (1024 and wider)**: as on the phone, `top: -15px; right: 12px` on the 400 px card, at 13 px type. It sits over the scrim, outside the focus rect (which starts at x 500).
- **Motion**: enters with opacity 0 to 1 and y +4 px to 0 over 220 ms (`settle`), then one attention ring per page (a box-shadow of rgba(145,198,64,0.35) growing to 6 px and back over 1.6 s). Reduced motion: no slide, no ring.
- **On tap**: the chip's own click handler calls `enable('chip')` synchronously. The pill fills #91C640 with `--st-ink` text, and the icon's waves draw once (300 ms). It holds 900 ms, then fades out (160 ms, `exit`) while the top-bar toggle rings once (600 ms), showing where the control lives from now on.
- **Retiring without a tap**: after the viewer has moved on 3 beats with the chip showing, it fades out for the rest of the session and the toggle rings once. It returns next session while the choice is still undecided. Ignoring it is not a choice: nothing is stored.
- **a11y**: `<button type="button" data-sound-control aria-label="Turn on sound: narration and sound effects">`. On success a visually hidden `role="status"` in the toggle announces "Sound on".

#### I.5.2 The top-bar toggle

- **Placement**: in `.st-topbar-right`, immediately before `.st-theme`, only while a story chapter is mounted (H.71), in the same box as the theme toggle: a 44 x 44 hit area around a 32 x 32 square (inset 6 px, radius 8, `--panel-bg`, 1 px `--panel-border`), with a 16 px icon at stroke 1.8.
- **Phone widths.** Measured: the bar has 125 px free at 360 px (the wordmark is hidden) but only about 40 px from 375 to 429 px. The CAPACITY chip measures 125 px, so the widest chip ("THE HOPPER") is about 140 px. So, only while the toggle is present:
  - under 390 px: the wordmark hides (today it hides under 375 px), and the toggle and the theme box sit with no gap between their 44 px boxes (their visible squares stay 12 px apart);
  - 390 to 411 px: the wordmark drops to Anton 14 px (about 95 px) with the same zero gap: 10 + 131 + 6 + 140 + 6 + 88 + 6 = 387 px of 390;
  - 412 px and wider: as today (wordmark 16 px, gap 8 px).
- **Landscape phone** (the 44 px bar): as the phone rules; there is ample room.
- **Desktop**: between WOD Intel and the theme toggle (gap 12 px, as today). The key hint under the card becomes "Left / Right to step - Space to play - E to explore - M for sound".
- **States**:
  - Off: a speaker with a small x, `--text-tertiary`, hover #91C640 (as ThemeToggle); `aria-pressed="false"`; title "Turn sound on (M)".
  - On: a speaker with two waves, #91C640 in the dark theme and #019644 in the light theme; `aria-pressed="true"`; title "Turn sound off (M)".
  - Waiting (on, but the browser has not unlocked audio, or the device interrupted it): the on icon at 55% opacity plus a 5 px dot at the square's top-right (#91C640; #019644 in the light theme, as the icon, H.71); `aria-pressed="true"`, described by a hidden "Tap to start sound". A tap here STARTS sound (the toggle's own handler calls `enable('toggle')`; the unlock listener ignores this element, so the tap is never counted twice), and '1' stays stored; the next tap, once sound runs, turns it off. `M` in Waiting also starts sound. The director's own idle suspend (nothing audible for 12 s, I.3.6) is NOT Waiting: the toggle shows On, and a tap or `M` turns sound off (H.70).
- `aria-label="Sound"` never changes (the pressed state says on or off). The `M` key toggles it on desktop, with the same guards as the other keys (not in inputs, not with the sheet open).
- Nothing animates in the bar while the voice plays: the chrome stays quiet.

#### I.6 Engine API

#### I.6.1 Files

New engine code lives under `src/fitness/story/audio/`:

```
story/audio/
  hooks.ts          narr and audioHooks: the ONLY audio module engine files import; it imports nothing (I.6.3)
  types.ts          SfxId, UiId, CueSource, CueShape, SfxCue, AmbientLayer, ChapterSound, AudioQA
  director.ts       the AudioDirector singleton: prefs, unlock, context, voice, cue scheduling, bed, QA; installs audioHooks
  graph.ts          buildGraph(ctx: BaseAudioContext): buses, ducks, limiter, trim, ceiling, QA analysers (I.3)
  bank.ts           the transient bank (I.2.1): every short recipe rendered once per context
  palette.ts        one function per SfxId / UiId: continuous recipes build live nodes (env + cut), transients trigger bank buffers
  cueFrom.ts        cueFrom(): samples a Scene cue function into segments (I.2.1, I.6.2)
  bed.ts            BEDS, the chapter table (I.2.2, I.2.5); startBed(), evolveBed(), bedStateAt(beat)
  ambient.ts        the rattle and river layers (I.2.4)
  plan.ts           planBeat(), planRange(): the deterministic beat plan the phone and the offline render share (I.6.4)
  narration.ts      clip lookup, fetch (res.ok + audio content-type), decode window [n-1, n+2] with bytes.slice(0), prefetch
  narration.gen.ts  GENERATED by scripts/narration-manifest.mjs; never edited by hand
  noise.ts          the seeded white and pink buffers
  prefs.ts          localStorage 'fitness-sound' and ?sound (every access in try / catch)
  render.ts         renderAudio(): OfflineAudioContext, 16-bit WAV encoder, base64
  useSfx.ts         the explore hook (I.6.6)
  SoundChip.tsx     I.5.1
  SoundToggle.tsx   I.5.2
  icons.tsx         the speaker glyphs
  audio.css         the chip and toggle styles (imported by those two components)
src/fitness/stories/<view>/sound.ts   the chapter's cues and ambient layers (I.6.2); one per chapter, discovered, never registered by hand
public/narration/<view>/<beat>-<hash>.mp3   one clip per beat (I.6.5)
scripts/narration-manifest.mjs, scripts/narration-check.mjs, scripts/narration-spoken.json
```

`story/audio/**` and `stories/*/sound.ts` are added to the C.15 grep gate for `Math.random` (noise and jitter come from `rng.ts`, so renders repeat exactly).

#### I.6.2 Types, cue sources and `sound.ts`

Cues live in each chapter's own `stories/<view>/sound.ts`, never in `story.ts`: six chapters are being built in parallel worktrees, and a cue list inside every `story.ts` would conflict on every merge (and its `id:` fields would confuse any caption reader). A cue never contains a window number. It names its SOURCE, the Scene's own cue function or label, and `cueFrom` samples it (I.2.1), so a retimed animation carries its sound with it and the only edit inside a chapter's existing files is adding `export` (plus, where a window is an inline lambda, hoisting it to a named module-level export with the same numbers; I.7 lists each one).

```ts
// story/audio/types.ts
import type { Layout } from '../types'
import type { ChartFrame } from '../kit/chartFrame'

export type SfxId =
  | 'pen' | 'pen.dash' | 'pen.bundle' | 'pen.slide' | 'pen.scan'
  | 'tick.dot' | 'tick.label' | 'tick.claim' | 'tick.close' | 'tick.steel' | 'tick.meet' | 'tick.card'
  | 'pour.fill' | 'pour.sweep' | 'pour.flood' | 'pour.drain' | 'pour.lift' | 'pour.glow'
  | 'clack' | 'clack.rain' | 'ball.drop' | 'ball.cascade' | 'flip'
  | 'air.reveal' | 'air.swing' | 'air.deep'
  | 'resolve' | 'resolve.fall'
export type UiId = 'ui.tap' | 'ui.step' | 'ui.grab' | 'ui.on'

/** Where a cue's timing comes from. Sampled over the cue's beat by cueFrom (I.2.1). */
export type CueSource =
  /** an exported cue function of the chapter's Scene or timeline; sound.ts may compose exported
   *  functions (a mean, a max, a fixed index) but never retypes a number */
  | { fn: (T: number) => number; seg?: number | 'all' }
  /** a staggered set: element i's own cue function, one event (or one span) per element */
  | { each: (T: number, i: number) => number; n: number; seg?: number | 'all' }
  /** a label the chapter registers with useLabels: its spec.cue, read from the label registry.
   *  A list names layout variants; the first id registered in the current layout is used. */
  | { label: string | readonly string[]; seg?: number | 'all' }
  /** the beat's camera move: Beat.cam.window (default [0, 0.35]) with the camera's ease */
  | { cam: true }
  /** the beat's impact window (Beat.impact) */
  | { impact: true }
  /** data-driven instants in beat t (a schedule, a computed crossing), evaluated when the beat is planned */
  | { times: (layout: Layout, frame: ChartFrame | null) => readonly number[] }
  /** data-driven windows in beat t (the Hopper's flips, the Continuum beads) */
  | { spans: (layout: Layout, frame: ChartFrame | null) => readonly (readonly [number, number])[] }

/** One sampled segment, in beat t. */
export interface CueShape {
  a: number
  land: number
  half: number
  b: number
  /** |d value / dt| over [a, b], 32 points, peak 1 */
  speed: Float32Array
}

/** One sound cue of a beat. */
export interface SfxCue {
  /** names the visual it serves ("axes", "400m dot"); unique in the beat. Not called `id` on purpose. */
  name: string
  sound: SfxId
  from: CueSource
  /** one-shots: where in each segment they fire (default 'start'). Continuous sounds span the segment. */
  on?: 'start' | 'land' | 'half' | 'end' | number
  /** events per second at beat t (clack.rain, ball.cascade) */
  rate?: (t: number) => number
  /** dB from the palette level, clamped to [-12, +3] */
  gain?: number
  /** -1..1, clamped to +/-0.35; [from, to] ramps across the segment; 'orbit' circles once clockwise from 12 o'clock */
  pan?: number | readonly [number, number] | 'orbit'
  /** semitones from the palette pitch; a list gives one per event */
  pitch?: number | readonly number[]
  /** tick.dot only: the D0 ripple grains or the D6 pour shimmer (I.2.3) */
  ring?: 'ripple' | 'shimmer'
  /** a staggered set: at most this many audible events (2 to 6, default 6; H.71) */
  max?: number
}

/** Ambient life tied to the scene's own ambient motion (B.11). */
export interface AmbientLayer {
  kind: 'rattle' | 'river.phos' | 'river.gly' | 'river.oxi'
  /** 0..1, a pure function of T: the moving thing is built and visible */
  level: (T: number) => number
  /** speed multiplier of the ambient motion at T (default 1); H5 passes 1 + spinBoost(T) */
  rate?: (T: number) => number
  /** stereo position; a function when it depends on the layout (the drum sits left on L) */
  pan?: number | ((layout: Layout) => number)
}

/** The default export of stories/<view>/sound.ts. */
export interface ChapterSound {
  /** keyed by Beat.id, so a reordered or inserted beat never inherits another beat's cues */
  cues: Readonly<Record<string, readonly SfxCue[]>>
  ambient?: readonly AmbientLayer[]
}

/** what window.__story.audio() returns: the fields listed in I.6.7 */
export interface AudioQA { /* enabled, unlocked, contextState, session, playing, clip, position, beatHold, levels, voices */ }
```

```ts
// story/audio/cueFrom.ts
/** Sample fn over beat `beat` (601 points of beat t) into its moving segments (I.2.1). Pure; no allocation after the first call per source. */
export function cueFrom(fn: (T: number) => number, beat: number): readonly CueShape[]
```

- **Discovery.** `director.ts` finds chapters' sound modules with `import.meta.glob<{ default: ChapterSound }>('../../stories/*/sound.ts')`, the same pattern as the H.38 chapter registry. Each is its own small lazy chunk that shares the chapter's Scene module. The director loads the current chapter's module when sound is enabled (and `renderAudio` loads it on demand). A beat planned before its module arrives narrates without cues.
- **Sampling.** Shapes are sampled when a beat is planned, IN STORY MODE, because cue functions may read the store (the Hopper's `isExplore()` makes every draw function 1 in explore). They are cached per chapter, layout and chart frame id, and nothing is planned in explore (nothing narrates there). `renderAudio` called in explore before any plan exists rejects with "render from story mode".
- **Labels.** A `label` source reads the label registry (`labels/registry.ts`, `registry.get(id).spec.cue`). Every chapter mounts all its labels at load (H.26), so they exist before the first plan. An id that is not registered in the current layout falls to the next id in the list; none registered skips the cue with one warning.
- **A chapter without `sound.ts`** still narrates (when its clips exist) and has its bed; nothing else changes. The bed table is engine-owned (`bed.ts`, keyed by view): chapters never declare keys or chords.
- `story/types.ts` does NOT change.

#### I.6.3 The director and its hooks

```ts
// story/audio/hooks.ts: imports NOTHING. Engine files import only this module, so
// store.ts -> playback.ts -> hooks.ts never reaches the director, and the director
// (which imports the store) can never hit the TDZ through a module cycle.
export const narr = {
  /** this beat's clip will play, or is playing */
  armed: false,
  /** seconds since arming: frame dt during the lead-in, the breath and waiting; the AUDIO CLOCK while the clip sounds */
  elapsed: 0,
  lead: 0.2,
  /** lead + clip.dur + BREATH */
  span: 0,
  /** beat time (s) at which the clip was armed: 0 at a beat start */
  armedAt: 0,
  /** the clip's source is playing now */
  sounding: false,
  /** wall seconds spent waiting for an undecoded clip at the lead */
  waiting: 0,
}

export const audioHooks = {
  /** playback.startBeat(n) ran; delay is pb.delay (0.15 s, or 0 under reduced motion) */
  beatStart(_n: number, _delay: number): void {},
  /** autoplay advanced beat n from t0 to t1 in its build: the ONLY path that fires story cues */
  advance(_n: number, _t0: number, _t1: number): void {},
  /** the hold may end (always true with sound off) */
  holdClear(): boolean { return true },
  /** the last beat must wait in 'hold' for its voice (false with sound off) */
  holdsLast(): boolean { return false },
  /** store.pause(): the viewer paused */
  userPause(): void {},
  /** ready.markSeek(): every seek, the scrubber and deep links included, even to the same T */
  seek(): void {},
}
```

```ts
// story/audio/director.ts
export type AudioState = 'none' | 'suspended' | 'running' | 'closed' | 'interrupted'

export interface AudioDirector {
  /** the viewer's choice, or ?sound=1. Enabled is not audible: see unlocked. */
  readonly enabled: boolean
  /** an AudioContext exists and has run after a gesture */
  readonly unlocked: boolean
  /**
   * MUST run synchronously inside a user gesture handler (source 'qa' excepted): sets the audio
   * session, creates or resumes the context, plays ui.on (synthesised live: the bank does not exist
   * yet), starts the current and next clips' fetches, starts rendering the bank, starts the bed,
   * arms the current beat (WAIT_FIRST), stores '1' (not for 'qa').
   */
  enable(source: 'chip' | 'toggle' | 'key' | 'gesture' | 'qa'): void
  /** cuts everything, fades the master, suspends the context, session 'auto', stores '0' */
  disable(): void
  /**
   * StoryProvider's layout effect (def) and its cleanup (null). The FIRST call subscribes to the
   * store, adds the document listeners, registers the onFrame worker and installs audioHooks.
   * Nothing in director.ts touches useStoryStore at module scope.
   */
  setChapter(def: StoryDef | null): void
  /** a UI sound now; no-op unless audible */
  ui(id: UiId): void
  qa(): AudioQA
}
export const audio: AudioDirector
```

- **Lazy wiring.** Until the first `setChapter()`, `audioHooks` keeps its defaults, which are exactly today's behaviour. The first call subscribes (`useStoryStore.subscribe`) to playing, mode, view, loaded, visible, reduced, index, interacting, showBuild and phase, and adds `visibilitychange`, `pagehide` and `pageshow` listeners.
- **Cuts are explicit.** `beatStart` (a new beat), `seek` (every `markSeek()`), `mode` becoming explore, a chapter change, a reduced-motion index change, and a glide starting (`pb.glide` non-null; director.ts may import `playback.ts`, which imports only `hooks.ts`). Safety net: a frame in which `clock.T` moved without `advance()`, `beatStart()` or a glide is treated as a seek.
- **Pauses are explicit** (I.4): `userPause`, a hold lasting `SHORT_HOLD` (wall time of `interacting > 0`, measured in the frame worker), `visible` false, the hidden-page handlers (I.3.6) and interruptions. `playing` going false is never read as a pause; `playing` going true resumes a paused voice or arms a cut one.
- **Reduced motion.** A step cuts to t = 1 without `startBeat` (C.13); the director sees the index change and plays the landed beat's clip once (it never advances the story). Show build goes through `startBeat` and behaves like autoplay for that one beat; its `playing: false` at the end does not stop the clip.
- **Beat 0.** StoryProvider's mount never calls `startBeat(0)` (it sets `pb.delay = 0` and phase 'build' directly), so the director arms beat 0 itself when `loaded` turns true, with `LEAD_FIRST` and delay 0, unless the story is held, reduced or in explore. Replay's `startBeat(0)` arms like any beat (delay 0.15 s, `LEAD`).
- **Unlock.** While `enabled` and the context is not 'running': one capture-phase listener set on the lesson root for `pointerup`, `touchend`, `click` and `keydown`. It IGNORES events whose target is inside `[data-sound-control]` (the chip and the toggle) and `keydown` of m / M: those controls call `enable()` themselves, so the first tap on a Waiting toggle starts sound instead of the unlock turning it on and the toggle's own click then turning it off. Every other qualifying event calls `enable('gesture')`. The listener stays attached until `ctx.state === 'running'` (checked when `resume()` settles), then removes itself; it is never one-shot.
- **`?sound=1`** enables sound for this page load without storing anything and creates the context at load (QA only; headless Chromium reaches 'running' only with `--autoplay-policy=no-user-gesture-required`). **`?sound=0`** forces sound off for the page, hides the chip and stores nothing.
- **The frame worker.** The director's per-frame work (the audio-clock write of `narr.elapsed`, the lead-in start, waiting, the hold timer, the cue lookahead) runs from `onFrame` inside its OWN try / catch, which logs at most once per 5 s and carries on: `emitFrame` removes a listener that throws, and one exception must not end cue scheduling for the session.
- **Scheduling.** Each beat's cues come from `planBeat()`. In the realtime path, `advance()` schedules every cue whose time falls within the next 120 ms plus the output latency, at `ctx.currentTime + (tCue - t1) x build - latency`; a cue already scheduled but not yet started is cancelled if the story stops before it.

#### I.6.4 Narration drives the hold

Constants (`plan.ts`):

| Name | Value | Meaning |
|---|---|---|
| `LEAD` | 0.20 s | the clip starts this long after the beat starts (the caption swaps at t = 0; the first syllable follows at about 0.32 s) |
| `LEAD_FIRST` | 0.35 s | a chapter's beat 0, from `loaded` (after the slate) |
| `LEAD_TOGGLE` | 0.35 s | after `ui.on`, when sound is turned on mid-beat |
| `BREATH` | 0.65 s | after the clip file ends; with its 0.12 s tail, about 0.77 s after the last syllable |
| `WAIT_MAX` | 2.0 s | wall time the lead waits for a clip still in flight, then the beat runs silent |
| `WAIT_FIRST` | 5.0 s | the same for the first arm after `enable()` (its fetch started cold in the gesture) |
| `SHORT_HOLD` | 0.4 s | touch holds shorter than this do not pause the voice |

The rules:
- **Arming.** `startBeat(n)` calls `audioHooks.beatStart(n, pb.delay)`. When sound is enabled and the beat has a clip: `armed = true`, `elapsed = 0`, `armedAt = 0`, `lead = LEAD` (`LEAD_FIRST` for beat 0 at `loaded`, I.6.3), `span = lead + clip.dur + BREATH`. Otherwise `armed = false`.
- **The clock of `elapsed`.** During the lead-in (including the pre-roll `delay`), during the breath and while waiting, `tick` adds the frame's dt where the story advances (after the `paused` and `loaded` checks, one `// [audio]` line: `if (narr.armed && !narr.sounding) narr.elapsed += dt`). While the clip SOUNDS, the director writes `elapsed = lead + (ctx.currentTime - startCtx) + startOffset` every frame from the AUDIO CLOCK. rAF dt is clamped to 0.1 s and a phone stalls for more than that at beat starts (shader link, label layout, GC), so a dt sum would fall behind the voice and a later resume would repeat words; the audio clock cannot drift from what is heard. It also settles the short hold: `tick` is paused while `interacting > 0`, the voice keeps sounding, and `elapsed` keeps following it.
- **Start.** The director starts the clip when `elapsed` reaches `lead`, at offset `elapsed - lead`. If it is not decoded then, `elapsed` holds at `lead` while `waiting` accumulates wall time; at `WAIT_MAX` (`WAIT_FIRST` for the first arm after `enable()`) the beat is disarmed and runs silent. A failed fetch or decode disarms at once (I.3.6).
- **Pause and resume.** A pause records the audio-clock position at the start of its 60 ms fade and stops the source; `sounding` goes false and `elapsed` stays at `lead + position`. Resume starts a new source at that position and the audio-clock writes continue.
- **Arming mid-beat** (play after a seek or a held deep link, play after explore cut the clip, sound turned on): the same, from that moment: `elapsed = 0`, `armedAt` = the beat time so far, `lead = LEAD` (`LEAD_TOGGLE` after `ui.on`), `span = lead + clip.dur + BREATH`. The build continues from its current t, and the hold waits for the clip.
- **The build follows the voice** (H.74). When the armed clip has knots (`NarrationClip.sync`, [build t, clip seconds]) and the beat is neither under reduced motion nor a self-clocked step, `narr.sync` holds them, `narr.c0 = delay - lead` (the clip time of the build's start) and the build branch of `tick` sets `t = max(t, syncT(knots, c0, build, elapsed - lead))` instead of adding `dt / build`: linear from (c0, 0) through every knot, then the designed rate. While the clip sounds `elapsed` is the audio clock, so the picture cannot drift from the voice; a lead-in, a wait, a pause or a hold freezes both. Armed mid-beat, the picture holds at its t until the voice catches up. The build then ends inside the clip (narration-check), `pb.holdFor` is 0 and the hold is the rest of the voice plus BREATH; turning sound off in that hold restores `holdFor(beat)`. A disarm mid-build (a failed or late clip) returns the build to its designed rate from its current t. Scene properties still depend on T alone.
- **The hold.** The build branch of `tick` calls `audioHooks.advance(clock.index, tBefore, tAfter)`. The hold ends when `pb.holdElapsed >= pb.holdFor && audioHooks.holdClear()`. `holdClear()` is `!narr.armed || (!narr.sounding && narr.elapsed >= narr.span)`. With sound off it is always true: timing is exactly today's. After sound is turned off mid-beat, it stays false for 0.6 s (I.4).
- **The last beat.** Today the last beat turns 'done' (and `playing: false`) the moment its build ends. When `audioHooks.holdsLast()` (the last beat is armed), the build branch sets phase 'hold' with `pb.holdFor = 0` instead, and the existing hold branch turns it 'done' with `playing: false` once `holdClear()`. So the ring, Replay and the CTA row wait for the voice. With sound off: unchanged.
- **Deterministic length.** A beat's length is known before it plays, from manifest durations only: `total = max(delay + build + holdFor(beat), span)` for a beat before the last and `max(delay + build, span)` for the last, where `delay` is 0 on beat 0 at mount and 0.15 s after `startBeat` (0 under reduced motion); a synced beat (H.74) lasts `armedAt + span`. `beatTiming()` computes exactly this, and the offline render lays beats out with it (a cue at build t sits at `planSec(plan, t)`, the warp's inverse when synced).
- `ringProgress()` while armed returns the beat time so far over `max(delay + build + holdFor, armedAt + span)`.
- The seek contract is untouched: `?beat=N&t=X` sets T and holds, and no scene property depends on audio.

**Pacing with narration.** The first draft of this section predicted a 593 s lesson and blamed a slow voice; it measured clips that began by speaking their TTS direction (a 14-word sentence, about 4.5 s, then a pause of about 1 s; see Asset status). The caption itself was spoken at a normal pace (intro/models: 10 words in 3.7 s after the direction, about 160 words per minute). With clean clips narration adds little: 23 of 46 beats are already longer than lead + clip + breath. Estimated from each beat's current caption (spoken words, numbers as words) and timing on its branch head, at the Charon audition's own pace (2.48 words per second: 119 words in 53.8 s less its six paragraph pauses) and at the two limits of the pace gate (I.6.5):

| Chapter | Sound off (to 'done') | Sound on, 2.48 w/s | Sound on, 2.9 / 2.0 w/s |
|---|---|---|---|
| Intro | 38 s | 47 s | 43 / 55 s |
| 01 Skills | 41 s | 49 s | 45 / 58 s |
| 02 Hopper | 54 s | 58 s | 55 / 64 s |
| 03 Energy | 55 s | 64 s | 60 / 74 s |
| 04 Capacity | 53 s | 60 s | 57 / 69 s |
| 05 Continuum | 49 s | 61 s | 56 / 70 s |
| 06 Health | 50 s | 57 s | 54 / 64 s |
| Lesson | 340 s | 397 s | 371 / 453 s |

On average +1.2 s per beat. The largest additions are beats whose caption is long for their build: Continuum C1 `bp` (29 spoken words, about +6 s), Capacity D0 `measured` (+3.8 s), the chapter openers, and every chapter's last beat, which today turns 'done' at its build end and now waits for its line. "Sound off" is counted to each chapter's 'done' as `playback.ts` runs it (the first draft's 363 s also counted a hold on each last beat). These are estimates: `narration-manifest.mjs` prints each chapter's sound-on runtime from the real durations, and the exemplar's review records Capacity's.

#### I.6.5 Narration assets, the manifest and the consistency gate

**(a) Generation** (on the VPS, where the Gemini key lives; the scripts are in `C:/Users/ravik/fitness-v2/voice/`, outside the repo).
- Input: `extract.cjs` run against the current chapter heads immediately before every generation pass. Pronunciations (`"160/95"` read as "160 over 95") move from `gen_batch.py`'s SPOKEN map into `scripts/narration-spoken.json` in the repo, so generation and the check read one source: same content, never reworded.
- The prompt contains no speakable text other than the captions. PREFERRED METHOD: one continuous take per chapter, the way the owner's audition was made (`tts.py`): an instruction that ends "Read only the narration text, nothing else", asks for a warm, natural, conversational pace and "a pause of about a second between paragraphs", followed by the chapter's captions, one paragraph per beat. The take is split at its N - 1 longest silences (N beats; in the audition the paragraph pauses measure 0.75 to 1.02 s and the pauses inside paragraphs 0.35 to 0.60 s), each cut in the middle of its silence, and every piece must pass the gates below or the whole take is regenerated. One take gives a chapter one voice, one pace and one level. FALLBACK: one request per beat whose only text is the caption (no direction prefix), accepted only through the same gates.
- Gates, for every clip (a clip or take that fails is regenerated; retries on 429, 500 and 503 do not use up attempts):
  1. **Whole transcript**: the transcript of the whole clip equals the spoken text word for word (`norm()` as in `gen_batch.py`).
  2. **First span**: split the clip at its first silence of 0.5 s or more (silencedetect at -40 dB) and transcribe the part before it on its own; its words must be the START of the spoken text. This catches a spoken direction, which whole-clip transcription can miss.
  3. **Pace**: with `words` the spoken word count after `norm()` and `speech` the encoded duration minus 0.24 s (the head and tail), `words / 2.9 <= speech <= words / 2.0`: about 120 to 175 words per minute around the audition's 149. Too slow means a spoken direction, a duplicated line or a dragging read; too fast means a dropped line or a rushed one.
  4. **Gaps**: no silence inside the speech longer than 0.8 s (-40 dB). A longer gap is a spoken direction's pause or a dragging read, and it would release the duck mid-line (I.3.3).
- There is NO tempo-correction path. A clip that fails pace is regenerated, never time-stretched: a stretch changes the voice the owner chose.

**(b) Encode** (`encode.sh`): trim to 120 ms of silence at each end; `loudnorm=I=-16:TP=-2.5:LRA=11` in two passes (measure, then apply with `linear=true`); mono 44.1 kHz MP3 at 56 kbps. Every MP3 must measure -16 +/- 0.5 LUFS integrated and <= -2.0 dBTP (MP3 encoding adds about 0.2 dB of true peak), so the limiter never touches the voice alone (I.3.4). `encode.sh` re-runs gates 3 and 4 on the MP3s and fails on any clip outside them.

**(c) Manifest** (`scripts/narration-manifest.mjs [--check]`): walks `public/narration/<view>/*.mp3`, parses `<beat>-<hash>.mp3`, reads the duration with `ffprobe -v error -show_entries format=duration -of csv=p=0` and, in ONE ffmpeg pass per clip, the speech spans, the longest inner gap, the integrated loudness and the true peak (`-af silencedetect=noise=-45dB:d=0.35,ebur128=peak=true -f null -`), and writes `narration.gen.ts` sorted by view and beat order, so the output is stable. It prints each chapter's sound-on runtime (I.6.4). It also resolves each beat's narration.json `sync` anchors ([t, at, offset]: `at` a sentence index or a phrase found once in the text) against the word onsets in narration.align.json (`scripts/narration-align.py`: CTC forced alignment of the known text, H.74) into the beat's knots. With `--check` it writes nothing and exits 1 if the file would change. If two files exist for one beat (an old hash), it keeps the one whose hash matches the current caption and warns.

```ts
// story/audio/narration.gen.ts (GENERATED by scripts/narration-manifest.mjs)
import type { FitnessView } from '../../lessonTypes'
export interface NarrationClip {
  view: FitnessView
  /** Beat.id */
  beat: string
  /** first 10 hex chars of sha1(caption body with whitespace collapsed and trimmed) */
  hash: string
  /** relative to import.meta.env.BASE_URL: 'narration/<view>/<beat>-<hash>.mp3' */
  file: string
  /** seconds (ffprobe format=duration), 3 decimals */
  dur: number
  /** voiced spans in seconds (silencedetect, -45 dB, 0.35 s), for the scheduled ducks (I.3.3) */
  speech: readonly (readonly [number, number])[]
  /** spoken words: norm() of the body with scripts/narration-spoken.json applied */
  words: number
  /** longest silence inside the speech, seconds */
  maxGap: number
  /** integrated LUFS and true peak dBTP of the MP3 */
  lufs: number
  tp: number
}
/** key: `${view}/${beat}` */
export const NARRATION: Readonly<Record<string, NarrationClip>>
```

**(d) Check** (`scripts/narration-check.mjs`): parses every `src/fitness/stories/*/story.ts` with the TypeScript compiler API (`typescript` is already a devDependency) and reads only the `id` and `body` string literals of each element of the default StoryDef's `beats` array. A regex reader keyed on `id:` and `body:` mis-keys a clip whenever another `id:` sits before a body. It hashes each body and FAILS when:
- `public/narration/<view>/<id>-<hash>.mp3` is missing, or `narration.gen.ts` lacks that key with that hash;
- a clip is outside gate 3 (pace, with `words` recomputed from the caption and `narration-spoken.json`) or gate 4 (`maxGap` > 0.8 s), or outside -16 +/- 0.5 LUFS, or above -2.0 dBTP;
- `narration-manifest.mjs --check` reports a change.
- (H.74) a beat's narration.json `sync` anchors do not resolve: no word onsets for its current text and clip in narration.align.json, a sentence index out of range, a phrase not found exactly once, t outside (0, 1] or falling, anchor times not increasing, or a warped build that ends after the clip.
Clips with no matching beat are warnings (chapters land later). Exit 1 on any failure.

**(e) The gate.** `scripts/fitness-gate.mjs` runs `narration-check.mjs` as its third gate (spawned with `process.execPath`) and fails when it fails. It covers the chapters present in the worktree (in `wt-audio`, definition only). It has no pending list and is never bypassed: the exemplar cannot commit until the 7 Capacity clips exist, and each chapter's integration commit needs that chapter's clips. A caption edited without a new clip cannot be committed, so captions and audio never drift. Plan one more generation pass after each chapter's captions freeze.

- URLs are `import.meta.env.BASE_URL + clip.file`, so both `/` and `/preview/` work. At runtime a beat without a manifest entry narrates nothing (one warning in development).

#### I.6.6 `useSfx` (explore)

```ts
// story/audio/useSfx.ts
export function useSfx(): {
  /** a one-shot now; no-op unless audible; at most 12 per second per id */
  play(id: SfxId | UiId, o?: { gain?: number; pan?: number; pitch?: number; dur?: number }): void
  /**
   * A held continuous sound for a drag; set() at most once per frame; release() fades 120 ms.
   * `pos` (0..1) moves the texture's band centre along its range (pen.slide: 900 Hz to 1.8 kHz;
   * pen.scan and the pours: their I.2.3 ranges). Held sounds never glide in pitch: a drag that
   * crosses a whole step calls play('tick.label', { pitch }) at the crossing instead.
   */
  hold(id: 'pen.slide' | 'pen.scan' | 'pour.fill' | 'pour.drain' | 'rattle'): {
    set(level: number, pos?: number): void
    release(): void
  }
}
```

Explore sounds are never scheduled from T (explore does not use T), and at most 8 explore voices sound at once, inside the I.3.6 budgets. Each chapter's explore sounds are listed at the end of its part of I.7 and are wired in its own Explore code. Everywhere: chips, segmented controls and toggles `ui.tap`; Back to story `ui.tap`; Reset view `air.reveal` at -8 dB over the 600 ms tween; a drag handle picked up `ui.grab`; sliders silent while dragging.

#### I.6.7 QA hooks

Added to `window.__story` by `registerQA` (C.4):

```ts
interface StoryQA {
  /* existing members */
  audio(): {
    enabled: boolean
    unlocked: boolean
    contextState: 'none' | 'suspended' | 'running' | 'closed' | 'interrupted'
    /** navigator.audioSession.type, or null where unsupported */
    session: string | null
    /** the voice is sounding */
    playing: boolean
    clip: { view: FitnessView; beat: string; file: string; dur: number } | null
    /** seconds into the clip from the audio clock, or null when not armed */
    position: number | null
    beatHold: {
      index: number; delay: number; build: number; hold: number
      /** lead + clip + breath, or null when not armed */
      narr: number | null
      total: number; elapsed: number; waiting: boolean
      /** H.74: the build follows the voice (the armed clip has knots, the beat is not a cut or a replay) */
      sync: boolean
    }
    /**
     * Read when audio() is called (never computed per frame on a phone): dBFS RMS over the last
     * 50 ms per bus, the ducks in dB, the limiter's current reduction, and limiterMin, the lowest
     * reduction since the previous call (tracked per frame only under ?sound=1). null unless the
     * page has ?sound=1 or is a development build (the analysers exist only there).
     */
    levels: { voice: number; sfx: number; ui: number; bed: number; master: number
              duckBed: number; duckSfx: number; limiter: number; limiterMin: number } | null
    /** effect voices sounding now, ambient grains included */
    voices: number
  }
  /**
   * Beats [fromBeat, toBeat] of this chapter with sound on, exactly as planned (I.6.4), through the
   * real graph: the REFERENCE MIX (I.1.7). The bed starts in the state the chapter would have reached
   * by playing from beat 0 (I.2.5). Rejects in explore when nothing has been planned yet (I.6.2).
   */
  renderAudio(fromBeat: number, toBeat: number, opts?: {
    /** default ['voice', 'sfx', 'bed'] */
    stems?: readonly ('voice' | 'sfx' | 'bed' | 'ui')[]
    /** default true; the ducks stay keyed by the voice's spans even when the voice stem is muted */
    duck?: boolean
    /** default 48000 */
    sampleRate?: number
    /** seconds rendered after the last beat, default 2 */
    tail?: number
  }): Promise<string>   // base64 RIFF WAV, 16-bit PCM, stereo, no data: prefix
  /** The plan a render follows: beat starts, clip spans and every cue time, in seconds from the first beat. */
  audioTimeline(fromBeat: number, toBeat: number): {
    beat: number; id: string; start: number; total: number
    clip: readonly [number, number] | null
    /** the clip's speech spans, in seconds from the first beat */
    speech: readonly (readonly [number, number])[]
    /** H.74: the build's start and end, and a synced beat's knots as [seconds, build t] (null: the designed rate) */
    build: readonly [number, number]
    sync: readonly (readonly [number, number])[] | null
    cues: { name: string; sound: SfxId; at: number; dur: number }[]
  }[]
}
```

- `renderAudio` uses an `OfflineAudioContext` with its own transient bank. It needs no gesture and no realtime context, and never touches the live story. Ambient layers are sampled from their `level(T)` and `rate(T)` along the planned timeline, with A advancing one second per second as in autoplay.
- Absent any gesture and any `?sound`, `audio().contextState` is `'none'` and no request to `/narration/` has been made.
- `?tick=round` (H.71) renders the transient bank with the H.69 `tick.dot` recipe for the owner's A/B; the default is 'glass'. It is read once per page load, and `renderAudio` shares the page's bank, so a render plays what the page plays.

#### I.6.8 Engine and chapter touchpoints

Outside `story/audio/`, only these engine files change, each change a line or two marked `// [audio]` so the chapter integrations can merge around it:

| File | Change |
|---|---|
| `story/playback.ts` | `startBeat` calls `audioHooks.beatStart(n, pb.delay)`; `tick` adds dt to `narr.elapsed` while armed and not sounding, calls `audioHooks.advance` in the build branch, goes to 'hold' (holdFor 0) instead of 'done' on the last beat when `audioHooks.holdsLast()`, and gates the hold on `audioHooks.holdClear()`; `ringProgress` uses the plan total while armed |
| `story/store.ts` | `pause()` calls `audioHooks.userPause()` |
| `story/ready.ts` | `markSeek()` calls `audioHooks.seek()` |
| `story/StoryProvider.tsx` | `audio.setChapter(def)` in the layout effect and `setChapter(null)` in its cleanup; `registerQA` adds `audio`, `renderAudio`, `audioTimeline` |
| `story/url.ts` | `StoryQuery.sound: 0 \| 1 \| null` |
| `story/ui/CaptionCard.tsx` | `<SoundChip shell={shell} />` inside `.st-card` (at the top edge; after the Transport in landscape) |
| `story/ui/TopBar.tsx` | `<SoundToggle />` before `.st-theme`, and a `has-sound` class on the bar for the width rules |
| `story/gestures.ts` | `m` / `M` toggles sound (starts it when Waiting), with the existing key guards |
| `story/Stage.tsx` | the desktop key hint text |
| `fitness.css` | one appended block, `/* [audio] I.5.2 */`, for the top-bar width rules |
| `scripts/fitness-gate.mjs` | the narration gate |

`story/types.ts` and `story/clock.ts` do not change. Engine files import only `story/audio/hooks.ts`, apart from StoryProvider (the director) and the two UI components.

Chapter files, one chapter at a time and each in its own commit AFTER that chapter has merged into `fitness-v2`:
- a new `stories/<view>/sound.ts`;
- in the chapter's Scene or timeline: `export` added to each cue function that `sound.ts` names, and the few inline windows I.7 lists hoisted to named module-level exports with the same numbers. No behaviour changes; the chapter's story-qa run must be unchanged.

The Capacity exemplar (in `wt-audio`) is the only chapter wired before integration.

#### I.7 Cue sheet (all 46 beats)

Read from each chapter's current `story.ts`, timeline and Scene on its branch head (2026-09-27; intro 49efcdf, skills 72afc88, hopper 13014c6, pathways 2a350bb, definition in this worktree, continuum 48a507b, health 12f4ac2), and re-checked against the code for this revision. Notation: `sound <- source [a, b] on`, then options, then why. The SOURCE is what `sound.ts` names (I.6.2): a function (`fn`, or `each` for a set, `mean` of a set where one sound spans many elements), a `label` id, `cam`, `impact`, `times` or `spans`. `[a, b]` is the segment in beat t as sampled today: documentation only, never typed into code. `on` defaults to start for one-shots; continuous sounds span the segment. Gains are dB from the palette level. The voice is not listed: every beat narrates (I.6.4). Beats with a `resolve` or `resolve.fall` are the signature beats. Cues marked **[EX]** belong to the Capacity exemplar, built first. Each chapter ends with the edits its `sound.ts` needs in the chapter's own files (I.6.8).

#### Intro "The Line" (bed D; no ambient)

**I0 `title`** (build 4.0)
- `pen` <- `underlineDraw` [0.40, 0.85], pan [-0.3, +0.3]: the first stroke of the lesson. This sound is the pen for the whole lesson.

**I1 `models`** (build 8.0)
- `pen` <- each `morphK(T, w)`, n 4: [0.12, 0.264], [0.32, 0.464], [0.52, 0.664], [0.72, 0.864], gain -3: the same line re-forms four times.
- `tick.close` <- each `closeGlint(T, c)`, n 4, on the end of its rise (the glint's peak, where the shape closes), pitch [0, +2, +7, +7]: each model closes and is named, climbing the chord as the models add up.

**I2 `definition`** (build 5.5)
- `pen` <- `axesDraw` [0.10, 0.35], then `pen` <- `curveDraw` [0.35, 0.70], pan [-0.3, +0.3]: axes, then the curve (one entry).
- `pour.sweep` <- `sweep` [0.70, 0.95], gain -2: the area sweeps in; the first taste of Capacity's pour.
- `tick.claim` <- `claimIn` [0.90, 1.0] on land: AREA = FITNESS, stated small (the intro's claim sound is I4).

**I3 `lifetime`** (build 5.0)
- `air.reveal` <- `cam` [0, 0.35] (to az -32, el -14): the view turns to reveal age.
- `pour.lift` <- `extrude` [0.10, 0.70], gain -4: the area extrudes back through every age.
- `tick.label` <- `healthIn` [0.75, 1.0] on land: HEALTH lands on the floor.

**I4 `map`** (build 5.0, signature)
- `pen` <- each `glyphDraw(T, c)`, n 4: [0.16, 0.25], [0.25, 0.34], [0.34, 0.43], [0.43, 0.52], gain -3: the pen redraws the four models in tiles 01, 02, 03 and 05, one stroke at a time.
- `tick.dot` <- each `plateIn(T, i)` for tiles 01, 02, 03, 05 and 04 (i 0 to 4), on land, gain -3: each tile's ring lights as its model lands, then CAPACITY; the count grows from 1 to 5.
- `resolve` <- `plateIn(T, 5)` on land (about 0.66): the sixth ring, HEALTH, completes the map: the whole lesson is on one screen and every tile can be opened. The bed's F#4 enters.
- (The first draft sourced I4 from `fold(i)` with staggered windows; in the code all six folds start at 0 together, so they are not what lands one by one.)

Explore: a tile tap `ui.step`.

Intro edits: none (every function above is exported from `timeline.ts`).

#### 01 Skills "Ten spokes, one floor" (bed A; no ambient)

**S0 `ten`** (build 5.0)
- `pen` <- mean of `spokeDraw(T, i)` over the 10 spokes [0.20, 0.75], pan 'orbit': ten spokes drawn clockwise.
- `tick.label` <- each `nameIn(T, i)`, n 10, gain -4 (6 audible): each name lands as its spoke completes.

**S1 `trained-practiced`** (build 5.0)
- `pen` <- `trainedProg` [0.05, 0.45], pan [0, +0.3]; then `pen` <- `practicedProg` [0.50, 0.90], pan [+0.3, -0.2]: the trained arc, then the practiced arc.
- `tick.label` <- label `sk-c-trained` [0.38, 0.46], then label `sk-c-practiced` [0.88, 0.96]: "Trained (organic)", then "Practiced (neural)".

**S2 `both`** (build 3.5; impact [0.55, 0.67])
- `pen` <- `trainedExt` [0.05, 0.55], pan [-0.3, -0.1]: both arcs grow toward each other (`practicedExt` shares the window; one sound).
- `tick.meet` <- `bothOn` [0.50, 0.62] on land: the two families meet over Power and Speed; two pitches at once. No resolve (S2 is not the signature).

**S3 `generalist`** (build 4.5)
- `air.reveal` <- `cam` [0, 0.35] (to az -10, el 16), gain -6: the solid is revealed.
- `pour.fill` <- mean of `growV(T, i)` [0.10, 0.55], gain -6: the balanced shape fills.
- `pen` <- `ringDraw` [0.60, 0.84] (hot): the floor ring at 7.
- `tick.label` <- label `sk-w-g` [0.90, 0.96]: "Weakest skill 7".

**S4 `specialist`** (build 5.0, signature)
- `pen.dash` <- `specDash` [0.15, 0.50]: the Powerlifter's dashed outline.
- `resolve.fall` <- `collapse` [0.66, 0.86]: the floor ring falls from 7 to 2; the fall's lowpass closes over the collapse. The bed's minor third enters.
- `tick.label` <- label `sk-w-p` [0.91, 0.97]: "Weakest skill 2".

**S5 `thirteen`** (build 5.5)
- `tick.dot` <- each `cellGrow(T, k)` over the 11 cells that are not `carried`, in `growOrder`, on land, gain -5 [0.16, 0.76] (6 audible): the other athletes' wheels land.
- `tick.label` <- label `sk-lg-sort` [0.80, 0.92]: SORTED BY WEAKEST SKILL. The bed's C#5 arrives with it (I.2.5).

Explore: vertex drag `tick.dot` at each whole-number crossing (at most 12 per second), on the chord tone for the value (0 below 4, +2 from 4, +7 from 7: the floor at 7 sounds highest); athlete chip `pen` 0.6 s at -6 dB (the outline redraws); Wheel | Grid `ui.tap`.

Skills edits (`Scene.tsx`): `export` on `spokeDraw`, `nameIn`, `trainedProg`, `practicedProg`, `trainedExt`, `bothOn`, `growV`, `ringDraw`, `collapse`, `cellGrow`, `carried`, `growOrder`; hoist the Powerlifter outline's inline `progress` window (S4, [0.15, 0.50], draw) into `export const specDash`.

#### 02 Hopper "The Tally" (bed E; ambient `rattle`)

Ambient: `rattle` with `level(T) = pour(T) x (1 - toChart(T))` (the drum is gone once the chart takes over in H6) and `rate(T) = 1 + spinBoost(T)`; unpitched, Poisson, 3.5 per second at rate 1, at most 8 per second (I.2.4).

**H0 `hopper`** (build 4.5)
- `pen` <- `hoops` [0, 0.30], gain -2: the hoops draw on.
- `tick.steel` <- `steel` [0.20, 0.40] on half: the drawing becomes steel.
- `ball.cascade` <- `pour` [0.33, 0.80]: 25 balls pour in; the rattle rises with them.

**H1 `draw`** (build 4.5)
- `ball.drop` <- `times`: draw 1's ball landing in `STORY_SCHED` (about 0.45): the ball reaches the ticket slot.
- `flip` <- `spans`: the visible half of draw 1's `[flip0, flip1]` [0.45, 0.70]: the ticket turns in and snaps flat.
- `pen` <- `trace` [0.70, 0.95] (hot): the pen traces the ticket.

**H2 `score`** (build 5.0)
- `pen` <- mean of `railDraw(T, k)` over the 6 rails [0, 0.30], gain -4: six rails.
- `clack` <- `times`: draw 1's `fly1` for the six athletes: six bricks hit six rails (a 175 ms ripple).
- `tick.claim` <- label `hop-lead` [0.90, 0.98]: LEAD lands on the Weightlifter.

**H3 `specialists`** (build 5.5)
- `flip` <- `spans`: `[flip0, flip1]` of draws 2, 3 and 4: three tickets.
- `clack` <- `times`: `fly1` of draws 2, 3 and 4 (three ripples), gain -2.
- `tick.label` <- `times`: `tick0` of draws 2, 3 and 4, gain -4: each draw's top scorer is marked.

**H4 `unknown`** (build 5.5, signature; impact [0.62, 0.74])
- `ball.drop` (the unknown ball's bank entry) <- `times`: draw 5's ball landing (about 0.17): a lower, slower knock.
- `flip` <- `spans`: draw 5's flip [0.15, 0.28]: CLIMB 6 FLIGHTS WITH BAGS.
- `clack` <- `times`: draw 5's `fly1`; the Generalist's brick lands last (0.43) at +3 dB.
- `resolve` <- `impact` [0.62] (NEW LEADER): the generalist takes P1 without winning a specialist's draw. The bed's G#4 enters.

**H5 `many`** (build 6.0)
- `clack.rain` <- `spinBoost` [0.05, 0.78] (`H5_A`, `H5_B`), `rate(t)` = 6 bricks x the draws per second of `h5Index`: 35 draws rain in; single clacks up to 10 per second and the patter above them (I.2.3), while the rattle speeds up with `spinBoost` to its 8 per second. The 16-per-second budget holds throughout.

**H6 `every-run`** (build 6.0)
- `pen` <- `bracketDraw` [0.04, 0.20], gain -4: the bracket measures the lead.
- `pen` <- `mineProgress` [0.40, 0.60] (hot): this run's line.
- `pen.bundle` <- `bundle` [0.58, 0.88], gain -3: 64 other hoppers draw at once.
- `tick.claim` <- label `hop-this-run` [0.88, 0.98]: THIS RUN.

Explore: Draw `ball.drop`, `flip` and a `clack` ripple at the explore schedule's times; x10 `clack.rain` for 1.2 s; x40 `clack.rain` for 2.4 s (the patter carries the rush) with the rattle at rate 2; New run `tick.claim`; Rails | Every run `ui.tap`; the rattle while the drum spins.

Hopper edits (`Scene.tsx`): `export` on `hoops`, `steel`, `pour`, `trace`, `railDraw`, `bracketDraw`, `mineProgress`, `bundle` (they read `isExplore()`, so they are sampled in story mode only, I.6.2). `STORY_SCHED`, `B`, `H5_A`, `H5_B`, `h5Index`, `spinBoost` and `toChart` are exported from `timeline.ts` already.

#### 03 Energy "Three engines, one river" (bed B minor; ambient `river`)

Ambient: `river.phos`, `river.gly`, `river.oxi`, each with `level(T) = moteOn(T, band)` (a band flows once it has flooded, and keeps flowing when the motes follow it into its lane in P4).

**P0 `three`** (build 4.5)
- `pen` <- `axesDraw` [0, 0.26]: the axes.
- `pen` <- `envDraw` [0.35, 0.90], pan [-0.3, +0.3] (hot): the envelope falls left to right (L11).

**P1 `phosphagen`** (build 5.0)
- `pour.flood` (phosphagen) <- `front(T, phosphagen band)` [0.05, 0.35], pan [-0.3, +0.3]: the rose band floods. Its river layer follows.
- `tick.label` <- `curCallout` [0.38, 0.46], pitch +7 (the phosphagen pitch): the cursor callout appears. This is the first engine pitch the viewer hears; P2 and P3 add +2 and 0 in that order, so P5 and P6 can use all three.

**P2 `glycolytic`** (build 4.5)
- `pour.flood` (glycolytic) <- `front(T, glycolytic band)` [0.05, 0.35]: the amber band floods.
- `tick.claim` <- `times`: the t where `dominantOf(cursorT)` turns glycolytic (about 12 s on the cursor; found by sampling, never typed), pitch +2: the lead changes engine.

**P3 `oxidative`** (build 5.5)
- `pour.flood` (oxidative) <- `front(T, oxidative band)` [0.05, 0.35]: the blue base swells.
- `tick.claim` <- `times`: the t where `dominantOf(cursorT)` turns oxidative (about 75 s; computed), pitch 0.
- `tick.label` <- label `pw-mara` [0.88, 0.96]: the Marathon edge chip.

**P4 `power`** (build 5.5, signature)
- `air.reveal` <- `lanesM`, segment 0 [0, 0.45]: the stack separates into lanes.
- `tick.label` <- `laneNames` [0.45, 0.60]: the three lanes are named together (one mark; the names appear at once).
- `resolve` <- `orderClaim` [0.60, 0.76]: "Peak power order". Oxidative lasts; it does not hit harder. The bed's D5 enters.

**P5 `workouts`** (build 6.5)
- `tick.dot` <- each `pinDrop(T, k)`, n `PINS.length`, on land, gain -5 [0.25, 0.45] (6 audible): the pins drop.
- `tick.claim` <- `times`: `STOP_AT` (0.47, 0.60, 0.73, 0.86), each at its stop's `dominantOf` engine pitch (+7, +2 or 0): each result chip sounds its engine.

**P6 `all-three`** (build 5.0; impact [0.70, 0.82])
- `pen` <- mean of `bracketDraw(T, k)`, k 0 to 2 [0.10, 0.42]: three brackets (one sound).
- `tick.close` <- each `bracketPulse(T, k)`, n 3, on the end of its rise (the peaks at 0.46, 0.55, 0.64), pitch [+7, +2, 0]: each band pulses in turn, phosphagen to oxidative, each at its engine pitch.

Explore: benchmark chip `tick.claim` at its dominant engine's pitch; Stacked | Lanes `air.reveal` at -8 dB; Power | Share `ui.tap`; the river while the motes flow.

Energy edits: none (every function above is exported from `timeline.ts`; `pw-mara` is a label id).

#### 04 Capacity "The integral" (bed D; no ambient) **[EX]**

The exemplar builds the whole chain on this chapter first: narration timing (I.6.4), the D bed, every `ui` sound, the chip and toggle, the gates and the QA hooks, `cueFrom` with `fn`, `each`, `label` and `impact` sources, the transient bank, and these palette entries: `pen`, `pen.dash`, `tick.dot` (both rings), `tick.label`, `tick.close`, `air.reveal`, `pour.fill`, `pour.drain`, `resolve`, `resolve.fall`.

**D0 `measured`** (build 3.4)
- **[EX]** `pen` <- `axesDraw` [0, 0.26], pan [-0.25, +0.3]: one hot L stroke, down the power axis, then along time.
- **[EX]** `tick.dot` <- `d0Dot` [0.30, 0.40] on land, ring 'ripple': one measured point, the 400m run.
- **[EX]** `pen.dash` <- `dimsDraw` [0.40, 0.60], gain -6: dashed dimension lines from the point to both axes (the 400m run's name lands with them; no extra sound).
- **[EX]** `tick.dot` <- each `taskAppear(T, i)` over the nine tasks other than `TASK_400`, on land, gain -5, max 4 [0.62, 0.92] (4 audible: the first, the last and two between; H.71, the fifth listen): nine more measured points.

**D1 `curve`** (build 4.6)
- **[EX]** `pen` <- `curveDraw` [0, 0.52], pan [-0.3, +0.3] (hot): the pen draws the curve through the points.
- **[EX]** `tick.label` <- labels `task-<i>` of the three tasks named in this beat (1RM clean, Mile run, 10k run; each label's cue already sits at its pen-head crossing, `crossings(frame)`), pitch [+2, 0, -5], gain +2 (H.71, was -3: the last name was masked by the voice): each name lands as the pen head passes its dot, and the pitch falls (E6, D6, A5) as power falls with duration. (The first draft listed four names; the 400m run is named in D0.)

**D2 `domains`** (build 5.5)
- **[EX]** `air.reveal` <- `fan`, segment 0 [0, 0.35]: the curve fans out in depth.
- **[EX]** `tick.label` <- label `['dom-0', 'dom-key-0']` [0.16, 0.30], gain -3: the five domains are named together (one mark; the names appear at once).
- **[EX]** `air.reveal` <- `fan`, segment 1 [0.50, 0.85], gain -3, pan reversed: the slices converge and the camera returns front-on.
- **[EX]** `tick.close` <- `averageFlare`, segment 0 on end (the flare's peak, about 0.82): the averaged curve absorbs the five.

**D3 `area`** (build 5.0, signature; impact [0.80, 0.92])
- **[EX]** `pour.fill` <- `pourLevel` [0.05, 0.78]: light pours in under the curve; the sound fills as the light does.
- **[EX]** `resolve` <- `impact` [0.80]: AREA = FITNESS lands with the claim plate and the impact accent. The bed's F#4 enters.

**D4 `synthesis`** (build 4.5)
- **[EX]** `pen` <- each `d4Stroke(T, k)`, n 3: [0.04, 0.24], [0.34, 0.56], [0.64, 0.86], gain -3: three strokes of light (the power axis, the curve, the time axis).
- **[EX]** `tick.label` <- label `c-height` [0.18, 0.30], label `c-domains` [0.48, 0.60], label `c-time` [0.78, 0.90], pitch [+7, +2, +9]: HEIGHT, DOMAINS and TIME land, each at the tick pitch of the chapter it names (Skills A6, Hopper E6, Energy B6, the B an octave up to stay within 7 semitones): the models combine.

**D5 `specialist`** (build 5.5, signature)
- **[EX]** `pen.dash` <- `d5Dash` [0.15, 0.50]: the Powerlifter's dashed curve.
- **[EX]** `pour.drain` <- `spillMix` [0.45, 0.90]: the light spills out.
- **[EX]** `resolve.fall` <- label `lost` [0.62, 0.74], gain -3 (H.71: it lands between "The generalist" and "wins the integral", so it marks the lost area without a verdict on the generalist): AREA LOST, the integral lost; its lowpass closes over 0.9 s. The bed's answer dips 6 dB.
- **[EX]** `tick.close` <- label `zone` [0.74, 0.86], gain -3: ZONE WON, the amber sliver's small win, after the loss, in the order the picture shows them. (The first draft had these two the other way round; in the code AREA LOST lands at 0.62 and ZONE WON at 0.74.)

**D6 `lineup`** (build 5.5)
- **[EX]** `tick.dot` <- each `rowAppear(T, r)` for rows 1 to 6 (row 0 is the folded chart), on land, ring 'shimmer', gain -2 [0.28, 0.80] (H.71, was -5: the first row was masked by the voice): each specialist's row lands with its light.
- **[EX]** `pen` <- mean of `barGrow(T, r)` over the rows [0.36, 0.98], gain -8: the score bars grow into a staircase of light.

Explore **[EX]**: athlete chip `pour.drain` (a specialist) or `pour.fill` (the Generalist) for 1.2 s at -6 dB, the damped replay; "Show the 5 modal domains" `air.reveal` at -8 dB (the orbit to the fan); the scrub probe is silent.

Capacity edits **[EX]** (`stories/definition/Scene.tsx`): `export` on `axesDraw`, `d0Dot`, `dimsDraw`, `taskAppear`, `curveDraw`, `averageFlare`, `pourLevel`, `spillMix`, `rowAppear`, `barGrow` (`fan` is exported already; `TASK_400` and `RANKED` are exported from their modules); hoist two inline windows into named exports with the same numbers and use them in place: `d4Stroke(T, k)` (the three D4 Pen `progress` windows, draw) and `d5Dash` (the Powerlifter's D5 Pen `progress`, draw). Labels used by id with no edit: `task-<i>`, `dom-0`, `dom-key-0`, `c-height`, `c-domains`, `c-time`, `lost`, `zone`.

#### 05 Continuum "From one line to the dial" (bed F# minor; no ambient)

**C0 `one-line`** (build 4.0)
- `pen` <- `lineDraw` [0.04, 0.58], pan [-0.3, +0.3]: one line in the spectrum.
- `tick.label` <- each `c0Callout(T, k)`, n 3: [0.62, 0.72], [0.70, 0.80], [0.78, 0.88], on land, pitch [0, +2, +7]: SICKNESS, WELLNESS, FITNESS, rising toward better.

**C1 `bp`** (build 4.5)
- `tick.dot` <- `spans` `BP_PLAN.appear` [0.26, 0.34] on land: the bead appears at "160/95".
- `pen.slide` <- `spans` `BP_PLAN.moves` [0.40, 0.58] and [0.68, 0.86]: the bead slides right: a rising texture with glass grains, never a gliding tone.
- `tick.label` <- the same spans on end, pitch [+2, +7]: "120/70", then "105/55", each value marked by a step up the chord (the pitch lives here, not in the slide).

**C2 `bodyfat`** (build 4.0)
- `pen` <- `fatDraw` [0.16, 0.40]: the body fat row.
- `tick.dot` <- `spans` `FAT_PLAN.appear` [0.44, 0.50] on land: the bead appears.
- `pen.slide` <- `spans` `FAT_PLAN.moves` [0.55, 0.67] and [0.74, 0.88]: 40%, 20%, 10%.
- `tick.claim` <- `betterCallout` [0.88, 0.98] on land: LOWER IS BETTER.

**C3 `dial`** (build 6.0, signature)
- `pen` <- mean of `rowDraw(T, i)` over `CASCADE` [0.10, 0.36], gain -4: eight more rows.
- `air.swing` <- mean of `morphK(T, i)` over the rows [0.52, 0.88]: the rows swing into a full circle.
- `pen` <- `ringsClose` [0.84, 0.96], gain -2: the WELL and FIT circles close.
- `resolve` <- `centreCallout` [0.90, 1.0]: the dial lands, sickness at the centre, fitness at the rim. The bed's A4 enters.

**C4 `well`** (build 4.5)
- `air.deep` <- `cam` [0, 0.35] (the tilt that shows the pit, with `pitShade`): the centre is a pit.
- `tick.dot` <- each `climbWell(T, i)`, n 10, on land, pitch [0, 0, +3, +3, +7, +7], gain -5 [0.42, 0.74] (6 audible): the average profile climbs out of the pit.
- `pen` <- `outlineDraw` [0.68, 0.86]: the polygon joins.
- `tick.claim` <- `wordRise` [0.86, 1.0] on land: WELL rises.

**C5 `super`** (build 5.0; impact [0.78, 0.90])
- `pour.lift` <- mean of `climbAthlete(T, i)` [0.15, 0.75], gain -3: the profile climbs toward the rim.
- `tick.claim` <- `times`: [`T_SWAP` - `B.sup`] (computed): the word changes to the athlete's state exactly where the score crosses.

**C6 `hedge`** (build 4.5)
- `pour.glow` <- `bandOn` [0.10, 0.70], gain -4: the margin beyond wellness lights.
- `tick.label` <- `preventiveCallout` [0.56, 0.70] on land: Preventive medicine. The bed darkens with the pit (I.2.5).

Explore: dragging a dot `hold('pen.slide')` with `pos` following the dot along its spoke (the texture rises outward), and a `tick.label` at each whole-step crossing (at most 12 per second) on the chord tone for the dot's third of the spoke (0, +2, +7, rising outward); profile chip `pour.lift` (outward) or `pour.drain` (inward) for 0.8 s at -6 dB.

Continuum edits (`timeline.ts`): `export` on `BP_PLAN`, `FAT_PLAN`, `climbWell`, `climbAthlete` (the rest is exported already).

#### 06 Health "Stack every age" (bed G; no ambient)

**L0 `slice`** (build 4.0)
- `pen` <- `axesDraw` [0, 0.16], then `pen` <- `curveDraw` [0.14, 0.60]: the axes, then the age-30 curve.
- `pour.sweep` <- `areaSweep` [0.55, 0.85], gain -2: the area sweeps in, a callback to Capacity.
- `tick.label` <- `age30` [0.84, 0.96]: AGE 30.

**L1 `stack`** (build 6.0)
- `air.reveal` <- `axesSlide` [0, 0.32] (the camera rises with it): age is revealed.
- `tick.card` <- each `sliceP(T, k)`, n 13, on land, gain -6 [0.26, 0.72] (6 audible): the slices fly in one after another.
- `pour.glow` <- `fuse` [0.76, 0.95], gain -4: they fuse into one surface.

**L2 `volume`** (build 4.5)
- `pour.fill` <- `pourLevel` [0.12, 0.60], pitch -12: the volume fills from the floor, an octave deeper than Capacity's area.
- `tick.claim` <- `claimIn` [0.80, 0.96] on land: VOLUME = HEALTH.

**L3 `line`** (build 4.0)
- `pen` <- `edgeDraw` [0.55, 0.85], pitch -5 (hot; its glow a fourth lower: a darker pen): the red edge of the independence line.
- `tick.label` <- `lineCallout` [0.84, 0.96]: INDEPENDENCE LINE.

**L4 `sink`** (build 5.5)
- `pour.drain` <- `sinkK` [0.05, 0.80], gain -3: the surface sinks toward the line. The bed darkens with it (I.2.5).
- `tick.label` <- `indep70` [0.86, 0.96]: "Independent through 70".

**L5 `any-age`** (build 6.0, signature; impact [0.30, 0.42])
- `pour.lift` <- `scanAge` [0.15, 0.85] (the scanner's time-true sweep): the surface lifts behind the scanner like a wave.
- `resolve` <- `impact` [0.30]: it lifts. The bed's B4 enters and the bed reopens.
- `tick.label` <- `indep85` [0.86, 0.96]: "Independent through 85+".

**L6 `hold`** (build 5.5)
- `pour.lift` <- `backW` [0, 0.45], gain -5: back to the Lifelong trainer.
- `pen.scan` <- `ageSliceAge` [0.42, 0.90]: the amber slice rides from 20 to 85.
- `tick.claim` <- `indep90` [0.90, 0.98]: "Independent through 90+". After the beat is done the bed resolves to D (I.2.5).

Explore: dragging the age slice `hold('pen.scan')` with `pos` following the age; profile chip `pour.lift` or `pour.drain` by the sign of the volume change, 1.0 s at -6 dB; the independence toggle `ui.tap`.

Health edits: none (every function above is exported from `timeline.ts`).

**Density check**: no beat has more than 4 entries (S3, H4, H6, D0, D2, D5, C2, C3 and C4 have 4; H5 has 1). Each of the eight signature beats (I4, S4, H4, P4, D3, D5, C3, L5) has exactly one `resolve` or `resolve.fall`, and no other beat has one. No beat's transient events exceed 16 in any second (H5 is the densest, held to the budget by construction).

#### I.8 Acceptance checklist

Run on the Capacity exemplar first, then on each chapter as its cues land. Meters, transcripts and code are the judges; the ear (below) is a second opinion only.

**Gates and assets**
- [ ] Prerequisite: the 7 Capacity clips exist in `public/narration/definition/`, generated by the I.6.5 method, and the generation log shows gates 1 and 2 passed for each: the first speech span of every clip transcribes as the start of its caption, never as a direction.
- [ ] `node scripts/fitness-gate.mjs` passes, including `narration-check.mjs`: every beat of every present chapter has its clip and a matching `narration.gen.ts` entry; every clip is inside the pace gate (words / 2.9 to words / 2.0 s of speech), has no inner gap over 0.8 s, measures -16 +/- 0.5 LUFS and <= -2.0 dBTP; `narration-manifest.mjs --check` reports no change.
- [ ] Editing one caption word makes the gate fail until the clip and the manifest are regenerated (tried once, then reverted).
- [ ] A spoken preamble fails the gate: prepend 4 s of any speech and a 1 s pause to one local clip copy and rebuild the manifest; `narration-check` fails on pace and on the gap (tried once, then reverted).
- [ ] `node C:/Users/ravik/fitness-v2/tools/dashcheck.mjs <worktree>/src/fitness` prints no dashes; the TS strict build passes for `/` and `/preview/`.
- [ ] No new dependency; no audio file other than `public/narration/**`; `story/audio/**` and `stories/*/sound.ts` have no `Math.random`.
- [ ] Merge hygiene: outside `story/audio/`, the diff touches only the I.6.8 files, each change marked `// [audio]`; in `stories/definition/` the only new file is `sound.ts`, and `Scene.tsx` changes only by `export` and the two hoists (read the diff); story-qa on definition with sound off is unchanged.
- [ ] `narration-manifest.mjs` prints Capacity's sound-on runtime; the review records it next to the I.6.4 estimate (about 60 s).

**The gesture rule** (Playwright WITHOUT `--autoplay-policy=no-user-gesture-required`)
- [ ] With no stored choice and no `?sound`: an init script counting `AudioContext` and `webkitAudioContext` constructions reads 0 after a full autoplay of the chapter; `__story.audio().contextState === 'none'`; the request log has nothing under `/narration/`.
- [ ] A real CDP tap on the chip: `contextState` is 'running' within 300 ms, `playing` is true within 0.7 s, `localStorage['fitness-sound'] === '1'`, and `session` is 'playback' where supported.
- [ ] Reload with '1' stored: the chip shows, `contextState` stays 'none' until a gesture; the first tap anywhere in the lesson starts sound, and the current beat's clip plays from its start.
- [ ] Reload with '1' stored, then make the FIRST tap on the top-bar toggle (Waiting): sound starts and '1' stays stored. The same with the chip, and with M on desktop.
- [ ] The toggle turns sound off: `contextState` becomes 'suspended' within 400 ms, '0' is stored, the chip never shows again, and reloading keeps it off.

**Timing** (with `?sound=1` and the autoplay flag)
- [ ] Over a full Capacity autoplay, each beat lasts its planned `total` (I.6.4) within 0.15 s, measured in story time (the sum of min(dt, 0.1) per frame) plus the audio clock while the clip sounds, never in wall time (H.71); every clip sounds for its manifest duration on the audio clock; no beat advances before its clip end plus a breath.
- [ ] With `?sound=0`, each beat lasts exactly today's time in story time (within one frame).
- [ ] `?beat=N&t=X` lands in the same story state with `?sound=0` and `?sound=1` and renders the same pixels between two loads that share a chart frame (pixel diff under 0.5%; H.71); no clip plays while held.
- [ ] `audioTimeline(0, 6)` matches the scene: for every Capacity cue, seek to its `at` and confirm its source (function or label cue) has just left 0; for continuous cues, that it is strictly between its start and end values halfway through.
- [ ] Last beat: on D6 with sound on, `phase` stays 'hold' until the clip has ended plus the breath; `playing` stays true until then; Replay and the CTA row appear only at 'done'.

**Behaviour** (I.4)
- [ ] Pause mid-clip for 3 s, resume: `position` after resuming is at or up to 70 ms before `position` at the pause (no word lost, at most the fade repeated); the bed fades out and back.
- [ ] Stalls: during one clip, block the main thread for 300 ms three times (a busy loop in `page.evaluate`), then pause and resume: `position` still equals the audio-clock position within 50 ms, and nothing already heard is repeated beyond 70 ms.
- [ ] Next during a build: `playing` goes false within 150 ms, no cue fires during the glide, and the next beat's clip starts about 0.2 s after that beat starts.
- [ ] Prev twice, then Next: every landed beat's clip plays (`playing` true within 0.5 s of each beat start) and the console shows no decode error.
- [ ] A missing clip: route one MP3 to the SPA fallback (index.html with a 200): that beat runs silent at once (no 2 s wait) with one warning, and the next beat narrates.
- [ ] Scrub across three beats: the voice stops and only the soft boundary ticks sound.
- [ ] Explore on stops the voice within 250 ms and the bed drops 4 dB; Back to story then play replays a cut clip from its start and does not replay a finished one.
- [ ] Hidden page: hide the page mid-clip for 5 s (visibilitychange with `document.visibilityState` 'hidden'), then show it: while hidden `levels.master` reads silence and `contextState` becomes 'suspended'; after showing, `position` is at or up to 70 ms before its value at the hide (no word lost).
- [ ] Chapter change: the old voice stops within 200 ms; the new chapter's beat 0 clip starts `LEAD_FIRST` after its `loaded`; the room never drops out.
- [ ] Hidden page after a sound toggle (H.71, `sound-qa hidden2`): on, off, hide, show, on, hide leaves the context suspended, `levels.master` at -120 and the audio clock stopped.
- [ ] Session (H.71, `sound-qa session`, `idleshow`): sound off and on again 120 ms apart leaves the session 'playback'; showing the tab while the context idles leaves it asleep with the session 'auto', and Play wakes it where it paused.
- [ ] Desktop, '1' stored (H.71, `sound-qa keys`): the first ArrowRight, Space or E with focus on the body unlocks audio.
- [ ] Reduced motion (`?motion=reduce`): nothing narrates at load; a step narrates the landed beat once; Show build fires that beat's cues, never an `air`, and its clip plays to its end after the build stops; the bed plays with it, then holds 8 s and fades.
- [ ] Sound turned on mid-beat: `ui.on`, then the clip from its start 0.35 s later, and the beat waits for it. Turned off mid-beat: silence within 200 ms and no jump in the story.
- [ ] Hopper, when wired: `audioTimeline(5, 5)` has at most 16 transient events in any one-second window, and during a live H5 at 4x CPU throttle `audio().voices` never exceeds 24.

**Mix** (ffmpeg `ebur128=peak=true` on `renderAudio`; I.3.5)
- [ ] Full mix of the chapter (`renderAudio(0, last)`): integrated -16.0 LUFS +/- 1.0, true peak <= -1.0 dBTP, LRA <= 8 LU.
- [ ] Voice stem: -16.0 +/- 0.7 LUFS, <= -2.0 dBTP, and sample-identical to the clips placed at their plan times (the chain adds nothing to the voice: the limiter only catches sums).
- [ ] Bed stem: -35.5 +/- 2 LUFS with ducking, -32 +/- 1.5 without (`duck: false`); its first and last beats within 3 LU of each other. Effects stem: sample peak <= -18 dBFS, momentary max <= -27 LUFS; the D3 resolve alone -30 +/- 1 LUFS momentary max.
- [ ] Ducking bridges (H.71, `sound-qa duck` and `bridge`): between a chapter's first and last syllable no un-duck window is shorter than 0.8 s, and live the bed stays at -6 dB across D0 -> D1.
- [ ] Continuous sounds before a claim are not risers (H.71, `sound-qa pour`): the D3 pour's centroid moves under one octave after its attack, its loudness rises under 3 LU, and its last second before the bell is flat or falling.
- [ ] Every cue of a chapter has at least 6 dB of band margin over voice + bed in some third-octave band (0.4 to 8 kHz, 50 ms frames, ducked stems; H.71).
- [ ] Ducking: on the bed stem, short-term loudness inside the voice's speech spans is 5 to 7 LU below the neighbouring gaps, and `scripts/sound-qa.mjs duck` finds the ducked bed 6 dB (+/-0.5) under the unducked render across every speech span of every clip (H.70).
- [ ] Limiter: in a full live autoplay under `?sound=1`, `levels.limiterMin` never goes below -1.5 dB.
- [ ] Two renders of the same range agree within 1 LSB at 16 bits (determinism; Chromium's float rounding, H.69, H.70); a render of D4 to D6 alone starts with the bed's F#4 already in (the bed state from beat 0).

**UI** (every chapter, at 360 x 780, 375 x 812, 390 x 844, 412 x 915, 430 x 932, 844 x 390, 768 x 1024, 1024 x 768 and 1440 x 900)
- [ ] The top bar never overflows or overlaps (element rects), the wordmark follows the I.5.2 bands, and the toggle and the theme box are each 44 x 44.
- [ ] The chip clears the grab band and the scrubber band, sits over no visible label (`labels()` overlaps against the `sound-chip` obstacle), is at least 44 px tall to touch, and leaves the focus rect and camera fit unchanged.
- [ ] Landscape: the chip is a row after the transport and yields to the CTA row on the finished last beat.
- [ ] `aria-pressed`, the constant `aria-label="Sound"`, the chip's label and the "Sound on" status all read correctly; focus rings show; `M` toggles on desktop and is ignored in inputs and with the sheet open; both controls carry `data-sound-control`.
- [ ] `/preview/` builds fetch `/preview/narration/...`; `/` builds fetch `/narration/...`.

**On the owner's phone** (a real iPhone, by ear; the final judge, I.1.7)
- [ ] With the ring / silent switch ON, turning sound on plays the narration.
- [ ] The tick A/B (H.71): Capacity with and without `?tick=round`, Sound on, three plays each; keep the `tick.dot` that reads as chalk and glass on the fifth listen and record the choice in H.
- [ ] D5 (H.71): the dark loss bell between "The generalist" and "wins the integral" does not read as a verdict against the generalist; if it does, take the story-timing fix.
- [ ] With music playing in another app, turning sound on pauses it; turning sound off (or 12 s of silence) lets it resume.
- [ ] Lock the phone mid-sentence, wait, unlock: nothing sounds while locked, and the sentence continues where it stopped without losing a word.
- [ ] The first chapter with sound feels calm on the fifth listen; the voice is never covered; nothing sounds like a notification or a game.

**The ear** (the Gemini audio critic, `critic.py` on the VPS)
- Render the range, take the cue list from `audioTimeline`, and put exact timestamps in the question file. Ask closed questions, one per line, for example:
  1. "At each of these timestamps, is the named sound audible under the voice? Answer yes or no per line: 3.41 s pen stroke; 4.60 s dot tap; ..."
  2. "Is every word of the narration intelligible? List any timestamp where an effect or the background tone masks a word."
  3. "List any timestamp with a click, a harsh transient, distortion or a level jump."
  4. "At 21.30 s a bell sounds. Is it a calm, open, glass-like tone, a notification chime, or a game or achievement reward? Answer one word: calm, chime or reward."
  5. "Between 0 and 60 s, does the background tone pulse or throb audibly? Is it noticeable at normal phone volume? Does any bell or tick sound out of tune against it?"
  6. (Hopper) "Between 5 and 40 s, does the background clicking sound like a ticking clock or a metronome? Yes or no."
  7. "Here are the narration lines in order: ... Does the narrator say anything that is not in these lines? Give each extra phrase with its timestamp."
- Every question file carries controls: a timestamp that is digital silence in the stem being asked about, and a named sound that does not exist. Discard any run that fails either (H.70). Record audibility as frame exposure measured on the stems, never as the ear's "heard every cue".
- Pace is read from the manifest (`words`, `dur`), never from the ear.
- Act on an ear finding only when a meter, a stem render, a transcript of the flagged span or the code corroborates it. (The ear once reported "an accidental duplicate line" in a clip that had passed a whole-clip transcript check; it was most likely hearing the spoken direction, which only a transcript of the first span proved. A finding the ear makes and a transcript confirms is real.) Record the finding, the corroboration and the fix in section H.
