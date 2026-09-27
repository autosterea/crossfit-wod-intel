import { useEffect, useMemo } from 'react'
import { MODULES } from '../../fitnessData'
import type { FitnessView } from '../../lessonTypes'
import { Plates, type PlateSpec } from '../../story/kit/Plates'
import { useStageHotspot } from '../../story/hotspots'
import { bumpObstacles, useLabels } from '../../story/labels/useLabel'
import { useFitnessStore } from '../../fitnessStore'
import { useStoryStore } from '../../story/store'
import type { Box, LabelSpec } from '../../story/types'
import type { IntroLayout } from './layout'
import { eff, plateIn, tileName, tilesLive } from './timeline'
import { useIntroExplore } from './exploreStore'

/* =========================================================================
   The map (D.1 I4): six tiles, each a faint glass plate with a 1 px ring in
   its chapter accent, named "01 SKILLS" to "06 HEALTH" (a numbered badge
   and the name), and each a REAL button (a stage hotspot sized to the
   projected tile) that opens its chapter. In explore the same six tiles
   stay tappable, and the model picked in the panel is lit.
   ========================================================================= */

export function tileRect(L: IntroLayout, i: number): [number, number, number, number] {
  const [x, y] = L.tiles.c[i]
  const t = L.tiles
  return [x - t.w / 2, y - t.h / 2, x + t.w / 2, y + t.h / 2]
}

function TileHotspot({ L, i }: { L: IntroLayout; i: number }) {
  const m = MODULES[i]
  const box = useMemo<Box>(() => {
    const [x0, y0, x1, y1] = tileRect(L, i)
    return [
      [x0, y0, 0],
      [x1, y1, 0],
    ]
  }, [L, i])
  useStageHotspot(`intro-tile-${m.key}`, {
    box: (T) => (tilesLive(T) ? box : null),
    onActivate: () => useFitnessStore.getState().navigate({ view: m.key as FitnessView }),
    ariaLabel: m.title,
    modes: 'both',
  })
  return null
}

export function TheMap({ L }: { L: IntroLayout }) {
  const sel = useIntroExplore((s) => s.sel)
  const mode = useStoryStore((s) => s.mode)
  const exploring = mode === 'explore'
  const plates = useMemo<PlateSpec[]>(
    () =>
      MODULES.map((m, i) => {
        const lit = exploring && m.key === sel
        return {
          rect: tileRect(L, i),
          // linear-light alphas: a whisper of glass and a 1 px accent ring
          fill: m.accent,
          fillAlpha: lit ? 0.03 : 0.012,
          line: m.accent,
          lineAlpha: lit ? 0.85 : exploring ? 0.18 : 0.34,
        }
      }),
    [L, sel, exploring],
  )

  const labels = useMemo<LabelSpec[]>(
    () =>
      MODULES.map((m, i) => {
        const [x0, y0, x1] = tileRect(L, i)
        return {
          id: `intro-tile-${m.key}`,
          text: m.mobileLabel ?? m.label,
          tone: 'name' as const,
          color: m.accent,
          dot: false,
          badge: m.num,
          // where a tile is too narrow for its name (the expanded card), the numbered badge alone
          short: ' ',
          anchor: [(x0 + x1) / 2, y0 + 0.16, 0.02] as const,
          prefer: 'N' as const,
          only: ['N'] as const,
          gapPx: 3,
          priority: 90,
          required: true,
          cue: (T: number) => tileName(T, i),
        }
      }),
    [L],
  )
  useLabels(labels, { mode: 'both' })
  // the lit tile changed without T changing: place the labels again
  useEffect(() => bumpObstacles(), [sel, exploring])

  return (
    <>
      <Plates plates={plates} radius={0.3} z={-0.08} vis={(T, i) => plateIn(T, i)} opacity={(T) => (eff(T) >= 4 ? 1 : 0)} renderOrder={4} />
      {MODULES.map((m, i) => (
        <TileHotspot key={m.key} L={L} i={i} />
      ))}
    </>
  )
}
