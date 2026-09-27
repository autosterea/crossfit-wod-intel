import { useEffect, useRef } from 'react'
import type { LabelSpec, Rect } from '../types'
import {
  registerLabel,
  registerObstacle,
  registerWorldObstacle,
  unregisterLabel,
  unregisterObstacle,
  unregisterWorldObstacle,
  type LabelMode,
  type WorldObstacle,
} from './registry'

export { setLabelText, bumpObstacles } from './registry'
export type { WorldObstacle, LabelMode } from './registry'

export interface UseLabelsOpts {
  /**
   * Which story mode these labels show in (default 'story'). A chapter keeps
   * its story scene mounted under explore (README "Prewarm"), so its story
   * labels hide themselves there; explore scenes pass 'explore'.
   */
  mode?: LabelMode
}

const REREG_WARN = 30

/** Register a set of labels while mounted. Pass a MEMOISED array. */
export function useLabels(specs: readonly LabelSpec[], opts?: UseLabelsOpts): void {
  const owner = useRef<symbol>(Symbol('labels'))
  const count = useRef(0)
  const mode = opts?.mode ?? 'story'
  useEffect(() => {
    count.current++
    if (count.current === REREG_WARN)
      console.warn('[labels] a useLabels array changed identity ' + REREG_WARN + ' times (first id "' + (specs[0]?.id ?? '') + '"); memoise it')
    const o = owner.current
    for (const s of specs) registerLabel(s, o, mode)
    return () => {
      for (const s of specs) unregisterLabel(s.id, o)
    }
  }, [specs, mode])
}

/** Register one screen-space label while mounted. Pass a memoised spec. */
export function useLabel(spec: LabelSpec | null, opts?: UseLabelsOpts): void {
  const owner = useRef<symbol>(Symbol('label'))
  const mode = opts?.mode ?? 'story'
  useEffect(() => {
    if (!spec) return
    const o = owner.current
    registerLabel(spec, o, mode)
    return () => unregisterLabel(spec.id, o)
  }, [spec, mode])
}

/** A DOM rect (stage CSS px) labels must avoid, e.g. the HUD chip. */
export function useObstacle(id: string, rect: () => Rect | null): void {
  useEffect(() => {
    registerObstacle(id, rect)
    return () => unregisterObstacle(id)
  }, [id, rect])
}

/**
 * A world-space obstacle labels must avoid: an SDF plate (box), data dots or
 * curve samples (points). Projected by the placer with the live camera, so it
 * always matches what is on screen. Pass a MEMOISED spec.
 */
export function useWorldObstacle(id: string, spec: WorldObstacle): void {
  useEffect(() => {
    registerWorldObstacle(id, spec)
    return () => unregisterWorldObstacle(id, spec)
  }, [id, spec])
}
