import { AthleteRig, phaseMid, type AthleteState, type Placement, type Pose, type RigOpts } from '../../story/kit/athlete'

/* =========================================================================
   08 TECHNIQUE: the athlete rigs (story kit, H.78) as the chapter uses them.
   ========================================================================= */

/** The pull's middle: where every threshold beat lands, so a held frame shows the back's state. */
export const PULL_LAND = phaseMid('mb-pull', 'pull')

/**
 * A kit rig that re-poses when story time OR its epoch changes. The kit's rig
 * caches its pose by T; a new chart frame at a held T must move the athlete
 * (its placement is in chart units), and explore re-poses it while story
 * time stands still. The base class is keyed by a private counter; the drive
 * and the placement read the real T from `now`, and `epochOf` reads the
 * owner's epoch (a ref the owner bumps). One rig per component lifetime, so
 * every overlay (the ball's seams, the lumbar highlight) keeps following the
 * same figure.
 */
export class KeyedRig extends AthleteRig {
  readonly now: { T: number }
  private readonly epochOf: () => number
  private kT = NaN
  private kE = NaN
  private kN = 0
  constructor(drive: (T: number) => AthleteState, place: (T: number, out: Placement) => void, epochOf: () => number, opts: RigOpts = {}) {
    const now = { T: 0 }
    super(() => drive(now.T), { ...opts, placeAt: (_k, out) => place(now.T, out) })
    this.now = now
    this.epochOf = epochOf
  }
  pose(T: number): Pose {
    const e = this.epochOf()
    if (T !== this.kT || e !== this.kE) {
      this.kT = T
      this.kE = e
      this.kN++
      this.now.T = T
    }
    return super.pose(this.kN)
  }
}
