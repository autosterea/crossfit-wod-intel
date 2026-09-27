import { setConsoleFunction } from 'three'

/* =========================================================================
   three.js console filter (DESIGN.md E.15: no warnings from the lesson).
   R3F 9.8 still creates a THREE.Clock for its store, and three r183
   deprecates Clock with a warning on every Canvas mount. That warning is not
   ours and cannot be fixed without changing R3F, so it is dropped here;
   every other three.js message passes through unchanged.
   ========================================================================= */

const DROP = /THREE\.Clock: This module has been deprecated/

let installed = false
export function installThreeConsoleFilter(): void {
  if (installed) return
  installed = true
  setConsoleFunction((type: string, message: string, ...params: unknown[]) => {
    if (typeof message === 'string' && DROP.test(message)) return
    const fn = type === 'error' ? console.error : type === 'warn' ? console.warn : console.log
    fn(message, ...params)
  })
}

installThreeConsoleFilter()
