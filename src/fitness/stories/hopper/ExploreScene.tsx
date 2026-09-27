import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PAL } from '../../fitnessData'
import { focusRect } from '../../story/camera/focusRect'
import { useStoryStore } from '../../story/store'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useStageHotspot } from '../../story/hotspots'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import type { Box } from '../../story/types'
import { BD, BH, slotY, type World } from './layout'
import { boardAt } from './timeline'
import { NAMES, N_ATH } from './hopperMath'
import { ex, useHopExplore } from './exploreStore'
import { railY } from './Board'

/* =========================================================================
   The hopper's explore layer (DESIGN.md D.3 "Explore", C.12). Not driven by
   T: the explore run plays on its own clock (ex.X, seconds) while
   exploring, and the shared board, ticket and drum read it through the
   same evaluator the story uses. Damped here (explore may damp): the thread
   chart's step in and the ticket's size (a small flick card while draws
   rain, the full ticket for a single draw). Each rail is a real button
   (a stage hotspot): tapping it shows that athlete's five domain scores
   and marks the rail with a faint glass plate.
   ========================================================================= */

/** Damped explore values shared with the scene's visibility functions. */
export const exAnim = { chart: 0, shrink: 1, compact: 0 }

/**
 * Explore with the phone's sheet expanded (a short focus rect; it reads as
 * L): the rails alone, as shapes; the legend, the ticket, the drum and the
 * rails' words step aside, since the expanded sheet carries the numbers
 * (Generalist, Top specialist, Leader). The same threshold hides the legend.
 */
export const compactTarget = () => (focusRect.shell === 'phone' && focusRect.h <= 420 ? 1 : 0)

const damp = THREE.MathUtils.damp

function RailHotspot({ w, a }: { w: World; a: number }) {
  useStageHotspot(`hop-rail-${a}`, {
    box: (): Box | null => {
      if (useHopExplore.getState().view !== 'rails' || exAnim.chart > 0.5) return null
      const b = boardAt(ex.sched, ex.X, w.rails.len)
      const y = railY(w, b, a)
      return [
        [w.rails.x0, y - BH / 2 - 0.12, 0],
        [w.rails.x0 + w.rails.len, y + BH / 2 + 0.5, BD / 2],
      ]
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
    const b = boardAt(ex.sched, ex.X, w.rails.len)
    exAnim.shrink = b.face > 0 ? ex.sched.kind[b.face - 1] : 1
    exAnim.compact = compactTarget()
  }, [mode, w])

  // the explore clock runs right after the story clock (-100) and before the
  // camera (-90), the labels (-80) and the DOM readouts (-70), so every
  // consumer in a frame reads the same explore time
  useSafeFrame(
    'hopper explore clock',
    (_T, _A, dtRaw) => {
      const st = useStoryStore.getState()
      if (st.mode !== 'explore') return
      const dt = Math.min(0.05, dtRaw)
      ex.X += dt
      const to = useHopExplore.getState().view === 'runs' ? 1 : 0
      // reduced motion: the view switch is a cut
      exAnim.chart = st.reduced ? to : damp(exAnim.chart, to, 6, dt)
      const b = boardAt(ex.sched, ex.X, w.rails.len)
      const kind = b.face > 0 ? ex.sched.kind[b.face - 1] : 1
      exAnim.shrink = st.reduced ? kind : damp(exAnim.shrink, kind, 9, dt)
      exAnim.compact = st.reduced ? compactTarget() : damp(exAnim.compact, compactTarget(), 7, dt)
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
        opacity={() => (useStoryStore.getState().mode === 'explore' ? 1 - exAnim.chart : 0)}
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
