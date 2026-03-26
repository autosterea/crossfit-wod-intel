#!/usr/bin/env node

/**
 * Fetch Daily WOD
 *
 * Fetches today's CrossFit Workout of the Day, classifies it, and appends it
 * to crossfit-data.json so the app stays current without a manual rebuild.
 *
 * Usage:
 *   node scripts/fetch-daily-wod.mjs            # fetch today
 *   node scripts/fetch-daily-wod.mjs 2026-03-25  # fetch a specific date
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const dataPath = join(__dirname, '..', 'src', 'data', 'crossfit-data.json')

// ---------------------------------------------------------------------------
// Date handling – accept an optional CLI arg (YYYY-MM-DD) or default to today
// ---------------------------------------------------------------------------
let today
if (process.argv[2]) {
  today = new Date(process.argv[2] + 'T12:00:00') // noon to avoid TZ issues
} else {
  today = new Date()
}

const year = today.getFullYear()
const month = String(today.getMonth() + 1).padStart(2, '0')
const day = String(today.getDate()).padStart(2, '0')
const dateStr = `${year}-${month}-${day}`

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayName = dayNames[today.getDay()]

console.log(`[fetch-daily-wod] Target date: ${dateStr} (${dayName})`)

// ---------------------------------------------------------------------------
// Movement dictionary
// ---------------------------------------------------------------------------
const MOVEMENT_DICT = {
  Run:            ['run ', 'running', 'mile', '400m', '800m', '200m', '1,600m', '1600m', '400-m', '800-m', '200-m'],
  Row:            ['row', 'rowing', 'rower'],
  Bike:           ['bike', 'assault bike', 'echo bike'],
  PullUp:         ['pull-up', 'pullup', 'pull up', 'chest-to-bar', 'chest to bar', 'c2b'],
  MuscleUp:       ['muscle-up', 'muscle up', 'bar muscle', 'ring muscle'],
  HSPU:           ['handstand push-up', 'handstand pushup', 'hspu'],
  HandstandWalk:  ['handstand walk'],
  ToesToBar:      ['toes-to-bar', 'toes to bar', 't2b'],
  RopeClimb:      ['rope climb'],
  PistolSquat:    ['pistol'],
  BoxJump:        ['box jump', 'box-jump'],
  Burpee:         ['burpee'],
  GHD:            ['ghd'],
  DoubleUnders:   ['double-under', 'double under', 'dbl under'],
  Clean:          ['clean'],
  Snatch:         ['snatch'],
  Deadlift:       ['deadlift', 'dead lift'],
  BackSquat:      ['back squat', 'back-squat'],
  FrontSquat:     ['front squat', 'front-squat'],
  OverheadSquat:  ['overhead squat', 'ohs'],
  ShoulderPress:  ['shoulder press', 'strict press'],
  PushPress:      ['push press', 'push-press'],
  PushJerk:       ['push jerk', 'push-jerk'],
  SplitJerk:      ['split jerk', 'jerk'],
  Thruster:       ['thruster'],
  WallBall:       ['wall ball', 'wallball', 'wall-ball'],
  KettlebellSwing:['kettlebell swing', 'kb swing', 'kettlebell'],
  DumbbellWork:   ['dumbbell', 'db '],
  Swim:           ['swim'],
  SkiErg:         ['ski erg', 'skierg', 'ski-erg'],
}

// Modality buckets
const MONO_M = new Set(['Run', 'Row', 'Bike', 'Swim', 'SkiErg', 'DoubleUnders'])
const MONO_G = new Set([
  'PullUp', 'MuscleUp', 'HSPU', 'HandstandWalk', 'ToesToBar',
  'RopeClimb', 'PistolSquat', 'BoxJump', 'Burpee', 'GHD',
])
// Everything else is W (weightlifting)

// Named WODs list (common hero / benchmark / girls)
const NAMED_WODS = [
  'Fran', 'Grace', 'Murph', 'Helen', 'Diane', 'Elizabeth', 'Jackie',
  'Annie', 'Karen', 'Isabel', 'Nancy', 'Cindy', 'Chelsea', 'Mary',
  'Amanda', 'Angie', 'Barbara', 'Eva', 'Kelly', 'Linda', 'Lynne', 'Nicole',
  'Filthy Fifty', 'Fight Gone Bad', 'DT', 'Bear Complex',
  'Nate', 'Randy', 'Josh', 'Daniel', 'Michael', 'Jason', 'Joshie',
  'Badger', 'Blake', 'Brehm', 'Brenton', 'Bull', 'Clovis', 'Danny',
  'Desforges', 'Donny', 'Dragon', 'Exo', 'Falkel', 'Forrest', 'Garrett',
  'Glen', 'Griff', 'Hamilton', 'Hansen', 'Helton', 'Holbrook', 'Hollywood',
  'Hotshots 19', 'Inca', 'Jack', 'Jerry', 'Jag 28', 'Jorge', 'Justin',
  'Klepto', 'Liam', 'Loredo', 'Luce', 'Manion', 'McCluskey', 'McGhee',
  'Meadows', 'Michael', 'Moore', 'Moose', 'Morrison', 'Murph', 'Nate',
  'Nick', 'Nutts', 'Omar', 'Paul', 'Pheezy', 'Rahoi', 'Ralph', 'Rankel',
  'Riley', 'Roney', 'RJ', 'Roy', 'Ryan', 'Santora', 'Santiago', 'Sham',
  'Ship', 'Small', 'Strange', 'Tully', 'Tom', 'Tommy V', 'Tumilson',
  'War Frank', 'Weston', 'White', 'Whitten', 'Wilmot', 'Wittman', 'Wood',
  'Zachary', 'Zeus',
]

// Hero WOD names (subset used for the ih flag)
const HERO_NAMES = new Set([
  'Murph', 'DT', 'Nate', 'Randy', 'Josh', 'Daniel', 'Michael', 'Jason',
  'Joshie', 'Badger', 'Blake', 'Brehm', 'Brenton', 'Bull', 'Clovis',
  'Danny', 'Desforges', 'Donny', 'Dragon', 'Exo', 'Falkel', 'Forrest',
  'Garrett', 'Glen', 'Griff', 'Hamilton', 'Hansen', 'Helton', 'Holbrook',
  'Hollywood', 'Hotshots 19', 'Inca', 'Jack', 'Jerry', 'Jag 28', 'Jorge',
  'Justin', 'Klepto', 'Liam', 'Loredo', 'Luce', 'Manion', 'McCluskey',
  'McGhee', 'Meadows', 'Moore', 'Moose', 'Morrison', 'Nick', 'Nutts',
  'Omar', 'Paul', 'Pheezy', 'Rahoi', 'Ralph', 'Rankel', 'Riley', 'Roney',
  'RJ', 'Roy', 'Ryan', 'Santora', 'Santiago', 'Sham', 'Ship', 'Small',
  'Strange', 'Tully', 'Tom', 'Tommy V', 'Tumilson', 'War Frank', 'Weston',
  'White', 'Whitten', 'Wilmot', 'Wittman', 'Wood', 'Zachary', 'Zeus',
])

// Benchmark / "girls" names
const BENCHMARK_NAMES = new Set([
  'Fran', 'Grace', 'Helen', 'Diane', 'Elizabeth', 'Jackie', 'Annie',
  'Karen', 'Isabel', 'Nancy', 'Cindy', 'Chelsea', 'Mary', 'Amanda',
  'Angie', 'Barbara', 'Eva', 'Kelly', 'Linda', 'Lynne', 'Nicole',
  'Filthy Fifty', 'Fight Gone Bad', 'Bear Complex',
])

// ---------------------------------------------------------------------------
// 1. Fetch the HTML
// ---------------------------------------------------------------------------
const url = `https://www.crossfit.com/workout/${year}/${month}/${day}`
console.log(`[fetch-daily-wod] Fetching ${url}`)

let html
try {
  const response = await fetch(url)
  if (!response.ok) {
    console.log(`[fetch-daily-wod] HTTP ${response.status} – no workout found for ${dateStr}. Exiting.`)
    process.exit(0)
  }
  html = await response.text()
} catch (err) {
  console.error(`[fetch-daily-wod] Network error: ${err.message}`)
  process.exit(0) // don't fail the Action
}

if (!html || html.length < 200) {
  console.log('[fetch-daily-wod] Empty or very short response – likely no WOD posted. Exiting.')
  process.exit(0)
}

// ---------------------------------------------------------------------------
// 2. Parse workout text from HTML
// ---------------------------------------------------------------------------

// Extract content from <article> tag first (clean, no comments)
let articleHtml = ''
const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
if (articleMatch) {
  articleHtml = articleMatch[1]
}

// Use article content if found, otherwise fall back to full page
let sourceHtml = articleHtml || html

// Strip script / style blocks
let cleaned = sourceHtml
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')

// Convert HTML to plain-ish text, preserving line breaks
let plainText = cleaned
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/div>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<\/h[1-6]>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

// Check for rest day
if (/rest\s*day/i.test(plainText) && plainText.length < 300) {
  console.log(`[fetch-daily-wod] ${dateStr} is a Rest Day. Skipping.`)
  process.exit(0)
}

/**
 * Try to isolate the actual workout section from the full-page text.
 *
 * Strategy: find the first line that looks like workout content (e.g.
 * "For time", "AMRAP", "EMOM", "rounds", rep numbers, etc.) and take
 * everything from that line until we hit a block of non-workout content
 * (like footer links, copyright, etc.).
 */
function extractWorkoutSection(text) {
  const lines = text.split('\n')

  // Markers that signal the start of workout content
  const startPatterns = [
    /for time/i, /rounds for time/i, /amrap/i, /emom/i, /tabata/i,
    /every\s+\d/i, /max.*reps/i, /max.*load/i, /1[- ]?rm/i,
    /rep scheme/i, /rounds? of/i, /sets? of/i,
    /^\d+[-–]\d+[-–]\d+/,      // rep schemes like 21-15-9
    /^\d+ rounds/i,
    /complete as many/i,
  ]

  // Markers that signal the end of the workout / start of comments/footer
  const endPatterns = [
    /©/i, /copyright/i, /all rights reserved/i,
    /privacy policy/i, /terms of use/i, /cookie/i,
    /sign up/i, /subscribe/i,
    /comments? on \d/i,         // "Comments on 260325"
    /log in to comment/i,
    /\d+ comments?$/i,          // "2 Comments"
    /^comment$/i,
    /sharecomment/i,
    /comment thread url/i,
    /comment url copied/i,
    /^about crossfit$/i,
    /find a gym/i,
    /what is crossfit/i,
    /get started/i,
    /open a crossfit gym/i,
    /the crossfit games/i,
    /learn the movement/i,
  ]

  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    for (const pat of startPatterns) {
      if (pat.test(line)) {
        startIdx = i
        break
      }
    }
    if (startIdx >= 0) break
  }

  if (startIdx < 0) {
    // Fallback: can't find a clear start – return everything from the first
    // non-trivial text block (skip short header-like lines)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().length > 30) {
        startIdx = i
        break
      }
    }
    if (startIdx < 0) return text // give up, return all
  }

  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    for (const pat of endPatterns) {
      if (pat.test(line)) {
        endIdx = i
        break
      }
    }
    if (endIdx !== lines.length) break
  }

  return lines.slice(startIdx, endIdx).join('\n').trim()
}

let workoutText = extractWorkoutSection(plainText)

if (!workoutText || workoutText.length < 10) {
  console.log('[fetch-daily-wod] Could not extract workout text – possibly a rest day. Exiting.')
  process.exit(0)
}

// Cap at a reasonable length for storage (matching existing data ~500 chars for `s`)
const workoutTextFull = workoutText // keep full version for todaysWod.wod_raw
console.log(`[fetch-daily-wod] Extracted workout text (${workoutText.length} chars)`)

// ---------------------------------------------------------------------------
// 3. Detect movements
// ---------------------------------------------------------------------------
function detectMovements(text) {
  const lower = text.toLowerCase()
  const found = []
  for (const [movement, keywords] of Object.entries(MOVEMENT_DICT)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        found.push(movement)
        break
      }
    }
  }
  return found
}

const detectedMovements = detectMovements(workoutText)
console.log(`[fetch-daily-wod] Movements: ${detectedMovements.join(', ') || '(none)'}`)

// ---------------------------------------------------------------------------
// 4. Classify modality
// ---------------------------------------------------------------------------
function classifyModality(movements) {
  let hasM = false, hasG = false, hasW = false
  for (const mv of movements) {
    if (MONO_M.has(mv)) hasM = true
    else if (MONO_G.has(mv)) hasG = true
    else hasW = true // anything not M or G is W
  }

  if (hasM && hasG && hasW) return 'MGW'
  if (hasM && hasG) return 'MG'
  if (hasM && hasW) return 'MW'
  if (hasG && hasW) return 'GW'
  if (hasM) return 'M'
  if (hasG) return 'G'
  if (hasW) return 'W'
  return 'Unknown'
}

const modality = classifyModality(detectedMovements)
console.log(`[fetch-daily-wod] Modality: ${modality}`)

// ---------------------------------------------------------------------------
// 5. Classify structure
// ---------------------------------------------------------------------------
function classifyStructure(text, namedWod) {
  const lower = text.toLowerCase()

  // Check for hero WOD first
  if (namedWod && HERO_NAMES.has(namedWod)) return 'Hero WOD'
  if (lower.includes('hero wod') || lower.includes('in honor of')) return 'Hero WOD'

  // Benchmark
  if (namedWod && BENCHMARK_NAMES.has(namedWod)) return 'Benchmark'

  // Specific structures
  if (/\bamrap\b/i.test(lower) || /as many (?:rounds|reps)/i.test(lower)) return 'AMRAP'
  if (/\bemom\b/i.test(lower) || /every\s+\d+\s*min/i.test(lower)) return 'EMOM'
  if (/\btabata\b/i.test(lower)) return 'Tabata'
  if (/for time/i.test(lower) || /rounds for time/i.test(lower)) return 'For Time'
  if (/1[- ]?rm\b/i.test(lower) || /max\s*(effort\s*)?load/i.test(lower) || /find.*heavy/i.test(lower)) return 'Max Load / Strength'
  if (/max\s*reps/i.test(lower) && !(/amrap/i.test(lower))) return 'Max Load / Strength'
  if (/interval/i.test(lower)) return 'Interval'

  return 'Other'
}

// ---------------------------------------------------------------------------
// 6. Detect named WOD
// ---------------------------------------------------------------------------
function detectNamedWod(text) {
  // Check for quoted names first (e.g. "Fran")
  const quoted = text.match(/[""\u201C\u201D]([A-Z][a-zA-Z\s]+?)[""\u201C\u201D]/g)
  if (quoted) {
    for (const q of quoted) {
      const name = q.replace(/[""\u201C\u201D]/g, '').trim()
      if (NAMED_WODS.some(nw => nw.toLowerCase() === name.toLowerCase())) {
        return name
      }
    }
  }

  // Check if any known name appears prominently (usually in a heading or bold)
  const lower = text.toLowerCase()
  for (const name of NAMED_WODS) {
    // Look for the name as a standalone word
    const regex = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (regex.test(text)) {
      return name
    }
  }

  return ''
}

const namedWod = detectNamedWod(workoutText)
const isHero = namedWod ? HERO_NAMES.has(namedWod) : false
const isBenchmark = namedWod ? BENCHMARK_NAMES.has(namedWod) : false

const structure = classifyStructure(workoutText, namedWod)
console.log(`[fetch-daily-wod] Structure: ${structure}`)
if (namedWod) console.log(`[fetch-daily-wod] Named WOD: ${namedWod} (hero=${isHero}, benchmark=${isBenchmark})`)

// ---------------------------------------------------------------------------
// 7. Classify time domain
// ---------------------------------------------------------------------------
function classifyTimeDomain(text, structure) {
  const lower = text.toLowerCase()

  // Strength / skill
  if (structure === 'Max Load / Strength') return 'Strength/Skill'
  if (/1[- ]?rm\b/i.test(lower)) return 'Strength/Skill'
  if (/max\s*(effort\s*)?load/i.test(lower) || /find.*heavy/i.test(lower)) return 'Strength/Skill'

  // Try to extract explicit time caps
  const timeCapMatch = lower.match(/(\d+)[- ]?min(?:ute)?s?\s*(?:time\s*cap|cap)/i)
    || lower.match(/amrap\s*(?:in\s*)?(\d+)/i)
    || lower.match(/(\d+)[- ]?min(?:ute)?s?\s*amrap/i)
    || lower.match(/every\s*(\d+)\s*min.*for\s*(\d+)/i) // EMOM X for Y

  let totalMinutes = null

  if (timeCapMatch) {
    totalMinutes = parseInt(timeCapMatch[1], 10)
    // For EMOM "every X min for Y sets", compute total
    if (timeCapMatch[2]) {
      totalMinutes = parseInt(timeCapMatch[1], 10) * parseInt(timeCapMatch[2], 10)
    }
  }

  // EMOM with "for N sets" and "every M minutes"
  if (totalMinutes === null) {
    const emomMatch = lower.match(/every\s+(\d+)\s*min\S*\s+for\s+(\d+)\s*(?:sets?|rounds?)/i)
    if (emomMatch) {
      totalMinutes = parseInt(emomMatch[1], 10) * parseInt(emomMatch[2], 10)
    }
  }

  // Tabata is always sprint
  if (structure === 'Tabata') return 'Sprint'

  if (totalMinutes !== null) {
    if (totalMinutes < 5) return 'Sprint'
    if (totalMinutes <= 10) return 'Short'
    if (totalMinutes <= 20) return 'Medium'
    return 'Long'
  }

  // Heuristic: look for round counts to estimate length
  const roundMatch = lower.match(/(\d+)\s*rounds?\s*for\s*time/i)
  if (roundMatch) {
    const rounds = parseInt(roundMatch[1], 10)
    if (rounds <= 2) return 'Short'
    if (rounds <= 4) return 'Medium'
    return 'Long'
  }

  // Sprint indicators
  if (/sprint/i.test(lower) || /max\s*effort/i.test(lower)) return 'Sprint'

  // 21-15-9 style tends to be short/medium
  if (/21[-–]15[-–]9/.test(lower)) return 'Short'

  // Default
  return 'Medium'
}

const timeDomain = classifyTimeDomain(workoutText, structure)
console.log(`[fetch-daily-wod] Time domain: ${timeDomain}`)

// ---------------------------------------------------------------------------
// 8. Classify load profile
// ---------------------------------------------------------------------------
function classifyLoadProfile(text, movements) {
  const lower = text.toLowerCase()

  const barbellMovements = new Set([
    'Clean', 'Snatch', 'Deadlift', 'BackSquat', 'FrontSquat',
    'OverheadSquat', 'ShoulderPress', 'PushPress', 'PushJerk',
    'SplitJerk', 'Thruster',
  ])
  const weightedMovements = new Set([
    ...barbellMovements, 'WallBall', 'KettlebellSwing', 'DumbbellWork',
  ])

  const hasWeighted = movements.some(m => weightedMovements.has(m))
  const hasBarbell = movements.some(m => barbellMovements.has(m))

  if (!hasWeighted) return 'Bodyweight Only'

  // Look for weight numbers to judge heaviness
  const weightMatches = lower.match(/(\d{2,3})\s*(?:lb|pound|#)/g)
    || lower.match(/(\d{2,3})\s*(?:kg|kilo)/g)

  if (weightMatches) {
    const weights = weightMatches.map(w => parseInt(w, 10)).filter(n => n > 0)
    const maxWeight = Math.max(...weights)

    if (hasBarbell) {
      if (maxWeight >= 225) return 'Heavy'
      if (maxWeight >= 135) return 'Moderate'
      if (maxWeight > 0) return 'Light'
    } else {
      // Dumbbell / KB
      if (maxWeight >= 70) return 'Heavy'
      if (maxWeight >= 35) return 'Moderate'
      if (maxWeight > 0) return 'Light'
    }
  }

  // If we know there's a weighted movement but can't determine load
  return 'Unknown'
}

const loadProfile = classifyLoadProfile(workoutText, detectedMovements)
console.log(`[fetch-daily-wod] Load profile: ${loadProfile}`)

// ---------------------------------------------------------------------------
// 9. Load existing data and check for duplicates
// ---------------------------------------------------------------------------
let data
try {
  data = JSON.parse(readFileSync(dataPath, 'utf8'))
} catch (err) {
  console.error(`[fetch-daily-wod] Failed to read data file: ${err.message}`)
  process.exit(1)
}

const exists = data.searchIndex.some(w => w.d === dateStr)
if (exists) {
  console.log(`[fetch-daily-wod] WOD for ${dateStr} already exists in searchIndex – skipping.`)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// 10. Build new entry and append
// ---------------------------------------------------------------------------
const titleCode = `${year.toString().slice(2)}${month}${day}`
const newWod = {
  d: dateStr,
  t: `${dayName} ${titleCode}`,
  s: workoutTextFull.substring(0, 500),
  mo: modality,
  st: structure,
  td: timeDomain,
  lp: loadProfile,
  nw: namedWod,
  ih: isHero,
  ib: isBenchmark,
  mv: detectedMovements,
}

data.searchIndex.push(newWod)

// ---------------------------------------------------------------------------
// 11. Update todaysWod
// ---------------------------------------------------------------------------
data.todaysWod = {
  date: dateStr,
  title: newWod.t,
  wod_raw: workoutTextFull,
  modality,
  structure,
  time_domain: timeDomain,
  load_profile: loadProfile,
  movements: detectedMovements,
  named_wod: namedWod,
}

// ---------------------------------------------------------------------------
// 12. Update overview stats
// ---------------------------------------------------------------------------
function incrementStat(obj, key) {
  obj[key] = (obj[key] || 0) + 1
}

const ov = data.overview
ov.total_workouts = data.searchIndex.length
ov.total_days = ov.total_days + 1

// Update date range
if (dateStr > ov.last_date) ov.last_date = dateStr
if (dateStr < ov.first_date) ov.first_date = dateStr

ov.years_covered = new Date(ov.last_date).getFullYear() - new Date(ov.first_date).getFullYear() + 1

// Modality
incrementStat(ov.modality, modality)

// Structure
incrementStat(ov.structure, structure)

// Time domain
incrementStat(ov.time_domain, timeDomain)

// Load profile
incrementStat(ov.load_profile, loadProfile)

// Movement frequency
for (const mv of detectedMovements) {
  incrementStat(ov.movement_frequency, mv)
}

// Named WOD counts
if (namedWod) ov.named_wod_count = (ov.named_wod_count || 0) + 1
if (isHero) ov.hero_wod_count = (ov.hero_wod_count || 0) + 1
if (isBenchmark) ov.benchmark_count = (ov.benchmark_count || 0) + 1

// Most common movement – recompute
const freqs = ov.movement_frequency
let maxMv = '', maxCount = 0
for (const [mv, count] of Object.entries(freqs)) {
  if (count > maxCount) {
    maxCount = count
    maxMv = mv
  }
}
ov.most_common_movement = maxMv

// ---------------------------------------------------------------------------
// 13. Update yearData
// ---------------------------------------------------------------------------
const yearStr = String(year)
if (!data.yearData[yearStr]) {
  data.yearData[yearStr] = {
    workout_count: 0,
    rest_count: 0,
    modality: {},
    structure: {},
    time_domain: {},
    load_profile: {},
    movement_frequency: {},
  }
}

const yd = data.yearData[yearStr]
yd.workout_count += 1
incrementStat(yd.modality, modality)
incrementStat(yd.structure, structure)
incrementStat(yd.time_domain, timeDomain)
incrementStat(yd.load_profile, loadProfile)
for (const mv of detectedMovements) {
  incrementStat(yd.movement_frequency, mv)
}

// ---------------------------------------------------------------------------
// 14. Update dowData (day-of-week stats)
// ---------------------------------------------------------------------------
if (data.dowData && data.dowData[dayName]) {
  const dow = data.dowData[dayName]
  dow.workout_count = (dow.workout_count || 0) + 1
  if (dow.modality) incrementStat(dow.modality, modality)
  if (dow.structure) incrementStat(dow.structure, structure)
  if (dow.time_domain) incrementStat(dow.time_domain, timeDomain)
}

// ---------------------------------------------------------------------------
// 15. Write back
// ---------------------------------------------------------------------------
try {
  writeFileSync(dataPath, JSON.stringify(data))
  console.log(`[fetch-daily-wod] Successfully added WOD for ${dateStr}:`)
  console.log(`  Structure   : ${structure}`)
  console.log(`  Modality    : ${modality}`)
  console.log(`  Time domain : ${timeDomain}`)
  console.log(`  Load profile: ${loadProfile}`)
  console.log(`  Movements   : ${detectedMovements.join(', ')}`)
  if (namedWod) console.log(`  Named WOD   : ${namedWod}`)
  console.log(`  Total WODs  : ${data.searchIndex.length}`)
} catch (err) {
  console.error(`[fetch-daily-wod] Failed to write data file: ${err.message}`)
  process.exit(1)
}
