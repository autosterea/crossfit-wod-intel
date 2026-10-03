import { useMemo } from 'react'
import { createRig, type AthleteDrive, type AthleteRig, type RigOpts } from './driver'

/* =========================================================================
   story/kit/athlete: a side-view athlete for the lesson's stories.

   WHAT IT IS
   A 1.78 m athlete in the lesson's look: a dark ink body lit by the
   stage's environment, drawn with a constant-width chalk pen contour
   (DESIGN.md B: pen strokes; light means amount; only the speaking element
   blooms). Head with a face profile, neck, a trunk lofted along a real
   spine (the lumbar curve is the shape of the back), pelvis, upper arms,
   forearms, hands, thighs, shanks, feet with heels and toes; the medicine
   ball as part of the figure. Joint-space rig (rig.ts): bones keep their
   length, feet stay planted (heels rise only by a fault), knees track the
   toes exactly, the hips' x is solved so the centre of mass sits over
   mid-foot, the ball loads the balance only once it leaves the floor.

   HOW A STORY USES IT

     import { Athlete, LumbarHighlight, BallSeams, useAthleteRig, tempoPhase, phaseMid } from '../../story/kit/athlete'

     // 1. drive: a pure function of story time T (never the ambient clock)
     const drive = (T: number) => ({ move: 'mb-pull', phase: tempoPhase(at(T, 7, 0, 1), W, { land }), faults: { lumbar: f(T) } })
     const rig = useAthleteRig(drive)
     rig.place = { x: 1.2, y: 0.3, z: 0, s: 3.4 }   // mid-foot root (world) and world units per metre

     // 2. draw: the figure (3 calls), and overlays
     <Athlete rig={rig} opacity={(T) => at(T, 4, 0.14, 0.26)} />
     <Athlete rig={ghostRig} look="ghost" />                 // a dashed chalk second figure
     <LumbarHighlight rig={rig} gain={(T) => 1 + 1.6 * lumbarRedness(rig.lumbar(T))} />
     <BallSeams rig={rig} />

     // 3. label: anchors are landmarks in world units
     athleteLabel(rig, 'lumbar', { id: 'tq-rounded', text: 'ROUNDED BACK', tone: 'callout', color: SICK, cue })

   MOVEMENTS (moves.ts): 'mb-clean' (set-up, pull, extend, under, receive,
   stand, finish, return: one rep loops seamlessly), 'mb-pull' (set-up,
   pull, extend, lower: the threshold beats' cycle), and the squat family
   ('air-squat', 'front-squat', 'overhead-squat'). Address positions by
   name: phaseRange(move, 'pull'), phaseMid(move, 'receive'), phaseAt().

   DEVIATIONS (faults.ts): amounts 0 (textbook) .. 1 (clearly broken).
   For the clean, `lumbar` is the article's rounded back: the lumbar curve
   40 -> -20 and the hips rising ahead of the chest (the chest held at its
   textbook height, so the ball stays down). The squat faults heels, knees,
   lumbar, midfoot and depth are kept for a movements chapter.
   deviation(d, mix) and staged(d, windows) spread one amount over faults;
   rig.lumbar(T) and lumbarRedness() give the number a chart can share.

   TIME (tempo.ts): repPhase(seconds, repSeconds); tempoPhase(t, windows,
   { land, start }) for reps that speed up 1 : 1.2 : 1.4 without a jump and
   land on a chosen position at t = 1; knotPhase(t, knots) for one rep whose
   parts each have their own window of beat t.

   FRAMING (frame.ts): athleteBox(move, place) is the box of every position
   of the movement (feet to the ball overhead in the rack), for CamPose.fit.
   ========================================================================= */

export * from './driver'
export * from './moves'
export * from './faults'
export * from './tempo'
export { Athlete, ATHLETE_INK, ATHLETE_LINE, type AthleteProps, type AthleteLook } from './Athlete'
export { LumbarHighlight, BallSeams, Barbell, Floor, JointGlows, athleteLabel, lumbarColor, lumbarCss, lumbarRedness, LIME, CHALK, SICK, LUMBAR_KEPT, LUMBAR_LOST, type JointPoint, type LumbarHighlightProps, type FloorProps } from './overlays'
export { athleteBox, movementBounds } from './frame'
export { BODY } from './body'
export { MIDFOOT, landmark, lumbarCurve, jointAngle, readAngles, type LandmarkId, type Pose, type PoseParams, type Hold, type Stance } from './rig'

/** A rig for this component's lifetime (stable while `drive` and `opts.ideal` are). */
export function useAthleteRig(drive: AthleteDrive, opts?: RigOpts): AthleteRig {
  const ideal = !!opts?.ideal
  const placeAt = opts?.placeAt
  return useMemo(() => createRig(drive, { ideal, placeAt }), [drive, ideal, placeAt])
}
