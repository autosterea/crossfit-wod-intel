/* Easing tokens (DESIGN.md B.1). The CSS in fitness.css uses the same names
   through --ease-* custom properties, so DOM and GL motion feel identical. */

export type Ease = (x: number) => number

const c01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

export const inOutCubic: Ease = (x) => {
  x = c01(x)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
export const outQuint: Ease = (x) => 1 - Math.pow(1 - c01(x), 5)
export const outBack =
  (s = 1.70158): Ease =>
  (x) => {
    x = c01(x)
    const c3 = s + 1
    return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)
  }
export const inOutQuart: Ease = (x) => {
  x = c01(x)
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2
}
export const outQuad: Ease = (x) => {
  x = c01(x)
  return 1 - (1 - x) * (1 - x)
}
export const inCubic: Ease = (x) => {
  x = c01(x)
  return x * x * x
}
export const linear: Ease = (x) => c01(x)

/** The named tokens. `draw` = line draw-on, `settle` = growth / arrival,
 *  `snap` = bricks and dots landing, `morph` = topology and camera moves,
 *  `count` = numbers, `exit` = UI exit, `linear` = time-true sweeps. */
export const ease = {
  draw: inOutCubic,
  settle: outQuint,
  snap: outBack(1.35),
  morph: inOutQuart,
  count: outQuad,
  exit: inCubic,
  linear,
} as const

export type EaseName = keyof typeof ease
