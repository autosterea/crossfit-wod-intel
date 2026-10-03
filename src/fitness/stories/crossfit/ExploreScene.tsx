import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HIERARCHY, PAL } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { bumpObstacles, useLabels } from '../../story/labels/useLabel'
import { useStoryStore } from '../../story/store'
import type { Layout, LabelSpec, V3 } from '../../story/types'
import { LEVELS, sufferOf } from './crossfitMath'
import { useCfExplore } from './exploreStore'
import { ExplorePyramid, emptyStates, emptyXf, exploreStates, slabPoint, stack } from './Pyramid'

/* =========================================================================
   07 CROSSFIT explore scene: the pyramid as an instrument. The viewer picks
   a level and dials its deficiency; the scene follows the store damped: the
   level is crushed, every level above sinks, leans and dims, the ones below
   do not (HIERARCHY_RULE, L1 Guide p. 29). Explore labels name the levels on
   their faces and mark the picked one.
   ========================================================================= */

export default function ExploreScene({ layout }: { layout: Layout }) {
  const cur = useRef<number[]>(Array.from({ length: LEVELS }, () => 0))
  const level = useCfExplore((s) => s.level)

  useSafeFrame('crossfit explore damp', (_T, _A, dt) => {
    if (useStoryStore.getState().mode !== 'explore') return
    const target = useCfExplore.getState().def
    let moved = false
    for (let i = 0; i < LEVELS; i++) {
      const v = THREE.MathUtils.damp(cur.current[i], target[i], 7, Math.min(0.1, dt))
      const snap = Math.abs(v - target[i]) < 0.0005 ? target[i] : v
      if (snap !== cur.current[i]) moved = true
      cur.current[i] = snap
    }
    if (moved) bumpObstacles()
  })

  // anchors read the damped levels through the same stack as the solid
  const st = useMemo(() => emptyStates(), [])
  const xfs = useMemo(() => emptyXf(), [])
  const xfNow = () => stack(layout, exploreStates(cur.current, st), xfs)

  const labels = useMemo<LabelSpec[]>(() => {
    const out: LabelSpec[] = []
    HIERARCHY.forEach((l, i) => {
      const a: [number, number, number] = [0, 0, 0]
      out.push({
        id: `cf-x-lvl-${i}`,
        text: l.label.toUpperCase(),
        tone: 'name',
        color: i === level ? l.color : PAL.chalk,
        dot: i === level,
        anchor: (): V3 => {
          const x = xfNow()[i]
          slabPoint(x, 0, 0, x.d / 2 + 0.05, a)
          return a
        },
        prefer: 'C',
        priority: i === level ? 95 : 88 - i,
        required: true,
        cue: () => 1 - 0.5 * sufferOf(cur.current, i),
      })
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, level])
  useLabels(labels, { mode: 'explore' })
  useEffect(() => bumpObstacles(), [level])

  return <ExplorePyramid layout={layout} def={cur} />
}
