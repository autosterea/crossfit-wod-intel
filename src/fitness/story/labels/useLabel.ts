import { useEffect } from 'react'
import type { LabelSpec, Rect } from '../types'
import { registerLabel, registerObstacle, unregisterLabel, unregisterObstacle } from './registry'

export { setLabelText } from './registry'

/** Register one screen-space label while mounted. Pass a memoised spec. */
export function useLabel(spec: LabelSpec | null): void {
  useEffect(() => {
    if (!spec) return
    registerLabel(spec)
    return () => unregisterLabel(spec.id)
  }, [spec])
}

/** Register a set of labels while mounted. Pass a memoised array. */
export function useLabels(specs: readonly LabelSpec[]): void {
  useEffect(() => {
    for (const s of specs) registerLabel(s)
    return () => {
      for (const s of specs) unregisterLabel(s.id)
    }
  }, [specs])
}

/** A DOM rect (stage CSS px) labels must avoid, e.g. the HUD chip. */
export function useObstacle(id: string, rect: () => Rect | null): void {
  useEffect(() => {
    registerObstacle(id, rect)
    return () => unregisterObstacle(id)
  }, [id, rect])
}
