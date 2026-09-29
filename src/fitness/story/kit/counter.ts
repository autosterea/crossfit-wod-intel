import { useEffect, useRef } from 'react'
import { clock, onFrame } from '../clock'
import { setLabelText } from '../labels/registry'

/* useCounter (DESIGN.md C.11): a counting readout written imperatively into
   a label (setLabelText) or a DOM node, driven by the story clock. The value
   is a pure function of T, so a held seek shows the exact number. */

export interface CounterOpts {
  value: (T: number) => number
  format: (v: number) => string
}

/** Count into a registered label. */
export function useCounter(labelId: string, opts: CounterOpts): void {
  const ref = useRef(opts)
  ref.current = opts
  useEffect(() => {
    let last = ''
    return onFrame(() => {
      const s = ref.current.format(ref.current.value(clock.T))
      if (s !== last) {
        last = s
        setLabelText(labelId, s)
      }
    })
  }, [labelId])
}

/** Count into a DOM node (HUD chips). */
export function useDomCounter(el: { current: HTMLElement | null }, opts: CounterOpts): void {
  const ref = useRef(opts)
  ref.current = opts
  useEffect(() => {
    let last = ''
    return onFrame(() => {
      const node = el.current
      if (!node) return
      const s = ref.current.format(ref.current.value(clock.T))
      if (s !== last) {
        last = s
        node.textContent = s
      }
    })
  }, [el])
}
