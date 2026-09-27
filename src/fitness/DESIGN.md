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

**Caption card**: left, right and bottom inset 10 px, plus `env(safe-area-inset-bottom)`. `--st-glass` with `backdrop-filter: blur(16px) saturate(140%)`, a 1 px `--st-glass-border`, radius 18, padding 12 px top, 14 px sides, 10 px bottom. It is an `aria-live="polite"` region (title plus body). Three detents, dragged on y with framer-motion from the card body or the 28x4 px grab handle (tapping the handle toggles default and peek):

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

On the last beat, after the build, the card also shows a second row of two CTAs: "Explore this model" (outline) and "Next: 04 Work Capacity" (solid #019644; the label is `MODULES[i+1].num` plus `label`).

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

**Layout orientation for scenes**: `layout = focusRect.w / focusRect.h < 0.95 ? 'P' : 'L'`. This uses the FOCUS RECT, not the viewport, so desktop (about 1.15) is L and a phone in portrait is P. Scenes choose layout constants from this flag, and the camera director picks the P or L pose.

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

  It shows while the chapter chunk, `document.fonts.ready`, the SDF fonts (drei Text Suspense) and `gl.compileAsync(scene, camera)` complete. It fades out over 300 ms after the first real frame. The intro additionally shows a DOM "WHAT IS FITNESS?" title in the slate, so its first frame is never blank.
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
- **Blob shadow**: one plane with a 64 px radial alpha CanvasTexture, `depthWrite false`, under solids only. No shadow maps, no ContactShadows, no gridHelper anywhere.
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
- **Nodes**: instanced icosahedron (detail 2) spheres. A "live" node's colour is x1.8 with `toneMapped false` (it blooms) only when it is the speaking element.

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
  index.ts            lazy map: view -> () => import('./x/story')
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
- **hold**: timer `hold = clamp(1.5 + 0.24 * words(title + body) - 0.6 * build, 2, 7)` seconds (H.16: reading starts at the caption swap, so part of the build already counts). Then the next beat starts at t = 0. On the last beat the phase becomes `done`, and there is no auto-advance and no chapter auto-advance.
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
  - `gl.compileAsync(scene, camera)` has resolved;
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
- **Explore handoff**: on entering explore, OrbitControls gets `target = pose.target`, and the camera stays where it is.
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
useWorldObstacle(id, { box?, points?, radiusPx?, padPx?, mode? })                       // H.19
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

1. `node C:/Users/ravik/fitness-v2/tools/dashcheck.mjs C:/Users/ravik/fitness-v2/base/src/fitness` must print no dashes.
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

**Chart frame**: `FH` = 10 for v = 1.0, `minAspect` 0.8, `maxAspect` 1.5, margins left 44, bottom 40, top 20, right 16.

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

#### D0 `measured`, build 3.0 (H.16)
- **Caption**:
  - Title: **Power is measurable**
  - Body: "Power is force times distance over time. How much weight, how far, how long: that is a valid measure of fitness." [MODULE_COPY.definition.keyPoints[0] + DEFINITION_TEXT s4, para]
- **Scene**:
  - 0.00 to 0.30: construction. Axes and ticks.
  - 0.34 to 0.48: one dot snaps in at "400m run" (55 s), at the Generalist's `valAt` there.
  - 0.50 to 0.80: dashed chalk dimension lines run from the dot to both axes (a measured point).
- **Camera** (H.21): az 0, el 0, fov 22, exactly front-on. Fit the chart box with the H.5 pad. D1, D3, D4, D5 and explore use the same pose.
- **Labels**: "Power output", "Effort duration"; name "400m run"; ticks.
- **Learning outcome**: one effort gives one measured point: its duration and its power.

#### D1 `curve`, build 5.0 (H.16)
- **Caption**:
  - Title: **Power falls with duration**
  - Body: "At each effort duration there is a highest average power you can hold, and as duration grows that power falls." [POWER_CONCEPT s2, para]
- **Scene**:
  - 0.00 to 0.30: the other nine `POWER_TASKS` dots snap onto the Generalist curve, 70 ms stagger.
  - 0.16 to 0.62: the pen draws the Generalist curve through them in #91C640, 3 px (hot).
  - 0.66 to 0.90: the energy bands fade in under the axis (a callback to chapter 03).
- **Labels**: task names for 1RM clean, 400m run, Mile run and 10k run only (the other six are dots; H.23); band ticks with the three duration strings, kept inside the chart x range.
- **Learning outcome**: the measured points form one falling curve on the same time axis as the energy chapter.

#### D2 `domains`, build 5.5
- **Caption**:
  - Title: **Every modal domain**
  - Body: "CrossFit adds one move: average the curve across every modal domain. The hopper supplies the domains." [POWER_CONCEPT s4 + MODULE_COPY.definition.body s3, para]
- **Scene**:
  - 0.00 to 0.35: the curve fans out in depth into five domain curves (`MODAL_DOMAINS` colours), each with a translucent additive curtain down to its own baseline, so the layers read as slices in depth (H.21).
  - 0.35 to 0.50: hold.
  - 0.50 to 0.90: they converge back (z to 0, tilt to 1) into the single averaged #91C640 curve.
- **Camera**, which reveals domain depth and then returns: `keys` at t 0.35 and 0.5 are L az -30, el 18 and P az -32, el 22, fitting the fanned VOLUME (baseline to the top of the curves, full depth); the beat ends front-on (H.21).
- **Labels**: all five `MODAL_DOMAINS[].name` names are `required`. L: direct labels at the right ends. P: a five-row legend pinned top-right (the right ends crowd at 360 to 430 px; H.21).
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

#### D6 `lineup`, build 5.5
- **Caption**:
  - Title: **The whole curve**
  - Body: "A specialist owns one zone; the generalist defends the whole curve." [MODULE_COPY.definition.body s4, verbatim]
- **Scene**:
  - 0.00 to 0.30: the main chart shrinks, FLIP-style, into row 1 of a ranked column of seven mini area charts (P: 1 column x 7 rows; L: 2 columns, rows ranked top to bottom and left then right). All share one scale.
  - 0.25 to 0.85: the other six fly in, 80 ms stagger. Each mini is a thin extruded slab (`rimStandard`, 0.12 deep) with its area filled and a crisp top pen.
  - 0.30 to 0.98: under each mini a bar grows to its score on one shared 0 to 100 scale, over a faint full-length track, so the ranking reads as a staircase without reading a number (H.22).
  - Order (by `scoreOf`): Generalist CrossFitter 94, Team-sport Athlete 86, Triathlete 84, Marathoner 77, 100m Sprinter 66, Powerlifter 37, Sedentary Adult 33. The Generalist is #91C640; the others are chalk.
- **Camera**: az 0, el 6, fov 22 (front-on with slight relief). Fit the column.
- **Labels**: per row, the name (name tone) plus "94 Broad" style readouts {computed scoreOf and scoreWord}.
- **Learning outcome**: ranked by area, the generalist beats every specialist.

**Label lexicon (definition)**:
- "Power output", "Effort duration";
- `POWER_DURATION_LABELS`, "0.5", "1.0";
- `POWER_TASKS` names;
- `MODAL_DOMAINS` names;
- the `ENERGY_SYSTEMS` duration strings;
- "Generalist, for scale";
- `POWER_CURVES` names;
- scores and `scoreWord` {computed};
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
- [ ] D0 phone: the chart fills the focus rect with a tall aspect; one dot with dashed dimension lines to both axes; ticks readable.
- [ ] D1: ten dots on the curve; task labels readable with no overlaps (some may be hidden by priority, but never clipped); energy bands visible under the axis.
- [ ] Registration: every tick label sits exactly under its sample vertex (within 2 px).
- [ ] D2: five coloured domain curves fanned in depth, with names readable.
- [ ] D3: the area filled with light (MEDIUM/HIGH) or solid (LOW), the crisp curve on top, "AREA = FITNESS" inside, the HUD at 94 "Broad".
- [ ] D5: front-on; dashed chalk Powerlifter curve; red spill particles mid-fall or gone at t = 1 (at t = 1 only the condensed amber sliver and chalk remainder are lit); callouts "ZONE WON" and "AREA LOST"; HUD 37.
- [ ] D6 phone: seven rows ranked 94, 86, 84, 77, 66, 37, 33, with names and scores readable and the Generalist row in yellow-green.

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
15. [ ] **Console**: no errors or warnings from the fitness chunks during a full autoplay of each chapter.
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
