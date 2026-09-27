import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HOPPER_DOMAINS, MODULES, PAL } from '../../fitnessData'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useLabels, useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import { at } from '../../story/cue'
import type { Box, LabelSpec, V3 } from '../../story/types'
import type { IntroLayout } from './layout'
import { N_PTS, REVERSED, closeIndex, dialInk, heroShapes, humpInk, humpsSize, morphFlow, penReversed, pointColors, segColors, toSegments, type HeroShapes } from './introMath'
import {
  BEAT,
  STAGGER,
  closeGlint,
  copyOn,
  dockX,
  dockY,
  dotPop,
  eff,
  fold,
  fullName,
  heroOn,
  inkProgress,
  morphK,
  rowDim,
  rowFade,
  shortName,
  titleSlide,
} from './timeline'
import { exploreDim } from './emphasis'

/* =========================================================================
   The Line (D.1 I0, I1): ONE hero stroke of 256 points. It is drawn on as
   the title's underline, then lifts and travels from cell to cell like a
   coach's pen on one whiteboard, becoming in turn the Skills decagon, the
   Hopper drum, the three Energy humps and the Continuum dial. Every morph
   flows along the stroke (a per-point stagger), and the new ink is written
   onto the line by the pen head riding the morph's front, so each model is
   literally redrawn in its own colour as it takes shape. As each shape
   closes it is named with its full MODULES label ("10 Physical Skills":
   the ten sides are the ten skills); when the line moves on, a still copy
   holds the cell. The rest frame of I1 is the four models, large and
   named. In I2 they dock to the D.1 row (short names) as the chart
   arrives, and in I4 each flies into its map tile.
   ========================================================================= */

/** The model each copy becomes in the map: tiles 01, 02, 03 and 05. */
export const TILE_OF_COPY = [0, 1, 2, 4] as const
const NAMES = ['skills', 'hopper', 'pathways', 'continuum'].map((k) => MODULES.find((m) => m.key === k)!)
/** D.1 lexicon: MODULES label while a model is large, mobileLabel once docked. */
const FULL_TEXT = NAMES.map((m) => m.label)
const SHORT_TEXT = NAMES.map((m) => m.mobileLabel ?? m.label)

/** Copy c's transform at T: its cell (I1) -> its docked slot (I2) -> its tile (I4). */
export function copyXf(T: number, c: number, L: IntroLayout, out: { x: number; y: number; s: number }): void {
  const gx = dockX(T, c)
  const gy = dockY(T, c)
  const d = fold(T, TILE_OF_COPY[c])
  const cx = L.cells.xs[c]
  const cy = L.cells.ys[c]
  const dx = L.dock.xs[c]
  const dy = L.dock.y
  const ds = L.dock.r / L.cells.r
  const tile = L.tiles.c[TILE_OF_COPY[c]]
  const tx = tile[0]
  const ty = tile[1] + L.tiles.lift
  const ts = L.tiles.r / L.cells.r
  out.x = cx + (dx - cx) * gx + (tx - dx) * d
  out.y = cy + (dy - cy) * gy + (ty - dy) * d
  out.s = 1 + (ds - 1) * gy + (ts - ds) * d
}

/* ------------------------------ the hero ------------------------------ */

/** Shape w (with the underline riding up with the title before it lifts off). */
function writeHero(T: number, sh: HeroShapes, lift: number, out: Float32Array, tmp: Float32Array): void {
  const S = sh.world
  // before the first morph the underline rises with the title (I1 0 to 0.12)
  const k0 = morphK(T, 0)
  if (k0 <= 0) {
    const dy = lift * titleSlide(T)
    const s = S[0]
    for (let i = 0; i < out.length; i += 3) {
      out[i] = s[i]
      out[i + 1] = s[i + 1] + dy
      out[i + 2] = s[i + 2]
    }
    return
  }
  for (let w = 0; w < 4; w++) {
    const k = morphK(T, w)
    if (k <= 0) {
      out.set(S[w])
      return
    }
    if (k < 1) {
      let from = S[w]
      if (w === 0) {
        // the underline lifts off from where it rose to
        for (let i = 0; i < tmp.length; i += 3) {
          tmp[i] = S[0][i]
          tmp[i + 1] = S[0][i + 1] + lift
          tmp[i + 2] = S[0][i + 2]
        }
        from = tmp
      }
      morphFlow(out, from, S[w + 1], sh.soft[w + 1], k, STAGGER, REVERSED[w])
      return
    }
  }
  out.set(S[4])
}

const INK_COLOR = [PAL.chalk, PAL.yellowGreen, PAL.chalk, PAL.chalk, PAL.chalk] as const

/** Pen j is shown while its ink is on the line and the next ink has not covered it yet. */
function inkVisible(T: number, j: number): number {
  if (!heroOn(T)) return 0
  if (inkProgress(T, j) <= 0) return 0
  if (j < 4 && inkProgress(T, j + 1) >= 1) return 0
  return 1
}

/** Per-layout hero buffers: a new layout gives new shapes and so new caches. */
interface HeroCache {
  pts: Float32Array
  tmp: Float32Array
  key: number
  /** the T each ink pen last wrote its segments at */
  last: number[]
}

function Hero({ L, shapes }: { L: IntroLayout; shapes: HeroShapes }) {
  const cache = useMemo<HeroCache>(
    () => ({ pts: new Float32Array(shapes.world[0].length), tmp: new Float32Array(shapes.world[0].length), key: NaN, last: [NaN, NaN, NaN, NaN, NaN] }),
    [shapes],
  )
  const hero = (T: number): Float32Array => {
    const e = eff(T)
    if (e !== cache.key) {
      writeHero(T, shapes, 0.5, cache.pts, cache.tmp)
      cache.key = e
    }
    return cache.pts
  }

  const segs = useMemo(() => {
    const s = new Float32Array((N_PTS - 1) * 6)
    toSegments(shapes.world[0], s)
    return s
  }, [shapes])
  const colors = useMemo(() => {
    const hs = humpsSize(L.cells.r)
    return [null, null, null, segColors(N_PTS, humpInk(shapes.local[2], hs.w)), segColors(N_PTS, dialInk(shapes.local[3], L.cells.r))]
  }, [shapes, L.cells.r])

  return (
    <>
      {[0, 1, 2, 3, 4].map((j) => (
        <PenBatch
          key={j}
          segments={segs}
          colors={colors[j] ?? undefined}
          color={INK_COLOR[j]}
          width={PEN.hero}
          renderOrder={36 + j}
          head
          hot
          progress={(T) => inkProgress(T, j)}
          opacity={(T) => inkVisible(T, j)}
          update={(T, s) => {
            if (!inkVisible(T, j)) return false
            const e = eff(T)
            if (cache.last[j] === e) return false
            cache.last[j] = e
            // a reversed pen is written from the stroke's end, so its draw-on rides that morph's front
            toSegments(hero(T), s, penReversed(j))
            return true
          }}
        />
      ))}
    </>
  )
}

/* ------------------------------ the copies ----------------------------- */

const xf = { x: 0, y: 0, s: 1 }
/** world radius of a drum dot at full size */
const DOT_R = 0.2

function Copy({ L, shapes, c }: { L: IntroLayout; shapes: HeroShapes; c: number }) {
  const group = useRef<THREE.Group>(null)
  const pc = useMemo(() => {
    if (c === 2) return pointColors(N_PTS, humpInk(shapes.local[2], humpsSize(L.cells.r).w))
    if (c === 3) return pointColors(N_PTS, dialInk(shapes.local[3], L.cells.r))
    return undefined
  }, [c, shapes, L.cells.r])
  useSafeFrame('intro copy ' + c, (T) => {
    const g = group.current
    if (!g) return
    copyXf(T, c, L, xf)
    g.position.set(xf.x, xf.y, 0.02)
    g.scale.setScalar(xf.s)
    g.visible = copyOn(T, c)
  }, { hide: group })
  return (
    <group ref={group}>
      <Pen
        points={shapes.local[c]}
        color={c === 0 ? PAL.yellowGreen : PAL.chalk}
        pointColors={pc}
        width={PEN.data}
        renderOrder={34}
        opacity={(T) => (copyOn(T, c) ? rowFade(T) : 0)}
        dim={(T) => Math.max(0.2, rowDim(T) * exploreDim(TILE_OF_COPY[c]))}
      />
    </group>
  )
}

/** The Hopper drum's five domain dots (they pop as it closes, then ride with its copy). */
function DrumDots({ L, shapes }: { L: IntroLayout; shapes: HeroShapes }) {
  const colors = useMemo(() => HOPPER_DOMAINS.map((d) => d.color), [])
  const d = useMemo(() => ({ x: 0, y: 0, s: 1 }), [])
  return (
    <Nodes
      count={5}
      radius={DOT_R}
      color={PAL.chalk}
      colors={colors}
      rimStrength={0.6}
      emissiveIntensity={0.55}
      place={(T, i, out) => {
        copyXf(T, 1, L, d)
        const p = shapes.dots[i]
        out[0] = d.x + p[0] * d.s
        out[1] = d.y + p[1] * d.s
        out[2] = 0.06
        const vis = rowFade(T)
        if (vis <= 0.002) return 0
        return dotPop(T, i) * (0.45 + 0.55 * d.s)
      }}
      opacity={(T) => Math.min(1, rowFade(T)) * (0.35 + 0.65 * Math.max(0, (rowDim(T) - 0.35) / 0.65)) * exploreDim(1)}
    />
  )
}

/* ------------------------------- labels -------------------------------- */

/** 1 at full brightness, 0.45 with the row dimmed under the chart. */
const rowLabelDim = (T: number) => 0.45 + 0.55 * Math.max(0, (rowDim(T) - 0.35) / 0.65)

function useModelLabels(L: IntroLayout, shapes: HeroShapes) {
  const specs = useMemo<LabelSpec[]>(() => {
    // one baseline per row: every name hangs below the lowest mark of the
    // row, the tallest glyph's foot or the drum's bottom dot (DrumDots size)
    const half = Math.max(...shapes.half)
    const dotR = Math.max(...shapes.dots.map((d) => -d[1]))
    const foot = (s: number) => Math.max(half * s, dotR * s + DOT_R * (0.45 + 0.55 * s))
    const anchorOf = (c: number) => {
      const out: [number, number, number] = [0, 0, 0]
      const t = { x: 0, y: 0, s: 1 }
      return (T: number): V3 => {
        copyXf(T, c, L, t)
        out[0] = t.x
        out[1] = t.y - foot(t.s) - 0.06
        out[2] = 0.02
        return out
      }
    }
    const full = NAMES.map<LabelSpec>((m, c) => ({
      id: `intro-m-full-${c}`,
      text: FULL_TEXT[c],
      // where a cell is too narrow for the full label (360 px), the short name
      ...(SHORT_TEXT[c] !== FULL_TEXT[c] ? { short: SHORT_TEXT[c] } : {}),
      tone: 'name' as const,
      color: m.accent,
      anchor: anchorOf(c),
      prefer: 'S' as const,
      only: ['S', 'SE', 'SW'] as const,
      gapPx: 7,
      priority: 72,
      required: true,
      // named as it closes (D.1), held through the I1 rest, gone as it docks
      cue: (T: number) => fullName(T, c),
    }))
    const short = NAMES.map<LabelSpec>((m, c) => ({
      id: `intro-m-${c}`,
      text: SHORT_TEXT[c],
      tone: 'name' as const,
      color: m.accent,
      anchor: anchorOf(c),
      prefer: 'S' as const,
      only: ['S', 'SE', 'SW'] as const,
      gapPx: 6,
      // a cramped rect staggers the names with leaders rather than hiding one
      leader: true,
      priority: 70,
      required: true,
      // docked: dims with the row under the chart; gone before the map
      cue: (T: number) => shortName(T, c) * rowLabelDim(T) * (1 - at(eff(T), BEAT.lifetime, 0, 0.2)),
    }))
    return [...full, ...short]
  }, [L, shapes])
  useLabels(specs)

  // I2: the docked row is a mark the axis titles never sit on
  const row = useMemo<WorldObstacle>(() => {
    const d = L.dock
    const r = d.r * 1.12
    const b: Box = [
      [d.xs[0] - r, d.y - d.r, 0],
      [d.xs[d.xs.length - 1] + r, d.y + d.r, 0],
    ]
    return {
      box: (T: number) => {
        const e = eff(T)
        return e > BEAT.definition + 0.15 && e < BEAT.lifetime + 0.2 ? b : null
      },
      padPx: 2,
    }
  }, [L])
  useWorldObstacle('intro-dock-row', row)
}

/* -------------------------------- line --------------------------------- */

export function TheLine({ L }: { L: IntroLayout }) {
  const shapes = useMemo(() => heroShapes(L), [L])
  useModelLabels(L, shapes)
  return (
    <>
      <Hero L={L} shapes={shapes} />
      {[0, 1, 2, 3].map((c) => (
        <Copy key={c} L={L} shapes={shapes} c={c} />
      ))}
      <DrumDots L={L} shapes={shapes} />
      {/* each shape closes with a glint where the pen finishes it (12 o'clock; the humps' right foot) */}
      <Glows
        count={4}
        sizePx={54}
        colors={['#f4ffe0']}
        gain={1.9}
        place={(T, c, out) => {
          const s = shapes.world[c + 1]
          const n = closeIndex(c + 1)
          out[0] = s[n * 3]
          out[1] = s[n * 3 + 1]
          out[2] = 0.08
          return closeGlint(T, c)
        }}
      />
    </>
  )
}
