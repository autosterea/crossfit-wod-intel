/* Deterministic randomness for scenes (L5: no Math.random in scene code). */

/** Seeded PRNG: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stateless hash of an integer to [0, 1). */
export function hash1(i: number): number {
  let x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** Stateless hash of an integer pair to [0, 1). */
export function hash2(i: number, j: number): number {
  return hash1(Math.imul(i | 0, 0x27d4eb2d) ^ (j | 0))
}
