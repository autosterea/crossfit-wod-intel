import { MODULES } from '../../fitnessData'

/* The six models the intro maps (D.1 I4: "six glowing chapter tiles"), its
   explore chips and its hub list. MODULES also holds chapters 07 (What Is
   CrossFit?, STORYBOARD-crossfit.md) and 08 (Technique,
   STORYBOARD-technique.md), which follow Health in the lesson order; whether
   the overview gains more tiles is an owner decision, so until then the
   intro keeps exactly the six models it was designed for. */
const NOT_MAPPED: readonly string[] = ['crossfit', 'technique']
export const MAP_MODULES = MODULES.filter((m) => !NOT_MAPPED.includes(m.key))
