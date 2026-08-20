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
    id: 'event20-fibonacci-final',
    label: 'Fibonacci Final',
    eventKicker: 'Event 20 - Fibonacci Final',
    eventLine: '5-8-13 deficit HSPU (14/8-in) + double-KB deadlift (203/124 lb), then an 89-ft KB overhead lunge. 10-min cap. The season closer, Sun July 26.',
    note: 'History first: a rerun of the 2018 Fibonacci at the exact same deficit and loads (that year had a 6-min cap), itself a revision of the 2017 Fibonacci Final. Only one man and one related-test woman have a captured precedent; the rest of the board reflects live standings entering the finale. A history and standings read, not a result prediction.',
    men: [
      { name: 'Patrick Vellner', value: '4th 2018 Fibonacci', why: '4th at these exact loads in 2018; tied 9th in 2017. 16th overall, out of the title race.' },
      { name: 'James Sprague', value: 'Leads, 1,114', why: '29-point cushion over Pepper entering the finale. No precedent at this test.' },
      { name: 'Dallin Pepper', value: '2nd, 1,085 (-29)', why: '29 back with one event left. No precedent at this test.' },
      { name: 'Jay Crouch', value: '3rd, 1,046 (-68)', why: '68 back of Sprague, needs a big result plus help. No precedent at this test.' },
      { name: 'Justin Medeiros', value: '4th, 984', why: 'Two-time champ (2021, 2022). No precedent at this specific test.' },
    ],
    women: [
      { name: 'Alexis Raptis', value: 'WON 2022 Echo Press', why: 'Her only Games win came in a deficit-HSPU test (2-in deficit vs this 8-in). 21st overall, out of the title race.' },
      { name: 'Aimee Cringle', value: 'Leads, 1,190', why: '116-point lead over Lawson entering the finale. No precedent at this test.' },
      { name: 'Emma Lawson', value: '2nd, 1,074 (-116)', why: 'Needs a near-maximal swing to threaten 1st. No precedent at this test.' },
      { name: 'Lucy Campbell', value: '3rd, 1,041 (-33 on 2nd)', why: '33 back of Lawson for 2nd, tighter than the race for 1st.' },
      { name: 'Madeline Sturt', value: '4th, 877', why: 'No captured precedent at this specific test.' },
    ],
  },
  {
    id: 'event16-17-echo-thruster-yoke',
    label: 'Echo Thruster / Jump Pull Yoke',
    eventKicker: 'Event 16/17 - Echo Thruster / Jump Pull Yoke',
    eventLine: '16: 21-18-15 Echo Bike cals + Thrusters, 8-min cap. 17 (starts at 10:00): box jumps, sled pull, 3 ascending yoke carries, 6-min cap. Sat July 25.',
    note: 'History first: Event 16 loads match the 2023 Echo Thruster Final exactly; Event 17\'s top yoke rung matches the heaviest yoke ever loaded at the Games (2022). Real placements from both tests plus the 2024 yoke finals. A history read, not a result prediction.',
    men: [
      { name: 'Jeffrey Adler', value: 'WON 2022 yoke', why: 'Won the 2022 Back Nine at this exact 665-lb yoke weight; 5th in the 2023 Echo Thruster at these exact loads.' },
      { name: 'Dallin Pepper', value: 'WON 2023 Echo Thruster', why: 'Won the 2023 Echo Thruster Final outright at these exact loads; 2nd/7th across the 2024 yoke finals.' },
      { name: 'Austin Hatfield', value: 'WON both 2024 yoke finals', why: 'Swept the 2024 Final 2421 and Final 1815 yoke sprints.' },
      { name: 'Justin Medeiros', value: '3rd 2022 yoke', why: '3rd in the 2022 Back Nine at this same 665-lb yoke weight.' },
      { name: 'Guilherme Malheiros', value: '4th 2022 yoke', why: '4th in the 2022 Back Nine at this same 665-lb yoke weight.' },
    ],
    women: [
      { name: 'Alexis Raptis', value: 'WON 2024 Final 2421', why: 'Won the 2024 Final 2421 yoke sprint outright, 2nd in Final 1815; 13th in the 2023 Echo Thruster at these exact loads.' },
      { name: 'Danielle Brandon', value: '8th/8th/5th', why: '8th in the 2023 Echo Thruster, then 8th and 5th across the 2024 yoke finals.' },
      { name: 'Madeline Sturt', value: '5th/4th 2024', why: '5th and 4th across the 2024 yoke finals.' },
      { name: 'Emma Lawson', value: '9th 2023', why: '9th in the 2023 Echo Thruster at these exact barbell loads.' },
      { name: 'Alex Gazan', value: '16th to 13th/6th', why: '16th in 2023, improving to 13th and 6th across the 2024 yoke finals.' },
    ],
  },
  {
    id: 'event14-triple-pig',
    label: 'Triple Pig',
    eventKicker: 'Event 14 - Triple Pig',
    eventLine: '3 ascending rounds: bar muscle-ups, GHD sit-up wall-ball, triple-unders, Pig flips. Same 510/350-lb Pig as 2021 and 2023. Sat July 25.',
    note: 'History first: real placements from the 2021 Sled, Pig, Muscle-Ups and the 2023 Pig Chipper, both at this identical Pig weight. Model gym/heavy modal scores used only as a tiebreaker. A history + model read, not a result prediction.',
    men: [
      { name: 'Patrick Vellner', value: 'WON 2021', why: 'Won the 2021 Sled, Pig, Muscle-Ups at this exact Pig weight; 6th in the 2023 Pig Chipper.' },
      { name: 'Roman Khrennikov', value: 'WON 2023', why: 'Won the 2023 Pig Chipper outright at this same 510-lb weight.' },
      { name: 'Justin Medeiros', value: 'Model No. 1', why: "No podium history at this test (15th in 2021), but the field's best combined gym/heavy modal score." },
      { name: 'Guilherme Malheiros', value: '6th 2021', why: 'Placed 6th in the 2021 Sled, Pig, Muscle-Ups at this same Pig weight.' },
      { name: 'Jay Crouch', value: '10th 2023', why: 'Placed 10th in the 2023 Pig Chipper; balanced gym/heavy modal scores.' },
    ],
    women: [
      { name: 'Arielle Loewen', value: '2nd 2023', why: 'Runner-up in the 2023 Pig Chipper at this same 350-lb Pig.' },
      { name: 'Alexis Raptis', value: '3rd 2023', why: '3rd in the 2023 Pig Chipper at this same Pig weight.' },
      { name: 'Alex Gazan', value: '6th 2023', why: "6th in the 2023 Pig Chipper; this group's best heavy-modal score." },
      { name: 'Haley Adams', value: '5th 2021', why: '5th in the 2021 test at this identical Pig weight.' },
      { name: 'Lucy Campbell', value: 'Model No. 1', why: "No precedent at this test (absent 2021 and 2023), but the field's best gymnastics modal score." },
    ],
  },
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
    "id": "pepper-the-nearly-man",
    "label": "Athlete Deep Dive: Dallin Pepper, the nearly man (two silvers + the re-score that crowns him)",
    "caption": "THE BEST MAN NEVER TO WIN A CROSSFIT GAMES. YET.\n\nDallin Pepper is 24 years old and his last five Games finishes read 19-5-2-4-2. Two silver medals in three years, both behind James Sprague: 21 points in 2024, 27 points in 2026. In between, 2025, he missed the podium by 15. To Sprague.\n\nThen there is the finding from our Re-Score Machine: six 2026 events paid half points, Pepper beat Sprague by 45 across those six, and re-scoring all 20 events on the equal 100-point table flips the title. Pepper 1501, Sprague 1484. The weighting was the whole ballgame.\n\nFive podiums this year, a win in the Echo Thruster, and the outright Games lead after Event 9. This is not a hard-luck story. It is a coronation pending.\n\nEvery number is computed from official leaderboard data and our verified Games results archive. Full Pepper profile and the Re-Score Machine: Link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Athlete Deep Dive",
        "headline": "THE BEST MAN\nNEVER TO WIN",
        "sub": "Two silvers in three years, and a re-score that says champion. The Dallin Pepper file. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "The Climb",
        "headline": "FIVE YEARS,\nONE DIRECTION",
        "body": "His Games line reads 19-5-2-4-2. A rookie 19th in 2022. Fifth in 2023. Runner-up in 2024. Fourth in 2025. Runner-up again in 2026. He is 24 years old with three teenage world titles (2017-2019) behind him and four straight top-five seasons in the men's field. This is not a guy who caught lightning once. This is a guy who arrives closer every single year.",
        "source": "Persistence Athletics Games results archive, 2022-2026"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "The Sprague Problem",
        "headline": "TWENTY-ONE\nPOINTS",
        "body": "2024: Sprague 806, Pepper 785. Twenty-one points across four days of racing, his first silver. 2025: he slipped to 4th, 15 points off the podium spot Sprague took. 2026: second again, 27 back, to the same man. Two runner-up finishes in three years, both behind James Sprague. The gap has never been the field. It has been one athlete.",
        "source": "Official Games results, 2024-2026"
      },
      {
        "type": "stat",
        "kicker": "2026 By The Numbers",
        "headline": "SECOND.\nAGAIN.",
        "stats": [
          {
            "big": "2nd",
            "label": "final finish, 1291 points"
          },
          {
            "big": "27",
            "label": "points behind Sprague"
          },
          {
            "big": "17 of 20",
            "label": "events inside the top 10"
          },
          {
            "big": "1st",
            "label": "overall standing after Event 9"
          }
        ],
        "footnote": "He opened 17th in the Hopper, held the outright Games lead after Event 9, and sat 2nd from Event 15 to the finish. Official 2026 leaderboard data."
      },
      {
        "type": "movement",
        "kicker": "The Weapons",
        "headline": "FIVE\nPODIUMS",
        "rows": [
          {
            "rank": 1,
            "name": "Echo Thruster",
            "pts": 100,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Bike Race",
            "pts": 96,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Triple Pig",
            "pts": 96,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Swim Standard",
            "pts": 92,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Climbing Snail",
            "pts": 92,
            "delta": null
          }
        ],
        "note": "Per-event finish and points, 2026 Games. One win (4:55.43 in the Echo Thruster), two seconds, two thirds, all five on full-weight events."
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "Our Re-Score",
        "headline": "CHAMPION,\nRE-SCORED",
        "body": "Six 2026 events paid half points: the three Total lifts, the 3D Throw, the 500 Run, Roll to Support. Pepper outscored Sprague 203 to 158 across those six, a 45-point edge, while Sprague pressed 26th. Re-score all 20 events on the equal 100-point table and the title flips: Pepper 1501, Sprague 1484. He wins by 17. Cut the six half-weight events entirely and Sprague's margin grows to 72. Double the Total lifts instead and Pepper wins by 115. Event weighting is the whole lever, and every re-weighting that pays the lifts in full lands on Pepper's side.",
        "source": "Persistence Athletics Re-Score Machine"
      },
      {
        "type": "cta",
        "headline": "THE CROWN\nIS WAITING",
        "body": "The full Dallin Pepper profile and the Re-Score Machine are live on the site. Re-weight all 20 events yourself and watch the leaderboard recompute in real time. Link in bio."
      }
    ]
  },
  {
    "id": "event-win-kings-alltime",
    "label": "All-Time Career Event-Win Leaderboard",
    "caption": "45 FOR TOOMEY. 29 FOR FRASER. THE COUNTING STAT NEVER LIES.\n\nChampionships can swing on one bad heat. Event wins cannot. We counted every one of the 241 individual events from 2007 to 2026 and credited every winner, shared wins included.\n\nToomey owns 45, more than the next three women combined. Fraser owns 29, thirteen clear of Froning. Between them, those two won 74 of the 482 division races ever run at the Games - roughly 15 percent.\n\nThe chase is still live. Vellner leads all active men with 10, Campbell leads the 2026 field with 7, and Cringle just banked 5 in a single week. Every number verified against official per-event results in our Games Almanac. Link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "THE ALL-TIME LEDGER, 2007-2026",
        "headline": "EVENT WIN\nROYALTY",
        "sub": "Titles hang banners. Event wins count the days you were the best in the world at something. All 241 events across 20 Games, counted. Swipe."
      },
      {
        "type": "stat",
        "kicker": "20 GAMES, ONE LEDGER",
        "headline": "241 EVENTS.\nTWO NAMES.",
        "stats": [
          {
            "big": "241",
            "label": "individual events run since 2007"
          },
          {
            "big": "45",
            "label": "Toomey career event wins, all-time record"
          },
          {
            "big": "29",
            "label": "Fraser career event wins, men's record"
          },
          {
            "big": "15%",
            "label": "of all 482 division races ever run, won by those two alone"
          }
        ],
        "footnote": "Ties credited to both athletes; the 2009 men's deadlift ladder, a 16-way tie, is credited to no one. 2020 includes online and finals stages. Counted from official per-event results."
      },
      {
        "type": "movement",
        "kicker": "WOMEN, CAREER EVENT WINS",
        "headline": "TOOMEY, THEN\nEVERYONE",
        "rows": [
          {
            "rank": 1,
            "name": "Tia-Clair Toomey",
            "pts": 45,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Annie Thorisdottir",
            "pts": 14,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Katrin Davidsdottir",
            "pts": 13,
            "delta": null
          },
          {
            "rank": 4,
            "name": "Samantha Briggs",
            "pts": 11,
            "delta": null
          },
          {
            "rank": 4,
            "name": "Laura Horvath",
            "pts": 11,
            "delta": null
          },
          {
            "rank": 6,
            "name": "Lucy Campbell",
            "pts": 7,
            "delta": null
          }
        ],
        "note": "Toomey-Orr wins counted under Toomey. Kara Webb, later Saunders, also owns 7. Akinwale and Clever sit next on 6. Ties credited to both athletes."
      },
      {
        "type": "movement",
        "kicker": "MEN, CAREER EVENT WINS",
        "headline": "FRASER BY\nTHIRTEEN",
        "rows": [
          {
            "rank": 1,
            "name": "Mat Fraser",
            "pts": 29,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Rich Froning",
            "pts": 16,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Patrick Vellner",
            "pts": 10,
            "delta": null
          },
          {
            "rank": 4,
            "name": "Ricky Garard",
            "pts": 9,
            "delta": null
          },
          {
            "rank": 5,
            "name": "Brent Fikowski",
            "pts": 8,
            "delta": null
          },
          {
            "rank": 5,
            "name": "Guilherme Malheiros",
            "pts": 8,
            "delta": null
          }
        ],
        "note": "Josh Bridges also owns 8. Fraser's first career win was a 2014 tie with Froning, both credited. 2020 includes both stages."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "THE GAP",
        "headline": "MORE THAN\nTHE NEXT 3",
        "body": "Toomey's 45 event wins are more than the next three women combined: Thorisdottir 14, Davidsdottir 13 and Briggs 11 add up to 38. Fraser's men's record was built in 2020, when he entered the season one win behind Froning's 16 and then won 14 of the year's 19 events across both stages. Toomey went 13 of 19 that same year. The two of them won 27 of the 38 events run in 2020.",
        "source": "Official per-event results, 2007-2026, PA Games Almanac"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "STILL ADDING",
        "headline": "THE ACTIVE\nCHASE",
        "body": "Patrick Vellner leads every active man with 10 career wins, spread across seven different Games since 2017. Ricky Garard sits on 9, Guilherme Malheiros on 8 after three wins this year, Jeffrey Adler on 7. On the women's side, Lucy Campbell reached 7 with three 2026 wins, and Aimee Cringle took 5 events in one week, level with Clever in 2010 and Horvath in 2023 for the most in a single Games by any woman not named Toomey.",
        "source": "2026 field verified vs live leaderboard, per-event ranks"
      },
      {
        "type": "cta",
        "headline": "RECEIPTS,\nNOT VIBES",
        "body": "Every number here is counted from official per-event results across all 20 Games, 2007-2026. Full boards, era notes and the complete event archive live in the PA Games Almanac. Link in bio."
      }
    ]
  },
  {
    "id": "games-movement-evolution",
    "label": "Movement Evolution: What the Games Test Now vs Then",
    "caption": "THE GAMES NEEDED 7 MOVEMENTS IN 2007. IT HAS NOW USED 103.\n\nThe first Games was three events: a hopper triplet, a trail run, and the CrossFit Total. Seven movements crowned a champion. The Ranch era averaged five events a year. Madison averaged 14.1, and 2026 alone ran 20 events with 31 different movements.\n\nThe test did not just grow, it rotated. Swim, bike and handstand walk did not exist until 2011 and are now fixtures. Meanwhile the kettlebell swing has not been seen since 2010, the overhead squat since 2020, and ring muscle-ups and double-unders since 2023. This year added two movements nobody had ever competed at the Games: the ring Roll to Support and triple-unders.\n\nEvery number in this carousel is computed straight from our Games almanac database, all 241 events from 2007 to 2026, verified against official results. The full movement index, with first year, last year and every appearance, is on the site.\n\nLink in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "20 SEASONS OF MOVEMENT DATA",
        "headline": "THEN VS\nNOW",
        "sub": "In 2007 the Games tested 7 movements. In 2026 it used 31 in one weekend, and the all-time count hit 103. What the sport tests now versus what it tested then, computed from every event ever run. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "THE ORIGINAL MENU",
        "headline": "SEVEN\nMOVEMENTS",
        "body": "The 2007 Games was three events: a hopper triplet of row, pull-up and push jerk, a trail run, and the CrossFit Total. Seven movements decided the first champions. The whole Ranch era averaged 5 events a year. Twenty seasons later, 2026 opened by re-running that entire 2007 program - the Hopper, the ranch run, the Total - then stacked 15 more events on top of it.",
        "source": "Games almanac database, 2007 + 2026 event files"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "THE NEW STAPLES",
        "headline": "BUILT\nSINCE 2011",
        "body": "Swim, bike and handstand walk did not exist at the first four Games. All three debuted in 2011. Since then the bike has appeared in 22 events - only running and rowing appear more often - the swim in 15, the handstand walk in 14. The bar muscle-up arrived in 2012 and has 14 appearances. The yoke came in 2015, the SkiErg in 2016, 9 events each. The modern test was assembled piece by piece.",
        "source": "Games almanac database, movement first-appearance index"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "QUIETLY RETIRED",
        "headline": "GONE FROM\nTHE FLOOR",
        "body": "The kettlebell swing, a gym staple, has appeared at the Games twice ever and not since 2010. The overhead squat made 10 appearances, none since 2020. Ring muscle-ups and double-unders were both last programmed in 2023. And 2026 skipped doubles entirely: it debuted triple-unders instead, plus a first-ever ring skill, the Roll to Support. Two brand-new movements in a single season.",
        "source": "Games almanac database, movement last-appearance index"
      },
      {
        "type": "stat",
        "kicker": "THE SPREAD",
        "headline": "SCALE OF\nTHE TEST",
        "stats": [
          {
            "big": "103",
            "label": "distinct movements tested since 2007"
          },
          {
            "big": "7",
            "label": "movements at the entire 2007 Games"
          },
          {
            "big": "31",
            "label": "movements at the 2026 Games alone"
          },
          {
            "big": "14.1",
            "label": "avg events per year in the Madison era vs 5 at the Ranch"
          }
        ],
        "footnote": "Computed from all 241 events in the Persistence Athletics Games almanac, 2007-2026."
      },
      {
        "type": "movement",
        "kicker": "ALL-TIME APPEARANCES",
        "headline": "THE CORE\nSIX",
        "rows": [
          {
            "rank": 1,
            "name": "Run",
            "pts": 45,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Row",
            "pts": 23,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Bike",
            "pts": 22,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Snatch",
            "pts": 22,
            "delta": null
          },
          {
            "rank": 5,
            "name": "Clean",
            "pts": 19,
            "delta": null
          },
          {
            "rank": 6,
            "name": "Deadlift",
            "pts": 18,
            "delta": null
          }
        ],
        "note": "Games events featuring each movement, 2007-2026. Running is the only movement programmed in all 20 seasons. Bike and snatch are tied at 22; thruster and HSPU also sit at 18 with deadlift."
      },
      {
        "type": "cta",
        "headline": "THE FULL MOVEMENT INDEX",
        "body": "All 103 movements, all 241 events, 2007 to 2026: first year, last year, and every appearance, verified against official results. Explore the full almanac movements index on the site. Link in bio."
      }
    ]
  },
  {
    "id": "fibonacci-lineage",
    "label": "Fibonacci Lineage: one final, three eras",
    "caption": "ONE WORKOUT HAS TESTED THE GAMES IN THREE DIFFERENT ERAS - AND CLOSED TWO OF THEM.\n\nThe Fibonacci Final ended the 2017 Games, came back with a deficit in 2018, and returned nine years after the original to end the 2026 season. Same bells every single time: 203/124-lb double-kettlebell deadlifts, 53/35-lb overhead lunge bells, 89 feet of walking. 5, 8, 13, 89 - all Fibonacci numbers.\n\nWhat changed is the filter. 2018 added a 14/8-inch parallette deficit and only four men finished inside the 6:00 cap. 2026 reran the 2018 test to the inch and stretched the cap to 10:00.\n\nThree editions, six winners, six different names: Collins and Sigmundsdottir, Fraser and Davíðsdóttir, Malheiros and Kerstetter. Nobody has beaten this test twice.\n\nEvery time and placement verified against official Games results. The full lineage lives on our almanac year pages for 2017, 2018 and 2026. Link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "GAMES HISTORY",
        "headline": "ONE TEST,\nTHREE ERAS",
        "sub": "The Fibonacci test closed the Games in 2017, evolved in 2018, and came back to end the 2026 season. Same bells, three generations. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "GENERATION ONE",
        "headline": "2017: THE\nORIGINAL",
        "body": "The Fibonacci Final debuted as the last event of 2017: 5-8-13 parallette handstand push-ups and double-kettlebell deadlifts at 203/124 lb (women's push-ups ran 3-5-8), then an 89-foot overhead lunge at 53/35 lb. The strict standard wrecked the men's field - Logan Collins was the only man under the 6:00 cap at 5:29.09, with Fraser second at CAP+2. Sara Sigmundsdottir won the women in 3:13.98, and Toomey edged Webb for the title by 2 points.",
        "source": "2017 Games, Event 13 official results"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "GENERATION TWO",
        "headline": "2018: THE\nDEFICIT",
        "body": "One year later the test returned as Event 7 with one brutal addition: a parallette deficit, 14 inches for men, 8 for women. Same bells, same 89-foot lunge, same 6:00 cap, and the women moved to the full 5-8-13 push-up scheme. Only four men finished inside the cap. Mat Fraser won in 4:54.84, still the fastest men's Fibonacci on record, and Katrín Davíðsdóttir took the women in 3:31.73. The deficit turned a shoulder test into a filter.",
        "source": "2018 Games, Event 7 official results"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "GENERATION THREE",
        "headline": "2026: THE\nRERUN",
        "body": "Nine years after the original, the 2026 season ended on the exact 2018 test: same 14/8-inch deficit, same 203/124-lb deadlift bells, same 53/35-lb lunge bells. One change - the cap stretched from 6:00 to 10:00. Guilherme Malheiros won in 5:16.70, his third event win of the Games, over Jay Crouch (5:23.94) and Ricky Garard (5:48.21). Olivia Kerstetter took the women in 3:46.67, her second win of the day, as Sprague and Cringle sealed their titles behind them.",
        "source": "2026 Games, E20 official leaderboard"
      },
      {
        "type": "stat",
        "kicker": "THE LINEAGE IN NUMBERS",
        "headline": "THREE RUNS,\nONE TEST",
        "stats": [
          {
            "big": "3",
            "label": "editions: 2017, 2018, 2026"
          },
          {
            "big": "6",
            "label": "winners, none repeated"
          },
          {
            "big": "4:54.84",
            "label": "fastest men's time - Fraser, 2018"
          },
          {
            "big": "3:13.98",
            "label": "fastest women's time - Sigmundsdottir, 2017"
          }
        ],
        "footnote": "The loads never moved: 2x203/124-lb deadlift bells and 2x53/35-lb lunge bells in all three editions. Only the deficit (added 2018) and the cap (6:00 to 10:00 in 2026) changed."
      },
      {
        "type": "point",
        "num": 4,
        "kicker": "Every Fibonacci Winner",
        "headline": "SIX CROWNS,\nSIX NAMES",
        "body": "2017: Logan Collins (5:29.09) and Sara Sigmundsdottir (3:13.98). 2018: Mat Fraser (4:54.84) and Katrin Davidsdottir (3:31.73). 2026: Guilherme Malheiros (5:16.70) and Olivia Kerstetter (3:46.67). Three editions, both divisions, six different athletes. Nobody has beaten this test twice.",
        "source": "Official Games results, 2017, 2018, 2026"
      },
      {
        "type": "cta",
        "headline": "THE FULL\nHISTORY",
        "body": "Every event, every winner, every era from 2007 to 2026 lives in our Games Almanac. Open the 2017, 2018 and 2026 year pages to trace the Fibonacci lineage in full. Link in bio."
      }
    ]
  },
  {
    "id": "rescore-machine-half-weight",
    "label": "Deep Dive + Tool: The scoring that flips the title (Re-Score Machine launch)",
    "caption": "THE SCORING THAT FLIPS THE 2026 TITLE. Here is something most fans never noticed: six of the twenty events at the 2026 Games paid HALF points. The three CrossFit Total lifts, the 3D Throw, the 500 Run, and Roll to Support - a win there was worth 50, not 100.\n\nSo we asked the obvious question: what if every event paid the same?\n\nWe re-scored all 20 events on the official 100-point table. The result: DALLIN PEPPER WINS THE 2026 CROSSFIT GAMES, 1501 to Sprague's 1484. Not because of a dropped event or a friendlier format - Pepper beat Sprague by 45 points across those six half-weight tests (Sprague pressed 26th), and doubling their value moves the crown.\n\nTwo weeks ago we tried every other re-scoring and Sprague won them all by MORE. The event weighting is the one lever that flips it. And on the women's side? Nothing touches Cringle - re-weight everything and her margin GROWS to +238.\n\nWe also built you a toy: THE RE-SCORE MACHINE is live on the site. Drag every event's weight yourself and watch the leaderboard recompute in real time. Find the scoring that crowns your athlete - then argue about it in the comments. Link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Deep Dive + Interactive Tool",
        "headline": "THE SCORING\nTHAT FLIPS IT",
        "sub": "Six of the twenty events paid half points. Weight every test the same and the 2026 men's title changes hands. We ran it - and built a machine so you can too. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "The Quiet Rule",
        "headline": "SIX TESTS,\nHALF POINTS",
        "body": "At the 2026 Games a win was worth 100 points - except in six events. The three CrossFit Total lifts, the 3D Throw, the 500 Run, and Roll to Support each paid the winner just 50. Fourteen full-weight tests, six half-weight ones. Most fans never clocked it.",
        "source": "Official 2026 Games leaderboard, per-event points"
      },
      {
        "type": "stat",
        "kicker": "The What-If",
        "headline": "EVERY EVENT\nAT 100",
        "stats": [
          {
            "big": "1501",
            "label": "Pepper's total with all 20 events at full weight"
          },
          {
            "big": "1484",
            "label": "Sprague's total under the same scoring"
          },
          {
            "big": "+17",
            "label": "Pepper's winning margin in the re-score"
          },
          {
            "big": "+27",
            "label": "Sprague's actual margin under the real scoring"
          }
        ],
        "footnote": "All 20 events re-scored on the official 100-point table, exact per-event finishes. Verified two ways."
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "Why It Flips",
        "headline": "PEPPER OWNED\nTHE HALF SIX",
        "body": "Across the six half-weight tests Pepper outscored Sprague by 45 points - average finish 9.2 to 13.2, with Sprague's shoulder press a 26th. Sprague built his title in the fourteen full-weight events, up 72 there. Restore the six to full value and the crown moves.",
        "source": "Computed from official per-event finishes"
      },
      {
        "type": "movement",
        "kicker": "All Events at 100 - Men",
        "headline": "THE RE-SCORED\nBOARD",
        "rows": [
          {
            "rank": 1,
            "name": "Dallin Pepper",
            "pts": 1501,
            "delta": null
          },
          {
            "rank": 2,
            "name": "James Sprague",
            "pts": 1484,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Jay Crouch",
            "pts": 1400,
            "delta": null
          },
          {
            "rank": 4,
            "name": "Ricky Garard",
            "pts": 1267,
            "delta": null
          },
          {
            "rank": 5,
            "name": "Justin Medeiros",
            "pts": 1232,
            "delta": null
          },
          {
            "rank": 6,
            "name": "Jayson Hopper",
            "pts": 1214,
            "delta": null
          }
        ],
        "note": "Same podium trio, new order at the top. Garard edges past Medeiros for 4th and Malheiros climbs from 9th to 7th."
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "The Women",
        "headline": "CRINGLE IS\nSCORING-PROOF",
        "body": "Run the same re-score on the women's board and the title does not wobble: Cringle 1643, Lawson 1405 - a 238-point gap, up from 136 under the real scoring. That is now three different re-scorings that cannot touch her. And to be clear on the men too: athletes raced the format they were given. This is a thought experiment, not a protest.",
        "source": "Same method, women's division"
      },
      {
        "type": "cta",
        "headline": "NOW YOU\nRE-SCORE IT",
        "body": "The Re-Score Machine is live on the site: drag every event's weight and watch the whole leaderboard recompute in real time. Find the scoring that crowns your athlete. Link in bio."
      }
    ]
  },
  {
    "id": "repeat-champions-dynasties",
    "label": "Deep Dive: Repeat champions & the dynasties (Sprague's rare feat)",
    "caption": "REPEAT CHAMPIONS, AND THE ONE WHO BROKE THE PATTERN. Twenty years of the men's CrossFit Games, eleven different champions - and only four men ever repeated. Every one of them did it back-to-back.\n\nRich Froning took four straight (2011-2014). Mat Fraser stacked a record five (2016-2020). Justin Medeiros went back-to-back (2021-2022). Win it, then defend it - that was the only path anyone ever found to a second title.\n\nThen James Sprague did the thing none of them did. He won in 2024, lost the crown to Jayson Hopper in 2025 (finishing 3rd), and took it back in 2026. The first and only man ever to win the CrossFit Games in non-consecutive years.\n\nDynasties are built on streaks. Sprague built his on a comeback. Full breakdown at the link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Deep Dive - The Data",
        "headline": "BACK-TO-BACK,\nEXCEPT ONE",
        "sub": "Twenty years of the men's Games. Eleven champions. Only James Sprague ever won it, lost it, and won it back. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "The Pattern",
        "headline": "BUILT ON\nSTREAKS",
        "body": "For nineteen editions, every man who won the Games more than once did it in an unbroken run. Froning took four straight (2011-2014). Fraser stacked a record five (2016-2020). Medeiros went back-to-back (2021-2022). Win it, then defend it - that was the only path anyone ever found to a repeat.",
        "source": "Official CrossFit Games results, 2007-2026"
      },
      {
        "type": "stat",
        "kicker": "The Men's Crown",
        "headline": "TWENTY YEARS,\nONE EXCEPTION",
        "stats": [
          {
            "big": "20",
            "label": "editions of the Games, 2007-2026"
          },
          {
            "big": "11",
            "label": "different men have won the title"
          },
          {
            "big": "4",
            "label": "of them won it more than once"
          },
          {
            "big": "5",
            "label": "Fraser's record title streak, 2016-2020"
          }
        ],
        "footnote": "Men's division, computed from official Games results 2007-2026."
      },
      {
        "type": "movement",
        "kicker": "Multiple Titles",
        "headline": "MORE THAN\nONE CROWN",
        "rows": [
          {
            "rank": 1,
            "name": "Mat Fraser",
            "pts": 5,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Rich Froning",
            "pts": 4,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Justin Medeiros",
            "pts": 2,
            "delta": null
          },
          {
            "rank": 4,
            "name": "James Sprague",
            "pts": 2,
            "delta": null
          }
        ],
        "note": "The number is titles won. Fraser, Froning and Medeiros stacked theirs consecutively. Sprague's two came split - 2024 and 2026."
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "The Exception",
        "headline": "LOST IT,\nTOOK IT BACK",
        "body": "Sprague won in 2024, beating Dallin Pepper by 21 points. In 2025 he finished third while Jayson Hopper took the title. Then in 2026 he beat Pepper again, by 27, to reclaim it. No man before him had ever won the Games, lost the crown, and won it back.",
        "source": "Official CrossFit Games results, 2024-2026"
      },
      {
        "type": "stat",
        "kicker": "First of His Kind",
        "headline": "WHAT NO MAN\nHAD DONE",
        "stats": [
          {
            "big": "2",
            "label": "titles: 2024 and 2026"
          },
          {
            "big": "3rd",
            "label": "his 2025 finish, behind champion Hopper"
          },
          {
            "big": "2 yrs",
            "label": "between his first crown and his second"
          },
          {
            "big": "1st",
            "label": "man ever to repeat non-consecutively"
          }
        ],
        "footnote": "James Sprague, men's division. Official Games results 2024-2026."
      },
      {
        "type": "cta",
        "headline": "THE WHOLE\nDYNASTY, MAPPED",
        "body": "Every champion, every streak, every event score - two decades of the Games on the site. We run the numbers straight off the official results. Link in bio."
      }
    ]
  },
  {
    "id": "fraser-vs-toomey-goat-ledger",
    "label": "Deep Dive: Fraser vs Toomey - the GOAT ledger",
    "caption": "FRASER vs TOOMEY: THE GOAT LEDGER. Two athletes redrew what dominant means, and they did it in opposite directions.\n\nMat Fraser (2016-2020) turned the Games into a demolition. His 2020 title: 14 event wins in 19 tests, a 1.68 average finish, and a 545-point gap over 2nd, the largest championship margin the points era has ever recorded. Five titles, all in a row, the men's record.\n\nTia-Clair Toomey (2017-2022, 2024, 2025) did it with time. Eight titles, more than any athlete in history, across nine seasons, missing only 2023. Her 360-point win in 2020 is the biggest margin ever posted by a woman, and her 43 event wins across her title years bury the field.\n\nHere is the tell: the 9 largest championship margins of the points era all wear one of these two names. The first outsider, Jeffrey Adler with 116 in 2023, sits 10th.\n\nRaw margin vs sheer count. Peak vs longevity. Let the numbers referee. Full head-to-head at the link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Deep Dive - The GOAT Ledger",
        "headline": "FRASER\nvs TOOMEY",
        "sub": "The two most dominant champions the sport has produced, refereed by their own numbers. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "The Count",
        "headline": "8 TITLES\nTO 5",
        "body": "Toomey owns 8 Games titles (2017-2022, 2024-2025), the most any athlete has ever won. Fraser stacked 5 straight from 2016 to 2020, the men's record. Two ceilings, both still untouched.",
        "source": "Official CrossFit Games results, 2007-2025"
      },
      {
        "type": "stat",
        "kicker": "The Ledger, Side by Side",
        "headline": "CAREER FOR\nCAREER",
        "stats": [
          {
            "big": "5 - 8",
            "label": "Games titles (Fraser - Toomey)"
          },
          {
            "big": "27 - 43",
            "label": "event wins in their title years"
          },
          {
            "big": "545 - 360",
            "label": "biggest championship margin, points"
          },
          {
            "big": "5 - 6",
            "label": "longest streak, titles in a row"
          }
        ],
        "footnote": "Fraser leads on peak margin, Toomey on volume and streak. His 545 is the biggest points-era win over 2nd; her 360 is the biggest ever by a woman."
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "Fraser: The Margin",
        "headline": "A 545-POINT\nROUT",
        "body": "In 2020 Fraser won 14 of 19 events and finished outside the top four just once all week (an 8th). A 1.68 average placement and a 545-point cushion over 2nd make it the most lopsided single Games the sport has seen. Not close, never close.",
        "source": "Official CrossFit Games results, 2011-2020"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "Toomey: The Reign",
        "headline": "8 TITLES,\n9 SEASONS",
        "body": "Toomey won every Games she entered from 2017 through 2025, sitting out only 2023. Six straight (2017-2022) is the longest streak anyone has managed, and the 2024-2025 comeback pushed her to 8, with 43 event wins across those title years. Dominance measured in years, not just points.",
        "source": "Official CrossFit Games results, 2017-2025"
      },
      {
        "type": "movement",
        "kicker": "The Biggest Routs (points era)",
        "headline": "THE BIGGEST\nROUTS",
        "rows": [
          {
            "rank": 1,
            "name": "Fraser - 2020",
            "pts": 545,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Toomey - 2020",
            "pts": 360,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Toomey - 2021",
            "pts": 256,
            "delta": null
          },
          {
            "rank": 4,
            "name": "Fraser - 2018",
            "pts": 220,
            "delta": null
          },
          {
            "rank": 5,
            "name": "Fraser - 2017",
            "pts": 216,
            "delta": null
          },
          {
            "rank": 6,
            "name": "Fraser - 2016",
            "pts": 197,
            "delta": null
          }
        ],
        "note": "Points-era championship margin (winner over 2nd), 2011-2025. The 9 biggest all belong to these two; the next name down is Adler at 116 in 2023."
      },
      {
        "type": "cta",
        "headline": "THE FULL\nGOAT LEDGER",
        "body": "Every event, every margin, every title, broken down on the site. The numbers do the talking. Link in bio."
      }
    ]
  },
  {
    "id": "biggest-comebacks-2026",
    "label": "Deep Dive: The biggest comebacks of 2026 (single-event climbs)",
    "caption": "THE BIGGEST COMEBACKS OF 2026. A 20-event Games is chaos math. After the opening Hopper the entire 30-woman field sat inside 100 points, so the Ranch 7200 run (Event 2) blew the order apart.\n\nRachel Noel finished dead last in the Hopper, ran 7th on the 7.2km, and jumped from 30th to 17th in a single event - a +13 swing, the biggest one-event climb of the 2026 Games. Nika Maisuradze authored the men's version, 25th to 14th on the same run.\n\nAnd the full-Games arcs go further: Olivia Kerstetter bottomed out 29th after the run and finished 6th, 23 places recovered. The lesson for anyone chasing a leaderboard: you rarely need to win the event. You need one clean result while the field is still bunched.\n\nWe ranked every athlete after every one of the 20 events to build this - numbers only, no hype, kept to 2026 on purpose (field sizes and scoring changed too much across eras for an honest all-time board). Full running standings at the link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Deep Dive - The Data",
        "headline": "THE BIGGEST\nCOMEBACKS",
        "sub": "Twenty events, thirty athletes. We ranked the whole field after every single test to find the wildest one-event climbs up the leaderboard. Swipe."
      },
      {
        "type": "movement",
        "kicker": "2026 - Biggest Single-Event Climbs",
        "headline": "DOUBLE-DIGIT\nJUMPS",
        "rows": [
          {
            "rank": 1,
            "name": "Rachel Noel (W)",
            "pts": 13,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Nika Maisuradze (M)",
            "pts": 11,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Paige Rodgers (W)",
            "pts": 11,
            "delta": null
          },
          {
            "rank": 4,
            "name": "Ella Wilkinson (W)",
            "pts": 11,
            "delta": null
          },
          {
            "rank": 5,
            "name": "Danielle Brandon (W)",
            "pts": 10,
            "delta": null
          },
          {
            "rank": 6,
            "name": "Miley Wade (W)",
            "pts": 10,
            "delta": null
          }
        ],
        "note": "Places gained in overall standing on a single event; equal climbs ordered by how deep the hole was. Four of these six came on the Ranch 7200 run (Event 2)."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "Why the Board Whipsaws",
        "headline": "A BUNCHED\nFIELD",
        "body": "After Event 1 the whole 30-athlete field sat inside 100 points, with 10th place on 64 and 20th on just 30. So the Ranch 7200 run (Event 2) detonated the order: one strong endurance result vaulted athletes double digits while a weak run buried others. It was the single most volatile test of the Games - 136 overall places changed hands among the men, 134 among the women.",
        "source": "Persistence Athletics, computed from the 2026 CrossFit Games live leaderboard"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "Who Authored the Surge",
        "headline": "LAST TO\nSEVENTEENTH",
        "body": "Rachel Noel finished dead last (30th) in the opening Hopper, then ran 7th on the Ranch 7200 to jump from 30th to 17th - a +13 swing, the biggest single-event climb of 2026. Nika Maisuradze did the men's version: 25th after the Hopper, 6th on the run, 25th to 14th for +11. Neither one won the event. In a bunched field you do not need to win to move - you need one clean result.",
        "source": "Official CrossFit Games results, 2026"
      },
      {
        "type": "stat",
        "kicker": "The Numbers Behind the Leaps",
        "headline": "ONE EVENT,\nBIG SWINGS",
        "stats": [
          {
            "big": "+13",
            "label": "Rachel Noel on the Ranch run, 30th to 17th - the biggest jump of 2026"
          },
          {
            "big": "+11",
            "label": "Nika Maisuradze on the same run, 25th to 14th - the men's biggest"
          },
          {
            "big": "23",
            "label": "places Olivia Kerstetter recovered, from 29th to 6th overall"
          },
          {
            "big": "270",
            "label": "overall-standing places that changed hands on the Ranch run alone"
          }
        ],
        "footnote": "Standings computed by ranking every athlete on cumulative points after each of the 20 events."
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "Bigger Than One Event",
        "headline": "BASEMENT TO\nTOP TEN",
        "body": "Single events swing the board, but the full arc is wilder. Olivia Kerstetter bottomed out 29th after the run and clawed back to finish 6th - 23 places recovered. Guilherme Malheiros went 28th to 9th, Paige Rodgers 28th to 8th. We keep this to 2026 on purpose: field sizes and scoring changed too much across eras for an honest all-time single-event climb board.",
        "source": "Persistence Athletics Games Almanac; 2026 live leaderboard"
      },
      {
        "type": "cta",
        "headline": "EVERY EVENT'S\nBOARD",
        "body": "Full running standings after all 20 events, plus every athlete's climb and slide, on the site. Link in bio."
      }
    ]
  },
  {
    "id": "from-the-floor-bayley-martin",
    "label": "From the Floor: Bayley Martin's first win (transcript story)",
    "caption": "'I JUST LIKE THE WEIRD STUFF.' The story of how a 30th-place finish became a first career Games win, one event later.\n\nSunday morning at the 2026 Games, Bayley Martin finished 30th - dead last of the men - on the Machine 7200. On the final day of a title-tight Games, that is the kind of result that quietly ends a weekend. Then the very next event, the Roll to Support rings test, Martin went out and WON it: 25 reps, the first event win of his career. Thirtieth to first, back to back.\n\nAsked where the rings skill came from, he kept it simple: 'I don't know, I just liked the weird stuff. I just find that I'm good at all the weird things. I like gymnastics, and it was a cool skill to do out on the floor. So I had fun with it and got the W.'\n\nOn bouncing back from last to first: 'It's not over till it's over. I didn't have a good finish in the machine piece, so I just had to come out here and do what I can. Focus on one event at a time and stay in my own lane.'\n\nThe gymnastics specialists owned that event - Victor Hoffer 3rd, Patrick Vellner 4th - but it was Martin, the guy who just likes the weird stuff, who walked away with the win. First of his career. Probably not the last. More stories from the floor at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "From the Floor", "headline": "'I JUST LIKE\nTHE WEIRD STUFF'", "sub": "How a 30th-place finish became a first career Games win, one event later. A story from the arena floor. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Morning", "headline": "DEAD LAST ON\nTHE MACHINE", "body": "Sunday morning at the 2026 Games, Bayley Martin finished 30th - last of the men in the field - on the Machine 7200. On the final day of a title-tight Games, that is the kind of result that quietly ends a weekend. Most athletes would have let it deflate the whole day. Martin had other plans.", "source": "Official 2026 leaderboard, Event 18" },
      { "type": "point", "num": 2, "kicker": "One Event Later", "headline": "THEN HE WON\nTHE RINGS", "body": "The very next event was the Roll to Support, a novel rings skill test. Martin went out and won it - 25 reps for the first event win of his career. Thirtieth to first, in back-to-back events, on the final day of the biggest Games in history. One of the wildest single-session swings of the entire week.", "source": "Official 2026 leaderboard, Event 19" },
      { "type": "point", "num": 3, "kicker": "In His Words", "headline": "'GOOD AT ALL\nTHE WEIRD THINGS'", "body": "Asked where the rings proficiency came from, Martin kept it simple: 'I don't know, I just liked the weird stuff. I just find that I'm good at all the weird things. I like gymnastics, and it was a cool skill to do out on the floor. So I had fun with it and got the W.' No sports science. Just a guy who likes the strange movements most athletes avoid.", "source": "Games broadcast, Event 19 floor interview" },
      { "type": "point", "num": 4, "kicker": "The Bounce-Back", "headline": "ONE EVENT\nAT A TIME", "body": "On following a last-place finish with a win, he was just as grounded: 'It's not over till it's over. I didn't have a good finish in the machine piece, so I just had to come out here and do what I can. Focus on one event at a time and stay in my own lane.' A masterclass in not letting a bad result become a bad day.", "source": "Games broadcast, Event 19 floor interview" },
      { "type": "point", "num": 5, "kicker": "The Class of 2026", "headline": "REMEMBER\nTHE NAME", "body": "Martin finished 13th overall in a stacked field, and the rings win put an exclamation point on it. The gymnastics specialists were supposed to own that event - Victor Hoffer took 3rd, Patrick Vellner 4th - but it was Martin, the guy who just likes the weird stuff, who walked away with the win. First of his career. Probably not the last.", "source": "Official 2026 CrossFit Games" },
      { "type": "cta", "headline": "STORIES FROM\nTHE FLOOR", "body": "The moments the leaderboard doesn't capture - the quotes, the swings, the bounce-backs. Full Games coverage on the site. Link in bio." }
    ]
  },
  {
    "id": "closest-mens-race-ever",
    "label": "Deep Dive: The tightest men's races ever (+ the blowout era's end)",
    "caption": "THE MEN'S TITLE HAS NEVER BEEN THIS CLOSE. The CrossFit Games men's championship used to be a blowout. Now it is a photo finish, three years running.\n\nTHREE STRAIGHT NAIL-BITERS: the last three men's champions all won by 27 points or fewer - Sprague by 21 in 2024, Hopper by just 14 in 2025, and Sprague again by 27 in 2026. In a 20-event Games worth well over a thousand points, those are rounding errors. They are three of the four closest men's title races of the modern points era, back to back to back.\n\nTHE BLOWOUT ERA IS OVER: it was not always like this. Mat Fraser won the 2020 Games by 545 points and routinely by 200-plus. Tia-Clair Toomey won the 2020 women's title by 360. Those margins now look like science fiction. The gap between first and second has collapsed from a canyon to a coin flip in a few years.\n\nTHE VERDICT: put it with the rest of our data - no historically dominant champion, the widest winner spread ever (23 in 2026), and now the tightest title races on record. Three independent signals, one conclusion: this is the most competitive era in CrossFit Games history. Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Deep Dive - The Data", "headline": "THE TIGHTEST\nRACE IN YEARS", "sub": "The men's CrossFit Games title used to be a blowout. Now it is a photo finish, three years running. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Trend", "headline": "DECIDED BY\nA WHISKER", "body": "The last three men's champions all won by 27 points or fewer: Sprague by 21 in 2024, Hopper by just 14 in 2025, and Sprague again by 27 in 2026. In a 20-event Games worth well over a thousand points, those are rounding errors. Three of the four closest men's title races of the modern points era, back to back to back.", "source": "Official CrossFit Games results, points era" },
      { "type": "stat", "kicker": "By the Numbers", "headline": "MARGINS\nCOLLAPSING", "stats": [ { "big": "+14", "label": "Hopper's 2025 win - closest men's final of the era" }, { "big": "+21", "label": "Sprague's 2024 winning margin" }, { "big": "+27", "label": "Sprague's 2026 margin over Pepper" }, { "big": "3", "label": "straight finals decided by under 30 points" } ], "footnote": "Three of the four tightest men's title races on record, all since 2024." },
      { "type": "movement", "kicker": "Closest Men's Finals, Points Era", "headline": "PHOTO\nFINISHES", "rows": [ { "rank": 1, "name": "2025 - Jayson Hopper", "pts": 14, "delta": null }, { "rank": 2, "name": "2024 - James Sprague", "pts": 21, "delta": null }, { "rank": 3, "name": "2022 - Justin Medeiros", "pts": 27, "delta": null }, { "rank": 3, "name": "2026 - James Sprague", "pts": 27, "delta": null }, { "rank": 5, "name": "2019 - Mat Fraser", "pts": 35, "delta": null } ], "note": "Winning margin, first over second. The four closest men's finals are all from 2022 on." },
      { "type": "point", "num": 2, "kicker": "The Contrast", "headline": "REMEMBER\nWHEN?", "body": "It was not always like this. Mat Fraser won the 2020 Games by 545 points and routinely by 200 or more. Tia-Clair Toomey won the 2020 women's title by 360. Those margins now look like science fiction. In just a few years the gap between first and second has collapsed from a canyon to a coin flip.", "source": "Official CrossFit Games results, 2016-2026" },
      { "type": "point", "num": 3, "kicker": "The Verdict", "headline": "THE MOST\nCOMPETITIVE ERA", "body": "Put it with everything else in the data: no historically dominant champion, the widest winner spread the sport has ever seen (23 different event winners in 2026), and now the tightest title races on record. Three independent signals, one conclusion. This is the most competitive era in CrossFit Games history, and on any given weekend, almost anyone can win.", "source": "Persistence Athletics Games Almanac" },
      { "type": "cta", "headline": "EVERY RACE,\nEVERY MARGIN", "body": "Twenty years of title races, ranked and measured, are on the site. Link in bio." }
    ]
  },
  {
    "id": "after-toomey-womens-field",
    "label": "Deep Dive: After the Queen - the Toomey era + what comes next",
    "caption": "AFTER THE QUEEN. For a decade, one woman owned the CrossFit Games. The numbers behind Tia-Clair Toomey's reign are almost unfair - and 2026 marked a clear break.\n\nTHE REIGN: from 2017 to 2025, Toomey won EIGHT of nine Fittest Woman on Earth titles, giving up only 2023 (to Laura Horvath). No one in CrossFit, man or woman, has strung together anything like it.\n\nSHE DIDN'T JUST WIN, SHE LAPPED THE FIELD: in 2020 she won 13 of the 19 events and finished 360 points clear of second - the largest winning margin in women's Games history. Her average finish that year was 2.58 across the entire Games. She nearly matched it in 2021 (2.27 average, +256). That is the most dominant stretch the sport has ever seen.\n\nTHEN 2026: the top of the women's board read a name other than Toomey for only the second time since 2016. Aimee Cringle won it - and won it as the least dominant women's champion in years, averaging 5.50 with a couple of finishes outside the top ten. Excellent, but not untouchable.\n\nPair that with the deepest winner spread ever (23 different event winners in 2026) and the read is clear: the era of one untouchable woman is giving way to the most open women's field in years. The door is wide open. Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Deep Dive - The Data", "headline": "AFTER\nTHE QUEEN", "sub": "For a decade one woman owned the Games. The numbers behind Tia-Clair Toomey's reign are almost unfair - and 2026 broke it. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Reign", "headline": "EIGHT TITLES,\nONE WOMAN", "body": "From 2017 to 2025, Tia-Clair Toomey won EIGHT of nine Fittest Woman on Earth titles, surrendering only 2023, to Laura Horvath. No one in CrossFit, man or woman, has ever strung together anything close to it. And she did not just win. She lapped the field, year after year.", "source": "Persistence Athletics Games Almanac, women's champions" },
      { "type": "stat", "kicker": "Numbers That Break the Scale", "headline": "NOT EVEN\nCLOSE", "stats": [ { "big": "8", "label": "Fittest Woman titles (2017 to 2025)" }, { "big": "+360", "label": "her 2020 winning margin - largest in women's history" }, { "big": "13", "label": "event wins in 2020 alone, out of 19" }, { "big": "2.27", "label": "her best average finish (2021) - untouchable" } ], "footnote": "For reference, 2026's champion averaged 5.50 and won by 136." },
      { "type": "point", "num": 2, "kicker": "The Peak", "headline": "THE MOST DOMINANT\nGAMES EVER", "body": "Look at 2020: Toomey won 13 of the 19 events and finished 360 points clear of second place, averaging a 2.58 finish across the entire Games. That is not a champion having a good week. That is the single most dominant Games performance by anyone in the sport's history, and she nearly repeated it in 2021 with a 2.27 average and a 256-point margin.", "source": "Official CrossFit Games results, 2020-2021" },
      { "type": "point", "num": 3, "kicker": "Then 2026", "headline": "A DIFFERENT\nERA", "body": "In 2026, the top of the women's leaderboard read a name other than Toomey for only the second time since 2016. Aimee Cringle won it, and won it as the least dominant women's champion in years, averaging 5.50 with a couple of finishes outside the top ten. She was excellent. She was not untouchable. Right now, nobody is.", "source": "Official 2026 CrossFit Games" },
      { "type": "point", "num": 4, "kicker": "The Verdict", "headline": "THE FIELD\nIS OPEN", "body": "Pair this with the deepest winner spread the sport has ever produced, 23 different event winners in 2026, and the picture is clear. The era of one untouchable woman owning the Games has given way to the most open women's field in years. Somebody may build the next dynasty. For now, the door is wide open.", "source": "Persistence Athletics Games Almanac" },
      { "type": "cta", "headline": "20 YEARS,\nEVERY QUEEN", "body": "Every champion, every margin, every dominant run back to 2007 is on the site. Link in bio." }
    ]
  },
  {
    "id": "what-if-rescore-2026",
    "label": "Deep Dive: What if we re-scored 2026? (does Pepper win?)",
    "caption": "WE TRIED TO GIVE DALLIN PEPPER THE TITLE. WE COULDN'T. Pepper lost the 2026 CrossFit Games to James Sprague by 27 points - one of the closest men's races in years. Pepper fans have a fair case: 20 events is a lot of chances for one bad day to cost you a championship. So we re-scored the entire Games under two fairer-sounding systems to see if it flips.\n\nWHAT-IF #1 - DROP YOUR WORST EVENT: let everyone throw out their single worst result. It should help Pepper. It does not. Sprague's worst day was a 26th place worth just 4 points, so erasing it barely moves him. Final: Sprague 1314, Pepper 1284. The lead GROWS to 30.\n\nWHAT-IF #2 - BEST 15 OF 20: score only each athlete's best 15 events, the most forgiving system imaginable. The gap balloons: Sprague 1208, Pepper 1139, a 69-point chasm.\n\nEvery re-scoring we tried did not just keep Sprague on top, it widened his lead. Consistency is not a scoring quirk you can engineer away. Sprague did not back into this title on a formula - he won because there was no hole to exploit and no bad day to erase. All recomputed from the official per-event points. Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Deep Dive - What If", "headline": "WE TRIED TO GIVE\nPEPPER THE TITLE", "sub": "Dallin Pepper lost the 2026 Games by 27 points. We re-scored the whole thing to see if any fairer system flips it. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Setup", "headline": "27 POINTS,\nSO CLOSE", "body": "James Sprague beat Dallin Pepper by 27 points, one of the closest men's finishes in years. Pepper fans have a fair argument: the man had a couple of rough events, and 20 events is a lot of chances for one bad day to cost you a title. So we asked the obvious question. If the scoring forgave a bad day, would Pepper be champion? We ran the entire Games under two fairer-sounding systems.", "source": "Official 2026 CrossFit Games leaderboard" },
      { "type": "stat", "kicker": "The Answer", "headline": "EVERY SCORING,\nSAME WINNER", "stats": [ { "big": "+27", "label": "Sprague's actual winning margin" }, { "big": "+30", "label": "if everyone drops their worst event" }, { "big": "+69", "label": "if only your best 15 of 20 count" }, { "big": "0", "label": "systems where Pepper takes the title" } ], "footnote": "Every alternative we tried did not just keep Sprague on top - it widened his lead." },
      { "type": "point", "num": 2, "kicker": "What-If #1", "headline": "GIVE EVERYONE\nA MULLIGAN", "body": "First test: let every athlete throw out their single worst event. That sounds like it should help Pepper. It does not. Sprague's worst day was a 26th place that earned him just 4 points, so erasing it barely moves him. Pepper's worst event was worth more, so he loses more by dropping it. Final: Sprague 1314, Pepper 1284. The lead grows to 30. You cannot forgive a bad day Sprague never had.", "source": "Recomputed from official per-event points" },
      { "type": "point", "num": 3, "kicker": "What-If #2", "headline": "COUNT ONLY\nYOUR BEST", "body": "Second test: drop each athlete's worst five events and score only their best 15. This is the most forgiving system imaginable, and it should reward peaks over grind. Instead the gap balloons: Sprague 1208, Pepper 1139, a 69-point chasm. The more you forgive bad days, the more Sprague wins, for the simple reason that he did not have them.", "source": "Recomputed from official per-event points" },
      { "type": "point", "num": 4, "kicker": "The Verdict", "headline": "NOT A\nTECHNICALITY", "body": "We tried, in good faith, to hand Pepper the 2026 title under two systems designed to forgive exactly his kind of week. Both times Sprague won by more. Consistency is not a scoring quirk you can engineer away. Sprague did not back into this championship on a formula. He won it because there was no hole to exploit and no bad day to erase. The Unshakable, proven a third way.", "source": "Persistence Athletics Games Almanac" },
      { "type": "cta", "headline": "THE DATA\nDOESN'T BLINK", "body": "Every event, every point, every what-if is on the site - the analysis a full results database makes possible. Link in bio." }
    ]
  },
  {
    "id": "deepest-field-ever",
    "label": "Deep Dive: 23 winners - the deepest Games field ever?",
    "caption": "23 WINNERS: WAS 2026 THE DEEPEST FIELD EVER? We counted the distinct event winners at every CrossFit Games since 2007 - and 2026 does not just hold the record, it demolished it.\n\nTHE NUMBER: 23 different athletes won at least one event in 2026 (12 men, 11 women) across the 20-event schedule. The previous high in Games history was 14, back in 2018. Nobody had ever cracked 15 before. 2026 hit 23.\n\nBUT IS IT FAIR? 2026 had the most events ever (20), which means more chances for more winners. Fair point - so we normalized it: winners per event. 2026 comes out at 0.57, the HIGHEST of any Games with 12 or more events (next is 2018 at 0.50). The spread is real, not just a long schedule.\n\nTHE SYNTHESIS: pair this with our dominance analysis and the picture is clear. 2026 had no historically dominant champion (Sprague ranked 17th of 20 all-time) AND the widest winner spread the sport has ever seen. Both point to the same conclusion: this was the deepest, most open field in CrossFit Games history. The era of one athlete owning the Games may be over.\n\nThe kind of read only 20 years of data can deliver. Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Deep Dive - The Data", "headline": "23 WINNERS,\nONE GAMES", "sub": "2026 spread its event wins wider than any CrossFit Games in history. By a lot. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Number", "headline": "A RECORD,\nDEMOLISHED", "body": "23 different athletes won at least one event at the 2026 CrossFit Games - 12 men and 11 women across the 20-event schedule. That is not an incremental record. The previous high in the sport's history was 14 (in 2018), and no Games had ever cracked 15. 2026 hit 23. When that many people can win an event, it means nobody could hide and nobody could dominate.", "source": "Persistence Athletics Games Almanac, 2007-2026" },
      { "type": "stat", "kicker": "By the Numbers", "headline": "THE SPREAD,\nMEASURED", "stats": [ { "big": "23", "label": "different athletes won an event in 2026" }, { "big": "12/11", "label": "men / women with at least one event win" }, { "big": "14", "label": "the previous record (2018) - shattered" }, { "big": "0.57", "label": "winners per event - highest of any 12+ event Games" } ], "footnote": "The next-deepest fields (2018, 2015, 2016) topped out at 14 and 12 distinct winners." },
      { "type": "movement", "kicker": "Most Distinct Winners, by Year", "headline": "NOTHING\nCLOSE", "rows": [ { "rank": 1, "name": "2026 (20 events)", "pts": 23, "delta": null }, { "rank": 2, "name": "2018 (14 events)", "pts": 14, "delta": null }, { "rank": 3, "name": "2015 (13 events)", "pts": 12, "delta": null }, { "rank": 3, "name": "2016 (15 events)", "pts": 12, "delta": null }, { "rank": 3, "name": "2025 (10 events)", "pts": 12, "delta": null } ], "note": "Distinct athletes with 1+ event win, men and women combined. 2026's 23 dwarfs the old record of 14." },
      { "type": "point", "num": 2, "kicker": "The Honest Caveat", "headline": "BUT IS IT\nJUST MORE EVENTS?", "body": "Fair question: 2026 ran 20 events, the most ever, so of course there were more chances for winners. So we normalized it - winners per event. 2026 scores 0.57, the highest of any Games with 12 or more events (the next best is 2018 at 0.50). Even accounting for the long schedule, the wins were spread wider in 2026 than in any comparable Games. The depth is real.", "source": "Persistence Athletics Games Almanac" },
      { "type": "point", "num": 3, "kicker": "Put It Together", "headline": "THE MOST OPEN\nFIELD EVER", "body": "Now pair this with what we found on the champions: Sprague's winning average ranks 17th of 20 all-time, one of the least dominant title runs on record. So 2026 gave us no historically dominant champion AND the widest winner spread the sport has ever seen. Both facts say the same thing. This was the deepest, most open field in CrossFit Games history, and the era of one athlete owning the Games may be over.", "source": "Persistence Athletics Games Almanac" },
      { "type": "cta", "headline": "DEPTH YOU CAN\nONLY SEE IN DATA", "body": "Twenty years of event results, every winner, every year, are on the site - the read no single Games can give you. Link in bio." }
    ]
  },
  {
    "id": "hopper-2007-vs-2026",
    "label": "Deep Dive: The Hopper, 2007 vs 2026 (19 years apart)",
    "caption": "SAME WORKOUT, 19 YEARS APART. The very first workout of the very first CrossFit Games in 2007 got rerun as Event 1 of the 2026 Games - and the times show exactly how far the sport has come.\n\nTHE WORKOUT (identical both years): for time, 1,000m row, then 5 rounds of 25 pull-ups and 7 push jerks (135 lb men / 85 lb women).\n\nTHE GAP: in 2007, Brett Marshall won it for the men in 13:07 and Jolie Gentry for the women in 16:22. In 2026, Jay Crouch did the identical workout in 7:11 and Madeline Sturt in 8:03. Both 2026 winners NEARLY HALVED the original times. Crouch could have finished, rested nearly six minutes, and still beaten Marshall's 2007 time.\n\nWHAT CHANGED: 19 years of the sport professionalizing - efficient kipping and butterfly pull-up cycling, real pacing strategy, full-time athletes, and a talent pool that exploded from a few hundred to hundreds of thousands. Same reps, same loads, same row. Everything else evolved.\n\nONE MORE TWIST: Crouch and Sturt are an engaged couple, and they both won the reprised opener. This is the kind of comparison only a 20-year database can make. Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Deep Dive - The Data", "headline": "SAME WORKOUT,\n19 YEARS APART", "sub": "The first workout of the first CrossFit Games, rerun in 2026. The times will stop you. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Workout", "headline": "THE 2007\nHOPPER, AGAIN", "body": "It opened the very first CrossFit Games in 2007, and CrossFit brought it back as Event 1 of the 2026 Games, 19 years later, rep for rep. For time: a 1,000-meter row, then five rounds of 25 pull-ups and 7 push jerks at 135 lb for men, 85 for women. Identical both years. Which makes the stopwatch the perfect time machine.", "source": "Persistence Athletics Games Almanac (2007 + 2026 event data)" },
      { "type": "stat", "kicker": "The Time Machine", "headline": "NEARLY HALVED\nIN 19 YEARS", "stats": [ { "big": "7:11", "label": "Jay Crouch, 2026 - Brett Marshall won it in 13:07 in 2007" }, { "big": "8:03", "label": "Madeline Sturt, 2026 - Jolie Gentry won it in 16:22 in 2007" }, { "big": "~2x", "label": "faster: both 2026 winners nearly halved the 2007 times" }, { "big": "19", "label": "years between the two runnings of the same workout" } ], "footnote": "Same reps, same loads, same 1,000m row. Only the era is different." },
      { "type": "point", "num": 2, "kicker": "Read That Again", "headline": "A SIX-MINUTE\nHEAD START", "body": "Brett Marshall's 13:07 won the men's Hopper in 2007. Jay Crouch did the exact same workout in 7:11 in 2026. He could have finished, sat down and rested for nearly six minutes, and still beaten the 2007 winner. On the women's side, Madeline Sturt's 8:03 came in at less than half of Jolie Gentry's 16:22. Not a little faster. Twice as fast.", "source": "Official CrossFit Games results, 2007 and 2026" },
      { "type": "point", "num": 3, "kicker": "What Changed", "headline": "19 YEARS OF\nEVOLUTION", "body": "The workout did not get easier. The sport got better. Efficient kipping and butterfly pull-up cycling replaced grind-it-out reps. Pacing became a science. Athletes went from weekend warriors to full-time professionals with coaches, nutrition and recovery. And the talent pool grew from a few hundred people to hundreds of thousands worldwide. Same test, a completely different level of human answering it.", "source": "Persistence Athletics coaching + Games Almanac" },
      { "type": "point", "num": 4, "kicker": "One More Twist", "headline": "AND THEY'RE\nA COUPLE", "body": "The two athletes who reran history in 2026, Jay Crouch and Madeline Sturt, are an engaged couple, and they both won the reprised opener on the same day. A perfect bookend to a workout that has been part of the sport since day one. This is the kind of story that only lives in the data when you have kept all 20 years of it.", "source": "Official 2026 CrossFit Games, Event 1" },
      { "type": "cta", "headline": "20 YEARS,\nONE DATABASE", "body": "Every event, every year, back to the first Games in 2007, is on the site - the comparisons only a full history makes possible. Link in bio." }
    ]
  },
  {
    "id": "champion-dominance-index",
    "label": "Deep Dive: How dominant were the 2026 champions? (20-yr data)",
    "caption": "THE LEAST DOMINANT CHAMPION EVER? We ranked all 20 CrossFit Games champions by their average event finish, 2007 to 2026, straight from our own database - and the 2026 result reframes the whole thing.\n\nTHE METHOD: a champion's average finish across every event they contested. Win everything and you approach 1.0. The lower the number, the more total dominance.\n\nTHE SURPRISE: James Sprague won the biggest Games in history (20 events) with an average finish of 7.65 - which ranks 17th of the 20 title runs on record. One of the LEAST dominant championships ever. That is not a knock, it is the story: he never won an event until the 17th, never posted a monster streak, and simply refused to have a bad enough day. Consistency beat peaks.\n\nTHE CONTRAST: Aimee Cringle averaged 5.50 (10th of 20) - she won on peaks (5 event wins), Sprague on consistency (2 wins). Opposite blueprints, same crown.\n\nTHE BIGGER PICTURE: the top of the list belongs to two dynasties, Mat Fraser (an absurd 1.68 average in 2020) and Tia-Clair Toomey (routinely near 2.5). No 2026 champion is close. Part of that is format - 20 events and a deeper field make a low average far harder to hold - but part of it looks real: the sport may have entered a more open era, where titles go to the most consistent, not the most untouchable.\n\nThis is the analysis only a 20-year database can do. Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Deep Dive - The Data", "headline": "THE LEAST\nDOMINANT CHAMP?", "sub": "We ranked all 20 CrossFit Games champions by average finish. Where the 2026 winners land will surprise you. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Method", "headline": "ONE NUMBER,\nTWENTY YEARS", "body": "A simple, honest metric: a champion's average finish across every event they contested. Win everything and you approach 1.0 - the lower the number, the more total dominance. We ran it for all 20 Fittest Man and Fittest Woman champions, 2007 to 2026, straight from our Games database. The results reframe what 2026 actually was.", "source": "Persistence Athletics Games Almanac, 2007-2026" },
      { "type": "movement", "kicker": "Most Dominant Men, All-Time", "headline": "THE DOMINANCE\nLADDER", "rows": [ { "rank": 1, "name": "Mat Fraser, 2020", "pts": 1.68, "delta": null }, { "rank": 2, "name": "Mat Fraser, 2017", "pts": 4.08, "delta": null }, { "rank": 3, "name": "Mat Fraser, 2018", "pts": 4.50, "delta": null }, { "rank": 4, "name": "James Fitzgerald, 2007", "pts": 5.00, "delta": null }, { "rank": 17, "name": "James Sprague, 2026", "pts": 7.65, "delta": null } ], "note": "Lower average = more dominant. Fraser's 2020 (1.68) is untouchable. Sprague's 2026 average of 7.65 ranks 17th of 20 title runs." },
      { "type": "point", "num": 2, "kicker": "The Surprise", "headline": "YOUR CHAMPION,\n17TH OF 20", "body": "James Sprague won the biggest Games in history, 20 events, with an average finish of 7.65 - one of the least dominant title runs on record, 17th of 20. That is not a knock. It is the story. He never won an event until the seventeenth, never posted a monster streak, and simply refused to have a bad enough day. In a 20-event Games, consistency beat peaks. Unshakable, by the numbers.", "source": "Official 2026 leaderboard + Games Almanac" },
      { "type": "stat", "kicker": "Two Ways to Win", "headline": "PEAKS vs\nCONSISTENCY", "stats": [ { "big": "7.65", "label": "Sprague's avg finish - 2 event wins, won on consistency" }, { "big": "5.50", "label": "Cringle's avg finish - 5 event wins, won on peaks" }, { "big": "17th", "label": "Sprague's dominance rank, of 20 champions" }, { "big": "10th", "label": "Cringle's dominance rank, of 20 champions" } ], "footnote": "Opposite blueprints, same result: two champions, neither historically dominant, both fully deserving." },
      { "type": "point", "num": 3, "kicker": "The Bigger Picture", "headline": "IS THE ERA OF\nDOMINANCE OVER?", "body": "The top of this list belongs to two dynasties: Mat Fraser and Tia-Clair Toomey, whose title runs (Fraser at 1.68 in 2020, Toomey routinely near 2.5) sit in another league. No 2026 champion comes close. Part of that is format - 20 events and a deeper field make a low average far harder to hold. But part of it looks real: the sport may have entered a more open era, where titles are won by the most consistent, not the most untouchable.", "source": "Persistence Athletics Games Almanac" },
      { "type": "cta", "headline": "20 YEARS OF DATA,\nONE ALMANAC", "body": "Every champion, every event, every number back to 2007 is on the site - the analysis only a two-decade database can do. Link in bio." }
    ]
  },
  {
    "id": "benchmark-fran-decoded",
    "label": "Benchmark Decoded: FRAN (+ scale it)",
    "caption": "FRAN, DECODED. The most famous workout in CrossFit - 21-15-9, for time - and how to do it right at any level.\n\nTHE WORKOUT: 21, then 15, then 9 reps of thrusters (95 lb men / 65 lb women) and pull-ups, for time. That is it. It has appeared on the crossfit.com main site 67 times since 2003, which is why it is THE yardstick - everyone has a Fran time and everyone remembers it.\n\nWHY IT BURNS: the thruster is a full-body movement (a front squat straight into an overhead press), so it hits legs, shoulders and lungs at once. Add pull-ups and your grip is in it too. The descending reps trick you into going out too hot on the 21, and the redline comes fast. Short, but nowhere to hide.\n\nSCALE IT, KEEP THE SPRINT: RX 95/65 + pull-ups. INTERMEDIATE 65/45 + banded or jumping pull-ups. BEGINNER light dumbbell thrusters + ring rows. Pick loads you can keep moving on and aim to finish under 8 minutes.\n\nAnd write your time down. Fran is a measuring stick - run it again in a few months and see, in one number, whether your training is working. We break down and scale the daily CrossFit workout the same way, every day, at wod.persistenceathletics.com. Link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Benchmark Decoded", "headline": "FRAN", "sub": "The most famous workout in CrossFit - 21-15-9, for time. How to do it right, at any level. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Rx", "headline": "21-15-9,\nFOR TIME", "body": "Fran is CrossFit's most iconic benchmark: 21, then 15, then 9 reps of two movements, done for time. Thrusters at 95 lb for men, 65 for women, and pull-ups. That is the whole workout. It has appeared on the crossfit.com main site 67 times since 2003, which is exactly why it is the yardstick - everyone has a Fran time, and everyone remembers it.", "source": "Persistence Athletics WOD database (67 appearances, 2003-2025)" },
      { "type": "stat", "kicker": "By the Numbers", "headline": "THE\nYARDSTICK", "stats": [ { "big": "45", "label": "reps of each movement (21 + 15 + 9)" }, { "big": "2", "label": "movements: thrusters and pull-ups" }, { "big": "67", "label": "times programmed on crossfit.com since 2003" }, { "big": "~2:00", "label": "a world-class Rx Fran time" } ], "footnote": "A sprint benchmark: short, brutal, and repeatable - the whole point is to test it again in a few months." },
      { "type": "point", "num": 2, "kicker": "What It Tests", "headline": "A LUNG-AND-\nGRIP SPRINT", "body": "Fran looks tiny on paper and wrecks people anyway. The thruster is a full-body movement - a front squat straight into an overhead press - so it taxes your legs, shoulders, and lungs all at once. Stack pull-ups on top and your grip and back are in it too. The descending reps trick you into going out too hot on the 21, and the redline arrives fast. It is short, but there is nowhere to hide.", "source": "Persistence Athletics coaching" },
      { "type": "point", "num": 3, "kicker": "For Your Gym", "headline": "SCALE IT,\nKEEP THE SPRINT", "body": "The stimulus is an all-out sprint you finish in a few minutes - keep that. RX: 95/65 lb thrusters, pull-ups. INTERMEDIATE: 65/45 lb thrusters, banded or jumping pull-ups. BEGINNER: light dumbbell or empty-barbell thrusters, ring rows. Whatever you pick, choose loads and a pull-up variation you can keep moving on - if a round takes more than a couple of big breaks, scale down. Aim to finish under 8 minutes.", "source": "Persistence Athletics coaching" },
      { "type": "point", "num": 4, "kicker": "The Strategy", "headline": "GO OUT SMART,\nNOT SLOW", "body": "The trap is the round of 21. Break it before you fail - try 11 and 10, or three quick sets - so your grip survives to the pull-ups. The 15 is where the race is won: hold your split. Then empty the tank on the 9. And here is the real value of a benchmark: write your time down. Fran is a measuring stick, so you can run it again in a few months and see, in one number, whether your training is working.", "source": "Persistence Athletics coaching" },
      { "type": "cta", "headline": "WHAT'S YOUR\nFRAN TIME?", "body": "We break down and scale the daily CrossFit workout the same way, every day - modality, time domain, and how to do it at your level. Find today's at wod.persistenceathletics.com. Link in bio." }
    ]
  },
  {
    "id": "2026-games-one-week-later",
    "label": "One Week Later: 5 Lessons from the 2026 Games (week wrap)",
    "caption": "ONE WEEK LATER. The 2026 CrossFit Games are in the books. Here are five lessons that stuck - and where the training goes from here.\n\n1. COMPLETE BEATS SPECIALIZED. Twenty-three different athletes won an event across the twenty tests. No specialist could hide, no all-rounder could coast. Being well-rounded beats being great at one thing.\n\n2. CONSISTENCY IS A WEAPON. James Sprague led from Event 7 to the finish without winning a single event until Event 17. He won by never having a bad enough day, not by peaking.\n\n3. RANGE IS ROYALTY. Aimee Cringle won a 40-minute trail run, a max deadlift, and a 500-meter sprint in the same week. The Fittest Woman on Earth refused to pick a lane.\n\n4. THE NEXT WAVE IS HERE. A rookie won an event (Hannah Black, the Speed Snatch). The class of 2026 announced itself.\n\n5. FITNESS IS A DAILY PRACTICE. The Games are the loudest weekend in the sport, but that fitness was built on ten thousand ordinary days. Where you go next is not the next competition - it is tomorrow's workout.\n\nWe are shifting from Games coverage to the daily work: every day's CrossFit workout, broken down and scaled, through the same lens we used all week. Start at wod.persistenceathletics.com. Link in bio.",
    "slides": [
      { "type": "cover", "kicker": "The Week Wrap", "headline": "ONE WEEK\nLATER", "sub": "The 2026 Games are in the books. Five lessons that stuck - and where the training goes from here. Swipe." },
      { "type": "stat", "kicker": "The Games in Numbers", "headline": "TWENTY EVENTS,\nTWO CHAMPIONS", "stats": [ { "big": "20", "label": "events - the biggest CrossFit Games ever" }, { "big": "23", "label": "different athletes won at least one event" }, { "big": "+136", "label": "Aimee Cringle's winning margin" }, { "big": "+27", "label": "James Sprague's winning margin" } ], "footnote": "Sprague (1318) and Cringle (1394), your 2026 Fittest on Earth, both out of Brute Strength." },
      { "type": "point", "num": 1, "kicker": "Lesson 1", "headline": "COMPLETE BEATS\nSPECIALIZED", "body": "Twenty-three different athletes won an event across the twenty tests. No specialist could hide, and no all-rounder could coast. The whole design of a Games is to reward the athlete with the fewest weaknesses, and it did. If there is one thing to take from the fittest people on earth, it is that being well-rounded beats being great at one thing.", "source": "Official 2026 CrossFit Games leaderboard" },
      { "type": "point", "num": 2, "kicker": "Lesson 2", "headline": "CONSISTENCY IS\nA WEAPON", "body": "James Sprague led the Games from Event 7 to the finish and did not win a single event until Event 17. He won by never having a bad enough day, not by peaking. You do not need to be the best at everything on any given day. You need to keep showing up without a disaster. That is how a second title, and most real progress, actually gets built.", "source": "2026 CrossFit Games, men's final" },
      { "type": "point", "num": 3, "kicker": "Lesson 3", "headline": "RANGE IS\nROYALTY", "body": "Aimee Cringle won a 40-minute trail run, a max deadlift, and a 500-meter sprint in the same week. Endurance, raw strength, and top-end speed are supposed to be trade-offs. The Fittest Woman on Earth refused to pick. The lesson for the rest of us: do not let a strength become an excuse to ignore a weakness. Train the whole range.", "source": "2026 CrossFit Games, women's final" },
      { "type": "point", "num": 4, "kicker": "The Real Lesson", "headline": "FITNESS IS A\nDAILY PRACTICE", "body": "The Games are the loudest weekend in the sport, but the fitness on that floor was built on ten thousand quiet ordinary days. A rookie won an event this year; the champions have trained for a decade. Where you go from here is not the next competition, it is tomorrow's workout, and the one after that. That is the part we can all do.", "source": "Persistence Athletics" },
      { "type": "cta", "headline": "SEE YOU\nTOMORROW", "body": "We are shifting from Games coverage to the daily work: every day's CrossFit workout, broken down and scaled, through the same lens we used all week. Start at wod.persistenceathletics.com. Link in bio." }
    ]
  },
  {
    "id": "train-like-the-games",
    "label": "Train Like the Games This Week (the pivot to daily)",
    "caption": "TRAIN LIKE THE GAMES THIS WEEK. The Games are over. The way they taught you to think about fitness is not.\n\nThe whole point of a 20-event Games is to reward the athlete with no weakness - work capacity across broad time and modal domains. You do not need San Jose to train that way. The secret is not more intensity, it is coverage: hitting every domain across your week instead of hammering the three things you are already good at.\n\nBuild your week the way the Games tested the field. An ENGINE day like the Ranch 7200 trail run. A STRENGTH day like the CrossFit Total. A SKILL day like the rings. A SPRINT day like the 500m. A CHIPPER day like the Triple Pig. Five days, five domains, zero holes. Scale the load, keep the movement, protect the stimulus - a workout you can finish at the right intensity beats an Rx you survive at half speed.\n\nAnd you do not have to program it alone. Every day, the daily WOD engine at wod.persistenceathletics.com pulls the official CrossFit workout and grades it the way we graded all 20 Games events: modality, time domain, and the ten skills it trains - so your week actually covers the domains. 6,800+ workouts, 25 years, free, updated daily. The same lens as the Games, on your Tuesday. Link in bio.",
    "slides": [
      { "type": "cover", "kicker": "The Bridge", "headline": "TRAIN LIKE\nTHE GAMES", "sub": "The Games are over. The way they taught you to think about fitness is not. Here's your week, and where it lives. Swipe." },
      { "type": "point", "num": 1, "kicker": "Why the Games Work", "headline": "NO HOLES,\nNO HIDING", "body": "The whole point of a 20-event Games is to reward the athlete with no weakness - work capacity across broad time and modal domains. You do not need San Jose to train that way. The secret is not more intensity, it is coverage: hitting every domain across your week instead of hammering the three things you are already good at. Train for no holes.", "source": "CrossFit, 'What Is Fitness?' (Greg Glassman, 2002)" },
      { "type": "point", "num": 2, "kicker": "Train Every Domain", "headline": "ONE WEEK,\nEVERY DOMAIN", "body": "Build your week the way the Games tested the field. AN ENGINE DAY like the Ranch 7200 trail run: 30 to 40 minutes of steady run, row or bike. A STRENGTH DAY like the CrossFit Total: work up to a heavy squat, press or deadlift. A SKILL DAY like the rings: drill one gymnastics movement while you are fresh. A SPRINT DAY like the 500m: short, all-out intervals. A CHIPPER DAY like the Triple Pig: one longer mixed grind. Five days, five domains, zero holes.", "source": "2026 CrossFit Games event structure" },
      { "type": "point", "num": 3, "kicker": "The Only Rule", "headline": "STIMULUS OVER\nPRESCRIPTION", "body": "You do not have to do it as written to get the benefit. The engine day should leave you breathing hard, not broken. The strength day should be heavy for you. Scale the load, keep the movement pattern, protect the stimulus. A workout you can actually finish at the right intensity beats an Rx you survive at half speed. Every session, your level.", "source": "Persistence Athletics coaching" },
      { "type": "stat", "kicker": "Where It Lives", "headline": "25 YEARS OF\nPROGRAMMING", "stats": [ { "big": "6,800+", "label": "CrossFit workouts of the day, analyzed" }, { "big": "25", "label": "years of programming, 2001 to now" }, { "big": "80", "label": "movements tracked and classified" }, { "big": "10", "label": "physical skills every workout is scored against" } ], "footnote": "The daily WOD engine at wod.persistenceathletics.com - free, and updated every day." },
      { "type": "point", "num": 4, "kicker": "The Games-Grade Lens", "headline": "KNOW WHAT\nYOU'RE TRAINING", "body": "Every day, the site pulls the official CrossFit workout and grades it the way we graded all 20 Games events: modality, time domain, and the ten skills it trains. It shows what today's session develops, finds similar past workouts, and flags what your training has been missing - so your week actually covers the domains instead of drifting to your favorites. The same lens as the Games, on your Tuesday.", "source": "wod.persistenceathletics.com daily WOD Intelligence" },
      { "type": "cta", "headline": "START\nTODAY", "body": "Today's workout is already classified and ready at wod.persistenceathletics.com. Train like the Games - every day. Link in bio." }
    ]
  },
  {
    "id": "fibonacci-final-scale-it",
    "label": "The Fibonacci Final: the WOD that crowned a champion (+ scale it)",
    "caption": "THE FIBONACCI FINAL - the workout that closed the 2026 CrossFit Games, and how to scale it for your gym.\n\nThe last event of the season was a rerun of the 2018 Fibonacci, the third in Games history. Ascending rounds of 5, 8, then 13 reps of deficit handstand push-ups (14/8 inch deficit) and double-kettlebell deadlifts (203/124 lb), then one 89-foot double-kettlebell overhead walking lunge (53/35 lb). Ten-minute cap. Simple to read, brutal to do.\n\nGuilherme Malheiros won it in 5:16.70 (his third event win of the Games) over Jay Crouch and Ricky Garard; Olivia Kerstetter took the women in 3:46.67, her second win of the day.\n\nWHY IT HURTS: deficit handstand push-ups tax the shoulders, 203 lb double-kettlebell deadlifts shred grip and the posterior chain, and the overhead lunge asks you to hold heavy bells locked out while your midline is already cooked - with the biggest set, 13 and 13, landing last.\n\nHOW TO SCALE IT: keep the stimulus (short, heavy, gymnastics under fatigue), lower the barrier. Full scaling notes are in the carousel. This is exactly the kind of test we classify and scale every day at wod.persistenceathletics.com. Program your week like the Games - link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Re-Run Series", "headline": "THE FIBONACCI\nFINAL", "sub": "The workout that decided the 2026 Games - and how to scale it for your gym. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Workout", "headline": "5, 8, 13,\nFOR TIME", "body": "The last event of the 2026 Games, a rerun of the 2018 Fibonacci and the third in Games history. Ascending rounds of 5, 8, then 13 reps of two movements: deficit handstand push-ups (14/8 inch deficit) and double-kettlebell deadlifts (203/124 lb). Then, to finish, one 89-foot double-kettlebell overhead walking lunge (53/35 lb). Ten-minute cap. Simple to read, brutal to do.", "source": "Official 2026 CrossFit Games, Event 20" },
      { "type": "stat", "kicker": "How Fast Is Fast", "headline": "THE WINNING\nTIMES", "stats": [ { "big": "5:16", "label": "Guilherme Malheiros - his 3rd event win of the Games" }, { "big": "3:46", "label": "Olivia Kerstetter - her 2nd win of the day" }, { "big": "26", "label": "total reps of each movement (5 + 8 + 13)" }, { "big": "10", "label": "minute cap - the season's final buzzer" } ], "footnote": "Malheiros over Crouch (5:23.94) and Garard (5:48.21); Kerstetter over Rodgers (4:07.29) and Brandon (4:17.76)." },
      { "type": "point", "num": 2, "kicker": "The Breakdown", "headline": "WHERE IT\nBREAKS YOU", "body": "Three demands, stacked. The deficit handstand push-ups force full range under fatigue and tax the shoulders. The double-kettlebell deadlifts at 203 lb shred grip and the posterior chain. Then the overhead lunge asks you to hold heavy bells locked out while your midline and balance are already gone. And the Fibonacci scheme is cruel by design: the biggest round, 13 and 13, lands last, when you have the least left.", "source": "Event composition, 2026 CrossFit Games" },
      { "type": "point", "num": 3, "kicker": "For Your Gym", "headline": "SCALE IT,\nKEEP THE STING", "body": "The stimulus is short, heavy, and gymnastics-under-fatigue. Keep that, lower the barrier. RX: as written. INTERMEDIATE: handstand push-ups off the floor (no deficit), double-kettlebell deadlifts around 2x53 lb, overhead lunge at 35 lb. BEGINNER: pike or box push-ups, moderate dumbbell deadlifts, front-rack lunge with light dumbbells, and cut the reps to 3-5-8. Twelve-minute cap. Same shape, same lungs, your level.", "source": "Persistence Athletics coaching" },
      { "type": "point", "num": 4, "kicker": "The Takeaway", "headline": "STEAL THE\nTEMPLATE", "body": "You do not need a Games stage to use this. An ascending couplet of a gymnastics push and a heavy hinge, capped by a loaded carry, is a template you can run any week: short, high skill, high grip, finished in under twelve minutes. It is exactly the kind of test we classify and scale every day on the site, by modality, time domain, and the skills it trains, so you always know what a workout is really asking of you.", "source": "wod.persistenceathletics.com daily WOD Intelligence" },
      { "type": "cta", "headline": "TRAIN IT\nTHIS WEEK", "body": "Full scaling notes and the lens we grade every workout through are on the site. Program your week like the Games - link in bio." }
    ]
  },
  {
    "id": "sprague-the-unshakable",
    "label": "James Sprague: The Unshakable (deep-dive)",
    "caption": "JAMES SPRAGUE: THE UNSHAKABLE. How the quietest dominance in the sport won a second CrossFit Games title.\n\nSprague took the overall lead on Event 7 and never gave it back - and here is the remarkable part: he did it without winning anything. Through the first sixteen events he did not take a single event win, yet he led the standings for most of them. His weapon was not a peak, it was a floor: a 7.7 average finish across 20 events, ten top-five results, and a worst day of 26th on the shoulder press. In a sport built to find your weakness, he simply never had a bad enough day.\n\nThen, when Dallin Pepper closed the gap late, Sprague struck: he won the Jump Pull Yoke (Event 17, 3:20.65) and the Machine 7200 (Event 18, 24:22.46) back to back - his only two event wins of the Games, delivered at the exact moment the title was on the line. Final margin: 27 points, 1318 to 1291.\n\nAnd it made history. Sprague won in 2024, finished 3rd in 2025, and won again in 2026 - the first man ever to win the title in non-consecutive years. Every other repeat men's champion stacked his titles back to back. Sprague lost the crown and took it back. Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "2026 Fittest Man on Earth", "headline": "JAMES SPRAGUE\nTHE UNSHAKABLE", "sub": "He led the Games from Event 7 to the finish and did not win a single event until Event 17. The quietest dominance in the sport. Swipe." },
      { "type": "stat", "kicker": "The Scoreline", "headline": "WON WITHOUT\nWINNING", "stats": [ { "big": "1318", "label": "total points - Fittest Man on Earth" }, { "big": "+27", "label": "final margin over Dallin Pepper (1291)" }, { "big": "2", "label": "event wins - both in the final four events" }, { "big": "13", "label": "of 20 events spent in first place overall" } ], "footnote": "He led the overall standings from Event 7 all the way to the title." },
      { "type": "point", "num": 1, "kicker": "The Long Lead", "headline": "IN FRONT FROM\nEVENT SEVEN", "body": "Sprague took the overall lead on Event 7 and never gave it back. What makes that remarkable: he did it without winning anything. Through the first sixteen events of the Games he did not take a single event win, yet he sat in first place for most of them. He was not the flashiest athlete on the floor. He was the one who would not go away.", "source": "Official 2026 leaderboard, standing after each event" },
      { "type": "point", "num": 2, "kicker": "The Consistency Machine", "headline": "NO BAD\nENOUGH DAY", "body": "His weapon was not a peak, it was a floor. Across 20 events Sprague averaged a 7.7 finish with ten top-five results, and his worst day was a 26th on the shoulder press. In a sport designed to find and punish your weakness, he simply never had a day disastrous enough to lose the lead. That is what unshakable looks like on a scoreboard.", "source": "Official 2026 leaderboard, all 20 events" },
      { "type": "point", "num": 3, "kicker": "Then He Struck", "headline": "TWICE, WHEN IT\nMATTERED MOST", "body": "When Pepper closed the gap late, Sprague finally answered. He won the Jump Pull Yoke (Event 17) in 3:20.65, then backed it up by winning the Machine 7200 (Event 18) in 24:22.46 - his only two event wins of the entire Games, delivered back to back at the exact moment the title was on the line. The leader who never needed to win picked the perfect two events to do it.", "source": "Official 2026 leaderboard, Events 17 and 18" },
      { "type": "point", "num": 4, "kicker": "First of Its Kind", "headline": "A TITLE NO MAN\nHAD WON THIS WAY", "body": "Sprague won the CrossFit Games in 2024, finished third in 2025, and won again in 2026 - making him the first man ever to win the title in non-consecutive years. Every other repeat men's champion, from Froning to Fraser to Medeiros, stacked his titles back to back. Sprague lost the crown and took it back, which no man before him had ever done.", "source": "CrossFit Games champions, 2007-2026" },
      { "type": "cta", "headline": "TWO TITLES,\nTWO YEARS APART", "body": "The full story of Sprague's championship - every event, the whole arc - is on the site, alongside the complete Games almanac. Link in bio." }
    ]
  },
  {
    "id": "rookie-class-2026",
    "label": "The Rookie Class of 2026 (mini)",
    "caption": "THE ROOKIE CLASS OF 2026. First Games, biggest stage - and one of them beat the whole world at her best event.\n\nHannah Black, a first-year athlete, won the Speed Snatch (Event 15) outright - a rookie standing on top of the deepest field in the sport at her specialty. Her overall week ended 29th, but for one event she was the best snatcher on the planet.\n\nThe rest of the class served notice too. Dylan Hamming led all rookies in 12th overall. On the women's side the first-timers packed in tight: Holly Tynan finished 17th, with Bergros Bjornsdottir (flagged on the broadcast as the youngest athlete in the field) and Aline Wirz right behind in 18th and 19th, level on 647 points - four points covered the top three rookie women.\n\nThe class of 2026 did not just show up. Remember the names. Full profiles at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "The Class of 2026", "headline": "THE ROOKIES\nARRIVED", "sub": "First Games, biggest stage - and one of them beat the whole world at her best event. Swipe." },
      { "type": "stat", "kicker": "First-Timers, By the Numbers", "headline": "THE ROOKIE\nCLASS", "stats": [ { "big": "12th", "label": "Dylan Hamming - the top rookie finish of the Games" }, { "big": "17th", "label": "Holly Tynan - the highest-finishing rookie woman" }, { "big": "1", "label": "rookie event win - Hannah Black took the Speed Snatch" }, { "big": "4", "label": "points covering the top three rookie women" } ], "footnote": "Rookie = first CrossFit Games appearance, verified against our almanac." },
      { "type": "point", "num": 1, "kicker": "A Rookie Beat the World", "headline": "HANNAH BLACK\nWON AN EVENT", "body": "On the Speed Snatch (Event 15), first-year athlete Hannah Black went out and won it outright - a rookie standing on top of the deepest field in the sport at her specialty. Her overall week was a rollercoaster that ended 29th, but for one event she was the best snatcher on the planet. That is the kind of moment that launches a career.", "source": "Official 2026 leaderboard, Event 15" },
      { "type": "point", "num": 2, "kicker": "Remember the Names", "headline": "THE NEXT\nDECADE", "body": "Dylan Hamming led all rookies in 12th overall. On the women's side the first-timers packed in tight: Holly Tynan finished 17th, with Bergros Bjornsdottir (flagged on the broadcast as the youngest athlete in the field) and Aline Wirz right behind in 18th and 19th, level on 647 points. Four points covered the top three rookie women. The class of 2026 did not just show up. It served notice.", "source": "Official 2026 leaderboard, final standings" },
      { "type": "cta", "headline": "THE CLASS\nOF 2026", "body": "Every rookie's profile and full Games record is on the site. Link in bio." }
    ]
  },
  {
    "id": "pat-vellner-the-decade",
    "label": "Pat Vellner: The Decade (10-year feature)",
    "caption": "PAT VELLNER: THE DECADE. Ten CrossFit Games. Five podiums. Ten event wins. One title that got away.\n\nPatrick Vellner is the most decorated man never to win the CrossFit Games. The 36-year-old chiropractor from Red Deer, Alberta stood on the podium five times across his career - runner-up in 2018, 2021 and 2023, third in 2016 and 2017 - and finished top-five in six of his ten Games. Always in the mix, always dangerous, never first.\n\nHis 2026 return was almost too poetic to be real. In his 10th Games, Vellner won the Triple Pig chipper (10:31.58) - the 10th event win of his career. Ten wins in ten Games. He also took the CrossFit Total deadlift at 605 lb. But the week was boom-or-bust: two wins alongside six finishes outside the top 20, and a 17th-place overall. The peaks were still there; the every-day consistency that built five podiums was not.\n\nNow in what he has called his final season, Vellner leaves a ledger almost no one matches: ten Games, ten event wins, five podiums, no title. The best never to win it - and in his case, that is not a footnote. It is the legacy.\n\nThe full timeline is on the site. Link in bio.",
    "slides": [
      { "type": "cover", "kicker": "10 Years at the CrossFit Games", "headline": "PAT VELLNER\nTHE DECADE", "sub": "Ten Games. Five podiums. Ten event wins. One title that got away. Swipe." },
      { "type": "stat", "kicker": "A Career in Four Numbers", "headline": "THE LEDGER", "stats": [ { "big": "10", "label": "CrossFit Games appearances (2016-2026)" }, { "big": "5", "label": "Games podiums - but never the title" }, { "big": "10", "label": "individual event wins" }, { "big": "3", "label": "runner-up finishes (2018, 2021, 2023)" } ], "footnote": "The most decorated man never to win the CrossFit Games." },
      { "type": "point", "num": 1, "kicker": "The Nearly Man", "headline": "ALWAYS CLOSE,\nNEVER FIRST", "body": "Patrick Vellner is the most decorated man never to win the CrossFit Games. Across a decade he stood on the podium five times - runner-up in 2018, 2021 and 2023, third in 2016 and 2017 - always a step from the crown. The chiropractor from Red Deer, Alberta built his reputation as the sport's ultimate all-rounder: no obvious weakness, dangerous everywhere, impossible to count out.", "source": "Persistence Athletics Games Almanac" },
      { "type": "point", "num": 2, "kicker": "Ten Years, Every Finish", "headline": "A DECADE\nNEAR THE TOP", "body": "His overall finishes: 3rd (2016), 3rd (2017), 2nd (2018), 16th (2019), 9th (2020), 2nd (2021), 6th (2022), 2nd (2023), 5th (2024). He sat out 2025, then returned in 2026 for a tenth Games. Six top-five finishes in ten appearances - a decade spent living in the sport's top tier.", "source": "Official CrossFit Games leaderboards, 2016-2026" },
      { "type": "stat", "kicker": "The 2026 Return - His 10th Games", "headline": "TOO NEAT\nFOR FICTION", "stats": [ { "big": "10th", "label": "career event win - the Triple Pig, in his 10th Games" }, { "big": "605", "label": "lb - won the CrossFit Total's deadlift at 36" }, { "big": "2", "label": "event wins in 2026 (deadlift + Triple Pig)" }, { "big": "17th", "label": "overall - the boom-or-bust veteran line" } ], "footnote": "Ten event wins, in ten Games appearances. You could not script it cleaner." },
      { "type": "point", "num": 3, "kicker": "The 10th Win in the 10th Games", "headline": "THE PEAKS AND\nTHE PRICE", "body": "In his tenth Games, Vellner won the Triple Pig chipper in 10:31.58 - the tenth event win of his career, and he took the deadlift at 605 lb too. But 2026 was boom or bust: two wins alongside six finishes of 20th or worse, including a 30th on the swim, and a 17th-place overall. Still able to win a single event against the deepest field on earth; no longer able to stitch twenty tests together the way a title demands.", "source": "Official 2026 CrossFit Games leaderboard" },
      { "type": "point", "num": 4, "kicker": "The Final Season", "headline": "WHAT HE\nLEAVES BEHIND", "body": "Now 36 and in what he has publicly called his final season, Vellner qualified for 2026 through the online Semifinal (7th) for one more run at the title that eluded him. Somebody will eventually break a record for wins or podiums or years in the field. Far harder to match is the shape of his career: there, and dangerous, and genuinely beloved, from his rookie podium in 2016 to his tenth Games in 2026 - and one of the very best to ever do it without a crown.", "source": "Patrick Vellner, on his final season" },
      { "type": "cta", "headline": "A DECADE\nAT THE TOP", "body": "The full Vellner timeline - every Games, every event win, every near-miss - is on the site. Link in bio." }
    ]
  },
  {
    "id": "the-fitness-lens",
    "label": "The Fitness Lens (methodology + daily bridge)",
    "caption": "THE FITNESS LENS - the exact framework behind every number we posted from the 2026 Games, and behind the workout you'll train today.\n\nCrossFit's definition of fitness is one sentence: work capacity across broad time and modal domains. In plain English - can you do a lot of work, across many kinds of tasks, over many durations? The best athlete is the one with the fewest holes.\n\nThat definition has two axes. MODAL DOMAINS: monostructural (cardio), gymnastics (bodyweight), weightlifting (external load) - the 2026 Games ran 9 mixed events, 5 pure barbell, 4 pure engine, 2 pure gymnastics. TIME DOMAINS: from a sub-2-minute sprint to a 40-minute trail run, every band deliberately tested. Under it all sit ten general physical skills, from strength and stamina to coordination and accuracy, and a 20-event Games is built to demand all ten. That is why 23 different athletes won events and no specialist could hide.\n\nHere is the part most people miss: this is not just a Games tool. We run this exact lens over 6,800+ daily CrossFit workouts on the site, classifying each one by modality, time domain and the skills it trains. The Games is the lens at its loudest. Your daily WOD is the lens at work.\n\nSee today's workout graded the same way at wod.persistenceathletics.com. Link in bio.",
    "slides": [
      { "type": "cover", "kicker": "Methodology", "headline": "THE FITNESS\nLENS", "sub": "The exact framework behind every number we posted this week - and behind the workout you'll train today. Swipe." },
      { "type": "point", "num": 1, "kicker": "The Definition", "headline": "WORK CAPACITY,\nBROADLY", "body": "CrossFit defines fitness in one line: work capacity across broad time and modal domains. Translation - can you do a lot of work, across many kinds of tasks, over many durations? Not 'are you strong' or 'do you have an engine' in isolation. The best athlete is the one with the fewest holes. That single sentence is the lens we grade every Games event and every daily workout through.", "source": "CrossFit, 'What Is Fitness?' (Greg Glassman, 2002)" },
      { "type": "bars", "kicker": "Axis 1 - Modal Domains", "headline": "THREE KINDS\nOF WORK", "bars": [ { "label": "Mixed (M+G+W blends)", "pct": 100, "display": "9 events", "color": "#91C640" }, { "label": "Pure barbell (W)", "pct": 56, "display": "5 events", "color": "#F4C64A" }, { "label": "Pure engine (M)", "pct": 44, "display": "4 events", "color": "#60a5fa" }, { "label": "Pure gymnastics (G)", "pct": 22, "display": "2 events", "color": "#C9D2DA" } ], "footnote": "M = monostructural (cardio), G = gymnastics (bodyweight), W = weightlifting (external load), per the L1 model. The 2026 Games hit all three, alone and in blends." },
      { "type": "bars", "kicker": "Axis 2 - Time Domains", "headline": "SECONDS TO\nFORTY MINUTES", "bars": [ { "label": "Short, 2-16 min", "pct": 100, "display": "6 events", "color": "#91C640" }, { "label": "Sprint, under 2 min", "pct": 67, "display": "4 events", "color": "#F4C64A" }, { "label": "Max effort, no clock", "pct": 67, "display": "4 events", "color": "#CD8B5B" }, { "label": "Medium, 6-20 min", "pct": 67, "display": "4 events", "color": "#60a5fa" }, { "label": "Long, 25-40 min", "pct": 33, "display": "2 events", "color": "#C9D2DA" } ], "footnote": "'Broad time domains' means every band, from a sub-2-minute sprint to a 40-minute trail run. A complete test hits all of them, and so does a complete program over time." },
      { "type": "point", "num": 2, "kicker": "The Ten Skills", "headline": "TEN GENERAL\nPHYSICAL SKILLS", "body": "Under the lens sit ten skills: cardiovascular endurance, stamina, strength, flexibility, power, speed, coordination, agility, balance, and accuracy. A 20-event Games is built to demand all ten, which is why 23 different athletes won events and no specialist could hide. The same rule scales down: a well-built training week should touch every one of them, not just the three you are already good at.", "source": "CrossFit Level 1 Training Guide" },
      { "type": "point", "num": 3, "kicker": "From the Games to Your Tuesday", "headline": "THE SAME LENS,\nEVERY DAY", "body": "This is not just a Games tool. We run this exact framework over 6,800+ daily CrossFit workouts on the site, classifying each one by modality, time domain, and the skills it trains, so you can see what today's workout actually develops and what your training might be missing. The Games is the lens at its loudest. Your daily WOD is the lens at work.", "source": "wod.persistenceathletics.com daily WOD Intelligence" },
      { "type": "cta", "headline": "READ YOUR WORKOUT\nLIKE A PRO", "body": "See today's workout graded through the same lens - modality, time domain, and the ten skills - at wod.persistenceathletics.com. Link in bio." }
    ]
  },
  {
    "id": "cringle-the-fortress",
    "label": "Aimee Cringle: The Fortress (deep-dive)",
    "caption": "AIMEE CRINGLE: THE FORTRESS. How the trailblazer from the Isle of Man built the most complete Games of the year and became the 2026 Fittest Woman on Earth.\n\nTHE SCORELINE: 1,394 points, five event wins, a 136-point final margin over Emma Lawson, and a 5.5 average finish across all 20 events. Eighteen of her twenty results landed in the top ten. This was not a hot streak - it was a fortress.\n\nWHY THERE WAS NO WALL TO ATTACK: her five wins did not cluster in one strength. A 40-minute trail run. A max deadlift. A bike race. A 500m sprint. A heavy chipper she took by 1:47. Endurance, strength, power, speed, mixed - she won in every domain. You cannot game-plan against an athlete with no weakness.\n\nTHE CLIMB: 13th on her 2024 debut, 8th in 2025, champion in 2026. Three Games from the bottom of the top field to the summit.\n\nHer words at the line: 'It doesn't feel real - it's a shock to me. I couldn't do it without these guys.' Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "2026 Fittest Woman on Earth", "headline": "AIMEE CRINGLE\nTHE FORTRESS", "sub": "How the trailblazer from the Isle of Man built an unbreakable Games: five wins, a 136-point margin, wire to wire. Swipe." },
      { "type": "stat", "kicker": "The Scoreline", "headline": "A FORTRESS,\nBY THE NUMBERS", "stats": [ { "big": "1394", "label": "total points - the highest score of the 2026 Games" }, { "big": "5", "label": "event wins - the most of anyone in the field" }, { "big": "+136", "label": "final margin over 2nd (Emma Lawson, 1258)" }, { "big": "5.5", "label": "average finish across all 20 events" } ], "footnote": "Average finish computed from her official placing in every event. Eighteen of the twenty landed in the top ten." },
      { "type": "point", "num": 1, "kicker": "Five Wins, Five Domains", "headline": "SHE WON\nEVERYWHERE", "body": "Cringle's five wins did not cluster in one strength. E2 Ranch 7200, a 40-minute 7.2km trail run (40:42). E5 the CrossFit Total deadlift, pure max strength (425 lb). E6 the grass oval bike race, the engine (19:10). E13 the 500m sprint, top-end speed (1:20.98). E14 the Triple Pig, a heavy chipper she took by 1:47 (10:41.36). Endurance, strength, power, speed, mixed - she won in all five. That is why there was no wall to attack.", "source": "Official 2026 leaderboard, all 20 events" },
      { "type": "point", "num": 2, "kicker": "The Lead Only Grew", "headline": "A CUSHION\nWITH NO CRACK", "body": "Once Cringle took the overall lead on Day 1, the gap only widened: +87 after Friday, +116 into Sunday, +136 at the final buzzer. Look at her back half - after the sprint and the Pig on Saturday, she never needed another big result. Only twice all week did she finish outside the top ten. A leader who cannot be pressured is a fortress, and no one laid a finger on hers.", "source": "Official 2026 leaderboard, standings after each day" },
      { "type": "stat", "kicker": "The Climb", "headline": "THREE GAMES\nTO THE TOP", "stats": [ { "big": "13th", "label": "2024 - her CrossFit Games debut" }, { "big": "8th", "label": "2025 - broke into the top 10" }, { "big": "1st", "label": "2026 - Fittest Woman on Earth" }, { "big": "3", "label": "Games from debut to the summit" } ], "footnote": "A straight-line ascent: 13th, 8th, then the title. Few climbs in the sport have been this clean." },
      { "type": "point", "num": 3, "kicker": "In Her Words", "headline": "'IT DOESN'T\nFEEL REAL'", "body": "At the line, the new queen of CrossFit (the broadcast's words) turned it straight to her corner: 'It doesn't feel real - it's a shock to me. I couldn't do it without these guys.' Her mom Roberta watched from home; her boyfriend Lewis and her coaches were mat-side. The trailblazer from the Isle of Man had just rewritten what her small CrossFit community thought was possible.", "source": "Games broadcast, Event 20 floor interview" },
      { "type": "cta", "headline": "THE FORTRESS,\nIN FULL", "body": "The complete story of Aimee Cringle's championship - every event, the margin math, and the 2026 almanac - is on the site. Link in bio." }
    ]
  },
  {
    "id": "twenty-events-23-champions",
    "label": "20 Events, 23 Champions (the winners wall)",
    "caption": "20 EVENTS. 23 CHAMPIONS. The 2026 CrossFit Games spread its event wins wider than any Games in history - and here they all are, on one wall.\n\nTWELVE different men and ELEVEN different women won at least one of the 20 events. Twenty-three athletes total walked away with a win. No single specialist could dominate, and no all-rounder could coast - which is exactly what a 20-event Games is built to do.\n\nTHE MULTI-WINNERS: Aimee Cringle won FIVE, more than anyone. Colten Mertens took three (the Total's squat and press, plus the fan-voted Hopper). Guilherme Malheiros won three including the Fibonacci finale. Lucy Campbell won three (the swim, the Hopper, the yoke).\n\nAnd your two champions, James Sprague and Aimee Cringle, proved the point: neither won by specializing. Both tested across everything, both finished on top.\n\nEvery event, every winner, one image. Full breakdown at the link in bio.",
    "slides": [
      { "type": "cover", "kicker": "The 2026 CrossFit Games", "headline": "20 EVENTS\n23 CHAMPIONS", "sub": "The widest spread of event winners in Games history - every single one, on one wall. Swipe." },
      { "type": "stat", "kicker": "The Spread", "headline": "TWENTY-THREE\nWINNERS", "stats": [ { "big": "20", "label": "events - the biggest CrossFit Games ever" }, { "big": "12", "label": "different men won at least one event" }, { "big": "11", "label": "different women won at least one event" }, { "big": "23", "label": "total athletes with an event win" } ], "footnote": "Twelve men plus eleven women, all counted separately - 23 distinct athletes took a win across the 20 events." },
      { "type": "point", "num": 1, "kicker": "Every Men's Event Winner", "headline": "THE MEN,\nEVENT BY EVENT", "body": "E1 Crouch, E2 Garard, E3 Mertens, E4 Mertens, E5 Vellner, E6 Fiebig, E7 Jenkins, E8 Khrennikov, E9 Malheiros, E10 Crouch, E11 Hoffer, E12 Mertens, E13 Garard, E14 Vellner, E15 Malheiros, E16 Pepper, E17 Sprague, E18 Sprague, E19 Martin, E20 Malheiros. Twelve different winners - Mertens and Malheiros led with three each.", "source": "Official 2026 leaderboard, all 20 events" },
      { "type": "point", "num": 2, "kicker": "Every Women's Event Winner", "headline": "THE WOMEN,\nEVENT BY EVENT", "body": "E1 Sturt, E2 Cringle, E3 Milligan, E4 Gazan, E5 Cringle, E6 Cringle, E7 Campbell, E8 Gazan, E9 Domit, E10 Lawson, E11 Rodgers, E12 Campbell, E13 Cringle, E14 Cringle, E15 Black, E16 Turner, E17 Campbell, E18 Kerstetter, E19 Rodgers, E20 Kerstetter. Eleven different winners - Cringle alone took five.", "source": "Official 2026 leaderboard, all 20 events" },
      { "type": "stat", "kicker": "The Multi-Winners", "headline": "WHO WON\nMORE THAN ONE", "stats": [ { "big": "5", "label": "Aimee Cringle - most event wins of anyone, en route to the title" }, { "big": "3", "label": "Colten Mertens - the Total's squat & press, plus the fan-voted Hopper" }, { "big": "3", "label": "Guilherme Malheiros - the sandbag, the snatch, and the Fibonacci finale" }, { "big": "3", "label": "Lucy Campbell - the swim, the Hopper, and the yoke" } ], "footnote": "Everyone else with a win took exactly one - the tail of one-time winners is what made the field so deep." },
      { "type": "point", "num": 3, "kicker": "The Whole Point", "headline": "NO SPECIALIST\nCOULD HIDE", "body": "Twenty-three winners across twenty events is the widest spread the Games has ever produced. A max deadlift, a 40-minute trail run, a rings skill test, a bike race and a max-load sandbag throw cannot all be won by the same athlete - and they weren't. That is what testing work capacity across broad time and modal domains looks like, and it is exactly how we read every one of the 6,800 daily workouts on the site.", "source": "Persistence Athletics Games Almanac" },
      { "type": "cta", "headline": "20 EVENTS.\n23 CHAMPIONS.", "body": "Every event, every winner, both full podiums and the complete 2026 almanac are on the site - link in bio." }
    ]
  },
  {
    "id": "games-retrospective-2026",
    "label": "2026 Games: How It Went (the data)",
    "caption": "HOW THE 2026 GAMES WENT - the whole thing, by the data. We ran all 20 events through CrossFit's own programming lens the way we do 6,800 daily WODs, and the verdict is clear: this was the most complete test the sport has ever built.\n\nTHE BREADTH: 20 events touched every modal domain - four pure-engine tests, five pure-barbell, two pure-gymnastics, and nine mixed - and every time domain, from a max deadlift and a single sandbag throw for distance to a 40-minute trail run and a 7,200m machine grind. Work capacity across broad time and modal domains, exactly as the definition demands.\n\nTHE PROOF IT WORKED: 23 different athletes won at least one event - 12 men, 11 women. No single specialist could hide, and no all-rounder could coast. That spread is the whole argument for a 20-event Games.\n\nTHE CHAMPIONS EARNED IT: Cringle five wins and a 136-point margin; Sprague led almost wire to wire and closed with wins in the yoke and the machine. Both tested across everything, both on top.\n\nAND OUR RECEIPTS: our almanac-based picks called the winners of the sprint, the Pig, the snatch, the Echo Thruster and a rings podium before those events ran, and our gap analysis named the exact movements the Fibonacci finale used. A history read, grounded in 20 years of data.\n\nThe most complete Games ever. Full breakdown at the link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "The 2026 Games - The Data",
        "headline": "THE MOST\nCOMPLETE TEST",
        "sub": "20 events through CrossFit's own programming lens. How the biggest Games in history actually went. Swipe."
      },
      {
        "type": "bars",
        "kicker": "Modal Domains - all 20 events",
        "headline": "EVERY DOMAIN,\nTESTED",
        "bars": [
          {
            "label": "Mixed (M+G+W blends)",
            "pct": 100,
            "display": "9 events",
            "color": "#91C640"
          },
          {
            "label": "Pure barbell (W)",
            "pct": 56,
            "display": "5 events",
            "color": "#F4C64A"
          },
          {
            "label": "Pure engine (M)",
            "pct": 44,
            "display": "4 events",
            "color": "#60a5fa"
          },
          {
            "label": "Pure gymnastics (G)",
            "pct": 22,
            "display": "2 events",
            "color": "#C9D2DA"
          }
        ],
        "footnote": "M = monostructural, G = gymnastics, W = weightlifting, per the L1 model. Nine mixed events plus eleven that isolated a single domain - the full spectrum."
      },
      {
        "type": "bars",
        "kicker": "Time Domains - all 20 events",
        "headline": "SECONDS TO\nFORTY MINUTES",
        "bars": [
          {
            "label": "Short, 2-16 min",
            "pct": 100,
            "display": "6 events",
            "color": "#91C640"
          },
          {
            "label": "Sprint, under 2 min",
            "pct": 67,
            "display": "4 events",
            "color": "#F4C64A"
          },
          {
            "label": "Max effort, no clock",
            "pct": 67,
            "display": "4 events",
            "color": "#CD8B5B"
          },
          {
            "label": "Medium, 6-20 min",
            "pct": 67,
            "display": "4 events",
            "color": "#60a5fa"
          },
          {
            "label": "Long, 25-40 min",
            "pct": 33,
            "display": "2 events",
            "color": "#C9D2DA"
          }
        ],
        "footnote": "From a single max sandbag throw and three no-clock max lifts to the 7,200m trail run and the row-ski machine grind. Every band, deliberately."
      },
      {
        "type": "stat",
        "kicker": "The Proof It Worked",
        "headline": "TWENTY-THREE\nWINNERS",
        "stats": [
          {
            "big": "20",
            "label": "events - the biggest CrossFit Games ever by event count, in the sport's 20th year"
          },
          {
            "big": "12",
            "label": "different men won at least one event"
          },
          {
            "big": "11",
            "label": "different women won at least one event"
          },
          {
            "big": "23",
            "label": "total athletes with an event win - no specialist could hide, no all-rounder could coast"
          }
        ],
        "footnote": "That spread across 20 events is the entire argument for testing work capacity across broad time and modal domains."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "The Champions Earned It",
        "headline": "TESTED ACROSS\nEVERYTHING",
        "body": "Aimee Cringle won five events spanning a trail run, a max deadlift, a bike race, a sprint and a Pig chipper - then held top-tier in nearly all the rest for a 136-point margin. James Sprague led from Event 7 without a single win through sixteen tests, then took the yoke and the machine back to back to close it out. Neither won by specializing. Both won by being complete. That is what the 20-event format rewards.",
        "source": "Official leaderboard + Persistence Athletics Games Almanac"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "The Receipts",
        "headline": "WE READ THE\nHISTORY RIGHT",
        "body": "Before the events ran, our almanac-based picks called the winners of the 500m sprint (Garard), the Triple Pig (Vellner), the Speed Snatch (Malheiros) and the Echo Thruster (Pepper), plus a rings podium (Hoffer) - every one posted pre-event. Our gap analysis named handstand push-ups, kettlebells and lunges as the finale's untested movements, and the Fibonacci used exactly those three. Ingredients right, one recipe missed - and we graded it in public. A 20-year database, working.",
        "source": "Persistence Athletics picks boards (posted pre-event) + official results"
      },
      {
        "type": "cta",
        "headline": "THE MOST\nCOMPLETE GAMES.",
        "body": "Every event, both champions, the full modality breakdown and the live-turned-final leaderboard are on the site - and the almanac now holds all 221-plus events of Games history. Link in bio."
      }
    ]
  },
  {
    "id": "champions-2026",
    "label": "2026 Champions Crowned",
    "caption": "THE 2026 CROSSFIT GAMES ARE COMPLETE - and we have two new names atop the sport.\n\nJAMES SPRAGUE, Fittest Man on Earth. His second title, and the FIRST man ever to win in non-consecutive years (2024, then 2026). He led from Event 7 almost wire to wire without winning a single event through sixteen tests - then won the yoke and the machine back to back when it mattered most. Unshakable. Final: 1318, over fellow Brute athlete Dallin Pepper (1291) and Jay Crouch (1228).\n\nAIMEE CRINGLE, Fittest Woman on Earth. Great Britain's first. Five event wins, a fortress of a week, a 136-point final margin - the most dominant first-time champion in years. Her words: \"It doesn't feel real. I couldn't do it without these guys.\" Final: 1394, over Emma Lawson (1258) and Lucy Campbell (1229).\n\nBoth champions train out of Brute Strength - the clean sweep of the crowns our Camp Wars series tracked all week. Twenty events, the biggest test the sport has ever run, and it produced two worthy champions. Full breakdown + every final placing at the link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "The 2026 CrossFit Games",
        "headline": "TWO NEW\nCHAMPIONS",
        "sub": "Twenty events. The biggest test in the sport's history. Meet your 2026 Fittest on Earth. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "Fittest Man on Earth",
        "headline": "JAMES SPRAGUE\n1318",
        "body": "His second title - and the FIRST man ever to win in non-consecutive years (2024, 2026). He led from Event 7 almost wire to wire without an event win through sixteen tests, survived a scoring-revision scare and a 14th on the snatch that shrank his lead, then won the yoke and the machine back to back when it mattered most. The definition of unshakable. He held off fellow Brute athlete Dallin Pepper by 27.",
        "source": "Official final leaderboard, 20 events"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "Fittest Woman on Earth",
        "headline": "AIMEE CRINGLE\n1394",
        "body": "Great Britain's first Fittest Woman on Earth, and one of the most dominant first-time champions the sport has seen: five event wins, a top-tier finish in nearly everything, and a 136-point final margin. Her Triple Pig win by 1:47 was the signature. Her words at the line: 'It doesn't feel real. I couldn't do it without these guys.' Her mom watched from home; her corner was mat-side.",
        "source": "Official final leaderboard, 20 events"
      },
      {
        "type": "movement",
        "kicker": "Final Podium - Men",
        "headline": "THE MEN'S\nPODIUM",
        "rows": [
          {
            "rank": 1,
            "name": "James Sprague",
            "pts": 1318,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Dallin Pepper",
            "pts": 1291,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Jay Crouch",
            "pts": 1228,
            "delta": null
          }
        ],
        "note": "Pepper closed to within 27 on the Fibonacci finale but never caught the jersey. Medeiros 4th (1104), Garard 5th (1100)."
      },
      {
        "type": "movement",
        "kicker": "Final Podium - Women",
        "headline": "THE WOMEN'S\nPODIUM",
        "rows": [
          {
            "rank": 1,
            "name": "Aimee Cringle",
            "pts": 1394,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Emma Lawson",
            "pts": 1258,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Lucy Campbell",
            "pts": 1229,
            "delta": null
          }
        ],
        "note": "Lawson held off Campbell by 29 for the silver after a weekend-long duel. Gazan 4th (1041), Sturt 5th (1026)."
      },
      {
        "type": "stat",
        "kicker": "One Camp, Both Crowns",
        "headline": "THE BRUTE\nSWEEP",
        "stats": [
          {
            "big": "2/2",
            "label": "both champions - Sprague and Cringle - train out of Brute Strength"
          },
          {
            "big": "1st",
            "label": "non-consecutive men's title in history: Sprague 2024 + 2026"
          },
          {
            "big": "5",
            "label": "Cringle's event wins - the most dominant first-time champion in years"
          },
          {
            "big": "136",
            "label": "Cringle's final margin over 2nd - a fortress from wire to wire"
          }
        ],
        "footnote": "Both champions train out of Brute Strength, per the official athlete field - a clean sweep of the crowns."
      },
      {
        "type": "cta",
        "headline": "TWENTY EVENTS.\nTWO CHAMPIONS.",
        "body": "The full season-close breakdown, both champion stories, and the complete Games almanac are on the site - link in bio."
      }
    ]
  },
  {
    "id": "champs-day3",
    "label": "Champions Check-In - Day 3",
    "caption": "CHAMPIONS CHECK-IN, DAY 3 - the day the champions' stories split four ways.\n\nTHE LEADER FINALLY WON: James Sprague (2024 champion) has been winless while sitting atop the board almost continuously since Event 7. Saturday night, with Pepper nine-turned-thirteen points behind him and closing, he won the heaviest test of the week - the 665-lb yoke gauntlet - in 3:20.65. First win of the week, lead out to 29, and per the broadcast, a bid to become the first man ever to win titles in non-consecutive years.\n\nTHE DEFENDER IS CLIMBING: Jayson Hopper (2025 champion) went 3rd on the Echo Thruster and 3rd on the yoke inside one 16-minute window - a double-bronze evening that lifted him to 5th overall.\n\nTHE MACHINE AWAITS: Jeffrey Adler (2023 champion) climbed to 7th - and Sunday opens with a machines-only event. Our almanac note: Adler won the 2025 Run/Row/Run, the most recent machine event in Games history.\n\nTHE HARD DAY: Justin Medeiros (2021, 2022 champion) had the day the title race will remember - a no-rep on his final snatch bar for control overhead. The broadcast's call: 'the door wide open to catch Sprague has all but shut.' He sits 4th at 984, still fighting.\n\nFour champions, all inside the top seven, one day left. Link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Champions Check-In - Day 3",
        "headline": "FOUR CROWNS,\nFOUR STORIES",
        "sub": "One finally won. One is climbing. One waits for his machines. One got the toughest call of the day. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "James Sprague - 2024 Champion",
        "headline": "THE LEADER\nFINALLY WON",
        "body": "Winless through sixteen events while holding the overall lead almost continuously since Event 7 - Pepper borrowed the jersey for exactly one event on Friday. Then Pepper won the Echo Thruster and cut the race to its narrowest - and Sprague answered by winning the heaviest test of the week, the 665-lb yoke gauntlet, in 3:20.65. His first event win of these Games, a 29-point lead with three events left, and per the broadcast, a shot at becoming the first man ever to win titles in non-consecutive years.",
        "source": "Official leaderboard + Games broadcast"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "Hopper + Adler",
        "headline": "THE CLIMBER AND\nTHE MACHINE MAN",
        "body": "Jayson Hopper, the defending champion, went 3rd and 3rd in the two-event night window - a double bronze that moved him to 5th overall at 916. Jeffrey Adler, the 2023 champion, climbed to 7th - and Sunday opens with a machines-only test: row 3,600m, ski 3,600m. Our almanac's note for the morning: Adler won the most recent machine event in Games history, the 2025 Run/Row/Run.",
        "source": "Official leaderboard + Persistence Athletics Games Almanac"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "Justin Medeiros - 2021 + 2022 Champion",
        "headline": "THE HARDEST\nCALL OF THE DAY",
        "body": "The two-time champion's Saturday turned on one bar: he stood up his final snatch attempt but never controlled it overhead, and the judges no-repped it. The broadcast called it straight: 'good call, tough break' - and then, 'the door wide open to catch Sprague has all but shut.' He ended the day 4th at 984. Champions do not get garbage time; every miss is expensive. He has three events to make one cheap.",
        "source": "Games broadcast, Event 15 + official leaderboard"
      },
      {
        "type": "stat",
        "kicker": "The Crown Count",
        "headline": "ALL FOUR,\nTOP SEVEN",
        "stats": [
          {
            "big": "1st",
            "label": "Sprague (2024) - 1114 points, first event win banked, lead 29"
          },
          {
            "big": "4th",
            "label": "Medeiros (2021, 2022) - 984, the no-rep day, still in the fight"
          },
          {
            "big": "5th",
            "label": "Hopper (2025) - 916, after a double-bronze night"
          },
          {
            "big": "7th",
            "label": "Adler (2023) - 832, with his machines waiting Sunday morning"
          }
        ],
        "footnote": "First Games ever with four former men's champions in one field, per the broadcast - and all four are inside the top seven with three events left."
      },
      {
        "type": "cta",
        "headline": "SUNDAY:\nCROWNS COLLIDE",
        "body": "Three events. A 29-point title race. A defending champion climbing and two more crowns hunting the podium. Live cards all day - link in bio."
      }
    ]
  },
  {
    "id": "rookie-day3",
    "label": "Rookie Report - Day 3",
    "caption": "ROOKIE REPORT, DAY 3 - the day a first-year athlete won a CrossFit Games event.\n\nTHE HEADLINE: Hannah Black, 30th overall entering the event, won the Speed Snatch outright - 3 bars in 20.55 seconds, the fastest woman in the field on her favorite test. Her words after, verbatim from the floor: 'I'm a home run hitter and unfortunately for me that comes with a few strikeouts... I'm just really excited that I got to execute on my favorite event so far.'\n\nTHE HEARTBREAK: 19-year-old Bergros Bjornsdottir - the youngest athlete in the field, first Games - led that same snatch final all the way to the last bar, looked over her shoulder mid-rep, and missed 185. Fourth place, and per the broadcast, one glance was the difference. She'll be back.\n\nTHE SPEED: Rachel Noel sprinted to 2nd on the 500m (1:21.31) - 0.33 seconds off the event winner over the full 500 meters. Dylan Hamming ran 4th in the men's sprint (1:14.18) and made the snatch final, finishing 6th there.\n\nThe class of 2026 - all verified first-year athletes in our database - now has an event win to its name. Full report at the link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Rookie Report - Day 3",
        "headline": "A ROOKIE\nWON TODAY",
        "sub": "Hannah Black took the Speed Snatch outright. Bergros led the final to the last bar at 19. Noel sprinted to 2nd. The class of 2026 arrived. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "The Breakthrough",
        "headline": "BLACK WINS\nTHE SNATCH",
        "body": "Hannah Black came into Event 15 sitting 30th overall - and won it outright: three bars in 20.55 seconds, the heaviest listed snatch in the women's field (231 lb per the broadcast) finally getting her stage. Per the broadcast, she is the 10th athlete to take a first career event win at these Games. Her advice to the young lifters watching, verbatim: 'There's no like, cutting corners. Building a strength base takes time... it's hard work over a period of time and you'll get there.'",
        "source": "Official leaderboard + Games broadcast interview"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "The Heartbreak",
        "headline": "ONE GLANCE\nAT NINETEEN",
        "body": "Bergros Bjornsdottir - youngest in the field, first Games, CrossFit Reykjavik - squat-snatched her way into the final and led Hannah Black to the very last bar. Then, in the broadcast's words, she 'looked over... lost focus' mid-rep and missed 185. Fourth on the event. The margin between a teenage Games event win and a lesson was one shoulder check. Remember the name.",
        "source": "Games broadcast, Event 15 final"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "The Speed",
        "headline": "NOEL AND HAMMING\nCAN FLY",
        "body": "Rachel Noel took 2nd in the women's 500m sprint at 1:21.31, 0.33 seconds behind the event winner Cringle - pure footspeed from the same rookie whose pacing IQ led our Friday rookie report. On the men's side, Dylan Hamming ran 4th in the sprint (1:14.18), then made the snatch final and finished 6th there - a two-event speed-and-barbell day most veterans would take.",
        "source": "Official leaderboard, Events 13 and 15"
      },
      {
        "type": "stat",
        "kicker": "The Class Of 2026",
        "headline": "ROOKIES,\nBY THE NUMBERS",
        "stats": [
          {
            "big": "1",
            "label": "event WIN - Hannah Black's Speed Snatch, in 20.55 seconds"
          },
          {
            "big": "2nd",
            "label": "Noel in the 500m sprint - a rookie on a sprint podium"
          },
          {
            "big": "19",
            "label": "Bergros' age - and she led an event final to its last bar"
          },
          {
            "big": "4th + 6th",
            "label": "Hamming's sprint and snatch-final day on the men's side"
          }
        ],
        "footnote": "Rookie statuses verified in our athlete database (first Games appearance, 2026). Placements per official broadcast results graphics and the leaderboard."
      },
      {
        "type": "cta",
        "headline": "ONE DAY\nLEFT TO LEARN",
        "body": "Three events Sunday. The rookies have nothing to defend and everything to take. Full rookie coverage and every profile - link in bio."
      }
    ]
  },
  {
    "id": "day3-records",
    "label": "Day 3 Records + Receipts",
    "caption": "DAY 3 RECORDS AND RECEIPTS - the numbers nobody else pulled.\n\nTHE RECEIPTS: five picks boards posted before Saturday's five events. Five hits. Garard won the sprint (our No. 1, on his 2024 Track and Field win). Vellner won the Pig (No. 1, on his 2021 win at the same weight). Loewen podiumed the Pig (top women's pick, on her 2023 runner-up). Malheiros won the snatch (No. 1, on his 2021 max-snatch title). Pepper won the Echo Thruster (the 2023 Echo champion, receipt printed on the picks board). We don't guess. We check the history.\n\nTHE HONEST GRADE: our Event 20 gap analysis named HSPU, kettlebells and lunges as the biggest untested pieces - the Fibonacci Final is exactly those three. We predicted the wrong combination (clean and jerk + ring muscle-ups). Ingredients right, recipe wrong. We publish both halves.\n\nTHE BOOKS: Cringle's five event wins and a 1,190-point total through 17. Campbell's seventh career win (third of these Games). Vellner's tenth career win in his tenth Games. Sprague's first win of the week on the heaviest test, after leading since Event 7. Hannah Black, the 10th first-time event winner of these Games per the broadcast. And Henrik Haapalainen - who told us himself he is not racing hurt - stood on the yoke podium.\n\nEverything sourced: official board, broadcast, our almanac. Link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Day 3 - Records + Receipts",
        "headline": "RECEIPTS\nDAY",
        "sub": "Five picks boards. Five hits. Plus the record-book lines from the biggest day of the week. Swipe."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "The Receipts",
        "headline": "FIVE FOR\nFIVE",
        "body": "Every pick posted BEFORE the event, every receipt from our own database: Garard won the sprint (No. 1 pick, 2024 Track and Field win). Vellner won the Pig (No. 1, won at this exact weight in 2021). Loewen podiumed the Pig (top women's pick, 2nd at this weight in 2023). Malheiros won the snatch (No. 1, 2021 max-snatch champion). Pepper won the Echo Thruster (he won this exact test in 2023). We don't guess. We check the history.",
        "source": "Persistence Athletics picks boards (posted pre-event) + official results"
      },
      {
        "type": "stat",
        "kicker": "The Record Book",
        "headline": "THE LINES THAT\nGO IN THE BOOKS",
        "stats": [
          {
            "big": "5",
            "label": "Cringle's event wins these Games - three on Day 1, two more Saturday - at 1,190 points"
          },
          {
            "big": "7th",
            "label": "career event win for Lucy Campbell (swim, hopper, yoke this week)"
          },
          {
            "big": "10th",
            "label": "career win, 10th Games for Vellner - at the same Pig weight he won at in 2021"
          },
          {
            "big": "1st",
            "label": "Sprague's first event win of the week - on the 665-lb yoke, leading since Event 7"
          }
        ],
        "footnote": "All win counts verified against our almanac and the official leaderboard."
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "The Honest Grade",
        "headline": "INGREDIENTS RIGHT,\nRECIPE WRONG",
        "body": "Yesterday we published the gap analysis: through 19 events, the untested pieces were handstand push-ups, kettlebells and lunges (plus dumbbells, double-unders, ring muscle-ups and the clean and jerk). Our finale call was clean and jerks plus ring muscle-ups, lunge as the wildcard. The real Event 20 - the Fibonacci Final - is deficit HSPU, kettlebell deadlifts and a kettlebell overhead lunge. All three ingredients came off our gap list. The combination did not. We grade our own work in public, both halves.",
        "source": "Our Event 20 gap analysis (published pre-reveal) + official workouts page"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "The People",
        "headline": "THE DAY'S\nHUMAN LINES",
        "body": "Hannah Black, 30th overall entering the event with the heaviest listed snatch in the field, won the Speed Snatch - per the broadcast, the 10th athlete to take a first career event win at these Games. Henrik Haapalainen - who corrected our injury note himself this morning: not hurt, fully recovered - stood 2nd on the yoke by night's end. And Guilherme Malheiros won the snatch, asked for heavier bars, and danced: 'I think they forgot to change the women's weights.' The arena believed him.",
        "source": "Official board + Games broadcast (quotes and first-timer count per broadcast)"
      },
      {
        "type": "cta",
        "headline": "SUNDAY:\nTHE FINALE",
        "body": "Three events left. A 29-point men's race between two training partners. Full previews, the Fibonacci breakdown, and the live board - link in bio."
      }
    ]
  },
  {
    "id": "camp-wars-day3",
    "label": "Camp Wars Round 3 (through Day 3)",
    "caption": "CAMP WARS, ROUND 3 - and the plot twist nobody had: BOTH title races are now an all-Brute affair. Sprague versus Pepper for the men's crown. Cringle versus Lawson for the women's. Every jersey and every chaser, one camp. Sunday is a civil war.\n\nTHE STANDINGS (verified rosters, official board through 17): PRVN keeps the best average (11.9) and the most event wins (TEN - Mertens 3, Crouch 2, Garard 2, Sturt, Milligan, Turner). Mayhem holds second on average (12.6) behind Khrennikov and Malheiros' two-win Saturday. Brute is third on average (13.4) but owns what matters: all four top-2 slots and nine event wins. HWPO stays lean (Gazan two wins, Vellner two). And Training Think Tank finally got its moment: Hannah Black's snatch win - the camp's first event victory of the week.\n\nOne roster note: PRVN's average includes McGonigle, who has no scored result since Event 13 and sits scored last on the board.\n\nOne day left. The camp trophy is PRVN's to lose. The crowns are Brute's civil war.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Camp Wars - Round 3",
        "headline": "THE CIVIL\nWAR",
        "sub": "Both title races are now Brute versus Brute. PRVN still owns the averages. TTT finally got a win. Round 3 standings. Swipe."
      },
      {
        "type": "stat",
        "kicker": "The Headline",
        "headline": "ONE CAMP,\nFOUR CROWN SEATS",
        "stats": [
          {
            "big": "4/4",
            "label": "both No. 1s AND both No. 2s are Brute: Sprague-Pepper and Cringle-Lawson"
          },
          {
            "big": "10",
            "label": "PRVN event wins - still the most of any camp, with the best average (11.9)"
          },
          {
            "big": "9",
            "label": "Brute event wins - five of them Cringle's alone"
          },
          {
            "big": "1st",
            "label": "Training Think Tank's first event win of the week: Hannah Black's snatch"
          }
        ],
        "footnote": "Average overall placement across each camp's athletes, official board through Event 17. Camps with 2+ athletes."
      },
      {
        "type": "bars",
        "kicker": "Camp Standings - Through 17 Events",
        "headline": "AVERAGE\nPLACEMENT",
        "bars": [
          {
            "label": "PRVN Fitness (10)",
            "pct": 70,
            "display": "11.9",
            "color": "#91C640"
          },
          {
            "label": "CrossFit Mayhem (5)",
            "pct": 66,
            "display": "12.6",
            "color": "#F4C64A"
          },
          {
            "label": "Brute Strength (12)",
            "pct": 62,
            "display": "13.4",
            "color": "#60a5fa"
          },
          {
            "label": "HWPO Training (3)",
            "pct": 51,
            "display": "16.3",
            "color": "#C9D2DA"
          },
          {
            "label": "Training Think Tank (3)",
            "pct": 26,
            "display": "24.3",
            "color": "rgba(244,246,242,0.4)"
          }
        ],
        "footnote": "Lower average = better; longer bar = better. Round order held from Day 2 (PRVN, Mayhem, Brute). PRVN's average includes McGonigle, scored last with no result since Event 13."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "Brute Strength",
        "headline": "THE CIVIL WAR\nIS THE CROWN",
        "body": "Sprague 1114 versus Pepper 1085 for the men's title. Cringle 1190 versus Lawson 1074 for the women's. Every leader and every chaser wears Brute. Add Hopper's climb to 5th and nine event wins - five of them Cringle's - and the camp's top end has never looked stronger, even with the deepest roster carrying its average to third.",
        "source": "Official leaderboard through E17; roster per Brute's 2026 announcements"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "PRVN + Mayhem",
        "headline": "TEN WINS, AND\nTHE QUIET SECOND",
        "body": "PRVN's math still leads the camp race: ten event wins (Mertens 3, Crouch 2, Garard 2, Sturt, Milligan, Turner - whose Echo win Saturday was the camp's sixth different winner) and the best average at 11.9, with Crouch 3rd, Sturt 4th, Garard 6th and Kerstetter's evening surge to 7th. Mayhem sits second on average behind Khrennikov (8th) and Malheiros, whose snatch win and top-10 return made Saturday the camp's best day since Friday's revival.",
        "source": "Official leaderboard through E17; verified camp rosters"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "HWPO + Training Think Tank",
        "headline": "LEAN, AND\nFINALLY ON BOARD",
        "body": "HWPO's three-athlete roster keeps punching up: Gazan holds 5th with two event wins, and Vellner's Pig victory - his second win of these Games - came with the whole arena on its feet. And Training Think Tank finally has a win column: Hannah Black, 30th overall entering the event, took the Speed Snatch outright with the heaviest listed snatch in the field. Sometimes the week just needs one bar.",
        "source": "Official leaderboard through E17; verified camp rosters"
      },
      {
        "type": "cta",
        "headline": "ONE DAY.\nTHREE EVENTS.",
        "body": "The camp trophy is PRVN's to lose. The crowns are a Brute civil war. Full camp math and the live leaderboard - link in bio."
      }
    ]
  },
  {
    "id": "day3-data-recap",
    "label": "Day 3 Data Recap + Sunday Projection",
    "caption": "DAY 3, BY THE DATA. Ten events in one day - five per division, the biggest single day of the week - and both title races got tighter, not clearer.\n\nTHE DAY IN NUMBERS: 5-for-5 on our picks boards (Garard, Vellner, Loewen, Malheiros, Pepper - every pick posted before the event, every receipt from our own almanac). Cringle took wins four and five of her Games and leads by 116 at 1,190. Sprague finally won his first event of the week - on the heaviest test - and leads Pepper by 29.\n\nTHE MOVERS (after 12 vs after 17): Pepper 4th to 2nd. Hopper 6th to 5th on a 3rd-plus-3rd evening. Adler 9th to 7th. And the closing surge of the day belongs to Olivia Kerstetter: 13th at the evening break, 7th by the end of the night.\n\nTHE SILVER DRAMA: the women's second-place gap read 36, then 1, then 36, then 63, then 33 across Saturday's five events. Lawson holds it at 1,074 over Campbell's 1,041 - after Campbell answered with 196 points in her last two events.\n\nSUNDAY BY THE ALMANAC: E18 is machines only (row 3,600m + ski 3,600m) - and both prior machine-event winners are in this field: Adler won the 2025 Run/Row/Run, Mertens won the 2023 Ski-Bag. E19 is a rings skill test with zero Games precedent - our research flags the real gymnastics backgrounds (Hoffer won Friday's handstand sprint; Sturt trained gymnastics; Campbell owns the best gymnastics modal score in the field). E20 is the Fibonacci Final - full kit already live.\n\nA history read, not a result prediction. Everything live at the link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Day 3 - Sat July 25",
        "headline": "DAY 3,\nBY THE DATA",
        "sub": "Ten events in one day. Five picks receipts. Two title races tighter than when the sun came up. The numbers. Swipe."
      },
      {
        "type": "stat",
        "kicker": "The Day In Numbers",
        "headline": "SATURDAY BY\nTHE NUMBERS",
        "stats": [
          {
            "big": "10",
            "label": "events run in one day - five per division, the biggest day of the week"
          },
          {
            "big": "5-for-5",
            "label": "picks-board receipts: Garard, Vellner, Loewen, Malheiros, Pepper - all posted before the events"
          },
          {
            "big": "29",
            "label": "the men's title gap: Sprague 1114 over Pepper 1085, three events left"
          },
          {
            "big": "116",
            "label": "Cringle's lead at 1,190 after wins four and five of her Games"
          }
        ],
        "footnote": "All numbers per the official leaderboard through Event 17. Picks receipts verifiable on our feed - posted before every event."
      },
      {
        "type": "movement",
        "kicker": "Men - After 17 (movement across Day 3)",
        "headline": "MEN: WHAT THE\nDAY CHANGED",
        "rows": [
          {
            "rank": 1,
            "name": "James Sprague",
            "pts": 1114,
            "delta": 0
          },
          {
            "rank": 2,
            "name": "Dallin Pepper",
            "pts": 1085,
            "delta": 2
          },
          {
            "rank": 3,
            "name": "Jay Crouch",
            "pts": 1046,
            "delta": -1
          },
          {
            "rank": 4,
            "name": "Justin Medeiros",
            "pts": 984,
            "delta": -1
          },
          {
            "rank": 5,
            "name": "Jayson Hopper",
            "pts": 916,
            "delta": 1
          },
          {
            "rank": 6,
            "name": "Ricky Garard",
            "pts": 906,
            "delta": -1
          },
          {
            "rank": 7,
            "name": "Jeffrey Adler",
            "pts": 832,
            "delta": 2
          },
          {
            "rank": 8,
            "name": "Roman Khrennikov",
            "pts": 798,
            "delta": -1
          }
        ],
        "note": "Movement shown vs the start of the day (after Event 12). Malheiros 9th and Fiebig 10th round out the ten; Mertens and Hoffer dropped out."
      },
      {
        "type": "movement",
        "kicker": "Women - After 17 (movement across Day 3)",
        "headline": "WOMEN: WHAT THE\nDAY CHANGED",
        "rows": [
          {
            "rank": 1,
            "name": "Aimee Cringle",
            "pts": 1190,
            "delta": 0
          },
          {
            "rank": 2,
            "name": "Emma Lawson",
            "pts": 1074,
            "delta": 1
          },
          {
            "rank": 3,
            "name": "Lucy Campbell",
            "pts": 1041,
            "delta": -1
          },
          {
            "rank": 4,
            "name": "Madeline Sturt",
            "pts": 877,
            "delta": 0
          },
          {
            "rank": 5,
            "name": "Alex Gazan",
            "pts": 863,
            "delta": 0
          },
          {
            "rank": 6,
            "name": "Arielle Loewen",
            "pts": 811,
            "delta": 2
          },
          {
            "rank": 7,
            "name": "Olivia Kerstetter",
            "pts": 787,
            "delta": null
          },
          {
            "rank": 8,
            "name": "Danielle Brandon",
            "pts": 782,
            "delta": -1
          }
        ],
        "note": "Movement vs after Event 12 (official tiebreaks). Kerstetter climbed from 13th at the evening break to 7th by night - the best closing surge in the field. Fuliano 9th, Rodgers 10th."
      },
      {
        "type": "stat",
        "kicker": "The Two Races",
        "headline": "TIGHTER, NOT\nCLEARER",
        "stats": [
          {
            "big": "36-1-36-63-33",
            "label": "the women's silver gap after each event Saturday - Lawson holds it by 33"
          },
          {
            "big": "196",
            "label": "Campbell's points in her final two events (Echo 2nd + yoke WIN, her 3rd of the Games)"
          },
          {
            "big": "1st",
            "label": "Sprague's yoke win - his first event win of these Games, after leading since Event 7"
          },
          {
            "big": "4/4",
            "label": "both title-race slots in both divisions belong to Brute Strength athletes"
          }
        ],
        "footnote": "Sprague and Pepper, Cringle and Lawson - every jersey and every chaser trains at the same camp. Sunday is a civil war."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "Sunday Projection",
        "headline": "WHAT THE ALMANAC\nSAYS ABOUT SUNDAY",
        "body": "E18 is machines only - row 3,600m, ski 3,600m - and both prior machine-event winners are in this field: Adler won the 2025 Run/Row/Run and Mertens won the 2023 Ski-Bag. E19 is a five-minute rings skill test with zero Games precedent - our research flags the real gymnastics backgrounds: Hoffer (who won Friday's handstand sprint), Sturt, and Campbell with the field's best gymnastics modal score. E20 is the Fibonacci Final, the 2018 deficit rerun at a 10-minute cap - our full breakdown is already live. A history read, not a result prediction.",
        "source": "Persistence Athletics Games Almanac + official workouts page"
      },
      {
        "type": "cta",
        "headline": "THREE EVENTS.\nEVERYTHING LIVE.",
        "body": "Both boards, every recap, the Fibonacci breakdown, and the live leaderboard - link in bio. Finale day cards fire the moment each board posts."
      }
    ]
  },
  {
    id: 'event20-fibonacci-final',
    label: 'Event 20 - Fibonacci Final',
    caption:
      "THE LAST EVENT OF THE SEASON JUST DROPPED. Event 20, Fibonacci Final, is live on the official workouts page.\n\n5-8-13 reps for time of deficit handstand push-ups (14-in men, 8-in women) and double-kettlebell deadlifts (203/124 lb), then one 89-ft double-kettlebell overhead lunge (53/35 lb). 10-minute cap.\n\nWe checked our own almanac. This is the THIRD Fibonacci in Games history. The 2017 original closed that season (non-deficit HSPU, different women's rep scheme). The 2018 version introduced the exact 14/8-inch deficit and 5-8-13 scheme this year reuses, at a 6-minute cap. 2026 stretches that cap to 10.\n\nAnd the title math: Sprague leads Pepper by just 29 points entering the finale. Cringle leads Lawson by 116.\n\nSwipe for who's positioned. Link in bio. A history and standings read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Event 20 - Sun July 26', headline: 'FIBONACCI\nFINAL', sub: 'The last event of the season. Deficit HSPU + heavy kettlebells, at the exact 2018 loads. Sprague leads Pepper by 29 points. Swipe.' },
      { type: 'point', num: 1, kicker: 'The workout', headline: '5-8-13,\nDEFICIT HSPU', body: 'Deficit handstand push-ups (14-in men, 8-in women) and double-kettlebell deadlifts (203/124 lb), 5-8-13 reps each. Then one 89-ft double-kettlebell overhead lunge (53/35 lb). 10-minute cap.', source: 'games.crossfit.com (official workouts page)' },
      { type: 'point', num: 2, kicker: 'The history', headline: 'THE THIRD\nFIBONACCI', body: 'The 2017 Fibonacci Final closed that season at non-deficit HSPU. The 2018 version introduced this exact 14/8-inch deficit and 5-8-13 scheme, at a tighter 6-minute cap. 2026 is that test again, with the cap stretched to 10.', source: 'Persistence Athletics Games Almanac' },
      { type: 'point', num: 3, kicker: 'The men', headline: 'VELLNER\'S THE\nSPECIALIST', body: 'Patrick Vellner: 4th in 2018 at these exact loads, tied 9th in 2017 - but 16th overall. The real fight is at the top: Sprague leads Pepper by 29 points, Crouch by 68, entering the last event.', source: 'Official Games leaderboard' },
      { type: 'point', num: 4, kicker: 'The women', headline: 'RAPTIS\'S\nDEFICIT PEDIGREE', body: 'Alexis Raptis\'s only Games win came in a deficit-HSPU test (2022 Echo Press) - but she\'s 21st overall. Cringle leads Lawson by 116 points entering the finale, with Campbell 33 back of Lawson for 2nd.', source: 'Official Games leaderboard' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'The complete three-generation history and both boards are on the site. A history and standings read, not a result prediction.' },
    ],
  },
  {
    id: 'event16-17-echo-thruster-yoke',
    label: 'Event 16/17 - Echo Thruster / Jump Pull Yoke',
    caption:
      "TWO MORE EVENTS JUST DROPPED: EVENT 16/17. The official workouts page published both, run back to back on one clock tonight.\n\nEVENT 16, Echo Thruster: 21-18-15 reps of Echo Bike cals + Thrusters, ascending load (115/135/155 lb men, 85/95/105 lb women), 8-min cap.\n\nEVENT 17, Jump Pull Yoke, starts when the clock reads 10:00: 20 shuttle box jumps, a seated sled pull, then 3 ascending yoke carries topping at 665 lb men / 445 lb women.\n\nWe checked our own almanac. Event 16's loads are the EXACT 2023 Echo Thruster Final again (won by Dallin Pepper, back in the field). Event 17's 665-lb top yoke matches the heaviest yoke EVER loaded at the Games - 2022's Back Nine, won by Jeffrey Adler, also back.\n\nSwipe for who's positioned on both halves. Link in bio. A history read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Event 16/17 - Sat July 25', headline: 'ECHO THRUSTER\n+ YOKE', sub: 'Two events, one clock. Event 16 matches 2023 exactly. Event 17\'s top yoke matches the heaviest ever loaded at the Games. Swipe.' },
      { type: 'point', num: 1, kicker: 'Event 16', headline: '21-18-15,\nASCENDING', body: 'Echo Bike calories + Thrusters, load climbing as reps drop: 115/135/155 lb men, 85/95/105 lb women. 8-minute cap. Identical loads to the 2023 Echo Thruster Final.', source: 'games.crossfit.com (official workouts page)' },
      { type: 'point', num: 2, kicker: 'Event 17', headline: 'STARTS AT\nTHE 10:00 MARK', body: '20 shuttle box jumps, a seated sled pull, then 3 ascending 30-ft yoke carries: 425/565/665 lb men, 345/405/445 lb women. 6-minute cap. The 665-lb top rung matches the heaviest yoke ever loaded at the Games (2022).', source: 'games.crossfit.com (official workouts page)' },
      { type: 'point', num: 3, kicker: 'The receipts - Men', headline: 'ADLER.\nPEPPER.', body: 'Adler WON the 2022 665-lb yoke test outright and was 5th in the 2023 Echo Thruster at these exact loads. Pepper WON the 2023 Echo Thruster outright. Hatfield swept both 2024 yoke finals. Then Medeiros and Malheiros, 3rd and 4th in the 2022 yoke test.', source: 'Official Games leaderboards' },
      { type: 'point', num: 4, kicker: 'The receipts - Women', headline: 'RAPTIS.\nBRANDON.', body: 'Raptis WON the 2024 Final 2421 yoke sprint and was 13th in the 2023 Echo Thruster. Brandon is the most consistent: 8th, 8th, 5th across all three tests. Sturt (5th/4th in 2024), Lawson (9th in 2023) and Gazan (trending up) round out the board.', source: 'Official Games leaderboards' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'The complete history and both boards are on the site. A history read, not a result prediction.' },
    ],
  },
  {
    "id": "games-modality-map",
    "label": "The Whole Test, Mapped (methodology read + E20 projection)",
    "caption": "THE WHOLE TEST, MAPPED. 19 of 20 events are now published. One remains hidden. So we ran the entire 2026 Games through CrossFit's own programming methodology - modal domains, time domains, loading - the same lens we use on 6,800 daily WODs.\n\nTHE BREADTH: the shortest scored effort is a single max sandbag throw (seconds). The longest live in the 25-41 minute band (the Ranch 7200 trail run, Sunday's row+ski Machine 7200). In between: three dedicated 1-rep-max barbell tests, a swim, a bicycle race, a 500m sprint, handstands, rings, ropes, a 400-lb Snail, a 510-lb Pig, a 30/20-lb sandbag thrown three ways and a yoke that ends at 665 lb.\n\nTHE MODAL MAP (19 events): 4 pure engine, 4 pure barbell, 2 pure gymnastics skill, 6 mixed, 3 odd-object/throw/carry tests. Every time band is touched, including four tests with no clock at all (the three Total lifts and the throw). Scored against the definition - work capacity across broad time and modal domains - 2026 is the most faithful hopper in years.\n\nTONIGHT: Event 16 is the 2023 finale's bike-and-thruster core brought forward - same 21-18-15, same climbing loads. 2023 finished it with a lunge; tonight it hands off to the yoke instead. Then the Jump Pull Yoke gauntlet on the same running clock, ending at 16:00.\n\nAND THE FINALE MATH: through 19 events there are still no ring muscle-ups, no lunges, no handstand push-ups, not one dumbbell or kettlebell, no double-unders - and the clean & jerk has only appeared in fragments, never together. Thrusters closed 6 of the last 10 Games but just ran tonight. Lunges appeared in 4 of the last 10 finales. The 2019 finale was clean & jerks + ring muscle-ups + snatches. Our read for Event 20: short arena finale, clean & jerk + ring muscle-up, lunge as the wildcard. A methodology read, not inside information.\n\nFull breakdown at the link in bio.",
    "slides": [
      {
        "type": "cover",
        "kicker": "2026 Games - The Methodology Read",
        "headline": "THE WHOLE TEST,\nMAPPED",
        "sub": "19 of 20 events are published. One stays hidden. What the 2026 Games actually tests, in CrossFit's own programming language - and what the gaps say about the finale. Swipe."
      },
      {
        "type": "stat",
        "kicker": "The Breadth",
        "headline": "SECONDS\nTO 40 MINUTES",
        "stats": [
          {
            "big": "~2 sec",
            "label": "the shortest scored effort: one max-distance sandbag throw (Event 9)"
          },
          {
            "big": "25-41",
            "label": "minutes - the long band: the Ranch 7200 trail run (women won in 40:42) and Sunday row+ski Machine 7200"
          },
          {
            "big": "3",
            "label": "dedicated 1-rep-max barbell tests: back squat, shoulder press, deadlift"
          },
          {
            "big": "665 lb",
            "label": "heaviest implement (the final yoke) - same Games as bodyweight ring skills"
          }
        ],
        "footnote": "Work capacity across broad time and modal domains is the definition of fitness. 2026 runs the full span of both."
      },
      {
        "type": "bars",
        "kicker": "Modal Domains - 19 Published Events",
        "headline": "THE MODAL\nMAP",
        "bars": [
          {
            "label": "Mixed (M+G+W blends)",
            "pct": 100,
            "display": "6 events",
            "color": "#91C640"
          },
          {
            "label": "Pure engine (M)",
            "pct": 67,
            "display": "4 events",
            "color": "#60a5fa"
          },
          {
            "label": "Pure barbell (W)",
            "pct": 67,
            "display": "4 events",
            "color": "#F4C64A"
          },
          {
            "label": "Odd object / throw / carry",
            "pct": 50,
            "display": "3 events",
            "color": "#CD8B5B"
          },
          {
            "label": "Pure gymnastics skill (G)",
            "pct": 33,
            "display": "2 events",
            "color": "#C9D2DA"
          }
        ],
        "footnote": "M = monostructural, G = gymnastics, W = weightlifting, per the L1 model. Counting the Total as its three scored lifts. Filing rule for the straddlers: the Snail push is the majority of its event's scored work (odd object); the Pig flip is a low-rep bookend on a gymnastics-dominant test (mixed)."
      },
      {
        "type": "bars",
        "kicker": "Time Domains - Estimated Winning Durations",
        "headline": "EVERY BAND,\nTOUCHED",
        "bars": [
          {
            "label": "Medium, 6-20 min",
            "pct": 100,
            "display": "6 events",
            "color": "#91C640"
          },
          {
            "label": "Short, 2-6 min",
            "pct": 83,
            "display": "5 events",
            "color": "#F4C64A"
          },
          {
            "label": "Max effort, no clock",
            "pct": 67,
            "display": "4 events",
            "color": "#CD8B5B"
          },
          {
            "label": "Sprint, under 2 min",
            "pct": 33,
            "display": "2 events",
            "color": "#60a5fa"
          },
          {
            "label": "Long, 25-41 min",
            "pct": 33,
            "display": "2 events",
            "color": "#C9D2DA"
          }
        ],
        "footnote": "From published caps and posted winning times: the bicycle race was won in 18-19 min (medium), the Snail in under 5:30 (short), and the throw plus all three Total lifts run with no clock at all. Broad time domains is half the definition - 2026 touches every band."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "The Verdict",
        "headline": "THIS IS THE\nHOPPER, DELIVERED",
        "body": "Squat, press and deadlift at max. A trail run, a bicycle race, a swim, a 500m sprint. Handstands, rings, ropes, muscle-ups. Snatches at speed, cleans in intervals, thrusters against a bike. A 400-lb Snail, a 510-lb Pig, a 665-lb yoke, a 30/20-lb sandbag thrown three directions. Nine of the ten general physical skills have a clear home, from balance on the handstand course to accuracy on the three-direction throw - flexibility alone rides along only inside the squat and overhead positions. Scored against CrossFit's own definition - work capacity across broad time and modal domains - 2026 is the most faithful test in years.",
        "source": "Method: CrossFit L1 Training Guide definitions applied to the 19 published events"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "Tonight - Events 16 + 17",
        "headline": "THE 2023 FINALE\nRUNS TONIGHT",
        "body": "Event 16, Echo Thruster, is the 2023 finale's bike-and-thruster core brought forward: the same 21-18-15 of Echo bike calories and short-bar thrusters at the same climbing loads, 115/135/155 lb (85/95/105), now on an 8-minute cap. One difference: 2023 finished with a lunge - tonight finishes with Event 17 instead. At the 10:00 clock, Jump Pull Yoke: 20 shuttle box jumps (36/30 in), a seated sled pull (170/140 lb), then 30-foot yoke carries at three rising weights ending at 665 lb (445), all done by 16:00. Two scores, one clock. And it changes the finale math: after tonight, thrusters are spent - and lunges are STILL untested.",
        "source": "games.crossfit.com official workouts page"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "Event 20 - The Gap Analysis",
        "headline": "WHAT THE GAPS SAY\nABOUT NO. 20",
        "body": "Still untested through 19 events: ring muscle-ups (bar only so far), lunges of any kind, handstand push-ups, dumbbells, kettlebells, double-unders - and the clean & jerk, which has appeared only in fragments (hang cleans on Event 10, push jerks on Event 1), never together. The finale record: thrusters closed 6 of the last 10 Games but just ran tonight; lunges appeared in 4 of the last 10 finales; the 2019 finale, The Standard, was clean & jerks, ring muscle-ups and snatches. Our read: a short arena finale built on the clean & jerk and the ring muscle-up, with a lunge as the wildcard. A methodology read, not inside information.",
        "source": "Persistence Athletics Games Almanac, finales 2015-2025 (the last 10 Games)"
      },
      {
        "type": "cta",
        "headline": "ONE EVENT\nLEFT HIDDEN",
        "body": "The full modality map, every event breakdown, and the live leaderboard are on the site - link in bio. The finale reveals Sunday. We will grade our guess in public."
      }
    ]
  },
  {
    id: 'event14-triple-pig',
    label: 'Event 14 - Triple Pig',
    caption:
      "🐷 EVENT 14 IS LIVE: TRIPLE PIG. The official workouts page just published it: 3 ascending rounds of bar muscle-ups, GHD sit-up wall-ball shots, triple-unders (a Games first) and Pig flips. Sat July 25, 15-minute cap.\n\nThe Pig weight is not new: 510 lb men / 350 lb women is the EXACT same load as two prior tests. And two men in the 2026 field have already won at this weight.\n\nPatrick Vellner WON the 2021 Sled, Pig, Muscle-Ups at 510/350. Roman Khrennikov WON the 2023 Pig Chipper at the same weight. Women: Arielle Loewen (2nd 2023) and Alexis Raptis (3rd 2023) both return too.\n\nSwipe for the full read. Link in bio. A history + model read, not a result prediction.",
    slides: [
      { type: 'cover', kicker: 'Event 14 - Sat July 25', headline: 'TRIPLE\nPIG', sub: 'Bar muscle-ups, GHD wall-ball, triple-unders, Pig flips. Same 510/350-lb Pig as two prior tests. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Test', headline: '3 ROUNDS,\nASCENDING', body: '10/15/20 bar muscle-ups, 15/20/25 GHD sit-up wall-ball shots (20 lb men / 14 lb women), 20/25/30 triple-unders, 1/2/3 Pig flips (510 lb men / 350 lb women). 15-minute cap. Flip distance not yet announced.', source: 'games.crossfit.com (official workouts page)' },
      { type: 'point', num: 2, kicker: 'The History', headline: 'THIS WEIGHT\nHAS BEEN BEATEN', body: '510 lb men / 350 lb women is the exact same Pig weight as the 2021 Sled, Pig, Muscle-Ups and the 2023 Pig Chipper. Triple-unders, on the other hand, have zero precedent anywhere in Games history.', source: 'Persistence Athletics archive' },
      { type: 'point', num: 3, kicker: 'The receipts - Men', headline: 'VELLNER.\nKHRENNIKOV.', body: 'Vellner WON the 2021 test at this exact weight (7:42.42); 6th in the 2023 Pig Chipper. Khrennikov WON the 2023 Pig Chipper outright (14:28.77) at this same load. Medeiros has no precedent here but the field\'s best gym/heavy modal blend. Then Malheiros (6th 2021), Crouch (10th 2023).', source: 'Official Games leaderboards' },
      { type: 'point', num: 4, kicker: 'The receipts - Women', headline: 'LOEWEN.\nRAPTIS.', body: 'Loewen was 2nd and Raptis 3rd in the 2023 Pig Chipper, both at this same weight. Gazan was 6th. Adams was 5th in the 2021 test. Campbell has no precedent (absent both years) but the field\'s best gymnastics modal score.', source: 'Official Games leaderboards' },
      { type: 'cta', headline: 'FULL\nBREAKDOWN', body: 'The complete history and both boards are on the site. A history + model read, not a result prediction.' },
    ],
  },
  {
    "id": "camp-wars-day2",
    "label": "Camp Wars Round 2 (through Day 2)",
    "caption": "CAMP WARS, ROUND 2. You asked after Day 1 - here is the update through 12 events. Rosters verified from the camps' own announcements, math straight off the official board.\n\nTHE TWIST: the camp lead changed hands too. PRVN now owns the best average placement (12.2) and a monster EIGHT event wins - Mertens alone has three, Crouch two, plus Garard, Sturt and Milligan. Day 2 belonged to Nashville.\n\nBUT Brute Strength still owns what matters most: BOTH leader jerseys. Sprague (752) and Cringle (826, with an 87-point lead) wear white into Saturday, and Brute has six athletes in the top 10. Their depth got tested - five of their twelve sit 21st or lower - but the crowns are theirs.\n\nAND MAYHEM WOKE UP. We called their Day 1 the quietest in years - Day 2 answered: Khrennikov won the Snail, Rodgers won the handstands hours after taking 2nd on the Snail, Malheiros won the sandbag throw and went 2nd on the handstands. Second-best camp average (12.6).\n\nHWPO runs lean but sharp: Gazan owns TWO event wins and sits 5th. TTT is still hunting its day.\n\nBrute owns the jerseys. PRVN owns the events. Mayhem owns the momentum. Two days left.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Camp Wars - Round 2",
        "headline": "THE CAMP LEAD\nCHANGED TOO",
        "sub": "Through 12 events: PRVN owns the event wins, Brute owns both jerseys, and Mayhem woke up. Verified rosters, official math. Swipe."
      },
      {
        "type": "stat",
        "kicker": "The Headline",
        "headline": "PRVN RISES,\nBRUTE REIGNS",
        "stats": [
          {
            "big": "12.2",
            "label": "PRVN average placement - now the best camp (Brute led Day 1 at 10.4)"
          },
          {
            "big": "8",
            "label": "PRVN event wins through 12 events - most of any camp"
          },
          {
            "big": "2/2",
            "label": "Brute still owns BOTH leader jerseys: Sprague 752 + Cringle 826"
          },
          {
            "big": "3",
            "label": "Mayhem event wins on Day 2 alone - the revival"
          }
        ],
        "footnote": "Average overall placement across each camp's athletes, official board through Event 12. Camps with 2+ athletes."
      },
      {
        "type": "bars",
        "kicker": "Camp Standings - Through 12 Events",
        "headline": "AVERAGE\nPLACEMENT",
        "bars": [
          {
            "label": "PRVN Fitness (10)",
            "pct": 63,
            "display": "12.2",
            "color": "#91C640"
          },
          {
            "label": "CrossFit Mayhem (5)",
            "pct": 62,
            "display": "12.6",
            "color": "#F4C64A"
          },
          {
            "label": "Brute Strength (12)",
            "pct": 58,
            "display": "13.8",
            "color": "#60a5fa"
          },
          {
            "label": "HWPO Training (3)",
            "pct": 48,
            "display": "16.7",
            "color": "#C9D2DA"
          },
          {
            "label": "Training Think Tank (3)",
            "pct": 27,
            "display": "23.0",
            "color": "rgba(244,246,242,0.4)"
          }
        ],
        "footnote": "Lower average = better; longer bar = better. Day 1 order was Brute 10.4, PRVN 12.5, Mayhem 15.2 - two camps traded places."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "Brute Strength",
        "headline": "BOTH JERSEYS,\nTESTED DEPTH",
        "body": "Sprague survived two lead changes and a scoring scare to keep the men's jersey at 752. Cringle turned Day 2 into a fortress: an 87-point lead at 826. Add Lawson 3rd, Pepper 4th, Hopper 6th, Adams 10th - six Brute athletes in the top 10. The flip side: five of their twelve sit 21st or lower. The crowns are Brute's. The floor is not.",
        "source": "Official leaderboard through E12; roster per Brute's 2026 announcements"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "PRVN Fitness",
        "headline": "EIGHT WINS.\nDAY 2 WAS THEIRS.",
        "body": "Mertens won the hopper for his THIRD win of these Games. Crouch won the run-and-clean, took 2nd on the hopper, and sits 2nd overall at 740 - twelve points off the jersey. Garard, Sturt and Milligan own wins too. Eight event victories, the best camp average, and four in the top 8 (Crouch 2nd, Sturt 4th, Garard 5th, Mertens 8th). Nashville is coming for Saturday.",
        "source": "Official leaderboard through E12; roster per PRVN's Games-week posts"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "Mayhem + HWPO",
        "headline": "THE REVIVAL AND\nTHE SHARPSHOOTERS",
        "body": "Mayhem's Friday: Khrennikov won the Snail, Rodgers won the Handstand Sprint hours after taking 2nd on the Snail, and Malheiros won the sandbag throw then went 2nd on the handstands. Three wins in one day - second-best camp average. HWPO stays lean and lethal: Gazan owns TWO event wins and 5th overall, and Vellner backed his deadlift with a throw podium.",
        "source": "Official leaderboard; verified camp rosters"
      },
      {
        "type": "cta",
        "headline": "TWO DAYS.\nEIGHT EVENTS.",
        "body": "Brute owns the jerseys. PRVN owns the events. Mayhem owns the momentum. Full camp math and the live leaderboard are on the site - link in bio."
      }
    ]
  },
  {
    "id": "day2-data-recap",
    "label": "Day 2 Data Recap + Day 3 Projection",
    "caption": "DAY 2, BY THE DATA. Five arena events, and the modality map flipped exactly the way we projected: Day 1 tested the poles - Day 2 tested the middle.\n\nWHAT IT TESTED: an odd-object grip war (the Snail), a throwing skill test (the 3D throw), a barbell-engine interval (run + hang cleans), a pure gymnastics sprint (the handstands), and a fan-voted barbell-gymnastics couplet (Toomey's hopper). Zero pure-engine events, zero max lifts - everything lived in the skill-and-cycling middle that Day 1 skipped.\n\nWHO LEADS AT HALFWAY: Men - Sprague 752, after a day where the lead changed twice and the top four packed into 34 points (Crouch 740, Medeiros 732, Pepper 718). Women - Cringle 826 with an EIGHTY-SEVEN point fortress, while 2nd place changed hands four times in one day and landed with Campbell (739), five points over Lawson (734).\n\nTHE DAY IN NUMBERS: 3 first-career event wins (Hoffer, Domit, Rodgers). 2 men's lead changes. 4 women's silver flips. 1 buzzer review that decided a podium place.\n\nDAY 3 BY THE ALMANAC: the 500m sprint (Garard won 2024 Track and Field outright - the closest verified sprint credential in the field; Adams owns the best women's sprint resume) and the Speed Snatch Triple (Malheiros won the 2021 max snatch at 305 lb). Three Saturday events still unannounced.\n\nHalfway done. Full boards + the live leaderboard at the link in bio. A history read, not a result prediction.",
    "slides": [
      {
        "type": "cover",
        "kicker": "Day 2 - Friday",
        "headline": "DAY 2,\nBY THE DATA",
        "sub": "Five arena events, two lead changes, four silver flips, one buzzer verdict. The numbers behind the wildest day of the week. Swipe."
      },
      {
        "type": "bars",
        "kicker": "The Programming",
        "headline": "DAY 2 TESTED\nTHE MIDDLE",
        "bars": [
          {
            "label": "Gymnastics skill",
            "pct": 100,
            "display": "2 events",
            "color": "#91C640"
          },
          {
            "label": "Barbell + engine mix",
            "pct": 100,
            "display": "2 events",
            "color": "#F4C64A"
          },
          {
            "label": "Odd-object / grip",
            "pct": 50,
            "display": "1 event",
            "color": "#60a5fa"
          },
          {
            "label": "Throwing skill",
            "pct": 50,
            "display": "1 event",
            "color": "#CD8B5B"
          },
          {
            "label": "Pure engine / max lift",
            "pct": 4,
            "display": "0 events",
            "color": "rgba(244,246,242,0.4)"
          }
        ],
        "footnote": "Classified by each event's primary stimulus; the hopper counts in two families. Day 1 put 6 of 7 tests at the poles - Day 2 put 5 of 5 in the middle. Exactly the swing our Day 1 data recap projected."
      },
      {
        "type": "movement",
        "kicker": "Men - Halfway (12 of 20 events)",
        "headline": "MEN: THE\nHALFWAY BOARD",
        "rows": [
          {
            "rank": 1,
            "name": "James Sprague",
            "pts": 752,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Jay Crouch",
            "pts": 740,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Justin Medeiros",
            "pts": 732,
            "delta": null
          },
          {
            "rank": 4,
            "name": "Dallin Pepper",
            "pts": 718,
            "delta": null
          },
          {
            "rank": 5,
            "name": "Ricky Garard",
            "pts": 675,
            "delta": null
          },
          {
            "rank": 6,
            "name": "Jayson Hopper",
            "pts": 647,
            "delta": null
          },
          {
            "rank": 7,
            "name": "Roman Khrennikov",
            "pts": 592,
            "delta": null
          },
          {
            "rank": 8,
            "name": "Colten Mertens",
            "pts": 559,
            "delta": null
          }
        ],
        "note": "Top four within 34 points. The lead changed twice on Friday and ended where it started. Adler 9th, Hoffer 10th."
      },
      {
        "type": "movement",
        "kicker": "Women - Halfway (12 of 20 events)",
        "headline": "WOMEN: THE\nHALFWAY BOARD",
        "rows": [
          {
            "rank": 1,
            "name": "Aimee Cringle",
            "pts": 826,
            "delta": null
          },
          {
            "rank": 2,
            "name": "Lucy Campbell",
            "pts": 739,
            "delta": null
          },
          {
            "rank": 3,
            "name": "Emma Lawson",
            "pts": 734,
            "delta": null
          },
          {
            "rank": 4,
            "name": "Madeline Sturt",
            "pts": 652,
            "delta": null
          },
          {
            "rank": 5,
            "name": "Alex Gazan",
            "pts": 636,
            "delta": null
          },
          {
            "rank": 6,
            "name": "Paige Rodgers",
            "pts": 583,
            "delta": null
          },
          {
            "rank": 7,
            "name": "Danielle Brandon",
            "pts": 580,
            "delta": null
          },
          {
            "rank": 8,
            "name": "Arielle Loewen",
            "pts": 580,
            "delta": null
          }
        ],
        "note": "Cringle's lead: 87. Second place changed hands four times on Friday and sits with Campbell by five. Fuliano 9th, Adams 10th."
      },
      {
        "type": "stat",
        "kicker": "The Day In Numbers",
        "headline": "FRIDAY BY\nTHE NUMBERS",
        "stats": [
          {
            "big": "2",
            "label": "men's lead changes - and Sprague still ended the day in front"
          },
          {
            "big": "4",
            "label": "times 2nd place flipped in the women's race in ONE day"
          },
          {
            "big": "3",
            "label": "first-career event wins: Hoffer, Domit, Rodgers"
          },
          {
            "big": "87",
            "label": "Cringle's halfway lead - built without a single Friday event win"
          }
        ],
        "footnote": "Plus a 25-second gymnastics demolition and a buzzer review that decided a podium place. All from the official board."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "Day 3 Projection",
        "headline": "SPEED DAY:\nWHO IT FAVORS",
        "body": "Saturday opens with the 500-meter sprint - Ricky Garard won 2024 Track and Field outright, the closest verified sprint credential in the field, and Haley Adams owns the best women's sprint resume in our almanac. Then the Speed Snatch Triple, echoing the 2020 test - and the proven big snatcher here is Guilherme Malheiros, who won the 2021 max snatch at 305 lb and just had a two-podium Friday. Three Saturday events remain unannounced. A history read, not a result prediction.",
        "source": "Persistence Athletics Games Almanac + official leaderboard"
      },
      {
        "type": "cta",
        "headline": "HALFWAY.\nEVERYTHING LIVE.",
        "body": "Both halfway boards, every event recap, and the live leaderboard that updates all weekend - link in bio. Day 3 cards the moment each event goes official."
      }
    ]
  },
  {
    "id": "champs-day2",
    "label": "Champions Check-In - Day 2",
    "caption": "Halfway through the Games and four former champions sit inside the top 10, with Sprague still in the jersey. Crouch is coming for those red shorts, and Sunday will crown a first-time women's champion. Buckle up.",
    "slides": [
      {
        "type": "cover",
        "kicker": "GAMES 2026 · DAY 2 RECAP",
        "headline": "Four Champions\nStill Standing",
        "sub": "Sprague, Medeiros, Hopper, and Adler are all top 10 at the halfway point"
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "THE LEADER",
        "headline": "Sprague Never\nLet Go",
        "body": "He lost the jersey to Pepper for exactly one event and took it right back. Then came an E11 scoring-revision scare that had everybody holding their breath - officially, he retained the lead through it. He closed the day with a clutch 4th on the hopper. 752 points. Still wearing red.",
        "source": "Games leaderboard, official"
      },
      {
        "type": "stat",
        "kicker": "HALFWAY NUMBERS",
        "headline": "Champions Own\nThe Top Ten",
        "stats": [
          {
            "big": "4/10",
            "label": "former champions in the top 10"
          },
          {
            "big": "3rd",
            "label": "Hopper's finish on the hopper"
          },
          {
            "big": "3",
            "label": "Mertens event wins, most of anyone"
          },
          {
            "big": "34",
            "label": "points span the top 4 men"
          }
        ],
        "footnote": "Men's standings official through Day 2"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "THE CHASE PACK",
        "headline": "Crouch Wants\nThose Shorts",
        "body": "Crouch won E10 for his 3rd career event win, backed it with a hopper 2nd, and sits 12 back: \"I'll come back for those red shorts and leader's jersey, baby.\" Medeiros keeps grinding with no holes - 5th sandbag, 2nd on E10, 6th handstands, 5th hopper - the machine that was 20 points off the lead at one stage. Pepper wore the jersey for exactly one event, then stumbled 10th and 19th. Saturday owes him an answer.",
        "source": "Games broadcast, official leaderboard"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "NO CROWNS IN THIS FIELD",
        "headline": "A New Queen\nRises Sunday",
        "body": "Not one former champion sits in the women's field, so Sunday hands somebody a first title. Campbell banked her 6th career win on the hopper and spoke about racing without Toomey in the room: \"there is a different chat when you come second... the person who won obviously not being here.\" Lawson surged from 5th to 2nd on the official after-Event-11 board. Cringle carries the leader's jersey into Saturday after leading by 88 entering the closer - final points and placings are pending the official board.",
        "source": "Games broadcast, official leaderboard"
      },
      {
        "type": "cta",
        "headline": "Saturday Brings\nTwo Reads",
        "body": "500m sprint (E13): Garard won the 2024 Track and Field event and is our verified pick. Speed Snatch Triple (E15): Malheiros owns the closest ancestor, the 2021 1RM snatch win. Eight events left. Nothing is settled."
      }
    ]
  },
  {
    "id": "rookie-day2",
    "label": "Rookie Report - Day 2",
    "caption": "Day 2 and the rookie class already has three podiums - one of them earned on a foot that had no business letting her compete. Fish spent two days limping, sat dead last, then went out and threw down a 3rd place. Fowler got his first career podium. Hamming tied for 2nd on the sandbag and quietly put together one of the best rookie days I've seen. This is what showing up looks like. Full story on the blog.",
    "slides": [
      {
        "type": "cover",
        "kicker": "ROOKIE REPORT",
        "headline": "Day 2\nAt The Games",
        "sub": "Three podiums. One dead-last comeback. A day this class will be talking about for years."
      },
      {
        "type": "stat",
        "kicker": "DAY 2 BY THE NUMBERS",
        "headline": "The Rookies\nShowed Up",
        "stats": [
          {
            "big": "3",
            "label": "rookie podiums in one day"
          },
          {
            "big": "3rd",
            "label": "Fish, Handstand Sprint - on one foot"
          },
          {
            "big": "T-2nd",
            "label": "Hamming, Sandbag at 122 ft"
          },
          {
            "big": "1st",
            "label": "Noel wins her Snail heat on pure pacing IQ"
          }
        ]
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "THE COMEBACK",
        "headline": "Lydia Fish\nFinds The Podium",
        "body": "Lydia Fish has been limping for two days on a foot that had no business letting her compete. She came into the day sitting dead last overall. Then she walked out for the Handstand Sprint and put together a 2:36.49, good enough for 3rd place and a Games podium in her rookie season. Asked about the foot after, she just shrugged: this is just part of sport. That's the whole rookie class in one sentence.",
        "source": "CrossFit Games broadcast, Day 2"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "FIRST PODIUM, BEST DAY",
        "headline": "Fowler Breaks Through\nHamming Keeps Building",
        "body": "Ben Fowler of New Zealand went 3rd in the men's Handstand Sprint at 1:50.18, his first career podium. Dylan Hamming went one better on the Sandbag, tying for 2nd at 122 feet, exactly what the physics pointed to for a 98kg athlete with a 245 press. He'd already set the benchmark on Event 10 out of heat 1, unbroken every single set for 15:03.30, a time that held until the final heat and landed him 7th. Add a 10th on handstands and it's quietly one of the best rookie days at these Games.",
        "source": "CrossFit Games broadcast, Day 2"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "THE REST OF THE CLASS",
        "headline": "Pacing, Grit,\nAnd A Heat Win",
        "body": "Rachel Noel won heat 1 of the women's Snail on pure pacing IQ, taking a deliberate 30 seconds of rest between legless rope climbs while the field around her rushed. The broadcast praised her strategy. She's coached by Adrian Conway, a former collegiate soccer goalkeeper, and that kind of patience under pressure looked well coached. Bergros Bjornsdottir added a 4th on the women's sandbag, and 18-year-old Miley Wade kept grinding through a long day in the arena. This class isn't just talented. It's smart.",
        "source": "CrossFit Games broadcast, Day 2"
      },
      {
        "type": "cta",
        "headline": "More Rookies\nMore Stories",
        "body": "Fifteen rookies, one Games, and this is only Day 2. Follow along as this class keeps writing itself into Games history - full recap on the blog."
      }
    ]
  },
  {
    "id": "day2-toll",
    "label": "Day 2 Took Its Toll (and the swings)",
    "caption": "Day 2 asked hard questions on hurt legs, and a few athletes answered with some of the best moments of the weekend. One correction, straight from the source: Henrik Haapalainen says he is not racing hurt - his Achilles injury was about 20 months ago and he has fully recovered, which makes his Handstand Sprint 4th pure fitness, no asterisk. Lydia Fish had been limping on a Wednesday foot injury all day, then climbed the handstand course to a Games podium. Upside down, the foot doesn't matter.\n\nThe ankle trouble kept coming. Alexis Raptis competed on an ankle injury, plus a fall from the rope onto the mat on Event 8, and took 4th on the Handstand Sprint. Anikha Greer went on an injured ankle and took 5th. Add Fish's podium and the injured trio swept 3rd through 5th on the same event. Hannah Black shut down her Event 8 rope climbs early to protect the weekend, then came back the same day to take 2nd on the sandbag. Matilde Garnes looked spent on Event 10, walking the runs and time capped, the broadcast urging her to shut it down, then bounced back 5th on the hopper. Respect to every one of them.\n\nThen the swings that had nothing to do with injury. Ricky Garard led Event 10 unbroken, then one no-rep on his final round-3 rep sank it. James Sprague slipped on his final sandbag throw, went 16th, briefly lost the overall lead, then won it back within an event and defended it on the hopper with a clutch 4th. Dallin Pepper wore the leader jersey for exactly one event.\n\nAnd the answer-backs. Danielle Brandon's 3-straight handstand-event streak ended, outside the top 10 in her signature event, and ninety minutes later she answered with 3rd on the hopper. Lucy Campbell went 11th on the Snail, lost the overall 2nd, then turned around and won the hopper.\n\nThat's Day 2. Get hit, answer back. Injury notes per the Games broadcast coverage. Full recap and the live leaderboard are on the site.",
    "slides": [
      {
        "type": "cover",
        "kicker": "2026 CrossFit Games / Day 2",
        "headline": "DAY 2\nTOOK ITS TOLL",
        "sub": "Some raced hurt. Some got hit on the board. Some answered back within the hour. Swipe through it."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "Competed Hurt",
        "headline": "RACED HURT,\nCLIMBED ANYWAY",
        "body": "One correction, straight from the source: Henrik Haapalainen says he is not racing hurt - his Achilles injury was about 20 months ago and he has fully recovered, which makes his Handstand Sprint 4th pure fitness, no asterisk. Lydia Fish had been limping on a Wednesday foot injury all day, then climbed the handstand course to a Games podium. Upside down, the foot doesn't matter.",
        "source": "Correction per Henrik Haapalainen; Fish note per broadcast"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "The Ankle Trio",
        "headline": "3RD, 4TH, 5TH,\nSAME BAD ANKLES",
        "body": "Alexis Raptis competed on an ankle injury, plus a fall from the rope onto the mat on Event 8, and took 4th on the Handstand Sprint. Anikha Greer went on an injured ankle and took 5th. Add Fish's podium and the trio swept 3rd through 5th on the same event. Hannah Black shut down her Event 8 rope climbs early to protect the weekend, then came back to take 2nd on the sandbag. Matilde Garnes looked spent on Event 10, walking the runs and time capped, then bounced back 5th on the hopper.",
        "source": "Injury notes + broadcast coverage"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "Not An Injury",
        "headline": "ONE NO-REP,\nONE SLIP",
        "body": "Ricky Garard led Event 10 unbroken, then a single no-rep on his final round-3 rep sank the event. James Sprague slipped on his final sandbag throw for 16th and briefly lost the overall lead, then won it back within an event and defended it on the hopper with a clutch 4th. Dallin Pepper wore the leader jersey for exactly one event.",
        "source": "Official leaderboard"
      },
      {
        "type": "point",
        "num": 4,
        "kicker": "The Answer-Backs",
        "headline": "HIT. THEN\nANSWERED.",
        "body": "Danielle Brandon's 3-straight handstand-event streak ended, outside the top 10 in her signature event. Ninety minutes later she answered with 3rd on the hopper. Lucy Campbell went 11th on the Snail and lost the overall 2nd, then turned around and won the hopper. That is Day 2: get hit, answer back.",
        "source": "Official leaderboard"
      },
      {
        "type": "cta",
        "headline": "FULL DAY 2\nRECAP",
        "body": "Every injury note, every swing, and the full leaderboard after Day 2 are on the site."
      }
    ]
  },
  {
    "id": "day2-records",
    "label": "Day 2 Records & Firsts",
    "caption": "Day 2 of the Games gave us three first-time winners, three first-time podiums, and a piece of history that hasn't happened since 2007.\n\nVictor Hoffer put about 25 seconds on the field in the Handstand Sprint for his first career win. Abigail Domit won the women's sandbag throw at 108 feet - she threw it like a snatch, all power from the hips, while others kettlebell-swung it. Her line after: \"I do wish this event was 100 points, but it's not too late to change that, right?\" Paige Rodgers won the women's Handstand Sprint in 1:56.58, the same day she took 2nd on the Snail.\n\nThen the podiums. Lydia Fish took 3rd in the women's Handstand Sprint on a foot she's been limping on since Wednesday. She was dead last overall. \"This is just part of sport,\" she said. Ben Fowler grabbed his first career podium at 3rd in the men's Handstand Sprint. Dylan Hamming, our physics pick, tied for 2nd in the sandbag.\n\nAnd some athletes just don't stop. Mertens has 3 event wins this Games now, more than anyone in the field. Malheiros won the sandbag and took 2nd in the Handstand Sprint on the same day, his 6th career win. Campbell won the hopper for her 2nd win of these Games, and she already owns the 2022 pool swim too. Crouch and Lawson each won Event 10 for their 3rd career wins, and Khrennikov grabbed a 6th career win - then gave his first all-English victory interview. Some competitors just know how to show up when it counts.\n\nOh, and that hopper event. First time a hopper has drawn a Games event since 2007, and they used the original drum. The sandbag brought firsts of its own: the first 50-point event since 2016 and the first Games throw-for-distance since 2012.\n\nThis sport keeps giving us new names to remember. Who stood out to you on Day 2?",
    "slides": [
      {
        "type": "cover",
        "kicker": "GAMES 2026 - DAY 2",
        "headline": "RECORDS\n& FIRSTS",
        "sub": "Three first-time winners. Three first-time podiums. History made three times over."
      },
      {
        "type": "stat",
        "kicker": "BY THE NUMBERS",
        "headline": "A DAY OF\nFIRSTS",
        "stats": [
          {
            "big": "3",
            "label": "first career event wins"
          },
          {
            "big": "3",
            "label": "first career podiums"
          },
          {
            "big": "3",
            "label": "Mertens' wins this Games"
          },
          {
            "big": "2007",
            "label": "last Games hopper draw"
          }
        ],
        "footnote": "The hopper used Day 2 was the original 2007 drum. The sandbag was the first 50-point event since 2016 and the first Games throw-for-distance since 2012."
      },
      {
        "type": "point",
        "num": 1,
        "kicker": "FIRST CAREER WINS",
        "headline": "THREE NEW\nWINNERS",
        "body": "Victor Hoffer, the French ex-gymnast, put about 25 seconds on the field to win the Handstand Sprint - his first career win. Abigail Domit took the women's sandbag at 108 feet, throwing it like a snatch with power from the hips while others kettlebell-swung it. \"I do wish this event was 100 points, but it's not too late to change that, right?\" Paige Rodgers won the women's Handstand Sprint in 1:56.58 - the same day she took 2nd on the Snail.",
        "source": "Broadcast coverage + official leaderboard"
      },
      {
        "type": "point",
        "num": 2,
        "kicker": "FIRST CAREER PODIUMS",
        "headline": "PODIUM ON\nONE FOOT",
        "body": "Lydia Fish took 3rd in the women's Handstand Sprint on a foot she'd been limping on since Wednesday. She was dead last overall. \"This is just part of sport,\" she said after. Ben Fowler (NZ) earned his first career podium at 3rd in the men's Handstand Sprint. Dylan Hamming, our physics pick, tied for 2nd in the men's sandbag.",
        "source": "Broadcast coverage + official leaderboard"
      },
      {
        "type": "point",
        "num": 3,
        "kicker": "MULTIPLE ON THE DAY",
        "headline": "SOME ATHLETES\nDON'T STOP",
        "body": "Mertens now has 3 event wins this Games - squat, press, and the hopper - more than anyone else in the field. Malheiros won the sandbag and took 2nd in the Handstand Sprint on the same day, his 6th career win - fittingly, one of the earlier five came on the 2022 Sandbag Ladder. Campbell won the women's hopper in 5:02.48 for her 2nd win of these Games, after the swim - and she already owns the 2022 pool swim too. When it matters, she shows up. Crouch and Lawson each won Event 10 for 3rd career wins, and Khrennikov took his 6th - capped with his first all-English victory interview.",
        "source": "Broadcast coverage + official leaderboard"
      },
      {
        "type": "cta",
        "headline": "MORE FIRSTS\nCOMING",
        "body": "Day 2 rewrote some record books. Follow along as we track every win, every podium, every piece of history through the rest of these Games."
      }
    ]
  },
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
        { big: '10 to 1', label: "Cringle\'s climb from the opener to the lead" },
      ] },
      { type: 'point', num: 1, kicker: 'The Pivot', headline: 'THE SWIM\nDECIDED IT', body: "Both Day 1 leaders were made in the water. Lucy Campbell, a former international swimmer, won the women's Swim Standard by 69 seconds. Ty Jenkins, a three-time teen world champion, won the men's. The event flipped both boards - Crouch lost the men's lead, Campbell seized second - and proved again that swimming is the one CrossFit skill you cannot fake.", source: 'Official CrossFit Games leaderboard' },
      { type: 'point', num: 2, kicker: 'Friday - The Arena', headline: 'WHAT FRIDAY\nCHANGES', body: 'Day 1 gave 6 of 7 events to raw strength and raw engine. Friday opens the arena (Events 8-12), historically where the Games test the middle Day 1 skipped: high-skill gymnastics, barbell cycling, and mixed triplets under fatigue. The exact workouts are not announced yet (two are FloElite exclusives), but the modality math is clear - the specialists who feasted on Day 1 now face the tests they like least.', source: 'Broadcast schedule + Persistence Athletics model' },
      { type: 'point', num: 3, kicker: 'The Read', headline: 'WHO FRIDAY\nFAVORS', body: 'Watch the all-rounders sitting just off the lead. Men: Pepper and two-time champion Medeiros have the gymnastics and engine for arena couplets, and reigning champion Jayson Hopper - only 8th after a grinding Day 1 - historically climbs indoors. Women: Campbell, Adams and Lawson are built for skill-and-cycling. The Day 1 strength standouts, Mertens and Gazan, now have to defend. A modality read, not a result prediction.', source: 'Persistence Athletics model' },
      { type: 'cta', headline: 'THE FULL\nBREAKDOWN', body: 'Both Day 1 recap blogs, the live interactive leaderboard, and every event card are on the site. Day 2 is Friday - cards and the read the moment it starts.' },
    ],
  },
  {
    id: 'hopper-final',
    label: 'The Hopper 2026 - workout is SET',
    caption:
      "THE HOPPER WORKOUT IS SET. The barrel gave the movements this morning - the vote just gave the structure. Event 12, tonight's closer:\n\n3 ROUNDS FOR TIME\n21 toes-to-bars\n7 UNBROKEN power snatches\n7 UNBROKEN hang snatches\n7 UNBROKEN squat snatches\n95 lb men / 65 lb women. 6-MINUTE CAP.\n\nRead that again: UNBROKEN. Drop the bar on rep six and the set restarts. This is not a strength test - at 95/65 it's a discipline sprint. Sixty-three toes-to-bars frying your grip, then three snatch complexes your hands are not allowed to fail.\n\nThis is EXACTLY the scenario we mapped this morning: light and fast, Isabel-family. The reads from our almanac: Hatfield (won 2025's Running Isabel), Medeiros (the barbell cycler's cycler), and the toes-to-bar owners - Adams (won the 2022 T2B test), Garard, Khrennikov. And remember who won the only prior snatch+T2B combo at the Games: Jayson Hopper, 2024.\n\nThe stakes could not be bigger: the top FOUR men sit within 22 points (Sprague 664). Cringle\'s cushion is 88. Lead has changed twice today already. Six minutes, under the lights, on a workout that did not exist this morning.\n\nThe original hopper built this sport in 2007. Tonight it closes the loudest day of the 2026 Games. Full analysis on the site.",
    slides: [
      { type: 'cover', kicker: 'Event 12 - Tonight\'s Closer', headline: 'THE HOPPER\nIS SET', sub: 'The barrel gave the movements. The vote gave the structure. Six minutes, unbroken snatches, and a 7-point lead on the line. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Drawn Workout', headline: '3 ROUNDS.\n6 MINUTES.', body: '21 toes-to-bars, then 7 UNBROKEN power snatches, 7 UNBROKEN hang snatches, 7 UNBROKEN squat snatches. 95 lb men, 65 lb women, 6-minute cap. The unbroken rule is the event: drop the bar mid-set and the set restarts. Announced from the arena via Morning Chalk Up.', source: 'Hopper draw + fan vote (per Morning Chalk Up)' },
      { type: 'point', num: 2, kicker: 'What It Really Tests', headline: 'GRIP, THEN\nDISCIPLINE', body: 'Sixty-three total toes-to-bars torch the grip - and then the workout FORBIDS the grip from failing, three times per round, at snatch speed. At 95/65 nobody in this field misses these weights fresh. On fried forearms, in event five of the day, under arena lights? This is the sport\'s founding idea: fitness you cannot fake, drawn from a barrel.', source: 'Persistence Athletics analysis' },
      { type: 'stat', kicker: 'The Almanac Reads', headline: 'WHO FITS\nTHE DRAW', stats: [
        { big: '2:35', label: 'Hatfield\'s winning Running Isabel (2025) - light-snatch royalty' },
        { big: '1st', label: 'Hopper won the only prior snatch+T2B combo (2024)' },
        { big: '3', label: 'T2B event winners in this field: Adams, Garard, Khrennikov' },
        { big: '22 pts', label: 'covers the top FOUR men: Sprague 664, Medeiros, Crouch, Pepper' },
      ], footnote: 'Two lead changes today already. Cringle\'s cushion: 88. Six minutes settles Day 2.' },
      { type: 'cta', headline: 'CARDS AT\nTHE BUZZER', body: 'Results + updated boards the moment tonight\'s closer goes official. The barrel that built the sport in 2007 closes the loudest day of 2026. Link in bio.' },
    ],
  },
  {
    id: 'e8-snail-women',
    label: "E8 Climbing Snail - women's recap",
    caption:
      "THE GAZAN MASTERCLASS. Alex Gazan won the women's Climbing Snail in 4:55.22 - the only woman under five minutes - by 13.5 seconds. And here's the scary part: per the broadcast splits she was FASTEST ON EVERY SINGLE SECTION - the 400-lb Snail push, the legless climbs (20 seconds faster than anyone), the toes-to-bars, the rope climbs - and she still took a REST in the middle of her final push. Won going away.\n\nThat's her SECOND event win of these Games (press + Snail), and she's up to 5th overall. Her words after: 'My family means everything to me.' On coach Justin Cotler: 'He's believed in me since day one. No one cares more than him.' A year after injury took her out of the 2025 Games, the comeback is complete.\n\nBehind her: Paige Rodgers (5:08) won heat two by making up ALL her time on the rope climbs. Danielle Brandon (5:23) podiumed a day after her bike crash - road rash and all - in her 8th Games, with her signature handstand event still to come tonight.\n\nThe board: Cringle went 6th and her lead GREW to 58. And second place is now a ONE-POINT race - Campbell 480, Sturt 479.\n\nPlus the stat we owe you from Wednesday: Campbell's 10:55 swim beat EVERY MAN in the field (men's winner: 11:09, identical workout - we verified). Per the broadcast, just the 7th time in Games history a woman has topped a gender-neutral test outright.\n\nFull recap on the site. E9, the 3D Throw, is next.",
    slides: [
      { type: 'cover', kicker: 'Event 8 - Women', headline: 'THE GAZAN\nMASTERCLASS', sub: 'Fastest at everything. Rest included. Alex Gazan won the Snail by 13.5 seconds - her second win of the Games. Swipe.' },
      { type: 'movement', kicker: 'Event 8 - Official Results', headline: 'THE\nPODIUM', rows: [
        { rank: 1, name: 'Alex Gazan', pts: 100, delta: null },
        { rank: 2, name: 'Paige Rodgers', pts: 96, delta: null },
        { rank: 3, name: 'Danielle Brandon', pts: 92, delta: null },
        { rank: 4, name: 'Elisa Fuliano', pts: 88, delta: null },
        { rank: 5, name: 'Emma Lawson', pts: 84, delta: null },
      ], note: 'Times: 4:55.22 / 5:08.73 / 5:23.14 / 5:27.14 / 5:27.99. Gazan was the only woman under five minutes.' },
      { type: 'point', num: 1, kicker: 'How Dominant?', headline: 'FASTEST AT\nEVERYTHING', body: 'Per the broadcast splits: fastest opening Snail push, fastest legless rope climbs (by nearly 20 seconds), fastest toes-to-bars, fastest rope climbs - then a REST in the middle of her final push, and still a 13.5-second win. The booth called this workout her "wheelhouse home run pitch." Second event win of these Games. On coach Justin Cotler: "He\'s believed in me since day one. No one cares more than him."', source: 'Broadcast splits + official leaderboard' },
      { type: 'point', num: 2, kicker: 'The Stories Behind Her', headline: 'GRIT, ROPES\nAND ROOKIES', body: 'Rodgers won heat two by making up ALL her time on the four rope climbs - the smoothest rope work of the night. Brandon podiumed a day after her bike crash (road rash and all) in her 8th Games - with her three-peat handstand event still to come. And rookie Rachel Noel won heat one on pacing IQ: a deliberate 30-second rest between legless climbs while everyone else rushed.', source: 'Broadcast heat coverage' },
      { type: 'stat', kicker: 'The Board After 8', headline: 'ONE POINT\nFOR SECOND', stats: [
        { big: '58', label: 'Cringle\'s lead grew - she went 6th and gave up nothing' },
        { big: '1 pt', label: 'second place: Campbell 480, Sturt 479' },
        { big: '2', label: 'event wins for Gazan - now 5th overall' },
        { big: '10:55', label: 'the Wednesday stat: Campbell\'s swim beat EVERY man (11:09 won the men\'s)' },
      ], footnote: 'Campbell-beat-the-men verified against the official scores on an identical prescription. Per the broadcast, the 7th time ever a woman topped a gender-neutral Games test.' },
      { type: 'cta', headline: 'THE THROW\nIS NEXT', body: 'E9, the 3D Throw - the first Games throwing test in 14 years, and our physics picks are on record. Cards the moment it is official. Link in bio.' },
    ],
  },
  {
    id: 'e8-snail-men',
    label: "E8 Climbing Snail - men's recap",
    caption:
      "ROMAN'S ANSWER. The arena opened tonight and Roman Khrennikov conquered the Climbing Snail - by nearly a MINUTE. 5:27.60 on the official results board, ahead of Sprague (5:46) and Pepper (5:52). His 6th career Games event win (we verified: 2020 Row, 2022 Rinse N Repeat + Alpaca, 2023 Pig Chipper + Alpaca Redux, and now the Snail).\n\nHow it was won: the early heats produced two blueprints - Vellner went slow Snail / fast rope, Malheiros the reverse. Roman just did BOTH. Textbook rope climbing, heels tucked, and once he touched the last Snail push it was over. Hopper tried to pace off him at the rope and couldn't hold. Sprague passed Hopper mid-event - no win, but the overall lead is protected.\n\nAnd the moment of the night: his SIXTH winner's interview - but the FIRST ever entirely in English. 'It doesn't matter what place I have, you always support me.' Then he thanked his wife and son. After years of visa battles, that hits different.\n\nRemember when we called Mayhem's Day 1 their quietest in years? Roman just answered with 100 points.\n\nWomen are on the course next. Updated standings + movement the moment the official board posts. Full recap on the site.",
    slides: [
      { type: 'cover', kicker: 'Event 8 - Climbing Snail 26', headline: "ROMAN'S\nANSWER", sub: 'The arena opened and Khrennikov conquered it - by nearly a minute. His 6th career event win, and the night\'s best moment came after the race. Swipe.' },
      { type: 'movement', kicker: 'Event 8 - Official Results Board', headline: 'THE\nPODIUM', rows: [
        { rank: 1, name: 'Roman Khrennikov', pts: 100, delta: null },
        { rank: 2, name: 'James Sprague', pts: 96, delta: null },
        { rank: 3, name: 'Dallin Pepper', pts: 92, delta: null },
        { rank: 4, name: 'Jayson Hopper', pts: 88, delta: null },
        { rank: 5, name: 'Ricky Garard', pts: 84, delta: null },
      ], note: 'Times per the official results board: 5:27.60 / 5:46.03 / 5:52.12 / 6:00.48 / 6:09.03. Points shown are the standard scale; final standings post with the official leaderboard.' },
      { type: 'point', num: 1, kicker: 'How It Was Won', headline: 'TWO BLUEPRINTS.\nHE USED BOTH.', body: 'Heat one: Vellner won going slow on the Snail, fast on the rope. Heat two: Malheiros won doing the reverse. Heat three: Khrennikov did both - textbook foot-clamp rope climbing, heels under hips, then a Snail push nobody could answer. Hopper paced off him at the rope and could not hold. Sprague passed Hopper mid-event to protect the overall lead. All five fastest times came from the final heat.', source: 'Broadcast heat coverage' },
      { type: 'stat', kicker: 'The Numbers', headline: 'SIX WINS,\nONE FIRST', stats: [
        { big: '~1 min', label: 'his winning margin over the field' },
        { big: '6th', label: 'career Games event win (verified vs our almanac)' },
        { big: '1st', label: 'victory interview EVER delivered entirely in English' },
        { big: '100', label: 'points - Mayhem\'s answer to their quiet Day 1' },
      ], footnote: '"It doesn\'t matter what place I have, you always support me." Then he thanked his wife and son. After the visa years, that hits different.' },
      { type: 'cta', headline: 'STANDINGS\nNEXT', body: 'Updated overall board with movement arrows the moment the official leaderboard posts. The women take the same course next. Full recap on the site - link in bio.' },
    ],
  },
  {
    id: 'hopper-result',
    label: 'The Hopper Spoke (snatch + T2B)',
    caption:
      "THE BARREL SPOKE. At Opening Ceremonies this morning, the original 2007 hopper drum was spun live - and out came SNATCH and TOES-TO-BAR. One barbell movement, one gymnastics movement. Friday night's closer now has its ingredients.\n\nThe twist on the twist: the final workout structure is being decided by a VOTE. The field knows what they'll do tonight - not how much, how heavy, or in what shape.\n\nHere is what our almanac knows. The snatch has been tested 26 times at the Games (Amanda, Isabel, the max snatches). Toes-to-bar: 12 times. And the exact COMBINATION has happened once - the 2024 Dickies Triplet - won by JAYSON HOPPER. The reigning champ. In this field. Sitting 8th and needing a Friday. The barrel may have just dealt him his favorite hand.\n\nMore in-field receipts: Malheiros won the 2021 max snatch at 305 lb (and tomorrow is the Speed Snatch Triple - the snatchers just got a double-feature weekend). Hatfield won 2025's Running Isabel. Garard (2022) and Khrennikov (2023) have both WON toes-to-bar events, and Haley Adams owns the 2022 women's.\n\nThe vote decides everything: heavy = Malheiros country, fast and light = Isabel specialists, add running = the event Hopper already won. We publish the workout the moment it's official. Tonight, under the lights, the barrel gets its answer.",
    slides: [
      { type: 'cover', kicker: 'The Draw Is In', headline: 'SNATCH.\nTOES-TO-BAR.', sub: 'The original 2007 barrel spoke this morning: snatch + toes-to-bar, raced tonight. The workout itself? Being decided by a vote right now. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Twist On The Twist', headline: 'THE WORKOUT IS\nUP FOR A VOTE', body: 'The hopper gave the movements; a vote decides the structure before tonight\'s session. The field knows WHAT they will do - not how much, how heavy, or in what shape. Even after the draw, nobody can prepare. And it runs as the FINAL event of a five-event arena day, on fried grip.', source: 'Opening Ceremonies draw; workout pending official publication' },
      { type: 'stat', kicker: 'The Almanac Read', headline: 'THE BARREL DEALT\nHOPPER HIS HAND', stats: [
        { big: '1', label: 'prior Games event combined these movements: the 2024 Dickies Triplet' },
        { big: '1st', label: 'Jayson Hopper WON it - the reigning champ, sitting 8th tonight' },
        { big: '26', label: 'Games events have tested the snatch (Amanda, Isabel...)' },
        { big: '12', label: 'Games events have tested toes-to-bar' },
      ], footnote: 'All history from our verified Games Almanac, 2007-2026. The 2024 women\'s winner (Toomey) is not in the field - that title is open.' },
      { type: 'point', num: 2, kicker: 'The Receipts In This Field', headline: 'WHO OWNS THESE\nMOVEMENTS', body: 'Snatch: Malheiros won the 2021 max snatch outright at 305 lb - and with tomorrow\'s Speed Snatch Triple, the snatchers just got a double-feature weekend. Hatfield won 2025\'s Running Isabel (2:35). Toes-to-bar: Garard won the 2022 test, Khrennikov the 2023 Pig Chipper, and Haley Adams the 2022 women\'s - T2B volume has been her signature for years.', source: 'Persistence Athletics Games Almanac' },
      { type: 'point', num: 3, kicker: 'What The Vote Decides', headline: 'EVERYTHING\nIS THE VOTE', body: 'Heavy barbell: Malheiros-Mertens country. Light and fast, Isabel-style: Hatfield, Medeiros, the cyclers. High-volume toes-to-bar: Adams, Garard, Khrennikov. Add running and you recreate the exact event Hopper won in 2024. The unknown stays alive until the last moment - that is the whole point of the barrel.', source: 'Persistence Athletics analysis' },
      { type: 'cta', headline: 'THE MOMENT\nIT IS OFFICIAL', body: 'The full workout + final picks publish the second the vote closes. Tonight, under the lights, the barrel gets its answer. Link in bio.' },
    ],
  },
  {
    id: 'hopper-draw',
    label: 'The Hopper Draw (Friday closer)',
    caption:
      "The most CrossFit thing that will happen all weekend: on Friday morning, at Opening Ceremonies, they spin the ORIGINAL 2007 hopper drum - the actual barrel - live in front of the athletes. Whatever workout comes out, the individual field competes it THAT NIGHT as Friday's closer. Nobody has seen it. It does not exist yet.\n\nThe full-circle part gives me chills: the 2007 draw from this same drum produced the 1,000m row + pull-ups + push jerks test that opened THESE Games as Event 1 on Wednesday - Crouch and Sturt nearly halved the 2007 times. Now the barrel spins again.\n\nThis is the sport's founding idea made into an event. Unknown and unknowable. No pacing plans, no specialist prep. A hopper punishes the athlete with one great weapon and rewards the athlete with no bad ones.\n\nWho that favors, from the Day 1 data: Sprague (nothing worse than 6th outside the strength lifts), Pepper (climbed to 2nd without winning anything - the classic no-holes card), Medeiros (built two titles on this profile). And Cringle just won events in three different domains in ONE DAY - the best hopper resume imaginable. Campbell top-4 in four of seven.\n\nAnd remember: it runs LAST on Friday night, after four other events. The unknown, on empty tanks, under arena lights.\n\nWe publish the drawn workout the moment it is official, with the history of every movement that comes out. Full analysis on the blog.",
    slides: [
      { type: 'cover', kicker: 'Friday - Opening Ceremonies', headline: 'THE HOPPER\nDRAW RETURNS', sub: 'The original 2007 barrel gets spun Friday morning. Whatever comes out, the field competes it that night. Nobody has seen the workout. It does not exist yet. Swipe.' },
      { type: 'point', num: 1, kicker: 'How It Works', headline: 'DRAWN AT DAWN,\nRACED AT NIGHT', body: 'During Opening Ceremonies on Friday morning, a workout is drawn live from the ORIGINAL 2007 hopper drum, in front of the athletes and the crowd. The individual field competes the drawn test that same night as Friday\'s closer. Per the announcement it combines two modalities. Official event number pending.', source: 'CrossFit Games (official announcement)' },
      { type: 'point', num: 2, kicker: 'Full Circle, Twice', headline: 'THE BARREL THAT\nBUILT THE SPORT', body: 'In 2007 this same drum drew the 1,000m row + 25 pull-ups + 7 push jerks test that became one of the most iconic workouts in CrossFit - iconic enough that THESE Games opened with it as Event 1 on Wednesday, where Crouch (7:11) and Sturt (8:03) nearly halved the 2007 winning times. The Games opened with the last hopper\'s answer. Friday night runs its next question.', source: 'Persistence Athletics Games Almanac' },
      { type: 'stat', kicker: 'Who a Hopper Favors', headline: 'THE NO-HOLES\nATHLETES', stats: [
        { big: 'Top 6', label: 'Sprague\'s Day 1 floor outside the two strength lifts' },
        { big: '0 wins', label: 'Pepper climbed to 2nd without winning an event - pure balance' },
        { big: '3', label: 'domains Cringle won in ONE day: run, deadlift, bike' },
        { big: '4/7', label: 'events where Campbell was top four' },
      ], footnote: 'A hopper punishes one great weapon and rewards no bad ones. The specialists who bank on knowing the test should be nervous.' },
      { type: 'point', num: 3, kicker: 'The Kicker', headline: 'THE UNKNOWN,\nON EMPTY TANKS', body: 'The drawn workout runs LAST on Friday night - after the Snail, the throws, the hang cleans and the handstand course. Whatever comes out of the barrel lands on a field that has already raced four events that day. Unknown and unknowable, under arena lights, on fumes. That is as honest as this sport gets.', source: 'Broadcast schedule + Persistence Athletics analysis' },
      { type: 'cta', headline: 'THE MOMENT\nIT IS DRAWN', body: 'We publish the drawn workout the second it is official Friday morning - with the Games history of every movement that comes out of the barrel. Our almanac has all of it. Full analysis on the site now.' },
    ],
  },
  {
    id: 'day2-slate',
    label: 'Day 2 Slate (Friday preview)',
    caption:
      "FRIDAY JUST GOT LOADED. Three more arena events published tonight - four of Friday's five are now public. Here is the slate, with the history from our almanac.\n\nCLIMBING SNAIL 26: a 400-lb Snail push, legless rope climbs, 30 toes-to-bars, more rope climbs, another Snail push - all in a weight vest, 10-minute cap. The Snail is back for the first time since 2016, when Fikowski and Briggs won the original Climbing Snail. Grip survivors win this one.\n\nHANDSTAND SPRINT: a handstand walk course, 6-minute cap. The name is straight from 2020 (Fraser and Wells won that one). And here is the stat of the night: Danielle Brandon has won THREE straight handstand-walk events at the Games - 2021, 2022, 2023. Nobody owns this movement family like her. Nick Mathew won the 2022 medley on the men's side, and Crouch and Campbell won the handstand-heavy 2025 Grip Trip.\n\nRUN HANG SQUAT CLEAN: 4 rounds of a 660m run + 10 hang squat cleans at 225/155 on a short barbell. No Games precedent - pure engine-meets-barbell. Built for the athletes who scored at both poles on Day 1: Garard, Sprague, Cringle, Sturt.\n\nPlus the 3D THROW (full breakdown on the site) and ONE mystery event still unannounced.\n\nDay 1 tested the poles. Friday is the middle. This is where the 2026 Games take shape.",
    slides: [
      { type: 'cover', kicker: 'Just Announced - Friday July 24', headline: 'DAY 2\nIS LOADED', sub: 'Three more events published tonight. The Snail returns, a handstand sprint, heavy hang cleans - and one mystery left. Swipe the slate.' },
      { type: 'point', num: 1, kicker: 'The Snail Returns', headline: 'CLIMBING\nSNAIL 26', body: 'For time, 10-min cap, in a weight vest (22/16 lb): 400-lb Snail push (100 ft men / 60 ft women), legless rope climbs, 30 toes-to-bars, rope climbs, and a closing Snail push. First Snail since 2016, when Fikowski and Briggs won the original Climbing Snail. Grip and midline under load - the survivors win it.', source: 'Official workouts page + Games Almanac (2016)' },
      { type: 'point', num: 2, kicker: 'The Callback', headline: 'HANDSTAND\nSPRINT', body: 'A handstand walk course, 6-minute cap. The name comes straight from the 2020 Handstand Sprint (Fraser 1:20, Wells 1:21). Course layout not announced - but the history in this field is loud.', source: 'Official workouts page + Games Almanac (2020)' },
      { type: 'stat', kicker: 'The Receipts - Handstand Walking', headline: 'BRANDON\nOWNS THIS', stats: [
        { big: '3', label: 'straight handstand-walk event wins for Danielle Brandon (2021, 2022, 2023)' },
        { big: '1st', label: 'Nick Mathew, 2022 Skill Speed Medley' },
        { big: '2', label: 'Crouch AND Campbell won the handstand-heavy 2025 Grip Trip' },
        { big: '13th', label: 'Brandon after Day 1 - this is her springboard' },
      ], footnote: 'All results from our verified Games Almanac, 2007-2026. The Panchik family adds pedigree: brother Scott won the 2021 obstacle course.' },
      { type: 'point', num: 3, kicker: 'No Precedent', headline: 'RUN HANG\nSQUAT CLEAN', body: '4 rounds for time: 660-meter run, 10 hang squat cleans at 225 lb men / 155 lb women - on a short barbell (less whip, less forgiveness). No exact Games precedent. Pure engine-meets-barbell, built for the athletes who scored at both poles on Day 1: Garard, Sprague, Cringle, Sturt.', source: 'Official workouts page + Persistence Athletics model' },
      { type: 'point', num: 4, kicker: 'The Shape of Friday', headline: 'DAY 1 POLES,\nDAY 2 MIDDLE', body: 'Day 1 tested max strength and raw engine. Friday brings the middle we called: gymnastics skill, odd objects, barbell-engine blends, plus the 3D Throw (full breakdown on the site) and one unannounced event. Top 5 men within 32 points, Cringle up 38. This is where the Games take shape.', source: 'Persistence Athletics analysis' },
      { type: 'cta', headline: 'EVERY EVENT,\nBROKEN DOWN', body: 'The full Day 2 slate analysis, the 3D Throw deep dive, and the live board - all on the site. Cards the moment each event goes official.' },
    ],
  },
  {
    id: 'camp-wars-day1',
    label: 'Camp Wars (Day 1 standings)',
    caption:
      "Everyone keeps asking: which training camp is actually winning the 2026 Games? We verified every camp's 2026 roster against their own announcements, joined it to the official leaderboard, and did the math. Here it is after Day 1.\n\nBRUTE STRENGTH is running the Games. Twelve athletes, and they own BOTH overall leaders - James Sprague (418) on the men's side and Aimee Cringle (458, three event wins) on the women's. Add Pepper 2nd, Adams 4th, Lawson 5th, Wirz 7th, the reigning champ Hopper 8th - that is seven of twelve inside the top 10 and a 10.4 average placement across the whole squad.\n\nPRVN is the counterpunch: ten athletes, FIVE in the top 10 (Sturt 3rd, Crouch 4th, Garard 5th, Mertens and Turner 9th), and the most event wins of any camp - six, against Brute's four.\n\nMayhem: quiet day by their standards - Khrennikov 7th is the lone top-10, zero event wins. HWPO runs small but sharp: Gazan 6th with a press win, Vellner's 605 deadlift win at 36. TTT had a rough opener.\n\nAnd respect to the unaffiliated: Medeiros (3rd) and Campbell (2nd) are beating entire camps on their own, and self-coached Arielle Loewen sits 8th out of a garage gym in Texas.\n\nCamp rosters verified from each program's own 2026 announcements. Full standings on the site.",
    slides: [
      { type: 'cover', kicker: 'Everyone Is Asking', headline: 'WHICH CAMP\nIS WINNING?', sub: 'We verified every 2026 camp roster, joined it to the official board, and did the math. The camp standings after Day 1. Swipe.' },
      { type: 'stat', kicker: 'The Headline', headline: 'BRUTE OWNS\nBOTH LEADERS', stats: [
        { big: '2/2', label: 'both overall leaders are Brute: Sprague (M) + Cringle (W)' },
        { big: '7/12', label: 'Brute athletes inside the top 10' },
        { big: '6', label: 'event wins for PRVN - the most of any camp' },
        { big: '10.4', label: 'Brute average placement across 12 athletes' },
      ], footnote: 'Rosters verified against each camp\'s own 2026 announcements; standings from the official leaderboard after 7 events.' },
      { type: 'bars', kicker: 'The Camp Standings', headline: 'AVERAGE PLACEMENT\nAFTER DAY 1', bars: [
        { label: 'Brute Strength (12)', pct: 69, display: '10.4', color: '#91C640' },
        { label: 'PRVN Fitness (10)', pct: 62, display: '12.5', color: '#F4C64A' },
        { label: 'CrossFit Mayhem (5)', pct: 53, display: '15.2', color: '#60a5fa' },
        { label: 'HWPO Training (3)', pct: 43, display: '18.0', color: '#C9D2DA' },
        { label: 'Training Think Tank (3)', pct: 10, display: '28.0', color: 'rgba(244,246,242,0.4)' },
      ], footnote: 'Average overall placement of each camp\'s athletes, both divisions (lower is better; bar length = better). Camps with 2+ verified 2026 Games athletes.' },
      { type: 'movement', kicker: 'Brute Strength - 12 athletes', headline: 'THE BRUTE\nTAKEOVER', rows: [
        { rank: 1, name: 'James Sprague (M)', pts: 418, delta: null },
        { rank: 1, name: 'Aimee Cringle (W)', pts: 458, delta: null },
        { rank: 2, name: 'Dallin Pepper (M)', pts: 413, delta: null },
        { rank: 4, name: 'Haley Adams (W)', pts: 372, delta: null },
        { rank: 5, name: 'Emma Lawson (W)', pts: 364, delta: null },
        { rank: 7, name: 'Aline Wirz (W)', pts: 313, delta: null },
        { rank: 8, name: 'Jayson Hopper (M)', pts: 304, delta: null },
        { rank: 16, name: 'Ty Jenkins (M)', pts: 246, delta: null },
      ], note: 'Both overall leaders, the reigning men\'s champ, and the swim winner (Jenkins) - all one camp. Plus Ekai 18th, Wilkinson 18th, Cheverie 20th, Mathew 25th.' },
      { type: 'movement', kicker: 'PRVN Fitness - 10 athletes', headline: 'PRVN WINS\nTHE EVENTS', rows: [
        { rank: 3, name: 'Madeline Sturt (W)', pts: 407, delta: null },
        { rank: 4, name: 'Jay Crouch (M)', pts: 387, delta: null },
        { rank: 5, name: 'Ricky Garard (M)', pts: 386, delta: null },
        { rank: 9, name: 'Colten Mertens (M)', pts: 298, delta: null },
        { rank: 9, name: 'Ellie Turner (W)', pts: 288, delta: null },
        { rank: 13, name: 'Bayley Martin (M)', pts: 270, delta: null },
        { rank: 14, name: 'Kyra Milligan (W)', pts: 247, delta: null },
        { rank: 17, name: 'Olivia Kerstetter (W)', pts: 220, delta: null },
      ], note: 'Six event wins - the most of any camp: Sturt\'s Hopper, Crouch\'s Hopper, Garard\'s run, Mertens\' squat AND press, Milligan\'s squat. Plus Souza 24th, McGonigle 27th.' },
      { type: 'point', num: 1, kicker: 'The Rest of the Map', headline: 'MAYHEM QUIET,\nHWPO SHARP', body: 'CrossFit Mayhem (5 athletes): a quiet opener by Cookeville standards - Khrennikov 7th is the lone top-10 and the camp took zero event wins. HWPO Training runs a three-athlete squad with teeth: Gazan 6th with the shoulder press win and the women\'s Total record, and Vellner\'s 605 lb deadlift win at age 36. Training Think Tank\'s three women all sit 25th or below after a bruising Day 1.', source: 'Official leaderboard + camps\' own 2026 rosters' },
      { type: 'point', num: 2, kicker: 'No Camp, No Problem', headline: 'THE INDEPENDENTS\nARE FINE', body: 'Justin Medeiros (3rd) and Lucy Campbell (2nd) are beating entire camps without one. And the best story in this category: Arielle Loewen, who self-coaches out of her garage gym in Texas, sits 8th in the world. Fiebig (6th) rounds out an unaffiliated top-10 crowd.', source: 'Official leaderboard; camp status per 2026 sources' },
      { type: 'cta', headline: 'THE FULL\nCAMP MATH', body: 'Every camp, every athlete, every placing - plus the live board that updates all weekend. Link in bio.' },
    ],
  },
  {
    id: '3d-throw',
    label: '3D Throw (Friday preview)',
    caption:
      "Friday's opener is out, and it is the strangest test of the weekend: the 3D THROW. For total distance - one throw right, one throw left, one throw backward. 30 lb for the men, 20 for the women. Presented by Rogue. Implement and event number not announced yet.\n\nHere is why this is fascinating: the Games have not thrown ANYTHING for distance since 2012. The old Ball Toss was a backward throw with a 4 lb ball. Friday's load is more than seven times heavier. This is not accuracy - this is body mass times total-body power, in three directions. You cannot hide a weak side.\n\nThe physics reads: Jayson Hopper (100 kg, ex-college wide receiver - the one man whose sporting DNA is a ball in flight, and the reigning champ needs a Friday). Khrennikov, the heaviest man here at 103. Rookie Dylan Hamming, 98 kg with a 245 lb press. For the women: Hannah Black, the heaviest woman in the field at 82 kg and top-10 in all three lifts - a test built for her frame. Kerstetter. Gazan and her record-setting press.\n\nThe caveat: throwing is technique, nobody here trains it, and the 2012 toss was won by names nobody picked. Expect a surprise. A model read, not a result prediction.\n\nFull breakdown on the blog.",
    slides: [
      { type: 'cover', kicker: 'Friday July 24 - Just Announced', headline: '3D\nTHROW', sub: 'Three throws for total distance: right, left, backward. 30 lb men, 20 lb women. The Games have not thrown anything in 14 years. Swipe.' },
      { type: 'point', num: 1, kicker: 'The Test', headline: 'RIGHT. LEFT.\nBACKWARD.', body: 'For total distance: one throw to the right, one to the left, one backward. Men 30 lb, women 20 lb. Presented by Rogue. Total distance across all three throws means consistency beats one monster heave - you cannot hide a weak side. Implement and event number not yet announced.', source: 'Official CrossFit Games workouts page' },
      { type: 'point', num: 2, kicker: 'The History', headline: 'NOTHING THROWN\nSINCE 2012', body: 'Our almanac finds exactly two throwing tests in Games history: the 2011 softball throw and the 2012 GHD Ball Toss - a BACKWARD toss for distance, with 4 lb balls for the men. Friday is seven times heavier. And 2012 was won by Chad Mackay and Cheryl Brost, not the era\'s stars. Novelty tests scramble boards.', source: 'Persistence Athletics Games Almanac, 2007-2026' },
      { type: 'stat', kicker: 'The Physics Reads - Men', headline: 'MASS TIMES\nPOWER', stats: [
        { big: '100kg', label: 'Hopper - ex-college wide receiver, needs a Friday' },
        { big: '103kg', label: 'Khrennikov - heaviest man in the field, 4th in the press' },
        { big: '245', label: 'Hamming - rookie pressed 245 at 98 kg' },
        { big: '2 wins', label: 'Mertens owned the barbell, gives up mass at 86 kg' },
      ], footnote: 'Throwing heavy for distance rewards body mass and total-body power - the shot put recipe. Weights and Day 1 lifts verified.' },
      { type: 'stat', kicker: 'The Physics Reads - Women', headline: 'THE SNEAKY\nPICKS', stats: [
        { big: '82kg', label: 'Hannah Black - heaviest woman by 7 kg, top-10 in all 3 lifts' },
        { big: '4th', label: 'Kerstetter on the deadlift - the power profile fits' },
        { big: '170', label: 'Gazan won the press outright at 68 kg' },
        { big: '2012', label: 'the last throw produced winners nobody picked' },
      ], footnote: 'Black sits 29th after ankle trouble on Day 1 - a test built for her frame is exactly the reset she needs.' },
      { type: 'cta', headline: 'THE FULL\nBREAKDOWN', body: 'The complete physics read, the 2012 history, and every athlete angle - on the site now. Podium + updated board the moment it is official.' },
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
      "Day 1 at the Ranch asked a lot, and a few athletes answered it hurt. (First, a correction: BoxRox listed Henrik Haapalainen as racing on an Achilles - Henrik has since set the record straight himself: that injury was about 20 months ago, he has fully recovered, and he is not racing hurt.) Anika Greer went on an injured ankle. Rookie Hannah Black fought ankle trouble on the run, had no scored result on the bike, and sits 29th. Paige Rodgers battled her own ankle and still swam to 2nd. Those injury notes come from BoxRox's Day 1 recap, and respect to every one of them for staying in the fight.\n\nThen there is the other kind of Day 1 swing, the competitive one. Jay Crouch led the whole field after every event from 1 through 6, then a 19th-place swim dropped him to 4th. Healthy, just outswum. Colten Mertens won the squat and the press, took zero points on the bike at 21:48, and slid from 4th to 11th. No injuries there, just the leaderboard doing what it does.\n\nThat is the Games. One day, and the whole board rearranges. Full recap and the live leaderboard are on the site.",
    slides: [
      { type: 'cover', kicker: '2026 CrossFit Games / Day 1', headline: 'DAY 1\nTOOK A TOLL', sub: 'Some fell to injury, some fell on the board, and the two are not the same. Swipe through it.' },
      { type: 'point', num: 1, kicker: 'Correction', headline: 'NOT HURT.\nJUST BACK.', body: 'BoxRox listed Henrik Haapalainen as racing the Ranch on an Achilles injury, and we carried that note. Henrik has set the record straight himself: the injury was about 20 months ago and he has fully recovered. He is not racing hurt - he is all the way back, at the hardest Games venue there is.', source: 'Correction per Henrik Haapalainen, July 25' },
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
      "🏆 DAY 1 RECORDS & FIRSTS. The 2026 Games opener did not just move the leaderboard, it moved the record book.\n\nTHE HEAVIEST TOTALS: Colten Mertens posted a 1,380 lb CrossFit Total (555 squat / 260 press / 565 deadlift) and Alex Gazan a 920 lb Total (330 / 170 / 420) - both reported by BoxRox as new Games CrossFit Total records. Mertens won the squat AND the press; Gazan won the press outright.\n\nA FIRST: Ty Jenkins, 20, won the Swim Standard for the first event win of his career, ahead of two-time champion Justin Medeiros. Lucy Campbell was the only woman under 11 minutes in the pool.\n\nAND THE GRIT: Anika Greer competed on an injured ankle, and the trail run forced athletes to walk the steep climbs. (Correction: an earlier version also listed Henrik Haapalainen as racing on an Achilles - he has clarified he fully recovered from that injury about 20 months ago and is not racing hurt.)\n\nFull Day 1 breakdown at the link in bio.",
    slides: [
      { type: 'cover', kicker: 'Day 1 - Wed July 22', headline: 'RECORDS\n& FIRSTS', sub: 'The Games opener rewrote the record book and minted a brand-new event winner. The Day 1 superlatives. Swipe.' },
      { type: 'stat', kicker: 'The Record Book', headline: 'THE HEAVIEST\nTOTALS', stats: [
        { big: '1,380', label: "Colten Mertens' CrossFit Total (555 / 260 / 565)" },
        { big: '920', label: "Alex Gazan's CrossFit Total (330 / 170 / 420)" },
        { big: '2 wins', label: 'Mertens took the squat AND the press' },
        { big: '170', label: 'Gazan won the shoulder press outright' },
      ], footnote: 'BoxRox reports both as new Games CrossFit Total records. On Day 1, Mertens and Gazan owned the barbell.' },
      { type: 'point', num: 1, kicker: 'The Firsts', headline: 'A 20-YEAR-OLD\nWON A GAMES EVENT', body: "Ty Jenkins, 20, won the Swim Standard for the first individual event win of his career - ahead of two-time champion Justin Medeiros. On the women's side, Lucy Campbell was the only athlete to break 11 minutes in the pool (10:55), winning by 69 seconds. Swimming decided the day.", source: 'Official leaderboard + BoxRox' },
      { type: 'point', num: 2, kicker: 'The Grit', headline: 'THEY COMPETED\nHURT', body: 'Day 1 asked a brutal question and some answered it injured. Anika Greer competed on an injured ankle, and the steep trail run forced multiple athletes to walk sections of the climbs. The opener was as much about toughness as fitness. (Correction: Henrik Haapalainen, listed by BoxRox as racing on an Achilles, has clarified he fully recovered from that injury about 20 months ago.)', source: 'BoxRox Day 1 recap + athlete correction' },
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
  const lb = LIVE.leaderboard as typeof LIVE.leaderboard & { afterEventWomen?: number | null }
  // Divisions can settle at different times (e.g. one division's final event still under
  // official review) - a per-division override prevents mislabeling stale standings.
  const effectiveAfter = division === 'women' && lb.afterEventWomen !== undefined ? lb.afterEventWomen : afterNum
  const rows = (division === 'men' ? LIVE.leaderboard.men : LIVE.leaderboard.women).slice(0, 10)
  return (
    <div style={cardBg}>
      <CardHeader />
      <div style={{ padding: '30px 56px 0' }}>
        <div style={{ fontSize: 24, letterSpacing: 4, textTransform: 'uppercase', color: GREEN }}>Overall Standings{effectiveAfter ? ` · After Event ${effectiveAfter}` : ''}</div>
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
