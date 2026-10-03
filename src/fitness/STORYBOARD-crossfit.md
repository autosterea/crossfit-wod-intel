# 07 CROSSFIT (`/fitness/crossfit`): "The prescription and the pyramid" (8 beats)

Storyboard for the lesson's seventh chapter, in the format of DESIGN.md section D. It rebuilds the
July "Module 07 - What Is CrossFit?" page (commit 19f48e5, removed in be4f7d0 because the owner
"did not like how it came out") as a story on the engine. Its one idea worth keeping: the
Theoretical Hierarchy as a physical pyramid where a deficiency at one level makes everything above
it suffer (the signature beat, C6).

Owner brief (2026-10-01): "the UI and explanation was not that great, pls do some research and then
redo the whole stuff like you did for What Is Fitness." So: research first, then explain each part
of the prescription with a picture that teaches it (what makes a movement functional, why intensity
matters, why it is varied, the hierarchy's logic), each beat building on the last.

Status: built (`src/fitness/stories/crossfit/`). Sound: none (the narration is written and recorded
separately; the chapter declares no `narration`, so it has no sound at all, H.72). Every beat leaves
room for about 35 to 45 spoken words in the order its picture builds ("Voice room").

---

## 0. Research (binding sources)

Everything a caption, label or note says restates one of these. Quotes are verbatim and at most one
sentence; the guide's em dashes are rendered " - " (the file's typography rule). The PDF text was
extracted locally (PyMuPDF) and every quote below was string-matched against it, with its printed
page. All URLs resolved 200 on 2026-10-01.

| Key | Verbatim (or the fact) | Source |
|---|---|---|
| R1 prescription | CrossFit is: "constantly varied, high-intensity functional movement." This is our prescription. | Understanding CrossFit, L1 Guide p. 2 |
| R2 aim | We sought to build a program that would best prepare trainees for any physical contingency - prepare them not only for the unknown but for the unknowable. | Understanding CrossFit, L1 Guide p. 2 |
| R3 result | What we have discovered is that CrossFit increases work capacity across broad time and modal domains. | Understanding CrossFit, L1 Guide p. 3 |
| R4 three principles | Every CrossFit workout, in every gym, on every continent, runs on the same three principles: constantly varied, functional movements, and high intensity. | crossfit.com/crossfit-methodology |
| R5 functional (definition) | Functional movements are universal motor recruitment patterns; they are performed in a wave of contraction from core to extremity; and they are compound movements - i.e., they are multi-joint. | L1 Guide p. 2 (already `CF_PILLARS[1].quote`) |
| R6 natural | They are natural, effective, and efficient locomotors of body and external objects. | L1 Guide p. 2 |
| R7 power of functional movement | But no aspect of functional movements is more important than their capacity to move large loads over long distances, and to do so quickly. | L1 Guide p. 2 |
| R8 squat and deadlift | Squatting is standing from a seated position; deadlifting is picking any object off the ground. They are both functional movements. | Foundations, L1 Guide p. 14 (`CF_FUNCTIONAL_QUOTES.natural`) |
| R9 multiple joints | Natural movement typically involves the movement of multiple joints for every activity. | Foundations, L1 Guide p. 14 |
| R10 isolation | The bulk of isolation movements are non-functional movements. By contrast the compound or multi-joint movements are functional. | Foundations, L1 Guide p. 14 |
| R11 one joint | A distinctive feature of these relatively worthless movements is that they have no functional analog in everyday life and they work only one joint at a time. | What Is Fitness? (Part 1), L1 Guide p. 28 |
| R12 replacements | We have replaced the lateral raise with the push press, the curl with the pull-up, and the leg extension with the squat. | Foundations, L1 Guide p. 6 (`CF_FUNCTIONAL_QUOTES.replaced`) |
| R13 core to extremity | At CrossFit we endeavor to develop our athletes from the inside out, from core to extremity, which is, by the way, how good functional movements recruit muscle, from the core to the extremities. | Foundations, L1 Guide p. 8 |
| R14 safe | Functional movements are mechanically sound and therefore safe, and they also elicit a high neuroendocrine response. | Foundations, L1 Guide p. 15 |
| R15 daily | The movements are the ones you already use daily to live: squatting, hinging, pushing, pulling, carrying. | crossfit.com/crossfit-methodology |
| R16 intensity = power | Intensity is defined exactly as power, and intensity is the independent variable most commonly associated with maximizing the rate of return of favorable adaptation to exercise. | L1 Guide p. 2 (`CF_PILLARS[2].quote`) |
| R17 power | Power is defined as the "time rate of doing work." / Power is, in simplest terms, "hard and fast." | Foundations, L1 Guide p. 13 |
| R18 results follow intensity | Increases in strength, performance, muscle mass, and bone density all arise in proportion to the intensity of exercise. | Foundations, L1 Guide pp. 13-14 |
| R19 limits | Pushing one's limits drives new adaptation, and this cannot happen without intensity. | Where Do I Go From Here?, L1 Guide p. 148 |
| R20 relative | It means working hard relative to what your body can do right now. / Intensity is the variable that produces adaptation, which is the technical term for getting fitter. | crossfit.com/crossfit-methodology |
| R21 Fran | 6 ft, 200 lb athlete; 54,225 ft-lb of work; 4:30 (12,050 ft-lb/min) to 2:45 (19,718 ft-lb/min); "60% increase in power" (the table's approximation) | Table 1, L1 Guide p. 35 (`FRAN_TABLE`) |
| R22 work is constant | Power is force times distance (work) divided by time. / The work required to do Fran is constant (force times distance). | L1 Guide p. 36 (`FRAN_TABLE`) |
| R23 no ideal routine | There is no ideal routine! In fact, the chief value of any routine lies in abandoning it for another. | Foundations, L1 Guide p. 12 |
| R24 breadth | The breadth of adaptation will exactly match the breadth of the stimulus. | Foundations, L1 Guide p. 12 |
| R25 margins | Long ago, we noticed that athletes are weakest at the margins of their exposure for almost every measurable parameter. / For instance, if you only cycle between 5 and 7 miles at each training effort you will test weak at less than 5 and greater than 7 miles. / This is true for range of motion, load, rest, intensity, power, etc. / CrossFit workouts are engineered to expand the margins of exposure as broad as function and capacity will allow. | Foundations, L1 Guide p. 14 |
| R26 routine is the enemy | Your body will only respond to an unaccustomed stressor; routine is the enemy of progress and broad adaptation. | What Is Fitness? (Part 1), L1 Guide p. 30 (`VARIANCE_RUT.quote`) |
| R27 variance | Variance is the intended variation of functional movements, loads, repetition schemes, and time durations, within a single workout and across a series of workouts, to best maximize one's fitness. | L2 Training Guide (2017) p. 43 |
| R28 not random | But it's important to re-emphasize that "varied" does not mean "random." | crossfit.com/essentials/what-is-a-crossfit-workout (June 2023) |
| R29 hierarchy order | It starts with nutrition and moves to metabolic conditioning, gymnastics, weightlifting, and finally sport. | What Is Fitness? (Part 1), L1 Guide p. 29 |
| R30 hierarchy logic | This hierarchy largely reflects foundational dependence, skill, and to some degree, time ordering of development. / The logical flow is from molecular foundations to cardiovascular sufficiency, body control, external object control, and ultimately mastery and application. / This model has greatest utility in analyzing athletes' shortcomings or difficulties. | What Is Fitness? (Part 1), L1 Guide p. 29 |
| R31 the rule | We do not deliberately order these components but nature will. If you have a deficiency at any level of "the pyramid" the components above will suffer. | L1 Guide p. 29 (`HIERARCHY_RULE`) |
| R32 nutrition | Proper nutrition can amplify or diminish the effect of your training efforts. | What Is Fitness? (Part 1), L1 Guide p. 28 |
| R33 sport | Sport is the application of fitness in a fantastic atmosphere of competition and mastery. | What Is Fitness? (Part 1), L1 Guide p. 29 |
| R34 100 words | World-Class Fitness in 100 Words (Figure 1). | L1 Guide p. 17 (`HUNDRED_WORDS`) |
| R35 scaling | The needs of an Olympic athlete and our grandparents differ by degree not kind. / We scale load and intensity; we do not change programs. | What Is Fitness? (Part 1), L1 Guide p. 31 (`CF_SCALING`) |
| R36 the three in plain words | The work is never the same for long enough to bore your body, the movements are the ones you already use daily, and the effort is hard enough to make you fitter. | crossfit.com/crossfit-methodology (`CF_PRESCRIPTION.plain`) |

Sources (Notes "Grounded in", `SOURCES` with `for: ['crossfit']`, all URLs distinct): the L1
Training Guide; "Understanding CrossFit" (CrossFit Journal, April 2007,
library.crossfit.com/free/pdf/56-07_Understanding_CF.pdf); "Foundations" (CrossFit Journal, April
2002, library.crossfit.com/free/pdf/Foundations.pdf); the L2 Training Guide
(assets.crossfit.com/pdfs/seminars/CFJ_level2_trainingguide.pdf); crossfit.com "CrossFit
Methodology" and "What Is a CrossFit Workout?".

**Data layer.** The research rows that are not already in the "Module 07 data" section are added to
`fitnessData.ts`, verbatim with their cites, as `CF_PRESCRIPTION`, `CF_FUNCTIONAL_NOTES`,
`CF_INTENSITY_NOTES`, `CF_VARIANCE_NOTES` and `CF_HIERARCHY_NOTES` (each under 3,000 characters so
the caption audit can resolve `fitnessData.X` sources), so fitnessData.ts stays the single source of
truth and the caption audit stays meaningful. Registration adds `MODULES[6]`, `MODULE_COPY.crossfit`,
`CROSS_LINKS.crossfit` and the sources (section 4).

---

## 1. The chapter

**Arc.** Chapter 06 ends on "maximize the area under the curve and hold it for as long as you can".
This chapter is the how: the prescription in one line (C0), then its three parts in the guide's own
order of reasoning (Understanding CrossFit p. 2: functional movements, their capacity for high
power, intensity defined as power, then constantly varied): movements from life (C1) and the swaps
that replaced isolation (C2); intensity as power, measured on Fran (C3); variance and the margins of
exposure (C4). Then where it all sits: the hierarchy built from nutrition to sport (C5), the rule
(C6, signature), and the whole of it in 100 words, one line per level (C7), which ends the lesson.

**One visual grammar for the movement beats (C0 to C2).** A coach's chalk figure drawn by the pen,
in profile or three-quarter view (`figure.ts`: forward kinematics from relative joint angles). The
pose it starts from stays as a dim ghost (pen `dim` 0.36), so every finished frame shows before and
after. A joint that WORKS (its angle changes by 12 degrees or more across the movement, computed
from the pose keyframes, never hand-listed) glows while it turns and keeps a small yellow-green
marker at rest. Count the markers: one joint pair on an isolation move (lateral raise: shoulders;
curl: elbows; leg extension: knees), several on a functional one.

**Colours (PAL only, L8).** Construction, figures and props: chalk. Worked joints and claims:
yellow-green (#91C640, the claim / fitness). Intensity and power: `PAL.both` amber (power is a
"both" skill in chapter 01). The cycling exposure band: `PAL.monostructural` cyan (cycling is
monostructural). Weak margins and the deficiency: `PAL.sick`. Pyramid levels: `HIERARCHY[].color`
(nutrition `PAL.seaGreen` as in the verified data; metabolic conditioning cyan, gymnastics violet,
weightlifting and throwing orange: the same hues as the modal domains in chapters 02 and 04; sport
amber), each a deep lit solid (the body is the hue at half value, the hue lives in the fresnel rim
and a faint emissive), so chalk and mono labels read on every face. Chapter accent (chrome only):
`PAL.gymnastics` violet, the one accent no other chapter uses.

**Composition.** Every station is centred on the origin and read front-on (az 0, el 0) except the
pyramid (a decisive oblique, it is a solid). A beat's subject arrives while the previous one leaves
in the first 12% of the beat (fades, never a camera pan); the camera re-fits in `cam.window`. Phone
portrait first: each station has arrangements chosen from the focus-rect aspect (`layout.ts`; the
scene re-registers its labels when one flips, as Definition's lineup kinds):
- C0 tiles: stacked (`col`, a tall phone), stacked and wider (`colWide`, Safari's squarish rect and
  desktop), in a row only on a very wide rect (aspect over 1.6);
- C1 pair: stacked under aspect 0.8, side by side otherwise;
- C2 table: three rows of two under aspect 1.25 (every phone and desktop), three columns of two on a
  wide rect (a landscape phone), heads above and below the rows there;
- pyramid: portrait or landscape slab sizes.

**HUD chip**: C3 only, "POWER, FT-LB/MIN" plus the power of the block on screen, computed as
`FRAN_TABLE.totalWorkFtLb / minutes` and printed as the table rounds it (12,050 and 19,718 at the
ends).

**Chart frame** (C3, C4): the chapter's own chart frame (`useChartFrame(FRAME_OPTS)`, and the CHART
pose fits `frameFor(FRAME_OPTS).box`), not `StoryDef.frame`, because the chapter's explore model is
the pyramid and the engine's explore checks read `StoryDef.frame` as the explore subject. `FH` 10,
`vMax` 1.24 (headroom over the risen block for the claim), `minAspect` 0.78, `maxAspect` 1.5,
margins l 64, r 28, t 30, b 62.

**Pacing.** Builds 5.0 to 6.5 s (49 s), holds by the C.3 / H.40 rule (about 75 s silent). C6 is the
signature beat (4 s floor). One impact accent: C3 as "60% MORE POWER" lands.

---

## 2. Beats

#### C0 `prescription`, build 5.0
- **Caption**:
  - Title: **The prescription**
  - Body: 'CrossFit is "constantly varied, high-intensity functional movement." It aims to prepare you for the unknown and the unknowable.' [R1 verbatim quote + R2 para]
  - terms: "constantly varied" cyan, "high-intensity" amber, "functional movement" yellow-green (each the colour of its tile).
- **Scene** (moves from frame 1; no pre-roll): three glass tiles, the three parts, in the guide's order
  of reasoning. Each holds a small "before and after" icon, a miniature of the finished frame of the
  beat that will explain it, its name, and the same part in plain words along the tile's foot (R36):
  - 0.00 to 0.30: tile 1 plate; the pen draws the FUNCTIONAL MOVEMENT icon: a chalk figure standing
    beside a box, its seated start pose as a ghost, its hips, knees and ankles marked; name and "THE
    ONES YOU ALREADY USE DAILY" at 0.22.
  - 0.30 to 0.60: tile 2, HIGH INTENSITY: a wide low block outline (ghost, dashed) and the same amount
    of amber light in a narrow tall block; "HARD ENOUGH TO MAKE YOU FITTER" at 0.52.
  - 0.60 to 0.90: tile 3, CONSTANTLY VARIED: a short axis, a narrow bump (ghost, dashed), the band
    widened across the axis and the broad yellow-green plateau it builds; "NEVER THE SAME FOR LONG"
    at 0.82.
- **Camera**: front-on, fov 26, fit the three tiles.
- **Labels**: the three names (name tone, dot in the tile colour, `required`) and their plain-words
  lines (tick, `required`). `sceneWords` 7 (the last tile's words land late).
- **Learning outcome**: CrossFit is one prescription with three parts, each in plain words, and each a
  picture you will now see in full.
- **Voice room** (tile order): "functional movement" at 0.05, "high intensity" at 0.33, "constantly
  varied" at 0.63, the aim (unknown and unknowable) over the finished frame.

#### C1 `functional`, build 6.0
- **Caption**:
  - Title: **Movements from life**
  - Body: "Squatting is standing from a seated position; deadlifting is picking any object off the ground. Both move many joints at once." [R8 s1 verbatim + R9 para]
- **Scene**:
  - 0.00 to 0.12: the tiles leave.
  - 0.04 to 0.20: construction: the ground line, the box (chair height) and a crate on the floor.
  - 0.08 to 0.22: two chalk figures are drawn in by the pen: left seated on the box, right standing
    behind the crate (profile).
  - 0.22 to 0.52: LEFT stands up from the box (hands from the lap, reach forward, rise). Hips, knees and
    ankles glow while they turn (the arms that swing too); the seated pose stays as a ghost. "SQUAT"
    at 0.40.
  - 0.50 to 0.86: RIGHT hinges down to the crate (0.50 to 0.64), grips it and stands (0.66 to 0.86); the
    crate rides up with the hands and its outline stays on the floor, dashed (where it stood). Its
    joints glow; the gripping pose stays as a ghost. "DEADLIFT" at 0.74.
  - 0.86 to 1.00: the markers settle on both figures; the claim "MULTI-JOINT" (yellow-green callout)
    lands under the two names.
- **Camera**: front-on, fov 24, fit the pair (bottom pad 66 px for the names and the claim).
- **Learning outcome**: a functional movement is one life already asks of you (standing up, picking
  something up), and it moves many joints at once.
- **Voice room**: the squat at 0.22 ("standing from a seated position"), the deadlift at 0.50
  ("picking any object off the ground"), "many joints" over the markers at 0.86.

#### C2 `replaced`, build 6.5
- **Caption**:
  - Title: **One joint, or many**
  - Body: "Isolation moves work one joint at a time. CrossFit swapped them: lateral raise to push press, curl to pull-up, leg extension to squat." [R11 para + R12 para]
- **Scene** (a coach's comparison table: each row one swap, left the isolation move, right its
  replacement, an arrow between):
  - 0.00 to 0.12: C1 leaves.
  - 0.02 to 0.14: the heads: "ISOLATION" over "ONE JOINT" (chalk), "FUNCTIONAL" over "MULTI-JOINT"
    (yellow-green); the six figures are drawn in at their start poses, row by row (0.04 to 0.30).
  - row 1, 0.10 to 0.40 (three-quarter view): LATERAL RAISE, the arms rise to the sides, only the
    shoulders glow; the arrow is drawn; PUSH PRESS, dip and drive (hips, knees, ankles) THEN press
    (shoulders, elbows): the work travels from core to extremity [R13].
  - row 2, 0.38 to 0.68: CURL (near profile), only the elbows; arrow; PULL-UP (three-quarter) from a
    hang to the chin over the bar: shoulders and elbows, and the whole body rises.
  - row 3, 0.66 to 0.96 (profile): LEG EXTENSION on its machine, only the knees; arrow; SQUAT, hips,
    knees and ankles (the arms reach forward).
  - every figure keeps its start pose as a ghost; the markers settle as each movement ends.
- **Camera**: front-on, fov 24, fit the table.
- **Labels**: the two heads and sub-heads (`required`; split in two lines because the columns are only
  about 125 px apart on a 390 px phone), the six movement names (name tone, `required`).
- **Learning outcome**: CrossFit replaced each one-joint machine move with a whole-body movement;
  count the joints.
- **Voice room**: "one joint" before 0.10, row 1 at 0.10, row 2 at 0.38, row 3 at 0.66.

#### C3 `power`, build 6.5 (impact accent 0.86 to 0.98)
- **Caption**:
  - Title: **Intensity is power**
  - Body: "Intensity is power, the variable most tied to adaptation. Fran's work is constant, so 4:30 to 2:45 is a 60% increase in power." [R16 para + R22 + R21 conclusion]
  - terms: "Intensity" amber.
- **Scene** (power on the y axis, time on the x axis, as in chapter 04, so WORK is an AREA):
  - 0.00 to 0.12: C2 leaves.
  - 0.04 to 0.22: a hot pen draws the axes as one L stroke; titles "Power (ft-lb/min)" and
    "Time (min)"; tick "0".
  - 0.20 to 0.46: attempt 1. A clock runs from 0:00 to 4:30 (linear, time-true; its readout rides the
    block's moving edge) and the amber block grows behind it at the height of its power: the work done
    so far is the lit area. "4:30" and "12,050" land (0.44); "FRAN" and "WORK 54,225 FT-LB" sit on the
    block (0.40).
  - 0.48 to 0.56: its outline stays behind as a dashed chalk ghost.
  - 0.56 to 0.86: attempt 2. The SAME light is squeezed into 2:45: the right edge slides back (the clock
    readout counts down with it) while the top rises, the area held exactly constant (width x height
    is the work at every frame; QA probe `cf-fran-area`), so the work label never changes while the HUD
    counts the power up to 19,718. "2:45" and "19,718" land (0.80).
  - 0.86 to 0.98: the claim "60% MORE POWER" (yellow-green callout) on the risen top; impact.
- **Camera**: az 0, el 0, fov 22, the chart frame (L12: a comparison of two heights).
- **Labels**: axis titles, "0", "2:45", "4:30", the clock {computed}, "12,050" (over the ghost's right
  end), "19,718" (beside the risen corner), "FRAN", "WORK 54,225 FT-LB", "60% MORE POWER". The table's
  own "60%" is quoted, not recomputed: 19,718 / 12,050 is 1.64, and the guide prints "60% increase in
  power" under "Change (approx.)".
- **Learning outcome**: intensity is not a feeling; it is power, work over time, and doing the same
  work faster is measurably more power.
- **Voice room**: "power is work divided by time" over the axes, "four thirty" as the first block
  completes (0.46), "same work, less time" through the squeeze (0.56), "sixty percent" at 0.86, and
  why it matters (adaptation) over the finished frame.

#### C4 `varied`, build 6.0
- **Caption**:
  - Title: **Routine is the enemy**
  - Body: "Cycle only 5 to 7 miles and you test weak below 5 and above 7. Varied work widens the margins of exposure." [R25 s2 para + s4 para]
  - terms: "5 to 7 miles" cyan, "weak" red.
- **Scene** (the same axes, re-titled):
  - 0.00 to 0.14: the Fran blocks and their labels leave; the axes stay; the titles become "Capacity"
    and "Miles per effort".
  - 0.10 to 0.30: the exposure band from 5 to 7 miles pours up in a faint cyan; ticks "5" and "7";
    "EXPOSURE".
  - 0.22 to 0.46: a hot pen draws the capacity curve: strong across the band, falling away outside it
    (schematic, no numbers on this axis). "WEAK" (red) at both margins at 0.40.
  - 0.52 to 0.86: VARY. The band widens across the axis; the curve broadens into a plateau and turns
    yellow-green; the narrow curve stays as a dashed ghost; the WEAK labels leave.
  - 0.86 to 1.00: the claim "BROAD STIMULUS, BROAD ADAPTATION" [R24 para].
- **Camera**: unchanged (front-on chart).
- **Learning outcome**: you only adapt to what you are exposed to; varying the work widens what you
  are strong at.
- **Voice room**: the 5 to 7 band at 0.10, "weak below five and above seven" at 0.40, "widen the
  margins" at 0.52, "breadth in, breadth out" over the claim.

#### C5 `pyramid`, build 5.5
- **Caption**:
  - Title: **Built from the bottom**
  - Body: "Nutrition, then metabolic conditioning, gymnastics, weightlifting and throwing, and sport: from molecules to mastery." [R29 + R30 s2 para]
  - terms: each level in its slab colour. (The body fits three lines with its Read more at 390 px, so
    the card height, the focus rect and the camera are the same either side of the C4 and C6
    boundaries.)
- **Scene**:
  - 0.00 to 0.12: the chart leaves.
  - 0.00 to 0.30: the camera moves to the oblique pyramid pose (a solid: L6, a new dimension).
  - 0.08 to 0.90: five slabs drop and snap into place, bottom to top, each flashing as it lands (the
    speaking element); a soft blob shadow grounds the base. Each is named on its front face as it
    lands: the level just above the face's centre, its role in the guide's logical flow just below
    (screen-space gaps, so the pair fits however small the slab is drawn).
- **Camera**: L az -22, el 18, fov 28; P az -16, el 20. Fit the pyramid plus room for the claims.
- **Labels**: names = `HIERARCHY[].label`; roles = `HIERARCHY[].role` ("Molecular foundations",
  "Cardiovascular sufficiency", "Body control", "External object control", "Mastery and
  application", the guide's p. 29 wording).
- **Learning outcome**: development has an order, and each level rests on the one below it.
- **Voice room**: one level per 0.16 of the build, bottom to top, from 0.08.

#### C6 `deficiency`, build 6.0 (signature beat)
- **Caption**:
  - Title: **Everything above suffers**
  - Body: "We do not deliberately order these components but nature will. A deficiency at one level makes every level above it suffer." [R31 s1 verbatim + s2 para]
  - terms: "deficiency" red.
- **Scene** (the deficient level is gymnastics, the middle, so the rule's direction shows: two
  levels below stay whole, two above suffer):
  - 0.06 to 0.34: the gymnastics slab is crushed (its height to 55%), a crack is drawn across its
    face by a hot red pen, and its colour sinks toward a dark `PAL.sick`. "DEFICIENCY" (red callout,
    leadered to the crack) at 0.16.
  - 0.30 to 0.80: the two slabs above sink with it, lean off level and slide, and dim toward the slate
    (their labels to 45%). Each slab sits on the top of the one below, so the lean is physical.
    Nutrition and metabolic conditioning stay level and bright.
  - 0.82 to 0.94: the claim "THE COMPONENTS ABOVE WILL SUFFER" (R31 fragment, chalk callout) over the
    leaning top.
- **Camera**: unchanged.
- **Learning outcome**: a weakness low in the pyramid limits everything built on it; fix the base
  first.
- **Voice room**: "nature will" over the crush (0.06), "everything above" as the lean runs (0.30).

#### C7 `hundred`, build 6.5
- **Caption**:
  - Title: **Fitness in 100 words**
  - Body: "Eat meat and vegetables. Lift, master gymnastics, bike, run, swim and row hard and fast. Mix them, keep it short and intense, play sports." [R34 para]
- **Scene**:
  - 0.00 to 0.22: repair: the crack closes, the crushed slab regains its height, the upper slabs level
    and brighten; C6's callouts leave.
  - 0.22 to 0.86: bottom to top, each level lights (an HDR swell) and its line of the 100 words becomes
    its first line, the level's name moving under it: "EAT MEAT AND VEGETABLES" / Nutrition, "BIKE,
    RUN, SWIM, ROW" / Metabolic Conditioning, "MASTER THE BASICS" / Gymnastics, "TRAIN THE MAJOR
    LIFTS" / Weightlifting & Throwing, "PLAY NEW SPORTS" / Sport.
  - 0.88 to 0.98: the claim "WORLD-CLASS FITNESS" (yellow-green callout) over the apex.
- **Camera**: unchanged.
- **Learning outcome**: the whole method fits on the pyramid: eat, condition, control your body,
  control objects, play; mix it, keep it short and intense.
- **Voice room**: bottom to top, one line per 0.13 of the build from 0.22.
- The finished beat is the end of the lesson: [Explore this model] [Back to overview], the eyebrow
  "End of the lesson" or "Lesson complete", Next disabled (H.57, now on this chapter).

---

## 3. Lexicon, explore, acceptance

**Label lexicon (crossfit)**:
- "FUNCTIONAL MOVEMENT", "HIGH INTENSITY", "CONSTANTLY VARIED", "THE ONES YOU ALREADY USE DAILY",
  "HARD ENOUGH TO MAKE YOU FITTER", "NEVER THE SAME FOR LONG" (R36);
- "SQUAT", "DEADLIFT", "MULTI-JOINT";
- "ISOLATION", "ONE JOINT", "FUNCTIONAL", "MULTI-JOINT", "LATERAL RAISE", "PUSH PRESS", "CURL",
  "PULL-UP", "LEG EXTENSION", "SQUAT";
- "Power (ft-lb/min)", "Time (min)", "0", "2:45", "4:30", the clock {computed m:ss}, "12,050",
  "19,718", "FRAN", "WORK 54,225 FT-LB", "60% MORE POWER", HUD "POWER, FT-LB/MIN" {computed};
- "Capacity", "Miles per effort", "5", "7", "EXPOSURE", "WEAK", "BROAD STIMULUS, BROAD ADAPTATION";
- `HIERARCHY[].label`, `HIERARCHY[].role`, "DEFICIENCY", "THE COMPONENTS ABOVE WILL SUFFER";
- "EAT MEAT AND VEGETABLES", "BIKE, RUN, SWIM, ROW", "MASTER THE BASICS", "TRAIN THE MAJOR LIFTS",
  "PLAY NEW SPORTS", "WORLD-CLASS FITNESS";
- explore: "Level", "Deficiency in {level}", "Suffers above it", "Nothing above: the apex", "Repair
  all", the level names, roles and details (`HIERARCHY`), R31 and R30 s3 as notes.

**SDF (crossfit)**: none (the claims are callouts; the self-hosted SDF glyph whitelist has no hyphen
for "WORLD-CLASS").

**Explore (crossfit)**: the pyramid as an instrument (the July page's best idea, now on the engine).
- Peek: level chips (the five `HIERARCHY` labels, a real radiogroup).
- Expanded: "Deficiency in {level}" slider (0 to 100%, the level's colour, 44 px hit band), "Suffers
  above it" (the levels above it, computed; the apex has nothing above it), the level's role and
  detail, "Repair all", the rule (R31) and "This model has greatest utility in analyzing athletes'
  shortcomings or difficulties." (R30).
- Scene: every level carries its own deficiency (damped); a level is crushed by its own deficiency
  and suffers (sinks, leans, dims) by the worst deficiency anywhere below it, so the levels below the
  picked one never react. The picked level is named in its colour with a dot. Orbit az +/-40 and el
  -12 to +22 around the pose.
- Seeded from the beat the viewer left: from C6 the story's deficiency (gymnastics, 70%); otherwise a
  whole pyramid.

**Acceptance (crossfit)** (results in section 5):
- [x] C0 phone (390 x 664 first): three tiles, each icon legible as a before and after, names and
      plain words readable at 360.
- [x] C1: two figures in clean profile, the seated and gripping ghosts dim, markers on hips, knees and
      ankles of both, "SQUAT", "DEADLIFT", "MULTI-JOINT".
- [x] C2: six figures; exactly one marked joint pair on each isolation figure, several on each
      replacement; six names and both heads readable at 360.
- [x] C3: the block's area equals the work at every t, readouts 12,050 and 19,718, the clock, HUD
      counting, "60% MORE POWER".
- [x] C4: band 5 to 7 then the whole axis; ghost bump; "WEAK" twice before the widening, the claim
      after.
- [x] C5: five slabs, bottom to top, ten face labels readable at 360.
- [x] C6: gymnastics crushed and cracked, the two above leaning and dim, the two below level and
      bright, the claim readable; holds at least 4 s.
- [x] C7: the pyramid whole again, five lines of the 100 words, "WORLD-CLASS FITNESS"; the lesson ends
      here.
- [x] `?beat=N&t=X` equals seeking; (N, 1) equals (N + 1, 0).
- [x] Real-GPU black-frame check: 0 black frames, story and explore, tier high.
- [x] Explore: chips, slider, repair; the levels above the picked one react, the ones below do not.

---

## 4. Registration and shell (what changed outside the chapter folder)

- `lessonTypes.ts`: `ModuleKey` gains `'crossfit'`.
- `fitnessData.ts`: `MODULES[6]` (num '07', label "What Is CrossFit?", mobileLabel "CrossFit", title
  "What Is CrossFit? The Prescription and the Pyramid", accent `PAL.gymnastics`),
  `MODULE_COPY.crossfit` (Read more and Notes; restates section 0), `CROSS_LINKS.crossfit`, the
  research constants (section 0), and sources (`ALL` now includes crossfit; five crossfit sources with
  distinct URLs, so the intro hub's source list keeps unique keys).
- The chapter order (`playback.ts`, `CaptionCard`, `TopBar`, `ChapterSheet`, `Transport`) is derived
  from `MODULES`, so Health's finished beat now offers "Next: 07 CrossFit", Next on Health's last beat
  goes to this chapter, and the lesson's end (the disabled Next, Back to overview, Lesson complete)
  moves here. The top bar and the chapter sheet list seven chapters; the progress hairline has seven
  segments.
- `story/ui/ChapterGlyph.tsx`: a pyramid glyph for 'crossfit' (append-only: a new case).
- `story/audio/bed.ts`: a chapter key for 'crossfit' (C; `KEYS` is a `Record<FitnessView, ...>`, so
  the type requires it). Dormant: the chapter declares no narration, so it has no sound.
- The intro is left as it is (owner decision pending): its six-tile map, its explore chips and its
  hub list keep the six models (`stories/intro/models.ts`, `MAP_MODULES`; nothing else changes).
- `scripts/seo-routes.mjs`: `/fitness/crossfit` title and description.

---

## 5. Build notes and results (2026-10-01)

**Changes from the first draft of this storyboard, made while building** (phone first, Safari's
390 x 664 before 390 x 844):
- C0 gained the plain-words line per tile (R36): the icons alone previewed, the words explain.
- C1's "MULTI-JOINT" moved from a leader on the deadlift (it sat on the gripping ghost) to under the
  two names; the crate's dashed path became its dashed outline left on the floor (clearer "off the
  ground"); the sit-to-stand arms swing as people stand up (honestly marked).
- C2's heads split into name and sub-head: one-line heads collided on a 390 px phone.
- C3: the workout's name moved from a pinned chip (it pushed the axis title out on short phones) onto
  the block, over its work; a running clock rides the block's edge; `vMax` 1.24 for the claim.
- The pyramid became deep lit solids (bright saturated slabs made the mono sub-lines unreadable), its
  face labels use screen-space gaps (the last beat's CTA row shrinks the stage), and C7 makes each
  line of the 100 words the face's first line.
- C5's body lost "finally" so its Read more stays on the third line at 390 px (a fourth line changed
  the card height and re-fitted the camera at both of its boundaries).
- The C3 and C4 chart frame is chapter-local (see section 1).

**Results** (static build, SwiftShader unless noted):
- `npx tsc -b`: clean for this chapter and every file it touches (the only errors in the worktree are
  the Technique builders' in-progress `story/kit/athlete/`).
- `node scripts/fitness-gate.mjs`: all gates passed; the eight beats audit at 85 to 100% cited words.
- `story-qa check crossfit`: see the report of the run (labels at 360 / 390 / 430 and the Safari
  viewports, budget, continuity, scrub, navback, persist, keys, reduced motion, shell, hit bands,
  tiers, explore re-fit, fontfail, reading, touch, queue, determinism).
- Determinism: deep links equal seeks at a mid-beat t of every beat (scene pixels identical; a
  one-pixel layout offset at most); continuity (N, 1) against (N + 1, 0) is 0.000% at all seven
  boundaries (desktop, fixed focus rect).
- Real GPU (headless Chromium, ANGLE d3d11, tier high, 4x MSAA and bloom): 0 black of 200 story
  frames (T 0 to 7.96 by 0.04) and 0 black of 13 explore frames (every level at 100% and 40%, repair,
  orbit).
- Regression: the seven existing chapters load and autoplay; Health ends on "Next: 07 CrossFit"; the
  intro keeps six tiles; the chapter sheet lists seven chapters; the lesson now ends on this chapter.
