# 08 TECHNIQUE (`/fitness/technique`): "Technique" (Glassman's essay, 10 beats)

Storyboard for the lesson's eighth chapter, after 07 What Is CrossFit, in the format of DESIGN.md
section D, with a spoken paragraph per beat (H.74, H.75). Status: storyboard only; nothing is built.
Builders implement what is written here; constants marked "start" may be tuned by up to 15%.

Owner brief (2026-10-01): the lecture is Greg Glassman's dedicated article "Technique" (CrossFit Level
1 Training Guide pp. 40-44, adapted from his Dec. 1, 2007 L1 lecture; CrossFit Journal "Technique, Part
1", Feb. 1, 2008). In his words it is about "threshold training", "safety, efficacy, and efficiency",
"the relation of mechanics, consistency and intensity, the charter", and "it defines the technique with
a graph, and when it deviates, what is a deviation". It is NOT a tour of the nine foundational
movements (a first draft of this storyboard was; that structure is dropped). The chapter follows the
article's order and arguments, one idea per beat, each built on the last, mostly as charts and
diagrams in the lesson's style. The side-view athlete appears only where the article's point is a
body whose mechanics deviate under load or speed.

Rules kept throughout: captions restate `fitnessData.ts` (existing exports plus the four article blocks
of section 7.2, all verbatim with cites); quotes are verbatim and at most one sentence; no invented
numbers; plain hyphens only. Every number this chapter shows is the article's own: 2, 6, 9, 10, 20,
32, 50, 10,000, 12,000 and 14,000.

Contents: 0 The article, as read. 1 What the July page got wrong. 2 The chapter. 3 Beats T0 to T9.
4 Lexicon and SDF. 5 Explore. 6 Acceptance. 7 Notes for builders. 8 Source ledger. 9 Owner flags
and data gaps.

---

## 0. The article, as read (binding)

Read from the guide's PDF (3rd ed., 2020, V6E3OL-20201212KW; printed pages), text extracted locally
and every quote string-matched against it. The article ends on p. 44. Its only figure is Figure 1
(p. 42). The charter itself is the article's p. 40 pull quote and the Scaling CrossFit article (p. 77).

| Page | The argument, in the article's order | Beat |
|---|---|---|
| p. 40, para 1 | What is behind the program is the quantification of fitness: a number on fitness, work capacity across broad time and modal domains, the area under the work-capacity curve. | T0 (the efficacy lane's area is the lesson's own curve) |
| p. 40, para 2 | Evidence-based fitness: measurable, observable, repeatable data. Three meaningful components judge a program: safety, efficacy, efficiency. | T0 |
| p. 40, paras 3-5 | Efficacy is the return (for CrossFit, work capacity). Efficiency is the time rate of that adaptation (50 pull-ups in six months or nine years). Safety is how many people end up at the finish line (10 start: two become the fittest on Earth, eight die); the real tragedy is not knowing the safety numbers. | T0 |
| p. 40, para 6 | The three vectors point in the same direction, not entirely at odds. Safety rises if efficacy and efficiency go to zero; efficiency rises with intensity, possibly compromising safety; losing people damages efficacy. They give all you need to assess a program. | T1 |
| p. 40, para 7 | Choosing work capacity as the standard of efficacy necessitates the qualification of movement. | T2 |
| p. 40, pull quote | Learn the mechanics, establish a consistent pattern, and only then ratchet up the intensity. | T5 |
| p. 41, paras 1-6 | Four terms qualify movement: mechanics (the physics), technique (the method to success), form (the normative value, good or bad, applied to mechanics and technique), style (a signature with no bearing on the others). This is how you move. | T2 |
| p. 41, paras 7-8; Figure 1, p. 42 | Power is the successful completion of functional movement. The graph: work completed on the X axis, energy expended on the Y axis. Inefficient: a lot of energy, very little work. Ideally: little energy, maximum work. Technique is what maximizes the work completed for the energy expended. | T3 |
| pp. 41-42 | Two people loading sandbags: the one who knows how to lift does more work. Strength is the productive application of force. | voice room only (section 9) |
| p. 42, paras 3-6 | Technique is the heart of maximizing safety, efficacy and efficiency. Safety: one pops a hip and gets under it (a clean), the other pulls with a rounded back. Efficacy: more work, faster development. Efficiency: the result quickly. | T4 (safety), T9 (all three) |
| p. 43, para 1 | Technique is an intimate part of safety, efficacy and efficiency. | T9 |
| p. 43, paras 2-6 | Typing, shooting, the violin, NASCAR and CrossFit tie proficiency to speed: a typist at 20 words a minute is never hired; a perfectly exquisite Fran is worthless if it takes 32 minutes. "Good form or quickly?" is a false choice: technique and speed are not at odds; it is an illusion. | T6 |
| p. 43, paras 7-10 | Speed is learned through errors; perfect technique means low intensity; the errors are an unavoidable consequence of development; letting the errors broaden, then reducing them without reducing the speed, is threshold training. | T7 |
| p. 44, paras 1-2 | In a workout: speed up while it looks good; when it falls apart, do not slow down, fix it at that speed; advance the margins at which form falters. | T7, T8 |
| p. 44, paras 3-4 | The worked example: perfect at 10,000 foot-pounds per minute, falling apart at 12,000; work that band until 12,000 is great; then 14,000 suffers and is narrowed in. | T8 |
| p. 44, paras 5-9 | We are the technique people; every domain where speed matters has technique at its heart (the shot put); technique is everything: no power, no productive force, no efficiency, no safety without it; the paradox is only perceived. | T9 |
| p. 77 (Scaling CrossFit) | The charter: mechanics, consistency, then and only then intensity; movements correct and consistent before load and speed; ignoring the order risks injury and blunted progress, especially when poor mechanics are combined with load. | T5 |

---

## 1. What the July page got wrong (and this chapter does not repeat)

- It was a reference page: nine movements looping with every cue at once, three modes behind
  toggles and a wall of text below. Here: one argument in ten narrated beats.
- Its labels were drei `<Html>` pills that scaled with depth (now banned, L7), all in the
  weightlifting orange. Here: DOM labels on the engine's type scale, colours that mean one thing.
- Its 3/4 orbit camera made angles unreadable. Here: every beat is front-on (az 0, el 0).
- Its threshold dial invented a form percentage and a sine wobble. Here: the article's own worked
  example in its own numbers, and the article's own named deviation.
- Its charter was three coloured boxes the figure climbed. Here: a timeline where intensity stays
  flat until mechanics and consistency are done.
- Its figure keyframed joint positions (limbs stretched, feet slid). The new rig
  (`story/kit/athlete/rig.ts`) is joint-space with planted feet.

---

## 2. The chapter

**One chapter, not two.** The article is one argument: measure fitness, judge programs by safety,
efficacy and efficiency, so movement quality matters, the graph defines technique, a deviation costs
safety, hence the charter, yet speed is not the enemy, threshold training moves the margin, technique
is everything. The second half (speed, threshold) leans on the first (the graph, the charter), so a
split would cut it at its hinge. Ten beats: 57.5 s of build, about 90 s silent, about 2 min 40 s with
the voice (423 spoken words).

**Arc.** T0 three tests of a program, T1 they align but trade off, T2 measuring work makes how you
move matter, T3 the graph that defines technique, T4 what a deviation is, T5 the charter, T6 speed is
not the enemy, T7 threshold training, T8 the worked example (signature), T9 technique is everything.
Callbacks: T0's efficacy lane is chapter 04's area; T5 opens on chapter 07's "intensity is power"; T6
names Fran, whose power chapter 07 measured; T8 names T7's path in numbers; T9 returns to T3's graph.

**Colour meaning (PAL only, L8).**
- Chalk #eef3f6: construction (axes, baselines, boxes) and the athlete's body.
- #91C640: technique, good form, the claim. It is also EFFICACY's verified colour (`SEE[1].color`,
  the return in work capacity, i.e. fitness), so in T0, T1 and T9, where efficacy is on screen, the
  beat's claim is a chalk callout, never lime.
- `SEE[0].color` #f43f5e: SAFETY. `SEE[2].color` #38bdf8: EFFICIENCY. Both verified data colours.
- `PAL.both` #f4b740 amber: intensity, power and speed (as in chapter 07, C3).
- `PAL.sick` #ef4444: a deviation, falling apart, risk.
- Dashed chalk: the comparison (the inefficient arrow, the slow line, the deviating ghost, the
  either-or line).
- Safety rose and deviation red are neighbours: no frame shows a SAFETY mark next to a deviation
  mark without both words (T4 shows no S/E/E colour at all).

**Composition.** One engine chart frame for the whole chapter (`StoryDef.frame`): FH 10, minAspect
0.62, maxAspect 1.5, marginPx l 48, r 24, t 24, b 48 (start). Every diagram is authored in chart space
(u, v from 0 to 1 across the frame box). Where a beat has two parts (T4, T7, T8), `stacked = FW / FH <
0.85` (390 x 844, 360 x 780, 430 x 932) stacks them; otherwise they sit side by side (the owner's 390 x
664 Safari phone, desktop). Phone portrait first: everything, athlete and labels included, lives in
the frame box, which the camera fits above the caption card.

**Camera.** One pose for every beat and for explore: `CHART` = az 0, el 0, fov 22, fit the frame box,
pad as Definition's (H.5). There are no camera moves (L6): every subject is flat, and the athlete is
a side view in the chart plane (the rig's x forward, y up; az 0 sees its right side). Beats hand off
inside the frame (fades and FLIPs in the first 12% of t), never with a pan.

**The athlete (kit `story/kit/athlete/`): T4, T7 and T8 only.**
- Movement: lifting a heavy object from the floor by the clean, the article's own example ("pop a
  hip and get under it (clean)", p. 42), performed as the medicine-ball clean (`MOVEMENTS` 'mb-clean';
  guide p. 208), the guide's teaching clean for "all objects we might desire to heave from ground to
  chest" (p. 128).
- Deviation: "pull with a rounded back" (p. 42), the only body deviation the article names: the
  lumbar curve lost in the pull. In the rig: `PoseParams.lord` from 40 (neutral) toward -20 (rounded,
  "negative rounded" in rig.ts), the hips rising ahead of the chest. The guide also lists "losing back
  extension" among the medicine-ball clean's faults (p. 130).
- T4 is the article's scene (two people, a heavy object: load). T7 and T8 put the same body under the
  threshold passage ("Now the movement starts falling apart", p. 44: speed). The article names no
  movement there; the pairing is ours (section 9, flag 1).
- Not used in this chapter: plumb line, bar path, hip and knee angle arcs, the hip-crease line, the
  barbell, the front view.

**Pacing.** Builds 5.0 to 6.5 s. Holds by C.3 and H.40 (`sceneWords` per beat). T8 is the signature
beat (4 s floor) and carries the chapter's single impact accent. No HUD chip: every number is a tick
on a chart. One SDF claim, "TECHNIQUE IS EVERYTHING" (T9; no hyphen, so the self-hosted glyph set
covers it).

**Determinism (L5).** All motion is a function of T, the athlete's repetitions included: in T7 and T8
the rep phase is a continuous piecewise-linear function of beat t whose slope is set by the speed
level of each window (closed form, no accumulation), so a tempo change never makes the phase jump.
(The ambient clock A cannot do this: changing a rate on A jumps the phase.) Each beat's phase lands on
the pull at t = 1, so every held frame, deep link and reduced-motion frame shows the back's state.

---

## 3. Beats

Format: id and build; caption (title and body) with its `source` string for `story.ts` and the passage
in brackets; terms; Scene windows in beat t; Camera; Labels; Learning outcome; Voice (the
narration.json paragraph, its source and its sync anchors `[t, at, offset]`, H.74). Every anchor
phrase occurs once in its paragraph and the anchors rise in t and in text order (checked).

#### T0 `judge`, build 6.0
- **Caption**:
  - Title: **Return, rate, finish line**
  - Body: "Judge a program by evidence: efficacy is the return, efficiency its time rate, safety how many
    people end up at the finish line." `source: 'fitnessData.SEE + fitnessData.TECHNIQUE_SEE'`
    [SEE[0] to SEE[2].definition, para; evidence-based fitness, p. 40]
  - terms: "efficacy" yellowGreen, "efficiency" practiced, "safety" phosphagen (the SEE hexes).
- **Scene** (moves from frame 1). Three lanes, top to bottom in the article's order of explanation:
  EFFICACY v 0.68 to 0.98, EFFICIENCY v 0.35 to 0.65, SAFETY v 0.02 to 0.32; each a chalk baseline
  from u 0.04 to 0.96 (time runs left to right, L11), named at its top left.
  - 0.00 to 0.10: the three baselines draw (pen, 60 ms stagger, chalk 55%).
  - 0.12: "EFFICACY: THE RETURN" lands. 0.12 to 0.20: a small work-capacity curve (kit `curveGlyph`
    of the Generalist samples, chapter 04's curve) draws in dashed chalk at 70% of the lane height
    over u 0.30 to 0.92 (before). 0.20 to 0.30: the same curve at full lane height draws in lime (hot
    head). 0.26 to 0.36: the band between them sweeps in left to right (`AreaFill` with a bottom
    curve, lime gradient): the return. "WORK CAPACITY" at 0.34.
  - 0.38: "EFFICIENCY: TIME RATE". 0.40 to 0.46: a dashed chalk goal line across the lane top, "50
    PULL-UPS". 0.46 to 0.52: a blue line rises from the lane start to the goal in six months, to scale
    on a 0 to 9 year lane (it reaches the goal at 1/18 of the lane's length, so it is nearly vertical),
    hot head, tick "6 MONTHS". 0.52 to 0.62: a dashed chalk line rises to the same goal across the
    whole lane, tick "9 YEARS".
  - 0.64: "SAFETY: WHO FINISHES". 0.64 to 0.68: a chalk start line at u 0.06 and a finish line at u
    0.92, "FINISH LINE". 0.68 to 0.90: ten rose dots (`Nodes`) leave the start together and run right;
    eight stop one by one (at u 0.22, 0.30, 0.37, 0.45, 0.52, 0.60, 0.68 and 0.76) and become hollow
    rings at 35%; two cross the line (0.86 to 0.90) and flare (the speaking element). 0.92 to 1.00: the
    readout "2 OF 10" at the finish line.
- **Camera**: `CHART`.
- **Labels**: callouts "EFFICACY: THE RETURN" (lime), "EFFICIENCY: TIME RATE" (blue), "SAFETY: WHO
  FINISHES" (rose), all `required`; name "WORK CAPACITY"; ticks "50 PULL-UPS", "6 MONTHS", "9 YEARS",
  "FINISH LINE"; readout "2 OF 10".
- **Learning outcome**: a program is judged by evidence on three counts: what it returns, how fast,
  and how many people get there.
- **Voice** (45 words; source `TECHNIQUE_SEE`, p. 40, paras 2-5): "Three things judge any fitness
  program. Efficacy is the return: for CrossFit, more work capacity. Efficiency is its time rate: fifty
  pull-ups in six months, or in nine years. Safety is how many people reach the finish line. Not
  knowing that is the real tragedy."
  - Sync: [0.1, "program.", 0.1], [0.12, "Efficacy", -0.1], [0.2, "return:", 0], [0.34, "capacity.",
    0.1], [0.38, "Efficiency", -0.1], [0.46, "fifty", -0.1], [0.52, "six months,", 0.1], [0.62, "nine
    years.", 0.2], [0.64, "Safety", -0.1], [0.68, "reach", -0.1], [0.9, "line.", 0.3], [0.92, "Not
    knowing", -0.1], [1, "tragedy.", 0.3]
- `sceneWords` 12.

#### T1 `vectors`, build 6.0
- **Caption**:
  - Title: **Three vectors, one direction**
  - Body: "Safety, efficacy and efficiency point the same way, yet trade off: intensity can compromise
    safety; losing people damages efficacy." `source: 'fitnessData.SEE_VECTORS + fitnessData.TECHNIQUE_SEE'`
    [SEE_VECTORS.quote, para; p. 40, para 6]
  - As built (fits three lines at 390 px, so the card never grows at the T0 to T1 boundary): "All three point the same way, yet trade off: intensity can compromise safety; losing people damages efficacy."
  - terms: "Safety" phosphagen, "efficacy" yellowGreen, "efficiency" practiced, "intensity" both.
- **Scene**. One origin O and three arrows (pen 3 px plus a two-stroke head) in the SEE colours, base
  length L. Side by side: O (u 0.14, v 0.12), L = 0.6 FH, angles from +x SAFETY 54, EFFICACY 47,
  EFFICIENCY 40 degrees. Stacked: O (u 0.18, v 0.08), L = 0.55 FH, angles 74, 67, 60 (start).
  - 0.00 to 0.12: T0 folds: each lane's coloured element (the lime band, the blue line, the two
    finishing dots) shrinks toward O while the rest fades (focus 0.35 first).
  - 0.04 to 0.20: the three arrows grow from O to L, 60 ms stagger; each tip's name lands as it
    completes.
  - 0.20 to 0.28: the chalk callout "SAME DIRECTION" on the bundle at 0.75 L (chalk: see colour
    meaning).
  - 0.28 to 0.46 (p. 40, first trade-off): EFFICACY and EFFICIENCY shrink to zero (their heads become
    6 px rings at O) while SAFETY grows to 1.4 L (hot head); tick "DOWN TO ZERO" by O at 0.36.
  - 0.46 to 0.50: all three return to L.
  - 0.50 to 0.68 (second): an amber chevron turns up beside EFFICIENCY, tick "INTENSITY UP" at 0.56;
    EFFICIENCY grows to 1.4 L while SAFETY shrinks to 0.45 L.
  - 0.68 to 0.72: all return to L.
  - 0.72 to 0.88 (third): SAFETY shrinks to 0.45 L, tick "LOSING PEOPLE" at its tip at 0.76, and
    EFFICACY follows it down to 0.55 L (0.78 to 0.88).
  - 0.88 to 1.00: all three return to L, aligned; "SAME DIRECTION" brightens. Lengths only: no value
    is ever shown.
- **Camera**: `CHART`.
- **Labels**: names "SAFETY", "EFFICACY", "EFFICIENCY" at the tips (prefer 'radial' from O,
  `required`); callout "SAME DIRECTION" (chalk); ticks "DOWN TO ZERO", "INTENSITY UP", "LOSING PEOPLE",
  each only inside its window.
- **Learning outcome**: the three aims mostly agree, but pushing one too far costs another, so a
  program is judged on all three.
- **Voice** (40 words; source `SEE_VECTORS.quote`, `TECHNIQUE_SEE`, p. 40, para 6): "These three vectors
  point in the same direction. Turn efficacy and efficiency down to zero, and safety soars. Turn up
  the intensity for efficiency, and you may compromise safety. Lose people, and you damage efficacy.
  Together, they assess any program."
  - Sync: [0.04, "vectors", -0.1], [0.2, "same direction.", 0], [0.28, "Turn efficacy", -0.1], [0.36,
    "zero,", 0], [0.46, "soars.", 0.2], [0.5, "Turn up", -0.1], [0.68, "compromise safety.", 0.2],
    [0.72, "Lose people,", -0.1], [0.88, "damage efficacy.", 0.2], [1, "any program.", 0.2]
- `sceneWords` 7.

#### T2 `quality`, build 5.0
- **Caption**:
  - Title: **Quantity needs quality**
  - Body: "Measured by work capacity, how you move matters: mechanics is the physics, technique the
    method, form good or bad, style a signature." `source: 'fitnessData.TECHNIQUE_SEE + fitnessData.TECHNIQUE_TERMS'`
    [p. 40, para 7; p. 41, paras 1-5, para]
  - As built (fits three lines at 390 px): "Measured by work capacity, movement matters: mechanics is physics, technique the method, form good or bad, style a signature."
- **Scene** (the four terms and how they relate). TECHNIQUE: a rounded rectangle (chalk pen 2 px), side
  by side u 0.08 to 0.66, v 0.10 to 0.80; stacked u 0.06 to 0.94, v 0.32 to 0.86. MECHANICS inside it:
  side by side u 0.16 to 0.58, v 0.18 to 0.50; stacked u 0.14 to 0.86, v 0.40 to 0.62. FORM: a bar as
  wide as TECHNIQUE, 0.05 tall, lying on its top edge, left half lime, right half red. STYLE: a dashed
  chalk box apart (side by side u 0.74 to 0.96, v 0.30 to 0.62; stacked u 0.28 to 0.72, v 0.04 to
  0.24) holding three short chalk squiggles (three lifters' bar paths, the article's example of a
  signature, p. 41), joined to TECHNIQUE by a dashed connector.
  - 0.00 to 0.16: SAFETY and EFFICIENCY fade; the EFFICACY arrow swings level and becomes the
    underline of the chalk title "HOW YOU MOVE" at v 0.92 (work capacity as the measure of efficacy
    is what makes how you move matter, p. 40).
  - 0.20 to 0.30: MECHANICS draws; inside it, a small chalk joint angle with a force arrow (the
    physics, p. 41). "MECHANICS: PHYSICS" at 0.30.
  - 0.34 to 0.50: TECHNIQUE draws around it (technique includes the mechanics, p. 41).
    "TECHNIQUE: METHOD" at 0.46.
  - 0.52 to 0.70: the FORM bar slides down onto TECHNIQUE's top edge, the lime half then the red
    half. "FORM: GOOD OR BAD" at 0.66 (the normative value applied to mechanics and technique, p. 41).
  - 0.72 to 0.96: STYLE and its squiggles draw apart; the connector carries "NO BEARING" at 0.92.
- **Camera**: `CHART`.
- **Labels**: name "HOW YOU MOVE" (chalk, no dot); callouts "MECHANICS: PHYSICS", "TECHNIQUE: METHOD",
  "FORM: GOOD OR BAD", "STYLE: SIGNATURE" (chalk, `required`); tick "NO BEARING".
- **Learning outcome**: four words for how you move; form is the judgment of mechanics and technique;
  style is personal and is not judged.
- **Voice** (42 words; source `TECHNIQUE_SEE` para 7, `TECHNIQUE_TERMS`, pp. 40-41): "Choosing work
  capacity as the standard makes quality of movement matter. Four terms describe it. Mechanics is the
  physics. Technique is the method to success. Form is the judgment: good or bad. Style is your
  signature, with no bearing on the rest."
  - Sync: [0.04, "standard", -0.1], [0.16, "matter.", 0.1], [0.2, "Four terms", -0.1], [0.3,
    "physics.", 0.1], [0.34, "Technique", -0.1], [0.5, "success.", 0.1], [0.52, "Form", -0.1], [0.7,
    "good or bad.", 0.2], [0.72, "Style", -0.1], [0.92, "no bearing", 0], [1, "rest.", 0.2]
- `sceneWords` 10.

#### T3 `graph`, build 5.5
- **Caption**:
  - Title: **Technique, defined**
  - Body: "Plot work accomplished against energy expended. Technique is what maximizes the work completed
    for the energy expended." `source: 'fitnessData.CHARTER + fitnessData.TECHNIQUE_GRAPH'` [CHARTER.why,
    verbatim; p. 41; Figure 1, p. 42]
- **Scene** (Figure 1 redrawn exactly: its two axis titles, two arrows of equal length from the
  origin, the double-headed "Technique" arrow between them). The plot fills the frame: origin O at (u
  0.12, v 0.10), x axis to u 0.96, y axis to v 0.96. Arrows are defined in plot-normalized
  coordinates (the figure has no scale): A, INEFFICIENT, tip (0.28, 0.87); B, IDEAL, tip (0.87, 0.28);
  the technique arc at normalized radius 0.55 from A's side to B's side (an ellipse arc when the frame
  is not square), heads at both ends.
  - 0.00 to 0.04: T2 fades.
  - 0.04 to 0.14: a hot pen draws the x axis left to right; "WORK ACCOMPLISHED" under its right end at
    0.14.
  - 0.14 to 0.24: the pen draws the y axis upward; "ENERGY EXPENDED" at its top at 0.24.
  - 0.28 to 0.40: arrow A draws from O (dashed chalk, 3 px, hot head); 0.40 to 0.48: dashed dimension
    lines from its tip to both axes (high on energy, short on work); "INEFFICIENT" at its tip at 0.42.
  - 0.52 to 0.62: arrow B draws from O (lime, 3 px, hot head); 0.62 to 0.68: its dimension lines (low
    on energy, far on work); "IDEAL" at its tip at 0.62.
  - 0.74 to 0.88: the hot lime pen draws the arc from A's side toward B's side, then both heads; 0.88:
    the callout "TECHNIQUE" (lime) at the arc's middle, the claim (L2).
- **Camera**: `CHART`.
- **Labels**: ticks "WORK ACCOMPLISHED" and "ENERGY EXPENDED" (the figure's own axis titles,
  `required`); names "INEFFICIENT" (chalk), "IDEAL" (lime dot); callout "TECHNIQUE" (lime, `required`).
- **Learning outcome**: technique is a direction on this graph: the most work completed for the energy
  you spend.
- **Voice** (45 words; source `TECHNIQUE_GRAPH`, p. 41; the last sentence is `CHARTER.why`, verbatim):
  "On a graph, put work completed along the bottom and energy expended up the side. Inefficient, you
  spend a lot of energy and do very little work. Ideally, little energy buys the most work. Technique
  is what maximizes the work completed for the energy expended."
  - Sync: [0.04, "along the bottom", -0.1], [0.14, "up the side.", -0.3], [0.24, "side.", 0.1], [0.28,
    "Inefficient,", -0.1], [0.4, "a lot of energy", 0], [0.48, "very little work.", 0.2], [0.52,
    "Ideally,", -0.1], [0.68, "most work.", 0.1], [0.74, "Technique is what", -0.1], [0.88, "maximizes",
    0.2], [1, "energy expended.", 0.2]
- `sceneWords` 6.

#### T4 `deviation`, build 6.0
- **Caption**:
  - Title: **What a deviation is**
  - Body: "Form judged bad. One lifter pops the hip and gets under it; the other pulls with a rounded
    back. To stay safe, use good form." `source: 'fitnessData.TECHNIQUE_TERMS + fitnessData.TECHNIQUE_GRAPH'`
    [form, p. 41; the safety example, p. 42, para]
  - terms: "rounded back" sick.
- **Scene** (the article's own scene, p. 42: two people lift a heavy object). The T3 graph becomes an
  inset (FLIP): side by side u 0.02 to 0.30, v 0.70 to 0.98; stacked u 0.04 to 0.44, v 0.78 to 0.99;
  its labels leave, its arrows and arc stay at 50%. Two athletes face +x, mid-foot roots: side by side
  SOLID at u 0.42 and GHOST at u 0.78, ground v 0.04, stature 0.62 FH; stacked SOLID at u 0.27 and
  GHOST at u 0.74, ground v 0.04, stature 0.50 FH (start). Each has a medicine ball (radius 0.10 of
  stature) between its feet.
  - 0.00 to 0.16: the inset FLIP.
  - 0.14 to 0.26: both athletes fade in at the medicine-ball clean set-up (`MOVEMENTS` 'mb-clean':
    shoulder-width stance, ball between the feet with palms on the ball, shoulders over the ball, eyes
    on the horizon, lumbar curve maintained). SOLID: the kit body, its lumbar highlight lime. GHOST:
    the kit ghost (dashed chalk).
  - 0.26 to 0.56: the SOLID cleans. 0.26 to 0.36: the hips extend rapidly (a story-side amber arc
    chevron at the hip landmark; "POP THE HIP" at 0.32). 0.36 to 0.46: the shoulders shrug and the arms
    pull under to the bottom of the squat, the ball in the rack ("GET UNDER IT" at 0.42). 0.46 to
    0.56: it stands to full hip and knee extension with the ball at the rack. Its lumbar highlight
    stays lime. The inset's IDEAL arrow brightens 0.30 to 0.56.
  - 0.58 to 0.80: the GHOST starts to pull with a rounded back: its hips rise ahead of its chest and
    its lumbar curve flexes (`lord` 40 to -20 over 0.60 to 0.72); its lumbar highlight turns red and
    hot (the speaking element); the ball barely leaves the floor and it freezes there. "ROUNDED BACK"
    (red callout, leader to the GHOST's 'lumbar' landmark) at 0.70. The inset's INEFFICIENT arrow
    brightens 0.62 to 0.80 (a visual echo of T3; not voiced).
  - 0.82 to 0.98: the claim "GOOD TECHNIQUE, GOOD FORM" (lime callout) beside the SOLID's chest.
- **Camera**: `CHART`.
- **Labels**: names "POP THE HIP" (amber dot), "GET UNDER IT"; callouts "ROUNDED BACK" (red), "GOOD
  TECHNIQUE, GOOD FORM" (lime), both `required`. The inset has no labels.
- **Learning outcome**: a deviation is movement that form judges bad; the article's example is pulling
  a heavy object with a rounded back instead of popping the hip and getting under it, and the first
  thing it costs is safety.
- **Voice** (44 words; source `TECHNIQUE_TERMS` form, `TECHNIQUE_GRAPH` p42_safety, pp. 41-42; the last
  sentence is verbatim): "A deviation is form judged bad. Two people lift a heavy object. One pops
  the hip and gets under it: a clean. The other starts to pull with a rounded back. If you want to stay
  safe, you better have good technique, good form."
  - Sync: [0.12, "judged bad.", 0.1], [0.14, "Two people", -0.1], [0.26, "One pops", -0.1], [0.36, "gets
    under", -0.1], [0.56, "a clean.", 0.3], [0.58, "The other", -0.1], [0.7, "rounded back.", 0], [0.82,
    "If you want", -0.1], [1, "good form.", 0.2]
- `sceneWords` 9.

#### T5 `charter`, build 5.5
- **Caption**:
  - Title: **The charter**
  - Body: "Mechanics, consistency, then and only then intensity. Ignoring this order increases the risk
    for injury, especially under load." `source: 'fitnessData.CHARTER + fitnessData.MCI_SKIP_PENALTY'`
    [CHARTER.quote, para; MCI_SKIP_PENALTY, para; p. 77]
  - terms: "intensity" both, "injury" sick.
- **Scene** (a timeline; time runs left to right, L11). Axes: origin O (u 0.10, v 0.12); the time axis
  to u 0.96 with "TIME" at its end; the y axis to v 0.92 with "LOAD AND SPEED" at its top (the charter's
  gate: movements correct and consistent "before load and speed are added", p. 77). Three bands (fills
  at 10% with chalk dividers): MECHANICS u 0.10 to 0.36, CONSISTENCY u 0.36 to 0.66, INTENSITY u 0.66 to
  0.96; their names at v 0.86 (stacked: v 0.86, 0.80, 0.86 if neighbours collide).
  - 0.00 to 0.10: the athletes and the inset leave. 0.00 to 0.08: the time axis draws; 0.08 to 0.16:
    the y axis.
  - 0.16 to 0.34: the MECHANICS band fills in with its name; an amber line (3 px) draws flat and low
    (v 0.20) across it.
  - 0.34 to 0.50: the CONSISTENCY band and name; the amber line continues flat.
  - 0.50 to 0.70: the INTENSITY band and name; the hot amber pen ratchets up in three steps (at u 0.72,
    0.80 and 0.88, to v 0.40, 0.58 and 0.76; schematic, no values); "ONLY THEN" (lime callout) at the
    first step at 0.56.
  - 0.72 to 0.96: the order ignored: a red dashed line leaves O and jumps up inside the MECHANICS band
    (to v 0.80 by u 0.16), then runs flat; "RISK FOR INJURY" (red callout) at its top at 0.84.
- **Camera**: `CHART`.
- **Labels**: ticks "TIME", "LOAD AND SPEED"; names "MECHANICS", "CONSISTENCY", "INTENSITY"
  (`required`); callouts "ONLY THEN" (lime), "RISK FOR INJURY" (red).
- **Learning outcome**: intensity comes last, after mechanics and consistency; load and speed on poor
  mechanics is the risk.
- **Voice** (43 words; source `CF_PILLARS[2].quote` (intensity is power, p. 2, chapter 07),
  `CHARTER.why`, `CHARTER.quote`, `MCI_SKIP_PENALTY`, `TECHNIQUE_SEE` p40_sidebar; pp. 2, 40, 41, 77):
  "Intensity is power, and technique gets the most work from your energy. So the charter for balancing
  safety, efficacy and efficiency is mechanics, then consistency, then, and only then, intensity.
  Ignore that order and you risk injury, especially when poor mechanics meet load."
  - Sync: [0.08, "your energy.", 0], [0.16, "is mechanics,", 0], [0.34, "then consistency,", 0], [0.5,
    "only then,", -0.1], [0.7, "intensity.", 0.2], [0.72, "Ignore", -0.1], [0.84, "risk injury,", 0],
    [1, "meet load.", 0.2]
- `sceneWords` 9.

#### T6 `odds`, build 5.5
- **Caption**:
  - Title: **Not at odds**
  - Body: "Proficiency comes with speed: a perfectly exquisite Fran is worthless if it takes 32 minutes.
    Technique versus speed is an illusion." `source: 'fitnessData.THRESHOLD + fitnessData.TECHNIQUE_SPEED'`
    [THRESHOLD.fran, verbatim; THRESHOLD.illusion, para; p. 43]
- **Scene** (a plane, SPEED across and TECHNIQUE up, which carries the rest of the chapter). O (u 0.14,
  v 0.12); x axis to u 0.94, "SPEED"; y axis to v 0.94, "TECHNIQUE", with the tick "PERFECT" at its top.
  The target: a lime ring of radius 0.045 FH at (u 0.86, v 0.86). Two examples: P1 at (u 0.20, v 0.86)
  and P2 at (u 0.25, v 0.80). The either-or line: dashed chalk from (u 0.18, v 0.92) to (u 0.92, v
  0.18).
  - 0.00 to 0.16: the charter leaves; a hot pen draws the axes as one L stroke (down the TECHNIQUE axis,
    then along the SPEED axis); the titles and "PERFECT" land.
  - 0.16 to 0.26: the target ring draws (hot), "ACCURATE AND QUICK": proficiency is speed and
    accuracy together (p. 43).
  - 0.26 to 0.44: P1 snaps in (chalk dot), "20 WORDS A MINUTE": perfect, and never hired (p. 43).
  - 0.44 to 0.60: P2 snaps in, "FRAN IN 32 MINUTES": chapter 07 measured Fran's power; a perfect one
    this slow is worthless (p. 43).
  - 0.62 to 0.78: the either-or line draws, "GOOD FORM OR QUICKLY?" at its middle: the false choice put
    to coaches (p. 43).
  - 0.80 to 0.96: the either-or line fades to 15% and "AN ILLUSION" (lime callout) lands on it.
- **Camera**: `CHART`.
- **Labels**: ticks "SPEED", "TECHNIQUE", "PERFECT"; names "ACCURATE AND QUICK" (lime dot), "20 WORDS A
  MINUTE" (short "20 WORDS/MIN"), "FRAN IN 32 MINUTES" (short "FRAN, 32 MIN"); tick "GOOD FORM OR
  QUICKLY?"; callout "AN ILLUSION" (lime, `required`).
- **Learning outcome**: where speed matters, perfect but slow fails; good form and speed are not a
  trade-off to choose between.
- **Voice** (44 words; source `TECHNIQUE_SPEED` p43_speed, `THRESHOLD.fran`, `THRESHOLD.illusion`, p.
  43): "Typing, shooting, the violin, racing, CrossFit: in each, proficiency comes with speed. A typist
  who never errs at twenty words a minute never gets hired. A perfect Fran in thirty-two minutes is
  worthless. Technique and speed only seem at odds. It is an illusion."
  - Sync: [0.16, "proficiency", -0.1], [0.26, "speed.", 0.2], [0.3, "twenty words", -0.1], [0.44,
    "hired.", 0.1], [0.5, "thirty-two", -0.1], [0.6, "worthless.", 0.1], [0.62, "only seem", -0.2],
    [0.8, "It is an", -0.1], [0.92, "illusion.", 0], [1, "illusion.", 0.4]
- `sceneWords` 14.

#### T7 `threshold`, build 6.5
- **Caption**:
  - Title: **Threshold training**
  - Body: "When the movement starts falling apart, do not slow down: fix it at that speed. Errors broaden,
    then shrink without slowing." `source: 'fitnessData.THRESHOLD + fitnessData.TECHNIQUE_SPEED'`
    [THRESHOLD.definition, para; p. 44, paras 1-2, para]
  - terms: "falling apart" sick.
- **Scene**. The plane FLIPs into a sub-rect: stacked u 0.06 to 0.98, v 0.50 to 0.98; side by side u
  0.40 to 0.98, v 0.08 to 0.96. In plane coordinates (pu, pv) the learning path is: (0.06, 0.88) ->
  (0.30, 0.88) -> (0.54, 0.50) -> (0.54, 0.88) -> (0.78, 0.50) -> (0.78, 0.88) -> (0.90, 0.88). Its
  corners at pu 0.30, 0.54 and 0.78 are where T8 will put the article's numbers. The athlete (T4's
  SOLID, no ghost): stacked mid-foot u 0.50, ground v 0.03, stature 0.40 FH; side by side u 0.19,
  ground v 0.06, stature 0.66 FH (start). It repeats the clean's pull (set-up to full hip extension, the
  ball rising to the hips, and back), a function of T as section 2 sets out: reps per unit t follow
  the path's pu (relative tempo 1 + (pu - 0.30) / 1.2, so 1 at pu 0.30, 1.2 at 0.54, 1.4 at 0.78, the
  ratios of 10,000, 12,000 and 14,000). Its `lord` follows the path's pv: 40 at pv 0.88, -20 at pv
  0.50, linear, applied in each pull.
  - 0.00 to 0.14: the plane moves to its sub-rect (P1, P2, the either-or line and AN ILLUSION leave;
    the target ring stays at 40%); the athlete fades in already repeating slowly, lumbar lime.
  - 0.14 to 0.24: the hot amber pen draws (0.06, 0.88) to (0.30, 0.88): faster, still good.
  - 0.24 to 0.34: the pen draws down and right to (0.54, 0.50), amber turning red as it drops; the
    athlete's tempo rises and its back rounds. "FALLING APART" (name, red dot) at the dip and "FORM
    FALTERS" (red callout at the athlete's 'lumbar' landmark) at 0.30.
  - 0.34 to 0.46: the pen draws straight up to (0.54, 0.88) in lime: the same speed, form restored; the
    lumbar returns to lime at the same tempo. "FIX IT AT THAT SPEED" (name, lime dot) at 0.42.
  - 0.46 to 0.74: the second dip and rise, at pu 0.78, the athlete following; no new labels (the voice
    is on "an unavoidable consequence of development").
  - 0.74 to 0.82: the pen runs on to (0.90, 0.88), toward the target ring.
  - 0.82 to 0.96: the whole path brightens; "THRESHOLD TRAINING" (lime callout) beside it at 0.88. "FORM
    FALTERS" shows only while the lumbar is red.
- **Camera**: `CHART`.
- **Labels**: names "FALLING APART" (red dot), "FIX IT AT THAT SPEED" (lime dot); callouts "FORM FALTERS"
  (red), "THRESHOLD TRAINING" (lime, `required`); the plane keeps "SPEED", "TECHNIQUE", "PERFECT".
- **Learning outcome**: you get faster with good form by pushing the speed until form falters and
  fixing it at that speed, again and again.
- **Voice** (41 words; source `TECHNIQUE_SPEED` p44_coach and p43_errors, `THRESHOLD.errors`,
  `THRESHOLD.definition`, pp. 43-44): "Moving well? Pick up the speed, then again, until the movement
  starts falling apart. Do not slow down yet: fix it at that speed. The errors are an unavoidable
  consequence of development. Broaden them, then reduce them without slowing: threshold training."
  - Sync: [0.06, "Moving well?", 0.2], [0.14, "Pick up", -0.1], [0.3, "falling apart.", 0], [0.34, "Do
    not slow", -0.1], [0.46, "that speed.", 0.2], [0.6, "unavoidable", 0], [0.74, "development.", 0.2],
    [0.76, "Broaden", -0.1], [0.88, "threshold training.", 0], [1, "threshold training.", 0.6]
- `sceneWords` 8.

#### T8 `margin`, build 6.5 (signature beat; impact accent 0.82 to 0.94)
- **Caption**:
  - Title: **Advance the margin**
  - Body: "Perfect at 10,000 foot-pounds per minute, falling apart at 12,000: train that band until 12,000
    is great. Next target: 14,000." `source: 'fitnessData.THRESHOLD'` [THRESHOLD.mechanism, para;
    THRESHOLD.quote, para; p. 44]
- **Scene** (the article's worked example in its own numbers, on T7's path; same composition).
  - 0.00 to 0.12: T7's path fades to 20% and stays as the trace under this beat; the x title "SPEED"
    becomes "FT-LB PER MINUTE" (`THRESHOLD.unit`); the ticks "10,000", "12,000" and "14,000" land at pu
    0.30, 0.54 and 0.78, T7's corners. No other tick or number.
  - 0.12 to 0.22: dot d10 snaps at (0.30, 0.88), lime, and the y tick "PERFECT" flashes; the athlete
    repeats at relative tempo 1, lumbar lime.
  - 0.22 to 0.34: the athlete speeds to 1.2 and its back rounds; dot d12 snaps at (0.54, 0.50), red,
    "FALLS APART"; a lime vertical MARGIN line rises at pu 0.54, "MARGIN".
  - 0.34 to 0.54: the band from pu 0.30 to 0.54 fills (lime hatch, 20%), "FIX THE FORM" (p. 44: "Work
    at that 10,000 to 12,000 foot-pounds per minute mark to fix the form"); d12 rises to (0.54, 0.88)
    and turns lime, its label becoming "GREAT"; the lumbar returns to lime at tempo 1.2.
  - 0.54 to 0.68: the athlete speeds to 1.4, back rounding; dot d14 snaps at (0.78, 0.50), red,
    "SUFFERS"; the MARGIN line glides from pu 0.54 to 0.78 (0.56 to 0.66).
  - 0.68 to 0.80: narrow it in: d14 rises to (0.78, 0.88), lime; the lumbar returns to lime at 1.4;
    the transient labels (GREAT, FIX THE FORM, SUFFERS) fade.
  - 0.80 to 0.96: the MARGIN line glides on past 14,000 to pu 0.90 with a head on its top (no tick: the
    article names no next number); "ADVANCE THE MARGIN" (lime callout) lands; impact accent 0.82 to
    0.94 on the MARGIN line (the speaking element).
- **Camera**: `CHART`.
- **Labels**: tick "FT-LB PER MINUTE" and ticks "10,000", "12,000", "14,000" (`required`); names "FALLS
  APART" then "GREAT" (`setLabelText`), "SUFFERS"; tick "FIX THE FORM" (transient); name "MARGIN"
  (`required`); callout "FORM FALTERS" at the athlete's 'lumbar' landmark while red; callout "ADVANCE
  THE MARGIN" (lime, `required`).
- **Learning outcome**: the threshold moves: train where form falls apart until it holds, then the
  next speed becomes the margin.
- **Voice** (40 words; source `THRESHOLD.mechanism`, `THRESHOLD.quote`, `TECHNIQUE_SPEED` p44_example,
  p. 44): "Say technique is perfect at ten thousand foot-pounds per minute, but falls apart at twelve
  thousand. Work that band until twelve thousand is great. Then fourteen thousand suffers, so narrow it
  in. Continuously advance the margins at which form falters."
  - Sync: [0.06, "Say technique", 0], [0.12, "perfect", -0.1], [0.22, "falls apart", -0.1], [0.34, "Work
    that band", -0.1], [0.54, "is great.", 0.1], [0.56, "Then", -0.1], [0.68, "narrow", -0.1], [0.8,
    "Continuously", -0.1], [0.94, "falters.", 0], [1, "falters.", 0.4]
  - No anchor sits on a number, so writing the numbers as digits for the spoken map changes nothing.
- `signature: true`, `sceneWords` 9, `impact: [0.82, 0.94]`.

#### T9 `everything`, build 5.0
- **Caption**:
  - Title: **Technique is everything**
  - Body: "Without it you will not express power in significant measure, or be safe in trying. It is part
    of safety, efficacy and efficiency." `source: 'fitnessData.TECHNIQUE_SPEED + fitnessData.SEE_VECTORS'`
    [p. 44, para 8, para; SEE_VECTORS.intimate, para]
  - terms: "safety" phosphagen, "efficacy" yellowGreen, "efficiency" practiced.
- **Scene** (the chapter closes on its definition).
  - 0.00 to 0.12: the plane and the athlete fade.
  - 0.06 to 0.30: Figure 1 returns: the pen redraws T3's axes and both arrows quickly; "WORK
    ACCOMPLISHED" and "ENERGY EXPENDED" return.
  - 0.30 to 0.56: the hot lime pen sweeps the technique arc from A to B and arrow B brightens to the
    hero width (4.5 px); "TECHNIQUE" (chalk callout, see colour meaning) lands.
  - 0.58 to 0.78: a pinned legend (top left of the focus rect): three swatches, SAFETY, EFFICACY and
    EFFICIENCY, lighting one by one on their words.
  - 0.80 to 1.00: SDF "TECHNIQUE IS EVERYTHING" (Barlow Bold, ink on a lime plate, two lines "TECHNIQUE
    IS" / "EVERYTHING") settles in the plot's empty upper right (centre at plot (0.64, 0.66),
    maxWidth half the plot width); the plate is a label obstacle.
- **Camera**: `CHART`.
- **Labels**: ticks "WORK ACCOMPLISHED", "ENERGY EXPENDED"; callout "TECHNIQUE"; legend "SAFETY",
  "EFFICACY", "EFFICIENCY". SDF "TECHNIQUE IS EVERYTHING".
- **Learning outcome**: technique is at the heart of everything the chapter measured: power, safety,
  efficacy and efficiency.
- **Voice** (39 words; source `TECHNIQUE_SPEED` p44_everything, `SEE_VECTORS.intimate`, pp. 43-44; "Technique
  is everything" is verbatim): "We are the technique people. We drill technique, and we push the speed.
  Without technique you will not express power in significant measure, or be safe in trying. Safety,
  efficacy and efficiency all depend on it. Technique is everything."
  - Sync: [0.12, "technique people.", 0], [0.3, "Without", -0.1], [0.56, "safe in trying.", 0.1], [0.58,
    "Safety,", -0.1], [0.78, "depend on it.", 0.1], [0.8, "Technique is everything.", -0.1], [1,
    "everything.", 0.3]
- `sceneWords` 7. The finished beat ends the lesson (H.57): [Explore this model] [Back to overview].

---

## 4. Label lexicon and SDF (technique)

Every string the chapter may show in the label layer; each restates the article (page in section 0):
- T0: "EFFICACY: THE RETURN", "EFFICIENCY: TIME RATE", "SAFETY: WHO FINISHES", "WORK CAPACITY", "50
  PULL-UPS", "6 MONTHS", "9 YEARS", "FINISH LINE", "2 OF 10".
- T1: "SAFETY", "EFFICACY", "EFFICIENCY", "SAME DIRECTION", "DOWN TO ZERO", "INTENSITY UP", "LOSING
  PEOPLE".
- T2: "HOW YOU MOVE", "MECHANICS: PHYSICS", "TECHNIQUE: METHOD", "FORM: GOOD OR BAD", "STYLE: SIGNATURE",
  "NO BEARING".
- T3 and T9: "WORK ACCOMPLISHED", "ENERGY EXPENDED", "INEFFICIENT", "IDEAL", "TECHNIQUE".
- T4: "POP THE HIP", "GET UNDER IT", "ROUNDED BACK", "GOOD TECHNIQUE, GOOD FORM".
- T5: "TIME", "LOAD AND SPEED", "MECHANICS", "CONSISTENCY", "INTENSITY", "ONLY THEN", "RISK FOR INJURY".
- T6: "SPEED", "TECHNIQUE", "PERFECT", "ACCURATE AND QUICK", "20 WORDS A MINUTE" ("20 WORDS/MIN"), "FRAN
  IN 32 MINUTES" ("FRAN, 32 MIN"), "GOOD FORM OR QUICKLY?", "AN ILLUSION".
- T7: "FALLING APART", "FIX IT AT THAT SPEED", "FORM FALTERS", "THRESHOLD TRAINING".
- T8: "FT-LB PER MINUTE", "10,000", "12,000", "14,000", "FALLS APART", "GREAT", "FIX THE FORM", "SUFFERS",
  "MARGIN", "ADVANCE THE MARGIN".
- Explore: "Speed, ft-lb per minute", "Train at this speed", "Reset training", "Show the graph",
  "Form", "Margin", "Perfect", "Falls apart", "Great", "Suffers", "Past 14,000" and the four status
  lines of section 5.

**SDF (technique)**: "TECHNIQUE IS EVERYTHING" (T9 only).

---

## 5. Explore (technique): the threshold trainer

The T8 scene as an instrument: replay the worked example and see that the margin only moves when you
train where form falls apart.
- `explore.cam = { L: CHART }`; limits az -15 to 15, el 0 to 10, zoom 0.85 to 1.3; no Scrub toggle.
- `initFromBeat(i)`: beats 0 to 6 open at speed 10,000 with the margin at 12,000; beat 7 at 12,000 with
  the margin at 12,000 (falling apart); beats 8 and 9 at 14,000 with the margin past 14,000.
- **Peek**: `ChipRadio` "Speed, ft-lb per minute": 10,000 | 12,000 | 14,000; [Back to story] [Reset view].
- **Expanded**: [Train at this speed] (solid when enabled) and [Reset training]; readouts "Form"
  (Perfect / Falls apart / Great / Suffers) and "Margin" (12,000 / 14,000 / Past 14,000); a status line
  restating p. 44 for the state:
  - below the margin: "Moving well: pick up the speed."
  - at the margin: "Form falters here. Do not slow down: fix it at this speed."
  - above the margin: "Form falls apart. Work the band where it first falters."
  - just trained: "Great here. The next step is the next speed."
  - a "Show the graph" toggle: Figure 1 as an inset whose one arrow sits on IDEAL while form holds
    and swings toward INEFFICIENT while it falters (qualitative, p. 41; section 9, flag 4).
- **State machine** (the worked example, p. 44): the margin starts at 12,000. Form at speed s: below
  the margin, Perfect (10,000) or Great (a trained speed); at the margin, Falls apart (12,000) or
  Suffers (14,000); above it, Falls apart. Train is enabled only at the margin: that dot rises (damped,
  about 0.8 s) and the margin advances (12,000 to 14,000 to past 14,000, drawn beyond the last tick with
  no number).
- The athlete repeats the pull at the chosen speed's tempo (1, 1.2, 1.4) with the state's lumbar. In
  explore the rep phase may accumulate (C.12); reduced motion holds the pull pose.

---

## 6. Acceptance (technique)

At `?beat=N&t=1` unless a t is given; 390 x 664 first (the owner's phone), then 390 x 844, 360 x 780,
430 x 932 (`&tier=medium`) and 1440 x 900 (`&tier=high`).
- [ ] Caption audit passes with section 7.2's data; no em or en dashes in the chapter or this file;
      every number on screen is one of 2, 6, 9, 10, 20, 32, 50, 10,000, 12,000, 14,000; no schematic
      axis carries a value.
- [ ] T0: three lanes with readable, unclipped callouts at 360; "6 MONTHS" left of "9 YEARS", the blue
      line near vertical; exactly two lit dots past the finish line, eight hollow rings; "2 OF 10".
- [ ] T1: three equal arrows from one origin within 14 degrees of each other, names readable; at t 0.4
      SAFETY long and the others collapsed; at t 0.6 EFFICIENCY long and SAFETY short; at t 0.82 SAFETY
      and EFFICACY short.
- [ ] T2: MECHANICS inside TECHNIQUE; the lime and red FORM bar on TECHNIQUE's top edge; STYLE dashed
      and apart with "NO BEARING"; no overlaps at 360.
- [ ] T3: axis titles exactly "WORK ACCOMPLISHED" (x) and "ENERGY EXPENDED" (y); A dashed chalk and
      steep, B lime and shallow, equal normalized lengths (probe); the double-headed lime arc between
      them with "TECHNIQUE"; dashed dimension lines.
- [ ] T4: the inset top left without labels; SOLID standing, ball in the rack, lumbar lime; GHOST in a
      rounded pull, lumbar red, ball at the floor; "ROUNDED BACK" leadered to the GHOST's lower back;
      "GOOD TECHNIQUE, GOOD FORM"; both on one ground line, feet planted, neither under the caption
      card. At t 0.32: "POP THE HIP" at the SOLID's extending hip.
- [ ] T5: the bands in order; the amber line flat through MECHANICS and CONSISTENCY and three steps up
      in INTENSITY; the red dashed jump inside MECHANICS with "RISK FOR INJURY"; "ONLY THEN".
- [ ] T6: plane titles; the target top right with "ACCURATE AND QUICK"; two examples top left; the
      either-or line faded with "AN ILLUSION" on it.
- [ ] T7: at t 0.30 the lumbar red with "FALLING APART" and "FORM FALTERS"; at t 0.44 lime at the same
      tempo with "FIX IT AT THAT SPEED"; at t 1 the full path, lumbar lime, "THRESHOLD TRAINING".
- [ ] T8: at t 0.30 d12 low and red, "FALLS APART", MARGIN at 12,000, lumbar red; at t 0.60 d12 high and
      lime, d14 low and red, MARGIN moving; at t 1 all three dots high and lime, MARGIN past 14,000 with
      no number, "ADVANCE THE MARGIN"; ticks exactly "10,000", "12,000", "14,000", "FT-LB PER MINUTE";
      at least a 4 s hold; one impact.
- [ ] T9: Figure 1 with the arc and "TECHNIQUE", the three-swatch legend, the SDF inside the plot and
      clear of the card; the lesson's end row.
- [ ] Determinism: in T7 and T8 the rep phase is a function of T, lands on the pull at t 1, never jumps
      at a tempo change; `?beat=N&t=X` equals seeking; (N, 1) equals (N + 1, 0).
- [ ] Narration: ten paragraphs of 39 to 45 words; every anchor phrase unique; narration-check passes;
      with sound on, each named reveal lands on its words (H.74).
- [ ] Labels: at most 36 live; `required` labels never hidden on the four phone sizes (H.55 gates).
- [ ] Explore: Train enabled only at the margin; the margin goes 12,000, 14,000, past 14,000; Reset
      restores; the graph toggle swings with the form state.
- [ ] Real GPU at tier high: no black frames across the chapter.

---

## 7. Notes for builders

### 7.1 Registration (outside the chapter folder; the 07 builder touched the same files)
- `lessonTypes.ts`: `ModuleKey` gains `'technique'` after `'crossfit'`.
- `fitnessData.ts`: `MODULES[7]` (proposal: key and slug 'technique', num '08', label and mobileLabel
  'Technique', title 'Technique: Safety, Efficacy, Efficiency and the Threshold', blurb "Glassman's
  essay: the graph that defines technique, mechanics before intensity, and the threshold that keeps
  moving.", accent `PAL.weightlifting`: no other chapter's accent, no meaning inside this chapter, and
  the July page's choice; owner to confirm); `MODULE_COPY.technique` (7.2); `CROSS_LINKS.technique`; sources with
  `for: ['technique']` (the L1 Training Guide; "Technique, Part 1", CrossFit Journal, Feb. 1, 2008,
  crossfit.com/essentials/technique-part-1-by-greg-glassman, resolved 200 on 2026-10-01).
- `story/ui/ChapterGlyph.tsx`: a 'technique' glyph, Figure 1 in miniature (two arrows from a corner and
  the arc between them), append-only.
- `scripts/seo-routes.mjs`: `/fitness/technique`.
- The lesson's end moves from 07 to 08: CrossFit's finished last beat offers "Next: 08 Technique"; T9
  carries the end row (H.57). The progress hairline gains an eighth segment. The intro map stays as the
  07 builder left it (owner decision pending).

### 7.2 Data (`fitnessData.ts`, the pattern the 07 builder used)
- Add four verbatim blocks with cites, each under 3,000 characters (the caption audit reads 3,000 from
  each export; the blocks measure about 2,200, 850, 1,000 and 2,200): `TECHNIQUE_SEE` (p. 40),
  `TECHNIQUE_TERMS` (p. 41), `TECHNIQUE_GRAPH` (pp. 41-42), `TECHNIQUE_SPEED` (pp. 43-44). Their
  sentences are section 8, keyed as the voice sources above cite them. `THRESHOLD`, `SEE`,
  `SEE_VECTORS`, `CHARTER`, `MCI_SKIP_PENALTY` and `CF_PILLARS` exist and are reused unchanged.
- With those blocks every caption above passes the audit's 70% rule (checked by emulating
  `fitness-gate.mjs`: 85 to 100% per beat; titles 11 to 28 characters; bodies 119 to 133).
- `MODULE_COPY.technique` (proposal, restating the article): eyebrow "Technique, L1 Guide pp. 40-44";
  body "Greg Glassman's essay on technique starts from CrossFit's numbers. Fitness is measured as work
  capacity, and a program is judged on safety, efficacy and efficiency: three vectors that point the
  same way but trade off. Measuring work makes how you move matter. Technique is what maximizes the
  work completed for the energy expended, and it is the heart of safety, efficacy and efficiency, so
  the charter is mechanics, consistency, then and only then intensity. Technique and speed are not at
  odds: when form falters at speed, fix it at that speed and advance the margin. That is threshold
  training."; keyPoints "Safety, efficacy and efficiency judge a program; they point the same way but
  trade off." / "Technique is what maximizes the work completed for the energy expended." / "The
  charter: mechanics, consistency, then and only then intensity." / "Threshold training: push the
  speed until form falters, fix it there, and advance the margin."

### 7.3 The athlete kit: what this chapter needs, and only this
- **One movement**, the medicine-ball clean, as joint-space keyframes on `PoseParams` interpolated by
  phase, verified against the guide's photographs (p. 208): SET-UP (hips above the knees, shoulders
  over the ball, eyes on the horizon, `lord` 40); PULL (hips and shoulders rising together, the ball
  close to the body); EXTEND ("hips extend rapidly", full hip and knee extension, then the shrug; heels
  down until the hips and knees extend); UNDER (the arms pull under, elbows high and outside); RECEIVE
  (the bottom of the squat, hips below the knees, the ball in the rack); STAND (full hip and knee
  extension, the ball at the rack). T7 and T8 also need the PULL CYCLE alone: SET-UP, PULL, EXTEND,
  back to SET-UP.
- **One fault**, the rounded back, as an amount 0 to 1: `lord` from 40 toward -20 and the hips rising
  ahead of the chest (`hy` up and `lean` up faster than in the clean pull), nothing else changed (no
  heel rise, no head drop: the article names only the back).
- **A ball hold**: a new `Hold`, for example `{ kind: 'ball'; r; mass }`: palms on the ball's sides,
  the ball on the floor between the feet at the set-up (centre at mid-foot, height r), close to the body
  in the pull, against the chest with the elbows high in the rack; its mass in the centre-of-mass
  solve like the bar's.
- **Two figures at once** (T4): two poses with their own roots (mid-foot x), the second drawn as the
  kit ghost (dashed or translucent chalk), each with its own fault amount.
- **The lumbar highlight**: a pen along `lumbarCurve` lifted about 0.02 m off the back; colour by `lord`:
  25 or more lime, 5 or less `PAL.sick`, chalk in between (never through amber); hot only while red in
  T4 (the speaking element).
- **Landmarks used for labels**: 'lumbar' (ROUNDED BACK, FORM FALTERS), 'hip' (POP THE HIP and the
  chevron), 'chest' (GOOD TECHNIQUE, GOOD FORM), and the ball's centre (GET UNDER IT): a 'ball'
  landmark or 'hand'.
- **Scale and placement**: the rig is in metres (1.78 m athlete, mid-foot at the origin, facing +x);
  the chapter scales each figure to its stature in frame units and places its mid-foot at the beat's
  root (sections 3, T4 and T7).
- **Time**: poses are a pure function of the phase the story passes in (T-driven, section 2); the kit
  keeps no history.
- **Not used by this chapter**: plumb line, bar path, hip and knee angle arcs, the hip-crease line,
  the barbell, the front view. They stay in the kit for a future movements chapter.

### 7.4 Overlays per beat
| Beat | Athlete | Overlays and pieces |
|---|---|---|
| T0 | none | lane baselines; curveGlyph pair and band fill; goal, fast and slow lines; ten dots, eight hollow rings |
| T1 | none | three arrows with heads; amber chevron |
| T2 | none | three boxes; the FORM bar; three squiggles; a dashed connector; the joint-angle and force glyph |
| T3 | none | axes; two arrows; four dashed dimension lines; the double-headed arc |
| T4 | SOLID clean; GHOST rounded pull | lumbar highlight on both (lime, red); amber hip chevron; ball props; T3 graph inset |
| T5 | none | axes; three band fills; the amber ratchet line; the red dashed skip line |
| T6 | none | axes; target ring; two dots; the dashed either-or line |
| T7 | SOLID pull cycle | lumbar highlight (lime and red); the two-tone path; the plane |
| T8 | SOLID pull cycle | lumbar highlight; three dots; the hatch band; the MARGIN line with head; the faded path |
| T9 | none | axes; two arrows; the arc; the SDF plate |

Story-side pieces (the chapter folder): arrows (a pen line plus a two-stroke head, one `PenBatch` per
role; dashed through the pen's `dashed`), arcs (pen points), fills (`AreaFill` with a bottom curve),
dots (`Nodes`), hollow rings (the kit's ring material), the impact (`useImpact`). Budget: the scene
target of at most 30 calls (C.10) with two figures on screen in T4.

### 7.5 Build order
1. T3, the graph: the chapter's look, chart only.
2. T0, T1, T2, T5 and T6: the remaining charts and diagrams.
3. The kit (in parallel): the clean, the pull cycle, the rounded back, the ball hold, the ghost and the
   lumbar highlight. Then T4, T7 and T8.
4. T9 and explore.
5. Narration: `narration.json` from section 3 (text, source and sync per beat; `_about` and `_sync`
   notes), Charon TTS, CTC alignment, manifest and narration-check (H.74, H.75), then the sound QA.
6. QA against section 6. Registration (7.1) lands with the chapter, after or together with 07's.

---

## 8. Source ledger (verbatim; for `fitnessData.ts` and reviewers, never rendered)

CrossFit Level 1 Training Guide, 3rd ed. (2020), V6E3OL-20201212KW, printed pages; every sentence
string-matched against the PDF text. The original's em dashes appear as " - ".

**TECHNIQUE_SEE** (Technique, p. 40)
- quantification: "In no small part, what is behind this program is the quantification of fitness."
  "This means we put a number on fitness: work capacity across broad time and modal domains."
- evidence: "We call it evidence-based fitness." "This means measurable, observable, repeatable data is used
  in analyzing and assessing a fitness program." "There are three meaningful components to analysis of
  a fitness program: safety, efficacy, and efficiency."
- efficacy: "The efficacy of a program means, "What is the return?"" "For CrossFit, we want to increase
  your work capacity across broad time and modal domains." "What is the adaptation that the program
  induces?"
- efficiency: "Efficiency is the time rate of that adaptation." "Maybe the fitness program advertises
  that it can deliver 50 pull-ups." "There is a big difference whether it takes six months versus nine
  years to achieve that."
- safety: "Safety is how many people end up at the finish line." "I start with 10 individuals: Two of
  them become the fittest human beings on Earth and the other eight die." "The real tragedy comes in
  not knowing the safety numbers."
- tradeoffs: "I can greatly increase the safety of a program by turning the efficacy and efficiency
  down to zero." "I can increase the efficiency by turning up the intensity and then possibly
  compromising safety." "Or I could damage the efficacy by losing people." "Safety, efficacy and
  efficiency are the three meaningful aspects of a program." "They give me all I need to assess it."
- qualification: "This quantification of fitness, by choosing work capacity as our standard for the
  efficacy of the program, necessitates the qualification of movement." "Our quantification of fitness
  introduces qualification of movement."
- sidebar (pull quote): "Learn the mechanics of fundamental movements, establish a consistent pattern
  of practicing these same movements, and, only then, ratchet up the intensity of workouts
  incorporating these movements."

**TECHNIQUE_TERMS** (Technique, p. 41)
- "For the qualification of movement there are four common terms: mechanics, technique, form and
  style." "When I speak to the physics of movement, and especially the statics and less so the
  dynamics, I am looking at the mechanics." "Technique is the method to success for completion of a
  movement." "Form is the normative value: This is good or this is bad - "you should" or "you
  shouldn't" applied to mechanics and technique." "Style is essentially the signature to a movement;
  that is, that aspect of the movement that is fairly unique to you." "To be truly just the signature,
  style elements have no bearing on form, technique or mechanics." "I want to speak generally to
  technique and form to include all of this, but what we are talking about here is the
  non-quantification of output; that is, how you move."

**TECHNIQUE_GRAPH** (Technique, pp. 41-42)
- graph: "We end up where power is the successful completion of functional movement." "On a graph, you
  could put work completed on the X-axis and energy expended on the Y-axis." "Someone could potentially
  expend a lot of energy and do very little work by being inefficient." "Ideally, what that individual
  would do would see little energy expended for the maximum amount of work." "Technique is what
  maximizes the work completed for the energy expended (Figure 1)." Figure 1 (p. 42): "Technique
  Maximizes the Work Accomplished for the Energy Expended." (axes "Work Accomplished" and "Energy
  Expended").
- p42_safety: "Two individuals attempt to lift a heavy object; one knows how to pop a hip and get under
  it (clean), and the other guy starts to pull with a rounded back." "If you want to stay safe, you
  better have good technique, good form." "This is related to safety, efficacy and efficiency because
  technique (quality of movement) is the heart of maximizing each of these."

**TECHNIQUE_SPEED** (Technique, pp. 43-44)
- p43_speed: "Technique is an intimate part of safety, efficacy, and efficiency." "What these domains have
  in common is that a marked proficiency is associated with speed." "Being able to shoot accurately and
  quickly is better than quickly or accurately." "However, for this perfection, you type at a rate of
  20 words a minute and only use two fingers." "And yet, it is presented to CrossFit coaches as,
  "Should I use good form or should I do it quickly?"" "One is impossible without the other." "In
  CrossFit, if your technique is perfect, your intensity is always low."
- p43_errors: "The errors are an unavoidable consequence of development." "This iterative process of
  letting this scope of errors broaden then reducing them without reducing the speed is called
  "threshold training.""
- p44_coach: "In a CrossFit workout, if you are moving well, I will tell you to pick up the speed." "Now
  the movement starts falling apart." "I do not want you to slow down yet." "First, at that speed I want
  you to fix your technique."
- p44_example: "What you need to do is continuously and constantly advance the margins at which form
  falters." "It may be that initially at 10,000 foot-pounds per minute my technique is perfect, but it
  falls apart at 12,000 foot-pounds per minute." "Work at that 10,000 to 12,000 foot-pounds per minute
  mark to fix the form, and soon enough you will have great technique at 12,000 foot-pounds per
  minute." "The next step is to achieve that technique at 14,000 foot-pounds per minute." "At first, the
  technique at 14,000 foot-pounds per minute will suffer." "Then you must narrow it in."
- p44_everything: "We are the technique people." "We drill technique incessantly, but simultaneously I
  want you to go faster." "Technique is everything." "You will not express power in significant measure
  without technique." "You might expend a lot of energy, but you will not see the productive
  application of force." "You will not be able to complete functional tasks efficiently or
  effectively." "You will not be safe in trying."

**Already in `fitnessData.ts`** (reused unchanged): `CHARTER.quote`, `.gate`, `.why` (pp. 77, 41);
`MCI_SKIP_PENALTY` (p. 77); `SEE`, `SEE_VECTORS` (pp. 40, 43); `THRESHOLD` (pp. 43-44);
`CF_PILLARS[2].quote` (p. 2); `MOVEMENTS` 'mb-clean' (p. 208).

**Other guide pages this storyboard leans on** (for the athlete, not voiced): the medicine-ball clean,
p. 208 (points of performance) and p. 130 ("losing back extension" among its faults); "Medicine-Ball
Cleans", p. 128 (the ball clean as the functional clean of objects from ground to chest).

---

## 9. Owner flags and data gaps

1. **The movement under the threshold passage.** The article names no movement for its threshold
   example (pp. 43-44). T7 and T8 show the body it does name, the clean versus the rounded-back pull
   (p. 42), as a medicine-ball clean's pull. Owner to confirm, or name another movement.
2. **"Deviation" is the owner's word, not the article's.** It is defined from the article's "form"
   (the normative value, good or bad, p. 41) and illustrated by its only named deviation (p. 42); the
   graph's "inefficient" arrow (p. 41) is its echo in T4's inset.
3. **Schematic shapes carry no values**: T0's "before" curve, T1's vector lengths, T5's ratchet steps,
   the TECHNIQUE axis of T6 to T8 (dot heights are qualitative: the top is perfect, low is falling
   apart) and T7's path. Only the article's numbers are ever drawn.
4. **Figure 1 has no scale.** It is drawn in plot-normalized coordinates with equal arrow lengths, as
   printed. Explore's graph toggle (the arrow swinging with the form state) is our illustration of
   p. 41, not a measurement.
5. **The athlete's tempo** in T7 and T8 (1, 1.2, 1.4) is the ratio of the article's three power values
   at a constant work per repetition: our mapping. Under narration the warp of beat t stretches each
   window differently, so the voiced tempo is approximate.
6. **Not shown** (for Notes or a later round): the sandbag loaders (pp. 41-42), strength as the
   productive application of force (p. 42), twice body weight overhead (p. 42), "Flight of the
   Bumblebee" in 12 minutes and the NASCAR spin-outs (p. 43), the shot put (p. 44) and the perceived
   paradox (p. 44).
7. **Not used**: `MCI_CONSISTENCY_QUESTIONS` (crossfit.com essentials, Feb. 2020, not this article),
   `MCI_ENFORCE` and `CF_SCALING` (07 uses scaling).
8. **The safety example** ("the other eight die", p. 40) is shown as eight dots that stop and hollow
   out; the article itself declines to judge it and calls not knowing the numbers the tragedy.
9. **Registration and data edits** (7.1, 7.2) live outside this file and the chapter folder;
   DESIGN.md E.18's byte-identical `fitnessData.ts` is already superseded by 07's research blocks
   (coordinator's call).
10. **Unrelated data note**, for whoever builds a movements chapter: `MOVEMENTS` 'front-squat'
    execution "Bar rides the front rack, torso upright" is not the guide's wording; its front-squat page
    (p. 176) says the barbell "is supported by the torso in the front-rack position", and "torso
    upright" appears nowhere on it.
