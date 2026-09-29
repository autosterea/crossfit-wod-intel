/* =========================================================================
   Chapter callbacks run inside engine loops (label anchors and cues, world
   obstacles, pen progress / opacity / update, fill and light uniforms, pose
   functions, HUD frame listeners). R3F runs every useFrame subscriber before
   it renders, so ONE throw would skip every render and freeze the stage.
   The engine catches it at the call site instead, hides that one element,
   and warns once per site with the reason.
   ========================================================================= */

const warned = new Set<string>()

export function reportOnce(where: string, err: unknown): void {
  if (warned.has(where)) return
  warned.add(where)
  const msg = err instanceof Error ? err.message : String(err)
  console.warn('[story] ' + where + ' threw and was hidden instead of freezing the stage: ' + msg)
}
