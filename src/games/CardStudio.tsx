import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { A2026, allAthletes2026, countryFlag, initials, monogramColor } from './athletes2026'
import photosExtra from '../data/games/photos-extra.json'
import rawGames from '../data/games-data.json'
import type { GamesData, GamesAthlete2026 } from '../types-games'
import analysisPosts from '../data/games/analysis-posts.json'
import liveResults from '../data/games/live-2026.json'

// Instagram card studio for @cf_games_update. URL-only tool (not in nav).
// Cards render at a fixed 1080x1350 (IG portrait) offscreen and export as PNG.
// URL params for automation: ?t=<template>&d=<division>&a=<slug>&b=<slug2>

const G = rawGames as unknown as GamesData

type Division = 'men' | 'women'
type Template = 'spotlight' | 'cover' | 'h2h' | 'form' | 'news' | 'carousel' | 'picks' | 'story' | 'results' | 'leaderboard'

// ---- Live results (Games week): event top-3 + overall leaderboard ----
type LiveRow = { name: string; score: string }
type LiveLbRow = { name: string; points: number; prev?: number | null }
type LiveEvent = { num: number; name: string; short: string; scoreLabel: string; men: LiveRow[]; women: LiveRow[] }
type LiveData = { updated: string; events: LiveEvent[]; leaderboard: { afterEvent: number | null; afterLabel: string; men: LiveLbRow[]; women: LiveLbRow[] } }
const LIVE = liveResults as LiveData
function athleteCountry(name: string): string {
  const k = name.toLowerCase().trim()
  return allAthletes2026.find((x) => x.name.toLowerCase() === k)?.country ?? ''
}

const TEMPLATES: { id: Template; label: string }[] = [
  { id: 'spotlight', label: 'Athlete Spotlight' },
  { id: 'cover', label: 'Field / Countdown Cover' },
  { id: 'h2h', label: 'Head to Head' },
  { id: 'form', label: 'Season Form Top 10' },
  { id: 'news', label: 'News / Announcement' },
  { id: 'carousel', label: 'Carousel (multi-slide)' },
  { id: 'picks', label: 'Event picks (model top 5)' },
  { id: 'story', label: 'Story (blog promo, 9:16)' },
  { id: 'results', label: 'LIVE: Event Top 3' },
  { id: 'leaderboard', label: 'LIVE: Overall Leaderboard' },
]

// Model-favored top 5 per event. Every number/reason is grounded in the projection
// model (mean measured percentile on the domains the event taxes). A fit read.
type Pick = { name: string; value: string; why: string }
type PickSet = { id: string; label: string; eventKicker: string; eventLine: string; note: string; men: Pick[]; women: Pick[] }
const PICKS: PickSet[] = [
  {
    id: 'roll-to-support-amrap',
    label: 'Roll to Support AMRAP',
    eventKicker: 'Sun July 26 - Roll to Support AMRAP',
    eventLine: '5-min AMRAP: 4 forward rolls to support, 3 backward rolls to support. The ring test Castro teased is now scored.',
    note: 'Researched gymnastics backgrounds, not the season model: real artistic-gymnast, tumbling and rings-specialist history. Both movements have zero Games precedent. A background read, not a result prediction.',
    men: [
      { name: 'Patrick Vellner', value: 'Elite gymnast', why: 'Former competitive artistic gymnast (to 2010); the cleanest technician.' },
      { name: 'Victor Hoffer', value: 'Elite gymnast', why: 'Federation-level French artistic gymnast from age 3. Model score (44) is a miss.' },
      { name: 'Roman Khrennikov', value: 'Elite gymnast', why: 'Russian Olympic-reserve gymnastics plus break-dancing floorwork.' },
      { name: 'Justin Medeiros', value: 'Sharp technician', why: "Field's sharpest strict-ring control." },
      { name: 'Colten Mertens', value: 'Grid + rings', why: 'United Grid League player; the backward roll to support is a UGL staple.' },
    ],
    women: [
      { name: 'Madeline Sturt', value: 'Rings specialist', why: "Australia's premier rings athlete. Model score (47) hides it." },
      { name: 'Abigail Domit', value: 'Elite gymnast', why: 'USAG Level 9 artistic gymnast; rolls transfer one to one.' },
      { name: 'Ella Wilkinson', value: 'Elite gymnast', why: 'Team GB trampoline and tumbling to age 15. Elite aerial rotation.' },
      { name: 'Danielle Brandon', value: 'Elite gymnast', why: 'Childhood gymnast plus state diving; somersault instinct, strong lockout.' },
      { name: 'Haley Adams', value: 'Former gymnast', why: 'Competitive artistic gymnast most of her youth; real rotation and support.' },
    ],
  },
  {
    id: 'machine-7200m',
    label: 'Machine 7200M',
    eventKicker: 'Sun July 26 - Machine 7200M',
    eventLine: 'For time: Row 3,600m, Ski 3,600m. 30-min cap men / 35-min women. No exact Games precedent.',
    note: "History first: the 2020 1,000m Row and 2022 Rinse 'N' Repeat swim/SkiErg interval are the closest matches in Games archive. A history read, not a result prediction.",
    men: [
      { name: 'Roman Khrennikov', value: 'WON x2', why: "Won the 2020 1,000m Row (2:48.90) AND the 2022 Rinse 'N' Repeat (160 cal)." },
      { name: 'Patrick Vellner', value: "7th '20", why: '7th in the 2020 1,000m Row (2:54.80), fastest 2026 qualifier behind Khrennikov.' },
      { name: 'Justin Medeiros', value: "7th '22", why: "7th in the 2022 Rinse 'N' Repeat (151 cal); also 15th in the 2020 row." },
      { name: 'Jeffrey Adler', value: '11th/13th', why: '11th in the 2020 row, 13th in the 2022 interval. Consistent on both.' },
      { name: 'Ricky Garard', value: "10th '22", why: "10th in the 2022 Rinse 'N' Repeat (147 cal); 2nd overall at the 2025 Games." },
    ],
    women: [
      { name: 'Lucy Campbell', value: "WON '22", why: "WON the 2022 Rinse 'N' Repeat outright (137 cal), her first Games event win." },
      { name: 'Haley Adams', value: '6th/6th', why: '6th in the 2020 row (3:21.30) AND 6th in the 2022 interval (129 cal).' },
      { name: 'Alexis Raptis', value: "11th '22", why: "11th in the 2022 Rinse 'N' Repeat (125 cal)." },
      { name: 'Danielle Brandon', value: "12th '22", why: "12th in the 2022 Rinse 'N' Repeat (124 cal)." },
      { name: 'Emma Lawson', value: "15th '22", why: "15th in the 2022 Rinse 'N' Repeat (123 cal)." },
    ],
  },
  {
    id: 'grass-oval-bike',
    label: 'Grass Oval Bicycle Race',
    eventKicker: 'Event 6 - Grass Oval Bicycle Race',
    eventLine: '20 laps for time, 25-minute cap. Wed July 22, Morgan Hill. The outdoor bike race returns.',
    note: 'History first: real placements from the Games bike races (2017-2023); model engine/sprint as tiebreaker. Garard 2017 result was voided for doping, so it is excluded. A fit read, not a result prediction.',
    men: [
      { name: 'Ricky Garard', value: 'WON \'22', why: 'Won the 2022 Bike to Work outright AND raced BMX before CrossFit - real handling for a grass oval. 2nd at the 2025 Games.' },
      { name: 'Jeffrey Adler', value: '2nd \'23', why: '2nd in the 2023 Ride, 4th in 2022 Bike to Work. The field\'s most consistent bike racer.' },
      { name: 'Justin Medeiros', value: '3rd \'22', why: '3rd in the 2022 Bike to Work. Field\'s single highest engine-plus-sprint blend.' },
      { name: 'James Sprague', value: 'Engine', why: 'No verified bike placement, but a top-3 modeled engine/sprint blend.' },
      { name: 'Patrick Vellner', value: '4 starts', why: 'Every dedicated Games bike test since 2017; best finish 13th. Elite modeled sprint.' },
    ],
    women: [
      { name: 'Emma Lawson', value: 'WON \'23', why: 'Won the 2023 Ride, 3rd in 2022 Bike to Work. Best bike resume in the field.' },
      { name: 'Haley Adams', value: 'WON \'22', why: 'Won the 2022 Bike to Work. Also the field\'s single highest modeled engine score.' },
      { name: 'Danielle Brandon', value: '27th/21st', why: 'Faced the format twice without cracking the front; ties for best modeled sprint.' },
      { name: 'Mirjam von Rohr', value: 'n/a', why: 'No bike-race precedent, but the field\'s best pure modeled engine score.' },
      { name: 'Lucy Campbell', value: 'n/a', why: 'Competed in 2022 outside our verified top 10; 3rd-best modeled engine.' },
    ],
  },
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
    id: 'snatch-triple',
    label: 'Speed Snatch Triple',
    eventKicker: 'Event 15 - Speed Snatch Triple',
    eventLine: 'Nine ascending snatches under 1, 2 and 3-minute caps. Final bar: 285 lb M / 185 lb W. The 2020 rerun.',
    note: 'Verified competition snatches first (2021 Games 1RM snatch, the 2020 running of this event, WFP Finals 2025), self-reported maxes shown but labeled. Individual Event 15. A fit read, not a result prediction.',
    men: [
      { name: 'Guilherme Malheiros', value: '305', why: 'WON the 2021 Games 1RM snatch at 305. The final bar is 20 lb below his proven max.' },
      { name: 'Jeffrey Adler', value: '2nd 20', why: '2nd in this EXACT event in 2020; 290 self-reported.' },
      { name: 'Patrick Vellner', value: '290', why: '290 in the 2021 Games snatch event. Above the final bar.' },
      { name: 'Saxon Panchik', value: '285', why: '285 at the 2021 Games; 295 self-reported since.' },
      { name: 'Justin Medeiros', value: '285', why: '285 in 2021 plus 5th in the 2020 running of this ladder.' },
    ],
    women: [
      { name: 'Hannah Black', value: '231', why: 'Won the WFP Finals snatch at 105 kg (Dec 2025) + the 2023 Semifinal record.' },
      { name: 'Olivia Kerstetter', value: '207', why: '202 at the 2021 Games at age 15 (official); 94 kg at the WFP Finals in Dec.' },
      { name: 'Danielle Brandon', value: '210 rep', why: 'Won the 2022 Skill Speed Medley: heavy AND fast is her lane.' },
      { name: 'Mirjam von Rohr', value: 'WL champ', why: 'Swiss weightlifting national champion; barbell speed is native.' },
      { name: 'Bergrós Björnsdóttir', value: 'WL medal', why: "Iceland's first World Youth weightlifting medallist." },
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
  | { type: 'bars'; kicker: string; headline: string; bars: { label: string; pct: number; display: string; color?: string }[]; footnote?: string }
  | { type: 'stat'; kicker: string; headline: string; stats: { big: string; label: string }[]; footnote?: string }
  | { type: 'movement'; kicker: string; headline: string; rows: { rank: number; name: string; pts: number; delta: number | null }[]; note?: string }
type Carousel = { id: string; label: string; caption: string; slides: Slide[] }
const CAROUSELS: Carousel[] = [
  {
    id: 'day1-data-recap',
    label: 'Day 1 Data Recap + Friday Projection',
    caption:
      "📊 DAY 1, BY THE DATA. The 2026 Games opened with SEVEN events in one day, and the numbers tell it better than any hot take.\n\nWHAT IT TESTED: 6 of the 7 events went to the poles - maximal strength (the CrossFit Total) and pure engine (run, bike, swim). Zero dedicated gymnastics or barbell-cycling events. Day 1 rewarded the specialists at both ends.\n\nWHO LEADS: Women - Aimee Cringle (458), climbed from 10th to a runaway lead with 3 event wins. Men - James Sprague (414) by a SINGLE point over Dallin Pepper, after Jay Crouch led all day and got caught by the swim.\n\nTHE SWIM DECIDED IT: Lucy Campbell (a former international swimmer) won the women's by 69 seconds; Ty Jenkins took the men's. Both boards flipped on the last event of the day.\n\nFRIDAY: the arena opens (Events 8-12) and brings the skill-and-cycling middle Day 1 skipped. The all-rounders are coming for the specialists.\n\nFull recaps + the live board at the link in bio. A data read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Day 1 - Wed July 22', headline: 'DAY 1,\nBY THE DATA', sub: 'Seven events in one day. Here is what it tested, how the board moved, and what Friday changes. Swipe.' },
      { type: 'bars', kicker: 'The Programming', headline: 'WHAT DAY 1\nACTUALLY TESTED', bars: [
        { label: 'Maximal strength', pct: 100, display: '3 events', color: '#F4C64A' },
        { label: 'Engine (run/bike/swim)', pct: 100, display: '3 events', color: '#91C640' },
        { label: 'Mixed metcon', pct: 33, display: '1 event', color: '#60a5fa' },
        { label: 'Dedicated gymnastics', pct: 0, display: '0 events', color: 'rgba(244,246,242,0.4)' },
        { label: 'Barbell cycling', pct: 0, display: '0 events', color: 'rgba(244,246,242,0.4)' },
      ], footnote: 'The Hopper touched pull-ups and jerks and the swim added burpees, but 6 of 7 events went to the poles - max strength and pure engine - and none to the skill-and-cycling middle. That middle is exactly what the arena tests.' },
      { type: 'movement', kicker: 'Women - Final Day 1 Board', headline: 'WOMEN:\nTHE FINAL BOARD', rows: [
        { rank: 1, name: 'Aimee Cringle', pts: 458, delta: 0 },
        { rank: 2, name: 'Lucy Campbell', pts: 420, delta: 1 },
        { rank: 3, name: 'Madeline Sturt', pts: 407, delta: -1 },
        { rank: 4, name: 'Haley Adams', pts: 372, delta: 0 },
        { rank: 5, name: 'Emma Lawson', pts: 364, delta: 1 },
        { rank: 6, name: 'Alex Gazan', pts: 325, delta: 2 },
        { rank: 7, name: 'Aline Wirz', pts: 313, delta: 0 },
        { rank: 8, name: 'Arielle Loewen', pts: 300, delta: 3 },
      ], note: 'Arrows = movement on the swim (Event 7). Campbell won it and jumped past Sturt; Loewen swam 4th to climb 3 spots. Cringle held the lead she took after the shoulder press.' },
      { type: 'movement', kicker: 'Men - Final Day 1 Board', headline: 'MEN:\nTHE FINAL BOARD', rows: [
        { rank: 1, name: 'James Sprague', pts: 414, delta: 1 },
        { rank: 2, name: 'Dallin Pepper', pts: 413, delta: 2 },
        { rank: 3, name: 'Justin Medeiros', pts: 392, delta: 3 },
        { rank: 4, name: 'Jay Crouch', pts: 387, delta: -3 },
        { rank: 5, name: 'Ricky Garard', pts: 386, delta: -2 },
        { rank: 6, name: 'Moritz Fiebig', pts: 355, delta: -1 },
        { rank: 7, name: 'Roman Khrennikov', pts: 348, delta: 0 },
        { rank: 8, name: 'Jayson Hopper', pts: 304, delta: 1 },
      ], note: 'Arrows = movement on the swim. Crouch led after all 6 prior events; a 19th-place swim dropped him to 4th and handed Sprague the lead by a single point.' },
      { type: 'stat', kicker: 'The Headlines', headline: 'DAY 1 BY\nTHE NUMBERS', stats: [
        { big: '6/7', label: 'events tested pure strength or pure engine' },
        { big: '1 pt', label: 'separates Sprague and Pepper atop the men' },
        { big: '69s', label: "Campbell's winning margin in the swim" },
        { big: '10 to 1', label: "Cringle's climb from the opener to the lead" },
      ] },
      { type: 'point', num: 1, kicker: 'The Pivot', headline: 'THE SWIM\nDECIDED IT', body: "Both Day 1 leaders were made in the water. Lucy Campbell, a former international swimmer, won the women's Swim Standard by 69 seconds. Ty Jenkins, a three-time teen world champion, won the men's. The event flipped both boards - Crouch lost the men's lead, Campbell seized second - and proved again that swimming is the one CrossFit skill you cannot fake.", source: 'Official CrossFit Games leaderboard' },
      { type: 'point', num: 2, kicker: 'Friday - The Arena', headline: 'WHAT FRIDAY\nCHANGES', body: 'Day 1 gave 6 of 7 events to raw strength and raw engine. Friday opens the arena (Events 8-12), historically where the Games test the middle Day 1 skipped: high-skill gymnastics, barbell cycling, and mixed triplets under fatigue. The exact workouts are not announced yet (two are FloElite exclusives), but the modality math is clear - the specialists who feasted on Day 1 now face the tests they like least.', source: 'Broadcast schedule + Persistence Athletics model' },
      { type: 'point', num: 3, kicker: 'The Read', headline: 'WHO FRIDAY\nFAVORS', body: 'Watch the all-rounders sitting just off the lead. Men: Pepper and two-time champion Medeiros have the gymnastics and engine for arena couplets, and reigning champion Jayson Hopper - only 8th after a grinding Day 1 - historically climbs indoors. Women: Campbell, Adams and Lawson are built for skill-and-cycling. The Day 1 strength standouts, Mertens and Gazan, now have to defend. A modality read, not a result prediction.', source: 'Persistence Athletics model' },
      { type: 'cta', headline: 'THE FULL\nBREAKDOWN', body: 'Both Day 1 recap blogs, the live interactive leaderboard, and every event card are on the site. Day 2 is Friday - cards and the read the moment it starts.' },
    ],
  },
  {
    id: 'champions-check-in',
    label: 'The Champions Check-In',
    caption:
      "Here is a fact that has never been true in the modern era: the last FOUR men to win the CrossFit Games are all competing on the same floor this weekend. Medeiros (2021, 2022). Adler (2023). Sprague (2024). Hopper (2025).\n\nAnd Day 1 scattered them. Sprague leads the Games at 418. Medeiros sits 3rd, doing quiet two-time-champion things. The reigning champ Hopper is grinding in 8th. Adler is digging out of 11th - and he built his 2023 title on the back half of a weekend.\n\nBehind them, the podium chasers: Pepper (runner-up in 2024) is 2nd. Garard (runner-up in 2025) won the Ranch run and sits 5th. Khrennikov 7th. And Vellner - 22nd on the board, but the 36-year-old won the deadlift at 605 lb over every young gun in the field.\n\nAnd the women? No former champion in the field at all. Whoever wins Sunday becomes a first-time Fittest Woman on Earth. Campbell (2nd in 2025) is 2nd again. Lawson 5th. Loewen 8th.\n\nThe engine specialists owned Day 1. The arena belongs to the winners. Full breakdown, with who fits the remaining tests, on the blog.",
    slides: [
      { type: 'cover', kicker: '2026 CrossFit Games', headline: 'THE CHAMPIONS\nCHECK-IN', sub: 'The last four men to win the Games are all on this floor - and Day 1 scattered them from 1st to 11th. Where every winner and podium vet stands. Swipe.' },
      { type: 'stat', kicker: 'Never Before', headline: 'FOUR CHAMPIONS,\nONE FLOOR', stats: [
        { big: '4', label: 'of the last 4 champions are in this field' },
        { big: '1st', label: 'Sprague (2024 champ) leads at 418' },
        { big: '11th', label: 'Adler (2023 champ), the deepest hole' },
        { big: '0', label: "former champions in the women's field" },
      ], footnote: 'Medeiros 2021+2022, Adler 2023, Sprague 2024, Hopper 2025. All numbers reflect the officials revised Day 1 scoring.' },
      { type: 'movement', kicker: 'The Four Champions - After Day 1', headline: 'WHERE THE\nWINNERS SIT', rows: [
        { rank: 1, name: 'James Sprague (24 champ)', pts: 418, delta: null },
        { rank: 3, name: 'Justin Medeiros (21, 22)', pts: 388, delta: null },
        { rank: 8, name: 'Jayson Hopper (25 champ)', pts: 304, delta: null },
        { rank: 11, name: 'Jeffrey Adler (23 champ)', pts: 281, delta: null },
      ], note: 'Sprague never finished worse than 6th outside the press. Hopper had to requalify this season after injury. Adler won 2023 by stacking the back half of the weekend.' },
      { type: 'movement', kicker: 'The Podium Chasers - Men', headline: 'THE MEN WHO\nCAME CLOSE', rows: [
        { rank: 2, name: 'Dallin Pepper (2nd in 24)', pts: 413, delta: null },
        { rank: 5, name: 'Ricky Garard (2nd in 25)', pts: 386, delta: null },
        { rank: 7, name: 'Roman Khrennikov (2nd in 22)', pts: 341, delta: null },
        { rank: 22, name: 'Patrick Vellner (2nd in 18)', pts: 180, delta: null },
      ], note: 'Pepper climbed 17th to 2nd through Day 1. Garard won the Ranch run. Vellner, 36, won the deadlift at 605 lb - the board undersells the day.' },
      { type: 'point', num: 1, kicker: 'The Women', headline: 'A NEW CHAMPION\nIS GUARANTEED', body: 'There is no former champion in the 2026 women\'s field. Whoever wins on Sunday becomes a first-time Fittest Woman on Earth. The podium pedigree chasing the open crown: Lucy Campbell (2nd in 2025) sits 2nd at 420. Emma Lawson (2nd in 2023) is 5th. Arielle Loewen (3rd in 2023) is 8th. Olivia Kerstetter (3rd in 2025) is 17th with the barbell still to come.', source: 'Official leaderboard + Games Almanac' },
      { type: 'point', num: 2, kicker: 'What Is Left', headline: 'WHO FITS THE\nREMAINING TESTS', body: 'Verified history, not vibes. The 500m sprint: Garard won both parts of 2024 Track and Field. Machine 7200m: Khrennikov won BOTH of its ancestors (2020 row, 2022 Rinse N Repeat) - and Campbell won that 2022 event on the women\'s side. The ring AMRAP: Vellner is a former artistic gymnast, the cleanest technician here. And the arena events reward exactly what Medeiros, Sprague and Hopper built their titles on.', source: 'Persistence Athletics Games Almanac, 2007-2026' },
      { type: 'cta', headline: 'THE FULL\nCHECK-IN', body: 'Every champion, every podium vet, and who fits what is left - the full analysis is on the site, with the live board updating all weekend.' },
    ],
  },
  {
    id: 'rookie-report-day1',
    label: 'The Rookie Report (Day 1)',
    caption:
      "Fifteen athletes walked into the 2026 CrossFit Games for the first time. Here is how Day 1 went for the rookie class.\n\nThree of them hit an event podium on debut. Aline Wirz took 3rd on the Hopper, Ella Wilkinson ran to 3rd on the Ranch 7200 behind only Cringle and Adams, and Dylan Hamming pressed his way to 3rd. On day one. On this floor.\n\nWirz was the story. Seventh overall, the only rookie inside the top 10, a 3rd on the Hopper and a 4th on the bike. And she did it after being diagnosed with a C6 neck fracture roughly five weeks before her semifinal. Read that again.\n\nThe young ones did not blink either. Miley Wade, 18 and the youngest athlete in the entire field, ran to 8th. Bergros Bjornsdottir, 19, was the steadiest rookie of the bunch with nothing worse than 24th and an 8th on the squat. Nika Maisuradze led the rookie men with two 6th-place finishes, and Luis Cuellar swam to 5th when the pool showed up.\n\nNot everyone got the day they wanted, and that is the Games. But every one of these fifteen earned the floor they were standing on. Full breakdown on the blog.",
    slides: [
      { type: 'cover', kicker: '2026 CrossFit Games', headline: 'THE ROOKIE\nREPORT', sub: 'Fifteen first-timers, one brutal opening day, and a few who refused to look like rookies at all. Swipe through the class of 2026.' },
      { type: 'point', num: 1, kicker: 'Podium Rookies', headline: 'THREE ROOKIES\nHIT A PODIUM', body: 'On debut. Aline Wirz took 3rd on the Hopper. Ella Wilkinson ran to 3rd on the Ranch 7200, behind only Cringle and Adams. Dylan Hamming pressed to 3rd on the shoulder press. Three first-timers, three event podiums, day one.', source: '2026 CrossFit Games, official leaderboard after Day 1' },
      { type: 'point', num: 2, kicker: 'Rookie of Day 1', headline: 'ALINE WIRZ\n7TH OVERALL', body: 'The only rookie inside the top 10. A 3rd on the Hopper, a 4th on the bike, an engine that belongs. The part that stops you: she was diagnosed with a C6 neck fracture roughly five weeks before her semifinal. Then she made the Games and finished her first day in 7th.', source: 'Switzerland, 32. Official Day 1 results' },
      { type: 'movement', kicker: "Women's Rookie Board", headline: 'AFTER DAY 1\nWOMEN', rows: [
        { rank: 7, name: 'Aline Wirz', pts: 313, delta: null },
        { rank: 15, name: 'Bergros Bjornsdottir', pts: 245, delta: null },
        { rank: 18, name: 'Ella Wilkinson', pts: 209, delta: null },
        { rank: 20, name: 'Janie Cheverie', pts: 202, delta: null },
        { rank: 21, name: 'Holly Tynan', pts: 198, delta: null },
        { rank: 25, name: 'Miley Wade', pts: 180, delta: null },
        { rank: 26, name: 'Erica Folo', pts: 179, delta: null },
        { rank: 28, name: 'Rachel Noel', pts: 168, delta: null },
      ], note: 'Overall placing after 7 events. Nine women made their Games debut this weekend.' },
      { type: 'movement', kicker: "Men's Rookie Board", headline: 'AFTER DAY 1\nMEN', rows: [
        { rank: 17, name: 'Nika Maisuradze', pts: 242, delta: null },
        { rank: 19, name: 'Luis Cuellar', pts: 231, delta: null },
        { rank: 27, name: 'Ben Fowler', pts: 158, delta: null },
        { rank: 28, name: 'Quinn Robinson', pts: 152, delta: null },
        { rank: 29, name: 'Dylan Hamming', pts: 147, delta: null },
        { rank: 30, name: 'Benjamin Reyes', pts: 49, delta: null },
      ], note: 'Maisuradze led the rookie men with two 6th-place finishes. Cuellar swam to 5th on E7.' },
      { type: 'point', num: 3, kicker: 'Young Guns', headline: 'THE KIDS\nSHOWED UP', body: 'Miley Wade is 18, the youngest athlete in the whole field, and she ran to 8th. Bergros Bjornsdottir at 19 was the steadiest rookie out there, nothing worse than 24th and an 8th on the squat. Benjamin Reyes, 21 from Chile, had the hardest day of the group, but he had it on the biggest floor in the sport.', source: 'Official Day 1 results' },
      { type: 'stat', kicker: 'Day 1 By The Numbers', headline: 'THE ROOKIE\nCLASS', stats: [
        { big: '15', label: 'first-timers at the 2026 Games' },
        { big: '3', label: 'event podiums on debut' },
        { big: '18', label: 'age of the youngest, Miley Wade' },
        { big: '7th', label: 'top rookie overall, Aline Wirz' },
      ], footnote: 'Six rookie men, nine rookie women, after 7 events.' },
      { type: 'cta', headline: 'READ THE FULL\nROOKIE REPORT', body: 'Every debut, every placing, and the live leaderboard as the weekend unfolds. The full Rookie Report blog is on the site.' },
    ],
  },
  {
    id: 'day-1-took-a-toll',
    label: 'Day 1 Took a Toll (injuries + drop-offs)',
    caption:
      "Day 1 at the Ranch asked a lot, and a few athletes answered it hurt. Henrik Haapalainen raced the 7,200m trail run on an Achilles and still finished the day competing. Anika Greer went on an injured ankle. Rookie Hannah Black fought ankle trouble on the run, had no scored result on the bike, and sits 29th. Paige Rodgers battled her own ankle and still swam to 2nd. Those injury notes come from BoxRox's Day 1 recap, and respect to every one of them for staying in the fight.\n\nThen there is the other kind of Day 1 swing, the competitive one. Jay Crouch led the whole field after every event from 1 through 6, then a 19th-place swim dropped him to 4th. Healthy, just outswum. Colten Mertens won the squat and the press, took zero points on the bike at 21:48, and slid from 4th to 11th. No injuries there, just the leaderboard doing what it does.\n\nThat is the Games. One day, and the whole board rearranges. Full recap and the live leaderboard are on the site.",
    slides: [
      { type: 'cover', kicker: '2026 CrossFit Games / Day 1', headline: 'DAY 1\nTOOK A TOLL', sub: 'Some fell to injury, some fell on the board, and the two are not the same. Swipe through it.' },
      { type: 'point', num: 1, kicker: 'Competed Hurt', headline: 'RAN IT ON\nAN ACHILLES', body: 'Henrik Haapalainen raced the 7,200m Ranch trail run carrying an Achilles injury, and still finished Day 1 competing. The steep climbs forced multiple athletes to walk sections of that course. He kept going anyway.', source: 'Injury note: BoxRox Day 1 recap' },
      { type: 'point', num: 2, kicker: 'Ankles Under Fire', headline: 'TWO WOMEN,\nHURT ANKLES', body: 'Anika Greer competed on an injured ankle. Rookie Hannah Black fought ankle trouble on the trail run, posted no scored result on the bike, and sits 29th. Both stayed in the fight. Respect to them.', source: 'Injury notes: BoxRox Day 1 recap' },
      { type: 'point', num: 3, kicker: 'Not An Injury', headline: 'LED SIX,\nFELL TO FOURTH', body: 'Different story, and it matters. This one is competitive, not physical. Jay Crouch led the whole field after every event from 1 through 6. Then a 19th-place swim knocked him from 1st all the way to 4th. Healthy, just outswum.', source: 'Official leaderboard' },
      { type: 'point', num: 4, kicker: 'Also Competitive', headline: 'WON THE LIFTS,\nSANK ON THE BIKE', body: 'Colten Mertens won both the squat and the press, then took zero points on the bike, crossing at 21:48. That dropped him from 4th to 11th. No injury here either, the bike just bit. That is Day 1 at the Games.', source: 'Official leaderboard' },
      { type: 'cta', headline: 'READ THE\nFULL RECAP', body: 'Our full Day 1 recap and the live leaderboard are up now on the site.' },
    ],
  },
  {
    id: 'day1-records',
    label: 'Day 1 Records & Firsts',
    caption:
      "🏆 DAY 1 RECORDS & FIRSTS. The 2026 Games opener did not just move the leaderboard, it moved the record book.\n\nTHE HEAVIEST TOTALS: Colten Mertens posted a 1,380 lb CrossFit Total (555 squat / 260 press / 565 deadlift) and Alex Gazan a 920 lb Total (330 / 170 / 420) - both reported by BoxRox as new Games CrossFit Total records. Mertens won the squat AND the press; Gazan won the press outright.\n\nA FIRST: Ty Jenkins, 20, won the Swim Standard for the first event win of his career, ahead of two-time champion Justin Medeiros. Lucy Campbell was the only woman under 11 minutes in the pool.\n\nAND THE GRIT: Henrik Haapalainen raced the Ranch on an Achilles injury, Anika Greer competed on an injured ankle, and the trail run forced athletes to walk the steep climbs.\n\nFull Day 1 breakdown at the link in bio.",
    slides: [
      { type: 'cover', kicker: 'Day 1 - Wed July 22', headline: 'RECORDS\n& FIRSTS', sub: 'The Games opener rewrote the record book and minted a brand-new event winner. The Day 1 superlatives. Swipe.' },
      { type: 'stat', kicker: 'The Record Book', headline: 'THE HEAVIEST\nTOTALS', stats: [
        { big: '1,380', label: "Colten Mertens' CrossFit Total (555 / 260 / 565)" },
        { big: '920', label: "Alex Gazan's CrossFit Total (330 / 170 / 420)" },
        { big: '2 wins', label: 'Mertens took the squat AND the press' },
        { big: '170', label: 'Gazan won the shoulder press outright' },
      ], footnote: 'BoxRox reports both as new Games CrossFit Total records. On Day 1, Mertens and Gazan owned the barbell.' },
      { type: 'point', num: 1, kicker: 'The Firsts', headline: 'A 20-YEAR-OLD\nWON A GAMES EVENT', body: "Ty Jenkins, 20, won the Swim Standard for the first individual event win of his career - ahead of two-time champion Justin Medeiros. On the women's side, Lucy Campbell was the only athlete to break 11 minutes in the pool (10:55), winning by 69 seconds. Swimming decided the day.", source: 'Official leaderboard + BoxRox' },
      { type: 'point', num: 2, kicker: 'The Grit', headline: 'THEY COMPETED\nHURT', body: 'Day 1 asked a brutal question and several answered it injured. Henrik Haapalainen raced the 7,200m Ranch carrying an Achilles injury; Anika Greer competed on an injured ankle; and the steep trail run forced multiple athletes to walk sections of the climbs. The opener was as much about toughness as fitness.', source: 'BoxRox Day 1 recap' },
      { type: 'cta', headline: 'THE FULL\nDAY 1', body: 'Both recap blogs, the data breakdown, and the live board are on the site. Day 2 is Friday - the arena opens.' },
    ],
  },
  {
    id: 'day1-running-order',
    label: 'Day 1 Running Order',
    caption:
      "🔥 DAY 1 IS HERE. The 2026 CrossFit Games open Wednesday July 22 with SEVEN scored individual events, run off-site across the Bay Area (The Ranch + Morgan Hill), women's heats first.\n\nThe slate: E1 the 2007 Hopper, E2 Ranch 7200 (7.2km run), E3-5 the CrossFit Total (squat/press/deadlift), E6 the Grass Oval Bicycle Race, and E7 - a FloElite exclusive still under wraps.\n\nWatch Ricky Garard: he WON the 2025 Ranch run (E2 again) and he's our bike-race favorite (ex-BMX). Two of seven events are already his - he could bank a lead before the arena even opens.\n\nSwipe for the full running order. Every event breakdown at the link in bio. #CrossFitGames",
    slides: [
      { type: 'cover', kicker: 'Day 1 - Wed July 22', headline: 'SEVEN EVENTS,\nONE WEDNESDAY', sub: 'The Games open with a 7-event gauntlet across the Bay Area. Here is the running order - and who is built for it. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Slate', headline: '7 EVENTS,\n2 VENUES', body: 'E1 the 2007 Hopper. E2 Ranch 7200 (7.2km trail run). E3-5 the CrossFit Total (1RM squat, press, deadlift - three 50-pt events). E6 the Grass Oval Bicycle Race. E7 a FloElite exclusive, still under wraps. The Ranch + Morgan Hill.', source: 'Official CrossFit Games broadcast schedule' },
      { type: 'point', num: 2, kicker: "Garard's Draw", headline: 'GARARD\nGOT LUCKY', body: 'Ricky Garard WON the 7,200m trail run at the 2025 Games - that is Event 2 again - and he is our favorite for the bike race (ex-BMX, won 2022 Bike to Work). Two of tomorrow\'s seven events are already his. The 2025 runner-up could bank an early lead.', source: 'Official Games leaderboards' },
      { type: 'point', num: 3, kicker: 'The Swing', headline: 'THE TOTAL\nMOVES MEDALS', body: 'Three of the seven events are the CrossFit Total, each 1RM scored as its own 50-point event. This is where the true heavyweights bank points the engine specialists cannot match. The strength block decides who leads after Day 1.', source: 'Persistence Athletics model' },
      { type: 'point', num: 4, kicker: 'The Shape', headline: 'NO PLACE\nTO HIDE', body: 'An engine opener, a run, a max-strength block, a bike race, a mystery closer. Pure strength gets exposed on the run and bike; pure engine gives ground on the Total. Day 1 rewards the true generalist - the whole point of the sport.', source: 'Persistence Athletics' },
      { type: 'cta', headline: 'FULL\nRUNNING ORDER', body: 'Every Day 1 event, both boards, and the storylines are on the site. A model read, not a result prediction.' },
    ],
  },
  {
    id: 'roll-to-support-amrap',
    label: 'Roll to Support AMRAP',
    caption:
      "🤸 THE RING TEST IS NOW SCORED. The official workouts page just published the full prescription: a 5-minute AMRAP of 4 forward rolls to support, 3 backward rolls to support. Sunday July 26, the final day.\n\nThis is the scored version of the two ring skills Dave Castro teased in July on the Girls Unfiltered podcast - movements the Games have NEVER tested before. Zero precedent in our archive, 2007-2025.\n\nWe already researched every athlete's real gymnastics background for the original tease. Men: Vellner, Hoffer and Khrennikov are genuine former artistic gymnasts. Women: Sturt is Australia's premier rings athlete, then Domit (USAG Level 9), Wilkinson (Team GB tumbling).\n\nSwipe for the full read. Link in bio. A background read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Sun July 26', headline: 'ROLL TO\nSUPPORT AMRAP', sub: 'The ring test Castro teased is now fully scored. 5 minutes, forward and backward rolls to support. Never tested before. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Test', headline: '5-MIN AMRAP\nON THE RINGS', body: 'As many reps as possible in 5 minutes: 4 forward rolls to support, 3 backward rolls to support. Presented by Velites. Sunday July 26, the competition’s final day.', source: 'Official CrossFit Games (workouts page)' },
      { type: 'point', num: 2, kicker: 'The History', headline: 'NEVER RUN\nBEFORE', body: 'A search of every Games event 2007-2025 in our archive finds zero prior instances of a roll-to-support movement. Genuinely new, though the base (ring muscle-ups, skin-the-cats, strict ring HSPU) is universal in this field.', source: 'Persistence Athletics archive' },
      { type: 'point', num: 3, kicker: 'The receipts - Men', headline: 'VELLNER.\nHOFFER.', body: 'Patrick Vellner competed on apparatus into 2010, the cleanest technician. Victor Hoffer trained French artistic gymnastics from age 3 - his 44 gymnastics score undersells him badly. Then Khrennikov (Russian gymnastics program), Medeiros, Mertens (Grid League).', source: 'Persistence Athletics research' },
      { type: 'point', num: 4, kicker: 'The receipts - Women', headline: 'STURT\'S\nRINGS PEDIGREE', body: "Madeline Sturt is Australia's premier rings athlete - her 47 gymnastics score hides it completely. Then Domit (USAG Level 9), Wilkinson (Team GB tumbling to 15), Brandon (childhood gymnast + diver), Adams.", source: 'Persistence Athletics research' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'The complete researched background on every athlete, and why this rewards real gymnasts over the season model, is on the site. A background read, not a result prediction.' },
    ],
  },
  {
    id: 'machine-7200m',
    label: 'Machine 7200M',
    caption:
      "🚣 MACHINE 7200M IS REVEALED. The official workouts page just published it: row 3,600m, then ski 3,600m, for time. 30-minute cap for men, 35 for women. Sunday July 26.\n\nNo Games event has ever paired a full row leg and a full ski leg like this. But we found the two closest tests in our archive - and one man has already won BOTH of them.\n\nRoman Khrennikov won the 2020 1,000m Row sprint outright (2:48.90) AND the 2022 Rinse 'N' Repeat swim/SkiErg interval outright (160 cal). Nobody else in the 2026 field has two machine-event wins.\n\nWomen: Lucy Campbell WON that 2022 interval (137 cal), her first Games win. Haley Adams was 6th in BOTH tests.\n\nSwipe for the full boards. Link in bio. A history read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Sun July 26', headline: 'MACHINE\n7200M', sub: 'Row 3,600m, ski 3,600m, for time. No exact precedent - but one man has already won both halves. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Test', headline: 'ROW 3600\nSKI 3600', body: 'For time: row 3,600 meters, then ski 3,600 meters. 30-minute cap for men, 35 for women. Presented by Saatva. Sunday July 26, the final day. Pure monostructural output, no barbell, no gymnastics.', source: 'Official CrossFit Games (workouts page)' },
      { type: 'point', num: 2, kicker: 'The History', headline: 'NO EXACT\nPRECEDENT', body: 'No prior Games event pairs a full row leg and a full ski leg. The closest matches: the 2020 Stage 1 1,000m Row sprint and the 2022 Rinse ’N’ Repeat swim/SkiErg interval.', source: 'Persistence Athletics archive' },
      { type: 'point', num: 3, kicker: 'The receipts - Men', headline: 'KHRENNIKOV\nOWNS BOTH', body: "Roman Khrennikov won the 2020 1,000m Row (2:48.90) AND the 2022 Rinse 'N' Repeat (160 cal) - the only double machine-event winner in the 2026 field. Then Vellner (7th '20), Medeiros (7th '22), Adler (11th/13th), Garard (10th '22).", source: 'Official Games leaderboards' },
      { type: 'point', num: 4, kicker: 'The receipts - Women', headline: 'CAMPBELL\nWON IT', body: "Lucy Campbell WON the 2022 Rinse 'N' Repeat outright (137 cal), her first Games event win. Haley Adams was 6th in the 2020 row AND 6th in 2022 - the only double top-6. Then Raptis, Brandon, Lawson.", source: 'Official Games leaderboards' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'Both full boards and the exact history behind them are on the site. A history read, not a result prediction.' },
    ],
  },
  {
    id: 'grass-oval-bike',
    label: 'Grass Oval Bicycle Race',
    caption:
      "🚴 THE CYCLING TEST IS FULLY REVEALED. The official workouts page just published it: the Grass Oval Bicycle Race. 20 laps of a grass oval, for time, 25-minute cap, at the Morgan Hill Outdoor Complex.\n\nThis is the full prescription for the 'Ride' cycling opener CrossFit teased back in June with zero details. No barbell, no gymnastics: pure engine, decided by leg power and pacing.\n\nHistory first: Jeffrey Adler was 2nd in the 2023 Ride and 4th in the 2022 Bike to Work, the most proven bike racer in the men's field. Ricky Garard WON that 2022 race outright. Women: Emma Lawson WON the 2023 Ride AND was 3rd in 2022, the best bike resume in the whole field. Haley Adams won 2022 outright too.\n\nSwipe for the receipts. Full breakdown at the link in bio. A history + model read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Event 6', headline: 'GRASS OVAL\nBICYCLE RACE', sub: 'Cycling is back. 20 laps for time, Wed July 22 at Morgan Hill - and the Games bike-race history names the favorites. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Test', headline: '20 LAPS\nFOR TIME', body: 'Individual Event 6, Wednesday July 22 at the Morgan Hill Outdoor Complex: 20 laps of a grass oval for time under a 25-minute cap. Aerobic engine plus the wildcard almost nobody trains - real bike handling. Per-lap distance and bike type not yet announced.', source: 'Official CrossFit Games (workouts page + IG)' },
      { type: 'point', num: 2, kicker: 'The History', headline: 'THE GAMES\nHAVE ASKED THIS', body: 'The 2017 Cyclocross and 2018 Crit both ran roughly 18-21 minutes for the leaders under similar caps. Expect this one to land in the same window: a sustained aerobic grind, not a sprint.', source: 'Official Games archive' },
      { type: 'point', num: 3, kicker: 'The receipts - Men', headline: 'GARARD\nRACED BMX', body: 'Ricky Garard won the 2022 Bike to Work outright and once eyed a BMX career - real handling for a grass oval, plus 2nd overall at the 2025 Games. Then Adler (2nd 2023, 4th 2022, most consistent) and Medeiros (3rd 2022). Garard 2017 result was voided for doping, so it is excluded.', source: 'Official Games leaderboards + CrossFit coverage' },
      { type: 'point', num: 4, kicker: 'The receipts - Women', headline: 'LAWSON\'S\nDOUBLE', body: 'Emma Lawson WON the 2023 Ride and was 3rd in 2022: the best bike resume in the 2026 field, either division. Haley Adams won that 2022 race outright and owns the field\'s single highest modeled engine score.', source: 'Official Games leaderboards' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'The full history, both boards, and what a 20-lap grass oval actually tests is on the site. A history + model read, not a result prediction.' },
    ],
  },
  {
    id: 'snatch-triple',
    label: 'Speed Snatch Triple',
    caption:
      "🏋️ THE SPEED SNATCH TRIPLE IS BACK. The official workouts page just published it: 3 snatches (1-min cap), 3 heavier (2-min), 3 heavier still (3-min). Final bars: 285 lb men / 185 lb women.\n\nSame name, same loads as the 2020 Games event where Fraser missed his first attempt at 285 and still won. The Games have run this test twice - we know what it rewards: a verified heavy snatch, moved FAST.\n\nThe elephant in the room: Guilherme Malheiros WON the 2021 Games 1RM snatch at 305 lb - 20 lb OVER this event's final bar - and he just topped our sprint board too. Adler took 2nd in the 2020 running. Women: Hannah Black owns the most recent big verified snatch in the field (105 kg, WFP Finals Dec 2025).\n\nSwipe for the receipts. Full breakdown at the link in bio. A history + model read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Event 15', headline: 'SPEED SNATCH\nTRIPLE', sub: 'Nine ascending snatches under the clock. 285 up top. The 2020 rerun - and we have the receipts. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Test', headline: 'HEAVY,\nFAST, x9', body: '3 snatches in 1 minute, 3 heavier in 2, 3 heavier still in 3. Men finish at 285 lb, women at 185. Maximal weightlifting under a clock: no reset, no platform ritual, technique at heart rate.', source: 'games.crossfit.com (official workouts page)' },
      { type: 'point', num: 2, kicker: 'The History', headline: 'THE 2020\nRERUN', body: 'Same name, same bars as the 2020 Games elimination ladder - where Fraser missed his opener at the final 285, recovered on the spot, and won anyway. That event echoed the 2015 Snatch Speed Ladder. Third time the Games run this test.', source: 'Official Games archive' },
      { type: 'point', num: 3, kicker: 'The receipts - Men', headline: 'GUI SNATCHED\n305 HERE', body: 'Malheiros WON the 2021 Games 1RM snatch at 305 - twenty pounds over this final bar - and he just topped our sprint read too. Adler was 2nd in this exact event in 2020; Vellner has 290 in competition. Pepper, Hopper and Hatfield self-report 305+, but those are profile numbers.', source: 'Official Games leaderboards' },
      { type: 'point', num: 4, kicker: 'The receipts - Women', headline: 'BLACK HAS\nTHE BAR', body: 'Hannah Black won the WFP Finals snatch at 105 kg / 231 lb in December - the most recent big verified snatch in this field - plus the 2023 Semifinal record. Then Kerstetter, Brandon (won the 2022 Speed Medley), and the two weightlifting pedigrees: von Rohr and Bergros.', source: 'Official leaderboards + verified results' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'The full history, both boards, and why paper maxes get audited on a ladder is on the site. A history + model read, not a result prediction.' },
    ],
  },
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

// LIVE results: top 3 of a completed event (men or women)
const MEDAL = ['#F4C64A', '#C9D2DA', '#CD8B5B'] // gold / silver / bronze
function ResultsCard({ event, division }: { event: LiveEvent; division: Division }) {
  const rows = (division === 'men' ? event.men : event.women).slice(0, 3)
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '34px 56px 0' }}>
        <div style={{ fontSize: 24, letterSpacing: 4, textTransform: 'uppercase', color: GREEN }}>Event {event.num} Result &middot; {event.name}</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 80, textTransform: 'uppercase', lineHeight: 0.96, marginTop: 8 }}>Top 3<br /><span style={{ color: GREEN }}>{division}</span></div>
      </div>
      <div style={{ padding: '34px 56px 0' }}>
        {rows.length === 0 && <div style={{ fontSize: 32, color: DIM }}>Results pending...</div>}
        {rows.map((r, i) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '26px 0', borderTop: i ? '1px solid rgba(244,246,242,0.1)' : 'none' }}>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 78, width: 74, color: MEDAL[i], textAlign: 'center', lineHeight: 1 }}>{i + 1}</div>
            <RoundPhoto name={r.name} size={116} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 48, textTransform: 'uppercase', lineHeight: 1 }}>{r.name}</div>
              <div style={{ fontSize: 26, color: DIM, marginTop: 6 }}>{countryFlag(athleteCountry(r.name))} {athleteCountry(r.name)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 54, color: GREEN, lineHeight: 1 }}>{r.score}</div>
              <div style={{ fontSize: 20, letterSpacing: 2, textTransform: 'uppercase', color: DIM, marginTop: 4 }}>{event.scoreLabel}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '26px 56px 0', fontSize: 22, color: DIM, letterSpacing: 0.5 }}>Official result. Full leaderboard + every athlete at the link.</div>
      <CardFooter />
    </div>
  )
}

// LIVE overall leaderboard (cumulative points), top 10 with movement vs prior event
function LeaderboardCard({ division, afterNum }: { division: Division; afterNum: number | null }) {
  const rows = (division === 'men' ? LIVE.leaderboard.men : LIVE.leaderboard.women).slice(0, 10)
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '30px 56px 0' }}>
        <div style={{ fontSize: 24, letterSpacing: 4, textTransform: 'uppercase', color: GREEN }}>Overall Standings{afterNum ? ` · After Event ${afterNum}` : ''}</div>
        <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 72, textTransform: 'uppercase', lineHeight: 0.96, marginTop: 8 }}>Leaderboard<br /><span style={{ color: GREEN }}>{division}</span></div>
      </div>
      <div style={{ padding: '20px 56px 0' }}>
        {rows.length === 0 && <div style={{ fontSize: 32, color: DIM }}>Standings pending...</div>}
        {rows.map((r, i) => {
          const delta = r.prev != null ? r.prev - (i + 1) : null
          return (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderTop: i ? '1px solid rgba(244,246,242,0.09)' : 'none' }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 40, width: 46, color: i < 3 ? GREEN : DIM, textAlign: 'center' }}>{i + 1}</div>
              <RoundPhoto name={r.name} size={64} />
              <div style={{ flex: 1, minWidth: 0, fontFamily: "'Anton', sans-serif", fontSize: 36, textTransform: 'uppercase', lineHeight: 1 }}>
                {r.name} <span style={{ fontSize: 26 }}>{countryFlag(athleteCountry(r.name))}</span>
              </div>
              <div style={{ width: 66, textAlign: 'center', fontSize: 26, color: delta && delta > 0 ? GREEN : delta && delta < 0 ? '#e0736a' : DIM }}>
                {delta == null ? '' : delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '-'}
              </div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, color: INK, width: 150, textAlign: 'right' }}>{r.points}<span style={{ fontSize: 22, color: DIM }}> pts</span></div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '18px 56px 0', fontSize: 22, color: DIM, letterSpacing: 0.5 }}>Cumulative points, official leaderboard. Full standings at the link.</div>
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
      {slide.type === 'bars' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ fontSize: 27, letterSpacing: 3, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>{slide.kicker}</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 82, textTransform: 'uppercase', lineHeight: 0.96, marginTop: 14, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 26 }}>
            {slide.bars.map((b, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                  <div style={{ fontSize: 33, color: INK, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{b.label}</div>
                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 40, color: b.color || GREEN }}>{b.display}</div>
                </div>
                <div style={{ height: 30, borderRadius: 8, background: 'rgba(244,246,242,0.09)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, b.pct))}%`, height: '100%', borderRadius: 8, background: b.color || GREEN }} />
                </div>
              </div>
            ))}
          </div>
          {slide.footnote && <div style={{ marginTop: 40, fontSize: 27, color: DIM, lineHeight: 1.36 }}>{slide.footnote}</div>}
        </div>
      )}
      {slide.type === 'stat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ fontSize: 27, letterSpacing: 3, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>{slide.kicker}</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 82, textTransform: 'uppercase', lineHeight: 0.96, marginTop: 14, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ marginTop: 44, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {slide.stats.map((s, i) => (
              <div key={i} style={{ background: 'rgba(145,198,64,0.10)', border: '1px solid rgba(145,198,64,0.30)', borderRadius: 18, padding: '28px 30px' }}>
                <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 78, color: GREEN, lineHeight: 0.94 }}>{s.big}</div>
                <div style={{ fontSize: 29, color: INK, marginTop: 12, lineHeight: 1.24 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {slide.footnote && <div style={{ marginTop: 36, fontSize: 27, color: DIM, lineHeight: 1.36 }}>{slide.footnote}</div>}
        </div>
      )}
      {slide.type === 'movement' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ fontSize: 27, letterSpacing: 3, textTransform: 'uppercase', color: GREEN, fontWeight: 600 }}>{slide.kicker}</div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 80, textTransform: 'uppercase', lineHeight: 0.96, marginTop: 12, whiteSpace: 'pre-line' }}>{slide.headline}</div>
          <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {slide.rows.map((r, i) => {
              const medal = r.rank <= 3 ? MEDAL[r.rank - 1] : 'rgba(244,246,242,0.55)'
              const dc = r.delta == null || r.delta === 0 ? DIM : r.delta > 0 ? '#5cbb3a' : '#e0655c'
              const dtxt = r.delta == null ? '' : r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${-r.delta}` : '-'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, background: r.rank <= 3 ? 'rgba(145,198,64,0.09)' : 'rgba(244,246,242,0.04)', borderRadius: 12, padding: '15px 24px' }}>
                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, color: medal, width: 52 }}>{r.rank}</div>
                  <div style={{ flex: 1, fontSize: 39, color: INK, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 30, color: dc, width: 66, textAlign: 'center' }}>{dtxt}</div>
                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 42, color: INK, width: 92, textAlign: 'right' }}>{r.pts}</div>
                </div>
              )
            })}
          </div>
          {slide.note && <div style={{ marginTop: 26, fontSize: 26, color: DIM, lineHeight: 1.36 }}>{slide.note}</div>}
        </div>
      )}
      <div style={{ paddingBottom: 28 }}><SlideDots index={index} total={total} /></div>
      <CardFooter />
    </div>
  )
}

// ---------- Captions ----------

function captionFor(t: Template, a: GamesAthlete2026 | undefined, b: GamesAthlete2026 | undefined, division: Division, news?: NewsItem, carousel?: Carousel, pickSet?: PickSet, story?: Story, liveEvent?: LiveEvent): string {
  if (t === 'results' && liveEvent) {
    const rows = (division === 'men' ? liveEvent.men : liveEvent.women).slice(0, 3)
    const medal = ['🥇', '🥈', '🥉']
    const body = rows.length ? rows.map((r, i) => `${medal[i]} ${r.name} - ${r.score}`).join('\n') : 'Results pending.'
    return `🏆 EVENT ${liveEvent.num} RESULT: ${liveEvent.name.toUpperCase()} (${division.toUpperCase()})\n\n${body}\n\nFull leaderboard + every athlete at the link in bio.\n\n${HASHTAGS}`
  }
  if (t === 'leaderboard') {
    const rows = (division === 'men' ? LIVE.leaderboard.men : LIVE.leaderboard.women).slice(0, 5)
    const body = rows.length ? rows.map((r, i) => `${i + 1}. ${r.name} - ${r.points} pts`).join('\n') : 'Standings pending.'
    return `📊 OVERALL LEADERBOARD${LIVE.leaderboard.afterEvent ? ` - AFTER EVENT ${LIVE.leaderboard.afterEvent}` : ''} (${division.toUpperCase()})\n\n${body}\n\nFull standings + every athlete at the link in bio.\n\n${HASHTAGS}`
  }
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
  const [eventNum, setEventNum] = useState(Number(params.get('e') || LIVE.events[0]?.num || 1))
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const a = useMemo(() => allAthletes2026.find((x) => x.slug === slugA) ?? roster[0], [slugA, roster])
  const b = useMemo(() => allAthletes2026.find((x) => x.slug === slugB) ?? roster[1], [slugB, roster])
  const newsItem = useMemo(() => NEWS.find((x) => x.id === newsId) ?? NEWS[0], [newsId])
  const carousel = useMemo(() => CAROUSELS.find((x) => x.id === carouselId) ?? CAROUSELS[0], [carouselId])
  const slideClamped = Math.max(0, Math.min(slideIdx, carousel.slides.length - 1))
  const pickSet = useMemo(() => PICKS.find((x) => x.id === pickId) ?? PICKS[0], [pickId])
  const story = useMemo(() => STORIES.find((x) => x.id === storyId) ?? STORIES[0], [storyId])
  const liveEvent = useMemo(() => LIVE.events.find((x) => x.num === eventNum) ?? LIVE.events[0], [eventNum])
  const caption = captionFor(template, a, b, division, newsItem, carousel, pickSet, story, liveEvent)

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
      link.download = template === 'spotlight' ? `${a.slug}-spotlight.png` : template === 'h2h' ? `${a.slug}-vs-${b.slug}.png` : template === 'news' ? `news-${newsItem.id}.png` : template === 'carousel' ? `carousel-${carousel.id}-${String(slideClamped + 1).padStart(2, '0')}.png` : template === 'picks' ? `picks-${pickSet.id}-${division}.png` : template === 'story' ? `story-${story.id}.png` : template === 'results' ? `results-e${eventNum}-${division}.png` : template === 'leaderboard' ? `leaderboard-e${eventNum}-${division}.png` : `${template}-${division}.png`
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
        {template === 'results' && (
          <select value={eventNum} onChange={(e) => setEventNum(Number(e.target.value))} className="bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
            {LIVE.events.map((ev) => <option key={ev.num} value={ev.num}>E{ev.num} {ev.short}</option>)}
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
              {template === 'results' && <ResultsCard event={liveEvent} division={division} />}
              {template === 'leaderboard' && <LeaderboardCard division={division} afterNum={LIVE.leaderboard.afterEvent} />}
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
