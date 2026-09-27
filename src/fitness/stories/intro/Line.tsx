import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HOPPER_DOMAINS, MODULES, PAL } from '../../fitnessData'
import { Pen, PenBatch, PEN } from '../../story/kit/Pen'
import { Nodes } from '../../story/kit/Nodes'
import { Glows } from '../../story/kit/Halo'
import { morphPoints } from '../../story/kit/tween'
import { useSafeFrame } from '../../story/useSafeFrame'
import { useLabels } from '../../story/labels/useLabel'
import { at } from '../../story/cue'
import type { LabelSpec, V3 } from '../../story/types'
import type { IntroLayout } from './layout'
import { N_PTS, dialInk, heroShapes, humpInk, humpsSize, pointColors, segColors, toSegments, type HeroShapes } from './introMath'
import {
  BEAT,
  STAGGER,
  closeGlint,
  copyOn,
  dotPop,
  eff,
  fly,
  fold,
  heroOn,
  inkProgress,
  morphK,
  nameIn,
  rowDim,
  rowFade,
  titleSlide,
} from './timeline'
import { exploreDim } from './emphasis'

/* =========================================================================
   The Line (D.1 I0, I1): ONE hero stroke of 256 points. It is drawn on as
   the title's underline, then lifts and becomes, in turn, the Skills
   decagon, the Hopper drum, the three Energy humps and the Continuum dial.
   Every morph flows along the stroke (a per-point stagger), and the new
   ink is written onto the line by the pen head riding the morph's front,
   so each model is literally redrawn in its own colour as it takes shape.
   As each shape closes it is named; a copy then shrinks away into the
   docked row, carrying its name, while the line moves on to the next.
   ========================================================================= */

/** The model each docked copy becomes in the map: tiles 01, 02, 03 and 05. */
export const TILE_OF_COPY = [0, 1, 2, 4] as const
const NAMES = ['skills', 'hopper', 'pathways', 'continuum'].map((k) => MODULES.find((m) => m.key === k)!)
/** Name strings (D.1 lexicon: MODULES mobileLabel or label). */
const NAME_TEXT = NAMES.map((m) => m.mobileLabel ?? m.label)

/** Copy c's transform at T: formation spot -> docked slot (I1) -> its tile (I4). */
export function copyXf(T: number, c: number, L: IntroLayout, out: { x: number; y: number; s: number }): void {
  const f = fly(T, c)
  const d = fold(T, TILE_OF_COPY[c])
  const [fx, fy] = L.form.c
  const dx = L.dock.xs[c]
  const dy = L.dock.y
  const tile = L.tiles.c[TILE_OF_COPY[c]]
  const tx = tile[0]
  const ty = tile[1] + L.tiles.lift
  const ts = L.tiles.r / L.form.r
  out.x = fx + (dx - fx) * f + (tx - dx) * d
  out.y = fy + (dy - fy) * f + (ty - dy) * d
  out.s = 1 + (L.dock.s - 1) * f + (ts - L.dock.s) * d
}

/* ------------------------------ the hero ------------------------------ */

interface HeroCache {
  pts: Float32Array
  key: number
}

/** Shape w (with the underline riding up with the title before it lifts off). */
function writeHero(T: number, S: Float32Array[], lift: number, out: Float32Array, tmp: Float32Array): void {
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
      morphPoints(out, from, S[w + 1], k, STAGGER)
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

function Hero({ L, shapes }: { L: IntroLayout; shapes: HeroShapes }) {
  const cache = useMemo<HeroCache>(() => ({ pts: new Float32Array(N_PTS * 3), key: NaN }), [])
  const tmp = useMemo(() => new Float32Array(N_PTS * 3), [])
  // cached writers key on the layout's shapes (a new layout gives new shapes)
  const hero = (T: number): Float32Array => {
    const e = eff(T)
    if (e !== cache.key) {
      writeHero(T, shapes.world, 0.5, cache.pts, tmp)
      cache.key = e
    }
    return cache.pts
  }
  // a new layout invalidates the cache
  useMemo(() => {
    cache.key = NaN
  }, [shapes, cache])

  const segs = useMemo(() => {
    const s = new Float32Array((N_PTS - 1) * 6)
    toSegments(shapes.world[0], s)
    return s
  }, [shapes])
  const hs = humpsSize(L.form.r)
  const colors = useMemo(
    () => [
      null,
      null,
      null,
      segColors(N_PTS, humpInk(shapes.local[2], hs.w)),
      segColors(N_PTS, dialInk(shapes.local[3])),
    ],
    [shapes, hs.w],
  )
  const lastKey = useRef<number[]>([NaN, NaN, NaN, NaN, NaN])
  useMemo(() => {
    lastKey.current = [NaN, NaN, NaN, NaN, NaN]
  }, [shapes])

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
            if (lastKey.current[j] === e) return false
            lastKey.current[j] = e
            toSegments(hero(T), s)
            return true
          }}
        />
      ))}
    </>
  )
}

/* ------------------------------ the copies ----------------------------- */

const xf = { x: 0, y: 0, s: 1 }

function Copy({ L, shapes, c }: { L: IntroLayout; shapes: HeroShapes; c: number }) {
  const group = useRef<THREE.Group>(null)
  const hs = humpsSize(L.form.r)
  const pc = useMemo(() => {
    if (c === 2) return pointColors(N_PTS, humpInk(shapes.local[2], hs.w))
    if (c === 3) return pointColors(N_PTS, dialInk(shapes.local[3]))
    return undefined
  }, [c, shapes, hs.w])
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
      radius={0.2}
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

function useModelLabels(L: IntroLayout, shapes: HeroShapes) {
  const specs = useMemo<LabelSpec[]>(() => {
    const rowHalf = Math.max(...shapes.half)
    return NAMES.map((m, c) => {
      const out: [number, number, number] = [0, 0, 0]
      const t = { x: 0, y: 0, s: 1 }
      return {
        id: `intro-m-${c}`,
        text: NAME_TEXT[c],
        tone: 'name' as const,
        color: m.accent,
        anchor: (T: number): V3 => {
          copyXf(T, c, L, t)
          out[0] = t.x
          // one baseline for the whole row: every name hangs from the tallest glyph's foot
          out[1] = t.y - rowHalf * t.s - 0.06
          out[2] = 0.02
          return out
        },
        prefer: 'S' as const,
        only: ['S', 'SE', 'SW'] as const,
        gapPx: 6,
        // a cramped rect (the expanded card) staggers the names with leaders rather than hiding one
        leader: true,
        priority: 70,
        required: true,
        // named as it closes; dims with the row under the chart; gone before the map
        cue: (T: number) => nameIn(T, c) * (0.45 + 0.55 * Math.max(0, (rowDim(T) - 0.35) / 0.65)) * (1 - at(eff(T), BEAT.lifetime, 0, 0.2)),
      }
    })
  }, [L, shapes])
  useLabels(specs)
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
      {/* each shape closes with a glint where its two ends meet (12 o'clock; the humps' last point) */}
      <Glows
        count={4}
        sizePx={54}
        colors={['#f4ffe0']}
        gain={1.9}
        place={(T, c, out) => {
          const s = shapes.world[c + 1]
          const n = s.length / 3 - 1
          out[0] = s[n * 3]
          out[1] = s[n * 3 + 1]
          out[2] = 0.08
          return closeGlint(T, c)
        }}
      />
    </>
  )
}
