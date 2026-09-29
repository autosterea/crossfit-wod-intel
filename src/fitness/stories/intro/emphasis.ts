import { MODULES } from '../../fitnessData'
import { useStoryStore } from '../../story/store'
import { useIntroExplore } from './exploreStore'
import { exploreTime } from './timeline'

/* Explore emphasis (D.1 "Explore (intro)"): the model picked in the panel
   keeps its full colour on the map; the other five rest dimmed toward the
   slate (a pen `dim`, never a translucent stroke). Story mode: always 1. */

const KEYS = MODULES.map((m) => m.key)

/** 1 for the picked tile (or in story mode), 0.5 for the others while exploring. */
export function exploreDim(tile: number): number {
  if (!exploreTime.on || useStoryStore.getState().mode !== 'explore') return 1
  return KEYS[tile] === useIntroExplore.getState().sel ? 1 : 0.5
}
