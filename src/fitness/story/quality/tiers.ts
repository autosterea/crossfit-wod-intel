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
  medium: { dpr: [1, 1.5], composer: true, msaa: 0, smaa: true, bloomLevels: 5, bloomScale: 0.5, grain: false, particleScale: 0.8 },
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

const RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 }
export const tierRank = (t: Tier): number => RANK[t]

/** Clamp a DPR to the tier range and the device ratio. */
export function tierDpr(t: Tier, factor = 1): number {
  const [a, b] = TIERS[t].dpr
  const dev = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const hi = Math.min(b, Math.max(1, dev))
  const v = a + (hi - a) * Math.max(0, Math.min(1, factor))
  return Math.round(v * 4) / 4
}

/* ------------------------------------------------------------------------
   The quality ladder (amendment H.29). Adaptive quality moves one STEP at a
   time along an ordered list of (tier, dpr) pairs, best first. A step down
   inside a tier is only a DPR change (a buffer resize, no shader compile); a
   step across a tier boundary remounts the composer, so it happens only on a
   real, sustained decline.

   HIGH:   min(dpr, 2), 1.75, 1.5
   MEDIUM: "medium+" min(dpr, 2) and 1.75 (reachable only by sustained
           headroom on a 2x / 3x phone), then 1.5 (the phone start), 1.25, 1
   LOW:    1
   ------------------------------------------------------------------------ */

export interface QualityStep {
  tier: Tier
  dpr: number
}

export function qualityLadder(dev = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1): QualityStep[] {
  const d = Math.max(1, Math.min(2, dev))
  const out: QualityStep[] = []
  const push = (tier: Tier, dpr: number) => {
    const v = Math.round(Math.max(1, Math.min(d, dpr)) * 4) / 4
    if (!out.some((s) => s.tier === tier && s.dpr === v)) out.push({ tier, dpr: v })
  }
  for (const v of [2, 1.75, 1.5]) push('high', v)
  for (const v of [2, 1.75, 1.5, 1.25, 1]) push('medium', v)
  push('low', 1)
  return out
}

/** Index of the starting step for a tier: HIGH at its top DPR, MEDIUM at 1.5, LOW. */
export function startStep(ladder: QualityStep[], tier: Tier): number {
  if (tier === 'medium') {
    const want = Math.min(1.5, ladder.find((s) => s.tier === 'medium')?.dpr ?? 1)
    const i = ladder.findIndex((s) => s.tier === 'medium' && s.dpr <= want)
    return i >= 0 ? i : ladder.findIndex((s) => s.tier === 'medium')
  }
  return ladder.findIndex((s) => s.tier === tier)
}

/** The best step adaptation may ever climb to for a starting tier (the ceiling). */
export function ceilingStep(ladder: QualityStep[], tier: Tier): number {
  // phones (MEDIUM start) may climb to "medium+" (DPR up to 2) with sustained headroom;
  // HIGH starts at its own top step; LOW never climbs above MEDIUM's start.
  if (tier === 'high') return 0
  const i = ladder.findIndex((s) => s.tier === 'medium')
  return i >= 0 ? i : 0
}
