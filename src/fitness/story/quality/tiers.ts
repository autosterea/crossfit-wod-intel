import type { Tier } from '../types'
import { parseQuery } from '../url'

/* Quality tiers (DESIGN.md C.10). The engine is the only DPR owner. */

export interface TierSpec {
  dpr: [number, number]
  composer: boolean
  msaa: number
  smaa: boolean
  bloomLevels: number
  bloomScale: number
  grain: boolean
  particleScale: number
}

export const TIERS: Record<Tier, TierSpec> = {
  high: { dpr: [1, 2], composer: true, msaa: 4, smaa: false, bloomLevels: 7, bloomScale: 1, grain: true, particleScale: 1 },
  medium: { dpr: [1, 1.5], composer: true, msaa: 0, smaa: true, bloomLevels: 5, bloomScale: 0.5, grain: false, particleScale: 0.55 },
  low: { dpr: [1, 1], composer: false, msaa: 0, smaa: false, bloomLevels: 0, bloomScale: 0, grain: false, particleScale: 0 },
}

/** ?tier if present; else coarse pointer on a small screen starts MEDIUM; else HIGH. */
export function initialTier(): { tier: Tier; pinned: boolean } {
  const q = parseQuery()
  if (q.tier) return { tier: q.tier, pinned: true }
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const small = Math.min(window.screen.width, window.screen.height) < 500
    return { tier: coarse && small ? 'medium' : 'high', pinned: false }
  } catch {
    return { tier: 'medium', pinned: false }
  }
}

export const tierDown = (t: Tier): Tier => (t === 'high' ? 'medium' : 'low')
export const tierUp = (t: Tier, ceiling: Tier): Tier => {
  const rank = { low: 0, medium: 1, high: 2 } as const
  const next: Tier = t === 'low' ? 'medium' : 'high'
  return rank[next] <= rank[ceiling] ? next : t
}

/** Clamp a DPR to the tier range and the device ratio. */
export function tierDpr(t: Tier, factor = 1): number {
  const [a, b] = TIERS[t].dpr
  const dev = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const hi = Math.min(b, Math.max(1, dev))
  const v = a + (hi - a) * Math.max(0, Math.min(1, factor))
  return Math.round(v * 4) / 4
}
