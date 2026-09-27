import { useEffect, useMemo, useRef, useState } from 'react'
import { useStoryStore } from '../../story/store'
import * as THREE from 'three'
import { HOPPER_DOMAINS, PAL } from '../../fitnessData'
import { useSafeFrame } from '../../story/useSafeFrame'
import { SdfText, sdfSafe } from '../../story/kit/SdfText'
import { Pen, PEN } from '../../story/kit/Pen'
import { useWorldObstacle, type WorldObstacle } from '../../story/labels/useLabel'
import type { Box } from '../../story/types'
import { ticketOutline, type TicketXf, type World } from './layout'
import { boardAt, type Sched } from './timeline'
import { STORY } from './hopperMath'
import { ex, useHopExplore } from './exploreStore'

/* =========================================================================
   The ticket (DESIGN.md D.3, the one broadcast element kept besides the HUD):
   a plate in the DRAWN domain's colour with a notch in each short side (the
   drawn ball comes to rest in one), the kicker "DRAW N - DOMAIN" in Barlow
   Condensed SemiBold and the task name in Anton, both in ink. It flips like
   a split-flap card: the old face turns away edge-on, the new one turns in
   and snaps flat. In a rain of draws it shrinks to a small flick card that
   shows only the domain.

   SDF words are the only 3D text in this chapter (D.3 "SDF"). Every story
   face (the five full tickets, the five flick-card domain words) is mounted
   at load (prewarm) and shown by opacity; nothing re-lays text per frame.
   The other twenty task names and the two explore kickers (odd and even
   draws, their text changing once per draw, when it is queued) mount the
   first time explore opens and stay: they share the story words' SDF
   program (no shader links), so the load and every layout change typeset
   15 words, not 37.

   Hyphens: the self-hosted SDF glyph whitelist has no "-" (engine request),
   and troika must never fetch a fallback font, so SdfText sets a space in
   its place. Each such space is found in troika's caret positions and a
   small ink bar is laid over it with the real glyph's proportions (from the
   TTFs: Barlow Condensed SemiBold 0.27 x 0.10 em at 0.30 em over the
   baseline; Anton 0.25 x 0.11 em at 0.31 em), so "DRAW 1 - WEIGHTLIFTING"
   reads with a hyphen, never a dash, and "PULL-UPS" keeps its hyphen.

   Two-line task names are balanced from Anton's advance widths (a number
   stays with its unit), so no line is left with one short word.
   ========================================================================= */

const INK = PAL.ink
const LIGHT = '#e9ffc4'
const STORY_FACES = 5
const KICK_LS = 0.05
const NAME_LS = 0.02

/* ------------------------------ type metrics (from the TTFs) ------------------------------ */

/** Anton advance widths (units per em 2048) for A to Z, 0 to 9 and space; "-" renders as a space. */
const ANTON_ADV = [
  994, 980, 971, 1010, 843, 817, 993, 1022, 464, 955, 967, 814, 1528, 1020, 996, 967, 1011, 976, 945, 810, 970, 961, 1458, 991, 914, 840, 1012, 677, 1012,
  1012, 1012, 1012, 1012, 1012, 1012, 1012, 480,
]
/** Barlow Condensed SemiBold advance widths (units per em 1000), same order. */
const BARLOW_ADV = [
  456, 462, 457, 472, 435, 415, 462, 477, 224, 443, 477, 415, 538, 507, 467, 457, 455, 461, 434, 452, 478, 471, 665, 460, 456, 406, 450, 274, 425, 426, 459,
  428, 429, 392, 434, 423, 200,
]
const advIdx = (ch: string) => {
  const c = ch.charCodeAt(0)
  if (c >= 65 && c <= 90) return c - 65
  if (c >= 48 && c <= 57) return 26 + c - 48
  return 36
}
/** Width of an uppercase line in em (each glyph plus the letter spacing). */
function emWidth(s: string, adv: readonly number[], upm: number, ls: number): number {
  let w = 0
  for (const ch of s) w += adv[advIdx(ch)] / upm + ls
  return w
}
const antonEm = (s: string) => emWidth(s, ANTON_ADV, 2048, NAME_LS)
const barlowEm = (s: string) => emWidth(s, BARLOW_ADV, 1000, KICK_LS)

/** an article ends no line ("CARRY A CHILD / UPHILL", not "CARRY A / CHILD UPHILL") */
const ARTICLES = new Set(['A', 'AN', 'THE'])

/**
 * The task name as it is set: one line when it fits maxW, else two lines
 * balanced to the narrowest longer line, never splitting a number from the
 * word after it ("200 M", "6 FLIGHTS", "50 FT") and never leaving an
 * article at a line's end.
 */
export function balanceName(name: string, size: number, maxW: number): string {
  const up = name.toUpperCase()
  if (antonEm(up) * size <= maxW) return up
  const words = up.split(' ')
  let best = up
  let bestW = Infinity
  for (let i = 0; i < words.length - 1; i++) {
    if (/^\d+$/.test(words[i])) continue
    const a = words.slice(0, i + 1).join(' ')
    const b = words.slice(i + 1).join(' ')
    const wd = Math.max(antonEm(a), antonEm(b)) + (ARTICLES.has(words[i]) ? 3 : 0)
    if (wd < bestW) {
      bestW = wd
      best = a + String.fromCharCode(10) + b
    }
  }
  return best
}

/** Glyph metrics of a hyphen and of the line box (troika centres its caret on (ascender + descender) / 2). */
const HYPHEN = {
  barlowSemi: { mid: 0.4, y: 0.301, h: 0.1, w: 0.271 },
  anton: { mid: (2409 - 674) / 2 / 2048, y: 625 / 2048, h: 232 / 2048, w: 516 / 2048 },
} as const

/** Indices of the hyphens in a string (sdfSafe maps characters one to one). */
const hyphens = (s: string) => {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) if (s[i] === '-') out.push(i)
  return out
}

interface RenderInfo {
  caretPositions?: Float32Array
}

/**
 * Lay an ink bar over each hyphen's space, from the text's caret positions.
 * `bars` are the pre-mounted bar meshes, `dy` the text's offset in the group.
 */
function placeHyphenBars(mesh: THREE.Mesh, idx: readonly number[], bars: (THREE.Mesh | null)[], font: keyof typeof HYPHEN, size: number, ls: number, dy: number, narrow: boolean): boolean {
  const info = (mesh as unknown as { textRenderInfo?: RenderInfo }).textRenderInfo
  const cp = info?.caretPositions
  if (!cp) return false
  const g = HYPHEN[font]
  idx.forEach((h, k) => {
    const bar = bars[k]
    if (!bar || cp.length < h * 4 + 4) return
    const left = cp[h * 4]
    const right = cp[h * 4 + 1]
    const baseline = (cp[h * 4 + 2] + cp[h * 4 + 3]) / 2 - g.mid * size
    // centred in the space plus its letter spacing, so both gaps match
    const x = (left + right + ls * size) / 2
    // between letters (PULL-UPS) a real hyphen has side bearings: keep a hair of air
    const wd = narrow ? Math.min(g.w * size, right - left + ls * size - 0.06 * size) : g.w * size
    bar.position.set(x, dy + baseline + g.y * size, 0.012)
    bar.scale.set(wd, g.h * size, 1)
  })
  return true
}

/* ------------------------------ the ticket ------------------------------ */

export interface TicketProps {
  w: World
  src: (T: number) => { s: Sched; X: number; story: boolean }
  /** where the ticket is at T (position and scale, the flick-card shrink included) */
  place: (T: number) => TicketXf
  /** overall light 0..1 (focus pull, the H6 step back) */
  vis: (T: number) => number
  /** 0 full ticket, 1 the small flick card */
  shrink: (T: number) => number
  /** H1: the pen traces the border once (progress, and its fade) */
  trace: (T: number) => number
  traceOut: (T: number) => number
  railLen: number
}

const kickerText = (d: number, dom: number) => `DRAW ${d + 1} - ${HOPPER_DOMAINS[dom].label.toUpperCase()}`

export function Ticket({ w, src, place, vis, shrink, trace, traceOut, railLen }: TicketProps) {
  const t = w.ticket
  const outline = useMemo(() => ticketOutline(t.w, t.h, t.notch), [t.w, t.h, t.notch])
  const plateGeo = useMemo(() => {
    const s = new THREE.Shape()
    for (let i = 0; i < outline.length / 3 - 1; i++) {
      const x = outline[i * 3]
      const y = outline[i * 3 + 1]
      if (i === 0) s.moveTo(x, y)
      else s.lineTo(x, y)
    }
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [outline])
  const plateMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.weightlifting, transparent: true, depthWrite: false, toneMapped: false }), [])
  const inkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: INK, transparent: true, depthWrite: false, toneMapped: false }), [])
  const barGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(() => () => plateGeo.dispose(), [plateGeo])
  useEffect(() => () => plateMat.dispose(), [plateMat])
  useEffect(() => () => inkMat.dispose(), [inkMat])
  useEffect(() => () => barGeo.dispose(), [barGeo])
  const colors = useMemo(() => HOPPER_DOMAINS.map((d) => new THREE.Color(d.color)), [])

  /* ---------------- layout, all from the type metrics (no per-frame text layout) ---------------- */
  const inner = t.w - 2 * t.notch - 0.3
  const kickY = t.h / 2 - 0.14 - t.kick * 0.5
  const nameY = (kickY - t.kick * 0.55 + (-t.h / 2 + 0.12)) / 2
  const kickFit = (s: string) => Math.min(1, inner / (barlowEm(s) * t.kick))
  // the story's five full tickets
  const storyKick = useMemo(() => Array.from({ length: STORY_FACES }, (_, d) => kickerText(d, STORY.dom[d])), [])
  const names = useMemo(() => HOPPER_DOMAINS.map((dm) => dm.tasks.map((task) => balanceName(task, t.name, t.maxW))), [t.name, t.maxW])
  // the flick card: the domain word alone, as large as the plate allows
  const flickScale = useMemo(() => HOPPER_DOMAINS.map((dm) => Math.min(1.7, inner / (barlowEm(dm.label.toUpperCase()) * t.kick))), [inner, t.kick])

  /* ---------------- explore: two kicker meshes, odd and even draws ---------------- */
  // the explore-only words mount the first time explore opens
  const mode = useStoryStore((s) => s.mode)
  const [exploreSeen, setExploreSeen] = useState(false)
  useEffect(() => {
    if (mode === 'explore') setExploreSeen(true)
  }, [mode])
  const storyTasks = useMemo(() => new Set(Array.from({ length: STORY_FACES }, (_, d) => STORY.dom[d] * 5 + STORY.task[d])), [])
  const exN = useHopExplore((s) => s.n)
  const exRun = useHopExplore((s) => s.runId)
  const exKick = useMemo(() => {
    const out: { d: number; text: string }[] = [
      { d: -1, text: 'DRAW' },
      { d: -1, text: 'DRAW' },
    ]
    const s = ex.sched
    for (let d = s.n - 1; d >= 0 && (out[0].d < 0 || out[1].d < 0); d--) {
      const j = d % 2
      if (s.kind[d] !== 0 || out[j].d >= 0) continue
      out[j] = { d, text: kickerText(d, s.run.dom[d]) }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exN, exRun])
  /** the draw whose text each explore kicker mesh has finished laying out (-1 none) */
  const exSynced = useRef([-1, -1])

  /* ---------------- refs ---------------- */
  const group = useRef<THREE.Group>(null)
  const kickG = useRef<(THREE.Group | null)[]>([])
  const kickBar = useRef<(THREE.Mesh | null)[]>([])
  const kickReady = useRef<boolean[]>([])
  const domG = useRef<(THREE.Group | null)[]>([])
  const nameBars = useRef<(THREE.Mesh | null)[][]>(HOPPER_DOMAINS.map(() => []))
  const nameReady = useRef<boolean[]>([])
  const hyIdx = useMemo(() => names.map((row) => row.map(hyphens)), [names])

  // what the ticket shows at T: a pure function of T, cached per T, so the
  // plate (this component's frame) and every SdfText (their own frames) agree
  const cur = useRef({ T: NaN, X: NaN, v: -1, s: null as Sched | null, face: 0, dom: -1, task: -1, kind: 0, story: false, op: 0, turn: 0 })
  const info = (T: number) => {
    const { s, X, story } = src(T)
    const c = cur.current
    if (c.T === T && c.X === X && c.s === s && c.v === s.version) return c
    c.T = T
    c.X = X
    c.s = s
    c.v = s.version
    const b = boardAt(s, X, railLen)
    c.face = b.face
    c.turn = b.faceTurn
    c.op = vis(T)
    if (b.face > 0) {
      const d = b.face - 1
      c.dom = s.run.dom[d]
      c.task = c.dom * 5 + s.run.task[d]
      c.kind = s.kind[d]
      c.story = story
    }
    return c
  }

  useSafeFrame(
    'hopper ticket',
    (T) => {
      const g = group.current
      if (!g) return
      const c = info(T)
      const op = c.op
      g.visible = c.face > 0 && op > 0.002
      if (!g.visible) return
      const d = c.face - 1
      const p = place(T)
      g.position.set(p.x, p.y, p.z)
      g.scale.setScalar(p.s)
      g.rotation.x = c.turn
      plateMat.color.copy(colors[c.dom])
      plateMat.opacity = op
      inkMat.opacity = Math.min(1, op * 1.3)
      // the kicker bars: only the face on show, once its text has laid out
      for (let i = 0; i < STORY_FACES + 2; i++) {
        const bar = kickBar.current[i]
        if (!bar) continue
        let on = false
        if (c.kind === 0) {
          if (i < STORY_FACES) on = c.story && d === i
          else on = !c.story && d % 2 === i - STORY_FACES && exSynced.current[i - STORY_FACES] === d
        }
        bar.visible = on && !!kickReady.current[i]
      }
      // the flick card's domain word sits centred, large; the full ticket shows no domain word of its own
      for (let i = 0; i < domG.current.length; i++) {
        const dg = domG.current[i]
        if (dg) dg.scale.setScalar(flickScale[i])
      }
      // hyphen bars in the task name on show
      for (let dm = 0; dm < nameBars.current.length; dm++) {
        const row = nameBars.current[dm]
        for (let k = 0; k < row.length; k++) {
          const bar = row[k]
          if (!bar) continue
          const task = dm * 5 + Math.floor(k / 2)
          bar.visible = c.kind === 0 && c.task === task && !!nameReady.current[task]
        }
      }
    },
    { hide: group },
  )

  const kickOp = (i: number) => (T: number) => {
    const c = info(T)
    if (c.face === 0 || c.kind !== 0) return 0
    const d = c.face - 1
    if (i < STORY_FACES) return c.story && d === i ? c.op : 0
    const j = i - STORY_FACES
    return !c.story && d % 2 === j && exSynced.current[j] === d ? c.op : 0
  }
  const domOp = (i: number) => (T: number) => {
    const c = info(T)
    return c.face > 0 && c.kind === 1 && c.dom === i ? c.op : 0
  }
  const taskOp = (i: number) => (T: number) => {
    const c = info(T)
    return c.face > 0 && c.kind === 0 && c.task === i ? c.op : 0
  }

  // the ticket is a label obstacle (DOM labels never sit on it)
  const obstacle = useMemo<WorldObstacle>(
    () => ({
      box: (T): Box | null => {
        const g = group.current
        if (!g || !g.visible) return null
        const p = place(T)
        return [
          [p.x - (t.w / 2) * p.s, p.y - (t.h / 2) * p.s, p.z],
          [p.x + (t.w / 2) * p.s, p.y + (t.h / 2) * p.s, p.z],
        ]
      },
      padPx: 4,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, place],
  )
  useWorldObstacle('hop-ticket', obstacle)

  const kicker = (i: number, text: string, onSynced?: (m: THREE.Mesh) => void) => {
    const idx = hyphens(text)
    return (
      <group key={'k' + i} ref={(el) => void (kickG.current[i] = el)} position={[0, kickY, 0.01]} scale={kickFit(text)}>
        <SdfText
          font="barlowSemi"
          text={text}
          size={t.kick}
          color={INK}
          anchorX="center"
          letterSpacing={KICK_LS}
          position={[0, 0, 0]}
          opacity={kickOp(i)}
          renderOrder={46}
          onSync={(m) => {
            kickReady.current[i] = placeHyphenBars(m, idx, [kickBar.current[i]], 'barlowSemi', t.kick, KICK_LS, 0, false)
            onSynced?.(m)
          }}
        />
        <mesh ref={(el) => void (kickBar.current[i] = el)} geometry={barGeo} material={inkMat} renderOrder={46} visible={false} />
      </group>
    )
  }

  return (
    <group ref={group}>
      <mesh geometry={plateGeo} material={inkMat} renderOrder={43} scale={[1 + 0.08 / t.w, 1 + 0.08 / t.h, 1]} position={[0, 0, -0.01]} />
      <mesh geometry={plateGeo} material={plateMat} renderOrder={44} />
      {storyKick.map((text, i) => kicker(i, text))}
      {exploreSeen &&
        exKick.map((k, j) =>
        kicker(STORY_FACES + j, k.text, (m) => {
          // troika lays out asynchronously: show this mesh only once it holds this draw's text
          const shown = (m as unknown as { text?: string }).text
          exSynced.current[j] = shown === sdfSafe(k.text) ? k.d : -1
        }),
      )}
      {HOPPER_DOMAINS.map((dm, i) => (
        <group key={dm.key} ref={(el) => void (domG.current[i] = el)} position={[0, 0, 0.01]}>
          <SdfText font="barlowSemi" text={dm.label.toUpperCase()} size={t.kick} color={INK} anchorX="center" letterSpacing={KICK_LS} opacity={domOp(i)} renderOrder={46} />
        </group>
      ))}
      {HOPPER_DOMAINS.flatMap((dm, i) =>
        names[i].map((text, j) => {
          const task = i * 5 + j
          const idx = hyIdx[i][j]
          if (!exploreSeen && !storyTasks.has(task)) return null
          return (
            <group key={dm.key + j}>
              <SdfText
                font="anton"
                text={text}
                size={t.name}
                maxWidth={t.w - 2 * t.notch}
                lineHeight={0.98}
                color={INK}
                anchorX="center"
                anchorY="middle"
                textAlign="center"
                letterSpacing={NAME_LS}
                position={[0, nameY, 0.01]}
                opacity={taskOp(task)}
                renderOrder={46}
                onSync={
                  idx.length
                    ? (m) => {
                        nameReady.current[task] = placeHyphenBars(m, idx, [nameBars.current[i][j * 2], nameBars.current[i][j * 2 + 1]], 'anton', t.name, NAME_LS, nameY, true)
                      }
                    : undefined
                }
              />
              {idx.map((_, k) => (
                <mesh key={k} ref={(el) => void (nameBars.current[i][j * 2 + k] = el)} geometry={barGeo} material={inkMat} renderOrder={46} visible={false} />
              ))}
            </group>
          )
        }),
      )}
      <Pen points={outline} color={LIGHT} width={PEN.axis} head hot progress={trace} opacity={traceOut} gain={() => 1.3} renderOrder={47} />
    </group>
  )
}
