import { FAULT_KEYS, NO_FAULTS, applyFaults, faultLevel, type Faults } from './faults'
import { faultLoad, move, phaseAt, sampleMove, type MoveKey, type MoveSpec, type PhaseId } from './moves'
import { NEUTRAL, evaluate, landmark, newPose, readAngles, type LandmarkId, type Pose, type PoseParams } from './rig'
import { v3, type Vec } from './vec'

/* =========================================================================
   The athlete driver (story/kit/athlete): what a story hands the kit.

   A story describes its athlete as a pure function of story time:

     const drive = (T: number): AthleteState => ({
       move: 'mb-clean',
       phase: knotPhase(T - 4, [[0.26, 0.12], [0.36, 0.36], [0.46, 0.5], [0.56, 0.72]]),
       faults: { lumbar: at(T, 4, 0.6, 0.72) },   // 0 textbook .. 1 rounded
     })
     const rig = useAthleteRig(drive)
     rig.place = { x: 1.2, y: 0, z: 0, s: 3.4 }    // mid-foot root and stature scale, in chart units

   rig.pose(T) poses the skeleton in the athlete's own metres (cached per
   T); rig.at(T, 'lumbar') is a landmark in WORLD units (the placement
   applied) for a label anchor; rig.faults(T) the amounts applied. Nothing
   here keeps history: the same `?beat=N&t=X` is always the same frame.
   ========================================================================= */

export interface AthleteState {
  move: MoveKey
  /** rep phase, 0 (set-up) .. 1 (the rep's end); wraps */
  phase: number
  /** deviation amounts, 0 (textbook) .. 1 (clearly broken); missing keys are 0 */
  faults?: Partial<Faults> | null
}

export type AthleteDrive = (T: number) => AthleteState

export interface RigOpts {
  /** ignore the drive's faults: the textbook position at the same phase (a ghost of the ideal) */
  ideal?: boolean
  /** the placement as a pure function of T (it wins over `place`; labels and the figure read the same value) */
  placeAt?: (T: number, out: Placement) => void
}

/** Where an athlete stands in the scene: its mid-foot root (world units) and its scale (world units per metre). */
export interface Placement {
  x: number
  y: number
  z: number
  /** world units per metre of athlete (a 1.78 m athlete at s = 2 is 3.56 units tall) */
  s: number
}

/**
 * A placement in chart (world) units: the mid-foot root, the floor height
 * and the athlete's stature in world units (the 1.78 m athlete is scaled to
 * it). STORYBOARD-technique T4: placeFor(frame.x(0.42), frame.y(0.04), 0.62 * FH).
 */
export function placeFor(x: number, groundY: number, stature: number, z = 0, out?: Placement): Placement {
  const o = out ?? { x: 0, y: 0, z: 0, s: 1 }
  o.x = x
  o.y = groundY
  o.z = z
  o.s = stature / 1.78
  return o
}

export class AthleteRig {
  readonly drive: AthleteDrive
  readonly ideal: boolean
  /** the athlete's root and scale; the scene sets it (e.g. per layout), the component and landmarks read it */
  place: Placement = { x: 0, y: 0, z: 0, s: 1 }
  /** optional: the placement as a pure function of T (evaluated with the pose) */
  placeAt: ((T: number, out: Placement) => void) | null
  /** bumps whenever the pose changes (writers key on it) */
  version = 0
  private P = newPose()
  private lastT = NaN
  private st: AthleteState = { move: 'mb-clean', phase: 0 }
  private f: Faults = { ...NO_FAULTS }
  private params: PoseParams = { ...NEUTRAL }
  private stand: PoseParams = { ...NEUTRAL }
  private spec: MoveSpec | null = null
  private k = 0
  private tmp = v3()

  constructor(drive: AthleteDrive, opts: RigOpts = {}) {
    this.drive = drive
    this.ideal = !!opts.ideal
    this.placeAt = opts.placeAt ?? null
  }

  /** Pose the athlete at story time T, in its own metres (cached: repeated calls at one T cost nothing). */
  pose(T: number): Pose {
    if (T === this.lastT) return this.P
    this.lastT = T
    if (this.placeAt) this.placeAt(T, this.place)
    const st = this.drive(T)
    this.st = st
    const spec = move(st.move)
    this.spec = spec
    const p = sampleMove(spec, st.phase, this.params)
    this.k = faultLoad(spec, p)
    const f = this.f
    for (const key of FAULT_KEYS) {
      const v = this.ideal ? 0 : (st.faults?.[key] ?? 0)
      f[key] = v < 0 ? 0 : v > 1 ? 1 : v
    }
    if (faultLevel(f) > 0) {
      sampleMove(spec, 0, this.stand)
      if (spec.family === 'pull' && f.lumbar > 0 && this.k > 0) {
        // the rounded back: the hips rise AHEAD of the chest. The chest (the shoulders) stays at the
        // textbook height of this phase, so the ball does not rise with the hips: solve the lean for it.
        evaluate(this.P, p, spec.hold, spec.stance)
        const target = (this.P.shoulder[0][1] + this.P.shoulder[1][1]) / 2
        applyFaults(p, f, this.k, this.stand, spec)
        for (let i = 0; i < 5; i++) {
          evaluate(this.P, p, spec.hold, spec.stance)
          const err = (this.P.shoulder[0][1] + this.P.shoulder[1][1]) / 2 - target
          if (Math.abs(err) < 0.0015) break
          // d(shoulder height)/d(lean) is about -0.6 m x sin(lean) per radian
          p.lean += err / (0.6 * Math.max(0.25, Math.sin((p.lean * Math.PI) / 180))) / (Math.PI / 180)
        }
      } else applyFaults(p, f, this.k, this.stand, spec)
    }
    evaluate(this.P, p, spec.hold, spec.stance)
    this.version++
    return this.P
  }

  /** The state the drive gave at T. */
  state(T: number): AthleteState {
    this.pose(T)
    return this.st
  }

  /** The movement at T. */
  moveAt(T: number): MoveSpec {
    this.pose(T)
    return this.spec!
  }

  /** Fault amounts applied at T (all 0 for an ideal rig). */
  faults(T: number): Readonly<Faults> {
    this.pose(T)
    return this.f
  }

  /** How loaded the fault-prone position is at T (squat: depth; pull: the hinge over the ball), 0..1. */
  load(T: number): number {
    this.pose(T)
    return this.k
  }

  /** The named phase at T. */
  phase(T: number): PhaseId {
    this.pose(T)
    return phaseAt(this.st.move, this.st.phase)
  }

  /** The lumbar curve at T, deg: 40 neutral, 0 flat, negative rounded (the lumbar highlight's colour reads it). */
  lumbar(T: number): number {
    return this.pose(T).params.lord
  }

  /** A landmark in the athlete's own metres into `out`. */
  local(T: number, id: LandmarkId, out: Vec, side: 0 | 1 = 0): Vec {
    return landmark(this.pose(T), id, out, side)
  }

  /** Athlete metres -> world (the placement) in place. */
  toWorld(v: Vec): Vec {
    const q = this.place
    v[0] = q.x + v[0] * q.s
    v[1] = q.y + v[1] * q.s
    v[2] = q.z + v[2] * q.s
    return v
  }

  /**
   * A landmark in WORLD units at T. Returns a SHARED tuple (overwritten by
   * the next call): copy it if you keep it. Label anchors return it as is.
   */
  at(T: number, id: LandmarkId, side: 0 | 1 = 0): Vec {
    return this.toWorld(landmark(this.pose(T), id, this.tmp, side))
  }

  /** A landmark in world units into your own vector. */
  into(T: number, id: LandmarkId, out: Vec, side: 0 | 1 = 0): Vec {
    return this.toWorld(landmark(this.pose(T), id, out, side))
  }

  /** Joint angles a coach reads, deg (allocates: QA and probes, not per frame). */
  angles(T: number, side: 0 | 1 = 0) {
    return readAngles(this.pose(T), side)
  }
}

export function createRig(drive: AthleteDrive, opts?: RigOpts): AthleteRig {
  return new AthleteRig(drive, opts)
}
