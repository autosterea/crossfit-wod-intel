#!/usr/bin/env node

/**
 * Reclassify existing WOD entries with the fixed classification logic.
 *
 * Re-runs movement detection, load profile, named WOD detection, and structure
 * classification on each entry's stored `s` text and updates fields when the
 * new result is more correct.
 *
 * Bugs being patched:
 *   - Load regex didn't accept hyphens: "105-lb" wouldn't match.
 *   - Named WOD detection grabbed names from article commentary
 *     (e.g. "Compare to 120515" => 5/26 marked as Murph from article body).
 *   - Hero structure missed "Today's Hero workout" / "honors X" phrasings.
 *
 * Usage:
 *   node scripts/reclassify.mjs            # update everything in place
 *   node scripts/reclassify.mjs --dry-run  # print what would change
 *   node scripts/reclassify.mjs --since 2026-01-01  # only entries on/after date
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataPath = join(__dirname, '..', 'src', 'data', 'crossfit-data.json')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const sinceIdx = args.indexOf('--since')
const sinceDate = sinceIdx >= 0 ? args[sinceIdx + 1] : null

// Same dictionaries as fetch-daily-wod.mjs (copied so this is standalone).
const MOVEMENT_DICT = {
  Run: ['run ', 'running', 'mile', '400m', '800m', '200m', '1,600m', '1600m', '400-m', '800-m', '200-m'],
  Row: ['row', 'rowing', 'rower'],
  Bike: ['bike', 'assault bike', 'echo bike'],
  PullUp: ['pull-up', 'pullup', 'pull up', 'chest-to-bar', 'chest to bar', 'c2b'],
  MuscleUp: ['muscle-up', 'muscle up', 'bar muscle', 'ring muscle'],
  HSPU: ['handstand push-up', 'handstand pushup', 'hspu'],
  HandstandWalk: ['handstand walk'],
  ToesToBar: ['toes-to-bar', 'toes to bar', 't2b'],
  RopeClimb: ['rope climb'],
  PistolSquat: ['pistol'],
  BoxJump: ['box jump', 'box-jump'],
  Burpee: ['burpee'],
  GHD: ['ghd'],
  DoubleUnders: ['double-under', 'double under', 'dbl under'],
  Clean: ['clean'],
  Snatch: ['snatch'],
  Deadlift: ['deadlift', 'dead lift'],
  BackSquat: ['back squat', 'back-squat'],
  FrontSquat: ['front squat', 'front-squat'],
  OverheadSquat: ['overhead squat', 'ohs'],
  ShoulderPress: ['shoulder press', 'strict press'],
  PushPress: ['push press', 'push-press'],
  PushJerk: ['push jerk', 'push-jerk'],
  SplitJerk: ['split jerk', 'jerk'],
  Thruster: ['thruster'],
  WallBall: ['wall ball', 'wallball', 'wall-ball'],
  KettlebellSwing: ['kettlebell swing', 'kb swing', 'kettlebell'],
  DumbbellWork: ['dumbbell', 'db '],
  Swim: ['swim'],
  SkiErg: ['ski erg', 'skierg', 'ski-erg'],
}

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
  'Meadows', 'Moore', 'Moose', 'Morrison',
  'Nick', 'Nutts', 'Omar', 'Paul', 'Pheezy', 'Rahoi', 'Ralph', 'Rankel',
  'Riley', 'Roney', 'RJ', 'Roy', 'Ryan', 'Santora', 'Santiago', 'Sham',
  'Ship', 'Small', 'Strange', 'Tully', 'Tom', 'Tommy V', 'Tumilson',
  'War Frank', 'Weston', 'White', 'Whitten', 'Wilmot', 'Wittman', 'Wood',
  'Zachary', 'Zeus',
]

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

const BENCHMARK_NAMES = new Set([
  'Fran', 'Grace', 'Helen', 'Diane', 'Elizabeth', 'Jackie', 'Annie',
  'Karen', 'Isabel', 'Nancy', 'Cindy', 'Chelsea', 'Mary', 'Amanda',
  'Angie', 'Barbara', 'Eva', 'Kelly', 'Linda', 'Lynne', 'Nicole',
  'Filthy Fifty', 'Fight Gone Bad', 'Bear Complex',
])

function detectMovements(text) {
  const lower = text.toLowerCase()
  const found = []
  for (const [movement, keywords] of Object.entries(MOVEMENT_DICT)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) { found.push(movement); break }
    }
  }
  return found
}

// Movement-signature checks for the most famous named WODs.
// Used as a fallback when the name isn't in the header so we can still
// recognise the real workout (e.g. Memorial Day Murph) without false-positive
// matching on names mentioned in the article body.
function detectBySignature(text) {
  const lower = text.toLowerCase()
  // Murph: 1-mile run, 100 pull-ups, 200 push-ups, 300 (air) squats
  if (/1[- ]?mile run/.test(lower) &&
      /100\s*pull[\s-]?ups?/.test(lower) &&
      /200\s*push[\s-]?ups?/.test(lower) &&
      /300\s*(?:air )?squats?/.test(lower)) return 'Murph'
  // Fran: 21-15-9 thrusters + pull-ups
  if (/21[-–]15[-–]9/.test(lower) && /thruster/.test(lower) && /pull[\s-]?up/.test(lower)) return 'Fran'
  // Helen: 3 rounds of 400m run, 21 KB swing, 12 pull-ups
  if (/3 rounds/.test(lower) && /400[ -]?m(?:eter)? run/.test(lower) && /(?:21|twenty[- ]one)\s*(?:kb|kettlebell)/.test(lower) && /12\s*pull/.test(lower)) return 'Helen'
  // Grace: 30 clean and jerk for time, 135/95
  if (/30\s*clean(?:\s*(?:and|&)\s*jerk)?/.test(lower) && /for time/.test(lower)) return 'Grace'
  // Diane: 21-15-9 deadlift + HSPU
  if (/21[-–]15[-–]9/.test(lower) && /deadlift/.test(lower) && /(?:handstand push|hspu)/.test(lower)) return 'Diane'
  // Annie: 50-40-30-20-10 double-unders + sit-ups
  if (/50[-–]40[-–]30[-–]20[-–]10/.test(lower) && /(?:double[- ]?unders|sit[- ]?ups)/.test(lower)) return 'Annie'
  // DT: 5 rounds of 12 DL + 9 hang power cleans + 6 push jerks
  if (/5 rounds/.test(lower) && /12\s*deadlift/.test(lower) && /9\s*hang power clean/.test(lower) && /6\s*push jerk/.test(lower)) return 'DT'
  // Cindy: 20-min AMRAP 5 pull-ups, 10 push-ups, 15 squats
  if (/20[- ]?min(?:ute)?/.test(lower) && /amrap/.test(lower) && /5\s*pull[\s-]?ups?/.test(lower) && /10\s*push[\s-]?ups?/.test(lower) && /15\s*(?:air )?squats?/.test(lower)) return 'Cindy'
  return ''
}

function detectNamedWod(text) {
  const headerLines = text.split('\n').slice(0, 5).join('\n')
  const header = headerLines.length < 250 ? headerLines : text.slice(0, 250)

  // 1. Quoted names in the header
  const quoted = header.match(/[""“”]([A-Z][a-zA-Z\s]+?)[""“”]/g)
  if (quoted) {
    for (const q of quoted) {
      const name = q.replace(/[""“”]/g, '').trim()
      if (NAMED_WODS.some(nw => nw.toLowerCase() === name.toLowerCase())) {
        return name
      }
    }
  }
  // 2. Name appears standalone in the header (workout title)
  for (const name of NAMED_WODS) {
    const regex = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (regex.test(header)) return name
  }
  // 3. Signature-based recognition for the famous ones (catches Murph etc.
  //    when the name only appears in article body)
  return detectBySignature(text)
}

function classifyStructure(text, namedWod) {
  const lower = text.toLowerCase()
  if (namedWod && HERO_NAMES.has(namedWod)) return 'Hero WOD'
  if (lower.includes('hero wod') ||
      lower.includes('in honor of') ||
      /today'?s? hero workout/i.test(lower) ||
      /honors\s+[a-z]+/i.test(lower)) return 'Hero WOD'
  if (namedWod && BENCHMARK_NAMES.has(namedWod)) return 'Benchmark'
  if (/\bamrap\b/i.test(lower) || /as many (?:rounds|reps)/i.test(lower)) return 'AMRAP'
  if (/\bemom\b/i.test(lower) || /every\s+\d+\s*min/i.test(lower)) return 'EMOM'
  if (/\btabata\b/i.test(lower)) return 'Tabata'
  if (/for time/i.test(lower) || /rounds for time/i.test(lower)) return 'For Time'
  if (/1[- ]?rm\b/i.test(lower) || /max\s*(effort\s*)?load/i.test(lower) || /find.*heavy/i.test(lower)) return 'Max Load / Strength'
  if (/max\s*reps/i.test(lower) && !(/amrap/i.test(lower))) return 'Max Load / Strength'
  if (/interval/i.test(lower)) return 'Interval'
  return 'Other'
}

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

  const weightMatches = lower.match(/(\d{2,3})[-\s]*(?:lb|pound|#)/g)
    || lower.match(/(\d{2,3})[-\s]*(?:kg|kilo)/g)

  if (weightMatches) {
    const weights = weightMatches.map(w => parseInt(w, 10)).filter(n => n > 0)
    const maxWeight = Math.max(...weights)
    if (hasBarbell) {
      if (maxWeight >= 225) return 'Heavy'
      if (maxWeight >= 135) return 'Moderate'
      if (maxWeight > 0) return 'Light'
    } else {
      if (maxWeight >= 70) return 'Heavy'
      if (maxWeight >= 35) return 'Moderate'
      if (maxWeight > 0) return 'Light'
    }
  }
  return 'Unknown'
}

// ---------------------------------------------------------------------------

const data = JSON.parse(readFileSync(dataPath, 'utf8'))

let lpFixed = 0, nwCleared = 0, ihFixed = 0, structFixed = 0
let total = 0
const changes = []

for (const w of data.searchIndex) {
  if (sinceDate && w.d < sinceDate) continue
  if (!w.s) continue
  total++

  const newMovements = detectMovements(w.s)
  const newNamed = detectNamedWod(w.s)
  const newStruct = classifyStructure(w.s, newNamed)
  const newLoad = classifyLoadProfile(w.s, newMovements.length ? newMovements : w.mv)
  const newIsHero = newNamed ? HERO_NAMES.has(newNamed) : (newStruct === 'Hero WOD')
  const newIsBench = newNamed ? BENCHMARK_NAMES.has(newNamed) : false

  const delta = []

  // 1. Fix load when old was Unknown and we now resolve a value
  if (w.lp === 'Unknown' && newLoad !== 'Unknown' && newLoad !== 'Bodyweight Only') {
    delta.push(`lp: ${w.lp} → ${newLoad}`)
    if (!dryRun) w.lp = newLoad
    lpFixed++
  }

  // 2. Clear named WOD if it no longer matches in header
  if (w.nw && w.nw !== newNamed) {
    delta.push(`nw: "${w.nw}" → "${newNamed}"`)
    if (!dryRun) {
      w.nw = newNamed
      // also re-derive hero/benchmark flags
      w.ih = newNamed ? HERO_NAMES.has(newNamed) : (w.s.toLowerCase().match(/today'?s? hero workout|in honor of|honors\s+[a-z]+/i) ? true : false)
      w.ib = newNamed ? BENCHMARK_NAMES.has(newNamed) : false
    }
    nwCleared++
  } else if (!w.ih && newIsHero && newStruct === 'Hero WOD') {
    // 3. Promote to Hero when text clearly says it but no name matched
    delta.push(`ih: false → true (via "in honor of" / "today's hero workout")`)
    if (!dryRun) {
      w.ih = true
      if (w.st !== 'Hero WOD') w.st = 'Hero WOD'
    }
    ihFixed++
  }

  if (delta.length) changes.push(`${w.d} | ${w.t}: ${delta.join(' | ')}`)
}

console.log(`Scanned ${total} entries${sinceDate ? ` (since ${sinceDate})` : ''}.`)
console.log(`  lp fixed:   ${lpFixed}`)
console.log(`  nw cleared: ${nwCleared}`)
console.log(`  ih fixed:   ${ihFixed}`)
console.log()
if (changes.length) {
  console.log('Changes:')
  for (const c of changes.slice(0, 80)) console.log('  ' + c)
  if (changes.length > 80) console.log(`  ... and ${changes.length - 80} more`)
}

if (!dryRun && changes.length) {
  writeFileSync(dataPath, JSON.stringify(data))
  console.log(`\nWrote ${changes.length} changes to ${dataPath}`)
} else if (dryRun) {
  console.log('\n(dry run — no file written)')
} else {
  console.log('\nNo changes needed.')
}
