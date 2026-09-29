import * as THREE from 'three'
import { registry } from '../../story/labels/registry'
import { useStoryStore } from '../../story/store'
import { focusRect } from '../../story/camera/focusRect'
import { grid, gridKind } from './layout'
import { RANKED } from './skillsMath'
import { tagCam } from './tags'

/* =========================================================================
   QA probe `sk-grid` (H.46; read with window.__story.probe('sk-grid')).
   The lineup's names are what the Grid is for, and labels() cannot see two
   of the ways they fail: it reports overlaps, not two names that merely
   touch, and a name that runs out of its own glass plate into the next
   cell. For the grid on screen (the story's S5 or the explore Grid) this
   reports every name whose cue is up but which was not placed (`hidden`),
   every pair closer than 3 px (`touching`) and every name that leaves its
   plate (`outside`); `ok` is false if any list is non-empty. QA only: it
   allocates, and nothing calls it per frame.
   ========================================================================= */

interface NameRect {
  k: number
  name: string
  x: number
  y: number
  w: number
  h: number
}

const MIN_GAP = 3
const _v = new THREE.Vector3()

function projectX(cam: THREE.Camera, x: number, y: number): number {
  _v.set(x, y, 0).project(cam)
  return ((_v.x + 1) / 2) * focusRect.W
}

export function gridProbe() {
  const mode = useStoryStore.getState().mode
  const pre = mode === 'explore' ? 'sk-x-g-' : 'sk-g-'
  const kind = gridKind(focusRect.layout)
  const gr = grid(kind)
  const placed: NameRect[] = []
  const hidden: string[] = []
  for (let k = 0; k < RANKED.length; k++) {
    const e = registry.get(pre + k)
    if (!e || !e.live) continue
    if (!e.visible) {
      hidden.push(RANKED[k].short)
      continue
    }
    placed.push({ k, name: RANKED[k].short, x: e.rect.x, y: e.rect.y, w: e.rect.w, h: e.rect.h })
  }
  const touching: string[] = []
  let minGap = Infinity
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
      const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
      const gap = Math.max(gx, gy)
      minGap = Math.min(minGap, gap)
      if (gap < MIN_GAP) touching.push(`${a.name}|${b.name}:${Math.round(gap)}`)
    }
  const outside: string[] = []
  const cam = tagCam.cam
  if (cam) {
    cam.updateMatrixWorld()
    for (const n of placed) {
      const [x0, y0, x1] = gr.plate(n.k)
      const px0 = projectX(cam, x0, y0)
      const px1 = projectX(cam, x1, y0)
      if (n.x < px0 - 2 || n.x + n.w > px1 + 2) outside.push(`${n.name}:${Math.round(n.x)}-${Math.round(n.x + n.w)} in ${Math.round(px0)}-${Math.round(px1)}`)
    }
  }
  return {
    mode,
    kind,
    live: placed.length + hidden.length,
    placed: placed.length,
    hidden,
    touching,
    outside,
    minGap: placed.length > 1 ? Math.round(minGap * 10) / 10 : null,
    ok: hidden.length === 0 && touching.length === 0 && outside.length === 0,
  }
}
