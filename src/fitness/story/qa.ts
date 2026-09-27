import { useEffect, useRef } from 'react'

/* =========================================================================
   QA probes (amendment H.46): a chapter can expose a read-only snapshot of
   internal state that screenshots cannot check (for example the end points
   of a geometry buffer, to prove a cached writer followed a frame change).
   story-qa.mjs reads it through window.__story.probe(id). Probes must be
   cheap, allocation-tolerant (QA only) and side-effect free.
   ========================================================================= */

const probes = new Map<string, () => unknown>()

export function runProbe(id: string): unknown {
  const fn = probes.get(id)
  return fn ? fn() : null
}

export const probeIds = (): string[] => [...probes.keys()]

/** Register a QA probe while the component is mounted. */
export function useQAProbe(id: string, fn: () => unknown): void {
  const f = useRef(fn)
  f.current = fn
  useEffect(() => {
    const call = () => f.current()
    probes.set(id, call)
    return () => {
      if (probes.get(id) === call) probes.delete(id)
    }
  }, [id])
}
