#!/usr/bin/env node
// Work model for the 2025 CrossFit Games events: estimated total energy
// demand (kJ, metabolic-equivalent) per event per division. Written into
// src/data/games/results/2025.json as `workModel`.
//
// Accounting rules (documented in the UI methodology):
// - Lifts and gymnastics: external mechanical work (load and/or moving body
//   mass through a displacement) divided by 20% mechanical efficiency.
// - Running: 1.0 kcal per kg per km (standard net running cost).
// - Erg calories (ski/bike/echo/row-cal): displayed calories = kcal.
// - Rowing distance: 70 J/m (men) / 60 J/m (women) mechanical at race pace,
//   divided by 21% efficiency.
// - Loaded carries: load x distance x 0.04 (horizontal cost proxy) / 20%.
// - Within one event every finisher does the same work, so athlete-to-athlete
//   comparisons are exact; the absolute level per event is a modeled estimate.
//
// Reference body mass: men 195 lb (88.5 kg), women 145 lb (65.8 kg).

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULTS = join(__dirname, '..', 'src', 'data', 'games', 'results', '2025.json')

const KJ_PER_FTLB = 0.001356
const KCAL = 4.184 // kJ
const LIFT_EFF = 0.2
const BW = { men: { lb: 195, kg: 88.5 }, women: { lb: 145, kg: 65.8 } }

const mechToKj = (ftlb) => (ftlb * KJ_PER_FTLB) / LIFT_EFF
const runKj = (km, kg) => kg * km * KCAL
const ergKj = (cal) => cal * KCAL
const rowKj = (m, division) => (m * (division === 'men' ? 70 : 60)) / 0.21 / 1000

function compute(division) {
  const bw = BW[division]
  const m = division === 'men'

  // E1 Run/Row/Run: 4mi run + 3,000m row + 2mi run
  const e1 = runKj(9.656, bw.kg) + rowKj(3000, division)

  // E2 All Crossed Up: 20 wall walks, 30 DB S2O (100/70), 80 crossovers, 60 T2B
  const e2 = mechToKj(
    20 * (bw.lb * 4.0) + // wall walk: full BW through ~4 ft (incl. eccentric/iso cost proxy)
    30 * ((m ? 100 : 70) * (m ? 2.1 : 2.0) + 0.6 * bw.lb * 0.3) + // single-DB S2O + dip drive
    80 * (bw.lb * 0.15) + // crossover singles: ~0.15 ft jump
    60 * (0.45 * bw.lb * 2.0) // T2B: legs ~45% BW through ~2 ft
  )

  // E3 Climbing Couplet: 10 pegboard ascents + 10 squat-clean+front-squat complexes
  const avgBar = m ? (4 * 235 + 3 * 265 + 2 * 285 + 1 * 305) / 10 : (4 * 145 + 3 * 165 + 2 * 185 + 1 * 205) / 10
  const e3 = mechToKj(
    10 * (bw.lb * 7.5) + // pegboard: full BW ~7.5 ft
    10 * (avgBar * 5.1 + 0.65 * bw.lb * 3.0) // complex: bar floor->rack->squat->stand + body squat x2
  )

  // E4 Albany Grip Trip: 5x(300m run + 12 axle DL 350/220 + 100ft HSW, 150 last)
  const e4 =
    runKj(1.5, bw.kg) +
    mechToKj(
      60 * ((m ? 350 : 220) * 1.64 + 0.35 * bw.lb * 1.64) + // axle deadlift (~0.50 m bar travel)
      550 * (0.12 * bw.lb) // handstand walk: cost proxy per ft
    )

  // E6 Throttle Up (vest 22/16): 35-cal ski, 28 C2B, 24 BBJO (24/20 in box)
  const bwv = bw.lb + (m ? 22 : 16)
  const e6 =
    ergKj(35) +
    mechToKj(28 * (bwv * 2.2) + 24 * (bwv * (1.6 + (m ? 2.0 : 1.67))))

  // E7 Hammer Down: 35-cal BikeErg, 28 BMU, 24 BBJO
  const e7 =
    ergKj(35) +
    mechToKj(28 * (bw.lb * 4.0) + 24 * (bw.lb * (1.6 + (m ? 2.0 : 1.67))))

  // E8 Going Dark: 50/40-cal Echo x2, 200ft yoke (est 600/400 lb), 30 deficit HSPU
  const e8 =
    ergKj(m ? 100 : 80) +
    mechToKj(
      0.04 * (m ? 600 : 400) * 200 + // yoke carry (load estimated; not published)
      30 * (0.65 * bw.lb * 1.2) // deficit HSPU
    )

  // E9 Running Isabel: 30 snatches (155/105) + 5x200ft run
  const e9 =
    runKj(0.305, bw.kg) +
    mechToKj(30 * ((m ? 155 : 105) * (m ? 4.2 : 3.8) + 0.6 * bw.lb * (m ? 1.5 : 1.4)))

  // E10 Atlas: 45 thrusters (135/95), 15 rope climbs (15 ft), 100ft OH lunge
  const e10 = mechToKj(
    45 * ((m ? 135 : 95) * (m ? 4.0 : 3.7) + 0.65 * bw.lb * 1.5) +
    15 * (bw.lb * 15) +
    100 * (0.2 * (bw.lb + (m ? 135 : 95)))
  )

  return {
    '2025-01': e1, '2025-02': e2, '2025-03': e3, '2025-04': e4,
    '2025-06': e6, '2025-07': e7, '2025-08': e8, '2025-09': e9, '2025-10': e10,
  }
}

const men = compute('men')
const women = compute('women')

const workModel = {
  assumptions: [
    'Reference body mass: men 195 lb (88.5 kg), women 145 lb (65.8 kg); identical within a division, so athlete comparisons inside an event depend only on time.',
    'Lifts and gymnastics: external mechanical work (load and/or body mass x displacement) at 20% mechanical efficiency.',
    'Running: 1.0 kcal per kg per km. Erg calories: displayed cal = kcal (the Concept2 calorie display is itself a metabolic estimate). Rowing: 70/60 J per m mechanical at 21% efficiency.',
    'Loaded carries: load x distance x 0.04 horizontal-cost proxy. Yoke load (unpublished) estimated at 600/400 lb.',
    'Event 5 (1RM Back Squat) is excluded from the power curve: no time component. Shown as peak strength.',
    'The external-work method under-measures high-turnover gymnastics and jump-rope (double-under crossovers, fast toes-to-bars, wall walks) and grip/balance/isometric work. So "All Crossed Up" and "Climbing Couplet" read low in absolute watts despite being hard, fast efforts. That gap is a known limit of the model, not a fitness gap; those events are marked under-measured.',
    'Capped scores (CAP+n): work scaled by completed fraction, time set to the estimated cap; flagged as estimates.',
    'Erg devices (ski, bike, echo) use different internal calorie algorithms, so cross-device absolute comparisons are looser than within-event comparisons.',
  ],
  // Events whose ABSOLUTE watts under-count real metabolic cost (see assumption
  // above). Within-event athlete comparisons stay valid; the bars are marked.
  // These are skill/grip-limited, not engine-limited, so they are shown as dots
  // but excluded from the Critical Power fit.
  underMeasured: ['2025-02', '2025-03'],
  // The Critical Power model (P = CP + W'/t) is only valid for all-out efforts
  // of roughly 2-20 min. Events outside this window (a 46-min endurance piece,
  // or sub-2-min) are plotted as dots but excluded from each athlete's fit.
  cpFitWindowSec: [120, 1800],
  capEstimates: {
    // E3 had an unpublished running cap; estimated from slowest finishers
    '2025-03': { capSecMen: 600, capSecWomen: 780, totalUnits: 20 },
  },
  events: {},
}

for (const id of Object.keys(men)) {
  workModel.events[id] = {
    workKjMen: Math.round(men[id]),
    workKjWomen: Math.round(women[id]),
  }
}

const results = JSON.parse(readFileSync(RESULTS, 'utf8'))
results.workModel = workModel
writeFileSync(RESULTS, JSON.stringify(results, null, 2))

console.log('Work model (kJ, metabolic-equivalent):')
console.log('event       men   women')
for (const id of Object.keys(men)) {
  console.log(`${id}  ${String(Math.round(men[id])).padStart(5)}  ${String(Math.round(women[id])).padStart(5)}`)
}
console.log('\nWinner-power sanity check (men, metabolic W):')
const winnersSec = { '2025-01': 2776, '2025-02': 366.5, '2025-03': 334.9, '2025-04': 988.6, '2025-06': 190.7, '2025-07': 257.5, '2025-08': 496.4, '2025-09': 155, '2025-10': 473.4 }
for (const [id, t] of Object.entries(winnersSec)) {
  console.log(`${id}: ${Math.round((men[id] * 1000) / t)} W over ${Math.round(t)}s`)
}
