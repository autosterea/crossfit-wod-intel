import { bumpObstacles } from '../../story/labels/useLabel'

/* =========================================================================
   Which spoke the viewer asked to see (a tap on a portrait key row, or on a
   dot in explore). It is the viewer's own choice, not story state: a deep
   link never sets it, so the story frames stay a pure function of T. The
   scene reads it through `keySel.i` (no React state per frame); the key and
   the explore panel subscribe for their own highlight.
   ========================================================================= */

export const keySel = { i: -1 }
const subs = new Set<() => void>()

export function selectSpoke(i: number): void {
  keySel.i = keySel.i === i ? -1 : i
  bumpObstacles()
  for (const fn of subs) fn()
}
export function clearSpoke(): void {
  if (keySel.i === -1) return
  keySel.i = -1
  for (const fn of subs) fn()
}
export function subscribeSpoke(fn: () => void): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}
export const spokeVersion = (): number => keySel.i
