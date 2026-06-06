#!/usr/bin/env node
// Build the CrossFit Games bundle: app/src/data/games/raw/<year>.json -> app/src/data/games-data.json
// Usage: node scripts/build-games-data.mjs [--check]
//   --check  validate raw files + report unmapped movements, don't write output

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW_DIR = join(__dirname, '..', 'src', 'data', 'games', 'raw')
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'games-data.json')
const CHECK_ONLY = process.argv.includes('--check')

// ---------------------------------------------------------------------------
// Movement normalization
// Canonical Games movement IDs are finer-grained than the daily-WOD dictionary
// (Chest-to-Bar vs Pull-Up, Ring vs Bar Muscle-Up) but each maps to a daily-WOD
// `wodId` where one exists, for cross-linking with the main app.
// ---------------------------------------------------------------------------

/** id -> { display, wodId } */
const MOVEMENTS = {
  // Monostructural
  Run: { display: 'Run', wodId: 'Run' },
  Swim: { display: 'Swim', wodId: 'Swim' },
  Row: { display: 'Row', wodId: 'Row' },
  Bike: { display: 'Bike (Air/Echo)', wodId: 'Bike' },
  RoadBike: { display: 'Road Bike', wodId: 'Bike' },
  SkiErg: { display: 'Ski Erg', wodId: 'SkiErg' },
  Paddle: { display: 'Paddle', wodId: null },
  Kayak: { display: 'Kayak', wodId: null },
  Ruck: { display: 'Ruck', wodId: null },
  DoubleUnders: { display: 'Double-Unders', wodId: 'DoubleUnders' },
  TripleUnders: { display: 'Triple-Unders', wodId: 'DoubleUnders' },
  SingleUnders: { display: 'Single-Unders', wodId: 'JumpRope' },
  CrossoverSingles: { display: 'Crossover Singles', wodId: 'JumpRope' },
  // Gymnastics
  PullUp: { display: 'Pull-Up', wodId: 'PullUp' },
  ChestToBar: { display: 'Chest-to-Bar Pull-Up', wodId: 'PullUp' },
  BarMuscleUp: { display: 'Bar Muscle-Up', wodId: 'MuscleUp' },
  RingMuscleUp: { display: 'Ring Muscle-Up', wodId: 'MuscleUp' },
  HSPU: { display: 'Handstand Push-Up', wodId: 'HSPU' },
  HandstandWalk: { display: 'Handstand Walk', wodId: 'HandstandWalk' },
  HandstandHold: { display: 'Handstand Hold', wodId: 'HandstandHold' },
  ToesToBar: { display: 'Toes-to-Bar', wodId: 'ToesToBar' },
  KneesToElbows: { display: 'Knees-to-Elbows', wodId: 'KneesToElbows' },
  RopeClimb: { display: 'Rope Climb', wodId: 'RopeClimb' },
  LeglessRopeClimb: { display: 'Legless Rope Climb', wodId: 'RopeClimb' },
  Pegboard: { display: 'Pegboard Ascent', wodId: null },
  RingDip: { display: 'Ring Dip', wodId: 'Dip' },
  Dip: { display: 'Dip', wodId: 'Dip' },
  PushUp: { display: 'Push-Up', wodId: 'PushUp' },
  RingPushUp: { display: 'Ring Push-Up', wodId: 'PushUp' },
  Burpee: { display: 'Burpee', wodId: 'Burpee' },
  BurpeeBoxJumpOver: { display: 'Burpee Box Jump-Over', wodId: 'Burpee' },
  BarFacingBurpee: { display: 'Bar-Facing Burpee', wodId: 'Burpee' },
  BurpeeOverBar: { display: 'Burpee Over Bar', wodId: 'Burpee' },
  BoxJump: { display: 'Box Jump', wodId: 'BoxJump' },
  BoxJumpOver: { display: 'Box Jump-Over', wodId: 'BoxJump' },
  BoxStepUp: { display: 'Box Step-Up', wodId: 'BoxJump' },
  GHDSitUp: { display: 'GHD Sit-Up', wodId: 'GHD' },
  HipExtension: { display: 'Hip/Back Extension', wodId: 'BackExtension' },
  SitUp: { display: 'Sit-Up', wodId: 'SitUp' },
  VSit: { display: 'V-Sit', wodId: 'SitUp' },
  LSit: { display: 'L-Sit', wodId: 'LSit' },
  PistolSquat: { display: 'Pistol Squat', wodId: 'PistolSquat' },
  AirSquat: { display: 'Air Squat', wodId: 'AirSquat' },
  Lunge: { display: 'Lunge', wodId: 'Lunge' },
  OverheadLunge: { display: 'Overhead Lunge', wodId: 'Lunge' },
  WallWalk: { display: 'Wall Walk', wodId: 'WallWalk' },
  RingHSPU: { display: 'Ring Handstand Push-Up', wodId: 'HSPU' },
  Rollover: { display: 'Ring/Bar Rollover', wodId: null },
  MonkeyBars: { display: 'Monkey Bars', wodId: null },
  ObstacleCourse: { display: 'Obstacle Course', wodId: null },
  BroadJump: { display: 'Broad Jump', wodId: null },
  Sprint: { display: 'Sprint', wodId: 'Run' },
  Shuttle: { display: 'Shuttle Run', wodId: 'Run' },
  Climb: { display: 'Wall/Net Climb', wodId: null },
  // Weightlifting — barbell
  Snatch: { display: 'Snatch', wodId: 'Snatch' },
  Clean: { display: 'Clean', wodId: 'Clean' },
  CleanAndJerk: { display: 'Clean & Jerk', wodId: 'Clean' },
  Jerk: { display: 'Jerk', wodId: 'PushJerk' },
  SplitJerk: { display: 'Split Jerk', wodId: 'SplitJerk' },
  Deadlift: { display: 'Deadlift', wodId: 'Deadlift' },
  SumoDeadliftHighPull: { display: 'Sumo Deadlift High Pull', wodId: 'Deadlift' },
  BackSquat: { display: 'Back Squat', wodId: 'BackSquat' },
  FrontSquat: { display: 'Front Squat', wodId: 'FrontSquat' },
  OverheadSquat: { display: 'Overhead Squat', wodId: 'OverheadSquat' },
  Thruster: { display: 'Thruster', wodId: 'Thruster' },
  ShoulderPress: { display: 'Shoulder Press', wodId: 'ShoulderPress' },
  PushPress: { display: 'Push Press', wodId: 'PushPress' },
  BenchPress: { display: 'Bench Press', wodId: null },
  ShoulderToOverhead: { display: 'Shoulder-to-Overhead', wodId: 'PushJerk' },
  GroundToOverhead: { display: 'Ground-to-Overhead', wodId: 'GroundToOverhead' },
  OverheadWalk: { display: 'Overhead Carry', wodId: null },
  CrossFitTotal: { display: 'CrossFit Total', wodId: null },
  // Weightlifting — implements
  WallBall: { display: 'Wall-Ball Shot', wodId: 'WallBall' },
  MedBallClean: { display: 'Medicine-Ball Clean', wodId: 'WallBall' },
  KettlebellSwing: { display: 'Kettlebell Swing', wodId: 'KettlebellSwing' },
  KettlebellSnatch: { display: 'Kettlebell Snatch', wodId: 'KettlebellSwing' },
  KettlebellClean: { display: 'Kettlebell Clean', wodId: 'KettlebellSwing' },
  KettlebellDeadlift: { display: 'Kettlebell Deadlift', wodId: 'Deadlift' },
  KettlebellThruster: { display: 'Kettlebell Thruster', wodId: 'Thruster' },
  DumbbellSnatch: { display: 'Dumbbell Snatch', wodId: 'DumbbellWork' },
  DumbbellThruster: { display: 'Dumbbell Thruster', wodId: 'DumbbellWork' },
  DumbbellClean: { display: 'Dumbbell Clean', wodId: 'DumbbellWork' },
  DumbbellLunge: { display: 'Dumbbell Lunge', wodId: 'DumbbellWork' },
  DumbbellShoulderToOverhead: { display: 'Dumbbell Shoulder-to-Overhead', wodId: 'DumbbellWork' },
  DumbbellBoxStepOver: { display: 'Dumbbell Box Step-Over', wodId: 'DumbbellWork' },
  DumbbellDeadlift: { display: 'Dumbbell Deadlift', wodId: 'DumbbellWork' },
  // Strongman / odd object
  SledPush: { display: 'Sled Push', wodId: null },
  SledPull: { display: 'Sled Pull/Drag', wodId: null },
  Yoke: { display: 'Yoke Carry', wodId: null },
  FarmersCarry: { display: "Farmers' Carry", wodId: null },
  Husafell: { display: 'Husafell Carry', wodId: null },
  AtlasStone: { display: 'Atlas Stone', wodId: null },
  StoneToShoulder: { display: 'Stone-to-Shoulder', wodId: null },
  Sandbag: { display: 'Sandbag Carry', wodId: null },
  SandbagClean: { display: 'Sandbag Clean', wodId: null },
  SandbagToShoulder: { display: 'Sandbag-to-Shoulder', wodId: null },
  LogLift: { display: 'Log Lift/Clean', wodId: null },
  AxleBar: { display: 'Axle Bar Lift', wodId: null },
  TireFlip: { display: 'Tire Flip', wodId: null },
  KegLift: { display: 'Keg Lift', wodId: null },
  Banger: { display: 'Banger', wodId: null },
  SledgeHammer: { display: 'Sledgehammer', wodId: null },
  BobSled: { display: 'Bob Sled', wodId: null },
  Wheelbarrow: { display: 'Wheelbarrow', wodId: null },
  PigFlip: { display: 'Pig Flip', wodId: null },
  TorqueTankPush: { display: 'Torque Tank Push', wodId: null },
  BurdenCarry: { display: 'Odd-Object Carry', wodId: null },
  JerryCan: { display: 'Jerry-Can Carry', wodId: null },
  // Skill / throwing
  SoftballThrow: { display: 'Softball Throw', wodId: null },
  Javelin: { display: 'Javelin Throw', wodId: null },
  Slackline: { display: 'Slackline', wodId: null },
  SkillSpeedLadder: { display: 'Skill Speed Ladder', wodId: null },
  MemoryDrill: { display: 'Memory/Skill Drill', wodId: null },
  // Games one-offs (the lore)
  StairClimb: { display: 'Stadium Stair Climb', wodId: 'Run' },
  HurdleJump: { display: 'Hurdle Jump', wodId: null },
  WallOver: { display: 'Wall Over', wodId: null },
  GHDBallThrow: { display: 'GHD Medicine-Ball Throw', wodId: 'GHD' },
  SnailPush: { display: 'Snail Push', wodId: null },
  PlowDrag: { display: 'Plow Drag', wodId: null },
  DBallClean: { display: 'D-Ball Clean', wodId: null },
  HayBaleClean: { display: 'Hay-Bale Clean', wodId: null },
  RescueRandy: { display: 'Rescue Randy Drag', wodId: null },
  TumblerPull: { display: 'Tumbler Pull', wodId: null },
  BallSlam: { display: 'Ball Slam', wodId: null },
  ParallelBarTraverse: { display: 'Parallel-Bar Traverse', wodId: null },
  DumbbellOverheadSquat: { display: 'Dumbbell Overhead Squat', wodId: 'DumbbellWork' },
  KettlebellShoulderToOverhead: { display: 'Kettlebell Shoulder-to-Overhead', wodId: null },
  SandbagSquat: { display: 'Sandbag Squat', wodId: null },
}

/** cleaned-string -> canonical ID. Keys: lowercase alnum+spaces, collapsed. */
const SYNONYMS = {
  // mono
  'run': 'Run', 'running': 'Run', 'trail run': 'Run', 'beach run': 'Run', 'hill run': 'Run',
  'sprint': 'Sprint', 'sprints': 'Sprint', 'shuttle run': 'Shuttle', 'shuttle sprint': 'Shuttle', 'shuttle sprints': 'Shuttle',
  'swim': 'Swim', 'swimming': 'Swim', 'ocean swim': 'Swim', 'lake swim': 'Swim', 'pool swim': 'Swim',
  'row': 'Row', 'rowing': 'Row', 'concept2 row': 'Row', 'c2 row': 'Row', 'marathon row': 'Row',
  'bike': 'Bike', 'assault bike': 'Bike', 'echo bike': 'Bike', 'air bike': 'Bike', 'airbike': 'Bike', 'bike erg': 'Bike', 'bikeerg': 'Bike', 'stationary bike': 'Bike',
  'road bike': 'RoadBike', 'cycling': 'RoadBike', 'bicycle': 'RoadBike', 'criterium': 'RoadBike', 'mountain bike': 'RoadBike', 'cyclocross': 'RoadBike', 'bmx': 'RoadBike',
  'ski erg': 'SkiErg', 'skierg': 'SkiErg', 'ski': 'SkiErg',
  'paddle': 'Paddle', 'paddleboard': 'Paddle', 'paddle board': 'Paddle', 'stand up paddle': 'Paddle', 'sup': 'Paddle', 'prone paddle': 'Paddle', 'paddling': 'Paddle',
  'kayak': 'Kayak', 'kayaking': 'Kayak',
  'ruck': 'Ruck', 'ruck run': 'Ruck', 'rucksack run': 'Ruck', 'ruck march': 'Ruck',
  'double under': 'DoubleUnders', 'double unders': 'DoubleUnders', 'du': 'DoubleUnders', 'dus': 'DoubleUnders',
  'triple under': 'TripleUnders', 'triple unders': 'TripleUnders',
  'single under': 'SingleUnders', 'single unders': 'SingleUnders', 'jump rope': 'SingleUnders',
  'crossover single': 'CrossoverSingles', 'crossover singles': 'CrossoverSingles', 'crossovers': 'CrossoverSingles', 'crossover': 'CrossoverSingles',
  // gymnastics
  'pull up': 'PullUp', 'pull ups': 'PullUp', 'pullup': 'PullUp', 'pullups': 'PullUp', 'kipping pull up': 'PullUp', 'strict pull up': 'PullUp', 'weighted pull up': 'PullUp', 'butterfly pull up': 'PullUp', 'legless pull up': 'PullUp', 'l pull up': 'PullUp', 'bar pull up': 'PullUp',
  'chest to bar': 'ChestToBar', 'chest to bar pull up': 'ChestToBar', 'chest to bar pull ups': 'ChestToBar', 'c2b': 'ChestToBar', 'ctb': 'ChestToBar', 'ctb pull up': 'ChestToBar',
  'muscle up': 'RingMuscleUp', 'muscle ups': 'RingMuscleUp', 'ring muscle up': 'RingMuscleUp', 'ring muscle ups': 'RingMuscleUp', 'strict muscle up': 'RingMuscleUp', 'strict ring muscle up': 'RingMuscleUp',
  'bar muscle up': 'BarMuscleUp', 'bar muscle ups': 'BarMuscleUp',
  'handstand push up': 'HSPU', 'handstand push ups': 'HSPU', 'hspu': 'HSPU', 'strict handstand push up': 'HSPU', 'kipping handstand push up': 'HSPU', 'deficit handstand push up': 'HSPU', 'strict deficit handstand push up': 'HSPU', 'wall facing handstand push up': 'HSPU', 'freestanding handstand push up': 'HSPU', 'parallette handstand push up': 'HSPU',
  'ring handstand push up': 'RingHSPU', 'ring hspu': 'RingHSPU',
  'handstand walk': 'HandstandWalk', 'handstand walks': 'HandstandWalk', 'hs walk': 'HandstandWalk', 'handstand obstacle': 'HandstandWalk', 'handstand walk obstacle': 'HandstandWalk', 'handstand ramp walk': 'HandstandWalk',
  'handstand hold': 'HandstandHold',
  'toes to bar': 'ToesToBar', 'toe to bar': 'ToesToBar', 't2b': 'ToesToBar', 'ttb': 'ToesToBar',
  'knees to elbows': 'KneesToElbows', 'knee to elbow': 'KneesToElbows', 'k2e': 'KneesToElbows',
  'rope climb': 'RopeClimb', 'rope climbs': 'RopeClimb', 'rope ascent': 'RopeClimb', 'rope ascents': 'RopeClimb',
  'legless rope climb': 'LeglessRopeClimb', 'legless rope climbs': 'LeglessRopeClimb', 'legless': 'LeglessRopeClimb',
  'pegboard': 'Pegboard', 'peg board': 'Pegboard', 'pegboard ascent': 'Pegboard', 'peg board ascent': 'Pegboard', 'pegboard climb': 'Pegboard',
  'ring dip': 'RingDip', 'ring dips': 'RingDip',
  'dip': 'Dip', 'dips': 'Dip', 'bar dip': 'Dip', 'parallel bar dip': 'Dip', 'parallette dip': 'Dip',
  'push up': 'PushUp', 'push ups': 'PushUp', 'pushup': 'PushUp', 'hand release push up': 'PushUp', 'deficit push up': 'PushUp', 'parallette push up': 'PushUp',
  'ring push up': 'RingPushUp', 'ring push ups': 'RingPushUp',
  'burpee': 'Burpee', 'burpees': 'Burpee', 'target burpee': 'Burpee', 'burpee to target': 'Burpee', 'burpee pull up': 'Burpee', 'burpee muscle up': 'Burpee', 'wall burpee': 'Burpee', 'over the log burpee': 'Burpee', 'burpee over the log': 'Burpee', 'ghd burpee': 'Burpee',
  'burpee box jump over': 'BurpeeBoxJumpOver', 'burpee box jump overs': 'BurpeeBoxJumpOver', 'burpee box jump': 'BurpeeBoxJumpOver', 'bbjo': 'BurpeeBoxJumpOver',
  'bar facing burpee': 'BarFacingBurpee', 'bar facing burpees': 'BarFacingBurpee', 'lateral burpee': 'BurpeeOverBar', 'burpee over bar': 'BurpeeOverBar', 'lateral bar burpee': 'BurpeeOverBar', 'burpee over the bar': 'BurpeeOverBar', 'lateral burpee over bar': 'BurpeeOverBar', 'burpee over rower': 'BurpeeOverBar', 'lateral burpee over rower': 'BurpeeOverBar',
  'box jump': 'BoxJump', 'box jumps': 'BoxJump', 'high box jump': 'BoxJump',
  'box jump over': 'BoxJumpOver', 'box jump overs': 'BoxJumpOver', 'bjo': 'BoxJumpOver',
  'box step up': 'BoxStepUp', 'box step ups': 'BoxStepUp', 'step up': 'BoxStepUp', 'step ups': 'BoxStepUp', 'weighted step up': 'BoxStepUp',
  'ghd sit up': 'GHDSitUp', 'ghd sit ups': 'GHDSitUp', 'ghd': 'GHDSitUp', 'ghdsu': 'GHDSitUp',
  'hip extension': 'HipExtension', 'back extension': 'HipExtension', 'hip and back extension': 'HipExtension',
  'sit up': 'SitUp', 'sit ups': 'SitUp', 'abmat sit up': 'SitUp', 'weighted sit up': 'SitUp',
  'v sit': 'VSit', 'l sit': 'LSit', 'l sit hold': 'LSit', 'l hang': 'LSit',
  'pistol': 'PistolSquat', 'pistols': 'PistolSquat', 'pistol squat': 'PistolSquat', 'pistol squats': 'PistolSquat', 'single leg squat': 'PistolSquat', 'one legged squat': 'PistolSquat', 'alternating pistol': 'PistolSquat',
  'air squat': 'AirSquat', 'air squats': 'AirSquat', 'squat': 'AirSquat', 'bodyweight squat': 'AirSquat',
  'lunge': 'Lunge', 'lunges': 'Lunge', 'walking lunge': 'Lunge', 'walking lunges': 'Lunge', 'front rack lunge': 'Lunge', 'front rack walking lunge': 'Lunge', 'back rack lunge': 'Lunge', 'sandbag lunge': 'Lunge', 'weighted lunge': 'Lunge', 'barbell lunge': 'Lunge',
  'overhead lunge': 'OverheadLunge', 'overhead walking lunge': 'OverheadLunge', 'overhead lunges': 'OverheadLunge',
  'wall walk': 'WallWalk', 'wall walks': 'WallWalk',
  'rollover': 'Rollover', 'ring rollover': 'Rollover', 'bar rollover': 'Rollover',
  'monkey bar': 'MonkeyBars', 'monkey bars': 'MonkeyBars', 'monkey bar traverse': 'MonkeyBars',
  'obstacle course': 'ObstacleCourse', 'obstacle': 'ObstacleCourse', 'obstacles': 'ObstacleCourse', 'zigzag sprint': 'Sprint', 'zig zag sprint': 'Sprint',
  'broad jump': 'BroadJump', 'standing broad jump': 'BroadJump', 'burden broad jump': 'BroadJump',
  'wall climb': 'Climb', 'net climb': 'Climb', 'cargo net': 'Climb', 'cargo net climb': 'Climb', 'berm climb': 'Climb', 'a frame': 'Climb',
  // barbell
  'snatch': 'Snatch', 'snatches': 'Snatch', 'squat snatch': 'Snatch', 'power snatch': 'Snatch', 'hang snatch': 'Snatch', 'hang power snatch': 'Snatch', 'hang squat snatch': 'Snatch', 'muscle snatch': 'Snatch', 'snatch ladder': 'Snatch', '1rm snatch': 'Snatch', 'max snatch': 'Snatch',
  'clean': 'Clean', 'cleans': 'Clean', 'squat clean': 'Clean', 'power clean': 'Clean', 'hang clean': 'Clean', 'hang power clean': 'Clean', 'hang squat clean': 'Clean', 'clean ladder': 'Clean', 'muscle clean': 'Clean',
  'clean and jerk': 'CleanAndJerk', 'clean jerk': 'CleanAndJerk', 'clean and jerks': 'CleanAndJerk', 'cj': 'CleanAndJerk', 'c and j': 'CleanAndJerk', 'ground to shoulder to overhead': 'CleanAndJerk',
  'jerk': 'Jerk', 'jerks': 'Jerk', 'push jerk': 'Jerk', 'split jerk': 'SplitJerk',
  'deadlift': 'Deadlift', 'deadlifts': 'Deadlift', 'deficit deadlift': 'Deadlift', 'deadlift ladder': 'Deadlift', 'max deadlift': 'Deadlift',
  'sumo deadlift high pull': 'SumoDeadliftHighPull', 'sdhp': 'SumoDeadliftHighPull',
  'back squat': 'BackSquat', 'back squats': 'BackSquat', 'max back squat': 'BackSquat', '1rm back squat': 'BackSquat',
  'front squat': 'FrontSquat', 'front squats': 'FrontSquat',
  'overhead squat': 'OverheadSquat', 'overhead squats': 'OverheadSquat', 'ohs': 'OverheadSquat',
  'thruster': 'Thruster', 'thrusters': 'Thruster', 'max thruster': 'Thruster', 'thruster ladder': 'Thruster',
  'shoulder press': 'ShoulderPress', 'strict press': 'ShoulderPress', 'press': 'ShoulderPress', 'overhead press': 'ShoulderPress',
  'push press': 'PushPress',
  'bench press': 'BenchPress', 'max bench press': 'BenchPress',
  'shoulder to overhead': 'ShoulderToOverhead', 'shoulders to overhead': 'ShoulderToOverhead', 's2o': 'ShoulderToOverhead', 'sto': 'ShoulderToOverhead',
  'ground to overhead': 'GroundToOverhead', 'g2o': 'GroundToOverhead', 'gto': 'GroundToOverhead',
  'overhead carry': 'OverheadWalk', 'overhead walk': 'OverheadWalk', 'overhead plate carry': 'OverheadWalk',
  'crossfit total': 'CrossFitTotal', 'total': 'CrossFitTotal',
  // implements
  'wall ball': 'WallBall', 'wall balls': 'WallBall', 'wall ball shot': 'WallBall', 'wall ball shots': 'WallBall', 'wallball': 'WallBall',
  'medicine ball clean': 'MedBallClean', 'med ball clean': 'MedBallClean', 'medball clean': 'MedBallClean',
  'kettlebell swing': 'KettlebellSwing', 'kettlebell swings': 'KettlebellSwing', 'kb swing': 'KettlebellSwing', 'kb swings': 'KettlebellSwing', 'american kettlebell swing': 'KettlebellSwing', 'russian kettlebell swing': 'KettlebellSwing',
  'kettlebell snatch': 'KettlebellSnatch', 'kb snatch': 'KettlebellSnatch',
  'kettlebell clean': 'KettlebellClean', 'kb clean': 'KettlebellClean', 'kettlebell clean and jerk': 'KettlebellClean',
  'kettlebell deadlift': 'KettlebellDeadlift', 'kb deadlift': 'KettlebellDeadlift',
  'kettlebell thruster': 'KettlebellThruster', 'kb thruster': 'KettlebellThruster',
  'dumbbell snatch': 'DumbbellSnatch', 'db snatch': 'DumbbellSnatch', 'alternating dumbbell snatch': 'DumbbellSnatch', 'single arm dumbbell snatch': 'DumbbellSnatch', 'dumbbell power snatch': 'DumbbellSnatch', 'dumbbell squat snatch': 'DumbbellSnatch',
  'dumbbell thruster': 'DumbbellThruster', 'db thruster': 'DumbbellThruster', 'dumbbell thrusters': 'DumbbellThruster',
  'dumbbell clean': 'DumbbellClean', 'db clean': 'DumbbellClean', 'dumbbell hang clean': 'DumbbellClean', 'dumbbell clean and jerk': 'DumbbellClean', 'dumbbell squat clean': 'DumbbellClean',
  'dumbbell lunge': 'DumbbellLunge', 'db lunge': 'DumbbellLunge', 'dumbbell walking lunge': 'DumbbellLunge', 'dumbbell overhead lunge': 'DumbbellLunge', 'dumbbell overhead walking lunge': 'DumbbellLunge', 'dumbbell front rack lunge': 'DumbbellLunge',
  'dumbbell shoulder to overhead': 'DumbbellShoulderToOverhead', 'dumbbell push press': 'DumbbellShoulderToOverhead', 'dumbbell push jerk': 'DumbbellShoulderToOverhead', 'dumbbell press': 'DumbbellShoulderToOverhead',
  'dumbbell box step over': 'DumbbellBoxStepOver', 'dumbbell box step overs': 'DumbbellBoxStepOver', 'db box step over': 'DumbbellBoxStepOver', 'dumbbell box step up': 'DumbbellBoxStepOver', 'dumbbell step up': 'DumbbellBoxStepOver',
  'dumbbell deadlift': 'DumbbellDeadlift', 'db deadlift': 'DumbbellDeadlift', 'double dumbbell deadlift': 'DumbbellDeadlift',
  // strongman
  'sled push': 'SledPush', 'sled pushes': 'SledPush', 'prowler push': 'SledPush', 'sled': 'SledPush', 'bobsled push': 'BobSled', 'bob sled': 'BobSled', 'bob': 'BobSled',
  'sled pull': 'SledPull', 'sled drag': 'SledPull', 'rope sled pull': 'SledPull', 'hand over hand sled pull': 'SledPull',
  'yoke': 'Yoke', 'yoke carry': 'Yoke', 'yoke walk': 'Yoke',
  'farmers carry': 'FarmersCarry', 'farmer carry': 'FarmersCarry', 'farmers walk': 'FarmersCarry', 'farmer walk': 'FarmersCarry', 'dumbbell farmers carry': 'FarmersCarry', 'kettlebell farmers carry': 'FarmersCarry', 'kettlebell carry': 'FarmersCarry', 'jerry can carry': 'JerryCan', 'jerry can': 'JerryCan',
  'husafell': 'Husafell', 'husafell carry': 'Husafell', 'husafell stone': 'Husafell', 'husafell bag': 'Husafell',
  'atlas stone': 'AtlasStone', 'atlas stones': 'AtlasStone', 'stone lift': 'AtlasStone', 'stone over shoulder': 'StoneToShoulder', 'stone to shoulder': 'StoneToShoulder', 'stone ground to shoulder': 'StoneToShoulder',
  'sandbag': 'Sandbag', 'sandbag carry': 'Sandbag', 'sandbag run': 'Sandbag', 'sandbag hold': 'Sandbag', 'sand bag carry': 'Sandbag', 'bag carry': 'Sandbag',
  'sandbag clean': 'SandbagClean', 'sandbag cleans': 'SandbagClean', 'sand bag clean': 'SandbagClean',
  'sandbag to shoulder': 'SandbagToShoulder', 'sandbag over shoulder': 'SandbagToShoulder', 'sandbag toss': 'SandbagToShoulder', 'sandbag over the yoke': 'SandbagToShoulder', 'sandbag throw': 'SandbagToShoulder',
  'log lift': 'LogLift', 'log clean': 'LogLift', 'log clean and jerk': 'LogLift', 'log press': 'LogLift', 'log carry': 'LogLift',
  'axle bar': 'AxleBar', 'axle bar deadlift': 'AxleBar', 'axle bar clean': 'AxleBar', 'axle deadlift': 'AxleBar', 'axle clean': 'AxleBar', 'axle press': 'AxleBar',
  'tire flip': 'TireFlip', 'tire flips': 'TireFlip', 'tyre flip': 'TireFlip',
  'keg lift': 'KegLift', 'keg carry': 'KegLift', 'keg': 'KegLift',
  'banger': 'Banger', 'the banger': 'Banger',
  'sledgehammer': 'SledgeHammer', 'sledge hammer': 'SledgeHammer', 'hammer strike': 'SledgeHammer',
  'wheelbarrow': 'Wheelbarrow', 'wheelbarrow push': 'Wheelbarrow',
  'pig flip': 'PigFlip', 'pig': 'PigFlip',
  'torque tank': 'TorqueTankPush', 'torque tank push': 'TorqueTankPush', 'tank push': 'TorqueTankPush',
  'odd object carry': 'BurdenCarry', 'burden carry': 'BurdenCarry', 'odd object': 'BurdenCarry', 'cylinder carry': 'BurdenCarry',
  'burpee over barricade': 'Burpee', 'barricade burpee': 'Burpee',
  // games one-offs + variants
  'kettlebell sumo deadlift high pull': 'SumoDeadliftHighPull',
  'stair climb': 'StairClimb', 'stadium stair climb': 'StairClimb', 'stair sprint': 'StairClimb',
  'hurdle jump': 'HurdleJump', 'hurdle jumps': 'HurdleJump', 'hurdle': 'HurdleJump',
  'squat clean and jerk': 'CleanAndJerk', 'split snatch': 'Snatch', 'hang split snatch': 'Snatch',
  'sledgehammer stake drive': 'SledgeHammer', 'banger sledgehammer drive': 'Banger', 'stake drive': 'SledgeHammer',
  'burpee wall jump': 'WallOver', 'burpee over wall': 'WallOver', 'wall over': 'WallOver', 'wall overs': 'WallOver', 'over the wall burpee': 'WallOver',
  'jug carry': 'JerryCan', 'jerry bag carry': 'JerryCan', 'jerry can run': 'JerryCan',
  'ghd medicine ball throw': 'GHDBallThrow', 'ghd ball throw': 'GHDBallThrow', 'med ball ghd sit up': 'GHDSitUp', 'medicine ball ghd sit up': 'GHDSitUp',
  'medicine ball carry': 'BurdenCarry', 'hill sprint med ball carry': 'BurdenCarry', 'med ball carry': 'BurdenCarry',
  'sled drive': 'SledPush', 'snail push': 'SnailPush', 'the snail': 'SnailPush',
  'plow drag': 'PlowDrag', 'plow pull': 'PlowDrag',
  'd ball clean': 'DBallClean', 'dball clean': 'DBallClean', 'd ball over shoulder': 'DBallClean',
  'hay bale clean burpee': 'HayBaleClean', 'hay bale clean': 'HayBaleClean', 'cheese curd burpee over hay bale': 'HayBaleClean',
  'rescue randy drag': 'RescueRandy', 'rescue randy': 'RescueRandy', 'dummy drag': 'RescueRandy',
  'obstacle course run': 'ObstacleCourse',
  'burpee to bar': 'Burpee', 'burpee to ring touch': 'Burpee', 'burpee to target': 'Burpee',
  'tumbler pull': 'TumblerPull', 'tumbler': 'TumblerPull',
  'kettlebell shoulder to overhead': 'KettlebellShoulderToOverhead', 'kettlebell push press': 'KettlebellShoulderToOverhead', 'kettlebell jerk': 'KettlebellShoulderToOverhead',
  'dumbbell hang split snatch': 'DumbbellSnatch', 'dumbbell hang clean and split jerk': 'DumbbellClean',
  'toes to rings': 'ToesToBar', 'toes to ring': 'ToesToBar',
  'freestanding handstand hold': 'HandstandHold', 'hill sprint': 'Sprint', 'sack carry': 'Sandbag',
  'kettlebell front rack lunge': 'Lunge', 'back rack walking lunge': 'Lunge', 'front rack walking lunges': 'Lunge',
  'ball slam': 'BallSlam', 'ball slams': 'BallSlam', 'slam ball': 'BallSlam',
  'under crossover': 'CrossoverSingles', 'parallel bar traverse': 'ParallelBarTraverse', 'p bar traverse': 'ParallelBarTraverse',
  'dumbbell overhead squat': 'DumbbellOverheadSquat',
  'jump over': 'BoxJumpOver', 'jump overs': 'BoxJumpOver',
  'free standing handstand push up': 'HSPU',
  'obstacle pirouette steps': 'HandstandWalk', 'pirouette': 'HandstandWalk',
  'pull over': 'Rollover', 'bar pullover': 'Rollover', 'pullover': 'Rollover',
  'sandbag squat': 'SandbagSquat', 'sandbag back squat': 'SandbagSquat',
  'sandbag over log': 'SandbagToShoulder', 'sandbag over the log': 'SandbagToShoulder',
  'rope double under': 'DoubleUnders', 'heavy rope double under': 'DoubleUnders',
  // skill
  'softball throw': 'SoftballThrow', 'softball toss': 'SoftballThrow',
  'javelin': 'Javelin', 'javelin throw': 'Javelin',
  'slackline': 'Slackline', 'slack line': 'Slackline',
  'skill speed ladder': 'SkillSpeedLadder', 'speed ladder': 'SkillSpeedLadder', 'agility ladder': 'SkillSpeedLadder',
  'memory drill': 'MemoryDrill', 'memory test': 'MemoryDrill',
}

const cleanName = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const QUALIFIERS = /^(?:strict|kipping|deficit|weighted|alternating|single arm|double|heavy|max|1rm|one rep max|unbroken|synchro|legless)\s+/

const unmapped = new Map() // cleaned -> {count, samples:Set<year>}

function normalizeMovement(raw, year) {
  let key = cleanName(raw)
  if (SYNONYMS[key]) return SYNONYMS[key]
  // strip leading qualifiers and retry (up to twice)
  for (let i = 0; i < 2; i++) {
    const stripped = key.replace(QUALIFIERS, '')
    if (stripped === key) break
    key = stripped
    if (SYNONYMS[key]) return SYNONYMS[key]
  }
  // plural -> singular retry
  if (key.endsWith('s') && SYNONYMS[key.slice(0, -1)]) return SYNONYMS[key.slice(0, -1)]
  // record unmapped, fall back to PascalCase auto-ID
  const entry = unmapped.get(key) || { count: 0, years: new Set() }
  entry.count++
  entry.years.add(year)
  unmapped.set(key, entry)
  const autoId = key.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  if (!MOVEMENTS[autoId]) MOVEMENTS[autoId] = { display: String(raw).trim(), wodId: null }
  return autoId
}

// ---------------------------------------------------------------------------
// Eras
// ---------------------------------------------------------------------------

// The last era is open-ended (9999) so future years (2026+) are always
// assigned an era — the emitted range is clamped to the years actually present.
const ERAS = [
  { id: 'ranch', name: 'The Ranch Era', range: [2007, 2009], desc: 'Grassroots beginnings on a dirt hillside in Aromas, California. Handfuls of events, no qualification standard at first, athletes camping on site. The sport finding out what it was.' },
  { id: 'carson', name: 'The Carson Era', range: [2010, 2016], desc: 'The Home Depot Center / StubHub Center years in Carson, California. The Games became a televised stadium sport: the Open (2011) and Regionals fed a professionalized field, sponsors arrived, and programming expanded into oceans, velodromes, and Camp Pendleton.' },
  { id: 'madison', name: 'The Madison Era', range: [2017, 2023], desc: 'Seven years at the Alliant Energy Center in Madison, Wisconsin (with the 2020 pandemic final back at the Ranch). Deeper international fields, the cut era, and the Fraser and Toomey dynasties.' },
  { id: 'touring', name: 'The Touring Era', range: [2024, 9999], desc: 'The Games leave Madison: Fort Worth in 2024, Albany in 2025. A transitional period for the sport — new ownership conversations, new formats, and a changing competitive landscape.' },
]

const eraFor = (year) => {
  const era = ERAS.find((e) => year >= e.range[0] && year <= e.range[1])
  if (!era) problem(`${year}: no era covers this year — extend ERAS in build-games-data.mjs`)
  return era?.id ?? 'unknown'
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const FORMATS = ['for-time', 'amrap', 'max-load', 'interval', 'points', 'tiebreak', 'other']
const SCORINGS = ['time', 'reps', 'load', 'points', 'distance']
// Stadium-floor environments counted as indoor/controlled for pctOutdoor
const INDOOR_ENVS = new Set(['stadium', 'arena', 'arena-floor', 'coliseum', 'tennis-stadium', 'soccer-field'])
const TIME_DOMAINS = ['sprint', 'short', 'medium', 'long', 'endurance']
const LOAD_LEVELS = ['none', 'light', 'moderate', 'heavy', 'max']
const STAGES = ['games', 'online']

const problems = []
const problem = (msg) => problems.push(msg)

function validateEvent(ev, year) {
  const where = `${year}/${ev.id ?? '?'}`
  if (!ev.id || !/^\d{4}-\d{2}$/.test(ev.id)) problem(`${where}: bad id format`)
  if (!Number.isInteger(ev.order) || ev.order < 1) problem(`${where}: bad order "${ev.order}"`)
  if (!ev.name) problem(`${where}: missing name`)
  if (!ev.description || ev.description.length < 20) problem(`${where}: description missing/too thin`)
  if (!FORMATS.includes(ev.format)) problem(`${where}: bad format "${ev.format}"`)
  if (!SCORINGS.includes(ev.scoring)) problem(`${where}: bad scoring "${ev.scoring}"`)
  // timeDomain may be null for untimed events (max lifts, points/skill events)
  if (ev.timeDomain != null && ev.timeDomain !== 'null' && !TIME_DOMAINS.includes(ev.timeDomain)) {
    problem(`${where}: bad timeDomain "${ev.timeDomain}"`)
  }
  if (!LOAD_LEVELS.includes(ev.loadLevel)) problem(`${where}: bad loadLevel "${ev.loadLevel}"`)
  if (!Array.isArray(ev.movements) || ev.movements.length === 0) problem(`${where}: no movements`)
  if (!Array.isArray(ev.eventTypes) || ev.eventTypes.length === 0) problem(`${where}: no eventTypes`)
  if (typeof ev.modality !== 'string' || !/^[MGW]{1,3}$/.test([...new Set((ev.modality || '').split(''))].sort().join('').replace(/[^MGW]/g, '') || 'x')) {
    if (!/^[MGW]+$/.test(ev.modality ?? '')) problem(`${where}: bad modality "${ev.modality}"`)
  }
  if (ev.stage && !STAGES.includes(ev.stage)) problem(`${where}: bad stage "${ev.stage}"`)
}

// ---------------------------------------------------------------------------
// Load + normalize
// ---------------------------------------------------------------------------

if (!existsSync(RAW_DIR)) {
  console.error(`Raw dir not found: ${RAW_DIR}`)
  process.exit(1)
}

const files = readdirSync(RAW_DIR).filter((f) => /^\d{4}\.json$/.test(f)).sort()
if (files.length === 0) {
  console.error('No raw year files found.')
  process.exit(1)
}
console.log(`Found ${files.length} raw year files: ${files.map((f) => f.slice(0, 4)).join(', ')}`)

const years = []
for (const f of files) {
  const year = Number(f.slice(0, 4))
  let raw
  try {
    raw = JSON.parse(readFileSync(join(RAW_DIR, f), 'utf8'))
  } catch (e) {
    problem(`${year}: JSON parse error — ${e.message}`)
    continue
  }
  if (raw.year !== year) problem(`${year}: year field mismatch (${raw.year})`)
  if (!raw.championMen || !raw.championWomen) problem(`${year}: missing champion(s)`)
  if (!Array.isArray(raw.events) || raw.events.length === 0) {
    problem(`${year}: no events`)
    continue
  }

  const events = raw.events
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((ev) => {
      validateEvent(ev, year)
      // Normalize timeDomain: tolerate null / "null"; derive from time cap when possible
      let timeDomain = ev.timeDomain === 'null' ? null : ev.timeDomain ?? null
      if (timeDomain == null && typeof ev.timeCapMin === 'number') {
        timeDomain =
          ev.timeCapMin <= 5 ? 'sprint' :
          ev.timeCapMin <= 10 ? 'short' :
          ev.timeCapMin <= 20 ? 'medium' :
          ev.timeCapMin <= 40 ? 'long' : 'endurance'
      }
      const movements = [...new Set((ev.movements || []).map((m) => normalizeMovement(m, year)))]
      const modality = [...new Set(String(ev.modality || '').split('').filter((c) => 'MGW'.includes(c)))]
        .sort((a, b) => 'MGW'.indexOf(a) - 'MGW'.indexOf(b))
        .join('')
      return {
        id: ev.id,
        year,
        order: ev.order,
        stage: ev.stage === 'online' ? 'online' : 'games',
        name: ev.name,
        aka: ev.aka ?? null,
        day: ev.day ?? null,
        description: ev.description ?? '',
        format: ev.format,
        scoring: ev.scoring,
        timeCapMin: ev.timeCapMin ?? null,
        winnerMen: ev.winnerMen ?? null,
        winnerWomen: ev.winnerWomen ?? null,
        winningScoreMen: ev.winningScoreMen ?? null,
        winningScoreWomen: ev.winningScoreWomen ?? null,
        movements,
        loads: Array.isArray(ev.loads) ? ev.loads : [],
        equipment: (ev.equipment || []).map((e) => String(e).toLowerCase().trim()),
        eventTypes: (ev.eventTypes || []).map((e) => String(e).toLowerCase().trim()),
        modality: modality || 'M',
        timeDomain,
        loadLevel: ev.loadLevel,
        environment: (ev.environment || 'other').toLowerCase(),
        namedWod: ev.namedWod ?? null,
        firstAtGames: ev.firstAtGames ?? [],
        notes: ev.notes ?? null,
      }
    })

  years.push({
    year,
    venue: raw.venue ?? null,
    city: raw.city ?? null,
    region: raw.region ?? null,
    country: raw.country ?? null,
    dates: raw.dates ?? null,
    championMen: raw.championMen ?? null,
    championWomen: raw.championWomen ?? null,
    fieldMen: raw.fieldMen ?? null,
    fieldWomen: raw.fieldWomen ?? null,
    formatNotes: raw.formatNotes ?? null,
    yearSummary: raw.yearSummary ?? null,
    eraId: eraFor(year),
    events,
  })
}

years.sort((a, b) => a.year - b.year)
if (years.length === 0) {
  console.error('No usable year files — every raw file failed to parse or had no events.')
  problems.forEach((p) => console.error(`  - ${p}`))
  process.exit(1)
}
const allEvents = years.flatMap((y) => y.events)

// Validate wodId cross-links against the daily-WOD dataset's actual vocabulary
try {
  const daily = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'crossfit-data.json'), 'utf8'))
  const validWodIds = new Set()
  daily.searchIndex.forEach((w) => w.mv.forEach((m) => validWodIds.add(m)))
  for (const [id, m] of Object.entries(MOVEMENTS)) {
    if (m.wodId && !validWodIds.has(m.wodId)) {
      problem(`MOVEMENTS.${id}: wodId "${m.wodId}" not found in daily-WOD movement vocabulary`)
    }
  }
} catch (e) {
  console.warn(`(skipping wodId validation — could not read crossfit-data.json: ${e.message})`)
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

const count = (arr, key) => {
  const out = {}
  for (const item of arr) {
    const k = key(item)
    if (k == null || k === '') continue
    if (Array.isArray(k)) k.forEach((kk) => { out[kk] = (out[kk] || 0) + 1 })
    else out[k] = (out[k] || 0) + 1
  }
  return out
}

const seenMovements = new Set()
const perYear = years.map((y) => {
  const evs = y.events
  const yearMovements = new Set(evs.flatMap((e) => e.movements))
  const newMovs = [...yearMovements].filter((m) => !seenMovements.has(m))
  newMovs.forEach((m) => seenMovements.add(m))
  const caps = evs.map((e) => e.timeCapMin).filter((c) => typeof c === 'number')
  const outdoor = evs.filter((e) => !INDOOR_ENVS.has(e.environment)).length
  return {
    year: y.year,
    eventCount: evs.filter((e) => e.stage === 'games').length,
    onlineEventCount: evs.filter((e) => e.stage === 'online').length,
    modality: count(evs, (e) => e.modality),
    timeDomains: count(evs, (e) => e.timeDomain),
    loadLevels: count(evs, (e) => e.loadLevel),
    environments: count(evs, (e) => e.environment),
    eventTypes: count(evs, (e) => e.eventTypes),
    formats: count(evs, (e) => e.format),
    uniqueMovements: yearMovements.size,
    newMovements: newMovs.length,
    cumulativeMovements: seenMovements.size,
    avgTimeCapMin: caps.length ? Math.round((caps.reduce((a, b) => a + b, 0) / caps.length) * 10) / 10 : null,
    pctOutdoor: evs.length ? Math.round((outdoor / evs.length) * 100) : 0,
  }
})

// Movement stats
const movementStats = new Map()
for (const ev of allEvents) {
  for (const m of ev.movements) {
    const s = movementStats.get(m) || { id: m, total: 0, yearCounts: {}, firstYear: ev.year, lastYear: ev.year, eventIds: [] }
    s.total++
    s.yearCounts[ev.year] = (s.yearCounts[ev.year] || 0) + 1
    s.firstYear = Math.min(s.firstYear, ev.year)
    s.lastYear = Math.max(s.lastYear, ev.year)
    s.eventIds.push(ev.id)
    movementStats.set(m, s)
  }
}
const movements = [...movementStats.values()]
  .map((s) => ({ ...s, display: MOVEMENTS[s.id]?.display ?? s.id, wodId: MOVEMENTS[s.id]?.wodId ?? null }))
  .sort((a, b) => b.total - a.total)

// Era aggregates — emitted range is clamped to the years actually present
const eraIdByYear = new Map(years.map((y) => [y.year, y.eraId]))
const eras = ERAS.filter((e) => years.some((y) => y.eraId === e.id)).map((e) => {
  const evs = allEvents.filter((ev) => eraIdByYear.get(ev.year) === e.id)
  const yrs = years.filter((y) => y.eraId === e.id)
  const movCount = count(evs, (ev) => ev.movements)
  return {
    id: e.id,
    name: e.name,
    range: [yrs[0].year, yrs[yrs.length - 1].year],
    venues: [...new Set(yrs.map((y) => y.venue).filter(Boolean))],
    desc: e.desc,
    eventCount: evs.length,
    avgEventsPerYear: yrs.length ? Math.round((evs.length / yrs.length) * 10) / 10 : 0,
    modality: count(evs, (ev) => ev.modality),
    timeDomains: count(evs, (ev) => ev.timeDomain),
    loadLevels: count(evs, (ev) => ev.loadLevel),
    environments: count(evs, (ev) => ev.environment),
    topMovements: Object.entries(movCount).sort((a, b) => b[1] - a[1]).slice(0, 12),
  }
})

// Named-WOD crossovers
const namedMap = new Map()
for (const ev of allEvents) {
  if (!ev.namedWod) continue
  const n = namedMap.get(ev.namedWod) || { name: ev.namedWod, eventIds: [], years: new Set() }
  n.eventIds.push(ev.id)
  n.years.add(ev.year)
  namedMap.set(ev.namedWod, n)
}
const namedWods = [...namedMap.values()]
  .map((n) => ({ name: n.name, eventIds: n.eventIds, years: [...n.years].sort() }))
  .sort((a, b) => b.years.length - a.years.length || a.name.localeCompare(b.name))

// Champions + title counts.
// Years keep the as-competed name (historically accurate per year); the
// champions array canonicalizes name variants so title counts, stars, and
// dynasty streaks resolve to one identity per athlete.
const CHAMPION_CANON = {
  'Mathew Fraser': 'Mat Fraser',
  'Tia-Clair Toomey-Orr': 'Tia-Clair Toomey',
  'Katrin Tanja Davidsdottir': 'Katrín Davíðsdóttir',
  'Rich Froning Jr.': 'Rich Froning',
  'Samantha Briggs': 'Sam Briggs',
}
const canonChampion = (n) => (n ? CHAMPION_CANON[n] ?? n : n)
const champions = years.map((y) => ({
  year: y.year,
  men: canonChampion(y.championMen),
  women: canonChampion(y.championWomen),
}))
const titleCount = (sel) => {
  const c = {}
  champions.forEach((ch) => { const n = sel(ch); if (n) c[n] = (c[n] || 0) + 1 })
  return Object.entries(c).sort((a, b) => b[1] - a[1])
}
const [topMan] = titleCount((c) => c.men)
const [topWoman] = titleCount((c) => c.women)

// Records / fun stats
const parseLb = (s) => {
  if (!s) return null
  const m = String(s).match(/([\d.]+)\s*(?:lb|lbs|#|pound)/i)
  if (m) return parseFloat(m[1])
  const kg = String(s).match(/([\d.]+)\s*kg/i)
  if (kg) return Math.round(parseFloat(kg[1]) * 2.20462)
  return null
}
let heaviest = { lb: 0, item: '', id: '' }
for (const ev of allEvents) {
  for (const l of ev.loads) {
    // skip summed totals ("Sandbags (total moved)") — not a single prescribed load
    if (/total/i.test(l.item)) continue
    const lb = parseLb(l.men)
    if (lb && lb > heaviest.lb) heaviest = { lb, item: l.item, id: ev.id }
  }
}
const longestCap = allEvents.filter((e) => e.timeCapMin).sort((a, b) => b.timeCapMin - a.timeCapMin)[0]
const biggestYear = [...perYear].sort((a, b) => (b.eventCount + b.onlineEventCount) - (a.eventCount + a.onlineEventCount))[0]
const gamesOnly = movements.filter((m) => !m.wodId).length
const swimYears = new Set(allEvents.filter((e) => e.movements.includes('Swim')).map((e) => e.year))

const records = [
  { icon: '🏟️', stat: String(allEvents.length), label: 'individual events all-time', detail: `Across ${years.length} Games, ${years[0].year}–${years[years.length - 1].year}` },
  { icon: '🏆', stat: topMan ? `${topMan[1]}×` : '—', label: `most men's titles — ${topMan ? topMan[0] : ''}`, detail: 'Individual elite division' },
  { icon: '👑', stat: topWoman ? `${topWoman[1]}×` : '—', label: `most women's titles — ${topWoman ? topWoman[0] : ''}`, detail: 'Individual elite division' },
  { icon: '🏋️', stat: heaviest.lb ? `${heaviest.lb} lb` : '—', label: `heaviest prescribed load (${heaviest.item})`, detail: heaviest.id ? `Event ${heaviest.id}` : '' },
  { icon: '⏱️', stat: longestCap ? `${longestCap.timeCapMin} min` : '—', label: 'longest time cap', detail: longestCap ? `${longestCap.name} (${longestCap.year})` : '' },
  { icon: '📅', stat: biggestYear ? String(biggestYear.eventCount + biggestYear.onlineEventCount) : '—', label: 'most events in one year', detail: biggestYear ? `${biggestYear.year}${biggestYear.onlineEventCount ? ' (incl. online stage)' : ''}` : '' },
  { icon: '🆕', stat: String(gamesOnly), label: 'Games-exclusive movements', detail: `Never programmed in daily WODs — of ${movements.length} all-time` },
  { icon: '🏊', stat: String(swimYears.size), label: 'years with a swim', detail: 'Oceans, lakes, rivers, and pools' },
]

// ---------------------------------------------------------------------------
// Athlete results (top-10 per division) — src/data/games/results/<year>.json
// Validated hard against the events data: points must sum to totals, the
// documented event winner must place 1st when they appear in the top 10,
// every eventId must exist, places must fit the field.
// ---------------------------------------------------------------------------

const RESULTS_DIR = join(__dirname, '..', 'src', 'data', 'games', 'results')
const results = {}
if (existsSync(RESULTS_DIR)) {
  for (const f of readdirSync(RESULTS_DIR).filter((x) => /^\d{4}\.json$/.test(x)).sort()) {
    const year = Number(f.slice(0, 4))
    let res
    try {
      res = JSON.parse(readFileSync(join(RESULTS_DIR, f), 'utf8'))
    } catch (e) {
      problem(`results/${year}: JSON parse error — ${e.message}`)
      continue
    }
    // Multi-stage years (2026+): no raw Games file; validate stages lightly and pass through.
    if (res.stages) {
      for (const [skey, stage] of Object.entries(res.stages)) {
        const stEventIds = new Set((stage.events ?? []).map((e) => e.id))
        for (const division of ['men', 'women']) {
          const athletes = stage.divisions?.[division] ?? []
          if (athletes.length === 0) problem(`results/${year}/${skey}/${division}: no athletes`)
          athletes.forEach((a) => {
            const sum = a.events.reduce((acc, e) => acc + e.points, 0)
            if (sum !== a.totalPoints) problem(`results/${year}/${skey}/${division}/${a.name}: points sum ${sum} ≠ ${a.totalPoints}`)
            a.events.forEach((e) => {
              if (!stEventIds.has(e.eventId)) problem(`results/${year}/${skey}/${division}/${a.name}: unknown eventId ${e.eventId}`)
            })
          })
        }
      }
      results[year] = res
      continue
    }

    const yearData = years.find((y) => y.year === year)
    if (!yearData) {
      problem(`results/${year}: no matching raw year file`)
      continue
    }
    const eventIds = new Set(yearData.events.map((e) => e.id))
    for (const division of ['men', 'women']) {
      const field = division === 'men' ? yearData.fieldMen : yearData.fieldWomen
      const athletes = res.divisions?.[division] ?? []
      if (athletes.length !== 10) problem(`results/${year}/${division}: expected 10 athletes, got ${athletes.length}`)
      athletes.forEach((a) => {
        const sum = a.events.reduce((acc, e) => acc + e.points, 0)
        if (sum !== a.totalPoints) problem(`results/${year}/${division}/${a.name}: event points sum ${sum} ≠ totalPoints ${a.totalPoints}`)
        a.events.forEach((e) => {
          if (!eventIds.has(e.eventId)) problem(`results/${year}/${division}/${a.name}: unknown eventId ${e.eventId}`)
          if (!Number.isInteger(e.place) || e.place < 1 || (field && e.place > field)) {
            problem(`results/${year}/${division}/${a.name}: place ${e.place} out of range for ${e.eventId}`)
          }
        })
      })
      // Documented event winners must place 1st when they're in the top 10
      const byName = new Map(athletes.map((a) => [a.name, a]))
      yearData.events.forEach((ev) => {
        const winner = division === 'men' ? ev.winnerMen : ev.winnerWomen
        const a = winner ? byName.get(winner) : null
        if (a) {
          const cell = a.events.find((e) => e.eventId === ev.id)
          if (cell && cell.place !== 1) {
            problem(`results/${year}/${division}: ${winner} won ${ev.id} per events data but results give place ${cell.place}`)
          }
        }
      })
      // Final order must be sequential by rank, and monotonic by total in the
      // year's scoring direction. Early years (2008 time-sum, 2009-2010 rank-sum)
      // are LOWER-is-better; the modern points table is HIGHER-is-better.
      const withTotals = athletes.filter((a) => typeof a.totalPoints === 'number')
      const lowerIsBetter = withTotals.length >= 2 && withTotals[0].totalPoints < withTotals[withTotals.length - 1].totalPoints
      for (let i = 1; i < athletes.length; i++) {
        if (athletes[i].rank !== athletes[i - 1].rank + 1) problem(`results/${year}/${division}: ranks not sequential at index ${i}`)
        const a = athletes[i].totalPoints
        const b = athletes[i - 1].totalPoints
        if (typeof a === 'number' && typeof b === 'number') {
          const wrong = lowerIsBetter ? a < b : a > b
          if (wrong) problem(`results/${year}/${division}: ${athletes[i].name} total ${a} out of order vs athlete above (${b}); ${lowerIsBetter ? 'lower' : 'higher'}-is-better`)
        }
      }
    }
    results[year] = res
  }
  if (Object.keys(results).length) {
    console.log(`Athlete results: ${Object.keys(results).join(', ')}`)
  }
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const movementDisplay = {}
for (const m of movements) movementDisplay[m.id] = m.display

const bundle = {
  meta: {
    generated: new Date().toISOString().slice(0, 10),
    totalEvents: allEvents.length,
    totalGamesEvents: allEvents.filter((e) => e.stage === 'games').length,
    totalOnlineEvents: allEvents.filter((e) => e.stage === 'online').length,
    years: years.map((y) => y.year),
    unmappedMovements: [...unmapped.keys()].sort(),
  },
  years,
  eras,
  perYear,
  movements,
  movementDisplay,
  namedWods,
  champions,
  records,
  results,
}

console.log(`\nYears: ${years.length}  Events: ${allEvents.length} (${bundle.meta.totalGamesEvents} games + ${bundle.meta.totalOnlineEvents} online)`)
console.log(`Movements: ${movements.length} distinct (${movements.slice(0, 8).map((m) => `${m.id}:${m.total}`).join(', ')} …)`)

if (unmapped.size) {
  // Unmapped names silently mint auto-IDs that split movement stats —
  // treat them as build failures, not warnings.
  console.log(`\n✗ Unmapped movement names (${unmapped.size}) — extend SYNONYMS in build-games-data.mjs:`)
  for (const [k, v] of [...unmapped.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  "${k}" ×${v.count} (${[...v.years].join(', ')})`)
    problem(`unmapped movement name "${k}" (${[...v.years].join(', ')})`)
  }
}

if (problems.length) {
  console.log(`\n✗ ${problems.length} validation problem(s):`)
  problems.forEach((p) => console.log(`  - ${p}`))
}

if (CHECK_ONLY) {
  console.log('\n--check: no output written.')
  process.exit(problems.length ? 1 : 0)
}

if (problems.length) {
  console.log('\n✗ Refusing to write bundle while validation problems exist.')
  process.exit(1)
}

// Typography rule: no em/en dashes in user-visible text — normalize every
// string in the bundle to plain hyphens (spaced em-dash → " - ").
const deDash = (v) => {
  if (typeof v === 'string') return v.replace(/\s*—\s*/g, ' - ').replace(/–/g, '-')
  if (Array.isArray(v)) return v.map(deDash)
  if (v && typeof v === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = deDash(val)
    return out
  }
  return v
}

const json = JSON.stringify(deDash(bundle))
writeFileSync(OUT_FILE, json)
console.log(`\n✓ Wrote ${OUT_FILE} (${Math.round(Buffer.byteLength(json) / 1024)} KB)`)
process.exit(0)
