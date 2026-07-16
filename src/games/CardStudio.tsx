import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { A2026, allAthletes2026, countryFlag, initials, monogramColor } from './athletes2026'
import photosExtra from '../data/games/photos-extra.json'
import rawGames from '../data/games-data.json'
import type { GamesData, GamesAthlete2026 } from '../types-games'
import analysisPosts from '../data/games/analysis-posts.json'

// Instagram card studio for @cf_games_update. URL-only tool (not in nav).
// Cards render at a fixed 1080x1350 (IG portrait) offscreen and export as PNG.
// URL params for automation: ?t=<template>&d=<division>&a=<slug>&b=<slug2>

const G = rawGames as unknown as GamesData

type Division = 'men' | 'women'
type Template = 'spotlight' | 'cover' | 'h2h' | 'form' | 'news' | 'carousel' | 'picks' | 'story'

const TEMPLATES: { id: Template; label: string }[] = [
  { id: 'spotlight', label: 'Athlete Spotlight' },
  { id: 'cover', label: 'Field / Countdown Cover' },
  { id: 'h2h', label: 'Head to Head' },
  { id: 'form', label: 'Season Form Top 10' },
  { id: 'news', label: 'News / Announcement' },
  { id: 'carousel', label: 'Carousel (multi-slide)' },
  { id: 'picks', label: 'Event picks (model top 5)' },
  { id: 'story', label: 'Story (blog promo, 9:16)' },
]

// Model-favored top 5 per event. Every number/reason is grounded in the projection
// model (mean measured percentile on the domains the event taxes). A fit read.
type Pick = { name: string; value: string; why: string }
type PickSet = { id: string; label: string; eventKicker: string; eventLine: string; note: string; men: Pick[]; women: Pick[] }
const PICKS: PickSet[] = [
  {
    id: 'cf-squat',
    label: 'Event 3 - Back Squat',
    eventKicker: 'Event 3 - Back Squat',
    eventLine: '1-rep-max back squat. Best-known maxes, competition-verified where available.',
    note: 'Real 2025 CrossFit Games 1RM back squat where available, else reported PR. A strength read, not a result prediction.',
    men: [
      { name: 'Colten Mertens', value: '570', why: '2025 Games winner; broke an 18-year Games record.' },
      { name: 'Nick Mathew', value: '555', why: '2025 Games, second behind Mertens.' },
      { name: 'Austin Hatfield', value: '535', why: 'Reported PR (515 at the 2025 Games).' },
      { name: 'Justin Medeiros', value: '512', why: '2025 Games back squat.' },
      { name: 'Guilherme Malheiros', value: '511', why: 'Reported PR.' },
    ],
    women: [
      { name: 'Mirjam von Rohr', value: '360', why: '2025 Games 1RM back-squat WINNER.' },
      { name: 'Anikha Greer', value: '355', why: 'Tied second at the 2025 Games.' },
      { name: 'Elisa Fuliano', value: '353', why: 'Reported PR (160 kg).' },
      { name: 'Kyra Milligan', value: '340', why: 'Reported PR; top heavy profile.' },
      { name: 'Madeline Sturt', value: '331', why: 'Reported PR; pairs with a big deadlift.' },
    ],
  },
  {
    id: 'cf-press',
    label: 'Event 4 - Shoulder Press',
    eventKicker: 'Event 4 - Shoulder Press',
    eventLine: '1-rep-max strict shoulder press. Scarce data: real 2020 Games presses + estimates.',
    note: 'Only ~5 have a real strict-press number (2020 Games / training PR); the rest are estimates from overhead strength. The honest board.',
    men: [
      { name: 'Roman Khrennikov', value: '240', why: 'Estimate. Projects the biggest press in the field.' },
      { name: 'Dallin Pepper', value: '212', why: 'Estimate from overhead strength.' },
      { name: 'Jeffrey Adler', value: '207', why: 'REAL: strict press at the 2020 Games.' },
      { name: 'Henrik Haapalainen', value: '205', why: 'Estimate (three-way tie at 205).' },
      { name: 'Tudor Magda', value: '205', why: 'Estimate.' },
    ],
    women: [
      { name: 'Hannah Black', value: '170', why: 'Estimate from overhead strength.' },
      { name: 'Alex Gazan', value: '167', why: 'Real training PR (2021).' },
      { name: 'Anikha Greer', value: '165', why: 'Estimate.' },
      { name: 'Danielle Brandon', value: '150', why: 'Estimate.' },
      { name: 'Emma Lawson', value: '150', why: 'Estimate.' },
    ],
  },
  {
    id: 'cf-deadlift',
    label: 'Event 5 - Deadlift',
    eventKicker: 'Event 5 - Deadlift',
    eventLine: '1-rep-max deadlift. Competition-verified from WFP 2026 + 2023 Rogue where available, else self-reported.',
    note: 'Best sourceable max: WFP 2026 Tour Stop 1 (Cringle 197 kg, Garnes 193 kg) and the 2023 Rogue Invitational (Gazan 425), else self-reported PR. Garnes is single-source, provisional. A strength read, not a result prediction.',
    men: [
      { name: 'Tudor Magda', value: '605', why: 'Reported PR (595 at 2023 Rogue).' },
      { name: 'Nick Mathew', value: '605', why: 'Reported PR.' },
      { name: 'Justin Medeiros', value: '600', why: 'Competition pull.' },
      { name: 'Patrick Vellner', value: '595', why: '2023 Rogue max deadlift, second.' },
      { name: 'Jayson Hopper', value: '585', why: 'Reported (575 at 2023 Rogue).' },
    ],
    women: [
      { name: 'Aimee Cringle', value: '435', why: 'WFP 2026, 197 kg (tied 2nd). Was 408.' },
      { name: 'Alex Gazan', value: '425', why: '2023 Rogue max-deadlift WINNER. Verified.' },
      { name: 'Matilde Garnes', value: '425', why: 'WFP 2026, 193 kg. Single-source, provisional.' },
      { name: 'Madeline Sturt', value: '408', why: 'Self-reported PR.' },
      { name: 'Hannah Black', value: '400', why: 'Self-reported PR.' },
    ],
  },
  {
    id: 'cf-total',
    label: 'The CrossFit Total - Overall',
    eventKicker: 'The CrossFit Total - Overall',
    eventLine: 'Back squat + shoulder press + deadlift combined. 150 points across the 3 events.',
    note: 'Sum of the three best-known lifts (squat + deadlift mostly real, press largely estimated). A strength read, not a result prediction.',
    men: [
      { name: 'Nick Mathew', value: '1355', why: '555 squat, a big 605 deadlift, estimated press. Biggest Total.' },
      { name: 'Colten Mertens', value: '1290', why: 'Record 570 squat plus a 545 deadlift.' },
      { name: 'Justin Medeiros', value: '1287', why: 'Balanced: 512 squat, 600 pull, real 175 press.' },
      { name: 'Roman Khrennikov', value: '1287', why: 'Carried by the biggest projected press.' },
      { name: 'Jayson Hopper', value: '1285', why: '500 squat, 585 deadlift, solid press.' },
    ],
    women: [
      { name: 'Alex Gazan', value: '912', why: 'Elite in all three: 320 squat, 167 press, 425 deadlift.' },
      { name: 'Hannah Black', value: '895', why: '325 squat, 400 deadlift, top projected press.' },
      { name: 'Madeline Sturt', value: '879', why: '331 squat, 408 deadlift.' },
      { name: 'Mirjam von Rohr', value: '875', why: 'Record squat (360); deadlift corrected to a verified 380.' },
      { name: 'Anikha Greer', value: '870', why: '355 squat plus a strong pull.' },
    ],
  },
  {
    id: 'event13-sprint',
    label: 'Event 13 - The 500m Sprint',
    eventKicker: 'Event 13 - The 500m Sprint',
    eventLine: 'A 500-meter sprint, published on the official workouts page. Roughly 90 seconds all-out.',
    note: 'Verified Games footrace history first (the 2021 550-yard sprint + 2024 Track and Field, official leaderboards), the season model second. Venue and heats not yet announced. A fit read, not a result prediction.',
    men: [
      { name: 'Guilherme Malheiros', value: 'WON 21', why: 'WON the 2021 550-yard sprint (1:15.37), the near-identical test.' },
      { name: 'Ricky Garard', value: 'WON 24', why: 'Won 2024 Track and Field outright; 1:04.89 on the sprint course.' },
      { name: 'Patrick Vellner', value: '3rd+5th', why: '3rd in the 2021 sprint, 5th in 2024 Track and Field. Always there.' },
      { name: 'Roman Khrennikov', value: '3rd 24', why: '3rd in 2024 Track and Field. 103 kg and still top-3 on his feet.' },
      { name: 'Saxon Panchik', value: '4th 21', why: '4th in the 2021 550-yard sprint; the model underrates his wheels.' },
    ],
    women: [
      { name: 'Haley Adams', value: '3rd+2nd', why: '3rd in the 2021 sprint, 2nd in 2024 Track and Field. Best resume here.' },
      { name: 'Danielle Brandon', value: '74', why: 'Field-best sprint percentile, real track/D1 past, won the 2022 Speed Medley.' },
      { name: 'Emma Lawson', value: '73', why: "Best measured speed in the women's field; no footrace history yet." },
      { name: 'Mirjam von Rohr', value: '69', why: 'Field-best 75 glycolytic: she slows down least.' },
      { name: 'Alexis Raptis', value: '68', why: '70 sprint percentile; springy and efficient.' },
    ],
  },
  {
    id: 'event2-ranch7200',
    label: 'Event 2 - Ranch 7200',
    eventKicker: 'Event 2 - Ranch 7200',
    eventLine: '7,200-meter trail run at the Aromas ranch. For time. Wednesday, July 22.',
    note: "Score is the model's aerobic-engine read (long engine, monostructural and oxidative percentiles) scaled by power-to-weight, since a run rewards a light frame. A fit read, not a result prediction.",
    men: [
      { name: 'Justin Medeiros', value: '77', why: '79 oxidative on an 88kg frame. Best motor-to-mass in the field.' },
      { name: 'Ricky Garard', value: '74', why: 'Strong monostructural engine at a corrected 93kg.' },
      { name: 'James Sprague', value: '71', why: 'Young engine at 95kg; sustained output travels over distance.' },
      { name: 'Jeffrey Adler', value: '70', why: 'Weight corrected to 89kg (was mis-listed 72). Medeiros mass, smaller motor.' },
      { name: 'Roman Khrennikov', value: '68', why: "Field's biggest engine, but 103kg is the tax a 7.2km run collects." },
    ],
    women: [
      { name: 'Haley Adams', value: '82', why: '82 engine at 64kg. Best motor and lightest frame, the ideal run build.' },
      { name: 'Emma Lawson', value: '77', why: 'Balanced aerobic card at 64kg. Light and steady over distance.' },
      { name: 'Mirjam von Rohr', value: '76', why: 'Field-high 83 engine; distance lets her sustained output show.' },
      { name: 'Lucy Campbell', value: '74', why: '81 engine at 73kg. Elite motor, a touch more to carry.' },
      { name: 'Danielle Brandon', value: '72', why: '75 monostructural, 74 oxidative at 68kg. Better runner than her rep.' },
    ],
  },
  {
    id: 'event1-hopper',
    label: 'Event 1 - The 2007 Hopper',
    eventKicker: 'Event 1 - The 2007 Hopper',
    eventLine: '1,000m row, then 5 rounds: 25 pull-ups + 7 push jerks (135/85). For time.',
    note: 'Score is the mean placement percentile, the percent of the 60-athlete field beaten, on the domains this workout taxes. A fit read, not a result prediction.',
    men: [
      { name: 'Roman Khrennikov', value: '80', why: '90th-pct bodyweight, 81 metabolic. Built to grind the pull-up volume.' },
      { name: 'Justin Medeiros', value: '78', why: 'The complete package: 80 weightlifting, 77 gymnastics. Two-time champ.' },
      { name: 'Ricky Garard', value: '75', why: '77 metabolic and bodyweight. Motors through the middle.' },
      { name: 'Patrick Vellner', value: '73', why: '78 gymnastics, 77 weightlifting. The pull-ups and jerks suit him.' },
      { name: 'James Sprague', value: '73', why: '79 bodyweight, young engine. Fast hands on the barbell.' },
    ],
    women: [
      { name: 'Haley Adams', value: '79', why: '82 engine, 85 bodyweight. The biggest engine in the field.' },
      { name: 'Lucy Campbell', value: '78', why: '83 gymnastics, 80 engine. The pull-ups are her room.' },
      { name: 'Emma Lawson', value: '76', why: 'Balanced: 80 bodyweight, 76 gymnastics, 75 engine.' },
      { name: 'Mirjam von Rohr', value: '75', why: '82 engine, projected #1 overall. Holds output late.' },
      { name: 'Danielle Brandon', value: '73', why: '78 bodyweight, 75 gymnastics. Sharp on the rig.' },
    ],
  },
]

// Multi-slide IG carousels. Every fact is grounded in the sourced events tracker
// and the cited Castro coverage (see /games/2026/events). cover -> points -> cta.
type Slide =
  | { type: 'cover'; kicker: string; headline: string; sub: string }
  | { type: 'point'; num: number; kicker: string; headline: string; body: string; source: string }
  | { type: 'cta'; headline: string; body: string }
type Carousel = { id: string; label: string; caption: string; slides: Slide[] }
const CAROUSELS: Carousel[] = [
  {
    id: 'event13-sprint',
    label: 'Event 13 - The 500m Sprint',
    caption:
      "🏃 EVENT 13 = A 500-METER SPRINT. The official Games workouts page just published it: one maximal run, ~90 seconds all-out, in the back half of the weekend on tired legs.\n\nHere's the thing: the Games have RUN this race before. The 2021 550-yard sprint - virtually the same distance - was WON by Guilherme Malheiros (1:15.37), with Vellner 3rd and Saxon Panchik 4th. And Ricky Garard won 2024 Track and Field outright with Khrennikov 3rd.\n\nHistory-first read: Men - Gui, Garard, Vellner, Roman, Saxon. Women - Haley Adams owns the best sprint resume in the field (3rd 2021, 2nd 2024), then Brandon (real track/D1 past) and Lawson. Swipe for the receipts. Full breakdown at the link in bio. A history + model read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Event 13', headline: 'THE 500M\nSPRINT', sub: 'One maximal run, published on the official workouts page. Who is built for 90 seconds all-out? Swipe.' },
      { type: 'point', num: 1, kicker: 'The Test', headline: 'NO PLACE\nTO HIDE', body: 'A 500-meter sprint, full stop. No barbell, no rig, no strategy layer. The first pure footrace-at-speed this field has faced at the Games, landing after 12 events of banked fatigue.', source: 'games.crossfit.com (official workouts page)' },
      { type: 'point', num: 2, kicker: 'The Physiology', headline: '90 SECONDS\nOF BURN', body: 'Too long for a pure burst, way too short to settle in: roughly 75-100 seconds of maximal output is peak GLYCOLYTIC territory. Cover the first 200 fast, then race who slows down least.', source: 'Persistence Athletics / L1 energy systems' },
      { type: 'point', num: 3, kicker: 'The receipts - Men', headline: 'GUI WON\nTHIS RACE', body: 'The Games ran this in 2021: a 550-YARD sprint. Guilherme Malheiros WON it (1:15.37), Vellner 3rd, Saxon 4th. And Garard won 2024 Track and Field outright with Khrennikov 3rd. History first: Gui, Garard, Vellner, Roman, Saxon.', source: 'Official Games leaderboards (2021, 2024)' },
      { type: 'point', num: 4, kicker: 'The receipts - Women', headline: 'ADAMS HAS\nTHE RESUME', body: '1. Adams (3rd in the 2021 sprint, 2nd in 2024 Track and Field - behind only Toomey both times, and Toomey is not here) 2. Brandon (best sprint score + a real track/D1 past) 3. Lawson (best measured speed) 4. von Rohr 5. Raptis.', source: 'Official Games leaderboards + model' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'What 500 meters actually tests, the full method, and both boards are on the site. A model read, not a result prediction.' },
    ],
  },
  {
    id: 'prep-watch',
    label: 'Prep Watch - 10 Days Out',
    caption:
      "⏱️ 10 DAYS OUT. The 2026 field is deep in final prep and it is all over your feed. Dave Castro has tipped enough of the weekend that the training focus is no longer a secret. Here is what is HOT.\n\n💍 The ring skills: a MU-to-forward-roll-to-support and a backward roll to support. The reveal landed AFTER athletes were already testing them on IG. Rewards the real gymnasts.\n🏃 Ranch 7200: a 7.2km trail run. Nobody trained a run indoors all season.\n🏋️ The CrossFit Total: max-out season, three 50-point lifts.\n🏊 A pool is back.\n\nSwipe for who our model likes on the hottest test. Full Prep Watch at the link in bio. A model read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Prep Watch', headline: '10 DAYS\nOUT', sub: 'The 2026 field is deep in prep and posting it. Here is what is hot, and who is built for it. Swipe.' },
      { type: 'point', num: 1, kicker: "What's Hot", headline: 'THE RING\nSKILLS', body: 'Castro unveiled two never-tested still-rings skills: a muscle-up into a forward roll to support, and a backward roll to support. The tell: the reveal landed after athletes were already testing them on IG. Everyone owns the base and had two weeks to drill.', source: 'The Barbell Spin + CrossFit' },
      { type: 'point', num: 2, kicker: 'Event 2', headline: 'THE RANCH\nRUN', body: 'A 7,200m trail run for time, about 4.5 miles of Aromas dirt. The whole season was indoor machine-and-barbell racing, so nobody has a measured trail time. That is why the trail miles are everywhere right now.', source: 'Persistence Athletics' },
      { type: 'point', num: 3, kicker: 'Events 3-5', headline: "MAX-OUT\nSEASON", body: 'The CrossFit Total: 1RM back squat, strict press and deadlift, three 50-point events. The prep footage is full of heavy singles. The strict press is the wild card almost nobody has real data on.', source: 'Persistence Athletics' },
      { type: 'point', num: 4, kicker: 'Who to Watch', headline: 'BUILT FOR\nTHE RINGS', body: 'Men: Vellner and Hoffer, the field\'s two former artistic gymnasts. Women: rings specialist Sturt and USAG Level 9 gymnast Domit. Dark horse: Mertens, who drills the backward roll to support in the Grid league.', source: 'Persistence Athletics model' },
      { type: 'cta', headline: 'FULL\nPREP WATCH', body: 'What every revealed test demands, and who our model reads as built for it, is on the site. A model read, not a result prediction.' },
    ],
  },
  {
    id: 'rings-reveal',
    label: 'Ring Skills Reveal',
    caption:
      "💍 CASTRO'S RING TEST. On the Girls Unfiltered podcast + a social post (demoed by Trista Smith & Jacob Marlow), Dave Castro unveiled TWO never-before-tested ring gymnastics skills for a midday Sunday event at the 2026 Games.\n\n1) A ring muscle-up straight into a forward roll to support.\n2) A backward roll to support (a United Grid League staple).\n\nBut this is NOT a wildcard nobody can do. The whole field already owns the base (strict ring muscle-ups, skin-the-cats, strict ring HSPU) and has two weeks to drill the new pieces, so it rewards the real gymnasts. We checked every athlete's background. Men: Vellner + Hoffer (former artistic gymnasts). Women: Sturt (rings) + Domit (USAG Level 9). Swipe. Full breakdown at the link in bio. A background read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Games News', headline: 'THE RING\nCURVEBALL', sub: 'Castro unveiled two ring skills the Games have NEVER tested, for midday Sunday. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Reveal', headline: 'TWO NEW\nRING SKILLS', body: 'On the Girls Unfiltered podcast and a social post (demoed by Trista Smith and Jacob Marlow), Castro confirmed rings as a centerpiece skill test, with two movements never tested at the Games.', source: 'CF Network News' },
      { type: 'point', num: 2, kicker: 'Skill 1', headline: 'MUSCLE-UP TO\nFORWARD ROLL', body: 'A ring muscle-up straight into a forward roll on the rings, finishing locked out in a support at the top. One continuous, high-control sequence, no stop-and-reset.', source: 'CF Network News' },
      { type: 'point', num: 3, kicker: 'Skill 2', headline: 'BACKWARD ROLL\nTO SUPPORT', body: 'Roll backward through the rings to finish in a straight-arm support. Rare in CrossFit, but a staple of the United Grid League. CrossFit lists ring dips and a strict muscle-up as prerequisites.', source: 'CrossFit coaching' },
      { type: 'point', num: 4, kicker: 'Why it matters', headline: 'NOT A\nWILDCARD', body: 'The whole field already owns the base: strict ring muscle-ups, skin-the-cats, strict ring HSPU. The two new pieces are additions, not a foreign language, and everyone gets two weeks to drill them. So it rewards whoever builds them cleanest: the real gymnasts.', source: 'Persistence Athletics' },
      { type: 'point', num: 5, kicker: 'We checked the backgrounds', headline: 'VELLNER.\nHOFFER.', body: 'Men: Vellner and Hoffer are former artistic gymnasts (Hoffer trained from age 3; his model score badly underrates him), then Khrennikov, Medeiros, Mertens. Women: rings specialist Sturt, then gymnasts Domit, Wilkinson, Brandon, Adams.', source: 'Persistence Athletics' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'What the two skills are, why the base is universal, and who each athlete is by real gymnastics background is on the site. A background read, not a result prediction.' },
    ],
  },
  {
    id: 'day1-preview',
    label: 'Day 1 - Five Events',
    caption:
      "🔥 DAY 1 OF THE 2026 GAMES = FIVE EVENTS IN ONE DAY. The field opens at the Ranch (Aromas) on Wed July 22 with a metcon (The 2007 Hopper), a 7,200m trail run (Ranch 7200), and three max lifts (The CrossFit Total).\n\nThe demands fight each other, a light runner vs a heavy lifter, so we scored who has the BREADTH to survive all five. Men: Medeiros. Women: Lawson.\n\nSwipe, then read the full Day 1 breakdown at the link in bio. A model read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Day 1 - July 22', headline: 'FIVE EVENTS,\nONE DAY', sub: 'The Games open at the Ranch with a metcon, a 7.2km run and three max lifts. Who survives it? Swipe.' },
      { type: 'point', num: 1, kicker: 'The Opening Day', headline: 'METCON. RUN.\nMAX LIFTS.', body: 'Day 1 (Wed July 22) is five scored events: The 2007 Hopper (E1), Ranch 7200 (E2, a 7,200m trail run), and The CrossFit Total (E3-5, max back squat, press, deadlift). All at the off-site Ranch venues.', source: 'CrossFit Games (official)' },
      { type: 'point', num: 2, kicker: 'The Catch', headline: 'THE DEMANDS\nFIGHT', body: 'The run rewards a light frame and a deep engine. The Total rewards raw mass and strength. A 65kg runner and a 100kg squatter are different species, and Day 1 asks you to be both. Nobody wins all five.', source: 'Persistence Athletics model' },
      { type: 'point', num: 3, kicker: 'Men - Best Breadth', headline: 'JUSTIN\nMEDEIROS', body: 'The two-time champ reads top-3 in the metcon, the run AND the strength, with no domain below the 77th percentile. The complete Day-1 athlete. Khrennikov is next; the long run is his one tax.', source: 'Persistence Athletics model' },
      { type: 'point', num: 4, kicker: 'Women - Best Breadth', headline: 'EMMA\nLAWSON', body: 'No weakness, nothing under the 67th percentile across all five. Adams and Campbell have the biggest engines but the max lifts are their hole. von Rohr scores on the run AND the strength.', source: 'Persistence Athletics model' },
      { type: 'point', num: 5, kicker: 'The Venue', headline: 'HOME AT\nTHE RANCH', body: 'Day 1 runs at the Aromas ranch, where the Games were born (2007-2009). The 2007 Hopper revives the first-ever Games event, and the original hopper is back. A homecoming before San Jose.', source: 'CrossFit Games history' },
      { type: 'cta', headline: 'FULL DAY 1\nBREAKDOWN', body: 'Who survives all five events, the full breadth score for men and women, is on the site. A model read, not a result prediction.' },
    ],
  },
  {
    id: 'castro-reveals',
    label: 'What Castro has told us',
    caption:
      "🚨 EVERYTHING DAVE CASTRO HAS TOLD US ABOUT THE 2026 GAMES (so far).\n\nThe original hopper is BACK, drawn live July 24. Swimming returns in a pool. Cycling's back. The Pig and Snail return. And Big Bob might race down a San Jose street.\n\nSwipe through, then get the full sourced rundown (confirmed vs teased) at the link in bio. We track every reveal as it drops.\n\nClips/quotes via @davecastro6289, CF Network, The Barbell Spin.",
    slides: [
      { type: 'cover', kicker: 'The 2026 Games', headline: 'WHAT CASTRO\nHAS TOLD US', sub: 'Every reveal and tease about the 2026 CrossFit Games programming. Swipe right.' },
      { type: 'point', num: 1, kicker: 'The Headline', headline: 'THE HOPPER\nRETURNS', body: 'The original 2007 peanut-roaster hopper is back. A workout gets drawn LIVE from it on the morning of Friday, July 24, then tested under the lights at SAP Center that night.', source: 'CF Network News' },
      { type: 'point', num: 2, kicker: 'Confirmed', headline: 'SWIMMING,\nIN A POOL', body: 'Not open water. The swim returns presented by TYR, most likely at the Morgan Hill Outdoor Sport Center, the 2020 Games swim venue.', source: 'The Barbell Spin' },
      { type: 'point', num: 3, kicker: 'Confirmed', headline: 'CYCLING\nIS BACK', body: 'Road cycling returns as part of the individual off-site opening on July 22, in the Games tradition of a Ride bike test.', source: 'CrossFit Games' },
      { type: 'point', num: 4, kicker: 'Confirmed', headline: 'PIG & SNAIL\nRETURN', body: 'The Rogue odd-objects are back: the Pig, a heavy rubber-encased block, and the Snail, a hay-bale shape part-filled with sand that shifts as it rolls.', source: 'CrossFit Games' },
      { type: 'point', num: 5, kicker: 'Teased - take with caution', headline: 'BIG BOB.\nTHE RANCH.', body: 'Castro floated a Big Bob drag race down Barack Obama Boulevard, and hinted at extra non-spectator competition days at the Aromas ranch. Hints, not confirmations.', source: 'The Barbell Spin' },
      { type: 'cta', headline: 'FOLLOW EVERY\nREVEAL', body: 'A sourced tracker of all 20 events and everything Castro has said, updated as it drops. Confirmed vs teased, with the receipts.' },
    ],
  },
  {
    id: 'engine-to-win',
    label: 'Who has the engine',
    caption:
      "📊 WHO ACTUALLY HAS THE ENGINE TO WIN SAN JOSE?\n\n20 events across 4 days does not reward one big lift. It rewards the aerobic engine that holds up on day four like it did on day one. We ranked the field on measured aerobic, monostructural and sustained-output performance, from real 2026 Open + Quarterfinals + every prior Games.\n\nSwipe for who tops it (and the sleeper the numbers love). Full breakdown at the link in bio.\n\nThis is a model read, not a prediction. Every number traces to official results.",
    slides: [
      { type: 'cover', kicker: 'The Breakdown', headline: 'WHO HAS\nTHE ENGINE?', sub: 'The aerobic engines most likely to survive 20 events in 4 days. Ranked from real results. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Men', headline: 'MEDEIROS &\nKHRENNIKOV', body: 'Tied for the top aerobic engine in the men field at the 79th percentile. Medeiros has the most balanced profile; Khrennikov owns the best monostructural mark of any man here (81st).', source: 'Persistence Athletics model' },
      { type: 'point', num: 2, kicker: 'The Women', headline: 'HALEY\nADAMS', body: 'The single biggest engine in either division: an 82nd-percentile sustained-output score. A long, grinding format is exactly what suits her, and the model has her climbing because of it.', source: 'Persistence Athletics model' },
      { type: 'point', num: 3, kicker: 'The Sleeper', headline: 'JAMES\nSPRAGUE', body: 'His engine (74th percentile) outruns his overall capacity. In a 20-event grind, that kind of aerobic base shows up late in the weekend, not early.', source: 'Persistence Athletics model' },
      { type: 'point', num: 4, kicker: 'Why it matters', headline: '4 DAYS.\n20 EVENTS.', body: 'The most events in Games history. The athletes who depend least on a single good day are the ones built to last the whole weekend. The engine is the separator.', source: 'CrossFit Games format' },
      { type: 'cta', headline: 'READ THE\nBREAKDOWN', body: 'The full engine analysis, every athlete and every number, is on the site. Data-grounded, no takes without the numbers.' },
    ],
  },
  {
    id: 'cf-total-preview',
    label: 'Events 3-5 - The CrossFit Total',
    caption:
      "🏋️ EVENTS 3-5 = THE CROSSFIT TOTAL. The Games bring back the Total: 1-rep-max back squat (E3), shoulder press (E4), deadlift (E5), each scored as its own 50-point event. 150 points on the line.\n\nWe went to the tape, real competition maxes from the 2025 Games back squat, the 2023 Rogue and 2026 WFP deadlifts and the 2020 Games press, so here is a leaderboard for every lift plus the overall Total. Estimates are labeled. A strength read, not a result prediction. Full breakdown at the link in bio.\n\nEvent source: the official CrossFit Games workout page.",
    slides: [
      { type: 'cover', kicker: 'Events 3-5', headline: 'THE CROSSFIT\nTOTAL', sub: 'Back squat, shoulder press, deadlift. One rep max each, three 50-point events. A leaderboard for each. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Workout', headline: '3 LIFTS,\n150 POINTS', body: '1-rep-max back squat (E3), strict shoulder press (E4) and deadlift (E5). Each is its own 50-point event. Absolute load wins, bodyweight does not factor. Day 1, Wednesday July 22.', source: 'CrossFit Games (official workout page)' },
      { type: 'point', num: 2, kicker: 'Event 3 - Back Squat', headline: 'MERTENS\n570 LB', body: 'From the 2025 Games 1RM squat: Mertens 570 (a Games record), Mathew 555, Medeiros 512. Women: von Rohr 360 (2025 winner), Greer 355, Fuliano 353.', source: '2025 CrossFit Games + reported' },
      { type: 'point', num: 3, kicker: 'Event 4 - Shoulder Press', headline: 'THE HONEST\nBOARD', body: 'Almost no real strict-press data exists. Real ones: Adler 207, Vellner 200, Medeiros 175 (2020 Games), Adams 127, Gazan 167. The rest are labeled estimates; Khrennikov projects biggest near 240.', source: '2020 Games + estimates' },
      { type: 'point', num: 4, kicker: 'Event 5 - Deadlift', headline: 'CRINGLE\n435 LB', body: 'From the 2023 Rogue and 2026 WFP max deadlifts: Vellner and Magda 595, Medeiros 600, Mathew 605. Women: Cringle pulled 435 at WFP 2026, Gazan won 2023 Rogue at 425, Garnes 425.', source: '2023 Rogue + WFP 2026' },
      { type: 'point', num: 5, kicker: 'Overall Total - Top 3', headline: 'MATHEW.\nGAZAN.', body: 'Squat + press + deadlift: Men, Mathew near 1355, Mertens 1290, Medeiros 1287. Women, Gazan near 912, Black 895, Sturt 879. Gazan is the only woman elite in all three.', source: 'Persistence Athletics model' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'A leaderboard for every lift and the overall Total, with real competition maxes and labeled estimates, is on the site. A strength read, not a result prediction.' },
    ],
  },
  {
    id: 'ranch7200-preview',
    label: 'Event 2 - Ranch 7200',
    caption:
      "🏔️ EVENT 2 = RANCH 7200. On Day 1, the 2026 CrossFit Games send the field off-road at the birthplace of the sport, the Aromas ranch, for a 7,200-meter trail run. For time.\n\nAbout 4.5 miles of dirt, right after the opener.\n\nSwipe for the workout, what it demands, and our model's top 5 for men and women, an aerobic-engine read scaled by power-to-weight (a run punishes body mass). A fit read, not a result prediction. Full breakdown at the link in bio.\n\nEvent source: the official CrossFit Games workout page.",
    slides: [
      { type: 'cover', kicker: 'Event 2', headline: 'RANCH\n7200', sub: 'On Day 1 the field runs off-road where the sport was born: a 7,200m trail run at the Aromas ranch. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Workout', headline: '7,200M\nTRAIL RUN', body: 'A 7,200-meter trail run at the Ranch in Aromas, for time. About 4.5 miles. The second event of the individual competition, Wednesday July 22, at the off-site venues.', source: 'CrossFit Games (official workout page)' },
      { type: 'point', num: 2, kicker: 'What it demands', headline: 'ENGINE +\nLIGHT FRAME', body: 'A pure aerobic test. It rewards a deep engine and a light body to carry it. No barbell, no rig, just running economy over distance, the one event where extra mass is a tax, not an asset.', source: 'Persistence Athletics model' },
      { type: 'point', num: 3, kicker: "Model's top 5 - Men", headline: 'MEN', body: '1. Medeiros  2. Garard  3. Sprague  4. Adler  5. Khrennikov. Medeiros has the best motor-to-mass at 88kg; Khrennikov owns the biggest engine but 103kg is the tax a long run collects.', source: 'Persistence Athletics model' },
      { type: 'point', num: 4, kicker: "Model's top 5 - Women", headline: 'WOMEN', body: '1. Adams  2. Lawson  3. von Rohr  4. Campbell  5. Brandon. Adams pairs the biggest engine in the field with a 64kg frame, the ideal run build.', source: 'Persistence Athletics model' },
      { type: 'point', num: 5, kicker: 'The history', headline: 'BORN AT\nTHE RANCH', body: 'The Ranch hosted the first three Games (2007-2009) on the Castro family property. A roughly 7km trail run also opened Games competition in 2016. The birthplace and the run, together, on day one.', source: 'CrossFit Games history' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'Every athlete, every number, and the model read on Ranch 7200 is on the site. A fit read, not a result prediction.' },
    ],
  },
  {
    id: 'event1-preview',
    label: 'Event 1 - The 2007 Hopper',
    caption:
      "🚨 EVENT 1 = THE 2007 HOPPER. The opening event of the 2026 Games revives the very first event in CrossFit Games history.\n\n1,000m row, then 5 rounds of 25 pull-ups + 7 push jerks (135/85). For time.\n\nSwipe for the workout, what it demands, and our model's top 5 for men and women. It's a model read of who FITS the workout, not a result prediction. Full breakdown at the link in bio.\n\nEvent source: the official CrossFit Games workout page.",
    slides: [
      { type: 'cover', kicker: 'Event 1', headline: 'THE 2007\nHOPPER', sub: 'The opening event of the 2026 Games revives the very first event in Games history. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Workout', headline: 'FOR\nTIME', body: '1,000-meter row, then 5 rounds of: 25 pull-ups and 7 push jerks (135 lb men / 85 lb women). Individual start day, Wednesday July 22.', source: 'CrossFit Games (official workout page)' },
      { type: 'point', num: 2, kicker: 'What it demands', headline: 'ENGINE +\nRIG', body: 'A medium grind: a 1,000m row, then a big pile of pull-ups (125 total) and a light, fast barbell. Aerobic engine and gymnastics stamina decide this one, not raw strength.', source: 'Persistence Athletics model' },
      { type: 'point', num: 3, kicker: "Model's top 5 - Men", headline: 'MEN', body: '1. Khrennikov  2. Medeiros  3. Garard  4. Vellner  5. Sprague. Khrennikov and Medeiros are co-favorites, split by how you weight the light barbell.', source: 'Persistence Athletics model' },
      { type: 'point', num: 4, kicker: "Model's top 5 - Women", headline: 'WOMEN', body: '1. Adams  2. Campbell  3. Lawson  4. von Rohr  5. Brandon. Adams brings the biggest engine in the field; Campbell the best gymnastics.', source: 'Persistence Athletics model' },
      { type: 'point', num: 5, kicker: 'The history', headline: 'BORN AT\nTHE RANCH', body: 'A revival of the opener from the very first CrossFit Games in 2007, held at the Aromas ranch. Fitting, since the original hopper returns this year to draw a workout live.', source: 'CrossFit Games history' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'Every athlete, every number, and the model read on the 2007 Hopper is on the site. A fit read, not a result prediction.' },
    ],
  },
]

// Curated, source-verified news cards. Every claim here is grounded in a real,
// linked story already in the /news feed - keep it that way (null > wrong).
type NewsItem = { id: string; label: string; kicker: string; headline: string; sub: string; bullets: string[]; takeaway: string; source: string }
const NEWS: NewsItem[] = [
  {
    id: 'swimming',
    label: 'Swimming returns',
    kicker: 'Games News',
    headline: 'SWIMMING\nIS BACK',
    sub: 'Swimming returns to the 2026 CrossFit Games.',
    bullets: ['Confirmed back in the Games field', 'A true test across broad time and modal domains', 'Already built into our What-If simulator'],
    takeaway: 'Build a swim workout and see who the model favors. Link in bio.',
    source: 'The Barbell Spin',
  },
  {
    id: 'swim-25m',
    label: 'Swim: 25m pool',
    kicker: 'Confirmed',
    headline: '25-METER\nPOOL',
    sub: 'The Games swim is set: 25-meter pool lengths, presented by TYR.',
    bullets: ['A pool, not open water', '25-meter lengths confirmed', 'Part of the individual off-site opening'],
    takeaway: 'Every event detail, tracked as it drops. Link in bio.',
    source: 'The Barbell Spin',
  },
  {
    id: '20-events',
    label: '20 events / 4 days',
    kicker: 'The Format',
    headline: '20 EVENTS.\n4 DAYS.',
    sub: 'The most scored events in CrossFit Games history.',
    bullets: ['20 scored events (previous record: 15)', 'Four days of competition', 'SAP Center, San Jose - weekend of July 24-26'],
    takeaway: 'Every event, every athlete, tracked all season. Link in bio.',
    source: 'CrossFit Games',
  },
  {
    id: 'programming-teaser',
    label: 'Castro programming clues',
    kicker: 'Programming',
    headline: 'CASTRO\nDROPS CLUES',
    sub: 'A new behind-the-scenes teaser from the Aromas ranch.',
    bullets: ['Dave Castro and crew scouting the terrain', 'Movement combos hinted (some may be misdirection)', 'Castro: weighing handing off event programming'],
    takeaway: 'Full breakdowns and season analytics. Link in bio.',
    source: 'CrossFit Games / CF Network',
  },
  {
    id: 'hopper-returns',
    label: 'The hopper returns',
    kicker: 'Games News',
    headline: 'THE HOPPER\nIS BACK',
    sub: 'The original 2007 hopper returns for a live Friday-night draw.',
    bullets: ['The old peanut-roaster used at the first 2007 Games', 'A workout drawn LIVE from it on Friday, July 24', 'Tested that night under the lights at SAP Center'],
    takeaway: 'Every reveal, tracked and sourced. Link in bio.',
    source: 'CF Network News',
  },
  {
    id: 'the-breakdown',
    label: 'Promo: The Breakdown',
    kicker: 'New on the site',
    headline: 'THE\nBREAKDOWN',
    sub: 'Data-grounded analysis of the 2026 Games. No takes without the numbers.',
    bullets: ['Who actually has the engine to win San Jose', 'What swimming and cycling change, by profile', 'Every number traces to the model'],
    takeaway: 'Read the first breakdowns. Link in bio.',
    source: 'Persistence Athletics',
  },
  {
    id: 'events-tracker',
    label: 'Promo: 20 Events tracker',
    kicker: 'New on the site',
    headline: 'THE 20\nEVENTS',
    sub: 'A live tracker of the 2026 Games programming as it gets revealed.',
    bullets: ['20 scored events across 4 days, the most ever', 'Confirmed, revealed and teased, each with its source', 'Updated as every event drops'],
    takeaway: 'Follow every reveal. Link in bio.',
    source: 'Persistence Athletics',
  },
]

const HUB_URL = 'wod.persistenceathletics.com/games/2026'
const HANDLE = '@cf_games_update'
const HASHTAGS = '#CrossFitGames #CrossFitGames2026 #CrossFit #RoadToSanJose'

const GREEN = '#91C640'
const DGREEN = '#019644'
const INK = '#f4f6f2'
const DIM = 'rgba(244,246,242,0.62)'

function daysToGames(): number {
  const target = new Date('July 24, 2026 00:00:00')
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000))
}

// Season-form standings from the projected stage (placement-sum, lower = better)
function formStandings(division: Division) {
  const stage = G.results?.['2026']?.stages?.games
  if (!stage) return []
  return stage.divisions[division].slice(0, 10)
}

// Photo lookup across the qualified field + supplementary headshots (Open-top-30
// athletes who appear in form standings but aren't Games-qualified yet)
const EXTRA: Record<string, string> = photosExtra as Record<string, string>
function photoFor(name: string): string | null {
  const k = name.toLowerCase().trim()
  return allAthletes2026.find((x) => x.name.toLowerCase() === k)?.photoUrl ?? EXTRA[k] ?? null
}

// Load an image as an inline data URL (fresh fetch, bypasses the browser cache).
// This is what makes the html-to-image export reliable: the photo is embedded in
// the DOM, so there is no cross-origin canvas taint, no stale-cache (e.g. an old
// headshot), and no race between clicking Download and the image finishing load.
function useObjectImage(url: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    if (!url) return
    fetch(url, { cache: 'reload' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(
        (blob) =>
          new Promise<string>((res, rej) => {
            const fr = new FileReader()
            fr.onload = () => res(fr.result as string)
            fr.onerror = rej
            fr.readAsDataURL(blob)
          }),
      )
      .then((d) => !cancelled && setDataUrl(d))
      .catch(() => !cancelled && setDataUrl(null))
    return () => {
      cancelled = true
    }
  }, [url])
  return dataUrl
}

function RoundPhoto({ name, size }: { name: string; size: number }) {
  const data = useObjectImage(photoFor(name))
  return data ? (
    <img src={data} alt="" style={{ width: size, height: size, objectFit: 'cover', objectPosition: 'center 22%', borderRadius: 999 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 999, background: monogramColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Anton', sans-serif", fontSize: size * 0.36, color: '#fff' }}>
      {initials(name)}
    </div>
  )
}

const cardBg: React.CSSProperties = {
  width: 1080,
  height: 1350,
  background:
    'radial-gradient(120% 90% at 85% -10%, rgba(1,150,68,0.38) 0%, transparent 55%), radial-gradient(80% 70% at 10% 110%, rgba(145,198,64,0.20) 0%, transparent 60%), linear-gradient(160deg, #0b0e10 0%, #07090b 100%)',
  color: INK,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: "'Barlow Condensed', sans-serif",
  position: 'relative',
  overflow: 'hidden',
}

function CardHeader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '44px 56px 0' }}>
      <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 34, letterSpacing: 1, textTransform: 'uppercase' }}>
        <span style={{ color: INK }}>CF GAMES </span>
        <span style={{ color: GREEN }}>UPDATE</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: DIM }}>{HANDLE}</div>
    </div>
  )
}

function CardFooter() {
  return (
    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 56px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src="/pa-logo.png" alt="" style={{ width: 44, height: 44, borderRadius: 999, background: '#fff', padding: 4 }} crossOrigin="anonymous" />
        <span style={{ fontSize: 24, letterSpacing: 1.5, textTransform: 'uppercase', color: DIM }}>by Persistence Athletics</span>
      </div>
      <span style={{ fontSize: 24, color: GREEN, letterSpacing: 0.5 }}>{HUB_URL}</span>
    </div>
  )
}

function Photo({ a, size, radius = 28 }: { a: GamesAthlete2026; size: number; radius?: number }) {
  const data = useObjectImage(a.photoUrl ?? null)
  return data ? (
    <img src={data} alt="" style={{ width: size, height: size * 1.18, objectFit: 'cover', objectPosition: 'center 20%', borderRadius: radius, border: `3px solid rgba(145,198,64,0.5)` }} />
  ) : (
    <div style={{ width: size, height: size * 1.18, borderRadius: radius, background: DGREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Anton', sans-serif", fontSize: size * 0.32, color: '#fff' }}>
      {a.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
    </div>
  )
}

function GridPhoto({ a }: { a: GamesAthlete2026 }) {
  const data = useObjectImage(a.photoUrl ?? null)
  return data ? (
    <img src={data} alt="" style={{ width: 88, height: 88, objectFit: 'cover', objectPosition: 'center 22%', borderRadius: 999, border: `2px solid rgba(145,198,64,0.45)` }} />
  ) : (
    <div style={{ width: 88, height: 88, borderRadius: 999, background: DGREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Anton', sans-serif", fontSize: 30, color: '#fff', margin: '0 auto' }}>
      {a.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
    </div>
  )
}

function StatBox({ v, l }: { v: string; l: string }) {
  return (
    <div style={{ flex: 1, background: 'rgba(244,246,242,0.06)', borderRadius: 18, padding: '20px 8px', textAlign: 'center' }}>
      <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 52, color: INK, lineHeight: 1 }}>{v}</div>
      <div style={{ fontSize: 22, letterSpacing: 2.5, textTransform: 'uppercase', color: GREEN, marginTop: 8 }}>{l}</div>
    </div>
  )
}

// ---------- Templates ----------

function SpotlightCard({ a }: { a: GamesAthlete2026 }) {
  const semi = a.semifinalFinish2026 ? a.semifinalFinish2026.replace(/\s*\(.*\)/, '') : 'Qualified'
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '36px 56px 0', display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <Photo a={a} size={330} />
        <div style={{ minWidth: 0, paddingTop: 8 }}>
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: GREEN, marginBottom: 6 }}>Athlete Spotlight</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: a.name.length > 16 ? 64 : 78, textTransform: 'uppercase', lineHeight: 0.95 }}>{a.name}</div>
          <div style={{ fontSize: 32, color: DIM, marginTop: 14 }}>
            {countryFlag(a.country)} {a.country}{a.affiliate ? ` · ${a.affiliate}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            {a.isFormerChampion && (
              <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f5b82e', borderRadius: 12, padding: '10px 18px', fontSize: 26, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>🏆 Former Champion</span>
            )}
            {a.isRookie && (
              <span style={{ background: 'rgba(96,165,250,0.2)', color: '#7db5f8', borderRadius: 12, padding: '10px 18px', fontSize: 26, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>Rookie</span>
            )}
            {a.instagramHandle && <span style={{ color: GREEN, fontSize: 28, padding: '10px 0' }}>{a.instagramHandle}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, padding: '36px 56px 0' }}>
        <StatBox v={a.gamesAppearances ? `${a.gamesAppearances}x` : a.isRookie ? '1st' : '-'} l="Games" />
        <StatBox v={a.bestGamesFinish ? a.bestGamesFinish.replace(/\s*\(.*\)/, '') : 'Debut'} l="Best Finish" />
        <StatBox v={a.firstGamesYear ? String(a.firstGamesYear) : '2026'} l="Since" />
      </div>

      <div style={{ padding: '32px 56px 0' }}>
        <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: GREEN, marginBottom: 14 }}>Road to San Jose</div>
        <div style={{ display: 'flex', gap: 18 }}>
          {[
            ['Open', a.openRank2026 ? `#${a.openRank2026}` : '-'],
            ['Quarterfinal', a.qfRank2026 ? `#${a.qfRank2026}` : '-'],
            [a.semifinalEvent2026 ?? 'Semifinal', semi],
          ].map(([l, v]) => (
            <div key={l} style={{ flex: 1, border: '2px solid rgba(145,198,64,0.35)', borderRadius: 18, padding: '18px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, letterSpacing: 2, textTransform: 'uppercase', color: DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 46, color: GREEN, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {a.storyline && (
        <div style={{ padding: '34px 56px 0', fontSize: 30, lineHeight: 1.45, color: 'rgba(244,246,242,0.85)' }}>
          {a.storyline.length > 220 ? a.storyline.slice(0, 217).replace(/\s+\S*$/, '') + '...' : a.storyline}
        </div>
      )}
      <CardFooter />
    </div>
  )
}

function CoverCard() {
  const days = daysToGames()
  const all = allAthletes2026
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '40px 56px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 92, textTransform: 'uppercase', lineHeight: 0.95 }}>
          The 2026<br /><span style={{ color: GREEN }}>CrossFit Games</span>
        </div>
        <div style={{ fontSize: 32, color: DIM, marginTop: 18, letterSpacing: 2 }}>SAP CENTER · SAN JOSE · JULY 24-26</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 60, padding: '34px 56px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 84, color: GREEN, lineHeight: 1 }}>{days}</div>
          <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: DIM }}>days to go</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 84, color: INK, lineHeight: 1 }}>{all.length}</div>
          <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: DIM }}>athletes qualified</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 84, color: INK, lineHeight: 1 }}>30</div>
          <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: DIM }}>per division</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', padding: '40px 70px 0' }}>
        {all.map((a) => (
          <div key={a.slug} style={{ width: 92, textAlign: 'center' }}>
            <GridPhoto a={a} />
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', padding: '36px 56px 0', fontSize: 30, color: 'rgba(244,246,242,0.85)' }}>
        Every athlete. Every number. One place.
      </div>
      <CardFooter />
    </div>
  )
}

function H2HCard({ a, b }: { a: GamesAthlete2026; b: GamesAthlete2026 }) {
  const row = (label: string, va: string, vb: string) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '20px 0', borderTop: '1px solid rgba(244,246,242,0.12)' }}>
      <div style={{ flex: 1, fontFamily: "'Anton', sans-serif", fontSize: 44, color: INK, textAlign: 'left' }}>{va}</div>
      <div style={{ width: 320, fontSize: 25, letterSpacing: 2.5, textTransform: 'uppercase', color: DIM, textAlign: 'center' }}>{label}</div>
      <div style={{ flex: 1, fontFamily: "'Anton', sans-serif", fontSize: 44, color: INK, textAlign: 'right' }}>{vb}</div>
    </div>
  )
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ textAlign: 'center', padding: '30px 56px 0', fontSize: 28, letterSpacing: 4, textTransform: 'uppercase', color: GREEN }}>Head to Head</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 56px 0' }}>
        <div style={{ textAlign: 'center', width: 400 }}>
          <Photo a={a} size={290} />
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, textTransform: 'uppercase', marginTop: 16, lineHeight: 1 }}>{a.name}</div>
          <div style={{ fontSize: 26, color: DIM, marginTop: 6 }}>{countryFlag(a.country)} {a.country}</div>
        </div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 56, color: GREEN }}>VS</div>
        <div style={{ textAlign: 'center', width: 400 }}>
          <Photo a={b} size={290} />
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, textTransform: 'uppercase', marginTop: 16, lineHeight: 1 }}>{b.name}</div>
          <div style={{ fontSize: 26, color: DIM, marginTop: 6 }}>{countryFlag(b.country)} {b.country}</div>
        </div>
      </div>
      <div style={{ padding: '36px 64px 0' }}>
        {row('Games', a.gamesAppearances ? `${a.gamesAppearances}x` : '-', b.gamesAppearances ? `${b.gamesAppearances}x` : '-')}
        {row('Best finish', a.bestGamesFinish?.replace(/\s*\(.*\)/, '') ?? '-', b.bestGamesFinish?.replace(/\s*\(.*\)/, '') ?? '-')}
        {row('2026 Open', a.openRank2026 ? `#${a.openRank2026}` : '-', b.openRank2026 ? `#${b.openRank2026}` : '-')}
        {row('Quarterfinal', a.qfRank2026 ? `#${a.qfRank2026}` : '-', b.qfRank2026 ? `#${b.qfRank2026}` : '-')}
        {row('Semifinal', a.semifinalFinish2026?.replace(/\s*\(.*\)/, '') ?? '-', b.semifinalFinish2026?.replace(/\s*\(.*\)/, '') ?? '-')}
      </div>
      <CardFooter />
    </div>
  )
}

function FormCard({ division }: { division: Division }) {
  const rows = formStandings(division)
  const max = rows.length ? Math.max(...rows.map((r) => r.totalPoints)) : 1
  const min = rows.length ? Math.min(...rows.map((r) => r.totalPoints)) : 0
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '34px 56px 0' }}>
        <div style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: GREEN }}>Season Form · {division}</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 64, textTransform: 'uppercase', lineHeight: 1, marginTop: 6 }}>Who's Hottest<br />Right Now</div>
        <div style={{ fontSize: 25, color: DIM, marginTop: 12 }}>Open + Quarterfinals combined, all 7 tests, top 30 cohort</div>
      </div>
      <div style={{ padding: '30px 56px 0' }}>
        {rows.map((r, i) => {
          const w = 30 + (1 - (r.totalPoints - min) / Math.max(1, max - min)) * 64
          return (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '9px 0' }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 36, width: 50, color: i < 3 ? GREEN : DIM, textAlign: 'center' }}>{i + 1}</div>
              <RoundPhoto name={r.name} size={62} />
              <div style={{ width: 330, fontFamily: "'Anton', sans-serif", fontSize: 34, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ flex: 1, height: 26, background: 'rgba(244,246,242,0.07)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ width: `${w}%`, height: '100%', borderRadius: 8, background: `linear-gradient(90deg, ${DGREEN}, ${GREEN})` }} />
              </div>
            </div>
          )
        })}
      </div>
      <CardFooter />
    </div>
  )
}

function PicksCard({ set, division }: { set: PickSet; division: Division }) {
  const rows = division === 'men' ? set.men : set.women
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '30px 56px 0' }}>
        <div style={{ fontSize: 24, letterSpacing: 4, textTransform: 'uppercase', color: GREEN }}>{set.eventKicker}</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 66, textTransform: 'uppercase', lineHeight: 0.98, marginTop: 8 }}>Model's Top 5<br /><span style={{ color: GREEN }}>{division}</span></div>
        <div style={{ fontSize: 23, color: DIM, marginTop: 12, lineHeight: 1.3 }}>{set.eventLine}</div>
      </div>
      <div style={{ padding: '26px 56px 0' }}>
        {rows.map((r, i) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0', borderTop: i ? '1px solid rgba(244,246,242,0.1)' : 'none' }}>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 40, width: 44, color: i < 3 ? GREEN : DIM, textAlign: 'center' }}>{i + 1}</div>
            <RoundPhoto name={r.name} size={78} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 34, textTransform: 'uppercase', lineHeight: 1 }}>{r.name}</div>
              <div style={{ fontSize: 22, color: 'rgba(244,246,242,0.8)', marginTop: 4, lineHeight: 1.25 }}>{r.why}</div>
            </div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 40, color: GREEN }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '18px 56px 0', fontSize: 21, color: DIM, letterSpacing: 0.5 }}>{set.note}</div>
      <CardFooter />
    </div>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '40px 56px 0' }}>
        <div style={{ fontSize: 28, letterSpacing: 5, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>{item.kicker}</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 116, textTransform: 'uppercase', lineHeight: 0.92, marginTop: 14, whiteSpace: 'pre-line' }}>{item.headline}</div>
        <div style={{ fontSize: 36, color: INK, marginTop: 22, lineHeight: 1.25, maxWidth: 900 }}>{item.sub}</div>
      </div>
      <div style={{ padding: '38px 56px 0' }}>
        {item.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '15px 0', borderTop: i ? '1px solid rgba(244,246,242,0.12)' : 'none' }}>
            <div style={{ width: 15, height: 15, borderRadius: 999, background: GREEN, marginTop: 11, flexShrink: 0 }} />
            <div style={{ fontSize: 33, color: 'rgba(244,246,242,0.92)', lineHeight: 1.2 }}>{b}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: '34px 56px 0', background: 'rgba(145,198,64,0.12)', border: '1px solid rgba(145,198,64,0.4)', borderRadius: 18, padding: '26px 30px' }}>
        <div style={{ fontSize: 31, color: INK, lineHeight: 1.3 }}>{item.takeaway}</div>
      </div>
      <div style={{ padding: '22px 56px 0', fontSize: 23, color: DIM, letterSpacing: 1 }}>Source: {item.source}</div>
      <CardFooter />
    </div>
  )
}

// Story cards (9:16, 1080x1920) that promote a Breakdown post and drive traffic
// to the blog. One per analysis post, generated from the posts themselves.
type Story = { id: string; kicker: string; title: string; hook: string; url: string }
const ANALYSIS_BASE = HUB_URL.replace('/2026', '/analysis')
const STORIES: Story[] = (analysisPosts as { slug: string; title: string; dek: string; category: string; date: string }[])
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .map((p) => ({ id: p.slug, kicker: p.category, title: p.title, hook: p.dek, url: `${ANALYSIS_BASE}/${p.slug}` }))

const storyBg: React.CSSProperties = { ...cardBg, height: 1920 }
function StoryCard({ story }: { story: Story }) {
  const titleSize = story.title.length > 46 ? 74 : story.title.length > 34 ? 86 : 100
  return (
    <div style={storyBg}>
      <CardHeader />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px' }}>
        <div style={{ fontSize: 30, letterSpacing: 6, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>The Breakdown</div>
        <div style={{ fontSize: 25, letterSpacing: 3, textTransform: 'uppercase', color: DIM, marginTop: 6, marginBottom: 30 }}>{story.kicker}</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: titleSize, textTransform: 'uppercase', lineHeight: 0.98 }}>{story.title}</div>
        <div style={{ fontSize: 40, color: INK, marginTop: 34, lineHeight: 1.32, maxWidth: 940 }}>{story.hook}</div>
        <div style={{ marginTop: 56 }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 52, color: GREEN, textTransform: 'uppercase' }}>Read the full breakdown &rarr;</div>
          <div style={{ fontSize: 33, color: DIM, marginTop: 10, letterSpacing: 0.5 }}>{story.url}</div>
        </div>
        <div style={{ marginTop: 46, alignSelf: 'flex-start', background: 'rgba(145,198,64,0.14)', border: '1px solid rgba(145,198,64,0.45)', borderRadius: 20, padding: '22px 34px' }}>
          <div style={{ fontSize: 34, color: GREEN, fontWeight: 600 }}>Link in bio &middot; {HANDLE}</div>
        </div>
      </div>
      <CardFooter />
    </div>
  )
}

function SlideDots({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '0 56px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === index ? 34 : 12, height: 12, borderRadius: 999, background: i === index ? GREEN : 'rgba(244,246,242,0.22)' }} />
      ))}
    </div>
  )
}

function CarouselSlide({ slide, index, total }: { slide: Slide; index: number; total: number }) {
  return (
    <div style={cardBg}>
      <CardHeader />
      {slide.type === 'cover' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ fontSize: 28, letterSpacing: 5, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>{slide.kicker}</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 120, textTransform: 'uppercase', lineHeight: 0.92, marginTop: 16, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ fontSize: 36, color: INK, marginTop: 26, lineHeight: 1.3, maxWidth: 880 }}>{slide.sub}</div>
          <div style={{ marginTop: 40, fontSize: 30, color: GREEN, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Swipe &rarr;</div>
        </div>
      )}
      {slide.type === 'point' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
            <div style={{ width: 86, height: 86, borderRadius: 20, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Anton', sans-serif", fontSize: 50, color: '#0a0a0a' }}>{slide.num}</div>
            <div style={{ fontSize: 27, letterSpacing: 3, textTransform: 'uppercase', color: slide.kicker.toLowerCase().includes('teased') ? '#f5b82e' : GREEN, fontWeight: 600 }}>{slide.kicker}</div>
          </div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 104, textTransform: 'uppercase', lineHeight: 0.94, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ fontSize: 37, color: 'rgba(244,246,242,0.92)', marginTop: 28, lineHeight: 1.32, maxWidth: 920 }}>{slide.body}</div>
          <div style={{ marginTop: 26, fontSize: 23, color: DIM, letterSpacing: 1 }}>Source: {slide.source}</div>
        </div>
      )}
      {slide.type === 'cta' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 110, textTransform: 'uppercase', lineHeight: 0.94, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ fontSize: 37, color: INK, marginTop: 26, lineHeight: 1.32, maxWidth: 900 }}>{slide.body}</div>
          <div style={{ marginTop: 38, background: 'rgba(145,198,64,0.12)', border: '1px solid rgba(145,198,64,0.4)', borderRadius: 18, padding: '26px 30px' }}>
            <div style={{ fontSize: 33, color: GREEN, fontWeight: 600 }}>Link in bio &middot; {HANDLE}</div>
            <div style={{ fontSize: 26, color: DIM, marginTop: 6 }}>{HUB_URL}/events</div>
          </div>
        </div>
      )}
      <div style={{ paddingBottom: 28 }}><SlideDots index={index} total={total} /></div>
      <CardFooter />
    </div>
  )
}

// ---------- Captions ----------

function captionFor(t: Template, a: GamesAthlete2026 | undefined, b: GamesAthlete2026 | undefined, division: Division, news?: NewsItem, carousel?: Carousel, pickSet?: PickSet, story?: Story): string {
  if (t === 'story' && story) {
    return `📊 NEW ON THE BREAKDOWN\n\n${story.title}\n\n${story.hook}\n\nRead it: ${story.url}\n\n${HASHTAGS}`
  }
  if (t === 'picks' && pickSet) {
    const rows = division === 'men' ? pickSet.men : pickSet.women
    return `🎯 ${pickSet.eventKicker.toUpperCase()} - THE MODEL'S TOP 5 (${division.toUpperCase()})\n\n${pickSet.eventLine}\n\n${rows.map((r, i) => `${i + 1}. ${r.name}`).join('\n')}\n\nWho you got? This is a model read of who fits the workout, not a result prediction. Full breakdown + every athlete at the link in bio.\n\n${HASHTAGS}`
  }
  if (t === 'carousel' && carousel) {
    return `${carousel.caption}\n\n${HASHTAGS}`
  }
  if (t === 'news' && news) {
    return `🚨 ${news.sub.toUpperCase()}\n\n${news.bullets.map((x) => `• ${x}`).join('\n')}\n\n${news.takeaway}\n\nSource: ${news.source}\n\n${HASHTAGS}`
  }
  const tagLine = (x?: GamesAthlete2026) => (x?.instagramHandle ? ` ${x.instagramHandle}` : '')
  if (t === 'spotlight' && a) {
    return `🎯 ATHLETE SPOTLIGHT: ${a.name.toUpperCase()} ${countryFlag(a.country)}\n\n${a.storyline ?? ''}\n\n${a.gamesAppearances ? `${a.gamesAppearances}x Games athlete` : 'Games rookie'}${a.bestGamesFinish ? ` · best finish ${a.bestGamesFinish}` : ''}\nRoad to San Jose: Open #${a.openRank2026 ?? '-'} · QF #${a.qfRank2026 ?? '-'} · ${a.semifinalEvent2026 ?? 'Semifinal'} ${a.semifinalFinish2026?.replace(/\s*\(.*\)/, '') ?? ''}\n\nFull profile, every athlete, every stat: link in bio${tagLine(a)}\n\n${HASHTAGS}`
  }
  if (t === 'h2h' && a && b) {
    return `⚔️ ${a.name.toUpperCase()} vs ${b.name.toUpperCase()}\n\nTwo roads to San Jose. One floor. Who you got?\n\nFull breakdowns: link in bio${tagLine(a)}${tagLine(b)}\n\n${HASHTAGS}`
  }
  if (t === 'form') {
    return `📊 WHO'S HOTTEST RIGHT NOW (${division.toUpperCase()})\n\nOpen + Quarterfinals combined, all 7 tests. This is season form, not a prediction. The Games floor decides the rest.\n\nFull analytics: link in bio\n\n${HASHTAGS}`
  }
  return `🚨 THE 2026 CROSSFIT GAMES FIELD IS SET. EVERY ATHLETE. EVERY NUMBER. ONE PLACE.\n\n30 men + 30 women have punched their ticket to San Jose. We built the most complete tracker of the 2026 season - free, no login:\n🏆 All 60 qualified athletes - full profiles, photos, complete Games history\n🛣️ Every road to San Jose: Open → Quarterfinals → Semifinal, scored event by event\n🎙️ Dave Castro's athlete interviews, embedded as they drop\n📊 Capacity analytics + a projected leaderboard nobody else has\n\nSan Jose. July 24-26. ${daysToGames()} days.\n\n🔗 Link in bio\n\n${HASHTAGS}`
}

// ---------- Studio shell ----------

export default function CardStudio() {
  const params = new URLSearchParams(window.location.search)
  const [template, setTemplate] = useState<Template>((params.get('t') as Template) || 'spotlight')
  const [division, setDivision] = useState<Division>((params.get('d') as Division) || 'men')
  const roster = division === 'men' ? A2026.men : A2026.women
  const [slugA, setSlugA] = useState(params.get('a') || roster[0].slug)
  const [slugB, setSlugB] = useState(params.get('b') || roster[1].slug)
  const [newsId, setNewsId] = useState(params.get('n') || NEWS[0].id)
  const [carouselId, setCarouselId] = useState(params.get('c') || CAROUSELS[0].id)
  const [slideIdx, setSlideIdx] = useState(Number(params.get('s') || 0))
  const [pickId, setPickId] = useState(params.get('p') || PICKS[0].id)
  const [storyId, setStoryId] = useState(params.get('st') || STORIES[0].id)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const a = useMemo(() => allAthletes2026.find((x) => x.slug === slugA) ?? roster[0], [slugA, roster])
  const b = useMemo(() => allAthletes2026.find((x) => x.slug === slugB) ?? roster[1], [slugB, roster])
  const newsItem = useMemo(() => NEWS.find((x) => x.id === newsId) ?? NEWS[0], [newsId])
  const carousel = useMemo(() => CAROUSELS.find((x) => x.id === carouselId) ?? CAROUSELS[0], [carouselId])
  const slideClamped = Math.max(0, Math.min(slideIdx, carousel.slides.length - 1))
  const pickSet = useMemo(() => PICKS.find((x) => x.id === pickId) ?? PICKS[0], [pickId])
  const story = useMemo(() => STORIES.find((x) => x.id === storyId) ?? STORIES[0], [storyId])
  const caption = captionFor(template, a, b, division, newsItem, carousel, pickSet, story)

  const download = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      // Wait for every image in the card to be fully loaded + decoded before we
      // rasterize, so a card is never exported with a missing/half-loaded photo
      // (photos are inline data URLs via useObjectImage, so this settles fast).
      const imgs = Array.from(cardRef.current.querySelectorAll('img'))
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((res) => {
                img.onload = () => res()
                img.onerror = () => res()
              }),
        ),
      )
      await Promise.all(imgs.map((img) => img.decode?.().catch(() => {})))
      await new Promise((r) => setTimeout(r, 120))
      // double-render to ensure fonts settle
      const exportH = template === 'story' ? 1920 : 1350
      await toPng(cardRef.current, { width: 1080, height: exportH, pixelRatio: 1 })
      const url = await toPng(cardRef.current, { width: 1080, height: exportH, pixelRatio: 1 })
      const link = document.createElement('a')
      link.download = template === 'spotlight' ? `${a.slug}-spotlight.png` : template === 'h2h' ? `${a.slug}-vs-${b.slug}.png` : template === 'news' ? `news-${newsItem.id}.png` : template === 'carousel' ? `carousel-${carousel.id}-${String(slideClamped + 1).padStart(2, '0')}.png` : template === 'picks' ? `picks-${pickSet.id}-${division}.png` : template === 'story' ? `story-${story.id}.png` : `${template}-${division}.png`
      link.href = url
      link.click()
    } finally {
      setBusy(false)
    }
  }

  const copyCaption = () => navigator.clipboard.writeText(caption)

  return (
    <div className="pt-6 pb-10">
      <div className="games-condensed text-[11px] uppercase tracking-[0.2em] text-[#91C640] mb-1">Internal tool</div>
      <h1 className="games-display text-3xl text-[var(--text-primary)] mb-1">Card Studio</h1>
      <p className="text-[12.5px] text-[var(--text-secondary)] mb-5 max-w-2xl">
        Pick a template, download the 1080x1350 PNG, copy the caption, post to {HANDLE}. Tags use verified handles only.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select value={template} onChange={(e) => setTemplate(e.target.value as Template)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <div className="flex items-center rounded-lg border border-[var(--panel-border)] overflow-hidden">
          {(['men', 'women'] as const).map((d) => (
            <button key={d} onClick={() => { setDivision(d); const r = d === 'men' ? A2026.men : A2026.women; setSlugA(r[0].slug); setSlugB(r[1].slug) }}
              className="games-condensed px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: division === d ? '#019644' : 'transparent', color: division === d ? '#fff' : 'var(--text-secondary)' }}>{d}</button>
          ))}
        </div>
        {(template === 'spotlight' || template === 'h2h') && (
          <select value={slugA} onChange={(e) => setSlugA(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {roster.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
          </select>
        )}
        {template === 'h2h' && (
          <select value={slugB} onChange={(e) => setSlugB(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {roster.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
          </select>
        )}
        {template === 'news' && (
          <select value={newsId} onChange={(e) => setNewsId(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {NEWS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        )}
        {template === 'picks' && (
          <select value={pickId} onChange={(e) => setPickId(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {PICKS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        )}
        {template === 'story' && (
          <select value={storyId} onChange={(e) => setStoryId(e.target.value)} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {STORIES.map((x) => <option key={x.id} value={x.id}>{x.title.slice(0, 42)}</option>)}
          </select>
        )}
        {template === 'carousel' && (
          <>
            <select value={carouselId} onChange={(e) => { setCarouselId(e.target.value); setSlideIdx(0) }} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
              {CAROUSELS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <button onClick={() => setSlideIdx((s) => Math.max(0, s - 1))} className="games-condensed px-3 py-2 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)]">&larr;</button>
              <span className="games-condensed text-[13px] text-[var(--text-secondary)] w-16 text-center">{slideClamped + 1} / {carousel.slides.length}</span>
              <button onClick={() => setSlideIdx((s) => Math.min(carousel.slides.length - 1, s + 1))} className="games-condensed px-3 py-2 rounded-lg border border-[var(--panel-border)] text-[var(--text-secondary)]">&rarr;</button>
            </div>
          </>
        )}
        <button onClick={download} disabled={busy} data-testid="download-card"
          className="games-condensed uppercase tracking-[0.1em] font-semibold text-[13px] px-5 py-2 rounded-lg bg-[#019644] text-white hover:bg-[#01a94d] transition-colors disabled:opacity-50">
          {busy ? 'Rendering...' : 'Download PNG'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-start">
        {/* Preview (scaled) */}
        <div className="rounded-2xl border border-[var(--panel-border)] overflow-hidden" style={{ width: 378, height: template === 'story' ? 672 : 472.5 }}>
          <div style={{ transform: 'scale(0.35)', transformOrigin: 'top left' }}>
            <div ref={cardRef} data-testid="card-canvas">
              {template === 'spotlight' && <SpotlightCard a={a} />}
              {template === 'cover' && <CoverCard />}
              {template === 'h2h' && <H2HCard a={a} b={b} />}
              {template === 'form' && <FormCard division={division} />}
              {template === 'news' && <NewsCard item={newsItem} />}
              {template === 'carousel' && <CarouselSlide slide={carousel.slides[slideClamped]} index={slideClamped} total={carousel.slides.length} />}
              {template === 'picks' && <PicksCard set={pickSet} division={division} />}
              {template === 'story' && <StoryCard story={story} />}
            </div>
          </div>
        </div>

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="games-condensed text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Caption (auto-generated)</span>
            <button onClick={copyCaption} className="games-condensed text-[12px] uppercase tracking-[0.08em] font-semibold text-[#91C640]">Copy caption</button>
          </div>
          <textarea readOnly value={caption} rows={16}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl p-4 text-[13px] leading-relaxed text-[var(--text-primary)] font-mono" />
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            Castro interview clips: always credit @davecastro6289 / Dave Castro and link his video. Photos on cards are official/press imagery used for commentary.
          </p>
        </div>
      </div>
    </div>
  )
}
