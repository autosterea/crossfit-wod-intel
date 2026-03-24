import type { Workout } from '../types'

export interface ExtractedMovement {
  name: string
  count: number
  firstSeen: string
  lastSeen: string
  category: 'Weightlifting' | 'Gymnastics' | 'Monostructural' | 'Core' | 'Carry/Odd Object' | 'Olympic Lifting'
}

export const FULL_MOVEMENT_DICTIONARY: Record<string, string[]> = {
  'Pull-up': ['pull-up', 'pullup', 'pull up'],
  'Push-up': ['push-up', 'pushup', 'push up'],
  'Sit-up': ['sit-up', 'situp', 'sit up', 'abmat sit'],
  'Run': ['run ', 'running', 'mile'],
  'Row': ['row', 'rowing', 'rower'],
  'Bike': ['bike', 'assault bike', 'echo bike', 'airdyne'],
  'Swim': ['swim'],
  'Ski Erg': ['ski erg', 'ski-erg', 'skierg'],
  'Back Squat': ['back squat'],
  'Front Squat': ['front squat'],
  'Overhead Squat': ['overhead squat'],
  'Air Squat': ['air squat'],
  'Goblet Squat': ['goblet squat'],
  'Deadlift': ['deadlift'],
  'Sumo Deadlift High Pull': ['sumo deadlift', 'sdhp'],
  'Romanian Deadlift': ['romanian deadlift', 'rdl'],
  'Power Clean': ['power clean'],
  'Squat Clean': ['squat clean'],
  'Hang Clean': ['hang clean'],
  'Power Snatch': ['power snatch'],
  'Squat Snatch': ['squat snatch'],
  'Hang Snatch': ['hang snatch'],
  'Clean and Jerk': ['clean and jerk', 'clean & jerk'],
  'Push Press': ['push press'],
  'Push Jerk': ['push jerk'],
  'Split Jerk': ['split jerk'],
  'Shoulder Press': ['shoulder press', 'strict press', 'military press'],
  'Bench Press': ['bench press'],
  'Floor Press': ['floor press'],
  'Thruster': ['thruster'],
  'Wall Ball': ['wall ball', 'wallball'],
  'Kettlebell Swing': ['kettlebell swing', 'kb swing'],
  'Kettlebell (Other)': ['kettlebell'],
  'Dumbbell (General)': ['dumbbell', 'dumbell'],
  'Burpee': ['burpee'],
  'Box Jump': ['box jump'],
  'Box Step-up': ['box step', 'step-up'],
  'Muscle-up (Ring)': ['muscle-up', 'muscle up', 'muscleup'],
  'Bar Muscle-up': ['bar muscle-up', 'bar muscle up'],
  'Ring Dip': ['ring dip'],
  'Bar Dip': ['bar dip', 'dip'],
  'Handstand Push-up': ['handstand push-up', 'handstand pushup', 'hspu'],
  'Handstand Walk': ['handstand walk'],
  'Handstand Hold': ['handstand hold'],
  'Rope Climb': ['rope climb'],
  'Legless Rope Climb': ['legless rope', 'legless climb'],
  'Toes-to-Bar': ['toes-to-bar', 'toes to bar', 't2b'],
  'Knees-to-Elbow': ['knees-to-elbow', 'knees to elbow', 'k2e'],
  'Double-under': ['double-under', 'double under'],
  'Single-under': ['single-under', 'single under', 'jump rope'],
  'Pistol Squat': ['pistol'],
  'Lunge': ['lunge'],
  'Walking Lunge': ['walking lunge'],
  'GHD Sit-up': ['ghd sit'],
  'GHD Hip Extension': ['hip extension', 'back extension'],
  'L-sit': ['l-sit', 'l sit'],
  'Plank': ['plank'],
  'Hollow Rock': ['hollow rock', 'hollow hold', 'hollow body'],
  'V-up': ['v-up', 'v up'],
  'Turkish Get-up': ['turkish get-up', 'turkish getup', 'tgu'],
  'Good Morning': ['good morning'],
  'Wall Climb': ['wall climb', 'wall walk'],
  'Bear Crawl': ['bear crawl'],
  'Broad Jump': ['broad jump'],
  'Farmer Carry': ['farmer carry', 'farmers carry', 'farmer walk'],
  'Overhead Carry': ['overhead walk', 'overhead carry'],
  'Front Rack Carry': ['front rack carry', 'front rack walk'],
  'Sandbag': ['sandbag'],
  'Sled Push/Pull': ['sled', 'prowler'],
  'Tire Flip': ['tire flip'],
  'Pegboard': ['pegboard', 'peg board'],
  'Shuttle Run': ['shuttle run'],
  'Sprint': ['sprint'],
  'Sots Press': ['sots press', 'sotts press'],
  'Medicine Ball Clean': ['medicine ball clean', 'med ball clean'],
  'Ring Row': ['ring row'],
  'Deficit HSPU': ['deficit handstand', 'deficit hspu'],
  'Weighted Pull-up': ['weighted pull-up', 'weighted pullup'],
  'Kipping': ['kipping'],
}

const MOVEMENT_CATEGORIES: Record<string, ExtractedMovement['category']> = {
  // Monostructural
  'Run': 'Monostructural',
  'Row': 'Monostructural',
  'Bike': 'Monostructural',
  'Swim': 'Monostructural',
  'Ski Erg': 'Monostructural',
  'Double-under': 'Monostructural',
  'Single-under': 'Monostructural',
  'Shuttle Run': 'Monostructural',
  'Sprint': 'Monostructural',

  // Gymnastics
  'Pull-up': 'Gymnastics',
  'Push-up': 'Gymnastics',
  'Sit-up': 'Gymnastics',
  'Air Squat': 'Gymnastics',
  'Burpee': 'Gymnastics',
  'Box Jump': 'Gymnastics',
  'Box Step-up': 'Gymnastics',
  'Muscle-up (Ring)': 'Gymnastics',
  'Bar Muscle-up': 'Gymnastics',
  'Ring Dip': 'Gymnastics',
  'Bar Dip': 'Gymnastics',
  'Handstand Push-up': 'Gymnastics',
  'Handstand Walk': 'Gymnastics',
  'Handstand Hold': 'Gymnastics',
  'Rope Climb': 'Gymnastics',
  'Legless Rope Climb': 'Gymnastics',
  'Toes-to-Bar': 'Gymnastics',
  'Knees-to-Elbow': 'Gymnastics',
  'Pistol Squat': 'Gymnastics',
  'Lunge': 'Gymnastics',
  'Walking Lunge': 'Gymnastics',
  'Wall Climb': 'Gymnastics',
  'Bear Crawl': 'Gymnastics',
  'Broad Jump': 'Gymnastics',
  'Ring Row': 'Gymnastics',
  'Kipping': 'Gymnastics',
  'Weighted Pull-up': 'Gymnastics',
  'Pegboard': 'Gymnastics',
  'Deficit HSPU': 'Gymnastics',

  // Weightlifting
  'Back Squat': 'Weightlifting',
  'Front Squat': 'Weightlifting',
  'Overhead Squat': 'Weightlifting',
  'Goblet Squat': 'Weightlifting',
  'Deadlift': 'Weightlifting',
  'Romanian Deadlift': 'Weightlifting',
  'Push Press': 'Weightlifting',
  'Push Jerk': 'Weightlifting',
  'Split Jerk': 'Weightlifting',
  'Shoulder Press': 'Weightlifting',
  'Bench Press': 'Weightlifting',
  'Floor Press': 'Weightlifting',
  'Thruster': 'Weightlifting',
  'Wall Ball': 'Weightlifting',
  'Kettlebell Swing': 'Weightlifting',
  'Kettlebell (Other)': 'Weightlifting',
  'Dumbbell (General)': 'Weightlifting',
  'Sumo Deadlift High Pull': 'Weightlifting',
  'Good Morning': 'Weightlifting',
  'Sots Press': 'Weightlifting',
  'Medicine Ball Clean': 'Weightlifting',

  // Olympic Lifting
  'Power Clean': 'Olympic Lifting',
  'Squat Clean': 'Olympic Lifting',
  'Hang Clean': 'Olympic Lifting',
  'Power Snatch': 'Olympic Lifting',
  'Squat Snatch': 'Olympic Lifting',
  'Hang Snatch': 'Olympic Lifting',
  'Clean and Jerk': 'Olympic Lifting',

  // Core
  'GHD Sit-up': 'Core',
  'GHD Hip Extension': 'Core',
  'L-sit': 'Core',
  'Plank': 'Core',
  'Hollow Rock': 'Core',
  'V-up': 'Core',
  'Turkish Get-up': 'Core',

  // Carry/Odd Object
  'Farmer Carry': 'Carry/Odd Object',
  'Overhead Carry': 'Carry/Odd Object',
  'Front Rack Carry': 'Carry/Odd Object',
  'Sandbag': 'Carry/Odd Object',
  'Sled Push/Pull': 'Carry/Odd Object',
  'Tire Flip': 'Carry/Odd Object',
}

export function extractAllMovements(searchIndex: Workout[]): ExtractedMovement[] {
  const movementStats: Record<string, { count: number; firstSeen: string; lastSeen: string }> = {}

  // Initialize all movements
  for (const name of Object.keys(FULL_MOVEMENT_DICTIONARY)) {
    movementStats[name] = { count: 0, firstSeen: '9999-12-31', lastSeen: '0000-01-01' }
  }

  // Scan every workout
  for (const workout of searchIndex) {
    const text = (workout.s || '').toLowerCase()
    const date = workout.d || ''

    for (const [movementName, patterns] of Object.entries(FULL_MOVEMENT_DICTIONARY)) {
      const matched = patterns.some((pattern) => text.includes(pattern))
      if (matched) {
        const stats = movementStats[movementName]
        stats.count++
        if (date < stats.firstSeen) stats.firstSeen = date
        if (date > stats.lastSeen) stats.lastSeen = date
      }
    }
  }

  // Build result array, only include movements that were actually found
  const results: ExtractedMovement[] = []

  for (const [name, stats] of Object.entries(movementStats)) {
    if (stats.count > 0) {
      results.push({
        name,
        count: stats.count,
        firstSeen: stats.firstSeen,
        lastSeen: stats.lastSeen,
        category: MOVEMENT_CATEGORIES[name] || 'Gymnastics',
      })
    }
  }

  // Sort by count descending
  results.sort((a, b) => b.count - a.count)

  return results
}
