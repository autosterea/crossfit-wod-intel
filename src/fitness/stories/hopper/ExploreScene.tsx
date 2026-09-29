import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { useStoryStore } from '../../story/store'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useStageHotspot } from '../../story/hotspots'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import { BD, BH, newBox, shortPhone, slotY, type World } from './layout'
import { boardAt } from './timeline'
import { NAMES, N_ATH } from './hopperMath'
import { ex, useHopExplore } from './exploreStore'
import { railY } from './Board'

/* =========================================================================
   The hopper's explore layer (DESIGN.md D.3 "Explore", C.12). Not driven by
   T: the explore run plays on its own clock (ex.X, seconds) while
   exploring, and the shared board, ticket and drum read it through the
   same evaluator the story uses. Damped here (explore may damp): the thread
   chart's step in and the sheet's compact board. Each rail is a real button
   (a stage hotspot): tapping it shows that athlete's five domain scores
   and marks the rail with a faint glass plate.

   Rails | Every run is one damped value (exAnim.chart) read three ways, so
   the switch is a clean hand-off: the rails and their words are gone by
   0.45, the camera only starts toward the chart at 0.35, and the chart
   fades in from 0.3 (and the same in reverse).
   ========================================================================= */

/** Damped explore values shared with the scene's visibility functions. */
export const exAnim = { chart: 0, compact: 0 }

const smooth = (a: number, b: number, x: number) => {
  const u = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a)
  return u * u * (3 - 2 * u)
}
/** explore: the rails view's light (1 on the rails, 0 on the chart) */
export const exRails = () => 1 - smooth(0, 0.45, exAnim.chart)
/** explore: the chart's light */
export const exChart = () => smooth(0.3, 1, exAnim.chart)
/** explore: how far the camera has gone from the board to the chart */
export const exCam = () => smooth(0.35, 1, exAnim.chart)

/**
 * A short phone rect (the explore sheet or the story caption expanded; it
 * reads as L): the rails alone; the legend, the ticket, the drum and all names but
 * the Generalist's step aside (the totals, badges and LEAD stay), since the
 * expanded sheet carries the readouts (Generalist, Top specialist, Leader).
 */
export const compactTarget = () => (shortPhone() ? 1 : 0)
/** the compact board now: damped in explore, a cut in the story (it follows the focus rect, like a rotation) */
export const compactNow = () => (useStoryStore.getState().mode === 'explore' ? exAnim.compact : compactTarget())

const damp = THREE.MathUtils.damp

function RailHotspot({ w, a }: { w: World; a: number }) {
  const box = useMemo(() => newBox(), [])
  useStageHotspot(`hop-rail-${a}`, {
    box: () => {
      if (useHopExplore.getState().view !== 'rails' || exAnim.chart > 0.5) return null
      const b = boardAt(ex.sched, ex.X, w.rails.len)
      const y = railY(w, b, a)
      box[0][0] = w.rails.x0
      box[0][1] = y - BH / 2 - 0.12
      box[0][2] = 0
      box[1][0] = w.rails.x0 + w.rails.len
      box[1][1] = y + BH / 2 + 0.5
      box[1][2] = BD / 2
      return box
    },
    onActivate: () => {
      const st = useHopExplore.getState()
      st.select(st.selected === a ? null : a)
    },
    ariaLabel: `${NAMES[a]}: show the five domain scores`,
    modes: 'explore',
  })
  return null
}

export default function ExploreLayer({ w }: { w: World }) {
  const mode = useStoryStore((s) => s.mode)

  // entering explore: the chart and the ticket start where the view says (no damped jump)
  useEffect(() => {
    if (mode !== 'explore') return
    exAnim.chart = useHopExplore.getState().view === 'runs' ? 1 : 0
    exAnim.compact = compactTarget()
  }, [mode, w])

  // the explore clock runs right after the story clock (-100) and before the
  // camera (-90), the labels (-80) and the DOM readouts (-70), so every
  // consumer in a frame reads the same explore time. It rests once every
  // queued draw has played out (an idle board recomputes nothing).
  useSafeFrame(
    'hopper explore clock',
    (_T, _A, dtRaw) => {
      const st = useStoryStore.getState()
      if (st.mode !== 'explore') return
      const dt = Math.min(0.05, dtRaw)
      if (ex.X < ex.end + 0.5) ex.X = Math.min(ex.X + dt, ex.end + 0.5)
      const to = useHopExplore.getState().view === 'runs' ? 1 : 0
      // reduced motion: the view switch is a cut
      exAnim.chart = st.reduced ? to : Math.abs(to - exAnim.chart) < 1e-3 ? to : damp(exAnim.chart, to, 5, dt)
      const ct = compactTarget()
      exAnim.compact = st.reduced ? ct : Math.abs(ct - exAnim.compact) < 1e-3 ? ct : damp(exAnim.compact, ct, 7, dt)
    },
    { priority: -95 },
  )

  // the tapped athlete's rail: a faint glass plate on its rank slot
  const plates = useMemo<PlateSpec[]>(
    () =>
      Array.from({ length: 6 }, (_, k) => {
        const y = slotY(w, k)
        return {
          rect: [w.rails.x0 - 0.9, y - BH / 2 - 0.16, w.rails.x0 + w.rails.len + 0.3, y + BH / 2 + 0.62] as const,
          fill: PAL.chalk,
          fillAlpha: 0.012,
          line: PAL.chalk,
          lineAlpha: 0.22,
        }
      }),
    [w],
  )
  return (
    <>
      {Array.from({ length: N_ATH }, (_, a) => (
        <RailHotspot key={a} w={w} a={a} />
      ))}
      <Plates
        plates={plates}
        radius={0.24}
        z={-BD / 2 - 0.1}
        renderOrder={4}
        opacity={() => (useStoryStore.getState().mode === 'explore' ? exRails() : 0)}
        vis={(_T, k) => {
          const sel = useHopExplore.getState().selected
          if (sel === null) return 0
          const b = boardAt(ex.sched, ex.X, w.rails.len)
          return Math.max(0, 1 - Math.abs(b.rankPos[sel] - k))
        }}
      />
    </>
  )
}
